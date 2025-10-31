import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Trash2, Volume2 } from "lucide-react";

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  description?: string;
}

interface ScheduleCardProps {
  item: ScheduleItem;
  onDelete: (id: string) => void;
  onSpeak: (text: string) => void;
}

export const ScheduleCard = ({ item, onDelete, onSpeak }: ScheduleCardProps) => {
  return (
    <Card className="p-4 transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="w-6 h-6 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-card-foreground mb-1">{item.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{item.time}</p>
          {item.description && (
            <p className="text-sm text-card-foreground">{item.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSpeak(`${item.title} at ${item.time}. ${item.description || ''}`)}
            aria-label="Speak schedule"
          >
            <Volume2 className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            aria-label="Delete schedule"
          >
            <Trash2 className="w-5 h-5 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
