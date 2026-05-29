// Shared application state
export const RELAY_COLORS = ['#1e6bb8', '#c0392b'];

export const relays = [
  {
    name: 'Relay 1', en: true, color: '#1e6bb8',
    s1: { en: true,  ip: 2000,  tms: 0.8,  ct: 'EI', mop: 0 },
    s2: { en: false, ip: 10,    tms: 0.85, ct: 'EI', mop: 0 },
    dt: { en: true,  ip: 13000, td:  0.3   }
  },
  {
    name: 'Relay 2', en: false, color: '#c0392b',
    s1: { en: true,  ip: 1000,  tms: 0.8,  ct: 'VI', mop: 0 },
    s2: { en: false, ip: 10,    tms: 0.85, ct: 'EI', mop: 0 },
    dt: { en: true,  ip: 6000,  td:  0.08  }
  }
];

export const faultLevels   = [];
export const customDevices = [
  { name: 'Custom 1', en: false, color: '#27ae60', points: [], settings: '', deviceType: '' },
  { name: 'Custom 2', en: false, color: '#e67e22', points: [], settings: '', deviceType: '' },
  { name: 'Custom 3', en: false, color: '#8e44ad', points: [], settings: '', deviceType: '' }
];
export const thermalCables = [
  { name: 'Cable 1', en: false, color: '#795548', area: 95 },
  { name: 'Cable 2', en: false, color: '#607d8b', area: 50 }
];

export const thermalTransformers = [
  { name: 'Aux Tx', en: false, color: '#e91e63', mva: 0.5, isc: 11, showFreq: false }
];