const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const checkGlobalPackage = require("./checkGlobalPackage.js");
const findNearestPackageJson = require("./findNearestPackageJson.js");
const createDiagnostic = require("./createDiagnostic.js");
const builtInModules = require("module").builtinModules;
const { regexCheckImport } = require("./constants.js");
const { showOutput } = require("./outputChannel.js");
const debounce = require("./debounce.js");

const ignorePackages = [
  "module",
  "vscode",
  "child_process",
  "fs",
  "path",
  ...builtInModules.map((mod) => mod.replace(/^node:/, "")),
  ...builtInModules.map((mod) => "node:" + mod.replace(/^node:/, ""))
];
const config = vscode.workspace.getConfiguration("npmModuleChecker");

module.exports = function (
  globalNodeModulesPath,
  diagnosticsByFile,
  diagnosticCollection
) {
  return function checkDocument(debounceTimers, document, setToList = false) {
    return new Promise((resolve) => {
      debounce(
        debounceTimers,
        `checkDocument_${document.uri.path}`,
        () => {
          const config = vscode.workspace.getConfiguration("npmModuleChecker");
          const customIgnorePackages = config.get("customIgnorePackages", []);
          const checkInsideStrings = config.get("checkInsideStrings", false);
          const ignoreFilesOrFolders = config.get("ignoreFilesOrFolders", []);

          const enableDiagnostics = {
            javascript: config.get(
              "enableDiagnosticsJavascript",
              config.inspect("enableDiagnosticsJavascript").defaultValue
            ),
            typescript: config.get(
              "enableDiagnosticsTypescript",
              config.inspect("enableDiagnosticsTypescript").defaultValue
            ),
            javascriptreact: config.get(
              "enableDiagnosticsJavascriptreact",
              config.inspect("enableDiagnosticsJavascriptreact").defaultValue
            ),
            typescriptreact: config.get(
              "enableDiagnosticsTypescriptreact",
              config.inspect("enableDiagnosticsTypescriptreact").defaultValue
            ),
            vue: config.get(
              "enableDiagnosticsVue",
              config.inspect("enableDiagnosticsVue").defaultValue
            )
          };

          const diagnosticSeverity = {
            packageInstalledGlobal: config.get(
              "packageInstalledGlobalSeverity",
              config.inspect("packageInstalledGlobalSeverity").defaultValue
            ),
            missingPackageDependency: config.get(
              "missingPackageDependencySeverity",
              config.inspect("missingPackageDependencySeverity").defaultValue
            ),
            packageInstalledDevDependency: config.get(
              "packageInstalledDevDependencySeverity",
              config.inspect("packageInstalledDevDependencySeverity")
                .defaultValue
            ),
            missingFileIndex: config.get(
              "missingFileIndexSeverity",
              config.inspect("missingFileIndexSeverity").defaultValue
            ),
            missingFile: config.get(
              "missingFileSeverity",
              config.inspect("missingFileSeverity").defaultValue
            )
          };

          if (!enableDiagnostics[document.languageId]) {
            diagnosticCollection.delete(document.uri);
            resolve([]);
            return;
          }

          const documentPath = document.fileName;
          if (
            // Check if the file is in the ignoreFilesOrFolders list
            ignoreFilesOrFolders.some((pattern) => {
              if (!pattern.startsWith("/")) {
                if (!pattern.includes(".")) {
                  // check as folder
                  const folderName = path.basename(documentPath);
                  return folderName === pattern;
                } else {
                  // check as file
                  const fileName = path.basename(documentPath);
                  return fileName === pattern;
                }
              } else {
                try {
                  const regex = new RegExp(pattern);
                  return regex.test(documentPath);
                } catch (e) {
                  showOutput(
                    `Invalid regex pattern: "${pattern}", check your settings`,
                    false
                  );
                  return false;
                }
              }
            })
          ) {
            resolve([]);
            return;
          }

          const diagnostics = [];
          const text = document.getText();
          const lines = text.split("\n");

          lines.forEach((lineText, lineNumber) => {
            let match;
            while ((match = regexCheckImport.exec(lineText))) {
              const thisLineText = lineText || "";
              if (
                ["//", "/*", "*"].some((comment) =>
                  thisLineText.trim().startsWith(comment)
                )
              ) {
                continue;
              }

              if (!checkInsideStrings) {
                const beforeMatch = text.slice(0, match.index);
                const afterMatch = text.slice(match.index + match[0].length);
                const isInsideString =
                  (beforeMatch.match(/"/g) || []).length % 2 !== 0 ||
                  (beforeMatch.match(/'/g) || []).length % 2 !== 0 ||
                  (beforeMatch.match(/`/g) || []).length % 2 !== 0 ||
                  (afterMatch.match(/"/g) || []).length % 2 !== 0 ||
                  (afterMatch.match(/'/g) || []).length % 2 !== 0 ||
                  (afterMatch.match(/`/g) || []).length % 2 !== 0;

                if (isInsideString) {
                  continue;
                }
              }

              const modulePath = match[1] || match[2] || match[3];
              if (!modulePath) {
                continue;
              }

              if (
                ignorePackages.includes(modulePath) ||
                customIgnorePackages.includes(modulePath)
              ) {
                continue;
              }

              let startPosInt = match.index + match[0].indexOf(modulePath) - 1;
              if (match[0].startsWith("import")) {
                startPosInt = /[`'"]/g.exec(thisLineText).index;
              }
              const endPosInt = startPosInt + 1 + modulePath.length + 1;
              const startPos = document.positionAt(
                document.offsetAt(new vscode.Position(lineNumber, startPosInt))
              );
              const endPos = document.positionAt(
                document.offsetAt(new vscode.Position(lineNumber, endPosInt))
              );

              const range = new vscode.Range(startPos, endPos);

              const rootPath = findNearestPackageJson(document.fileName);
              if (!rootPath) {
                continue;
              }

              // is file
              if (modulePath.startsWith(".") || modulePath.startsWith("/")) {
                let resolvedPath = path.resolve(
                  path.dirname(document.fileName),
                  modulePath
                );
                const extensionCurrentFile = path.extname(document.fileName);

                if (
                  fs.existsSync(resolvedPath) &&
                  fs.lstatSync(resolvedPath).isDirectory() &&
                  !fs.existsSync(resolvedPath + "/index" + extensionCurrentFile)
                ) {
                  diagnostics.push(
                    createDiagnostic(
                      range,
                      resolvedPath + "/index" + extensionCurrentFile,
                      `Cannot find module 'index${extensionCurrentFile}' from '${resolvedPath}'`,
                      "create-file",
                      vscode.DiagnosticSeverity[
                        diagnosticSeverity.missingFileIndex || "Error"
                      ],
                      lineNumber,
                      startPos.character,
                      endPos.character
                    )
                  );
                } else {
                  if (!path.extname(resolvedPath)) {
                    resolvedPath = resolvedPath + extensionCurrentFile;
                  }

                  if (!fs.existsSync(resolvedPath)) {
                    diagnostics.push(
                      createDiagnostic(
                        range,
                        resolvedPath,
                        `Cannot find module '${resolvedPath}'`,
                        "create-file",
                        vscode.DiagnosticSeverity[
                          diagnosticSeverity.missingFile || "Error"
                        ],
                        lineNumber,
                        startPos.character,
                        endPos.character
                      )
                    );
                  }
                }
              } else {
                const packageJson = JSON.parse(
                  fs.readFileSync(rootPath, "utf-8")
                );
                if (
                  !packageJson.dependencies || // Không có dependencies
                  !(modulePath in packageJson.dependencies) // Không có modulePath trong dependencies
                ) {
                  const isGlobalInstalled = checkGlobalPackage(
                    globalNodeModulesPath,
                    modulePath
                  );
                  const isDevInstalled =
                    packageJson.devDependencies &&
                    modulePath in packageJson.devDependencies;
                  if (isGlobalInstalled || isDevInstalled) {
                    diagnostics.push(
                      createDiagnostic(
                        range,
                        modulePath,
                        `Package "${modulePath}" is not found in this project's dependencies, but is installed ${isGlobalInstalled ? "globally" : "as a dev dependency"}.`,
                        "install-package-this-project",
                        vscode.DiagnosticSeverity[
                          isGlobalInstalled
                            ? diagnosticSeverity.packageInstalledGlobal ||
                              "Warning"
                            : diagnosticSeverity.packageInstalledDevDependency ||
                              "Warning"
                        ],
                        lineNumber,
                        startPos.character,
                        endPos.character
                      )
                    );
                  } else {
                    diagnostics.push(
                      createDiagnostic(
                        range,
                        modulePath,
                        `Package "${modulePath}" is not installed in this project's dependencies, devDependencies and globally.`,
                        "install-package-global",
                        vscode.DiagnosticSeverity[
                          diagnosticSeverity.missingPackageDependency || "Error"
                        ],
                        lineNumber,
                        startPos.character,
                        endPos.character
                      )
                    );
                  }
                }
              }
            }
          });

          if (setToList) {
            diagnosticCollection.set(document.uri, diagnostics);
            diagnosticsByFile.set(document.uri, diagnostics);
          }

          resolve(diagnostics);
        },
        config.get(
          "delayForCheckDocumentCall",
          config.inspect("delayForCheckDocumentCall").defaultValue
        )
      );
    });
  };
};
