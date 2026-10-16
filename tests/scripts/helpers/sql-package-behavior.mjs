import assert from 'node:assert/strict';

export async function verifySqlPackageBehavior(client, modules) {
  const positionId = (await client.query("INSERT INTO positions(name) VALUES ('Проверка регистра') RETURNING id")).rows[0].id;
  await assert.rejects(client.query("INSERT INTO positions(name) VALUES ('проверка регистра')"), { code: '23505' });
  await client.query(`INSERT INTO "user"(id,name,email,"updatedAt") VALUES ('sql-probe','SQL probe','sql-probe@test.invalid',now());
    INSERT INTO checklist_modules(name,sort_order,created_by) VALUES ('Module A',10,'sql-probe'),('Module B',20,'sql-probe');
    INSERT INTO checklist_templates(name,created_by) VALUES ('Template probe','sql-probe');
    INSERT INTO checklist_template_modules(checklist_template_id,checklist_module_id,module_name_snapshot,sort_order) VALUES (1,1,'Module A',1);
    INSERT INTO checklist_questions(checklist_module_id,question_text,answer_type,sort_order,created_by) VALUES (2,'Wrong module','BOOLEAN',1,'sql-probe'),(1,'Right module','BOOLEAN',1,'sql-probe');`);
  await assert.rejects(client.query("INSERT INTO checklist_template_questions(checklist_template_module_id,checklist_question_id,question_text_snapshot,answer_type_snapshot,sort_order) VALUES (1,1,'Wrong module','BOOLEAN',1)"), { code: 'P0001' });
  await client.query("INSERT INTO checklist_template_questions(checklist_template_module_id,checklist_question_id,question_text_snapshot,answer_type_snapshot,sort_order) VALUES (1,2,'Right module','BOOLEAN',1)");
  await client.query("UPDATE checklist_modules SET updated_at='2000-01-01' WHERE id=1");
  assert.ok((await client.query('SELECT updated_at FROM checklist_modules WHERE id=1')).rows[0].updated_at > new Date('2020-01-01'));
  await client.query('UPDATE checklist_templates SET is_published=true WHERE id=1');
  for (const sql of [
    'UPDATE checklist_templates SET is_published=false WHERE id=1',
    'UPDATE checklist_template_modules SET sort_order=2 WHERE id=1',
    'DELETE FROM checklist_template_questions WHERE checklist_template_module_id=1',
    'DELETE FROM checklist_templates WHERE id=1',
  ]) await assert.rejects(client.query(sql), { code: 'P0001' });
  await client.query("INSERT INTO countries(name,iso) VALUES ('SQL probe country','QZ')");
  await assert.rejects(client.query("DELETE FROM countries WHERE iso='QZ'"), { code: 'P0001' });
  if (modules.includes('equipment')) {
    const employeeId = (await client.query("INSERT INTO employees(last_name,first_name,position_id) VALUES ('SQL','Probe',$1) RETURNING id", [positionId])).rows[0].id;
    await client.query(`INSERT INTO workshops(name) VALUES ('SQL workshop');
      INSERT INTO sections(workshop_id,name) VALUES (1,'SQL section');
      INSERT INTO manufacturers(name) VALUES ('SQL manufacturer');
      INSERT INTO equipment_models(manufacturer_id,name) VALUES (1,'SQL model');`);
    const row = (await client.query(`INSERT INTO equipment(visible_id,inventory_number,name,model_id,issue_date,section_id,responsible_employee_id,serial_number,specifications,operation_text,notes)
      VALUES (120,'SQL-120','SQL equipment',1,'2026-01-01',1,$1,'  б/н  ','  ','','  note  ') RETURNING visible_id,serial_number,specifications,operation_text,notes`, [employeeId])).rows[0];
    assert.deepEqual(row, { visible_id: 120, serial_number: null, specifications: null, operation_text: null, notes: 'note' });
    const next = (await client.query(`INSERT INTO equipment(inventory_number,name,model_id,issue_date,section_id,responsible_employee_id)
      VALUES ('SQL-next','Next equipment',1,'2026-01-01',1,$1) RETURNING visible_id`, [employeeId])).rows[0].visible_id;
    assert.equal(next, 121);
    const sequenceBefore = (await client.query('SELECT last_value,is_called FROM equipment_visible_id_seq')).rows;
    assert.equal((await client.query("SELECT app_next_identity_id('equipment'::regclass,'visible_id') AS next")).rows[0].next, '122');
    assert.deepEqual((await client.query('SELECT last_value,is_called FROM equipment_visible_id_seq')).rows, sequenceBefore);
    await assert.rejects(client.query('DELETE FROM manufacturers WHERE id=1'), { code: 'P0001' });
  }
}
