fx_version 'cerulean'
game 'gta5'

name 'fluxcore_properties'
author 'Fluxcore Framework contributors'
description 'Property ownership, access, locks, and storage for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_inventory',
    'fluxcore_banking',
    'fluxcore_vehicles'
}

files {
    'config/properties.json'
}

client_script 'client/main.lua'
server_script 'server.js'
