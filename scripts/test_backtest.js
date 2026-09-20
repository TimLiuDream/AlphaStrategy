// 回测引擎逻辑单测（复刻 index.html 的 evalToken 口径）
const dayOf = ms => Math.floor(ms / 86400000);
function firstIdx(t, dayAnchor){
  let i = t.c.findIndex(c => c[0] >= dayAnchor - 1);
  if (i < 0) i = 0;
  return i;
}
function evalToken(t, mult, units, slip, dayAnchor, drop){
  const cs = t.c, i0 = firstIdx(t, dayAnchor);
  const o0 = cs[i0][1], hMax = Math.max(...cs.slice(i0).map(c => c[2])), cLast = cs[cs.length - 1][3];
  if (!(o0 > 0) || !(cLast >= 0)) return null;
  const target = mult * o0;
  const hit = hMax >= target;
  return {
    hit, lateData: cs[i0][0] - dayAnchor > 14,
    vInstant: o0 * units * (1 - slip),
    vDbl: hit ? target * units * (1 - slip) : cLast * units,
    vHold: cLast * units,
    vHalf: (o0 * (1 - slip) + cLast) * units / 2,
    multMax: hMax / o0, multNow: cLast / o0
  };
}
const D = 86400000;
let pass = 0, fail = 0;
function eq(name, got, want, tol = 1e-9){
  const ok = Math.abs(got - want) <= tol * Math.max(1, Math.abs(want));
  console.log(ok ? `  ok  ${name} = ${got}` : `  FAIL ${name}: got ${got}, want ${want}`);
  ok ? pass++ : fail++;
}
// 用例1: 翻倍达成（最高 3x 后回落到 0.5）
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
eq('lateData', r.lateData ? 1 : 0, 0); // 首根day8 vs 锚day10, 差2天
// 用例2: 未达成（挂 5x）
r = evalToken(t1, 5, 1000, 0, dayOf(t1.t), null);
console.log('用例2 未达成5x:');
eq('vDbl(按现价计值)', r.vDbl, 500);
eq('hit', r.hit ? 1 : 0, 0);
// 用例3: 滑点
r = evalToken(t1, 2, 1000, 0.02, dayOf(t1.t), null);
console.log('用例3 滑点2%:');
eq('vInstant', r.vInstant, 980);
eq('vDbl', r.vDbl, 1960);
// 用例4: 数据早于锚点（池子先于分发存在）→ 正常，lateData=0；首日取锚点后第一根
const t2 = { t: 30 * D, c: [[10, 5, 5, 5], [30, 2, 4, 3], [31, 3, 3.5, 1]] };
r = evalToken(t2, 2, 100, 0, 30, null);
console.log('用例4 锚点对齐:');
eq('首日取day30开盘2', r.vInstant / 100, 2);
eq('multMax', r.multMax, 2);          // day30 最高4 / 2
eq('lateData', r.lateData ? 1 : 0, 0);
// 用例4b: 首根K线晚于锚点2周以上 → lateData=1
const t2b = { t: 30 * D, c: [[10, 5, 5, 5], [50, 2, 4, 3]] };
r = evalToken(t2b, 2, 100, 0, 30, null);
eq('lateData(数据来晚)', r.lateData ? 1 : 0, 1);
// 用例5: 无K线在锚点后 → 回退第一根
const t3 = { t: 40 * D, c: [[10, 5, 5, 5], [11, 5, 6, 5]] };
r = evalToken(t3, 2, 100, 0, 40, null);
eq('回退首根', r.vInstant / 100, 5);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
