import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { assertCanManageChecklists } from '../../auth/role-permissions';
import { ChecklistTemplatesService } from './checklist-templates.service';
import type {
  ArchiveTemplateDto,
  ChecklistTemplatePayloadDto,
  ChecklistTemplatesQueryDto,
} from './checklist-templates.dto';
import { parseArchiveTemplateDto } from './checklist-template-lifecycle.validation';
import { parseChecklistTemplatePayload } from './checklist-template.validation';
import { parseChecklistTemplatesQuery } from './checklist-templates-query.validation';

@Controller('api/checklist-templates')
export class ChecklistTemplatesController {
  constructor(private readonly templatesService: ChecklistTemplatesService) {}

  @Get()
  list(
    @Query() query: ChecklistTemplatesQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageChecklists(session.user.role);

    return this.templatesService.list(parseChecklistTemplatesQuery(query));
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageChecklists(session.user.role);

    return this.templatesService.get(id);
  }

  @Post()
  create(
    @Body() dto: ChecklistTemplatePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageChecklists(session.user.role);

    return this.templatesService.create(
      parseChecklistTemplatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/archive')
  archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArchiveTemplateDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertCanManageChecklists(session.user.role);

    return this.templatesService.archive(
      id,
      parseArchiveTemplateDto(dto),
      session.user.id,
    );
  }
}
