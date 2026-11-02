import { INDIA, GROUPS, MONTHS, DAY } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import {
  esc, normOpts, ymd, cleanPhone, phoneStatus, validPin,
  DOB_MIN, DOB_MAX, ageFrom, now, uid
} from '../lib/helpers.js';
import { getState, bankLoc } from '../state/store.js';

export function fmtHM(h, m) {
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

export const HOURS = [...Array(48).keys()].map(i => {
  const h = Math.floor(i / 2), m = i % 2 ? '30' : '00';
  return { v: `${String(h).padStart(2, '0')}:${m}`, l: fmtHM(h, m) };
});

export function ssOptions(options, value) {
  return normOpts(options).map(o => `<button type="button" class="ss-opt" role="option" data-act="ss-pick" data-v="${esc(o.v)}" aria-selected="${o.v === value}" ${o.dis ? 'disabled' : ''}><span>${esc(o.l)}${o.sub ? ` <small>${esc(o.sub)}</small>` : ''}</span>${o.v === value ? ic('check', 15) : ''}</button>`).join('') + `<div class="ss-empty" hidden>No matches</div>`;
}

export function bfSelect({ name, label, options, value = '', placeholder = 'Select…', search = false, searchPlaceholder = 'Search…', cls = '' }) {
  const o = normOpts(options).find(x => x.v === value);
  return `<div class="ss ${cls}" data-ss="${name}"><input type="hidden" name="${name}" value="${esc(value)}">
    <button type="button" class="bf ss-btn" data-act="ss-toggle" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(label)}">
      <span class="bf-l">${label}</span><span class="bf-row"><span class="bf-v ${o ? '' : 'ph'}" data-ph="${esc(placeholder)}">${esc(o ? o.l : placeholder)}</span><span class="ss-chev">${ic('chevdown', 16)}</span></span></button>
    <div class="ss-pop" hidden>${search ? `<label class="ss-search">${ic('search', 15)}<input type="text" data-ss-search placeholder="${esc(searchPlaceholder)}" aria-label="${esc(searchPlaceholder)}" autocomplete="off"></label>` : ''}<div class="ss-list" role="listbox">${ssOptions(options, value)}</div></div></div>`;
}

export function bfText({ name, label, value = '', placeholder = '', type = 'text', icon = '', prefix = '', inputmode = '', maxlength = '', optional = false, id = '', cls = '', min = '', max = '', phone = '', digits = 0 }) {
  if (phone) {
    const st = phoneStatus(value, phone);
    return `<label class="bf ${cls}"><span class="bf-l">${label}${optional ? ' <span class="opt">(optional)</span>' : ''}</span><span class="bf-row">${icon ? ic(icon, 16) : ''}<span class="pre">+91</span><input name="${name}" ${id ? `id="${id}"` : ''} type="tel" inputmode="numeric" autocomplete="off" data-phone="${phone}" value="${esc(value)}" placeholder="${esc(placeholder || (phone === 'mobile' ? '98765 43210' : '044 2530 5000'))}"><span class="ph-c ${st.cls}" aria-live="polite">${st.txt}</span></span></label>`;
  }
  if (digits) {
    return `<label class="bf ${cls}"><span class="bf-l">${label}${optional ? ' <span class="opt">(optional)</span>' : ''}</span><span class="bf-row">${icon ? ic(icon, 16) : ''}<input name="${name}" ${id ? `id="${id}"` : ''} type="text" inputmode="numeric" data-digits="${digits}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></span></label>`;
  }
  return `<label class="bf ${cls}"><span class="bf-l">${label}${optional ? ' <span class="opt">(optional)</span>' : ''}</span><span class="bf-row">${icon ? ic(icon, 16) : ''}${prefix ? `<span class="pre">${prefix}</span>` : ''}<input name="${name}" ${id ? `id="${id}"` : ''} type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${inputmode ? `inputmode="${inputmode}"` : ''} ${maxlength ? `maxlength="${maxlength}"` : ''} ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} autocomplete="off"></span></label>`;
}

export function dpFmt(v) {
  if (!v) return '';
  const d = new Date(v + 'T00:00');
  return `${d.toLocaleDateString('en-IN', { weekday: 'short' })}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function bfDate({ name, label, value = '', min = '', max = '', age = false, disabled = false, cls = '', hint = '', start = '' }) {
  const a = age && value ? ageFrom(value) : null;
  const base = value || start || (max && max < ymd(new Date()) ? max : ymd(new Date()));
  const bd = new Date(base + 'T00:00');
  return `<div class="dpw ${cls}"><div class="ss dp" data-dp="${name}" data-min="${min}" data-max="${max}" data-y="${bd.getFullYear()}" data-m="${bd.getMonth()}" data-view="${!value && age ? 'years' : 'days'}">
    <input type="hidden" name="${name}" value="${esc(value)}" ${disabled ? 'disabled' : ''}>
    <button type="button" class="bf ss-btn ${disabled ? 'disabled' : ''}" data-act="dp-toggle" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(label)}" ${disabled ? 'disabled' : ''}>
      <span class="bf-l">${label}</span><span class="bf-row">${ic('cal', 16)}<span class="bf-v ${value ? '' : 'ph'}" data-ph="Select a date">${value ? dpFmt(value) : 'Select a date'}</span>
      ${age ? `<span class="agebadge ${a !== null && (a < 18 || a > 65) ? 'warn' : ''}" data-age-for="${name}" ${a === null ? 'hidden' : ''}><b>${a ?? ''}</b><small>Age</small></span>` : ''}<span class="ss-chev">${ic('chevdown', 16)}</span></span></button>
    <div class="ss-pop dp-pop" hidden></div></div>${hint ? `<p class="hint dp-hint" data-hint-for="${name}">${hint}</p>` : ''}</div>`;
}

export function dpRender(dp) {
  const pop = dp.querySelector('.dp-pop');
  const val = dp.querySelector('input').value;
  const min = dp.dataset.min, max = dp.dataset.max;
  const view = dp.dataset.view || 'days';
  const y = +dp.dataset.y, m = +dp.dataset.m;
  const today = ymd(new Date());
  const inRange = v => (!min || v >= min) && (!max || v <= max);
  const pad = n => String(n).padStart(2, '0');
  let title = '', body = '', next = '';

  if (view === 'days') {
    title = `${MONTHS[m]} ${y}`; next = 'months';
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    body = `<div class="dp-grid">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(w => `<span class="dp-wd">${w}</span>`).join('')}${'<span></span>'.repeat(first)}${Array.from({ length: days }, (_, i) => { const v = `${y}-${pad(m + 1)}-${pad(i + 1)}`; return `<button type="button" class="dp-day ${v === val ? 'sel' : ''} ${v === today ? 'today' : ''}" data-act="dp-pick" data-v="${v}" ${inRange(v) ? '' : 'disabled'} aria-label="${dpFmt(v)}">${i + 1}</button>`; }).join('')}</div>`;
  } else if (view === 'months') {
    title = String(y); next = 'years';
    body = `<div class="dp-cells">${MONTHS.map((n, i) => { const lo = `${y}-${pad(i + 1)}-01`, hi = `${y}-${pad(i + 1)}-${new Date(y, i + 1, 0).getDate()}`; const ok = (!max || lo <= max) && (!min || hi >= min); return `<button type="button" class="dp-cell ${val && +val.slice(0, 4) === y && +val.slice(5, 7) === i + 1 ? 'sel' : ''}" data-act="dp-month" data-m="${i}" ${ok ? '' : 'disabled'}>${n.slice(0, 3)}</button>`; }).join('')}</div>`;
  } else {
    const y0 = y - (y % 20); title = `${y0} – ${y0 + 19}`; next = 'days';
    body = `<div class="dp-cells years">${Array.from({ length: 20 }, (_, i) => { const yy = y0 + i; const ok = (!max || `${yy}-01-01` <= max) && (!min || `${yy}-12-31` >= min); return `<button type="button" class="dp-cell ${val && +val.slice(0, 4) === yy ? 'sel' : ''}" data-act="dp-year" data-y="${yy}" ${ok ? '' : 'disabled'}>${yy}</button>`; }).join('')}</div>`;
  }
  const canToday = inRange(today);
  pop.innerHTML = `<div class="dp-h"><button type="button" class="iconbtn" data-act="dp-nav" data-d="-1" aria-label="Previous">${ic('back', 16)}</button>
    <button type="button" class="dp-title" data-act="dp-view" data-v="${next}">${title}${ic('chevdown', 14)}</button>
    <button type="button" class="iconbtn" data-act="dp-nav" data-d="1" aria-label="Next">${ic('chev', 16)}</button></div>${body}
    ${canToday && view === 'days' ? `<div class="dp-f"><button type="button" class="chip" data-act="dp-pick" data-v="${today}">Today</button></div>` : ''}`;
}

export function closeAllSS(except) {
  document.querySelectorAll('.ss.open').forEach(ss => {
    if (ss === except) return;
    ss.classList.remove('open');
    ss.querySelector('.ss-pop').hidden = true;
    ss.querySelector('.ss-btn').setAttribute('aria-expanded', 'false');
  });
}

export function dpOpen(dp) {
  closeAllSS(dp);
  dp.classList.add('open');
  dp.querySelector('.ss-btn').setAttribute('aria-expanded', 'true');
  dpRender(dp);
  dp.querySelector('.dp-pop').hidden = false;
  const s = dp.querySelector('.dp-day.sel') || dp.querySelector('.dp-cell.sel');
  s && s.focus();
}

export function dpSet(dp, v) {
  const inp = dp.querySelector('input');
  inp.value = v;
  const lab = dp.querySelector('.bf-v');
  lab.textContent = v ? dpFmt(v) : lab.dataset.ph;
  lab.classList.toggle('ph', !v);
  dp.querySelector('.bf').classList.remove('err');
  closeAllSS();
  inp.dispatchEvent(new Event('change', { bubbles: true }));
}

export function openSS(ss) {
  closeAllSS(ss);
  ss.classList.add('open');
  const pop = ss.querySelector('.ss-pop');
  pop.hidden = false;
  ss.querySelector('.ss-btn').setAttribute('aria-expanded', 'true');
  const q = pop.querySelector('[data-ss-search]');
  if (q) { q.value = ''; filterSS(ss, ''); q.focus(); }
  const sel = pop.querySelector('[aria-selected="true"]') || pop.querySelector('.ss-opt:not([disabled])');
  pop.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  if (sel) { sel.classList.add('hl'); sel.scrollIntoView({ block: 'nearest' }); if (!q) sel.focus(); }
}

export function filterSS(ss, q) {
  q = q.toLowerCase().trim();
  let n = 0;
  ss.querySelectorAll('.ss-opt').forEach(o => {
    const m = !q || o.textContent.toLowerCase().includes(q);
    o.hidden = !m;
    if (m) n++;
  });
  ss.querySelector('.ss-empty').hidden = n > 0;
  const f = ss.querySelector('.ss-opt:not([hidden]):not([disabled])');
  ss.querySelectorAll('.hl').forEach(x => x.classList.remove('hl'));
  f && f.classList.add('hl');
}

export function selectSS(ss, v, silent) {
  const inp = ss.querySelector('input[type=hidden]');
  inp.value = v;
  const opts = [...ss.querySelectorAll('.ss-opt')];
  const o = opts.find(x => x.dataset.v === v);
  opts.forEach(x => {
    const on = x.dataset.v === v;
    x.setAttribute('aria-selected', on);
    const c = x.querySelector('svg');
    if (c && !on) c.remove();
    if (on && !c) x.insertAdjacentHTML('beforeend', ic('check', 15));
  });
  const lab = ss.querySelector('.bf-v');
  lab.textContent = o ? o.querySelector('span').textContent : lab.dataset.ph;
  lab.classList.toggle('ph', !o);
  ss.querySelector('.bf').classList.remove('err');
  closeAllSS();
  if (!silent) inp.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setSSOptions(ss, options, value = '') {
  ss.querySelector('.ss-list').innerHTML = ssOptions(options, value);
  selectSS(ss, value, true);
}

export function markErr(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return null;
  const box = el.type === 'hidden' ? el.closest('.ss').querySelector('.bf') : (el.closest('.bf') || el.closest('.check') || el);
  box.classList.add('err');
  return el.type === 'hidden' ? box : el;
}

export function locFields(loc, o = {}) {
  return `<div class="bgrid">
    ${o.withName ? bfText({ name: 'locName', label: 'Collection point', value: loc.name, icon: 'building', cls: 'full' }) : ''}
    ${bfSelect({ name: 'state', label: 'State', options: Object.keys(INDIA), value: loc.state, search: true, searchPlaceholder: 'Search states' })}
    ${bfSelect({ name: 'district', label: 'District', options: INDIA[loc.state] || [], value: loc.district, placeholder: 'Select district', search: true, searchPlaceholder: 'Search districts' })}
    ${bfText({ name: 'area', label: 'Area / locality', value: loc.area, placeholder: 'e.g. Park Town', icon: 'pin' })}
    ${bfText({ name: 'pin', label: 'PIN code', value: loc.pin, placeholder: '6 digits', digits: 6 })}
  </div>`;
}

export function donorFields(o = {}) {
  const S = getState();
  const st = o.state || S.bank.state, ds = o.district || S.bank.district, today = ymd(new Date());
  return `<div class="bgrid">
    ${bfText({ name: 'name', id: 'f-name', label: 'Full name', placeholder: 'As on ID card', icon: 'users', cls: 'full' })}
    ${bfText({ name: 'phone', label: 'Mobile (WhatsApp)', phone: 'mobile' })}
    ${bfDate({ name: 'dob', label: 'Date of birth', min: DOB_MIN(), max: DOB_MAX(), age: true, start: '2000-01-01', hint: 'Donors must be 18 to 65 years old.' })}
    <div class="field full"><span class="lbl">Gender</span><div class="choices">${['Male', 'Female', 'Other'].map((x, i) => `<label class="choice"><input type="radio" name="gender" value="${x}" ${i === 0 ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div></div>
    <div class="field full"><span class="lbl">Blood group</span><div class="choices groups">${GROUPS.map(x => `<label class="choice"><input type="radio" name="group" value="${x}"><span>${esc(String(x).replace('-', '−'))}</span></label>`).join('')}</div></div>
    ${o.compact ? '' : bfSelect({ name: 'state', label: 'State', options: Object.keys(INDIA), value: st, search: true, searchPlaceholder: 'Search states' })}
    ${o.compact ? '' : bfSelect({ name: 'district', label: 'District', options: INDIA[st] || [], value: ds, placeholder: 'Select district', search: true, searchPlaceholder: 'Search districts' })}
    ${bfText({ name: 'city', label: 'Area / town', placeholder: 'e.g. Adyar', icon: 'pin' })}
    ${bfText({ name: 'pin', label: 'PIN code', placeholder: 'For distance', digits: 6 })}
    <div class="field full"><span class="lbl">Last donation</span><div class="bgrid" style="align-items:center">
      <div class="choices"><label class="choice"><input type="radio" name="lastMode" value="never" checked><span>Never donated</span></label><label class="choice"><input type="radio" name="lastMode" value="date"><span>Pick a date</span></label></div>
      ${bfDate({ name: 'lastDate', label: 'Last donated on', min: ymd(new Date(now() - 10 * 365 * DAY)), max: today, disabled: true })}</div></div>
    ${o.compact ? '' : bfText({ name: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com', optional: true })}
    ${o.compact ? '' : bfSelect({ name: 'source', label: 'Joined at', options: [{ v: 'walk-in', l: 'Walk-in at the centre' }, ...S.camps.map(c => ({ v: c.id, l: c.name }))], value: 'walk-in' })}
    <label class="check full"><input type="checkbox" name="apheresis"><span><span class="mid">Willing to donate platelets</span><br><span class="small muted">Only donors who agree are asked for apheresis.</span></span></label>
    <label class="check full"><input type="checkbox" name="consent"><span><span class="mid">The donor agreed to receive blood requests on WhatsApp</span><br><span class="small muted">They'll get a welcome message to confirm. They can pause or stop at any time.</span></span></label>
  </div>
  <p class="err-t" data-err hidden></p>`;
}

export function readDonor(form, o = {}) {
  const S = getState();
  const f = new FormData(form);
  const v = k => (f.get(k) || '').toString().trim();
  const phone = cleanPhone(v('phone'), 'mobile');
  const errs = [];
  if (v('name').length < 2) errs.push(['name', 'Enter the donor\'s full name.']);
  if (!/^[6-9]\d{9}$/.test(phone)) errs.push(['phone', 'Enter a 10-digit Indian mobile number.']);
  const dupe = S.donors.find(d => d.phone === phone);
  if (dupe) errs.push(['phone', `This number is already registered to ${dupe.name}.`]);
  const age = ageFrom(v('dob'));
  if (age === null) errs.push(['dob', 'Enter the date of birth.']);
  else if (age < 18) errs.push(['dob', `Not eligible: donors must be 18 or older (this person is ${age}).`]);
  else if (age > 65) errs.push(['dob', 'Donors above 65 need the medical officer\'s approval first.']);
  if (!v('group')) errs.push(['group', 'Choose a blood group.']);
  if (!o.district && !v('district')) errs.push(['district', 'Choose a district.']);
  let last = null;
  if (v('lastMode') === 'date') {
    if (!v('lastDate')) errs.push(['lastDate', 'Pick the last donation date, or choose "Never donated".']);
    else last = new Date(v('lastDate')).getTime();
  }
  if (v('pin') && !validPin(v('pin'))) errs.push(['pin', 'Enter a 6-digit PIN code that doesn’t start with 0.']);
  if (v('lastMode') === 'date' && v('lastDate') && v('dob') && ageFrom(v('dob')) !== null) {
    const at = new Date(v('lastDate'));
    const b = new Date(v('dob'));
    b.setFullYear(b.getFullYear() + 18);
    if (at < b) errs.push(['lastDate', 'The last donation can’t be before the donor turned 18.']);
  }
  if (!f.get('consent')) errs.push(['consent', 'Bloodo can only message donors who agreed.']);
  form.querySelectorAll('.err').forEach(e => e.classList.remove('err'));
  const box = form.querySelector('[data-err]');
  if (errs.length) {
    const f0 = errs.map(([k]) => markErr(form, k))[0];
    box.hidden = false;
    box.textContent = errs.map(e => e[1]).join(' ');
    f0 && f0.focus && f0.focus();
    return null;
  }
  const pin = v('pin');
  const km = pin ? +(1 + (Math.abs(parseInt(pin, 10) - 600003) % 220) / 10).toFixed(1) : +(2 + Math.random() * 12).toFixed(1);
  return {
    id: uid('d'),
    name: v('name').replace(/\s+/g, ' '),
    phone,
    email: v('email'),
    dob: v('dob'),
    gender: v('gender') || 'Male',
    group: v('group'),
    state: o.state || v('state') || S.bank.state,
    district: o.district || v('district') || S.bank.district,
    city: v('city') || S.bank.district,
    km,
    apheresis: !!f.get('apheresis'),
    consent: true,
    source: o.source || v('source') || 'walk-in',
    addedAt: now(),
    lastDonated: last,
    donations: last ? 1 : 0,
    pausedUntil: null,
    lastNoAt: null,
    asks: [],
    stats: { asked: 0, yes: 0, showed: 0 }
  };
}
