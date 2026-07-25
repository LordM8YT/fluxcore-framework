fx_version 'cerulean'
game 'gta5'

name 'nord_mdt'
author 'Nord Framework contributors'
description 'Police records and mobile data terminal backend for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'nord_core',
    'nord_jobs',
    'nord_vehicles',
    'nord_dispatch'
}

files {
    'config/mdt.json'
}

client_script 'client/main.lua'
server_script 'server.js'
