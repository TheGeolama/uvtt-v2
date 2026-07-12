---
name: Feature Proposal
about: Propose a new capability, schema enhancement, or extension for the UVTT v2 Standard
title: '[PROPOSAL] '
labels: 'enhancement, rfc'
assignees: ''
---

## 💡 Feature Description
A clear and concise description of the proposed feature or capability you want to add to the UVTT v2 Specification or the Upgrader web app.

## 🎯 The "Why" (Use Case & Problem Statement)
What problem does this feature solve? 
- Why are legacy formats or the current v2.0.0-rc1 spec insufficient for this use case?
- How does this benefit VTT developers, digital artists, or Gamemasters? (e.g., reducing file weight, adding dynamic shaders, standardizing token sight parameters).

## 📐 Proposed Schema Changes
If this feature mutates or expands the specification, please provide a draft JSON schema fragment showing how it affects our decoupled architecture files:

### 1. In `manifest.json` (Metadata & Global Capabilities)
```json
{
  "extensions": {
    "your_extension_name": {
      "version": "1.0.0",
      "properties": {}
    }
  }
}
```

### 2. In `geometry.json` (Architectural Vectors)
```json
{
  "type": "Feature",
  "id": "wall_north_01",
  "properties": {
    "__future_extensions": {
      "custom_field": "value"
    }
  }
}
```

### 3. In `entities.json` (Interactive Layer & Senses)
```json
{
  "your_entity_type": []
}
```

## ⚡ Performance & Hardware Profile Impacts
- Does this feature require modern GPU architectures or advanced rendering targets (like WebGPU compute shaders)?
- What are the **Graceful Degradation Rules** for older WebGL2 engines or 2D canvasses if this property is parsed?
- How does this impact lazy loading, directory caching, or streaming times?

## 🤝 Backward-Compatibility Contract
Does this feature preserve backward compatibility? 
*Note: Under our open standard agreement, core features (basic walls, portals, and default landing zones) are immutable. Any new parameters must be added as additive, optional fields inside the `extensions` or property dictionaries.*

## 📜 RFC Draft Link
If you have written a full draft, please indicate if you have or will submit a markdown RFC inside the `/RFCs` folder via a Pull Request.

---
*By submitting a feature proposal, you agree that your suggested schema changes are fully open-source and released under the standard system-neutral licenses.*
