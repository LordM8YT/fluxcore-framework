local RESOURCE = GetCurrentResourceName()
local ADAPTER_NAME = 'qbcore'

QBCore = {
    Functions = {},
    Shared = {
        Jobs = {},
        Items = {}
    }
}

local function successful(result)
    return type(result) == 'table' and result.ok == true
end

local function profileValue(profile, ...)
    for index = 1, select('#', ...) do
        local value = profile[select(index, ...)]
        if value ~= nil then return value end
    end
    return nil
end

local function qbPlayerData(source, snapshot)
    if not snapshot then return nil end
    local profile = snapshot.profile or {}
    local job = snapshot.job or {}
    return {
        source = tonumber(source),
        citizenid = snapshot.characterId,
        cid = snapshot.slot,
        charinfo = {
            firstname = profileValue(profile, 'firstName', 'firstname') or '',
            lastname = profileValue(profile, 'lastName', 'lastname') or '',
            birthdate = profileValue(profile, 'dateOfBirth', 'birthdate') or '',
            gender = profile.gender,
            nationality = profile.nationality or ''
        },
        money = snapshot.money or {},
        job = {
            name = job.name or 'unemployed',
            label = job.label or job.name or 'Unemployed',
            type = job.type or 'civilian',
            onduty = job.onDuty == true,
            payment = job.payment or 0,
            grade = {
                name = job.gradeLabel or tostring(job.grade or 0),
                level = job.grade or 0
            }
        },
        metadata = snapshot.metadata or {},
        position = snapshot.position
    }
end

local function makePlayer(source)
    source = tonumber(source)
    local snapshot = exports.fluxcore_bridge:GetPlayer(source)
    if not snapshot then return nil end

    local player = { PlayerData = qbPlayerData(source, snapshot), Functions = {} }

    function player.Functions.AddMoney(moneyType, amount, reason)
        return successful(exports.fluxcore_bridge:AddMoney(
            source, moneyType, amount, reason or 'qb_bridge', nil
        ))
    end

    function player.Functions.RemoveMoney(moneyType, amount, reason)
        return successful(exports.fluxcore_bridge:RemoveMoney(
            source, moneyType, amount, reason or 'qb_bridge', nil
        ))
    end

    function player.Functions.SetMoney(moneyType, amount, reason)
        return successful(exports.fluxcore_bridge:SetMoney(
            source, moneyType, amount, reason or 'qb_bridge', nil
        ))
    end

    function player.Functions.AddItem(itemName, amount, slot, info)
        return successful(exports.fluxcore_bridge:AddItem(
            source, itemName, amount, info or {}, slot
        ))
    end

    function player.Functions.RemoveItem(itemName, amount, _slot, info)
        return successful(exports.fluxcore_bridge:RemoveItem(
            source, itemName, amount, info
        ))
    end

    function player.Functions.SetJob(jobName, grade)
        local assigned = exports.fluxcore_bridge:AssignJob(
            source, jobName, tonumber(grade) or 0
        )
        if not successful(assigned) then return false end
        return successful(exports.fluxcore_bridge:SetActiveJob(source, jobName))
    end

    function player.Functions.SetJobDuty(onDuty)
        return successful(exports.fluxcore_bridge:SetDuty(source, onDuty == true))
    end

    function player.Functions.GetMoney(moneyType)
        local result = exports.fluxcore_bridge:GetMoney(source, moneyType)
        return successful(result) and result.data or 0
    end

    return player
end

function QBCore.Functions.GetPlayer(source)
    return makePlayer(source)
end

function QBCore.Functions.GetPlayerByCitizenId(citizenId)
    local source = exports.fluxcore_core:GetPlayerSource(citizenId)
    return source and source > 0 and makePlayer(source) or nil
end

function QBCore.Functions.GetPlayers()
    local sources = {}
    for _, player in ipairs(exports.fluxcore_bridge:GetPlayers()) do
        sources[#sources + 1] = player.source
    end
    return sources
end

function QBCore.Functions.GetQBPlayers()
    local players = {}
    for _, source in ipairs(QBCore.Functions.GetPlayers()) do
        players[source] = makePlayer(source)
    end
    return players
end

function QBCore.Functions.HasItem(source, itemName, amount)
    local result = exports.fluxcore_bridge:HasItem(source, itemName, amount or 1)
    return successful(result) and result.data == true
end

exports('GetCoreObject', function()
    return QBCore
end)

AddEventHandler('QBCore:GetObject', function(callback)
    if type(callback) == 'function' then callback(QBCore) end
end)

exports('FluxcoreAdapterCall', function(method, payload)
    payload = type(payload) == 'table' and payload or {}
    if method == 'get-player' then
        return qbPlayerData(payload.source, exports.fluxcore_bridge:GetPlayer(payload.source))
    end
    if method == 'has-item' then
        return QBCore.Functions.HasItem(payload.source, payload.item, payload.amount)
    end
    return nil
end)

local registrationPending = false

local function registerAdapter()
    if registrationPending then return end
    registrationPending = true
    CreateThread(function()
        for _ = 1, 50 do
            if GetResourceState('fluxcore_bridge') == 'started' then
                local called, result = pcall(function()
                    return exports.fluxcore_bridge:RegisterAdapter(ADAPTER_NAME, {
                        version = '0.1.0',
                        exportName = 'FluxcoreAdapterCall',
                        methods = { 'get-player', 'has-item' }
                    })
                end)
                if called and result and result.ok then
                    registrationPending = false
                    return
                end
            end
            Wait(100)
        end
        registrationPending = false
        print('[fluxcore_qb_bridge] adapter registration timed out')
    end)
end

AddEventHandler('onResourceStart', function(startedResource)
    if startedResource == RESOURCE or startedResource == 'fluxcore_bridge' then
        registerAdapter()
    end
end)

registerAdapter()
print('[fluxcore_qb_bridge] limited QBCore compatibility provider ready')
