import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Navigation2, Mic, MapPin, Locate } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Text-to-speech
  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

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

  // Watch position for continuous tracking
  useEffect(() => {
    let watchId: number;

    if (isTracking && isMapReady) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);

          if (userMarker.current) {
            userMarker.current.setLngLat([longitude, latitude]);
          }
        },
        (error) => console.error(error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking, isMapReady]);

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
        `https://api.mapbox.com/directions/v5/mapbox/walking/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&voice_instructions=true&access_token=${mapboxToken}`
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

        // Get step-by-step instructions
        const steps = route.legs[0].steps.map((step: any) => step.maneuver.instruction).join('. ');
        setDirections(steps);

        const summary = `Distance: ${distanceKm} kilometers. Walking time: about ${durationMin} minutes.`;
        speak(`${summary}. ${route.legs[0].steps[0].maneuver.instruction}`);

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

  // Voice input for destination
  const startVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition not supported",
        variant: "destructive",
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      speak("Where would you like to go?");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDestination(transcript);
      searchDestination(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      speak("Could not understand. Please try again.");
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
            
            {/* Locate Button */}
            <Button
              variant="secondary"
              size="icon"
              onClick={getCurrentLocation}
              className="absolute bottom-24 right-4 h-14 w-14 rounded-full shadow-lg"
              aria-label="Find my location"
            >
              <Locate className="w-6 h-6" />
            </Button>
          </div>

          {/* Directions Panel */}
          {directions && (
            <div className="p-4 bg-card border-t border-border max-h-32 overflow-y-auto">
              <h3 className="font-semibold mb-2">Directions:</h3>
              <p className="text-sm text-muted-foreground">{directions}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => speak(directions)}
                className="mt-2"
              >
                <Mic className="w-4 h-4 mr-2" />
                Read Directions
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NavigationPage;
