# Fluxcore UI contract set v1

This directory is the frozen hand-off boundary for replacement frontends.
The JSON files are representative owner-safe bootstrap payloads, not visual
templates and not runtime configuration.

Within v1, producers may add optional fields. They may not remove a field,
change its type or meaning, or reuse an existing action for different data.
Consumers must ignore fields they do not recognize. Breaking changes require a
new contract identifier ending in `.v2` and a documented migration period.

Every replacement frontend remains free to change markup, styling, icons,
layout and animation. Only the payload and action names are stable.
