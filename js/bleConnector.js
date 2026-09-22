// Web Bluetooth connector for WitMotion BLE sensors. GATT service/
// characteristic UUIDs aren't fully standardized across WitMotion's product
// line, so this ships with the commonly documented UUIDs for the classic
// WT901BLE/BWT901BLE (CC2541-based) modules as defaults, plus a manual
// override for models that use something else. Web Bluetooth only grants
// access to services listed in `optionalServices` at request time, so a
// custom UUID has to be supplied *before* connecting.

var CelloApp = window.CelloApp || {};
window.CelloApp = CelloApp;

CelloApp.BleConnector = (function () {
  var KNOWN_SERVICE_UUIDS = ["0000ffe5-0000-1000-8000-00805f9a34fb"];
  var KNOWN_NOTIFY_UUIDS = ["0000ffe4-0000-1000-8000-00805f9a34fb"];

  var device = null;
  var server = null;
  var notifyChar = null;

  function isSupported() {
    return !!navigator.bluetooth;
  }

  function isSecureContext() {
    return window.isSecureContext === true;
  }

  // handlers: { onStatus(text), onRawChunk(hex), onDisconnect() }
  // extraUUIDs: { service, characteristic } optional manual override
  function connect(handlers, extraUUIDs) {
    handlers = handlers || {};
    var onStatus = handlers.onStatus || function () {};
    var onRawChunk = handlers.onRawChunk || function () {};
    var onDisconnect = handlers.onDisconnect || function () {};

    if (!isSupported()) {
      return Promise.reject(new Error("Web Bluetooth isn't available in this browser."));
    }
    if (!isSecureContext()) {
      return Promise.reject(
        new Error("Bluetooth requires HTTPS (or localhost). Serve this page over HTTPS to connect.")
      );
    }

    var serviceUUIDs = KNOWN_SERVICE_UUIDS.slice();
    var notifyUUIDs = KNOWN_NOTIFY_UUIDS.slice();
    if (extraUUIDs && extraUUIDs.service) serviceUUIDs.unshift(extraUUIDs.service.trim().toLowerCase());
    if (extraUUIDs && extraUUIDs.characteristic)
      notifyUUIDs.unshift(extraUUIDs.characteristic.trim().toLowerCase());

    onStatus("Requesting device…");

    return navigator.bluetooth
      .requestDevice({
        acceptAllDevices: true,
        optionalServices: serviceUUIDs,
      })
      .then(function (d) {
        device = d;
        device.addEventListener("gattserverdisconnected", function () {
          onStatus("Disconnected");
          onDisconnect();
        });
        onStatus("Connecting to " + (device.name || "device") + "…");
        return device.gatt.connect();
      })
      .then(function (s) {
        server = s;
        return server.getPrimaryServices();
      })
      .then(function (services) {
        if (!services.length) {
          throw new Error(
            "No accessible GATT services found. This sensor likely uses a different service UUID — " +
              "find it with a BLE scanner app (e.g. nRF Connect) and enter it under Advanced below."
          );
        }
        // Try to find a notifying characteristic, preferring known UUIDs.
        var chain = Promise.resolve(null);
        services.forEach(function (service) {
          chain = chain.then(function (found) {
            if (found) return found;
            return service.getCharacteristics().then(function (chars) {
              var preferred = chars.find(function (c) {
                return notifyUUIDs.indexOf(c.uuid.toLowerCase()) !== -1 && c.properties.notify;
              });
              var anyNotifiable = chars.find(function (c) {
                return c.properties.notify;
              });
              return preferred || anyNotifiable || null;
            });
          });
        });
        return chain;
      })
      .then(function (characteristic) {
        if (!characteristic) {
          throw new Error(
            "Connected, but no notifying characteristic was found on the accessible services."
          );
        }
        notifyChar = characteristic;
        onStatus("Subscribing to " + notifyChar.uuid + "…");
        notifyChar.addEventListener("characteristicvaluechanged", function (event) {
          var value = event.target.value; // DataView
          var bytes = new Uint8Array(value.buffer);
          onRawChunk(bytes);
        });
        return notifyChar.startNotifications();
      })
      .then(function () {
        onStatus("Connected: " + (device.name || "WitMotion sensor"));
        return { deviceName: device.name || "WitMotion sensor" };
      });
  }

  function disconnect() {
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    device = null;
    server = null;
    notifyChar = null;
  }

  function isConnected() {
    return !!(device && device.gatt && device.gatt.connected);
  }

  return {
    isSupported: isSupported,
    isSecureContext: isSecureContext,
    connect: connect,
    disconnect: disconnect,
    isConnected: isConnected,
  };
})();
