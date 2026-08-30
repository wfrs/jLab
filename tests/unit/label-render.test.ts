/**
 * The bridge between the tested geometry and the DOM that carries it.
 *
 * `label-layout.test.ts` proves the millimetres are right; this proves the
 * renderer actually emits them, so a refactor cannot quietly stop applying the
 * spec. Rendered with `renderToStaticMarkup` rather than a browser: there is no
 * layout engine here, so this checks structure and declared sizes, not the
 * measured fit. The fit itself is `useAutoFit`, whose stepping logic is covered
 * by `selectFontStep`.
 *
 * JSX would need a `.tsx` test file, which the suite's `testMatch` does not
 * pick up, hence `createElement`.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LabelCell, LabelSheet } from '@/components/labels/LabelSheet';
import { PlasmidLabel } from '@/components/labels/PlasmidLabel';
import { PLASMID_LABEL, labelsPerPage, paginate } from '@domain/label-layout';
import { PlasmidLabelData } from '@domain/label-content';

const pJM0001: PlasmidLabelData = {
  accession: 'pJM0001',
  constructName: 'pMiso000',
  operatorInitials: 'JM',
  preppedOn: '2024-01-31',
  concentrationNgUl: 80,
};

/** `useLayoutEffect` has nothing to do on the server; that warning is expected */
let consoleError: jest.SpyInstance;

beforeAll(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (first.includes('useLayoutEffect does nothing on the server')) {
      return;
    }
    throw new Error(`Unexpected console.error: ${first}`);
  });
});

afterAll(() => {
  consoleError.mockRestore();
});

function renderSheet(children: ReturnType<typeof createElement>[]): string {
  return renderToStaticMarkup(createElement(LabelSheet, { spec: PLASMID_LABEL }, ...children));
}

describe('LabelSheet', () => {
  it('is an A4 page with the document’s 25.4 mm margins', () => {
    const html = renderSheet([]);

    expect(html).toContain('width:210mm');
    expect(html).toContain('height:297mm');
    expect(html).toContain('padding:25.4mm');
  });

  it('lays out four columns at the cell width from <w:gridCol w:w="2016"/>', () => {
    const html = renderSheet([]);

    expect(html).toContain(`grid-template-columns:repeat(4, ${PLASMID_LABEL.cellWidthMm}mm)`);
    expect(html).toContain(`grid-auto-rows:${PLASMID_LABEL.cellHeightMm}mm`);
  });

  it('draws the top and left edges once, leaving the rest to the cells', () => {
    // Otherwise every interior line would be drawn twice and print heavy
    const html = renderSheet([createElement(LabelCell, { spec: PLASMID_LABEL, key: 'a' })]);

    expect(html).toContain('border-top-width:0.5pt');
    expect(html).toContain('border-left-width:0.5pt');
    expect(html).toContain('border-right-width:0.5pt');
    expect(html).toContain('border-bottom-width:0.5pt');
  });
});

describe('LabelCell', () => {
  it('applies the <w:tblCellMar> padding', () => {
    const html = renderToStaticMarkup(createElement(LabelCell, { spec: PLASMID_LABEL }));

    expect(html).toContain(`padding:${PLASMID_LABEL.padBlockMm}mm ${PLASMID_LABEL.padInlineMm}mm`);
  });

  it('renders a blank cell with its borders, because they are the cut guides', () => {
    const html = renderToStaticMarkup(createElement(LabelCell, { spec: PLASMID_LABEL }));

    expect(html).toContain('class="label-cell"');
    expect(html).toContain('border-bottom-width:0.5pt');
  });
});

describe('PlasmidLabel', () => {
  it('prints the four lines of pJM0001 in order', () => {
    const html = renderToStaticMarkup(
      createElement(PlasmidLabel, { data: pJM0001, spec: PLASMID_LABEL })
    );

    const lines = [...html.matchAll(/<div class="label-line[^"]*">([^<]*)<\/div>/g)].map(
      (match) => match[1]
    );

    expect(lines).toEqual(['pJM0001', 'pMiso000', 'JM 31.01.24', '80.0 ng/µL']);
  });

  it('bolds the accession and nothing else', () => {
    const html = renderToStaticMarkup(
      createElement(PlasmidLabel, { data: pJM0001, spec: PLASMID_LABEL })
    );

    expect(html).toMatch(/label-line-bold[^>]*>pJM0001</);
    expect((html.match(/label-line-bold/g) ?? []).length).toBe(1);
  });

  it('centres the text, matching the 1414 centred paragraphs in the original', () => {
    const html = renderToStaticMarkup(
      createElement(PlasmidLabel, { data: pJM0001, spec: PLASMID_LABEL })
    );

    expect(html).toContain('text-align:center');
  });

  it('drops the date and concentration for a plasmid that was never prepped', () => {
    const html = renderToStaticMarkup(
      createElement(PlasmidLabel, {
        data: { accession: 'pJM0355', constructName: 'pMisoPlanned' },
        spec: PLASMID_LABEL,
      })
    );

    const lines = [...html.matchAll(/<div class="label-line[^"]*">([^<]*)<\/div>/g)].map(
      (match) => match[1]
    );

    expect(lines).toEqual(['pJM0355', 'pMisoPlanned']);
  });

  it('survives the longest construct name in the lab’s records without truncating', () => {
    // 84 characters, the longest line in plasmid_labels.docx
    const longest = 'pMisoMFG_virEp-TrmAE358Q-virD2(53C)-rnpBt---Tetp-NLuc-FLAG-T7t(t-arm_pos)';

    const html = renderToStaticMarkup(
      createElement(PlasmidLabel, {
        data: { ...pJM0001, constructName: longest },
        spec: PLASMID_LABEL,
      })
    );

    expect(html).toContain(longest);
  });
});

describe('a full sheet', () => {
  it('renders one cell per grid position, blanks included', () => {
    const perPage = labelsPerPage(PLASMID_LABEL);
    const labels = Array.from({ length: 5 }, (_, index) => ({
      ...pJM0001,
      accession: `pJM${String(index + 1).padStart(4, '0')}`,
    }));

    const [page] = paginate(labels, PLASMID_LABEL);
    const children = (page ?? []).map((label, index) =>
      label
        ? createElement(PlasmidLabel, { data: label, spec: PLASMID_LABEL, key: index })
        : createElement(LabelCell, { spec: PLASMID_LABEL, key: index })
    );

    const html = renderSheet(children);

    expect((html.match(/class="label-cell"/g) ?? []).length).toBe(perPage);
    expect((html.match(/class="label-content"/g) ?? []).length).toBe(5);
  });
});
