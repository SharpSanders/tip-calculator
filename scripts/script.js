/**
 * Better Endeavors — Tip Calculator
 * Plain JS, modular helpers + DOM controller.
 * - Currency formatting via Intl.NumberFormat (fallbacks included)
 * - Debounced input handling
 * - Keyboard & screen-reader friendly
 * - localStorage persistence for settings (bill clears on reload)
 *
 * Exports helpers via UMD-style for tests (module.exports if available).
 */

/* =========================
   Currency / number utils
   ========================= */
const locale = navigator.language || 'en-US';
const currency = (Intl && Intl.NumberFormat) ? new Intl.NumberFormat(locale, { style: 'currency', currency: guessCurrency(locale) }) : null;

function guessCurrency(loc){
  // Basic guess: use USD for US, otherwise fallback to USD.
  try{
    if (loc && loc.toLowerCase().includes('us')) return 'USD';
  }catch(e){}
  return 'USD';
}

function formatCurrency(n){
  if (Number.isNaN(n) || !Number.isFinite(n)) n = 0;
  return currency ? currency.format(n) : `$${n.toFixed(2)}`;
}

function parseNumberLike(input){
  // Accepts strings like "$1,234.56" or "1234,56" (we assume '.' as decimal)
  if (typeof input === 'number') return input;
  if (!input) return 0;
  const cleaned = String(input).replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  // keep at most one decimal point
  const normalized = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max){ return Math.min(Math.max(n, min), max); }
function roundCurrency(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

/* =========================
   Core calculator
   ========================= */
/**
 * Compute totals according to spec.
 * @param {object} opts
 * @returns {object} { bill, tax, service, tipBase, tip, total, perTip, perTotal, delta, effectivePctBill, effectivePctBase }
 */
function computeTotals(opts){
  const {
    bill=0, tipPct=0.15, people=1,
    taxPct=0, includeTaxInTip=false,
    servicePct=0, applyService=false,
    rounding='none' // 'none' | 'roundTip' | 'roundPerPerson'
  } = opts || {};

  const safePeople = clamp(Math.round(people || 1), 1, 20);
  const tax = bill * (taxPct || 0);
  const service = applyService ? bill * (servicePct || 0) : 0;
  const tipBase = bill + (includeTaxInTip ? tax : 0) + (applyService ? service : 0);
  let tip = tipBase * (tipPct || 0);
  let total = bill + tax + service + tip;
  let delta = 0;

  if (rounding === 'roundTip'){
    tip = roundCurrency(tip);
    total = bill + tax + service + tip;
  } else if (rounding === 'roundPerPerson'){
    const rawPer = total / safePeople;
    const per = roundCurrency(rawPer);
    const groupTotal = per * safePeople;
    delta = groupTotal - total;
    // Attribute delta to tip so everything reconciles cleanly.
    tip += delta;
    total = groupTotal;
  }

  const perTotal = total / safePeople;
  const perTip = tip / safePeople;

  const effectivePctBill = bill > 0 ? (tip / bill) * 100 : 0;
  const baseUsed = tipBase > 0 ? (tip / tipBase) * 100 : 0;

  return {
    bill, tax, service, tipBase,
    tip, total, perTip, perTotal, delta,
    effectivePctBill, effectivePctBase: baseUsed, people: safePeople
  };
}

/* =========================
   DOM wiring
   ========================= */
const els = {
  bill: document.getElementById('bill'),
  billErr: document.getElementById('bill-error'),
  tipBtns: Array.from(document.querySelectorAll('.tip-btn')),
  customTip: document.getElementById('customTip'),
  people: document.getElementById('people'),
  stepperBtns: Array.from(document.querySelectorAll('.stepper-btn')),
  rounding: Array.from(document.querySelectorAll('input[name="rounding"]')),
  taxPct: document.getElementById('taxPct'),
  includeTaxInTip: document.getElementById('includeTaxInTip'),
  servicePct: document.getElementById('servicePct'),
  applyService: document.getElementById('applyService'),
  copyBtn: document.getElementById('copyBtn'),
  resetBtn: document.getElementById('resetBtn'),
  tipAmount: document.getElementById('tipAmount'),
  totalAmount: document.getElementById('totalAmount'),
  perTip: document.getElementById('perTip'),
  perTotal: document.getElementById('perTotal'),
  delta: document.getElementById('roundingDelta'),
  effLabel: document.getElementById('effectiveTipLabel'),
  year: document.getElementById('year'),
};

const STORAGE_KEY = 'be-tipcalc-settings-v1';

const defaults = {
  tipPreset: 15,
  customTip: '',
  people: 1,
  rounding: 'none',
  taxPct: 0,
  includeTaxInTip: false,
  servicePct: 0,
  applyService: false
};

function loadSettings(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  }catch(e){
    return { ...defaults };
  }
}
function saveSettings(s){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }catch(e){}
}

/* =========================
   State & handlers
   ========================= */
let state = {
  bill: 0,
  tipPct: 0.15,
  tipPreset: 15,
  customTip: '',
  people: 1,
  rounding: 'none',
  taxPct: 0,
  includeTaxInTip: false,
  servicePct: 0,
  applyService: false
};

function applySettingsToUI(s){
  // Tip preset
  els.tipBtns.forEach(btn => {
    const v = Number(btn.dataset.tip);
    btn.setAttribute('aria-pressed', String(v === s.tipPreset && !s.customTip));
  });
  els.customTip.value = s.customTip || '';
  // People
  els.people.value = s.people;
  // Rounding
  els.rounding.forEach(r => r.checked = (r.value === s.rounding));
  // Tax / toggles
  els.taxPct.value = s.taxPct;
  els.includeTaxInTip.checked = !!s.includeTaxInTip;
  els.servicePct.value = s.servicePct;
  els.applyService.checked = !!s.applyService;
}

function init(){
  els.year.textContent = new Date().getFullYear();

  const saved = loadSettings();
  state = { ...state, ...saved, bill: 0, tipPct: deriveTipPct(saved) };
  applySettingsToUI(saved);

  // Event listeners
  const debouncedUpdate = debounce(update, 120);

  els.bill.addEventListener('input', onBillInput);
  els.bill.addEventListener('blur', onBillBlur);

  els.tipBtns.forEach(btn => btn.addEventListener('click', () => {
    const pct = Number(btn.dataset.tip);
    state.tipPreset = pct;
    state.customTip = '';
    state.tipPct = pct/100;
    updateTipButtons();
    persist();
    update();
  }));

  els.customTip.addEventListener('input', e => {
    const v = clamp(parseNumberLike(e.target.value), 0, 100);
    state.customTip = e.target.value === '' ? '' : String(v);
    state.tipPct = (state.customTip === '' ? (state.tipPreset/100) : (v/100));
    updateTipButtons();
    persist();
    debouncedUpdate();
  });
  els.customTip.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      e.preventDefault();
      els.customTip.value = '';
      state.customTip = '';
      state.tipPct = state.tipPreset/100;
      updateTipButtons();
      persist();
      update();
    }
  });

  els.people.addEventListener('input', () => {
    state.people = clamp(parseInt(els.people.value || '1', 10), 1, 20);
    els.people.value = state.people;
    persist();
    debouncedUpdate();
  });
  els.people.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      e.preventDefault();
      const step = e.key === 'ArrowUp' ? 1 : -1;
      stepPeople(step);
    }
  });
  els.stepperBtns.forEach(b => b.addEventListener('click', () => {
    stepPeople(Number(b.dataset.step));
  }));

  els.rounding.forEach(r => r.addEventListener('change', () => {
    state.rounding = document.querySelector('input[name="rounding"]:checked').value;
    persist();
    update();
  }));

  els.taxPct.addEventListener('input', () => {
    state.taxPct = clamp(parseNumberLike(els.taxPct.value)/100, 0, 1);
    persist();
    debouncedUpdate();
  });
  els.includeTaxInTip.addEventListener('change', () => {
    state.includeTaxInTip = els.includeTaxInTip.checked;
    persist();
    update();
  });

  els.servicePct.addEventListener('input', () => {
    state.servicePct = clamp(parseNumberLike(els.servicePct.value)/100, 0, 1);
    persist();
    debouncedUpdate();
  });
  els.applyService.addEventListener('change', () => {
    state.applyService = els.applyService.checked;
    persist();
    update();
  });

  els.copyBtn.addEventListener('click', copyBreakdown);
  els.resetBtn.addEventListener('click', resetAll);

  update();
}

function updateTipButtons(){
  els.tipBtns.forEach(btn => {
    const isPreset = (state.customTip === '' && Number(btn.dataset.tip) === state.tipPreset);
    btn.setAttribute('aria-pressed', String(isPreset));
  });
}

function stepPeople(step){
  state.people = clamp((state.people || 1) + step, 1, 20);
  els.people.value = state.people;
  persist();
  update();
}

function onBillInput(e){
  const val = e.target.value;
  let n = parseNumberLike(val);
  if (!Number.isFinite(n) || n < 0) n = 0;
  state.bill = n;
  // Keep input friendly while typing; no forced formatting here
  els.billErr.textContent = '';
  debounce(update, 120)();
}

function onBillBlur(e){
  // Format on blur
  e.target.value = formatCurrency(state.bill);
}

function deriveTipPct(s){
  return s.customTip ? (parseNumberLike(s.customTip)/100) : (s.tipPreset/100);
}

function update(){
  // Validate
  if (state.bill < 0){
    els.billErr.textContent = 'Bill must be zero or greater.';
    return;
  } else {
    els.billErr.textContent = '';
  }

  const result = computeTotals({
    bill: state.bill,
    tipPct: state.tipPct,
    people: state.people,
    taxPct: state.taxPct,
    includeTaxInTip: state.includeTaxInTip,
    servicePct: state.servicePct,
    applyService: state.applyService,
    rounding: state.rounding
  });

  els.tipAmount.textContent = formatCurrency(result.tip);
  els.totalAmount.textContent = formatCurrency(result.total);
  els.perTip.textContent = formatCurrency(result.perTip);
  els.perTotal.textContent = formatCurrency(result.perTotal);

  if (state.rounding === 'roundPerPerson' && Math.abs(result.delta) >= 0.005){
    const sign = result.delta > 0 ? '+' : '−';
    els.delta.textContent = `Rounding delta: ${sign}${formatCurrency(Math.abs(result.delta)).replace('$','')}`;
  } else {
    els.delta.textContent = '';
  }

  // Effective tip label
  const pctBill = `${roundCurrency(result.effectivePctBill).toFixed(2)}%`;
  const pctBase = `${roundCurrency(result.effectivePctBase).toFixed(2)}%`;
  els.effLabel.textContent = `≈ ${pctBill} of bill-only; ${pctBase} of base used${state.includeTaxInTip || state.applyService ? ' (incl. toggles)' : ''}`;
}

function persist(){
  saveSettings({
    tipPreset: state.tipPreset,
    customTip: state.customTip,
    people: state.people,
    rounding: state.rounding,
    taxPct: Math.round((state.taxPct||0)*1000)/10, // store as %
    includeTaxInTip: state.includeTaxInTip,
    servicePct: Math.round((state.servicePct||0)*1000)/10, // store as %
    applyService: state.applyService
  });
}

function resetAll(){
  // Reset to defaults and persist
  state = {
    bill: 0,
    tipPreset: defaults.tipPreset,
    customTip: '',
    tipPct: defaults.tipPreset/100,
    people: defaults.people,
    rounding: defaults.rounding,
    taxPct: defaults.taxPct/100,
    includeTaxInTip: defaults.includeTaxInTip,
    servicePct: defaults.servicePct/100,
    applyService: defaults.applyService
  };
  // Clear UI values
  els.bill.value = '';
  els.customTip.value = '';
  els.people.value = state.people;
  els.taxPct.value = 0;
  els.includeTaxInTip.checked = false;
  els.servicePct.value = 0;
  els.applyService.checked = false;
  updateTipButtons();
  persist();
  update();
}

/* Clipboard */
async function copyBreakdown(){
  const r = computeTotals({
    bill: state.bill,
    tipPct: state.tipPct,
    people: state.people,
    taxPct: state.taxPct,
    includeTaxInTip: state.includeTaxInTip,
    servicePct: state.servicePct,
    applyService: state.applyService,
    rounding: state.rounding
  });
  const lines = [
    `Better Endeavors — Tip Breakdown`,
    `Bill: ${formatCurrency(r.bill)}`,
    `Tax (${(state.taxPct*100).toFixed(2)}%): ${formatCurrency(r.tax)}`,
    `Service (${(state.servicePct*100).toFixed(2)}%${state.applyService ? ', applied' : ', not applied'}): ${formatCurrency(r.service)}`,
    `Tip base: ${formatCurrency(r.tipBase)}`,
    `Tip (${(state.tipPct*100).toFixed(2)}%): ${formatCurrency(r.tip)}`,
    state.rounding === 'roundPerPerson' && Math.abs(r.delta) >= 0.005 ? `Rounding delta: ${r.delta>0?'+':'-'}${formatCurrency(Math.abs(r.delta))}` : null,
    `Total: ${formatCurrency(r.total)}`,
    `People: ${r.people}`,
    `Per-person tip: ${formatCurrency(r.perTip)}`,
    `Per-person total: ${formatCurrency(r.perTotal)}`,
    `Effective tip: ~${roundCurrency(r.effectivePctBill).toFixed(2)}% of bill; ~${roundCurrency(r.effectivePctBase).toFixed(2)}% of base used`
  ].filter(Boolean).join('\n');

  try{
    await navigator.clipboard.writeText(lines);
    flashButton(els.copyBtn);
  }catch(e){
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = lines; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    flashButton(els.copyBtn);
  }
}

function flashButton(btn){
  const old = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

/* Debounce */
function debounce(fn, wait){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

/* Init on DOM ready */
document.addEventListener('DOMContentLoaded', init);

/* ===== Exports for tests ===== */
const TipCalc = { computeTotals, roundCurrency, clamp, parseNumberLike };
if (typeof window !== 'undefined') window.TipCalc = TipCalc;
if (typeof module !== 'undefined' && module.exports) module.exports = TipCalc;
