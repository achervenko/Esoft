import type { PpeItem } from "../../shared/api/ppe";
import { SizeGridEditor } from "./SizeGridEditor";
import { SizeListEditor } from "./SizeListEditor";

type SizeCatalogModalProps = {
  item: PpeItem;
  manage: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function SizeCatalogModal(props: SizeCatalogModalProps) {
  const { item, manage } = props;
  return manage && (item.type === "BODY" || item.type === "FEET" || item.type === "HANDS" || item.type === "HEAD") ? (
    <SizeGridEditor
      item={item}
      onClose={props.onClose}
      onChanged={props.onChanged}
    />
  ) : (
    <SizeListEditor {...props} />
  );
}
