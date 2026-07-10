/**
 * UvttMigrationEngine
 * Handles the compilation of the Master Normalized State (UVTT v2) 
 * down to specific target version footprints.
 */
export class UvttMigrationEngine {
    
    /**
     * Compiles the Master Normalized State down to a specific target version footprint.
     */
    static compileToTarget(masterManifest, targetVersion) {
        if (targetVersion === "2.0.0") {
            return masterManifest; // Full features retained for native v2 ZIP compilation
        } else if (targetVersion === "1.0.0") {
            return this.downgradeToV1(masterManifest);
        } else {
            throw new Error(`Target export profile unhandled: ${targetVersion}`);
        }
    }

    /**
     * Graceful Degradation: V1 cannot read SVG Bézier curves, Landing Zones, or Audio.
     */
    static downgradeToV1(master) {
        const v1Format = {
            format: "0.2", // Standard legacy df2vtt/dd2vtt format version mapping
            resolution: {
                map_origin: { x: master.resolution.map_origin.x, y: master.resolution.map_origin.y },
                map_size: { x: master.resolution.grid_size.x, y: master.resolution.grid_size.y },
                pixels_per_grid: master.resolution.grid_size.x
            },
            line_of_sight: [],
            portals: [],
            lights: [],
            // Metadata Embedding: Ensure future engines know features were pruned during downgrade
            __uvtt_migration_fallback: "Original V2 features (audio, events, landing zones, roofs) pruned during downgrade to legacy v1.0.0."
        };

        // 1. Flatten and Downgrade Walls
        if (master.geometry && master.geometry.walls) {
            master.geometry.walls.forEach(wall => {
                const flatPoints = this.flattenSvgPath(wall.path);
                v1Format.line_of_sight.push(flatPoints);
            });
        }

        // 2. Flatten and Downgrade Portals
        if (master.geometry && master.geometry.portals) {
            master.geometry.portals.forEach(portal => {
                const flatPath = this.flattenSvgPath(portal.path);
                v1Format.portals.push({
                    bounds: flatPath,
                    closed: portal.type === 'door',
                    freestanding: false
                });
            });
        }

        // 3. Downgrade Lights (map bright/dim radiuses back to a single legacy range)
        if (master.lights) {
            master.lights.forEach(light => {
                let cleanColor = light.color.replace('#', '');
                // V1 expects an 8-character hex (RGBA), so we pad with FF for full opacity
                if (cleanColor.length === 6) cleanColor += 'ff';

                v1Format.lights.push({
                    position: { x: light.position.x, y: light.position.y },
                    range: light.radius.dim || light.radius.bright || 10.0,
                    color: cleanColor,
                    intensity: 1.0
                });
            });
        }

        return v1Format;
    }

    /**
     * Mathematically subdivides smooth SVG Bézier paths into a series of rigid, 
     * multi-point straight-line approximations for legacy engines.
     */
    static flattenSvgPath(pathArray) {
        const points = [];
        let currentPt = { x: 0, y: 0 };

        pathArray.forEach(node => {
            if (node.type === 'move' || node.type === 'line') {
                currentPt = { x: node.x, y: node.y };
                points.push(currentPt);
            } else if (node.type === 'bezier') {
                const steps = 10; // Subdivide curve into 10 straight segments
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const invT = 1 - t;
                    
                    // Standard cubic bezier parametric equation
                    const x = invT * invT * invT * currentPt.x +
                              3 * invT * invT * t * node.cp1.x +
                              3 * invT * t * t * node.cp2.x +
                              t * t * t * node.x;
                              
                    const y = invT * invT * invT * currentPt.y +
                              3 * invT * invT * t * node.cp1.y +
                              3 * invT * t * t * node.cp2.y +
                              t * t * t * node.y;
                              
                    points.push({ x, y });
                }
                currentPt = { x: node.x, y: node.y };
            }
        });
        return points;
    }
}