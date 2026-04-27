import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/lib/models/Appointment";
import DoctorProfile from "@/lib/models/DoctorProfile";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");

    let filter = {};
    if (user.role === "patient") filter = { patientRef: user.userId };
    if (user.role === "doctor") filter = { doctorRef: user.userId };

    const appointments = await Appointment.find(filter)
      .sort({ date: -1 })
      .limit(limit);

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { doctorId, date, timeSlot } = await req.json();

    const doctorProfile = await DoctorProfile.findOne({ userRef: doctorId }).populate("userRef");
    if (!doctorProfile) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    if (doctorProfile.verificationStatus !== "approved") {
      return NextResponse.json({ error: "Doctor not available" }, { status: 400 });
    }

    const doctorUser = doctorProfile.userRef as unknown as { name: string };

    const appointment = await Appointment.create({
      patientRef: user.userId,
      doctorRef: doctorId,
      patientName: user.name,
      doctorName: doctorUser.name,
      specialization: doctorProfile.specialization,
      date: new Date(date),
      timeSlot,
      consultationFee: doctorProfile.consultationFee,
      status: "scheduled",
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
