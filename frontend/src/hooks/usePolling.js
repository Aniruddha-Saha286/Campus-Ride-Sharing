import { useEffect, useRef } from "react";

const usePolling = (callback, intervalMs = 7000) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const inFlightRef = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } catch {
      } finally {
        inFlightRef.current = false;
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
};

export default usePolling;
