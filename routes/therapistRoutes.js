import express from 'express';
import {
  getTherapists,
  getTherapistsSummary,
  getTherapistById,
  createTherapist,
  updateTherapist,
  deleteTherapist,
  assignPatientsToTherapist,
  updateTherapistAvailability,
  batchUpdateTherapists,
  getTherapistSpecializations,
} from '../controllers/TherapistController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { cacheMiddleware } from '../middleware/cacheMiddleware.js';

const router = express.Router();

// Main CRUD routes
router
  .route('/')
  .get(
    protect,
    authorize('admin', 'super_admin'),
    cacheMiddleware(300), // 5 minutes cache
    getTherapists
  )
  .post(protect, authorize('admin', 'super_admin'), createTherapist);

// Summary route (cached for longer)
router.get(
  '/summary',
  protect,
  authorize('admin', 'super_admin'),
  cacheMiddleware(600), // 10 minutes cache
  getTherapistsSummary
);

// Specializations route (cached for longer)
router.get(
  '/specializations',
  protect,
  authorize('admin', 'super_admin'),
  cacheMiddleware(1800), // 30 minutes cache
  getTherapistSpecializations
);

// Batch operations
router.put(
  '/batch-update',
  protect,
  authorize('admin', 'super_admin'),
  batchUpdateTherapists
);

// Individual therapist routes
router
  .route('/:id')
  .get(
    protect,
    authorize('admin', 'super_admin'),
    cacheMiddleware(300),
    getTherapistById
  )
  .put(protect, authorize('admin', 'super_admin'), updateTherapist)
  .delete(protect, authorize('admin', 'super_admin'), deleteTherapist);

// Special action routes
router.put(
  '/:id/assign-patients',
  protect,
  authorize('admin', 'super_admin'),
  assignPatientsToTherapist
);

router.put(
  '/:id/availability',
  protect,
  authorize('admin', 'super_admin'),
  updateTherapistAvailability
);

export default router;
