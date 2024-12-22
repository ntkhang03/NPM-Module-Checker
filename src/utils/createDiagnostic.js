const vscode = require("vscode");

class DiagnosticMod extends vscode.Diagnostic {
  packageNameOrFilePath;
  line;
  startPos;
  endPos;
}

function createDiagnostic(
  range,
  packageNameOrFilePath,
  message,
  code,
  severity,
  line,
  startPos,
  endPos
) {
  const diagnostic = new DiagnosticMod(range, message, severity);
  diagnostic.source = "npm-module-checker";
  diagnostic.code = code; // Identifier for Quick Fix
  diagnostic.packageNameOrFilePath = packageNameOrFilePath;
  diagnostic.line = line;
  diagnostic.startPos = startPos;
  diagnostic.endPos = endPos;
  return diagnostic;
}

module.exports = createDiagnostic;
