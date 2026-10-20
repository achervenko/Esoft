import { Prisma } from '@prisma/client';
import {
  PpeIssueNormsGuardService,
  type IssueEmployee,
  type IssueNorm,
} from './ppe-issue-norms-guard.service';

it('ignores an additional assignment to the primary position and preserves its assignment date', async () => {
  const service = new PpeIssueNormsGuardService();
  const assignedAt = new Date('2026-01-01');
  const employee = {
    positionId: 1,
    gender: 'MALE',
    positionAssignedAt: assignedAt,
    additionalPositions: [
      { positionId: 1, assignedAt: new Date('2026-02-01') },
      { positionId: 2, assignedAt },
    ],
  } as IssueEmployee;
  const lockPosition = jest
    .spyOn(service, 'lockPosition')
    .mockResolvedValue({} as never);
  const lockNorm = jest
    .spyOn(service, 'lockEffectiveNorm')
    .mockImplementation((_tx, positionId) =>
      Promise.resolve({
        id: positionId,
        items: [
          {
            id: positionId,
            ppeItemId: 10,
            quantity: new Prisma.Decimal(positionId),
          },
        ],
      } as IssueNorm),
    );
  const result = await service.lockEmployeeNorms(
    {} as never,
    employee,
    new Date('2026-10-20'),
  );
  expect(result.assignments).toEqual([
    { positionId: 1, assignedAt },
    { positionId: 2, assignedAt },
  ]);
  expect(lockPosition).toHaveBeenCalledTimes(2);
  expect(lockNorm).toHaveBeenCalledTimes(2);
  expect(
    result.current.flatMap((norm) => norm.items).map((item) => item.id),
  ).toEqual([2]);
});
