import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import DoctorProfile from "@/lib/models/DoctorProfile";
import { redirect } from "next/navigation";
import DoctorApprovalList from "@/components/DoctorApprovalList";

export default async function AdminDoctorsPage() {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "admin") redirect("/login");

  await connectDB();
  const doctors = await DoctorProfile.find({})
    .populate("userRef", "name email createdAt")
    .sort({ createdAt: -1 })
    .lean() as unknown as {
      _id: string; userId: string; specialization: string; qualification: string;
      experience: number; hospital: string; city: string; consultationFee: number;
      registrationNumber: string; verificationStatus: string; rating: number;
      userRef: { name: string; email: string; createdAt: Date };
    }[];

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-800">Doctor Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">Review and approve doctor applications</p>
      </div>
      <DoctorApprovalList initialDoctors={JSON.parse(JSON.stringify(doctors))} />
    </div>
  );
}
