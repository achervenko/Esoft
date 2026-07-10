import './EquipmentStatusBadge.css';

type EquipmentStatusBadgeProps = {
  className?: string;
  label: string;
  status: string;
};

export function EquipmentStatusBadge({
  className = '',
  label,
  status,
}: EquipmentStatusBadgeProps) {
  return (
    <span
      className={`equipment-status-badge status-${status}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}
