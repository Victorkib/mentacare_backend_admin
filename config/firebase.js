import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' with { type: 'json' };

// Initialize Firebase normally for production
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Connect to emulator in development
if (process.env.NODE_ENV === 'development') {
  // This is the key difference for Admin SDK
  db.settings({
    host: 'localhost:8080',  // Emulator host
    ssl: false,              // Disable SSL for emulator
    projectId: 'mentacare-kenya' // Your actual project ID
  });
  console.log('🔥 Firestore emulator connected');
}

export { db };