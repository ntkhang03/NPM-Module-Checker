const vscode = require("vscode");
const fs = require("fs");
const processDiagnostics = require("../utils/processDiagnostics.js");
const { showOutput, outputChannel } = require("../utils/outputChannel.js");
const generateFolderCommands = require("./generateFolderCommands.js");
const handleError = require("../utils/handleError.js");

function registerCommands(
  createFileCommand,
  diagnosticsByFile,
  checkDocument,
  installPackageCommand,
  installMissingPackagesFixCommand,
  uninstallPackageCommand,
  uninstallAllUnusedPackagesCommand
) {
  return [
    vscode.commands.registerCommand(
      "npm-module-checker.createFile",
      createFileCommand
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.createAllMissingFiles",
      (document) => {
        const diagnostics = diagnosticsByFile.get(document.uri) || [];
        processDiagnostics(
          outputChannel,
          diagnostics,
          (issue) => issue.code === "create-file",
          (issue) => fs.writeFileSync(issue.packageNameOrFilePath, "", "utf-8"),
          (issue) => `Cannot create file: ${issue.packageNameOrFilePath}`
        );
        checkDocument(document, true);
      }
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installPackage",
      installPackageCommand
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installPackageAsDevDependency",
      (packageName, document) =>
        installPackageCommand(packageName, document, "--save-dev")
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installGlobalPackage",
      (packageName, document) =>
        installPackageCommand(packageName, document, "-g")
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installMissingPackagesFix",
      installMissingPackagesFixCommand
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installMissingPackagesGloballyFix",
      (document) => installMissingPackagesFixCommand(document, true)
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.uninstallPackage",
      (packageName, document) => uninstallPackageCommand(packageName, document)
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.uninstallAllUnusedPackages",
      (document) => uninstallAllUnusedPackagesCommand(document)
    ),
    ...generateFolderCommands(checkDocument, showOutput, handleError)
  ];
}

module.exports = registerCommands;
