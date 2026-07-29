fx_version 'cerulean'
game 'gta5'

name 'fluxcore_chat'
author 'Fluxcore Framework contributors'
description 'Replaceable roleplay chat for Fluxcore Framework'
version '0.1.0'
license 'MIT'

dependency 'fluxcore_core'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_script 'client/main.lua'
server_script 'server.lua'
