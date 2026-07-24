import type { AirconStateDO } from "../lib/aircon-state-do";

declare global {
  interface CloudflareEnv {
    AC_STATE: DurableObjectNamespace<AirconStateDO>;
  }
}

export {};
