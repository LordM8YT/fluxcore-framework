fx_version 'cerulean'
game 'gta5'

name 'fluxcore_fuel'
author 'Fluxcore Framework contributors'
description 'Native fuel consumption and server-authorized refuelling for Fluxcore'
version '0.1.0'
license 'MIT'

node_version '26'

dependencies {
    'fluxcore_core',
    'fluxcore_interact',
    'fluxcore_inventory'
}

files {
    'config/fuel.json'
}

client_script 'client/main.lua'
server_script 'server.js'
