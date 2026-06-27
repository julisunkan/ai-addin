import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, extname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, "../data/settings.json");
const MAX_ROWS = 500;
const MAX_COLS = 20;

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(ext)) cb(null, true);
    else cb(new Error("Only .xlsx, .xls, and .csv files are supported."));
  },
});

function getGroqConfig() {
  try {
    const s = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return { apiKey: s.groq?.apiKey || process.env.GROQ_API_KEY || "", model: s.groq?.model || "llama-3.3-70b-versatile" };
  } catch {
    return { apiKey: process.env.GROQ_API_KEY || "", model: "llama-3.3-70b-versatile" };
  }
}

function detectType(values) {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== "");
  if (nonEmpty.length === 0) return "text";
  const numCount = nonEmpty.filter(v => !isNaN(Number(v)) && String(v).trim() !== "").length;
  return numCount / nonEmpty.length > 0.8 ? "numeric" : "text";
}

function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetData = {};

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
    if (raw.length < 2) continue;

    const rawHeaders = raw[0];
    const headers = rawHeaders
      .slice(0, MAX_COLS)
      .map((h, i) => (h && String(h).trim() ? String(h).trim() : `Column${i + 1}`));

    const totalRows = raw.length - 1;
    const dataRows = raw
      .slice(1)
      .filter(row => row.some(c => c !== null && c !== undefined && c !== ""))
      .slice(0, MAX_ROWS)
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          const v = row[i];
          if (v === null || v === undefined) { obj[h] = null; return; }
          const num = Number(v);
          obj[h] = !isNaN(num) && String(v).trim() !== "" ? num : String(v).trim();
        });
        return obj;
      });

    const columns = headers.map(h => ({
      name: h,
      type: detectType(dataRows.map(r => r[h])),
    }));

    sheetData[name] = { columns, rows: dataRows, totalRows };
  }

  return { sheets: wb.SheetNames, sheetData };
}

// ── POST /api/visualize/upload ────────────────────────────────────────────────
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const { sheets, sheetData } = parseWorkbook(req.file.buffer);

    if (sheets.length === 0) {
      return res.status(400).json({ error: "The file appears to be empty or unreadable." });
    }

    const validSheets = sheets.filter(s => sheetData[s]);
    if (validSheets.length === 0) {
      return res.status(400).json({ error: "Could not find data with headers. Make sure the first row contains column names." });
    }

    res.json({
      filename: req.file.originalname,
      sheets: validSheets,
      sheetData,
    });
  } catch (err) {
    console.error("[visualize/upload]", err);
    res.status(500).json({ error: "Failed to parse the file. Ensure it is a valid Excel or CSV file." });
  }
});

// ── POST /api/visualize/insights ──────────────────────────────────────────────
router.post("/insights", async (req, res) => {
  const { columns, sampleRows, totalRows, sheetName } = req.body || {};
  if (!columns?.length) return res.status(400).json({ error: "Column data is required." });

  const { apiKey, model } = getGroqConfig();
  if (!apiKey) return res.status(503).json({ error: "Groq API key not configured. Set it in Admin > AI Settings." });

  const systemPrompt = `You are a data visualization expert. Analyze spreadsheet data and recommend the best chart type and configuration.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "bestChartType": "bar|line|area|pie|scatter",
  "xColumn": "exact column name for X axis / labels",
  "yColumns": ["exact column name 1", "exact column name 2"],
  "suggestedTitle": "A concise descriptive chart title",
  "insights": ["Key finding 1", "Key finding 2", "Key finding 3"],
  "reasoning": "Short explanation of why this chart type is best for this data"
}

Rules:
- bar: comparing categories or groups side by side
- line: trends over time, sequential data
- area: like line but emphasizes cumulative volume
- pie: proportions/shares with <= 8 distinct categories
- scatter: correlation between two numeric columns
- Always choose xColumn and yColumns from the provided column names exactly`;

  const colDesc = columns.map(c => `${c.name} (${c.type})`).join(", ");
  const sample = JSON.stringify((sampleRows || []).slice(0, 5));

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Sheet: ${sheetName || "Sheet1"}\nTotal rows: ${totalRows}\nColumns: ${colDesc}\nSample data (first 5 rows): ${sample}\n\nRecommend the best visualization.` },
        ],
        temperature: 0.2,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      return res.status(502).json({ error: e.error?.message || "AI service error." });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: "Empty AI response." });

    let parsed;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { return res.status(502).json({ error: "Could not parse AI response." }); } }
      else return res.status(502).json({ error: "Unexpected AI response format." });
    }

    res.json(parsed);
  } catch (err) {
    console.error("[visualize/insights]", err);
    res.status(502).json({ error: "Failed to get AI insights." });
  }
});

export default router;
