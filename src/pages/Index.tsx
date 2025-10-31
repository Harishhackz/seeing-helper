import { useState, useEffect } from "react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { VoiceInput } from "@/components/VoiceInput";
import { AddScheduleDialog } from "@/components/AddScheduleDialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, Calendar } from "lucide-react";

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  description?: string;
}

const Index = () => {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    {
      id: "1",
      title: "Morning Medicine",
      time: "08:00",
      description: "Take blood pressure medication with water",
    },
    {
      id: "2",
      title: "Lunch Reminder",
      time: "12:30",
      description: "Time for lunch",
    },
  ]);
  const [isListening, setIsListening] = useState(false);

  // Text-to-speech function
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } else {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser",
        variant: "destructive",
      });
    }
  };

  // Speech recognition setup
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      toast({
        title: "Listening",
        description: "Speak now...",
      });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      toast({
        title: "You said:",
        description: transcript,
      });
      speak(`You said: ${transcript}`);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast({
        title: "Error",
        description: "Could not recognize speech. Please try again.",
        variant: "destructive",
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const addSchedule = (title: string, time: string, description?: string) => {
    const newSchedule: ScheduleItem = {
      id: Date.now().toString(),
      title,
      time,
      description,
    };
    setSchedules([...schedules, newSchedule]);
    toast({
      title: "Schedule Added",
      description: `${title} at ${time}`,
    });
    speak(`Schedule added: ${title} at ${time}`);
  };

  const deleteSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
    toast({
      title: "Schedule Deleted",
      description: "The schedule has been removed",
    });
  };

  // Check for due schedules every minute
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      schedules.forEach(schedule => {
        if (schedule.time === currentTime) {
          const message = `Reminder: ${schedule.title}. ${schedule.description || ''}`;
          toast({
            title: "⏰ Schedule Reminder",
            description: schedule.title,
            duration: 10000,
          });
          speak(message);
        }
      });
    };

    const interval = setInterval(checkSchedules, 60000);
    return () => clearInterval(interval);
  }, [schedules]);

  // Welcome message
  useEffect(() => {
    setTimeout(() => {
      speak("Welcome to Sight Mare. Your personal assistant for daily schedules.");
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/70 mb-4 shadow-[var(--shadow-medium)]">
            <Eye className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">Sight Mare</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your voice-powered daily assistant for managing schedules and reminders
          </p>
        </header>

        {/* Add Schedule Button */}
        <div className="flex justify-center mb-8">
          <AddScheduleDialog onAdd={addSchedule} />
        </div>

        {/* Schedules Section */}
        <section className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">Your Schedules</h2>
          </div>
          
          {schedules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No schedules yet. Add your first one!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  item={schedule}
                  onDelete={deleteSchedule}
                  onSpeak={speak}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Voice Input */}
      <VoiceInput
        onTranscript={(text) => console.log(text)}
        isListening={isListening}
        onToggleListening={toggleListening}
      />
    </div>
  );
};

export default Index;
