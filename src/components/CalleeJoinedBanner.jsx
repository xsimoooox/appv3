import React from 'react';
import { UserCheck } from 'lucide-react';

export default function CalleeJoinedBanner({ name }) {
  if (!name) return null;

  return (
    <div className="fixed top-16 left-1/2 z-[100001] -translate-x-1/2 w-[calc(100%-24px)] max-w-sm animate-fade-in">
      <div className="flex items-center gap-2 rounded-full bg-[#16a34a] text-white px-4 py-2.5 shadow-lg border border-emerald-400">
        <UserCheck size={18} strokeWidth={2.5} />
        <span className="text-[12px] font-extrabold">
          {name} a rejoint l&apos;appel
        </span>
      </div>
    </div>
  );
}
