const regexCheckImport =
  /(?:require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|import(?:\s+[\w*{},\s"'`]*from)?\s*["'`]([^"'`]+)["'`]\s*|import\s*\(\s*["'`]([^"'`]+)["'`]\s*\))/g;
const extJs = ["js", "ts", "jsx", "tsx", "mjs", "cjs", "vue"];

module.exports = {
  extJs,
  regexCheckImport
};
