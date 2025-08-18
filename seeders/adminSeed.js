import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
import connectDB from '../config/db.js';

dotenv.config();
connectDB();

const seedAdmins = async () => {
  try {
    await Admin.deleteMany();
    console.log('Admin data cleared!');

    // Create Super Admin
    const superAdmin = new Admin({
      name: 'Super Admin',
      email: 'qinalexander56@gmail.com',
      password: 'superadmin123', // Will be hashed by pre-save hook
      role: 'super_admin',
      permissions: ['manage_all'],
    });

    // Create Regular Admin
    const regularAdmin = new Admin({
      name: 'Regular Admin',
      email: 'admin@example.com',
      password: 'admin123', // Will be hashed by pre-save hook
      role: 'admin',
      permissions: ['manage_patients', 'manage_therapists', 'manage_sessions'],
    });

    // Save both
    await superAdmin.save();
    await regularAdmin.save();

    console.log('Admin data seeded successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error seeding admins: ${error.message}`);
    process.exit(1);
  }
};

seedAdmins();
