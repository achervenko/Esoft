import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const sourceRoot = resolve(__dirname, '..');
const routeDecorators = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Head',
  'Options',
  'All',
]);
const publicHandlers = new Set([
  'health/health.controller.ts:getHealth',
  'setup/setup.controller.ts:getStatus',
  'setup/setup.controller.ts:listEmployees',
  'setup/setup.controller.ts:createInitialAdmin',
]);

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : path.endsWith('.controller.ts')
        ? [path]
        : [];
  });
}

it('requires explicit method permissions on every application endpoint and keeps public exceptions bounded', () => {
  const violations: string[] = [];
  const foundPublic = new Set<string>();
  let routes = 0;
  for (const path of files(sourceRoot)) {
    const source = ts.createSourceFile(
      path,
      readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (ts.isMethodDeclaration(node)) {
        const decorators = ts.getDecorators(node) ?? [];
        const calls = decorators.flatMap((decorator) =>
          ts.isCallExpression(decorator.expression) &&
          ts.isIdentifier(decorator.expression.expression)
            ? [decorator.expression.expression.text]
            : [],
        );
        if (calls.some((name) => routeDecorators.has(name))) {
          routes++;
          const id = `${relative(sourceRoot, path).replaceAll('\\', '/')}:${node.name.getText(source)}`;
          const permissionCount = calls.filter(
            (name) => name === 'RequirePermission',
          ).length;
          const publicCount = calls.filter(
            (name) => name === 'AllowAnonymous',
          ).length;
          if (permissionCount + publicCount !== 1)
            violations.push(
              `${id}: declare exactly one method permission or public marker`,
            );
          if (publicCount) {
            foundPublic.add(id);
            if (!publicHandlers.has(id))
              violations.push(`${id}: unexpected public business endpoint`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(routes).toBeGreaterThan(0);
  expect(violations).toEqual([]);
  expect([...foundPublic].sort()).toEqual([...publicHandlers].sort());
});
