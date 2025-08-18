import express from "express"
import {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  attachSessionNotesAndDocuments,
  markSessionAttendance,
  updateSessionStatus,
} from "../controllers/sessionController.js"
import { protect, authorize } from "../middleware/authMiddleware.js"

const router = express.Router()

router
  .route("/")
  .post(protect, authorize("admin", "super_admin"), createSession)
  .get(protect, authorize("admin", "super_admin", "therapist"), getSessions) // Therapists can view their sessions

router
  .route("/:id")
  .get(protect, authorize("admin", "super_admin", "therapist"), getSessionById)
  .put(protect, authorize("admin", "super_admin", "therapist"), updateSession) // Therapists can update their sessions
  .delete(protect, authorize("admin", "super_admin"), deleteSession)

router.put(
  "/:id/notes-attachments",
  protect,
  authorize("admin", "super_admin", "therapist"),
  attachSessionNotesAndDocuments,
)
router.put("/:id/mark-attendance", protect, authorize("admin", "super_admin", "therapist"), markSessionAttendance)
router.put("/:id/status", protect, authorize("admin", "super_admin", "therapist"), updateSessionStatus)

export default router
