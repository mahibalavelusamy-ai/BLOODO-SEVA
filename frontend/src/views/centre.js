import { COMP, CENTRE_TYPES, INDIA } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc } from '../lib/helpers.js';
import { getState } from '../state/store.js';
import { bfText, bfSelect, HOURS, fmtHM } from '../components/fields.js';
import { senderPreview } from '../components/overlays.js';

export function vCentre(tab = 'profile') {
  const S = getState();
  const B = S.bank;
  const tabs = [['profile', 'Profile'], ['rules', 'Donor protection'], ['prefs', 'Preferences']];
  const donorsN = S.donors.length, done = S.requests.filter(q => q.status === 'done').length;
  let body = '';

  if (tab === 'profile') {
    body = `<form data-form="centre" novalidate>
    <div class="grid2" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)">
      <div class="stack" style="gap:30px">
        <section class="fsec"><div class="fsec-h"><h3>About the centre</h3></div><div class="bgrid">
          ${bfText({ name: 'name', label: 'Centre name', value: B.name, icon: 'building', cls: 'full' })}
          ${bfText({ name: 'short', label: 'Short name', value: B.short, placeholder: 'Shown to your team' })}
          ${bfSelect({ name: 'type', label: 'Type', options: CENTRE_TYPES, value: B.type })}
          ${bfText({ name: 'licence', label: 'Licence number', value: B.licence, placeholder: 'As on your blood centre licence' })}
          ${bfText({ name: 'officer', label: 'Medical officer in charge', value: B.officer })}
        </div></section>
        <section class="fsec"><div class="fsec-h"><h3>Location</h3><p>Used as the default for every request</p></div><div class="bgrid">
          ${bfText({ name: 'address', label: 'Address', value: B.address, placeholder: 'Building, street', cls: 'full' })}
          ${bfSelect({ name: 'state', label: 'State', options: Object.keys(INDIA), value: B.state, search: true, searchPlaceholder: 'Search states' })}
          ${bfSelect({ name: 'district', label: 'District', options: INDIA[B.state] || [], value: B.district, placeholder: 'Select district', search: true, searchPlaceholder: 'Search districts' })}
          ${bfText({ name: 'area', label: 'Area / locality', value: B.area, icon: 'pin' })}
          ${bfText({ name: 'city', label: 'City / town', value: B.city })}
          ${bfText({ name: 'pin', label: 'PIN code', value: B.pin, digits: 6 })}
        </div></section>
        <section class="fsec"><div class="fsec-h"><h3>Contact and hours</h3></div><div class="bgrid">
          ${bfText({ name: 'phone', label: 'Front desk phone', value: B.phone, phone: 'landline', icon: 'phone' })}
          ${bfText({ name: 'email', label: 'Email', type: 'email', value: B.email })}
          ${bfSelect({ name: 'hours', label: 'Opening hours', options: [{ v: '24h', l: 'Open 24 hours' }, { v: 'set', l: 'Set hours' }], value: B.hours, cls: 'full' })}
          <div class="bgrid full" data-hours ${B.hours === '24h' ? 'hidden' : ''}>${bfSelect({ name: 'open', label: 'Opens at', options: HOURS, value: B.open, search: true, searchPlaceholder: 'Type a time' })}${bfSelect({ name: 'close', label: 'Closes at', options: HOURS, value: B.close, search: true, searchPlaceholder: 'Type a time' })}</div>
        </div></section>
        <section class="fsec"><div class="fsec-h"><h3>What you collect</h3><p>Requests only offer these</p></div>
          <div class="svc">${Object.entries(COMP).map(([k, c]) => `<label><input type="checkbox" name="svc_${k}" ${B.services[k] ? 'checked' : ''}><span class="tick">${ic('check', 13)}</span><b>${c.name}</b></label>`).join('')}</div></section>
      </div>
      <div class="stack" style="gap:20px;position:sticky;top:110px">
        <section class="fsec"><div class="fsec-h"><h3>How donors see you</h3></div>
          ${bfText({ name: 'sender', label: 'Name on WhatsApp', value: B.sender, placeholder: 'e.g. GGH Blood Centre' })}
          <div class="wa"><div class="wa-h">${ic('chat', 16)}Preview</div><div class="chat"><div class="bub out" data-sender-preview>${senderPreview(B)}<span class="t">Bloodo</span></div></div></div></section>
        <div class="card pad"><div class="row" style="gap:10px;color:var(--ok)">${ic('shield', 18)}<b class="mid" style="color:var(--ink)">Verified centre</b></div>
          <p class="small muted" style="margin-top:6px">Only verified centres can message donors through Bloodo. Changing your licence number sends it for review again.</p></div>
      </div>
    </div>
    <p class="err-t" data-err hidden style="margin-top:16px"></p>
    <div class="savebar glass"><span class="small muted grow">Changes apply to new requests.</span><button type="button" class="btn ghost" data-act="centre-reset">Discard</button><button class="btn primary">Save profile</button></div>
    </form>`;
  } else if (tab === 'rules') {
    const R = S.rules;
    const H = [...Array(24).keys()].map(h => ({ v: String(h), l: fmtHM(h, '00') }));
    const n = (k, l, ph) => bfText({ name: k, label: l, value: R[k], digits: 3, placeholder: ph });
    body = `<form class="card pad" data-form="rules" novalidate style="padding:30px">
      <div class="row" style="gap:10px;color:var(--ok);margin-bottom:6px">${ic('shield', 20)}<h2 style="color:var(--ink)">Donor protection</h2></div>
      <p class="small muted" style="margin-bottom:22px">These limits apply across every centre using Bloodo, so a donor is never asked by two centres at once.</p>
      <div class="bgrid">
        ${n('maxPerMonth', 'Requests per donor each month', '1 to 4')}${n('restAfterNo', 'Days of rest after "not now"', '1 to 60')}
        ${bfSelect({ name: 'quietStart', label: 'Quiet hours start', options: H, value: String(R.quietStart) })}${bfSelect({ name: 'quietEnd', label: 'Quiet hours end', options: H, value: String(R.quietEnd) })}
        ${n('perUnit', 'Donors per unit in each wave', '1 to 10')}${n('timeoutMin', 'Minutes before the next wave', '5 to 120')}
        ${n('radiusKm', 'Search distance (km)', '2 to 60')}${n('maxWaves', 'Most waves per request', '1 to 8')}
      </div>
      <p class="small muted" style="margin-top:14px">Only critical requests are sent during quiet hours. Waves stop as soon as the need is covered.</p>
      <div class="row" style="justify-content:flex-end;margin-top:20px"><button class="btn primary">Save rules</button></div></form>`;
  } else {
    const th = S.theme || 'system';
    body = `<div class="grid2"><section class="card pad"><h2 style="margin-bottom:14px">Appearance</h2>
        <div class="choices">${[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<label class="choice"><input type="radio" name="theme" value="${k}" data-act="set-theme" ${th === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></section>
      <section class="card pad"><h2 style="margin-bottom:6px">Demo data</h2><p class="small muted" style="margin-bottom:14px">This prototype keeps data in this browser only. Reset to start over with sample donors and requests.</p>
        <button class="btn ghost" data-act="reset">Reset demo data</button></section></div>`;
  }

  return `<section class="chero glass"><div class="tok xl">${ic('building', 44)}</div>
    <div class="grow"><div class="row wrapflex" style="gap:8px;margin-bottom:10px"><span class="pill ok">${ic('check', 13)}Verified</span><span class="pill">${esc(B.type)}</span>${B.licence ? `<span class="pill">Licence ${esc(B.licence)}</span>` : ''}</div>
      <h1>${esc(B.name)}</h1><p class="muted" style="margin-top:8px">${esc([B.address, B.area, B.city !== B.district ? B.city : '', B.district, B.state].filter(Boolean).join(', '))}${B.pin ? ` ${esc(B.pin)}` : ''}</p>
      <p class="small faint" style="margin-top:6px">${B.hours === '24h' ? 'Open 24 hours' : `Open ${fmtHM(+B.open.slice(0, 2), B.open.slice(3))} to ${fmtHM(+B.close.slice(0, 2), B.close.slice(3))}`}. ${donorsN} donors, ${done} request${done === 1 ? '' : 's'} completed.</p></div></section>
  <nav class="tabs" aria-label="Centre">${tabs.map(([k, l]) => `<a href="#/centre/${k}" ${tab === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  ${body}`;
}

