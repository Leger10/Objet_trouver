import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X } from "lucide-react";
import { OneSignal, requestPermission } from "@/lib/onesignal";

let dialogShown = false;

export default function OneSignalVerificationDialog() {
  const [show, setShow] = useState(false);
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    function evaluate() {
      if (dialogShown) return;
      const id = OneSignal?.User?.PushSubscription?.id;
      if (id) {
        dialogShown = true;
        setShow(true);
      }
    }

    OneSignal?.User?.PushSubscription?.addEventListener?.("change", () => {
      evaluate();
    });

    evaluate();
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
        >
          <button
            onClick={() => setShow(false)}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Bell className="h-7 w-7 text-emerald-600" />
            </div>

            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Intégration OneSignal terminée !
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Vous pouvez maintenant recevoir des notifications push et des messages depuis RetrouveMoi. Appuyez ci-dessous pour activer les notifications.
            </p>

            <button
              onClick={() => {
                requestPermission();
                setShow(false);
              }}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Compris
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
