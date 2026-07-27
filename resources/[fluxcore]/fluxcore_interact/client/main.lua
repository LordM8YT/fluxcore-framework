local RESOURCE_NAME = GetCurrentResourceName()

local rawConfig = LoadResourceFile(RESOURCE_NAME, 'config/interact.json')
local config = rawConfig and json.decode(rawConfig) or {}
local markerConfig = type(config.marker) == 'table' and config.marker or {}

local activationKey = tostring(config.activationKey or 'LMENU')
local cancelControl = tonumber(config.cancelControl) or 200
local scanIntervalMs = math.max(50, tonumber(config.scanIntervalMs) or 150)
local raycastDistance = math.max(1.0, tonumber(config.raycastDistance) or 20.0)
local aimAssistRadius = math.max(0.02, tonumber(config.aimAssistRadius) or 0.12)
local defaultDistance = math.max(0.5, tonumber(config.defaultDistance) or 2.0)
local zoneDrawDistance = math.max(1.0, tonumber(config.zoneDrawDistance) or 12.0)

local registrations = {}
local registrationOrder = {}
local activeCandidate = nil
local targetModeActive = false
local targetFocusActive = false
local promptVisible = false
local promptKey = nil
local focusOwner = nil
local menuState = nil
local dialogState = nil
local progressState = nil
local notificationSequence = 0

local function setTargetFocus(active)
    active = active == true
        and targetModeActive
        and activeCandidate ~= nil
        and focusOwner == nil
        and progressState == nil
    if active == targetFocusActive then
        return
    end
    targetFocusActive = active
    SetNuiFocus(active, active)
    SetNuiFocusKeepInput(active)
    SendNUIMessage({
        action = 'target:focus',
        data = { active = active }
    })
end

local function setTargetMode(active)
    active = active == true and focusOwner == nil and progressState == nil
    if active == targetModeActive then
        return
    end
    targetModeActive = active
    if not active then
        setTargetFocus(false)
        activeCandidate = nil
        promptKey = nil
    end
    SendNUIMessage({
        action = 'target:active',
        data = { active = active }
    })
end

local function locale(key, replacements, fallback)
    return exports.fluxcore_core:Locale(key, replacements, fallback)
end

local function nativeTrue(value)
    return value == true or value == 1
end

-- Function references crossing a FiveM resource export can arrive as callable
-- tables instead of plain Lua functions.
local function isCallable(value)
    if type(value) == 'function' then
        return true
    end
    if type(value) ~= 'table' then
        return false
    end
    local metatable = getmetatable(value)
    return type(metatable) == 'table'
        and type(rawget(metatable, '__call')) == 'function'
end

local function shallowCopy(value)
    local output = {}
    if type(value) == 'table' then
        for key, item in pairs(value) do
            output[key] = item
        end
    end
    return output
end

local function invokingResource()
    local owner = GetInvokingResource()
    if type(owner) ~= 'string' or owner == '' then
        return RESOURCE_NAME
    end
    return owner
end

local function normalizeId(value, field)
    local id = tostring(value or '')
    assert(id:match('^[%w_:%-%.]+$') ~= nil, (field or 'id') .. ' is invalid')
    assert(#id <= 96, (field or 'id') .. ' is too long')
    return id
end

local function normalizeCoords(value)
    assert(value ~= nil, 'coords are required')
    local x = tonumber(value.x or value[1])
    local y = tonumber(value.y or value[2])
    local z = tonumber(value.z or value[3])
    assert(x and y and z, 'coords must contain finite x, y, and z values')
    return vector3(x, y, z)
end

local function normalizeOptions(value)
    assert(type(value) == 'table', 'options must be a table')
    local output = {}
    for index, option in ipairs(value) do
        assert(type(option) == 'table', ('option %s must be a table'):format(index))
        local normalized = shallowCopy(option)
        normalized.id = normalizeId(option.id or index, ('option %s id'):format(index))
        normalized.label = tostring(option.label or '')
        assert(normalized.label ~= '', ('option %s label is required'):format(index))
        assert(#normalized.label <= 96, ('option %s label is too long'):format(index))
        normalized.description = option.description and tostring(option.description) or nil
        normalized.icon = option.icon and tostring(option.icon) or nil
        normalized.distance = math.max(
            0.5,
            tonumber(option.distance) or defaultDistance
        )
        normalized.type = tostring(option.type or 'client'):lower()
        assert(
            normalized.type == 'client'
                or normalized.type == 'server'
                or normalized.type == 'command',
            ('option %s type is invalid'):format(index)
        )
        if option.event ~= nil then
            normalized.event = tostring(option.event)
            assert(normalized.event ~= '', ('option %s event is invalid'):format(index))
        end
        if option.onSelect ~= nil then
            assert(isCallable(option.onSelect), 'onSelect must be callable')
        end
        if option.canInteract ~= nil then
            assert(isCallable(option.canInteract), 'canInteract must be callable')
        end
        assert(
            normalized.event ~= nil or isCallable(normalized.onSelect),
            ('option %s requires event or onSelect'):format(index)
        )
        output[#output + 1] = normalized
    end
    assert(#output > 0, 'at least one option is required')
    return output
end

local function putRegistration(definition, kind)
    assert(type(definition) == 'table', 'definition must be a table')
    local id = normalizeId(definition.id, 'interaction id')
    assert(registrations[id] == nil, ('interaction %s already exists'):format(id))

    local registration = shallowCopy(definition)
    registration.id = id
    registration.kind = kind
    registration.owner = invokingResource()
    registration.options = normalizeOptions(definition.options)
    registration.distance = math.max(
        0.5,
        tonumber(definition.distance) or defaultDistance
    )
    registration.order = #registrationOrder + 1

    if kind == 'zone' then
        registration.coords = normalizeCoords(definition.coords)
        registration.radius = math.max(0.1, tonumber(definition.radius) or 1.0)
        registration.marker = definition.marker ~= false
    elseif kind == 'model' then
        assert(type(definition.models) == 'table', 'models must be a table')
        registration.models = {}
        for _, model in ipairs(definition.models) do
            local hash = type(model) == 'number' and model or GetHashKey(tostring(model))
            registration.models[hash] = true
        end
        assert(next(registration.models) ~= nil, 'at least one model is required')
    elseif kind == 'entity' then
        assert(type(definition.entities) == 'table', 'entities must be a table')
        registration.entities = {}
        for _, entity in ipairs(definition.entities) do
            entity = tonumber(entity)
            if entity and entity ~= 0 then
                registration.entities[entity] = true
            end
        end
        assert(next(registration.entities) ~= nil, 'at least one entity is required')
    end

    registrations[id] = registration
    registrationOrder[#registrationOrder + 1] = id
    return id
end

local function removeInteraction(id)
    id = tostring(id or '')
    if registrations[id] == nil then
        return false
    end
    registrations[id] = nil
    for index, candidateId in ipairs(registrationOrder) do
        if candidateId == id then
            table.remove(registrationOrder, index)
            break
        end
    end
    if activeCandidate and activeCandidate.registrationId == id then
        activeCandidate = nil
    end
    return true
end

local function requestFocus(owner)
    if focusOwner ~= nil then
        return false
    end
    setTargetMode(false)
    focusOwner = owner
    SetNuiFocus(true, true)
    return true
end

local function releaseFocus(owner)
    if focusOwner ~= owner then
        return
    end
    focusOwner = nil
    SetNuiFocus(false, false)
end

local function safeOptions(options)
    local output = {}
    for _, option in ipairs(options or {}) do
        output[#output + 1] = {
            id = option.id,
            label = option.label,
            description = option.description,
            icon = option.icon,
            disabled = option.disabled == true
        }
    end
    return output
end

local function openMenu(definition)
    assert(type(definition) == 'table', 'menu definition must be a table')
    assert(type(definition.options) == 'table', 'menu options must be a table')
    if not requestFocus('menu') then
        return nil
    end

    local optionsById = {}
    local options = {}
    for index, option in ipairs(definition.options) do
        assert(type(option) == 'table', ('menu option %s must be a table'):format(index))
        local copy = shallowCopy(option)
        copy.id = normalizeId(option.id or index, ('menu option %s id'):format(index))
        copy.label = tostring(option.label or '')
        assert(copy.label ~= '', ('menu option %s label is required'):format(index))
        optionsById[copy.id] = copy
        options[#options + 1] = copy
    end

    local deferred = promise.new()
    menuState = {
        deferred = deferred,
        optionsById = optionsById
    }
    SendNUIMessage({
        action = 'menu:open',
        data = {
            title = tostring(definition.title or locale(
                'interact.menuTitle',
                nil,
                'Menu'
            )),
            description = definition.description and tostring(definition.description) or nil,
            options = safeOptions(options)
        }
    })
    return Citizen.Await(deferred)
end

local function resolveMenu(value)
    if not menuState then
        return
    end
    local state = menuState
    menuState = nil
    SendNUIMessage({ action = 'menu:close' })
    releaseFocus('menu')
    state.deferred:resolve(value)
end

local function inputDialog(definition)
    assert(type(definition) == 'table', 'dialog definition must be a table')
    if not requestFocus('dialog') then
        return nil
    end

    local deferred = promise.new()
    dialogState = {
        deferred = deferred,
        required = definition.required == true,
        maxLength = math.max(1, math.min(1024, tonumber(definition.maxLength) or 255))
    }
    SendNUIMessage({
        action = 'dialog:open',
        data = {
            title = tostring(definition.title or locale(
                'interact.inputTitle',
                nil,
                'Input'
            )),
            description = definition.description and tostring(definition.description) or nil,
            label = tostring(definition.label or locale(
                'interact.inputLabel',
                nil,
                'Value'
            )),
            placeholder = definition.placeholder and tostring(definition.placeholder) or '',
            value = definition.value and tostring(definition.value) or '',
            required = dialogState.required,
            maxLength = dialogState.maxLength
        }
    })
    return Citizen.Await(deferred)
end

local function resolveDialog(value)
    if not dialogState then
        return
    end
    local state = dialogState
    dialogState = nil
    SendNUIMessage({ action = 'dialog:close' })
    releaseFocus('dialog')
    state.deferred:resolve(value)
end

local function notify(definition)
    if type(definition) == 'string' then
        definition = { description = definition }
    end
    assert(type(definition) == 'table', 'notification must be a table or string')
    notificationSequence = notificationSequence + 1
    SendNUIMessage({
        action = 'notification:show',
        data = {
            id = ('notification:%s:%s'):format(GetGameTimer(), notificationSequence),
            title = definition.title and tostring(definition.title) or nil,
            description = tostring(definition.description or ''),
            type = tostring(definition.type or 'inform'),
            duration = math.max(1000, math.min(30000, tonumber(definition.duration) or 4000))
        }
    })
end

local function resolveProgress(completed)
    if not progressState then
        return
    end
    local state = progressState
    progressState = nil
    SendNUIMessage({ action = 'progress:close' })
    state.deferred:resolve(completed == true)
end

local function progress(definition)
    assert(type(definition) == 'table', 'progress definition must be a table')
    if progressState then
        return false
    end

    local duration = math.max(100, math.min(300000, tonumber(definition.duration) or 1000))
    local deferred = promise.new()
    progressState = {
        deferred = deferred,
        endsAt = GetGameTimer() + duration,
        canCancel = definition.canCancel ~= false,
        disable = type(definition.disable) == 'table' and definition.disable or {}
    }
    SendNUIMessage({
        action = 'progress:open',
        data = {
            label = tostring(definition.label or locale(
                'interact.progressLabel',
                nil,
                'Working'
            )),
            duration = duration,
            canCancel = progressState.canCancel
        }
    })

    CreateThread(function()
        while progressState and progressState.deferred == deferred do
            local disabled = progressState.disable
            if disabled.move then
                DisableControlAction(0, 30, true)
                DisableControlAction(0, 31, true)
                DisableControlAction(0, 21, true)
            end
            if disabled.combat then
                DisablePlayerFiring(PlayerId(), true)
                DisableControlAction(0, 24, true)
                DisableControlAction(0, 25, true)
                DisableControlAction(0, 37, true)
            end
            if disabled.vehicle then
                DisableControlAction(0, 63, true)
                DisableControlAction(0, 64, true)
                DisableControlAction(0, 71, true)
                DisableControlAction(0, 72, true)
                DisableControlAction(0, 75, true)
            end
            if progressState.canCancel and IsControlJustReleased(0, cancelControl) then
                resolveProgress(false)
                break
            end
            if progressState and GetGameTimer() >= progressState.endsAt then
                resolveProgress(true)
                break
            end
            Wait(0)
        end
    end)

    return Citizen.Await(deferred)
end

local function rotationToDirection(rotation)
    local adjustedX = math.rad(rotation.x)
    local adjustedZ = math.rad(rotation.z)
    local cosineX = math.abs(math.cos(adjustedX))
    return vector3(
        -math.sin(adjustedZ) * cosineX,
        math.cos(adjustedZ) * cosineX,
        math.sin(adjustedX)
    )
end

-- Camera/shape-test strategy adapted from the proven ox_target approach:
-- https://github.com/overextended/ox_target
-- https://github.com/overextended/ox_lib/blob/main/imports/raycast/client.lua
-- This implementation remains dependency-free and is written for Fluxcore.
local function raycastEntity(traceFlags)
    local origin = GetFinalRenderedCamCoord()
    local direction = rotationToDirection(GetFinalRenderedCamRot(2))
    local destination = origin + direction * raycastDistance
    local handle = StartShapeTestLosProbe(
        origin.x,
        origin.y,
        origin.z,
        destination.x,
        destination.y,
        destination.z,
        traceFlags or 511,
        PlayerPedId(),
        4
    )
    local status, hit, endCoords, _, entity = GetShapeTestResult(handle)
    local attempts = 0
    while status == 1 and attempts < 60 do
        attempts = attempts + 1
        Wait(0)
        status, hit, endCoords, _, entity = GetShapeTestResult(handle)
    end
    if status == 1 or not nativeTrue(hit) then
        return nil, endCoords
    end
    if entity == 0 or not nativeTrue(DoesEntityExist(entity)) then
        return nil, endCoords
    end
    return entity, endCoords
end

local allowedOptions

local function findAimedModel(playerCoords)
    local best = nil
    for _, id in ipairs(registrationOrder) do
        local registration = registrations[id]
        if registration and registration.kind == 'model' then
            for model in pairs(registration.models) do
                local entity = GetClosestObjectOfType(
                    playerCoords.x,
                    playerCoords.y,
                    playerCoords.z,
                    registration.distance + 1.0,
                    model,
                    false,
                    false,
                    false
                )
                if entity ~= 0 and nativeTrue(DoesEntityExist(entity)) then
                    local coords = GetEntityCoords(entity)
                    local distance = #(playerCoords - coords)
                    local visible, screenX, screenY = GetScreenCoordFromWorldCoord(
                        coords.x,
                        coords.y,
                        coords.z
                    )
                    if nativeTrue(visible) then
                        local offsetX = tonumber(screenX) - 0.5
                        local offsetY = tonumber(screenY) - 0.5
                        local screenDistance = math.sqrt(
                            offsetX * offsetX + offsetY * offsetY
                        )
                        local options = allowedOptions(
                            registration,
                            entity,
                            distance,
                            coords
                        )
                        if #options > 0
                            and screenDistance <= aimAssistRadius
                            and (
                                not best
                                or screenDistance < best.screenDistance
                            ) then
                            best = {
                                registrationId = id,
                                entity = entity,
                                coords = coords,
                                distance = distance,
                                sortDistance = distance,
                                screenDistance = screenDistance,
                                options = options
                            }
                        end
                    end
                end
            end
        end
    end
    return best
end

local function isPlayerPed(entity)
    return GetEntityType(entity) == 1 and nativeTrue(IsPedAPlayer(entity))
end

local function registrationMatchesEntity(registration, entity)
    local kind = registration.kind
    if kind == 'entity' then
        return registration.entities[entity] == true
    end
    if kind == 'model' then
        return registration.models[GetEntityModel(entity)] == true
    end
    if kind == 'globalPlayer' then
        return isPlayerPed(entity)
    end
    if kind == 'globalPed' then
        return GetEntityType(entity) == 1 and not isPlayerPed(entity)
    end
    if kind == 'globalVehicle' then
        return GetEntityType(entity) == 2
    end
    if kind == 'globalObject' then
        return GetEntityType(entity) == 3
    end
    return false
end

allowedOptions = function(registration, entity, distance, coords)
    local output = {}
    for _, option in ipairs(registration.options) do
        local allowed = distance <= math.min(registration.distance, option.distance)
        if allowed and isCallable(option.canInteract) then
            local ok, result = pcall(option.canInteract, entity, distance, coords)
            allowed = ok and result == true
        end
        if allowed then
            output[#output + 1] = option
        end
    end
    return output
end

local function findCandidate()
    local ped = PlayerPedId()
    if ped == 0 or not nativeTrue(DoesEntityExist(ped)) then
        return nil
    end

    local playerCoords = GetEntityCoords(ped)
    local best = nil

    for _, id in ipairs(registrationOrder) do
        local registration = registrations[id]
        if registration and registration.kind == 'zone' then
            local distance = #(playerCoords - registration.coords)
            if distance <= registration.radius + registration.distance then
                local options = allowedOptions(
                    registration,
                    0,
                    math.max(0.0, distance - registration.radius),
                    registration.coords
                )
                if #options > 0 and (not best or distance < best.sortDistance) then
                    best = {
                        registrationId = id,
                        entity = 0,
                        coords = registration.coords,
                        distance = distance,
                        sortDistance = distance,
                        options = options
                    }
                end
            end
        end
    end

    local entity, hitCoords = raycastEntity(511)
    if not entity or GetEntityType(entity) == 0 then
        local alternateEntity, alternateCoords = raycastEntity(26)
        if alternateEntity then
            entity = alternateEntity
            hitCoords = alternateCoords
        end
    end
    if entity then
        local entityCoords = GetEntityCoords(entity)
        local interactionCoords = hitCoords or entityCoords
        local distance = #(playerCoords - interactionCoords)
        for _, id in ipairs(registrationOrder) do
            local registration = registrations[id]
            if registration
                and registration.kind ~= 'zone'
                and registrationMatchesEntity(registration, entity) then
                local options = allowedOptions(
                    registration,
                    entity,
                    distance,
                    interactionCoords
                )
                if #options > 0 and (not best or distance < best.sortDistance) then
                    best = {
                        registrationId = id,
                        entity = entity,
                        coords = interactionCoords,
                        distance = distance,
                        sortDistance = distance,
                        options = options
                    }
                end
            end
        end
    end

    if not best then
        best = findAimedModel(playerCoords)
    end

    return best
end

local function contextFor(candidate, option)
    local networkId = nil
    if candidate.entity ~= 0 and nativeTrue(NetworkGetEntityIsNetworked(candidate.entity)) then
        networkId = NetworkGetNetworkIdFromEntity(candidate.entity)
    end
    return {
        interactionId = candidate.registrationId,
        optionId = option.id,
        entity = candidate.entity,
        networkId = networkId,
        distance = candidate.distance,
        coords = {
            x = candidate.coords.x,
            y = candidate.coords.y,
            z = candidate.coords.z
        },
        args = option.args
    }
end

local function executeOption(candidate, option)
    local context = contextFor(candidate, option)
    if isCallable(option.onSelect) then
        local ok, message = pcall(option.onSelect, context)
        if not ok then
            print(('[fluxcore_interact] interaction %s option %s failed: %s')
                :format(candidate.registrationId, option.id, message))
        end
        return
    end
    if option.type == 'server' then
        TriggerServerEvent(option.event, context)
    elseif option.type == 'command' then
        ExecuteCommand(option.event)
    else
        TriggerEvent(option.event, context)
    end
end

local function targetOptionPayload(candidate)
    local options = {}
    for _, option in ipairs(candidate.options) do
        options[#options + 1] = {
            id = option.id,
            label = option.label,
            description = option.description,
            icon = option.icon
        }
    end
    return options
end

local function candidatePromptKey(candidate)
    local key = candidate.registrationId
    for _, option in ipairs(candidate.options) do
        key = key .. ':' .. option.id
    end
    return key
end

CreateThread(function()
    while true do
        if targetModeActive
            and not targetFocusActive
            and focusOwner == nil
            and progressState == nil then
            activeCandidate = findCandidate()
        elseif not targetFocusActive then
            activeCandidate = nil
        end
        Wait(scanIntervalMs)
    end
end)

CreateThread(function()
    while true do
        local sleep = 250
        local candidate = activeCandidate
        if targetModeActive and candidate and focusOwner == nil then
            sleep = 0
            DisablePlayerFiring(PlayerId(), true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            if targetFocusActive then
                DisableControlAction(0, 1, true)
                DisableControlAction(0, 2, true)
            end

            local nextPromptKey = candidatePromptKey(candidate)
            if not promptVisible or promptKey ~= nextPromptKey then
                promptVisible = true
                promptKey = nextPromptKey
                SendNUIMessage({
                    action = 'interaction:show',
                    data = {
                        options = targetOptionPayload(candidate)
                    }
                })
            end

            if not targetFocusActive
                and IsDisabledControlJustPressed(0, 24) then
                setTargetFocus(true)
            end
        elseif promptVisible then
            promptVisible = false
            promptKey = nil
            setTargetFocus(false)
            SendNUIMessage({ action = 'interaction:hide' })
        end
        Wait(sleep)
    end
end)

RegisterCommand('+fluxcore_target', function()
    setTargetMode(true)
end, false)

RegisterCommand('-fluxcore_target', function()
    setTargetMode(false)
end, false)

RegisterKeyMapping(
    '+fluxcore_target',
    'Fluxcore target eye',
    'keyboard',
    activationKey
)

CreateThread(function()
    while true do
        local sleep = 500
        local coords = GetEntityCoords(PlayerPedId())
        for _, id in ipairs(registrationOrder) do
            local registration = registrations[id]
            if registration
                and registration.kind == 'zone'
                and registration.marker
                and markerConfig.enabled ~= false
                and #(coords - registration.coords) <= zoneDrawDistance then
                sleep = 0
                local color = type(markerConfig.color) == 'table' and markerConfig.color or {}
                local scale = tonumber(markerConfig.scale) or 0.18
                DrawMarker(
                    tonumber(markerConfig.type) or 2,
                    registration.coords.x,
                    registration.coords.y,
                    registration.coords.z + 0.12,
                    0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0,
                    scale, scale, scale,
                    tonumber(color.r) or 84,
                    tonumber(color.g) or 160,
                    tonumber(color.b) or 255,
                    tonumber(color.a) or 180,
                    false, true, 2, false, nil, nil, false
                )
            end
        end
        Wait(sleep)
    end
end)

CreateThread(function()
    Wait(0)
    SendNUIMessage({
        action = 'config',
        data = {
            close = locale('interact.close', nil, 'Close'),
            cancel = locale('interact.cancel', nil, 'Cancel'),
            confirm = locale('interact.confirm', nil, 'Confirm'),
            options = locale('interact.options', nil, 'options'),
            escapeToCancel = locale(
                'interact.escapeToCancel',
                nil,
                'ESC to cancel'
            ),
            required = locale(
                'interact.valueRequired',
                nil,
                'A value is required'
            )
        }
    })
end)

RegisterNUICallback('selectMenu', function(data, callback)
    local option = menuState and menuState.optionsById[tostring(data and data.id or '')]
    if option and option.disabled ~= true then
        resolveMenu(option)
    end
    callback({ ok = option ~= nil })
end)

RegisterNUICallback('selectTarget', function(data, callback)
    local candidate = activeCandidate
    local selected = nil
    local selectedId = tostring(data and data.id or '')
    if candidate then
        for _, option in ipairs(candidate.options) do
            if option.id == selectedId and option.disabled ~= true then
                selected = option
                break
            end
        end
    end

    callback({ ok = selected ~= nil })
    if not selected then
        return
    end

    setTargetFocus(false)
    setTargetMode(false)
    CreateThread(function()
        executeOption(candidate, selected)
    end)
end)

RegisterNUICallback('releaseTargetFocus', function(_, callback)
    setTargetFocus(false)
    callback({ ok = true })
end)

RegisterNUICallback('closeMenu', function(_, callback)
    resolveMenu(nil)
    callback({ ok = true })
end)

RegisterNUICallback('submitDialog', function(data, callback)
    if not dialogState then
        callback({ ok = false })
        return
    end
    local value = tostring(data and data.value or '')
    if #value > dialogState.maxLength then
        value = value:sub(1, dialogState.maxLength)
    end
    if dialogState.required and value:match('^%s*$') then
        callback({
            ok = false,
            error = locale(
                'interact.valueRequired',
                nil,
                'A value is required'
            )
        })
        return
    end
    resolveDialog(value)
    callback({ ok = true })
end)

RegisterNUICallback('closeDialog', function(_, callback)
    resolveDialog(nil)
    callback({ ok = true })
end)

RegisterNUICallback('cancelProgress', function(_, callback)
    local cancelled = progressState and progressState.canCancel
    if cancelled then
        resolveProgress(false)
    end
    callback({ ok = cancelled == true })
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == RESOURCE_NAME then
        SetNuiFocus(false, false)
        return
    end
    local remove = {}
    for id, registration in pairs(registrations) do
        if registration.owner == resource then
            remove[#remove + 1] = id
        end
    end
    for _, id in ipairs(remove) do
        removeInteraction(id)
    end
end)

exports('RegisterZone', function(definition)
    return putRegistration(definition, 'zone')
end)

exports('AddModel', function(definition)
    return putRegistration(definition, 'model')
end)

exports('AddEntity', function(definition)
    return putRegistration(definition, 'entity')
end)

exports('AddGlobalPlayer', function(definition)
    return putRegistration(definition, 'globalPlayer')
end)

exports('AddGlobalPed', function(definition)
    return putRegistration(definition, 'globalPed')
end)

exports('AddGlobalVehicle', function(definition)
    return putRegistration(definition, 'globalVehicle')
end)

exports('AddGlobalObject', function(definition)
    return putRegistration(definition, 'globalObject')
end)

exports('RemoveInteraction', removeInteraction)
exports('OpenMenu', openMenu)
exports('InputDialog', inputDialog)
exports('Notify', notify)
exports('Progress', progress)
exports('IsUiOpen', function()
    return focusOwner ~= nil
end)
