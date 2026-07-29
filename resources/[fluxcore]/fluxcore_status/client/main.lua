local needs = nil
local playerData = nil
local lastSnapshotJson = nil
local hudSnapshot = nil
local minimapConfigured = false
local minimapScaleform = nil
local minimapBarsHiddenAt = 0
local hudHidden = false
local voice = {
    ready = false,
    talking = false,
    proximityDistance = nil
}

local clientConfig = {
    disableVanillaHud = true,
    disableVanillaPolice = true,
    disableVanillaRadio = true,
    minimapVehicleOnly = true
}

do
    local raw = LoadResourceFile(GetCurrentResourceName(), 'config/status.json')
    if raw then
        local ok, parsed = pcall(json.decode, raw)
        if ok and type(parsed) == 'table' then
            clientConfig.disableVanillaHud = parsed.disableVanillaHud ~= false
            clientConfig.disableVanillaPolice =
                parsed.disableVanillaPolice ~= false
            clientConfig.disableVanillaRadio =
                parsed.disableVanillaRadio ~= false
            clientConfig.minimapVehicleOnly =
                parsed.minimapVehicleOnly ~= false
        end
    end
end

local function locale(key, replacements, fallback)
    return exports.fluxcore_core:Locale(key, replacements, fallback)
end

local function nativeTrue(value)
    return value == true or value == 1
end

local function copy(value)
    if value == nil then
        return nil
    end
    return json.decode(json.encode(value))
end

local function clamp(value, minimum, maximum)
    return math.max(minimum, math.min(maximum, value))
end

local function rounded(value)
    return math.floor((tonumber(value) or 0) + 0.5)
end

local function playerName()
    local profile = playerData and playerData.profile or {}
    local firstName = tostring(profile.firstName or '')
    local lastName = tostring(profile.lastName or '')
    return (firstName .. ' ' .. lastName):gsub('^%s+', ''):gsub('%s+$', '')
end

local function localizedJob()
    local job = copy(playerData and playerData.job)
    if not job or type(job.name) ~= 'string' then
        return job
    end
    job.label = locale(
        ('labels.jobs.%s.label'):format(job.name),
        nil,
        job.label or job.name
    )
    if job.grade ~= nil then
        job.gradeLabel = locale(
            ('labels.jobs.%s.grades.%s'):format(job.name, tostring(job.grade)),
            nil,
            job.gradeLabel or tostring(job.grade)
        )
    end
    return job
end

local function pedVitals()
    local ped = PlayerPedId()
    if ped == 0
        or not nativeTrue(DoesEntityExist(ped))
        or nativeTrue(IsEntityDead(ped)) then
        return 0, 0, 0
    end

    local maximum = math.max(1, GetEntityMaxHealth(ped) - 100)
    local health = clamp(
        rounded(((GetEntityHealth(ped) - 100) / maximum) * 100),
        0,
        100
    )
    local armor = clamp(rounded(GetPedArmour(ped)), 0, 100)
    local stamina = clamp(
        100 - rounded(GetPlayerSprintStaminaRemaining(PlayerId())),
        0,
        100
    )
    return health, armor, stamina
end

local function vehicleFuelPercent(vehicle)
    local tankVolume = tonumber(GetVehicleHandlingFloat(
        vehicle,
        'CHandlingData',
        'fPetrolTankVolume'
    )) or 0.0
    if tankVolume <= 0.0 then
        return 0
    end
    local fuelLiters = tonumber(GetVehicleFuelLevel(vehicle)) or 0.0
    return clamp(rounded((fuelLiters / tankVolume) * 100), 0, 100)
end

local function vehicleSnapshot()
    local ped = PlayerPedId()
    if ped == 0 or not nativeTrue(IsPedInAnyVehicle(ped, false)) then
        return nil
    end
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle == 0 or not nativeTrue(DoesEntityExist(vehicle)) then
        return nil
    end
    return {
        speed = rounded(GetEntitySpeed(vehicle) * 3.6),
        speedUnit = 'kmh',
        rpm = clamp(rounded(GetVehicleCurrentRpm(vehicle) * 100), 0, 100),
        gear = GetVehicleCurrentGear(vehicle),
        fuel = vehicleFuelPercent(vehicle),
        engineHealth = clamp(
            rounded(GetVehicleEngineHealth(vehicle) / 10),
            0,
            100
        ),
        engineRunning = nativeTrue(GetIsVehicleEngineRunning(vehicle)),
        seatbelt = LocalPlayer.state['Fluxcore:seatbelt'] == true,
        plate = tostring(GetVehicleNumberPlateText(vehicle) or ''):gsub('%s+$', '')
    }
end

local function buildHudSnapshot()
    if not playerData or not needs then
        return nil
    end
    local health, armor, stamina = pedVitals()
    local vehicle = vehicleSnapshot()
    local ped = PlayerPedId()
    return {
        contract = 'Fluxcore.hud.bootstrap.v1',
        player = {
            characterId = playerData.characterId,
            name = playerName(),
            job = localizedJob(),
            money = copy(playerData.money)
        },
        status = {
            health = health,
            armor = armor,
            hunger = rounded(needs.hunger),
            thirst = rounded(needs.thirst),
            stress = rounded(needs.stress),
            stamina = stamina
        },
        voice = copy(voice),
        vehicle = vehicle,
        visibility = {
            hud = not hudHidden,
            minimap = not hudHidden,
            money = false,
            job = true,
            weapon = ped ~= 0 and nativeTrue(IsPedArmed(ped, 7)),
            vehicle = vehicle ~= nil
        }
    }
end

local function publishHud(force)
    local snapshot = buildHudSnapshot()
    local encoded = snapshot and json.encode(snapshot) or ''
    if force or encoded ~= lastSnapshotJson then
        lastSnapshotJson = encoded
        hudSnapshot = copy(snapshot)
        TriggerEvent('fluxcore_status:client:hudUpdated', copy(snapshot))
        if snapshot then
            SendNUIMessage({
                action = 'fluxcore:hud:bootstrap',
                payload = snapshot
            })
        else
            SendNUIMessage({ action = 'fluxcore:hud:close' })
        end
    end
    return snapshot
end

local function configureMinimap()
    minimapScaleform = RequestScaleformMovie('minimap')
    local deadline = GetGameTimer() + 5000
    while not nativeTrue(HasScaleformMovieLoaded(minimapScaleform))
        and GetGameTimer() < deadline do
        Wait(0)
    end
    SetMinimapComponentPosition(
        'minimap',
        'L',
        'B',
        -0.0045,
        -0.022,
        0.150,
        0.188888
    )
    SetMinimapComponentPosition(
        'minimap_mask',
        'L',
        'B',
        0.020,
        0.032,
        0.111,
        0.159
    )
    SetMinimapComponentPosition(
        'minimap_blur',
        'L',
        'B',
        -0.030,
        0.022,
        0.266,
        0.237
    )
    SetRadarBigmapEnabled(true, false)
    Wait(50)
    SetRadarBigmapEnabled(false, false)
    Wait(50)
    if nativeTrue(HasScaleformMovieLoaded(minimapScaleform)) then
        BeginScaleformMovieMethod(minimapScaleform, 'SETUP_HEALTH_ARMOUR')
        ScaleformMovieMethodAddParamInt(3)
        EndScaleformMovieMethod()
    end
    minimapConfigured = true
end

local function hideMinimapHealthArmour()
    if not minimapScaleform
        or not nativeTrue(HasScaleformMovieLoaded(minimapScaleform)) then
        return
    end
    BeginScaleformMovieMethod(minimapScaleform, 'SETUP_HEALTH_ARMOUR')
    ScaleformMovieMethodAddParamInt(3)
    EndScaleformMovieMethod()
    minimapBarsHiddenAt = GetGameTimer()
end

local function disableVanillaPolice()
    local player = PlayerId()
    SetMaxWantedLevel(0)
    SetPoliceIgnorePlayer(player, true)
    SetDispatchCopsForPlayer(player, false)
    ClearPlayerWantedLevel(player)
    SetPlayerWantedLevel(player, 0, false)
    SetPlayerWantedLevelNow(player, false)
    SetCreateRandomCops(false)
    SetCreateRandomCopsNotOnScenarios(false)
    SetCreateRandomCopsOnScenarios(false)
    for service = 1, 15 do
        EnableDispatchService(service, false)
    end
end

local function restoreVanillaPolice()
    local player = PlayerId()
    SetMaxWantedLevel(5)
    SetPoliceIgnorePlayer(player, false)
    SetDispatchCopsForPlayer(player, true)
    SetCreateRandomCops(true)
    SetCreateRandomCopsNotOnScenarios(true)
    SetCreateRandomCopsOnScenarios(true)
    for service = 1, 15 do
        EnableDispatchService(service, true)
    end
end

RegisterNetEvent('fluxcore_status:client:update', function(snapshot)
    needs = copy(snapshot)
    publishHud(true)
end)

RegisterNetEvent('fluxcore_status:client:heal', function(amount)
    local ped = PlayerPedId()
    if ped == 0
        or not nativeTrue(DoesEntityExist(ped))
        or nativeTrue(IsEntityDead(ped)) then
        return
    end
    local maximum = GetEntityMaxHealth(ped)
    local health = GetEntityHealth(ped)
    SetEntityHealth(
        ped,
        math.min(maximum, health + math.max(1, math.min(100, tonumber(amount) or 1)))
    )
    publishHud(true)
end)

RegisterNetEvent('Fluxcore:client:playerLoaded', function(snapshot)
    playerData = copy(snapshot)
    TriggerServerEvent('fluxcore_status:server:request')
end)

RegisterNetEvent('Fluxcore:client:playerUpdated', function(snapshot)
    playerData = copy(snapshot)
    publishHud(true)
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    needs = nil
    playerData = nil
    hudHidden = false
    voice = { ready = false, talking = false, proximityDistance = nil }
    lastSnapshotJson = nil
    hudSnapshot = nil
    TriggerEvent('fluxcore_status:client:hudUpdated', nil)
    SendNUIMessage({ action = 'fluxcore:hud:close' })
end)

RegisterCommand('hud', function()
    hudHidden = not hudHidden
    publishHud(true)
    TriggerEvent('chat:addMessage', {
        args = {
            'HUD',
            hudHidden and 'Fluxcore HUD hidden.' or 'Fluxcore HUD visible.'
        }
    })
end, false)

AddEventHandler('fluxcore_voice:client:stateChanged', function(snapshot)
    if type(snapshot) ~= 'table' then
        return
    end
    voice = {
        ready = snapshot.ready == true,
        talking = snapshot.talking == true,
        proximityDistance = tonumber(snapshot.proximityDistance)
    }
    publishHud(true)
end)

local function refreshVoiceState()
    if GetResourceState('fluxcore_voice') ~= 'started' then
        voice = { ready = false, talking = false, proximityDistance = nil }
        publishHud(true)
        return
    end
    local ok, snapshot = pcall(function()
        return exports.fluxcore_voice:GetVoiceState()
    end)
    if ok and type(snapshot) == 'table' then
        voice = {
            ready = snapshot.ready == true,
            talking = snapshot.talking == true,
            proximityDistance = tonumber(snapshot.proximityDistance)
        }
        publishHud(true)
    end
end

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource == 'fluxcore_voice'
        or startedResource == GetCurrentResourceName() then
        CreateThread(function()
            Wait(100)
            refreshVoiceState()
        end)
    end
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource == 'fluxcore_voice' then
        voice = { ready = false, talking = false, proximityDistance = nil }
        publishHud(true)
    end
end)

CreateThread(function()
    local hiddenComponents = {
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
        12, 13, 15, 16, 17, 18, 19, 20, 21, 22
    }
    while true do
        if clientConfig.disableVanillaHud then
            DisplayHud(false)
            for _, component in ipairs(hiddenComponents) do
                HideHudComponentThisFrame(component)
            end
            DisplayAmmoThisFrame(false)
        end
        if clientConfig.disableVanillaRadio then
            DisableControlAction(0, 81, true)
            DisableControlAction(0, 82, true)
            DisableControlAction(0, 85, true)
            SetUserRadioControlEnabled(false)
            SetFrontendRadioActive(false)
            local ped = PlayerPedId()
            if ped ~= 0 and nativeTrue(IsPedInAnyVehicle(ped, false)) then
                local vehicle = GetVehiclePedIsIn(ped, false)
                SetVehicleRadioEnabled(vehicle, false)
                SetVehRadioStation(vehicle, 'OFF')
            end
        end
        if hudSnapshot then
            if not minimapConfigured then
                configureMinimap()
            end
            DisplayRadar(
                not hudHidden
                    and (
                        not clientConfig.minimapVehicleOnly
                        or hudSnapshot.vehicle ~= nil
                    )
            )
            if hudSnapshot.vehicle ~= nil
                and GetGameTimer() - minimapBarsHiddenAt >= 1000 then
                hideMinimapHealthArmour()
            end
        else
            DisplayRadar(false)
        end
        Wait(0)
    end
end)

CreateThread(function()
    if not clientConfig.disableVanillaPolice then
        return
    end
    disableVanillaPolice()
    local nextEnforcementAt = GetGameTimer() + 5000
    while true do
        local player = PlayerId()
        if GetPlayerWantedLevel(player) ~= 0 then
            ClearPlayerWantedLevel(player)
            SetPlayerWantedLevel(player, 0, false)
            SetPlayerWantedLevelNow(player, false)
        end
        if GetGameTimer() >= nextEnforcementAt then
            disableVanillaPolice()
            nextEnforcementAt = GetGameTimer() + 5000
        end
        Wait(1000)
    end
end)

AddEventHandler('onClientResourceStop', function(stoppedResource)
    if stoppedResource == GetCurrentResourceName() then
        DisplayHud(true)
        DisplayRadar(true)
        SetRadarBigmapEnabled(false, false)
        SetUserRadioControlEnabled(true)
        if minimapScaleform then
            SetScaleformMovieAsNoLongerNeeded(minimapScaleform)
        end
        if clientConfig.disableVanillaPolice then
            restoreVanillaPolice()
        end
    end
end)

exports('GetStatus', function()
    return copy(needs)
end)

exports('GetHudData', function()
    return copy(buildHudSnapshot())
end)

CreateThread(function()
    while not nativeTrue(NetworkIsPlayerActive(PlayerId())) do
        Wait(250)
    end
    if GetResourceState('fluxcore_core') == 'started'
        and exports.fluxcore_core:IsLoggedIn() then
        playerData = exports.fluxcore_core:GetPlayerData()
        TriggerServerEvent('fluxcore_status:server:request')
    end
end)

CreateThread(function()
    while true do
        Wait(playerData and 500 or 1000)
        if playerData and needs then
            publishHud(false)
        end
    end
end)
