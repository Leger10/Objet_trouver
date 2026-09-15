import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const ResetPasswordPage = () => {
  const { resetPassword } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(password);
      setDone(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      setError(err?.message || 'Erreur lors de la réinitialisation. Le lien a peut-être expiré.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Layout>
        <Helmet>
          <title>Mot de passe réinitialisé — {branding.app_name}</title>
        </Helmet>
        <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/10">
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold">Mot de passe mis à jour !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre nouveau mot de passe est actif. Redirection vers votre espace...
            </p>
            <Link
              to="/"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground"
            >
              Aller à l'accueil
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Nouveau mot de passe — {branding.app_name}</title>
      </Helmet>
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <div className="mb-5 flex flex-col items-center text-center gap-2">
          <BrandLogo size="md" imgClassName="rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
          <h1 className="text-xl font-extrabold">Nouveau mot de passe</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choisissez un mot de passe sécurisé pour votre compte.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Nouveau mot de passe
              </span>
              <input
                type="password"
                required
                className={field}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                autoComplete="new-password"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Confirmer le mot de passe
              </span>
              <input
                type="password"
                required
                className={field}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retapez le mot de passe"
                autoComplete="new-password"
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
              Enregistrer le nouveau mot de passe
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ResetPasswordPage;
