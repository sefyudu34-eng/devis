import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { prompt, client } = await request.json();

    const systemPrompt = `Tu es un assistant spécialisé dans la génération de devis. 
    Utilise les informations fournies pour générer un devis détaillé.
    Format attendu : liste d'items avec description, quantité, prix unitaire et total.`;

    const userPrompt = `Générer un devis pour le client ${client?.nom || 'inconnu'} avec les détails suivants : ${prompt}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const devisContent = completion.choices[0].message.content;
    
    // Parser la réponse et créer un devis structuré
    const devis = {
      id: crypto.randomUUID(),
      numero: `DEV-${Date.now()}`,
      date: new Date().toISOString(),
      type: "devis",
      client: client || {
        nom: "Client",
        email: "",
        adresse: ""
      },
      items: [],
      sousTotal: 0,
      tva: 0,
      total: 0,
      statut: "brouillon"
    };

    // Ici, vous pouvez ajouter la logique pour parser devisContent
    // et remplir les items du devis

    return NextResponse.json({ devis });
  } catch (error) {
    console.error('Erreur de génération:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du devis' },
      { status: 500 }
    );
  }
}