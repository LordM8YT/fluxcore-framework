fx_version 'cerulean'
game 'gta5'

name 'varde_properties'
author 'Varde Framework contributors'
description 'Property ownership, access, locks, and storage for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_inventory',
    'varde_banking',
    'varde_vehicles'
}

files {
    'config/properties.json'
}

client_script 'client/main.lua'
server_script 'server.js'
