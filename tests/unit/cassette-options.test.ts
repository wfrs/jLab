/**
 * Unit Tests: cassette reuse options for the plasmid table (pure logic)
 */

import {
  cassetteOptions,
  filterCassetteOptions,
  groupCassettesByPlasmid,
  joinCassetteContents,
  MAX_CASSETTE_OPTIONS,
  splitCassetteContents,
} from '@/components/plasmids/cassette-options';
import { Cassette } from '@/domain/types';

let counter = 0;
function cassette(plasmidId: string, name: string, position = 0): Cassette {
  counter += 1;
  return {
    id: `c${counter}`,
    plasmidId,
    name,
    type: 'other',
    position,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const EGFP = 'Pt7-EGFP-tag6His-Tt7';
const RFP = 'Pt7-RFP-Tt7';

describe('cassette-options', () => {
  describe('groupCassettesByPlasmid', () => {
    it('groups by plasmid in position order', () => {
      const grouped = groupCassettesByPlasmid([
        cassette('p1', RFP, 1),
        cassette('p2', EGFP, 0),
        cassette('p1', EGFP, 0),
      ]);
      expect(grouped.get('p1')?.map((c) => c.name)).toEqual([EGFP, RFP]);
      expect(grouped.get('p2')?.map((c) => c.name)).toEqual([EGFP]);
      expect(grouped.has('p3')).toBe(false);
    });
  });

  describe('cassetteOptions', () => {
    it('counts plasmids per distinct content, most used first then alphabetical', () => {
      const options = cassetteOptions([
        cassette('p1', EGFP),
        cassette('p2', EGFP),
        cassette('p2', EGFP, 1), // same plasmid twice counts once
        cassette('p3', 'Aaa-Bbb'),
        cassette('p4', RFP),
      ]);
      expect(options).toEqual([
        { content: EGFP, count: 2 },
        { content: 'Aaa-Bbb', count: 1 },
        { content: RFP, count: 1 },
      ]);
    });

    it('trims contents and skips blank ones', () => {
      expect(cassetteOptions([cassette('p1', `  ${RFP} `), cassette('p2', '   ')])).toEqual([
        { content: RFP, count: 1 },
      ]);
    });

    it('is empty for an empty library', () => {
      expect(cassetteOptions([])).toEqual([]);
    });
  });

  describe('filterCassetteOptions', () => {
    const options = cassetteOptions([cassette('p1', EGFP), cassette('p2', RFP)]);

    it('matches case-insensitively anywhere in the content', () => {
      expect(filterCassetteOptions(options, 'rfp').map((o) => o.content)).toEqual([RFP]);
      expect(filterCassetteOptions(options, 'PT7').map((o) => o.content)).toEqual([EGFP, RFP]);
      expect(filterCassetteOptions(options, 'xyz')).toEqual([]);
    });

    it('caps the list', () => {
      const many = cassetteOptions(
        Array.from({ length: MAX_CASSETTE_OPTIONS + 5 }, (_, i) => cassette(`p${i}`, `cas${i}`))
      );
      expect(filterCassetteOptions(many, '')).toHaveLength(MAX_CASSETTE_OPTIONS);
      expect(filterCassetteOptions(many, '', 3)).toHaveLength(3);
    });
  });

  describe('join / split', () => {
    it('round-trips a plasmid’s cassettes through one cell', () => {
      const list = [cassette('p1', EGFP, 0), cassette('p1', RFP, 1)];
      const joined = joinCassetteContents(list);
      expect(joined).toBe(`${EGFP}; ${RFP}`);
      expect(splitCassetteContents(joined)).toEqual([EGFP, RFP]);
    });

    it('drops blanks when splitting', () => {
      expect(splitCassetteContents(` ${RFP} ;; ; `)).toEqual([RFP]);
      expect(splitCassetteContents('')).toEqual([]);
    });
  });
});
