local resourceName = GetCurrentResourceName()
local config = {
    proximityDistances = { 3.0, 8.0, 15.0 },
    defaultProximityIndex = 2
}
local channels = {}
local privateChannels = {}
local managedChannels = {}
local members = {}
local lastCycleAt = {}

do
    local raw = LoadResourceFile(resourceName, 'config/voice.json')
    if raw then
        local ok, parsed = pcall(json.decode, raw)
        if ok and type(parsed) == 'table' then
            local distances = {}
            for _, value in ipairs(parsed.proximityDistances or {}) do
                local distance = tonumber(value)
                if distance and distance >= 1.0 and distance <= 100.0 then
                    distances[#distances + 1] = distance
                end
            end
            if #distances > 0 and #distances <= 8 then
                config.proximityDistances = distances
            end
            config.defaultProximityIndex = math.max(
                1,
                math.min(
                    #config.proximityDistances,
                    math.floor(tonumber(parsed.defaultProximityIndex) or 2)
                )
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
        and type(SetPlayerMutedInVoiceChannel) == 'function'
end

local function deleteChannels()
    if type(DeleteVoiceChannel) == 'function' then
        for _, channel in ipairs(channels) do
            pcall(DeleteVoiceChannel, channel)
        end
    end
    channels = {}
    for channel in pairs(privateChannels) do
        pcall(DeleteVoiceChannel, channel)
    end
    privateChannels = {}
    for channel in pairs(managedChannels) do
        pcall(DeleteVoiceChannel, channel)
    end
    managedChannels = {}
end

local function ensureChannels()
    if #channels == #config.proximityDistances then
        return true
    end
    if not voiceAvailable() then
        return false
    end
    deleteChannels()
    for index, distance in ipairs(config.proximityDistances) do
        local ok, channel = pcall(CreateVoiceChannel, 1, distance)
        if not ok
            or type(channel) ~= 'number'
            or channel < 0
            or channel >= 65535 then
            print(('[fluxcore_voice] channel creation failed for %.1f meters: %s')
                :format(distance, tostring(channel)))
            deleteChannels()
            return false
        end
        channels[index] = channel
        print(('[fluxcore_voice] proximity channel %d created at %.1f meters')
            :format(channel, distance))
    end
    return true
end

local function snapshot(index, ready)
    return {
        ready = ready == true,
        channel = index and channels[index] or nil,
        proximityIndex = index,
        proximityDistance = index and config.proximityDistances[index] or nil
    }
end

local function applyMode(playerSource, index)
    local id = tonumber(playerSource)
    if not id or not members[id] or not channels[index] then
        return false
    end
    local previous = members[id]
    for channelIndex, channel in ipairs(channels) do
        local ok, reason = pcall(
            SetPlayerMutedInVoiceChannel,
            channel,
            id,
            channelIndex ~= index
        )
        if not ok then
            print(('[fluxcore_voice] could not set mode for source %d: %s')
                :format(id, tostring(reason)))
            for restoreIndex, restoreChannel in ipairs(channels) do
                pcall(
                    SetPlayerMutedInVoiceChannel,
                    restoreChannel,
                    id,
                    restoreIndex ~= previous
                )
            end
            return false
        end
    end
    members[id] = index
    TriggerClientEvent('fluxcore_voice:client:ready', id, snapshot(index, true))
    return true
end

local function addPlayer(playerSource)
    local id = tonumber(playerSource)
    if not id or id <= 0 or members[id] or not ensureChannels() then
        return false
    end
    local added = {}
    for index, channel in ipairs(channels) do
        local ok, reason = pcall(AddPlayerToVoiceChannel, channel, id)
        if not ok then
            print(('[fluxcore_voice] could not add source %d: %s')
                :format(id, tostring(reason)))
            for _, addedChannel in ipairs(added) do
                pcall(RemovePlayerFromVoiceChannel, addedChannel, id)
            end
            return false
        end
        added[index] = channel
    end
    members[id] = config.defaultProximityIndex
    if not applyMode(id, config.defaultProximityIndex) then
        for _, channel in ipairs(added) do
            pcall(RemovePlayerFromVoiceChannel, channel, id)
        end
        members[id] = nil
        return false
    end
    return true
end

local function removePlayer(playerSource)
    local id = tonumber(playerSource)
    if not id or not members[id] then
        return false
    end
    for _, channel in ipairs(channels) do
        pcall(RemovePlayerFromVoiceChannel, channel, id)
    end
    members[id] = nil
    lastCycleAt[id] = nil
    TriggerClientEvent(
        'fluxcore_voice:client:ready',
        id,
        snapshot(nil, false)
    )
    return true
end

CreateThread(function()
    Wait(0)
    if not ensureChannels() then
        print('[fluxcore_voice] voice API unavailable; update the Enhanced server artifact before testing voice')
        return
    end
    for _, playerSource in ipairs(GetPlayers()) do
        local ok, player = pcall(function()
            return exports.fluxcore_core:GetPlayerData(tonumber(playerSource))
        end)
        if ok and type(player) == 'table' and player.characterId then
            addPlayer(playerSource)
        end
    end
end)

AddEventHandler('playerDropped', function()
    removePlayer(source)
end)

AddEventHandler('Fluxcore:server:playerLoaded', function(playerSource)
    addPlayer(playerSource)
end)

AddEventHandler('Fluxcore:server:playerLoggedOut', function(playerSource)
    removePlayer(playerSource)
end)

RegisterNetEvent('fluxcore_voice:server:cycleProximity', function()
    local playerSource = tonumber(source)
    if not playerSource or not members[playerSource] then
        return
    end
    local now = GetGameTimer()
    if now - (lastCycleAt[playerSource] or 0) < 500 then
        return
    end
    lastCycleAt[playerSource] = now
    local nextIndex = (members[playerSource] % #config.proximityDistances) + 1
    if applyMode(playerSource, nextIndex) then
        notify(
            playerSource,
            ('Voice range: %.0f meters.'):format(
                config.proximityDistances[nextIndex]
            ),
            'success'
        )
    end
end)

RegisterCommand('voice', function(playerSource)
    if playerSource <= 0 then
        local memberCount = 0
        for _ in pairs(members) do
            memberCount = memberCount + 1
        end
        print(('Voice ranges: %s meters | channels: %d | members: %d')
            :format(
                table.concat(config.proximityDistances, ', '),
                #channels,
                memberCount
            ))
        return
    end
    local index = members[playerSource]
    if not index then
        notify(
            playerSource,
            'Select a character before using proximity voice.',
            'error'
        )
        return
    end
    notify(
        playerSource,
        ('Proximity voice is active at %.0f meters.'):format(
            config.proximityDistances[index]
        ),
        'success'
    )
end, false)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource == resourceName then
        deleteChannels()
    end
end)

exports('GetVoiceState', function()
    return {
        available = #channels == #config.proximityDistances,
        channels = channels,
        proximityDistances = config.proximityDistances
    }
end)

exports('CreatePrivateChannel', function(firstSource, secondSource)
    local first = tonumber(firstSource)
    local second = tonumber(secondSource)
    if not first or not second or first <= 0 or second <= 0 or not voiceAvailable() then
        return nil
    end
    local ok, channel = pcall(CreateVoiceChannel, 0, 0.0)
    if not ok or type(channel) ~= 'number' or channel < 0 or channel >= 65535 then
        return nil
    end
    local firstAdded = pcall(AddPlayerToVoiceChannel, channel, first)
    local secondAdded = firstAdded and pcall(AddPlayerToVoiceChannel, channel, second)
    if not firstAdded or not secondAdded then
        pcall(RemovePlayerFromVoiceChannel, channel, first)
        pcall(RemovePlayerFromVoiceChannel, channel, second)
        pcall(DeleteVoiceChannel, channel)
        return nil
    end
    privateChannels[channel] = { first, second }
    return channel
end)

exports('DeletePrivateChannel', function(channelId)
    local channel = tonumber(channelId)
    local participants = channel and privateChannels[channel]
    if not participants then
        return false
    end
    for _, playerSource in ipairs(participants) do
        pcall(RemovePlayerFromVoiceChannel, channel, playerSource)
    end
    pcall(DeleteVoiceChannel, channel)
    privateChannels[channel] = nil
    return true
end)

exports('CreateManagedVoiceChannel', function()
    if not voiceAvailable() then return nil end
    local ok, channel = pcall(CreateVoiceChannel, 0, 0.0)
    if not ok or type(channel) ~= 'number' or channel < 0 or channel >= 65535 then return nil end
    managedChannels[channel] = {}
    return channel
end)

exports('JoinManagedVoiceChannel', function(channelId, playerSource)
    local channel = tonumber(channelId)
    local player = tonumber(playerSource)
    if not channel or not player or not managedChannels[channel] then return false end
    local ok = pcall(AddPlayerToVoiceChannel, channel, player)
    if ok then managedChannels[channel][player] = true end
    return ok
end)

exports('LeaveManagedVoiceChannel', function(channelId, playerSource)
    local channel = tonumber(channelId)
    local player = tonumber(playerSource)
    if not channel or not player or not managedChannels[channel] then return false end
    pcall(RemovePlayerFromVoiceChannel, channel, player)
    managedChannels[channel][player] = nil
    return true
end)

exports('DeleteManagedVoiceChannel', function(channelId)
    local channel = tonumber(channelId)
    if not channel or not managedChannels[channel] then return false end
    for player in pairs(managedChannels[channel]) do pcall(RemovePlayerFromVoiceChannel, channel, player) end
    pcall(DeleteVoiceChannel, channel)
    managedChannels[channel] = nil
    return true
end)
