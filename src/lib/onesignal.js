import OneSignal from 'react-onesignal';

let initialized = false;

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

export async function initOneSignal() {
  if (initialized || !ONESIGNAL_APP_ID) return;
  initialized = true;

  await OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: "/push/onesignal/" },
    allowLocalhostAsSecureOrigin: import.meta.env.DEV,
  });
}

export function loginOneSignal(userId) {
  if (!initialized || !userId) return;
  OneSignal.login(userId);
}

export function logoutOneSignal() {
  if (!initialized) return;
  OneSignal.logout();
}

export function setEmailOneSignal(email) {
  if (!initialized || !email) return;
  OneSignal.User.addEmail(email);
}

export function setTagOneSignal(key, value) {
  if (!initialized) return;
  OneSignal.User.addTag(key, value);
}

export function requestPermission() {
  if (!initialized) return;
  OneSignal.Notifications.requestPermission();
}

export { OneSignal };
