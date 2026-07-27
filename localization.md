# Localization

Fluxcore uses one shared catalog for Node server code, Lua clients, and NUI. English is the default and fallback language. Norwegian is bundled.

## Select a language

Place one of these above every Fluxcore `ensure`:

```cfg
# English
setr fluxcore_locale "en"

# Norwegian
setr fluxcore_locale "no"
```

`setr` is required because clients receive the selected language. Restart the Fluxcore resources, preferably the server, after changing it.

Optional fallback:

```cfg
setr fluxcore_fallbackLocale "en"
```

Regional names fall back to their base language. For example, `no-NO` loads `no` when `no-NO.json` is absent.

## Lua

The export exists on client and server:

```lua
local text = exports.fluxcore_core:Locale('jobs.noJobs')

local message = exports.fluxcore_core:Locale(
    'vehicles.created',
    {
        model = 'sultan',
        plate = 'FLUXCORE',
        source = 7
    },
    'Created {{model}} ({{plate}}) for source {{source}}.'
)
```

Placeholders use `{{name}}`.

For NUI bootstrap data:

```lua
local translations = exports.fluxcore_core:GetLocaleData('identity')
local localeName = exports.fluxcore_core:GetLocale()
```

## JavaScript

```js
const text = globalThis.exports.fluxcore_core.Locale(
  'inventory.opened',
  { label: 'Evidence' },
  'Opened: {{label}}',
);
```

## Stable internal identifiers

Do not translate:

* job names such as `police`
* item names such as `water`
* error codes
* event names
* State Bag keys
* database values

Translate display labels only.

## Add a language

{% stepper %}
{% step %}
### Copy the English catalog

Copy `resources/[fluxcore]/fluxcore_core/locales/en.json`.
{% endstep %}

{% step %}
### Name the locale file

Name it with a short locale code, for example `fr.json`.
{% endstep %}

{% step %}
### Translate values

Translate values only.

Keep every key and `{{placeholder}}`.
{% endstep %}

{% step %}
### Save the file

Save UTF-8 JSON.
{% endstep %}

{% step %}
### Select the locale

```cfg
setr fluxcore_locale "fr"
```
{% endstep %}

{% step %}
### Restart the server

Restart the server.
{% endstep %}

{% step %}
### Run tests

```bash
npm test
```

Tests compare the complete catalog shape with English.
{% endstep %}
{% endstepper %}
