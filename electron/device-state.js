const fs = require('node:fs'); const path = require('node:path');
const stateFile = path.join(__dirname, 'm6-profile-state.json');
const defaults = () => new Map(['M1','M2','M3','M4'].map(name => [name, {
  name, selectedKey: 'A', keys: {}, programming: {}, lighting: {}, settings: {}
}]));
let profiles = defaults();
try { const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8')); profiles = new Map(Object.entries(saved.profiles)); } catch {}
let currentProfile = 'M1';
function active() { return profiles.get(currentProfile); }
function persist() { fs.writeFileSync(stateFile, JSON.stringify(snapshot(), null, 2)); }
function setProfile(name) { if (!profiles.has(name)) throw new Error('Unknown profile'); currentProfile = name; persist(); return active(); }
function saveSelectedKey(key) { if (!key || !Number.isInteger(key.col)) throw new Error('Physical key coordinates required'); active().keys[key.key] = structuredClone(key); persist(); return key; }
function applyAll(settings) { active().applyAll = structuredClone(settings); persist(); return settings; }
function update(kind, value) { active()[kind] = {...active()[kind], ...value}; persist(); return active()[kind]; }
function snapshot() { return {currentProfile, profiles: Object.fromEntries([...profiles].map(([k,v])=>[k,structuredClone(v)]))}; }
module.exports = { setProfile, saveSelectedKey, applyAll, update, snapshot };
