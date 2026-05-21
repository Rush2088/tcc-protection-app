// PNG export — composites legend bar above chart canvas
export function exportPNG() {
  const chartCanvas = document.getElementById('tcc');
  const bv          = document.getElementById('baseV').value || '33';

  // Collect visible legend entries from the HTML legend bar
  const items = [];
  document.querySelectorAll('.leg-item').forEach(el => {
    if (el.style.display === 'none') return;
    const line = el.querySelector('line');
    const span = el.querySelector('span');
    if (!line || !span) return;
    items.push({ color: line.getAttribute('stroke'), label: span.textContent.trim() });
  });

  const W       = chartCanvas.width;
  const H       = chartCanvas.height;
  const PAD     = 16;
  const LEG_H   = items.length ? 38 : 0;

  const out = document.createElement('canvas');
  out.width  = W;
  out.height = H + LEG_H;
  const ctx = out.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, out.height);

  // Legend bar
  if (LEG_H) {
    ctx.font = '13px Arial, sans-serif';
    let x = PAD;
    const midY = LEG_H / 2;
    items.forEach(item => {
      // Coloured line swatch
      ctx.strokeStyle = item.color;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, midY);
      ctx.lineTo(x + 22, midY);
      ctx.stroke();
      x += 28;
      // Label text
      ctx.fillStyle = '#333333';
      ctx.fillText(item.label, x, midY + 4);
      x += ctx.measureText(item.label).width + 18;
    });
  }

  // Chart canvas below legend
  ctx.drawImage(chartCanvas, 0, LEG_H);

  const link     = document.createElement('a');
  link.download  = 'TCC_' + bv + 'kV.png';
  link.href      = out.toDataURL('image/png');
  link.click();
}
