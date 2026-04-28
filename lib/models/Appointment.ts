import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVitalsReading {
  sbp:               number;
  dbp:               number;
  hr:                number;
  bp_classification: string;
  hr_classification: string;
  confidence:        number;
}

export interface IPreConsultation {
  symptoms:           string;
  duration:           string;
  severity:           "mild" | "moderate" | "severe";
  currentMedications: string;
  additionalNotes:    string;
  vitals?:            IVitalsReading;
  filledAt?:          Date;
}

export interface IPrescriptionMedicine {
  medicine:  string;
  dosage:    string;
  timing:    string;
  frequency: string;
  duration:  string;
}

export interface IPrescription {
  diagnosis: string;
  medicines: IPrescriptionMedicine[];
  advice:    string;
}

export interface IAiReport {
  summary:     string;
  conditions:  string[];
  questions:   string[];
  generatedAt: Date;
}

export interface IAppointment extends Document {
  patientRef:      mongoose.Types.ObjectId;
  doctorRef:       mongoose.Types.ObjectId;
  patientName:     string;
  doctorName:      string;
  specialization:  string;
  consultationFee: number;
  // Status flow:
  // pending_approval → confirmed → active
  //   → (patient enters waiting room, waitingRoomAt set)
  //   → in_call → post_call → completed
  //   | rejected | cancelled
  status: "pending_approval" | "confirmed" | "active" | "in_call" | "post_call" | "completed" | "rejected" | "cancelled";
  bookedAt:             Date;
  approvedAt?:          Date;
  consultationStartsAt: Date;
  preConsultation?:     IPreConsultation;

  // Waiting room
  waitingRoomAt?: Date;

  // Call
  callStartedAt?: Date;
  callEndedAt?:   Date;
  transcript?:    string;  // full call transcript saved at end-call

  // AI outputs
  aiReport?:       IAiReport;      // pre-call Gemini analysis (generated when doctor opens case)
  aiPrescription?: IPrescription;  // Gemini's post-call suggestion (async, generated after end-call)

  // Doctor-finalized prescription (set when doctor clicks "Send Prescription")
  prescription?:      IPrescription;
  prescriptionSentAt?: Date;

  // WebRTC signaling — DB-backed so it works on Vercel (no Socket.io needed)
  callSignaling?: {
    offer?:       { type: string; sdp: string };
    answer?:      { type: string; sdp: string };
    doctorIce:    object[];   // ICE candidates from doctor
    patientIce:   object[];   // ICE candidates from patient
  };

  // Post-call
  caseRef?:        mongoose.Types.ObjectId;
  patientRating?:  number;
  ratingComment?:  string;

  notes?:     string;
  createdAt:  Date;
  updatedAt:  Date;
}

const MedicineSchema = new Schema<IPrescriptionMedicine>(
  {
    medicine:  { type: String, required: true },
    dosage:    { type: String, default: "" },
    timing:    { type: String, default: "" },
    frequency: { type: String, default: "" },
    duration:  { type: String, default: "" },
  },
  { _id: false }
);

const PrescriptionSchema = new Schema<IPrescription>(
  {
    diagnosis: { type: String, required: true },
    medicines: { type: [MedicineSchema], default: [] },
    advice:    { type: String, default: "" },
  },
  { _id: false }
);

const PreConsultationSchema = new Schema<IPreConsultation>(
  {
    symptoms:           { type: String, required: true },
    duration:           { type: String, required: true },
    severity:           { type: String, enum: ["mild", "moderate", "severe"], required: true },
    currentMedications: { type: String, default: "" },
    additionalNotes:    { type: String, default: "" },
    vitals: {
      sbp:               { type: Number },
      dbp:               { type: Number },
      hr:                { type: Number },
      bp_classification: { type: String },
      hr_classification: { type: String },
      confidence:        { type: Number },
    },
    filledAt: { type: Date },
  },
  { _id: false }
);

const AiReportSchema = new Schema<IAiReport>(
  {
    summary:     { type: String, required: true },
    conditions:  { type: [String], default: [] },
    questions:   { type: [String], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientRef:      { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorRef:       { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientName:     { type: String, required: true },
    doctorName:      { type: String, required: true },
    specialization:  { type: String, required: true },
    consultationFee: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending_approval", "confirmed", "active", "in_call", "post_call", "completed", "rejected", "cancelled"],
      default: "pending_approval",
    },
    bookedAt:             { type: Date, required: true },
    approvedAt:           { type: Date },
    consultationStartsAt: { type: Date, required: true },
    preConsultation:      { type: PreConsultationSchema },

    waitingRoomAt: { type: Date },
    callStartedAt: { type: Date },
    callEndedAt:   { type: Date },
    transcript:    { type: String },

    aiReport:       { type: AiReportSchema },
    aiPrescription: { type: PrescriptionSchema },
    prescription:   { type: PrescriptionSchema },
    prescriptionSentAt: { type: Date },

    callSignaling: {
      offer:        { type: Schema.Types.Mixed },
      answer:       { type: Schema.Types.Mixed },
      doctorIce:    { type: [Schema.Types.Mixed], default: [] },
      patientIce:   { type: [Schema.Types.Mixed], default: [] },
    },

    caseRef:       { type: Schema.Types.ObjectId, ref: "Case" },
    patientRating: { type: Number, min: 1, max: 5 },
    ratingComment: { type: String },

    notes: { type: String },
  },
  { timestamps: true }
);

// In dev, always delete the cached model so schema changes take effect after HMR
if (process.env.NODE_ENV === "development") {
  delete mongoose.models["Appointment"];
}

const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export default Appointment;
