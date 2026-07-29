fx_version 'cerulean'
game 'gta5'

name 'fluxcore_voice'
author 'Fluxcore Framework contributors'
description 'Server-owned Enhanced voice foundation for Fluxcore Framework'
version '0.1.0'
license 'MIT'

dependency 'fluxcore_core'

files {
    'config/voice.json'
}

client_script 'client/main.lua'
server_script 'server.lua'
