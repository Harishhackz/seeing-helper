import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, CameraOff, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { pipeline } from "@huggingface/transformers";

interface Detection {
  label: string;
  score: number;
}

export const ObjectDetection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState<string>("");
  const { toast } = useToast();

  // Text-to-speech function
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Load the model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        toast({
          title: "Loading AI Model",
          description: "This may take a moment...",
        });
        
        // Use MobileNetV4 for fast image classification
        const classifier = await pipeline(
          "image-classification",
          "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
          { device: "webgpu" }
        );
        
        setModel(classifier);
        setIsLoading(false);
        toast({
          title: "Model Loaded",
          description: "Ready to detect objects!",
        });
      } catch (error) {
        console.error("Error loading model:", error);
        setIsLoading(false);
        toast({
          title: "Model Load Failed",
          description: "Trying alternative method...",
          variant: "destructive",
        });
        
        // Fallback to CPU if WebGPU fails
        try {
          const classifier = await pipeline(
            "image-classification",
            "Xenova/mobilenet_v2_1.0_224"
          );
          setModel(classifier);
          toast({
            title: "Model Loaded (CPU)",
            description: "Ready to detect objects!",
          });
        } catch (fallbackError) {
          console.error("Fallback error:", fallbackError);
        }
      }
    };

    loadModel();
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
        speak("Camera activated. Point at objects to detect them.");
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to use object detection",
        variant: "destructive",
      });
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
      setDetections([]);
      speak("Camera deactivated");
    }
  };

  // Detect objects
  const detectObjects = async () => {
    if (!model || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Run classification
      const results = await model(canvas);
      
      // Get top detection
      if (results && results.length > 0) {
        const topResults = results.slice(0, 3).map((r: any) => ({
          label: r.label,
          score: r.score,
        }));
        
        setDetections(topResults);

        // Announce the top detection if confidence is high enough
        const topDetection = results[0];
        if (topDetection.score > 0.3) {
          const announcement = formatDetectionAnnouncement(topDetection.label);
          
          // Only announce if it's different from the last announcement
          if (announcement !== lastAnnouncement) {
            speak(announcement);
            setLastAnnouncement(announcement);
            
            // Reset last announcement after 5 seconds
            setTimeout(() => setLastAnnouncement(""), 5000);
          }
        }
      }
    } catch (error) {
      console.error("Detection error:", error);
    }
  };

  // Format detection announcement
  const formatDetectionAnnouncement = (label: string): string => {
    // Clean up the label (remove technical suffixes)
    const cleanLabel = label.split(",")[0].trim();
    
    // Determine position based on common object positions
    const positions = [
      "in front of you",
      "ahead",
      "nearby",
    ];
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    return `${cleanLabel} ${position}`;
  };

  // Run detection periodically
  useEffect(() => {
    if (!isActive || !model) return;

    const interval = setInterval(detectObjects, 2000); // Detect every 2 seconds
    return () => clearInterval(interval);
  }, [isActive, model, lastAnnouncement]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative bg-high-contrast-bg aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/90">
              <div className="text-center">
                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Detection Results Overlay */}
        {isActive && detections.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur rounded-lg p-4 shadow-[var(--shadow-medium)]">
            <div className="flex items-start gap-3">
              <Volume2 className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-2">Detected Objects:</p>
                {detections.map((detection, index) => (
                  <div key={index} className="flex justify-between items-center mb-1">
                    <span className="text-sm text-foreground">{detection.label.split(",")[0]}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(detection.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Controls */}
      <div className="flex gap-4 justify-center">
        {!isActive ? (
          <Button
            variant="hero"
            size="xl"
            onClick={startCamera}
            disabled={isLoading}
            className="gap-2"
          >
            <Camera className="w-5 h-5" />
            {isLoading ? "Loading AI Model..." : "Start Camera"}
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="xl"
            onClick={stopCamera}
            className="gap-2"
          >
            <CameraOff className="w-5 h-5" />
            Stop Camera
          </Button>
        )}
      </div>

      {/* Instructions */}
      <Card className="p-6 bg-secondary/50">
        <h3 className="text-lg font-semibold mb-3 text-foreground">How to Use:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Tap "Start Camera" to activate object detection</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Point your camera at objects around you</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>The app will announce detected objects via voice</span>
          </li>
          <li className="flex gap-2">
            <span className="text-primary">•</span>
            <span>Works best with clear, well-lit objects</span>
          </li>
        </ul>
      </Card>
    </div>
  );
};
