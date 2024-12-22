const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const QuickFixProvider = require("./utils/QuickFixProvider.js");
const initCheckDocument = require("./utils/checkDocument.js");
const { outputChannel, showOutput } = require("./utils/showOutput.js");
const handleError = require("./utils/handleError.js");
const scanFolder = require("./utils/scanFolder.js");
const checkDocumentAllTabs = require("./utils/checkDocumentAllTabs.js");
const executeCommand = require("./utils/executeCommand.js");
const processDiagnostics = require("./utils/processDiagnostics.js");
const generateDiagnosticsOutput = require("./utils/generateDiagnosticsOutput.js");

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
    vscode.workspace.onDidOpenTextDocument((doc) => checkDocument(doc, true)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.fileName.includes("package.json")) {
        checkDocumentAllTabs(checkDocument);
      } else {
        checkDocument(e.document, true);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticCollection.delete(doc.uri)
    ),
    vscode.languages.registerCodeActionsProvider(
      ["javascript", "typescript"],
      new QuickFixProvider(),
      {
        providedCodeActionKinds: QuickFixProvider.providedCodeActionKinds
      }
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.validateIgnorePatterns",
      validateIgnorePatternsCommand
    ),
    ...registerCommands()
  ];

  context.subscriptions.push(...subscriptions);

  vscode.workspace.textDocuments.forEach((doc) => checkDocument(doc, true));
  checkDocumentAllTabs(checkDocument);

  // listen when setting changes (npmModuleChecker)
  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("npmModuleChecker")) {
      checkDocumentAllTabs(checkDocument);
    }
  });
}

function validateIgnorePatternsCommand() {
  const config = vscode.workspace.getConfiguration("npmModuleChecker");
  const ignoreFilesOrFolders = config.get("ignoreFilesOrFolders", []);
  const invalidPatterns = [];

  ignoreFilesOrFolders.forEach((pattern, index) => {
    if (!pattern.startsWith("/")) {
      return;
    }

    try {
      new RegExp(pattern);
    } catch (e) {
      invalidPatterns.push({ pattern, index });
    }
  });

  if (invalidPatterns.length) {
    vscode.window
      .showErrorMessage(
        `Found ${invalidPatterns.length} invalid regex patterns. Check the output channel for details.`,
        "Show Output",
        "OK"
      )
      .then((answer) => {
        if (answer === "Show Output") {
          outputChannel.show();
        }
      });

    showOutput(
      `\n[Validate ignore patterns] Found ${invalidPatterns.length} invalid regex patterns:`,
      false
    );
    invalidPatterns.forEach(({ pattern, index }) => {
      showOutput(`- Pattern: "${pattern}", Index: ${index}`, false);
    });
    showOutput(
      `To fix the issues, update the "ignoreFilesOrFolders" setting in your settings.json file.`,
      false
    );
  } else {
    vscode.window.showInformationMessage(`No invalid regex patterns found`);
    showOutput(
      `\n[Validate ignore patterns] No invalid regex patterns found`,
      false
    );
  }
}

function registerCommands() {
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
      "npm-module-checker.installGlobalPackage",
      (packageName, document) =>
        installPackageCommand(packageName, document, true)
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installMissingPackagesFix",
      installMissingPackagesFixCommand
    ),
    vscode.commands.registerCommand(
      "npm-module-checker.installMissingPackagesGloballyFix",
      (document) => installMissingPackagesFixCommand(document, true)
    ),
    ...generateFolderCommands()
  ];
}

function generateFolderCommands() {
  const commands = [
    {
      name: "scanMissingPackagesInFolder",
      prefix: "Missing Packages Checker",
      type: "package",
      filterFn: (issue) => issue.code.startsWith("install-package")
    },
    {
      name: "scanMissingModulesInFolder",
      prefix: "Missing Modules Checker",
      type: "module",
      filterFn: (issue) => issue.code === "create-file"
    },
    {
      name: "scanMissingPackagesAndModulesInFolder",
      prefix: "Missing Packages and Modules Checker",
      type: "packageAndModule",
      filterFn: () => true
    }
  ];

  return commands.map(({ name, prefix, type, filterFn }) => {
    return vscode.commands.registerCommand(
      `npm-module-checker.${name}`,
      async (folderPath) => {
        if (fs.lstatSync(folderPath.fsPath).isFile()) {
          folderPath = vscode.Uri.file(path.dirname(folderPath.fsPath));
        }

        const diagnosticsRoot = new Map();
        await scanFolder(checkDocument, folderPath.fsPath, diagnosticsRoot);
        const diagnostics = new Map();
        const keys = Array.from(diagnosticsRoot.keys());
        keys.forEach((key) => {
          diagnostics.set(
            key,
            diagnosticsRoot.get(key).filter((issue) => filterFn(issue))
          );
        });

        const issues = Array.from(diagnostics.values()).flat();
        if (issues.length === 0) {
          vscode.window.showInformationMessage(
            `No issues found in ${folderPath.fsPath}`
          );
        } else {
          let filesMissing = [];
          let packagesMissing = [];
          issues.forEach((issue) => {
            if (issue.code === "create-file") {
              filesMissing.push(issue.packageNameOrFilePath);
            } else {
              packagesMissing.push(issue.packageNameOrFilePath);
            }
          });

          // remove duplicate items
          filesMissing = [...new Set(filesMissing)];
          packagesMissing = [...new Set(packagesMissing)];

          vscode.window
            .showInformationMessage(
              `Found ${issues.length} issues in ${folderPath.fsPath}. Check the output channel "${outputChannel.name}" for details. Do you want to fix the issues?`,
              "Yes",
              "No"
            )
            .then((answer) => {
              if (answer === "Yes") {
                if (type === "package") {
                  executeCommand(
                    `npm install ${packagesMissing.join(" ")} --prefix ${folderPath.fsPath}`,
                    undefined,
                    `Installing ${packagesMissing.length} missing packages...`,
                    () =>
                      vscode.window.showInformationMessage(
                        `Installed ${packagesMissing.length} packages successfully`
                      ),
                    (error) =>
                      handleError(
                        `Cannot install packages: ${packagesMissing.join(", ")}`,
                        error
                      )
                  );
                } else if (type === "module") {
                  for (const file of filesMissing) {
                    try {
                      fs.writeFileSync(file, "", "utf-8");
                    } catch (error) {
                      showOutput(`Cannot create file: ${file}, ${error}`);
                    }
                  }
                } else {
                  if (packagesMissing.length > 0) {
                    executeCommand(
                      `npm install ${packagesMissing.join(" ")} --prefix ${folderPath.fsPath}`,
                      undefined,
                      `Installing ${packagesMissing.length} missing packages...`,
                      () =>
                        vscode.window.showInformationMessage(
                          `Installed ${packagesMissing.length} packages successfully`
                        ),
                      (error) =>
                        handleError(
                          `Cannot install packages: ${packagesMissing.join(", ")}`,
                          error
                        )
                    );
                  }
                  if (filesMissing.length > 0) {
                    for (const file of filesMissing) {
                      try {
                        fs.writeFileSync(file, "", "utf-8");
                      } catch (error) {
                        showOutput(`Cannot create file: ${file}, ${error}`);
                      }
                    }
                  }
                }
              }
            });

          showOutput(
            `\n[${prefix}] Found ${issues.length} issues in ${folderPath.fsPath}:`
          );
          const { output } = generateDiagnosticsOutput(diagnostics);
          showOutput(output.slice(1));
          showOutput(`To fix the issues, run the following commands:`);

          if (type === "package") {
            showOutput(
              `npm install ${packagesMissing.join(" ")} --prefix ${folderPath.fsPath}`
            );
          } else if (type === "module") {
            showOutput(
              `cd ${folderPath.fsPath} && touch ${filesMissing.map((file) => `"${path.relative(folderPath.fsPath, file)}"`).join(" ")}`
            );
          } else {
            if (packagesMissing.length > 0) {
              showOutput(
                `npm install ${packagesMissing.join(" ")} --prefix ${folderPath.fsPath}`
              );
            }

            if (filesMissing.length > 0) {
              showOutput(
                `cd ${folderPath.fsPath} && touch ${filesMissing.map((file) => `"${path.relative(folderPath.fsPath, file)}"`).join(" ")}`
              );
            }
          }
        }
      }
    );
  });
}

function createFileCommand(filePath, document) {
  processDiagnostics(
    outputChannel,
    [{ packageNameOrFilePath: filePath }],
    () => true,
    (issue) => fs.writeFileSync(issue.packageNameOrFilePath, "", "utf-8"),
    (issue) => `Cannot create file: ${issue.packageNameOrFilePath}`
  );
  checkDocumentAllTabs(checkDocument);
}

function installPackageCommand(packageName, document, global = false) {
  const command = global
    ? `npm install -g ${packageName}`
    : `npm install ${packageName}`;
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
  // checkDocument(document, true);
  checkDocumentAllTabs(checkDocument);
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
  checkDocumentAllTabs(checkDocument);
}

function deactivate() {}

module.exports = { activate, deactivate };
