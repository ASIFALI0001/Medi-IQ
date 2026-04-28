import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import PatientProfile from "@/lib/models/PatientProfile";
import Case from "@/lib/models/Case";
import { embedText, buildCaseEmbeddingText } from "@/lib/gemini";

// GET — patient polls for their prescription
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const appt = await Appointment.findById(id)
      .select("patientRef doctorRef status prescription prescriptionSentAt aiPrescription")
      .lean();

    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isPatient = appt.patientRef.toString() === user.userId;
    const isDoctor  = appt.doctorRef.toString()  === user.userId;
    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      status:            appt.status,
      prescription:      appt.prescription      ?? null,
      prescriptionSentAt: appt.prescriptionSentAt ?? null,
      aiPrescription:    appt.aiPrescription    ?? null,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — doctor finalizes and sends prescription
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "doctor") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id }   = await params;
    const body     = await req.json();
    const { diagnosis, medicines, advice } = body;

    if (!diagnosis || !Array.isArray(medicines) || medicines.length === 0) {
      return NextResponse.json({ error: "Diagnosis and at least one medicine are required" }, { status: 400 });
    }

    const appt = await Appointment.findById(id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (appt.doctorRef.toString() !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (appt.status !== "post_call") {
      return NextResponse.json({ error: "Call must be ended before sending prescription" }, { status: 400 });
    }

    appt.prescription      = { diagnosis, medicines, advice };
    appt.prescriptionSentAt = new Date();
    appt.status            = "completed";
    await appt.save();

    // Save case to MongoDB with embedding (for future RAG retrieval)
    setImmediate(async () => {
      try {
        const patientProfile = await PatientProfile.findOne({ userRef: appt.patientRef }).lean() as Record<string, unknown> | null;
        if (!patientProfile) return;

        const embText  = buildCaseEmbeddingText(appt, patientProfile);
        const embedding = await embedText(embText);

        const caseDoc = await Case.create({
          appointmentRef:     appt._id,
          patientRef:         appt.patientRef,
          doctorRef:          appt.doctorRef,
          patient: {
            age:                patientProfile.age,
            sex:                patientProfile.gender,
            weight:             patientProfile.weight,
            height:             patientProfile.height,
            bloodGroup:         patientProfile.bloodGroup ?? "",
            knownConditions:    patientProfile.knownConditions ?? [],
            allergies:          patientProfile.allergies       ?? [],
            currentMedications: patientProfile.currentMedications ?? [],
          },
          symptoms:           appt.preConsultation?.symptoms   ?? "",
          duration:           appt.preConsultation?.duration   ?? "",
          severity:           appt.preConsultation?.severity   ?? "",
          additionalNotes:    appt.preConsultation?.additionalNotes ?? "",
          currentMedications: appt.preConsultation?.currentMedications ?? "",
          vitals:             appt.preConsultation?.vitals,
          transcript:         appt.transcript ?? "",
          diagnosis,
          prescription:       medicines,
          advice:             advice ?? "",
          embedding,
        });

        await Appointment.findByIdAndUpdate(id, { caseRef: caseDoc._id });
      } catch (err) {
        console.error("Case embedding error:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
