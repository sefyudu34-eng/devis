import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { prompt, client } = await request.json();

    const systemPrompt = `Tu es un assistant spécialisé dans la génération de devis. 
    Analyse la demande et génère une liste détaillée d'items pour le devis.
    Utilise ce format exact pour chaque item :
    - Description: [description détaillée]
    - Quantité: [nombre] unités
    - Prix unitaire: [montant] €

    Exemple:
    - Description: Développement page d'accueil responsive
    - Quantité: 1 unité
    - Prix unitaire: 800 €

    Inclus au moins 3 items pertinents et détaillés dans ta réponse.`;

    const userPrompt = `Générer un devis pour le client ${client?.nom || 'inconnu'} avec les détails suivants : ${prompt}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const devisContent = completion.choices[0].message.content || '';
    
    // Créer une structure pour analyser la réponse
    const parsedItems = [];
    const lines = devisContent.split('\n');
    
    let currentItem = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Ignorer les lignes vides
      if (!trimmedLine) continue;
      
      // Essayer de détecter les prix et quantités
      const priceMatch = trimmedLine.match(/(\d+(?:\.\d{1,2})?)\s*(?:€|EUR)/);
      const quantityMatch = trimmedLine.match(/(\d+)\s*(?:x|pcs?|unités?)/i);
      
      if (priceMatch || quantityMatch) {
        // C'est probablement une ligne d'item
        const unitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        const description = trimmedLine
          .replace(/(\d+(?:\.\d{1,2})?)\s*(?:€|EUR)/g, '')
          .replace(/(\d+)\s*(?:x|pcs?|unités?)/gi, '')
          .trim();
          
        parsedItems.push({
          description,
          quantity,
          unitPrice,
          total: quantity * unitPrice
        });
      }
    }
    
    // Calculer les totaux
    const sousTotal = parsedItems.reduce((acc, item) => acc + item.total, 0);
    const tva = sousTotal * 0.2; // TVA 20%
    const total = sousTotal + tva;
    
    // Créer le devis structuré
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
      items: parsedItems,
      sousTotal,
      tva,
      total,
      statut: "brouillon"
    };

    return NextResponse.json({ devis });
  } catch (error) {
    console.error('Erreur de génération:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du devis' },
      { status: 500 }
    );
  }
}