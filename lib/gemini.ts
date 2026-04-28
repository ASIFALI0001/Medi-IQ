import { GoogleGenerativeAI } from "@google/generative-ai";
import type { IAppointment, IPrescription } from "./models/Appointment";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPatientContext(appt: IAppointment, patientProfile: Record<string, unknown>): string {
  const p  = patientProfile;
  const pc = appt.preConsultation;
  const v  = pc?.vitals;

  return [
    `Patient: ${p.age}yo ${p.gender}, ${p.weight}kg, ${p.height}cm, Blood Group: ${p.bloodGroup ?? "unknown"}`,
    `Known Conditions: ${(p.knownConditions as string[])?.join(", ") || "none"}`,
    `Allergies: ${(p.allergies as string[])?.join(", ") || "none"}`,
    `Current Medications (profile): ${(p.currentMedications as string[])?.join(", ") || "none"}`,
    `Chief Complaint: ${pc?.symptoms ?? "not provided"}`,
    `Duration: ${pc?.duration ?? "not provided"}`,
    `Severity: ${pc?.severity ?? "not provided"}`,
    `Medications mentioned in form: ${pc?.currentMedications || "none"}`,
    `Additional Notes: ${pc?.additionalNotes || "none"}`,
    v
      ? `Vitals: BP ${v.sbp}/${v.dbp} mmHg (${v.bp_classification}), HR ${v.hr} bpm (${v.hr_classification})`
      : "Vitals: not measured",
  ].join("\n");
}

function parseJsonBlock(text: string): unknown {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/\{[\s\S]*\}/);
  const raw   = match ? (match[1] ?? match[0]) : text;
  return JSON.parse(raw.trim());
}

// ── Pre-call AI Report ────────────────────────────────────────────────────────

export async function generateAiReport(
  appt: IAppointment,
  patientProfile: Record<string, unknown>,
) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a clinical support assistant helping a doctor prepare for a consultation.
Based on the patient data below, provide:
1. A concise summary (2–3 sentences) of the patient's likely condition.
2. A list of probable diseases/conditions with one-line reasoning each.
3. 3–5 specific diagnostic questions the doctor should ask to confirm or rule out conditions.

Patient Data:
${buildPatientContext(appt, patientProfile)}

Respond ONLY with valid JSON (no markdown prose outside the code block):
\`\`\`json
{
  "summary": "...",
  "conditions": ["Condition — reasoning", "..."],
  "questions": ["Question 1?", "..."]
}
\`\`\``;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  const parsed = parseJsonBlock(text) as { summary: string; conditions: string[]; questions: string[] };

  return {
    summary:    parsed.summary    ?? "",
    conditions: parsed.conditions ?? [],
    questions:  parsed.questions  ?? [],
    generatedAt: new Date(),
  };
}

// ── Post-call Prescription Pipeline ──────────────────────────────────────────

export async function generatePostCallPrescription(
  appt: IAppointment,
  patientProfile: Record<string, unknown>,
  similarCases: Array<Record<string, unknown>>,
): Promise<IPrescription> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const pastCasesText = similarCases.length
    ? similarCases.map((c, i) => `
Case ${i + 1}:
  Patient: ${(c.patient as Record<string,unknown>)?.age}yo ${(c.patient as Record<string,unknown>)?.sex}
  Symptoms: ${c.symptoms}
  Diagnosis: ${c.diagnosis}
  Prescription: ${JSON.stringify(c.prescription)}
  Advice: ${c.advice}`).join("\n")
    : "No similar historical cases available.";

  const prompt = `You are a clinical decision support assistant. A doctor has just finished a consultation.
Provide a diagnosis and prescription based on the patient data, call transcript, and similar past cases below.

## Patient Data
${buildPatientContext(appt, patientProfile)}

## Call Transcript
${appt.transcript || "No transcript available."}

## Similar Past Cases (for reference only — do not copy blindly)
${pastCasesText}

Instructions:
- Provide a clear diagnosis with reasoning.
- Prescribe safe, standard medications appropriate for the diagnosis.
- Include dosage, timing (before/after food), frequency, and duration.
- Advice should be practical lifestyle / do's and don'ts.

Respond ONLY with valid JSON:
\`\`\`json
{
  "diagnosis": "...",
  "medicines": [
    {
      "medicine": "...",
      "dosage": "...",
      "timing": "before food | after food | with food",
      "frequency": "once daily | twice daily | thrice daily | as needed",
      "duration": "..."
    }
  ],
  "advice": "..."
}
\`\`\``;

  const result = await model.generateContent(prompt);
  const text   = result.response.text();
  const parsed = parseJsonBlock(text) as IPrescription;

  return {
    diagnosis: parsed.diagnosis ?? "Awaiting doctor review",
    medicines: parsed.medicines ?? [],
    advice:    parsed.advice    ?? "",
  };
}

// ── Text Embedding (3072-dim, for Atlas Vector Search) ────────────────────────
// Model: gemini-embedding-001 — confirmed working, 3072 dimensions
// Atlas index must use numDimensions: 3072

export async function embedText(text: string): Promise<number[]> {
  const model  = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

export function buildCaseEmbeddingText(
  appt: IAppointment,
  patientProfile: Record<string, unknown>,
): string {
  return [
    buildPatientContext(appt, patientProfile),
    `Transcript excerpt: ${(appt.transcript ?? "").slice(0, 2000)}`,
    `Diagnosis: ${appt.prescription?.diagnosis ?? ""}`,
  ].join("\n");
}
