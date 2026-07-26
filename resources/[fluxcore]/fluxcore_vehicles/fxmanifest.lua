fx_version 'cerulean'
game 'gta5'

name 'fluxcore_vehicles'
author 'Fluxcore Framework contributors'
description 'Persistent vehicle ownership, keys, garages, and trunks for Fluxcore'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_inventory'
}

files {
    'config/vehicles.json'
}

client_script 'client/main.lua'
server_script 'server.js'
