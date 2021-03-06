(function e(t, n, r) {
    function s(o, u) { if (!n[o]) { if (!t[o]) { var a = typeof require == "function" && require; if (!u && a) return a(o, !0); if (i) return i(o, !0); var f = new Error("Cannot find module '" + o + "'"); throw f.code = "MODULE_NOT_FOUND", f } var l = n[o] = { exports: {} };
            t[o][0].call(l.exports, function(e) { var n = t[o][1][e]; return s(n ? n : e) }, l, l.exports, e, t, n, r) } return n[o].exports } var i = typeof require == "function" && require; for (var o = 0; o < r.length; o++) s(r[o]); return s })({
    1: [function(require, module, exports) {
        (function(global) { var ChromePlugin = require("./chrome.js").ChromePlugin,
                FirefoxPlugin = require("./firefox.js").FirefoxPlugin,
                NpapiAvailable = require("babelfish").NpapiAvailable;

            function withChosenFlash(chooseNpapi, method) { return function() { var args = [].slice.call(arguments, 2); if (chooseNpapi.apply(this, args)) { this.getFlashResult = this.npapiPlugin.getFlashResult.bind(this.npapiPlugin); return this.npapiPlugin[method].apply(this.npapiPlugin, arguments) } this.getFlashResult = this.__proto__.getFlashResult.bind(this); return this.__proto__[method].apply(this, arguments) } }

            function BFFirefoxPlugin() { ChromePlugin.call(this, NpapiAvailable);
                this.npapiPlugin = new FirefoxPlugin;

                function chooseUsb(varArgs) { var args = [].slice.call(arguments),
                        _extraConfig = args[args.length - 1]; return typeof _extraConfig !== "function" && "usb" === (_extraConfig.communication || "usb") }

                function constfn(val) { return function() { return val } } this.flash = withChosenFlash(chooseUsb, "flash");
                this.flashBootloader = withChosenFlash(constfn(true), "flashBootloader");
                this.flashWithProgrammer = withChosenFlash(constfn(true), "flashWithProgrammer");
                this.init = function(cb, timeout) { console.log("Calling init..");
                    ChromePlugin.prototype.init.call(this, cb, timeout);
                    this.npapiPlugin.init() };
                this.setCallback = function(cb) { console.log("Calling setCallback..");
                    ChromePlugin.prototype.setCallback.call(this, cb);
                    this.npapiPlugin.setCallback(cb) };
                this.setErrorCallback = function(cb) { console.log("Calling setErrorCallback..");
                    ChromePlugin.prototype.setErrorCallback.call(this, cb);
                    this.npapiPlugin.setErrorCallback(cb) } } BFFirefoxPlugin.prototype = Object.create(ChromePlugin.prototype);
            global.FirefoxPlugin = BFFirefoxPlugin;
            global.CodebenderPlugin = BFFirefoxPlugin }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./chrome.js": 2, "./firefox.js": 4, babelfish: 100 }],
    2: [function(require, module, exports) {
        (function(global) { var protocols = require("avrdudejs").protocols,
                getMCUConf = require("avrdudejs").getMCUConf,
                CodebenderAvailable = require("babelfish").CodebenderAvailable,
                AppAvailable = require("babelfish").AppAvailable,
                PageAvailable = require("babelfish").PageAvailable,
                settings = require("./settings.js").settings,
                toSettings = require("corelib").toSettings,
                HexParser = require("corelib").HexParser,
                Base64Parser = require("corelib").Base64Parser,
                scheduler = require("corelib").scheduler,
                Event = require("corelib").Event,
                getLog = require("corelib").getLog,
                wrap = require("corelib").wrap,
                SerialMonitor = require("serialmonitor").Monitor,
                smerrors = require("serialmonitor").errors,
                errors = require("./errors.js"),
                status = require("./status.js"),
                killFlashButton = require("./killflash.js");

            function parseIfString(code, maxsize, errCb) { if (typeof code !== "string") return code; var parseResult = genericParse(code, Number(maxsize)); if (!(code = parseResult.data())) { errCb("extension-client", parseResult.lastError.value); return null } return code }

            function genericParse(code, maxsize) { var ret = code; if (typeof ret !== "string") return ret;
                [HexParser, Base64Parser].some(function(Parser) { ret = new Parser(code, maxsize, 0); if (ret.data()) return true; return false }); return ret }

            function Plugin(available_class) { var self = this;
                this.log = getLog("Plugin");
                this.log.log("New plugin.");
                this.version = null;
                this.available = new(available_class || PageAvailable)(settings.get("iframe_url"));
                this.available.onFound.modifyDispatcher(function(dispatch) { return function(listener, version) {
                        function modifiedListener(version) { if (version) { listener(version); return } self.getVersion(listener) } dispatch(modifiedListener, version) } });
                global.chrome = global.chrome || {};
                this.available.onFound.addListener(function(version) { wrap(global.chrome, self.available.api); if (self.serialMonitor) { self.serialMonitor.disconnect() } self.api = self.available.api;
                    self.serial = self.available.api.serial });
                this.serialMonitor = null;
                this.available.onLost.addListener(function() { self.close(false) });
                this.available.onError.addListener(function(error) { if (error && error.context && error.context.error && error.context.error.badVersion) { self.available.onFound.dispatch(error.context.error.badVersion) } });
                this.onRawMessageReceived = new Event;
                this.onLost = this.available.onLost;
                this.onFound = this.available.onFound;
                this.onError = this.available.onError } Plugin.prototype = { setPlatformInfo: function(info, cb) { this.available.api.runtime.setPlatformInfo(info, cb) }, instanceId: function() { return this.available.connectionId() }, init: function() { this.available.init.apply(this.available, arguments) }, errorCallback: function(from, msg, status) { console.error("[" + from + "] ", msg, "(status: " + status + ")") }, serialRead: function(port, baudrate, readCb, connectedCb) { var self = this,
                        connected = false,
                        closed = false;

                    function handleCloseOrError(err) { var success = err.id == errors.SUCCESS.id,
                            error = !success,
                            deviceLost = err.id == smerrors.SERIAL_MONITOR_DEVICE_LOST.id,
                            connectError = !connected && !success,
                            normalClose = success || deviceLost;
                        closed = true; if (!success) { self.errorCallback(null, err.shortMessage(), 1) } if (connectError) { if (connectedCb) connectedCb(null, err.value);
                            else console.error("We got a connect-error after we connected successfully") } self.serialMonitorDisconnect() }

                    function handleSuccessfulConnect() { if (closed) { console.warn("Connected after close was issued. Ignoring."); return } connected = true;
                        connectedCb(null, 0) } this.serialMonitor = new SerialMonitor(port, Number.parseInt(baudrate), this.api);
                    this.serialMonitor.onRead.addListener(function(msg) { readCb(null, msg) });
                    this.serialMonitor.onRead.addListener(function(msg) { scheduler.setImmediate(function() { self.onRawMessageReceived.dispatch(msg) }) });
                    this.serialMonitor.onClose.addListener(handleCloseOrError);
                    this.serialMonitor.onConnected.addListener(handleSuccessfulConnect) }, flashBootloader: function(device, protocol, communication, speed, force, delay, high_fuses, low_fuses, extended_fuses, unlock_bits, lock_bits, mcu, cb, _extraConfig) {
                    function toint(hex) { return hex ? Number.parseInt(hex.substring(2), 16) : null } var _ = null,
                        controlBits = { lfuse: toint(low_fuses), efuse: toint(extended_fuses), lock: toint(unlock_bits), hfuse: toint(high_fuses) },
                        extraConfig = toSettings(_extraConfig).parent({ controlBits: controlBits, cleanControlBits: { lock: toint(lock_bits) }, chipErase: true }); var p = new HexParser(this.hexString),
                        data = p.data(); if (data === null) { cb("extension", p.lastError); return } data.defaultByte = 255;
                    this.flashWithProgrammer(device, data, _, protocol, communication, speed, force, delay, mcu, cb, extraConfig) }, flashWithProgrammer: function(device, code, maxsize, protocol, communication, speed, force, delay, mcu, cb, _extraConfig) { var extraConfig = toSettings(_extraConfig).parent({ avoidTwiggleDTR: true, confirmPages: true, readSwVersion: true, chipErase: true, skipSignatureCheck: force == "true", communication: communication || "usb", dryRun: window.dryRun });
                    this.flash(device, code, maxsize, protocol, false, speed, mcu, cb, extraConfig) }, flash: function(device, code, maxsize, protocol, disable_flushing, speed, mcu, cb, _extraConfig) { this.log.log("Flashing " + device); if (!(code = parseIfString(code, maxsize, cb))) return; var from = null,
                        self = this,
                        config = settings.withDefault(toSettings(_extraConfig).child({ api: this.available.api, maxsize: Number(maxsize), protocol: protocol, disableFlushing: disable_flushing && disable_flushing != "false", speed: Number(speed) || 115200, mcu: mcu, avrdude: getMCUConf(mcu) })),
                        finishCallback = function() { var pluginReturnValue = 0;
                            self.log.log("Flash success");
                            cb && cb(from, pluginReturnValue);
                            self.transaction = null },
                        errorCallback = function(id, msg) { scheduler.setTimeout(function() { self.transaction = null; var warnOrError = id >= config.get("warningReturnValueRange")[0] && id <= config.get("warningReturnValueRange")[1] ? 1 : 0;
                                self.errorCallback("extension-client", msg, warnOrError) });
                            self.log.log("Flash fail.");
                            self.lastFlashResult = msg;
                            self.transaction = null;
                            cb && cb(from, id) },
                        messageCallback = function(s) { if (s.id == status.BLOCKING_STATES.id) { scheduler.setTimeout(function() { self.sendUiMessage(s.toCrazyLog()) }) } var msg = null; if (s.id == status.LEONARDO_RESET_START.id || config.get("statusLog")) { msg = s.toString() } if (config.get("killButton")) { msg = (msg || "Flashing device...") + killFlashButton(self.transaction) } if (msg) self.sendUiMessage(msg) };

                    function doflash() { var dodoFlash = function() { self.log.log("Code length", code.length || code.data.length, "Protocol:", protocols, "Device:", device);
                            self.transaction.flash(device, code.squashed()) };
                        self.transaction = new(protocols[config.get("communication") || "serial"][protocol])(config.obj(), finishCallback, errorCallback);
                        self.transaction.onStatusChange.addListener(messageCallback); if (self.transaction.destroyOtherConnections) { self.transaction.destroyOtherConnections(device, dodoFlash); return } dodoFlash() } if (self.transaction) { self.transaction.cleanup(doflash); return } doflash() }, cachingGetDevices: function(cb) { var self = this; if (!self._cachedPorts) { this.serial.getDevices(function(devs) { var devUniquify = {};
                            (devs || []).forEach(function(d) { var trueDevName = d.path.replace("/dev/tty.", "/dev/cu."); if (!devUniquify[trueDevName] || d.path == trueDevName) devUniquify[trueDevName] = d });
                            self._cachedPorts = Object.getOwnPropertyNames(devUniquify).map(function(k) { return devUniquify[k] });
                            cb && cb(self._cachedPorts);
                            setTimeout(function() { self._cachedPorts = null }, 1e3) }); return } cb && cb(self._cachedPorts) }, availablePorts: function(cb) { this.cachingGetDevices(function(devs) { cb(this.pluginDevsFormat_(devs).map(function(d) { return d.port }).join(",")) }.bind(this)) }, getPorts: function(cb) { var self = this;
                    this.cachingGetDevices(function(devs) { var ret = JSON.stringify(self.pluginDevsFormat_(devs));
                        cb(ret) }) }, pluginDevsFormat_: function(devs) { var set_ = {};
                    devs.forEach(function(d) { set_[d.path] = true }); return Object.getOwnPropertyNames(set_).map(function(dev) { return { port: dev } }) }, probeUSB: function(cb) { this.availablePorts(cb) }, getFlashResult: function(cb) { cb(this.lastFlashResult) }, getVersion: function(cb) { var self = this,
                        runtime = this.available.api.runtime; if (this.version) { cb(this.version); return } runtime.getManifestAsync(function(manifest) { if (runtime.lastError) { throw new Error(runtime.lastError.message || runtime.lastError) } if (!manifest) { throw Error("Could not retrieve app version") } self.version = manifest.version;
                        cb(self.version) }) }, saveToHex: function(strData) { console.error("Not implemented") }, serialWrite: function(strData, cb) { this.serialMonitor.writer.write(strData, cb) }, setCallback: function(cb) { this.sendUiMessage = function(msg) { if (msg === "disconnect") msg = "disconnect ";
                        cb(null, msg) };
                    this.serialMonitorDisconnect = function() { cb(null, "disconnect") }; return true }, sendUiMessage: function() { console.warn("Use setCallback to provide a way of communicating with the ui.") }, serialMonitorDisconnect: function() { console.warn("Use setCallback to provide a way of communicating with the ui.") }, setErrorCallback: function(cb) { this.errorCallback = cb; return true }, deleteMap: function() { this.close() }, closeTab: function() { this.close() }, serialMonitorSetStatus: function(cb) { this.serialMonitor.disconnect(cb);
                    this.serialMonitor = null }, saveToHex: function(hexString) { this.hexString = hexString }, close: function(shutdown, cb) { if (this.serialMonitor) { this.serialMonitor.disconnect();
                        this.serialMonitor = null } this.version = null; if (this.transaction) { this.transaction.cleanup() } if (shutdown) { this.available.shutdown(cb); return } this.available.disconnect(cb) }, debugEnable: function(verbosity) { if (typeof verbosity === "number") global.verbosity = verbosity } };
            module.exports.ChromePlugin = Plugin }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./errors.js": 3, "./killflash.js": 5, "./settings.js": 6, "./status.js": 7, avrdudejs: 8, babelfish: 100, corelib: 144, serialmonitor: 171 }],
    3: [function(require, module, exports) { var sm = require("serialmonitor").errors,
            ajs = require("avrdudejs").errors,
            cl = require("corelib").errors,
            toSettings = require("corelib").toSettings,
            RetVal = require("corelib").RetVal;
        module.exports = toSettings(sm).child(cl).child(ajs).child({ KILLED: new RetVal(2, "Killed by user.") }).obj() }, { avrdudejs: 8, corelib: 144, serialmonitor: 171 }],
    4: [function(require, module, exports) {
        (function(global) { var Event = require("corelib").Event,
                NpapiAvailable = require("babelfish").NpapiAvailable,
                NpapiChrome = require("babelfish").NpapiChrome,
                scheduler = require("corelib").scheduler;

            function PluginPropertyDescriptor(pluginElement, prop) { var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(pluginElement), prop); if (desc) Object.getOwnPropertyNames(desc).forEach(function(pp) { if (pp != "value" && true) { this[pp] = pluginElement[pp] } });
                else throw Error("Could not determine property descruptor of plugin property '" + prop);
                this.get = function() { return pluginElement[prop] };
                this.set = function(val) { pluginElement[prop] = val } }

            function prototypeProperties(obj) { return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) }

            function PluginElementWrapper() { var self = this; if (!(this.element_ = global.document.getElementById("plugin0"))) { this.element_ = global.document.createElement("object");
                    this.element_.setAttribute("type", "application/x-codebendercc");
                    this.element_.setAttribute("width", "0");
                    this.element_.setAttribute("height", "0");
                    this.element_.setAttribute("xmlns", "http://www.w3.org/1999/html");
                    global.document.body.appendChild(this.element_);
                    this.element_.id = "plugin0" } var alreadyAsync = ["flashWithProgrammer", "flash", "flashBootloader", "serialRead", "setErrorCallback", "setCallback", "saveToHex", "closeTab", "deleteTab", "sendUiMessage"];
                alreadyAsync.forEach(function(m) { self[m] = function() { var args = [].slice.call(arguments),
                            i = 0,
                            strargs = args.map(function(a) { return "args[" + i++ + "]" }).join(", "),
                            command = "this.element_." + m + "(" + strargs + ");";
                        console.log("Call with debug:", command);
                        global.pluginArgumets = args;
                        this.element_.enableDebug(3);
                        eval(command) } });
                prototypeProperties(this.element_).forEach(function(attr) { if (alreadyAsync.indexOf(attr) !== -1) return; if (typeof self.element_[attr] === "function") { self[attr] = function() { var args = Array.prototype.slice.call(arguments),
                                cb = args[args.length - 1],
                                args_ = args.slice(0, args.length - 1); if (typeof cb !== "function") throw Error("Last argument must be a callback");
                            scheduler.setTimeout(function() { var retval, error = null; try { retval = self.element_[attr].apply(self.element_, args_) } catch (err) { retval = -1;
                                    error = err } cb(retval); if (error) throw error }) }.bind(self) } else { var descr = new PluginPropertyDescriptor(self.element_, attr);
                        Object.defineProperty(self, attr, descr) } }) }

            function FirefoxPlugin() { var self = this;
                this.available = new NpapiAvailable;
                this.getPorts = this.getPortsCb;
                this.availablePorts = this.availablePortsCb;
                this.getFlashResult = this.getFlashResultCb;
                this.probeUSB = this.probeUSBCb;
                this.serialMonitorSetStatusCb = this.serialMonitorSetStatusCb;
                this.onLost = this.available.onLost;
                this.onFound = this.available.onFound;
                this.onError = this.available.onError } FirefoxPlugin.prototype = Object.create(new PluginElementWrapper);
            FirefoxPlugin.prototype.init = function(cb) { var self = this; if (!cb) { this.available.init(); if (this.element_.init) this.element_.init(); return } this.available.init(function() { if (self.element_.init) self.element_.init();
                    self.getVersion(cb) }) };
            FirefoxPlugin.prototype.chrome = function() { return new NpapiChrome(this) };
            FirefoxPlugin.prototype.getPortsCb = function(cb) { var ports = this.element_.getPorts();
                scheduler.setImmediate(function() { cb(ports) }) };
            FirefoxPlugin.prototype.availablePortsCb = function(cb) { var ports = this.element_.availablePorts();
                scheduler.setImmediate(function() { cb(ports) }) };
            FirefoxPlugin.prototype.getFlashResultCb = function(cb) { var result = this.element_.getFlashResult();
                scheduler.setImmediate(function() { cb(result) }) };
            FirefoxPlugin.prototype.probeUSBCb = function(cb) { var result = this.element_.probeUSB();
                scheduler.setImmediate(function() { cb(result) }) };
            FirefoxPlugin.prototype.serialMonitorSetStatusCb = function(cb) { this.element_.serialMonitorSetStatus();
                scheduler.setImmediate(function() { cb() }) };
            FirefoxPlugin.prototype.instanceId = function() { return this.element_.instance_id };
            FirefoxPlugin.prototype.firefoxInitCb = function(cb) {};
            FirefoxPlugin.prototype.getVersion = function(cb) { if (cb) cb(this.version) };
            module.exports.FirefoxPlugin = FirefoxPlugin }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { babelfish: 100, corelib: 144 }],
    5: [function(require, module, exports) {
        (function(global) { var errors = require("./errors.js");
            global.babelfish_killFlash = function() { window.currentTransaction.finalError(errors.KILLED, { method: "button" }) };

            function killFlashButton(transaction) { global.currentTransaction = transaction; return ' <button onclick="babelfish_killFlash()" style="float: right;" class="killbutton">Kill Flash</button>' } module.exports = killFlashButton }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./errors.js": 3 }],
    6: [function(require, module, exports) { var settings = require("corelib").settings,
            DynamicSetting = require("corelib").DynamicSetting;

        function developer() { return new DynamicSetting(function() { return settings.get("developer") }) } module.exports.settings = settings.appendDefault({ warningReturnValueRange: [20500, 21e3], killButton: developer(), statusLog: developer(), verbosity: new DynamicSetting(function() { if (settings.get("developer")) return 5; return 1 }), developer: false }) }, { corelib: 144 }],
    7: [function(require, module, exports) { var sm = require("serialmonitor").status,
            ajs = require("avrdudejs").status,
            cl = require("corelib").status,
            toSettings = require("corelib").toSettings,
            Status = require("corelib").Status;
        module.exports = toSettings(sm).child(cl).child(ajs).child({ BLOCKING_STATES: new Status("Blocking states: {states}") }).obj() }, { avrdudejs: 8, corelib: 144, serialmonitor: 171 }],
    8: [function(require, module, exports) {
        (function(global) { var Stk500 = require("./lib/stk500").STK500Transaction; var Stk500v2 = require("./lib/stk500v2").STK500v2Transaction; var Wiring = require("./lib/wiring.js").WiringTransaction; var Stk500v2Usb = require("./lib/stk500v2usb").STK500v2UsbTransaction; var Avr109 = require("./lib/butterfly").AVR109Transaction; var USBTiny = require("./lib/usbtiny").USBTinyTransaction; var USBAsp = require("./lib/usbasp").USBAspTransaction; var toSettings = require("corelib").toSettings;
            module.exports.protocols = { serial: { stk500v2: Stk500v2, wiring: Wiring, stk500: Stk500v2, arduino: Stk500, stk500v1: Stk500, avr109: Avr109 }, usb: { usbasp: USBAsp, usbtiny: USBTiny, stk500v2: Stk500v2Usb } };
            module.exports.getMCUConf = require("./lib/avrdudeconf.js").getMCUConf;
            module.exports.Avrdude = require("./lib/avrdudecmd.js").Avrdude;
            global.Avrdude = require("./lib/avrdudecmd.js").Avrdude;
            module.exports.errors = toSettings({}).child(require("./lib/errors.js")).child(require("./lib/connection/errors.js")).obj();
            module.exports.status = require("./lib/status.js");
            module.exports.SerialAvrdudeTransaction = require("./lib/avrdudetransaction.js").SerialAvrdudeTransaction;
            module.exports.UsbAvrdudeTransaction = require("./lib/avrdudetransaction.js").UsbAvrdudeTransaction }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./lib/avrdudecmd.js": 9, "./lib/avrdudeconf.js": 10, "./lib/avrdudetransaction.js": 11, "./lib/butterfly": 12, "./lib/connection/errors.js": 13, "./lib/errors.js": 16, "./lib/status.js": 22, "./lib/stk500": 23, "./lib/stk500v2": 24, "./lib/stk500v2usb": 25, "./lib/usbasp": 26, "./lib/usbtiny": 27, "./lib/wiring.js": 28, corelib: 29 }],
    9: [function(require, module, exports) { var proto = require("../index.js").protocols,
            getMCUConf = require("avrdudejs").getMCUConf,
            Event = require("corelib").Event,
            HexParser = require("corelib").HexParser,
            Base64Parser = require("corelib").Base64Parser,
            AppAvailable = require("babelfish").AppAvailable;

        function mkData(bin) { var data; if (data = new HexParser(bin).data()) return data; if (data = new Base64Parser(bin).data()) return data; throw Error("Couldn't parse code") }

        function argsToDict(tokens, dict) { if (!dict) dict = {}; if (tokens.length === 0) return dict; if (tokens[0][0] === "-" && tokens[0][1] === "-") return handleDoubleDash(tokens, dict); if (tokens[0][0] === "-") return handleSingleDash(tokens, dict); return argsToDict(tokens.slice(1), dict) }

        function dset(dict, key, value) { dict[key] = (dict[key] || []).concat([value]); return dict }

        function handleDoubleDash(tokens, dict) { var flag = tokens[0].slice(2); if (tokens[0] < 3) throw Error("Bad argument: " + tokens[0]); if (tokens.length === 1 || tokens[1][0] === "-") return argsToDict(tokens.slice(1), dset(dict, flag, null)); return argsToDict(tokens.slice(2), dset(dict, flag, tokens[1])) }

        function handleSingleDash(tokens, dict) { var flag = tokens[0][1]; if (tokens[0] < 2) throw Error("Bad argument: " + tokens[0]); if (tokens[0].length > 2) return argsToDict(tokens.slice(1), dset(dict, flag, tokens[0].slice(2))); if (tokens.length == 1 || tokens[1][0] === "-") return argsToDict(tokens.slice(1), dset(dict, flag, null)); return argsToDict(tokens.slice(2), dset(dict, flag, tokens[1])) }

        function pushToken(returning, str, tokens, current) { if (current.length === 0) return returning(str, tokens, current); return returning(str, tokens.concat([current]), "") }

        function tokenizeQuoted(quote, str, tokens, current) { if (str === "") throw Error("Expected :" + quote); if (str[0] === quote) return pushToken(tokenizeUnix, str.slice(1), tokens, current); return tokenizeQuoted(quote, str.slice(1), tokens, current + str[0]) }

        function tokenizeUnix(str, tokens, current) { if (!tokens) tokens = []; if (!current) current = ""; if (str === "") return pushToken(function(_, t) { return t }, str.slice(1), tokens, current); if (str[0] === "\\") return tokenizeUnix(str.slice(2), tokens, current + str[1]); if (str[0] === "'" || str[0] === '"') return pushToken(tokenizeQuoted.bind(null, str[0]), str.slice(1), tokens, current); if (str[0] === " ") return pushToken(tokenizeUnix, str.slice(1), tokens, current); return tokenizeUnix(str.slice(1), tokens, current + str[0]) }

        function argDictToConfig(api, argsDict) { var mcu = argsDict.p[0],
                protocol = argsDict.c[0],
                port = argsDict.P[0],
                baudrate = argsDict.b[0],
                chipErase = !!argsDict.e,
                skipSignatureCheck = !!argsDict.F,
                confirmPages = !argsDict.V,
                memoryArgs = argsDict.U[0].split(":"),
                dataOperation = memoryArgs[1],
                dataFormat = memoryArgs[3],
                mcuConf = getMCUConf(mcu); if (!mcuConf) { throw Error("No such MCU:" + mcu) } return { api: api, speed: Number(baudrate) || 115200, mcu: mcu, chipErase: chipErase, skipSignatureCheck: skipSignatureCheck, chipErase: chipErase, confirmPages: confirmPages, avrdude: mcuConf } }

        function argDictToProtocol(argsDict) { return argsDict.c[0] }

        function argDictToUrl(argsDict) { return argsDict.U[0].split(":")[2] }

        function argDictToPort(argsDict) { return argsDict.P[0] }

        function getUrlText(url, cb) { var xhttp = new XMLHttpRequest;
            xhttp.onreadystatechange = function() { if (xhttp.readyState == 4 && xhttp.status == 200) cb(xhttp.responseText) };
            xhttp.open("GET", url, true);
            xhttp.send() }

        function runAvrdudeSerialLite(api, cmd, cb) { var dictArgs = argsToDict(tokenizeUnix(cmd).slice(1));
            getUrlText(argDictToUrl(dictArgs), function(code) { var trans = new(proto.serial[argDictToProtocol(dictArgs)])(argDictToConfig(api, dictArgs), cb, cb);
                trans.flash(argDictToPort(dictArgs), mkData(code)) }) }

        function Avrdude() { this.available = new AppAvailable } Avrdude.prototype = { cmd: function(cmd, bin, cb) { var self = this;
                this.available.init(function(version) { console.log("Initialized:", version);
                    runAvrdudeSerialLite(self.available.api, cmd, bin, cb) }) } };
        module.exports.argsToDict = argsToDict;
        module.exports.dset = dset;
        module.exports.handleDoubleDash = handleDoubleDash;
        module.exports.handleSingleDash = handleSingleDash;
        module.exports.tokenizeUnix = tokenizeUnix;
        module.exports.Avrdude = Avrdude }, { "../index.js": 8, avrdudejs: 8, babelfish: 100, corelib: 29 }],
    10: [function(require, module, exports) { var parts = require("./parts.min"),
            _conf = null;

        function getMCUConf(mcu) { if (!_conf) { _conf = {};
                Object.getOwnPropertyNames(parts).forEach(function(pn) { _conf[parts[pn].AVRPart.toLowerCase()] = parts[pn] }) } return _conf[mcu.toLowerCase()] } module.exports.getMCUConf = getMCUConf }, { "./parts.min": 21 }],
    11: [function(require, module, exports) { var hexRep = require("corelib").hexRep,
            getLog = require("corelib").getLog,
            ops = require("./memops.js"),
            scheduler = require("corelib").scheduler,
            replacePrototype = require("corelib").replacePrototype,
            FiniteStateMachine = require("corelib").FiniteStateMachine,
            USBTransaction = require("corelib").USBTransaction,
            SerialTransaction = require("corelib").SerialTransaction,
            ConnectionManager = require("./connection/serialreset.js").ConnectionManager,
            status = require("./status.js"),
            errors = require("./errors.js");

        function DummyTransaction() {} DummyTransaction.prototype = Object.create(FiniteStateMachine.prototype);

        function AvrdudeTransaction(config, finishCallback, errorCallback, parent) { this.init.apply(this, arguments) } AvrdudeTransaction.prototype = Object.create(DummyTransaction.prototype);
        AvrdudeTransaction.prototype.init = function _init(config, finishCallback, errorCallback, parent) { this.superApply(_init, arguments);
            this.log = getLog("AvrdudeTransaction") };
        AvrdudeTransaction.prototype.padOrSlice = function(data, offset, length) { var payload; if (offset + length > data.length) { payload = data.slice(offset, data.length); var padSize = length - payload.length; for (var i = 0; i < padSize; ++i) { payload.push(0) } } else { payload = data.slice(offset, offset + length) } return payload };
        AvrdudeTransaction.prototype.maybeCheckSignature = function(cb, _bytes) { var self = this,
                bytes = _bytes || []; if (this.config.skipSignatureCheck) { return cb() } return this.checkSignature(cb, []) };
        AvrdudeTransaction.prototype.checkSignature = function(cb, bytes) { var self = this;
            this.setStatus(status.CHECK_SIGNATURE); if (bytes.length >= 3) { if (bytes.toString() != self.config.avrdude.signature.toString()) { self.errCb(errors.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: bytes }); return } cb(); return } this.readMemory("signature", bytes.length, function(data) { self.checkSignature(cb, bytes.concat(data)) }) };
        AvrdudeTransaction.prototype.writePageInBytes = function(offset, data, cb) { var self = this; if (data.length == 0) { cb(); return } this.writeMemory("flash", offset, data[0], function() { self.writePageInBytes(offset + 1, data.slice(1), cb) }) };
        AvrdudeTransaction.prototype.writeMemory = function(mem, addr, val, cb) { var writeOp = "WRITE",
                self = this,
                memory = this.config.avrdude.memory[mem]; if (memory.paged && memory.memops.LOADPAGE_LO) { writeOp = addr & 1 ? "LOADPAGE_HI" : "LOADPAGE_LO";
                addr = addr / 2 } if (memory.memops.WRITE_LO) { writeOp = addr & 1 ? "WRITE_HI" : "WRITE_LO";
                addr = addr / 2 } var writeByteArr = this.config.avrdude.memory[mem].memops[writeOp],
                writeCmd = ops.opToBin(writeByteArr, { ADDRESS: addr, INPUT: val });
            this.cmd(writeCmd, cb) };
        AvrdudeTransaction.prototype.readMemory = function(mem, addr, cb) { var readOp = "READ",
                self = this; if (this.config.avrdude.memory[mem].memops.READ_LO) { readOp = addr & 1 ? "READ_HI" : "READ_LO";
                addr = addr / 2 } var readByteArr = this.config.avrdude.memory[mem].memops[readOp],
                extAddrArr = this.config.avrdude.memory[mem].memops.EXT_ADDR,
                readCmd = ops.opToBin(readByteArr, { ADDRESS: addr }),
                extAddrCmd = extAddrArr && ops.opToBin(extAddrArr, { ADDRESS: addr }),
                maybeSetExtAddr = extAddrCmd ? this.cmd.bind(this, extAddrCmd) : function nop(cb) { cb() };
            maybeSetExtAddr(function() { self.cmd(readCmd, function(resp) { cb(ops.extractOpData("OUTPUT", readByteArr, resp.data || resp)) }) }) };

        function chain(fnlist, endcb) { if (fnlist && fnlist.length <= 0) { endcb && endcb(); return } fnlist[0](function() { scheduler.setTimeout(chain.bind(null, fnlist.slice(1), endcb)) }) } AvrdudeTransaction.prototype.setupSpecialBits = function(controlBits, cb) { var self = this,
                knownBits = Object.getOwnPropertyNames(controlBits || {});
            this.log.log("Will write control bits:", controlBits);
            chain(knownBits.map(function(memName) { var addr = 0; return function(nextCallback) { if (controlBits[memName] !== null) {
                        function verifyMem(cb) { self.readMemory(memName, addr, function(resp) { self.log.log("Read memory", memName, ":", hexRep(resp)); if (resp[0] == controlBits[memName]) { nextCallback() } else { self.errCb(errors.SPECIAL_BIT_MEMORY_VERIFICATION, { respons: resp, memName: memName, controlBits: controlBits[memName] }); return } }) } self.writeMemory(memName, addr, controlBits[memName], verifyMem) } else { nextCallback() } } }), cb) };
        AvrdudeTransaction.prototype.operation = function(op, args, cb, cmd) { this.log.log("Running operation:", op); var operation = this.config.avrdude.ops[op]; return (cmd || this.cmd.bind(this))(ops.opToBin(operation, args), cb) };
        AvrdudeTransaction.prototype.maybeChipErase = function(cb, cmd) { if (this.config.chipErase) { return this.chipErase(cb, cmd) } return cb() };
        AvrdudeTransaction.prototype.chipErase = function(cb, cmd) { var self = this;
            scheduler.setTimeout(function() { self.operation("CHIP_ERASE", {}, function() { self.transition("setupSpecialBits", self.config.controlBits, cb) }, cmd) }, self.config.avrdude.chipEraseDelay / 1e3) };
        AvrdudeTransaction.prototype.confirmPages = function(confirmPagesCbs, cb) { var self = this,
                ccb = confirmPagesCbs[0]; if (ccb) { ccb(this.transitionCb("confirmPages", confirmPagesCbs.slice(1), cb)) } else { cb() } };

        function UsbAvrdudeTransaction() { this.init.apply(this, arguments) } UsbAvrdudeTransaction.prototype = replacePrototype(Object.create(AvrdudeTransaction.prototype), DummyTransaction, USBTransaction);

        function SerialAvrdudeTransaction() {} SerialAvrdudeTransaction.prototype = replacePrototype(Object.create(AvrdudeTransaction.prototype), DummyTransaction, SerialTransaction);
        SerialAvrdudeTransaction.prototype.init = function _serialInit() { this.superApply(_serialInit, arguments);
            this.connectionManager = new ConnectionManager(this) };
        module.exports.UsbAvrdudeTransaction = UsbAvrdudeTransaction;
        module.exports.SerialAvrdudeTransaction = SerialAvrdudeTransaction }, { "./connection/serialreset.js": 15, "./errors.js": 16, "./memops.js": 20, "./status.js": 22, corelib: 29 }],
    12: [function(require, module, exports) {
        var SerialAvrdudeTransaction = require("./avrdudetransaction.js").SerialAvrdudeTransaction,
            getLog = require("corelib").getLog,
            ConnectionManager = require("./connection/magicreset.js").ConnectionManager,
            ButterflyCodecSocket = require("./io/butterflycodec.js").ButterflyCodecSocket,
            storeAsTwoBytes = require("corelib").storeAsTwoBytes,
            scheduler = require("corelib").scheduler,
            status = require("./status.js"),
            errors = require("./errors.js");

        function AVR109Transaction() { this.init.apply(this, arguments) } AVR109Transaction.prototype = Object.create(SerialAvrdudeTransaction.prototype);
        AVR109Transaction.prototype.init = function() { this.__proto__.__proto__.init.apply(this, arguments);
            this.AVR = { SOFTWARE_VERSION: 86, ENTER_PROGRAM_MODE: 80, LEAVE_PROGRAM_MODE: 76, SET_ADDRESS: 65, WRITE: 66, TYPE_FLASH: 70, EXIT_BOOTLOADER: 69, CR: 13, READ_PAGE: 103, SIG_CHECK: 115 };
            this.timeouts = { magicBaudConnected: 2e3, disconnectPollCount: 30, disconnectPoll: 100, pollingForDev: 500, finishWait: 2e3, finishTimeout: 2e3, finishPollForDev: 100, magicRetries: 3, magicRetryTimeout: 1e3 };
            this.initialDev = null;
            this.log = getLog("Butterfly");
            this.connectionManager = new ConnectionManager(this); var oldErrCb = this.errCb,
                self = this;
            this.codecsocketClass = ButterflyCodecSocket };
        AVR109Transaction.prototype.checkSignature = function(cb) { var self = this;
            this.writeThenRead([this.AVR.SIG_CHECK], function(data) { if (self.config.avrdude.signature.toString() == data.toString()) { self.errCb(errors.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: data }); return } cb() }, { minPureData: 3 }) };
        AVR109Transaction.prototype.flash = function(devName, hexData) { this.refreshTimeout();
            this.sketchData = hexData;
            this.deviceName = devName;
            this.transition("connecting", devName) };
        AVR109Transaction.prototype.connecting = function(devName) { var smartOpen = { state: "smartOpenDevice", retries: 3, retryInterval: 1e3 };
            this.refreshTimeout();
            this.log.log("Flashing. Config is:", this.config, "data:", this.sketchData);
            this.setStatus(status.CONNECTING, { device: devName });
            this.transition(smartOpen, devName, this.config.speed, null, this.transitionCb("connectDone")) };
        AVR109Transaction.prototype.connectDone = function(connectionId) { this.setConnectionId(connectionId);
            this.log.log("Connected to bootloader. Connection ID: ", this.getConnectionId());
            this.drain(this.transitionCb("maybeCheckSignature", this.transitionCb("drainBytes"))) };
        AVR109Transaction.prototype.programmingDone = function() {
            var self = this;
            this.writeThenRead([this.AVR.LEAVE_PROGRAM_MODE], function(payload) {
                self.writeThenRead([self.AVR.EXIT_BOOTLOADER], function(payload) { self.transition("disconnect", function() { self.cleanup() }) }, {
                    minPureData: 1
                })
            }, { minPureData: 1 })
        };
        AVR109Transaction.prototype.drainBytes = function(readArg) { var self = this;
            this.drain(function() { self.writeThenRead([self.AVR.SOFTWARE_VERSION], self.transitionCb("prepareToProgramFlash"), { minPureData: 2 }) }) };
        AVR109Transaction.prototype.prepareToProgramFlash = function() { var self = this,
                offset = self.config.offset || 0;
            this.writeThenRead(this.addressMsg(offset), function(response) { self.transition("programFlash", self.config.avrdude.memory.flash.page_size) }, { minPureData: 1 }) };
        AVR109Transaction.prototype.addressMsg = function(offset) { var addressBytes = storeAsTwoBytes(offset); return [this.AVR.SET_ADDRESS, addressBytes[1], addressBytes[0]] };
        AVR109Transaction.prototype.writeMsg = function(payload) { var sizeBytes = storeAsTwoBytes(payload.length); return [this.AVR.WRITE, sizeBytes[0], sizeBytes[1], this.AVR.TYPE_FLASH].concat(payload) };
        AVR109Transaction.prototype.writePage = function(offset, payload, done) { this.writeThenRead(this.writeMsg(payload), done, { minPureData: 1 }) };
        AVR109Transaction.prototype.programFlash = function(pageSize) { this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("programmingDone")) };
        module.exports.AVR109Transaction = AVR109Transaction
    }, { "./avrdudetransaction.js": 11, "./connection/magicreset.js": 14, "./errors.js": 16, "./io/butterflycodec.js": 17, "./status.js": 22, corelib: 29 }],
    13: [function(require, module, exports) { var errno = require("corelib").errno,
            RetVal = require("corelib").RetVal;
        module.exports = errno({ DTR_RTS_FAIL: new RetVal(1001, "Failed to set DTR/RTS"), PRECONFIGURE_CONNECT: new RetVal(20240, "Failed to connect during preconfiguration"), PRECONFIGURE_DISCONNECT: new RetVal(20241, "Failed to disconnect during preconfiguration"), CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."), SYNC_RESPONSE: new RetVal(20242, "Got bad response trying to sync."), PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to.") }) }, { corelib: 29 }],
    14: [function(require, module, exports) { var FiniteStateMachine = require("corelib").FiniteStateMachine,
            scheduler = require("corelib").scheduler,
            status = require("./../status.js"),
            errors = require("./../errors.js"); var LEONARDO_RESET_MESSAGE = "Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!";

        function pollGetDevicesUntil(expirationTime, devList, transaction, cb) { if (scheduler.now() >= expirationTime) { cb(null); return } if (transaction.dead()) return;
            transaction.serial.getDevices(function(devs) { if (!devs) { transaction.errCb(errors.API_ERROR, { method: "serial.getDevices" }); return } var newDevs = devs.filter(function(newDev) { return !devList.some(function(oldDev) { return oldDev.path == newDev.path }) }); if (newDevs.length > 0) { cb(newDevs[0].path); return } pollGetDevicesUntil(expirationTime, devs, transaction, cb) }) }

        function MagicReset(config, finishCb, errorCb, parent) { FiniteStateMachine.call(this, {}, finishCb, errorCb, parent);
            this.schedulerTimeout = null;
            this.config = config;
            this.serial = this.config.api.serial;
            this.magicBaudrate = 1200;
            this.magicConnectionId = null } MagicReset.prototype = Object.create(FiniteStateMachine.prototype);
        MagicReset.prototype.openDevice = function(device, speed) { this.connectSpeed = speed;
            this.initialDevice = device;
            this.transition("magicConnect") };
        MagicReset.prototype.safeSetTimeout = function(cb, timeout) { var self = this; if (this.safeTimeout) { this.errCb(errors.OVERLAPPING_TIMEOUTS); return } this.safeTimeout = scheduler.setTimeout(function() { self.safeTimeout = null;
                cb() }) };
        MagicReset.prototype.magicConnect = function() { var device = this.intialDevice,
                self = this;
            this.serial.connect(this.initialDevice, { bitrate: this.magicBaudrate, name: this.initialDevice }, function(info) { if (!info) { console.warn("Failed to connect to magic baudrate." + "  Contiuing anyway.");
                    self.transition("commenceReset"); return } self.magicConnectionId = info.connectionId;
                self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3) }) };
        MagicReset.prototype.controlSignal = function() { var self = this,
                failWarn = "I failed to set rts/dtr. " + "ArduinoIDE does not set rts, dtr when flashing AVR109 devices. " + "It expects that it will be set by the os during enumeration. " + "The codebenderplugin however does so explicitly, " + "but does not abort on failure.";
            this.serial.setControlSignals(this.magicConnectionId, { rts: false, dtr: true }, function(ok) { if (!ok) { console.warn(failWarn) } self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3) }) };
        MagicReset.prototype.magicDisconnect = function() { var self = this;
            this.serial.disconnect(this.magicConnectionId, function(ok) { self.magicConnectionId = null; if (!ok) { self.errCb(errors.LEONARDO_MAGIC_DISCONNECT_FAIL, { initialDevice: self.initialDevice }); return } self.transition("commenceReset") }) };
        MagicReset.prototype.commenceReset = function() { this.setStatus(status.LEONARDO_RESET_START);
            this.transition({ retries: 1, state: "waitForDevice" }, 5e3, this.transitionCb("tryOriginalDevice")) };
        MagicReset.prototype.waitForDevice = function(timeout, fallbackCb) { var expirationTime = scheduler.now() + timeout,
                self = this;
            fallbackCb = fallbackCb || function() { self.errCb(errors.LEONARDO_REAPPEAR_TIMEOUT) };
            this.serial.getDevices(function(devs) { pollGetDevicesUntil(expirationTime, devs, self, function(dev) { if (!dev) { fallbackCb(); return } scheduler.setTimeout(self.transitionCb("useDevice", dev), 100) }) }) };
        MagicReset.prototype.tryOriginalDevice = function(cb) { var self = this;
            this.serial.getDevices(function(devs) { if (devs.some(function(dev) { return dev.path == self.initialDevice })) { self.transition("useDevice", self.initialDevice); return } self.transition({ retries: 1, state: "waitForDevice" }, 5e3) }) };
        MagicReset.prototype.useDevice = function(dev) { var self = this;
            this.setStatus(status.LEONARDO_RESET_END);
            this.serial.connect(dev, { name: dev, bitrate: this.connectSpeed }, function(info) { if (!info) { self.errCb(errors.API_ERROR, { method: "serial.connect", dev: dev, speed: self.connectSpeed }); return } self.setStatus(status.START_FLASH); if (self.parentState) self.parentState.parent.connectionId = info.connectionId;
                self.cleanup() }) };
        MagicReset.prototype.localCleanup = function _lc(cb) { var callback = this.superBind(_lc, cb); if (this.safeTimeout) scheduler.clearTimeout(this.safeTimeout);
            this.safeTimeout = null; if (!this.magicConnectionId) { callback(); return } this.serial.disconnect(this.magicConnectionId, function(ok) { callback() }) };

        function PollingDisconnect(config, finishCb, errorCb, parent) { FiniteStateMachine.call(this, config, finishCb, errorCb, parent);
            this.serial = parent.serial } PollingDisconnect.prototype = Object.create(FiniteStateMachine.prototype);
        PollingDisconnect.prototype.closeDevice = function(initialDevice) { var self = this;
            this.initialDevice = initialDevice; if (!this.parentState.parent.connectionId) { this.cleanup(); return } this.serial.disconnect(this.parentState.parent.connectionId, function(ok) { if (!ok) { self.errCb(errors.LEONARDO_BOOTLOADER_DISCONNECT, { connectionId: self.parentState.parent.connectionId, initialDevice: self.initialDevice }); return } if (self.dead()) { self.cleanup(); return } self.transition("originalDevReappear") });
            this.parentState.parent.connectionId = null };
        PollingDisconnect.prototype.originalDevReappear = function() { var self = this,
                expirationTime = scheduler.now() + 2e3;
            this.serial.getDevices(function poll(devs) { if (devs.some(function(dev) { return dev.path == self.initialDevice })) { self.cleanup(); return } pollGetDevicesUntil(expirationTime, devs, self, function(dev) { if (!dev) { console.warn("Device didn't reappear", self.initialDevice);
                        self.cleanup(); return } poll(devs.concat([dev])) }) }) };

        function ConnectionManager(transaction) { this.transaction = transaction } ConnectionManager.prototype = { openDevice: function(dev, speed, _msg, cb) { var self = this;
                this.connector = this.transaction.child(MagicReset, function() { cb(self.transaction.connectionId) });
                this.connector.openDevice(dev, speed) }, closeDevice: function(cb) { if (this.closed) { cb(); return } this.closed = true; if (!this.connector) { this.transaction.errCb(errors.PREMATURE_RETURN, { desc: "magic closing null device" }); return } this.disconnector = this.transaction.child(PollingDisconnect, cb);
                this.disconnector.closeDevice(this.connector.initialDevice) } };
        module.exports.MagicReset = MagicReset;
        module.exports.PollingDisconnect = PollingDisconnect;
        module.exports.ConnectionManager = ConnectionManager }, { "./../errors.js": 16, "./../status.js": 22, corelib: 29 }],
    15: [function(require, module, exports) { var SocketTransaction = require("corelib").SocketTransaction,
            getLog = require("corelib").getLog,
            scheduler = require("corelib").scheduler,
            status = require("./../status.js"),
            errors = require("./errors.js");

        function ControlFsm(config, finishCb, errorCb, parent) { SocketTransaction.apply(this, arguments);
            this.parent = this.parentState.parent;
            this.codecsocketClass = this.parent.codecsocketClass;
            this.serial = config.api.serial } ControlFsm.prototype = Object.create(SocketTransaction.prototype);
        ControlFsm.prototype.maybeSetControls = function(cid, val, cb, _dontFail) { if (this.config.avoidTwiggleDTR) { scheduler.setTimeout(cb); return } this.setControls(cid, val, cb, true) };
        ControlFsm.prototype.setControls = function(cid, val, cb, _dontFail) { var self = this; if (!cid) { if (_dontFail) { cb(); return } self.errCb(errors.DTR_RTS_FAIL, { message: "Bad connection id", connectionId: cid }); return } this.log.log("Setting RTS/DTR (", cid, "):", val);
            this.serial.setControlSignals(cid, { dtr: val, rts: val }, function(ok) { if (!ok) { if (_dontFail) { cb(); return } self.errCb(errors.DTR_RTS_FAIL); return } scheduler.setImmediate(cb) }) };

        function SerialReset(config, finishCb, errorCb, parent) { ControlFsm.apply(this, arguments);
            this.devConfig = null;
            this.log = getLog("SerialReset");
            this.preconfigureConnectionId = null;
            this.unsyncedConnectionId = null } SerialReset.prototype = Object.create(ControlFsm.prototype);
        SerialReset.prototype.localCleanup = function _serialCleanup(cb) { var self = this;
            this.maybeDisconnect(this.preconfigureConnectionId, function() { self.preconfigureConnectionId = null;
                self.maybeDisconnect(self.unsyncedConnectionId, function() { self.unsyncedConnectionId = null;
                    self.superCall(_serialCleanup, cb) }) }) };
        SerialReset.prototype.maybeDisconnect = function(cid, cb) { if (typeof cid !== "number") { cb(); return } this.log.log("API call to disconnect", cid);
            this.serial.disconnect(cid, cb) };
        SerialReset.prototype.openDevice = function(device, speed, syncConf) { if (this.config.preconfigureDevice) { this.transition("preconfigureOpenDevice", device, speed, syncConf); return } this.transition("normalOpenDevice", device, speed, syncConf) };
        SerialReset.prototype.preconfigureOpenDevice = function(device, speed, syncConf) { this.syncConf = syncConf;
            this.devConfig = { device: device, speed: speed };
            this.setStatus(status.PRECONFIGURING, { device: device });
            this.serial.connect(device, { bitrate: this.config.speed, name: device }, this.transitionCb("preconfigureConnected")) };
        SerialReset.prototype.preconfigureConnected = function(info) { if (!info) { this.errCb(errors.PRECONFIGURE_CONNECT, { devConfig: this.devConfig }); return } this.preconfigureConnectionId = info.connectionId;
            this.log.log("Connected for preconfiguration:", info.connectionId);
            this.transition("presetControlSignals") };
        SerialReset.prototype.presetControlSignals = function() { this.maybeSetControls(this.preconfigureConnectionId, false, this.transitionCb("finalizePreparation")) };
        SerialReset.prototype.finalizePreparation = function() { var self = this;
            this.serial.disconnect(this.preconfigureConnectionId, function(ok) { if (!ok) { self.errCb(errors.PRECONFIGURE_DISCONNECT, { devConfig: self.devConfig }); return } self.preconfigureConnectionId = null;
                self.transition("normalOpenDevice", self.devConfig.device, self.devConfig.speed, self.syncConf) }) };
        SerialReset.prototype.normalOpenDevice = function(device, speed, syncConf) { this.setStatus(status.CONNECTING, { device: device });
            this.syncConf = syncConf;
            this.devConfig = { device: device, speed: speed };
            this.serial.connect(device, { bitrate: this.config.speed, name: device }, this.transitionCb("normalConnected")) };
        SerialReset.prototype.normalConnected = function(info) { if (!info) { this.errCb(errors.CONNECTION_FAIL, { devConfig: this.devConfig }); return } this.unsyncedConnectionId = info.connectionId;
            this.setConnectionId(info.connectionId);
            this.log.log("Connected to preconfigured device:", info.connectionId);
            scheduler.setTimeout(this.transitionCb("twiggleDtr"), 50) };
        SerialReset.prototype.twiggleDtr = function() { var self = this,
                cid = this.unsyncedConnectionId,
                transition = { state: "sync", retries: 10, waitBefore: 400, retryInterval: 0 };
            this.setStatus(status.RESETTING, { device: this.devConfig.device });
            this.maybeSetControls(cid, false, function() { scheduler.setTimeout(function() { self.maybeSetControls(cid, true, self.transitionCb(transition)) }, 250) }) };
        SerialReset.prototype.sync = function() { var self = this;
            this.drain(function() { self.writeThenRead(self.syncConf.request, self.transitionCb("finalizeConnect"), { ttl: 200 }) }) };
        SerialReset.prototype.finalizeConnect = function(data) { if (this.syncConf && this.syncConf.response && this.syncConf.response.some(function(b, i) { return b != data[i] })) { this.errCb(errors.SYNC_RESPONSE, { expected: this.syncConf.response, got: data }); return } this.unsyncedConnectionId = null;
            this.parent.setSocket(this.getSocket());
            this.cleanup(this.finishCallback) };

        function ConnectionManager(transaction) { this.transaction = transaction;
            this.connector = null;
            this.closed = false;
            this.log = getLog("ConnectionManager") } ConnectionManager.prototype = { openDevice: function(dev, speed, msg, cb) { var self = this;
                this.log.log("Opening device", dev);
                this.connector = this.transaction.child(SerialReset, function() { self.log.log("Passing reset device to stk500:", self.connector.getConnectionId());
                    cb(self.transaction.getConnectionId()) });
                this.connector.transition("openDevice", dev, speed, msg) }, closeDevice: function(cb) { if (this.closed) { cb(); return } this.closed = true; if (!this.connector) { this.transaction.errCb(errors.PREMATURE_RETURN, { desc: "serial closing null device" }); return } if (this.transaction.getConnectionId() === null) { this.log.log("Skipping disconnecting of a non-connected transaction.");
                    cb(); return } var cid = this.transaction.getConnectionId(),
                    connector = this.connector;
                this.log.log("Closing device", cid);
                connector.maybeSetControls(cid, false, function() { connector.maybeDisconnect(cid, cb) }) } };
        module.exports.SerialReset = SerialReset;
        module.exports.ConnectionManager = ConnectionManager }, { "./../status.js": 22, "./errors.js": 13, corelib: 29 }],
    16: [function(require, module, exports) { var errno = require("corelib").errno,
            RetVal = require("corelib").RetVal;
        module.exports = errno({ BULK_TRANSFER: new RetVal(20098, "Failed sk500v2usb bulk transfer"), SIGNATURE_FAIL: new RetVal(20092, "Signature check failed."), PAGE_CHECK: new RetVal(20095, "Failed page check"), SPECIAL_BIT_MEMORY_VERIFICATION: new RetVal(202103, "Failed to verify special bit after write."), OVERLAPPING_TIMEOUTS: new RetVal(20108, "Each transaction should have at most one timeout at a time."), LEONARDO_DTR_FAIL: new RetVal(20106, "Failed to set dtr to a butterfly device."), LEONARDO_MAGIC_DISCONNECT_FAIL: new RetVal(20101, "Failed to disconnect from magic baudrate"), LEONARDO_REAPPEAR_TIMEOUT: new RetVal(20103, "Butterfly device never reappeared after magic"), LEONARDO_BOOTLOADER_DISCONNECT: new RetVal(20107, "Failed to disconnect before attempting to retry connecting to a bootloader that didn't behave like caterina."), PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to."), DTR_RTS_FAIL: new RetVal(1001, "Failed to set DTR/RTS"), PRECONFIGURE_CONNECT: new RetVal(20240, "Failed to connect during preconfiguration"), PRECONFIGURE_DISCONNECT: new RetVal(20241, "Failed to disconnect during preconfiguration"), CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."), SYNC_RESPONSE: new RetVal(20242, "Got bad response trying to sync."), PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to."), COMMAND_SIZE_FAIL: new RetVal(20007, "Tried to send mis-sized command (should be 4 bytes)"), PAGE_WRITE_RESPONSE: new RetVal(20096, "Expected different response for page write"), SYNC_RESPONSE: new RetVal(20242, "Got bad response trying to sync."), STK500V2USB_DEVICE_RESET: new RetVal(20097, "Failed sk500v2usb device reset"), BULK_RECEIVE: new RetVal(20099, "Failed sk500v2usb bulk receive"), UNSUPPORTED_TPI: new RetVal(20093, "Device is tpi. We don't support that."), ADDRESS_TOO_LONG: new RetVal(202100, "Address exceeds address space"), COMMAND_CHECK: new RetVal(20177, "Bad responce to command.") }) }, { corelib: 29 }],
    17: [function(require, module, exports) { var CodecSocket = require("corelib").CodecSocket,
            createBadMessage = require("corelib").createBadMessage,
            createFinalMessage = require("corelib").createFinalMessage; var STK_INSYC = 20,
            STK_OK = 16,
            createMessage = createSizedMessage;

        function createSizedMessage(dataBuffer, minPureData) { if (dataBuffer.length != minPureData) return createBadMessage(dataBuffer, 0, "Not the right amount of data"); return new createFinalMessage(dataBuffer.slice(minPureData), dataBuffer.slice(0, minPureData)) }

        function ButterflyCodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb) } ButterflyCodecSocket.prototype = Object.create(CodecSocket.prototype);
        ButterflyCodecSocket.prototype.encode = function(data) { return data };
        ButterflyCodecSocket.prototype.decode = function(dataBuffer, minPureData) { return createMessage(dataBuffer, minPureData) };
        module.exports.createEndedMessage = createSizedMessage;
        module.exports.ButterflyCodecSocket = ButterflyCodecSocket }, { corelib: 29 }],
    18: [function(require, module, exports) { var CodecSocket = require("corelib").CodecSocket,
            createBadMessage = require("corelib").createBadMessage,
            createFinalMessage = require("corelib").createFinalMessage; var STK_INSYC = 20,
            STK_OK = 16,
            createMessage = createEndMessage;

        function createEndMessage(dataBuffer, minPureData) { var i; if (dataBuffer.length < minPureData + 2) return createBadMessage(dataBuffer, 0, "Expecting more data"); for (i = dataBuffer.length; i >= 0; i--) { if (dataBuffer[i] == STK_OK) break } if (i < 0) return createBadMessage(dataBuffer, 0, "No end found"); return createStartMessage(dataBuffer, i, minPureData) }

        function createStartMessage(dataBuffer, endIndex, minPureData) { var start; for (start = endIndex - minPureData - 1; start >= 0; start--) { if (dataBuffer[start] == STK_INSYC) break } if (start < 0) createBadMessage(dataBuffer, 0, "No start found"); return createFinalMessage(dataBuffer.slice(endIndex + 1), dataBuffer.slice(start + 1, endIndex)) }

        function Stk500CodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb) } Stk500CodecSocket.prototype = Object.create(CodecSocket.prototype);
        Stk500CodecSocket.prototype.encode = function(data) { return data };
        Stk500CodecSocket.prototype.decode = function(dataBuffer, minPureData, config) { if (!config || !config.ignoreBadFinalByte) { return createMessage(dataBuffer, minPureData || 0) } return createStartMessage(dataBuffer, dataBuffer.length, 0) };
        module.exports.Stk500CodecSocket = Stk500CodecSocket }, { corelib: 29 }],
    19: [function(require, module, exports) { var CodecSocket = require("corelib").CodecSocket,
            createBadMessage = require("corelib").createBadMessage,
            createFinalMessage = require("corelib").createFinalMessage,
            getLog = require("corelib").getLog,
            storeAsTwoBytes = require("corelib").storeAsTwoBytes; var STKv2_START = 27,
            STKv2_TOKEN = 14,
            createMessage = createLastStarterMessage,
            log;

        function createLastStarterMessage(dataBuffer, state) { var tokenIndex = typeof state.lastValidTokenIndex !== "undefined" ? state.lastValidTokenIndex : dataBuffer.length - 1;
            state.minMessage = 6 + (state.minPureData || 0); for (; tokenIndex >= 0; tokenIndex--) { if (dataBuffer[tokenIndex] == STKv2_TOKEN) break } if (dataBuffer.length < state.minMessage) return createBadMessage(dataBuffer, 9, "Too few bytes in buffer");
            state.lastValidTokenIndex = tokenIndex - 1; var startIndex = tokenIndex - 4; if (startIndex < 0) { return createBadMessage(dataBuffer, Math.max(startIndex, 0), "No message heaeder found") } if (dataBuffer[startIndex] != STKv2_START) { log.log("Found no start at:", startIndex); return createLastStarterMessage(dataBuffer, state) } return createSeqMessage(dataBuffer, startIndex + 1, state) }

        function createSeqMessage(dataBuffer, offset, state) { var newOffset = offset + 1,
                seq = dataBuffer[offset]; if (state.seq != seq) { log.warn("Bad sequence:", seq, "!=", state.seq); return createLastStarterMessage(dataBuffer, state) } return createLengthMessage(dataBuffer, newOffset, state) }

        function createLengthMessage(dataBuffer, offset, state) { var length1 = dataBuffer[offset],
                length2 = dataBuffer[offset + 1],
                msgLength = length1 << 8 | length2,
                newOffset = offset + 2,
                minRemainingBytes = msgLength + 2; if (state.minPureData && msgLength < state.minPureData) { log.warn("Less data than expected:", msgLength, "!=", state.minPureData); return createLastStarterMessage(dataBuffer, state) } if (minRemainingBytes + newOffset > dataBuffer.length) { log.warn("We are expecting", minRemainingBytes + newOffset - dataBuffer.length, "more bytes for this message."); return createBadMessage(dataBuffer, 0, "Need more bytes") } state.msgLength = msgLength; return createTokenMessage(dataBuffer, newOffset, state) }

        function createTokenMessage(dataBuffer, offset, state) { var newOffset = offset + 1; if (dataBuffer[offset] != STKv2_TOKEN) { log.warn("Expected a token, god garbage"); return createLastStarterMessage(dataBuffer, state) } return createContentMessage(dataBuffer, newOffset, state) }

        function createContentMessage(dataBuffer, offset, state) { var messageStart = offset,
                messageEnd = messageStart + state.msgLength,
                newOffset = messageEnd,
                message = dataBuffer.slice(messageStart, messageEnd); if (message.length != state.msgLength) { return createLastStarterMessage(dataBuffer, state) } state.message = message; return createCrcMessage(dataBuffer, newOffset, state) }

        function createCrcMessage(dataBuffer, offset, state) { var end = offset + 1,
                crc = dataBuffer.slice(state.lastValidTokenIndex - 3, end).reduce(function(a, b) { return a ^ b }, 0); if (crc != 0) { log.warn("Bad crc:", crc); return createLastStarterMessage(dataBuffer, state) } return createFinalMessage(dataBuffer.slice(end), state.message) }

        function Stk500v2CodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb);
            log = getLog("STK500v2codec");
            this.state = this.state || {};
            this.state.seq = 0 } Stk500v2CodecSocket.prototype = Object.create(CodecSocket.prototype);
        Stk500v2CodecSocket.prototype.encode = function(data) { var size = storeAsTwoBytes(data.length),
                msg = [STKv2_START, this.state.seq, size[0], size[1], STKv2_TOKEN].concat(data),
                crc = msg.reduce(function(a, b) { return a ^ b }, 0);
            msg.push(crc); return msg };
        Stk500v2CodecSocket.prototype.decode = function(dataBuffer, minPureData) { var state = { seq: this.state.seq, lastValidTokenIndex: dataBuffer.length - 1, minPureData: minPureData },
                message = createMessage(dataBuffer, state); if (message.message) this.state.seq = this.state.seq + 1 & 255; return message };
        module.exports.createStarterMessage = createLastStarterMessage;
        module.exports.createSeqMessage = createSeqMessage;
        module.exports.createLengthMessage = createLengthMessage;
        module.exports.createTokenMessage = createTokenMessage;
        module.exports.createContentMessage = createContentMessage;
        module.exports.createCrcMessage = createCrcMessage;
        module.exports.Stk500v2CodecSocket = Stk500v2CodecSocket }, { corelib: 29 }],
    20: [function(require, module, exports) {
        function opToBin(op, param) { var ret = [];
            param = param || {}; for (var i = 0; i < Math.ceil(op.length / 8); i++) ret.push(0);
            op.forEach(function(bitStruct, index) { var bit = bitStruct.instBit % 8,
                    byte = Math.floor(bitStruct.instBit / 8); if (bitStruct.bitType == "VALUE") { ret[byte] |= bitStruct.value << bit } else { var val = param[bitStruct.bitType] >> bitStruct.bitNo & 1;
                    ret[byte] |= val << bit } }); return ret.reverse() }

        function intToByteArray(intData, bitNum) { var ret = []; for (var i = 0; i < bitNum / 8; i++) { ret.push(intData & 255);
                bitNum = intData >> 8 } return ret.reverse() }

        function extractOpData(type, op, bin) { var retBits = 0,
                littleEndian = bin.slice().reverse(),
                intData = op.reduce(function(ret, bitStruct, index) { var bit = bitStruct.instBit % 8,
                        byte = Math.floor(bitStruct.instBit / 8),
                        byteMask = 1 << bit;
                    retBits = Math.max(retBits, bitStruct.bitNo + 1); if (bitStruct.bitType == type) { return ret | (littleEndian[byte] & byteMask) >> bit << bitStruct.bitNo } return ret }, 0); return intToByteArray(intData, retBits) }

        function checkMask(mask, cmd) { return mask.length == cmd.length && !mask.some(function(mb, i) { return !(cmd[i] == mb || typeof mb !== "number") }) } module.exports.extractOpData = extractOpData;
        module.exports.opToBin = opToBin;
        module.exports.checkMask = checkMask }, {}],
    21: [function(require, module, exports) {
        var obj1624 = {};
        var obj1623 = {};
        var obj1622 = [255, 255];
        var obj1621 = [127, 127];
        var obj1620 = [0, 0];
        var obj1619 = [128, 127];
        var obj1618 = [0, 255];
        var obj1617 = [255, 0];
        var obj1616 = [30, 148, 5];
        var obj1615 = [30, 146, 13];
        var obj1614 = [30, 149, 11];
        var obj1613 = [30, 146, 7];
        var obj1612 = [30, 149, 15];
        var obj1611 = [30, 150, 9];
        var obj1610 = [30, 147, 3];
        var obj1609 = [30, 151, 2];
        var obj1608 = [30, 148, 10];
        var obj1607 = [30, 146, 2];
        var obj1606 = [30, 150, 8];
        var obj1605 = [30, 145, 15];
        var obj1604 = [30, 145, 11];
        var obj1603 = [30, 145, 1];
        var obj1602 = [30, 145, 9];
        var obj1601 = [30, 149, 12];
        var obj1600 = [30, 167, 1];
        var obj1599 = [30, 147, 8];
        var obj1598 = [30, 147, 15];
        var obj1597 = [30, 146, 3];
        var obj1596 = [30, 149, 7];
        var obj1595 = [30, 144, 4];
        var obj1594 = [30, 151, 5];
        var obj1593 = [30, 147, 13];
        var obj1592 = [30, 145, 8];
        var obj1591 = [30, 148, 1];
        var obj1590 = [30, 148, 3];
        var obj1589 = [30, 150, 5];
        var obj1588 = [30, 146, 12];
        var obj1587 = [30, 150, 10];
        var obj1586 = [30, 149, 3];
        var obj1585 = [30, 146, 10];
        var obj1584 = [30, 144, 8];
        var obj1583 = [30, 151, 1];
        var obj1582 = [30, 167, 3];
        var obj1581 = [30, 146, 5];
        var obj1580 = [30, 149, 5];
        var obj1579 = [30, 168, 3];
        var obj1578 = [30, 167, 2];
        var obj1577 = [30, 143, 10];
        var obj1576 = [30, 149, 4];
        var obj1575 = [30, 144, 1];
        var obj1574 = [30, 151, 6];
        var obj1573 = [30, 146, 6];
        var obj1572 = [30, 147, 10];
        var obj1571 = [30, 149, 8];
        var obj1570 = [30, 147, 11];
        var obj1569 = [30, 148, 6];
        var obj1568 = [30, 144, 5];
        var obj1567 = [30, 146, 14];
        var obj1566 = [30, 150, 4];
        var obj1565 = [30, 150, 2];
        var obj1564 = [30, 150, 6];
        var obj1563 = [30, 146, 1];
        var obj1562 = [30, 151, 3];
        var obj1561 = [30, 148, 11];
        var obj1560 = [30, 152, 2];
        var obj1559 = [30, 147, 1];
        var obj1558 = [30, 145, 10];
        var obj1557 = [30, 150, 3];
        var obj1556 = [30, 147, 7];
        var obj1555 = [30, 149, 2];
        var obj1554 = [30, 149, 6];
        var obj1553 = [30, 144, 3];
        var obj1552 = [30, 151, 4];
        var obj1551 = [30, 146, 8];
        var obj1550 = [30, 145, 3];
        var obj1549 = [30, 152, 1];
        var obj1548 = [30, 147, 12];
        var obj1547 = [30, 145, 5];
        var obj1546 = [30, 147, 6];
        var obj1545 = [30, 168, 2];
        var obj1544 = [30, 145, 12];
        var obj1543 = [30, 166, 2];
        var obj1542 = [30, 148, 2];
        var obj1541 = [30, 144, 6];
        var obj1540 = [30, 143, 9];
        var obj1539 = [30, 148, 4];
        var obj1538 = [30, 144, 7];
        var obj1537 = [30, 166, 3];
        var obj1536 = [30, 148, 66];
        var obj1535 = [30, 152, 69];
        var obj1534 = [30, 152, 71];
        var obj1533 = [30, 151, 76];
        var obj1532 = [30, 148, 137];
        var obj1531 = [30, 149, 66];
        var obj1530 = [30, 147, 17];
        var obj1529 = [237, 192, 63];
        var obj1528 = [30, 150, 66];
        var obj1527 = [30, 150, 70];
        var obj1526 = [30, 149, 17];
        var obj1525 = [30, 149, 138];
        var obj1524 = [30, 150, 71];
        var obj1523 = [30, 152, 70];
        var obj1522 = [30, 151, 82];
        var obj1521 = [30, 152, 67];
        var obj1520 = [30, 150, 78];
        var obj1519 = [30, 151, 68];
        var obj1518 = [30, 149, 68];
        var obj1517 = [30, 149, 129];
        var obj1516 = [30, 147, 137];
        var obj1515 = [30, 151, 130];
        var obj1514 = [30, 149, 65];
        var obj1513 = [30, 147, 129];
        var obj1512 = [30, 150, 73];
        var obj1511 = [30, 150, 82];
        var obj1510 = [30, 151, 72];
        var obj1509 = [30, 150, 81];
        var obj1508 = [30, 151, 73];
        var obj1507 = [30, 151, 81];
        var obj1506 = [30, 148, 18];
        var obj1505 = [30, 151, 65];
        var obj1504 = [30, 147, 130];
        var obj1503 = [30, 151, 78];
        var obj1502 = [30, 150, 129];
        var obj1501 = [30, 150, 130];
        var obj1500 = [30, 148, 131];
        var obj1499 = [255, 255, 255];
        var obj1498 = [30, 151, 77];
        var obj1497 = [30, 149, 76];
        var obj1496 = [30, 148, 65];
        var obj1495 = [80, 73, 67];
        var obj1494 = [30, 148, 67];
        var obj1493 = [30, 152, 66];
        var obj1492 = [30, 149, 135];
        var obj1491 = [30, 151, 75];
        var obj1490 = [30, 147, 65];
        var obj1489 = [30, 148, 69];
        var obj1488 = [30, 151, 129];
        var obj1487 = [30, 149, 20];
        var obj1486 = [30, 151, 70];
        var obj1485 = [30, 151, 71];
        var obj1484 = [30, 151, 66];
        var obj1483 = [30, 147, 131];
        var obj1482 = [30, 152, 68];
        var obj1481 = [30, 148, 130];
        var obj1480 = [30, 150, 74];
        var obj1479 = { paged: false, readback: obj1620, memops: obj1623 };
        var obj1478 = { paged: false, size: 1, readback: obj1620, memops: obj1623 };
        var obj1477 = { paged: false, size: 3, readback: obj1620, memops: obj1623 };
        var obj1476 = { op: "CHIP_ERASE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1475 = { op: "PGM_ENABLE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1474 = { op: "CHIP_ERASE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1473 = { op: "CHIP_ERASE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1472 = { op: "CHIP_ERASE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1471 = { op: "PGM_ENABLE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1470 = { op: "CHIP_ERASE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1469 = { op: "CHIP_ERASE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1468 = { op: "PGM_ENABLE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1467 = { op: "PGM_ENABLE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1466 = { op: "PGM_ENABLE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1465 = { op: "PGM_ENABLE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1464 = { op: "CHIP_ERASE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1463 = { op: "CHIP_ERASE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1462 = { op: "CHIP_ERASE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1461 = { op: "PGM_ENABLE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1460 = { op: "PGM_ENABLE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1459 = { op: "PGM_ENABLE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1458 = { op: "CHIP_ERASE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1457 = { op: "CHIP_ERASE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1456 = { op: "PGM_ENABLE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1455 = { op: "PGM_ENABLE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1454 = { op: "CHIP_ERASE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1453 = { op: "PGM_ENABLE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1452 = { op: "CHIP_ERASE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1451 = { op: "CHIP_ERASE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1450 = { op: "PGM_ENABLE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1449 = { op: "CHIP_ERASE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1448 = { op: "PGM_ENABLE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1447 = { op: "CHIP_ERASE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1446 = { op: "PGM_ENABLE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1445 = { op: "PGM_ENABLE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1444 = { op: "PGM_ENABLE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1443 = { op: "CHIP_ERASE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1442 = { op: "CHIP_ERASE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1441 = { op: "PGM_ENABLE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1440 = { op: "CHIP_ERASE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1439 = { op: "CHIP_ERASE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1438 = { op: "PGM_ENABLE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1437 = { op: "PGM_ENABLE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj1436 = { op: "CHIP_ERASE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1435 = { op: "CHIP_ERASE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1434 = { op: "CHIP_ERASE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1433 = { op: "PGM_ENABLE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1432 = { op: "PGM_ENABLE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1431 = { op: "PGM_ENABLE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1430 = { op: "PGM_ENABLE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1429 = { op: "PGM_ENABLE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1428 = { op: "CHIP_ERASE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1427 = { op: "PGM_ENABLE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1426 = { op: "CHIP_ERASE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1425 = { op: "CHIP_ERASE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1424 = { op: "PGM_ENABLE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1423 = { op: "CHIP_ERASE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1422 = { op: "CHIP_ERASE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1421 = { op: "CHIP_ERASE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1420 = { op: "PGM_ENABLE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1419 = { op: "PGM_ENABLE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1418 = { op: "CHIP_ERASE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1417 = { op: "PGM_ENABLE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1416 = { op: "PGM_ENABLE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1415 = { op: "PGM_ENABLE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1414 = { op: "CHIP_ERASE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1413 = { op: "CHIP_ERASE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1412 = { op: "PGM_ENABLE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1411 = {
            op: "PGM_ENABLE",
            instBit: 1,
            bitType: "IGNORE",
            bitNo: 1,
            value: 0
        };
        var obj1410 = { op: "CHIP_ERASE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1409 = { op: "CHIP_ERASE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1408 = { op: "PGM_ENABLE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1407 = { op: "PGM_ENABLE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1406 = { op: "CHIP_ERASE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1405 = { op: "PGM_ENABLE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1404 = { op: "CHIP_ERASE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1403 = { op: "PGM_ENABLE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1402 = { op: "CHIP_ERASE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1401 = { op: "PGM_ENABLE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1400 = { op: "CHIP_ERASE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1399 = { op: "PGM_ENABLE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1398 = { op: "CHIP_ERASE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1397 = { op: "PGM_ENABLE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1396 = { op: "CHIP_ERASE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1395 = { op: "CHIP_ERASE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1394 = { op: "CHIP_ERASE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1393 = { op: "CHIP_ERASE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1392 = { op: "PGM_ENABLE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1391 = { op: "CHIP_ERASE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1390 = { op: "CHIP_ERASE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1389 = { op: "PGM_ENABLE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1388 = { op: "CHIP_ERASE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1387 = { op: "CHIP_ERASE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1386 = { op: "PGM_ENABLE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1385 = { op: "PGM_ENABLE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1384 = { op: "CHIP_ERASE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1383 = { op: "CHIP_ERASE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1382 = { op: "PGM_ENABLE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1381 = { op: "CHIP_ERASE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1380 = { op: "PGM_ENABLE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1379 = { op: "CHIP_ERASE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1378 = { op: "CHIP_ERASE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1377 = { op: "CHIP_ERASE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1376 = { op: "PGM_ENABLE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1375 = { op: "READ", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1374 = { op: "READ", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1373 = { op: "READ", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1372 = { op: "READ", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1371 = { op: "READ", instBit: 28, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1370 = { op: "READ", instBit: 2, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1369 = { op: "READ", instBit: 19, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1368 = { op: "READ", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1367 = { op: "READ", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1366 = { op: "READ", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1365 = { op: "READ", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1364 = { op: "READ", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1363 = { op: "READ", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1362 = { op: "READ", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1361 = { op: "READ", instBit: 3, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1360 = { op: "READ", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1359 = { op: "READ", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1358 = { op: "READ", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1357 = { op: "READ", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1356 = { op: "READ", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1355 = { op: "READ", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1354 = { op: "READ", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1353 = { op: "READ", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1352 = { op: "READ", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1351 = { op: "READ", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1350 = { op: "READ", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1349 = { op: "READ", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1348 = { op: "READ", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1347 = { op: "READ", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1346 = { op: "READ", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1345 = { op: "READ", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1344 = { op: "READ", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1343 = { op: "READ", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1342 = { op: "WRITE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1341 = { op: "WRITE", instBit: 17, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1340 = { op: "READ", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1339 = { op: "WRITE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1338 = { op: "WRITE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1337 = { op: "WRITE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1336 = { op: "READ", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1335 = { op: "READ", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1334 = { op: "WRITE", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1333 = { op: "WRITE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1332 = { op: "WRITE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1331 = { op: "WRITE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1330 = { op: "WRITE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1329 = { op: "READ", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1328 = { op: "WRITE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1327 = { op: "READ", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1326 = { op: "WRITE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1325 = { op: "READ", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1324 = { op: "WRITE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1323 = { op: "READ", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1322 = { op: "READ", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1321 = { op: "READ", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1320 = { op: "WRITE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj1319 = { op: "WRITE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1318 = { op: "WRITE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1317 = { op: "WRITE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1316 = { op: "WRITE", instBit: 18, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1315 = { op: "WRITE", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1314 = { op: "READ", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1313 = { op: "WRITE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1312 = { op: "WRITE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1311 = { op: "READ", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1310 = { op: "WRITE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1309 = { op: "READ", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1308 = { op: "WRITE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1307 = { op: "WRITE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1306 = { op: "READ", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1305 = { op: "READ", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1304 = { op: "WRITE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1303 = { op: "WRITE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1302 = { op: "WRITE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1301 = { op: "WRITE", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1300 = { op: "WRITE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1299 = { op: "READ", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1298 = { op: "WRITE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1297 = { op: "READ", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1296 = { op: "READ", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1295 = { op: "READ", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1294 = { op: "READ", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1293 = { op: "READ", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1292 = { op: "READ", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1291 = { op: "WRITE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1290 = { op: "WRITE", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1289 = { op: "READ", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1288 = { op: "WRITE", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1287 = { op: "WRITE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1286 = { op: "WRITE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1285 = { op: "WRITE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1284 = { op: "WRITE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1283 = { op: "READ", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1282 = { op: "WRITE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1281 = { op: "WRITE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1280 = { op: "READ", instBit: 8, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1279 = { op: "WRITE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1278 = { op: "WRITE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1277 = { op: "WRITE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1276 = { op: "WRITE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1275 = { op: "WRITE", instBit: 20, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1274 = { op: "WRITE", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1273 = { op: "READ", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1272 = { op: "WRITE", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1271 = { op: "WRITE", instBit: 16, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1270 = { op: "READ", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1269 = { op: "WRITE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1268 = { op: "WRITE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1267 = { op: "READ", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1266 = { op: "READ", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1265 = { op: "READ", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1264 = { op: "WRITE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1263 = { op: "READ", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1262 = { op: "READ", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1261 = { op: "WRITE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1260 = { op: "WRITE", instBit: 19, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1259 = { op: "READ", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1258 = { op: "WRITE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1257 = { op: "WRITE", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1256 = { op: "WRITE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1255 = { op: "WRITE", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1254 = { op: "READ", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1253 = { op: "WRITE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1252 = { op: "READ", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1251 = { op: "WRITE", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1250 = { op: "READ", instBit: 10, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1249 = { op: "WRITE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1248 = { op: "WRITE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1247 = { op: "WRITE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1246 = { op: "WRITE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1245 = { op: "WRITE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1244 = { op: "WRITE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1243 = { op: "WRITE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1242 = { op: "READ", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1241 = { op: "READ", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1240 = { op: "READ", instBit: 11, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1239 = { op: "READ", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1238 = { op: "WRITE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1237 = { op: "WRITE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1236 = { op: "READ", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1235 = { op: "READ", instBit: 12, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1234 = { op: "READ", instBit: 13, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1233 = { op: "READ", instBit: 9, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1232 = { op: "WRITE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1231 = { op: "READ", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1230 = { op: "WRITE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1229 = { op: "READ", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1228 = { op: "READ", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1227 = { op: "READ", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1226 = { op: "WRITE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1225 = { op: "READ", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1224 = { op: "READ", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1223 = { op: "WRITE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1222 = { op: "WRITE", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1221 = { op: "READ", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1220 = { op: "WRITE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1219 = { op: "WRITE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1218 = { op: "WRITE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1217 = { op: "WRITE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1216 = { op: "WRITE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1215 = { op: "WRITE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1214 = { op: "WRITE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1213 = { op: "READ_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1212 = { op: "READ_LO", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1211 = { op: "WRITE", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1210 = { op: "READ_LO", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1209 = { op: "READ_LO", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1208 = { op: "READ_HI", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1207 = { op: "WRITE", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1206 = { op: "READ_LO", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1205 = { op: "READ_HI", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1204 = { op: "READ_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1203 = { op: "READ_HI", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1202 = { op: "WRITE", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1201 = { op: "READ_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1200 = { op: "READ_LO", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1199 = { op: "READ_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1198 = { op: "READ_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1197 = { op: "READ_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1196 = { op: "READ_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1195 = { op: "READ_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1194 = { op: "READ_HI", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1193 = { op: "WRITE", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1192 = { op: "READ_LO", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1191 = { op: "WRITE", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1190 = { op: "WRITE", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1189 = { op: "READ_HI", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1188 = { op: "READ_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1187 = { op: "WRITE", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1186 = { op: "READ_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1185 = { op: "WRITE", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1184 = { op: "READ_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1183 = { op: "READ_LO", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1182 = { op: "READ_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1181 = { op: "READ_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1180 = { op: "WRITE", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1179 = { op: "READ_HI", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1178 = { op: "WRITE", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1177 = { op: "READ_HI", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1176 = { op: "WRITE", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1175 = { op: "READ_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1174 = { op: "READ_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1173 = { op: "WRITE", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1172 = { op: "READ_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1171 = { op: "WRITE", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1170 = { op: "WRITE_HI", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1169 = { op: "WRITE_HI", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1168 = { op: "READ_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1167 = { op: "READ_LO", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1166 = { op: "READ_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1165 = { op: "WRITE_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1164 = { op: "READ_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1163 = { op: "WRITE_LO", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1162 = { op: "READ_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1161 = { op: "READ_LO", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1160 = { op: "WRITE_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1159 = { op: "READ_HI", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1158 = { op: "WRITE_LO", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1157 = { op: "READ_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1156 = { op: "WRITE_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1155 = { op: "WRITE_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1154 = { op: "READ_LO", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1153 = { op: "WRITE_LO", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1152 = { op: "READ_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1151 = { op: "WRITE_LO", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1150 = { op: "READ_LO", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1149 = { op: "WRITE_LO", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1148 = { op: "WRITE_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1147 = { op: "READ_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1146 = { op: "READ_HI", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1145 = { op: "WRITE_LO", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1144 = { op: "WRITE_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1143 = { op: "READ_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1142 = { op: "READ_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1141 = { op: "READ_HI", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1140 = { op: "WRITE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1139 = { op: "WRITE_HI", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1138 = { op: "WRITE_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1137 = { op: "READ_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1136 = { op: "READ_HI", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1135 = { op: "WRITE_HI", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1134 = { op: "READ_HI", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1133 = { op: "WRITE_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1132 = { op: "WRITE_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1131 = { op: "WRITE_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1130 = { op: "WRITE_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1129 = { op: "WRITE_HI", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1128 = { op: "READ_HI", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1127 = { op: "WRITE_LO", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1126 = { op: "READ_LO", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1125 = { op: "READ_LO", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1124 = { op: "READ_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1123 = { op: "WRITE_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1122 = { op: "WRITE_HI", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1121 = { op: "READ_LO", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1120 = { op: "READ_HI", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1119 = { op: "WRITE_HI", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1118 = { op: "WRITE_HI", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1117 = { op: "WRITE_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1116 = { op: "WRITE_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1115 = { op: "READ_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1114 = { op: "WRITE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1113 = { op: "READ_HI", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1112 = { op: "READ_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1111 = { op: "READ_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1110 = { op: "WRITE_LO", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1109 = { op: "READ_LO", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1108 = { op: "WRITEPAGE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1107 = { op: "WRITEPAGE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1106 = { paged: false, size: 131072, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1105 = { op: "READ_HI", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1104 = { op: "WRITEPAGE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1103 = { op: "READ_LO", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj1102 = { op: "WRITEPAGE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1101 = { op: "WRITEPAGE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1100 = { paged: false, size: 270336, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1099 = { op: "READ_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1098 = { op: "WRITEPAGE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1097 = { op: "READ_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1096 = { op: "READ_HI", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1095 = { paged: false, size: 139264, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1094 = { op: "WRITEPAGE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1093 = { op: "WRITEPAGE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1092 = { op: "READ_LO", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1091 = { paged: false, size: 4096, page_size: 32, readback: obj1620, memops: obj1623 };
        var obj1090 = { paged: false, size: 4096, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1089 = { op: "READ_LO", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1088 = { op: "WRITE_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1087 = { op: "WRITE_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1086 = { paged: false, size: 69632, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1085 = { paged: false, size: 2048, page_size: 32, readback: obj1620, memops: obj1623 };
        var obj1084 = { op: "WRITEPAGE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1083 = { op: "READ_LO", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj1082 = { op: "WRITE_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1081 = { op: "WRITE_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1080 = { op: "WRITEPAGE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1079 = { paged: false, size: 393216, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1078 = { op: "READ_HI", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj1077 = { paged: false, size: 20480, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1076 = { paged: false, size: 262144, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1075 = { paged: false, size: 32768, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1074 = { op: "WRITEPAGE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1073 = { paged: false, size: 16384, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1072 = { paged: false, size: 4096, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1071 = { paged: false, size: 36864, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1070 = { op: "WRITEPAGE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1069 = { op: "WRITE_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1068 = { paged: false, size: 10240, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1067 = { op: "WRITEPAGE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1066 = { op: "WRITEPAGE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1065 = { op: "WRITE_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1064 = { paged: false, size: 204800, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1063 = { op: "WRITEPAGE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1062 = { op: "READ_LO", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1061 = { op: "WRITE_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1060 = { op: "READ_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1059 = { paged: false, size: 1, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj1058 = { paged: false, size: 256, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1057 = { paged: false, size: 2048, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1056 = { op: "READ_HI", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1055 = { op: "WRITEPAGE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1054 = { op: "READ_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1053 = { paged: false, size: 8192, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1052 = { paged: false, size: 36864, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1051 = { op: "READ_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1050 = { op: "WRITEPAGE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1049 = { op: "READ_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1048 = { paged: false, size: 196608, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1047 = { op: "WRITE_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1046 = { op: "WRITEPAGE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1045 = { paged: false, size: 3, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj1044 = { op: "WRITEPAGE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1043 = { op: "WRITEPAGE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1042 = { op: "READ_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1041 = { op: "WRITE_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1040 = { op: "WRITEPAGE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1039 = { paged: false, size: 16384, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1038 = { op: "WRITEPAGE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1037 = { op: "READ_HI", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj1036 = { paged: false, size: 4096, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1035 = { op: "READ_LO", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1034 = { op: "READ_HI", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1033 = { paged: false, size: 401408, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1032 = { op: "WRITEPAGE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1031 = { op: "WRITEPAGE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1030 = { op: "WRITEPAGE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1029 = { paged: false, size: 8192, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1028 = { op: "WRITE_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1027 = { op: "READ_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1026 = { paged: false, size: 65536, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1025 = { paged: false, size: 8192, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1024 = { op: "READ_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1023 = { op: "READ_HI", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1022 = { paged: false, size: 128, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1021 = { op: "READ_HI", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1020 = { op: "WRITEPAGE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1019 = { paged: false, size: 1024, page_size: 32, readback: obj1620, memops: obj1623 };
        var obj1018 = { op: "WRITEPAGE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1017 = { op: "WRITE_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1016 = { paged: false, size: 131072, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1015 = { op: "WRITEPAGE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1014 = { op: "READ_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1013 = { paged: false, size: 139264, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj1012 = { op: "READ_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1011 = { op: "READ_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1010 = { op: "WRITEPAGE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1009 = { op: "WRITEPAGE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1008 = { op: "READ_LO", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1007 = { paged: false, size: 50, page_size: 50, readback: obj1620, memops: obj1623 };
        var obj1006 = { op: "WRITE_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1005 = { op: "WRITEPAGE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1004 = { paged: false, size: 20480, page_size: 256, readback: obj1620, memops: obj1623 };
        var obj1003 = { op: "WRITE_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1002 = { op: "READ_HI", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj1001 = { paged: false, size: 32768, page_size: 128, readback: obj1620, memops: obj1623 };
        var obj1000 = { op: "READ_LO", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj999 = { op: "READ_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj998 = { paged: false, size: 512, page_size: 512, readback: obj1620, memops: obj1623 };
        var obj997 = { paged: false, size: 512, page_size: 32, readback: obj1620, memops: obj1623 };
        var obj996 = { op: "READ_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj995 = { op: "WRITE_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj994 = { op: "WRITEPAGE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj993 = { op: "READ_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj992 = { op: "WRITE_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj991 = { op: "WRITE_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj990 = { op: "WRITEPAGE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj989 = { op: "WRITEPAGE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj988 = { op: "WRITEPAGE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj987 = { op: "WRITEPAGE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj986 = { op: "WRITEPAGE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj985 = { op: "WRITEPAGE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj984 = { op: "WRITEPAGE", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj983 = { op: "WRITE_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj982 = { op: "WRITE_LO", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj981 = { op: "WRITEPAGE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj980 = { op: "WRITE_LO", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj979 = { op: "WRITE_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj978 = { op: "WRITE_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj977 = { op: "WRITEPAGE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj976 = { op: "WRITE_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj975 = { op: "WRITEPAGE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj974 = { op: "WRITE_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj973 = { op: "WRITEPAGE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj972 = { op: "WRITEPAGE", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj971 = { op: "WRITE_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj970 = { op: "WRITE_HI", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj969 = { op: "WRITE_HI", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj968 = { op: "WRITEPAGE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj967 = { op: "WRITE_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj966 = { op: "WRITEPAGE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj965 = { op: "WRITEPAGE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj964 = { op: "WRITEPAGE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj963 = { op: "WRITE_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj962 = { op: "WRITEPAGE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj961 = {
            op: "WRITE_HI",
            instBit: 12,
            bitType: "ADDRESS",
            bitNo: 4,
            value: 0
        };
        var obj960 = { op: "WRITE_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj959 = { op: "WRITE_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj958 = { op: "WRITEPAGE", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj957 = { op: "WRITE_LO", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj956 = { op: "WRITEPAGE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj955 = { op: "WRITE_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj954 = { op: "WRITEPAGE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj953 = { op: "WRITE_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj952 = { op: "WRITEPAGE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj951 = { op: "WRITE_HI", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj950 = { op: "WRITEPAGE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj949 = { op: "WRITE_LO", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj948 = { op: "WRITE_HI", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj947 = { op: "WRITE_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj946 = { op: "WRITEPAGE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj945 = { op: "WRITEPAGE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj944 = { op: "WRITEPAGE", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj943 = { op: "LOADPAGE_HI", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj942 = { op: "LOADPAGE_LO", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj941 = { op: "LOADPAGE_LO", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj940 = { op: "LOADPAGE_LO", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj939 = { op: "LOADPAGE_LO", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj938 = { op: "WRITEPAGE", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj937 = { op: "WRITEPAGE", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj936 = { op: "LOADPAGE_LO", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj935 = { op: "LOADPAGE_LO", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj934 = { op: "LOADPAGE_LO", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj933 = { op: "WRITEPAGE", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj932 = { op: "LOADPAGE_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj931 = { op: "LOADPAGE_LO", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj930 = { op: "LOADPAGE_HI", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj929 = { op: "LOADPAGE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj928 = { op: "LOADPAGE_HI", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj927 = { op: "WRITEPAGE", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj926 = { op: "WRITEPAGE", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj925 = { op: "LOADPAGE_HI", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj924 = { op: "LOADPAGE_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj923 = { op: "WRITEPAGE", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj922 = { op: "LOADPAGE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj921 = { op: "LOADPAGE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj920 = { op: "LOADPAGE_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj919 = { op: "WRITEPAGE", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj918 = { op: "LOADPAGE_LO", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj917 = { op: "LOADPAGE_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj916 = { op: "LOADPAGE_LO", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj915 = { op: "LOADPAGE_HI", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj914 = { op: "LOADPAGE_HI", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj913 = { op: "LOADPAGE_LO", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj912 = { op: "LOADPAGE_HI", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj911 = { op: "LOADPAGE_LO", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj910 = { op: "LOADPAGE_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj909 = { op: "WRITEPAGE", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj908 = { op: "WRITEPAGE", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj907 = { op: "LOADPAGE_LO", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj906 = { op: "LOADPAGE_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj905 = { op: "LOADPAGE_HI", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj904 = { op: "LOADPAGE_HI", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj903 = { op: "LOADPAGE_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj902 = { op: "LOADPAGE_LO", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj901 = { op: "LOADPAGE_LO", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj900 = { op: "LOADPAGE_HI", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj899 = { op: "LOADPAGE_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj898 = { op: "LOADPAGE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj897 = { op: "WRITEPAGE", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj896 = { op: "LOADPAGE_HI", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj895 = { op: "LOADPAGE_LO", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj894 = { op: "LOADPAGE_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj893 = { op: "LOADPAGE_LO", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj892 = { op: "LOADPAGE_LO", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj891 = { op: "WRITEPAGE", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj890 = { op: "LOADPAGE_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj889 = { op: "LOADPAGE_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj888 = { op: "LOADPAGE_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj887 = { op: "LOADPAGE_LO", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj886 = { op: "LOADPAGE_LO", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj885 = { op: "LOADPAGE_HI", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj884 = { op: "WRITEPAGE", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj883 = { op: "LOADPAGE_HI", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj882 = { op: "LOADPAGE_HI", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj881 = { op: "WRITEPAGE", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj880 = { op: "LOADPAGE_HI", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj879 = { op: "WRITEPAGE", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj878 = { op: "LOADPAGE_HI", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj877 = { op: "LOADPAGE_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj876 = { op: "WRITEPAGE", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj875 = { op: "LOADPAGE_LO", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj874 = { op: "LOADPAGE_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj873 = { op: "LOADPAGE_LO", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj872 = { op: "LOADPAGE_LO", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj871 = { op: "LOADPAGE_LO", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj870 = { op: "LOADPAGE_HI", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj869 = { op: "LOADPAGE_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj868 = { op: "LOADPAGE_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj867 = { op: "LOADPAGE_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj866 = { op: "LOADPAGE_HI", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj865 = { op: "LOADPAGE_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj864 = { op: "LOADPAGE_LO", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj863 = { op: "LOADPAGE_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj862 = { op: "LOADPAGE_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj861 = { op: "LOADPAGE_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj860 = { op: "LOADPAGE_HI", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj859 = { op: "LOADPAGE_HI", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj858 = { op: "LOADPAGE_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj857 = { op: "LOADPAGE_LO", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj856 = { op: "LOADPAGE_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj855 = { op: "LOADPAGE_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj854 = { op: "LOADPAGE_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj853 = { op: "LOADPAGE_HI", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj852 = { op: "LOADPAGE_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj851 = { op: "LOADPAGE_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj850 = { op: "LOADPAGE_LO", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj849 = { op: "LOADPAGE_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj848 = { op: "LOAD_EXT_ADDR", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj847 = { op: "LOADPAGE_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj846 = { op: "LOADPAGE_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj845 = { op: "LOAD_EXT_ADDR", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj844 = { op: "LOAD_EXT_ADDR", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj843 = { op: "LOAD_EXT_ADDR", instBit: 24, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj842 = { op: "LOAD_EXT_ADDR", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj841 = { op: "LOAD_EXT_ADDR", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj840 = { op: "LOAD_EXT_ADDR", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj839 = { op: "LOADPAGE_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj838 = { op: "LOAD_EXT_ADDR", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj837 = { op: "LOADPAGE_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj836 = { op: "LOAD_EXT_ADDR", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj835 = { op: "LOAD_EXT_ADDR", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj834 = { op: "LOAD_EXT_ADDR", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj833 = { op: "LOAD_EXT_ADDR", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj832 = { op: "LOADPAGE_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj831 = { op: "LOAD_EXT_ADDR", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj830 = { op: "LOAD_EXT_ADDR", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj829 = { op: "LOADPAGE_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj828 = { op: "LOADPAGE_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj827 = { op: "LOADPAGE_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj826 = { op: "LOAD_EXT_ADDR", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj825 = { op: "LOADPAGE_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj824 = { op: "LOAD_EXT_ADDR", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj823 = { op: "LOAD_EXT_ADDR", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj822 = { op: "LOAD_EXT_ADDR", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj821 = { op: "LOAD_EXT_ADDR", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj820 = { op: "LOADPAGE_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj819 = { op: "LOADPAGE_HI", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj818 = { op: "LOAD_EXT_ADDR", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj817 = { op: "LOADPAGE_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj816 = { op: "LOAD_EXT_ADDR", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj815 = { op: "LOAD_EXT_ADDR", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj814 = { op: "LOAD_EXT_ADDR", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj813 = { op: "LOAD_EXT_ADDR", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj812 = { op: "LOADPAGE_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj811 = { op: "LOADPAGE_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj810 = { op: "LOAD_EXT_ADDR", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj809 = { op: "LOAD_EXT_ADDR", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj808 = { op: "LOAD_EXT_ADDR", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj807 = { op: "LOADPAGE_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj806 = { op: "LOAD_EXT_ADDR", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj805 = { op: "LOAD_EXT_ADDR", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj804 = { op: "LOADPAGE_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj803 = { op: "LOAD_EXT_ADDR", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj802 = { op: "LOAD_EXT_ADDR", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj801 = { op: "LOAD_EXT_ADDR", instBit: 8, bitType: "ADDRESS", bitNo: 16, value: 0 };
        var obj800 = { delay: 3, blocksize: 128, paged: false, size: 1024, readback: obj1620, memops: obj1623 };
        var obj799 = { delay: 5, blocksize: 64, paged: false, size: 64, readback: obj1620, memops: obj1623 };
        var obj798 = { blocksize: 128, paged: false, size: 1024, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj797 = { blocksize: 128, paged: false, size: 4096, page_size: 64, readback: obj1620, memops: obj1623 };
        var obj796 = { blocksize: 128, paged: false, size: 2048, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj795 = { blocksize: 4, paged: false, size: 1, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj794 = { blocksize: 128, paged: false, size: 512, page_size: 16, readback: obj1620, memops: obj1623 };
        var obj793 = { paged: true, size: 524288, page_size: 512, num_pages: 1024, readback: obj1620, memops: obj1623 };
        var obj792 = { flash: obj793 };
        var obj791 = { blocksize: 128, paged: true, size: 40960, page_size: 128, num_pages: 320, readback: obj1620, memops: obj1623 };
        var obj790 = { blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, readback: obj1620, memops: obj1623 };
        var obj789 = { signature: obj1045, fuse: obj795, calibration: obj1059, lockbits: obj1059 };
        var obj788 = { signature: obj1045, fuse: obj795, calibration: obj1059, lockbits: obj1059, flash: obj798 };
        var obj787 = { signature: obj1045, fuse: obj795, calibration: obj1059, lockbits: obj1059, flash: obj794 };
        var obj786 = { signature: obj1045, fuse: obj795, calibration: obj1059, lockbits: obj1059, flash: obj796 };
        var obj785 = { signature: obj1045, fuse: obj795, calibration: obj1059, lockbits: obj1059, flash: obj797 };
        var obj784 = { eeprom: obj799, flash: obj800, signature: obj1477, lock: obj1478, calibration: obj1478, fuse: obj1478 };
        var obj783 = { eeprom: obj790, flash: obj791, hfuse: obj1478, lfuse: obj1478, lockbits: obj1478, signature: obj1477 };
        var obj782 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479 };
        var obj781 = { AVRPart: "AT32UC3A0512", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1529, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: true, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj792 };
        var obj780 = { AVRPart: "deprecated, use 'uc3a0512'", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1529, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: true, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj792 };
        var obj779 = { AVRPart: "Common values for reduced core tinys", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1499, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj789 };
        var obj778 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1091, application: obj1079, apptable: obj1053, boot: obj1053, flash: obj1033, usersig: obj998 };
        var obj777 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1106, apptable: obj1053, boot: obj1053, flash: obj1013, usersig: obj998 };
        var obj776 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1019, application: obj1073, apptable: obj1090, boot: obj1090, flash: obj1004, usersig: obj1058 };
        var obj775 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj997, application: obj1025, apptable: obj1057, boot: obj1057, flash: obj1068, usersig: obj1022 };
        var obj774 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1019, application: obj1075, apptable: obj1090, boot: obj1090, flash: obj1071, usersig: obj1058 };
        var obj773 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj997, application: obj1039, apptable: obj1072, boot: obj1072, flash: obj1077, usersig: obj1022 };
        var obj772 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1019, application: obj1001, apptable: obj1072, boot: obj1072, flash: obj1052, usersig: obj1022 };
        var obj771 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1026, apptable: obj1090, boot: obj1090, flash: obj1086, usersig: obj1058 };
        var obj770 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1016, apptable: obj1090, boot: obj1029, flash: obj1095, usersig: obj1058 };
        var obj769 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1091, application: obj1076, apptable: obj1053, boot: obj1053, flash: obj1100, usersig: obj998 };
        var obj768 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1048, apptable: obj1053, boot: obj1053, flash: obj1064, usersig: obj998 };
        var obj767 = { AVRPart: "ATtiny9", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1584, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj788 };
        var obj766 = { AVRPart: "ATtiny4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1577, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj787 };
        var obj765 = { AVRPart: "ATtiny5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1540, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj787 };
        var obj764 = { AVRPart: "ATtiny10", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1553, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj788 };
        var obj763 = { AVRPart: "ATtiny20", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1605, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj786 };
        var obj762 = { AVRPart: "ATtiny40", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1567, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj785 };
        var obj761 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1048, apptable: obj1053, boot: obj1053, flash: obj1064, usersig: obj998, fuse0: obj1478 };
        var obj760 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1091, application: obj1076, apptable: obj1053, boot: obj1053, flash: obj1100, usersig: obj998, fuse0: obj1478 };
        var obj759 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1019, application: obj1073, apptable: obj1090, boot: obj1090, flash: obj1004, usersig: obj1058, fuse0: obj1478 };
        var obj758 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1106, apptable: obj1036, boot: obj1053, flash: obj1013, usersig: obj998, fuse0: obj1478 };
        var obj757 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1026, apptable: obj1090, boot: obj1090, flash: obj1086, usersig: obj1058, fuse0: obj1478 };
        var obj756 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1016, apptable: obj1029, boot: obj1029, flash: obj1095, usersig: obj1058, fuse0: obj1478 };
        var obj755 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1019, application: obj1075, apptable: obj1090, boot: obj1090, flash: obj1071, usersig: obj1058, fuse0: obj1478 };
        var obj754 = { signature: obj1477, prodsig: obj1007, fuse1: obj1478, fuse2: obj1478, fuse4: obj1478, fuse5: obj1478, lock: obj1478, data: obj1479, eeprom: obj1085, application: obj1106, apptable: obj1053, boot: obj1053, flash: obj1013, usersig: obj998, fuse0: obj1478 };
        var obj753 = { AVRPart: "ATtiny11", chipEraseDelay: 2e4, stk500_devcode: 17, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1595, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj784 };
        var obj752 = { AVRPart: "ATMEGA406", stk500_devcode: 0, pagel: 167, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1596, usbpid: 0, serialProgramMode: false, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 81, rampz: 0, spmcr: 87, eecr: 63, ocdrev: -1, ops: obj1624, memory: obj783 };
        var obj751 = { AVRPart: "AVR XMEGA family common values", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1499, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj782 };
        var obj750 = { AVRPart: "ATxmega8E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1490, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj775 };
        var obj749 = { AVRPart: "ATxmega32E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1497, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj772 };
        var obj748 = { AVRPart: "ATxmega16E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1489, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj773 };
        var obj747 = { AVRPart: "ATxmega192C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1507, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj768 };
        var obj746 = { AVRPart: "ATxmega192D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1508, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj768 };
        var obj745 = {
            AVRPart: "ATxmega64C3",
            stk500_devcode: 0,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1512,
            usbpid: 12246,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: false,
            hasWriteOperation: false,
            hasJtag: false,
            hasPdi: true,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            hventerstabdelay: 0,
            progmodedelay: 0,
            latchcycles: 0,
            togglevtg: 0,
            poweroffdelay: 0,
            resetdelayms: 0,
            resetdelayus: 0,
            hvleavestabdelay: 0,
            resetdelay: 0,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 0,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 0,
            programlockpulsewidth: 0,
            programlockpolltimeout: 0,
            synchcycles: 0,
            hvspcmdexedelay: 0,
            idr: 0,
            rampz: 0,
            spmcr: 0,
            eecr: 0,
            ocdrev: -1,
            ops: obj1624,
            memory: obj771
        };
        var obj744 = { AVRPart: "ATxmega32D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1531, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj774 };
        var obj743 = { AVRPart: "ATxmega64D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1480, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj771 };
        var obj742 = { AVRPart: "ATxmega16D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1536, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj776 };
        var obj741 = { AVRPart: "ATxmega32C4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1494, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj774 };
        var obj740 = { AVRPart: "ATxmega64D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1524, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj771 };
        var obj739 = { AVRPart: "ATxmega16C4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1518, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj776 };
        var obj738 = { AVRPart: "ATxmega384C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1535, usbpid: 12251, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj778 };
        var obj737 = { AVRPart: "ATxmega32A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1514, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj774 };
        var obj736 = { AVRPart: "ATxmega384D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1534, usbpid: 12251, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj778 };
        var obj735 = { AVRPart: "ATxmega128D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1510, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj777 };
        var obj734 = { AVRPart: "ATxmega64A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1527, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj771 };
        var obj733 = { AVRPart: "ATxmega128C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1522, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj777 };
        var obj732 = { AVRPart: "ATxmega256D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1482, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj769 };
        var obj731 = { AVRPart: "ATxmega128D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1485, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj777 };
        var obj730 = { AVRPart: "ATxmega16A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1496, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj776 };
        var obj729 = { AVRPart: "ATxmega256C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1523, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj769 };
        var obj728 = { AVRPart: "ATxmega128A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1486, usbpid: 12254, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj770 };
        var obj727 = { AVRPart: "ATxmega128A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1486, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj758 };
        var obj726 = { AVRPart: "ATxmega192A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1503, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj761 };
        var obj725 = { AVRPart: "ATxmega192A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1519, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj761 };
        var obj724 = { AVRPart: "ATxmega64A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1528, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj723 = { AVRPart: "ATxmega64B1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1511, usbpid: 12257, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj722 = { AVRPart: "ATxmega64B3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1509, usbpid: 12255, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj721 = { AVRPart: "ATxmega16A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1496, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj759 };
        var obj720 = { AVRPart: "ATxmega64A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1520, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj719 = { AVRPart: "ATxmega32A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1514, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj755 };
        var obj718 = { AVRPart: "ATxmega64A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1527, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj717 = { AVRPart: "ATxmega64A1U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1520, usbpid: 12264, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj716 = { AVRPart: "ATxmega256A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1493, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj760 };
        var obj715 = { AVRPart: "ATxmega128A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1484, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj754 };
        var obj714 = { AVRPart: "ATxmega128A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1533, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj754 };
        var obj713 = { AVRPart: "ATxmega64A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1528, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj757 };
        var obj712 = { AVRPart: "ATxmega128B1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1498, usbpid: 12266, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj756 };
        var obj711 = { AVRPart: "ATxmega256A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1523, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj760 };
        var obj710 = { AVRPart: "ATxmega128B3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1491, usbpid: 12256, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj756 };
        var obj709 = { AVRPart: "ATxmega256A3B", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1521, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj760 };
        var obj708 = { AVRPart: "ATxmega128A1U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1533, usbpid: 12269, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj754 };
        var obj707 = { AVRPart: "ATxmega128A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1484, usbpid: 12262, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj754 };
        var obj706 = { AVRPart: "ATxmega192A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1519, usbpid: 12263, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj761 };
        var obj705 = {
            AVRPart: "ATxmega256A3U",
            stk500_devcode: 0,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1493,
            usbpid: 12268,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: false,
            hasWriteOperation: false,
            hasJtag: true,
            hasPdi: true,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            hventerstabdelay: 0,
            progmodedelay: 0,
            latchcycles: 0,
            togglevtg: 0,
            poweroffdelay: 0,
            resetdelayms: 0,
            resetdelayus: 0,
            hvleavestabdelay: 0,
            resetdelay: 0,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 0,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 0,
            programlockpulsewidth: 0,
            programlockpolltimeout: 0,
            synchcycles: 0,
            hvspcmdexedelay: 0,
            idr: 0,
            rampz: 0,
            spmcr: 0,
            eecr: 0,
            ocdrev: -1,
            ops: obj1624,
            memory: obj760
        };
        var obj704 = { AVRPart: "ATxmega256A3BU", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1521, usbpid: 12258, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj760 };
        var obj703 = { AVRPart: "ATxmega128A1revD", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1505, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1624, memory: obj754 };
        var obj702 = [obj1457, obj1463, obj1474, obj1449, obj1436, obj1434, obj1428, obj1414, obj1421, obj1422, obj1462, obj1454, obj1439, obj1443, obj1440, obj1464, obj1413, obj1418, obj1476, obj1458, obj1451, obj1452, obj1469, obj1425, obj1423, obj1472, obj1426, obj1470, obj1447, obj1442, obj1473, obj1435];
        var obj701 = [obj1433, obj1468, obj1465, obj1466, obj1419, obj1448, obj1420, obj1475, obj1471, obj1456, obj1459, obj1431, obj1441, obj1460, obj1416, obj1444, obj1437, obj1461, obj1445, obj1467, obj1429, obj1446, obj1432, obj1438, obj1427, obj1415, obj1453, obj1455, obj1430, obj1450, obj1417, obj1424];
        var obj700 = [obj1388, obj1378, obj1390, obj1402, obj1410, obj1377, obj1394, obj1395, obj1396, obj1400, obj1379, obj1391, obj1383, obj1404, obj1393, obj1387, obj1413, obj1418, obj1476, obj1458, obj1451, obj1452, obj1469, obj1425, obj1423, obj1472, obj1426, obj1470, obj1447, obj1442, obj1473, obj1435];
        var obj699 = [obj1397, obj1411, obj1386, obj1385, obj1399, obj1392, obj1380, obj1407, obj1376, obj1401, obj1408, obj1412, obj1389, obj1382, obj1403, obj1405, obj1437, obj1461, obj1445, obj1467, obj1429, obj1446, obj1432, obj1438, obj1427, obj1415, obj1453, obj1455, obj1430, obj1450, obj1417, obj1424];
        var obj698 = [obj1388, obj1378, obj1390, obj1402, obj1410, obj1377, obj1394, obj1395, obj1396, obj1400, obj1379, obj1391, obj1383, obj1404, obj1393, obj1387, obj1398, obj1409, obj1384, obj1406, obj1381, obj1452, obj1469, obj1425, obj1423, obj1472, obj1426, obj1470, obj1447, obj1442, obj1473, obj1435];
        var obj697 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj696 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj695 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj694 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj693 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj692 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1351, obj1367, obj1357];
        var obj691 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj690 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj689 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1273, obj1299, obj1297, obj1340, obj1325, obj1366, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj688 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj687 = [obj1322, obj1270, obj1293, obj1361, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj686 = [obj1322, obj1270, obj1343, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj685 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1375, obj1374, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj684 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj683 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj682 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj681 = [obj1322, obj1270, obj1293, obj1259, obj1295, obj1283, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj680 = [obj1322, obj1327, obj1343, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj679 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj678 = [obj1322, obj1270, obj1293, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj677 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1369, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj676 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj675 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj674 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj673 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1351, obj1367, obj1357];
        var obj672 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1363, obj1366, obj1356, obj1353, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1351, obj1367, obj1357];
        var obj671 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1351, obj1367, obj1357];
        var obj670 = [obj1322, obj1270, obj1370, obj1259, obj1295, obj1306, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj669 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1263, obj1364, obj1365, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj668 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj667 = [obj1323, obj1327, obj1343, obj1296, obj1295, obj1283, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj666 = [obj1322, obj1327, obj1343, obj1296, obj1295, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj665 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj664 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1283, obj1321, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj663 = [obj1322, obj1270, obj1343, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj662 = [obj1322, obj1327, obj1343, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj661 = [obj1323, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1280, obj1233, obj1250, obj1240, obj1235, obj1234, obj1347, obj1345, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj660 = [obj1322, obj1270, obj1343, obj1296, obj1292, obj1306, obj1321, obj1265, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1346, obj1355, obj1357];
        var obj659 = [obj1323, obj1270, obj1293, obj1296, obj1295, obj1283, obj1273, obj1299, obj1297, obj1340, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1344, obj1371, obj1346, obj1355, obj1357];
        var obj658 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1371, obj1351, obj1367, obj1357];
        var obj657 = { READ: obj695 };
        var obj656 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1325, obj1309, obj1294, obj1336, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1371, obj1351, obj1367, obj1357];
        var obj655 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj654 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj653 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1373, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj652 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1266, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj651 = { READ: obj692 };
        var obj650 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1360, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj649 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1267, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj648 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1311, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj647 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1267, obj1289, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj646 = { READ: obj691 };
        var obj645 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1289, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj644 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1263, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj643 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1337, obj1261, obj1342, obj1285, obj1333, obj1258, obj1332, obj1312, obj1277, obj1302, obj1313, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj642 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1236, obj1350, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj641 = { READ: obj690 };
        var obj640 = [obj1274, obj1272, obj1315, obj1339, obj1287, obj1276, obj1300, obj1282, obj1337, obj1261, obj1342, obj1285, obj1333, obj1258, obj1332, obj1312, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj639 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1300, obj1282, obj1337, obj1261, obj1342, obj1285, obj1333, obj1258, obj1332, obj1312, obj1277, obj1302, obj1313, obj1324, obj1291, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj638 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1314, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj637 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1266, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj636 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1289, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj635 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1337, obj1261, obj1342, obj1285, obj1333, obj1258, obj1332, obj1312, obj1277, obj1302, obj1313, obj1269, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj634 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1236, obj1329, obj1348, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj633 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1267, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj632 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1314, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj631 = { READ: obj688 };
        var obj630 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1289, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj629 = { READ: obj685 };
        var obj628 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1236, obj1329, obj1335, obj1358, obj1372, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj627 = { READ: obj675 };
        var obj626 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1314, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj625 = { READ: obj674 };
        var obj624 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1236, obj1329, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj623 = [obj1322, obj1270, obj1293, obj1259, obj1292, obj1306, obj1321, obj1265, obj1224, obj1242, obj1227, obj1254, obj1228, obj1225, obj1231, obj1239, obj1221, obj1241, obj1229, obj1236, obj1252, obj1335, obj1262, obj1305, obj1352, obj1368, obj1354, obj1359, obj1349, obj1351, obj1367, obj1362];
        var obj622 = { READ: obj672 };
        var obj621 = { READ: obj673 };
        var obj620 = [obj1274, obj1272, obj1315, obj1339, obj1287, obj1276, obj1300, obj1282, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1313, obj1269, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj619 = [obj1274, obj1272, obj1315, obj1257, obj1287, obj1276, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1313, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj618 = [obj1274, obj1272, obj1315, obj1339, obj1287, obj1276, obj1300, obj1282, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj617 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj616 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1313, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj615 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1313, obj1269, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj614 = { READ: obj671 };
        var obj613 = { READ: obj658 };
        var obj612 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj611 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1313, obj1269, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj610 = [obj1274, obj1272, obj1315, obj1257, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj609 = { READ: obj656 };
        var obj608 = [obj1274, obj1272, obj1310, obj1339, obj1288, obj1334, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj607 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj606 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1300, obj1282, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj605 = [obj1274, obj1272, obj1315, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj604 = [obj1274, obj1272, obj1310, obj1339, obj1287, obj1276, obj1300, obj1282, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj603 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1276, obj1301, obj1282, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj602 = [obj1274, obj1272, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj601 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1249, obj1277, obj1302, obj1313, obj1324, obj1291, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj600 = [obj1274, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1277, obj1302, obj1279, obj1324, obj1291, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj599 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1271, obj1341, obj1279, obj1260, obj1331, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj598 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1271, obj1330, obj1279, obj1269, obj1331, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj597 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1271, obj1341, obj1316, obj1260, obj1275, obj1304, obj1308, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj596 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1320, obj1341, obj1316, obj1269, obj1331, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj595 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1271, obj1341, obj1279, obj1269, obj1331, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj594 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1332, obj1312, obj1226, obj1218, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj593 = [obj1214, obj1220, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1341, obj1316, obj1215, obj1253, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj592 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj591 = [obj1274, obj1272, obj1216, obj1246, obj1245, obj1219, obj1238, obj1248, obj1237, obj1243, obj1223, obj1230, obj1232, obj1217, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1304, obj1281, obj1307, obj1319, obj1338, obj1284, obj1303, obj1264, obj1317, obj1318, obj1278];
        var obj590 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1313, obj1324, obj1291, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj589 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj588 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1226, obj1218, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj587 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1247, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj586 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1218, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj585 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1324, obj1291, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj584 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1218, obj1244, obj1215, obj1253, obj1255, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj583 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1244, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj582 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1249, obj1226, obj1218, obj1244, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj581 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1187, obj1291, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj580 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1244, obj1215, obj1253, obj1255, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj579 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1215, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj578 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1226, obj1218, obj1244, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj577 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1218, obj1244, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj576 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1187, obj1253, obj1286, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj575 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1215, obj1253, obj1255, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj574 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1244, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj573 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1187, obj1253, obj1255, obj1308, obj1328, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj572 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1215, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj571 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1187, obj1253, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj570 = [obj1274, obj1272, obj1315, obj1257, obj1288, obj1334, obj1301, obj1290, obj1191, obj1180, obj1211, obj1176, obj1178, obj1173, obj1185, obj1193, obj1207, obj1190, obj1202, obj1187, obj1171, obj1255, obj1222, obj1251, obj1319, obj1338, obj1326, obj1256, obj1264, obj1268, obj1298, obj1278];
        var obj569 = { WRITE: obj606 };
        var obj568 = { WRITE: obj596 };
        var obj567 = { WRITE: obj593 };
        var obj566 = { paged: false, size: 1, readback: obj1620, memops: obj657 };
        var obj565 = { paged: false, size: 3, readback: obj1620, memops: obj651 };
        var obj564 = { paged: false, size: 1, readback: obj1620, memops: obj646 };
        var obj563 = { paged: false, size: 1, readback: obj1620, memops: obj641 };
        var obj562 = { paged: false, size: 1, readback: obj1620, memops: obj631 };
        var obj561 = { paged: false, size: 2, readback: obj1620, memops: obj631 };
        var obj560 = { paged: false, size: 1, readback: obj1620, memops: obj629 };
        var obj559 = { paged: false, size: 4, readback: obj1620, memops: obj627 };
        var obj558 = { paged: false, size: 4, readback: obj1620, memops: obj625 };
        var obj557 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1208, obj1177, obj1179, obj1189, obj1205, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj556 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1200, obj1209, obj1212, obj1192, obj1183, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj555 = { paged: false, size: 4, readback: obj1620, memops: obj621 };
        var obj554 = { paged: false, size: 3, readback: obj1620, memops: obj622 };
        var obj553 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1209, obj1212, obj1192, obj1183, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj552 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1177, obj1179, obj1189, obj1205, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj551 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1179, obj1189, obj1205, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj550 = { paged: false, size: 3, readback: obj1620, memops: obj614 };
        var obj549 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1212, obj1192, obj1183, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj548 = { paged: false, size: 3, readback: obj1620, memops: obj613 };
        var obj547 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1189, obj1205, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj546 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1192, obj1183, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj545 = { paged: false, size: 3, readback: obj1620, memops: obj609 };
        var obj544 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1111, obj1142, obj1143, obj1152, obj1157, obj1112, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj543 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1162, obj1137, obj1147, obj1124, obj1164, obj1168, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj542 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1137, obj1147, obj1124, obj1164, obj1168, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj541 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1205, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj540 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1142, obj1143, obj1152, obj1157, obj1112, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj539 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1183, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj538 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1143, obj1152, obj1157, obj1112, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj537 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1147, obj1124, obj1164, obj1168, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj536 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1152, obj1157, obj1112, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj535 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1124, obj1164, obj1168, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj534 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1103, obj1210, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj533 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1037, obj1194, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj532 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1164, obj1168, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj531 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1157, obj1112, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj530 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1037, obj1002, obj1203, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj529 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1103, obj1000, obj1206, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj528 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1103, obj1000, obj1115, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj527 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1037, obj1002, obj1166, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj526 = [obj1146, obj1120, obj1159, obj1141, obj1128, obj1134, obj1136, obj1113, obj999, obj993, obj1054, obj1060, obj1096, obj1097, obj1099, obj1012, obj1105, obj1023, obj1056, obj1021, obj1034, obj1037, obj1002, obj1078, obj1184, obj1195, obj1204, obj1181, obj1197, obj1186, obj1198, obj1199];
        var obj525 = [obj1126, obj1161, obj1121, obj1154, obj1150, obj1109, obj1125, obj1167, obj1051, obj1027, obj1024, obj1011, obj1014, obj996, obj1049, obj1042, obj1035, obj1089, obj1062, obj1008, obj1092, obj1103, obj1000, obj1083, obj1213, obj1172, obj1174, obj1188, obj1196, obj1175, obj1182, obj1201];
        var obj524 = [obj1119, obj1135, obj1122, obj1139, obj1129, obj1170, obj1118, obj1169, obj967, obj960, obj983, obj976, obj961, obj991, obj992, obj947, obj948, obj1047, obj1061, obj1081, obj1017, obj1006, obj1065, obj1003, obj1131, obj1116, obj1156, obj1160, obj1148, obj1117, obj1130, obj1144];
        var obj523 = [obj1110, obj1149, obj1127, obj1163, obj1145, obj1158, obj1153, obj1151, obj959, obj955, obj974, obj963, obj971, obj979, obj978, obj953, obj982, obj1041, obj1087, obj995, obj1069, obj1082, obj1028, obj1088, obj1140, obj1133, obj1155, obj1138, obj1123, obj1165, obj1132, obj1114];
        var obj522 = [obj1110, obj1149, obj1127, obj1163, obj1145, obj1158, obj1153, obj1151, obj959, obj955, obj974, obj963, obj971, obj979, obj978, obj953, obj982, obj957, obj1087, obj995, obj1069, obj1082, obj1028, obj1088, obj1140, obj1133, obj1155, obj1138, obj1123, obj1165, obj1132, obj1114];
        var obj521 = [obj1119, obj1135, obj1122, obj1139, obj1129, obj1170, obj1118, obj1169, obj967, obj960, obj983, obj976, obj961, obj991, obj992, obj947, obj948, obj970, obj1061, obj1081, obj1017, obj1006, obj1065, obj1003, obj1131, obj1116, obj1156, obj1160, obj1148, obj1117, obj1130, obj1144];
        var obj520 = [obj1119, obj1135, obj1122, obj1139, obj1129, obj1170, obj1118, obj1169, obj967, obj960, obj983, obj976, obj961, obj991, obj992, obj947, obj948, obj970, obj969, obj1081, obj1017, obj1006, obj1065, obj1003, obj1131, obj1116, obj1156, obj1160, obj1148, obj1117, obj1130, obj1144];
        var obj519 = [obj1110, obj1149, obj1127, obj1163, obj1145, obj1158, obj1153, obj1151, obj959, obj955, obj974, obj963, obj971, obj979, obj978, obj953, obj982, obj957, obj980, obj995, obj1069, obj1082, obj1028, obj1088, obj1140, obj1133, obj1155, obj1138, obj1123, obj1165, obj1132, obj1114];
        var obj518 = [obj1119, obj1135, obj1122, obj1139, obj1129, obj1170, obj1118, obj1169, obj967, obj960, obj983, obj976, obj961, obj991, obj992, obj947, obj948, obj970, obj969, obj951, obj1017, obj1006, obj1065, obj1003, obj1131, obj1116, obj1156, obj1160, obj1148, obj1117, obj1130, obj1144];
        var obj517 = [obj1110, obj1149, obj1127, obj1163, obj1145, obj1158, obj1153, obj1151, obj959, obj955, obj974, obj963, obj971, obj979, obj978, obj953, obj982, obj957, obj980, obj949, obj1069, obj1082, obj1028, obj1088, obj1140, obj1133, obj1155, obj1138, obj1123, obj1165, obj1132, obj1114];
        var obj516 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj1080, obj1067, obj962, obj954, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj515 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj926, obj891, obj884, obj879, obj923, obj1063, obj994, obj1018, obj1107, obj1009, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj514 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj994, obj1018, obj1107, obj1009, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj513 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj926, obj891, obj884, obj879, obj923, obj909, obj994, obj1018, obj1107, obj1009, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj512 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj1046, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj1018, obj1107, obj1009, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj511 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj990, obj981, obj962, obj954, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj510 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj981, obj962, obj954, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj509 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj891, obj884, obj879, obj923, obj909, obj919, obj1018, obj1107, obj1009, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj508 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj962, obj954, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj507 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj1046, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj506 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj1046, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj505 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj954, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj504 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj1107, obj1009, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj503 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj1009, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj502 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj1046, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj501 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj1107, obj1009, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj500 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj985, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj499 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj966, obj965, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj498 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj1005, obj1030, obj1046, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj972, obj1050, obj1094, obj1020, obj1102, obj1108, obj1044, obj1074, obj1043, obj1031, obj1084];
        var obj497 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj891, obj884, obj879, obj923, obj909, obj919, obj966, obj965, obj972, obj984, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj496 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj990, obj879, obj923, obj909, obj919, obj938, obj881, obj972, obj984, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj495 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj1050, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj494 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj926, obj891, obj884, obj879, obj923, obj909, obj985, obj966, obj965, obj972, obj984, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj493 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj972, obj984, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj492 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj990, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj491 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj965, obj972, obj984, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj490 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj489 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj990, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj958, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj488 = [obj1040, obj1010, obj1055, obj1093, obj1032, obj1015, obj1104, obj1070, obj908, obj944, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj937, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj487 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj990, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj937, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj486 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj977, obj988, obj952, obj989, obj956, obj946, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj937, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj485 = [obj950, obj968, obj987, obj964, obj973, obj986, obj975, obj945, obj908, obj944, obj876, obj897, obj926, obj891, obj884, obj879, obj923, obj909, obj919, obj938, obj881, obj933, obj927, obj1094, obj1020, obj1066, obj1038, obj1098, obj1074, obj1043, obj1031, obj1101];
        var obj484 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj569 };
        var obj483 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj569 };
        var obj482 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj568 };
        var obj481 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1620, memops: obj568 };
        var obj480 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj567 };
        var obj479 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj886, obj893, obj887, obj916, obj936, obj942, obj907, obj895, obj941, obj873, obj913, obj935, obj934, obj901, obj922, obj910, obj894, obj932, obj920, obj924, obj889, obj898];
        var obj478 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj893, obj887, obj916, obj936, obj942, obj907, obj895, obj941, obj873, obj913, obj935, obj934, obj901, obj922, obj910, obj894, obj932, obj920, obj924, obj889, obj898];
        var obj477 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj820, obj812, obj907, obj895, obj941, obj873, obj913, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj476 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj817, obj804, obj915, obj896, obj878, obj930, obj882, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj475 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj866, obj860, obj870, obj859, obj855, obj863, obj865, obj882, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj474 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj872, obj871, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj473 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj871, obj857, obj850, obj864, obj869, obj852, obj849, obj913, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj472 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj853, obj866, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj471 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj871, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj470 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj866, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj469 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj468 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj467 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj817, obj870, obj859, obj855, obj863, obj865, obj861, obj912, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj466 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj820, obj850, obj864, obj869, obj852, obj849, obj858, obj935, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj465 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj464 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj853, obj866, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj854, obj868, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj463 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj462 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj872, obj871, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj862, obj851, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj461 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj871, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj862, obj851, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj460 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj866, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj854, obj868, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj459 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj817, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj885, obj900, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj458 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj820, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj934, obj901, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj457 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj857, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj862, obj851, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj456 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj860, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj854, obj868, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj455 = [obj914, obj880, obj943, obj925, obj904, obj928, obj905, obj883, obj825, obj828, obj839, obj811, obj819, obj846, obj817, obj870, obj859, obj855, obj863, obj865, obj861, obj867, obj854, obj868, obj877, obj874, obj888, obj917, obj890, obj906, obj899, obj903];
        var obj454 = [obj911, obj939, obj940, obj902, obj875, obj931, obj892, obj918, obj837, obj847, obj832, obj829, obj827, obj807, obj820, obj850, obj864, obj869, obj852, obj849, obj858, obj856, obj862, obj851, obj921, obj910, obj894, obj932, obj920, obj924, obj889, obj929];
        var obj453 = [obj813, obj803, obj814, obj821, obj816, obj844, obj809, obj806, obj801, obj835, obj831, obj841, obj836, obj845, obj823, obj826, obj830, obj838, obj848, obj824, obj822, obj808, obj802, obj818, obj843, obj810, obj840, obj834, obj815, obj833, obj805, obj842];
        var obj452 = { CHIP_ERASE: obj702, PGM_ENABLE: obj701 };
        var obj451 = { CHIP_ERASE: obj700, PGM_ENABLE: obj699 };
        var obj450 = { CHIP_ERASE: obj698, PGM_ENABLE: obj699 };
        var obj449 = { READ: obj697, WRITE: obj640 };
        var obj448 = { READ: obj696, WRITE: obj635 };
        var obj447 = { READ: obj693, WRITE: obj643 };
        var obj446 = { READ: obj676, WRITE: obj639 };
        var obj445 = { READ: obj687, WRITE: obj620 };
        var obj444 = { READ: obj681, WRITE: obj619 };
        var obj443 = { READ: obj679, WRITE: obj615 };
        var obj442 = { READ: obj683, WRITE: obj616 };
        var obj441 = { READ: obj682, WRITE: obj617 };
        var obj440 = { READ: obj682, WRITE: obj618 };
        var obj439 = { READ: obj684, WRITE: obj611 };
        var obj438 = { READ: obj694, WRITE: obj591 };
        var obj437 = { READ: obj677, WRITE: obj612 };
        var obj436 = { READ: obj689, WRITE: obj606 };
        var obj435 = { READ: obj682, WRITE: obj610 };
        var obj434 = { READ: obj676, WRITE: obj606 };
        var obj433 = { READ: obj678, WRITE: obj605 };
        var obj432 = { READ: obj682, WRITE: obj605 };
        var obj431 = { READ: obj686, WRITE: obj604 };
        var obj430 = { READ: obj682, WRITE: obj602 };
        var obj429 = { READ: obj682, WRITE: obj600 };
        var obj428 = { READ: obj678, WRITE: obj600 };
        var obj427 = { READ: obj680, WRITE: obj600 };
        var obj426 = { READ: obj668, WRITE: obj607 };
        var obj425 = { READ: obj660, WRITE: obj608 };
        var obj424 = { READ: obj664, WRITE: obj603 };
        var obj423 = { READ: obj669, WRITE: obj601 };
        var obj422 = { READ: obj670, WRITE: obj599 };
        var obj421 = { READ: obj666, WRITE: obj596 };
        var obj420 = { READ: obj667, WRITE: obj596 };
        var obj419 = { READ: obj659, WRITE: obj596 };
        var obj418 = { READ: obj666, WRITE: obj598 };
        var obj417 = { READ: obj662, WRITE: obj598 };
        var obj416 = { READ: obj665, WRITE: obj597 };
        var obj415 = { READ: obj663, WRITE: obj595 };
        var obj414 = { READ: obj648, WRITE: obj587 };
        var obj413 = { READ: obj644, WRITE: obj582 };
        var obj412 = { READ: obj647, WRITE: obj584 };
        var obj411 = { READ: obj637, WRITE: obj578 };
        var obj410 = { READ: obj633, WRITE: obj577 };
        var obj409 = { READ: obj624, WRITE: obj571 };
        var obj408 = { paged: false, size: 1, readback: obj1620, memops: obj435 };
        var obj407 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj449 };
        var obj406 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj447 };
        var obj405 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj448 };
        var obj404 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj446 };
        var obj403 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj445 };
        var obj402 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj442 };
        var obj401 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1620, memops: obj440 };
        var obj400 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj441 };
        var obj399 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj442 };
        var obj398 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj443 };
        var obj397 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1620, memops: obj443 };
        var obj396 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj442 };
        var obj395 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj443 };
        var obj394 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj443 };
        var obj393 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj440 };
        var obj392 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1620, memops: obj442 };
        var obj391 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj444 };
        var obj390 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj438 };
        var obj389 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj439 };
        var obj388 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj437 };
        var obj387 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj435 };
        var obj386 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj436 };
        var obj385 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj432 };
        var obj384 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj432 };
        var obj383 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1620, memops: obj434 };
        var obj382 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj433 };
        var obj381 = {
            paged: false,
            size: 1,
            min_write_delay: 4500,
            max_write_delay: 4500,
            readback: obj1620,
            memops: obj434
        };
        var obj380 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj434 };
        var obj379 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj434 };
        var obj378 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj431 };
        var obj377 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj430 };
        var obj376 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj429 };
        var obj375 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj429 };
        var obj374 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj427 };
        var obj373 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj428 };
        var obj372 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj426 };
        var obj371 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj425 };
        var obj370 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1620, memops: obj424 };
        var obj369 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj422 };
        var obj368 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj420 };
        var obj367 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1620, memops: obj419 };
        var obj366 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1620, memops: obj418 };
        var obj365 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj419 };
        var obj364 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1620, memops: obj416 };
        var obj363 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj415 };
        var obj362 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj415 };
        var obj361 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj417 };
        var obj360 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1620, memops: obj421 };
        var obj359 = { paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1618, memops: obj411 };
        var obj358 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1618, memops: obj423 };
        var obj357 = { mode: 4, delay: 20, blocksize: 32, paged: false, size: 64, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1618, memops: obj414 };
        var obj356 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 64, min_write_delay: 8200, max_write_delay: 8200, readback: obj1622, memops: obj414 };
        var obj355 = { mode: 4, delay: 8, blocksize: 64, paged: false, size: 64, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1622, memops: obj414 };
        var obj354 = { mode: 4, delay: 20, blocksize: 128, paged: false, size: 512, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj412 };
        var obj353 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1618, memops: obj413 };
        var obj352 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj413 };
        var obj351 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 128, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1619, memops: obj413 };
        var obj350 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1618, memops: obj411 };
        var obj349 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1619, memops: obj410 };
        var obj348 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1622, memops: obj410 };
        var obj347 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 512, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1619, memops: obj410 };
        var obj346 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 512, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1618, memops: obj410 };
        var obj345 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 512, min_write_delay: 3400, max_write_delay: 3400, readback: obj1622, memops: obj410 };
        var obj344 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1619, memops: obj409 };
        var obj343 = { mode: 4, delay: 20, blocksize: 128, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj412 };
        var obj342 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj409 };
        var obj341 = { mode: 4, delay: 20, blocksize: 64, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj409 };
        var obj340 = { READ: obj661, WRITE: obj594, LOADPAGE_LO: obj479, WRITEPAGE: obj516 };
        var obj339 = { READ: obj655, WRITE: obj592, LOADPAGE_LO: obj479, WRITEPAGE: obj511 };
        var obj338 = { READ: obj653, WRITE: obj590, LOADPAGE_LO: obj479, WRITEPAGE: obj514 };
        var obj337 = { READ: obj654, WRITE: obj589, LOADPAGE_LO: obj479, WRITEPAGE: obj510 };
        var obj336 = { READ: obj652, WRITE: obj588, LOADPAGE_LO: obj479, WRITEPAGE: obj510 };
        var obj335 = { READ: obj652, WRITE: obj588, LOADPAGE_LO: obj479, WRITEPAGE: obj508 };
        var obj334 = { READ: obj649, WRITE: obj586, LOADPAGE_LO: obj479, WRITEPAGE: obj510 };
        var obj333 = { READ: obj650, WRITE: obj585, LOADPAGE_LO: obj478, WRITEPAGE: obj512 };
        var obj332 = { READ: obj649, WRITE: obj586, LOADPAGE_LO: obj479, WRITEPAGE: obj508 };
        var obj331 = { READ: obj644, WRITE: obj582, LOADPAGE_LO: obj479, WRITEPAGE: obj510 };
        var obj330 = { READ: obj649, WRITE: obj586, LOADPAGE_LO: obj479, WRITEPAGE: obj505 };
        var obj329 = { READ: obj645, WRITE: obj583, LOADPAGE_LO: obj479, WRITEPAGE: obj500 };
        var obj328 = { READ: obj637, WRITE: obj578, LOADPAGE_LO: obj479, WRITEPAGE: obj508 };
        var obj327 = { READ: obj645, WRITE: obj583, LOADPAGE_LO: obj478, WRITEPAGE: obj507 };
        var obj326 = { READ: obj642, WRITE: obj581, LOADPAGE_LO: obj479, WRITEPAGE: obj501 };
        var obj325 = { READ: obj636, WRITE: obj580, LOADPAGE_LO: obj479, WRITEPAGE: obj500 };
        var obj324 = { READ: obj638, WRITE: obj579, LOADPAGE_LO: obj478, WRITEPAGE: obj506 };
        var obj323 = { READ: obj633, WRITE: obj577, LOADPAGE_LO: obj479, WRITEPAGE: obj505 };
        var obj322 = { READ: obj632, WRITE: obj575, LOADPAGE_LO: obj479, WRITEPAGE: obj499 };
        var obj321 = { READ: obj634, WRITE: obj576, LOADPAGE_LO: obj478, WRITEPAGE: obj502 };
        var obj320 = { READ: obj630, WRITE: obj574, LOADPAGE_LO: obj479, WRITEPAGE: obj500 };
        var obj319 = { READ: obj628, WRITE: obj573, LOADPAGE_LO: obj478, WRITEPAGE: obj502 };
        var obj318 = { READ: obj626, WRITE: obj572, LOADPAGE_LO: obj478, WRITEPAGE: obj506 };
        var obj317 = { READ: obj624, WRITE: obj571, LOADPAGE_LO: obj478, WRITEPAGE: obj506 };
        var obj316 = { READ: obj624, WRITE: obj571, LOADPAGE_LO: obj478, WRITEPAGE: obj502 };
        var obj315 = { READ: obj623, WRITE: obj570, LOADPAGE_LO: obj478, WRITEPAGE: obj498 };
        var obj314 = { READ_LO: obj544, READ_HI: obj543, WRITE_LO: obj523, WRITE_HI: obj524 };
        var obj313 = { READ_LO: obj540, READ_HI: obj542, WRITE_LO: obj522, WRITE_HI: obj521 };
        var obj312 = { READ_LO: obj538, READ_HI: obj537, WRITE_LO: obj519, WRITE_HI: obj520 };
        var obj311 = { READ_LO: obj536, READ_HI: obj535, WRITE_LO: obj517, WRITE_HI: obj518 };
        var obj310 = { mode: 65, delay: 5, blocksize: 4, paged: false, size: 64, page_size: 4, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1622, memops: obj339 };
        var obj309 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj338 };
        var obj308 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 64, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1622, memops: obj337 };
        var obj307 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 128, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj337 };
        var obj306 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj336 };
        var obj305 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1622, memops: obj335 };
        var obj304 = { paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1622, memops: obj312 };
        var obj303 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj335 };
        var obj302 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj334 };
        var obj301 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj333 };
        var obj300 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj333 };
        var obj299 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj332 };
        var obj298 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1622, memops: obj330 };
        var obj297 = { mode: 65, delay: 5, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1622, memops: obj330 };
        var obj296 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj330 };
        var obj295 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1622, memops: obj329 };
        var obj294 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 1024, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj327 };
        var obj293 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj325 };
        var obj292 = { mode: 4, delay: 10, blocksize: 128, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj325 };
        var obj291 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj325 };
        var obj290 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj324 };
        var obj289 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj323 };
        var obj288 = { mode: 65, delay: 5, blocksize: 4, paged: true, size: 64, page_size: 4, num_pages: 16, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1622, memops: obj340 };
        var obj287 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj322 };
        var obj286 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj320 };
        var obj285 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj321 };
        var obj284 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj319 };
        var obj283 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj319 };
        var obj282 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj318 };
        var obj281 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 13e3, max_write_delay: 13e3, readback: obj1620, memops: obj318 };
        var obj280 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1622, memops: obj318 };
        var obj279 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj318 };
        var obj278 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj317 };
        var obj277 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj316 };
        var obj276 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 8192, page_size: 8, min_write_delay: 13e3, max_write_delay: 13e3, readback: obj1620, memops: obj315 };
        var obj275 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 128, page_size: 4, num_pages: 32, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1622, memops: obj331 };
        var obj274 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 256, page_size: 4, num_pages: 64, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1622, memops: obj328 };
        var obj273 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, num_pages: 256, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj326 };
        var obj272 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1620, memops: obj326 };
        var obj271 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1622, memops: obj323 };
        var obj270 = { mode: 2, delay: 15, blocksize: 128, paged: false, size: 1024, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1622, memops: obj314 };
        var obj269 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 1024, min_write_delay: 4500, max_write_delay: 2e4, readback: obj1622, memops: obj314 };
        var obj268 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 1024, min_write_delay: 4100, max_write_delay: 4100, readback: obj1622, memops: obj314 };
        var obj267 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 2048, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1621, memops: obj313 };
        var obj266 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 2048, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1622, memops: obj313 };
        var obj265 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1622, memops: obj312 };
        var obj264 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1621, memops: obj311 };
        var obj263 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 8192, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1621, memops: obj311 };
        var obj262 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 8192, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1622, memops: obj311 };
        var obj261 = { READ_LO: obj556, READ_HI: obj557, LOADPAGE_LO: obj474, LOADPAGE_HI: obj472, WRITEPAGE: obj515 };
        var obj260 = { READ_LO: obj553, READ_HI: obj552, LOADPAGE_LO: obj474, LOADPAGE_HI: obj472, WRITEPAGE: obj513 };
        var obj259 = { READ_LO: obj549, READ_HI: obj551, LOADPAGE_LO: obj471, LOADPAGE_HI: obj470, WRITEPAGE: obj509 };
        var obj258 = { READ_LO: obj546, READ_HI: obj547, LOADPAGE_LO: obj473, LOADPAGE_HI: obj475, WRITEPAGE: obj504 };
        var obj257 = { READ_LO: obj546, READ_HI: obj547, LOADPAGE_LO: obj471, LOADPAGE_HI: obj470, WRITEPAGE: obj504 };
        var obj256 = { READ_LO: obj539, READ_HI: obj541, LOADPAGE_LO: obj468, LOADPAGE_HI: obj469, WRITEPAGE: obj503 };
        var obj255 = { READ_LO: obj540, READ_HI: obj542, LOADPAGE_LO: obj462, LOADPAGE_HI: obj464, WRITEPAGE: obj494 };
        var obj254 = { READ_LO: obj534, READ_HI: obj533, LOADPAGE_LO: obj468, LOADPAGE_HI: obj469, WRITEPAGE: obj495 };
        var obj253 = { READ_LO: obj538, READ_HI: obj537, LOADPAGE_LO: obj461, LOADPAGE_HI: obj460, WRITEPAGE: obj497 };
        var obj252 = { READ_LO: obj534, READ_HI: obj533, LOADPAGE_LO: obj465, LOADPAGE_HI: obj463, WRITEPAGE: obj495 };
        var obj251 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj477, LOADPAGE_HI: obj476, WRITEPAGE: obj488 };
        var obj250 = { READ_LO: obj536, READ_HI: obj535, LOADPAGE_LO: obj461, LOADPAGE_HI: obj460, WRITEPAGE: obj491 };
        var obj249 = { READ_LO: obj529, READ_HI: obj530, LOADPAGE_LO: obj477, LOADPAGE_HI: obj476, WRITEPAGE: obj485 };
        var obj248 = { READ_LO: obj529, READ_HI: obj530, LOADPAGE_LO: obj465, LOADPAGE_HI: obj463, WRITEPAGE: obj490 };
        var obj247 = { READ_LO: obj531, READ_HI: obj532, LOADPAGE_LO: obj457, LOADPAGE_HI: obj456, WRITEPAGE: obj493 };
        var obj246 = { READ_LO: obj528, READ_HI: obj527, LOADPAGE_LO: obj457, LOADPAGE_HI: obj456, WRITEPAGE: obj493 };
        var obj245 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj466, LOADPAGE_HI: obj467, WRITEPAGE: obj487 };
        var obj244 = { READ_LO: obj529, READ_HI: obj530, LOADPAGE_LO: obj454, LOADPAGE_HI: obj455, WRITEPAGE: obj492 };
        var obj243 = { READ_LO: obj529, READ_HI: obj530, LOADPAGE_LO: obj457, LOADPAGE_HI: obj456, WRITEPAGE: obj486 };
        var obj242 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj458, LOADPAGE_HI: obj459, WRITEPAGE: obj487 };
        var obj241 = { READ_LO: obj528, READ_HI: obj527, LOADPAGE_LO: obj454, LOADPAGE_HI: obj455, WRITEPAGE: obj489 };
        var obj240 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj454, LOADPAGE_HI: obj455, WRITEPAGE: obj496 };
        var obj239 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj457, LOADPAGE_HI: obj456, WRITEPAGE: obj486 };
        var obj238 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj454, LOADPAGE_HI: obj455, WRITEPAGE: obj487 };
        var obj237 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 1024, page_size: 32, num_pages: 32, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj261 };
        var obj236 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj260 };
        var obj235 = { mode: 65, delay: 10, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj259 };
        var obj234 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj259 };
        var obj233 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj259 };
        var obj232 = { mode: 33, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj258 };
        var obj231 = { mode: 33, delay: 10, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1617, memops: obj258 };
        var obj230 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj257 };
        var obj229 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj257 };
        var obj228 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 32, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj256 };
        var obj227 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj256 };
        var obj226 = { mode: 33, delay: 6, blocksize: 16, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj255 };
        var obj225 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj255 };
        var obj224 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj254 };
        var obj223 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj252 };
        var obj222 = { mode: 33, delay: 6, blocksize: 64, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj252 };
        var obj221 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj253 };
        var obj220 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj252 };
        var obj219 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj251 };
        var obj218 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 524288, page_size: 256, num_pages: 2048, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj251 };
        var obj217 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj250 };
        var obj216 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj249 };
        var obj215 = { mode: 33, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj248 };
        var obj214 = { mode: 17, delay: 20, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1622, memops: obj247 };
        var obj213 = { mode: 33, delay: 16, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 14e3, max_write_delay: 14e3, readback: obj1622, memops: obj247 };
        var obj212 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj247 };
        var obj211 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj245 };
        var obj210 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj246 };
        var obj209 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj245 };
        var obj208 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 256, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj245 };
        var obj207 = { mode: 65, delay: 20, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 5e4, max_write_delay: 5e4, readback: obj1620, memops: obj244 };
        var obj206 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj244 };
        var obj205 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj244 };
        var obj204 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj243 };
        var obj203 = { mode: 33, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj242 };
        var obj202 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj242 };
        var obj201 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj241 };
        var obj200 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj240 };
        var obj199 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj239 };
        var obj198 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 8192, page_size: 128, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj239 };
        var obj197 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj239 };
        var obj196 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj239 };
        var obj195 = { mode: 65, delay: 20, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 5e4, max_write_delay: 5e4, readback: obj1620, memops: obj238 };
        var obj194 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj238 };
        var obj193 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 524288, page_size: 256, num_pages: 2048, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj238 };
        var obj192 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 262144, page_size: 256, num_pages: 1024, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj238 };
        var obj191 = { mode: 17, delay: 70, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 22e3, max_write_delay: 56e3, readback: obj1622, memops: obj238 };
        var obj190 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj238 };
        var obj189 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj238 };
        var obj188 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1622, memops: obj238 };
        var obj187 = { READ_LO: obj525, READ_HI: obj526, LOADPAGE_LO: obj454, LOADPAGE_HI: obj455, LOAD_EXT_ADDR: obj453, WRITEPAGE: obj487 };
        var obj186 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 262144, page_size: 256, num_pages: 1024, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj187 };
        var obj185 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 524288, page_size: 256, num_pages: 2048, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj187 };
        var obj184 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj187 };
        var obj183 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 2097152, page_size: 256, num_pages: 8192, min_write_delay: 4500, max_write_delay: 4500, readback: obj1620, memops: obj187 };
        var obj182 = { eeprom: obj357, flash: obj270, signature: obj545, fuse: obj1478, lock: obj481 };
        var obj181 = { eeprom: obj351, flash: obj267, signature: obj545, fuse: obj1478, lock: obj480 };
        var obj180 = { eeprom: obj349, flash: obj264, signature: obj545, fuse: obj1478, lock: obj482 };
        var obj179 = { eeprom: obj347, flash: obj263, signature: obj545, fuse: obj1478, lock: obj482 };
        var obj178 = { AVRPart: "AT90S2313", chipEraseDelay: 2e4, stk500_devcode: 64, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1603, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj181 };
        var obj177 = { AVRPart: "AT90S1200", chipEraseDelay: 2e4, stk500_devcode: 51, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1575, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: true, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 1, pollValue: 255, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj182 };
        var obj176 = { AVRPart: "AT90S4414", chipEraseDelay: 2e4, stk500_devcode: 80, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1563, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj180 };
        var obj175 = { AVRPart: "AT90S8515", chipEraseDelay: 2e4, stk500_devcode: 96, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1559, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj179 };
        var obj174 = { eeprom: obj359, flash: obj304, signature: obj545, fuse: obj364, lock: obj367 };
        var obj173 = { eeprom: obj358, flash: obj266, signature: obj545, fuse: obj366, lock: obj360 };
        var obj172 = { eeprom: obj353, flash: obj266, signature: obj545, fuse: obj364, lock: obj367 };
        var obj171 = { eeprom: obj350, flash: obj265, signature: obj545, fuse: obj364, lock: obj367 };
        var obj170 = { eeprom: obj346, flash: obj262, signature: obj545, fuse: obj361, lock: obj368 };
        var obj169 = { eeprom: obj356, flash: obj268, signature: obj554, lock: obj365, calibration: obj560, fuse: obj371 };
        var obj168 = { eeprom: obj355, flash: obj269, signature: obj554, lock: obj365, calibration: obj560, fuse: obj372 };
        var obj167 = { eeprom: obj345, flash: obj213, fuse: obj370, lock: obj380, signature: obj545 };
        var obj166 = { eeprom: obj344, flash: obj191, fuse: obj369, lock: obj365, signature: obj545 };
        var obj165 = { AVRPart: "AT90S4434", chipEraseDelay: 2e4, stk500_devcode: 82, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1607, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj174 };
        var obj164 = {
            AVRPart: "AT90S2343",
            chipEraseDelay: 18e3,
            stk500_devcode: 67,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1550,
            usbpid: 0,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: false,
            hasWriteOperation: false,
            hasJtag: false,
            hasPdi: false,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            timeout: 200,
            stabDelay: 100,
            cmdExeDelay: 25,
            syncLoops: 32,
            pollIndex: 3,
            pollValue: 83,
            predelay: 1,
            postdelay: 1,
            hventerstabdelay: 100,
            progmodedelay: 0,
            latchcycles: 1,
            togglevtg: 0,
            poweroffdelay: 25,
            resetdelayms: 0,
            resetdelayus: 50,
            hvleavestabdelay: 100,
            resetdelay: 25,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 40,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 25,
            programlockpulsewidth: 0,
            programlockpolltimeout: 25,
            synchcycles: 6,
            hvspcmdexedelay: 0,
            idr: 0,
            rampz: 0,
            spmcr: 0,
            eecr: 0,
            ocdrev: -1,
            ops: obj450,
            memory: obj173
        };
        var obj163 = { AVRPart: "AT90S2333", chipEraseDelay: 2e4, stk500_devcode: 66, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1547, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj172 };
        var obj162 = { AVRPart: "AT90S4433", chipEraseDelay: 2e4, stk500_devcode: 81, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1597, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj171 };
        var obj161 = { AVRPart: "AT90S8535", chipEraseDelay: 2e4, stk500_devcode: 97, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1610, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj170 };
        var obj160 = { AVRPart: "ATtiny15", chipEraseDelay: 8200, stk500_devcode: 19, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1541, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 16, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 5, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj169 };
        var obj159 = { AVRPart: "ATtiny12", chipEraseDelay: 2e4, stk500_devcode: 18, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1568, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj168 };
        var obj158 = { AVRPart: "ATmega161", chipEraseDelay: 28e3, stk500_devcode: 128, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1591, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 30, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 2, programlockpulsewidth: 0, programlockpolltimeout: 2, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj167 };
        var obj157 = { AVRPart: "ATmega103", chipEraseDelay: 112e3, stk500_devcode: 177, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1583, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 10, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj166 };
        var obj156 = { eeprom: obj354, flash: obj232, lfuse: obj399, hfuse: obj398, lock: obj381, calibration: obj558, signature: obj545 };
        var obj155 = { eeprom: obj354, flash: obj232, lfuse: obj396, hfuse: obj394, lock: obj380, calibration: obj558, signature: obj545 };
        var obj154 = { eeprom: obj343, flash: obj231, lfuse: obj396, hfuse: obj394, lock: obj380, calibration: obj558, signature: obj545 };
        var obj153 = { eeprom: obj352, flash: obj226, signature: obj554, lock: obj363, lfuse: obj402, hfuse: obj389, calibration: obj555 };
        var obj152 = { eeprom: obj348, flash: obj214, lfuse: obj391, hfuse: obj403, lock: obj386, signature: obj545, calibration: obj560 };
        var obj151 = { eeprom: obj341, flash: obj201, lfuse: obj402, hfuse: obj395, efuse: obj377, lock: obj379, calibration: obj555, signature: obj545 };
        var obj150 = { eeprom: obj342, flash: obj190, lfuse: obj402, hfuse: obj395, efuse: obj377, lock: obj379, calibration: obj555, signature: obj545 };
        var obj149 = { eeprom: obj310, flash: obj237, signature: obj550, lock: obj381, calibration: obj561, lfuse: obj399, hfuse: obj398 };
        var obj148 = { eeprom: obj292, flash: obj223, lock: obj379, lfuse: obj402, hfuse: obj395, signature: obj545, calibration: obj559 };
        var obj147 = { eeprom: obj291, flash: obj222, lfuse: obj396, hfuse: obj394, lock: obj380, signature: obj545, calibration: obj558 };
        var obj146 = { AVRPart: "ATmega8515", chipEraseDelay: 9e3, stk500_devcode: 99, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1546, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj156 };
        var obj145 = { AVRPart: "ATmega8535", chipEraseDelay: 9e3, stk500_devcode: 100, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1599, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj155 };
        var obj144 = { AVRPart: "ATmega163", chipEraseDelay: 32e3, stk500_devcode: 129, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1542, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 30, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 2, programlockpulsewidth: 0, programlockpolltimeout: 2, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj451, memory: obj152 };
        var obj143 = { AVRPart: "ATmega8", chipEraseDelay: 1e4, stk500_devcode: 112, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1556, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj154 };
        var obj142 = { AVRPart: "ATtiny26", chipEraseDelay: 9e3, stk500_devcode: 33, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1602, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj153 };
        var obj141 = { eeprom: obj307, flash: obj236, signature: obj550, lock: obj483, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj561 };
        var obj140 = { eeprom: obj303, flash: obj233, signature: obj550, lock: obj483, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj561 };
        var obj139 = { eeprom: obj296, flash: obj230, signature: obj550, lock: obj483, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj561 };
        var obj138 = { eeprom: obj288, flash: obj235, signature: obj550, lock: obj484, lfuse: obj399, hfuse: obj398, efuse: obj375, calibration: obj561 };
        var obj137 = { eeprom: obj309, flash: obj216, lock: obj404, lfuse: obj406, hfuse: obj405, efuse: obj407, signature: obj565, calibration: obj566 };
        var obj136 = { eeprom: obj300, flash: obj219, lock: obj404, lfuse: obj406, hfuse: obj405, efuse: obj407, signature: obj565, calibration: obj566 };
        var obj135 = { eeprom: obj301, flash: obj218, lock: obj404, lfuse: obj406, hfuse: obj405, efuse: obj407, signature: obj565, calibration: obj566 };
        var obj134 = { eeprom: obj289, flash: obj212, lfuse: obj396, hfuse: obj394, efuse: obj408, lock: obj380, signature: obj550, calibration: obj564 };
        var obj133 = { eeprom: obj307, flash: obj236, signature: obj550, lock: obj390, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj562 };
        var obj132 = { eeprom: obj307, flash: obj236, signature: obj550, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj561 };
        var obj131 = { eeprom: obj306, flash: obj233, signature: obj550, lock: obj390, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj562 };
        var obj130 = { eeprom: obj305, flash: obj234, lfuse: obj399, hfuse: obj398, efuse: obj374, lock: obj381, calibration: obj564, signature: obj550 };
        var obj129 = { eeprom: obj303, flash: obj233, signature: obj550, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj561 };
        var obj128 = { eeprom: obj299, flash: obj229, signature: obj548, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj400, calibration: obj564 };
        var obj127 = { eeprom: obj308, flash: obj229, lfuse: obj399, hfuse: obj398, efuse: obj373, lock: obj381, calibration: obj564, signature: obj550 };
        var obj126 = { eeprom: obj302, flash: obj230, signature: obj550, lock: obj390, lfuse: obj402, hfuse: obj395, efuse: obj376, calibration: obj562 };
        var obj125 = { eeprom: obj298, flash: obj229, lfuse: obj399, hfuse: obj398, efuse: obj382, lock: obj381, calibration: obj564, signature: obj550 };
        var obj124 = { eeprom: obj297, flash: obj228, lfuse: obj399, hfuse: obj398, efuse: obj388, lock: obj378, calibration: obj564, signature: obj550 };
        var obj123 = { eeprom: obj298, flash: obj227, lfuse: obj399, hfuse: obj398, efuse: obj382, lock: obj381, calibration: obj564, signature: obj550 };
        var obj122 = { eeprom: obj299, signature: obj548, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj400, calibration: obj564, flash: obj223 };
        var obj121 = { eeprom: obj295, flash: obj224, lfuse: obj399, hfuse: obj398, efuse: obj382, lock: obj381, calibration: obj564, signature: obj550 };
        var obj120 = { flash: obj220, eeprom: obj293, lfuse: obj392, hfuse: obj397, efuse: obj401, lock: obj383, signature: obj548, calibration: obj563 };
        var obj119 = { eeprom: obj287, flash: obj215, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj393, signature: obj545, calibration: obj564 };
        var obj118 = { eeprom: obj294, flash: obj208, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj564, signature: obj545 };
        var obj117 = { eeprom: obj290, flash: obj209, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj564, signature: obj545 };
        var obj116 = { eeprom: obj286, flash: obj210, lfuse: obj399, hfuse: obj398, efuse: obj384, lock: obj381, signature: obj550, calibration: obj564 };
        var obj115 = { eeprom: obj283, flash: obj203, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj393, signature: obj545, calibration: obj564 };
        var obj114 = { eeprom: obj284, flash: obj202, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj393, signature: obj545, calibration: obj564 };
        var obj113 = { eeprom: obj285, flash: obj211, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj564, signature: obj545 };
        var obj112 = { eeprom: obj280, flash: obj200, lfuse: obj399, hfuse: obj398, efuse: obj384, lock: obj381, signature: obj550, calibration: obj564 };
        var obj111 = { eeprom: obj279, flash: obj206, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj560, signature: obj545 };
        var obj110 = { eeprom: obj282, flash: obj204, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj560, signature: obj545 };
        var obj109 = { lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545, flash: obj207, eeprom: obj281 };
        var obj108 = { eeprom: obj275, flash: obj225, signature: obj554, lock: obj362, lfuse: obj399, hfuse: obj398, efuse: obj374, calibration: obj560 };
        var obj107 = { eeprom: obj277, flash: obj205, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj106 = { eeprom: obj278, flash: obj194, lfuse: obj402, hfuse: obj395, efuse: obj387, lock: obj379, calibration: obj560, signature: obj545 };
        var obj105 = { eeprom: obj277, flash: obj193, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj385, calibration: obj560, signature: obj545 };
        var obj104 = { eeprom: obj277, flash: obj188, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj385, calibration: obj560, signature: obj545 };
        var obj103 = { eeprom: obj277, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545, flash: obj195 };
        var obj102 = { eeprom: obj277, flash: obj192, lock: obj379, lfuse: obj402, hfuse: obj395, efuse: obj385, calibration: obj560, signature: obj545 };
        var obj101 = { eeprom: obj277, flash: obj189, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj100 = { eeprom: obj272, flash: obj198, lfuse: obj402, hfuse: obj395, efuse: obj400, lock: obj379, calibration: obj564, signature: obj550 };
        var obj99 = { eeprom: obj272, flash: obj199, lfuse: obj402, hfuse: obj395, efuse: obj400, lock: obj379, calibration: obj564, signature: obj550 };
        var obj98 = { eeprom: obj273, flash: obj196, lfuse: obj402, hfuse: obj395, efuse: obj400, lock: obj379, calibration: obj564, signature: obj550 };
        var obj97 = { eeprom: obj274, flash: obj221, signature: obj554, lock: obj362, lfuse: obj399, hfuse: obj398, efuse: obj374, calibration: obj560 };
        var obj96 = { eeprom: obj272, flash: obj197, lfuse: obj402, hfuse: obj395, efuse: obj400, lock: obj379, calibration: obj564, signature: obj550 };
        var obj95 = { eeprom: obj271, flash: obj217, signature: obj554, lock: obj362, lfuse: obj399, hfuse: obj398, efuse: obj374, calibration: obj560 };
        var obj94 = { AVRPart: "ATmega64", chipEraseDelay: 9e3, stk500_devcode: 160, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1565, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 34, rampz: 0, spmcr: 104, eecr: 0, ocdrev: 2, ops: obj451, memory: obj151 };
        var obj93 = { AVRPart: "ATmega128", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1609, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 34, rampz: 59, spmcr: 104, eecr: 0, ocdrev: 1, ops: obj451, memory: obj150 };
        var obj92 = { AVRPart: "ATtiny13", chipEraseDelay: 4e3, stk500_devcode: 20, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1538, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 90, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj450, memory: obj149 };
        var obj91 = { AVRPart: "ATmega32", chipEraseDelay: 9e3, stk500_devcode: 145, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1555, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj451, memory: obj147 };
        var obj90 = { AVRPart: "ATmega16", chipEraseDelay: 9e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1590, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 100, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj450, memory: obj148 };
        var obj89 = { AVRPart: "ATmega164P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1608, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj148 };
        var obj88 = { eeprom: obj277, flash: obj184, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj87 = { eeprom: obj277, flash: obj186, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj86 = { eeprom: obj277, flash: obj185, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj85 = { eeprom: obj277, flash: obj183, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545 };
        var obj84 = { flash: obj186, lfuse: obj402, hfuse: obj395, efuse: obj385, lock: obj379, calibration: obj560, signature: obj545, eeprom: obj276 };
        var obj83 = { AVRPart: "ATtiny25", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1592, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj141 };
        var obj82 = { AVRPart: "ATtiny45", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1573, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj140 };
        var obj81 = { AVRPart: "ATtiny43u", chipEraseDelay: 1e3, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1588, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 20, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj138 };
        var obj80 = { AVRPart: "ATtiny85", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1570, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj139 };
        var obj79 = { AVRPart: "ATmega325", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1580, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj452, memory: obj137 };
        var obj78 = { AVRPart: "ATmega3250", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1554, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj452, memory: obj137 };
        var obj77 = { AVRPart: "ATmega645", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1589, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj452, memory: obj136 };
        var obj76 = {
            AVRPart: "ATmega6450",
            chipEraseDelay: 9e3,
            stk500_devcode: 0,
            pagel: 215,
            bs2: 160,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1564,
            usbpid: 0,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: false,
            hasWriteOperation: false,
            hasJtag: true,
            hasPdi: false,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            timeout: 200,
            stabDelay: 100,
            cmdExeDelay: 25,
            syncLoops: 32,
            pollIndex: 3,
            pollValue: 83,
            predelay: 1,
            pollmethod: 1,
            postdelay: 1,
            hventerstabdelay: 100,
            progmodedelay: 0,
            latchcycles: 5,
            togglevtg: 1,
            poweroffdelay: 15,
            resetdelayms: 1,
            resetdelayus: 0,
            hvleavestabdelay: 15,
            resetdelay: 0,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 10,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 5,
            programlockpulsewidth: 0,
            programlockpolltimeout: 5,
            synchcycles: 0,
            hvspcmdexedelay: 0,
            idr: 49,
            rampz: 0,
            spmcr: 87,
            eecr: 0,
            ocdrev: 3,
            ops: obj452,
            memory: obj136
        };
        var obj75 = { AVRPart: "32MX340F512H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj452, memory: obj135 };
        var obj74 = { AVRPart: "ATmega169", chipEraseDelay: 9e3, stk500_devcode: 133, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1616, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj451, memory: obj134 };
        var obj73 = { AVRPart: "ATtiny24", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1604, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj133 };
        var obj72 = { AVRPart: "ATtiny44", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1613, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj131 };
        var obj71 = { AVRPart: "ATtiny84", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1548, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj126 };
        var obj70 = { AVRPart: "ATtiny2313", chipEraseDelay: 9e3, stk500_devcode: 35, pagel: 212, bs2: 214, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1558, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj450, memory: obj132 };
        var obj69 = { AVRPart: "ATmega48", chipEraseDelay: 45e3, stk500_devcode: 89, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1581, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj130 };
        var obj68 = { AVRPart: "ATmega48P", chipEraseDelay: 45e3, stk500_devcode: 89, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1585, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj130 };
        var obj67 = { AVRPart: "ATtiny88", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1530, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj127 };
        var obj66 = { AVRPart: "AT90PWM2", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1513, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj128 };
        var obj65 = { AVRPart: "ATtiny4313", chipEraseDelay: 9e3, stk500_devcode: 35, pagel: 212, bs2: 214, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1615, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj450, memory: obj129 };
        var obj64 = { AVRPart: "AT90PWM2B", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1483, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj128 };
        var obj63 = { AVRPart: "AT90PWM3", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1513, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj128 };
        var obj62 = { AVRPart: "ATmega162", chipEraseDelay: 9e3, stk500_devcode: 131, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1539, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 4, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj450, memory: obj120 };
        var obj61 = { AVRPart: "AT90PWM3B", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1483, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj128 };
        var obj60 = { AVRPart: "ATmega88", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1572, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj125 };
        var obj59 = { AVRPart: "ATmega88P", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1598, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj125 };
        var obj58 = { AVRPart: "ATmega329", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1586, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj116 };
        var obj57 = { AVRPart: "ATmega329P", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1614, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj116 };
        var obj56 = { AVRPart: "ATmega3290", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1576, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj116 };
        var obj55 = { AVRPart: "ATmega3290P", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1601, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj116 };
        var obj54 = { AVRPart: "ATmega168", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1569, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj123 };
        var obj53 = { AVRPart: "ATmega649", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1557, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj112 };
        var obj52 = { AVRPart: "ATmega6490", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1566, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj112 };
        var obj51 = { AVRPart: "ATmega168P", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1561, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj123 };
        var obj50 = { AVRPart: "ATtiny1634", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 179, bs2: 177, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1506, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj450, memory: obj124 };
        var obj49 = { AVRPart: "ATmega324P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1571, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj119 };
        var obj48 = { AVRPart: "AT90PWM316", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1500, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj122 };
        var obj47 = { AVRPart: "ATmega324PA", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1526, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj119 };
        var obj46 = { AVRPart: "ATmega328", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1487, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj121 };
        var obj45 = { AVRPart: "ATmega328P", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1612, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj121 };
        var obj44 = { AVRPart: "ATmega644", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1611, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj115 };
        var obj43 = { AVRPart: "ATmega644P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1587, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj115 };
        var obj42 = {
            AVRPart: "ATtiny261",
            chipEraseDelay: 4e3,
            stk500_devcode: 0,
            pagel: 179,
            bs2: 178,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1544,
            usbpid: 0,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: true,
            hasWriteOperation: false,
            hasJtag: false,
            hasPdi: false,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            timeout: 200,
            stabDelay: 100,
            cmdExeDelay: 25,
            syncLoops: 32,
            pollIndex: 3,
            pollValue: 83,
            predelay: 1,
            postdelay: 1,
            hventerstabdelay: 100,
            progmodedelay: 0,
            latchcycles: 5,
            togglevtg: 1,
            poweroffdelay: 15,
            resetdelayms: 2,
            resetdelayus: 0,
            hvleavestabdelay: 15,
            resetdelay: 0,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 10,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 5,
            programlockpulsewidth: 0,
            programlockpolltimeout: 5,
            synchcycles: 0,
            hvspcmdexedelay: 0,
            idr: 0,
            rampz: 0,
            spmcr: 0,
            eecr: 0,
            ocdrev: 1,
            ops: obj450,
            memory: obj108
        };
        var obj41 = { AVRPart: "AT90CAN32", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1517, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj450, memory: obj118 };
        var obj40 = { AVRPart: "ATtiny461", chipEraseDelay: 4e3, stk500_devcode: 0, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1551, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj97 };
        var obj39 = { AVRPart: "AT90CAN64", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1502, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj450, memory: obj117 };
        var obj38 = { AVRPart: "ATmega1284", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1574, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj114 };
        var obj37 = { AVRPart: "ATmega1284P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1594, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj450, memory: obj114 };
        var obj36 = { AVRPart: "AT90CAN128", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1488, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj450, memory: obj113 };
        var obj35 = { AVRPart: "ATtiny861", chipEraseDelay: 4e3, stk500_devcode: 0, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1593, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj95 };
        var obj34 = { AVRPart: "ATmega640", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1606, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj107 };
        var obj33 = { AVRPart: "AT90USB647", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1501, usbpid: 12281, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj111 };
        var obj32 = { AVRPart: "AT90USB646", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1501, usbpid: 12281, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj111 };
        var obj31 = { AVRPart: "ATmega64RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1543, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj109 };
        var obj30 = { AVRPart: "ATmega644RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1537, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj109 };
        var obj29 = { AVRPart: "ATmega32U4", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1492, usbpid: 12276, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj110 };
        var obj28 = { AVRPart: "ATmega1280", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1562, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj101 };
        var obj27 = { AVRPart: "ATmega1281", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1552, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj101 };
        var obj26 = { AVRPart: "AT90USB1286", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1515, usbpid: 12283, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj106 };
        var obj25 = { AVRPart: "AT90USB1287", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1515, usbpid: 12283, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj106 };
        var obj24 = { AVRPart: "ATmega128RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1578, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj103 };
        var obj23 = { AVRPart: "ATmega128RFA1", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1600, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj103 };
        var obj22 = { AVRPart: "32MX150F128D", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj104 };
        var obj21 = { AVRPart: "32MX440F256H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj102 };
        var obj20 = { AVRPart: "32MX250F128D", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj104 };
        var obj19 = { AVRPart: "32MX440F128H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj104 };
        var obj18 = { AVRPart: "32MX440F512H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj105 };
        var obj17 = { AVRPart: "32MX250F128B", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj104 };
        var obj16 = { AVRPart: "ATmega1284RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1582, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj451, memory: obj103 };
        var obj15 = { AVRPart: "AT90USB82", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1504, usbpid: 12279, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj100 };
        var obj14 = { AVRPart: "ATmega8U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1516, usbpid: 12270, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj96 };
        var obj13 = { AVRPart: "ATmega32U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1525, usbpid: 12272, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj98 };
        var obj12 = { AVRPart: "AT90USB162", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1481, usbpid: 12282, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj99 };
        var obj11 = { AVRPart: "ATmega16U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1532, usbpid: 12271, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj450, memory: obj99 };
        var obj10 = { AVRPart: "ATmega2561", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1560, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj451, memory: obj87 };
        var obj9 = { AVRPart: "ATmega2560", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1549, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj451, memory: obj87 };
        var obj8 = {
            AVRPart: "32MX695F512H",
            chipEraseDelay: 9e3,
            stk500_devcode: 0,
            pagel: 215,
            bs2: 160,
            resetDisposition: "dedicated",
            retryPulse: "SCK",
            signature: obj1495,
            usbpid: 0,
            serialProgramMode: true,
            parallelProgramMode: true,
            pseudoparallelProgramMode: false,
            hasTpi: false,
            isAvr32: false,
            hasDebugWire: false,
            hasWriteOperation: false,
            hasJtag: false,
            hasPdi: false,
            hasEnablePageProgramming: true,
            allowFullPageBitstream: false,
            allowInitSmc: false,
            isAT90S1200: false,
            timeout: 200,
            stabDelay: 100,
            cmdExeDelay: 25,
            syncLoops: 32,
            pollIndex: 3,
            pollValue: 83,
            predelay: 1,
            pollmethod: 1,
            postdelay: 1,
            hventerstabdelay: 100,
            progmodedelay: 0,
            latchcycles: 5,
            togglevtg: 1,
            poweroffdelay: 15,
            resetdelayms: 1,
            resetdelayus: 0,
            hvleavestabdelay: 15,
            resetdelay: 0,
            chiperasepulsewidth: 0,
            chiperasepolltimeout: 10,
            chiperasetime: 0,
            programfusepulsewidth: 0,
            programfusepolltimeout: 5,
            programlockpulsewidth: 0,
            programlockpolltimeout: 5,
            synchcycles: 0,
            hvspcmdexedelay: 0,
            idr: 49,
            rampz: 59,
            spmcr: 87,
            eecr: 0,
            ocdrev: -1,
            ops: obj451,
            memory: obj86
        };
        var obj7 = { AVRPart: "32MX695F512L", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj86 };
        var obj6 = { AVRPart: "32MX440F512H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj86 };
        var obj5 = { AVRPart: "32MX320F128H", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj88 };
        var obj4 = { AVRPart: "ATmega256RFR2", chipEraseDelay: 18500, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1545, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj451, memory: obj84 };
        var obj3 = { AVRPart: "32MZ2048ECH100", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj85 };
        var obj2 = { AVRPart: "32MZ2048ECG100", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: -1, ops: obj451, memory: obj85 };
        var obj1 = { AVRPart: "ATmega2564RFR2", chipEraseDelay: 18500, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1579, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj451, memory: obj84 };
        var obj0 = { "  pic32-150-128-D": obj22, "  pic32-250-128-B": obj17, "  pic32-250-128": obj20, "  pic32-360": obj5, "  pic32-340": obj75, "  pic32-440-128": obj19, "  pic32-440-256": obj21, "  pic32-440": obj18, "  pic32   ": obj6, "  pic32-695-512-H": obj8, "  pic32-695-512-L": obj7, "  pic32-MZ-2048-ECG": obj2, "  pic32-MZ-2048-ECH": obj3, "  uc3a0512": obj781, "  c128    ": obj36, "  c32     ": obj41, "  c64     ": obj39, "  pwm2    ": obj66, "  pwm2b   ": obj64, "  pwm3    ": obj63, "  pwm316  ": obj48, "  pwm3b   ": obj61, "  1200    ": obj177, "  2313    ": obj178, "  2333    ": obj163, "  2343    ": obj164, "  4414    ": obj176, "  4433    ": obj162, "  4434    ": obj165, "  8515    ": obj175, "  8535    ": obj161, "  usb1286 ": obj26, "  usb1287 ": obj25, "  usb162  ": obj12, "  usb646  ": obj32, "  usb647  ": obj33, "  usb82   ": obj15, "  m103    ": obj157, "  m128    ": obj93, "  m1280   ": obj28, "  m1281   ": obj27, "  m1284   ": obj38, "  m1284p  ": obj37, "  m1284rfr2": obj16, "  m128rfa1": obj23, "  m128rfr2": obj24, "  m16     ": obj90, "  m161    ": obj158, "  m162    ": obj62, "  m163    ": obj144, "  m164p   ": obj89, "  m168    ": obj54, "  m168p   ": obj51, "  m169    ": obj74, "  m16u2   ": obj11, "  m2560   ": obj9, "  m2561   ": obj10, "  m2564rfr2": obj1, "  m256rfr2": obj4, "  m32     ": obj91, "  m324p   ": obj49, "  m324pa  ": obj47, "  m325    ": obj79, "  m3250   ": obj78, "  m328    ": obj46, "  m328p   ": obj45, "  m329    ": obj58, "  m3290   ": obj56, "  m3290p  ": obj55, "  m329p   ": obj57, "  m32u2   ": obj13, "  m32u4   ": obj29, "  m406    ": obj752, "  m48     ": obj69, "  m48p    ": obj68, "  m64     ": obj94, "  m640    ": obj34, "  m644    ": obj44, "  m644p   ": obj43, "  m644rfr2": obj30, "  m645    ": obj77, "  m6450   ": obj76, "  m649    ": obj53, "  m6490   ": obj52, "  m64rfr2 ": obj31, "  m8      ": obj143, "  m8515   ": obj146, "  m8535   ": obj145, "  m88     ": obj60, "  m88p    ": obj59, "  m8u2    ": obj14, "  t10     ": obj764, "  t11     ": obj753, "  t12     ": obj159, "  t13     ": obj92, "  t15     ": obj160, "  t1634   ": obj50, "  t20     ": obj763, "  t2313   ": obj70, "  t24     ": obj73, "  t25     ": obj83, "  t26     ": obj142, "  t261    ": obj42, "  t4      ": obj766, "  t40     ": obj762, "  t4313   ": obj65, "  t43u    ": obj81, "  t44     ": obj72, "  t45     ": obj82, "  t461    ": obj40, "  t5      ": obj765, "  t84     ": obj71, "  t85     ": obj80, "  t861    ": obj35, "  t88     ": obj67, "  t9      ": obj767, "  x128a1  ": obj714, "  x128a1d ": obj703, "  x128a1u ": obj708, "  x128a3  ": obj715, "  x128a3u ": obj707, "  x128a4  ": obj727, "  x128a4u ": obj728, "  x128b1  ": obj712, "  x128b3  ": obj710, "  x128c3  ": obj733, "  x128d3  ": obj735, "  x128d4  ": obj731, "  x16a4   ": obj721, "  x16a4u  ": obj730, "  x16c4   ": obj739, "  x16d4   ": obj742, "  x16e5   ": obj748, "  x192a1  ": obj726, "  x192a3  ": obj725, "  x192a3u ": obj706, "  x192c3  ": obj747, "  x192d3  ": obj746, "  x256a1  ": obj711, "  x256a3  ": obj716, "  x256a3b ": obj709, "  x256a3bu": obj704, "  x256a3u ": obj705, "  x256c3  ": obj729, "  x256d3  ": obj732, "  x32a4   ": obj719, "  x32a4u  ": obj737, "  x32c4   ": obj741, "  x32d4   ": obj744, "  x32e5   ": obj749, "  x384c3  ": obj738, "  x384d3  ": obj736, "  x64a1   ": obj720, "  x64a1u  ": obj717, "  x64a3   ": obj724, "  x64a3u  ": obj713, "  x64a4   ": obj718, "  x64a4u  ": obj734, "  x64b1   ": obj723, "  x64b3   ": obj722, "  x64c3   ": obj745, "  x64d3   ": obj743, "  x64d4   ": obj740, "  x8e5    ": obj750, "  .xmega  ": obj751, "  .reduced_core_tiny": obj779, "  ucr2    ": obj780 };
        module.exports = obj0
    }, {}],
    22: [function(require, module, exports) { var status = require("corelib").status,
            Status = require("corelib").Status;
        module.exports = status({ CHECK_SIGNATURE: new Status("Checking signature"), CHECK_PAGE: new Status("Checking page at address {address}"), CLEANING_UP: new Status("Creaning up state"), CONNECTING: new Status("Connecting to: {device}"), ENTER_PROGMODE: new Status("Entering programming mode"), HARDWARE_VERSION: new Status("Getting hardware version"), LEAVE_PROGMODE: new Status("Leaving programming mode"), LEONARDO_RESET_END: new Status("Leonardo board reset successfully!"), LEONARDO_RESET_START: new Status("Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!"), PRECONFIGURING: new Status("Preconfiguring serial device: {device}"), RESETTING: new Status("Resetting device: {device}"), SOFTWARE_VERSION: new Status("Getting software version"), START_CHECK_DATA: new Status("Starting to check data"), START_FLASH: new Status("Flashing device please wait..."), START_WRITE_DATA: new Status("Starting to write data"), SYNC: new Status("Syncing with the device"), WRITE_PAGE: new Status("Writing page to address {address}") }) }, { corelib: 29 }],
    23: [function(require, module, exports) { var SerialAvrdudeTransaction = require("./avrdudetransaction.js").SerialAvrdudeTransaction,
            getLog = require("corelib").getLog,
            storeAsTwoBytes = require("corelib").storeAsTwoBytes,
            Stk500CodecSocket = require("./io/stk500codec.js").Stk500CodecSocket,
            errors = require("./errors.js"),
            scheduler = require("corelib").scheduler,
            status = require("./status.js");

        function STK500Transaction() { this.init.apply(this, arguments) } STK500Transaction.prototype = Object.create(SerialAvrdudeTransaction.prototype);
        STK500Transaction.prototype.init = function _init() { this.superApply(_init, arguments);
            this.log = getLog("STK500"); if (typeof this.config.preconfigureDevice === "undefined") this.config.preconfigureDevice = true;
            this.STK = { OK: 16, INSYNC: 20, CRC_EOP: 32, GET_SYNC: 48, GET_PARAMETER: 65, ENTER_PROGMODE: 80, LEAVE_PROGMODE: 81, LOAD_ADDRESS: 85, UNIVERSAL: 86, PROG_PAGE: 100, READ_PAGE: 116, READ_SIGN: 117, HW_VER: 128, SW_VER_MINOR: 130, SW_VER_MAJOR: 129, SET_DEVICE: 66, SET_DEVICE_EXT: 69 };
            this.maxMessageRetries = 2;
            this.codecsocketClass = Stk500CodecSocket };
        STK500Transaction.prototype.initializationMsg = function(maj, min) { this.log.log("Dev major:", maj, "minor:", min); var defmem = { readback: [255, 255], pageSize: 0, size: 0 },
                flashmem = this.config.avrdude.memory.flash || defmem,
                eepromem = this.config.avrdude.memory.eeprom || defmem,
                extparams = { pagel: this.config.avrdude.pagel || 215, bs2: this.config.avrdude.bs2 || 160, len: maj > 1 || maj == 1 && min > 10 ? 4 : 3 },
                initMessage = [this.STK.SET_DEVICE, this.config.avrdude.stk500_devcode || 0, 0, this.config.avrdude.serialProgramMode && this.config.avrdude.parallelProgramMode ? 0 : 1, this.config.avrdude.pseudoparallelProgramMode && this.config.avrdude.parallelProgramMode ? 0 : 1, 1, 1, this.config.avrdude.memory.lock ? this.config.avrdude.memory.lock.size : 0, [this.config.avrdude.memory.fuse, this.config.avrdude.memory.hfuse, this.config.avrdude.memory.lfuse, this.config.avrdude.memory.efuse].reduce(function(res, b) { return res + (b ? b.size : 0) }, 0), flashmem.readback[0], flashmem.readback[1], eepromem.readback[0], eepromem.readback[1], flashmem.page_size >> 8 & 255, flashmem.page_size & 255, eepromem.size >> 8 & 255, eepromem.size & 255, flashmem.size >> 24 & 255, flashmem.size >> 16 & 255, flashmem.size >> 8 & 255, flashmem.size & 255, this.STK.CRC_EOP],
                extparamArray = [this.STK.SET_DEVICE_EXT, extparams.len + 1, this.config.avrdude.memory.eeprom ? this.config.avrdude.memory.eeprom.page_size : 0, extparams.pagel, extparams.bs2, this.config.avrdude.resetDisposition == "dedicated" ? 0 : 1].slice(0, extparams.len + 2).concat(this.STK.CRC_EOP); return [initMessage, extparamArray] };
        STK500Transaction.prototype.cmd = function(cmd, cb) { this.log.log("Running command:", cmd);
            this.writeThenRead([this.STK.UNIVERSAL].concat(cmd).concat([this.STK.CRC_EOP]), cb) };
        STK500Transaction.prototype.flash = function(deviceName, sketchData) { var smartOpen = { state: "smartOpenDevice", retries: 3, retryInterval: 1e3 };
            this.refreshTimeout();
            this.sketchData = sketchData;
            this.deviceName = deviceName;
            this.log.log("Flashing. Config is:", this.config, "data:", this.sketchData);
            this.setStatus(status.CONNECTING, { device: deviceName });
            this.transition(smartOpen, deviceName, this.config.speed || 115200, { request: [this.STK.GET_SYNC, this.STK.CRC_EOP], response: [] }, this.transitionCb({ state: "inSyncWithBoard", retries: 10, waitBefore: 200, retryInterval: 0 })) };
        STK500Transaction.prototype.signOn = function() { this.writeThenRead([this.STK.GET_SYNC, this.STK.CRC_EOP], this.transitionCb("inSyncWithBoard"), { ttl: 300 }) };
        STK500Transaction.prototype.maybeCheckSignature = function(cb) { var self = this; if (this.config.skipSignatureCheck) { cb(); return } this.setStatus(status.CHECK_SIGNATURE);
            this.writeThenRead([this.STK.READ_SIGN, this.STK.CRC_EOP], function(data) { if (data.toString() != self.config.avrdude.signature.toString()) { self.errCb(errors.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: data }); return } cb() }, { minPureData: 3 }) };
        STK500Transaction.prototype.inSyncWithBoard = function(connectionId) { var self = this;
            this.setStatus(status.HARDWARE_VERSION);
            scheduler.setImmediate(function() { self.writeThenRead([self.STK.GET_PARAMETER, self.STK.HW_VER, self.STK.CRC_EOP], self.transitionCb("maybeReadSoftwareVersion"), { minPureData: 1 }) }) };
        STK500Transaction.prototype.maybeReadSoftwareVersion = function(data) { var self = this;
            this.setStatus(status.SOFTWARE_VERSION); if (!this.config.readSwVersion) { self.transition("enterProgmode"); return } this.writeThenRead([this.STK.GET_PARAMETER, this.STK.SW_VER_MAJOR, this.STK.CRC_EOP], function(major) { self.writeThenRead([self.STK.GET_PARAMETER, self.STK.SW_VER_MINOR, self.STK.CRC_EOP], function(minor) { var initMsgs = self.initializationMsg(major[0], minor[0]);
                    self.writeThenRead(initMsgs[0], function(data) { self.writeThenRead(initMsgs[1], self.transitionCb("enterProgmode")) }) }, { minPureData: 1 }) }, { minPureData: 1 }) };
        STK500Transaction.prototype.enterProgmode = function(data) { this.setStatus(status.ENTER_PROGMODE); var self = this;
            self.writeThenRead([self.STK.ENTER_PROGMODE, self.STK.CRC_EOP], self.transitionCb("maybeCheckSignature", self.transitionCb("maybeChipErase", self.transitionCb("programFlash", this.config.avrdude.memory.flash.page_size, null)))) };
        STK500Transaction.prototype.programFlash = function(pageSize) { this.setStatus(status.START_WRITE_DATA);
            this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("doneWriting", pageSize), this.sketchData.min()) };
        STK500Transaction.prototype.doneWriting = function(pageSize) { this.setStatus(status.SYNC); var next = this.config.checkPages ? this.transitionCb("checkPages", pageSize) : this.transitionCb("doneProgramming");
            this.writeThenRead([this.STK.GET_SYNC, this.STK.CRC_EOP], next) };
        STK500Transaction.prototype.checkPages = function(pageSize) { this.setStatus(status.START_CHECK_DATA);
            this.sketchData.tile(this.transitionCb("checkPage"), pageSize, this.transitionCb("doneProgramming"), this.sketchData.min()) };
        STK500Transaction.prototype.doneProgramming = function() { var self = this;
            this.setStatus(status.LEAVE_PROGMODE);
            this.setupSpecialBits(this.config.cleanControlBits, function() { self.writeThenRead([self.STK.LEAVE_PROGMODE, self.STK.CRC_EOP], self.transitionCb("leftProgmode"), { ignoreBadFinalByte: true }) }) };
        STK500Transaction.prototype.leftProgmode = function(data) { var self = this;
            this.setStatus(status.CLEANING_UP);
            this.cleanup(function() { scheduler.setTimeout(self.finishCallback, 1e3) }) };
        STK500Transaction.prototype.addressMsg = function(addr) { var addrBytes = storeAsTwoBytes(addr / 2); return [this.STK.LOAD_ADDRESS, addrBytes[1], addrBytes[0], this.STK.CRC_EOP] };
        STK500Transaction.prototype.writeMsg = function(payload) { var flashMemoryType = 70,
                sizeBytes = storeAsTwoBytes(payload.length); return [this.STK.PROG_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType].concat(payload).concat([this.STK.CRC_EOP]) };
        STK500Transaction.prototype.readMsg = function(size) { var flashMemoryType = 70,
                sizeBytes = storeAsTwoBytes(size); return [this.STK.READ_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType, this.STK.CRC_EOP] };
        STK500Transaction.prototype.writePage = function(offset, payload, done) { this.setStatus(status.WRITE_PAGE, { address: offset }); var loadAddressMessage = this.addressMsg(offset),
                programMessage = this.writeMsg(payload),
                writeDelay = this.config.avrdude.memory.flash.max_write_delay,
                self = this;
            this.writeThenRead(loadAddressMessage, function() { self.writeThenRead(programMessage, function() { scheduler.setTimeout(done, Math.ceil(writeDelay / 1e3)) }) }) };
        STK500Transaction.prototype.checkPage = function(offset, payload, done) { var loadAddressMessage = this.addressMsg(offset),
                readMessage = this.readMsg(payload.length),
                self = this;
            this.log.log("Checking page at address:", offset, "(size:", payload.length, ")");
            this.setStatus(status.CHECK_PAGE, { address: offset });
            this.writeThenRead(loadAddressMessage, function() { self.writeThenRead(readMessage, function(devData) { if (devData.some(function(b, i) { return b != payload[i] })) { self.errCb(errors.PAGE_CHECK, { devPage: devData, hostPage: payload, pageOffset: offset }); return } done() }, { minPureData: payload.length }) }) };
        module.exports.STK500Transaction = STK500Transaction }, { "./avrdudetransaction.js": 11, "./errors.js": 16, "./io/stk500codec.js": 18, "./status.js": 22, corelib: 29 }],
    24: [function(require, module, exports) { var SerialAvrdudeTransaction = require("./avrdudetransaction.js").SerialAvrdudeTransaction,
            getLog = require("corelib").getLog,
            scheduler = require("corelib").scheduler,
            memops = require("./memops.js"),
            Stk500v2CodecSocket = require("./io/stk500v2codec.js").Stk500v2CodecSocket,
            storeAsTwoBytes = require("corelib").storeAsTwoBytes,
            storeAsFourBytes = require("corelib").storeAsFourBytes,
            status = require("./status.js"),
            errors = require("./errors.js");

        function STK500v2Transaction() { this.init.apply(this, arguments) } STK500v2Transaction.prototype = Object.create(SerialAvrdudeTransaction.prototype);
        STK500v2Transaction.prototype.init = function _init(config) { if (typeof config.avoidTwiggleDTR === "undefined") config.avoidTwiggleDTR = false;
            this.superApply(_init, arguments);
            this.log = getLog("STK500v2");
            this.cmdSeq = 1;
            this.codecsocketClass = Stk500v2CodecSocket };
        STK500v2Transaction.prototype.STK2 = { CMD_SIGN_ON: 1, CMD_SET_PARAMETER: 2, CMD_GET_PARAMETER: 3, CMD_SET_DEVICE_PARAMETERS: 4, CMD_OSCCAL: 5, CMD_LOAD_ADDRESS: 6, CMD_FIRMWARE_UPGRADE: 7, CMD_CHECK_TARGET_CONNECTION: 13, CMD_LOAD_RC_ID_TABLE: 14, CMD_LOAD_EC_ID_TABLE: 15, CMD_ENTER_PROGMODE_ISP: 16, CMD_LEAVE_PROGMODE_ISP: 17, CMD_CHIP_ERASE_ISP: 18, CMD_PROGRAM_FLASH_ISP: 19, CMD_READ_FLASH_ISP: 20, CMD_PROGRAM_EEPROM_ISP: 21, CMD_READ_EEPROM_ISP: 22, CMD_PROGRAM_FUSE_ISP: 23, CMD_READ_FUSE_ISP: 24, CMD_PROGRAM_LOCK_ISP: 25, CMD_READ_LOCK_ISP: 26, CMD_READ_SIGNATURE_ISP: 27, CMD_READ_OSCCAL_ISP: 28, CMD_SPI_MULTI: 29, CMD_XPROG: 80, CMD_XPROG_SETMODE: 81, STATUS_CMD_OK: 0, STATUS_CMD_TOUT: 128, STATUS_RDY_BSY_TOUT: 129, STATUS_SET_PARAM_MISSING: 130, STATUS_CMD_FAILED: 192, STATUS_CKSUM_ERROR: 193, STATUS_CMD_UNKNOWN: 201, MESSAGE_START: 27, TOKEN: 14 };
        STK500v2Transaction.prototype.cmd = function(cmd, cb) { if (cmd.length != 4) { this.errCb(errors.COMMAND_SIZE_FAIL, { receivedCmd: cmd }); return } var buf = [this.STK2.CMD_SPI_MULTI, 4, 4, 0].concat(cmd);
            this.writeThenRead(buf, function(resp) { cb(resp.slice(2, 6)) }) };
        STK500v2Transaction.prototype.flash = function(deviceName, sketchData) { this.refreshTimeout();
            this.sketchData = sketchData;
            this.deviceName = deviceName; var self = this; var smartOpen = { state: "smartOpenDevice", retries: 3, retryInterval: 1e3 };
            this.setStatus(status.CONNECTING, { device: deviceName });
            this.transition(smartOpen, deviceName, this.config.speed, { request: [this.STK2.CMD_SIGN_ON], response: [self.STK2.CMD_SIGN_ON, self.STK2.STATUS_CMD_OK] }, this.transitionCb({ state: "signedOn", retries: 10, waitBefore: 200, retryInterval: 0 })) };
        STK500v2Transaction.prototype.signedOn = function() { var timeout = 200,
                stabDelay = 100,
                cmdExecDelay = 25,
                syncHLoops = 32,
                byteDelay = 0,
                pollValue = 83,
                pollIndex = 3,
                pgmEnable = [172, 83, 0, 0],
                nextStep = this.transitionCb("postSignOn");
            this.writeThenRead([this.STK2.CMD_ENTER_PROGMODE_ISP, timeout, stabDelay, cmdExecDelay, syncHLoops, byteDelay, pollValue, pollIndex].concat(pgmEnable), nextStep) };
        STK500v2Transaction.prototype.postSignOn = function(cb) { var self = this,
                programFlash = this.transitionCb("programFlash", this.config.avrdude.memory.flash.page_size);

            function eraseCmd(cmd, cb) { var buf = [self.STK2.CMD_CHIP_ERASE_ISP, self.config.avrdude.chipEraseDelay / 1e3, 0].concat(cmd);
                self.writeThenRead(buf, cb) } this.transition("maybeCheckSignature", this.transitionCb("maybeChipErase", programFlash, eraseCmd)) };
        STK500v2Transaction.prototype.preProgramHack = function(offset, pgSize) { this.cmdChain([
                [48, 0, 0, 0],
                [48, 0, 1, 0],
                [48, 0, 2, 0],
                [160, 15, 252, 0],
                [160, 15, 253, 0],
                [160, 15, 254, 0],
                [160, 15, 255, 0]
            ], this.transitionCb("programFlash", pgSize || 256)) };
        STK500v2Transaction.prototype.programFlash = function(pageSize) { var next = this.config.checkPages ? this.transitionCb("checkPages", pageSize) : this.transitionCb("maybeCleanupBits");
            this.sketchData.tile(this.transitionCb("writePage"), pageSize, next, this.sketchData.min()) };
        STK500v2Transaction.prototype.checkPages = function(pageSize) { var self = this;

            function writeAndRecheck(retryCb, offset, payload, done) { self.writePage(offset, payload, retryCb) } this.sketchData.tile(this.transitionCb({ state: "checkPage", fallbackCb: writeAndRecheck, retries: 10 }), pageSize, this.transitionCb("maybeCleanupBits"), this.sketchData.min()) };
        STK500v2Transaction.prototype.maybeCleanupBits = function(pageSize) { this.setupSpecialBits(this.config.cleanControlBits, this.transitionCb("doneProgramming")) };
        STK500v2Transaction.prototype.doneProgramming = function() { var self = this;
            self.writeThenRead([17, 1, 1], function(data) { self.setStatus(status.CLEANING_UP);
                self.transition("disconnect", function() { self.cleanup(function() { scheduler.setTimeout(self.finishCallback, 1e3) }) }) }, { tolerateReceiveErrors: true, tolerateSendErrors: true }) };
        STK500v2Transaction.prototype.writePage = function(offset, payload, done) { var self = this;
            this.writeThenRead(this.addressMsg(offset), function(reponse) { self.writeThenRead(self.writeMsg(payload), function(response) { if (response[0] != 19 || response[1] != 0) { self.errCb(errors.PAGE_WRITE_RESPONSE, { deviceResponse: response, expectedResponse: [19, 0] }); return } done() }) }) };
        STK500v2Transaction.prototype.checkPage = function(offset, payload, done) { var self = this,
                index = 0;
            this.writeThenRead(this.addressMsg(offset), function(reponse) { self.writeThenRead(self.readMsg(payload.length), function(response) { response = response.slice(2);
                    response.pop(); if (response.length != payload.length || response.some(function(v, i) { index = i; return v != payload[i] })) { self.errCb(errors.PAGE_CHECK, { devPage: response, hostPage: payload, pageOffset: offset }); return } done() }, { minPureData: 2 + payload.length + 1 }) }) };
        STK500v2Transaction.prototype.readMsg = function(size) { var readCmds = memops.opToBin(this.config.avrdude.memory.flash.memops.READ_LO),
                sizeBytes = storeAsTwoBytes(size); return [this.STK2.CMD_READ_FLASH_ISP, sizeBytes[0], sizeBytes[1], readCmds[0]] };
        STK500v2Transaction.prototype.addressMsg = function(address) { var addressBytes = storeAsFourBytes(address / 2); if (this.config.avrdude.memory.flash.memops.LOAD_EXT_ADDR) addressBytes[0] |= 128; return [this.STK2.CMD_LOAD_ADDRESS].concat(addressBytes) };
        STK500v2Transaction.prototype.writeMsg = function(payload) { var sizeBytes = storeAsTwoBytes(payload.length),
                memMode = 193,
                delay = 10,
                loadpageLoCmd = 64,
                writepageCmd = 76,
                avrOpReadLo = 32; return [this.STK2.CMD_PROGRAM_FLASH_ISP, sizeBytes[0], sizeBytes[1], memMode, delay, loadpageLoCmd, writepageCmd, avrOpReadLo, 0, 0].concat(payload) };
        module.exports.STK500v2Transaction = STK500v2Transaction }, { "./avrdudetransaction.js": 11, "./errors.js": 16, "./io/stk500v2codec.js": 19, "./memops.js": 20, "./status.js": 22, corelib: 29 }],
    25: [function(require, module, exports) { var UsbAvrdudeTransaction = require("./avrdudetransaction.js").UsbAvrdudeTransaction,
            SerialAvrdudeTransaction = require("./avrdudetransaction.js").SerialAvrdudeTransaction,
            getLog = require("corelib").getLog,
            replaceProto = require("corelib").replaceProto,
            bufToBin = require("corelib").bufToBin,
            replacePrototype = require("corelib").replacePrototype,
            shallowCopy = require("corelib").shallowCopy,
            STK500v2Transaction = require("./stk500v2.js").STK500v2Transaction,
            errors = require("./errors.js");

        function STK500v2UsbTransaction() { this.init.apply(this, arguments) } STK500v2UsbTransaction.prototype = replacePrototype(Object.create(STK500v2Transaction.prototype), SerialAvrdudeTransaction, UsbAvrdudeTransaction);
        STK500v2UsbTransaction.prototype.init = function() { this.__proto__.__proto__.init.apply(this, arguments);
            this.setupAsBulk();
            this.MAX_READ_LENGTH = 275;
            this.cmdSeq = 1;
            this.device = { vendorId: 1003, productId: 8452 };
            this.log = getLog("STK500v2USB");
            this.entryState = "sync";
            this.transfer = this.usb.bulkTransfer.bind(this.usb);
            this.transferIn = this.bulkIn.bind(this);
            this.transferOut = this.bulkOut.bind(this) };
        STK500v2UsbTransaction.prototype.flash = UsbAvrdudeTransaction.prototype.flash;
        STK500v2UsbTransaction.prototype.sync = function(cb) { var expectedResp = [this.STK2.CMD_SIGN_ON, this.STK2.STATUS_CMD_OK],
                self = this;
            this.writeThenRead([this.STK2.CMD_SIGN_ON], function(data) { if (data.toString() == expectedResp.toString()) { self.errCb(errors.SYNC_RESPONSE, { expected: expectedResp, got: data }); return } self.transition("signedOn") }) };
        STK500v2UsbTransaction.prototype.drain = function(cb) { var self = this;
            this.usb.resetDevice(this.handler, function(ok) { if (!ok) { self.errCb(errors.STK500V2USB_DEVICE_RESET); return } cb() }) };
        STK500v2UsbTransaction.prototype.resetDevice = function(cb) { cb() };
        STK500v2UsbTransaction.prototype.write = function(data, cb, kwargs) { kwargs = kwargs || {}; var self = this,
                msg = data.slice(0, this.maxPacketSize()),
                outMsg = this.transferOut(msg);
            this.usb.bulkTransfer(this.handler, outMsg, function(outResp) { if (!outResp || outResp.resultCode != 0) { self.errCb(errors.BULK_TRANSFER, { sentMessage: outMsg, response: outResp }); return } if (data.length >= self.maxPacketSize()) { self.write(data.slice(self.maxPacketSize()), cb, kwargs); return } cb() }) };
        STK500v2UsbTransaction.prototype.read = function(length, cb, kwargs) { var self = this;
            kwargs = kwargs || {}; if (length > this.maxPacketSize()) { self.read(self.maxPacketSize(), function(headPacket) { if (headPacket.length < self.maxPacketSize()) { cb(headPacket); return } self.read(length - self.maxPacketSize(), function(rest) { cb(headPacket.concat(rest)) }, kwargs) }, kwargs); return } var packetSize = this.maxPacketSize(),
                inMsg = this.transferIn(packetSize, kwargs.timeout);
            this.usb.bulkTransfer(self.handler, inMsg, function(inResp) { if (!kwargs.silenceErrors && (!inResp || inResp.resultCode != 0)) { self.errCb(errors.BULK_RECEIVE, { response: inResp }); return } var ret = bufToBin(inResp.data);
                cb(ret) }) };
        STK500v2UsbTransaction.prototype.writeThenRead = function(data, cb, kwargs) { var self = this;
            this.write(data, function() { self.read(self.MAX_READ_LENGTH, function(data) { cb(data) }) }) };
        module.exports.STK500v2UsbTransaction = STK500v2UsbTransaction }, { "./avrdudetransaction.js": 11, "./errors.js": 16, "./stk500v2.js": 24, corelib: 29 }],
    26: [function(require, module, exports) {
        var UsbAvrdudeTransaction = require("./avrdudetransaction.js").UsbAvrdudeTransaction,
            errors = require("./errors.js"),
            scheduler = require("corelib").scheduler,
            getLog = require("corelib").getLog;

        function USBAspTransaction(config, finishCallback, errorCallback) { this.init.apply(this, arguments) } USBAspTransaction.prototype = Object.create(UsbAvrdudeTransaction.prototype);
        USBAspTransaction.prototype.init = function() { this.__proto__.__proto__.init.apply(this, arguments);
            this.setupAsControl();
            this.log = getLog("USBASP");
            this.UA = { CONNECT: 1, DISCONNECT: 2, TRANSMIT: 3, READFLASH: 4, ENABLEPROG: 5, WRITEFLASH: 6, READEEPROM: 7, WRITEEEPROM: 8, SETLONGADDRESS: 9, SETISPSCK: 10, GETCAPABILITIES: 127, READBLOCKSIZE: 200, WRITEBLOCKSIZE: 200, BLOCKFLAG_FIRST: 1, BLOCKFLAG_LAST: 2, CAP_TPI: 1 };
            this.SCK_OPTIONS = { 15e5: 12, 75e4: 11, 375e3: 10, 187500: 9, 93750: 8, 32e3: 7, 16e3: 6, 8e3: 5, 4e3: 4, 2e3: 3, 1e3: 2, 500: 1 };
            this.device = { productId: 1500, vendorId: 5824 };
            this.cmdFunction = this.UA.TRANSMIT;
            this.entryState = { state: "checkCapabilities", retries: 3 } };
        USBAspTransaction.prototype.checkCapabilities = function() { var self = this; var info = this.transferIn(this.UA.GETCAPABILITIES, 0, 0, 4);
            this.xferMaybe(info, function(resp) { var capabilities = resp.data.reduce(function(a, b) { return a << 8 | b }, 0); if (capabilities & self.UA.CAP_TPI) { self.errCb(errors.UNSUPPORTED_TPI, { capabilities: capabilities }); return } scheduler.setTimeout(self.transitionCb("setSck"), 1e3) }) };
        USBAspTransaction.prototype.setSck = function() { var sck_id = 0; if (this.config.bitclock) { var request_hz = this.config.bitclock,
                    sck_hz = Object.getOwnPropertyNames(this.SCK_OPTIONS).map(Number).sort().filter(function(sck) { return request_hz < sck })[0];
                sck_id = this.SCK_OPTIONS[sck_hz] || 0 } var info = this.transferIn(this.UA.SETISPSCK, sck_id, 0, 4);
            this.sck_hz = sck_hz;
            this.xfer(info, this.transitionCb("programEnable")) };
        USBAspTransaction.prototype.programEnable = function() { var cb, self = this,
                enableProgInfo = this.transferIn(this.UA.ENABLEPROG, 0, 0, 4),
                connectInfo = this.transferIn(this.UA.CONNECT, 0, 0, 4); if (!this.chipErased) { this.chipErased = true;
                cb = this.transitionCb("maybeCheckSignature", this.transitionCb("maybeChipErase", this.transitionCb("checkCapabilities"))) } else { cb = this.transitionCb("writePages", this.config.avrdude.memory.flash.page_size) } this.xferMaybe(connectInfo, function() { self.xferMaybe(enableProgInfo, cb) }) };
        USBAspTransaction.prototype.infoAddress = function(offset) { var cmd = [offset & 255, offset >> 8 & 255, offset >> 16 & 255, offset >> 24 & 255]; if (offset >>> 31 >> 1 != 0) { this.errCb(errors.ADDRESS_TOO_LONG, { address: offset }); return null } this.log.log("[CMD]setaddress: ", this.UA.SETLONGADDRESS.toString(16), (cmd[1] << 8 | cmd[0]).toString(16), (cmd[3] << 8 | cmd[2]).toString(16)); return this.transferIn(this.UA.SETLONGADDRESS, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4) };
        USBAspTransaction.prototype.writePage = function(offset, payload, done) { var pageStart = offset,
                pageEnd = offset + payload.length;
            this.sketchData.tile(this.transitionCb("writeBlock", payload.length, pageStart, pageEnd), this.blockSize(), done, pageStart, pageEnd) };
        USBAspTransaction.prototype.writeBlock = function(pageSize, pageStart, pageEnd, offset, payload, done) {
            var isLast = pageEnd <= offset + payload.length,
                isFirst = offset == pageStart,
                address = [offset >> 0 & 255, offset >> 8 & 255],
                flags = (isFirst ? this.UA.BLOCKFLAG_FIRST : 0) | (isLast ? this.UA.BLOCKFLAG_LAST : 0),
                flagHex = flags & 15 | (pageSize & 3840) >> 4,
                infoWrite = this.transferOut(this.UA.WRITEFLASH, address[1] << 8 | address[0], pageSize & 255 | flagHex << 8, payload),
                self = this;
            this.xferMaybe(this.infoAddress(offset), function(resp) { self.log.log("[CMD]writeflash: ", self.UA.WRITEFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), (pageSize & 255 | flagHex << 8).toString(16));
                self.xferMaybe(infoWrite, done) })
        };
        USBAspTransaction.prototype.checkBlock = function(offset, payload, done) { var self = this,
                address = [offset >> 0 & 255, offset >> 8 & 255],
                infoRead = self.transferIn(this.UA.READFLASH, address[1] << 8 | address[0], 0, payload.length);
            this.xferMaybe(this.infoAddress(offset), function(resp) { self.log.log("[CMD]readflash: ", self.UA.READFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), 0);
                self.xferMaybe(infoRead, function(resp) { if (JSON.stringify(resp.data) != JSON.stringify(payload)) { self.errCb(errors.PAGE_CHECK, { devPage: resp.data, hostPage: payload, pageOffset: offset }); return } done() }) }) };
        USBAspTransaction.prototype.blockSize = function() { return this.sck_hz && this.sck_hz > 0 && this.sck_hz < 1e4 ? this.UA.WRITEBLOCKSIZE / 10 : this.UA.WRITEBLOCKSIZE };
        USBAspTransaction.prototype.checkPage = function(offset, payload, done) { this.sketchData.tile(this.transitionCb("checkBlock"), this.blockSize(), done, offset, offset + payload.length) };
        USBAspTransaction.prototype.writePages = function(pageSize) { this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("checkPages", pageSize), this.sketchData.min()) };
        USBAspTransaction.prototype.checkPages = function(pageSize) { var self = this;

            function writeAndRecheck(retryCb, offset, payload, done) { self.writePage(offset, payload, retryCb) } var checkPage = { state: "checkPage", retries: 3, fallbackCb: writeAndRecheck };
            this.sketchData.tile(this.transitionCb(checkPage), pageSize, this.transitionCb("close"), this.sketchData.min()) };
        USBAspTransaction.prototype.close = function() { var self = this;
            this.setupSpecialBits(self.config.cleanControlBits, function() { self.control(self.UA.DISCONNECT, 0, 0, function() { self.cleanup(self.finishCallback) }) }) };
        module.exports.USBAspTransaction = USBAspTransaction
    }, { "./avrdudetransaction.js": 11, "./errors.js": 16, corelib: 29 }],
    27: [function(require, module, exports) { var UsbAvrdudeTransaction = require("./avrdudetransaction.js").UsbAvrdudeTransaction,
            ops = require("./memops.js"),
            errors = require("./errors.js"),
            getLog = require("corelib").getLog;

        function USBTinyTransaction(config, finishCallback, errorCallback) { this.init.apply(this, arguments) } USBTinyTransaction.prototype = Object.create(UsbAvrdudeTransaction.prototype);
        USBTinyTransaction.prototype.init = function() { var self = this;
            this.__proto__.__proto__.init.apply(this, arguments);
            this.setupAsControl();
            this.UT = { ECHO: 0, READ: 1, WRITE: 2, CLR: 3, SET: 4, POWERUP: 5, POWERDOWN: 6, SPI: 7, POLL_BYTES: 8, FLASH_READ: 9, FLASH_WRITE: 10, EEPROM_READ: 11, EEPROM_WRITE: 12, RESET_LOW: 0, RESET_HIGH: 1 };
            this.entryState = "programEnable";
            this.cmdFunction = this.UT.SPI;
            this.device = { productId: 3231, vendorId: 6017 };
            this.log = getLog("USBTinyISP");

            function rewriteThenCheck(retry, offset, payload, cb) { self.transition(self.writePageTransitionConf, offset, payload, retry) }

            function writeInBytes(retry, offset, payload, cb) { self.transition("writePageInBytes", offset, payload, cb) } this.writePageTransitionConf = { state: "writePage", fallbackCb: writeInBytes, retries: 20, retryInterval: 0 };
            this.checkPageTransitionConf = { state: "checkPage", fallbackCb: rewriteThenCheck, retries: 5, retryInterval: 500 } };
        USBTinyTransaction.prototype.cmd = function(cmd, cb) { var superProto = Object.getPrototypeOf(Object.getPrototypeOf(this)),
                self = this;
            superProto.cmd.call(this, cmd, function(resp) { if (!ops.checkMask([null, null, cmd[1], null], resp.data)) { self.errCb(errors.COMMAND_CHECK, { cmd: cmd, resp: resp.data }); return } cb(resp) }) };
        USBTinyTransaction.prototype.programEnable = function() { var cb, self = this; if (!this.chipErased) { this.chipErased = true;
                cb = function() { self.transition("maybeCheckSignature", self.transitionCb("maybeChipErase", self.transitionCb("programEnable"))) } } else { cb = this.transitionCb("writePages") } this.control(this.UT.POWERUP, this.sck, this.UT.RESET_LOW, function() { self.log.log("Powered up. Enabling...");
                self.operation("PGM_ENABLE", {}, cb) }) };
        USBTinyTransaction.prototype.writePage = function(offset, payload, done) { var info = this.transferOut(this.UT.FLASH_WRITE, 0, offset, payload),
                writePageCmd = this.config.avrdude.memory.flash.memops.WRITEPAGE,
                flushCmd = ops.opToBin(writePageCmd, { ADDRESS: offset / 2 }),
                self = this;
            this.xferMaybe(info, function() { self.cmd(flushCmd, done) }) };
        USBTinyTransaction.prototype.checkPage = function(offset, payload, done) { var info = this.transferIn(this.UT.FLASH_READ, 0, offset, payload.length),
                self = this;
            this.xfer(info, function(devData) { if (devData.data.some(function(b, i) { return b != payload[i] })) { self.errCb(errors.PAGE_CHECK, { devPage: devData.data, hostPage: payload, pageOffset: offset }); return } done() }) };
        USBTinyTransaction.prototype.writePages = function() { var pageSize = this.config.avrdude.memory.flash.page_size;
            this.sketchData.tile(this.transitionCb(this.writePageTransitionConf), pageSize, this.transitionCb("checkPages"), this.sketchData.min()) };
        USBTinyTransaction.prototype.checkPages = function() { var pageSize = this.config.avrdude.memory.flash.page_size;
            this.sketchData.tile(this.transitionCb(this.checkPageTransitionConf), pageSize, this.transitionCb("powerDown"), this.sketchData.min()) };
        USBTinyTransaction.prototype.powerDown = function() { var self = this;
            this.setupSpecialBits(this.config.cleanControlBits, function() { self.control(self.UT.POWERDOWN, 0, 0, self.transitionCb("endTransaction")) }) };
        USBTinyTransaction.prototype.endTransaction = function(ctrlArg) { var self = this;
            this.cleanup(this.finishCallback) };
        module.exports.USBTinyTransaction = USBTinyTransaction }, { "./avrdudetransaction.js": 11, "./errors.js": 16, "./memops.js": 20, corelib: 29 }],
    28: [function(require, module, exports) { var Stk500v2 = require("./stk500v2").STK500v2Transaction;

        function WiringTransaction() { this.init.apply(this, arguments) } WiringTransaction.prototype = Object.create(Stk500v2.prototype);
        WiringTransaction.prototype.init = function _init(config) { if (typeof config.avoidTwiggleDTR === "undefined") config.avoidTwiggleDTR = false;
            this.superApply(_init, arguments) };
        module.exports.WiringTransaction = WiringTransaction }, { "./stk500v2": 24 }],
    29: [function(require, module, exports) { var toSettings = require("./lib/settings.js").toSettings;
        module.exports.typecheck = require("./lib/typecheck.js").typecheck;
        module.exports.typechecked = require("./lib/typecheck.js").typechecked;
        module.exports.Event = require("./lib/event.js").Event;
        module.exports.indirectEvent = require("./lib/event.js").indirectEvent;
        module.exports.compareVersions = require("./lib/util.js").compareVersions;
        module.exports.repeat = require("./lib/util.js").repeat;
        module.exports.bufToBin = require("./lib/util.js").bufToBin;
        module.exports.binToBuf = require("./lib/util.js").binToBuf;
        module.exports.storeAsTwoBytes = require("./lib/util.js").storeAsTwoBytes;
        module.exports.storeAsFourBytes = require("./lib/util.js").storeAsFourBytes;
        module.exports.shallowCopy = require("./lib/util.js").shallowCopy;
        module.exports.replacePrototype = require("./lib/util.js").replacePrototype;
        module.exports.hexRep = require("./lib/util.js").hexRep;
        module.exports.getUniqueId = require("./lib/util.js").getUniqueId;
        module.exports.scheduler = require("./lib/scheduler.js");
        module.exports.getLog = require("./lib/logging.js").getLog;
        module.exports.settings = require("./lib/settings.js").settings;
        module.exports.DynamicSetting = require("./lib/settings.js").DynamicSetting;
        module.exports.defaultSettings = require("./lib/settings.js").defaultSettings;
        module.exports.toSettings = toSettings;
        module.exports.errno = require("./lib/errno.js").errno;
        module.exports.RetVal = require("./lib/errno.js").RetVal;
        module.exports.errors = toSettings(require("./lib/data/errors.js")).child(require("./lib/io/errors.js")).child(require("./lib/transactions/errors.js")).child(require("./lib/transactions/connection/errors.js")).obj();
        module.exports.status = require("./lib/status.js").status;
        module.exports.Status = require("./lib/status.js").Status;
        module.exports.HexParser = require("./lib/data/intelhex.js").Parser;
        module.exports.Base64Parser = require("./lib/data/base64.js").Parser;
        module.exports.Data = require("./lib/data/data.js").Data;
        module.exports.ConnectionManager = require("./lib/transactions/connection/manager.js").ConnectionManager;
        module.exports.SerialTransaction = require("./lib/transactions/serialtransaction.js").SerialTransaction;
        module.exports.CodecSocket = require("./lib/io/codecsocket.js").CodecSocket;
        module.exports.createBadMessage = require("./lib/io/codecsocket.js").createBadMessage;
        module.exports.createFinalMessage = require("./lib/io/codecsocket.js").createFinalMessage;
        module.exports.SerialTransaction = require("./lib/transactions/serialtransaction.js").SerialTransaction;
        module.exports.USBTransaction = require("./lib/transactions/usbtransaction.js").USBTransaction;
        module.exports.FiniteStateMachine = require("./lib/transactions/fsm.js").FiniteStateMachine;
        module.exports.SocketTransaction = require("./lib/transactions/sockettransaction.js").SocketTransaction;
        module.exports.wrap = require("./lib/wrapper.js").wrap }, { "./lib/data/base64.js": 30, "./lib/data/data.js": 31, "./lib/data/errors.js": 32, "./lib/data/intelhex.js": 33, "./lib/errno.js": 34, "./lib/event.js": 35, "./lib/io/codecsocket.js": 37, "./lib/io/errors.js": 38, "./lib/logging.js": 40, "./lib/scheduler.js": 41, "./lib/settings.js": 42, "./lib/status.js": 43, "./lib/transactions/connection/errors.js": 45, "./lib/transactions/connection/manager.js": 46, "./lib/transactions/errors.js": 47, "./lib/transactions/fsm.js": 48, "./lib/transactions/serialtransaction.js": 49, "./lib/transactions/sockettransaction.js": 50, "./lib/transactions/usbtransaction.js": 52, "./lib/typecheck.js": 53, "./lib/util.js": 54, "./lib/wrapper.js": 55 }],
    30: [function(require, module, exports) { var Data = require("./data.js").Data,
            errors = require("./errors.js"); var Base64 = { _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", decodeArrayBuffer: function(input) { var bytes = input.length / 4 * 3; var ab = new ArrayBuffer(bytes);
                this.decode(input, ab); return ab }, decode: function(input, arrayBuffer) { var lkey1 = this._keyStr.indexOf(input.charAt(input.length - 1)); var lkey2 = this._keyStr.indexOf(input.charAt(input.length - 2)); var bytes = input.length / 4 * 3; if (lkey1 == 64) bytes--; if (lkey2 == 64) bytes--; var uarray; var chr1, chr2, chr3; var enc1, enc2, enc3, enc4; var i = 0; var j = 0; if (arrayBuffer) uarray = new Uint8Array(arrayBuffer);
                else uarray = new Uint8Array(bytes);
                input = input.replace(/[^A-Za-z0-9\+\/\=]/g, ""); for (i = 0; i < bytes; i += 3) { enc1 = this._keyStr.indexOf(input.charAt(j++));
                    enc2 = this._keyStr.indexOf(input.charAt(j++));
                    enc3 = this._keyStr.indexOf(input.charAt(j++));
                    enc4 = this._keyStr.indexOf(input.charAt(j++));
                    chr1 = enc1 << 2 | enc2 >> 4;
                    chr2 = (enc2 & 15) << 4 | enc3 >> 2;
                    chr3 = (enc3 & 3) << 6 | enc4;
                    uarray[i] = chr1; if (enc3 != 64) uarray[i + 1] = chr2; if (enc4 != 64) uarray[i + 2] = chr3 } return uarray } };

        function Parser(base64str, maxSize, offset) { this.base64str = base64str;
            this.maxSize = maxSize;
            this.offset = offset || 0;
            this.lastError = errors.PREMATURE_RETURN.copy({ process: "parser" }) } Parser.prototype = { _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", data: function() { var ret = [].slice.call(Base64.decode(this.base64str)); if (!ret) { this.lastError = errors.BASE64_ERROR; return null } if (this.maxSize && ret.length > this.maxSize) { this.lastError = errors.PROGRAM_TOO_LARGE.copy({ maxSize: this.maxSize, progLength: ret.length }); return null } this.lastError = errors.SUCCESS; return new Data(ret, this.offset) } };
        module.exports.Parser = Parser }, { "./data.js": 31, "./errors.js": 32 }],
    31: [function(require, module, exports) { var scheduler = require("./../scheduler.js");

        function Data(data, offset, parent, defaultByte) { this.parent = parent;
            this.offset = offset || 0;
            this.data = data || [];
            this.defaultByte = defaultByte || 0;
            this.slice = this.capSlice;
            Object.defineProperty(this, "length", { get: function() { if (this.getParent()) { if (this.isEmpty()) return this.getParent().length; return Math.max(this.getParent().length, this.offset + this.data.length) } return this.offset + this.data.length } }) } Data.prototype = { getParent: function() { return this.parent && this.parent.getSelf() }, getSelf: function() { if (this.offset === Infinity) { return this.getParent() } return this }, copy: function() { return new Data(this.data, this.offset, this.parent, this.defaultByte) }, get: function(addr, defaultByte) { var byte = this.data[addr - this.offset],
                    defaultByte = typeof defaultByte == "undefined" ? this.defaultByte : defaultByte; if (typeof byte === "undefined" && this.getParent()) { byte = this.getParent().get(addr, defaultByte) } if (typeof byte === "undefined") { byte = defaultByte } return byte }, unknownSlice: function(start, end) { if (this.getParent()) { return this.getParent().infiniteSlice(start, end) } if (end <= start) { return [] } var ret = new Array(end - start); for (var i = 0; i < end - start; i++) ret[i] = this.defaultByte; return ret }, infiniteSlice: function(start, end) { if (start >= end) { return [] } var sr = this.subranges(start, end),
                    before = this.unknownSlice(sr.before[0], sr.before[1]),
                    own = this.data.slice(sr.data[0] - this.offset, sr.data[1] - this.offset),
                    after = this.unknownSlice(sr.after[0], sr.after[1]),
                    ret = before.concat(own).concat(after); return ret }, capSlice: function(start, end) { var realEnd = typeof end === "undefined" ? this.length : end; return this.infiniteSlice(Math.max(start || 0, 0), Math.min(realEnd, this.length)) }, subranges: function(start, end) { var dataStart = this.offset,
                    dataEnd = this.offset + this.data.length; if (dataStart < start) { dataStart = start } else if (dataStart > end) { dataStart = end } if (dataEnd > end) { dataEnd = end } else if (dataEnd < start) { dataEnd = start } return { before: [start, dataStart], data: [dataStart, dataEnd], after: [dataEnd, end] } }, layer: function(data, offset, trySquashing) { if (!data) return new Data(null, null, this); var overlapRange = this.subranges(offset, offset + data).data,
                    overlapping = overlapRange[1] - overlapRange[0] > 0,
                    consecutiveAfter = offset == this.data.length + this.offset,
                    consecutiveBefore = offset + data.length == this.offset; if (trySquashing && (overlapping || consecutiveAfter || consecutiveBefore)) { var mirror = this.copy();
                    mirror.parent = null; var ret = new Data(data, offset, mirror).squashed();
                    ret.parent = this.parent; return ret } return new Data(data, offset, this) }, layerData: function(data) { data.parent = this; return data }, min: function() { var parentOffset = Infinity,
                    thisOffset = Infinity; if (this.getParent()) { parentOffset = this.getParent().min() } if (!this.isEmpty()) { thisOffset = this.offset } return Math.min(thisOffset, parentOffset) }, squashed: function() { var ret = new Data(this.slice(this.min()), this.min()),
                    db = this.defaultByte;
                Object.defineProperty(ret, "defaultByte", { value: db, writable: false }); return ret }, isEmpty: function(recursive) { var selfEmpty = this.data.length == 0,
                    parentEmpty = true; if (!recursive) { return selfEmpty } if (this.getParent()) { parentEmpty = this.getParent().isEmpty() } return selfEmpty && parentEmpty }, tile: function(strider, pagesize, done, start, end) { var self = this,
                    firstAddr = start || 0,
                    lastAddr = end || self.length;

                function tileFrom(offset, args) { var data = self.slice(offset, pagesize + offset); if (offset >= lastAddr) { done.apply(null, args); return } scheduler.setImmediate(function() { strider.bind(null, offset, data, function() { tileFrom(offset + data.length, [].slice.call(arguments)) }).apply(null, args) }) } tileFrom(firstAddr) } };
        module.exports.Data = Data }, { "./../scheduler.js": 41 }],
    32: [function(require, module, exports) { var errno = require("./../errno.js").errno,
            RetVal = require("./../errno.js").RetVal;
        module.exports = errno({ PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to."), BASE64_ERROR: new RetVal(1, "Bad base64 data."), PROGRAM_TOO_LARGE: new RetVal(20090, "Tried to flash too large a program"), HEXFILE_ERROR: new RetVal(20130, "Error during parsing hexfile"), HEXFILE_INCOMPLETE: new RetVal(20131, "Expected more hexfile.") }) }, { "./../errno.js": 34 }],
    33: [function(require, module, exports) { var Data = require("./data.js").Data,
            errors = require("./errors.js");

        function Parser(hex, maxSize, offset) { this.resetState();
            this.hex = hex;
            this.maxSize = maxSize;
            this.dataOffset = offset || 0 } Parser.prototype = { resetState: function() { this.lastError = null;
                this.offsetLin = 0;
                this.offsetSeg = 0;
                this.endOfData = false }, data: function(noSquash) { var self = this;
                this.resetState(); var ret = this.hex.split("\n").reduce(function(data, line) { var d = data && self.parseLine(line),
                        ret = d && data.layer(d.data, d.offset + self.dataOffset, true); return noSquash || !ret ? ret : ret.squashed() }, new Data); if (!this.endOfData && this.hex.length > 0) { this.lastError = errors.HEXFILE_INCOMPLETE.copy(); return null } if (this.maxSize && ret.length > this.maxSize) { this.lastError = errors.PROGRAM_TOO_LARGE.copy({ maxSize: this.maxSize, progLength: ret.length }); return null } return ret }, hexToBytes: function(strData) { var arr = new Array(strData.length / 2); for (var i = 0; i < strData.length; i += 2) { arr[i / 2] = Number.parseInt(strData[i] + strData[i + 1], 16) } return arr }, parseLine: function(line) { var EMPTY = { offset: this.offsetLin, data: [] };
                line = line.trim(); if (line.length == 0) { return EMPTY } if (line[0] !== ":" || line.length % 2 !== 1) { this.lastError = errors.HEXFILE_ERROR.copy({ line: line }); return null } if (this.endOfData) { this.lastError = errors.HEXFILE_ERROR.copy({ firstLineAfterEOF: line }); return null } var index = 0,
                    DATA = 0,
                    EOF = 1,
                    EXTENDED_SEG_ADDR = 2,
                    START_SEG_ADDR = 3,
                    EXTENDED_LIN_ADDR = 4,
                    START_LIN_ADDR = 5;

                function rng(length) { var start = index,
                        end = index + length;
                    index = end; return line.substring(start, end) } var start = rng(1),
                    length = Number.parseInt(rng(2), 16),
                    addr = Number.parseInt(rng(4), 16),
                    type = Number.parseInt(rng(2), 16),
                    strData = rng(length * 2),
                    actualCheck = this.hexToBytes(line.substring(1, index)).reduce(function(a, b) { return a + b }, 0) & 255,
                    checksum = Number.parseInt(rng(2), 16),
                    byteData = this.hexToBytes(strData); if (start != ":" || checksum != (-actualCheck & 255)) { console.log(start, checksum);
                    this.lastError = errors.HEXFILE_ERROR.copy({ lineStart: start, crc: checksum, expectedCrc: -actualCheck & 255 }); return null } switch (type) {
                    case DATA:
                        return { offset: addr + this.offsetSeg + this.offsetLin, data: byteData };
                    case EXTENDED_SEG_ADDR:
                        this.offsetSeg = Number.parseInt(strData, 16) * 16; return { offset: this.offsetLin, data: [] };
                    case EXTENDED_LIN_ADDR:
                        this.offsetLin = Number.parseInt(strData, 16) << 16 >>> 0; return EMPTY;
                    case EOF:
                        this.endOfData = true; return EMPTY;
                    default:
                        return { offset: this.offsetLin, data: [] } } } };
        module.exports.Parser = Parser }, { "./data.js": 31, "./errors.js": 32 }],
    34: [function(require, module, exports) { var SettingsManager = require("./settings.js").SettingsManager;

        function ErrnoSettingsManager(settings) { SettingsManager.call(this, {}); var self = this;
            Object.getOwnPropertyNames(settings).forEach(function(k) { self.set(k, settings[k]) }) } ErrnoSettingsManager.prototype = Object.create(SettingsManager.prototype);
        ErrnoSettingsManager.prototype.set = function(key, value) { var val; if (!(value instanceof RetVal)) { throw Error("Expected a RetVal type or an array") } val = value.copy();
            val.name = key;
            SettingsManager.prototype.set.call(this, key, val) };
        ErrnoSettingsManager.prototype.child = function(obj) { var child = obj instanceof ErrnoSettingsManager ? obj : new ErrnoSettingsManager(obj); return SettingsManager.prototype.child.call(this, child) };
        ErrnoSettingsManager.prototype.parent = null; var uniqueId = 1;

        function RetVal(value, message, context, id) { this.name = null;
            this.value = value;
            this.message = message;
            this.context = context;
            this.id = id || uniqueId++ } RetVal.prototype = { copy: function(context) { var ret = new RetVal(this.value, this.message, context, this.id);
                ret.name = this.name; return ret }, shortMessage: function(context, state) { var safeContext = {};
                context = context || {};

                function populateSafelyWith(ctx) { Object.getOwnPropertyNames(ctx || {}).forEach(function(p) { safeContext[p] = ctx[p]; try { JSON.stringify(ctx[p]) } catch (e) { safeContext[p] = "<recursive>" } }) } populateSafelyWith(this.context);
                populateSafelyWith(context); return JSON.stringify({ name: this.name, val: this.value, state: state, context: safeContext }) } }; var errnoManager = new ErrnoSettingsManager({ SUCCESS: new RetVal(0, "Success"), UNKNOWN_ERROR: new RetVal(1, "Unknown error"), API_ERROR: new RetVal(1, "Unknown api error.") });

        function errno(obj) { return errnoManager.child(obj).obj() } module.exports.errnoManager = errnoManager;
        module.exports.errno = errno;
        module.exports.RetVal = RetVal }, { "./settings.js": 42 }],
    35: [function(require, module, exports) { var scheduler = require("./scheduler.js");

        function Event() { this.listeners = [];
            this.dispatcher = null;
            this.pollCb = null } Event.prototype = { poll: function(pollCb) { this.pollCb = pollCb; if (pollCb) { this.doPoll() } }, doPoll: function() { var self = this,
                    next = this.doPoll.bind(this),
                    dispatch = this.dispatch.bind(this);
                scheduler.setImmediate(function() { if (!self.pollCb || self.listeners.length == 0 || self.paused) { return } self.pollCb(next, dispatch) }) }, addListener: function(cb, config) { if (typeof cb !== "function" || this.listeners.some(function(l) { return l === cb })) { return } if (this.pollCb && this.listeners.length == 0) { scheduler.setImmediate(this.doPoll.bind(this)) } cb.forceAsync = !!(config || {}).forceAsync;
                this.listeners.push(cb) }, hasListener: function(cb) { return this.listeners.some(function(l) { return l === cb }) }, removeListener: function(cb) { this.listeners = this.listeners.filter(function(l) { return l !== cb }) }, dispatch: function(varArgs) { var args = [].slice.call(arguments),
                    self = this;
                this.listeners.some(function(l) {
                    function callListener() { if (!self.dispatcher) { return l.apply(null, args) } return self.dispatcher.apply(self, [l].concat(args)) } if (l.forceAsync) { scheduler.setImmediate(callListener); return } callListener() }) }, close: function() { this.listeners = [];
                this.poll(null) }, setDispatcher: function(cb) { this.dispatcher = cb }, modifyDispatcher: function(modifier) { var id = function(l) { return l.apply(null, [].slice.call(arguments, 1)) };
                this.dispatcher = modifier(this.dispatcher || id) } };

        function indirectEvent(parentEvent) { var ret = {};
            Object.defineProperty(ret, "listeners", { enumerable: true, get: function() { return this.__proto__.listeners } });
            ret.addListener = null;
            ret.removeListener = null;
            ret.__proto__ = parentEvent; return ret } module.exports.Event = Event;
        module.exports.IndirectEvent = indirectEvent }, { "./scheduler.js": 41 }],
    36: [function(require, module, exports) { var SerialIo = require("./serial.js").SerialIo,
            errors = require("./errors.js"),
            getLog = require("./../logging.js").getLog,
            Event = require("./../event.js").Event;

        function Buffer(connectionId, api) { var self = this;
            this.serial = new SerialIo(api);
            this.onError = new Event;
            this.serial.onReceiveError.addListener(function(connectionId, error) { if (connectionId !== self.state.connectionId) return;
                self.serial.flush(connectionId, function() { self.onError.dispatch(error) }) });
            this.log = getLog("Buffer");
            this.state = {};
            this.state.connectionId = connectionId;
            this.state.dataBuffer = [];
            this.onUpdate = new Event;
            this.serial.onReceive.addListener(function(connectionId, data) { if (self.state.connectionId != connectionId) return;
                self.receive(data) }) } Buffer.prototype = { setTolerateErrors: function(val) { if (val) { this.serial.tolerateErrorsOn[this.state.connectionId] = true; return } delete this.serial.tolerateErrorsOn[this.state.connectionId] }, update: function(conf) { if (this.closed) { this.onError.dispatch(errors.UPDATE_CLOSED_BUFFER); return } this.state.dataBuffer = conf.dataBuffer || this.state.dataBuffer }, dataBuffer: function() { if (this.closed) { this.onError.dispatch(errors.READ_CLOSED_BUFFER); return null } return this.state.dataBuffer }, receive: function(data) { if (this.closed) { this.onError.dispatch(errors.READ_CLOSED_BUFFER); return } this.state.dataBuffer = this.state.dataBuffer.concat(data);
                this.onUpdate.dispatch("received") }, close: function() { if (this.closed) { this.onError.dispatch(errors.CLOSE_CLOSED_BUFFER); return } this.log.log("Closing buffer");
                this.closed = true;
                this.serial.close();
                this.onUpdate.close() } };
        module.exports.Buffer = Buffer }, { "./../event.js": 35, "./../logging.js": 40, "./errors.js": 38, "./serial.js": 39 }],
    37: [function(require, module, exports) { var Buffer = require("./buffer.js").Buffer,
            SerialIo = require("./serial.js").SerialIo,
            errors = require("./errors.js"),
            Event = require("./../event.js").Event,
            getLog = require("./../logging.js").getLog,
            scheduler = require("./../scheduler.js"); var readerId = 0;

        function ReadOperation(buffer, decodeCb, finishCb, config, errorCb) { var self = this;
            this.closed = false;
            this.buffer = buffer;
            this.config = config || {};
            this.decodeCb = decodeCb;
            this.finishCallback = finishCb;
            this.id = readerId++;
            this.log = getLog("ReadOperation"); if (errorCb) { this.errorCb = errorCb } this.updateListener = function(type) { if (type != "received") return;
                self.gotBytes() }; var ttl = this.config.ttl || 2e3;
            this.log.log("read operation (id: ", this.id, "ttl:", ttl, ")");
            this.buffer.onUpdate.addListener(this.updateListener);
            this.timeoutHandle = scheduler.setTimeout(function() { self.log.log("Failed read operation (id: ", self.id, "ttl:", ttl, ").", "Tolerate:", !!self.config.tolerateReceiveErrors); if (self.config.tolerateReceiveErrors) { self.close();
                    self.finishCallback([]); return } self.close();
                self.errorCb(errors.READER_TIMEOUT) }, ttl); if (this.config.tolerateReceiveErrors) this.buffer.setTolerateErrors(true) } ReadOperation.prototype = { errorCb: function(retval) { throw Error(retval.shortMessage()) }, close: function() { if (this.closed) { return } this.log.log("Closing read operation");
                this.closed = true;
                scheduler.clearTimeout(this.timeoutHandle);
                this.buffer.setTolerateErrors(false);
                this.buffer.onUpdate.removeListener(this.updateListener) }, gotBytes: function() { if (this.closed) { this.errorCb(errors.MESSAGE_ON_CLOSED_READ_OPERTION); return } this.log.log("Buffer(decode config:", this.config, "):", this.buffer.dataBuffer()); var response = this.decodeCb(this.buffer.dataBuffer(), this.config.minPureData, this.config);
                this.buffer.update({ dataBuffer: response.dataBuffer }); if (!response.message) return;
                this.close();
                this.finishCallback(response.message) } }; var codecSocketUid = 0;

        function CodecSocket(connectionId, api) { var self = this;
            this.connectionId = connectionId;
            this.log = getLog("CodecSocket");
            this.refCount = 0;
            this.id = codecSocketUid++;
            this.onError = new Event;
            this.buffer = new Buffer(connectionId, api);
            this.buffer.onError.addListener(function() { self.onError.dispatch.apply(self.onError, arguments) });
            this.state = {};
            this.state.readOperation = null;
            this.closed = false } CodecSocket.prototype = { encode: function(data) { return data }, decode: function(dataBuffer, config) { return createFinalMessage([], dataBuffer.slice()) }, justWrite: function(data, cb, config) { var message = this.encode(data);
                this.log.log("Sending (", this.connectionId, "):", message);
                this.buffer.serial.send(this.connectionId, message, cb) }, writeThenRead: function(data, cb, config) { var self = this,
                    handle = function(ok, errResp) { if (ok) return; if (errResp.error && (config || {}).tolerateSendErrors) { self.log.warn("Send resp:", errResp);
                            self.state.readOperation.close();
                            cb([]); return } self.cancelRead();
                        self.onError.dispatch(errors.API_ERROR.copy({ method: "serial.send", sendResp: errResp })) }; if (this.state.readOperation && !this.state.readOperation.closed) { this.state.readOperation.close() } this.state.readOperation = new ReadOperation(this.buffer, this.decode.bind(this), cb, config, self.onError.dispatch.bind(self.onError));
                this.justWrite(data, handle) }, cancelRead: function() { this.state.readOperation.close() }, drain: function(cb) { var self = this; if (this.closed) { this.onError.dispatch(errors.DRAIN_CLOSED_CODEC); return } self.buffer.update({ dataBuffer: [] });
                cb() }, close: function() { if (this.closed) { return } this.log.log("Closing socket");
                this.closed = true;
                this.refCount = 0; if (this.state.readOperation && !this.state.readOperation.closed) this.state.readOperation.close();
                this.buffer.close() }, ref: function() { if (this.closed) return;
                this.log.log("Referencing socket:", this.id, "(refcount", this.refCount, ")");
                this.refCount++ }, unref: function() { if (this.closed) return;
                this.log.log("Unreferencing socket:", this.id, "(refcount", this.refCount, ")"); if (--this.refCount <= 0) { this.log.log("Refcount 0 for socket:", this.id);
                    this.close() } } };

        function createFinalMessage(dataBuffer, message) { return { dataBuffer: dataBuffer, message: message } }

        function createBadMessage(dataBuffer, offset, errorMessage) { return { dataBuffer: dataBuffer, message: null, errorMessage: errorMessage, offset: offset } } module.exports.createFinalMessage = createFinalMessage;
        module.exports.createBadMessage = createBadMessage;
        module.exports.CodecSocket = CodecSocket }, { "./../event.js": 35, "./../logging.js": 40, "./../scheduler.js": 41, "./buffer.js": 36, "./errors.js": 38, "./serial.js": 39 }],
    38: [function(require, module, exports) { var errno = require("./../errno.js").errno,
            RetVal = require("./../errno.js").RetVal; var errors = { UPDATE_CLOSED_BUFFER: new RetVal(20222, "Tried to update closed buffer."), READ_CLOSED_BUFFER: new RetVal(20223, "Tried to read from closed buffer."), RECEIVED_ON_CLOSED_BUFFER: new RetVal(20224, "Tried to write to closed buffer."), CLOSE_CLOSED_BUFFER: new RetVal(20225, "Tried to close closed buffer."), CLOSING_CLOSED_SERIAL: new RetVal(20220, "Serial transaction was already closed."), READER_TIMEOUT: new RetVal(2e4, "Reader timed out"), CLOSE_CLOSED_READ_OPERATION: new RetVal(20226, "Closing closed read operation."), SERIAL_RECEIVE_ERROR: new RetVal(20230, "Serial receive error"), DRAIN_CLOSED_CODEC: new RetVal(20228, "Draining a closed codec"), PROGRAM_TOO_LARGE: new RetVal(20090, "Tried to flash too large a program"), MESSAGE_ON_CLOSED_READ_OPERTION: new RetVal(20227, "Got message on closed read operation."), SENDING_ON_CLOSED_SERIAL: new RetVal(20221, "Serial transaction was closed."), LISTENER_REGISTRATION_TIMEOUT: new RetVal(20222, "Listeners took too long to get registered to the backend.") };
        ["disconnected", "timeout", "device_lost", "break", "frame_error", "overrun", "buffer_overflow", "parity_error", "system_error"].forEach(function(err, i) { errors["API_ERROR_" + err] = new RetVal(202220 + i, "Got error from api:" + err) });
        module.exports = errno(errors) }, { "./../errno.js": 34 }],
    39: [function(require, module, exports) { var util = require("./../util.js"),
            errors = require("./errors.js"),
            getLog = require("./../logging.js").getLog,
            scheduler = require("./../scheduler.js"),
            Event = require("./../event.js").Event;

        function errorLookup(err) { var error = errors["API_ERROR_" + err]; if (!error) return errors.UNKNOWN_ERROR; return error }

        function SerialIo(api) { var self = this;
            this.log = getLog("SerialIo");
            this.api = api;
            this.onReceive = new Event;
            this.onReceiveError = new Event;
            this.tolerateErrorsOn = {};
            this.handlers = { onReceiveErrorCb: function _onReceiveErrorCb(err) { if (self.tolerateErrorsOn[err.connectionId]) { self.onReceive.dispatch(err.connectionId, []); return } self.onReceiveError.dispatch(err.connectionId, errorLookup(err.error)) }, onReceiveCb: function(rcv) { var data = util.bufToBin(rcv.data);
                    self.log.log("Received:", data);
                    self.onReceive.dispatch(rcv.connectionId, data) } };
            this.api.onReceiveError.addListener(this.handlers.onReceiveErrorCb);
            this.api.onReceive.addListener(this.handlers.onReceiveCb) } SerialIo.prototype = { send: function(connectionId, data, cb, retries) { var self = this;
                retries = typeof retries === "number" ? retries : 100; if (retries <= 0) { this.onReceiveError.dispatch(errors.LISTENER_REGISTRATION_TIMEOUT); return } if (this.closed) { this.onReceiceError.dispatch(errors.SENDING_ON_CLOSED_SERIAL); return } if (!this.api.onReceive.hasListener || !this.api.onReceiveError.hasListener || this.api.onReceive.hasListener(this.handlers.onReceiveCb) && this.api.onReceive.hasListener(this.handlers.onReceiveCb)) { this.sendUnsafe(connectionId, data, cb, retries--); return } scheduler.setTimeout(function() { self.send(connectionId, data, cb) }) }, sendUnsafe: function(connectionId, data, cb) { if (data.length <= 0) { cb(true); return } var realData = util.binToBuf(data),
                    self = this;
                this.api.send(connectionId, realData, function(resp) { if (!resp || resp.bytesSent <= 0 || resp.error) { cb(false, resp); return } self.sendUnsafe(connectionId, data.slice(resp.bytesSent), cb) }) }, flush: function(connectionId, cb) { this.api.flush(connectionId, cb) }, close: function() { if (this.closed) { this.onReceiveError(errors.CLOSING_CLOSED_SERIAL); return } this.log.log("Closing serial");
                this.closed = true;
                this.onReceive.close();
                this.onReceiveError.close();
                this.log.log("Removing onReceive and onReceiveError listeners");
                this.api.onReceiveError.removeListener(this.handlers.onReceiveErrorCb);
                this.api.onReceive.removeListener(this.handlers.onReceiveCb) } };
        module.exports.SerialIo = SerialIo }, { "./../event.js": 35, "./../logging.js": 40, "./../scheduler.js": 41, "./../util.js": 54, "./errors.js": 38 }],
    40: [function(require, module, exports) {
        (function(global) {
            var dbg = console.log.bind(console),
                NODEJS = global.window !== global,
                toSettings = require("./settings.js").toSettings,
                consoleSettings = toSettings({ verbosity: 0, logger: "default" }),
                settings = require("./settings.js").settings;
            require("./settings.js").corelibSettings.addParent(consoleSettings);

            function ModifiedConsole(console) { this.console = console;
                this.setConsoleMethod("error");
                this.setConsoleMethod("warn");
                this.setConsoleMethod("info");
                this.setConsoleMethod("log");
                this.setConsoleMethod("debug") } ModifiedConsole.prototype = {
                setConsoleMethod: function(type) {
                    var self = this;
                    Object.defineProperty(this, type, { get: function() { return self.consoleMethod(Function.prototype.bind.call(self.console[type], self.console), type) } })
                },
                consoleMethod: function(origMethod, name) { return origMethod }
            };

            function ConditionalConsole(console) { ModifiedConsole.call(this, console) } ConditionalConsole.prototype = Object.create(ModifiedConsole.prototype);
            ConditionalConsole.prototype.consoleMethod = function(origLog, name) { if (this.shouldCall(origLog, name)) return origLog; return function() {} };
            ConditionalConsole.prototype.shouldCall = function(origLog, name) { return true };

            function VerbosityConsole(console) { ConditionalConsole.call(this, console);
                this.typeThresholds = { error: 0, warn: 1, info: 2, log: 3, debug: 4 } } VerbosityConsole.prototype = Object.create(ConditionalConsole.prototype);
            VerbosityConsole.prototype.verbosity = function() { if (typeof this.verbosity === "number") return this.verbosity; return settings.get("verbosity") };
            VerbosityConsole.prototype.shouldCall = function(origLog, name) { var threshold = this.typeThresholds[name]; return this.verbosity() >= threshold && !NODEJS };

            function PrefixConsole(prefix, console) { ModifiedConsole.call(this, console);
                this.prefix = prefix } PrefixConsole.prototype = Object.create(ModifiedConsole.prototype);
            PrefixConsole.prototype.consoleMethod = function(origLog) { var ol = ModifiedConsole.prototype.consoleMethod.call(this, origLog); return ol.bind(null, "[" + this.getPrefix() + "]") };
            PrefixConsole.prototype.getPrefix = function() { return this.prefix };

            function PrefixTimestampConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimestampConsole.prototype = Object.create(PrefixConsole.prototype);
            PrefixTimestampConsole.prototype.getPrefix = function() { return this.timestampString() + ":" + this.prefix };
            PrefixTimestampConsole.prototype.timestampString = function() { var date = this.getDate(); var pad = function(n) { if (n < 10) { return "0" + n } return n }; return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "." + this.zeroFill(date.getMilliseconds(), 3) };
            PrefixTimestampConsole.prototype.zeroFill = function(number, width) { width -= number.toString().length; if (width > 0) { return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number } return number + "" };
            PrefixTimestampConsole.prototype.getDate = function() { return new Date };

            function PrefixTimediffConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimediffConsole.prototype = Object.create(PrefixTimestampConsole.prototype);
            PrefixTimediffConsole.prototype.lastLogTime = Date.now();
            PrefixTimediffConsole.prototype.getDate = function() { var proto = Object.getPrototypeOf(this),
                    time = Date.now() - proto.lastLogTime;
                proto.lastLogTime = Date.now(); return new Date(time + (new Date).getTimezoneOffset() * 6e4) };
            var loggers = { "default": function(prefix) { return new VerbosityConsole(new PrefixTimestampConsole(prefix, global.console)) }, timediff: function(prefix) { return new VerbosityConsole(new PrefixTimediffConsole(prefix, global.console)) } };

            function getLog(prefix) { return (loggers[settings.get("logger")] || loggers["default"])(prefix) } module.exports.getLog = getLog
        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, { "./settings.js": 42 }],
    41: [function(require, module, exports) {
        (function(global) { var NO_DOM = !(global.removeEventListener && global.addEventListener && global.postMessage),
                TESTING = typeof global.it === "function" && typeof global.describe === "function";

            function WaitHelperDom(waiter) { this.waiter = waiter } WaitHelperDom.prototype = { maybeListen: function() { if (this.domListener) return; var self = this;
                    this.domListener = function(ev) { if (ev.source !== window) return; var data = ev.data; if (!data || !(data instanceof Object) || data.waiterId != self.waiter.id) return;
                        self.guard() };
                    global.addEventListener("message", this.domListener, true) }, due: function() { if (typeof this.due === "number") return this.due; return this.waiter.due }, guard: function() { if (this.due() > this.waiter.async.now()) { this.wait(); return } this.close();
                    this.waiter.guard() }, close: function() { if (!this.domListener) return;
                    global.removeEventListener("message", this.domListener);
                    this.domListener = null }, wait: function(ms) { if (typeof ms === "number") this.due = this.waiter.async.now() + ms;
                    this.maybeListen();
                    global.postMessage({ waiterId: this.waiter.id }, "*") } };

            function WaitHelperJs(waiter) { this.waiter = waiter } WaitHelperJs.prototype = { close: function() { if (!this.handle) return;
                    global.clearTimeout(this.handle);
                    this.handle = null }, wait: function(ms) { var self = this,
                        time = typeof ms === "number" ? ms : this.waiter.due - this.waiter.async.now();
                    this.handle = global.setTimeout(function() { self.waiter.guard() }, time) } }; var waiterIds = 1;

            function Waiter(cb, due, async) { this.cb = cb;
                this.due = due;
                this.async = async;
                this.onClose = null;
                this.closed = false;
                this.id = waiterIds++ } Waiter.prototype = { setHelper: function(helper) { if (this.helper) this.helper.close();
                    this.helper = helper; return helper }, guard: function() { if (this.closed) return; var tl = this.due - this.async.now(); if (tl < 0) { this.close();
                        this.cb(); return } this.run() }, run: function() { if (this.closed) return null; var self = this; if (this.due - this.async.now() >= 1e3 || NO_DOM) { this.setHelper(new WaitHelperJs(this)) } else { this.setHelper(new WaitHelperDom(this)) } this.helper.wait(); return this }, close: function() { if (this.closed) return;
                    this.closed = true;
                    this.setHelper(null); if (this.onClose) this.onClose();
                    this.onClose = null }, quickRun: function() { if (this.closed) return null;
                    this.setHelper(new WaitHelperJs(this)).wait(0); return this } };

            function Async() { this.index = new WaiterIndex } Async.prototype = { wait: function(cb, due) { return new Waiter(cb, due, this) }, postpone: function(cb) { new Waiter(cb, this.now(), this) }, now: function() { return Date.now() }, setTimeout: function(cb, to) { return this.index.put(this.wait(cb, (to || 0) + this.now()).run()) }, clearTimeout: function(id) { this.index.rm(id) }, clearImmediate: function(id) { return this.clearTimeout(id) }, setImmediate: function(cb) { return this.setTimeout(cb, 0) } };

            function TestAsync() { this.index = new WaiterIndex;
                this.offset = 0;
                this.capHandle = null } TestAsync.prototype = Object.create(Async.prototype);
            TestAsync.prototype.idleCap = function() { var waiter = this.index.minDue(); if (waiter === null) { if (this.onEnd) this.onEnd();
                    this.capHandle = null; return } this.changeClock(waiter.due);
                waiter.quickRun();
                this.idleRenew() };
            TestAsync.prototype.idleRenew = function() { var self = this; if (!this.capHandle) this.capHandle = global.setTimeout(function() { self.capHandle = null;
                    self.idleCap() }) };
            TestAsync.prototype.changeClock = function(ms) { this.offset = ms - Date.now() };
            TestAsync.prototype.now = function() { return Date.now() + this.offset };
            TestAsync.prototype.setTimeout = function(cb, ms) { if (!cb) throw Error("Excpected a callback but got" + cb);
                this.idleRenew(); return this.index.put(this.wait(cb, (ms || 0) + this.now())) };

            function WaiterIndex() { this.db = {} } WaiterIndex.prototype = { put: function(obj) { this.rm(obj.id);
                    this.db[obj.id] = obj;
                    obj.onClose = this.rm.bind(this, obj.id); return obj.id }, get: function(id) { return this.db[id] }, rm: function(id) { var waiter = this.db[id]; if (!waiter) return;
                    waiter.close();
                    this.rawDel(id) }, rawDel: function(id) { delete this.db[id] }, minDue: function() { var self = this,
                        keys = Object.getOwnPropertyNames(this.db); if (keys.length > 0) { var minkey = keys.reduce(function(mink, k) { var cand = self.db[k],
                                min = self.db[mink]; if (!min) return min; if (min.due < cand.due) return mink; if (min.due == cand.due && min.id < cand.id) return mink; return k }); return this.get(minkey) } return null }, array: function() { var self = this; return Object.getOwnPropertyNames(this.db).map(function(k) { return self.db[k] }) }, length: function() { return Object.getOwnPropertyNames(this.db).length } }; if (TESTING) { module.exports = new TestAsync } else { module.exports = new Async } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    42: [function(require, module, exports) {
        (function(global) {
            function DynamicSetting(cb) { this.cb = cb } DynamicSetting.prototype = { _isDynamicSetting: true };

            function SettingsManager(settings) { this.settings = settings;
                this.default = null } SettingsManager.prototype = { _isSettingsManager: true, set: function(key, value) { this.settings[key] = value }, get: function(key, _default) { if (!this.has(key)) { if ([].slice.call(arguments).length == 1) { return this.default } return _default } var ret = this.settings[key]; if (ret && ret._isDynamicSetting) return ret.cb(); return ret }, keys: function() { return Object.getOwnPropertyNames(this.settings) }, obj: function() { var dic = {},
                        self = this;
                    this.keys().reverse().forEach(function(k) { dic[k] = self.get(k) }); return dic }, has: function(key) { return Object.hasOwnProperty.call(this.settings, key) }, parent: function(settings) { return new MuxSettingsManager([this, toSettings(settings)]) }, child: function(settings) { return new MuxSettingsManager([toSettings(settings), this]) } };

            function GetSettingsManager() { this.prefix = "babelfish_";
                this.settings = this.updatedSettings(); if (this.settings.managers) debugger } GetSettingsManager.prototype = Object.create(SettingsManager.prototype);
            GetSettingsManager.prototype.set = function() { throw Error("Cont'set to settings manager based on GET") };
            GetSettingsManager.prototype.get = function(key, _default) { return SettingsManager.prototype.get.call(this, key.toLowerCase(), _default) };
            GetSettingsManager.prototype.has = function(key) { return SettingsManager.prototype.has.call(this, key.toLowerCase()) };
            GetSettingsManager.prototype.updatedSettings = function() { var self = this,
                    dic = {},
                    get = global.window && window.location && window.location.search && window.location.search.split("?" + this.prefix)[1] || null; if (get !== null) { get.split("&" + this.prefix).forEach(function(g) { var s = g.split("=");
                        dic[s[0].toLowerCase()] = self.parseValue(s[1]) }) } return dic };
            GetSettingsManager.prototype.parseValue = function(val) { try { return JSON.parse(val) } catch (e) { return val } };

            function MuxSettingsManager(lst) { this.managers = lst } MuxSettingsManager.prototype = Object.create(SettingsManager.prototype);
            MuxSettingsManager.prototype.has = function(key) { return this.managers.some(function(m) { return m.has(key) }) };
            MuxSettingsManager.prototype.addParent = function(manager) { this.managers.push(manager); return this }, MuxSettingsManager.prototype.addChild = function(manager) { this.managers = [toSettings(manager)].concat(this.managers); return this }, MuxSettingsManager.prototype.keys = function() { var dic = {}; for (var i = this.managers.length - 1; i >= 0; i--) { this.managers[i].keys().reverse().forEach(function(k) { dic[k] = null }) } return Object.getOwnPropertyNames(dic) };
            MuxSettingsManager.prototype.get = function(key, _default) { for (var i = 0; i < this.managers.length; i++) { var m = this.managers[i]; if (!m.has(key)) continue; return m.get(key) } if ([].slice.call(arguments).length == 1) { return this.default } return _default };
            MuxSettingsManager.prototype.set = function(keu, value) { throw Error("Can't set to multiplexing settings manager") };

            function toSettings(obj) { if (typeof obj !== "object") return new SettingsManager({}); if (obj._isSettingsManager) return obj; return new SettingsManager(obj) } global.babelfishSettings = global.babelfishSettings || {};
            global._corelibSettings = global._corelibSettings || new MuxSettingsManager([]), global._defaultSettings = global._defaultSettings || new MuxSettingsManager([]), global._browserSettings = global._browserSettings || (new GetSettingsManager).child(global.babelfishSettings);

            function ExternalSettings(dfs) { MuxSettingsManager.call(this, [global._browserSettings, dfs, global._corelibSettings]) } ExternalSettings.prototype = Object.create(MuxSettingsManager.prototype);
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.appendDefault = function(setting) { this.defaultSettings().addChild(setting); return this };
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.defaultSettings = function() { return this.managers[1] };
            global._externalSettings = global._externalSettings || new ExternalSettings(global._defaultSettings);
            module.exports.settings = global._externalSettings;
            module.exports.corelibSettings = global._corelibSettings;
            module.exports.defaultSettings = global._defaultSettings;
            module.exports.toSettings = toSettings;
            module.exports.DynamicSetting = DynamicSetting;
            module.exports.SettingsManager = SettingsManager;
            module.exports.GetSettingsManager = GetSettingsManager;
            module.exports.MuxSettingsManager = MuxSettingsManager }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    43: [function(require, module, exports) { var scheduler = require("./scheduler.js"),
            getUniqueId = require("./util.js").getUniqueId,
            toSettings = require("./settings.js").toSettings; var COMMON = 1,
            LEONARDO = 1,
            SERIAL_RESET = 1;

        function showArray(arr) { if (arr.length >= 5) { return "[" + arr.length + " items]" } return arr.reduce(function(ret, it) { if (typeof it === "string") return ret + ' "' + it + '"'; var val = show(it); if (!val) return ret; return ret + " " + val }, "") }

        function show(obj) { if (typeof obj === "function") { return null } if (obj instanceof Array) { return showArray(obj) } if (typeof obj === "string") { return obj } try { var str = JSON.stringify(obj); if (str.length < 100) { return str } } catch (e) { return obj + "" } }

        function Status(message, timestamp, id, context) { this.context = context || null;
            this.message = message;
            this.timestamp = timestamp || null;
            this.id = typeof id === "number" ? id : getUniqueId("status") } Status.prototype = { toCrazyLog: function() { return { isCrazyLog: true, metadata: this.toString() } }, copy: function(context) { return new Status(this.message, scheduler.now(), this.id, context || this.context) }, toString: function() { var ctx = this.context || {}; return Object.getOwnPropertyNames(ctx).reduce(function(ret, key) { return ret.replace("{" + key + "}", show(ctx[key])) }, this.message) } }; var statusManager = toSettings({});

        function status(obj) { return statusManager.child(obj).obj() } module.exports.Status = Status;
        module.exports.statusManager = statusManager;
        module.exports.status = status }, { "./scheduler.js": 41, "./settings.js": 42, "./util.js": 54 }],
    44: [function(require, module, exports) {
        function getKey(obj, val) { if (typeof obj !== "object" || !obj) return null; var keys = Object.getOwnPropertyNames(obj); for (var i = 0; i < keys.length; i++) { var key = keys[i]; if (obj[key] === val) return key } return null }

        function getPosition(obj, fn) { var it = obj,
                key = getKey(it, fn); while (!key && it) { it = it.__proto__;
                key = getKey(it, fn) } if (it && key) return { object: it, key: key }; return null }

        function Super() {} Super.prototype = { getSuper: function(selfFn) { var pos = getPosition(this, selfFn),
                    sup; if (!pos) return null;
                sup = Object.create(Object.getPrototypeOf(pos.object)); return sup[pos.key] }, superApply: function(method, args) { var fn = this.getSuper(method); if (!fn) return null; return fn.apply(this, args) }, superCall: function(fn, varArgs) { return this.superApply(fn, [].slice.call(arguments, 1)) }, superBind: function(fn, varArgs) { return this.superApply.bind(this, fn, [].slice.call(arguments, 1)) } };
        module.exports.Super = Super }, {}],
    45: [function(require, module, exports) { var errno = require("./../../errno.js").errno,
            RetVal = require("./../../errno.js").RetVal;
        module.exports = errno({ CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."), DISCONNECT_FAIL: new RetVal(20099, "Failed to disconnect from serial") }) }, { "./../../errno.js": 34 }],
    46: [function(require, module, exports) { var errors = require("./errors.js"),
            scheduler = require("./../../scheduler.js");

        function ConnectionManager(transaction) { this.transaction = transaction } ConnectionManager.prototype = { openDevice: function(dev, speed, msg, cb) { var self = this,
                    api = this.transaction.config.api;
                api.serial.connect(dev, { bitrate: speed, name: dev }, function(info) { if (!info) { self.transaction.errCb(errors.CONNECTION_FAIL); return } self.transaction.setConnectionId(info.connectionId);
                    cb(info.connectionId) }) }, closeDevice: function(cb) { var api = this.transaction.config.api,
                    cid = this.transaction.getConnectionId(),
                    self = this; if (!cid) { scheduler.setTimeout(cb); return } api.serial.disconnect(cid, function(ok) { if (!ok) { self.transaction.errCb(errors.DISCONNECT_FAIL); return } cb() }) } };
        module.exports.ConnectionManager = ConnectionManager }, { "./../../scheduler.js": 41, "./errors.js": 45 }],
    47: [function(require, module, exports) { var errno = require("./../errno.js").errno,
            RetVal = require("./../errno.js").RetVal;
        module.exports = errno({ IDLE_HOST: new RetVal(1, "Host seems dead."), CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."), DISCONNECT_FAIL: new RetVal(1, "Failed generic disconnect."), READ_ERROR: new RetVal(2e5, "There was an error reading"), FORCE_DISCONNECT_FAIL: new RetVal(20006, "Failed to nuke open connections on port"), UNDEFINED_COMMAND_PREFIX: new RetVal(202101, "Did not define the command prefix."), CLAIM_INTERFACE: new RetVal(20171, "Failed to claim interface."), LIST_INTERFACES: new RetVal(20170, "Failed to get usb interface list."), DEVICE_DETECTION: new RetVal(20172, "Chrome app doesn't have device registered."), GET_DEVICES: new RetVal(20094, "Failed to list serial devices."), NO_DEVICE: new RetVal(20173, "Couldn't find a suitable device to connect."), OPEN_USB_DEVICE: new RetVal(20174, "Failed to open usb device."), NO_SOCKET: new RetVal(202175, "Socket was lost."), TRANSFER_ERROR: new RetVal(202102, "Libusb failed to execute command.") }) }, { "./../errno.js": 34 }],
    48: [function(require, module, exports) { var scheduler = require("./../scheduler.js"),
            errno = require("./errors.js"),
            status = require("./status.js"),
            Event = require("./../event.js").Event,
            Super = require("./../super.js").Super,
            getLog = require("./../logging.js").getLog;

        function TransitionConfig(conf) { conf = conf || {};
            this.state = conf.state;
            this.fallbackCb = conf.fallbackCb || function(cb) { cb() };
            this.isRetry = conf.isRetry || false;
            this.waitBefore = null; if (typeof conf.waitBefore === "number") { this.waitBefore = conf.waitBefore } this.retryInterval = typeof conf.retryInterval === "number" ? conf.retryInterval : 500;
            this.retries = conf.retries || 3;
            this.args = conf.args instanceof Array ? conf.args.slice() : [] } TransitionConfig.prototype = { copy: function() { return new TransitionConfig(this) }, doFallback: function(doTransition) { var ret = this.copy();
                ret.isRetry = true;
                ret.retries--; if (ret.retries > 0) { var args = [doTransition.bind(null, ret)].concat(this.args);
                    scheduler.setTimeout(function _errorFallback() { ret.fallbackCb.apply(null, args) }, ret.retryInterval); return true } return false } };

        function FiniteStateMachine(config, finishCallback, errorCallback, parent) { this.init.apply(this, arguments) } FiniteStateMachine.prototype = Object.create(Super.prototype);
        FiniteStateMachine.prototype.init = function(config, finishCallback, errorCallback, parent) { var self = this;
            this.state = null;
            this.onStatusChange = new Event;
            this.onClose = new Event;
            this.onStatusChange.setDispatcher(function(fn, status, context) { if (status.timestamp) { fn(status); return } fn(status.copy(context)) });
            this.stateHistory = [];
            this.context = {};
            this.dead_ = false;
            this.parentState = null; if (parent) {
                function closeListner() { self.cleanup(function() {}) }

                function statusChangePropagate(status, context) { self.parentState.parent.onStatusChange.dispatch(status, context) } this.parentState = { parent: parent };
                this.parentState.listeners = {};
                this.parentState.parent.onClose.addListener(closeListner);
                this.onStatusChange.addListener(statusChangePropagate);
                this.parentState.listeners.closeListner = closeListner } this.config = config || {};
            this.idleTimeout = typeof this.config.idleTimeout === "undefined" ? 2e4 : this.config.idleTimeout;
            this.finishCallback = function _fsmFinishCb() { finishCallback.apply(null, [].slice.call(arguments)) };
            this.errorCallback = function _fsmErrorCb() { errorCallback.apply(null, [].slice.call(arguments)) };
            this.previousErrors = [];
            this.log = getLog("FSM") };
        FiniteStateMachine.prototype.setStatus = function(status, context) { this.onStatusChange.dispatch(status, context) };
        FiniteStateMachine.prototype.dead = function() { if (this.parentState) return this._dead || this.parentState.parent.dead(); return this._dead }, FiniteStateMachine.prototype.child = function(type, cb) { return new type(this.config, cb, this.errCb.bind(this), this) };
        FiniteStateMachine.prototype.refreshTimeout = function() { var self = this; if (this.parentState) { this.parentState.parent.refreshTimeout(); return } if (this.timeout) { scheduler.clearTimeout(this.timeout);
                this.timeout = null } this.timeout = scheduler.setTimeout(function _fsmIdleHost() { self.finalError(errno.IDLE_HOST, { timeout: self.idleTimeout }) }, this.idleTimeout) };
        FiniteStateMachine.prototype.errCb = function(retval, context) { var self = this,
                retryConf = null,
                ctx = context || {};
            this.log.warn("Received error:", retval); if (this.lastTransition && this.lastTransition.doFallback(this.transitionConf.bind(this))) { return } this.finalError(retval, ctx) };
        FiniteStateMachine.prototype.finalError = function(retval, context) { var self = this;
            this.onClose.dispatch(); if (this.parentState) { this.cleanup(function() { self.log.log("Propagating error to parent:", self, "->", self.parentState.parent);
                    self.parentState.parent.errCb(retval, context) }); return } if (this.previousErrors.length > 0) { this.log.warn("Previous errors", this.previousErrors); return } context = context || {}; if (retval.context) { context.retValContext = retval.context } if (this.config && this.config.api && this.config.api.runtime && this.config.api.runtime.lastError) { context.apiLastError = this.config.api.runtime.lastError;
                this.log.warn("LastError:", this.config.api.runtime.lastError) } var state = this.lastTransition ? this.lastTransition.state : "<unknown>";
            this.lastTransition = null;
            this.log.error("[ERROR:" + state + "]", retval.name, "(" + retval.value + "):", retval.message);
            this.log.error("Context:", context, "last transition:", this.lastTransition);
            this.previousErrors.push(retval.copy(context));
            this.log.log(retval.message, context);
            scheduler.setTimeout(function _fsmFinalError() { self.cleanup(function() { if (self.errorCallback) { scheduler.setTimeout(self.errorCallback.bind(self, retval.value, retval.shortMessage(context, state))); return } }) }) };
        FiniteStateMachine.prototype.transitionConf = function(conf) { var self = this; if (this.dead()) { if (!this.blockedStates || this.blockedStates.length >= 10) { var states = (this.blockedStates || [conf.state]).toString();
                    this.setStatus(status.BLOCKING_STATES, { states: states });
                    this.blockedStates = [] } else { this.blockedStates.push(conf.state) } this.log.log("Jumping to state '", conf.state, "' arguments:", conf.args, "BLOCKED", this.dead_ ? "(dead parent)" : "(dead)"); return } this.refreshTimeout();
            this.lastTransition = conf; if (typeof this[conf.state] !== "function") { throw Error(conf.state + " transition not available.") } if (typeof conf.waitBefore !== "number" || conf.isRetry) { this.log.log("Jumping '" + conf.state + "' (immediate) arguments:", conf.args);
                self.setStatus(status.TRANSITION, { state: conf.state, args: conf.args });
                this[conf.state].apply(this, conf.args); return } scheduler.setTimeout(function _jumpToState() { self.log.log("Jumping '" + conf.state + "' (delay: ", conf.waitBefore, ") arguments:", conf.args);
                self.setStatus(status.TRANSITION, { state: conf.state, args: conf.args });
                self[conf.state].apply(self, conf.args) }, conf.waitBefore) };
        FiniteStateMachine.prototype.transition = function(stateOrConf, varArgs) { var args = [].slice.call(arguments, 1),
                conf; if (typeof stateOrConf == "string") { conf = new TransitionConfig({ state: stateOrConf, args: args }) } else { conf = new TransitionConfig(stateOrConf); if (args.length > 0) { conf.args = args } } return this.transitionConf(conf) };
        FiniteStateMachine.prototype.transitionCb = function(stateOrConf, varArgs) { var self = this,
                allArgs = [].slice.call(arguments); return function() { var newArgs = [].slice.call(arguments);
                self.transition.apply(self, allArgs.concat(newArgs)) } };
        FiniteStateMachine.prototype.cleanup = function(callback) { if (this._dead) { return } this._dead = true; if (this.parentState) { this.parentState.parent.onClose.removeListener(this.parentState.listeners.closeListner) } this.onClose.dispatch();
            this.onClose.close();
            callback = callback || this.finishCallback.bind(this); if (this.timeout) { this.log.log("Stopping timeout");
                scheduler.clearTimeout(this.timeout) } this.timeout = null;

            function doCleanup() { scheduler.clearTimeout(emergencyCleanupTimeout);
                callback() } var emergencyCleanupTimeout = scheduler.setTimeout(doCleanup, 1e4);
            this.localCleanup(doCleanup) };
        FiniteStateMachine.prototype.localCleanup = function(cb) { scheduler.setTimeout(function _localCleanupCb() { cb() }) };
        module.exports.FiniteStateMachine = FiniteStateMachine }, { "./../event.js": 35, "./../logging.js": 40, "./../scheduler.js": 41, "./../super.js": 44, "./errors.js": 47, "./status.js": 51 }],
    49: [function(require, module, exports) { var forEachWithCallback = require("./../util").forEachWithCallback,
            getLog = require("./../logging.js").getLog,
            SocketTransaction = require("./sockettransaction.js").SocketTransaction,
            ConnectionManager = require("./connection/manager.js").ConnectionManager,
            errors = require("./errors.js");

        function SerialTransaction(config, finishCallback, errorCallback, parent) { if (typeof config.avoidTwiggleDTR === "undefined") config.avoidTwiggleDTR = true;
            this.init.apply(this, arguments) } SerialTransaction.prototype = Object.create(SocketTransaction.prototype);
        SerialTransaction.prototype.init = function _init(config, finishCallback, errorCallback, parent) { this.superApply(_init, arguments);
            this.log = getLog("SerialTransaction");
            this.connectionManager = this.connectionManager || new ConnectionManager(this) };
        SerialTransaction.prototype.smartOpenDevice = function(device, speed, msg, cb) { this.connectionManager.openDevice(device, speed, msg, cb) };
        SerialTransaction.prototype.localCleanup = function _localCleanup(callback) { var self = this;
            this.disconnect(function() { self.superCall(_localCleanup, callback) }) };
        SerialTransaction.prototype.disconnect = function(callback) { this.connectionManager.closeDevice(callback) };
        SerialTransaction.prototype.destroyOtherConnections = function(name, cb) { var self = this;
            this.serial.getConnections(function(cnx) { forEachWithCallback(cnx, function(c, next) { if (c.name != name) { next(); return } self.log.log("Closing connection ", c.connectionId);
                    self.serial.disconnect(c.connectionId, function(ok) { if (!ok) { self.errCb(errors.FORCE_DISCONNECT_FAIL, { device: name }) } else { self.log.log("Destroying connection:", c.connectionId);
                            self.serial.onReceiveError.forceDispatch({ connectionId: c.connectionId, error: "device_lost" });
                            next() } }) }, cb) }) };
        SerialTransaction.prototype.cmdChain = function(chain, cb) { if (chain.length == 0) { cb(); return } this.cmd(chain.shift(), this.cmdChain.bind(this, chain, cb)) };
        module.exports.SocketTransaction = SocketTransaction;
        module.exports.SerialTransaction = SerialTransaction }, { "./../logging.js": 40, "./../util": 54, "./connection/manager.js": 46, "./errors.js": 47, "./sockettransaction.js": 50 }],
    50: [function(require, module, exports) { var FiniteStateMachine = require("./fsm.js").FiniteStateMachine,
            errors = require("./errors.js"),
            getLog = require("./../logging.js").getLog;

        function SocketTransaction(config, finishCallback, errorCallback, parent) { this.init.apply(this, arguments) } SocketTransaction.prototype = Object.create(FiniteStateMachine.prototype);
        SocketTransaction.prototype.init = function _init(config, finishCallback, errorCallback, parent) { this.superApply(_init, arguments);
            this.boundErrCb = this.errCb.bind(this);
            this._codecsocket = null;
            this.parentErrCb = Object.getPrototypeOf(SocketTransaction.prototype).errCb;
            this.log = getLog("SocketTransaction");
            this.block = false;
            this.config = config;
            this.serial = this.config.api.serial };
        SocketTransaction.prototype.errCb = function(err, ctx) { var self = this,
                context = ctx || {}; if (!this.serial || !this._codecsocket) { this.parentErrCb(err, ctx); return } context.initalLastError = this.config && this.config.api && this.config.api.runtime && this.config.api.runtime.lastError;
            this.serial.getConnections(function(cnx) { var currentConnection = null;
                cnx.forEach(function(c) { if (c.connectionId == self.getConnectionId()) currentConnection = c }); if (!currentConnection) { context.lostConnection = true;
                    context.currentConnection = self.getConnectionId();
                    context.availableConnections = cnx.map(function(c) { return c.connectionId });
                    self.finalError(err, context); return } self.serial.getDevices(function(devs) { var devVisible = devs.some(function(d) { return currentConnection.name == d.path }); if (!devVisible) { context.lostDevice = true;
                        context.visibleDevs = devs;
                        context.currentDev = currentConnection && currentConnection.name;
                        self.finalError(err, context); return } self.parentErrCb(err, ctx) }) }) };
        SocketTransaction.prototype.localCleanup = function _localCleanup(callback) { this.setConnectionId(null);
            this.superCall(_localCleanup, callback) };
        SocketTransaction.prototype.getSocket = function() { return this._codecsocket || this._socketThunk && this.setSocket(this._socketThunk()) };
        SocketTransaction.prototype.setSocket = function(socket) { if (socket === this._codecsocket) return socket; if (!socket && this._codecsocket) { this._codecsocket.unref();
                this._codecsocket.onError.removeListener(this.boundErrCb);
                this._codecsocket = null; return null } socket.ref();
            this._codecsocket = socket;
            this._codecsocket.onError.addListener(this.boundErrCb); return this._codecsocket };
        SocketTransaction.prototype._socketThunk = function() { return null };
        SocketTransaction.prototype.setConnectionId = function(connectionId, codecsocketClass) { if (this._codecsocket && this._codecsocket.connectionId != connectionId) { this.setSocket(null) } if (connectionId && !this._codecsocekt) { this._socketThunk = function() { delete this._socketThunk; return new(codecsocketClass || this.codecsocketClass)(connectionId, this.serial) } } };
        SocketTransaction.prototype.getConnectionId = function() { if (!this._codecsocket) return null; return this._codecsocket.connectionId };
        SocketTransaction.prototype.writeThenRead = function(data, cb, config) { var self = this,
                socket = this.getSocket(); if (!socket) { self.errCb(errors.NO_SOCKET); return } socket.writeThenRead(data, function(data) { if (!data) { self.errCb(errors.READ_ERROR); return } cb(data) }, config) };
        SocketTransaction.prototype.justWrite = function(data, cb, config) { this.getSocket().justWrite(data, cb, config) };
        SocketTransaction.prototype.drain = function(callback) { this.getSocket().drain(callback) };
        module.exports.SocketTransaction = SocketTransaction }, { "./../logging.js": 40, "./errors.js": 47, "./fsm.js": 48 }],
    51: [function(require, module, exports) { var status = require("./../status.js").status,
            Status = require("./../status.js").Status;
        module.exports = status({ BLOCKING_STATES: new Status("Blocking states {states}"), TRANSITION: new Status("Jumping to {state}: {args}") }) }, { "./../status.js": 43 }],
    52: [function(require, module, exports) {
        var FiniteStateMachine = require("./fsm.js").FiniteStateMachine,
            hexRep = require("./../util.js").hexRep,
            bufToBin = require("./../util.js").bufToBin,
            binToBuf = require("./../util.js").binToBuf,
            scheduler = require("./../scheduler"),
            errors = require("./errors.js"),
            getLog = require("./../logging.js").getLog;

        function USBTransaction(config, finishCallback, errorCallback, parent) { this.init.apply(this, arguments) } USBTransaction.prototype = Object.create(FiniteStateMachine.prototype);
        USBTransaction.prototype.init = function _init(config, finishCallback, errorCallback, parent) { this.superApply(_init, arguments);
            this.log = getLog("USBTransaction");
            this.sck = 10;
            this.endpoints = {}; if (this.config) { this.usb = this.config.api.usb;
                this.transfer = this.usb.controlTransfer.bind(this.usb) } this.setupAsControl() };
        USBTransaction.prototype.setupAsControl = function() { this.transferIn = this.controlIn.bind(this);
            this.transferOut = this.controlOut.bind(this);
            this.setupEndpoints = function(cb) { cb() };
            this.setConfiguration = function(cb) { cb() } };
        USBTransaction.prototype.setupAsBulk = function() { var proto = USBTransaction.prototype;
            this.transferIn = this.bulkIn.bind(this);
            this.transferOut = this.bulkOut.bind(this);
            this.setupEndpoints = proto.setupEndpoints;
            this.setConfiguration = proto.setConfiguration };
        USBTransaction.prototype.claimDirection = function(interfaces, direction, cb) { var self = this,
                found = interfaces.some(function isGoodIface(iface) { return iface.endpoints.some(function isGoodEp(ep) { if (ep.direction == direction) { self.usb.claimInterface(self.handler, iface.interfaceNumber, function() { if (self.config.api.runtime.lastError) { self.errCb(errors.CLAIM_INTERFACE, { ifaceNumber: iface.interfaceNumber }); return } cb(ep) }); return true } return false }) }); if (!found) cb(null) };
        USBTransaction.prototype.setupEndpoints = function(cb) { var self = this,
                cbCalled = false,
                interfacesToClaim = 0;

            function claimedInterface() { if (self.endpoints.in && self.endpoints.out && !cbCalled) { cbCalled = true;
                    cb() } } this.usb.listInterfaces(this.handler, function(ifaces) { if (!ifaces) { self.errCb(errors.LIST_INTERFACES); return } self.claimDirection(ifaces, "in", function(inEp) { self.endpoints.in = inEp;
                    self.claimDirection(ifaces, "out", function(outEp) { self.endpoints.out = outEp;
                        cb() }) }) }) };
        USBTransaction.prototype.smartOpenDevice = function(device, _nullspeed, _nullmsg, cb) {
            var self = this;
            this.config.api.runtime.getManifestAsync(function(manifest) {
                var knownDevs = manifest.permissions.filter(function(p) {
                        return !!p.usbDevices
                    }).reduce(function(ret, p) { return ret.concat(p.usbDevices) }, []),
                    canDetect = knownDevs.some(function(d) { return device.vendorId == d.vendorId && device.productId == d.productId });
                if (!canDetect) { self.errCb(errors.DEVICE_DETECTION, { device: device, knownDevices: knownDevs }); return } self.usb.getDevices(device, function(devs) { if (!devs) { self.errCb(errors.GET_DEVICES); return } if (devs.length == 0) { self.errCb(errors.NO_DEVICE, { searchedFor: device }); return } self._usedDevice = device;
                    self.openDevice(devs.pop(), cb) })
            })
        };
        USBTransaction.prototype.openDevice = function(dev, cb) { var self = this;
            this.usb.openDevice(dev, function(hndl) { var _callback = function() { self.setupEndpoints(function() { self.log.log("Endpoints:", self.endpoints);
                        cb(hndl) }) }; if (!hndl) { self.errCb(errors.OPEN_USB_DEVICE, { device: dev }); return } self.handler = hndl; var _getConfs = typeof self.usb.getConfigurations === "function" ? self.usb.getConfigurations.bind(self.usb.api) : function(_, cb) { cb() };
                _getConfs(dev, function(confs) { var typedConfs = typeof confs !== "undefined" ? confs.map(function(c) { return c.configurationValue }) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; if (self.config.api.runtime.lastError) { self.log.log("Looks like you have chrome < 47.", "Upgrade to make better use of the API") } self.setConfiguration(_callback, typedConfs) }) }) };
        USBTransaction.prototype.setAGoodConf = function(configurations, cb, collectedErrors) { var confVal = configurations[0],
                self = this; if (configurations.length <= 0) { self.log.warn("Tried all available configurations and failed.", "Let's hope this works. Errors:", collectedErrors);
                cb(); return } self.usb.setConfiguration(self.handler, configurations[0], function() { if (!self.config.api.runtime.lastError) { self.log.log("Configuration set to:", confVal);
                    self.configurationValue = confVal;
                    cb(); return } collectedErrors.push(self.config.api.runtime.lastError.message);
                self.setAGoodConf(configurations.slice(1), cb, collectedErrors) }) };
        USBTransaction.prototype.setConfiguration = function(cb, configurations) { var self = this,
                collectedErrors = [];
            this.usb.getConfiguration(this.handler, function(conf) { if (self.config.api.runtime.lastError) { collectedErrors.push(self.config.api.runtime.lastError.message) } self.setAGoodConf(configurations, cb, collectedErrors) }) };
        USBTransaction.prototype.xferMaybe = function(info, callback) { var self = this; if (this.config.dryRun) { callback({ data: [222, 173, 190, 239] }); return } self.xfer(info, callback) };
        USBTransaction.prototype.cmd = function(cmd, cb) { if (typeof this.cmdFunction === "undefined") { this.errCb(errors.UNDEFINED_COMMAND_PREFIX); return } var self = this,
                info = this.transferIn(this.cmdFunction, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4);
            this.xferMaybe(info, function(resp) { self.log.log("CMD:", hexRep(cmd), hexRep(resp.data));
                cb({ data: resp.data }) }) };
        USBTransaction.prototype.control = function(op, v1, v2, cb) { this.xfer(this.transferIn(op, v1, v2, 4), cb) };
        USBTransaction.prototype.errCb = function(err, ctx) { var self = this,
                context = ctx || {}; if (!this.usb || !this._usedDevice) { FiniteStateMachine.prototype.errCb.call(this, err, ctx); return } this.usb.getDevices(this._usedDevice, function(devs) { if (devs.length <= 0) { context.lostDevice = true;
                    self.finalError(err, context); return } FiniteStateMachine.prototype.errCb.call(self, err, ctx) }) };
        USBTransaction.prototype.localCleanup = function _lc(cb) { var self = this;
            this.disconnect(function() { self.superCall(_lc, cb) }) };
        USBTransaction.prototype.disconnect = function(callback) { if (this.handler) { this.usb.closeDevice(this.handler, callback);
                this._usedDevice = null;
                this.handler = null; return } callback() };
        USBTransaction.prototype.flash = function(_, sketchData) { var self = this,
                smartOpen = { state: "smartOpenDevice", retries: 3, retryInterval: 1e3 };
            this.refreshTimeout();
            this.sketchData = sketchData;
            this.transition(smartOpen, this.device, null, null, function(hndl) { self.handler = hndl;
                self.transition(self.entryState) }) };
        USBTransaction.prototype.xfer = function(info, cb) { var self = this;
            this.log.log("Performing control transfer", info.direction, hexRep([info.request, info.value, info.index]), "len:", info.length); if (info.direction == "out") { this.log.log("Data:", hexRep(bufToBin(info.data))) } this.refreshTimeout();
            scheduler.setImmediate(function() { self.transfer(self.handler, info, function(arg) { if (!arg || arg.resultCode != 0) { self.errCb(errors.TRANSFER_ERROR, { response: arg, request: info }); return } arg.data = bufToBin(arg.data);
                    self.log.log("Response was:", arg);
                    cb(arg) }) }) };
        USBTransaction.prototype.controlOut = function(op, value, index, data) { return { recipient: "device", direction: "out", requestType: "vendor", request: op, value: value, index: index, timeout: 5e3, data: binToBuf(data || []), length: data ? data.length : 0 } };
        USBTransaction.prototype.controlIn = function(op, value, index, length) { return { recipient: "device", direction: "in", requestType: "vendor", request: op, index: index, value: value, timeout: 5e3, length: length || 0 } };
        USBTransaction.prototype.bulkOut = function(msg, timeout) { if (msg.length > this.endpoints.out.maximumPacketSize) { this.log.error("Sending too large a packet:", msg.length, " > ", this.endpoints.out.maximumPacketSize) } return { direction: "out", endpoint: this.endpoints.out.address, data: binToBuf(msg), timeout: timeout || 1e4 } };
        USBTransaction.prototype.bulkIn = function(length, timeout) { if (length > this.endpoints.in.maximumPacketSize) { this.log.error("Requested too large a packet:", length, " > ", this.endpoints.in.maximumPacketSize) } return { direction: "in", endpoint: this.endpoints.in.address, length: length, timeout: timeout || 1e4 } };
        USBTransaction.prototype.maxPacketSize = function(length) { var min = 64; if (typeof this.maxXfer === "undefined" && this.maxXfer < min) { min = this.maxXfer } if (this.endpoints.in && this.endpoints.in.maximumPacketSize < min) { min = this.endpoints.in.maximumPacketSize } if (this.endpoints.out && this.endpoints.out.maximumPacketSize < min) { min = this.endpoints.out.maximumPacketSize } return min };
        module.exports.USBTransaction = USBTransaction
    }, { "./../logging.js": 40, "./../scheduler": 41, "./../util.js": 54, "./errors.js": 47, "./fsm.js": 48 }],
    53: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js").scheduler;

            function mkChecker(expected, check) { return function(obj) { if (!check(obj)) { return { error: "Expected " + expected + " got " + obj } } return { ok: true } } }

            function isSerializable(obj, dontCheckRecursive) { if (obj === null) return true; if (typeof obj === "function") return false; if (typeof obj !== "object") return true; if (obj instanceof Array) return !obj.some(function(x) { return !isSerializable(x) }); if (obj.__proto__ && obj.__proto__.__proto__) return false; if (!dontCheckRecursive) try { JSON.stringify(obj) } catch (c) { return false }
                return !Object.getOwnPropertyNames(obj).some(function(k) { return !isSerializable(obj[k], true) }) }

            function isIframeSerializable(obj) { if (obj instanceof ArrayBuffer) return true; if (isSerializable(obj)) return true; if (typeof obj !== "object") return false; return Object.getOwnPropertyNames(obj).reduce(function(ret, k) { return ret && isIframeSerializable(obj[k]) }, true) } var _callback = mkChecker("function", function(o) { return typeof o === "function" }); var checks = { callback: _callback, "function": _callback, object: mkChecker("object", function(o) { return o instanceof Object }), arraybuffer: mkChecker("arraybuffer", function(o) { return o instanceof ArrayBuffer }), array: mkChecker("array", function(o) { return o instanceof Array }), number: mkChecker("number", function(o) { return typeof o === "number" }), string: mkChecker("string", function(o) { return typeof o === "string" }), bool: mkChecker("string", function(o) { return typeof o === "boolean" }), "boolean": mkChecker("string", function(o) { return typeof o === "boolean" }), json: mkChecker("json", isSerializable), iframe: mkChecker("iframe", isIframeSerializable), any: function() { return { ok: true } } };

            function hasKey(obj, key) { return !Object.getOwnPropertyNames(obj).some(function(k) { return key === k }) }

            function getCheck(checker) { var chk = checks[checker]; if (typeof chk === "function") return chk; if (typeof checker === "function" && checker.prototype) return mkChecker(checker.name || "class", function(obj) { return obj instanceof checker }); if (checker instanceof Array) return function(arr) { return match(arr, checker) }; if (typeof checker === "object") return function(obj) { var ret;
                    Object.getOwnPropertyNames(checker).some(function(k) { if (typeof obj !== "object") { ret = { error: "Expected object, got " + obj }; return true } ret = getCheck(checker[k])(obj[k]); if (ret.error) ret.error = "{" + k + ": " + ret.error + "}"; return !!ret.error }); return ret }; throw Error("Unknown type checker:" + checker) }

            function match(args, checkers, index, cb) { if (args.length === 0 && checkers.length === 0) { return { ok: true } } if (args.length === 0 && checkers.length === 1 && checkers[0] === "varany") return { ok: true }; if (args.length === 0 || checkers.length === 0) { if (checkers[0] === "varany") return { error: "Last args should check with " + checkers.slice(1) + " but couldn't." };
                    cb && cb(args); return { error: "Wrong num of arguments: " + (index + args.length) + " (expected " + (index + checkers.length) + ")" } } var checker = checkers[0],
                    m; if (checker === "varany") { if (checkers.length === 1) return { ok: true };
                    m = match(args, checkers.slice(1), index, cb); if (m.ok) return m; return match(args.slice(1), checkers, index + 1, cb) } m = getCheck(checker)(args[0]); if (!m.ok) { cb && cb(checker, args[0]); return { error: "Argument #" + index + ": " + m.error } } return match(args.slice(1), checkers.slice(1), index + 1, cb) } var PRODUCTION = typeof global.it !== "function" && typeof global.describe !== "function" && typeof global.process === "undefined"; var settings = require("./settings.js").settings;

            function typecheck(args, checkers, callback) { if (PRODUCTION && !settings.get("typecheck")) return; var m = match([].slice.call(args), checkers, 0, callback); if (m.ok) return; throw Error(m.error) }

            function typechecked(fn, argtypes) { return function() { typecheck(arguments, argtypes, console.log.bind(console, "Typechecked:")); return fn.apply(null, arguments) } } module.exports.typechecked = typechecked;
            module.exports.typecheck = typecheck;
            module.exports.isSerializable = isSerializable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 41, "./settings.js": 42 }],
    54: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js");

            function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

            function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

            function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                    hex = hex.length < 2 ? "0" + hex : hex;
                    buf += " " + hex } buf += "]"; return buf }

            function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

            function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

            function shallowCopy(obj) { var ret = {}; if (!obj) return obj; if (typeof obj !== "object") throw Error("expected object, not " + typeof obj);
                Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = obj[k] }); if (obj.__proto__) ret.__proto__ = obj.__proto__; return ret }

            function replacePrototype(obj, cls1, cls2) { if (typeof obj !== "object" || typeof cls1 !== "function" || typeof cls2 !== "function") throw Error(); if (!obj || !obj.__proto__ || !cls1.prototype || !cls2.prototype) return obj; var ret = shallowCopy(obj); if (obj !== cls1.prototype) { ret.__proto__ = replacePrototype(ret.__proto__, cls1, cls2); return ret } return Object.create(cls2.prototype) }

            function forEachWithCallback(arr, cb, endCb) { scheduler.setTimeout(function() { if (arr.length <= 0) { endCb(); return } cb(arr[0], function() { forEachWithCallback(arr.slice(1), cb, endCb) }) }) }

            function repeat(times, fn) { var ret = new Array(times); for (var i = 0; i < times; i++) ret[i] = fn(); return ret }

            function compareVersions(v1, v2, callbacks) {
                function justParse(x) { return Number.parseInt(x) } return compareVersionLists(v1.split(".").map(justParse), v2.split(".").map(justParse), callbacks) }

            function compareVersionLists(v1, v2, cbs) { if (isNaN(v1[0]) || isNaN(v2[0])) return cbs.err(); if (v1[0] < v2[0] || v1.length === 0) return cbs.lt(); if (v1[0] > v2[0] || v2.length === 0) return cbs.gt(); if (v1.length === 0 && v2.length === 0) return cbs.eq(); return compareVersionLists(v1.slice(1), v2.slice(1), cbs) }

            function getUniqueId(name) { global.babelfishUniqueIds = global.babelfishUniqueIds || {};
                global.babelfishUniqueIds[name] = global.babelfishUniqueIds[name] || 1; return global.babelfishUniqueIds[name]++ } module.exports.compareVersions = compareVersions;
            module.exports.repeat = repeat;
            module.exports.forEachWithCallback = forEachWithCallback;
            module.exports.storeAsTwoBytes = storeAsTwoBytes;
            module.exports.storeAsFourBytes = storeAsFourBytes;
            module.exports.hexRep = hexRep;
            module.exports.binToBuf = binToBuf;
            module.exports.bufToBin = bufToBin;
            module.exports.shallowCopy = shallowCopy;
            module.exports.replacePrototype = replacePrototype;
            module.exports.getUniqueId = getUniqueId }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 41 }],
    55: [function(require, module, exports) {
        function PropertyDescriptor(element, prop) { var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), prop); if (desc) { Object.getOwnPropertyNames(desc).forEach(function(pp) { if (pp != "value" && true) { console.log(prop + "[" + pp + "]");
                        this[pp] = element[pp] } }) } throw Error("Could not determine property descruptor of plugin property '" + prop);
            this.get = function() { return element[prop] };
            this.set = function(val) { element[prop] = val } }

        function prototypeProperties(obj) { return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) }

        function wrap(wrapper, obj) { prototypeProperties(obj).forEach(function(attr) { if (typeof wrapper[attr] !== "undefined") { return } if (obj[attr] instanceof Function) { wrapper[attr] = obj[attr].bind(obj); return } var descr = new PropertyDescriptor(obj, attr);
                Object.defineProperty(wrapper, attr, descr) }) } module.exports.wrap = wrap }, {}],
    56: [function(require, module, exports) { module.exports.client = require("./src/client.js");
        module.exports.server = require("./src/server.js") }, { "./src/client.js": 69, "./src/server.js": 89 }],
    57: [function(require, module, exports) { var messageApi = require("./../messaging.js");

        function getState(hostId, cb) { messageApi.sendMessage(hostId, { legacy: true, method: "getManifestAsync", object: "runtime", callbackId: -1 }, function clientStateResponse(resp) { if (resp.version) { cb(resp); return } var val; try { val = resp.args.args[0].val;
                    cb(resp.args.args[0].val) } catch (e) { console.trace(resp) } }) }

        function setupAdHoc(hostId, apiRoot) { apiRoot.runtime = apiRoot.runtime || {};
            apiRoot.runtime.getManifestAsync = function(cb) { return getState(hostId, cb) };
            apiRoot.runtime.setPlatformInfo = function(info, cb) { cb(false) } } module.exports.getState = getState;
        module.exports.setupAdHoc = setupAdHoc }, { "./../messaging.js": 76 }],
    58: [function(require, module, exports) {
        function isOldstyleGetManifest(message) { return message && message.method == "getManifestAsync" && message.object == "runtime" && message.callbackId }

        function getState(apiRoot, state, cb) { var formattedState = apiRoot.runtime.getManifest();
            formattedState.connections = state.connections.map(function(c) { return c && { bufferLength: c.bufferLength, conf: c.portConf, id: c.id, closed: c.closed } }), formattedState.keepalives = state.keepalives.map(function(k) { return k && { clientId: k.clientId, conf: k.portConf, closed: k.closed } }), cb(formattedState) }

        function setupAdHoc(state) { var apiRoot = state.apiRoot; if (apiRoot.runtime) { if (!apiRoot.babelfish) apiRoot.babelfish = {};
                apiRoot.babelfish.getState = apiRoot.runtime.getManifestAsync = getState.bind(null, apiRoot, state);

                function provideState(msg, sendResp) { if (msg && (msg.method == "getState" || isOldstyleGetManifest(msg))) { apiRoot.babelfish.getState(sendResp); return false } return true } state.bootstrapHost.commands.push(provideState) } if (apiRoot.serial) { apiRoot.serial.onReceiveError.forceDispatch = function(info) { state.connections.forEach(function(c) { if (c.apiEvent.methodName == "serial.onReceiveError.addListener") { c.apiEvent.methodRequest.getCallback().call(null, info) } }) } } } module.exports.setupAdHoc = setupAdHoc }, {}],
    59: [function(require, module, exports) { var util = require("./util"),
            AckResponse = require("./responses.js").AckResponse,
            ArgsResponse = require("./responses.js").ArgsResponse,
            MethodRequest = require("./requests.js").MethodRequest,
            Arguments = require("./arguments.js").Arguments,
            log = new(require("./log.js").Log)("apieventemitter"); var closingResponses = { callingArguments: function(closingRequest) { var method = util.path2callable(this.hostApi, this.reverser.path),
                    args = this.methodRequest.args.forCalling(); if (!closingRequest) { method.apply(null, args); return null } if (this.reverser.path == closingRequest.method && JSON.stringify(closingRequest.args.forSending()) == JSON.stringify(this.methodRequest.args.forSending())) { method.apply(null, args);
                    this.destroy(true); return new AckResponse } return null }, firstResponse: function(closingRequest) { var fr = this.firstResponseMsg; if (!fr || fr.responseType != "ArgsResponse") { return null } var closingArg = fr.args[0]; if (this.reverser.firstArgPath) { closingArg = closingArg[this.reverser.firstArgPath] } if (!closingRequest) { var mr = new MethodRequest(null, this.reverser.path, new Arguments([closingArg, function() {}]));
                    mr.call(null, this.hostApi); return null } if (JSON.stringify(closingArg) == JSON.stringify(closingRequest.args.forSending()[0]) && closingRequest.method == this.reverser.path) { this.destroy(true); return ArgsResponse.async(closingRequest, this.hostApi) } return null }, serial: function(closingRequest) { var oldfap = this.reverser.firstArgPath = "connectionId"; return closingResponses.firstResponse(closingRequest);
                this.reverser.firstArgPath = oldfap }, "default": function(closingRequest) { return closingResponses.serial(closingRequest) || closingResponses.firstResponse(closingRequest) || closingResponses.callingArguments(closingRequest) } };

        function ApiEventEmitter(methodRequest, reverser, hostApi, closeCb) { var self = this;
            this.methodName = methodRequest.method;
            this.reverser = reverser;
            this.hostApi = hostApi;
            this.calledClosingRequests = [];
            this.methodRequest = methodRequest;
            this.methodRequest.args.setLens(function(cb) { return function() { var args = [].slice.call(arguments);
                    self.firstResponseMsg = self.firstResponseMsg || args[0];
                    cb.apply(null, args) } });
            this.methodRequest.args.setLens = null;
            this.maybeRunCloser = function(closingRequest) { if (self.closed) { console.error("Trying to close a closed event emitter"); return null } var closingResponseFactory = closingResponses[self.reverser.type] || closingResponses.default,
                    ret = closingResponseFactory.call(self, closingRequest); if (ret) { log.log("Closing[" + self.reverser.type + "]:", ret, "with", closingRequest) } return ret };
            this.closeCb = closeCb } ApiEventEmitter.prototype = { fire: function() { this.methodRequest.call(null, this.hostApi) }, destroy: function(shallow) { var self = this; if (this.closed) return; if (!shallow) this.maybeRunCloser();
                this.closed = true;
                this.closeCb();
                log.log("Disconected:", this.methodRequest.forSending()) }, missingReverseCb: function() { throw new Error("No such method as " + this.methodName) }, missingMethodCb: function() { throw new Error("No reverse method for " + this.methodName) } };
        module.exports.ApiEventEmitter = ApiEventEmitter }, { "./arguments.js": 60, "./log.js": 75, "./requests.js": 79, "./responses.js": 83, "./util": 91 }],
    60: [function(require, module, exports) { module.exports.CallbackArgument = require("./arguments/callback.js");
        module.exports.DataArgument = require("./arguments/data.js");
        module.exports.DatabufferArgument = require("./arguments/databuffer.js");
        module.exports.BasicArgument = require("./arguments/basic.js");
        module.exports.Arguments = require("./arguments/container.js");
        module.exports.argumentFactory = require("./arguments/factory.js").argumentFactory;
        module.exports.argumentClasses = require("./arguments/factory.js").argumentClasses }, { "./arguments/basic.js": 61, "./arguments/callback.js": 62, "./arguments/container.js": 63, "./arguments/data.js": 64, "./arguments/databuffer.js": 65, "./arguments/factory.js": 66 }],
    61: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses;

        function BasicArgument(arg) { this.value = arg } BasicArgument.canWrap = function(arg) { return true };
        BasicArgument.prototype = { forCalling: function() { return this.value }, forSending: function() { return this.value } };
        argumentClasses.push(BasicArgument);
        module.exports = BasicArgument }, { "./factory.js": 66 }],
    62: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses;

        function CallbackArgument(arg, replaceCb) { if (!CallbackArgument.canWrap(arg)) { throw Error("Cant wrap argument " + arg + "as a function") } this.replaceCb = replaceCb || null;
            this.id = arg.id || this.replaceCb && this.replaceCb.id || Date.now() + Math.random();
            this.callback = arg instanceof Function ? arg : replaceCb; if (this.callback) { this.callback.id = this.id } this.placeholder = { id: this.id, isCallback: true } } CallbackArgument.canWrap = function(arg) { return arg && (arg instanceof Function || arg.isCallback) };
        CallbackArgument.prototype = { forCalling: function() { return this.lens ? this.lens(this.callback) : this.callback }, forSending: function() { return this.placeholder }, setLens: function(lens) { this.lens = lens } };
        argumentClasses.push(CallbackArgument);
        module.exports = CallbackArgument }, { "./factory.js": 66 }],
    63: [function(require, module, exports) { var CallbackArgument = require("./callback.js"),
            argumentFactory = require("./factory.js").argumentFactory;

        function Arguments(arguments, replaceCb) { this.arguments = arguments.map(function(a) { return argumentFactory(a, replaceCb) }) } Arguments.prototype = { forCalling: function() { return this.arguments.map(function(a) { return a.forCalling() }) }, forSending: function() { return this.arguments.map(function(a) { return a.forSending() }) }, getCallback: function() { var cbArg = this.arguments.filter(function(a) { return a instanceof CallbackArgument })[0],
                    ret = cbArg ? cbArg.forCalling() : this.replaceCb; return ret }, setLens: function(lens) { if (this.replaceCb) { this.replaceCb = lens(this.replaceCb) } this.arguments.forEach(function(a) { if (a.setLens) a.setLens(lens) }) } };
        module.exports = Arguments }, { "./callback.js": 62, "./factory.js": 66 }],
    64: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses,
            DatabufferArgument = require("./databuffer.js");

        function DataArgument(arg) { if (!DataArgument.canWrap(arg)) { throw new Error("Expected object like {data: ArrayBuffer}, got: ", arg) } this.arg = arg;
            this.data = new DatabufferArgument(arg.data) } DataArgument.canWrap = function(arg) { return arg instanceof Object && DatabufferArgument.canWrap(arg.data) };
        DataArgument.prototype = { argCopy: function() { var ret = {},
                    self = this;
                Object.getOwnPropertyNames(this.arg).forEach(function(k) { ret[k] = self.arg[k] }); return ret }, forCalling: function() { var ret = this.argCopy();
                ret.data = this.data.forCalling(); return ret }, forSending: function() { var ret = this.argCopy();
                ret.data = this.data.forSending(); return ret }, concat: function(msg) { if (!msg.data || !msg.data.isArrayBuffer) return this; var ret = this.forSending();
                ret.data = this.data.concat(msg.data).forSending(); return new DataArgument(ret) } };
        argumentClasses.push(DataArgument);
        module.exports = DataArgument }, { "./databuffer.js": 65, "./factory.js": 66 }],
    65: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses,
            util = require("../util.js");

        function DatabufferArgument(arg) { if (!DatabufferArgument.canWrap(arg)) { throw Error("Cant wrap argument " + arg + " as a databuffer") } this.buffer = arg instanceof ArrayBuffer ? arg : null;
            this.obj = arg.isArrayBuffer ? arg : null } DatabufferArgument.canWrap = function(arg) { return arg && (arg instanceof ArrayBuffer || arg.isArrayBuffer) };
        DatabufferArgument.prototype = { forCalling: function() { return this.buffer || util.arrToBuf(this.obj.data) }, forSending: function() { return this.obj || { data: util.bufToArr(this.buffer), isArrayBuffer: true } }, concat: function(msg) { if (!msg.isArrayBuffer) return this; var ret = this.forSending();
                ret.data = ret.data.concat(msg.data); return new DatabufferArgument(ret) } };
        argumentClasses.push(DatabufferArgument);
        module.exports = DatabufferArgument }, { "../util.js": 91, "./factory.js": 66 }],
    66: [function(require, module, exports) { var argumentClasses = [];

        function argumentFactory(arg, replacingCb) { var classes = argumentClasses.filter(function(ac) { return ac.canWrap(arg) }); return new classes[0](arg, replacingCb) } module.exports.argumentFactory = argumentFactory;
        module.exports.argumentClasses = argumentClasses }, {}],
    67: [function(require, module, exports) {
        (function(global) { var messageApi = require("./messaging.js");

            function BootStrapClient() { this.messageApi = messageApi } BootStrapClient.prototype = { getState: function(hostId, cb, cfg) { messageApi.sendMessage(hostId, { legacy: true, method: "getManifestAsync", object: "runtime", args: { args: [{ type: "function" }] }, callbackId: -1 }, function clientStateResponse(resp) { if (!resp || resp.version) { cb(resp); return } var val = null; try { val = resp.args.args[0].val } catch (e) {} cb(val) }) }, getHostId: function(cb, cfg) { cfg = cfg || {}; var appIds = cfg.ids || global.appIds || ["jommgdhcpkjoikkjcnpafeofedlfphfb", "magknjdfniglanojbpadmpjlglepnlko", global.APP_ID],
                        car = appIds[0],
                        cdr = appIds.slice(1),
                        self = this; if (!car) { cb(); return } this.getState(car, function checkManifest(arg) { if (!arg) { cfg.ids = cdr;
                            self.getHostId(cb, cfg); return } cb(car, arg) }, cfg) }, getManifest: function(cb, cfg) { this.getHostId(function(id, state) { if (state) state.hostId = id;
                        cb(state) }, cfg) } };
            module.exports = new BootStrapClient }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./messaging.js": 76 }],
    68: [function(require, module, exports) { var messageApi = require("./messaging.js");

        function BootstrapHost() { this.commands = [];
            this.listener = null;
            this.listen() } BootstrapHost.prototype = { listen: function() { var self = this;
                this.listener = function(req, sender, sendResp) { return self.commands.length == 0 || !self.commands.some(function(c) { return !c(req, sendResp) }) };
                messageApi.onMessageExternal.addListener(this.listener) }, cleanup: function() { messageApi.onMessageExternal.removeListener(this.listener) } };
        module.exports.BootstrapHost = BootstrapHost }, { "./messaging.js": 76 }],
    69: [function(require, module, exports) {
        (function(global) { module.exports.setupClient = require("./handlers.js").setupClient;
            global.setupClient = module.exports.setupClient;
            module.exports.extentionAvailable = true;
            global.extentionAvailable = true;
            console.log("Client can run setup...") }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./handlers.js": 73 }],
    70: [function(require, module, exports) { var Arguments = require("./arguments.js").Arguments,
            r = require("./responses.js"),
            messageApi = require("./messaging.js"),
            MethodRequest = require("./requests.js").MethodRequest,
            BurstRequest = require("./requests.js").BurstRequest,
            log = new(require("./log.js").Log)("clientconnection");
        require("./setimmediate.js");

        function ClientConnection(method, args, reverser, hostId, clientId, closeCb, connectedCb, withError) { this.methodRequest = new MethodRequest(hostId, method, args, false, false, withError);
            this.id = this.createId();
            this.closeCb = closeCb;
            this.clientId = clientId;
            this.hostId = hostId;
            this.reverser = reverser;
            this.busy = false;
            this.dataReady = false;
            this.paused = false;
            this.closed = false; var portName = JSON.stringify({ methodRequestMsg: this.methodRequest.forSending(), id: this.id, reverser: reverser, clientId: clientId }),
                self = this;
            this.port = messageApi.connect(hostId, { name: portName });
            this.connectedCbs = [];

            function initFinished(msg) { if (r.ErrResponse.maybeHandle(msg, self.methodRequest, self.close.bind(self))) { return null } if (typeof msg != "string") { return self.handleDtr(msg) } initFinished.id = "initFinished-" + self.id; if (msg == "ack" && self.port) { self.port.onMessage.removeListener(initFinished);
                    self.connectedCbs.forEach(function(cb) { cb() });
                    self.connectedCbs = null; if (connectedCb) { connectedCb() } return false } return true } log.log("Registering ondisconnect");
            this.port.onDisconnect.addListener(function() { self.close() });
            this.port.onMessage.addListener(function(msg) { setImmediate(function() { initFinished(msg) }); return true });
            this.port.postMessage("client created") } ClientConnection.prototype = { repr: function() { return this.id + " ( " + this.methodRequest.method + " )" }, createId: function() { return "connection-" + (Date.now() + Math.random()) }, afterConnect: function(cb, varArgs) { var callback = cb.bind(null, [].slice.call(arguments, 1)); if (this.connectedCbs) { this.connectedCbs.push(callback); return } setImmediate(callback) }, pause: function(pause, emptyBufferCb) { var self = this;
                emptyBufferCb = emptyBufferCb || function() {};
                self.paused = pause;
                this.afterConnect(function() { if (!self.paused && self.dataReady) { self.handleDtr(null, emptyBufferCb); return } emptyBufferCb() }) }, handleDtr: function(message, finished) { var self = this;
                log.log("Got data ready:" + this.repr(), "(busy:" + this.busy + ", paused:" + this.paused + ")"); if (this.closed) { log.warn("Closed client side of connection " + this.id); return } if (this.busy || this.paused) { this.dataReady = true; return }

                function doneCb() { log.log("Done handling dtr", self.dataReady); if (!self.dataReady) { self.busy = false; if (finished) finished(); return } self.dataReady = false;
                    self.requestData(doneCb) } this.busy = true;
                this.dataReady = false;
                this.requestData(doneCb) }, requestData: function(doneCb) { log.log("Requesting data from " + this.repr() + ". Secs since last: " + Date.now() - this.lastRequest || 0); if (this.closed) return; var self = this;
                this.lastRequest = Date.now(); var req = new BurstRequest(this.hostId, this, function() { if (self.closed) return null; return self.methodRequest.getCallback().apply(null, arguments) });
                this.servingRequest = req;
                req.send(doneCb) }, close: function(error) { if (this.servingRequest) { this.servingRequest.blocked = true } if (!this.closed) { this.port.disconnect() } this.closed = true;
                this.dataReady = false;
                this.pause = false;
                this.busy = false;
                this.port = null;
                setImmediate(this.closeCb.bind(this, error)) } };
        module.exports.ClientConnection = ClientConnection }, { "./arguments.js": 60, "./log.js": 75, "./messaging.js": 76, "./requests.js": 79, "./responses.js": 83, "./setimmediate.js": 90 }],
    71: [function(require, module, exports) {
        (function(global) { var bsc = require("./bootstrapclient.js"),
                s = require("./server.js");
            global.defaultConfig = { clientId: -1, reverseMethods: { "serial.onReceive.addListener": { path: "serial.onReceive.removeListener", type: "callingArguments" }, "serial.onReceiveError.addListener": { path: "serial.onReceiveError.removeListener", type: "callingArguments" }, "serial.connect": { path: "serial.disconnect", type: "firstResponse", firstArgPath: "connectionId" }, "usb.openDevice": { path: "usb.closeDevice", type: "firstResponse", firstArgPath: null } }, methods: ["babelfish.getState", "runtime.getManifestAsync", "serial.onReceiveError.forceDispatch", "runtime.getPlatformInfo", "serial.getDevices", "serial.connect", "serial.update", "serial.disconnect", "serial.setPaused", "serial.getInfo", "serial.getConnections", "serial.send", "serial.flush", "serial.getControlSignals", "serial.setControlSignals", "serial.onReceive.addListener", "serial.onReceive.removeListener", "serial.onReceiveError.addListener", "serial.onReceiveError.removeListener", "usb.getDevices", "usb.getUserSelectedDevices", "usb.requestAccess", "usb.openDevice", "usb.findDevices", "usb.closeDevice", "usb.setConfiguration", "usb.getConfiguration", "usb.getConfigurations", "usb.listInterfaces", "usb.claimInterface", "usb.releaseInterface", "usb.setInterfaceAlternateSetting", "usb.controlTransfer", "usb.bulkTransfer", "usb.interruptTransfer", "usb.isochronousTransfer", "usb.resetDevice", "usb.onDeviceAdded.addListener", "usb.onDeviceAdded.removeListener", "usb.onDeviceRemoved.addListener", "usb.onDeviceRemoved.removeListener"], noCallbackMethods: ["usb.onDeviceRemoved.removeListener", "usb.onDeviceAdded.removeListener", "serial.onReceiveError.removeListener", "serial.onReceive.removeListener", "serial.onReceive.forceDispatch"] };

            function getConfig(connectCb, disconnectCb, errorCb, timeout) { var newConfig = JSON.parse(JSON.stringify(global.defaultConfig));

                function doGetConfig(state, config) { config.version = state.version; if (parseInt(state.version.split(".").shift()) < 1) { errorCb({ badVersion: config.version }); return } s.getKeepAliveConnection(state.hostId, function(token) { config.token = token;
                        config.chromeApi = chrome;
                        config.hostId = state.hostId;
                        config.clientId = config.token.clientId;
                        connectCb(config) }, function(error) { if (disconnectCb && !error) { disconnectCb(); return } if (errorCb && error) { errorCb(error); return } }, timeout) } bsc.getManifest(function(m) { if (!m) { disconnectCb(); return } doGetConfig(m, newConfig) }) } module.exports.getConfig = getConfig }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./bootstrapclient.js": 67, "./server.js": 89 }],
    72: [function(require, module, exports) {
        function withError(apiRoot, error, cb) { var unchecked = true;
            apiRoot.runtime = apiRoot.runtime || {};
            Object.defineProperty(apiRoot.runtime, "lastError", { configurable: true, enumerable: true, get: function() { unchecked = false; return error } });
            cb();
            Object.defineProperty(apiRoot.runtime, "lastError", { configurable: true, enumerable: true, get: function() { unchecked = false; return undefined } }); if (unchecked && error) { console.error("lastError not checked: " + error.message || error) } } module.exports.withError = withError
    }, {}],
    73: [function(require, module, exports) { var MethodRequest = require("./requests.js").MethodRequest,
            ClientConnection = require("./clientconnection.js").ClientConnection,
            getKeepAliveConnection = require("./server.js").getKeepAliveConnection,
            messageApi = require("./server.js").messageApi,
            errhandle = require("./error.js"),
            adhocclient = require("./adhoc/client.js"),
            getConfig = require("./config.js").getConfig,
            log = new(require("./log.js").Log)("handlers");
        require("./setimmediate.js");

        function uncaughtError(err) { console.error(err) } var clientConnections = [];

        function handlerFactory(path, config, withError) { var handler;

            function unregisterConnection() { if (!this.closed) { this.close() } var self = this;
                clientConnections = clientConnections.filter(function(c) { return c !== self }) }

            function registerConnection(varArgs) { clientConnections.push(new ClientConnection(path, [].slice.call(arguments), config.reverseMethods[path], config.hostId, config.clientId, unregisterConnection, null, withError)) } if (config.reverseMethods[path]) { return registerConnection } var isReverter = Object.getOwnPropertyNames(config.reverseMethods).some(function(k) { return config.reverseMethods[k].path == path }),
                noCallback = config.noCallbackMethods.indexOf(path) > -1; return function() { var mr = new MethodRequest(config.hostId, path, [].slice.call(arguments), isReverter, noCallback);
                mr.withError = withError;
                mr.send() } }

        function setupClient(apiRoot, connectCb, disconnectCb, errorCb, timeout) { if (apiRoot.local && apiRoot.local.token) { if (errorCb) { errorCb("already_connected"); return } throw new Error("Tried to reconnect to a non disconnected api") } getConfig(function(config) { apiRoot.local = config;
                asApiClient(apiRoot);
                connectCb() }, disconnectCb, errorCb, timeout) }

        function asApiClient(apiRoot) { apiRoot.local.getConnections = function() { return clientConnections };
            apiRoot.local.disconnect = function(done, silent) { var self = this,
                    evt = null; if (this.token && this.token.port) { this.token.port.disconnect(); if (!silent) { evt = this.token.disconnectCb } setImmediate(function() { if (evt) evt(); if (done) done() }) } this.token = null };
            apiRoot.local.methods.forEach(function(path) { var names = path.split("."),
                    method = names.pop(),
                    obj = names.reduce(function(ob, meth) { if (!ob[meth]) { ob[meth] = {} } return ob[meth] }, apiRoot); if (obj[method]) return;
                obj[method] = handlerFactory(path, apiRoot.local, errhandle.withError.bind(null, apiRoot)) }); if (!apiRoot.local.hostId) console.error("No host id during setup of api");
            adhocclient.setupAdHoc(apiRoot.local.hostId, apiRoot) } module.exports.getConfig = getConfig;
        module.exports.handlerFactory = handlerFactory;
        module.exports.setupClient = setupClient;
        module.exports.uncaughtError = uncaughtError }, { "./adhoc/client.js": 57, "./clientconnection.js": 70, "./config.js": 71, "./error.js": 72, "./log.js": 75, "./requests.js": 79, "./server.js": 89, "./setimmediate.js": 90 }],
    74: [function(require, module, exports) { var Arguments = require("./arguments.js").Arguments,
            MethodRequest = require("./requests.js").MethodRequest,
            ApiEventEmitter = require("./apieventemitter.js").ApiEventEmitter,
            r = require("./responses.js"),
            util = require("./util.js"),
            closed = [],
            log = new(require("./log.js").Log)("hostconnection");
        require("./setimmediate.js");

        function HostConnection(port, hostApi, closeCb) { var self = this;
            this.buffer = [];
            this.port = port;
            this.portConf = JSON.parse(port.name);
            this.id = this.portConf.id;
            this.closeCb = closeCb.bind(this);
            this.closed = false; var sendRaw = function(msg) { self.pushRequest(msg) };
            this.methodRequest = MethodRequest.fromMessage(null, this.portConf.methodRequestMsg, sendRaw);
            log.log("Opening connection:", this.repr());
            this.apiEvent = new ApiEventEmitter(this.methodRequest, this.portConf.reverser, hostApi, this.close.bind(this));
            this.port.onMessage.addListener(function(msg) { if (msg == "client created") { self.port.postMessage("ack");
                    self.apiEvent.fire() } });
            log.log("Registering server side ondisconnect for method connection");
            this.port.onDisconnect.addListener(this.close.bind(this)) } HostConnection.prototype = { repr: function() { return this.id + " ( " + this.methodRequest.method + " )" }, close: function() { if (this.closed) return;
                log.log("Closing connection:", this.repr());
                this.closed = true;
                this.port.disconnect();
                this.apiEvent.destroy();
                this.port = null;
                this.closeCb() }, sendError: function(message) { if (this.closed) return;
                this.port.postMessage(new r.ErrResponse(message).forSending());
                this.close() }, pushRequest: function(reqMsg) { if (this.closed) return; if (reqMsg.responseType == "ErrResponse") { this.sendError(reqMsg.err) } if (!this.apiEvent.firstResponseMsg) { this.apiEvent.firstResponseMsg = reqMsg } if (this.buffer.length == 0) { setImmediate(this.setDtr.bind(this)) } this.buffer.push(reqMsg);
                this.buffer.timestamp = Date.now() }, setDtr: function() { if (this.port) this.port.postMessage({ timestamp: this.buffer.timestamp, connection: this.id }) }, flushBuffer: function(callback) { callback(this.buffer);
                this.buffer = [] }, tryClosing: function(closingRequest) { if (this.closed) return false; var ret = this.apiEvent.maybeRunCloser(closingRequest); if (this.apiEvent.closed) { this.close() } return ret } };
        module.exports.HostConnection = HostConnection }, { "./apieventemitter.js": 59, "./arguments.js": 60, "./log.js": 75, "./requests.js": 79, "./responses.js": 83, "./setimmediate.js": 90, "./util.js": 91 }],
    75: [function(require, module, exports) {
        (function(global) { var timeOffset = Date.now();
            global.debugBabelfish = false;

            function zeroFill(number, width) { width -= number.toString().length; if (width > 0) { return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number } return number + "" }

            function Log(name, verbosity) { this.verbosity = verbosity || 1;
                this.name = name;
                this.resetTimeOffset();
                this.showTimes = false;
                this.error = this.console_("error", 0);
                this.warn = this.console_("warn", 1);
                this.info = this.console_("log", 2);
                this.log = this.console_("log", 3) } Log.prototype = { timestampString: function() { var now = new Date(new Date - timeOffset + timeOffset.getTimezoneOffset() * 6e4); var pad = function(n) { if (n < 10) { return "0" + n } return n }; return pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds()) + "." + zeroFill(now.getMilliseconds(), 3) }, resetTimeOffset: function() { timeOffset = new Date }, console_: function(type, verbosity) { var self = this; if (this.showTimes) { return function() { if (self.verbosity > verbosity || global.debugBabelfish) { return console[type].apply(console, [self.prefix()].concat(arguments)) } } } if (this.verbosity > verbosity || global.debugBabelfish) { return console[type].bind(console, this.prefix()) } return function() {} }, prefix: function() { if (this.showTimes) return "[" + this.timestampString() + " : " + this.name + "]"; return "[" + this.name + "] " } };
            module.exports.Log = Log }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    76: [function(require, module, exports) {
        (function(global) { var DummyRuntime = require("./messaging/dummy.js").DummyRuntime,
                ChromeMessaging = require("./messaging/chrome.js").ChromeMessaging; var interfaces = { chrome: ChromeMessaging, test: DummyRuntime }; if (!global.chrome || !global.chrome.runtime || !global.chrome.runtime.sendMessage) { global.MESSAGING_METHOD = "test" } module.exports = new interfaces[global.MESSAGING_METHOD || "chrome"] }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./messaging/chrome.js": 77, "./messaging/dummy.js": 78 }],
    77: [function(require, module, exports) {
        function ChromeMessaging() { this.version = chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "1";
            this.onConnectExternal = chrome.runtime.onConnectExternal;
            this.onMessageExternal = chrome.runtime.onMessageExternal;
            this.sendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
            this.connect = chrome.runtime.connect.bind(chrome.runtime) } module.exports.ChromeMessaging = ChromeMessaging }, {}],
    78: [function(require, module, exports) {
        (function(global) { global.APP_ID = global.APP_ID || "fakehostid"; var DEBUG = false,
                stackDebug = false; var assert = require("assert"),
                maybeAsync = stackDebug ? function(cb) { cb() } : function(cb) { var err = new Error("Stack before async message");
                    setTimeout(function() { try { cb() } catch (e) { console.log(e.stack);
                            console.log(err.stack); throw err } }) },
                dbg = function() {}; if (DEBUG) { dbg = console.log.bind(console, "[dummy messager]") }

            function validateMessage(msg) { if (!msg || JSON.stringify(msg) == "{}") { throw new Error("Message should be something. Got:" + msg) } }

            function Event(jsonOnly, name, buffered) { this.listeners = [];
                this.removed = [];
                this.name = name; if (buffered) { this.buffer = [] } if (jsonOnly) { this.wrap = function(args) { return JSON.parse(JSON.stringify(args)) } } else { this.wrap = function(a) { return a } } } Event.prototype = { addListener: function(cb) { dbg("Adding listner: " + cb.id + " to " + this.name); var self = this;
                    this.listeners = this.listeners.concat([cb]);
                    (this.buffer || []).forEach(function(args) { maybeAsync(function() { self.listeners.some(function(l) { return !l.apply(null, args) }) }) }) }, removeListener: function(cb) { dbg("Removing listner: " + cb.id + " from " + this.name + " (" + this.listeners.map(function(l) { return l.id }) + " - " + this.removed + " )");
                    this.listeners = this.listeners.filter(function(l) { var same = cb === l,
                            sameIds = cb.id && l.id && cb.id == l.id; return !(same || sameIds) }) }, trigger: function(varArgs) { var args = [].slice.call(arguments),
                        self = this,
                        listeners = this.listeners;
                    dbg("Triggering[" + this.listeners.length + "]: " + this.name + "|" + (args[0] instanceof Port ? "<port>" : JSON.stringify(args))); if (this.buffer && this.listeners.length == 0) { this.buffer.push(args); return } maybeAsync(function() { var tok = Math.random();
                        listeners.some(function(l, i) { return l.apply(null, args) === false }) }) } };

            function Runtime() { dbg("Creating runtime...");
                this.id = global.APP_ID;
                this.onConnectExternal = new Event(false, "onConnectExternal");
                this.onMessageExternal = new Event(true, "onMessageExternal");
                this.ports = [];
                this.version = "1.0" } Runtime.prototype = { sendMessage: function(hostId, message, cb) { var sender = null;
                    validateMessage(message);
                    assert(message);
                    assert(hostId); if (hostId != this.id || global.blockMessaging) { maybeAsync(cb); return } this.onMessageExternal.trigger(message, sender, cb) }, connect: function(hostId, connectInfo) { var clientPort = new Port(connectInfo.name, this),
                        self = this;
                    assert.equal(hostId, this.id); if (global.blockMessaging) { setImmediate(function() { clientPort.onDisconnect.trigger(clientPort) }); return clientPort } maybeAsync(function() { self.onConnectExternal.trigger(clientPort.otherPort) }); return clientPort } };

            function Port(name, runtime, otherPort) { this.name = name;
                this.runtime = runtime;
                runtime.ports = runtime.ports.concat([this]);
                this.prefix = "Port" + (!otherPort ? "<client>" : "<host>");
                this.onDisconnect = new Event(false, this.prefix + ".onDisconnect");
                this.onMessage = new Event(true, this.prefix + ".onMessage", true);
                this.otherPort = otherPort || new Port(name, runtime, this);
                this.connected = true } Port.prototype = { postMessage: function(msg) { validateMessage(msg);
                    this.otherPort.onMessage.trigger(msg) }, disconnect: function(forceListeners) { if (this.connected) { var self = this;
                        this.runtime.ports = this.runtime.ports.filter(function(p) { return p !== self });
                        this.connected = false;
                        this.onMessage.listeners = []; if (forceListeners) { this.onDisconnect.trigger() } this.onDisconnect.listeners = [];
                        this.otherPort.disconnect(true) } } };
            global.chrome = global.chrome || { runtime: { id: APP_ID } };
            module.exports.DummyRuntime = Runtime;
            module.exports.Event = Event;
            module.exports.Port = Port }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { assert: 209 }],
    79: [function(require, module, exports) { module.exports.BurstRequest = require("./requests/burst.js").BurstRequest;
        module.exports.GenericRequest = require("./requests/generic.js").GenericRequest;
        module.exports.MethodRequest = require("./requests/method.js").MethodRequest }, { "./requests/burst.js": 80, "./requests/generic.js": 81, "./requests/method.js": 82 }],
    80: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguements,
            log = new(require("./../log.js").Log)("burstrequest"),
            GenericRequest = require("./generic.js").GenericRequest,
            ErrResponse = require("./../responses.js").ErrResponse,
            BurstResponse = require("./../responses.js").BurstResponse;

        function BurstRequest(hostId, connection, callback) { this.hostId = hostId;
            this.connection = connection;
            this.callback = callback;
            this.blocked = false } BurstRequest.maybeHandle = function(msg, connections, sendRespRaw) { if (msg.requestType != "BurstRequest") { return false } var usefulCons = connections.filter(function(c) { return msg.connId == c.id }); if (usefulCons.length != 1) { var errMsg = "Burst request for connection " + msg.connId + " corresponds to " + usefulCons.length + " connections",
                    errResp = new ErrResponse(errMsg);
                errResp.send(sendRespRaw); return true }

            function sendBuffer(buf) { var br = new BurstResponse(buf, msg);
                br.send(sendRespRaw) } usefulCons[0].flushBuffer(sendBuffer); return true };
        BurstRequest.prototype = Object.create(GenericRequest.prototype);
        BurstRequest.prototype.forSending = function() { return { requestType: "BurstRequest", connId: this.connection.id } };
        BurstRequest.prototype.getCallback = function() { return this.callback };
        module.exports.BurstRequest = BurstRequest }, { "./../arguments.js": 60, "./../log.js": 75, "./../responses.js": 83, "./generic.js": 81 }],
    81: [function(require, module, exports) { var genericRespHandler = require("./../responses.js").genericRespHandler,
            messageApi = require("./../messaging.js"),
            log = new(require("./../log.js").Log)("genericrequest");

        function GenericRequest() {} GenericRequest.prototype = { forSending: function() { throw Error("forSending not implemented.") }, send: function(cb, errorCb) { var self = this,
                    msg = this.forSending(),
                    hostId = this.hostId;
                messageApi.sendMessage(hostId, msg, function(resp) { genericRespHandler(resp, self, cb || function(err) { if (err) { throw err } }) }) } };
        module.exports.GenericRequest = GenericRequest }, { "./../log.js": 75, "./../messaging.js": 76, "./../responses.js": 83 }],
    82: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguments,
            GenericRequest = require("./generic.js").GenericRequest,
            util = require("./../util"),
            ArgsResponse = require("./../responses.js").ArgsResponse,
            ErrResponse = require("./../responses.js").ErrResponse,
            AckResponse = require("./../responses.js").AckResponse,
            log = new(require("./../log.js").Log)("methodrequest");

        function isNode() { if (typeof window === "undefined") return true; var backup = window,
                window_can_be_deleted = delete window;
            window = backup; return window_can_be_deleted }

        function MethodRequest(hostId, method, args, isReverser, noCallback, withError) { this.method = method;
            this.args = args instanceof Arguments ? args : new Arguments(args);
            this.hostId = hostId;
            this.isReverser = isReverser || false;
            this.noCallback = noCallback || false;
            this.withError = withError; if (!isNode()) { this.trace = (new Error).stack } if (this.args.forSending().filter(function(a) { return !!(a && a.isCallback) }).length > 1) { throw Error("We do not support more than one callback in arguments.") } } MethodRequest.prototype = Object.create(GenericRequest.prototype);
        MethodRequest.fromMessage = function(hostId, msg, respCb) { var args = new Arguments(msg.args, respCb); return new MethodRequest(hostId, msg.method, args) };

        function handleReverser(msg, connections, hostApi) { if (!connections && !msg.isReverser) return false; var req = MethodRequest.fromMessage(null, msg),
                response = connections.map(function(c) { return c.tryClosing(req) }).reduce(function(a, b) { return a || b }, false); if (msg.isReverser && !response) { console.warn("You told me " + JSON.stringify(msg) + " was a reverser but i found nothing to reverse."); if (msg.noCallback) { req.call(null, hostApi); return new ErrResponse("Tried to clean with " + msg.method + " but failed.", "warning") } return ArgsResponse.async(req, hostApi) } return response } var messagesReceived = 0;
        MethodRequest.maybeHandle = function(msg, hostApi, sendRespRaw, kw) { kw = kw || {}; var _sendRespRaw = function(sendMsg) { if (++messagesReceived % 1e3 == 0) { log.log("Sending 1000 messages") } if (sendMsg.responseType == "ErrResponse") { console.error(msg, "->", sendMsg) } sendRespRaw(sendMsg) }; if (msg.requestType != "MethodRequest") { return false } var resp = handleReverser(msg, kw.connections, hostApi); if (resp) { resp.send(_sendRespRaw); return true } sendRespRaw = sendRespRaw || function() {}; var sendArgsAsResponse = function(varArgs) { var argsArr = [].slice.call(arguments),
                        cbArgs = new Arguments(argsArr),
                        argsResp = new ArgsResponse(cbArgs); if (chrome && chrome.runtime && chrome.runtime.lastError && argsArr.length == 0) { new ErrResponse(chrome.runtime.lastError, "chrome.runtime.lastError").send(_sendRespRaw); return true } argsResp.send(_sendRespRaw) },
                methodArgs = new Arguments(msg.args, sendArgsAsResponse),
                methodCb = util.path2callable(hostApi, msg.method); if (!methodCb) { resp = new ErrResponse("Method " + msg.method + " not found.");
                resp.send(_sendRespRaw); return true } try { if (kw.updateArgs) kw.updateArgs(methodArgs);
                methodCb.apply(null, methodArgs.forCalling()); return true } catch (e) { resp = new ErrResponse({ message: "Error on calling " + msg.method + ":" + e.message, stack: e.stack }, "chrome.runtime.lastError");
                resp.send(_sendRespRaw); return true } if (msg.noCallback) {
                (new AckResponse).send(_sendRespRaw); return true } };
        MethodRequest.prototype.forSending = function() { var ret = { requestType: "MethodRequest", method: this.method, args: this.args.forSending(), noCallback: this.noCallback, isReverser: this.isReverser }; return ret };
        MethodRequest.prototype.call = function(sendResp, hostApi) { var self = this;

            function updateArgs(args) { self.args = args } MethodRequest.maybeHandle(this.forSending(), hostApi, sendResp || this.getCallback(), { updateArgs: updateArgs }) };
        MethodRequest.prototype.getCallback = function() { return this.args.getCallback() };
        MethodRequest.prototype.realCallback = function() { var self = this,
                callback = self.args.getCallback(); return function() { var args = new Arguments([].slice.call(arguments)),
                    resp = new ArgsResponse(args);
                callback.call(null, resp.forSending()) } };
        module.exports.MethodRequest = MethodRequest }, { "./../arguments.js": 60, "./../log.js": 75, "./../responses.js": 83, "./../util": 91, "./generic.js": 81 }],
    83: [function(require, module, exports) { module.exports.ErrResponse = require("./responses/error.js");
        module.exports.BurstResponse = require("./responses/burst.js");
        module.exports.ArgsResponse = require("./responses/arguments.js");
        module.exports.AckResponse = require("./responses/ack.js");
        module.exports.genericRespHandler = require("./responses/generic.js").genericRespHandler }, { "./responses/ack.js": 84, "./responses/arguments.js": 85, "./responses/burst.js": 86, "./responses/error.js": 87, "./responses/generic.js": 88 }],
    84: [function(require, module, exports) { var GenericResponse = require("./generic.js").GenericResponse;
        require("./../setimmediate.js");

        function AckResponse() {} AckResponse.maybeHandle = function(msg, request, doneCb) { if (msg.responseType != "AckResponse") return false;
            setImmediate(doneCb); return true };
        AckResponse.prototype = Object.create(GenericResponse.prototype);
        AckResponse.prototype.forSending = function() { return { responseType: "AckResponse" } };
        module.exports = AckResponse }, { "./../setimmediate.js": 90, "./generic.js": 88 }],
    85: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguments,
            GenericResponse = require("./generic.js").GenericResponse;
        require("./../setimmediate.js");

        function ArgsResponse(args) { this.cbArgs = args } ArgsResponse.async = function(mr, hostApi) { var resp = new ArgsResponse;
            resp.mr = mr;
            resp.hostApi = hostApi; return resp };
        ArgsResponse.maybeHandle = function(msg, request, doneCb) { if (msg.responseType != "ArgsResponse") return false; if (!request.getCallback()) { doneCb(new Error("No real callback provided on the client.")); return true } var cbArgs = new Arguments(msg.args),
                callArgs = cbArgs.forCalling(),
                callback = request.getCallback();
            callback.apply(null, callArgs);
            doneCb && setImmediate(doneCb); return true };
        ArgsResponse.prototype = Object.create(GenericResponse.prototype);
        ArgsResponse.prototype.forSending = function() { return { responseType: "ArgsResponse", args: this.cbArgs.forSending() } };
        ArgsResponse.prototype.send = function(sendCb) { if (this.mr) { this.mr.call(sendCb, this.hostApi); return } sendCb(this.forSending()) };
        module.exports = ArgsResponse }, { "./../arguments.js": 60, "./../setimmediate.js": 90, "./generic.js": 88 }],
    86: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguments,
            DataArgument = require("./../arguments.js").DataArgument,
            log = new(require("./../log.js").Log)("burstresponse"),
            GenericResponse = require("./generic.js").GenericResponse,
            ArgsResponse = require("./arguments.js"),
            genericRespHandler = require("./generic.js").genericRespHandler;
        require("./../setimmediate.js");

        function BurstResponse(cbArgsArr, reqMessage) { this.cbArgsArr = cbArgsArr;
            this.callbackId = reqMessage.callbackId } var servedBurstMetrics = [];
        BurstResponse.maybeHandle = function(msg, request, doneCb) { if (msg.responseType != "BurstResponse") return false;

            function arrInQueue(responses, err) { if (err) { doneCb(err); return } if (responses.length == 0) { doneCb(); return } setImmediate(function() { var car = responses[0],
                        cdr = responses.slice(1); if (!request.closed) { genericRespHandler(car, request, arrInQueue.bind(null, cdr)); return } doneCb() }) }

            function maybeConcatData(msgs) { var dataSources = {},
                    concatArg = msgs.forEach(function(m, i) { if (!(m.args && DataArgument.canWrap(m.args[0]) && m.args.length == 1)) { dataSources[i] = m; return } var arg = m.args[0],
                            backup = arg.data;
                        arg.data = null; var token = JSON.stringify(arg);
                        arg.data = backup; var ret = dataSources[token]; if (ret) { dataSources[token] = ret.concat(arg); return } dataSources[token] = new DataArgument(arg) }); return Object.getOwnPropertyNames(dataSources).map(function(k) { var concatArg = dataSources[k]; if (concatArg instanceof DataArgument) { return new ArgsResponse(new Arguments([concatArg.forSending()])).forSending() } return concatArg }) } if (0) { servedBurstMetrics.push({ time: Date.now(), length: msg.cbArgsArr.length }); var totalRequests = servedBurstMetrics.reduce(function(sum, m) { return sum + m.length }, 0);
                log.log("Burst summary:", { requestPerSec: totalRequests * 1e3 / (Date.now() - servedBurstMetrics[0].time), totalRequests: totalRequests, currentRequests: msg.cbArgsArr.length }) } arrInQueue(maybeConcatData(msg.cbArgsArr)); return true };
        BurstResponse.prototype = Object.create(GenericResponse.prototype);
        BurstResponse.prototype.forSending = function() { return { responseType: "BurstResponse", cbArgsArr: this.cbArgsArr, callbackId: this.callbackId } };
        module.exports = BurstResponse }, { "./../arguments.js": 60, "./../log.js": 75, "./../setimmediate.js": 90, "./arguments.js": 85, "./generic.js": 88 }],
    87: [function(require, module, exports) { var GenericResponse = require("./generic.js").GenericResponse;

        function ErrResponse(error, type) { this.error = error;
            this.type = type } ErrResponse.maybeHandle = function(msg, request, doneCb) { if (msg && msg.responseType != "ErrResponse") return false; var rawError = msg ? msg.err : "Undefined message, probably host is disconnected."; if (request.trace) { console.warn("Received error:", msg.err);
                console.warn(request.trace) } var withError = function(err, cb) { cb(); if (err) { console.error("Uncaught:", err) } }; if (request.getCallback()) {
                (request.withError || withError)(rawError, request.getCallback());
                doneCb(); return true } doneCb(rawError); return true };
        ErrResponse.prototype = new GenericResponse;
        ErrResponse.prototype.forSending = function() { return { responseType: "ErrResponse", err: this.error, type: this.type } };
        module.exports = ErrResponse }, { "./generic.js": 88 }],
    88: [function(require, module, exports) {
        function GenericResponse() {} GenericResponse.prototype = { send: function(sendCb) { return sendCb(this.forSending()) }, forSending: function() { throw new Error("Not implemented") } };

        function genericRespHandler(msg, request, done) {
            function doneCb(err) { done(err) } var responseTypesArr = [require("./error.js"), require("./burst.js"), require("./arguments.js"), require("./ack.js")]; if (!responseTypesArr.some(function(RT) { return RT.maybeHandle(msg, request, doneCb) })) { done(new Error("Couldn't handle message: " + JSON.stringify(msg))) } } module.exports.GenericResponse = GenericResponse;
        module.exports.genericRespHandler = genericRespHandler }, { "./ack.js": 84, "./arguments.js": 85, "./burst.js": 86, "./error.js": 87 }],
    89: [function(require, module, exports) { var HostConnection = require("./hostconnection.js").HostConnection,
            MethodRequest = require("./requests.js").MethodRequest,
            BurstRequest = require("./requests.js").BurstRequest,
            ErrResponse = require("./responses.js").ErrResponse,
            AckResponse = require("./responses.js").AckResponse,
            log = new(require("./log.js").Log)("server"),
            messageApi = require("./messaging.js"),
            BootstrapHost = require("./bootstraphost.js").BootstrapHost;
        require("./setimmediate.js"); var state = { connections: [], keepalives: [], uniqueId: 0, version: messageApi.version };

        function HostKeepAliveConnection(port, closeCb) { log.log("Creating host keepalive"); var self = this;
            this.port = port;
            port.onDisconnect.addListener(this.close.bind(this));
            this.closeCb = closeCb.bind(null, this);
            this.clientId = state.uniqueId++;
            this.portConf = JSON.parse(port.name);
            port.onDisconnect.addListener(function() { log.log("Client disconnected:" + self.clientId) });
            port.postMessage({ clientId: self.clientId, version: state.version });
            log.log("Client connected:" + self.clientId);
            this.closed = false } HostKeepAliveConnection.is = function(port) { return JSON.parse(port.name).type == "KeepAliveConnection" };
        HostKeepAliveConnection.prototype = { maybeClose: function(c) { if (c.clientId == this.clientId) { c.close() } }, close: function() { if (this.closed) return;
                this.closed = true;
                this.closeCb();
                this.port.disconnect();
                this.port = null } };

        function getKeepAliveConnection(hostId, connectCb, disconnectCb, timeout) { messageApi = require("./messaging.js"); var portName = JSON.stringify({ type: "KeepAliveConnection" }),
                port = messageApi.connect(hostId, { name: portName }); if (disconnectCb) { log.log("Detected disconnect cb on client keepalive");
                port.onDisconnect.addListener(function() { disconnectCb() }) } var gotToken = false;
            port.onMessage.addListener(function tokenizer(msg) { port.onMessage.removeListener(tokenizer);
                gotToken = true; if (!msg) { log.warn("Empty message came on keepalive port.");
                    disconnectCb("no_host");
                    port.disconnect(); return true } if (msg && msg.version && msg.version.split(".")[0] != messageApi.version.split(".")[0]) { log.warn("Received bad app version:", msg.version);
                    disconnectCb("bad_version");
                    port.disconnect(); return true } if (typeof msg.clientId !== "number") { return false } var token = { port: port, version: msg.version, clientId: msg.clientId, disconnectCb: disconnectCb };
                setImmediate(connectCb.bind(null, token)) }); if (typeof timeout !== "undefined") { setTimeout(function() { if (gotToken) return;
                    log.warn("Host keepalive connection was silent for too long.");
                    disconnectCb("timeout");
                    port.disconnect(); return true }, timeout) } }

        function HostServer(apiRoot) { if (state.apiRoot === apiRoot) { throw Error("You are trying to host a second server on the same api.") } var adhoc = require("./adhoc/host.js");
            apiRoot.messageApi = messageApi;
            apiRoot.serverId = Math.random();
            state.apiRoot = apiRoot;
            state.bootstrapHost = new BootstrapHost;
            adhoc.setupAdHoc(state);

            function closeCb(connection) { var len = state.connections.length;
                state.connections = state.connections.filter(function(c) { return c !== connection });
                log.log("Cleanined:", connection.repr(), "(before: ", len, "after: ", state.connections.length, ")") }

            function tabDiedCb(keepalive) { state.connections.forEach(function(c) { keepalive.maybeClose(c) });
                state.keepalives = state.keepalives.filter(function(ka) { return !ka.closed }) }

            function messageHandle(message, sender, sendResp) { return MethodRequest.maybeHandle(message, apiRoot, sendResp, { connections: state.connections }) || BurstRequest.maybeHandle(message, state.connections, sendResp) || new ErrResponse("Nothing to do for message." + JSON.stringify(message), false).send(sendResp) }

            function connectHandle(port) { if (HostKeepAliveConnection.is(port)) { var keepalive = new HostKeepAliveConnection(port, tabDiedCb);
                    state.keepalives.push(keepalive); return } var conn = new HostConnection(port, apiRoot, function() { closeCb(conn) });
                state.connections.push(conn) } messageApi.onConnectExternal.addListener(connectHandle);
            log.log("Listening on connections...");
            messageApi.onMessageExternal.addListener(messageHandle);
            log.log("Listening on messages...");

            function cleanUp() { log.log("Cleaning connect");
                messageApi.onConnectExternal.removeListener(connectHandle);
                log.log("Cleaning message");
                messageApi.onMessageExternal.removeListener(messageHandle);
                state.connections.forEach(function(c) { c.close() });
                state.keepalives.forEach(function(k) { k.close() });
                state.bootstrapHost.cleanup();
                state.apiRoot = null } return cleanUp } module.exports.state = state;
        module.exports.HostServer = HostServer;
        module.exports.getKeepAliveConnection = getKeepAliveConnection;
        module.exports.messageApi = messageApi }, { "./adhoc/host.js": 58, "./bootstraphost.js": 68, "./hostconnection.js": 74, "./log.js": 75, "./messaging.js": 76, "./requests.js": 79, "./responses.js": 83, "./setimmediate.js": 90 }],
    90: [function(require, module, exports) {
        (function(global) {
            function isApp() { return !!chrome.runtime.getManifest } if (!(global.postMessage && global.addEventListener) || isApp()) { global.setImmediate = global.setTimeout.bind(global);
                global.clearTimeout = global.clearTimeout.bind(global) } else {
                (function() { "use strict"; var i = 0; var timeouts = {}; var messageName = "setImmediate" + (new Date).getTime();

                    function post(fn) { if (i === 4294967296) i = 0; if (++i in timeouts) throw new Error("setImmediate queue overflow.");
                        timeouts[i] = fn;
                        global.postMessage({ type: messageName, id: i }, "*"); return i }

                    function receive(ev) { if (ev.source !== window) return; var data = ev.data; if (data && data instanceof Object && data.type === messageName) { ev.stopPropagation(); var id = ev.data.id; var fn = timeouts[id]; if (fn) { delete timeouts[id];
                                fn() } } }

                    function clear(id) { delete timeouts[id] } global.addEventListener("message", receive, true);
                    global.setImmediate = post;
                    global.clearImmediate = clear })() } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    91: [function(require, module, exports) {
        function errorThrower(name) { return function() { throw new Error("No such method: " + name) } }

        function arrToBuf(hex) { var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer } module.exports.arrToBuf = arrToBuf;

        function bufToArr(bin) { var bufferView = new Uint8Array(bin); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes } module.exports.bufToArr = bufToArr;

        function path2callable(object, name, callable) { var names = name.split("."),
                method = names.pop(),
                obj = names.reduce(function(ob, meth) { return ob[meth] }, object) || object,
                self = this; if (!obj[method]) { console.warn("Tried to resolve bad object path: " + name);
                console.warn("Server:", object); return null } return obj[method].bind(obj) } module.exports.path2callable = path2callable }, {}],
    92: [function(require, module, exports) { module.exports.NpapiChrome = require("./src/chrome.js").Chrome }, { "./src/chrome.js": 94 }],
    93: [function(require, module, exports) {
        var Event = require("corelib").Event,
            scheduler = require("corelib").scheduler,
            checkargs = require("corelib").typecheck,
            getLog = require("corelib").getLog;

        function AsyncNpapi(obj, isAlive) {
            checkargs(arguments, ["object", "callback"]);
            var self = this,
                defaultKeys = Object.getOwnPropertyNames({}.__proto__);
            this.log = getLog("AsyncNpapi");
            this.npapi = obj;
            this.isAlive = isAlive;
            this.onError = new Event;
            this.jsLevelClosed = false;
            this.queue = [];
            obj.setErrorCallback(function(err) { self.onError.dispatch(err) });
            Object.getOwnPropertyNames(this.npapi).forEach(function(n) {
                if (defaultKeys.indexOf(n) != -1) return;

                function __action(cb, args) { if (self.jsLevelClosed) { self.log.warn("Calling on closed:", n, args);
                        self.onError.dispatch("device-lost");
                        cb(); return } if (!self.npapi[n]) { self.log.error("Method ", n, "does not exist (", args, ")");
                        self.onError.dispatch("plugin-died"); return } var ret, date = Date.now(); try { ret = self.npapi[n].apply(self.npapi, args) } catch (e) { self.onError.dispatch({ error: e, arguments: args, method: n });
                        self.log.log("Called:", n, "(", args, ") Failed:", e, "time:", Date.now() - date); return } self.log.log("Called:", n, "(", args, ") =>", ret, "time:", Date.now() - date);
                    cb(ret) } self[n] = function() {
                    var args = [].slice.call(arguments),
                        cb = args.pop(),
                        self = this;
                    checkargs([cb], ["callback"]);
                    if (n.slice(0, 4) == "wait") { __action(cb, args); return }

                    function __notifyingCb() { self.queue.shift();
                        self.queue[0] && scheduler.setTimeout(self.queue[0]); return cb.apply(null, arguments) } self.queue.push(__action.bind(null, __notifyingCb, args));
                    if (self.queue.length === 1) self.queue[0]();
                }
            })
        }
        AsyncNpapi.prototype = { jsLevelClose: function() { this.jsLevelClosed = true;
                this.onError.close() }, isBusy: function() { return this.queue.length !== 0 } };
        module.exports.AsyncNpapi = AsyncNpapi
    }, { corelib: 117 }],
    94: [function(require, module, exports) { var Serial = require("./serial.js").Serial,
            Runtime = require("./runtime.js").Runtime;

        function Chrome(npapi) { this.runtime = new Runtime(npapi, this);
            this.serial = new Serial(npapi, this);
            this.local = { clientId: "we-are-on-firefox" } } module.exports.Chrome = Chrome }, { "./runtime.js": 97, "./serial.js": 98 }],
    95: [function(require, module, exports) { var AsyncNpapi = require("./asyncify.js").AsyncNpapi,
            Event = require("corelib").Event,
            scheduler = require("corelib").scheduler,
            binToBuf = require("corelib").bitToBuf,
            bufToBin = require("corelib").bufToBin,
            checkargs = require("corelib").typecheck,
            makeSerialProps = require("./serialprops.js").makeSerialProps,
            getLog = require("corelib").getLog;

        function defaultConnectionInfo(cid, name, serial) { checkargs(arguments, ["number", "string", "object"]); return { connectionId: cid, paused: false, persistent: false, name: name, bufferSize: -1, receiveTimeout: -1, sendTimeout: -1, bitrate: Number(serial.getBaudrate()), dataBits: function(b) { switch (b) {
                        case 8:
                            return "eight"; break;
                        case 7:
                            return "seven"; break;
                        default:
                            throw Error("Unexpected byteSize: " + b + "(" + typeof b + ")") } }(Number(serial.getBytesize())), parityBit: function(p) { switch (p) {
                        case 0:
                            return "no"; break;
                        case 1:
                            return "odd"; break;
                        case 2:
                            return "even"; break;
                        default:
                            throw Error("Unexpected parity: " + p + "(" + typeof p + ")") } }(Number(serial.getParity())), stopBits: function(s) { switch (s) {
                        case 1:
                            return "one"; break;
                        case 2:
                            return "two"; break;
                        default:
                            throw Error("Unexpected stopbuts: " + s + "(" + typeof s + ")") } }(Number(serial.getStopbits())), ctsFlowControl: !!Number(serial.getFlowcontrol()), _serial: serial } }

        function bufsize(lastPackLen) { if (lastPackLen < 50) return 100; if (lastPackLen > 1e4) return 2e4; return lastPackLen * 2 }

        function systemPath(path) { var winPrefix = "\\\\.\\",
                com = "COM"; if (path.slice(0, com.length) === com) return winPrefix + path; return path }

        function userPath(path) { var winPrefix = "\\\\.\\",
                com = "COM"; if (path.slice(0, winPrefix.length + com.length) === winPrefix + com) return path.slice(winPrefix.length); return path }

        function Connection(path, connectionId, options, npapi) { checkargs(arguments, ["string", "number", "object", "object"]);
            this.log = getLog("Connection(" + connectionId + ")");
            this.connectionId = connectionId;
            this.path = path;
            this.npapi = npapi;
            this.onError = new Event;
            this.options = options;
            this.closed = true } Connection.prototype = { mkSerial: function() { if (this.serial) return true; var self = this,
                    syncSerial = new this.npapi.Serial(systemPath(this.path), makeSerialProps(this.options)); if (!syncSerial || syncSerial.error) { scheduler.setTimeout(function() { self.onError.dispatch(syncSerial.error) }); return false } this.serial = new AsyncNpapi(syncSerial, function(npapi) { return npapi && npapi.getPort && userPath(npapi.getPort()) === userPath(this.path) });
                this.serial.onError.addListener(this.handleError.bind(this));
                this.info = defaultConnectionInfo(this.connectionId, this.options.name || "", this.serial.npapi);
                this.closed = false; return true }, handleError: function(err) { this.log.warn("Error:", err); if (err && err.exception) { this.handleNpapiException(err.exception); return } console.error("Unknown error:", err) }, handleNpapiException: function() { var self = this,
                    exists = JSON.parse(this.npapi.getPorts()).some(function(p) { return userPath(p.port) === userPath(self.path) });
                this.onError.dispatch(!exists ? "device_lost" : "system_error") }, readBytes: function(done) { var self = this; if (this.closed) return;
                this.serial.isOpen(function(isOpen) { if (!isOpen) return;
                    self.serial.readBytes(1024, function(ret) { if (ret instanceof Array) { done(ret); return } self.log.warn("Unexpected return from readBytes:", ret);
                        scheduler.setTimeout(self.onError.dispatch.bind(self.onError, "system_error")) }); return }) }, safeOpen: function(cb) { var self = this;
                checkargs(arguments, ["callback"]); if (!this.mkSerial()) return;
                this.serial.isOpen(function(isOpen) { if (isOpen) { self.serial.close(function() { self.safeOpen(cb) }); return } self.serial.open(function() { self.serial.isOpen(cb) }) }) }, close: function(callback) { var s = this.serial,
                    cb = callback || function() {}; if (this.closed) { cb(true); return } this.onError.close();
                this.closed = true;
                s.isOpen(function(ok) { if (!ok) { cb(true); return } s.close(function() { s.isOpen(function(ok) { if (ok) { cb(false); return } cb(true) }) }) }) } };

        function createConnection(path, connectionId, options, npapi, callback) { var con = new Connection(path, connectionId, options, npapi);
            con.safeOpen(function(ok) { if (!ok) { callback(); return } callback(con) }) } module.exports.defaultConnectionInfo = defaultConnectionInfo;
        module.exports.makeSerialProps = makeSerialProps;
        module.exports.Connection = Connection;
        module.exports.createConnection = createConnection;
        module.exports.userPath = userPath;
        module.exports.systemPath = systemPath }, { "./asyncify.js": 93, "./serialprops.js": 99, corelib: 117 }],
    96: [function(require, module, exports) { var Event = require("corelib").Event,
            binToBuf = require("corelib").binToBuf,
            scheduler = require("corelib").scheduler;

        function eq(l1, l2) { return l1 === l2 }

        function neq(l1, l2) { return l1 !== l2 }

        function bytesPacket(connectionId, bytes) { return { connectionId: connectionId, data: binToBuf(bytes) } }

        function pipeBytes(done, connections, listeners) { if (!connections || !listeners || connections.length === 0 || listeners.length === 0) return;
            pipeBytes_(done, connections, listeners) }

        function pipeBytes_(done, connections, listeners) { if (connections.length === 0) { done(); return } connections[0].readBytes(function(bytes) { if (bytes.length !== 0) listeners.forEach(function(l) { l(bytesPacket(connections[0].connectionId, bytes)) });
                pipeBytes_(done, connections.slice(1), listeners) }) }

        function zipEvents(fn, ev1, ev2, etc) { var events = [].slice.call(arguments, 1),
                state = new Array(events.length);

            function maybeDispatch(evIndex, val) { state[evIndex] = val;
                fn.apply(null, state) } events.forEach(function(ev, index) { events[index].addListener(maybeDispatch.bind(null, index)) }) }

        function delayedEvent(ms) { var ret = new Event;
            ret.dispatch = function(oldDispatch) { var args = [].slice.call(arguments, 1);
                scheduler.setTimeout(function() { oldDispatch.apply(null, args) }, ms) }.bind(ret, ret.dispatch.bind(ret)); return ret }

        function OnReceive() { this.onListenersUpdate = new Event;
            this.onConnectionsUpdate = new Event;
            this.onRead = delayedEvent(50);
            this.listeners = []; var _pipeBytes = pipeBytes.bind(null, this.onRead.dispatch.bind(this.onRead));
            zipEvents(_pipeBytes, this.onConnectionsUpdate, this.onListenersUpdate, this.onRead); var cl = function(msgs) { var args = arguments; return function() { console.log.apply(console, args) } };
            this.onConnectionsUpdate.addListener(cl("Connections update"));
            this.onListenersUpdate.addListener(cl("Listeners update")) } OnReceive.prototype = { addListener: function(l) { this.listeners.push(l);
                this.onListenersUpdate.dispatch(this.listeners) }, removeListener: function(l) { this.listeners = this.listeners.filter(neq.bind(null, l));
                this.onListenersUpdate.dispatch(this.listeners) }, hasListener: function(l) { return this.listeners.some(eq.bind(null, l)) }, close: function() { this.onRead.close();
                this.onConnectionsUpdate.close();
                this.onListenersUpdate.close() } };
        module.exports.OnReceive = OnReceive }, { corelib: 117 }],
    97: [function(require, module, exports) {
        function createLastError(val) { return { read: false, value: val } }

        function Runtime(npapi, chrome) { this._lastError = createLastError(null);
            this.npapi = npapi;
            Object.defineProperty(this, "lastError", { get: function() { if (this._lastError) { this._lastError.read = true } return this._lastError.value } }) } Runtime.prototype = { platformInfo: { os: "unknown", arch: "unknown" }, withLastErrorCb: function(lastError, cb) { var self = this; return function() { var oldLastError = self._lastError;
                    self._lastError = createLastError(lastError);
                    cb(); if (!self._lastError.read) { console.error("chrome.runtime.lastError MUST be checked:", self._lastError.value) } self._lastError = oldLastError } }, getManifestAsync: function(cb) { cb({ version: this.npapi.version }) }, getPlatformInfo: function(cb) { cb(this.platformInfo) }, setPlatformInfo: function(info, cb) { this.platformInfo = info;
                cb(true) } };
        module.exports.Runtime = Runtime }, {}],
    98: [function(require, module, exports) { var Event = require("corelib").Event,
            indirectEvent = require("corelib").indirectEvent,
            scheduler = require("corelib").scheduler,
            bufToBin = require("corelib").bufToBin,
            binToBuf = require("corelib").binToBuf,
            getLog = require("corelib").getLog,
            createConnection = require("./connection.js").createConnection,
            userPath = require("./connection.js").userPath,
            Connection = require("./connection.js").Connection,
            checkargs = require("corelib").typecheck,
            OnReceive = require("./onreceive.js").OnReceive;

        function notimplemented(method) { throw Error("Sorry, " + method + " not implemented.") }

        function async(cb, _args) { var args = [].slice.call(arguments, 1);
            scheduler.setTimeout(function() { cb.apply(null, args) }) }

        function Serial(npapi, chrome) { var self = this;
            this.log = getLog("NpapiSerialWrap");
            this.log.log = function() {};
            this.chrome = chrome;
            this.npapi = npapi;
            checkargs([npapi, chrome], ["object", "object"]);
            checkargs([chrome.runtime], ["object"]);
            this.connections = {};
            this.connectionId = 0;
            this.onConnectionsUpdate = new Event;
            this.onReceiveError = new Event;
            this.onReceive = new OnReceive; var connectionMethods = ["setControlSignals", "getControlSignals", "setBreak", "clearBreak", "flush", "send", "getConnection", "update", "setPaused", "getInfo"];
            connectionMethods.forEach(function(m) { self[m] = self._wrappedConnectionMethod(m) }) } Serial.prototype = { close: function() { var self = this;
                Object.getOwnPropertyNames(this.connections).forEach(function(c) { var con = self.connections[c];
                    con.close() });
                this.onReceive.close();
                this.onReceiveError.close() }, _connectionsLength: function() { return Object.getOwnPropertyNames(this.connections).length }, _forConnections: function(cb, endCb, connections) { var self = this,
                    _connections = connections || Object.getOwnPropertyNames(this.connections).map(function(c) { return self.connections[c] }),
                    next = function() { self._forConnections(cb, endCb, _connections.slice(1)) };
                async(function() { if (_connections.length === 0) { endCb && endCb(); return } var con = self.connections[_connections[0].connectionId]; if (!con) { next(); return } if (cb.length < 2) { cb(_connections[0]);
                        next(); return } cb(_connections[0], next) }) }, _doSetBreak: function(connection, val, callback) { connection.serial.setBreak(val, function() { callback(true) }) }, _deleteConnection: function(connectionId) { var c = this.connections[connectionId]; if (!(c && c instanceof Connection)) { this.log.error("Deleting nonexistent id:", connectionId, this.connections); return } c.close();
                this.connections[connectionId] = null;
                delete this.connections[connectionId];
                this.dispatchConnectionsUpdate() }, dispatchConnectionsUpdate: function() { var cnx = this.connections,
                    self = this;
                scheduler.setTimeout(function() { self.onReceive.onConnectionsUpdate.dispatch(Object.getOwnPropertyNames(cnx).map(function(k) { return cnx[k] })) }) }, _getConnection: function(connectionId, noLastError, callback) { var connection = this.connections[connectionId],
                    self = this;

                function fail(msg, firstTimeLost) { self._deleteConnection(connectionId); if (firstTimeLost) self.onReceiveError.dispatch({ connectionId: connectionId, error: "device-lost" }); if (noLastError) { callback(); return } self.chrome.runtime.withLastErrorCb(msg, callback)() } if (!connection || connection.closed) { fail("No such connection.", false); return } connection.serial.isOpen(function(ok) { if (!ok) { fail("Connection was lost.", true); return } callback(connection) }) }, _wrappedConnectionMethod: function(method) { return function() { var args = [].slice.call(arguments),
                        connectionId = arguments[0],
                        callback = args[args.length - 1],
                        self = this;
                    checkargs([connectionId, callback], ["number", "callback"], callback);
                    this._getConnection(connectionId, false, function(c) { if (!c) { callback(); return } self.__proto__[method].apply(self, [c].concat(args.slice(1))) }) } }, handleErrors: function(connectionId, error) { this.log.warn("Dispatching error(", connectionId, "):", error);
                this.onReceiveError.dispatch({ connectionId: connectionId, error: error }) }, getDevices: function(cb) { checkargs(arguments, ["callback"]); var self = this,
                    devs = JSON.parse(self.npapi.getPorts()),
                    normalDevs = devs.map(function(d) { return { path: userPath(d.port) } });
                Object.getOwnPropertyNames(this.connections).forEach(function(cid) { var con = self.connections[cid],
                        portExists = normalDevs.some(function(dev) { return !con.closed && dev.path === userPath(con.path) }); if (portExists) return;
                    self._deleteConnection(cid);
                    self.onReceiveError.dispatch({ connectionId: cid, error: "device_lost" }) });
                async(cb, normalDevs) }, connect: function(path, options, callback) { checkargs(arguments, ["string", "object", "callback"], callback);
                this.log.log("Connecting:", path, options); var self = this;
                createConnection(path, ++self.connectionId, options, this.npapi, function(connection) { if (!connection) { this.runtime.withLastErrorCb("Failed to open device", callback); return } self.connections[self.connectionId] = connection;
                    connection.onError.addListener(self.handleErrors.bind(self, self.connectionId));
                    self.dispatchConnectionsUpdate();
                    self.log.log("Connected to:", self.connectionId, "(open connections: ", self.connections, ")");
                    callback(connection.info) }) }, disconnect: function(connectionId, callback) { checkargs(arguments, ["number", "callback"], callback); var connection = this.connections[connectionId],
                    self = this;
                this.log.log("Disconnecting:", connectionId, this.connections); if (!connection) { this.log.warn("No connection for:" + connectionId);
                    this.log.warn("Connections:", this.connections);
                    async(callback, false); return } connection.close(function(ok) { ok && self._deleteConnection(connectionId, "lost");
                    callback(ok) }) }, update: function(connectionId, options, callback) { checkargs(arguments, ["number", "object", "callback"], callback) }, setPaused: function(connectionId, paused, callback) { notimplemented("setPaused") }, getInfo: function(connectionInfo, callback) { callback(connectionInfo) }, getConnections: function(callback) { checkargs(arguments, ["callback"], callback); var self = this,
                    ret = [];
                this._forConnections(function(con, done) { con.serial.isOpen(function(ok) { if (ok) { ret.push(con.info || con);
                            done(); return } self.onReceiveError.dispatch({ connectionId: con.conectionId, error: "device_lost" });
                        self._deleteConnection(con.connectionId);
                        done() }) }, function() { callback(ret) }) }, send: function(connectionInfo, data, callback) { checkargs(arguments, ["any", "arraybuffer", "callback"], callback);
                this.log.log("sending on:", connectionInfo.connectionId); var arrData = bufToBin(data),
                    ser = connectionInfo.serial;
                ser.writeArray(arrData, function(writtenBytes) { callback({ bytesSent: Number(writtenBytes) }) }) }, flush: function(connectionInfo, callback) { checkargs(arguments, ["any", "callback"], callback); var ser = connectionInfo.serial;
                this.log.log("flushing on:", connectionInfo.connectionId);
                ser.flush(function() { callback(true) }) }, getControlSignals: function(connectionInfo, callback) { checkargs(arguments, ["any", "callback"], callback); var ser = connectionInfo.serial;
                ser.getCTS(function(cts) { ser.getDSR(function(dsr) { ser.getRI(function(ri) { ser.getCD(function(cd) { callback({ cts: !!Number(cts), dsr: !!Number(dsr), cd: !!Number(cd), ri: !!Number(ri) }) }) }) }) }) }, setControlSignals: function(connectionInfo, signals, callback) { checkargs(arguments, ["any", "object", "callback"], callback); var ser = connectionInfo.serial;
                ser.setDtrRts(!!signals.dtr, !!signals.rts, callback.bind(null, true)); if (0) { var noop = function(cb) { async(cb()) },
                        setRts = noop,
                        setDtr = noop; if (typeof signals.rts !== "undefined") setRts = function(cb) { ser.setRTS(signals.rts, cb) }; if (typeof signals.dtr !== "undefined") setDtr = function(cb) { ser.setDTR(signals.dtr, cb) };
                    setRts(function() { setDtr(function() { callback(true) }) }) } }, setBreak: function(connection, callback) { checkargs(arguments, ["any", "callback"], callback);
                this._doSetBreak(connection, true, callback) }, clearBreak: function(connection, callback) { checkargs(arguments, ["any", "callback"], callback);
                this._doSetBreak(connection, false, callback) } };
        module.exports.Serial = Serial }, { "./connection.js": 95, "./onreceive.js": 96, corelib: 117 }],
    99: [function(require, module, exports) { var checkargs = require("corelib").typecheck;

        function defaultTimeout(baudrate) { var constDivider = baudrate / 9 / 100 || 1,
                readTimeout = 1e3 / constDivider; return { inter_byte_timeout: 10, read_timeout_constant: readTimeout, read_timeout_multiplier: 0, write_timeout_constant: 0, write_timeout_multiplier: 10 } }

        function doDataBits(tracker, connection, ret) { delete tracker.dataBits; if (typeof connection.dataBits !== "undefined") { if (typeof connection.dataBits !== "number") { throw Error("Expected dataBits to be number but it's " + connection.dataBits) } switch (connection.dataBits) {
                    case "eight":
                        ret.bytesize = 8; break;
                    case "seven":
                        ret.bytesize = 7; break;
                    default:
                        throw Error("Bad dataBits value:" + connection.dataBits) } } }

        function doParity(tracker, connection, ret) { delete tracker.parity; if (typeof connection.parity !== "undefined") { switch (connection.parity) {
                    case "no":
                        ret.parity = 0; break;
                    case "odd":
                        ret.parity = 1; break;
                    case "even":
                        ret.parity = 2; break;
                    default:
                        throw Error("Bad parity value:" + connection.parity) } } }

        function doBitrate(tracker, connection, ret) { delete tracker.bitrate; if (typeof connection.bitrate !== "undefined") { if (typeof connection.bitrate !== "number") { throw Error("Expected bitrate to be number but it's " + connection.bitrate) } ret.baudrate = connection.bitrate } }

        function doTimeout(tracker, connection, ret) { ret.timeout = defaultTimeout(connection.bitrate);
            delete tracker.sendTimeout; if (connection.sendTimeout) ret.timeout.write_timeout_constant = connection.sendTimeout;
            delete tracker.receiveTimeout; if (connection.receiveTimeout) ret.timeout.read_timeout_constant = connection.receiveTimeout }

        function doName(tracker, connection, ret) { delete tracker.name; if (typeof connection.name !== "undefined") { if (typeof connection.name !== "string") throw Error("Bad name value (expected string): " + connection.name) } }

        function doStopBits(tracker, connection, ret) { delete tracker.stopBits; if (typeof connection.parity !== "undefined") { switch (connection.stopBits) {
                    case "one":
                        ret.stopbits = 1; break;
                    case "two":
                        ret.stopbits = 2; break;
                    default:
                        throw Error("Bad stopbits value:" + connection.stopBits) } } }

        function doCtsFlowControl(tracker, connection, ret) { delete tracker.ctsFlowControl; if (typeof connection.ctsFlowControl !== "undefined") ret.flowcontrol = !!connection.ctsFlowControl }

        function makeSerialProps(connection) { var ret = {},
                propertyTracker = {},
                leftovers = [];
            checkargs([connection.bitrate], ["number"]);
            Object.getOwnPropertyNames(connection).forEach(function(k) { propertyTracker[k] = connection[k] });
            doName(propertyTracker, connection, ret);
            doBitrate(propertyTracker, connection, ret);
            doTimeout(propertyTracker, connection, ret);
            doParity(propertyTracker, connection, ret);
            doDataBits(propertyTracker, connection, ret);
            doStopBits(propertyTracker, connection, ret);
            doCtsFlowControl(propertyTracker, connection, ret);
            leftovers = Object.getOwnPropertyNames(propertyTracker); if (leftovers.length > 0) { throw Error("Unsupported connection args: " + leftovers) } return ret } module.exports.makeSerialProps = makeSerialProps }, { corelib: 117 }],
    100: [function(require, module, exports) { module.exports.backends = require("./lib/backends.js").backends;
        module.exports.PollAvailable = require("./lib/pollavailability.js").PollAvailable;
        module.exports.NpapiAvailable = require("./lib/npapiavailability.js").NpapiAvailable;
        module.exports.AppAvailable = require("./lib/appavailability.js").AppAvailable;
        module.exports.CodebenderAvailable = require("./lib/codebenderavailability.js").CodebenderAvailable;
        module.exports.PageAvailable = require("./lib/iframeavailability.js").PageAvailable;
        module.exports.provideAvailabilityToPage = require("./lib/iframeavailability.js").provideAvailabilityToPage }, { "./lib/appavailability.js": 101, "./lib/backends.js": 103, "./lib/codebenderavailability.js": 104, "./lib/iframeavailability.js": 112, "./lib/npapiavailability.js": 113, "./lib/pollavailability.js": 115 }],
    101: [function(require, module, exports) {
        (function(global) { var backends = require("./backends.js").backends,
                Available = require("./availability.js").Available,
                errors = require("./errors.js"),
                checkVersion = require("corelib").checkVersion,
                scheduler = require("corelib").scheduler,
                compareVersions = require("corelib").compareVersions,
                Event = require("corelib").Event; var SHUTDOWN = 0,
                DISCONNECTED = 1,
                CONNECTED = 2;

            function canHaveIds(appIds, done) { if (appIds.length === 0) { done(false); return } if (!global.chrome || !global.chrome.runtime || !global.chrome.runtime.connect) { done(false); return } var p = global.chrome.runtime.connect(appIds[0], { name: "error-causer" }); if (!p || !p.onDisconnect || !p.onDisconnect.addListener || !p.postMessage || !p.disconnect) { canHaveIds(appIds.slice(1), done); return } var to = scheduler.setTimeout(function() { to = null;
                    p.disconnect();
                    done(true) }, 1e3);
                p.onDisconnect.addListener(function() { if (!to) return;
                    scheduler.clearTimeout(to);
                    canHaveIds(appIds.slice(1), done) });
                p.postMessage({}) }

            function AppAvailable() { Available.call(this);
                this.setupClient = backends.app().client.setupClient } AppAvailable.prototype = Object.create(Available.prototype);
            AppAvailable.prototype.canHave = function(done) { canHaveIds(["magknjdfniglanojbpadmpjlglepnlko", "jommgdhcpkjoikkjcnpafeofedlfphfb"], done) };
            AppAvailable.prototype.connectionId = function() { return this.api && this.api.local && typeof this.api.local.clientId === "number" ? this.api.local.clientId : null };
            AppAvailable.prototype.isConnected = function() { return this.api && this.api.local && this.api.local.token };
            AppAvailable.prototype.checkVersion = function(callback) { var self = this;
                Available.prototype.checkVersion.call(this, function(ok) { if (!self.api || !ok) { callback(false); return } self.api.runtime.getManifestAsync(function(man) { if (!man) { callback(false); return }

                        function f() { callback(false) }

                        function s() { callback(true) } compareVersions(man.version, "1.0.0.8", { lt: f, eq: s, gt: s, err: f }) }) }) };
            AppAvailable.prototype.connect = function(timeout) { var self = this;
                this.api = this.api || {};
                this.setupClient(this.api, function() { self.state = CONNECTED;
                    self.onFound.dispatch() }, function() { self.disconnect(function() { self.onLost.dispatch() }) }, function(err) { if (err === "already_connected") { self.state = CONNECTED;
                        self.onFound.dispatch(); return } self.onError.dispatch(errors.APP_ERROR.copy({ error: err })) }, timeout) };
            AppAvailable.prototype.disconnect = function(done, dispatchEvents) { if (this.state <= DISCONNECTED) { if (done) done(); return } this.state = DISCONNECTED;
                this.api.local.disconnect(done, !dispatchEvents) };
            module.exports.AppAvailable = AppAvailable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./availability.js": 102, "./backends.js": 103, "./errors.js": 105, corelib: 117 }],
    102: [function(require, module, exports) { var Event = require("corelib").Event; var SHUTDOWN = 0,
            DISCONNECTED = 1,
            CONNECTED = 2; var uniqueId = 0;

        function Available() { this.state = SHUTDOWN;
            this.api = null;
            this.id = uniqueId++;
            this.onFound = new Event;
            this.onLost = new Event;
            this.onError = new Event;
            this.closed = true;
            this.initCb = null } Available.prototype = { connectionId: function() { return this.isConnected() ? this.uniqueId : null }, init: function(cb, timeout) { if (cb && !this.onFound.hasListener(cb)) { this.onFound.removeListener(this.initCb);
                    this.initCb = cb;
                    this.onFound.addListener(this.initCb) } if (this.isConnected()) { this.onFound.dispatch(); return } this.connect(timeout || 4e3) }, isConnected: function() { return this.state === CONNECTED }, shutdown: function(done, dispatchEvents) { var self = this;
                this.disconnect(function() { if (self.state <= SHUTDOWN) { if (done) done(); return } self.state = SHUTDOWN;
                    self.onLost.close();
                    self.onFound.close();
                    self.onError.close(); if (done) done() }, dispatchEvents) }, withInited: function(callback) { var self = this; if (this.state >= CONNECTED) { callback(true); return }

                function cleanup() { self.onError.removeListener(fail_);
                    self.onLost.removeListener(fail_); if (self.initCb === initFn) { self.onFound.removeListener(self.initCb);
                        self.initCb = null } }

                function initFn() { cleanup();
                    callback(true) }

                function fail_() { cleanup();
                    callback(false) } this.init(initFn);
                this.onError.addListener(fail_);
                this.onLost.addListener(fail_) }, canHave: function(callback) { callback(true) }, checkVersion: function(callback) { var self = this;
                this.withInited(function(ok) { callback(ok) }) } };
        module.exports.Available = Available }, { corelib: 117 }],
    103: [function(require, module, exports) { module.exports.backends = { app: function() { return require("./../backends/chrome-app") }, npapi: function() { return require("./../backends/npapi-plugin") } } }, { "./../backends/chrome-app": 56, "./../backends/npapi-plugin": 92 }],
    104: [function(require, module, exports) { var Available = require("./availability.js").Available,
            NpapiAvailable = require("./npapiavailability.js").NpapiAvailable,
            PageAvailable = require("./iframeavailability.js").PageAvailable,
            AppAvailable = require("./appavailability.js").AppAvailable,
            platform = require("./platformcheck.js"),
            errors = require("./errors.js"),
            scheduler = require("corelib").scheduler,
            Event = require("corelib").Event;

        function tryAvailables(availables, done) { if (availables.length === 0) { done(null); return } scheduler.setTimeout(function() { availables[0].canHave(function(canHave) { if (canHave) { done(availables[0]); return } tryAvailables(availables.slice(1), done) }) }) }

        function CodebenderAvailable() { this.wrappedAvailable = null;
            this.buildargs = arguments;
            this.onError = new Event;
            this.onLost = new Event;
            this.onFound = new Event;
            this.state = 1 } CodebenderAvailable.prototype = Object.create(Available.prototype);
        CodebenderAvailable.prototype.mk = function(cls) { var availobj = Object.create(cls.prototype);
            cls.apply(availobj, this.buildargs); return availobj };
        CodebenderAvailable.prototype.delegateToWrapped = function(failCb, method) { var args = [].slice.call(arguments, 2),
                self = this; if (this.wrappedAvailable) { this.wrappedAvailable[method].apply(this.wrappedAvailable, args); return } platform.getAvailability(this.buildargs[0], function(avail) { if (!avail) { scheduler.setTimeout(self.noAvailableAvailable.bind(self)); return } self.wrapAvailable(avail);
                self[method].apply(self, args) }, failCb) };
        CodebenderAvailable.prototype.checkVersion = function(cb) { this.delegateToWrapped(function(message) { cb(false) }, "checkVersion", cb) };
        CodebenderAvailable.prototype.canHave = function(cb) { this.delegateToWrapped(function(message) { cb(false) }, "canHave", cb) };
        CodebenderAvailable.prototype.connect = function(timeout) { var self = this;
            this.delegateToWrapped(function(userMessage) { self.onError.dispatch(errors.BAD_PLATFORM.copy({ userMessage: userMessage, allErrors: arguments[1] })) }, "connect", timeout) };
        CodebenderAvailable.prototype.noAvailableAvailable = function() { this.onError.dispatch(errors.ELUSIVE_PLATFORM.copy()) };
        CodebenderAvailable.prototype.wrapAvailable = function(available) { delete this.state;
            this.__proto__ = available; var self = this;
            ["init", "connect", "disconnect", "destroy", "isConnected", "canHave", "checkVersion"].forEach(function(m) { self[m] = function() { var _this = this === self ? available : this;
                    available[m].apply(_this, arguments) } });
            ["onError", "onLost", "onFound"].forEach(function(ev) { available[ev].listeners = available[ev].listeners.concat(self[ev].listeners);
                available[ev].dispatcher = self[ev].dispatcher;
                self[ev] = available[ev] }) };
        module.exports.CodebenderAvailable = CodebenderAvailable }, { "./appavailability.js": 101, "./availability.js": 102, "./errors.js": 105, "./iframeavailability.js": 112, "./npapiavailability.js": 113, "./platformcheck.js": 114, corelib: 117 }],
    105: [function(require, module, exports) { var errno = require("corelib").errno,
            RetVal = require("corelib").RetVal;
        module.exports = errno({ APP_ERROR: new RetVal(2, "An error occured in the api."), BAD_PLATFORM: new RetVal(3, "Unsupported platform."), ELUSIVE_PLATFORM: new RetVal(4, "Undeterminable platform."), IFRAME_CONNECTION: new RetVal(5, "Failed to connect to iframe."), ILLEGAL_IFRAME_STATE: new RetVal(6, "Illegal connection state."), LOST_DURING_IFRAME_INIT: new RetVal(7, "The iframe was lost while we were initializing") }) }, { corelib: 117 }],
    106: [function(require, module, exports) { var util = require("./common.js"),
            typecheck = require("corelib").typecheck; var objectUid = 0;

        function CallbackRepo() { typecheck(arguments, []);
            this.id = objectUid++;
            this.uid = 0;
            this.fns = {} } CallbackRepo.prototype = { silence: function(id) { this.fns[id] = util.noop }, push: function(fn) { typecheck(arguments, ["function"]); var id = this.uid++;
                this.fns[id] = fn; return id }, get: function(id) { typecheck(arguments, ["number"]); var fn = this.fns[id]; if (!fn) { console.log("Get failed(" + this.id + "): " + id); return null } return fn }, extract: function(id) { var fn = this.get(id);
                delete this.fns[id]; return fn }, pop: function(id, args) { this.extract(id).apply(null, [].slice.call(arguments, 1)) }, peek: function(id, args) { typecheck(arguments, ["number", "varany"]); var fn = this.get(id); if (fn) return fn.apply(null, [].slice.call(arguments, 1));
                console.warn("Missing callback", id, args);
                console.warn("Available callbacks:", this.fns); return null } };
        module.exports.CallbackRepo = CallbackRepo }, { "./common.js": 107, corelib: 117 }],
    107: [function(require, module, exports) { var typecheck = require("corelib").typecheck,
            Event = require("corelib").Event,
            scheduler = require("corelib").scheduler;

        function path2Obj(obj, path) { typecheck(arguments, ["object", "array"]); if (path.length === 0) return obj; if (!obj[path[0]]) return null; return path2Obj(obj[path[0]], path.slice(1)) }

        function path2Method(obj, path) { var host = path2Obj(obj, path.slice(0, -1)),
                fn = path2Obj(obj, path); if (!fn) throw Error("No " + path + " in " + obj.toString()); return fn.bind(host) }

        function pathSetObject(root, val, path) { if (path.length <= 1) { root[path[0]] = val; return } if (!root[path[0]]) root[path[0]] = {};
            pathSetObject(root[path[0]], val, path.slice(1)) }

        function pathListToDict(list) { var ret = {};
            list.forEach(function(kv) { ret[kv.path] = kv.type }); return ret }

        function prefixObjectKeys(prefix, apiConf) { var ret = {};
            Object.getOwnPropertyNames(apiConf).forEach(function(key) { ret[prefix + key] = apiConf[key] }); return ret } module.exports.prefixObjectKeys = prefixObjectKeys;
        module.exports.path2Obj = path2Obj;
        module.exports.path2Method = path2Method;
        module.exports.pathSetObject = pathSetObject;
        module.exports.noop = function() {} }, { corelib: 117 }],
    108: [function(require, module, exports) {
        var typecheck = require("corelib").typecheck,
            typechecked = require("corelib").typechecked,
            tc = require("./typecheck.js"),
            util = require("./common.js"),
            SyncedObject = require("./syncedobject.js").SyncedObject;

        function mkEvent(syncobj, path) { typecheck(arguments, [SyncedObject, "array"]); var listeners = {},
                ids = {},
                uid = 0,
                listenPath = path.concat(["addListener"]),
                unlistenPath = path.concat(["removeListener"]);

            function unlisten(cb) { typecheck(arguments, ["function"]); if (typeof cb !== "function") return; var id = null;
                Object.getOwnPropertyNames(listeners).some(function(key) { if (listeners[key] !== cb) return false;
                    id = key; return true }); if (!id) return; var _ids = ids[id];
                delete listeners[id]; if (!_ids) return;
                delete ids[id];
                syncobj.remoteUnlistenCb(unlistenPath, [], util.noop, _ids.lid, _ids.rid) }

            function haslistener(cb) { typecheck(arguments, ["function"]); if (typeof cb !== "function") return false; return Object.getOwnPropertyNames(listeners).some(function(key) { return listeners[key] === cb && !!ids[key] }) }

            function listen(cb) { typecheck(arguments, ["function"]); if (typeof cb !== "function") return; if (haslistener(cb)) return; var id = uid++;
                listeners[id] = cb;
                syncobj.remoteListenCb(listenPath, [], cb, function(lid, rid) { if (listeners[id] === cb) { ids[id] = { lid: lid, rid: rid }; return } syncobj.remoteUnlistenCb(unlistenPath, [], util.noop, lid, rid) }) }

            function dispatch(varArgs) { syncobj.remote(path.concat(["forceDispatch"]), [].slice.call(arguments)) } return { hasListener: haslistener, addListener: listen, forceDispatch: dispatch, removeListener: unlisten } }

        function mkAsync(argNumber, target, syncobj, path) { typecheck(arguments, ["number", "object", SyncedObject, "array"]); return function() { var args = [].slice.call(arguments, 0, argNumber - 1),
                    cb = arguments[argNumber - 1];
                syncobj.remoteAsyncCb(path, args, cb) } }

        function fnAsAsync(target, syncobj, path) { typecheck(arguments, ["object", SyncedObject, "array"]); return { async: function() { var args = [].slice.call(arguments),
                        cb = args.pop(); return syncobj.remoteRetCb(path, args, cb) } } }

        function valueAsAsync(target, syncobj, path) { typecheck(arguments, ["object", SyncedObject, "array"]); return { get: function(cb) { typecheck(arguments, ["callback"]); return syncobj.rgetProperty(path, cb) } } }

        function async(types) { typecheck(arguments, ["array"]); return function(target, syncobj, path) { typecheck(arguments, ["object", SyncedObject, "array"]); var _async = mkAsync(types.length, target, syncobj, path); return typechecked(_async, types) } }

        function event(target, syncobj, path) { typecheck(arguments, ["object", SyncedObject, "array"]); return mkEvent(syncobj, path) }
        var apiConf = {
            "serial.getDevices": async(["function"]),
            "serial.connect": async(["string", tc.ConnectionOptions, "function"]),
            "serial.update": async(["number", tc.ConnectionOptions, "function"]),
            "serial.disconnect": async(["number", "function"]),
            "serial.setPaused": async(["number", "boolean", "function"]),
            "serial.getInfo": async(["number", "function"]),
            "serial.getConnections": async(["function"]),
            "serial.send": async(["number", ArrayBuffer, "function"]),
            "serial.flush": async(["number", "function"]),
            "serial.getControlSignals": async(["number", "function"]),
            "serial.setControlSignals": async(["number", "object", "function"]),
            "serial.setBreak": async(["number", "function"]),
            "serial.clearBreak": async(["number", "function"]),
            "serial.onReceive": event,
            "serial.onReceiveError": event,
            "usb.getDevices": async([tc.usbOptions, "callback"]),
            "usb.getUserSelectedDevices": async([tc.usbOptions, "callback"]),
            "usb.getConfigurations": async([tc.usbDevice, "callback"]),
            "usb.requestAccess": async([tc.usbDevice, "number", "callback"]),
            "usb.openDevice": async([tc.usbDevice, "callback"]),
            "usb.findDevices": async([tc.usbOptions, "callback"]),
            "usb.closeDevice": async([tc.usbHandle, "callback"]),
            "usb.setConfiguration": async([tc.usbHandle, "number", "callback"]),
            "usb.getConfiguration": async([tc.usbHandle, "callback"]),
            "usb.listInterfaces": async([tc.usbHandle, "callback"]),
            "usb.claimInterface": async([tc.usbHandle, "number", "callback"]),
            "usb.releaseInterface": async([tc.usbHandle, "number", "callback"]),
            "usb.setInterfaceAlternateSetting": async([tc.usbHandle, "number", "number", "callback"]),
            "usb.controlTransfer": async([tc.usbHandle, tc.usbTransferInfo, "callback"]),
            "usb.bulkTransfer": async([tc.usbHandle, tc.usbGenericTransferInfo, "callback"]),
            "usb.interruptTransfer": async([tc.usbHandle, tc.usbGenericTransferInfo, "callback"]),
            "usb.isochronousTransfer": async([tc.usbHandle, tc.usbTransferInfo, "callback"]),
            "usb.resetDevice": async([tc.usbHandle, "callback"]),
            "usb.onDeviceAdded": event,
            "usb.onDeviceRemoved": event,
            "runtime.getManifestAsync": async(["function"]),
            "runtime.getPlatformInfo": async(["function"]),
            "runtime.setPlatformInfo": async(["object", "function"])
        };
        module.exports.mkEvent = mkEvent;
        module.exports.mkAsync = mkAsync;
        module.exports.fnAsAsync = fnAsAsync;
        module.exports.valueAsAsync = valueAsAsync;
        module.exports.async = async;
        module.exports.event = event;
        module.exports.apiConf = apiConf
    }, { "./common.js": 107, "./syncedobject.js": 110, "./typecheck.js": 111, corelib: 117 }],
    109: [function(require, module, exports) {
        (function(global) { var typecheck = require("corelib").typecheck,
                SyncedObject = require("./syncedobject.js").SyncedObject,
                util = require("./common.js"),
                withError = require("./../witherror.js").withError,
                check = require("./typecheck.js");
            global.IFRAME_ID = "babelfish_iframe";

            function iframeExists(hostWin, id) { return !!hostWin.document.getElementById(id) }

            function nextIframeId(hostWin, startingId) { while (iframeExists(hostWin, global.IFRAME_ID + startingId)) startingId++; return global.IFRAME_ID + startingId }

            function buildIframe(hostWin, url) { typecheck(arguments, [check.win, "string"]); var element = hostWin.document.createElement("iframe");
                element.width = 0;
                element.height = 0;
                element.src = url;
                element.id = nextIframeId(hostWin, 0);
                hostWin.document.body.appendChild(element); return element }

            function appendToSyncApi(conf, syncobj) { typecheck(arguments, ["object", SyncedObject]);
                syncobj.api = syncobj.api || {};
                Object.getOwnPropertyNames(conf).forEach(function(key) { var path = ["api"].concat(key.split("."));
                    util.pathSetObject(syncobj, conf[key](syncobj.api, syncobj, path), path) }); return syncobj }

            function mkRelayObject(api, syncobj) { typecheck(arguments, ["object", SyncedObject]);
                syncobj.api = api;
                syncobj.preSendHook = function(msg) { msg.lastError = this.api && this.api.runtime && (this.api.runtime.lastError || null); return msg }; return syncobj }

            function mkSyncedIframeObject(win, url, id) { typecheck(arguments, [check.win, "string", "number"]); var iframe = buildIframe(win, url); return new SyncedObject(win, iframe.contentWindow, id) }

            function mkSyncedParentObject(win, id) { return new SyncedObject(win, win.parent, id) }

            function mkIframeApiObject(win, api, id) { typecheck(arguments, [check.win, "object", "number"]); return mkRelayObject(api, mkSyncedParentObject(win, id)) }

            function mkPageApiObject(win, url, apiConf, id) { typecheck(arguments, [check.win, "string", "object", "number"]); var syncobj = appendToSyncApi(apiConf, mkSyncedIframeObject(win, url, id));
                syncobj.handleReception = function(msg, process) { if (this.api && this.api.runtime) return withError(this.api, msg.lastError, process.bind(null, msg)); return process(msg) }; return syncobj } module.exports.SyncedObject = SyncedObject;
            module.exports.buildIframe = buildIframe;
            module.exports.appendToSyncApi = appendToSyncApi;
            module.exports.mkRelayObject = mkRelayObject;
            module.exports.mkSyncedIframeObject = mkSyncedIframeObject;
            module.exports.mkSyncedParentObject = mkSyncedParentObject;
            module.exports.mkIframeApiObject = mkIframeApiObject;
            module.exports.mkPageApiObject = mkPageApiObject;
            module.exports.conf = require("./configuration.js") }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./../witherror.js": 116, "./common.js": 107, "./configuration.js": 108, "./syncedobject.js": 110, "./typecheck.js": 111, corelib: 117 }],
    110: [function(require, module, exports) { var typecheck = require("corelib").typecheck,
            CallbackRepo = require("./callbackrepo.js").CallbackRepo,
            Event = require("corelib").Event,
            util = require("./common.js"),
            check = require("./typecheck.js");

        function methodHandler(syncobj, winref, evt) { typecheck(arguments, ["object", check.remoteWin, check.domEvent]); var msg = evt.data; if (evt.source !== winref || msg.syncId !== syncobj.id) return;
            syncobj.onMessage.dispatch(evt.data);
            syncobj.pendingMethods[msg.messageId] = evt.data; var method = util.path2Method(syncobj, msg.path); if (!method) { throw Error("No method:" + msg.path) }

            function process(msg) { return util.path2Method(syncobj, msg.path).apply(null, msg.args) } var ret = syncobj.handleReception(msg, process);
            delete syncobj.pendingMethods[msg.messageId] }

        function SyncedObject(win, winref, id) { typecheck(arguments, [check.win, check.winref, "number"]);
            this.id = id;
            this.winref = winref;
            this.win = win;
            this.messageId = 0;
            this.pendingMethods = {};
            this.handler = methodHandler.bind(null, this, winref);
            this.callbackRepo = new CallbackRepo;
            this.api = null;
            this.onMessage = new Event;
            win.addEventListener("message", this.handler, true) } SyncedObject.prototype = { handleReception: function(msg, process) { return process(msg) }, preSendHook: function(msg) { return msg }, remote: function(path, args) { this.winref.postMessage(this.preSendHook({ trace: (new Error).stack, syncId: this.id, messageId: this.messageId++, args: args, path: path }), "*") }, rcompose: function(methods) { typecheck(arguments, ["array"]); var self = this,
                    funcs = methods.map(function(m) { var callable = util.path2Method(self, m.path); return function() { return callable.apply(null, m.args.concat([].slice.call(arguments))) } }); return funcs.slice(1).reduce(function(res, fn) { return fn(res) }, funcs[0]()) }, remotePeekCb: function(id) { typecheck(arguments, ["number"]); var self = this; return function() { var args = [].slice.call(arguments);
                    self.remote(["callbackRepo", "peek"], [id].concat(args)) } }, remotePopCb: function(id) { typecheck(arguments, ["number"]); var self = this; return function() { var args = [].slice.call(arguments);
                    self.remote(["callbackRepo", "pop"], [id].concat(args)) } }, remotePop: function(id) { typecheck(arguments, ["number", "varany"]); var args = [].slice.call(arguments);
                this.remote(["callbackRepo", "pop"], args) }, "const": function(val, arg) { return val }, setProperty: function(path, val) { typecheck(arguments, ["array", "any"]);
                this.getProperty(path.slice(0, path.length - 1))[path[path.length]] = val; return true }, rsetProperty: function(path, val, cb) { typecheck(arguments, ["array", "any", "function"]);
                this.remoteRetCb(["setProperty"], [path, val], cb) }, getProperty: function(path) { typecheck(arguments, ["array"]); return path.reduce(function(obj, val) { return obj[val] }, this) }, rgetProperty: function(path, cb) { typecheck(arguments, ["array", "function"]);
                this.remoteRetCb(["getProperty"], [path], cb) }, remoteAsyncCb: function(path, args, cb) { typecheck(arguments, ["array", "array", "function"]); var cbId = this.callbackRepo.push(cb);
                this.remote(["rcompose"], [
                    [{ path: ["remotePopCb"], args: [cbId] }, { path: path, args: args }]
                ]) }, remoteListenCb: function(path, args, cb, getCbIds) { typecheck(arguments, ["array", "array", "function", "function"]); var localCbId = this.callbackRepo.push(cb),
                    self = this;
                this.remoteRetCb(["rcompose"], [
                    [{ path: ["remotePeekCb"], args: [localCbId] }, { path: ["callbackRepo", "push"], args: [] }]
                ], function(remoteCbId) { self.remoteRetCb(["rcompose"], [
                        [{ path: ["callbackRepo", "get"], args: [remoteCbId] }, { path: path, args: args }]
                    ], function() { getCbIds(localCbId, remoteCbId) }) }) }, remoteUnlistenCb: function(path, args, cb, localCbId, remoteCbId) { typecheck(arguments, ["array", "array", "callback", "number", "number"]); var self = this;
                self.callbackRepo.silence(localCbId);
                this.remoteRetCb(["rcompose"], [
                    [{ path: ["callbackRepo", "extract"], args: [remoteCbId] }, { path: path, args: args }, { path: ["const"], args: [true] }]
                ], function() { self.callbackRepo.extract(localCbId); return cb.apply(null, arguments) }) }, remoteRetCb: function(path, args, cb) { typecheck(arguments, ["array", "array", "callback"]); var cbId = this.callbackRepo.push(cb);
                this.remote(["rcompose"], [
                    [{ path: path, args: args }, { path: ["remotePop"], args: [cbId] }]
                ]) }, close: function() { typecheck(arguments, []);
                this.win.removeEventListener("message", this.handler) } };
        module.exports.methodHandler = methodHandler;
        module.exports.SyncedObject = SyncedObject }, { "./callbackrepo.js": 106, "./common.js": 107, "./typecheck.js": 111, corelib: 117 }],
    111: [function(require, module, exports) { var remoteWin = { postMessage: "function" },
            win = { document: { createElement: "function", getElementById: "function", body: { appendChild: "function", removeChild: "function" } }, addEventListener: "function", removeEventListener: "function" },
            connectInfo = "object",
            ConnectionOptions = "object",
            event = { addListener: "function", removeListener: "function" },
            port = { disconnect: "function", postMessage: "function", onDisconnect: event, onMessage: event },
            api = { connect: "function" },
            winref = { postMessage: "function" },
            msg = { onConnectExternal: event, onMessageExternal: event, connect: "function", sendMessage: "function" },
            id = { clientId: "number", hostId: "number" },
            domEvent = { source: remoteWin, data: "iframe" };
        module.exports = { usbDevice: { device: "number", vendorId: "number", productId: "number" }, usbConnectionHandle: { handle: "number", vendorId: "number", productid: "number" }, usbTransferInfo: "object", usbGenericTransferInfo: "object", usbOptions: "object", remoteWin: remoteWin, win: win, connectInfo: connectInfo, ConnectionOptions: ConnectionOptions, event: event, port: port, api: api, winref: winref, msg: msg, id: id, domEvent: domEvent } }, {}],
    112: [function(require, module, exports) {
        (function(global) { var hs = require("./iframe/index.js"),
                util = require("./iframe/common.js"),
                Available = require("./availability.js").Available,
                errors = require("./errors.js"),
                scheduler = require("corelib").scheduler,
                typecheck = require("corelib").typecheck,
                getLog = require("corelib").getLog,
                eventCheck = { addListener: "function", removeListener: "function", hasListener: "function" },
                checkAvail = { onError: eventCheck, onLost: eventCheck, onFound: eventCheck, connect: "function", connectionId: "function", init: "function" }; var SHUTDOWN = 0,
                DISCONNECTED = 1,
                NO_APP_CONNECTED = 1.5,
                CONNECTED = 2;

            function setupIndirectSyncobj(pageAvailable) { typecheck(arguments, [PageAvailable]); var availabilityConf = { onFound: hs.conf.event, onLost: hs.conf.event, onError: hs.conf.event, init: hs.conf.async(["function"]), checkVersion: hs.conf.async(["function"]), canHave: hs.conf.async(["function"]), state: hs.conf.valueAsAsync, connect: hs.conf.fnAsAsync, connectionId: hs.conf.fnAsAsync, disconnect: hs.conf.async(["function"]) }; return hs.mkPageApiObject(pageAvailable.win, pageAvailable.url, availabilityConf, 0) }

            function relayEvent(pa, eventName, syncAvailable) { typecheck(arguments, [PageAvailable, "string", { api: "object" }]); if (!syncAvailable) { console.error("No syncAvailable object to use to relay event."); return }

                function relayDispatch() { pa[eventName].dispatch.apply(pa[eventName], arguments) } pa.handlers[eventName] = relayDispatch;
                syncAvailable.api[eventName].addListener(relayDispatch) }

            function unrelayEvent(pa, eventName, syncAvailable) { typecheck(arguments, [PageAvailable, "string", { api: "object" }]); if (!syncAvailable) console.error("No syncAvailable object to use to unrelay event.");
                else syncAvailable.api[eventName].removeListener(pa.handlers[eventName]);
                delete pa.handlers[eventName] }

            function connectInternal(ifavailable, syncAvailable, retries, interval, cb) { typecheck(arguments, [PageAvailable, hs.SyncedObject, "number", "number", "callback"]); if (retries <= 0) { ifavailable.onError.dispatch(errors.IFRAME_CONNECTION.copy()); return } var r = scheduler.setTimeout(function() { connectInternal(ifavailable, syncAvailable, retries - 1, interval, cb) }, interval);
                ping(syncAvailable, function() { scheduler.clearTimeout(r); if (ifavailable.state >= NO_APP_CONNECTED) { cb(); return } ifavailable.setSyncAvailable(syncAvailable);
                    cb() }, retries) }

            function ping(available, cb, retries) { available.remoteRetCb(["const"], [true, true], cb) }

            function PageAvailable(url, win) { Available.call(this);
                this.url = url || "//babelfish.codebender.cc/testpage/iframe/iframe.html";
                this.win = win || global;
                this.syncAvailable = false;
                this.handlers = {};
                this.messageHandlerBound = this.messageHandler.bind(this);
                this.keepaliveState = {};
                this.log = getLog("Page available");
                Object.defineProperty(this, "state", { enumerable: true, configurable: false, get: function() { if (this.api && this.syncAvailable) return CONNECTED; if (!this.api && this.syncAvailable) return NO_APP_CONNECTED; if (!this.api && !this.syncAvailable) return DISCONNECTED;
                        console.error("Undefined state: {api:" + !!this.api + ", sync:" + !!this.syncAvailable + "}");
                        this.deinitChromeApi(); return DISCONNECTED } }); var self = this;
                this.onFound.modifyDispatcher(function(dispatch) { return function(l, varargs) { var args = [].slice.call(arguments);
                        self.probeState(function(iframeState) { if (iframeState === CONNECTED) { self.initChromeApi(function() { dispatch.apply(null, args) }); return } self.onLost.dispatch() }) } }) } PageAvailable.prototype = Object.create(Available.prototype);
            PageAvailable.prototype.canHave = function(done) { if (!global.location || !global.location.hostname) { done(false); return } var domain = global.location.hostname.split("."),
                    self = this; if (domain[domain.length - 2] === "codebender") { done(false); return } this.withInited(function(ok) { if (!ok) { done(false); return } self.syncAvailable.api.canHave(function(ok) { done(ok) }) }) };
            PageAvailable.prototype.checkVersion = function(callback) { var self = this;
                Available.prototype.checkVersion.call(this, function(ok) { if (!ok) { callback(ok); return } self.syncAvailable.api.checkVersion(callback) }) };
            PageAvailable.prototype.connect = function(timeout) { var self = this,
                    syncAvailable = this.syncAvailable || setupIndirectSyncobj(this);
                connectInternal(this, syncAvailable, 10, timeout, function() { self.syncAvailable.api.connect.async(timeout, function() { self.log.log("Remote connect called") }) }) };
            PageAvailable.prototype.messageHandler = function(msg) { var self = this; if (self.state < NO_APP_CONNECTED) return;
                scheduler.clearTimeout(this.keepaliveState.timeoutHandle);
                this.keepaliveState.timeoutHandle = scheduler.setTimeout(function() { if (self.state < NO_APP_CONNECTED) return;
                    self.probeState(function(iframeState) { if (self.state > iframeState) self.deinitChromeApi(); if (self.state < iframeState) self.onError.dispatch(errors.ILLEGAL_IFRAME_STATE.copy({ page: self.state, iframe: iframeState })) }) }, 2e3) };
            (function() { var probeQueue = [];
                PageAvailable.prototype.probeState = function(cb) { var self = this;

                    function probeFail() { probeQueue = [];
                        self.setSyncAvailable(null);
                        self.onLost.dispatch() }

                    function probeSuccess(iframeState) { scheduler.clearTimeout(to);
                        probeQueue.forEach(function(fn) { fn(iframeState) });
                        probeQueue = [] } if (!this.syncAvailable) { probeFail(); return } probeQueue.push(cb); if (probeQueue.length !== 1) return; var to = scheduler.setTimeout(probeFail, 2e3);
                    this.syncAvailable.api.state.get(probeSuccess) } })();
            PageAvailable.prototype.disconnect = function(done) { if (this.state <= DISCONNECTED) { done && done(); return } this.syncAvailable.api.disconnect(done || function() {});
                this.setSyncAvailable(null) };
            PageAvailable.prototype.cleanKeepalive = function() { scheduler.clearTimeout(this.keepaliveState.timeoutHandle) };
            PageAvailable.prototype.eventModifier = function(maybeSyncAvailable) { typecheck(arguments, ["any"]); if (!maybeSyncAvailable) return unrelayEvent.bind(null, this); if (!this.syncAvailable) return relayEvent.bind(null, this); if (maybeSyncAvailable !== this.syncAvailable) return function() { unrelayEvent.apply(null, arguments);
                    relayEvent.apply(null, arguments) }.bind(null, this) };
            PageAvailable.prototype.setSyncAvailable = function(maybeSyncAvailable) { typecheck(arguments, ["any"]); var self = this,
                    action = this.eventModifier(maybeSyncAvailable),
                    sa = maybeSyncAvailable || this.syncAvailable; if (sa === null) return null; if (!maybeSyncAvailable) { this.syncAvailable.onMessage.removeListener(this.messageHandlerBound);
                    this.deinitChromeApi() } if (maybeSyncAvailable) maybeSyncAvailable.onMessage.addListener(this.messageHandlerBound);
                action("onError", sa);
                action("onLost", sa);
                action("onFound", sa);
                this.syncAvailable = maybeSyncAvailable; return sa };
            PageAvailable.prototype.initChromeApi = function(cb) { var self = this;
                this.syncConnectionId(function() { if (self.state < NO_APP_CONNECTED) { self.deinitChromeApi();
                        self.onError.dispatch(errors.LOST_DURING_IFRAME_INIT.copy()); return } if (this.api) { cb(); return } var serialApiConf = util.prefixObjectKeys("api.", hs.conf.apiConf);
                    hs.appendToSyncApi(serialApiConf, self.syncAvailable);
                    self.api = self.syncAvailable.api.api;
                    cb() }) };
            PageAvailable.prototype.syncConnectionId = function(cb) { var self = this; if (!this.syncAvailable) { this.deinitConnectionId();
                    cb(); return } this.syncAvailable.api.connectionId.async(function(cid) { self.connectionId = function() { return cid };
                    cb() }) };
            PageAvailable.prototype.deinitConnectionId = function() { if (this.connectionId()) delete this.connectionId };
            PageAvailable.prototype.connectionId = function() { return null };
            PageAvailable.prototype.deinitChromeApi = function() { this.api = null };

            function provideAvailabilityToPage(available, win) { this.pageAvailability = hs.mkIframeApiObject(win || global, available, 0) } module.exports.setupIndirectSyncobj = setupIndirectSyncobj;
            module.exports.relayEvent = relayEvent;
            module.exports.unrelayEvent = unrelayEvent;
            module.exports.connectInternal = connectInternal;
            module.exports.PageAvailable = PageAvailable;
            module.exports.provideAvailabilityToPage = provideAvailabilityToPage }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./availability.js": 102, "./errors.js": 105, "./iframe/common.js": 107, "./iframe/index.js": 109, corelib: 117 }],
    113: [function(require, module, exports) {
        (function(global) { var PollAvailable = require("./pollavailability.js").PollAvailable,
                NpapiChrome = require("./../backends/npapi-plugin").NpapiChrome;

            function buildPlugin(win) { var plugin = global.document.getElementById("plugin0"); if (plugin) return plugin;
                plugin = global.document.createElement("object");
                plugin.setAttribute("type", "application/x-codebendercc");
                plugin.setAttribute("width", "0");
                plugin.setAttribute("height", "0");
                plugin.setAttribute("xmlns", "http://www.w3.org/1999/html");
                global.document.body.appendChild(plugin); return plugin }

            function NpapiAvailable() { PollAvailable.call(this);
                this.createPluginObject() } NpapiAvailable.prototype = Object.create(PollAvailable.prototype);
            NpapiAvailable.prototype.canHave = function(done) { if (!global.document || !global.document.getElementById || !global.document.createElement || !global.document.body || !global.document.body.appendChild) { done(false); return } var plugin = buildPlugin(),
                    result = !!plugin.Serial; if (!result) global.document.body.removeChild(plugin);
                done(result) };
            NpapiAvailable.prototype.checkVersion = function(cb) { cb(true) };
            NpapiAvailable.prototype.connectionId = function() { return this.element_ ? this.element_.instance_id : null };
            NpapiAvailable.prototype.isConnected = function() { return !!(this.element_.probeUSB && typeof this.element_.probeUSB() === "string") };
            NpapiAvailable.prototype.createPluginObject = function() { this.element_ = buildPlugin();
                this.element_.id = "plugin0";
                this.api = new NpapiChrome(this.element_) };
            module.exports.NpapiAvailable = NpapiAvailable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./../backends/npapi-plugin": 92, "./pollavailability.js": 115 }],
    114: [function(require, module, exports) {
        (function(global) { var compareVersions = require("corelib").compareVersions,
                Event = require("corelib").Event,
                typecheck = require("corelib").typecheck,
                NpapiAvailable = require("./npapiavailability.js").NpapiAvailable,
                PageAvailable = require("./iframeavailability.js").PageAvailable,
                AppAvailable = require("./appavailability.js").AppAvailable; var badOsMessage = '<i class="icon-warning-sign"></i> To program your Arduino from your browser, please use <a href="http://www.google.com/chrome/" target="_blank">Google Chrome</a>/Chromium on Windows, Mac, Linux (version 41 and above) or Chrome OS (version 41 and above) or <a href="http://www.mozilla.org/en-US/firefox/" target="_blank">Mozilla Firefox</a> on Windows, Mac or Linux.'; var badBrowserMessage = '<i class="icon-warning-sign"></i> To program your Arduino from your browser, please use <a href="http://www.google.com/chrome/" target="_blank">Google Chrome</a>/Chromium (version 41 and above on Linux) or <a href="http://www.mozilla.org/en-US/firefox/" target="_blank">Mozilla Firefox</a> (32bit only on Windows).'; var installBackend = '<a target="_blank" href="https://codebender.cc/static/plugin">Learn more</a> To program your Arduino from your browser, install the codebender plugin or app.'; var updateBackend = '<a target="_blank" href="https://codebender.cc/static/plugin">Learn more</a> To program your Arduino from your browser, install the codebender plugin or app.';

            function pipeSucc(if_, fn) { typecheck(arguments, ["function", "function"]); return function(success, fail) { if_(function pipeSucc_(succList) { fn(succList, success, fail) }, fail) } }

            function pipeFail(if_, fn) { typecheck(arguments, ["function", "function"]); return function(success, fail) { if_(success, function pipeFail_(failList) { fn(failList, success, fail) }) } }

            function both(if1, if2) { typecheck(arguments, ["function", "function"]); return function bothConditional_(success, fail) { typecheck(arguments, ["function", "function"]);
                    if1(function bothSucc1_(succ1) { if2(function bothSucc2_(succ2) { success(succ1.concat(succ2)) }, fail) }, fail) } }

            function anyOf(if1, if2) { typecheck(arguments, ["function", "function"]); return function anyOfConditional_(success, fail) { typecheck(arguments, ["function", "function"]);
                    if1(success, function anyOfErr1_(err1) { if2(success, function anyOfErr2_(err2) { fail(err1.concat(err2)) }) }) } }

            function curry(if_, varArgs) { var args = [].slice.call(arguments, 1); if (args.length == 0) return if_; return curry.apply(null, [if_.bind(null, args[0])].concat(args.slice(1))) }

            function not(if_) { return function not_(s, f) { if_(f, s) } }

            function or(varArgs) { return [].reduce.call(arguments, function or_(ret, f) { return anyOf(ret, f) }) }

            function and(varArgs) { return [].reduce.call(arguments, function and_(ret, f) { return both(ret, f) }) }

            function fail(val) { return function fail_(s, f) { f([val]) } }

            function succeed(val) { return function succeed_(s, f) { s([val]) } }

            function id(x) { return x }

            function keys(errs, key) { return errs.map(function(e) { return e[key] }).filter(id) } var onWhichBrowserLoad = new Event,
                scriptCreated = false,
                scriptLoaded = false;

            function getWhichBrowser(cb) { if (global.WhichBrowser) { cb(new global.WhichBrowser); return } if (scriptLoaded) console.error("While the WhichBrowser script was loaded," + "the Browser object was not created");
                onWhichBrowserLoad.addListener(cb); if (document.getElementById("which-browser-script")) return; if (scriptCreated) console.error("Creating duplicate WhichBrowser script element...");
                scriptCreated = true;
                (function makeWhichBrowser_() { var url = "//api.whichbrowser.net/rel/detect.js"; var p = [],
                        e = 0,
                        f = 0;
                    p.push("ua=" + encodeURIComponent(navigator.userAgent));
                    e |= global.ActiveXObject ? 1 : 0;
                    e |= global.opera ? 2 : 0;
                    e |= global.chrome ? 4 : 0;
                    e |= "getBoxObjectFor" in document || "mozInnerScreenX" in global ? 8 : 0;
                    e |= "WebKitCSSMatrix" in global || "WebKitPoint" in global || "webkitStorageInfo" in global || "webkitURL" in global ? 16 : 0;
                    e |= e & 16 && {}.toString.toString().indexOf("\n") === -1 ? 32 : 0;
                    p.push("e=" + e);
                    f |= "sandbox" in document.createElement("iframe") ? 1 : 0;
                    f |= "WebSocket" in global ? 2 : 0;
                    f |= global.Worker ? 4 : 0;
                    f |= global.applicationCache ? 8 : 0;
                    f |= global.history && history.pushState ? 16 : 0;
                    f |= document.documentElement.webkitRequestFullScreen ? 32 : 0;
                    f |= "FileReader" in global ? 64 : 0;
                    p.push("f=" + f);
                    p.push("r=" + Math.random().toString(36).substring(7));
                    p.push("w=" + screen.width);
                    p.push("h=" + screen.height); var s = document.createElement("script");
                    s.src = url + "?" + p.join("&");
                    s.id = "which-browser-script";
                    s.onload = function whichBrowserOnload_() { onWhichBrowserLoad.dispatch(new global.WhichBrowser);
                        scriptLoaded = true };
                    document.getElementsByTagName("body")[0].appendChild(s); return s })() }

            function fromWhichBrowser(method) { return function actualMethod(varArgs) { var args = arguments,
                        obj = { wbMethod: method, args: [].slice.call(args) }; return function whichBrowserConditional(success, fail) { getWhichBrowser(function gotWhichBrowser(result) { if (result[method].apply(result, args)) { success([obj]); return } fail([obj]) }) } } } var isBrowser = fromWhichBrowser("isBrowser"); var isOs = fromWhichBrowser("isOs"); var UNSUPPORTED_OS = { name: "UNSUPPORTED_OS", message: badOsMessage }; var UNSUPPORTED_BROWSER = { name: "UNSUPPORTED_BROWSER", message: badBrowserMessage }; var BAD_CHROME_VERSION = { name: "BAD_CHROME_VERSION", message: badBrowserMessage }; var UNSUPPORTED_64BIT = { name: "UNSUPPORTED_64BIT", message: badBrowserMessage }; var NO_PROGRAMMERS = { name: "NO_PROGRAMMERS", message: badBrowserMessage }; var UPDATE_APP = { name: "UPDATE_APP", message: updateBackend }; var INSTALL_APP = { name: "INSTALL_APP", message: installBackend }; var UPDATE_NPAPI = { name: "UPDATE_NPAPI", message: updateBackend }; var INSTALL_NPAPI = { name: "INSTALL_NPAPI", message: installBackend }; var BAD_DOMAIN = { message: "Need to be at *.codebender.cc to contact app. We are at " + (global.location || {}).hostname };

            function isWin64(success, fail) { typecheck(arguments, ["function", "function"]); if (navigator.platform === "Win64") { success([]); return } fail([]) } var isChrome = curry(isBrowser, "Chrome"); var isChromium = curry(isBrowser, "Chromium"); var isFirefoxLike = or(isBrowser("Firefox"), isBrowser("Iceweasel")); var linuxNames = ["Unix", "Linux", "FreeBSD", "OpenBSD", "NetBSD", "Solaris", "Debian", "Fedora", "Gentoo", "gNewSense", "Kubuntu", "Mandriva", "Mageia", "Red Hat", "Slackware", "SUSE", "Turbolinux", "Ubuntu"]; var isLinux = or.apply(null, linuxNames.map(isOs)); var isValidOs = or(isOs("Windows"), isOs("OS X"), isOs("Chrome OS"), isLinux, fail(UNSUPPORTED_OS));

            function isAtCodebenderCc(success, fail) { if (!global.location || !global.location.hostname) { fail([{ notInBrowser: true }]); return } var domain = global.location.hostname.split("."); if (domain[domain.length - 2] === "codebender") { success([]); return } fail([]) }

            function checkVersion(versionFail) { typecheck(arguments, ["object"]); return function doCheckVersion_(succList, success, fail) { typecheck(arguments, ["array", "function", "function"]); var avail = keys(succList, "available")[0];
                    avail.checkVersion(function checkedVersion_(ok) { if (ok) { success(succList); return } fail([versionFail]) }) } }

            function canHave(Available, failMessage, argument) { typecheck(arguments, ["function", "object", "any"]); return function canHaveConditional_(success, fail) { typecheck(arguments, ["function", "function"]); var avail = new Available(argument);
                    avail.canHave(function canHaveResult_(yes) { if (yes) { success([{ available: avail }]); return } fail([failMessage]) }) } }

            function isChromeLike(pred, ver) { typecheck(arguments, ["string", "string"]); return or(isChrome(pred, ver), isChromium(pred, ver)) } var isValidChrome = and(or(isBrowser("Chrome"), isBrowser("Chromium")), or(isOs("Chrome OS"), isChromeLike(">=", "42"), and(isLinux, isChromeLike(">=", "41")), fail(BAD_CHROME_VERSION))); var isValidFirefox = isFirefoxLike; var isValidBrowser = and(or(not(and(isValidFirefox, isWin64)), fail(UNSUPPORTED_64BIT)), or(isValidChrome, isValidFirefox, fail(UNSUPPORTED_BROWSER))); var isChromeSuitableForProgrammers = or(isChromeLike(">=", "43"), fail(NO_PROGRAMMERS));

            function getChromeAvailability(arg) { return and(isValidChrome, pipeSucc(or(and(isAtCodebenderCc, canHave(AppAvailable, INSTALL_APP, arg)), canHave(PageAvailable, INSTALL_APP, arg)), checkVersion(UPDATE_APP))) }

            function getFirefoxAvailability(arg) { return pipeSucc(and(isValidFirefox, canHave(NpapiAvailable, INSTALL_NPAPI, arg)), checkVersion(UPDATE_NPAPI)) }

            function getAvailabilityConditional(arg) { return and(isValidOs, isValidBrowser, or(getFirefoxAvailability(arg), getChromeAvailability(arg))) }

            function getAvailability(arg, succ, fail) { return getAvailabilityConditional(arg)(function(succList) { succ(keys(succList, "available").reverse()[0], succList) }, function(failList) { fail(keys(failList, "message").reverse()[0], failList) }) } module.exports.getAvailability = getAvailability;
            module.exports.pipeSucc = pipeSucc;
            module.exports.pipeFail = pipeFail;
            module.exports.both = both;
            module.exports.anyOf = anyOf;
            module.exports.curry = curry;
            module.exports.not = not;
            module.exports.or = or;
            module.exports.and = and;
            module.exports.fail = fail;
            module.exports.succeed = succeed;
            module.exports.id = id;
            module.exports.keys = keys;
            module.exports.getWhichBrowser = getWhichBrowser;
            module.exports.fromWhichBrowser = fromWhichBrowser;
            module.exports.isWin64 = isWin64;
            module.exports.checkVersion = checkVersion;
            module.exports.canHave = canHave;
            module.exports.isChromeLike = isChromeLike;
            module.exports.getChromeAvailability = getChromeAvailability;
            module.exports.getFirefoxAvailability = getFirefoxAvailability;
            module.exports.getAvailabilityConditional = getAvailabilityConditional }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./appavailability.js": 101, "./iframeavailability.js": 112, "./npapiavailability.js": 113, corelib: 117 }],
    115: [function(require, module, exports) { var Event = require("corelib").Event,
            Available = require("./availability.js").Available,
            scheduler = require("corelib").scheduler; var SHUTDOWN = 0,
            DISCONNECTED = 1,
            CONNECTED = 2;

        function PollAvailable() { Available.call(this);
            this.pollTimeout = 1e3 } PollAvailable.prototype = Object.create(Available.prototype);
        PollAvailable.prototype.init = function() { var oldIsConnected = this.isConnected;
            this.isConnected = function() { this.isConnected = oldIsConnected; return false };
            Available.prototype.init.apply(this, arguments) };
        PollAvailable.prototype.connect = function() { var self = this;

            function eventLoop() { if (self.state >= CONNECTED && !self.isConnected()) { self.disconnect(function() { self.onLost.dispatch() }); return } scheduler.setTimeout(eventLoop, self.pollTimeout) } this.state = CONNECTED;
            eventLoop(); if (this.isConnected()) { this.onFound.dispatch() } };
        PollAvailable.prototype.disconnect = function(done) { if (this.state > DISCONNECTED) { this.state = DISCONNECTED } if (done) done() };
        module.exports.PollAvailable = PollAvailable }, { "./availability.js": 102, corelib: 117 }],
    116: [function(require, module, exports) { module.exports = require(72) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/babelfish/backends/chrome-app/src/error.js": 72 }],
    117: [function(require, module, exports) { arguments[4][29][0].apply(exports, arguments) }, { "./lib/data/base64.js": 118, "./lib/data/data.js": 119, "./lib/data/errors.js": 120, "./lib/data/intelhex.js": 121, "./lib/errno.js": 122, "./lib/event.js": 123, "./lib/io/codecsocket.js": 125, "./lib/io/errors.js": 126, "./lib/logging.js": 128, "./lib/scheduler.js": 129, "./lib/settings.js": 130, "./lib/status.js": 131, "./lib/transactions/connection/errors.js": 133, "./lib/transactions/connection/manager.js": 134, "./lib/transactions/errors.js": 135, "./lib/transactions/fsm.js": 136, "./lib/transactions/serialtransaction.js": 137, "./lib/transactions/sockettransaction.js": 138, "./lib/transactions/usbtransaction.js": 140, "./lib/typecheck.js": 141, "./lib/util.js": 142, "./lib/wrapper.js": 143, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/index.js": 29 }],
    118: [function(require, module, exports) { arguments[4][30][0].apply(exports, arguments) }, { "./data.js": 119, "./errors.js": 120, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/base64.js": 30 }],
    119: [function(require, module, exports) { arguments[4][31][0].apply(exports, arguments) }, { "./../scheduler.js": 129, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/data.js": 31 }],
    120: [function(require, module, exports) { arguments[4][32][0].apply(exports, arguments) }, {
        "./../errno.js": 122,
        "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/errors.js": 32
    }],
    121: [function(require, module, exports) { arguments[4][33][0].apply(exports, arguments) }, { "./data.js": 119, "./errors.js": 120, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/intelhex.js": 33 }],
    122: [function(require, module, exports) { arguments[4][34][0].apply(exports, arguments) }, { "./settings.js": 130, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/errno.js": 34 }],
    123: [function(require, module, exports) { arguments[4][35][0].apply(exports, arguments) }, { "./scheduler.js": 129, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/event.js": 35 }],
    124: [function(require, module, exports) { arguments[4][36][0].apply(exports, arguments) }, { "./../event.js": 123, "./../logging.js": 128, "./errors.js": 126, "./serial.js": 127, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/buffer.js": 36 }],
    125: [function(require, module, exports) { arguments[4][37][0].apply(exports, arguments) }, { "./../event.js": 123, "./../logging.js": 128, "./../scheduler.js": 129, "./buffer.js": 124, "./errors.js": 126, "./serial.js": 127, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/codecsocket.js": 37 }],
    126: [function(require, module, exports) { arguments[4][38][0].apply(exports, arguments) }, { "./../errno.js": 122, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/errors.js": 38 }],
    127: [function(require, module, exports) { arguments[4][39][0].apply(exports, arguments) }, { "./../event.js": 123, "./../logging.js": 128, "./../scheduler.js": 129, "./../util.js": 142, "./errors.js": 126, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/serial.js": 39 }],
    128: [function(require, module, exports) {
        (function(global) { var dbg = console.log.bind(console),
                NODEJS = global.window !== global,
                toSettings = require("./settings.js").toSettings,
                consoleSettings = toSettings({ verbosity: 0, logger: "default" }),
                settings = require("./settings.js").settings;
            require("./settings.js").corelibSettings.addParent(consoleSettings);

            function ModifiedConsole(console) { this.console = console;
                this.setConsoleMethod("error");
                this.setConsoleMethod("warn");
                this.setConsoleMethod("info");
                this.setConsoleMethod("log");
                this.setConsoleMethod("debug") } ModifiedConsole.prototype = { setConsoleMethod: function(type) { var self = this;
                    Object.defineProperty(this, type, { get: function() { return self.consoleMethod(Function.prototype.bind.call(self.console[type], self.console), type) } }) }, consoleMethod: function(origMethod, name) { return origMethod } };

            function ConditionalConsole(console) { ModifiedConsole.call(this, console) } ConditionalConsole.prototype = Object.create(ModifiedConsole.prototype);
            ConditionalConsole.prototype.consoleMethod = function(origLog, name) { if (this.shouldCall(origLog, name)) return origLog; return function() {} };
            ConditionalConsole.prototype.shouldCall = function(origLog, name) { return true };

            function VerbosityConsole(console) { ConditionalConsole.call(this, console);
                this.typeThresholds = { error: 0, warn: 1, info: 2, log: 3, debug: 4 } } VerbosityConsole.prototype = Object.create(ConditionalConsole.prototype);
            VerbosityConsole.prototype.verbosity = function() { if (typeof this.verbosity === "number") return this.verbosity; return settings.get("verbosity") };
            VerbosityConsole.prototype.shouldCall = function(origLog, name) { var threshold = this.typeThresholds[name]; return this.verbosity() >= threshold && !NODEJS };

            function PrefixConsole(prefix, console) { ModifiedConsole.call(this, console);
                this.prefix = prefix } PrefixConsole.prototype = Object.create(ModifiedConsole.prototype);
            PrefixConsole.prototype.consoleMethod = function(origLog) { var ol = ModifiedConsole.prototype.consoleMethod.call(this, origLog); return ol.bind(null, "[" + this.getPrefix() + "]") };
            PrefixConsole.prototype.getPrefix = function() { return this.prefix };

            function PrefixTimestampConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimestampConsole.prototype = Object.create(PrefixConsole.prototype);
            PrefixTimestampConsole.prototype.getPrefix = function() { return this.timestampString() + ":" + this.prefix };
            PrefixTimestampConsole.prototype.timestampString = function() { var date = this.getDate(); var pad = function(n) { if (n < 10) { return "0" + n } return n }; return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "." + this.zeroFill(date.getMilliseconds(), 3) };
            PrefixTimestampConsole.prototype.zeroFill = function(number, width) { width -= number.toString().length; if (width > 0) { return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number } return number + "" };
            PrefixTimestampConsole.prototype.getDate = function() { return new Date };

            function PrefixTimediffConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimediffConsole.prototype = Object.create(PrefixTimestampConsole.prototype);
            PrefixTimediffConsole.prototype.lastLogTime = Date.now();
            PrefixTimediffConsole.prototype.getDate = function() { var proto = Object.getPrototypeOf(this),
                    time = Date.now() - proto.lastLogTime;
                proto.lastLogTime = Date.now(); return new Date(time + (new Date).getTimezoneOffset() * 6e4) }; var loggers = { "default": function(prefix) { return new VerbosityConsole(new PrefixTimestampConsole(prefix, global.console)) }, timediff: function(prefix) { return new VerbosityConsole(new PrefixTimediffConsole(prefix, global.console)) } };

            function getLog(prefix) { return (loggers[settings.get("logger")] || loggers["default"])(prefix) } module.exports.getLog = getLog }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./settings.js": 130 }],
    129: [function(require, module, exports) {
        (function(global) { var NO_DOM = !(global.removeEventListener && global.addEventListener && global.postMessage),
                TESTING = typeof global.it === "function" && typeof global.describe === "function";

            function WaitHelperDom(waiter) { this.waiter = waiter } WaitHelperDom.prototype = { maybeListen: function() { if (this.domListener) return; var self = this;
                    this.domListener = function(ev) { if (ev.source !== window) return; var data = ev.data; if (!data || !(data instanceof Object) || data.waiterId != self.waiter.id) return;
                        self.guard() };
                    global.addEventListener("message", this.domListener, true) }, due: function() { if (typeof this.due === "number") return this.due; return this.waiter.due }, guard: function() { if (this.due() > this.waiter.async.now()) { this.wait(); return } this.close();
                    this.waiter.guard() }, close: function() { if (!this.domListener) return;
                    global.removeEventListener("message", this.domListener);
                    this.domListener = null }, wait: function(ms) { if (typeof ms === "number") this.due = this.waiter.async.now() + ms;
                    this.maybeListen();
                    global.postMessage({ waiterId: this.waiter.id }, "*") } };

            function WaitHelperJs(waiter) { this.waiter = waiter } WaitHelperJs.prototype = { close: function() { if (!this.handle) return;
                    global.clearTimeout(this.handle);
                    this.handle = null }, wait: function(ms) { var self = this,
                        time = typeof ms === "number" ? ms : this.waiter.due - this.waiter.async.now();
                    this.handle = global.setTimeout(function() { self.waiter.guard() }, time) } }; var waiterIds = 1;

            function Waiter(cb, due, async) { this.cb = cb;
                this.due = due;
                this.async = async;
                this.onClose = null;
                this.closed = false;
                this.id = waiterIds++ } Waiter.prototype = { setHelper: function(helper) { if (this.helper) this.helper.close();
                    this.helper = helper; return helper }, guard: function() { if (this.closed) return; var tl = this.due - this.async.now(); if (tl < 0) { this.close();
                        this.cb(); return } this.run() }, run: function() { if (this.closed) return null; var self = this; if (this.due - this.async.now() >= 1e3 || NO_DOM) { this.setHelper(new WaitHelperJs(this)) } else { this.setHelper(new WaitHelperDom(this)) } this.helper.wait(); return this }, close: function() { if (this.closed) return;
                    this.closed = true;
                    this.setHelper(null); if (this.onClose) this.onClose();
                    this.onClose = null }, quickRun: function() { if (this.closed) return null;
                    this.setHelper(new WaitHelperJs(this)).wait(0); return this } };

            function Async() { this.index = new WaiterIndex } Async.prototype = { wait: function(cb, due) { return new Waiter(cb, due, this) }, postpone: function(cb) { new Waiter(cb, this.now(), this) }, now: function() { return Date.now() }, setTimeout: function(cb, to) { return this.index.put(this.wait(cb, (to || 0) + this.now()).run()) }, clearTimeout: function(id) { this.index.rm(id) }, clearImmediate: function(id) { return this.clearTimeout(id) }, setImmediate: function(cb) { return this.setTimeout(cb, 0) } };

            function TestAsync() { this.index = new WaiterIndex;
                this.offset = 0;
                this.capHandle = null } TestAsync.prototype = Object.create(Async.prototype);
            TestAsync.prototype.idleCap = function() { var waiter = this.index.minDue(); if (waiter === null) { if (this.onEnd) this.onEnd();
                    this.capHandle = null; return } this.changeClock(waiter.due);
                waiter.quickRun();
                this.idleRenew() };
            TestAsync.prototype.idleRenew = function() { var self = this; if (!this.capHandle) this.capHandle = global.setTimeout(function() { self.capHandle = null;
                    self.idleCap() }) };
            TestAsync.prototype.changeClock = function(ms) { this.offset = ms - Date.now() };
            TestAsync.prototype.now = function() { return Date.now() + this.offset };
            TestAsync.prototype.setTimeout = function(cb, ms) { if (!cb) throw Error("Excpected a callback but got" + cb);
                this.idleRenew(); return this.index.put(this.wait(cb, (ms || 0) + this.now())) };

            function WaiterIndex() { this.db = {} } WaiterIndex.prototype = { put: function(obj) { this.rm(obj.id);
                    this.db[obj.id] = obj;
                    obj.onClose = this.rm.bind(this, obj.id); return obj.id }, get: function(id) { return this.db[id] }, rm: function(id) { var waiter = this.db[id]; if (!waiter) return;
                    waiter.close();
                    this.rawDel(id) }, rawDel: function(id) { delete this.db[id] }, minDue: function() { var self = this,
                        keys = Object.getOwnPropertyNames(this.db); if (keys.length > 0) { var minkey = keys.reduce(function(mink, k) { var cand = self.db[k],
                                min = self.db[mink]; if (!min) return min; if (min.due < cand.due) return mink; if (min.due == cand.due && min.id < cand.id) return mink; return k }); return this.get(minkey) } return null }, array: function() { var self = this; return Object.getOwnPropertyNames(this.db).map(function(k) { return self.db[k] }) }, length: function() { return Object.getOwnPropertyNames(this.db).length } }; if (TESTING) { module.exports = new TestAsync } else { module.exports = new Async } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    130: [function(require, module, exports) {
        (function(global) {
            function DynamicSetting(cb) { this.cb = cb } DynamicSetting.prototype = { _isDynamicSetting: true };

            function SettingsManager(settings) { this.settings = settings;
                this.default = null } SettingsManager.prototype = { _isSettingsManager: true, set: function(key, value) { this.settings[key] = value }, get: function(key, _default) { if (!this.has(key)) { if ([].slice.call(arguments).length == 1) { return this.default } return _default } var ret = this.settings[key]; if (ret && ret._isDynamicSetting) return ret.cb(); return ret }, keys: function() { return Object.getOwnPropertyNames(this.settings) }, obj: function() { var dic = {},
                        self = this;
                    this.keys().reverse().forEach(function(k) { dic[k] = self.get(k) }); return dic }, has: function(key) { return Object.hasOwnProperty.call(this.settings, key) }, parent: function(settings) { return new MuxSettingsManager([this, toSettings(settings)]) }, child: function(settings) { return new MuxSettingsManager([toSettings(settings), this]) } };

            function GetSettingsManager() { this.prefix = "babelfish_";
                this.settings = this.updatedSettings(); if (this.settings.managers) debugger } GetSettingsManager.prototype = Object.create(SettingsManager.prototype);
            GetSettingsManager.prototype.set = function() { throw Error("Cont'set to settings manager based on GET") };
            GetSettingsManager.prototype.get = function(key, _default) { return SettingsManager.prototype.get.call(this, key.toLowerCase(), _default) };
            GetSettingsManager.prototype.has = function(key) { return SettingsManager.prototype.has.call(this, key.toLowerCase()) };
            GetSettingsManager.prototype.updatedSettings = function() { var self = this,
                    dic = {},
                    get = global.window && window.location && window.location.search && window.location.search.split("?" + this.prefix)[1] || null; if (get !== null) { get.split("&" + this.prefix).forEach(function(g) { var s = g.split("=");
                        dic[s[0].toLowerCase()] = self.parseValue(s[1]) }) } return dic };
            GetSettingsManager.prototype.parseValue = function(val) { try { return JSON.parse(val) } catch (e) { return val } };

            function MuxSettingsManager(lst) { this.managers = lst } MuxSettingsManager.prototype = Object.create(SettingsManager.prototype);
            MuxSettingsManager.prototype.has = function(key) { return this.managers.some(function(m) { return m.has(key) }) };
            MuxSettingsManager.prototype.addParent = function(manager) { this.managers.push(manager); return this }, MuxSettingsManager.prototype.addChild = function(manager) { this.managers = [toSettings(manager)].concat(this.managers); return this }, MuxSettingsManager.prototype.keys = function() { var dic = {}; for (var i = this.managers.length - 1; i >= 0; i--) { this.managers[i].keys().reverse().forEach(function(k) { dic[k] = null }) } return Object.getOwnPropertyNames(dic) };
            MuxSettingsManager.prototype.get = function(key, _default) { for (var i = 0; i < this.managers.length; i++) { var m = this.managers[i]; if (!m.has(key)) continue; return m.get(key) } if ([].slice.call(arguments).length == 1) { return this.default } return _default };
            MuxSettingsManager.prototype.set = function(keu, value) { throw Error("Can't set to multiplexing settings manager") };

            function toSettings(obj) { if (typeof obj !== "object") return new SettingsManager({}); if (obj._isSettingsManager) return obj; return new SettingsManager(obj) } global.babelfishSettings = global.babelfishSettings || {};
            global._corelibSettings = global._corelibSettings || new MuxSettingsManager([]), global._defaultSettings = global._defaultSettings || new MuxSettingsManager([]), global._browserSettings = global._browserSettings || (new GetSettingsManager).child(global.babelfishSettings);

            function ExternalSettings(dfs) { MuxSettingsManager.call(this, [global._browserSettings, dfs, global._corelibSettings]) } ExternalSettings.prototype = Object.create(MuxSettingsManager.prototype);
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.appendDefault = function(setting) { this.defaultSettings().addChild(setting); return this };
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.defaultSettings = function() { return this.managers[1] };
            global._externalSettings = global._externalSettings || new ExternalSettings(global._defaultSettings);
            module.exports.settings = global._externalSettings;
            module.exports.corelibSettings = global._corelibSettings;
            module.exports.defaultSettings = global._defaultSettings;
            module.exports.toSettings = toSettings;
            module.exports.DynamicSetting = DynamicSetting;
            module.exports.SettingsManager = SettingsManager;
            module.exports.GetSettingsManager = GetSettingsManager;
            module.exports.MuxSettingsManager = MuxSettingsManager }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    131: [function(require, module, exports) { arguments[4][43][0].apply(exports, arguments) }, { "./scheduler.js": 129, "./settings.js": 130, "./util.js": 142, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/status.js": 43 }],
    132: [function(require, module, exports) { module.exports = require(44) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/super.js": 44 }],
    133: [function(require, module, exports) { arguments[4][45][0].apply(exports, arguments) }, { "./../../errno.js": 122, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/errors.js": 45 }],
    134: [function(require, module, exports) { arguments[4][46][0].apply(exports, arguments) }, { "./../../scheduler.js": 129, "./errors.js": 133, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/manager.js": 46 }],
    135: [function(require, module, exports) { arguments[4][47][0].apply(exports, arguments) }, { "./../errno.js": 122, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/errors.js": 47 }],
    136: [function(require, module, exports) { arguments[4][48][0].apply(exports, arguments) }, { "./../event.js": 123, "./../logging.js": 128, "./../scheduler.js": 129, "./../super.js": 132, "./errors.js": 135, "./status.js": 139, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/fsm.js": 48 }],
    137: [function(require, module, exports) { arguments[4][49][0].apply(exports, arguments) }, { "./../logging.js": 128, "./../util": 142, "./connection/manager.js": 134, "./errors.js": 135, "./sockettransaction.js": 138, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/serialtransaction.js": 49 }],
    138: [function(require, module, exports) { arguments[4][50][0].apply(exports, arguments) }, { "./../logging.js": 128, "./errors.js": 135, "./fsm.js": 136, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/sockettransaction.js": 50 }],
    139: [function(require, module, exports) { arguments[4][51][0].apply(exports, arguments) }, { "./../status.js": 131, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/status.js": 51 }],
    140: [function(require, module, exports) { arguments[4][52][0].apply(exports, arguments) }, { "./../logging.js": 128, "./../scheduler": 129, "./../util.js": 142, "./errors.js": 135, "./fsm.js": 136, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/usbtransaction.js": 52 }],
    141: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js").scheduler;

            function mkChecker(expected, check) { return function(obj) { if (!check(obj)) { return { error: "Expected " + expected + " got " + obj } } return { ok: true } } }

            function isSerializable(obj, dontCheckRecursive) { if (obj === null) return true; if (typeof obj === "function") return false; if (typeof obj !== "object") return true; if (obj instanceof Array) return !obj.some(function(x) { return !isSerializable(x) }); if (obj.__proto__ && obj.__proto__.__proto__) return false; if (!dontCheckRecursive) try { JSON.stringify(obj) } catch (c) { return false }
                return !Object.getOwnPropertyNames(obj).some(function(k) { return !isSerializable(obj[k], true) }) }

            function isIframeSerializable(obj) { if (obj instanceof ArrayBuffer) return true; if (isSerializable(obj)) return true; if (typeof obj !== "object") return false; return Object.getOwnPropertyNames(obj).reduce(function(ret, k) { return ret && isIframeSerializable(obj[k]) }, true) } var _callback = mkChecker("function", function(o) { return typeof o === "function" }); var checks = { callback: _callback, "function": _callback, object: mkChecker("object", function(o) { return o instanceof Object }), arraybuffer: mkChecker("arraybuffer", function(o) { return o instanceof ArrayBuffer }), array: mkChecker("array", function(o) { return o instanceof Array }), number: mkChecker("number", function(o) { return typeof o === "number" }), string: mkChecker("string", function(o) { return typeof o === "string" }), bool: mkChecker("string", function(o) { return typeof o === "boolean" }), "boolean": mkChecker("string", function(o) { return typeof o === "boolean" }), json: mkChecker("json", isSerializable), iframe: mkChecker("iframe", isIframeSerializable), any: function() { return { ok: true } } };

            function hasKey(obj, key) { return !Object.getOwnPropertyNames(obj).some(function(k) { return key === k }) }

            function getCheck(checker) { var chk = checks[checker]; if (typeof chk === "function") return chk; if (typeof checker === "function" && checker.prototype) return mkChecker(checker.name || "class", function(obj) { return obj instanceof checker }); if (checker instanceof Array) return function(arr) { return match(arr, checker) }; if (typeof checker === "object") return function(obj) { var ret;
                    Object.getOwnPropertyNames(checker).some(function(k) { if (typeof obj !== "object") { ret = { error: "Expected object, got " + obj }; return true } ret = getCheck(checker[k])(obj[k]); if (ret.error) ret.error = "{" + k + ": " + ret.error + "}"; return !!ret.error }); return ret }; throw Error("Unknown type checker:" + checker) }

            function match(args, checkers, index, cb) { if (args.length === 0 && checkers.length === 0) { return { ok: true } } if (args.length === 0 && checkers.length === 1 && checkers[0] === "varany") return { ok: true }; if (args.length === 0 || checkers.length === 0) { if (checkers[0] === "varany") return { error: "Last args should check with " + checkers.slice(1) + " but couldn't." };
                    cb && cb(args); return { error: "Wrong num of arguments: " + (index + args.length) + " (expected " + (index + checkers.length) + ")" } } var checker = checkers[0],
                    m; if (checker === "varany") { if (checkers.length === 1) return { ok: true };
                    m = match(args, checkers.slice(1), index, cb); if (m.ok) return m; return match(args.slice(1), checkers, index + 1, cb) } m = getCheck(checker)(args[0]); if (!m.ok) { cb && cb(checker, args[0]); return { error: "Argument #" + index + ": " + m.error } } return match(args.slice(1), checkers.slice(1), index + 1, cb) } var PRODUCTION = typeof global.it !== "function" && typeof global.describe !== "function" && typeof global.process === "undefined"; var settings = require("./settings.js").settings;

            function typecheck(args, checkers, callback) { if (PRODUCTION && !settings.get("typecheck")) return; var m = match([].slice.call(args), checkers, 0, callback); if (m.ok) return; throw Error(m.error) }

            function typechecked(fn, argtypes) { return function() { typecheck(arguments, argtypes, console.log.bind(console, "Typechecked:")); return fn.apply(null, arguments) } } module.exports.typechecked = typechecked;
            module.exports.typecheck = typecheck;
            module.exports.isSerializable = isSerializable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 129, "./settings.js": 130 }],
    142: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js");

            function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

            function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

            function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                    hex = hex.length < 2 ? "0" + hex : hex;
                    buf += " " + hex } buf += "]"; return buf }

            function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

            function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

            function shallowCopy(obj) { var ret = {}; if (!obj) return obj; if (typeof obj !== "object") throw Error("expected object, not " + typeof obj);
                Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = obj[k] }); if (obj.__proto__) ret.__proto__ = obj.__proto__; return ret }

            function replacePrototype(obj, cls1, cls2) { if (typeof obj !== "object" || typeof cls1 !== "function" || typeof cls2 !== "function") throw Error(); if (!obj || !obj.__proto__ || !cls1.prototype || !cls2.prototype) return obj; var ret = shallowCopy(obj); if (obj !== cls1.prototype) { ret.__proto__ = replacePrototype(ret.__proto__, cls1, cls2); return ret } return Object.create(cls2.prototype) }

            function forEachWithCallback(arr, cb, endCb) { scheduler.setTimeout(function() { if (arr.length <= 0) { endCb(); return } cb(arr[0], function() { forEachWithCallback(arr.slice(1), cb, endCb) }) }) }

            function repeat(times, fn) { var ret = new Array(times); for (var i = 0; i < times; i++) ret[i] = fn(); return ret }

            function compareVersions(v1, v2, callbacks) {
                function justParse(x) { return Number.parseInt(x) } return compareVersionLists(v1.split(".").map(justParse), v2.split(".").map(justParse), callbacks) }

            function compareVersionLists(v1, v2, cbs) { if (isNaN(v1[0]) || isNaN(v2[0])) return cbs.err(); if (v1[0] < v2[0] || v1.length === 0) return cbs.lt(); if (v1[0] > v2[0] || v2.length === 0) return cbs.gt(); if (v1.length === 0 && v2.length === 0) return cbs.eq(); return compareVersionLists(v1.slice(1), v2.slice(1), cbs) }

            function getUniqueId(name) { global.babelfishUniqueIds = global.babelfishUniqueIds || {};
                global.babelfishUniqueIds[name] = global.babelfishUniqueIds[name] || 1; return global.babelfishUniqueIds[name]++ } module.exports.compareVersions = compareVersions;
            module.exports.repeat = repeat;
            module.exports.forEachWithCallback = forEachWithCallback;
            module.exports.storeAsTwoBytes = storeAsTwoBytes;
            module.exports.storeAsFourBytes = storeAsFourBytes;
            module.exports.hexRep = hexRep;
            module.exports.binToBuf = binToBuf;
            module.exports.bufToBin = bufToBin;
            module.exports.shallowCopy = shallowCopy;
            module.exports.replacePrototype = replacePrototype;
            module.exports.getUniqueId = getUniqueId }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 129 }],
    143: [function(require, module, exports) { module.exports = require(55) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/wrapper.js": 55 }],
    144: [function(require, module, exports) { arguments[4][29][0].apply(exports, arguments) }, { "./lib/data/base64.js": 145, "./lib/data/data.js": 146, "./lib/data/errors.js": 147, "./lib/data/intelhex.js": 148, "./lib/errno.js": 149, "./lib/event.js": 150, "./lib/io/codecsocket.js": 152, "./lib/io/errors.js": 153, "./lib/logging.js": 155, "./lib/scheduler.js": 156, "./lib/settings.js": 157, "./lib/status.js": 158, "./lib/transactions/connection/errors.js": 160, "./lib/transactions/connection/manager.js": 161, "./lib/transactions/errors.js": 162, "./lib/transactions/fsm.js": 163, "./lib/transactions/serialtransaction.js": 164, "./lib/transactions/sockettransaction.js": 165, "./lib/transactions/usbtransaction.js": 167, "./lib/typecheck.js": 168, "./lib/util.js": 169, "./lib/wrapper.js": 170, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/index.js": 29 }],
    145: [function(require, module, exports) { arguments[4][30][0].apply(exports, arguments) }, { "./data.js": 146, "./errors.js": 147, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/base64.js": 30 }],
    146: [function(require, module, exports) { arguments[4][31][0].apply(exports, arguments) }, { "./../scheduler.js": 156, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/data.js": 31 }],
    147: [function(require, module, exports) { arguments[4][32][0].apply(exports, arguments) }, { "./../errno.js": 149, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/errors.js": 32 }],
    148: [function(require, module, exports) { arguments[4][33][0].apply(exports, arguments) }, { "./data.js": 146, "./errors.js": 147, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/intelhex.js": 33 }],
    149: [function(require, module, exports) { arguments[4][34][0].apply(exports, arguments) }, { "./settings.js": 157, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/errno.js": 34 }],
    150: [function(require, module, exports) { arguments[4][35][0].apply(exports, arguments) }, { "./scheduler.js": 156, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/event.js": 35 }],
    151: [function(require, module, exports) { arguments[4][36][0].apply(exports, arguments) }, { "./../event.js": 150, "./../logging.js": 155, "./errors.js": 153, "./serial.js": 154, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/buffer.js": 36 }],
    152: [function(require, module, exports) { arguments[4][37][0].apply(exports, arguments) }, { "./../event.js": 150, "./../logging.js": 155, "./../scheduler.js": 156, "./buffer.js": 151, "./errors.js": 153, "./serial.js": 154, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/codecsocket.js": 37 }],
    153: [function(require, module, exports) { arguments[4][38][0].apply(exports, arguments) }, { "./../errno.js": 149, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/errors.js": 38 }],
    154: [function(require, module, exports) { arguments[4][39][0].apply(exports, arguments) }, { "./../event.js": 150, "./../logging.js": 155, "./../scheduler.js": 156, "./../util.js": 169, "./errors.js": 153, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/serial.js": 39 }],
    155: [function(require, module, exports) {
        (function(global) {
            var dbg = console.log.bind(console),
                NODEJS = global.window !== global,
                toSettings = require("./settings.js").toSettings,
                consoleSettings = toSettings({ verbosity: 0, logger: "default" }),
                settings = require("./settings.js").settings;
            require("./settings.js").corelibSettings.addParent(consoleSettings);

            function ModifiedConsole(console) { this.console = console;
                this.setConsoleMethod("error");
                this.setConsoleMethod("warn");
                this.setConsoleMethod("info");
                this.setConsoleMethod("log");
                this.setConsoleMethod("debug") } ModifiedConsole.prototype = { setConsoleMethod: function(type) { var self = this;
                    Object.defineProperty(this, type, { get: function() { return self.consoleMethod(Function.prototype.bind.call(self.console[type], self.console), type) } }) }, consoleMethod: function(origMethod, name) { return origMethod } };

            function ConditionalConsole(console) { ModifiedConsole.call(this, console) } ConditionalConsole.prototype = Object.create(ModifiedConsole.prototype);
            ConditionalConsole.prototype.consoleMethod = function(origLog, name) { if (this.shouldCall(origLog, name)) return origLog; return function() {} };
            ConditionalConsole.prototype.shouldCall = function(origLog, name) { return true };

            function VerbosityConsole(console) { ConditionalConsole.call(this, console);
                this.typeThresholds = { error: 0, warn: 1, info: 2, log: 3, debug: 4 } } VerbosityConsole.prototype = Object.create(ConditionalConsole.prototype);
            VerbosityConsole.prototype.verbosity = function() { if (typeof this.verbosity === "number") return this.verbosity; return settings.get("verbosity") };
            VerbosityConsole.prototype.shouldCall = function(origLog, name) { var threshold = this.typeThresholds[name]; return this.verbosity() >= threshold && !NODEJS };

            function PrefixConsole(prefix, console) { ModifiedConsole.call(this, console);
                this.prefix = prefix } PrefixConsole.prototype = Object.create(ModifiedConsole.prototype);
            PrefixConsole.prototype.consoleMethod = function(origLog) { var ol = ModifiedConsole.prototype.consoleMethod.call(this, origLog); return ol.bind(null, "[" + this.getPrefix() + "]") };
            PrefixConsole.prototype.getPrefix = function() { return this.prefix };

            function PrefixTimestampConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimestampConsole.prototype = Object.create(PrefixConsole.prototype);
            PrefixTimestampConsole.prototype.getPrefix = function() { return this.timestampString() + ":" + this.prefix };
            PrefixTimestampConsole.prototype.timestampString = function() { var date = this.getDate(); var pad = function(n) { if (n < 10) { return "0" + n } return n }; return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "." + this.zeroFill(date.getMilliseconds(), 3) };
            PrefixTimestampConsole.prototype.zeroFill = function(number, width) { width -= number.toString().length; if (width > 0) { return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number } return number + "" };
            PrefixTimestampConsole.prototype.getDate = function() { return new Date };

            function PrefixTimediffConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimediffConsole.prototype = Object.create(PrefixTimestampConsole.prototype);
            PrefixTimediffConsole.prototype.lastLogTime = Date.now();
            PrefixTimediffConsole.prototype.getDate = function() { var proto = Object.getPrototypeOf(this),
                    time = Date.now() - proto.lastLogTime;
                proto.lastLogTime = Date.now(); return new Date(time + (new Date).getTimezoneOffset() * 6e4) };
            var loggers = { "default": function(prefix) { return new VerbosityConsole(new PrefixTimestampConsole(prefix, global.console)) }, timediff: function(prefix) { return new VerbosityConsole(new PrefixTimediffConsole(prefix, global.console)) } };

            function getLog(prefix) {
                return (loggers[settings.get("logger")] || loggers["default"])(prefix);
            }
            module.exports.getLog = getLog
        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, { "./settings.js": 157 }],
    156: [function(require, module, exports) {
        (function(global) { var NO_DOM = !(global.removeEventListener && global.addEventListener && global.postMessage),
                TESTING = typeof global.it === "function" && typeof global.describe === "function";

            function WaitHelperDom(waiter) { this.waiter = waiter } WaitHelperDom.prototype = { maybeListen: function() { if (this.domListener) return; var self = this;
                    this.domListener = function(ev) { if (ev.source !== window) return; var data = ev.data; if (!data || !(data instanceof Object) || data.waiterId != self.waiter.id) return;
                        self.guard() };
                    global.addEventListener("message", this.domListener, true) }, due: function() { if (typeof this.due === "number") return this.due; return this.waiter.due }, guard: function() { if (this.due() > this.waiter.async.now()) { this.wait(); return } this.close();
                    this.waiter.guard() }, close: function() { if (!this.domListener) return;
                    global.removeEventListener("message", this.domListener);
                    this.domListener = null }, wait: function(ms) { if (typeof ms === "number") this.due = this.waiter.async.now() + ms;
                    this.maybeListen();
                    global.postMessage({ waiterId: this.waiter.id }, "*") } };

            function WaitHelperJs(waiter) { this.waiter = waiter } WaitHelperJs.prototype = { close: function() { if (!this.handle) return;
                    global.clearTimeout(this.handle);
                    this.handle = null }, wait: function(ms) { var self = this,
                        time = typeof ms === "number" ? ms : this.waiter.due - this.waiter.async.now();
                    this.handle = global.setTimeout(function() { self.waiter.guard() }, time) } }; var waiterIds = 1;

            function Waiter(cb, due, async) { this.cb = cb;
                this.due = due;
                this.async = async;
                this.onClose = null;
                this.closed = false;
                this.id = waiterIds++ } Waiter.prototype = { setHelper: function(helper) { if (this.helper) this.helper.close();
                    this.helper = helper; return helper }, guard: function() { if (this.closed) return; var tl = this.due - this.async.now(); if (tl < 0) { this.close();
                        this.cb(); return } this.run() }, run: function() { if (this.closed) return null; var self = this; if (this.due - this.async.now() >= 1e3 || NO_DOM) { this.setHelper(new WaitHelperJs(this)) } else { this.setHelper(new WaitHelperDom(this)) } this.helper.wait(); return this }, close: function() { if (this.closed) return;
                    this.closed = true;
                    this.setHelper(null); if (this.onClose) this.onClose();
                    this.onClose = null }, quickRun: function() { if (this.closed) return null;
                    this.setHelper(new WaitHelperJs(this)).wait(0); return this } };

            function Async() { this.index = new WaiterIndex } Async.prototype = { wait: function(cb, due) { return new Waiter(cb, due, this) }, postpone: function(cb) { new Waiter(cb, this.now(), this) }, now: function() { return Date.now() }, setTimeout: function(cb, to) { return this.index.put(this.wait(cb, (to || 0) + this.now()).run()) }, clearTimeout: function(id) { this.index.rm(id) }, clearImmediate: function(id) { return this.clearTimeout(id) }, setImmediate: function(cb) { return this.setTimeout(cb, 0) } };

            function TestAsync() { this.index = new WaiterIndex;
                this.offset = 0;
                this.capHandle = null } TestAsync.prototype = Object.create(Async.prototype);
            TestAsync.prototype.idleCap = function() { var waiter = this.index.minDue(); if (waiter === null) { if (this.onEnd) this.onEnd();
                    this.capHandle = null; return } this.changeClock(waiter.due);
                waiter.quickRun();
                this.idleRenew() };
            TestAsync.prototype.idleRenew = function() { var self = this; if (!this.capHandle) this.capHandle = global.setTimeout(function() { self.capHandle = null;
                    self.idleCap() }) };
            TestAsync.prototype.changeClock = function(ms) { this.offset = ms - Date.now() };
            TestAsync.prototype.now = function() { return Date.now() + this.offset };
            TestAsync.prototype.setTimeout = function(cb, ms) { if (!cb) throw Error("Excpected a callback but got" + cb);
                this.idleRenew(); return this.index.put(this.wait(cb, (ms || 0) + this.now())) };

            function WaiterIndex() { this.db = {} } WaiterIndex.prototype = { put: function(obj) { this.rm(obj.id);
                    this.db[obj.id] = obj;
                    obj.onClose = this.rm.bind(this, obj.id); return obj.id }, get: function(id) { return this.db[id] }, rm: function(id) { var waiter = this.db[id]; if (!waiter) return;
                    waiter.close();
                    this.rawDel(id) }, rawDel: function(id) { delete this.db[id] }, minDue: function() { var self = this,
                        keys = Object.getOwnPropertyNames(this.db); if (keys.length > 0) { var minkey = keys.reduce(function(mink, k) { var cand = self.db[k],
                                min = self.db[mink]; if (!min) return min; if (min.due < cand.due) return mink; if (min.due == cand.due && min.id < cand.id) return mink; return k }); return this.get(minkey) } return null }, array: function() { var self = this; return Object.getOwnPropertyNames(this.db).map(function(k) { return self.db[k] }) }, length: function() { return Object.getOwnPropertyNames(this.db).length } }; if (TESTING) { module.exports = new TestAsync } else { module.exports = new Async } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    157: [function(require, module, exports) {
        (function(global) {
            function DynamicSetting(cb) { this.cb = cb } DynamicSetting.prototype = { _isDynamicSetting: true };

            function SettingsManager(settings) { this.settings = settings;
                this.default = null } SettingsManager.prototype = { _isSettingsManager: true, set: function(key, value) { this.settings[key] = value }, get: function(key, _default) { if (!this.has(key)) { if ([].slice.call(arguments).length == 1) { return this.default } return _default } var ret = this.settings[key]; if (ret && ret._isDynamicSetting) return ret.cb(); return ret }, keys: function() { return Object.getOwnPropertyNames(this.settings) }, obj: function() { var dic = {},
                        self = this;
                    this.keys().reverse().forEach(function(k) { dic[k] = self.get(k) }); return dic }, has: function(key) { return Object.hasOwnProperty.call(this.settings, key) }, parent: function(settings) { return new MuxSettingsManager([this, toSettings(settings)]) }, child: function(settings) { return new MuxSettingsManager([toSettings(settings), this]) } };

            function GetSettingsManager() { this.prefix = "babelfish_";
                this.settings = this.updatedSettings(); if (this.settings.managers) debugger } GetSettingsManager.prototype = Object.create(SettingsManager.prototype);
            GetSettingsManager.prototype.set = function() { throw Error("Cont'set to settings manager based on GET") };
            GetSettingsManager.prototype.get = function(key, _default) { return SettingsManager.prototype.get.call(this, key.toLowerCase(), _default) };
            GetSettingsManager.prototype.has = function(key) { return SettingsManager.prototype.has.call(this, key.toLowerCase()) };
            GetSettingsManager.prototype.updatedSettings = function() { var self = this,
                    dic = {},
                    get = global.window && window.location && window.location.search && window.location.search.split("?" + this.prefix)[1] || null; if (get !== null) { get.split("&" + this.prefix).forEach(function(g) { var s = g.split("=");
                        dic[s[0].toLowerCase()] = self.parseValue(s[1]) }) } return dic };
            GetSettingsManager.prototype.parseValue = function(val) { try { return JSON.parse(val) } catch (e) { return val } };

            function MuxSettingsManager(lst) { this.managers = lst } MuxSettingsManager.prototype = Object.create(SettingsManager.prototype);
            MuxSettingsManager.prototype.has = function(key) { return this.managers.some(function(m) { return m.has(key) }) };
            MuxSettingsManager.prototype.addParent = function(manager) { this.managers.push(manager); return this }, MuxSettingsManager.prototype.addChild = function(manager) { this.managers = [toSettings(manager)].concat(this.managers); return this }, MuxSettingsManager.prototype.keys = function() { var dic = {}; for (var i = this.managers.length - 1; i >= 0; i--) { this.managers[i].keys().reverse().forEach(function(k) { dic[k] = null }) } return Object.getOwnPropertyNames(dic) };
            MuxSettingsManager.prototype.get = function(key, _default) { for (var i = 0; i < this.managers.length; i++) { var m = this.managers[i]; if (!m.has(key)) continue; return m.get(key) } if ([].slice.call(arguments).length == 1) { return this.default } return _default };
            MuxSettingsManager.prototype.set = function(keu, value) { throw Error("Can't set to multiplexing settings manager") };

            function toSettings(obj) { if (typeof obj !== "object") return new SettingsManager({}); if (obj._isSettingsManager) return obj; return new SettingsManager(obj) } global.babelfishSettings = global.babelfishSettings || {};
            global._corelibSettings = global._corelibSettings || new MuxSettingsManager([]), global._defaultSettings = global._defaultSettings || new MuxSettingsManager([]), global._browserSettings = global._browserSettings || (new GetSettingsManager).child(global.babelfishSettings);

            function ExternalSettings(dfs) { MuxSettingsManager.call(this, [global._browserSettings, dfs, global._corelibSettings]) } ExternalSettings.prototype = Object.create(MuxSettingsManager.prototype);
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.appendDefault = function(setting) { this.defaultSettings().addChild(setting); return this };
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.defaultSettings = function() { return this.managers[1] };
            global._externalSettings = global._externalSettings || new ExternalSettings(global._defaultSettings);
            module.exports.settings = global._externalSettings;
            module.exports.corelibSettings = global._corelibSettings;
            module.exports.defaultSettings = global._defaultSettings;
            module.exports.toSettings = toSettings;
            module.exports.DynamicSetting = DynamicSetting;
            module.exports.SettingsManager = SettingsManager;
            module.exports.GetSettingsManager = GetSettingsManager;
            module.exports.MuxSettingsManager = MuxSettingsManager }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    158: [function(require, module, exports) { arguments[4][43][0].apply(exports, arguments) }, { "./scheduler.js": 156, "./settings.js": 157, "./util.js": 169, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/status.js": 43 }],
    159: [function(require, module, exports) { module.exports = require(44) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/super.js": 44 }],
    160: [function(require, module, exports) { arguments[4][45][0].apply(exports, arguments) }, { "./../../errno.js": 149, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/errors.js": 45 }],
    161: [function(require, module, exports) { arguments[4][46][0].apply(exports, arguments) }, { "./../../scheduler.js": 156, "./errors.js": 160, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/manager.js": 46 }],
    162: [function(require, module, exports) { arguments[4][47][0].apply(exports, arguments) }, { "./../errno.js": 149, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/errors.js": 47 }],
    163: [function(require, module, exports) { arguments[4][48][0].apply(exports, arguments) }, { "./../event.js": 150, "./../logging.js": 155, "./../scheduler.js": 156, "./../super.js": 159, "./errors.js": 162, "./status.js": 166, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/fsm.js": 48 }],
    164: [function(require, module, exports) { arguments[4][49][0].apply(exports, arguments) }, { "./../logging.js": 155, "./../util": 169, "./connection/manager.js": 161, "./errors.js": 162, "./sockettransaction.js": 165, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/serialtransaction.js": 49 }],
    165: [function(require, module, exports) { arguments[4][50][0].apply(exports, arguments) }, { "./../logging.js": 155, "./errors.js": 162, "./fsm.js": 163, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/sockettransaction.js": 50 }],
    166: [function(require, module, exports) { arguments[4][51][0].apply(exports, arguments) }, { "./../status.js": 158, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/status.js": 51 }],
    167: [function(require, module, exports) { arguments[4][52][0].apply(exports, arguments) }, { "./../logging.js": 155, "./../scheduler": 156, "./../util.js": 169, "./errors.js": 162, "./fsm.js": 163, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/usbtransaction.js": 52 }],
    168: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js").scheduler;

            function mkChecker(expected, check) { return function(obj) { if (!check(obj)) { return { error: "Expected " + expected + " got " + obj } } return { ok: true } } }

            function isSerializable(obj, dontCheckRecursive) { if (obj === null) return true; if (typeof obj === "function") return false; if (typeof obj !== "object") return true; if (obj instanceof Array) return !obj.some(function(x) { return !isSerializable(x) }); if (obj.__proto__ && obj.__proto__.__proto__) return false; if (!dontCheckRecursive) try { JSON.stringify(obj) } catch (c) { return false }
                return !Object.getOwnPropertyNames(obj).some(function(k) { return !isSerializable(obj[k], true) }) }

            function isIframeSerializable(obj) { if (obj instanceof ArrayBuffer) return true; if (isSerializable(obj)) return true; if (typeof obj !== "object") return false; return Object.getOwnPropertyNames(obj).reduce(function(ret, k) { return ret && isIframeSerializable(obj[k]) }, true) } var _callback = mkChecker("function", function(o) { return typeof o === "function" }); var checks = { callback: _callback, "function": _callback, object: mkChecker("object", function(o) { return o instanceof Object }), arraybuffer: mkChecker("arraybuffer", function(o) { return o instanceof ArrayBuffer }), array: mkChecker("array", function(o) { return o instanceof Array }), number: mkChecker("number", function(o) { return typeof o === "number" }), string: mkChecker("string", function(o) { return typeof o === "string" }), bool: mkChecker("string", function(o) { return typeof o === "boolean" }), "boolean": mkChecker("string", function(o) { return typeof o === "boolean" }), json: mkChecker("json", isSerializable), iframe: mkChecker("iframe", isIframeSerializable), any: function() { return { ok: true } } };

            function hasKey(obj, key) { return !Object.getOwnPropertyNames(obj).some(function(k) { return key === k }) }

            function getCheck(checker) { var chk = checks[checker]; if (typeof chk === "function") return chk; if (typeof checker === "function" && checker.prototype) return mkChecker(checker.name || "class", function(obj) { return obj instanceof checker }); if (checker instanceof Array) return function(arr) { return match(arr, checker) }; if (typeof checker === "object") return function(obj) { var ret;
                    Object.getOwnPropertyNames(checker).some(function(k) { if (typeof obj !== "object") { ret = { error: "Expected object, got " + obj }; return true } ret = getCheck(checker[k])(obj[k]); if (ret.error) ret.error = "{" + k + ": " + ret.error + "}"; return !!ret.error }); return ret }; throw Error("Unknown type checker:" + checker) }

            function match(args, checkers, index, cb) { if (args.length === 0 && checkers.length === 0) { return { ok: true } } if (args.length === 0 && checkers.length === 1 && checkers[0] === "varany") return { ok: true }; if (args.length === 0 || checkers.length === 0) { if (checkers[0] === "varany") return { error: "Last args should check with " + checkers.slice(1) + " but couldn't." };
                    cb && cb(args); return { error: "Wrong num of arguments: " + (index + args.length) + " (expected " + (index + checkers.length) + ")" } } var checker = checkers[0],
                    m; if (checker === "varany") { if (checkers.length === 1) return { ok: true };
                    m = match(args, checkers.slice(1), index, cb); if (m.ok) return m; return match(args.slice(1), checkers, index + 1, cb) } m = getCheck(checker)(args[0]); if (!m.ok) { cb && cb(checker, args[0]); return { error: "Argument #" + index + ": " + m.error } } return match(args.slice(1), checkers.slice(1), index + 1, cb) } var PRODUCTION = typeof global.it !== "function" && typeof global.describe !== "function" && typeof global.process === "undefined"; var settings = require("./settings.js").settings;

            function typecheck(args, checkers, callback) { if (PRODUCTION && !settings.get("typecheck")) return; var m = match([].slice.call(args), checkers, 0, callback); if (m.ok) return; throw Error(m.error) }

            function typechecked(fn, argtypes) { return function() { typecheck(arguments, argtypes, console.log.bind(console, "Typechecked:")); return fn.apply(null, arguments) } } module.exports.typechecked = typechecked;
            module.exports.typecheck = typecheck;
            module.exports.isSerializable = isSerializable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 156, "./settings.js": 157 }],
    169: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js");

            function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

            function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

            function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                    hex = hex.length < 2 ? "0" + hex : hex;
                    buf += " " + hex } buf += "]"; return buf }

            function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

            function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

            function shallowCopy(obj) { var ret = {}; if (!obj) return obj; if (typeof obj !== "object") throw Error("expected object, not " + typeof obj);
                Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = obj[k] }); if (obj.__proto__) ret.__proto__ = obj.__proto__; return ret }

            function replacePrototype(obj, cls1, cls2) { if (typeof obj !== "object" || typeof cls1 !== "function" || typeof cls2 !== "function") throw Error(); if (!obj || !obj.__proto__ || !cls1.prototype || !cls2.prototype) return obj; var ret = shallowCopy(obj); if (obj !== cls1.prototype) { ret.__proto__ = replacePrototype(ret.__proto__, cls1, cls2); return ret } return Object.create(cls2.prototype) }

            function forEachWithCallback(arr, cb, endCb) { scheduler.setTimeout(function() { if (arr.length <= 0) { endCb(); return } cb(arr[0], function() { forEachWithCallback(arr.slice(1), cb, endCb) }) }) }

            function repeat(times, fn) { var ret = new Array(times); for (var i = 0; i < times; i++) ret[i] = fn(); return ret }

            function compareVersions(v1, v2, callbacks) {
                function justParse(x) { return Number.parseInt(x) } return compareVersionLists(v1.split(".").map(justParse), v2.split(".").map(justParse), callbacks) }

            function compareVersionLists(v1, v2, cbs) { if (isNaN(v1[0]) || isNaN(v2[0])) return cbs.err(); if (v1[0] < v2[0] || v1.length === 0) return cbs.lt(); if (v1[0] > v2[0] || v2.length === 0) return cbs.gt(); if (v1.length === 0 && v2.length === 0) return cbs.eq(); return compareVersionLists(v1.slice(1), v2.slice(1), cbs) }

            function getUniqueId(name) { global.babelfishUniqueIds = global.babelfishUniqueIds || {};
                global.babelfishUniqueIds[name] = global.babelfishUniqueIds[name] || 1; return global.babelfishUniqueIds[name]++ } module.exports.compareVersions = compareVersions;
            module.exports.repeat = repeat;
            module.exports.forEachWithCallback = forEachWithCallback;
            module.exports.storeAsTwoBytes = storeAsTwoBytes;
            module.exports.storeAsFourBytes = storeAsFourBytes;
            module.exports.hexRep = hexRep;
            module.exports.binToBuf = binToBuf;
            module.exports.bufToBin = bufToBin;
            module.exports.shallowCopy = shallowCopy;
            module.exports.replacePrototype = replacePrototype;
            module.exports.getUniqueId = getUniqueId }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 156 }],
    170: [function(require, module, exports) { module.exports = require(55) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/wrapper.js": 55 }],
    171: [function(require, module, exports) { var toSettings = require("corelib").toSettings;
        module.exports.Monitor = require("./lib/monitor.js").Monitor;
        module.exports.errors = require("./lib/errors.js");
        module.exports.status = require("./lib/status.js") }, { "./lib/errors.js": 173, "./lib/monitor.js": 175, "./lib/status.js": 179, corelib: 182 }],
    172: [function(require, module, exports) { var errors = require("./errors.js"),
            ReceiveErrorEvent = require("./receiveerrorevent.js").ReceiveErrorEvent,
            Event = require("corelib").Event;

        function Connection(port, baudrate, api) { var self = this;
            this.api = api;
            this.disconnected = false;
            this.onConnected = new Event;
            this.onDisconnected = new Event;
            this.onReceiveError = null;
            this.onConnected.modifyDispatcher(function(d) { return function(l, va) { var args = arguments;
                    self.api.serial.setControlSignals(self.info.connectionId, { dtr: true, rts: false }, function(ok) { return d.apply(null, args) }) } });
            this.port = port;
            this.baudrate = baudrate;
            this.isTaken(this.port, function(taken) { if (taken) { self.onDisconnected.dispatch(errors.RESOURCE_BUSY_FROM_CHROME); return } self.connect(port, baudrate) }) } Connection.prototype = { errorDispatcher: function(listener, error) { if (error.error !== "device_lost") { listener(errors.UNKNOWN_MONITOR_ERROR.copy({ apiError: error })); return } listener(errors.SERIAL_MONITOR_DEVICE_LOST.copy()) }, isTaken: function(port, cb) { this.api.serial.getConnections(function(cnxs) { var taken = cnxs.some(function(c) { return c.name == port });
                    cb(taken) }) }, connect: function(port, baudrate) { var self = this;
                this.api.serial.connect(port, { name: port, bitrate: baudrate }, function(info) { if (!info) { self.disconnect(errors.SERIAL_MONITOR_CONNECT); return } self.onReceiveError = new ReceiveErrorEvent(info.connectionId, self.api);
                    self.onReceiveError.setDispatcher(self.errorDispatcher.bind(self));
                    self.onReceiveError.addListener(self.disconnect.bind(self));
                    self.info = info;
                    self.onConnected.dispatch(info);
                    self.onConnected.close(); if (self.disconnected) { self.disconnected = false;
                        self.disconnect() } }) }, disconnect: function(error) { var self = this; if (this.disconnected) return;
                this.disconnected = true;

                function disconnect(err) { self.disconnected = true;
                    self.onDisconnected.dispatch(err || errors.SUCCESS); if (self.onReceiveError) self.onReceiveError.close();
                    self.onConnected.close();
                    self.onDisconnected.close() } if (!this.info) { return } self.api.serial.getConnections(function(cnx) { if (!cnx.some(function(c) { return c.connectionId == self.info.connectionId })) { disconnect(error || errors.SERIAL_MONITOR_DEVICE_LOST); return } self.api.serial.disconnect(self.info.connectionId, function(ok) { var err = null; if (!ok) { err = errors.SERIAL_MONITOR_DISCONNECT } disconnect(err || error) }) }) } };
        module.exports.Connection = Connection }, { "./errors.js": 173, "./receiveerrorevent.js": 178, corelib: 182 }],
    173: [function(require, module, exports) { var errno = require("corelib").errno,
            RetVal = require("corelib").RetVal;
        module.exports = errno({ RESOURCE_BUSY: new RetVal(-22, "Serial monitor seems to be open"), RESOURCE_BUSY_FROM_CHROME: new RetVal(-22, "Serial monitor seems to be open by chrome"), UNKNOWN_MONITOR_ERROR: new RetVal(20151, "Unrecognized serial monitor error"), SERIAL_MONITOR_CONNECT: new RetVal(-55, "Serial monitor failed to connect"), SERIAL_MONITOR_WRITE: new RetVal(20153, "Failed to write to serial monitor"), SERIAL_MONITOR_DISCONNECT: new RetVal(20154, "Failed to disconnect from serial monitor"), SERIAL_MONITOR_PREMATURE_DISCONNECT: new RetVal(20155, "Tried to disconnect from serial monitor before connection was established"), SERIAL_MONITOR_WRITE_BEFORE_CONNECT: new RetVal(20156, "Tried to write to a non connected serial monitor"), SERIAL_MONITOR_DEVICE_LOST: new RetVal(20157, "Serial monitor lost the connected device."), SPAMMING_DEVICE: new RetVal(20010, "Device is too fast for us to handle.") }) }, { corelib: 182 }],
    174: [function(require, module, exports) { var Event = require("corelib").Event,
            util = require("./util.js"),
            getLog = require("corelib").getLog,
            scheduler = require("corelib").scheduler;

        function LineBuffer(data, unfinishedChar, flushData, expireCb) { var self = this;
            this.log = getLog("LineBuffer");
            this.unfinishedChar = unfinishedChar || [];
            this.data = data || "";
            this.flushData = flushData || "";
            this.maxSize = 1e3;
            this.frozen = false;
            this.expired = false; if (expireCb) { this.expirationTimeout = scheduler.setTimeout(function() { if (self.frozen || self.data.length == 0) return;
                    self.log.log("Expiring data:", self.data);
                    self.expired = true;
                    expireCb(self.data) }, 100) } } LineBuffer.prototype = { splitLines: function(str) { var finishedLineRx = "(:?.*?(:?\\r\\n|\\n|\\r))",
                    unfinishedLineRx = "(:?.+$)",
                    fullRx = "(:?" + [finishedLineRx, unfinishedLineRx].join("|") + ")",
                    ret = str.match(new RegExp(fullRx, "gm")); if (!ret) return [""]; var lastLine = ret[ret.length - 1]; if (lastLine[lastLine.length - 1].match(new RegExp(finishedLineRx))) { return ret.concat([""]) } return ret }, updated: function(message, expireCb) { var data = this.expired ? "" : this.data,
                    parsedMessage = util.utf8ArrayToStr(this.unfinishedChar.concat(message)),
                    flushArray = this.splitLines(data + parsedMessage.result),
                    newBuffer = flushArray.pop();
                this.freeze(); if (newBuffer.length > this.maxSize) { return new LineBuffer("", parsedMessage.leftovers, flushArray.concat([newBuffer]).join(""), expireCb) } return new LineBuffer(newBuffer, parsedMessage.leftovers, flushArray.join(""), expireCb) }, freeze: function() { this.frozen = true; if (this.expirationTimeout) { scheduler.clearTimeout(this.expirationTimeout) } } };
        module.exports.LineBuffer = LineBuffer }, { "./util.js": 180, corelib: 182 }],
    175: [function(require, module, exports) { var Connection = require("./connection.js").Connection,
            Writer = require("./writer.js").Writer,
            Reader = require("./reader.js").Reader,
            Event = require("corelib").Event,
            errors = require("./errors.js");

        function Monitor(port, baudrate, api) { var self = this;
            this.onClose = new Event;
            this.onRead = new Event;
            this.onConnected = new Event;
            this.closed = false;
            this.api = api;
            this.connection = new Connection(port, baudrate, api);
            this.connection.onDisconnected.addListener(this.disconnect.bind(this));
            this.reader = new Reader(self.api);
            this.writer = new Writer(self.api);
            this.connection.onConnected.addListener(function(info) { self.reader.init(info.connectionId);
                self.reader.addListener(self.onRead.dispatch.bind(self.onRead));
                self.writer.init(info.connectionId);
                self.writer.onWriteFail.addListener(self.disconnect.bind(self));
                self.onConnected.dispatch(info);
                self.onConnected.close() }) } Monitor.prototype = { write: function(strData, cb) { if (this.writer) { this.writer.write(strData, cb); return } this.onError.display(errors.SERIAL_MONITOR_WRITE_BEFORE_CONNECT);
                cb() }, disconnect: function(retVal) { if (this.closed) return;
                this.closed = true;
                this.connection.disconnect(); if (this.reader) this.reader.close();
                this.onConnected.close();
                this.onClose.dispatch(retVal || errors.SUCCESS);
                this.onClose.close() } };
        module.exports.Monitor = Monitor }, { "./connection.js": 172, "./errors.js": 173, "./reader.js": 176, "./writer.js": 181, corelib: 182 }],
    176: [function(require, module, exports) { var Event = require("corelib").Event,
            util = require("./util.js"),
            bufToBin = require("corelib").bufToBin,
            LineBuffer = require("./linebuffer.js").LineBuffer,
            rs = require("./readerstates.js"),
            getLog = require("corelib").getLog,
            scheduler = require("corelib").scheduler;

        function PreliminaryState(reader, cons) { this.log = getLog("PreliminaryReaderState");
            rs.State.call(this, reader, cons);
            this.name = "PreliminaryState";
            this.reader.leftoverBuffers = {} } PreliminaryState.prototype = Object.create(rs.State.prototype);
        PreliminaryState.prototype._handler = function(msg) { var data = bufToBin(msg.data);
            this.log.log("Got bytes:", data.length); if (!msg || !msg.connectionId) return;
            this.reader.leftoverBuffers[msg.connectionId] = this.reader.leftoverBuffers[msg.connectionId] || []; var bufs = this.reader.leftoverBuffers[msg.connectionId],
                lastBuf = bufs[bufs.length - 1] || new LineBuffer,
                newBuf = lastBuf.updated(data, null);
            bufs.push(newBuf) };
        PreliminaryState.prototype._destroy = function() { var self = this,
                bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [];
            this.reader.lastBuffer = bufs[bufs.length - 1];
            this.buffers = null };

        function NormalState(reader, cons) { this.log = getLog("NormalState");
            rs.State.call(this, reader, cons);
            this.name = "NormalState"; var bufs = this.reader.leftoverBuffers[this.reader.connectionId] || [],
                self = this;
            this.log.log("Entering normal state, connectionId:", this.reader.connectionId, "pending buffers:", bufs.length);
            bufs.forEach(function(b) { self.reader.dispatch(b.flushData) });
            this.buffer = bufs[bufs.length - 1] || new LineBuffer } NormalState.prototype = Object.create(rs.State.prototype);
        NormalState.prototype._handler = function(msg) { if (msg.connectionId !== this.reader.connectionId) return; var arr = bufToBin(msg.data);
            this.log.log("Got bytes:", arr.length);
            this.buffer = this.buffer.updated(arr, this.reader.dispatch.bind(this.reader));
            this.reader.dispatch(this.buffer.flushData) };
        NormalState.prototype._destroy = function() { this.buffer.freeze() };

        function Reader(api) { this.log = getLog("Reader");
            Event.call(this);
            this.api = api;
            this.leftoverBuffers = {};
            this.stateList = new rs.StateCons(this, PreliminaryState, rs.NilCons) } Reader.prototype = Object.create(Event.prototype);
        Reader.prototype.init = function(connectionId) { this.buffer = new LineBuffer;
            this.connectionId = connectionId;
            this.stateList = new rs.StateCons(this, NormalState, this.stateList) };
        Reader.prototype.readHandler_ = function(message) { var stringMessage = bufToBin(message);
            this.buffer = this.buffer.updated(stringMessage, this.dispatch.bind(this));
            this.log.log("Flushing bytes:", this.buffer.flushData.length);
            this.dispatch(this.buffer.flushData) };
        Reader.prototype.close = function() { Event.prototype.close.call(this);
            this.stateList.destroy();
            this.stateList = rs.NilCons;
            this.leftoverBuffers = {} };
        module.exports.Reader = Reader }, { "./linebuffer.js": 174, "./readerstates.js": 177, "./util.js": 180, corelib: 182 }],
    177: [function(require, module, exports) { var getLog = require("corelib").getLog;

        function State(reader, cons) { var self = this;
            this.log = this.log || getLog("ReaderState");
            this.reader = reader;
            this.cons = cons;
            this.destroyed = false;
            this.handler = function() { if (this.destroyed) return null;
                self.cons.cdr.destroy();
                self.cons.cdr = NilCons; if (!self._handler) return null; return self._handler.apply(self, arguments) };
            this.log.log("Registering listener");
            this.reader.api.serial.onReceive.addListener(this.handler) } State.prototype = { _handler: function() {}, _destroy: function() {}, destroy: function() { this.destroyed = true; if (this.handler) this.log.log("Unregistering listener");
                this.reader.api.serial.onReceive.removeListener(this.handler); if (this._destroy) this._destroy() } };

        function stateFactory(handler, destroy, data) { var created = false,
                ret = function(reader, cons) { State.call(this, reader, cons);
                    this.data = data };
            ret.prototype = Object.create(State.prototype);
            ret.prototype._handler = handler || function() {};
            ret.prototype._destroy = destroy || function() {}; return ret }

        function StateCons(reader, car, cdr) { this.car = new car(reader, this);
            this.cdr = cdr || NilCons } StateCons.prototype = { destroy: function() { if (this.destroyed) return;
                this.destroyed = true;
                this.car.destroy();
                this.cdr.destroy();
                this.cdr = NilCons } }; var nop = function() {},
            NilCons = new StateCons(null, function() { this.destroy = nop }, { destroy: nop });
        NilCons.destroy = nop;
        module.exports.State = State;
        module.exports.NilCons = NilCons;
        module.exports.StateCons = StateCons;
        module.exports.stateFactory = stateFactory }, { corelib: 182 }],
    178: [function(require, module, exports) {
        var scheduler = require("corelib").scheduler,
            Event = require("corelib").Event;

        function ReceiveErrorEvent(connectionId, api) { var self = this;
            Event.call(this);
            this.api = api;
            this.connectionId = connectionId;
            this.nextPoll = null;
            this.closed = false;
            this.dispatched = false;
            this.chromeListener = function(info) { if (info.connectionId == self.connectionId) { self.dispatch(info) } };
            api.serial.onReceiveError.addListener(this.chromeListener); if (0) api.runtime.getPlatformInfo(function(platform) { if (platform.os == "win") { self.poll(self.pollDtr.bind(self)) } }) } ReceiveErrorEvent.prototype = Object.create(Event.prototype);
        ReceiveErrorEvent.prototype.dispatch = function() { if (this.dispatched || this.closed) { return } this.dispatched = true;
            Event.prototype.dispatch.apply(this, arguments) };
        ReceiveErrorEvent.prototype.connectionOk = function() { if (this.nextPoll) { this.reschedulePoll(null) } };
        ReceiveErrorEvent.prototype.pollDtr = function(next, dispatch) { var self = this; if (this.dispatched) return;
            console.log("Polling dtr...");
            this.checkConnection(function(ok) { if (ok) { self.reschedulePoll(next); return } scheduler.setImmediate(function() { self.nextPoll = null;
                    dispatch({ connectionId: self.connectionId, error: "device_lost" }) }) }) };
        ReceiveErrorEvent.prototype.reschedulePoll = function(cb) { var callback; if (this.nextPoll) { scheduler.clearTimeout(this.nextPoll.handler);
                callback = this.nextPoll.callback } if (cb) { callback = cb } if (callback) { this.nextPoll = { handler: scheduler.setTimeout(callback, 1e3), callback: callback } } };
        ReceiveErrorEvent.prototype.checkConnection = function(cb) { this.api.serial.setControlSignals(this.connectionId, { dtr: false }, cb) };
        ReceiveErrorEvent.prototype.close = function() {
            Event.prototype.close.call(this);
            if (this.nextPoll) { scheduler.clearTimeout(this.nextPoll.handler) } this.closed = true;
            this.api.serial.onReceiveError.removeListener(this.chromeListener)
        };
        module.exports.ReceiveErrorEvent = ReceiveErrorEvent
    }, { corelib: 182 }],
    179: [function(require, module, exports) { var status = require("corelib").status,
            Status = require("corelib").Status;
        module.exports = status({}) }, { corelib: 182 }],
    180: [function(require, module, exports) {
        function strToUtf8Array(str) { var utf8 = []; for (var i = 0; i < str.length; i++) { var charcode = str.charCodeAt(i); if (charcode < 128) utf8.push(charcode);
                else if (charcode < 2048) { utf8.push(192 | charcode >> 6, 128 | charcode & 63) } else if (charcode < 55296 || charcode >= 57344) { utf8.push(224 | charcode >> 12, 128 | charcode >> 6 & 63, 128 | charcode & 63) } else { i++;
                    charcode = 65536 + ((charcode & 1023) << 10 | str.charCodeAt(i) & 1023);
                    utf8.push(240 | charcode >> 18, 128 | charcode >> 12 & 63, 128 | charcode >> 6 & 63, 128 | charcode & 63) } } return utf8 }

        function utf8ArrayToStr(array) { var out, i, len, c; var char2, char3;
            out = "";
            len = array.length;
            i = 0; while (i < len) { c = array[i++]; if (c >> 7 == 0) { out += String.fromCharCode(c); continue } if (c >> 6 == 2) { continue } var extraLength = null; if (c >> 5 == 6) { extraLength = 1 } else if (c >> 4 == 14) { extraLength = 2 } else if (c >> 3 == 30) { extraLength = 3 } else if (c >> 2 == 62) { extraLength = 4 } else if (c >> 1 == 126) { extraLength = 5 } else { continue } if (i + extraLength > len) { var leftovers = array.slice(i - 1); for (; i < len; i++)
                        if (array[i] >> 6 != 2) break; if (i != len) continue; return { result: out, leftovers: leftovers } } var mask = (1 << 8 - extraLength - 1) - 1,
                    res = c & mask,
                    nextChar, count; for (count = 0; count < extraLength; count++) { nextChar = array[i++]; if (nextChar >> 6 != 2) { break } res = res << 6 | nextChar & 63 } if (count != extraLength) { i--; continue } if (res <= 65535) { out += String.fromCharCode(res); continue } res -= 65536; var high = (res >> 10 & 1023) + 55296,
                    low = (res & 1023) + 56320;
                out += String.fromCharCode(high, low) } return { result: out, leftovers: [] } } module.exports.strToUtf8Array = strToUtf8Array;
        module.exports.utf8ArrayToStr = utf8ArrayToStr }, {}],
    181: [function(require, module, exports) { var errors = require("./errors.js"),
            getLog = require("corelib").getLog,
            scheduler = require("corelib").scheduler,
            Event = require("corelib").Event,
            util = require("./util.js"),
            binToBuf = require("corelib").binToBuf;

        function Writer(api) { this.strData = [];
            this.connectionId = null;
            this.api = api;
            this.onWriteFail = new Event;
            this.log = getLog("Writer") } Writer.prototype = { init: function(connectionId) { this.connectionId = connectionId; if (this.strData.length > 0) { this.write(this.data) } }, write: function(strData, cb) { if (!this.connectionId) { this.data = this.strData + strData; if (cb) scheduler.setTimeout(cb); return } var self = this,
                    data = util.strToUtf8Array(strData);
                this.api.serial.send(this.connectionId, binToBuf(data), function(sendInfo) { self.log.log("Sent data of length:", data.length); if (!sendInfo || sendInfo.error) { self.onWriteFail.dispatch(errors.SERIAL_MONITOR_WRITE); return } if (cb) cb(sendInfo) }) } };
        module.exports.Writer = Writer }, { "./errors.js": 173, "./util.js": 180, corelib: 182 }],
    182: [function(require, module, exports) { arguments[4][29][0].apply(exports, arguments) }, { "./lib/data/base64.js": 183, "./lib/data/data.js": 184, "./lib/data/errors.js": 185, "./lib/data/intelhex.js": 186, "./lib/errno.js": 187, "./lib/event.js": 188, "./lib/io/codecsocket.js": 190, "./lib/io/errors.js": 191, "./lib/logging.js": 193, "./lib/scheduler.js": 194, "./lib/settings.js": 195, "./lib/status.js": 196, "./lib/transactions/connection/errors.js": 198, "./lib/transactions/connection/manager.js": 199, "./lib/transactions/errors.js": 200, "./lib/transactions/fsm.js": 201, "./lib/transactions/serialtransaction.js": 202, "./lib/transactions/sockettransaction.js": 203, "./lib/transactions/usbtransaction.js": 205, "./lib/typecheck.js": 206, "./lib/util.js": 207, "./lib/wrapper.js": 208, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/index.js": 29 }],
    183: [function(require, module, exports) { arguments[4][30][0].apply(exports, arguments) }, { "./data.js": 184, "./errors.js": 185, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/base64.js": 30 }],
    184: [function(require, module, exports) { arguments[4][31][0].apply(exports, arguments) }, { "./../scheduler.js": 194, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/data.js": 31 }],
    185: [function(require, module, exports) { arguments[4][32][0].apply(exports, arguments) }, { "./../errno.js": 187, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/errors.js": 32 }],
    186: [function(require, module, exports) { arguments[4][33][0].apply(exports, arguments) }, { "./data.js": 184, "./errors.js": 185, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/data/intelhex.js": 33 }],
    187: [function(require, module, exports) { arguments[4][34][0].apply(exports, arguments) }, { "./settings.js": 195, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/errno.js": 34 }],
    188: [function(require, module, exports) { arguments[4][35][0].apply(exports, arguments) }, { "./scheduler.js": 194, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/event.js": 35 }],
    189: [function(require, module, exports) { arguments[4][36][0].apply(exports, arguments) }, { "./../event.js": 188, "./../logging.js": 193, "./errors.js": 191, "./serial.js": 192, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/buffer.js": 36 }],
    190: [function(require, module, exports) { arguments[4][37][0].apply(exports, arguments) }, { "./../event.js": 188, "./../logging.js": 193, "./../scheduler.js": 194, "./buffer.js": 189, "./errors.js": 191, "./serial.js": 192, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/codecsocket.js": 37 }],
    191: [function(require, module, exports) { arguments[4][38][0].apply(exports, arguments) }, { "./../errno.js": 187, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/errors.js": 38 }],
    192: [function(require, module, exports) { arguments[4][39][0].apply(exports, arguments) }, { "./../event.js": 188, "./../logging.js": 193, "./../scheduler.js": 194, "./../util.js": 207, "./errors.js": 191, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/io/serial.js": 39 }],
    193: [function(require, module, exports) {
        (function(global) { var dbg = console.log.bind(console),
                NODEJS = global.window !== global,
                toSettings = require("./settings.js").toSettings,
                consoleSettings = toSettings({ verbosity: 0, logger: "default" }),
                settings = require("./settings.js").settings;
            require("./settings.js").corelibSettings.addParent(consoleSettings);

            function ModifiedConsole(console) { this.console = console;
                this.setConsoleMethod("error");
                this.setConsoleMethod("warn");
                this.setConsoleMethod("info");
                this.setConsoleMethod("log");
                this.setConsoleMethod("debug") } ModifiedConsole.prototype = { setConsoleMethod: function(type) { var self = this;
                    Object.defineProperty(this, type, { get: function() { return self.consoleMethod(Function.prototype.bind.call(self.console[type], self.console), type) } }) }, consoleMethod: function(origMethod, name) { return origMethod } };

            function ConditionalConsole(console) { ModifiedConsole.call(this, console) } ConditionalConsole.prototype = Object.create(ModifiedConsole.prototype);
            ConditionalConsole.prototype.consoleMethod = function(origLog, name) { if (this.shouldCall(origLog, name)) return origLog; return function() {} };
            ConditionalConsole.prototype.shouldCall = function(origLog, name) { return true };

            function VerbosityConsole(console) { ConditionalConsole.call(this, console);
                this.typeThresholds = { error: 0, warn: 1, info: 2, log: 3, debug: 4 } } VerbosityConsole.prototype = Object.create(ConditionalConsole.prototype);
            VerbosityConsole.prototype.verbosity = function() { if (typeof this.verbosity === "number") return this.verbosity; return settings.get("verbosity") };
            VerbosityConsole.prototype.shouldCall = function(origLog, name) { var threshold = this.typeThresholds[name]; return this.verbosity() >= threshold && !NODEJS };

            function PrefixConsole(prefix, console) { ModifiedConsole.call(this, console);
                this.prefix = prefix } PrefixConsole.prototype = Object.create(ModifiedConsole.prototype);
            PrefixConsole.prototype.consoleMethod = function(origLog) { var ol = ModifiedConsole.prototype.consoleMethod.call(this, origLog); return ol.bind(null, "[" + this.getPrefix() + "]") };
            PrefixConsole.prototype.getPrefix = function() { return this.prefix };

            function PrefixTimestampConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimestampConsole.prototype = Object.create(PrefixConsole.prototype);
            PrefixTimestampConsole.prototype.getPrefix = function() { return this.timestampString() + ":" + this.prefix };
            PrefixTimestampConsole.prototype.timestampString = function() { var date = this.getDate(); var pad = function(n) { if (n < 10) { return "0" + n } return n }; return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) + "." + this.zeroFill(date.getMilliseconds(), 3) };
            PrefixTimestampConsole.prototype.zeroFill = function(number, width) { width -= number.toString().length; if (width > 0) { return new Array(width + (/\./.test(number) ? 2 : 1)).join("0") + number } return number + "" };
            PrefixTimestampConsole.prototype.getDate = function() { return new Date };

            function PrefixTimediffConsole(prefix, console) { PrefixConsole.call(this, prefix, console) } PrefixTimediffConsole.prototype = Object.create(PrefixTimestampConsole.prototype);
            PrefixTimediffConsole.prototype.lastLogTime = Date.now();
            PrefixTimediffConsole.prototype.getDate = function() { var proto = Object.getPrototypeOf(this),
                    time = Date.now() - proto.lastLogTime;
                proto.lastLogTime = Date.now(); return new Date(time + (new Date).getTimezoneOffset() * 6e4) }; var loggers = { "default": function(prefix) { return new VerbosityConsole(new PrefixTimestampConsole(prefix, global.console)) }, timediff: function(prefix) { return new VerbosityConsole(new PrefixTimediffConsole(prefix, global.console)) } };

            function getLog(prefix) { return (loggers[settings.get("logger")] || loggers["default"])(prefix) } module.exports.getLog = getLog }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./settings.js": 195 }],
    194: [function(require, module, exports) {
        (function(global) { var NO_DOM = !(global.removeEventListener && global.addEventListener && global.postMessage),
                TESTING = typeof global.it === "function" && typeof global.describe === "function";

            function WaitHelperDom(waiter) { this.waiter = waiter } WaitHelperDom.prototype = { maybeListen: function() { if (this.domListener) return; var self = this;
                    this.domListener = function(ev) { if (ev.source !== window) return; var data = ev.data; if (!data || !(data instanceof Object) || data.waiterId != self.waiter.id) return;
                        self.guard() };
                    global.addEventListener("message", this.domListener, true) }, due: function() { if (typeof this.due === "number") return this.due; return this.waiter.due }, guard: function() { if (this.due() > this.waiter.async.now()) { this.wait(); return } this.close();
                    this.waiter.guard() }, close: function() { if (!this.domListener) return;
                    global.removeEventListener("message", this.domListener);
                    this.domListener = null }, wait: function(ms) { if (typeof ms === "number") this.due = this.waiter.async.now() + ms;
                    this.maybeListen();
                    global.postMessage({ waiterId: this.waiter.id }, "*") } };

            function WaitHelperJs(waiter) { this.waiter = waiter } WaitHelperJs.prototype = { close: function() { if (!this.handle) return;
                    global.clearTimeout(this.handle);
                    this.handle = null }, wait: function(ms) { var self = this,
                        time = typeof ms === "number" ? ms : this.waiter.due - this.waiter.async.now();
                    this.handle = global.setTimeout(function() { self.waiter.guard() }, time) } }; var waiterIds = 1;

            function Waiter(cb, due, async) { this.cb = cb;
                this.due = due;
                this.async = async;
                this.onClose = null;
                this.closed = false;
                this.id = waiterIds++ } Waiter.prototype = { setHelper: function(helper) { if (this.helper) this.helper.close();
                    this.helper = helper; return helper }, guard: function() { if (this.closed) return; var tl = this.due - this.async.now(); if (tl < 0) { this.close();
                        this.cb(); return } this.run() }, run: function() { if (this.closed) return null; var self = this; if (this.due - this.async.now() >= 1e3 || NO_DOM) { this.setHelper(new WaitHelperJs(this)) } else { this.setHelper(new WaitHelperDom(this)) } this.helper.wait(); return this }, close: function() { if (this.closed) return;
                    this.closed = true;
                    this.setHelper(null); if (this.onClose) this.onClose();
                    this.onClose = null }, quickRun: function() { if (this.closed) return null;
                    this.setHelper(new WaitHelperJs(this)).wait(0); return this } };

            function Async() { this.index = new WaiterIndex } Async.prototype = { wait: function(cb, due) { return new Waiter(cb, due, this) }, postpone: function(cb) { new Waiter(cb, this.now(), this) }, now: function() { return Date.now() }, setTimeout: function(cb, to) { return this.index.put(this.wait(cb, (to || 0) + this.now()).run()) }, clearTimeout: function(id) { this.index.rm(id) }, clearImmediate: function(id) { return this.clearTimeout(id) }, setImmediate: function(cb) { return this.setTimeout(cb, 0) } };

            function TestAsync() { this.index = new WaiterIndex;
                this.offset = 0;
                this.capHandle = null } TestAsync.prototype = Object.create(Async.prototype);
            TestAsync.prototype.idleCap = function() { var waiter = this.index.minDue(); if (waiter === null) { if (this.onEnd) this.onEnd();
                    this.capHandle = null; return } this.changeClock(waiter.due);
                waiter.quickRun();
                this.idleRenew() };
            TestAsync.prototype.idleRenew = function() { var self = this; if (!this.capHandle) this.capHandle = global.setTimeout(function() { self.capHandle = null;
                    self.idleCap() }) };
            TestAsync.prototype.changeClock = function(ms) { this.offset = ms - Date.now() };
            TestAsync.prototype.now = function() { return Date.now() + this.offset };
            TestAsync.prototype.setTimeout = function(cb, ms) { if (!cb) throw Error("Excpected a callback but got" + cb);
                this.idleRenew(); return this.index.put(this.wait(cb, (ms || 0) + this.now())) };

            function WaiterIndex() { this.db = {} } WaiterIndex.prototype = { put: function(obj) { this.rm(obj.id);
                    this.db[obj.id] = obj;
                    obj.onClose = this.rm.bind(this, obj.id); return obj.id }, get: function(id) { return this.db[id] }, rm: function(id) { var waiter = this.db[id]; if (!waiter) return;
                    waiter.close();
                    this.rawDel(id) }, rawDel: function(id) { delete this.db[id] }, minDue: function() { var self = this,
                        keys = Object.getOwnPropertyNames(this.db); if (keys.length > 0) { var minkey = keys.reduce(function(mink, k) { var cand = self.db[k],
                                min = self.db[mink]; if (!min) return min; if (min.due < cand.due) return mink; if (min.due == cand.due && min.id < cand.id) return mink; return k }); return this.get(minkey) } return null }, array: function() { var self = this; return Object.getOwnPropertyNames(this.db).map(function(k) { return self.db[k] }) }, length: function() { return Object.getOwnPropertyNames(this.db).length } }; if (TESTING) { module.exports = new TestAsync } else { module.exports = new Async } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    195: [function(require, module, exports) {
        (function(global) {
            function DynamicSetting(cb) { this.cb = cb } DynamicSetting.prototype = { _isDynamicSetting: true };

            function SettingsManager(settings) { this.settings = settings;
                this.default = null } SettingsManager.prototype = { _isSettingsManager: true, set: function(key, value) { this.settings[key] = value }, get: function(key, _default) { if (!this.has(key)) { if ([].slice.call(arguments).length == 1) { return this.default } return _default } var ret = this.settings[key]; if (ret && ret._isDynamicSetting) return ret.cb(); return ret }, keys: function() { return Object.getOwnPropertyNames(this.settings) }, obj: function() { var dic = {},
                        self = this;
                    this.keys().reverse().forEach(function(k) { dic[k] = self.get(k) }); return dic }, has: function(key) { return Object.hasOwnProperty.call(this.settings, key) }, parent: function(settings) { return new MuxSettingsManager([this, toSettings(settings)]) }, child: function(settings) { return new MuxSettingsManager([toSettings(settings), this]) } };

            function GetSettingsManager() { this.prefix = "babelfish_";
                this.settings = this.updatedSettings(); if (this.settings.managers) debugger } GetSettingsManager.prototype = Object.create(SettingsManager.prototype);
            GetSettingsManager.prototype.set = function() { throw Error("Cont'set to settings manager based on GET") };
            GetSettingsManager.prototype.get = function(key, _default) { return SettingsManager.prototype.get.call(this, key.toLowerCase(), _default) };
            GetSettingsManager.prototype.has = function(key) { return SettingsManager.prototype.has.call(this, key.toLowerCase()) };
            GetSettingsManager.prototype.updatedSettings = function() { var self = this,
                    dic = {},
                    get = global.window && window.location && window.location.search && window.location.search.split("?" + this.prefix)[1] || null; if (get !== null) { get.split("&" + this.prefix).forEach(function(g) { var s = g.split("=");
                        dic[s[0].toLowerCase()] = self.parseValue(s[1]) }) } return dic };
            GetSettingsManager.prototype.parseValue = function(val) { try { return JSON.parse(val) } catch (e) { return val } };

            function MuxSettingsManager(lst) { this.managers = lst } MuxSettingsManager.prototype = Object.create(SettingsManager.prototype);
            MuxSettingsManager.prototype.has = function(key) { return this.managers.some(function(m) { return m.has(key) }) };
            MuxSettingsManager.prototype.addParent = function(manager) { this.managers.push(manager); return this }, MuxSettingsManager.prototype.addChild = function(manager) { this.managers = [toSettings(manager)].concat(this.managers); return this }, MuxSettingsManager.prototype.keys = function() { var dic = {}; for (var i = this.managers.length - 1; i >= 0; i--) { this.managers[i].keys().reverse().forEach(function(k) { dic[k] = null }) } return Object.getOwnPropertyNames(dic) };
            MuxSettingsManager.prototype.get = function(key, _default) { for (var i = 0; i < this.managers.length; i++) { var m = this.managers[i]; if (!m.has(key)) continue; return m.get(key) } if ([].slice.call(arguments).length == 1) { return this.default } return _default };
            MuxSettingsManager.prototype.set = function(keu, value) { throw Error("Can't set to multiplexing settings manager") };

            function toSettings(obj) { if (typeof obj !== "object") return new SettingsManager({}); if (obj._isSettingsManager) return obj; return new SettingsManager(obj) } global.babelfishSettings = global.babelfishSettings || {};
            global._corelibSettings = global._corelibSettings || new MuxSettingsManager([]), global._defaultSettings = global._defaultSettings || new MuxSettingsManager([]), global._browserSettings = global._browserSettings || (new GetSettingsManager).child(global.babelfishSettings);

            function ExternalSettings(dfs) { MuxSettingsManager.call(this, [global._browserSettings, dfs, global._corelibSettings]) } ExternalSettings.prototype = Object.create(MuxSettingsManager.prototype);
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.appendDefault = function(setting) { this.defaultSettings().addChild(setting); return this };
            ExternalSettings.prototype.withDefault = function(setting) { return new ExternalSettings(this.defaultSettings().child(setting)) };
            ExternalSettings.prototype.defaultSettings = function() { return this.managers[1] };
            global._externalSettings = global._externalSettings || new ExternalSettings(global._defaultSettings);
            module.exports.settings = global._externalSettings;
            module.exports.corelibSettings = global._corelibSettings;
            module.exports.defaultSettings = global._defaultSettings;
            module.exports.toSettings = toSettings;
            module.exports.DynamicSetting = DynamicSetting;
            module.exports.SettingsManager = SettingsManager;
            module.exports.GetSettingsManager = GetSettingsManager;
            module.exports.MuxSettingsManager = MuxSettingsManager }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    196: [function(require, module, exports) { arguments[4][43][0].apply(exports, arguments) }, { "./scheduler.js": 194, "./settings.js": 195, "./util.js": 207, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/status.js": 43 }],
    197: [function(require, module, exports) { module.exports = require(44) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/super.js": 44 }],
    198: [function(require, module, exports) { arguments[4][45][0].apply(exports, arguments) }, { "./../../errno.js": 187, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/errors.js": 45 }],
    199: [function(require, module, exports) { arguments[4][46][0].apply(exports, arguments) }, { "./../../scheduler.js": 194, "./errors.js": 198, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/connection/manager.js": 46 }],
    200: [function(require, module, exports) { arguments[4][47][0].apply(exports, arguments) }, { "./../errno.js": 187, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/errors.js": 47 }],
    201: [function(require, module, exports) { arguments[4][48][0].apply(exports, arguments) }, { "./../event.js": 188, "./../logging.js": 193, "./../scheduler.js": 194, "./../super.js": 197, "./errors.js": 200, "./status.js": 204, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/fsm.js": 48 }],
    202: [function(require, module, exports) { arguments[4][49][0].apply(exports, arguments) }, { "./../logging.js": 193, "./../util": 207, "./connection/manager.js": 199, "./errors.js": 200, "./sockettransaction.js": 203, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/serialtransaction.js": 49 }],
    203: [function(require, module, exports) { arguments[4][50][0].apply(exports, arguments) }, { "./../logging.js": 193, "./errors.js": 200, "./fsm.js": 201, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/sockettransaction.js": 50 }],
    204: [function(require, module, exports) { arguments[4][51][0].apply(exports, arguments) }, { "./../status.js": 196, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/status.js": 51 }],
    205: [function(require, module, exports) { arguments[4][52][0].apply(exports, arguments) }, { "./../logging.js": 193, "./../scheduler": 194, "./../util.js": 207, "./errors.js": 200, "./fsm.js": 201, "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/transactions/usbtransaction.js": 52 }],
    206: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js").scheduler;

            function mkChecker(expected, check) { return function(obj) { if (!check(obj)) { return { error: "Expected " + expected + " got " + obj } } return { ok: true } } }

            function isSerializable(obj, dontCheckRecursive) { if (obj === null) return true; if (typeof obj === "function") return false; if (typeof obj !== "object") return true; if (obj instanceof Array) return !obj.some(function(x) { return !isSerializable(x) }); if (obj.__proto__ && obj.__proto__.__proto__) return false; if (!dontCheckRecursive) try { JSON.stringify(obj) } catch (c) { return false }
                return !Object.getOwnPropertyNames(obj).some(function(k) { return !isSerializable(obj[k], true) }) }

            function isIframeSerializable(obj) { if (obj instanceof ArrayBuffer) return true; if (isSerializable(obj)) return true; if (typeof obj !== "object") return false; return Object.getOwnPropertyNames(obj).reduce(function(ret, k) { return ret && isIframeSerializable(obj[k]) }, true) } var _callback = mkChecker("function", function(o) { return typeof o === "function" }); var checks = { callback: _callback, "function": _callback, object: mkChecker("object", function(o) { return o instanceof Object }), arraybuffer: mkChecker("arraybuffer", function(o) { return o instanceof ArrayBuffer }), array: mkChecker("array", function(o) { return o instanceof Array }), number: mkChecker("number", function(o) { return typeof o === "number" }), string: mkChecker("string", function(o) { return typeof o === "string" }), bool: mkChecker("string", function(o) { return typeof o === "boolean" }), "boolean": mkChecker("string", function(o) { return typeof o === "boolean" }), json: mkChecker("json", isSerializable), iframe: mkChecker("iframe", isIframeSerializable), any: function() { return { ok: true } } };

            function hasKey(obj, key) { return !Object.getOwnPropertyNames(obj).some(function(k) { return key === k }) }

            function getCheck(checker) { var chk = checks[checker]; if (typeof chk === "function") return chk; if (typeof checker === "function" && checker.prototype) return mkChecker(checker.name || "class", function(obj) { return obj instanceof checker }); if (checker instanceof Array) return function(arr) { return match(arr, checker) }; if (typeof checker === "object") return function(obj) { var ret;
                    Object.getOwnPropertyNames(checker).some(function(k) { if (typeof obj !== "object") { ret = { error: "Expected object, got " + obj }; return true } ret = getCheck(checker[k])(obj[k]); if (ret.error) ret.error = "{" + k + ": " + ret.error + "}"; return !!ret.error }); return ret }; throw Error("Unknown type checker:" + checker) }

            function match(args, checkers, index, cb) { if (args.length === 0 && checkers.length === 0) { return { ok: true } } if (args.length === 0 && checkers.length === 1 && checkers[0] === "varany") return { ok: true }; if (args.length === 0 || checkers.length === 0) { if (checkers[0] === "varany") return { error: "Last args should check with " + checkers.slice(1) + " but couldn't." };
                    cb && cb(args); return { error: "Wrong num of arguments: " + (index + args.length) + " (expected " + (index + checkers.length) + ")" } } var checker = checkers[0],
                    m; if (checker === "varany") { if (checkers.length === 1) return { ok: true };
                    m = match(args, checkers.slice(1), index, cb); if (m.ok) return m; return match(args.slice(1), checkers, index + 1, cb) } m = getCheck(checker)(args[0]); if (!m.ok) { cb && cb(checker, args[0]); return { error: "Argument #" + index + ": " + m.error } } return match(args.slice(1), checkers.slice(1), index + 1, cb) } var PRODUCTION = typeof global.it !== "function" && typeof global.describe !== "function" && typeof global.process === "undefined"; var settings = require("./settings.js").settings;

            function typecheck(args, checkers, callback) { if (PRODUCTION && !settings.get("typecheck")) return; var m = match([].slice.call(args), checkers, 0, callback); if (m.ok) return; throw Error(m.error) }

            function typechecked(fn, argtypes) { return function() { typecheck(arguments, argtypes, console.log.bind(console, "Typechecked:")); return fn.apply(null, arguments) } } module.exports.typechecked = typechecked;
            module.exports.typecheck = typecheck;
            module.exports.isSerializable = isSerializable }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 194, "./settings.js": 195 }],
    207: [function(require, module, exports) {
        (function(global) { var scheduler = require("./scheduler.js");

            function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

            function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

            function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                    hex = hex.length < 2 ? "0" + hex : hex;
                    buf += " " + hex } buf += "]"; return buf }

            function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

            function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

            function shallowCopy(obj) { var ret = {}; if (!obj) return obj; if (typeof obj !== "object") throw Error("expected object, not " + typeof obj);
                Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = obj[k] }); if (obj.__proto__) ret.__proto__ = obj.__proto__; return ret }

            function replacePrototype(obj, cls1, cls2) { if (typeof obj !== "object" || typeof cls1 !== "function" || typeof cls2 !== "function") throw Error(); if (!obj || !obj.__proto__ || !cls1.prototype || !cls2.prototype) return obj; var ret = shallowCopy(obj); if (obj !== cls1.prototype) { ret.__proto__ = replacePrototype(ret.__proto__, cls1, cls2); return ret } return Object.create(cls2.prototype) }

            function forEachWithCallback(arr, cb, endCb) { scheduler.setTimeout(function() { if (arr.length <= 0) { endCb(); return } cb(arr[0], function() { forEachWithCallback(arr.slice(1), cb, endCb) }) }) }

            function repeat(times, fn) { var ret = new Array(times); for (var i = 0; i < times; i++) ret[i] = fn(); return ret }

            function compareVersions(v1, v2, callbacks) {
                function justParse(x) { return Number.parseInt(x) } return compareVersionLists(v1.split(".").map(justParse), v2.split(".").map(justParse), callbacks) }

            function compareVersionLists(v1, v2, cbs) { if (isNaN(v1[0]) || isNaN(v2[0])) return cbs.err(); if (v1[0] < v2[0] || v1.length === 0) return cbs.lt(); if (v1[0] > v2[0] || v2.length === 0) return cbs.gt(); if (v1.length === 0 && v2.length === 0) return cbs.eq(); return compareVersionLists(v1.slice(1), v2.slice(1), cbs) }

            function getUniqueId(name) { global.babelfishUniqueIds = global.babelfishUniqueIds || {};
                global.babelfishUniqueIds[name] = global.babelfishUniqueIds[name] || 1; return global.babelfishUniqueIds[name]++ } module.exports.compareVersions = compareVersions;
            module.exports.repeat = repeat;
            module.exports.forEachWithCallback = forEachWithCallback;
            module.exports.storeAsTwoBytes = storeAsTwoBytes;
            module.exports.storeAsFourBytes = storeAsFourBytes;
            module.exports.hexRep = hexRep;
            module.exports.binToBuf = binToBuf;
            module.exports.bufToBin = bufToBin;
            module.exports.shallowCopy = shallowCopy;
            module.exports.replacePrototype = replacePrototype;
            module.exports.getUniqueId = getUniqueId }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./scheduler.js": 194 }],
    208: [function(require, module, exports) { module.exports = require(55) }, { "/Users/drninjabatman/Projects/Codebendercc/BFSuite/cbcf_backend/node_modules/avrdudejs/node_modules/corelib/lib/wrapper.js": 55 }],
    209: [function(require, module, exports) {
        var util = require("util/");
        var pSlice = Array.prototype.slice;
        var hasOwn = Object.prototype.hasOwnProperty;
        var assert = module.exports = ok;
        assert.AssertionError = function AssertionError(options) { this.name = "AssertionError";
            this.actual = options.actual;
            this.expected = options.expected;
            this.operator = options.operator; if (options.message) { this.message = options.message;
                this.generatedMessage = false } else { this.message = getMessage(this);
                this.generatedMessage = true } var stackStartFunction = options.stackStartFunction || fail; if (Error.captureStackTrace) { Error.captureStackTrace(this, stackStartFunction) } else { var err = new Error; if (err.stack) { var out = err.stack; var fn_name = stackStartFunction.name; var idx = out.indexOf("\n" + fn_name); if (idx >= 0) { var next_line = out.indexOf("\n", idx + 1);
                        out = out.substring(next_line + 1) } this.stack = out } } };
        util.inherits(assert.AssertionError, Error);

        function replacer(key, value) { if (util.isUndefined(value)) { return "" + value } if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) { return value.toString() } if (util.isFunction(value) || util.isRegExp(value)) { return value.toString() } return value }

        function truncate(s, n) { if (util.isString(s)) { return s.length < n ? s : s.slice(0, n) } else { return s } }

        function getMessage(self) { return truncate(JSON.stringify(self.actual, replacer), 128) + " " + self.operator + " " + truncate(JSON.stringify(self.expected, replacer), 128) }

        function fail(actual, expected, message, operator, stackStartFunction) { throw new assert.AssertionError({ message: message, actual: actual, expected: expected, operator: operator, stackStartFunction: stackStartFunction }) } assert.fail = fail;

        function ok(value, message) { if (!value) fail(value, true, message, "==", assert.ok) } assert.ok = ok;
        assert.equal = function equal(actual, expected, message) { if (actual != expected) fail(actual, expected, message, "==", assert.equal) };
        assert.notEqual = function notEqual(actual, expected, message) { if (actual == expected) { fail(actual, expected, message, "!=", assert.notEqual) } };
        assert.deepEqual = function deepEqual(actual, expected, message) { if (!_deepEqual(actual, expected)) { fail(actual, expected, message, "deepEqual", assert.deepEqual) } };

        function _deepEqual(actual, expected) {
            if (actual === expected) { return true } else if (util.isBuffer(actual) && util.isBuffer(expected)) { if (actual.length != expected.length) return false; for (var i = 0; i < actual.length; i++) { if (actual[i] !== expected[i]) return false } return true } else if (util.isDate(actual) && util.isDate(expected)) { return actual.getTime() === expected.getTime() } else if (util.isRegExp(actual) && util.isRegExp(expected)) { return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase } else if (!util.isObject(actual) && !util.isObject(expected)) {
                return actual == expected
            } else { return objEquiv(actual, expected) }
        }

        function isArguments(object) { return Object.prototype.toString.call(object) == "[object Arguments]" }

        function objEquiv(a, b) { if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b)) return false; if (a.prototype !== b.prototype) return false; if (isArguments(a)) { if (!isArguments(b)) { return false } a = pSlice.call(a);
                b = pSlice.call(b); return _deepEqual(a, b) } try { var ka = objectKeys(a),
                    kb = objectKeys(b),
                    key, i } catch (e) { return false } if (ka.length != kb.length) return false;
            ka.sort();
            kb.sort(); for (i = ka.length - 1; i >= 0; i--) { if (ka[i] != kb[i]) return false } for (i = ka.length - 1; i >= 0; i--) { key = ka[i]; if (!_deepEqual(a[key], b[key])) return false } return true } assert.notDeepEqual = function notDeepEqual(actual, expected, message) { if (_deepEqual(actual, expected)) { fail(actual, expected, message, "notDeepEqual", assert.notDeepEqual) } };
        assert.strictEqual = function strictEqual(actual, expected, message) { if (actual !== expected) { fail(actual, expected, message, "===", assert.strictEqual) } };
        assert.notStrictEqual = function notStrictEqual(actual, expected, message) { if (actual === expected) { fail(actual, expected, message, "!==", assert.notStrictEqual) } };

        function expectedException(actual, expected) { if (!actual || !expected) { return false } if (Object.prototype.toString.call(expected) == "[object RegExp]") { return expected.test(actual) } else if (actual instanceof expected) { return true } else if (expected.call({}, actual) === true) { return true } return false }

        function _throws(shouldThrow, block, expected, message) { var actual; if (util.isString(expected)) { message = expected;
                expected = null } try { block() } catch (e) { actual = e } message = (expected && expected.name ? " (" + expected.name + ")." : ".") + (message ? " " + message : "."); if (shouldThrow && !actual) { fail(actual, expected, "Missing expected exception" + message) } if (!shouldThrow && expectedException(actual, expected)) { fail(actual, expected, "Got unwanted exception" + message) } if (shouldThrow && actual && expected && !expectedException(actual, expected) || !shouldThrow && actual) { throw actual } } assert.throws = function(block, error, message) { _throws.apply(this, [true].concat(pSlice.call(arguments))) };
        assert.doesNotThrow = function(block, message) { _throws.apply(this, [false].concat(pSlice.call(arguments))) };
        assert.ifError = function(err) { if (err) { throw err } };
        var objectKeys = Object.keys || function(obj) { var keys = []; for (var key in obj) { if (hasOwn.call(obj, key)) keys.push(key) } return keys }
    }, { "util/": 213 }],
    210: [function(require, module, exports) { if (typeof Object.create === "function") { module.exports = function inherits(ctor, superCtor) { ctor.super_ = superCtor;
                ctor.prototype = Object.create(superCtor.prototype, { constructor: { value: ctor, enumerable: false, writable: true, configurable: true } }) } } else { module.exports = function inherits(ctor, superCtor) { ctor.super_ = superCtor; var TempCtor = function() {};
                TempCtor.prototype = superCtor.prototype;
                ctor.prototype = new TempCtor;
                ctor.prototype.constructor = ctor } } }, {}],
    211: [function(require, module, exports) { var process = module.exports = {};
        process.nextTick = function() { var canSetImmediate = typeof window !== "undefined" && window.setImmediate; var canMutationObserver = typeof window !== "undefined" && window.MutationObserver; var canPost = typeof window !== "undefined" && window.postMessage && window.addEventListener; if (canSetImmediate) { return function(f) { return window.setImmediate(f) } } var queue = []; if (canMutationObserver) { var hiddenDiv = document.createElement("div"); var observer = new MutationObserver(function() { var queueList = queue.slice();
                    queue.length = 0;
                    queueList.forEach(function(fn) { fn() }) });
                observer.observe(hiddenDiv, { attributes: true }); return function nextTick(fn) { if (!queue.length) { hiddenDiv.setAttribute("yes", "no") } queue.push(fn) } } if (canPost) { window.addEventListener("message", function(ev) { var source = ev.source; if ((source === window || source === null) && ev.data === "process-tick") { ev.stopPropagation(); if (queue.length > 0) { var fn = queue.shift();
                            fn() } } }, true); return function nextTick(fn) { queue.push(fn);
                    window.postMessage("process-tick", "*") } } return function nextTick(fn) { setTimeout(fn, 0) } }();
        process.title = "browser";
        process.browser = true;
        process.env = {};
        process.argv = [];

        function noop() {} process.on = noop;
        process.addListener = noop;
        process.once = noop;
        process.off = noop;
        process.removeListener = noop;
        process.removeAllListeners = noop;
        process.emit = noop;
        process.binding = function(name) { throw new Error("process.binding is not supported") };
        process.cwd = function() { return "/" };
        process.chdir = function(dir) { throw new Error("process.chdir is not supported") } }, {}],
    212: [function(require, module, exports) { module.exports = function isBuffer(arg) { return arg && typeof arg === "object" && typeof arg.copy === "function" && typeof arg.fill === "function" && typeof arg.readUInt8 === "function" } }, {}],
    213: [function(require, module, exports) {
        (function(process, global) { var formatRegExp = /%[sdj%]/g;
            exports.format = function(f) { if (!isString(f)) { var objects = []; for (var i = 0; i < arguments.length; i++) { objects.push(inspect(arguments[i])) } return objects.join(" ") } var i = 1; var args = arguments; var len = args.length; var str = String(f).replace(formatRegExp, function(x) { if (x === "%%") return "%"; if (i >= len) return x; switch (x) {
                        case "%s":
                            return String(args[i++]);
                        case "%d":
                            return Number(args[i++]);
                        case "%j":
                            try { return JSON.stringify(args[i++]) } catch (_) { return "[Circular]" }
                        default:
                            return x } }); for (var x = args[i]; i < len; x = args[++i]) { if (isNull(x) || !isObject(x)) { str += " " + x } else { str += " " + inspect(x) } } return str };
            exports.deprecate = function(fn, msg) { if (isUndefined(global.process)) { return function() { return exports.deprecate(fn, msg).apply(this, arguments) } } if (process.noDeprecation === true) { return fn } var warned = false;

                function deprecated() { if (!warned) { if (process.throwDeprecation) { throw new Error(msg) } else if (process.traceDeprecation) { console.trace(msg) } else { console.error(msg) } warned = true } return fn.apply(this, arguments) } return deprecated }; var debugs = {}; var debugEnviron;
            exports.debuglog = function(set) { if (isUndefined(debugEnviron)) debugEnviron = process.env.NODE_DEBUG || "";
                set = set.toUpperCase(); if (!debugs[set]) { if (new RegExp("\\b" + set + "\\b", "i").test(debugEnviron)) { var pid = process.pid;
                        debugs[set] = function() { var msg = exports.format.apply(exports, arguments);
                            console.error("%s %d: %s", set, pid, msg) } } else { debugs[set] = function() {} } } return debugs[set] };

            function inspect(obj, opts) { var ctx = { seen: [], stylize: stylizeNoColor }; if (arguments.length >= 3) ctx.depth = arguments[2]; if (arguments.length >= 4) ctx.colors = arguments[3]; if (isBoolean(opts)) { ctx.showHidden = opts } else if (opts) { exports._extend(ctx, opts) } if (isUndefined(ctx.showHidden)) ctx.showHidden = false; if (isUndefined(ctx.depth)) ctx.depth = 2; if (isUndefined(ctx.colors)) ctx.colors = false; if (isUndefined(ctx.customInspect)) ctx.customInspect = true; if (ctx.colors) ctx.stylize = stylizeWithColor; return formatValue(ctx, obj, ctx.depth) } exports.inspect = inspect;
            inspect.colors = { bold: [1, 22], italic: [3, 23], underline: [4, 24], inverse: [7, 27], white: [37, 39], grey: [90, 39], black: [30, 39], blue: [34, 39], cyan: [36, 39], green: [32, 39], magenta: [35, 39], red: [31, 39], yellow: [33, 39] };
            inspect.styles = { special: "cyan", number: "yellow", "boolean": "yellow", undefined: "grey", "null": "bold", string: "green", date: "magenta", regexp: "red" };

            function stylizeWithColor(str, styleType) { var style = inspect.styles[styleType]; if (style) { return "[" + inspect.colors[style][0] + "m" + str + "[" + inspect.colors[style][1] + "m" } else { return str } }

            function stylizeNoColor(str, styleType) { return str }

            function arrayToHash(array) { var hash = {};
                array.forEach(function(val, idx) { hash[val] = true }); return hash }

            function formatValue(ctx, value, recurseTimes) { if (ctx.customInspect && value && isFunction(value.inspect) && value.inspect !== exports.inspect && !(value.constructor && value.constructor.prototype === value)) { var ret = value.inspect(recurseTimes, ctx); if (!isString(ret)) { ret = formatValue(ctx, ret, recurseTimes) } return ret } var primitive = formatPrimitive(ctx, value); if (primitive) { return primitive } var keys = Object.keys(value); var visibleKeys = arrayToHash(keys); if (ctx.showHidden) { keys = Object.getOwnPropertyNames(value) } if (isError(value) && (keys.indexOf("message") >= 0 || keys.indexOf("description") >= 0)) { return formatError(value) } if (keys.length === 0) { if (isFunction(value)) { var name = value.name ? ": " + value.name : ""; return ctx.stylize("[Function" + name + "]", "special") } if (isRegExp(value)) { return ctx.stylize(RegExp.prototype.toString.call(value), "regexp") } if (isDate(value)) { return ctx.stylize(Date.prototype.toString.call(value), "date") } if (isError(value)) { return formatError(value) } } var base = "",
                    array = false,
                    braces = ["{", "}"]; if (isArray(value)) { array = true;
                    braces = ["[", "]"] } if (isFunction(value)) { var n = value.name ? ": " + value.name : "";
                    base = " [Function" + n + "]" } if (isRegExp(value)) { base = " " + RegExp.prototype.toString.call(value) } if (isDate(value)) { base = " " + Date.prototype.toUTCString.call(value) } if (isError(value)) { base = " " + formatError(value) } if (keys.length === 0 && (!array || value.length == 0)) { return braces[0] + base + braces[1] } if (recurseTimes < 0) { if (isRegExp(value)) { return ctx.stylize(RegExp.prototype.toString.call(value), "regexp") } else { return ctx.stylize("[Object]", "special") } } ctx.seen.push(value); var output; if (array) { output = formatArray(ctx, value, recurseTimes, visibleKeys, keys) } else { output = keys.map(function(key) { return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) }) } ctx.seen.pop(); return reduceToSingleString(output, base, braces) }

            function formatPrimitive(ctx, value) { if (isUndefined(value)) return ctx.stylize("undefined", "undefined"); if (isString(value)) { var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'"; return ctx.stylize(simple, "string") } if (isNumber(value)) return ctx.stylize("" + value, "number"); if (isBoolean(value)) return ctx.stylize("" + value, "boolean"); if (isNull(value)) return ctx.stylize("null", "null") }

            function formatError(value) { return "[" + Error.prototype.toString.call(value) + "]" }

            function formatArray(ctx, value, recurseTimes, visibleKeys, keys) { var output = []; for (var i = 0, l = value.length; i < l; ++i) { if (hasOwnProperty(value, String(i))) { output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true)) } else { output.push("") } } keys.forEach(function(key) { if (!key.match(/^\d+$/)) { output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true)) } }); return output }

            function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) { var name, str, desc;
                desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] }; if (desc.get) { if (desc.set) { str = ctx.stylize("[Getter/Setter]", "special") } else { str = ctx.stylize("[Getter]", "special") } } else { if (desc.set) { str = ctx.stylize("[Setter]", "special") } } if (!hasOwnProperty(visibleKeys, key)) { name = "[" + key + "]" } if (!str) { if (ctx.seen.indexOf(desc.value) < 0) { if (isNull(recurseTimes)) { str = formatValue(ctx, desc.value, null) } else { str = formatValue(ctx, desc.value, recurseTimes - 1) } if (str.indexOf("\n") > -1) { if (array) { str = str.split("\n").map(function(line) { return "  " + line }).join("\n").substr(2) } else { str = "\n" + str.split("\n").map(function(line) { return "   " + line }).join("\n") } } } else { str = ctx.stylize("[Circular]", "special") } } if (isUndefined(name)) { if (array && key.match(/^\d+$/)) { return str } name = JSON.stringify("" + key); if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) { name = name.substr(1, name.length - 2);
                        name = ctx.stylize(name, "name") } else { name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                        name = ctx.stylize(name, "string") } } return name + ": " + str }

            function reduceToSingleString(output, base, braces) { var numLinesEst = 0; var length = output.reduce(function(prev, cur) { numLinesEst++; if (cur.indexOf("\n") >= 0) numLinesEst++; return prev + cur.replace(/\u001b\[\d\d?m/g, "").length + 1 }, 0); if (length > 60) { return braces[0] + (base === "" ? "" : base + "\n ") + " " + output.join(",\n  ") + " " + braces[1] } return braces[0] + base + " " + output.join(", ") + " " + braces[1] }

            function isArray(ar) { return Array.isArray(ar) } exports.isArray = isArray;

            function isBoolean(arg) { return typeof arg === "boolean" } exports.isBoolean = isBoolean;

            function isNull(arg) { return arg === null } exports.isNull = isNull;

            function isNullOrUndefined(arg) { return arg == null } exports.isNullOrUndefined = isNullOrUndefined;

            function isNumber(arg) { return typeof arg === "number" } exports.isNumber = isNumber;

            function isString(arg) { return typeof arg === "string" } exports.isString = isString;

            function isSymbol(arg) { return typeof arg === "symbol" } exports.isSymbol = isSymbol;

            function isUndefined(arg) { return arg === void 0 } exports.isUndefined = isUndefined;

            function isRegExp(re) { return isObject(re) && objectToString(re) === "[object RegExp]" } exports.isRegExp = isRegExp;

            function isObject(arg) { return typeof arg === "object" && arg !== null } exports.isObject = isObject;

            function isDate(d) { return isObject(d) && objectToString(d) === "[object Date]" } exports.isDate = isDate;

            function isError(e) { return isObject(e) && (objectToString(e) === "[object Error]" || e instanceof Error) } exports.isError = isError;

            function isFunction(arg) { return typeof arg === "function" } exports.isFunction = isFunction;

            function isPrimitive(arg) { return arg === null || typeof arg === "boolean" || typeof arg === "number" || typeof arg === "string" || typeof arg === "symbol" || typeof arg === "undefined" } exports.isPrimitive = isPrimitive;
            exports.isBuffer = require("./support/isBuffer");

            function objectToString(o) { return Object.prototype.toString.call(o) }

            function pad(n) { return n < 10 ? "0" + n.toString(10) : n.toString(10) } var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            function timestamp() { var d = new Date; var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":"); return [d.getDate(), months[d.getMonth()], time].join(" ") } exports.log = function() { console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments)) };
            exports.inherits = require("inherits");
            exports._extend = function(origin, add) { if (!add || !isObject(add)) return origin; var keys = Object.keys(add); var i = keys.length; while (i--) { origin[keys[i]] = add[keys[i]] } return origin };

            function hasOwnProperty(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop) } }).call(this, require("_process"), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./support/isBuffer": 212, _process: 211, inherits: 210 }]
}, {}, [1]);