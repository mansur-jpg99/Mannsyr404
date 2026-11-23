import { useId } from 'react';

interface LogoSymbolProps {
  size?: number;
  className?: string;
}

/**
 * Simbol geometris murni tanpa kotak luar (digunakan untuk navigasi mobile & favicon).
 */
export function LogoSymbol({ size = 30, className = '' }: LogoSymbolProps) {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Simbol MANSYR404"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="6"
          y1="6"
          x2="34"
          y2="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 23V11C8.5 8.79086 10.2909 7 12.5 7H24.5C26.7091 7 28.5 8.79086 28.5 11V13.5H23.5V12H13.5V22H15V27H12.5C10.2909 27 8.5 25.2091 8.5 23Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M31.5 17V29C31.5 31.2091 29.7091 33 27.5 33H15.5C13.2909 33 11.5 31.2091 11.5 29V26.5H16.5V28H26.5V18H25V13H27.5C29.7091 13 31.5 14.7909 31.5 17Z"
        fill="#172033"
      />
      <rect x="17" y="17" width="6" height="6" rx="1.6" fill={`url(#${gradId})`} />
    </svg>
  );
}

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Ikon aplikasi di dalam kotak dengan sudut membulat dan gradasi #0D9488 -> #14B8A6.
 */
export function LogoMark({ size = 36, className = '' }: LogoMarkProps) {
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ikon Aplikasi MANSYR404"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="2"
          y1="2"
          x2="38"
          y2="38"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill={`url(#${gradId})`} />
      <path
        d="M10.5 22.5V12.5C10.5 10.8431 11.8431 9.5 13.5 9.5H23.5C25.1569 9.5 26.5 10.8431 26.5 12.5V14.5H22.5V13.5H14.5V21.5H15.5V25.5H13.5C11.8431 25.5 10.5 24.1569 10.5 22.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M29.5 17.5V27.5C29.5 29.1569 28.1569 30.5 26.5 30.5H16.5C14.8431 30.5 13.5 29.1569 13.5 27.5V25.5H17.5V26.5H25.5V18.5H24.5V14.5H26.5C28.1569 14.5 29.5 15.8431 29.5 17.5Z"
        fill="#FFFFFF"
        fillOpacity="0.82"
      />
      <rect x="17.5" y="17.5" width="5" height="5" rx="1.4" fill="#FFFFFF" />
    </svg>
  );
}

interface BrandLogoProps {
  size?: number;
  subtitle?: string;
  className?: string;
}

/**
 * Logo lengkap: ikon aplikasi geometris + tulisan MANSYR404 dengan aksen teal pada angka 404.
 */
export function BrandLogo({
  size = 36,
  subtitle,
  className = '',
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 min-w-0 ${className}`}>
      <LogoMark size={size} className="shrink-0" />
      <div className="min-w-0 leading-none">
        <div className="text-[15px] font-bold tracking-[0.07em] text-[#172033] truncate">
          <span>MANSYR</span>
          <span className="text-[#0D9488]">404</span>
        </div>
        {subtitle && (
          <div className="mt-1 text-[11px] font-medium text-[#64748B] truncate">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
