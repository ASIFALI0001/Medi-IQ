import type { RGBSignals, VitalsDemographics, VitalsResult } from "@/types/vitals";

const API_BASE = process.env.NEXT_PUBLIC_VITALS_API_URL ?? "http://localhost:8000";

export async function predictVitals(
  rgbSignals:   RGBSignals,
  demographics: VitalsDemographics,
  fps:          number,
): Promise<VitalsResult> {
  const res = await fetch(`${API_BASE}/api/v1/vitals/predict-rgb`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ rgb_signals: rgbSignals, fps, demographics }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail)
        detail = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    } catch { /* response wasn't JSON */ }
    throw new Error(detail);
  }

  return (await res.json()) as VitalsResult;
}

export async function checkVitalsHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "ok" && data.models_loaded === true;
  } catch {
    return false;
  }
}
