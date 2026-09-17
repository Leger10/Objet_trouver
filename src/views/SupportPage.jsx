import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Send, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { pb } from '@/lib/pbClient';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const SUBJECTS = [
    { value: 'compte_supprime', label: 'Compte supprimé' },
    { value: 'compte_bloque', label: 'Compte bloqué' },
    { value: 'mot_de_passe', label: 'Problème de mot de passe' },
    { value: 'objet', label: 'Objet perdu / retrouvé' },
    { value: 'point', label: 'Points / Récompenses' },
    { value: 'signalement', label: 'Signalement' },
    { value: 'autre', label: 'Autre demande' },
];

const SupportPage = () => {
    const { branding } = useBranding();
    const [searchParams] = useSearchParams();
    const prefillSubject = searchParams.get('subject') || 'compte_supprime';
    const prefillMessage = searchParams.get('msg') || '';

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        subject: prefillSubject,
        message: prefillMessage,
    });
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
            setError('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        setBusy(true);
        try {
            const { error: insertErr } = await pb.from('support_messages').insert({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                subject: form.subject,
                message: form.message.trim(),
            });

            if (insertErr) throw insertErr;

            // Best-effort: notify admins via Netlify function
            try {
                await fetch('/api/send-support-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender_name: form.name.trim(),
                        subject: form.subject,
                        message_preview: form.message.trim().slice(0, 300),
                    }),
                });
            } catch (_) {
                /* best-effort */
            }

            setSent(true);
        } catch (err) {
            setError(err?.message || 'Une erreur est survenue. Réessayez.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <Helmet>
                <title>Support — {branding.app_name}</title>
                <meta name="description" content={`Contactez l'équipe ${branding.app_name} pour toute question ou problème.`} />
            </Helmet>
            <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-10 sm:py-14">
                <div className="mb-6 flex flex-col items-center text-center gap-2">
                    <BrandLogo size="lg" imgClassName="rounded-2xl" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{branding.tagline}</p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
                    {sent ? (
                        <div className="text-center py-6">
                            <CheckCircle2 className="mx-auto h-14 w-14 text-green-600 dark:text-green-400" />
                            <h2 className="mt-4 text-xl font-extrabold">Message envoyé !</h2>
                            <p className="mt-3 text-sm text-muted-foreground">
                                L&apos;administrateur a été notifié. Nous vous répondrons dans les plus brefs délais à l&apos;adresse <span className="font-bold">{form.email}</span>.
                            </p>
                            <Link
                                to="/connexion"
                                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Retour à la connexion
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-extrabold">Contacter le support</h1>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                                Expliquez-nous votre problème, nous vous répondrons par email.
                            </p>

                            <form onSubmit={submit} className="mt-6 space-y-4">
                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Nom complet *
                                    <input
                                        required
                                        className={field}
                                        value={form.name}
                                        onChange={set('name')}
                                        placeholder="Votre nom"
                                        autoComplete="name"
                                    />
                                </label>

                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Email *
                                    <input
                                        type="email"
                                        required
                                        className={field}
                                        value={form.email}
                                        onChange={set('email')}
                                        placeholder="vous@exemple.com"
                                        autoComplete="email"
                                        inputMode="email"
                                    />
                                </label>

                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Téléphone
                                    <input
                                        className={field}
                                        value={form.phone}
                                        onChange={set('phone')}
                                        placeholder="+226 ..."
                                        inputMode="tel"
                                        autoComplete="tel"
                                    />
                                </label>

                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Sujet *
                                    <select
                                        className={field}
                                        value={form.subject}
                                        onChange={set('subject')}
                                    >
                                        {SUBJECTS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
                                        ))}
                                    </select>
                                </label>

                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Message *
                                    <textarea
                                        required
                                        className={`${field} min-h-[120px] resize-y`}
                                        value={form.message}
                                        onChange={set('message')}
                                        placeholder="Décrivez votre problème en détail..."
                                        rows={5}
                                    />
                                </label>

                                {error && (
                                    <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={busy}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 font-extrabold text-primary-foreground shadow-lg shadow-primary/25 disabled:opacity-60 text-base min-h-[52px] transition-transform active:scale-[0.98]"
                                >
                                    {busy && <Loader2 className="h-5 w-5 animate-spin" />}
                                    <Send className="h-5 w-5" />
                                    Envoyer le message
                                </button>
                            </form>
                        </>
                    )}
                </div>

                {!sent && (
                    <p className="mt-5 text-center text-sm text-muted-foreground">
                        <Link to="/connexion" className="font-bold text-primary underline underline-offset-4">
                            <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
                            Retour à la connexion
                        </Link>
                    </p>
                )}
            </div>
        </Layout>
    );
};

export default SupportPage;
