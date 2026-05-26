import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { X } from "lucide-react";

type InfoBannerProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function InfoBanner({ visible, onDismiss }: InfoBannerProps) {
  if (!visible) return null;

  return (
    <div className="flex min-h-9 items-center gap-3 border-b border-[#0b5d8a] bg-[#0a5f8c] px-4 text-sm font-semibold text-white">
      <div className="min-w-0 flex-1 truncate">Example Info. It will be shown here.</div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Dismiss info banner"
              className="h-7 w-7 text-white hover:bg-white/10 hover:text-white"
              onClick={onDismiss}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>Dismiss</TooltipContent>
      </Tooltip>
    </div>
  );
}
