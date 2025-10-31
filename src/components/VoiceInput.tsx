import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isListening: boolean;
  onToggleListening: () => void;
}

export const VoiceInput = ({ onTranscript, isListening, onToggleListening }: VoiceInputProps) => {
  const { toast } = useToast();

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <Button
        size="icon-lg"
        variant="voice"
        onClick={onToggleListening}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        className={isListening ? "animate-pulse" : ""}
      >
        {isListening ? (
          <MicOff className="w-8 h-8" />
        ) : (
          <Mic className="w-8 h-8" />
        )}
      </Button>
    </div>
  );
};
