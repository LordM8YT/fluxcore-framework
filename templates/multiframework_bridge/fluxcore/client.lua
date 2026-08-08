Bridge = Bridge or {}
Bridge.Framework = 'Fluxcore'

function Bridge.IsAvailable()
    return GetResourceState('fluxcore_bridge') == 'started'
end

function Bridge.GetPlayerData()
    return exports.fluxcore_bridge:GetPlayerData()
end

function Bridge.GetIdentifier()
    local player = Bridge.GetPlayerData()
    return player and player.characterId or nil
end

function Bridge.GetJob()
    return exports.fluxcore_bridge:GetJob()
end

function Bridge.IsLoggedIn()
    return exports.fluxcore_bridge:IsLoggedIn()
end

function Bridge.HasItem(itemName, amount)
    return exports.fluxcore_bridge:HasItem(itemName, amount or 1)
end

function Bridge.Notify(message, kind)
    return exports.fluxcore_bridge:Notify(message, kind)
end

AddEventHandler('Fluxcore:client:playerLoaded', function(player)
    TriggerEvent('bridge:client:playerLoaded', player)
end)

AddEventHandler('Fluxcore:client:playerUpdated', function(player)
    TriggerEvent('bridge:client:playerUpdated', player)
end)

AddEventHandler('Fluxcore:client:playerLoggedOut', function()
    TriggerEvent('bridge:client:playerLoggedOut')
end)

return Bridge
