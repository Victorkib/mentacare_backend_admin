import asyncHandler from '../middleware/asyncHandler.js';
import { db } from '../config/firebase.js';

// Cache for frequently accessed data (in production, use Redis)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to get cached data or fetch from Firestore
const getCachedData = async (key, fetchFunction, ttl = CACHE_TTL) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  const data = await fetchFunction();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Helper function to clear cache
const clearCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

// @desc    Create a new patient
// @route   POST /api/patients
// @access  Private/Admin
const createPatient = asyncHandler(async (req, res) => {
  const { name, email, age, gender, concerns, emergencyContact } = req.body;

  // Check if patient with email already exists (single query)
  const existingPatientQuery = await db
    .collection('users')
    .where('role', '==', 'patient')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!existingPatientQuery.empty) {
    res.status(400);
    throw new Error('Patient with this email already exists');
  }

  const patientData = {
    name,
    email,
    age: age || null,
    gender: gender || null,
    concerns: concerns || null,
    emergencyContact: emergencyContact || null,
    role: 'patient',
    isProfileComplete: true,
    uid: null, // Will be set when user authenticates
    assigned_therapist: null, // Custom field for admin assignment
    flags: [], // Custom field for flagging
    documents: [], // Custom field for document management
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const docRef = await db.collection('users').add(patientData);
  const createdPatient = await docRef.get();

  // Clear relevant cache
  clearCache('patients');

  res.status(201).json({
    id: createdPatient.id,
    ...createdPatient.data(),
  });
});

// @desc    Get all patients with optimized pagination
// @route   GET /api/patients
// @access  Private/Admin
const getPatients = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 10;
  const lastDocId = req.query.lastDocId; // For cursor-based pagination
  const keyword = req.query.keyword;
  const profileComplete = req.query.profileComplete; // Filter by profile completion
  const therapistId = req.query.therapistId; // Filter by assigned therapist

  // Build cache key
  const cacheKey = `patients_${pageSize}_${lastDocId || 'start'}_${
    keyword || ''
  }_${profileComplete || ''}_${therapistId || ''}`;

  const fetchPatients = async () => {
    let query = db.collection('users').where('role', '==', 'patient');

    // Add filters to reduce data fetched
    if (profileComplete !== undefined && profileComplete !== '') {
      const isComplete = profileComplete === 'true';
      query = query.where('isProfileComplete', '==', isComplete);
    }
    if (therapistId) {
      query = query.where('assigned_therapist', '==', therapistId);
    }

    // Order by createdAt for consistent pagination
    query = query.orderBy('createdAt', 'desc');

    // Cursor-based pagination (more efficient than offset)
    if (lastDocId) {
      const lastDoc = await db.collection('users').doc(lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(pageSize + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    const patients = [];
    let hasMore = false;

    if (snapshot.size > pageSize) {
      hasMore = true;
      snapshot.docs.pop(); // Remove the extra document
    }

    // Process patients with minimal therapist data fetching
    const therapistIds = new Set();
    const patientData = [];

    snapshot.docs.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };

      // Map fields to maintain API compatibility
      data.full_name = data.name;
      data.dob = data.age
        ? new Date(new Date().getFullYear() - data.age, 0, 1).toISOString()
        : null;
      data.phone = null; // Not in current structure
      data.notes = []; // Not in current structure, using concerns instead
      data.created_at = data.createdAt;
      data.updated_at = data.updatedAt;

      patientData.push(data);
      if (data.assigned_therapist) {
        therapistIds.add(data.assigned_therapist);
      }
    });

    // Batch fetch therapist data if needed (single query for all therapists)
    const therapistMap = {};
    if (therapistIds.size > 0) {
      const therapistQuery = await db
        .collection('users')
        .where('role', '==', 'professional')
        .where(db.FieldPath.documentId(), 'in', Array.from(therapistIds))
        .select('name', 'email') // Only fetch needed fields
        .get();

      therapistQuery.docs.forEach((doc) => {
        const therapistData = doc.data();
        therapistMap[doc.id] = {
          id: doc.id,
          full_name: therapistData.name,
          email: therapistData.email,
        };
      });
    }

    // Attach therapist info to patients
    patientData.forEach((patient) => {
      if (
        patient.assigned_therapist &&
        therapistMap[patient.assigned_therapist]
      ) {
        patient.assigned_therapist_info =
          therapistMap[patient.assigned_therapist];
      }
    });

    // Client-side filtering for keyword search (consider Algolia for production)
    let filteredPatients = patientData;
    if (keyword) {
      const searchTerm = keyword.toLowerCase();
      filteredPatients = patientData.filter(
        (patient) =>
          patient.name.toLowerCase().includes(searchTerm) ||
          patient.email.toLowerCase().includes(searchTerm)
      );
    }

    return {
      patients: filteredPatients,
      hasMore,
      lastDocId:
        patientData.length > 0 ? patientData[patientData.length - 1].id : null,
      total: filteredPatients.length,
    };
  };

  const result = await getCachedData(cacheKey, fetchPatients);
  res.json(result);
});

// @desc    Get patient by ID with minimal data fetching
// @route   GET /api/patients/:id
// @access  Private/Admin
const getPatientById = asyncHandler(async (req, res) => {
  const cacheKey = `patient_${req.params.id}`;

  const fetchPatient = async () => {
    const patientDoc = await db.collection('users').doc(req.params.id).get();

    if (!patientDoc.exists) {
      throw new Error('Patient not found');
    }

    const patientData = { id: patientDoc.id, ...patientDoc.data() };

    // Verify it's a patient
    if (patientData.role !== 'patient') {
      throw new Error('Patient not found');
    }

    // Map fields for API compatibility
    patientData.full_name = patientData.name;
    patientData.dob = patientData.age
      ? new Date(new Date().getFullYear() - patientData.age, 0, 1).toISOString()
      : null;
    patientData.phone = null;
    patientData.notes = patientData.concerns ? [patientData.concerns] : [];
    patientData.created_at = patientData.createdAt;
    patientData.updated_at = patientData.updatedAt;

    // Fetch therapist data only if assigned
    if (patientData.assigned_therapist) {
      try {
        const therapistDoc = await db
          .collection('users')
          .doc(patientData.assigned_therapist)
          .select('name', 'email') // Only needed fields
          .get();

        if (therapistDoc.exists) {
          const therapistData = therapistDoc.data();
          patientData.assigned_therapist_info = {
            id: therapistDoc.id,
            full_name: therapistData.name,
            email: therapistData.email,
          };
        }
      } catch (error) {
        console.error('Error fetching therapist:', error);
      }
    }

    return patientData;
  };

  try {
    const patient = await getCachedData(cacheKey, fetchPatient);
    res.json(patient);
  } catch (error) {
    res.status(404);
    throw new Error(error.message);
  }
});

// @desc    Update patient with optimized writes
// @route   PUT /api/patients/:id
// @access  Private/Admin
const updatePatient = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    age,
    gender,
    concerns,
    emergencyContact,
    assigned_therapist,
    flags,
    documents,
  } = req.body;

  const patientRef = db.collection('users').doc(req.params.id);

  // Use a transaction to ensure data consistency
  const result = await db.runTransaction(async (transaction) => {
    const patientDoc = await transaction.get(patientRef);

    if (!patientDoc.exists || patientDoc.data().role !== 'patient') {
      throw new Error('Patient not found');
    }

    // Only update fields that have changed
    const currentData = patientDoc.data();
    const updateData = { updatedAt: new Date().toISOString() };

    if (name !== undefined && name !== currentData.name) updateData.name = name;
    if (email !== undefined && email !== currentData.email)
      updateData.email = email;
    if (age !== undefined && age !== currentData.age) updateData.age = age;
    if (gender !== undefined && gender !== currentData.gender)
      updateData.gender = gender;
    if (concerns !== undefined && concerns !== currentData.concerns)
      updateData.concerns = concerns;
    if (
      emergencyContact !== undefined &&
      emergencyContact !== currentData.emergencyContact
    )
      updateData.emergencyContact = emergencyContact;

    // Admin-only fields
    if (assigned_therapist !== undefined)
      updateData.assigned_therapist = assigned_therapist;
    if (flags !== undefined) updateData.flags = flags;
    if (documents !== undefined) updateData.documents = documents;

    // Only perform update if there are changes
    if (Object.keys(updateData).length > 1) {
      // More than just updatedAt
      transaction.update(patientRef, updateData);
    }

    // Return API-compatible format
    const resultData = { ...currentData, ...updateData };
    resultData.full_name = resultData.name;
    resultData.created_at = resultData.createdAt;
    resultData.updated_at = resultData.updatedAt;

    return { id: patientDoc.id, ...resultData };
  });

  // Clear cache
  clearCache(`patient_${req.params.id}`);
  clearCache('patients');

  res.json(result);
});

// @desc    Delete patient with cleanup
// @route   DELETE /api/patients/:id
// @access  Private/Admin
const deletePatient = asyncHandler(async (req, res) => {
  const patientRef = db.collection('users').doc(req.params.id);

  const result = await db.runTransaction(async (transaction) => {
    const patientDoc = await transaction.get(patientRef);

    if (!patientDoc.exists || patientDoc.data().role !== 'patient') {
      throw new Error('Patient not found');
    }

    // Delete the patient
    transaction.delete(patientRef);

    return true;
  });

  // Clear cache
  clearCache(`patient_${req.params.id}`);
  clearCache('patients');

  res.json({ message: 'Patient removed' });
});

// @desc    Assign therapist to patient (optimized)
// @route   PUT /api/patients/:id/assign-therapist
// @access  Private/Admin
const assignTherapistToPatient = asyncHandler(async (req, res) => {
  const { therapistId } = req.body;

  const result = await db.runTransaction(async (transaction) => {
    const patientRef = db.collection('users').doc(req.params.id);
    const patientDoc = await transaction.get(patientRef);

    if (!patientDoc.exists || patientDoc.data().role !== 'patient') {
      throw new Error('Patient not found');
    }

    // Verify therapist exists (single read)
    const therapistRef = db.collection('users').doc(therapistId);
    const therapistDoc = await transaction.get(therapistRef);

    if (!therapistDoc.exists || therapistDoc.data().role !== 'professional') {
      throw new Error('Invalid therapist ID');
    }

    // Update patient
    transaction.update(patientRef, {
      assigned_therapist: therapistId,
      updatedAt: new Date().toISOString(),
    });

    const resultData = {
      ...patientDoc.data(),
      assigned_therapist: therapistId,
    };
    resultData.full_name = resultData.name;
    resultData.created_at = resultData.createdAt;
    resultData.updated_at = new Date().toISOString();

    return { id: patientDoc.id, ...resultData };
  });

  // Clear cache
  clearCache(`patient_${req.params.id}`);
  clearCache('patients');

  res.json(result);
});

// @desc    Flag patient (optimized)
// @route   PUT /api/patients/:id/flag
// @access  Private/Admin
const flagPatient = asyncHandler(async (req, res) => {
  const { flag } = req.body;

  const result = await db.runTransaction(async (transaction) => {
    const patientRef = db.collection('users').doc(req.params.id);
    const patientDoc = await transaction.get(patientRef);

    if (!patientDoc.exists || patientDoc.data().role !== 'patient') {
      throw new Error('Patient not found');
    }

    const currentFlags = patientDoc.data().flags || [];
    if (!currentFlags.includes(flag)) {
      transaction.update(patientRef, {
        flags: [...currentFlags, flag],
        updatedAt: new Date().toISOString(),
      });
    }

    const resultData = { ...patientDoc.data(), flags: [...currentFlags, flag] };
    resultData.full_name = resultData.name;
    resultData.created_at = resultData.createdAt;
    resultData.updated_at = new Date().toISOString();

    return { id: patientDoc.id, ...resultData };
  });

  // Clear cache
  clearCache(`patient_${req.params.id}`);
  clearCache('patients');

  res.json(result);
});

// @desc    Upload document for patient (optimized)
// @route   PUT /api/patients/:id/documents
// @access  Private/Admin
const uploadPatientDocument = asyncHandler(async (req, res) => {
  const { documentUrl } = req.body;

  const result = await db.runTransaction(async (transaction) => {
    const patientRef = db.collection('users').doc(req.params.id);
    const patientDoc = await transaction.get(patientRef);

    if (!patientDoc.exists || patientDoc.data().role !== 'patient') {
      throw new Error('Patient not found');
    }

    const currentDocuments = patientDoc.data().documents || [];
    transaction.update(patientRef, {
      documents: [...currentDocuments, documentUrl],
      updatedAt: new Date().toISOString(),
    });

    const resultData = {
      ...patientDoc.data(),
      documents: [...currentDocuments, documentUrl],
    };
    resultData.full_name = resultData.name;
    resultData.created_at = resultData.createdAt;
    resultData.updated_at = new Date().toISOString();

    return { id: patientDoc.id, ...resultData };
  });

  // Clear cache
  clearCache(`patient_${req.params.id}`);
  clearCache('patients');

  res.json(result);
});

// @desc    Get patients summary (minimal data for dashboards)
// @route   GET /api/patients/summary
// @access  Private/Admin
const getPatientsSummary = asyncHandler(async (req, res) => {
  const cacheKey = 'patients_summary';

  const fetchSummary = async () => {
    // Use aggregation-like queries to get counts efficiently
    const [totalQuery, completeQuery, flaggedQuery] = await Promise.all([
      db.collection('users').where('role', '==', 'patient').get(),
      db
        .collection('users')
        .where('role', '==', 'patient')
        .where('isProfileComplete', '==', true)
        .get(),
      db
        .collection('users')
        .where('role', '==', 'patient')
        .where('flags', '!=', [])
        .get(),
    ]);

    return {
      total: totalQuery.size,
      complete: completeQuery.size,
      flagged: flaggedQuery.size,
      incomplete: totalQuery.size - completeQuery.size,
      // Map to existing API structure for backward compatibility
      active: completeQuery.size,
      inactive: totalQuery.size - completeQuery.size,
    };
  };

  const summary = await getCachedData(cacheKey, fetchSummary, 10 * 60 * 1000); // Cache for 10 minutes
  res.json(summary);
});

// @desc    Batch update patients
// @route   PUT /api/patients/batch-update
// @access  Private/Admin
const batchUpdatePatients = asyncHandler(async (req, res) => {
  const { patientIds, updateData } = req.body;

  if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
    res.status(400);
    throw new Error('Patient IDs array is required');
  }

  const batch = db.batch();
  const timestamp = new Date().toISOString();

  for (const patientId of patientIds) {
    const patientRef = db.collection('users').doc(patientId);
    batch.update(patientRef, {
      ...updateData,
      updatedAt: timestamp,
    });
  }

  await batch.commit();

  // Clear cache
  clearCache('patients');

  res.json({
    message: `Successfully updated ${patientIds.length} patients`,
    updatedCount: patientIds.length,
  });
});

// @desc    Search patients
// @route   GET /api/patients/search
// @access  Private/Admin
const searchPatients = asyncHandler(async (req, res) => {
  const {
    searchTerm,
    filters = {},
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 20,
  } = req.query;

  let query = db.collection('users').where('role', '==', 'patient');

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (key === 'isProfileComplete') {
        query = query.where(key, '==', value === 'true');
      } else if (key === 'hasFlags') {
        if (value === 'true') {
          query = query.where('flags', '!=', null);
        }
      } else {
        query = query.where(key, '==', value);
      }
    }
  });

  // Add sorting
  query = query.orderBy(sortBy, sortOrder);

  // Add pagination
  const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
  if (offset > 0) {
    query = query.offset(offset);
  }
  query = query.limit(Number.parseInt(limit));

  const snapshot = await query.get();
  let patients = [];

  snapshot.docs.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    // Map fields for compatibility
    data.full_name = data.name;
    data.created_at = data.createdAt;
    data.updated_at = data.updatedAt;
    patients.push(data);
  });

  // Client-side search if search term provided
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    patients = patients.filter(
      (patient) =>
        patient.name?.toLowerCase().includes(term) ||
        patient.email?.toLowerCase().includes(term) ||
        patient.concerns?.toLowerCase().includes(term)
    );
  }

  res.json({
    patients,
    pagination: {
      page: Number.parseInt(page),
      limit: Number.parseInt(limit),
      total: patients.length,
    },
  });
});

// @desc    Get patient analytics
// @route   GET /api/patients/analytics
// @access  Private/Admin
const getPatientAnalytics = asyncHandler(async (req, res) => {
  const cacheKey = 'patients_analytics';

  const fetchAnalytics = async () => {
    const patientsQuery = db.collection('users').where('role', '==', 'patient');
    const snapshot = await patientsQuery.get();

    const analytics = {
      totalPatients: 0,
      profileCompletion: { complete: 0, incomplete: 0 },
      genderDistribution: {},
      ageGroups: {},
      flaggedPatients: 0,
      assignedTherapists: 0,
      recentRegistrations: 0,
    };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    snapshot.forEach((doc) => {
      const data = doc.data();
      analytics.totalPatients++;

      // Profile completion
      if (data.isProfileComplete) {
        analytics.profileCompletion.complete++;
      } else {
        analytics.profileCompletion.incomplete++;
      }

      // Gender distribution
      const gender = data.gender || 'Not specified';
      analytics.genderDistribution[gender] =
        (analytics.genderDistribution[gender] || 0) + 1;

      // Age groups
      if (data.age) {
        const ageGroup =
          data.age < 18
            ? 'Under 18'
            : data.age < 30
            ? '18-29'
            : data.age < 50
            ? '30-49'
            : data.age < 65
            ? '50-64'
            : '65+';
        analytics.ageGroups[ageGroup] =
          (analytics.ageGroups[ageGroup] || 0) + 1;
      }

      // Flagged patients
      if (data.flags && data.flags.length > 0) {
        analytics.flaggedPatients++;
      }

      // Assigned therapists
      if (data.assigned_therapist) {
        analytics.assignedTherapists++;
      }

      // Recent registrations
      if (data.createdAt && new Date(data.createdAt) > thirtyDaysAgo) {
        analytics.recentRegistrations++;
      }
    });

    return analytics;
  };

  const analytics = await getCachedData(
    cacheKey,
    fetchAnalytics,
    15 * 60 * 1000
  ); // Cache for 15 minutes
  res.json(analytics);
});

export {
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
};
