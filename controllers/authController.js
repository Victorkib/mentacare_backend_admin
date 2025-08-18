import asyncHandler from '../middleware/asyncHandler.js';
import Admin from '../models/Admin.js';
import { generateToken, generateRefreshToken } from '../utils/generateToken.js';
import jwt from 'jsonwebtoken'; // Import jwt to fix undeclared variable error

// @desc    Auth admin & get token
// @route   POST /api/auth/login
// @access  Public
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });

  if (admin && (await admin.matchPassword(password))) {
    const token = generateToken(admin._id, admin.role);
    const refreshToken = generateRefreshToken(admin._id);

    // Set JWT as http-only cookie
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
      sameSite: 'strict', // Prevent CSRF attacks
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    res.json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Logout admin / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logoutAdmin = asyncHandler(async (req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.status(200).json({ message: 'Logged out successfully' });
});

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private (requires refresh token)
const refreshToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    res.status(401);
    throw new Error('Not authorized, no refresh token');
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin) {
      res.status(401);
      throw new Error('Not authorized, user not found');
    }

    const newAccessToken = generateToken(admin._id, admin.role);
    res.cookie('jwt', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60, // 1 hour
    });

    res.json({ message: 'Access token refreshed' });
  } catch (error) {
    console.error(error);
    res.status(403);
    throw new Error('Not authorized, refresh token failed');
  }
});

// @desc    Get current authenticated admin profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  // req.user is populated by the protect middleware
  if (req.user) {
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      permissions: req.user.permissions,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

export { loginAdmin, logoutAdmin, refreshToken, getMe };
