fx_version 'cerulean'
game 'gta5'

name 'fluxcore_businesses'
author 'Fluxcore Framework contributors'
description 'Player-owned businesses, staff roles, and treasuries for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_jobs',
    'fluxcore_banking'
}

files {
    'config/businesses.json'
}

client_script 'client/main.lua'
server_script 'server.js'
