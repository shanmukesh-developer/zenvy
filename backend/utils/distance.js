/**
 * Haversine formula to calculate the great-circle distance between two points
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in kilometers
 */
function getHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
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
 * Placeholder for Geocoding and Matrix API.
 * In a production env, this would call Google Maps API.
 * For now, it returns simulated coordinates for Amaravathi region.
 */
function getCoordsForAddress(address) {
    if (!address) return { lat: 16.5062, lon: 80.6480 };
    if (address.toUpperCase().includes('SRM')) {
        return { lat: 16.4632, lon: 80.5064 };
    }
    // Default: Amaravathi City Center (simulated offset)
    return { lat: 16.5062, lon: 80.6480 };
}

/**
 * Get matrix distance and duration using Google Maps (Placeholder)
 * @param {string} origin 
 * @param {string} destination 
 * @returns {Promise<{distance: number, duration: number}>}
 */
async function getMatrixDistance(origin, destination) {
    // In production: const response = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
    // For now: Simulate real-world road distance (Haversine * 1.2 for road curvature)
    const coords1 = getCoordsForAddress(origin);
    const coords2 = getCoordsForAddress(destination);
    const hDist = getHaversineDistance(coords1.lat, coords1.lon, coords2.lat, coords2.lon);
    
    return {
        distance: parseFloat((hDist * 1.2).toFixed(2)),
        duration: Math.round(hDist * 3 + 5) // roughly 3 mins/km + 5 mins overhead
    };
}

module.exports = {
    getHaversineDistance,
    getCoordsForAddress,
    getMatrixDistance
};
