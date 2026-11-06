export const MACHINE_KEY_CONFIG = 'machine';
export type MachineKeyPermissions = Record<string, string[]>;

export type MachineKeyScope = Readonly<{ purpose: string; sourceId: string }>;
