// Chart.js plugin registrations: white background, log-log grid, fault level lines
// IMPORTANT: wb must be registered before mg so beforeDraw order is correct.
import { faultLevels } from '../state.js';

export const FL_COLORS = ['#6c3d91', '#2e7d32', '#00838f', '#f57c00', '#37474f', '#ad1457'];

// ── wb: white canvas background ────────────────────────────────────────────────
Chart.register({
  id: 'wb',
  beforeDraw(c) {
    const { ctx, width: w, height: h } = c;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
});

// ── mg: full log-log grid (1–9 per decade, three opacity tiers) ────────────────
Chart.register({
  id: 'mg',
  beforeDraw(ch) {
    const { ctx, scales: { x, y } } = ch;
    if (!x || !y) return;
    ctx.save();

    function gridLine(px, py, isX, m) {
      const isMaj  = (m === 1);
      const isSemi = (m === 2 || m === 5);
      ctx.strokeStyle = isMaj  ? 'rgba(0,0,0,0.20)'
                      : isSemi ? 'rgba(0,0,0,0.15)'
                               : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = isMaj ? 1.0 : 0.5;
      ctx.beginPath();
      if (isX) { ctx.moveTo(px, y.top);  ctx.lineTo(px, y.bottom); }
      else      { ctx.moveTo(x.left, py); ctx.lineTo(x.right, py);  }
      ctx.stroke();
    }

    for (let d = 1; d <= 100000; d *= 10)
      for (let m = 1; m <= 9; m++) { const v = m * d; if (v >= x.min && v <= x.max) gridLine(x.getPixelForValue(v), 0, true, m); }

    for (let d = 0.001; d <= 1000; d *= 10)
      for (let m = 1; m <= 9; m++) { const v = m * d; if (v >= y.min && v <= y.max) gridLine(0, y.getPixelForValue(v), false, m); }

    ctx.restore();
  }
});

