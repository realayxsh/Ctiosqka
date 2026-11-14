---
name: Headphone spatial audio expectations
description: User expectations and limits of the bot's spatial filter presets
---

The user expects Dolby and 8D effects to move sound between the left and right headphone channels.

**Why:** The user reported that sound in headphones should go "here and there," but the filters did not do that.

**How to apply:** Prioritize stereo rotation rather than adding pitch modulation or calling an EQ boost surround sound. Do not claim true Dolby Atmos or true reverb unless the audio server actually provides the required processing.

Preset selection deliberately replaces the previous preset, rather than stacking unrelated settings.

**Why:** Separate command and dropdown implementations previously disagreed about flags, DSP settings, and resets. A single-selection model matches the dropdown and prevents stale effects from changing a newly selected preset.

**How to apply:** Keep text commands, slash commands, and dropdowns consistent. Preserve pause and native volume, and only mark a preset active after the audio server acknowledges its change.
