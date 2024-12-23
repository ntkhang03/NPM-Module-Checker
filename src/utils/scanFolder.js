const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { extJs } = require("./constants.js");

async function scanFolder(
  debounceTimers,
  checkDocument,
  folder,
  diagnosticsByFile
) {
  const files = fs.readdirSync(folder);
  for (const file of files) {
    const filePath = path.join(folder, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== "node_modules") {
        await scanFolder(
          debounceTimers,
          checkDocument,
          filePath,
          diagnosticsByFile
        );
      }
    } else if (extJs.includes(path.extname(file).slice(1))) {
      const document = await vscode.workspace.openTextDocument(filePath);
      const diagnostics = await checkDocument(debounceTimers, document);
      diagnosticsByFile.set(filePath, diagnostics);
    }
  }
}

module.exports = scanFolder;
