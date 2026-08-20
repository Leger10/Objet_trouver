// Service de notifications : in-app + push (OneSignal) + email queue
import { pb, supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
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

// Envoyer push à un user spécifique (via REST API Supabase Edge Function ou direct)
export const sendPushToUser = async (userId, title, body, url = "/tableau-de-bord") => {
  try {
    // On utilise le tag OneSignal = user ID Supabase
    await window.OneSignal?.sendNotificationToExternalUser({
      include_external_user_ids: [userId],
      contents: { fr: body },
      headings: { fr: title },
      url,
    });
  } catch (_) {
    /* OneSignal REST API pas disponible côté client — on skip */
  }
};

// Push broadcast à tous les users sauf l'expéditeur
export const pushAllUsers = async (senderId, title, body, url) => {
  // On ne peut pas envoyer push broadcast depuis le client
  // Les pushes seront gérés par les notifications in-app + email queue
};

// ─── EMAIL QUEUE ───

export const queueEmail = async (toEmail, subject, body) => {
  try {
    await supabase.from("email_queue").insert({
      to_email: toEmail,
      subject,
      body,
      status: "pending",
    });
  } catch (_) {
    /* best-effort */
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

  // 2. Email à tous les autres users
  try {
    const { data: users } = await supabase
      .from("users")
      .select("id, email")
      .neq("id", user.id)
      .not("email", "is", null);

    if (users?.length) {
      await Promise.all(
        users.map((u) =>
          queueEmail(
            u.email,
            title,
            `${body}\n\nConsultez la déclaration : ${SUPABASE_URL}/objet/${declaration.id}\n\nL'équipe ${user.name || "RetrouveMoi"}`
          )
        )
      );
    }
  } catch (_) {
    /* best-effort */
  }
};

// ─── WORKFLOW : CORRESPONDANCE TROUVÉE ───

export const onMatchFound = async (match, lostDecl, foundDecl) => {
  const score = match.score;

  // Look up deposit PV info for the found declaration
  const pvInfo = await getDepositPVInfo(foundDecl.id);
  const adminLabel = pvInfo?.adminName ? `Administrateur : ${pvInfo.adminName}` : "";
  const locationLabel = pvInfo?.location ? `Lieu de retrait : ${pvInfo.location}` : "";
  const pvLabel = pvInfo?.pvNumber ? `PV n°${pvInfo.pvNumber}` : "";

  const pickupDetails = [adminLabel, locationLabel].filter(Boolean).join("\n");

  // 1. Notifier le propriétaire de la déclaration "perdue"
  await createNotification(
    lostDecl.owner,
    `Objet retrouvé ! (${score}%)`,
    `Un objet "${foundDecl.title}" correspond à votre déclaration "${lostDecl.title}".${pickupDetails ? `\n\n${pickupDetails}` : ""}\nPrésentez-vous avec une pièce d'identité pour récupérer votre objet.`,
    `/tableau-de-bord`
  );

  // 2. Email avec copie du PV de dépôt
  try {
    const { data: owner } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", lostDecl.owner)
      .single();

    if (owner?.email) {
      const pvDetails = pvInfo ? `
DÉTAILS DU DÉPÔT :
${pvInfo.pvNumber ? `Procès-verbal n°${pvInfo.pvNumber}` : ""}
${pvInfo.adminName ? `Administrateur responsable : ${pvInfo.adminName}` : ""}
${pvInfo.location ? `Lieu de retrait : ${pvInfo.location}` : ""}
` : "";

      await queueEmail(
        owner.email,
        `Votre objet "${lostDecl.title}" a été retrouvé !`,
        `Bonjour ${owner.name || ""},

Bonne nouvelle ! Un objet correspondant à votre déclaration "${lostDecl.title}" a été retrouvé et déposé dans nos locaux.

Objet retrouvé : ${foundDecl.title}
Ville : ${foundDecl.city || "Non renseignée"}
Score de correspondance : ${score}%
${pvDetails}
Pour récupérer votre objet, présentez-vous à l'endroit indiqué ci-dessus avec une pièce d'identité.
${pvInfo?.adminName ? `L'administrateur ${pvInfo.adminName}` : "L'administration"} vérifiera le procès-verbal et vous remettra votre objet.

Cordialement,
L'équipe RetrouveMoi`
      );
    }
  } catch (_) {
    /* best-effort */
  }

  // 3. Notifier l'admin du dépôt
  try {
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin");

    if (admins?.length) {
      await Promise.all(
        admins.map((a) =>
          createNotification(
            a.id,
            "Nouvelle correspondance",
            `Correspondance de ${score}% entre "${lostDecl.title}" (perdu) et "${foundDecl.title}" (retrouvé).${pvInfo?.pvNumber ? ` PV n°${pvInfo.pvNumber}.` : ""} Un PV de dépôt doit être établi.`,
            `/admin`
          )
        )
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

  // 4. Email de confirmation
  try {
    const { data: owner } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", declaration.owner)
      .single();

    if (owner?.email) {
      const pvLocation = pv.location || "";
      await queueEmail(
        owner.email,
        `Votre objet "${declaration.title}" a été restitué`,
        `Bonjour ${owner.name || ""},

Votre objet "${declaration.title}" a bien été restitué${adminLabel}.
${pvLocation ? `Lieu de restitution : ${pvLocation}` : ""}

Votre déclaration est maintenant archivée.

Merci d'avoir utilisé RetrouveMoi !

Cordialement,
L'équipe RetrouveMoi`
      );
    }
  } catch (_) {}
};
