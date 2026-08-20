import React from "react";
import { MapPin, UserCircle, FileText, ArrowDownToLine } from "lucide-react";

const EtiquetteDecl = ({ pv, compact = false }) => {
  if (!pv) return null;

  const adminName = pv.data?.adminName || pv.admin_name || null;
  const location = pv.location || pv.data?.location || null;
  const pvNumber = pv.pv_number || null;

  if (!adminName && !location) return null;

  if (compact) {
    return (
      <div className="mt-2 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 px-3 py-2.5 dark:border-blue-900/30 dark:from-blue-950/30 dark:to-sky-950/30">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          <ArrowDownToLine className="h-3 w-3" />
          Où récupérer votre objet
        </div>
        <div className="mt-1.5 space-y-0.5">
          {adminName && (
            <p className="flex items-center gap-1.5 text-xs text-foreground">
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="font-semibold">Déposé chez :</span> {adminName}
            </p>
          )}
          {location && (
            <p className="flex items-center gap-1.5 text-xs text-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500 dark:text-blue-400" />
              <span className="font-semibold">Adresse :</span> {location}
            </p>
          )}
          {pvNumber && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              PV n° {pvNumber}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 shadow-sm dark:border-blue-900/30 dark:from-blue-950/30 dark:via-sky-950/30 dark:to-cyan-950/30">
      <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-500/5 px-4 py-2.5 dark:border-blue-900/30 dark:bg-blue-400/5">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 dark:bg-blue-400/15">
          <ArrowDownToLine className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Informations de retrait
        </p>
      </div>
      <div className="space-y-2 px-4 py-3">
        {adminName && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/10">
              <UserCircle className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Administrateur</p>
              <p className="text-sm font-bold text-foreground">{adminName}</p>
            </div>
          </div>
        )}
        {location && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/10">
              <MapPin className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Lieu de dépôt</p>
              <p className="text-sm font-bold text-foreground">{location}</p>
            </div>
          </div>
        )}
        {pvNumber && (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500/10">
              <FileText className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Procès-verbal</p>
              <p className="text-sm font-bold font-mono text-foreground">{pvNumber}</p>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-blue-100 bg-blue-500/5 px-4 py-2 dark:border-blue-900/30 dark:bg-blue-400/5">
        <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          Présentez-vous sur place avec une pièce d'identité pour récupérer votre objet.
        </p>
      </div>
    </div>
  );
};

export default EtiquetteDecl;
