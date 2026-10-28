import { RequiredMark } from "./RequiredMark";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import "./FormField.css";

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  warning?: string;
  hideLabel?: boolean;
  className?: string;
};

export function FormField({
  label,
  children,
  required = false,
  error,
  warning,
  hideLabel = false,
  className = "",
}: FormFieldProps) {
  const errorId = useId();
  const labelId = useId();
  const message = error || warning;
  const [retainedMessage, setRetainedMessage] = useState<{
    text: string;
    isError: boolean;
  } | null>(message ? { text: message, isError: !!error } : null);
  useEffect(() => {
    if (message) {
      setRetainedMessage({ text: message, isError: !!error });
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setRetainedMessage(null);
      return;
    }
    const timer = window.setTimeout(() => setRetainedMessage(null), 360);
    return () => window.clearTimeout(timer);
  }, [message, error]);
  return (
    <label
      className={`form-field ${className}${error ? " has-error" : warning ? " has-warning" : ""}`.trim()}
    >
      <span
        className={`form-field-label${hideLabel ? " admin-control-label-hidden" : ""}`}
      >
        <span id={labelId}>{label}</span>
        {required ? <RequiredMark /> : null}
      </span>
      {Children.map(children, (child) => {
        if (
          !isValidElement<HTMLAttributes<HTMLElement> & { required?: boolean }>(
            child,
          ) ||
          typeof child.type !== "string" ||
          !["input", "select", "textarea", "button"].includes(child.type)
        )
          return child;
        return cloneElement(child, {
          "aria-labelledby":
            child.props["aria-labelledby"] ??
            (child.type === "button" || child.props["aria-label"]
              ? undefined
              : labelId),
          ...(child.type !== "button"
            ? {
                "aria-required": required || child.props["aria-required"],
                required: required || child.props.required,
              }
            : {}),
          "aria-invalid": error ? true : child.props["aria-invalid"],
          "aria-describedby":
            [child.props["aria-describedby"], error || warning ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      })}
      {message || retainedMessage ? (
        <small
          id={errorId}
          aria-hidden={!message || undefined}
          data-visible={!!message}
          className={`form-field-message ${(message ? !!error : retainedMessage?.isError) ? "field-error" : "field-warning"}`}
        >
          {message || retainedMessage?.text}
        </small>
      ) : null}
    </label>
  );
}
