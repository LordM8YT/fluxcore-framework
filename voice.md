# Voice

Fluxcore provides a small Enhanced-native proximity voice foundation. It uses
the server-owned Enhanced voice-channel API and does not enable the deprecated
Mumble compatibility mode.

## Configuration

Enable the internal Enhanced voice server before resources start:

```cfg
voice_internal
```

Then start voice after core and chat:

```cfg
ensure fluxcore_core
ensure fluxcore_chat
ensure fluxcore_voice
```

`fluxcore_voice/config/voice.json` controls the available proximity distances,
default mode and local talking-state poll interval:

```json
{
  "proximityDistances": [3, 8, 15],
  "defaultProximityIndex": 2,
  "talkingPollMs": 100
}
```

Press `GRAVE` (the backtick key) to cycle between 3-meter whisper,
8-meter normal and 15-meter shout range. The mapping is editable in FiveM
settings. Players can run `/voice` to check the current range.

Enhanced voice distances are server-owned. Fluxcore adds each selected
character to all configured spatial channels but unmutes their transmitter
only in the selected range, allowing players with different ranges to keep
hearing each other correctly.

Client resources can read `exports.fluxcore_voice:GetVoiceState()` or listen
for `fluxcore_voice:client:stateChanged` to render a talking indicator.
The bundled Fluxcore HUD does this automatically: the microphone indicator is
visible while voice is ready and turns green while the local player is talking.
Players join proximity voice only after selecting a character and leave the
channels on logout, so the isolated character-preview studio stays private.

{% hint style="warning" %}
Voice needs a current Enhanced server artifact and two connected clients for a
real audio test. A successful resource start only verifies channel setup, not
microphone routing.
{% endhint %}
