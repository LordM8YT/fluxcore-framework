fx_version 'cerulean'
game 'gta5'

name 'fluxcore_identity'
author 'Fluxcore Framework contributors'
description 'Character selection and identity UI for Fluxcore Framework'
version '0.1.0'
license 'MIT'

dependency 'fluxcore_core'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_scripts {
    'config.lua',
    'client.lua'
}
