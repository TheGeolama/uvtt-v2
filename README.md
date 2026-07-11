This `README.md` is designed to be the professional landing page for your repository. It establishes the UVTT v2 specification as a formal engineering standard, making it attractive to VTT engine developers and map-tool authors who are tired of the limitations of legacy formats.

---

# Universal VTT v2 (UVTT v2) Specification

**The open-source, high-performance standard for interconnected TTRPG campaign mapping.**

The UVTT v2 specification provides a modern, robust, and extensible framework for TTRPG map data. Designed to replace the legacy 2D-only flat formats (.dd2vtt / .df2vtt), UVTT v2 enables verticality, complex spatial triggers, hardware-accelerated rendering, and multi-file campaign networking.

## 🚀 Why UVTT v2?

Legacy V1 standards were ground-breaking, but they suffer from significant architectural bottlenecks. UVTT v2 solves these by treating maps not as static images, but as nodes within a **Topological Spatial Network**.

### The Problem with v1

- **Data Bloat:** Base64-encoded images embedded in JSON inflate payloads by ~33%, causing UI freezes and OOM errors in browser-based VTTs.
- **The "Flat Earth" Assumption:** Legacy formats assume all maps are 2D planes, rendering vertical gameplay (multi-level dungeons) a nightmare to manage.
- **Mathematical Inefficiency:** Jagged straight-line approximation for curved walls wastes GPU resources and creates visual artifacts.
- **Fragmented Campaigns:** Maps are isolated islands. Linking a portal in Map A to Map B required manual GM intervention or third-party plug-ins.

### The Solution: v2 Architecture

- **Binary Archive Container (.uvtt2z):** A zipped directory that detaches heavy image assets from metadata. This enables streamability, lazy loading, and sub-second directory browsing.
- **Material-Aware Geometry:** Directional Line-of-Sight (using the Right-Hand Rule) and explicit height-blocking properties for walls, terrain, and foliage.
- **Spatial Routing:** A native URI-based system (`internal://` and `relative://`) allows for seamless, zero-lag transitions between maps and floors in mega-dungeons.
- **Future-Proof Extensibility:** A `hardware_profile` block ensures the format can scale from WebGL2 to WebGPU without requiring a schema rewrite.

---

## 📂 Repository Structure

```text
uvtt-v2-specification/
├── .github/
│   └── ISSUE_TEMPLATE/       # Forms for "Feature Proposals" or "Bug Reports"
├── schemas/                  # Formal JSON Schema validation files
│   ├── manifest.schema.json
│   ├── geometry.schema.json
│   └── entities.schema.json
├── reference-parsers/        # Boilerplate code for community adoption
│   ├── go/                   # Efficient Go archive reader/indexer
│   └── typescript/           # Core JSON schema typings and SVG helpers
├── RFCs/                     # Request for Comments for future upgrades
├── CHANGELOG.md              # Clear version tracking (e.g., v2.0.0-rc1)
├── CONTRIBUTING.md           # Governance and RFC submission guidelines
└── README.md                 # Project documentation

```

---

## 🛠️ Feature Matrix

| Feature              | Legacy v1            | UVTT v2                       |
| -------------------- | -------------------- | ----------------------------- |
| **Asset Delivery**   | Base64-in-JSON       | Zipped Directory (.uvtt2z)    |
| **Grid Logic**       | Square Only          | Square, Hex, Isometric        |
| **Verticality**      | Flat Plane           | 3D Bounds (Bottom/Top Z)      |
| **Curves**           | Jagged Line Segments | Native SVG Bézier Paths       |
| **Visibility**       | Symmetrical          | Directional (Right-Hand Rule) |
| **Interoperability** | Disconnected Islands | Topological Spatial Network   |
| **Weather**          | None                 | Bounded Particle Emitters     |

---

## 📝 Governance & Contribution

The UVTT v2 specification is a **Living Document**. We welcome contributions from VTT engine developers and map-making tool authors.

### The RFC Pipeline

To propose a new feature (e.g., new atmospheric shaders, advanced lighting physics), please follow these steps:

1. **Draft an RFC:** Create a markdown proposal in the `/RFCs` directory using the provided template.
2. **Pull Request:** Submit your RFC via a Pull Request.
3. **Community Review:** We evaluate based on backward compatibility, performance impact, and interoperability.

### The Backward-Compatibility Contract

Core features—including basic walls, portals, and landing zones—are immutable. Any new functionality (e.g., advanced WebGPU compute shaders) must be implemented as additive, optional properties within the `extensions` block to ensure that existing engines remain compliant.

---

## 🔗 Getting Started

- **[View the Full Specification](https://www.google.com/search?q=schemas/)**
- **[Download the Reference Upgrader Tool](https://www.google.com/search?q=https://github.com/TheGeolama/uvtt-v2-upgrader)** (Migrate legacy maps to v2).
- **[Join the Discussion](https://www.google.com/search?q=https://github.com/TheGeolama/uvtt-v2-specification/issues)**
