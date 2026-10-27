import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-72" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-36" /></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-2xl border border-line bg-white p-5"><Skeleton className="h-5 w-48" /><Skeleton className="mt-3 h-3 w-64" /><Skeleton className="mt-6 h-3" /><Skeleton className="mt-2 h-3 w-2/3" /></div>)}
      </div>
    </div>
  );
}
