fx_version 'cerulean'
game 'gta5'

name 'nord_world'
author 'Nord Framework contributors'
description 'Shops, dealerships, and persistent doors for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_jobs',
    'nord_inventory',
    'nord_vehicles',
    'nord_banking'
}

files {
    'config/world.json'
}

client_script 'client/main.lua'
server_script 'server.js'
