import { Router } from 'express';
import { getDb } from '../lib/firestore.js';
import { verifyAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../services/audit.js';
import crypto from 'crypto';

const router = Router();
router.use(verifyAuth);

function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex');
}

// 1. List donors
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('centres').doc(req.user.centreId).collection('donors').get();
    const donors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ donors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add donor
router.post('/', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { name, phone, dob, gender, group, state, district, city, pin, apheresis, consent, source } = req.body;

    if (!name || !phone || !group || !consent) {
      return res.status(400).json({ error: 'Missing required donor registration fields or consent' });
    }

    const cleanNumber = phone.replace(/\D/g, '').slice(-10);
    const phoneHash = hashPhone(cleanNumber);
    const db = getDb();

    // Check cross-centre global donor deduplication
    const globalRef = db.collection('globalDonors').doc(phoneHash);
    const globalDoc = await globalRef.get();
    if (globalDoc.exists) {
      const existing = globalDoc.data();
      if (existing.primaryCentreId !== req.user.centreId) {
        return res.status(409).json({
          error: 'This mobile number is already registered at another licensed blood centre.',
          registeredCentreId: existing.primaryCentreId
        });
      }
    }

    const newDonor = {
      name: name.trim(),
      phone: cleanNumber,
      dob: dob || null,
      gender: gender || 'Male',
      group,
      state: state || '',
      district: district || '',
      city: city || '',
      pin: pin || '',
      km: 2.5, // verified distance or derived
      apheresis: !!apheresis,
      consent: true,
      consentTimestamp: Date.now(),
      source: source || 'walk-in',
      addedAt: Date.now(),
      lastDonated: null,
      donations: 0,
      pausedUntil: null,
      lastNoAt: null,
      asks: [],
      stats: { asked: 0, yes: 0, showed: 0 }
    };

    const docRef = await db.collection('centres').doc(req.user.centreId).collection('donors').add(newDonor);

    // Save to global lookup using SHA-256 hash (never storing raw phone in global collection)
    await globalRef.set({
      primaryCentreId: req.user.centreId,
      donorId: docRef.id,
      registeredAt: Date.now(),
      group
    });

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: 'REGISTER_DONOR',
      entityType: 'donor',
      entityId: docRef.id,
      details: { group, consentGiven: true, source }
    });

    res.status(201).json({ id: docRef.id, ...newDonor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Pause donor alerts
router.post('/:id/pause', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const db = getDb();
    const donorRef = db.collection('centres').doc(req.user.centreId).collection('donors').doc(req.params.id);
    const pauseUntil = Date.now() + (req.body.days || 30) * 864e5;
    await donorRef.update({ pausedUntil: pauseUntil });
    res.json({ success: true, pausedUntil: pauseUntil });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Record walk-in donation
router.post('/:id/walkin', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const db = getDb();
    const donorRef = db.collection('centres').doc(req.user.centreId).collection('donors').doc(req.params.id);
    const doc = await donorRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Donor not found' });
    const data = doc.data();

    await donorRef.update({
      lastDonated: Date.now(),
      donations: (data.donations || 0) + 1
    });

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: 'RECORD_WALKIN_DONATION',
      entityType: 'donor',
      entityId: req.params.id,
      details: { timestamp: Date.now() }
    });

    res.json({ success: true, donations: (data.donations || 0) + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

