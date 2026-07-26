fx_version 'cerulean'
game 'gta5'

name 'fluxcore_starter'
author 'Your name or organization'
description 'Starter resource for Fluxcore Framework'
version '1.0.0'
license 'MIT'

dependency 'fluxcore_core'

shared_script 'shared/config.lua'
client_script 'client/main.lua'
server_script 'server/main.lua'

-- NUI is intentionally opt-in. Uncomment these lines after adding your web UI:
-- ui_page 'web/index.html'
-- files {
--     'web/index.html',
--     'web/assets/**/*'
-- }
