import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-72" /><Skeleton className="h-3 w-[28rem] max-w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-3 w-28" /><Skeleton className="mt-3 h-7 w-24" /></div>)}
      </div>
      <div className="space-y-2 rounded-2xl border border-line bg-white p-5">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-10" />)}</div>
    </div>
  );
}
