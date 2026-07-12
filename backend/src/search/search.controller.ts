import { Controller, Get, Query } from '@nestjs/common';
import { SearchQueryService } from './search-query.service';

@Controller('api/search')
export class SearchController {
  constructor(private readonly searchQuery: SearchQueryService) {}

  @Get()
  search(
    @Query('q') query?: string,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.searchQuery.search({
      entityType,
      limit,
      offset,
      query,
    });
  }
}
