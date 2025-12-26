import { useState, useEffect } from "react";
import { ScheduleCard } from "@/components/ScheduleCard";
import { VoiceInput } from "@/components/VoiceInput";
import { AddScheduleDialog } from "@/components/AddScheduleDialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, Calendar, Camera, Navigation2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  description?: string;
  reminderMinutes?: number; // Minutes before to remind (default 10)
  reminded?: boolean; // Track if advance reminder was given
  notified?: boolean; // Track if exact time notification was given
}

const Index = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    {
      id: "1",
      title: "Morning Medicine",
      time: "08:00",
      description: "Take blood pressure medication with water",
      reminderMinutes: 10,
    },
    {
      id: "2",
      title: "Lunch Reminder",
      time: "12:30",
      description: "Time for lunch",
      reminderMinutes: 10,
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

  // Parse voice command to extract schedule details
  const parseAndAddSchedule = (transcript: string) => {
    // Extract time from speech (e.g., "8 AM", "10:30 PM", "at 3", "at 15:00")
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
      /(\d{1,2})\s*(am|pm)/i,
      /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    ];
    
    let hours = 9; // default
    let minutes = 0;
    let timeFound = false;
    
    for (const pattern of timePatterns) {
      const match = transcript.match(pattern);
      if (match) {
        hours = parseInt(match[1]);
        minutes = match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 0;
        const period = match[3]?.toLowerCase();
        
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        timeFound = true;
        break;
      }
    }
    
    // Extract reminder time from speech (e.g., "remind me 5 minutes before", "10 minutes early")
    let reminderMinutes = 10; // default 10 minutes
    const reminderPatterns = [
      /(\d+)\s*minutes?\s*(?:before|early|ahead)/i,
      /remind\s*(?:me)?\s*(\d+)\s*minutes?/i,
    ];
    
    for (const pattern of reminderPatterns) {
      const match = transcript.match(pattern);
      if (match) {
        reminderMinutes = parseInt(match[1]);
        break;
      }
    }
    
    // Extract title - remove common phrases and time references
    let title = transcript
      .replace(/add schedule|schedule|remind me to|remind me|set reminder for|set reminder|at\s+\d{1,2}(:\d{2})?\s*(am|pm)?|\d{1,2}(:\d{2})?\s*(am|pm)?|\d+\s*minutes?\s*(?:before|early|ahead)|remind\s*(?:me)?\s*\d+\s*minutes?/gi, '')
      .trim();
    
    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    if (!title || title.length < 2) {
      title = "New Reminder";
    }
    
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    addSchedule(title, timeString, undefined, reminderMinutes);
    
    if (timeFound) {
      speak(`Schedule added: ${title} at ${formatTime(timeString)}. I will remind you ${reminderMinutes} minutes before.`);
    } else {
      speak(`Schedule added: ${title} at 9 AM with ${reminderMinutes} minute reminder. Say a time like 8 AM or 3 PM to set a specific time.`);
    }
  };

  // Format time for speech
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return minutes > 0 ? `${displayHours}:${String(minutes).padStart(2, '0')} ${period}` : `${displayHours} ${period}`;
  };

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks after getting permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      if (error.name === 'NotAllowedError') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser settings and reload the page.",
          variant: "destructive",
          duration: 10000,
        });
        speak("Microphone access was denied. Please allow microphone access in your browser settings.");
      } else if (error.name === 'NotFoundError') {
        toast({
          title: "No Microphone Found",
          description: "Please connect a microphone and try again.",
          variant: "destructive",
        });
        speak("No microphone was found. Please connect a microphone.");
      } else {
        toast({
          title: "Microphone Error",
          description: "Could not access microphone. Please check your device settings.",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  // Speech recognition setup
  const toggleListening = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Try Chrome or Edge.",
        variant: "destructive",
      });
      speak("Speech recognition is not supported in your browser. Please try Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    // Request microphone permission first
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
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
        title: "🎤 Listening",
        description: "Speak now... Say 'remind me to [task] at [time]'",
      });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      toast({
        title: "You said:",
        description: transcript,
      });
      
      // Parse voice command to add schedule
      if (transcript.includes("add") || transcript.includes("schedule") || transcript.includes("remind") || transcript.includes("set")) {
        parseAndAddSchedule(transcript);
      } else {
        speak(`You said: ${transcript}. To add a schedule, say something like: remind me to take medicine at 8 AM.`);
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      let errorMessage = "Could not recognize speech. Please try again.";
      let errorTitle = "Recognition Error";
      
      switch (event.error) {
        case 'audio-capture':
          errorTitle = "Microphone Error";
          errorMessage = "Could not capture audio. Please check your microphone is connected and allowed.";
          break;
        case 'not-allowed':
          errorTitle = "Permission Denied";
          errorMessage = "Microphone access denied. Please allow microphone in browser settings.";
          break;
        case 'no-speech':
          errorTitle = "No Speech Detected";
          errorMessage = "No speech was detected. Please try speaking again.";
          break;
        case 'network':
          errorTitle = "Network Error";
          errorMessage = "Network error occurred. Please check your internet connection.";
          break;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      });
      speak(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const addSchedule = (title: string, time: string, description?: string, reminderMinutes: number = 10) => {
    const newSchedule: ScheduleItem = {
      id: Date.now().toString(),
      title,
      time,
      description,
      reminderMinutes,
      reminded: false,
      notified: false,
    };
    setSchedules([...schedules, newSchedule]);
    toast({
      title: "Schedule Added",
      description: `${title} at ${time} (${reminderMinutes}min reminder)`,
    });
  };

  const deleteSchedule = (id: string) => {
    setSchedules(schedules.filter(s => s.id !== id));
    toast({
      title: "Schedule Deleted",
      description: "The schedule has been removed",
    });
  };

  // Check for due schedules every 30 seconds for more accurate reminders
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      
      let hasUpdates = false;
      const updatedSchedules = schedules.map(schedule => {
        const [scheduleHours, scheduleMinutes] = schedule.time.split(':').map(Number);
        const scheduleDate = new Date();
        scheduleDate.setHours(scheduleHours, scheduleMinutes, 0, 0);
        
        const timeDiffMs = scheduleDate.getTime() - now.getTime();
        const timeDiffMinutes = Math.floor(timeDiffMs / (1000 * 60));
        const reminderMinutes = schedule.reminderMinutes || 10;
        
        // Advance reminder (X minutes before)
        if (!schedule.reminded && timeDiffMinutes > 0 && timeDiffMinutes <= reminderMinutes) {
          const message = `Reminder: ${schedule.title} is coming up in ${timeDiffMinutes} minute${timeDiffMinutes !== 1 ? 's' : ''}.`;
          toast({
            title: `⏰ Upcoming in ${timeDiffMinutes} min`,
            description: schedule.title,
            duration: 10000,
          });
          speak(message);
          hasUpdates = true;
          return { ...schedule, reminded: true };
        }
        
        // Exact time reminder (within 1 minute window)
        if (!schedule.notified && timeDiffMinutes <= 0 && timeDiffMinutes > -2) {
          const message = `It's time for: ${schedule.title}. ${schedule.description || ''}`;
          toast({
            title: "🔔 Schedule Now!",
            description: schedule.title,
            duration: 15000,
          });
          speak(message);
          hasUpdates = true;
          return { ...schedule, notified: true };
        }
        
        return schedule;
      });
      
      if (hasUpdates) {
        setSchedules(updatedSchedules);
      }
    };

    // Check immediately on load
    checkSchedules();
    
    // Check every 30 seconds for more precise reminders
    const interval = setInterval(checkSchedules, 30000);
    return () => clearInterval(interval);
  }, [schedules, toast]);

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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <AddScheduleDialog onAdd={addSchedule} />
          <Button
            variant="hero"
            size="lg"
            onClick={() => navigate("/detection")}
            className="gap-2"
          >
            <Camera className="w-5 h-5" />
            Object Detection
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={() => navigate("/navigation")}
            className="gap-2"
          >
            <Navigation2 className="w-5 h-5" />
            GPS Navigation
          </Button>
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
