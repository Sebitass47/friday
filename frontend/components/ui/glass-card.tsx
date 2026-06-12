import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function GlassCard({ className, children, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl shadow-lg hover:border-white/20 transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
