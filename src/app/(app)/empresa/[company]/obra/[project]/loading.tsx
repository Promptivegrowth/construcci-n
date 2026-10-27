import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-80" /><Skeleton className="h-3 w-96" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-40" /><Skeleton className="mt-4 h-2.5" /></div>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 xl:col-span-2"><Skeleton className="h-4 w-48" /><div className="mt-6 flex h-64 items-end gap-3">{[40, 70, 55, 90, 65, 80].map((h, i) => <div key={i} className="skeleton flex-1" style={{ height: `${h}%` }} />)}</div></div>
        <div className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-4 w-40" /><Skeleton className="mx-auto mt-6 h-48 w-48 rounded-full" /></div>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div>
    </div>
  );
}
