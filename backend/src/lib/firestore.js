import admin from 'firebase-admin';

let db = null;
let auth = null;

export function initFirebase() {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin initialized with service account.');
      } catch (err) {
        console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT, initializing default app:', err.message);
        admin.initializeApp();
      }
    } else {
      admin.initializeApp();
      console.log('Firebase Admin initialized with default credentials.');
    }
  }

  db = admin.firestore();
  auth = admin.auth();
  return { db, auth };
}

export function getDb() {
  if (!db) initFirebase();
  return db;
}

export function getAuth() {
  if (!auth) initFirebase();
  return auth;
}

