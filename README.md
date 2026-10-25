# hgc-ab — Host / Remote Module Federation PoC

The `hgc-ab` host application reads `public/microfrontends.json` at runtime, so changing a Remote URL should not require rebuilding the Host.

Live deployment and rollback are not yet configured; the PoC currently uses CI workflows and local tooling to serve Remote artifacts. The repository is private, so do not publish the app publicly without an explicit decision.
