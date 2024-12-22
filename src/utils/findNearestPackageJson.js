const fs = require("fs");
const path = require("path");

// Find the nearest package.json file for a given file path
function findNearestPackageJson(filePath) {
  let currentDir = path.dirname(filePath);
  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
    currentDir = path.dirname(currentDir);
  }
  return null;
}

module.exports = findNearestPackageJson;
