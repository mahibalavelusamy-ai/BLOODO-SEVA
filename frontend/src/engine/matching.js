import { GROUPS, RBC, PLASMA_ABO, COMP, DAY } from './constants.js';
import { now } from '../lib/helpers.js';
import { getState, bankLoc, reqLoc, donorKm, eligibleNow, eligibleOn } from '../state/store.js';
export { eligibleNow, eligibleOn };

export function asksThisMonth(d) {
  return d.asks.filter(t => now() - t < 30 * DAY).length;
}

export function lockedBy(d, exceptReq) {
  const S = getState();
  for (const q of S.requests) {
    if (q === exceptReq || !['finding', 'covered', 'queued'].includes(q.status)) continue;
    if (q.invites.some(v => v.donorId === d.id && ['sent', 'seen', 'yes', 'ontheway', 'arrived'].includes(v.status))) return q;
  }
  return null;
}

export function donorState(d) {
  const S = getState();
  if (d.pausedUntil && d.pausedUntil > now()) return { k: 'paused', label: 'Paused', tone: 'calm', detail: `Paused until ${new Date(d.pausedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` };
  const lk = lockedBy(d);
  if (lk) return { k: 'locked', label: 'On a request', tone: 'red', detail: `Being asked for ${COMP[lk.comp].short.toLowerCase()} ${lk.group.replace('-', '−')}` };
  if (!eligibleNow(d)) {
    const n = Math.ceil((eligibleOn(d) - now()) / DAY);
    return { k: 'recovering', label: 'Recovering', tone: 'warn', detail: `Eligible in ${n} day${n === 1 ? '' : 's'}` };
  }
  if (d.lastNoAt && now() - d.lastNoAt < S.rules.restAfterNo * DAY) {
    const n = Math.ceil((d.lastNoAt + S.rules.restAfterNo * DAY - now()) / DAY);
    return { k: 'resting', label: 'Resting', tone: '', detail: `Said not now. Can be asked in ${n} day${n === 1 ? '' : 's'}` };
  }
  if (asksThisMonth(d) >= S.rules.maxPerMonth) return { k: 'resting', label: 'Resting', tone: '', detail: `Asked ${asksThisMonth(d)} times this month` };
  return { k: 'ready', label: 'Ready', tone: 'ok', detail: 'Can be asked now' };
}

export function compatibleGroups(group, comp) {
  if (comp === 'rbc') return RBC[group];
  if (comp === 'ffp') {
    const abo = group.replace(/[+-]/, '');
    const ok = PLASMA_ABO[abo];
    return GROUPS.filter(x => ok.includes(x.replace(/[+-]/, '')));
  }
  return [group]; /* whole blood and platelets: same group */
}

export function isQuiet() {
  const S = getState();
  const h = new Date().getHours(), { quietStart: a, quietEnd: b } = S.rules;
  return a > b ? (h >= a || h < b) : (h >= a && h < b);
}

export function candidates(req) {
  const S = getState();
  const groups = req.kind === 'planned' ? [req.group] : compatibleGroups(req.group, req.comp);
  const P = req.kind === 'planned' ? S.patients.find(p => p.id === req.patientId) : null;
  const inCircle = d => P && P.circle.includes(d.id);
  const skipped = { recovering: 0, resting: 0, paused: 0, locked: 0, far: 0, noApheresis: 0 };
  const invited = new Set(req.invites.map(v => v.donorId));
  const list = [];
  for (const d of S.donors) {
    if (!groups.includes(d.group) || !d.consent || invited.has(d.id)) continue;
    if (d.pausedUntil && d.pausedUntil > now()) { skipped.paused++; continue; }
    if (lockedBy(d, req)) { skipped.locked++; continue; }
    if (!eligibleNow(d)) { skipped.recovering++; continue; }
    if ((d.lastNoAt && now() - d.lastNoAt < S.rules.restAfterNo * DAY) || asksThisMonth(d) >= S.rules.maxPerMonth) { skipped.resting++; continue; }
    if (req.comp === 'plt' && !d.apheresis) { skipped.noApheresis++; continue; }
    if (donorKm(d, reqLoc(req)) > req.radius && !inCircle(d)) { skipped.far++; continue; }
    list.push(d);
  }
  const rel = d => (d.stats.yes + 1) / (d.stats.asked + 2);
  const L = reqLoc(req);
  const score = d => rel(d) * 10 - donorKm(d, L) / 6;
  list.sort((a, b) => ((b.group === req.group) - (a.group === req.group)) || (score(b) - score(a)));
  if (P && P.circle.length) {
    const k = P.rot % P.circle.length;
    const order = P.circle.slice(k).concat(P.circle.slice(0, k));
    const inC = order.map(id => list.find(d => d.id === id)).filter(Boolean);
    const rest = list.filter(d => !P.circle.includes(d.id));
    list.splice(0, list.length, ...inC, ...rest);
  }
  return { list, skipped };
}

export function committed(req) {
  return req.invites.filter(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status)).length;
}

export function donatedN(req) {
  return req.invites.filter(v => v.status === 'donated').length;
}
