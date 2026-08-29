'use client';

/**
 * AppNav — task-first top-level navigation (UX direction §4)
 * v1 targets: Plasmids, Glossary. Reports/Publish/Settings arrive with
 * their milestones.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/plasmids', label: 'Plasmids' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
];

export function AppNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <header className="h-12 shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 flex items-center px-6 gap-6">
      <Link
        href="/plasmids"
        className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100"
      >
        jlab
      </Link>
      <nav aria-label="Primary" className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium dark:bg-gray-800 dark:text-gray-100 dark:panel-lift'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800/70 dark:hover:text-gray-100'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
