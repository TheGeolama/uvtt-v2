---
name: Bug Report
about: Report a bug or issue with the UVTT v2 Upgrader Web App or Specification
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is. Please describe what happened and what you expected to happen instead.

## 🚶 Steps to Reproduce
Steps to reproduce the behavior:
1. Go to the hosted Upgrader Web App (https://TheGeolama.github.io/uvtt-v2-upgrader/)
2. Drag and drop the legacy file `[Attach or describe your .dd2vtt, .df2vtt, or .uvtt file]`
3. Click on tool `[Select/Wall/Portal/Light/Audio/Event/Emitter/Spawn]`
4. Perform action `[e.g., select wall segment, hold Alt and click to split, holding Shift to multi-select]`
5. See error/crash

## 📋 Expected Behavior
A clear and concise description of what you expected to happen. (e.g., "The wall segment should split into two collinear segments with a new Selection Node at the split point.")

## 🖥️ System & Environment Details
Please provide details of your local environment:
- **Device/OS:** [e.g., Windows 11, macOS Sequoia, iPadOS]
- **Web Browser:** [e.g., Chrome, Safari, Firefox]
- **Rendering Pipeline Active:** [WebGL2 / WebGPU] (Check browser console for PixiJS v8 engine logs)
- **App Version:** [e.g., v2.0.0-rc1]

## 🛠️ Developer Console Logs
If applicable, open your browser's Developer Tools (F12 or Cmd+Option+I), navigate to the **Console** tab, and paste any error tracebacks, warnings, or logs here:
```text
[Paste console logs here]
```

## 📦 File Attachments / Test Case
Please zip and attach the failing legacy map file (`.dd2vtt`, `.df2vtt`, `.uvtt`) or compiled `.uvtt2z` package. Having the exact layout is critical for debugging geometric vertex tolerances, Bezier curves, or DRM signature mismatches.

---
*Self-check before submitting: Did Svelte accessibility (a11y) warnings occur during compilation, or did PixiJS experience a "Micro-Drag" camera interaction cancel?*
