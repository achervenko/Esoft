import { StorageDocumentType, StorageOwnerModule } from '@prisma/client';
import {
  createStorageObjectKey,
  getSafeExtension,
} from './storage-file-names.helper';

describe('storage-file-names helper', () => {
  it('generates object keys with owner scope, document type and UUID filename', () => {
    const key = createStorageObjectKey({
      documentType: StorageDocumentType.equipment_photo,
      extension: 'jpg',
      owner: {
        entityId: 42,
        entityType: 'equipment/card',
        module: StorageOwnerModule.EQUIPMENT,
      },
    });

    expect(key).toMatch(
      /^equipment\/equipment_card\/42\/equipment_photo\/[0-9a-f-]{36}\.jpg$/,
    );
  });

  it('uses unknown for empty key segments and sanitizes unsafe symbols', () => {
    const key = createStorageObjectKey({
      documentType: StorageDocumentType.passport,
      extension: 'p df',
      owner: {
        entityId: 7,
        entityType: '   ',
        module: StorageOwnerModule.EQUIPMENT,
      },
    });

    expect(key).toMatch(
      /^equipment\/unknown\/7\/passport\/[0-9a-f-]{36}\.p_df$/,
    );
  });

  it('generates different keys for different uploads', () => {
    const params = {
      documentType: StorageDocumentType.passport,
      extension: 'pdf',
      owner: {
        entityId: 42,
        entityType: 'equipment',
        module: StorageOwnerModule.EQUIPMENT,
      },
    };

    expect(createStorageObjectKey(params)).not.toBe(
      createStorageObjectKey(params),
    );
  });

  it('derives safe extension from filename, MIME or bin fallback', () => {
    expect(
      getSafeExtension({
        buffer: Buffer.from('file'),
        mimetype: 'application/pdf',
        originalname: 'passport.PDF',
        size: 4,
      }),
    ).toBe('pdf');
    expect(
      getSafeExtension({
        buffer: Buffer.from('file'),
        mimetype: 'image/jpeg',
        originalname: 'file',
        size: 4,
      }),
    ).toBe('jpg');
    expect(
      getSafeExtension({
        buffer: Buffer.from('file'),
        originalname: 'file',
        size: 4,
      }),
    ).toBe('bin');
  });
});
