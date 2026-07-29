import { AuditAction, ChecklistStatus } from '@prisma/client';
import { ChecklistEventCompletionService } from './checklist-event-completion.service';

jest.mock('../checklist-common/checklists.audit', () => ({
  writeChecklistAudit: jest.fn(),
}));

import { writeChecklistAudit } from '../checklist-common/checklists.audit';

const writeChecklistAuditMock = writeChecklistAudit as jest.MockedFunction<
  typeof writeChecklistAudit
>;

describe('ChecklistEventCompletionService', () => {
  function createService() {
    const service = new ChecklistEventCompletionService();

    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    return {
      service,
      tx,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancels active event checklist and writes neutral audit', async () => {
    const { service, tx } = createService();

    await service.cancelActiveChecklistsForCancelledEvent(
      tx as never,
      [
        {
          id: 10,
          status: ChecklistStatus.IN_PROGRESS,
        },
      ],
      'user-1',
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);

    expect(writeChecklistAuditMock).toHaveBeenCalledWith(tx, {
      action: AuditAction.STATUS_CHANGE,
      entityId: 10,
      entityType: 'event_checklist',
      fieldName: 'status',
      newValue: ChecklistStatus.CANCELLED,
      oldValue: ChecklistStatus.IN_PROGRESS,
      userId: 'user-1',
    });
  });

  it('cancels all supplied active checklists', async () => {
    const { service, tx } = createService();

    await service.cancelActiveChecklistsForCancelledEvent(
      tx as never,
      [
        {
          id: 10,
          status: ChecklistStatus.CREATED,
        },
        {
          id: 11,
          status: ChecklistStatus.IN_PROGRESS,
        },
      ],
      'user-1',
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(writeChecklistAuditMock).toHaveBeenCalledTimes(2);
  });

  it('does nothing when no active checklists are supplied', async () => {
    const { service, tx } = createService();

    await service.cancelActiveChecklistsForCancelledEvent(
      tx as never,
      [],
      'user-1',
    );

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(writeChecklistAuditMock).not.toHaveBeenCalled();
  });
});
