import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { getMarketSnapshot } from './api/lib/market.js'

function localMarketApi() {
  return {
    name: 'local-market-api',
    configureServer(server) {
      server.middlewares.use('/api/market', async (request, response) => {
        try {
          const url = new URL(request.url || '/', 'http://localhost')
          const snapshot = await getMarketSnapshot({ force: url.searchParams.get('refresh') === '1' })
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify(snapshot))
        } catch (error) {
          response.statusCode = 503
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ error: '市场数据暂时不可用', detail: error.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localMarketApi()],
  server: {
    host: '0.0.0.0',
    port: 4182,
  },
})
