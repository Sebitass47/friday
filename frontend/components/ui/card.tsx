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
          ? "bg-black/[0.03] dark:bg-white/[0.03] backdrop-blur-xl border-black/10 dark:border-white/10 shadow-lg"
          : "bg-white dark:bg-[#141414] border-black/10 dark:border-[#2A2A2A]",
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
      className={cn("text-base sm:text-lg font-semibold leading-none tracking-tight text-black dark:text-white", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs sm:text-sm text-black/60 dark:text-gray-400", className)}
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
