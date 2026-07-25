fx_version 'cerulean'
game 'gta5'

name 'varde_businesses'
author 'Varde Framework contributors'
description 'Player-owned businesses, staff roles, and treasuries for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_jobs',
    'varde_banking'
}

files {
    'config/businesses.json'
}

client_script 'client/main.lua'
server_script 'server.js'
