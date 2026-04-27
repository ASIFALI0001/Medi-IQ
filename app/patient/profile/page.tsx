"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, X, Save, User } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PatientProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({
    age: "", gender: "Male", weight: "", height: "", bloodGroup: "O+",
    city: "", state: "", country: "India",
    knownConditions: [] as string[],
    allergies: [] as string[],
    currentMedications: [] as string[],
    emergencyContact: { name: "", relation: "", phone: "" },
  });
  const [newItems, setNewItems] = useState({ condition: "", allergy: "", medication: "" });

  const fetchProfile = useCallback(async () => {
    const res = await fetch("/api/patient/profile");
    const data = await res.json();
    if (data.profile) {
      setForm({
        age: String(data.profile.age),
        gender: data.profile.gender,
        weight: String(data.profile.weight),
        height: String(data.profile.height),
        bloodGroup: data.profile.bloodGroup,
        city: data.profile.city,
        state: data.profile.state,
        country: data.profile.country,
        knownConditions: data.profile.knownConditions ?? [],
        allergies: data.profile.allergies ?? [],
        currentMedications: data.profile.currentMedications ?? [],
        emergencyContact: data.profile.emergencyContact ?? { name: "", relation: "", phone: "" },
      });
    }
    setFetching(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const addItem = (field: "knownConditions" | "allergies" | "currentMedications", key: keyof typeof newItems) => {
    const val = newItems[key].trim();
    if (!val) return;
    setForm((p) => ({ ...p, [field]: [...p[field], val] }));
    setNewItems((p) => ({ ...p, [key]: "" }));
  };

  const removeItem = (field: "knownConditions" | "allergies" | "currentMedications", idx: number) => {
    setForm((p) => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/patient/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          weight: Number(form.weight),
          height: Number(form.height),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success("Health profile saved!");
      router.push("/patient/dashboard");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex items-center justify-center h-full min-h-screen">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Health Profile</h1>
            <p className="text-sm text-slate-500">Complete your profile to unlock consultations</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Section title="Basic Information" step="01">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Input label="Age" type="number" min={1} max={120} required value={form.age} onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))} placeholder="28" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Gender</label>
              <select value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                {["Male", "Female", "Other"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Blood Group</label>
              <select value={form.bloodGroup} onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                {BLOOD_GROUPS.map((bg) => <option key={bg}>{bg}</option>)}
              </select>
            </div>
            <Input label="Weight (kg)" type="number" min={1} required value={form.weight} onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))} placeholder="70" />
            <Input label="Height (cm)" type="number" min={1} required value={form.height} onChange={(e) => setForm((p) => ({ ...p, height: e.target.value }))} placeholder="175" />
          </div>
        </Section>

        {/* Location */}
        <Section title="Location" step="02">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="City" required value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Patna" />
            <Input label="State" required value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} placeholder="Bihar" />
            <Input label="Country" required value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} placeholder="India" />
          </div>
        </Section>

        {/* Medical History */}
        <Section title="Medical History" step="03">
          <TagField label="Known Conditions" items={form.knownConditions} inputVal={newItems.condition} onChange={(v) => setNewItems((p) => ({ ...p, condition: v }))} onAdd={() => addItem("knownConditions", "condition")} onRemove={(i) => removeItem("knownConditions", i)} placeholder="e.g. Diabetes" />
          <TagField label="Allergies" items={form.allergies} inputVal={newItems.allergy} onChange={(v) => setNewItems((p) => ({ ...p, allergy: v }))} onAdd={() => addItem("allergies", "allergy")} onRemove={(i) => removeItem("allergies", i)} placeholder="e.g. Penicillin" />
          <TagField label="Current Medications" items={form.currentMedications} inputVal={newItems.medication} onChange={(v) => setNewItems((p) => ({ ...p, medication: v }))} onAdd={() => addItem("currentMedications", "medication")} onRemove={(i) => removeItem("currentMedications", i)} placeholder="e.g. Metformin 500mg" />
        </Section>

        {/* Emergency Contact */}
        <Section title="Emergency Contact" step="04">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Contact Name" required value={form.emergencyContact.name} onChange={(e) => setForm((p) => ({ ...p, emergencyContact: { ...p.emergencyContact, name: e.target.value } }))} placeholder="John Doe" />
            <Input label="Relation" required value={form.emergencyContact.relation} onChange={(e) => setForm((p) => ({ ...p, emergencyContact: { ...p.emergencyContact, relation: e.target.value } }))} placeholder="Parent" />
            <Input label="Phone" required value={form.emergencyContact.phone} onChange={(e) => setForm((p) => ({ ...p, emergencyContact: { ...p.emergencyContact, phone: e.target.value } }))} placeholder="+91 9876543210" />
          </div>
        </Section>

        <div className="flex justify-end pt-2">
          <Button type="submit" loading={loading} size="lg" className="gap-2">
            <Save className="w-4 h-4" />
            Save Health Profile
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, step, children }: { title: string; step: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in-up opacity-0" style={{ animationFillMode: "forwards" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{step}</div>
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function TagField({ label, items, inputVal, onChange, onAdd, onRemove, placeholder }: {
  label: string; items: string[]; inputVal: string;
  onChange: (v: string) => void; onAdd: () => void;
  onRemove: (i: number) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 mb-2 block">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        <button type="button" onClick={onAdd} className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {item}
              <button type="button" onClick={() => onRemove(i)} className="hover:text-blue-900 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
