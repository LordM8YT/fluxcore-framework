fx_version 'cerulean'
game 'gta5'

name 'fluxcore_esx_bridge'
author 'Fluxcore Framework contributors'
description 'Experimental ESX porting provider backed by Fluxcore'
version '0.1.0'
license 'MIT'

provide 'es_extended'

dependencies {
    'fluxcore_core',
    'fluxcore_bridge',
    'fluxcore_jobs',
    'fluxcore_inventory'
}

server_script 'server.lua'
