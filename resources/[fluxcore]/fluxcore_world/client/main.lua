local REQUEST_TIMEOUT_MS = 10000
local requestSequence = 0
local pending = {}
local snapshot = nil
local registeredDoors = {}

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
    TriggerServerEvent('fluxcore_world:server:request', requestId, method, payload or {})
    SetTimeout(REQUEST_TIMEOUT_MS, function()
        local resolver = pending[requestId]
        if resolver then
            resolver({
                ok = false,
                error = { code = 'TIMEOUT', message = 'The world request timed out.' }
            })
        end
    end)
    return Citizen.Await(deferred)
end

local function applyDoors()
    if not snapshot or not snapshot.doors then return end
    for _, door in ipairs(snapshot.doors) do
        local systemId = joaat(('Fluxcore:%s'):format(door.id))
        if not registeredDoors[door.id] then
            AddDoorToSystem(
                systemId,
                door.modelHash,
                door.position.x,
                door.position.y,
                door.position.z,
                false,
                false,
                false
            )
            registeredDoors[door.id] = systemId
        end
        DoorSystemSetDoorState(systemId, door.locked and 1 or 0, false, false)
    end
end

RegisterNetEvent('fluxcore_world:client:response', function(requestId, response)
    local resolver = pending[tostring(requestId)]
    if resolver then resolver(response) end
end)

RegisterNetEvent('fluxcore_world:client:update', function(value)
    snapshot = copy(value)
    applyDoors()
    TriggerEvent('fluxcore_world:client:updated', copy(snapshot))
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    snapshot = nil
end)

RegisterCommand('world', function()
    local response = call('bootstrap', {})
    if response.ok then
        snapshot = copy(response.data)
        applyDoors()
        TriggerEvent('fluxcore_world:client:open', copy(snapshot))
    else
        TriggerEvent('chat:addMessage', {
            color = { 220, 70, 70 },
            args = {
                'Fluxcore World',
                response.error and response.error.message or 'World unavailable.'
            }
        })
    end
end, false)

exports('GetWorld', function()
    return copy(snapshot)
end)

exports('Request', function(method, payload)
    return call(method, payload)
end)
