import * as PIXI from 'pixi.js';

export class VisionEngine {
    constructor(app, mapWidth, mapHeight, parentContainer) {
        this.app = app;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.walls = [];
        this.parentContainer = parentContainer;

        // 1. The Render Texture holds our Fog of War
        this.fowTexture = PIXI.RenderTexture.create({
            width: mapWidth,
            height: mapHeight
        });

        // 2. The Sprite that displays the FoW on the canvas
        this.fowSprite = new PIXI.Sprite(this.fowTexture);
        this.fowSprite.alpha = 0.95; // Darkness opacity for Player View
        
        // 3. Graphics object used to draw the visible light polygons
        this.lightGraphics = new PIXI.Graphics();
        // Pixi v8 blend mode string
        this.lightGraphics.blendMode = 'erase';

        // 4. Background rect to reset the Fog every frame
        this.darknessRect = new PIXI.Graphics();
        this.darknessRect.rect(0, 0, mapWidth, mapHeight).fill(0x000000);
        
        // Add FoW sprite directly to the pan/zoom viewport
        if (this.parentContainer) {
            this.parentContainer.addChild(this.fowSprite);
        }
    }

    /**
     * @param {Array} pixelWalls - Array of line segments in exact pixel coordinates
     */
    updateGeometry(pixelWalls) {
        this.walls = [...pixelWalls];
        
        // Always include the map boundaries so rays don't fire into infinity
        this.walls.push(
            { p1: { x: 0, y: 0 }, p2: { x: this.mapWidth, y: 0 } },
            { p1: { x: this.mapWidth, y: 0 }, p2: { x: this.mapWidth, y: this.mapHeight } },
            { p1: { x: this.mapWidth, y: this.mapHeight }, p2: { x: 0, y: this.mapHeight } },
            { p1: { x: 0, y: this.mapHeight }, p2: { x: 0, y: 0 } }
        );
    }

    renderVision(lightSources) {
        if (!this.app || !this.app.renderer) return;

        // Step 1: Reset the Render Texture with solid darkness
        this.app.renderer.render({ 
            container: this.darknessRect, 
            target: this.fowTexture, 
            clear: true 
        });

        this.lightGraphics.clear();

        // Step 2: Calculate vision polygon for each light source
        for (const source of lightSources) {
            const polygon = this.calculateVisibilityPolygon(source.x, source.y, source.radius);
            
            if (polygon.length > 0) {
                // Draw the polygonal vision wedge
                this.lightGraphics.poly(polygon);
                this.lightGraphics.fill({ color: 0xFFFFFF, alpha: 1.0 });
            }
        }

        // Step 3: Render the erased holes into the Fog of War
        this.app.renderer.render({ 
            container: this.lightGraphics, 
            target: this.fowTexture, 
            clear: false 
        });
    }

    calculateVisibilityPolygon(ox, oy, radius) {
        let points = [];
        let angles = [];

        // Collect angles to all wall endpoints
        for (const wall of this.walls) {
            for (const p of [wall.p1, wall.p2]) {
                const angle = Math.atan2(p.y - oy, p.x - ox);
                // Cast three rays per vertex: direct hit, and slightly offset
                angles.push(angle - 0.00001, angle, angle + 0.00001);
            }
        }

        // Remove duplicate angles and sort them rotationally
        angles = [...new Set(angles)].sort((a, b) => a - b);

        // Cast rays
        for (const angle of angles) {
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            const rx = ox + dx * radius;
            const ry = oy + dy * radius;

            let closestIntersect = null;
            let minT1 = 1.0; 

            for (const wall of this.walls) {
                const intersect = this.getIntersection(
                    ox, oy, rx, ry,
                    wall.p1.x, wall.p1.y, wall.p2.x, wall.p2.y
                );

                if (intersect && intersect.t1 < minT1) {
                    minT1 = intersect.t1;
                    closestIntersect = { x: intersect.x, y: intersect.y };
                }
            }

            if (closestIntersect) {
                points.push(closestIntersect);
            } else {
                points.push({ x: rx, y: ry });
            }
        }

        // Flatten the array for PixiJS
        const flatPolygon = [];
        for (const p of points) {
            flatPolygon.push(p.x, p.y);
        }

        return flatPolygon;
    }

    getIntersection(r1x, r1y, r2x, r2y, s1x, s1y, s2x, s2y) {
        const r_dx = r2x - r1x;
        const r_dy = r2y - r1y;
        const s_dx = s2x - s1x;
        const s_dy = s2y - s1y;

        const denominator = r_dx * s_dy - r_dy * s_dx;
        if (denominator === 0) return null; // Collinear or parallel

        const u_num = (s1x - r1x) * r_dy - (s1y - r1y) * r_dx;
        const t_num = (s1x - r1x) * s_dy - (s1y - r1y) * s_dx;

        const u = u_num / denominator;
        const t1 = t_num / denominator;

        if (t1 >= 0 && t1 <= 1 && u >= 0 && u <= 1) {
            return {
                x: r1x + r_dx * t1,
                y: r1y + r_dy * t1,
                t1: t1
            };
        }
        return null;
    }
    
    destroy() {
        if (this.fowSprite && this.fowSprite.parent) {
            this.fowSprite.parent.removeChild(this.fowSprite);
        }
        if (this.fowTexture) this.fowTexture.destroy(true);
        if (this.fowSprite) this.fowSprite.destroy();
        if (this.lightGraphics) this.lightGraphics.destroy();
        if (this.darknessRect) this.darknessRect.destroy();
    }
}