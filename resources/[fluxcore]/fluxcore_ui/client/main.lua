local function money(value)
    local amount = math.floor(tonumber(value) or 0)
    local formatted = tostring(math.abs(amount))
    while true do
        local changed
        formatted, changed = formatted:gsub('^(%-?%d+)(%d%d%d)', '%1 %2')
        if changed == 0 then break end
    end
    return (amount < 0 and '-$' or '$') .. formatted
end

local function notify(title, description, kind)
    exports.fluxcore_interact:Notify({
        title = title,
        description = tostring(description or ''),
        type = kind or 'inform',
        duration = 4000
    })
end

local function errorMessage(title, response)
    notify(
        title,
        response and response.error and response.error.message
            or 'The request failed.',
        'error'
    )
end

local function input(title, label, placeholder)
    return exports.fluxcore_interact:InputDialog({
        title = title,
        label = label,
        placeholder = placeholder or '',
        required = true,
        maxLength = 64
    })
end

local function openReadOnly(title, description, options)
    exports.fluxcore_interact:OpenMenu({
        title = title,
        description = description,
        options = #options > 0 and options or {
            { id = 'empty', label = 'Nothing to show', disabled = true }
        }
    })
end

AddEventHandler('fluxcore_banking:client:open', function(snapshot)
    local account = snapshot and snapshot.account or {}
    local options = {
        {
            id = 'deposit',
            label = 'Deposit',
            description = 'Move cash into this account'
        },
        {
            id = 'withdraw',
            label = 'Withdraw',
            description = 'Move money from the account to cash'
        },
        {
            id = 'transfer',
            label = 'Transfer',
            description = 'Send money to another account number'
        }
    }
    for index, transaction in ipairs(snapshot and snapshot.transactions or {}) do
        options[#options + 1] = {
            id = ('transaction:%s'):format(index),
            label = ('%s%s'):format(
                tonumber(transaction.delta) >= 0 and '+' or '',
                money(transaction.delta)
            ),
            description = transaction.reason or transaction.createdAt,
            disabled = true
        }
    end
    local selected = exports.fluxcore_interact:OpenMenu({
        title = ('Bank · %s'):format(money(snapshot and snapshot.balance)),
        description = account.accountNumber or 'Personal account',
        options = options
    })
    if not selected then return end

    if selected.id == 'deposit' or selected.id == 'withdraw' then
        local value = input(
            selected.id == 'deposit' and 'Deposit' or 'Withdraw',
            'Amount',
            '100'
        )
        if not value then return end
        local response = exports.fluxcore_banking:Request(selected.id, {
            amount = tonumber(value)
        })
        if response and response.ok then
            notify('Bank', 'Transaction completed.', 'success')
        else
            errorMessage('Bank', response)
        end
    elseif selected.id == 'transfer' then
        local accountNumber = input('Transfer', 'Account number', 'FLX0000000000')
        if not accountNumber then return end
        local value = input('Transfer', 'Amount', '100')
        if not value then return end
        local response = exports.fluxcore_banking:Request('transfer', {
            accountNumber = accountNumber,
            amount = tonumber(value)
        })
        if response and response.ok then
            notify('Bank', 'Transfer completed.', 'success')
        else
            errorMessage('Bank', response)
        end
    end
end)

AddEventHandler('fluxcore_businesses:client:open', function(snapshot)
    local options = {}
    for _, business in ipairs(snapshot and snapshot.businesses or {}) do
        options[#options + 1] = {
            id = business.id,
            label = business.name,
            description = ('%s · %s · %s'):format(
                business.typeLabel or business.type,
                business.membership and business.membership.roleLabel or 'Member',
                money(business.treasury)
            )
        }
    end
    local selected = exports.fluxcore_interact:OpenMenu({
        title = 'Businesses',
        description = 'Select the active business',
        options = #options > 0 and options or {
            { id = 'empty', label = 'No businesses', disabled = true }
        }
    })
    if selected and selected.id ~= 'empty' then
        local response = exports.fluxcore_businesses:Request('setActive', {
            businessId = selected.id
        })
        if response and response.ok then
            notify('Businesses', 'Active business updated.', 'success')
        else
            errorMessage('Businesses', response)
        end
    end
end)

AddEventHandler('fluxcore_dispatch:client:open', function(snapshot)
    local options = {}
    for _, call in ipairs(snapshot and snapshot.calls or {}) do
        options[#options + 1] = {
            id = call.id,
            label = ('P%s · %s'):format(call.priority or 3, call.title or call.service),
            description = ('%s · %s'):format(call.status, call.description or '')
        }
    end
    local selected = exports.fluxcore_interact:OpenMenu({
        title = 'Dispatch',
        description = 'Active emergency calls',
        options = #options > 0 and options or {
            { id = 'empty', label = 'No active calls', disabled = true }
        }
    })
    if not selected or selected.id == 'empty' then return end
    local action = exports.fluxcore_interact:OpenMenu({
        title = selected.label,
        options = {
            { id = 'call:assign', label = 'Assign myself' },
            { id = 'call:unassign', label = 'Unassign myself' },
            { id = 'call:close', label = 'Close call' }
        }
    })
    if not action then return end
    local response = exports.fluxcore_dispatch:Request(action.id, {
        callId = selected.id
    })
    if response and response.ok then
        notify('Dispatch', 'Call updated.', 'success')
    else
        errorMessage('Dispatch', response)
    end
end)

AddEventHandler('fluxcore_mdt:client:open', function(snapshot)
    local options = {}
    for _, warrant in ipairs(snapshot and snapshot.warrants or {}) do
        options[#options + 1] = {
            id = warrant.id,
            label = 'Warrant · ' .. warrant.subjectCharacterId,
            description = warrant.reason,
            disabled = true
        }
    end
    for _, bolo in ipairs(snapshot and snapshot.bolos or {}) do
        options[#options + 1] = {
            id = bolo.id,
            label = ('BOLO · %s'):format(bolo.value),
            description = bolo.reason,
            disabled = true
        }
    end
    for _, report in ipairs(snapshot and snapshot.reports or {}) do
        options[#options + 1] = {
            id = report.id,
            label = 'Report · ' .. report.title,
            description = report.narrative,
            disabled = true
        }
    end
    openReadOnly('MDT', 'Current records from the MDT database', options)
end)

AddEventHandler('fluxcore_properties:client:open', function(snapshot)
    local options = {}
    local properties = {}
    for _, property in ipairs(snapshot and snapshot.properties or {}) do
        properties[property.id] = property
        options[#options + 1] = {
            id = property.id,
            label = property.label,
            description = property.owned
                and (property.locked and 'Owned · Locked' or 'Owned · Unlocked')
                or ('For sale · %s'):format(money(property.price))
        }
    end
    local selected = exports.fluxcore_interact:OpenMenu({
        title = 'Properties',
        description = 'Owned properties and listings',
        options = #options > 0 and options or {
            { id = 'empty', label = 'No properties', disabled = true }
        }
    })
    if not selected or selected.id == 'empty' then return end
    local property = properties[selected.id]
    local actions = {}
    if not property.owned then
        actions[#actions + 1] = { id = 'purchase', label = 'Purchase' }
    elseif property.hasAccess then
        actions[#actions + 1] = {
            id = 'lock:set',
            label = property.locked and 'Unlock' or 'Lock'
        }
        actions[#actions + 1] = { id = 'storage:open', label = 'Open storage' }
    end
    local action = exports.fluxcore_interact:OpenMenu({
        title = property.label,
        options = #actions > 0 and actions or {
            { id = 'empty', label = 'No available actions', disabled = true }
        }
    })
    if not action or action.id == 'empty' then return end
    local payload = { propertyId = property.id }
    if action.id == 'lock:set' then payload.locked = not property.locked end
    local response = exports.fluxcore_properties:Request(action.id, payload)
    if response and response.ok then
        notify('Properties', 'Property updated.', 'success')
    else
        errorMessage('Properties', response)
    end
end)

AddEventHandler('fluxcore_services:client:open', function(snapshot)
    local options = {}
    local invoices = {}
    for _, invoice in ipairs(snapshot and snapshot.invoices
        and snapshot.invoices.received or {}) do
        invoices[invoice.id] = invoice
        options[#options + 1] = {
            id = invoice.id,
            label = ('Invoice · %s'):format(money(invoice.amount)),
            description = ('%s · %s'):format(invoice.status, invoice.description)
        }
    end
    for _, invoice in ipairs(snapshot and snapshot.invoices
        and snapshot.invoices.issued or {}) do
        invoices[invoice.id] = invoice
        options[#options + 1] = {
            id = invoice.id,
            label = ('Issued · %s'):format(money(invoice.amount)),
            description = ('%s · %s'):format(invoice.status, invoice.description)
        }
    end
    local selected = exports.fluxcore_interact:OpenMenu({
        title = 'Invoices',
        description = 'Issued and received invoices',
        options = #options > 0 and options or {
            { id = 'empty', label = 'No invoices', disabled = true }
        }
    })
    local invoice = selected and invoices[selected.id]
    if not invoice or invoice.status ~= 'pending' then return end
    local action = exports.fluxcore_interact:OpenMenu({
        title = selected.label,
        options = {
            { id = 'invoice:pay', label = 'Pay invoice' },
            { id = 'invoice:cancel', label = 'Cancel invoice' }
        }
    })
    if not action then return end
    local response = exports.fluxcore_services:Request(action.id, {
        invoiceId = invoice.id
    })
    if response and response.ok then
        notify('Invoices', 'Invoice updated.', 'success')
    else
        errorMessage('Invoices', response)
    end
end)

AddEventHandler('fluxcore_world:client:open', function(snapshot)
    local options = {}
    for _, shop in ipairs(snapshot and snapshot.shops or {}) do
        local count = 0
        for _ in pairs(shop.items or {}) do count = count + 1 end
        options[#options + 1] = {
            id = 'shop:' .. shop.id,
            label = shop.label,
            description = ('Shop · %s items'):format(count),
            disabled = true
        }
    end
    for _, dealership in ipairs(snapshot and snapshot.dealerships or {}) do
        local count = 0
        for _ in pairs(dealership.vehicles or {}) do count = count + 1 end
        options[#options + 1] = {
            id = 'dealership:' .. dealership.id,
            label = dealership.label,
            description = ('Dealership · %s vehicles'):format(count),
            disabled = true
        }
    end
    for _, door in ipairs(snapshot and snapshot.doors or {}) do
        options[#options + 1] = {
            id = 'door:' .. door.id,
            label = door.label,
            description = door.locked and 'Locked' or 'Unlocked',
            disabled = true
        }
    end
    openReadOnly('World', 'Nearby configured services and doors', options)
end)
