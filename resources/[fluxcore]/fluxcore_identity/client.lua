local RESOURCE_NAME = GetCurrentResourceName()

local isOpen = false
local isLoading = false
local selectedSpawn = 'last'
local previewCamera = nil
local previewActive = false
local originalPosition = nil

local function locale(key, replacements, fallback)
    return exports.fluxcore_core:Locale(key, replacements, fallback)
end

local function nativeTrue(value)
    return value == true or value == 1
end

local function send(action, data)
    SendNUIMessage({
        action = action,
        data = data
    })
end

local function uiLocale()
    local data = exports.fluxcore_core:GetLocaleData('identity')
    data.labels = exports.fluxcore_core:GetLocaleData('labels')
    return data
end

local function publicSpawns()
    local spawns = {}
    for _, spawn in ipairs(FluxcoreIdentityConfig.spawns) do
        spawns[#spawns + 1] = {
            id = spawn.id,
            label = locale(spawn.labelKey, nil, spawn.label or spawn.id),
            description = locale(
                spawn.descriptionKey,
                nil,
                spawn.description or ''
            )
        }
    end
    return spawns
end

local function findSpawn(spawnId)
    for _, spawn in ipairs(FluxcoreIdentityConfig.spawns) do
        if spawn.id == spawnId then
            return spawn
        end
    end
    return FluxcoreIdentityConfig.spawns[1]
end

local function releaseNuiFocus()
    SetNuiFocus(false, false)
    if SetNuiFocusKeepInput then
        SetNuiFocusKeepInput(false)
    end
end

local function destroyPreviewCamera()
    if previewCamera and DoesCamExist(previewCamera) then
        RenderScriptCams(false, false, 0, true, true)
        DestroyCam(previewCamera, false)
    end
    previewCamera = nil
    ClearFocus()
end

local function restorePreviewPlayer()
    local ped = PlayerPedId()
    if ped == 0 or not nativeTrue(DoesEntityExist(ped)) then
        return
    end
    FreezeEntityPosition(ped, false)
    SetEntityCollision(ped, true, true)
    SetEntityInvincible(ped, false)
    SetEntityVisible(ped, true, false)
    SetPlayerControl(PlayerId(), true, false)
    if originalPosition then
        SetEntityCoordsNoOffset(
            ped,
            originalPosition.x,
            originalPosition.y,
            originalPosition.z,
            false,
            false,
            false
        )
        SetEntityHeading(ped, originalPosition.heading)
    end
end

local function leavePreview(restorePlayer)
    destroyPreviewCamera()
    previewActive = false
    if restorePlayer then
        restorePreviewPlayer()
    end
    originalPosition = nil
end

local function enterPreview()
    local scene = FluxcoreIdentityConfig.preview or {}
    local position = scene.ped or {}
    local camera = scene.camera or {}
    local ped = PlayerPedId()
    if ped == 0 or not nativeTrue(DoesEntityExist(ped)) then
        return false
    end

    local current = GetEntityCoords(ped)
    originalPosition = {
        x = current.x,
        y = current.y,
        z = current.z,
        heading = GetEntityHeading(ped)
    }
    SetPlayerControl(PlayerId(), false, false)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetEntityCollision(ped, false, false)
    SetEntityCoordsNoOffset(
        ped,
        tonumber(position.x) or 402.9154,
        tonumber(position.y) or -996.7597,
        tonumber(position.z) or -99.0003,
        false,
        false,
        false
    )
    SetEntityHeading(ped, tonumber(position.heading) or 180.0)
    SetEntityVisible(ped, true, false)

    local cameraX = tonumber(camera.x) or 402.9154
    local cameraY = tonumber(camera.y) or -999.15
    local cameraZ = tonumber(camera.z) or -98.35
    RequestCollisionAtCoord(
        tonumber(position.x) or 402.9154,
        tonumber(position.y) or -996.7597,
        tonumber(position.z) or -99.0003
    )
    SetFocusPosAndVel(cameraX, cameraY, cameraZ, 0.0, 0.0, 0.0)
    previewCamera = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamCoord(previewCamera, cameraX, cameraY, cameraZ)
    SetCamFov(previewCamera, tonumber(camera.fov) or 34.0)
    PointCamAtEntity(previewCamera, ped, 0.0, 0.0, 0.55, true)
    RenderScriptCams(true, false, 0, true, true)
    previewActive = true
    return true
end

local function closeMenu()
    isOpen = false
    isLoading = false
    releaseNuiFocus()
    send('identity:close')
end

local function refreshMenu(callback)
    exports.fluxcore_core:CallAsync('characters:bootstrap', {}, function(response)
        if response.ok then
            send('identity:update', {
                title = locale(
                    FluxcoreIdentityConfig.titleKey,
                    nil,
                    FluxcoreIdentityConfig.title or 'Fluxcore'
                ),
                subtitle = locale(
                    FluxcoreIdentityConfig.subtitleKey,
                    nil,
                    FluxcoreIdentityConfig.subtitle or 'Choose your path'
                ),
                allowDelete = FluxcoreIdentityConfig.allowDelete,
                characters = response.data.characters,
                maxCharacters = response.data.maxCharacters,
                spawns = publicSpawns(),
                localeName = exports.fluxcore_core:GetLocale(),
                locale = uiLocale()
            })
        end

        if callback then
            callback(response)
        end
    end, 15000)
end

local function openMenu()
    if isOpen or isLoading or exports.fluxcore_core:IsLoggedIn() then
        return
    end

    isLoading = true
    DoScreenFadeOut(0)
    refreshMenu(function(response)
        isLoading = false
        if not response.ok then
            leavePreview(true)
            DoScreenFadeIn(300)
            print(('[fluxcore_identity] %s: %s'):format(
                locale(
                    'identity.errors.openFailed',
                    nil,
                    'Could not open identity'
                ),
                response.error and response.error.message
                    or locale('common.unknown', nil, 'unknown error')
            ))
            return
        end

        CreateThread(function()
            enterPreview()
            Wait(350)
            isOpen = true
            SetNuiFocus(true, true)
            send('identity:open')
            DoScreenFadeIn(500)
        end)
    end)
end

RegisterNUICallback('createCharacter', function(data, cb)
    if not isOpen then
        cb({
            ok = false,
            error = {
                code = 'MENU_CLOSED',
                message = locale(
                    'identity.errors.menuClosed',
                    nil,
                    'Identity menu is closed.'
                )
            }
        })
        return
    end

    exports.fluxcore_core:CallAsync('characters:create', data, function(response)
        cb(response)
        if response.ok then
            refreshMenu()
        end
    end)
end)

RegisterNUICallback('deleteCharacter', function(data, cb)
    if not isOpen or not FluxcoreIdentityConfig.allowDelete then
        cb({
            ok = false,
            error = {
                code = 'DELETE_DISABLED',
                message = locale(
                    'identity.errors.deleteDisabled',
                    nil,
                    'Character deletion is disabled.'
                )
            }
        })
        return
    end

    local characterId = type(data) == 'table' and data.characterId or nil
    exports.fluxcore_core:CallAsync('characters:delete', {
        characterId = characterId,
        confirmation = characterId
    }, function(response)
        cb(response)
        if response.ok then
            refreshMenu()
        end
    end)
end)

RegisterNUICallback('selectCharacter', function(data, cb)
    if not isOpen then
        cb({
            ok = false,
            error = {
                code = 'MENU_CLOSED',
                message = locale(
                    'identity.errors.menuClosed',
                    nil,
                    'Identity menu is closed.'
                )
            }
        })
        return
    end

    selectedSpawn = type(data.spawnId) == 'string' and data.spawnId or 'last'
    exports.fluxcore_core:CallAsync('characters:select', {
        characterId = data.characterId
    }, function(response)
        cb(response)
        if response.ok then
            closeMenu()
        end
    end)
end)

RegisterNUICallback('close', function(_, cb)
    if exports.fluxcore_core:IsLoggedIn() then
        closeMenu()
        cb({ ok = true })
        return
    end

    cb({
        ok = false,
        error = {
            code = 'CHARACTER_REQUIRED',
            message = locale(
                'identity.errors.characterRequired',
                nil,
                'Select a character before closing the menu.'
            )
        }
    })
end)

AddEventHandler('fluxcore_identity:client:spawnRequested', function(snapshot)
    -- The server can request the spawn before the asynchronous NUI callback
    -- has returned. Close the fullscreen frame here as well so it can never
    -- remain above the game after a successful character selection.
    DoScreenFadeOut(250)
    while not nativeTrue(IsScreenFadedOut()) do
        Wait(0)
    end
    closeMenu()

    local spawn = findSpawn(selectedSpawn)
    local position = snapshot and snapshot.position
    if spawn and not spawn.useLastPosition and spawn.position then
        position = spawn.position
    end

    exports.fluxcore_core:SpawnAt(position)
    leavePreview(false)
    selectedSpawn = 'last'
end)

RegisterNetEvent('fluxcore:client:playerLoggedOut', function()
    SetTimeout(250, openMenu)
end)

RegisterCommand('identity', function()
    openMenu()
end, false)

CreateThread(function()
    while not nativeTrue(NetworkIsPlayerActive(PlayerId())) do
        Wait(250)
    end

    DoScreenFadeOut(0)
    Wait(1000)
    openMenu()
end)

CreateThread(function()
    while true do
        if isOpen or isLoading or previewActive then
            HideHudAndRadarThisFrame()
            DisableAllControlActions(0)
            EnableControlAction(0, 1, true)
            EnableControlAction(0, 2, true)
            Wait(0)
        else
            Wait(500)
        end
    end
end)

AddEventHandler('onResourceStop', function(stoppedResource)
    if stoppedResource == RESOURCE_NAME then
        releaseNuiFocus()
        leavePreview(true)
        DoScreenFadeIn(0)
    end
end)
