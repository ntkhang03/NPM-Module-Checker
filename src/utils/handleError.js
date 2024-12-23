const vscode = require("vscode");
const { outputChannel, showOutput } = require("./outputChannel");

function handleError(message, error) {
  showOutput(`\n[Error]: ${message}`);
  showOutput(error.toString());
  vscode.window.showErrorMessage(
    `Failed: ${message}, check the output channel "${outputChannel.name}" for more details.`
  );
}

module.exports = handleError;
