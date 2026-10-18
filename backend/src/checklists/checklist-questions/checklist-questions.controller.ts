import { CHECKLISTS_PERMISSIONS } from '../checklists.permissions';
import { RequirePermission } from '../../auth/require-permission';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
import { ChecklistQuestionsService } from './checklist-questions.service';
import {
  type ChecklistQuestionPayloadDto,
  type ChecklistQuestionsQueryDto,
  parseChecklistQuestionPayload,
  parseChecklistQuestionUpdatePayload,
  parseChecklistQuestionsQuery,
} from './checklist-questions.validation';

@Controller('api/checklist-questions')
export class ChecklistQuestionsController {
  constructor(private readonly questionsService: ChecklistQuestionsService) {}

  @Get()
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  list(@Query() query: ChecklistQuestionsQueryDto) {
    return this.questionsService.list(parseChecklistQuestionsQuery(query));
  }

  @Get(':id')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  get(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.questionsService.get(id);
  }

  @Post()
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  create(
    @Body() dto: ChecklistQuestionPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.questionsService.create(
      parseChecklistQuestionPayload(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: ChecklistQuestionPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.questionsService.update(
      id,
      parseChecklistQuestionUpdatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  activate(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.questionsService.activate(id, session.user.id);
  }

  @Post(':id/deactivate')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  deactivate(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.questionsService.deactivate(id, session.user.id);
  }
}
