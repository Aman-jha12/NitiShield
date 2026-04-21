const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type AnalyzeResult = {
  probability: number;
  risk_level: string;
  reasons: string[];
  suggestions: string[];
  cross_reference: {
    risk_factors: string[];
    matched_clauses: string[];
    violations: Array<{ type: string; severity: string; detail: string }>;
  };
  structured: Record<string, unknown>;
  model_features?: Record<string, number>;
  analysisId?: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("claimshield_token");
}

export function setSession(token: string, user: { email: string; name?: string | null }) {
  localStorage.setItem("claimshield_token", token);
  localStorage.setItem("claimshield_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("claimshield_token");
  localStorage.removeItem("claimshield_user");
}

export function getUser(): { email: string; name?: string | null } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("claimshield_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { email: string; name?: string | null };
  } catch {
    return null;
  }
}

export async function registerRequest(email: string, password: string, name?: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(typeof err.error === "string" ? err.error : "Registration failed");
  }
  return data as { token: string; user: { id: string; email: string; name?: string | null } };
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(typeof err.error === "string" ? err.error : "Login failed");
  }
  return data as { token: string; user: { id: string; email: string; name?: string | null } };
}

export async function analyzeFiles(policy: File | null, hospital: File[]) {
  const fd = new FormData();
  if (policy) fd.append("policy", policy);
  for (const f of hospital) fd.append("hospital", f);
  const token = getToken();
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(typeof err.error === "string" ? err.error : "Analysis failed");
  }
  return data as AnalyzeResult;
}

export async function fetchAnalysisById(id: string) {
  const token = getToken();
  if (!token) throw new Error("Log in to load saved analyses");
  const res = await fetch(`${API_BASE}/analyses/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(typeof err.error === "string" ? err.error : "Not found");
  }
  const analysis = (data as { analysis: { id: string; result: unknown; appealLetter?: string | null } }).analysis;
  const base = analysis.result as AnalyzeResult;
  return {
    ...base,
    analysisId: analysis.id,
    savedAppealLetter: analysis.appealLetter ?? undefined,
  } as AnalyzeResult & { savedAppealLetter?: string };
}

export async function generateAppealPayload(body: {
  structured: Record<string, unknown>;
  cross_reference: AnalyzeResult["cross_reference"];
  probability: number;
  analysisId?: string;
}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/appeal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Appeal generation failed");
  return data as { appeal_letter: string };
}

export async function fetchAnalytics() {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/analytics/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    totalRuns: number;
    averageProbability: number;
    highRiskCount: number;
  }>;
}

export async function fetchAnalyses() {
  const token = getToken();
  if (!token) return [];
  const res = await fetch(`${API_BASE}/analyses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { analyses: unknown[] }).analyses || [];
}
