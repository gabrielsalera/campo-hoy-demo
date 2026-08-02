import { expect, test } from '@playwright/test'

test('recorrido comercial completo con persistencia', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'El campo, claro desde el primer vistazo' })).toBeVisible()

  await page.getByTestId('stock-difference-card').click()
  await expect(page.getByRole('heading', { name: 'Diferencia de stock' })).toBeVisible()
  await page.getByRole('button', { name: 'Investigar diferencia' }).click()
  await expect(page).toHaveURL(/\/consistencia$/)

  const alert = page.locator('.alert-row').filter({ hasText: 'Parto sin cría' })
  await alert.getByRole('button', { name: 'Revisar' }).click()
  const alertDialog = page.getByRole('dialog', { name: 'Parto sin cría' })
  await expect(alertDialog).toBeVisible()
  await alertDialog.getByRole('link', { name: /CH-202014/ }).click()
  await expect(page).toHaveURL(/\/animales\/animal-014$/)
  await expect(page.getByRole('heading', { name: 'CH-202014' })).toBeVisible()

  await page.goto('/nacimientos')
  const stockBefore = await page.locator('.animal-summary-strip').count()
  await page.getByTestId('birth-tag').fill('CH-209001')
  await page.getByTestId('save-birth').click()
  await expect(page.getByTestId('birth-success')).toContainText('incrementó el stock')
  expect(stockBefore).toBe(0)
  await page.waitForTimeout(250)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('button', { name: /Stock total 487/ })).toBeVisible()

  await page.getByRole('link', { name: 'Producción de leche' }).click()
  await page.getByTestId('milk-liters').fill('1900')
  await page.getByTestId('save-milk').click()
  await expect(page.getByTestId('milk-success')).toContainText('1.900 L')
  await expect(page.getByTestId('milk-chart')).toBeVisible()

  await page.waitForTimeout(250)
  await page.goto('/sanidad?animal=animal-001')
  await expect(page.getByRole('heading', { name: 'Registrar tratamiento' })).toBeVisible()
  await page.getByTestId('save-treatment').click()
  await expect(page.getByTestId('treatment-success')).toContainText('Su leche queda excluida')
  await expect(page.getByText('animales no pueden ingresar al tanque')).toBeVisible()

  await page.goto('/tareas')
  await page.getByTestId('complete-task').click()
  await expect(page.getByTestId('task-success')).toContainText('completada')

  await page.goto('/encuesta')
  await page.getByTestId('survey-animal-count').fill('520')
  await page.getByTestId('submit-survey').click()
  await expect(page.getByTestId('survey-success')).toContainText('Respuesta guardada')

  await page.goto('/comercial')
  await expect(page.getByTestId('analytics-surveys')).toContainText('Pablo García')

  await page.waitForTimeout(350)
  await page.reload()
  await expect(page.getByTestId('analytics-surveys')).toContainText('Pablo García')
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: /Stock total 487/ })).toBeVisible()
})
