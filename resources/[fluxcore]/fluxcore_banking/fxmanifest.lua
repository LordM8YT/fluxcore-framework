fx_version 'cerulean'
game 'gta5'

name 'fluxcore_banking'
author 'Fluxcore Framework contributors'
description 'Server-authoritative personal banking for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

files {
    'config/banking.json'
}

client_script 'client/main.lua'
server_script 'server.js'
