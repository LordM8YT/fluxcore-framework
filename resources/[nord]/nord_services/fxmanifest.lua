fx_version 'cerulean'
game 'gta5'

name 'varde_services'
author 'Varde Framework contributors'
description 'Service rosters and secure invoicing for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_jobs',
    'varde_banking',
    'varde_businesses'
}

files {
    'config/services.json'
}

client_script 'client/main.lua'
server_script 'server.js'
