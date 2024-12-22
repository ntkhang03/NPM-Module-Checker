const vscode = require("vscode");
const handleError = require("./handleError.js");

function processDiagnostics(
  outputChannel,
  diagnostics,
  filterFn,
  onSuccess,
  onFailure
) {
  const issues = diagnostics.filter(filterFn);
  const success = [];
  const fail = [];

  issues.forEach((issue) => {
    try {
      onSuccess(issue);
      success.push(issue.packageNameOrFilePath);
    } catch (error) {
      handleError(onFailure(issue), error);
      fail.push(issue.packageNameOrFilePath);
    }
  });

  if (success.length > 0) {
    vscode.window.showInformationMessage(
      `Successfully processed ${success.length} items.`
    );
  }

  if (fail.length > 0) {
    vscode.window.showErrorMessage(
      `Failed to process ${fail.length} items. Check the output channel "${outputChannel.name}" for details.`
    );
  }
}

module.exports = processDiagnostics;
