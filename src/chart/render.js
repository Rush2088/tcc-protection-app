import { build }                                     from '../engine/dataset.js';
import { xTicks, yTicks, X_LABEL, Y_LABEL, fmtKA }  from './ticks.js';
import { getRelays, getBaseV, getShowFull, getXUnit } from '../ui/inputs.js';
import { getCustomDevices }                          from '../ui/custom-device.js';
import { faultLevels }                               from '../state.js';

const FL_COLORS = ['#6c3d91','#2e7d32','#00838f','#f57c00','#37474f','#ad1457'];

let myChart = null;

// Zoom state — persists across render() calls (log-scale Amps / seconds)
export const zoomState = { xMin: 10, xMax: 50000, yMin: 0.001, yMax: 1000 };
export function resetZoom() { zoomState.xMin=10; zoomState.xMax=50000; zoomState.yMin=0.001; zoomState.yMax=1000; }

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
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

  // ── Fault level vertical lines (as datasets — avoids plugin module-instance issues) ──
  if (window.flParentEn !== false) {
    faultLevels.forEach((fl, idx) => {
      if (fl.en === false || !fl.a) return;
      const col = FL_COLORS[idx % FL_COLORS.length];
      datasets.push({
        data: [{ x: fl.a, y: zoomState.yMin * 0.5 }, { x: fl.a, y: zoomState.yMax * 2 }],
        borderColor: col, borderWidth: 1.5, borderDash: [6, 3],
        pointRadius: 0, showLine: true, tension: 0
      });
    });
  }

  // Local plugin: draw FL labels at top — stagger labels that are horizontally close
  const flLabelPlugin = {
    id: 'flLabel',
    afterDraw(ch) {
      if (window.flParentEn === false) return;
      const { ctx, scales: { x, y } } = ch;
      if (!x || !y) return;

      // Collect active FL entries with pixel position
      const entries = [];
      faultLevels.forEach((fl, i) => {
        if (fl.en === false || !fl.a) return;
        if (fl.a < x.min * 0.99 || fl.a > x.max * 1.01) return;
        const px  = x.getPixelForValue(fl.a);
        const kA  = (fl.a / 1000).toFixed(fl.a < 100 ? 2 : fl.a < 1000 ? 1 : 0);
        const lbl = (fl.label || ('FL' + (i + 1))) + '  ' + kA + ' kA';
        entries.push({ px, lbl, col: FL_COLORS[i % FL_COLORS.length] });
      });

      if (!entries.length) return;

      // Sort by x position and assign stagger levels so overlapping labels stack vertically
      entries.sort((a, b) => a.px - b.px);
      ctx.font = 'bold 10px Arial';
      const levelRight = [];  // rightmost x+width used per level
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
        ctx.fillText(lbl, px + 5, y.top + 14 + level * 14);
      });
      ctx.restore();
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
