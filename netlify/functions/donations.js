// netlify/functions/donations.js
import { supabase } from "../../src/lib/supabaseClient.js";

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Gestion des requêtes OPTIONS (CORS)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
    };
  }

  // GET - Récupérer les totaux
  if (event.httpMethod === "GET") {
    try {
      const { data: totals, error } = await supabase
        .from("donation_totals")
        .select("*")
        .eq("label", "global")
        .maybeSingle();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: totals || { total_fcfa: 0, donors: 0 },
        }),
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.message,
        }),
      };
    }
  }

  // POST - Créer un don
  if (event.httpMethod === "POST") {
    try {
      const {
        donor_name,
        donor_phone,
        amount_fcfa,
        payment_method,
        message,
        usr_id,
      } = JSON.parse(event.body);

      // Validation
      if (!donor_name || !amount_fcfa || amount_fcfa < 100) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Données invalides. Montant minimum 100 FCFA.",
          }),
        };
      }

      // Création du don
      const { data: donation, error: donationError } = await supabase
        .from("donations")
        .insert({
          usr: usr_id || null,
          donor_name: donor_name.trim(),
          donor_phone: donor_phone || null,
          amount_fcfa: amount_fcfa,
          payment_method: payment_method || "other",
          message: message || null,
          status: "completed",
        })
        .select()
        .single();

      if (donationError) throw donationError;

      // Mise à jour des totaux
      const { data: currentTotals } = await supabase
        .from("donation_totals")
        .select("*")
        .eq("label", "global")
        .maybeSingle();

      const newTotal = (currentTotals?.total_fcfa || 0) + amount_fcfa;
      const newDonors = (currentTotals?.donors || 0) + 1;

      const { error: updateError } = await supabase
        .from("donation_totals")
        .upsert({
          label: "global",
          total_fcfa: newTotal,
          donors: newDonors,
          updated_at: new Date().toISOString(),
        })
        .eq("label", "global");

      if (updateError) throw updateError;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: donation,
          totals: {
            total_fcfa: newTotal,
            donors: newDonors,
          },
          message: "Don enregistré avec succès",
        }),
      };
    } catch (error) {
      console.error("❌ Erreur donation:", error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: error.message || "Erreur interne",
        }),
      };
    }
  }

  // Méthode non autorisée
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
};
