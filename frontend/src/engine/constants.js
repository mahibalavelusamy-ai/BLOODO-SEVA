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

export const PRIORITY = {
  routine: 'Routine',
  urgent: 'Urgent',
  critical: 'Critical'
};

export const INDIA = {
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Trichy", "Salem", "Tirunelveli", "Erode", "Vellore", "Thoothukudi", "Nagercoil", "Thanjavur", "Dindigul"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Palakkad", "Alappuzha", "Kannur", "Kottayam", "Malappuram", "Kasaragod", "Wayanad", "Idukki", "Pathanamthitta"],
  "Karnataka": ["Bengaluru", "Mysuru", "Hubballi", "Dharwad", "Mangaluru", "Belagavi", "Kalaburagi", "Davangere", "Ballari", "Vijayapura", "Shivamogga"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Nashik", "Aurangabad", "Solapur", "Amravati", "Navi Mumbai", "Kolhapur", "Akola"],
  "Delhi": ["New Delhi", "North Delhi", "South Delhi", "East Delhi", "West Delhi", "Central Delhi", "South West Delhi", "North West Delhi", "Shahdara"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar", "Ramagundam", "Mahbubnagar", "Nalgonda", "Adilabad"],
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati", "Kakinada", "Kadapa", "Anantapur"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Navsari"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Bharatpur", "Pali"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Ghaziabad", "Agra", "Meerut", "Varanasi", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Noida"],
  "West Bengal": ["Kolkata", "Howrah", "Asansol", "Siliguri", "Durgapur", "Bardhaman", "Malda", "Baharampur", "Habra", "Kharagpur"]
};

export const MIN = 1000;            /* demo clock: 1 real second = 1 simulated minute */
export const DAY = 864e5;
export const STORE = 'bloodo-console-v2';

export const NO_REASONS = ['Busy today', 'Not feeling well', 'Travelling', 'Donated elsewhere recently'];

export const CONDITIONS = ['Thalassemia major', 'Sickle cell disease', 'Aplastic anaemia', 'Haemophilia', 'Chronic kidney disease', 'Other'];

export const CENTRE_TYPES = ['Government', 'Private hospital', 'Charitable trust', 'Indian Red Cross Society', 'Armed forces'];

export const QUICK_WHEN = [
  ['2h', 'In 2 hours', 2],
  ['4h', 'In 4 hours', 4],
  ['6h', 'In 6 hours', 6],
  ['tonight', 'Tonight, 9 pm'],
  ['tomorrow', 'Tomorrow, 9 am']
];

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
