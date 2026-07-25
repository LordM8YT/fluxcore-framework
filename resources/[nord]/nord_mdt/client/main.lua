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
    TriggerServerEvent('nord_mdt:server:request', requestId, method, payload or {})
    SetTimeout(REQUEST_TIMEOUT_MS, function()
        local resolver = pending[requestId]
        if resolver then
            resolver({
                ok = false,
                error = { code = 'TIMEOUT', message = 'The MDT request timed out.' }
            })
        end
    end)
    return Citizen.Await(deferred)
end

RegisterNetEvent('nord_mdt:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then resolver(response) end
end)

RegisterNetEvent('Nord:client:playerLoggedOut', function()
    snapshot = nil
end)

RegisterCommand('mdt', function()
    local response = call('bootstrap', {})
    if response.ok then
        snapshot = copy(response.data)
        TriggerEvent('nord_mdt:client:open', copy(snapshot))
    else
        TriggerEvent('chat:addMessage', {
            color = { 220, 70, 70 },
            args = {
                'Nord MDT',
                response.error and response.error.message or 'MDT unavailable.'
            }
        })
    end
end, false)

exports('GetDashboard', function()
    return copy(snapshot)
end)

exports('Request', function(method, payload)
    return call(method, payload)
end)
