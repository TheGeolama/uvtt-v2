import { writable } from 'svelte/store';

const initialState = {
    imageUrl: null,
    imageBlob: null,
    manifest: null,
    activeTool: 'pan',
    selectedItemId: null
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
            selectedItemId: tool === 'pan' ? null : s.selectedItemId 
        }));
    },

    selectItem: (id) => {
        mapStore.update(s => ({ ...s, selectedItemId: id }));
    },

    // --- NEW: Universal Deep-Property Editor ---
    updateItemProperty: (id, category, propertyPath, value) => {
        mapStore.update(s => {
            if (!s.manifest) return s;

            // Deep clone the manifest so Svelte reliably triggers reactivity on nested objects
            const manifest = JSON.parse(JSON.stringify(s.manifest));
            
            // Target the correct array (walls vs portals)
            const targetArray = category === 'portal' ? manifest.geometry.portals : manifest.geometry.walls;
            const itemIndex = targetArray.findIndex(item => item.id === id);
            
            if (itemIndex !== -1) {
                const keys = propertyPath.split('.');
                let currentRef = targetArray[itemIndex];

                // Traverse down the object path (e.g., "height" -> "top")
                for (let i = 0; i < keys.length - 1; i++) {
                    if (currentRef[keys[i]] === undefined) {
                        currentRef[keys[i]] = {}; // Initialize object if it doesn't exist
                    }
                    currentRef = currentRef[keys[i]];
                }
                
                // Assign the final value
                currentRef[keys[keys.length - 1]] = value;
            }
            
            return { ...s, manifest };
        });
    }
};