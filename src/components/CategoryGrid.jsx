import React from 'react';
import { Link } from 'react-router-dom';
import { groupCategories, metaForSlug, groupStyle, fetchCategoryCounts } from '@/lib/categories';

// Tuile individuelle de catégorie
export const CategoryTile = ({ category, count, active, onClick, to, size = 'md' }) => {
    const meta = metaForSlug(category.slug);
    const style = groupStyle(meta.group);
    const c = count || { lost: 0, found: 0, total: 0 };

    const pad = size === 'lg' ? 'p-4 sm:p-5' : 'p-3 sm:p-4';
    const emojiSize = size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl';

    const inner = (
        <span className="flex flex-col items-center text-center gap-1.5">
            <span className={`${emojiSize} leading-none`}>{meta.emoji}</span>
            <span className="text-xs sm:text-sm font-bold leading-tight line-clamp-2">{category.name}</span>
            <span className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold ${active ? 'text-white/85' : 'text-muted-foreground'}`}>
                <span className="flex items-center gap-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : 'bg-destructive/70'}`} />
                    {c.lost}
                </span>
                <span className="flex items-center gap-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white/80' : 'bg-accent'}`} />
                    {c.found}
                </span>
            </span>
        </span>
    );

    const cls = `flex items-center justify-center rounded-2xl border-2 transition-all active:scale-[0.97] min-h-[92px] ${pad} ${
        active ? style.active + ' rt-shadow' : style.tile + ' hover:-translate-y-0.5 hover:rt-shadow'
    }`;

    if (to) {
        return (
            <Link to={to} className={cls}>
                {inner}
            </Link>
        );
    }
    return (
        <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
            {inner}
        </button>
    );
};

// Grille complète regroupée par section logique
const CategoryGrid = ({ categories, counts, onSelect, selected, linkBase, size = 'md' }) => {
    const groups = groupCategories(categories);

    return (
        <div className="space-y-6 sm:space-y-8">
            {groups.map((g) => {
                const style = groupStyle(g.key);
                const groupTotal = g.items.reduce((s, c) => s + (counts?.[c.id]?.total || 0), 0);
                return (
                    <div key={g.key}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`grid h-7 w-7 place-items-center rounded-lg ${style.soft} text-base`}>{g.emoji}</span>
                            <h3 className="text-sm sm:text-base font-extrabold tracking-tight">{g.label}</h3>
                            <span className="text-xs font-semibold text-muted-foreground">{groupTotal} objet{groupTotal !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                            {g.items.map((c) => (
                                <CategoryTile
                                    key={c.id}
                                    category={c}
                                    count={counts?.[c.id]}
                                    active={selected === c.id}
                                    onClick={onSelect ? () => onSelect(c) : undefined}
                                    to={linkBase ? `${linkBase}${c.id}` : undefined}
                                    size={size}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default CategoryGrid;
