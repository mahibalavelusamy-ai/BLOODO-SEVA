import { DAY } from '../engine/constants.js';
import { ic } from './icons.js';

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const g = x => esc(String(x).replace('-', '−'));
export const now = () => Date.now();
export const uid = p => p + Math.random().toString(36).slice(2, 9);
export const first = n => String(n).split(' ')[0];
export const initials = n => String(n).split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
export const daysSince = ts => ts ? Math.floor((now() - ts) / DAY) : Infinity;
export const recoveryDays = d => d.gender === 'Female' ? 120 : 90;

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDay(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ').toLowerCase();
}

export function fmtWhen(ts) {
  const d = new Date(ts), t = new Date();
  const tm = fmtTime(ts);
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return `today, ${tm}`;
  const y = new Date(t);
  y.setDate(t.getDate() - 1);
  if (same(d, y)) return `yesterday, ${tm}`;
  const tw = new Date(t);
  tw.setDate(t.getDate() + 1);
  if (same(d, tw)) return `tomorrow, ${tm}`;
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${tm}`;
}

export function until(ts) {
  const m = Math.round((ts - now()) / 60000);
  if (m <= 0) return 'overdue';
  if (m < 60) return `in ${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `in ${h} h`;
  return `in ${Math.round(h / 24)} days`;
}

export function ago(ts) {
  const m = Math.round((now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const dd = Math.round(h / 24);
  return dd === 1 ? 'yesterday' : `${dd} days ago`;
}

export function ageFrom(dob) {
  if (!dob) return null;
  const b = new Date(dob), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

export function maskPhone(p) {
  p = String(p);
  return p.length >= 10 ? `${p.slice(0, 2)}••• ••${p.slice(-3)}` : p;
}

export function rng(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
export const word = (n, lower) => {
  const w = n <= 10 ? WORDS[n] : String(n);
  return lower ? w.toLowerCase() : w;
};

export function hashStr(t) {
  let h = 7;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function normOpts(o) {
  return o.map(x => typeof x === 'string' ? { v: x, l: x } : x);
}

export function cleanPhone(v, kind) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  if (kind === 'mobile') {
    if (d.startsWith('0')) d = d.slice(1);
    return d.slice(0, 10);
  }
  return d.slice(0, 11);
}

export function phoneStatus(v, kind) {
  const d = cleanPhone(v, kind);
  if (!d) return { cls: '', txt: kind === 'mobile' ? '0/10' : '' };
  if (kind === 'mobile') {
    if (!/^[6-9]/.test(d)) return { cls: 'bad', txt: 'Starts with 6–9' };
    return /^[6-9]\d{9}$/.test(d) ? { cls: 'good', txt: '✓' } : { cls: '', txt: `${d.length}/10` };
  }
  return /^\d{10,11}$/.test(d) ? { cls: 'good', txt: '✓' } : { cls: '', txt: `${d.length} digits` };
}

export const validPin = v => /^[1-9]\d{5}$/.test(v);
export const DOB_MIN = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 65); return ymd(d); };
export const DOB_MAX = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return ymd(d); };

export function toast(html, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = (kind === 'ok' ? ic('check', 16) : '') + `<span>${html}</span>`;
  const container = $('#toasts');
  if (container) {
    container.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
    }, 3600);
  }
}
