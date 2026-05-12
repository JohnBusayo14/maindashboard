import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Modal — viewport-aware shell used by every edit dialog in the dashboard.
//
// Layout: header (sticky) · body (scrolls when content overflows) · footer
// (sticky). The card itself is capped at the viewport height minus the page
// padding so long forms (e.g. Victory Month meta editor, JSON bulk import,
// book / hymn / banner forms) never bleed off the bottom of the screen with
// the Save button trapped underneath.
// ─────────────────────────────────────────────────────────────────────────────
export default function Modal({ open, onClose, title, sub, children, size = 'md', footer }) {
  // Esc to close + body scroll-lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    // Outer backdrop. Centered when tall enough, top-aligned on tiny viewports
    // (e.g. mobile-Chrome dev tools) so the close button is always reachable.
    // No more `overflow-y-auto` on the backdrop — scrolling lives inside the
    // card body now, which keeps the header + footer pinned.
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className={
          `flex w-full ${widths[size]} flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-zinc-200 ` +
          // Hard cap so the card stays inside the visible viewport. 2rem
          // matches the outer `p-4` (1rem top + 1rem bottom) so we never spill.
          `max-h-[calc(100vh-2rem)]`
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixed at the top of the card. shrink-0 so it never gets
            squeezed when the body grows. */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold tracking-tight text-ink">{title}</h3>
            {sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — only this region scrolls. min-h-0 is the React-flexbox
            trick that lets a flex child actually shrink below its content. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer — sticky at the bottom of the card so primary actions
            (Save / Apply / Cancel) stay reachable while the body scrolls. */}
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 bg-white px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
