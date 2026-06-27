import { Router } from "express";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { notifyNewLicense } from "../lib/notify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LICENSES_FILE = join(__dirname, "../data/licenses.json");
const SETTINGS_FILE = join(__dirname, "../data/settings.json");

const router = Router();

const PRICE_USDT = 1;

const TRONGRID_API_KEY  = process.env.TRONGRID_API_KEY  || "";
const BSCSCAN_API_KEY   = process.env.BSCSCAN_API_KEY   || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const USDT_CONTRACTS = {
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  bsc:  "0x55d398326f99059fF775485246999027B3197955",
  eth:  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
};

function getPaymentConfig() {
  try {
    const s = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
    return {
      walletAddress: s.payment?.walletAddress || process.env.USDT_WALLET_ADDRESS || "",
      network: (s.payment?.network || process.env.USDT_NETWORK || "tron").toLowerCase(),
    };
  } catch {
    return {
      walletAddress: process.env.USDT_WALLET_ADDRESS || "",
      network: (process.env.USDT_NETWORK || "tron").toLowerCase(),
    };
  }
}

function loadLicenses() {
  try { return JSON.parse(readFileSync(LICENSES_FILE, "utf8")); } catch { return []; }
}

function saveLicenses(licenses) {
  writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
}

function generateLicenseKey() {
  return "AIFG-" + randomBytes(12).toString("hex").toUpperCase();
}

function txAlreadyUsed(txHash) {
  return loadLicenses().some(l => l.txHash === txHash);
}

function saveLicense(licenseKey, txHash, email) {
  const licenses = loadLicenses();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  licenses.push({
    licenseKey,
    txHash,
    issuedAt:  new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    email:     email ?? null,
  });
  saveLicenses(licenses);
}

async function verifyTron(txHash, walletAddress) {
  const headers = { Accept: "application/json" };
  if (TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = TRONGRID_API_KEY;
  const res = await fetch(`https://api.trongrid.io/v1/transactions/${txHash}`, { headers });
  if (!res.ok) return { ok: false, reason: "TronGrid request failed" };
  const json = await res.json();
  const tx = json?.data?.[0];
  if (!tx) return { ok: false, reason: "Transaction not found" };
  if (tx?.ret?.[0]?.contractRet !== "SUCCESS") return { ok: false, reason: "Transaction not successful" };
  const data = tx?.raw_data?.contract?.[0]?.parameter?.value?.data || "";
  if (data.startsWith("a9059cbb")) {
    const to     = "41" + data.slice(32, 72);
    const amount = parseInt(data.slice(72, 136), 16) / 1e6;
    if (to.toLowerCase() !== walletAddress.toLowerCase()) return { ok: false, reason: "Wrong destination wallet" };
    if (amount < PRICE_USDT) return { ok: false, reason: `Amount too low: ${amount} USDT (need ${PRICE_USDT})` };
    return { ok: true };
  }
  return { ok: false, reason: "Not a TRC-20 USDT transfer" };
}

async function verifyBsc(txHash, walletAddress) {
  if (!BSCSCAN_API_KEY) return { ok: false, reason: "BSCSCAN_API_KEY not configured" };
  const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACTS.bsc}&address=${walletAddress}&apikey=${BSCSCAN_API_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.status !== "1") return { ok: false, reason: "BSCScan query failed" };
  const tx = json.result?.find(t => t.hash.toLowerCase() === txHash.toLowerCase());
  if (!tx) return { ok: false, reason: "Transaction not found" };
  const amount = Number(tx.value) / 10 ** Number(tx.tokenDecimal);
  if (amount < PRICE_USDT) return { ok: false, reason: `Amount too low: ${amount} USDT` };
  return { ok: true };
}

async function verifyEth(txHash, walletAddress) {
  if (!ETHERSCAN_API_KEY) return { ok: false, reason: "ETHERSCAN_API_KEY not configured" };
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACTS.eth}&address=${walletAddress}&apikey=${ETHERSCAN_API_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  if (json.status !== "1") return { ok: false, reason: "Etherscan query failed" };
  const tx = json.result?.find(t => t.hash.toLowerCase() === txHash.toLowerCase());
  if (!tx) return { ok: false, reason: "Transaction not found" };
  const amount = Number(tx.value) / 10 ** Number(tx.tokenDecimal);
  if (amount < PRICE_USDT) return { ok: false, reason: `Amount too low: ${amount} USDT` };
  return { ok: true };
}

// GET /api/payments/config
router.get("/config", (req, res) => {
  const cfg = getPaymentConfig();
  if (!cfg.walletAddress) {
    return res.status(503).json({ error: "Wallet not configured. Ask the admin to set it up." });
  }
  res.json({ address: cfg.walletAddress, network: cfg.network, price: PRICE_USDT });
});

// POST /api/payments/verify
router.post("/verify", async (req, res) => {
  const { txHash, email } = req.body || {};
  if (!txHash) return res.status(400).json({ error: "txHash is required" });
  if (txAlreadyUsed(txHash)) {
    return res.status(400).json({ error: "This transaction has already been used." });
  }

  const cfg = getPaymentConfig();
  let result;
  try {
    if      (cfg.network === "tron") result = await verifyTron(txHash, cfg.walletAddress);
    else if (cfg.network === "bsc")  result = await verifyBsc(txHash, cfg.walletAddress);
    else if (cfg.network === "eth")  result = await verifyEth(txHash, cfg.walletAddress);
    else result = { ok: false, reason: `Unknown network: ${cfg.network}` };
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(502).json({ error: "Blockchain lookup failed — try again shortly" });
  }

  if (!result.ok) return res.status(402).json({ error: result.reason });

  const licenseKey = generateLicenseKey();
  const cleanEmail = typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;
  saveLicense(licenseKey, txHash, cleanEmail);
  console.log(`✅ License issued: ${licenseKey}`);

  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
  notifyNewLicense({ licenseKey, planLabel: "Monthly", planId: "monthly", expiresAt: expiresAt.toISOString(), txHash, network: cfg.network })
    .catch(err => console.warn("[notify] error:", err.message));

  res.json({ licenseKey });
});

// GET /api/payments/check/:key
router.get("/check/:key", (req, res) => {
  const { key } = req.params;
  const license = loadLicenses().find(l => l.licenseKey === key);
  if (!license) return res.json({ valid: false, reason: "not_found" });
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    return res.json({ valid: false, reason: "expired" });
  }
  res.json({ valid: true, issuedAt: license.issuedAt ?? null });
});

export default router;
