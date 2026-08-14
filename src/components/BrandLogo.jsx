import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '@/contexts/BrandingContext';
import { LOGO_URL } from '@/lib/brandingDefaults';

/**
 * size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * variant: 'full' (logo + optional name) | 'mark' (image only)
 */
const SIZES = {
    xs: 'h-7 w-7',
    sm: 'h-8 w-8 sm:h-9 sm:w-9',
    md: 'h-10 w-10 sm:h-12 sm:w-12',
    lg: 'h-14 w-14 sm:h-16 sm:w-16',
    xl: 'h-20 w-20 sm:h-24 sm:w-24',
};

const BrandLogo = ({
    size = 'sm',
    showName = false,
    linkToHome = true,
    className = '',
    imgClassName = '',
    dark = false,
}) => {
    const { branding } = useBranding();
    const src = branding?.logo_url || LOGO_URL;
    const name = branding?.app_name || 'RetrouveMoi';
    const img = (
        <img
            src={src}
            alt={name}
            className={`${SIZES[size] || SIZES.sm} object-contain ${imgClassName}`}
            loading="eager"
            decoding="async"
        />
    );

    const inner = (
        <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
            {img}
            {showName && (
                <span
                    className={`truncate font-extrabold tracking-tight ${
                        dark ? 'text-white' : 'text-foreground'
                    } ${size === 'xs' || size === 'sm' ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}
                >
                    {name}
                </span>
            )}
        </span>
    );

    if (!linkToHome) return inner;
    return (
        <Link to="/" className="inline-flex shrink-0 active:scale-95 transition-transform" aria-label={name}>
            {inner}
        </Link>
    );
};

export default BrandLogo;
