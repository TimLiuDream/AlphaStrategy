// 链名映射：币安 bapi chainName → GeckoTerminal network id。
// 抓取目标（fetch_alpha_history.js）与 coverage.total（build_data.js）都以本表为准，保证两端口径一致：
// 不在本表里的链（如 Robinhood，GeckoTerminal 未收录）不计入目标总数，避免"总数虚高但永远抓不到"。
module.exports = {
  NET: {
    BSC: 'bsc', Base: 'base', Ethereum: 'eth', Arbitrum: 'arbitrum',
    Solana: 'solana', Sui: 'sui-network', Linea: 'linea', Sonic: 'sonic', TRON: 'tron'
  }
};
