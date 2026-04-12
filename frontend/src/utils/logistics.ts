/**
 * Haversine distance calculator for frontend
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Road distance simulation (Haversine * 1.2)
 */
export function calculateRoadDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const hDist = calculateHaversineDistance(lat1, lon1, lat2, lon2);
    return parseFloat((hDist * 1.2).toFixed(2));
}

/**
 * Fee logic: ₹25 base + ₹10/km after 2km (with Surge support)
 */
export function calculateDeliveryFee(distanceKm: number, isElite: boolean = false, surgeMultiplier: number = 1): number {
    if (isElite) return 0;
    const baseFee = Math.max(25, Math.round(25 + Math.max(0, distanceKm - 2) * 10));
    return Math.round(baseFee * surgeMultiplier);
}

/**
 * Fallback coords for Amaravathi regions
 */
export function getCoordsForAddress(address: string | null | undefined): { lat: number, lon: number } {
    if (!address) return { lat: 16.5062, lon: 80.6480 };
    const upper = address.toUpperCase();
    if (upper.includes('SRM') || upper.includes('UNIVERSITY')) {
        return { lat: 16.4632, lon: 80.5064 };
    }
    if (upper.includes('MANGALAGIRI')) {
        return { lat: 16.4338, lon: 80.5616 };
    }
    if (upper.includes('SECRETARIAT')) {
        return { lat: 16.4862, lon: 80.4900 };
    }
    // Default Amaravathi Central
    return { lat: 16.5062, lon: 80.6480 };
}
