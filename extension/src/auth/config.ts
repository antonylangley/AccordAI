const DEFAULT_API_BASE_URL = "https://www.accordgovernance.com";
export const ACCORD_API_BASE_URL_KEY = "accordApiBaseUrl";

export type GuardPublicConfig = {
  apiBaseUrl: string;
  supabaseUrl: string;
  publishableKey: string;
};

let cachedConfig: GuardPublicConfig | null = null;

export async function getGuardPublicConfig(): Promise<GuardPublicConfig> {
  if (cachedConfig) return cachedConfig;
  const apiBaseUrl = await getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/guard/config`, { cache: "no-store" });
  if (!response.ok) throw new Error("Accord account configuration is temporarily unavailable.");
  const body = (await response.json()) as Partial<GuardPublicConfig>;
  if (!isHttpsOrLocal(body.supabaseUrl) || typeof body.publishableKey !== "string" || !body.publishableKey) {
    throw new Error("Accord account configuration is incomplete.");
  }
  cachedConfig = {
    apiBaseUrl,
    supabaseUrl: body.supabaseUrl,
    publishableKey: body.publishableKey
  };
  return cachedConfig;
}

export async function getApiBaseUrl() {
  const storage = globalThis.chrome?.storage?.local;
  const configured = storage
    ? await new Promise<unknown>((resolve) => storage.get(ACCORD_API_BASE_URL_KEY, (items) => resolve(items[ACCORD_API_BASE_URL_KEY])))
    : null;
  const value = typeof configured === "string" ? configured : DEFAULT_API_BASE_URL;
  return trustedApiBaseUrl(value);
}

export function resetGuardPublicConfigForTests() {
  cachedConfig = null;
}

function isHttpsOrLocal(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function trustedApiBaseUrl(value: string) {
  try {
    const url = new URL(value);
    const isAccordProduction =
      url.protocol === "https:" && ["accordgovernance.com", "www.accordgovernance.com"].includes(url.hostname);
    const isLocalDevelopment =
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (!isAccordProduction && !isLocalDevelopment) return DEFAULT_API_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}
