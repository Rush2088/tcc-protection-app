// session.js — Save / Load project settings (v2: Project > Devices hierarchy)
// Backward-compatible: v1 flat files are wrapped into a single device on load.

import { loadDevicesFromSession, getSessionData } from './device-manager.js';

// --- Save ---
export function saveSession() {
  const projName = (document.getElementById('projName') || {}).value || 'My Project';
  const { devices, activeDevice } = getSessionData();
  const data = {
    version:      2,
    project:      projName,
    activeDevice,
    devices
  };
  const filename = projName.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'tcc-settings';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename + '.json' });
  a.click();
  URL.revokeObjectURL(url);
}

// --- Load ---
export function loadSession() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  inp.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      loadDevicesFromSession(upgradeToV2(raw));
    } catch (err) {
      alert('Failed to load settings: ' + err.message);
    }
  };
  inp.click();
}

// Convert v1 flat JSON to v2 { project, devices[] } shape
function upgradeToV2(data) {
  if (data.version === 2 && Array.isArray(data.devices)) return data;
  // v1: flat structure with project, baseV, relays, customDevices, faultLevels…
  return {
    version:      2,
    project:      data.project || 'My Project',
    activeDevice: 0,
    devices: [{
      name:            data.project || 'Device 1',
      baseV:           data.baseV          || '0.415',
      relays:          data.relays         || [],
      customDevices:   data.customDevices  || [],
      faultLevels:     data.faultLevels    || [],
      thermalCables:   data.thermalCables  || [],
      thermalSettings: data.thermalSettings || { k: 143, iMin: 1, iMax: 20 }
    }]
  };
}
