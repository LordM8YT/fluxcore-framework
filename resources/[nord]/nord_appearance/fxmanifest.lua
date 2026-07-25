fx_version 'cerulean'
game 'gta5'

name 'nord_appearance'
author 'Nord Framework contributors'
description 'Persistent, UI-independent character appearance for Varde'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'nord_core'

files {
    'config/appearance.json'
}

client_script 'client/main.lua'
server_script 'server.js'
