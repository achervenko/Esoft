import "./Notice.css";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

type NoticeTone = "error" | "info" | "success";

type NoticeProps = {
  children: ReactNode;
  className?: string;
  floating?: boolean;
  tone?: NoticeTone;
};

const noticeIcons = {
  error: TriangleAlert,
  info: Info,
  success: CheckCircle2,
};

export function Notice({
  children,
  className,
  floating = false,
  tone = "info",
}: NoticeProps) {
  const Icon = noticeIcons[tone];

  return (
    <div
      className={`notice notice-${tone}${floating ? " notice-floating" : ""}${className ? ` ${className}` : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={18} />
      <div>{children}</div>
    </div>
  );
}
