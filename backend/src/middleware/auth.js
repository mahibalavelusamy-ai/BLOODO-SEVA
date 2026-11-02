import { getAuth, getDb } from '../lib/firestore.js';

export async function verifyAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    // In local development or testing mode, allow dev fallback header
    if (process.env.ALLOW_DEV_AUTH === 'true' && req.headers['x-dev-centre-id']) {
      req.user = {
        uid: req.headers['x-dev-user-id'] || 'dev_staff_1',
        email: 'staff@ggh.internal',
        centreId: req.headers['x-dev-centre-id'] || 'ggh_chennai',
        role: req.headers['x-dev-role'] || 'staff'
      };
      return next();
    }
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;

    // Resolve centreId from custom claims or user profile in Firestore
    if (!req.user.centreId) {
      const db = getDb();
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists) {
        req.user.centreId = userDoc.data().centreId;
        req.user.role = userDoc.data().role || 'staff';
      }
    }

    if (!req.user.centreId) {
      return res.status(403).json({ error: 'User is not associated with any licensed blood centre' });
    }

    next();
  } catch (err) {
    console.error('Auth verification error:', err.message);
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

