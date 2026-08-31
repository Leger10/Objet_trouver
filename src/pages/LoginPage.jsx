import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Eye, EyeOff, LogIn } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const LoginPage = () => {
    const { login } = useAuth();
    const { branding } = useBranding();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const notice = searchParams.get('notice');
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const blockReason = localStorage.getItem('auth_block_reason');
        if (blockReason) {
            setError(blockReason);
            localStorage.removeItem('auth_block_reason');
        }
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(form.email, form.password);
            navigate('/tableau-de-bord');
        } catch (err) {
            const msg = err?.message || '';
            if (msg.includes('bloqué')) {
                setError(msg);
            } else {
                setError('Email ou mot de passe incorrect. Si votre compte a été supprimé, contactez le support.');
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <Helmet>
                <title>Connexion — {branding.app_name}</title>
                <meta name="description" content={`Connectez-vous à ${branding.app_name} pour suivre vos déclarations, correspondances et récompenses.`} />
            </Helmet>
            <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-10 sm:py-14">
                <div className="mb-6 flex flex-col items-center text-center gap-2">
                    <BrandLogo size="lg" imgClassName="rounded-2xl" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{branding.tagline}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
                    <h1 className="text-2xl font-extrabold">Connexion</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">Accédez à vos correspondances et points.</p>
                    {notice && (
                        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                            <LogIn className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{notice}</span>
                        </div>
                    )}
                    <form onSubmit={submit} className="mt-6 space-y-4">
                        <label className="flex flex-col gap-1.5 text-sm font-bold">
                            Email
                            <input type="email" required className={field} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                        </label>
                        <label className="flex flex-col gap-1.5 text-sm font-bold">
                            Mot de passe
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} required className={`${field} pr-11`} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                                <button type="button" tabIndex={-1} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </label>
                        <div className="text-right">
                            <Link to="/mot-de-passe-oublie" className="text-xs font-bold text-primary underline underline-offset-4">
                                Mot de passe oublié ?
                            </Link>
                        </div>
                        {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}{' '}
                            <Link to="/support?subject=compte_supprime" className="font-extrabold underline underline-offset-2 hover:text-destructive/80">Contacter le support</Link>
                        </p>}
                        <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 font-extrabold text-primary-foreground shadow-lg shadow-primary/25 disabled:opacity-60 text-base min-h-[52px] transition-transform active:scale-[0.98]">
                            {busy && <Loader2 className="h-5 w-5 animate-spin" />} Se connecter
                        </button>
                    </form>
                </div>
                <p className="mt-5 text-center text-sm text-muted-foreground">
                    Pas encore de compte ?{' '}
                    <Link to="/inscription" className="font-bold text-primary underline underline-offset-4">
                        Créer un compte gratuit
                    </Link>
                </p>
            </div>
        </Layout>
    );
};

export default LoginPage;
