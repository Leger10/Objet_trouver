import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Flag, Lock, MapPin, ShieldCheck } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import { useAuth } from "@/contexts/AuthContext";
import { maskId, notify } from "@/lib/retrouve";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const DeclarationPage = () => {
  const { id } = useParams();
  const { user, isAuthed } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState({ answer: "", proof_note: "" });
  const [sent, setSent] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    pb.collection("declarations")
      .getOne(id, { expand: "category", requestKey: `decl-${id}` })
      .then(setItem)
      .catch(() => setError("Déclaration introuvable ou retirée."))
      .finally(() => setLoading(false));
  }, [id]);

  const submitClaim = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await pb.collection("claims").create({
        declaration: item.id,
        claimant: user.id,
        answer: claim.answer,
        proof_note: claim.proof_note,
        status: "pending",
      });
      await notify(
        item.owner,
        "Nouvelle demande de restitution",
        `Une personne répond à votre déclaration « ${item.title} ». Vérifiez sa réponse dans votre espace.`,
      );
      setSent(true);
    } catch (err) {
      setError(err?.message || "La demande n'a pas pu être envoyée.");
    }
  };

  const report = async () => {
    try {
      await pb.collection("reports").create({
        reporter: user.id,
        declaration: item.id,
        reason: "Signalement utilisateur : contenu suspect ou frauduleux.",
        status: "open",
      });
      setReported(true);
    } catch (_) {
      setReported(true);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Helmet>
          <title>Déclaration — RETROUVÉ</title>
          <meta
            name="description"
            content="Détail d'une déclaration d'objet perdu ou retrouvé sur RETROUVÉ."
          />
        </Helmet>
        <div className="mx-auto w-full max-w-[72rem] px-4 py-14">
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Layout>
    );
  }

  if (!item) {
    return (
      <Layout>
        <Helmet>
          <title>Déclaration introuvable — RETROUVÉ</title>
          <meta
            name="description"
            content="Cette déclaration n'existe plus sur RETROUVÉ."
          />
        </Helmet>
        <div className="mx-auto w-full max-w-[56rem] px-4 py-20 text-center">
          <p className="text-lg font-bold">
            {error || "Déclaration introuvable."}
          </p>
          <Link
            to="/rechercher"
            className="mt-4 inline-block font-bold text-primary underline underline-offset-4"
          >
            Retour à la recherche
          </Link>
        </div>
      </Layout>
    );
  }

  const photo = item.photo ? pb.files.getURL(item, item.photo) : null;
  const isOwner = user?.id === item.owner;

  return (
    <Layout>
      <Helmet>
        <title>{`${item.title} — RetrouveMoi`}</title>
        <meta
          name="description"
          content={`Déclaration ${item.kind === "lost" ? "de perte" : "de découverte"} à ${item.city} sur RetrouveMoi. Contact après vérification de sécurité.`}
        />
      </Helmet>

      <div className="mx-auto grid w-full max-w-[72rem] gap-6 sm:gap-8 px-4 sm:px-6 py-8 sm:py-10 lg:grid-cols-[2fr_1fr]">
        <article>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              item.kind === "lost"
                ? "bg-destructive/10 text-destructive"
                : "bg-accent/15 text-accent"
            }`}
          >
            {item.kind === "lost" ? "Objet égaré" : "Objet retrouvé"}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">
            {item.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {item.city}
              {item.zone ? ` · ${item.zone}` : ""}
            </span>
            {item.event_date && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />{" "}
                {new Date(item.event_date).toLocaleDateString("fr-FR")}
              </span>
            )}
            <span>{item.expand?.category?.name}</span>
          </p>

          {photo && (
            <img
              src={photo}
              alt={item.title}
              className="mt-6 max-h-96 w-full rounded-2xl object-cover"
            />
          )}

          <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {[
              ["Nom sur le document", item.person_name || "Non communiqué"],
              ["Marque", item.brand || "—"],
              ["Couleur", item.color || "—"],
              ["Identifiant", maskId(item.doc_last4)],
            ].map(([k, v]) => (
              <div key={k} className="bg-card p-4">
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {item.description && (
            <p className="mt-6 whitespace-pre-line leading-relaxed">
              {item.description}
            </p>
          )}

          <p className="mt-6 flex items-start gap-2 rounded-2xl bg-secondary/50 p-4 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Les coordonnées du déclarant ne sont jamais publiques. La mise en
            relation se fait uniquement après validation de la question de
            vérification.
          </p>
        </article>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" /> Procédure de
              vérification
            </p>
            {isOwner ? (
              <p className="mt-3 text-sm text-muted-foreground">
                C'est votre déclaration. Les demandes de restitution arrivent
                dans votre{" "}
                <Link to="/tableau-de-bord" className="font-bold text-primary">
                  tableau de bord
                </Link>
                .
              </p>
            ) : !isAuthed ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <Link to="/connexion" className="font-bold text-primary">
                  Connectez-vous
                </Link>{" "}
                pour répondre à la question de sécurité et demander la
                restitution.
              </p>
            ) : sent ? (
              <p className="mt-3 text-sm font-semibold text-accent">
                Demande envoyée. Le déclarant va vérifier votre réponse, vous
                serez notifié.
              </p>
            ) : (
              <form onSubmit={submitClaim} className="mt-3 space-y-3">
                <p className="text-sm font-semibold">
                  {item.security_question ||
                    "Décrivez un détail que seul le propriétaire peut connaître."}
                </p>
                <input
                  className={field}
                  placeholder="Votre réponse"
                  value={claim.answer}
                  onChange={(e) =>
                    setClaim((c) => ({ ...c, answer: e.target.value }))
                  }
                  required
                />
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Précisions (lieu de récupération possible, preuve…)"
                  value={claim.proof_note}
                  onChange={(e) =>
                    setClaim((c) => ({ ...c, proof_note: e.target.value }))
                  }
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
                >
                  Demander la restitution
                </button>
                {error && (
                  <p className="text-sm font-semibold text-destructive">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>

          {isAuthed && !isOwner && (
            <button
              type="button"
              onClick={report}
              disabled={reported}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-bold disabled:opacity-60"
            >
              <Flag className="h-4 w-4" />{" "}
              {reported ? "Signalement transmis" : "Signaler cette déclaration"}
            </button>
          )}

          <AdSlot
            label="Publicité"
            title="Assurez vos documents dès aujourd'hui"
            cta="Découvrir l'offre partenaire"
          />
        </aside>
      </div>
    </Layout>
  );
};

export default DeclarationPage;
