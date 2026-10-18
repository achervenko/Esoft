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
  @RequirePermission(CHECKLISTS_PERMISSIONS.WORK)
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
  @RequirePermission(CHECKLISTS_PERMISSIONS.WORK)
  get(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.checklistWorkService.get(id, {
      userId: session.user.id,
    });
  }

  @Post(':id/start')
  @RequirePermission(CHECKLISTS_PERMISSIONS.WORK)
  start(
    @Param('id', ParsePositiveIntPipe) id: number,
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
  @RequirePermission(CHECKLISTS_PERMISSIONS.WORK)
  saveAnswers(
    @Param('id', ParsePositiveIntPipe) id: number,
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
  @RequirePermission(CHECKLISTS_PERMISSIONS.WORK)
  complete(
    @Param('id', ParsePositiveIntPipe) id: number,
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
