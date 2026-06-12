import * as React from "react"
import { cn } from "@/lib/utils"

function Card({
  className,
  glass = false,
  ...props
}: React.ComponentProps<"div"> & { glass?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        glass
          ? "bg-white/[0.03] backdrop-blur-xl border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]"
          : "bg-[#141414] border-[#2A2A2A]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn("text-base sm:text-lg font-semibold leading-none tracking-tight text-white", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs sm:text-sm text-gray-400", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4 sm:p-6 pt-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center p-4 sm:p-6 pt-0", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
