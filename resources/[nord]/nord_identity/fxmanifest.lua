fx_version 'cerulean'
game 'gta5'

name 'nord_identity'
author 'Nord Framework contributors'
description 'Character selection and identity UI for Varde Framework'
version '0.1.0'
license 'MIT'

dependency 'nord_core'

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
