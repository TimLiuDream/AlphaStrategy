// 链名映射：币安 bapi chainName → GeckoTerminal network id。
// 抓取目标（fetch_alpha_history.js）与 coverage.total（build_data.js）都以本表为准，保证两端口径一致：
// 不在本表里的链（如 Robinhood，GeckoTerminal 未收录）不计入目标总数，避免"总数虚高但永远抓不到"。
module.exports = {
  NET: {
    BSC: 'bsc', Base: 'base', Ethereum: 'eth', Arbitrum: 'arbitrum',
    Solana: 'solana', Sui: 'sui-network', Linea: 'linea', Sonic: 'sonic', TRON: 'tron'
  },
  // 币安 chainId（含 CT_ 前缀）与 alpha123 chain_id → 标准 chainName，避免跨链同合约地址串链
  CHAIN_BY_ID: {
    '56': 'BSC', '8453': 'Base', '1': 'Ethereum', '42161': 'Arbitrum',
    '501': 'Solana', 'CT_501': 'Solana',
    '784': 'Sui', 'CT_784': 'Sui',
    '59144': 'Linea', '146': 'Sonic',
    '195': 'TRON', 'CT_195': 'TRON'
  }
};
