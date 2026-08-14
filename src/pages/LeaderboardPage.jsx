import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Trophy } from "lucide-react";
import { pb } from "@/lib/supabaseClient";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import { REWARDS } from "@/lib/retrouve";

const LeaderboardPage = () => {
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pb.collection("users")
      .getList(1, 10, {
        sort: "-points",
        filter: "points > 0",
        requestKey: "top10",
      })
      .then((r) => setTop(r.items))
      .catch(() => setTop([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <Helmet>
        <title>Top 10 des citoyens qui restituent — RetrouveMoi</title>
        <meta
          name="description"
          content="Classement des membres RetrouveMoi les plus actifs : déclarations d'objets retrouvés, correspondances confirmées et restitutions."
        />
      </Helmet>

      <div className="mx-auto grid w-full max-w-[72rem] gap-6 sm:gap-8 px-4 sm:px-6 py-8 sm:py-12 lg:grid-cols-[2fr_1fr]">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            <Trophy className="h-8 w-8 text-primary" /> Top 10 des héros du
            quartier
          </h1>
          <p className="mt-3 text-muted-foreground">
            Chaque objet retrouvé, chaque restitution et chaque parrainage font
            grimper votre portefeuille de points.
          </p>

          <ol className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {loading &&
              [0, 1, 2].map((k) => (
                <li key={k} className="h-16 animate-pulse bg-muted/50" />
              ))}
            {!loading && top.length === 0 && (
              <li className="p-8 text-center text-muted-foreground">
                Le classement est vide. Les premiers points seront attribués dès
                la première déclaration d'objet retrouvé.
              </li>
            )}
            {top.map((u, i) => (
              <li key={u.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl font-extrabold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">
                  {u.name || "Membre RETROUVÉ"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {u.city || "—"}
                </span>
                <span className="font-mono font-extrabold text-primary">
                  {u.points} pts
                </span>
              </li>
            ))}
          </ol>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-bold">Comment gagner des points</p>
            <ul className="mt-3 space-y-2 text-sm">
              {REWARDS.map((r) => (
                <li key={r.label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono font-bold text-primary">
                    {r.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <AdSlot
            label="Publicité"
            title="Récompensez vos clients : devenez partenaire des points RETROUVÉ"
          />
        </aside>
      </div>
    </Layout>
  );
};

export default LeaderboardPage;
