# ADR-001: Distribute Remote through versioned GitHub Releases

- **Status:** Accepted for the PoC
- **Date:** 2026-10-27

## Context
Host and Remote are built and released independently. Host must select a published Remote version at runtime without rebuilding for each Remote release, and should recover when the current release cannot load.

## Decision
The Remote publishes a manifest and versioned assets as GitHub Release assets. Host runtime configuration points to the stable `latest/download/remote-manifest.json` URL. The manifest identifies current and optional fallback versions. Published versioned assets are immutable.

## Alternatives
- Bundle Remote into Host: rejected because it couples build/release cycles.
- Use a local build directory or workflow artifact as the runtime interface: rejected because it is not the stable published cross-repository contract.
- Configure every entry URL directly in Host: rejected in favour of a stable manifest pointer.

## Consequences
Remote versions can be selected without rebuilding Host, and version-specific URLs keep entry/chunks aligned. GitHub availability becomes a runtime dependency. Compatibility, caching, production hosting and security controls remain open; fallback does not guarantee compatibility.
