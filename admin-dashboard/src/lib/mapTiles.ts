/**
 * Base map tiles for the admin maps. CARTO's free basemaps (dark_all) now answer every request with an
 * "API KEY REQUIRED" image, so the maps use the free OpenStreetMap standard tiles (no key; attribution
 * required; fine for the admin team's light traffic) and darken them with a CSS filter (globals.css,
 * `.zenvy-dark-tiles`) to keep the dark command-centre look.
 */
export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_TILE_MAX_ZOOM = 19;
export const MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
export const MAP_TILE_CLASS = 'zenvy-dark-tiles';
