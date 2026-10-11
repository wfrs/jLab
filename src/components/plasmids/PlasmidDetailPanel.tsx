'use client';

/**
 * PlasmidDetailPanel
 * Side panel synced with the selected table row (UI/UX direction: the panel
 * supports form-style editing but never replaces the table as primary).
 * Every field autosaves on blur/change — no save button.
 */

import React, { useEffect, useState } from 'react';
import { Plasmid } from '@/domain/types';
import { PlasmidStatusBadge } from './PlasmidStatusBadge';
import { CassetteSection } from './CassetteSection';
import { PrepHistorySection } from './PrepHistorySection';
import { GlycerolStockSection } from './GlycerolStockSection';
import { GmoSection } from './GmoSection';
import { GenbankSection } from './GenbankSection';
import { FeatureSection } from './FeatureSection';
import { PrimerSection } from './PrimerSection';
import { AttachmentSection } from './AttachmentSection';
import { Button } from '@/components/ui/Button';
import { UpdatePlasmidPayload } from './api-client';

export interface PlasmidDetailPanelProps {
  plasmid: Plasmid;
  onSave: (patch: UpdatePlasmidPayload) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: Plasmid['status']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'validated', label: 'Validated' },
  { value: 'archived', label: 'Archived' },
];

type FieldStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FieldState {
  status: FieldStatus;
  message?: string;
}

const fieldBaseClasses =
  'w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ' +
  'border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'disabled:opacity-50';

function FieldFeedback({ state }: { state: FieldState }): JSX.Element | null {
  if (state.status === 'saving') {
    return <p className="text-xs text-gray-500 dark:text-gray-400">Saving…</p>;
  }
  if (state.status === 'saved') {
    return <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved</p>;
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * Draft that follows the server value (e.g. after an inline table edit)
 * unless the user is currently typing in the field.
 */
function useSyncedDraft(serverValue: string): {
  draft: string;
  setDraft: (value: string) => void;
  focusProps: { onFocus: () => void };
  markBlurred: () => void;
} {
  const [draft, setDraft] = useState(serverValue);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(serverValue);
    }
  }, [serverValue, focused]);

  return {
    draft,
    setDraft,
    focusProps: { onFocus: () => setFocused(true) },
    markBlurred: () => setFocused(false),
  };
}

function PanelForm({
  plasmid,
  onSave,
}: {
  plasmid: Plasmid;
  onSave: PlasmidDetailPanelProps['onSave'];
}): JSX.Element {
  const nameField = useSyncedDraft(plasmid.name);
  const descriptionField = useSyncedDraft(plasmid.description || '');
  const sizeField = useSyncedDraft(plasmid.sizeBp ? String(plasmid.sizeBp) : '');
  const vectorField = useSyncedDraft(plasmid.backboneVector || '');
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

  const setFieldState = (field: string, state: FieldState) => {
    setFieldStates((prev) => ({ ...prev, [field]: state }));
  };

  const saveField = async (field: string, patch: UpdatePlasmidPayload) => {
    setFieldState(field, { status: 'saving' });
    try {
      await onSave(patch);
      setFieldState(field, { status: 'saved' });
    } catch (err) {
      setFieldState(field, {
        status: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    }
  };

  const fieldState = (field: string): FieldState => fieldStates[field] || { status: 'idle' };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="panel-name"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Name
        </label>
        <input
          id="panel-name"
          className={fieldBaseClasses}
          value={nameField.draft}
          onChange={(e) => nameField.setDraft(e.target.value)}
          {...nameField.focusProps}
          onBlur={() => {
            nameField.markBlurred();
            if (nameField.draft !== plasmid.name) {
              void saveField('name', { name: nameField.draft });
            }
          }}
        />
        <FieldFeedback state={fieldState('name')} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="panel-description"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Description
        </label>
        <textarea
          id="panel-description"
          rows={3}
          className={fieldBaseClasses}
          value={descriptionField.draft}
          onChange={(e) => descriptionField.setDraft(e.target.value)}
          {...descriptionField.focusProps}
          onBlur={() => {
            descriptionField.markBlurred();
            if (descriptionField.draft !== (plasmid.description || '')) {
              void saveField('description', { description: descriptionField.draft });
            }
          }}
        />
        <FieldFeedback state={fieldState('description')} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="panel-size"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Size (bp)
        </label>
        <input
          id="panel-size"
          inputMode="numeric"
          className={`${fieldBaseClasses} font-mono`}
          value={sizeField.draft}
          onChange={(e) => sizeField.setDraft(e.target.value)}
          {...sizeField.focusProps}
          onBlur={() => {
            sizeField.markBlurred();
            const original = plasmid.sizeBp ? String(plasmid.sizeBp) : '';
            if (sizeField.draft === original) return;
            if (sizeField.draft.trim() === '') {
              void saveField('sizeBp', { sizeBp: null });
              return;
            }
            const parsed = Number(sizeField.draft.trim());
            if (!Number.isFinite(parsed)) {
              setFieldState('sizeBp', { status: 'error', message: 'Enter a number' });
              return;
            }
            void saveField('sizeBp', { sizeBp: parsed });
          }}
        />
        <FieldFeedback state={fieldState('sizeBp')} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="panel-vector"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Original vector
        </label>
        <input
          id="panel-vector"
          className={fieldBaseClasses}
          placeholder="e.g. pUC19"
          value={vectorField.draft}
          onChange={(e) => vectorField.setDraft(e.target.value)}
          {...vectorField.focusProps}
          onBlur={() => {
            vectorField.markBlurred();
            if (vectorField.draft !== (plasmid.backboneVector || '')) {
              void saveField('backboneVector', {
                backboneVector: vectorField.draft.trim() === '' ? null : vectorField.draft,
              });
            }
          }}
        />
        <FieldFeedback state={fieldState('backboneVector')} />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="panel-status"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Status
        </label>
        <select
          id="panel-status"
          className={fieldBaseClasses}
          value={plasmid.status}
          onChange={(e) => {
            void saveField('status', { status: e.target.value as Plasmid['status'] });
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldFeedback state={fieldState('status')} />
      </div>
    </div>
  );
}

export function PlasmidDetailPanel({
  plasmid,
  onSave,
  onDuplicate,
  onClose,
}: PlasmidDetailPanelProps): JSX.Element {
  const [isDuplicating, setIsDuplicating] = React.useState(false);

  // Legacy -DUPLICATE- flow: confirm first ("Do you wish to duplicate…")
  const handleDuplicate = async () => {
    if (!window.confirm('Do you wish to duplicate the plasmid entry?')) return;
    try {
      setIsDuplicating(true);
      await onDuplicate();
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <aside
      aria-label={`Details for plasmid ${plasmid.name}`}
      className="w-[360px] shrink-0 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:panel-lift"
    >
      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 break-all">
              {plasmid.name}
            </h2>
            <div className="mt-1">
              <PlasmidStatusBadge status={plasmid.status} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              intent="ghost"
              size="sm"
              loading={isDuplicating}
              onClick={() => void handleDuplicate()}
              aria-label={`Duplicate plasmid ${plasmid.name}`}
            >
              Duplicate
            </Button>
            <Button intent="ghost" size="sm" onClick={onClose} aria-label="Close detail panel">
              ✕
            </Button>
          </div>
        </div>

        {/* Remount only when switching rows; within a row, drafts follow
            server state via useSyncedDraft (keeps focus and Saved feedback) */}
        <PanelForm key={plasmid.id} plasmid={plasmid} onSave={onSave} />

        {/* Preps sit first: it is the value that changes most often and the one
            the label prints */}
        <PrepHistorySection key={`preps-${plasmid.id}`} plasmidId={plasmid.id} />

        <GlycerolStockSection
          key={`stocks-${plasmid.id}`}
          plasmidId={plasmid.id}
          plasmidName={plasmid.name}
        />

        <CassetteSection key={`cassettes-${plasmid.id}`} plasmidId={plasmid.id} />

        <GmoSection key={`gmos-${plasmid.id}`} plasmidId={plasmid.id} />

        <GenbankSection key={`genbank-${plasmid.id}`} plasmidId={plasmid.id} />

        <FeatureSection key={`features-${plasmid.id}`} plasmidId={plasmid.id} />

        <PrimerSection key={`primers-${plasmid.id}`} plasmidId={plasmid.id} />

        <AttachmentSection key={`attachments-${plasmid.id}`} plasmidId={plasmid.id} />

        <dl className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt className="text-gray-500 dark:text-gray-400">ID</dt>
          <dd className="font-mono text-gray-700 dark:text-gray-300 break-all">{plasmid.id}</dd>
          <dt className="text-gray-500 dark:text-gray-400">Parent</dt>
          <dd className="font-mono text-gray-700 dark:text-gray-300 break-all">
            {plasmid.parentId || '—'}
          </dd>
          <dt className="text-gray-500 dark:text-gray-400">Created</dt>
          <dd className="text-gray-700 dark:text-gray-300">
            {new Date(plasmid.createdAt).toLocaleString()}
          </dd>
          <dt className="text-gray-500 dark:text-gray-400">Updated</dt>
          <dd className="text-gray-700 dark:text-gray-300">
            {new Date(plasmid.updatedAt).toLocaleString()}
          </dd>
        </dl>
      </div>
    </aside>
  );
}
