import { build }                                     from '../engine/dataset.js';
import { xTicks, yTicks, X_LABEL, Y_LABEL, fmtKA }  from './ticks.js';
import { getRelays, getBaseV, getShowFull, getXUnit } from '../ui/inputs.js';
import { getCustomDevices, splitBand }               from '../ui/custom-device.js';

let myChart = null;

// Zoom state — persists across render() calls (log-scale Amps / seconds)
export const zoomState = { xMin: 10, xMax: 50000, yMin: 0.01, yMax: 100 };
export function resetZoom() { zoomState.xMin=10; zoomState.xMax=50000; zoomState.yMin=0.01; zoomState.yMax=100; }

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

    const band = splitBand(cd.points);

    if (band.isBand) {
      // Band data (MCB / fuse polygon): plot lower bound lighter + upper bound solid
      const loData = band.lower.map(p => ({ x: p.i, y: p.t }));
      const hiData = band.upper.map(p => ({ x: p.i, y: p.t }));
      if (!loData.length && !hiData.length) { if (legEl) legEl.style.display = 'none'; return; }
      // Lower bound — faded, thinner
      if (loData.length) datasets.push({
        data: loData,
        borderColor: hexToRgba(cd.color, 0.45),
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        showLine: true,
        tension: 0
      });
      // Upper bound — full weight
      if (hiData.length) datasets.push({
        data: hiData,
        borderColor: cd.color,
        borderWidth: 2.5,
        borderDash: [8, 4],
        pointRadius: 0,
        showLine: true,
        tension: 0
      });
    } else {
      // Single monotonic curve
      const data = band.curve.map(p => ({ x: p.i, y: p.t }));
      if (!data.length) { if (legEl) legEl.style.display = 'none'; return; }
      datasets.push({
        data,
        borderColor: cd.color,
        borderWidth: 2.5,
        borderDash: [8, 4],
        pointRadius: 3,
        pointBackgroundColor: cd.color,
        showLine: true,
        tension: 0
      });
    }

    if (legEl)  { legEl.style.display = ''; }
    if (nameEl) nameEl.textContent = cd.name;
    if (lineEl) lineEl.setAttribute('stroke', cd.color);
  });

  if (myChart) { myChart.destroy(); myChart = null; }
  myChart = new Chart(document.getElementById('tcc'), {
    type: 'scatter',
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
            if (!X_LABEL.has(v)) return '';
            return xUnit === 'A' ? (v >= 1000 ? (v/1000)+'k' : String(v)) : fmtKA(v);
          }},
          grid: { display: false }
        },
        y: {
          type: 'logarithmic', min: zoomState.yMin, max: zoomState.yMax,
          title: { display: true, text: 'Trip time (s)', color: '#333', font: { size: 12 } },
          afterBuildTicks: ax => { const mn=zoomState.yMin, mx=zoomState.yMax; ax.ticks = yTicks().filter(t => t.value >= mn*0.9 && t.value <= mx*1.1); },
          ticks: { color: '#444', callback(v) { const r = +v.toPrecision(4); return Y_LABEL.has(r) ? String(r) : ''; } },
          grid: { display: false }
        }
      }
    }
  });
  window._tccChart = myChart;
}
