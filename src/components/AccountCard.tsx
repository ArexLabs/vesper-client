import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";

interface AccountCardProps {
  isLoggedIn: boolean;
  username?: string;
  onLogin: () => void;
}

export function AccountCard({ isLoggedIn, username, onLogin }: AccountCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await invoke("microsoft_login");
      onLogin();
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoggedIn && username) {
    return (
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#ffcea7] flex items-center justify-center text-sm font-medium">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{username}</p>
            <p className="text-xs text-muted-foreground">Microsoft Account</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleLogin}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <svg className="h-5 w-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm">Not Logged In</p>
            <p className="text-xs text-muted-foreground">Click to sign in with Microsoft</p>
          </div>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Button size="sm" variant="secondary">
            Sign In
          </Button>
        )}
      </div>
    </Card>
  );
}
