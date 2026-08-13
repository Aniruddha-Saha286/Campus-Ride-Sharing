import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, LocateFixed, Trash2, Loader2 } from "lucide-react";

const BRAC_UNIVERSITY = [23.7795, 90.4055];
const PICKUP_COLOR = "#2563eb";
const DROPOFF_COLOR = "#dc2626";
const ROUTE_COLOR = "#0ea5e9";

const createIcon = (label, color) =>
  L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${color};color:#ffffff;font-size:13px;font-weight:700;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.25);">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

export default function MapPicker({ pickup, dropoff, onPickupChange, onDropoffChange, onRouteCalculated }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const routeRef = useRef(null);
  const [mode, setMode] = useState("pickup");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [calculatingRoute, setCalculatingRoute] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView(BRAC_UNIVERSITY, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.on("click", (event) => {
      const pos = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (modeRef.current === "pickup") onPickupChange(pos);
      else onDropoffChange(pos);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickup) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], {
          icon: createIcon("P", PICKUP_COLOR),
        }).addTo(map);
      } else {
        pickupMarkerRef.current.setLatLng([pickup.lat, pickup.lng]);
      }
    } else if (pickupMarkerRef.current) {
      map.removeLayer(pickupMarkerRef.current);
      pickupMarkerRef.current = null;
    }

    if (dropoff) {
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = L.marker([dropoff.lat, dropoff.lng], {
          icon: createIcon("D", DROPOFF_COLOR),
        }).addTo(map);
      } else {
        dropoffMarkerRef.current.setLatLng([dropoff.lat, dropoff.lng]);
      }
    } else if (dropoffMarkerRef.current) {
      map.removeLayer(dropoffMarkerRef.current);
      dropoffMarkerRef.current = null;
    }

    if (pickup && dropoff) {
      let isMounted = true;
      setCalculatingRoute(true);

      const drawStraightLine = () => {
        const straightCoords = [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];
        if (!routeRef.current) {
          routeRef.current = L.polyline([], { color: ROUTE_COLOR, weight: 5, opacity: 0.8 }).addTo(map);
        }
        routeRef.current.setLatLngs(straightCoords);
        map.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });
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
            const durationMins = Math.round(route.duration / 60);

            if (!routeRef.current) {
              routeRef.current = L.polyline([], { color: ROUTE_COLOR, weight: 5, opacity: 0.8 }).addTo(map);
            }
            routeRef.current.setLatLngs(routeCoords);
            map.fitBounds(routeRef.current.getBounds(), { padding: [40, 40] });

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
  }, [pickup, dropoff]);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        mapRef.current?.setView([pos.lat, pos.lng], 16);
        if (mode === "pickup") onPickupChange(pos);
        else onDropoffChange(pos);
        setLocating(false);
      },
      () => {
        setError("Could not get your location.");
        setLocating(false);
      }
    );
  };

  const modeButton = (id, label, Icon, color) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
        mode === id ? "text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
      style={mode === id ? { backgroundColor: color } : undefined}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {modeButton("pickup", "Set pickup", MapPin, PICKUP_COLOR)}
        {modeButton("dropoff", "Set dropoff", Navigation, DROPOFF_COLOR)}
        <button
          type="button"
          onClick={locateMe}
          disabled={locating}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locating ? <Loader2 className="animate-spin" size={14} /> : <LocateFixed size={14} />}
          Use my location
        </button>
        <button
          type="button"
          onClick={() => {
            if (mode === "pickup") onPickupChange(null);
            else onDropoffChange(null);
          }}
          disabled={mode === "pickup" ? !pickup : !dropoff}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={14} />
          Clear {mode === "pickup" ? "pickup" : "dropoff"}
        </button>
      </div>

      <div className="relative h-[380px] overflow-hidden rounded-xl border border-slate-200">
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
            <Loader2 className="animate-spin text-brand-500" size={26} />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}
