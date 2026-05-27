/**
 * export-report.js  Two-page PDF report
 *   Page 1: A4 landscape - title centred at top, TCC chart fills middle, 2-col legend at bottom
 *   Page 2: A4 landscape - Settings, relay boxes, custom device boxes with settings
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

// Read legend entries from the dynamic #chart-legend element (same source as PNG export)
function legendItems() {
  const items = [];
  const leg = document.getElementById('chart-legend');
  if (!leg) return items;
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
  return items;
}

const domVal   = id => { const e = document.getElementById(id); return e ? e.value   : ''; };
const domProj  = ()  => domVal('projName') || 'TCC Protection Coordination Study';
const domBaseV = ()  => domVal('baseV') || '?';
const domChk   = id => { const e = document.getElementById(id); return e ? e.checked : false; };

// ---- Page 1: title centred top, chart middle, legend bottom -----------------
function addChartPage(doc) {
  const PW   = doc.internal.pageSize.getWidth();
  const PH   = doc.internal.pageSize.getHeight();
  const proj = domProj();

  // Title centred at top
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 58, 92);
  doc.text(proj, PW / 2, MAR, { align: 'center' });

  const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(dateStr, PW - MAR, MAR, { align: 'right' });

  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.line(MAR, MAR + 6, PW - MAR, MAR + 6);

  const chartTop = MAR + 10;

  // Pre-calculate legend height — each row: name line + settings line = ROW_H
  const items   = legendItems();
  const ROW_H   = 10.5;   // enough for 9.5pt name + 9.5pt settings on separate lines
  const half    = Math.ceil(items.length / 2);
  const legRows = items.length ? half : 0;
  const LEG_H   = legRows ? legRows * ROW_H + 9 : 0;

  // Chart fills space between title area and legend area
  const chartBottom = PH - MAR - LEG_H;
  const chartH      = chartBottom - chartTop;

  const canvas  = document.getElementById('tcc');
  const imgData = canvas.toDataURL('image/jpeg', 0.82);
  doc.addImage(imgData, 'JPEG', MAR, chartTop, PW - 2 * MAR, chartH);

  // Legend at bottom
  if (items.length) {
    const legY = chartBottom + 4;
    const colW = (PW - 2 * MAR) / 2;
    const col1 = items.slice(0, half);
    const col2 = items.slice(half);

    // Thin divider above legend
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(MAR, legY - 2, PW - MAR, legY - 2);

    function drawLegCol(list, xBase) {
      list.forEach((item, idx) => {
        const iy = legY + idx * ROW_H + 3;   // +3 = top padding within row
        const [r, g, b] = hexToRgb(item.color);
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(1.4);
        doc.line(xBase, iy, xBase + 14, iy);

        // Name — bold 9.5pt
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text(item.label, xBase + 17, iy + 1);

        // Settings on second line — normal 9.5pt (same size, lighter colour)
        if (item.settings) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(90, 90, 90);
          doc.text(item.settings, xBase + 17, iy + 5.5);
        }
      });
    }

    drawLegCol(col1, MAR);
    drawLegCol(col2, MAR + colW);
  }
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
  doc.setDrawColor(cr, cg, cb); doc.setLineWidth(0.5);
  doc.rect(bx, by, bw, bh);
  doc.setFillColor(cr, cg, cb);
  doc.rect(bx, by, bw, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
  doc.text(relay.name, bx + 3, by + 5.5);
  doc.setFontSize(8);
  doc.text(relay.en ? 'ENABLED' : 'DISABLED', bx + bw - 3, by + 5.5, { align: 'right' });
  let y = by + 11;
  const ind = bx + 4;
  y = drawStageBlock(doc, relay.s1.en, 'Stage 1 - IDMT', ind, y);
  if (relay.s1.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.s1.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('TMS: ' + relay.s1.tms, ind + 3, y); y += 4;
    doc.text('Curve: ' + (CURVE_NAMES[relay.s1.ct] || relay.s1.ct), ind + 3, y); y += 5;
  }
  y = drawStageBlock(doc, relay.s2.en, 'Stage 2 - IDMT', ind, y);
  if (relay.s2.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.s2.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('TMS: ' + relay.s2.tms, ind + 3, y); y += 4;
    doc.text('Curve: ' + (CURVE_NAMES[relay.s2.ct] || relay.s2.ct), ind + 3, y); y += 5;
  }
  y = drawStageBlock(doc, relay.dt.en, 'Stage 2 - DT', ind, y);
  if (relay.dt.en) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60); doc.setFontSize(8.5);
    doc.text('Pickup: ' + relay.dt.ip + ' A  (@ ' + bv + ' kV)', ind + 3, y); y += 4;
    doc.text('td: ' + relay.dt.td + ' s', ind + 3, y);
  }
}

function drawCDBox(doc, cd, bx, by, bw) {
  const [cr, cg, cb] = hexToRgb(cd.color || '#888888');

  // Pre-compute wrapped settings lines for dynamic box height
  const settRaw = cd.settings && cd.settings.trim() ? cd.settings.trim() : '';
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5);
  const settLines = settRaw ? doc.splitTextToSize(settRaw, bw - 8) : [];
  const LINE_H    = 4.5;
  const bh        = 19 + settLines.length * LINE_H + 3;
  // 19 = 7 (header bar) + 12 (space to pt-count line at by+13 plus gap)
  // settLines * 4.5 mm each + 3 mm bottom padding

  doc.setDrawColor(cr, cg, cb); doc.setLineWidth(0.5);
  doc.rect(bx, by, bw, bh);
  doc.setFillColor(cr, cg, cb);
  doc.rect(bx, by, bw, 7, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(cd.name, bx + 3, by + 5);
  doc.setFontSize(8);
  const typeStr = cd.deviceType ? cd.deviceType + '  |  ' : '';
  doc.text(typeStr + (cd.en ? 'ENABLED' : 'DISABLED'), bx + bw - 3, by + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60);
  doc.text('Custom scatter curve — ' + cd.points.length + ' data point' + (cd.points.length !== 1 ? 's' : ''), bx + 4, by + 13);

  if (settLines.length > 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(50, 50, 50);
    doc.text(settLines, bx + 4, by + 19, { lineHeightFactor: 1.5 });
  }
  return bh;
}

function addSettingsPage(doc) {
  doc.addPage([297, 210], 'landscape');
  const PW   = 297;
  const bv   = domBaseV();
  const proj = domProj();
  let y = MAR;

  // Title centred
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 58, 92);
  doc.text(proj + ' — Protection Settings', PW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
  doc.text('Base: ' + bv + ' kV', PW - MAR, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(180, 195, 210); doc.setLineWidth(0.4);
  doc.line(MAR, y, PW - MAR, y);
  y += 5;

  const colW  = (PW - 2 * MAR - 6) / 2;
  const col1X = MAR;
  const col2X = MAR + colW + 6;
  const relays = getRelays();
  if (relays[0]) drawRelayBox(doc, relays[0], col1X, y, colW, bv);
  if (relays[1]) drawRelayBox(doc, relays[1], col2X, y, colW, bv);
  y += Math.max(relayBoxH(relays[0]), relays[1] ? relayBoxH(relays[1]) : 0) + 5;

  // Custom devices
  const cds = customDevices.map((cd, i) => ({
    name:       domVal('cd' + i + '-name') || cd.name,
    en:         domChk('cd' + i + '-en'),
    color:      domVal('cd' + i + '-color') || cd.color,
    points:     cd.points,
    settings:   cd.settings   || '',
    deviceType: cd.deviceType || ''
  })).filter(cd => cd.en || cd.points.length > 0);

  if (cds.length) {
    for (let ci = 0; ci < cds.length; ci += 2) {
      const h1 = drawCDBox(doc, cds[ci],           col1X, y, colW);
      const h2 = cds[ci + 1] ? drawCDBox(doc, cds[ci + 1], col2X, y, colW) : 0;
      y += Math.max(h1, h2) + 5;
    }
  }

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
  doc.save('TCC_' + domProj().replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf');
}
