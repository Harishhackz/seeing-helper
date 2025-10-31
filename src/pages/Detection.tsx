import { ObjectDetection } from "@/components/ObjectDetection";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Detection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Back to home"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-[var(--shadow-soft)]">
              <Eye className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Object Detection</h1>
              <p className="text-sm text-muted-foreground">AI-powered visual assistance</p>
            </div>
          </div>
        </div>

        {/* Detection Component */}
        <div className="max-w-3xl mx-auto">
          <ObjectDetection />
        </div>
      </div>
    </div>
  );
};

export default Detection;
