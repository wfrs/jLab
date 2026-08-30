import { test, expect, Page } from '@playwright/test';

/**
 * Does the sheet on paper match the sheet in `plasmid_labels.docx`?
 *
 * The Jest suite proves the arithmetic and that the numbers reach the markup.
 * Only a browser can answer whether 35.56 mm of declared width is 35.56 mm of
 * laid-out box, and only a real print pipeline can show whether the sheet
 * paginates cleanly. That is all this file does.
 *
 * The label API is intercepted rather than seeded, so these tests neither read
 * nor write the lab's database and stay deterministic.
 */

/** CSS defines exactly 96 px per inch, so this conversion is exact */
const PX_PER_MM = 96 / 25.4;
const mm = (px: number) => px / PX_PER_MM;

/** Straight from the .docx: <w:gridCol w:w="2016"/>, <w:pgMar w:*="1440"/> */
const CELL_WIDTH_MM = 35.56;
/** Four 8 pt lines + <w:tblCellMar> padding + CELL_SLACK_MM */
const CELL_HEIGHT_MM = 16.1986;
const MARGIN_MM = 25.4;
const COLUMNS = 4;
const ROWS = 15;
const PER_PAGE = COLUMNS * ROWS;

/** A sub-millimetre tolerance absorbs sub-pixel rounding, nothing more */
const TOLERANCE_MM = 0.2;
/** Borders round to whole pixels, so some boxes are exactly one px larger */
const ONE_PX_MM = 25.4 / 96;

interface LabelFixture {
  plasmidId: string;
  accession: string;
  constructName: string | null;
  operatorInitials: string | null;
  preppedOn: string | null;
  concentrationNgUl: number | null;
}

function makeLabels(count: number, constructName?: string): LabelFixture[] {
  return Array.from({ length: count }, (_, index) => ({
    plasmidId: `p${index + 1}`,
    accession: `pJM${String(index + 1).padStart(4, '0')}`,
    constructName: constructName ?? `pMiso${String(index).padStart(3, '0')}`,
    operatorInitials: 'JM',
    preppedOn: '2024-01-31',
    concentrationNgUl: 80,
  }));
}

/** Serve exactly the ids the client asks for, so its 50-id chunking still works */
async function stubLabels(page: Page, labels: LabelFixture[]): Promise<void> {
  const byId = new Map(labels.map((label) => [label.plasmidId, label]));

  await page.route('**/api/labels/plasmids*', async (route) => {
    const requested = new URL(route.request().url()).searchParams.get('ids') ?? '';
    const wanted = requested
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => byId.get(id))
      .filter((label): label is LabelFixture => Boolean(label));

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

  // Never record a print against the real database from a test. GET on the
  // same path lists past sheets, so the method matters.
  await page.route('**/api/labels/prints*', async (route) => {
    const isPost = route.request().method() === 'POST';
    await route.fulfill({
      status: isPost ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: isPost ? { recorded: 0, printedAt: new Date().toISOString() } : { batches: [] },
        correlationId: 'e2e',
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

async function openSheet(page: Page, labels: LabelFixture[]): Promise<void> {
  await stubLabels(page, labels);
  const ids = labels.map((label) => label.plasmidId).join(',');
  await page.goto(`/labels/print?kind=plasmid&ids=${ids}`);
  await page.locator('.label-content').first().waitFor();
}

test.describe('label sheet geometry', () => {
  test('a sheet is A4 with the document’s 25.4 mm margins', async ({ page }) => {
    await openSheet(page, makeLabels(4));

    const box = await page.locator('.label-page').first().boundingBox();
    expect(box).not.toBeNull();
    expect(mm(box!.width)).toBeCloseTo(210, 1);
    expect(mm(box!.height)).toBeCloseTo(297, 1);

    // The grid must start exactly one margin in from the sheet's edge
    const grid = await page.locator('.label-grid').first().boundingBox();
    expect(mm(grid!.x - box!.x)).toBeCloseTo(MARGIN_MM, 1);
    expect(mm(grid!.y - box!.y)).toBeCloseTo(MARGIN_MM, 1);
  });

  test('the grid hugs its columns, so no rule sticks out past the last label', async ({ page }) => {
    // A grid block stretches to its container by default, which ran the top
    // border the full printable width — 17 mm of it beyond the last column.
    await openSheet(page, makeLabels(PER_PAGE));

    const grid = (await page.locator('.label-grid').first().boundingBox())!;

    // The grid box carries its own left border on top of the four tracks, and
    // a 0.5 pt border lays out as one whole pixel.
    const expectedMm = COLUMNS * CELL_WIDTH_MM + ONE_PX_MM;
    expect(Math.abs(mm(grid.width) - expectedMm)).toBeLessThan(TOLERANCE_MM);

    // The point of the test: the top rule stops at the last column
    const cells = await page.locator('.label-page').first().locator('.label-cell').all();
    const lastInRow = (await cells[COLUMNS - 1]!.boundingBox())!;
    expect(mm(grid.x + grid.width - (lastInRow.x + lastInRow.width))).toBeLessThan(TOLERANCE_MM);
  });

  test('cells measure 35.56 mm wide on the page, not just in the stylesheet', async ({ page }) => {
    await openSheet(page, makeLabels(8));

    const box = await page.locator('.label-cell').first().boundingBox();
    expect(Math.abs(mm(box!.width) - CELL_WIDTH_MM)).toBeLessThan(TOLERANCE_MM);
    expect(Math.abs(mm(box!.height) - CELL_HEIGHT_MM)).toBeLessThan(TOLERANCE_MM);
  });

  test('the grid is 4 columns wide', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE));

    const boxes = await page.locator('.label-page').first().locator('.label-cell').all();
    const firstRowY = (await boxes[0]!.boundingBox())!.y;

    const xsInFirstRow = new Set<number>();
    for (const cell of boxes) {
      const box = (await cell.boundingBox())!;
      if (Math.abs(box.y - firstRowY) < 1) {
        xsInFirstRow.add(Math.round(box.x));
      }
    }

    expect(xsInFirstRow.size).toBe(COLUMNS);
  });

  test('a full sheet holds 60 cells — 15 rows of 4, as Word laid out page 1', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE));

    const sheets = page.locator('.label-page');
    await expect(sheets).toHaveCount(1);
    await expect(sheets.first().locator('.label-cell')).toHaveCount(PER_PAGE);
  });

  test('the 61st label starts a second sheet, and the blanks keep their borders', async ({
    page,
  }) => {
    await openSheet(page, makeLabels(PER_PAGE + 1));

    const sheets = page.locator('.label-page');
    await expect(sheets).toHaveCount(2);

    // Blank cells still print: the borders are the cut guides
    await expect(sheets.nth(1).locator('.label-cell')).toHaveCount(PER_PAGE);
    await expect(sheets.nth(1).locator('.label-content')).toHaveCount(1);
  });

  test('the whole grid stays inside the printable area', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE));

    const sheet = (await page.locator('.label-page').first().boundingBox())!;
    const cells = await page.locator('.label-page').first().locator('.label-cell').all();

    for (const cell of [cells[0]!, cells[COLUMNS - 1]!, cells[cells.length - 1]!]) {
      const box = (await cell.boundingBox())!;
      expect(mm(box.x - sheet.x)).toBeGreaterThanOrEqual(MARGIN_MM - TOLERANCE_MM);
      expect(mm(sheet.x + sheet.width - (box.x + box.width))).toBeGreaterThanOrEqual(
        MARGIN_MM - TOLERANCE_MM
      );
      expect(mm(sheet.y + sheet.height - (box.y + box.height))).toBeGreaterThanOrEqual(
        MARGIN_MM - TOLERANCE_MM
      );
    }
  });
});

test.describe('auto-fit', () => {
  test('an ordinary label stays at 8 pt', async ({ page }) => {
    await openSheet(page, makeLabels(1));

    const fontSize = await page
      .locator('.label-content')
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize);

    // 8 pt = 8 x 96/72 px
    expect(Number.parseFloat(fontSize)).toBeCloseTo((8 * 96) / 72, 1);
  });

  test('the construct name Julia shrank to 6 pt by hand fits without overflow', async ({
    page,
  }) => {
    // pJM0175's neighbourhood in plasmid_labels.docx; set at 6 pt by hand
    await openSheet(page, makeLabels(1, 'pMisoMFG_virEp-TrmAE358Q-GST-virD2(53C)-rnpBt'));

    const content = page.locator('.label-content').first();

    const overflow = await content.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      fontPx: Number.parseFloat(getComputedStyle(el).fontSize),
    }));

    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    // It had to shrink to get there
    expect(overflow.fontPx).toBeLessThan((8 * 96) / 72);

    // and the text is all still there, not truncated
    await expect(content).toContainText('pMisoMFG_virEp-TrmAE358Q-GST-virD2(53C)-rnpBt');
  });

  test('the longest name in the lab’s records still fits', async ({ page }) => {
    // 73 characters, the longest construct name in the document
    const longest = 'pMisoMFG_virEp-TrmAE358Q-virD2(53C)-rnpBt---Tetp-NLuc-FLAG-T7t(t-arm_pos)';
    await openSheet(page, makeLabels(1, longest));

    const content = page.locator('.label-content').first();
    const fits = await content.evaluate((el) => el.scrollHeight <= el.clientHeight);

    expect(fits).toBe(true);
    await expect(content).toContainText(longest);
  });

  test('a label never spills over its cell', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE));

    const spilling = await page
      .locator('.label-content')
      .evaluateAll(
        (elements) => elements.filter((el) => el.scrollHeight > el.clientHeight + 1).length
      );

    expect(spilling).toBe(0);
  });
});

test.describe('print output', () => {
  test('the app chrome and the toolbar are hidden on paper', async ({ page }) => {
    await openSheet(page, makeLabels(4));

    await expect(page.locator('header').first()).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('header').first()).toBeHidden();
    await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
    await expect(page.locator('.label-page').first()).toBeVisible();
  });

  test('one sheet produces exactly one PDF page, with no blank page after it', async ({ page }) => {
    // The regression this guards: a sheet even a hundredth of a millimetre
    // wider than A4 makes Chromium emit a trailing blank page every time.
    await openSheet(page, makeLabels(PER_PAGE));

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBe(1);
  });

  test('three sheets produce exactly three PDF pages', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE * 2 + 1));

    await expect(page.locator('.label-page')).toHaveCount(3);

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBe(3);
  });
});

test.describe('empty selection', () => {
  test('says what to do instead of rendering a blank sheet', async ({ page }) => {
    await stubLabels(page, []);
    await page.goto('/labels/print?kind=plasmid&ids=');

    // Next injects its own role="alert" route announcer, hence the scoping
    await expect(page.locator('.print-hidden [role="alert"]')).toContainText(
      'No plasmids selected'
    );
    await expect(page.locator('.label-page')).toHaveCount(0);

    // and the dead end offers a way out: a past sheet to print again
    await expect(
      page.getByText(/Nothing has been printed from jlab yet|Reprint a sheet/)
    ).toBeVisible();
  });
});

test.describe('dense layout', () => {
  test('the toggle re-lays the sheet at 5 x 17 and halves the paper', async ({ page }) => {
    await openSheet(page, makeLabels(PER_PAGE + 1));

    // 61 labels need two sheets at 60 per sheet
    await expect(page.locator('.label-page')).toHaveCount(2);

    await page.getByRole('checkbox', { name: /Dense/ }).check();

    // and one at 85
    await expect(page.locator('.label-page')).toHaveCount(1);
    await expect(page.locator('.label-page').first().locator('.label-cell')).toHaveCount(85);

    const sheet = (await page.locator('.label-page').first().boundingBox())!;
    const grid = (await page.locator('.label-grid').first().boundingBox())!;
    expect(mm(grid.x - sheet.x)).toBeCloseTo(10, 0);
  });

  test('the label itself is unchanged — only the margins are', async ({ page }) => {
    await openSheet(page, makeLabels(8));

    const before = (await page.locator('.label-cell').first().boundingBox())!;
    await page.getByRole('checkbox', { name: /Dense/ }).check();
    const after = (await page.locator('.label-cell').first().boundingBox())!;

    expect(Math.abs(mm(after.width) - mm(before.width))).toBeLessThan(TOLERANCE_MM);
    expect(Math.abs(mm(after.height) - mm(before.height))).toBeLessThan(TOLERANCE_MM);
    expect(Math.abs(mm(after.width) - CELL_WIDTH_MM)).toBeLessThan(TOLERANCE_MM);
  });

  test('a dense sheet still prints as one PDF page', async ({ page }) => {
    await openSheet(page, makeLabels(85));
    await page.getByRole('checkbox', { name: /Dense/ }).check();
    await expect(page.locator('.label-page')).toHaveCount(1);

    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;

    expect(pageCount).toBe(1);
  });
});

test.describe('start cell picker', () => {
  test('clicking a cell leaves that many blanks before the first label', async ({ page }) => {
    await openSheet(page, makeLabels(4));

    const picker = page.getByRole('group', { name: 'First free cell on the sheet' });
    await picker.getByRole('button', { name: 'Start at cell 3 of 60' }).click();

    const cells = page.locator('.label-page').first().locator('.label-cell');
    // The first two cells are blank; the third carries the first label
    await expect(cells.nth(0).locator('.label-content')).toHaveCount(0);
    await expect(cells.nth(1).locator('.label-content')).toHaveCount(0);
    await expect(cells.nth(2).locator('.label-content')).toHaveCount(1);
  });

  test('resets to a full sheet', async ({ page }) => {
    await openSheet(page, makeLabels(4));

    const picker = page.getByRole('group', { name: 'First free cell on the sheet' });
    await picker.getByRole('button', { name: 'Start at cell 5 of 60' }).click();
    await expect(page.locator('.label-cell').first().locator('.label-content')).toHaveCount(0);

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('.label-cell').first().locator('.label-content')).toHaveCount(1);
  });

  test('a start cell outside the denser grid falls back to a full sheet', async ({ page }) => {
    await openSheet(page, makeLabels(4));

    const picker = page.getByRole('group', { name: 'First free cell on the sheet' });
    await picker.getByRole('button', { name: 'Start at cell 59 of 60' }).click();
    await page.getByRole('checkbox', { name: /Dense/ }).check();

    // 58 is inside an 85-cell grid, so it survives the switch
    await expect(page.locator('.label-page')).toHaveCount(1);
    await expect(page.locator('.label-content')).toHaveCount(4);
  });
});
