/**
 * sidebar.js — Builds relay and custom-device cards from state arrays.
 * renderRelaySidebar() / renderCustomSidebar() populate the sidebar containers.
 */

import { relays, customDevices } from '../state.js';

const CURVES = ['EI', 'VI', 'SI', 'LTI'];
const CURVE_LABEL = { EI: 'IEC EI', VI: 'IEC VI', SI: 'IEC SI', LTI: 'IEC LTI' };

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function curveOpts(sel) {
  return CURVES.map(v =>
    `<option value="${v}"${v === sel ? ' selected' : ''}>${CURVE_LABEL[v]}</option>`
  ).join('');
}

function buildRelayCard(r, i) {
  const n = i + 1;
  return `
<div class="relay-card">
  <div class="relay-hdr" onclick="toggleRelay(${n})">
    <span class="chevron" id="chv${n}">&#9654;</span>
    <span class="rdot" style="background:${r.color}"></span>
    <input class="rname" type="text" id="r${n}-name" value="${esc(r.name)}"
      onclick="event.stopPropagation()"
      oninput="window._rName(${i},this.value)">
    <input type="checkbox" id="r${n}-en" ${r.en ? 'checked' : ''}
      onclick="event.stopPropagation()"
      onchange="window._rEn(${i},this.checked)">
  </div>
  <div class="relay-body collapsed" id="rb${n}">
    <div class="stg-hdr">
      <span>Stage 1 - IDMT</span>
      <input type="checkbox" id="r${n}-s1-en" ${r.s1.en ? 'checked' : ''}
        onchange="window._stgEn(${i},'s1',this)">
    </div>
    <div class="stg-body${r.s1.en ? '' : ' hidden'}" id="r${n}-s1-body">
      <div class="row">
        <label id="r${n}-s1-lb">Pickup I (A)</label>
        <input type="number" id="r${n}-s1-ip" value="${r.s1.ip}" step="1"
          oninput="window._stg(${i},'s1','ip',+this.value||0)">
      </div>
      <div class="row">
        <label>TMS</label>
        <input type="number" id="r${n}-s1-tms" value="${r.s1.tms}" step="0.05"
          oninput="window._stg(${i},'s1','tms',+this.value||0)">
      </div>
      <div class="row">
        <label>Curve</label>
        <select id="r${n}-s1-ct"
          onchange="window._stg(${i},'s1','ct',this.value)">
          ${curveOpts(r.s1.ct)}
        </select>
      </div>
    </div>
    <div class="stg-hdr">
      <span>Stage 2 - IDMT</span>
      <input type="checkbox" id="r${n}-s2-en" ${r.s2.en ? 'checked' : ''}
        onchange="window._stgEn(${i},'s2',this)">
    </div>
    <div class="stg-body${r.s2.en ? '' : ' hidden'}" id="r${n}-s2-body">
      <div class="row">
        <label id="r${n}-s2-lb">Pickup I (A)</label>
        <input type="number" id="r${n}-s2-ip" value="${r.s2.ip}" step="0.1"
          oninput="window._stg(${i},'s2','ip',+this.value||0)">
      </div>
      <div class="row">
        <label>TMS</label>
        <input type="number" id="r${n}-s2-tms" value="${r.s2.tms}" step="0.05"
          oninput="window._stg(${i},'s2','tms',+this.value||0)">
      </div>
      <div class="row">
        <label>Curve</label>
        <select id="r${n}-s2-ct"
          onchange="window._stg(${i},'s2','ct',this.value)">
          ${curveOpts(r.s2.ct)}
        </select>
      </div>
    </div>
    <div class="stg-hdr">
      <span>Stage 2 - DT</span>
      <input type="checkbox" id="r${n}-dt-en" ${r.dt.en ? 'checked' : ''}
        onchange="window._stgEn(${i},'dt',this)">
    </div>
    <div class="stg-body${r.dt.en ? '' : ' hidden'}" id="r${n}-dt-body">
      <div class="row">
        <label id="r${n}-dt-lb">Pickup I (A)</label>
        <input type="number" id="r${n}-dt-ip" value="${r.dt.ip}" step="1"
          oninput="window._stg(${i},'dt','ip',+this.value||0)">
      </div>
      <div class="row">
        <label>td (s)</label>
        <input type="number" id="r${n}-dt-td" value="${r.dt.td}" step="0.01"
          oninput="window._stg(${i},'dt','td',+this.value||0)">
      </div>
    </div>
  </div>
</div>`;
}

function buildCDCard(cd, i) {
  return `
<div class="relay-card">
  <div class="relay-hdr" onclick="toggleCD(${i})">
    <span class="chevron" id="cdchv${i}">&#9654;</span>
    <span class="rdot" id="cd${i}-dot" style="background:${cd.color}"></span>
    <input class="rname" type="text" id="cd${i}-name" value="${esc(cd.name)}"
      onclick="event.stopPropagation()" oninput="window.render()">
    <input type="checkbox" id="cd${i}-en" ${cd.en ? 'checked' : ''}
      onclick="event.stopPropagation()" onchange="window.render()">
  </div>
  <div class="cd-body collapsed" id="cdb${i}">
    <div class="cd-row" style="padding:6px 0 4px;">
      <label style="font-size:11px;color:#444;flex-shrink:0;">Color</label>
      <input type="color" id="cd${i}-color" value="${cd.color}"
        onchange="window._cdColorChange(${i},this.value)"
        style="width:32px;height:22px;border:1px solid #bbb;border-radius:3px;padding:1px;cursor:pointer;flex-shrink:0;">
      <button class="cd-edit-btn" onclick="window.openCDModal(${i})">&#9998; Edit Points</button>
      <span class="cd-ptcount" id="cd${i}-ptcount">${cd.points.length} pts</span>
    </div>
  </div>
</div>`;
}

export function renderRelaySidebar() {
  const el = document.getElementById('relay-cards');
  if (!el) return;
  el.innerHTML = relays.map((r, i) => buildRelayCard(r, i)).join('');
}

export function renderCustomSidebar() {
  const el = document.getElementById('custom-cards');
  if (!el) return;
  el.innerHTML = customDevices.map((cd, i) => buildCDCard(cd, i)).join('');
}
