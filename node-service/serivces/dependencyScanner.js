// node-service/services/dependencyScanner.js

const semver = require('semver');
const axiosInstance = require('../utils/axiosLogger');
const logger = require('../utils/logger');

/**
 * Extract direct dependencies from a package.json object.
 * This merges dependencies and devDependencies, but you can separate them if you want.
 */
function parsePackageJson(pkgJson) {
  logger.info('Parsing package.json:', pkgJson);
  const deps = pkgJson[0].dependencies || {};
  const devDeps = pkgJson[0].devDependencies || {};
  const all = { ...deps, ...devDeps };

  logger.debug('All dependencies:', all);

  return Object.entries(all).map(([packageName, currentVersion]) => ({
    packageName,
    currentVersion,
  }));
}

/**
 * Fetch the latest version for a package from npm registry.
 */
async function fetchLatestVersion(packageName) {
  logger.info(`Fetching latest version for ${packageName}`);
  try {
    const response = await axiosInstance.get(
      `https://registry.npmjs.org/${packageName}`
    );
    return response.data['dist-tags'].latest;
  } catch (error) {
    console.error(
      `Error fetching latest version for ${packageName}:`,
      error.message
    );
    return null;
  }
}

/**
 * Compare currentVersion vs. latestVersion using semver logic.
 * Return an object for each dependency with isOutdated, etc.
 */
async function scanDependencies(pkgJson) {
  logger.info('Scanning dependencies:', pkgJson);
  const depsArray = parsePackageJson(pkgJson);
  logger.debug('Parsed dependencies:', depsArray);
  const results = [];

  for (const dep of depsArray) {
    // Remove ^ or ~
    const cleanedCurrent = dep.currentVersion.replace(/^[^\d]+/, '');
    let latestVersion = null;
    let isOutdated = false;

    // Attempt to fetch the latest version
    latestVersion = await fetchLatestVersion(dep.packageName);

    if (
      latestVersion &&
      semver.valid(cleanedCurrent) &&
      semver.valid(latestVersion)
    ) {
      isOutdated = semver.lt(cleanedCurrent, latestVersion);
    }

    results.push({
      packageName: dep.packageName,
      currentVersion: dep.currentVersion,
      latestVersion: latestVersion || 'unknown',
      isOutdated,
    });
  }
  logger.info('Scan results:', results);
  return results;
}

module.exports = {
  parsePackageJson,
  scanDependencies,
};
