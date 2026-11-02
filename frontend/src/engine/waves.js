import { MIN, DAY, NO_REASONS, COMP } from './constants.js';
import { now, rand, esc, first, g, toast } from '../lib/helpers.js';
import { getState, save, bookingFor, newPlanned, patientOf, shortDay } from '../state/store.js';
import { candidates, committed, donatedN, isQuiet } from './matching.js';

export const flashIds = new Set();

let renderFn = null;
let softRenderFn = null;

export function setWaveCallbacks({ render, softRender }) {
  renderFn = render;
  softRenderFn = softRender;
}

export function logR(req, t) {
  req.log.push({ at: now(), t });
}

export function sendWave(req) {
  const S = getState();
  const { list, skipped } = candidates(req);
  req.skipped = skipped;
  const remaining = req.units - committed(req);
  if (remaining <= 0) return;
  if (!list.length) {
    req.status = 'stalled';
    logR(req, `No more eligible donors within ${req.radius} km`);
    return;
  }
  const maxW = req.kind === 'planned' ? 8 : S.rules.maxWaves;
  if (req.wave >= maxW) {
    req.status = 'stalled';
    logR(req, `Stopped after ${maxW} rounds`);
    return;
  }
  const size = req.kind === 'planned' ? remaining : Math.max(3, Math.ceil(remaining * S.rules.perUnit));
  const pick = list.slice(0, size);
  req.wave++;
  const t = now();
  const speed = req.priority === 'critical' ? 0.7 : 1;
  for (const d of pick) {
    const rel = (d.stats.yes + 1) / (d.stats.asked + 2);
    const roll = Math.random();
    const reply = req.kind === 'planned'
      ? (roll < 0.5 + rel * 0.3 ? 'yes' : roll < 0.88 ? 'no' : 'silent')
      : (roll < 0.22 + rel * 0.38 ? 'yes' : roll < 0.78 ? 'no' : 'silent');
    const seen = t + rand(1.5, 6) * MIN * speed;
    req.invites.push({
      donorId: d.id, wave: req.wave, status: 'sent', sentAt: t,
      _seenAt: seen, _reply: reply, _replyAt: reply === 'silent' ? null : seen + rand(2, 11) * MIN * speed,
      eta: req.kind === 'planned'
        ? 'Booked for ' + shortDay(req.neededBy)
        : req.kind === 'topup'
          ? 'Donating ' + ['today', 'tomorrow', 'this week'][Math.floor(Math.random() * 3)]
          : ['Within 1 hour', 'Within 1 hour', '1–2 hours', '2–3 hours'][Math.floor(Math.random() * 4)]
    });
    d.asks.push(t);
    d.stats.asked++;
  }
  req.status = 'finding';
  req.waveDeadline = t + (req.kind === 'planned' ? S.rules.circleReplyMin : S.rules.timeoutMin) * MIN * (req.priority === 'critical' ? 0.75 : 1);
  if (req.kind === 'planned') {
    const P = patientOf(req);
    const out = pick.filter(d => !P.circle.includes(d.id));
    logR(req, out.length
      ? `No one in ${first(P.name)}'s circle is ready. Asked ${pick.map(d => first(d.name)).join(', ')} from the wider pool`
      : `Asked ${pick.map(d => first(d.name)).join(', ')} from ${first(P.name)}'s circle`);
    if (out.length) P.needsDonors = true;
  } else {
    logR(req, `Wave ${req.wave} sent to ${pick.length} donor${pick.length === 1 ? '' : 's'}`);
  }
}

export function startRequest(req) {
  const S = getState();
  if (req.priority !== 'critical' && isQuiet()) {
    req.status = 'queued';
    logR(req, `Queued for ${S.rules.quietEnd}:00 am. Quiet hours are on.`);
    return;
  }
  sendWave(req);
}

export function checkCoverage(req) {
  if (req.status === 'finding' && committed(req) >= req.units) {
    req.status = 'covered';
    let n = 0;
    req.invites.forEach(v => {
      if (v.status === 'sent' || v.status === 'seen') {
        v.status = 'standdown';
        v.at = now();
        n++;
      }
    });
    logR(req, req.kind === 'planned'
      ? `Donor booked for every unit`
      : `All ${req.units} unit${req.units > 1 ? 's' : ''} covered.${n ? ` ${n} donor${n > 1 ? 's were' : ' was'} told they're not needed.` : ''}`);
    toast(req.kind === 'planned'
      ? `${esc(first(patientOf(req).name))}'s transfusion has a donor booked`
      : `${g(req.group)} ${COMP[req.comp].short.toLowerCase()} is covered`, 'ok');
  }
  if (['finding', 'covered'].includes(req.status) && donatedN(req) >= req.units) {
    req.status = 'done';
    req.closedAt = now();
    if (req.kind === 'planned') {
      const P = patientOf(req);
      logR(req, `Blood ready for ${first(P.name)}'s transfusion`);
      if (P.nextAt === req.transfusionAt) {
        P.history.push(req.transfusionAt);
        P.nextAt = req.transfusionAt + P.interval * DAY;
      }
      toast(`Blood ready for ${esc(first(P.name))}. Next transfusion scheduled.`, 'ok');
    } else {
      logR(req, 'Request completed');
      toast('Request completed. Thank-you messages sent.', 'ok');
    }
  }
}

export function tick() {
  const S = getState();
  if (!S) return;
  let changed = false;
  const t = now();

  if (!isQuiet()) {
    S.requests.forEach(q => {
      if (q.status === 'queued') {
        logR(q, 'Quiet hours over. Sending now');
        sendWave(q);
        changed = true;
      }
    });
  }

  (S.patients || []).forEach(p => {
    if (!p.active) return;
    if (p.nextAt - t <= S.rules.bookAheadDays * DAY && !bookingFor(p)) {
      const q = newPlanned(p);
      S.requests.push(q);
      startRequest(q);
      changed = true;
    }
  });

  (S.stock || []).forEach(u => {
    if (u.status === 'offered' && t >= u.acceptAt) {
      u.status = 'transferred';
      u.at = t;
      S.stockStats.savedThisMonth++;
      const c = S.network.find(x => x.id === u.offerTo);
      c.needs = c.needs.filter(([gp, cp]) => !(gp === u.group && cp === u.comp));
      toast(`${esc(c.name)} accepted ${g(u.group)} ${COMP[u.comp].short.toLowerCase()}. Arrange transport.`, 'ok');
      changed = true;
    }
    if (['stock', 'usefirst', 'offered'].includes(u.status) && t >= u.expiresAt) {
      u.status = 'expired';
      u.at = t;
      S.stockStats.expiredThisMonth++;
      changed = true;
    }
  });

  for (const req of S.requests) {
    if (!['finding', 'covered'].includes(req.status)) continue;
    for (const v of req.invites) {
      const d = S.donors.find(x => x.id === v.donorId);
      if (!d) continue;
      if (v.status === 'sent' && v._seenAt && t >= v._seenAt) {
        v.status = 'seen';
        changed = true;
      }
      if ((v.status === 'seen' || v.status === 'sent') && v._replyAt && t >= v._replyAt) {
        if (v._reply === 'yes') {
          if (committed(req) >= req.units) {
            v.status = 'standdown';
          } else {
            v.status = 'yes';
            v.at = t;
            d.stats.yes++;
            v._otwAt = req.kind === 'urgent' || !req.kind ? t + rand(5, 14) * MIN : null;
            flashIds.add(req.id + v.donorId);
            if (req.kind === 'planned') {
              const P = patientOf(req);
              P.rot = (P.circle.indexOf(d.id) + 1) || P.rot + 1;
              toast(`${esc(first(d.name))} is booked for ${esc(first(P.name))}'s transfusion`, 'ok');
            } else {
              toast(`${esc(first(d.name))} said yes for ${g(req.group)} ${COMP[req.comp].short.toLowerCase()}`, 'ok');
            }
          }
        } else {
          v.status = 'no';
          v.at = t;
          d.lastNoAt = t;
          v.reason = NO_REASONS[Math.floor(Math.random() * NO_REASONS.length)];
          if (v.reason === 'Donated elsewhere recently') {
            d.lastDonated = t - 18 * DAY;
          }
        }
        changed = true;
        checkCoverage(req);
      }
      if (v.status === 'yes' && v._otwAt && t >= v._otwAt) {
        v.status = 'ontheway';
        v.at = t;
        changed = true;
      }
    }
    if (req.status === 'finding' && !req.invites.some(v => v.status === 'sent' || v.status === 'seen') && committed(req) < req.units && req.waveDeadline - t > 2 * MIN) {
      req.waveDeadline = t + 2 * MIN;
      changed = true;
    }
    if (req.status === 'finding' && req.waveDeadline && t >= req.waveDeadline) {
      req.invites.forEach(v => {
        if ((v.status === 'sent' || v.status === 'seen') && v.wave === req.wave) {
          v.status = 'silent';
          v.at = t;
        }
      });
      sendWave(req);
      changed = true;
    }
  }

  if (changed) {
    save();
  }
  if (softRenderFn) {
    softRenderFn(changed);
  }
}

export function act(req, donorId, what) {
  const S = getState();
  const v = req.invites.find(x => x.donorId === donorId);
  const d = S.donors.find(x => x.id === donorId);
  if (!v || !d) return;

  if (what === 'arrived') {
    v.status = 'arrived';
    v.at = now();
  }
  if (what === 'donated') {
    v.status = 'donated';
    v.at = now();
    d.lastDonated = now();
    d.donations++;
    d.stats.showed++;
    toast(`${esc(first(d.name))}'s donation recorded. Thank-you message sent.`, 'ok');
  }
  if (what === 'deferred' || what === 'noshow') {
    v.status = what;
    v.at = now();
    logR(req, what === 'deferred' ? `${first(d.name)} was deferred at screening` : `${first(d.name)} didn't come. Slot released.`);
    if (req.status === 'covered') {
      req.status = 'finding';
      logR(req, 'Need reopened');
      sendWave(req);
    } else if (req.status === 'finding' && !req.invites.some(x => ['sent', 'seen'].includes(x.status))) {
      sendWave(req);
    }
  }
  checkCoverage(req);
  save();
  if (renderFn) renderFn();
}
