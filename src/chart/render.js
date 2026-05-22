import { build }                                     from '../engine/dataset.js';
import { xTicks, yTicks, X_LABEL, Y_LABEL, fmtKA }  from './ticks.js';
import { getRelays, getBaseV, getShowFull, getXUnit } from '../ui/inputs.js';
import { getCustomDevices }                          from '../ui/custom-device.js';
import { faultLevels, thermalCables, thermalTransformers } from '../state.js';

const FL_COLORS = ['#6c3d91','#2e7d32','#00838f','#f57c00','#37474f','#ad1457'];

let myChart = null;

// Zoom state — persists across render() calls (log-scale Amps / seconds)
export const zoomState = { xMin: 10, xMax: 50000, yMin: 0.001, yMax: 1000 };
export function resetZoom() { zoomState.xMin=10; zoomState.xMax=50000; zoomState.yMin=0.001; zoomState.yMax=1000; }

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function txCategory(mva) {
  if (mva <= 0.5) return 'I';
  if (mva <= 5)   return 'II';
  if (mva <= 30)  return 'III';
  return 'IV';
}

export function render() {
  const relays   = getRelays();
  const baseV    = getBaseV();
  const showFull = getShowFull();
  const xUnit    = getXUnit();
  const xLabel   = 'Current (' + xUnit + ') @ ' + baseV + 'kV';
  const lbl      = 'Pickup I (' + baseV + 'kV, A)';

  // Update labels & legend names for relays
  [1, 2].forEach(n => {
    ['s1','s2','dt'].forEach(s => {
      const el = document.getElementById('r' + n + '-' + s + '-lb');
      if (el) el.textContent = lbl;
    });
    const ln = document.getElementById('leg-r' + n + '-name');
    if (ln) ln.textContent = relays[n - 1].name;
  });

  const datasets = [];

  // ── Relay datasets ──────────────────────────────────────────────────────────
  relays.forEach(relay => {
    if (!relay.en) return;
    const { s1, s2, dt } = relay;
    const res  = build(s1.en, s2.en, dt.en, s1.ip, s2.ip, dt.ip, s1.tms, s2.tms, s1.ct, s2.ct, dt.td);
    const col  = relay.color;
    const fade = hexToRgba(col, 0.18);

    if (showFull) {
      if (s1.en) datasets.push({ data: res.s1Full, borderColor: fade, borderWidth: 1.5, borderDash: [6,4], pointRadius: 0, showLine: true, tension: 0 });
      if (s2.en) datasets.push({ data: res.s2Full, borderColor: fade, borderWidth: 1.5, borderDash: [6,4], pointRadius: 0, showLine: true, tension: 0 });
    }
    datasets.push({ data: res.s1Eff, borderColor: col, borderWidth: 2.5, pointRadius: 0, showLine: true, tension: 0 });
    datasets.push({ data: res.s2Eff, borderColor: col, borderWidth: 2.5, pointRadius: 0, showLine: true, tension: 0 });
    datasets.push({ data: res.dtD,   borderColor: col, borderWidth: 3,   pointRadius: 0, showLine: true, tension: 0 });
  });

  // ── Custom device datasets ──────────────────────────────────────────────────
  const cds = getCustomDevices();
  cds.forEach((cd, i) => {
    const legEl  = document.getElementById('leg-cd' + i);
    const nameEl = document.getElementById('leg-cd' + i + '-name');
    const lineEl = legEl ? legEl.querySelector('line') : null;
    if (!cd.en || !cd.points.length) {
      if (legEl) legEl.style.display = 'none';
      return;
    }

    // Plot all points in entry order as a single solid polyline.
    // t=0 rows are replaced with null so Chart.js creates a gap at the
    // log-scale boundary rather than crashing; the polygon perimeter still
    // traces correctly with the remaining points.
    const data = cd.points
      .filter(p => p.i > 0)
      .map(p => (p.t > 0 ? { x: p.i, y: p.t } : null));
    const validCount = data.filter(Boolean).length;
    if (!validCount) { if (legEl) legEl.style.display = 'none'; return; }
    datasets.push({
      data,
      borderColor: cd.color,
      borderWidth: 2.5,
      pointRadius: 0,
      showLine: true,
      spanGaps: false,
      tension: 0
    });

    if (legEl)  { legEl.style.display = ''; }
    if (nameEl) nameEl.textContent = cd.name;
    if (lineEl) lineEl.setAttribute('stroke', cd.color);
  });

  // ── Thermal Damage Curve datasets ─────────────────────────────────────────
  if (window.tdcParentEn !== false) {
  const tdcK    = parseFloat((document.getElementById('tdc-k')    || {}).value) || 143;
  const tdcIMin = (parseFloat((document.getElementById('tdc-imin') || {}).value) || 1)  * 1000;
  const tdcIMax = (parseFloat((document.getElementById('tdc-imax') || {}).value) || 20) * 1000;
  const tdcN    = 120;
  thermalCables.forEach((tc, i) => {
    const enEl   = document.getElementById('tdc' + i + '-en');
    const areaEl = document.getElementById('tdc' + i + '-area');
    const colEl  = document.getElementById('tdc' + i + '-color');
    const nameEl = document.getElementById('tdc' + i + '-name');
    const legEl  = document.getElementById('leg-tdc' + i);
    const legNm  = document.getElementById('leg-tdc' + i + '-name');
    const legLn  = legEl ? legEl.querySelector('line') : null;
    const en     = enEl   ? enEl.checked               : tc.en;
    const area   = areaEl ? (parseFloat(areaEl.value) || tc.area) : tc.area;
    const col    = colEl  ? colEl.value                : tc.color;
    const nm     = nameEl ? nameEl.value               : tc.name;
    if (legEl)  legEl.style.display = en ? '' : 'none';
    if (legNm)  legNm.textContent   = nm;
    if (legLn)  legLn.setAttribute('stroke', col);
    if (!en || area <= 0 || tdcIMin <= 0 || tdcIMax <= tdcIMin) return;
    const pts = [];
    for (let j = 0; j <= tdcN; j++) {
      const I = Math.exp(Math.log(tdcIMin) + (Math.log(tdcIMax) - Math.log(tdcIMin)) * j / tdcN);
      const t = Math.pow(tdcK * area / I, 2);
      if (t > 0 && isFinite(t)) pts.push({ x: I, y: t });
    }
    if (pts.length < 2) return;
    datasets.push({ data: pts, borderColor: col, borderWidth: 2, borderDash: [5, 3],
                    pointRadius: 0, showLine: true, tension: 0 });
  });


  // TX Thermal Damage datasets
  thermalTransformers.forEach((tx, i) => {
    const enEl   = document.getElementById('tx' + i + '-en');
    const mvaEl  = document.getElementById('tx' + i + '-mva');
    const iscEl  = document.getElementById('tx' + i + '-isc');
    const colEl  = document.getElementById('tx' + i + '-color');
    const nameEl = document.getElementById('tx' + i + '-name');
    const legEl  = document.getElementById('leg-tx' + i);
    const legNm  = document.getElementById('leg-tx' + i + '-name');
    const legLn  = legEl ? legEl.querySelector('line') : null;
    const freqEl = document.getElementById('tx' + i + '-freq');
    const en       = enEl   ? enEl.checked                        : tx.en;
    const mva      = mvaEl  ? (parseFloat(mvaEl.value)  || tx.mva) : tx.mva;
    const isc      = iscEl  ? (parseFloat(iscEl.value)  || tx.isc) : tx.isc;
    const col      = colEl  ? colEl.value                         : tx.color;
    const nm       = nameEl ? nameEl.value                        : tx.name;
    const showFreq = freqEl ? freqEl.checked                      : tx.showFreq;
    if (legEl) legEl.style.display = en ? '' : 'none';
    if (legNm) legNm.textContent   = nm;
    if (legLn) legLn.setAttribute('stroke', col);
    if (!en || isc <= 0) return;
    const IscA   = isc * 1000;
    const K1     = IscA * IscA * 5;
    const K2     = IscA * IscA * 2;
    const cat    = txCategory(mva);
    const brkPct = cat === 'II' ? 0.70 : 0.50;
    const IbrkA  = brkPct * IscA;
    const IMinA  = zoomState.xMin;
    const IMaxA  = Math.min(IscA, zoomState.xMax);
    if (IMaxA <= IMinA) return;
    const N = 120;
    const ptsT = [];
    for (let j = 0; j <= N; j++) {
      const I = Math.exp(Math.log(IMinA) + (Math.log(IMaxA) - Math.log(IMinA)) * j / N);
      const t = K1 / (I * I);
      if (t > 0 && isFinite(t)) ptsT.push({ x: I, y: t });
    }
    if (ptsT.length >= 2)
      datasets.push({ data: ptsT, borderColor: col, borderWidth: 2.5,
                      borderDash: [5, 3], pointRadius: 0, showLine: true, tension: 0 });
    if (showFreq && cat !== 'I') {
      const ptsM = [];
      for (let j = 0; j <= N; j++) {
        const I = Math.exp(Math.log(IMinA) + (Math.log(IMaxA) - Math.log(IMinA)) * j / N);
        const t = (I <= IbrkA) ? K1 / (I * I) : K2 / (I * I);
        if (t > 0 && isFinite(t)) ptsM.push({ x: I, y: t });
      }
      if (ptsM.length >= 2)
        datasets.push({ data: ptsM, borderColor: col, borderWidth: 1.5,
                        borderDash: [2, 2], pointRadius: 0, showLine: true, tension: 0 });
    }
  });

  } // end tdcParentEn

  // FL vertical lines drawn in flLabelPlugin (canvas clip keeps them within plot area)

  // Local plugin: draw FL labels at top — stagger labels that are horizontally close
  const flLabelPlugin = {
    id: 'flLabel',
    afterDraw(ch) {
      if (window.flParentEn === false) return;
      const { ctx, scales: { x, y }, chartArea: ca } = ch;
      if (!x || !y || !ca) return;

      // Collect active FL entries within the visible x range
      const entries = [];
      faultLevels.forEach((fl, i) => {
        if (fl.en === false || !fl.a) return;
        if (fl.a < x.min || fl.a > x.max) return;
        const px  = x.getPixelForValue(fl.a);
        const kA  = (fl.a / 1000).toFixed(1);
        const lbl = (fl.label || ('FL' + (i + 1))) + '  ' + kA + ' kA';
        entries.push({ px, lbl, col: FL_COLORS[i % FL_COLORS.length] });
      });

      if (!entries.length) return;

      // ── Draw vertical lines — only when px is strictly inside the plot area ──
      ctx.save();
      ctx.setLineDash([6, 3]);
      ctx.lineWidth = 1.5;
      entries.forEach(({ px, col }) => {
        if (px <= ca.left || px >= ca.right) return;  // skip any line outside plot
        ctx.beginPath();
        ctx.strokeStyle = col;
        ctx.moveTo(px, ca.top);
        ctx.lineTo(px, ca.bottom);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();

      // ── Draw labels above the chart area (no clip needed) ───────────────────
      // Sort by x position and assign stagger levels so overlapping labels stack vertically
      entries.sort((a, b) => a.px - b.px);
      ctx.font = 'bold 10px Arial';
      const levelRight = [];
      entries.forEach(e => {
        const w = ctx.measureText(e.lbl).width;
        let lv = 0;
        while (levelRight[lv] !== undefined && e.px + 5 < levelRight[lv]) lv++;
        e.level = lv;
        levelRight[lv] = e.px + 5 + w + 6;
      });

      ctx.save();
      ctx.textAlign = 'left';
      entries.forEach(({ px, lbl, col, level }) => {
        ctx.fillStyle = col;
        ctx.fillText(lbl, px + 5, ca.top + 14 + level * 14);
      });
      ctx.restore();

      // ── Thermal Damage Curve annotations ────────────────────────────────────
      if (window.tdcParentEn !== false) {
        const tdcK2    = parseFloat((document.getElementById('tdc-k')    || {}).value) || 143;
        const tdcIMin2 = (parseFloat((document.getElementById('tdc-imin') || {}).value) || 1)  * 1000;
        const tdcIMax2 = (parseFloat((document.getElementById('tdc-imax') || {}).value) || 20) * 1000;
        // Label position: 70% along the log I range
        const labelI   = tdcIMax2;  // label at the right (max-current) end of the curve
        thermalCables.forEach((tc, i) => {
          const enEl   = document.getElementById('tdc' + i + '-en');
          const areaEl = document.getElementById('tdc' + i + '-area');
          const colEl  = document.getElementById('tdc' + i + '-color');
          const nameEl = document.getElementById('tdc' + i + '-name');
          const en     = enEl   ? enEl.checked               : tc.en;
          const area   = areaEl ? (parseFloat(areaEl.value) || tc.area) : tc.area;
          const col    = colEl  ? colEl.value                : tc.color;
          const nm     = nameEl ? nameEl.value               : tc.name;
          if (!en || area <= 0) return;
          const t = Math.pow(tdcK2 * area / labelI, 2);
          if (!isFinite(t) || t <= 0) return;
          const lpx = x.getPixelForValue(labelI);
          const lpy = y.getPixelForValue(t);
          if (lpx < ca.left || lpx > ca.right || lpy < ca.top || lpy > ca.bottom) return;
          ctx.save();
          ctx.font      = 'bold 9px Arial';
          ctx.fillStyle = col;
          ctx.textAlign = 'left';
          // draw small background rectangle for readability
          const tw = ctx.measureText(nm).width;
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillRect(lpx - tw - 10, lpy - 10, tw + 6, 13);
          ctx.fillStyle = col;
          ctx.textAlign = 'right';
          ctx.fillText(nm, lpx - 4, lpy);
          ctx.restore();
        });
      }
      // TX annotations
      if (window.tdcParentEn !== false) {
        thermalTransformers.forEach((tx, i) => {
          const enEl   = document.getElementById('tx' + i + '-en');
          const iscEl  = document.getElementById('tx' + i + '-isc');
          const colEl  = document.getElementById('tx' + i + '-color');
          const nameEl = document.getElementById('tx' + i + '-name');
          const en  = enEl   ? enEl.checked                       : tx.en;
          const isc = iscEl  ? (parseFloat(iscEl.value) || tx.isc) : tx.isc;
          const col = colEl  ? colEl.value                        : tx.color;
          const nm  = nameEl ? nameEl.value                       : tx.name;
          if (!en || isc <= 0) return;
          const IscA   = isc * 1000;
          const K1     = IscA * IscA * 5;
          const labelI = Math.min(IscA, x.max);
          if (labelI < x.min) return;
          const t = K1 / (labelI * labelI);
          if (!isFinite(t) || t <= 0) return;
          const lpx = x.getPixelForValue(labelI);
          const lpy = y.getPixelForValue(t);
          if (lpx < ca.left || lpx > ca.right || lpy < ca.top || lpy > ca.bottom) return;
          ctx.save();
          ctx.font = 'bold 9px Arial';
          const tw = ctx.measureText(nm).width;
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillRect(lpx - tw - 10, lpy - 10, tw + 6, 13);
          ctx.fillStyle = col;
          ctx.textAlign = 'right';
          ctx.fillText(nm, lpx - 4, lpy);
          ctx.restore();
        });
      }
    }
  };

  if (myChart) { myChart.destroy(); myChart = null; }
  myChart = new Chart(document.getElementById('tcc'), {
    type: 'scatter',
    plugins: [flLabelPlugin],
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 120 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label(c) {
          const kA = c.raw.x / 1000;
          const disp = xUnit === 'A'
            ? Math.round(c.raw.x) + ' A'
            : (kA < 0.1 ? kA.toFixed(3) : kA < 1 ? kA.toFixed(2) : kA.toFixed(1)) + ' kA';
          return disp + '  →  ' + Math.round(c.raw.y * 1000) + ' ms';
        }}}
      },
      scales: {
        x: {
          type: 'logarithmic', min: zoomState.xMin, max: zoomState.xMax,
          title: { display: true, text: xLabel, color: '#333', font: { size: 12 } },
          afterBuildTicks: ax => { const mn=zoomState.xMin, mx=zoomState.xMax; ax.ticks = xTicks().filter(t => t.value >= mn*0.95 && t.value <= mx*1.05); },
          ticks: { color: '#444', maxRotation: 0, callback(v) {
            let matched = null;
            for (const lv of X_LABEL) { if (Math.abs(v/lv-1)<0.01) { matched=lv; break; } }
            if (!matched) return '';
            return xUnit === 'A' ? (matched >= 1000 ? (matched/1000)+'k' : String(matched)) : fmtKA(matched);
          }},
          grid: { display: false }
        },
        y: {
          type: 'logarithmic', min: zoomState.yMin, max: zoomState.yMax,
          title: { display: true, text: 'Trip time (s)', color: '#333', font: { size: 12 } },
          afterBuildTicks: ax => { const mn=zoomState.yMin, mx=zoomState.yMax; ax.ticks = yTicks().filter(t => t.value >= mn*0.9 && t.value <= mx*1.1); },
          ticks: { color: '#444', autoSkip: false, callback(v) { for (const lv of Y_LABEL) { if (Math.abs(v/lv-1)<0.01) return String(lv); } return ''; } },
          grid: { display: false }
        }
      }
    }
  });
  window._tccChart = myChart;
}
