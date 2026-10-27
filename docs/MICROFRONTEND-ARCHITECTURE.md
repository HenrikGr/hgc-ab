# Microfrontend Architecture — Host and Remote

**Status:** PoC implemented; production decisions remain open  
**Last reviewed:** 2026-10-27  
**Repositories:** [hgc-ab (Host)](https://github.com/HenrikGr/hgc-ab) · [consulting-opportunities (Remote)](https://github.com/HenrikGr/consulting-opportunities)

## Purpose and current status

This PoC demonstrates runtime composition of a separately built and released React feature using Vite and Module Federation. The Host owns the shell, runtime configuration, Remote manifest validation, federation registration, lazy loading, fallback and feature-area failure UI. The Remote owns its feature implementation and publishes versioned release assets.

The PoC works with the current integration flow and four Host E2E scenarios. This is not a production-readiness claim; compatibility, security, deployed asset hosting and operational policies remain open.

## Runtime configuration and distribution

The Host reads `public/microfrontends.json`, which points to the stable Remote manifest URL:

`https://github.com/HenrikGr/consulting-opportunities/releases/latest/download/remote-manifest.json`

The Remote-generated manifest identifies the current release and optional fallback. The Host validates the manifest and loads the exposed module `./FeatureButton` under federation identity `consultingOpportunities`.

GitHub Releases and their manifest/assets are the integration boundary—not Remote source code, local `dist/` output or workflow artifacts. Release tags follow `v<VERSION>`; assets use version-specific URLs so entry files and chunks come from the same release. Published versioned assets must be treated as immutable. The generated manifest is maintained by the Remote release workflow, not hand-edited in the Host repository.

## Loading and failure behaviour

1. Host fetches `/microfrontends.json` and the configured Remote manifest.
2. Host validates the manifest, registers the current entry and lazily loads `./FeatureButton`.
3. If current loading fails, Host registers the configured fallback and retries.
4. If loading still fails, Host displays an explanatory error in the feature area while keeping its shell available.

Fallback improves availability; it is not a compatibility guarantee.

## Local release proxy

During Host development and Vite preview, the Host Vite middleware proxies configured GitHub Release asset requests through `/__remote_assets/<owner>/<repository>/releases/`, rewrites embedded release URLs in JavaScript/JSON, and supplies appropriate MIME types. This is a local development/preview aid. Outside that context, the Host uses the GitHub URLs directly unless an environment provides a separately designed proxy.

## Responsibilities and current contract

- Host owns shell availability, runtime configuration, loading, fallback and platform-level failure presentation.
- Remote owns the feature UI and behaviour, and publishes its manifest and versioned assets.
- Host and Remote share React/React DOM as Module Federation singletons.
- The Remote currently dispatches `consulting-opportunities:clicked`, but this is a PoC signal, not a stable application API. The corresponding Host E2E test was removed because the event is not a long-term contract. Do not add a general event bus until a concrete use case defines its needs.

Key Host files: `public/microfrontends.json`, `src/main.jsx`, `src/app/remote-loading/services/remoteLoader.js`, `src/app/App.jsx`, `src/app/ui/RemoteErrorBoundary.jsx`, `plugins/remoteReleaseProxy.js`, `tests/e2e/remote-loading.spec.js`.

## Verification

Run `npm run build` and `npm run test:e2e` in the Host. The current four Playwright scenarios cover:
1. Loading the current Remote release from its published manifest.
2. Loading the fallback when the current entry fails.
3. Keeping the Host available when both versions fail.
4. Showing a configuration error when no Remotes are configured.

Live release paths require network access to GitHub Releases. Run `npm test` separately in the Remote repository.

## Open decisions and limitations

- Runtime configuration deployment and validation per environment.
- Production asset hosting: GitHub Releases versus a controlled CDN/proxy.
- Cache policy and operational rollback/roll-forward procedure.
- Compatibility policy for current/fallback versions and the exposed module.
- Ownership/versioning for future cross-boundary communication.
- Security and supply-chain requirements for runtime-loaded code.

Do not infer production guarantees from the current local E2E results.
