import { STORE, DAY, GROUPS, RARE } from '../engine/constants.js';
import { now, uid, rng, hashStr, daysSince, recoveryDays } from '../lib/helpers.js';
export { daysSince, recoveryDays };

let S = null;

export function getState() {
  return S;
}

export function setState(newState) {
  S = newState;
}

export function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(S));
  } catch (e) {}
}

export function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 2) return s;
    }
  } catch (e) {}
  return null;
}

export function defaultBank() {
  return {
    name: 'Government General Hospital Blood Centre',
    short: 'GGH Blood Centre',
    type: 'Government',
    licence: 'TN/BC/2019/0412',
    officer: 'Dr. R. Kavitha',
    address: 'Poonamallee High Road',
    area: 'Park Town',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    pin: '600003',
    phone: '4425305000',
    email: 'bloodcentre@ggh-demo.in',
    hours: '24h',
    open: '08:00',
    close: '20:00',
    services: { whole: true, rbc: true, plt: true, ffp: true },
    sender: 'GGH Blood Centre'
  };
}

export function migrate() {
  const d = defaultBank();
  S.bank = Object.assign({}, d, S.bank || {});
  if (!S.bank.services) S.bank.services = d.services;
}

export function bankLoc() {
  const b = S.bank;
  return { name: b.name, state: b.state, district: b.district, area: b.area, pin: b.pin || '' };
}

export function reqLoc(q) {
  return q.loc || bankLoc();
}

export function donorKm(d, loc) {
  const b = S.bank;
  if (!loc) return d.km;
  if (loc.state === b.state && loc.district === b.district) {
    if (!loc.pin || !b.pin || loc.pin === b.pin) return d.km;
    const shift = Math.abs(parseInt(loc.pin, 10) - parseInt(b.pin, 10)) % 9;
    return +(Math.abs(d.km - shift) + 0.6).toFixed(1);
  }
  if (d.state === loc.state && d.district === loc.district) {
    return +(1.5 + (hashStr(d.id) % 120) / 10).toFixed(1);
  }
  return 999;
}

export function eligibleNow(d) {
  return daysSince(d.lastDonated) >= recoveryDays(d);
}

export function eligibleOn(d) {
  return d.lastDonated ? d.lastDonated + recoveryDays(d) * DAY : now();
}

export function dayAt(off, h = 10) {
  const d = new Date();
  d.setDate(d.getDate() + off);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
}

export function circleCount(id) {
  return (S.patients || []).filter(p => p.circle.includes(id)).length;
}

export function buildCircle(p, size) {
  const rel = d => (d.stats.yes + 1) / (d.stats.asked + 2);
  const pool = S.donors.filter(d => d.group === p.group && d.consent && !p.circle.includes(d.id) && circleCount(d.id) < 2 && !(d.pausedUntil && d.pausedUntil > now()))
    .sort((a, b) => circleCount(a.id) - circleCount(b.id) || rel(b) - rel(a) || a.km - b.km);
  p.circle.push(...pool.slice(0, Math.max(0, size - p.circle.length)).map(d => d.id));
}

export function seed() {
  const r = rng(42);
  const people = ("Aditya Kumar|M,Meera Nair|F,Siddharth Raman|M,Priya Mani|F,Rahul Venkat|M,Ananya Subramanian|F,Vijay Prakash|M,Deepa Thomas|F,Karthik Krishnan|M,Fathima Beevi|F,Arjun Menon|M,Lakshmi Iyer|F,Mohammed Rafi|M,Divya Shankar|F,Suresh Babu|M,Nandini Rao|F,Harish Gopal|M,Kavya Pillai|F,Imran Khan|M,Sneha Joseph|F,Ganesh Murthy|M,Revathi Sundar|F,Pradeep Selvam|M,Aisha Begum|F,Vignesh Ravi|M,Janani Balaji|F,Sathish Kumar|M,Pooja Reddy|F,Naveen Chandran|M,Swathi Narayanan|F,Rohit Das|M,Anjali Varghese|F,Manoj Kannan|M,Shalini Devi|F,Abdul Kareem|M,Keerthana Mohan|F,Bharath Raj|M,Gayathri Srinivasan|F,Dinesh Pandian|M,Reshma Ali|F,Ajay Varma|M,Monica David|F,Senthil Nathan|M,Harini Prasad|F,Joseph Mathew|M,Vidya Ramesh|F,Kiran Shetty|M,Asha Kurian|F,Prakash Jain|M,Tamilselvi Arul|F,Yusuf Shaikh|M,Bhavya Hegde|F,Rajesh Iyengar|M,Sangeetha Raj|F,Varun Krishna|M,Nisha Paul|F,Gokul Anand|M,Ramya Sekar|F,Faisal Ahmed|M,Indu Lekha|F,Sanjay Mehta|M,Archana Bose|F,Thomas Cherian|M,Uma Maheswari|F").split(',');
  const pool = [];
  const add = (gp, n) => { for (let i = 0; i < n; i++) pool.push(gp); };
  add('O+', 22); add('B+', 19); add('A+', 12); add('AB+', 4); add('O-', 2); add('B-', 2); add('A-', 2); add('AB-', 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const areas = ['Adyar', 'T. Nagar', 'Mylapore', 'Anna Nagar', 'Velachery', 'Guindy', 'Besant Nagar', 'Tambaram', 'Porur', 'Egmore', 'Kodambakkam', 'Perambur', 'Royapettah', 'Saidapet', 'Chromepet', 'Ashok Nagar'];
  const camps = [
    { id: 'c1', name: 'Loyola College NSS camp', date: now() - 38 * DAY, venue: 'Loyola College, Nungambakkam', organiser: 'NSS Unit 4', units: 46, state: 'Tamil Nadu', district: 'Chennai' },
    { id: 'c2', name: 'IT corridor donation drive', date: now() - 12 * DAY, venue: 'Tidel Park, Taramani', organiser: 'Rotary Club of Chennai South', units: 31, state: 'Tamil Nadu', district: 'Chennai' },
    { id: 'c3', name: 'Summer readiness camp', date: now() + 9 * DAY, venue: 'Anna University, Guindy', organiser: 'Student Red Cross', units: 0, state: 'Tamil Nadu', district: 'Chennai' }
  ];
  const donors = people.map((p, i) => {
    const [name, gs] = p.split('|');
    const gender = gs === 'F' ? 'Female' : 'Male';
    const roll = r();
    let last = null;
    if (roll > 0.18) { last = now() - Math.floor(12 + r() * 380) * DAY; }
    const yr = 1975 + Math.floor(r() * 30);
    const asked = Math.floor(r() * 7), yes = Math.min(asked, Math.floor(asked * (0.3 + r() * 0.6)));
    const d = {
      id: 'd' + (i + 1), name, gender, group: pool[i],
      phone: String(9000000000 + Math.floor(r() * 999999999)).replace(/^9/, ['9', '8', '7', '6'][Math.floor(r() * 4)]),
      email: '', dob: `${yr}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 27)).padStart(2, '0')}`,
      state: 'Tamil Nadu', district: 'Chennai', city: areas[Math.floor(r() * areas.length)],
      km: +(0.8 + r() * 21).toFixed(1), apheresis: r() < 0.28, consent: true,
      source: r() < 0.55 ? (r() < 0.6 ? 'c1' : 'c2') : 'walk-in',
      addedAt: now() - Math.floor(20 + r() * 300) * DAY,
      lastDonated: last, donations: last ? 1 + Math.floor(r() * 9) : 0,
      pausedUntil: null, lastNoAt: null, asks: [], stats: { asked, yes, showed: Math.max(0, yes - (r() < .3 ? 1 : 0)) }
    };
    return d;
  });

  donors.filter(d => RARE.has(d.group)).forEach((d, i) => {
    d.apheresis = i % 2 === 0;
    d.lastDonated = i === 1 ? now() - 40 * DAY : now() - (160 + i * 20) * DAY;
    d.donations = Math.max(d.donations, 2);
  });
  const pickNot = n => { let k = n; while (RARE.has(donors[k].group)) k++; return donors[k]; };
  pickNot(5).pausedUntil = now() + 21 * DAY;
  { const a = pickNot(9); a.lastNoAt = now() - 4 * DAY; a.asks = [now() - 4 * DAY]; }
  { const b = pickNot(14); b.asks = [now() - 9 * DAY, now() - 3 * DAY]; }

  S = {
    v: 2,
    bank: defaultBank(),
    rules: { maxPerMonth: 2, restAfterNo: 14, quietStart: 22, quietEnd: 7, perUnit: 4, timeoutMin: 20, radiusKm: 15, maxWaves: 4, circleReplyMin: 60, circleSize: 6, bookAheadDays: 7 },
    theme: null,
    donors,
    camps,
    requests: []
  };

  const dA = donors.find(d => d.group === 'O+' && d.lastDonated && daysSince(d.lastDonated) > 120);
  if (dA) { dA.lastDonated = now() - 1 * DAY; dA.donations++; }
  S.requests.push({
    id: 'r1', kind: 'urgent', group: 'O+', comp: 'whole', units: 1, neededBy: now() - 20 * 3600e3, priority: 'urgent', ref: 'Ward 12, bed 4', notes: '',
    createdAt: now() - 27 * 3600e3, closedAt: now() - 22 * 3600e3, status: 'done', wave: 1, waveDeadline: 0, radius: 15,
    invites: dA ? [{ donorId: dA.id, wave: 1, status: 'donated', sentAt: now() - 27 * 3600e3, eta: 'Within 1 hour', at: now() - 22 * 3600e3 }] : [],
    skipped: {}, log: [{ at: now() - 27 * 3600e3, t: 'Wave 1 sent to 4 donors' }, { at: now() - 22 * 3600e3, t: 'Request completed' }]
  });

  const bp = donors.filter(d => (d.group === 'B+' || d.group === 'O+') && eligibleNow(d) && !d.pausedUntil).slice(0, 2);
  S.requests.push({
    id: 'r2', kind: 'urgent', group: 'B+', comp: 'rbc', units: 2, neededBy: now() + 3 * 3600e3, priority: 'urgent', ref: 'Cardiac OT, Dr. Selvi', notes: 'Scheduled bypass',
    createdAt: now() - 95 * 60e3, status: 'covered', wave: 1, waveDeadline: 0, radius: 15,
    invites: bp.map((d, i) => ({ donorId: d.id, wave: 1, status: i === 0 ? 'arrived' : 'ontheway', sentAt: now() - 95 * 60e3, eta: i === 0 ? 'Within 1 hour' : '2–3 hours', at: now() - 30 * 60e3 })),
    skipped: {}, log: [{ at: now() - 95 * 60e3, t: 'Wave 1 sent to 8 donors' }, { at: now() - 70 * 60e3, t: 'Both units covered. 6 donors told they are not needed.' }]
  });
  bp.forEach(d => { d.asks.push(now() - 95 * 60e3); d.stats.asked++; d.stats.yes++; });
  seedPlanning();
  save();
}

export function seedPlanning() {
  const r = rng(7);
  const rows = [
    ['Ananya R.', 9, 'Thalassemia major', 'B+', 21, 1, 2, 'Ramesh (father)'],
    ['Ashiq M.', 14, 'Thalassemia major', 'O+', 21, 2, 4, 'Shabna (mother)'],
    ['Kaviya S.', 7, 'Thalassemia major', 'A+', 14, 1, 6, 'Selvi (mother)'],
    ['Sneha M.', 5, 'Thalassemia major', 'AB+', 28, 1, 9, 'Manoj (father)'],
    ['Lakshmi P.', 22, 'Sickle cell disease', 'O-', 28, 1, 11, 'Self'],
    ['Arun K.', 11, 'Thalassemia major', 'B+', 21, 1, 16, 'Kumar (father)']
  ];
  S.patients = rows.map((x, i) => ({
    id: 'p' + (i + 1), name: x[0], age: x[1], condition: x[2], group: x[3], interval: x[4], units: x[5], nextAt: dayAt(x[6]), guardian: x[7],
    guardianPhone: String(9400000000 + Math.floor(r() * 99999999)), leuco: true, phenotype: i % 2 === 0, circle: [], rot: 0, active: true, addedAt: now() - Math.floor(200 + r() * 400) * DAY,
    history: [1, 2, 3].map(k => dayAt(x[6] - k * x[4]))
  }));
  S.patients.forEach(p => buildCircle(p, S.rules.circleSize));

  const a = S.patients[0];
  const req = newPlanned(a);
  const dn = S.donors.find(d => d.id === a.circle[0]);
  if (dn) {
    dn.lastDonated = Math.min(dn.lastDonated || 0, now() - 130 * DAY) || now() - 130 * DAY;
    req.status = 'covered';
    req.wave = 1;
    req.invites.push({ donorId: dn.id, wave: 1, status: 'yes', sentAt: now() - 26 * 3600e3, at: now() - 25 * 3600e3, eta: 'Booked for ' + shortDay(req.neededBy) });
    req.log.push({ at: now() - 26 * 3600e3, t: `Asked ${first(dn.name)} from Ananya's circle` }, { at: now() - 25 * 3600e3, t: `${first(dn.name)} is booked to donate` });
    dn.asks.push(now() - 26 * 3600e3);
    dn.stats.asked++;
    dn.stats.yes++;
    a.rot = 1;
  }
  S.requests.push(req);

  const U = [];
  let n = 0;
  const add = (group, comp, count, minH, maxH) => {
    for (let i = 0; i < count; i++) {
      const exp = now() + (minH + r() * (maxH - minH)) * 3600e3;
      U.push({ id: 'u' + (++n), group, comp, expiresAt: exp, collectedAt: exp - (comp === 'plt' ? 5 : comp === 'rbc' ? 35 : 365) * DAY, status: 'stock' });
    }
  };
  [['O+', 26], ['B+', 22], ['A+', 9], ['AB+', 4], ['O-', 1], ['B-', 2], ['A-', 2], ['AB-', 1]].forEach(([gp, c]) => add(gp, 'rbc', c, 110, 820));
  [['O+', 1], ['B+', 1], ['A+', 1], ['AB+', 1]].forEach(([gp, c]) => add(gp, 'rbc', c, 30, 68));
  [['O+', 3], ['B+', 2], ['A+', 2], ['AB+', 2]].forEach(([gp, c]) => add(gp, 'plt', c, 9, 100));
  GROUPS.forEach(gp => add(gp, 'ffp', RARE.has(gp) ? 2 : 6, 3000, 8000));
  S.stock = U;
  S.network = [
    { id: 'n1', name: "Children's Hospital Blood Centre", area: 'Egmore', km: 2.6, needs: [['O+', 'plt'], ['B+', 'rbc'], ['A+', 'plt']] },
    { id: 'n2', name: 'City Medical College Blood Centre', area: 'Kilpauk', km: 3.1, needs: [['A+', 'plt'], ['O+', 'rbc'], ['AB+', 'rbc']] },
    { id: 'n3', name: 'Red Cross Blood Centre', area: 'Egmore', km: 4.4, needs: [['B+', 'plt'], ['AB+', 'plt']] },
    { id: 'n4', name: 'Lakeview Hospital Blood Bank', area: 'Porur', km: 7.8, needs: [['O-', 'rbc'], ['A+', 'rbc']] }
  ];
  S.stockStats = { savedThisMonth: 6, expiredThisMonth: 11, expiredLastMonth: 27 };
  S.usage = { 'O+': 1.6, 'B+': 1.3, 'A+': 0.9, 'AB+': 0.3, 'O-': 0.07, 'B-': 0.07, 'A-': 0.07, 'AB-': 0.04 };
}

export function shortDay(ts) {
  const d = new Date(ts);
  return `${d.toLocaleDateString('en-IN', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`;
}

export function newPlanned(p) {
  const t = now();
  return {
    id: uid('r'), kind: 'planned', patientId: p.id, transfusionAt: p.nextAt, group: p.group, comp: 'rbc', units: p.units,
    neededBy: p.nextAt - DAY, priority: 'routine', ref: p.name, notes: '',
    createdAt: t, status: 'finding', wave: 0, waveDeadline: 0, radius: S.rules.radiusKm, invites: [], skipped: {}, loc: bankLoc(),
    log: [{ at: t, t: `Booking opened for ${first(p.name)}'s transfusion` }]
  };
}

export function bookingFor(p, at) {
  return S.requests.find(q => q.kind === 'planned' && q.patientId === p.id && q.transfusionAt === (at || p.nextAt) && q.status !== 'cancelled');
}

export function patientOf(req) {
  return req.patientId ? S.patients.find(p => p.id === req.patientId) : null;
}
