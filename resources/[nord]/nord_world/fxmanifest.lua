fx_version 'cerulean'
game 'gta5'

name 'varde_world'
author 'Varde Framework contributors'
description 'Shops, dealerships, and persistent doors for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_jobs',
    'varde_inventory',
    'varde_vehicles',
    'varde_banking'
}

files {
    'config/world.json'
}

client_script 'client/main.lua'
server_script 'server.js'
