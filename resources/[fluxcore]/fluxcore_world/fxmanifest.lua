fx_version 'cerulean'
game 'gta5'

name 'fluxcore_world'
author 'Fluxcore Framework contributors'
description 'Shops, dealerships, and persistent doors for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_jobs',
    'fluxcore_inventory',
    'fluxcore_vehicles',
    'fluxcore_banking'
}

files {
    'config/world.json'
}

client_script 'client/main.lua'
server_script 'server.js'
