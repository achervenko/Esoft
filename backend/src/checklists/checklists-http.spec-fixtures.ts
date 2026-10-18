import { ChecklistModulesController } from './checklist-modules/checklist-modules.controller';
import { ChecklistModulesService } from './checklist-modules/checklist-modules.service';
import { ChecklistQuestionsController } from './checklist-questions/checklist-questions.controller';
import { ChecklistQuestionsService } from './checklist-questions/checklist-questions.service';
import { ChecklistTemplatesController } from './checklist-templates/checklist-templates.controller';
import { ChecklistTemplatesService } from './checklist-templates/checklist-templates.service';

import { createPermissionsHttpFixture } from '../auth/permissions-http.fixture';

export async function createChecklistHttpFixture() {
  const services = [0, 1, 2].map(() =>
    Object.fromEntries(
      [
        'list',
        'get',
        'create',
        'update',
        'activate',
        'deactivate',
        'reorder',
        'archive',
      ].map((action) => [
        action,
        jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
      ]),
    ),
  );
  const http = await createPermissionsHttpFixture({
    controllers: [
      ChecklistModulesController,
      ChecklistQuestionsController,
      ChecklistTemplatesController,
    ],
    providers: [
      ChecklistModulesService,
      ChecklistQuestionsService,
      ChecklistTemplatesService,
    ].map((provide, index) => ({ provide, useValue: services[index] })),
  });
  return {
    ...http,
    services,
    expectNoServiceCalls() {
      for (const service of services)
        for (const mock of Object.values(service))
          expect(mock).not.toHaveBeenCalled();
    },
  };
}
