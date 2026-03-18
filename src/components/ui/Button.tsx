import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variants = {
  primary: 'bg-gold text-navy font-semibold hover:bg-gold-dim active:scale-[0.98] shadow-[0_2px_0_#8a6e2e,0_3px_6px_rgba(0,0,0,0.3)]',
  secondary: 'bg-navy-lighter text-cream border border-navy-lighter hover:bg-[#243044] hover:border-[#2a3854]',
  ghost: 'text-cream-dim hover:text-cream hover:bg-navy-lighter/50',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-8 py-3.5 text-lg',
};

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-md font-body transition-all duration-150 cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
