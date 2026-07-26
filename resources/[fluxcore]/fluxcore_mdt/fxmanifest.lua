fx_version 'cerulean'
game 'gta5'

name 'fluxcore_mdt'
author 'Fluxcore Framework contributors'
description 'Police records and mobile data terminal backend for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_jobs',
    'fluxcore_vehicles',
    'fluxcore_dispatch'
}

files {
    'config/mdt.json'
}

client_script 'client/main.lua'
server_script 'server.js'
