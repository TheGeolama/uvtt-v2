// --- legacyParser.js ---
// Production-grade, high-performance legacy V1 format parser (dd2vtt, df2vtt, uvtt)
// Translates flat-pixel structures into modern UVTT v2 Topological Spatial Networks

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatName(filename) {
    if (!filename) return "Unnamed Map";
    const base = filename.substring(0, filename.lastIndexOf('.')) || filename;
    return base
        .split(/[-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function sanitizeHexColor(colorStr) {
    if (!colorStr) return "#ffffff";
    let hex = colorStr.trim().replace(/^#/, '');
    if (hex.length === 8) {
        hex = hex.substring(0, 6);
    }
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
        return "#" + hex;
    }
    return "#ffffff";
}

function base64ToBlob(base64Str, contentType = 'image/webp') {
    // THE FIX: Aggressively strip out newlines and spaces before decoding to prevent `atob()` DOMExceptions
    const base64 = base64Str.replace(/^data:image\/[a-zA-Z0-9+-.]+;base64,/, '').replace(/\s+/g, '');
    const sliceSize = 512;
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

export function upgradeLegacyMap(v1, filename) {
    // Check if the file is already a V2 manifest
    if (v1.format_version === "2.0.0" || v1.manifest) {
        const manifest = v1.manifest || v1;
        const imgUrl = v1.imageUrl || v1.image || "";
        return {
            id: v1.id || generateUUID(),
            name: v1.name || formatName(filename),
            filename: filename,
            imageUrl: imgUrl,
            image: imgUrl,
            manifest: manifest
        };
    }

    const mapWidth = v1.resolution?.map_size?.x || 20;
    const mapHeight = v1.resolution?.map_size?.y || 20;
    const pixelsPerGrid = v1.resolution?.pixels_per_grid || 70;
    const unitsPerGrid = v1.resolution?.units_per_grid || 5;

    // Convert Base64 payload to memory-safe binary Blob Object URL
    let imageUrl = "";
    if (v1.image) {
        try {
            const blob = base64ToBlob(v1.image, 'image/webp');
            imageUrl = URL.createObjectURL(blob);
        } catch (e) {
            console.error("Failed to convert legacy base64 image payload to Blob:", e);
        }
    }

    // Initialize the shared vertex registration map to prevent raycasting gaps (0.05 map units threshold)
    const SNAP_TOLERANCE = 0.05;
    const vertexRegistry = [];

    function snapPoint(x, y) {
        for (const v of vertexRegistry) {
            const dx = v.x - x;
            const dy = v.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= SNAP_TOLERANCE) {
                return { x: v.x, y: v.y };
            }
        }
        const newVertex = { x, y };
        vertexRegistry.push(newVertex);
        return newVertex;
    }

    // 1. Convert Legacy Line of Sight vectors to SVG-style Wall structures
    const wallsArray = [];
    if (v1.line_of_sight) {
        v1.line_of_sight.forEach((los, idx) => {
            // THE FIX: Gracefully handle raw coordinate arrays vs object arrays for legacy walls
            const poly = Array.isArray(los) ? los : los.poly;
            if (!poly || poly.length < 2) return;
            
            const path = [];
            poly.forEach((pt, pIdx) => {
                const rawX = pt.x !== undefined ? pt.x : pt[0];
                const rawY = pt.y !== undefined ? pt.y : pt[1];
                const snapped = snapPoint(rawX, rawY);
                path.push({
                    type: pIdx === 0 ? "move" : "line",
                    x: snapped.x,
                    y: snapped.y
                });
            });
            
            wallsArray.push({
                id: `wall_${idx}_${generateUUID().slice(0, 8)}`,
                type: "wall",
                path: path,
                properties: {
                    type: "standard",
                    blocks_sight: true,
                    blocks_light: true,
                    blocks_movement: true,
                    height: { bottom: 0.0, top: 10.0 }
                }
            });
        });
    }

    // 2. Convert Legacy Portals (Doors / Windows)
    const portalsArray = [];
    if (v1.portals) {
        v1.portals.forEach((portal, idx) => {
            // THE FIX: Gracefully handle raw coordinate arrays vs object arrays for legacy portals
            const bounds = Array.isArray(portal) ? portal : portal.bounds;
            if (!bounds || bounds.length < 2) return;
            
            const path = [];
            bounds.forEach((pt, pIdx) => {
                const rawX = pt.x !== undefined ? pt.x : pt[0];
                const rawY = pt.y !== undefined ? pt.y : pt[1];
                const snapped = snapPoint(rawX, rawY);
                path.push({
                    type: pIdx === 0 ? "move" : "line",
                    x: snapped.x,
                    y: snapped.y
                });
            });
            
            portalsArray.push({
                id: `portal_${idx}_${generateUUID().slice(0, 8)}`,
                type: "portal",
                category: portal.closed ? "door" : "window",
                path: path,
                properties: {
                    type: portal.closed === false ? "window" : "door",
                    closed: portal.closed !== false,
                    blocks_sight: portal.closed !== false,
                    blocks_light: portal.closed !== false,
                    blocks_movement: portal.closed !== false
                }
            });
        });
    }

    // 3. Convert Legacy Point Light Sources (RGBA parsing, dual bright/dim translation)
    const lightsArray = [];
    if (v1.lights) {
        v1.lights.forEach((light, idx) => {
            if (!light.position) return;
            const rawX = light.position.x !== undefined ? light.position.x : light.position[0];
            const rawY = light.position.y !== undefined ? light.position.y : light.position[1];
            const snapped = snapPoint(rawX, rawY);
            const range = light.range || 10.0;
            lightsArray.push({
                id: `light_${idx}_${generateUUID().slice(0, 8)}`,
                type: "point",
                position: { x: snapped.x, y: snapped.y, z: 1.5 },
                color: sanitizeHexColor(light.color),
                bright_radius: range * 0.5,
                dim_radius: range,
                decay: "inverse_square",
                animation: { type: "pulse", speed: 1.0, intensity_variance: 0.1 }
            });
        });
    }

    // Create the fully unified UVTT v2 indexer, geometry, and entities manifest
    const mapName = formatName(filename);
    const upgradedManifest = {
        format_version: "2.0.0",
        name: mapName,
        resolution: {
            map_size: [mapWidth, mapHeight],
            pixels_per_grid: pixelsPerGrid,
            units_per_grid: unitsPerGrid,
            grid_size: pixelsPerGrid,
            topology: { type: "square" }
        },
        environment: {
            global_wind: { speed: 0.0, angle: 0.0, gust_variance: 0.0 }
        },
        music: { zones: [] },
        ambience: { zones: [] },
        geometry: {
            walls: wallsArray,
            portals: portalsArray,
            overhead: []
        },
        entities: {
            lights: lightsArray,
            events: [],
            audio: { zones: [] },
            emitters: [],
            landing_zones: [
                {
                    id: "lz_default",
                    name: "Main Entrance",
                    is_default: true,
                    coordinates: [mapWidth / 2, mapHeight / 2],
                    heading_degrees: 0.0,
                    properties: {
                        description: "Default party spawn point",
                        camera_zoom_level: 1.0
                    }
                }
            ]
        }
    };

    return {
        id: generateUUID(),
        name: mapName,
        filename: filename,
        imageUrl: imageUrl,
        image: imageUrl,
        manifest: upgradedManifest
    };
}