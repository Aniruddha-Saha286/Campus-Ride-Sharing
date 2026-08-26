import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Navigation,
  LocateFixed,
  Trash2,
  Loader2,
  Search,
  X,
  ArrowRightLeft,
  Map as MapIcon,
  Check,
} from "lucide-react";

const BRAC_UNIVERSITY = [23.7795, 90.4055];
const PICKUP_COLOR = "#2563eb"; // Blue
const DROPOFF_COLOR = "#e11d48"; // Rose/Red
const ROUTE_COLOR = "#2563eb"; // Clean Blue

// Comprehensive Dhaka Landmarks & University Hubs for Instant 0ms Search
const DHAKA_LOCATIONS = [
  { name: "BRAC University (Merul Badda)", area: "Bir Uttam Rafiqul Islam Ave, Merul Badda", lat: 23.7795, lng: 90.4055, keywords: ["brac", "bracu", "merul", "badda", "university", "campus", "new campus"] },
  { name: "BRAC University (Mohakhali Campus)", area: "66 Mohakhali, Wireless Gate", lat: 23.7725, lng: 90.4022, keywords: ["brac", "bracu", "mohakhali", "wireless", "campus", "old campus"] },
  { name: "Merul Badda (Badda Link Road)", area: "Pragati Sarani, Merul Badda", lat: 23.7780, lng: 90.4240, keywords: ["merul", "badda", "link road", "pragati"] },
  { name: "Gulshan 1 Circle", area: "Gulshan Avenue, Dhaka", lat: 23.7785, lng: 90.4170, keywords: ["gulshan 1", "gulshan", "circle", "dcc market"] },
  { name: "Gulshan 2 Circle", area: "Gulshan Avenue / Madani Ave", lat: 23.7925, lng: 90.4167, keywords: ["gulshan 2", "gulshan", "circle"] },
  { name: "Banani 11", area: "Road 11, Kamal Ataturk Ave", lat: 23.7937, lng: 90.4043, keywords: ["banani", "road 11", "kamal ataturk", "superstore"] },
  { name: "Banani Chairmanbari", area: "Airport Road, Banani", lat: 23.7885, lng: 90.4020, keywords: ["banani", "chairmanbari", "airport road"] },
  { name: "Mohakhali Bus Terminal / Flyover", area: "Mohakhali, Dhaka", lat: 23.7776, lng: 90.3995, keywords: ["mohakhali", "dohs", "terminal", "flyover"] },
  { name: "Mohakhali DOHS", area: "Mohakhali DOHS Gate", lat: 23.7820, lng: 90.3920, keywords: ["mohakhali dohs", "dohs"] },
  { name: "Dhanmondi 27 / Rapa Plaza", area: "Mirpur Road, Dhanmondi", lat: 23.7540, lng: 90.3735, keywords: ["dhanmondi 27", "dhanmondi", "rapa plaza", "27"] },
  { name: "Dhanmondi 32 / Lake", area: "Mirpur Road, Dhanmondi", lat: 23.7505, lng: 90.3742, keywords: ["dhanmondi 32", "dhanmondi", "lake", "32"] },
  { name: "Dhanmondi 15 / 8A / Zigatola", area: "Satmasjid Road, Dhanmondi", lat: 23.7435, lng: 90.3715, keywords: ["dhanmondi 15", "dhanmondi", "zigatola", "satmasjid"] },
  { name: "Mirpur 10 (Roundabout / Metro)", area: "Mirpur 10, Dhaka", lat: 23.8070, lng: 90.3685, keywords: ["mirpur 10", "mirpur", "metro", "roundabout", "stadium"] },
  { name: "Mirpur 1 / Sony Cinema", area: "Mirpur 1, Dhaka", lat: 23.7955, lng: 90.3540, keywords: ["mirpur 1", "mirpur", "sony", "square"] },
  { name: "Mirpur 2 / National Stadium", area: "Mirpur 2, Dhaka", lat: 23.8020, lng: 90.3620, keywords: ["mirpur 2", "mirpur", "stadium"] },
  { name: "Mirpur 11 / 12 / DOHS", area: "Mirpur 12, Dhaka", lat: 23.8270, lng: 90.3645, keywords: ["mirpur 12", "mirpur 11", "mirpur", "dohs"] },
  { name: "Uttara Sector 3 (Rajlakshmi)", area: "Dhaka-Mymensingh Hwy, Uttara", lat: 23.8685, lng: 90.3995, keywords: ["uttara", "rajlakshmi", "sector 3", "jasimuddin"] },
  { name: "Uttara Sector 7 / House Building", area: "Rabindra Sarani, Uttara", lat: 23.8745, lng: 90.3970, keywords: ["uttara", "house building", "sector 7", "rabindra sarani"] },
  { name: "Uttara Sector 10 / 11", area: "Gareeb-e-Nawaz Ave, Uttara", lat: 23.8820, lng: 90.3880, keywords: ["uttara", "sector 10", "sector 11", "gareeb e nawaz"] },
  { name: "Bashundhara R/A (Main Gate)", area: "Kuril, Pragati Sarani", lat: 23.8155, lng: 90.4285, keywords: ["bashundhara", "gate", "kuril", "pragati", "nsu", "aiub", "iub"] },
  { name: "Kuril Flyover / Bishwa Road", area: "Kuril, Airport Road", lat: 23.8190, lng: 90.4210, keywords: ["kuril", "flyover", "bishwa road"] },
  { name: "Farmgate / Ananda Cinema / Metro", area: "Kazi Nazrul Islam Ave", lat: 23.7565, lng: 90.3915, keywords: ["farmgate", "ananda", "metro", "green road"] },
  { name: "Shahbagh / Dhaka University", area: "Shahbagh Intersection", lat: 23.7380, lng: 90.3955, keywords: ["shahbagh", "dhaka university", "du", "tsc", "bsh", "pg"] },
  { name: "Motijheel / Shapla Chattar", area: "Motijheel C/A", lat: 23.7290, lng: 90.4190, keywords: ["motijheel", "shapla", "commercial"] },
  { name: "Rampura Bridge / Hatirjheel", area: "Rampura, DIT Road", lat: 23.7620, lng: 90.4230, keywords: ["rampura", "bridge", "hatirjheel", "dit", "tv center"] },
  { name: "Moghbazar Wireless / Mor", area: "Outer Circular Road, Moghbazar", lat: 23.7510, lng: 90.4070, keywords: ["moghbazar", "wireless", "mor", "flyover"] },
  { name: "Khilgaon Taltola", area: "Khilgaon, Dhaka", lat: 23.7525, lng: 90.4260, keywords: ["khilgaon", "taltola", "flyover"] },
  { name: "Malibagh Railgate / Mor", area: "Malibagh, Dhaka", lat: 23.7470, lng: 90.4150, keywords: ["malibagh", "railgate", "mor"] },
  { name: "Kakrail / Shantinagar", area: "VIP Road, Kakrail", lat: 23.7395, lng: 90.4100, keywords: ["kakrail", "shantinagar", "circuit house"] },
  { name: "Tejgaon Nabisco / I/A", area: "Shahid Tajuddin Ahmad Ave", lat: 23.7690, lng: 90.4030, keywords: ["tejgaon", "nabisco", "industrial", "satrasta"] },
  { name: "Niketan (Gate 1 & 2)", area: "Niketan, Gulshan 1", lat: 23.7745, lng: 90.4120, keywords: ["niketan", "gulshan 1"] },
  { name: "Hatirjheel (Police Plaza)", area: "Hatirjheel, Gulshan", lat: 23.7760, lng: 90.4135, keywords: ["hatirjheel", "police plaza", "concord"] },
  { name: "Aftabnagar (Main Gate)", area: "Aftabnagar, Rampura", lat: 23.7680, lng: 90.4320, keywords: ["aftabnagar", "gate", "rampura", "east west"] },
  { name: "Basaboo / Madartek", area: "Atish Dipankar Road", lat: 23.7430, lng: 90.4340, keywords: ["basaboo", "madartek"] },
  { name: "Lalmatia / Mohammadpur Town Hall", area: "Satmasjid Road, Mohammadpur", lat: 23.7580, lng: 90.3660, keywords: ["lalmatia", "mohammadpur", "town hall", "tajmahal"] },
  { name: "Mohammadpur Bus Stand / Asad Gate", area: "Mirpur Road, Asad Gate", lat: 23.7595, lng: 90.3705, keywords: ["mohammadpur", "asad gate", "bus stand"] },
  { name: "Shyamoli (Shishu Mela)", area: "Mirpur Road, Shyamoli", lat: 23.7720, lng: 90.3620, keywords: ["shyamoli", "shishu mela", "square"] },
  { name: "Kalyanpur (Bus Stand)", area: "Mirpur Road, Kalyanpur", lat: 23.7810, lng: 90.3580, keywords: ["kalyanpur", "bus stand"] },
  { name: "Airport (Hazrat Shahjalal Int'l)", area: "Airport Road, Kurmitola", lat: 23.8435, lng: 90.4030, keywords: ["airport", "shahjalal", "terminal 1", "terminal 2"] },
  { name: "Agargaon (Passport Office / Metro)", area: "Agargaon, Sher-e-Bangla Nagar", lat: 23.7780, lng: 90.3780, keywords: ["agargaon", "passport", "metro", "election commission"] }
];

const createCustomPinIcon = (label, color) =>
  L.divIcon({
    className: "custom-map-pin",
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); cursor: grab;">
        <div style="
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          background: ${color};
          color: #ffffff;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 4px 10px rgba(0,0,0,0.25);
          border: 2px solid #ffffff;
          white-space: nowrap;
        ">
          <span>${label}</span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 7px solid ${color};
          margin-top: -1px;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

const cleanNominatimAddress = (display_name, lat, lng) => {
  if (!display_name) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const parts = display_name.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 4) return display_name;
  return parts.slice(0, 4).join(", ");
};

// Calculate realistic Dhaka urban commute duration in minutes based on distance
const calculateUrbanDuration = (distKm, osrmDurationSec) => {
  if (!distKm || distKm <= 0) return 0;
  // Dhaka urban traffic average speed ~16-18 km/h plus base buffer
  const trafficMins = Math.round(distKm * 3.2 + 3);
  if (osrmDurationSec) {
    const adjustedOsrm = Math.round((osrmDurationSec / 60) * 1.8);
    return Math.max(5, Math.max(trafficMins, adjustedOsrm));
  }
  return Math.max(5, trafficMins);
};

export default function MapPicker({
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  onRouteCalculated,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const routeRef = useRef(null);

  const [activeMode, setActiveMode] = useState("pickup"); // 'pickup' | 'dropoff'
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownMouseDownRef = useRef(false);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
    }).setView(BRAC_UNIVERSITY, 14);

    mapRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on("click", async (event) => {
      const { lat, lng } = event.latlng;
      const targetMode = activeModeRef.current;
      
      const pos = { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
      
      if (targetMode === "pickup") {
        onPickupChange(pos);
        if (!dropoff) {
          setActiveMode("dropoff");
        }
      } else {
        onDropoffChange(pos);
      }

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        const formatted = cleanNominatimAddress(data?.display_name, lat, lng);
        if (targetMode === "pickup") {
          onPickupChange({ lat, lng, label: formatted });
        } else {
          onDropoffChange({ lat, lng, label: formatted });
        }
      } catch {
        // keep coord label
      }
    });

    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      routeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Pickup & Dropoff Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup Marker
    if (pickup) {
      if (!pickupMarkerRef.current) {
        const marker = L.marker([pickup.lat, pickup.lng], {
          icon: createCustomPinIcon("Pickup", PICKUP_COLOR),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", async (e) => {
          const { lat, lng } = e.target.getLatLng();
          const updated = { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
          onPickupChange(updated);
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { "Accept-Language": "en" } }
            );
            const data = await res.json();
            onPickupChange({ lat, lng, label: cleanNominatimAddress(data?.display_name, lat, lng) });
          } catch {}
        });

        pickupMarkerRef.current = marker;
      } else {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    // Dropoff Marker
    if (dropoff) {
      if (!dropoffMarkerRef.current) {
        const marker = L.marker([dropoff.lat, dropoff.lng], {
          icon: createCustomPinIcon("Drop-off", DROPOFF_COLOR),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", async (e) => {
          const { lat, lng } = e.target.getLatLng();
          const updated = { lat, lng, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
          onDropoffChange(updated);
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
              { headers: { "Accept-Language": "en" } }
            );
            const data = await res.json();
            onDropoffChange({ lat, lng, label: cleanNominatimAddress(data?.display_name, lat, lng) });
          } catch {}
        });

        dropoffMarkerRef.current = marker;
      } else {
        dropoffMarkerRef.current.setLatLng([dropoff.lat, dropoff.lng]);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    // Route Polyline & Bounds
    if (pickup && dropoff) {
      let isMounted = true;
      setCalculatingRoute(true);

      const drawStraightLine = () => {
        const straightCoords = [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];
        if (!routeRef.current) {
          routeRef.current = L.polyline([], {
            color: ROUTE_COLOR,
            weight: 5,
            opacity: 0.85,
            dashArray: "8, 8",
          }).addTo(map);
        }
        routeRef.current.setLatLngs(straightCoords);
        map.fitBounds(routeRef.current.getBounds(), { padding: [50, 50] });

        // Calculate fallback straight distance
        const toRad = (deg) => (deg * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(dropoff.lat - pickup.lat);
        const dLng = toRad(dropoff.lng - pickup.lng);
        const s =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(pickup.lat)) * Math.cos(toRad(dropoff.lat)) * Math.sin(dLng / 2) ** 2;
        const fallbackDist = parseFloat((R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))).toFixed(2));
        
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: fallbackDist,
            duration: calculateUrbanDuration(fallbackDist, null),
            isRealTime: false,
          });
        }
      };

      const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;

      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const routeCoords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const distKm = parseFloat((route.distance / 1000).toFixed(2));
            const durationMins = calculateUrbanDuration(distKm, route.duration);

            if (!routeRef.current) {
              routeRef.current = L.polyline([], {
                color: ROUTE_COLOR,
                weight: 5,
                opacity: 0.9,
              }).addTo(map);
            }
            routeRef.current.setLatLngs(routeCoords);
            map.fitBounds(routeRef.current.getBounds(), { padding: [60, 60] });

            if (onRouteCalculated) {
              onRouteCalculated({
                distance: distKm,
                duration: durationMins,
                isRealTime: true,
              });
            }
          } else {
            drawStraightLine();
          }
        })
        .catch(() => {
          if (!isMounted) return;
          drawStraightLine();
        })
        .finally(() => {
          if (isMounted) setCalculatingRoute(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      if (routeRef.current) {
        routeRef.current.setLatLngs([]);
      }
      if (onRouteCalculated) {
        onRouteCalculated(null);
      }
    }
  }, [pickup, dropoff, onPickupChange, onDropoffChange, onRouteCalculated]);

  const doSearch = async (term) => {
    if (!term || term.trim().length < 1) return;
    const q = term.trim().toLowerCase();

    const localMatches = DHAKA_LOCATIONS.filter((loc) => {
      return (
        loc.name.toLowerCase().includes(q) ||
        loc.area.toLowerCase().includes(q) ||
        loc.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }).map((loc) => ({
      name: loc.name,
      area: loc.area,
      display_name: `${loc.name}, ${loc.area}`,
      lat: loc.lat,
      lon: loc.lng,
    }));

    setSearchResults(localMatches);
    setShowSearchResults(true);

    if (q.length >= 2) {
      try {
        setSearching(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " dhaka")}&format=json&limit=6&countrycodes=bd`,
          { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const combined = [...localMatches];
          for (const item of data) {
            const iLat = parseFloat(item.lat);
            const iLon = parseFloat(item.lon);
            const dup = combined.some(
              (c) => Math.abs(parseFloat(c.lat) - iLat) < 0.002 && Math.abs(parseFloat(c.lon) - iLon) < 0.002
            );
            if (!dup) combined.push(item);
          }
          setSearchResults(combined);
          setShowSearchResults(combined.length > 0);
        }
      } catch {
        // local matches stay intact
      } finally {
        setSearching(false);
      }
    }
  };

  const handleSearchInput = (value) => {
    setSearchQuery(value);
    setError("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value || value.trim().length < 1) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearching(false);
      return;
    }

    const q = value.trim().toLowerCase();
    const instant = DHAKA_LOCATIONS.filter((loc) =>
      loc.name.toLowerCase().includes(q) ||
      loc.area.toLowerCase().includes(q) ||
      loc.keywords?.some((k) => k.toLowerCase().includes(q))
    ).map((loc) => ({
      name: loc.name,
      area: loc.area,
      display_name: `${loc.name}, ${loc.area}`,
      lat: loc.lat,
      lon: loc.lng,
    }));

    setSearchResults(instant);
    setShowSearchResults(instant.length > 0 || value.trim().length >= 2);

    searchDebounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSelectLocation = (loc) => {
    const lat = parseFloat(loc.lat);
    const lon = parseFloat(loc.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    const label = loc.name
      ? `${loc.name}${loc.area ? ", " + loc.area : ""}`
      : (loc.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    const pos = { lat, lng: lon, label };

    if (activeMode === "pickup") {
      onPickupChange(pos);
      if (!dropoff) setActiveMode("dropoff");
    } else {
      onDropoffChange(pos);
    }

    if (mapRef.current) mapRef.current.flyTo([lat, lon], 16, { duration: 1.2 });
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
    dropdownMouseDownRef.current = false;
  };


  // Locate Current User
  const locateMe = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          label = cleanNominatimAddress(data?.display_name, lat, lng);
        } catch {}

        const pos = { lat, lng, label };
        mapRef.current?.flyTo([pos.lat, pos.lng], 16, { duration: 1 });

        if (activeMode === "pickup") {
          onPickupChange(pos);
          if (!dropoff) setActiveMode("dropoff");
        } else {
          onDropoffChange(pos);
        }
        setLocating(false);
      },
      () => {
        setError("Could not retrieve your live location. Please allow browser location access.");
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Swap Pickup and Dropoff
  const handleSwapPoints = () => {
    if (!pickup && !dropoff) return;
    const tempPickup = pickup;
    onPickupChange(dropoff);
    onDropoffChange(tempPickup);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
      {/* Top Interactive Search & Mode Bar */}
      <div className="border-b border-slate-100 bg-slate-50/70 p-4">
        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveMode("pickup");
                setShowSearchResults(false);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeMode === "pickup"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-600/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <MapPin size={14} />
              <span>Setting Pickup</span>
              {pickup && <Check size={13} className="text-blue-200" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode("dropoff");
                setShowSearchResults(false);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeMode === "dropoff"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/20 ring-2 ring-rose-600/30"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Navigation size={14} />
              <span>Setting Drop-off</span>
              {dropoff && <Check size={13} className="text-rose-200" />}
            </button>

            {pickup && dropoff && (
              <button
                type="button"
                onClick={handleSwapPoints}
                title="Swap Pickup and Drop-off"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowRightLeft size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              {locating ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <LocateFixed size={13} className="text-blue-600" />}
              <span>{locating ? "Locating..." : "Use My Location"}</span>
            </button>

            {(pickup || dropoff) && (
              <button
                type="button"
                onClick={() => {
                  if (activeMode === "pickup") onPickupChange(null);
                  else onDropoffChange(null);
                }}
                disabled={activeMode === "pickup" ? !pickup : !dropoff}
                className="flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50/50 px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative mt-3">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
              {searching ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <Search size={16} className="text-slate-400" />
              )}
            </div>

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  doSearch(searchQuery);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
                else if (searchQuery.trim().length > 0) doSearch(searchQuery);
              }}
              onBlur={() => {
                if (!dropdownMouseDownRef.current) setShowSearchResults(false);
                dropdownMouseDownRef.current = false;
              }}
              placeholder="Search e.g. BRAC University, Dhanmondi 27, Gulshan 2..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-24 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />

            <div className="absolute right-2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={() => { dropdownMouseDownRef.current = true; }}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                    dropdownMouseDownRef.current = false;
                    searchInputRef.current?.focus();
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}

              <button
                type="button"
                onMouseDown={() => { dropdownMouseDownRef.current = true; }}
                onClick={() => { doSearch(searchQuery); searchInputRef.current?.focus(); }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>

          {/* Autocomplete Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 z-30 mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Matching Locations</span>
                <span className="text-[10px] text-slate-400">Select to set {activeMode === "pickup" ? "Pickup" : "Drop-off"}</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => { dropdownMouseDownRef.current = true; }}
                    onClick={() => handleSelectLocation(item)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition hover:bg-blue-50/70"
                  >
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <MapPin size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {item.name || item.display_name?.split(",")[0] || ""}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {item.area || cleanNominatimAddress(item.display_name, parseFloat(item.lat), parseFloat(item.lon))}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative h-[440px] w-full bg-slate-100">
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-50">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-xs font-semibold text-slate-500">Loading map...</span>
          </div>
        )}
        
        <div ref={containerRef} className="h-full w-full" />

        {/* Floating Map Helper Badge */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[400] flex items-center gap-2 rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
          <MapIcon size={13} className="text-blue-400" />
          <span>Click map to set <strong>{activeMode === "pickup" ? "Pickup" : "Drop-off"}</strong>. Markers can be dragged to adjust.</span>
        </div>

        {/* Calculating Route Overlay */}
        {calculatingRoute && (
          <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 rounded-xl bg-white/95 px-3.5 py-2 text-xs font-bold text-blue-700 shadow-md backdrop-blur-md border border-blue-100">
            <Loader2 size={14} className="animate-spin text-blue-600" />
            <span>Calculating route...</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-rose-500 hover:text-rose-700">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
