# ADR-002: Host owns Remote loading and failure containment

- **Status:** Accepted for the PoC
- **Date:** 2026-10-27

## Context
The Host shell should remain usable when a separately released Remote cannot load. Runtime configuration, federation registration and fallback are platform integration concerns.

## Decision
Host owns runtime configuration, manifest validation, federation registration, lazy loading, fallback attempts and feature-area failure presentation. Remote owns its feature UI and behaviour.

## Consequences
The Remote remains focused on its feature and loading failures are contained by Host. The repositories still depend on a shared federation identity and exposed-module contract. The current click event is not a stable API; a general event bus is deferred until a concrete use case defines requirements.
