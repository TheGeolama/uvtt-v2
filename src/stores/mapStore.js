import { writable } from 'svelte/store';

const initialState = {
    imageUrl: null,
    imageBlob: null,
    manifest: null,
    activeTool: 'pan', // Tools: 'pan', 'select'
    selectedItemIds: [] // Upgraded to array for multi-select
};

export const mapStore = writable(initialState);

export const mapActions = {
    setImage: (url, blob, manifest) => {
        mapStore.update(s => ({ ...s, imageUrl: url, imageBlob: blob, manifest }));
    },
    
    setTool: (tool) => {
        mapStore.update(s => ({ 
            ...s, 
            activeTool: tool, 
            // Clear selection when switching tools
            selectedItemIds: [] 
        }));
    },

    // Handles single clicks and Shift+Clicks
    toggleSelection: (id, isMulti = false) => {
        mapStore.update(s => {
            if (!isMulti) return { ...s, selectedItemIds: [id] };
            
            const newIds = [...s.selectedItemIds];
            const index = newIds.indexOf(id);
            if (index === -1) newIds.push(id);
            else newIds.splice(index, 1);
            
            return { ...s, selectedItemIds: newIds };
        });
    },

    clearSelection: () => {
        mapStore.update(s => ({ ...s, selectedItemIds: [] }));
    },

    updateItemProperty: (id, category, propertyPath, value) => {
        mapStore.update(s => {
            if (!s.manifest) return s;

            const manifest = JSON.parse(JSON.stringify(s.manifest));
            const targetArray = category === 'portal' ? manifest.geometry.portals : manifest.geometry.walls;
            const itemIndex = targetArray.findIndex(item => item.id === id);
            
            if (itemIndex !== -1) {
                const keys = propertyPath.split('.');
                let currentRef = targetArray[itemIndex];

                for (let i = 0; i < keys.length - 1; i++) {
                    if (currentRef[keys[i]] === undefined) currentRef[keys[i]] = {}; 
                    currentRef = currentRef[keys[i]];
                }
                currentRef[keys[keys.length - 1]] = value;
            }
            
            return { ...s, manifest };
        });
    },

    // --- NEW: Merge Multiple Walls ---
    mergeSelectedWalls: () => {
        mapStore.update(s => {
            if (s.selectedItemIds.length < 2) return s;
            if (!s.manifest) return s;

            const manifest = JSON.parse(JSON.stringify(s.manifest));
            
            // Isolate the selected walls
            const wallsToMerge = manifest.geometry.walls.filter(w => s.selectedItemIds.includes(w.id));
            if (wallsToMerge.length < 2) return s; // Ensure we actually have walls selected (not just portals)

            // Base the new wall on the properties of the first selected wall
            const mergedWall = { ...wallsToMerge[0] };
            mergedWall.id = `wall_merged_${Date.now()}`;
            mergedWall.path = [];

            // Concatenate all paths into one unified vector object
            wallsToMerge.forEach((w) => {
                mergedWall.path.push(...w.path);
            });

            // Remove the old individual segments
            manifest.geometry.walls = manifest.geometry.walls.filter(w => !s.selectedItemIds.includes(w.id));
            
            // Push the new master wall
            manifest.geometry.walls.push(mergedWall);

            return { ...s, manifest, selectedItemIds: [mergedWall.id] };
        });
    }
};