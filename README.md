# 币安 Alpha 空投策略回测器

假设每一轮币安 Alpha 空投分发你都完整抢到（数量按 alpha123.uk 记录的真实每号分发量），回测四种处置策略的账户总额：

- **策略A · 领取即卖**：领取当天按首日开盘价全部卖出
- **策略B · 翻倍卖**：领取即挂 N× 限价单（默认 2×，可调 1.5/2/3/5），触及则成交，未触及按现价计值
- **策略C · 一直不卖**：持有至今，按数据快照日现价估值
- **策略D · 半卖半持**：一半首日卖出 + 一半持有到快照日

纯静态站：`index.html + echarts.min.js + data.js`，本地双击 `index.html` 即可用，无需服务器。

## 部署到 Vercel

方式一（推荐，Git 流）：把这个仓库 push 到 GitHub，然后在 [vercel.com](https://vercel.com) → Add New Project → 导入该仓库 → Framework Preset 选 **Other** → Deploy。无需任何构建配置。

方式二（CLI 流）：本机装过 Node 即可：

```bash
npx vercel          # 首次会引导登录并关联项目
npx vercel --prod   # 后续发布
```

## 数据更新

页面数据是快照（`data.js`）。要刷新行情与新增期次：

```bash
node scripts/fetch_alpha_history.js   # 增量抓取日K（GeckoTerminal 限流约30次/分，支持断点续传）
node scripts/fetch_alpha_history.js --refresh # 刷新全部标的行情；失败标的保留旧数据，详见 data/fetch_failed.json
node scripts/build_data.js            # 重新合成根目录 data.js
node scripts/test_backtest.js         # 回测引擎单测
node scripts/run_backtest.js          # 使用页面默认参数回测，输出 data/backtest_results.json
```

然后重新部署（git push 或 `vercel --prod`）。

## 数据口径

| 项 | 说明 |
|---|---|
| 期次清单 | 币安 Alpha 全量代币列表（binance.com bapi 公开接口），筛 `onlineAirdrop`/`onlineTge` |
| 分发记录 | alpha123.uk `/api/historydata`（积分门槛 + 每号数量），按合约地址匹配，覆盖率 99%+ |
| 价格历史 | GeckoTerminal 公共 API 日线 OHLCV（该币聚合主池，USD） |
| 首日价 | 分发日（±1 天容差）起第一根日线的**开盘价**；首根 K 线距分发日 >2 周的期次标 ◇ |
| 覆盖 | 386 个空投标的中 373 个有价格历史（11 个 GT 无池子收录，多为极新/已退市） |

## 已知局限

1. **幸存者偏差**：已完全退市/从列表移除的币不在清单里，「一直不卖」实际结果会更差。
2. 回测是**事后视角**：「不卖」策略的优势由极少数赢家轮次主导（页面汇总区会显示 TOP5 集中度），不代表事前可复制。
3. 池子 rebase/迁移的代币历史价格可能失真；个别低流动性池子有异常尖峰价。
4. 未计入领取 gas、卖出深度冲击、部分期次需先提币再卖等摩擦；滑点用全局百分比近似。
