import React, { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, CreditCard, Lock, Phone, Smartphone } from 'lucide-react';
import {
    PAYMENT_METHODS,
    methodByKey,
    ussdCode,
    transferNumber,
    copyToClipboard,
} from '@/lib/payments';
import { formatNumber } from '@/lib/format';

const field =
    'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

/**
 * Reusable payment method picker + dynamic instructions.
 * Props:
 *  - amount: number (FCFA)
 *  - onConfirm: async (methodKey, paymentRef) => void  (called when user confirms)
 *  - busy: boolean
 *  - ctaLabel: string
 */
const PaymentMethodPicker = ({ amount = 0, onConfirm, busy = false, ctaLabel = 'Confirmer le paiement' }) => {
    const [method, setMethod] = useState('orange_money');
    const [ref, setRef] = useState('');
    const active = methodByKey(method);

    const handleCopy = async (text, label) => {
        const ok = await copyToClipboard(text, label);
        if (ok) toast.success(`${label} copié !`);
        else toast.error('Copie impossible, saisissez-le manuellement.');
    };

    return (
        <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">Méthode de paiement</p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {PAYMENT_METHODS.map((m) => {
                    const isActive = method === m.key;
                    return (
                        <button
                            key={m.key}
                            type="button"
                            onClick={() => setMethod(m.key)}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all active:scale-[0.97] ${
                                isActive ? `${m.ring} ${m.soft}` : 'border-border bg-background'
                            }`}
                        >
                            <span
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${m.color} text-white shadow-sm`}
                            >
                                <Smartphone className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-extrabold">{m.label}</span>
                                <span className="block text-[11px] text-muted-foreground">{m.hint}</span>
                            </span>
                            {isActive && <Check className={`h-5 w-5 ${m.text}`} />}
                        </button>
                    );
                })}
            </div>

            {/* Dynamic instructions */}
            <div className={`mt-4 rounded-2xl border-2 ${active.ring} ${active.soft} p-4`}>
                {active.type === 'ussd' && (
                    <div>
                        <p className={`text-sm font-extrabold ${active.text}`}>Orange Money — Code USSD</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Composez le code ci-dessous. Le montant{' '}
                            <span className="font-bold text-foreground">{formatNumber(amount)} FCFA</span> est inclus.
                        </p>
                        <div className="mt-3 flex items-stretch gap-2">
                            <code className="flex-1 truncate rounded-xl bg-background px-3 py-3 text-sm font-bold tracking-wide shadow-inner">
                                {ussdCode(amount)}
                            </code>
                            <button
                                type="button"
                                onClick={() => handleCopy(ussdCode(amount), 'Le code USSD')}
                                className={`flex shrink-0 items-center gap-1.5 rounded-xl ${active.chip} px-4 py-3 text-sm font-bold text-white active:scale-95`}
                            >
                                <Copy className="h-4 w-4" /> Copier
                            </button>
                        </div>
                        <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <li>1. Copiez le code USSD et appelez-le depuis votre clavier.</li>
                            <li>2. Validez avec votre code secret Orange Money.</li>
                            <li>3. Conservez la référence reçue par SMS.</li>
                        </ol>
                    </div>
                )}
                {active.type === 'phone' && (
                    <div>
                        <p className={`text-sm font-extrabold ${active.text}`}>{active.label} — Numéro de transfert</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Envoyez <span className="font-bold text-foreground">{formatNumber(amount)} FCFA</span> vers le numéro ci-dessous.
                        </p>
                        <div className="mt-3 flex items-stretch gap-2">
                            <code className="flex-1 truncate rounded-xl bg-background px-3 py-3 text-sm font-bold tracking-wide shadow-inner">
                                {transferNumber(active.key)}
                            </code>
                            <button
                                type="button"
                                onClick={() => handleCopy(transferNumber(active.key), 'Le numéro')}
                                className={`flex shrink-0 items-center gap-1.5 rounded-xl ${active.chip} px-4 py-3 text-sm font-bold text-white active:scale-95`}
                            >
                                <Copy className="h-4 w-4" /> Copier
                            </button>
                            <a
                                href={`tel:${transferNumber(active.key).replace(/\s/g, '')}`}
                                className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 ${active.ring} px-4 py-3 text-sm font-bold active:scale-95`}
                            >
                                <Phone className="h-4 w-4" /> Appeler
                            </a>
                        </div>
                        <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <li>1. Envoyez le montant vers le numéro ci-dessus.</li>
                            <li>2. Conservez la référence de transaction reçue par SMS.</li>
                        </ol>
                    </div>
                )}
                {active.type === 'card' && (
                    <div>
                        <p className={`text-sm font-extrabold ${active.text}`}>Paiement par carte (simulation)</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Saisissez une référence de transaction simulée pour valider. Aucun vrai numéro de carte n'est demandé.
                        </p>
                        <div className="mt-3 flex items-center gap-2 rounded-xl bg-background px-3 py-3 text-sm">
                            <CreditCard className="h-5 w-5 text-muted-foreground" />
                            <span className="text-muted-foreground">Paiement sécurisé · Visa / Mastercard</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Transaction reference */}
            <div className="mt-4">
                <label className="text-xs font-bold text-muted-foreground">Référence de transaction (SMS / reçu)</label>
                <input
                    type="text"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="ex : OM123456789 ou TR-98765"
                    className={`mt-1.5 ${field}`}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                    Indiquez la référence reçue après votre paiement pour accélérer la validation.
                </p>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Aucun numéro de carte n'est stocké. Validation manuelle sous 24h.
            </p>

            <button
                type="button"
                disabled={busy}
                onClick={() => onConfirm(method, ref.trim())}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-extrabold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
            >
                {busy ? 'Traitement…' : `${ctaLabel} · ${formatNumber(amount)} FCFA`}
            </button>
        </div>
    );
};

export default PaymentMethodPicker;
