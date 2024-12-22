const vscode = require("vscode");
const { execSync } = require("child_process");

function executeCommand(command, cwd, title, onSuccess, onFailure) {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    async () => {
      try {
        execSync(command, { cwd, stdio: "pipe" });
        onSuccess();
      } catch (error) {
        onFailure(error);
      }
    }
  );
}

module.exports = executeCommand;
