/**
 * legacyParser.js
 * Parses a v1 .dd2vtt/.df2vtt file, extracts the Base64 image into a Blob URL,
 * and normalizes the old geometry into the UVTT v2 SVG-style format.
 */

function base64ToBlob(base64, mimeType = 'image/png') {
    const byteCharacters = atob(base64);
    const byteArrays = [];

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

export async function upgradeLegacyMap(file) {
    const fileText = await file.text();
    const legacyData = JSON.parse(fileText);

    let base64String = legacyData.image || ''; 
    if (!base64String) throw new Error("Map file missing required 'image' Base64 data.");

    if (typeof base64String === 'string' && base64String.includes(',')) {
        base64String = base64String.split(',')[1];
    }
    if (base64String.indexOf('\n') !== -1 || base64String.indexOf(' ') !== -1) {
        base64String = base64String.replace(/\s/g, '');
    }

    const imageBlob = base64ToBlob(base64String, 'image/png');
    const imageObjectUrl = URL.createObjectURL(imageBlob);

    // --- 1. Translate Standard Walls ---
    const upgradedWalls = [];
    if (legacyData.line_of_sight) {
        legacyData.line_of_sight.forEach((wallSegment, index) => {
            if (wallSegment.length < 2) return;

            const v2Path = wallSegment.map((point, ptIndex) => {
                const px = point.x !== undefined ? point.x : point[0];
                const py = point.y !== undefined ? point.y : point[1];
                return { type: ptIndex === 0 ? "move" : "line", x: px, y: py };
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
                return { type: ptIndex === 0 ? "move" : "line", x: px, y: py };
            });

            // If closed is true, it's a door. Otherwise, a window.
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
            portals: upgradedPortals, // Injects Portals into the Svelte Store!
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