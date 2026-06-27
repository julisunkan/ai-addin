import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-sm font-bold">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-sm text-foreground leading-relaxed">
        <div>
          <h2 className="text-lg font-bold mb-1">Privacy Policy</h2>
          <p className="text-muted-foreground text-xs">Last updated: June 27, 2026</p>
        </div>

        <p>AI Formula Generator ("we", "us", or "our") operates as a Microsoft Excel Add-in. This policy explains what data we collect, how we use it, and your rights.</p>

        <section className="space-y-2">
          <h3 className="font-bold text-base">1. Data We Collect</h3>
          <div className="space-y-2">
            <p><strong>Formula requests:</strong> When you generate a formula, the text description you provide is sent to the Groq AI API to produce a result. This text is processed by Groq in accordance with their privacy policy. We do not permanently store your formula descriptions on our servers.</p>
            <p><strong>License information:</strong> When you purchase a license, your transaction hash and optional email address are stored securely to verify your payment and issue a license key.</p>
            <p><strong>License key:</strong> Your license key is stored locally in your browser's localStorage. It is sent to our server only to verify its validity.</p>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">2. Data We Do NOT Collect</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>We do not collect your name, address, or credit card information</li>
            <li>We do not read or access your Excel spreadsheet data</li>
            <li>We do not use tracking cookies or analytics scripts</li>
            <li>We do not sell or share your personal data with third parties for marketing</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">3. Third-Party Services</h3>
          <p><strong>Groq API:</strong> Your formula description is sent to Groq's servers for AI processing. Please review <a href="https://groq.com/privacy-policy/" target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:no-underline">Groq's Privacy Policy</a> for details on how they handle data.</p>
          <p><strong>Blockchain networks:</strong> Payment verification is conducted on-chain (Tron, BSC, or Ethereum). Transaction data is publicly visible on the respective blockchain.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">4. Data Storage & Security</h3>
          <p>License data (transaction hash, email, license key) is stored on our server. We take reasonable technical measures to protect this data from unauthorized access. Your license key is stored in your browser's localStorage and is not shared with anyone.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">5. Data Retention</h3>
          <p>License records are retained for as long as needed to provide support and verify license validity. If you request deletion of your data, contact us via the <button onClick={() => setLocation("/support")} className="text-indigo-600 underline hover:no-underline">Support page</button> and we will remove your email address from our records.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">6. Children's Privacy</h3>
          <p>The Software is not directed to children under 13. We do not knowingly collect personal information from children.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">7. Changes to This Policy</h3>
          <p>We may update this Privacy Policy from time to time. The "Last updated" date at the top reflects the most recent revision. Continued use after changes are posted constitutes your acceptance.</p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-base">8. Contact</h3>
          <p>For privacy-related questions or data deletion requests, visit our <button onClick={() => setLocation("/support")} className="text-indigo-600 underline hover:no-underline">Support page</button>.</p>
        </section>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          AI Formula Generator · Excel Add-in
        </div>
      </main>
    </div>
  );
}
