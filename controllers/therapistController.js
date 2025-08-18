import asyncHandler from '../middleware/asyncHandler.js';
import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to get cached data
const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

// Helper function to set cached data
const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Helper function to transform therapist data
const transformTherapistData = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    uid: data.uid,
    name: data.name,
    email: data.email,
    title: data.title || '',
    specialization: data.specialization,
    bio: data.bio || '',
    experience: data.experience || 0,
    isVerified: data.isVerified || false,
    isProfileComplete: data.isProfileComplete || false,
    role: data.role,
    availability: data.availability || {},
    education: data.education || [],
    certifications: data.certifications || [],
    notificationSettings: data.notificationSettings || {},
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastAvailabilityUpdate: data.lastAvailabilityUpdate,
  };
};

// Get all therapists with advanced filtering and pagination
const getTherapists = asyncHandler(async (req, res) => {
  const {
    pageSize = 15,
    lastDocId = null,
    keyword = '',
    specialization = '',
    isVerified = '',
    isProfileComplete = '',
    experience = '',
  } = req.query;

  const cacheKey = `therapists_${JSON.stringify(req.query)}`;
  const cachedResult = getCachedData(cacheKey);

  if (cachedResult && !lastDocId) {
    return res.json({
      success: true,
      data: cachedResult,
    });
  }

  try {
    // Start with base query for professionals only
    let query = db.collection('users').where('role', '==', 'professional');

    // Apply filters to reduce Firebase reads
    if (specialization && specialization !== 'all') {
      query = query.where('specialization', '==', specialization);
    }

    if (isVerified !== '' && isVerified !== 'all') {
      query = query.where('isVerified', '==', isVerified === 'true');
    }

    if (isProfileComplete !== '' && isProfileComplete !== 'all') {
      query = query.where(
        'isProfileComplete',
        '==',
        isProfileComplete === 'true'
      );
    }

    // Order by updatedAt for most recent first
    query = query.orderBy('updatedAt', 'desc');

    // Apply pagination
    if (lastDocId) {
      const lastDoc = await db.collection('users').doc(lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(Number.parseInt(pageSize) + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    let therapists = [];
    let hasMore = false;

    if (snapshot.docs.length > Number.parseInt(pageSize)) {
      hasMore = true;
      snapshot.docs.pop(); // Remove the extra document
    }

    // Transform therapist data
    therapists = snapshot.docs.map((doc) => transformTherapistData(doc));

    // Client-side filtering for keyword search and experience to avoid complex Firestore queries
    if (keyword) {
      const keywordLower = keyword.toLowerCase();
      therapists = therapists.filter(
        (therapist) =>
          therapist.name?.toLowerCase().includes(keywordLower) ||
          therapist.email?.toLowerCase().includes(keywordLower) ||
          therapist.specialization?.toLowerCase().includes(keywordLower) ||
          therapist.title?.toLowerCase().includes(keywordLower) ||
          therapist.bio?.toLowerCase().includes(keywordLower)
      );
    }

    if (experience && experience !== 'all') {
      const expValue = Number.parseInt(experience);
      therapists = therapists.filter((therapist) => {
        switch (experience) {
          case '0-2':
            return therapist.experience >= 0 && therapist.experience <= 2;
          case '3-5':
            return therapist.experience >= 3 && therapist.experience <= 5;
          case '6-10':
            return therapist.experience >= 6 && therapist.experience <= 10;
          case '10+':
            return therapist.experience > 10;
          default:
            return true;
        }
      });
    }

    // Get assigned patients count efficiently using a single query
    const therapistIds = therapists.map((t) => t.uid);
    const patientCounts = {};

    if (therapistIds.length > 0) {
      // Use 'in' query to get all assigned patients in one go (max 10 therapists at a time)
      const chunks = [];
      for (let i = 0; i < therapistIds.length; i += 10) {
        chunks.push(therapistIds.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const patientsQuery = db
          .collection('users')
          .where('role', '==', 'patient')
          .where('assignedTherapist', 'in', chunk)
          .select('assignedTherapist'); // Only select the field we need

        const patientsSnapshot = await patientsQuery.get();

        // Count patients per therapist
        patientsSnapshot.docs.forEach((doc) => {
          const assignedTherapist = doc.data().assignedTherapist;
          if (assignedTherapist) {
            patientCounts[assignedTherapist] =
              (patientCounts[assignedTherapist] || 0) + 1;
          }
        });
      }
    }

    // Add patient counts to therapists
    therapists = therapists.map((therapist) => ({
      ...therapist,
      assignedPatientsCount: patientCounts[therapist.uid] || 0,
    }));

    const result = {
      therapists,
      hasMore,
      lastDocId:
        snapshot.docs.length > 0
          ? snapshot.docs[snapshot.docs.length - 1].id
          : null,
      total: therapists.length,
    };

    // Cache the result if it's the first page
    if (!lastDocId) {
      setCachedData(cacheKey, result);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch therapists',
      error: error.message,
    });
  }
});

// Get therapists summary with analytics
const getTherapistsSummary = asyncHandler(async (req, res) => {
  const cacheKey = 'therapists_summary';
  const cachedResult = getCachedData(cacheKey);

  if (cachedResult) {
    return res.json({
      success: true,
      data: cachedResult,
    });
  }

  try {
    // Get all therapists in one query
    const therapistsQuery = db
      .collection('users')
      .where('role', '==', 'professional')
      .select(
        'isVerified',
        'isProfileComplete',
        'experience',
        'uid',
        'specialization'
      );
    const therapistsSnapshot = await therapistsQuery.get();

    let total = 0;
    let verified = 0;
    let unverified = 0;
    let profileComplete = 0;
    let profileIncomplete = 0;
    let totalExperience = 0;
    const specializationCounts = {};
    const therapistUids = [];

    // Process therapists data
    therapistsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      total++;
      therapistUids.push(data.uid);

      if (data.isVerified) {
        verified++;
      } else {
        unverified++;
      }

      if (data.isProfileComplete) {
        profileComplete++;
      } else {
        profileIncomplete++;
      }

      totalExperience += data.experience || 0;

      // Count specializations
      const spec = data.specialization || 'Other';
      specializationCounts[spec] = (specializationCounts[spec] || 0) + 1;
    });

    // Get total patients assigned to therapists efficiently
    let totalPatients = 0;
    if (therapistUids.length > 0) {
      // Use 'in' query to get all assigned patients (max 10 therapists at a time)
      const chunks = [];
      for (let i = 0; i < therapistUids.length; i += 10) {
        chunks.push(therapistUids.slice(i, i + 10));
      }

      for (const chunk of chunks) {
        const patientsQuery = db
          .collection('users')
          .where('role', '==', 'patient')
          .where('assignedTherapist', 'in', chunk);

        const patientsSnapshot = await patientsQuery.get();
        totalPatients += patientsSnapshot.size;
      }
    }

    const summary = {
      total,
      verified,
      unverified,
      profileComplete,
      profileIncomplete,
      totalPatients,
      averagePatients:
        total > 0 ? Math.round((totalPatients / total) * 10) / 10 : 0,
      averageExperience:
        total > 0 ? Math.round((totalExperience / total) * 10) / 10 : 0,
      specializationBreakdown: specializationCounts,
    };

    setCachedData(cacheKey, summary);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching therapists summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch therapists summary',
      error: error.message,
    });
  }
});

// Get single therapist with detailed information
const getTherapistById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const therapistDoc = await db.collection('users').doc(id).get();

    if (!therapistDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    const therapistData = transformTherapistData(therapistDoc);

    // Verify it's a therapist
    if (therapistData.role !== 'professional') {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    // Get assigned patients information efficiently
    const patientsQuery = db
      .collection('users')
      .where('role', '==', 'patient')
      .where('assignedTherapist', '==', therapistData.uid)
      .select('name', 'email', 'createdAt', 'phone')
      .limit(20); // Limit to avoid large reads

    const patientsSnapshot = await patientsQuery.get();
    const assignedPatientsInfo = patientsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    therapistData.assignedPatientsCount = patientsSnapshot.size;
    therapistData.assignedPatientsInfo = assignedPatientsInfo;

    res.json({
      success: true,
      data: therapistData,
    });
  } catch (error) {
    console.error('Error fetching therapist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch therapist',
      error: error.message,
    });
  }
});

// Create therapist
const createTherapist = asyncHandler(async (req, res) => {
  const {
    uid,
    name,
    email,
    title,
    specialization,
    bio,
    experience,
    education,
    certifications,
    availability,
    notificationSettings,
  } = req.body;

  try {
    // Check if email already exists
    const existingUser = await db
      .collection('users')
      .where('email', '==', email)
      .get();
    if (!existingUser.empty) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
    }

    // Check if uid already exists
    if (uid) {
      const existingUid = await db
        .collection('users')
        .where('uid', '==', uid)
        .get();
      if (!existingUid.empty) {
        return res.status(400).json({
          success: false,
          message: 'UID already exists',
        });
      }
    }

    const therapistData = {
      uid: uid || `therapist_${Date.now()}`,
      name,
      email,
      title: title || '',
      specialization,
      bio: bio || '',
      experience: experience || 0,
      education: education || [],
      certifications: certifications || [],
      availability: availability || {},
      notificationSettings: notificationSettings || {
        appointments: true,
        email: true,
        marketing: false,
        messages: true,
        push: true,
        reminders: true,
        updates: true,
      },
      role: 'professional',
      isVerified: false,
      isProfileComplete: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAvailabilityUpdate: new Date().toISOString(),
    };

    const docRef = await db.collection('users').add(therapistData);
    const createdTherapist = await docRef.get();

    // Clear cache
    cache.clear();

    res.status(201).json({
      success: true,
      message: 'Therapist created successfully',
      data: transformTherapistData(createdTherapist),
    });
  } catch (error) {
    console.error('Error creating therapist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create therapist',
      error: error.message,
    });
  }
});

// Update therapist
const updateTherapist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  try {
    const therapistRef = db.collection('users').doc(id);
    const therapistDoc = await therapistRef.get();

    if (!therapistDoc.exists || therapistDoc.data().role !== 'professional') {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    // Remove undefined values and add timestamp
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    updateData.updatedAt = new Date().toISOString();

    // Update availability timestamp if availability is being updated
    if (updateData.availability) {
      updateData.lastAvailabilityUpdate = new Date().toISOString();
    }

    await therapistRef.update(updateData);

    const updatedDoc = await therapistRef.get();

    // Clear cache
    cache.clear();

    res.json({
      success: true,
      message: 'Therapist updated successfully',
      data: transformTherapistData(updatedDoc),
    });
  } catch (error) {
    console.error('Error updating therapist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update therapist',
      error: error.message,
    });
  }
});

// Delete therapist
const deleteTherapist = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const therapistRef = db.collection('users').doc(id);
    const therapistDoc = await therapistRef.get();

    if (!therapistDoc.exists || therapistDoc.data().role !== 'professional') {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    const therapistData = therapistDoc.data();

    // Check if therapist has assigned patients
    const patientsQuery = db
      .collection('users')
      .where('role', '==', 'patient')
      .where('assignedTherapist', '==', therapistData.uid);

    const patientsSnapshot = await patientsQuery.get();

    if (!patientsSnapshot.empty) {
      return res.status(400).json({
        success: false,
        message:
          'Cannot delete therapist with assigned patients. Please reassign patients first.',
        assignedPatientsCount: patientsSnapshot.size,
      });
    }

    await therapistRef.delete();

    // Clear cache
    cache.clear();

    res.json({
      success: true,
      message: 'Therapist deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting therapist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete therapist',
      error: error.message,
    });
  }
});

// Assign patients to therapist
const assignPatientsToTherapist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { patientIds } = req.body;

  try {
    const therapistRef = db.collection('users').doc(id);
    const therapistDoc = await therapistRef.get();

    if (!therapistDoc.exists || therapistDoc.data().role !== 'professional') {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    const therapistData = therapistDoc.data();

    // Use batch for efficient updates
    const batch = db.batch();

    // First, remove this therapist from all currently assigned patients
    const currentPatientsQuery = db
      .collection('users')
      .where('role', '==', 'patient')
      .where('assignedTherapist', '==', therapistData.uid);

    const currentPatientsSnapshot = await currentPatientsQuery.get();

    currentPatientsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        assignedTherapist: FieldValue.delete(),
        assignedTherapistInfo: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });
    });

    // Then assign new patients
    if (patientIds && patientIds.length > 0) {
      for (const patientId of patientIds) {
        const patientRef = db.collection('users').doc(patientId);
        batch.update(patientRef, {
          assignedTherapist: therapistData.uid,
          assignedTherapistInfo: {
            uid: therapistData.uid,
            name: therapistData.name,
            email: therapistData.email,
            title: therapistData.title,
            specialization: therapistData.specialization,
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Update therapist's updated timestamp
    batch.update(therapistRef, {
      updatedAt: new Date().toISOString(),
    });

    await batch.commit();

    // Clear cache
    cache.clear();

    res.json({
      success: true,
      message: `Successfully ${
        patientIds?.length ? 'assigned' : 'unassigned'
      } patients`,
      assignedCount: patientIds?.length || 0,
    });
  } catch (error) {
    console.error('Error assigning patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign patients',
      error: error.message,
    });
  }
});

// Update therapist availability
const updateTherapistAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { availability } = req.body;

  try {
    const therapistRef = db.collection('users').doc(id);
    const therapistDoc = await therapistRef.get();

    if (!therapistDoc.exists || therapistDoc.data().role !== 'professional') {
      return res.status(404).json({
        success: false,
        message: 'Therapist not found',
      });
    }

    await therapistRef.update({
      availability,
      lastAvailabilityUpdate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Clear cache
    cache.clear();

    res.json({
      success: true,
      message: 'Availability updated successfully',
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update availability',
      error: error.message,
    });
  }
});

// Batch update therapists
const batchUpdateTherapists = asyncHandler(async (req, res) => {
  const { therapistIds, updateData } = req.body;

  if (
    !therapistIds ||
    !Array.isArray(therapistIds) ||
    therapistIds.length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid therapist IDs provided',
    });
  }

  try {
    const batch = db.batch();

    // Remove undefined values and add timestamp
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    updateData.updatedAt = new Date().toISOString();

    therapistIds.forEach((therapistId) => {
      const therapistRef = db.collection('users').doc(therapistId);
      batch.update(therapistRef, updateData);
    });

    await batch.commit();

    // Clear cache
    cache.clear();

    res.json({
      success: true,
      message: `Successfully updated ${therapistIds.length} therapists`,
    });
  } catch (error) {
    console.error('Error batch updating therapists:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update therapists',
      error: error.message,
    });
  }
});

// Get therapist specializations (for filters)
const getTherapistSpecializations = asyncHandler(async (req, res) => {
  const cacheKey = 'therapist_specializations';
  const cachedResult = getCachedData(cacheKey);

  if (cachedResult) {
    return res.json({
      success: true,
      data: cachedResult,
    });
  }

  try {
    const therapistsQuery = db
      .collection('users')
      .where('role', '==', 'professional')
      .select('specialization');

    const snapshot = await therapistsQuery.get();
    const specializations = new Set();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.specialization) {
        specializations.add(data.specialization.trim());
      }
    });

    const result = Array.from(specializations).sort();
    setCachedData(cacheKey, result);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching specializations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specializations',
      error: error.message,
    });
  }
});

export {
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
};
