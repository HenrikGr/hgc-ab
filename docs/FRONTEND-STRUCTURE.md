# Frontend structure

Host-only code belongs in `src/app/`. Shared Host–Remote contracts belong in `src/remote/`. Vite plugins belong in top-level `plugins/`.

React capabilities use `ui/`, `hooks/`, and `services/` where applicable. Translation resources are owned by each capability under `locales/`; use i18next with react-i18next and namespaces rather than one central translations file. Build-time configuration may use validated `VITE_` variables; values that change independently of a build belong in runtime configuration. Never expose secrets through frontend environment variables.