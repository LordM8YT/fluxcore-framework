fx_version 'cerulean'
game 'gta5'

name 'fluxcore_appearance'
author 'Fluxcore Framework contributors'
description 'Persistent, UI-independent character appearance for Fluxcore'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

files {
    'config/appearance.json'
}

client_script 'client/main.lua'
server_script 'server.js'
