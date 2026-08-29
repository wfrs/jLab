'use client';

/**
 * DataQualitySection
 * Runs the record-completeness and glossary-housekeeping checks
 * (legacy check_plasmids / check_features / check_organisms) and itemizes
 * the findings, so problems are fixable before an export is attempted.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { HealthCheck, HealthReport, HealthSeverity } from '@/services/data-quality.service';

/** Findings shown inline before the list is collapsed behind "show all" */
const ITEM_PREVIEW_LIMIT = 8;

const SEVERITY_ORDER: HealthSeverity[] = ['error', 'warning', 'info'];

const SEVERITY_STYLES: Record<HealthSeverity, { dot: string; label: string; text: string }> = {
  error: {
    dot: 'bg-red-500',
    label: 'Blocks export',
    text: 'text-red-600 dark:text-red-400',
  },
  warning: {
    dot: 'bg-amber-500',
    label: 'Incomplete',
    text: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    dot: 'bg-gray-500',
    label: 'Housekeeping',
    text: 'text-gray-500 dark:text-gray-400',
  },
};

async function fetchReport(): Promise<HealthReport> {
  const response = await fetch('/api/health');
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Failed to run checks');
  }
  return json.data as HealthReport;
}

function CheckRow({ check }: { check: HealthCheck }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const styles = SEVERITY_STYLES[check.severity];
  const shown = expanded ? check.items : check.items.slice(0, ITEM_PREVIEW_LIMIT);
  const hidden = check.items.length - shown.length;

  return (
    <li className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {check.label}{' '}
            <span className={`text-xs font-normal ${styles.text}`}>
              — {check.items.length} · {styles.label}
            </span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{check.description}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {shown.map((item) => (
              <li
                key={item}
                className="px-2 py-0.5 text-xs font-mono rounded bg-surface-2 text-gray-300 border border-gray-700"
              >
                {item}
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Show {hidden} more
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function DataQualitySection(): JSX.Element {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      setReport(await fetchReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run checks');
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const findings = (report?.checks ?? [])
    .filter((c) => c.items.length > 0)
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const passingCount = (report?.checks.length ?? 0) - findings.length;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Data quality</CardTitle>
          <Button intent="secondary" size="sm" onClick={() => void run()} loading={isRunning}>
            {isRunning ? 'Checking…' : 'Re-check'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {!error && !report && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Running checks…</p>
        )}

        {report && (
          <div role="status">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
              {report.ok ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Exports are unblocked.
                </span>
              ) : (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {report.errorCount === 1
                    ? '1 issue blocks Formblatt-Z generation.'
                    : `${report.errorCount} issues block Formblatt-Z generation.`}
                </span>
              )}{' '}
              {report.warningCount > 0 && `${report.warningCount} completeness `}
              {report.warningCount > 0 && report.infoCount > 0 && 'and '}
              {report.infoCount > 0 && `${report.infoCount} housekeeping `}
              {(report.warningCount > 0 || report.infoCount > 0) &&
                `finding${report.warningCount + report.infoCount === 1 ? '' : 's'}. `}
              <span className="text-gray-500 dark:text-gray-400">
                {passingCount} of {report.checks.length} checks clean.
              </span>
            </p>

            {findings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Every check passed — no missing glossary entries, no incomplete records.
              </p>
            ) : (
              <ul className="mt-3">
                {findings.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
