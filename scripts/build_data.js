// 合成网站数据 ../data.js: window.ALPHA_DATA = {...}
// 来源1: data/alpha_tokens_raw.json (币安 Alpha 全量列表: 期次/合约/当前价)
// 来源2: data/alpha_history.ndjson        (GeckoTerminal 日K)
// 来源3: data/alpha123_history_raw.json   (alpha123.uk 历史分发记录: 积分门槛+每号数量, 按合约匹配)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'alpha_tokens_raw.json'), 'utf8')).data;

// alpha123 分发记录: 合约(小写) -> [{date, pts, amt}]
const dropsByAddr = new Map();
try {
  const al = JSON.parse(fs.readFileSync(path.join(DATA, 'alpha123_history_raw.json'), 'utf8')).airdrops;
  for (const x of al) {
    const ca = String(x.contract_address || '').toLowerCase();
    if (!ca) continue;
    const pts = parseInt(String(x.points).split(/\s+/)[0], 10); // 多档取主档
    const amt = parseFloat(String(x.amount).replace(/,/g, ''));
    if (!dropsByAddr.has(ca)) dropsByAddr.set(ca, []);
    dropsByAddr.get(ca).push({ d: x.date, pts: isFinite(pts) ? pts : null, amt: isFinite(amt) ? amt : null });
  }
  for (const arr of dropsByAddr.values()) arr.sort((a, b) => a.d.localeCompare(b.d));
} catch (e) { console.log('alpha123 merge skipped:', e.message); }

const tokens = [];
const seen = new Set();
const lines = fs.readFileSync(path.join(DATA, 'alpha_history.ndjson'), 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  try {
    const r = JSON.parse(line);
    if (!r.candles || r.candles.length < 2) continue;
    if (seen.has(r.symbol + '@' + r.contract)) continue;
    seen.add(r.symbol + '@' + r.contract);
    const cexCoinName = r.cexCoinName || (raw.find(x => x.symbol === r.symbol && x.contractAddress.toLowerCase() === String(r.contract).toLowerCase()) || {}).cexCoinName || '';
    tokens.push({
      s: r.symbol, n: r.name, ch: r.chain, a: r.contract,
      t: r.listingTime, cex: !!r.listingCex, cexn: cexCoinName,
      pn: parseFloat(r.priceNow),
      fetchedAt: r.fetchedAt || null,
      drops: dropsByAddr.get(String(r.contract).toLowerCase()) || [],
      c: r.candles.filter(b => b[1] > 0 && b[2] > 0 && b[3] != null).map(b => [Math.round(b[0] * 1000 / 86400000), // 秒→天序号 (epoch days)
        parseFloat(Number(b[1]).toPrecision(6)),
        parseFloat(Number(b[2]).toPrecision(6)),
        parseFloat(Number(b[3]).toPrecision(6))])
    });
  } catch (e) { console.log('bad line', e.message); }
}
tokens.sort((x, y) => x.t - y.t);

const out = {
  generatedAt: new Date().toISOString(),
  snapshotDate: new Date().toISOString().slice(0, 10),
  sources: [
    '币安 Alpha 全量代币列表 (binance.com bapi 公开接口)',
    'GeckoTerminal 日线 OHLCV (api.geckoterminal.com)',
    'alpha123.uk /api/historydata 历史分发记录 (积分门槛+每号数量)'
  ],
  tokens,
  stats: { total: raw.filter(t => t.onlineAirdrop || t.onlineTge).length, withHistory: tokens.length, withDrops: tokens.filter(t => t.drops.length).length }
};
fs.writeFileSync(path.join(ROOT, 'data.js'), 'window.ALPHA_DATA=' + JSON.stringify(out) + ';');
console.log(`tokens=${tokens.length}/${out.stats.total}, withDrops=${out.stats.withDrops}, file: ${(fs.statSync(path.join(ROOT, 'data.js')).size / 1048576).toFixed(2)} MB`);
const failed = fs.existsSync(path.join(DATA, 'fetch_failed.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'fetch_failed.json'), 'utf8')) : [];
console.log('fetch failed:', failed.length);
