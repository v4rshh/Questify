import type { SVGProps } from 'react';

type IconName =
  | 'arrowUp'
  | 'bookOpen'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'file'
  | 'filePlus'
  | 'flame'
  | 'grid'
  | 'library'
  | 'message'
  | 'moon'
  | 'more'
  | 'paperclip'
  | 'plus'
  | 'search'
  | 'send'
  | 'settings'
  | 'sparkles'
  | 'sun'
  | 'target'
  | 'trophy'
  | 'upload'
  | 'user'
  | 'x';

const paths: Record<IconName, React.ReactNode> = {
  arrowUp: <path d="m5 12 7-7 7 7M12 19V5" />,
  bookOpen: <><path d="M2.5 5.5A2.5 2.5 0 0 1 5 3h4a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H5a2.5 2.5 0 0 0-2.5 2.5z" /><path d="M21.5 5.5A2.5 2.5 0 0 0 19 3h-4a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3h4a2.5 2.5 0 0 1 2.5 2.5z" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  filePlus: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15h6" /></>,
  flame: <path d="M12 22c4.4 0 7-2.8 7-6.7 0-2.4-1.2-4.7-3.4-6.8.2 2.4-.9 3.9-2.4 4.4.3-3.8-1.4-6.8-4.7-9.1.2 3.3-1.7 5.1-2.7 7.1C4.8 13 5 15.4 5 16.2 5 19.8 7.8 22 12 22Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  library: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-8h6v8M7 9h.01M12 9h.01M17 9h.01" /></>,
  message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.7-.8L4 20l1.5-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  paperclip: <path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5L9.6 18.2a2 2 0 1 1-2.8-2.8l8.5-8.5" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.5h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.5v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.6 1Z" /></>,
  sparkles: <><path d="m12 3-1.2 4.2L7 9l3.8 1.8L12 15l1.2-4.2L17 9l-3.8-1.8Z" /><path d="m19 15-.6 2.4L16 18l2.4.6L19 21l.6-2.4L22 18l-2.4-.6ZM5 3l-.5 2L3 5.5 4.5 6 5 8l.5-2L7 5.5 5.5 5Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>,
  trophy: <><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0z" /><path d="M6 7H3v2a4 4 0 0 0 4 4M18 7h3v2a4 4 0 0 1-4 4" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.8, ...props }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
