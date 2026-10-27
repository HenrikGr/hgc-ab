# hgc-ab — Host / Remote Module Federation PoC

The Host reads `public/microfrontends.json` at runtime. That configuration points to the Remote's stable GitHub Release manifest URL, allowing the selected Remote version to change without rebuilding the Host.

The Remote manifest supplies current and optional fallback release entry URLs. The Host loads the current entry and retries with the fallback if loading fails. If both fail, the Host displays an error in the feature area while keeping its own shell available.

See [Microfrontend Architecture](docs/MICROFRONTEND-ARCHITECTURE.md) for the integration contract, release distribution, local proxy, fallback behaviour and limitations. See [Frontend structure](docs/FRONTEND-STRUCTURE.md) for code ownership and conventions, and [architecture decisions](docs/decisions/) for the key PoC decisions.

## Local development and verification

- `npm run dev` starts the Host.
- `npm run build` builds the Host.
- `npm run test:e2e` runs the Playwright browser tests.

The current E2E suite covers current-release loading, fallback loading, graceful failure when both releases fail, and missing runtime configuration. Live-release paths require network access to GitHub Releases.

The repository is private. Do not publish the application publicly without an explicit decision.
