import { createRequire } from 'node:module';
import { after } from 'node:test';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPpeNormTestEnvironment } from '../ppe-norms/ppe-norms.integration.setup.mjs';

const require = createRequire(import.meta.url);
const {
  PpeCatalogSizesService,
} = require('../../dist/src/ppe/ppe-catalog-sizes.service.js');
const {
  PpeNormPositionService,
} = require('../../dist/src/ppe/ppe-norm-position.service.js');
const {
  PpeNormTransitionService,
} = require('../../dist/src/ppe/ppe-norm-transition.service.js');
const {
  PpeIssuePlanService,
} = require('../../dist/src/ppe/ppe-issue-plan.service.js');
const {
  PpeIssueCreateService,
} = require('../../dist/src/ppe/ppe-issue-create.service.js');
const {
  PpeIssueHistoryService,
} = require('../../dist/src/ppe/ppe-issue-history.service.js');
const {
  PpeCatalogService,
} = require('../../dist/src/ppe/ppe-catalog.service.js');
const {
  PpeIssuesService,
} = require('../../dist/src/ppe/ppe-issues.service.js');
const {
  PpeIssuesGuardsService,
} = require('../../dist/src/ppe/ppe-issues-guards.service.js');
const {
  PpeIssueScheduleService,
} = require('../../dist/src/ppe/ppe-issue-schedule.service.js');
const {
  PpeIssuesAuditService,
} = require('../../dist/src/ppe/ppe-issues-audit.service.js');

const {
  PpeNormIntervalTransitionService,
} = require('../../dist/src/ppe/ppe-norm-interval-transition.service.js');
const {
  PpeNormMonthlyTransitionService,
} = require('../../dist/src/ppe/ppe-norm-monthly-transition.service.js');

export async function createPpeIssueTestEnvironment() {
  const env = await createPpeNormTestEnvironment();
  const { prisma, day, actor, AuditLogService } = env;
  function createIssuesService(
    client = prisma,
    audit = new PpeIssuesAuditService(new AuditLogService(prisma)),
  ) {
    const guards = new PpeIssuesGuardsService();
    const interval = new PpeNormIntervalTransitionService();
    const schedule = new PpeNormTransitionService(
      new PpeIssueScheduleService(),
      new PpeNormPositionService(),
      interval,
      new PpeNormMonthlyTransitionService(interval),
    );
    const history = new PpeIssueHistoryService();
    return new PpeIssuesService(
      client,
      guards,
      audit,
      new PpeIssuePlanService(client, guards, schedule, history),
      new PpeIssueCreateService(client, guards, schedule, audit, history),
    );
  }
  const issues = createIssuesService();
  const specialist = { userId: actor, role: 'ppe_specialist' };
  const adminActor = { userId: actor, role: 'admin' };
  async function issueFixture({
    from = day(-2),
    quantity = 2,
    periodCount = 1,
    periodUnit = 'YEAR',
    type = 'FEET',
    unit = 'пары',
    multiple = false,
  } = {}) {
    const f = await env.fixture();
    const ppe = await prisma.ppeItem.update({
      where: { id: f.items[0].id },
      data: { type, unit },
    });
    const sizeValues =
      type === 'FEET'
        ? ['42', '43', '40']
        : type === 'BODY'
          ? ['88–92', '96–100', '84–88']
          : type === 'HANDS'
            ? ['L', 'XL', 'S']
            : ['58', '60', '56'];
    const sizes =
      type === 'OTHER'
        ? []
        : await Promise.all(
            sizeValues.map((value, index) =>
              prisma.ppeItemSize.create({
                data: {
                  ppeItemId: ppe.id,
                  value,
                  heightValue: type === 'BODY' ? '158–164' : null,
                  isActive: index !== 2,
                },
              }),
            ),
          );
    const employee = await prisma.employee.create({
      data: {
        lastName: 'Tester',
        firstName: 'PPE',
        positionId: f.position.id,
        clothingSize: '88–92',
        clothingHeight: '158–164',
        shoeSize: 42,
        gloveSize: 'L',
        headwearSize: '58',
      },
    });
    const rows = [{ ppeItemId: ppe.id, quantity, periodCount, periodUnit }];
    if (multiple) rows.push({ ...rows[0], ppeItemId: f.items[1].id });
    const norm = await env.service.create(
      {
        positionId: f.position.id,
        effectiveFrom: from,
        effectiveTo: null,
        items: rows,
      },
      actor,
    );
    const request = {
      employeeId: employee.id,
      items: [{ normItemId: norm.items[0].id, ppeItemId: ppe.id }],
    };
    return { ...f, employee, ppe, sizes, norm, request };
  }
  return {
    ...env,
    issues,
    catalog: new PpeCatalogService(
      prisma,
      new env.PpeAuditService(new AuditLogService(prisma)),
      new PpeCatalogSizesService(
        prisma,
        new env.PpeAuditService(new AuditLogService(prisma)),
      ),
    ),
    specialist,
    adminActor,
    issueFixture,
    createIssuesService,
    PpeIssuesAuditService,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const groups = await Promise.all(
    [
      'regular',
      'catalog',
      'sizes',
      'extra-history',
      'transactions-concurrency',
      'logic-fixes',
      'transitions',
      'position',
    ].map((name) => import(`./ppe-issues-${name}.integration.test.mjs`)),
  );
  const env = await createPpeIssueTestEnvironment();
  after(() => env.cleanup());
  try {
    for (const { registerTests } of groups) registerTests(env);
  } catch (error) {
    await env.cleanup();
    throw error;
  }
}
