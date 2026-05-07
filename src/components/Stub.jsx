import { Construction } from 'lucide-react';

export default function Stub({ title }) {
  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <Construction className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-ink tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-zinc-500">
          This page hasn't been migrated to React yet. Foundation MVP — coming soon.
        </p>
      </div>
    </div>
  );
}
