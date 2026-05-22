/**
 * export-report.js  Two-page PDF report
 *   Page 1: A4 landscape - TCC chart + title + legend + base voltage
 *   Page 2: A4 landscape - Settings, relay boxes side-by-side, fault levels
 *
 * Fixes: JPEG chart (small file), no Unicode bullets (broke font rendering),
 *        side-by-side relay boxes, custom relay names, base voltage shown.
 */

import { faultLevels, customDevices } from '../state.js';
import { getRelays }                  from './inputs.js';

const MAR = 12;
const CURVE_NAMES = { EI: 'IEC EI', VI: 'IEC VI', SI: 'IEC SI', LTI: 'IEC LTI' };

function getJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (window.jsPDF) return window.jsPDF;
  throw new Error('jsPDF library not loaded');
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function legendItems() {
  const items = [];
  document.querySelectorAll('.leg-item').forEach(el => {
    if (el.style.display === 'none') return;
    const line = el.querySelector('line');
    const span = el.querySelector('span');
    if (line && span) items.push({ color: line.getAttribute('stroke'), label: span.textContent.trim() });
  });
  return items;
}

const domVal   = id => { const e = document.getElementById(id); return e ? e.value   : ''; };
const domProj  = ()  => domVal('projName') || 'TCC Protection Coordination Study';
const domBaseV = ()  => domVal('baseV') || '?';
const domChk = id => { const e = document.getElementById(id); return e ? e.checked : false; };

// ---- Page 1: Landscape - TCC Chart ------------------------------------------
function addChartPage(doc) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const proj = domProj();
  const bv   = domBaseV();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 58, 92);
  doc.text(proj, MAR, MAR);

  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Base: ' + bv + ' kV', MAR, MAR + 6);
  doc.text(dateStr, PW - MAR, MAR, { align: 'right' });

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.line(MAR, MAR + 9, PW - MAR, MAR + 9);

  // Legend
  const items = legendItems();
  let legY = MAR + 14;
  if (items.length) {
    doc.setFontSize(8.5);
    let lx = MAR;
    items.forEach(item => {
      const [r, g, b] = hexToRgb(item.color);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(1.2);
      doc.line(lx, legY, lx + 12, legY);
      doc.setTextColor(40, 40, 40);
      doc.text(item.label, lx + 15, legY + 1);
      lx += 15 + doc.getTextWidth(item.label) + 8;
    });
    legY += 7;
  }

  // Chart as JPEG - keeps file well under 1 MB
  const canvas  = document.getElementById('tcc');
  const imgData = canvas.toDataURL('image/jpeg', 0.82);
  doc.addImage(imgData, 'JPEG', MAR, legY + 1, PW - 2*MAR, PH - legY - 1 - MAR);
}

// ---- Page 2: Landscape - Settings -------------------------------------------

function stageH(en, nLines) { return en ? 4 + nLines * 4 + 2 : 6; }
function relayBoxH(relay) {
  return 10 + stageH(relay.s1.en, 3) + stageH(relay.s2.en, 3) + stageH(relay.dt.en, 2) + 2;
}

function drawStageBlock(doc, en, title, x, y) {
  doc.setFontSize(8.5);
  if (en) {
    doc.setFont('helvetica', 'bold');   doc.setTextColor(40, 40, 40);
    doc.text(title, x, y); y += 4;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setTextColor(155, 155, 155);
    doc.text(title + ': Disabled', x, y); y += 6;
  }
  return y;
}

function drawRelayBox(doc, relay, bx, by, bw, bv) {
  const [cr, cg, cb] = hexToRgb(relay.color);
  const bh = relayBoxH(relay);

  doc.setDrawColor(cr, cg, cb);
  doc.setLineWidth(0.5);
  doc.rect(bx, by, bw, bh);

  doc.setFillColor(cr, cg, cb);
  doc.rect(bx, by, bw, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(relay.name, bx + 3, by + 5.5);
  doc.setFontSize(8);
  doc.text(relay.en ? 'ENABLED' : 'DISABLED', bx + bw - 3, by + 5.5, { align: 'right' });

  let y = by + 11;
  const ind = bx + 4;

  // Stage 1 IDMT
  y = drawStageBlock(doc, relay.s1.en, 'Stage 1 - IDMT', ind, y);
  if (relay.s1.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.s1.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('TMS: ' + relay.s1.tms, ind + 3, y); y += 4;
    doc.text('Curve: ' + (CURVE_NAMES[relay.s1.ct] || relay.s1.ct), ind + 3, y); y += 5;
  }

  // Stage 2 IDMT
  y = drawStageBlock(doc, relay.s2.en, 'Stage 2 - IDMT', ind, y);
  if (relay.s2.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.s2.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('TMS: ' + relay.s2.tms, ind + 3, y); y += 4;
    doc.text('Curve: ' + (CURVE_NAMES[relay.s2.ct] || relay.s2.ct), ind + 3, y); y += 5;
  }

  // Stage 2 DT
  y = drawStageBlock(doc, relay.dt.en, 'Stage 2 - DT', ind, y);
  if (relay.dt.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.dt.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('td: ' + relay.dt.td + ' s', ind + 3, y);
  }
}

function drawCDBox(doc, cd, bx, by, bw) {
  const [cr, cg, cb] = hexToRgb(cd.color || '#888888');
  const bh = 28;
  doc.setDrawColor(cr, cg, cb); doc.setLineWidth(0.5);
  doc.rect(bx, by, bw, bh);
  doc.setFillColor(cr, cg, cb);
  doc.rect(bx, by, bw, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(cd.name, bx + 3, by + 5);
  doc.setFontSize(8);
  doc.text(cd.en ? 'ENABLED' : 'DISABLED', bx + bw - 3, by + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
  doc.text('Custom scatter curve - ' + cd.points.length + ' data point' + (cd.points.length !== 1 ? 's' : ''), bx + 4, by + 13);
  return bh;
}

function addSettingsPage(doc) {
  doc.addPage([297, 210], 'landscape');
  const PW = 297;
  const bv   = domBaseV();
  const proj = domProj();
  let y = MAR;

  // Page header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 58, 92);
  doc.text(proj + ' — Protection Settings', MAR, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Base: ' + bv + ' kV', PW - MAR, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(180, 195, 210); doc.setLineWidth(0.4);
  doc.line(MAR, y, PW - MAR, y);
  y += 5;

  // Side-by-side relay boxes
  const colW = (PW - 2 * MAR - 6) / 2;
  const col1X = MAR;
  const col2X = MAR + colW + 6;
  const relays = getRelays();

  if (relays[0]) drawRelayBox(doc, relays[0], col1X, y, colW, bv);
  if (relays[1]) drawRelayBox(doc, relays[1], col2X, y, colW, bv);
  y += Math.max(relayBoxH(relays[0]), relays[1] ? relayBoxH(relays[1]) : 0) + 5;

  // Custom devices (only if enabled or have points)
  const cds = customDevices.map((cd, i) => ({
    name:   domVal('cd' + i + '-name') || cd.name,
    en:     domChk('cd' + i + '-en'),
    color:  domVal('cd' + i + '-color') || cd.color,
    points: cd.points
  })).filter(cd => cd.en || cd.points.length > 0);

  if (cds.length) {
    drawCDBox(doc, cds[0], col1X, y, colW);
    if (cds[1]) drawCDBox(doc, cds[1], col2X, y, colW);
    y += 33;
  }

  // Fault Levels table
  if (faultLevels.length) {
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 58, 92);
    doc.text('Fault Levels', MAR, y); y += 5;
    const colFW = (PW - 2 * MAR) / Math.min(faultLevels.length, 5);
    faultLevels.forEach((fl, i) => {
      if (i > 0 && i % 5 === 0) y += 6;
      const fx     = MAR + (i % 5) * colFW;
      const active = fl.en !== false;
      doc.setFont('helvetica', active ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(active ? 40 : 150, active ? 40 : 150, active ? 40 : 150);
      doc.text(fl.label + ': ' + fl.a.toLocaleString() + ' A', fx, y);
    });
  }
}

// ---- Public -----------------------------------------------------------------
export function exportReport() {
  const JsPDF = getJsPDF();
  const doc   = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addChartPage(doc);
  addSettingsPage(doc);
  doc.save('TCC_' + domProj().replace(/[^a-zA-Z0-9_-]/g,'_') + '.pdf');
}
