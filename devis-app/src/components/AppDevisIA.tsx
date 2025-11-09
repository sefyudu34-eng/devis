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
    <div className="app-container">
      <div className="card">
        <Card>
          <CardHeader>
            <CardTitle>Assistant de création de devis</CardTitle>
            <CardDescription>
              Générez des devis rapidement avec l'aide de l'IA
            </CardDescription>
          </CardHeader>

          <CardContent className="card-content">
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* Sélection du mode */}
            <div className="button-group">
              <button
                className={`mode-button ${mode === 'text' ? 'active' : ''}`}
                onClick={() => setMode("text")}
              >
                <MessageSquare className="icon" />
                Mode Texte
              </button>
              <button
                className={`mode-button ${mode === 'voice' ? 'active' : ''}`}
                onClick={() => setMode("voice")}
              >
                <Mic className="icon" />
                Mode Vocal
              </button>
            </div>

            {/* Zone de saisie */}
            <div className="input-container">
              {mode === "text" ? (
                <>
                  <textarea
                    className="textarea"
                    placeholder="Décrivez le devis que vous souhaitez générer..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                  <button
                    className={`button button-primary ${(!textInput.trim() || isProcessing) ? 'disabled' : ''}`}
                    onClick={() => generateDevis(textInput)}
                    disabled={!textInput.trim() || isProcessing}
                  >
                    <Send className="icon" />
                    {isProcessing ? "Génération..." : "Générer"}
                  </button>
                </>
              ) : (
                <button
                  className={`button ${isRecording ? 'button-record-active' : 'button-primary'}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="icon" />
                      Arrêter l'enregistrement
                    </>
                  ) : (
                    <>
                      <Mic className="icon" />
                      Commencer l'enregistrement
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Recherche de clients */}
            <div className="input-container">
              <div className="search-bar">
                <input
                  type="text"
                  className="input"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  className="button button-outline"
                  onClick={() => setShowClientList(true)}
                >
                  <FileText className="icon" />
                </button>
              </div>

              {showClientList && (
                <div className="client-list">
                  <div className="client-list-header">
                    <h3>Liste des clients</h3>
                    <button
                      className="button button-outline"
                      onClick={() => setShowClientList(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="client-list-content">
                    {clients
                      .filter((client) =>
                        client.nom.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((client) => (
                        <div
                          key={client.id}
                          className="client-item"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientList(false);
                          }}
                        >
                          <div className="client-name">{client.nom}</div>
                          <div className="client-email">{client.email}</div>
                          <div className="client-stats">
                            {client.devis.length} devis, {client.factures.length} factures
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedClient && (
                <div className="selected-client">
                  <div className="selected-client-content">
                    <div>
                      <h3 className="client-name">{selectedClient.nom}</h3>
                      <p className="client-email">{selectedClient.email}</p>
                      <p className="client-address">{selectedClient.adresse}</p>
                    </div>
                    <button
                      className="button button-outline"
                      onClick={() => setSelectedClient(null)}
                    >
                      ✕
                    </button>
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