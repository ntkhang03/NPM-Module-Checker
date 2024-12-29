const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { outputChannel } = require("../utils/outputChannel.js");
const generateDiagnosticsOutput = require("../utils/generateDiagnosticsOutput.js");
const scanFolder = require("../utils/scanFolder.js");
const executeCommand = require("../utils/executeCommand.js");

function generateFolderCommands(
  debounceTimers,
  checkDocument,
  showOutput,
  handleError
) {
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
        await scanFolder(
          debounceTimers,
          checkDocument,
          folderPath.fsPath,
          diagnosticsRoot
        );
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
                    `npm install ${packagesMissing.join(" ")}`,
                    folderPath.fsPath,
                    `Installing ${packagesMissing.length} missing packages...`,
                    () =>
                      vscode.window.showInformationMessage(
                        `Installed ${packagesMissing.length} packages successfully`
                      ),
                    (error) =>
                      handleError(
                        `Cannot install packages: ${packagesMissing.join(
                          ", "
                        )}`,
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
                      `npm install ${packagesMissing.join(" ")}`,
                      folderPath.fsPath,
                      `Installing ${packagesMissing.length} missing packages...`,
                      () =>
                        vscode.window.showInformationMessage(
                          `Installed ${packagesMissing.length} packages successfully`
                        ),
                      (error) =>
                        handleError(
                          `Cannot install packages: ${packagesMissing.join(
                            ", "
                          )}`,
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
              `npm install ${packagesMissing.join(
                " "
              )} --prefix ${folderPath.fsPath}`
            );
          } else if (type === "module") {
            showOutput(
              `cd ${folderPath.fsPath} && touch ${filesMissing
                .map((file) => `"${path.relative(folderPath.fsPath, file)}"`)
                .join(" ")}`
            );
          } else {
            if (packagesMissing.length > 0) {
              showOutput(
                `npm install ${packagesMissing.join(
                  " "
                )} --prefix ${folderPath.fsPath}`
              );
            }

            if (filesMissing.length > 0) {
              showOutput(
                `cd ${folderPath.fsPath} && touch ${filesMissing
                  .map((file) => `"${path.relative(folderPath.fsPath, file)}"`)
                  .join(" ")}`
              );
            }
          }
        }
      }
    );
  });
}

module.exports = generateFolderCommands;
