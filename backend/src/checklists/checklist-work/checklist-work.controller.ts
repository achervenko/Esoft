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
import { ChecklistWorkService } from './checklist-work.service';
import type {
  ChecklistAnswersDto,
  ChecklistCompleteDto,
  ChecklistVersionDto,
  ChecklistWorkQueryDto,
} from './checklist-work.types';
import {
  parseChecklistAnswersDto,
  parseChecklistCompleteDto,
  parseChecklistVersionDto,
  parseChecklistWorkQuery,
} from './checklist-work.validation';

@Controller('api/checklists')
export class ChecklistWorkController {
  constructor(private readonly checklistWorkService: ChecklistWorkService) {}

  @Get()
  list(
    @Query() query: ChecklistWorkQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.list({
      query: parseChecklistWorkQuery(query),
      userId: session.user.id,
    });
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.get(id, {
      userId: session.user.id,
    });
  }

  @Post(':id/start')
  start(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistVersionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.start(
      id,
      parseChecklistVersionDto(dto),
      session.user.id,
    );
  }

  @Patch(':id/answers')
  saveAnswers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistAnswersDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.saveAnswers(
      id,
      parseChecklistAnswersDto(dto),
      session.user.id,
    );
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistCompleteDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.complete(
      id,
      parseChecklistCompleteDto(dto),
      session.user.id,
    );
  }
}
