# hgc-ab — Host / Remote Module Federation PoC

The Host reads `public/microfrontends.json` at runtime. That file points to the Remote's stable GitHub Release manifest URL, so selecting a published Remote version does not require rebuilding the Host.

The Remote manifest supplies the current and fallback release entry URLs. The Host registers the current version with Module Federation and, if loading fails, force-replaces the registration with the fallback entry before retrying the exposed module. If both versions fail, the Host displays an error while keeping its own shell available.

The current PoC manifest is published by the `HenrikGr/consulting-opportunities` Remote repository. Release assets should be treated as immutable after publication.

## Local development and verification

- `npm run dev` starts the Host.
- `npm run build` builds the Host.
- `npm run test:e2e` runs the Playwright browser tests.

The release-loading E2E tests use Remote releases `1.0.6` and `1.0.5`; tests that load a real release require network access to GitHub Releases. The repository is private, so do not publish the application publicly without an explicit decision.

Legacy local-artifact scripts remain in the repository for now, but they are not part of the Host's runtime loading path.
