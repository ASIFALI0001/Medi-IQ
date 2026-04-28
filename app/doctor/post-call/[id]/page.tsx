"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Pill, Loader2, CheckCircle2, RefreshCw, Plus, Trash2, Send } from "lucide-react";
import toast from "react-hot-toast";
import type { AiReport, Prescription, PrescriptionMedicine } from "@/types/consultation";

const BLANK_MED: PrescriptionMedicine = {
  medicine: "", dosage: "", timing: "after food", frequency: "twice daily", duration: "",
};

export default function DoctorPostCallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [aiReport,      setAiReport]      = useState<AiReport | null>(null);
  const [aiPrescription, setAiPx]         = useState<Prescription | null>(null);
  const [aiLoading,     setAiLoading]     = useState(true);
  const [patientName,   setPatientName]   = useState("");
  const [transcript,    setTranscript]    = useState("");
  const [showTranscript, setShowTx]       = useState(false);

  // Editable prescription state
  const [diagnosis,  setDiagnosis]  = useState("");
  const [medicines,  setMedicines]  = useState<PrescriptionMedicine[]>([{ ...BLANK_MED }]);
  const [advice,     setAdvice]     = useState("");
  const [sending,    setSending]    = useState(false);

  // Fetch appointment + poll for aiPrescription
  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then(r => r.json())
      .then(d => {
        const appt = d.appointment;
        if (!appt) return;
        setPatientName(appt.patientName ?? "");
        setTranscript(appt.transcript ?? "");
        if (appt.aiReport)       setAiReport(appt.aiReport);
        if (appt.aiPrescription) applyAiPrescription(appt.aiPrescription);
      });
  }, [id]);

  const applyAiPrescription = useCallback((p: Prescription) => {
    setAiPx(p);
    setDiagnosis(p.diagnosis ?? "");
    setMedicines(p.medicines?.length ? p.medicines : [{ ...BLANK_MED }]);
    setAdvice(p.advice ?? "");
    setAiLoading(false);
  }, []);

  // Poll until aiPrescription is ready (async pipeline)
  useEffect(() => {
    if (!aiLoading) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res  = await fetch(`/api/appointments/${id}/prescription`);
        const data = await res.json();
        if (data.aiPrescription && !cancelled) {
          applyAiPrescription(data.aiPrescription);
        } else if (!cancelled) {
          setTimeout(poll, 3000);
        }
      } catch {
        if (!cancelled) setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [id, aiLoading, applyAiPrescription]);

  const updateMed = (idx: number, field: keyof PrescriptionMedicine, val: string) =>
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  const addMed    = () => setMedicines(prev => [...prev, { ...BLANK_MED }]);
  const removeMed = (idx: number) => setMedicines(prev => prev.filter((_, i) => i !== idx));

  const handleSend = async () => {
    if (!diagnosis.trim()) { toast.error("Please enter a diagnosis"); return; }
    const validMeds = medicines.filter(m => m.medicine.trim());
    if (!validMeds.length) { toast.error("Please add at least one medicine"); return; }

    setSending(true);
    try {
      const res = await fetch(`/api/appointments/${id}/prescription`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ diagnosis, medicines: validMeds, advice }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send"); return; }
      toast.success("Prescription sent to patient!");
      setTimeout(() => router.replace("/doctor/dashboard"), 1500);
    } catch {
      toast.error("Network error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-800">Post-Call Review</h1>
          <p className="text-xs text-slate-500">{patientName} · Write and send prescription</p>
        </div>
        {aiLoading && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            AI analysing...
          </span>
        )}
        {!aiLoading && aiPrescription && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <RefreshCw className="w-3.5 h-3.5" />
            AI suggestion ready
          </span>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* AI Analysis */}
        {aiReport && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-slate-700 text-sm">AI Analysis</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed bg-blue-50 rounded-xl p-3 border border-blue-100">
                {aiReport.summary}
              </p>
              {aiReport.conditions?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Probable Conditions</p>
                  <ul className="space-y-1">
                    {aiReport.conditions.map((c, i) => (
                      <li key={i} className="text-sm text-slate-700 flex gap-2">
                        <span className="text-blue-400 shrink-0">•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transcript toggle */}
        {transcript && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowTx(t => !t)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <span className="font-semibold text-slate-700 text-sm">Call Transcript</span>
              <span className="text-xs text-slate-400">{showTranscript ? "Hide" : "Show"}</span>
            </button>
            {showTranscript && (
              <div className="px-5 pb-5 max-h-60 overflow-y-auto space-y-1 border-t border-slate-50 pt-4">
                {transcript.split("\n").filter(Boolean).map((line, i) => {
                  const isDoc = line.startsWith("Doctor:");
                  return (
                    <p key={i} className="text-xs leading-relaxed">
                      <span className={`font-semibold ${isDoc ? "text-blue-600" : "text-emerald-600"}`}>
                        {isDoc ? "Doctor" : "Patient"}:
                      </span>{" "}
                      <span className="text-slate-600">{line.replace(/^(Doctor|Patient):\s*/, "")}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Prescription Editor */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-slate-700 text-sm">Prescription</h2>
            <span className="text-xs text-slate-400 ml-auto">AI-filled · Edit as needed</span>
          </div>
          <div className="p-5 space-y-5">

            {/* Diagnosis */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Diagnosis *</label>
              <textarea
                rows={2}
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="Primary diagnosis with brief reasoning..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            {/* Medicines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Medicines *</label>
                <button onClick={addMed} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-3">
                {medicines.map((med, i) => (
                  <MedicineRow key={i} med={med} idx={i} onChange={updateMed} onRemove={medicines.length > 1 ? removeMed : undefined} />
                ))}
              </div>
            </div>

            {/* Dos & Don'ts */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                Dos &amp; Don&apos;ts / Advice
              </label>
              <p className="text-xs text-slate-400 mb-2">AI-generated lifestyle advice. Edit to personalise.</p>
              <textarea
                rows={5}
                value={advice}
                onChange={e => setAdvice(e.target.value)}
                placeholder="e.g. Drink plenty of water. Avoid oily food. Rest for 2 days. Do not skip doses..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold rounded-xl py-3.5 transition-all active:scale-95 shadow-sm"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending..." : "Send Prescription to Patient"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicineRow({
  med, idx, onChange, onRemove,
}: {
  med: PrescriptionMedicine;
  idx: number;
  onChange: (idx: number, field: keyof PrescriptionMedicine, val: string) => void;
  onRemove?: (idx: number) => void;
}) {
  const inp = "rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-400 w-full";
  return (
    <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
      <div className="flex items-center gap-2">
        <input
          placeholder="Medicine name *"
          value={med.medicine}
          onChange={e => onChange(idx, "medicine", e.target.value)}
          className={inp + " flex-1 font-medium"}
        />
        {onRemove && (
          <button onClick={() => onRemove(idx)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input placeholder="Dosage (e.g. 500mg)" value={med.dosage} onChange={e => onChange(idx, "dosage", e.target.value)} className={inp} />
        <select value={med.timing} onChange={e => onChange(idx, "timing", e.target.value)} className={inp}>
          <option value="before food">Before food</option>
          <option value="after food">After food</option>
          <option value="with food">With food</option>
          <option value="at bedtime">At bedtime</option>
          <option value="as needed">As needed</option>
        </select>
        <select value={med.frequency} onChange={e => onChange(idx, "frequency", e.target.value)} className={inp}>
          <option value="once daily">Once daily</option>
          <option value="twice daily">Twice daily</option>
          <option value="thrice daily">Thrice daily</option>
          <option value="every 6 hours">Every 6 hours</option>
          <option value="at bedtime">At bedtime</option>
          <option value="as needed">As needed</option>
        </select>
        <input placeholder="Duration (e.g. 5 days)" value={med.duration} onChange={e => onChange(idx, "duration", e.target.value)} className={inp} />
      </div>
    </div>
  );
}
