import { DAY } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc, g, first, maskPhone, fmtDay, until, initials } from '../lib/helpers.js';
import { getState, bookingFor, bankLoc, shortDay } from '../state/store.js';
import { donorState } from '../engine/matching.js';
import { circleReady, bookingTag, dblock } from './today.js';
import { waMessage } from './bookings.js';

export function circleHealth(p) {
  const r = circleReady(p), n = p.circle.length;
  const tone = r >= 4 ? 'ok' : r >= 2 ? 'warn' : 'red';
  return `<span class="pill ${tone}"><span class="dot"></span>${r} of ${n} ready</span>`;
}

export function vPatients() {
  const S = getState();
  const list = S.patients.filter(p => p.active).sort((a, b) => a.nextAt - b.nextAt);
  const thin = list.filter(p => circleReady(p) < 3);
  return `<div class="head"><div><h1>Patients</h1><p class="sub">People who need blood on a schedule. Each has a circle of donors who give in turn, so families never have to search.</p></div>
    <button class="btn primary lg" data-act="add-patient">${ic('plus')}Add patient</button></div>
  ${thin.length ? `<div class="notice" style="margin-bottom:22px;display:flex;gap:10px;align-items:center">${ic('alert', 18)}<span><b>${thin.map(p => esc(first(p.name))).join(', ')}</b> ${thin.length > 1 ? 'have' : 'has'} fewer than 3 donors ready. Add donors to ${thin.length > 1 ? 'their circles' : 'the circle'} before the next transfusion.</span></div>` : ''}
  <div class="pgrid">${list.map(p => {
    const b = bookingFor(p);
    return `<a class="pcard card" href="#/patient/${p.id}">
      <div class="row between"><div class="row"><div class="tok" style="border-radius:50%">${g(p.group)}</div><div><div class="title">${esc(p.name)}</div><div class="small muted">${esc(p.condition)}, age ${p.age}</div></div></div></div>
      <div class="pnext">${dblock(p.nextAt)}<div class="grow"><div class="mid">${shortDay(p.nextAt)}</div><div class="small faint">Next transfusion, ${until(p.nextAt)}</div></div>${bookingTag(p, p.nextAt, b)}</div>
      <div class="row between small muted"><span>${ic('rotate', 14)} Every ${p.interval} days, ${p.units} unit${p.units > 1 ? 's' : ''}</span>${circleHealth(p)}</div></a>`;
  }).join('')}</div>`;
}

export function vPatient(id) {
  const S = getState();
  const p = S.patients.find(x => x.id === id);
  if (!p) return `<a class="back" href="#/patients">${ic('back', 16)}Patients</a><div class="card empty"><h3>Patient not found</h3></div>`;
  const dates = [];
  for (let i = -2; i < 4; i++) dates.push(p.nextAt + i * p.interval * DAY);
  const donorTimes = did => S.requests.filter(q => q.patientId === p.id).reduce((n, q) => n + q.invites.filter(v => v.donorId === did && v.status === 'donated').length, 0);
  const k0 = p.circle.length ? p.rot % p.circle.length : 0;
  const rotOrder = p.circle.slice(k0).concat(p.circle.slice(0, k0));
  const nextId = rotOrder.find(did => { const d = S.donors.find(x => x.id === did); return d && donorState(d).k === 'ready'; });
  const b = bookingFor(p);

  return `<a class="back" href="#/patients">${ic('back', 16)}Patients</a>
  <section class="chero glass"><div class="tok xl" style="border-radius:50%">${g(p.group)}</div>
    <div class="grow"><div class="row wrapflex" style="gap:8px;margin-bottom:10px"><span class="pill red">${esc(p.condition)}</span><span class="pill">Every ${p.interval} days</span><span class="pill">${p.units} unit${p.units > 1 ? 's' : ''} of red cells</span>${p.leuco ? '<span class="pill calm">Leucoreduced</span>' : ''}${p.phenotype ? '<span class="pill calm">Phenotype matched</span>' : ''}</div>
      <h1>${esc(p.name)}</h1><p class="muted" style="margin-top:8px">Age ${p.age}. Contact: ${esc(p.guardian)}, +91 ${maskPhone(p.guardianPhone)}</p></div>
    <div class="stack" style="gap:8px;align-items:flex-end">${b ? `<a class="btn primary" href="#/request/${b.id}">Open booking</a>` : `<button class="btn primary" data-act="book-now" data-p="${p.id}">${ic('send', 16)}Book next donor now</button>`}<button class="btn ghost sm" data-act="edit-next" data-p="${p.id}">${ic('cal', 15)}Change next date</button></div></section>
  <div class="sh"><h2>Transfusion calendar</h2><p>Bookings open ${S.rules.bookAheadDays} days ahead</p></div>
  <div class="calstrip">${dates.map(at => {
    const past = at < p.nextAt;
    const bk = bookingFor(p, at);
    const nextOne = at === p.nextAt;
    return `<div class="calday ${past ? 'past' : ''} ${nextOne ? 'next' : ''}"><div class="cd-d">${new Date(at).toLocaleDateString('en-IN', { weekday: 'short' })}</div><div class="cd-n">${new Date(at).getDate()}</div><div class="cd-m">${new Date(at).toLocaleDateString('en-IN', { month: 'short' })}</div>
      <div class="cd-s">${past ? `${ic('check', 13)} Done` : bk ? bookingTag(p, at, bk).replace('class="pill', 'class="pill sm') : nextOne ? 'Next' : 'Planned'}</div></div>`;
  }).join('')}</div>
  <div class="grid2 block" style="margin-top:34px">
    <section><div class="sh"><h2>Donor circle</h2><p>${circleReady(p)} of ${p.circle.length} ready. Asked in turn, one at a time.</p></div>
      <div class="panel card">${p.circle.length ? p.circle.map((did, i) => {
        const d = S.donors.find(x => x.id === did);
        if (!d) return '';
        const st = donorState(d);
        const isNext = did === nextId;
        return `<div class="rrow crow" data-act="donor" data-d="${d.id}" style="cursor:pointer"><span class="cnum ${isNext ? 'on' : ''}">${i + 1}</span><div class="av" style="border-radius:50%">${esc(initials(d.name))}</div>
          <div class="grow"><div class="title">${esc(d.name)}${isNext ? ' <span class="pill red sm">Next up</span>' : ''}</div><div class="meta"><span>${esc(st.detail)}</span><span>Gave for ${esc(first(p.name))} ${donorTimes(did)} time${donorTimes(did) === 1 ? '' : 's'}</span></div></div>
          <span class="pill ${st.tone}"><span class="dot"></span>${st.label}</span><button class="iconbtn" style="width:34px;height:34px" data-act="circle-remove" data-p="${p.id}" data-d="${d.id}" aria-label="Remove ${esc(d.name)} from the circle">${ic('x', 15)}</button></div>`;
      }).join('') : `<p class="muted" style="padding:18px 14px">No donors yet.</p>`}
        <div style="padding:12px 14px"><button class="btn sm" data-act="circle-add" data-p="${p.id}">${ic('plus', 15)}Add donor to circle</button></div></div></section>
    <aside class="stack" style="gap:18px">
      <div class="wa"><div class="wa-h">${ic('chat', 16)}What circle donors receive</div><div class="chat"><div class="bub out">${esc(waMessage({ kind: 'planned', group: p.group, transfusionAt: p.nextAt, neededBy: p.nextAt - DAY, loc: bankLoc() })).replace(/\*(.+?)\*/g, '<b>$1</b>')}<span class="t">Bloodo</span></div><div class="bub-btns"><span>Yes, I can</span><span>Not now</span><span>Pause alerts</span></div></div>
        <p class="small" style="margin-top:12px;color:var(--ink-2)">Donors never see the patient’s name. They only know it’s a child they help regularly.</p></div>
      <div class="card pad"><h3 style="font-size:17px">Recent transfusions</h3><div class="rows" style="margin-top:6px">${p.history.slice().sort((a, b) => b - a).slice(0, 5).map(t => `<div class="rowi" style="padding:9px 0"><span class="grow small">${fmtDay(t)}</span><span class="small faint">${ic('check', 13)}</span></div>`).join('')}</div></div>
      <button class="btn ghost" data-act="patient-pause" data-p="${p.id}">${p.active ? 'Pause schedule' : 'Resume schedule'}</button>
    </aside>
  </div>`;
}
