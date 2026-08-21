import { ProxyAgent, fetch as httpFetch } from 'undici'

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

function fetchOptions(timeout = 7000) {
  return {
    headers: {
      accept: 'application/json,text/csv,*/*',
      'user-agent': 'Mozilla/5.0 (compatible; MacroMarketRadar/1.0)',
    },
    signal: AbortSignal.timeout(timeout),
    ...(dispatcher ? { dispatcher } : {}),
  }
}

async function fetchText(url, timeout) {
  const response = await httpFetch(url, fetchOptions(timeout))
  if (!response.ok) throw new Error(`上游返回 HTTP ${response.status}`)
  return response.text()
}

export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    const next = text[index + 1]
    if (character === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function finitePoints(timestamps, values) {
  return values
    .map((value, index) => ({
      time: timestamps[index] ? new Date(timestamps[index] * 1000).toISOString() : null,
      value: Number(value),
    }))
    .filter((point) => point.time && Number.isFinite(point.value))
}

function calculateChanges(points, changeKind) {
  const latest = points.at(-1)?.value
  const previous = points.at(-2)?.value
  const first = points[0]?.value
  if (![latest, previous, first].every(Number.isFinite)) return { dayChange: null, monthChange: null }

  if (changeKind === 'basisPoints') {
    return {
      dayChange: (latest - previous) * 100,
      monthChange: (latest - first) * 100,
    }
  }
  if (changeKind === 'absolute') {
    return { dayChange: latest - previous, monthChange: latest - first }
  }
  return {
    dayChange: previous === 0 ? null : ((latest / previous) - 1) * 100,
    monthChange: first === 0 ? null : ((latest / first) - 1) * 100,
  }
}

export async function fetchYahooMetric(metric) {
  const encoded = encodeURIComponent(metric.symbol)
  const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']
  let lastError

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encoded}?range=1mo&interval=1d&includePrePost=false`
      const payload = JSON.parse(await fetchText(url, 6500))
      const chart = payload.chart?.result?.[0]
      if (!chart) throw new Error(payload.chart?.error?.description || '没有行情结果')
      const closes = chart.indicators?.quote?.[0]?.close ?? []
      const points = finitePoints(chart.timestamp ?? [], closes)
      if (points.length < 2) throw new Error('有效行情点不足')
      const latest = points.at(-1)
      return {
        ...metric,
        value: latest.value,
        ...calculateChanges(points, metric.changeKind),
        points: points.map((point) => point.value),
        asOf: new Date((chart.meta.regularMarketTime ?? chart.timestamp.at(-1)) * 1000).toISOString(),
        currency: chart.meta.currency ?? null,
        sourceUrl: `https://finance.yahoo.com/quote/${encoded}`,
        available: true,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

function chartToYahooMetric(metric, chart) {
  const closes = chart.indicators?.quote?.[0]?.close ?? []
  const points = finitePoints(chart.timestamp ?? [], closes)
  if (points.length < 2) throw new Error('有效行情点不足')
  const latest = points.at(-1)
  const marketTime = chart.meta.regularMarketTime ?? (chart.timestamp ?? []).at(-1)
  return {
    ...metric,
    value: latest.value,
    ...calculateChanges(points, metric.changeKind),
    points: points.map((point) => point.value),
    asOf: new Date(marketTime * 1000).toISOString(),
    currency: chart.meta.currency ?? null,
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(metric.symbol)}`,
    available: true,
  }
}

async function fetchYahooChunk(metrics) {
  const symbols = metrics.map((metric) => encodeURIComponent(metric.symbol)).join(',')
  const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']
  let lastError

  for (const host of hosts) {
    try {
      const url = `https://${host}/v7/finance/spark?symbols=${symbols}&range=1mo&interval=1d`
      const payload = JSON.parse(await fetchText(url, 9000))
      const entries = payload.spark?.result ?? []
      const charts = new Map(entries.map((entry) => [entry.symbol, entry.response?.[0]]))
      return metrics.map((metric) => {
        const chart = charts.get(metric.symbol)
        if (!chart) return { status: 'rejected', reason: new Error('Yahoo 批量行情中缺少该标的') }
        try {
          return { status: 'fulfilled', value: chartToYahooMetric(metric, chart) }
        } catch (reason) {
          return { status: 'rejected', reason }
        }
      })
    } catch (error) {
      lastError = error
    }
  }
  return metrics.map(() => ({ status: 'rejected', reason: lastError }))
}

export async function fetchYahooBatch(metrics) {
  const results = []
  for (let index = 0; index < metrics.length; index += 16) {
    const chunk = metrics.slice(index, index + 16)
    results.push(...await fetchYahooChunk(chunk))
  }
  return results
}

function parseDate(value) {
  const [month, day, year] = value.split('/').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 21)).toISOString()
}

export async function fetchTreasury20Year() {
  const year = new Date().getUTCFullYear()
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`
  const rows = parseCsv(await fetchText(url, 8000))
  const headers = rows[0]
  const dateIndex = headers.indexOf('Date')
  const valueIndex = headers.indexOf('20 Yr')
  if (dateIndex < 0 || valueIndex < 0) throw new Error('财政部收益率曲线缺少 20 年字段')
  const points = rows.slice(1)
    .map((row) => ({ time: parseDate(row[dateIndex]), value: Number(row[valueIndex]) }))
    .filter((point) => Number.isFinite(point.value))
    .sort((left, right) => left.time.localeCompare(right.time))
    .slice(-23)
  if (points.length < 2) throw new Error('财政部 20 年收益率数据不足')
  const latest = points.at(-1)
  return {
    id: 'us20y',
    symbol: 'UST-20Y',
    category: 'bonds',
    name: '美国 20 年收益率',
    unit: '%',
    decimals: 2,
    changeKind: 'basisPoints',
    cadence: 'daily',
    source: '美国财政部',
    sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView',
    value: latest.value,
    ...calculateChanges(points, 'basisPoints'),
    points: points.map((point) => point.value),
    asOf: latest.time,
    available: true,
  }
}

function treasuryPoints(text, column) {
  const rows = parseCsv(text)
  const headers = rows[0]
  const dateIndex = headers.indexOf('Date')
  const valueIndex = headers.indexOf(column)
  if (dateIndex < 0 || valueIndex < 0) throw new Error(`财政部曲线缺少 ${column} 字段`)
  return rows.slice(1)
    .map((row) => ({ time: parseDate(row[dateIndex]), value: Number(row[valueIndex]) }))
    .filter((point) => Number.isFinite(point.value))
    .sort((left, right) => left.time.localeCompare(right.time))
    .slice(-23)
}

function seriesMetric(definition, points) {
  if (points.length < 2) throw new Error(`${definition.name} 有效数据不足`)
  const latest = points.at(-1)
  return {
    ...definition,
    value: latest.value,
    ...calculateChanges(points, definition.changeKind),
    points: points.map((point) => point.value),
    asOf: latest.time,
    available: true,
  }
}

export async function fetchTreasuryMetrics() {
  const year = new Date().getUTCFullYear()
  const base = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates'
  const nominalUrl = `${base}/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`
  const realUrl = `${base}/daily-treasury-rates.csv/${year}/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=${year}&page&_format=csv`
  const [nominalText, realText] = await Promise.all([fetchText(nominalUrl, 8000), fetchText(realUrl, 8000)])
  const nominal10 = treasuryPoints(nominalText, '10 Yr')
  const nominal20 = treasuryPoints(nominalText, '20 Yr')
  const real10 = treasuryPoints(realText, '10 YR')
  const realByDate = new Map(real10.map((point) => [point.time, point.value]))
  const breakeven10 = nominal10
    .filter((point) => realByDate.has(point.time))
    .map((point) => ({ time: point.time, value: point.value - realByDate.get(point.time) }))
  const sourceUrl = `${base}/TextView`

  return [
    seriesMetric({
      id: 'us20y', symbol: 'UST-20Y', category: 'bonds', name: '美国 20 年收益率', unit: '%', decimals: 2,
      changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部', sourceUrl,
    }, nominal20),
    seriesMetric({
      id: 'real10y', symbol: 'UST-REAL-10Y', category: 'macro', name: '10 年实际利率', unit: '%', decimals: 2,
      changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部', sourceUrl,
    }, real10),
    seriesMetric({
      id: 'breakeven10y', symbol: 'UST-BE-10Y', category: 'macro', name: '10 年隐含通胀补偿', unit: '%', decimals: 2,
      changeKind: 'basisPoints', cadence: 'daily', source: '美国财政部计算', sourceUrl,
    }, breakeven10),
  ]
}

function isoPoint(date, value) {
  return { time: `${date}T21:00:00.000Z`, value: Number(value) }
}

export async function fetchLiquidityMetrics() {
  const [sofrPayload, rrpPayload, tgaPayload] = await Promise.all([
    fetchText('https://markets.newyorkfed.org/api/rates/secured/sofr/last/25.json', 8000).then(JSON.parse),
    fetchText('https://markets.newyorkfed.org/api/rp/reverserepo/all/results/last/25.json', 8000).then(JSON.parse),
    fetchText('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?filter=account_type:eq:Treasury%20General%20Account%20%28TGA%29%20Closing%20Balance&sort=-record_date&page%5Bsize%5D=30', 8000).then(JSON.parse),
  ])

  const sofr = (sofrPayload.refRates ?? []).map((row) => isoPoint(row.effectiveDate, row.percentRate)).reverse()
  const rrp = (rrpPayload.repo?.operations ?? []).map((row) => isoPoint(row.operationDate, row.totalAmtAccepted / 1e9)).reverse()
  const tga = (tgaPayload.data ?? []).map((row) => isoPoint(row.record_date, Number(row.open_today_bal) / 1000)).reverse()

  return [
    seriesMetric({
      id: 'sofr', symbol: 'SOFR', category: 'macro', name: 'SOFR 隔夜利率', unit: '%', decimals: 2,
      changeKind: 'basisPoints', cadence: 'daily', source: '纽约联储', sourceUrl: 'https://markets.newyorkfed.org/read?productCode=50&eventCodes=525&startDt=&endDt=&sort=postDt:-1,eventCode:1&format=csv',
    }, sofr),
    seriesMetric({
      id: 'rrp', symbol: 'ON-RRP', category: 'macro', name: '隔夜逆回购余额', unit: '十亿美元', decimals: 2,
      changeKind: 'absolute', cadence: 'daily', source: '纽约联储', sourceUrl: 'https://markets.newyorkfed.org/read?productCode=70&eventCodes=730&startDt=&endDt=&sort=postDt:-1,eventCode:1&format=csv',
    }, rrp),
    seriesMetric({
      id: 'tga', symbol: 'TGA', category: 'macro', name: '美国财政部现金余额', unit: '十亿美元', decimals: 1,
      changeKind: 'absolute', cadence: 'daily', source: '美国财政部 Fiscal Data', sourceUrl: 'https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/operating-cash-balance',
    }, tga),
  ]
}

function isoDateDaysAgo(days) {
  const date = new Date(Date.now() - days * 86400000)
  return date.toISOString().slice(0, 10)
}

export async function fetchFredMetric(metric) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${metric.series}&cosd=${isoDateDaysAgo(100)}`
  const rows = parseCsv(await fetchText(url, 7500))
  const points = rows.slice(1)
    .map((row) => ({ time: `${row[0]}T21:00:00.000Z`, value: Number(row[1]) }))
    .filter((point) => Number.isFinite(point.value))
    .slice(-23)
  if (points.length < 2) throw new Error(`FRED ${metric.series} 有效数据不足`)
  const latest = points.at(-1)
  return {
    ...metric,
    symbol: metric.series,
    source: 'FRED',
    sourceUrl: `https://fred.stlouisfed.org/series/${metric.series}`,
    value: latest.value,
    ...calculateChanges(points, metric.changeKind),
    points: points.map((point) => point.value),
    asOf: latest.time,
    available: true,
  }
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      try {
        results[index] = { status: 'fulfilled', value: await mapper(items[index]) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}
