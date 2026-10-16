import { ForbiddenException } from '@nestjs/common';
import {
  createController,
  operations,
  session,
} from './ppe.controller.spec-fixtures';

describe.each(['admin', 'ppe_specialist'])('PPE controller role %s', (role) => {
  it.each(operations)('enforces access for $name', async ({ name, invoke }) => {
    const { controller, catalog } = createController();
    if (
      role === 'ppe_specialist' &&
      /^(create PPE|update PPE|change PPE|replace PPE)/.test(name)
    ) {
      expect(() => invoke(controller, session(role))).toThrow(
        ForbiddenException,
      );
      for (const mock of Object.values(catalog))
        expect(mock).not.toHaveBeenCalled();
      return;
    }
    await expect(
      Promise.resolve(invoke(controller, session(role))),
    ).resolves.toBeDefined();
  });
});

describe.each(['operator', 'engineer', 'chief_engineer', 'auditor'])(
  'PPE controller forbidden role %s',
  (role) => {
    it.each(operations)(
      'denies $name before calling the service',
      ({ invoke }) => {
        const { controller, catalog, employees, norms } = createController();
        expect(() => invoke(controller, session(role))).toThrow(
          ForbiddenException,
        );
        for (const mock of [
          ...Object.values(catalog),
          ...Object.values(employees),
          ...Object.values(norms),
        ])
          expect(mock).not.toHaveBeenCalled();
      },
    );
  },
);
