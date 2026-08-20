import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Gift, Star, Users, MailCheck } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const POINTS_ITEMS = [
    { icon: '📦', label: 'Déclarer un objet trouvé', pts: '+10 pts' },
    { icon: '🤝', label: 'Correspondance confirmée', pts: '+50 pts' },
    { icon: '🎉', label: 'Restitution effectuée', pts: '+100 pts' },
    { icon: '👥', label: 'Parrainer un ami', pts: '+20 pts' },
];

const SignupPage = () => {
    const { signup } = useAuth();
    const { branding } = useBranding();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', password: '', referred_by: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    useEffect(() => {
        const ref = searchParams.get('ref');
        if (ref) setForm((f) => ({ ...f, referred_by: ref.toUpperCase() }));
    }, [searchParams]);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return;
        }
        setBusy(true);
        try {
            const result = await signup(form.email, form.password, {
                name: form.name,
                phone: form.phone,
                city: form.city,
                referred_by: form.referred_by.trim().toUpperCase(),
            });
            if (result?.needsConfirmation) {
                setConfirmationSent(true);
            } else {
                navigate('/tableau-de-bord');
            }
        } catch (err) {
            setError(err?.message || "L'inscription a échoué. Vérifiez vos informations.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <Helmet>
                <title>Créer un compte — {branding.app_name}</title>
                <meta name="description" content={`Inscription gratuite sur ${branding.app_name} : déclarez vos objets perdus ou retrouvés et gagnez des points de récompense.`} />
            </Helmet>
            <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 py-10 sm:py-14">
                <div className="grid gap-8 sm:gap-12 lg:grid-cols-[1fr_360px]">
                    {/* Left — form */}
                    <div>
                        <div className="mb-5 flex items-center gap-3">
                            <BrandLogo size="md" imgClassName="rounded-xl" />
                            <div>
                                <p className="font-extrabold">{branding.app_name}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{branding.tagline}</p>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
                            {confirmationSent ? (
                                <div className="text-center py-8">
                                    <MailCheck className="mx-auto h-16 w-16 text-green-600 dark:text-green-400" />
                                    <h2 className="mt-4 text-2xl font-extrabold">Vérifiez votre email</h2>
                                    <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
                                        Un lien de confirmation a été envoyé à <span className="font-bold">{form.email}</span>.
                                        Cliquez sur le lien dans l&apos;email pour activer votre compte, puis connectez-vous.
                                    </p>
                                    <Link
                                        to="/connexion"
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-primary-foreground"
                                    >
                                        Aller à la connexion
                                    </Link>
                                </div>
                            ) : (
                            <>
                            <h1 className="text-2xl font-extrabold">Créer mon compte</h1>
                            <p className="mt-1.5 text-sm text-muted-foreground">
                                Gratuit. Vos coordonnées restent privées.
                            </p>

                        {form.referred_by && (
                            <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-secondary px-4 py-3">
                                <Gift className="h-5 w-5 shrink-0 text-accent mt-0.5" />
                                <span className="text-sm font-semibold text-secondary-foreground">
                                    Code de parrainage <span className="font-mono text-accent">{form.referred_by}</span> appliqué — votre parrain gagnera +20 points à votre inscription.
                                </span>
                            </div>
                        )}

                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <label className="flex flex-col gap-2 text-sm font-bold">
                                Nom complet
                                <input required className={field} value={form.name} onChange={set('name')} placeholder="Votre nom complet" autoComplete="name" />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-bold">
                                Email
                                <input type="email" required className={field} value={form.email} onChange={set('email')} placeholder="vous@exemple.com" autoComplete="email" inputMode="email" />
                            </label>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Téléphone
                                    <input className={field} value={form.phone} onChange={set('phone')} placeholder="+225 ..." inputMode="tel" autoComplete="tel" />
                                </label>
                                <label className="flex flex-col gap-2 text-sm font-bold">
                                    Ville
                                    <input className={field} value={form.city} onChange={set('city')} placeholder="Abidjan, Dakar..." autoComplete="address-level2" />
                                </label>
                            </div>
                            <label className="flex flex-col gap-2 text-sm font-bold">
                                Mot de passe
                                <input type="password" required className={field} value={form.password} onChange={set('password')} placeholder="8 caractères minimum" autoComplete="new-password" />
                            </label>
                            <label className="flex flex-col gap-2 text-sm font-bold">
                                Code de parrainage <span className="font-normal text-muted-foreground">(optionnel)</span>
                                <input
                                    className={field}
                                    value={form.referred_by}
                                    onChange={set('referred_by')}
                                    placeholder="Ex : OBJ-A4K9ZQ"
                                />
                                <span className="text-xs font-normal text-muted-foreground">Vous recevrez automatiquement votre propre code dès votre inscription.</span>
                            </label>
                            {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>}
                            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 font-extrabold text-primary-foreground shadow-lg shadow-primary/25 disabled:opacity-60 text-base min-h-[52px] transition-transform active:scale-[0.98]">
                                {busy && <Loader2 className="h-5 w-5 animate-spin" />}
                                Créer mon compte gratuitement
                            </button>
                        </form>
                        </>
                            )}
                        </div>
                        <p className="mt-5 text-sm text-muted-foreground text-center sm:text-left">
                            Déjà membre ?{' '}
                            <Link to="/connexion" className="font-bold text-primary underline underline-offset-4">
                                Se connecter
                            </Link>
                        </p>
                    </div>

                    {/* Right — benefits */}
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                            <p className="flex items-center gap-2 font-extrabold">
                                <Star className="h-5 w-5 text-primary" />
                                Comment gagner des points
                            </p>
                            <ul className="mt-4 space-y-3">
                                {POINTS_ITEMS.map((item) => (
                                    <li key={item.label} className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <span>{item.icon}</span> {item.label}
                                        </span>
                                        <span className="font-mono text-sm font-bold text-primary shrink-0">{item.pts}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
                            <p className="flex items-center gap-2 font-extrabold">
                                <Users className="h-5 w-5 text-accent" />
                                Votre code de parrainage
                            </p>
                            <p className="mt-3 text-sm text-muted-foreground">
                                Dès votre inscription, vous recevez automatiquement un code unique au format <span className="font-mono font-bold text-foreground">OBJ-XXXXXX</span>. Partagez-le et gagnez <span className="font-bold text-primary">+20 points</span> pour chaque ami inscrit.
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground">
                                Les codes sont uniques, non-réutilisables par le même utilisateur, et vous ne pouvez pas vous parrainer vous-même.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default SignupPage;
