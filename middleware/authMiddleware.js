import jwt from "jsonwebtoken"
import asyncHandler from "./asyncHandler.js"
import Admin from "../models/Admin.js"
import dotenv from "dotenv"

dotenv.config()

const protect = asyncHandler(async (req, res, next) => {
  let token

  // Check for JWT in http-only cookie
  if (req.cookies.jwt) {
    token = req.cookies.jwt
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await Admin.findById(decoded.id).select("-password")
      next()
    } catch (error) {
      console.error(error)
      res.status(401)
      throw new Error("Not authorized, token failed")
    }
  } else {
    res.status(401)
    throw new Error("Not authorized, no token")
  }
})

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403)
      throw new Error("Not authorized to access this route")
    }
    next()
  }
}

export { protect, authorize }
