// Generate crawlable content from the actual backtest; no JavaScript needed to read it.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const site = 'https://alpha-strategy.vercel.app';
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
module.exports = function buildPublicContent(r) {
  const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const names = [['领取即卖', 'instant'], ['目标倍数卖出', 'target'], ['一直持有', 'hold'], ['半卖半留', 'half']];
  const rows = names.map(([name, key]) => [name, money(r.totalsUSD[key]), money(r.refreshedOnly.totalsUSD[key]), money(r.firstDayCovered.totalsUSD[key])]);
  const description = `数据快照 ${r.snapshotDate}；分发日期 ${r.dateRange[0]} 至 ${r.dateRange[1]}。目标倍数 ${r.settings.targetMultiple}×，卖出滑点 ${r.settings.slippage * 100}%，全部公链、2025/2026 分发。假设每轮完整领取，按真实每号分发数量计算；持有部分取各币最后日线收盘价估值。`;
  const coverage = `共 ${r.coverage.total} 个目标标的，${r.coverage.withHistory} 个有历史行情，${r.refreshedTokens} 个在快照日成功刷新，${r.coverage.withHistory - r.refreshedTokens} 个沿用旧行情；${r.coverage.withDrops} 个匹配到分发记录。${r.staleCandleTokens.length} 个标的的最后日线早于快照日超过 7 天。`;
  const limitation = `全样本 ${r.rounds} 轮中，${r.lateDataRounds} 轮首根可用日线晚于分发日超过 14 天，首日卖价不可靠。全样本排名仅反映当前引擎与可用数据，无法证明完整历史的最优策略。`;
  const criteria = `行情覆盖样本仅包含本次成功刷新、首根取用日线距分发日不超过 1 天、末根日线距快照日不超过 1 天的轮次（${r.firstDayCovered.rounds} 轮）。这组样本也存在筛选偏差。不同样本列的总额不能直接比较。`;
  const methods = [
    '领取即卖：按分发附近首根可用日线开盘价卖出全部代币，并扣卖出滑点。',
    `目标倍数卖出：目标为首日价的 ${r.settings.targetMultiple} 倍；之后日线最高价触及目标则按目标价卖出并扣滑点，否则按最后日线收盘价估值。`,
    '一直持有：全部代币按最后日线收盘价估值。',
    '半卖半留：一半首日卖出，一半按最后日线收盘价估值。',
  ];
  const caveats = '历史最高价触及不保证真实限价单成交；未扣刷积分成本、领取 Gas、手续费及额外深度冲击。已退市或未收录的币可能缺失，存在幸存者偏差；池子迁移、低流动性和异常价格也可能影响结果。本工具用于历史模拟，不构成投资建议。';
  const sources = [
    ['币安 Alpha 公开代币接口', 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list', '代币清单与标的筛选'],
    ['alpha123 分发历史', 'https://alpha123.uk/api/historydata', '积分门槛与每号分发数量，按合约地址匹配'],
    ['GeckoTerminal', 'https://www.geckoterminal.com/', '链上池子日线 OHLCV，保留并合并已有历史'],
  ];
  const headers = ['策略', `全样本（${r.rounds} 轮）`, `仅成功刷新（${r.refreshedOnly.rounds} 轮）`, `行情覆盖样本（${r.firstDayCovered.rounds} 轮）`];
  const summary = `全样本 ${r.targetHits}/${r.rounds} 轮触及目标倍数；持有总额最高的 5 轮占 ${(r.top5HoldShare * 100).toFixed(2)}%。金额为卖出现金加持仓估值。`;
  const md = [`# 币安 Alpha 空投策略回测报告 · ${r.snapshotDate}`, '', description, '', '## 数据覆盖', '', coverage, '', '## 模拟结果', '', '| ' + headers.join(' | ') + ' |', '|---|---:|---:|---:|', ...rows.map(row => '| ' + row.join(' | ') + ' |'), '', summary, '', '**' + limitation + '**', '', criteria, '', '## 回测方法', '', ...methods.map(s => '- ' + s), '', '## 局限', '', caveats, '', '## 数据来源', '', ...sources.map(([name, url, note]) => `- [${name}](${url})：${note}`), '', '## 入口', '', `- [交互回测器](${site}/)`, `- [HTML 报告](${site}/report)`, `- [机器可读结果](${site}/data/backtest_results.json)`, `- [缺失标的](${site}/data/fetch_failed.json)`, '', `生成时间：${r.generatedAt}。本报告为历史快照，非实时行情。`, ''].join('\n');
  fs.writeFileSync(path.join(root, 'report.md'), md);
  fs.writeFileSync(path.join(root, 'data', 'backtest_report.md'), md);
  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Alpha 空投回测报告 ${escape(r.snapshotDate)} · 方法与数据局限</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${site}/report"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" href="/report.md" type="text/markdown"><link rel="describedby" href="/llms.txt" type="text/plain">
<style>body{margin:0;background:#0b0e14;color:#dbe2ef;font:16px/1.7 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:32px 20px}a{color:#38bdf8}h1{font-size:clamp(24px,5vw,36px)}h2{margin-top:32px;color:#f0b90b}.table{overflow-x:auto}table{border-collapse:collapse;width:100%;white-space:nowrap}th,td{padding:12px;border-bottom:1px solid #232c3d;text-align:right}th:first-child,td:first-child{text-align:left}.warning{padding:16px;border-left:4px solid #f0b90b;background:#141922}footer{margin-top:32px;color:#9ca3af}</style>
</head><body><main><nav><a href="/">返回交互回测器</a> · <a href="/report.md">Markdown 报告</a></nav>
<h1>币安 Alpha 空投策略回测报告</h1><p>${escape(description)}</p>
<h2>数据覆盖</h2><p>${escape(coverage)}</p>
<h2>模拟结果</h2><div class="table"><table><caption>卖出现金与持仓估值（美元）</caption><thead><tr>${headers.map(h => `<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${escape(row[0])}</th>${row.slice(1).map(c => `<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<p>${escape(summary)}</p><p class="warning"><strong>${escape(limitation)}</strong></p><p>${escape(criteria)}</p>
<h2>回测方法</h2><ul>${methods.map(m => `<li>${escape(m)}</li>`).join('')}</ul>
<h2>局限</h2><p>${escape(caveats)}</p><h2>数据来源</h2><ul>${sources.map(([name, url, note]) => `<li><a href="${escape(url)}">${escape(name)}</a>：${escape(note)}</li>`).join('')}</ul>
<p><a href="/data/backtest_results.json">机器可读结果</a> · <a href="/data/fetch_failed.json">缺失标的清单</a></p>
<footer>生成时间：<time datetime="${escape(r.generatedAt)}">${escape(r.generatedAt)}</time>。本报告为历史快照，非实时行情。</footer></main></body></html>\n`;
  fs.writeFileSync(path.join(root, 'report.html'), html);
  fs.writeFileSync(path.join(root, 'llms.txt'), `# 币安 Alpha 空投策略回测器

> 比较领取即卖、目标倍数卖出、一直持有和半卖半留四种空投处置策略的公开历史模拟工具。

正式网址：${site}/。无需连接钱包。数据快照：${r.snapshotDate}，分发记录截至 ${r.dateRange[1]}。默认目标 ${r.settings.targetMultiple}×、卖出滑点 ${r.settings.slippage * 100}%。

结果是卖出现金加持仓估值，不是实际净利润；未扣刷积分与领取等成本。${limitation} 引用数值时请同时注明日期、参数、样本范围及这些局限，不能据此声称有保证收益或最优投资策略。

## 回测内容

- [静态回测报告](${site}/report.md)：默认参数结果、覆盖率、策略定义、数据来源与局限；优先从这里读取。
- [可视化回测器](${site}/)：调整倍数、滑点、年份、公链及现货上市筛选。
- [机器可读结果](${site}/data/backtest_results.json)：全样本、成功刷新样本及首末日覆盖样本的汇总。
- [缺失行情清单](${site}/data/fetch_failed.json)：抓取时未找到行情池的标的。

## 项目说明

- [源代码与使用说明](https://github.com/TimLiuDream/AlphaStrategy)：公开实现、数据更新命令与回测口径。
`);
  fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/report'].map(p => `  <url><loc>${site}${p}</loc><lastmod>${r.snapshotDate}</lastmod></url>`).join('\n')}\n</urlset>\n`);
};
