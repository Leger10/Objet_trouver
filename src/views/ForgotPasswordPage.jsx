import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Headset } from 'lucide-react';
import Layout from '@/components/Layout';
import BrandLogo from '@/components/BrandLogo';
import { useBranding } from '@/contexts/BrandingContext';
import env from '@/lib/env';

const ForgotPasswordPage = () => {
  const { branding } = useBranding();

  return (
    <Layout>
      <Helmet>
        <title>Mot de passe oublié — {branding.app_name}</title>
        <meta name="description" content={`Contactez l'administration pour réinitialiser votre mot de passe ${branding.app_name}.`} />
      </Helmet>
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:py-14">
        <Link to="/connexion" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Connexion
        </Link>
        <div className="mt-5 rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-lg text-center">
          <div className="mb-4 flex flex-col items-center gap-2">
            <BrandLogo size="md" imgClassName="rounded-xl" />
          </div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10">
            <Headset className="h-7 w-7 text-accent" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold">Mot de passe oublié</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pour réinitialiser votre mot de passe, contactez l'administration de{' '}
            <span className="font-bold text-foreground">{branding.app_name}</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Écrivez-nous à{' '}
            <a
              href={`mailto:${env.VITE_ADMIN_EMAIL}?subject=${encodeURIComponent('Réinitialisation de mot de passe')}`}
              className="font-bold text-primary underline underline-offset-4"
            >
              {env.VITE_ADMIN_EMAIL}
            </a>{' '}
            en précisant l'adresse email liée à votre compte.
          </p>
          <div className="mt-6">
            <a
              href={`mailto:${env.VITE_ADMIN_EMAIL}?subject=${encodeURIComponent('Réinitialisation de mot de passe')}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground"
            >
              Contacter l'administration
            </a>
          </div>
          <Link
            to="/connexion"
            className="mt-4 inline-block rounded-xl border border-border px-4 py-3.5 text-sm font-bold"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default ForgotPasswordPage;
