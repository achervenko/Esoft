import "./RequiredMark.css";

export function RequiredMark({ label }: { label?: string }) {
  return <b className="required-mark" aria-hidden={label ? undefined : true} aria-label={label}>*</b>;
}
