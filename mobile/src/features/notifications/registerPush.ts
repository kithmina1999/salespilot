import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiFetch } from "@/api/client";
import { useAppStore } from "@/store/appStore";

export async function registerPushTokenAfterLogin() {
  if (Constants.appOwnership === "expo") return null;
  if (!Device.isDevice) return null;

  const Notifications = await import("expo-notifications");
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  useAppStore.getState().setHasAskedPushPermission(true);
  if (status !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync();

  await apiFetch("/api/v1/devices/register", {
    method: "POST",
    body: JSON.stringify({
      token: token.data,
      platform: "android"
    })
  }).catch(() => null);

  return token.data;
}
