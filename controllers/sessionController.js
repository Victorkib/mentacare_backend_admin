import asyncHandler from "../middleware/asyncHandler.js"
import Session from "../models/Session.js"

// @desc    Create a new session
// @route   POST /api/sessions
// @access  Private/Admin
const createSession = asyncHandler(async (req, res) => {
  const { patient, therapist, datetime, duration, notes, attachments, status } = req.body

  const session = new Session({
    patient,
    therapist,
    datetime,
    duration,
    notes,
    attachments,
    status,
  })

  const createdSession = await session.save()
  res.status(201).json(createdSession)
})

// @desc    Get all sessions
// @route   GET /api/sessions
// @access  Private/Admin
const getSessions = asyncHandler(async (req, res) => {
  const pageSize = 10
  const page = Number(req.query.pageNumber) || 1
  const statusFilter = req.query.status ? { status: req.query.status } : {}
  const patientFilter = req.query.patientId ? { patient: req.query.patientId } : {}
  const therapistFilter = req.query.therapistId ? { therapist: req.query.therapistId } : {}

  const count = await Session.countDocuments({ ...statusFilter, ...patientFilter, ...therapistFilter })
  const sessions = await Session.find({ ...statusFilter, ...patientFilter, ...therapistFilter })
    .populate("patient", "full_name email")
    .populate("therapist", "full_name email")
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ datetime: 1 }) // Sort by upcoming sessions first

  res.json({ sessions, page, pages: Math.ceil(count / pageSize) })
})

// @desc    Get session by ID
// @route   GET /api/sessions/:id
// @access  Private/Admin
const getSessionById = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)
    .populate("patient", "full_name email")
    .populate("therapist", "full_name email")

  if (session) {
    res.json(session)
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

// @desc    Update session
// @route   PUT /api/sessions/:id
// @access  Private/Admin
const updateSession = asyncHandler(async (req, res) => {
  const { datetime, duration, notes, attachments, status, attendance_marked } = req.body

  const session = await Session.findById(req.params.id)

  if (session) {
    session.datetime = datetime || session.datetime
    session.duration = duration || session.duration
    session.notes = notes || session.notes
    session.attachments = attachments || session.attachments
    session.status = status || session.status
    session.attendance_marked = attendance_marked !== undefined ? attendance_marked : session.attendance_marked

    const updatedSession = await session.save()
    res.json(updatedSession)
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

// @desc    Delete session
// @route   DELETE /api/sessions/:id
// @access  Private/Admin
const deleteSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id)

  if (session) {
    await Session.deleteOne({ _id: session._id })
    res.json({ message: "Session removed" })
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

// @desc    Attach session notes/documents
// @route   PUT /api/sessions/:id/notes-attachments
// @access  Private/Admin
const attachSessionNotesAndDocuments = asyncHandler(async (req, res) => {
  const { notes, attachments } = req.body
  const session = await Session.findById(req.params.id)

  if (session) {
    session.notes = notes !== undefined ? notes : session.notes
    session.attachments = attachments !== undefined ? attachments : session.attachments
    const updatedSession = await session.save()
    res.json(updatedSession)
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

// @desc    Mark session attendance
// @route   PUT /api/sessions/:id/mark-attendance
// @access  Private/Admin
const markSessionAttendance = asyncHandler(async (req, res) => {
  const { attended } = req.body // true/false
  const session = await Session.findById(req.params.id)

  if (session) {
    session.attendance_marked = attended
    if (attended) {
      session.status = "completed"
    } else {
      session.status = "missed"
    }
    const updatedSession = await session.save()
    res.json(updatedSession)
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

// @desc    Cancel or Reschedule Session
// @route   PUT /api/sessions/:id/status
// @access  Private/Admin
const updateSessionStatus = asyncHandler(async (req, res) => {
  const { status, newDatetime } = req.body // status can be 'cancelled' or 'rescheduled'
  const session = await Session.findById(req.params.id)

  if (session) {
    session.status = status
    if (status === "rescheduled" && newDatetime) {
      session.datetime = newDatetime
    }
    const updatedSession = await session.save()
    res.json(updatedSession)
  } else {
    res.status(404)
    throw new Error("Session not found")
  }
})

export {
  createSession,
  getSessions,
  getSessionById,
  updateSession,
  deleteSession,
  attachSessionNotesAndDocuments,
  markSessionAttendance,
  updateSessionStatus,
}
