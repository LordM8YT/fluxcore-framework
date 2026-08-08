local RESOURCE = GetCurrentResourceName()

local function ok(result)
    return type(result) == 'table' and result.ok == true
end

local function money(identifier, moneyType)
    local result = exports.fluxcore_bridge:GetMoney(identifier, moneyType)
    return ok(result) and result.data or false
end

local function playerData(source, snapshot)
    if not snapshot then return nil end
    local profile, job = snapshot.profile or {}, snapshot.job or {}
    return {
        source = tonumber(source),
        citizenid = snapshot.characterId,
        cid = snapshot.slot,
        charinfo = {
            firstname = profile.firstName or profile.firstname or '',
            lastname = profile.lastName or profile.lastname or '',
            birthdate = profile.dateOfBirth or profile.birthdate or '',
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
        jobs = { [job.name or 'unemployed'] = job.grade or 0 },
        metadata = snapshot.metadata or {},
        position = snapshot.position
    }
end

local function setJob(identifier, jobName, grade)
    local assigned = exports.fluxcore_bridge:AssignJob(
        identifier, jobName, tonumber(grade) or 0
    )
    if not ok(assigned) then return false end
    return ok(exports.fluxcore_bridge:SetActiveJob(identifier, jobName))
end

local function makePlayer(identifier)
    local snapshot = exports.fluxcore_bridge:GetPlayer(identifier)
    if not snapshot then return nil end
    local source = tonumber(identifier)
        or exports.fluxcore_core:GetPlayerSource(snapshot.characterId)
    local player = { PlayerData = playerData(source, snapshot), Functions = {} }
    function player.Functions.GetMoney(moneyType)
        return money(identifier, moneyType)
    end
    function player.Functions.AddMoney(moneyType, amount, reason)
        return ok(exports.fluxcore_bridge:AddMoney(
            identifier, moneyType, amount, reason or 'qbx_port', nil
        ))
    end
    function player.Functions.RemoveMoney(moneyType, amount, reason)
        return ok(exports.fluxcore_bridge:RemoveMoney(
            identifier, moneyType, amount, reason or 'qbx_port', nil
        ))
    end
    function player.Functions.SetMoney(moneyType, amount, reason)
        return ok(exports.fluxcore_bridge:SetMoney(
            identifier, moneyType, amount, reason or 'qbx_port', nil
        ))
    end
    function player.Functions.SetJob(jobName, grade)
        return setJob(identifier, jobName, grade)
    end
    function player.Functions.SetJobDuty(onDuty)
        return ok(exports.fluxcore_bridge:SetDuty(identifier, onDuty == true))
    end
    function player.Functions.AddItem(itemName, amount, slot, info)
        return ok(exports.fluxcore_bridge:AddItem(
            identifier, itemName, amount, info or {}, slot
        ))
    end
    function player.Functions.RemoveItem(itemName, amount, _slot, info)
        return ok(exports.fluxcore_bridge:RemoveItem(
            identifier, itemName, amount, info
        ))
    end
    return player
end

exports('GetCoreVersion', function() return 'fluxcore-porting-0.1.0' end)
exports('GetPlayer', makePlayer)
exports('GetPlayerByCitizenId', makePlayer)
exports('GetSource', function(identifier)
    return exports.fluxcore_core:GetPlayerSource(identifier)
end)
exports('GetQBPlayers', function()
    local players = {}
    for _, snapshot in ipairs(exports.fluxcore_bridge:GetPlayers()) do
        players[snapshot.source] = makePlayer(snapshot.source)
    end
    return players
end)
exports('GetPlayersData', function()
    local players = {}
    for _, snapshot in ipairs(exports.fluxcore_bridge:GetPlayers()) do
        players[#players + 1] = playerData(snapshot.source, snapshot)
    end
    return players
end)
exports('GetMoney', money)
exports('AddMoney', function(identifier, moneyType, amount, reason)
    return ok(exports.fluxcore_bridge:AddMoney(
        identifier, moneyType, amount, reason or 'qbx_port', nil
    ))
end)
exports('RemoveMoney', function(identifier, moneyType, amount, reason)
    return ok(exports.fluxcore_bridge:RemoveMoney(
        identifier, moneyType, amount, reason or 'qbx_port', nil
    ))
end)
exports('SetMoney', function(identifier, moneyType, amount, reason)
    return ok(exports.fluxcore_bridge:SetMoney(
        identifier, moneyType, amount, reason or 'qbx_port', nil
    ))
end)
exports('SetJob', setJob)
exports('SetJobDuty', function(identifier, onDuty)
    return ok(exports.fluxcore_bridge:SetDuty(identifier, onDuty == true))
end)

exports('FluxcoreAdapterCall', function(method, payload)
    payload = type(payload) == 'table' and payload or {}
    if method == 'get-player' then return makePlayer(payload.source) end
    if method == 'get-money' then return money(payload.source, payload.moneyType) end
    return nil
end)

local pending = false
local function registerAdapter()
    if pending then return end
    pending = true
    CreateThread(function()
        for _ = 1, 50 do
            if GetResourceState('fluxcore_bridge') == 'started' then
                local called, result = pcall(function()
                    return exports.fluxcore_bridge:RegisterAdapter('qbox', {
                        version = '0.1.0',
                        exportName = 'FluxcoreAdapterCall',
                        methods = { 'get-player', 'get-money' }
                    })
                end)
                if called and result and result.ok then pending = false return end
            end
            Wait(100)
        end
        pending = false
        print('[fluxcore_qbx_bridge] adapter registration timed out')
    end)
end

AddEventHandler('onResourceStart', function(startedResource)
    if startedResource == RESOURCE or startedResource == 'fluxcore_bridge' then
        registerAdapter()
    end
end)
registerAdapter()
print('[fluxcore_qbx_bridge] experimental Qbox porting provider ready')
