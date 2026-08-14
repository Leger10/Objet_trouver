import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const LoginPage = () => {
    const { login } = useAuth();
    const { branding } = useBranding();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(form.email, form.password);
            navigate('/tableau-de-bord');
        } catch (_) {
            setError('Email ou mot de passe incorrect.');
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
                <h1 className="text-3xl font-extrabold">Connexion</h1>
                <p className="mt-2 text-sm text-muted-foreground">Accédez à vos correspondances et à votre portefeuille de points.</p>
                <form onSubmit={submit} className="mt-8 space-y-4">
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Email
                        <input type="email" required className={field} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-bold">
                        Mot de passe
                        <input type="password" required className={field} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                    </label>
                    {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">{error}</p>}
                    <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 font-extrabold text-primary-foreground disabled:opacity-60 text-base min-h-[56px]">
                        {busy && <Loader2 className="h-5 w-5 animate-spin" />} Se connecter
                    </button>
                </form>
                <p className="mt-6 text-sm text-muted-foreground">
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
