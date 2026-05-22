/**
 * Export to Excel — effective TCC curve data + fault level operate times.
 * Uses SheetJS (window.XLSX) loaded via <script> tag.
 *
 * Rules:
 *  - Each relay/device gets <= 30 data points
 *  - RDP (Ramer-Douglas-Peucker) in log-log space preserves IDMT curve shape
 *  - Key transition points (pickup, IDMT->DT crossover, DT step) are always kept
 */

import { iecT }           from '../engine/curves.js';
import { findCrossAny }   from '../engine/math.js';
import { getRelays }      from './inputs.js';
import { faultLevels }    from '../state.js';
import { getCustomDevices, cdOperateTime } from './custom-device.js';
import { operateTime }    from '../engine/dataset.js';

const X_MAX   = 50000;
const N_DENSE = 400;
const MAX_PTS = 30;

// RDP in log-log space
function perpDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
}

function rdpCollect(logPts, eps, lo, hi, out) {
  if (hi - lo <= 1) return;
  let maxD = 0, maxI = lo;
  for (let i = lo + 1; i < hi; i++) {
    const d = perpDist(logPts[i], logPts[lo], logPts[hi]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    rdpCollect(logPts, eps, lo, maxI, out);
    out.add(maxI);
    rdpCollect(logPts, eps, maxI, hi, out);
  }
}

function rdpReduce(xyPts, maxPts) {
  if (xyPts.length <= maxPts) return xyPts;
  const log = xyPts.map(p => [Math.log10(p.x), Math.log10(p.y)]);
  const n = log.length;
  let lo = 0, hi = 5;
  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const s = new Set([0, n - 1]);
    rdpCollect(log, mid, 0, n - 1, s);
    if (s.size > maxPts) lo = mid; else hi = mid;
  }
  const s = new Set([0, n - 1]);
  rdpCollect(log, hi, 0, n - 1, s);
  return [...s].sort((a, b) => a - b).map(i => xyPts[i]);
}

function denseIdmt(ip, tms, ct, lo, hi) {
  const start = Math.max(lo, ip * 1.001);
  if (start >= hi || hi <= 0) return [];
  const pts = [];
  for (let i = 0; i < N_DENSE; i++) {
    const x = start * Math.pow(hi / start, i / (N_DENSE - 1));
    const t = iecT(x, ip, tms, ct);
    if (t !== null && t > 0) pts.push({ x, y: t });
  }
  return pts;
}

function relayEffectivePts(relay) {
  const { s1, s2, dt } = relay;
  const ipLim = dt.en ? dt.ip : X_MAX;
  const td    = Math.max(dt.td || 0, 0.02);
  let idmtRaw = [];

  if (s1.en && s2.en) {
    const cross = findCrossAny(s1.ip, s1.tms, s1.ct, s2.ip, s2.tms, s2.ct, ipLim);
    if (cross) {
      const { cx, s1FasterBefore } = cross;
      if (s1FasterBefore) {
        idmtRaw.push(...denseIdmt(s1.ip, s1.tms, s1.ct, s1.ip, cx));
        idmtRaw.push(...denseIdmt(s2.ip, s2.tms, s2.ct, cx, ipLim));
      } else {
        idmtRaw.push(...denseIdmt(s2.ip, s2.tms, s2.ct, s2.ip, cx));
        idmtRaw.push(...denseIdmt(s1.ip, s1.tms, s1.ct, cx, ipLim));
      }
    } else {
      idmtRaw.push(...denseIdmt(s1.ip, s1.tms, s1.ct, s1.ip, ipLim));
      idmtRaw.push(...denseIdmt(s2.ip, s2.tms, s2.ct, s2.ip, ipLim));
    }
  } else if (s1.en) {
    idmtRaw.push(...denseIdmt(s1.ip, s1.tms, s1.ct, s1.ip, ipLim));
  } else if (s2.en) {
    idmtRaw.push(...denseIdmt(s2.ip, s2.tms, s2.ct, s2.ip, ipLim));
  }

  idmtRaw.sort((a, b) => a.x - b.x);
  const dtSlots = dt.en ? 3 : 0;
  const idmtPts = rdpReduce(idmtRaw, MAX_PTS - dtSlots);
  const result  = idmtPts.map(p => ({ x: +p.x.toPrecision(5), y: +p.y.toPrecision(4) }));

  if (dt.en) {
    const t1p = s1.en ? iecT(dt.ip, s1.ip, s1.tms, s1.ct) : null;
    const t2p = s2.en ? iecT(dt.ip, s2.ip, s2.tms, s2.ct) : null;
    const tops = [t1p, t2p].filter(v => v !== null);
    const topY = tops.length ? Math.min(...tops) : td * 2;
    result.push({ x: dt.ip,  y: +topY.toPrecision(4) });
    result.push({ x: dt.ip,  y: td });
    result.push({ x: X_MAX, y: td });
  }

  return result;
}

function cdEffectivePts(points) {
  // Export all user-entered points exactly as entered — no RDP reduction
  return points
    .filter(p => p.i > 0 && p.t >= 0)
    .map(p => ({ x: p.i, y: p.t }));
}

export function exportXLSX() {
  if (!window.XLSX) { alert('SheetJS not loaded.'); return; }
  const XLSX = window.XLSX;

  const projEl  = document.getElementById('projName');
  const bvEl    = document.getElementById('baseV');
  const project = projEl ? projEl.value.trim() : 'TCC Study';
  const baseV   = bvEl   ? bvEl.value.trim()   : '?';

  const relays = getRelays().filter(r => r.en);
  const cds    = getCustomDevices().filter(cd => cd.en && cd.points.length >= 2);
  const fls    = faultLevels.filter(fl => fl.en !== false);

  const sections = [
    ...relays.map(r  => ({ title: r.name,  pts: relayEffectivePts(r) })),
    ...cds.map  (cd => ({ title: cd.name, pts: cdEffectivePts(cd.points) }))
  ];

  const COL_STRIDE = 3;
  const HEADER_ROWS = 4;   // row 0 = project title, row 1 = device name, row 2 = blank, row 3 = col headers
  const maxRows = sections.length ? Math.max(...sections.map(s => s.pts.length)) : 0;
  const totalCols = Math.max(4, sections.length * COL_STRIDE);
  const aoa = [];
  for (let r = 0; r < HEADER_ROWS + maxRows; r++) aoa.push(new Array(totalCols).fill(null));

  // Row 0: project + base voltage info (spans first columns)
  aoa[0][0] = project + '  |  Base: ' + baseV + ' kV';

  sections.forEach((sec, si) => {
    const col = si * COL_STRIDE;
    aoa[1][col]     = sec.title;
    aoa[3][col]     = 'Current (A)';
    aoa[3][col + 1] = 'Time (s)';
    sec.pts.forEach((p, ri) => {
      aoa[HEADER_ROWS + ri][col]     = p.x;
      aoa[HEADER_ROWS + ri][col + 1] = p.y;
    });
  });

  const allDevices = [
    ...relays.map(r => ({
      name: r.name,
      fn: (I) => {
        const v = {
          en1: r.s1.en, en2: r.s2.en, en3: r.dt.en,
          ip1: r.s1.ip, ip2: r.s2.ip, ip3: r.dt.ip,
          tms1: r.s1.tms, tms2: r.s2.tms,
          ct1: r.s1.ct,  ct2: r.s2.ct,  td: r.dt.td
        };
        return operateTime(I, v);
      }
    })),
    ...cds.map(cd => ({ name: cd.name, fn: (I) => cdOperateTime(I, cd.points) }))
  ];

  const flStartRow = HEADER_ROWS + maxRows + 2;
  const flCols = allDevices.length + 2;
  while (aoa.length < flStartRow + 2 + fls.length) aoa.push(new Array(totalCols).fill(null));
  aoa.forEach(row => { while (row.length < flCols) row.push(null); });

  aoa[flStartRow][0] = 'Fault Level Operate Times  (' + project + ')';
  const flHdr = aoa[flStartRow + 1];
  flHdr[0] = 'Fault Level';
  flHdr[1] = 'Current (A)';
  allDevices.forEach((d, i) => { flHdr[2 + i] = d.name + ' (ms)'; });

  fls.forEach((fl, ri) => {
    const row = aoa[flStartRow + 2 + ri];
    row[0] = fl.label || ('FL' + (ri + 1));
    row[1] = fl.a;
    allDevices.forEach((d, i) => {
      const t = d.fn(fl.a);
      row[2 + i] = t !== null ? Math.round(t * 1000) : null;
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [];
  sections.forEach(() => {
    ws['!cols'].push({ wch: 14 }, { wch: 10 }, { wch: 3 });
  });
  ws['!cols'].push({ wch: 16 }, { wch: 14 });
  allDevices.forEach(() => ws['!cols'].push({ wch: 22 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TCC Data');
  XLSX.writeFile(wb, 'TCC_' + project.replace(/[^a-zA-Z0-9_-]/g, '_') + '.xlsx');
}
