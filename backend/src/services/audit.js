import { getDb } from '../lib/firestore.js';

export async function logAudit({
  centreId,
  actor = { uid: 'system', role: 'system', email: 'system@bloodo.internal' },
  action,
  entityType,
  entityId,
  details = {}
}) {
  const auditEntry = {
    centreId,
    actor,
    action,
    entityType,
    entityId,
    details,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
    clinicalDisclaimer: 'Bloodo does not determine donor eligibility or clinical compatibility. Licensed blood centre professionals retain responsibility.'
  };

  try {
    const db = getDb();
    if (db) {
      await db.collection('centres').doc(centreId).collection('audit').add(auditEntry);
    }
  } catch (err) {
    console.warn(`[AUDIT FALLBACK] ${action} on ${entityType}:${entityId} by ${actor.uid}:`, details);
  }

  return auditEntry;
}

