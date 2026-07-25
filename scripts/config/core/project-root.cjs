const { existsSync, statSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

function findProjectRoot(startDirectory = __dirname) {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    const packageJsonPath = join(currentDirectory, 'package.json');
    const backendPath = join(currentDirectory, 'backend');
    const frontendPath = join(currentDirectory, 'frontend');

    if (
      existsSync(packageJsonPath) &&
      isDirectory(backendPath) &&
      isDirectory(frontendPath)
    ) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      throw new Error(
        'Project root was not found. Expected package.json, backend and frontend directories.',
      );
    }

    currentDirectory = parentDirectory;
  }
}

function getRootEnvPath(projectRoot = findProjectRoot()) {
  return join(projectRoot, '.env');
}

function getRootEnvExamplePath(projectRoot = findProjectRoot()) {
  return join(projectRoot, '.env.example');
}

function isDirectory(targetPath) {
  try {
    return statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

module.exports = {
  findProjectRoot,
  getRootEnvExamplePath,
  getRootEnvPath,
};
