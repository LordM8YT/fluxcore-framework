local RESOURCE_NAME = GetCurrentResourceName()
local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local phoneOpen = false
local registeredApps = {}
local activeApp = nil

local function trim(value)
    return tostring(value or ''):match('^%s*(.-)%s*$')
end

local function appSnapshot()
    local apps = {}
    for _, registration in pairs(registeredApps) do
        apps[#apps + 1] = {
            identifier = registration.identifier,
            name = registration.name,
            description = registration.description,
            developer = registration.developer,
            icon = registration.icon,
            color = registration.color,
            ui = registration.ui,
            resource = registration.resource
        }
    end
    table.sort(apps, function(left, right)
        return left.name:lower() < right.name:lower()
    end)
    return apps
end

local function publishApps()
    if phoneOpen then
        SendNUIMessage({ type = 'apps', payload = appSnapshot() })
    end
end

local function closeActiveApp()
    if not activeApp then
        return
    end
    local registration = registeredApps[activeApp]
    activeApp = nil
    if registration and type(registration.onClose) == 'function' then
        local ok, errorMessage = pcall(registration.onClose)
        if not ok then
            print(('[fluxcore_phone] app %s onClose failed: %s'):format(
                registration.identifier,
                tostring(errorMessage)
            ))
        end
    end
end

local function registerApp(definition)
    local owner = GetInvokingResource()
    if not owner or owner == '' then
        return false, 'RegisterApp must be called from another resource'
    end
    if type(definition) ~= 'table' then
        return false, 'app definition must be a table'
    end

    local identifier = trim(definition.identifier):lower()
    local name = trim(definition.name)
    local ui = trim(definition.ui)
    if not identifier:match('^[a-z0-9][a-z0-9_-]+$')
        or #identifier > 48 then
        return false, 'identifier must use 2-48 lowercase letters, numbers, _ or -'
    end
    if #name < 1 or #name > 32 then
        return false, 'name must contain 1-32 characters'
    end
    if #ui < 1 or #ui > 160 or ui:find('..', 1, true)
        or ui:match('^%a+://') or ui:sub(1, 1) == '/'
        or not ui:lower():match('%.html?$') then
        return false, 'ui must be a relative HTML path owned by the app resource'
    end
    local existing = registeredApps[identifier]
    if existing and existing.resource ~= owner then
        return false, 'identifier is already owned by another resource'
    end

    registeredApps[identifier] = {
        identifier = identifier,
        name = name,
        description = trim(definition.description):sub(1, 120),
        developer = trim(definition.developer):sub(1, 32),
        icon = trim(definition.icon):sub(1, 256),
        color = trim(definition.color):sub(1, 24),
        ui = ui,
        resource = owner,
        onOpen = type(definition.onOpen) == 'function' and definition.onOpen or nil,
        onClose = type(definition.onClose) == 'function' and definition.onClose or nil
    }
    publishApps()
    return true
end

local function unregisterApp(identifier)
    local owner = GetInvokingResource()
    local key = trim(identifier):lower()
    local registration = registeredApps[key]
    if not registration or registration.resource ~= owner then
        return false
    end
    if activeApp == key then
        closeActiveApp()
        SendNUIMessage({ type = 'appRemoved', payload = { identifier = key } })
    end
    registeredApps[key] = nil
    publishApps()
    return true
end

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

local function message(text, kind)
    local color = kind == 'error' and { 220, 70, 70 } or { 90, 180, 255 }
    TriggerEvent('chat:addMessage', {
        color = color,
        args = { 'Fluxcore Phone', tostring(text) }
    })
    print(('[fluxcore_phone] %s'):format(tostring(text)))
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
        'fluxcore_phone:server:request',
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
                        'phone.errors.timeout',
                        nil,
                        'The phone request timed out.'
                    )
                }
            })
        end
    end)

    return Citizen.Await(deferred)
end

local function closePhone()
    closeActiveApp()
    phoneOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ type = 'close' })
end

local function openPhone()
    if phoneOpen then
        closePhone()
        return
    end
    local response = call('bootstrap', {})
    if not response.ok then
        message(
            response.error and response.error.message
                or locale('phone.errors.unavailable', nil, 'Phone unavailable.'),
            'error'
        )
        return
    end
    phoneOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        type = 'open',
        payload = response.data,
        apps = appSnapshot(),
        localeName = exports.fluxcore_core:GetLocale(),
        locale = exports.fluxcore_core:GetLocaleData('phone')
    })
end

RegisterNetEvent('fluxcore_phone:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then
        resolver(response)
    end
end)

RegisterNetEvent('fluxcore_phone:client:newMessage', function(incoming)
    if phoneOpen then
        SendNUIMessage({
            type = 'newMessage',
            payload = incoming
        })
    else
        message(locale(
            'phone.newMessage',
            {
                name = incoming.peerName
                    or incoming.peerNumber
                    or locale('common.unknown', nil, 'Unknown')
            },
            ('New message from %s'):format(
                incoming.peerName or incoming.peerNumber or 'Unknown'
            )
        ))
    end
end)

RegisterNetEvent('fluxcore_phone:client:messagesRead', function(phoneNumber, readAt)
    if phoneOpen then
        SendNUIMessage({
            type = 'messagesRead',
            payload = {
                phoneNumber = phoneNumber,
                readAt = readAt
            }
        })
    end
end)

RegisterNetEvent('fluxcore_phone:client:contactsUpdated', function()
    if phoneOpen then
        local response = call('bootstrap', {})
        if response.ok then
            SendNUIMessage({
                type = 'bootstrap',
                payload = response.data,
                apps = appSnapshot(),
                localeName = exports.fluxcore_core:GetLocale(),
                locale = exports.fluxcore_core:GetLocaleData('phone')
            })
        end
    end
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    if phoneOpen then
        closePhone()
    end
end)

RegisterCommand('phone', openPhone, false)
RegisterKeyMapping(
    'phone',
    locale('phone.openKey', nil, 'Open Fluxcore Phone'),
    'keyboard',
    'F1'
)

RegisterNUICallback('phoneRequest', function(data, callback)
    local response = call(data.method, data.payload or {})
    callback(response)
end)

RegisterNUICallback('close', function(_, callback)
    closePhone()
    callback({ ok = true })
end)

RegisterNUICallback('openApp', function(data, callback)
    local identifier = trim(type(data) == 'table' and data.identifier):lower()
    local registration = registeredApps[identifier]
    if not registration then
        callback({ ok = false, error = 'APP_NOT_FOUND' })
        return
    end
    closeActiveApp()
    activeApp = identifier
    if registration.onOpen then
        local ok, errorMessage = pcall(registration.onOpen)
        if not ok then
            activeApp = nil
            callback({ ok = false, error = tostring(errorMessage) })
            return
        end
    end
    callback({ ok = true })
end)

RegisterNUICallback('closeApp', function(_, callback)
    closeActiveApp()
    callback({ ok = true })
end)

exports('RegisterApp', registerApp)
exports('UnregisterApp', unregisterApp)
exports('GetApps', appSnapshot)
exports('IsOpen', function()
    return phoneOpen
end)
exports('SendAppMessage', function(identifier, data)
    local owner = GetInvokingResource()
    local key = trim(identifier):lower()
    local registration = registeredApps[key]
    if not registration or registration.resource ~= owner then
        return false
    end
    SendNUIMessage({
        type = 'appMessage',
        payload = { identifier = key, data = data }
    })
    return true
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource == RESOURCE_NAME then
        TriggerEvent('fluxcore_phone:client:ready')
    end
end)

CreateThread(function()
    Wait(0)
    TriggerEvent('fluxcore_phone:client:ready')
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource ~= RESOURCE_NAME then
        local changed = false
        for identifier, registration in pairs(registeredApps) do
            if registration.resource == stoppedResource then
                if activeApp == identifier then
                    closeActiveApp()
                    SendNUIMessage({
                        type = 'appRemoved',
                        payload = { identifier = identifier }
                    })
                end
                registeredApps[identifier] = nil
                changed = true
            end
        end
        if changed then
            publishApps()
        end
        return
    end
    SetNuiFocus(false, false)
    for requestId, resolver in pairs(pending) do
        resolver({
            ok = false,
            error = {
                code = 'RESOURCE_STOPPED',
                message = locale(
                    'errors.RESOURCE_STOPPED',
                    nil,
                    'Fluxcore Phone stopped.'
                )
            }
        })
        pending[requestId] = nil
    end
end)
