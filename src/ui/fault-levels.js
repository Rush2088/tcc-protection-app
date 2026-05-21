import { faultLevels }                       from '../state.js';
const FL_COLORS = ['#6c3d91','#2e7d32','#00838f','#f57c00','#37474f','#ad1457'];
import { render }                             from '../chart/render.js';
import { operateTime }                        from '../engine/dataset.js';
import { getRelays, getBaseV }                from './inputs.js';
import { getCustomDevices, cdOperateTime }    from './custom-device.js';

export function addFL() {
  faultLevels.push({ label: 'FL' + (faultLevels.length + 1), a: 1000, en: true });
  renderFLList(); render();
}
export function removeFL(i) {
  faultLevels.splice(i, 1);
  renderFLList(); render();
}

function fmtMs(t) {
  return t === null ? '—' : (t < 1 ? Math.round(t * 1000) + ' ms' : t.toFixed(2) + ' s');
}

export function renderFLList() {
  const el     = document.getElementById('flList');
  const relays = getRelays();
  const cds    = getCustomDevices();
  const activeRelays = relays.filter(r => r.en);
  const activeCDs    = cds.filter(cd => cd.en && cd.points.length >= 2);

  el.innerHTML = '';

  faultLevels.forEach((fl, i) => {
    const col     = FL_COLORS[i % FL_COLORS.length];
    const enabled = fl.en !== false;
    const I_A     = fl.a;

    // Relay operate times
    const relayTimes = activeRelays.map(relay => {
      const v = {
        en1: relay.s1.en, en2: relay.s2.en, en3: relay.dt.en,
        ip1: relay.s1.ip, ip2: relay.s2.ip, ip3: relay.dt.ip,
        tms1: relay.s1.tms, tms2: relay.s2.tms,
        ct1: relay.s1.ct, ct2: relay.s2.ct, td: relay.dt.td
      };
      return { name: relay.name, color: relay.color, t: operateTime(I_A, v) };
    });

    // Custom device operate times
    const cdTimes = activeCDs.map(cd => ({
      name: cd.name, color: cd.color, t: cdOperateTime(I_A, cd.points)
    }));

    const allTimes = [...relayTimes, ...cdTimes];

    const entry = document.createElement('div');
    entry.className = 'fl-entry';
    entry.style.opacity = enabled ? '1' : '0.45';

    // Build operate-time pairs inline: "Relay 1: 5 ms   Relay 2: —"
    const timePairs = allTimes.map(({ name, color, t }) =>
      '<span class="fl-t-pair">' +
        '<span class="fl-t-lbl" style="color:' + color + '">' + name + ':</span>' +
        '<span class="fl-t-val" style="color:' + color + '">' + fmtMs(t) + '</span>' +
      '</span>'
    ).join('');

    entry.innerHTML =
      '<div class="fl-row">' +
        '<input type="checkbox"' + (enabled ? ' checked' : '') +
          ' title="Enable/disable this fault level"' +
          ' onchange="window.faultLevels[' + i + '].en=this.checked;window.renderFLList();window.render()">' +
        '<span class="fl-dot" style="background:' + col + '"></span>' +
        '<input class="fl-lbl" type="text" value="' + fl.label + '"' +
          ' onchange="window.faultLevels[' + i + '].label=this.value;window.render()">' +
        '<span class="fl-ilbl">A</span>' +
        '<input class="fl-val" type="number" value="' + fl.a + '" step="any" min="1"' +
          ' onchange="window.faultLevels[' + i + '].a=+this.value;window.render()">' +
        '<button class="fl-del" onclick="window.removeFL(' + i + ')">&#x2715;</button>' +
      '</div>' +
      (enabled && allTimes.length ?
        '<div class="fl-times">' +
          '<span class="fl-t-header">Operate time:</span>' +
          timePairs +
        '</div>'
      : '');

    el.appendChild(entry);
  });
}
