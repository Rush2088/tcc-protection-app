// sidebar.js - Builds relay and custom-device cards from state arrays.
import { relays, customDevices } from '../state.js';

const CURVES = ['EI','VI','SI','LTI'];
const CT_LBL = {EI:'IEC EI',VI:'IEC VI',SI:'IEC SI',LTI:'IEC LTI'};

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function curveOpts(sel) {
  return CURVES.map(v => `<option value="${v}"${v===sel?' selected':''}>${CT_LBL[v]}</option>`).join('');
}

function buildStage(label, n, stg, en, cfg) {
  const i = n - 1;
  const vis = en ? '' : ' hidden';
  const chk = en ? ' checked' : '';
  if (stg === 'dt') {
    return `
    <div class="stg-hdr"><span>Stage 2 - DT</span>
      <input type="checkbox" id="r${n}-dt-en"${chk}
        onchange="window._stgEn(${i},'dt',this)"></div>
    <div class="stg-body${vis}" id="r${n}-dt-body">
      <div class="row"><label id="r${n}-dt-lb">Pickup I (A)</label>
        <input type="number" id="r${n}-dt-ip" value="${cfg.ip}" step="1"
          oninput="window._stg(${i},'dt','ip',+this.value||0)"></div>
      <div class="row"><label>td (s)</label>
        <input type="number" id="r${n}-dt-td" value="${cfg.td}" step="0.01"
          oninput="window._stg(${i},'dt','td',+this.value||0)"></div>
    </div>`;
  }
  const stgLabel = stg === 's1' ? 'Stage 1 - IDMT' : 'Stage 2 - IDMT';
  const step = stg === 's1' ? '1' : '0.1';
  return `
    <div class="stg-hdr"><span>${stgLabel}</span>
      <input type="checkbox" id="r${n}-${stg}-en"${chk}
        onchange="window._stgEn(${i},'${stg}',this)"></div>
    <div class="stg-body${vis}" id="r${n}-${stg}-body">
      <div class="row"><label id="r${n}-${stg}-lb">Pickup I (A)</label>
        <input type="number" id="r${n}-${stg}-ip" value="${cfg.ip}" step="${step}"
          oninput="window._stg(${i},'${stg}','ip',+this.value||0)"></div>
      <div class="row"><label>TMS</label>
        <input type="number" id="r${n}-${stg}-tms" value="${cfg.tms}" step="0.05"
          oninput="window._stg(${i},'${stg}','tms',+this.value||0)"></div>
      <div class="row"><label>Curve</label>
        <select id="r${n}-${stg}-ct" onchange="window._stg(${i},'${stg}','ct',this.value)">
          ${curveOpts(cfg.ct)}
        </select></div>
    </div>`;
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
    <input type="checkbox" id="r${n}-en"${r.en?' checked':''}
      onclick="event.stopPropagation()"
      onchange="window._rEn(${i},this.checked)">
  </div>
  <div class="relay-body collapsed" id="rb${n}">
    ${buildStage('s1',n,'s1',r.s1.en,r.s1)}
    ${buildStage('s2',n,'s2',r.s2.en,r.s2)}
    ${buildStage('dt',n,'dt',r.dt.en,r.dt)}
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
    <input type="checkbox" id="cd${i}-en"${cd.en?' checked':''}
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
    <div style="padding:3px 0 4px;">
      <label style="font-size:10px;color:#888;display:block;margin-bottom:2px;">Legend text (optional)</label>
      <input type="text" class="cd-settings-inp" id="cd${i}-settings" value="${esc(cd.settings||'')}"
        placeholder="e.g. In=250A, Ir=125A, td=0ms..."
        oninput="window.render()" onclick="event.stopPropagation()">
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
