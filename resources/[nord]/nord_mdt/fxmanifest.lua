fx_version 'cerulean'
game 'gta5'

name 'varde_mdt'
author 'Varde Framework contributors'
description 'Police records and mobile data terminal backend for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'varde_core',
    'varde_jobs',
    'varde_vehicles',
    'varde_dispatch'
}

files {
    'config/mdt.json'
}

client_script 'client/main.lua'
server_script 'server.js'
