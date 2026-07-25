fx_version 'cerulean'
game 'gta5'

name 'nord_vehicles'
author 'Nord Framework contributors'
description 'Persistent vehicle ownership, keys, garages, and trunks for Varde'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_inventory'
}

files {
    'config/vehicles.json'
}

client_script 'client/main.lua'
server_script 'server.js'
