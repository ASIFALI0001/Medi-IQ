import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import PatientProfile from "@/lib/models/PatientProfile";
import Case from "@/lib/models/Case";
import { generatePostCallPrescription, embedText, buildCaseEmbeddingText } from "@/lib/gemini";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || !["doctor", "patient"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id }       = await params;
    const { transcript } = await req.json().catch(() => ({ transcript: "" }));

    const appt = await Appointment.findById(id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Both doctor and patient can trigger end-call
    const isDoctor  = appt.doctorRef.toString()  === user.userId;
    const isPatient = appt.patientRef.toString() === user.userId;
    if (!isDoctor && !isPatient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["in_call", "active"].includes(appt.status)) {
      return NextResponse.json({ ok: true }); // idempotent
    }

    appt.status      = "post_call";
    appt.callEndedAt = new Date();
    if (transcript) appt.transcript = transcript;
    await appt.save();

    // Kick off async post-call pipeline (fire-and-forget — doctor polls for aiPrescription)
    setImmediate(async () => {
      try {
        const patientProfile = await PatientProfile.findOne({ userRef: appt.patientRef }).lean();
        if (!patientProfile) return;

        // RAG: find top-5 similar cases (safe to fail if no cases yet)
        let similarCases: Array<Record<string, unknown>> = [];
        try {
          const embText  = buildCaseEmbeddingText(appt, patientProfile as unknown as Record<string, unknown>);
          const embedding = await embedText(embText);
          similarCases = await Case.aggregate([
            {
              $vectorSearch: {
                index:        "case_vector_index",
                path:         "embedding",
                queryVector:  embedding,
                numCandidates: 50,
                limit:         5,
              },
            },
            { $project: { embedding: 0, _id: 0 } },
          ]);
        } catch {
          // No index or no cases yet — proceed without RAG context
        }

        const suggestion = await generatePostCallPrescription(
          appt,
          patientProfile as unknown as Record<string, unknown>,
          similarCases,
        );

        await Appointment.findByIdAndUpdate(id, { aiPrescription: suggestion });
      } catch (err) {
        console.error("Post-call pipeline error:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
