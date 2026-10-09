import { Injectable } from '@nestjs/common';
import { ManufacturersAdminService } from './manufacturers-admin.service';
import { EquipmentModelsAdminService } from './equipment-models-admin.service';
import { CountriesAdminService } from './countries-admin.service';
import { ObjectsAdminService } from './objects-admin.service';
import { LocationsAdminService } from './locations-admin.service';

@Injectable()
export class DictionariesAdminService {
  constructor(
    private readonly manufacturers: ManufacturersAdminService,
    private readonly equipmentModels: EquipmentModelsAdminService,
    private readonly countries: CountriesAdminService,
    private readonly objects: ObjectsAdminService,
    private readonly locations: LocationsAdminService,
  ) {}

  getOverview() {
    return { dictionaries: [] };
  }

  listManufacturers(
    ...args: Parameters<ManufacturersAdminService['listManufacturers']>
  ) {
    return this.manufacturers.listManufacturers(...args);
  }

  createManufacturer(
    ...args: Parameters<ManufacturersAdminService['createManufacturer']>
  ) {
    return this.manufacturers.createManufacturer(...args);
  }

  updateManufacturer(
    ...args: Parameters<ManufacturersAdminService['updateManufacturer']>
  ) {
    return this.manufacturers.updateManufacturer(...args);
  }

  deleteManufacturer(
    ...args: Parameters<ManufacturersAdminService['deleteManufacturer']>
  ) {
    return this.manufacturers.deleteManufacturer(...args);
  }

  listEquipmentModels(
    ...args: Parameters<EquipmentModelsAdminService['listEquipmentModels']>
  ) {
    return this.equipmentModels.listEquipmentModels(...args);
  }

  createEquipmentModel(
    ...args: Parameters<EquipmentModelsAdminService['createEquipmentModel']>
  ) {
    return this.equipmentModels.createEquipmentModel(...args);
  }

  updateEquipmentModel(
    ...args: Parameters<EquipmentModelsAdminService['updateEquipmentModel']>
  ) {
    return this.equipmentModels.updateEquipmentModel(...args);
  }

  deleteEquipmentModel(
    ...args: Parameters<EquipmentModelsAdminService['deleteEquipmentModel']>
  ) {
    return this.equipmentModels.deleteEquipmentModel(...args);
  }

  listCountries(...args: Parameters<CountriesAdminService['listCountries']>) {
    return this.countries.listCountries(...args);
  }

  createCountry(...args: Parameters<CountriesAdminService['createCountry']>) {
    return this.countries.createCountry(...args);
  }

  updateCountry(...args: Parameters<CountriesAdminService['updateCountry']>) {
    return this.countries.updateCountry(...args);
  }

  deleteCountry(...args: Parameters<CountriesAdminService['deleteCountry']>) {
    return this.countries.deleteCountry(...args);
  }

  listObjects(...args: Parameters<ObjectsAdminService['listObjects']>) {
    return this.objects.listObjects(...args);
  }

  createObject(...args: Parameters<ObjectsAdminService['createObject']>) {
    return this.objects.createObject(...args);
  }

  updateObject(...args: Parameters<ObjectsAdminService['updateObject']>) {
    return this.objects.updateObject(...args);
  }

  deleteObject(...args: Parameters<ObjectsAdminService['deleteObject']>) {
    return this.objects.deleteObject(...args);
  }

  listLocations(...args: Parameters<LocationsAdminService['listLocations']>) {
    return this.locations.listLocations(...args);
  }

  createLocation(...args: Parameters<LocationsAdminService['createLocation']>) {
    return this.locations.createLocation(...args);
  }

  updateLocation(...args: Parameters<LocationsAdminService['updateLocation']>) {
    return this.locations.updateLocation(...args);
  }

  deleteLocation(...args: Parameters<LocationsAdminService['deleteLocation']>) {
    return this.locations.deleteLocation(...args);
  }
}
