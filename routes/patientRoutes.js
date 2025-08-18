import express from 'express';
import {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  assignTherapistToPatient,
  flagPatient,
  uploadPatientDocument,
  getPatientsSummary,
  batchUpdatePatients,
  searchPatients,
  getPatientAnalytics,
} from '../controllers/PatientController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Summary endpoint for dashboard (cached)
router.get(
  '/summary',
  protect,
  authorize('admin', 'super_admin', 'professional'),
  getPatientsSummary
);

// Analytics endpoint
router.get(
  '/analytics',
  protect,
  authorize('admin', 'super_admin'),
  getPatientAnalytics
);

// Search endpoint
router.get(
  '/search',
  protect,
  authorize('admin', 'super_admin', 'professional'),
  searchPatients
);

// Batch operations
router.put(
  '/batch-update',
  protect,
  authorize('admin', 'super_admin'),
  batchUpdatePatients
);

router
  .route('/')
  .post(protect, authorize('admin', 'super_admin'), createPatient)
  .get(protect, authorize('admin', 'super_admin', 'professional'), getPatients);

router
  .route('/:id')
  .get(
    protect,
    authorize('admin', 'super_admin', 'professional'),
    getPatientById
  )
  .put(protect, authorize('admin', 'super_admin'), updatePatient)
  .delete(protect, authorize('admin', 'super_admin'), deletePatient);

router.put(
  '/:id/assign-therapist',
  protect,
  authorize('admin', 'super_admin'),
  assignTherapistToPatient
);
router.put(
  '/:id/flag',
  protect,
  authorize('admin', 'super_admin'),
  flagPatient
);
router.put(
  '/:id/documents',
  protect,
  authorize('admin', 'super_admin'),
  uploadPatientDocument
);

export default router;
