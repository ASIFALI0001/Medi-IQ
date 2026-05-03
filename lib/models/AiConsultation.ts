import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAiConsultation extends Document {
  patientRef:   mongoose.Types.ObjectId;
  patientName:  string;
  status: "pre_consultation" | "ready_to_consult" | "in_consultation" | "generating_report" | "report_ready";
  preConsultation?: {
    symptoms:           string;
    duration:           string;
    severity:           string;
    currentMedications: string;
    additionalNotes:    string;
    filledAt:           Date;
  };
  aiQuestions:  string[];     // 5 questions Gemini generated before the call
  transcript:   string;       // full VAPI conversation
  report?: {
    diagnosis:   string;
    medicines:   Array<{ medicine: string; dosage: string; timing: string; frequency: string; duration: string }>;
    advice:      string;
    dosAndDonts: string[];
    summary:     string;
  };
  consultationStartedAt?: Date;
  consultationEndedAt?:   Date;
  reportGeneratedAt?:     Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiConsultationSchema = new Schema<IAiConsultation>(
  {
    patientRef:  { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    status:      { type: String, default: "pre_consultation",
                   enum: ["pre_consultation","ready_to_consult","in_consultation","generating_report","report_ready"] },
    preConsultation: {
      symptoms:           String,
      duration:           String,
      severity:           String,
      currentMedications: { type: String, default: "" },
      additionalNotes:    { type: String, default: "" },
      filledAt:           Date,
    },
    aiQuestions:  { type: [String], default: [] },
    transcript:   { type: String, default: "" },
    report: {
      diagnosis:   String,
      medicines:   [{
        medicine: String, dosage: String, timing: String,
        frequency: String, duration: String,
      }],
      advice:      String,
      dosAndDonts: [String],
      summary:     String,
    },
    consultationStartedAt: Date,
    consultationEndedAt:   Date,
    reportGeneratedAt:     Date,
  },
  { timestamps: true },
);

const AiConsultation: Model<IAiConsultation> =
  mongoose.models.AiConsultation ||
  mongoose.model<IAiConsultation>("AiConsultation", AiConsultationSchema);

export default AiConsultation;
