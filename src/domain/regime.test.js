import test from 'node:test'
import assert from 'node:assert/strict'

import { deriveStructureSignals, interpretRegime } from './regime.js'

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

test('结构信号计算期限曲线、相对强弱和净流动性近似', () => {
  const metrics = [
    { ...metric('us2y', -2), value: 4.1 },
    { ...metric('us10y', 1), value: 4.5 },
    { ...metric('copper', 1.5), value: 5 },
    { ...metric('gold', 0.5), value: 3000 },
    { ...metric('sp500', 1), value: 7000 },
    { ...metric('sox', 2), value: 9000 },
    { ...metric('xly', 1.2), value: 100 },
    { ...metric('xlp', -0.3), value: 80 },
    { ...metric('fedAssets', 0.01, 0.02, 'absolute'), value: 6.7 },
    { ...metric('tga', -10, -20, 'absolute'), value: 900 },
    { ...metric('rrp', 0, 0, 'absolute'), value: 0.2 },
    ...['aapl', 'msft', 'googl', 'amzn', 'nvda', 'meta', 'tsla']
      .map((id) => ({ ...metric(id, 2), value: 100 })),
  ]
  const signals = deriveStructureSignals(metrics)
  const curve = signals.find((item) => item.id === 'curve2s10s')
  const consumer = signals.find((item) => item.id === 'consumerRelative')
  const liquidity = signals.find((item) => item.id === 'netLiquidity')
  assert.equal(Math.round(curve.value), 40)
  assert.equal(curve.detail, '正在陡峭化 3.0 bp')
  assert.equal(consumer.title, '可选消费占优')
  assert.equal(consumer.value, 1.5)
  assert.ok(Math.abs(liquidity.value - 5.7998) < 0.000001)
})
