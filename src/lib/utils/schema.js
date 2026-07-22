export function verifyAndCleanManifest(rawManifest) {
    if (!rawManifest) return {};
    const m = JSON.parse(JSON.stringify(rawManifest));
    const isNum = (v) => typeof v === 'number' && !isNaN(v);

    // --- CLEAN GEOMETRY ---
    ['walls', 'portals', 'overhead'].forEach(cat => {
        if (m.geometry && m.geometry[cat]) {
            m.geometry[cat] = m.geometry[cat].filter(item => {
                if (!item.path || !Array.isArray(item.path) || item.path.length < 2) return false;
                
                if (!item.properties) item.properties = {};
                if (!item.properties.visibility) item.properties.visibility = 'visible';
                if (!isNum(item.properties.bottom)) item.properties.bottom = (cat === 'overhead' ? 10.0 : 0.0);
                if (!isNum(item.properties.top)) item.properties.top = (cat === 'overhead' ? 20.0 : 10.0);
                
                // Specific Geometry Defaults
                if (cat === 'portals') {
                    if (!item.properties.type) item.properties.type = 'door';
                    if (!item.properties.state) item.properties.state = 'closed';
                }
                
                return item.path.every(pt => isNum(pt.x) && isNum(pt.y));
            });
        }
    });

    // --- CLEAN ENTITIES ---
    if (m.entities) {
        if (!m.entities.props) m.entities.props = [];
        
        if (m.entities.lights) {
            m.entities.lights = m.entities.lights.filter(l => {
                if (!l.position || !isNum(l.position.x) || !isNum(l.position.y)) return false;
                if (!isNum(l.position.z)) l.position.z = 0;
                
                if (!l.properties) l.properties = {};
                if (!l.properties.visibility) l.properties.visibility = 'visible';
                if (!isNum(l.properties.radius?.bright)) l.properties.radius = { bright: 5, dim: 10 };
                if (!isNum(l.properties.intensity)) l.properties.intensity = 1.0;
                if (!isNum(l.properties.cone_angle)) l.properties.cone_angle = 60;
                if (!isNum(l.properties.rotation)) l.properties.rotation = 0;
                if (typeof l.properties.color !== 'string') l.properties.color = "#ffffff";
                
                return true;
            });
        }
        
        if (m.entities.landing_zones) {
            m.entities.landing_zones = m.entities.landing_zones.filter(lz => {
                const isValidCoords = lz.coordinates && Array.isArray(lz.coordinates) && isNum(lz.coordinates[0]) && isNum(lz.coordinates[1]);
                if (!lz.properties) lz.properties = {};
                if (!lz.properties.visibility) lz.properties.visibility = 'visible';
                if (isValidCoords && !isNum(lz.heading_degrees)) lz.heading_degrees = 0.0;
                return isValidCoords;
            });
        }
        
        if (m.entities.events) {
            m.entities.events = m.entities.events.filter(ev => {
                if (!ev.trigger_bounds) {
                    if (isNum(ev.x) && isNum(ev.y)) {
                        ev.trigger_bounds = { center: { x: ev.x, y: ev.y }, width: 2, height: 2 };
                    } else return false; 
                }
                if (!ev.trigger_bounds.center) ev.trigger_bounds.center = { x: 0, y: 0 };
                if (isNum(ev.trigger_bounds.radius) && !isNum(ev.trigger_bounds.width)) {
                    ev.trigger_bounds.width = ev.trigger_bounds.radius * 2;
                    ev.trigger_bounds.height = ev.trigger_bounds.radius * 2;
                }
                if (!isNum(ev.trigger_bounds.width)) ev.trigger_bounds.width = 1;
                if (!isNum(ev.trigger_bounds.height)) ev.trigger_bounds.height = 1;
                if (!ev.activation || typeof ev.activation !== 'string') ev.activation = 'proximity';
                if (!ev.target_entity_ids) ev.target_entity_ids = [];
                
                if (!ev.properties) ev.properties = {};
                if (!ev.properties.visibility) ev.properties.visibility = 'visible';
                
                return true;
            });
        }
        
        if (m.entities.audio && m.entities.audio.zones) {
            m.entities.audio.zones = m.entities.audio.zones.filter(az => {
                if (!az.center || !isNum(az.center.x) || !isNum(az.center.y)) return false;
                if (!isNum(az.radius)) az.radius = 5;
                if (!isNum(az.volume)) az.volume = 100;
                
                if (!az.properties) az.properties = {};
                if (!az.properties.visibility) az.properties.visibility = 'visible';
                
                return true;
            });
        }
        
        if (m.entities.emitters) {
            m.entities.emitters = m.entities.emitters.filter(em => {
                if (!em.position || !isNum(em.position.x) || !isNum(em.position.y)) return false;
                if (!isNum(em.position.z)) em.position.z = 0;
                if (!isNum(em.scale)) em.scale = 100;
                
                if (!em.properties) em.properties = {};
                if (!em.properties.visibility) em.properties.visibility = 'visible';
                
                return true;
			      });
        }
        
        if (m.entities.props) {
            m.entities.props = m.entities.props.filter(pr => {
                if (!pr.position || !isNum(pr.position.x) || !isNum(pr.position.y)) return false;
                if (!isNum(pr.position.z)) pr.position.z = 0;
                if (!isNum(pr.scale)) pr.scale = 100;
                if (!isNum(pr.rotation)) pr.rotation = 0;
                
                if (!pr.properties) pr.properties = {};
                if (!pr.properties.visibility) pr.properties.visibility = 'visible';
                
                return true;
            });
        }
    }

    // --- CLEAN RESOLUTION ---
    if (!m.resolution) m.resolution = {};
    if (!isNum(m.resolution.pixels_per_grid)) m.resolution.pixels_per_grid = 70;
    if (!isNum(m.resolution.grid_line_width)) m.resolution.grid_line_width = 1.5;
    if (!isNum(m.resolution.subgrid_line_width)) m.resolution.subgrid_line_width = 1.0;

    return m;
}