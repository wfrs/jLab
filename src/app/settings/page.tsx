'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ImportSection } from '@/components/settings/ImportSection';
import { SpreadsheetImportSection } from '@/components/settings/SpreadsheetImportSection';
import { DangerZoneSection } from '@/components/settings/DangerZoneSection';
import { OrganismTargetsSection } from '@/components/settings/OrganismTargetsSection';
import { DatabaseBackupSection } from '@/components/settings/DatabaseBackupSection';

interface UpdateSettingsPayload {
  name?: string;
  initials?: string;
  email?: string;
  institution?: string;
  duplicateGmos?: boolean;
}

/** How long "Saved" stays up before the field goes quiet again */
const SAVED_NOTICE_MS = 2000;

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
  'px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
  'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

/**
 * Autosave status for one field.
 *
 * Always in the DOM, even when idle: a live region has to exist before its
 * content changes or the change is not announced. Sits beside the caption
 * rather than replacing it — the caption is the only place that says where a
 * value ends up ("Printed in the Formblatt-Z footer"), and trading it away for
 * the word "Saved" lost it until the next page load.
 */
function FieldStatusText({ state }: { state: FieldStatus }): JSX.Element {
  const tone =
    state.status === 'error'
      ? 'text-red-600 dark:text-red-400 font-medium'
      : state.status === 'saved'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-gray-500 dark:text-gray-400';

  const text =
    state.status === 'saving'
      ? 'Saving…'
      : state.status === 'saved'
        ? 'Saved'
        : state.status === 'error'
          ? (state.message ?? 'Save failed')
          : '';

  return (
    <span
      aria-live="polite"
      {...(state.status === 'error' && { role: 'alert' })}
      className={`shrink-0 text-xs ${tone}`}
    >
      {text}
    </span>
  );
}

/** Small caps section marker, so the page reads as groups rather than a list */
function SectionHeading({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {children}
    </h2>
  );
}

/**
 * Settings Page
 * Single-user configuration (legacy Settings): identity fields feed report
 * footers and filenames. Autosave on blur — no save button.
 *
 * Spacing is owned by the layout (`gap`), never by margins on the cards: three
 * different margin conventions used to meet here and left two pairs of cards
 * touching, one of them the delete-everything card.
 */
export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldStates, setFieldStates] = useState<Record<string, FieldStatus>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // Timers outlive the component if a field saves as the user navigates away
  useEffect(() => {
    const timers = savedTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const fieldState = (field: string): FieldStatus => fieldStates[field] || { status: 'idle' };
  const setFieldState = (field: string, state: FieldStatus) =>
    setFieldStates((prev) => ({ ...prev, [field]: state }));

  const saveField = async (field: keyof UpdateSettingsPayload, value: string | boolean) => {
    clearTimeout(savedTimers.current[field]);
    setFieldState(field, { status: 'saving' });
    try {
      const updated = await patchSettings({ [field]: value });
      setSettings(updated);
      setFieldState(field, { status: 'saved' });
      // "Saved" reports an event, not a state — it should not sit there forever
      savedTimers.current[field] = setTimeout(
        () => setFieldState(field, { status: 'idle' }),
        SAVED_NOTICE_MS
      );
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
    placeholder?: string,
    options?: {
      type?: 'text' | 'email';
      autoComplete?: string;
      maxLength?: number;
      /** Field width signals how much is expected — 'JM' does not need 590px */
      size?: 'full' | 'short';
    }
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
        type={options?.type ?? 'text'}
        autoComplete={options?.autoComplete ?? 'off'}
        {...(options?.maxLength && { maxLength: options.maxLength })}
        className={`${inputClasses} ${options?.size === 'short' ? 'w-28' : 'w-full'}`}
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
      <div className="flex items-baseline justify-between gap-3 min-h-[1rem]">
        <p className="text-xs text-gray-500 dark:text-gray-400">{caption ?? ''}</p>
        <FieldStatusText state={fieldState(field)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your details, data imports and maintenance. Text fields save when you leave them.
          </p>
        </header>

        {loadError && (
          <div
            role="alert"
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-red-800 dark:text-red-200 text-sm">{loadError}</p>
          </div>
        )}

        {settings && (
          <section className="flex flex-col gap-4">
            <SectionHeading>General</SectionHeading>
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle as="h3">Identity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    These appear on the reports and labels jlab produces.
                  </p>
                  <div className="flex flex-col gap-4">
                    {textField('name', 'Name', 'Used in report filenames', 'e.g. J. Doe', {
                      autoComplete: 'name',
                    })}
                    {textField(
                      'initials',
                      'Initials',
                      'Printed on labels and in the plasmid list footer',
                      'JD',
                      { maxLength: 10, size: 'short' }
                    )}
                    {/* Legacy GMOCU sends this as `creatorEmail` on ICE uploads
                        (gmocu.py:1252); jlab has no export that uses it yet, and
                        saying so beats an unexplained empty field */}
                    {textField(
                      'email',
                      'Email',
                      'Stored for exports — not printed on reports',
                      'e.g. j.doe@example.org',
                      { type: 'email', autoComplete: 'email' }
                    )}
                    {textField(
                      'institution',
                      'Institution / approval reference',
                      'Printed in the Formblatt-Z footer',
                      'e.g. Az.: 123 / Anlage Nr.: 4',
                      { autoComplete: 'organization' }
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h3">Preferences</CardTitle>
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
                        When duplicating a plasmid, copy its GMO records with today&apos;s date
                        (takes effect once plasmid duplication ships).
                      </span>
                    </span>
                  </label>
                  <div className="mt-2 flex justify-end">
                    <FieldStatusText state={fieldState('duplicateGmos')} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeading>Organisms</SectionHeading>
          <OrganismTargetsSection />
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading>Data</SectionHeading>
          <div className="flex flex-col gap-6">
            <DatabaseBackupSection />
            <SpreadsheetImportSection />
            <ImportSection />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading>Danger zone</SectionHeading>
          <DangerZoneSection />
        </section>
      </div>
    </div>
  );
}
