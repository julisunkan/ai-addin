import { useState, useCallback, useEffect, useRef } from "react";
import {
  Sparkles, Copy, Check, Download, FileText, Lock, Unlock,
  ChevronDown, ChevronUp, Loader2, AlertCircle, X,
  KeyRound, CreditCard, Shield, Zap, TableIcon,
  Clock, Trash2, RotateCcw, Star, Wrench, BookOpen,
  ChevronRight, BarChart2
} from "lucide-react";
import { getLicense, setLicense, clearLicense, checkLicenseValid, fetchPaymentConfig, verifyPayment, activateLicenseKey } from "./lib/payment";
import { exportToTxt, exportToPdf, type FormulaResult } from "./lib/formulaExport";
import { useAppConfig } from "./context/AppConfigContext";
import ToolsTab, { MODELS } from "./components/ToolsTab";
import CategoriesTab from "./components/CategoriesTab";
import VisualizeTab from "./components/VisualizeTab";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = "generate" | "tools" | "categories" | "history" | "visualize";

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

// Returns true only when running inside Excel with the Office.js SDK loaded
declare const Office: { context: unknown } | undefined;
declare const Excel: {
  run: (fn: (ctx: {
    workbook: { getSelectedRange: () => { formulas: string[][]; load: (s: string) => void } };
    sync: () => Promise<void>;
  }) => Promise<void>) => Promise<void>;
} | undefined;

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

// ── Formula History with Favorites ────────────────────────────────────────────

const HISTORY_KEY = "aifg_history";
const HISTORY_MAX = 50;

interface HistoryEntry {
  id: string;
  description: string;
  result: FormulaResult;
  savedAt: number;
  isFavorite?: boolean;
}

function useFormulaHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
  });

  function save(entries: HistoryEntry[]) {
    setHistory(entries);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  }

  function addToHistory(description: string, result: FormulaResult) {
    setHistory(prev => {
      const deduped = prev.filter(e => e.result.formula !== result.formula);
      const next = [
        { id: Date.now().toString(), description, result, savedAt: Date.now(), isFavorite: false },
        ...deduped,
      ].slice(0, HISTORY_MAX);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeFromHistory(id: string) {
    save(history.filter(e => e.id !== id));
  }

  function toggleFavorite(id: string) {
    save(history.map(e => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e));
  }

  function clearHistory() {
    save([]);
  }

  return { history, addToHistory, removeFromHistory, toggleFavorite, clearHistory };
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Paywall Component ─────────────────────────────────────────────────────────

interface PaywallProps {
  onUnlocked: () => void;
  initialTab?: "pay" | "key";
}

function Paywall({ onUnlocked, initialTab = "pay" }: PaywallProps) {
  const [tab, setTab] = useState<"pay" | "key">(initialTab);
  const [payConfig, setPayConfig] = useState<{ address: string; network: string; price: number } | null>(null);
  const [payConfigError, setPayConfigError] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [copied, setCopied] = useState(false);
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
      <div className="bg-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2.5 mb-1">
          <Lock className="w-5 h-5 opacity-90" />
          <h3 className="font-bold text-base">Unlock Your Formula</h3>
        </div>
        <p className="text-xs text-indigo-200">1 USDT / month — unlock all generated formulas & premium tools</p>
      </div>

      <div className="flex border-b border-indigo-100">
        <button
          onClick={() => setTab("pay")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${tab === "pay" ? "text-indigo-700 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CreditCard className="w-4 h-4" /> Pay 1 USDT
        </button>
        <button
          onClick={() => setTab("key")}
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
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Send To This Wallet</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3">
                    <code className="flex-1 text-xs font-mono text-foreground break-all select-all leading-relaxed">{payConfig.address}</code>
                    <button
                      onClick={copyAddress}
                      className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium">⚠ Only send USDT on the {networkLabel} network</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">After Sending, Paste TX Hash</p>
                  <input
                    type="text"
                    value={txHash}
                    onChange={e => { setTxHash(e.target.value); setVerifyError(""); }}
                    placeholder="0x... or transaction ID"
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Your email (optional, for receipt)"
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

// ── Formula Display ───────────────────────────────────────────────────────────

type InsertStatus = "idle" | "inserting" | "success" | "copied" | "error";

interface FormulaDisplayProps {
  result: FormulaResult;
  description: string;
  isUnlocked: boolean;
  onRequestUnlock: (tab: "pay" | "key") => void;
}

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
    setInsertStatus("inserting"); setInsertError("");
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
            <button
              onClick={handleInsert}
              disabled={insertStatus === "inserting"}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${insertBtnClass()}`}
            >
              {insertLabel()}
            </button>
            <button
              onClick={handleCopy}
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
        {insertStatus === "error" && insertError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {insertError}
          </div>
        )}
        {insertStatus === "copied" && !inExcel && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
            <Check className="w-3.5 h-3.5 shrink-0" /> Formula copied to clipboard. Open Excel and paste it into a cell.
          </div>
        )}
        {insertStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-2">
            <Check className="w-3.5 h-3.5 shrink-0" /> Formula inserted into the selected cell!
          </div>
        )}
        <div className={`relative rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3.5 transition-all ${!isUnlocked ? "select-none" : ""}`}>
          <code className={`block font-mono font-bold text-base text-indigo-800 break-all leading-relaxed transition-all ${!isUnlocked ? "blur-[5px]" : ""}`}>
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
          <p className="text-sm text-emerald-900 leading-relaxed">{result.explanation}</p>
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
                  <code className="text-xs font-mono font-bold text-indigo-700 shrink-0 mt-0.5 min-w-[80px]">{item.part}</code>
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
          <p className="text-sm text-amber-900 leading-relaxed">{result.example}</p>
        </div>
      )}

      {/* Tips */}
      {result.tips?.length > 0 && (
        <div className={`space-y-1.5 transition-all ${!isUnlocked ? "blur-[4px] select-none" : ""}`}>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tips</p>
          {result.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* Download */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (!isUnlocked) { onRequestUnlock("pay"); return; } exportToPdf(result, description); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors border ${
            isUnlocked ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300" : "bg-gray-50 text-gray-400 border-gray-200 cursor-pointer"
          }`}
        >
          {!isUnlocked && <Lock className="w-3.5 h-3.5" />}
          <FileText className="w-4 h-4" /> PDF
        </button>
        <button
          onClick={() => { if (!isUnlocked) { onRequestUnlock("pay"); return; } exportToTxt(result, description); }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors border ${
            isUnlocked ? "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300" : "bg-gray-50 text-gray-400 border-gray-200 cursor-pointer"
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

// ── History Tab ───────────────────────────────────────────────────────────────

interface HistoryTabProps {
  history: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onClear: () => void;
  isLicensed: boolean;
}

function HistoryTab({ history, onLoad, onRemove, onToggleFavorite, onClear, isLicensed }: HistoryTabProps) {
  const [filter, setFilter] = useState<"all" | "favorites">("all");

  const displayed = filter === "favorites" ? history.filter(e => e.isFavorite) : history;
  const favCount = history.filter(e => e.isFavorite).length;

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-border flex items-center justify-center">
          <Clock className="w-7 h-7 text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">No history yet</p>
          <p className="text-xs text-muted-foreground mt-1">Generate a formula to see it here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-4">
      {/* Filter + clear */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border overflow-hidden flex-1">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${filter === "all" ? "bg-indigo-600 text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}
          >
            <Clock className="w-3 h-3" /> All ({history.length})
          </button>
          <button
            onClick={() => setFilter("favorites")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold transition-colors ${filter === "favorites" ? "bg-amber-500 text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}
          >
            <Star className="w-3 h-3" /> Favorites ({favCount})
          </button>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors px-2.5 py-2 rounded-xl border border-border bg-white"
        >
          <Trash2 className="w-3 h-3" /> Clear
        </button>
      </div>

      {displayed.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Star className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No favorites yet.</p>
          <p className="text-xs mt-1">Star a formula to save it here.</p>
        </div>
      )}

      <div className="space-y-2">
        {displayed.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 bg-white border border-border rounded-xl px-3.5 py-3 hover:border-indigo-200 transition-colors group"
          >
            {/* Favorite star */}
            <button
              onClick={() => onToggleFavorite(entry.id)}
              className={`shrink-0 mt-0.5 transition-colors ${entry.isFavorite ? "text-amber-400" : "text-gray-200 hover:text-amber-300"}`}
            >
              <Star className={`w-4 h-4 ${entry.isFavorite ? "fill-amber-400" : ""}`} />
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{entry.description}</p>
              <code className="text-[11px] text-indigo-700 font-mono truncate block mt-0.5">{entry.result.formula}</code>
              <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(entry.savedAt)}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onLoad(entry)}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2 py-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Load
              </button>
              <button
                onClick={() => onRemove(entry.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isLicensed && history.length >= 10 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-center">
          <p className="text-xs text-amber-700 font-medium">
            Showing last {HISTORY_MAX} formulas. <span className="font-bold">Get a license</span> for unlimited history.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Model Selector ────────────────────────────────────────────────────────────

function ModelSelector({ model, onChange }: { model: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
      <Zap className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
      <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider shrink-0">AI Model</label>
      <div className="relative flex-1">
        <select
          value={model}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-transparent text-xs font-semibold text-indigo-800 focus:outline-none pr-5 cursor-pointer"
        >
          {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-indigo-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

const QUICK_EXAMPLES = [
  "Sum values with conditions",
  "VLOOKUP / XLOOKUP data",
  "Date calculations",
  "Count unique values",
  "Dynamic arrays & FILTER",
];

export default function App() {
  const config = useAppConfig();
  const { history, addToHistory, removeFromHistory, toggleFavorite, clearHistory } = useFormulaHistory();

  // Main tab
  const [activeTab, setActiveTab] = useState<MainTab>("generate");

  // Generate tab state
  const [description, setDescription] = useState("");
  const [context, setContext]         = useState("");
  const [showContext, setShowContext]  = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult]           = useState<FormulaResult | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [model, setModel]             = useState(MODELS[0].value);

  // License / paywall
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

  const runGenerate = useCallback(async (prompt: string) => {
    setIsGenerating(true);
    setGenerateError("");
    setResult(null);
    setPaywallOpen(false);

    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          description: prompt,
          context: context.trim() || undefined,
          model: isUnlocked ? model : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || `Error ${res.status}. Please try again.`);
      } else {
        setResult(data);
        addToHistory(prompt, data);
        if (!isUnlocked) setPaywallOpen(true);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setGenerateError("Could not reach the AI service. Check your connection and try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [context, isUnlocked, model, addToHistory]);

  const handleGenerate = useCallback(() => {
    if (!description.trim()) return;
    runGenerate(description.trim());
  }, [description, runGenerate]);

  const handleGenerateWithPrompt = useCallback((prompt: string) => {
    setDescription(prompt);
    setActiveTab("generate");
    runGenerate(prompt);
  }, [runGenerate]);

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

  function handleLoadHistory(entry: HistoryEntry) {
    setDescription(entry.description);
    setResult(entry.result);
    setGenerateError("");
    setPaywallOpen(!isUnlocked);
    setActiveTab("generate");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  function handleSelectTemplate(prompt: string) {
    handleGenerateWithPrompt(prompt);
  }

  const canGenerate = description.trim().length >= 5 && !isGenerating;

  // ── Bottom Nav config ─────────────────────────────────────────────────────
  const NAV = [
    { id: "generate"   as MainTab, icon: <Sparkles className="w-5 h-5" />,   label: "Generate" },
    { id: "tools"      as MainTab, icon: <Wrench className="w-5 h-5" />,     label: "Tools" },
    { id: "categories" as MainTab, icon: <BookOpen className="w-5 h-5" />,   label: "Categories" },
    { id: "visualize"  as MainTab, icon: <BarChart2 className="w-5 h-5" />,  label: "Visualize" },
    { id: "history"    as MainTab, icon: <Clock className="w-5 h-5" />,      label: "History" },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Zap className="text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-foreground leading-none">{config.appearance.name}</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">Excel Add-in</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 hover:bg-red-50 hover:border-red-200 group transition-colors"
            >
              <Unlock className="w-3 h-3 text-emerald-600 group-hover:text-red-500 transition-colors" />
              <span className="text-[10px] font-bold text-emerald-700 group-hover:text-red-600 transition-colors">Licensed</span>
            </button>
          ) : (
            <button
              onClick={() => openPaywall("key")}
              className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 hover:bg-indigo-100 transition-colors"
            >
              <KeyRound className="w-3 h-3 text-indigo-600" />
              <span className="text-[10px] font-bold text-indigo-700">Get License</span>
            </button>
          )}
        </div>
      </header>

      {/* Tab label bar */}
      <div className="shrink-0 bg-gray-50 border-b border-border px-4 py-2 flex items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {activeTab === "generate"   && "Generate Formula"}
          {activeTab === "tools"      && "Premium Tools"}
          {activeTab === "categories" && "Formula Categories"}
          {activeTab === "visualize"  && "Workbook Visualizer"}
          {activeTab === "history"    && `History (${history.length})`}
        </span>
        {activeTab === "tools" && !isUnlocked && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <Lock className="w-2.5 h-2.5" /> Results need a license
          </span>
        )}
      </div>

      {/* Main scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 max-w-full">

          {/* ── GENERATE TAB ───────────────────────────────────────── */}
          {activeTab === "generate" && (
            <div className="space-y-5">
              {/* Model selector (licensed users only) */}
              {isUnlocked && (
                <ModelSelector model={model} onChange={setModel} />
              )}

              {/* Input */}
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
                    rows={4}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-muted-foreground/50 leading-relaxed"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">Press Ctrl+Enter to generate</p>
                </div>

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
                    rows={2}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 transition-all resize-none placeholder:text-muted-foreground/50 text-muted-foreground"
                  />
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
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
                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ready to generate</p>
                      <p className="text-xs text-muted-foreground mt-1">Describe your formula above and click Generate</p>
                    </div>
                    <div className="flex flex-col gap-1.5 text-left w-full max-w-xs">
                      {QUICK_EXAMPLES.map(ex => (
                        <button
                          key={ex}
                          onClick={() => handleGenerateWithPrompt(`Help me ${ex.toLowerCase()}`)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg px-3 py-1.5 text-left transition-colors border border-transparent hover:border-indigo-100"
                        >
                          → {ex}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Browse categories CTA */}
                  <button
                    onClick={() => setActiveTab("categories")}
                    className="w-full flex items-center justify-between bg-white border border-border hover:border-indigo-200 rounded-xl px-4 py-3 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      <div className="text-left">
                        <p className="text-xs font-bold text-foreground">Browse 50+ Templates</p>
                        <p className="text-[10px] text-muted-foreground">10 formula categories</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
                  </button>
                </div>
              )}

              {/* Generating animation */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-10 space-y-5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-100 animate-ping opacity-40" />
                    <div className="relative w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-indigo-500 animate-spin" style={{ animationDuration: "2s" }} />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-foreground">Generating Formula…</p>
                    <p className="text-xs text-muted-foreground">Powered by Groq AI</p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <div className="w-full space-y-2.5 pt-2 animate-pulse">
                    <div className="h-3 bg-gray-200 rounded-full w-1/3" />
                    <div className="h-12 bg-indigo-100 rounded-xl" />
                    <div className="h-3 bg-gray-200 rounded-full w-1/4 mt-3" />
                    <div className="h-16 bg-emerald-50 rounded-xl" />
                  </div>
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
                  <Paywall onUnlocked={handleUnlocked} initialTab={paywallTab} />
                  <button
                    onClick={() => setPaywallOpen(false)}
                    className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground py-2 transition-colors"
                  >
                    Hide paywall (formula stays blurred)
                  </button>
                </div>
              )}

              {/* Re-open paywall */}
              {result && !isUnlocked && !paywallOpen && (
                <button
                  onClick={() => setPaywallOpen(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-indigo-200 text-indigo-700 rounded-xl py-3 text-sm font-bold hover:bg-indigo-50 transition-colors"
                >
                  <Lock className="w-4 h-4" /> Unlock Formula — 1 USDT
                </button>
              )}
            </div>
          )}

          {/* ── TOOLS TAB ──────────────────────────────────────────── */}
          {activeTab === "tools" && (
            <ToolsTab
              isLicensed={isUnlocked}
              model={model}
              onUnlock={() => openPaywall("key")}
            />
          )}

          {/* ── CATEGORIES TAB ─────────────────────────────────────── */}
          {activeTab === "categories" && (
            <CategoriesTab
              onSelectTemplate={handleSelectTemplate}
              isLicensed={isUnlocked}
            />
          )}

          {/* ── VISUALIZE TAB ──────────────────────────────────────── */}
          {activeTab === "visualize" && (
            <VisualizeTab />
          )}

          {/* ── HISTORY TAB ────────────────────────────────────────── */}
          {activeTab === "history" && (
            <HistoryTab
              history={history}
              onLoad={handleLoadHistory}
              onRemove={removeFromHistory}
              onToggleFavorite={toggleFavorite}
              onClear={clearHistory}
              isLicensed={isUnlocked}
            />
          )}

        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="shrink-0 border-t border-border bg-white">
        <div className="flex">
          {NAV.map(item => {
            const isActive = activeTab === item.id;
            const historyBadge = item.id === "history" && history.length > 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors relative ${
                  isActive
                    ? "text-indigo-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
                <div className="relative">
                  {item.icon}
                  {historyBadge && !isActive && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] font-bold leading-none ${isActive ? "text-indigo-600" : ""}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
