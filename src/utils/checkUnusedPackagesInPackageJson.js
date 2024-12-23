const vscode = require("vscode");
const path = require("path");
const scanDependenciesUsed = require("./scanDependenciesUsed.js");
const createDiagnostic = require("./createDiagnostic.js");

// New function to check for unused packages
function checkUnusedPackagesInPackageJson(document, diagnosticCollection) {
  if (path.basename(document.fileName) != "package.json") {
    return;
  }

  const config = vscode.workspace.getConfiguration("npmModuleChecker");
  if (
    !config.get(
      "enableUnusedPackageCheck",
      config.inspect("enableUnusedPackageCheck").defaultValue
    )
  ) {
    diagnosticCollection.delete(document.uri);
    return;
  }

  const diagnosticSeverityUnusedPackage = config.get(
    "unusedPackageSeverity",
    config.inspect("unusedPackageSeverity").defaultValue
  );

  try {
    const packageJson = JSON.parse(document.getText());
    const dependencies = Object.keys(packageJson.dependencies || {});
    const usedPackages = scanDependenciesUsed(
      dependencies,
      path.dirname(document.fileName)
    );

    const usedPackagesKeys = Object.keys(usedPackages);
    const unusedPackages = dependencies.filter(
      (pkg) => !usedPackagesKeys.includes(pkg)
    );

    const dependenciesIndex = document.getText().indexOf("dependencies");
    const diagnostics = unusedPackages.map((pkg) => {
      const index = document.getText().indexOf(pkg, dependenciesIndex) - 1;
      const startPos = document.positionAt(index);
      const endPos = document.positionAt(index + pkg.length + 2);
      const range = new vscode.Range(startPos, endPos);

      return createDiagnostic(
        range,
        pkg,
        `The package "${pkg}" is not used in the project`,
        "uninstall-package",
        vscode.DiagnosticSeverity[diagnosticSeverityUnusedPackage],
        startPos.line,
        startPos.character,
        endPos.character
      );
    });

    diagnosticCollection.set(document.uri, diagnostics);
  } catch (error) {
    // handleError("Failed to parse package.json", error);
  }
}

module.exports = checkUnusedPackagesInPackageJson;
