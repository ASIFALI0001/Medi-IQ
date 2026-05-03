"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2, Sparkles } from "lucide-react";

export default function AiWaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res  = await fetch(`/api/ai-consultation/${id}`);
        const data = await res.json();
        if (data.consultation?.status === "report_ready") {
          clearInterval(poll);
          router.replace(`/patient/ai-consultation/${id}/report`);
        }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(poll);
  }, [id, router]);

  const steps = [
    "Analysing your consultation transcript…",
    "Reviewing your health profile and history…",
    "Matching similar medical cases…",
    "Generating personalised diagnosis…",
    "Preparing your treatment plan…",
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 gap-8">
      {/* Animated icon */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full bg-blue-600/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-blue-600/30 animate-pulse" />
        <div className="relative w-full h-full rounded-full bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/40">
          <Brain className="w-10 h-10 text-white" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Generating Your Report</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Dr. MediQ AI is reviewing your consultation and preparing a personalised medical report.
          This usually takes under a minute.
        </p>
      </div>

      {/* Animated steps */}
      <div className="bg-slate-900 rounded-2xl p-5 w-full max-w-sm space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3"
            style={{ animation: `fadeIn 0.5s ease ${i * 0.4}s both` }}>
            <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-blue-400" />
            </div>
            <p className="text-sm text-slate-400">{step}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Please wait…
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
}
