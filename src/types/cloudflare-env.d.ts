declare global {
  interface CloudflareEnv {
    AC_SETTINGS_DO: DurableObjectNamespace<
      import("cloudflare:workers").DurableObject & {
        getState(): Promise<unknown>;
        setState(state: unknown): Promise<unknown>;
      }
    >;
  }
}

export {};
