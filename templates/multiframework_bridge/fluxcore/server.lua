Bridge = Bridge or {}
Bridge.Framework = 'Fluxcore'

function Bridge.IsAvailable()
    return GetResourceState('fluxcore_bridge') == 'started'
end

local function unwrap(result, fallback)
    if type(result) ~= 'table' or result.ok ~= true then return fallback end
    return result.data
end

function Bridge.GetPlayer(source)
    return exports.fluxcore_bridge:GetPlayer(source)
end

function Bridge.GetIdentifier(source)
    local player = Bridge.GetPlayer(source)
    return player and player.characterId or nil
end

function Bridge.GetName(source)
    local player = Bridge.GetPlayer(source)
    local profile = player and player.profile or {}
    return (('%s %s'):format(
        profile.firstName or '',
        profile.lastName or ''
    )):match('^%s*(.-)%s*$')
end

function Bridge.GetJob(source)
    local player = Bridge.GetPlayer(source)
    return player and player.job or nil
end

function Bridge.GetMoney(source, account)
    return unwrap(exports.fluxcore_bridge:GetMoney(source, account), 0)
end

function Bridge.AddMoney(source, account, amount, reason, reference)
    return exports.fluxcore_bridge:AddMoney(
        source, account, amount, reason, reference
    ).ok == true
end

function Bridge.RemoveMoney(source, account, amount, reason, reference)
    return exports.fluxcore_bridge:RemoveMoney(
        source, account, amount, reason, reference
    ).ok == true
end

function Bridge.SetMoney(source, account, amount, reason, reference)
    return exports.fluxcore_bridge:SetMoney(
        source, account, amount, reason, reference
    ).ok == true
end

function Bridge.HasItem(source, itemName, amount, metadata)
    return unwrap(exports.fluxcore_bridge:HasItem(
        source, itemName, amount or 1, metadata
    ), false)
end

function Bridge.AddItem(source, itemName, amount, metadata, slot)
    return exports.fluxcore_bridge:AddItem(
        source, itemName, amount, metadata or {}, slot
    ).ok == true
end

function Bridge.RemoveItem(source, itemName, amount, metadata)
    return exports.fluxcore_bridge:RemoveItem(
        source, itemName, amount, metadata
    ).ok == true
end

function Bridge.SetJob(source, jobName, grade)
    local assigned = exports.fluxcore_bridge:AssignJob(
        source, jobName, tonumber(grade) or 0
    )
    if not assigned.ok then return false end
    return exports.fluxcore_bridge:SetActiveJob(source, jobName).ok == true
end

function Bridge.SetDuty(source, onDuty)
    return exports.fluxcore_bridge:SetDuty(source, onDuty == true).ok == true
end

function Bridge.Notify(source, message, kind)
    return exports.fluxcore_bridge:Notify(source, message, kind)
end

function Bridge.GetVehicles(source)
    return unwrap(exports.fluxcore_bridge:GetVehicles(source), {})
end

function Bridge.RegisterOwnedVehicle(source, vehicle)
    return exports.fluxcore_bridge:RegisterOwnedVehicle(source, vehicle)
end

function Bridge.HasVehicleKey(source, vehicleId)
    return unwrap(exports.fluxcore_bridge:HasVehicleKey(source, vehicleId), false)
end

function Bridge.GiveVehicleKey(ownerSource, targetSource, vehicleId)
    return exports.fluxcore_bridge:GiveVehicleKey(
        ownerSource, targetSource, vehicleId
    )
end

function Bridge.GetBusinesses(source)
    return unwrap(exports.fluxcore_bridge:GetBusinesses(source), {})
end

function Bridge.CreditBusiness(id, amount, reason, reference)
    return exports.fluxcore_bridge:CreditBusiness(
        id, amount, reason, reference
    )
end

function Bridge.DebitBusiness(id, amount, reason, reference)
    return exports.fluxcore_bridge:DebitBusiness(
        id, amount, reason, reference
    )
end

return Bridge
