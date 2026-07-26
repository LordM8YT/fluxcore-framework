fx_version 'cerulean'
game 'gta5'

name 'fluxcore_inventory'
author 'Fluxcore Framework contributors'
description 'Server-authoritative inventory primitives for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

files {
    'config/items.json',
    'config/ui.json'
}

client_script 'client/main.lua'
server_script 'server.js'
