import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const STORAGE_KEY = 'objetrouve_info_popup_seen';

// Show the informational popup once per day (date-based), centered with overlay.
const InfoPopup = () => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            const today = new Date().toISOString().slice(0, 10);
            const seen = localStorage.getItem(STORAGE_KEY);
            if (seen !== today) {
                setOpen(true);
            }
        } catch (_) {
            setOpen(true);
        }
    }, []);

    const close = () => {
        try {
            localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10));
        } catch (_) {
            /* ignore */
        }
        setOpen(false);
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            onClick={close}
        >
            <div
                className="relative w-full max-w-md rounded-2xl bg-card p-6 sm:p-7 shadow-2xl sheet-up"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={close}
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted-foreground active:scale-95"
                    aria-label="Fermer"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-600">
                        <AlertTriangle className="h-6 w-6" />
                    </span>
                    <h2 className="text-lg font-extrabold tracking-tight">⚠️ Information importante</h2>
                </div>

                <p className="mt-4 text-sm font-semibold text-foreground">
                    Pour retirer un objet perdu sur la plateforme, vous devez :
                </p>

                <ol className="mt-3 space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex gap-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">1</span>
                        <span>Vous munir d'une <b className="text-foreground">déclaration de perte</b> préalablement établie au commissariat ou à la Gendarmerie.</span>
                    </li>
                    <li className="flex gap-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">2</span>
                        <span>Vous présenter dans nos locaux avec une <b className="text-foreground">copie de cette déclaration</b>.</span>
                    </li>
                    <li className="flex gap-2.5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">3</span>
                        <span>Signer un <b className="text-foreground">procès-verbal de restitution</b>.</span>
                    </li>
                </ol>

                <button
                    type="button"
                    onClick={close}
                    className="mt-6 w-full rounded-xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.98] transition-transform"
                >
                    J'ai compris
                </button>
            </div>
        </div>
    );
};

export default InfoPopup;
