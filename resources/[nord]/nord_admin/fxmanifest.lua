fx_version 'cerulean'
game 'gta5'

name 'nord_admin'
author 'Nord Framework contributors'
description 'ACE-secured administration for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'nord_core'

ui_page 'web/index.html'

files {
    'config/admin.json',
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_script 'client/main.lua'
server_script 'server.js'
