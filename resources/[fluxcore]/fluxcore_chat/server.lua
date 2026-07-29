local MAX_LENGTH = 280
local RP_DISTANCE = 20.0
local WHISPER_DISTANCE = 3.0
local SHOUT_DISTANCE = 40.0
local lastMessageAt = {}

local function cleanText(value)
    local text = tostring(value or '')
        :gsub('[%z\1-\31\127]', ' ')
        :gsub('%s+', ' ')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    local validUtf8, cutoff = pcall(utf8.offset, text, MAX_LENGTH + 1)
    if not validUtf8 then
        return ''
    end
    if cutoff then
        text = text:sub(1, cutoff - 1)
    end
    return text
end

local function characterName(playerSource)
    local ok, player = pcall(function()
        return exports.fluxcore_core:GetPlayerData(playerSource)
    end)
    if not ok or type(player) ~= 'table' or type(player.profile) ~= 'table' then
        return nil
    end
    local profile = player.profile
    local name = (tostring(profile.firstName or '') .. ' ' .. tostring(profile.lastName or ''))
        :gsub('^%s+', ''):gsub('%s+$', '')
    return name ~= '' and name or nil
end

local function rateLimited(playerSource)
    local now = os.time()
    if lastMessageAt[playerSource] == now then return true end
    lastMessageAt[playerSource] = now
    return false
end

local function send(target, message)
    TriggerClientEvent('fluxcore_chat:client:message', target, message)
end

local function nearbyRecipients(playerSource, maximumDistance)
    local sourcePed = GetPlayerPed(playerSource)
    if sourcePed == 0 then return { playerSource } end
    local sourceCoords = GetEntityCoords(sourcePed)
    local recipients = {}
    for _, candidate in ipairs(GetPlayers()) do
        local target = tonumber(candidate)
        local targetPed = target and GetPlayerPed(target) or 0
        if targetPed ~= 0 then
            local coords = GetEntityCoords(targetPed)
            local dx, dy, dz = sourceCoords.x - coords.x, sourceCoords.y - coords.y, sourceCoords.z - coords.z
            if math.sqrt(dx * dx + dy * dy + dz * dz)
                <= (maximumDistance or RP_DISTANCE) then
                recipients[#recipients + 1] = target
            end
        end
    end
    return recipients
end

RegisterNetEvent('fluxcore_chat:server:message', function(rawText)
    local playerSource = source
    local text = cleanText(rawText)
    if text == '' or rateLimited(playerSource) then return end
    local author = characterName(playerSource)
    if not author then return end
    local message = {
        type = 'say',
        source = playerSource,
        author = author,
        text = text
    }
    for _, target in ipairs(nearbyRecipients(playerSource)) do send(target, message) end
end)

RegisterNetEvent('fluxcore_chat:server:roleplay', function(kind, rawText)
    local playerSource = source
    kind = tostring(kind or ''):lower()
    if kind ~= 'me'
        and kind ~= 'do'
        and kind ~= 'try'
        and kind ~= 'whisper'
        and kind ~= 'shout'
        and kind ~= 'ooc' then
        return
    end
    local text = cleanText(rawText)
    if text == '' or rateLimited(playerSource) then return end
    local author = characterName(playerSource)
    if not author then return end
    if kind == 'try' then
        text = ('%s — %s'):format(
            text,
            math.random(0, 1) == 1 and 'SUCCESS' or 'FAIL'
        )
    end
    local message = {
        type = kind,
        source = playerSource,
        author = author,
        text = text
    }
    local recipients
    if kind == 'ooc' then
        recipients = GetPlayers()
    elseif kind == 'whisper' then
        recipients = nearbyRecipients(playerSource, WHISPER_DISTANCE)
    elseif kind == 'shout' then
        recipients = nearbyRecipients(playerSource, SHOUT_DISTANCE)
    else
        recipients = nearbyRecipients(playerSource, RP_DISTANCE)
    end
    for _, target in ipairs(recipients) do send(tonumber(target), message) end
end)

local function forgetPlayer(playerSource)
    local id = tonumber(playerSource)
    if id then
        lastMessageAt[id] = nil
    end
end

AddEventHandler('Fluxcore:server:playerLoggedOut', forgetPlayer)

AddEventHandler('playerDropped', function()
    forgetPlayer(source)
end)

AddEventHandler('playerDropped', function()
    lastMessageAt[source] = nil
end)
