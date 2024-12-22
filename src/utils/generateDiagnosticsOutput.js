const vscode = require("vscode");

function getTagFromSeverity(severity) {
  return severity === vscode.DiagnosticSeverity.Warning ? "warning" : " error ";
}

function generateDiagnosticsOutput(diagnostics) {
  let output = "";
  let isFirst = true;
  const arrPackagesOrFiles = [];

  diagnostics.forEach((issues, filePath) => {
    if (issues.length === 0) {
      return;
    }
    output += `${isFirst ? "" : "\n"}\n	${filePath} (${issues.length} issues)`;
    isFirst = false;
    issues.forEach((issue) => {
      const tag = getTagFromSeverity(issue.severity);
      output += `\n    ${issue.line + 1}:${issue.startPos}  [${tag}]  ${issue.message}`;
      arrPackagesOrFiles.push(issue.packageNameOrFilePath);
    });
  });
  return {
    output,
    arrPackagesOrFiles
  };
}

module.exports = generateDiagnosticsOutput;
