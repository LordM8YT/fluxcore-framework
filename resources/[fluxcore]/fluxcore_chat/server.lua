local MAX_LENGTH = 280
local RP_DISTANCE = 20.0
local lastMessageAt = {}

local function cleanText(value)
    local text = tostring(value or ''):gsub('[\r\n]', ' '):gsub('%s+', ' ')
    text = text:gsub('^%s+', ''):gsub('%s+$', '')
    if #text > MAX_LENGTH then
        text = text:sub(1, MAX_LENGTH)
    end
    return text
end

local function characterName(playerSource)
    local ok, player = pcall(function()
        return exports.fluxcore_core:GetPlayerData(playerSource)
    end)
    local profile = ok and player and player.profile or {}
    local name = (tostring(profile.firstName or '') .. ' ' .. tostring(profile.lastName or ''))
        :gsub('^%s+', ''):gsub('%s+$', '')
    return name ~= '' and name or GetPlayerName(playerSource) or ('Player %s'):format(playerSource)
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

local function nearbyRecipients(playerSource)
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
            if math.sqrt(dx * dx + dy * dy + dz * dz) <= RP_DISTANCE then
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
    local message = { type = 'say', author = characterName(playerSource), text = text }
    for _, target in ipairs(nearbyRecipients(playerSource)) do send(target, message) end
end)

RegisterNetEvent('fluxcore_chat:server:roleplay', function(kind, rawText)
    local playerSource = source
    kind = tostring(kind or ''):lower()
    if kind ~= 'me' and kind ~= 'do' and kind ~= 'ooc' then return end
    local text = cleanText(rawText)
    if text == '' or rateLimited(playerSource) then return end
    local message = { type = kind, author = characterName(playerSource), text = text }
    local recipients = kind == 'ooc' and GetPlayers() or nearbyRecipients(playerSource)
    for _, target in ipairs(recipients) do send(tonumber(target), message) end
end)

AddEventHandler('playerDropped', function()
    lastMessageAt[source] = nil
end)
