import asyncHandler from "../middleware/asyncHandler.js"
import Admin from "../models/Admin.js"

// @desc    Register a new admin
// @route   POST /api/admins
// @access  Private/SuperAdmin
const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role, permissions } = req.body

  const adminExists = await Admin.findOne({ email })

  if (adminExists) {
    res.status(400)
    throw new Error("Admin already exists")
  }

  const admin = await Admin.create({
    name,
    email,
    password,
    role,
    permissions,
  })

  if (admin) {
    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
    })
  } else {
    res.status(400)
    throw new Error("Invalid admin data")
  }
})

// @desc    Get all admins
// @route   GET /api/admins
// @access  Private/Admin
const getAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({})
  res.json(admins)
})

// @desc    Get admin by ID
// @route   GET /api/admins/:id
// @access  Private/Admin
const getAdminById = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id)

  if (admin) {
    res.json(admin)
  } else {
    res.status(404)
    throw new Error("Admin not found")
  }
})

// @desc    Update admin
// @route   PUT /api/admins/:id
// @access  Private/Admin
const updateAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id)

  if (admin) {
    admin.name = req.body.name || admin.name
    admin.email = req.body.email || admin.email
    admin.role = req.body.role || admin.role
    admin.permissions = req.body.permissions || admin.permissions

    if (req.body.password) {
      admin.password = req.body.password // Password hashing handled by pre-save hook
    }

    const updatedAdmin = await admin.save()
    res.json({
      _id: updatedAdmin._id,
      name: updatedAdmin.name,
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      permissions: updatedAdmin.permissions,
    })
  } else {
    res.status(404)
    throw new Error("Admin not found")
  }
})

// @desc    Delete admin
// @route   DELETE /api/admins/:id
// @access  Private/SuperAdmin
const deleteAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id)

  if (admin) {
    await Admin.deleteOne({ _id: admin._id })
    res.json({ message: "Admin removed" })
  } else {
    res.status(404)
    throw new Error("Admin not found")
  }
})

export { registerAdmin, getAdmins, getAdminById, updateAdmin, deleteAdmin }
