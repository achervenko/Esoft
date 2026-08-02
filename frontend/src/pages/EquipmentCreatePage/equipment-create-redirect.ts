export type EquipmentCreateRedirectTimeoutRef = {
  current: number | null;
};

export function clearEquipmentCreateRedirectTimeout(
  redirectTimeoutRef: EquipmentCreateRedirectTimeoutRef,
) {
  if (redirectTimeoutRef.current !== null) {
    window.clearTimeout(redirectTimeoutRef.current);
    redirectTimeoutRef.current = null;
  }
}

export function scheduleEquipmentCreateRedirect(
  redirectTimeoutRef: EquipmentCreateRedirectTimeoutRef,
) {
  clearEquipmentCreateRedirectTimeout(redirectTimeoutRef);

  redirectTimeoutRef.current = window.setTimeout(() => {
    redirectTimeoutRef.current = null;
    window.location.hash = '#/equipment';
  }, 500);
}
