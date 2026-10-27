import React from 'react';

/**
 * A Remote failure must not take down the Host shell.
 */
export default class RemoteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[hgc-ab host] Remote failed to render/load', error);
  }

  render() {
    if (this.state.error) {
      return (
        <section role="alert">
          <strong>Remote feature unavailable.</strong>
          <p>
            The Host remains available, but neither the current nor the fallback
            Remote version could be loaded. Check the Remote release manifest and
            network access, then retry.
          </p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </section>
      );
    }

    return this.props.children;
  }
}
