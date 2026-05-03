"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2, ChevronRight } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

const SEVERITIES = ["mild", "moderate", "severe"];

export default function NewAiConsultationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    symptoms: "", duration: "", severity: "moderate",
    currentMedications: "", additionalNotes: "",
  });

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.symptoms.trim() || !form.duration.trim()) {
      toast.error("Symptoms and duration are required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      toast.success("Ready! Starting your AI consultation…");
      router.push(`/patient/ai-consultation/${data.consultation._id}`);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center p-6 pt-12">
      <div className="w-full max-w-xl space-y-6">

        {/* Header card */}
        <div className="bg-linear-to-br from-blue-600 to-violet-600 rounded-3xl p-6 text-white flex items-center gap-5 shadow-xl shadow-blue-200">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/30 shrink-0">
            <Image src="/doctor.jpg" alt="AI Doctor" width={64} height={64} className="object-cover w-full h-full" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">AI Doctor</span>
            </div>
            <h1 className="text-xl font-bold">Dr. MediQ AI</h1>
            <p className="text-sm opacity-80 mt-0.5">
              Powered by Gemini · Available 24/7 · Voice consultation
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> This is an AI-assisted consultation. The report is generated automatically and
          is not a substitute for a licensed doctor for serious or emergency conditions.
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-slate-800">Pre-Consultation Details</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Symptoms <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.symptoms}
              onChange={e => set("symptoms", e.target.value)}
              placeholder="Describe what you're experiencing (e.g. fever, headache, body ache)"
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Duration <span className="text-red-500">*</span>
              </label>
              <input
                value={form.duration}
                onChange={e => set("duration", e.target.value)}
                placeholder="e.g. 2 days, 1 week"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Severity</label>
              <div className="flex gap-2">
                {SEVERITIES.map(s => (
                  <button
                    key={s} type="button"
                    onClick={() => set("severity", s)}
                    className={`flex-1 py-3 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      form.severity === s
                        ? s === "mild" ? "bg-emerald-500 text-white"
                          : s === "moderate" ? "bg-amber-500 text-white"
                          : "bg-red-500 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Current Medications (if any)
            </label>
            <input
              value={form.currentMedications}
              onChange={e => set("currentMedications", e.target.value)}
              placeholder="e.g. Metformin 500mg, None"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Additional Notes
            </label>
            <textarea
              value={form.additionalNotes}
              onChange={e => set("additionalNotes", e.target.value)}
              placeholder="Anything else the doctor should know…"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Preparing your consultation…</>
            ) : (
              <>Start AI Consultation <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
