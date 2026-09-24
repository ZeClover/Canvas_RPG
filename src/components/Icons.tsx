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
  region: (props: IconProps) => <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9h8" strokeDasharray="2 2" /></IconBase>,
  session: (props: IconProps) => <IconBase {...props}><path d="M5 3h14v18H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></IconBase>,
  play: (props: IconProps) => <IconBase {...props}><path d="m8 5 11 7-11 7V5Z" /></IconBase>,
  pause: (props: IconProps) => <IconBase {...props}><path d="M9 5v14M15 5v14" /></IconBase>,
  stop: (props: IconProps) => <IconBase {...props}><rect x="6" y="6" width="12" height="12" rx="1" /></IconBase>,
  previous: (props: IconProps) => <IconBase {...props}><path d="m18 6-9 6 9 6V6ZM6 6v12" /></IconBase>,
  next: (props: IconProps) => <IconBase {...props}><path d="m6 6 9 6-9 6V6ZM18 6v12" /></IconBase>,
  volume: (props: IconProps) => <IconBase {...props}><path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" /></IconBase>,
  mute: (props: IconProps) => <IconBase {...props}><path d="M11 5 6 9H3v6h3l5 4V5ZM17 10l4 4M21 10l-4 4" /></IconBase>,
  shuffle: (props: IconProps) => <IconBase {...props}><path d="M3 7h3c4 0 5 10 9 10h6M18 14l3 3-3 3M3 17h3c1.5 0 2.6-1.4 3.6-3M14.4 10C15.5 8.4 16.5 7 18 7h3M18 4l3 3-3 3" /></IconBase>,
  repeat: (props: IconProps) => <IconBase {...props}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></IconBase>,
  folder: (props: IconProps) => <IconBase {...props}><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Z" /></IconBase>,
  download: (props: IconProps) => <IconBase {...props}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 20h14" /></IconBase>,
  upload: (props: IconProps) => <IconBase {...props}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></IconBase>,
  shield: (props: IconProps) => <IconBase {...props}><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></IconBase>,
  music: (props: IconProps) => <IconBase {...props}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></IconBase>,
  chevronUp: (props: IconProps) => <IconBase {...props}><path d="m6 15 6-6 6 6" /></IconBase>,
  close: (props: IconProps) => <IconBase {...props}><path d="m6 6 12 12M18 6 6 18" /></IconBase>,
  spark: (props: IconProps) => <IconBase {...props}><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></IconBase>,
  trash: (props: IconProps) => <IconBase {...props}><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></IconBase>,
};
