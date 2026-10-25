// 回测引擎与快照编解码单测。引擎口径以 scripts/backtest_engine.js 为准（页面同样引用它）。
const fs = require('fs');
const path = require('path');
const { evalToken, runBacktest } = require('./backtest_engine');
const { encodeSnapshot, decodeSnapshot } = require('./snapshot_codec');
const dayOf = ms => Math.floor(ms / 86400000);
const D = 86400000;
let pass = 0, fail = 0;
function eq(name, got, want, tol = 1e-9) {
  const ok = typeof want === 'number'
    ? Math.abs(got - want) <= tol * Math.max(1, Math.abs(want))
    : got === want;
  console.log(ok ? `  ok  ${name} = ${got}` : `  FAIL ${name}: got ${got}, want ${want}`);
  ok ? pass++ : fail++;
}
function sameJson(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? `  ok  ${name}` : `  FAIL ${name}`);
  ok ? pass++ : fail++;
}

const t1 = { t: 10 * D, c: [[8, 0.9, 1, 0.9], [10, 1, 2, 1.5], [11, 1.5, 3, 1.2], [12, 1.2, 1.3, 0.5]] };
let r = evalToken(t1, 2, 1000, 0, dayOf(t1.t), null);
console.log('用例1 达成翻倍:');
eq('vInstant', r.vInstant, 1000);
eq('vDbl(成交@2x)', r.vDbl, 2000);
eq('vHold', r.vHold, 500);
eq('vHalf', r.vHalf, 750);
eq('hit', r.hit ? 1 : 0, 1);
eq('multMax', r.multMax, 3);
eq('multNow', r.multNow, 0.5);
eq('lateData', r.lateData ? 1 : 0, 0);
r = evalToken(t1, 5, 1000, 0, dayOf(t1.t), null);
console.log('用例2 未达成5x:');
eq('vDbl(按现价计值)', r.vDbl, 500);
eq('hit', r.hit ? 1 : 0, 0);
r = evalToken(t1, 2, 1000, 0.02, dayOf(t1.t), null);
console.log('用例3 滑点2%:');
eq('vInstant', r.vInstant, 980);
eq('vDbl', r.vDbl, 1960);
const t2 = { t: 30 * D, c: [[10, 5, 5, 5], [30, 2, 4, 3], [31, 3, 3.5, 1]] };
r = evalToken(t2, 2, 100, 0, 30, null);
console.log('用例4 锚点对齐:');
eq('首日取day30开盘2', r.vInstant / 100, 2);
eq('multMax', r.multMax, 2);
eq('lateData', r.lateData ? 1 : 0, 0);
const t2b = { t: 30 * D, c: [[10, 5, 5, 5], [50, 2, 4, 3]] };
r = evalToken(t2b, 2, 100, 0, 30, null);
eq('lateData(数据来晚)', r.lateData ? 1 : 0, 1);
const t3 = { t: 40 * D, c: [[10, 5, 5, 5], [11, 5, 6, 5]] };
r = evalToken(t3, 2, 100, 0, 40, null);
eq('回退首根', r.vInstant / 100, 5);

console.log('用例6 固定成本:');
r = evalToken(t1, 2, 1000, 0, dayOf(t1.t), null, 0.1, 0.05);
eq('vInstant 扣领取+卖出', r.vInstant, 999.85);
eq('vDbl 成交扣两笔', r.vDbl, 1999.85);
eq('vHold 只扣领取', r.vHold, 499.9);
eq('vHalf 卖出成本只扣一次', r.vHalf, 749.85);
r = evalToken(t1, 5, 1000, 0, dayOf(t1.t), null, 0.1, 0.05);
eq('未成交不扣卖出成本', r.vDbl, 499.9);
r = evalToken(t1, 2, 1000, 0.02, dayOf(t1.t), null, 0.1, 0.05);
eq('滑点与固定成本叠加', r.vInstant, 979.85);
r = evalToken(t1, 2, 1000, 0, dayOf(t1.t), null, -5, 'nope');
eq('非法成本当 0', r.vInstant, 1000);

console.log('用例7 每轮各扣一次:');
const mini = {
  tokens: [{
    s: 'T', n: 'T', ch: 'BSC', cex: false, cexn: '',
    drops: [{ d: '2026-01-10', pts: 1, amt: 100 }, { d: '2026-02-10', pts: 2, amt: 100 }],
    c: [[20463, 1, 1.5, 1], [20494, 2, 3, 1]]
  }]
};
const bt = runBacktest(mini, { mult: 2, slip: 0, claimUsd: 0.2, sellUsd: 0.1, y2025: true, y2026: true });
eq('两轮都计入', bt.rows.length, 2);
eq('立刻卖合计', bt.rows.reduce((s, row) => s + row.vInstant, 0), 299.4);
eq('不卖合计', bt.rows.reduce((s, row) => s + row.vHold, 0), 199.6);
eq('第一轮翻倍成交', bt.rows[0].hit ? 1 : 0, 1);
eq('第二轮未到 2x', bt.rows[1].hit ? 1 : 0, 0);

console.log('用例8 快照往返:');
const sample = {
  generatedAt: '2026-01-01T00:00:00.000Z',
  snapshotDate: '2026-01-01',
  sources: ['s'],
  stats: { total: 2, withHistory: 2, withDrops: 1 },
  tokens: [
    {
      s: 'BID', n: 'CreatorBid', ch: 'BSC', a: '0xabc', t: 1, cex: false, cexn: '', pn: 0.1,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      drops: [{ d: '2026-01-02', pts: 10, amt: 5 }],
      c: [[20533, 0.00780973, 0.00780973, 0.00751903], [20535, 1.5, 2, 0]]
    },
    {
      s: 'MCH', n: 'Wide', ch: 'BSC', a: '0xdef', t: 2, cex: true, cexn: 'MCH', pn: 1,
      fetchedAt: null,
      drops: [],
      c: [[20000, 1.44387e-20, 2e-20, 1e-20], [20001, 0.0000914403, 0.0001, 0.00008]]
    }
  ]
};
const decoded = decodeSnapshot(encodeSnapshot(sample));
sameJson('普通K线', decoded.tokens[0].c, sample.tokens[0].c);
sameJson('极宽价格保留原值', decoded.tokens[1].c, sample.tokens[1].c);
eq('cex 与名称', decoded.tokens[1].cex ? 1 : 0, 1);
eq('cexn', decoded.tokens[1].cexn, 'MCH');
eq('空 cexn', decoded.tokens[0].cexn, '');
sameJson('分发记录', decoded.tokens[0].drops, sample.tokens[0].drops);
const snapPath = path.join(__dirname, '..', 'data', 'snapshot.json');
if (fs.existsSync(snapPath)) {
  const live = decodeSnapshot(JSON.parse(fs.readFileSync(snapPath, 'utf8')));
  const again = decodeSnapshot(encodeSnapshot(live));
  let mismatch = 0;
  for (let i = 0; i < live.tokens.length; i++) {
    if (JSON.stringify(live.tokens[i].c) !== JSON.stringify(again.tokens[i].c)) mismatch++;
    if (live.tokens[i].s !== again.tokens[i].s || live.tokens[i].a !== again.tokens[i].a) mismatch++;
  }
  eq('已提交快照K线往返差异', mismatch, 0);
  eq('快照币数', live.tokens.length, live.stats.withHistory);
} else {
  console.log('  skip 尚无 data/snapshot.json');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
