// netlify/functions/donations.js — Server-side donations using Supabase
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // GET — totals
  if (event.httpMethod === "GET") {
    try {
      const { data, error } = await supabase
        .from("donation_totals")
        .select("*")
        .eq("label", "global")
        .maybeSingle();

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: data || { total_fcfa: 0, donors: 0 } }),
      };
    } catch (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
  }

  // POST — create donation
  if (event.httpMethod === "POST") {
    try {
      const { donor_name, donor_phone, amount_fcfa, payment_method, message, usr_id } = JSON.parse(event.body);

      if (!donor_name || !amount_fcfa || amount_fcfa < 100) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "Données invalides. Montant minimum 100 FCFA." }) };
      }

      const { data: donation, error: donationError } = await supabase
        .from("donations")
        .insert({
          usr: usr_id || null,
          donor_name: donor_name.trim(),
          donor_phone: donor_phone || null,
          amount_fcfa,
          payment_method: payment_method || "other",
          message: message || null,
          status: "completed",
        })
        .select()
        .single();

      if (donationError) throw donationError;

      // Update totals
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
          totals: { total_fcfa: newTotal, donors: newDonors },
          message: "Don enregistré avec succès",
        }),
      };
    } catch (error) {
      console.error("[donations] Error:", error.message);
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message || "Erreur interne" }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
};
