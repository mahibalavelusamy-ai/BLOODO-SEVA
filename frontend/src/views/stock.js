import { GROUPS, COMP, DAY } from '../engine/constants.js';
import { ic } from '../lib/icons.js';
import { esc, g, fmtWhen, now } from '../lib/helpers.js';
import { getState } from '../state/store.js';
import { upcoming, expiring } from './today.js';
import { hoursLeft } from '../components/overlays.js';

export function unitRow(u, compact) {
  const S = getState();
  const c = S.network.find(x => x.id === u.offerTo);
  const hrs = (u.expiresAt - now()) / 3600e3;
  const state = u.status === 'offered'
    ? `<span class="pill calm"><span class="dot"></span>Offered to ${esc(c.name.split(' ')[0])}</span>`
    : u.status === 'usefirst' ? '<span class="pill warn">Use first</span>' : '';
  return `<div class="rrow"><div class="tok sm ${u.comp === 'plt' ? '' : 'quiet'}" style="border-radius:50%">${g(u.group)}</div>
    <div class="grow"><div class="title">${esc(COMP[u.comp].short)}</div><div class="meta"><span style="${hrs < 24 ? 'color:var(--red);font-weight:500' : ''}">Expires in ${hoursLeft(u)}</span>${compact ? '' : `<span>${fmtWhen(u.expiresAt)}</span>`}</div></div>
    <div class="end">${state}${u.status === 'offered' ? '' : `<button class="btn primary sm" data-act="offer" data-u="${u.id}">${ic('truck', 15)}Offer nearby</button>`}${compact ? '' : `${u.status === 'stock' ? `<button class="btn ghost sm" data-act="usefirst" data-u="${u.id}">Use first</button>` : ''}<button class="btn ghost sm" data-act="discard" data-u="${u.id}">Discard</button>`}</div></div>`;
}

export function forecast() {
  const S = getState();
  return GROUPS.map(gp => {
    const inStock = S.stock.filter(u => u.group === gp && u.comp === 'rbc' && ['stock', 'usefirst'].includes(u.status) && u.expiresAt > now() + 2 * DAY).length;
    const sched = upcoming(14).filter(x => x.p.group === gp && !(x.b && ['covered', 'done'].includes(x.b.status))).reduce((n, x) => n + x.p.units, 0);
    const usual = Math.round((S.usage[gp] || 0) * 14);
    const incoming = S.requests.filter(q => q.kind === 'topup' && q.group === gp && ['finding', 'covered'].includes(q.status)).reduce((n, q) => n + q.invites.filter(v => ['yes', 'ontheway', 'arrived', 'donated'].includes(v.status)).length, 0);
    const need = sched + usual, gap = need - inStock - incoming;
    return { gp, inStock, sched, usual, need, incoming, gap, surplus: inStock > need * 1.8 && inStock - need > 4 };
  });
}

export function vStock() {
  const S = getState();
  const exp = expiring(72), st = S.stockStats, F = forecast();
  const tot = c => S.stock.filter(u => u.comp === c && ['stock', 'usefirst', 'offered'].includes(u.status)).length;
  return `<div class="head"><div><h1>Stock</h1><p class="sub">Synced from e-RaktKosh at 8:00 am today (simulated in this demo). Bloodo plans donors around it.</p></div></div>
  <div class="kpis">
    <div class="kpi glass"><span class="k-l">${ic('clock', 16)}Expiring in 3 days</span><span class="k-n" ${exp.length ? 'style="color:var(--red)"' : ''}>${exp.length}<small> units</small></span><span class="k-s">Offer them to nearby centres before they’re lost.</span></div>
    <div class="kpi glass"><span class="k-l">${ic('truck', 16)}Saved this month</span><span class="k-n" style="color:var(--ok)">${st.savedThisMonth}<small> units</small></span><span class="k-s">Moved to another centre before expiry.</span></div>
    <div class="kpi glass"><span class="k-l">${ic('trash', 16)}Expired this month</span><span class="k-n">${st.expiredThisMonth}<small> units</small></span><span class="k-s">${st.expiredThisMonth < st.expiredLastMonth ? `Down from ${st.expiredLastMonth} last month.` : `Up from ${st.expiredLastMonth} last month.`}</span></div>
  </div>
  <section class="block" style="margin-top:38px"><div class="sh"><h2>Expiring soon</h2><p>Platelets last only 5 days, so they come first</p></div>
    <div class="panel card">${exp.length ? exp.map(u => unitRow(u)).join('') : `<p class="muted" style="padding:18px 14px">Nothing expires in the next 3 days.</p>`}</div></section>
  <section class="block"><div class="sh"><h2>Next 14 days: red cells</h2><p>Scheduled transfusions plus usual use, against stock that won’t expire first</p></div>
    <div class="card scroll-x" style="padding:6px 6px 0"><table class="table ftable"><thead><tr><th>Group</th><th>In stock</th><th>Patients</th><th>Usual use</th><th>Coming in</th><th>Outlook</th><th></th></tr></thead><tbody>
    ${F.map(f => `<tr><td><div class="tok xs">${g(f.gp)}</div></td><td>${f.inStock}</td><td>${f.sched || '–'}</td><td>${f.usual || '–'}</td><td>${f.incoming || '–'}</td>
      <td>${f.gap > 0 ? `<span class="pill warn">${ic('alert', 13)}Short by ${f.gap}</span>` : f.surplus ? `<span class="pill calm">Plenty. Hold off inviting</span>` : `<span class="pill ok"><span class="dot"></span>On track</span>`}</td>
      <td style="text-align:right">${f.gap > 0 ? `<button class="btn primary sm" data-act="topup" data-g="${f.gp}" data-n="${f.gap}">Invite ${f.gap} donor${f.gap > 1 ? 's' : ''}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
    <p class="small muted" style="margin-top:12px;padding:0 4px">Inviting only the donors you’ll need, when you’ll need them, means less blood expires on the shelf.</p></section>
  <section class="block"><div class="sh"><h2>On the shelf</h2><p>${tot('rbc')} red cells, ${tot('plt')} platelets, ${tot('ffp')} plasma</p></div>
    <div class="card scroll-x" style="padding:6px 6px 0"><table class="table ftable"><thead><tr><th>Component</th>${GROUPS.map(x => `<th>${g(x)}</th>`).join('')}</tr></thead><tbody>
    ${['rbc', 'plt', 'ffp'].map(c => `<tr><td class="mid">${COMP[c].short}</td>${GROUPS.map(x => { const n = S.stock.filter(u => u.comp === c && u.group === x && ['stock', 'usefirst', 'offered'].includes(u.status)).length; return `<td style="${n === 0 ? 'color:var(--ink-3)' : ''}">${n}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

