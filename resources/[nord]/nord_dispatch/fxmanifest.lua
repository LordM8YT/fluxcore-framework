fx_version 'cerulean'
game 'gta5'

name 'nord_dispatch'
author 'Nord Framework contributors'
description 'Server-authoritative emergency dispatch for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_jobs',
    'nord_services'
}

files {
    'config/dispatch.json'
}

client_script 'client/main.lua'
server_script 'server.js'
