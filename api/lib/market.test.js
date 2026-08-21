import test from 'node:test'
import assert from 'node:assert/strict'

import { assessFreshness } from './market.js'
import { CATEGORIES, FRED_METRICS, YAHOO_METRICS } from './catalog.js'
import { fetchFredMetric, parseCsv, parseFredSeries } from './providers.js'

const NOW = Date.parse('2026-08-21T10:00:00.000Z')

test('按数据发布频率判断新鲜度，避免把周频数据误判为陈旧', () => {
  assert.equal(assessFreshness('2026-08-21T09:30:00.000Z', 'intraday', NOW).label, '盘中')
  assert.equal(assessFreshness('2026-08-20T21:00:00.000Z', 'daily', NOW).label, '最新日值')
  assert.equal(assessFreshness('2026-08-14T21:00:00.000Z', 'weekly', NOW).label, '最新周值')
  assert.equal(assessFreshness('2026-07-15T21:00:00.000Z', 'monthly', NOW).label, '最新月值')
  assert.equal(assessFreshness('2026-07-01T21:00:00.000Z', 'monthly', NOW).label, '最新月值')
  assert.equal(assessFreshness('2026-08-10T10:00:00.000Z', 'daily', NOW).label, '已陈旧')
})

test('CSV 解析器保留带引号的财政部字段', () => {
  const rows = parseCsv('Date,"20 Yr","30 Yr"\r\n08/20/2026,5.20,5.23\r\n')
  assert.deepEqual(rows, [['Date', '20 Yr', '30 Yr'], ['08/20/2026', '5.20', '5.23']])
})

test('美股七姐妹分区包含七只目标股票', () => {
  const category = CATEGORIES.find((item) => item.id === 'megacap-tech')
  const symbols = YAHOO_METRICS
    .filter((item) => item.category === 'megacap-tech')
    .map((item) => item.symbol)
  assert.equal(category.name, '美股七姐妹')
  assert.deepEqual(symbols, ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'])
})

test('消费分区使用沃尔玛观察大众零售', () => {
  const category = CATEGORIES.find((item) => item.id === 'consumer')
  const walmart = YAHOO_METRICS.find((item) => item.id === 'wmt')
  assert.equal(category.name, '消费')
  assert.equal(walmart.symbol, 'WMT')
  assert.equal(walmart.category, 'consumer')
})

test('全球、金融、住房与消费指标进入 Yahoo 批量目录', () => {
  const symbols = new Set(YAHOO_METRICS.map((item) => item.symbol))
  for (const symbol of ['^STOXX', '^N225', '^NSEI', 'XLF', 'KRE', 'XHB', 'XLY', 'XLP']) {
    assert.equal(symbols.has(symbol), true, `${symbol} 应在行情目录中`)
  }
})

test('FRED 目录覆盖信用、资产负债表和实体经济', () => {
  const series = new Set(FRED_METRICS.map((item) => item.series))
  for (const id of ['BAMLH0A0HYM2', 'WALCL', 'ICSA', 'RSAFS', 'INDPRO', 'HOUST']) {
    assert.equal(series.has(id), true, `${id} 应在 FRED 目录中`)
  }
})

test('FRED CSV 解析跳过缺失值并保留有效观测', () => {
  const points = parseFredSeries('observation_date,WALCL\n2026-08-05,6600000\n2026-08-12,.\n2026-08-19,6610000\n', 'WALCL')
  assert.deepEqual(points, [
    { date: '2026-08-05', value: 6600000 },
    { date: '2026-08-19', value: 6610000 },
  ])
})

test('经济数据从仓库快照读取并应用展示单位换算', async () => {
  const definition = FRED_METRICS.find((item) => item.series === 'WALCL')
  const metric = await fetchFredMetric(definition)
  assert.equal(metric.available, true)
  assert.equal(metric.source, 'FRED（GitHub 定时快照）')
  assert.ok(metric.value > 1 && metric.value < 20)
})
