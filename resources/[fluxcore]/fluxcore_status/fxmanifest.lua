fx_version 'cerulean'
game 'gta5'

name 'fluxcore_status'
author 'Fluxcore Framework contributors'
description 'Persistent needs and HUD data provider for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

files {
    'config/status.json'
}

client_script 'client/main.lua'
server_script 'server.js'
