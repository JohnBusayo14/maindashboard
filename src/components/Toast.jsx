import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

const VARIANTS = {
  success: { icon: CheckCircle2, ring: 'ring-emerald-200', bg: 'bg-emerald-50',  fg: 'text-emerald-700' },
  error:   { icon: XCircle,      ring: 'ring-red-200',     bg: 'bg-red-50',      fg: 'text-red-700' },
  info:    { icon: Info,         ring: 'ring-zinc-200',    bg: 'bg-white',       fg: 'text-ink' },
};

let id = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((tid) => {
    setItems((prev) => prev.filter((t) => t.id !== tid));
  }, []);

  const push = useCallback((variant, message) => {
    const tid = ++id;
    setItems((prev) => [...prev, { id: tid, variant, message }]);
    setTimeout(() => remove(tid), 3500);
  }, [remove]);

  const toast = useMemo(() => ({
    success: (m) => push('success', m),
    error:   (m) => push('error', m),
    info:    (m) => push('info', m),
  }), [push]);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {items.map((t) => {
            const v = VARIANTS[t.variant] || VARIANTS.info;
            const Icon = v.icon;
            return (
              <div
                key={t.id}
                className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-lg ${v.bg} ${v.fg} px-3.5 py-2.5 ring-1 ${v.ring} shadow-card`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm font-medium leading-snug">{t.message}</div>
                <button
                  onClick={() => remove(t.id)}
                  className="ml-1 -mr-1 rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
