local RESOURCE_NAME = GetCurrentResourceName()
local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local panelOpen = false
local frozen = false

local function locale(key, replacements, fallback)
    return exports.fluxcore_core:Locale(key, replacements, fallback)
end

local function localizeResponse(response)
    if type(response) ~= 'table' or response.ok ~= false
        or type(response.error) ~= 'table' then
        return response
    end
    local code = tostring(response.error.code or '')
    if code ~= '' then
        local key = ('errors.%s'):format(code)
        local translated = locale(key)
        if translated ~= key then
            response.error.message = translated
        end
    end
    return response
end

local function uiLocale()
    local data = exports.fluxcore_core:GetLocaleData('admin')
    data.labels = exports.fluxcore_core:GetLocaleData('labels')
    return data
end

local function message(text, kind)
    local color = kind == 'error' and { 220, 70, 70 } or { 90, 180, 255 }
    TriggerEvent('chat:addMessage', {
        color = color,
        args = { 'Fluxcore Admin', tostring(text) }
    })
    print(('[fluxcore_admin] %s'):format(tostring(text)))
end

local function nextRequestId()
    requestSequence = requestSequence + 1
    return ('%s:%s:%s'):format(
        GetPlayerServerId(PlayerId()),
        GetGameTimer(),
        requestSequence
    )
end

local function call(method, payload)
    local requestId = nextRequestId()
    local deferred = promise.new()
    local settled = false

    pending[requestId] = function(response)
        if settled then
            return
        end
        settled = true
        pending[requestId] = nil
        deferred:resolve(localizeResponse(response))
    end

    TriggerServerEvent(
        'fluxcore_admin:server:request',
        requestId,
        method,
        payload or {}
    )

    SetTimeout(REQUEST_TIMEOUT_MS, function()
        local resolver = pending[requestId]
        if resolver then
            resolver({
                ok = false,
                error = {
                    code = 'TIMEOUT',
                    message = locale(
                        'admin.errors.timeout',
                        nil,
                        'The admin request timed out.'
                    )
                }
            })
        end
    end)

    return Citizen.Await(deferred)
end

local function closePanel()
    panelOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'close' })
end

RegisterNetEvent('fluxcore_admin:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then
        resolver(response)
    end
end)

RegisterNetEvent('fluxcore_admin:client:teleport', function(position)
    local x = tonumber(position and position.x)
    local y = tonumber(position and position.y)
    local z = tonumber(position and position.z)
    if not x or not y or not z then
        return
    end
    local ped = PlayerPedId()
    RequestCollisionAtCoord(x, y, z)
    SetEntityCoordsNoOffset(ped, x, y, z + 0.25, false, false, false)
end)

RegisterNetEvent('fluxcore_admin:client:setFrozen', function(value)
    frozen = value == true
    FreezeEntityPosition(PlayerPedId(), frozen)
end)

RegisterNetEvent('fluxcore_admin:client:heal', function()
    local ped = PlayerPedId()
    SetEntityHealth(ped, GetEntityMaxHealth(ped))
    ClearPedBloodDamage(ped)
    ResetPedVisibleDamage(ped)
end)

RegisterCommand('vadmin', function()
    if panelOpen then
        closePanel()
        return
    end
    local response = call('bootstrap', {})
    if not response.ok then
        message(
            response.error and response.error.message
                or locale('admin.errors.accessDenied', nil, 'Access denied.'),
            'error'
        )
        return
    end
    panelOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        type = 'open',
        payload = response.data,
        localeName = exports.fluxcore_core:GetLocale(),
        locale = uiLocale()
    })
end, false)

RegisterNUICallback('adminRequest', function(data, callback)
    if not panelOpen then
        callback({
            ok = false,
            error = { code = 'PANEL_CLOSED', message = 'Admin panel is closed.' }
        })
        return
    end
    if type(data) ~= 'table' or type(data.method) ~= 'string'
        or #data.method < 1 or #data.method > 64 then
        callback({
            ok = false,
            error = { code = 'VALIDATION_ERROR', message = 'Invalid admin action.' }
        })
        return
    end
    local response = call(data.method, data.payload or {})
    callback(response)
end)

RegisterNUICallback('close', function(_, callback)
    closePanel()
    callback({ ok = true })
end)

CreateThread(function()
    while true do
        if frozen then
            FreezeEntityPosition(PlayerPedId(), true)
            Wait(500)
        else
            Wait(1500)
        end
    end
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource == 'fluxcore_core' and panelOpen then
        closePanel()
        return
    end
    if stoppedResource ~= RESOURCE_NAME then
        return
    end
    SetNuiFocus(false, false)
    FreezeEntityPosition(PlayerPedId(), false)
    for requestId, resolver in pairs(pending) do
        resolver({
            ok = false,
            error = {
                code = 'RESOURCE_STOPPED',
                message = locale(
                    'errors.RESOURCE_STOPPED',
                    nil,
                    'Fluxcore Admin stopped.'
                )
            }
        })
        pending[requestId] = nil
    end
end)
