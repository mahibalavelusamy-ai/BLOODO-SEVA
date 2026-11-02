import { GROUPS, COMP, PRIORITY, CONDITIONS } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import {
  $, esc, g, now, maskPhone, initials, first, fmtDate,
  fmtTime, fmtWhen, until, ymd, toast, validPin, recoveryDays
} from '../lib/helpers.js';
import {
  getState, bankLoc, shortDay, donorKm, eligibleNow, eligibleOn,
  circleCount
} from '../state/store.js';
import { candidates, isQuiet, compatibleGroups } from '../engine/matching.js';
import { bfText, bfSelect, bfDate, locFields, selectSS, setSSOptions, markErr, donorFields, HOURS } from './fields.js';
import { waMessage, inviteTag } from '../views/bookings.js';

let lastFocus = null;

export function openOverlay(html) {
  lastFocus = document.activeElement;
  const ov = $('#ov');
  if (!ov) return;
  ov.innerHTML = `<div class="scrim" data-act="close"></div>${html}`;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeOverlay() {
  const ov = $('#ov');
  if (!ov) return;
  ov.classList.remove('open');
  ov.innerHTML = '';
  document.body.style.overflow = '';
  lastFocus && lastFocus.focus && lastFocus.focus();
}

export function chatFor(req, v, d) {
  const S = getState();
  const b = [];
  const t = v.sentAt;
  const fn = first(d.name);
  const out = (x, tm) => b.push(`<div class="bub out">${x}<span class="t">${fmtTime(tm)}</span></div>`);
  const inn = (x, tm) => b.push(`<div class="bub in">${x}<span class="t">${fmtTime(tm)}</span></div>`);
  out(esc(waMessage(req, donorKm(d, req.loc || bankLoc()))).replace(/\*(.+?)\*/g, '<b>$1</b>'), t);
  b.push(`<div class="bub-btns"><span>Yes, I can</span><span>Not now</span><span>Pause alerts</span></div>`);
  if (v.status === 'sent') { b.push(`<div class="note">Delivered</div>`); }
  if (v.status === 'seen') b.push(`<div class="note">Read</div>`);
  const at = v.at || t;
  const loc = req.loc || bankLoc();
  if (['yes', 'ontheway', 'arrived', 'donated', 'deferred', 'noshow'].includes(v.status)) {
    if (req.kind === 'planned' || req.kind === 'topup') {
      inn('Yes, I can', at);
      out(`Thank you, ${esc(fn)}! You’re booked for ${esc(fmtWhen(req.neededBy))}. We’ll remind you the day before.`, at);
    } else {
      inn('Yes, I can', at);
      out(`Thank you, ${esc(fn)}! When can you reach the centre?`, at);
      inn(esc(v.eta || 'Within 1 hour'), at);
    }
    out(`📍 ${esc(loc.name)}, ${esc(loc.area || loc.district)}\nBefore you come: eat a light meal, drink water, and bring a photo ID.`, at);
  }
  if (['ontheway', 'arrived', 'donated', 'deferred'].includes(v.status) && req.kind !== 'planned') inn("I'm on my way", at);
  if (['arrived', 'donated', 'deferred'].includes(v.status)) out('Welcome! Show this message at the registration desk.', at);
  if (v.status === 'donated' && req.kind === 'planned') out(`Thank you, ${esc(fn)}. Your blood is ready for a child’s transfusion on ${shortDay(req.transfusionAt)}. You can donate again from ${fmtDate(now() + recoveryDays(d) * 864e5)}.`, at);
  else if (v.status === 'donated') out(`You did it, ${esc(fn)}. Your donation reaches a patient today. You can donate again from ${fmtDate(now() + recoveryDays(d) * 864e5)}, and we'll remind you.`, at);
  if (v.status === 'deferred') out(`Thank you for coming in, ${esc(fn)}. The team couldn't take a donation today and will explain why. We'll check in before asking again.`, at);
  if (v.status === 'noshow') out(`Looks like today didn't work out. No problem, we've released your slot.`, at);
  if (v.status === 'no') { inn('Not now', at); out('No problem. Can you tell us why? (optional)', at); if (v.reason) inn(esc(v.reason), at); out(`Thanks for letting us know. We won't ask again for ${S.rules.restAfterNo} days.`, at); }
  if (v.status === 'silent') b.push(`<div class="note">No reply. Bloodo doesn't send reminders.</div>`);
  if (v.status === 'standdown') out(`Update: this request is now covered. Thank you for being ready, ${esc(fn)}. You'll be first in line next time.`, at);
  if (v.status === 'cancelled') out(`Update: this request is no longer needed. Thank you, ${esc(fn)}.`, at);
  return b.join('');
}

export function openChat(rid, did) {
  const S = getState();
  const q = S.requests.find(x => x.id === rid), v = q && q.invites.find(x => x.donorId === did), d = S.donors.find(x => x.id === did);
  if (!v || !d) return;
  openOverlay(`<div class="drawer" role="dialog" aria-modal="true" aria-label="WhatsApp chat with ${esc(d.name)}">
    <div class="sheet-h"><div class="row"><div class="av">${esc(initials(d.name))}</div><div><h3>${esc(d.name)}</h3><div class="small muted">Via Bloodo on WhatsApp</div></div></div><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b"><div class="wa" style="min-height:60vh"><div class="chat">${chatFor(q, v, d)}</div></div>
    <p class="small muted">Messages are sent automatically. Your team only steps in to mark arrivals and donations.</p></div></div>`);
}

export function openAddPatient() {
  const nd = ymd(new Date(now() + 5 * 864e5));
  openOverlay(`<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="ap-h" data-form="add-patient" novalidate>
    <div class="sheet-h"><div><h2 id="ap-h">Add patient</h2><p class="small muted" style="margin-top:4px">Bloodo builds a donor circle and books a donor before each transfusion.</p></div><button type="button" class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b"><div class="bgrid">
      ${bfText({ name: 'name', id: 'ap-name', label: 'Patient name', placeholder: 'As in hospital records', icon: 'heart', cls: 'full' })}
      ${bfText({ name: 'age', label: 'Age (years)', placeholder: '0 to 99', digits: 2 })}
      ${bfSelect({ name: 'condition', label: 'Condition', options: CONDITIONS, value: CONDITIONS[0] })}
      <div class="field full"><span class="lbl">Blood group</span><div class="choices groups">${GROUPS.map(x => `<label class="choice"><input type="radio" name="group" value="${x}"><span>${g(x)}</span></label>`).join('')}</div></div>
      ${bfSelect({ name: 'interval', label: 'Transfusion every', options: [14, 21, 28, 35].map(n => ({ v: String(n), l: `${n} days` })), value: '21' })}
      <div class="field"><span class="lbl">Units each time</span><div class="stepper"><button type="button" data-act="step" data-n="-1" aria-label="One fewer unit">−</button><output>1</output><button type="button" data-act="step" data-n="1" aria-label="One more unit">+</button></div><input type="hidden" name="units" value="1"></div>
      ${bfDate({ name: 'next', label: 'Next transfusion', value: nd, min: ymd(new Date()), max: ymd(new Date(now() + 90 * 864e5)) })}
      ${bfSelect({ name: 'slot', label: 'Time', options: HOURS.filter(h => h.v >= '07:00' && h.v <= '18:00'), value: '10:00', search: true, searchPlaceholder: 'Type a time' })}
      ${bfText({ name: 'guardian', label: 'Parent or contact', placeholder: 'Name and relation' })}
      ${bfText({ name: 'gphone', label: 'Contact mobile (WhatsApp)', phone: 'mobile' })}
      <label class="check"><input type="checkbox" name="leuco" checked><span><span class="mid">Leucoreduced red cells</span></span></label>
      <label class="check"><input type="checkbox" name="phenotype"><span><span class="mid">Phenotype-matched units</span></span></label>
      <label class="check full"><input type="checkbox" name="consent"><span><span class="mid">The patient or guardian agreed to Bloodo arranging donors</span><br><span class="small muted">Donors never see the patient’s name or details.</span></span></label>
    </div><p class="err-t" data-err hidden></p></div>
    <div class="sheet-f"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Add and build circle</button></div></form>`);
  setTimeout(() => $('#ap-name') && $('#ap-name').focus(), 50);
}

export function openCircleAdd(pid) {
  const S = getState();
  const p = S.patients.find(x => x.id === pid);
  if (!p) return;
  const opts = S.donors.filter(d => d.group === p.group && d.consent && !p.circle.includes(d.id)).sort((a, b) => circleCount(a.id) - circleCount(b.id) || a.km - b.km);
  openOverlay(`<div class="drawer" role="dialog" aria-modal="true" aria-label="Add donor to circle">
    <div class="sheet-h"><div><h2 style="font-size:24px">Add to ${esc(first(p.name))}’s circle</h2><p class="small muted">${g(p.group)} donors only, so every unit matches exactly.</p></div><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b">${opts.length ? `<div class="rows">${opts.map(d => `<div class="rowi"><div class="av" style="border-radius:50%">${esc(initials(d.name))}</div><div class="grow"><div class="mid ellip">${esc(d.name)}</div><div class="small muted">${d.km} km, in ${circleCount(d.id)} circle${circleCount(d.id) === 1 ? '' : 's'}.</div></div><button class="btn sm" data-act="circle-pick" data-p="${p.id}" data-d="${d.id}">Add</button></div>`).join('')}</div>`
      : `<div class="empty"><h3>No more ${g(p.group)} donors</h3><p class="muted">Register more ${g(p.group)} donors at your next camp, or invite them from the Donors page.</p></div>`}</div></div>`);
}

export function hoursLeft(u) {
  const h = Math.max(0, Math.round((u.expiresAt - now()) / 3600e3));
  if (h < 24) return `${h} h`;
  const dd = Math.round(h / 24);
  return dd === 1 ? '1 day' : `${dd} days`;
}

export function openOffer(uid_) {
  const S = getState();
  const u = S.stock.find(x => x.id === uid_);
  if (!u) return;
  const list = S.network.slice().sort((a, b) => {
    const m = c => c.needs.some(([gp, cp]) => gp === u.group && cp === u.comp) ? 0 : 1;
    return m(a) - m(b) || a.km - b.km;
  });
  openOverlay(`<div class="drawer" role="dialog" aria-modal="true" aria-label="Offer unit">
    <div class="sheet-h"><div><h2 style="font-size:24px">Offer ${g(u.group)} ${esc(COMP[u.comp].short.toLowerCase())}</h2><p class="small muted">Expires in ${hoursLeft(u)}. Centres that need it are shown first.</p></div><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b"><div class="rows">${list.map(c => {
      const need = c.needs.some(([gp, cp]) => gp === u.group && cp === u.comp);
      return `<div class="rowi"><div class="av" style="border-radius:50%">${ic('building', 17)}</div><div class="grow"><div class="mid">${esc(c.name)}</div><div class="small muted">${esc(c.area)}, ${c.km} km</div>${need ? `<span class="pill ok sm" style="margin-top:6px">${ic('check', 12)}Needs this today</span>` : ''}</div><button class="btn ${need ? 'primary' : ''} sm" data-act="offer-to" data-u="${u.id}" data-c="${c.id}">Offer</button></div>`;
    }).join('')}</div>
      <p class="small muted">In the full version, offers go to the other centre’s Bloodo console and arrive as a request they can accept.</p></div></div>`);
}

export function openMore() {
  const NAV = [
    ['today', 'Today', 'home'],
    ['patients', 'Patients', 'heart'],
    ['bookings', 'Bookings', 'drop'],
    ['stock', 'Stock', 'box'],
    ['donors', 'Donors', 'users'],
    ['camps', 'Camps', 'cal'],
    ['centre', 'Centre', 'building']
  ];
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true" aria-label="More"><div class="sheet-h"><h2>More</h2><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b" style="gap:10px">${NAV.slice(4).map(([v, l, i]) => `<a class="rrow card" href="#/${v}" data-act="close" style="padding:16px 18px">${ic(i, 20)}<span class="title grow">${l}</span>${ic('chev', 18)}</a>`).join('')}</div></div>`);
}

export function openDonor(id) {
  const S = getState();
  const d = S.donors.find(x => x.id === id);
  if (!d) return;
  const hist = [];
  S.requests.forEach(q => q.invites.forEach(v => { if (v.donorId === d.id) hist.push({ q, v }); }));
  hist.sort((a, b) => b.v.sentAt - a.v.sentAt);
  const age = d.dob ? new Date().getFullYear() - new Date(d.dob).getFullYear() : null;

  openOverlay(`<div class="drawer" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
    <div class="sheet-h"><div class="row"><div class="tok sm">${g(d.group)}</div><div><h2 style="font-size:24px">${esc(d.name)}</h2><div class="small muted">${d.km} km, ${esc(d.city)}</div></div></div><button class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b">
      <div>${d.apheresis ? `<span class="pill calm">Platelet donor</span>` : ''}</div>
      <dl class="kv">
        <dt>Mobile</dt><dd>+91 ${esc(d.phone.slice(0, 5))} ${esc(d.phone.slice(5))}</dd>
        ${d.email ? `<dt>Email</dt><dd>${esc(d.email)}</dd>` : ''}
        <dt>Age</dt><dd>${age ?? '–'}</dd><dt>Gender</dt><dd>${esc(d.gender)}</dd>
        <dt>Lives in</dt><dd>${esc(d.city)}, ${esc(d.district)}</dd><dt>Distance</dt><dd>${d.km} km from the centre</dd>
        <dt>Last donated</dt><dd>${d.lastDonated ? fmtDate(d.lastDonated) : 'Never'}</dd>
        <dt>Can donate from</dt><dd>${eligibleNow(d) ? 'Now' : fmtDate(eligibleOn(d))}</dd>
        <dt>Donations</dt><dd>${d.donations}</dd><dt>Replies</dt><dd>${d.stats.asked ? `Said yes to ${d.stats.yes} of ${d.stats.asked} requests` : 'Not asked yet'}</dd>
        <dt>Donor circles</dt><dd>${S.patients.filter(p => p.circle.includes(d.id)).map(p => `<a href="#/patient/${p.id}" data-act="close" style="color:var(--red)">${esc(first(p.name))}</a>`).join(', ') || 'None'}</dd>
        <dt>WhatsApp consent</dt><dd>${d.consent ? `Given ${fmtDate(d.addedAt)}` : 'Not given'}</dd>
      </dl>
      <div class="row wrapflex" style="gap:8px">
        <button class="btn sm" data-act="walkin" data-d="${d.id}">${ic('drop', 15)}Record a donation today</button>
        ${d.pausedUntil && d.pausedUntil > now() ? `<button class="btn sm" data-act="resume" data-d="${d.id}">Resume alerts</button>` : `<button class="btn sm" data-act="pause" data-d="${d.id}">${ic('pause', 15)}Pause alerts for 30 days</button>`}
        <button class="btn ghost sm" data-act="remove-donor" data-d="${d.id}">${ic('trash', 15)}Remove</button>
      </div>
      <div><h3 style="font-size:18px;margin-bottom:6px">Requests sent</h3>
        ${hist.length ? `<div class="rows">${hist.map(({ q, v }) => `<div class="rowi" style="padding:10px 0"><div class="tok xs quiet">${g(q.group)}</div><div class="grow"><div class="small mid">${esc(COMP[q.comp].short)}, ${fmtWhen(v.sentAt)}</div></div>${inviteTag(v)}</div>`).join('')}</div>` : `<p class="small muted">No requests sent to ${esc(first(d.name))} yet.</p>`}
      </div>
    </div></div>`);
}

export function openAddDonor() {
  openOverlay(`<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="ad-h" data-form="add-donor" novalidate>
    <div class="sheet-h"><div><h2 id="ad-h">Add donor</h2><p class="small muted" style="margin-top:4px">Donors you add are verified by your centre.</p></div><button type="button" class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b">${donorFields()}</div>
    <div class="sheet-f"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Add donor</button></div></form>`);
  setTimeout(() => $('#f-name') && $('#f-name').focus(), 50);
}

export function openNewCamp() {
  openOverlay(`<form class="sheet" role="dialog" aria-modal="true" aria-labelledby="nc-h" data-form="new-camp" novalidate>
    <div class="sheet-h"><h2 id="nc-h">New camp</h2><button type="button" class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b"><div class="fgrid">
      <div class="field full"><label for="c-name">Camp name</label><input class="input" id="c-name" name="name" placeholder="e.g. Women's Christian College camp" required></div>
      ${bfDate({ name: 'date', label: 'Date', value: ymd(new Date()), min: ymd(new Date(now() - 60 * 864e5)), max: ymd(new Date(now() + 365 * 864e5)) })}
      <div class="field"><label for="c-org">Organised by</label><input class="input" id="c-org" name="organiser" placeholder="College, NSS unit or club"></div>
      <div class="field full"><label for="c-venue">Venue</label><input class="input" id="c-venue" name="venue" required></div>
    </div><p class="err-t" data-err hidden></p></div>
    <div class="sheet-f"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Create camp</button></div></form>`);
  setTimeout(() => $('#c-name') && $('#c-name').focus(), 50);
}

export function roundSlot(ts) {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(m === 0 || m === 30 ? m : (m < 30 ? 30 : 60));
  return d;
}

export function neededByFrom(f) {
  const d = f.get('nbDate'), t = f.get('nbTime');
  return d && t ? new Date(`${d}T${t}`).getTime() : null;
}

export function dateOpts() {
  const out = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    const lab = `${x.toLocaleDateString('en-IN', { weekday: 'short' })} ${x.getDate()} ${x.toLocaleDateString('en-IN', { month: 'short' })}`;
    out.push({ v: ymd(x), l: i === 0 ? `Today, ${lab}` : i === 1 ? `Tomorrow, ${lab}` : lab });
  }
  return out;
}

export function timeOpts(day) {
  const today = day === ymd(new Date());
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  return HOURS.map(o => {
    const [h, m] = o.v.split(':').map(Number);
    return { ...o, dis: today && h * 60 + m <= nowM };
  });
}

export function firstComp() {
  const S = getState();
  return Object.keys(COMP).find(k => S.bank.services[k]) || 'whole';
}

export function formLoc(form) {
  const S = getState();
  const f = new FormData(form);
  return {
    name: (f.get('locName') || '').trim() || (f.get('district') === S.bank.district ? S.bank.name : `Collection point, ${f.get('district') || ''}`),
    state: f.get('state'),
    district: f.get('district'),
    area: (f.get('area') || '').trim(),
    pin: (f.get('pin') || '').trim()
  };
}

export function locChanged(l) {
  const b = bankLoc();
  return l.name !== b.name || l.state !== b.state || l.district !== b.district || l.area !== b.area || l.pin !== b.pin;
}

export function senderPreview(B) {
  return `<b>${esc(B.sender || B.short || B.name)}</b> via Bloodo\n🩸 <b>Platelets needed: B+</b>\n${esc(B.name)}, 3.4 km from you\nCan you donate?`;
}

export function updatePreview() {
  const S = getState();
  const form = document.querySelector('[data-form="new-request"]');
  if (!form) return;
  const f = new FormData(form);
  const group = f.get('group'), comp = f.get('comp'), units = +f.get('units'), pr = f.get('priority');
  const nb = neededByFrom(f);
  const sum = $('#nb-sum');
  if (nb && sum) {
    const past = nb <= now();
    sum.className = 'nb-sum' + (past ? ' bad' : '');
    sum.innerHTML = `${ic('clock', 16)}<span>${past ? 'That time has passed. Pick a later time.' : `Needed by <b>${new Date(nb).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}, ${fmtTime(nb)}</b>, ${until(nb)}`}</span>`;
  }
  const loc = formLoc(form);
  const ch = locChanged(loc);
  const rst = $('#loc-reset');
  if (rst) rst.hidden = !ch;
  const note = $('#loc-note');
  if (note) note.textContent = ch ? 'Donors will be sent to this location instead of your centre.' : 'Filled in from your centre profile. Change it if donors should go to another collection point.';
  const box = $('#nr-preview'), go = $('#nr-go');
  if (!group) {
    if (box) box.innerHTML = `<div class="preview" style="background:var(--surface)"><span class="muted">Choose a blood group to see how many donors are ready.</span></div>`;
    if (go) go.innerHTML = `${ic('send', 17)}Find donors`;
    return;
  }
  const { list } = candidates({ group, comp, units, radius: S.rules.radiusKm, invites: [], loc });
  const size = Math.min(list.length, Math.max(3, Math.ceil(units * S.rules.perUnit)));
  const quiet = isQuiet() && pr !== 'critical';
  const compat = compatibleGroups(group, comp);
  if (box) {
    box.innerHTML = (list.length
      ? `<div class="preview"><div class="tok sm">${g(group)}</div><div><b>${list.length} donor${list.length > 1 ? 's' : ''} ready within ${S.rules.radiusKm} km of ${esc(loc.area ? loc.area + ', ' + loc.district : loc.district)}.</b> The first wave goes to ${size}.<div class="small muted" style="margin-top:2px">${compat.length > 1 ? `Includes compatible groups: ${compat.map(g).join(', ')}.` : (comp === 'rbc' ? `Only ${g(group)} donors are compatible.` : `Same group only for ${COMP[comp].name.toLowerCase()}.`)}</div></div></div>`
      : `<div class="notice"><b>No ready donors within ${S.rules.radiusKm} km of ${esc(loc.district ? (loc.area ? loc.area + ', ' : '') + loc.district : 'this location')}.</b> You can still start the request and widen the search, or call nearby centres.</div>`)
      + (quiet ? `<div class="notice" style="margin-top:10px;background:var(--calm-bg);color:var(--calm)">Quiet hours are on. This will be sent at ${S.rules.quietEnd}:00 am. Choose Critical to send now.</div>` : '');
  }
  if (go) {
    go.innerHTML = quiet ? `${ic('clock', 17)}Queue for ${S.rules.quietEnd}:00 am` : `${ic('send', 17)}Find donors`;
  }
}

export function setNeededBy(form, ts) {
  const d = new Date(ts);
  const dss = form.querySelector('[data-ss="nbDate"]'), tss = form.querySelector('[data-ss="nbTime"]');
  selectSS(dss, ymd(d), true);
  setSSOptions(tss, timeOpts(ymd(d)), `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
  updatePreview();
}

export function openNewRequest(pre = {}) {
  const S = getState();
  const B = S.bank;
  const def = new Date(pre.neededBy || roundSlot(now() + 6 * 3600e3).getTime());
  const dv = ymd(def), tv = `${String(def.getHours()).padStart(2, '0')}:${String(def.getMinutes()).padStart(2, '0')}`;
  const loc = bankLoc();
  openOverlay(`<form class="sheet wide" role="dialog" aria-modal="true" aria-labelledby="nr-h" data-form="new-request" novalidate>
    <div class="sheet-h"><div><h2 id="nr-h">Urgent request</h2><p class="small muted" style="margin-top:4px">Bloodo messages eligible donors on WhatsApp, in waves, until the need is covered.</p></div><button type="button" class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
    <div class="sheet-b" style="gap:28px">
      <div class="field"><span class="lbl">Blood group needed</span><div class="choices groups">${GROUPS.map(x => `<label class="choice"><input type="radio" name="group" value="${x}" ${pre.group === x ? 'checked' : ''}><span>${g(x)}</span></label>`).join('')}</div></div>
      <div class="field"><span class="lbl">Component</span><div class="choices">${Object.entries(COMP).map(([k, c]) => `<label class="choice" ${B.services[k] ? '' : 'title="Not collected at your centre. Turn it on in Centre profile."'}><input type="radio" name="comp" value="${k}" ${k === (pre.comp || firstComp()) ? 'checked' : ''} ${B.services[k] ? '' : 'disabled'}><span ${B.services[k] ? '' : 'style="opacity:.4"'}>${c.name}</span></label>`).join('')}</div></div>
      <div class="fgrid">
        <div class="field"><span class="lbl">Units</span><div><div class="stepper"><button type="button" data-act="step" data-n="-1" aria-label="One fewer unit">−</button><output id="u-out">${pre.units || 1}</output><button type="button" data-act="step" data-n="1" aria-label="One more unit">+</button></div><input type="hidden" name="units" value="${pre.units || 1}"></div></div>
        <div class="field"><span class="lbl">Priority</span><div class="choices">${Object.entries(PRIORITY).map(([k, l]) => `<label class="choice"><input type="radio" name="priority" value="${k}" ${k === 'urgent' ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      </div>
      <section class="fsec"><div class="fsec-h"><h3>Needed by</h3></div>
        <div class="chips">${[['2h', 'In 2 hours'], ['4h', 'In 4 hours'], ['tonight', 'Tonight, 9 pm'], ['tomorrow', 'Tomorrow, 9 am']].map(([k, l]) => `<button type="button" class="chip" data-act="nb-quick" data-k="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
        <div class="bgrid3">${bfSelect({ name: 'nbDate', label: 'Date', options: dateOpts(), value: dv })}${bfSelect({ name: 'nbTime', label: 'Time', options: timeOpts(dv), value: tv, search: true, searchPlaceholder: 'Type a time, e.g. 9:30' })}</div>
        <div class="nb-sum" id="nb-sum"></div>
      </section>
      <section class="fsec"><div class="fsec-h"><h3>Where donors should come</h3><a data-act="reset-loc" id="loc-reset" hidden>Use centre location</a></div>
        <p class="small muted" style="margin-top:-6px" id="loc-note">Filled in from your centre profile. Change it if donors should go to another collection point.</p>
        <div data-loc>${locFields(loc, { withName: true })}</div>
      </section>
      <div class="fgrid">
        ${bfText({ name: 'ref', label: 'Patient reference', placeholder: 'Ward, bed or patient ID', optional: true })}
        ${bfText({ name: 'notes', label: 'Note for your team', optional: true })}
      </div>
      <p class="hint" style="margin-top:-14px">The patient reference stays in this console. It's never sent to donors.</p>
      <div id="nr-preview"></div>
      <p class="err-t" data-err hidden></p>
    </div>
    <div class="sheet-f"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary lg" id="nr-go">${ic('send', 17)}Find donors</button></div></form>`);
  updatePreview();
}
