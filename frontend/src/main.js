import './styles/main.css';
import { COMP, INDIA } from './engine/constants.js';
import { ic } from './lib/icons.js';
import {
  $, esc, g, first, now, cleanPhone, validPin, toast
} from './lib/helpers.js';
import {
  getState, setState, save, load, seed, migrate, bankLoc,
  bookingFor, newPlanned, shortDay, recoveryDays, buildCircle
} from './state/store.js';
import {
  sendWave, startRequest, tick, act, flashIds, setWaveCallbacks, logR
} from './engine/waves.js';
import {
  closeAllSS, openSS, selectSS, filterSS, dpOpen, dpRender, dpSet,
  markErr, readDonor, locFields
} from './components/fields.js';
import {
  openOverlay, closeOverlay, openChat, openAddPatient, openCircleAdd,
  openOffer, openMore, openDonor, openAddDonor, openNewCamp, openNewRequest,
  updatePreview, setNeededBy, senderPreview, roundSlot, neededByFrom, formLoc, locChanged, timeOpts
} from './components/overlays.js';
import { vToday, todayLive, todaySummary, circleReady, expiring } from './views/today.js';
import {
  vBookings, bookingsLive, quickComposer, updateQuick, quickWhen, UI
} from './views/bookings.js';
import { vRequest } from './views/request.js';
import { vPatients, vPatient } from './views/patients.js';
import { vStock } from './views/stock.js';
import { vDonors, donorRows } from './views/donors.js';
import { vCamps, vCamp } from './views/camps.js';
import { vCentre } from './views/centre.js';

export function route() {
  const h = (location.hash || '#/today').slice(2).split('/');
  return { view: h[0] || 'today', id: h[1] };
}

const NAV = [
  ['today', 'Today', 'home'],
  ['patients', 'Patients', 'heart'],
  ['bookings', 'Bookings', 'drop'],
  ['stock', 'Stock', 'box'],
  ['donors', 'Donors', 'users'],
  ['camps', 'Camps', 'cal'],
  ['centre', 'Centre', 'building']
];
const MOBILE_NAV = 4;

export function shell() {
  const S = getState();
  const r = route().view;
  const alias = { request: 'bookings', requests: 'bookings', camp: 'camps', settings: 'centre', patient: 'patients' };
  const cur = v => (r === v || alias[r] === v) ? 'aria-current="page"' : '';
  const counts = {
    bookings: S.requests.filter(q => ['finding', 'stalled', 'queued'].includes(q.status)).length,
    patients: S.patients.filter(p => p.active && circleReady(p) < 3).length,
    stock: expiring(72).length
  };
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  return `<div class="navwrap"><nav class="topnav glass" aria-label="Main">
      <a class="brand" href="#/today"><div class="brand-mark">${ic('drop', 18, true)}</div><div><span class="brand-name">Bloodo</span><small>${esc(S.bank.short || S.bank.name)}</small></div></a>
      <div class="links">${NAV.map(([v, l, i]) => `<a href="#/${v}" ${cur(v)}>${ic(i, 17)}<span class="lbl">${l}</span>${counts[v] ? `<span class="count">${counts[v]}</span>` : ''}</a>`).join('')}</div>
      <div class="navact"><button class="iconbtn" data-act="theme" aria-label="Switch to ${dark ? 'light' : 'dark'} mode">${ic(dark ? 'sun' : 'moon', 17)}</button>
      <button class="btn primary" data-act="new-request">${ic('plus', 17)}<span class="nb-full">Urgent request</span><span class="nb-short">Urgent</span></button></div>
    </nav></div>
  <main class="main"><div class="wrap view" id="view">${viewHtml()}</div>
    <footer class="foot"><span>${esc(S.bank.name)}, ${esc(S.bank.area)}, ${esc(S.bank.district)}</span><span class="row" style="gap:6px">${ic('clock', 14)}Demo mode: replies are simulated, 1 second = 1 minute</span></footer></main>
  <nav class="tabbar glass" aria-label="Main">${NAV.slice(0, MOBILE_NAV).map(([v, l, i]) => `<a href="#/${v}" ${cur(v)}>${ic(i, 20)}${l}</a>`).join('')}<a href="#" data-act="more" ${NAV.slice(MOBILE_NAV).some(([v]) => cur(v)) ? 'aria-current="page"' : ''}>${ic('more', 20)}More</a></nav>`;
}

export function viewHtml() {
  const { view, id } = route();
  if (view === 'requests' || view === 'bookings') return vBookings();
  if (view === 'patients') return vPatients();
  if (view === 'patient') return vPatient(id);
  if (view === 'stock') return vStock();
  if (view === 'request') return vRequest(id);
  if (view === 'donors') return vDonors();
  if (view === 'camps') return vCamps();
  if (view === 'camp') return vCamp(id);
  if (view === 'settings') return vCentre('rules');
  if (view === 'centre') return vCentre(id || 'profile');
  return vToday();
}

export function render() {
  const app = $('#app');
  if (app) app.innerHTML = shell();
  afterRender();
}

export function softRender(changed) {
  const v = $('#view');
  if (!v) return;
  const rv = route().view;
  if (rv === 'today') {
    const l = $('#today-live'); if (l) l.innerHTML = todayLive();
    const sm = $('#today-sum'); if (sm) sm.textContent = todaySummary();
    afterRender();
    return;
  }
  if (rv === 'bookings' || rv === 'requests') {
    const l = $('#bookings-live'); if (l) l.innerHTML = bookingsLive();
    afterRender();
    return;
  }
  const a = document.activeElement;
  if (a && v.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  if (rv === 'request') {
    const open = [...v.querySelectorAll('details[open]')].map(x => x.id);
    v.innerHTML = viewHtml();
    open.forEach(i => { const e = document.getElementById(i); if (e) e.open = true; });
  } else if (changed && ['patients', 'patient', 'stock'].includes(rv)) {
    v.innerHTML = viewHtml();
  } else {
    return;
  }
  v.classList.remove('view');
  afterRender();
}

export function afterRender() {
  if (document.querySelector('[data-form="quick-request"]') && !afterRender._q) {
    afterRender._q = true;
    setTimeout(() => { afterRender._q = false; updateQuick(); }, 0);
  }
  const t = performance.now();
  document.querySelectorAll('[data-sync]').forEach(el => {
    el.style.animationDelay = `-${(t + +(el.dataset.off || 0)) % (+el.dataset.sync)}ms`;
  });
  document.querySelectorAll('.pill.live .dot').forEach(el => {
    el.style.animationDelay = `-${t % 2400}ms`;
  });
  document.querySelectorAll('[data-flash]').forEach(el => {
    if (flashIds.has(el.dataset.flash)) {
      el.classList.add('flash');
      flashIds.delete(el.dataset.flash);
    }
  });
}

export function applyTheme() {
  const S = getState();
  const r = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') r.dataset.theme = S.theme;
  else delete r.dataset.theme;
}

setWaveCallbacks({ render, softRender });

document.addEventListener('click', e => {
  if (!e.target.closest('.ss')) closeAllSS();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  const S = getState();
  const R = id => S.requests.find(q => q.id === id);

  switch (a) {
    case 'new-request': e.preventDefault(); openNewRequest(); break;
    case 'more': e.preventDefault(); openMore(); break;
    case 'add-patient': openAddPatient(); break;
    case 'urgent-fold': setTimeout(() => { UI.urgentOpen = $('#urgent-fold')?.open || false; }, 0); break;
    case 'book-now': {
      const P = S.patients.find(x => x.id === el.dataset.p);
      if (bookingFor(P)) break;
      const q = newPlanned(P);
      S.requests.push(q);
      startRequest(q);
      save();
      location.hash = '#/request/' + q.id;
      toast(`Asking ${esc(first(P.name))}’s circle on WhatsApp`, 'ok');
      break;
    }
    case 'edit-next': {
      const P = S.patients.find(x => x.id === el.dataset.p);
      const d = new Date(P.nextAt);
      openOverlay(`<form class="sheet" role="dialog" aria-modal="true" aria-label="Change next transfusion" data-form="edit-next" data-p="${P.id}" novalidate><div class="sheet-h"><h2>Next transfusion</h2><button type="button" class="iconbtn" data-act="close" aria-label="Close">${ic('x')}</button></div>
        <div class="sheet-b"><div class="bgrid">${bfDate({ name: 'next', label: 'Date', value: ymd(d), min: ymd(new Date()), max: ymd(new Date(now() + 90 * 864e5)) })}${bfSelect({ name: 'slot', label: 'Time', options: timeOpts(ymd(d)), value: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, search: true, searchPlaceholder: 'Type a time' })}</div>
        <p class="small muted">If a donor is already booked for the old date, they’ll get a message that it has moved, and Bloodo asks again.</p><p class="err-t" data-err hidden></p></div>
        <div class="sheet-f"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Save date</button></div></form>`);
      break;
    }
    case 'circle-add': openCircleAdd(el.dataset.p); break;
    case 'circle-pick': {
      const P = S.patients.find(x => x.id === el.dataset.p);
      P.circle.push(el.dataset.d);
      P.needsDonors = false;
      save();
      openCircleAdd(P.id);
      render();
      toast(`${esc(first(S.donors.find(d => d.id === el.dataset.d).name))} added. They’ll get a WhatsApp message to confirm.`, 'ok');
      break;
    }
    case 'circle-remove': {
      e.stopPropagation();
      const P = S.patients.find(x => x.id === el.dataset.p);
      const i = P.circle.indexOf(el.dataset.d);
      if (i >= 0) { P.circle.splice(i, 1); if (P.rot > i) P.rot--; }
      save();
      render();
      toast('Removed from the circle');
      break;
    }
    case 'patient-pause': {
      const P = S.patients.find(x => x.id === el.dataset.p);
      P.active = !P.active;
      save();
      render();
      toast(P.active ? 'Schedule resumed' : 'Schedule paused. No donors will be asked.');
      break;
    }
    case 'offer': openOffer(el.dataset.u); break;
    case 'offer-to': {
      const u = S.stock.find(x => x.id === el.dataset.u), c = S.network.find(x => x.id === el.dataset.c);
      u.status = 'offered';
      u.offerTo = c.id;
      u.acceptAt = now() + (4 + Math.random() * 5) * 1000;
      save();
      closeOverlay();
      render();
      toast(`Offered to ${esc(c.name)}. Waiting for them to accept.`);
      break;
    }
    case 'usefirst': {
      const u = S.stock.find(x => x.id === el.dataset.u);
      u.status = 'usefirst';
      save();
      render();
      toast('Flagged. Issue this unit before others of the same group.');
      break;
    }
    case 'discard': {
      const u = S.stock.find(x => x.id === el.dataset.u);
      if (!confirm('Discard this unit? It will be counted as expired.')) return;
      u.status = 'expired';
      u.at = now();
      S.stockStats.expiredThisMonth++;
      save();
      render();
      break;
    }
    case 'topup': {
      const gp = el.dataset.g, n = +el.dataset.n;
      const d = new Date(now() + 5 * 864e5);
      d.setHours(18, 0, 0, 0);
      const q = {
        id: 'r' + Math.random().toString(36).slice(2, 9),
        kind: 'topup', group: gp, comp: 'rbc', units: n, neededBy: d.getTime(), priority: 'routine', ref: '', notes: '',
        createdAt: now(), status: 'finding', wave: 0, waveDeadline: 0, radius: S.rules.radiusKm, invites: [], skipped: {}, loc: bankLoc(),
        log: [{ at: now(), t: `Top-up opened: ${gp} short by ${n} in the next 14 days` }]
      };
      S.requests.push(q);
      startRequest(q);
      save();
      location.hash = '#/request/' + q.id;
      toast(`Inviting ${gp.replace('-', '−')} donors for the week ahead`, 'ok');
      break;
    }
    case 'dp-toggle': {
      const dp = el.closest('.dp');
      dp.classList.contains('open') ? closeAllSS() : dpOpen(dp);
      return;
    }
    case 'dp-nav': {
      const dp = el.closest('.dp');
      const v = dp.dataset.view, d = +el.dataset.d;
      if (v === 'days') {
        let m = +dp.dataset.m + d, y = +dp.dataset.y;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        dp.dataset.m = m;
        dp.dataset.y = y;
      } else {
        dp.dataset.y = +dp.dataset.y + (v === 'months' ? d : d * 20);
      }
      dpRender(dp);
      return;
    }
    case 'dp-view': {
      const dp = el.closest('.dp');
      dp.dataset.view = el.dataset.v;
      dpRender(dp);
      return;
    }
    case 'dp-year': {
      const dp = el.closest('.dp');
      dp.dataset.y = el.dataset.y;
      dp.dataset.view = 'months';
      dpRender(dp);
      return;
    }
    case 'dp-month': {
      const dp = el.closest('.dp');
      dp.dataset.m = el.dataset.m;
      dp.dataset.view = 'days';
      dpRender(dp);
      return;
    }
    case 'dp-pick': {
      const dp = el.closest('.dp');
      const v = el.dataset.v;
      dp.dataset.y = v.slice(0, 4);
      dp.dataset.m = +v.slice(5, 7) - 1;
      dp.dataset.view = 'days';
      dpSet(dp, v);
      dp.querySelector('.ss-btn')?.focus();
      return;
    }
    case 'ss-toggle': {
      const ss = el.closest('.ss');
      ss.classList.contains('open') ? closeAllSS() : openSS(ss);
      break;
    }
    case 'ss-pick': {
      const ss = el.closest('.ss');
      selectSS(ss, el.dataset.v);
      ss.querySelector('.ss-btn')?.focus();
      break;
    }
    case 'nb-quick': {
      const form = el.closest('form');
      const k = el.dataset.k;
      let t;
      if (k === '2h') t = roundSlot(now() + 2 * 3600e3).getTime();
      if (k === '4h') t = roundSlot(now() + 4 * 3600e3).getTime();
      if (k === 'tonight') {
        const d = new Date(); d.setHours(21, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); t = d.getTime();
      }
      if (k === 'tomorrow') {
        const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); t = d.getTime();
      }
      setNeededBy(form, t);
      form.querySelectorAll('[data-act="nb-quick"]').forEach(c => c.setAttribute('aria-pressed', c === el));
      break;
    }
    case 'reset-loc': {
      const form = el.closest('form');
      form.querySelector('[data-loc]').innerHTML = locFields(bankLoc(), { withName: true });
      updatePreview();
      break;
    }
    case 'centre-reset': render(); toast('Changes discarded'); break;
    case 'add-donor': openAddDonor(); break;
    case 'new-camp': openNewCamp(); break;
    case 'close': closeOverlay(); break;
    case 'theme': {
      const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      S.theme = dark ? 'light' : 'dark';
      applyTheme();
      save();
      render();
      break;
    }
    case 'set-theme': S.theme = el.value === 'system' ? null : el.value; applyTheme(); save(); break;
    case 'req-filter': UI.reqFilter = el.dataset.f; render(); break;
    case 'grp': UI.grp = el.dataset.g; { const v = $('#view'); if (v) v.innerHTML = vDonors(); } break;
    case 'st': UI.st = el.dataset.s; { const v = $('#view'); if (v) v.innerHTML = vDonors(); } break;
    case 'clear-filters': UI.grp = 'all'; UI.st = 'all'; UI.q = ''; { const v = $('#view'); if (v) v.innerHTML = vDonors(); } break;
    case 'filter-group': UI.grp = el.dataset.g; UI.st = 'ready'; break;
    case 'donor': openDonor(el.dataset.d); break;
    case 'chat': openChat(el.dataset.r, el.dataset.d); break;
    case 'call': {
      const d = S.donors.find(x => x.id === el.dataset.d);
      toast(`Calling ${esc(first(d.name))} on a masked line. Your number and theirs stay hidden.`);
      break;
    }
    case 'inv': act(R(el.dataset.r), el.dataset.d, el.dataset.w); break;
    case 'next-wave': { const q = R(el.dataset.id); sendWave(q); save(); render(); break; }
    case 'widen': {
      const q = R(el.dataset.id);
      q.radius = q.radius < 30 ? 30 : 40;
      q.status = 'finding';
      q.wave = Math.min(q.wave, S.rules.maxWaves - 1);
      logR(q, `Search widened to ${q.radius} km`);
      sendWave(q);
      save();
      render();
      break;
    }
    case 'send-critical': {
      const q = R(el.dataset.id);
      q.priority = 'critical';
      logR(q, 'Marked critical and sent during quiet hours');
      sendWave(q);
      save();
      render();
      break;
    }
    case 'cancel-req': {
      const q = R(el.dataset.id);
      if (!confirm('Cancel this request? Donors who said yes or are waiting will get a message saying it is no longer needed.')) return;
      q.status = 'cancelled';
      q.closedAt = now();
      q.invites.forEach(v => {
        if (['sent', 'seen', 'yes', 'ontheway', 'arrived'].includes(v.status)) {
          v.status = 'cancelled';
          v.at = now();
        }
      });
      logR(q, 'Request cancelled');
      save();
      render();
      toast('Request cancelled. Donors were told.');
      break;
    }
    case 'step': {
      const form = el.closest('form');
      const inp = form.querySelector('[name="units"]');
      const n = Math.min(10, Math.max(1, +inp.value + +el.dataset.n));
      inp.value = n;
      const out = form.querySelector('.stepper output');
      if (out) out.textContent = n;
      updatePreview();
      updateQuick();
      break;
    }
    case 'quick-more': {
      const f = new FormData(el.closest('form'));
      openNewRequest({ group: f.get('group'), comp: f.get('comp'), units: +f.get('units'), neededBy: quickWhen(f.get('when')) });
      break;
    }
    case 'units': {
      const c = S.camps.find(x => x.id === el.dataset.c);
      c.units = Math.max(0, c.units + +el.dataset.n);
      save();
      el.parentElement.querySelector('output').textContent = c.units;
      break;
    }
    case 'walkin': {
      const d = S.donors.find(x => x.id === el.dataset.d);
      d.lastDonated = now();
      d.donations++;
      save();
      closeOverlay();
      render();
      toast(`Donation recorded for ${esc(first(d.name))}. They're resting for ${recoveryDays(d)} days.`, 'ok');
      break;
    }
    case 'pause': {
      const d = S.donors.find(x => x.id === el.dataset.d);
      d.pausedUntil = now() + 30 * 864e5;
      save();
      openDonor(d.id);
      render();
      toast(`Alerts paused for ${esc(first(d.name))}`);
      break;
    }
    case 'resume': {
      const d = S.donors.find(x => x.id === el.dataset.d);
      d.pausedUntil = null;
      save();
      openDonor(d.id);
      render();
      toast(`Alerts resumed for ${esc(first(d.name))}`);
      break;
    }
    case 'remove-donor': {
      const d = S.donors.find(x => x.id === el.dataset.d);
      if (!confirm(`Remove ${d.name}? Their details are deleted and they won't get any more messages.`)) return;
      S.donors = S.donors.filter(x => x !== d);
      S.requests.forEach(q => q.invites = q.invites.filter(v => v.donorId !== d.id));
      save();
      closeOverlay();
      render();
      toast('Donor removed');
      break;
    }
    case 'reset': {
      if (!confirm('Reset all demo data?')) return;
      try { localStorage.removeItem('bloodo-console-v2'); } catch (_) {}
      boot(true);
      toast('Demo data reset');
      break;
    }
  }
});

document.addEventListener('keydown', e => {
  const oss = document.querySelector('.ss.open');
  if (oss) {
    if (e.key === 'Escape') { e.preventDefault(); closeAllSS(); oss.querySelector('.ss-btn')?.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const opts = [...oss.querySelectorAll('.ss-opt:not([hidden]):not([disabled])')];
      if (!opts.length) return;
      let i = opts.findIndex(o => o.classList.contains('hl'));
      i = e.key === 'ArrowDown' ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
      opts.forEach(o => o.classList.remove('hl'));
      opts[i].classList.add('hl');
      opts[i].scrollIntoView({ block: 'nearest' });
      if (!oss.querySelector('[data-ss-search]')) opts[i].focus();
      return;
    }
    if (e.key === 'Enter') {
      const h = oss.querySelector('.ss-opt.hl:not([hidden])');
      if (h) { e.preventDefault(); selectSS(oss, h.dataset.v); oss.querySelector('.ss-btn')?.focus(); }
      return;
    }
    if (e.key === 'Tab') closeAllSS();
  }
  if (e.key === 'Escape' && $('#ov')?.classList.contains('open')) closeOverlay();
  if (e.key === 'Enter' && e.target.matches('tr[data-act="donor"]')) openDonor(e.target.dataset.d);
  if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$('#ov')?.classList.contains('open')) {
    e.preventDefault();
    openNewRequest();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'dq') { UI.q = e.target.value; const dtable = $('#dtable'); if (dtable) dtable.innerHTML = donorRows(); }
  if (e.target.matches('[data-ss-search]')) filterSS(e.target.closest('.ss'), e.target.value);
  if (e.target.dataset && e.target.dataset.phone) {
    const k = e.target.dataset.phone;
    const c = cleanPhone(e.target.value, k);
    if (c !== e.target.value) e.target.value = c;
    const el = e.target.parentElement.querySelector('.ph-c');
    if (el) {
      const st = k === 'mobile' ? (/^[6-9]\d{9}$/.test(c) ? { cls: 'good', txt: '✓' } : !/^[6-9]/.test(c) && c ? { cls: 'bad', txt: 'Starts with 6–9' } : { cls: '', txt: `${c.length}/10` }) : (/^\d{10,11}$/.test(c) ? { cls: 'good', txt: '✓' } : { cls: '', txt: `${c.length} digits` });
      el.className = 'ph-c ' + st.cls;
      el.textContent = st.txt;
    }
  }
  if (e.target.dataset && e.target.dataset.digits) {
    const c = e.target.value.replace(/\D/g, '').slice(0, +e.target.dataset.digits);
    if (c !== e.target.value) e.target.value = c;
  }
  if (e.target.name === 'sender' || e.target.name === 'name') {
    const p = document.querySelector('[data-sender-preview]');
    const form = e.target.closest('form');
    if (p && form) {
      const f = new FormData(form);
      const S = getState();
      p.innerHTML = senderPreview({ ...S.bank, sender: f.get('sender'), name: f.get('name') }) + '<span class="t">Bloodo</span>';
    }
  }
  if (e.target.closest('[data-form="new-request"]')) updatePreview();
  if (e.target.closest('.bf')) e.target.closest('.bf').classList.remove('err');
});

document.addEventListener('change', e => {
  const t = e.target, form = t.closest('form');
  const S = getState();
  if (form && form.dataset.form === 'new-request') updatePreview();
  if (form && form.dataset.form === 'quick-request') updateQuick();
  if (t.name === 'state' && form) {
    const ds = form.querySelector('[data-ss="district"]');
    if (ds) {
      setSSOptions(ds, INDIA[t.value] || [], '');
    }
  }
  if ((t.name === 'district' || t.name === 'state') && form && form.dataset.form === 'new-request') {
    const a = form.querySelector('[name="area"]'), pn = form.querySelector('[name="pin"]'), ln = form.querySelector('[name="locName"]');
    if (a && a.value === S.bank.area) a.value = '';
    if (pn && pn.value === S.bank.pin) pn.value = '';
    if (ln && ln.value === S.bank.name) ln.value = '';
    if (ln) ln.placeholder = 'Hospital or camp where donors should go';
    updatePreview();
  }
  if (t.name === 'nbDate' && form) {
    const tss = form.querySelector('[data-ss="nbTime"]');
    const cur = tss.querySelector('input').value;
    const opts = timeOpts(t.value);
    const ok = opts.find(o => o.v === cur && !o.dis);
    setSSOptions(tss, opts, ok ? cur : (opts.find(o => !o.dis) || { v: '' }).v);
  }
  if ((t.name === 'nbDate' || t.name === 'nbTime') && form) {
    form.querySelectorAll('[data-act="nb-quick"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
    updatePreview();
  }
  if (t.name === 'hours' && form) {
    const h = form.querySelector('[data-hours]');
    if (h) h.hidden = t.value === '24h';
  }
  if (t.name === 'dob') {
    const a = t.value ? new Date().getFullYear() - new Date(t.value).getFullYear() : null;
    const b = form && form.querySelector('[data-age-for="dob"]');
    if (b) {
      b.hidden = a === null;
      b.querySelector('b').textContent = a ?? '';
      b.classList.toggle('warn', a !== null && (a < 18 || a > 65));
    }
    const h = form && form.querySelector('[data-hint-for="dob"]');
    if (h) {
      h.className = 'hint dp-hint ' + (a === null ? '' : (a < 18 || a > 65) ? 'bad' : 'good');
      h.textContent = a === null ? 'Donors must be 18 to 65 years old.' : a < 18 ? `Not eligible: ${a} is under 18.` : a > 65 ? `Not eligible: ${a} is over 65.` : `Age ${a}: eligible by age.`;
    }
  }
  if (t.name === 'lastMode' && form) {
    const dp = form.querySelector('[data-dp="lastDate"]');
    const off = t.value !== 'date';
    dp.querySelector('input').disabled = off;
    const btn = dp.querySelector('.ss-btn');
    btn.disabled = off;
    btn.classList.toggle('disabled', off);
    if (off) {
      dp.querySelector('input').value = '';
      const l = dp.querySelector('.bf-v');
      l.textContent = l.dataset.ph;
      l.classList.add('ph');
    } else {
      dpOpen(dp);
    }
  }
});

document.addEventListener('submit', e => {
  const form = e.target;
  const k = form.dataset.form;
  if (!k) return;
  e.preventDefault();
  const f = new FormData(form);
  const S = getState();

  if (k === 'new-request') {
    const err = form.querySelector('[data-err]');
    const group = f.get('group');
    const nb = neededByFrom(f);
    if (!group) { err.hidden = false; err.textContent = 'Choose the blood group needed.'; return; }
    if (!nb || nb < now()) { err.hidden = false; err.textContent = 'Pick a date and time in the future.'; markErr(form, 'nbTime'); return; }
    const loc = formLoc(form);
    if (!loc.district) { err.hidden = false; err.textContent = 'Choose the district where donors should come.'; markErr(form, 'district'); return; }
    if (loc.pin && !validPin(loc.pin)) { err.hidden = false; err.textContent = 'Enter a 6-digit PIN code that doesn’t start with 0.'; markErr(form, 'pin'); return; }
    const req = {
      id: 'r' + Math.random().toString(36).slice(2, 9),
      kind: 'urgent', group, comp: f.get('comp'), units: +f.get('units'), neededBy: nb, priority: f.get('priority'),
      ref: (f.get('ref') || '').trim(), notes: (f.get('notes') || '').trim(),
      createdAt: now(), status: 'finding', wave: 0, waveDeadline: 0, radius: S.rules.radiusKm, invites: [], skipped: {}, loc,
      log: [{ at: now(), t: locChanged(loc) ? `Request created for ${loc.name}` : 'Request created' }]
    };
    S.requests.push(req);
    startRequest(req);
    save();
    closeOverlay();
    location.hash = '#/request/' + req.id;
    toast(req.status === 'queued' ? 'Request queued for the morning' : req.status === 'stalled' ? 'No eligible donors found nearby' : `Wave 1 sent on WhatsApp`, req.status === 'finding' ? 'ok' : '');
  }

  if (k === 'add-patient') {
    const err = form.querySelector('[data-err]');
    const v = x => (f.get(x) || '').toString().trim();
    const errs = [];
    form.querySelectorAll('.err').forEach(x => x.classList.remove('err'));
    if (v('name').length < 2) errs.push(['name', 'Enter the patient’s name.']);
    if (!/^\d{1,2}$/.test(v('age'))) errs.push(['age', 'Enter the age in whole years, 0 to 99.']);
    if (!v('group')) errs.push(['group', 'Choose a blood group.']);
    if (!v('next')) errs.push(['next', 'Pick the next transfusion date.']);
    if (!/^[6-9]\d{9}$/.test(cleanPhone(v('gphone'), 'mobile'))) errs.push(['gphone', 'Enter the contact’s 10-digit mobile number. It starts with 6, 7, 8 or 9.']);
    if (v('next')) {
      const at = new Date(`${v('next')}T${v('slot') || '10:00'}`).getTime();
      if (at <= now()) errs.push(['next', 'Pick a date and time in the future.']);
    }
    if (!f.get('consent')) errs.push(['consent', 'Consent is needed before Bloodo arranges donors.']);
    if (errs.length) {
      const f0 = errs.map(([x]) => markErr(form, x))[0];
      err.hidden = false;
      err.textContent = errs.map(x => x[1]).join(' ');
      f0 && f0.focus && f0.focus();
      return;
    }
    const P = {
      id: 'p' + Math.random().toString(36).slice(2, 9),
      name: v('name'), age: +v('age'), condition: v('condition'), group: v('group'), interval: +v('interval'), units: +v('units') || 1,
      nextAt: new Date(`${v('next')}T${v('slot') || '10:00'}`).getTime(), guardian: v('guardian') || 'Not given',
      guardianPhone: cleanPhone(v('gphone'), 'mobile'), leuco: !!f.get('leuco'), phenotype: !!f.get('phenotype'),
      circle: [], rot: 0, active: true, addedAt: now(), history: []
    };
    S.patients.push(P);
    buildCircle(P, S.rules.circleSize);
    save();
    closeOverlay();
    location.hash = '#/patient/' + P.id;
    toast(`${esc(first(P.name))} added with ${P.circle.length} donor${P.circle.length === 1 ? '' : 's'} in the circle`, 'ok');
  }

  if (k === 'edit-next') {
    const P = S.patients.find(x => x.id === form.dataset.p);
    const at = new Date(`${f.get('next')}T${f.get('slot') || '10:00'}`).getTime();
    const err = form.querySelector('[data-err]');
    if (!(at > now())) { err.hidden = false; err.textContent = 'Pick a date and time in the future.'; return; }
    const old = bookingFor(P);
    if (old && ['finding', 'covered', 'queued', 'stalled'].includes(old.status)) {
      old.status = 'cancelled';
      old.closedAt = now();
      old.invites.forEach(v => {
        if (['sent', 'seen', 'yes'].includes(v.status)) {
          v.status = 'cancelled';
          v.at = now();
        }
      });
      logR(old, 'Transfusion moved. Donors were told');
    }
    P.nextAt = at;
    save();
    closeOverlay();
    render();
    toast(`Next transfusion moved to ${shortDay(at)}`, 'ok');
  }

  if (k === 'quick-request') {
    const err = form.querySelector('[data-err]');
    const group = f.get('group');
    if (!group) { err.hidden = false; err.textContent = 'Choose the blood group needed.'; return; }
    const loc = bankLoc();
    const req = {
      id: 'r' + Math.random().toString(36).slice(2, 9),
      kind: 'urgent', group, comp: f.get('comp'), units: +f.get('units'), neededBy: quickWhen(f.get('when')),
      priority: 'urgent', ref: '', notes: '', createdAt: now(), status: 'finding', wave: 0, waveDeadline: 0,
      radius: S.rules.radiusKm, invites: [], skipped: {}, loc, log: [{ at: now(), t: 'Request created' }]
    };
    S.requests.push(req);
    startRequest(req);
    save();
    location.hash = '#/request/' + req.id;
    toast(req.status === 'queued' ? 'Request queued for the morning' : req.status === 'stalled' ? 'No eligible donors found nearby' : 'Wave 1 sent on WhatsApp', req.status === 'finding' ? 'ok' : '');
  }

  if (k === 'add-donor') {
    const d = readDonor(form);
    if (!d) return;
    S.donors.push(d);
    save();
    closeOverlay();
    render();
    toast(`${esc(first(d.name))} added. A WhatsApp welcome message confirms their consent.`, 'ok');
  }

  if (k === 'camp-donor') {
    const c = S.camps.find(x => x.id === form.dataset.c);
    const d = readDonor(form, { state: c.state, district: c.district, source: c.id });
    if (!d) return;
    S.donors.push(d);
    save();
    render();
    toast(`${esc(first(d.name))} registered`, 'ok');
    setTimeout(() => { const n = $('#f-name'); n && n.focus(); }, 30);
  }

  if (k === 'new-camp') {
    const name = (f.get('name') || '').trim(), venue = (f.get('venue') || '').trim();
    const err = form.querySelector('[data-err]');
    if (!name || !venue || !f.get('date')) { err.hidden = false; err.textContent = 'Add a name, date and venue for the camp.'; return; }
    const c = {
      id: 'c' + Math.random().toString(36).slice(2, 9),
      name, venue, organiser: (f.get('organiser') || '').trim() || 'Your centre',
      date: new Date(f.get('date') + 'T10:00').getTime(), units: 0, state: S.bank.state, district: S.bank.district
    };
    S.camps.push(c);
    save();
    closeOverlay();
    location.hash = '#/camp/' + c.id;
    toast('Camp created');
  }

  if (k === 'rules') {
    const R = S.rules;
    const RANGE = {
      maxPerMonth: [1, 4, 'Requests per donor each month'],
      restAfterNo: [1, 60, 'Days of rest'],
      quietStart: [0, 23, 'Quiet hours start'],
      quietEnd: [0, 23, 'Quiet hours end'],
      perUnit: [1, 10, 'Donors per unit'],
      timeoutMin: [5, 120, 'Minutes before the next wave'],
      radiusKm: [2, 60, 'Search distance'],
      maxWaves: [1, 8, 'Most waves']
    };
    form.querySelectorAll('.err').forEach(x => x.classList.remove('err'));
    const bad = [];
    Object.entries(RANGE).forEach(([x, [lo, hi, l]]) => {
      const raw = (f.get(x) || '').toString().trim();
      const n = Number(raw);
      if (raw === '' || !Number.isInteger(n) || n < lo || n > hi) {
        bad.push(`${l}: ${lo} to ${hi}.`);
        markErr(form, x);
      }
    });
    if (bad.length) { toast('Check the highlighted rules. ' + esc(bad[0])); return; }
    Object.keys(RANGE).forEach(x => R[x] = parseInt(f.get(x), 10));
    save();
    toast('Rules saved', 'ok');
  }

  if (k === 'centre') {
    const v = x => (f.get(x) || '').toString().trim();
    const err = form.querySelector('[data-err]');
    const errs = [];
    form.querySelectorAll('.err').forEach(e => e.classList.remove('err'));
    if (v('name').length < 3) errs.push(['name', 'Enter the centre name.']);
    if (!v('district')) errs.push(['district', 'Choose a district.']);
    if (v('pin') && !validPin(v('pin'))) errs.push(['pin', 'Enter a 6-digit PIN code that doesn’t start with 0.']);
    if (!/^\d{10,11}$/.test(cleanPhone(v('phone'), 'landline'))) errs.push(['phone', 'Enter a 10-digit mobile, or a landline with STD code (10 or 11 digits).']);
    if (v('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) errs.push(['email', 'Enter a valid email address.']);
    if (v('hours') === 'set' && v('open') >= v('close')) errs.push(['close', 'Closing time must be after opening time.']);
    if (errs.length) {
      const f0 = errs.map(([k]) => markErr(form, k))[0];
      err.hidden = false;
      err.textContent = errs.map(e => e[1]).join(' ');
      f0 && f0.focus && f0.focus();
      return;
    }
    const B = S.bank;
    ['name', 'short', 'type', 'licence', 'officer', 'address', 'state', 'district', 'area', 'city', 'pin', 'phone', 'email', 'hours', 'open', 'close', 'sender'].forEach(x => B[x] = v(x));
    B.phone = cleanPhone(B.phone, 'landline');
    B.short = B.short || B.name;
    B.sender = B.sender || B.short;
    Object.keys(COMP).forEach(k => B.services[k] = !!f.get('svc_' + k));
    save();
    render();
    toast('Centre profile saved', 'ok');
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

/* ---------- boot ---------- */
let timer = null;
export function boot(fresh) {
  let loaded = fresh ? null : load();
  if (!loaded) {
    seed();
    loaded = getState();
    const live = {
      id: 'r3', kind: 'urgent', group: 'A+', comp: 'rbc', units: 2, neededBy: now() + 5 * 3600e3,
      priority: 'urgent', ref: 'Ward 7, bed 22', notes: 'Post-delivery bleeding',
      createdAt: now(), status: 'finding', wave: 0, waveDeadline: 0, radius: loaded.rules.radiusKm,
      invites: [], skipped: {}, log: [{ at: now(), t: 'Request created' }]
    };
    loaded.requests.push(live);
    sendWave(live);
    save();
  } else {
    setState(loaded);
  }
  migrate();
  applyTheme();
  render();
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
}

boot();
