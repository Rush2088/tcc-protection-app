/**
 * session.js - Save / Load panel settings to/from a .json file.
 * Relay data is serialised directly from/to relays[] state (no DOM scraping).
 */

import { relays, faultLevels, customDevices, thermalCables } from '../state.js';

const gEl  = id => document.getElementById(id);
const gVal = id => { const e = gEl(id); return e ? e.value : null; };
const gChk = id => { const e = gEl(id); return e ? e.checked : false; };
const sVal = (id, v) => { const e = gEl(id); if (e) e.value = v; };
const sChk = (id, v) => { const e = gEl(id); if (e) e.checked = !!v; };

// --- Save ------------------------------------------------------------------
export function saveSession() {
  const data = {
    version: 1,
    project: gVal('projName') || 'Sample Proj - TCC',
    baseV:   gVal('baseV')    || '0.4',
    relays:  relays.map(r => ({
      name: r.name, en: r.en,
      s1: { en: r.s1.en, ip: r.s1.ip, tms: r.s1.tms, ct: r.s1.ct },
      s2: { en: r.s2.en, ip: r.s2.ip, tms: r.s2.tms, ct: r.s2.ct },
      dt: { en: r.dt.en, ip: r.dt.ip, td:  r.dt.td  }
    })),
    customDevices: customDevices.map((cd, i) => ({
      name:   gVal('cd' + i + '-name') || cd.name,
      en:     gChk('cd' + i + '-en'),
      color:  gVal('cd' + i + '-color') || cd.color,
      points: cd.points.map(p => ({ i: p.i, t: p.t }))
    })),
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
    },
    faultLevels: faultLevels.map(fl => ({
      label: fl.label, a: fl.a, en: fl.en !== false
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'tcc-settings.json' });
  a.click();
  URL.revokeObjectURL(url);
}

// --- Load ------------------------------------------------------------------
export function loadSession() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { applySession(JSON.parse(await file.text())); }
    catch (err) { alert('Failed to load settings:
' + err.message); }
  };
  input.click();
}

function applySession(data) {
  // Info
  if (data.project != null) sVal('projName', data.project);
  if (data.baseV   != null) sVal('baseV', data.baseV);

  // Relays: write into state, then rebuild sidebar DOM from state
  (data.relays || []).forEach((r, idx) => {
    if (!relays[idx]) return;
    const t = relays[idx];
    if (r.name != null) t.name   = r.name;
    if (r.en   != null) t.en     = r.en;
    if (r.s1) {
      if (r.s1.en  != null) t.s1.en  = r.s1.en;
      if (r.s1.ip  != null) t.s1.ip  = r.s1.ip;
      if (r.s1.tms != null) t.s1.tms = r.s1.tms;
      if (r.s1.ct  != null) t.s1.ct  = r.s1.ct;
    }
    if (r.s2) {
      if (r.s2.en  != null) t.s2.en  = r.s2.en;
      if (r.s2.ip  != null) t.s2.ip  = r.s2.ip;
      if (r.s2.tms != null) t.s2.tms = r.s2.tms;
      if (r.s2.ct  != null) t.s2.ct  = r.s2.ct;
    }
    if (r.dt) {
      if (r.dt.en != null) t.dt.en = r.dt.en;
      if (r.dt.ip != null) t.dt.ip = r.dt.ip;
      if (r.dt.td != null) t.dt.td = r.dt.td;
    }
  });
  // Rebuild relay cards from updated state
  if (window.renderRelaySidebar) window.renderRelaySidebar();

  // Custom devices
  (data.customDevices || []).forEach((cd, i) => {
    if (!customDevices[i]) return;
    customDevices[i].name   = cd.name   ?? customDevices[i].name;
    customDevices[i].color  = cd.color  ?? customDevices[i].color;
    customDevices[i].en     = cd.en     ?? customDevices[i].en;
    customDevices[i].points = (cd.points || []).map(p => ({ i: p.i, t: p.t }));
    sVal('cd' + i + '-name',  customDevices[i].name);
    sChk('cd' + i + '-en',    customDevices[i].en);
    const colEl = gEl('cd' + i + '-color'); if (colEl) colEl.value = customDevices[i].color;
    const dotEl = gEl('cd' + i + '-dot');   if (dotEl) dotEl.style.background = customDevices[i].color;
    const ptEl  = gEl('cd' + i + '-ptcount'); if (ptEl) ptEl.textContent = customDevices[i].points.length + ' pts';
  });

  // Fault levels
  faultLevels.length = 0;
  (data.faultLevels || []).forEach(fl => faultLevels.push({ label: fl.label, a: fl.a, en: fl.en !== false }));

  // Thermal cables
  (data.thermalCables || []).forEach((tc, i) => {
    if (!thermalCables[i]) return;
    thermalCables[i].name  = tc.name  ?? thermalCables[i].name;
    thermalCables[i].color = tc.color ?? thermalCables[i].color;
    thermalCables[i].en    = tc.en    ?? thermalCables[i].en;
    thermalCables[i].area  = tc.area  ?? thermalCables[i].area;
    sVal('tdc' + i + '-name',  thermalCables[i].name);
    sChk('tdc' + i + '-en',    thermalCables[i].en);
    sVal('tdc' + i + '-color', thermalCables[i].color);
    sVal('tdc' + i + '-area',  thermalCables[i].area);
    const dotEl = gEl('tdc' + i + '-dot'); if (dotEl) dotEl.style.background = thermalCables[i].color;
  });
  if (data.thermalSettings) {
    const ts = data.thermalSettings;
    if (ts.k    != null) sVal('tdc-k',    ts.k);
    if (ts.iMin != null) sVal('tdc-imin', ts.iMin);
    if (ts.iMax != null) sVal('tdc-imax', ts.iMax);
  }

  if (window.render)       window.render();
}
