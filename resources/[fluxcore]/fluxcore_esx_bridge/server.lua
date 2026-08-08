local RESOURCE = GetCurrentResourceName()
local ESX = { PlayerData = {}, Players = {} }

local function ok(result)
    return type(result) == 'table' and result.ok == true
end

local function currency(account)
    return account == 'money' and 'cash' or account
end

local function makePlayer(identifier)
    local snapshot = exports.fluxcore_bridge:GetPlayer(identifier)
    if not snapshot then return nil end
    local source = tonumber(identifier)
        or exports.fluxcore_core:GetPlayerSource(snapshot.characterId)
    local profile, job = snapshot.profile or {}, snapshot.job or {}
    local xPlayer = {
        source = source,
        identifier = snapshot.characterId,
        job = {
            name = job.name or 'unemployed',
            label = job.label or job.name or 'Unemployed',
            grade = job.grade or 0,
            grade_name = job.gradeLabel or tostring(job.grade or 0),
            grade_label = job.gradeLabel or tostring(job.grade or 0),
            onDuty = job.onDuty == true
        }
    }
    function xPlayer.getIdentifier() return snapshot.characterId end
    function xPlayer.getName()
        return (('%s %s'):format(
            profile.firstName or profile.firstname or '',
            profile.lastName or profile.lastname or ''
        )):match('^%s*(.-)%s*$')
    end
    function xPlayer.getJob() return xPlayer.job end
    function xPlayer.getMoney() return snapshot.money and snapshot.money.cash or 0 end
    function xPlayer.getAccount(account)
        local name = currency(account)
        local result = exports.fluxcore_bridge:GetMoney(identifier, name)
        return { name = account, money = ok(result) and result.data or 0 }
    end
    function xPlayer.addMoney(amount, reason)
        return ok(exports.fluxcore_bridge:AddMoney(
            identifier, 'cash', amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.removeMoney(amount, reason)
        return ok(exports.fluxcore_bridge:RemoveMoney(
            identifier, 'cash', amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.setMoney(amount, reason)
        return ok(exports.fluxcore_bridge:SetMoney(
            identifier, 'cash', amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.addAccountMoney(account, amount, reason)
        return ok(exports.fluxcore_bridge:AddMoney(
            identifier, currency(account), amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.removeAccountMoney(account, amount, reason)
        return ok(exports.fluxcore_bridge:RemoveMoney(
            identifier, currency(account), amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.setAccountMoney(account, amount, reason)
        return ok(exports.fluxcore_bridge:SetMoney(
            identifier, currency(account), amount, reason or 'esx_port', nil
        ))
    end
    function xPlayer.getInventoryItem(itemName)
        local result = exports.fluxcore_bridge:HasItem(identifier, itemName, 1)
        local inventory = exports.fluxcore_bridge:GetInventory(identifier)
        local count = 0
        if ok(inventory) and inventory.data and inventory.data.items then
            for _, item in ipairs(inventory.data.items) do
                if item.name == itemName then count = count + (item.amount or 0) end
            end
        end
        return { name = itemName, count = count, usable = ok(result) }
    end
    function xPlayer.addInventoryItem(itemName, amount, metadata, slot)
        return ok(exports.fluxcore_bridge:AddItem(
            identifier, itemName, amount, metadata or {}, slot
        ))
    end
    function xPlayer.removeInventoryItem(itemName, amount, metadata)
        return ok(exports.fluxcore_bridge:RemoveItem(
            identifier, itemName, amount, metadata
        ))
    end
    function xPlayer.setJob(jobName, grade)
        local assigned = exports.fluxcore_bridge:AssignJob(
            identifier, jobName, tonumber(grade) or 0
        )
        if not ok(assigned) then return false end
        return ok(exports.fluxcore_bridge:SetActiveJob(identifier, jobName))
    end
    return xPlayer
end

function ESX.GetPlayerFromId(source) return makePlayer(source) end
function ESX.GetPlayerFromIdentifier(identifier) return makePlayer(identifier) end
function ESX.GetPlayers()
    local sources = {}
    for _, player in ipairs(exports.fluxcore_bridge:GetPlayers()) do
        sources[#sources + 1] = player.source
    end
    return sources
end
function ESX.GetExtendedPlayers()
    local players = {}
    for _, source in ipairs(ESX.GetPlayers()) do
        players[#players + 1] = makePlayer(source)
    end
    return players
end

exports('getSharedObject', function() return ESX end)
exports('GetPlayerFromId', ESX.GetPlayerFromId)
exports('GetPlayerFromIdentifier', ESX.GetPlayerFromIdentifier)
exports('GetExtendedPlayers', ESX.GetExtendedPlayers)
AddEventHandler('esx:getSharedObject', function(callback)
    if type(callback) == 'function' then callback(ESX) end
end)

exports('FluxcoreAdapterCall', function(method, payload)
    payload = type(payload) == 'table' and payload or {}
    if method == 'get-player' then return makePlayer(payload.source) end
    if method == 'get-players' then return ESX.GetExtendedPlayers() end
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
                    return exports.fluxcore_bridge:RegisterAdapter('esx', {
                        version = '0.1.0',
                        exportName = 'FluxcoreAdapterCall',
                        methods = { 'get-player', 'get-players' }
                    })
                end)
                if called and result and result.ok then pending = false return end
            end
            Wait(100)
        end
        pending = false
        print('[fluxcore_esx_bridge] adapter registration timed out')
    end)
end

AddEventHandler('onResourceStart', function(startedResource)
    if startedResource == RESOURCE or startedResource == 'fluxcore_bridge' then
        registerAdapter()
    end
end)
registerAdapter()
print('[fluxcore_esx_bridge] experimental ESX porting provider ready')
