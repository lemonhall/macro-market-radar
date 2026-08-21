import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const iconDirectory = resolve(root, 'public/icons')
const source = await readFile(resolve(iconDirectory, 'radar-mark.svg'), 'utf8')
const outputs = [
  ['favicon-32.png', 32],
  ['apple-touch-icon.png', 180],
  ['radar-192.png', 192],
  ['radar-512.png', 512],
  ['radar-maskable-512.png', 512],
]

await mkdir(iconDirectory, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })

try {
  for (const [name, size] of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`
      <style>
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #0e110f; }
        svg { display: block; width: 100%; height: 100%; }
      </style>
      ${source}
    `)
    await page.screenshot({ path: resolve(iconDirectory, name), omitBackground: false })
    await page.close()
  }
} finally {
  await browser.close()
}

console.log(`Generated ${outputs.length} PWA icons from public/icons/radar-mark.svg`)
