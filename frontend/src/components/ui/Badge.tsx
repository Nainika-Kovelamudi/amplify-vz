import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline';
  customColor?: string;
  customBg?: string;
  dot?: boolean;
}

export function Badge({ className, variant = 'default', customColor, customBg, dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        {
          'bg-gray-100 text-gray-800': variant === 'default' && !customColor,
          'bg-emerald-100 text-emerald-700': variant === 'success',
          'bg-amber-100 text-amber-700': variant === 'warning',
          'bg-rose-100 text-rose-700': variant === 'error',
          'border border-gray-200 bg-white text-gray-800': variant === 'outline',
        },
        className
      )}
      style={customColor ? { color: customColor, backgroundColor: customBg || `${customColor}15`, border: `1px solid ${customColor}30` } : undefined}
      {...props}
    >
      {dot && (
        <span 
          className="h-1.5 w-1.5 rounded-full" 
          style={{ backgroundColor: customColor || 'currentColor' }}
        />
      )}
      {children}
    </span>
  );
}
