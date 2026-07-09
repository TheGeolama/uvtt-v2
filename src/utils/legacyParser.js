/**
 * legacyParser.js
 * Parses a v1 .dd2vtt/.df2vtt file, extracts the Base64 image into a Blob URL,
 * and normalizes the old geometry into the UVTT v2 SVG-style format.
 */

function base64ToBlob(base64, mimeType = 'image/png') {
    // Strip potential data URI prefix to prevent InvalidCharacterError
    if (typeof base64 === 'string' && base64.includes(',')) {
        base64 = base64.split(',')[1];
    }
    // Remove whitespace/newlines which can also break atob()
    base64 = base64.replace(/\s/g, '');

    const byteCharacters = atob(base64);
    const byteArrays = [];

    // Process in chunks to bypass memory/URL limits
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteArray = new Uint8Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteArray[i] = slice.charCodeAt(i);
        }
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
}

/**
 * Snaps a given coordinate to an existing vertex if it falls within the tolerance radius.
 * This mathematically seals corners to prevent VTT light-leaks.
 */
function snapCoordinates(x, y, registry, tolerance = 0.05) {
    for (const pt of registry) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= tolerance) {
            return { x: pt.x, y: pt.y }; // Snap to the existing point
        }
    }
    
    // If no nearby point is found, register this as a new anchor point
    const newPt = { x, y };
    registry.push(newPt);
    return newPt;
}

export async function upgradeLegacyMap(file) {
    const fileText = await file.text();
    const legacyData = JSON.parse(fileText);

    // Safety check for missing or improperly formatted image payloads
    if (!legacyData.image) throw new Error("Map file missing required 'image' Base64 data.");

    const imageBlob = base64ToBlob(legacyData.image, 'image/png');
    const imageObjectUrl = URL.createObjectURL(imageBlob);

    // --- Vertex Snapping Initialization ---
    const vertexRegistry = []; 
    const SNAP_TOLERANCE = 0.05; // Map units

    // --- 1. Translate Standard Walls ---
    const upgradedWalls = [];
    if (legacyData.line_of_sight) {
        legacyData.line_of_sight.forEach((wallSegment, index) => {
            if (wallSegment.length < 2) return;

            const v2Path = wallSegment.map((point, ptIndex) => {
                const px = point.x !== undefined ? point.x : point[0];
                const py = point.y !== undefined ? point.y : point[1];
                
                // Snap coordinates to seal geometry
                const snapped = snapCoordinates(px, py, vertexRegistry, SNAP_TOLERANCE);

                return { type: ptIndex === 0 ? "move" : "line", x: snapped.x, y: snapped.y };
            });

            upgradedWalls.push({
                id: `wall_legacy_${index}`,
                type: "standard",
                height: { bottom: 0.0, top: 10.0 },
                path: v2Path
            });
        });
    }

    // --- 2. Translate Portals (Doors & Windows) ---
    const upgradedPortals = [];
    if (legacyData.portals) {
        legacyData.portals.forEach((portal, index) => {
            if (!portal.bounds || portal.bounds.length < 2) return;

            const v2Path = portal.bounds.map((point, ptIndex) => {
                const px = point.x !== undefined ? point.x : point[0];
                const py = point.y !== undefined ? point.y : point[1];
                
                // Snap coordinates so doors physically lock into surrounding walls
                const snapped = snapCoordinates(px, py, vertexRegistry, SNAP_TOLERANCE);

                return { type: ptIndex === 0 ? "move" : "line", x: snapped.x, y: snapped.y };
            });

            const portalType = portal.closed ? "door" : "window";

            upgradedPortals.push({
                id: `portal_legacy_${index}`,
                type: portalType,
                path: v2Path
            });
        });
    }

    const upgradedManifest = {
        format_version: "2.0.0",
        resolution: {
            map_origin: { x: legacyData.resolution?.map_origin?.x || 0, y: legacyData.resolution?.map_origin?.y || 0 },
            grid_size: { x: legacyData.resolution?.pixels_per_grid || 70, y: legacyData.resolution?.pixels_per_grid || 70 },
            units_per_grid: 5,
            unit_name: "ft",
            topology: { type: "square", orientation: "flat_top", offset: "none", isometric_ratio: null }
        },
        geometry: {
            walls: upgradedWalls,
            portals: upgradedPortals,
            overhead: []
        },
        lights: [],
        events: []
    };

    return {
        imageUrl: imageObjectUrl,
        imageBlob: imageBlob,
        manifest: upgradedManifest
    };
}