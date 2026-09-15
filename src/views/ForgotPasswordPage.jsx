import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

const field = 'w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      return;
    }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Erreur lors de l\'envoi. Vérifiez votre email.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Layout>
        <Helmet>
          <title>Email envoyé — {branding.app_name}</title>
        </Helmet>
        <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/10">
              <CheckCircle2 className="h-8 w-8 text-accent" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold">Email envoyé !</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Un lien de réinitialisation a été envoyé à{' '}
              <span className="font-bold text-foreground">{email}</span>.
              Vérifiez votre boîte de réception et suivez les instructions.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Vous n&apos;avez pas reçu l&apos;email ? Vérifiez vos spams ou réessayez.
            </p>
            <div className="mt-6 grid gap-2">
              <Link
                to="/connexion"
                className="rounded-xl bg-primary px-4 py-3.5 text-center text-sm font-extrabold text-primary-foreground"
              >
                Retour à la connexion
              </Link>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(''); }}
                className="rounded-xl border border-border px-4 py-3.5 text-sm font-bold"
              >
                Ressayer
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Mot de passe oublié — {branding.app_name}</title>
        <meta name="description" content={`Réinitialisez votre mot de passe ${branding.app_name}.`} />
      </Helmet>
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <Link to="/connexion" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Connexion
        </Link>
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg">
          <div className="mb-4 flex flex-col items-center text-center gap-2">
            <BrandLogo size="md" imgClassName="rounded-xl" />
          </div>
          <h1 className="text-xl font-extrabold">Mot de passe oublié</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Saisissez votre email et nous vous enverrons un lien pour créer un nouveau mot de passe.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Adresse email
              </span>
              <input
                type="email"
                required
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoComplete="email"
                inputMode="email"
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
              Envoyer le lien de réinitialisation
            </button>
          </form>
        </div>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="font-bold text-primary underline underline-offset-4">
            Créer un compte
          </Link>
        </p>
      </div>
    </Layout>
  );
};

export default ForgotPasswordPage;
