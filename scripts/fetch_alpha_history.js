// 批量抓取币安 Alpha 空投币的日 K 历史（GeckoTerminal 公共 API，限流约 30 req/min）
// 用法: node scripts/fetch_alpha_history.js   （在项目根运行或任意目录，路径基于本文件）
// 输出: data/alpha_history.ndjson (每行一个币) + data/fetch_failed.json
// 支持断点续传: 已抓的 symbol 记在 data/fetch_done.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const raw = JSON.parse(fs.readFileSync(path.join(DATA, 'alpha_tokens_raw.json'), 'utf8')).data;
const NET = { BSC: 'bsc', Base: 'base', Ethereum: 'eth', Arbitrum: 'arbitrum', Solana: 'solana', Sui: 'sui-network', Linea: 'linea', Sonic: 'sonic' };
const targets = raw.filter(t => (t.onlineAirdrop || t.onlineTge) && NET[t.chainName]);
console.log(`targets: ${targets.length}`);

const doneSet = new Set();
const doneFile = path.join(DATA, 'fetch_done.json');
if (fs.existsSync(doneFile)) JSON.parse(fs.readFileSync(doneFile, 'utf8')).forEach(s => doneSet.add(s));
const todo = targets.filter(t => !doneSet.has(t.symbol + '@' + t.contractAddress));
console.log(`todo: ${todo.length} (done: ${doneSet.size})`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries = 6) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (res.status === 429 || res.status >= 500) { console.log(`  ${res.status}, backoff 65s`); await sleep(65000); continue; }
      if (res.status === 404) return null;
      if (!res.ok) { console.log(`  http ${res.status}, backoff 15s`); await sleep(15000); continue; }
      return await res.json();
    } catch (e) { console.log(`  ${e.message}, backoff 15s`); await sleep(15000); }
  }
  return undefined; // 彻底失败
}

const ndjson = fs.createWriteStream(path.join(DATA, 'alpha_history.ndjson'), { flags: 'a' });
const failed = [];

async function main() {
  // 阶段一: 按 (链, 30地址一批) 调 multi 端点拿 top pool
  const groups = new Map();
  for (const t of todo) {
    const net = NET[t.chainName];
    if (!groups.has(net)) groups.set(net, []);
    groups.get(net).push(t);
  }
  const poolMap = new Map(); // `${net}:${addr}` -> pool address
  for (const [net, list] of groups) {
    for (let i = 0; i < list.length; i += 30) {
      const batch = list.slice(i, i + 30);
      const addrs = batch.map(t => t.contractAddress).join(',');
      const j = await get(`https://api.geckoterminal.com/api/v2/networks/${net}/tokens/multi/${addrs}?include=top_pools`);
      if (j && j.data) {
        for (const tk of j.data) {
          const rel = tk.relationships && tk.relationships.top_pools && tk.relationships.top_pools.data;
          if (rel && rel[0]) {
            const pid = rel[0].id; // net_0x...
            const addr = pid.slice(pid.indexOf('_') + 1);
            poolMap.set(`${net}:${tk.id.split('_').pop()}`, addr);
          }
        }
        console.log(`[pools] ${net} batch ${Math.floor(i / 30) + 1}: +${j.data.length}`);
      } else { console.log(`[pools] ${net} batch ${Math.floor(i / 30) + 1}: FAIL`); await sleep(3000); }
      await sleep(3400);
    }
  }
  console.log(`poolMap size: ${poolMap.size}`);

  // 阶段二: 逐池拉日 K
  let n = 0;
  for (const t of todo) {
    const net = NET[t.chainName];
    const key = `${net}:${t.contractAddress.toLowerCase()}`;
    const pool = poolMap.get(key) || poolMap.get(`${net}:${t.contractAddress}`);
    n++;
    if (!pool) { failed.push({ symbol: t.symbol, chain: t.chainName, reason: 'no_pool' }); console.log(`[${n}/${todo.length}] ${t.symbol} NO POOL`); continue; }
    const j = await get(`https://api.geckoterminal.com/api/v2/networks/${net}/pools/${pool}/ohlcv/day?aggregate=1&limit=1000&currency=usd`);
    if (j === null) { failed.push({ symbol: t.symbol, chain: t.chainName, reason: 'no_ohlcv' }); console.log(`[${n}/${todo.length}] ${t.symbol} NO OHLCV`); }
    else if (j === undefined) { failed.push({ symbol: t.symbol, chain: t.chainName, reason: 'request_failed' }); console.log(`[${n}/${todo.length}] ${t.symbol} REQ FAIL`); }
    else {
      const bars = j.data.attributes.ohlcv_list; // [ts,o,h,l,c,vol] 倒序
      const candles = bars.map(b => [b[0], b[1], b[2], b[4]]).sort((a, b) => a[0] - b[0]);
      const rec = { symbol: t.symbol, name: t.name, chain: t.chainName, contract: t.contractAddress, listingTime: t.listingTime, listingCex: !!t.listingCex, cexCoinName: t.cexCoinName || '', priceNow: t.price, candles };
      ndjson.write(JSON.stringify(rec) + '\n');
      console.log(`[${n}/${todo.length}] ${t.symbol} bars=${candles.length}`);
      doneSet.add(t.symbol + '@' + t.contractAddress);
      fs.writeFileSync(doneFile, JSON.stringify([...doneSet]));
    }
    await sleep(3400);
  }
  ndjson.end();
  fs.writeFileSync(path.join(DATA, 'fetch_failed.json'), JSON.stringify(failed, null, 1));
  console.log(`ALL DONE. ok=${todo.length - failed.length} failed=${failed.length}`);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
