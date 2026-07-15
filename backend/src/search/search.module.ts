import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipmentSearchProjector } from './equipment-search.projector';
import { SearchAdminController } from './search-admin.controller';
import { SearchController } from './search.controller';
import { SearchIndexService } from './search-index.service';
import { SearchQueryService } from './search-query.service';
import { SearchRebuildService } from './search-rebuild.service';

@Module({
  imports: [PrismaModule],
  controllers: [SearchAdminController, SearchController],
  providers: [
    EquipmentSearchProjector,
    SearchIndexService,
    SearchQueryService,
    SearchRebuildService,
  ],
  exports: [EquipmentSearchProjector, SearchIndexService],
})
export class SearchModule {}
