import { createContext } from "react";
import type { NotificationsContextValue } from "./notifications.types";

export const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);
