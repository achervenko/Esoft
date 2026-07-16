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
import { ChecklistModulesService } from './checklist-modules.service';
import {
  type ChecklistModulePayloadDto,
  type ChecklistModulesQueryDto,
  parseChecklistModulePayload,
  parseChecklistModuleUpdatePayload,
  parseChecklistModulesQuery,
} from './checklist-modules.validation';

@Controller('api/checklist-modules')
export class ChecklistModulesController {
  constructor(private readonly modulesService: ChecklistModulesService) {}

  @Get()
  list(
    @Query() query: ChecklistModulesQueryDto,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.list(parseChecklistModulesQuery(query));
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.get(id);
  }

  @Post()
  create(
    @Body() dto: ChecklistModulePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.create(
      parseChecklistModulePayload(dto),
      session.user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChecklistModulePayloadDto | undefined,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.update(
      id,
      parseChecklistModuleUpdatePayload(dto),
      session.user.id,
    );
  }

  @Post(':id/activate')
  activate(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.activate(id, session.user.id);
  }

  @Post(':id/deactivate')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.modulesService.deactivate(id, session.user.id);
  }
}
