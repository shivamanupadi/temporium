import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { subscribe, type ToastData } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Theme — matches the gateway warm-neutral palette
// ---------------------------------------------------------------------------

const TOAST_CONFIG: Record<ToastData['type'], { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: '#6B8F71' },
  error: { icon: XCircle, accent: '#E5484D' },
  info: { icon: Info, accent: '#E07A5F' },
  warning: { icon: AlertTriangle, accent: '#D4A574' },
};

const MAX_VISIBLE = 5;

// ---------------------------------------------------------------------------
// Toast Item
// ---------------------------------------------------------------------------

function ToastItem({ data, onDismiss }: { data: ToastData; onDismiss: (id: string) => void }) {
  const config = TOAST_CONFIG[data.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(data.id), data.duration);
    return () => clearTimeout(timer);
  }, [data.id, data.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className="relative flex items-start gap-3 rounded-2xl px-4 py-3.5 w-[380px] max-w-[calc(100vw-32px)] pointer-events-auto bg-white border border-[#EDE9E3]"
      style={{ boxShadow: '0 8px 24px rgba(45, 52, 54, 0.12)' }}
    >
      {/* Accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ background: config.accent }}
      />

      {/* Icon */}
      <div
        className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
        style={{ background: `${config.accent}12` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.accent }} strokeWidth={2.5} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[13px] font-semibold leading-tight text-[#2D3436]">{data.title}</p>
        {data.description && (
          <p className="text-[12px] mt-1 leading-relaxed text-[#6B6560]">{data.description}</p>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={() => onDismiss(data.id)}
        className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[#B5B0AA] hover:text-[#6B6560] transition-colors cursor-pointer mt-0.5"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full origin-left"
        style={{ background: config.accent, opacity: 0.35 }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: data.duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Get or create the dedicated toast container — always last child of <body>
// This ensures toasts render above all Radix Dialog portals.
// ---------------------------------------------------------------------------

function getToastContainer(): HTMLElement {
  let el = document.getElementById('toast-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-root';
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '2147483647';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  // Re-append to guarantee it's always the LAST child of body,
  // even after Radix Dialog portals are added later.
  if (el !== document.body.lastElementChild) {
    document.body.appendChild(el);
  }
  return el;
}

// ---------------------------------------------------------------------------
// Toaster (portal-based renderer)
// ---------------------------------------------------------------------------

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    containerRef.current = getToastContainer();

    // Watch for new nodes added to body (e.g. Radix Dialog portals).
    // Whenever something is appended, re-promote toast-root to the end
    // so it always paints on top of every stacking context.
    const observer = new MutationObserver(() => {
      const el = document.getElementById('toast-root');
      if (el && el !== document.body.lastElementChild) {
        document.body.appendChild(el);
      }
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return subscribe(t => {
      setToasts(prev => [...prev.slice(-(MAX_VISIBLE - 1)), t]);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const container = containerRef.current ?? getToastContainer();

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-6 right-6 flex flex-col-reverse gap-2.5 pointer-events-none"
      style={{ zIndex: 2147483647 }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} data={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>,
    container
  );
}
