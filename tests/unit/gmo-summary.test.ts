/**
 * Unit Tests: GMO summary derivation (legacy GMO_summary parity)
 */

import { buildGmoSummary, DESTROYED_PENDING } from '@domain/gmo-summary';

describe('buildGmoSummary', () => {
  const base = {
    targetRiskGroup: 1,
    approval: '-',
    dateGenerated: '2026-08-27',
    dateDestroyed: null,
    organismName: 'Escherichia coli K-12',
  };

  it('matches the legacy format with tbd while not destroyed', () => {
    expect(buildGmoSummary(base)).toBe(
      'RG 1   |   Approval: -   |   2026-08-27   -   tbd   |   Escherichia coli K-12'
    );
  });

  it('shows the destruction date once destroyed (legacy tbd replacement)', () => {
    expect(buildGmoSummary({ ...base, dateDestroyed: '2026-09-01' })).toBe(
      'RG 1   |   Approval: -   |   2026-08-27   -   2026-09-01   |   Escherichia coli K-12'
    );
  });

  it('includes approval and risk group values', () => {
    const summary = buildGmoSummary({ ...base, targetRiskGroup: 2, approval: 'Az. 123' });
    expect(summary).toContain('RG 2');
    expect(summary).toContain('Approval: Az. 123');
  });

  it('exports the legacy pending placeholder', () => {
    expect(DESTROYED_PENDING).toBe('tbd');
  });
});
