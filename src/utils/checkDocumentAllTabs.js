const vscode = require("vscode");
const path = require("path");
const checkUnusedPackagesInPackageJson = require("./checkUnusedPackagesInPackageJson.js");
function isNullUndefined(value) {
  return value == null || value == undefined;
}

function checkDocumentAllTabs(
  debounceTimers,
  checkDocument,
  diagnosticCollection
) {
  vscode.window.tabGroups.all.flatMap(({ tabs }) => {
    tabs.map((tab) => {
      if (isNullUndefined(tab) || isNullUndefined(tab.input)) {
        return;
      }
      // @ts-ignore
      const uri = tab.input.uri;

      if (uri) {
        vscode.workspace.openTextDocument(uri).then((document) => {
          if (path.basename(uri.fsPath) === "package.json") {
            checkUnusedPackagesInPackageJson(document, diagnosticCollection);
          } else {
            checkDocument(debounceTimers, document, true);
          }
        });
      }
    });
  });
}

module.exports = checkDocumentAllTabs;
