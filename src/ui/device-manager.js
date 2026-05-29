// device-manager.js -- Project / Device hierarchy
import { relays, faultLevels, customDevices, thermalCables } from '../state.js';

let _devices   = [];
let _activeIdx = 0;

const gEl  = id => document.getElementById(id);
const gVal = id => { const e = gEl(id); return e ? e.value : null; };
const gChk = id => { const e = gEl(id); return e ? e.checked : false; };
const sVal = (id, v) => { const e = gEl(id); if (e) e.value = v; };
const sChk = (id, v) => { const e = gEl(id); if (e) e.checked = !!v; };

function captureSnapshot(name) {
  return {
    name: name || (_devices[_activeIdx] && _devices[_activeIdx].name) || 'Device 1',
    baseV:    gVal('baseV') || '0.415',
    xUnit:    gVal('xUnit') || 'kA',
    showFull: gChk('showFull'),
    xMin:     window.zoomState ? window.zoomState.xMin : 10,
    xMax:     window.zoomState ? window.zoomState.xMax : 50000,
    relays: relays.map(r => ({
      name: r.name, en: r.en,
      s1: Object.assign({}, r.s1),
      s2: Object.assign({}, r.s2),
      dt: Object.assign({}, r.dt)
    })),
    customDevices: customDevices.map((cd, i) => ({
      name:       gVal('cd' + i + '-name') || cd.name,
      en:         gChk('cd' + i + '-en'),
      color:      gVal('cd' + i + '-color') || cd.color,
      points:     cd.points.map(p => ({ i: p.i, t: p.t })),
      deviceType: cd.deviceType || '',
      settings:   cd.settings   || ''
    })),
    faultLevels: faultLevels.map(fl => ({ label: fl.label, a: fl.a, en: fl.en !== false })),
    thermalCables: thermalCables.map((tc, i) => ({
      name:  gVal('tdc' + i + '-name')  || tc.name,
      en:    gChk('tdc' + i + '-en'),
      color: gVal('tdc' + i + '-color') || tc.color,
      area:  parseFloat(gVal('tdc' + i + '-area')) || tc.area
    })),
    thermalSettings: {
      k:    parseFloat(gVal('tdc-k'))    || 143,
      iMin: parseFloat(gVal('tdc-imin')) || 1,
      iMax: parseFloat(gVal('tdc-imax')) || 20
    }
  };
}

function restoreSnapshot(snap) {
  sVal('baseV',    snap.baseV    != null ? snap.baseV    : '0.415');
  sVal('xUnit',    snap.xUnit    != null ? snap.xUnit    : 'kA');
  sChk('showFull', snap.showFull != null ? snap.showFull : false);
  if (window.zoomState) {
    if (snap.xMin != null) window.zoomState.xMin = snap.xMin;
    if (snap.xMax != null) window.zoomState.xMax = snap.xMax;
  }
  (snap.relays || []).forEach((r, i) => {
    if (!relays[i]) return;
    relays[i].name = r.name != null ? r.name : relays[i].name;
    relays[i].en   = r.en   != null ? r.en   : relays[i].en;
    if (r.s1) Object.assign(relays[i].s1, r.s1);
    if (r.s2) Object.assign(relays[i].s2, r.s2);
    if (r.dt) Object.assign(relays[i].dt, r.dt);
  });
  if (window.renderRelaySidebar) window.renderRelaySidebar();
  (snap.customDevices || []).forEach((cd, i) => {
    if (!customDevices[i]) return;
    customDevices[i].name       = cd.name       != null ? cd.name       : customDevices[i].name;
    customDevices[i].color      = cd.color      != null ? cd.color      : customDevices[i].color;
    customDevices[i].en         = cd.en         != null ? cd.en         : customDevices[i].en;
    customDevices[i].points     = (cd.points || []).map(p => ({ i: p.i, t: p.t }));
    customDevices[i].deviceType = cd.deviceType != null ? cd.deviceType : '';
    customDevices[i].settings   = cd.settings   != null ? cd.settings   : '';
    sVal('cd' + i + '-name',  customDevices[i].name);
    sChk('cd' + i + '-en',    customDevices[i].en);
    const colEl = gEl('cd' + i + '-color'); if (colEl) colEl.value = customDevices[i].color;
    const dotEl = gEl('cd' + i + '-dot');   if (dotEl) dotEl.style.background = customDevices[i].color;
    const ptEl  = gEl('cd' + i + '-ptcount'); if (ptEl) ptEl.textContent = customDevices[i].points.length + ' pts';
  });
  faultLevels.length = 0;
  (snap.faultLevels || []).forEach(fl => faultLevels.push({ label: fl.label, a: fl.a, en: fl.en !== false }));
  (snap.thermalCables || []).forEach((tc, i) => {
    if (!thermalCables[i]) return;
    thermalCables[i].name  = tc.name  != null ? tc.name  : thermalCables[i].name;
    thermalCables[i].color = tc.color != null ? tc.color : thermalCables[i].color;
    thermalCables[i].en    = tc.en    != null ? tc.en    : thermalCables[i].en;
    thermalCables[i].area  = tc.area  != null ? tc.area  : thermalCables[i].area;
    sVal('tdc' + i + '-name',  thermalCables[i].name);
    sChk('tdc' + i + '-en',    thermalCables[i].en);
    sVal('tdc' + i + '-color', thermalCables[i].color);
    sVal('tdc' + i + '-area',  thermalCables[i].area);
    const dotEl = gEl('tdc' + i + '-dot'); if (dotEl) dotEl.style.background = thermalCables[i].color;
  });
  if (snap.thermalSettings) {
    const ts = snap.thermalSettings;
    if (ts.k    != null) sVal('tdc-k',    ts.k);
    if (ts.iMin != null) sVal('tdc-imin', ts.iMin);
    if (ts.iMax != null) sVal('tdc-imax', ts.iMax);
  }
  if (window.render)       window.render();
  if (window.renderFLList) window.renderFLList();
}

function _defaultDevice(name) {
  return {
    name: name || 'Device 1',
    baseV:    '0.415',
    xUnit:    'kA',
    showFull: false,
    xMin:     10,
    xMax:     50000,
    relays: [
      { name: 'Relay 1', en: true,  s1: { en: true,  ip: 2000,  tms: 0.8,  ct: 'EI', mop: 30 }, s2: { en: false, ip: 10,  tms: 0.85, ct: 'EI', mop: 30 }, dt: { en: true,  ip: 13000, td: 0.3  } },
      { name: 'Relay 2', en: false, s1: { en: true,  ip: 1000,  tms: 0.8,  ct: 'VI', mop: 30 }, s2: { en: false, ip: 10,  tms: 0.85, ct: 'EI', mop: 30 }, dt: { en: true,  ip: 6000,  td: 0.08 } }
    ],
    customDevices: [
      { name: 'Custom 1', en: false, color: '#27ae60', points: [], deviceType: '', settings: '' },
      { name: 'Custom 2', en: false, color: '#e67e22', points: [], deviceType: '', settings: '' },
      { name: 'Custom 3', en: false, color: '#8e44ad', points: [], deviceType: '', settings: '' }
    ],
    faultLevels: [],
    thermalCables: [
      { name: 'Cable 1', en: false, color: '#795548', area: 95 },
      { name: 'Cable 2', en: false, color: '#607d8b', area: 50 }
    ],
    thermalSettings: { k: 143, iMin: 1, iMax: 20 }
  };
}

function _syncDeviceUI() {
  const sel = gEl('deviceSelect');
  if (sel) {
    sel.innerHTML = _devices.map((d, i) =>
      '<option value="' + i + '"' + (i === _activeIdx ? ' selected' : '') + '>' +
      d.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
      '</option>'
    ).join('');
  }
}


export function initDeviceManager() {
  _devices   = [captureSnapshot('Device 1')];
  _activeIdx = 0;
  _syncDeviceUI();
}

export function getTitle() {
  const proj = gVal('projName') || '';
  const dev  = (_devices[_activeIdx] && _devices[_activeIdx].name) || '';
  if (proj && dev) return proj + ' — ' + dev + ' TCC Plot';
  return (proj || dev) + ' TCC Plot';
}

export function getDeviceName()  { return (_devices[_activeIdx] && _devices[_activeIdx].name) || 'Device 1'; }
export function getActiveIdx()   { return _activeIdx; }
export function getDeviceCount() { return _devices.length; }
export function getAllDevices()   { return _devices; }

export function saveCurrentDevice() {
  const name = (_devices[_activeIdx] && _devices[_activeIdx].name) || 'Device 1';
  _devices[_activeIdx] = captureSnapshot(name);
}

export function switchDevice(idx) {
  if (idx === _activeIdx || idx < 0 || idx >= _devices.length) return;
  saveCurrentDevice();
  _activeIdx = idx;
  restoreSnapshot(_devices[idx]);
  _syncDeviceUI();
}

export function addDevice(name) {
  const trimmed = (name || '').trim() || 'New Device';
  saveCurrentDevice();
  _devices.push(_defaultDevice(trimmed));
  _activeIdx = _devices.length - 1;
  restoreSnapshot(_devices[_activeIdx]);
  _syncDeviceUI();
}

export function renameDevice(idx, newName) {
  const trimmed = (newName || '').trim();
  if (!trimmed || idx < 0 || idx >= _devices.length) return;
  if (idx === _activeIdx) saveCurrentDevice();
  _devices[idx].name = trimmed;
  _syncDeviceUI();
}

export function cloneDevice(idx) {
  if (idx < 0 || idx >= _devices.length) return;
  saveCurrentDevice();
  const clone = JSON.parse(JSON.stringify(_devices[idx]));
  clone.name = clone.name + ' (copy)';
  _devices.push(clone);
  _activeIdx = _devices.length - 1;
  restoreSnapshot(_devices[_activeIdx]);
  _syncDeviceUI();
}

export function copyToDevice(fromIdx, toIdx, parts) {
  if (fromIdx === toIdx || fromIdx < 0 || fromIdx >= _devices.length) return;
  if (toIdx < 0 || toIdx >= _devices.length) return;
  saveCurrentDevice();
  const src = _devices[fromIdx];
  const dst = _devices[toIdx];
  if (parts.relays)          dst.relays          = JSON.parse(JSON.stringify(src.relays));
  if (parts.customDevices)   dst.customDevices   = JSON.parse(JSON.stringify(src.customDevices));
  if (parts.faultLevels)     dst.faultLevels     = JSON.parse(JSON.stringify(src.faultLevels));
  if (parts.thermalCables)   dst.thermalCables   = JSON.parse(JSON.stringify(src.thermalCables));
  if (parts.thermalSettings) dst.thermalSettings = JSON.parse(JSON.stringify(src.thermalSettings));
  if (toIdx === _activeIdx)  restoreSnapshot(_devices[_activeIdx]);
}

export function deleteDevice(idx) {
  if (_devices.length <= 1) { alert('Cannot delete the last device.'); return; }
  _devices.splice(idx, 1);
  if (_activeIdx >= _devices.length) _activeIdx = _devices.length - 1;
  restoreSnapshot(_devices[_activeIdx]);
  _syncDeviceUI();
}

export function onProjectNameChange() { _syncChartTitle(); }

export function loadDevicesFromSession(data) {
  if (data.project != null) sVal('projName', data.project);
  _devices = (data.devices || []).map(d => Object.assign({}, d));
  if (!_devices.length) _devices = [_defaultDevice()];
  _activeIdx = Math.min(data.activeDevice || 0, _devices.length - 1);
  restoreSnapshot(_devices[_activeIdx]);
  _syncDeviceUI();
}

export function getSessionData() {
  saveCurrentDevice();
  return { devices: JSON.parse(JSON.stringify(_devices)), activeDevice: _activeIdx };
}
