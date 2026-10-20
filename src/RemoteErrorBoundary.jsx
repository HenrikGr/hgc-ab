import React from 'react';
export default class RemoteErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('[Host platform] Remote failed to render/load', error); }
  render() {
    if (this.state.failed) return <section role="alert"><strong>Remote feature unavailable.</strong><p>The Host remains available. Check the Remote URL and retry.</p><button onClick={() => this.setState({ failed: false })}>Retry</button></section>;
    return this.props.children;
  }
}
