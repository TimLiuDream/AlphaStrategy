// 回测引擎。页面、scripts/test_backtest.js、scripts/run_backtest.js 共用这一份。
// 固定成本：每轮领取扣 claimUsd；只有真实卖出才扣 sellUsd（未成交的限价单、以及一直持有，不扣）。
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.BacktestEngine = api;
})(function () {
  function finiteOr(v, fallback) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function nonNeg(v) {
    const n = finiteOr(v, 0);
    return n > 0 ? n : 0;
  }
  function firstIdxFrom(t, dayAnchor) {
    let i = t.c.findIndex(c => c[0] >= dayAnchor - 1);
    if (i < 0) i = 0;
    return i;
  }
  function evalToken(t, mult, units, slip, dayAnchor, drop, claimUsd, sellUsd) {
    const cs = t.c, i0 = firstIdxFrom(t, dayAnchor);
    const o0 = cs[i0][1], hMax = Math.max(...cs.slice(i0).map(c => c[2])), cLast = cs[cs.length - 1][3];
    if (!(o0 > 0) || !(cLast >= 0)) return null;
    claimUsd = nonNeg(claimUsd);
    sellUsd = nonNeg(sellUsd);
    const target = mult * o0;
    const hit = hMax >= target;
    const grossInstant = o0 * units * (1 - slip);
    const grossTarget = target * units * (1 - slip);
    const grossHold = cLast * units;
    return {
      t, i0, o0, hMax, cLast, drop, anchor: dayAnchor,
      hit,
      lateData: cs[i0][0] - dayAnchor > 14,
      vInstant: grossInstant - claimUsd - sellUsd,
      vDbl: (hit ? grossTarget : grossHold) - claimUsd - (hit ? sellUsd : 0),
      vHold: grossHold - claimUsd,
      vHalf: (grossInstant + grossHold) / 2 - claimUsd - sellUsd,
      multMax: hMax / o0,
      multNow: cLast / o0
    };
  }
  function runBacktest(data, opts) {
    opts = opts || {};
    const mult = finiteOr(opts.mult, 2);
    const slip = finiteOr(opts.slip, 0);
    const claimUsd = nonNeg(opts.claimUsd);
    const sellUsd = nonNeg(opts.sellUsd);
    const y25 = opts.y2025 !== false;
    const y26 = opts.y2026 !== false;
    const ch = opts.chain || '';
    const onlyCex = !!opts.onlyCex;
    const rows = [];
    for (const t of data.tokens) {
      if (!t.drops.length) continue;
      if (ch && t.ch !== ch) continue;
      if (onlyCex && !t.cex) continue;
      for (const dp of t.drops) {
        const anchor = Math.floor(new Date(dp.d + 'T00:00:00Z').getTime() / 86400000);
        if (!isFinite(anchor)) continue;
        const yd = new Date(anchor * 86400000).getFullYear();
        if (yd === 2025 && !y25) continue;
        if (yd === 2026 && !y26) continue;
        if (dp.amt == null || dp.amt <= 0) continue;
        const r = evalToken(t, mult, dp.amt, slip, anchor, dp, claimUsd, sellUsd);
        if (r) rows.push(r);
      }
    }
    rows.sort((a, b) => a.anchor - b.anchor);
    return { mult, slip, claimUsd, sellUsd, rows };
  }
  return { firstIdxFrom, evalToken, runBacktest };
});
