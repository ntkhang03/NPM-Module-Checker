const vscode = require("vscode");
const { showOutput, outputChannel } = require("../utils/outputChannel.js");

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

module.exports = validateIgnorePatternsCommand;
