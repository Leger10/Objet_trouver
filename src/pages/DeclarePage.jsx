import React, { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertCircle, Loader2, Lock, Star } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { runMatching } from "@/lib/retrouve";
import CategoryGrid from "@/components/CategoryGrid";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";
const labelCls = "flex flex-col gap-2 text-sm font-bold";

const DeclarePage = () => {
  const { kind: kindParam } = useParams();
  const kind = kindParam === "retrouve" ? "found" : "lost";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    person_name: "",
    brand: "",
    color: "",
    city: "",
    zone: "",
    event_date: "",
    description: "",
    doc_number: "",
    security_question: "",
    security_answer: "",
    priority: false,
  });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    pb.collection("categories")
      .getFullList({ sort: "position", requestKey: "cats" })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const selectedCat = useMemo(
    () => categories.find((c) => c.id === form.category),
    [categories, form.category],
  );
  const set = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title || !form.category || !form.city) {
      setError("Titre, catégorie et ville sont obligatoires.");

      return;
    }
    setSaving(true);
    try {
      const digits = form.doc_number.replace(/\D/g, "");
      const data = new FormData();
      data.append("kind", kind);
      data.append("category", form.category);
      data.append("title", form.title);
      data.append("person_name", form.person_name);
      data.append("brand", form.brand);
      data.append("color", form.color);
      data.append("city", form.city);
      data.append("zone", form.zone);
      if (form.event_date) data.append("event_date", form.event_date);
      data.append("description", form.description);
      if (digits) data.append("doc_last4", digits.slice(-4));
      data.append("security_question", form.security_question);
      data.append("security_answer", form.security_answer);
      data.append("status", "open");
      data.append("priority", form.priority ? "true" : "false");
      data.append("owner", user.id);
      if (photo) data.append("photo", photo);

      const rec = await pb.collection("declarations").create(data);
      const matches = await runMatching({ ...rec, category: form.category });
      toast.success(
        kind === "lost" ? "Perte enregistrée" : "Objet retrouvé enregistré",
        {
          description: kind === "found" ? "+10 points crédités" : undefined,
        },
      );
      setResult({ rec, matches });
    } catch (err) {
      setError(err?.message || "La déclaration n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Layout>
        <Helmet>
          <title>Déclaration enregistrée — RetrouveMoi</title>
          <meta
            name="description"
            content="Votre déclaration est enregistrée et comparée automatiquement à toute la base RETROUVÉ."
          />
        </Helmet>
        <div className="mx-auto w-full max-w-[56rem] px-4 py-14">
          <h1 className="text-3xl font-extrabold">Déclaration enregistrée</h1>
          <p className="mt-3 text-muted-foreground">
            Elle est désormais comparée en continu à toute la base centralisée.
          </p>
          <div className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="font-bold">
              {result.matches.length === 0
                ? "Aucune correspondance pour le moment"
                : `${result.matches.length} correspondance(s) potentielle(s)`}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.matches.length === 0
                ? "Vous serez notifié automatiquement dès qu'une déclaration inverse ressemblera à la vôtre."
                : "Consultez chaque piste, puis lancez la procédure de vérification avant tout contact."}
            </p>
            <ul className="mt-4 space-y-2">
              {result.matches.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {m.other?.title}
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {m.score}%
                  </span>
                  <Link
                    to={`/objet/${m.other?.id}`}
                    className="text-sm font-bold text-primary underline underline-offset-4"
                  >
                    Voir
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/tableau-de-bord"
                className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"
              >
                Mon tableau de bord
              </Link>
              <Link
                to={`/objet/${result.rec.id}`}
                className="rounded-xl border border-border px-5 py-3 font-bold"
              >
                Voir ma déclaration
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>
          {kind === "lost" ? "J'ai égaré un objet" : "J'ai retrouvé un objet"} —
          RetrouveMoi
        </title>
        <meta
          name="description"
          content="Déclarez en une minute un objet ou un document égaré ou retrouvé. Les numéros sensibles sont stockés masqués."
        />
      </Helmet>
      <div className="mx-auto w-full max-w-[56rem] px-4 sm:px-6 py-8 sm:py-14">
        <div className="flex gap-2 rounded-xl bg-muted p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => navigate("/declarer/perdu")}
            className={`flex-1 rounded-lg px-4 py-2.5 ${kind === "lost" ? "bg-background rt-shadow" : ""}`}
          >
            J'AI ÉGARÉ
          </button>
          <button
            type="button"
            onClick={() => navigate("/declarer/retrouve")}
            className={`flex-1 rounded-lg px-4 py-2.5 ${kind === "found" ? "bg-background rt-shadow" : ""}`}
          >
            J'AI RETROUVÉ
          </button>
        </div>

        <h1 className="mt-6 sm:mt-8 text-2xl sm:text-3xl font-extrabold">
          {kind === "lost"
            ? "Déclarer un objet égaré"
            : "Déclarer un objet retrouvé"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {kind === "lost"
            ? "Plus votre description est précise, plus le score de correspondance sera élevé."
            : "Merci. Votre déclaration vous rapporte 10 points et peut sauver la journée de quelqu'un."}
        </p>

        <form onSubmit={submit} className="mt-8 grid gap-5">
          <label className={labelCls}>
            Titre de la déclaration *
            <input
              className={field}
              value={form.title}
              onChange={set("title")}
              placeholder="Ex : CNI au nom de Aïcha Diallo"
            />
          </label>

          <div className={labelCls}>
            Catégorie *
            {categories.length === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
                  <div
                    key={k}
                    className="h-24 animate-pulse rounded-2xl bg-muted"
                  />
                ))}
              </div>
            )}
            {categories.length > 0 && (
              <CategoryGrid
                categories={categories}
                selected={form.category || null}
                onSelect={(c) => setForm((f) => ({ ...f, category: c.id }))}
              />
            )}
            {form.category && (
              <p className="text-xs text-muted-foreground">
                Catégorie sélectionnée. Cliquez sur une autre tuile pour
                changer.
              </p>
            )}
          </div>

          <label className={labelCls}>
            Nom figurant sur l'objet / le document
            <input
              className={field}
              value={form.person_name}
              onChange={set("person_name")}
              placeholder="Prénom et nom"
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelCls}>
              Ville *
              <input
                className={field}
                value={form.city}
                onChange={set("city")}
                placeholder="Ex : Abidjan"
              />
            </label>
            <label className={labelCls}>
              Zone / quartier
              <input
                className={field}
                value={form.zone}
                onChange={set("zone")}
                placeholder="Ex : Yopougon"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <label className={labelCls}>
              Date {kind === "lost" ? "de la perte" : "de la découverte"}
              <input
                type="date"
                className={field}
                value={form.event_date}
                onChange={set("event_date")}
              />
            </label>
            <label className={labelCls}>
              Marque
              <input
                className={field}
                value={form.brand}
                onChange={set("brand")}
                placeholder="Ex : Tecno"
              />
            </label>
            <label className={labelCls}>
              Couleur
              <input
                className={field}
                value={form.color}
                onChange={set("color")}
                placeholder="Ex : noir"
              />
            </label>
          </div>

          <label className={labelCls}>
            Description et caractéristiques
            <textarea
              rows={4}
              className={field}
              value={form.description}
              onChange={set("description")}
              placeholder="Signes distinctifs, contenu, circonstances…"
            />
          </label>

          <div className="rounded-2xl border border-border bg-secondary/40 p-5">
            <p className="flex items-center gap-2 font-bold">
              <Lock className="h-4 w-4 text-primary" /> Données sensibles
              protégées
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seuls les 4 derniers chiffres sont conservés et affichés ainsi :
              ********4821. Le numéro complet n'est jamais enregistré.
            </p>
            <label className={`${labelCls} mt-4`}>
              Numéro du document{" "}
              {selectedCat?.sensitive ? "(recommandé)" : "(optionnel)"}
              <input
                className={field}
                value={form.doc_number}
                onChange={set("doc_number")}
                inputMode="numeric"
                placeholder="Ex : C0198234821"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={labelCls}>
              Question de vérification
              <input
                className={field}
                value={form.security_question}
                onChange={set("security_question")}
                placeholder="Ex : Que contenait la pochette ?"
              />
            </label>
            <label className={labelCls}>
              Réponse attendue (jamais publique)
              <input
                className={field}
                value={form.security_answer}
                onChange={set("security_answer")}
              />
            </label>
          </div>

          <label className={labelCls}>
            Photo (optionnelle)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className={field}
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <input
              type="checkbox"
              checked={form.priority}
              onChange={set("priority")}
              className="mt-1 h-5 w-5"
            />
            <span>
              <span className="flex items-center gap-2 font-bold">
                <Star className="h-4 w-4 text-primary" /> Déclaration
                prioritaire — 500 FCFA
              </span>
              <span className="text-muted-foreground">
                Mise en avant en tête des recherches pendant 30 jours. Paiement
                mobile money à la confirmation.
              </span>
            </span>
          </label>

          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-base font-extrabold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60 min-h-[56px]"
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saving ? "Analyse des correspondances…" : "Publier ma déclaration"}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default DeclarePage;
