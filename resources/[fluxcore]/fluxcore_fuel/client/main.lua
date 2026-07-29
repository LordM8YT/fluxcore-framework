local resourceName = GetCurrentResourceName()
local rawConfig = LoadResourceFile(resourceName, 'config/fuel.json')
local config = rawConfig and json.decode(rawConfig) or {}
local registrations = {}
local registrationAttempt = 0
local heldFuel = nil

local function nativeTrue(value)
    return value == true or value == 1
end

local function notify(description, kind)
    if GetResourceState('fluxcore_interact') == 'started' then
        exports.fluxcore_interact:Notify({
            title = 'Fuel',
            description = tostring(description),
            type = kind or 'inform',
            duration = 4500
        })
        return
    end
    TriggerEvent('chat:addMessage', {
        color = kind == 'error' and { 255, 90, 90 } or { 180, 230, 255 },
        args = { 'Fuel', tostring(description) }
    })
end

local function stationForEntity(entity)
    local coords = GetEntityCoords(entity)
    local bestId
    local bestDistance
    for id, station in pairs(config.stations or {}) do
        local distance = #(coords - vector3(station.x, station.y, station.z))
        if distance <= (tonumber(station.radius) or 12.0)
            and (not bestDistance or distance < bestDistance) then
            bestId = id
            bestDistance = distance
        end
    end
    return bestId
end

local function usableVehicle(vehicle)
    local ped = PlayerPedId()
    vehicle = tonumber(vehicle) or 0
    if vehicle == 0 or not DoesEntityExist(vehicle)
        or GetEntityType(vehicle) ~= 2 then
        return nil, 'Target the vehicle you want to refuel.'
    end
    if #(GetEntityCoords(ped) - GetEntityCoords(vehicle))
        > (tonumber(config.vehicleDistance) or 4.0) then
        return nil, 'Stand closer to the vehicle.'
    end
    if not nativeTrue(DoesVehicleUseFuel(vehicle)) then
        return nil, 'This vehicle does not use fuel.'
    end
    return vehicle
end

local function loadModel(model)
    local hash = type(model) == 'number' and model or joaat(tostring(model))
    if not IsModelInCdimage(hash) then return nil end
    RequestModel(hash)
    local deadline = GetGameTimer() + 5000
    while not HasModelLoaded(hash) and GetGameTimer() < deadline do
        Wait(0)
    end
    return HasModelLoaded(hash) and hash or nil
end

local function clearHeldFuel(silent)
    if heldFuel and heldFuel.prop and DoesEntityExist(heldFuel.prop) then
        DeleteEntity(heldFuel.prop)
    end
    heldFuel = nil
    if not silent then
        notify('Fuel equipment put away.', 'inform')
    end
end

local function attachProp(modelName, position, rotation)
    local model = loadModel(modelName)
    if not model then return nil end
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local object = CreateObject(
        model,
        coords.x,
        coords.y,
        coords.z,
        false,
        false,
        false
    )
    SetModelAsNoLongerNeeded(model)
    AttachEntityToEntity(
        object,
        ped,
        GetPedBoneIndex(ped, 57005),
        position.x,
        position.y,
        position.z,
        rotation.x,
        rotation.y,
        rotation.z,
        true,
        true,
        false,
        true,
        1,
        true
    )
    return object
end

local function takeHose(stationId, pump)
    clearHeldFuel(true)
    local nozzle = attachProp(
        config.nozzleModel or 'prop_cs_fuel_nozle',
        vector3(0.13, 0.02, -0.02),
        vector3(-80.0, -90.0, 15.0)
    )
    if not nozzle then
        notify('The fuel nozzle could not be loaded.', 'error')
        return
    end
    heldFuel = {
        mode = 'hose',
        stationId = stationId,
        origin = GetEntityCoords(pump),
        prop = nozzle
    }
    notify('Hose taken. Use Left Alt on the vehicle.', 'success')
end

local function equipCan()
    clearHeldFuel(true)
    local can = attachProp(
        'prop_jerrycan_01a',
        vector3(0.11, 0.0, -0.28),
        vector3(-105.0, -5.0, 0.0)
    )
    if not can then
        notify('The fuel can could not be loaded.', 'error')
        return
    end
    heldFuel = {
        mode = 'can',
        prop = can
    }
    notify('Fuel can equipped. Use Left Alt on the vehicle.', 'success')
end

local function choosePumpAction(stationId, pump)
    local options = {}
    if heldFuel and heldFuel.mode == 'hose' then
        options[#options + 1] = {
            id = 'return_hose',
            label = 'Return fuel hose'
        }
    else
        options[#options + 1] = {
            id = 'hose',
            label = 'Take fuel hose',
            description = 'Carry the nozzle to a nearby vehicle'
        }
    end
    options[#options + 1] = {
        id = 'buy_can',
        label = 'Buy fuel can',
        description = ('$%d · %.0f liters'):format(
            tonumber(config.fuelCanPrice) or 250,
            tonumber(config.fuelCanLiters) or 20
        )
    }
    local selected = exports.fluxcore_interact:OpenMenu({
        title = 'Fuel pump',
        description = 'Choose fuel equipment',
        options = options
    })
    if not selected then return end
    if selected.id == 'hose' then
        takeHose(stationId, pump)
    elseif selected.id == 'return_hose' then
        clearHeldFuel()
    elseif selected.id == 'buy_can' then
        TriggerServerEvent('fluxcore_fuel:server:buyCan', stationId)
    end
end

local function requestRefuel(stationId, requested, targetVehicle)
    local vehicle = targetVehicle
    if not vehicle then
        vehicle = GetVehiclePedIsIn(PlayerPedId(), false)
    end
    local reason
    vehicle, reason = usableVehicle(vehicle)
    if not vehicle then
        notify(reason, 'error')
        return
    end

    if heldFuel and heldFuel.mode == 'hose' then
        stationId = heldFuel.stationId
    else
        stationId = stationId or stationForEntity(vehicle)
    end
    if not stationId and (not heldFuel or heldFuel.mode ~= 'can') then
        notify('Take a hose from a configured fuel pump first.', 'error')
        return
    end

    if nativeTrue(GetIsVehicleEngineRunning(vehicle)) then
        SetVehicleEngineOn(vehicle, false, true, true)
        Wait(150)
        if nativeTrue(GetIsVehicleEngineRunning(vehicle)) then
            notify('The engine must be off before refuelling.', 'error')
            return
        end
    end

    local tank = GetVehicleHandlingFloat(
        vehicle,
        'CHandlingData',
        'fPetrolTankVolume'
    )
    local current = math.max(0.0, GetVehicleFuelLevel(vehicle))
    local needed = math.max(0.0, tank - current)
    if needed < (tonumber(config.minimumLiters) or 1.0) then
        notify('The tank is already full.', 'inform')
        return
    end

    local liters
    if heldFuel and heldFuel.mode == 'can' then
        liters = math.min(needed, tonumber(config.fuelCanLiters) or 20)
    else
        liters = tonumber(requested)
        if not liters then
            local value = exports.fluxcore_interact:InputDialog({
                title = 'Refuel vehicle',
                description = ('%.1f / %.1f liters | $%s per liter'):format(
                    current,
                    tank,
                    tostring(config.pricePerLiter or 3)
                ),
                label = 'Liters',
                placeholder = ('%.1f'):format(needed),
                value = ('%.1f'):format(needed),
                required = true,
                maxLength = 6
            })
            liters = tonumber(value)
        end
        if not liters then return end
        liters = math.min(liters, needed)
    end

    local completed = exports.fluxcore_interact:Progress({
        label = heldFuel and heldFuel.mode == 'can'
            and 'Emptying fuel can'
            or 'Refuelling vehicle',
        duration = math.max(1500, math.floor(liters * 180)),
        canCancel = true,
        disable = {
            move = true,
            combat = true,
            vehicle = true
        }
    })
    if not completed then
        notify('Refuelling cancelled.', 'inform')
        return
    end

    if heldFuel and heldFuel.mode == 'can' then
        TriggerServerEvent(
            'fluxcore_fuel:server:useCan',
            NetworkGetNetworkIdFromEntity(vehicle)
        )
    else
        TriggerServerEvent(
            'fluxcore_fuel:server:purchase',
            NetworkGetNetworkIdFromEntity(vehicle),
            stationId,
            liters
        )
    end
end

RegisterNetEvent('fluxcore_fuel:client:purchaseResult', function(response)
    if not response or response.ok ~= true then
        notify(
            response and response.error and response.error.message
                or 'Refuelling failed.',
            'error'
        )
        return
    end
    local purchase = response.data or {}
    if not nativeTrue(NetworkDoesEntityExistWithNetworkId(purchase.networkId)) then
        notify('Fuel was approved, but the vehicle is no longer available.', 'error')
        return
    end
    local vehicle = NetToVeh(purchase.networkId)
    local current = math.max(0.0, GetVehicleFuelLevel(vehicle))
    local tank = GetVehicleHandlingFloat(
        vehicle,
        'CHandlingData',
        'fPetrolTankVolume'
    )
    SetVehicleFuelLevel(
        vehicle,
        math.min(tank, current + tonumber(purchase.liters or 0))
    )
    if purchase.usedCan then
        clearHeldFuel(true)
        notify(
            ('Added %.1f liters from the fuel can.'):format(
                tonumber(purchase.liters or 0)
            ),
            'success'
        )
    else
        notify(
            ('Added %.1f liters for $%d.'):format(
                tonumber(purchase.liters or 0),
                tonumber(purchase.cost or 0)
            ),
            'success'
        )
    end
end)

RegisterNetEvent('fluxcore_fuel:client:canPurchased', function(response)
    if response and response.ok then
        notify(
            ('Fuel can purchased for $%d. Use it from inventory.'):format(
                tonumber(response.data and response.data.cost or 0)
            ),
            'success'
        )
    else
        notify(
            response and response.error and response.error.message
                or 'The fuel can could not be purchased.',
            'error'
        )
    end
end)

RegisterNetEvent('fluxcore_fuel:client:equipCan', function()
    equipCan()
end)

RegisterNetEvent('fluxcore_fuel:client:refuel', function(stationId)
    requestRefuel(stationId)
end)

RegisterCommand('refuel', function(_, args)
    local requested
    if args[1] and string.lower(args[1]) ~= 'full' then
        requested = tonumber(args[1])
        if not requested then
            notify('Usage: /refuel [liters|full]', 'error')
            return
        end
    end
    requestRefuel(nil, requested)
end, false)

local function clearRegistrations()
    if GetResourceState('fluxcore_interact') ~= 'started' then
        registrations = {}
        return
    end
    for _, id in ipairs(registrations) do
        exports.fluxcore_interact:RemoveInteraction(id)
    end
    registrations = {}
end

local function registerTargets()
    clearRegistrations()
    local pumpId = 'fluxcore_fuel:pumps'
    exports.fluxcore_interact:AddModel({
        id = pumpId,
        models = config.pumpModels or {},
        distance = 2.2,
        options = {
            {
                id = 'equipment',
                label = 'Fuel equipment',
                description = 'Take a hose or buy a fuel can',
                onSelect = function(context)
                    local stationId = stationForEntity(context.entity)
                    if not stationId then
                        notify(
                            'This pump is not part of a configured station.',
                            'error'
                        )
                        return
                    end
                    choosePumpAction(stationId, context.entity)
                end
            }
        }
    })
    registrations[#registrations + 1] = pumpId

    local vehicleId = 'fluxcore_fuel:vehicles'
    exports.fluxcore_interact:AddGlobalVehicle({
        id = vehicleId,
        distance = tonumber(config.vehicleDistance) or 4.0,
        options = {
            {
                id = 'refuel',
                label = 'Refuel vehicle',
                description = 'Use the held hose or fuel can',
                canInteract = function(vehicle)
                    return heldFuel ~= nil
                        and DoesEntityExist(vehicle)
                        and nativeTrue(DoesVehicleUseFuel(vehicle))
                end,
                onSelect = function(context)
                    requestRefuel(
                        heldFuel and heldFuel.stationId,
                        nil,
                        context.entity
                    )
                end
            }
        }
    })
    registrations[#registrations + 1] = vehicleId
end

local function scheduleRegistration()
    registrationAttempt = registrationAttempt + 1
    local attempt = registrationAttempt
    CreateThread(function()
        for _ = 1, 20 do
            if attempt ~= registrationAttempt then return end
            if GetResourceState('fluxcore_interact') == 'started' then
                local ok, reason = pcall(registerTargets)
                if ok then return end
                print(('[fluxcore_fuel] Waiting for target: %s'):format(reason))
            end
            Wait(250)
        end
        print('[fluxcore_fuel] Could not register fuel targets.')
    end)
end

SetFuelConsumptionState(true)
SetFuelConsumptionRateMultiplier(
    tonumber(config.consumptionMultiplier) or 1.0
)
scheduleRegistration()

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource == 'fluxcore_interact' then
        scheduleRegistration()
    end
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource == resourceName then
        clearHeldFuel(true)
        SetFuelConsumptionState(false)
    end
end)

CreateThread(function()
    while true do
        if heldFuel and heldFuel.mode == 'hose' then
            local ped = PlayerPedId()
            if IsEntityDead(ped)
                or #(GetEntityCoords(ped) - heldFuel.origin)
                    > (tonumber(config.hoseDistance) or 18.0) then
                clearHeldFuel(true)
                notify('The hose was returned because you moved too far away.', 'error')
            end
            Wait(250)
        else
            Wait(750)
        end
    end
end)

CreateThread(function()
    for _, station in pairs(config.stations or {}) do
        local blip = AddBlipForCoord(station.x, station.y, station.z)
        SetBlipSprite(blip, 361)
        SetBlipColour(blip, 2)
        SetBlipScale(blip, 0.65)
        SetBlipAsShortRange(blip, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentString(station.label)
        EndTextCommandSetBlipName(blip)
    end
end)
