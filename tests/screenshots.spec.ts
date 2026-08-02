import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const screenshotDir = resolve('docs/screenshots')

test('genera capturas comerciales de escritorio y móvil', async ({ page }) => {
  mkdirSync(screenshotDir, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 980 })
  await page.emulateMedia({ reducedMotion: 'reduce' })

  const capture = async (path: string, file: string, heading: string) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await page.waitForTimeout(1700)
    await page.screenshot({ path: resolve(screenshotDir, file), fullPage: false })
  }

  await capture('/dashboard', 'dashboard.png', 'El campo, claro desde el primer vistazo')
  await capture('/animales', 'animals.png', 'Animales')
  await capture('/animales/animal-014', 'animal-detail.png', 'CH-202014')
  await capture('/consistencia', 'reproductive-consistency.png', 'Consistencia reproductiva')
  await capture('/produccion', 'milk-production.png', 'Producción de leche')
  await capture('/sanidad', 'health.png', 'Sanidad')
  await capture('/inventario', 'inventory.png', 'Inventario')
  await capture('/tareas', 'tasks.png', 'Tareas')
  await capture('/comercial', 'commercial-analytics.png', 'Analítica de la demo')

  await page.setViewportSize({ width: 390, height: 844 })
  await capture('/dashboard', 'mobile-home.png', 'El campo, claro desde el primer vistazo')
})
