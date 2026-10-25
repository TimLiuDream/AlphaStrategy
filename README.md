# 币安 Alpha 空投策略回测器

## 联系方式

- Telegram：[@dreamtimliu](https://t.me/dreamtimliu)（**交流与合作首选**）
- GitHub：[TimLiuDream](https://github.com/TimLiuDream)
- X：[@timliu92](https://x.com/timliu92)
- 微信：liufotian1992

假设每一轮币安 Alpha 空投分发你都完整抢到（数量按 alpha123.uk 记录的真实每号分发量），回测四种处置策略的账户总额：

- **策略A · 领取即卖**：领取当天按首日开盘价全部卖出
- **策略B · 翻倍卖**：领取即挂 N× 限价单（默认 2×，可调 1.5/2/3/5），触及则成交，未触及按现价计值
- **策略C · 一直不卖**：持有至今，按数据快照日现价估值
- **策略D · 半卖半持**：一半首日卖出 + 一半持有到快照日

纯静态站：`index.html` + `echarts.min.js` + 异步加载的 `data/snapshot.json`。页面先画出壳子，再取行情快照。当前快照未压缩约 1.7MB（原先同步加载的 `data.js` 约 2.7MB），Brotli 后约 390KB。Vercel 会按浏览器的 `Accept-Encoding` 自动用 Brotli 或 Gzip 压缩，不为文件预压缩。`/data/snapshot.json` 的缓存是 `public, max-age=600, stale-while-revalidate=86400`（约 10 分钟内直接用缓存，过期后可先显示旧快照再后台更新）。`echarts.min.js` 仍是一年不变缓存。原始日 K（`data/alpha_history.ndjson`，约 5MB）和代币清单仍留在仓库里供增量抓取，但写在 `.vercelignore` 里，不会打进线上站点。没有把 K 线拆成很多文件：整份快照每天一起变，拆开只会让压缩变差，回测也要等全部 K 线到齐才能算。

本地不能再靠双击 `index.html`：`file://` 下浏览器会拦截 `fetch`。在项目目录执行：

```bash
node scripts/preview.js
# 打开终端打印的 http://localhost:8080
```

也可用 `python3 -m http.server 8080`。不需要安装依赖。

## 部署到 Vercel

方式一（推荐，Git 流）：把这个仓库 push 到 GitHub，然后在 [vercel.com](https://vercel.com) → Add New Project → 导入该仓库 → Framework Preset 选 **Other** → Deploy。无需任何构建配置。

方式二（CLI 流）：本机装过 Node 即可：

```bash
npx vercel          # 首次会引导登录并关联项目
npx vercel --prod   # 后续发布
```

## 数据更新

页面读的是 `data/snapshot.json`（由日 K 压成整数刻度，数值与原来的 K 线一致；个别价格跨度大到无法精确装箱的币保留原始数组）。手动刷新：

```bash
node scripts/fetch_sources.js         # 刷新币安代币清单与 alpha123 分发记录；失败则保留旧文件
node scripts/fetch_alpha_history.js   # 只抓尚未完成的标的（GeckoTerminal 限流约 30 次/分，间隔 3.4 秒，可断点续传）
node scripts/fetch_alpha_history.js --refresh # 重拉全部日 K，并与旧 K 线合并；失败标的保留旧数据，详见 data/fetch_failed.json
node scripts/build_data.js            # 合成 data/snapshot.json（可用 SNAPSHOT_AT=ISO时间 固定快照日）
node scripts/test_backtest.js         # 回测引擎与快照往返单测
node scripts/run_backtest.js          # 用页面默认参数回测，并重生 report / llms.txt
```

然后重新部署（git push 或 `vercel --prod`）。仓库里的 GitHub Actions（`.github/workflows/refresh-data.yml`）每天 00:30 UTC 自动跑上面这一套（行情用 `--refresh`），也可以在 Actions 页手动触发。测试通过且文件有变化时，才用 `github-actions[bot]` 提交到默认分支；Vercel 跟着这次 push 部署。单个标的抓取失败不会让任务失败，旧 K 线会留下来。清单接口失败同样保留旧的 `alpha_tokens_raw.json` / `alpha123_history_raw.json`。

全量刷新大约 400 个标的，按 3.4 秒/次加上偶发 429 退避，通常要几十分钟，工作流超时设为 120 分钟。

### 需要仓库主人打开的权限

工作流使用仓库自带的 `GITHUB_TOKEN`，不需要额外 secret。请确认：

1. 仓库已启用 Actions。
2. **Settings → Actions → General → Workflow permissions** 选 **Read and write permissions**。工作流里写了 `permissions: contents: write`，如果仓库或组织把 token 锁成只读，推送会被拒绝。
3. 默认分支如果开了保护（必须 PR、必须状态检查），要允许 `github-actions[bot]` 直接推送，或给 Actions 配 bypass。这个任务是提交到默认分支，不是另开 PR。
4. 币安 / alpha123 / GeckoTerminal 都是公开接口。币安或 alpha123 某天拦 GitHub 出口 IP 时，对应清单保持上次成功的文件，日 K 仍会继续刷新。

## 搜索与 AI 内容入口

正式网址：https://alpha-strategy.vercel.app/ 。`node scripts/run_backtest.js` 会按页面默认参数（2×、滑点 1%、领取 $0.10/轮、卖出 $0.05/笔）同步生成 `/report` 静态报告、`/report.md`、`/llms.txt` 和 `/sitemap.xml`，避免报告与回测结果不一致。`robots.txt` 允许公开内容抓取；首页包含描述、canonical 和 WebApplication 结构化数据。

观察效果时，在 Vercel 可用的访问日志中按 `OAI-SearchBot`、`Claude-SearchBot` 等 User-Agent 区分搜索抓取，按 `GPTBot`、`ClaudeBot` 区分训练抓取。User-Agent 可以伪造，命中日志不代表被推荐。实际效果应结合来自 ChatGPT、Claude 等的访问来源、可复现的回答引用和用户反馈判断；Referrer 可能缺失。日志与分析可用性取决于 Vercel 项目设置及套餐。本项目未接入第三方访问追踪，也不保证收录或推荐。

## 数据口径

| 项 | 说明 |
|---|---|
| 期次清单 | 币安 Alpha 全量代币列表（binance.com bapi 公开接口），筛 `onlineAirdrop`/`onlineTge` |
| 分发记录 | alpha123.uk `/api/historydata`（积分门槛 + 每号数量），按合约地址匹配，覆盖率 99%+ |
| 价格历史 | GeckoTerminal 公共 API 日线 OHLCV（该币聚合主池，USD） |
| 首日价 | 分发日（±1 天容差）起第一根日线的**开盘价**；首根 K 线距分发日 >2 周的期次标 ◇ |
| 覆盖 | 388 个空投标的中 378 个有价格历史；抓取失败的标的见 `data/fetch_failed.json`，失败时保留旧 K 线 |

## 已知局限

1. **幸存者偏差**：已完全退市/从列表移除的币不在清单里，「一直不卖」实际结果会更差。
2. 回测是**事后视角**：「不卖」策略的优势由极少数赢家轮次主导（页面汇总区会显示 TOP5 集中度），不代表事前可复制。
3. 池子 rebase/迁移的代币历史价格可能失真；个别低流动性池子有异常尖峰价。
4. **固定成本是近似值**：每轮领取默认扣 **$0.10**，每笔实际卖出再扣 **$0.05**（按 BSC 上一笔 gas 的量级，可在页面改，填 0 即关闭）。滑点仍是全局百分比。未扣刷积分成本，也没有按订单簿模拟深度，更没有单独算「先提币再卖」。策略 C 不卖出，所以不扣卖出成本；策略 B 没碰到目标价时同样不扣。策略 D 的卖出成本只扣一次，因此不等于 A 和 C 的平均。
