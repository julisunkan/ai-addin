import express from "express";
import cors from "cors";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import paymentsRouter from "./routes/payments.js";
import adminRouter from "./routes/admin.js";
import settingsRouter from "./routes/settings.js";
import generateRouter from "./routes/generate.js";
import ticketsRouter from "./routes/tickets.js";
import visualizeRouter from "./routes/visualize.js";
import { startExpiryChecker } from "./lib/expiry-checker.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
const isProd = process.env.NODE_ENV === "production";

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", settingsRouter);
app.use("/api/config", settingsRouter);
app.use("/api/generate", generateRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/visualize", visualizeRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// In production, serve the Vite-built frontend and handle client-side routing
if (isProd) {
  const distPath = join(__dirname, "../dist/public");
  if (existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(join(distPath, "index.html")));
  }
} else {
  app.get("/", (_req, res) => res.send("AI Formula Generator API — dev mode (frontend on port 5000)"));
}

const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 AI Formula Generator API running on http://localhost:${PORT}`);
  startExpiryChecker();

  const wallet = process.env.USDT_WALLET_ADDRESS;
  const groqKey = process.env.GROQ_API_KEY;
  if (!wallet) console.warn("⚠️  USDT_WALLET_ADDRESS is not set — configure in Admin > Payment");
  else console.log(`💳 Wallet configured (${(process.env.USDT_NETWORK || "tron").toUpperCase()})`);
  if (!groqKey) console.warn("⚠️  GROQ_API_KEY is not set — configure in Admin > AI Settings");
  else console.log("🤖 Groq API key configured");
});
