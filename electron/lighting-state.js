'use strict';

const MODES = {
  backLight: new Set(['eq', 'normal', 'stream', 'gradient', 'star', 'roll', 'breath']),
  underLight: new Set(['stream', 'breath', 'star', 'gradient', 'normal'])
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(state = {}) {
  const backLight = state.backLight || {};
  const underLight = state.underLight || {};
  const singleLight = state.singleLight || {};
  const normalized = {
    backLight: { ...clone(backLight), enabled: Boolean(backLight.enabled), mode: String(backLight.mode || 'normal') },
    underLight: { ...clone(underLight), enabled: Boolean(underLight.enabled), mode: String(underLight.mode || 'normal') },
    singleLight: { ...clone(singleLight), enabled: Boolean(singleLight.enabled), keys: {} }
  };
  if (!MODES.backLight.has(normalized.backLight.mode)) throw new RangeError(`Unsupported Back Light mode: ${normalized.backLight.mode}`);
  if (!MODES.underLight.has(normalized.underLight.mode)) throw new RangeError(`Unsupported Under Light mode: ${normalized.underLight.mode}`);
  for (const [id, color] of Object.entries(singleLight.keys || {})) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new RangeError(`Invalid Single Light color for ${id}`);
    normalized.singleLight.keys[id] = color.toUpperCase();
  }
  return normalized;
}

function effectiveKeyColor(state, keyId) {
  const normalized = normalize(state);
  if (normalized.singleLight.enabled && normalized.singleLight.keys[keyId]) return normalized.singleLight.keys[keyId];
  return null;
}

function updateSection(state, section, value) {
  if (!['backLight', 'underLight', 'singleLight'].includes(section)) throw new RangeError(`Unknown lighting section: ${section}`);
  const next = clone(state || {});
  next[section] = { ...(next[section] || {}), ...value };
  return normalize(next);
}

module.exports = { MODES, normalize, effectiveKeyColor, updateSection };
