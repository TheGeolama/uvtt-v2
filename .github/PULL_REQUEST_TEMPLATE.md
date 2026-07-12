### 🛠️ Pull Request Template (PULL_REQUEST_TEMPLATE.md)

Place this file directly in the `.github/` folder at the root of your repository:
```directory
.github/
├── ISSUE_TEMPLATE/
│   ├── bug-report.md
│   └── feature-proposal.md
└── PULL_REQUEST_TEMPLATE.md       <-- PLACE THIS FILE HERE
```

***

```markdown
## 📋 Pull Request Description

Please provide a clear, concise summary of the changes introduced by this pull request. Explain the *why* and the *how*, focusing on what topological, rendering, or cryptographic mechanics were modified.

---

### 🔗 Related Issues
Fixes # (issue)
Closes # (issue)
Conforms to RFC # (if applicable)

---

### 🛠️ Type of Change

Please delete options that are not relevant:
- [ ] **Bug Fix** (non-breaking change which fixes an active rendering, a11y, or parsing issue)
- [ ] **New Feature** (non-breaking change which adds spatial, interactive, or metadata capabilities conforming to the UVTT v2 spec)
- [ ] **Breaking Change** (fix or feature that would cause legacy parsers or existing VTT integrations to throw validation errors)
- [ ] **Documentation / Conformance Update** (modifications to specs, schemas, or developer quickstart guides)

---

### 🧪 Compliance & Quality Checklist

Please review and check off the following items before submitting your PR:

#### 1. Core Specification & Schema Compliance
- [ ] **Zero Core Breaks:** All core fields (walls, portals, coordinates, and default landing zones) remain immutable or strictly backward-compatible.
- [ ] **JSON Schema Validation:** My modifications have been successfully validated against the official schemas (`manifest.schema.json`, `geometry.schema.json`, `entities.schema.json`).
- [ ] **URI Resolution:** If modifying teleportation or routing, the paths correctly utilize the `internal://` or `relative://` protocols without hardcoding local file paths.

#### 2. Graphics, Math & Performance (Upgrader-specific)
- [ ] **WebGL / WebGPU Pipeline:** Tested rendering performance on PixiJS. The rendering loop handles the changes smoothly without CPU lag.
- [ ] **Directionality & Geometry:** Any changes to vectors preserve the Right-Hand Rule (clockwise normal ticks for directional LoS blocking).
- [ ] **Svelte Accessibility (a11y):** Verified that `npm run dev` compiles with zero a11y compiler warnings (checked static element interactions, labels, and tabIndex bounds).
- [ ] **Memory Safety:** Modifications do not re-introduce Base64-in-JSON memory bloat; binary assets are handled via transient memory Blob URLs.

#### 3. DRM & Security
- [ ] **Cryptographic Integrity:** Verified that `manifest.hash` is updated or preserved correctly, protecting split-resolution assets.
- [ ] **Volatile Memory Handling:** WebGPU canvas textures and decrypted buffers are aggressively purged from host RAM using volatile memory scrubbing triggers.

---

### 🔬 Test Plan & Proof

Please describe the tests you ran to verify your changes. Include steps to reproduce, browser environments tested, and local terminal verifications.

#### Automated Testing Suite
```bash
# Paste the output of your local verification/test suite run here:
$ 
```

#### Visual Verification (Screenshots / GIFs)
*If your changes modify the PixiJS canvas viewport, HUD Toolbar, spatial zone visualizers, or custom SVG rendering, please paste side-by-side visual evidence here.*
```

***
