import { ic } from '../lib/icons.js';
import { esc, g, now, fmtDay, maskPhone } from '../lib/helpers.js';
import { getState } from '../state/store.js';
import { shelfHtml } from './today.js';
import { donorPill } from './donors.js';
import { donorFields } from '../components/fields.js';

export function campState(c) {
  const d = new Date(c.date).toDateString(), t = new Date().toDateString();
  return d === t ? ['red live', 'Today'] : c.date > now() ? ['calm', 'Upcoming'] : ['', 'Done'];
}

export function vCamps() {
  const S = getState();
  const list = S.camps.slice().sort((a, b) => b.date - a.date);
  return `<div class="head"><div><h1>Camps</h1><p class="sub">Most donors join at camps. Register them on the spot so they're ready for the next request.</p></div>
    <button class="btn primary lg" data-act="new-camp">${ic('plus')}New camp</button></div>
  <div class="sh"><h2>Your camps</h2></div>
  <div class="dcards" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
  ${list.map(c => {
    const n = S.donors.filter(d => d.source === c.id).length;
    const [tone, lab] = campState(c);
    const dt = new Date(c.date);
    return `<a class="card req" href="#/camp/${c.id}" style="align-items:flex-start;flex-direction:column;gap:14px;padding:22px">
      <div class="row between" style="width:100%"><div class="row"><div class="tok quiet" style="flex-direction:column;gap:0;font-size:28px;line-height:1">${dt.getDate()}<span style="font-family:var(--sans);font-size:12px;color:var(--ink-2)">${dt.toLocaleDateString('en-IN', { month: 'short' })}</span></div>
      <div><div class="title">${esc(c.name)}</div><div class="small muted">${esc(c.venue)}</div></div></div></div>
      <div class="row between" style="width:100%"><span class="pill ${tone}"><span class="dot"></span>${lab}</span><span class="small muted">${n} donors joined${c.units ? `, ${c.units} units` : ''}</span></div></a>`;
  }).join('')}
  </div>
  <section class="block"><div class="sh"><h2>Donor pool</h2><p>Use this to decide who to invite to your next camp</p></div>${shelfHtml(true)}</section>`;
}

export function vCamp(id) {
  const S = getState();
  const c = S.camps.find(x => x.id === id);
  if (!c) return `<a class="back" href="#/camps">${ic('back', 16)}Camps</a><div class="card empty"><h3>Camp not found</h3></div>`;
  const ds = S.donors.filter(d => d.source === c.id).sort((a, b) => b.addedAt - a.addedAt);
  const [tone, lab] = campState(c);

  return `<a class="back" href="#/camps">${ic('back', 16)}Camps</a>
  <div class="head"><div><div style="margin-bottom:8px"><span class="pill ${tone}"><span class="dot"></span>${lab}</span></div><h1>${esc(c.name)}</h1><p class="sub">${fmtDay(c.date)}. ${esc(c.venue)}. Organised by ${esc(c.organiser)}.</p></div>
    <div class="row" style="gap:14px"><div class="stack" style="gap:4px;align-items:center"><span class="lbl">Units collected</span><div class="stepper"><button data-act="units" data-c="${c.id}" data-n="-1" aria-label="One fewer unit">−</button><output>${c.units}</output><button data-act="units" data-c="${c.id}" data-n="1" aria-label="One more unit">+</button></div></div></div></div>
  <div class="grid2">
    <form class="card pad" data-form="camp-donor" data-c="${c.id}" novalidate>
      <div class="section-title"><h2>Register a donor</h2><span class="small faint">${esc(c.district)}, ${esc(c.state)}</span></div>
      <p class="small muted" style="margin:-6px 0 18px">Location is filled in from the camp. After saving, the form clears for the next person.</p>
      ${donorFields({ compact: true, state: c.state, district: c.district })}
      <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn primary lg">Save and add next</button></div>
    </form>
    <section><div class="section-title"><h2>Joined here</h2><span class="small faint">${ds.length}</span></div>
      <div class="card" style="padding:4px 20px">${ds.length ? `<div class="rows">${ds.map(d => `<div class="rowi" data-act="donor" data-d="${d.id}" style="cursor:pointer"><div class="tok xs">${g(d.group)}</div><div class="grow"><div class="ellip mid">${esc(d.name)}</div><div class="small faint">${maskPhone(d.phone)}</div></div>${donorPill(d)}</div>`).join('')}</div>` : `<p class="muted" style="padding:18px 0">No donors registered at this camp yet.</p>`}</div>
    </section>
  </div>`;
}

