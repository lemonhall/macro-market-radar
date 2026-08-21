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
