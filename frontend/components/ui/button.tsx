import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none select-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-white text-black border-transparent hover:bg-white/90 hover:shadow-lg",
        outline:
          "border-[#2A2A2A] bg-[#141414] text-white hover:bg-[#1A1A1A] hover:border-white/20",
        ghost:
          "border-transparent bg-transparent text-white hover:bg-white/10",
        destructive:
          "bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/20 hover:bg-[#FF4444]/20",
        success:
          "bg-[#A8FF3E]/10 text-[#A8FF3E] border-[#A8FF3E]/20 hover:bg-[#A8FF3E]/20",
      },
      size: {
        default: "h-9 px-4 gap-2",
        xs: "h-7 px-2 gap-1 text-xs rounded-md",
        sm: "h-8 px-3 gap-1.5 text-xs rounded-md",
        lg: "h-10 px-5 gap-2 text-base",
        icon: "size-9",
        "icon-xs": "size-7 rounded-md",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
