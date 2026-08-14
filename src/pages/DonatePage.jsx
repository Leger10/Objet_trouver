import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Heart,
  Loader2,
  Lock,
  MessageSquare,
  Phone,
  Smartphone,
  User,
} from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/format";

const PHONE_REGEX = /^(\+?\d[\d\s.-]{6,}\d)$/;

const validatePhone = (value) => {
  if (!value) return true; // optionnel
  return PHONE_REGEX.test(value.trim());
};

const PRESETS = [1000, 5000, 10000, 20000, 50000];

const METHODS = [
  {
    key: "orange_money",
    label: "Orange Money",
    hint: "Paiement USSD instantané",
    color: "from-[hsl(22_90%_50%)] to-[hsl(14_88%_46%)]",
    ring: "border-[hsl(22_90%_50%)]",
    chip: "bg-[hsl(22_90%_50%)]",
    text: "text-[hsl(22_90%_42%)]",
    soft: "bg-[hsl(22_90%_50%/0.10)]",
    type: "ussd",
  },
  {
    key: "move_money",
    label: "Move Money",
    hint: "Transfert par numéro",
    color: "from-[hsl(262_70%_52%)] to-[hsl(272_66%_46%)]",
    ring: "border-[hsl(262_70%_52%)]",
    chip: "bg-[hsl(262_70%_52%)]",
    text: "text-[hsl(262_70%_44%)]",
    soft: "bg-[hsl(262_70%_52%/0.10)]",
    type: "phone",
  },
  {
    key: "wave",
    label: "Wave",
    hint: "Transfert gratuit par numéro",
    color: "from-[hsl(199_90%_45%)] to-[hsl(205_85%_42%)]",
    ring: "border-[hsl(199_90%_45%)]",
    chip: "bg-[hsl(199_90%_45%)]",
    text: "text-[hsl(199_90%_38%)]",
    soft: "bg-[hsl(199_90%_45%/0.10)]",
    type: "phone",
  },
];

const ORANGE_NUMBER = "46598281";
const MOVE_NUMBER = "00226 73 79 09 78";
const WAVE_NUMBER = "00226 54 32 92 99";

const field =
  "w-full rounded-xl border border-input bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copié !`);
  } catch (_) {
    toast.error("Copie impossible, saisissez-le manuellement.");
  }
};

const DonatePage = () => {
  const { user } = useAuth();
  const [totals, setTotals] = useState({ total_fcfa: 0, donors: 0 });
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState("orange_money");
  const [form, setForm] = useState({
    donor_name: user?.name || "",
    donor_phone: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    pb.collection("donation_totals")
      .getFirstListItem("label = 'global'")
      .then((r) =>
        setTotals({ total_fcfa: r.total_fcfa || 0, donors: r.donors || 0 }),
      )
      .catch(() => setTotals({ total_fcfa: 0, donors: 0 }));
  }, []);

  const finalAmount = custom ? parseInt(custom, 10) || 0 : amount;
  const activeMethod = METHODS.find((m) => m.key === method);
  const ussdCode = `*144*10*${ORANGE_NUMBER}*${finalAmount || 0}#`;

  const submit = async (e) => {
    e.preventDefault();
    if (finalAmount < 100) {
      toast.error("Le don minimum est de 100 FCFA.");
      return;
    }
    if (!form.donor_name.trim()) {
      toast.error("Merci d'indiquer votre nom.");
      return;
    }
    if (form.donor_phone && !validatePhone(form.donor_phone)) {
      toast.error(
        "Numéro de dépôt invalide. Format attendu : 00226 XX XX XX XX.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const rec = await pb.collection("donations").create({
        donor_name: form.donor_name.trim(),
        donor_phone: form.donor_phone.trim(),
        amount_fcfa: finalAmount,
        payment_method: method,
        message: form.message.trim(),
        status: "completed",
        user: user?.id || null,
      });
      setDone({
        amount: finalAmount,
        name: form.donor_name.trim(),
        phone: form.donor_phone.trim(),
        message: form.message.trim(),
        id: rec.id,
        method,
      });
      setTotals((t) => ({
        total_fcfa: t.total_fcfa + finalAmount,
        donors: t.donors + 1,
      }));
      toast.success("Merci ! Votre don a bien été enregistré.");
    } catch (err) {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const m = METHODS.find((x) => x.key === done.method);
    return (
      <Layout>
        <Helmet>
          <title>Merci pour votre don — RetrouveMoi</title>
          <meta
            name="description"
            content="Confirmation de don à RetrouveMoi."
          />
        </Helmet>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent/15"
          >
            <CheckCircle2 className="h-10 w-10 text-accent" />
          </motion.div>
          <h1 className="mt-6 text-2xl font-extrabold">Merci {done.name} !</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre don de{" "}
            <span className="font-bold text-foreground">
              {formatNumber(done.amount)} FCFA
            </span>{" "}
            via <span className="font-bold text-foreground">{m?.label}</span> a
            bien été enregistré. Chaque contribution nous aide à retrouver plus
            d'objets.
          </p>

          {/* Récapitulatif du don */}
          <div className="mt-6 space-y-2 rounded-2xl border border-border bg-card p-5 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Montant
              </span>
              <span className="font-extrabold text-primary">
                {formatNumber(done.amount)} FCFA
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Donateur
              </span>
              <span className="truncate font-bold">{done.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Méthode
              </span>
              <span className="font-bold">{m?.label}</span>
            </div>
            {done.phone ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  N° de dépôt
                </span>
                <span className="font-bold">{done.phone}</span>
              </div>
            ) : null}
            {done.message ? (
              <div className="border-t border-border pt-3">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Votre message
                </span>
                <p className="mt-1 text-sm text-foreground">
                  « {done.message} »
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Total collecté
            </p>
            <p className="mt-1 text-2xl font-extrabold text-primary">
              {formatNumber(totals.total_fcfa)} FCFA
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatNumber(totals.donors)} donateurs
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/"
              className="rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground"
            >
              Retour à l'accueil
            </Link>
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setCustom("");
                setForm((f) => ({ ...f, message: "" }));
              }}
              className="rounded-xl border border-border px-4 py-3.5 font-bold"
            >
              Faire un autre don
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Helmet>
        <title>Soutenir RetrouveMoi — Faire un don</title>
        <meta
          name="description"
          content="Soutenez RetrouveMoi par Orange Money ou Move Money. Chaque don améliore la plateforme et augmente les restitutions."
        />
      </Helmet>

      <div className="mx-auto w-full max-w-[44rem] px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>

        {/* Header */}
        <div className="mt-4 rounded-3xl bg-gradient-to-br from-[hsl(258_84%_58%)] to-[hsl(280_75%_52%)] p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/85">
            <Heart className="h-4 w-4" /> Soutenez l'initiative
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
            Soutenez RetrouveMoi
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Une plateforme pour retrouver les objets perdus. Chaque don nous
            aide à améliorer la plateforme et à retrouver plus d'objets.
          </p>
          <div className="mt-5 flex gap-6">
            <div>
              <p className="text-xl font-extrabold">
                {formatNumber(totals.total_fcfa)} FCFA
              </p>
              <p className="text-xs text-white/80">total collecté</p>
            </div>
            <div>
              <p className="text-xl font-extrabold">
                {formatNumber(totals.donors)}
              </p>
              <p className="text-xs text-white/80">donateurs</p>
            </div>
          </div>
        </div>

        {/* Impact */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ["1 000 FCFA", "Couvre l'hébergement d'une journée"],
            ["5 000 FCFA", "Finance une campagne d'alertes"],
            ["20 000 FCFA", "Soutient un partenariat local"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="font-extrabold text-primary">{k}</p>
              <p className="mt-1 text-xs text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          {/* Montants prédéfinis */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">1. Choisissez un montant</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {PRESETS.map((p) => {
                const active = !custom && amount === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p);
                      setCustom("");
                    }}
                    className={`rounded-xl border-2 px-3 py-4 text-center font-extrabold transition-all active:scale-[0.97] ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {formatNumber(p)}
                    <span className="block text-[10px] font-bold text-muted-foreground">
                      FCFA
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <label className="text-xs font-bold text-muted-foreground">
                Montant personnalisé (FCFA)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Autre montant"
                className={`mt-1.5 ${field}`}
              />
            </div>
            <p className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm font-bold text-secondary-foreground">
              Votre don : {formatNumber(finalAmount || 0)} FCFA
            </p>
          </section>

          {/* Méthode de paiement */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">
              2. Choisissez la méthode de paiement
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all active:scale-[0.97] ${
                      active
                        ? `${m.ring} ${m.soft}`
                        : "border-border bg-background"
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${m.color} text-white shadow-sm`}
                    >
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">
                        {m.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {m.hint}
                      </span>
                    </span>
                    {active && <Check className={`h-5 w-5 ${m.text}`} />}
                  </button>
                );
              })}
            </div>

            {/* Instructions de paiement dynamiques */}
            <div
              className={`mt-4 rounded-2xl border-2 ${activeMethod.ring} ${activeMethod.soft} p-4`}
            >
              {activeMethod.type === "ussd" ? (
                <div>
                  <p className={`text-sm font-extrabold ${activeMethod.text}`}>
                    Orange Money — Code USSD
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Composez le code ci-dessous sur votre téléphone. Le montant{" "}
                    <span className="font-bold text-foreground">
                      {formatNumber(finalAmount || 0)} FCFA
                    </span>{" "}
                    est déjà inclus.
                  </p>
                  <div className="mt-3 flex items-stretch gap-2">
                    <code className="flex-1 truncate rounded-xl bg-background px-3 py-3 text-sm font-bold tracking-wide shadow-inner">
                      {ussdCode}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(ussdCode, "Le code USSD")}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl ${activeMethod.chip} px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95`}
                    >
                      <Copy className="h-4 w-4" /> Copier
                    </button>
                  </div>
                  <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <li>1. Copiez le code USSD ci-dessus.</li>
                    <li>
                      2. Collez-le dans votre clavier téléphonique et appelez.
                    </li>
                    <li>3. Validez avec votre code secret Orange Money.</li>
                    <li>4. Revenez ici et confirmez votre don.</li>
                  </ol>
                </div>
              ) : (
                <div>
                  <p className={`text-sm font-extrabold ${activeMethod.text}`}>
                    {activeMethod.label} — Numéro de transfert
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Envoyez{" "}
                    <span className="font-bold text-foreground">
                      {formatNumber(finalAmount || 0)} FCFA
                    </span>{" "}
                    vers le numéro {activeMethod.label} ci-dessous.
                  </p>
                  <div className="mt-3 flex items-stretch gap-2">
                    <code className="flex-1 truncate rounded-xl bg-background px-3 py-3 text-sm font-bold tracking-wide shadow-inner">
                      {activeMethod.key === "wave" ? WAVE_NUMBER : MOVE_NUMBER}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          activeMethod.key === "wave"
                            ? WAVE_NUMBER
                            : MOVE_NUMBER,
                          "Le numéro",
                        )
                      }
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl ${activeMethod.chip} px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95`}
                    >
                      <Copy className="h-4 w-4" /> Copier
                    </button>
                    <a
                      href={`tel:${(activeMethod.key === "wave" ? WAVE_NUMBER : MOVE_NUMBER).replace(/\s/g, "")}`}
                      className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 ${activeMethod.ring} px-4 py-3 text-sm font-bold transition-transform active:scale-95`}
                    >
                      <Phone className="h-4 w-4" /> Appeler
                    </a>
                  </div>
                  {activeMethod.key === "wave" ? (
                    <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <li>1. Ouvrez l'application Wave sur votre téléphone.</li>
                      <li>
                        2. Choisissez « Envoyer » et collez le numéro ci-dessus.
                      </li>
                      <li>3. Saisissez le montant de votre don et validez.</li>
                      <li>4. Revenez ici et confirmez votre don.</li>
                    </ol>
                  ) : (
                    <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <li>1. Copiez le numéro ou appuyez sur « Appeler ».</li>
                      <li>
                        2. Suivez les instructions vocales pour transférer le
                        montant.
                      </li>
                      <li>
                        3. Conservez la référence de transaction reçue par SMS.
                      </li>
                      <li>4. Revenez ici et confirmez votre don.</li>
                    </ol>
                  )}
                </div>
              )}
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Vos données sont sécurisées —
              aucun numéro de carte n'est stocké.
            </p>
          </section>

          {/* Informations donateur */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm font-bold">3. Vos informations</p>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Nom complet *
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={form.donor_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, donor_name: e.target.value }))
                    }
                    placeholder="Votre nom"
                    className={`${field} pl-10`}
                    required
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Numéro ayant effectué le dépôt (optionnel)
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.donor_phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, donor_phone: e.target.value }))
                    }
                    placeholder="Ex: 00226 XX XX XX XX"
                    className={`${field} pl-10`}
                  />
                </div>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Sert à identifier votre don et à confirmer le dépôt.
                </span>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-bold">
                Message (optionnel)
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <textarea
                    value={form.message}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, message: e.target.value }))
                    }
                    placeholder="Un mot d'encouragement"
                    rows={3}
                    className={`${field} pl-10 resize-none`}
                  />
                </div>
              </label>
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting || finalAmount < 100}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[hsl(258_84%_58%)] to-[hsl(280_75%_52%)] px-4 py-4 text-base font-extrabold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Heart className="h-5 w-5" />
            )}
            {submitting
              ? "Traitement…"
              : `Confirmer mon don de ${formatNumber(finalAmount || 0)} FCFA`}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default DonatePage;
