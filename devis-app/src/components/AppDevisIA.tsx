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
    <div style={{ 
      minHeight: '100vh',
      padding: '24px',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}>
        <div style={{
          padding: '24px',
          textAlign: 'center',
          background: 'linear-gradient(to right, #2563eb, #1d4ed8)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          color: 'white'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>Assistant de création de devis</h1>
          <p style={{
            fontSize: '16px',
            opacity: '0.9'
          }}>Générez des devis rapidement avec l'aide de l'IA</p>
        </div>

          <div style={{ padding: '24px' }}>
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            {/* Sélection du mode */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setMode("text")}
                style={{
                  padding: '12px 24px',
                  backgroundColor: mode === 'text' ? '#2563eb' : 'white',
                  color: mode === 'text' ? 'white' : '#1f2937',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <MessageSquare size={16} />
                Mode Texte
              </button>
              <button
                onClick={() => setMode("voice")}
                style={{
                  padding: '12px 24px',
                  backgroundColor: mode === 'voice' ? '#2563eb' : 'white',
                  color: mode === 'voice' ? 'white' : '#1f2937',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Mic size={16} />
                Mode Vocal
              </button>
            </div>

            {/* Zone de saisie */}
            <div style={{ marginBottom: '24px' }}>
              {mode === "text" ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <textarea
                    placeholder="Décrivez le devis que vous souhaitez générer..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '120px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      resize: 'none',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    onClick={() => generateDevis(textInput)}
                    disabled={!textInput.trim() || isProcessing}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: (!textInput.trim() || isProcessing) ? '#9ca3af' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (!textInput.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Send size={16} />
                    {isProcessing ? "Génération..." : "Générer"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    padding: '12px 24px',
                    backgroundColor: isRecording ? '#dc2626' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isRecording ? (
                    <>
                      <MicOff size={16} />
                      Arrêter l'enregistrement
                    </>
                  ) : (
                    <>
                      <Mic size={16} />
                      Commencer l'enregistrement
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Recherche de clients */}
            <div>
              <div style={{ 
                display: 'flex',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}
                />
                <button
                  onClick={() => setShowClientList(true)}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileText size={16} />
                </button>
              </div>

              {showClientList && (
                <div style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginTop: '8px'
                }}>
                  <div style={{
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h3 style={{ fontWeight: '600', color: '#1f2937' }}>Liste des clients</h3>
                    <button
                      onClick={() => setShowClientList(false)}
                      style={{
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6b7280'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    {clients
                      .filter((client) =>
                        client.nom.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((client) => (
                        <div
                          key={client.id}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid #e5e7eb',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientList(false);
                          }}
                        >
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>{client.nom}</div>
                          <div style={{ fontSize: '14px', color: '#6b7280' }}>{client.email}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                            {client.devis.length} devis, {client.factures.length} factures
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {selectedClient && (
                <div style={{
                  marginTop: '16px',
                  padding: '16px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #2563eb'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start'
                  }}>
                    <div>
                      <h3 style={{ fontWeight: '600', color: '#1e3a8a' }}>{selectedClient.nom}</h3>
                      <p style={{ fontSize: '14px', color: '#1d4ed8' }}>{selectedClient.email}</p>
                      <p style={{ fontSize: '14px', color: '#1d4ed8', marginTop: '4px' }}>{selectedClient.adresse}</p>
                    </div>
                    <button
                      onClick={() => setSelectedClient(null)}
                      style={{
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#1d4ed8'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
        </Card>
      </div>
    </div>
  );
}