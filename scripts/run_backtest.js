// Run the same engine as the page, with its default settings.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { decodeSnapshot } = require('./snapshot_codec');
const { runBacktest } = require('./backtest_engine');
const data = decodeSnapshot(JSON.parse(fs.readFileSync(path.join(root, 'data', 'snapshot.json'), 'utf8')));
const defaults = { mult: 2, slip: 0.01, claimUsd: 0.1, sellUsd: 0.05, y2025: true, y2026: true, chain: '', onlyCex: false };
const bt = runBacktest(data, defaults);
const total = key => bt.rows.reduce((sum, r) => sum + r[key], 0);
const held = [...bt.rows].sort((a, b) => b.vHold - a.vHold);
const report = {
  snapshotDate: data.snapshotDate,
  generatedAt: data.generatedAt,
  settings: { targetMultiple: bt.mult, slippage: bt.slip, claimFeeUSD: bt.claimUsd, sellFeeUSD: bt.sellUsd },
  coverage: data.stats,
  rounds: bt.rows.length,
  dateRange: [bt.rows[0]?.drop.d, bt.rows.at(-1)?.drop.d],
  totalsUSD: { instant: total('vInstant'), target: total('vDbl'), hold: total('vHold'), half: total('vHalf') },
  targetHits: bt.rows.filter(r => r.hit).length,
  lateDataRounds: bt.rows.filter(r => r.lateData).length,
  refreshedTokens: data.tokens.filter(t => t.fetchedAt && t.fetchedAt.slice(0, 10) === data.snapshotDate).length,
  staleCandleTokens: data.tokens.filter(t => t.c.at(-1)[0] < Math.floor(new Date(data.snapshotDate).getTime() / 86400000) - 7).map(t => ({ symbol: t.s, lastCandle: new Date(t.c.at(-1)[0] * 86400000).toISOString().slice(0, 10) })),
  latestCandleDate: new Date(data.tokens.reduce((latest, t) => t.c.reduce((a, c) => Math.max(a, c[0]), latest), 0) * 86400000).toISOString().slice(0, 10),
  top5HoldShare: total('vHold') ? held.slice(0, 5).reduce((sum, r) => sum + r.vHold, 0) / total('vHold') : 0,
  top5Hold: held.slice(0, 5).map(r => ({ symbol: r.t.s, date: r.drop.d, valueUSD: r.vHold })),
};
const allTokens = data.tokens;
data.tokens = allTokens.filter(t => t.fetchedAt?.slice(0, 10) === data.snapshotDate);
const fresh = runBacktest(data, defaults);
report.refreshedOnly = {
  rounds: fresh.rows.length,
  targetHits: fresh.rows.filter(r => r.hit).length,
  lateDataRounds: fresh.rows.filter(r => r.lateData).length,
  totalsUSD: Object.fromEntries([['instant', 'vInstant'], ['target', 'vDbl'], ['hold', 'vHold'], ['half', 'vHalf']].map(([name, key]) => [name, fresh.rows.reduce((sum, r) => sum + r[key], 0)])),
};
const snapshotDay = Math.floor(new Date(data.snapshotDate).getTime() / 86400000);
const covered = fresh.rows.filter(r => Math.abs(r.t.c[r.i0][0] - r.anchor) <= 1 && r.t.c.at(-1)[0] >= snapshotDay - 1);
report.firstDayCovered = {
  criteria: 'Successfully refreshed; first candle within one day of distribution; last candle within one day of snapshot',
  rounds: covered.length,
  targetHits: covered.filter(r => r.hit).length,
  totalsUSD: Object.fromEntries([['instant', 'vInstant'], ['target', 'vDbl'], ['hold', 'vHold'], ['half', 'vHalf']].map(([name, key]) => [name, covered.reduce((sum, r) => sum + r[key], 0)])),
};
data.tokens = allTokens;
fs.writeFileSync(path.join(root, 'data', 'backtest_results.json'), JSON.stringify(report, null, 2) + '\n');
require('./build_public_content')(report);
console.log(JSON.stringify(report, null, 2));
