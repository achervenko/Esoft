import { Badge } from "@chakra-ui/react";
import { Trash2 } from "lucide-react";

export function OrderStatus({
  status,
  deleted = false,
}: {
  status: string;
  deleted?: boolean;
}) {
  const colorPalette =
    status === "КОбеспечению" ? "green" : status === "Закрыт" ? "red" : "gray";
  return (
    <span className="orders-statuses">
      <Badge
        colorPalette={colorPalette}
        variant="subtle"
        borderRadius="md"
        px="2"
        py="1"
        whiteSpace="normal"
        textAlign="start"
      >
        {status}
      </Badge>
      {deleted && (
        <Badge
          colorPalette="red"
          variant="subtle"
          borderRadius="md"
          px="2"
          py="1"
          whiteSpace="normal"
        >
          <Trash2 size={13} aria-hidden="true" />
          Удалён в 1С
        </Badge>
      )}
    </span>
  );
}
