<<<<<<< HEAD
import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
=======
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
<<<<<<< HEAD
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
=======
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
        )}
        ref={ref}
        {...props}
      />
<<<<<<< HEAD
    );
  },
);
Input.displayName = 'Input';

export { Input };
=======
    )
  }
)
Input.displayName = "Input"

export { Input }
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
