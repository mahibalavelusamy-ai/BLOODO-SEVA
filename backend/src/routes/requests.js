import { Router } from 'express';
import { getDb } from '../lib/firestore.js';
import { verifyAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { dispatchWave } from '../services/waveEngine.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(verifyAuth);

// 1. List centre requests
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('centres').doc(req.user.centreId).collection('requests')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create new urgent or planned request
router.post('/', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const db = getDb();
    const { group, comp, units, neededBy, priority = 'urgent', ref = '', notes = '', kind = 'urgent', patientId = null, transfusionAt = null, loc = null } = req.body;

    if (!group || !comp || !units || !neededBy) {
      return res.status(400).json({ error: 'Missing required request parameters (group, comp, units, neededBy)' });
    }

    const centreRef = db.collection('centres').doc(req.user.centreId);
    const centreDoc = await centreRef.get();
    const centreData = centreDoc.data() || {};
    const rules = centreData.rules || { radiusKm: 15, maxWaves: 4, perUnit: 4 };

    const newRequest = {
      group,
      comp,
      units: Number(units),
      neededBy: Number(neededBy),
      priority,
      ref,
      notes,
      kind,
      patientId,
      transfusionAt: transfusionAt ? Number(transfusionAt) : null,
      loc: loc || {
        name: centreData.name || 'Blood Centre',
        state: centreData.state || '',
        district: centreData.district || '',
        area: centreData.area || '',
        pin: centreData.pin || ''
      },
      status: 'finding',
      wave: 0,
      waveDeadline: 0,
      radius: rules.radiusKm || 15,
      invites: [],
      skipped: {},
      log: [{ at: Date.now(), t: 'Request created' }],
      createdAt: Date.now(),
      createdBy: req.user.uid
    };

    const docRef = await centreRef.collection('requests').add(newRequest);

    // Fetch centre donors for dispatching wave 1
    const donorsSnap = await centreRef.collection('donors').get();
    const donors = donorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let patientCircle = [];
    if (patientId) {
      const patientDoc = await centreRef.collection('patients').doc(patientId).get();
      if (patientDoc.exists) patientCircle = patientDoc.data().circle || [];
    }

    const waveResult = await dispatchWave({
      centreId: req.user.centreId,
      request: { ...newRequest, id: docRef.id },
      donors,
      rules,
      centreName: centreData.name || 'Blood Centre',
      patientCircle
    });

    await docRef.update({
      status: waveResult.status,
      wave: waveResult.wave,
      waveDeadline: waveResult.waveDeadline,
      invites: waveResult.invites,
      skipped: waveResult.skipped,
      log: [...newRequest.log, { at: Date.now(), t: waveResult.logMessage }]
    });

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: 'CREATE_REQUEST',
      entityType: 'request',
      entityId: docRef.id,
      details: { group, comp, units, priority }
    });

    res.status(201).json({ id: docRef.id, ...newRequest, ...waveResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Trigger next wave
router.post('/:id/waves', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const db = getDb();
    const centreRef = db.collection('centres').doc(req.user.centreId);
    const reqDoc = await centreRef.collection('requests').doc(req.params.id).get();

    if (!reqDoc.exists) return res.status(404).json({ error: 'Request not found' });
    const request = { id: reqDoc.id, ...reqDoc.data() };

    const centreDoc = await centreRef.get();
    const centreData = centreDoc.data() || {};
    const rules = centreData.rules || {};

    const donorsSnap = await centreRef.collection('donors').get();
    const donors = donorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let patientCircle = [];
    if (request.patientId) {
      const pDoc = await centreRef.collection('patients').doc(request.patientId).get();
      if (pDoc.exists) patientCircle = pDoc.data().circle || [];
    }

    const waveResult = await dispatchWave({
      centreId: req.user.centreId,
      request,
      donors,
      rules,
      centreName: centreData.name || 'Blood Centre',
      patientCircle
    });

    await reqDoc.ref.update({
      status: waveResult.status,
      wave: waveResult.wave,
      waveDeadline: waveResult.waveDeadline,
      invites: waveResult.invites,
      skipped: waveResult.skipped,
      log: [...(request.log || []), { at: Date.now(), t: waveResult.logMessage }]
    });

    res.json({ success: true, ...waveResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Staff records arrival, donation, noshow, or deferral
router.post('/:id/action', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { donorId, action } = req.body;
    if (!donorId || !action) {
      return res.status(400).json({ error: 'Missing donorId or action' });
    }

    const db = getDb();
    const centreRef = db.collection('centres').doc(req.user.centreId);
    const reqDoc = await centreRef.collection('requests').doc(req.params.id).get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'Request not found' });

    const request = reqDoc.data();
    const invite = (request.invites || []).find(v => v.donorId === donorId);
    if (!invite) return res.status(404).json({ error: 'Donor not invited to this request' });

    invite.status = action; // 'arrived' | 'donated' | 'deferred' | 'noshow'
    invite.at = Date.now();

    const donorDoc = await centreRef.collection('donors').doc(donorId).get();
    const donorData = donorDoc.data() || {};

    if (action === 'donated') {
      await centreRef.collection('donors').doc(donorId).update({
        lastDonated: Date.now(),
        donations: (donorData.donations || 0) + 1,
        'stats.showed': ((donorData.stats?.showed || 0) + 1)
      });
    }

    const donatedCount = (request.invites || []).filter(v => v.status === 'donated').length;
    if (donatedCount >= request.units) {
      request.status = 'done';
      request.closedAt = Date.now();
    }

    await reqDoc.ref.update({
      status: request.status,
      invites: request.invites,
      closedAt: request.closedAt || null,
      log: [...(request.log || []), { at: Date.now(), t: `Donor marked as ${action}` }]
    });

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: `DONOR_STATUS_${action.toUpperCase()}`,
      entityType: 'request',
      entityId: reqDoc.id,
      details: { donorId, action }
    });

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
