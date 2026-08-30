import { Suspense } from 'react';
import { GoldenGateCalculator } from '@/components/tools/GoldenGateCalculator';

export const metadata = {
  title: 'Golden Gate mix - jlab',
};

/**
 * /tools/golden-gate?ids=…
 *
 * Reached from a selection on the plasmids page, like the label sheets: you
 * calculate for the parts you just chose. A server shell so the client view can
 * read search params behind a Suspense boundary.
 */
export default function GoldenGatePage() {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-4xl px-6 py-8 text-sm text-gray-400">Loading…</p>}
    >
      <GoldenGateCalculator />
    </Suspense>
  );
}
