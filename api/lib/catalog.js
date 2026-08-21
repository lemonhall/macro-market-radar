export const CATEGORIES = [
  { id: 'equity', name: '全球股市', description: '风险资产与经济预期' },
  { id: 'megacap-tech', name: '美股七姐妹', description: '大型科技股与美股集中度' },
  { id: 'consumer', name: '消费', description: '居民购买力与防御型零售' },
  { id: 'finance-housing', name: '金融与地产', description: '信用传导、银行压力与住房周期' },
  { id: 'bonds', name: '债市与信用', description: '全球资产定价锚' },
  { id: 'metals', name: '金属', description: '避险、通胀与工业需求' },
  { id: 'energy', name: '能源', description: '通胀与地缘供给冲击' },
  { id: 'fx', name: '汇率', description: '美元流动性与资金方向' },
  { id: 'china-us', name: '中美温度', description: '两大经济体的相对脉冲' },
  { id: 'semiconductor', name: '半导体', description: '算力投资与制造周期' },
  { id: 'healthcare', name: '医疗', description: '防御需求与创新风险偏好' },
  { id: 'defense', name: '军工', description: '预算、补库与地缘风险' },
  { id: 'macro', name: '宏观底层', description: 'Yahoo 缺失的官方与公共数据' },
  { id: 'economy', name: '经济底盘', description: '就业、消费、生产、住房与供应链' },
]

export const YAHOO_METRICS = [
  ['sp500', '^GSPC', 'equity', '标普 500', '点', 2],
  ['nasdaq', '^IXIC', 'equity', '纳斯达克综合', '点', 2],
  ['dow', '^DJI', 'equity', '道琼斯', '点', 2],
  ['russell', '^RUT', 'equity', '罗素 2000', '点', 2],
  ['vix', '^VIX', 'equity', 'VIX 恐慌指数', '点', 2],
  ['stoxx600', '^STOXX', 'equity', '欧洲 STOXX 600', '点', 2],
  ['nikkei225', '^N225', 'equity', '日经 225', '点', 2],
  ['nifty50', '^NSEI', 'equity', '印度 Nifty 50', '点', 2],

  ['aapl', 'AAPL', 'megacap-tech', '苹果', '美元', 2],
  ['msft', 'MSFT', 'megacap-tech', '微软', '美元', 2],
  ['googl', 'GOOGL', 'megacap-tech', '谷歌 A 类', '美元', 2],
  ['amzn', 'AMZN', 'megacap-tech', '亚马逊', '美元', 2],
  ['nvda', 'NVDA', 'megacap-tech', '英伟达', '美元', 2],
  ['meta', 'META', 'megacap-tech', 'Meta', '美元', 2],
  ['tsla', 'TSLA', 'megacap-tech', '特斯拉', '美元', 2],

  ['wmt', 'WMT', 'consumer', '沃尔玛', '美元', 2],
  ['xly', 'XLY', 'consumer', '可选消费 ETF', '美元', 2],
  ['xlp', 'XLP', 'consumer', '必选消费 ETF', '美元', 2],

  ['xlf', 'XLF', 'finance-housing', '美国金融 ETF', '美元', 2],
  ['kre', 'KRE', 'finance-housing', '美国区域银行 ETF', '美元', 2],
  ['xhb', 'XHB', 'finance-housing', '美国住宅建筑 ETF', '美元', 2],

  ['move', '^MOVE', 'bonds', 'MOVE 债券波动率', '点', 2],
  ['hyg', 'HYG', 'bonds', '美国高收益债 ETF', '美元', 2],

  ['gold', 'GC=F', 'metals', '黄金', '美元/盎司', 2],
  ['silver', 'SI=F', 'metals', '白银', '美元/盎司', 3],
  ['copper', 'HG=F', 'metals', '铜', '美元/磅', 3],

  ['wti', 'CL=F', 'energy', 'WTI 原油', '美元/桶', 2],
  ['brent', 'BZ=F', 'energy', '布伦特原油', '美元/桶', 2],
  ['gas', 'NG=F', 'energy', '美国天然气', '美元', 3],

  ['dxy', 'DX-Y.NYB', 'fx', '美元指数', '点', 3],
  ['usdjpy', 'USDJPY=X', 'fx', '美元 / 日元', 'JPY', 3],
  ['usdcny', 'USDCNY=X', 'fx', '美元 / 人民币', 'CNY', 4],
  ['eurusd', 'EURUSD=X', 'fx', '欧元 / 美元', 'USD', 4],

  ['csi300', 'ASHR', 'china-us', '沪深 300 ETF', '美元', 2],
  ['shanghai', '000001.SS', 'china-us', '上证综指', '点', 2],
  ['hangseng', '^HSI', 'china-us', '恒生指数', '点', 2],
  ['mchi', 'MCHI', 'china-us', '中国大盘股 ETF', '美元', 2],

  ['sox', '^SOX', 'semiconductor', '费城半导体', '点', 2],
  ['smh', 'SMH', 'semiconductor', '半导体 ETF', '美元', 2],
  ['tsm', 'TSM', 'semiconductor', '台积电 ADR', '美元', 2],
  ['asml', 'ASML', 'semiconductor', '阿斯麦', '美元', 2],

  ['xlv', 'XLV', 'healthcare', '医疗行业 ETF', '美元', 2],
  ['ibb', 'IBB', 'healthcare', '生物科技 ETF', '美元', 2],
  ['lly', 'LLY', 'healthcare', '礼来', '美元', 2],

  ['ita', 'ITA', 'defense', '航空军工 ETF', '美元', 2],
  ['xar', 'XAR', 'defense', '等权军工 ETF', '美元', 2],
  ['lmt', 'LMT', 'defense', '洛克希德·马丁', '美元', 2],

  ['btc', 'BTC-USD', 'macro', '比特币', '美元', 2],
  ['bdry', 'BDRY', 'macro', '干散货运价代理 ETF', '美元', 2],
].map(([id, symbol, category, name, unit, decimals, changeKind = 'percent']) => ({
  id,
  symbol,
  category,
  name,
  unit,
  decimals,
  changeKind,
  source: 'Yahoo Finance',
  cadence: 'intraday',
}))

export const FRED_METRICS = [
  {
    id: 'hySpread', series: 'BAMLH0A0HYM2', category: 'bonds', name: '美国高收益债 OAS',
    unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily',
  },
  {
    id: 'fedAssets', series: 'WALCL', category: 'macro', name: '美联储总资产',
    unit: '万亿美元', decimals: 2, changeKind: 'absolute', cadence: 'weekly', scale: 0.000001,
  },
  {
    id: 'joblessClaims', series: 'ICSA', category: 'economy', name: '美国首次申领失业救济',
    unit: '万人', decimals: 1, changeKind: 'absolute', cadence: 'weekly', scale: 0.0001,
  },
  {
    id: 'retailSales', series: 'RSAFS', category: 'economy', name: '美国零售销售',
    unit: '十亿美元', decimals: 1, changeKind: 'percent', cadence: 'monthly', scale: 0.001,
  },
  {
    id: 'industrialProduction', series: 'INDPRO', category: 'economy', name: '美国工业生产',
    unit: '指数', decimals: 2, changeKind: 'percent', cadence: 'monthly',
  },
  {
    id: 'housingStarts', series: 'HOUST', category: 'economy', name: '美国新屋开工',
    unit: '万套/年', decimals: 1, changeKind: 'percent', cadence: 'monthly', scale: 0.1,
  },
]
