const { showOutput } = require("./showOutput.js");
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const checkGlobalPackage = require("./checkGlobalPackage.js");
const findNearestPackageJson = require("./findNearestPackageJson.js");
const createDiagnostic = require("./createDiagnostic.js");
const builtInModules = require("module").builtinModules;

const ignorePackages = [
  "module",
  "vscode",
  "child_process",
  "fs",
  "path",
  ...builtInModules.map((mod) => mod.replace(/^node:/, "")),
  ...builtInModules.map((mod) => "node:" + mod.replace(/^node:/, ""))
];

module.exports = function (
  globalNodeModulesPath,
  diagnosticsByFile,
  diagnosticCollection
) {
  return function checkDocument(document, setToList = false) {
    const config = vscode.workspace.getConfiguration("npmModuleChecker");
    const customIgnorePackages = config.get("customIgnorePackages", []);
    const checkInsideStrings = config.get("checkInsideStrings", false);
    const ignoreFilesOrFolders = config.get("ignoreFilesOrFolders", []);

    const enableDiagnostics = {
      javascript: config.get("enableDiagnosticsJavascript", true),
      typescript: config.get("enableDiagnosticsTypescript", true),
      javascriptreact: config.get("enableDiagnosticsJavascriptreact", true),
      typescriptreact: config.get("enableDiagnosticsTypescriptreact", true)
    };

    const diagnosticSeverity = {
      packageInstalledGlobal: config.get(
        "packageInstalledGlobalSeverity",
        "error"
      ),
      missingPackageDependency: config.get(
        "missingPackageDependencySeverity",
        "error"
      ),
      packageInstalledDevDependency: config.get(
        "packageInstalledDevDependencySeverity",
        "warning"
      ),
      missingFileIndex: config.get("missingFileIndexSeverity", "error"),
      missingFile: config.get("missingFileSeverity", "error")
    };

    if (!enableDiagnostics[document.languageId]) {
      return;
    }

    const documentPath = document.fileName;
    if (
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
      return;
    }

    const diagnostics = [];
    const text = document.getText();

    const regex =
      /(?:require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|import(?:\s+[\w*{},\s"'`]*from)?\s*["'`]([^"'`]+)["'`]\s*|import\s*\(\s*["'`]([^"'`]+)["'`]\s*\))/g;

    let match;
    while ((match = regex.exec(text))) {
      const thisLineText =
        document.lineAt(document.positionAt(match.index).line).text || "";
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

      const startPosInt = match.index + match[0].indexOf(modulePath) - 1;
      const endPosInt =
        match.index + match[0].indexOf(modulePath) + modulePath.length + 1;
      const startPos = document.positionAt(startPosInt);
      const endPos = document.positionAt(endPosInt);
      const line = document.positionAt(match.index).line;

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
              line,
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
                line,
                startPos.character,
                endPos.character
              )
            );
          }
        }
      } else {
        const packageJson = JSON.parse(fs.readFileSync(rootPath, "utf-8"));
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
                    ? diagnosticSeverity.packageInstalledGlobal || "Error"
                    : diagnosticSeverity.packageInstalledDevDependency ||
                      "Warning"
                ],
                line,
                startPos.character,
                endPos.character
              )
            );
          } else {
            diagnostics.push(
              createDiagnostic(
                range,
                modulePath,
                `Package "${modulePath}" not installed in this project's dependencies, devDependencies and not found in global node_modules.`,
                "install-package-global",
                vscode.DiagnosticSeverity[
                  diagnosticSeverity.missingPackageDependency || "Error"
                ],
                line,
                startPos.character,
                endPos.character
              )
            );
          }
        }
      }
    }

    if (setToList) {
      diagnosticCollection.set(document.uri, diagnostics);
      diagnosticsByFile.set(document.uri, diagnostics);
    }

    return diagnostics;
  };
};
