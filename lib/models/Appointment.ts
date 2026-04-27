import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAppointment extends Document {
  patientRef: mongoose.Types.ObjectId;
  doctorRef: mongoose.Types.ObjectId;
  patientName: string;
  doctorName: string;
  specialization: string;
  date: Date;
  timeSlot: string;
  status: "scheduled" | "completed" | "cancelled";
  consultationFee: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorRef: { type: Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    doctorName: { type: String, required: true },
    specialization: { type: String, required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    consultationFee: { type: Number, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

const Appointment: Model<IAppointment> =
  mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);

export default Appointment;
