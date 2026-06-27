const LICENSE_KEY = "aifg_license_key";
const API_BASE    = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${API_BASE}/api/payments${path}`;
}

export function getLicense(): string | null {
  try { return localStorage.getItem(LICENSE_KEY); } catch { return null; }
}

export function setLicense(key: string): void {
  try { localStorage.setItem(LICENSE_KEY, key); } catch {}
}

export function clearLicense(): void {
  try { localStorage.removeItem(LICENSE_KEY); } catch {}
}

export interface PaymentConfig {
  address: string;
  network: string;
  price:   number;
}

export async function fetchPaymentConfig(): Promise<PaymentConfig | null> {
  try {
    const res = await fetch(apiUrl("/config"));
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function verifyPayment(
  txHash: string,
  email?: string,
): Promise<{ success: boolean; licenseKey?: string; error?: string }> {
  try {
    const res = await fetch(apiUrl("/verify"), {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ txHash, ...(email ? { email } : {}) }),
    });
    const data = await res.json();
    if (res.ok && data.licenseKey) {
      return { success: true, licenseKey: data.licenseKey };
    }
    return { success: false, error: data.error || "Verification failed" };
  } catch {
    return { success: false, error: "Network error — check your connection." };
  }
}

export async function checkLicenseValid(licenseKey: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`/check/${encodeURIComponent(licenseKey)}`));
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export async function activateLicenseKey(key: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = key.trim().toUpperCase();
  if (!trimmed) return { success: false, error: "Please enter a license key." };
  const valid = await checkLicenseValid(trimmed);
  if (valid) {
    setLicense(trimmed);
    return { success: true };
  }
  return { success: false, error: "Invalid or expired license key. Check the key and try again." };
}
