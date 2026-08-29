'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataQualitySection } from '@/components/reports/DataQualitySection';

interface IntegrityErrors {
  message: string;
  missingFeatures: string[];
  missingOrganisms: string[];
}

/**
 * Downloads an XLSX from a report endpoint; returns integrity errors
 * (glossary gate) instead of downloading when the server rejects.
 */
async function downloadReport(url: string): Promise<IntegrityErrors | null> {
  const response = await fetch(url);

  if (!response.ok) {
    const envelope = await response.json().catch(() => null);
    return {
      message: envelope?.message || `Request failed: ${response.status}`,
      missingFeatures: envelope?.details?.missingFeatures || [],
      missingOrganisms: envelope?.details?.missingOrganisms || [],
    };
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'report.xlsx';

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);

  return null;
}

/**
 * Reports Page
 * Regulatory exports (legacy GMOCU): Formblatt Z (per-GMO record for German
 * gene-technology documentation) and the plasmid list.
 */
export default function ReportsPage() {
  const [lang, setLang] = useState<'de' | 'en'>('de');
  const [formblattBusy, setFormblattBusy] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [errors, setErrors] = useState<IntegrityErrors | null>(null);

  const handleFormblatt = async () => {
    setFormblattBusy(true);
    setErrors(null);
    try {
      setErrors(await downloadReport(`/api/reports/formblatt-z?lang=${lang}`));
    } catch (err) {
      setErrors({
        message: err instanceof Error ? err.message : 'Download failed',
        missingFeatures: [],
        missingOrganisms: [],
      });
    } finally {
      setFormblattBusy(false);
    }
  };

  const handlePlasmidList = async () => {
    setListBusy(true);
    setErrors(null);
    try {
      setErrors(await downloadReport('/api/reports/plasmid-list'));
    } catch (err) {
      setErrors({
        message: err instanceof Error ? err.message : 'Download failed',
        missingFeatures: [],
        missingOrganisms: [],
      });
    } finally {
      setListBusy(false);
    }
  };

  const selectClasses =
    'px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
    'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Reports
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Regulatory exports as formatted, print-ready XLSX files.
          </p>
        </div>

        <DataQualitySection />

        {errors && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-2">
              {errors.message}
            </p>
            {errors.missingFeatures.length > 0 && (
              <div className="mb-2">
                <p className="text-red-700 dark:text-red-300 text-xs font-semibold mb-1">
                  Cassette tokens missing from the Nucleic acids glossary:
                </p>
                <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 font-mono">
                  {errors.missingFeatures.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
            {errors.missingOrganisms.length > 0 && (
              <div>
                <p className="text-red-700 dark:text-red-300 text-xs font-semibold mb-1">
                  Organisms missing from the Organisms glossary:
                </p>
                <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 font-mono">
                  {errors.missingOrganisms.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Formblatt Z</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              One row per GMO record: donor organisms and risk groups derived from the cassette
              tokens' glossary entries, recipient organism, transferred nucleic acids, and
              approval/dates. Generation requires a complete glossary.
            </p>
            <div className="flex items-center gap-3">
              <label
                htmlFor="formblatt-lang"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Column headers
              </label>
              <select
                id="formblatt-lang"
                className={selectClasses}
                value={lang}
                onChange={(e) => setLang(e.target.value as 'de' | 'en')}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
              <Button intent="primary" onClick={handleFormblatt} loading={formblattBusy}>
                Generate Formblatt Z
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plasmid list</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Overview of all plasmids with description, original vector, size, status, and entry
              date.
            </p>
            <Button intent="primary" onClick={handlePlasmidList} loading={listBusy}>
              Generate Plasmid List
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
