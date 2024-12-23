const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const QuickFixProvider = require("./utils/QuickFixProvider.js");
const initCheckDocument = require("./utils/checkDocument.js");
const { outputChannel, showOutput } = require("./utils/outputChannel.js");
const handleError = require("./utils/handleError.js");
const checkDocumentAllTabs = require("./utils/checkDocumentAllTabs.js");
const executeCommand = require("./utils/executeCommand.js");
const processDiagnostics = require("./utils/processDiagnostics.js");
const checkUnusedPackagesInPackageJson = require("./utils/checkUnusedPackagesInPackageJson.js");
const generateFolderCommands = require("./commands/generateFolderCommands.js");
const checkUnusedPackagesCommand = require("./commands/checkUnusedPackagesCommand.js");
const validateIgnorePatternsCommand = require("./commands/validateIgnorePatternsCommand.js");
const registerCommands = require("./commands/registerCommands.js");

let globalNodeModulesPath;
const diagnosticsByFile = new Map();
const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("npm-module-checker");
let checkDocument;

function activate(context) {
  try {
    globalNodeModulesPath = execSync("npm root -g").toString().trim();
  } catch (error) {
    handleError("Failed to get global node_modules path", error);
    return;
  }

  checkDocument = initCheckDocument(
    globalNodeModulesPath,
    diagnosticsByFile,
    diagnosticCollection
  );

  const subscriptions = [
    vscode.workspace.onDidOpenTextDocument((doc) => {
      checkDocument(doc, true);
      console.log(path.basename(doc.fileName));
      if (path.basename(doc.fileName) === "package.json") {
        checkUnusedPackagesInPackageJson(doc, diagnosticCollection);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (path.basename(e.document.fileName) === "package.json") {
        checkDocumentAllTabs(checkDocument, diagnosticCollection);
        checkUnusedPackagesInPackageJson(e.document, diagnosticCollection);
      } else {
        checkDocument(e.document, true);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticCollection.delete(doc.uri)
    ),
    vscode.languages.registerCodeActionsProvider(
      ["javascript", "typescript", "json"],
      new QuickFixProvider(),
      {
        providedCodeActionKinds: QuickFixProvider.providedCodeActionKinds
      }
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.validateIgnorePatterns",
      validateIgnorePatternsCommand
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.checkUnusedPackages",
      checkUnusedPackagesCommand
    ),
    ...registerCommands(
      createFileCommand,
      diagnosticsByFile,
      checkDocument,
      installPackageCommand,
      installMissingPackagesFixCommand,
      uninstallPackageCommand,
      uninstallAllUnusedPackagesCommand
    )
  ];

  context.subscriptions.push(...subscriptions);
  checkDocumentAllTabs(checkDocument, diagnosticCollection);

  // listen when setting changes (npmModuleChecker)
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("npmModuleChecker")) {
      checkDocumentAllTabs(checkDocument, diagnosticCollection);
    }
  });
}

function createFileCommand(filePath) {
  processDiagnostics(
    outputChannel,
    [{ packageNameOrFilePath: filePath }],
    () => true,
    (issue) => fs.writeFileSync(issue.packageNameOrFilePath, "", "utf-8"),
    (issue) => `Cannot create file: ${issue.packageNameOrFilePath}`
  );
  checkDocumentAllTabs(checkDocument, diagnosticCollection);
}

function installPackageCommand(packageName, document, args = "") {
  const command = `npm install ${args} ${packageName}`.replace(/\s+/g, " ");
  executeCommand(
    command,
    global ? undefined : path.dirname(document.fileName),
    `Installing ${packageName}...`,
    () =>
      vscode.window.showInformationMessage(
        `Installed package: ${packageName} successfully`
      ),
    (error) => handleError(`Cannot install package "${packageName}"`, error)
  );
  checkDocumentAllTabs(checkDocument, diagnosticCollection);
}

function installMissingPackagesFixCommand(document, global = false) {
  const diagnostics = diagnosticsByFile.get(document.uri) || [];
  const packages = diagnostics
    .filter((issue) => issue.code.startsWith("install-package"))
    .map((issue) => issue.packageNameOrFilePath);
  const command = global
    ? `npm install -g ${packages.join(" ")}`
    : `npm install ${packages.join(" ")}`;

  executeCommand(
    command,
    global ? undefined : path.dirname(document.fileName),
    `Installing ${packages.length} missing packages...`,
    () =>
      vscode.window.showInformationMessage(
        `Installed ${packages.length} packages successfully`
      ),
    (error) =>
      handleError(`Cannot install packages: ${packages.join(", ")}`, error)
  );
  checkDocumentAllTabs(checkDocument, diagnosticCollection);
}

function uninstallPackageCommand(packageName, document) {
  const command = `npm uninstall ${packageName}`;
  executeCommand(
    command,
    path.dirname(document.fileName),
    `Uninstalling ${packageName}...`,
    () =>
      vscode.window.showInformationMessage(
        `Uninstalled package: ${packageName} successfully`
      ),
    (error) => handleError(`Cannot uninstall package "${packageName}"`, error)
  );
  checkDocumentAllTabs(checkDocument, diagnosticCollection);
}

function uninstallAllUnusedPackagesCommand(document) {
  const diagnostics = diagnosticsByFile.get(document.uri) || [];
  const packages = diagnostics
    .filter((issue) => issue.message.startsWith("Unused package"))
    .map((issue) => issue.message.split(": ")[1]);
  const command = `npm uninstall ${packages.join(" ")}`;

  executeCommand(
    command,
    path.dirname(document.fileName),
    `Uninstalling ${packages.length} unused packages...`,
    () =>
      vscode.window.showInformationMessage(
        `Uninstalled ${packages.length} packages successfully`
      ),
    (error) =>
      handleError(`Cannot uninstall packages: ${packages.join(", ")}`, error)
  );
  checkDocumentAllTabs(checkDocument, diagnosticCollection);
}

function deactivate() {}

module.exports = { activate, deactivate };
