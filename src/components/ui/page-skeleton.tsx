import { Skeleton } from "@/components/ui/skeleton";

/** Generic table page skeleton — e.g. Processos, Contatos, Financeiro */
export const TablePageSkeleton = () => (
  <div className="space-y-5 animate-fade-in">
    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
    {/* Search bar */}
    <Skeleton className="h-10 w-full rounded-lg" />
    {/* Table rows */}
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 flex-1 max-w-[150px] hidden md:block" />
            <Skeleton className="h-4 flex-1 max-w-[150px] hidden md:block" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Dashboard-like skeleton with stat cards and charts */
export const DashboardSkeleton = () => (
  <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
    {/* Stat cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border rounded-lg p-4 space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
    {/* Chart placeholder */}
    <div className="bg-card border rounded-lg p-6">
      <Skeleton className="h-4 w-32 mb-4" />
      <Skeleton className="h-48 w-full rounded" />
    </div>
  </div>
);

/** Detail page skeleton — e.g. ProcessDetail */
export const DetailPageSkeleton = () => (
  <div className="space-y-5 animate-fade-in">
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded" />
      <Skeleton className="h-6 w-64" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card border rounded-lg p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="bg-card border rounded-lg p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-start">
              <Skeleton className="h-3 w-3 rounded-full mt-1 shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  </div>
);
