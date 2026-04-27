import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import PatientProfile, { generatePatientId } from "@/lib/models/PatientProfile";
import User from "@/lib/models/User";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "patient") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const profile = await PatientProfile.findOne({ userRef: user.userId });
    if (!profile) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile });
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
    const body = await req.json();

    const existing = await PatientProfile.findOne({ userRef: user.userId });
    if (existing) {
      const updated = await PatientProfile.findOneAndUpdate(
        { userRef: user.userId },
        { ...body },
        { new: true }
      );
      return NextResponse.json({ profile: updated });
    }

    const profile = await PatientProfile.create({ ...body, userRef: user.userId, userId: generatePatientId() });
    await User.findByIdAndUpdate(user.userId, { profileCompleted: true });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
