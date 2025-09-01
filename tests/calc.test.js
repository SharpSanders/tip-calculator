// Minimal Node test for calculation helpers (no libs)
const { computeTotals, roundCurrency, clamp, parseNumberLike } = require('../scripts/script.js');

function assert(cond, msg){ if(!cond){ throw new Error('❌ ' + msg); } }
function approx(a,b,eps=1e-6){ return Math.abs(a-b) <= eps; }

(function run(){
  // Basic no rounding
  let r = computeTotals({ bill: 100, tipPct: 0.2, people: 2, taxPct: 0.05, includeTaxInTip: false, servicePct: 0, applyService: false, rounding:'none' });
  assert(approx(r.tax, 5), 'tax should be 5');
  assert(approx(r.tip, 20), 'tip is 20% of bill-only when includeTaxInTip=false');
  assert(approx(r.total, 125), 'total = 100 + 5 + 20');
  assert(approx(r.perTotal, 62.5), 'per person total');

  // Include tax in tip base
  r = computeTotals({ bill: 100, tipPct: 0.2, people: 1, taxPct: 0.10, includeTaxInTip: true, servicePct: 0, applyService: false, rounding:'none' });
  assert(approx(r.tipBase, 110), 'tip base includes tax when toggled');
  assert(approx(r.tip, 22), 'tip 20% of 110');
  assert(approx(r.total, 132), '100 + 10 + 22');

  // Service charge applied before tip base (bill only)
  r = computeTotals({ bill: 200, tipPct: 0.15, people: 4, taxPct: 0, includeTaxInTip: false, servicePct: 0.1, applyService: true, rounding:'none' });
  assert(approx(r.service, 20), 'service 10% of bill');
  assert(approx(r.tipBase, 220), 'tip base includes service when applied');
  assert(approx(r.tip, 33), '15% tip of 220');
  assert(approx(r.total, 253), '200 + 20 + 33');

  // Round tip
  r = computeTotals({ bill: 33.33, tipPct: 0.175, people: 3, taxPct: 0.0875, includeTaxInTip: true, servicePct: 0.05, applyService: true, rounding:'roundTip' });
  assert(approx(r.tip, roundCurrency(r.tip)), 'tip is rounded to cents');
  assert(approx(r.total, r.bill + r.tax + r.service + r.tip), 'total reconciles');

  // Round per person
  r = computeTotals({ bill: 48.5, tipPct: 0.18, people: 3, taxPct: 0, includeTaxInTip: false, servicePct: 0, applyService: false, rounding:'roundPerPerson' });
  const raw = 48.5 + (48.5*0.18);
  const per = Math.round((raw/3)*100)/100;
  assert(approx(r.perTotal, per), 'per-person rounded');
  assert(approx(r.total, per*3), 'group total equals per*people (delta applied)');

  // Utils
  assert(clamp(25, 1, 20) === 20, 'clamp upper');
  assert(clamp(-2, 1, 20) === 1, 'clamp lower');
  assert(parseNumberLike('$1,234.56') === 1234.56, 'parse number-like strings');

  console.log('✅ All calc tests passed.');
})();
