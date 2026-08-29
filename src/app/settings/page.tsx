'use client';

import { useEffect, useState } from 'react';
import { Settings } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImportSection } from '@/components/settings/ImportSection';

interface UpdateSettingsPayload {
  name?: string;
  initials?: string;
  email?: string;
  institution?: string;
  duplicateGmos?: boolean;
}

/** SQLite stores booleans as 0/1 — normalize for the controlled checkbox */
function normalizeSettings(data: Settings): Settings {
  return { ...data, duplicateGmos: Boolean(data.duplicateGmos) };
}

async function fetchSettings(): Promise<Settings> {
  const response = await fetch('/api/settings');
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Failed to load settings');
  }
  return normalizeSettings(json.data as Settings);
}

async function patchSettings(patch: UpdateSettingsPayload): Promise<Settings> {
  const response = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || 'Failed to save settings');
  }
  return normalizeSettings(json.data as Settings);
}

type FieldStatus = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

const inputClasses =
  'w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
  'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

function Feedback({ state }: { state: FieldStatus }): JSX.Element | null {
  if (state.status === 'saving')
    return <p className="text-xs text-gray-500 dark:text-gray-400">Saving…</p>;
  if (state.status === 'saved')
    return <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved</p>;
  if (state.status === 'error')
    return (
      <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
        {state.message}
      </p>
    );
  return null;
}

/**
 * Settings Page
 * Single-user configuration (legacy Settings): identity fields feed report
 * footers and filenames. Autosave on blur — no save button.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, FieldStatus>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setSettings(data);
        setDrafts({
          name: data.name,
          initials: data.initials,
          email: data.email,
          institution: data.institution,
        });
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  const fieldState = (field: string): FieldStatus => fieldStates[field] || { status: 'idle' };
  const setFieldState = (field: string, state: FieldStatus) =>
    setFieldStates((prev) => ({ ...prev, [field]: state }));

  const saveField = async (field: keyof UpdateSettingsPayload, value: string | boolean) => {
    setFieldState(field, { status: 'saving' });
    try {
      const updated = await patchSettings({ [field]: value });
      setSettings(updated);
      setFieldState(field, { status: 'saved' });
    } catch (err) {
      setFieldState(field, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  };

  const textField = (
    field: 'name' | 'initials' | 'email' | 'institution',
    label: string,
    caption?: string,
    placeholder?: string
  ) => (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`settings-${field}`}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <input
        id={`settings-${field}`}
        className={inputClasses}
        placeholder={placeholder}
        value={drafts[field] ?? ''}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [field]: e.target.value }))}
        onBlur={() => {
          if (settings && (drafts[field] ?? '') !== settings[field]) {
            void saveField(field, drafts[field] ?? '');
          } else if (fieldState(field).status === 'error') {
            // Value reverted to the saved state — clear the stale error
            setFieldState(field, { status: 'idle' });
          }
        }}
      />
      {caption && !fieldState(field).status.match(/error|saved|saving/) && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{caption}</p>
      )}
      <Feedback state={fieldState(field)} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Identity and behavior settings. Changes save automatically.
          </p>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-red-800 dark:text-red-200 text-sm">{loadError}</p>
          </div>
        )}

        {settings && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {textField('name', 'Name', 'Used in report filenames', 'e.g. J. Doe')}
                  {textField(
                    'initials',
                    'Initials',
                    'Used in file naming and the plasmid list footer',
                    'e.g. JD'
                  )}
                  {textField('email', 'Email', undefined, 'e.g. j.doe@example.org')}
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Institution</CardTitle>
              </CardHeader>
              <CardContent>
                {textField(
                  'institution',
                  'Institution / approval reference',
                  'Printed in the Formblatt-Z footer',
                  'e.g. Az.: 123 / Anlage Nr.: 4'
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Behavior</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-blue-600"
                    checked={settings.duplicateGmos}
                    onChange={(e) => {
                      const next = e.target.checked;
                      // Optimistic flip; saveField reconciles with the server state
                      setSettings((prev) => (prev ? { ...prev, duplicateGmos: next } : prev));
                      void saveField('duplicateGmos', next);
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Duplicate GMOs with plasmids
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      When duplicating a plasmid, copy its GMO records with today's date (takes
                      effect once plasmid duplication ships).
                    </span>
                  </span>
                </label>
                <Feedback state={fieldState('duplicateGmos')} />
              </CardContent>
            </Card>
          </>
        )}

        <ImportSection />
      </div>
    </div>
  );
}
