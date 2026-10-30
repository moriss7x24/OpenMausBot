// Extra Antigravity logins are provider instances. Each id gets its own
// Google profile directory; they all use the managed ACP runtime. The
// default `antigravity` instance stays in the fleet.
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { persistableInstanceConfigs, type AppConfig } from "./config.ts";
import type { InstanceConfig, InstanceConfigMap } from "./contracts.ts";

const displayName = z.string().trim().min(1).max(80).refine((value) => !/\p{Cc}/u.test(value), "Name cannot contain control characters");
export const createAntigravityAccountSchema = z.object({ displayName }).strict();

export function newAntigravityAccount(cfg: AppConfig, body: z.infer<typeof createAntigravityAccountSchema>): { instanceId: string; instances: InstanceConfigMap } {
  const instances = persistableInstanceConfigs(cfg);
  const instanceId = `antigravity-${randomUUID()}`;
  const entry: InstanceConfig = { driver: "antigravityAgent", displayName: body.displayName };
  instances[instanceId] = entry;
  return { instanceId, instances };
}
