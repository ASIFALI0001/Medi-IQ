"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Star, MapPin, Briefcase, GraduationCap,
  IndianRupee, Radio, WifiOff, ArrowLeft, Stethoscope,
} from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";

interface Doctor {
  _id: string;
  userId: string;
  specialization: string;
  qualification: string;
  experience: number;
  hospital: string;
  city: string;
  consultationFee: number;
  verificationStatus: string;
  rating: number;
  totalRatings: number;
  isLive: boolean;
  userRef: { _id: string; name: string; email: string };
}

const SPECIALIZATIONS = [
  "All", "Cardiologist", "Dermatologist", "Neurologist", "Orthopedic",
  "Pediatrician", "Psychiatrist", "General Physician", "ENT Specialist",
  "Ophthalmologist", "Gynecologist", "Gastroenterologist",
];

export default function BookAppointmentPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctors/available")
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter((d) => {
    const matchSearch =
      d.userRef.name.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization.toLowerCase().includes(search.toLowerCase()) ||
      d.city.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" || d.specialization.toLowerCase() === filter.toLowerCase();
    return matchSearch && matchFilter;
  });

  const liveDoctors = filtered.filter((d) => d.isLive);
  const offlineDoctors = filtered.filter((d) => !d.isLive);

  const handleBook = async (doctor: Doctor) => {
    if (!doctor.isLive) { toast.error("This doctor is not live right now"); return; }
    setBookingId(doctor.userRef._id);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorUserId: doctor.userRef._id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Appointment booked! Fill your pre-consultation details.");
      router.push(`/patient/pre-consultation/${data.appointment._id}`);
    } catch {
      toast.error("Booking failed");
    } finally {
      setBookingId(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in-up">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Find a Doctor</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              {liveDoctors.length} Live now
            </span>
            <span className="text-slate-400 mx-2">·</span>
            {offlineDoctors.length} offline
          </p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-up stagger-1 opacity-0" style={{ animationFillMode: "forwards" }}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, specialization, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {SPECIALIZATIONS.slice(0, 7).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                  filter === s
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 h-56 skeleton" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Live Doctors */}
          {liveDoctors.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                <h2 className="font-semibold text-slate-700">Available Now ({liveDoctors.length})</h2>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {liveDoctors.map((doc, i) => (
                  <DoctorCard key={doc._id} doctor={doc} onBook={handleBook} loading={bookingId === doc.userRef._id} delay={i * 60} />
                ))}
              </div>
            </section>
          )}

          {/* Offline Doctors */}
          {offlineDoctors.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <WifiOff className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-500">Offline ({offlineDoctors.length})</h2>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {offlineDoctors.map((doc, i) => (
                  <DoctorCard key={doc._id} doctor={doc} onBook={handleBook} loading={false} delay={i * 50} />
                ))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-20">
              <Stethoscope className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No doctors found</p>
              <p className="text-slate-300 text-sm mt-1">Try a different search or filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DoctorCard({ doctor, onBook, loading, delay }: {
  doctor: Doctor;
  onBook: (d: Doctor) => void;
  loading: boolean;
  delay: number;
}) {
  const stars = Math.round(doctor.rating);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-4 animate-fade-in-up opacity-0 transition-all duration-200 ${
        doctor.isLive ? "border-emerald-100 hover:shadow-md hover:-translate-y-0.5" : "border-slate-100 opacity-70"
      }`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {doctor.userRef.name.charAt(0)}
            </div>
            {/* Live indicator */}
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              doctor.isLive ? "bg-emerald-500" : "bg-slate-300"
            }`} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Dr. {doctor.userRef.name}</p>
            <p className="text-slate-500 text-xs capitalize">{doctor.specialization}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
          doctor.isLive
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : "bg-slate-50 text-slate-500 border border-slate-100"
        }`}>
          {doctor.isLive ? <><Radio className="w-2.5 h-2.5 animate-pulse" /> Live</> : <><WifiOff className="w-2.5 h-2.5" /> Offline</>}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
          {doctor.qualification.toUpperCase()} · {doctor.experience} yr{doctor.experience !== 1 ? "s" : ""} experience
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
          {doctor.hospital}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          {doctor.city}
        </div>
      </div>

      {/* Rating + Fee */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3 h-3 ${s <= stars ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {doctor.totalRatings > 0 ? `${doctor.rating.toFixed(1)} (${doctor.totalRatings})` : "No ratings yet"}
          </span>
        </div>
        <div className="flex items-center gap-0.5 font-bold text-slate-800 text-sm">
          <IndianRupee className="w-3.5 h-3.5" />
          {doctor.consultationFee}
        </div>
      </div>

      {/* Book button */}
      <Button
        onClick={() => onBook(doctor)}
        loading={loading}
        disabled={!doctor.isLive}
        variant={doctor.isLive ? "primary" : "ghost"}
        className="w-full"
        size="sm"
      >
        {doctor.isLive ? "Book Consultation" : "Not Available"}
      </Button>
    </div>
  );
}
