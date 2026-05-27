// PNG export — title centred at top, chart in middle, 2-col legend at bottom
export function exportPNG() {
  const chartCanvas = document.getElementById('tcc');
  const bv   = (document.getElementById('baseV')   || {}).value || '33';
  const proj = (document.getElementById('projName') || {}).value || 'TCC Protection Coordination Study';

  // Collect legend entries from #chart-legend (same source as PDF export)
  const items = [];
  const leg = document.getElementById('chart-legend');
  if (leg) {
    leg.querySelectorAll('tr').forEach(tr => {
      const lineEl = tr.querySelector('line');
      const nameEl = tr.querySelector('.leg-name');
      const settEl = tr.querySelector('.leg-settings');
      if (lineEl && nameEl) items.push({
        color:    lineEl.getAttribute('stroke') || '#333',
        dash:     lineEl.getAttribute('stroke-dasharray') || '',
        label:    nameEl.textContent.trim(),
        settings: settEl ? settEl.textContent.trim() : ''
      });
    });
  }

  const W       = chartCanvas.width;
  const H       = chartCanvas.height;
  const PAD     = 16;
  const TITLE_H = 36;
  const ROW_H   = 28;
  const half    = Math.ceil(items.length / 2);
  const legRows = items.length ? half : 0;
  const LEG_H   = legRows ? legRows * ROW_H + 14 : 0;

  const out = document.createElement('canvas');
  out.width  = W;
  out.height = TITLE_H + H + LEG_H;
  const ctx  = out.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, out.height);

  // Title centred at top
  ctx.fillStyle = '#1a3a5c';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(proj, W / 2, 22);

  // Divider below title
  ctx.strokeStyle = '#c8d2dc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, TITLE_H - 4);
  ctx.lineTo(W - PAD, TITLE_H - 4);
  ctx.stroke();

  // Chart canvas in middle
  ctx.drawImage(chartCanvas, 0, TITLE_H);

  // Legend at bottom - 2 columns
  if (legRows) {
    const col1 = items.slice(0, half);
    const col2 = items.slice(half);
    const colW = (W - 2 * PAD) / 2;
    const legTop = TITLE_H + H;

    // Divider above legend
    ctx.strokeStyle = '#c8d2dc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, legTop + 4);
    ctx.lineTo(W - PAD, legTop + 4);
    ctx.stroke();

    function drawCol(list, xBase) {
      list.forEach((item, idx) => {
        const iy = legTop + 14 + idx * ROW_H;
        // Colour swatch line
        const dashParts = item.dash
          ? item.dash.split(' ').map(Number).filter(n => !isNaN(n) && n > 0)
          : [];
        ctx.setLineDash(dashParts.length >= 2 ? dashParts : []);
        ctx.strokeStyle = item.color;
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.moveTo(xBase, iy);
        ctx.lineTo(xBase + 28, iy);
        ctx.stroke();
        ctx.setLineDash([]);

        // Name bold 13px
        ctx.textAlign = 'left';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.fillStyle = '#282828';
        ctx.fillText(item.label, xBase + 34, iy + 4);

        // Settings normal 13px — same size as name
        if (item.settings) {
          const nameW = ctx.measureText(item.label + '  ').width;
          ctx.font      = '15px Arial, sans-serif';
          ctx.fillStyle = '#666666';
          ctx.fillText(item.settings, xBase + 34 + nameW, iy + 4);
        }
      });
    }

    drawCol(col1, PAD);
    drawCol(col2, PAD + colW);
  }

  const link    = document.createElement('a');
  link.download = 'TCC_' + bv + 'kV.png';
  link.href     = out.toDataURL('image/png');
  link.click();

  // Silently copy to clipboard in parallel
  out.toBlob(blob => {
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).catch(() => {});
    }
  });
}
