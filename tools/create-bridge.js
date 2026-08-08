'use strict';

const fs = require('node:fs');
const path = require('node:path');

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  }
}

function installBridge(requestedDestination) {
  if (!requestedDestination) {
    throw new Error('destination framework/bridge directory is required');
  }
  const root = path.resolve(__dirname, '..');
  const destinationRoot = path.resolve(requestedDestination);
  const destination = path.join(destinationRoot, 'fluxcore');
  if (fs.existsSync(destination)) {
    throw new Error(`destination already exists: ${destination}`);
  }
  copyDirectory(
    path.join(root, 'templates', 'multiframework_bridge', 'fluxcore'),
    destination,
  );
  return destination;
}

if (require.main === module) {
  try {
    const destination = installBridge(process.argv[2]);
    console.log(`Installed Fluxcore bridge adapter at ${destination}`);
    console.log("Set the resource framework to 'Fluxcore' and add dependency 'fluxcore_bridge'.");
  } catch (error) {
    console.error(error.message);
    console.error('Usage: npm run create:bridge -- <resource-framework-directory>');
    process.exitCode = 1;
  }
}

module.exports = { installBridge };
