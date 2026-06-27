import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, "../data/settings.json");

const router = Router();

function getGroqConfig(reqModel) {
  try {
    const s = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return {
      apiKey: s.groq?.apiKey || process.env.GROQ_API_KEY || "",
      model:  reqModel || s.groq?.model || "llama-3.3-70b-versatile",
    };
  } catch {
    return { apiKey: process.env.GROQ_API_KEY || "", model: reqModel || "llama-3.3-70b-versatile" };
  }
}

async function callGroq(apiKey, model, messages, maxTokens = 1500) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from AI. Please try again.");
  return content;
}

function parseJSON(content) {
  try { return JSON.parse(content); }
  catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); }
      catch { throw new Error("Could not parse AI response. Please try again."); }
    }
    throw new Error("AI returned an unexpected format. Please try again.");
  }
}

function requireApiKey(res, apiKey) {
  if (!apiKey) {
    res.status(503).json({ error: "Groq API key is not configured. Ask the admin to set it up in the Admin panel." });
    return false;
  }
  return true;
}

// ── POST /api/generate — Formula Generation ───────────────────────────────────
router.post("/", async (req, res) => {
  const { description, context, model: reqModel } = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 5) {
    return res.status(400).json({ error: "Please provide a description of what you want the formula to do." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const systemPrompt = `You are an expert Microsoft Excel formula assistant. Your job is to generate the perfect Excel formula based on the user's plain English description.

Always respond with ONLY valid JSON in this exact format (no markdown, no code fences, no extra text):
{
  "formula": "=EXACT_FORMULA(args)",
  "explanation": "A clear, concise explanation of what this formula does and how it works",
  "breakdown": [
    {"part": "FUNCTION_NAME", "description": "What this function does"},
    {"part": "argument1", "description": "What this argument does"}
  ],
  "example": "Example usage: If A1 contains 'Hello' and B1 contains 100, the result would be...",
  "tips": ["Useful tip about using this formula", "Another helpful tip"]
}

Rules:
- The formula must be a valid Excel formula starting with =
- Explain it clearly for non-technical users
- Keep breakdown to the most important parts (2-5 items)
- Provide a concrete, realistic example
- Give 1-3 practical tips`;

  const userMessage = `Generate an Excel formula for this task: ${description.trim()}${context ? `\n\nAdditional context: ${context.trim()}` : ""}`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage },
    ]);

    const parsed = parseJSON(content);
    if (!parsed.formula || !parsed.explanation) {
      return res.status(502).json({ error: "AI response was incomplete. Please try again." });
    }
    res.json(parsed);
  } catch (err) {
    console.error("[generate] Error:", err);
    res.status(502).json({ error: err.message || "Failed to reach the AI service." });
  }
});

// ── POST /api/generate/optimize — Formula Optimization ────────────────────────
router.post("/optimize", async (req, res) => {
  const { formula, context, model: reqModel } = req.body || {};
  if (!formula || typeof formula !== "string" || formula.trim().length < 3) {
    return res.status(400).json({ error: "Please provide an Excel formula to optimize." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const systemPrompt = `You are an expert Excel formula optimizer. Analyze the given formula and suggest improvements for readability, performance, and reliability.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "optimizedFormula": "=IMPROVED_FORMULA()",
  "improvements": ["Improvement description 1", "Improvement description 2"],
  "explanation": "Why the optimized version is better",
  "performanceNote": "Notes on performance or compatibility",
  "alternativeApproaches": ["Alternative formula 1 if applicable"]
}

If the formula is already optimal, set optimizedFormula to the same as input and explain why it's already optimal.`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Optimize this Excel formula: ${formula.trim()}${context ? `\n\nContext: ${context.trim()}` : ""}` },
    ]);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/optimize] Error:", err);
    res.status(502).json({ error: err.message || "Failed to optimize formula." });
  }
});

// ── POST /api/generate/debug — Formula Debugging ──────────────────────────────
router.post("/debug", async (req, res) => {
  const { formula, errorMessage, context, model: reqModel } = req.body || {};
  if (!formula || typeof formula !== "string" || formula.trim().length < 3) {
    return res.status(400).json({ error: "Please provide an Excel formula to debug." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const systemPrompt = `You are an expert Excel formula debugger. Analyze the given formula for errors, issues, and problems, then provide clear fixes.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "issues": ["Issue 1 found in the formula", "Issue 2 if any"],
  "correctedFormula": "=CORRECTED_FORMULA()",
  "fixes": [
    {"problem": "What was wrong", "solution": "How it was fixed", "correctedPart": "The fixed part"}
  ],
  "explanation": "Overall explanation of what was wrong and how it was fixed",
  "preventionTips": ["Tip to avoid this error in future"]
}

If no issues are found, say so clearly and explain what the formula does correctly.`;

  const userMsg = `Debug this Excel formula: ${formula.trim()}${errorMessage ? `\nError message: ${errorMessage.trim()}` : ""}${context ? `\nContext: ${context.trim()}` : ""}`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMsg },
    ]);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/debug] Error:", err);
    res.status(502).json({ error: err.message || "Failed to debug formula." });
  }
});

// ── POST /api/generate/convert — Formula ↔ VBA Conversion ────────────────────
router.post("/convert", async (req, res) => {
  const { input, direction, context, model: reqModel } = req.body || {};
  if (!input || typeof input !== "string" || input.trim().length < 3) {
    return res.status(400).json({ error: "Please provide a formula or VBA code to convert." });
  }
  if (!["to-vba", "to-formula"].includes(direction)) {
    return res.status(400).json({ error: "Direction must be 'to-vba' or 'to-formula'." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const isToVba = direction === "to-vba";

  const systemPrompt = isToVba
    ? `You are an expert Excel and VBA developer. Convert the given Excel formula to equivalent VBA code.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "vbaCode": "Sub ConvertedMacro()\\n  ' VBA code here\\nEnd Sub",
  "explanation": "What this VBA code does",
  "usage": "How to use this VBA macro",
  "notes": "Any important notes or limitations"
}`
    : `You are an expert Excel and VBA developer. Convert the given VBA code to an equivalent Excel formula or formulas.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "formula": "=EQUIVALENT_FORMULA()",
  "explanation": "How this formula replaces the VBA code",
  "breakdown": [{"part": "part", "description": "what it does"}],
  "limitations": "Any limitations compared to the VBA approach",
  "notes": "Additional notes"
}`;

  const userMsg = isToVba
    ? `Convert this Excel formula to VBA: ${input.trim()}${context ? `\nContext: ${context.trim()}` : ""}`
    : `Convert this VBA code to Excel formula(s): ${input.trim()}${context ? `\nContext: ${context.trim()}` : ""}`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMsg },
    ], 2000);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/convert] Error:", err);
    res.status(502).json({ error: err.message || "Failed to convert." });
  }
});

// ── POST /api/generate/explain — Multi-Language Explanations ──────────────────
router.post("/explain", async (req, res) => {
  const { formula, language, model: reqModel } = req.body || {};
  if (!formula || typeof formula !== "string" || formula.trim().length < 3) {
    return res.status(400).json({ error: "Please provide an Excel formula to explain." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const targetLanguage = language || "English";

  const systemPrompt = `You are an expert Excel educator. Explain the given Excel formula in ${targetLanguage} in a clear, beginner-friendly way.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "formula": "the formula as provided",
  "simpleExplanation": "A very simple, 1-2 sentence explanation in ${targetLanguage}",
  "detailedExplanation": "A detailed step-by-step explanation in ${targetLanguage}",
  "realWorldExample": "A concrete real-world example of when to use this in ${targetLanguage}",
  "keyTerms": [{"term": "function or term name", "meaning": "what it means in ${targetLanguage}"}],
  "language": "${targetLanguage}"
}

Write ALL explanation fields in ${targetLanguage}. Only the JSON keys must remain in English.`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Explain this Excel formula in ${targetLanguage}: ${formula.trim()}` },
    ], 1500);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/explain] Error:", err);
    res.status(502).json({ error: err.message || "Failed to explain formula." });
  }
});

// ── POST /api/generate/named-ranges — Named Range Recommendations ─────────────
router.post("/named-ranges", async (req, res) => {
  const { description, model: reqModel } = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return res.status(400).json({ error: "Please describe your spreadsheet data and columns." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const systemPrompt = `You are an expert Excel workbook organizer. Based on the description of the spreadsheet data, recommend meaningful named ranges that will make formulas more readable and maintainable.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "recommendations": [
    {
      "name": "SuggestedName",
      "suggestedRange": "A2:A100 (or describe the range)",
      "purpose": "What this named range represents",
      "exampleUse": "=SUMIF(SuggestedName,\"Paid\",AmountColumn)"
    }
  ],
  "namingConventions": "Tips on naming conventions used",
  "benefits": "How these named ranges will improve your workbook",
  "implementationSteps": "How to create named ranges in Excel"
}`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Suggest named ranges for this spreadsheet: ${description.trim()}` },
    ]);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/named-ranges] Error:", err);
    res.status(502).json({ error: err.message || "Failed to generate named range recommendations." });
  }
});

// ── POST /api/generate/analyze — Workbook Analysis ────────────────────────────
router.post("/analyze", async (req, res) => {
  const { description, model: reqModel } = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 10) {
    return res.status(400).json({ error: "Please describe your workbook structure and goals." });
  }

  const { apiKey, model } = getGroqConfig(reqModel);
  if (!requireApiKey(res, apiKey)) return;

  const systemPrompt = `You are an expert Excel consultant. Analyze the described workbook and provide actionable recommendations for formulas, structure, and best practices.

Always respond with ONLY valid JSON (no markdown, no code fences):
{
  "summary": "Brief summary of the workbook's purpose and structure",
  "strengths": ["What's done well"],
  "improvements": [
    {"area": "Area to improve", "recommendation": "Specific recommendation", "priority": "High/Medium/Low"}
  ],
  "recommendedFormulas": [
    {"purpose": "What this formula does", "formula": "=EXAMPLE_FORMULA()", "where": "Where to use it"}
  ],
  "structureTips": ["Structural tip 1", "Structural tip 2"],
  "automationOpportunities": ["Things that could be automated with formulas or VBA"]
}`;

  try {
    const content = await callGroq(apiKey, model, [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Analyze this workbook: ${description.trim()}` },
    ], 2000);

    res.json(parseJSON(content));
  } catch (err) {
    console.error("[generate/analyze] Error:", err);
    res.status(502).json({ error: err.message || "Failed to analyze workbook." });
  }
});

export default router;
