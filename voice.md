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

`fluxcore_voice/config/voice.json` controls the proximity distance and local
talking-state poll interval:

```json
{
  "proximityDistance": 15,
  "talkingPollMs": 100
}
```

Players can run `/voice` to check whether the proximity channel is active.
Client resources can read `exports.fluxcore_voice:GetVoiceState()` or listen
for `fluxcore_voice:client:stateChanged` to render a talking indicator.
The bundled Fluxcore HUD does this automatically: the microphone indicator is
visible while voice is ready and turns green while the local player is talking.
Players join proximity voice only after selecting a character and leave the
channel on logout, so the isolated character-preview studio stays private.

{% hint style="warning" %}
Voice needs a current Enhanced server artifact and two connected clients for a
real audio test. A successful resource start only verifies channel setup, not
microphone routing.
{% endhint %}
