'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { NucleicAcidsTab } from '@/components/glossary/NucleicAcidsTab';
import { OrganismsTab } from '@/components/glossary/OrganismsTab';
import { GlossaryImportSection } from '@/components/glossary/GlossaryImportSection';

const TABS = [
  { id: 'nucleic-acids', label: 'Nucleic acids' },
  { id: 'organisms', label: 'Organisms' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Glossary Page
 * Two controlled vocabularies (legacy GMOCU tabs): Nucleic acids
 * (cassette tokens) and Organisms (GMO generation).
 */
export default function GlossaryPage() {
  const [activeTab, setActiveTab] = useState<TabId>('nucleic-acids');
  // Bumped after an Excel import so the active tab remounts and refetches
  const [dataVersion, setDataVersion] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="px-6 py-8 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mb-4">
            Glossary
          </h1>
          <div
            role="tablist"
            aria-label="Glossary sections"
            className="flex gap-1 border-b border-gray-200 dark:border-gray-700"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={clsx(
                  'px-4 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 font-medium dark:border-blue-400 dark:text-blue-300'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <GlossaryImportSection onImported={() => setDataVersion((v) => v + 1)} />

        {activeTab === 'nucleic-acids' ? (
          <NucleicAcidsTab key={dataVersion} />
        ) : (
          <OrganismsTab key={dataVersion} />
        )}
      </div>
    </div>
  );
}
