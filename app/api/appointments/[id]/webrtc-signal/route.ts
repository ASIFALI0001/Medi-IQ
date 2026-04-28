import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";

// GET — poll for the current signaling state
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
      .select("patientRef doctorRef callSignaling")
      .lean();

    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPatient = appt.patientRef.toString() === user.userId;
    const isDoctor  = appt.doctorRef.toString()  === user.userId;
    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ signaling: appt.callSignaling ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — store a signal (offer / answer / ICE candidate)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const { type, payload } = await req.json();
    // type: "offer" | "answer" | "ice-doctor" | "ice-patient" | "clear"

    const appt = await Appointment.findById(id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPatient = appt.patientRef.toString() === user.userId;
    const isDoctor  = appt.doctorRef.toString()  === user.userId;
    if (!isPatient && !isDoctor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!appt.callSignaling) {
      appt.callSignaling = { doctorIce: [], patientIce: [] };
    }

    if (type === "offer") {
      appt.callSignaling.offer     = payload;
      appt.callSignaling.doctorIce = [];
      appt.callSignaling.patientIce = [];
    } else if (type === "answer") {
      appt.callSignaling.answer = payload;
    } else if (type === "ice-doctor") {
      appt.callSignaling.doctorIce = [...(appt.callSignaling.doctorIce ?? []), payload];
    } else if (type === "ice-patient") {
      appt.callSignaling.patientIce = [...(appt.callSignaling.patientIce ?? []), payload];
    } else if (type === "clear") {
      appt.callSignaling = { doctorIce: [], patientIce: [] };
    }

    appt.markModified("callSignaling");
    await appt.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
