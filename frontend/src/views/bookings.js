import { COMP, GROUPS, QUICK_WHEN, PRIORITY } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import {
  $, esc, g, fmtWhen, fmtTime, until, word, hashStr,
  now
} from '../lib/helpers.js';
import { getState, patientOf, bankLoc, reqLoc, donorKm } from '../state/store.js';
import { candidates, committed, donatedN, isQuiet } from '../engine/matching.js';

export const UI = {
  reqFilter: 'active',
  q: '',
  grp: 'all',
  st: 'all',
  urgentOpen: false
};

export function reqStatus(req) {
  if (req.kind === 'planned') {
    const m2 = {
      finding: ['red live', 'Asking circle'],
      covered: ['ok', 'Donor booked'],
      done: ['', 'Blood ready'],
      stalled: ['warn', 'Needs a donor'],
      queued: ['calm', 'Queued'],
      cancelled: ['', 'Cancelled']
    }[req.status];
    return `<span class="pill ${m2[0]}"><span class="dot"></span>${m2[1]}</span>`;
  }
  const m = {
    finding: ['red live', 'Finding donors'],
    covered: ['ok', 'Covered'],
    done: ['', 'Completed'],
    stalled: ['warn', 'Needs attention'],
    queued: ['calm', 'Queued'],
    cancelled: ['', 'Cancelled']
  }[req.status];
  return `<span class="pill ${m[0]}"><span class="dot"></span>${m[1]}</span>`;
}

export function slots(req, lg) {
  const d = donatedN(req), c = committed(req);
  let h = '';
  for (let i = 0; i < req.units; i++) {
    const k = i < d ? 'd' : i < c ? 'c' : '';
    h += `<span class="slot ${k}" title="${k === 'd' ? 'Donated' : k === 'c' ? 'Donor confirmed' : 'Open'}">${ic('drop', lg ? 17 : 12, !!k)}</span>`;
  }
  return `<div class="slots ${lg ? 'lg' : ''}" aria-label="${c} of ${req.units} units confirmed, ${d} donated">${h}</div>`;
}

export function unitsLabel(req) {
  return `${req.units} unit${req.units > 1 ? 's' : ''} of ${COMP[req.comp].name.toLowerCase()}`;
}

export function reqTitle(req) {
  const P = patientOf(req);
  if (req.kind === 'planned') return `${String(P ? P.name : 'Patient').split(' ')[0]}’s transfusion`;
  if (req.kind === 'topup') return `Stock top-up: ${req.units} unit${req.units > 1 ? 's' : ''} of ${COMP[req.comp].name.toLowerCase()}`;
  return unitsLabel(req);
}

export function reqCard(req) {
  const open = ['finding', 'covered', 'queued', 'stalled'].includes(req.status);
  const meta = req.kind === 'planned'
    ? `<span>${esc(COMP[req.comp].short)}, ${req.units} unit${req.units > 1 ? 's' : ''}</span><span>Transfusion ${new Date(req.transfusionAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span><span>Donor by ${new Date(req.neededBy).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>`
    : `<span>By ${fmtWhen(req.neededBy)}${open ? ` (${until(req.neededBy)})` : ''}</span>${req.ref ? `<span>${esc(req.ref)}</span>` : ''}${req.priority === 'critical' ? '<span style="color:var(--red);font-weight:500">Critical</span>' : ''}`;
  return `<a class="rrow" href="#/request/${req.id}">
    <div class="tok">${g(req.group)}</div>
    <div class="grow"><div class="title">${esc(reqTitle(req))}</div><div class="meta">${meta}</div></div>
    <div class="end">${slots(req)}${reqStatus(req)}<span class="chev">${ic('chev', 18)}</span></div></a>`;
}

export function reqList(list) {
  return `<div class="panel card">${list.map(reqCard).join('')}</div>`;
}

export function inviteTag(v) {
  const m = {
    sent: ['', 'Delivered'],
    seen: ['', 'Seen'],
    yes: ['ok', v.eta && /^(Booked|Donating)/.test(v.eta) ? v.eta : `Coming ${v.eta ? v.eta.toLowerCase() : ''}`],
    ontheway: ['ok', 'On the way'],
    arrived: ['calm', 'At the centre'],
    donated: ['red', 'Donated'],
    no: ['', 'Not now'],
    silent: ['', 'No reply'],
    standdown: ['', 'Not needed'],
    deferred: ['warn', 'Deferred'],
    noshow: ['warn', "Didn't come"],
    cancelled: ['', 'Cancelled']
  }[v.status];
  return `<span class="pill ${m[0]}">${m[1]}</span>`;
}

export function quickWhen(k) {
  const q = QUICK_WHEN.find(x => x[0] === k);
  if (q && q[2]) {
    const d = new Date(now() + q[2] * 3600e3);
    d.setSeconds(0, 0);
    const m = d.getMinutes();
    d.setMinutes(m === 0 || m === 30 ? m : (m < 30 ? 30 : 60));
    return d.getTime();
  }
  const d = new Date();
  if (k === 'tonight') {
    d.setHours(21, 0, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  }
  return d.getTime();
}

export function quickComposer() {
  const S = getState();
  const poolBy = {};
  GROUPS.forEach(x => poolBy[x] = 0);
  S.donors.forEach(d => {
    if (d.stats && d.consent) poolBy[d.group] = (poolBy[d.group] || 0) + 1;
  });

  const firstComp = Object.keys(COMP).find(k => S.bank.services[k]) || 'whole';

  return `<form class="quick glass" data-form="quick-request" novalidate>
    <div class="quick-h"><div><h2>Urgent request</h2><p class="small muted">For needs you didn’t plan for. Eligible donors near ${esc(S.bank.area || S.bank.district)} get a WhatsApp message right away.</p></div>
      <span class="pill red live"><span class="dot"></span>WhatsApp ready</span></div>
    <div class="quick-grid">
      <fieldset class="qf"><legend class="qlbl">Blood group</legend>
        <div class="gtiles">${GROUPS.map(x => `<label class="gtile"><input type="radio" name="group" value="${x}"><span class="gt-in"><span class="gt-g">${g(x)}</span><span class="gt-n">...</span></span></label>`).join('')}</div>
      </fieldset>
      <div class="qside">
        <fieldset class="qf"><legend class="qlbl">Component</legend>
          <div class="seg">${Object.entries(COMP).filter(([k]) => S.bank.services[k]).map(([k, c]) => `<label><input type="radio" name="comp" value="${k}" ${k === firstComp ? 'checked' : ''}><span>${c.short}</span></label>`).join('')}</div></fieldset>
        <fieldset class="qf"><legend class="qlbl">Needed by</legend>
          <div class="seg seg2">${QUICK_WHEN.map(([k], i) => `<label><input type="radio" name="when" value="${k}" ${i === 2 ? 'checked' : ''}><span><b>${({ '2h': '2 hours', '4h': '4 hours', '6h': '6 hours', 'tonight': 'Tonight', 'tomorrow': 'Tomorrow' })[k]}</b><small data-when-sub="${k}">${fmtTime(quickWhen(k))}</small></span></label>`).join('')}</div></fieldset>
        <fieldset class="qf"><legend class="qlbl">Units</legend>
          <div class="units"><div class="stepper" aria-label="Units"><button type="button" data-act="step" data-n="-1" aria-label="One fewer unit">−</button><output>1</output><button type="button" data-act="step" data-n="1" aria-label="One more unit">+</button><input type="hidden" name="units" value="1"></div>
          <div class="slots" id="q-slots" aria-hidden="true"><span class="slot c">${ic('drop', 12, true)}</span></div></div></fieldset>
      </div>
    </div>
    <div class="quick-f">
      <div class="grow"><div class="q-sum" id="q-sum">Choose a blood group to begin.</div><div class="small muted" id="q-preview">Bloodo checks eligibility, distance and rest days before messaging anyone.</div></div>
      <button type="button" class="btn ghost" data-act="quick-more">More options</button>
      <button class="btn primary xl" id="q-go" disabled>${ic('send', 18)}Find donors</button>
    </div>
    <p class="err-t" data-err hidden></p>
  </form>`;
}

export function updateQuick() {
  const S = getState();
  const form = document.querySelector('[data-form="quick-request"]');
  if (!form) return;
  const f = new FormData(form);
  const group = f.get('group'), comp = f.get('comp'), units = +f.get('units'), when = f.get('when');
  const box = $('#q-preview'), sum = $('#q-sum'), go = $('#q-go');
  form.querySelectorAll('[data-when-sub]').forEach(el => el.textContent = fmtTime(quickWhen(el.dataset.whenSub)));
  const slotsEl = $('#q-slots');
  if (slotsEl) slotsEl.innerHTML = Array.from({ length: units }, () => `<span class="slot c">${ic('drop', 12, true)}</span>`).join('');
  if (go) go.disabled = !group;
  form.querySelectorAll('.gtile').forEach(t => {
    const x = t.querySelector('input').value;
    const n = candidates({ group: x, comp, units: 1, radius: S.rules.radiusKm, invites: [], loc: bankLoc() }).list.length;
    t.querySelector('.gt-n').textContent = `${n} nearby`;
    t.classList.toggle('low', n < 3);
  });
  if (!group) {
    if (sum) sum.textContent = 'Choose a blood group to begin.';
    if (box) box.textContent = 'Bloodo checks eligibility, distance and rest days before messaging anyone.';
    return;
  }
  if (sum) sum.innerHTML = `${word(units)} unit${units > 1 ? 's' : ''} of <em>${g(group)} ${esc(COMP[comp].short.toLowerCase())}</em>, by ${fmtWhen(quickWhen(when))}`;
  const { list } = candidates({ group, comp, units, radius: S.rules.radiusKm, invites: [], loc: bankLoc() });
  const firstCount = Math.min(list.length, Math.max(3, Math.ceil(units * S.rules.perUnit)));
  const quiet = isQuiet();
  if (box) {
    box.innerHTML = list.length
      ? `<span style="color:var(--ok);font-weight:500">${list.length} donor${list.length > 1 ? 's' : ''} ready within ${S.rules.radiusKm} km.</span> The first wave goes to ${firstCount}.${quiet ? ' Quiet hours are on, so it sends at 7 am unless you mark it critical.' : ''}`
      : `<span style="color:var(--warn);font-weight:500">No ready donors within ${S.rules.radiusKm} km.</span> You can still start it and widen the search.`;
  }
}

export function waMessage(req, km) {
  const G = req.group.replace('-', '−'), L = reqLoc(req).name;
  if (req.kind === 'planned') {
    return `🩸 *Your donor circle: ${G} needed*\nA child you help regularly has a transfusion on ${new Date(req.transfusionAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}.\nCan you donate at ${L} by ${fmtWhen(req.neededBy)}?`;
  }
  if (req.kind === 'topup') {
    return `🩸 *${G} donors needed this week*\n${L} expects to run short of ${G} soon, ${km ? km + ' km' : 'near'} from you.\nCan you donate by ${fmtWhen(req.neededBy)}?`;
  }
  return `🩸 *${COMP[req.comp].short} needed: ${req.group.replace('-', '−')}*\n${reqLoc(req).name}, ${km ? km + ' km' : 'near'} from you\nNeeded by ${fmtWhen(req.neededBy)}\n\nCan you donate?`;
}

export function radar(req) {
  const S = getState();
  const cx = 200, cy = 200, R = 172, maxKm = Math.max(req.radius, 15);
  const rings = [5, 10, 15, 30, 40].filter(k => k <= maxKm);
  const pos = d => {
    const a = (hashStr(d.id) % 360) * Math.PI / 180;
    const r = Math.max(36, Math.sqrt(Math.min(1, donorKm(d, reqLoc(req)) / maxKm)) * R);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const cls = { sent: 'w', seen: 'w', yes: 'y', ontheway: 'y', arrived: 'a', donated: 'd' };
  let dots = '';
  const order = ['no', 'silent', 'standdown', 'deferred', 'noshow', 'cancelled', 'sent', 'seen', 'yes', 'ontheway', 'arrived', 'donated'];
  req.invites.slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).forEach(v => {
    const d = S.donors.find(x => x.id === v.donorId);
    if (!d) return;
    const [x, y] = pos(d);
    const c = cls[v.status] || 'o';
    const halo = (c === 'y' || c === 'a' || c === 'd') ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" class="${c}h"/>` : '';
    const r = c === 'o' ? 3.5 : c === 'w' ? 5.5 : 7.5;
    dots += `<g class="dot" data-act="chat" data-r="${req.id}" data-d="${d.id}"><title>${esc(d.name)}, ${donorKm(d, reqLoc(req))} km</title>${halo}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${c}"/></g>`;
  });
  const live = req.status === 'finding';
  const pulses = live ? [0, 1, 2].map(i => `<circle class="pulse" data-sync="3600" data-off="${i * 1200}" cx="${cx}" cy="${cy}" r="${R}"/>`).join('') : '';
  const radiusRing = req.radius < maxKm ? '' : '';
  return `<svg class="radar" viewBox="0 0 400 418" role="img" aria-label="Map of ${req.invites.length} donors messaged around the centre">
    ${rings.map(k => { const rr = Math.sqrt(k / maxKm) * R; return `<circle class="ring ${k > req.radius ? 'dash' : ''}" cx="${cx}" cy="${cy}" r="${rr.toFixed(1)}"/><text class="rl" text-anchor="middle" x="${cx}" y="${(cy + rr + 14).toFixed(1)}">${k} km</text>`; }).join('')}
    ${pulses}${radiusRing}
    <circle class="core-h" cx="${cx}" cy="${cy}" r="30"/><circle class="core" cx="${cx}" cy="${cy}" r="19"/>
    <path d="M200 189.5s6.6 7.1 6.6 11.9a6.6 6.6 0 0 1-13.2 0c0-4.8 6.6-11.9 6.6-11.9z" fill="var(--red-ink)"/>
    ${dots}</svg>`;
}

export function legend() {
  return `<div class="legend"><span><i style="border:1.6px solid var(--ink-3)"></i>Waiting</span><span><i style="background:var(--ok)"></i>Said yes</span><span><i style="background:var(--calm)"></i>At the centre</span><span><i style="background:var(--red)"></i>Donated</span><span><i style="background:var(--line-2)"></i>Not coming</span></div>`;
}

export function bookingsLive() {
  const S = getState();
  const f = UI.reqFilter;
  const okF = q => f === 'all' || (f === 'active' ? ['finding', 'covered', 'queued', 'stalled'].includes(q.status) : ['done', 'cancelled'].includes(q.status));
  const sec = (kind, title, empty) => {
    const l = S.requests.filter(q => (q.kind || 'urgent') === kind && okF(q)).sort((a, b) => a.neededBy - b.neededBy);
    return `<section class="block" style="margin-top:30px"><div class="sh"><h2>${title}</h2><p>${l.length || ''}</p></div>${l.length ? reqList(l) : `<p class="muted" style="padding:0 4px">${empty}</p>`}</section>`;
  };
  return `<div class="toolbar"><div class="chips">${[['active', 'Open'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) => `<button class="chip" aria-pressed="${f === k}" data-act="req-filter" data-f="${k}">${l}</button>`).join('')}</div></div>
    ${sec('planned', 'Planned transfusions', 'Bookings open automatically 7 days before each transfusion.')}
    ${sec('topup', 'Stock top-ups', 'Start a top-up from the Stock page when a group is running short.')}
    ${sec('urgent', 'Urgent requests', 'No urgent requests.')}`;
}

export function vBookings() {
  return `<div class="head"><div><h1>Bookings</h1><p class="sub">Planned transfusions, stock top-ups and urgent requests, from first message to donation.</p></div></div>
  <details class="fold card" style="padding:4px 22px;margin-bottom:34px" id="urgent-fold" ${UI.urgentOpen ? 'open' : ''}><summary style="padding:16px 0" data-act="urgent-fold"><span class="chev">${ic('chev', 16)}</span><h3>Start an urgent request</h3><span class="small faint">For needs you didn’t plan for</span></summary><div style="padding:0 0 22px">${quickComposer()}</div></details>
  <div id="bookings-live">${bookingsLive()}</div>`;
}
