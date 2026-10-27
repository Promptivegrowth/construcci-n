import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-72" /><Skeleton className="h-3 w-96" /></div>
      <Skeleton className="h-14 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-32" /></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[1, 2].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-4 w-56" /><div className="mt-6 flex h-64 items-end gap-3">{[50, 70, 45, 90, 60, 80].map((h, j) => <div key={j} className="skeleton flex-1" style={{ height: `${h}%` }} />)}</div></div>)}
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-white p-5">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-10" />)}</div>
    </div>
  );
}
