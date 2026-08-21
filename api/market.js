import { getMarketSnapshot } from './lib/market.js'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: '仅支持 GET 请求' })
  }

  try {
    const force = request.query?.refresh === '1'
    const snapshot = await getMarketSnapshot({ force })
    response.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    return response.status(200).json(snapshot)
  } catch (error) {
    response.setHeader('Cache-Control', 'no-store')
    return response.status(503).json({
      error: '市场数据暂时不可用',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
