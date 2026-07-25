fx_version 'cerulean'
game 'gta5'

name 'nord_inventory'
author 'Nord Framework contributors'
description 'Server-authoritative inventory primitives for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'nord_core'

files {
    'config/items.json',
    'config/ui.json'
}

client_script 'client/main.lua'
server_script 'server.js'
