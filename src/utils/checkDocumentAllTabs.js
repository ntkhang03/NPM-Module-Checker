const vscode = require("vscode");

function isNullUndefined(value) {
  return value == null || value == undefined;
}

function checkDocumentAllTabs(checkDocument) {
  vscode.window.tabGroups.all.flatMap(({ tabs }) =>
    tabs.map((tab) => {
      if (isNullUndefined(tab) || isNullUndefined(tab.input)) {
        return;
      }
      // @ts-ignore
      const uri = tab.input.uri;
      if (uri) {
        vscode.workspace.openTextDocument(uri).then((document) => {
          checkDocument(document, true);
        });
      }
    })
  );
}

module.exports = checkDocumentAllTabs;
