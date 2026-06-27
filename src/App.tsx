import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles, Copy, Check, Download, FileText, Lock, Unlock,
  ChevronDown, ChevronUp, Loader2, AlertCircle, X,
  KeyRound, CreditCard, Shield, Zap, TableIcon
} from "lucide-react";

// Office.js globals — available inside Excel, undefined in browser
declare const Office: { context: unknown } | undefined;
declare const Excel: {
  run: (fn: (ctx: {
    workbook: { getSelectedRange: () => { formulas: string[][]; load: (s: string) => void } };
    sync: () => Promise<void>;
  }) => Promise<void>) => Promise<void>;
} | undefined;
import { getLicense, setLicense, clearLicense, checkLicenseValid, fetchPaymentConfig, verifyPayment, activateLicenseKey } from "./lib/payment";
import { exportToTxt, exportToPdf, type FormulaResult } from "./lib/formulaExport";
import { useAppConfig } from "./context/AppConfigContext";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCopyText() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

// ── Paywall Component ─────────────────────────────────────────────────────────

interface PaywallProps {
  onUnlocked: () => void;
  initialTab?: "pay" | "key";
}

function Paywall({ onUnlocked, initialTab = "pay" }: PaywallProps) {
  const [tab, setTab] = useState<"pay" | "key">(initialTab);

  // Pay tab state
  const [payConfig, setPayConfig] = useState<{ address: string; network: string; price: number } | null>(null);
  const [payConfigError, setPayConfigError] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [copied, setCopied] = useState(false);

  // Key tab state
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    if (tab === "pay" && !payConfig && !loadingConfig) {
      setLoadingConfig(true);
      fetchPaymentConfig()
        .then(cfg => {
          if (!cfg) setPayConfigError("Payment not configured. Contact the admin.");
          else setPayConfig(cfg);
        })
        .catch(() => setPayConfigError("Could not load payment details."))
        .finally(() => setLoadingConfig(false));
    }
  }, [tab]);

  function copyAddress() {
    if (!payConfig) return;
    navigator.clipboard.writeText(payConfig.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleVerify() {
    if (!txHash.trim()) { setVerifyError("Please paste your transaction hash."); return; }
    setVerifying(true); setVerifyError("");
    const result = await verifyPayment(txHash.trim(), email || undefined);
    setVerifying(false);
    if (result.success && result.licenseKey) {
      setLicense(result.licenseKey);
      onUnlocked();
    } else {
      setVerifyError(result.error || "Verification failed. Check your TX hash and try again.");
    }
  }

  async function handleActivateKey() {
    if (!licenseKey.trim()) { setKeyError("Please enter your license key."); return; }
    setActivating(true); setKeyError("");
    const result = await activateLicenseKey(licenseKey.trim());
    setActivating(false);
    if (result.success) onUnlocked();
    else setKeyError(result.error || "Invalid key. Please check and try again.");
  }

  const networkLabel = payConfig?.network === "bsc" ? "BEP-20 (BSC)" : payConfig?.network === "eth" ? "ERC-20 (Ethereum)" : "TRC-20 (Tron)";

  return (
    <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50 to-white overflow-hidden shadow-lg">
      {/* Header */}
      <div className="bg-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5 mb-1">
          <Lock className="w-5 h-5 opacity-90" />
          <h3 className="font-bold text-base">Unlock Your Formula</h3>
        </div>
        <p className="text-xs text-indigo-200">Pay once — get lifetime access to all generated formulas</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-indigo-100">
        <button
          onClick={() => setTab("pay")}
          data-testid="tab-pay"
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${tab === "pay" ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CreditCard className="w-4 h-4" /> Pay 1 USDT
        </button>
        <button
          onClick={() => setTab("key")}
          data-testid="tab-key"
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${tab === "key" ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-muted-foreground hover:text-foreground"}`}
        >
          <KeyRound className="w-4 h-4" /> License Key
        </button>
      </div>

      <div className="p-5 space-y-4">
        {tab === "pay" && (
          <>
            {loadingConfig && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading payment details…
              </div>
            )}
            {payConfigError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {payConfigError}
              </div>
            )}
            {payConfig && (
              <>
                {/* Amount banner */}
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Amount</p>
                    <p className="text-2xl font-extrabold text-indigo-700">{payConfig.price} USDT</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Network</p>
                    <p className="text-sm font-bold text-indigo-700">{networkLabel}</p>
                  </div>
                </div>

                {/* Wallet address */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Send To This Wallet</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3">
                    <code className="flex-1 text-xs font-mono text-foreground break-all select-all leading-relaxed">{payConfig.address}</code>
                    <button
                      onClick={copyAddress}
                      data-testid="button-copy-wallet"
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium">⚠ Only send USDT on the {networkLabel} network</p>
                </div>

                {/* TX hash input */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">After Sending, Paste TX Hash</p>
                  <input
                    type="text"
                    value={txHash}
                    onChange={e => { setTxHash(e.target.value); setVerifyError(""); }}
                    placeholder="0x... or transaction ID"
                    data-testid="input-tx-hash"
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Your email (optional, for receipt)"
                    data-testid="input-email"
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-muted-foreground/50"
                  />
                </div>

                {verifyError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {verifyError}
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={verifying || !txHash.trim()}
                  data-testid="button-verify-payment"
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <><Shield className="w-4 h-4" /> Verify & Unlock</>}
                </button>
              </>
            )}
          </>
        )}

        {tab === "key" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Already have a license key? Enter it below to unlock.</p>
            <input
              type="text"
              value={licenseKey}
              onChange={e => { setLicenseKey(e.target.value); setKeyError(""); }}
              placeholder="AIFG-XXXXXXXXXXXX"
              data-testid="input-license-key"
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-muted-foreground/50"
              onKeyDown={e => e.key === "Enter" && handleActivateKey()}
            />
            {keyError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {keyError}
              </div>
            )}
            <button
              onClick={handleActivateKey}
              disabled={activating || !licenseKey.trim()}
              data-testid="button-activate-key"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {activating ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <><Unlock className="w-4 h-4" /> Activate Key</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Formula Result Display ────────────────────────────────────────────────────

interface FormulaDisplayProps {
  result: FormulaResult;
  description: string;
  isUnlocked: boolean;
  onRequestUnlock: (tab: "pay" | "key") => void;
}

// Returns true only when running inside Excel with the Office.js SDK loaded
function isInExcel(): boolean {
  try {
    return (
      typeof Office !== "undefined" &&
      Office !== null &&
      typeof Excel !== "undefined" &&
      Excel !== null &&
      (Office as { context: unknown }).context !== undefined &&
      (Office as { context: unknown }).context !== null
    );
  } catch {
    return false;
  }
}

type InsertStatus = "idle" | "inserting" | "success" | "copied" | "error";

function FormulaDisplay({ result, description, isUnlocked, onRequestUnlock }: FormulaDisplayProps) {
  const { copied, copy } = useCopyText();
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [insertStatus, setInsertStatus] = useState<InsertStatus>("idle");
  const [insertError, setInsertError] = useState("");
  const inExcel = isInExcel();

  function handleCopy() {
    if (!isUnlocked) { onRequestUnlock("pay"); return; }
    copy(result.formula);
  }

  async function handleInsert() {
    if (!isUnlocked) { onRequestUnlock("pay"); return; }

    setInsertStatus("inserting");
    setInsertError("");

    // If running in Excel, use Office.js to insert into the selected cell
    if (inExcel) {
      try {
        await Excel!.run(async (ctx) => {
          const range = ctx.workbook.getSelectedRange();
          range.formulas = [[result.formula]];
          await ctx.sync();
        });
        setInsertStatus("success");
        setTimeout(() => setInsertStatus("idle"), 2500);
      } catch (err) {
        console.error("Excel insert failed:", err);
        setInsertError("Could not insert — make sure a cell is selected in Excel.");
        setInsertStatus("error");
        setTimeout(() => { setInsertStatus("idle"); setInsertError(""); }, 4000);
      }
    } else {
      // Fallback: copy to clipboard with a note
      navigator.clipboard.writeText(result.formula).then(() => {
        setInsertStatus("copied");
        setTimeout(() => setInsertStatus("idle"), 2500);
      });
    }
  }

  const insertLabel = () => {
    if (!isUnlocked) return <><Lock className="w-3.5 h-3.5" /> Insert</>;
    switch (insertStatus) {
      case "inserting": return <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Inserting…</>;
      case "success":   return <><Check className="w-3.5 h-3.5" /> Inserted!</>;
      case "copied":    return <><Check className="w-3.5 h-3.5" /> Copied!</>;
      case "error":     return <><AlertCircle className="w-3.5 h-3.5" /> Failed</>;
      default:          return <><TableIcon className="w-3.5 h-3.5" /> {inExcel ? "Insert into Cell" : "Insert"}</>;
    }
  };

  const insertBtnClass = () => {
    if (!isUnlocked) return "bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200";
    switch (insertStatus) {
      case "success": return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "copied":  return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "error":   return "bg-red-50 text-red-600 border border-red-200";
      default:        return "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Formula box */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Excel Formula</p>
          <div className="flex items-center gap-1.5">
            {/* Insert into Cell — primary CTA */}
            <button
              onClick={handleInsert}
              disabled={insertStatus === "inserting"}
              data-testid="button-insert-formula"
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${insertBtnClass()}`}
            >
              {insertLabel()}
            </button>
            {/* Copy */}
            <button
              onClick={handleCopy}
              data-testid="button-copy-formula"
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                isUnlocked
                  ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                  : "bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200"
              }`}
            >
              {isUnlocked
                ? copied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>
                : <><Lock className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
        </div>
        {/* Insert error message */}
        {insertStatus === "error" && insertError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {insertError}
          </div>
        )}
        {/* "Copied to clipboard" note when not in Excel */}
        {insertStatus === "copied" && !inExcel && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
            <Check className="w-3.5 h-3.5 shrink-0" /> Formula copied to clipboard. Open Excel and paste it into a cell.
          </div>
        )}
        {/* Success: inserted into Excel */}
        {insertStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
            <Check className="w-3.5 h-3.5 shrink-0" /> Formula inserted into the selected cell!
          </div>
        )}
        <div className={`relative rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3.5 transition-all ${!isUnlocked ? "select-none" : ""}`}>
          <code
            data-testid="text-formula"
            className={`block font-mono font-bold text-base text-indigo-800 break-all leading-relaxed transition-all ${!isUnlocked ? "blur-[5px]" : ""}`}
          >
            {result.formula}
          </code>
          {!isUnlocked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">How It Works</p>
        <div className={`bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5 transition-all ${!isUnlocked ? "blur-[4px] select-none" : ""}`}>
          <p data-testid="text-explanation" className="text-sm text-emerald-900 leading-relaxed">
            {result.explanation}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      {result.breakdown?.length > 0 && (
        <div>
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors w-full"
          >
            Formula Breakdown {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showBreakdown && (
            <div className={`rounded-xl border border-border overflow-hidden transition-all ${!isUnlocked ? "blur-[4px] select-none" : ""}`}>
              {result.breakdown.map((item, i) => (
                <div key={i} className={`flex gap-3 px-4 py-3 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"} border-b border-border last:border-0`}>
                  <code data-testid={`text-breakdown-part-${i}`} className="text-xs font-mono font-bold text-indigo-700 shrink-0 mt-0.5 min-w-[80px]">{item.part}</code>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Example */}
      {result.example && (
        <div className={`bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 transition-all ${!isUnlocked ? "blur-[4px] select-none" : ""}`}>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Example</p>
          <p data-testid="text-example" className="text-sm text-amber-900 leading-relaxed">{result.example}</p>
        </div>
      )}

      {/* Tips */}
      {result.tips?.length > 0 && (
        <div className={`space-y-1.5 transition-all ${!isUnlocked ? "blur-[4px] select-none" : ""}`}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips</p>
          {result.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
              <span data-testid={`text-tip-${i}`}>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* Download buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (!isUnlocked) { onRequestUnlock("pay"); return; } exportToPdf(result, description); }}
          data-testid="button-download-pdf"
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors border ${
            isUnlocked
              ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              : "bg-gray-50 text-gray-400 border-gray-200 cursor-pointer"
          }`}
        >
          {!isUnlocked && <Lock className="w-3.5 h-3.5" />}
          <FileText className="w-4 h-4" /> PDF
        </button>
        <button
          onClick={() => { if (!isUnlocked) { onRequestUnlock("pay"); return; } exportToTxt(result, description); }}
          data-testid="button-download-txt"
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors border ${
            isUnlocked
              ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              : "bg-gray-50 text-gray-400 border-gray-200 cursor-pointer"
          }`}
        >
          {!isUnlocked && <Lock className="w-3.5 h-3.5" />}
          <Download className="w-4 h-4" /> TXT
        </button>
      </div>

      {!isUnlocked && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <Lock className="w-4 h-4 text-indigo-500 shrink-0" />
          <p className="text-xs text-indigo-700 font-medium">
            Formula is locked.{" "}
            <button onClick={() => onRequestUnlock("pay")} className="font-bold underline hover:no-underline">Pay 1 USDT</button>
            {" "}or{" "}
            <button onClick={() => onRequestUnlock("key")} className="font-bold underline hover:no-underline">enter a license key</button>
            {" "}to unlock.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const config = useAppConfig();

  const [description, setDescription] = useState("");
  const [context, setContext]         = useState("");
  const [showContext, setShowContext]  = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult]           = useState<FormulaResult | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [isUnlocked, setIsUnlocked]   = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallTab, setPaywallTab]   = useState<"pay" | "key">("pay");
  const resultRef = useRef<HTMLDivElement>(null);

  // Check for existing license on load
  useEffect(() => {
    const key = getLicense();
    if (key) {
      checkLicenseValid(key).then(valid => {
        setIsUnlocked(valid);
        if (!valid) clearLicense();
      });
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setGenerateError("");
    setResult(null);
    setPaywallOpen(false);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ description: description.trim(), context: context.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || `Error ${res.status}. Please try again.`);
      } else {
        setResult(data);
        if (!isUnlocked) setPaywallOpen(true);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setGenerateError("Could not reach the AI service. Check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [description, context, isUnlocked]);

  function handleUnlocked() {
    setIsUnlocked(true);
    setPaywallOpen(false);
  }

  function openPaywall(tab: "pay" | "key") {
    setPaywallTab(tab);
    setPaywallOpen(true);
  }

  function handleLogout() {
    clearLicense();
    setIsUnlocked(false);
  }

  const canGenerate = description.trim().length >= 5 && !isGenerating;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-foreground leading-none">{config.appearance.name}</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Excel Add-in</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUnlocked && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <Unlock className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700">Unlocked</span>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 space-y-5 max-w-full">

          {/* Input section */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Describe What You Want
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canGenerate) handleGenerate(); }}
                placeholder={`e.g. "Sum all values in column A where column B says 'Paid'"\ne.g. "Find the highest sale in the last 30 days"\ne.g. "Count unique names in column C"`}
                data-testid="input-description"
                rows={4}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-muted-foreground/50 leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">Press Ctrl+Enter to generate</p>
            </div>

            {/* Optional context toggle */}
            <button
              onClick={() => setShowContext(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {showContext ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showContext ? "Hide" : "Add"} context (optional)
            </button>

            {showContext && (
              <textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder={`e.g. "Column A has dates, Column B has amounts, Column C has 'Paid' or 'Pending'"`}
                data-testid="input-context"
                rows={2}
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 transition-all resize-none placeholder:text-muted-foreground/50 text-muted-foreground"
              />
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              data-testid="button-generate"
              className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200"
            >
              {isGenerating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Formula…</>
                : <><Sparkles className="w-4 h-4" /> Generate Formula</>}
            </button>
          </div>

          {/* Generate error */}
          {generateError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-700 font-medium">{generateError}</p>
              </div>
              <button onClick={() => setGenerateError("")} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Empty state */}
          {!result && !isGenerating && !generateError && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ready to generate</p>
                <p className="text-xs text-muted-foreground mt-1">Describe your formula above and click Generate</p>
              </div>
              <div className="flex flex-col gap-1.5 text-left w-full max-w-xs">
                {[
                  "Sum values with conditions",
                  "VLOOKUP / XLOOKUP data",
                  "Date calculations",
                  "Count unique values",
                  "Dynamic arrays & FILTER",
                ].map(ex => (
                  <button
                    key={ex}
                    onClick={() => setDescription(`Help me ${ex.toLowerCase()}`)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg px-3 py-1.5 text-left transition-colors border border-transparent hover:border-indigo-100"
                  >
                    → {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isGenerating && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-14 bg-indigo-100 rounded-xl" />
              <div className="h-4 bg-gray-200 rounded w-1/4 mt-4" />
              <div className="h-20 bg-emerald-50 rounded-xl" />
              <div className="h-4 bg-gray-200 rounded w-1/3 mt-4" />
              <div className="h-24 bg-gray-100 rounded-xl" />
            </div>
          )}

          {/* Result */}
          {result && !isGenerating && (
            <div ref={resultRef} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Your Formula</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <FormulaDisplay
                result={result}
                description={description}
                isUnlocked={isUnlocked}
                onRequestUnlock={openPaywall}
              />
            </div>
          )}

          {/* Paywall */}
          {paywallOpen && !isUnlocked && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Unlock Access</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Paywall
                onUnlocked={handleUnlocked}
                initialTab={paywallTab}
              />
              <button
                onClick={() => setPaywallOpen(false)}
                className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
              >
                Hide paywall (formula stays blurred)
              </button>
            </div>
          )}

          {/* Re-open paywall if result exists but locked */}
          {result && !isUnlocked && !paywallOpen && (
            <button
              onClick={() => setPaywallOpen(true)}
              data-testid="button-show-paywall"
              className="w-full flex items-center justify-center gap-2 border-2 border-indigo-200 text-indigo-700 rounded-xl py-3 text-sm font-bold hover:bg-indigo-50 transition-colors"
            >
              <Lock className="w-4 h-4" /> Unlock Formula — 1 USDT
            </button>
          )}

          {/* Unlock confirmation */}
          {isUnlocked && result && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700">Full access unlocked</p>
              </div>
              <button onClick={handleLogout} className="text-[10px] text-muted-foreground hover:text-foreground underline">
                Sign out
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 pt-2 pb-4">
            <a href="/support" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Support</a>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <a href="/eula"    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">EULA</a>
            <span className="text-muted-foreground/30 text-[10px]">·</span>
            <a href="/privacy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
