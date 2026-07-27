local function message(text, color)
    print(('[fluxcore_example] %s'):format(text))
    TriggerEvent('chat:addMessage', {
        color = color or { 160, 210, 255 },
        args = { 'Fluxcore', text }
    })
end

local function showError(response)
    local error = response and response.error or {}
    message(('%s: %s'):format(
        error.code or 'UNKNOWN_ERROR',
        error.message or locale('example.unknownError', nil, 'unknown error')
    ), { 255, 100, 100 })
end

RegisterCommand('characters', function()
    exports.fluxcore_core:CallAsync('characters:list', {}, function(response)
        if not response.ok then
            showError(response)
            return
        end

        if #response.data == 0 then
            message(locale(
                'example.noCharacters',
                nil,
                'No characters. Use /newchar <slot> <first> <last> <YYYY-MM-DD>.'
            ))
            return
        end

        for _, character in ipairs(response.data) do
            message(('[%s] %s %s — %s'):format(
                character.slot,
                character.profile.firstName,
                character.profile.lastName,
                character.characterId
            ))
        end
    end)
end, false)

RegisterCommand('newchar', function(_, args)
    local slot = tonumber(args[1])
    local firstName = args[2]
    local lastName = args[3]
    local birthDate = args[4]

    if not slot or not firstName or not lastName or not birthDate then
        message(locale(
            'example.usageNewCharacter',
            nil,
            'Usage: /newchar <slot> <first> <last> <YYYY-MM-DD>'
        ))
        return
    end

    exports.fluxcore_core:CallAsync('characters:create', {
        slot = slot,
        firstName = firstName,
        lastName = lastName,
        birthDate = birthDate,
        gender = 'unspecified',
        nationality = 'Unknown'
    }, function(response)
        if not response.ok then
            showError(response)
            return
        end
        message(locale(
            'example.characterCreated',
            {
                firstName = response.data.profile.firstName,
                lastName = response.data.profile.lastName,
                characterId = response.data.characterId
            },
            ('Created %s %s with id %s. Use /playchar %s.'):format(
                response.data.profile.firstName,
                response.data.profile.lastName,
                response.data.characterId,
                response.data.characterId
            )
        ), { 120, 255, 160 })
    end)
end, false)

RegisterCommand('playchar', function(_, args)
    if not args[1] then
        message(locale(
            'example.usagePlayCharacter',
            nil,
            'Usage: /playchar <characterId>'
        ))
        return
    end

    exports.fluxcore_core:CallAsync(
        'characters:select',
        { characterId = args[1] },
        function(response)
            if not response.ok then
                showError(response)
                return
            end
            message(locale(
                'example.loggedIn',
                {
                    firstName = response.data.profile.firstName,
                    lastName = response.data.profile.lastName
                },
                ('Logged in as %s %s.'):format(
                    response.data.profile.firstName,
                    response.data.profile.lastName
                )
            ), { 120, 255, 160 })
        end
    )
end, false)

RegisterCommand('logout', function()
    exports.fluxcore_core:CallAsync('session:logout', {}, function(response)
        if not response.ok then
            showError(response)
            return
        end
        message(locale('example.loggedOut', nil, 'Character logged out.'))
    end)
end, false)

RegisterCommand('whoami', function()
    local data = exports.fluxcore_core:GetPlayerData()
    if not data then
        message(locale(
            'example.notLoggedIn',
            nil,
            'No character is logged in.'
        ))
        return
    end
    local job = locale(
        ('labels.jobs.%s.label'):format(data.job.name),
        nil,
        data.job.label or data.job.name
    )
    message(locale(
        'example.identity',
        {
            firstName = data.profile.firstName,
            lastName = data.profile.lastName,
            cash = data.money.cash or 0,
            bank = data.money.bank or 0,
            job = job
        },
        ('%s %s | cash: %s | bank: %s | job: %s'):format(
            data.profile.firstName,
            data.profile.lastName,
            data.money.cash or 0,
            data.money.bank or 0,
            job
        )
    ))
end, false)

RegisterNetEvent('fluxcore_example:client:message', function(text, success)
    message(text, success and { 120, 255, 160 } or { 255, 100, 100 })
end)

RegisterCommand('interactdemo', function()
    CreateThread(function()
        local selected = exports.fluxcore_interact:OpenMenu({
            title = 'Fluxcore Interact',
            description = 'Basic developer preview. The web layer is replaceable.',
            options = {
                {
                    id = 'progress',
                    label = 'Run progress example',
                    description = 'Shows a cancellable three-second action.'
                },
                {
                    id = 'input',
                    label = 'Run input example',
                    description = 'Shows the shared text dialog.'
                }
            }
        })
        if not selected then
            return
        end

        if selected.id == 'progress' then
            local completed = exports.fluxcore_interact:Progress({
                label = 'Testing progress',
                duration = 3000,
                canCancel = true,
                disable = { move = true, combat = true }
            })
            exports.fluxcore_interact:Notify({
                title = 'Fluxcore Interact',
                description = completed and 'Progress completed' or 'Progress cancelled',
                type = completed and 'success' or 'warning'
            })
            return
        end

        local value = exports.fluxcore_interact:InputDialog({
            title = 'Fluxcore Interact',
            label = 'Test value',
            placeholder = 'Write something',
            required = true,
            maxLength = 64
        })
        if value then
            exports.fluxcore_interact:Notify({
                title = 'Submitted value',
                description = value,
                type = 'success'
            })
        end
    end)
end, false)

local function testNotify(title, description, kind)
    exports.fluxcore_interact:Notify({
        title = title,
        description = description,
        type = kind or 'inform',
        duration = 5000
    })
end

local function openTestAtm()
    CreateThread(function()
        local selected = exports.fluxcore_interact:OpenMenu({
            title = 'Test ATM',
            description = 'Interaction preview only — no money is changed.',
            options = {
                {
                    id = 'balance',
                    label = 'Show test balance',
                    description = 'Displays a notification.'
                },
                {
                    id = 'withdraw',
                    label = 'Test withdrawal',
                    description = 'Opens the shared input dialog.'
                }
            }
        })
        if not selected then
            return
        end
        if selected.id == 'balance' then
            testNotify('Test ATM', 'Test balance: $12,500', 'success')
            return
        end
        local amount = exports.fluxcore_interact:InputDialog({
            title = 'Test withdrawal',
            label = 'Amount',
            placeholder = '500',
            required = true,
            maxLength = 8
        })
        if amount then
            testNotify(
                'Test ATM',
                ('$%s entered — no money was changed.'):format(amount),
                'warning'
            )
        end
    end)
end

local testInteractionIds = {
    'fluxcore_example:test_atms',
    'fluxcore_example:test_vending',
    'fluxcore_example:test_payphones',
    'fluxcore_example:test_fuel_pumps',
    'fluxcore_example:test_vehicles',
    'fluxcore_example:test_peds'
}

local function registerTestInteractions()
    if GetResourceState('fluxcore_interact') ~= 'started' then
        return
    end

    for _, id in ipairs(testInteractionIds) do
        exports.fluxcore_interact:RemoveInteraction(id)
    end

    exports.fluxcore_interact:AddModel({
        id = 'fluxcore_example:test_atms',
        models = {
            GetHashKey('prop_atm_01'),
            GetHashKey('prop_atm_02'),
            GetHashKey('prop_atm_03'),
            GetHashKey('prop_atm_04'),
            GetHashKey('prop_fleeca_atm'),
            GetHashKey('hei_prop_hei_atm_01'),
            GetHashKey('hei_prop_hei_atm_02')
        },
        distance = 3.5,
        options = {
            {
                id = 'use',
                label = 'Use test ATM',
                distance = 3.5,
                onSelect = openTestAtm
            }
        }
    })

    exports.fluxcore_interact:AddModel({
        id = 'fluxcore_example:test_vending',
        models = {
            GetHashKey('prop_vend_soda_01'),
            GetHashKey('prop_vend_soda_02'),
            GetHashKey('prop_vend_water_01'),
            GetHashKey('prop_vend_coffe_01'),
            GetHashKey('prop_vend_snak_01'),
            GetHashKey('prop_vend_snak_01_tu'),
            GetHashKey('prop_vend_fridge01')
        },
        distance = 3.0,
        options = {
            {
                id = 'buy',
                label = 'Buy test soda',
                distance = 3.0,
                onSelect = function()
                    CreateThread(function()
                        local completed = exports.fluxcore_interact:Progress({
                            label = 'Buying soda',
                            duration = 2500,
                            canCancel = true,
                            disable = { move = true, combat = true }
                        })
                        testNotify(
                            'Vending machine',
                            completed
                                and 'Test purchase completed — no money was changed.'
                                or 'Test purchase cancelled.',
                            completed and 'success' or 'warning'
                        )
                    end)
                end
            }
        }
    })

    exports.fluxcore_interact:AddModel({
        id = 'fluxcore_example:test_payphones',
        models = {
            GetHashKey('prop_phonebox_01a'),
            GetHashKey('prop_phonebox_01b'),
            GetHashKey('prop_phonebox_01c'),
            GetHashKey('prop_phonebox_02'),
            GetHashKey('prop_phonebox_03'),
            GetHashKey('prop_phonebox_04')
        },
        distance = 3.0,
        options = {
            {
                id = 'call',
                label = 'Use test payphone',
                distance = 3.0,
                onSelect = function()
                    testNotify(
                        'Payphone',
                        'Test call connected. No phone data was changed.',
                        'success'
                    )
                end
            }
        }
    })

    exports.fluxcore_interact:AddModel({
        id = 'fluxcore_example:test_fuel_pumps',
        models = {
            GetHashKey('prop_gas_pump_1a'),
            GetHashKey('prop_gas_pump_1b'),
            GetHashKey('prop_gas_pump_1c'),
            GetHashKey('prop_gas_pump_1d'),
            GetHashKey('prop_gas_pump_old2'),
            GetHashKey('prop_gas_pump_old3')
        },
        distance = 3.5,
        options = {
            {
                id = 'inspect',
                label = 'Inspect fuel pump',
                distance = 3.5,
                onSelect = function()
                    testNotify(
                        'Fuel pump',
                        'Test interaction only. No fuel was changed.',
                        'inform'
                    )
                end
            }
        }
    })

    exports.fluxcore_interact:AddGlobalVehicle({
        id = 'fluxcore_example:test_vehicles',
        distance = 3.0,
        options = {
            {
                id = 'inspect',
                label = 'Inspect vehicle',
                onSelect = function(context)
                    local entity = context.entity
                    local exists = entity ~= 0 and DoesEntityExist(entity)
                    if exists ~= true and exists ~= 1 then
                        return
                    end
                    local model = GetDisplayNameFromVehicleModel(
                        GetEntityModel(entity)
                    )
                    local plate = GetVehicleNumberPlateText(entity)
                    testNotify(
                        'Vehicle inspection',
                        ('Model: %s | Plate: %s'):format(model, plate),
                        'inform'
                    )
                end
            },
            {
                id = 'action',
                label = 'Run test action',
                description = 'Shows a cancellable progress action.',
                onSelect = function()
                    CreateThread(function()
                        local completed = exports.fluxcore_interact:Progress({
                            label = 'Inspecting vehicle',
                            duration = 3000,
                            canCancel = true,
                            disable = { move = true, combat = true }
                        })
                        testNotify(
                            'Vehicle interaction',
                            completed and 'Inspection completed.' or 'Inspection cancelled.',
                            completed and 'success' or 'warning'
                        )
                    end)
                end
            }
        }
    })

    exports.fluxcore_interact:AddGlobalPed({
        id = 'fluxcore_example:test_peds',
        distance = 3.0,
        options = {
            {
                id = 'inspect',
                label = 'Inspect pedestrian',
                onSelect = function(context)
                    local entity = context.entity
                    local exists = entity ~= 0 and DoesEntityExist(entity)
                    if exists ~= true and exists ~= 1 then
                        return
                    end
                    testNotify(
                        'Pedestrian',
                        ('Model hash: %s'):format(GetEntityModel(entity)),
                        'inform'
                    )
                end
            }
        }
    })

    print(
        '[fluxcore_example] Test interactions registered for ATMs, vending machines, '
        .. 'payphones, fuel pumps, vehicles, and pedestrians.'
    )
end

local registrationAttempt = 0

local function scheduleTestInteractionRegistration()
    registrationAttempt = registrationAttempt + 1
    local attempt = registrationAttempt
    CreateThread(function()
        for _ = 1, 20 do
            if attempt ~= registrationAttempt then
                return
            end
            if GetResourceState('fluxcore_interact') == 'started' then
                local ok, reason = pcall(registerTestInteractions)
                if ok then
                    return
                end
                print((
                    '[fluxcore_example] Waiting to register test interactions: %s'
                ):format(reason))
            end
            Wait(250)
        end
        print('[fluxcore_example] Failed to register test interactions after 20 attempts.')
    end)
end

scheduleTestInteractionRegistration()

AddEventHandler('onClientResourceStart', function(resource)
    if resource == 'fluxcore_interact' then
        scheduleTestInteractionRegistration()
    end
end)

local function locale(key, replacements, fallback)
    return exports.fluxcore_core:Locale(key, replacements, fallback)
end
