fx_version 'cerulean'
game 'gta5'

name 'varde_dispatch'
author 'Varde Framework contributors'
description 'Server-authoritative emergency dispatch for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_jobs',
    'varde_services'
}

files {
    'config/dispatch.json'
}

client_script 'client/main.lua'
server_script 'server.js'
