local resourceName = GetCurrentResourceName()
local config = {
    proximityDistance = 15.0
}
local proximityChannel = nil
local members = {}

do
    local raw = LoadResourceFile(resourceName, 'config/voice.json')
    if raw then
        local ok, parsed = pcall(json.decode, raw)
        if ok and type(parsed) == 'table' then
            config.proximityDistance = math.max(
                1.0,
                math.min(100.0, tonumber(parsed.proximityDistance) or 15.0)
            )
        end
    end
end

local function notify(playerSource, message, messageType)
    TriggerClientEvent('fluxcore_voice:client:message', playerSource, {
        type = messageType or 'system',
        author = 'Voice',
        text = message
    })
end

local function voiceAvailable()
    return type(CreateVoiceChannel) == 'function'
        and type(AddPlayerToVoiceChannel) == 'function'
        and type(RemovePlayerFromVoiceChannel) == 'function'
end

local function ensureChannel()
    if proximityChannel ~= nil then
        return proximityChannel
    end
    if not voiceAvailable() then
        return nil
    end
    local channel = CreateVoiceChannel(1, config.proximityDistance)
    if type(channel) ~= 'number' or channel < 0 or channel >= 65535 then
        return nil
    end
    proximityChannel = channel
    print(('[fluxcore_voice] proximity channel %d created at %.1f meters')
        :format(channel, config.proximityDistance))
    return channel
end

local function addPlayer(playerSource)
    local id = tonumber(playerSource)
    local channel = ensureChannel()
    if not id or id <= 0 or not channel or members[id] then
        return false
    end
    AddPlayerToVoiceChannel(channel, id)
    members[id] = true
    TriggerClientEvent('fluxcore_voice:client:ready', id, {
        channel = channel,
        proximityDistance = config.proximityDistance
    })
    return true
end

local function removePlayer(playerSource)
    local id = tonumber(playerSource)
    if not id or not members[id] then
        return false
    end
    if proximityChannel and type(RemovePlayerFromVoiceChannel) == 'function' then
        RemovePlayerFromVoiceChannel(proximityChannel, id)
    end
    members[id] = nil
    return true
end

CreateThread(function()
    Wait(0)
    if not ensureChannel() then
        print('[fluxcore_voice] voice API unavailable; update the Enhanced server artifact before testing voice')
        return
    end
    for _, playerSource in ipairs(GetPlayers()) do
        addPlayer(playerSource)
    end
end)

AddEventHandler('playerJoining', function()
    addPlayer(source)
end)

AddEventHandler('playerDropped', function()
    removePlayer(source)
end)

AddEventHandler('Fluxcore:server:playerLoaded', function(playerSource)
    addPlayer(playerSource)
end)

RegisterCommand('voice', function(playerSource)
    if playerSource <= 0 then
        print(('Voice proximity: %.1f meters | channel: %s | members: %d')
            :format(
                config.proximityDistance,
                tostring(proximityChannel or 'unavailable'),
                #GetPlayers()
            ))
        return
    end
    if not proximityChannel then
        notify(playerSource, 'Voice is unavailable on this server artifact.', 'error')
        return
    end
    notify(
        playerSource,
        ('Proximity voice is active at %.0f meters.'):format(config.proximityDistance),
        'success'
    )
end, false)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= resourceName then
        return
    end
    if proximityChannel and type(DeleteVoiceChannel) == 'function' then
        DeleteVoiceChannel(proximityChannel)
    end
end)

exports('GetVoiceState', function()
    return {
        available = proximityChannel ~= nil,
        channel = proximityChannel,
        proximityDistance = config.proximityDistance
    }
end)
