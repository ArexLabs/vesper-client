import { AccountCard } from "@/components/AccountCard";
import { useAuthStore } from "@/store/auth";

export function SettingsPage() {
  const { isLoggedIn, username, setLoggedIn, setLoggedOut } = useAuthStore();

  const handleLogin = () => {
    setLoggedIn("Player");
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
