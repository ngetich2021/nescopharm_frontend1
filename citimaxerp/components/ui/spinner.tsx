'use client';

import { cn } from "@/lib/utils";
import React from "react";

export function Spinner({
                            className,
                            ...props
                        }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-foreground",
                className
            )}
            role="status"
            aria-label="loading"
            {...props}
        >
            <span className="sr-only">Loading...</span>
        </div>
    );
}
