import assert from "node:assert/strict";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";
import { createIsolatedPostgres } from "../../helpers/isolated-postgres.mjs";
import { runPackageMigrations } from "../../../../scripts/database/migrate.mjs";

const require = createRequire(import.meta.url);
const project = resolve(import.meta.dirname, "../../../..");
test(
  "template sort precedes pagination for names, states and total questions",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 120000,
  },
  async () => {
    const environment = await createIsolatedPostgres();
    let prisma;
    try {
      const root = join(environment.root, "template_sort");
      await mkdir(join(root, "backend/prisma/packages"), { recursive: true });
      await cp(
        join(project, "backend/prisma/schema"),
        join(root, "backend/prisma/schema"),
        { recursive: true },
      );
      await cp(
        join(project, "backend/prisma/packages/core"),
        join(root, "backend/prisma/packages/core"),
        { recursive: true },
      );
      await cp(
        join(project, "backend/prisma/module-catalog.json"),
        join(root, "backend/prisma/module-catalog.json"),
      );
      await writeFile(join(root, "database-packages.json"), '{"modules":[]}');
      await environment.database("template_sort");
      const url = environment.urlFor("template_sort");
      const migration = await runPackageMigrations({
        projectRoot: root,
        databaseUrl: url,
        operation: "deploy",
        output: { log() {} },
      });
      assert.equal(migration.ok, true, migration.stdout + migration.stderr);
      const { PrismaClient } = require("@prisma/client");
      const { PrismaPg } = require("@prisma/adapter-pg");
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url }),
      });
      const {
        ChecklistTemplateQueryService,
      } = require("../../../../backend/dist/src/checklists/checklist-templates/checklist-template-query.service.js");
      const {
        parseChecklistTemplatesQuery,
      } = require("../../../../backend/dist/src/checklists/checklist-templates/checklist-templates-query.validation.js");
      const service = new ChecklistTemplateQueryService(prisma, null);
      const actor = await prisma.user.create({
        data: { id: "sort-test", name: "Test", email: "sort@example.test" },
      });
      const modules = await Promise.all(
        [1, 2].map((n) =>
          prisma.checklistModule.create({
            data: { name: `Модуль ${n}`, sortOrder: n, createdBy: actor.id },
          }),
        ),
      );
      const questions = await Promise.all(
        Array.from({ length: 5 }, (_, n) =>
          prisma.checklistQuestion.create({
            data: {
              questionText: `Вопрос ${n}`,
              checklistModuleId: modules[n % 2].id,
              answerType: "BOOLEAN",
              createdBy: actor.id,
            },
          }),
        ),
      );
      async function create(name, count, isActive, isPublished = true) {
        const template = await prisma.checklistTemplate.create({
          data: {
            name,
            isActive: false,
            isPublished: false,
            createdBy: actor.id,
            modules: {
              create: modules.map((module, index) => ({
                checklistModuleId: module.id,
                moduleNameSnapshot: module.name,
                sortOrder: index + 1,
                questions: {
                  create: questions
                    .slice(0, count)
                    .filter((_, n) => n % 2 === index)
                    .map((question, n) => ({
                      checklistQuestionId: question.id,
                      questionTextSnapshot: question.questionText,
                      answerTypeSnapshot: "BOOLEAN",
                      sortOrder: n + 1,
                    })),
                },
              })),
            },
          },
        });
        return isPublished
          ? prisma.checklistTemplate.update({
              where: { id: template.id },
              data: { isPublished: true, isActive },
            })
          : template;
      }
      const z = await create("Я тест", 2, true);
      const b = await create("Б тест", 4, false);
      const a = await create("А тест", 4, true);
      const c = await create("В тест", 5, false);
      await create("Скрытый черновик", 5, true, false);
      const list = (query = {}) =>
        service.list(parseChecklistTemplatesQuery(query));
      for (const [sortBy, asc] of [
        ["name", [a.id, b.id, c.id, z.id]],
        ["state", [z.id, a.id, b.id, c.id]],
        ["questionCount", [z.id, b.id, a.id, c.id]],
      ]) {
        const all = await list({ sortBy, sortDirection: "asc" });
        assert.equal(all.total, 4);
        assert.deepEqual(
          all.items.map((item) => item.id),
          asc,
        );
        const paged = [];
        for (let page = 1; page <= 4; page++) {
          const batch = await list({
            sortBy,
            sortDirection: "asc",
            page,
            limit: 1,
          });
          assert.equal(batch.total, 4);
          paged.push(...batch.items.map((item) => item.id));
        }
        assert.deepEqual(paged, asc);
      }
      assert.deepEqual(
        (
          await list({ sortBy: "questionCount", sortDirection: "desc" })
        ).items.map((item) => item.id),
        [c.id, b.id, a.id, z.id],
      );
      assert.deepEqual(
        (await list({ sortBy: "state", sortDirection: "desc" })).items.map(
          (item) => item.id,
        ),
        [b.id, c.id, z.id, a.id],
      );
      assert.deepEqual(
        (await list({ sortBy: "questionCount", state: "ACTIVE" })).items.map(
          (item) => item.id,
        ),
        [a.id, z.id],
      );
      assert.deepEqual(
        (
          await list({
            sortBy: "questionCount",
            isActive: "false",
            search: "б ТЕСТ",
          })
        ).items.map((item) => item.id),
        [b.id],
      );
      assert.equal(
        (await list({ sortBy: "questionCount", search: "' OR TRUE --" })).total,
        0,
      );
      assert.deepEqual(
        (await list({ sortBy: "questionCount", page: 5, limit: 1 })).items,
        [],
      );
    } finally {
      await prisma?.$disconnect();
      await environment.close();
    }
  },
);
