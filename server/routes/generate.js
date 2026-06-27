import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, "../data/settings.json");

const router = Router();

function getGroqConfig() {
  try {
    const s = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return {
      apiKey: s.groq?.apiKey || process.env.GROQ_API_KEY || "",
      model:  s.groq?.model  || "llama-3.3-70b-versatile",
    };
  } catch {
    return { apiKey: process.env.GROQ_API_KEY || "", model: "llama-3.3-70b-versatile" };
  }
}

// POST /api/generate
router.post("/", async (req, res) => {
  const { description, context } = req.body || {};
  if (!description || typeof description !== "string" || description.trim().length < 5) {
    return res.status(400).json({ error: "Please provide a description of what you want the formula to do." });
  }

  const { apiKey, model } = getGroqConfig();
  if (!apiKey) {
    return res.status(503).json({ error: "Groq API key is not configured. Ask the admin to set it up in the Admin panel." });
  }

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
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        temperature: 0.2,
        max_tokens:  1024,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Groq API error:", err);
      return res.status(502).json({ error: err.error?.message || `Groq API error (${response.status})` });
    }

    const data    = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) return res.status(502).json({ error: "Empty response from AI. Please try again." });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch { return res.status(502).json({ error: "Could not parse AI response. Please try again." }); }
      } else {
        return res.status(502).json({ error: "AI returned an unexpected format. Please try again." });
      }
    }

    if (!parsed.formula || !parsed.explanation) {
      return res.status(502).json({ error: "AI response was incomplete. Please try again." });
    }

    res.json(parsed);
  } catch (err) {
    console.error("[generate] Error:", err);
    res.status(502).json({ error: "Failed to reach the AI service. Check your internet connection and try again." });
  }
});

export default router;
