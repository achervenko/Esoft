import "./WarehouseItemIdentity.css";

export function WarehouseItemIdentity({
  name,
  article,
}: {
  name: string;
  article?: string | null;
}) {
  return (
    <span className="warehouse-item-identity">
      <strong className="warehouse-item-identity-name" title={name}>
        {name}
      </strong>
      {article && (
        <span className="warehouse-item-identity-article">{article}</span>
      )}
    </span>
  );
}
