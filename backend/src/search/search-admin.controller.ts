import { SEARCH_PERMISSIONS } from './search.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Controller, Param, Post } from '@nestjs/common';
import { SearchRebuildService } from './search-rebuild.service';

@Controller('api/search/admin')
export class SearchAdminController {
  constructor(private readonly searchRebuild: SearchRebuildService) {}

  @Post('rebuild')
  @RequirePermission(SEARCH_PERMISSIONS.MANAGE)
  rebuildAll() {
    return this.searchRebuild.rebuildAll();
  }

  @Post('rebuild/:entityType')
  @RequirePermission(SEARCH_PERMISSIONS.MANAGE)
  rebuildEntityType(@Param('entityType') entityType: string) {
    return this.searchRebuild.rebuildEntityType(entityType);
  }
}
