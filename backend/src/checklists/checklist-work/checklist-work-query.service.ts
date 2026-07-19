import { Injectable } from '@nestjs/common';
import {
  throwChecklistForbidden,
  throwChecklistNotFound,
} from '../checklist-common/checklists.errors';
import {
  presentChecklistDetail,
  presentChecklistList,
} from './checklist-work.presenter';
import { ChecklistWorkQueryRepository } from './checklist-work.repository';
import { ChecklistWorkAssertions } from './checklist-work.assertions';
import type { ChecklistWorkQuery } from './checklist-work.types';

@Injectable()
export class ChecklistWorkQueryService {
  constructor(
    private readonly assertions: ChecklistWorkAssertions,
    private readonly queryRepository: ChecklistWorkQueryRepository,
  ) {}

  async list(params: {
    query: ChecklistWorkQuery;
    userId?: string | null;
  }) {
    const userId = this.assertions.requireUserId(params.userId);
    const result = await this.queryRepository.list({
      query: params.query,
      userId,
    });

    return presentChecklistList(result);
  }

  async get(
    id: number,
    params: { userId?: string | null },
  ) {
    const userId = this.assertions.requireUserId(params.userId);
    const checklist = await this.queryRepository.loadDetailForAccess(id);

    if (!checklist) {
      throwChecklistNotFound('CHECKLIST_NOT_FOUND', 'Чек-лист не найден.');
    }

    if (checklist.assignedUserId !== userId) {
      throwChecklistForbidden(
        'CHECKLIST_ACCESS_DENIED',
        'Недостаточно прав для просмотра чек-листа.',
      );
    }

    return presentChecklistDetail(
      checklist,
      await this.queryRepository.loadDetailQuestions(id),
    );
  }
}
