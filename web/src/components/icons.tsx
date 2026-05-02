import type { SVGProps } from 'react';

function icon(props: SVGProps<SVGSVGElement>, d: string) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={d} />
    </svg>
  );
}

export const SunIcon       = (p: SVGProps<SVGSVGElement>) => icon(p, "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z");
export const MoonIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");
export const BugIcon       = (p: SVGProps<SVGSVGElement>) => icon(p, "M8 3v3m8-3v3M3 6h18M6 6l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M10 10v6m4-6v6");
export const BulbIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z");
export const QuestionIcon  = (p: SVGProps<SVGSVGElement>) => icon(p, "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z");
export const MemoIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z");
export const CameraIcon    = (p: SVGProps<SVGSVGElement>) => icon(p, "M3 7a2 2 0 012-2h1.5l1-2h7l1 2H17a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z M12 18a4.5 4.5 0 100-9 4.5 4.5 0 000 9z");
export const FileIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z M13 2v7h7");
export const ArchiveIcon   = (p: SVGProps<SVGSVGElement>) => icon(p, "M21 8v13a2 2 0 01-2 2H5a2 2 0 01-2-2V8m18 0H3m18 0a2 2 0 002-2V4a2 2 0 00-2-2H3a2 2 0 00-2 2v2a2 2 0 002 2m7 4h4m-4 4h4");
export const CheckIcon     = (p: SVGProps<SVGSVGElement>) => icon(p, "M20 6L9 17l-5-5");
export const EyeIcon       = (p: SVGProps<SVGSVGElement>) => icon(p, "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 100-6 3 3 0 000 6z");
export const ChatIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z");
export const DevIcon       = (p: SVGProps<SVGSVGElement>) => icon(p, "M16 18l6-6-6-6 M8 6l-6 6 6 6");
export const UserIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z");
export const KeyIcon       = (p: SVGProps<SVGSVGElement>) => icon(p, "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4");
export const CloseIcon     = (p: SVGProps<SVGSVGElement>) => icon(p, "M18 6L6 18M6 6l12 12");
export const ChevronDownIcon = (p: SVGProps<SVGSVGElement>) => icon(p, "M6 9l6 6 6-6");
export const SendIcon      = (p: SVGProps<SVGSVGElement>) => icon(p, "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z");
