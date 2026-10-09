import { ManufacturersAdminService } from './manufacturers-admin.service';
import { EquipmentModelsAdminService } from './equipment-models-admin.service';
import { CountriesAdminService } from './countries-admin.service';
import { ObjectsAdminService } from './objects-admin.service';
import { LocationsAdminService } from './locations-admin.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DictionariesAdminController } from './dictionaries-admin.controller';
import { DictionariesAdminService } from './dictionaries-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [DictionariesAdminController],
  providers: [
    DictionariesAdminService,
    ManufacturersAdminService,
    EquipmentModelsAdminService,
    CountriesAdminService,
    ObjectsAdminService,
    LocationsAdminService,
  ],
})
export class DictionariesAdminModule {}
