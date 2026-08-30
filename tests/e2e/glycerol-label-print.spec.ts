import { test, expect, Page } from '@playwright/test';

/**
 * Glycerol stock labels in a real browser.
 *
 * The plasmid spec covers the shared grid machinery; this covers what is
 * specific to the glycerol sheet — the wider cell, left alignment, and the one
 * place the originals mix styles inside a line: `E. coli` italic beside a
 * roman `TOP10`.
 *
 * The API is intercepted, so nothing here reads or writes the lab's database.
 */

const PX_PER_MM = 96 / 25.4;
const mm = (px: number) => px / PX_PER_MM;

/** `<w:gridCol w:w="2160"/>`, against 2016 on the plasmid sheet */
const CELL_WIDTH_MM = 38.1;
const COLUMNS = 4;
const PER_PAGE = COLUMNS * 15;
const TOLERANCE_MM = 0.2;

interface StockFixture {
  id: string;
  stockId: string;
  organism: string;
  strain: string;
  operatorInitials: string | null;
  constructName: string | null;
  accession: string | null;
  madeOn: string | null;
}

function makeStocks(count: number, overrides: Partial<StockFixture> = {}): StockFixture[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    stockId: `CJM${index + 1}`,
    organism: 'E. coli',
    strain: 'TOP10',
    operatorInitials: null,
    constructName: `pMiso${String(index).padStart(3, '0')}`,
    accession: `pJM${String(index + 1).padStart(4, '0')}`,
    madeOn: '2024-01-23',
    ...overrides,
  }));
}

async function openSheet(page: Page, stocks: StockFixture[]): Promise<void> {
  const byId = new Map(stocks.map((stock) => [stock.id, stock]));

  await page.route('**/api/labels/glycerol*', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('ids') ?? '';
    const wanted = requested
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => byId.get(id))
      .filter((stock): stock is StockFixture => Boolean(stock));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { labels: wanted },
        correlationId: 'e2e',
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/labels/prints', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { recorded: 0, printedAt: new Date().toISOString() },
        correlationId: 'e2e',
        timestamp: new Date().toISOString(),
      }),
    });
  });

  const ids = stocks.map((stock) => stock.id).join(',');
  await page.goto(`/labels/print?kind=glycerol&ids=${ids}`);
  await page.locator('.label-content').first().waitFor();
}

test.describe('glycerol sheet geometry', () => {
  test('cells are 38.10 mm wide — wider than the plasmid label', async ({ page }) => {
    await openSheet(page, makeStocks(8));

    const box = (await page.locator('.label-cell').first().boundingBox())!;
    expect(Math.abs(mm(box.width) - CELL_WIDTH_MM)).toBeLessThan(TOLERANCE_MM);
  });

  test('four columns still fit, and the grid stays inside the margins', async ({ page }) => {
    await openSheet(page, makeStocks(PER_PAGE));

    const sheet = (await page.locator('.label-page').first().boundingBox())!;
    const grid = (await page.locator('.label-grid').first().boundingBox())!;

    // 4 x 38.10 = 152.4 mm inside a 159.2 mm printable width
    expect(mm(grid.width)).toBeLessThan(mm(sheet.width) - 2 * 25.4 + TOLERANCE_MM);
    await expect(page.locator('.label-page').first().locator('.label-cell')).toHaveCount(PER_PAGE);
  });

  test('the text is left-aligned, not centred like the plasmid label', async ({ page }) => {
    await openSheet(page, makeStocks(1));

    const align = await page
      .locator('.label-content')
      .first()
      .evaluate((el) => getComputedStyle(el).textAlign);

    expect(align).toBe('left');
  });
});

test.describe('glycerol label content', () => {
  test('the organism is italic and the strain is not', async ({ page }) => {
    // 470 of the lab's 472 labels do exactly this
    await openSheet(page, makeStocks(1));

    const styles = await page
      .locator('.label-content')
      .first()
      .locator('.label-line')
      .nth(1)
      .evaluate((line) =>
        [...line.querySelectorAll('span')].map((span) => ({
          text: span.textContent,
          fontStyle: getComputedStyle(span).fontStyle,
        }))
      );

    expect(styles).toEqual([
      { text: 'E. coli', fontStyle: 'italic' },
      { text: ' TOP10', fontStyle: 'normal' },
    ]);
  });

  test('only the stock ID is bold', async ({ page }) => {
    await openSheet(page, makeStocks(1));

    const weights = await page
      .locator('.label-content')
      .first()
      .locator('.label-line')
      .evaluateAll((lines) =>
        lines.map((line) => ({
          text: line.textContent,
          weight: getComputedStyle(line).fontWeight,
        }))
      );

    expect(weights[0]?.weight).toBe('700');
    expect(weights.slice(1).every((line) => line.weight !== '700')).toBe(true);
  });

  test('a three-line strain-only stock renders without a construct line', async ({ page }) => {
    await openSheet(
      page,
      makeStocks(1, {
        stockId: 'AJM1',
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90 (CPGE)',
        constructName: null,
        accession: null,
        madeOn: '2024-06-20',
      })
    );

    const lines = await page
      .locator('.label-content')
      .first()
      .locator('.label-line')
      .allTextContents();

    expect(lines).toEqual(['AJM1', 'A. tumefaciens GV3101 pMP90 (CPGE)', '20.06.2024']);
  });

  test('an aliquot prints under its own ID', async ({ page }) => {
    await openSheet(
      page,
      makeStocks(1, {
        stockId: 'AJM5.1',
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90 (Goldbio)',
        constructName: null,
        accession: null,
        madeOn: '2024-10-24',
      })
    );

    await expect(page.locator('.label-line').first()).toHaveText('AJM5.1');
  });

  test('the longest Agrobacterium name shrinks rather than overflowing', async ({ page }) => {
    await openSheet(
      page,
      makeStocks(1, {
        stockId: 'AJM30',
        organism: 'A. tumefaciens',
        strain: 'GV3101 pMP90',
        constructName: 'pMisoMFG_virEp-TrmAE358Q-virD2(53C)-rnpBt---Tetp-NLuc-FLAG-T7t(t-arm_pos)',
        accession: 'pJM0347',
        madeOn: '2025-03-25',
      })
    );

    const content = page.locator('.label-content').first();
    const fit = await content.evaluate((el) => ({
      overflows: el.scrollHeight > el.clientHeight,
      fontPx: Number.parseFloat(getComputedStyle(el).fontSize),
    }));

    expect(fit.overflows).toBe(false);
    expect(fit.fontPx).toBeLessThan((8 * 96) / 72);
    await expect(content).toContainText('(pJM0347)');
  });

  test('an ordinary stock label stays at 8 pt', async ({ page }) => {
    await openSheet(page, makeStocks(1));

    const fontSize = await page
      .locator('.label-content')
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize);

    expect(Number.parseFloat(fontSize)).toBeCloseTo((8 * 96) / 72, 1);
  });

  test('no label on a full sheet spills its cell', async ({ page }) => {
    await openSheet(page, makeStocks(PER_PAGE));

    const spilling = await page
      .locator('.label-content')
      .evaluateAll((els) => els.filter((el) => el.scrollHeight > el.clientHeight + 1).length);

    expect(spilling).toBe(0);
  });
});

test.describe('glycerol print output', () => {
  test('one sheet produces exactly one PDF page', async ({ page }) => {
    await openSheet(page, makeStocks(PER_PAGE));

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBe(1);
  });
});
