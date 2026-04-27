import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDoctorProfile extends Document {
  userRef: mongoose.Types.ObjectId;
  userId: string;
  specialization: string;
  qualification: string;
  experience: number;
  hospital: string;
  city: string;
  registrationNumber: string;
  consultationFee: number;
  verificationStatus: "pending" | "approved" | "rejected";
  rating: number;
  totalRatings: number;
  isLive: boolean;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DoctorProfileSchema = new Schema<IDoctorProfile>(
  {
    userRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userId: { type: String, unique: true },
    specialization: { type: String, required: true },
    qualification: { type: String, required: true },
    experience: { type: Number, required: true },
    hospital: { type: String, required: true },
    city: { type: String, required: true },
    registrationNumber: { type: String, required: true, unique: true },
    consultationFee: { type: Number, required: true },
    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    isLive: { type: Boolean, default: false },
    schedule: [
      {
        day: String,
        startTime: String,
        endTime: String,
      },
    ],
  },
  { timestamps: true }
);

export function generateDoctorId(): string {
  return `DR-${String(Math.floor(100000 + Math.random() * 900000))}`;
}

const DoctorProfile: Model<IDoctorProfile> =
  mongoose.models.DoctorProfile ||
  mongoose.model<IDoctorProfile>("DoctorProfile", DoctorProfileSchema);

export default DoctorProfile;
