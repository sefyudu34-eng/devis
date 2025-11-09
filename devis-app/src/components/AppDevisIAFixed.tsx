"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface DevisItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Client {
  id: string;
  nom: string;
  email?: string;
  adresse?: string;
  devis: Devis[];
  factures: Devis[];
}

interface Devis {
  id: string;
  numero: string;
  date: string;
  type: "devis" | "facture";
  client: {
    nom: string;
    email?: string;
    adresse?: string;
  };
  items: DevisItem[];
  sousTotal: number;
  total: number;
  statut?: string;
}

export default function AppDevisIA() {
  const [textInput, setTextInput] = useState("");
  const [devis, setDevis] = useState<Devis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [mode, setMode] = useState<'text' | 'voice' | 'agent'>('text');

  useEffect(() => {
    try {
      const raw = localStorage.getItem("clients");
      if (raw) setClients(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  const generateDevis = async (description: string) => {
    setIsProcessing(true);
    setError("");

    const systemPrompt = `You are an assistant that returns a JSON describing a french-style quote (devis). Respond ONLY with JSON matching keys: numero, date, client { nom, email?, adresse? }, items [ {description, quantity, unitPrice, total} ], sousTotal, total.`;

    try {
      const res = await fetch("https://llm.blackbox.ai/chat/completions", {
        method: "POST",
        headers: {
          customerId: "cus_TNfmYissyU6g42",
          "Content-Type": "application/json",
          Authorization: "Bearer xxx",
        },
        body: JSON.stringify({
          model: "openrouter/claude-sonnet-4",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Génère un devis basé sur: ${description}` },
          ],
        }),
      });

      if (!res.ok) throw new Error("LLM error");

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid format from LLM");

      const parsed = JSON.parse(jsonMatch[0]);

      const generated: Devis = {
        id: `DEV-${Date.now()}`,
        numero: parsed.numero || `DEVIS-${Date.now()}`,
        date: parsed.date || new Date().toISOString(),
        type: "devis",
        client: parsed.client || { nom: "Client" },
        items: (parsed.items || []).map((it: any) => ({
          description: it.description || "Item",
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          total: Number(it.total) || 0,
        })),
        sousTotal: Number(parsed.sousTotal) || 0,
        total: Number(parsed.total) || 0,
        statut: "brouillon",
      };

      setDevis(generated);
    } catch (e) {
      // fallback: create a simple mock devis
      const fallback: Devis = {
        id: `DEV-${Date.now()}`,
        numero: `DEVIS-${Date.now()}`,
        date: new Date().toISOString(),
        type: "devis",
        client: { nom: "Client Exemple" },
        items: [
          { description: textInput || "Travail de peinture", quantity: 1, unitPrice: 1200, total: 1200 },
        ],
        sousTotal: 1200,
        total: 1440,
        statut: "brouillon",
      };
      setDevis(fallback);
      setError("La génération automatique a échoué, affichage d'un devis de secours.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!devis) return;

    const headerTitle = devis.type === "facture" ? "Facture" : "Devis";
    const dateStr = new Date(devis.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric' });

    let rows = "";
    devis.items.forEach((item) => {
      rows += `<tr><td>${item.description}</td><td style="text-align:center">${item.quantity.toFixed(2).replace('.', ',')}</td><td style="text-align:right">${item.unitPrice.toFixed(2).replace('.', ',')} €</td><td style="text-align:right">${item.total.toFixed(2).replace('.', ',')} €</td></tr>`;
    });

    const html =
      '<!doctype html><html><head><meta charset="utf-8"><title>' + headerTitle + '</title>' +
      '<style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:6px;font-size:12px}</style>' +
      '</head><body>' +
      `<h2>${headerTitle}</h2>` +
      `<p><strong>Date :</strong> ${dateStr}</p>` +
      `<p><strong>Client :</strong> ${devis.client.nom}</p>` +
      '<table><thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Prix H.T.</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      `<p><strong>Montant H.T.:</strong> ${devis.sousTotal.toFixed(2).replace('.', ',')} €</p>` +
      `<p><strong>Total T.T.C:</strong> ${devis.total.toFixed(2).replace('.', ',')} €</p>` +
      '</body></html>';

    const w = window.open('', '_blank', 'height=800,width=800');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  };

  const saveDevisToClient = () => {
    if (!devis) return;
    const clientName = devis.client.nom;
    const existingIndex = clients.findIndex(c => c.nom.toLowerCase() === clientName.toLowerCase());
    if (existingIndex !== -1) {
      const updated = [...clients];
      updated[existingIndex].devis.push(devis);
      setClients(updated);
      localStorage.setItem('clients', JSON.stringify(updated));
    } else {
      const newClient: Client = { id: `CLI-${Date.now()}`, nom: clientName, devis: [devis], factures: [] };
      const updated = [...clients, newClient];
      setClients(updated);
      localStorage.setItem('clients', JSON.stringify(updated));
    }
    alert('Devis sauvegardé pour ' + clientName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assistant Devis IA</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <label className="block mb-3 font-semibold text-lg">Décrivez votre projet</label>

          {/* Mode buttons */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`px-6 py-3 rounded-md border ${mode === 'text' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-gray-200'}`}
            >
              📄 Mode Texte
            </button>

            <button
              type="button"
              onClick={() => setMode('voice')}
              className={`px-6 py-3 rounded-md border ${mode === 'voice' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-gray-200'}`}
            >
              🎤 Mode Vocal
            </button>

            <button
              type="button"
              onClick={() => setMode('agent')}
              className={`px-6 py-3 rounded-md border ${mode === 'agent' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-gray-200'}`}
            >
              💬 Agent IA
            </button>
          </div>

          <Textarea
            value={textInput}
            onChange={(e: any) => setTextInput(e.target.value)}
            rows={6}
            placeholder="Ex: Je souhaite un site web vitrine pour mon restaurant avec 5 pages, design moderne, formulaire de contact et intégration Google Maps..."
            className="w-full border-gray-200"
          />
        </div>

        <div className="flex justify-center mt-6">
          <Button
            onClick={() => generateDevis(textInput)}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-3 bg-transparent"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            {isProcessing ? 'Génération...' : 'Générer le devis'}
          </Button>
        </div>

        {error && <div className="text-red-600 mt-4">{error}</div>}

        {devis && (
          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-2">Devis généré</h3>
            <p><strong>Numéro:</strong> {devis.numero}</p>
            <p><strong>Date:</strong> {new Date(devis.date).toLocaleDateString()}</p>
            <p><strong>Client:</strong> {devis.client.nom}</p>
            <table className="w-full border-collapse mt-3">
              <thead>
                <tr>
                  <th className="border px-3 py-2">Désignation</th>
                  <th className="border px-3 py-2">Qté</th>
                  <th className="border px-3 py-2">P.U.</th>
                  <th className="border px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {devis.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="border px-3 py-2">{it.description}</td>
                    <td className="border px-3 py-2 text-center">{it.quantity}</td>
                    <td className="border px-3 py-2 text-right">{it.unitPrice} €</td>
                    <td className="border px-3 py-2 text-right">{it.total} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3"><strong>Sous-total:</strong> {devis.sousTotal} €</p>
            <p><strong>Total (TTC):</strong> {devis.total} €</p>
            <div className="flex gap-3 mt-4">
              <Button onClick={handleDownloadPDF}>Télécharger PDF</Button>
              <Button onClick={saveDevisToClient}>Sauvegarder</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
