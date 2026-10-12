import { RequiredMark } from "./RequiredMark";
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import "./FormField.css";

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  hideLabel?: boolean;
  className?: string;
};

export function FormField({
  label,
  children,
  required = false,
  error,
  hideLabel = false,
  className = "",
}: FormFieldProps) {
  const errorId = useId();
  return (
    <label
      className={`form-field ${className}${error ? " has-error" : ""}`.trim()}
    >
      <span className={`form-field-label${hideLabel ? " admin-control-label-hidden" : ""}`}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      {Children.map(children, (child) => {
        if (
          !isValidElement<HTMLAttributes<HTMLElement> & { required?: boolean }>(child) ||
          typeof child.type !== "string" ||
          !["input", "select", "textarea", "button"].includes(child.type)
        )
          return child;
        return cloneElement(child, {
          ...(child.type !== "button"
            ? {
                "aria-required": required || child.props["aria-required"],
                required: required || child.props.required,
              }
            : {}),
          "aria-invalid": error ? true : child.props["aria-invalid"],
          "aria-describedby":
            [child.props["aria-describedby"], error ? errorId : null]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      })}
      {error ? (
        <small id={errorId} className="field-error">
          {error}
        </small>
      ) : null}
    </label>
  );
}
