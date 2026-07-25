fx_version 'cerulean'
game 'gta5'

name 'nord_phone'
author 'Nord Framework contributors'
description 'Text-first phone for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'nord_core'

ui_page 'web/index.html'

files {
    'config/phone.json',
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_script 'client/main.lua'
server_script 'server.js'
