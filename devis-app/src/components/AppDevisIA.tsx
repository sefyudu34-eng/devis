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
import { twMerge } from "tailwind-merge";

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
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Commencer l'enregistrement
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
      setError("Erreur lors de l'accès au microphone");
    }
  };

  // Arrêter l'enregistrement
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Transcription de l'audio
  const transcribeAndGenerateDevis = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setError("");

      // Créez un objet FormData avec le fichier audio
      const formData = new FormData();
      formData.append("audio", audioBlob);

      // Envoyez l'audio au serveur pour transcription
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la transcription");
      }

      const data = await response.json();
      const transcription = data.text;

      // Utiliser la transcription pour générer le devis
      await generateDevis(transcription);
    } catch (err) {
      setError("Erreur lors de la transcription audio");
    } finally {
      setIsProcessing(false);
    }
  };

  // Générer le devis
  const generateDevis = async (prompt: string) => {
    try {
      setIsProcessing(true);
      setError("");

      // TODO: Implémenter la génération du devis

    } catch (err) {
      setError("Erreur lors de la génération du devis");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader className="text-center border-b pb-4 bg-gradient-to-r from-blue-600 to-blue-700">
            <CardTitle className="text-2xl font-bold text-white mb-2">Assistant de création de devis</CardTitle>
            <CardDescription className="text-lg text-slate-100">
              Générez des devis rapidement avec l'aide de l'IA
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg text-center">
                {error}
              </div>
            )}

            {/* Sélection du mode */}
            <div className="flex justify-center gap-4">
              <Button
                onClick={() => setMode("text")}
                variant={mode === "text" ? "default" : "outline"}
                className="flex-1 max-w-[200px]"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Mode Texte
              </Button>
              <Button
                onClick={() => setMode("voice")}
                variant={mode === "voice" ? "default" : "outline"}
                className="flex-1 max-w-[200px]"
              >
                <Mic className="w-4 h-4 mr-2" />
                Mode Vocal
              </Button>
            </div>

            {/* Zone de saisie */}
            <div className="space-y-4">
              {mode === "text" ? (
                <>
                  <Textarea
                    placeholder="Décrivez le devis que vous souhaitez générer..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="min-h-[120px] text-center resize-none"
                  />
                  <Button
                    onClick={() => generateDevis(textInput)}
                    disabled={!textInput.trim() || isProcessing}
                    className="w-full"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isProcessing ? "Génération..." : "Générer"}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  variant={isRecording ? "destructive" : "default"}
                  className="w-full"
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2" />
                      Arrêter l'enregistrement
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Commencer l'enregistrement
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Recherche de clients */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => setShowClientList(true)}
                  variant="outline"
                  size="icon"
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </div>

              {showClientList && (
                <div className="mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Liste des clients</h3>
                    <Button
                      onClick={() => setShowClientList(false)}
                      variant="ghost"
                      size="icon"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {clients
                      .filter((client) =>
                        client.nom.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((client) => (
                        <div
                          key={client.id}
                          className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-none"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientList(false);
                          }}
                        >
                          <div className="font-medium text-gray-900">{client.nom}</div>
                          <div className="text-sm text-gray-500">{client.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {client.devis.length} devis, {client.factures.length} factures
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedClient && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-blue-900">{selectedClient.nom}</h3>
                      <p className="text-sm text-blue-700">{selectedClient.email}</p>
                      <p className="text-sm text-blue-700 mt-1">{selectedClient.adresse}</p>
                    </div>
                    <Button
                      onClick={() => setSelectedClient(null)}
                      variant="ghost"
                      size="icon"
                      className="text-blue-700 hover:text-blue-800"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}