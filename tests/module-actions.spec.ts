import { expect, test } from '@playwright/test'

test('todos los módulos renderizan y las operaciones complementarias guardan', async ({ page }) => {
  const modules = [
    ['/dashboard', 'El campo, claro desde el primer vistazo'],
    ['/animales', 'Animales'],
    ['/consistencia', 'Consistencia reproductiva'],
    ['/nacimientos', 'Registrar un nacimiento'],
    ['/produccion', 'Producción de leche'],
    ['/reproduccion', 'Reproducción'],
    ['/sanidad', 'Sanidad'],
    ['/inventario', 'Inventario'],
    ['/lotes', 'Lotes y potreros'],
    ['/tareas', 'Tareas'],
    ['/clima', 'Lluvias y clima'],
    ['/datos', 'Importar y exportar'],
    ['/comercial', 'Analítica de la demo'],
    ['/encuesta', 'Tu mirada mejora el producto'],
  ]

  for (const [path, heading] of modules) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }

  await page.goto('/reproduccion')
  await page.getByRole('button', { name: 'Registrar evento' }).click()
  await page.getByRole('button', { name: 'Guardar evento' }).click()
  await expect(page.getByText('La ficha y la lista reproductiva se actualizaron.')).toBeVisible()

  await page.goto('/inventario')
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByText(/Compra guardada/)).toBeVisible()

  await page.goto('/lotes')
  const lot = page.locator('article.lot-card').filter({ hasText: 'Ordeñe 1' })
  await lot.getByRole('button', { name: 'Movimiento' }).click()
  await page.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(page.getByText(/Ingreso de 5 animales guardado/)).toBeVisible()

  await page.goto('/clima')
  await page.getByRole('button', { name: 'Cargar lluvia' }).click()
  await page.getByRole('button', { name: 'Guardar registro' }).click()
  await expect(page.getByText(/Lluvia registrada/)).toBeVisible()
})

test('importa CSV con mapeo, duplicados, válidas y rechazadas', async ({ page }) => {
  await page.goto('/datos')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'animales-demo.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      'caravana,categoria,establecimiento,estado',
      'CH-209999,Ternera,Tambo La Esperanza,Activo',
      'CH-202001,Vaca en ordeñe,Tambo La Esperanza,Activo',
    ].join('\n')),
  })
  await expect(page.getByText('2 filas · 4 columnas detectadas')).toBeVisible()
  await page.getByRole('button', { name: 'Validar archivo' }).click()
  await expect(page.getByText('Caravana duplicada')).toBeVisible()
  await expect(page.getByText('Válida', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar 1 filas' }).click()
  await expect(page.getByRole('heading', { name: 'Importación confirmada' })).toBeVisible()
  await expect(page.locator('.import-complete')).toContainText('1 filas válidas fueron importadas')
})
