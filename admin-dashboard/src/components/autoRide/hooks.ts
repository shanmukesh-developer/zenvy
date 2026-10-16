"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { autoRideApi, type Driver, type Route, type PickupPoint } from '@/lib/autoRideApi';
import { errText } from './ui';

/**
 * Loads `fn()` whenever `key` or `tick` changes. A new key shows the spinner; live (tick) and
 * manual reloads refresh quietly, keeping the old rows on screen.
 */
export function useLoader<T>(key: string, tick: number, fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const first = useRef(true);
  useEffect(() => { first.current = true; }, [key]);
  useEffect(() => {
    let alive = true;
    if (first.current) setLoading(true);
    fnRef.current()
      .then((d) => { if (alive) { setData(d); setError(''); } })
      .catch((e) => { if (alive) setError(errText(e, 'Could not load.')); })
      .finally(() => { if (alive) { setLoading(false); first.current = false; } });
    return () => { alive = false; };
  }, [key, tick, manual]);
  return { data, loading, error, reload: () => setManual((m) => m + 1) };
}

export interface Lookups {
  drivers: Map<string, Driver>;
  routes: Route[];
  routeById: Map<string, Route>;
  pickupById: Map<string, PickupPoint & { routeName: string }>;
  error: string;
}

/** Driver + route names for joining ids in trips / bookings / queues (the list endpoints return ids only). */
export function useLookups(tick: number, enabled: boolean): Lookups {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([autoRideApi.drivers('ALL'), autoRideApi.routes()])
      .then(([d, r]) => { if (alive) { setDrivers(d.drivers || []); setRoutes(r.routes || []); setError(''); } })
      .catch((e) => { if (alive) setError(errText(e, 'Could not load driver / route names.')); });
    return () => { alive = false; };
  }, [tick, enabled]);
  return useMemo(() => {
    const pickupById = new Map<string, PickupPoint & { routeName: string }>();
    for (const r of routes) for (const p of r.pickupPoints || []) pickupById.set(String(p.id), { ...p, routeName: r.name });
    return {
      drivers: new Map(drivers.map((d) => [String(d.id), d])),
      routes,
      routeById: new Map(routes.map((r) => [String(r.id), r])),
      pickupById,
      error,
    };
  }, [drivers, routes, error]);
}
