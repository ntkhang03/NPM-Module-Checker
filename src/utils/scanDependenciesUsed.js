const fs = require("fs");
const path = require("path");
const generateRegexCheckImport = require("./generateRegexCheckImport.js");
const { extJs } = require("./constants.js");

function scanDependenciesUsed(dependencies, dir, usedPackages = {}) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      scanDependenciesUsed(dependencies, filePath, usedPackages);
    } else if (extJs.includes(file.split(".").pop())) {
      const codeSnippet = fs.readFileSync(filePath, "utf-8");
      const regex = generateRegexCheckImport(dependencies);
      const matches = [...codeSnippet.matchAll(regex)].map((match) => match[0]);

      for (const pkg of dependencies) {
        if (matches.some((match) => match.includes(pkg))) {
          if (!usedPackages[pkg]) {
            usedPackages[pkg] = 1;
          } else {
            usedPackages[pkg]++;
          }
        }
      }
    }
  });

  return usedPackages;
}

module.exports = scanDependenciesUsed;
