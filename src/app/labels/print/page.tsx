import { Suspense } from 'react';
import { LabelPrintView } from '@/components/labels/LabelPrintView';
import './label-print.css';

export const metadata = {
  title: 'Print labels - jlab',
};

/**
 * /labels/print?kind=plasmid&ids=…&startAt=N
 *
 * A server shell so the client view can read search params behind a Suspense
 * boundary, and so the print stylesheet — whose `@page` rule is
 * document-scoped — loads on this route only.
 */
export default function LabelPrintPage() {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-6 py-6 text-sm text-gray-400">Loading…</p>}
    >
      <LabelPrintView />
    </Suspense>
  );
}
