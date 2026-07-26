fx_version 'cerulean'
game 'gta5'

name 'fluxcore_services'
author 'Fluxcore Framework contributors'
description 'Service rosters and secure invoicing for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_jobs',
    'fluxcore_banking',
    'fluxcore_businesses'
}

files {
    'config/services.json'
}

client_script 'client/main.lua'
server_script 'server.js'
