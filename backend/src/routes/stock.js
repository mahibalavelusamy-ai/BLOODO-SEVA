import { Router } from 'express';
import { getDb } from '../lib/firestore.js';
import { verifyAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { logAudit } from '../services/audit.js';

const router = Router();
router.use(verifyAuth);

// 1. Get stock list
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snap = await db.collection('centres').doc(req.user.centreId).collection('stock').get();
    const stock = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Proactively offer expiring unit to another licensed blood centre
router.post('/:id/offer', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { targetCentreId } = req.body;
    if (!targetCentreId) return res.status(400).json({ error: 'targetCentreId is required' });

    const db = getDb();
    const unitRef = db.collection('centres').doc(req.user.centreId).collection('stock').doc(req.params.id);
    const unitDoc = await unitRef.get();
    if (!unitDoc.exists) return res.status(404).json({ error: 'Stock unit not found' });

    const unit = unitDoc.data();
    await unitRef.update({
      status: 'offered',
      offerTo: targetCentreId,
      offeredAt: Date.now()
    });

    // Write transfer request to target centre's incoming transfers
    await db.collection('centres').doc(targetCentreId).collection('transfers').add({
      fromCentreId: req.user.centreId,
      unitId: req.params.id,
      group: unit.group,
      comp: unit.comp,
      expiresAt: unit.expiresAt,
      status: 'pending',
      createdAt: Date.now()
    });

    await logAudit({
      centreId: req.user.centreId,
      actor: { uid: req.user.uid, role: req.user.role },
      action: 'OFFER_STOCK_TRANSFER',
      entityType: 'stock',
      entityId: req.params.id,
      details: { targetCentreId, group: unit.group, comp: unit.comp }
    });

    res.json({ success: true, message: 'Unit offered to target blood centre' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Flag unit to use first
router.post('/:id/usefirst', requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const db = getDb();
    await db.collection('centres').doc(req.user.centreId).collection('stock').doc(req.params.id).update({
      status: 'usefirst'
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

