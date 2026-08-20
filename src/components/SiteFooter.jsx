import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { useBranding } from '@/contexts/BrandingContext';

const SiteFooter = () => {
    const { branding } = useBranding();
    const year = new Date().getFullYear();
    const socials = [
        { label: 'Facebook', href: branding.social_facebook },
        { label: 'X / Twitter', href: branding.social_twitter },
        { label: 'Instagram', href: branding.social_instagram },
        {
            label: 'WhatsApp',
            href: branding.social_whatsapp
                ? branding.social_whatsapp.startsWith('http')
                    ? branding.social_whatsapp
                    : `https://wa.me/${String(branding.social_whatsapp).replace(/\D/g, '')}`
                : '',
        },
    ].filter((s) => s.href);

    return (
        <footer className="mt-auto border-t border-border bg-[hsl(206_40%_8%)] dark:bg-[hsl(206_40%_5%)] text-white">
            <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 py-10 sm:py-12">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <BrandLogo size="md" showName dark linkToHome imgClassName="rounded-lg bg-black/40 p-1" />
                        <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[var(--brand-yellow,#FFD60A)]">
                            {branding.tagline}
                        </p>
                        <p className="mt-3 text-sm text-white/70 leading-relaxed">
                            Plateforme de déclaration et de restitution d&apos;objets et documents perdus ou retrouvés.
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-extrabold mb-3">Contact</p>
                        <ul className="space-y-2.5 text-sm text-white/80">
                            {branding.address && (
                                <li className="flex gap-2">
                                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                                    <span>{branding.address}</span>
                                </li>
                            )}
                            {branding.phone && (
                                <li className="flex gap-2">
                                    <Phone className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                                    <a href={`tel:${branding.phone.replace(/\s/g, '')}`} className="hover:text-white underline-offset-2 hover:underline">
                                        {branding.phone}
                                    </a>
                                </li>
                            )}
                            {branding.email && (
                                <li className="flex gap-2">
                                    <Mail className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                                    <a href={`mailto:${branding.email}`} className="hover:text-white underline-offset-2 hover:underline break-all">
                                        {branding.email}
                                    </a>
                                </li>
                            )}
                            {branding.hours && (
                                <li className="flex gap-2">
                                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-accent" />
                                    <span>{branding.hours}</span>
                                </li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <p className="text-sm font-extrabold mb-3">Navigation</p>
                        <ul className="space-y-2 text-sm text-white/80">
                            <li><Link to="/declarer" className="hover:text-white">Déclarer</Link></li>
                            <li><Link to="/rechercher" className="hover:text-white">Rechercher</Link></li>
                            <li><Link to="/don" className="hover:text-white">Faire un don</Link></li>
                            <li><Link to="/partenaires" className="hover:text-white">Partenaires</Link></li>
                            <li><Link to="/abonnement" className="hover:text-white">Abonnements</Link></li>
                        </ul>
                    </div>
                    <div>
                        <p className="text-sm font-extrabold mb-3">Réseaux</p>
                        {socials.length === 0 ? (
                            <p className="text-sm text-white/50">Liens à configurer dans l&apos;admin.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {socials.map((s) => (
                                    <a
                                        key={s.label}
                                        href={s.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                                    >
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        )}
                        <p className="mt-4 text-xs text-white/50">
                            Devise : <span className="font-bold text-white/80">{branding.currency}</span>
                        </p>
                    </div>
                </div>
                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50">
                    <p>© {year} {branding.app_name}. Tous droits réservés.</p>
                    <p className="font-semibold uppercase tracking-wider text-white/40">{branding.tagline}</p>
                </div>
            </div>
        </footer>
    );
};

export default SiteFooter;
