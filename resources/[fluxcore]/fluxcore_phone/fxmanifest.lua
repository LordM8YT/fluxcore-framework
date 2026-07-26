fx_version 'cerulean'
game 'gta5'

name 'fluxcore_phone'
author 'Fluxcore Framework contributors'
description 'Text-first phone for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

ui_page 'web/index.html'

files {
    'config/phone.json',
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_script 'client/main.lua'
server_script 'server.js'
