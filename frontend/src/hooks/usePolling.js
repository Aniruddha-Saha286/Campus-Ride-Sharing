import { useEffect, useRef } from "react";
import { onRealtime } from "../api/realtimeBus";

const usePolling = (callback, intervalMs = 7000) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const inFlightRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await callbackRef.current();
      } catch {
      } finally {
        inFlightRef.current = false;
      }
    };

    const off = onRealtime(() => {
      run();
    });

    run();
    const timer = setInterval(run, intervalMs);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [intervalMs]);
};

export default usePolling;
