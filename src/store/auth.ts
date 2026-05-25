import { create } from "zustand";

export interface MicrosoftProfile {
  id: string;
  display_name: string;
  email: string | null;
  tenant_id: string | null;
  minecraft_username: string | null;
}

export interface AuthStatus {
  is_logged_in: boolean;
  profile: MicrosoftProfile | null;
  token_info: {
    expires_at: number;
    scopes: string;
    is_expired: boolean;
  } | null;
  secure_storage_available: boolean;
  message: string | null;
}

export interface DeviceLoginStart {
  session_id: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
  expires_in_seconds: number;
  interval_seconds: number;
  message: string;
}

interface AuthState {
  status: AuthStatus | null;
  activeFlow: DeviceLoginStart | null;
  isLoading: boolean;
  error: string | null;

  setStatus: (status: AuthStatus) => void;
  setActiveFlow: (flow: DeviceLoginStart | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: null,
  activeFlow: null,
  isLoading: false,
  error: null,

  setStatus: (status) => set({ status, error: null }),
  setActiveFlow: (flow) => set({ activeFlow: flow, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({
      status: null,
      activeFlow: null,
      isLoading: false,
      error: null,
    }),
}));
