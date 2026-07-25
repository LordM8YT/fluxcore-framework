fx_version 'cerulean'
game 'gta5'

name 'nord_services'
author 'Nord Framework contributors'
description 'Service rosters and secure invoicing for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_jobs',
    'nord_banking',
    'nord_businesses'
}

files {
    'config/services.json'
}

client_script 'client/main.lua'
server_script 'server.js'
