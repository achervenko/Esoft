import { CHECKLISTS_PERMISSIONS } from '../checklists.permissions';
import { RequirePermission } from '../../auth/require-permission';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../../auth/auth.config';
import { ParsePositiveIntPipe } from '../../application/pipes/parse-positive-int.pipe';
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
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  list(@Query() query: ChecklistTemplatesQueryDto) {
    return this.templatesService.list(parseChecklistTemplatesQuery(query));
  }

  @Get(':id')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  get(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.templatesService.get(id);
  }

  @Post()
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  create(
    @Body() dto: ChecklistTemplatePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.templatesService.create(
      parseChecklistTemplatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/archive')
  @RequirePermission(CHECKLISTS_PERMISSIONS.MANAGE)
  archive(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: ArchiveTemplateDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    return this.templatesService.archive(
      id,
      parseArchiveTemplateDto(dto),
      session.user.id,
    );
  }
}
