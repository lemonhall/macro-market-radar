import { CATEGORIES, FRED_METRICS, YAHOO_METRICS } from './catalog.js'
import {
  fetchFredMetric,
  fetchGscpiMetric,
  fetchLiquidityMetrics,
  fetchTreasuryMetrics,
  fetchYahooBatch,
  mapWithConcurrency,
} from './providers.js'

const CACHE_TTL_MS = 12 * 60 * 1000
let memoryCache = null

export function assessFreshness(asOf, cadence, now = Date.now()) {
  if (!asOf) return { key: 'unavailable', label: '暂无数据', ageHours: null }
  const ageHours = Math.max(0, (now - new Date(asOf).getTime()) / 3600000)

  if (cadence === 'weekly') {
    if (ageHours <= 10 * 24) return { key: 'recent', label: '最新周值', ageHours }
    if (ageHours <= 17 * 24) return { key: 'delayed', label: '周频延迟', ageHours }
    return { key: 'stale', label: '已陈旧', ageHours }
  }
  if (cadence === 'daily') {
    if (ageHours <= 36) return { key: 'recent', label: '最新日值', ageHours }
    if (ageHours <= 120) return { key: 'delayed', label: '最近工作日', ageHours }
    return { key: 'stale', label: '已陈旧', ageHours }
  }
  if (cadence === 'monthly') {
    if (ageHours <= 50 * 24) return { key: 'recent', label: '最新月值', ageHours }
    if (ageHours <= 80 * 24) return { key: 'delayed', label: '月频延迟', ageHours }
    return { key: 'stale', label: '已陈旧', ageHours }
  }
  if (ageHours <= 1) return { key: 'live', label: '盘中', ageHours }
  if (ageHours <= 20) return { key: 'recent', label: '当日', ageHours }
  if (ageHours <= 96) return { key: 'delayed', label: '休市数据', ageHours }
  return { key: 'stale', label: '已陈旧', ageHours }
}

function unavailableMetric(metric, error) {
  return {
    ...metric,
    value: null,
    dayChange: null,
    monthChange: null,
    points: [],
    asOf: null,
    available: false,
    error: error instanceof Error ? error.message : String(error),
    freshness: assessFreshness(null, metric.cadence),
  }
}

function unwrapSettled(metrics, settled) {
  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value
    return unavailableMetric(metrics[index], result.reason)
  })
}

function withFreshness(metric, now) {
  return { ...metric, freshness: assessFreshness(metric.asOf, metric.cadence, now) }
}

export async function getMarketSnapshot({ force = false, now = Date.now() } = {}) {
  if (!force && memoryCache && now - memoryCache.cachedAt < CACHE_TTL_MS) {
    return { ...memoryCache.snapshot, cache: 'memory' }
  }

  const [yahooSettled, officialSettled, fredSettled] = await Promise.all([
    fetchYahooBatch(YAHOO_METRICS),
    Promise.allSettled([fetchTreasuryMetrics(), fetchLiquidityMetrics(), fetchGscpiMetric()]),
    mapWithConcurrency(FRED_METRICS, 4, fetchFredMetric),
  ])

  const yahoo = unwrapSettled(YAHOO_METRICS, yahooSettled)
  const treasuryDefinitions = [
    { id: 'us2y', symbol: 'UST-2Y', category: 'bonds', name: '美国 2 年收益率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部' },
    { id: 'us10y', symbol: 'UST-10Y', category: 'bonds', name: '美国 10 年收益率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部' },
    { id: 'us20y', symbol: 'UST-20Y', category: 'bonds', name: '美国 20 年收益率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部' },
    { id: 'us30y', symbol: 'UST-30Y', category: 'bonds', name: '美国 30 年收益率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部' },
    { id: 'real10y', symbol: 'UST-REAL-10Y', category: 'macro', name: '10 年实际利率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部' },
    { id: 'breakeven10y', symbol: 'UST-BE-10Y', category: 'macro', name: '10 年隐含通胀补偿', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部计算' },
  ]
  const liquidityDefinitions = [
    { id: 'sofr', symbol: 'SOFR', category: 'macro', name: 'SOFR 隔夜利率', unit: '%', decimals: 2, changeKind: 'basisPoints', cadence: 'daily', source: '纽约联储' },
    { id: 'rrp', symbol: 'ON-RRP', category: 'macro', name: '隔夜逆回购余额', unit: '十亿美元', decimals: 2, changeKind: 'absolute', cadence: 'daily', source: '纽约联储' },
    { id: 'tga', symbol: 'TGA', category: 'macro', name: '美国财政部现金余额', unit: '十亿美元', decimals: 1, changeKind: 'absolute', cadence: 'daily', source: '美国财政部 Fiscal Data' },
  ]
  const gscpiDefinition = {
    id: 'gscpi', symbol: 'GSCPI', category: 'economy', name: '全球供应链压力', unit: '标准差',
    decimals: 2, changeKind: 'absolute', cadence: 'monthly', source: '纽约联储',
  }
  const treasury = officialSettled[0].status === 'fulfilled'
    ? officialSettled[0].value
    : treasuryDefinitions.map((metric) => unavailableMetric(metric, officialSettled[0].reason))
  const liquidity = officialSettled[1].status === 'fulfilled'
    ? officialSettled[1].value
    : liquidityDefinitions.map((metric) => unavailableMetric(metric, officialSettled[1].reason))
  const gscpi = officialSettled[2].status === 'fulfilled'
    ? [officialSettled[2].value]
    : [unavailableMetric(gscpiDefinition, officialSettled[2].reason)]
  const fred = unwrapSettled(FRED_METRICS, fredSettled)
  const metrics = [...yahoo, ...treasury, ...liquidity, ...fred, ...gscpi].map((metric) => withFreshness(metric, now))
  const available = metrics.filter((metric) => metric.available)
  const staleCount = available.filter((metric) => metric.freshness.key === 'stale').length

  const snapshot = {
    generatedAt: new Date(now).toISOString(),
    categories: CATEGORIES,
    metrics,
    quality: {
      total: metrics.length,
      available: available.length,
      unavailable: metrics.length - available.length,
      stale: staleCount,
    },
    sources: [
      { name: 'Yahoo Finance', cadence: '盘中或日频', role: '主要市场行情' },
      { name: '美国财政部', cadence: '工作日日频', role: '2/10/20/30 年收益率与官方曲线' },
      { name: '纽约联储', cadence: '日频或月频', role: 'SOFR、逆回购与供应链压力' },
      { name: 'Fiscal Data', cadence: '工作日日频', role: '美国财政部现金余额' },
      { name: 'FRED', cadence: '日频、周频或月频', role: '信用、资产负债表与实体经济' },
    ],
    cache: 'fresh',
  }

  memoryCache = { cachedAt: now, snapshot }
  return snapshot
}
