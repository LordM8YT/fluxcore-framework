fx_version 'cerulean'
game 'gta5'

name 'fluxcore_jobs'
author 'Fluxcore Framework contributors'
description 'Jobs, grades, duty, and permissions for Fluxcore Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'fluxcore_core'

files {
    'config/jobs.json'
}

client_script 'client/main.lua'
server_script 'server.js'
