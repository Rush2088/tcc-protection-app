// PNG export — includes base voltage in filename
export function exportPNG() {
  const canvas = document.getElementById('tcc');
  const bv     = document.getElementById('baseV').value || '33';
  const link   = document.createElement('a');
  link.download = 'TCC_' + bv + 'kV.png';
  link.href     = canvas.toDataURL('image/png');
  link.click();
}
