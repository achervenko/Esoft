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
import { ChecklistModulesService } from './checklist-modules.service';
import { ChecklistQuestionsService } from '../checklist-questions/checklist-questions.service';
import {
  type ChecklistQuestionReorderPayloadDto,
  parseChecklistQuestionReorderPayload,
} from '../checklist-questions/checklist-questions.validation';
import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
import {
  type ChecklistModulePayloadDto,
  type ChecklistReorderPayloadDto,
  type ChecklistModulesQueryDto,
  parseChecklistModulePayload,
  parseChecklistModuleReorderPayload,
  parseChecklistModuleUpdatePayload,
  parseChecklistModulesQuery,
} from './checklist-modules.validation';

@Controller('api/checklist-modules')
export class ChecklistModulesController {
  constructor(
    private readonly modulesService: ChecklistModulesService,
    private readonly questionsService: ChecklistQuestionsService,
  ) {}

  @Get()
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  list(@Query() query: ChecklistModulesQueryDto) {
    return this.modulesService.list(parseChecklistModulesQuery(query));
  }

  @Get(':id')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  get(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.modulesService.get(id);
  }

  @Post()
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  create(
    @Body() dto: ChecklistModulePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.modulesService.create(
      parseChecklistModulePayload(dto),
      session.user.id,
    );
  }

  @Patch('reorder')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  reorder(
    @Body() dto: ChecklistReorderPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.modulesService.reorder(
      parseChecklistModuleReorderPayload(dto),
      session.user.id,
    );
  }

  @Patch(':moduleId/questions/reorder')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  reorderQuestions(
    @Param('moduleId', ParsePositiveIntPipe) moduleId: number,
    @Body() dto: ChecklistQuestionReorderPayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.questionsService.reorder(
      moduleId,
      parseChecklistQuestionReorderPayload(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: ChecklistModulePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.modulesService.update(
      id,
      parseChecklistModuleUpdatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  activate(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.modulesService.activate(id, session.user.id);
  }

  @Post(':id/deactivate')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  deactivate(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    return this.modulesService.deactivate(id, session.user.id);
  }
}
