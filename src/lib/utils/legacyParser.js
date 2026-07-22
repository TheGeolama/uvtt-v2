function generateId(prefix) {
    return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

export function upgradeLegacyMap(rawData, filename = "Unknown Map") {
    try {
        const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
        const mapName = filename.split('.')[0];

        let imageUrl = data.image || "";
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
            imageUrl = "data:image/png;base64," + imageUrl;
        }

        const res = data.resolution || {};
        const ppg = Number(res.pixels_per_grid || res.grid_size) || 70;
        const mapWidth = Number(res.map_size?.x ?? res.map_size?.[0]) || 20;
        const mapHeight = Number(res.map_size?.y ?? res.map_size?.[1]) || 20;
        const originX = Number(res.map_origin?.x ?? res.map_origin?.[0]) || 0;
        const originY = Number(res.map_origin?.y ?? res.map_origin?.[1]) || 0;

        // 1. Upgrade Walls
        const walls = [];
        const los = data.line_of_sight || data.walls || [];
        for (const item of los) {
            if (Array.isArray(item) && item.length >= 2) {
                walls.push({
                    id: generateId('wall'),
                    path: item.map(pt => ({ x: Number(pt.x), y: Number(pt.y) })),
                    properties: { type: 'standard', bottom: 0.0, top: 10.0, visibility: 'visible' }
                });
            }
        }

        // 2. Upgrade Portals
        const portals = [];
        const rawPortals = data.portals || [];
        for (const item of rawPortals) {
            let pts = [];
            if (Array.isArray(item.bounds)) pts = item.bounds; 
            else if (item.line?.p1 && item.line?.p2) pts = [item.line.p1, item.line.p2];

            if (pts.length >= 2) {
                portals.push({
                    id: generateId('portal'),
                    path: pts.map(pt => ({ x: Number(pt.x), y: Number(pt.y) })),
                    properties: { 
                        type: 'door', 
                        state: item.closed ? 'closed' : 'open',
                        bottom: 0.0, 
                        top: 10.0, 
                        visibility: 'visible'
                    }
                });
            }
        }

        // 3. Upgrade Lights (Pulling from UniversalVTT data)
        const lights = [];
        const rawLights = data.lights || [];
        for (const l of rawLights) {
            lights.push({
                id: generateId('light'),
                type: 'point',
                position: { x: Number(l.position?.x || 0), y: Number(l.position?.y || 0), z: 0 },
                properties: {
                    color: l.color ? (l.color.startsWith('#') ? l.color : `#${l.color}`) : '#ffffff',
                    intensity: Number(l.intensity) || 1.0,
                    decay_model: 'inverse_square',
                    radius: { 
                        bright: (Number(l.range) || 5) * 0.5, 
                        dim: Number(l.range) || 10 
                    },
                    animation: { profile: 'none', speed: 0.5, intensity_variance: 0.2 },
                    rotation: 0,
                    cone_angle: 60,
                    visibility: 'visible'
                }
            });
        }

        // 4. Upgrade Props / Objects (Pulling from UniversalVTT data)
        const props = [];
        const rawObjects = data.objects || [];
        for (const o of rawObjects) {
            props.push({
                id: generateId('prop'),
                name: o.name || "Imported Prop",
                image: o.image || "", // Dungeondraft uses base64 or internal IDs here
                position: { x: Number(o.center?.x || 0), y: Number(o.center?.y || 0), z: 0 },
                rotation: Number(o.rotation) || 0,
                scale: (Number(o.scale) || 1) * 100, // DD scale is usually 1.0 = 100%
                properties: { visibility: 'visible' }
            });
        }

        return {
            id: generateId('map'),
            filename: filename,
            name: mapName,
            imageUrl: imageUrl,
            manifest: {
                resolution: {
                    pixels_per_grid: ppg,
                    pixels_per_grid_y: ppg,
                    units_per_grid: 5,
                    map_size: [mapWidth, mapHeight],
                    map_origin: [originX, originY],
                    map_offset_x: 0,
                    map_offset_y: 0,
                    topology: { type: "square" }
                },
                geometry: { walls, portals, overhead: [] },
                entities: { 
                    lights, 
                    events: [], 
                    audio: { zones: [] }, 
                    emitters: [], 
                    landing_zones: [],
                    props
                },
                music: {}, 
                ambience: {}
            }
        };
    } catch (err) {
        console.error("Legacy Parser Error:", err);
        return null;
    }
}