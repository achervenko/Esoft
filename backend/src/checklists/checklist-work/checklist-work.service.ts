import { Injectable } from '@nestjs/common';
import { ChecklistWorkAnswersService } from './checklist-work-answers.service';
import { ChecklistWorkLifecycleService } from './checklist-work-lifecycle.service';
import { ChecklistWorkQueryService } from './checklist-work-query.service';
import type {
  ChecklistAnswersInput,
  ChecklistVersionInput,
  ChecklistWorkQuery,
} from './checklist-work.types';

@Injectable()
export class ChecklistWorkService {
  constructor(
    private readonly answersService: ChecklistWorkAnswersService,
    private readonly lifecycleService: ChecklistWorkLifecycleService,
    private readonly queryService: ChecklistWorkQueryService,
  ) {}

  list(params: {
    query: ChecklistWorkQuery;
    userId?: string | null;
  }) {
    return this.queryService.list(params);
  }

  get(id: number, params: { userId?: string | null }) {
    return this.queryService.get(id, params);
  }

  start(id: number, input: ChecklistVersionInput, userId?: string | null) {
    return this.lifecycleService.start(id, input, userId);
  }

  saveAnswers(
    id: number,
    input: ChecklistAnswersInput,
    userId?: string | null,
  ) {
    return this.answersService.saveAnswers(id, input, userId);
  }

  complete(id: number, input: ChecklistVersionInput, userId?: string | null) {
    return this.lifecycleService.complete(id, input, userId);
  }
}
