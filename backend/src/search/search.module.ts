import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentSearchProjector } from './equipment-search.projector';
import { SearchAdminController } from './search-admin.controller';
import { SearchController } from './search.controller';
import { SearchIndexService } from './search-index.service';
import { SearchQueryService } from './search-query.service';
import { SearchRebuildService } from './search-rebuild.service';

@Module({
  controllers: [SearchAdminController, SearchController],
  providers: [
    EquipmentSearchProjector,
    PrismaService,
    SearchIndexService,
    SearchQueryService,
    SearchRebuildService,
  ],
  exports: [EquipmentSearchProjector, SearchIndexService],
})
export class SearchModule {}
