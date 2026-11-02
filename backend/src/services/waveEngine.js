import { matchCandidates } from './eligibility.js';
import { formatWaveMessage, sendWhatsAppMessage } from './whatsapp.js';
import { logAudit } from './audit.js';

export async function dispatchWave({ centreId, request, donors, rules, centreName, patientCircle = [] }) {
  const { list, skipped } = matchCandidates({ donors, request, rules, patientCircle });
  const committed = (request.invites || []).filter(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status)).length;
  const remaining = request.units - committed;

  if (remaining <= 0) {
    return { status: 'covered', invites: request.invites, logMessage: 'All units already covered' };
  }
  if (!list.length) {
    return { status: 'stalled', invites: request.invites, logMessage: `No more eligible donors within ${request.radius || 15} km` };
  }

  const maxWaves = request.kind === 'planned' ? 8 : (rules?.maxWaves || 4);
  const nextWaveNum = (request.wave || 0) + 1;
  if (nextWaveNum > maxWaves) {
    return { status: 'stalled', invites: request.invites, logMessage: `Stopped after ${maxWaves} rounds` };
  }

  const perUnit = rules?.perUnit || 4;
  const waveSize = request.kind === 'planned' ? remaining : Math.max(3, Math.ceil(remaining * perUnit));
  const selectedDonors = list.slice(0, waveSize);

  const now = Date.now();
  const timeoutMin = request.kind === 'planned' ? (rules?.circleReplyMin || 60) : (rules?.timeoutMin || 20);
  const waveDeadline = now + timeoutMin * 60 * 1000;

  const newInvites = [...(request.invites || [])];

  for (const donor of selectedDonors) {
    const text = formatWaveMessage({ request, km: donor.km, centreName });
    await sendWhatsAppMessage({ to: donor.phone, text });

    newInvites.push({
      donorId: donor.id,
      wave: nextWaveNum,
      status: 'sent',
      sentAt: now
    });
  }

  const logEntry = `Wave ${nextWaveNum} sent to ${selectedDonors.length} donor${selectedDonors.length === 1 ? '' : 's'}`;

  await logAudit({
    centreId,
    action: 'DISPATCH_WAVE',
    entityType: 'request',
    entityId: request.id,
    details: { wave: nextWaveNum, donorCount: selectedDonors.length, skipped }
  });

  return {
    status: 'finding',
    wave: nextWaveNum,
    waveDeadline,
    skipped,
    invites: newInvites,
    logMessage: logEntry
  };
}

export async function processDonorReply({ centreId, request, donorId, replyText, reason = '' }) {
  const norm = replyText.trim().toLowerCase();
  const isYes = norm.includes('yes') || norm === '1';
  const isNo = norm.includes('no') || norm.includes('not now') || norm === '2';
  const isPause = norm.includes('pause') || norm === '3';

  const invite = (request.invites || []).find(v => v.donorId === donorId);
  if (!invite) return null;

  const now = Date.now();
  let updatedStatus = invite.status;

  if (isYes) {
    const committed = (request.invites || []).filter(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status)).length;
    if (committed >= request.units) {
      updatedStatus = 'standdown';
    } else {
      updatedStatus = 'yes';
    }
  } else if (isNo) {
    updatedStatus = 'no';
    invite.reason = reason || 'Not available';
  } else if (isPause) {
    updatedStatus = 'no';
    invite.reason = 'Paused alerts';
  }

  invite.status = updatedStatus;
  invite.at = now;

  const totalCommitted = (request.invites || []).filter(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status)).length;
  if (totalCommitted >= request.units && request.status === 'finding') {
    request.status = 'covered';
    // Send standdown to others waiting
    for (const other of request.invites) {
      if (['sent', 'seen'].includes(other.status)) {
        other.status = 'standdown';
        other.at = now;
      }
    }
  }

  await logAudit({
    centreId,
    action: 'DONOR_REPLY',
    entityType: 'request',
    entityId: request.id,
    details: { donorId, reply: replyText, newStatus: updatedStatus }
  });

  return { request, invite, action: isPause ? 'PAUSE_DONOR' : isNo ? 'REST_DONOR' : 'CONFIRMED' };
}
