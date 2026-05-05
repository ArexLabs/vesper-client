import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

interface SodiumToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isDownloading: boolean;
  downloadStatus: "idle" | "success" | "error";
}

export function SodiumToggle({
  checked,
  onCheckedChange,
  isDownloading,
  downloadStatus,
}: SodiumToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="sodium-toggle" className="text-sm font-medium leading-none">
            Include Sodium (Performance Mod)
          </Label>
          <p className="text-xs text-muted-foreground">
            Automatically adds Sodium for better performance. Recommended.
          </p>
        </div>
        <Switch
          id="sodium-toggle"
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={isDownloading}
          className="data-[state=checked]:bg-[#ffcea7]"
        />
      </div>
      {isDownloading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Downloading Sodium...</span>
        </div>
      )}
      {downloadStatus === "success" && !isDownloading && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Sodium installed</span>
        </div>
      )}
      {downloadStatus === "error" && !isDownloading && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Sodium could not be installed. Instance created anyway.</span>
        </div>
      )}
    </div>
  );
}
