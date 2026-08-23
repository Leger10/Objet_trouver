// src/lib/brandingDefaults.js

/** Default RetrouveMoi branding — also used as reset baseline. */

export const LOGO_URL = '/images/icon-192.png';

export const DEFAULT_HERO =
    'https://images.hostinger.com/1d7b56f8-ae12-42ac-9369-50d15f8f42a1.png';

export const BRANDING_DEFAULTS = {
    app_name: 'RetrouveMoi',
    logo_url: LOGO_URL,
    tagline: 'DÉCLAREZ • RECHERCHEZ • RETROUVEZ',
    color_red: '#E63946',
    color_green: '#2D6A4F',
    color_blue: '#001F3F',
    color_yellow: '#FFD60A',
    color_white: '#FFFFFF',
    color_gray_light: '#F5F5F5',
    color_gray_dark: '#333333',
    address: 'Locaux RetrouveMoi',
    phone: '',
    email: 'contact@retrouvezmoi.app',
    hours: 'Lun – Sam, 8h – 18h',
    social_facebook: '',
    social_twitter: '',
    social_instagram: '',
    social_whatsapp: '',
    currency: 'FCFA',
    language: 'fr',
    hero_image_url: DEFAULT_HERO,
    hero_link: '',
    sponsor_name: '',
    sponsor_url: '',
    sponsor_tagline: '',
};

/**
 * Vérifie si une chaîne est une couleur hexadécimale valide
 * @param {string} v - La chaîne à vérifier
 * @returns {boolean}
 */
export const isHexColor = (v) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(String(v || '').trim());

/**
 * Vérifie si une chaîne est un email valide
 * @param {string} v - La chaîne à vérifier
 * @returns {boolean}
 */
export const isValidEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

/**
 * Vérifie si une chaîne est une URL valide
 * @param {string} v - La chaîne à vérifier
 * @returns {boolean}
 */
export const isValidUrl = (v) => {
    if (!v) return true;
    try {
        new URL(v);
        return true;
    } catch (_) {
        return false;
    }
};

/**
 * Applique les couleurs du branding au DOM
 * @param {Object} b - L'objet branding
 */
export const applyBrandingCss = (b) => {
    if (typeof document === 'undefined' || !b) return;
    
    const root = document.documentElement;
    const blue = b.color_blue || BRANDING_DEFAULTS.color_blue;
    const green = b.color_green || BRANDING_DEFAULTS.color_green;
    const red = b.color_red || BRANDING_DEFAULTS.color_red;
    const yellow = b.color_yellow || BRANDING_DEFAULTS.color_yellow;
    const grayDark = b.color_gray_dark || BRANDING_DEFAULTS.color_gray_dark;
    const grayLight = b.color_gray_light || BRANDING_DEFAULTS.color_gray_light;
    const white = b.color_white || BRANDING_DEFAULTS.color_white;

    // Variables CSS personnalisées
    root.style.setProperty('--brand-red', red);
    root.style.setProperty('--brand-green', green);
    root.style.setProperty('--brand-blue', blue);
    root.style.setProperty('--brand-yellow', yellow);
    root.style.setProperty('--brand-white', white);
    root.style.setProperty('--brand-gray-light', grayLight);
    root.style.setProperty('--brand-gray-dark', grayDark);
    
    // Map primary/accent to brand blue/green
    root.style.setProperty('--brand-primary', blue);
    root.style.setProperty('--brand-accent', green);
    root.style.setProperty('--brand-danger', red);
    root.style.setProperty('--brand-highlight', yellow);

    // Mettre à jour les couleurs Tailwind via HSL
    // Convertir les couleurs hex en HSL pour une meilleure intégration
    const hexToHsl = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return null;
        
        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
                default: h = 0;
            }
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    };

    const primaryHsl = hexToHsl(blue);
    const accentHsl = hexToHsl(green);
    const dangerHsl = hexToHsl(red);

    if (primaryHsl) {
        root.style.setProperty('--primary', `${primaryHsl.h} ${primaryHsl.s}% ${primaryHsl.l}%`);
    }
    if (accentHsl) {
        root.style.setProperty('--accent', `${accentHsl.h} ${accentHsl.s}% ${accentHsl.l}%`);
    }
    if (dangerHsl) {
        root.style.setProperty('--destructive', `${dangerHsl.h} ${dangerHsl.s}% ${dangerHsl.l}%`);
    }
};

/**
 * Récupère une couleur du branding par son nom
 * @param {Object} branding - L'objet branding
 * @param {string} colorName - Le nom de la couleur
 * @param {string} fallback - La couleur de fallback
 * @returns {string}
 */
export const getBrandingColor = (branding, colorName, fallback = '#000000') => {
    if (!branding) return fallback;
    
    const colorMap = {
        red: 'color_red',
        green: 'color_green',
        blue: 'color_blue',
        yellow: 'color_yellow',
        white: 'color_white',
        grayLight: 'color_gray_light',
        grayDark: 'color_gray_dark',
        primary: 'color_blue',
        accent: 'color_green',
        danger: 'color_red'
    };
    
    const key = colorMap[colorName] || colorName;
    return branding[key] || fallback;
};

/**
 * Génère les styles CSS pour le branding
 * @param {Object} branding - L'objet branding
 * @returns {string} Les styles CSS
 */
export const generateBrandingStyles = (branding) => {
    if (!branding) return '';
    
    const blue = branding.color_blue || BRANDING_DEFAULTS.color_blue;
    const green = branding.color_green || BRANDING_DEFAULTS.color_green;
    const red = branding.color_red || BRANDING_DEFAULTS.color_red;
    const yellow = branding.color_yellow || BRANDING_DEFAULTS.color_yellow;
    
    return `
        :root {
            --brand-red: ${red};
            --brand-green: ${green};
            --brand-blue: ${blue};
            --brand-yellow: ${yellow};
            --brand-primary: ${blue};
            --brand-accent: ${green};
            --brand-danger: ${red};
            --brand-highlight: ${yellow};
        }
    `;
};

export default {
    BRANDING_DEFAULTS,
    LOGO_URL,
    isHexColor,
    isValidEmail,
    isValidUrl,
    applyBrandingCss,
    getBrandingColor,
    generateBrandingStyles
};