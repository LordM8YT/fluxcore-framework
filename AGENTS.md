# Fluxcore agent instructions

## FiveM Enhanced work

Before changing NUI, input handling, natives, resource manifests, resource
dependencies, or txAdmin/runtime files, read
[`docs/fivem-enhanced-compatibility.md`](docs/fivem-enhanced-compatibility.md).

Treat that guide as a required checklist:

- check the linked live Cfx documentation for changes;
- verify behavior in the running Enhanced client, not only in unit tests;
- keep NUI documents transparent from the first inline style;
- use FiveM key mappings for configurable player input;
- make cross-resource registrations recover after provider restarts;
- sync changed source files to txData and compare hashes;
- run **Reload & Refresh** after manifest changes or new runtime files;
- restart resources in dependency order; and
- remove temporary diagnostics before release.

When official documentation and a local observation disagree, record the
artifact/build, reproduce the behavior, and preserve the compatibility path
that works in Enhanced.
