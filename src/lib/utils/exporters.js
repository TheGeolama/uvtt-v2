/**
 * Utility module for platform-specific VTT exports.
 * Translates internal V2 Manifest schema into proprietary formats.
 */

const sanitizeId = (id) => id.replace(/-/g, '_');

export function exportToFoundryVTT(manifest) {
    const gridSize = manifest.resolution?.pixels_per_grid || 70;
    
    const scene = {
        name: manifest.level_name || "Exported Scene",
        width: (manifest.resolution?.map_size?.[0] || 50) * gridSize,
        height: (manifest.resolution?.map_size?.[1] || 50) * gridSize,
        grid: {
            size: gridSize,
            color: manifest.resolution?.grid_color || "#ffffff",
            type: 1 // 1 = Square grid in Foundry
        },
        walls: [],
        lights: [],
        tokens: [],
        notes: []
    };

    // Foundry Walls & Portals
    const processGeometry = (items, type, sense, sound) => {
        (items || []).forEach(item => {
            if (!item.path || item.path.length < 2) return;
            // Foundry processes walls as individual line segments, not continuous paths
            for (let i = 0; i < item.path.length - 1; i++) {
                scene.walls.push({
                    _id: sanitizeId(item.id) + `_${i}`,
                    c: [
                        item.path[i].x * gridSize,
                        item.path[i].y * gridSize,
                        item.path[i + 1].x * gridSize,
                        item.path[i + 1].y * gridSize
                    ],
                    light: type === "window" ? 0 : 20, // 20 blocks light, 0 allows it to pass
                    sight: sense,
                    sound: sound,
                    door: type === "door" || type === "secret" ? 1 : 0,
                    ds: item.properties?.state === "open" ? 1 : 0
                });
            }
        });
    };

    processGeometry(manifest.geometry?.walls, "wall", 20, 20);
    processGeometry(manifest.geometry?.portals, "door", 20, 20);

    // Foundry Lights
    (manifest.entities?.lights || []).forEach(l => {
        scene.lights.push({
            _id: sanitizeId(l.id),
            x: l.position.x * gridSize,
            y: l.position.y * gridSize,
            config: {
                dim: l.properties.radius?.dim * (5 / (manifest.resolution?.units_per_grid || 5)), 
                bright: l.properties.radius?.bright * (5 / (manifest.resolution?.units_per_grid || 5)),
                color: l.properties.color || "#ffffff",
                intensity: l.properties.intensity || 1.0,
                angle: l.properties.cone_angle || 360,
                rotation: l.properties.rotation || 0
            }
        });
    });

    // Foundry Tokens (Spawns / Landing Zones)
    (manifest.entities?.landing_zones || []).forEach(lz => {
        scene.tokens.push({
            _id: sanitizeId(lz.id),
            name: lz.name || "Spawn Point",
            x: lz.coordinates[0] * gridSize,
            y: lz.coordinates[1] * gridSize,
            hidden: true
        });
    });

    return scene;
}

export function exportToRoll20(manifest) {
    const gridSize = manifest.resolution?.pixels_per_grid || 70;
    const toPx = (val) => val * gridSize;

    const roll20Data = {
        version: "2.0",
        name: manifest.level_name || "Exported Map",
        width: manifest.resolution?.map_size?.[0] || 50,
        height: manifest.resolution?.map_size?.[1] || 50,
        grid_size: gridSize,
        paths: [],
        objects: []
    };

    // Roll20 Dynamic Lighting Walls (Paths sent directly to the "walls" layer)
    const processRoll20Paths = (items, color, strokeWidth) => {
        (items || []).forEach(item => {
            if (!item.path || item.path.length < 2) return;
            
            // Roll20 requires a strictly formatted stringified array: [["M",x,y],["L",x,y]]
            const pathArray = item.path.map((pt, index) => [
                index === 0 ? "M" : "L",
                toPx(pt.x),
                toPx(pt.y)
            ]);

            roll20Data.paths.push({
                type: "path",
                layer: "walls",
                path: JSON.stringify(pathArray),
                stroke: color,
                stroke_width: strokeWidth
            });
        });
    };

    // Standard walls render blue in Roll20 DL
    processRoll20Paths(manifest.geometry?.walls, "#0000ff", 3);
    // Doors/Portals render orange to distinguish them easily for GMs
    processRoll20Paths(manifest.geometry?.portals, "#ff9900", 5);

    // Roll20 Lights (Invisible tokens configured to emit light)
    (manifest.entities?.lights || []).forEach(l => {
        roll20Data.objects.push({
            type: "graphic",
            layer: "map",
            subtype: "token",
            left: toPx(l.position.x),
            top: toPx(l.position.y),
            width: gridSize,
            height: gridSize,
            light_radius: (l.properties.radius?.dim || 10) * 5, 
            light_dimradius: (l.properties.radius?.bright || 5) * 5,
            light_otherplayers: true,
            light_hassight: false,
            name: "Light Source"
        });
    });

    // Roll20 Spawns (Pushed to GM Layer so players don't see them)
    (manifest.entities?.landing_zones || []).forEach(lz => {
        roll20Data.objects.push({
            type: "graphic",
            layer: "gmlayer",
            subtype: "token",
            left: toPx(lz.coordinates[0]),
            top: toPx(lz.coordinates[1]),
            width: gridSize,
            height: gridSize,
            name: lz.name || "Spawn"
        });
    });

    return roll20Data;
}

export function exportToFantasyGrounds(manifest) {
    const gridSize = manifest.resolution?.pixels_per_grid || 70;
    
    const fgData = {
        map: {
            name: manifest.level_name || "Exported Map",
            gridsize: gridSize,
            width: (manifest.resolution?.map_size?.[0] || 50) * gridSize,
            height: (manifest.resolution?.map_size?.[1] || 50) * gridSize,
            occluders: []
        }
    };

    // Fantasy Grounds Line of Sight (Occluders)
    const processFGOccluders = (items, type) => {
        (items || []).forEach(item => {
            if (!item.path || item.path.length < 2) return;
            
            fgData.map.occluders.push({
                id: sanitizeId(item.id),
                type: type, // FG Types: 'wall', 'door', 'window', 'terrain'
                points: item.path.map(pt => `${pt.x * gridSize},${pt.y * gridSize}`).join(",")
            });
        });
    };

    processFGOccluders(manifest.geometry?.walls, "wall");
    processFGOccluders(manifest.geometry?.portals, "door");
    processFGOccluders(manifest.geometry?.overhead, "terrain");

    return fgData;
}

export async function packageForPlatform(platform, manifest, imageBlob) {
    let payload;
    switch(platform) {
        case 'foundry':
            payload = exportToFoundryVTT(manifest);
            break;
        case 'roll20':
            payload = exportToRoll20(manifest);
            break;
        case 'fg':
            payload = exportToFantasyGrounds(manifest);
            break;
        default:
            throw new Error("Unsupported platform");
    }
    
    return {
        filename: `${manifest.level_name || 'Map_Export'}_${platform}.json`,
        data: JSON.stringify(payload, null, 2)
    };
}