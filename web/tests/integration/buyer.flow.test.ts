import { test, expect, type Page } from '@playwright/test'

const BUYER_HEADERS = {
  'x-test-user-id': 'test-buyer-001',
  'x-test-user-role': 'BUYER',
}

// Must be valid UUIDs — backend schema validates format: 'uuid'
const SEED_SUPPLIER_ID = '00000000-0000-0000-0000-000000000001'
const SEED_BRANCH_ID   = '00000000-0000-0000-0000-000000000002'
const PROD_WIDGETS     = '00000000-0000-0000-0000-000000000010'
const PROD_BOLTS       = '00000000-0000-0000-0000-000000000011'
const PROD_CHEAP       = '00000000-0000-0000-0000-000000000012'
const PROD_EXPENSIVE   = '00000000-0000-0000-0000-000000000013'

// Helper: create a PO via API and return its ID
async function createPO(page: Page, supplierId: string, branchId: string): Promise<string> {
  const response = await page.request.post('http://localhost:3000/api/v1/purchase-orders', {
    headers: BUYER_HEADERS,
    data: { supplierId, branchId },
  })
  if (!response.ok()) {
    throw new Error(`createPO failed ${response.status()}: ${await response.text()}`)
  }
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
  if (!response.ok()) {
    throw new Error(`addLineItem failed ${response.status()}: ${await response.text()}`)
  }
  const li = await response.json()
  return li.id
}

test.describe('Buyer Draft Flow (US1)', () => {
  test.use({
    extraHTTPHeaders: {
      'x-test-user-id': 'test-buyer-001',
      'x-test-user-role': 'BUYER',
    },
  })

  test('create PO → add 2 line items → edit quantity → delete item → cancel', async ({ page }) => {
    // Seed: create a draft PO
    const poId = await createPO(page, SEED_SUPPLIER_ID, SEED_BRANCH_ID)
    const li1Id = await addLineItem(page, poId, {
      productId: PROD_WIDGETS,
      productName: 'Widgets',
      quantity: 5,
      unitPriceCents: 1000,
    })
    const li2Id = await addLineItem(page, poId, {
      productId: PROD_BOLTS,
      productName: 'Bolts',
      quantity: 100,
      unitPriceCents: 50,
    })

    // Open PO detail page
    await page.goto(`/buyer/po/${poId}`)
    await expect(page.getByText('Widgets')).toBeVisible()
    await expect(page.getByText('Bolts')).toBeVisible()

    // Verify running total ($50 + $50 = $100)
    await expect(page.getByText(/Total:.*\$100\.00/)).toBeVisible()

    // Edit quantity of Widgets (line item 1)
    await page.getByTestId(`edit-${li1Id}`).click()
    const qtyInput = page.getByLabel(/quantity/i)
    await qtyInput.fill('10')
    await page.getByRole('button', { name: /save/i }).click()

    // Total should update to $100 + $50 = $150
    await expect(page.getByText(/Total:.*\$150\.00/)).toBeVisible()

    // Delete Bolts line item
    await page.getByTestId(`delete-${li2Id}`).click()
    await expect(page.getByText('Bolts')).not.toBeVisible()

    // Total should now be $100 (10 × $10)
    await expect(page.getByText(/Total:.*\$100\.00/)).toBeVisible()

    // Cancel PO
    await page.getByRole('button', { name: /cancel po/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /cancel po/i }).click()

    // Status should be Cancelled
    await expect(page.getByText('Cancelled').first()).toBeVisible()
  })
})

test.describe('Buyer Submit Flow (US2)', () => {
  test.use({
    extraHTTPHeaders: {
      'x-test-user-id': 'test-buyer-001',
      'x-test-user-role': 'BUYER',
    },
  })

  test('submit low-value PO → status becomes Submitted', async ({ page }) => {
    const poId = await createPO(page, SEED_SUPPLIER_ID, SEED_BRANCH_ID)
    await addLineItem(page, poId, {
      productId: PROD_CHEAP,
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

    await expect(page.getByText('Submitted').first()).toBeVisible()

    // Fields should be read-only: no "Add Line Item" button
    await expect(page.getByRole('button', { name: /add line item/i })).not.toBeVisible()
  })

  test('submit high-value PO → approval notice shown → status becomes Awaiting Approval', async ({ page }) => {
    const poId = await createPO(page, SEED_SUPPLIER_ID, SEED_BRANCH_ID)
    await addLineItem(page, poId, {
      productId: PROD_EXPENSIVE,
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

    await expect(page.getByText(/awaiting approval/i).first()).toBeVisible()
  })
})
