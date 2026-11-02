export const GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export const RARE = new Set(['A-', 'B-', 'O-', 'AB-']);

export const RBC = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};

export const PLASMA_ABO = {
  O: ['O', 'A', 'B', 'AB'],
  A: ['A', 'AB'],
  B: ['B', 'AB'],
  AB: ['AB']
};

export const COMP = {
  whole: { name: 'Whole blood', short: 'Whole blood' },
  rbc: { name: 'Red cells', short: 'Red cells' },
  plt: { name: 'Platelets (apheresis)', short: 'Platelets' },
  ffp: { name: 'Plasma', short: 'Plasma' }
};

export const DAY = 864e5;
export const MIN = 60000; // in production: real 60,000 ms = 1 minute

