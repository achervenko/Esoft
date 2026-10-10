import "./ClothingSizeGrid.css";
import { normalizePpeSizeText } from "../../shared/lib/ppe-size-text";
import { useLayoutEffect, useRef, useState } from "react";
import { Field } from "./ppe-ui";

import {
  clothingSizes as sizes,
  clothingHeights as heights,
  type ClothingSize,
} from "./ppe-size-options";

export function ClothingSizeGrid({
  values,
  onChange,
  disabled = false,
  selectionMode = "multiple",
}: {
  values: ClothingSize[];
  onChange: (values: ClothingSize[]) => void;
  disabled?: boolean;
  selectionMode?: "single" | "multiple";
}) {
  const [manualSize, setManualSize] = useState("");
  const [manualHeight, setManualHeight] = useState("");
  const [customGrid, setCustomGrid] = useState(false);
  const [addedSizes, setAddedSizes] = useState<string[]>([]);
  const [addedHeights, setAddedHeights] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const compareRanges = (a: string, b: string) =>
    a.localeCompare(b, "ru", { numeric: true });
  const rows = [
    ...new Set([
      ...(customGrid ? [] : sizes),
      ...addedSizes,
      ...values.map((pair) => pair.value),
    ]),
  ].sort(compareRanges);
  const columns = [
    ...new Set([
      ...(customGrid ? [] : heights),
      ...addedHeights,
      ...values.map((pair) => pair.heightValue),
    ]),
  ].sort(compareRanges);
  useLayoutEffect(() => {
    const modal = gridRef.current?.closest<HTMLElement>(".ppe-clothing-modal");
    modal?.style.setProperty(
      "--ppe-clothing-width",
      `${Math.max(600, 140 + columns.length * 82)}px`,
    );
    return () => {
      modal?.style.removeProperty("--ppe-clothing-width");
    };
  }, [columns.length]);
  const toggle = (value: string, heightValue: string) => {
    const selected = values.some(
      (pair) => pair.value === value && pair.heightValue === heightValue,
    );
    onChange(
      selected
        ? values.filter(
            (pair) => pair.value !== value || pair.heightValue !== heightValue,
          )
        : selectionMode === "single" ? [{ value, heightValue }] : [...values, { value, heightValue }],
    );
  };
  return (
    <div className="ppe-clothing-size-grid" ref={gridRef}>
      {rows.map((value) => (
        <div className="ppe-clothing-size-row" key={value}>
          <strong>{value}</strong>
          <div className="ppe-clothing-height-options">
            {columns.map((heightValue) => (
              <button
                key={heightValue}
                type="button"
                disabled={disabled}
                aria-label={`${value};${heightValue}`}
                aria-pressed={values.some(
                  (pair) =>
                    pair.value === value && pair.heightValue === heightValue,
                )}
                onClick={() => toggle(value, heightValue)}
              >
                {heightValue}
              </button>
            ))}
          </div>
        </div>
      ))}
      <details className="ppe-clothing-custom">
        <summary>Редактировать размеры</summary>
        <div className="ppe-actions">
          <button
            className="admin-secondary-button ppe-danger-button"
            type="button"
            disabled={disabled}
            onClick={() => {
              setCustomGrid(true);
              setAddedSizes([]);
              setAddedHeights([]);
              onChange([]);
              setManualSize("");
              setManualHeight("");
            }}
          >
            Сбросить размеры
          </button>
        </div>
        <div className="ppe-actions">
          <Field label="Размер">
            <input
              maxLength={20}
              value={manualSize}
              disabled={disabled}
              onChange={(event) =>
                setManualSize(normalizePpeSizeText(event.target.value))
              }
            />
          </Field>
          <Field label="Ростовка">
            <input
              maxLength={20}
              value={manualHeight}
              disabled={disabled}
              onChange={(event) =>
                setManualHeight(normalizePpeSizeText(event.target.value))
              }
            />
          </Field>
          <button
            className="admin-secondary-button"
            type="button"
            disabled={disabled || (!manualSize.trim() && !manualHeight.trim())}
            onClick={() => {
              const value = manualSize.trim(),
                heightValue = manualHeight.trim();
              if (value)
                setAddedSizes((current) => [...new Set([...current, value])]);
              if (heightValue)
                setAddedHeights((current) => [
                  ...new Set([...current, heightValue]),
                ]);
              if (
                value &&
                heightValue &&
                !values.some(
                  (pair) =>
                    pair.value === value && pair.heightValue === heightValue,
                )
              )
                onChange(selectionMode === "single" ? [{ value, heightValue }] : [...values, { value, heightValue }]);
              setManualSize("");
              setManualHeight("");
            }}
          >
            Добавить
          </button>
        </div>
      </details>
    </div>
  );
}
