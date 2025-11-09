"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Send, FileText, Download, Edit, Plus, MessageSquare } from "lucide-react";
import { useConversation } from '@elevenlabs/react';
import { motion, AnimatePresence } from "framer-motion";

interface DevisItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Devis {
  id: string;
  numero: string;
  date: string;
  type: "devis" | "facture";
  client: {
    nom: string;
    email: string;
    adresse: string;
  };
  items: DevisItem[];
  sousTotal: number;
  tva: number;
  total: number;
  statut: "brouillon" | "envoyé" | "accepté" | "facturé";
}

interface Client {
  id: string;
  nom: string;
  email: string;
  adresse: string;
  devis: Devis[];
  factures: Devis[];
}

export default function AppDevisIA() {
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [devis, setDevis] = useState<Devis | null>(null);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientList, setShowClientList] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversationMode, setConversationMode] = useState(false);
  const [conversationStatus, setConversationStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");
  const [transcript, setTranscript] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // ChatGPT integration (client-side state)
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  React.useEffect(() => {
    const savedClients = localStorage.getItem('clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }
  }, []);

  const startConversationalAgent = async () => {
    try {
      setConversationStatus("connecting");
      
      const response = await fetch("/api/elevenlabs-signed-url", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la connexion");
      }

      const { signed_url } = await response.json();
      
      setConversationStatus("connected");
      setConversationMode(true);
      
    } catch (err) {
      setError("Erreur de connexion à l'agent conversationnel");
      setConversationStatus("idle");
    }
  };

  const processConversationCommand = async (userMessage: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes("devis") && !lowerMessage.includes("facture")) {
      await generateDevis(userMessage);
      setTranscript(prev => [...prev, `Utilisateur: ${userMessage}`, "Agent: Je génère un devis pour vous..."]);
    } else if (lowerMessage.includes("facture")) {
      if (devis && devis.type === "devis") {
        transformDevisToFacture();
        setTranscript(prev => [...prev, `Utilisateur: ${userMessage}`, "Agent: Je transforme le devis en facture..."]);
      } else {
        await generateDevis(userMessage);
        const newDevis = { ...devis!, type: "facture" as const };
        setDevis(newDevis);
        setTranscript(prev => [...prev, `Utilisateur: ${userMessage}`, "Agent: Je génère une facture pour vous..."]);
      }
    } else if (lowerMessage.includes("cherch") || lowerMessage.includes("trouv") || lowerMessage.includes("client")) {
      const foundClient = clients.find(c => 
        lowerMessage.includes(c.nom.toLowerCase())
      );
      
      if (foundClient) {
        setSelectedClient(foundClient);
        setShowClientList(true);
        setTranscript(prev => [...prev, `Utilisateur: ${userMessage}`, `Agent: J'ai trouvé le client ${foundClient.nom} avec ${foundClient.devis.length} devis et ${foundClient.factures.length} factures.`]);
      } else {
        setTranscript(prev => [...prev, `Utilisateur: ${userMessage}`, "Agent: Je n'ai pas trouvé ce client dans la base de données."]);
      }
    }
  };

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await transcribeAndGenerateDevis(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError("Erreur d'accès au microphone. Veuillez autoriser l'accès.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndGenerateDevis = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      formData.append("model_id", "scribe_v1");

      // Send audio to our server-side proxy which forwards the request to ElevenLabs
      const sttResponse = await fetch("/api/elevenlabs", {
        method: "POST",
        body: formData,
      });

      if (!sttResponse.ok) {
        throw new Error("Erreur lors de la transcription audio");
      }

      const transcription = await sttResponse.json();
      const transcribedText = transcription.text || "";

      await generateDevis(transcribedText);
    } catch (err) {
      setError("Erreur lors du traitement audio. Veuillez réessayer.");
      setIsProcessing(false);
    }
  };

  const generateDevis = async (description: string) => {
    setIsProcessing(true);
    setError("");

    try {
      const systemPrompt = `Tu es un assistant spécialisé dans la génération de devis professionnels. 
À partir de la description fournie par l'utilisateur, tu dois générer un devis détaillé au format JSON strictement suivant cette structure :

{
  "numero": "DEVIS-XXXX",
  "date": "YYYY-MM-DD",
  "client": {
    "nom": "Nom du client ou entreprise",
    "email": "email@example.com",
    "adresse": "Adresse complète"
  },
  "items": [
    {
      "description": "Description du service ou produit",
      "quantity": nombre,
      "unitPrice": prix_unitaire,
      "total": quantité * prix_unitaire
    }
  ],
  "sousTotal": somme_totaux_items,
  "tva": sous_total * 0.20,
  "total": sous_total + tva
}

Règles importantes :
- Génère un numéro de devis unique commençant par DEVIS-
- Utilise la date du jour au format ISO
- Si le client n'est pas mentionné, utilise des informations génériques
- Estime des prix réalistes basés sur le marché français
- Inclus au moins 1 item, maximum 10 items
- La TVA est toujours de 20%
- Tous les montants en euros
- Réponds UNIQUEMENT avec le JSON, sans texte additionnel`;

      const response = await fetch("https://llm.blackbox.ai/chat/completions", {
        method: "POST",
        headers: {
          customerId: "cus_TNfmYissyU6g42",
          "Content-Type": "application/json",
          Authorization: "Bearer xxx",
        },
        body: JSON.stringify({
          model: "openrouter/claude-sonnet-4",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: `Génère un devis basé sur cette demande : ${description}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la génération du devis");
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Format de réponse invalide");
      }

      const generatedDevis: Devis = {
        ...JSON.parse(jsonMatch[0]),
        id: `DEV-${Date.now()}`,
        type: "devis",
        statut: "brouillon"
      };
      setDevis(generatedDevis);
    } catch (err) {
      setError("Erreur lors de la génération du devis. Veuillez réessayer.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      generateDevis(textInput);
    }
  };

  const handleNewDevis = () => {
    setDevis(null);
    setTextInput("");
    setError("");
    setSelectedClient(null);
  };

  const saveDevisToClient = () => {
    if (!devis) return;

    const clientName = devis.client.nom;
    const existingClientIndex = clients.findIndex(c => c.nom.toLowerCase() === clientName.toLowerCase());

    if (existingClientIndex !== -1) {
      const updatedClients = [...clients];
      if (devis.type === "devis") {
        updatedClients[existingClientIndex].devis.push(devis);
      } else {
        updatedClients[existingClientIndex].factures.push(devis);
      }
      setClients(updatedClients);
      localStorage.setItem('clients', JSON.stringify(updatedClients));
    } else {
      const newClient: Client = {
        id: `CLI-${Date.now()}`,
        nom: devis.client.nom,
        email: devis.client.email,
        adresse: devis.client.adresse,
        devis: devis.type === "devis" ? [devis] : [],
        factures: devis.type === "facture" ? [devis] : []
      };
      const updatedClients = [...clients, newClient];
      setClients(updatedClients);
      localStorage.setItem('clients', JSON.stringify(updatedClients));
    }

    alert(`${devis.type === "devis" ? "Devis" : "Facture"} sauvegardé(e) pour le client ${clientName} !`);
  };

  const transformDevisToFacture = () => {
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

      // Use our server proxy for voice search as well
      const sttResponse = await fetch("/api/elevenlabs", {
        method: "POST",
        body: formData,
      });

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
      // Use absolute URLs for images so they load correctly in the new window
      const origin = window.location.origin;

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
            background: white;
            color: #000;
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
      
      // En-tête de page EXACT (use absolute URLs)
      printWindow.document.write(`
        <table style="width: 100%; margin-bottom: 20px; border: none;">
          <tr>
            <td style="width: 30%; vertical-align: top; border: none;">
              <img src="${origin}/images/sarldouz.png" alt="SARL DOUZ logo" style="display: block; margin-bottom: 5px; max-width:100px; height:auto;">
              <img src="${origin}/images/qualibat.png" alt="RGE Qualibat logo" style="display: block; margin-bottom: 10px; max-width:100px; height:auto;">
              <div style="font-size: 8pt; color: #0066cc; line-height: 1.3;">
                <strong>3 rue Pierre Séguier 34500 Béziers</strong><br>
                <span style="color: #000;">Port : 06 63 52 57 06</span><br>
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
      
      printWindow.document.write(`
        <table class="main-table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>U.</th>
              <th>Qté</th>
              <th>P.U.</th>
              <th>Prix H.T.</th>
            </tr>
          </thead>
          <tbody>
      `);
      
      devis.items.forEach((item) => {
        printWindow.document.write(`
          <tr>
            <td>${item.description}</td>
            <td>m²</td>
            <td>${item.quantity.toFixed(2).replace('.', ',')}</td>
            <td>${item.unitPrice.toFixed(2).replace('.', ',')} €</td>
            <td>${item.total.toFixed(2).replace('.', ',')} €</td>
          </tr>
        `);
      });
      
      printWindow.document.write(`
          </tbody>
        </table>
      `);
      
      // Section bas avec conditions et totaux
      printWindow.document.write(`
        <div class="bottom-section">
          <div class="conditions-box">
            <strong>Conditions :</strong><br>
            Acompte de 30 % à la commande, solde à la fin des travaux.<br>
            Validité du devis 1 mois.
          </div>
          <div class="totals-box">
            <div class="total-row">
              <div class="total-label">Montant H.T.</div>
              <div class="total-value">${devis.sousTotal.toFixed(2).replace('.', ',')} €</div>
            </div>
            <div class="total-row">
              <div class="total-label">TVA AUTO LIQUIDATION</div>
              <div class="total-value"></div>
            </div>
            <div class="total-row">
              <div class="total-label">Montant T.T.C</div>
              <div class="total-value">${devis.total.toFixed(2).replace('.', ',')} €</div>
            </div>
          </div>
        </div>
      `);
      
      // Footer avec informations légales
      printWindow.document.write(`
        <div class="footer-info">
          SARL au capital de 8000€ - Siret : 509 043 246 000 16 - APE : 4334Z - TVA INTRACOM : FR 655 090 432 49
        </div>
      `);
      
      printWindow.document.write("</body></html>");
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Send chat message to server proxy which forwards to OpenAI
  const sendChatMessage = async () => {
    const content = chatInput.trim();
    if (!content) return;
    const newUser = { role: 'user', content };
    setChatMessages(prev => [...prev, newUser]);
    setChatInput('');
    setChatLoading(true);

    try {
      const resp = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...chatMessages, newUser] }),
      });
      let data: any = null;
      if (!resp.ok) {
        // try parse json, otherwise text
        try {
          const errObj = await resp.json();
          throw new Error(errObj?.error || JSON.stringify(errObj));
        } catch (eJson) {
          const txt = await resp.text();
          throw new Error(txt || `OpenAI proxy returned status ${resp.status}`);
        }
      } else {
        try {
          data = await resp.json();
        } catch (e) {
          const raw = await resp.text();
          // show raw response as error message
          setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erreur: réponse non JSON du serveur: ' + raw }]);
          setChatLoading(false);
          return;
        }
      }

      const assistant = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.text || '';
      if (assistant) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: assistant }]);
      } else if (data?.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erreur: ' + data.error }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Erreur: ' + (err.message || String(err)) }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-between w-full max-w-6xl mx-auto gap-6">
            <div className="flex items-center gap-4">
              <img src="/images/sarldouz.png" alt="SARL DOUZ" className="h-14 w-auto rounded-md shadow-sm" />
              <div className="hidden sm:block">
                <div className="text-sm text-muted-foreground">Entreprise</div>
                <div className="font-semibold">SARL DOUZ</div>
              </div>
            </div>

            <div className="flex-1">
              <div className="mx-auto inline-block bg-white dark:bg-slate-900 rounded-2xl px-8 py-6 shadow-2xl">
                <div className="flex items-center gap-6">
                  <div>
                    <h1 className="hero-title mb-1 text-4xl md:text-5xl">
                      Générateur de Devis IA
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground">
                      Créez des devis professionnels en parlant ou en écrivant
                    </p>
                  </div>
                  <img src="/images/qualibat.png" alt="QUALIBAT" className="h-16 w-auto hidden md:block" />
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowClientList(!showClientList)}
                className="btn-primary inline-flex items-center px-4 py-2 rounded-lg"
                aria-label="Clients"
              >
                <FileText className="mr-2 h-5 w-5" />
                Clients ({clients.length})
              </button>
            </div>
          </div>
        </motion.div>

        {/* ChatGPT pane */}
        <div className="mb-6">
          <Card className="card-improved">
            <CardHeader>
              <CardTitle>Chat avec GPT</CardTitle>
              <CardDescription>Posez vos questions à l'assistant (model: gpt-3.5-turbo via server)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-48 overflow-y-auto p-2 bg-white/50 rounded">
                {chatMessages.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Aucune conversation pour le moment.</div>
                ) : (
                  chatMessages.map((m, i) => (
                    <div key={i} className={`p-2 rounded ${m.role === 'assistant' ? 'bg-slate-50' : 'bg-slate-100'} `}>
                      <div className="text-xs text-muted-foreground">{m.role}</div>
                      <div className="text-sm">{m.content}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 mt-3">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Écrivez un message pour GPT..."
                />
                <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}>
                  {chatLoading ? 'En cours...' : 'Envoyer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <AnimatePresence mode="wait">
          {showClientList ? (
            <motion.div
              key="clientlist"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-improved shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-foreground">
                    Base de Données Clients
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Recherchez un client par nom (texte ou voix)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Rechercher un client par nom..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      onClick={async () => {
                        if (isRecording) {
                          stopRecording();
                        } else {
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            const mediaRecorder = new MediaRecorder(stream);
                            mediaRecorderRef.current = mediaRecorder;
                            audioChunksRef.current = [];

                            mediaRecorder.ondataavailable = (event) => {
                              if (event.data.size > 0) {
                                audioChunksRef.current.push(event.data);
                              }
                            };

                            mediaRecorder.onstop = async () => {
                              const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                              await searchClientByVoice(audioBlob);
                              stream.getTracks().forEach((track) => track.stop());
                            };

                            mediaRecorder.start();
                            setIsRecording(true);
                          } catch (err) {
                            setError("Erreur d'accès au microphone");
                          }
                        }
                      }}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg"
                    >
                      <p className="text-sm text-destructive font-medium">{error}</p>
                    </motion.div>
                  )}

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {clients.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p>Aucun client enregistré pour le moment</p>
                        <p className="text-sm mt-2">Créez votre premier devis pour ajouter un client</p>
                      </div>
                    ) : (
                      clients
                        .filter(c => 
                          searchQuery === "" || 
                          c.nom.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((client) => (
                          <Card key={client.id} className="border-border hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <CardTitle className="text-lg">{client.nom}</CardTitle>
                                  <CardDescription className="text-sm mt-1">
                                    {client.email}
                                  </CardDescription>
                                  <CardDescription className="text-xs mt-1">
                                    {client.adresse}
                                  </CardDescription>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedClient(client);
                                  }}
                                  variant={selectedClient?.id === client.id ? "default" : "outline"}
                                >
                                  {selectedClient?.id === client.id ? "Sélectionné" : "Voir"}
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="flex gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  📄 {client.devis.length} devis
                                </span>
                                <span className="text-muted-foreground">
                                  🧾 {client.factures.length} factures
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </div>

                  {selectedClient && (
                    <div className="border-t border-border pt-6 mt-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-foreground">
                          Documents : {selectedClient.nom}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedClient(null)}
                        >
                          Fermer
                        </Button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Devis ({selectedClient.devis.length})
                          </h4>
                          {selectedClient.devis.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Aucun devis</p>
                          ) : (
                            selectedClient.devis.map((d) => (
                              <div key={d.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg mb-2 hover:bg-muted transition-colors">
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">{d.numero}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(d.date).toLocaleDateString("fr-FR")} • {d.total.toFixed(2)} € • 
                                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                      d.statut === "facturé" ? "bg-green-100 text-green-800" :
                                      d.statut === "accepté" ? "bg-blue-100 text-blue-800" :
                                      d.statut === "envoyé" ? "bg-yellow-100 text-yellow-800" :
                                      "bg-gray-100 text-gray-800"
                                    }`}>
                                      {d.statut}
                                    </span>
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setDevis(d);
                                    setShowClientList(false);
                                    setSelectedClient(null);
                                  }}
                                >
                                  Ouvrir
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Factures ({selectedClient.factures.length})
                          </h4>
                          {selectedClient.factures.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Aucune facture</p>
                          ) : (
                            selectedClient.factures.map((f) => (
                              <div key={f.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg mb-2 hover:bg-accent transition-colors">
                                <div className="flex-1">
                                  <p className="font-medium text-foreground">{f.numero}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(f.date).toLocaleDateString("fr-FR")} • {f.total.toFixed(2)} €
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setDevis(f);
                                    setShowClientList(false);
                                    setSelectedClient(null);
                                  }}
                                >
                                  Ouvrir
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowClientList(false);
                      setSelectedClient(null);
                      setSearchQuery("");
                    }}
                  >
                    Retour
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : !devis ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-improved shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl text-foreground">
                    Décrivez votre projet
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Choisissez votre mode de saisie préféré
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-3 justify-center">
                    <Button
                      onClick={() => setMode("text")}
                      className={`flex-1 max-w-xs ${mode === "text" ? 'btn-primary' : 'bg-white border border-gray-200'}`}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Mode Texte
                    </Button>
                    <Button
                      onClick={() => setMode("voice")}
                      className={`flex-1 max-w-xs ${mode === "voice" ? 'btn-primary' : 'bg-white border border-gray-200'}`}
                    >
                      <Mic className="mr-2 h-4 w-4" />
                      Mode Vocal
                    </Button>
                    <Button
                      onClick={() => {
                        if (!conversationMode) {
                          startConversationalAgent();
                        } else {
                          setConversationMode(false);
                          setConversationStatus("idle");
                        }
                      }}
                      className={`flex-1 max-w-xs ${conversationMode ? 'btn-primary' : 'bg-white border border-gray-200'}`}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Agent IA
                    </Button>
                  </div>

                  {conversationMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg"
                    >
                      <div className="text-center mb-4">
                        <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                          conversationStatus === "connected" ? "bg-green-500 text-white" :
                          conversationStatus === "connecting" ? "bg-yellow-500 text-white" :
                          "bg-gray-500 text-white"
                        }`}>
                          {conversationStatus === "connected" ? "🟢 Agent Connecté" :
                           conversationStatus === "connecting" ? "🟡 Connexion..." :
                           "⚪ Non Connecté"}
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
                        {transcript.length === 0 ? (
                          <p className="text-center text-muted-foreground text-sm">
                            Parlez avec l'agent pour créer des devis, factures ou rechercher des clients
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {transcript.map((msg, idx) => (
                              <div key={idx} className={`text-sm ${msg.startsWith("Utilisateur:") ? "text-blue-600 font-medium" : "text-purple-600"}`}>
                                {msg}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-center text-xs text-muted-foreground">
                        <p className="font-semibold mb-2">Commandes vocales :</p>
                        <p>• "Crée un devis pour..."</p>
                        <p>• "Transforme en facture"</p>
                        <p>• "Cherche le client Monsieur Dupont"</p>
                        <p>• "Montre les factures de..."</p>
                      </div>
                    </motion.div>
                  )}

                  {mode === "text" ? (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-4"
                    >
                      <div>
                        <Label htmlFor="description" className="text-foreground">
                          Description du projet
                        </Label>
                        <Textarea
                          id="description"
                          placeholder="Ex: Je souhaite un site web vitrine pour mon restaurant avec 5 pages, design moderne, formulaire de contact et intégration Google Maps..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          className="min-h-[200px] mt-2"
                          disabled={isProcessing}
                        />
                      </div>
                      <Button
                        onClick={handleTextSubmit}
                        disabled={!textInput.trim() || isProcessing}
                        className="btn-primary w-full"
                        size="lg"
                      >
                        {isProcessing ? (
                          <>
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                            Génération en cours...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Générer le devis
                          </>
                        )}
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col items-center justify-center py-12 space-y-6">
                        <motion.div
                          animate={
                            isRecording
                              ? {
                                  scale: [1, 1.1, 1],
                                  boxShadow: [
                                    "0 0 0 0 rgba(239, 68, 68, 0.4)",
                                    "0 0 0 20px rgba(239, 68, 68, 0)",
                                    "0 0 0 0 rgba(239, 68, 68, 0)",
                                  ],
                                }
                              : {}
                          }
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          <Button
                            size="lg"
                            variant={isRecording ? "destructive" : "default"}
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isProcessing}
                            className="h-32 w-32 rounded-full text-lg"
                          >
                            {isRecording ? (
                              <MicOff className="h-12 w-12" />
                            ) : (
                              <Mic className="h-12 w-12" />
                            )}
                          </Button>
                        </motion.div>
                        <div className="text-center space-y-2">
                          <p className="text-lg font-semibold text-foreground">
                            {isRecording
                              ? "Enregistrement en cours..."
                              : isProcessing
                              ? "Traitement en cours..."
                              : "Cliquez pour parler"}
                          </p>
                          <p className="text-sm text-muted-foreground max-w-md">
                            {isRecording
                              ? "Décrivez votre projet clairement. Cliquez à nouveau pour arrêter."
                              : "Appuyez sur le bouton et décrivez votre projet de devis"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg"
                    >
                      <p className="text-sm text-destructive font-medium">{error}</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="devis"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="card-improved shadow-xl">
                <CardHeader className="bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-3xl text-foreground">
                        {devis.type === "facture" ? "Facture" : "Devis"} Généré
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {devis.type === "facture" 
                          ? "Votre facture professionnelle est prête" 
                          : "Votre devis professionnel est prêt"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {devis.type === "devis" && devis.statut !== "facturé" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={transformDevisToFacture}
                          className="bg-primary"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Transformer en Facture
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveDevisToClient}
                        className="border-border"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Sauvegarder
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadPDF}
                        className="border-border"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Imprimer PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewDevis}
                        className="border-border"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Nouveau
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6" id="devis-content">
                  <div className="space-y-6">
                    {/* En-tête EXACT comme l'image */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <img src="https://placehold.co/100x80?text=ABELLO+LOGO" alt="Logo Abello showing blue house icon with company branding" className="mb-2" />
                        <img src="https://placehold.co/100x80?text=RGE+QUALIBAT" alt="RGE Qualibat certification logo with blue accreditation badge" className="mb-3" />
                        <div className="text-xs leading-tight text-blue-600">
                          <p className="font-bold">3 rue Pierre Séguier 34500 Béziers</p>
                          <p className="text-black">Port : 06 63 52 57 06</p>
                          <p className="text-black">Email : sarldouz@hotmail.fr</p>
                          <p className="text-black">sarldouz.fr</p>
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-sm font-bold leading-tight">PEINTURE GÉNÉRALE - ENDUITS MONOCOUCHE - RAVALEMENT DE FAÇADE</p>
                        <p className="text-sm font-bold mt-3">NEUF & RÉNOVATION - ISOLATION PAR L'EXTÉRIEUR</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="border-2 border-black text-center py-3 mb-3">
                          <p className="text-2xl font-bold tracking-[0.5em]">D E V I S</p>
                        </div>
                        <p className="text-sm mb-3">Date : <span className="font-bold">{new Date(devis.date).toLocaleDateString("fr-FR", {day: '2-digit', month: '2-digit', year: 'numeric'})}</span></p>
                        <div className="border-2 border-black p-3 text-left" style={{minHeight: '70px'}}>
                          <p className="font-bold text-sm">{devis.client.nom}</p>
                          <p className="text-xs mt-4">34500 Béziers</p>
                        </div>
                      </div>
                    </div>

                    {/* Objet */}
                    <div className="mb-3 text-sm">
                      <span className="font-semibold">Objet :</span> Façade Chantier médiathèque Puisserguier
                    </div>

                    {/* Grand tableau comme dans l'image */}
                    <table className="w-full border-2 border-black">
                      <thead>
                        <tr className="bg-white">
                          <th className="border border-black p-2 text-xs font-bold">Désignation</th>
                          <th className="border border-black p-2 text-xs font-bold w-16">U.</th>
                          <th className="border border-black p-2 text-xs font-bold w-20">Qté</th>
                          <th className="border border-black p-2 text-xs font-bold w-24">P.U.</th>
                          <th className="border border-black p-2 text-xs font-bold w-28">Prix H.T.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devis.items.map((item, index) => (
                          <tr key={index}>
                            <td className="border border-black p-2 text-xs align-top">{item.description}</td>
                            <td className="border border-black p-2 text-xs text-center align-top">m²</td>
                            <td className="border border-black p-2 text-xs text-center align-top">{item.quantity.toFixed(2).replace('.', ',')}</td>
                            <td className="border border-black p-2 text-xs text-right align-top">{item.unitPrice.toFixed(2).replace('.', ',')} €</td>
                            <td className="border border-black p-2 text-xs text-right align-top font-semibold">{item.total.toFixed(2).replace('.', ',')} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Section bas : conditions à gauche, totaux à droite */}
                    <div className="flex justify-between items-start mt-3">
                      <div className="flex-1 text-xs text-blue-600">
                        <p className="font-semibold mb-1">Conditions :</p>
                        <p>Acompte de 30 % à la commande, solde à la fin des travaux.</p>
                        <p>Validité du devis 1 mois.</p>
                      </div>
                      <div className="w-96">
                        <div className="flex border border-black bg-gray-200">
                          <div className="flex-1 p-2 text-xs font-bold text-right border-r border-black bg-gray-200">Montant H.T.</div>
                          <div className="w-36 p-2 text-xs font-bold text-right bg-white">{devis.sousTotal.toFixed(2).replace('.', ',')} €</div>
                        </div>
                        <div className="flex border border-black border-t-0 bg-gray-200">
                          <div className="flex-1 p-2 text-xs font-bold text-right border-r border-black bg-gray-200">TVA AUTO LIQUIDATION</div>
                          <div className="w-36 p-2 text-xs font-bold text-right bg-white"></div>
                        </div>
                        <div className="flex border border-black border-t-0 bg-gray-200">
                          <div className="flex-1 p-2 text-xs font-bold text-right border-r border-black bg-gray-200">Montant T.T.C</div>
                          <div className="w-36 p-2 text-xs font-bold text-right bg-white">{devis.total.toFixed(2).replace('.', ',')} €</div>
                        </div>
                      </div>
                    </div>

                    {/* Footer légal */}
                    <div className="mt-6 pt-3 border-t border-black text-center text-xs">
                      <p>SARL au capital de 8000€ - Siret : 509 043 246 000 16 - APE : 4334Z - TVA INTRACOM : FR 655 090 432 49</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
