// netlify/functions/pv.js
import { supabase } from '../../src/lib/supabaseClient.js';
import { generatePVNumber, maskIdNumber, formatDateTimeFr } from '../../src/lib/pv.js';

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Gestion des requêtes OPTIONS (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
    };
  }

  // Méthode non autorisée
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Vérification de l'authentification
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Non authentifié' }),
      };
    }

    // Récupération des données
    const data = JSON.parse(event.body);
    const { type, form, generatedBy } = data;

    if (!type || !form || !generatedBy) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Données manquantes' }),
      };
    }

    // Génération du numéro de PV
    const pvNumber = generatePVNumber(type);

    // Construction du payload
    const payload = {
      pv_number: pvNumber,
      type: type,
      generated_by: generatedBy,
      signatory_name: form.signatoryName || '',
      signatory_phone: form.signatoryPhone || '',
      signatory_id_type: form.signatoryIdType || '',
      signatory_id_number: maskIdNumber(form.signatoryIdNumber),
      object_category: form.objectCategory || '',
      object_description: form.objectDescription || '',
      location: form.location || 'Locaux RetrouveMoi',
      data: form,
      created_at: new Date().toISOString(),
    };

    // Sauvegarde dans Supabase
    const { data: pvData, error: pvError } = await supabase
      .from('pvs')
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
        message: 'Procès-verbal généré avec succès',
      }),
    };

  } catch (error) {
    console.error('❌ Erreur PV:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erreur interne',
      }),
    };
  }
};