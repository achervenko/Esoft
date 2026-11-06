import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
it('keeps integration infrastructure independent of business modules', () => {
  const files = (folder: string): string[] =>
    readdirSync(folder, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(folder, e.name))
        : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')
          ? [join(folder, e.name)]
          : [],
    );
  const violations: string[] = [];
  for (const file of files(__dirname)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        /\/(warehouse|ppe|equipment)(\/|$)/.test(node.moduleSpecifier.text)
      )
        violations.push(file);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
});
