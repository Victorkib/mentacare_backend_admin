import mongoose from "mongoose"

const therapistSchema = mongoose.Schema(
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
    specialty: {
      type: String,
      required: true,
    },
    assigned_patients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
      },
    ],
    session_load: {
      type: Number,
      default: 0,
    },
    documents: [
      {
        type: String, // URLs or file paths to documents
      },
    ],
  },
  {
    timestamps: true,
  },
)

const Therapist = mongoose.model("Therapist", therapistSchema)

export default Therapist
