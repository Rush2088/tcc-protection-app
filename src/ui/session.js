/**
 * session.js  —  Save / Load all panel settings to/from a .json file.
 *
 * Saved data:
 *   version, baseV, relays[1-2], customDevices[0-1], faultLevels[]
 */

import { faultLevels, customDevices } from '../state.js';

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const gEl  = id => document.getElementById(id);
const gVal = id => { const e = gEl(id); return e ? e.value : null; };
const gChk = id => { const e = gEl(id); return e ? e.checked : false; };
const sVal = (id, v) => { const e = gEl(id); if (e) e.value = v; };
const sChk = (id, v) => { const e = gEl(id); if (e) e.checked = !!v; };

// ─── Relay serialisation ─────────────────────────────────────────────────────
function getRelayData(n) {
  const p = k => 'r' + n + '-' + k;
  return {
    name: gVal(p('name')),
    en:   gChk(p('en')),
    s1: { en: gChk(p('s1-en')), ip: +gVal(p('s1-ip')), tms: +gVal(p('s1-tms')), ct: gVal(p('s1-ct')) },
    s2: { en: gChk(p('s2-en')), ip: +gVal(p('s2-ip')), tms: +gVal(p('s2-tms')), ct: gVal(p('s2-ct')) },
    dt: { en: gChk(p('dt-en')), ip: +gVal(p('dt-ip')), td:  +gVal(p('dt-td'))  }
  };
}

function setRelayData(n, r) {
  const p = k => 'r' + n + '-' + k;
  sVal(p('name'), r.name);
  sChk(p('en'),   r.en);

  sChk(p('s1-en'),  r.s1.en); sVal(p('s1-ip'), r.s1.ip); sVal(p('s1-tms'), r.s1.tms); sVal(p('s1-ct'), r.s1.ct);
  setStageVisible(p('s1-body'), r.s1.en);

  sChk(p('s2-en'),  r.s2.en); sVal(p('s2-ip'), r.s2.ip); sVal(p('s2-tms'), r.s2.tms); sVal(p('s2-ct'), r.s2.ct);
  setStageVisible(p('s2-body'), r.s2.en);

  sChk(p('dt-en'),  r.dt.en); sVal(p('dt-ip'), r.dt.ip); sVal(p('dt-td'), r.dt.td);
  setStageVisible(p('dt-body'), r.dt.en);
}

function setStageVisible(id, show) {
  const el = gEl(id);
  if (!el) return;
  if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
}

// ─── Save ────────────────────────────────────────────────────────────────────
export function saveSession() {
  const data = {
    version:  1,
    project:  gVal('projName') || 'Sample Proj - TCC',
    baseV:    gVal('baseV') || '0.4',
    relays:  [getRelayData(1), getRelayData(2)],
    customDevices: customDevices.map((cd, i) => ({
      name:   gVal('cd' + i + '-name') || cd.name,
      en:     gChk('cd' + i + '-en'),
      color:  gVal('cd' + i + '-color') || cd.color,
      points: cd.points.map(p => ({ i: p.i, t: p.t }))
    })),
    faultLevels: faultLevels.map(fl => ({
      label: fl.label,
      a:     fl.a,
      en:    fl.en !== false
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'tcc-settings.json' });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Load ────────────────────────────────────────────────────────────────────
export function loadSession() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json' });
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      applySession(JSON.parse(await file.text()));
    } catch (err) {
      alert('Failed to load settings:\n' + err.message);
    }
  };
  input.click();
}

function applySession(data) {
  // Info fields
  if (data.project != null) sVal('projName', data.project);
  if (data.baseV   != null) sVal('baseV', data.baseV);

  // Relays
  (data.relays || []).forEach((r, idx) => setRelayData(idx + 1, r));

  // Custom devices
  (data.customDevices || []).forEach((cd, i) => {
    if (!customDevices[i]) return;
    sVal('cd' + i + '-name', cd.name);
    sChk('cd' + i + '-en',  cd.en);
    const colEl = gEl('cd' + i + '-color');
    if (colEl) colEl.value = cd.color;
    const dotEl = gEl('cd' + i + '-dot');
    if (dotEl) dotEl.style.background = cd.color;
    customDevices[i].name   = cd.name;
    customDevices[i].color  = cd.color;
    customDevices[i].en     = cd.en;
    customDevices[i].points = (cd.points || []).map(p => ({ i: p.i, t: p.t }));
    const ptEl = gEl('cd' + i + '-ptcount');
    if (ptEl) ptEl.textContent = customDevices[i].points.length + ' pts';
  });

  // Fault levels — clear and repopulate
  faultLevels.length = 0;
  (data.faultLevels || []).forEach(fl => faultLevels.push({ label: fl.label, a: fl.a, en: fl.en !== false }));

  // Refresh chart + FL list
  if (window.render) window.render();
}
