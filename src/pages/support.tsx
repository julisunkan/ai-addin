import { useState } from "react";
import { ArrowLeft, MessageSquare, HelpCircle, Send, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const FAQS = [
  {
    q: "How do I get a formula?",
    a: "Type a plain English description of what you want the formula to do in the main text box, then click 'Generate Formula'. For example: \"Sum all values in column A where column B says Paid\".",
  },
  {
    q: "Why is my formula result blurred?",
    a: "Formula results are locked until you unlock access by paying 1 USDT or entering a valid license key. Click the 'Unlock Formula' button to proceed.",
  },
  {
    q: "How do I pay and unlock?",
    a: "Send exactly 1 USDT to the wallet address shown in the paywall. Supported networks: Tron (TRC-20), BNB Smart Chain (BEP-20), or Ethereum (ERC-20). After sending, paste your transaction hash and click 'Verify & Unlock'.",
  },
  {
    q: "My transaction was verified but I didn't get a key. What do I do?",
    a: "Make sure you submitted the correct transaction hash in the paywall. If you closed the app before saving your key, contact support with your transaction hash and we'll look it up.",
  },
  {
    q: "Is my license key tied to one device?",
    a: "No. Your license key (prefixed with AIFG-) can be used on any device. Simply enter it in the 'License Key' tab of the paywall.",
  },
  {
    q: "The AI gave me an incorrect formula. What should I do?",
    a: "AI-generated formulas are a starting point. Always test them in a safe environment before relying on them. If you get consistently wrong results, try adding more context in the 'Add context' field to describe your spreadsheet layout.",
  },
  {
    q: "Can I regenerate a formula?",
    a: "Yes! Just click 'Generate Formula' again. Each generation may produce a slightly different formula — try rephrasing your description for better results.",
  },
  {
    q: "Does the add-in read my spreadsheet data?",
    a: "No. The add-in only reads what you type into the description box. It does not access, read, or upload any data from your Excel workbook.",
  },
];

export default function SupportPage() {
  const [, setLocation] = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState({ email: "", subject: "", message: "", licenseKey: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.message) { setError("Email and message are required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSubmitted(true);
        setForm({ email: "", subject: "", message: "", licenseKey: "" });
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-sm font-bold">Support</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* FAQ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-left hover:bg-gray-50 transition-colors"
                  data-testid={`faq-toggle-${i}`}
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />}
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3" data-testid={`faq-answer-${i}`}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold">Contact Support</h2>
          </div>

          {submitted ? (
            <div className="bg-white border border-emerald-200 rounded-xl p-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-semibold">Message sent!</p>
              <p className="text-sm text-muted-foreground">We'll get back to you as soon as possible.</p>
              <button onClick={() => setSubmitted(false)} className="text-sm text-indigo-600 underline hover:no-underline mt-2">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                    data-testid="input-support-email"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    License Key (optional)
                  </label>
                  <input
                    type="text"
                    value={form.licenseKey}
                    onChange={e => setForm(f => ({ ...f, licenseKey: e.target.value }))}
                    placeholder="AIFG-…"
                    data-testid="input-support-license"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. My license key is not working"
                  data-testid="input-support-subject"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue in detail…"
                  required
                  rows={5}
                  data-testid="input-support-message"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                data-testid="button-support-submit"
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full sm:w-auto"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send Message</>}
              </button>
            </form>
          )}
        </section>

        {/* Legal links */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <button onClick={() => setLocation("/eula")} className="hover:text-foreground transition-colors underline">EULA</button>
          <button onClick={() => setLocation("/privacy")} className="hover:text-foreground transition-colors underline">Privacy Policy</button>
          <span>AI Formula Generator · Excel Add-in</span>
        </div>
      </main>
    </div>
  );
}
