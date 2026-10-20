import { applyDecorators, SetMetadata } from '@nestjs/common';
import type { Permission } from './permission-policy';

export const REQUIRED_PERMISSION = 'esoft:required-permission';
export const ADDITIONAL_REQUIRED_PERMISSIONS =
  'esoft:additional-required-permissions';
// All listed permissions are required (AND), evaluated against effective roles.
export const RequirePermission = (
  permission: Permission,
  ...additional: Permission[]
) =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSION, permission),
    SetMetadata(ADDITIONAL_REQUIRED_PERMISSIONS, additional),
  );
