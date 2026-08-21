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
  const risk = average([
    normalizedChange(map, 'sp500', horizon),
    normalizedChange(map, 'russell', horizon),
    normalizedChange(map, 'sox', horizon),
    normalizedChange(map, 'hyg', horizon),
    normalizedChange(map, 'vix', horizon, true),
    normalizedChange(map, 'move', horizon, true),
    megacapSignal,
  ])
  const growth = average([
    normalizedChange(map, 'copper', horizon),
    normalizedChange(map, 'russell', horizon),
    normalizedChange(map, 'csi300', horizon),
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
  ])

  const pulses = [
    pulse('risk', '风险偏好', risk, '风险偏好升温', '避险占优', '股市、美股七姐妹、信用债与波动率的合成信号'),
    pulse('growth', '增长脉冲', growth, '增长交易改善', '增长预期降温', '铜、小盘股与中国权益的合成信号'),
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
