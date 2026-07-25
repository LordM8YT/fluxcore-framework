fx_version 'cerulean'
game 'gta5'

name 'nord_banking'
author 'Nord Framework contributors'
description 'Server-authoritative personal banking for Varde Framework'
version '0.1.0'
license 'MIT'

node_version '26'

dependency 'nord_core'

files {
    'config/banking.json'
}

client_script 'client/main.lua'
server_script 'server.js'
