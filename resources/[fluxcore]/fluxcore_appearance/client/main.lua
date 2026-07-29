local appearance = nil
local hasSpawned = false
local applying = false
local editorOpen = false
local initialCreatorPending = false
local editorOriginal = nil
local editorCamera = nil

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

local function message(text, kind)
    local color = kind == 'error' and { 220, 70, 70 } or { 90, 180, 255 }
    TriggerEvent('chat:addMessage', {
        color = color,
        args = { 'Fluxcore', tostring(text) }
    })
    print(('[fluxcore_appearance] %s'):format(tostring(text)))
end

local function loadModel(model)
    local hash = GetHashKey(model)
    if not nativeTrue(IsModelInCdimage(hash))
        or not nativeTrue(IsModelValid(hash)) then
        return nil
    end
    RequestModel(hash)
    local deadline = GetGameTimer() + 10000
    while not nativeTrue(HasModelLoaded(hash)) and GetGameTimer() < deadline do
        Wait(25)
    end
    if not nativeTrue(HasModelLoaded(hash)) then
        return nil
    end
    return hash
end

local function apply(value)
    if applying or type(value) ~= 'table' or type(value.model) ~= 'string' then
        return false
    end
    applying = true

    local hash = loadModel(value.model)
    if not hash then
        applying = false
        message(locale(
            'appearance.modelLoadFailed',
            nil,
            'The stored character model could not be loaded.'
        ), 'error')
        return false
    end

    if GetEntityModel(PlayerPedId()) ~= hash then
        SetPlayerModel(PlayerId(), hash)
    end
    SetModelAsNoLongerNeeded(hash)

    local ped = PlayerPedId()
    SetPedDefaultComponentVariation(ped)
    ClearAllPedProps(ped)

    local blend = value.headBlend
    if type(blend) == 'table' then
        SetPedHeadBlendData(
            ped,
            tonumber(blend.shapeFirst) or 0,
            tonumber(blend.shapeSecond) or 0,
            tonumber(blend.shapeThird) or 0,
            tonumber(blend.skinFirst) or 0,
            tonumber(blend.skinSecond) or 0,
            tonumber(blend.skinThird) or 0,
            tonumber(blend.shapeMix) or 0.5,
            tonumber(blend.skinMix) or 0.5,
            tonumber(blend.thirdMix) or 0.0,
            false
        )
    end

    for _, feature in ipairs(value.faceFeatures or {}) do
        SetPedFaceFeature(
            ped,
            tonumber(feature.index),
            tonumber(feature.value)
        )
    end

    SetPedHairColor(
        ped,
        tonumber(value.hairColor) or 0,
        tonumber(value.hairHighlight) or 0
    )
    SetPedEyeColor(ped, tonumber(value.eyeColor) or 0)

    for _, overlay in ipairs(value.headOverlays or {}) do
        SetPedHeadOverlay(
            ped,
            tonumber(overlay.overlayId),
            tonumber(overlay.value),
            tonumber(overlay.opacity)
        )
        SetPedHeadOverlayColor(
            ped,
            tonumber(overlay.overlayId),
            tonumber(overlay.colorType),
            tonumber(overlay.color),
            tonumber(overlay.secondaryColor)
        )
    end

    for _, component in ipairs(value.components or {}) do
        SetPedComponentVariation(
            ped,
            tonumber(component.componentId),
            tonumber(component.drawable),
            tonumber(component.texture),
            tonumber(component.palette)
        )
    end

    for _, prop in ipairs(value.props or {}) do
        if tonumber(prop.drawable) and tonumber(prop.drawable) >= 0 then
            SetPedPropIndex(
                ped,
                tonumber(prop.propId),
                tonumber(prop.drawable),
                tonumber(prop.texture),
                true
            )
        else
            ClearPedProp(ped, tonumber(prop.propId))
        end
    end

    applying = false
    TriggerEvent('fluxcore_appearance:client:applied', copy(value))
    return true
end

local function closeEditor(restore)
    if not editorOpen then
        return
    end
    editorOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'appearance:close' })
    if editorCamera and DoesCamExist(editorCamera) then
        RenderScriptCams(false, true, 250, true, true)
        DestroyCam(editorCamera, false)
    end
    editorCamera = nil
    FreezeEntityPosition(PlayerPedId(), false)
    if restore and editorOriginal then
        apply(editorOriginal)
    end
    editorOriginal = nil
end

local function openEditor()
    if editorOpen or not hasSpawned or not appearance then
        return false
    end
    editorOpen = true
    editorOriginal = copy(appearance)
    local ped = PlayerPedId()
    FreezeEntityPosition(ped, true)
    editorCamera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    local coords = GetEntityCoords(ped)
    local forward = GetEntityForwardVector(ped)
    SetCamCoord(
        editorCamera,
        coords.x + forward.x * 2.15,
        coords.y + forward.y * 2.15,
        coords.z + 0.65
    )
    PointCamAtEntity(editorCamera, ped, 0.0, 0.0, 0.55, true)
    SetCamFov(editorCamera, 36.0)
    RenderScriptCams(true, true, 300, true, true)
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'appearance:open',
        appearance = copy(appearance)
    })
    TriggerEvent('fluxcore_appearance:client:openRequested', copy(appearance))
    return true
end

RegisterNetEvent('fluxcore_appearance:client:update', function(value, isNew)
    appearance = copy(value)
    initialCreatorPending = initialCreatorPending or isNew == true
    TriggerEvent('fluxcore_appearance:client:updated', copy(value))
    if hasSpawned then
        CreateThread(function()
            apply(appearance)
            if initialCreatorPending then
                initialCreatorPending = false
                Wait(350)
                openEditor()
            end
        end)
    end
end)

RegisterNetEvent('fluxcore_appearance:client:error', function(text, code)
    local key = code and ('errors.%s'):format(tostring(code)) or nil
    local translated = key and locale(key) or nil
    message(translated and translated ~= key and translated or text, 'error')
end)

RegisterNetEvent('Fluxcore:client:playerLoaded', function()
    hasSpawned = false
    TriggerServerEvent('fluxcore_appearance:server:request')
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    closeEditor(false)
    hasSpawned = false
    appearance = nil
    initialCreatorPending = false
end)

AddEventHandler('playerSpawned', function()
    hasSpawned = true
    CreateThread(function()
        Wait(100)
        if appearance then
            apply(appearance)
            if initialCreatorPending then
                initialCreatorPending = false
                Wait(350)
                openEditor()
            end
        else
            TriggerServerEvent('fluxcore_appearance:server:request')
        end
    end)
end)

RegisterCommand('appearance', function()
    if not appearance then
        message(locale(
            'appearance.notLoaded',
            nil,
            'No character appearance is loaded.'
        ), 'error')
        return
    end
    openEditor()
end, false)

RegisterNUICallback('appearancePreview', function(value, callback)
    callback({ ok = apply(value) })
end)

RegisterNUICallback('appearanceSave', function(value, callback)
    appearance = copy(value)
    TriggerServerEvent('fluxcore_appearance:server:save', value)
    closeEditor(false)
    callback({ ok = true })
end)

RegisterNUICallback('appearanceCancel', function(_, callback)
    closeEditor(true)
    callback({ ok = true })
end)

RegisterNUICallback('appearanceRotate', function(data, callback)
    local amount = tonumber(type(data) == 'table' and data.amount) or 0.0
    SetEntityHeading(PlayerPedId(), GetEntityHeading(PlayerPedId()) + amount)
    callback({ ok = true })
end)

RegisterCommand('resetappearance', function()
    TriggerServerEvent('fluxcore_appearance:server:reset')
end, false)

exports('GetAppearance', function()
    return copy(appearance)
end)

exports('ApplyAppearance', function(value)
    return apply(value)
end)

exports('SaveAppearance', function(value)
    TriggerServerEvent('fluxcore_appearance:server:save', value)
    return true
end)

exports('ResetAppearance', function()
    TriggerServerEvent('fluxcore_appearance:server:reset')
    return true
end)

CreateThread(function()
    while not nativeTrue(NetworkIsPlayerActive(PlayerId())) do
        Wait(250)
    end
    if GetResourceState('fluxcore_core') == 'started'
        and exports.fluxcore_core:IsLoggedIn() then
        hasSpawned = nativeTrue(DoesEntityExist(PlayerPedId()))
        TriggerServerEvent('fluxcore_appearance:server:request')
    end
end)

CreateThread(function()
    while true do
        if editorOpen then
            DisableAllControlActions(0)
            HideHudAndRadarThisFrame()
            Wait(0)
        else
            Wait(500)
        end
    end
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource == GetCurrentResourceName() then
        closeEditor(true)
    end
end)
