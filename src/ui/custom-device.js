import { customDevices } from '../state.js';

let _cdEditIdx = 0;
let _cdTmpPts  = [];   // working copy while modal open
let _cdSelRow  = -1;   // selected row index in table

// ─── Band detection ──────────────────────────────────────────────────────────
// MCB/fuse data is often supplied as a closed polygon outlining the min/max
// trip-time band (lower boundary left→right, upper boundary right→left).
// Detects the direction reversal and returns two monotonic sorted curves.
// Returns: { isBand:false, curve } | { isBand:true, lower, upper }
export function splitBand(points) {
  const pts = points.filter(p => p.i > 0 && p.t > 0);
  if (pts.length < 4) return { isBand: false, curve: [...pts].sort((a,b) => a.i - b.i) };

  // Find first direction reversal in current sequence
  let splitIdx = -1, prevDir = 0;
  for (let k = 1; k < pts.length; k++) {
    const d = pts[k].i > pts[k-1].i ? 1 : (pts[k].i < pts[k-1].i ? -1 : 0);
    if (d === 0) continue;
    if (prevDir === 0) { prevDir = d; continue; }
    if (d !== prevDir) { splitIdx = k - 1; break; }
  }

  if (splitIdx < 2) return { isBand: false, curve: [...pts].sort((a,b) => a.i - b.i) };

  const part1 = pts.slice(0, splitIdx + 1).sort((a,b) => a.i - b.i);
  const part2 = pts.slice(splitIdx + 1).sort((a,b) => a.i - b.i);

  // Upper = higher median trip time (the slower/conservative bound)
  const med = arr => arr[Math.floor(arr.length / 2)].t;
  const [lower, upper] = med(part1) <= med(part2) ? [part1, part2] : [part2, part1];
  return { isBand: true, lower, upper };
}

// ─── Log-log operate-time interpolation ─────────────────────────────────────
// For band data uses the upper (slower) bound — conservative for coordination.
export function cdOperateTime(I_A, points) {
  if (!points || points.length < 2) return null;
  const band  = splitBand(points);
  const curve = band.isBand ? band.upper : band.curve;
  if (curve.length < 2 || I_A < curve[0].i || I_A > curve[curve.length - 1].i) return null;
  for (let k = 0; k < curve.length - 1; k++) {
    if (I_A >= curve[k].i && I_A <= curve[k + 1].i) {
      const logI  = Math.log(I_A);
      const logI1 = Math.log(curve[k].i),   logI2 = Math.log(curve[k + 1].i);
      const logT1 = Math.log(curve[k].t),   logT2 = Math.log(curve[k + 1].t);
      return Math.exp(logT1 + (logI - logI1) / (logI2 - logI1) * (logT2 - logT1));
    }
  }
  return null;
}

// ─── Read device state from DOM ──────────────────────────────────────────────
export function getCustomDevices() {
  return customDevices.map((cd, i) => {
    const enEl   = document.getElementById('cd' + i + '-en');
    const nameEl = document.getElementById('cd' + i + '-name');
    const colEl  = document.getElementById('cd' + i + '-color');
    return {
      name:   nameEl ? nameEl.value  : cd.name,
      en:     enEl   ? enEl.checked  : cd.en,
      color:  colEl  ? colEl.value   : cd.color,
      points: cd.points,
    };
  });
}

// ─── Modal internals ─────────────────────────────────────────────────────────
function setSelected(k) {
  _cdSelRow = k;
  document.querySelectorAll('#cd-tbody tr').forEach((tr, j) => {
    tr.style.background = (j === k) ? '#d6eaff' : '';
  });
}

function rebuildTable() {
  const tbody = document.getElementById('cd-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  _cdTmpPts.forEach((p, k) => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML =
      '<td><input class="cd-inp" type="number" step="any" value="' + (p.i || '') + '" ' +
        'onchange="window._cdSet(' + k + ',\'i\',+this.value)"></td>' +
      '<td><input class="cd-inp" type="number" step="any" value="' + (p.t || '') + '" ' +
        'onchange="window._cdSet(' + k + ',\'t\',+this.value)"></td>';
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') setSelected(k); });
    tbody.appendChild(tr);
  });
  _cdSelRow = -1;
}

window._cdSet = function(k, field, val) { if (_cdTmpPts[k]) _cdTmpPts[k][field] = val; };

// ─── Public modal API ─────────────────────────────────────────────────────────
export function openCDModal(idx) {
  _cdEditIdx = idx;
  _cdTmpPts  = customDevices[idx].points.map(p => ({ ...p }));
  const titleEl = document.getElementById('cd-modal-title');
  if (titleEl) {
    const nameEl = document.getElementById('cd' + idx + '-name');
    titleEl.textContent = 'Edit Points — ' + (nameEl ? nameEl.value : customDevices[idx].name);
  }
  rebuildTable();
  document.getElementById('cd-modal').style.display = 'flex';
}

export function closeCDModal() {
  document.getElementById('cd-modal').style.display = 'none';
}

export function saveCDModal() {
  customDevices[_cdEditIdx].points = _cdTmpPts.filter(p => p.i > 0 && p.t > 0);
  const el = document.getElementById('cd' + _cdEditIdx + '-ptcount');
  if (el) el.textContent = customDevices[_cdEditIdx].points.length + ' pts';
  closeCDModal();
  if (window.render) window.render();
}

export function cdAddRow() {
  _cdTmpPts.push({ i: 0, t: 0 });
  rebuildTable();
  const wrap = document.getElementById('cd-tbl-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

export function cdDelRow() {
  if (_cdSelRow >= 0 && _cdSelRow < _cdTmpPts.length) {
    _cdTmpPts.splice(_cdSelRow, 1);
  } else if (_cdTmpPts.length) {
    _cdTmpPts.pop();
  }
  rebuildTable();
}

export function cdMoveUp() {
  if (_cdSelRow > 0) {
    [_cdTmpPts[_cdSelRow], _cdTmpPts[_cdSelRow - 1]] =
      [_cdTmpPts[_cdSelRow - 1], _cdTmpPts[_cdSelRow]];
    const prev = _cdSelRow - 1;
    rebuildTable();
    setSelected(prev);
  }
}

export function cdMoveDown() {
  if (_cdSelRow >= 0 && _cdSelRow < _cdTmpPts.length - 1) {
    [_cdTmpPts[_cdSelRow], _cdTmpPts[_cdSelRow + 1]] =
      [_cdTmpPts[_cdSelRow + 1], _cdTmpPts[_cdSelRow]];
    const next = _cdSelRow + 1;
    rebuildTable();
    setSelected(next);
  }
}

export async function cdPasteClipboard() {
  try {
    const text   = await navigator.clipboard.readText();
    const rows   = text.trim().split(/\r?\n/);
    const parsed = [];
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split('\t');
      if (cols.length < 2) continue;
      // Strip thousand-separator commas (e.g. "3,629.490" → "3629.490")
      const i = parseFloat(cols[0].replace(/,/g, '').trim());
      const t = parseFloat(cols[1].replace(/,/g, '').trim());
      if (!isNaN(i) && !isNaN(t) && i > 0 && t > 0) parsed.push({ i, t });
    }
    if (parsed.length) {
      _cdTmpPts = parsed;
      rebuildTable();
    } else {
      alert('No valid rows found.\nExpect two tab-separated columns: Current(A)  Time(s)\nThousand-separator commas are handled automatically.');
    }
  } catch (e) {
    alert('Cannot read clipboard: ' + e.message);
  }
}
