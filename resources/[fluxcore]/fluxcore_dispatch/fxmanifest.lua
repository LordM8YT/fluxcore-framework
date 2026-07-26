fx_version 'cerulean'
game 'gta5'

name 'fluxcore_dispatch'
author 'Fluxcore Framework contributors'
description 'Server-authoritative emergency dispatch for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_jobs',
    'fluxcore_services'
}

files {
    'config/dispatch.json'
}

client_script 'client/main.lua'
server_script 'server.js'
