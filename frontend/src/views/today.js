import { GROUPS, DAY } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc, g, now, first, fmtDay, fmtTime } from '../lib/helpers.js';
import { getState, bookingFor, shortDay, eligibleNow, eligibleOn } from '../state/store.js';
import { donorState } from '../engine/matching.js';
import { reqList, reqStatus } from './bookings.js';
import { unitRow } from './stock.js';

export function poolData() {
  const S = getState();
  const readyBy = {};
  GROUPS.forEach(x => readyBy[x] = 0);
  S.donors.forEach(d => {
    if (donorState(d).k === 'ready') readyBy[d.group]++;
  });
  return readyBy;
}

export function shelfHtml(compact) {
  const S = getState();
  const readyBy = poolData();
  const max = Math.max(...Object.values(readyBy), 1);
  const soon = S.donors.filter(d => !eligibleNow(d) && eligibleOn(d) - now() < 7 * DAY);
  const low = GROUPS.filter(x => readyBy[x] < 3);
  return `<div class="shelf card ${compact ? 'compact' : ''}">${GROUPS.map(x => `<a href="#/donors" data-act="filter-group" data-g="${x}" class="${readyBy[x] < 3 ? 'low' : ''}" aria-label="${x}: ${readyBy[x]} ready">
      <div class="bar"><i style="height:${Math.max(26, readyBy[x] / max * 100)}%"></i><b>${readyBy[x]}</b></div><span class="gl">${g(x)}</span></a>`).join('')}</div>
    <div class="shelf-note"><span>${low.length ? `<span style="color:var(--warn);font-weight:500">Running low on ${low.map(g).join(', ')}.</span> Invite these donors at your next camp.` : 'Every group has donors ready.'}</span>
      <span>${soon.length} donor${soon.length === 1 ? ' finishes' : 's finish'} recovery this week</span></div>`;
}

export function activeReqs() {
  const S = getState();
  return S.requests.filter(q => ['finding', 'covered', 'queued', 'stalled'].includes(q.status)).sort((a, b) => a.neededBy - b.neededBy);
}

export function arrivals() {
  const S = getState();
  const out = [];
  activeReqs().forEach(q => q.invites.forEach(v => {
    if (['yes', 'ontheway', 'arrived'].includes(v.status) && q.kind !== 'planned') {
      out.push({ q, v, d: S.donors.find(x => x.id === v.donorId) });
    }
  }));
  return out;
}

export function upcoming(days) {
  const S = getState();
  const out = [];
  const end = now() + days * DAY;
  S.patients.filter(p => p.active).forEach(p => {
    let at = p.nextAt;
    while (at <= end) {
      out.push({ p, at, b: bookingFor(p, at) });
      at += p.interval * DAY;
    }
  });
  return out.sort((a, b) => a.at - b.at);
}

export function expiring(h) {
  const S = getState();
  return (S.stock || []).filter(u => ['stock', 'usefirst', 'offered'].includes(u.status) && u.expiresAt - now() <= h * 3600e3).sort((a, b) => a.expiresAt - b.expiresAt);
}

export function circleReady(p) {
  const S = getState();
  return p.circle.map(id => S.donors.find(d => d.id === id)).filter(d => d && ['ready', 'locked'].includes(donorState(d).k)).length;
}

export function bookingTag(p, at, b) {
  const S = getState();
  if (!b) return `<span class="pill">Books ${shortDay(at - S.rules.bookAheadDays * DAY)}</span>`;
  const yes = b.invites.find(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status));
  const ask = b.invites.find(v => ['sent', 'seen'].includes(v.status));
  const nm = v => first(S.donors.find(d => d.id === v.donorId).name);
  if (b.status === 'done') return `<span class="pill ok">${ic('check', 13)}Blood ready</span>`;
  if (b.status === 'covered') return `<span class="pill ok"><span class="dot"></span>${esc(yes ? nm(yes) : 'Donor')} booked</span>`;
  if (b.status === 'finding') return `<span class="pill red live"><span class="dot"></span>Asking ${esc(ask ? nm(ask) : 'circle')}</span>`;
  if (b.status === 'stalled') return `<span class="pill warn">${ic('alert', 13)}Needs a donor</span>`;
  return reqStatus(b);
}

export function dblock(ts) {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return `<div class="dblock ${today ? 'today' : ''}"><b>${d.getDate()}</b><small>${today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</small></div>`;
}

export function todaySummary() {
  const w = upcoming(7).length, e = expiring(72).length;
  return `${fmtDay(now())}. ${w ? `${w} transfusion${w > 1 ? 's' : ''} this week` : 'No transfusions this week'}${e ? `, ${e} unit${e > 1 ? 's' : ''} expiring in 3 days` : ''}.`;
}

export function todayLive() {
  const S = getState();
  const wk = upcoming(7), exp = expiring(72), st = S.stockStats;
  const booked = wk.filter(x => x.b && ['covered', 'done'].includes(x.b.status)).length;
  const asking = wk.filter(x => x.b && x.b.status === 'finding').length;
  const need = wk.filter(x => x.b && x.b.status === 'stalled').length;
  const plt = exp.filter(u => u.comp === 'plt').length;
  const urgent = activeReqs().filter(q => q.kind !== 'planned');
  return `<div class="kpis">
    <a class="kpi glass" href="#/patients"><span class="k-l">${ic('heart', 16)}This week</span><span class="k-n">${wk.length}<small> transfusion${wk.length === 1 ? '' : 's'}</small></span><span class="k-s">${booked} donor${booked === 1 ? '' : 's'} booked${asking ? `, ${asking} being asked` : ''}${need ? `, <b style="color:var(--warn)">${need} need a donor</b>` : ''}</span></a>
    <a class="kpi glass" href="#/stock"><span class="k-l">${ic('clock', 16)}Expiring in 3 days</span><span class="k-n" ${exp.length ? 'style="color:var(--red)"' : ''}>${exp.length}<small> unit${exp.length === 1 ? '' : 's'}</small></span><span class="k-s">${plt} platelet${plt === 1 ? '' : 's'}, ${exp.length - plt} other. Offer them before they expire.</span></a>
    <a class="kpi glass" href="#/stock"><span class="k-l">${ic('truck', 16)}Saved this month</span><span class="k-n" style="color:var(--ok)">${st.savedThisMonth}<small> unit${st.savedThisMonth === 1 ? '' : 's'}</small></span><span class="k-s">Moved before expiry. ${st.expiredThisMonth} expired, down from ${st.expiredLastMonth} last month.</span></a>
  </div>
  <div class="grid2 block" style="margin-top:38px">
    <section><div class="sh"><h2>Coming up this week</h2><a href="#/patients">All patients</a></div>
      <div class="panel card">${wk.length ? wk.map(({ p, at, b }) => `<a class="rrow" href="#/patient/${p.id}">${dblock(at)}
        <div class="grow"><div class="title">${esc(p.name)}</div><div class="meta"><span>${esc(p.condition)}, ${p.units} unit${p.units > 1 ? 's' : ''}</span><span>${fmtTime(at)}</span></div></div>
        <div class="end"><div class="tok xs">${g(p.group)}</div>${bookingTag(p, at, b)}<span class="chev">${ic('chev', 18)}</span></div></a>`).join('') : `<p class="muted" style="padding:18px 14px">No transfusions in the next 7 days.</p>`}</div></section>
    <section><div class="sh"><h2>Expiring soon</h2><a href="#/stock">All stock</a></div>
      <div class="panel card">${exp.length ? exp.slice(0, 5).map(u => unitRow(u, true)).join('') : `<p class="muted" style="padding:18px 14px">Nothing expires in the next 3 days.</p>`}</div></section>
  </div>
  ${urgent.length ? `<section class="block"><div class="sh"><h2>Urgent requests and top-ups</h2><a href="#/bookings">All bookings</a></div>${reqList(urgent)}</section>` : ''}`;
}

export function vToday() {
  const h = new Date().getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `<div class="head" style="margin-bottom:26px"><div><h1>${hello}</h1><p class="sub" id="today-sum">${todaySummary()}</p></div>
    <div class="row today-acts" style="gap:10px"><a class="btn ghost lg" href="#/patients">${ic('heart', 18)}Patients</a><button class="btn primary lg" data-act="new-request">${ic('plus', 18)}Urgent request</button></div></div>
  <div id="today-live">${todayLive()}</div>`;
}
