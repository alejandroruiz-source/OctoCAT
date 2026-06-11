import { test, expect, type Page } from '@playwright/test'

const BUYER_HEADERS = {
  'x-test-user-id': 'buyer-e2e-001',
  'x-test-user-role': 'BUYER',
}

// Helper: create a PO via API and return its ID
async function createPO(page: Page, supplierId: string, branchId: string): Promise<string> {
  const response = await page.request.post('http://localhost:3000/api/v1/purchase-orders', {
    headers: BUYER_HEADERS,
    data: { supplierId, branchId },
  })
  expect(response.ok()).toBeTruthy()
  const po = await response.json()
  return po.id
}

// Helper: add a line item via API
async function addLineItem(page: Page, poId: string, item: {
  productId: string; productName: string; quantity: number; unitPriceCents: number
}): Promise<string> {
  const response = await page.request.post(
    `http://localhost:3000/api/v1/purchase-orders/${poId}/line-items`,
    { headers: BUYER_HEADERS, data: item },
  )
  expect(response.ok()).toBeTruthy()
  const li = await response.json()
  return li.id
}

test.describe('Buyer Draft Flow (US1)', () => {
  test.use({
    extraHTTPHeaders: {
      'x-test-user-id': 'buyer-e2e-001',
      'x-test-user-role': 'BUYER',
    },
  })

  test('create PO → add 2 line items → edit quantity → delete item → cancel', async ({ page }) => {
    // Seed: create a draft PO
    const poId = await createPO(page, 'supplier-seed-001', 'branch-seed-001')
    const li1Id = await addLineItem(page, poId, {
      productId: 'prod-001',
      productName: 'Widgets',
      quantity: 5,
      unitPriceCents: 1000,
    })
    await addLineItem(page, poId, {
      productId: 'prod-002',
      productName: 'Bolts',
      quantity: 100,
      unitPriceCents: 50,
    })

    // Open PO detail page
    await page.goto(`/buyer/po/${poId}`)
    await expect(page.getByText('Widgets')).toBeVisible()
    await expect(page.getByText('Bolts')).toBeVisible()

    // Verify running total ($50 + $50 = $100)
    await expect(page.getByText(/\$100\.00/)).toBeVisible()

    // Edit quantity of Widgets (line item 1)
    await page.getByTestId(`edit-${li1Id}`).click()
    const qtyInput = page.getByLabel(/quantity/i)
    await qtyInput.clear()
    await qtyInput.fill('10')
    await page.getByRole('button', { name: /save/i }).click()

    // Total should update to $100 + $50 = $150
    await expect(page.getByText(/\$150\.00/)).toBeVisible()

    // Delete Bolts line item
    const boltsRow = page.getByText('Bolts').locator('..')
    await boltsRow.getByRole('button', { name: /delete/i }).click()
    await expect(page.getByText('Bolts')).not.toBeVisible()

    // Total should now be $100 (10 × $10)
    await expect(page.getByText(/\$100\.00/)).toBeVisible()

    // Cancel PO
    await page.getByRole('button', { name: /cancel po/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /^cancel po$/i }).click()

    // Status should be Cancelled
    await expect(page.getByText('Cancelled')).toBeVisible()
  })
})

test.describe('Buyer Submit Flow (US2)', () => {
  test.use({
    extraHTTPHeaders: {
      'x-test-user-id': 'buyer-e2e-001',
      'x-test-user-role': 'BUYER',
    },
  })

  test('submit low-value PO → status becomes Submitted', async ({ page }) => {
    const poId = await createPO(page, 'supplier-seed-001', 'branch-seed-001')
    await addLineItem(page, poId, {
      productId: 'prod-001',
      productName: 'Cheap Item',
      quantity: 1,
      unitPriceCents: 100_00, // $100
    })

    await page.goto(`/buyer/po/${poId}`)
    await page.getByRole('button', { name: /submit/i }).click()

    // No approval threshold notice expected
    await expect(page.getByText(/requires.*approval/i)).not.toBeVisible()

    const deliveryInput = page.getByLabel(/expected delivery date/i)
    await deliveryInput.fill('2027-01-15')
    await page.getByRole('button', { name: /confirm submit/i }).click()

    await expect(page.getByText('Submitted')).toBeVisible()

    // Fields should be read-only: no "Add Line Item" button
    await expect(page.getByRole('button', { name: /add line item/i })).not.toBeVisible()
  })

  test('submit high-value PO → approval notice shown → status becomes Awaiting Approval', async ({ page }) => {
    const poId = await createPO(page, 'supplier-seed-001', 'branch-seed-001')
    await addLineItem(page, poId, {
      productId: 'prod-expensive',
      productName: 'Expensive Item',
      quantity: 1,
      unitPriceCents: 1_500_000, // $15,000
    })

    await page.goto(`/buyer/po/${poId}`)
    await page.getByRole('button', { name: /submit/i }).click()

    // Approval threshold notice MUST appear
    await expect(page.getByText(/requires.*approval/i)).toBeVisible()

    const deliveryInput = page.getByLabel(/expected delivery date/i)
    await deliveryInput.fill('2027-01-15')
    await page.getByRole('button', { name: /confirm submit/i }).click()

    await expect(page.getByText(/awaiting approval/i)).toBeVisible()
  })
})
