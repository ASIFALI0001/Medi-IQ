"use client";

import { useEffect, useState } from "react";
import { Brain, Loader2, ChevronDown, ChevronUp, HeartPulse, User } from "lucide-react";
import type { CallAppointment, AiReport } from "@/types/consultation";

interface Props {
  appointmentId: string;
  appt:          CallAppointment;
}

export function PatientReportPanel({ appointmentId, appt }: Props) {
  const [report, setReport]     = useState<AiReport | null>(appt.aiReport ?? null);
  const [loading, setLoading]   = useState(!appt.aiReport);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (report) return;
    // Generate (or fetch cached) AI report
    setLoading(true);
    fetch(`/api/appointments/${appointmentId}/ai-report`, { method: "POST" })
      .then(r => r.json())
      .then(d => { if (d.aiReport) setReport(d.aiReport); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [appointmentId, report]);

  const pc = appt.preConsultation;
  const pp = appt.patientProfile;
  const v  = pc?.vitals;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white border-l border-slate-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-slate-800 text-sm">{appt.patientName}</h2>
          <p className="text-xs text-slate-500">
            {pp ? `${pp.age}yo · ${pp.gender} · ${pp.bloodGroup}` : "Loading profile..."}
          </p>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-slate-100">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Patient Stats */}
        {pp && (
          <Section title="Patient Info" icon={<User className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Age", `${pp.age} yrs`],
                ["Gender", pp.gender],
                ["Weight", `${pp.weight} kg`],
                ["Height", `${pp.height} cm`],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-lg p-2">
                  <p className="text-slate-400 font-medium">{k}</p>
                  <p className="text-slate-800 font-semibold capitalize">{v}</p>
                </div>
              ))}
            </div>
            {pp.knownConditions?.length > 0 && (
              <TagList label="Known Conditions" items={pp.knownConditions} color="amber" />
            )}
            {pp.allergies?.length > 0 && (
              <TagList label="Allergies" items={pp.allergies} color="red" />
            )}
            {pp.currentMedications?.length > 0 && (
              <TagList label="Medications (history)" items={pp.currentMedications} color="blue" />
            )}
          </Section>
        )}

        {/* Pre-Consultation */}
        {pc && (
          <Section title="Pre-Consultation" icon={<HeartPulse className="w-3.5 h-3.5" />}>
            <Row label="Chief Complaint">{pc.symptoms}</Row>
            <Row label="Duration">{pc.duration}</Row>
            <Row label="Severity">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                pc.severity === "severe" ? "bg-red-100 text-red-700" :
                pc.severity === "moderate" ? "bg-amber-100 text-amber-700" :
                "bg-emerald-100 text-emerald-700"}`}>
                {pc.severity}
              </span>
            </Row>
            {pc.currentMedications && (
              <Row label="Current Meds">{pc.currentMedications}</Row>
            )}
            {pc.additionalNotes && (
              <Row label="Notes">{pc.additionalNotes}</Row>
            )}

            {/* Vitals */}
            {v && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <VitalBox label="Blood Pressure" value={`${v.sbp}/${v.dbp}`} unit="mmHg" tag={v.bp_classification} />
                <VitalBox label="Heart Rate" value={String(v.hr)} unit="bpm"  tag={v.hr_classification} />
              </div>
            )}
          </Section>
        )}

        {/* AI Report */}
        <Section title="AI Analysis" icon={<Brain className="w-3.5 h-3.5" />} accent>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-blue-600 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating AI report...
            </div>
          ) : report ? (
            <div className="space-y-3">
              <div className="text-xs text-slate-700 leading-relaxed bg-blue-50 rounded-xl p-3 border border-blue-100">
                {report.summary}
              </div>

              {report.conditions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Probable Conditions</p>
                  <ul className="space-y-1.5">
                    {report.conditions.map((c, i) => (
                      <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                        <span className="text-blue-500 shrink-0">•</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.questions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Suggested Questions</p>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    {report.questions.map((q, i) => (
                      <li key={i} className="text-xs text-slate-700">{q}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">AI report unavailable. Ensure pre-consultation form is filled.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title, icon, accent = false, children,
}: { title: string; icon: React.ReactNode; accent?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 mb-2 ${accent ? "text-blue-600" : "text-slate-500"}`}>
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-xs">
      <span className="text-slate-400 font-medium">{label}: </span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}

function VitalBox({ label, value, unit, tag }: { label: string; value: string; unit: string; tag: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 text-center">
      <p className="text-slate-400 text-xs mb-0.5">{label}</p>
      <p className="font-bold text-slate-800 text-sm">{value} <span className="text-xs font-normal text-slate-500">{unit}</span></p>
      <p className="text-xs text-slate-500 capitalize mt-0.5">{tag}</p>
    </div>
  );
}

function TagList({ label, items, color }: { label: string; items: string[]; color: string }) {
  const cls: Record<string, string> = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red:   "bg-red-50 text-red-700 border-red-100",
    blue:  "bg-blue-50 text-blue-700 border-blue-100",
  };
  return (
    <div className="mt-2">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span key={i} className={`px-2 py-0.5 rounded-full text-xs border ${cls[color]}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}
