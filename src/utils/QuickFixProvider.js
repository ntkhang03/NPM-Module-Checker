const vscode = require("vscode");
const path = require("path");

class QuickFixProvider {
  static get providedCodeActionKinds() {
    return [vscode.CodeActionKind.QuickFix];
  }

  provideCodeActions(document, range, context) {
    const diagnostics = context.diagnostics;

    // Các actions sẽ được gom lại trong 1 mảng, mỗi mảng có các hành động phù hợp với từng diagnostic
    const actions = [];

    diagnostics.forEach((diagnostic) => {
      if (diagnostic.code === "create-file") {
        actions.push(
          this.createFileQuickFix(diagnostic.packageNameOrFilePath, document),
          this.createFilesQuickFix(document)
        );
      } else if (diagnostic.code === "install-package-global") {
        actions.push(
          this.installPackageQuickFix(
            diagnostic.packageNameOrFilePath,
            document
          ),
          this.installPackageGlobalQuickFix(
            diagnostic.packageNameOrFilePath,
            document
          ),
          this.installMissingPackagesFix(document),
          this.installMissingPackagesGloballyFix(document)
        );
      } else if (diagnostic.code === "install-package-this-project") {
        actions.push(
          this.installPackageQuickFix(
            diagnostic.packageNameOrFilePath,
            document
          ),
          this.installMissingPackagesFix(document),
          this.installMissingPackagesGloballyFix(document)
        );
      }
    });

    return actions;
  }

  createFileQuickFix(fileName, document) {
    const fix = new vscode.CodeAction(
      "Create missing file",
      vscode.CodeActionKind.QuickFix
    );
    const filePath = path.resolve(path.dirname(document.fileName), fileName);
    fix.command = {
      title: "Create file",
      command: "npm-module-checker.createFile",
      arguments: [filePath, document]
    };
    return fix;
  }

  createFilesQuickFix(document) {
    const fix = new vscode.CodeAction(
      "Fix all problems (create all missing files)",
      vscode.CodeActionKind.QuickFix
    );
    fix.command = {
      title: "Create files",
      command: "npm-module-checker.createAllMissingFiles",
      arguments: [document]
    };
    return fix;
  }

  installPackageQuickFix(packageName, document) {
    const fix = new vscode.CodeAction(
      `Install "${packageName}" package in this project`,
      vscode.CodeActionKind.QuickFix
    );
    fix.command = {
      title: "Install package",
      command: "npm-module-checker.installPackage",
      arguments: [packageName, document]
    };
    return fix;
  }

  installPackageGlobalQuickFix(packageName, document) {
    const fix = new vscode.CodeAction(
      `Install "${packageName}" package globally`,
      vscode.CodeActionKind.QuickFix
    );
    fix.command = {
      title: "Install global package",
      command: "npm-module-checker.installGlobalPackage",
      arguments: [packageName, document]
    };
    return fix;
  }

  installMissingPackagesFix(document) {
    const fix = new vscode.CodeAction(
      "Fix all problems (install missing packages) in this project",
      vscode.CodeActionKind.QuickFix
    );
    fix.command = {
      title: "Fix all problems (install missing packages) in this project",
      command: "npm-module-checker.installMissingPackagesFix",
      arguments: [document]
    };
    return fix;
  }

  installMissingPackagesGloballyFix(document) {
    const fix = new vscode.CodeAction(
      "Fix all problems (install missing packages) globally",
      vscode.CodeActionKind.QuickFix
    );
    fix.command = {
      title: "Fix all problems (install missing packages) globally",
      command: "npm-module-checker.installMissingPackagesGloballyFix",
      arguments: [document]
    };
    return fix;
  }
}

module.exports = QuickFixProvider;
