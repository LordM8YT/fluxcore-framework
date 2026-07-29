# fluxcore_ui

Temporary, dependency-free adapters for Fluxcore domains that do not yet own a
finished NUI. It renders real bootstrap data through `fluxcore_interact` menus
and routes mutations back through each domain's client `Request` export.

This resource never reads SQLite or trusts browser data. Remove it when the
replacement frontend handles the documented domain open events and request
exports.
