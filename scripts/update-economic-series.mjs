import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ProxyAgent, fetch as httpFetch } from 'undici'

import { parseFredSeries } from '../api/lib/providers.js'

const SERIES = ['BAMLH0A0HYM2', 'WALCL', 'ICSA', 'RSAFS', 'INDPRO', 'HOUST']
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(root, 'data/economic-series.json')
const temporaryPath = `${outputPath}.tmp`
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined

function startDate() {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - 3)
  return date.toISOString().slice(0, 10)
}

async function fetchSeries(series) {
  const url = new URL('https://fred.stlouisfed.org/graph/fredgraph.csv')
  url.searchParams.set('id', series)
  url.searchParams.set('cosd', startDate())
  const response = await httpFetch(url, {
    headers: {
      accept: 'text/csv',
      'user-agent': 'MacroMarketRadarDataBot/1.0',
    },
    signal: AbortSignal.timeout(30000),
    ...(dispatcher ? { dispatcher } : {}),
  })
  if (!response.ok) throw new Error(`${series}: HTTP ${response.status}`)
  const points = parseFredSeries(await response.text(), series).slice(-36)
  if (points.length < 2) throw new Error(`${series}: insufficient observations`)
  return [series, { points }]
}

const entries = await Promise.all(SERIES.map(fetchSeries))
const latestObservation = entries
  .flatMap(([, entry]) => entry.points.map((point) => point.date))
  .sort()
  .at(-1)
const snapshot = {
  generatedAt: `${latestObservation}T21:00:00.000Z`,
  series: Object.fromEntries(entries),
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
await rename(temporaryPath, outputPath)
console.log(`Updated ${entries.length} economic series at ${snapshot.generatedAt}`)
