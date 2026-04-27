import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPatientProfile extends Document {
  userRef: mongoose.Types.ObjectId;
  userId: string;
  age: number;
  gender: string;
  weight: number;
  height: number;
  bloodGroup: string;
  city: string;
  state: string;
  country: string;
  knownConditions: string[];
  allergies: string[];
  currentMedications: string[];
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PatientProfileSchema = new Schema<IPatientProfile>(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: String, unique: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    weight: { type: Number, required: true },
    height: { type: Number, required: true },
    bloodGroup: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    knownConditions: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    currentMedications: { type: [String], default: [] },
    emergencyContact: {
      name: { type: String, required: true },
      relation: { type: String, required: true },
      phone: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export function generatePatientId(): string {
  return `PT-${String(Math.floor(100000 + Math.random() * 900000))}`;
}

const PatientProfile: Model<IPatientProfile> =
  mongoose.models.PatientProfile ||
  mongoose.model<IPatientProfile>("PatientProfile", PatientProfileSchema);

export default PatientProfile;
