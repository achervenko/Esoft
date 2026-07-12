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
  const statusClassName = `status-${status.toUpperCase()}`;

  return (
    <span
      className={`equipment-status-badge ${statusClassName}${className ? ` ${className}` : ''}`}
    >
      {label}
    </span>
  );
}
