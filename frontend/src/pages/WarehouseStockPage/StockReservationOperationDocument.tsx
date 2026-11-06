import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { RequiredMark } from "../../shared/ui/RequiredMark";
import type { useStockReservationOperation } from "./useStockReservationOperation";
export function StockReservationOperationDocument({
  form,
}: {
  form: ReturnType<typeof useStockReservationOperation>;
}) {
  const file = useRef<HTMLInputElement>(null);
  const { action, document, setDocument, uploadDocument } = form;
  return (
    <>
      <input
        ref={file}
        hidden
        type="file"
        aria-label={
          action === "RELEASE" ? "Документ" : "Документ (необязательно)"
        }
        aria-required={action === "RELEASE"}
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          await uploadDocument(selected);
        }}
      />
      {document && (
        <div className="stock-adjust-attachment">
          <Paperclip size={18} />
          <span title={document.originalName}>{document.originalName}</span>
          <button
            type="button"
            className="stock-adjust-remove"
            aria-label="Убрать документ"
            onClick={() => setDocument(null)}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <button
        type="button"
        className="admin-secondary-button stock-adjust-upload-button"
        onClick={() => file.current?.click()}
      >
        <Paperclip size={17} />
        {document ? (
          "Заменить документ"
        ) : action === "RELEASE" ? (
          <span>
            <span>Прикрепить документ</span>
            <RequiredMark />
          </span>
        ) : (
          "Прикрепить документ (необязательно)"
        )}
      </button>
    </>
  );
}
