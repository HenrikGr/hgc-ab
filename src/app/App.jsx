import React, { Suspense, lazy } from 'react';
import { loadRemoteWithFallback } from './remote-loading/services/remoteLoader.js';
import RemoteErrorBoundary from './ui/RemoteErrorBoundary.jsx';

const RemoteFeatureButton = lazy(() =>
  loadRemoteWithFallback('consultingOpportunities', './FeatureButton'),
);

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>hgc-ab</h1>
      <p>Host application; Remote version and entry URLs come from the Remote manifest.</p>
      <section>
        <h2>Remote feature area</h2>
        <RemoteErrorBoundary>
          <Suspense fallback={<p>Loading remote feature…</p>}>
            <RemoteFeatureButton />
          </Suspense>
        </RemoteErrorBoundary>
      </section>
    </main>
  );
}
