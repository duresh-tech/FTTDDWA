"use client";

import * as React from "react";
import { fetchAppSettings, type AppSettings } from "@/lib/app-settings";
import { getAppName } from "@/lib/runtime-config";

const DEFAULT_SETTINGS: AppSettings = { appName: getAppName(), logoPath: null };

let state: AppSettings = DEFAULT_SETTINGS;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/**
 * Loads branding from the API once per page load.
 *
 * The DB `app.name` row wins, with the runtime APP_NAME as the fallback. It
 * used to be the other way around -- env always won and the DB row was
 * ignored -- which made the app name a deploy-time-only setting and left both
 * the first-run setup wizard and the App Settings page writing a value nothing
 * ever displayed.
 */
function ensureLoaded() {
  if (loaded || inflight) return;
  inflight = fetchAppSettings()
    .then((data) => {
      state = {
        appName: data.appName?.trim() || getAppName(),
        logoPath: data.logoPath,
      };
    })
    .catch(() => {
      // keep the default on failure
    })
    .finally(() => {
      loaded = true;
      inflight = null;
      notify();
    });
}

export function useAppSettings(): AppSettings {
  React.useEffect(() => {
    ensureLoaded();
  }, []);

  return React.useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => state,
    () => DEFAULT_SETTINGS,
  );
}
