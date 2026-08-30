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
  // BRAC University
  { name: "BRAC University (Merul Badda Campus)", area: "Bir Uttam Rafiqul Islam Ave, Merul Badda", lat: 23.7795, lng: 90.4055, keywords: ["brac", "bracu", "merul", "badda", "university", "campus", "new campus"] },
  { name: "BRAC University (Mohakhali Campus)", area: "66 Mohakhali, Wireless Gate", lat: 23.7725, lng: 90.4022, keywords: ["brac", "bracu", "mohakhali", "wireless", "campus", "old campus"] },

  // Universities
  { name: "North South University (NSU)", area: "Plot 15, Block B, Bashundhara R/A", lat: 23.8151, lng: 90.4255, keywords: ["nsu", "north south", "bashundhara", "university"] },
  { name: "Independent University Bangladesh (IUB)", area: "Plot 16, Block B, Bashundhara R/A", lat: 23.8160, lng: 90.4270, keywords: ["iub", "independent", "bashundhara", "university"] },
  { name: "AIUB (Kuril)", area: "408/1 Kuratoli, Khilkhet, Kuril", lat: 23.8222, lng: 90.4278, keywords: ["aiub", "kuratoli", "kuril", "khilkhet", "american international"] },
  { name: "University of Dhaka (DU / TSC)", area: "Nilkhet Road, Shahbagh / TSC", lat: 23.7340, lng: 90.3928, keywords: ["du", "dhaka university", "tsc", "curzon hall", "nilkhet", "shahbagh"] },
  { name: "BUET (Palashi / Central Campus)", area: "Palashi, Dhaka 1000", lat: 23.7265, lng: 90.3925, keywords: ["buet", "palashi", "engineering university"] },
  { name: "East West University (EWU)", area: "Aftabnagar Main Road, Rampura", lat: 23.7687, lng: 90.4255, keywords: ["ewu", "east west", "aftabnagar", "rampura", "university"] },
  { name: "United International University (UIU)", area: "United City, Madani Ave, Badda", lat: 23.7978, lng: 90.4497, keywords: ["uiu", "united", "madani", "badda", "100 feet", "university"] },
  { name: "ULAB (University of Liberal Arts)", area: "Beribadh Road, Mohammadpur", lat: 23.7542, lng: 90.3545, keywords: ["ulab", "liberal arts", "beribadh", "mohammadpur", "dhanmondi"] },
  { name: "Daffodil International University (DIU - Sukrabad)", area: "Sukrabad, Mirpur Road, Dhanmondi", lat: 23.7530, lng: 90.3780, keywords: ["daffodil", "diu", "sukrabad", "dhanmondi"] },
  { name: "BUP (Bangladesh University of Professionals)", area: "Mirpur Cantonment, Dhaka", lat: 23.8405, lng: 90.3580, keywords: ["bup", "mirpur cantonment", "professionals"] },
  { name: "MIST (Military Institute of Science & Tech)", area: "Mirpur Cantonment, Dhaka", lat: 23.8375, lng: 90.3585, keywords: ["mist", "mirpur cantonment"] },
  { name: "Green University of Bangladesh", area: "220/D Begum Rokeya Sarani, Shewrapara", lat: 23.7880, lng: 90.3740, keywords: ["green university", "gub", "shewrapara", "rokeya sarani"] },
  { name: "Stamford University (Siddheshwari)", area: "51 Siddheshwari Road, Malibagh", lat: 23.7420, lng: 90.4100, keywords: ["stamford", "siddheshwari", "malibagh"] },

  // Badda, Rampura & Banasree
  { name: "Merul Badda (Badda Link Road)", area: "Pragati Sarani, Merul Badda", lat: 23.7780, lng: 90.4240, keywords: ["merul", "badda", "link road", "pragati"] },
  { name: "Uttar Badda (Notun Bazar)", area: "Pragati Sarani, Badda", lat: 23.7930, lng: 90.4245, keywords: ["badda", "uttar badda", "notun bazar", "madani"] },
  { name: "Middle Badda / Post Office", area: "Pragati Sarani, Badda", lat: 23.7850, lng: 90.4242, keywords: ["middle badda", "badda post office"] },
  { name: "Aftabnagar (Main Gate / Block A-F)", area: "Aftabnagar, Rampura", lat: 23.7680, lng: 90.4320, keywords: ["aftabnagar", "gate", "rampura", "east west"] },
  { name: "Rampura Bridge / Hatirjheel", area: "Rampura, DIT Road", lat: 23.7620, lng: 90.4230, keywords: ["rampura", "bridge", "hatirjheel", "dit", "tv center"] },
  { name: "Rampura TV Center / Banasree Gate", area: "DIT Road, Rampura", lat: 23.7600, lng: 90.4235, keywords: ["rampura", "tv center", "banasree"] },
  { name: "Banasree (Block A-F / Main Road)", area: "Banasree Residential Area", lat: 23.7610, lng: 90.4340, keywords: ["banasree", "farazy hospital", "ideal school banasree"] },

  // Gulshan & Banani
  { name: "Gulshan 1 Circle", area: "Gulshan Avenue, Dhaka", lat: 23.7785, lng: 90.4170, keywords: ["gulshan 1", "gulshan", "circle", "dcc market", "police plaza"] },
  { name: "Gulshan 2 Circle", area: "Gulshan Avenue / Madani Ave", lat: 23.7925, lng: 90.4167, keywords: ["gulshan 2", "gulshan", "circle", "pink city", "australian club"] },
  { name: "Niketan (Gate 1 & 2)", area: "Niketan, Gulshan 1", lat: 23.7745, lng: 90.4120, keywords: ["niketan", "gulshan 1", "gate 1", "gate 2"] },
  { name: "Hatirjheel (Police Plaza Concord)", area: "Hatirjheel, Gulshan 1", lat: 23.7760, lng: 90.4135, keywords: ["hatirjheel", "police plaza", "concord"] },
  { name: "Banani 11", area: "Road 11, Kamal Ataturk Ave", lat: 23.7937, lng: 90.4043, keywords: ["banani", "road 11", "kamal ataturk", "superstore", "unimart"] },
  { name: "Banani Chairmanbari", area: "Airport Road, Banani", lat: 23.7885, lng: 90.4020, keywords: ["banani", "chairmanbari", "airport road"] },
  { name: "Banani Graveyard / Kakoli Mor", area: "Kemal Ataturk Ave, Banani", lat: 23.7930, lng: 90.4005, keywords: ["banani", "kakoli", "kemal ataturk"] },
  { name: "Baridhara Diplomatic Zone", area: "Park Road / Madani Ave", lat: 23.7990, lng: 90.4220, keywords: ["baridhara", "diplomatic", "embassy"] },
  { name: "Baridhara DOHS", area: "Baridhara DOHS, Dhaka", lat: 23.8075, lng: 90.4170, keywords: ["baridhara dohs", "anannya"] },

  // Mohakhali & Tejgaon
  { name: "Mohakhali Bus Terminal / Flyover", area: "Mohakhali, Dhaka", lat: 23.7776, lng: 90.3995, keywords: ["mohakhali", "terminal", "flyover", "bus stand"] },
  { name: "Mohakhali DOHS (Gate 1 & 2)", area: "Mohakhali DOHS, Dhaka", lat: 23.7820, lng: 90.3920, keywords: ["mohakhali dohs", "dohs", "gate 1", "gate 2"] },
  { name: "Mohakhali Wireless Gate / TB Gate", area: "Wireless Gate, Mohakhali", lat: 23.7750, lng: 90.4035, keywords: ["wireless gate", "tb gate", "icddrb", "mohakhali"] },
  { name: "Tejgaon Nabisco / Satrasta", area: "Shahid Tajuddin Ahmad Ave", lat: 23.7690, lng: 90.4030, keywords: ["tejgaon", "nabisco", "industrial", "satrasta"] },
  { name: "Tejgaon Link Road (Shanta Western)", area: "Bir Uttam Mir Shawkat Sarak", lat: 23.7705, lng: 90.4105, keywords: ["tejgaon link road", "shanta", "gulshan link"] },

  // Dhanmondi & Mohammadpur
  { name: "Dhanmondi 27 / Rapa Plaza", area: "Mirpur Road, Dhanmondi", lat: 23.7540, lng: 90.3735, keywords: ["dhanmondi 27", "dhanmondi", "rapa plaza", "27"] },
  { name: "Dhanmondi 32 / Lake", area: "Mirpur Road, Dhanmondi", lat: 23.7505, lng: 90.3742, keywords: ["dhanmondi 32", "dhanmondi", "lake", "32"] },
  { name: "Dhanmondi 15 / 8A / Zigatola", area: "Satmasjid Road, Dhanmondi", lat: 23.7435, lng: 90.3715, keywords: ["dhanmondi 15", "dhanmondi", "zigatola", "satmasjid", "shimanto square"] },
  { name: "Dhanmondi 2 / Science Lab", area: "Mirpur Road, Science Lab", lat: 23.7390, lng: 90.3830, keywords: ["science lab", "city college", "dhanmondi 2", "priyangon"] },
  { name: "Lalmatia / Block A-G", area: "Satmasjid Road, Lalmatia", lat: 23.7580, lng: 90.3660, keywords: ["lalmatia", "minar masjid", "town hall"] },
  { name: "Mohammadpur Town Hall / Bus Stand", area: "Satmasjid Road, Mohammadpur", lat: 23.7595, lng: 90.3640, keywords: ["mohammadpur", "town hall", "bus stand", "tajmahal"] },
  { name: "Mohammadpur Japan Garden City / Ring Road", area: "Ring Road, Mohammadpur", lat: 23.7650, lng: 90.3585, keywords: ["japan garden", "ring road", "mohammadpur", "suchona"] },
  { name: "Mohammadpur Shia Masjid", area: "Tajmahal Road, Mohammadpur", lat: 23.7635, lng: 90.3565, keywords: ["shia masjid", "tajmahal", "mohammadpur"] },
  { name: "Asad Gate / St. Joseph School", area: "Mirpur Road, Asad Gate", lat: 23.7600, lng: 90.3715, keywords: ["asad gate", "aarong asad gate", "st joseph"] },

  // Mirpur
  { name: "Mirpur 10 (Roundabout / Metro)", area: "Mirpur 10, Dhaka", lat: 23.8070, lng: 90.3685, keywords: ["mirpur 10", "mirpur", "metro", "roundabout", "fire service"] },
  { name: "Mirpur 1 / Sony Cinema Square", area: "Mirpur 1, Dhaka", lat: 23.7955, lng: 90.3540, keywords: ["mirpur 1", "mirpur", "sony", "square", "zoo"] },
  { name: "Mirpur 2 / National Cricket Stadium", area: "Mirpur 2, Dhaka", lat: 23.8020, lng: 90.3620, keywords: ["mirpur 2", "mirpur", "stadium", "commerce college"] },
  { name: "Mirpur 11 / Purobi Metro", area: "Mirpur 11, Dhaka", lat: 23.8190, lng: 90.3660, keywords: ["mirpur 11", "purobi", "metro"] },
  { name: "Mirpur 12 / DOHS / Bus Stand", area: "Mirpur 12, Dhaka", lat: 23.8270, lng: 90.3645, keywords: ["mirpur 12", "mirpur", "dohs", "bus stand"] },
  { name: "Mirpur 14 / Police Lines", area: "Mirpur 14, Dhaka", lat: 23.7980, lng: 90.3830, keywords: ["mirpur 14", "cantonment", "police lines"] },
  { name: "Mirpur DOHS (Main Gate)", area: "Mirpur DOHS, Dhaka", lat: 23.8340, lng: 90.3710, keywords: ["mirpur dohs", "dohs"] },
  { name: "Kazipara / Shewrapara (Metro)", area: "Begum Rokeya Sarani", lat: 23.7940, lng: 90.3730, keywords: ["kazipara", "shewrapara", "rokeya sarani", "metro"] },
  { name: "Agargaon (Passport Office / Metro)", area: "Agargaon, Sher-e-Bangla Nagar", lat: 23.7780, lng: 90.3780, keywords: ["agargaon", "passport", "metro", "election commission", "idb"] },

  // Uttara & Kuril
  { name: "Uttara Sector 3 (Rajlakshmi)", area: "Dhaka-Mymensingh Hwy, Uttara", lat: 23.8685, lng: 90.3995, keywords: ["uttara", "rajlakshmi", "sector 3", "jasimuddin"] },
  { name: "Uttara Sector 7 / House Building", area: "Rabindra Sarani, Uttara", lat: 23.8745, lng: 90.3970, keywords: ["uttara", "house building", "sector 7", "rabindra sarani", "zamzam"] },
  { name: "Uttara Sector 10 / 11 / Gareeb-e-Nawaz", area: "Gareeb-e-Nawaz Ave, Uttara", lat: 23.8820, lng: 90.3880, keywords: ["uttara", "sector 10", "sector 11", "gareeb e nawaz"] },
  { name: "Uttara Diabari / Metro Station (North)", area: "Diabari, Uttara Sector 15", lat: 23.8890, lng: 90.3760, keywords: ["diabari", "uttara north", "metro depot", "uttara 15"] },
  { name: "Kuril Flyover / Bishwa Road", area: "Kuril, Airport Road", lat: 23.8190, lng: 90.4210, keywords: ["kuril", "flyover", "bishwa road", "300 feet"] },
  { name: "Bashundhara R/A (Main Gate)", area: "Kuril, Pragati Sarani", lat: 23.8155, lng: 90.4285, keywords: ["bashundhara", "gate", "kuril", "pragati", "evercare", "apollo"] },
  { name: "Airport (Hazrat Shahjalal Int'l)", area: "Airport Road, Kurmitola", lat: 23.8435, lng: 90.4030, keywords: ["airport", "shahjalal", "terminal 1", "terminal 2", "railway station"] },

  // Central Dhaka
  { name: "Farmgate / Ananda Cinema / Metro", area: "Kazi Nazrul Islam Ave", lat: 23.7565, lng: 90.3915, keywords: ["farmgate", "ananda", "metro", "green road", "khamarbari"] },
  { name: "Panthapath / Bashundhara City", area: "Panthapath, Dhaka", lat: 23.7505, lng: 90.3895, keywords: ["panthapath", "bashundhara city", "square hospital"] },
  { name: "Kawran Bazar / PetroBangla", area: "Kazi Nazrul Islam Ave", lat: 23.7500, lng: 90.3945, keywords: ["kawran bazar", "titas", "hasan square"] },
  { name: "Shahbagh / BSMMU / PG Hospital", area: "Shahbagh Intersection", lat: 23.7380, lng: 90.3955, keywords: ["shahbagh", "pg hospital", "bsmmu", "fine arts"] },
  { name: "Motijheel / Shapla Chattar", area: "Motijheel C/A", lat: 23.7290, lng: 90.4190, keywords: ["motijheel", "shapla", "commercial", "bangladesh bank", "dilkusha"] },
  { name: "Moghbazar Wireless / Mor", area: "Outer Circular Road, Moghbazar", lat: 23.7510, lng: 90.4070, keywords: ["moghbazar", "wireless", "mor", "flyover"] },
  { name: "Khilgaon Taltola / Shahid Baki Road", area: "Khilgaon, Dhaka", lat: 23.7525, lng: 90.4260, keywords: ["khilgaon", "taltola", "flyover", "restaurants"] },
  { name: "Malibagh Railgate / Mor", area: "Malibagh, Dhaka", lat: 23.7470, lng: 90.4150, keywords: ["malibagh", "railgate", "mor", "fortune shopping mall"] },
  { name: "Kakrail / Shantinagar / Bailey Road", area: "VIP Road, Kakrail", lat: 23.7395, lng: 90.4100, keywords: ["kakrail", "shantinagar", "circuit house", "bailey road"] },
  { name: "Elephant Road / Bata Signal / Multiplan", area: "New Elephant Road", lat: 23.7410, lng: 90.3840, keywords: ["elephant road", "multiplan", "bata signal"] },
  { name: "New Market / Nilkhet / Gausia", area: "Mirpur Road, New Market", lat: 23.7335, lng: 90.3845, keywords: ["new market", "nilkhet", "gausia", "eden college"] },
  { name: "Shyamoli (Square / Shishu Mela)", area: "Mirpur Road, Shyamoli", lat: 23.7720, lng: 90.3620, keywords: ["shyamoli", "shishu mela", "square"] },
  { name: "Kalyanpur (Bus Stand / Technical)", area: "Mirpur Road, Kalyanpur", lat: 23.7810, lng: 90.3580, keywords: ["kalyanpur", "bus stand", "technical mor"] },
  { name: "Gabtoli Bus Terminal", area: "Mazar Road, Gabtoli", lat: 23.7845, lng: 90.3450, keywords: ["gabtoli", "bus terminal"] },
  { name: "Old Dhaka / Sadarghat / Victoria Park", area: "Kotwali, Old Dhaka", lat: 23.7085, lng: 90.4110, keywords: ["old dhaka", "puran dhaka", "sadarghat", "victoria park", "jagannath university"] },
  { name: "Jatrabari / Sayedabad Bus Terminal", area: "Mayor Hanif Flyover, Jatrabari", lat: 23.7120, lng: 90.4330, keywords: ["jatrabari", "sayedabad", "flyover", "bus terminal"] },
  { name: "Kamalapur Railway Station", area: "Station Road, Kamalapur", lat: 23.7315, lng: 90.4265, keywords: ["kamalapur", "railway station", "railway"] },
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
          padding: 5px 10px;
          background: ${color};
          color: #ffffff;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          border: 2px solid #ffffff;
          white-space: nowrap;
          letter-spacing: 0.02em;
        ">
          <span>${label}</span>
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${color};
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

// Calculate realistic urban commute duration in minutes based on distance & OSRM speed profiles
const calculateUrbanDuration = (distKm, osrmDurationSec) => {
  if (!distKm || distKm <= 0) return { min: 0, max: 0, text: "0 mins", duration: 0 };

  let baseMinutes = 0;
  if (osrmDurationSec && osrmDurationSec > 0) {
    const osrmMins = osrmDurationSec / 60;
    baseMinutes = Math.round(osrmMins * 1.25);
  } else {
    baseMinutes = Math.round((distKm / 22) * 60);
  }

  // Realistic bounds based on distance
  if (distKm <= 0.6) {
    return { min: 1, max: 3, text: "1–3 mins", duration: 2 };
  } else if (distKm <= 1.5) {
    return { min: 3, max: 5, text: "3–5 mins", duration: 4 };
  } else if (distKm <= 3.0) {
    const min = Math.max(4, Math.round(baseMinutes * 0.85));
    const max = Math.max(min + 2, Math.round(baseMinutes * 1.25));
    return { min, max, text: `${min}–${max} mins`, duration: Math.round((min + max) / 2) };
  } else if (distKm <= 7.0) {
    const min = Math.max(8, Math.round(baseMinutes * 0.85));
    const max = Math.max(min + 4, Math.round(baseMinutes * 1.3));
    return { min, max, text: `${min}–${max} mins`, duration: Math.round((min + max) / 2) };
  } else if (distKm <= 15.0) {
    const min = Math.max(15, Math.round(baseMinutes * 0.9));
    const max = Math.max(min + 6, Math.round(baseMinutes * 1.35));
    return { min, max, text: `${min}–${max} mins`, duration: Math.round((min + max) / 2) };
  } else {
    const min = Math.max(25, Math.round(baseMinutes * 0.95));
    const max = Math.max(min + 10, Math.round(baseMinutes * 1.4));
    return { min, max, text: `${min}–${max} mins`, duration: Math.round((min + max) / 2) };
  }
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
  const searchContainerRef = useRef(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target)
      ) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    // Invalidate size after layout rendering
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

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
        map.fitBounds(routeRef.current.getBounds(), { padding: [60, 60] });

        const dLat = (dropoff.lat - pickup.lat) * 111.32;
        const dLng = (dropoff.lng - pickup.lng) * 111.32 * Math.cos((pickup.lat * Math.PI) / 180);
        const distKm = Math.max(0.5, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 1.3 * 10) / 10);
        const durationObj = calculateUrbanDuration(distKm, null);
        
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: distKm,
            duration: durationObj.duration,
            durationText: durationObj.text,
            isFallback: true,
          });
        }
      };

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;

      fetch(osrmUrl)
        .then((r) => r.json())
        .then((data) => {
          if (!isMounted) return;
          if (data.code === "Ok" && data.routes?.[0]) {
            const route = data.routes[0];
            const routeCoords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
            const distKm = Math.round((route.distance / 1000) * 10) / 10;
            const durationObj = calculateUrbanDuration(distKm, route.duration);

            if (!routeRef.current) {
              routeRef.current = L.polyline([], {
                color: ROUTE_COLOR,
                weight: 5,
                opacity: 0.9,
              }).addTo(map);
            }
            routeRef.current.setLatLngs(routeCoords);
            map.fitBounds(routeRef.current.getBounds(), { padding: [70, 70] });

            if (onRouteCalculated) {
              onRouteCalculated({
                distance: distKm,
                duration: durationObj.duration,
                durationText: durationObj.text,
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

  const searchLocalDatabase = (term) => {
    if (!term || term.trim().length === 0) return [];
    const q = term.trim().toLowerCase();
    const queryParts = q.split(/\s+/).filter(Boolean);

    return DHAKA_LOCATIONS.filter((loc) => {
      const name = loc.name.toLowerCase();
      const area = loc.area.toLowerCase();
      const keywords = (loc.keywords || []).map((k) => k.toLowerCase());

      return queryParts.every((part) =>
        name.includes(part) ||
        area.includes(part) ||
        keywords.some((k) => k.includes(part))
      );
    }).map((loc) => ({
      name: loc.name,
      area: loc.area,
      display_name: `${loc.name}, ${loc.area}`,
      lat: loc.lat,
      lon: loc.lng,
    }));
  };

  const doSearch = async (term, autoSelectFirst = false) => {
    if (!term || term.trim().length < 1) return;
    const q = term.trim().toLowerCase();

    const localMatches = searchLocalDatabase(q);
    setSearchResults(localMatches);
    setShowSearchResults(true);

    if (autoSelectFirst && localMatches.length > 0) {
      handleSelectLocation(localMatches[0]);
      return;
    }

    if (q.length >= 2) {
      try {
        setSearching(true);
        // Fast Photon search with fallback to Nominatim
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          q + " dhaka"
        )}&lat=23.7795&lon=90.4055&limit=6`;

        const res = await fetch(photonUrl);
        const data = await res.json();

        if (Array.isArray(data?.features) && data.features.length > 0) {
          const photonResults = data.features.map((f) => {
            const [lon, lat] = f.geometry.coordinates;
            const props = f.properties || {};
            const name = props.name || props.street || q;
            const area = [props.district, props.city || "Dhaka", props.country]
              .filter(Boolean)
              .join(", ");
            return {
              name,
              area,
              display_name: `${name}${area ? ", " + area : ""}`,
              lat,
              lon,
            };
          });

          const combined = [...localMatches];
          for (const item of photonResults) {
            const iLat = parseFloat(item.lat);
            const iLon = parseFloat(item.lon);
            const dup = combined.some(
              (c) =>
                Math.abs(parseFloat(c.lat) - iLat) < 0.002 &&
                Math.abs(parseFloat(c.lon) - iLon) < 0.002
            );
            if (!dup) combined.push(item);
          }

          setSearchResults(combined);
          setShowSearchResults(combined.length > 0);

          if (autoSelectFirst && combined.length > 0 && localMatches.length === 0) {
            handleSelectLocation(combined[0]);
          }
        }
      } catch {
        // Fallback: search Nominatim
        try {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              q + " dhaka bangladesh"
            )}&format=json&limit=5&countrycodes=bd`,
            { headers: { "Accept-Language": "en" } }
          );
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            const combined = [...localMatches];
            for (const item of nomData) {
              const iLat = parseFloat(item.lat);
              const iLon = parseFloat(item.lon);
              const dup = combined.some(
                (c) =>
                  Math.abs(parseFloat(c.lat) - iLat) < 0.002 &&
                  Math.abs(parseFloat(c.lon) - iLon) < 0.002
              );
              if (!dup) combined.push(item);
            }
            setSearchResults(combined);
            setShowSearchResults(combined.length > 0);
          }
        } catch {
          // local matches stay intact
        }
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

    const instant = searchLocalDatabase(value);
    setSearchResults(instant);
    setShowSearchResults(instant.length > 0 || value.trim().length >= 2);

    searchDebounceRef.current = setTimeout(() => doSearch(value, false), 350);
  };

  const handleSelectLocation = (loc) => {
    const lat = parseFloat(loc.lat);
    const lon = parseFloat(loc.lon);
    if (isNaN(lat) || isNaN(lon)) return;

    const label = loc.name
      ? `${loc.name}${loc.area ? ", " + loc.area : ""}`
      : loc.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

    const pos = { lat, lng: lon, label };

    if (activeMode === "pickup") {
      onPickupChange(pos);
      if (!dropoff) setActiveMode("dropoff");
    } else {
      onDropoffChange(pos);
    }

    if (mapRef.current) {
      mapRef.current.flyTo([lat, lon], 16, { duration: 1 });
    }

    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
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
    <div className="relative overflow-visible rounded-3xl border border-slate-200/80 bg-white shadow-xl">
      {/* Top Interactive Search & Mode Bar */}
      <div className="rounded-t-3xl border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5">
        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveMode("pickup");
                setShowSearchResults(false);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                activeMode === "pickup"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600/30"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <MapPin size={15} />
              <span>Setting Pickup</span>
              {pickup && <Check size={14} className="text-blue-200" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode("dropoff");
                setShowSearchResults(false);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer ${
                activeMode === "dropoff"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-500/25 ring-2 ring-rose-600/30"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Navigation size={15} />
              <span>Setting Drop-off</span>
              {dropoff && <Check size={14} className="text-rose-200" />}
            </button>

            {pickup && dropoff && (
              <button
                type="button"
                onClick={handleSwapPoints}
                title="Swap Pickup and Drop-off"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
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
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
            >
              {locating ? (
                <Loader2 size={14} className="animate-spin text-blue-600" />
              ) : (
                <LocateFixed size={14} className="text-blue-600" />
              )}
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
                className="flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Search Bar with Container Ref */}
        <div ref={searchContainerRef} className="relative mt-3.5">
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
              {searching ? (
                <Loader2 size={17} className="animate-spin text-blue-600" />
              ) : (
                <Search size={17} className="text-slate-400" />
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
                  doSearch(searchQuery, true);
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchResults(true);
                } else if (searchQuery.trim().length > 0) {
                  doSearch(searchQuery, false);
                }
              }}
              placeholder="Search e.g. BRAC University, Dhanmondi 27, Gulshan 2, Uttara, Mirpur..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-24 text-sm font-medium text-slate-800 placeholder-slate-400 shadow-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                    searchInputRef.current?.focus();
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  doSearch(searchQuery, true);
                  searchInputRef.current?.focus();
                }}
                className="rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* Autocomplete Search Results Dropdown with high z-index */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 z-[1000] mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="bg-slate-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center justify-between border-b border-slate-100">
                <span>Matching Locations ({searchResults.length})</span>
                <span className="text-[10px] text-blue-600 font-bold">
                  Click to set {activeMode === "pickup" ? "Pickup" : "Drop-off"}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectLocation(item)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-blue-50/80 cursor-pointer group"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <MapPin size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900 group-hover:text-blue-700">
                        {item.name || item.display_name?.split(",")[0] || ""}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 mt-0.5">
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

      {/* Spacious Large Map Canvas (540px - 620px) */}
      <div className="relative h-[540px] sm:h-[580px] lg:h-[620px] w-full bg-slate-100 overflow-hidden rounded-b-3xl">
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-50">
            <Loader2 className="animate-spin text-blue-600" size={36} />
            <span className="text-xs font-bold text-slate-600">Loading interactive map...</span>
          </div>
        )}

        <div ref={containerRef} className="h-full w-full" />

        {/* Floating Map Helper Badge */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-[400] flex items-center gap-2 rounded-2xl bg-slate-900/85 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-white/10">
          <MapIcon size={14} className="text-blue-400 shrink-0" />
          <span>
            Click map to set <strong className="text-blue-300">{activeMode === "pickup" ? "Pickup" : "Drop-off"}</strong>. Markers can be dragged.
          </span>
        </div>

        {/* Calculating Route Overlay */}
        {calculatingRoute && (
          <div className="absolute top-4 right-4 z-[400] flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-2 text-xs font-extrabold text-blue-700 shadow-xl backdrop-blur-md border border-blue-100">
            <Loader2 size={15} className="animate-spin text-blue-600" />
            <span>Calculating optimal route...</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
