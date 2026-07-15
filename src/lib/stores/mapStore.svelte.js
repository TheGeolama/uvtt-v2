export const mapStore = createMapStore();

function createMapStore() {
    let activeMapId = $state(null);
    let catalog = $state([]);
    let updateTrigger = $state(0);
    let selectedItemIds = $state([]);
    let clipboard = $state([]);
    let lightingPreview = $state(false);
    let activeTool = $state("select");
    let audioBlobs = $state({});

    return {
        get activeMapId() { return activeMapId; },
        set activeMapId(id) { activeMapId = id; },
        get catalog() { return catalog; },
        get updateTrigger() { return updateTrigger; },
        get redrawTick() { return updateTrigger; },
        get selectedItemIds() { return selectedItemIds; },
        set selectedItemIds(ids) { selectedItemIds = ids; },
        get lightingPreview() { return lightingPreview; },
        get activeTool() { return activeTool; },
        get audioBlobs() { return audioBlobs; },

        get activeMap() {
            return catalog.find(m => m.id === activeMapId) || null;
        },

        setCatalog(newCatalog) {
            catalog = newCatalog;
            if (catalog.length > 0 && !activeMapId) {
                activeMapId = catalog[0].id;
            }
            updateTrigger++;
        },

        switchMap(id) {
            activeMapId = id;
            selectedItemIds = [];
            updateTrigger++;
        },

        toggleLightingPreview() {
            lightingPreview = !lightingPreview;
            updateTrigger++;
        },

        setTool(tool) {
            activeTool = tool;
            selectedItemIds = [];
            updateTrigger++;
        },

        clearSelection() {
            selectedItemIds = [];
            updateTrigger++;
        },

        selectItem(id, multi = false) {
            if (multi) {
                if (!selectedItemIds.includes(id)) {
                    selectedItemIds = [...selectedItemIds, id];
                }
            } else {
                selectedItemIds = [id];
            }
            updateTrigger++;
        },

        updateItemProperty(id, keyPath, value) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const m = activeMap.manifest;
            
            // Enforce exclusivity for default spawns
            if (keyPath === "is_default" && value === true) {
                m.entities.landing_zones?.forEach(lz => {
                    if (lz.id !== id) lz.is_default = false;
                });
            }

            // Handle global map property updates (e.g. resolution)
            if (id === activeMapId) {
                 let obj = m;
                 const keys = keyPath.split('.');
                 for (let i = 0; i < keys.length - 1; i++) {
                     if (!obj[keys[i]]) obj[keys[i]] = {};
                     obj = obj[keys[i]];
                 }
                 obj[keys[keys.length - 1]] = value;
                 updateTrigger++;
                 return;
            }

            // Handle item property updates
            let foundItem = null;
            for (const cat of ['walls', 'portals', 'overhead']) {
                if (m.geometry[cat]) {
                    foundItem = m.geometry[cat].find(i => i.id === id);
                    if (foundItem) break;
                }
            }
            if (!foundItem) {
                for (const cat of ['lights', 'landing_zones', 'events', 'emitters']) {
                    if (m.entities[cat]) {
                        foundItem = m.entities[cat].find(i => i.id === id);
                        if (foundItem) break;
                    }
                }
            }
            if (!foundItem && m.entities.audio?.zones) {
                foundItem = m.entities.audio.zones.find(i => i.id === id);
            }

            if (foundItem) {
                const keys = keyPath.split('.');
                let obj = foundItem;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!obj[keys[i]]) obj[keys[i]] = {};
                    obj = obj[keys[i]];
                }
                obj[keys[keys.length - 1]] = value;
                updateTrigger++;
            }
        },

        // --- ENTITY CREATION ---
        addGeometry(type, path) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const id = crypto.randomUUID();
            if (type === 'wall') {
                if (!activeMap.manifest.geometry.walls) activeMap.manifest.geometry.walls = [];
                activeMap.manifest.geometry.walls.push({ id, path, properties: { type: 'standard' } });
            } else if (type === 'portal') {
                if (!activeMap.manifest.geometry.portals) activeMap.manifest.geometry.portals = [];
                activeMap.manifest.geometry.portals.push({ id, path, properties: { type: 'door', state: 'closed' } });
            } else if (type === 'roof') {
                if (!activeMap.manifest.geometry.overhead) activeMap.manifest.geometry.overhead = [];
                activeMap.manifest.geometry.overhead.push({ id, path });
            }
            selectedItemIds = [id];
            updateTrigger++;
        },

        addLight(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const light = {
                id: crypto.randomUUID(), position: {x, y},
                color: '#ffffff', bright_radius: 5, dim_radius: 10,
                type: 'point', rotation: 0, cone_angle: 60
            };
            if (!activeMap.manifest.entities.lights) activeMap.manifest.entities.lights = [];
            activeMap.manifest.entities.lights.push(light);
            selectedItemIds = [light.id];
            updateTrigger++;
        },

        addSpawn(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const spawn = {
                id: crypto.randomUUID(), coordinates: [x, y],
                name: 'New Spawn', shape: 'circle', is_default: false
            };
            if (!activeMap.manifest.entities.landing_zones) activeMap.manifest.entities.landing_zones = [];
            activeMap.manifest.entities.landing_zones.push(spawn);
            selectedItemIds = [spawn.id];
            updateTrigger++;
        },

        addEvent(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const event = {
                id: crypto.randomUUID(), 
                trigger_bounds: { center: {x, y}, radius: 0.5 }, // Default to 1x1 grid size
                name: 'New Event',
                eventType: 'Trap/Door Trigger',
                targetSpawnId: ""
            };
            if (!activeMap.manifest.entities.events) activeMap.manifest.entities.events = [];
            activeMap.manifest.entities.events.push(event);
            selectedItemIds = [event.id];
            updateTrigger++;
        },

        addAudio(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const audio = { id: crypto.randomUUID(), center: {x, y}, radius: 5, track: null };
            if (!activeMap.manifest.entities.audio) activeMap.manifest.entities.audio = { zones: [] };
            if (!activeMap.manifest.entities.audio.zones) activeMap.manifest.entities.audio.zones = [];
            activeMap.manifest.entities.audio.zones.push(audio);
            selectedItemIds = [audio.id];
            updateTrigger++;
        },

        addEmitter(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const emitter = { id: crypto.randomUUID(), position: {x, y}, type: 'weather' };
            if (!activeMap.manifest.entities.emitters) activeMap.manifest.entities.emitters = [];
            activeMap.manifest.entities.emitters.push(emitter);
            selectedItemIds = [emitter.id];
            updateTrigger++;
        },

        // --- MUTATIONS ---
        updateNodePosition(id, exactX, exactY, dx, dy) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const mapData = activeMap.manifest;
            
            ['walls', 'portals', 'overhead'].forEach(cat => {
                const item = mapData.geometry[cat]?.find(i => i.id === id);
                if (item && item.path) {
                    item.path.forEach(pt => { pt.x = Number(pt.x) + dx; pt.y = Number(pt.y) + dy; });
                }
            });

            const light = mapData.entities.lights?.find(i => i.id === id);
            if (light && light.position) { light.position.x = Number(light.position.x) + dx; light.position.y = Number(light.position.y) + dy; }
            
            const spawn = mapData.entities.landing_zones?.find(i => i.id === id);
            if (spawn && spawn.coordinates) { spawn.coordinates[0] = Number(spawn.coordinates[0]) + dx; spawn.coordinates[1] = Number(spawn.coordinates[1]) + dy; }
            
            const evt = mapData.entities.events?.find(i => i.id === id);
            if (evt && evt.trigger_bounds?.center) { evt.trigger_bounds.center.x = Number(evt.trigger_bounds.center.x) + dx; evt.trigger_bounds.center.y = Number(evt.trigger_bounds.center.y) + dy; }
            
            const aud = mapData.entities.audio?.zones?.find(i => i.id === id);
            if (aud && aud.center) { aud.center.x = Number(aud.center.x) + dx; aud.center.y = Number(aud.center.y) + dy; }
            
            const em = mapData.entities.emitters?.find(i => i.id === id);
            if (em && em.position) { em.position.x = Number(em.position.x) + dx; em.position.y = Number(em.position.y) + dy; }

            updateTrigger++;
        },

        translateSelection(dx, dy) {
            if (!this.activeMap || selectedItemIds.length === 0) return;
            selectedItemIds.forEach(id => this.updateNodePosition(id, 0, 0, dx, dy));
        },

        deleteSelected() {
            const activeMap = this.activeMap;
            if (!activeMap || selectedItemIds.length === 0) return;
            const mapData = activeMap.manifest;
            
            selectedItemIds.forEach(id => {
                ['walls', 'portals', 'overhead'].forEach(cat => {
                    if (mapData.geometry[cat]) mapData.geometry[cat] = mapData.geometry[cat].filter(i => i.id !== id);
                });
                ['lights', 'landing_zones', 'events', 'emitters'].forEach(cat => {
                    if (mapData.entities[cat]) mapData.entities[cat] = mapData.entities[cat].filter(i => i.id !== id);
                });
                if (mapData.entities.audio?.zones) {
                    mapData.entities.audio.zones = mapData.entities.audio.zones.filter(i => i.id !== id);
                }
            });
            selectedItemIds = [];
            updateTrigger++;
        },

        convertCategory(id) {
            const activeMap = this.activeMap;
            if (!activeMap) return;
            const m = activeMap.manifest;
            let found = null;
            let sourceCat = null;
            
            const wallIdx = m.geometry.walls?.findIndex(w => w.id === id);
            if (wallIdx > -1) {
                found = m.geometry.walls.splice(wallIdx, 1)[0];
                sourceCat = 'walls';
            } else {
                const portIdx = m.geometry.portals?.findIndex(p => p.id === id);
                if (portIdx > -1) {
                    found = m.geometry.portals.splice(portIdx, 1)[0];
                    sourceCat = 'portals';
                }
            }

            if (found) {
                if (sourceCat === 'walls') {
                    if (!found.properties) found.properties = {};
                    found.properties.type = 'door';
                    found.properties.state = 'closed';
                    if (!m.geometry.portals) m.geometry.portals = [];
                    m.geometry.portals.push(found);
                } else {
                    if (found.properties) {
                        delete found.properties.state;
                        found.properties.type = 'standard';
                    }
                    if (!m.geometry.walls) m.geometry.walls = [];
                    m.geometry.walls.push(found);
                }
                updateTrigger++;
            }
        },

        copySelected() {
            const activeMap = this.activeMap;
            if (!activeMap || selectedItemIds.length === 0) return;
            const m = activeMap.manifest;
            clipboard = [];

            selectedItemIds.forEach(id => {
                ['walls', 'portals', 'overhead'].forEach(cat => {
                    const item = m.geometry[cat]?.find(i => i.id === id);
                    if (item) clipboard.push({ category: cat, data: JSON.parse(JSON.stringify(item)), type: 'geometry' });
                });
                ['lights', 'landing_zones', 'events', 'emitters'].forEach(cat => {
                    const item = m.entities[cat]?.find(i => i.id === id);
                    if (item) clipboard.push({ category: cat, data: JSON.parse(JSON.stringify(item)), type: 'entity' });
                });
                const aud = m.entities.audio?.zones?.find(i => i.id === id);
                if (aud) clipboard.push({ category: 'audio', data: JSON.parse(JSON.stringify(aud)), type: 'entity' });
            });
        },

        pasteClipboard(x, y) {
            const activeMap = this.activeMap;
            if (!activeMap || clipboard.length === 0) return;
            const m = activeMap.manifest;
            const newSelection = [];
            const offset = 0.5;

            clipboard.forEach(clip => {
                const clone = JSON.parse(JSON.stringify(clip.data));
                clone.id = crypto.randomUUID();

                if (clip.type === 'geometry') {
                    clone.path.forEach(pt => { pt.x = Number(pt.x) + offset; pt.y = Number(pt.y) + offset; });
                    if (!m.geometry[clip.category]) m.geometry[clip.category] = [];
                    m.geometry[clip.category].push(clone);
                } else if (clip.type === 'entity') {
                    if (clip.category === 'landing_zones' && clone.coordinates) {
                        clone.coordinates[0] = Number(clone.coordinates[0]) + offset;
                        clone.coordinates[1] = Number(clone.coordinates[1]) + offset;
                        clone.is_default = false; 
                    } else if (clip.category === 'events' && clone.trigger_bounds?.center) {
                        clone.trigger_bounds.center.x = Number(clone.trigger_bounds.center.x) + offset;
                        clone.trigger_bounds.center.y = Number(clone.trigger_bounds.center.y) + offset;
                    } else if (clip.category === 'lights' && clone.position) {
                        clone.position.x = Number(clone.position.x) + offset;
                        clone.position.y = Number(clone.position.y) + offset;
                    } else if (clip.category === 'emitters' && clone.position) {
                        clone.position.x = Number(clone.position.x) + offset;
                        clone.position.y = Number(clone.position.y) + offset;
                    } else if (clip.category === 'audio' && clone.center) {
                        clone.center.x = Number(clone.center.x) + offset;
                        clone.center.y = Number(clone.center.y) + offset;
                    }
                    
                    if (clip.category === 'audio') {
                        if (!m.entities.audio) m.entities.audio = {zones: []};
                        if (!m.entities.audio.zones) m.entities.audio.zones = [];
                        m.entities.audio.zones.push(clone);
                    } else {
                        if (!m.entities[clip.category]) m.entities[clip.category] = [];
                        m.entities[clip.category].push(clone);
                    }
                }
                newSelection.push(clone.id);
            });

            selectedItemIds = newSelection;
            updateTrigger++;
        },

        duplicateSelected() {
            this.copySelected();
            this.pasteClipboard(0, 0);
        }
    };
}