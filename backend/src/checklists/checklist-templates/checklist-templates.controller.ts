import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { assertAdmin } from '../../auth/role-permissions';
import { ChecklistTemplatesService } from './checklist-templates.service';
import type {
  AddTemplateModuleDto,
  AddTemplateQuestionDto,
  ArchiveTemplateDto,
  ChecklistTemplatePayloadDto,
  ChecklistTemplateUpdateDto,
  ChecklistTemplatesQueryDto,
  CopyTemplateDto,
  ModuleOrderDto,
  QuestionOrderDto,
  TemplateMutationVersionDto,
  UpdateTemplateQuestionDto,
} from './checklist-templates.dto';
import {
  parseArchiveTemplateDto,
  parseCopyTemplateDto,
  parseTemplateMutationVersionDto,
} from './checklist-template-lifecycle.validation';
import {
  parseAddTemplateModuleDto,
  parseAddTemplateQuestionDto,
  parseModuleOrderDto,
  parseQuestionOrderDto,
  parseUpdateTemplateQuestionDto,
} from './checklist-template-structure.validation';
import {
  parseChecklistTemplatePayload,
  parseChecklistTemplateUpdatePayload,
} from './checklist-template.validation';
import { parseChecklistTemplatesQuery } from './checklist-templates-query.validation';

@Controller('api/checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly templatesService: ChecklistTemplatesService) {}

  @Get()
  list(
    @Query() query: ChecklistTemplatesQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.list(parseChecklistTemplatesQuery(query));
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.get(id);
  }

  @Post()
  create(
    @Body() dto: ChecklistTemplatePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.create(
      parseChecklistTemplatePayload(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistTemplateUpdateDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.update(
      id,
      parseChecklistTemplateUpdatePayload(dto),
      session.user.id,
    );
  }

  @Delete(':id')
  deleteDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TemplateMutationVersionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.deleteDraft(
      id,
      parseTemplateMutationVersionDto(dto),
      session.user.id,
    );
  }

  @Post(':templateId/modules')
  addModule(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: AddTemplateModuleDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.addModule(
      templateId,
      parseAddTemplateModuleDto(dto),
      session.user.id,
    );
  }

  @Delete(':templateId/modules/:templateModuleId')
  removeModule(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('templateModuleId', ParseIntPipe) templateModuleId: number,
    @Body() dto: TemplateMutationVersionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.removeModule(
      templateId,
      templateModuleId,
      parseTemplateMutationVersionDto(dto),
      session.user.id,
    );
  }

  @Put(':templateId/modules/order')
  reorderModules(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: ModuleOrderDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.reorderModules(
      templateId,
      parseModuleOrderDto(dto),
      session.user.id,
    );
  }

  @Post(':templateId/modules/:templateModuleId/questions')
  addQuestion(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('templateModuleId', ParseIntPipe) templateModuleId: number,
    @Body() dto: AddTemplateQuestionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.addQuestion(
      templateId,
      templateModuleId,
      parseAddTemplateQuestionDto(dto),
      session.user.id,
    );
  }

  @Patch(':templateId/questions/:templateQuestionId')
  updateQuestion(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('templateQuestionId', ParseIntPipe) templateQuestionId: number,
    @Body() dto: UpdateTemplateQuestionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.updateQuestion(
      templateId,
      templateQuestionId,
      parseUpdateTemplateQuestionDto(dto),
      session.user.id,
    );
  }

  @Delete(':templateId/questions/:templateQuestionId')
  removeQuestion(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('templateQuestionId', ParseIntPipe) templateQuestionId: number,
    @Body() dto: TemplateMutationVersionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.removeQuestion(
      templateId,
      templateQuestionId,
      parseTemplateMutationVersionDto(dto),
      session.user.id,
    );
  }

  @Put(':templateId/modules/:templateModuleId/questions/order')
  reorderQuestions(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('templateModuleId', ParseIntPipe) templateModuleId: number,
    @Body() dto: QuestionOrderDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.reorderQuestions(
      templateId,
      templateModuleId,
      parseQuestionOrderDto(dto),
      session.user.id,
    );
  }

  @Post(':id/publish')
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TemplateMutationVersionDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.publish(
      id,
      parseTemplateMutationVersionDto(dto),
      session.user.id,
    );
  }

  @Post(':id/archive')
  archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArchiveTemplateDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.archive(
      id,
      parseArchiveTemplateDto(dto),
      session.user.id,
    );
  }

  @Post(':id/copy')
  copy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CopyTemplateDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.templatesService.copy(
      id,
      parseCopyTemplateDto(dto),
      session.user.id,
    );
  }
}
