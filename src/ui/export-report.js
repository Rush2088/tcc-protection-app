/**
 * export-report.js  —  Two-page PDF report
 *   Page 1 : A4 landscape  — TCC chart + title + legend + base voltage
 *   Page 2 : A4 portrait   — All protection settings (Disabled shown for unchecked stages)
 */

import { faultLevels, customDevices } from '../state.js';
import { getRelays }                  from './inputs.js';

const MAR = 14;   // page margin mm
const CURVE_NAMES = { EI: 'IEC EI', VI: 'IEC VI', SI: 'IEC SI', LTI: 'IEC LTI' };

// ─── helpers ─────────────────────────────────────────────────────────────────
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

function domVal(id)   { const e = document.getElementById(id); return e ? e.value   : ''; }
function domChk(id)   { const e = document.getElementById(id); return e ? e.checked : false; }

// ─── Page 1: A4 Landscape — Chart ────────────────────────────────────────────
function addChartPage(doc) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const bv = domVal('baseV') || '?';

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 58, 92);
  doc.text('TCC Protection Coordination Study', MAR, MAR);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Base Voltage: ' + bv + ' kV', MAR, MAR + 6);

  const dateStr = new Date().toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
  doc.text(dateStr, PW - MAR, MAR, { align: 'right' });

  // Separator line
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.4);
  doc.line(MAR, MAR + 9, PW - MAR, MAR + 9);

  // ── Legend ──
  const items = legendItems();
  let legY = MAR + 14;
  if (items.length) {
    doc.setFontSize(8.5);
    let lx = MAR;
    items.forEach(item => {
      const [r,g,b] = hexToRgb(item.color);
      doc.setDrawColor(r,g,b);
      doc.setLineWidth(1.2);
      doc.line(lx, legY, lx + 12, legY);
      doc.setTextColor(40, 40, 40);
      doc.text(item.label, lx + 15, legY + 1);
      lx += 15 + doc.getTextWidth(item.label) + 8;
    });
    legY += 7;
  }

  // ── Chart image ──
  const canvas  = document.getElementById('tcc');
  const imgData = canvas.toDataURL('image/png');
  const imgTop  = legY + 1;
  const imgW    = PW - 2 * MAR;
  const imgH    = PH - imgTop - MAR;
  doc.addImage(imgData, 'PNG', MAR, imgTop, imgW, imgH);
}

// ─── Page 2: A4 Portrait — Settings ──────────────────────────────────────────
function addSettingsPage(doc) {
  doc.addPage([210, 297], 'portrait');
  const PW = doc.internal.pageSize.getWidth();   // 210
  let y = MAR;

  const bv = parseFloat(domVal('baseV')) || 0.4;

  // Page title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 58, 92);
  doc.text('Protection Settings', MAR, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  doc.text('Base Voltage: ' + bv + ' kV', PW - MAR, y, { align: 'right' });
  y += 5;
  doc.setDrawColor(180, 195, 210); doc.setLineWidth(0.4);
  doc.line(MAR, y, PW - MAR, y);
  y += 6;

  // ── Relays ──
  const relays = getRelays();
  relays.forEach(relay => {
    if (y > 272) { doc.addPage([210,297],'portrait'); y = MAR; }

    // Relay name row
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(20, 20, 20);
    doc.text(relay.name, MAR, y);
    doc.setFontSize(8.5);
    if (relay.en) {
      doc.setTextColor(27, 150, 90);  doc.text('● Enabled',  PW - MAR, y, { align: 'right' });
    } else {
      doc.setTextColor(170, 50, 50);  doc.text('○ Disabled', PW - MAR, y, { align: 'right' });
    }
    y += 5;

    const ind = MAR + 5;

    // Stage 1 IDMT
    if (relay.s1.en) {
      doc.setFont('helvetica','bold');   doc.setTextColor(50,50,50);   doc.setFontSize(9);
      doc.text('Stage 1 – IDMT', ind, y); y += 4.5;
      doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70);   doc.setFontSize(8.5);
      doc.text('Pickup I: ' + relay.s1.ip + ' A   (@ ' + bv + ' kV)', ind+4, y); y += 4;
      doc.text('TMS: ' + relay.s1.tms, ind+4, y); y += 4;
      doc.text('Curve: ' + (CURVE_NAMES[relay.s1.ct] || relay.s1.ct), ind+4, y); y += 5;
    } else {
      doc.setFont('helvetica','italic'); doc.setTextColor(170,170,170); doc.setFontSize(8.5);
      doc.text('Stage 1 – IDMT: Disabled', ind, y); y += 6;
    }

    // Stage 2 IDMT
    if (relay.s2.en) {
      doc.setFont('helvetica','bold');   doc.setTextColor(50,50,50);   doc.setFontSize(9);
      doc.text('Stage 2 – IDMT', ind, y); y += 4.5;
      doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70);   doc.setFontSize(8.5);
      doc.text('Pickup I: ' + relay.s2.ip + ' A   (@ ' + bv + ' kV)', ind+4, y); y += 4;
      doc.text('TMS: ' + relay.s2.tms, ind+4, y); y += 4;
      doc.text('Curve: ' + (CURVE_NAMES[relay.s2.ct] || relay.s2.ct), ind+4, y); y += 5;
    } else {
      doc.setFont('helvetica','italic'); doc.setTextColor(170,170,170); doc.setFontSize(8.5);
      doc.text('Stage 2 – IDMT: Disabled', ind, y); y += 6;
    }

    // Stage 2 DT
    if (relay.dt.en) {
      doc.setFont('helvetica','bold');   doc.setTextColor(50,50,50);   doc.setFontSize(9);
      doc.text('Stage 2 – DT', ind, y); y += 4.5;
      doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70);   doc.setFontSize(8.5);
      doc.text('Pickup I: ' + relay.dt.ip + ' A   (@ ' + bv + ' kV)', ind+4, y); y += 4;
      doc.text('td: ' + relay.dt.td + ' s', ind+4, y); y += 5;
    } else {
      doc.setFont('helvetica','italic'); doc.setTextColor(170,170,170); doc.setFontSize(8.5);
      doc.text('Stage 2 – DT: Disabled', ind, y); y += 6;
    }

    doc.setDrawColor(220,225,230); doc.setLineWidth(0.2);
    doc.line(MAR, y, PW - MAR, y);
    y += 5;
  });

  // ── Custom Devices ──
  customDevices.forEach((cd, i) => {
    const name  = domVal('cd' + i + '-name') || cd.name;
    const en    = domChk('cd' + i + '-en');
    const nPts  = cd.points.length;
    if (!en && nPts === 0) return;   // skip completely empty disabled devices
    if (y > 272) { doc.addPage([210,297],'portrait'); y = MAR; }

    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(20,20,20);
    doc.text(name, MAR, y);
    doc.setFontSize(8.5);
    if (en) { doc.setTextColor(27,150,90);  doc.text('● Enabled',  PW-MAR, y, {align:'right'}); }
    else    { doc.setTextColor(170,50,50);  doc.text('○ Disabled', PW-MAR, y, {align:'right'}); }
    y += 5;
    doc.setFont('helvetica','normal'); doc.setTextColor(70,70,70); doc.setFontSize(8.5);
    doc.text('Custom scatter curve — ' + nPts + ' data point' + (nPts !== 1 ? 's' : ''), MAR+5, y);
    y += 5;
    doc.setDrawColor(220,225,230); doc.setLineWidth(0.2);
    doc.line(MAR, y, PW-MAR, y);
    y += 5;
  });

  // ── Fault Levels ──
  if (faultLevels.length) {
    if (y > 265) { doc.addPage([210,297],'portrait'); y = MAR; }
    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(26,58,92);
    doc.text('Fault Levels', MAR, y);
    y += 6;
    faultLevels.forEach(fl => {
      doc.setFontSize(8.5); doc.setFont('helvetica','normal');
      if (fl.en !== false) { doc.setTextColor(60,60,60);     doc.text('●  ', MAR+5, y); }
      else                 { doc.setTextColor(170,170,170);  doc.text('○  ', MAR+5, y); }
      doc.setTextColor(60,60,60);
      doc.text(fl.label + ':  ' + fl.a.toLocaleString() + ' A', MAR+11, y);
      y += 5;
    });
  }
}

// ─── Public export ───

export function exportReport() {
  const JsPDF = getJsPDF();
  const doc   = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  addChartPage(doc);
  addSettingsPage(doc);
  const bv = domVal('baseV') || '33';
  doc.save('TCC_Report_' + bv + 'kV.pdf');
}
