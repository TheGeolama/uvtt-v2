/**
 * FULL UVTT V2 COMPILE PIPELINE
 * Dynamically converts the In-Memory Normalized Model into the strict, official schemas.
 */
export async function buildUVTT2Archive(catalog, audioBlobs = {}) {
    const zip = new JSZip();
    const mapCatalogIndex = [];

    // Loop through the catalog to build map files
    for (let i = 0; i < catalog.length; i++) {
        const mapDef = catalog[i];
        const m = mapDef.manifest;
        const slug = slugify(mapDef.filename) || `map-${i}`;

        // Add to Global Manifest Index
        mapCatalogIndex.push({
            id: mapDef.id,
            name: mapDef.filename,
            slug: slug,
            path: `maps/${slug}/`,
            z_index: i
        });

        // ----------------------------------------------------
        // 1. BUILD GEOMETRY.JSON (Strict SVG Path Translations)
        // ----------------------------------------------------
        const geometryPayload = {
            format_version: "2.0.0",
            resolution: {
                map_origin: { x: 0.0, y: 0.0 },
                grid_size: { x: m.resolution?.pixels_per_grid || 70, y: m.resolution?.pixels_per_grid || 70 },
                units_per_grid: 5.0,
                unit_name: "ft",
                topology: { type: "square", orientation: "flat_top", offset: "odd_row" }
            },
            geometry: { walls: [], portals: [], overhead: [] }
        };

        (m.geometry?.walls || []).forEach(w => {
            const svgPath = [];
            w.path.forEach((pt, idx) => {
                if (idx === 0) {
                    svgPath.push({ type: "move", x: pt.x, y: pt.y });
                } else if (pt.cp1 && pt.cp2) {
                    svgPath.push({ type: "bezier", cp1: { x: pt.cp1.x, y: pt.cp1.y }, cp2: { x: pt.cp2.x, y: pt.cp2.y }, to: { x: pt.x, y: pt.y } });
                } else {
                    svgPath.push({ type: "line", x: pt.x, y: pt.y });
                }
            });

            geometryPayload.geometry.walls.push({
                id: w.id,
                type: w.properties?.type || "standard",
                height: { bottom: w.properties?.bottom ?? 0.0, top: w.properties?.top ?? 10.0 }, // 3D Compliance
                directional_blocks: {
                    left_to_right: ["light", "sight", "movement"], 
                    right_to_left: ["light", "sight", "movement"]
                },
                path: svgPath,
                states: { ethereal: false, disbelieved_by: [] }
            });
        });

        (m.geometry?.portals || []).forEach(p => {
            if (!p.path || p.path.length < 2) return;
            // Map our 'secret' enum to the strict 'secret_door'
            const officialType = p.properties?.type === "secret" ? "secret_door" : (p.properties?.type || "door");
            
            geometryPayload.geometry.portals.push({
                id: p.id,
                type: officialType,
                state: p.properties?.state || "closed",
                height: { bottom: p.properties?.bottom ?? 0.0, top: p.properties?.top ?? 10.0 },
                blocks: ["light", "sight", "movement"],
                line: {
                    p1: { x: p.path[0].x, y: p.path[0].y },
                    p2: { x: p.path[1].x, y: p.path[1].y }
                },
                permeability: { weather_particles: false, audio_muffling: 1.0 }
            });
        });

        (m.geometry?.overhead || []).forEach(r => {
            geometryPayload.geometry.overhead.push({
                id: r.id,
                type: "roof",
                height: { bottom: r.properties?.bottom ?? 10.0, top: r.properties?.top ?? 20.0 },
                polygon: r.path.map(pt => ({ x: pt.x, y: pt.y })),
                image: { uri: "" }
            });
        });

        // ----------------------------------------------------
        // 2. BUILD ENTITIES.JSON (Property Flattening & URI Routing)
        // ----------------------------------------------------
        const entitiesPayload = {
            format_version: "2.0.0",
            lights: [],
            landing_zones: [],
            events: [],
            audio: { zones: [] },
            emitters: [],
            props: [] // FIX: Ensured props array exists for the archive
        };

        (m.entities?.lights || []).forEach(l => {
            const lightObj = {
                id: l.id,
                type: l.type || "point",
                position: { x: l.position.x, y: l.position.y, z: l.position.z || 0.0 },
                color: l.properties?.color || "#ffffff",
                bright_radius: l.properties?.radius?.bright || 5.0,
                dim_radius: l.properties?.radius?.dim || 10.0,
                decay: l.properties?.decay_model || "inverse_square"
            };
            if (l.type === "directional") {
                lightObj.cone = { rotation: l.properties?.rotation || 0.0, arc: l.properties?.cone_angle || 60.0 };
            }
            if (l.properties?.animation?.profile && l.properties.animation.profile !== "none") {
                lightObj.animation = {
                    type: l.properties.animation.profile,
                    speed: l.properties.animation.speed || 1.0,
                    intensity_variance: l.properties.animation.intensity_variance || 0.2
                };
            }
            entitiesPayload.lights.push(lightObj);
        });

        (m.entities?.landing_zones || []).forEach(lz => {
            entitiesPayload.landing_zones.push({
                id: lz.id,
                name: lz.name || "Spawn Point",
                is_default: lz.is_default || false,
                coordinates: [lz.coordinates[0], lz.coordinates[1]],
                heading_degrees: lz.heading_degrees ?? 0.0, // Forced compliance
                properties: { description: "", camera_zoom_level: 1.0 }
            });
        });

        (m.entities?.events || []).forEach(ev => {
            const isTeleport = ev.eventType === "Teleport" || ev.eventType === "Stairs/Ladder";
            
            const eventObj = {
                id: ev.id,
                type: isTeleport ? "teleport" : "trap",
                trigger_bounds: {
                    shape: "rectangle",
                    center: { x: ev.trigger_bounds?.center?.x || 0.0, y: ev.trigger_bounds?.center?.y || 0.0 },
                    width: ev.trigger_bounds?.width || 1.0,
                    height: ev.trigger_bounds?.height || 1.0
                },
                conditions: {
                    requires_interaction: ev.activation === "interaction",
                    allowed_modes: ["walking", "running"]
                }
            };

            // URI Topological Routing Math
            if (isTeleport) {
                let destType = "intra_map";
                let targetSlug = slug;
                let extension = "";

                if (ev.targetFloorId && ev.targetFloorId !== mapDef.id) {
                    const targetMap = catalog.find(cm => cm.id === ev.targetFloorId);
                    if (targetMap) {
                        targetSlug = slugify(targetMap.filename);
                        destType = "inter_map";
                        extension = ".uvtt2z"; 
                    }
                }

                const protocol = destType === "inter_map" ? "relative://" : "internal://";

                eventObj.destination = {
                    type: destType,
                    uri: `${protocol}${targetSlug}${extension}#${ev.targetSpawnId}`,
                    fade_transition: "crossfade_black",
                    prediction_trigger_radius: 2.0
                };
            }
            entitiesPayload.events.push(eventObj);
        });

        (m.entities?.audio?.zones || []).forEach(az => {
            entitiesPayload.audio.zones.push({
                id: az.id,
                shape: "circle",
                center: { x: az.center.x, y: az.center.y },
                radius: az.inner_radius || 2.5,     // Engine inner maps to spec core radius
                fade_radius: az.radius || 5.0,      // Engine max fade maps to spec fade_radius
                volume_max: (az.volume || 100) / 100.0,
                audio_uri: az.track ? `assets/audio/${az.track}` : "",
                muffled_by_geometry: az.muffledByWalls ?? true // Spec Patch: Acoustic Occlusion
            });
        });

        (m.entities?.emitters || []).forEach(em => {
            const emitterObj = {
                id: em.id,
                type: em.type === "weather" ? (em.style || "rain") : em.type,
                is_global: em.isGlobal || false, // Spec Patch: Global Overrides
                properties: {
                    intensity: (em.intensity || 50) / 100.0,
                    speed: em.speed || 50.0,
                    angle: em.direction || 180.0,
                    color: em.tint || "#ffffff",
                    render_layer: em.layering === "above" ? "above_overhead" : "below_overhead" // Spec Patch: Z-Index Layering
                }
            };
            
            // If it isn't global, we supply the mandatory bounds
            if (!em.isGlobal) {
                emitterObj.bounds = { shape: "circle", points: [] }; // simplified bounding box
            }
            
            entitiesPayload.emitters.push(emitterObj);
        });

        // FIX: Inject Props into the Archive
        (m.entities?.props || []).forEach(prop => {
            entitiesPayload.props.push({
                id: prop.id,
                name: prop.name || "Prop",
                image: prop.image || "",
                position: { 
                    x: prop.position?.x || 0.0, 
                    y: prop.position?.y || 0.0, 
                    z: prop.position?.z || 0.0 
                },
                rotation: Number(prop.rotation) || 0.0,
                scale: Number(prop.scale) || 100.0,
                properties: {
                    visibility: prop.properties?.visibility || 'visible'
                }
            });
        });

        // Write map data into Zip layout
        zip.file(`maps/${slug}/geometry.json`, JSON.stringify(geometryPayload, null, 2));
        zip.file(`maps/${slug}/entities.json`, JSON.stringify(entitiesPayload, null, 2));
    }

    // ----------------------------------------------------
    // 3. BUILD GLOBAL MANIFEST.JSON
    // ----------------------------------------------------
    const globalManifest = {
        format_version: "2.0.0",
        uvtt_version: "2.0.0",
        campaign_name: "Exported UVTT v2 Campaign",
        author: "UVTT v2 Compiler",
        hardware_profile: {
            minimum_pipeline: "webgl2",
            recommended_pipeline: "webgpu",
            requires_compute_shaders: false
        },
        environment: { global_wind: { speed: 5.0, angle: 45.0, gust_variance: 0.15 } },
        map_catalog: mapCatalogIndex
    };

    zip.file("manifest.json", JSON.stringify(globalManifest, null, 2));

    // Append localized Audio Files into the correct directory
    for (const [trackName, blob] of Object.entries(audioBlobs)) {
        zip.file(`assets/audio/${trackName}`, blob);
    }

    // ----------------------------------------------------
    // 4. GENERATE SECURE RECEIPT (manifest.hash)
    // ----------------------------------------------------
    const fileHashes = [];
    if (window.crypto && window.crypto.subtle) {
        for (const relativePath in zip.files) {
            if (!zip.files[relativePath].dir) {
                try {
                    const fileData = await zip.file(relativePath).async("uint8array");
                    const hashBuffer = await window.crypto.subtle.digest('SHA-256', fileData);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    fileHashes.push(`${relativePath}:${hashHex}`);
                } catch (e) {
                    console.warn(`Failed to hash ${relativePath}`, e);
                }
            }
        }
    } else {
        fileHashes.push("# SECURITY WARNING: Client lacked HTTPS/WebCrypto API to hash files.");
    }
    
    zip.file("manifest.hash", fileHashes.join("\n"));

    return zip.generateAsync({ type: "blob" });
}