local function playerData()
    return exports.fluxcore_core:GetPlayerData()
end

exports('GetPlayerData', playerData)
exports('IsLoggedIn', function()
    return exports.fluxcore_core:IsLoggedIn()
end)
exports('GetJob', function()
    local player = playerData()
    return player and player.job or nil
end)
exports('HasItem', function(itemName, amount)
    if GetResourceState('fluxcore_inventory') ~= 'started' then return false end
    return exports.fluxcore_inventory:HasItem(itemName, amount or 1)
end)

local function notify(message, kind)
    local text = tostring(message or '')
    if text == '' then return false end
    TriggerEvent('chat:addMessage', {
        color = kind == 'error' and { 235, 90, 90 } or { 110, 205, 255 },
        args = { 'Fluxcore', text }
    })
    TriggerEvent('fluxcore_bridge:client:notified', text, kind or 'info')
    return true
end

RegisterNetEvent('fluxcore_bridge:client:notify', notify)
exports('Notify', notify)
