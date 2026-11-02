import { GROUPS } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc, g, initials, maskPhone, fmtDate } from '../lib/helpers.js';
import { getState } from '../state/store.js';
import { donorState } from '../engine/matching.js';
import { UI } from './bookings.js';

export function donorPill(d) {
  const s = donorState(d);
  return `<span class="pill ${s.tone}"><span class="dot"></span>${s.label}</span>`;
}

export function reliabilityText(d) {
  return d.stats.asked ? `Said yes to ${d.stats.yes} of ${d.stats.asked} request${d.stats.asked > 1 ? 's' : ''}` : 'Not asked yet';
}

export function sourceText(d) {
  const S = getState();
  if (d.source === 'walk-in') return 'Walk-in';
  const c = S.camps.find(x => x.id === d.source);
  return c ? c.name : 'Camp';
}

export function filteredDonors() {
  const S = getState();
  const q = UI.q.trim().toLowerCase();
  return S.donors.filter(d => {
    if (UI.grp !== 'all' && d.group !== UI.grp) return false;
    if (UI.st !== 'all' && donorState(d).k !== UI.st) return false;
    if (q && !(d.name.toLowerCase().includes(q) || d.phone.includes(q.replace(/\D/g, '') || '§') || d.city.toLowerCase().includes(q))) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function donorRows() {
  const S = getState();
  const list = filteredDonors();
  if (!list.length) return `<div class="empty"><h3>No donors match</h3><p class="muted">Try a different name, or clear the filters.</p><button class="btn ghost sm" data-act="clear-filters">Clear filters</button></div>`;
  return `<div class="scroll-x"><table class="table"><thead><tr><th>Donor</th><th>Group</th><th>Status</th><th class="hide-m">Last donated</th><th class="hide-m">Distance</th><th class="hide-m">Joined at</th></tr></thead><tbody>
  ${list.map(d => {
    const s = donorState(d);
    return `<tr data-act="donor" data-d="${d.id}" tabindex="0">
      <td><div class="row"><div class="av">${esc(initials(d.name))}</div><div><div class="mid">${esc(d.name)}</div><div class="small faint">${maskPhone(d.phone)}</div></div></div></td>
      <td><div class="tok xs">${g(d.group)}</div></td>
      <td><div>${donorPill(d)}</div><div class="small faint" style="margin-top:3px">${esc(s.detail)}</div></td>
      <td class="hide-m small">${d.lastDonated ? fmtDate(d.lastDonated) : '<span class="faint">Never</span>'}</td>
      <td class="hide-m small">${d.km} km</td>
      <td class="hide-m small muted">${esc(sourceText(d))}</td></tr>`;
  }).join('')}</tbody></table></div>
  <p class="small faint" style="padding:12px 16px">${list.length} of ${S.donors.length} donors</p>`;
}

export function vDonors() {
  const S = getState();
  const ready = S.donors.filter(d => donorState(d).k === 'ready').length;
  const stc = [['all', 'All'], ['ready', 'Ready'], ['recovering', 'Recovering'], ['resting', 'Resting'], ['locked', 'On a request'], ['paused', 'Paused']];
  return `<div class="head"><div><h1>Donors</h1><p class="sub">${S.donors.length} donors added by your centre. ${ready} can be asked today.</p></div>
    <button class="btn primary lg" data-act="add-donor">${ic('plus')}Add donor</button></div>
  <div class="toolbar"><label class="search"><span class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Search donors</span>${ic('search', 17)}<input class="input" id="dq" placeholder="Search by name, mobile or area" value="${esc(UI.q)}" autocomplete="off"></label></div>
  <div class="toolbar" style="justify-content:space-between">
    <div class="chips" role="group" aria-label="Blood group">${['all', ...GROUPS].map(x => `<button class="chip ${x === 'all' ? '' : 'g'}" aria-pressed="${UI.grp === x}" data-act="grp" data-g="${x}">${x === 'all' ? 'All groups' : g(x)}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Status">${stc.map(([k, l]) => `<button class="chip" aria-pressed="${UI.st === k}" data-act="st" data-s="${k}">${l}</button>`).join('')}</div>
  </div>
  <div class="card" id="dtable" style="padding:6px 6px 0">${donorRows()}</div>`;
}

