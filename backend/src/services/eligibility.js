import { GROUPS, RBC, PLASMA_ABO, DAY } from '../lib/constants.js';

export function daysSince(ts) {
  return ts ? Math.floor((Date.now() - ts) / DAY) : Infinity;
}

export function recoveryDays(gender) {
  return gender === 'Female' ? 120 : 90;
}

export function eligibleNow(donor) {
  return daysSince(donor.lastDonated) >= recoveryDays(donor.gender);
}

export function eligibleOn(donor) {
  return donor.lastDonated ? donor.lastDonated + recoveryDays(donor.gender) * DAY : Date.now();
}

export function asksThisMonth(donor) {
  return (donor.asks || []).filter(t => Date.now() - t < 30 * DAY).length;
}

export function donorState(donor, rules) {
  const maxPerMonth = rules?.maxPerMonth ?? 2;
  const restAfterNo = rules?.restAfterNo ?? 14;

  if (donor.pausedUntil && donor.pausedUntil > Date.now()) {
    return { k: 'paused', label: 'Paused', detail: `Paused until ${new Date(donor.pausedUntil).toISOString().split('T')[0]}` };
  }
  if (!eligibleNow(donor)) {
    const n = Math.ceil((eligibleOn(donor) - Date.now()) / DAY);
    return { k: 'recovering', label: 'Recovering', detail: `Eligible in ${n} day${n === 1 ? '' : 's'}` };
  }
  if (donor.lastNoAt && Date.now() - donor.lastNoAt < restAfterNo * DAY) {
    const n = Math.ceil((donor.lastNoAt + restAfterNo * DAY - Date.now()) / DAY);
    return { k: 'resting', label: 'Resting', detail: `Said not now. Can be asked in ${n} day${n === 1 ? '' : 's'}` };
  }
  if (asksThisMonth(donor) >= maxPerMonth) {
    return { k: 'resting', label: 'Resting', detail: `Asked ${asksThisMonth(donor)} times this month` };
  }
  return { k: 'ready', label: 'Ready', detail: 'Can be asked now' };
}

export function compatibleGroups(group, comp) {
  if (comp === 'rbc') return RBC[group] || [group];
  if (comp === 'ffp') {
    const abo = group.replace(/[+-]/, '');
    const ok = PLASMA_ABO[abo] || [abo];
    return GROUPS.filter(x => ok.includes(x.replace(/[+-]/, '')));
  }
  return [group];
}

export function matchCandidates({ donors, request, rules, patientCircle = [] }) {
  const groups = request.kind === 'planned' ? [request.group] : compatibleGroups(request.group, request.comp);
  const maxPerMonth = rules?.maxPerMonth ?? 2;
  const restAfterNo = rules?.restAfterNo ?? 14;
  const radius = request.radius || rules?.radiusKm || 15;

  const skipped = { recovering: 0, resting: 0, paused: 0, locked: 0, far: 0, noApheresis: 0 };
  const invited = new Set((request.invites || []).map(v => v.donorId));
  const list = [];

  for (const d of donors) {
    if (!groups.includes(d.group) || !d.consent || invited.has(d.id)) continue;
    if (d.pausedUntil && d.pausedUntil > Date.now()) { skipped.paused++; continue; }
    if (!eligibleNow(d)) { skipped.recovering++; continue; }
    if ((d.lastNoAt && Date.now() - d.lastNoAt < restAfterNo * DAY) || asksThisMonth(d) >= maxPerMonth) {
      skipped.resting++; continue;
    }
    if (request.comp === 'plt' && !d.apheresis) { skipped.noApheresis++; continue; }
    if (d.km > radius && !patientCircle.includes(d.id)) { skipped.far++; continue; }
    list.push(d);
  }

  const rel = d => ((d.stats?.yes || 0) + 1) / ((d.stats?.asked || 0) + 2);
  list.sort((a, b) => ((b.group === request.group) - (a.group === request.group)) || (rel(b) * 10 - b.km / 6) - (rel(a) * 10 - a.km / 6));

  if (patientCircle.length) {
    const inC = patientCircle.map(id => list.find(d => d.id === id)).filter(Boolean);
    const rest = list.filter(d => !patientCircle.includes(d.id));
    list.splice(0, list.length, ...inC, ...rest);
  }

  return { list, skipped };
}
