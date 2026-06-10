export const MANAGER_ALERT_TYPES = [
  "POSITION_NOT_DETECTED",
  "ABSENCE_OUT_OF_AREA",
] as const;

export type ManagerAlertType = (typeof MANAGER_ALERT_TYPES)[number];

export type ManagerAlert = {
  type: ManagerAlertType;
  userId: string;
  userName: string;
  userEmail: string;
  message: string;
  severity: "warning" | "critical";
  lastSeenAt: string | null;
  areaCodes: string[];
};
