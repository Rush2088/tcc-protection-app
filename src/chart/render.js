import { build }                                     from '../engine/dataset.js';
import { xTicks, yTicks, X_LABEL, Y_LABEL, fmtKA }  from './ticks.js';
import { getRelays, getBaseV, getShowFull, getXUnit } from '../ui/inputs.js';
import { getCustomDevices }                          from '../ui/custom-device.js';
import { faultLevels, thermalCables, thermalTransformers } from '../state.js';

const FL_COLORS = ['#6c3d91','#2e7d32','#00838f','#f57c00','#37474f','#ad1457'];
const CT_LBL    = { EI: 'IEC EI', VI: 'IEC VI', SI: 'IEC SI', LTI: 'IEC LTI' };

let myChart = null;
export const zoomState = { xMin: 10, xMax: 50000, yMin: 0.001, yMax: 1000 };
export function resetZoom() { zoomState.xMin=10; zoomState.xMax=50000; zoomState.yMin=0.001; zoomState.yMax=1000; }

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function txCategory(mva) {
  if (mva <= 0.5) return 'I'; if (mva <= 5) return 'II'; if (mva <= 30) return 'III'; return 'IV';
}
function relaySettingsStr(relay) {
  const parts = [];
  if (relay.s1.en) parts.push('IDMT1 '+(CT_LBL[relay.s1.ct]||relay.s1.ct)+', Ir1='+relay.s1.ip+'A, TMS='+relay.s1.tms);
  if (relay.s2.en) parts.push('IDMT2 '+(CT_LBL[relay.s2.ct]||relay.s2.ct)+', Ir2='+relay.s2.ip+'A, TMS='+relay.s2.tms);
  if (relay.dt.en) parts.push('DT2 Threshold = '+relay.dt.ip+'A, td= '+Math.round(relay.dt.td*1000)+'ms');
  return parts.join(' ; ');
}
function svgLine(color, dash) {
  const da = dash ? ' stroke-dasharray="'+dash+'"' : '';
  return '<svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="'+color+'" stroke-width="2.5"'+da+'/></svg>';
}
function updateLegend(relays, cds) {
  const leg = document.getElementById('chart-legend'); if (!leg) return;
  let leftRows = '', rightRows = '';
  relays.forEach(relay => {
    if (!relay.en) return;
    leftRows += '<tr data-leg="relay"><td>'+svgLine(relay.color)+'</td><td class="leg-name">'+relay.name+'</td><td class="leg-settings">'+relaySettingsStr(relay)+'</td></tr>';
  });
  cds.forEach((cd, i) => {
    if (!cd.en || !cd.points.length) return;
    const txt = cd.settings || '';
    rightRows += '<tr data-leg="cd"><td>'+svgLine(cd.color)+'</td><td class="leg-name">'+cd.name+'</td><td class="leg-settings">'+txt+'</td></tr>';
  });
  if (window.tdcParentEn !== false) {
    thermalCables.forEach((tc, i) => {
      const enEl=document.getElementById('tdc'+i+'-en'), areaEl=document.getElementById('tdc'+i+'-area');
      const colEl=document.getElementById('tdc'+i+'-color'), nameEl=document.getElementById('tdc'+i+'-name');
      const en=enEl?enEl.checked:tc.en, area=areaEl?(parseFloat(areaEl.value)||tc.area):tc.area;
      const col=colEl?colEl.value:tc.color, nm=nameEl?nameEl.value:tc.name;
      if (!en) return;
      rightRows += '<tr data-leg="damage"><td>'+svgLine(col,'4 2')+'</td><td class="leg-name">'+nm+'</td><td class="leg-settings">Thermal damage curve — '+area+'mm²</td></tr>';
    });
    thermalTransformers.forEach((tx, i) => {
      const enEl=document.getElementById('tx'+i+'-en'), mvaEl=document.getElementById('tx'+i+'-mva');
      const colEl=document.getElementById('tx'+i+'-color'), nameEl=document.getElementById('tx'+i+'-name');
      const en=enEl?enEl.checked:tx.en, mva=mvaEl?(parseFloat(mvaEl.value)||tx.mva):tx.mva;
      const col=colEl?colEl.value:tx.color, nm=nameEl?nameEl.value:tx.name;
      if (!en) return;
      rightRows += '<tr data-leg="damage"><td>'+svgLine(col,'5 3')+'</td><td class="leg-name">'+nm+'</td><td class="leg-settings">Transformer thermal damage — '+mva+' MVA</td></tr>';
    });
  }
  if (!leftRows && !rightRows) { leg.innerHTML = ''; return; }
  const leftHtml  = leftRows  ? '<table>'+leftRows+'</table>'  : '';
  const rightHtml = rightRows ? '<table>'+rightRows+'</table>' : '';
  leg.innerHTML = '<div class="leg-col">'+leftHtml+'</div><div class="leg-col">'+rightHtml+'</div>';
}

// ── Hover: snap cursor to nearest visible curve, show I and t ─────────────────
function setupHover(canvasEl) {
  if (canvasEl.dataset.hoverSetup) return;
  canvasEl.dataset.hoverSetup = '1';

  const wrap = canvasEl.parentElement;
  if (wrap) wrap.style.position = 'relative';

  // Tooltip label
  let tip = document.getElementById('tcc-hover-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'tcc-hover-tip';
    tip.style.cssText = [
      'position:absolute', 'pointer-events:none', 'display:none',
      'background:rgba(20,20,20,0.82)', 'color:#fff',
      'padding:3px 8px', 'border-radius:4px',
      'font:bold 12px/1.6 Arial,sans-serif', 'white-space:nowrap', 'z-index:100',
      'box-shadow:0 1px 4px rgba(0,0,0,0.3)'
    ].join(';');
    if (wrap) wrap.appendChild(tip);
  }

  // Snap dot
  let dot = document.getElementById('tcc-hover-dot');
  if (!dot) {
    dot = document.createElement('div');
    dot.id = 'tcc-hover-dot';
    dot.style.cssText = [
      'position:absolute', 'pointer-events:none', 'display:none',
      'width:8px', 'height:8px', 'border-radius:50%',
      'border:2px solid #fff', 'margin:-4px 0 0 -4px', 'z-index:101',
      'box-shadow:0 0 3px rgba(0,0,0,0.4)'
    ].join(';');
    if (wrap) wrap.appendChild(dot);
  }

  canvasEl.addEventListener('mousemove', (e) => {
    const chart = window._tccChart;
    if (!chart) return;

    const rect = canvasEl.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

    const ca = chart.chartArea;
    if (!ca || mx < ca.left || mx > ca.right || my < ca.top || my > ca.bottom) {
      tip.style.display = 'none';
      dot.style.display = 'none';
      return;
    }

    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    if (!xScale || !yScale) return;

    const mouseI = xScale.getValueForPixel(mx);
    if (!mouseI || mouseI <= 0) return;

    // Find nearest curve at this I value (closest vertical pixel distance)
    let bestDist = Infinity, bestPx = null, bestPy = null, bestColor = '#888';

    chart.data.datasets.forEach(ds => {
      if (!ds.data || ds.data.length < 2) return;
      const pts = ds.data.filter(p => p.x > 0 && p.y > 0);
      if (pts.length < 2) return;

      // Log-log interpolate t at mouseI — check ALL segments (not just first)
      // so lower/return bounds of custom curves are also tracked.
      for (let k = 0; k < pts.length - 1; k++) {
        const p1 = pts[k], p2 = pts[k + 1];
        if (p1.x <= 0 || p2.x <= 0 || p1.y <= 0 || p2.y <= 0) continue;

        // Segment range (handle reversed x gracefully)
        const xLo = Math.min(p1.x, p2.x), xHi = Math.max(p1.x, p2.x);
        if (mouseI < xLo || mouseI > xHi) continue;

        const logI  = Math.log(mouseI);
        const logI1 = Math.log(p1.x), logI2 = Math.log(p2.x);
        const logT1 = Math.log(p1.y), logT2 = Math.log(p2.y);
        const dLogI = logI2 - logI1;

        let tInterp;
        if (Math.abs(dLogI) < 1e-10) {
          // Near-vertical segment — snap to midpoint y
          tInterp = Math.exp((logT1 + logT2) / 2);
        } else {
          const frac = (logI - logI1) / dLogI;
          tInterp = Math.exp(logT1 + frac * (logT2 - logT1));
        }
        if (!isFinite(tInterp) || tInterp <= 0) continue;

        const px   = xScale.getPixelForValue(mouseI);
        const py   = yScale.getPixelForValue(tInterp);
        const dist = Math.abs(my - py);

        if (dist < bestDist) {
          bestDist  = dist;
          bestPx    = px;
          bestPy    = py;
          bestColor = typeof ds.borderColor === 'string' ? ds.borderColor : '#888';
        }
        // No break — continue checking remaining segments for this dataset
      }
    });

    // Only snap if within ~50 CSS px of a curve
    if (bestPx === null || bestDist > 50) {
      tip.style.display = 'none';
      dot.style.display = 'none';
      return;
    }

    const snapI = xScale.getValueForPixel(bestPx);
    const snapT = yScale.getValueForPixel(bestPy);

    const iStr = snapI >= 1000
      ? (snapI / 1000).toFixed(snapI >= 10000 ? 1 : 2) + ' kA'
      : Math.round(snapI) + ' A';
    const tStr = snapT < 0.1
      ? Math.round(snapT * 1000) + ' ms'
      : snapT < 10 ? snapT.toFixed(3) + ' s'
      : snapT.toFixed(1) + ' s';

    tip.textContent   = iStr + '  |  ' + tStr;
    tip.style.display = 'block';

    // Position tooltip above-right; nudge left near right edge
    const wrapW = wrap ? wrap.offsetWidth : canvasEl.offsetWidth;
    const tipW  = tip.offsetWidth || 120;
    const tx    = (bestPx + tipW + 20 < wrapW) ? bestPx + 12 : bestPx - tipW - 12;
    tip.style.left = tx + 'px';
    tip.style.top  = (bestPy - 26) + 'px';

    dot.style.display    = 'block';
    dot.style.left       = bestPx + 'px';
    dot.style.top        = bestPy + 'px';
    dot.style.background = bestColor;
  });

  canvasEl.addEventListener('mouseleave', () => {
    tip.style.display = 'none';
    dot.style.display = 'none';
  });
}

export function render() {
  const relays=getRelays(), baseV=getBaseV(), showFull=getShowFull(), xUnit=getXUnit();
  const xLabel='Current ('+xUnit+') @ '+baseV+'kV', lbl='Pickup I ('+baseV+'kV, A)';
  const titleEl=document.getElementById('chart-title');
  if (titleEl) { titleEl.textContent=(document.getElementById('projName')||{}).value||'Protection Coordination'; }
  [1,2].forEach(n => { ['s1','s2','dt'].forEach(s => { const el=document.getElementById('r'+n+'-'+s+'-lb'); if(el) el.textContent=lbl; }); });
  const datasets=[], cds=getCustomDevices();

  relays.forEach(relay => {
    if (!relay.en) return;
    const {s1,s2,dt}=relay, res=build(s1.en,s2.en,dt.en,s1.ip,s2.ip,dt.ip,s1.tms,s2.tms,s1.ct,s2.ct,dt.td);
    const col=relay.color, fade=hexToRgba(col,0.18);
    if (showFull) {
      if(s1.en) datasets.push({data:res.s1Full,borderColor:fade,borderWidth:1.5,borderDash:[6,4],pointRadius:0,showLine:true,tension:0});
      if(s2.en) datasets.push({data:res.s2Full,borderColor:fade,borderWidth:1.5,borderDash:[6,4],pointRadius:0,showLine:true,tension:0});
    }
    datasets.push({data:res.s1Eff,borderColor:col,borderWidth:2.5,pointRadius:0,showLine:true,tension:0});
    datasets.push({data:res.s2Eff,borderColor:col,borderWidth:2.5,pointRadius:0,showLine:true,tension:0});
    datasets.push({data:res.dtD,  borderColor:col,borderWidth:3,  pointRadius:0,showLine:true,tension:0});
  });

  cds.forEach((cd,i) => {
    if (!cd.en||!cd.points.length) return;
    const data=cd.points.filter(p=>p.i>0&&p.t>0).map(p=>({x:p.i,y:p.t}));
    if (!data.length) return;
    datasets.push({data,borderColor:cd.color,borderWidth:2.5,pointRadius:0,showLine:true,spanGaps:false,tension:0});
  });

  if (window.tdcParentEn !== false) {
    const tdcK=parseFloat((document.getElementById('tdc-k')||{}).value)||143;
    const tdcIMin=(parseFloat((document.getElementById('tdc-imin')||{}).value)||1)*1000;
    const tdcIMax=(parseFloat((document.getElementById('tdc-imax')||{}).value)||20)*1000, tdcN=120;
    thermalCables.forEach((tc,i) => {
      const enEl=document.getElementById('tdc'+i+'-en'), areaEl=document.getElementById('tdc'+i+'-area');
      const colEl=document.getElementById('tdc'+i+'-color');
      const en=enEl?enEl.checked:tc.en, area=areaEl?(parseFloat(areaEl.value)||tc.area):tc.area, col=colEl?colEl.value:tc.color;
      if (!en||area<=0||tdcIMin<=0||tdcIMax<=tdcIMin) return;
      const pts=[];
      for(let j=0;j<=tdcN;j++){const I=Math.exp(Math.log(tdcIMin)+(Math.log(tdcIMax)-Math.log(tdcIMin))*j/tdcN);const t=Math.pow(tdcK*area/I,2);if(t>0&&isFinite(t))pts.push({x:I,y:t});}
      if(pts.length<2) return;
      datasets.push({data:pts,borderColor:col,borderWidth:2,borderDash:[5,3],pointRadius:0,showLine:true,tension:0});
    });
    thermalTransformers.forEach((tx,i) => {
      const enEl=document.getElementById('tx'+i+'-en'), mvaEl=document.getElementById('tx'+i+'-mva');
      const iscEl=document.getElementById('tx'+i+'-isc'), colEl=document.getElementById('tx'+i+'-color');
      const freqEl=document.getElementById('tx'+i+'-freq');
      const en=enEl?enEl.checked:tx.en, mva=mvaEl?(parseFloat(mvaEl.value)||tx.mva):tx.mva;
      const isc=iscEl?(parseFloat(iscEl.value)||tx.isc):tx.isc, col=colEl?colEl.value:tx.color;
      const showFreq=freqEl?freqEl.checked:tx.showFreq;
      if (!en||isc<=0) return;
      const IscA=isc*1000,K1=IscA*IscA*5,K2=IscA*IscA*2,cat=txCategory(mva);
      const IbrkA=(cat==='II'?0.70:0.50)*IscA, IMinA=zoomState.xMin, IMaxA=zoomState.xMax;
      if(IMaxA<=IMinA) return; const N=120;
      const ptsT=[];
      for(let j=0;j<=N;j++){const I=Math.exp(Math.log(IMinA)+(Math.log(IMaxA)-Math.log(IMinA))*j/N);const t=K1/(I*I);if(t>=0.5&&t<=20&&isFinite(t))ptsT.push({x:I,y:t});}
      if(ptsT.length>=2) datasets.push({data:ptsT,borderColor:col,borderWidth:2.5,borderDash:[5,3],pointRadius:0,showLine:true,tension:0});
      if(showFreq&&cat!=='I'){
        const ptsM=[];
        for(let j=0;j<=N;j++){const I=Math.exp(Math.log(IMinA)+(Math.log(IMaxA)-Math.log(IMinA))*j/N);const t=(I<=IbrkA)?K1/(I*I):K2/(I*I);if(t>=0.5&&t<=20&&isFinite(t))ptsM.push({x:I,y:t});}
        if(ptsM.length>=2) datasets.push({data:ptsM,borderColor:col,borderWidth:1.5,borderDash:[2,2],pointRadius:0,showLine:true,tension:0});
      }
    });
  }
  updateLegend(relays, cds);

  const flLabelPlugin = { id:'flLabel', afterDraw(ch) {
    if(window.flParentEn===false) return;
    const {ctx,scales:{x,y},chartArea:ca}=ch; if(!x||!y||!ca) return;
    const entries=[];
    faultLevels.forEach((fl,i)=>{ if(fl.en===false||!fl.a) return; if(fl.a<x.min||fl.a>x.max) return;
      const px=x.getPixelForValue(fl.a), kA=(fl.a/1000).toFixed(1);
      entries.push({px,lbl:(fl.label||('FL'+(i+1)))+'  '+kA+' kA',col:FL_COLORS[i%FL_COLORS.length]});
    });
    if(!entries.length) return;
    ctx.save(); ctx.setLineDash([6,3]); ctx.lineWidth=1.5;
    entries.forEach(({px,col})=>{ if(px<=ca.left||px>=ca.right) return;
      ctx.beginPath(); ctx.strokeStyle=col; ctx.moveTo(px,ca.top); ctx.lineTo(px,ca.bottom); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.restore();
    entries.sort((a,b)=>a.px-b.px); ctx.font='bold 12px Arial'; const lvR=[];
    entries.forEach(e=>{ const w=ctx.measureText(e.lbl).width; let lv=0;
      while(lvR[lv]!==undefined&&e.px+5<lvR[lv]) lv++; e.level=lv; lvR[lv]=e.px+5+w+6;
    });
    ctx.save(); ctx.textAlign='left';
    entries.forEach(({px,lbl,col,level})=>{ ctx.fillStyle=col; ctx.fillText(lbl,px+5,ca.top+16+level*16); });
    ctx.restore();
    if(window.tdcParentEn!==false){
      const k2=parseFloat((document.getElementById('tdc-k')||{}).value)||143;
      const imax2=(parseFloat((document.getElementById('tdc-imax')||{}).value)||20)*1000;
      thermalCables.forEach((tc,i)=>{
        const enEl=document.getElementById('tdc'+i+'-en'),areaEl=document.getElementById('tdc'+i+'-area');
        const colEl=document.getElementById('tdc'+i+'-color'),nameEl=document.getElementById('tdc'+i+'-name');
        const en=enEl?enEl.checked:tc.en,area=areaEl?(parseFloat(areaEl.value)||tc.area):tc.area;
        const col=colEl?colEl.value:tc.color,nm=nameEl?nameEl.value:tc.name;
        if(!en||area<=0) return;
        const t=Math.pow(k2*area/imax2,2); if(!isFinite(t)||t<=0) return;
        const lpx=x.getPixelForValue(imax2),lpy=y.getPixelForValue(t);
        if(lpx<ca.left||lpx>ca.right||lpy<ca.top||lpy>ca.bottom) return;
        ctx.save(); ctx.font='bold 12px Arial'; const tw=ctx.measureText(nm).width;
        ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fillRect(lpx-tw-12,lpy-13,tw+8,16);
        ctx.fillStyle=col; ctx.textAlign='right'; ctx.fillText(nm,lpx-4,lpy); ctx.restore();
      });
      thermalTransformers.forEach((tx,i)=>{
        const enEl=document.getElementById('tx'+i+'-en'),iscEl=document.getElementById('tx'+i+'-isc');
        const colEl=document.getElementById('tx'+i+'-color'),nameEl=document.getElementById('tx'+i+'-name');
        const en=enEl?enEl.checked:tx.en,isc=iscEl?(parseFloat(iscEl.value)||tx.isc):tx.isc;
        const col=colEl?colEl.value:tx.color,nm=nameEl?nameEl.value:tx.name;
        if(!en||isc<=0) return;
        const IscA=isc*1000,K1=IscA*IscA*5,labelI=Math.min(IscA*Math.sqrt(10),x.max);
        if(labelI<x.min) return; const t=K1/(labelI*labelI); if(!isFinite(t)||t<=0) return;
        const lpx=x.getPixelForValue(labelI),lpy=y.getPixelForValue(t);
        if(lpx<ca.left||lpx>ca.right||lpy<ca.top||lpy>ca.bottom) return;
        ctx.save(); ctx.font='bold 12px Arial'; const tw=ctx.measureText(nm).width;
        ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fillRect(lpx-tw-12,lpy-13,tw+8,16);
        ctx.fillStyle=col; ctx.textAlign='right'; ctx.fillText(nm,lpx-4,lpy); ctx.restore();
      });
    }
  }};

  const _canvas=document.getElementById('tcc'), _stuck=Chart.getChart(_canvas);
  if(_stuck){try{_stuck.destroy();}catch(e){}} myChart=null;
  myChart=new Chart(document.getElementById('tcc'),{
    type:'scatter', plugins:[flLabelPlugin], data:{datasets},
    options:{ responsive:true, maintainAspectRatio:false, animation:{duration:120},
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label(c){
        const kA=c.raw.x/1000;
        const disp=xUnit==='A'?Math.round(c.raw.x)+' A':(kA<0.1?kA.toFixed(3):kA<1?kA.toFixed(2):kA.toFixed(1))+' kA';
        return disp+'  →  '+Math.round(c.raw.y*1000)+' ms';
      }}}},
      scales:{
        x:{ type:'logarithmic', min:zoomState.xMin, max:zoomState.xMax,
          title:{display:true,text:xLabel,color:'#333',font:{size:14}},
          afterBuildTicks:ax=>{const mn=zoomState.xMin,mx=zoomState.xMax;ax.ticks=xTicks().filter(t=>t.value>=mn*0.95&&t.value<=mx*1.05);},
          ticks:{color:'#444',font:{size:12},maxRotation:0,callback(v){let m=null;for(const lv of X_LABEL){if(Math.abs(v/lv-1)<0.01){m=lv;break;}}if(!m)return '';return xUnit==='A'?(m>=1000?(m/1000)+'k':String(m)):fmtKA(m);}},
          grid:{display:false}},
        y:{ type:'logarithmic', min:zoomState.yMin, max:zoomState.yMax,
          title:{display:true,text:'Trip time (s)',color:'#333',font:{size:14}},
          afterBuildTicks:ax=>{const mn=zoomState.yMin,mx=zoomState.yMax;ax.ticks=yTicks().filter(t=>t.value>=mn*0.9&&t.value<=mx*1.1);},
          ticks:{color:'#444',font:{size:12},autoSkip:false,callback(v){for(const lv of Y_LABEL){if(Math.abs(v/lv-1)<0.01)return String(lv);}return '';}},
          grid:{display:false}}
      }
    }
  });
  window._tccChart = myChart;

  // Set up hover snap (once per canvas — survives chart destroy/recreate)
  setupHover(document.getElementById('tcc'));
}
