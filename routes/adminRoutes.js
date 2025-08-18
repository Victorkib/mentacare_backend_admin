import express from "express"
import { registerAdmin, getAdmins, getAdminById, updateAdmin, deleteAdmin } from "../controllers/adminController.js"
import { protect, authorize } from "../middleware/authMiddleware.js"

const router = express.Router()

router
  .route("/")
  .post(protect, authorize("super_admin"), registerAdmin) // Only super_admin can register new admins
  .get(protect, authorize("super_admin", "admin"), getAdmins) // Admins can view other admins

router
  .route("/:id")
  .get(protect, authorize("super_admin", "admin"), getAdminById)
  .put(protect, authorize("super_admin", "admin"), updateAdmin) // Admins can update other admins (or themselves)
  .delete(protect, authorize("super_admin"), deleteAdmin) // Only super_admin can delete admins

export default router
