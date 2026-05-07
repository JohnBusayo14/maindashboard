const VARIANTS = {
  blue:    'bg-brand-50 text-brand-700',
  green:   'bg-emerald-50 text-emerald-700',
  red:     'bg-red-50 text-red-700',
  amber:   'bg-amber-50 text-amber-700',
  violet:  'bg-violet-50 text-violet-700',
  zinc:    'bg-zinc-100 text-zinc-700',
  orange:  'bg-orange-50 text-orange-700',
  teal:    'bg-teal-50 text-teal-700',
};

export default function Badge({ children, variant = 'zinc', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${VARIANTS[variant] || VARIANTS.zinc} ${className}`}>
      {children}
    </span>
  );
}
