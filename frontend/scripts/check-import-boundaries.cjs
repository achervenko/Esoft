const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function importReferences(file, source) {
  if (file.endsWith(".css")) {
    return [...source.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)].map(
      (match) => ({ value: match[1], offset: match.index }),
    );
  }
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const references = [];
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      references.push({
        value: node.moduleSpecifier.text,
        offset: node.getStart(tree),
      });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      references.push({
        value: node.arguments[0].text,
        offset: node.getStart(tree),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return references;
}

function boundaryViolations(file, source, root) {
  if (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file)) return [];
  const origin = path.relative(root, file).split(path.sep);
  return importReferences(file, source).flatMap(({ value, offset }) => {
    if (!value.startsWith(".")) return [];
    const target = path
      .relative(root, path.resolve(path.dirname(file), value))
      .split(path.sep);
    let reason;
    if (["shared", "modules"].includes(origin[0]) && target[0] === "pages")
      reason = "Shared code must not depend on a page.";
    if (
      origin[0] === "pages" &&
      target[0] === "pages" &&
      origin[1] !== target[1]
    )
      reason = "Reusable code must live outside page directories.";
    return reason
      ? [
          {
            file: path.relative(root, file),
            line: source.slice(0, offset).split("\n").length,
            value,
            reason,
          },
        ]
      : [];
  });
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

if (require.main === module) {
  const root = path.resolve(__dirname, "../src");
  const problems = walk(root)
    .filter((file) => /\.(?:tsx?|css)$/.test(file))
    .flatMap((file) =>
      boundaryViolations(file, fs.readFileSync(file, "utf8"), root),
    );
  for (const problem of problems)
    console.error(
      `${problem.file}:${problem.line}: ${problem.reason} (${problem.value})`,
    );
  if (problems.length) process.exitCode = 1;
  else console.log("Import boundaries: OK");
}
module.exports = { boundaryViolations };
