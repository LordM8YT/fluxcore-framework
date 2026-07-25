fx_version 'cerulean'
game 'gta5'

name 'nord_properties'
author 'Nord Framework contributors'
description 'Property ownership, access, locks, and storage for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_inventory',
    'nord_banking',
    'nord_vehicles'
}

files {
    'config/properties.json'
}

client_script 'client/main.lua'
server_script 'server.js'
