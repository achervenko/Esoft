import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
const root = __dirname;
const integrationAllowed = new Set([
  '../receipts/receipts.module',
  '../receipts/receipt-import.service',
  '../receipts/receipt-source-warehouses.service',
  '../receipts/receipts-import.contract',
]);
const domainModels = new Set([
  'warehouseReceipt',
  'warehouseReceiptLine',
  'warehouseReceiptPlacement',
  'warehouseItem',
  'warehouseBalance',
  'warehouseItemExternalLink',
  'warehouseExternalWarehouse',
]);
const domainTables = [
  'warehouse_receipts',
  'warehouse_receipt_lines',
  'warehouse_receipt_placements',
  'warehouse_items',
  'warehouse_balances',
  'warehouse_item_external_links',
  'warehouse_external_warehouses',
];
const domainSql = new RegExp(`\\b(${domainTables.join('|')})\\b`, 'i');
function embedsDomainSql(node: ts.Node): boolean {
  return (
    (ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node)) &&
    domainSql.test(node.getText())
  );
}
const writes = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);
function inspect(folder: string, check: (node: ts.Node, file: string) => void) {
  for (const file of readdirSync(join(root, folder)).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'),
  )) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, folder, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node) => {
      check(node, file);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
it('keeps Receipts independent of the 1C transport and delegates canonical writes', () => {
  const violations: string[] = [];
  inspect('receipts', (node, file) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.includes('receipt-integration')
    )
      violations.push(file + ': imports transport');
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch')
        violations.push(file + ': performs HTTP');
      if (ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text,
          entity = node.expression.expression;
        if (
          method === 'receiveStock' &&
          file !== 'receipt-placements.service.ts'
        )
          violations.push(file + ': changes stock outside placement');
        if (
          ts.isPropertyAccessExpression(entity) &&
          writes.has(method) &&
          ['warehouseItem', 'warehouseBalance'].includes(entity.name.text)
        )
          violations.push(file + ': writes ' + entity.name.text);
      }
    }
  });
  inspect('receipts', (node, file) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ['warehouseItem', 'warehouseItemExternalLink'].includes(node.name.text)
    )
      violations.push(file + ': bypasses public Catalog API');
    if (
      (ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) &&
      /warehouse_(items|item_external_links)/.test(node.getText())
    )
      violations.push(file + ': embeds Catalog SQL');
  });
  expect(violations).toEqual([]);
});
it('lets integration access receipt documents only through the public import API', () => {
  const violations: string[] = [];
  inspect('receipt-integration', (node, file) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const name = node.moduleSpecifier.text;
      if (name.startsWith('../receipts/') && !integrationAllowed.has(name))
        violations.push(file + ': imports private receipt implementation');
      if (name.startsWith('../stock/'))
        violations.push(file + ': imports Stock internals');
    }
    if (ts.isPropertyAccessExpression(node) && domainModels.has(node.name.text))
      violations.push(file + ': directly accesses ' + node.name.text);
    if (embedsDomainSql(node)) violations.push(file + ': embeds domain SQL');
  });
  expect(violations).toEqual([]);
});

it.each(domainTables)('detects integration SQL accessing %s', (table) => {
  const snippets = [
    `prisma.$queryRaw\`SELECT * FROM ${table}\``,
    `prisma.$executeRaw\`UPDATE "${table}" SET id = \${id}\``,
    `prisma.$queryRawUnsafe('SELECT * FROM public.${table.toUpperCase()}')`,
  ];
  for (const snippet of snippets) {
    const source = ts.createSourceFile(
      'integration.ts',
      snippet,
      ts.ScriptTarget.Latest,
      true,
    );
    const matches: ts.Node[] = [];
    const visit = (node: ts.Node) => {
      if (embedsDomainSql(node)) matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(matches).toHaveLength(1);
  }
});

it('allows integration-owned SQL tables', () => {
  for (const table of [
    'warehouse_receipt_events',
    'warehouse_receipt_integration_sources',
  ]) {
    const source = ts.createSourceFile(
      'integration.ts',
      `\`SELECT * FROM ${table}\``,
      ts.ScriptTarget.Latest,
      true,
    );
    const statement = source.statements[0] as ts.ExpressionStatement;
    expect(embedsDomainSql(statement.expression)).toBe(false);
  }
});

it('keeps Catalog independent of receipt models and services', () => {
  const violations: string[] = [];
  inspect('catalog', (node, file) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.includes('receipts')
    )
      violations.push(file + ': imports Receipts');
    if (
      ts.isPropertyAccessExpression(node) &&
      [
        'warehouseReceipt',
        'warehouseReceiptLine',
        'warehouseReceiptPlacement',
      ].includes(node.name.text)
    )
      violations.push(file + ': accesses receipt tables');
  });
  expect(violations).toEqual([]);
});
