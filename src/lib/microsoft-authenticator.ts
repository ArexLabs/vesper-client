import { invokeOrThrow } from "@/lib/ipc";
import type { Profile, UserSession } from "@/lib/schemas";

const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const CLIENT_ID = "00000000402b5328"; // Minecraft Client ID
const SCOPE = "XboxLive.signin offline_access";
const REDIRECT_URI = "http://localhost:1420/auth/callback";

export class MicrosoftAuthenticator {
  private static instance: MicrosoftAuthenticator;
  private currentSession: UserSession | null = null;

  private constructor() {}

  public static getInstance(): MicrosoftAuthenticator {
    if (!MicrosoftAuthenticator.instance) {
      MicrosoftAuthenticator.instance = new MicrosoftAuthenticator();
    }
    return MicrosoftAuthenticator.instance;
  }

  /**
   * Generates a code challenge for PKCE
   */
  private async generatePKCE() {
    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return { verifier, challenge };
  }

  /**
   * Starts the login flow by opening the system browser
   */
  public async login(): Promise<Profile> {
    const { verifier, challenge } = await this.generatePKCE();

    // The backend will handle the local loopback server to catch the redirect
    const authUrl = new URL(MICROSOFT_AUTH_URL);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPE);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Invoke Tauri command to open browser and wait for code
    const code = await invokeOrThrow<string>("auth_open_browser_and_get_code", { 
      url: authUrl.toString(),
      verifier 
    });

    // Exchange code for tokens and complete the Minecraft auth chain
    return await this.completeAuthChain(code, verifier);
  }

  private async completeAuthChain(code: string, verifier: string): Promise<Profile> {
    // We delegate the heavy lifting and sensitive token handling to the backend
    const result = await invokeOrThrow<{ session: UserSession; profile: Profile }>(
      "auth_complete_ms_minecraft_chain", 
      { code, verifier }
    );

    this.currentSession = result.session;
    return result.profile;
  }

  public async refreshSession(refreshToken: string): Promise<Profile> {
    const result = await invokeOrThrow<{ session: UserSession; profile: Profile }>(
      "auth_refresh_ms_minecraft_chain",
      { refreshToken }
    );

    this.currentSession = result.session;
    return result.profile;
  }

  public getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  public async logout() {
    this.currentSession = null;
    await invokeOrThrow("auth_logout_microsoft");
  }
}
