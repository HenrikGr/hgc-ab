# Frontend structure and coding conventions

## Ownership
- `src/app/` contains Host-specific implementation only.
- `src/remote/` contains contracts/interfaces shared across Host and Remote, not Remote application code.
- The Remote repository owns its feature implementation and translations.
- Top-level `plugins/` contains Vite/build tooling and must not be imported by browser runtime code.

## React capabilities
Use `ui/`, `hooks/`, `services/`, and `locales/` for the corresponding responsibilities where applicable. Establish the folder structure up front, but add implementation only when needed; do not create abstractions just to fill layers.

## Internationalization
Use `i18next` with `react-i18next`. Each capability owns its translation JSON under its own `locales/` folder and uses a namespace. Do not centralize all Host translations in one JSON file. Host and Remote initialize separate i18n instances. Host-wide initialization belongs under `src/app/i18n/`.

## Strings and configuration
Avoid duplicated hard-coded strings for configuration, user-facing text, and cross-module contracts. Environment-specific build-time values may use validated `VITE_` variables. Values that must change independently of a build belong in runtime configuration. User-facing text belongs in module-owned i18n resources. Shared event names and technical identifiers belong in constants or explicit contracts. Never expose secrets through `VITE_` variables.

## HTTP client boundary
The Host will own the generic HTTP client implementation under `src/app/http/`. Its shared contract belongs under `src/remote/http/`. Remote code must use the supported interface rather than import Host-internal modules.
