local config = {
    talkingPollMs = 100
}
local ready = false
local voiceState = nil
local talking = false

do
    local raw = LoadResourceFile(GetCurrentResourceName(), 'config/voice.json')
    if raw then
        local ok, parsed = pcall(json.decode, raw)
        if ok and type(parsed) == 'table' then
            config.talkingPollMs = math.max(
                50,
                math.min(1000, tonumber(parsed.talkingPollMs) or 100)
            )
        end
    end
end

RegisterCommand('+fluxcore_voice_distance', function()
    if ready then
        TriggerServerEvent('fluxcore_voice:server:cycleProximity')
    end
end, false)

RegisterCommand('-fluxcore_voice_distance', function()
end, false)

RegisterKeyMapping(
    '+fluxcore_voice_distance',
    'Cycle Fluxcore voice distance',
    'keyboard',
    'GRAVE'
)

RegisterNetEvent('fluxcore_voice:client:ready', function(snapshot)
    ready = snapshot and snapshot.ready ~= false
    voiceState = ready and snapshot or nil
    if not ready then
        talking = false
    end
    TriggerEvent('fluxcore_voice:client:stateChanged', {
        ready = ready,
        talking = talking,
        proximityDistance = snapshot and snapshot.proximityDistance or nil
    })
end)

RegisterNetEvent('fluxcore_voice:client:message', function(message)
    TriggerEvent('chat:addMessage', {
        type = message and message.type or 'system',
        args = {
            message and message.author or 'Voice',
            message and message.text or ''
        }
    })
end)

CreateThread(function()
    while true do
        local talkingValue = NetworkIsPlayerTalking(PlayerId())
        local nextTalking = ready
            and (talkingValue == true or talkingValue == 1)
        if nextTalking ~= talking then
            talking = nextTalking
            TriggerEvent('fluxcore_voice:client:stateChanged', {
                ready = ready,
                talking = talking,
                proximityDistance = voiceState and voiceState.proximityDistance or nil
            })
        end
        Wait(config.talkingPollMs)
    end
end)

exports('GetVoiceState', function()
    return {
        ready = ready,
        talking = talking,
        proximityDistance = voiceState and voiceState.proximityDistance or nil
    }
end)
