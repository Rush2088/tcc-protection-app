// Shared state
export const RELAY_COLORS  = ['#1e6bb8', '#c0392b'];
export const faultLevels   = [];
export const customDevices = [
  { name: 'Custom 1', en: false, color: '#27ae60', points: [] },
  { name: 'Custom 2', en: false, color: '#e67e22', points: [] },
  { name: 'Custom 3', en: false, color: '#8e44ad', points: [] }
];
// Thermal damage cables: t = (k * area / I)^2
export const thermalCables = [
  { name: 'Cable 1', en: false, color: '#795548', area: 95 },
  { name: 'Cable 2', en: false, color: '#607d8b', area: 50 }
];
