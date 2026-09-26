import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const Icons = {
  back: (props: IconProps) => <IconBase {...props}><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></IconBase>,
  search: (props: IconProps) => <IconBase {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></IconBase>,
  plus: (props: IconProps) => <IconBase {...props}><path d="M12 5v14M5 12h14" /></IconBase>,
  frame: (props: IconProps) => <IconBase {...props}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></IconBase>,
  link: (props: IconProps) => <IconBase {...props}><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></IconBase>,
  group: (props: IconProps) => <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8" strokeDasharray="2 2" /></IconBase>,
  download: (props: IconProps) => <IconBase {...props}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 20h14" /></IconBase>,
  upload: (props: IconProps) => <IconBase {...props}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></IconBase>,
  shield: (props: IconProps) => <IconBase {...props}><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></IconBase>,
  close: (props: IconProps) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>,
  trash: (props: IconProps) => <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></IconBase>,
  spark: (props: IconProps) => <IconBase {...props}><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /></IconBase>,
  eye: (props: IconProps) => <IconBase {...props}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></IconBase>,
  world: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9Z" /></IconBase>,
  clock: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></IconBase>,
  book: (props: IconProps) => <IconBase {...props}><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" /><path d="M4 19.5A2 2 0 0 1 6 17.5h13" /></IconBase>,
  web: (props: IconProps) => <IconBase {...props}><circle cx="6" cy="7" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M8.1 8.1 10 16M15.9 8.1 14 16M8.3 7h7.4" /></IconBase>,
  branch: (props: IconProps) => <IconBase {...props}><circle cx="6" cy="5" r="2.2" /><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M6 7.2V16.8M6 8c0 4 4 4 10 4" /></IconBase>,
  gear: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="3.3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2" /></IconBase>,
  tools: (props: IconProps) => <IconBase {...props}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.7 2.7-2-2 2.7-2.7Z" /></IconBase>,
  chevronDown: (props: IconProps) => <IconBase {...props}><path d="m6 9 6 6 6-6" /></IconBase>,
  coin: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M9.5 15.5c.5.7 1.4 1 2.5 1 1.7 0 3-.8 3-2s-1.3-1.8-3-2-3-.8-3-2 1.3-2 3-2c1.1 0 2 .3 2.5 1" /></IconBase>,
  toggles: (props: IconProps) => <IconBase {...props}><rect x="3" y="5" width="18" height="6" rx="3" /><circle cx="9" cy="8" r="1.6" fill="currentColor" stroke="none" /><rect x="3" y="13" width="18" height="6" rx="3" /><circle cx="15" cy="16" r="1.6" fill="currentColor" stroke="none" /></IconBase>,
  chat: (props: IconProps) => <IconBase {...props}><path d="M4 5.5h16v10H9l-4 3.5v-3.5H4Z" /><path d="M8 10h8M8 13h5" /></IconBase>,
  file: (props: IconProps) => <IconBase {...props}><path d="M6 2.5h9l3 3v16H6Z" /><path d="M15 2.5V6h3M9 12h6M9 15.5h6M9 8.5h2" /></IconBase>,
  pulse: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="M7 12h2.5l1.5-4 2.5 8 1.5-4H17" /></IconBase>,
  mail: (props: IconProps) => <IconBase {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 6.5 8 6 8-6" /></IconBase>,
  target: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" /></IconBase>,
  image: (props: IconProps) => <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m4 17 5.5-5.5c.6-.6 1.4-.6 2 0L15 15l1-1c.6-.6 1.4-.6 2 0l2 2" /></IconBase>,
  star: (props: IconProps) => <IconBase {...props}><path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" /></IconBase>,
  starFilled: (props: IconProps) => <IconBase {...props} fill="currentColor"><path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" /></IconBase>,
  forward: (props: IconProps) => <IconBase {...props}><path d="m5 6 6 6-6 6" /><path d="m13 6 6 6-6 6" /></IconBase>,
  dice: (props: IconProps) => <IconBase {...props}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="8.3" cy="8.3" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.7" cy="8.3" r="1.1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="8.3" cy="15.7" r="1.1" fill="currentColor" stroke="none" /><circle cx="15.7" cy="15.7" r="1.1" fill="currentColor" stroke="none" /></IconBase>,
  monitor: (props: IconProps) => <IconBase {...props}><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 20h8M12 17v3" /></IconBase>,
  compass: (props: IconProps) => <IconBase {...props}><circle cx="12" cy="12" r="9" /><path d="m14.8 9.2-2 5.6-5.6 2 2-5.6Z" /></IconBase>,
};
