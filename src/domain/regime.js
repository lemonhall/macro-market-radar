const clamp = (value, min = -100, max = 100) => Math.min(max, Math.max(min, value))

function metricMap(metrics) {
  return new Map(metrics.filter((metric) => metric.available).map((metric) => [metric.id, metric]))
}

function changeOf(map, id, horizon) {
  const metric = map.get(id)
  if (!metric) return null
  return horizon === 'day' ? metric.dayChange : metric.monthChange
}

function normalizedChange(map, id, horizon, inverse = false) {
  const metric = map.get(id)
  const change = changeOf(map, id, horizon)
  if (!metric || !Number.isFinite(change)) return null
  const scale = metric.changeKind === 'basisPoints' ? 4 : metric.changeKind === 'absolute' ? 35 : 16
  const score = clamp(change * scale)
  return inverse ? -score : score
}

function average(values) {
  const available = values.filter(Number.isFinite)
  if (!available.length) return 0
  return available.reduce((total, value) => total + value, 0) / available.length
}

function optionalAverage(values) {
  const available = values.filter(Number.isFinite)
  return available.length ? average(available) : null
}

function metricValue(map, id) {
  const value = map.get(id)?.value
  return Number.isFinite(value) ? value : null
}

function relativeChange(map, leftId, rightId, horizon) {
  const left = changeOf(map, leftId, horizon)
  const right = changeOf(map, rightId, horizon)
  return Number.isFinite(left) && Number.isFinite(right) ? left - right : null
}

function structureSignal(id, label, value, unit, positive, negative, detail, neutral = '方向持平') {
  if (!Number.isFinite(value)) return null
  const epsilon = unit === 'bp' ? 1 : 0.05
  const tone = value > epsilon ? 'positive' : value < -epsilon ? 'negative' : 'neutral'
  const title = tone === 'positive' ? positive : tone === 'negative' ? negative : neutral
  return { id, label, value, unit, tone, title, detail }
}

export function deriveStructureSignals(metrics, horizon = 'day') {
  const map = metricMap(metrics)
  const us2y = metricValue(map, 'us2y')
  const us10y = metricValue(map, 'us10y')
  const curveLevel = Number.isFinite(us2y) && Number.isFinite(us10y) ? (us10y - us2y) * 100 : null
  const curveChange = relativeChange(map, 'us10y', 'us2y', horizon)
  const megacapChanges = ['aapl', 'msft', 'googl', 'amzn', 'nvda', 'meta', 'tsla']
    .map((id) => changeOf(map, id, horizon))
  const megacapChange = megacapChanges.some(Number.isFinite) ? average(megacapChanges) : null
  const sp500Change = changeOf(map, 'sp500', horizon)
  const fedAssets = metricValue(map, 'fedAssets')
  const tga = metricValue(map, 'tga')
  const rrp = metricValue(map, 'rrp')
  const netLiquidity = [fedAssets, tga, rrp].every(Number.isFinite)
    ? fedAssets - (tga + rrp) / 1000
    : null

  return [
    Number.isFinite(curveLevel) ? {
      id: 'curve2s10s', label: '2s10s 期限曲线', value: curveLevel, unit: 'bp',
      tone: curveLevel < 0 ? 'negative' : 'neutral',
      title: curveLevel < 0 ? '曲线倒挂' : '曲线正斜率',
      detail: Number.isFinite(curveChange)
        ? `${curveChange >= 0 ? '正在陡峭化' : '正在趋平'} ${Math.abs(curveChange).toFixed(1)} bp`
        : '美国财政部同日曲线',
    } : null,
    structureSignal(
      'copperGold', '铜 / 黄金', relativeChange(map, 'copper', 'gold', horizon), '%',
      '铜跑赢黄金', '黄金跑赢铜', '增长交易相对避险交易',
    ),
    structureSignal(
      'megacapRelative', '七姐妹 / 标普', Number.isFinite(sp500Change) ? megacapChange - sp500Change : null, '%',
      '大型科技领先', '大型科技落后', '七姐妹等权变化相对标普 500',
    ),
    structureSignal(
      'semisRelative', '半导体 / 标普', relativeChange(map, 'sox', 'sp500', horizon), '%',
      '半导体领先', '半导体落后', '费城半导体相对标普 500',
    ),
    structureSignal(
      'consumerRelative', '可选 / 必选消费', relativeChange(map, 'xly', 'xlp', horizon), '%',
      '可选消费占优', '防御消费占优', 'XLY 相对 XLP 的变化',
    ),
    Number.isFinite(netLiquidity) ? {
      id: 'netLiquidity', label: '美元净流动性近似', value: netLiquidity, unit: '万亿美元', tone: 'neutral',
      title: '资产端减 TGA 与 RRP', detail: '混合频率，仅作方向参考',
    } : null,
  ].filter(Boolean)
}

function pulse(id, label, score, positive, negative, detail) {
  const rounded = Math.round(score)
  let state = 'neutral'
  let title = '信号交错'
  if (rounded >= 18) {
    state = id === 'inflation' || id === 'liquidity' ? 'warning' : 'positive'
    title = positive
  } else if (rounded <= -18) {
    state = id === 'inflation' || id === 'liquidity' ? 'positive' : 'negative'
    title = negative
  }
  return { id, label, score: rounded, state, title, detail }
}

export function interpretRegime(metrics, horizon = 'day') {
  const map = metricMap(metrics)
  const megacapChanges = ['aapl', 'msft', 'googl', 'amzn', 'nvda', 'meta', 'tsla']
    .map((id) => normalizedChange(map, id, horizon))
  const megacapSignal = megacapChanges.some(Number.isFinite) ? average(megacapChanges) : null
  const globalSignal = optionalAverage([
    normalizedChange(map, 'stoxx600', horizon),
    normalizedChange(map, 'nikkei225', horizon),
    normalizedChange(map, 'nifty50', horizon),
  ])
  const financialSignal = optionalAverage([
    normalizedChange(map, 'xlf', horizon),
    normalizedChange(map, 'kre', horizon),
  ])
  const risk = average([
    normalizedChange(map, 'sp500', horizon),
    normalizedChange(map, 'russell', horizon),
    normalizedChange(map, 'sox', horizon),
    normalizedChange(map, 'hyg', horizon),
    normalizedChange(map, 'vix', horizon, true),
    normalizedChange(map, 'move', horizon, true),
    megacapSignal,
    globalSignal,
    financialSignal,
  ])
  const growth = average([
    normalizedChange(map, 'copper', horizon),
    normalizedChange(map, 'russell', horizon),
    normalizedChange(map, 'csi300', horizon),
    globalSignal,
    normalizedChange(map, 'xhb', horizon),
  ])
  const inflation = average([
    normalizedChange(map, 'wti', horizon),
    normalizedChange(map, 'brent', horizon),
    normalizedChange(map, 'copper', horizon),
    normalizedChange(map, 'breakeven10y', horizon),
  ])
  const liquidity = average([
    normalizedChange(map, 'dxy', horizon),
    normalizedChange(map, 'vix', horizon),
    normalizedChange(map, 'move', horizon),
    normalizedChange(map, 'hyg', horizon, true),
    normalizedChange(map, 'hySpread', horizon),
    Number.isFinite(financialSignal) ? -financialSignal : null,
  ])

  const pulses = [
    pulse('risk', '风险偏好', risk, '风险偏好升温', '避险占优', '全球股市、七姐妹、金融、信用债与波动率的合成信号'),
    pulse('growth', '增长脉冲', growth, '增长交易改善', '增长预期降温', '铜、全球股市、小盘股、中国权益与住房的合成信号'),
    pulse('inflation', '通胀压力', inflation, '通胀交易升温', '通胀交易降温', '能源、铜与盈亏平衡通胀率的合成信号'),
    pulse('liquidity', '流动性压力', liquidity, '金融条件趋紧', '流动性改善', '美元、波动率与信用市场的合成信号'),
  ]

  const strongest = [...pulses].sort((left, right) => Math.abs(right.score) - Math.abs(left.score))[0]
  return {
    pulses,
    headline: strongest.title,
    summary: `${strongest.label}是当前最强信号，强度 ${Math.abs(strongest.score)}/100。`,
  }
}
