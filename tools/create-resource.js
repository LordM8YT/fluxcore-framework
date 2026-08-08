'use strict';

const fs = require('node:fs');
const path = require('node:path');

const NAME_PATTERN = /^[a-z][a-z0-9_]{2,47}$/u;

function usage() {
  return 'Usage: npm run create:resource -- <resource_name> [destination]';
}

function copyTemplate(templateRoot, destination, resourceName) {
  for (const entry of fs.readdirSync(templateRoot, { withFileTypes: true })) {
    const source = path.join(templateRoot, entry.name);
    const target = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(target);
      copyTemplate(source, target, resourceName);
      continue;
    }
    const content = fs.readFileSync(source, 'utf8')
      .replaceAll('fluxcore_starter', resourceName)
      .replace(
        "description 'Starter resource for Fluxcore Framework'",
        `description '${resourceName} resource for Fluxcore Framework'`,
      );
    fs.writeFileSync(target, content, 'utf8');
  }
}

function createResource(resourceName, requestedDestination) {
  if (!NAME_PATTERN.test(resourceName || '')) {
    throw new Error('name must match ^[a-z][a-z0-9_]{2,47}$');
  }
  const root = path.resolve(__dirname, '..');
  const destination = requestedDestination
    ? path.resolve(requestedDestination)
    : path.join(root, 'resources', '[local]', resourceName);
  if (fs.existsSync(destination)) {
    throw new Error(`destination already exists: ${destination}`);
  }
  fs.mkdirSync(destination, { recursive: true });
  try {
    copyTemplate(path.join(root, 'templates', 'fluxcore_resource'), destination, resourceName);
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

if (require.main === module) {
  try {
    const destination = createResource(process.argv[2], process.argv[3]);
    console.log(`Created ${process.argv[2]} at ${destination}`);
    console.log(`Add "ensure ${process.argv[2]}" after its dependencies.`);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
  }
}

module.exports = { createResource, NAME_PATTERN };
