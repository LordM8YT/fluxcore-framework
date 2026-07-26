Config = {
    -- Enables small diagnostic messages without adding an idle thread.
    debug = GetConvarInt('fluxcore_starter_debug', 0) == 1,

    -- RegisterCommand(..., true) protects this as command.fluxcorestatus.
    adminCommand = 'fluxcorestatus',

    -- Core-owned keys may be observed, but only the owning resource should set them.
    stateKeys = {
        job = 'fluxcore:job',
        status = 'fluxcore_starter:status'
    },

    defaultStatus = 'alive',

    -- A lookup table keeps validation cheap and easy to extend.
    validStatuses = {
        alive = true,
        incapacitated = true,
        dead = true
    }
}
