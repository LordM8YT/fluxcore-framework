fx_version 'cerulean'
game 'gta5'

name 'nord_core'
author 'Nord Framework contributors'
description 'Nord Framework core for FiveM Enhanced'
version '0.1.0'
license 'MIT'

-- FiveM for GTAV Enhanced ships with Node 26 on the server.
node_version '26'

dependencies {
    '/onesync',
    'spawnmanager'
}

files {
    'config/defaults.json',
    'locales/*.json'
}

client_script 'client/main.lua'
server_script 'server.js'
