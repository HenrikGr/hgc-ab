# Host / Remote Module Federation PoC

Minimal Host application for the Module Federation proof of concept. It reads `public/microfrontends.json` at runtime, so a runtime URL change should not require rebuilding the Host.

Live deployment and rollback are not yet configured; the PoC currently needs CI workflows and a hosting target that can serve the Remote artifacts. The repository is private, so do not publish the app publicly without an explicit decision.
