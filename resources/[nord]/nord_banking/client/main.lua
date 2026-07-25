local RESOURCE_NAME = GetCurrentResourceName()
local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local snapshot = nil

local function locale(key, replacements, fallback)
    return exports.varde_core:Locale(key, replacements, fallback)
end

local function copy(value)
    if value == nil then
        return nil
    end
    return json.decode(json.encode(value))
end

local function message(text, kind)
    local color = kind == 'error' and { 220, 70, 70 } or { 90, 180, 255 }
    TriggerEvent('chat:addMessage', {
        color = color,
        args = { 'Varde Bank', tostring(text) }
    })
    print(('[varde_banking] %s'):format(tostring(text)))
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
        deferred:resolve(response)
    end

    TriggerServerEvent(
        'varde_banking:server:request',
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
                        'banking.errors.timeout',
                        nil,
                        'The banking request timed out.'
                    )
                }
            })
        end
    end)

    return Citizen.Await(deferred)
end

RegisterNetEvent('varde_banking:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then
        resolver(response)
    end
end)

RegisterNetEvent('varde_banking:client:update', function(value)
    snapshot = copy(value)
    TriggerEvent('varde_banking:client:updated', copy(snapshot))
end)

RegisterNetEvent('varde:client:playerLoggedOut', function()
    snapshot = nil
    TriggerEvent('varde_banking:client:updated', nil)
end)

RegisterCommand('bank', function()
    local response = call('bootstrap', {})
    if not response.ok then
        message(
            response.error and response.error.message
                or locale(
                    'banking.errors.unavailable',
                    nil,
                    'Banking is unavailable.'
                ),
            'error'
        )
        return
    end
    snapshot = copy(response.data)
    TriggerEvent('varde_banking:client:open', copy(snapshot))
end, false)

exports('GetBanking', function()
    return copy(snapshot)
end)

exports('Request', function(method, payload)
    return call(method, payload)
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource ~= RESOURCE_NAME then
        return
    end
    for requestId, resolver in pairs(pending) do
        resolver({
            ok = false,
            error = {
                code = 'RESOURCE_STOPPED',
                message = 'Varde Banking stopped.'
            }
        })
        pending[requestId] = nil
    end
end)
