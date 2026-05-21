import { RELAY_COLORS } from '../state.js';

function getRelay(n) {
  const g  = id => document.getElementById('r' + n + '-' + id);
  const gv = id => parseFloat(g(id).value) || 0;
  return {
    n,
    name:  g('name').value || ('Relay ' + n),
    color: RELAY_COLORS[n - 1],
    en:    g('en').checked,
    s1: { en: g('s1-en').checked, ip: gv('s1-ip') || 5,   tms: gv('s1-tms') || 0.75, ct: g('s1-ct').value },
    s2: { en: g('s2-en').checked, ip: gv('s2-ip') || 10,  tms: gv('s2-tms') || 0.85, ct: g('s2-ct').value },
    dt: { en: g('dt-en').checked, ip: gv('dt-ip') || 150, td:  gv('dt-td')  || 0.05  }
  };
}

export function getRelays()   { return [getRelay(1), getRelay(2)]; }
export function getBaseV()    { return parseFloat(document.getElementById('baseV').value) || 33; }
export function getShowFull() { return document.getElementById('showFull').checked; }

export function getXUnit() { const el = document.getElementById('xUnit'); return el ? el.value : 'kA'; }
