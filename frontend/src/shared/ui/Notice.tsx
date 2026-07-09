import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type NoticeTone = 'error' | 'info' | 'success';

type NoticeProps = {
  children: ReactNode;
  floating?: boolean;
  tone?: NoticeTone;
};

const noticeIcons = {
  error: TriangleAlert,
  info: Info,
  success: CheckCircle2,
};

export function Notice({ children, floating = false, tone = 'info' }: NoticeProps) {
  const Icon = noticeIcons[tone];

  return (
    <div
      className={`notice notice-${tone}${floating ? ' notice-floating' : ''}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" size={18} />
      <div>{children}</div>
    </div>
  );
}
