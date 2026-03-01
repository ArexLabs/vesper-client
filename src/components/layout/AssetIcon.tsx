import { cn } from "@/lib/utils";
import type { CSSProperties, HTMLAttributes } from "react";

type AssetIconProps = HTMLAttributes<HTMLSpanElement> & {
  src: string;
};

export function AssetIcon({ className, src, style, ...props }: AssetIconProps) {
  const iconStyle = {
    ...style,
    WebkitMask: `url(${src}) center / contain no-repeat`,
    backgroundColor: "currentColor",
    mask: `url(${src}) center / contain no-repeat`,
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={iconStyle}
      {...props}
    />
  );
}
