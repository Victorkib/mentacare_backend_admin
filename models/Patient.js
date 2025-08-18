import mongoose from "mongoose"

const patientSchema = mongoose.Schema(
  {
    full_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    dob: {
      type: Date,
    },
    notes: {
      type: String,
    },
    flags: [
      {
        type: String, // e.g., ['High Risk', 'Special Attention']
      },
    ],
    documents: [
      {
        type: String, // URLs or file paths to documents
      },
    ],
    assigned_therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
    },
  },
  {
    timestamps: true,
  },
)

const Patient = mongoose.model("Patient", patientSchema)

export default Patient
