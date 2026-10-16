const HID = require('node-hid');
const VID = 0x2233;
const PID = 0x006b;
let device = null;
let lastReport = null;

function list() { return HID.devices().filter(d => d.vendorId === VID && d.productId === PID); }
function connect(kind = 'config') {
  const found = list();
  if (!found.length) throw new Error('M6 Lite+ not detected');
  const info = kind === 'config'
    ? (found.find(x => x.interface === 2) || found.find(x => x.interface === 3) || found[0])
    : (found.find(x => x.interface === 1) || found[0]);
  if (!info.path) throw new Error('M6 Lite+ HID path unavailable');
  if (device) try { device.close(); } catch {}
  device = new HID.HID(info.path);
  return { vendorId: info.vendorId, productId: info.productId, interface: info.interface, usagePage: info.usagePage, path: info.path, manufacturer: info.manufacturer, product: info.product };
}
function status() { return { connected: !!device, devices: list() }; }
function requireDevice() { if (!device) connect(); return device; }
function startRead(onReport) { const d = requireDevice(); d.removeAllListeners('data'); d.on('data', report => { lastReport = Buffer.from(report); onReport?.(lastReport); }); return true; }
function readStatus() { return { ...status(), lastReport: lastReport?.toString('hex') || null }; }

module.exports = { list, connect, status, requireDevice, startRead, readStatus, VID, PID };
