import test from 'node:test'
import assert from 'node:assert/strict'

import { assessFreshness } from './market.js'
import { CATEGORIES, YAHOO_METRICS } from './catalog.js'
import { parseCsv } from './providers.js'

const NOW = Date.parse('2026-08-21T10:00:00.000Z')

test('按数据发布频率判断新鲜度，避免把周频数据误判为陈旧', () => {
  assert.equal(assessFreshness('2026-08-21T09:30:00.000Z', 'intraday', NOW).label, '盘中')
  assert.equal(assessFreshness('2026-08-20T21:00:00.000Z', 'daily', NOW).label, '最新日值')
  assert.equal(assessFreshness('2026-08-14T21:00:00.000Z', 'weekly', NOW).label, '最新周值')
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
