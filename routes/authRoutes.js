import express from 'express';
import {
  loginAdmin,
  logoutAdmin,
  refreshToken,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', loginAdmin);
router.post('/logout', protect, logoutAdmin);
router.post('/refresh', refreshToken); // Refresh token doesn't need `protect` as it uses the refresh token directly
router.get('/me', protect, getMe); // New route to get current user info

export default router;
