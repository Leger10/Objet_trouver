// Service de notifications : in-app + push (OneSignal)
import { pb, supabase } from "./supabaseClient";
import env from "./env";

// ─── HELPER: Get deposit PV info for a declaration ───

export const getDepositPVInfo = async (declarationId) => {
  if (!declarationId) return null;
  try {
    const { data: pv } = await supabase
      .from("pvs")
      .select("*")
      .eq("declaration_id", declarationId)
      .eq("type", "deposit")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!pv) return null;
    const adminName = pv.data?.adminName || "";
    const location = pv.location || "";
    const pvNumber = pv.pv_number || "";
    return { adminName, location, pvNumber, pv };
  } catch (_) {
    return null;
  }
};

// ─── IN-APP NOTIFICATIONS ───

export const createNotification = async (userId, title, body, link = "/tableau-de-bord") => {
  try {
    await pb.collection("notifications").create({
      "user": userId,
      title,
      body,
      link,
      read: false,
    });
  } catch (_) {
    /* best-effort */
  }
};

// ─── PUSH via Netlify function ───

const SITE_URL = (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SITE_URL) || env?.NEXT_PUBLIC_SITE_URL || env?.VITE_SITE_URL || "http://localhost:3000";

export const sendPush = async (userId, title, body, link) => {
  try {
    const absoluteUrl = link?.startsWith("http") ? link : `${SITE_URL}${link || ""}`;
    await fetch("/api/notify-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, body, url: absoluteUrl }),
    });
  } catch (_) {}
};

// Alias pour compatibilité — push only
export const sendPushAndEmail = sendPush;

// Email no-op (supprimé — pas de domaine vérifié)
export const queueEmail = async () => {};

// Notifier tous les users sauf l'expéditeur
export const notifyAllUsers = async (senderId, title, body, link) => {
  try {
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .neq("id", senderId);

    if (!users?.length) return;
    await Promise.all(
      users.map((u) => createNotification(u.id, title, body, link))
    );
  } catch (_) {
    /* best-effort */
  }
};

// ─── PUSH NOTIFICATIONS (OneSignal) ───

let onesignalReady = false;

export const initOneSignal = async () => {
  const appId = env.VITE_ONESIGNAL_APP_ID;
  if (!appId || onesignalReady) return;

  try {
    // Charger le script OneSignal
    await new Promise((resolve, reject) => {
      if (window.OneSignal) { resolve(); return; }
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    await window.OneSignal.init({
      appId,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    });

    // Demander la permission
    await window.OneSignal.Slidedown.promptPush();

    // Enregistrer l'user ID Supabase dans OneSignal
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await window.OneSignal.addExternalUserId(session.user.id);
    }

    onesignalReady = true;
  } catch (e) {
    console.warn("OneSignal init failed:", e);
  }
};


// ─── ADMIN PROXIMITY LOOKUP ───

export const findNearestAdmin = async (city = "", quarter = "") => {
  try {
    // Use SQL function via RPC — bypasses RLS (SECURITY DEFINER)
    const { data, error } = await supabase.rpc("find_nearest_admin", {
      p_city: (city || "").trim(),
      p_quarter: (quarter || "").trim(),
    });
    if (error || !data?.length) return null;
    const row = data[0];
    return {
      id: row.admin_id,
      name: row.admin_name,
      city: row.admin_city,
      quarter: row.admin_quarter,
      email: row.admin_email,
      phone: row.admin_phone,
      matchLevel: row.match_level,
    };
  } catch (_) {
    return null;
  }
};

// ─── WORKFLOW : DÉCLARATION CRÉÉE ───

export const onDeclarationCreated = async (declaration, user) => {
  const kindLabel = declaration.kind === "lost" ? "perdu" : "retrouvé";
  const title = `Nouvel objet ${kindLabel}`;
  const body = `Un objet "${declaration.title}" a été déclaré ${kindLabel} à ${declaration.city || "votre ville"}.`;
  const link = `/objet/${declaration.id}`;

  // 1. Notification in-app à tous les autres users
  await notifyAllUsers(user.id, title, body, link);
};

// ─── WORKFLOW : CORRESPONDANCE TROUVÉE ───

export const onMatchFound = async (match, lostDecl, foundDecl) => {
  const score = match.score;

  // 1. Trouver l'admin le plus proche du PERDANT (c'est chez lui que l'objet sera déposé)
  const nearestAdmin = await findNearestAdmin(
    lostDecl.city || "",
    lostDecl.zone || ""
  );

  // Label admin pour les notifications
  const adminName = nearestAdmin?.name || "";
  const adminCity = nearestAdmin?.city || "";
  const adminQuarter = nearestAdmin?.quarter || "";
  const adminLocation = [adminCity, adminQuarter].filter(Boolean).join(" · ");
  const adminSentence = adminName
    ? `Admin ${adminName}${adminLocation ? ` (${adminLocation})` : ""}`
    : "l'admin le plus proche";

  // ─── 1. PUSH AU DÉCLARANT RETROUVÉ (celui qui a trouvé l'objet) ───
  // → "Déposez l'objet chez [Admin] (quartier) — le plus proche du propriétaire"
  await createNotification(
    foundDecl.owner,
    `Correspondance trouvée (${score}%)`,
    `Un objet "${foundDecl.title}" que vous avez trouvé correspond à une déclaration de perte.\n\nDéposez l'objet chez ${adminName || "l'admin le plus proche"}${adminLocation ? ` (${adminLocation})` : ""} pour que le propriétaire puisse le récupérer. Une pièce d'identité sera demandée.`,
    `/objet/${foundDecl.id}`
  );
  sendPush(
    foundDecl.owner,
    `Déposez "${foundDecl.title}" chez ${adminName || "l'admin"}`,
    `Correspondance ${score}%. Déposez l'objet chez ${adminSentence} pour que le propriétaire le récupère.`,
    `/objet/${foundDecl.id}`
  ).catch(() => {});

  // ─── 2. PUSH AU PROPRIÉTAIRE PERDU (celui qui a perdu l'objet) ───
  // → "Rendez-vous chez [Admin] (quartier) pour récupérer votre objet"
  // claim = foundDecl.id (la page RestitutionPVPage charge la déclaration retrouvée via ce param)
  const restitutionLink = `/pv-restitution?claim=${foundDecl.id}&match=${match.id}`;
  await createNotification(
    lostDecl.owner,
    `Objet retrouvé ! (${score}%)`,
    `Votre objet "${lostDecl.title}" correspond à une déclaration de retrouvaille.\n\nRendez-vous chez ${adminName || "l'admin le plus proche"}${adminLocation ? ` (${adminLocation})` : ""} avec une pièce d'identité pour récupérer votre objet.`,
    restitutionLink
  );
  sendPush(
    lostDecl.owner,
    `Votre "${lostDecl.title}" a été retrouvé !`,
    `Rendez-vous chez ${adminSentence} avec une pièce d'identité pour récupérer votre objet.`,
    restitutionLink
  ).catch(() => {});

  // ─── 3. NOTIFICATION IN-APP À L'ADMIN ───
  try {
    if (nearestAdmin) {
      const levelLabel = nearestAdmin.matchLevel === "exact"
        ? "dans votre quartier"
        : nearestAdmin.matchLevel === "city"
          ? "dans votre ville"
          : "";

      await createNotification(
        nearestAdmin.id,
        "Nouvelle correspondance — Dépôt à traiter",
        `Correspondance de ${score}% entre "${lostDecl.title}" (perdu) et "${foundDecl.title}" (retrouvé).\n\nUn déposant${levelLabel ? ` ${levelLabel}` : ""} va se présenter avec l'objet. Un PV de dépôt doit être établi.`,
        `/admin`
      );
    }
  } catch (_) {}
};

// ─── WORKFLOW : RESTITUTION PAR L'ADMIN ───

export const onCompleteRestitution = async (pv, declaration, claimantUser) => {
  // 1. Mettre à jour la déclaration
  await pb.collection("declarations").update(declaration.id, {
    status: "returned",
  });

  // 2. Mettre à jour le PV
  await pb.collection("pvs").update(pv.id, {
    status: "restitution_done",
  });

  // Get admin info from the PV
  const adminName = pv.data?.adminName || "";
  const adminLabel = adminName ? ` par ${adminName}` : "";

  // 3. Notifier le propriétaire
  await createNotification(
    declaration.owner,
    "Objet restitué !",
    `Votre objet "${declaration.title}" a été restitué${adminLabel}. Merci d'avoir utilisé RetrouveMoi.`,
    `/tableau-de-bord`
  );
};
