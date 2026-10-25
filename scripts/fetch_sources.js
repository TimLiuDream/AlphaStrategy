// 刷新回测上游的两份公开清单。任一端失败都保留已有文件，不中断后续行情抓取。
// 用法: node scripts/fetch_sources.js
const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, '..', 'data');
const SOURCES = [
  {
    name: 'binance-alpha-tokens',
    url: 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list',
    file: path.join(DATA, 'alpha_tokens_raw.json'),
    valid: j => j && j.success !== false && Array.isArray(j.data) && j.data.length >= 100 && j.data.filter(t => t && t.symbol && t.contractAddress).length >= j.data.length * 0.95
  },
  {
    name: 'alpha123-history',
    url: 'https://alpha123.uk/api/historydata',
    file: path.join(DATA, 'alpha123_history_raw.json'),
    valid: j => j && Array.isArray(j.airdrops) && j.airdrops.length >= 50 && j.airdrops.filter(x => x && x.date && x.contract_address).length >= j.airdrops.length * 0.95
  }
];

function writeJson(file, obj) {
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const pretty = prev.includes('\n  ');
  const text = (pretty ? JSON.stringify(obj, null, 4) : JSON.stringify(obj)) + (pretty || prev.endsWith('\n') ? '\n' : '');
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

async function pull(src) {
  const hasPrev = fs.existsSync(src.file);
  try {
    const res = await fetch(src.url, {
      headers: { Accept: 'application/json', 'User-Agent': 'AlphaStrategyDataRefresh/1.0' },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    if (!src.valid(json)) throw new Error('unexpected payload');
    writeJson(src.file, json);
    console.log(`[ok] ${src.name}`);
    return true;
  } catch (e) {
    console.log(`[keep] ${src.name}: ${e.message}${hasPrev ? ' (previous file kept)' : ''}`);
    if (!hasPrev) throw e;
    return false;
  }
}

(async () => {
  let hardFail = 0;
  for (const src of SOURCES) {
    try { await pull(src); }
    catch (e) { console.error(`[fatal] ${src.name}: ${e.message}`); hardFail++; }
  }
  process.exit(hardFail ? 1 : 0);
})();
