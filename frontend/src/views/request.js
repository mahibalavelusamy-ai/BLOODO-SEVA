import { COMP, PRIORITY, MIN } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc, g, now, first, word, fmtWhen, fmtTime, ago, until } from '../lib/helpers.js';
import { getState, patientOf, reqLoc, donorKm, shortDay } from '../state/store.js';
import { committed, donatedN, compatibleGroups } from '../engine/matching.js';
import { reqStatus, slots, radar, legend, inviteTag, waMessage } from './bookings.js';

export function dcard(v, req) {
  const S = getState();
  const d = S.donors.find(x => x.id === v.donorId);
  if (!d) return '';
  let acts = '';
  if (v.status === 'yes' || v.status === 'ontheway') acts = `<button class="btn primary sm" data-act="inv" data-w="arrived" data-r="${req.id}" data-d="${d.id}">Mark arrived</button><button class="btn ghost sm" data-act="inv" data-w="noshow" data-r="${req.id}" data-d="${d.id}">Didn't come</button>`;
  if (v.status === 'arrived') acts = `<button class="btn ok sm" data-act="inv" data-w="donated" data-r="${req.id}" data-d="${d.id}">${ic('check', 15)}Donated</button><button class="btn ghost sm" data-act="inv" data-w="deferred" data-r="${req.id}" data-d="${d.id}">Deferred</button>`;
  const when = v.status === 'sent' ? `Sent ${ago(v.sentAt)}` : v.status === 'seen' ? 'Read the message' : v.status === 'donated' ? `Donated ${fmtTime(v.at)}` : v.at ? `Updated ${ago(v.at)}` : '';
  const relText = d.stats.asked ? `Said yes to ${d.stats.yes} of ${d.stats.asked} request${d.stats.asked > 1 ? 's' : ''}` : 'Not asked yet';

  return `<div class="dc" data-flash="${req.id + d.id}">
    <div class="top"><div class="tok sm ${d.group === req.group ? '' : 'quiet'}">${g(d.group)}</div>
      <div class="grow"><div class="name ellip">${esc(d.name)}</div><div class="sub">${donorKm(d, reqLoc(req))} km, ${esc(d.city)}</div></div>
      <button class="iconbtn" style="width:34px;height:34px" data-act="chat" data-r="${req.id}" data-d="${d.id}" aria-label="View WhatsApp chat with ${esc(d.name)}">${ic('chat', 15)}</button>
      ${['yes', 'ontheway', 'arrived'].includes(v.status) ? `<button class="iconbtn" style="width:34px;height:34px" data-act="call" data-d="${d.id}" aria-label="Call ${esc(d.name)} on a masked line">${ic('phone', 15)}</button>` : ''}</div>
    <div class="row between"><div class="row" style="gap:8px">${inviteTag(v)}</div><span class="small faint" style="white-space:nowrap">${when}</span></div>
    <div class="small muted">${relText}${d.donations ? `. ${d.donations} donation${d.donations > 1 ? 's' : ''}` : ''}</div>
    ${acts ? `<div class="acts">${acts}</div>` : ''}
  </div>`;
}

export function lane(title, list, req, emptyText) {
  return `<section class="lane"><div class="lane-h"><h3>${title}</h3><span class="n">${list.length}</span></div>
    ${list.length ? `<div class="dcards">${list.map(v => dcard(v, req)).join('')}</div>` : emptyText ? `<p class="small muted">${emptyText}</p>` : ''}</section>`;
}

export function vRequest(id) {
  const S = getState();
  const req = S.requests.find(q => q.id === id);
  if (!req) return `<a class="back" href="#/bookings">${ic('back', 16)}Bookings</a><div class="card empty"><h3>Booking not found</h3><p class="muted">It may have been removed. Go back to see all bookings.</p></div>`;
  const by = st => req.invites.filter(v => st.includes(v.status));
  const coming = by(['yes', 'ontheway', 'arrived']), waiting = by(['sent', 'seen']), donated = by(['donated']), out = by(['no', 'silent', 'standdown', 'deferred', 'noshow', 'cancelled']);
  const c = committed(req);
  let band = '';
  if (req.status === 'finding') {
    const total = S.rules.timeoutMin * MIN * (req.priority === 'critical' ? 0.75 : 1);
    const left = Math.max(0, req.waveDeadline - now());
    const pct = Math.min(100, 100 - left / total * 100);
    const mins = Math.ceil(left / MIN);
    const total2 = req.kind === 'planned' ? S.rules.circleReplyMin * MIN : total;
    const pct2 = Math.min(100, 100 - left / total2 * 100);
    band = req.kind === 'planned' ? `<div class="wave"><div><div class="mid">Asking ${esc(waiting.map(v => first(S.donors.find(d => d.id === v.donorId).name)).join(', ') || 'the circle')}</div><div class="small muted">One donor at a time, in rotation. The next person in the circle is asked in ${mins} min if there’s no reply.</div></div>
      <div class="track" aria-hidden="true"><i style="width:${pct2}%"></i></div>
      <button class="btn ghost sm" data-act="next-wave" data-id="${req.id}">${ic('rotate', 15)}Ask next in circle</button></div>` : `<div class="wave"><div><div class="mid">Wave ${req.wave} of up to ${S.rules.maxWaves}</div><div class="small muted">${waiting.length} waiting for a reply. Next wave in ${mins} min if still short.</div></div>
      <div class="track" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <button class="btn ghost sm" data-act="next-wave" data-id="${req.id}">${ic('send', 15)}Send next wave now</button></div>`;
  } else if (req.status === 'covered') {
    band = `<div class="wave" style="background:var(--ok-bg)"><div class="row" style="color:var(--ok)">${ic('check', 20)}<div><div class="mid">${req.kind === 'planned' ? 'Donor booked' : 'All units covered'}</div><div class="small" style="color:var(--ink-2)">${req.kind === 'planned' ? `Mark the donor as arrived and donated on ${shortDay(req.neededBy)}. The family doesn’t need to arrange anyone.` : 'Mark each donor as they arrive and donate.'}</div></div></div></div>`;
  } else if (req.status === 'stalled' && req.kind === 'planned') {
    band = `<div class="wave" style="background:var(--warn-bg)"><div><div class="mid" style="color:var(--warn)">No one in the circle can donate in time</div><div class="small muted">Add donors to ${esc(first(patientOf(req).name))}’s circle, or ask the wider pool nearby.</div></div>
      <div class="row wrapflex" style="gap:8px"><a class="btn primary sm" href="#/patient/${req.patientId}">Add to circle</a><button class="btn ghost sm" data-act="widen" data-id="${req.id}">Ask wider pool</button></div></div>`;
  } else if (req.status === 'stalled') {
    band = `<div class="wave" style="background:var(--warn-bg)"><div><div class="mid" style="color:var(--warn)">No more eligible donors within ${req.radius} km</div><div class="small muted">Widen the search, or call nearby blood centres for this unit.</div></div>
      <div class="row wrapflex" style="gap:8px">${req.radius < 40 ? `<button class="btn primary sm" data-act="widen" data-id="${req.id}">Search up to ${req.radius < 30 ? 30 : 40} km</button>` : ''}<button class="btn ghost sm" data-act="cancel-req" data-id="${req.id}">Cancel request</button></div></div>`;
  } else if (req.status === 'queued') {
    band = `<div class="wave" style="background:var(--calm-bg)"><div><div class="mid" style="color:var(--calm)">Quiet hours are on</div><div class="small muted">Messages go out at ${S.rules.quietEnd}:00 am. Mark this as critical to send now.</div></div>
      <button class="btn primary sm" data-act="send-critical" data-id="${req.id}">${ic('send', 15)}Send now as critical</button></div>`;
  } else if (req.status === 'done') {
    band = `<div class="wave"><div class="row">${ic('check', 20)}<div class="mid">${req.kind === 'planned' ? 'Blood ready for the transfusion' : 'Completed'} ${fmtWhen(req.closedAt)}</div></div></div>`;
  } else if (req.status === 'cancelled') {
    band = `<div class="wave"><div class="mid">Cancelled ${req.closedAt ? fmtWhen(req.closedAt) : ''}. Donors who were waiting were told it's no longer needed.</div></div>`;
  }
  const sk = req.skipped || {};
  const skRows = [['recovering', 'Still recovering from their last donation'], ['resting', 'Asked recently or said "not now"'], ['locked', 'Already on another request'], ['paused', 'Paused their alerts'], ['noApheresis', 'Not registered for platelet donation'], ['far', `Further than ${req.radius} km`]].filter(([k]) => sk[k]);
  const P = patientOf(req);
  const title = req.kind === 'planned' ? `${esc(first(P.name))}’s transfusion,<br><em>${new Date(req.transfusionAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}.</em>`
    : req.kind === 'topup' ? `${g(req.group)} top-up,<br><em>${word(req.units, true)} unit${req.units > 1 ? 's' : ''}.</em>`
      : `${g(req.group)} ${esc(COMP[req.comp].short.toLowerCase())},<br><em>${word(req.units, true)} unit${req.units > 1 ? 's' : ''}.</em>`;
  const lede = req.kind === 'planned' ? `${g(req.group)} ${esc(COMP[req.comp].short.toLowerCase())}, ${req.units} unit${req.units > 1 ? 's' : ''}. The donor gives blood by ${fmtWhen(req.neededBy)}, the day before the transfusion.`
    : req.kind === 'topup' ? `Topping up ${g(req.group)} ${esc(COMP[req.comp].short.toLowerCase())} before stock runs short. Donors are booked to give by ${fmtWhen(req.neededBy)}.`
      : `Needed by ${fmtWhen(req.neededBy)}${['finding', 'covered', 'queued', 'stalled'].includes(req.status) ? ` (${until(req.neededBy)})` : ''}${req.ref ? `, for ${esc(req.ref)}` : ''}.`;

  return `<a class="back" href="#/bookings">${ic('back', 16)}Bookings</a>
  <section class="rhero glass">
    <div>
      <div class="row wrapflex" style="gap:8px;margin-bottom:16px">${reqStatus(req)}${req.priority !== 'routine' ? `<span class="pill ${req.priority === 'critical' ? 'red' : 'warn'}">${PRIORITY[req.priority]}</span>` : ''}</div>
      <h1>${title}</h1>
      <p class="lede">${lede}</p>
      <div class="facts">${P ? `<a href="#/patient/${P.id}" style="display:inline-flex;gap:6px;align-items:center;color:var(--red);text-decoration:none;font-weight:500">${ic('heart', 16)}${esc(P.name)}’s profile and circle</a>` : `<span>${ic('users', 16)}Compatible: ${compatibleGroups(req.group, req.comp).map(g).join(', ')}</span>`}<span>${ic('building', 16)}${esc(reqLoc(req).name)}${reqLoc(req).area ? `, ${esc(reqLoc(req).area)}` : ''}</span><span>${ic('pin', 16)}${P ? `Circle of ${P.circle.length} ${g(req.group)} donors` : `Donors within ${req.radius} km`}</span></div>
      <div class="conf">${slots(req, true)}<span class="muted">${c} of ${req.units} confirmed${donatedN(req) ? `, ${donatedN(req)} donated` : ''}</span></div>
      ${band}
    </div>
    <div class="sigcol">${radar(req)}${legend()}</div>
  </section>
  <div class="grid2" style="margin-top:10px">
    <div>
      ${lane(req.kind === 'planned' ? 'Booked donor' : 'Coming in', coming, req, req.kind === 'planned' ? 'The donor who says yes appears here.' : 'Donors who said yes appear here.')}
      ${(waiting.length || req.status === 'finding') ? lane(req.kind === 'planned' ? 'Being asked' : 'Waiting for a reply', waiting, req, req.kind === 'planned' ? 'Asking the next person in the circle shortly.' : 'Everyone has replied. The next wave goes out shortly.') : ''}
      ${donated.length ? lane('Donated', donated, req) : ''}
      ${out.length ? `<details class="fold lane" id="fold-${req.id}"><summary><span class="chev">${ic('chev', 16)}</span><h3 style="font-size:18px">Not coming</h3><span class="small faint">${out.length}</span></summary>
        <div class="card quiet-list" style="padding:4px 18px;margin-top:10px"><div class="rows">${out.map(v => { const d = S.donors.find(x => x.id === v.donorId); return `<div class="rowi"><div class="tok xs quiet">${g(d.group)}</div><div class="grow"><div class="ellip">${esc(d.name)}</div><div class="small muted">${v.status === 'no' && v.reason ? esc(v.reason) : v.status === 'silent' ? 'No reminder sent' : v.status === 'standdown' ? 'Told the request is covered' : ''}</div></div>${inviteTag(v)}<button class="iconbtn" style="width:34px;height:34px" data-act="chat" data-r="${req.id}" data-d="${d.id}" aria-label="View WhatsApp chat with ${esc(d.name)}">${ic('chat', 15)}</button></div>`; }).join('')}</div></div></details>` : ''}
    </div>
    <aside class="stack" style="gap:18px;margin-top:26px">
      <div class="wa"><div class="wa-h">${ic('chat', 16)}What donors receive on WhatsApp</div>
        <div class="chat"><div class="bub out">${esc(waMessage(req, 4.2)).replace(/\*(.+?)\*/g, '<b>$1</b>')}<span class="t">Bloodo</span></div>
        <div class="bub-btns"><span>Yes, I can</span><span>Not now</span><span>Pause alerts</span></div></div>
        <p class="small" style="margin-top:12px;color:var(--ink-2)">The patient's details and donors' numbers are never shared. Ward and bed stay inside this console.</p></div>
      ${skRows.length ? `<div class="card pad"><div class="row" style="gap:8px;color:var(--ok)">${ic('shield', 18)}<h3 style="color:var(--ink);font-size:17px">Not messaged</h3></div>
        <div class="rows" style="margin-top:8px">${skRows.map(([k, l]) => `<div class="rowi" style="padding:9px 0"><span class="grow small muted">${l}</span><span class="mid">${sk[k]}</span></div>`).join('')}</div></div>` : ''}
      <div class="card pad"><h3 style="font-size:17px">Activity</h3><div class="rows" style="margin-top:6px">${req.log.slice().reverse().slice(0, 8).map(l => `<div class="rowi" style="padding:9px 0;align-items:flex-start"><span class="grow small">${esc(l.t)}</span><span class="small faint" style="white-space:nowrap">${fmtTime(l.at)}</span></div>`).join('')}</div></div>
      ${['finding', 'covered', 'queued', 'stalled'].includes(req.status) ? `<button class="btn ghost" data-act="cancel-req" data-id="${req.id}">Cancel request</button>` : ''}
    </aside>
  </div>`;
}
