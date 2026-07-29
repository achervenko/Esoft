import { Module } from '@nestjs/common';
import { EVENT_EXTENSION_ADAPTERS } from '../events/event-extensions/event-extension.adapter';
import { EquipmentEventExtensionAdapter } from './equipment-event-extension.adapter';
import { EquipmentEventExtensionCreate } from './equipment-event-extension.create';
import { EquipmentEventExtensionInputLoader } from './equipment-event-extension-input.loader';
import { EquipmentEventExtensionQuery } from './equipment-event-extension.query';
import { EquipmentEventExtensionService } from './equipment-event-extension.service';
import { EquipmentEventExtensionUpdate } from './equipment-event-extension.update';
import { EquipmentEventExtensionValidation } from './equipment-event-extension.validation';

@Module({
  providers: [
    EquipmentEventExtensionAdapter,
    EquipmentEventExtensionCreate,
    {
      provide: EVENT_EXTENSION_ADAPTERS,
      useFactory: (
        equipmentEventExtensionAdapter: EquipmentEventExtensionAdapter,
      ) => [equipmentEventExtensionAdapter],
      inject: [EquipmentEventExtensionAdapter],
    },
    EquipmentEventExtensionInputLoader,
    EquipmentEventExtensionQuery,
    EquipmentEventExtensionService,
    EquipmentEventExtensionUpdate,
    EquipmentEventExtensionValidation,
  ],
  exports: [
    EVENT_EXTENSION_ADAPTERS,
    EquipmentEventExtensionAdapter,
    EquipmentEventExtensionService,
  ],
})
export class EquipmentEventExtensionModule {}
