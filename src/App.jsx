import React, { Suspense, lazy } from 'react';
import { loadRemote } from '@module-federation/enhanced/runtime';
import RemoteErrorBoundary from './RemoteErrorBoundary.jsx';
const RemoteFeatureButton = lazy(() => loadRemote('remoteApp/FeatureButton'));
export default function App() {
  return <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 800, margin: '0 auto' }}><h1>Host PoC</h1><p>Independently built Host; Remote URL comes from runtime configuration.</p><section><h2>Remote feature area</h2><RemoteErrorBoundary><Suspense fallback={<p>Loading Remote…</p>}><RemoteFeatureButton /></Suspense></RemoteErrorBoundary></section></main>;
}
