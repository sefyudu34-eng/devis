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
/*
    if (!devis || devis.type === "facture") return;

    const facture: Devis = {
      ...devis,
      id: `FAC-${Date.now()}`,
      numero: devis.numero.replace("DEVIS-", "FACTURE-"),
      type: "facture",
      statut: "envoyé"
    };

    const clientName = devis.client.nom;
    const existingClientIndex = clients.findIndex(c => c.nom.toLowerCase() === clientName.toLowerCase());

    if (existingClientIndex !== -1) {
      const updatedClients = [...clients];
      updatedClients[existingClientIndex].factures.push(facture);
      updatedClients[existingClientIndex].devis = updatedClients[existingClientIndex].devis.map(d =>
        d.id === devis.id ? { ...d, statut: "facturé" as const } : d
      );
      setClients(updatedClients);
      localStorage.setItem('clients', JSON.stringify(updatedClients));
    }

    setDevis(facture);
    alert('Devis transformé en facture avec succès !');
  };

  const searchClientByVoice = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      formData.append("model_id", "scribe_v1");

      const sttResponse = await fetch(
        "https://elevenlabs-proxy-server-lipn.onrender.com/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            customerId: "cus_TNfmYissyU6g42",
            Authorization: "Bearer xxx",
          },
          body: formData,
        }
      );

      if (!sttResponse.ok) {
        throw new Error("Erreur lors de la transcription audio");
      }

      const transcription = await sttResponse.json();
      const searchText = transcription.text || "";
      setSearchQuery(searchText);

      const foundClient = clients.find(c => 
        c.nom.toLowerCase().includes(searchText.toLowerCase())
      );

      if (foundClient) {
        setSelectedClient(foundClient);
      } else {
        setError(`Aucun client trouvé avec le nom "${searchText}"`);
      }
    } catch (err) {
      setError("Erreur lors de la recherche vocale. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!devis) return;

    const printWindow = window.open("", "", "height=800,width=800");
    if (printWindow) {
      printWindow.document.write("<html><head><title>" + (devis.type === "facture" ? "Facture" : "Devis") + "</title>");
      printWindow.document.write(`
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { margin: 20mm; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 10px;
            font-size: 9pt;
            line-height: 1.2;
          }
          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
          }
          .logo-section {
            display: flex;
            gap: 10px;
          }
          .logo-box {
            width: 80px;
            height: 70px;
            border: 1px solid #000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8pt;
            font-weight: bold;
          }
          .company-info {
            font-size: 8pt;
            line-height: 1.3;
            margin-top: 5px;
          }
          .center-title {
            text-align: center;
            flex: 1;
            padding: 0 20px;
          }
          .main-title {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .sub-title {
            font-size: 9pt;
            font-weight: bold;
          }
          .right-box {
            min-width: 200px;
          }
          .devis-header {
            border: 2px solid #000;
            text-align: center;
            padding: 8px;
            margin-bottom: 5px;
          }
          .devis-title {
            font-size: 18pt;
            font-weight: bold;
            letter-spacing: 8px;
          }
          .date-line {
            margin: 8px 0;
            font-size: 9pt;
          }
          .client-info-box {
            border: 2px solid #000;
            padding: 8px;
            min-height: 60px;
            font-size: 8pt;
          }
          .objet-line {
            margin: 10px 0;
            font-size: 9pt;
          }
          .main-table {
            width: 100%;
            border-collapse: collapse;
            border: 2px solid #000;
            margin: 10px 0;
          }
          .main-table th {
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: center;
            font-size: 8pt;
            font-weight: bold;
            background: white;
          }
          .main-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            font-size: 8pt;
            vertical-align: top;
          }
          .main-table td:nth-child(1) { text-align: left; width: 50%; }
          .main-table td:nth-child(2) { text-align: center; width: 8%; }
          .main-table td:nth-child(3) { text-align: center; width: 12%; }
          .main-table td:nth-child(4) { text-align: right; width: 15%; }
          .main-table td:nth-child(5) { text-align: right; width: 15%; }
          .bottom-section {
            display: flex;
            justify-content: space-between;
            margin-top: 5px;
          }
          .conditions-box {
            flex: 1;
            font-size: 8pt;
            color: #0066cc;
            line-height: 1.4;
          }
          .totals-box {
            width: 400px;
          }
          .total-row {
            display: flex;
            border: 1px solid #000;
            background: white;
          }
          .total-label {
            flex: 1;
            padding: 5px 10px;
            text-align: right;
            font-weight: bold;
            font-size: 9pt;
            border-right: 1px solid #000;
          }
          .total-value {
            width: 150px;
            padding: 5px 10px;
            text-align: right;
            font-weight: bold;
            font-size: 9pt;
          }
          .footer-info {
            margin-top: 20px;
            text-align: center;
            font-size: 7pt;
            border-top: 1px solid #000;
            padding-top: 8px;
          }
        </style>
      `);
      printWindow.document.write("</head><body>");
      
      // En-tête de page EXACT
      printWindow.document.write(`
        <table style="width: 100%; margin-bottom: 20px; border: none;">
          <tr>
            <td style="width: 30%; vertical-align: top; border: none;">
              <img src="https://placehold.co/100x80?text=ABELLO+LOGO" alt="Logo Abello showing blue house icon with company branding" style="display: block; margin-bottom: 5px;">
              <img src="https://placehold.co/100x80?text=RGE+QUALIBAT" alt="RGE Qualibat certification logo with blue accreditation badge" style="display: block; margin-bottom: 10px;">
              <div style="font-size: 8pt; color: #0066cc; line-height: 1.3;">
                <strong>3 rue Pierre Séguier 34500 Béziers</strong><br>
                <span style="color: #000;}>Port : 06 63 52 57 06</span><br>
                <span style="color: #000;">Email : sarldouz@hotmail.fr</span><br>
                <span style="color: #000;">sarldouz.fr</span>
              </div>
            </td>
            <td style="width: 40%; text-align: center; vertical-align: top; border: none;">
              <div style="font-size: 10pt; font-weight: bold; line-height: 1.4;">
                PEINTURE GÉNÉRALE - ENDUITS MONOCOUCHE - RAVALEMENT DE FAÇADE
              </div>
              <div style="font-size: 9pt; font-weight: bold; margin-top: 10px;">
                NEUF & RÉNOVATION - ISOLATION PAR L'EXTÉRIEUR
              </div>
            </td>
            <td style="width: 30%; vertical-align: top; text-align: right; border: none;">
              <div style="border: 2px solid #000; padding: 10px; text-align: center; margin-bottom: 10px;">
                <div style="font-size: 20pt; font-weight: bold; letter-spacing: 0.5em;">D E V I S</div>
              </div>
              <div style="font-size: 9pt; margin-bottom: 10px;">
                Date : <strong>${new Date(devis.date).toLocaleDateString("fr-FR", {day: '2-digit', month: '2-digit', year: 'numeric'})}</strong>
              </div>
              <div style="border: 2px solid #000; padding: 10px; min-height: 70px; text-align: left;">
                <strong style="font-size: 10pt;">${devis.client.nom}</strong><br><br>
                <span style="font-size: 8pt;">34500 Béziers</span>
              </div>
            </td>
          </tr>
        </table>
        <div style="margin: 15px 0; font-size: 9pt;"><strong>Objet :</strong> Façade Chantier médiathèque Puisserguier</div>
      `);
  */