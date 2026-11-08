import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createIntegrationsCoreContext } from "./integrations/integrations-core-context.mjs";
const require = createRequire(import.meta.url);
const {
  ChecklistWorkQueryRepository,
} = require("../../../../backend/dist/src/checklists/checklist-work/checklist-work-query.repository.js");
const {
  EventsQueryService,
} = require("../../../../backend/dist/src/events/events-query.service.js");
const {
  EventExtensionRegistry,
} = require("../../../../backend/dist/src/events/event-extensions/event-extension.registry.js");

test(
  "checklist progress is scoped to pages/events and preserves zero/false answers",
  { skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1", timeout: 120000 },
  async () => {
    const c = await createIntegrationsCoreContext();
    try {
      const p = c.prisma;
      const position = await p.position.create({
        data: { name: "Progress test" },
      });
      const employee = await p.employee.create({
        data: {
          positionId: position.id,
          firstName: "Test",
          lastName: "Progress",
        },
      });
      const other = await p.user.create({
        data: {
          id: "progress-other",
          name: "Other",
          email: "progress-other@test.invalid",
        },
      });
      const template = await p.checklistTemplate.create({
        data: { name: "Progress", createdBy: c.admin.id },
      });
      const sheets = [];
      for (const [n, user, status] of [
        [0, c.admin.id, "CREATED"],
        [1, c.admin.id, "IN_PROGRESS"],
        [2, other.id, "COMPLETED"],
      ]) {
        const event = await p.event.create({
          data: {
            title: "Progress " + n,
            plannedDate: new Date("2026-11-08"),
            source: "MANUAL",
            createdByEmployeeId: employee.id,
          },
        });
        const sheet = await p.checklist.create({
          data: {
            eventId: event.id,
            checklistTemplateId: template.id,
            assignedUserId: user,
            createdBy: c.admin.id,
            sortOrder: 1,
            status,
          },
        });
        sheets.push({ ...sheet, event });
      }
      const answers = [
        { answerBoolean: false },
        { answerInteger: 0 },
        { answerDecimal: "0" },
        { answerText: "" },
        { answerDate: new Date("2026-11-08") },
        {},
      ];
      for (const [i, answer] of answers.entries())
        await p.checklistDetail.create({
          data: {
            checklistId: sheets[0].id,
            moduleName: "Module",
            moduleSortOrder: 1,
            questionSortOrder: i + 1,
            questionText: "Question",
            answerType: [
              "BOOLEAN",
              "INTEGER",
              "DECIMAL",
              "TEXT",
              "DATE",
              "TEXT",
            ][i],
            isRequired: i < 5,
            ...answer,
          },
        });
      await p.checklistDetail.create({
        data: {
          checklistId: sheets[2].id,
          moduleName: "Other",
          moduleSortOrder: 1,
          questionSortOrder: 1,
          questionText: "Other",
          answerType: "TEXT",
          isRequired: true,
          answerText: "done",
        },
      });
      const work = new ChecklistWorkQueryRepository(p, []);
      const list = (query = {}) =>
        work.list({
          userId: c.admin.id,
          query: { limit: 50, offset: 0, ...query },
        });
      const all = await list();
      assert.equal(all.total, 2);
      assert.deepEqual(
        all.rows.map((r) => r.id),
        sheets.slice(0, 2).map((r) => r.id),
      );
      assert.deepEqual(
        [
          all.rows[0].total,
          all.rows[0].answered,
          all.rows[0].requiredTotal,
          all.rows[0].requiredAnswered,
        ],
        [6n, 5n, 5n, 5n],
      );
      assert.deepEqual(
        [
          all.rows[1].total,
          all.rows[1].answered,
          all.rows[1].requiredTotal,
          all.rows[1].requiredAnswered,
        ],
        [0n, 0n, 0n, 0n],
      );
      assert.deepEqual(all.totalsByStatus, {
        CREATED: 1,
        IN_PROGRESS: 1,
        COMPLETED: 0,
      });
      for (const offset of [0, 1, 2]) {
        const page = await list({ limit: 1, offset });
        assert.equal(page.total, 2);
        assert.deepEqual(page.rows, all.rows.slice(offset, offset + 1));
      }
      assert.equal(
        (await list({ statuses: ["IN_PROGRESS"] })).rows[0].id,
        sheets[1].id,
      );
      assert.equal((await list({ eventId: sheets[0].eventId })).total, 1);
      assert.equal((await list({ dateFrom: new Date("2026-11-09") })).total, 0);
      assert.equal(
        (
          await work.list({
            userId: "no-such-user",
            query: { limit: 50, offset: 0 },
          })
        ).rows.length,
        0,
      );
      const detail = await work.loadDetailForAccess(sheets[0].id);
      assert.equal(detail.answered, 5n);
      const events = new EventsQueryService(
        p,
        new EventExtensionRegistry(),
        [],
      );
      const result = await events.findListRecords({
        where: { id: { in: [sheets[0].eventId, sheets[1].eventId] } },
        limit: 1,
        orderBy: { id: "asc" },
      });
      assert.deepEqual(
        [...result.checklistsByEventId.keys()],
        [sheets[0].eventId],
      );
      assert.deepEqual(
        result.checklistsByEventId.get(sheets[0].eventId)[0].progress,
        { answered: 5, total: 6, requiredAnswered: 5, requiredTotal: 5 },
      );
      const empty = await events.findListRecords({ where: { id: -1 } });
      assert.equal(empty.checklistsByEventId.size, 0);
    } finally {
      await c.close();
    }
  },
);
