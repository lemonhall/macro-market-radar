import test from 'node:test'
import assert from 'node:assert/strict'

import { interpretRegime } from './regime.js'

function metric(id, dayChange, monthChange = dayChange, changeKind = 'percent') {
  return { id, dayChange, monthChange, changeKind, available: true }
}

test('股涨、信用涨且波动率下降时识别为风险偏好升温', () => {
  const result = interpretRegime([
    metric('sp500', 1.2), metric('russell', 1.5), metric('sox', 2), metric('hyg', 0.4),
    metric('vix', -6), metric('move', -4), metric('copper', 0.8), metric('csi300', 0.5),
  ])
  const risk = result.pulses.find((item) => item.id === 'risk')
  assert.equal(risk.title, '风险偏好升温')
  assert.ok(risk.score > 18)
})

test('美元、VIX、MOVE 同涨且信用债下跌时识别为金融条件趋紧', () => {
  const result = interpretRegime([
    metric('dxy', 1.1), metric('vix', 5), metric('move', 4), metric('hyg', -1.2),
  ])
  const liquidity = result.pulses.find((item) => item.id === 'liquidity')
  assert.equal(liquidity.title, '金融条件趋紧')
  assert.equal(liquidity.state, 'warning')
})

test('美股七姐妹作为一个合成因子进入风险偏好判断', () => {
  const result = interpretRegime([
    metric('aapl', 2), metric('msft', 2), metric('googl', 2), metric('amzn', 2),
    metric('nvda', 2), metric('meta', 2), metric('tsla', 2),
  ])
  const risk = result.pulses.find((item) => item.id === 'risk')
  assert.equal(risk.title, '风险偏好升温')
  assert.equal(risk.score, 32)
})
