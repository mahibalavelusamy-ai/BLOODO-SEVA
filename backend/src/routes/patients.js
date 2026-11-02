import { Router } from 'express';
import { getDb } from '../lib/firestore.js';
import { verifyAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(verifyAuth);

// 1. List patients
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('centres').doc(req.user.centreId).collection('patients').get();
    const patients = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ patients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add patient
router.post('/', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { name, age, condition, group, interval, units, nextAt, guardian, guardianPhone, leuco, phenotype, consent } = req.body;

    if (!name || !group || !nextAt || !consent) {
      return res.status(400).json({ error: 'Missing required patient fields or consent' });
    }

    const db = getDb();
    const centreRef = db.collection('centres').doc(req.user.centreId);

    // Fetch compatible donors of same group to seed the Care Circle
    const donorsSnap = await centreRef.collection('donors').where('group', '==', group).where('consent', '==', true).get();
    const donors = donorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Select up to 6 donors with least other circle commitments
    const circle = donors.slice(0, 6).map(d => d.id);

    const newPatient = {
      name: name.trim(),
      age: Number(age) || 0,
      condition: condition || 'Thalassemia major',
      group,
      interval: Number(interval) || 21,
      units: Number(units) || 1,
      nextAt: Number(nextAt),
      guardian: guardian || 'Family',
      guardianPhone: guardianPhone ? guardianPhone.replace(/\D/g, '') : '',
      leuco: !!leuco,
      phenotype: !!phenotype,
      circle,
      rot: 0,
      active: true,
      addedAt: Date.now(),
      history: []
    };

    const docRef = await centreRef.collection('patients').add(newPatient);

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: 'ADD_PATIENT_CARE_CIRCLE',
      entityType: 'patient',
      entityId: docRef.id,
      details: { condition, group, circleSize: circle.length }
    });

    res.status(201).json({ id: docRef.id, ...newPatient });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add donor to circle
router.post('/:id/circle/add', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { donorId } = req.body;
    const db = getDb();
    const patientRef = db.collection('centres').doc(req.user.centreId).collection('patients').doc(req.params.id);
    const doc = await patientRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Patient not found' });

    const circle = doc.data().circle || [];
    if (!circle.includes(donorId)) {
      circle.push(donorId);
      await patientRef.update({ circle });
    }
    res.json({ success: true, circle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Remove donor from circle
router.post('/:id/circle/remove', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { donorId } = req.body;
    const db = getDb();
    const patientRef = db.collection('centres').doc(req.user.centreId).collection('patients').doc(req.params.id);
    const doc = await patientRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Patient not found' });

    let circle = doc.data().circle || [];
    circle = circle.filter(id => id !== donorId);
    await patientRef.update({ circle });
    res.json({ success: true, circle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
