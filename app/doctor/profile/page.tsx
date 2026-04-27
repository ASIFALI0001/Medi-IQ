"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Save, Stethoscope } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const SPECIALIZATIONS = [
  "Cardiologist", "Dermatologist", "Neurologist", "Orthopedic", "Pediatrician",
  "Psychiatrist", "General Physician", "ENT Specialist", "Ophthalmologist",
  "Gynecologist", "Urologist", "Gastroenterologist", "Pulmonologist", "Endocrinologist",
];

const QUALIFICATIONS = ["MBBS", "MD", "MS", "DNB", "DM", "MCh", "MBBS + MD", "MBBS + MS"];

export default function DoctorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [profile, setProfile] = useState<{ verificationStatus?: string } | null>(null);
  const [form, setForm] = useState({
    specialization: "", qualification: "", experience: "",
    hospital: "", city: "", registrationNumber: "", consultationFee: "",
  });

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/doctor/profile");
    const data = await res.json();
    if (data.profile) {
      setProfile(data.profile);
      setForm({
        specialization: data.profile.specialization ?? "",
        qualification: data.profile.qualification ?? "",
        experience: String(data.profile.experience ?? ""),
        hospital: data.profile.hospital ?? "",
        city: data.profile.city ?? "",
        registrationNumber: data.profile.registrationNumber ?? "",
        consultationFee: String(data.profile.consultationFee ?? ""),
      });
    }
    setFetching(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          experience: Number(form.experience),
          consultationFee: Number(form.consultationFee),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(profile ? "Profile updated!" : "Profile submitted for review!");
      router.push("/doctor/dashboard");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Professional Profile</h1>
            <p className="text-sm text-slate-500">
              {profile ? "Update your professional details" : "Complete your profile to start receiving consultations"}
            </p>
          </div>
        </div>
      </div>

      {profile && (profile as { verificationStatus?: string }).verificationStatus && (
        <VerificationBanner status={(profile as { verificationStatus: string }).verificationStatus} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
          <h2 className="font-semibold text-slate-700 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">01</span>
            Specialization & Qualification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Specialization</label>
              <select
                required
                value={form.specialization}
                onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Highest Qualification</label>
              <select
                required
                value={form.qualification}
                onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="">Select qualification</option>
                {QUALIFICATIONS.map((q) => <option key={q} value={q.toLowerCase()}>{q}</option>)}
              </select>
            </div>
            <Input
              label="Years of Experience"
              type="number" min={0} max={60} required
              value={form.experience}
              onChange={(e) => setForm((p) => ({ ...p, experience: e.target.value }))}
              placeholder="5"
            />
            <Input
              label="Consultation Fee (₹)"
              type="number" min={0} required
              value={form.consultationFee}
              onChange={(e) => setForm((p) => ({ ...p, consultationFee: e.target.value }))}
              placeholder="500"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up stagger-1 opacity-0" style={{ animationFillMode: "forwards" }}>
          <h2 className="font-semibold text-slate-700 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">02</span>
            Practice Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Hospital / Clinic Name"
              required
              value={form.hospital}
              onChange={(e) => setForm((p) => ({ ...p, hospital: e.target.value }))}
              placeholder="AIIMS Delhi"
            />
            <Input
              label="City"
              required
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="New Delhi"
            />
            <Input
              label="Medical Registration Number"
              required
              value={form.registrationNumber}
              onChange={(e) => setForm((p) => ({ ...p, registrationNumber: e.target.value }))}
              placeholder="MCI-12345"
              className="md:col-span-2"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={loading} size="lg" className="gap-2">
            <Save className="w-4 h-4" />
            {profile ? "Update Profile" : "Submit for Review"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function VerificationBanner({ status }: { status: string }) {
  const map: Record<string, { cls: string; msg: string }> = {
    pending: { cls: "bg-amber-50 border-amber-200 text-amber-800", msg: "Your profile is under review by admin. You'll be notified once approved." },
    approved: { cls: "bg-emerald-50 border-emerald-200 text-emerald-800", msg: "Your profile has been approved. You can now go live and accept consultations." },
    rejected: { cls: "bg-red-50 border-red-200 text-red-800", msg: "Your profile was not approved. Please update your details and resubmit." },
  };
  const b = map[status] ?? map.pending;
  return (
    <div className={`mb-6 p-4 rounded-2xl border text-sm font-medium animate-fade-in ${b.cls}`}>
      {b.msg}
    </div>
  );
}
