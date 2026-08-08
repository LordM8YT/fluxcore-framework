local RESOURCE = GetCurrentResourceName()
local adapters = {}
local capabilities = {
    'player.read', 'player.list', 'money.read', 'money.write',
    'inventory.read', 'inventory.write', 'jobs.read', 'jobs.write',
    'vehicles.read', 'vehicles.write', 'businesses.read',
    'businesses.write', 'notify'
}

local function result(work)
    local called, data = pcall(work)
    if called then return { ok = true, data = data } end
    return {
        ok = false,
        error = { code = 'BRIDGE_ERROR', message = tostring(data) }
    }
end

local function started(name)
    return GetResourceState(name) == 'started'
end

local function requireResource(name)
    if not started(name) then error(('%s is not started'):format(name)) end
end

local function validName(value, field)
    local name = type(value) == 'string' and value:match('^%s*(.-)%s*$') or ''
    if #name < 2 or #name > 64 or not name:match('^[a-z][a-z0-9_.-]+$') then
        error(('%s is invalid'):format(field))
    end
    return name
end

local function validExportName(value)
    local name = type(value) == 'string' and value or ''
    if #name < 1 or #name > 64 or not name:match('^[A-Za-z][A-Za-z0-9_]*$') then
        error('export name is invalid')
    end
    return name
end

exports('GetCapabilities', function()
    return {
        api = 'fluxcore.bridge.v1',
        capabilities = capabilities,
        optionalResources = {
            inventory = started('fluxcore_inventory'),
            jobs = started('fluxcore_jobs'),
            vehicles = started('fluxcore_vehicles'),
            businesses = started('fluxcore_businesses')
        }
    }
end)
exports('GetPlayer', function(identifier)
    return exports.fluxcore_core:GetPlayer(identifier)
end)
exports('GetPlayers', function()
    return exports.fluxcore_core:GetPlayers()
end)
exports('GetMoney', function(identifier, currency)
    return exports.fluxcore_core:GetMoney(identifier, currency)
end)
exports('AddMoney', function(...)
    return exports.fluxcore_core:AddMoney(...)
end)
exports('RemoveMoney', function(...)
    return exports.fluxcore_core:RemoveMoney(...)
end)
exports('SetMoney', function(...)
    return exports.fluxcore_core:SetMoney(...)
end)
exports('GetInventory', function(identifier)
    return result(function()
        requireResource('fluxcore_inventory')
        return exports.fluxcore_inventory:GetInventory(identifier)
    end)
end)
exports('HasItem', function(...)
    local args = { ... }
    return result(function()
        requireResource('fluxcore_inventory')
        return exports.fluxcore_inventory:HasItem(table.unpack(args))
    end)
end)
exports('AddItem', function(...)
    requireResource('fluxcore_inventory')
    return exports.fluxcore_inventory:AddItem(...)
end)
exports('RemoveItem', function(...)
    requireResource('fluxcore_inventory')
    return exports.fluxcore_inventory:RemoveItem(...)
end)
exports('GetJobs', function(identifier)
    return result(function()
        requireResource('fluxcore_jobs')
        return exports.fluxcore_jobs:GetJobs(identifier)
    end)
end)
exports('AssignJob', function(...)
    requireResource('fluxcore_jobs')
    return exports.fluxcore_jobs:AssignJob(...)
end)
exports('SetActiveJob', function(...)
    requireResource('fluxcore_jobs')
    return exports.fluxcore_jobs:SetActiveJob(...)
end)
exports('SetDuty', function(...)
    requireResource('fluxcore_jobs')
    return exports.fluxcore_jobs:SetDuty(...)
end)
exports('Notify', function(source, message, kind)
    local playerSource = tonumber(source)
    if not playerSource or playerSource <= 0 then return false end
    TriggerClientEvent(
        'fluxcore_bridge:client:notify',
        playerSource,
        tostring(message or ''),
        kind or 'info'
    )
    return true
end)
exports('GetVehicles', function(identifier)
    return result(function()
        requireResource('fluxcore_vehicles')
        return exports.fluxcore_vehicles:GetVehicles(identifier)
    end)
end)
exports('RegisterOwnedVehicle', function(...)
    requireResource('fluxcore_vehicles')
    return exports.fluxcore_vehicles:RegisterOwnedVehicle(...)
end)
exports('HasVehicleKey', function(identifier, vehicleId)
    return result(function()
        requireResource('fluxcore_vehicles')
        return exports.fluxcore_vehicles:HasKey(identifier, vehicleId)
    end)
end)
exports('GiveVehicleKey', function(...)
    requireResource('fluxcore_vehicles')
    return exports.fluxcore_vehicles:GiveKey(...)
end)
exports('GetBusinesses', function(identifier)
    requireResource('fluxcore_businesses')
    return exports.fluxcore_businesses:GetBusinesses(identifier)
end)
exports('GetBusiness', function(id)
    requireResource('fluxcore_businesses')
    return exports.fluxcore_businesses:GetBusiness(id)
end)
exports('CreditBusiness', function(...)
    requireResource('fluxcore_businesses')
    return exports.fluxcore_businesses:CreditTreasury(...)
end)
exports('DebitBusiness', function(...)
    requireResource('fluxcore_businesses')
    return exports.fluxcore_businesses:DebitTreasury(...)
end)

exports('RegisterAdapter', function(name, descriptor)
    return result(function()
        local owner = GetInvokingResource()
        if not owner or owner == RESOURCE then
            error('adapters must be owned by another resource')
        end
        local adapterName = validName(name, 'adapter name')
        descriptor = type(descriptor) == 'table' and descriptor or {}
        local methods = {}
        for _, method in ipairs(descriptor.methods or {}) do
            methods[validName(method, 'method')] = true
        end
        if not next(methods) then error('adapter must declare methods') end
        adapters[adapterName] = {
            name = adapterName,
            owner = owner,
            exportName = validExportName(
                descriptor.exportName or 'FluxcoreAdapterCall'
            ),
            methods = methods,
            version = tostring(descriptor.version or '1.0.0')
        }
        return true
    end)
end)

exports('UnregisterAdapter', function(name)
    return result(function()
        local adapterName = validName(name, 'adapter name')
        local adapter = adapters[adapterName]
        if not adapter then return false end
        if adapter.owner ~= GetInvokingResource() then
            error('only the adapter owner may unregister it')
        end
        adapters[adapterName] = nil
        return true
    end)
end)

exports('ListAdapters', function()
    local list = {}
    for _, adapter in pairs(adapters) do
        local methods = {}
        for method in pairs(adapter.methods) do methods[#methods + 1] = method end
        list[#list + 1] = {
            name = adapter.name,
            owner = adapter.owner,
            exportName = adapter.exportName,
            methods = methods,
            version = adapter.version,
            available = started(adapter.owner)
        }
    end
    return list
end)

exports('CallAdapter', function(name, method, payload)
    return result(function()
        local adapter = adapters[validName(name, 'adapter name')]
        local methodName = validName(method, 'method')
        if not adapter or not started(adapter.owner) then
            error('adapter is unavailable')
        end
        if not adapter.methods[methodName] then
            error('adapter method is not declared')
        end
        return exports[adapter.owner][adapter.exportName](methodName, payload)
    end)
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    for name, adapter in pairs(adapters) do
        if adapter.owner == stoppedResource then adapters[name] = nil end
    end
end)

print('[fluxcore_bridge] integration facade v1 ready')
