// Hardware transport boundary. All USB/HID protocol code belongs here, never
// in the renderer. The exact M6UP frame encoder is being recovered from the
// vendor runtime traces before enabling writes.
class M6UPTransport {
  constructor(adapter) { this.adapter = adapter; }
  async saveSelectedKey(key) { return this.adapter.writeSelectedKey(key); }
  async applyToAll(settings) { return this.adapter.applyToAll(settings); }
  async calibrate() { return this.adapter.calibrate(); }
  async restart() { return this.adapter.restart(); }
  async programming(config) { return this.adapter.programming(config); }
  async lighting(config) { return this.adapter.lighting(config); }
  async settings(config) { return this.adapter.settings(config); }
}

// The vendor packet format is not guessed here. Until the encoder is recovered,
// every write must fail explicitly instead of pretending that the keyboard was
// updated. Local profile persistence is handled separately by device-state.js.
class UnimplementedM6UPAdapter {
  _fail() { throw new Error('M6UP USB write encoder is not recovered yet'); }
  writeSelectedKey() { this._fail(); }
  applyToAll() { this._fail(); }
  calibrate() { this._fail(); }
  restart() { this._fail(); }
  programming() { this._fail(); }
  lighting() { this._fail(); }
  settings() { this._fail(); }
}
module.exports = { M6UPTransport, UnimplementedM6UPAdapter };
