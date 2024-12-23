const vscode = require("vscode");

const outputChannel = vscode.window.createOutputChannel("NPM package checker");
function showOutput(message, isShow = true) {
  outputChannel.appendLine(message);
  if (isShow) {
    outputChannel.show();
  }
}

module.exports = {
  outputChannel,
  showOutput
};
