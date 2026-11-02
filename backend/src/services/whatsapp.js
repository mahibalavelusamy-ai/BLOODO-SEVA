import { COMP } from '../lib/constants.js';

export function formatWaveMessage({ request, km, centreName }) {
  const group = request.group.replace('-', '−');
  const comp = COMP[request.comp]?.short || 'Blood';
  const when = new Date(request.neededBy).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (request.kind === 'planned') {
    return `🩸 *Your donor circle: ${group} needed*\nA patient you help regularly has a scheduled transfusion.\nCan you donate at ${centreName} by ${when}?`;
  }
  if (request.kind === 'topup') {
    return `🩸 *${group} donors needed this week*\n${centreName} expects to run short of ${group} soon.\nCan you donate by ${when}?`;
  }
  return `🩸 *${comp} needed: ${group}*\n${centreName}, ${km ? km + ' km' : 'near'} from you\nNeeded by ${when}\n\nCan you donate?`;
}

export async function sendWhatsAppMessage({ to, text, buttons = ['Yes, I can', 'Not now', 'Pause alerts'] }) {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.log(`[SIMULATED WHATSAPP OUTBOUND] To: ${to} | Text: ${text.replace(/\n/g, ' ')} | Buttons: ${buttons.join(', ')}`);
    return { success: true, simulated: true, messageId: 'sim_' + Date.now() };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/\D/g, ''),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map((btn, idx) => ({
          type: 'reply',
          reply: { id: `btn_${idx}_${btn.toLowerCase().replace(/\s+/g, '_')}`, title: btn.slice(0, 20) }
        }))
      }
    }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return { success: response.ok, data };
  } catch (err) {
    console.error('Failed to send WhatsApp Cloud API message:', err);
    return { success: false, error: err.message };
  }
}
