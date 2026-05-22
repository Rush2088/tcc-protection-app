import { relays } from '../state.js';

// relays[] is the source of truth.
// DOM inputs call window._rName/_rEn/_stg/_stgEn to keep state in sync.
export function getRelays()   { return relays; }
export function getBaseV()    { return parseFloat(document.getElementById('baseV').value) || 0.4; }
export function getShowFull() { return document.getElementById('showFull').checked; }
export function getXUnit()    { const el = document.getElementById('xUnit'); return el ? el.value : 'kA'; }
