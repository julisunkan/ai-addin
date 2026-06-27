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

export interface LicenseStatus {
  valid: boolean;
  expired: boolean;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

export async function checkLicenseValid(licenseKey: string): Promise<LicenseStatus> {
  try {
    const res = await fetch(apiUrl(`/check/${encodeURIComponent(licenseKey)}`));
    if (!res.ok) return { valid: false, expired: false };
    const data = await res.json();
    if (data.valid) return { valid: true, expired: false, issuedAt: data.issuedAt ?? null, expiresAt: data.expiresAt ?? null };
    if (data.reason === "expired") return { valid: false, expired: true };
    return { valid: false, expired: false };
  } catch {
    return { valid: false, expired: false };
  }
}

export async function activateLicenseKey(key: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = key.trim().toUpperCase();
  if (!trimmed) return { success: false, error: "Please enter a license key." };
  const status = await checkLicenseValid(trimmed);
  if (status.valid) {
    setLicense(trimmed);
    return { success: true };
  }
  if (status.expired) return { success: false, error: "This license key has expired. Please renew your subscription." };
  return { success: false, error: "Invalid license key. Check the key and try again." };
}
