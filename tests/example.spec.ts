import { test, expect } from '@playwright/test'

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/AI Helper/)
})

test('navigation is visible', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('nav, [role="navigation"]')
  await expect(nav).toBeVisible()
})

test('health check endpoint responds', async ({ context }) => {
  const response = await context.request.get('/api/health')
  expect(response.status()).toBe(200)
})
