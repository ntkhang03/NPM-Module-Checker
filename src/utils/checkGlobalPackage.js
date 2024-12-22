const fs = require("fs");
const path = require("path");

// Check if a package is installed globally by looking in npm's global root
function checkGlobalPackage(globalNodeModulesPath, modulePath) {
  try {
    const packagePath = path.join(globalNodeModulesPath, modulePath);
    return fs.existsSync(packagePath);
  } catch (error) {
    return false;
  }
}

module.exports = checkGlobalPackage;
