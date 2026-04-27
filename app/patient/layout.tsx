import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import PatientProfile from "@/lib/models/PatientProfile";
import Sidebar from "@/components/Sidebar";
import {
  LayoutDashboard,
  CalendarDays,
  HeartPulse,
  User as UserIcon,
} from "lucide-react";

const navItems = [
  { href: "/patient/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/patient/appointments", label: "Appointments", icon: <CalendarDays className="w-4 h-4" /> },
  { href: "/patient/profile", label: "Health Profile", icon: <HeartPulse className="w-4 h-4" /> },
];

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const authUser = await getCurrentUser();
  if (!authUser || authUser.role !== "patient") redirect("/login");

  await connectDB();
  const dbUser = await User.findById(authUser.userId).select("name profileCompleted").lean();
  const profile = await PatientProfile.findOne({ userRef: authUser.userId }).select("userId").lean();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        navItems={navItems}
        userName={dbUser?.name ?? authUser.name}
        userRole="Patient"
        userId={(profile as { userId?: string })?.userId}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
