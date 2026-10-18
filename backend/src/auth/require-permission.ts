import { SetMetadata } from '@nestjs/common';
import type { Permission } from './permission-policy';

export const REQUIRED_PERMISSION = 'esoft:required-permission';
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
