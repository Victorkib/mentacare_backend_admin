import mongoose from "mongoose"

const sessionSchema = mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Patient",
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Therapist",
    },
    datetime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // Duration in minutes
      required: true,
    },
    notes: {
      type: String,
    },
    attachments: [
      {
        type: String, // URLs or file paths to attachments
      },
    ],
    status: {
      type: String,
      enum: ["upcoming", "completed", "missed", "cancelled", "rescheduled"],
      default: "upcoming",
    },
    attendance_marked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

const Session = mongoose.model("Session", sessionSchema)

export default Session
