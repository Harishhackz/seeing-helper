import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Navigation2, Mic, MapPin, Locate, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RouteStep {
  instruction: string;
  distance: number;
  location: [number, number];
  announced: boolean;
}

const NavigationPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  
  const [mapboxToken, setMapboxToken] = useState('');
  const [isMapReady, setIsMapReady] = useState(false);
  const [destination, setDestination] = useState('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [directions, setDirections] = useState<string>('');
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Text-to-speech
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window && voiceEnabled) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  }, [voiceEnabled]);

  // Calculate distance between two coordinates in meters
  const getDistanceBetweenPoints = (
    coord1: [number, number],
    coord2: [number, number]
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (coord1[1] * Math.PI) / 180;
    const lat2 = (coord2[1] * Math.PI) / 180;
    const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Check if user is near a turn and announce it
  const checkAndAnnounceDirection = useCallback(
    (currentLocation: [number, number]) => {
      if (!isNavigating || routeSteps.length === 0 || !voiceEnabled) return;

      const currentStep = routeSteps[currentStepIndex];
      if (!currentStep || currentStep.announced) return;

      const distanceToNextTurn = getDistanceBetweenPoints(
        currentLocation,
        currentStep.location
      );

      // Announce when within 30 meters of the next turn
      if (distanceToNextTurn < 30) {
        speak(currentStep.instruction);
        
        // Mark as announced and move to next step
        setRouteSteps((prev) =>
          prev.map((step, idx) =>
            idx === currentStepIndex ? { ...step, announced: true } : step
          )
        );

        // Move to next step
        if (currentStepIndex < routeSteps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
          
          // Announce upcoming step distance
          const nextStep = routeSteps[currentStepIndex + 1];
          if (nextStep) {
            setTimeout(() => {
              const distanceText = nextStep.distance > 100 
                ? `In ${Math.round(nextStep.distance)} meters` 
                : 'Shortly';
              speak(`${distanceText}, ${nextStep.instruction}`);
            }, 3000);
          }
        } else {
          // Arrived at destination
          setTimeout(() => {
            speak("You have arrived at your destination.");
            setIsNavigating(false);
            toast({
              title: "🎉 Arrived!",
              description: "You have reached your destination",
            });
          }, 2000);
        }
      } else if (distanceToNextTurn < 50 && !currentStep.announced) {
        // Pre-announce when within 50 meters
        const preAnnouncement = `In ${Math.round(distanceToNextTurn)} meters, ${currentStep.instruction}`;
        speak(preAnnouncement);
      }
    },
    [isNavigating, routeSteps, currentStepIndex, voiceEnabled, speak, toast]
  );

  // Get user's current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      return;
    }

    setIsTracking(true);
    speak("Getting your current location");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserLocation([longitude, latitude]);
        
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 15,
          });

          // Add/update user marker
          if (userMarker.current) {
            userMarker.current.setLngLat([longitude, latitude]);
          } else {
            userMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        }

        toast({
          title: "Location Found",
          description: "Your current location is marked on the map",
        });
        speak("Location found. You are now on the map.");
      },
      (error) => {
        setIsTracking(false);
        toast({
          title: "Location Error",
          description: error.message,
          variant: "destructive",
        });
        speak("Could not get your location. Please enable location services.");
      },
      { enableHighAccuracy: true }
    );
  };

  // Watch position for continuous tracking and voice guidance
  useEffect(() => {
    let watchId: number;

    if (isTracking && isMapReady) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          const newLocation: [number, number] = [longitude, latitude];
          setUserLocation(newLocation);

          if (userMarker.current) {
            userMarker.current.setLngLat(newLocation);
          }

          // Check for turn-by-turn announcements
          if (isNavigating) {
            checkAndAnnounceDirection(newLocation);
          }

          // Keep map centered on user during navigation
          if (isNavigating && map.current) {
            map.current.easeTo({
              center: newLocation,
              duration: 500,
            });
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, isMapReady, isNavigating, checkAndAnnounceDirection]);

  // Search for destination
  const searchDestination = async (query: string) => {
    if (!query || !mapboxToken) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        const placeName = data.features[0].place_name;

        // Add destination marker
        if (destinationMarker.current) {
          destinationMarker.current.setLngLat([lng, lat]);
        } else if (map.current) {
          destinationMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .addTo(map.current);
        }

        map.current?.flyTo({
          center: [lng, lat],
          zoom: 14,
        });

        toast({
          title: "Destination Found",
          description: placeName,
        });
        speak(`Destination set to ${placeName}`);

        // Get directions if user location is available
        if (userLocation) {
          getDirections(userLocation, [lng, lat]);
        }
      } else {
        toast({
          title: "Not Found",
          description: "Could not find that location",
          variant: "destructive",
        });
        speak("Could not find that location. Please try again.");
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search for location",
        variant: "destructive",
      });
    }
  };

  // Get directions between two points
  const getDirections = async (start: [number, number], end: [number, number]) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&voice_instructions=true&access_token=${mapboxToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);

        // Draw route on map
        if (map.current?.getSource('route')) {
          (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          });
        } else if (map.current) {
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: route.geometry,
              },
            },
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 5,
              'line-opacity': 0.75,
            },
          });
        }

        // Parse steps for turn-by-turn navigation
        const steps: RouteStep[] = route.legs[0].steps.map((step: any) => ({
          instruction: step.maneuver.instruction,
          distance: step.distance,
          location: step.maneuver.location as [number, number],
          announced: false,
        }));
        
        setRouteSteps(steps);
        setCurrentStepIndex(0);
        setIsNavigating(true);

        // Get step-by-step instructions for display
        const stepsText = steps.map(s => s.instruction).join('. ');
        setDirections(stepsText);

        const summary = `Distance: ${distanceKm} kilometers. Walking time: about ${durationMin} minutes.`;
        speak(`${summary}. Starting navigation. ${steps[0]?.instruction || ''}`);

        toast({
          title: "🧭 Navigation Started",
          description: "Voice guidance is active",
        });

        // Fit map to show entire route
        const coordinates = route.geometry.coordinates;
        const bounds = coordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.current?.fitBounds(bounds, { padding: 50 });
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
  };

  // Stop navigation
  const stopNavigation = () => {
    setIsNavigating(false);
    setRouteSteps([]);
    setCurrentStepIndex(0);
    speak("Navigation stopped.");
    toast({
      title: "Navigation Stopped",
      description: "Voice guidance disabled",
    });
  };

  // Request microphone permission
  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('Microphone permission error:', error);
      if (error.name === 'NotAllowedError') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive",
          duration: 10000,
        });
        speak("Microphone access was denied. Please allow microphone in your browser settings.");
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
          description: "Could not access microphone.",
          variant: "destructive",
        });
      }
      return false;
    }
  };

  // Voice input for destination
  const startVoiceSearch = async () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition not supported. Try Chrome or Edge.",
        variant: "destructive",
      });
      speak("Speech recognition is not supported in your browser. Please try Chrome or Edge.");
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
        description: "Say the place you want to go to...",
      });
      speak("Where would you like to go?");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDestination(transcript);
      toast({
        title: "Searching",
        description: `Looking for: ${transcript}`,
      });
      searchDestination(transcript);
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
          errorMessage = "Could not capture audio. Check your microphone is connected and allowed.";
          break;
        case 'not-allowed':
          errorTitle = "Permission Denied";
          errorMessage = "Microphone access denied. Allow microphone in browser settings.";
          break;
        case 'no-speech':
          errorTitle = "No Speech Detected";
          errorMessage = "No speech was detected. Please try speaking again.";
          break;
        case 'network':
          errorTitle = "Network Error";
          errorMessage = "Network error. Check your internet connection.";
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

  // Initialize map
  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 0],
      zoom: 2,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setIsMapReady(true);
      speak("Map is ready. Tap locate to find your position, or speak your destination.");
      getCurrentLocation();
    });
  };

  // Handle token submission
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mapboxToken) {
      initializeMap();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 bg-card border-b border-border flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <Navigation2 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">GPS Navigation</h1>
        </div>
      </header>

      {!isMapReady ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <form onSubmit={handleTokenSubmit} className="w-full max-w-md space-y-4">
            <div className="text-center mb-6">
              <MapPin className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Setup Navigation</h2>
              <p className="text-muted-foreground">
                Enter your Mapbox public token to enable GPS navigation.
                Get one free at{' '}
                <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  mapbox.com
                </a>
              </p>
            </div>
            <Input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1Ijo..."
              className="h-14 text-lg"
              aria-label="Mapbox token"
            />
            <Button type="submit" variant="hero" size="lg" className="w-full">
              Start Navigation
            </Button>
          </form>
        </div>
      ) : (
        <>
          {/* Search Bar */}
          <div className="p-4 bg-card border-b border-border">
            <div className="flex gap-2">
              <Input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Where do you want to go?"
                className="h-12 text-lg flex-1"
                onKeyDown={(e) => e.key === 'Enter' && searchDestination(destination)}
                aria-label="Destination"
              />
              <Button
                variant="hero"
                size="icon"
                onClick={() => searchDestination(destination)}
                className="h-12 w-12"
                aria-label="Search destination"
              >
                <MapPin className="w-5 h-5" />
              </Button>
              <Button
                variant={isListening ? "destructive" : "secondary"}
                size="icon"
                onClick={startVoiceSearch}
                className={`h-12 w-12 ${isListening ? 'animate-pulse' : ''}`}
                aria-label="Voice search"
              >
                <Mic className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <div ref={mapContainer} className="absolute inset-0" />
            
            {/* Navigation Status Banner */}
            {isNavigating && (
              <div className="absolute top-4 left-4 right-4 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Navigation2 className="w-6 h-6 animate-pulse" />
                    <div>
                      <p className="font-semibold">Navigating</p>
                      <p className="text-sm opacity-90">
                        {routeSteps[currentStepIndex]?.instruction || 'Follow the route'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className="h-10 w-10"
                      aria-label={voiceEnabled ? "Mute voice" : "Unmute voice"}
                    >
                      {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopNavigation}
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Control Buttons */}
            <div className="absolute bottom-24 right-4 flex flex-col gap-3">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label={voiceEnabled ? "Mute voice guidance" : "Enable voice guidance"}
              >
                {voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={getCurrentLocation}
                className="h-14 w-14 rounded-full shadow-lg"
                aria-label="Find my location"
              >
                <Locate className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Directions Panel */}
          {directions && (
            <div className="p-4 bg-card border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">
                  {isNavigating ? `Step ${currentStepIndex + 1} of ${routeSteps.length}` : 'Directions'}
                </h3>
                {isNavigating && (
                  <span className="text-sm text-muted-foreground">
                    {routeSteps[currentStepIndex]?.distance 
                      ? `${Math.round(routeSteps[currentStepIndex].distance)}m to next turn`
                      : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {isNavigating 
                  ? routeSteps[currentStepIndex]?.instruction 
                  : directions}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => speak(
                    isNavigating 
                      ? routeSteps[currentStepIndex]?.instruction || ''
                      : directions
                  )}
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Read Aloud
                </Button>
                {isNavigating && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={stopNavigation}
                  >
                    Stop Navigation
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NavigationPage;
