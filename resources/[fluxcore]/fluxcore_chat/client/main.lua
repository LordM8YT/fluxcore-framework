local chatOpen = false
local currentEmote = nil

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

RegisterNetEvent('fluxcore_chat:client:message', function(message)
    addMessage(message)
end)

AddEventHandler('chat:addMessage', function(message)
    if type(message) ~= 'table' then return end
    local args = type(message.args) == 'table' and message.args or {}
    addMessage({
        type = message.type or 'system',
        author = tostring(args[1] or message.author or 'System'),
        text = tostring(args[2] or message.text or args[1] or '')
    })
end)

AddEventHandler('chat:addSuggestion', function(command, help)
    SendNUIMessage({
        action = 'suggestion',
        suggestion = { command = tostring(command or ''), help = tostring(help or '') }
    })
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
        { '/e sit', 'Play an emote; use /e cancel to stop' },
        { '/911', 'Contact emergency services' },
        { '/inventory', 'Open your inventory' },
        { '/phone', 'Open your phone' },
        { '/jobs', 'Open the jobs menu' },
        { '/garage', 'Open a nearby garage' }
    }) do
        SendNUIMessage({ action = 'suggestion', suggestion = {
            command = suggestion[1],
            help = suggestion[2]
        } })
    end
end)

AddEventHandler('onClientResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        SetNuiFocus(false, false)
        stopEmote()
    end
end)
