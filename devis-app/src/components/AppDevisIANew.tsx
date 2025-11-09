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

// ... (garder les interfaces existantes)

export default function AppDevisIA() {
  // ... (garder tous les états existants)

  // Render
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Card className="w-full shadow-lg">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl font-bold mb-2">Assistant de création de devis</CardTitle>
            <CardDescription className="text-lg">Générez des devis rapidement avec l'aide de l'IA</CardDescription>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-xl mx-auto">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-md mb-4 text-center">
                  {error}
                </div>
              )}

              {/* Mode selection */}
              <div className="flex justify-center gap-4 mb-6">
                <Button
                  variant={mode === "text" ? "default" : "outline"}
                  onClick={() => setMode("text")}
                  className="flex-1 max-w-[200px]"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Mode Texte
                </Button>
                <Button
                  variant={mode === "voice" ? "default" : "outline"}
                  onClick={() => setMode("voice")}
                  className="flex-1 max-w-[200px]"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Mode Vocal
                </Button>
              </div>

              {/* Input section */}
              <div className="space-y-4">
                {mode === "text" ? (
                  <div className="flex flex-col items-center gap-4">
                    <Textarea
                      placeholder="Décrivez le devis que vous souhaitez générer..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      className="w-full min-h-[100px] text-center"
                    />
                    <Button
                      onClick={() => generateDevis(textInput)}
                      disabled={!textInput.trim() || isProcessing}
                      className="w-full max-w-[200px]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isProcessing ? "Génération..." : "Générer"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                      variant={isRecording ? "destructive" : "default"}
                      className="w-full max-w-[200px]"
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
                  </div>
                )}
              </div>

              {/* Search Clients */}
              <div className="mt-8 space-y-4">
                <Label htmlFor="search" className="text-center block">Rechercher un client</Label>
                <div className="flex gap-2">
                  <Input
                    id="search"
                    type="text"
                    placeholder="Nom du client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => setShowClientList(true)}
                    variant="outline"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Client List */}
              {showClientList && (
                <div className="mt-4 bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">Liste des clients</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowClientList(false)}
                    >
                      ✕
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {clients
                      .filter(client =>
                        client.nom.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(client => (
                        <div
                          key={client.id}
                          className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowClientList(false);
                          }}
                        >
                          <div className="font-medium">{client.nom}</div>
                          <div className="text-sm text-gray-500">{client.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {client.devis.length} devis, {client.factures.length} factures
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Selected Client Info */}
              {selectedClient && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{selectedClient.nom}</h3>
                      <p className="text-sm text-gray-500">{selectedClient.email}</p>
                      <p className="text-sm text-gray-500">{selectedClient.adresse}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClient(null)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Devis Preview */}
            {devis && (
              <div className="w-full max-w-4xl mt-8 bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">
                    {devis.type === "devis" ? "Devis" : "Facture"} n°{devis.numero}
                  </h2>
                  <div className="space-x-2">
                    <Button onClick={handleDownloadPDF} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button onClick={() => transformDevisToFacture()} variant="outline">
                      <Edit className="w-4 h-4 mr-2" />
                      Transformer en facture
                    </Button>
                  </div>
                </div>
                {/* ... reste du contenu du devis ... */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}