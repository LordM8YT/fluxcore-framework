local chatOpen = false
local currentEmote = nil
local roleplayBubbles = {}

local function nativeTrue(value)
    return value == true or value == 1
end

local emotes = {
    sit = { dict = 'anim@heists@fleeca_bank@ig_7_jetski_owner', anim = 'owner_idle', flag = 1 },
    lean = { dict = 'amb@world_human_leaning@male@wall@back@foot_up@idle_a', anim = 'idle_a', flag = 1 },
    crossarms = { dict = 'amb@world_human_hang_out_street@female_arms_crossed@idle_a', anim = 'idle_a', flag = 49 },
    handsup = { dict = 'missminuteman_1ig_2', anim = 'handsup_base', flag = 49 },
    surrender = { dict = 'random@arrests@busted', anim = 'idle_a', flag = 1 },
    clipboard = { scenario = 'WORLD_HUMAN_CLIPBOARD' },
    smoke = { scenario = 'WORLD_HUMAN_SMOKING' }
}

local function setChatOpen(open)
    chatOpen = open == true
    SetNuiFocus(chatOpen, false)
    SetNuiFocusKeepInput(false)
    SendNUIMessage({ action = chatOpen and 'open' or 'close' })
end

local function addMessage(message)
    SendNUIMessage({ action = 'message', message = message })
end

local function boundedBubbleText(value)
    local text = tostring(value or '')
    local ok, cutoff = pcall(utf8.offset, text, 121)
    if not ok then
        return ''
    end
    return cutoff and text:sub(1, cutoff - 1) or text
end

local function addRoleplayBubble(message)
    if type(message) ~= 'table'
        or (message.type ~= 'me'
            and message.type ~= 'do'
            and message.type ~= 'try') then
        return
    end
    local serverId = tonumber(message.source)
    if not serverId then
        return
    end
    local text = boundedBubbleText(message.text)
    if text == '' then
        return
    end
    roleplayBubbles[#roleplayBubbles + 1] = {
        serverId = serverId,
        text = text,
        expiresAt = GetGameTimer() + 7000
    }
    while #roleplayBubbles > 8 do
        table.remove(roleplayBubbles, 1)
    end
end

local function drawWorldText(coords, text, offset)
    local visible, screenX, screenY = World3dToScreen2d(
        coords.x,
        coords.y,
        coords.z + 1.05 + offset
    )
    if not nativeTrue(visible) then
        return
    end
    SetTextScale(0.0, 0.28)
    SetTextFont(0)
    SetTextProportional(true)
    SetTextCentre(true)
    SetTextColour(244, 240, 255, 230)
    SetTextDropshadow(1, 0, 0, 0, 180)
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayText(screenX, screenY)
end

local function stopEmote()
    local ped = PlayerPedId()
    ClearPedTasks(ped)
    currentEmote = nil
end

local function playEmote(name)
    local definition = emotes[name]
    if not definition then
        addMessage({
            type = 'system',
            author = 'Emotes',
            text = 'Unknown emote. Try: sit, lean, crossarms, handsup, surrender, clipboard, smoke or cancel.'
        })
        return
    end

    stopEmote()
    local ped = PlayerPedId()
    if definition.scenario then
        TaskStartScenarioInPlace(ped, definition.scenario, 0, true)
    else
        RequestAnimDict(definition.dict)
        local deadline = GetGameTimer() + 5000
        while not HasAnimDictLoaded(definition.dict) and GetGameTimer() < deadline do
            Wait(0)
        end
        if not HasAnimDictLoaded(definition.dict) then
            addMessage({ type = 'error', author = 'Emotes', text = 'The animation could not be loaded.' })
            return
        end
        TaskPlayAnim(ped, definition.dict, definition.anim, 3.0, 3.0, -1, definition.flag, 0.0, false, false, false)
    end
    currentEmote = name
end

RegisterCommand('fluxcore_chat_open', function()
    if not chatOpen and not IsPauseMenuActive() then
        setChatOpen(true)
    end
end, false)

RegisterKeyMapping('fluxcore_chat_open', 'Open Fluxcore chat', 'keyboard', 'T')

RegisterCommand('me', function(_, args)
    TriggerServerEvent('fluxcore_chat:server:roleplay', 'me', table.concat(args, ' '))
end, false)

RegisterCommand('do', function(_, args)
    TriggerServerEvent('fluxcore_chat:server:roleplay', 'do', table.concat(args, ' '))
end, false)

RegisterCommand('ooc', function(_, args)
    TriggerServerEvent('fluxcore_chat:server:roleplay', 'ooc', table.concat(args, ' '))
end, false)

for _, command in ipairs({ 'try', 'whisper', 'shout' }) do
    RegisterCommand(command, function(_, args)
        TriggerServerEvent(
            'fluxcore_chat:server:roleplay',
            command,
            table.concat(args, ' ')
        )
    end, false)
end

RegisterCommand('e', function(_, args)
    local name = string.lower(tostring(args[1] or ''))
    if name == '' then
        addMessage({ type = 'system', author = 'Emotes', text = '/e sit, lean, crossarms, handsup, surrender, clipboard, smoke or cancel' })
    elseif name == 'cancel' or name == 'c' then
        stopEmote()
    else
        playEmote(name)
    end
end, false)

RegisterCommand('clear', function()
    SendNUIMessage({ action = 'clear' })
end, false)

RegisterCommand('controls', function()
    for _, text in ipairs({
        'T chat | TAB inventory | 1-5 hotbar | X cancel emote',
        'LEFT ALT target and interact',
        'L vehicle lock | G engine | B seatbelt',
        'GRAVE voice range | /voice status | /hud HUD | /logout characters'
    }) do
        addMessage({ type = 'system', author = 'Controls', text = text })
    end
end, false)

RegisterCommand('+fluxcore_cancel_emote', function()
    if currentEmote then
        stopEmote()
    end
end, false)

RegisterCommand('-fluxcore_cancel_emote', function()
end, false)

RegisterKeyMapping(
    '+fluxcore_cancel_emote',
    'Cancel active Fluxcore emote',
    'keyboard',
    'X'
)

RegisterNetEvent('fluxcore_chat:client:message', function(message)
    addMessage(message)
    addRoleplayBubble(message)
end)

RegisterNetEvent('Fluxcore:client:playerLoggedOut', function()
    setChatOpen(false)
    stopEmote()
    roleplayBubbles = {}
    SendNUIMessage({ action = 'clear' })
end)

AddEventHandler('chat:addMessage', function(message)
    if type(message) ~= 'table' then return end
    local args = type(message.args) == 'table' and message.args or {}
    local hasAuthor = args[2] ~= nil
    addMessage({
        type = message.type or 'system',
        author = tostring(
            message.author or (hasAuthor and args[1]) or 'System'
        ),
        text = tostring(
            message.text or (hasAuthor and args[2]) or args[1] or ''
        )
    })
end)

AddEventHandler('chat:addSuggestion', function(command, help)
    SendNUIMessage({
        action = 'suggestion',
        suggestion = { command = tostring(command or ''), help = tostring(help or '') }
    })
end)

AddEventHandler('chat:addSuggestions', function(entries)
    if type(entries) ~= 'table' then
        return
    end
    for _, entry in ipairs(entries) do
        if type(entry) == 'table' then
            SendNUIMessage({
                action = 'suggestion',
                suggestion = {
                    command = tostring(entry.name or entry.command or ''),
                    help = tostring(entry.help or '')
                }
            })
        end
    end
end)

AddEventHandler('chat:removeSuggestion', function(command)
    SendNUIMessage({
        action = 'removeSuggestion',
        command = tostring(command or '')
    })
end)

AddEventHandler('chat:clear', function()
    SendNUIMessage({ action = 'clear' })
end)

RegisterNUICallback('submit', function(data, callback)
    local text = tostring(data and data.text or ''):gsub('^%s+', ''):gsub('%s+$', '')
    setChatOpen(false)
    if text ~= '' then
        if text:sub(1, 1) == '/' then
            ExecuteCommand(text:sub(2))
        else
            TriggerServerEvent('fluxcore_chat:server:message', text)
        end
    end
    callback({ ok = true })
end)

RegisterNUICallback('close', function(_, callback)
    setChatOpen(false)
    callback({ ok = true })
end)

CreateThread(function()
    Wait(0)
    for _, suggestion in ipairs({
        { '/me', 'Describe what your character does' },
        { '/do', 'Describe the scene or its result' },
        { '/ooc', 'Send an out-of-character message' },
        { '/try', 'Attempt an action with a server-generated result' },
        { '/whisper', 'Speak to players within 3 meters' },
        { '/shout', 'Speak to players within 40 meters' },
        { '/e sit', 'Play an emote; use /e cancel to stop' },
        { '/characters', 'Open character selection while logged out' },
        { '/logout', 'Save and return to character selection' },
        { '/911', 'Contact emergency services' },
        { '/inventory', 'Open your inventory' },
        { '/phone', 'Open your phone' },
        { '/jobs', 'Open the jobs menu' },
        { '/paycheck', 'Show current job pay and next payday' },
        { '/garage', 'Open a nearby garage' },
        { '/engine', 'Start or stop your current vehicle engine' },
        { '/vlock', 'Lock or unlock a nearby accessible vehicle' },
        { '/trunk', 'Open the inventory of a nearby accessible vehicle' },
        { '/refuel', 'Refuel the nearby vehicle after selecting a fuel method' },
        { '/bank', 'Open a nearby bank or ATM' },
        { '/appearance', 'Open the character appearance editor' },
        { '/hud', 'Hide or show the Fluxcore HUD' },
        { '/voice', 'Show proximity voice status' },
        { '/controls', 'Show the main Fluxcore key mappings' }
    }) do
        SendNUIMessage({ action = 'suggestion', suggestion = {
            command = suggestion[1],
            help = suggestion[2]
        } })
    end
end)

CreateThread(function()
    while true do
        if currentEmote then
            local ped = PlayerPedId()
            if ped == 0
                or nativeTrue(IsEntityDead(ped))
                or nativeTrue(IsPedInAnyVehicle(ped, false)) then
                stopEmote()
            end
            Wait(250)
        else
            Wait(750)
        end
    end
end)

CreateThread(function()
    while true do
        local now = GetGameTimer()
        local offsets = {}
        for index = #roleplayBubbles, 1, -1 do
            local bubble = roleplayBubbles[index]
            if bubble.expiresAt <= now then
                table.remove(roleplayBubbles, index)
            else
                local player = GetPlayerFromServerId(bubble.serverId)
                if player ~= -1 and nativeTrue(NetworkIsPlayerActive(player)) then
                    local ped = GetPlayerPed(player)
                    if ped ~= 0 and nativeTrue(DoesEntityExist(ped)) then
                        local offset = offsets[bubble.serverId] or 0
                        drawWorldText(
                            GetEntityCoords(ped),
                            bubble.text,
                            offset * 0.18
                        )
                        offsets[bubble.serverId] = offset + 1
                    end
                end
            end
        end
        Wait(#roleplayBubbles > 0 and 0 or 500)
    end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        SetNuiFocus(false, false)
        stopEmote()
    end
end)
