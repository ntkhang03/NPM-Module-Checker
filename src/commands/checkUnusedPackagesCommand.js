const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const scanDependenciesUsed = require("../utils/scanDependenciesUsed.js");
const { outputChannel, showOutput } = require("../utils/outputChannel.js");

function checkUnusedPackagesCommand() {
  const packageJsonPath = path.join(vscode.workspace.rootPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    vscode.window.showErrorMessage("No package.json found in the workspace.");
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const dependencies = Object.keys(packageJson.dependencies || {});
  const usedPackages = scanDependenciesUsed(
    dependencies,
    vscode.workspace.rootPath
  );

  const usedPackagesKeys = Object.keys(usedPackages);
  const unusedPackages = dependencies.filter(
    (pkg) => !usedPackagesKeys.includes(pkg)
  );
  if (unusedPackages.length > 0) {
    vscode.window
      .showInformationMessage(
        `Found ${unusedPackages.length} unused packages. Check the output channel for details.`,
        "Show Output",
        "OK"
      )
      .then((answer) => {
        if (answer === "Show Output") {
          outputChannel.show();
        }
      });

    showOutput(
      `\n[Check Unused Packages] Found ${unusedPackages.length} unused packages:`,
      false
    );
    unusedPackages.forEach((pkg) => {
      showOutput(`- ${pkg}`, false);
    });
  } else {
    vscode.window.showInformationMessage("No unused packages found.");
    showOutput(`\n[Check Unused Packages] No unused packages found.`, false);
  }

  showOutput(
    `\n[Check Unused Packages] Number of times each package is used:`,
    false
  );
  for (const pkg in usedPackages) {
    showOutput(`- ${pkg}: ${usedPackages[pkg]}`, false);
  }
}

module.exports = checkUnusedPackagesCommand;
