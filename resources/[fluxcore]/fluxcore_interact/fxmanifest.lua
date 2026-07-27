fx_version 'cerulean'
game 'gta5'

name 'fluxcore_interact'
author 'Fluxcore Framework contributors'
description 'Shared interactions, menus, dialogs, notifications, and progress UI for Fluxcore'
version '0.1.0'
license 'MIT'

dependency 'fluxcore_core'

ui_page 'web/index.html'

files {
    'config/interact.json',
    'web/index.html',
    'web/styles.css',
    'web/app.js'
}

client_script 'client/main.lua'
