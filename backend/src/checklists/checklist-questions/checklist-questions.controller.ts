import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { assertAdmin } from '../../auth/role-permissions';
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
  list(
    @Query() query: ChecklistQuestionsQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.list(parseChecklistQuestionsQuery(query));
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.get(id);
  }

  @Post()
  create(
    @Body() dto: ChecklistQuestionPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.create(
      parseChecklistQuestionPayload(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistQuestionPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.update(
      id,
      parseChecklistQuestionUpdatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.activate(id, session.user.id);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.questionsService.deactivate(id, session.user.id);
  }
}
