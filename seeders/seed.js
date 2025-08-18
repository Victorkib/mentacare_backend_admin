import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import Patient from '../models/Patient.js';
import Therapist from '../models/Therapist.js';
import Session from '../models/Session.js';
import connectDB from '../config/db.js';

dotenv.config();
connectDB();

const seedData = async () => {
  try {
    // Clear existing data
    await Admin.deleteMany();
    await Patient.deleteMany();
    await Therapist.deleteMany();
    await Session.deleteMany();

    console.log('Data cleared!');

    // Create Admins
    const superAdminPassword = await bcrypt.hash('superadmin123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);

    const admins = await Admin.insertMany([
      {
        name: 'Super Admin',
        email: 'qinalexander56@gmail.com',
        password: superAdminPassword,
        role: 'super_admin',
        permissions: ['manage_all'],
      },
      {
        name: 'Regular Admin',
        email: 'admin@example.com',
        password: adminPassword,
        role: 'admin',
        permissions: [
          'manage_patients',
          'manage_therapists',
          'manage_sessions',
        ],
      },
    ]);

    const superAdmin = admins[0];
    const regularAdmin = admins[1];
    console.log('Admins seeded!');

    // Create Therapists
    const therapists = await Therapist.insertMany([
      {
        full_name: 'Dr. Alice Smith',
        email: 'alice.smith@example.com',
        specialty: 'Cognitive Behavioral Therapy',
        documents: ['/docs/alice_cv.pdf'],
      },
      {
        full_name: 'Dr. Bob Johnson',
        email: 'bob.johnson@example.com',
        specialty: 'Family Therapy',
        documents: ['/docs/bob_license.pdf'],
      },
    ]);

    const therapist1 = therapists[0];
    const therapist2 = therapists[1];
    console.log('Therapists seeded!');

    // Create Patients
    const patients = await Patient.insertMany([
      {
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '123-456-7890',
        gender: 'Male',
        dob: new Date('1990-05-15'),
        notes: 'Initial assessment notes.',
        flags: ['High Risk'],
        documents: ['/docs/john_intake.pdf'],
        assigned_therapist: therapist1._id,
      },
      {
        full_name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '098-765-4321',
        gender: 'Female',
        dob: new Date('1985-11-20'),
        notes: 'Follow-up required.',
        flags: [],
        documents: [],
        assigned_therapist: therapist2._id,
      },
    ]);

    const patient1 = patients[0];
    const patient2 = patients[1];
    console.log('Patients seeded!');

    // Update therapists with assigned patients
    therapist1.assigned_patients.push(patient1._id);
    await therapist1.save();

    therapist2.assigned_patients.push(patient2._id);
    await therapist2.save();
    console.log('Therapists updated with assigned patients!');

    // Create Sessions
    await Session.insertMany([
      {
        patient: patient1._id,
        therapist: therapist1._id,
        datetime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        duration: 60,
        notes: 'First session scheduled.',
        status: 'upcoming',
      },
      {
        patient: patient2._id,
        therapist: therapist2._id,
        datetime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        duration: 45,
        notes: 'Session completed successfully.',
        status: 'completed',
        attendance_marked: true,
      },
      {
        patient: patient1._id,
        therapist: therapist1._id,
        datetime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        duration: 60,
        notes: 'Patient did not attend.',
        status: 'missed',
        attendance_marked: false,
      },
    ]);
    console.log('Sessions seeded!');

    console.log('Data seeding complete!');
    process.exit();
  } catch (error) {
    console.error(`Error seeding data: ${error.message}`);
    process.exit(1);
  }
};

seedData();
