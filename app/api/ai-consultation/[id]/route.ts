import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import AiConsultation from "@/lib/models/AiConsultation";
import PatientProfile from "@/lib/models/PatientProfile";
import User from "@/lib/models/User";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedText } from "@/lib/gemini";
import Case from "@/lib/models/Case";
import mongoose from "mongoose";

type Params = { params: Promise<{ id: string }> };

// GET — fetch single consultation (+ patient profile for VAPI variables)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;

    const consultation = await AiConsultation.findById(id).lean() as Record<string, unknown> | null;
    if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPatient = consultation.patientRef?.toString() === user.userId;
    if (!isPatient && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Also return patient profile so the consultation room can build VAPI variables
    const patientId  = String(consultation.patientRef);
    const patientOid = new mongoose.Types.ObjectId(patientId);
    const profile = await PatientProfile.findOne({ userRef: patientOid }).lean();
    const dbUser  = await User.findById(patientOid).select("name").lean() as { name: string } | null;

    return NextResponse.json({ consultation, profile, patientName: dbUser?.name });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH — update status (start call, end call)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "patient") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { status, transcript } = await req.json();

    const consultation = await AiConsultation.findOne({ _id: id, patientRef: user.userId });
    if (!consultation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status === "in_consultation") {
      consultation.status = "in_consultation";
      consultation.consultationStartedAt = new Date();
    }

    if (status === "generating_report" && transcript) {
      consultation.status      = "generating_report";
      consultation.transcript  = transcript;
      consultation.consultationEndedAt = new Date();
    }

    await consultation.save();

    // If call ended, trigger async report generation
    if (status === "generating_report") {
      generateReport(id, user.userId).catch(console.error);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function generateReport(consultationId: string, patientUserId: string) {
  await connectDB();
  const consultation = await AiConsultation.findById(consultationId);
  if (!consultation) return;

  const patientOid = new mongoose.Types.ObjectId(patientUserId);
  const profile = await PatientProfile.findOne({ userRef: patientOid }).lean() as {
    age?: number; gender?: string; weight?: number; height?: number; bloodGroup?: string;
    knownConditions?: string[]; allergies?: string[]; currentMedications?: string[];
  } | null;

  // RAG: find 5 similar past cases
  let similarCases: unknown[] = [];
  try {
    const pc = consultation.preConsultation;
    const embeddingText = [
      pc?.symptoms, pc?.duration, pc?.severity, consultation.transcript,
    ].filter(Boolean).join(" ");
    const embedding = await embedText(embeddingText);
    similarCases = await Case.aggregate([
      { $vectorSearch: {
          index: "case_embedding_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 50,
          limit: 5,
      }},
      { $project: { embedding: 0 } },
    ]);
  } catch { /* RAG optional */ }

  const patientContext = [
    `Patient: ${consultation.patientName}`,
    `Age: ${profile?.age ?? "unknown"}, Gender: ${profile?.gender ?? "unknown"}`,
    `Weight: ${profile?.weight ?? "?"}kg, Height: ${profile?.height ?? "?"}cm, Blood Group: ${profile?.bloodGroup ?? "unknown"}`,
    `Known Conditions: ${profile?.knownConditions?.join(", ") || "none"}`,
    `Allergies: ${profile?.allergies?.join(", ") || "none"}`,
    `Ongoing Medications: ${profile?.currentMedications?.join(", ") || "none"}`,
  ].join("\n");

  const pc = consultation.preConsultation;
  const preConsContext = [
    `Chief Complaint: ${pc?.symptoms}`,
    `Duration: ${pc?.duration}, Severity: ${pc?.severity}`,
    pc?.currentMedications ? `Medications mentioned: ${pc.currentMedications}` : "",
    pc?.additionalNotes ? `Notes: ${pc.additionalNotes}` : "",
  ].filter(Boolean).join("\n");

  const similarText = similarCases.length
    ? (similarCases as Array<Record<string, unknown>>).map((c, i) =>
        `Case ${i+1}: Symptoms: ${c.symptoms}, Diagnosis: ${c.diagnosis}, Rx: ${JSON.stringify(c.prescription)}`
      ).join("\n")
    : "No similar cases found.";

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent(`You are an AI clinical decision system generating a complete medical report for a telemedicine consultation. There is NO supervising doctor — your report goes directly to the patient, so be clear, accurate, and safe.

## Patient Profile
${patientContext}

## Pre-Consultation Form
${preConsContext}

## AI Consultation Transcript
${consultation.transcript || "No transcript available."}

## Similar Historical Cases (reference only)
${similarText}

Generate a complete medical report. Be specific about medicines — include correct dosage, standard frequency, timing relative to food, and appropriate duration.

Respond ONLY with valid JSON (no markdown):
{
  "summary": "2-3 sentence clinical summary of what the patient likely has",
  "diagnosis": "Primary diagnosis with brief reasoning",
  "medicines": [
    {
      "medicine": "Drug name (generic)",
      "dosage": "e.g. 500mg",
      "timing": "before food | after food | with food",
      "frequency": "once daily | twice daily | thrice daily | as needed",
      "duration": "e.g. 5 days"
    }
  ],
  "advice": "General lifestyle and recovery advice",
  "dosAndDonts": [
    "Do: rest adequately",
    "Don't: skip meals",
    "Do: ...",
    "Don't: ...",
    "Seek emergency care if: ..."
  ]
}`);

  try {
    const text  = result.response.text().trim();
    const match = text.match(/\{[\s\S]*\}/);
    const data  = JSON.parse(match ? match[0] : text) as {
      summary: string; diagnosis: string;
      medicines: Array<{ medicine: string; dosage: string; timing: string; frequency: string; duration: string }>;
      advice: string; dosAndDonts: string[];
    };

    consultation.report = {
      summary:    data.summary    ?? "",
      diagnosis:  data.diagnosis  ?? "",
      medicines:  data.medicines  ?? [],
      advice:     data.advice     ?? "",
      dosAndDonts: data.dosAndDonts ?? [],
    };
    consultation.status             = "report_ready";
    consultation.reportGeneratedAt  = new Date();
    await consultation.save();
  } catch (e) {
    console.error("[AI Consultation] Report parse failed:", e);
    consultation.status = "report_ready"; // still mark ready so patient isn't stuck
    await consultation.save();
  }
}
