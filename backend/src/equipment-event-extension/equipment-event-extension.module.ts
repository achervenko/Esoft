import { Module } from '@nestjs/common';
import { EquipmentEventExtensionInputLoader } from './equipment-event-extension-input.loader';
import { EquipmentEventExtensionService } from './equipment-event-extension.service';

@Module({
  providers: [
    EquipmentEventExtensionInputLoader,
    EquipmentEventExtensionService,
  ],
  exports: [EquipmentEventExtensionService],
})
export class EquipmentEventExtensionModule {}
