// netlify/functions/pv.js — Server-side PV creation using Supabase
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function generatePVNumber(type) {
  const prefix = type === "deposit" ? "PV-DEP" : "PV-RET";
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function maskIdNumber(id) {
  if (!id || id.length < 4) return id || "";
  return "*".repeat(id.length - 4) + id.slice(-4);
}

export const handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Non authentifié" }) };
    }

    const data = JSON.parse(event.body);
    const { type, form, generatedBy } = data;

    if (!type || !form || !generatedBy) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Données manquantes" }) };
    }

    const pvNumber = generatePVNumber(type);

    const payload = {
      pv_number: pvNumber,
      type: type,
      generated_by: generatedBy,
      signatory_name: form.signatoryName || "",
      signatory_phone: form.signatoryPhone || "",
      signatory_id_type: form.signatoryIdType || "",
      signatory_id_number: maskIdNumber(form.signatoryIdNumber),
      object_category: form.objectCategory || "",
      object_description: form.objectDescription || "",
      location: form.location || "Locaux RetrouveMoi",
      data: form,
    };

    const { data: pvData, error: pvError } = await supabase
      .from("pvs")
      .insert(payload)
      .select()
      .single();

    if (pvError) throw pvError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: pvData,
        pvNumber: pvNumber,
        message: "Procès-verbal généré avec succès",
      }),
    };
  } catch (error) {
    console.error("[pv] Error:", error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || "Erreur interne" }),
    };
  }
};
