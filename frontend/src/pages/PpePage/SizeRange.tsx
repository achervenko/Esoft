import "./SizeRange.css";
import { Slider } from "@chakra-ui/react";
import { ChevronRight, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Field } from "../../modules/ppe-ui/ppe-ui";

export const shoeSizeRange = { min: 30, max: 60, defaultRange: [36, 46] as [number, number], sizeName: "обуви" };
export const gloveSizeRange = { min: 6, max: 15, defaultRange: [7, 11] as [number, number], sizeName: "перчаток" };

export const headSizeRange = { min: 54, max: 65, defaultRange: [55, 62] as [number, number], sizeName: "головного убора" };

export function SizeRange({
  values,
  onChange,
  disabled = false,
  min,
  max,
  defaultRange,
  sizeName,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  min: number;
  max: number;
  defaultRange: [number, number];
  sizeName: string;
}) {
  const numericSizes = values
    .map(Number)
    .filter((size) => Number.isInteger(size) && size >= min && size <= max);
  const range = numericSizes.length
    ? [Math.min(...numericSizes), Math.max(...numericSizes)]
    : defaultRange;
  const present = new Set(numericSizes);
  const gaps: { from: number; to: number }[] = [];
  for (let size = range[0] + 1; size < range[1]; size++) {
    if (present.has(size)) continue;
    const previous = gaps[gaps.length - 1];
    if (previous && previous.to === size - 1) previous.to = size;
    else gaps.push({ from: size, to: size });
  }
  const segments: { from: number; to: number }[] = [];
  let segmentStart = range[0];
  for (const gap of gaps.filter((gap) => gap.from !== gap.to)) {
    segments.push({ from: segmentStart, to: gap.from - 1 });
    segmentStart = gap.to + 1;
  }
  segments.push({ from: segmentStart, to: range[1] });
  const [manual, setManual] = useState("");
  const sizeListRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();
  useLayoutEffect(() => {
    const list = sizeListRef.current;
    if (!list) return;
    const measure = () => {
      const height = list.getBoundingClientRect().height;
      if (height > 0 || list.childElementCount === 0) setListHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const fill = (next: number[]) => {
    onChange(
      Array.from({ length: next[1] - next[0] + 1 }, (_, i) => next[0] + i)
        .filter(
          (size) =>
            present.has(size) ||
            size < range[0] ||
            size > range[1] ||
            numericSizes.length === 0,
        )
        .map(String),
    );
  };
  const add = () => {
    const size = Number(manual);
    if (!manual || !Number.isInteger(size) || size < min || size > max) return;
    onChange(
      [...new Set([...values, String(size)])].sort(
        (a, b) => Number(a) - Number(b),
      ),
    );
    setManual("");
  };
  return (
    <div className="ppe-shoe-range">
      <Slider.Root
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={range}
        disabled={disabled}
        aria-label={[`Минимальный размер ${sizeName}`, `Максимальный размер ${sizeName}`]}
        onValueChange={({ value }) => fill(value)}
        colorPalette="gray"
      >
        <div className="ppe-shoe-range-heading">
          <Slider.Label>Диапазон размеров</Slider.Label>
          <strong>
            {numericSizes.length ? `${range[0]}–${range[1]}` : "—"}
          </strong>
        </div>
        <Slider.Control>
          <div className="ppe-shoe-range-ticks" aria-hidden="true">
            {Array.from({ length: max - min + 1 }, (_, index) => {
              const size = min + index;
              return (
                <span
                  key={size}
                  className={
                    size % 10 === 0
                      ? "ppe-tick-major"
                      : size % 5 === 0
                        ? "ppe-tick-medium"
                        : undefined
                  }
                  style={{ left: `${(index / (max - min)) * 100}%` }}
                />
              );
            })}
          </div>
          <Slider.Track />
          <div className="ppe-shoe-range-segments" aria-hidden="true">
            {segments.map(({ from, to }) => (
              <span
                key={from}
                style={{
                  left: `${((from - min) / (max - min)) * 100}%`,
                  width: `${((to - from) / (max - min)) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="ppe-shoe-range-gaps" aria-hidden="true">
            {gaps.map(({ from, to }) => (
              <span
                key={from}
                className={
                  from === to ? "ppe-shoe-range-hole" : "ppe-shoe-range-break"
                }
                style={
                  from === to
                    ? { left: `${((from - min) / (max - min)) * 100}%` }
                    : {
                        left: `${((from - 1 - min) / (max - min)) * 100}%`,
                        width: `${((to - from + 2) / (max - min)) * 100}%`,
                      }
                }
              />
            ))}
          </div>
          <Slider.Thumb index={0} className="ppe-shoe-range-thumb">
            <Slider.HiddenInput />
          </Slider.Thumb>
          <Slider.Thumb index={1} className="ppe-shoe-range-thumb">
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
      <details className="ppe-shoe-manual">
        <summary>
          <ChevronRight size={16} aria-hidden="true" />
          Редактировать размеры ({values.length})
        </summary>
        <div className="ppe-shoe-size-list" style={{ height: listHeight }}>
          <div className="ppe-shoe-size-list-content" ref={sizeListRef}>
            {values.map((value) => (
              <span key={value}>
                {value}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Удалить размер ${value}`}
                  onClick={() =>
                    onChange(values.filter((size) => size !== value))
                  }
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="ppe-actions">
          <Field label="Размер вручную">
            <input
              type="number"
              min={min}
              max={max}
              step={1}
              value={manual}
              disabled={disabled}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </Field>
          <button
            type="button"
            className="admin-secondary-button"
            disabled={
              disabled ||
              !manual ||
              !Number.isInteger(Number(manual)) ||
              Number(manual) < min ||
              Number(manual) > max
            }
            onClick={add}
          >
            Добавить размер
          </button>
        </div>
      </details>
    </div>
  );
}
