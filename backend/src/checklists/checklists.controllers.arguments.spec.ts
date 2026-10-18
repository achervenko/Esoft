jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});

import type { ExecutionContext } from '@nestjs/common';
import { createChecklistHttpFixture } from './checklists-http.spec-fixtures';
import type { HttpOperation } from '../auth/permissions-http.fixture';

describe('Checklist controller arguments through HTTP', () => {
  let http: Awaited<ReturnType<typeof createChecklistHttpFixture>>;
  beforeAll(async () => {
    http = await createChecklistHttpFixture();
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(
      0,
      http.modules.length,
      'equipment',
      'ppe',
      'warehouse',
    );
  });
  const request = (operation: HttpOperation, role?: string) =>
    http.request(operation, role);
  describe.each(['modules', 'questions'])(
    'checklist %s lifecycle actor',
    (resource) => {
      it.each(['activate', 'deactivate'])(
        'forwards ID and actor for %s',
        async (action) => {
          const group = resource === 'modules' ? 0 : 1;
          expect(
            (
              await request(
                {
                  path: `/api/checklist-${resource}/1/${action}`,
                  method: 'POST',
                },
                'admin',
              )
            ).status,
          ).toBe(201);
          expect(http.services[group][action]).toHaveBeenCalledWith(1, 'actor');
        },
      );
    },
  );
  it.each([
    {
      path: '/api/checklist-modules',
      method: 'POST',
      group: 0,
      action: 'create',
      body: { name: ' Module ', description: ' Description ' },
      args: [{ name: 'Module', description: 'Description' }, 'actor'],
    },
    {
      path: '/api/checklist-modules/1',
      method: 'PATCH',
      group: 0,
      action: 'update',
      body: { name: ' Updated ' },
      args: [1, { name: 'Updated' }, 'actor'],
    },
    {
      path: '/api/checklist-questions',
      method: 'POST',
      group: 1,
      action: 'create',
      body: {
        questionText: ' Question ',
        answerType: 'BOOLEAN',
        checklistModuleId: '2',
      },
      args: [
        {
          questionText: 'Question',
          answerType: 'BOOLEAN',
          checklistModuleId: 2,
        },
        'actor',
      ],
    },
    {
      path: '/api/checklist-questions/1',
      method: 'PATCH',
      group: 1,
      action: 'update',
      body: { questionText: ' Updated ' },
      args: [1, { questionText: 'Updated' }, 'actor'],
    },
    {
      path: '/api/checklist-templates',
      method: 'POST',
      group: 2,
      action: 'create',
      body: {
        name: ' Template ',
        description: ' Description ',
        modules: [
          { checklistModuleId: '2', questions: [{ checklistQuestionId: '3' }] },
        ],
      },
      args: [
        {
          name: 'Template',
          description: 'Description',
          modules: [
            {
              checklistModuleId: 2,
              sortOrder: 1,
              questions: [
                { checklistQuestionId: 3, sortOrder: 1, isRequired: true },
              ],
            },
          ],
        },
        'actor',
      ],
    },
    {
      path: '/api/checklist-templates/1/archive',
      method: 'POST',
      group: 2,
      action: 'archive',
      body: { reason: ' Obsolete ', version: '2' },
      args: [1, { reason: 'Obsolete', version: 2 }, 'actor'],
    },
    {
      path: '/api/checklist-modules/reorder',
      method: 'PATCH',
      group: 0,
      action: 'reorder',
      body: { items: [{ id: '2', sortOrder: '1' }] },
      args: [{ items: [{ id: 2, sortOrder: 1 }] }, 'actor'],
    },
    {
      path: '/api/checklist-modules/1/questions/reorder',
      method: 'PATCH',
      group: 1,
      action: 'reorder',
      body: { items: [{ id: '2', sortOrder: '1' }] },
      args: [1, { items: [{ id: 2, sortOrder: 1 }] }, 'actor'],
    },
  ])('forwards parsed arguments: $method $path', async (operation) => {
    expect((await request(operation, 'admin')).status).toBe(
      operation.method === 'POST' ? 201 : 200,
    );
    expect(
      http.services[operation.group][operation.action],
    ).toHaveBeenCalledWith(...operation.args);
  });
});
