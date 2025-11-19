

const locale = typeof navigator !== "undefined" && navigator.language
  ? navigator.language
  : "en-US";

function guessCurrency(loc) {
  if (!loc) return "USD";
  const lower = loc.toLowerCase();
  if (lower.includes("gb")) return "GBP";
  if (lower.includes("eu") || lower.includes("de") || lower.includes("fr")) return "EUR";
  if (lower.includes("ca")) return "CAD";
  if (lower.includes("au")) return "AUD";
  return "USD";
}

const currencyFormatter = typeof Intl !== "undefined" && Intl.NumberFormat
  ? new Intl.NumberFormat(locale, {
      style: "currency",
      currency: guessCurrency(locale),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  : null;

function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatMoney(value) {
  const n = Number.isFinite(value) ? value : 0;
  if (currencyFormatter) return currencyFormatter.format(n);
  return `$${roundCurrency(n).toFixed(2)}`;
}

function clamp(n, min, max) {
  n = Number(n) || 0;
  return Math.min(max, Math.max(min, n));
}

function parseNumberLike(raw) {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  if (!s) return 0;

  s = s.replace(/[\s,']/g, "");

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(",", ".");
  }

  s = s.replace(/[^0-9.\-]/g, "");

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function debounce(fn, wait) {
  let t = null;
  return function debounced(...args) {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

// ======================
//   Core calculations
// ======================

/**
 * Compute tip/tax/service/total.
 *
 * @param {Object} cfg
 * @param {number} cfg.bill
 * @param {number} cfg.tipPct        (0–1)
 * @param {number} cfg.people
 * @param {number} cfg.taxPct        (0–1)
 * @param {boolean} cfg.includeTaxInTip
 * @param {number} cfg.servicePct    (0–1)
 * @param {boolean} cfg.applyService
 * @param {string} cfg.rounding      'none' | 'roundTip' | 'roundTotal' | 'roundPerPerson'
 */
 
function computeTotals(cfg) {
  const bill = Math.max(0, Number(cfg.bill) || 0);
  const people = Math.max(1, Math.round(Number(cfg.people) || 1));
  const tipPct = Math.max(0, Number(cfg.tipPct) || 0);
  const taxPct = Math.max(0, Number(cfg.taxPct) || 0);
  const servicePct = Math.max(0, Number(cfg.servicePct) || 0);
  const includeTaxInTip = !!cfg.includeTaxInTip;
  const applyService = !!cfg.applyService;
  const rounding = cfg.rounding || "none";

  const taxRaw = bill * taxPct;
  const serviceRaw = applyService ? bill * servicePct : 0;

  const tipBase = includeTaxInTip ? bill + taxRaw + serviceRaw : bill + serviceRaw;
  const tipRaw = tipBase * tipPct;

  let tip = tipRaw;
  let tax = taxRaw;
  let service = serviceRaw;

  let total = bill + tax + service + tip;
  let perTotal = total / people;

  switch (rounding) {
    case "roundTip": {
      tip = roundCurrency(tipRaw);
      total = bill + tax + service + tip;
      perTotal = total / people;
      break;
    }
    case "roundTotal": {
      const roundedTotal = roundCurrency(total);
      const delta = roundedTotal - total;
      tip = tipRaw + delta;
      total = roundedTotal;
      perTotal = total / people;
      break;
    }
    case "roundPerPerson": {
      const per = roundCurrency(total / people);
      total = per * people;
      tip = total - bill - tax - service;
      perTotal = per;
      break;
    }
    case "none":
    default:
      // just round at the end
      break;
  }

  return {
    bill: roundCurrency(bill),
    tax: roundCurrency(tax),
    service: roundCurrency(service),
    tip: roundCurrency(tip),
    total: roundCurrency(total),
    perTotal: roundCurrency(perTotal)
  };
}

// ======================
//   State & persistence
// ======================

const SETTINGS_KEY = "be-tipcalc-settings-v1";

const defaultSettings = {
  tipPreset: 15,          // %
  customTip: "",          // raw input
  people: 1,
  rounding: "none",
  taxPct: 0,
  includeTaxInTip: false,
  servicePct: 0,
  applyService: false
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaultSettings };
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

let state = {
  bill: 0,
  tipPct: 0.15,
  tipPreset: 15,
  customTip: "",
  people: 1,
  rounding: "none",
  taxPct: 0,
  includeTaxInTip: false,
  servicePct: 0,
  applyService: false
};

let debouncedUpdate = null;

// ======================
//   DOM wiring
// ======================

const els = {
  bill: document.getElementById("bill"),
  billErr: document.getElementById("bill-error"),
  tipBtns: Array.from(document.querySelectorAll(".tip-btn[data-tip]")),
  customTip: document.getElementById("customTip"),
  people: document.getElementById("people"),
  stepperBtns: Array.from(document.querySelectorAll(".stepper-btn[data-dir]")),
  rounding: Array.from(document.querySelectorAll('input[name="rounding"]')),
  taxPct: document.getElementById("taxPct"),
  includeTaxInTip: document.getElementById("includeTaxInTip"),
  servicePct: document.getElementById("servicePct"),
  applyService: document.getElementById("applyService"),
  copyBtn: document.getElementById("copyBtn"),
  resetBtn: document.getElementById("resetBtn"),

  outTip: document.getElementById("tipAmount"),
  outTax: document.getElementById("taxAmount"),
  outService: document.getElementById("serviceAmount"),
  outTotal: document.getElementById("totalAmount"),
  outPerPerson: document.getElementById("perPersonAmount"),
  outSummary: document.getElementById("resultsSummary"),

  year: document.getElementById("year")
};

// ======================
//   UI <-> state sync
// ======================

function deriveTipPctFromSettings(settings) {
  const custom = parseNumberLike(settings.customTip);
  if (custom > 0) return custom / 100;
  return (settings.tipPreset || 15) / 100;
}

function applySettingsToUI(settings) {
  els.tipBtns.forEach((btn) => {
    const pct = parseNumberLike(btn.dataset.tip);
    const isActive = pct === settings.tipPreset && !settings.customTip;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });

  if (els.customTip) {
    els.customTip.value = settings.customTip || "";
  }

  if (els.people) {
    els.people.value = settings.people;
  }

  els.rounding.forEach((r) => {
    r.checked = r.value === settings.rounding;
  });

  if (els.taxPct) els.taxPct.value = settings.taxPct ? settings.taxPct * 100 : "";
  if (els.includeTaxInTip) els.includeTaxInTip.checked = settings.includeTaxInTip;
  if (els.servicePct) els.servicePct.value = settings.servicePct ? settings.servicePct * 100 : "";
  if (els.applyService) els.applyService.checked = settings.applyService;
}

function settingsFromState() {
  return {
    tipPreset: state.tipPreset,
    customTip: state.customTip,
    people: state.people,
    rounding: state.rounding,
    taxPct: state.taxPct,
    includeTaxInTip: state.includeTaxInTip,
    servicePct: state.servicePct,
    applyService: state.applyService
  };
}

// ======================
//   Event handlers
// ======================

function onBillInput(e) {
  const val = e.target.value;
  const n = parseNumberLike(val);
  if (n < 0) {
    if (els.billErr) els.billErr.textContent = "Bill cannot be negative.";
    state.bill = 0;
  } else {
    if (els.billErr) els.billErr.textContent = "";
    state.bill = n;
  }
  debouncedUpdate();
}

function onTipButtonClick(e) {
  const btn = e.currentTarget;
  const pct = clamp(parseNumberLike(btn.dataset.tip), 0, 100);

  state.tipPreset = pct;
  state.customTip = "";
  state.tipPct = pct / 100;

  els.tipBtns.forEach((b) => {
    const bPct = parseNumberLike(b.dataset.tip);
    const active = bPct === pct;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });

  if (els.customTip) els.customTip.value = "";
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onCustomTipInput(e) {
  const pct = clamp(parseNumberLike(e.target.value), 0, 100);
  state.customTip = e.target.value;
  state.tipPct = pct / 100;

  els.tipBtns.forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });

  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onPeopleInput(e) {
  const n = clamp(parseNumberLike(e.target.value), 1, 20);
  state.people = n;
  e.target.value = n;
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onStepperClick(e) {
  const dir = e.currentTarget.dataset.dir;
  const delta = dir === "dec" ? -1 : 1;
  const n = clamp(state.people + delta, 1, 20);
  state.people = n;
  if (els.people) els.people.value = n;
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onRoundingChange(e) {
  state.rounding = e.target.value;
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onTaxChange(e) {
  const pct = clamp(parseNumberLike(e.target.value), 0, 100);
  state.taxPct = pct / 100;
  e.target.value = pct || "";
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onIncludeTaxToggle(e) {
  state.includeTaxInTip = !!e.target.checked;
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onServiceChange(e) {
  const pct = clamp(parseNumberLike(e.target.value), 0, 100);
  state.servicePct = pct / 100;
  e.target.value = pct || "";
  saveSettings(settingsFromState());
  debouncedUpdate();
}

function onApplyServiceToggle(e) {
  state.applyService = !!e.target.checked;
  saveSettings(settingsFromState());
  debouncedUpdate();
}

async function onCopyBreakdown() {
  const totals = computeTotals(state);
  const lines = [
    `Bill: ${formatMoney(totals.bill)}`,
    `Tax: ${formatMoney(totals.tax)}`,
    `Service: ${formatMoney(totals.service)}`,
    `Tip: ${formatMoney(totals.tip)}`,
    `Total: ${formatMoney(totals.total)}`,
    `Per person: ${formatMoney(totals.perTotal)} (for ${state.people} people)`
  ];

  const text = lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
    if (els.copyBtn) els.copyBtn.classList.add("copied");
    setTimeout(() => {
      if (els.copyBtn) els.copyBtn.classList.remove("copied");
    }, 1000);
  } catch {
    console.warn("Clipboard API failed, falling back to alert().");
    alert(text);
  }
}

function onReset() {
  state = {
    ...state,
    bill: 0
  };
  const settings = { ...defaultSettings };
  applySettingsToUI(settings);
  saveSettings(settings);
  if (els.bill) els.bill.value = "";
  debouncedUpdate();
}

// ======================
//   Rendering
// ======================

function render() {
  const totals = computeTotals(state);

  if (els.outTip) els.outTip.textContent = formatMoney(totals.tip);
  if (els.outTax) els.outTax.textContent = formatMoney(totals.tax);
  if (els.outService) els.outService.textContent = formatMoney(totals.service);
  if (els.outTotal) els.outTotal.textContent = formatMoney(totals.total);
  if (els.outPerPerson) els.outPerPerson.textContent = formatMoney(totals.perTotal);

  if (els.outSummary) {
    els.outSummary.textContent =
      `Each person pays ${formatMoney(totals.perTotal)} ` +
      `on a total of ${formatMoney(totals.total)}.`;
  }
}

// ======================
//   Init
// ======================

function initTipCalculator() {
  if (!els.bill) {
    // Script is loaded on a page without the calculator.
    return;
  }

  if (els.year) {
    els.year.textContent = String(new Date().getFullYear());
  }

  const saved = loadSettings();
  state = {
    ...state,
    ...saved,
    tipPct: deriveTipPctFromSettings(saved)
  };

  applySettingsToUI(saved);

  debouncedUpdate = debounce(render, 100);
  debouncedUpdate();

  // Wire events
  els.bill.addEventListener("input", onBillInput);
  els.tipBtns.forEach((btn) => btn.addEventListener("click", onTipButtonClick));
  if (els.customTip) els.customTip.addEventListener("input", onCustomTipInput);
  if (els.people) els.people.addEventListener("input", onPeopleInput);
  els.stepperBtns.forEach((btn) => btn.addEventListener("click", onStepperClick));
  els.rounding.forEach((r) => r.addEventListener("change", onRoundingChange));
  if (els.taxPct) els.taxPct.addEventListener("input", onTaxChange);
  if (els.includeTaxInTip) els.includeTaxInTip.addEventListener("change", onIncludeTaxToggle);
  if (els.servicePct) els.servicePct.addEventListener("input", onServiceChange);
  if (els.applyService) els.applyService.addEventListener("change", onApplyServiceToggle);

  if (els.copyBtn) els.copyBtn.addEventListener("click", onCopyBreakdown);
  if (els.resetBtn) els.resetBtn.addEventListener("click", onReset);
}

// Boot when DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTipCalculator);
  } else {
    initTipCalculator();
  }
}

// Expose helpers for tests / console
const TipCalc = {
  computeTotals,
  roundCurrency,
  clamp,
  parseNumberLike,
  formatMoney
};

if (typeof window !== "undefined") {
  window.TipCalc = TipCalc;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = TipCalc;
}

