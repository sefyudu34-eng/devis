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
      // Logique pour la génération de facture
    }
  };

  // Ajoutez ici les autres fonctions nécessaires

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Assistant Devis IA</h1>
      {/* Ajoutez ici le reste de votre interface utilisateur */}
    </div>
  );
}