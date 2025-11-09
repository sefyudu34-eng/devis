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
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Description / Demande client</label>
          <Textarea value={textInput} onChange={(e: any) => setTextInput(e.target.value)} rows={6} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button onClick={() => generateDevis(textInput)} disabled={isProcessing}>{isProcessing ? 'Génération...' : 'Générer Devis'}</Button>
          {devis && <Button onClick={handleDownloadPDF}>Télécharger PDF</Button>}
          {devis && <Button onClick={saveDevisToClient}>Sauvegarder</Button>}
        </div>

        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}

        {devis && (
          <div>
            <h3>Devis généré</h3>
            <p><strong>Numéro:</strong> {devis.numero}</p>
            <p><strong>Date:</strong> {new Date(devis.date).toLocaleDateString()}</p>
            <p><strong>Client:</strong> {devis.client.nom}</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ccc', padding: 6 }}>Désignation</th>
                  <th style={{ border: '1px solid #ccc', padding: 6 }}>Qté</th>
                  <th style={{ border: '1px solid #ccc', padding: 6 }}>P.U.</th>
                  <th style={{ border: '1px solid #ccc', padding: 6 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {devis.items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #ccc', padding: 6 }}>{it.description}</td>
                    <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{it.unitPrice} €</td>
                    <td style={{ border: '1px solid #ccc', padding: 6, textAlign: 'right' }}>{it.total} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p><strong>Sous-total:</strong> {devis.sousTotal} €</p>
            <p><strong>Total (TTC):</strong> {devis.total} €</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
