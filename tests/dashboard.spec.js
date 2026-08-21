import { expect, test } from '@playwright/test'

test('桌面端显示市场状态、主要分区和逐项新鲜度', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('经纬雷达')).toBeVisible()
  await expect(page.getByRole('heading', { name: '全球股市' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '美股七姐妹' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '消费' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '金融与地产' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '债市与信用' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '经济底盘' })).toBeVisible()
  await expect(page.getByText('结构信号', { exact: true })).toBeVisible()
  await expect(page.getByText('2s10s 期限曲线')).toBeVisible()
  await expect(page.locator('.freshness').first()).toBeVisible()
  await page.locator('.metric-tile').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('数据时点')).toBeVisible()
})

test('iPhone 12 Pro Max 没有横向溢出且双列热力块可读', async ({ page }) => {
  await page.setViewportSize({ width: 428, height: 926 })
  await page.goto('/')
  await expect(page.getByText('经纬雷达')).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)
  const columns = await page.locator('.metric-grid').first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  expect(columns).toBe(2)
})

test('PWA 元数据与 iPhone 主屏图标可用', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')

  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest.short_name).toBe('经纬雷达')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((icon) => icon.purpose)).toContain('maskable')

  const serviceWorkerResponse = await request.get('/sw.js')
  expect(serviceWorkerResponse.ok()).toBe(true)
  const serviceWorker = await serviceWorkerResponse.text()
  expect(serviceWorker).toContain("url.pathname.startsWith('/api/')")
})
