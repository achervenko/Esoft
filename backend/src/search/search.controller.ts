import { SEARCH_PERMISSIONS } from './search.permissions';
import { RequirePermission } from '../auth/require-permission';
import { Controller, Get, Query } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Auth } from '../auth/auth.config';
import { SearchQueryService } from './search-query.service';

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchQuery: SearchQueryService) {}

  @Get()
  @RequirePermission(SEARCH_PERMISSIONS.READ)
  search(
    @Session() session: UserSession<Auth>,
    @Query('q') query?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('module') module?: string,
  ) {
    return this.searchQuery.search(
      {
        entityType,
        module,
        limit,
        offset,
        query,
      },
      session.user.role,
    );
  }
}
