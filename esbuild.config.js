const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["./src/extension.js"],
    bundle: true,
    platform: "node",
    target: "node14",
    outfile: "./out/extension.js",
    external: ["vscode"],
    minify: true,
    sourcemap: false,
    treeShaking: true,
    resolveExtensions: [".js", ".json", ".node"],
    plugins: []
  })
  .catch(() => process.exit(1));
