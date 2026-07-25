local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local snapshot = nil

local function copy(value)
    return value ~= nil and json.decode(json.encode(value)) or nil
end

local function call(method, payload)
    requestSequence = requestSequence + 1
    local requestId = ('%s:%s:%s'):format(
        GetPlayerServerId(PlayerId()),
        GetGameTimer(),
        requestSequence
    )
    local deferred = promise.new()
    local settled = false
    pending[requestId] = function(response)
        if settled then return end
        settled = true
        pending[requestId] = nil
        deferred:resolve(response)
    end
    TriggerServerEvent(
        'nord_dispatch:server:request',
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
                    message = 'The dispatch request timed out.'
                }
            })
        end
    end)
    return Citizen.Await(deferred)
end

local function message(text, error)
    TriggerEvent('chat:addMessage', {
        color = error and { 220, 70, 70 } or { 70, 170, 220 },
        args = { 'Nord Dispatch', text }
    })
end

RegisterNetEvent('nord_dispatch:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then resolver(response) end
end)

RegisterNetEvent('nord_dispatch:client:update', function(value)
    snapshot = copy(value)
    TriggerEvent('nord_dispatch:client:updated', copy(snapshot))
end)

RegisterNetEvent('Nord:client:playerLoggedOut', function()
    snapshot = nil
end)

RegisterCommand('dispatch', function()
    local response = call('bootstrap', {})
    if response.ok then
        snapshot = copy(response.data)
        TriggerEvent('nord_dispatch:client:open', copy(snapshot))
    else
        message(response.error and response.error.message
            or 'Dispatch unavailable.', true)
    end
end, false)

RegisterCommand('911', function(_, args)
    local service = tostring(args[1] or ''):lower()
    table.remove(args, 1)
    local description = table.concat(args, ' ')
    local response = call('call:create', {
        service = service,
        description = description
    })
    if response.ok then
        message(('Call %s was sent.'):format(response.data.id), false)
    else
        message(response.error and response.error.message
            or 'The call could not be sent.', true)
    end
end, false)

exports('GetDispatch', function()
    return copy(snapshot)
end)

exports('Request', function(method, payload)
    return call(method, payload)
end)
