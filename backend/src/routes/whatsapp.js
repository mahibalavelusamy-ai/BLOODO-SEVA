import { Router } from 'express';
import { getDb } from '../lib/firestore.js';
import { processDonorReply } from '../services/waveEngine.js';

const router = Router();

// 1. Webhook Verification (WhatsApp Cloud API setup)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'bloodo_secure_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WHATSAPP WEBHOOK] Verified successfully.');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Verification failed' });
});

// 2. Incoming Messages Webhook
router.post('/webhook', async (req, res) => {
  // Always return 200 fast to acknowledge receipt as required by WhatsApp Cloud API
  res.status(200).send('EVENT_RECEIVED');

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return;

    const fromPhone = message.from; // E.164 phone without '+'
    let replyText = '';

    if (message.type === 'text') {
      replyText = message.text?.body || '';
    } else if (message.type === 'interactive') {
      replyText = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    }

    if (!replyText) return;

    console.log(`[WHATSAPP INBOUND] From: ${fromPhone} | Body: ${replyText}`);

    const db = getDb();
    if (!db) return;

    // Locate active request with this donor's phone across centres
    // Find donor by normalized phone in centres
    const centresSnap = await db.collection('centres').get();
    for (const centreDoc of centresSnap.docs) {
      const centreId = centreDoc.id;
      const donorsSnap = await db.collection('centres').doc(centreId).collection('donors')
        .where('phone', '==', fromPhone.slice(-10))
        .limit(1)
        .get();

      if (!donorsSnap.empty) {
        const donorDoc = donorsSnap.docs[0];
        const donorId = donorDoc.id;

        // Find open request that invited this donor
        const requestsSnap = await db.collection('centres').doc(centreId).collection('requests')
          .where('status', 'in', ['finding', 'covered'])
          .get();

        for (const reqDoc of requestsSnap.docs) {
          const request = reqDoc.data();
          const invite = (request.invites || []).find(v => v.donorId === donorId && ['sent', 'seen'].includes(v.status));
          if (invite) {
            const result = await processDonorReply({
              centreId,
              request: { ...request, id: reqDoc.id },
              donorId,
              replyText
            });

            if (result) {
              await db.collection('centres').doc(centreId).collection('requests').doc(reqDoc.id).update({
                status: result.request.status,
                invites: result.request.invites,
                updatedAt: Date.now()
              });

              if (result.action === 'PAUSE_DONOR') {
                await db.collection('centres').doc(centreId).collection('donors').doc(donorId).update({
                  pausedUntil: Date.now() + 30 * 864e5
                });
              } else if (result.action === 'REST_DONOR') {
                await db.collection('centres').doc(centreId).collection('donors').doc(donorId).update({
                  lastNoAt: Date.now()
                });
              }
              break;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error handling WhatsApp webhook message:', err);
  }
});

export default router;
