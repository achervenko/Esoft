import assert from 'node:assert/strict';

export async function verifyWarehouseIssues(prisma, database, { item, balance, line, project }) {
  const issuer = await prisma.user.create({ data: { id: 'warehouse-issuer', name: 'Issuer', email: 'issuer@test.invalid' } });
  const manualProject = await prisma.warehouseProject.create({ data: { projectNumber: 'MANUAL-PROJECT' } });
  const location = await prisma.warehouseStorageLocation.create({ data: { code: 'B-03', name: 'Second shelf' } });
  const otherBalance = await prisma.warehouseBalance.create({ data: { itemId: item.id, storageLocationId: location.id, quantity: '10' } });
  await prisma.warehouseBalance.update({ where: { id: balance.id }, data: { quantity: '10' } });

  const manual = await prisma.warehouseIssue.create({ data: {
    type: 'MANUAL', issuedByUserId: issuer.id, projectId: manualProject.id,
    positions: { create: { balanceId: balance.id, quantity: '0.25' } },
  }, include: { positions: true } });
  assert.equal(manual.issueSheetLineId, null);
  assert.equal(manual.overrideReservations, false);
  assert.equal(manual.comment, null);
  const serverTime = (await database.query('SELECT CURRENT_TIMESTAMP AS now')).rows[0].now;
  assert.ok(Math.abs(manual.createdAt.getTime() - serverTime.getTime()) < 10000);
  const withoutProject = await prisma.warehouseIssue.create({ data: {
    type: 'MANUAL', issuedByUserId: issuer.id,
    positions: { create: { balanceId: otherBalance.id, quantity: '0.01' } },
  } });
  assert.equal(withoutProject.projectId, null);
  assert.equal(withoutProject.issueSheetLineId, null);
  assert.equal((await prisma.warehouseIssuePosition.findMany({ where: { issueId: withoutProject.id } })).length, 1);

  const partial = await prisma.warehouseIssue.create({ data: {
    type: 'ISSUE_SHEET', issueSheetLineId: line.id, projectId: project.id, issuedByUserId: issuer.id,
    positions: { create: [
      { balanceId: balance.id, quantity: '0.3' },
      { balanceId: otherBalance.id, quantity: '0.2' },
    ] },
  } });
  const remaining = await prisma.warehouseIssue.create({ data: {
    type: 'ISSUE_SHEET', issueSheetLineId: line.id, projectId: project.id, issuedByUserId: issuer.id,
    positions: { create: { balanceId: otherBalance.id, quantity: '0.625' } },
  } });
  const sheetLine = await prisma.warehouseIssueSheetLine.findUniqueOrThrow({ where: { id: line.id }, include: { issues: { include: { positions: true } } } });
  assert.equal(sheetLine.issues.length, 2);
  const issued = await prisma.warehouseIssuePosition.aggregate({ where: { issue: { issueSheetLineId: line.id } }, _sum: { quantity: true } });
  assert.equal(issued._sum.quantity.toString(), '1.125');
  assert.equal(sheetLine.quantity.sub(issued._sum.quantity).toString(), '0');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: issuer.id }, include: { issuedWarehouseIssues: true } })).issuedWarehouseIssues.length, 4);
  assert.ok((await prisma.warehouseProject.findUniqueOrThrow({ where: { id: project.id }, include: { issues: true } })).issues.some((issue) => issue.id === remaining.id));
  assert.ok((await prisma.warehouseBalance.findUniqueOrThrow({ where: { id: balance.id }, include: { issuePositions: true } })).issuePositions.some((position) => position.issueId === partial.id));

  // CHECKs apply to both inserts and updates, independently of the future API.
  for (const [type, lineId] of [['MANUAL', line.id], ['ISSUE_SHEET', null], ['UNKNOWN', null], ['UNKNOWN', line.id]]) {
    await assert.rejects(database.query(
      'INSERT INTO warehouse_issues(type,issue_sheet_line_id,issued_by_user_id) VALUES ($1,$2,$3)',
      [type, lineId?.toString() ?? null, issuer.id],
    ), { code: '23514', constraint: 'chk_warehouse_issues_type_line' });
  }
  await assert.rejects(database.query("UPDATE warehouse_issues SET type='ISSUE_SHEET' WHERE id=$1", [manual.id.toString()]), { code: '23514', constraint: 'chk_warehouse_issues_type_line' });
  await assert.rejects(database.query('UPDATE warehouse_issues SET issue_sheet_line_id=NULL WHERE id=$1', [partial.id.toString()]), { code: '23514', constraint: 'chk_warehouse_issues_type_line' });
  await assert.rejects(database.query(
    "INSERT INTO warehouse_issues(type,issued_by_user_id,override_reservations) VALUES ('MANUAL',$1,true)", [issuer.id],
  ), { code: '23514', constraint: 'chk_warehouse_issues_override_comment' });
  await assert.rejects(database.query('UPDATE warehouse_issues SET override_reservations=true WHERE id=$1', [manual.id.toString()]), { code: '23514', constraint: 'chk_warehouse_issues_override_comment' });
  const forced = await prisma.warehouseIssue.create({ data: {
    type: 'MANUAL', issuedByUserId: issuer.id, overrideReservations: true, comment: 'Approved reservation override',
    positions: { create: { balanceId: otherBalance.id, quantity: '0.1' } },
  } });
  assert.equal(forced.overrideReservations, true);
  for (const comment of [null, '', '   ']) {
    await assert.rejects(database.query(
      "INSERT INTO warehouse_issues(type,issued_by_user_id,override_reservations,comment) VALUES ('MANUAL',$1,true,$2)",
      [issuer.id, comment],
    ), { code: '23514', constraint: 'chk_warehouse_issues_override_comment' });
    await assert.rejects(database.query('UPDATE warehouse_issues SET comment=$1 WHERE id=$2', [comment, forced.id.toString()]), { code: '23514', constraint: 'chk_warehouse_issues_override_comment' });
    await prisma.warehouseIssue.update({ where: { id: manual.id }, data: { comment } });
    await assert.rejects(database.query('UPDATE warehouse_issues SET override_reservations=true WHERE id=$1', [manual.id.toString()]), { code: '23514', constraint: 'chk_warehouse_issues_override_comment' });
  }
  await prisma.warehouseIssue.update({ where: { id: forced.id }, data: { comment: '  Approved reason  ' } });
  assert.equal((await prisma.warehouseIssue.findUniqueOrThrow({ where: { id: forced.id } })).comment, '  Approved reason  ');

  await assert.rejects(prisma.warehouseIssuePosition.create({ data: { issueId: partial.id, balanceId: balance.id, quantity: '1' } }), { code: 'P2002' });
  for (const quantity of ['0', '-0.001']) {
    await assert.rejects(database.query('INSERT INTO warehouse_issue_positions(issue_id,balance_id,quantity) VALUES ($1,$2,$3)', [withoutProject.id.toString(), balance.id.toString(), quantity]), { code: '23514', constraint: 'chk_warehouse_issue_positions_quantity' });
    await assert.rejects(database.query('UPDATE warehouse_issue_positions SET quantity=$1 WHERE id=$2', [quantity, manual.positions[0].id.toString()]), { code: '23514', constraint: 'chk_warehouse_issue_positions_quantity' });
  }
  await assert.rejects(prisma.warehouseIssue.create({ data: { type: 'MANUAL', issuedByUserId: 'missing-user' } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseIssue.create({ data: { type: 'MANUAL', issuedByUserId: issuer.id, projectId: -1n } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseIssue.create({ data: { type: 'ISSUE_SHEET', issuedByUserId: issuer.id, issueSheetLineId: -1n } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseIssuePosition.create({ data: { issueId: -1n, balanceId: balance.id, quantity: '1' } }), { code: 'P2003' });
  await assert.rejects(prisma.warehouseIssuePosition.create({ data: { issueId: manual.id, balanceId: -1n, quantity: '1' } }), { code: 'P2003' });

  // Each object below is referenced by the new issue tables, without another blocker.
  for (const operation of [
    () => prisma.user.delete({ where: { id: issuer.id } }),
    () => prisma.warehouseProject.delete({ where: { id: manualProject.id } }),
    () => prisma.warehouseIssueSheetLine.delete({ where: { id: line.id } }),
    () => prisma.warehouseBalance.delete({ where: { id: balance.id } }),
    () => prisma.warehouseIssue.delete({ where: { id: manual.id } }),
  ]) await assert.rejects(operation(), { code: 'P2003' });

  const indexes = (await database.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('warehouse_issues','warehouse_issue_positions')")).rows;
  for (const [index, column] of [
    ['idx_warehouse_issues_project', 'project_id'],
    ['idx_warehouse_issues_sheet_line', 'issue_sheet_line_id'],
    ['idx_warehouse_issues_issued_by', 'issued_by_user_id'],
    ['idx_warehouse_issues_created_at', 'created_at'],
    ['idx_warehouse_issue_positions_balance', 'balance_id'],
  ]) assert.ok(indexes.some((row) => row.indexname === index && row.indexdef.includes(`(${column})`)), index);
  const issueColumns = (await database.query("SELECT column_name,data_type,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='warehouse_issues'")).rows;
  assert.equal(issueColumns.find((column) => column.column_name === 'issued_by_user_id').data_type, 'text');
  assert.equal(issueColumns.find((column) => column.column_name === 'created_at').data_type, 'timestamp with time zone');
  assert.match(issueColumns.find((column) => column.column_name === 'created_at').column_default, /CURRENT_TIMESTAMP|now\(\)/i);
}
