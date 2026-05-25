import { AccountCard } from "@/components/AccountCard";
import { useAuthStore } from "@/store/auth";

export function SettingsPage() {
  const status = useAuthStore((s) => s.status);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const isLoggedIn = status?.is_logged_in ?? false;
  const username = status?.profile?.display_name ?? null;

  const handleLogin = () => {
    // No-op: auth flow starts from the launcher store using device code flow
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Account</h2>
        <AccountCard
          isLoggedIn={isLoggedIn}
          username={username ?? undefined}
          onLogin={handleLogin}
        />
      </section>
    </div>
  );
}
