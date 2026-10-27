import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-3 w-44" /><Skeleton className="h-8 w-64" /><Skeleton className="h-3 w-96" /></div>
        <div className="hidden gap-2 sm:flex"><Skeleton className="h-10 w-28" /><Skeleton className="h-10 w-28" /></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-36" /><Skeleton className="mt-2 h-3 w-28" /></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 xl:col-span-2"><Skeleton className="h-4 w-40" /><div className="mt-6 flex h-56 items-end gap-3">{[40, 65, 50, 85, 60, 75, 55].map((h, i) => <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />)}</div></div>
        <div className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-4 w-36" /><Skeleton className="mx-auto mt-6 h-44 w-44 rounded-full" /></div>
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-white p-5">{[1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-10" />)}</div>
    </div>
  );
}
