import { useCallback, useState } from "react";

export interface Position {
  lat: number;
  lng: number;
}

type State =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "granted"; position: Position }
  | { status: "denied"; reason: string };

export function useGeolocation() {
  const [state, setState] = useState<State>({ status: "idle" });

  const request = useCallback((): Promise<Position | null> => {
    if (!("geolocation" in navigator)) {
      setState({ status: "denied", reason: "Геолокация недоступна" });
      return Promise.resolve(null);
    }

    setState({ status: "pending" });
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const position = { lat: coords.latitude, lng: coords.longitude };
          setState({ status: "granted", position });
          resolve(position);
        },
        () => {
          setState({
            status: "denied",
            reason: "Не удалось определить местоположение",
          });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
      );
    });
  }, []);

  return {
    state,
    position: state.status === "granted" ? state.position : null,
    request,
  };
}
