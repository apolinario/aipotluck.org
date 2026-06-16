import type { UserType } from "@/app/(auth)/auth";
import { LIMITS } from "@/lib/limits";

type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerHour: LIMITS.userMessagesPerHour,
  },
  regular: {
    maxMessagesPerHour: LIMITS.userMessagesPerHour,
  },
};
