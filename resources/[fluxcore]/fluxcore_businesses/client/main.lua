local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local snapshot = nil

local function copy(value)
    if value == nil then
        return nil
    end
    return json.decode(json.encode(value))
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
        'fluxcore_businesses:server:request',
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
                    message = 'The business request timed out.'
                }
            })
        end
    end)
    return Citizen.Await(deferred)
end

RegisterNetEvent('fluxcore_businesses:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then
        resolver(response)
    end
end)

RegisterNetEvent('fluxcore_businesses:client:update', function(value)
    snapshot = copy(value)
    TriggerEvent('fluxcore_businesses:client:updated', copy(snapshot))
end)

RegisterNetEvent('fluxcore_businesses:client:message', function(text, kind)
    TriggerEvent('chat:addMessage', {
        color = kind == 'error' and { 220, 70, 70 } or { 90, 180, 255 },
        args = { 'Fluxcore Business', tostring(text) }
    })
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    snapshot = nil
end)

RegisterCommand('business', function()
    local response = call('bootstrap', {})
    if response.ok then
        snapshot = copy(response.data)
        TriggerEvent('fluxcore_businesses:client:open', copy(snapshot))
    else
        TriggerEvent('fluxcore_businesses:client:message',
            response.error and response.error.message or 'Business unavailable.',
            'error'
        )
    end
end, false)

exports('GetBusinesses', function()
    return copy(snapshot)
end)

exports('Request', function(method, payload)
    return call(method, payload)
end)
