import { useToastStore } from '@/stores/toastStore.ts';
import { cn } from '@/lib/cn.ts';
import type { Toast, ToastType } from '@/stores/toastStore.ts';

const typeStyles: Record<ToastType, string> = {
  success: 'border-green-light/60 bg-green/80 text-cream',
  error: 'border-red/60 bg-red/20 text-cream',
  info: 'border-blue/60 bg-blue/20 text-cream',
  warning: 'border-gold/60 bg-gold/10 text-cream',
};

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

const iconBg: Record<ToastType, string> = {
  success: 'bg-green-light text-navy',
  error: 'bg-red text-cream',
  info: 'bg-blue text-cream',
  warning: 'bg-gold text-navy',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { beginFadeOut } = useToastStore();

  return (
    <div
      className={cn(
        'flex items-center gap-3 min-w-[260px] max-w-xs px-3 py-2.5 rounded-lg border',
        'shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-sm',
        'transition-all duration-300',
        typeStyles[toast.type],
        toast.fadingOut ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
      )}
    >
      <span className={cn(
        'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
        iconBg[toast.type],
      )}>
        {typeIcons[toast.type]}
      </span>
      <p className="text-sm font-body flex-1">{toast.message}</p>
      <button
        onClick={() => beginFadeOut(toast.id)}
        className="flex-shrink-0 text-cream-dim hover:text-cream transition-colors text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
