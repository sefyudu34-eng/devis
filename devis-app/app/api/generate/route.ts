import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    console.log("Début de la requête API");
    const { prompt, client } = await request.json();
    console.log("Prompt reçu:", prompt);
    console.log("Client:", client);

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

    console.log("Appel à OpenAI");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Changement pour utiliser gpt-3.5-turbo au lieu de gpt-4
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    console.log("Réponse OpenAI reçue:", completion.choices[0].message.content);

    const devisContent = completion.choices[0].message.content || '';
    
    // Créer une structure pour analyser la réponse
    const parsedItems = [];
    const lines = devisContent.split('\n');
    
    let currentItem: any = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Ignorer les lignes vides
      if (!trimmedLine) continue;
      
      // Détecter le début d'un nouvel item
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        if (currentItem.description) {
          // Si on a déjà un item en cours, on l'ajoute à la liste
          if (currentItem.quantity && currentItem.unitPrice) {
            parsedItems.push({
              ...currentItem,
              total: currentItem.quantity * currentItem.unitPrice
            });
          }
        }
        currentItem = {};
      }

      // Parser les différentes parties de l'item
      if (trimmedLine.toLowerCase().includes('description:')) {
        currentItem.description = trimmedLine.split(':')[1].trim();
      } else if (trimmedLine.toLowerCase().includes('quantité:') || trimmedLine.toLowerCase().includes('quantite:')) {
        const quantityStr = trimmedLine.split(':')[1].trim();
        const quantityMatch = quantityStr.match(/\d+/);
        if (quantityMatch) {
          currentItem.quantity = parseInt(quantityMatch[0]);
        }
      } else if (trimmedLine.toLowerCase().includes('prix') || trimmedLine.toLowerCase().includes('cout')) {
        const priceMatch = trimmedLine.match(/(\d+(?:\.\d{1,2})?)/);
        if (priceMatch) {
          currentItem.unitPrice = parseFloat(priceMatch[1]);
        }
      }
    }

    // Ajouter le dernier item s'il existe
    if (currentItem.description && currentItem.quantity && currentItem.unitPrice) {
      parsedItems.push({
        ...currentItem,
        total: currentItem.quantity * currentItem.unitPrice
      });
    }

    // Si aucun item n'a été parsé, créer un item par défaut
    if (parsedItems.length === 0) {
      parsedItems.push({
        description: "Service général",
        quantity: 1,
        unitPrice: 100,
        total: 100
      });
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