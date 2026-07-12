import { Controller, Param, Post } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { assertAdmin } from '../auth/role-permissions';
import { SearchRebuildService } from './search-rebuild.service';

@Controller('api/search/admin')
export class SearchAdminController {
  constructor(private readonly searchRebuild: SearchRebuildService) {}

  @Post('rebuild')
  rebuildAll(@Session() session: UserSession<Auth>) {
    assertAdmin(session.user.role);

    return this.searchRebuild.rebuildAll();
  }

  @Post('rebuild/:entityType')
  rebuildEntityType(
    @Param('entityType') entityType: string,
    @Session() session: UserSession<Auth>,
  ) {
    assertAdmin(session.user.role);

    return this.searchRebuild.rebuildEntityType(entityType);
  }
}
