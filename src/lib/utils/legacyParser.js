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

        const walls = [];
        const los = data.line_of_sight || data.walls || [];
        for (const item of los) {
            if (Array.isArray(item) && item.length >= 2) {
                walls.push({
                    id: generateId('wall'),
                    type: 'wall',
                    path: item.map(pt => ({ x: Number(pt.x), y: Number(pt.y) })),
                    properties: { type: 'standard', blocks_movement: true, blocks_sight: true }
                });
            }
        }

        const portals = [];
        const rawPortals = data.portals || [];
        for (const item of rawPortals) {
            let pts = [];
            if (Array.isArray(item.bounds)) pts = item.bounds; 
            else if (item.line?.p1 && item.line?.p2) pts = [item.line.p1, item.line.p2];

            if (pts.length >= 2) {
                portals.push({
                    id: generateId('portal'),
                    type: 'portal',
                    path: pts.map(pt => ({ x: Number(pt.x), y: Number(pt.y) })),
                    properties: { type: 'door', state: item.closed ? 'closed' : 'open' }
                });
            }
        }

        return {
            id: generateId('map'),
            filename: filename,
            name: mapName,
            imageUrl: imageUrl,
            manifest: {
                resolution: {
                    pixels_per_grid: ppg,
                    map_size: [mapWidth, mapHeight],
                    map_origin: [originX, originY],
                    map_offset_x: 0,
                    map_offset_y: 0,
                    topology: { type: "square" }
                },
                geometry: { walls, portals, overhead: [] },
                entities: { lights: [], events: [], audio: { zones: [] }, emitters: [], landing_zones: [] },
                music: {}, ambience: {}
            }
        };
    } catch (err) {
        console.error("Legacy Parser Error:", err);
        return null;
    }
}