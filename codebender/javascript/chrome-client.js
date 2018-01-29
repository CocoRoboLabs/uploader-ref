// Commit: 13186102bdcfe660aeb58661fbfd16d5cc66e861
//version: 1.2.5
// Build time: Fri Feb 26 13:40:30 EET 2016
(function e(t, n, r) {
    function s(o, u) { if (!n[o]) { if (!t[o]) { var a = typeof require == "function" && require; if (!u && a) return a(o, !0); if (i) return i(o, !0); var f = new Error("Cannot find module '" + o + "'"); throw f.code = "MODULE_NOT_FOUND", f } var l = n[o] = { exports: {} };
            t[o][0].call(l.exports, function(e) { var n = t[o][1][e]; return s(n ? n : e) }, l, l.exports, e, t, n, r) } return n[o].exports } var i = typeof require == "function" && require; for (var o = 0; o < r.length; o++) s(r[o]); return s })({
    1: [function(require, module, exports) {
        function isOldstyleGetManifest(message) { return message && message.method == "getManifestAsync" && message.object == "runtime" && message.callbackId }

        function getState(apiRoot, state, cb) { var formattedState = apiRoot.runtime.getManifest();
            formattedState.connections = state.connections.map(function(c) { return c && { bufferLength: c.bufferLength, conf: c.portConf, id: c.id, closed: c.closed } }), formattedState.keepalives = state.keepalives.map(function(k) { return k && { clientId: k.clientId, conf: k.portConf, closed: k.closed } }), cb(formattedState) }

        function setupAdHoc(state) { var apiRoot = state.apiRoot; if (apiRoot.runtime) { if (!apiRoot.babelfish) apiRoot.babelfish = {};
                apiRoot.babelfish.getState = apiRoot.runtime.getManifestAsync = getState.bind(null, apiRoot, state);

                function provideState(msg, sendResp) { if (msg && (msg.method == "getState" || isOldstyleGetManifest(msg))) { apiRoot.babelfish.getState(sendResp); return false } return true } state.bootstrapHost.commands.push(provideState) } if (apiRoot.serial) { apiRoot.serial.onReceiveError.forceDispatch = function(info) { state.connections.forEach(function(c) { if (c.apiEvent.methodName == "serial.onReceiveError.addListener") { c.apiEvent.methodRequest.realCallback().call(null, info) } }) } } } module.exports.setupAdHoc = setupAdHoc }, {}],
    2: [function(require, module, exports) { var util = require("./util"),
            AckResponse = require("./responses.js").AckResponse,
            ArgsResponse = require("./responses.js").ArgsResponse,
            MethodRequest = require("./requests.js").MethodRequest,
            Arguments = require("./arguments.js").Arguments,
            log = new(require("./log.js").Log)("apieventemitter"); var closingResponses = { callingArguments: function(closingRequest) { if (!closingRequest) { new MethodRequest(null, this.reverser.path, this.args).call(null, this.hostApi); return null } if (this.reverser.path == closingRequest.method && JSON.stringify(closingRequest.args.forSending()) == JSON.stringify(this.args.forSending())) { closingRequest.call(null, this.hostApi);
                    this.destroy(true); return new AckResponse } return null }, firstResponse: function(closingRequest) { var fr = this.firstResponseMsg; if (!fr || fr.responseType != "ArgsResponse") { return null } var closingArg = fr.args[0]; if (this.reverser.firstArgPath) { closingArg = closingArg[this.reverser.firstArgPath] } if (!closingRequest) { var mr = new MethodRequest(null, this.reverser.path, new Arguments([closingArg, function() {}]));
                    mr.call(null, this.hostApi); return null } if (JSON.stringify(closingArg) == JSON.stringify(closingRequest.args.forSending()[0]) && closingRequest.method == this.reverser.path) { this.destroy(true); return ArgsResponse.async(closingRequest, this.hostApi) } return null }, serial: function(closingRequest) { var oldfap = this.reverser.firstArgPath = "connectionId"; return closingResponses.firstResponse(closingRequest);
                this.reverser.firstArgPath = oldfap }, "default": function(closingRequest) { return closingResponses.serial(closingRequest) || closingResponses.firstResponse(closingRequest) || closingResponses.callingArguments(closingRequest) } };

        function ApiEventEmitter(methodRequest, reverser, hostApi, closeCb) { var self = this;
            this.methodName = methodRequest.method;
            this.reverser = reverser;
            this.hostApi = hostApi;
            this.calledClosingRequests = [];
            this.args = methodRequest.args;
            this.args.setLens(function(cb) { return function() { var args = [].slice.call(arguments);
                    self.firstResponseMsg = self.firstResponseMsg || args[0];
                    cb.apply(null, args) } });
            this.methodRequest = methodRequest;
            log.log("Starting [rev type: " + self.reverser.type + "]: ", methodRequest.forSending());
            this.maybeRunCloser = function(closingRequest) { if (self.closed) { console.error("Trying to close a closed event emitter"); return null } var closingResponseFactory = closingResponses[self.reverser.type] || closingResponses.default,
                    ret = closingResponseFactory.call(self, closingRequest); if (ret) { log.log("Closing[" + self.reverser.type + "]:", ret, "with", closingRequest) } return ret };
            this.closeCb = closeCb } ApiEventEmitter.prototype = { fire: function() { log.log("Connected:", this.methodRequest.forSending());
                this.methodRequest.call(null, this.hostApi) }, destroy: function(shallow) { var self = this; if (this.closed) return; if (!shallow) this.maybeRunCloser();
                this.closed = true;
                this.closeCb();
                log.log("Disconected:", this.methodRequest.forSending()) }, missingReverseCb: function() { throw new Error("No such method as " + this.methodName) }, missingMethodCb: function() { throw new Error("No reverse method for " + this.methodName) } };
        module.exports.ApiEventEmitter = ApiEventEmitter }, { "./arguments.js": 3, "./log.js": 18, "./requests.js": 22, "./responses.js": 26, "./util": 34 }],
    3: [function(require, module, exports) { module.exports.CallbackArgument = require("./arguments/callback.js");
        module.exports.DataArgument = require("./arguments/data.js");
        module.exports.DatabufferArgument = require("./arguments/databuffer.js");
        module.exports.BasicArgument = require("./arguments/basic.js");
        module.exports.Arguments = require("./arguments/container.js");
        module.exports.argumentFactory = require("./arguments/factory.js").argumentFactory;
        module.exports.argumentClasses = require("./arguments/factory.js").argumentClasses }, { "./arguments/basic.js": 4, "./arguments/callback.js": 5, "./arguments/container.js": 6, "./arguments/data.js": 7, "./arguments/databuffer.js": 8, "./arguments/factory.js": 9 }],
    4: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses;

        function BasicArgument(arg) { this.value = arg } BasicArgument.canWrap = function(arg) { return true };
        BasicArgument.prototype = { forCalling: function() { return this.value }, forSending: function() { return this.value } };
        argumentClasses.push(BasicArgument);
        module.exports = BasicArgument }, { "./factory.js": 9 }],
    5: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses;

        function CallbackArgument(arg, replaceCb) { if (!CallbackArgument.canWrap(arg)) { throw Error("Cant wrap argument " + arg + "as a function") } this.replaceCb = replaceCb || null;
            this.id = arg.id || this.replaceCb && this.replaceCb.id || Date.now() + Math.random();
            this.callback = arg instanceof Function ? arg : replaceCb; if (this.callback) { this.callback.id = this.id } this.placeholder = { id: this.id, isCallback: true } } CallbackArgument.canWrap = function(arg) { return arg && (arg instanceof Function || arg.isCallback) };
        CallbackArgument.prototype = { forCalling: function() { return this.lens ? this.lens(this.callback) : this.callback }, forSending: function() { return this.placeholder }, setLens: function(lens) { this.lens = lens } };
        argumentClasses.push(CallbackArgument);
        module.exports = CallbackArgument }, { "./factory.js": 9 }],
    6: [function(require, module, exports) { var CallbackArgument = require("./callback.js"),
            argumentFactory = require("./factory.js").argumentFactory;

        function Arguments(arguments, replaceCb) { this.arguments = arguments.map(function(a) { return argumentFactory(a, replaceCb) }) } Arguments.prototype = { forCalling: function() { return this.arguments.map(function(a) { return a.forCalling() }) }, forSending: function() { return this.arguments.map(function(a) { return a.forSending() }) }, getCallback: function() { var cbArg = this.arguments.filter(function(a) { return a instanceof CallbackArgument })[0],
                    ret = cbArg ? cbArg.forCalling() : this.replaceCb; return ret }, setLens: function(lens) { if (this.replaceCb) { this.replaceCb = lens(this.replaceCb) } this.arguments.forEach(function(a) { if (a.setLens) a.setLens(lens) }) } };
        module.exports = Arguments }, { "./callback.js": 5, "./factory.js": 9 }],
    7: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses,
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
        module.exports = DataArgument }, { "./databuffer.js": 8, "./factory.js": 9 }],
    8: [function(require, module, exports) { var argumentClasses = require("./factory.js").argumentClasses,
            util = require("../util.js");

        function DatabufferArgument(arg) { if (!DatabufferArgument.canWrap(arg)) { throw Error("Cant wrap argument " + arg + " as a databuffer") } this.buffer = arg instanceof ArrayBuffer ? arg : null;
            this.obj = arg.isArrayBuffer ? arg : null } DatabufferArgument.canWrap = function(arg) { return arg && (arg instanceof ArrayBuffer || arg.isArrayBuffer) };
        DatabufferArgument.prototype = { forCalling: function() { return this.buffer || util.arrToBuf(this.obj.data) }, forSending: function() { return this.obj || { data: util.bufToArr(this.buffer), isArrayBuffer: true } }, concat: function(msg) { if (!msg.isArrayBuffer) return this; var ret = this.forSending();
                ret.data = ret.data.concat(msg.data); return new DatabufferArgument(ret) } };
        argumentClasses.push(DatabufferArgument);
        module.exports = DatabufferArgument }, { "../util.js": 34, "./factory.js": 9 }],
    9: [function(require, module, exports) { var argumentClasses = [];

        function argumentFactory(arg, replacingCb) { var classes = argumentClasses.filter(function(ac) { return ac.canWrap(arg) }); return new classes[0](arg, replacingCb) } module.exports.argumentFactory = argumentFactory;
        module.exports.argumentClasses = argumentClasses }, {}],
    10: [function(require, module, exports) {
        (function(global) { var messageApi = require("./messaging.js");

            function BootStrapClient() {} BootStrapClient.prototype = { getState: function(hostId, cb, cfg) { messageApi.sendMessage(hostId, { legacy: true, method: "getManifestAsync", object: "runtime", args: { args: [{ type: "function" }] }, callbackId: -1 }, function clientStateResponse(resp) { if (!resp || resp.version) { cb(resp); return } var val = null; try { val = resp.args.args[0].val } catch (e) {} cb(val) }) }, getHostId: function(cb, cfg) { cfg = cfg || {}; var appIds = cfg.ids || global.appIds || ["jommgdhcpkjoikkjcnpafeofedlfphfb", "magknjdfniglanojbpadmpjlglepnlko", global.APP_ID],
                        car = appIds[0],
                        cdr = appIds.slice(1),
                        self = this; if (!car) { cb(); return } this.getState(car, function checkManifest(arg) { if (!arg) { cfg.ids = cdr;
                            self.getHostId(cb, cfg); return } cb(car, arg) }, cfg) }, getManifest: function(cb, cfg) { this.getHostId(function(id, state) { if (state) state.hostId = id;
                        cb(state) }, cfg) } };
            module.exports = new BootStrapClient }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./messaging.js": 19 }],
    11: [function(require, module, exports) { var messageApi = require("./messaging.js");

        function BootstrapHost() { this.commands = [];
            this.listener = null;
            this.listen() } BootstrapHost.prototype = { listen: function() { var self = this;
                this.listener = function(req, sender, sendResp) { return self.commands.length == 0 || !self.commands.some(function(c) { return !c(req, sendResp) }) };
                messageApi.onMessageExternal.addListener(this.listener) }, cleanup: function() { messageApi.onMessageExternal.removeListener(this.listener) } };
        module.exports.BootstrapHost = BootstrapHost }, { "./messaging.js": 19 }],
    12: [function(require, module, exports) {
        (function(global) { module.exports.setupClient = require("./handlers.js").setupClient;
            global.setupClient = module.exports.setupClient;
            module.exports.extentionAvailable = true;
            global.extentionAvailable = true;
            console.log("Client can run setup...") }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./handlers.js": 16 }],
    13: [function(require, module, exports) { var Arguments = require("./arguments.js").Arguments,
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
        module.exports.ClientConnection = ClientConnection }, { "./arguments.js": 3, "./log.js": 18, "./messaging.js": 19, "./requests.js": 22, "./responses.js": 26, "./setimmediate.js": 33 }],
    14: [function(require, module, exports) {
        (function(global) { var bsc = require("./bootstrapclient.js"),
                s = require("./server.js");
            global.defaultConfig = { clientId: -1, reverseMethods: { "serial.onReceive.addListener": { path: "serial.onReceive.removeListener", type: "callingArguments" }, "serial.onReceiveError.addListener": { path: "serial.onReceiveError.removeListener", type: "callingArguments" }, "serial.connect": { path: "serial.disconnect", type: "firstResponse", firstArgPath: "connectionId" }, "usb.openDevice": { path: "usb.closeDevice", type: "firstResponse", firstArgPath: null } }, methods: ["babelfish.getState", "runtime.getManifestAsync", "serial.onReceiveError.forceDispatch", "runtime.getPlatformInfo", "serial.getDevices", "serial.connect", "serial.update", "serial.disconnect", "serial.setPaused", "serial.getInfo", "serial.getConnections", "serial.send", "serial.flush", "serial.getControlSignals", "serial.setControlSignals", "serial.onReceive.addListener", "serial.onReceive.removeListener", "serial.onReceiveError.addListener", "serial.onReceiveError.removeListener", "usb.getDevices", "usb.getUserSelectedDevices", "usb.requestAccess", "usb.openDevice", "usb.findDevices", "usb.closeDevice", "usb.setConfiguration", "usb.getConfiguration", "usb.getConfigurations", "usb.listInterfaces", "usb.claimInterface", "usb.releaseInterface", "usb.setInterfaceAlternateSetting", "usb.controlTransfer", "usb.bulkTransfer", "usb.interruptTransfer", "usb.isochronousTransfer", "usb.resetDevice", "usb.onDeviceAdded.addListener", "usb.onDeviceAdded.removeListener", "usb.onDeviceRemoved.addListener", "usb.onDeviceRemoved.removeListener"], noCallbackMethods: ["usb.onDeviceRemoved.removeListener", "usb.onDeviceAdded.removeListener", "serial.onReceiveError.removeListener", "serial.onReceive.removeListener", "serial.onReceive.forceDispatch"] };

            function getConfig(connectCb, disconnectCb, errorCb, timeout) { var newConfig = JSON.parse(JSON.stringify(global.defaultConfig));

                function doGetConfig(state, config) { config.version = state.version; if (parseInt(state.version.split(".").shift()) < 1) { errorCb({ badVersion: config.version }); return } s.getKeepAliveConnection(state.hostId, function(token) { config.token = token;
                        config.chromeApi = chrome;
                        config.hostId = state.hostId;
                        config.clientId = config.token.clientId;
                        connectCb(config) }, function(error) { if (disconnectCb && !error) { disconnectCb(); return } if (errorCb && error) { errorCb(error); return } }, timeout) } bsc.getManifest(function(m) { if (!m) { disconnectCb(); return } doGetConfig(m, newConfig) }) } module.exports.getConfig = getConfig }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./bootstrapclient.js": 10, "./server.js": 32 }],
    15: [function(require, module, exports) {
        function withError(apiRoot, error, cb) { var unchecked = true;
            apiRoot.runtime = apiRoot.runtime || {};
            Object.defineProperty(apiRoot.runtime, "lastError", { configurable: true, enumerable: true, get: function() { unchecked = false; return error } });
            cb();
            Object.defineProperty(apiRoot.runtime, "lastError", { configurable: true, enumerable: true, get: function() { unchecked = false; return undefined } }); if (unchecked && error) { console.error("lastError not checked: " + error.message || error) } } module.exports.withError = withError }, {}],
    16: [function(require, module, exports) { var MethodRequest = require("./requests.js").MethodRequest,
            ClientConnection = require("./clientconnection.js").ClientConnection,
            getKeepAliveConnection = require("./server.js").getKeepAliveConnection,
            messageApi = require("./server.js").messageApi,
            errhandle = require("./error.js"),
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
                obj[method] = handlerFactory(path, apiRoot.local, errhandle.withError.bind(null, apiRoot)) }) } module.exports.getConfig = getConfig;
        module.exports.handlerFactory = handlerFactory;
        module.exports.setupClient = setupClient;
        module.exports.uncaughtError = uncaughtError }, { "./clientconnection.js": 13, "./config.js": 14, "./error.js": 15, "./log.js": 18, "./requests.js": 22, "./server.js": 32, "./setimmediate.js": 33 }],
    17: [function(require, module, exports) { var Arguments = require("./arguments.js").Arguments,
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
        module.exports.HostConnection = HostConnection }, { "./apieventemitter.js": 2, "./arguments.js": 3, "./log.js": 18, "./requests.js": 22, "./responses.js": 26, "./setimmediate.js": 33, "./util.js": 34 }],
    18: [function(require, module, exports) {
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
    19: [function(require, module, exports) {
        (function(global) { var DummyRuntime = require("./messaging/dummy.js").DummyRuntime,
                ChromeMessaging = require("./messaging/chrome.js").ChromeMessaging; var interfaces = { chrome: ChromeMessaging, test: DummyRuntime }; if (!global.chrome || !global.chrome.runtime || !global.chrome.runtime.sendMessage) { global.MESSAGING_METHOD = "test" } module.exports = new interfaces[global.MESSAGING_METHOD || "chrome"] }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./messaging/chrome.js": 20, "./messaging/dummy.js": 21 }],
    20: [function(require, module, exports) {
        function ChromeMessaging() { this.version = chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "1";
            this.onConnectExternal = chrome.runtime.onConnectExternal;
            this.onMessageExternal = chrome.runtime.onMessageExternal;
            this.sendMessage = chrome.runtime.sendMessage.bind(chrome.runtime);
            this.connect = chrome.runtime.connect.bind(chrome.runtime) } module.exports.ChromeMessaging = ChromeMessaging }, {}],
    21: [function(require, module, exports) {
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
                        listeners.some(function(l, i) { return !l.apply(null, args) }) }) } };

            function Runtime() { dbg("Creating runtime...");
                this.id = global.APP_ID;
                this.onConnectExternal = new Event(false, "onConnectExternal");
                this.onMessageExternal = new Event(true, "onMessageExternal");
                this.ports = [];
                this.version = "1.0" } Runtime.prototype = { sendMessage: function(hostId, message, cb) { var sendResp = cb,
                        sender = null;
                    validateMessage(message);
                    assert(message);
                    assert(hostId); if (hostId != this.id || global.blockMessaging) { maybeAsync(cb); return } this.onMessageExternal.trigger(message, sender, function(msg) { dbg("Response:", JSON.stringify(msg));
                        cb(msg) }) }, connect: function(hostId, connectInfo) { var clientPort = new Port(connectInfo.name, this),
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
            module.exports.Port = Port }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { assert: 88 }],
    22: [function(require, module, exports) { module.exports.BurstRequest = require("./requests/burst.js").BurstRequest;
        module.exports.GenericRequest = require("./requests/generic.js").GenericRequest;
        module.exports.MethodRequest = require("./requests/method.js").MethodRequest }, { "./requests/burst.js": 23, "./requests/generic.js": 24, "./requests/method.js": 25 }],
    23: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguements,
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
        module.exports.BurstRequest = BurstRequest }, { "./../arguments.js": 3, "./../log.js": 18, "./../responses.js": 26, "./generic.js": 24 }],
    24: [function(require, module, exports) { var genericRespHandler = require("./../responses.js").genericRespHandler,
            messageApi = require("./../messaging.js"),
            log = new(require("./../log.js").Log)("genericrequest");

        function GenericRequest() {} GenericRequest.prototype = { forSending: function() { throw Error("forSending not implemented.") }, send: function(cb, errorCb) { var self = this,
                    msg = this.forSending(),
                    hostId = this.hostId;
                messageApi.sendMessage(hostId, msg, function(resp) { genericRespHandler(resp, self, cb || function(err) { if (err) { throw err } }) }) } };
        module.exports.GenericRequest = GenericRequest }, { "./../log.js": 18, "./../messaging.js": 19, "./../responses.js": 26 }],
    25: [function(require, module, exports) {
        var Arguments = require("./../arguments.js").Arguments,
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
                response = connections.map(function(c) { return c.tryClosing(req) }).reduce(function(a, b) { return a || b }, false); if (msg.isReverser && !response) { console.warn("You told me " + JSON.stringify(msg) + " was a reverser but i found nothing to reverse."); if (msg.noCallback) { req.call(null, hostApi); return new ErrResponse("Tried to clean with " + msg.method + " but failed.", "warning") } return ArgsResponse.async(req, hostApi) } return response }
        var messagesReceived = 0;
        MethodRequest.maybeHandle = function(msg, connections, hostApi, sendRespRaw) { var _sendRespRaw = function(sendMsg) { if (++messagesReceived % 1e3 == 0) { log.log("Sending 1000 messages") } if (sendMsg.responseType == "ErrResponse") { console.error(msg, "->", sendMsg) } sendRespRaw(sendMsg) }; if (msg.requestType != "MethodRequest") { return false } var resp = handleReverser(msg, connections, hostApi); if (resp) { resp.send(_sendRespRaw); return true } sendRespRaw = sendRespRaw || function() {}; var sendArgsAsResponse = function(varArgs) { var argsArr = [].slice.call(arguments),
                        cbArgs = new Arguments(argsArr),
                        argsResp = new ArgsResponse(cbArgs); if (chrome && chrome.runtime && chrome.runtime.lastError && argsArr.length == 0) { new ErrResponse(chrome.runtime.lastError, "chrome.runtime.lastError").send(_sendRespRaw); return true } argsResp.send(_sendRespRaw) },
                methodArgs = new Arguments(msg.args, sendArgsAsResponse),
                methodCb = util.path2callable(hostApi, msg.method); if (!methodCb) { resp = new ErrResponse("Method " + msg.method + " not found.");
                resp.send(_sendRespRaw); return true } try { methodCb.apply(null, methodArgs.forCalling()); return true } catch (e) { resp = new ErrResponse({ message: "Error on calling " + msg.method + ":" + e.message, stack: e.stack }, "chrome.runtime.lastError");
                resp.send(_sendRespRaw); return true } if (msg.noCallback) {
                (new AckResponse).send(_sendRespRaw); return true } };
        MethodRequest.prototype.forSending = function() { var ret = { requestType: "MethodRequest", method: this.method, args: this.args.forSending(), noCallback: this.noCallback, isReverser: this.isReverser }; return ret };
        MethodRequest.prototype.call = function(sendResp, hostApi) { MethodRequest.maybeHandle(this.forSending(), null, hostApi, sendResp || this.getCallback()) };
        MethodRequest.prototype.getCallback = function() { return this.args.getCallback() };
        MethodRequest.prototype.realCallback = function() { var self = this,
                callback = self.args.getCallback(); return function() { var args = new Arguments([].slice.call(arguments)),
                    resp = new ArgsResponse(args);
                callback.call(null, resp.forSending()) } };
        module.exports.MethodRequest = MethodRequest
    }, { "./../arguments.js": 3, "./../log.js": 18, "./../responses.js": 26, "./../util": 34, "./generic.js": 24 }],
    26: [function(require, module, exports) { module.exports.ErrResponse = require("./responses/error.js");
        module.exports.BurstResponse = require("./responses/burst.js");
        module.exports.ArgsResponse = require("./responses/arguments.js");
        module.exports.AckResponse = require("./responses/ack.js");
        module.exports.genericRespHandler = require("./responses/generic.js").genericRespHandler }, { "./responses/ack.js": 27, "./responses/arguments.js": 28, "./responses/burst.js": 29, "./responses/error.js": 30, "./responses/generic.js": 31 }],
    27: [function(require, module, exports) { var GenericResponse = require("./generic.js").GenericResponse;
        require("./../setimmediate.js");

        function AckResponse() {} AckResponse.maybeHandle = function(msg, request, doneCb) { if (msg.responseType != "AckResponse") return false;
            setImmediate(doneCb); return true };
        AckResponse.prototype = Object.create(GenericResponse.prototype);
        AckResponse.prototype.forSending = function() { return { responseType: "AckResponse" } };
        module.exports = AckResponse }, { "./../setimmediate.js": 33, "./generic.js": 31 }],
    28: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguments,
            GenericResponse = require("./generic.js").GenericResponse;
        require("./../setimmediate.js");

        function ArgsResponse(args) { this.cbArgs = args } ArgsResponse.async = function(mr, hostApi) { var resp = new ArgsResponse;
            resp.mr = mr;
            resp.hostApi = hostApi; return resp };
        ArgsResponse.maybeHandle = function(msg, request, doneCb) { if (msg.responseType != "ArgsResponse") return false; if (!request.getCallback()) { doneCb(new Error("No real callback provided on the client.")); return true } var cbArgs = new Arguments(msg.args),
                callArgs = cbArgs.forCalling(),
                callback = request.getCallback();
            callback.apply(null, callArgs);
            setImmediate(doneCb); return true };
        ArgsResponse.prototype = Object.create(GenericResponse.prototype);
        ArgsResponse.prototype.forSending = function() { return { responseType: "ArgsResponse", args: this.cbArgs.forSending() } };
        ArgsResponse.prototype.send = function(sendCb) { if (this.mr) { this.mr.call(sendCb, this.hostApi); return } sendCb(this.forSending()) };
        module.exports = ArgsResponse }, { "./../arguments.js": 3, "./../setimmediate.js": 33, "./generic.js": 31 }],
    29: [function(require, module, exports) { var Arguments = require("./../arguments.js").Arguments,
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
        module.exports = BurstResponse }, { "./../arguments.js": 3, "./../log.js": 18, "./../setimmediate.js": 33, "./arguments.js": 28, "./generic.js": 31 }],
    30: [function(require, module, exports) { var GenericResponse = require("./generic.js").GenericResponse;

        function ErrResponse(error, type) { this.error = error;
            this.type = type } ErrResponse.maybeHandle = function(msg, request, doneCb) { if (msg && msg.responseType != "ErrResponse") return false; var rawError = msg ? msg.err : "Undefined message, probably host is disconnected."; if (request.trace) { console.warn("Received error:", msg.err);
                console.warn(request.trace) } var withError = function(err, cb) { cb(); if (err) { console.error("Uncaught:", err) } }; if (request.getCallback()) {
                (request.withError || withError)(rawError, request.getCallback());
                doneCb(); return true } doneCb(rawError); return true };
        ErrResponse.prototype = new GenericResponse;
        ErrResponse.prototype.forSending = function() { return { responseType: "ErrResponse", err: this.error, type: this.type } };
        module.exports = ErrResponse }, { "./generic.js": 31 }],
    31: [function(require, module, exports) {
        function GenericResponse() {} GenericResponse.prototype = { send: function(sendCb) { return sendCb(this.forSending()) }, forSending: function() { throw new Error("Not implemented") } };

        function genericRespHandler(msg, request, done) {
            function doneCb(err) { done(err) } var responseTypesArr = [require("./error.js"), require("./burst.js"), require("./arguments.js"), require("./ack.js")]; if (!responseTypesArr.some(function(RT) { return RT.maybeHandle(msg, request, doneCb) })) { done(new Error("Couldn't handle message: " + JSON.stringify(msg))) } } module.exports.GenericResponse = GenericResponse;
        module.exports.genericRespHandler = genericRespHandler }, { "./ack.js": 27, "./arguments.js": 28, "./burst.js": 29, "./error.js": 30 }],
    32: [function(require, module, exports) { var HostConnection = require("./hostconnection.js").HostConnection,
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

            function messageHandle(message, sender, sendResp) { return MethodRequest.maybeHandle(message, state.connections, apiRoot, sendResp) || BurstRequest.maybeHandle(message, state.connections, sendResp) || new ErrResponse("Nothing to do for message." + JSON.stringify(message), false).send(sendResp) }

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
        module.exports.messageApi = messageApi }, { "./adhoc/host.js": 1, "./bootstraphost.js": 11, "./hostconnection.js": 17, "./log.js": 18, "./messaging.js": 19, "./requests.js": 22, "./responses.js": 26, "./setimmediate.js": 33 }],
    33: [function(require, module, exports) {
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
    34: [function(require, module, exports) {
        function errorThrower(name) { return function() { throw new Error("No such method: " + name) } }

        function arrToBuf(hex) { var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer } module.exports.arrToBuf = arrToBuf;

        function bufToArr(bin) { var bufferView = new Uint8Array(bin); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes } module.exports.bufToArr = bufToArr;

        function path2callable(object, name, callable) { var names = name.split("."),
                method = names.pop(),
                obj = names.reduce(function(ob, meth) { return ob[meth] }, object) || object,
                self = this; if (!obj[method]) { console.warn("Tried to resolve bad object path: " + name);
                console.warn("Server:", object); return null } return obj[method].bind(obj) } module.exports.path2callable = path2callable }, {}],
    35: [function(require, module, exports) {
        (function(global) { global.babelfishApi = {} }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    36: [function(require, module, exports) { var setupClient = require("./../chrome-extension/src/client.js").setupClient,
            abstractAvailable = require("./availability.js").abstractAvailable,
            Event = require("./event.js").Event; var SHUTDOWN = 0,
            DISCONNECTED = 1,
            CONNECTED = 2; var asAvailable = function() {
            function connect(timeout) { var self = this;
                this.api = this.api || {};
                setupClient(this.api, function() { self.state = CONNECTED;
                    self.onFound.dispatch() }, function() { self.disconnect(function() { self.onLost.dispatch() }) }, function(err) { self.onError.dispatch(err) }, timeout) }

            function disconnect(done, dispatchEvents) { if (this.state <= DISCONNECTED) { if (done) done(); return } this.state = DISCONNECTED;
                this.api.local.disconnect(done, !dispatchEvents) } return function(options) { abstractAvailable.call(this);
                this.isConnected = function() { return this.api.local && this.api.local.token };
                this.connect = connect;
                this.disconnect = disconnect } }();
        module.exports.asAvailable = asAvailable }, { "./../chrome-extension/src/client.js": 12, "./availability.js": 37, "./event.js": 75 }],
    37: [function(require, module, exports) { var Event = require("./event.js").Event; var SHUTDOWN = 0,
            DISCONNECTED = 1,
            CONNECTED = 2; var abstractAvailable = function() { var initCb = null;

            function init(cb, timeout) { if (cb && !this.onFound.hasListener(cb)) { this.onFound.removeListener(initCb);
                    initCb = cb;
                    this.onFound.addListener(initCb) } if (this.isConnected()) { this.onFound.dispatch(); return } this.connect(timeout || 4e3) }

            function shutdown(done, dispatchEvents) { var self = this;
                this.disconnect(function() { if (self.state <= SHUTDOWN) { if (done) done(); return } self.state = SHUTDOWN;
                    self.onLost.close();
                    self.onFound.close();
                    self.onError.close(); if (done) done() }, dispatchEvents) } return function(options) { this.state = SHUTDOWN;
                this.api = {};
                this.onFound = new Event;
                this.onLost = new Event;
                this.onError = new Event;
                this.closed = true;
                this.init = init;
                this.shutdown = shutdown } }();
        module.exports.abstractAvailable = abstractAvailable }, { "./event.js": 75 }],
    38: [function(require, module, exports) { var parts = require("./parts.min"),
            _conf = null;

        function getMCUConf(mcu) { if (!_conf) { _conf = {};
                Object.getOwnPropertyNames(parts).forEach(function(pn) { _conf[parts[pn].AVRPart.toLowerCase()] = parts[pn] }) } return _conf[mcu] } module.exports.getMCUConf = getMCUConf }, { "./parts.min": 54 }],
    39: [function(require, module, exports) { var Data = require("./data.js").Data,
            errno = require("./errno.js"); var Base64 = { _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", decodeArrayBuffer: function(input) { var bytes = input.length / 4 * 3; var ab = new ArrayBuffer(bytes);
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

        function Parser(base64str, offset, maxSize) { this.base64str = base64str;
            this.maxSize = maxSize;
            this.offset = offset || 0;
            this.lastError = errno.PREMATURE_RETURN.copy({ process: "parser" }) } Parser.prototype = { _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", data: function() { var ret = [].slice.call(Base64.decode(this.base64str)); if (!ret) { this.lastError = errno.BASE64_ERROR; return null } if (this.maxSize && ret.length > this.maxSize) { this.lastError = errno.PROGRAM_TOO_LARGE.copy({ maxSize: this.maxSize, progLength: ret.length }); return null } this.lastError = errno.SUCCESS; return new Data(ret, this.offset) } };
        module.exports.Parser = Parser }, { "./data.js": 41, "./errno.js": 42 }],
    40: [function(require, module, exports) { var arraify = require("./util").arraify,
            scheduler = require("./scheduler.js"),
            logging = require("./logging");

        function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

        function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

        function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                hex = hex.length < 2 ? "0" + hex : hex;
                buf += " " + hex } buf += "]"; return buf }

        function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

        function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

        function BufferReader(config) { var self = this;
            this.log = logging.getLog("Reader");
            Object.keys(config || {}).forEach(function(k) { self[k] = config[k] });
            this.ttl = typeof this.ttl === "number" ? this.ttl : 2e3;
            this.modifyDatabuffer = this.modifyDatabuffer.bind(this); if (this.buffer) { this.register(this.buffer) } } BufferReader.prototype = { register: function(buffer) { var self = this;
                this.buffer = buffer;
                buffer.appendReader(this);
                this.timeout_ = scheduler.setTimeout(function() { self.log.log("Reader timed out", self);
                    buffer.removeReader(self); if (self.timeoutCb) { self.timeoutCb() } else { throw Error("Unhandled async buffer read timeout.") } }, this.ttl) }, destroy: function() { this.log.log("Destroying reader from buffer", this.buffer);
                this.buffer.removeReader(this); if (this.timeout_) scheduler.clearTimeout(this.timeout_) }, modifyDatabuffer: function() { throw Error("Not implemented") } };

        function Buffer() { this.log = logging.getLog("Buffer");
            this.databuffer = [];
            this.readers = [];
            this.maxBufferSize = null } Buffer.prototype = { removeReader: function(reader) { this.log.log("Removing reader:", reader); var len = this.readers.length;
                this.readers = this.readers.filter(function(r) { return r !== reader }) }, appendReader: function(reader) { this.readers.push(reader) }, runAsyncReaders: function(done) { var self = this;
                this.log.log("Running readers:", this.readers, ":", this.databuffer);

                function fulfill(reader) { if (!reader) return true; if (reader.modifyDatabuffer()) { reader.destroy(); return true } return false } this.readers.some(function(r) { return !fulfill(r) }); if (done) done() }, readAsync: function(maxBytesOrConfig, modifyBuffer, ttl, timeoutCb) { var reader; if (typeof maxBytesOrConfig === "number") { reader = new BufferReader({ expectedBytes: maxBytesOrConfig, ttl: ttl, timeoutCb: timeoutCb }) } else { reader = new BufferReader(maxBytesOrConfig) } reader.register(this);
                scheduler.setImmediate(this.runAsyncReaders.bind(this)) }, write: function(readArg, errorCb, doneCb) { var hexData = bufToBin(readArg.data);
                this.log.log("Dev said:", hexRep(hexData));
                this.databuffer = this.databuffer.concat(hexData); if (this.maxBufferSize && this.databuffer.length > this.maxBufferSize) { this.cleanup(function() { errorCb("Receive buffer larger than " + this.maxBufferSize); return }) } this.runAsyncReaders(doneCb) }, drain: function(callback) { var ret = this.databuffer,
                    self = this;
                this.log.log("Draining bytes: ", hexRep(this.databuffer));
                this.readers.slice().forEach(function(r) { self.removeReader(r);
                    scheduler.setImmediate(r.timeoutCb) });
                this.databuffer = []; if (callback) callback({ bytesRead: ret.length, data: ret }) }, cleanup: function(callback) { this.log.log("Cleaning everything of buffer.", hexRep(this.databuffer));
                this.readers.slice().forEach(this.removeReader.bind(this)); if (this.closed) { if (callback) callback(); return } this.closed = true; for (var i = 0; i < this.readers.length; i++) { if (!this.readers[i]) { delete this.readers[i] } else { throw Error("Buffer reader survived the cleanup" + this.readers[i]) } } this.databuffer = [];
                this.write = function(_, errCb) { errCb("Writing on a closed buffer.") }; if (callback) callback() } };
        module.exports.Buffer = Buffer;
        module.exports.BufferReader = BufferReader;
        module.exports.hexRep = hexRep;
        module.exports.bufToBin = bufToBin;
        module.exports.storeAsTwoBytes = storeAsTwoBytes;
        module.exports.storeAsFourBytes = storeAsFourBytes;
        module.exports.binToBuf = binToBuf }, { "./logging": 53, "./scheduler.js": 68, "./util": 72 }],
    41: [function(require, module, exports) { var scheduler = require("./scheduler.js");

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
        module.exports.Data = Data }, { "./scheduler.js": 68 }],
    42: [function(require, module, exports) {
        var uniqueId = 1;

        function RetVal(value, message, context, id) { this.name = null;
            this.value = value;
            this.message = message;
            this.context = context;
            this.id = id || uniqueId++ } RetVal.prototype = { copy: function(context) { var ret = new RetVal(this.value, this.message, context, this.id);
                ret.name = this.name; return ret }, shortMessage: function(context, state) { var safeContext = {};

                function populateSafelyWith(ctx) { Object.getOwnPropertyNames(ctx || {}).forEach(function(p) { safeContext[p] = context[p]; try { JSON.stringify(context[p]) } catch (e) { safeContext[p] = "<recursive>" } }) } populateSafelyWith(this.context);
                populateSafelyWith(context); return JSON.stringify({ name: this.name, val: this.value, state: state, context: safeContext }) } };

        function populatedErrorNames() { Object.getOwnPropertyNames(errors).forEach(function(key) { errors[key].name = key }); return errors }
        var errors = { SUCCESS: new RetVal(0, "Success!"), UNKNOWN_ERROR: new RetVal(1, "Unknown error."), API_ERROR: new RetVal(1, "Unknown api error."), KILLED: new RetVal(2, "Killed by user."), PREMATURE_RETURN: new RetVal(1, "Some process returned before it was supposed to."), LEONARDO_MAGIC_CONNECT_FAIL: new RetVal(20100, "Failed to connect to magic baudrate."), LEONARDO_MAGIC_DISCONNECT_FAIL: new RetVal(20101, "Failed to disconnect from magic baudrate"), LEONARDO_DISCONNECT_INITIAL_DEV: new RetVal(20102, "Waited too long for the initial device after a disconnect."), LEONARDO_REAPPEAR_TIMEOUT: new RetVal(20103, "Butterfly device never reappeared after magic"), BAD_BOOTLOADER: new RetVal(20104, "Butterfly device doesn't seem to have caterina bootloader."), LEONARDO_NOT_DISAPPEARED: new RetVal(20105, "Butterfly device did not disappear after disconnect from magic."), LEONARDO_DTR_FAIL: new RetVal(20106, "Failed to set dtr to a butterfly device."), NONCATERINA_BOOTLOADER_DISCONNECT: new RetVal(20107, "Failed to disconnect before attempting to retry connecting to a bootloader that didn't behave like caterina."), OVERLAPPING_TIMEOUTS: new RetVal(20108, "Each transaction should have at most one timeout at a time."), HEXFILE_ERROR: new RetVal(20130, "Error during parsing hexfile"), HEXFILE_INCOMPLETE: new RetVal(20131, "Expected more hexfile."), RESOURCE_BUSY: new RetVal(-22, "Serial monitor seems to be open"), RESOURCE_BUSY_FROM_CHROME: new RetVal(-22, "Serial monitor seems to be open by chrome"), UNKNOWN_MONITOR_ERROR: new RetVal(20151, "Unrecognized serial monitor error"), SERIAL_MONITOR_CONNECT: new RetVal(-55, "Serial monitor failed to connect"), SERIAL_MONITOR_WRITE: new RetVal(20153, "Failed to write to serial monitor"), SERIAL_MONITOR_DISCONNECT: new RetVal(20154, "Failed to disconnect from serial monitor"), SERIAL_MONITOR_PREMATURE_DISCONNECT: new RetVal(20155, "Tried to disconnect from serial monitor before connection was established"), SERIAL_MONITOR_WRITE_BEFORE_CONNECT: new RetVal(20156, "Tried to write to a non connected serial monitor"), SERIAL_MONITOR_DEVICE_LOST: new RetVal(20157, "Serial monitor lost the connected device."), SPAMMING_DEVICE: new RetVal(20010, "Device is too fast for us to handle."), LIST_INTERFACES: new RetVal(20170, "Failed to get usb interface list."), CLAIM_INTERFACE: new RetVal(20171, "Failed to claim interface."), DEVICE_DETECTION: new RetVal(20172, "Chrome app doesn't have device registered."), NO_DEVICE: new RetVal(20173, "Couldn't find a suitable device to connect."), OPEN_USB_DEVICE: new RetVal(20174, "Failed to open usb device."), SET_CONFIGURATION: new RetVal(20175, "Failed to set configuration to device."), NO_DEVICE: new RetVal(20176, "Api failed to get devices."), COMMAND_CHECK: new RetVal(20177, "Bad responce to command."), IDLE_HOST: new RetVal(1, "Host seems dead."), CONNECTION_FAIL: new RetVal(36e3, "Failed to connect to serial for flashing."), DTR_RTS_FAIL: new RetVal(1001, "Failed to set DTR/RTS"), READER_TIMEOUT: new RetVal(2e4, "Reader timed out"), GET_INFO: new RetVal(20001, "Failed to get info"), WRITE_FAIL: new RetVal(20003, "Failed to send to serial port"), FLUSH_FAIL: new RetVal(20004, "Failed to flush serial."), BUFFER_WRITE_FAIL: new RetVal(20005, "Failed to write received data to internal buffer."), FORCE_DISCONNECT_FAIL: new RetVal(20006, "Failed to nuke open connections on port"), COMMAND_SIZE_FAIL: new RetVal(20007, "Tried to send mis-sized command (should be 4 bytes)"), SIGN_ON_FAIL: new RetVal(20008, "Failed to sign on to device"), BAD_RESPONSE: new RetVal(20009, "Received malformed response."), PROGRAM_TOO_LARGE: new RetVal(20090, "Tried to flash too large a program"), SIGNATURE_FAIL: new RetVal(20092, "Signature check failed."), ZOMBIE_TRANSACTION: new RetVal(20091, "Unfinished and unkilled transaction detected."), UNSUPPORTED_TPI: new RetVal(20093, "Device is tpi. We don't support that."), GET_DEVICES: new RetVal(20094, "Failed to list serial devices."), PAGE_CHECK: new RetVal(20095, "Failed page check"), PAGE_WRITE_RESPONSE: new RetVal(20096, "Expected different response for page write"), STK500V2USB_DEVICE_RESET: new RetVal(20097, "Failed sk500v2usb device reset"), BULK_TRANSFER: new RetVal(20098, "Failed sk500v2usb bulk transfer"), BULK_RECEIVE: new RetVal(20099, "Failed sk500v2usb bulk receive"), ADDRESS_TOO_LONG: new RetVal(202100, "Address exceeds address space"), UNDEFINED_COMMAND_PREFIX: new RetVal(202101, "Did not define the command prefix."), TRANSFER_ERROR: new RetVal(202102, "Libusb failed to execute command."), SPECIAL_BIT_MEMORY_VERIFICATION: new RetVal(202103, "Failed to verify special bit after write."), CLOSING_CLOSED_SERIAL: new RetVal(20220, "Serial transaction was already closed."), SENDING_ON_CLOSED_SERIAL: new RetVal(20221, "Serial transaction was closed."), UPDATE_CLOSED_BUFFER: new RetVal(20222, "Tried to update closed buffer."), READ_CLOSED_BUFFER: new RetVal(20223, "Tried to read from closed buffer."), RECEIVED_ON_CLOSED_BUFFER: new RetVal(20224, "Tried to write to closed buffer."), CLOSE_CLOSED_BUFFER: new RetVal(20225, "Tried to close closed buffer."), CLOSE_CLOSED_READ_OPERATION: new RetVal(20226, "Closing closed read operation."), MESSAGE_ON_CLOSED_READ_OPERTION: new RetVal(20227, "Got message on closed read operation."), DRAIN_CLOSED_CODEC: new RetVal(20228, "Draining a closed codec"), CLOSE_CLOSED_CODEC: new RetVal(20229, "Closing a closed codec"), SERIAL_RECEIVE_ERROR: new RetVal(20230, "Serial receive error"), OVERLAPPED_READ: new RetVal(20230, "Another read is already in progress."), PRECONFIGURE_CONNECT: new RetVal(20240, "Failed to connect during preconfiguration"), PRECONFIGURE_DISCONNECT: new RetVal(20241, "Failed to disconnect during preconfiguration"), SYNC_RESPONSE: new RetVal(20242, "Got bad response trying to sync.") };
        module.exports = populatedErrorNames();
        module.exports.RetVal = RetVal
    }, {}],
    43: [function(require, module, exports) { var scheduler = require("./scheduler.js"),
            errno = require("./errno.js"),
            status = require("./status.js"),
            Event = require("./../event.js").Event,
            getLog = require("./logging.js").getLog;

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

        function FiniteStateMachine(config, finishCallback, errorCallback, parent) { var self = this;
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
            this.log = getLog("FSM") } FiniteStateMachine.prototype = { setStatus: function(status, context) { this.onStatusChange.dispatch(status, context) }, dead: function() { if (this.parentState) return this._dead || this.parentState.parent.dead(); return this._dead }, child: function(type, cb) { return new type(this.config, cb, this.errCb.bind(this), this) }, refreshTimeout: function() { var self = this; if (this.parentState) { this.parentState.parent.refreshTimeout(); return } if (this.timeout) { scheduler.clearTimeout(this.timeout);
                    this.timeout = null } this.timeout = scheduler.setTimeout(function _fsmIdleHost() { self.finalError(errno.IDLE_HOST, { timeout: self.idleTimeout }) }, this.idleTimeout) }, errCb: function(retval, context) { var self = this,
                    retryConf = null,
                    ctx = context || {};
                this.log.warn("Received error:", retval); if (this.lastTransition && this.lastTransition.doFallback(this.transitionConf.bind(this))) { return } this.finalError(retval, ctx) }, finalError: function(retval, context) { var self = this;
                this.onClose.dispatch(); if (this.parentState) { this.cleanup(function() { self.log.log("Propagating error to parent:", self, "->", self.parentState.parent);
                        self.parentState.parent.errCb(retval, context) }); return } if (this.previousErrors.length > 0) { this.log.warn("Previous errors", this.previousErrors); return } context = context || {}; if (retval.context) { context.retValContext = retval.context } if (this.config && this.config.api && this.config.api.runtime && this.config.api.runtime.lastError) { context.apiLastError = this.config.api.runtime.lastError;
                    this.log.warn("LastError:", this.config.api.runtime.lastError) } var state = this.lastTransition ? this.lastTransition.state : "<unknown>";
                this.lastTransition = null;
                this.log.error("[ERROR:" + state + "]", retval.name, "(" + retval.value + "):", retval.message);
                this.log.error("Context:", context, "last transition:", this.lastTransition);
                this.previousErrors.push(retval.copy(context));
                this.log.log(retval.message, context);
                scheduler.setTimeout(function _fsmFinalError() { self.cleanup(function() { if (self.errorCallback) { scheduler.setTimeout(self.errorCallback.bind(self, retval.value, retval.shortMessage(context, state))); return } }) }) }, transitionConf: function(conf) { var self = this; if (this.dead()) { if (!this.blockedStates || this.blockedStates.length >= 10) { var states = (this.blockedStates || [conf.state]).toString();
                        this.setStatus(status.BLOCKING_STATES, { states: states });
                        this.blockedStates = [] } else { this.blockedStates.push(conf.state) } console.log("Jumping to state '", conf.state, "' arguments:", conf.args, "BLOCKED", this.dead_ ? "(dead parent)" : "(dead)"); return } this.refreshTimeout();
                this.lastTransition = conf; if (typeof this[conf.state] !== "function") { throw Error(conf.state + " transition not available.") } if (typeof conf.waitBefore !== "number" || conf.isRetry) { this.log.log("Jumping '" + conf.state + "' (immediate) arguments:", conf.args);
                    self.setStatus(status.TRANSITION, { state: conf.state, args: conf.args });
                    this[conf.state].apply(this, conf.args); return } scheduler.setTimeout(function _jumpToState() { self.log.log("Jumping '" + conf.state + "' (delay: ", conf.waitBefore, ") arguments:", conf.args);
                    self.setStatus(status.TRANSITION, { state: conf.state, args: conf.args });
                    self[conf.state].apply(self, conf.args) }, conf.waitBefore) }, transition: function(stateOrConf, varArgs) { var args = [].slice.call(arguments, 1),
                    conf; if (typeof stateOrConf == "string") { conf = new TransitionConfig({ state: stateOrConf, args: args }) } else { conf = new TransitionConfig(stateOrConf); if (args.length > 0) { conf.args = args } } return this.transitionConf(conf) }, transitionCb: function(stateOrConf, varArgs) { var self = this,
                    allArgs = [].slice.call(arguments); return function() { var newArgs = [].slice.call(arguments);
                    self.transition.apply(self, allArgs.concat(newArgs)) } }, cleanup: function(callback) { if (this._dead) { return } this._dead = true; if (this.parentState) { this.parentState.parent.onClose.removeListener(this.parentState.listeners.closeListner) } this.onClose.dispatch();
                this.onClose.close();
                callback = callback || this.finishCallback.bind(this); if (this.timeout) { this.log.log("Stopping timeout");
                    scheduler.clearTimeout(this.timeout) } this.timeout = null;

                function doCleanup() { scheduler.clearTimeout(emergencyCleanupTimeout);
                    callback() } var emergencyCleanupTimeout = scheduler.setTimeout(doCleanup, 1e4);
                this.localCleanup(doCleanup) }, localCleanup: function(cb) { scheduler.setTimeout(function _localCleanupCb() { cb() }) } };
        module.exports.FiniteStateMachine = FiniteStateMachine }, { "./../event.js": 75, "./errno.js": 42, "./logging.js": 53, "./scheduler.js": 68, "./status.js": 70 }],
    44: [function(require, module, exports) { var Data = require("./data.js").Data,
            errno = require("./errno.js");

        function Parser(hex, maxSize) { this.resetState();
            this.hex = hex;
            this.maxSize = maxSize } Parser.prototype = { resetState: function() { this.lastError = null;
                this.offsetLin = 0;
                this.offsetSeg = 0;
                this.endOfData = false }, data: function() { var self = this;
                this.resetState(); var ret = this.hex.split("\n").reduce(function(data, line) { var d = data && self.parseLine(line); return d && data.layer(d.data, d.offset, true) }, new Data); if (!this.endOfData && this.hex.length > 0) { this.lastError = errno.HEXFILE_INCOMPLETE; return null } return ret }, hexToBytes: function(strData) { var arr = new Array(strData.length / 2); for (var i = 0; i < strData.length; i += 2) { arr[i / 2] = Number.parseInt(strData[i] + strData[i + 1], 16) } return arr }, parseLine: function(line) { var EMPTY = { offset: this.offsetLin, data: [] };
                line = line.trim(); if (line.length == 0) { return EMPTY } if (this.endOfData) { this.lastError = errno.HEXFILE_ERROR; return null } var index = 0,
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
                    this.lastError = errno.HEXFILE_ERROR; return null } switch (type) {
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
        module.exports.Parser = Parser }, { "./data.js": 41, "./errno.js": 42 }],
    45: [function(require, module, exports) {
        (function(global) { var util = require("./util");

            function mergeChunks(blob, chunk) { if (blob && blob.data.length == 0) blob = null; if (chunk && chunk.data.length == 0) chunk = null; if (chunk === null || blob === null) return blob || chunk || { addr: 0, data: [] }; var minStart = Math.min(chunk.addr, blob.addr),
                    maxEnd = Math.max(chunk.addr + chunk.data.length, blob.addr + blob.data.length),
                    data = util.makeArrayOf(0, blob.addr - minStart).concat(blob.data).concat(util.makeArrayOf(0, maxEnd - (blob.data.length + blob.addr)));
                chunk.data.forEach(function(byte, byteRelAddr) { data[byteRelAddr + (chunk.addr - minStart)] = byte }); return { addr: minStart, data: data } }

            function hexToBytes(strData) { var tmp; return util.arraify(strData).reduce(function(arr, c, i) { if (i % 2) { return arr.concat([Number.parseInt(tmp + c, 16)]) } else { tmp = c; return arr } }, []) }

            function ParseHexFile(hexString) { var offsetLin = 0;

                function lineToChunk(line) { if (line.length == 0) return null; var index = 0,
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
                        actualCheck = hexToBytes(line.substring(1, index)).reduce(function(a, b) { return a + b }, 0) & 255,
                        checksum = Number.parseInt(rng(2), 16),
                        byteData = hexToBytes(strData);
                    util.assert(start == ":", "Hex file line did not start with ':': " + line);
                    util.assert(checksum == (-actualCheck & 255), "Checksum failed for line: " + line); switch (type) {
                        case DATA:
                            return { addr: addr + offsetLin, data: byteData }; break;
                        case EXTENDED_LIN_ADDR:
                            offsetLin = Number.parseInt(strData) << 16;
                        default:
                            return null } } return hexString.split("\n").map(lineToChunk).reduce(mergeChunks, null) || { addr: 0, data: [] } }

            function _ParseHexFile(input) { var kStartcodeBytes = 1; var kSizeBytes = 2; var kAddressBytes = 4; var kRecordTypeBytes = 2; var kChecksumBytes = 2; var inputLines = input.split("\n"); var out = []; var nextAddress = 0; for (var i = 0; i < inputLines.length; ++i) { var line = inputLines[i]; if (line[0] != ":") { console.log("Bad line [" + i + "]. Missing startcode: " + line); return "FAIL" } var ptr = kStartcodeBytes; if (line.length < kStartcodeBytes + kSizeBytes) { console.log("Bad line [" + i + "]. Missing length bytes: " + line); return "FAIL" } var dataSizeHex = line.substring(ptr, ptr + kSizeBytes);
                    ptr += kSizeBytes; var dataSize = hexToDecimal(dataSizeHex); if (line.length < ptr + kAddressBytes) { console.log("Bad line [" + i + "]. Missing address bytes: " + line); return "FAIL" } var addressHex = line.substring(ptr, ptr + kAddressBytes);
                    ptr += kAddressBytes; var address = hexToDecimal(addressHex); if (line.length < ptr + kRecordTypeBytes) { console.log("Bad line [" + i + "]. Missing record type bytes: " + line); return "FAIL" } var recordTypeHex = line.substring(ptr, ptr + kRecordTypeBytes);
                    ptr += kRecordTypeBytes; var dataChars = 2 * dataSize; if (line.length < ptr + dataChars) { console.log("Bad line [" + i + "]. Too short for data: " + line); return "FAIL" } var dataHex = line.substring(ptr, ptr + dataChars);
                    ptr += dataChars; if (line.length < ptr + kChecksumBytes) { console.log("Bad line [" + i + "]. Missing checksum: " + line); return "FAIL" } var checksumHex = line.substring(ptr, ptr + kChecksumBytes); if (line.length > ptr + kChecksumBytes + 1) { var leftover = line.substring(ptr, line.length); if (!leftover.match("$w+^")) { console.log("Bad line [" + i + "]. leftover data: " + line); return "FAIL" } } var kDataRecord = "00"; var kEndOfFileRecord = "01"; if (recordTypeHex == kEndOfFileRecord) { return out } else if (recordTypeHex == kDataRecord) { if (address != nextAddress) { console.log("I need contiguous addresses");
                            console.log(input); return "FAIL" } nextAddress = address + dataSize; var bytes = hexCharsToByteArray(dataHex); if (bytes == -1) { console.log("Couldn't parse hex data: " + dataHex); return "FAIL" } out = out.concat(bytes) } else { console.log("I can't handle records of type: " + recordTypeHex); return "FAIL" } } console.log("Never found EOF!"); return "FAIL" }

            function hexToDecimal(h) { if (!h.match("^[0-9A-Fa-f]*$")) { console.log("Invalid hex chars: " + h); return -1 } return parseInt(h, 16) }

            function hexCharsToByteArray(hc) { if (hc.length % 2 != 0) { console.log("Need 2-char hex bytes"); return -1 } var bytes = []; for (var i = 0; i < hc.length / 2; ++i) { var hexChars = hc.substring(i * 2, i * 2 + 2); var byte = hexToDecimal(hexChars); if (byte == -1) { return -1 } bytes.push(byte) } return bytes } var Base64Binary = { _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", decodeArrayBuffer: function(input) { var bytes = input.length / 4 * 3; var ab = new ArrayBuffer(bytes);
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
            global.ParseHexFile = ParseHexFile;
            global.Base64Binary = Base64Binary;
            module.exports.ParseHexFile = ParseHexFile;
            module.exports.Base64Binary = Base64Binary }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./util": 72 }],
    46: [function(require, module, exports) { var SerialIo = require("./serial.js").SerialIo,
            errno = require("./../errno.js"),
            getLog = require("./../logging.js").getLog,
            Event = require("./../../event.js").Event;

        function Buffer(connectionId, api, errorCb) { var self = this;
            this.serial = new SerialIo(api, errorCb);
            this.log = getLog("Buffer");
            this.state = {};
            this.state.connectionId = connectionId;
            this.state.dataBuffer = []; if (errorCb) { this.errorCb = errorCb } this.onUpdate = new Event;
            this.serial.onReceive.addListener(function(connectionId, data) { if (self.state.connectionId != connectionId) return;
                self.receive(data) }) } Buffer.prototype = { errorCb: function(retval) { throw Error(retval.shortMessage()) }, update: function(conf) { if (this.closed) { this.errorCb(errno.UPDATE_CLOSED_BUFFER); return } this.state.dataBuffer = conf.dataBuffer || this.state.dataBuffer }, dataBuffer: function() { if (this.closed) { this.errorCb(errno.READ_CLOSED_BUFFER); return null } return this.state.dataBuffer }, receive: function(data) { if (this.closed) { this.errorCb(errno.READ_CLOSED_BUFFER); return } this.state.dataBuffer = this.state.dataBuffer.concat(data);
                this.onUpdate.dispatch("received") }, close: function() { if (this.closed) { this.errorCb(errno.CLOSE_CLOSED_BUFFER); return } this.log.log("Closing buffer");
                this.closed = true;
                this.serial.close();
                this.onUpdate.close() } };
        module.exports.Buffer = Buffer }, { "./../../event.js": 75, "./../errno.js": 42, "./../logging.js": 53, "./serial.js": 49 }],
    47: [function(require, module, exports) { var CodecSocket = require("./codecsocket.js").CodecSocket,
            createBadMessage = require("./codecsocket.js").createBadMessage,
            createFinalMessage = require("./codecsocket.js").createFinalMessage; var STK_INSYC = 20,
            STK_OK = 16,
            createMessage = createSizedMessage;

        function createSizedMessage(dataBuffer, minPureData) { if (dataBuffer.length != minPureData) return createBadMessage(dataBuffer, 0, "Not the right amount of data"); return new createFinalMessage(dataBuffer.slice(minPureData), dataBuffer.slice(0, minPureData)) }

        function ButterflyCodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb) } ButterflyCodecSocket.prototype = Object.create(CodecSocket.prototype);
        ButterflyCodecSocket.prototype.encode = function(data) { return data };
        ButterflyCodecSocket.prototype.decode = function(dataBuffer, minPureData) { return createMessage(dataBuffer, minPureData) };
        module.exports.createEndedMessage = createSizedMessage;
        module.exports.ButterflyCodecSocket = ButterflyCodecSocket }, { "./codecsocket.js": 48 }],
    48: [function(require, module, exports) { var Buffer = require("./buffer.js").Buffer,
            SerialIo = require("./serial.js").SerialIo,
            errno = require("./../errno.js"),
            logging = require("./../logging.js"),
            scheduler = require("./../scheduler.js"); var readerId = 0;

        function ReadOperation(buffer, decodeCb, finishCb, config, errorCb) { var self = this;
            this.closed = false;
            this.buffer = buffer;
            this.config = config || {};
            this.decodeCb = decodeCb;
            this.finishCallback = finishCb;
            this.id = readerId++;
            this.log = logging.getLog("ReadOperation"); if (errorCb) { this.errorCb = errorCb } this.updateListener = function(type) { if (type != "received") return;
                self.gotBytes() }; var ttl = this.config.ttl || 2e3;
            this.log.log("read operation (id: ", this.id, "ttl:", ttl, ")");
            this.buffer.onUpdate.addListener(this.updateListener);
            this.timeoutHandle = scheduler.setTimeout(function() { self.log.log("Failed read operation (id: ", self.id, "ttl:", ttl, ")");
                self.close();
                self.errorCb(errno.READER_TIMEOUT) }, ttl) } ReadOperation.prototype = { errorCb: function(retval) { throw Error(retval.shortMessage()) }, close: function() { if (this.closed) { return } this.log.log("Closing read operation");
                this.closed = true;
                scheduler.clearTimeout(this.timeoutHandle);
                this.buffer.onUpdate.removeListener(this.updateListener) }, gotBytes: function() { if (this.closed) { this.errorCb(errno.MESSAGE_ON_CLOSED_READ_OPERTION); return } this.log.log("Buffer(decode config:", this.config, "):", this.buffer.dataBuffer()); var response = this.decodeCb(this.buffer.dataBuffer(), this.config.minPureData, this.config);
                this.buffer.update({ dataBuffer: response.dataBuffer }); if (!response.message) return;
                this.close();
                this.finishCallback(response.message) } }; var codecSocketUid = 0;

        function CodecSocket(connectionId, api, errorCb) { var self = this;
            this.connectionId = connectionId;
            this.buffer = new Buffer(connectionId, api, errorCb);
            this.serial = this.buffer.serial;
            this.log = logging.getLog("CodecSocket");
            this.refCount = 0;
            this.id = codecSocketUid++; if (errorCb) { this.errorCb = errorCb } this.receiveErrorListener = function(err) { self.errorCb(errno.SERIAL_RECEIVE_ERROR, { error: err }) };
            this.state = {};
            this.state.readOperation = null;
            this.closed = false;
            this.serial.onReceiveError.addListener(this.receiveErrorListener) } CodecSocket.prototype = { errorCb: function(retval) { throw Error(retval.shortMessage()) }, encode: function(data) { return data }, decode: function(dataBuffer) { return createFinalMessage([], dataBuffer.slice()) }, justWrite: function(data, cb, config) { var message = this.encode(data);
                this.log.log("Sending (", this.connectionId, "):", message);
                this.serial.send(this.connectionId, message, cb) }, writeThenRead: function(data, cb, config) { var self = this,
                    handle = function(ok) { if (ok) return;
                        self.cancelRead();
                        self.errorCb(errno.API_ERROR) }; if (this.state.readOperation && !this.state.readOperation.closed) { this.state.readOperation.close() } this.state.readOperation = new ReadOperation(this.buffer, this.decode.bind(this), cb, config, this.errorCb.bind(this));
                this.justWrite(data, handle) }, cancelRead: function() { this.state.readOperation.close() }, drain: function(cb) { if (this.closed) { this.errorCb(errno.DRAIN_CLOSED_CODEC); return } this.buffer.update({ dataBuffer: [] });
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
        module.exports.CodecSocket = CodecSocket }, { "./../errno.js": 42, "./../logging.js": 53, "./../scheduler.js": 68, "./buffer.js": 46, "./serial.js": 49 }],
    49: [function(require, module, exports) { var util = require("./util.js"),
            errno = require("./../errno.js"),
            getLog = require("./../logging").getLog,
            Event = require("./../../event.js").Event;

        function SerialIo(api, errorCb) { var self = this;
            this.log = getLog("SerialIo");
            this.api = api;
            this.onReceive = new Event;
            this.onReceiveError = new Event; if (errorCb) this.errorCb = errorCb;
            this.handlers = { onReceiveErrorCb: function() { self.onReceiveError.dispatch.apply(self.onReceiveError, arguments) }, onReceiveCb: function(rcv) { var data = util.bufToBin(rcv.data);
                    self.log.log("Received:", data);
                    self.onReceive.dispatch(rcv.connectionId, data) } };
            this.api.onReceiveError.addListener(this.handlers.onReceiveErrorCb);
            this.api.onReceive.addListener(this.handlers.onReceiveCb) } SerialIo.prototype = { errorCb: function(retval) { throw Error(retval.shortMessage()) }, send: function(connectionId, data, cb) { if (this.closed) { this.errorCb(errno.SENDING_ON_CLOSED_SERIAL); return } var realData = util.binToBuf(data);
                this.api.send(connectionId, realData, function(resp) { if (!resp || resp.bytesSent != data.length) { cb(false); return } cb(true) }) }, close: function() { if (this.closed) { this.errorCb(errno.CLOSING_CLOSED_SERIAL); return } this.log.log("Closing serial");
                this.closed = true;
                this.onReceive.close();
                this.onReceiveError.close();
                this.log.log("Removing onReveive and onReceiveError listeners");
                this.api.onReceiveError.removeListener(this.handlers.onReceiveErrorCb);
                this.api.onReceive.removeListener(this.handlers.onReceiveCb) } };
        module.exports.SerialIo = SerialIo }, { "./../../event.js": 75, "./../errno.js": 42, "./../logging": 53, "./util.js": 52 }],
    50: [function(require, module, exports) { var CodecSocket = require("./codecsocket.js").CodecSocket,
            createBadMessage = require("./codecsocket.js").createBadMessage,
            createFinalMessage = require("./codecsocket.js").createFinalMessage; var STK_INSYC = 20,
            STK_OK = 16,
            createMessage = createEndMessage;

        function createEndMessage(dataBuffer, minPureData) { var i; if (dataBuffer.length < minPureData + 2) return createBadMessage(dataBuffer, 0, "Expecting more data"); for (i = dataBuffer.length; i >= 0; i--) { if (dataBuffer[i] == STK_OK) break } if (i < 0) return createBadMessage(dataBuffer, 0, "No end found"); return createStartMessage(dataBuffer, i, minPureData) }

        function createStartMessage(dataBuffer, endIndex, minPureData) { var start; for (start = endIndex - minPureData - 1; start >= 0; start--) { if (dataBuffer[start] == STK_INSYC) break } if (start < 0) createBadMessage(dataBuffer, 0, "No start found"); return createFinalMessage(dataBuffer.slice(endIndex + 1), dataBuffer.slice(start + 1, endIndex)) }

        function Stk500CodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb) } Stk500CodecSocket.prototype = Object.create(CodecSocket.prototype);
        Stk500CodecSocket.prototype.encode = function(data) { return data };
        Stk500CodecSocket.prototype.decode = function(dataBuffer, minPureData, config) { if (!config || !config.ignoreBadFinalByte) { return createMessage(dataBuffer, minPureData || 0) } return createStartMessage(dataBuffer, dataBuffer.length, 0) };
        module.exports.Stk500CodecSocket = Stk500CodecSocket }, { "./codecsocket.js": 48 }],
    51: [function(require, module, exports) { var CodecSocket = require("./codecsocket.js").CodecSocket,
            createBadMessage = require("./codecsocket.js").createBadMessage,
            util = require("./util.js"),
            getLog = require("./../logging.js").getLog,
            createFinalMessage = require("./codecsocket.js").createFinalMessage; var STKv2_START = 27,
            STKv2_TOKEN = 14,
            createMessage = createLastStarterMessage,
            log;

        function createLastStarterMessage(dataBuffer, state) { var minMessage = 6 + (state.minPureData || 0); var tokenIndex = typeof state.lastValidTokenIndex !== "undefined" ? state.lastValidTokenIndex : dataBuffer.length - 1; for (; tokenIndex >= 0; tokenIndex--) { if (dataBuffer[tokenIndex] == STKv2_TOKEN) break } state.lastValidTokenIndex = tokenIndex - 1; var startIndex = tokenIndex - 4; if (startIndex < 0) { return createBadMessage(dataBuffer, Math.max(startIndex, 0), "No message header found") } if (dataBuffer[startIndex] != STKv2_START) { log.log("Found no start at:", startIndex); return createLastStarterMessage(dataBuffer, state) } return createSeqMessage(dataBuffer, startIndex, state) }

        function createSeqMessage(dataBuffer, offset, state) { var newOffset = offset + 1,
                seq = dataBuffer[newOffset]; if (state.seq != seq) { log.warn("Bad sequence:", seq, "!=", state.seq); return createLastStarterMessage(dataBuffer, state) } return createLengthMessage(dataBuffer, newOffset, state) }

        function createLengthMessage(dataBuffer, offset, state) { var length1 = dataBuffer[offset + 1],
                length2 = dataBuffer[offset + 2],
                msgLength = length1 << 8 | length2,
                newOffset = offset + 2; if (state.minPureData && msgLength < state.minPureData) { log.warn("Less data than expected:", msgLength, "!=", state.minPureData); return createLastStarterMessage(dataBuffer, state) } state.msgLength = msgLength; return createTokenMessage(dataBuffer, newOffset, state) }

        function createTokenMessage(dataBuffer, offset, state) { var newOffset = offset + 1; if (dataBuffer[newOffset] != STKv2_TOKEN) { log.warn("Expected a token, god garbage"); return createLastStarterMessage(dataBuffer, state) } return createContentMessage(dataBuffer, newOffset, state) }

        function createContentMessage(dataBuffer, offset, state) { var messageStart = offset + 1,
                messageEnd = messageStart + state.msgLength,
                newOffset = messageEnd - 1,
                message = dataBuffer.slice(messageStart, messageEnd); if (message.length != state.msgLength) { return createLastStarterMessage(dataBuffer, state) } state.message = message; return createCrcMessage(dataBuffer, newOffset, state) }

        function createCrcMessage(dataBuffer, offset, state) { var end = offset + 2,
                crc = dataBuffer.slice(state.lastValidTokenIndex - 3, end).reduce(function(a, b) { return a ^ b }, 0); if (crc != 0) { log.warn("Bad crc..."); return createLastStarterMessage(dataBuffer, state) } return createFinalMessage(dataBuffer.slice(end), state.message) }

        function Stk500v2CodecSocket(connectionId, api, errorCb) { CodecSocket.call(this, connectionId, api, errorCb);
            log = getLog("STK500v2codec");
            this.state = this.state || {};
            this.state.seq = 0 } Stk500v2CodecSocket.prototype = Object.create(CodecSocket.prototype);
        Stk500v2CodecSocket.prototype.encode = function(data) { var size = util.storeAsTwoBytes(data.length),
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
        module.exports.Stk500v2CodecSocket = Stk500v2CodecSocket }, { "./../logging.js": 53, "./codecsocket.js": 48, "./util.js": 52 }],
    52: [function(require, module, exports) {
        function bufToBin(buf) { if (!(buf instanceof ArrayBuffer)) return buf; var bufferView = new Uint8Array(buf); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

        function binToBuf(hex) { if (hex instanceof ArrayBuffer) return hex; var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

        function storeAsTwoBytes(n) { return [n >> 8 & 255, n & 255] }

        function storeAsFourBytes(n) { return [n >> 24 & 255, n >> 16 & 255, n >> 8 & 255, n & 255] }

        function hexRep(intArray) { if (intArray === undefined) return "<undefined>"; var buf = "["; var sep = ""; for (var i = 0; i < intArray.length; ++i) { var hex = intArray[i].toString(16);
                hex = hex.length < 2 ? "0" + hex : hex;
                buf += " " + hex } buf += "]"; return buf } module.exports.bufToBin = bufToBin;
        module.exports.binToBuf = binToBuf;
        module.exports.storeAsTwoBytes = storeAsTwoBytes;
        module.exports.storeAsFourBytes = storeAsFourBytes;
        module.exports.hexRep = hexRep }, {}],
    53: [function(require, module, exports) {
        (function(global) { var dbg = console.log.bind(console),
                defaultSettings = require("./../default.js").settings,
                NODEJS = global.window !== global;

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
            VerbosityConsole.prototype.verbosity = function() { if (typeof this.verbosity === "number") return this.verbosity; return defaultSettings.get("verbosity") };
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

            function getLog(prefix) { return (loggers[defaultSettings.get("logger")] || loggers["default"])(prefix) } module.exports.getLog = getLog }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./../default.js": 74 }],
    54: [function(require, module, exports) {
        var obj1595 = {};
        var obj1594 = {};
        var obj1593 = [255, 255];
        var obj1592 = [127, 127];
        var obj1591 = [0, 0];
        var obj1590 = [128, 127];
        var obj1589 = [0, 255];
        var obj1588 = [255, 0];
        var obj1587 = [30, 148, 5];
        var obj1586 = [30, 146, 13];
        var obj1585 = [30, 147, 15];
        var obj1584 = [30, 149, 11];
        var obj1583 = [30, 149, 15];
        var obj1582 = [30, 150, 9];
        var obj1581 = [30, 147, 3];
        var obj1580 = [30, 148, 10];
        var obj1579 = [30, 146, 2];
        var obj1578 = [30, 150, 8];
        var obj1577 = [30, 145, 15];
        var obj1576 = [30, 145, 11];
        var obj1575 = [30, 145, 1];
        var obj1574 = [30, 145, 9];
        var obj1573 = [30, 149, 12];
        var obj1572 = [30, 167, 1];
        var obj1571 = [30, 147, 8];
        var obj1570 = [30, 146, 7];
        var obj1569 = [30, 146, 3];
        var obj1568 = [30, 149, 7];
        var obj1567 = [30, 144, 4];
        var obj1566 = [30, 151, 5];
        var obj1565 = [30, 147, 13];
        var obj1564 = [30, 145, 8];
        var obj1563 = [30, 148, 1];
        var obj1562 = [30, 144, 5];
        var obj1561 = [30, 148, 3];
        var obj1560 = [30, 147, 1];
        var obj1559 = [30, 150, 5];
        var obj1558 = [30, 146, 12];
        var obj1557 = [30, 150, 10];
        var obj1556 = [30, 149, 3];
        var obj1555 = [30, 148, 11];
        var obj1554 = [30, 146, 10];
        var obj1553 = [30, 144, 8];
        var obj1552 = [30, 151, 1];
        var obj1551 = [30, 167, 3];
        var obj1550 = [30, 146, 5];
        var obj1549 = [30, 149, 5];
        var obj1548 = [30, 145, 12];
        var obj1547 = [30, 168, 3];
        var obj1546 = [30, 167, 2];
        var obj1545 = [30, 143, 10];
        var obj1544 = [30, 149, 4];
        var obj1543 = [30, 144, 1];
        var obj1542 = [30, 151, 6];
        var obj1541 = [30, 146, 6];
        var obj1540 = [30, 147, 10];
        var obj1539 = [30, 149, 8];
        var obj1538 = [30, 147, 7];
        var obj1537 = [30, 148, 6];
        var obj1536 = [30, 146, 14];
        var obj1535 = [30, 150, 4];
        var obj1534 = [30, 150, 2];
        var obj1533 = [30, 150, 6];
        var obj1532 = [30, 146, 1];
        var obj1531 = [30, 151, 3];
        var obj1530 = [30, 152, 2];
        var obj1529 = [30, 145, 10];
        var obj1528 = [30, 150, 3];
        var obj1527 = [30, 151, 2];
        var obj1526 = [30, 149, 2];
        var obj1525 = [30, 144, 7];
        var obj1524 = [30, 149, 6];
        var obj1523 = [30, 144, 3];
        var obj1522 = [30, 151, 4];
        var obj1521 = [30, 146, 8];
        var obj1520 = [30, 145, 3];
        var obj1519 = [30, 152, 1];
        var obj1518 = [30, 147, 12];
        var obj1517 = [30, 145, 5];
        var obj1516 = [30, 147, 6];
        var obj1515 = [30, 168, 2];
        var obj1514 = [30, 166, 2];
        var obj1513 = [30, 148, 2];
        var obj1512 = [30, 144, 6];
        var obj1511 = [30, 143, 9];
        var obj1510 = [30, 148, 4];
        var obj1509 = [30, 147, 11];
        var obj1508 = [30, 166, 3];
        var obj1507 = [30, 148, 66];
        var obj1506 = [30, 152, 69];
        var obj1505 = [30, 152, 71];
        var obj1504 = [30, 151, 76];
        var obj1503 = [30, 148, 137];
        var obj1502 = [30, 149, 66];
        var obj1501 = [30, 147, 17];
        var obj1500 = [237, 192, 63];
        var obj1499 = [30, 150, 66];
        var obj1498 = [30, 150, 70];
        var obj1497 = [30, 149, 17];
        var obj1496 = [30, 149, 138];
        var obj1495 = [255, 255, 255];
        var obj1494 = [30, 151, 82];
        var obj1493 = [30, 152, 67];
        var obj1492 = [30, 151, 68];
        var obj1491 = [30, 149, 68];
        var obj1490 = [30, 150, 71];
        var obj1489 = [30, 149, 129];
        var obj1488 = [30, 152, 70];
        var obj1487 = [30, 147, 137];
        var obj1486 = [30, 151, 130];
        var obj1485 = [30, 149, 65];
        var obj1484 = [30, 147, 129];
        var obj1483 = [30, 150, 73];
        var obj1482 = [30, 150, 82];
        var obj1481 = [30, 151, 72];
        var obj1480 = [30, 150, 81];
        var obj1479 = [30, 151, 73];
        var obj1478 = [30, 151, 81];
        var obj1477 = [30, 148, 18];
        var obj1476 = [30, 151, 65];
        var obj1475 = [30, 147, 130];
        var obj1474 = [30, 150, 78];
        var obj1473 = [30, 151, 78];
        var obj1472 = [30, 150, 129];
        var obj1471 = [30, 150, 130];
        var obj1470 = [30, 148, 131];
        var obj1469 = [30, 151, 77];
        var obj1468 = [30, 148, 69];
        var obj1467 = [30, 149, 76];
        var obj1466 = [30, 148, 65];
        var obj1465 = [30, 148, 67];
        var obj1464 = [30, 152, 66];
        var obj1463 = [30, 149, 135];
        var obj1462 = [30, 151, 75];
        var obj1461 = [30, 147, 65];
        var obj1460 = [30, 151, 129];
        var obj1459 = [30, 149, 20];
        var obj1458 = [30, 151, 70];
        var obj1457 = [30, 151, 71];
        var obj1456 = [30, 151, 66];
        var obj1455 = [30, 147, 131];
        var obj1454 = [30, 152, 68];
        var obj1453 = [30, 148, 130];
        var obj1452 = [30, 150, 74];
        var obj1451 = { paged: false, readback: obj1591, memops: obj1594 };
        var obj1450 = { paged: false, size: 1, readback: obj1591, memops: obj1594 };
        var obj1449 = { paged: false, size: 3, readback: obj1591, memops: obj1594 };
        var obj1448 = { op: "CHIP_ERASE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1447 = { op: "CHIP_ERASE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1446 = { op: "CHIP_ERASE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1445 = { op: "CHIP_ERASE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1444 = { op: "CHIP_ERASE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1443 = { op: "PGM_ENABLE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1442 = { op: "CHIP_ERASE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1441 = { op: "PGM_ENABLE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1440 = { op: "PGM_ENABLE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1439 = { op: "PGM_ENABLE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1438 = { op: "PGM_ENABLE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1437 = { op: "CHIP_ERASE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1436 = { op: "CHIP_ERASE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1435 = { op: "CHIP_ERASE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1434 = { op: "PGM_ENABLE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1433 = { op: "CHIP_ERASE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1432 = { op: "PGM_ENABLE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1431 = { op: "PGM_ENABLE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1430 = { op: "CHIP_ERASE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1429 = { op: "PGM_ENABLE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1428 = { op: "CHIP_ERASE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1427 = { op: "PGM_ENABLE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1426 = { op: "CHIP_ERASE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1425 = { op: "PGM_ENABLE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1424 = { op: "CHIP_ERASE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1423 = { op: "PGM_ENABLE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1422 = { op: "CHIP_ERASE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1421 = { op: "PGM_ENABLE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1420 = { op: "CHIP_ERASE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1419 = { op: "PGM_ENABLE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1418 = { op: "CHIP_ERASE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1417 = { op: "PGM_ENABLE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1416 = { op: "PGM_ENABLE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1415 = { op: "CHIP_ERASE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1414 = { op: "CHIP_ERASE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1413 = { op: "PGM_ENABLE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1412 = { op: "CHIP_ERASE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1411 = { op: "CHIP_ERASE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1410 = { op: "PGM_ENABLE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1409 = { op: "PGM_ENABLE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj1408 = { op: "CHIP_ERASE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1407 = { op: "CHIP_ERASE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1406 = { op: "CHIP_ERASE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1405 = { op: "PGM_ENABLE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1404 = { op: "PGM_ENABLE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1403 = { op: "PGM_ENABLE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1402 = { op: "PGM_ENABLE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1401 = { op: "PGM_ENABLE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1400 = { op: "PGM_ENABLE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1399 = { op: "CHIP_ERASE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1398 = { op: "CHIP_ERASE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1397 = { op: "CHIP_ERASE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1396 = { op: "CHIP_ERASE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1395 = { op: "PGM_ENABLE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1394 = { op: "PGM_ENABLE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1393 = { op: "CHIP_ERASE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1392 = { op: "CHIP_ERASE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1391 = { op: "PGM_ENABLE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1390 = { op: "PGM_ENABLE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1389 = { op: "CHIP_ERASE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1388 = { op: "PGM_ENABLE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1387 = { op: "PGM_ENABLE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1386 = { op: "PGM_ENABLE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1385 = { op: "CHIP_ERASE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1384 = { op: "PGM_ENABLE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1383 = { op: "PGM_ENABLE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1382 = { op: "CHIP_ERASE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1381 = { op: "CHIP_ERASE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1380 = { op: "PGM_ENABLE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1379 = { op: "PGM_ENABLE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1378 = { op: "CHIP_ERASE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1377 = { op: "CHIP_ERASE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1376 = { op: "PGM_ENABLE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1375 = { op: "CHIP_ERASE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1374 = { op: "PGM_ENABLE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1373 = { op: "CHIP_ERASE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1372 = { op: "CHIP_ERASE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1371 = { op: "PGM_ENABLE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1370 = { op: "CHIP_ERASE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1369 = { op: "PGM_ENABLE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1368 = { op: "CHIP_ERASE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1367 = { op: "CHIP_ERASE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1366 = { op: "PGM_ENABLE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1365 = { op: "CHIP_ERASE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1364 = { op: "PGM_ENABLE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1363 = { op: "PGM_ENABLE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1362 = { op: "CHIP_ERASE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1361 = { op: "PGM_ENABLE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1360 = { op: "CHIP_ERASE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1359 = { op: "PGM_ENABLE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1358 = { op: "CHIP_ERASE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1357 = { op: "CHIP_ERASE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1356 = { op: "PGM_ENABLE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1355 = { op: "CHIP_ERASE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1354 = { op: "PGM_ENABLE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1353 = { op: "CHIP_ERASE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1352 = { op: "CHIP_ERASE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1351 = { op: "CHIP_ERASE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1350 = { op: "CHIP_ERASE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1349 = { op: "CHIP_ERASE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1348 = { op: "PGM_ENABLE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1347 = { op: "READ", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1346 = { op: "READ", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1345 = { op: "READ", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1344 = { op: "READ", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1343 = { op: "READ", instBit: 28, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1342 = { op: "READ", instBit: 2, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1341 = { op: "READ", instBit: 19, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1340 = { op: "READ", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1339 = { op: "READ", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1338 = { op: "READ", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1337 = { op: "READ", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1336 = { op: "READ", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1335 = { op: "READ", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1334 = { op: "READ", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1333 = { op: "READ", instBit: 3, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1332 = { op: "READ", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1331 = { op: "READ", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1330 = { op: "READ", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1329 = { op: "READ", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1328 = { op: "READ", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1327 = { op: "READ", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1326 = { op: "READ", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1325 = { op: "READ", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1324 = { op: "READ", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1323 = { op: "READ", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1322 = { op: "READ", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1321 = { op: "READ", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1320 = { op: "READ", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1319 = { op: "READ", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1318 = { op: "READ", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1317 = { op: "READ", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1316 = { op: "READ", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1315 = { op: "READ", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1314 = { op: "WRITE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1313 = { op: "WRITE", instBit: 17, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1312 = { op: "READ", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1311 = { op: "WRITE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1310 = { op: "WRITE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1309 = { op: "WRITE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1308 = { op: "WRITE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1307 = { op: "WRITE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1306 = { op: "READ", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1305 = { op: "WRITE", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1304 = { op: "WRITE", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1303 = { op: "WRITE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1302 = { op: "WRITE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 1 };
        var obj1301 = { op: "WRITE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1300 = { op: "WRITE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1299 = { op: "READ", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1298 = { op: "READ", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1297 = { op: "READ", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1296 = { op: "WRITE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1295 = { op: "READ", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1294 = { op: "READ", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1293 = { op: "READ", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1292 = { op: "WRITE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj1291 = { op: "WRITE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1290 = { op: "WRITE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1289 = { op: "WRITE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1288 = { op: "WRITE", instBit: 18, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1287 = { op: "WRITE", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1286 = { op: "READ", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1285 = { op: "WRITE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1284 = { op: "WRITE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1283 = { op: "READ", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1282 = { op: "WRITE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1281 = { op: "READ", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1280 = { op: "WRITE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1279 = { op: "READ", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1278 = { op: "WRITE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1277 = { op: "WRITE", instBit: 19, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1276 = { op: "READ", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1275 = { op: "WRITE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1274 = { op: "WRITE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1273 = { op: "WRITE", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1272 = { op: "WRITE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1271 = { op: "WRITE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1270 = { op: "READ", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1269 = { op: "WRITE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1268 = { op: "READ", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1267 = { op: "READ", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1266 = { op: "READ", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1265 = { op: "READ", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1264 = { op: "READ", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1263 = { op: "READ", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1262 = { op: "READ", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1261 = { op: "WRITE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1260 = { op: "WRITE", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1259 = { op: "READ", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1258 = { op: "WRITE", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1257 = { op: "WRITE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1256 = { op: "WRITE", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1255 = { op: "WRITE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1254 = { op: "READ", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1253 = { op: "WRITE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1252 = { op: "WRITE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1251 = { op: "READ", instBit: 8, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1250 = { op: "WRITE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1249 = { op: "WRITE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1248 = { op: "WRITE", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1247 = { op: "WRITE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1246 = { op: "WRITE", instBit: 20, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1245 = { op: "WRITE", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1244 = { op: "READ", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1243 = { op: "WRITE", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1242 = { op: "WRITE", instBit: 16, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1241 = { op: "READ", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1240 = { op: "WRITE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1239 = { op: "WRITE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1238 = { op: "READ", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1237 = { op: "READ", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1236 = { op: "READ", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1235 = { op: "WRITE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1234 = { op: "READ", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1233 = { op: "READ", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1232 = { op: "WRITE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1231 = { op: "READ", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1230 = { op: "WRITE", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1229 = { op: "WRITE", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1228 = { op: "WRITE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1227 = { op: "WRITE", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1226 = { op: "READ", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1225 = { op: "WRITE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1224 = { op: "READ", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1223 = { op: "WRITE", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1222 = { op: "READ", instBit: 10, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1221 = { op: "WRITE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1220 = { op: "WRITE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1219 = { op: "WRITE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1218 = { op: "WRITE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1217 = { op: "WRITE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1216 = { op: "WRITE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1215 = { op: "WRITE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1214 = { op: "READ", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1213 = { op: "READ", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1212 = { op: "READ", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1211 = { op: "READ", instBit: 11, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1210 = { op: "READ", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1209 = { op: "WRITE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1208 = { op: "WRITE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1207 = { op: "READ", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1206 = { op: "READ", instBit: 9, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1205 = { op: "WRITE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1204 = { op: "READ", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1203 = { op: "WRITE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1202 = { op: "READ", instBit: 12, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1201 = { op: "READ", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1200 = { op: "READ", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1199 = { op: "READ", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1198 = { op: "WRITE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1197 = { op: "READ", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1196 = { op: "WRITE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1195 = { op: "WRITE", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1194 = { op: "READ", instBit: 13, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1193 = { op: "READ", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1192 = { op: "WRITE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1191 = { op: "WRITE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1190 = { op: "WRITE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1189 = { op: "WRITE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1188 = { op: "WRITE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1187 = { op: "WRITE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1186 = { op: "WRITE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj1185 = { op: "READ_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1184 = { op: "READ_LO", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1183 = { op: "READ_LO", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1182 = { op: "WRITE", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1181 = { op: "READ_LO", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1180 = { op: "READ_LO", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1179 = { op: "READ_HI", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1178 = { op: "WRITE", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1177 = { op: "READ_LO", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1176 = { op: "READ_HI", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1175 = { op: "READ_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1174 = { op: "READ_HI", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1173 = { op: "WRITE", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1172 = { op: "READ_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1171 = { op: "READ_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1170 = { op: "READ_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1169 = { op: "READ_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1168 = { op: "READ_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1167 = { op: "READ_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1166 = { op: "READ_HI", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1165 = { op: "READ_HI", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1164 = { op: "WRITE", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1163 = { op: "READ_LO", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1162 = { op: "WRITE", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1161 = { op: "WRITE", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1160 = { op: "READ_HI", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1159 = { op: "READ_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1158 = { op: "WRITE", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1157 = { op: "READ_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1156 = { op: "WRITE", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1155 = { op: "READ_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1154 = { op: "READ_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1153 = { op: "READ_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1152 = { op: "WRITE", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1151 = { op: "READ_HI", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1150 = { op: "WRITE", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1149 = { op: "READ_LO", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1148 = { op: "WRITE", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1147 = { op: "READ_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 1 };
        var obj1146 = { op: "READ_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1145 = { op: "WRITE", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1144 = { op: "READ_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1143 = { op: "WRITE", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1142 = { op: "WRITE_HI", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1141 = { op: "WRITE_HI", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1140 = { op: "READ_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1139 = { op: "READ_LO", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1138 = { op: "READ_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1137 = { op: "WRITE_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1136 = { op: "READ_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1135 = { op: "WRITE_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1134 = { op: "WRITE_LO", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1133 = { op: "READ_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1132 = { op: "READ_HI", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1131 = { op: "READ_LO", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1130 = { op: "WRITE_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1129 = { op: "WRITE_LO", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj1128 = { op: "WRITE_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1127 = { op: "READ_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1126 = { op: "WRITE_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1125 = { op: "READ_LO", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1124 = { op: "WRITE_LO", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1123 = { op: "READ_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1122 = { op: "WRITE_LO", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj1121 = { op: "READ_LO", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1120 = { op: "WRITE_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1119 = { op: "WRITE_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1118 = { op: "READ_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1117 = { op: "WRITE_LO", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1116 = { op: "READ_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1115 = { op: "READ_HI", instBit: 3, bitType: "OUTPUT", bitNo: 3, value: 0 };
        var obj1114 = { op: "WRITE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1113 = { op: "WRITE_HI", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj1112 = { op: "WRITE_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1111 = { op: "READ_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1110 = { op: "READ_HI", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1109 = { op: "WRITE_HI", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1108 = { op: "READ_HI", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1107 = { op: "READ_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1106 = { op: "WRITE_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1105 = { op: "READ_HI", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1104 = { op: "WRITE_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1103 = { op: "WRITE_HI", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj1102 = { op: "READ_HI", instBit: 4, bitType: "OUTPUT", bitNo: 4, value: 0 };
        var obj1101 = { op: "WRITE_LO", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1100 = { op: "WRITE_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1099 = { op: "READ_LO", instBit: 6, bitType: "OUTPUT", bitNo: 6, value: 0 };
        var obj1098 = { op: "READ_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1097 = { op: "WRITE_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1096 = { op: "WRITE_HI", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj1095 = { op: "READ_LO", instBit: 2, bitType: "OUTPUT", bitNo: 2, value: 0 };
        var obj1094 = { op: "READ_HI", instBit: 1, bitType: "OUTPUT", bitNo: 1, value: 0 };
        var obj1093 = { op: "READ_LO", instBit: 0, bitType: "OUTPUT", bitNo: 0, value: 0 };
        var obj1092 = { op: "WRITE_HI", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1091 = { op: "WRITE_HI", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj1090 = { op: "WRITE_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1089 = { op: "WRITE_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1088 = { op: "WRITE_LO", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj1087 = { op: "READ_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1086 = { op: "WRITE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1085 = { op: "READ_HI", instBit: 7, bitType: "OUTPUT", bitNo: 7, value: 0 };
        var obj1084 = { op: "READ_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1083 = { op: "READ_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1082 = { op: "WRITE_LO", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj1081 = { op: "READ_LO", instBit: 5, bitType: "OUTPUT", bitNo: 5, value: 0 };
        var obj1080 = { op: "WRITEPAGE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1079 = { op: "WRITEPAGE", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1078 = { paged: false, size: 131072, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1077 = { op: "READ_HI", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1076 = { op: "WRITEPAGE", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1075 = { op: "READ_LO", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj1074 = { op: "WRITEPAGE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 1 };
        var obj1073 = { op: "WRITEPAGE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1072 = { paged: false, size: 270336, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1071 = { op: "READ_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1070 = { op: "WRITEPAGE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj1069 = { op: "READ_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj1068 = { op: "READ_HI", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj1067 = { paged: false, size: 139264, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1066 = { op: "WRITEPAGE", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1065 = { op: "WRITEPAGE", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1064 = { op: "READ_LO", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1063 = { op: "READ_LO", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj1062 = { op: "WRITE_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1061 = { paged: false, size: 69632, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1060 = { paged: false, size: 2048, page_size: 32, readback: obj1591, memops: obj1594 };
        var obj1059 = { op: "WRITEPAGE", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj1058 = { op: "READ_LO", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj1057 = { op: "WRITE_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj1056 = { op: "WRITE_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj1055 = { op: "WRITEPAGE", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1054 = { op: "READ_HI", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj1053 = { paged: false, size: 20480, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1052 = { paged: false, size: 262144, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1051 = { paged: false, size: 32768, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1050 = { op: "WRITEPAGE", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj1049 = { paged: false, size: 16384, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1048 = { paged: false, size: 4096, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1047 = { op: "READ_HI", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj1046 = { paged: false, size: 36864, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1045 = { op: "WRITEPAGE", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1044 = { op: "WRITE_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1043 = { op: "WRITE_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj1042 = { paged: false, size: 10240, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1041 = { op: "WRITE_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1040 = { op: "WRITEPAGE", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj1039 = { paged: false, size: 204800, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1038 = { op: "WRITEPAGE", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1037 = { paged: false, size: 4096, page_size: 32, readback: obj1591, memops: obj1594 };
        var obj1036 = { op: "READ_LO", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1035 = { op: "WRITE_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj1034 = { op: "READ_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj1033 = { paged: false, size: 256, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1032 = { op: "WRITEPAGE", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1031 = { paged: false, size: 1, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj1030 = { paged: false, size: 2048, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1029 = { op: "READ_HI", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj1028 = { op: "WRITEPAGE", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1027 = { op: "READ_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj1026 = { paged: false, size: 8192, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1025 = { paged: false, size: 36864, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1024 = { op: "READ_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj1023 = { op: "WRITEPAGE", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj1022 = { op: "READ_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj1021 = { paged: false, size: 196608, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1020 = { op: "WRITE_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj1019 = { op: "WRITEPAGE", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj1018 = { op: "WRITEPAGE", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj1017 = { op: "WRITEPAGE", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj1016 = { op: "READ_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj1015 = { op: "WRITE_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj1014 = { paged: false, size: 16384, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj1013 = { op: "WRITEPAGE", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj1012 = { op: "WRITEPAGE", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj1011 = { op: "READ_HI", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj1010 = { paged: false, size: 4096, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1009 = { op: "READ_LO", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj1008 = { paged: false, size: 512, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1007 = { op: "READ_HI", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj1006 = { paged: false, size: 401408, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj1005 = { op: "WRITEPAGE", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj1004 = { op: "WRITEPAGE", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj1003 = { paged: false, size: 8192, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj1002 = { op: "WRITE_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj1001 = { op: "READ_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj1000 = { paged: false, size: 65536, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj999 = { paged: false, size: 8192, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj998 = { op: "READ_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj997 = { op: "READ_HI", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj996 = { paged: false, size: 128, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj995 = { paged: false, size: 393216, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj994 = { op: "WRITE_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj993 = { op: "WRITEPAGE", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj992 = { paged: false, size: 1024, page_size: 32, readback: obj1591, memops: obj1594 };
        var obj991 = { op: "WRITEPAGE", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj990 = { op: "WRITE_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj989 = { paged: false, size: 131072, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj988 = { op: "WRITEPAGE", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj987 = { op: "WRITEPAGE", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj986 = { op: "READ_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj985 = { paged: false, size: 139264, page_size: 512, readback: obj1591, memops: obj1594 };
        var obj984 = { op: "READ_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj983 = { op: "READ_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj982 = { op: "WRITEPAGE", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj981 = { op: "WRITEPAGE", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj980 = { op: "READ_LO", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj979 = { paged: false, size: 50, page_size: 50, readback: obj1591, memops: obj1594 };
        var obj978 = { op: "WRITE_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj977 = { op: "WRITEPAGE", instBit: 8, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj976 = { paged: false, size: 20480, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj975 = { op: "READ_HI", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj974 = { paged: false, size: 4096, page_size: 256, readback: obj1591, memops: obj1594 };
        var obj973 = { paged: false, size: 32768, page_size: 128, readback: obj1591, memops: obj1594 };
        var obj972 = { op: "READ_LO", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj971 = { op: "READ_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj970 = { paged: false, size: 512, page_size: 32, readback: obj1591, memops: obj1594 };
        var obj969 = { op: "READ_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj968 = { paged: false, size: 3, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj967 = { op: "WRITE_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj966 = { op: "WRITEPAGE", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj965 = { op: "READ_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj964 = { op: "WRITE_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj963 = { op: "WRITE_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj962 = { op: "WRITEPAGE", instBit: 11, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj961 = { op: "WRITEPAGE", instBit: 9, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj960 = { op: "WRITEPAGE", instBit: 2, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj959 = { op: "WRITEPAGE", instBit: 5, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj958 = { op: "WRITEPAGE", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj957 = { op: "WRITEPAGE", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj956 = { op: "WRITE_LO", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj955 = { op: "WRITEPAGE", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj954 = { op: "WRITEPAGE", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj953 = { op: "WRITE_LO", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj952 = { op: "WRITE_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj951 = { op: "WRITE_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj950 = { op: "WRITEPAGE", instBit: 8, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj949 = { op: "WRITE_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj948 = { op: "WRITEPAGE", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj947 = { op: "WRITE_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj946 = { op: "WRITEPAGE", instBit: 6, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj945 = { op: "WRITE_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj944 = { op: "WRITE_HI", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj943 = { op: "WRITEPAGE", instBit: 4, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj942 = { op: "WRITEPAGE", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj941 = { op: "WRITE_HI", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj940 = { op: "WRITEPAGE", instBit: 1, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj939 = { op: "WRITE_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj938 = { op: "WRITEPAGE", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj937 = { op: "WRITEPAGE", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj936 = { op: "WRITEPAGE", instBit: 3, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj935 = { op: "WRITE_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj934 = { op: "WRITEPAGE", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj933 = { op: "WRITE_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj932 = { op: "WRITE_HI", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj931 = { op: "WRITE_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj930 = { op: "WRITE_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj929 = { op: "WRITEPAGE", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj928 = { op: "WRITE_LO", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj927 = { op: "WRITE_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj926 = { op: "WRITEPAGE", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj925 = { op: "WRITE_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj924 = { op: "WRITEPAGE", instBit: 10, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj923 = { op: "WRITE_HI", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj922 = { op: "WRITEPAGE", instBit: 0, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj921 = { op: "WRITE_LO", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj920 = { op: "WRITE_HI", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj919 = { op: "WRITE_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj918 = { op: "WRITEPAGE", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj917 = { op: "WRITEPAGE", instBit: 7, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj916 = { op: "WRITEPAGE", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj915 = { op: "LOADPAGE_HI", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj914 = { op: "LOADPAGE_LO", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj913 = { op: "LOADPAGE_LO", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj912 = { op: "LOADPAGE_LO", instBit: 2, bitType: "INPUT", bitNo: 2, value: 0 };
        var obj911 = { op: "LOADPAGE_LO", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj910 = { op: "WRITEPAGE", instBit: 19, bitType: "ADDRESS", bitNo: 11, value: 0 };
        var obj909 = { op: "WRITEPAGE", instBit: 23, bitType: "ADDRESS", bitNo: 15, value: 0 };
        var obj908 = { op: "LOADPAGE_LO", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj907 = { op: "LOADPAGE_LO", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj906 = { op: "LOADPAGE_LO", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj905 = { op: "WRITEPAGE", instBit: 21, bitType: "ADDRESS", bitNo: 13, value: 0 };
        var obj904 = { op: "LOADPAGE_LO", instBit: 27, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj903 = { op: "LOADPAGE_LO", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj902 = { op: "LOADPAGE_HI", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj901 = { op: "LOADPAGE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj900 = { op: "LOADPAGE_HI", instBit: 5, bitType: "INPUT", bitNo: 5, value: 0 };
        var obj899 = { op: "WRITEPAGE", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj898 = { op: "LOADPAGE_LO", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj897 = { op: "WRITEPAGE", instBit: 16, bitType: "ADDRESS", bitNo: 8, value: 0 };
        var obj896 = { op: "LOADPAGE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj895 = { op: "LOADPAGE_LO", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj894 = { op: "LOADPAGE_LO", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj893 = { op: "WRITEPAGE", instBit: 18, bitType: "ADDRESS", bitNo: 10, value: 0 };
        var obj892 = { op: "LOADPAGE_HI", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj891 = { op: "LOADPAGE_LO", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj890 = { op: "LOADPAGE_HI", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj889 = { op: "LOADPAGE_LO", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj888 = { op: "LOADPAGE_HI", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj887 = { op: "LOADPAGE_HI", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj886 = { op: "LOADPAGE_LO", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj885 = { op: "LOADPAGE_HI", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj884 = { op: "LOADPAGE_LO", instBit: 0, bitType: "INPUT", bitNo: 0, value: 0 };
        var obj883 = { op: "LOADPAGE_LO", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj882 = { op: "WRITEPAGE", instBit: 17, bitType: "ADDRESS", bitNo: 9, value: 0 };
        var obj881 = { op: "WRITEPAGE", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj880 = { op: "LOADPAGE_LO", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj879 = { op: "WRITEPAGE", instBit: 22, bitType: "ADDRESS", bitNo: 14, value: 0 };
        var obj878 = { op: "LOADPAGE_HI", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj877 = { op: "LOADPAGE_HI", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj876 = { op: "LOADPAGE_HI", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj875 = { op: "LOADPAGE_LO", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj874 = { op: "LOADPAGE_LO", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj873 = { op: "LOADPAGE_HI", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj872 = { op: "LOADPAGE_HI", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj871 = { op: "LOADPAGE_LO", instBit: 31, bitType: "VALUE", bitNo: 7, value: 1 };
        var obj870 = { op: "WRITEPAGE", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj869 = { op: "LOADPAGE_HI", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj868 = { op: "LOADPAGE_LO", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj867 = { op: "LOADPAGE_LO", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj866 = { op: "LOADPAGE_LO", instBit: 6, bitType: "INPUT", bitNo: 6, value: 0 };
        var obj865 = { op: "WRITEPAGE", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj864 = { op: "LOADPAGE_HI", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj863 = { op: "LOADPAGE_LO", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj862 = { op: "LOADPAGE_HI", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj861 = { op: "LOADPAGE_LO", instBit: 26, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj860 = { op: "LOADPAGE_HI", instBit: 3, bitType: "INPUT", bitNo: 3, value: 0 };
        var obj859 = { op: "LOADPAGE_LO", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj858 = { op: "LOADPAGE_LO", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj857 = { op: "LOADPAGE_HI", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj856 = { op: "WRITEPAGE", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj855 = { op: "LOADPAGE_HI", instBit: 7, bitType: "INPUT", bitNo: 7, value: 0 };
        var obj854 = { op: "LOADPAGE_HI", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj853 = { op: "WRITEPAGE", instBit: 20, bitType: "ADDRESS", bitNo: 12, value: 0 };
        var obj852 = { op: "LOADPAGE_HI", instBit: 1, bitType: "INPUT", bitNo: 1, value: 0 };
        var obj851 = { op: "WRITEPAGE", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj850 = { op: "LOADPAGE_HI", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj849 = { op: "LOADPAGE_HI", instBit: 24, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj848 = { op: "WRITEPAGE", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj847 = { op: "LOADPAGE_LO", instBit: 4, bitType: "INPUT", bitNo: 4, value: 0 };
        var obj846 = { op: "LOADPAGE_HI", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj845 = { op: "LOADPAGE_LO", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj844 = { op: "LOADPAGE_LO", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj843 = { op: "LOADPAGE_LO", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj842 = { op: "LOADPAGE_HI", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj841 = { op: "LOADPAGE_LO", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj840 = { op: "LOADPAGE_HI", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj839 = { op: "LOADPAGE_HI", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj838 = { op: "LOADPAGE_HI", instBit: 13, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj837 = { op: "LOADPAGE_HI", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj836 = { op: "LOADPAGE_LO", instBit: 23, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj835 = { op: "LOADPAGE_LO", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj834 = { op: "LOADPAGE_LO", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj833 = { op: "LOADPAGE_HI", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj832 = { op: "LOADPAGE_HI", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj831 = { op: "LOADPAGE_HI", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj830 = { op: "LOADPAGE_HI", instBit: 16, bitType: "IGNORE", bitNo: 0, value: 0 };
        var obj829 = { op: "LOADPAGE_LO", instBit: 20, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj828 = { op: "LOADPAGE_LO", instBit: 14, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj827 = { op: "LOADPAGE_LO", instBit: 21, bitType: "IGNORE", bitNo: 5, value: 0 };
        var obj826 = { op: "LOADPAGE_HI", instBit: 17, bitType: "IGNORE", bitNo: 1, value: 0 };
        var obj825 = { op: "LOADPAGE_HI", instBit: 22, bitType: "IGNORE", bitNo: 6, value: 0 };
        var obj824 = { op: "LOADPAGE_HI", instBit: 12, bitType: "IGNORE", bitNo: 4, value: 0 };
        var obj823 = { op: "LOADPAGE_LO", instBit: 18, bitType: "IGNORE", bitNo: 2, value: 0 };
        var obj822 = { op: "LOADPAGE_LO", instBit: 15, bitType: "IGNORE", bitNo: 7, value: 0 };
        var obj821 = { op: "LOADPAGE_LO", instBit: 19, bitType: "IGNORE", bitNo: 3, value: 0 };
        var obj820 = { op: "LOAD_EXT_ADDR", instBit: 18, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj819 = { op: "LOADPAGE_LO", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj818 = { op: "LOADPAGE_HI", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj817 = { op: "LOAD_EXT_ADDR", instBit: 13, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj816 = { op: "LOAD_EXT_ADDR", instBit: 5, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj815 = { op: "LOADPAGE_HI", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj814 = { op: "LOAD_EXT_ADDR", instBit: 24, bitType: "VALUE", bitNo: 0, value: 1 };
        var obj813 = { op: "LOAD_EXT_ADDR", instBit: 31, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj812 = { op: "LOAD_EXT_ADDR", instBit: 11, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj811 = { op: "LOAD_EXT_ADDR", instBit: 26, bitType: "VALUE", bitNo: 2, value: 1 };
        var obj810 = { op: "LOADPAGE_HI", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj809 = { op: "LOAD_EXT_ADDR", instBit: 17, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj808 = { op: "LOADPAGE_LO", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj807 = { op: "LOAD_EXT_ADDR", instBit: 12, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj806 = { op: "LOAD_EXT_ADDR", instBit: 9, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj805 = { op: "LOAD_EXT_ADDR", instBit: 27, bitType: "VALUE", bitNo: 3, value: 1 };
        var obj804 = { op: "LOAD_EXT_ADDR", instBit: 29, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj803 = { op: "LOADPAGE_LO", instBit: 10, bitType: "ADDRESS", bitNo: 2, value: 0 };
        var obj802 = { op: "LOADPAGE_LO", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj801 = { op: "LOAD_EXT_ADDR", instBit: 16, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj800 = { op: "LOADPAGE_LO", instBit: 11, bitType: "ADDRESS", bitNo: 3, value: 0 };
        var obj799 = { op: "LOADPAGE_HI", instBit: 9, bitType: "ADDRESS", bitNo: 1, value: 0 };
        var obj798 = { op: "LOADPAGE_LO", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj797 = { op: "LOAD_EXT_ADDR", instBit: 15, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj796 = { op: "LOAD_EXT_ADDR", instBit: 10, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj795 = { op: "LOADPAGE_HI", instBit: 8, bitType: "ADDRESS", bitNo: 0, value: 0 };
        var obj794 = { op: "LOAD_EXT_ADDR", instBit: 19, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj793 = { op: "LOAD_EXT_ADDR", instBit: 14, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj792 = { op: "LOAD_EXT_ADDR", instBit: 20, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj791 = { op: "LOAD_EXT_ADDR", instBit: 3, bitType: "VALUE", bitNo: 3, value: 0 };
        var obj790 = { op: "LOADPAGE_LO", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj789 = { op: "LOADPAGE_HI", instBit: 12, bitType: "ADDRESS", bitNo: 4, value: 0 };
        var obj788 = { op: "LOAD_EXT_ADDR", instBit: 23, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj787 = { op: "LOADPAGE_HI", instBit: 14, bitType: "ADDRESS", bitNo: 6, value: 0 };
        var obj786 = { op: "LOAD_EXT_ADDR", instBit: 4, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj785 = { op: "LOAD_EXT_ADDR", instBit: 28, bitType: "VALUE", bitNo: 4, value: 0 };
        var obj784 = { op: "LOAD_EXT_ADDR", instBit: 2, bitType: "VALUE", bitNo: 2, value: 0 };
        var obj783 = { op: "LOAD_EXT_ADDR", instBit: 0, bitType: "VALUE", bitNo: 0, value: 0 };
        var obj782 = { op: "LOAD_EXT_ADDR", instBit: 25, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj781 = { op: "LOAD_EXT_ADDR", instBit: 6, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj780 = { op: "LOAD_EXT_ADDR", instBit: 21, bitType: "VALUE", bitNo: 5, value: 0 };
        var obj779 = { op: "LOADPAGE_LO", instBit: 13, bitType: "ADDRESS", bitNo: 5, value: 0 };
        var obj778 = { op: "LOAD_EXT_ADDR", instBit: 7, bitType: "VALUE", bitNo: 7, value: 0 };
        var obj777 = { op: "LOAD_EXT_ADDR", instBit: 30, bitType: "VALUE", bitNo: 6, value: 1 };
        var obj776 = { op: "LOADPAGE_HI", instBit: 15, bitType: "ADDRESS", bitNo: 7, value: 0 };
        var obj775 = { op: "LOAD_EXT_ADDR", instBit: 1, bitType: "VALUE", bitNo: 1, value: 0 };
        var obj774 = { op: "LOAD_EXT_ADDR", instBit: 22, bitType: "VALUE", bitNo: 6, value: 0 };
        var obj773 = { op: "LOAD_EXT_ADDR", instBit: 8, bitType: "ADDRESS", bitNo: 16, value: 0 };
        var obj772 = { delay: 3, blocksize: 128, paged: false, size: 1024, readback: obj1591, memops: obj1594 };
        var obj771 = { delay: 5, blocksize: 64, paged: false, size: 64, readback: obj1591, memops: obj1594 };
        var obj770 = { blocksize: 128, paged: false, size: 1024, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj769 = { blocksize: 128, paged: false, size: 4096, page_size: 64, readback: obj1591, memops: obj1594 };
        var obj768 = { blocksize: 128, paged: false, size: 2048, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj767 = { blocksize: 4, paged: false, size: 1, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj766 = { blocksize: 128, paged: false, size: 512, page_size: 16, readback: obj1591, memops: obj1594 };
        var obj765 = { paged: true, size: 524288, page_size: 512, num_pages: 1024, readback: obj1591, memops: obj1594 };
        var obj764 = { flash: obj765 };
        var obj763 = { blocksize: 128, paged: true, size: 40960, page_size: 128, num_pages: 320, readback: obj1591, memops: obj1594 };
        var obj762 = { blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, readback: obj1591, memops: obj1594 };
        var obj761 = { signature: obj968, fuse: obj767, calibration: obj1031, lockbits: obj1031 };
        var obj760 = { signature: obj968, fuse: obj767, calibration: obj1031, lockbits: obj1031, flash: obj770 };
        var obj759 = { signature: obj968, fuse: obj767, calibration: obj1031, lockbits: obj1031, flash: obj766 };
        var obj758 = { signature: obj968, fuse: obj767, calibration: obj1031, lockbits: obj1031, flash: obj769 };
        var obj757 = { signature: obj968, fuse: obj767, calibration: obj1031, lockbits: obj1031, flash: obj768 };
        var obj756 = { eeprom: obj771, flash: obj772, signature: obj1449, lock: obj1450, calibration: obj1450, fuse: obj1450 };
        var obj755 = { eeprom: obj762, flash: obj763, hfuse: obj1450, lfuse: obj1450, lockbits: obj1450, signature: obj1449 };
        var obj754 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451 };
        var obj753 = { AVRPart: "AT32UC3A0512", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1500, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: true, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj764 };
        var obj752 = { AVRPart: "deprecated, use 'uc3a0512'", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1500, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: true, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj764 };
        var obj751 = { AVRPart: "Common values for reduced core tinys", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj761 };
        var obj750 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1037, application: obj995, apptable: obj1026, boot: obj1026, flash: obj1006, usersig: obj1008 };
        var obj749 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1078, apptable: obj1026, boot: obj1026, flash: obj985, usersig: obj1008 };
        var obj748 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj992, application: obj1049, apptable: obj974, boot: obj974, flash: obj976, usersig: obj1033 };
        var obj747 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj970, application: obj999, apptable: obj1030, boot: obj1030, flash: obj1042, usersig: obj996 };
        var obj746 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj992, application: obj973, apptable: obj1048, boot: obj1048, flash: obj1025, usersig: obj996 };
        var obj745 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj992, application: obj1051, apptable: obj974, boot: obj974, flash: obj1046, usersig: obj1033 };
        var obj744 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj970, application: obj1014, apptable: obj1048, boot: obj1048, flash: obj1053, usersig: obj996 };
        var obj743 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1000, apptable: obj974, boot: obj974, flash: obj1061, usersig: obj1033 };
        var obj742 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj989, apptable: obj974, boot: obj1003, flash: obj1067, usersig: obj1033 };
        var obj741 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1037, application: obj1052, apptable: obj1026, boot: obj1026, flash: obj1072, usersig: obj1008 };
        var obj740 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1021, apptable: obj1026, boot: obj1026, flash: obj1039, usersig: obj1008 };
        var obj739 = { AVRPart: "ATtiny9", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1553, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj760 };
        var obj738 = { AVRPart: "ATtiny5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1511, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj759 };
        var obj737 = { AVRPart: "ATtiny4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1545, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj759 };
        var obj736 = { AVRPart: "ATtiny10", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1523, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj760 };
        var obj735 = { AVRPart: "ATtiny20", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1577, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj757 };
        var obj734 = { AVRPart: "ATtiny40", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1536, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: true, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj758 };
        var obj733 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1037, application: obj1052, apptable: obj1026, boot: obj1026, flash: obj1072, usersig: obj1008, fuse0: obj1450 };
        var obj732 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1078, apptable: obj1010, boot: obj1026, flash: obj985, usersig: obj1008, fuse0: obj1450 };
        var obj731 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj992, application: obj1049, apptable: obj974, boot: obj974, flash: obj976, usersig: obj1033, fuse0: obj1450 };
        var obj730 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1000, apptable: obj974, boot: obj974, flash: obj1061, usersig: obj1033, fuse0: obj1450 };
        var obj729 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1021, apptable: obj1026, boot: obj1026, flash: obj1039, usersig: obj1008, fuse0: obj1450 };
        var obj728 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj989, apptable: obj1003, boot: obj1003, flash: obj1067, usersig: obj1033, fuse0: obj1450 };
        var obj727 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj992, application: obj1051, apptable: obj974, boot: obj974, flash: obj1046, usersig: obj1033, fuse0: obj1450 };
        var obj726 = { signature: obj1449, prodsig: obj979, fuse1: obj1450, fuse2: obj1450, fuse4: obj1450, fuse5: obj1450, lock: obj1450, data: obj1451, eeprom: obj1060, application: obj1078, apptable: obj1026, boot: obj1026, flash: obj985, usersig: obj1008, fuse0: obj1450 };
        var obj725 = { AVRPart: "ATtiny11", chipEraseDelay: 2e4, stk500_devcode: 17, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1567, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj756 };
        var obj724 = { AVRPart: "ATMEGA406", stk500_devcode: 0, pagel: 167, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1568, usbpid: 0, serialProgramMode: false, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 81, rampz: 0, spmcr: 87, eecr: 63, ocdrev: -1, ops: obj1595, memory: obj755 };
        var obj723 = { AVRPart: "AVR XMEGA family common values", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1495, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj754 };
        var obj722 = { AVRPart: "ATxmega8E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1461, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj747 };
        var obj721 = { AVRPart: "ATxmega32E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1467, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj746 };
        var obj720 = { AVRPart: "ATxmega16E5", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1468, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj744 };
        var obj719 = { AVRPart: "ATxmega192C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1478, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj740 };
        var obj718 = { AVRPart: "ATxmega192D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1479, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj740 };
        var obj717 = { AVRPart: "ATxmega32C4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1465, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj745 };
        var obj716 = { AVRPart: "ATxmega32D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1502, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj745 };
        var obj715 = { AVRPart: "ATxmega64D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1452, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj743 };
        var obj714 = { AVRPart: "ATxmega64D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1490, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj743 };
        var obj713 = { AVRPart: "ATxmega64C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1483, usbpid: 12246, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj743 };
        var obj712 = { AVRPart: "ATxmega16D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1507, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj748 };
        var obj711 = { AVRPart: "ATxmega16C4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1491, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj748 };
        var obj710 = { AVRPart: "ATxmega384C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1506, usbpid: 12251, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj750 };
        var obj709 = { AVRPart: "ATxmega32A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1485, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj745 };
        var obj708 = { AVRPart: "ATxmega384D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1505, usbpid: 12251, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj750 };
        var obj707 = { AVRPart: "ATxmega128D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1481, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj749 };
        var obj706 = { AVRPart: "ATxmega64A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1498, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj743 };
        var obj705 = { AVRPart: "ATxmega128C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1494, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj749 };
        var obj704 = { AVRPart: "ATxmega128D4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1457, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj749 };
        var obj703 = { AVRPart: "ATxmega16A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1466, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj748 };
        var obj702 = { AVRPart: "ATxmega256C3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1488, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj741 };
        var obj701 = { AVRPart: "ATxmega256D3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1454, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj741 };
        var obj700 = { AVRPart: "ATxmega128A4U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1458, usbpid: 12254, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj742 };
        var obj699 = { AVRPart: "ATxmega128A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1458, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj732 };
        var obj698 = { AVRPart: "ATxmega192A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1473, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj729 };
        var obj697 = { AVRPart: "ATxmega192A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1492, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj729 };
        var obj696 = { AVRPart: "ATxmega64B1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1482, usbpid: 12257, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj695 = { AVRPart: "ATxmega64A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1499, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj694 = { AVRPart: "ATxmega64B3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1480, usbpid: 12255, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj693 = { AVRPart: "ATxmega16A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1466, usbpid: 12259, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj731 };
        var obj692 = { AVRPart: "ATxmega64A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1474, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj691 = { AVRPart: "ATxmega32A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1485, usbpid: 12260, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj727 };
        var obj690 = { AVRPart: "ATxmega64A4", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1498, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj689 = { AVRPart: "ATxmega64A1U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1474, usbpid: 12264, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj688 = { AVRPart: "ATxmega256A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1464, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj733 };
        var obj687 = { AVRPart: "ATxmega128A3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1456, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj726 };
        var obj686 = { AVRPart: "ATxmega128A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1504, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj726 };
        var obj685 = { AVRPart: "ATxmega64A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1499, usbpid: 12261, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj730 };
        var obj684 = { AVRPart: "ATxmega128B1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1469, usbpid: 12266, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj728 };
        var obj683 = { AVRPart: "ATxmega256A1", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1488, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj733 };
        var obj682 = { AVRPart: "ATxmega128B3", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1462, usbpid: 12256, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj728 };
        var obj681 = { AVRPart: "ATxmega128A1U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1504, usbpid: 12269, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj726 };
        var obj680 = { AVRPart: "ATxmega128A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1456, usbpid: 12262, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj726 };
        var obj679 = { AVRPart: "ATxmega256A3B", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1493, usbpid: 12250, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj733 };
        var obj678 = { AVRPart: "ATxmega192A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1492, usbpid: 12263, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj729 };
        var obj677 = { AVRPart: "ATxmega256A3U", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1464, usbpid: 12268, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj733 };
        var obj676 = { AVRPart: "ATxmega256A3BU", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1493, usbpid: 12258, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj733 };
        var obj675 = { AVRPart: "ATxmega128A1revD", stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1476, usbpid: 12247, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: true, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj1595, memory: obj726 };
        var obj674 = [obj1395, obj1388, obj1421, obj1402, obj1427, obj1425, obj1386, obj1443, obj1410, obj1404, obj1423, obj1400, obj1440, obj1417, obj1434, obj1409, obj1416, obj1387, obj1401, obj1413, obj1403, obj1432, obj1429, obj1394, obj1431, obj1391, obj1419, obj1390, obj1439, obj1438, obj1441, obj1405];
        var obj673 = [obj1407, obj1446, obj1428, obj1418, obj1444, obj1398, obj1445, obj1393, obj1397, obj1442, obj1424, obj1422, obj1430, obj1448, obj1389, obj1385, obj1437, obj1412, obj1415, obj1411, obj1426, obj1435, obj1392, obj1396, obj1433, obj1399, obj1406, obj1408, obj1420, obj1447, obj1436, obj1414];
        var obj672 = [obj1407, obj1446, obj1428, obj1418, obj1444, obj1398, obj1445, obj1393, obj1397, obj1442, obj1424, obj1422, obj1430, obj1448, obj1389, obj1385, obj1357, obj1378, obj1375, obj1352, obj1362, obj1351, obj1372, obj1368, obj1367, obj1365, obj1349, obj1382, obj1373, obj1360, obj1350, obj1358];
        var obj671 = [obj1395, obj1388, obj1421, obj1402, obj1427, obj1425, obj1386, obj1443, obj1410, obj1404, obj1423, obj1400, obj1440, obj1417, obj1434, obj1409, obj1376, obj1374, obj1354, obj1359, obj1384, obj1380, obj1361, obj1348, obj1379, obj1363, obj1364, obj1371, obj1356, obj1366, obj1383, obj1369];
        var obj670 = [obj1407, obj1446, obj1428, obj1418, obj1444, obj1398, obj1445, obj1393, obj1397, obj1442, obj1424, obj1353, obj1377, obj1355, obj1381, obj1370, obj1357, obj1378, obj1375, obj1352, obj1362, obj1351, obj1372, obj1368, obj1367, obj1365, obj1349, obj1382, obj1373, obj1360, obj1350, obj1358];
        var obj669 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj668 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj667 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj666 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj665 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj664 = [obj1327, obj1339, obj1321, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj663 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj662 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj661 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1333, obj1264, obj1241, obj1294];
        var obj660 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1338, obj1297, obj1312, obj1268, obj1270, obj1244, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj659 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj658 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj657 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj656 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1315, obj1298, obj1294];
        var obj655 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj654 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1254, obj1266, obj1231, obj1264, obj1241, obj1294];
        var obj653 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj652 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1264, obj1241, obj1294];
        var obj651 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1315, obj1241, obj1294];
        var obj650 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1341, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj649 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1346, obj1347, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj648 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj647 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj646 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj645 = [obj1327, obj1339, obj1321, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj644 = [obj1327, obj1339, obj1321, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1323, obj1329, obj1338, obj1335, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj643 = [obj1327, obj1339, obj1321, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj642 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1337, obj1336, obj1234, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj641 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1279, obj1266, obj1231, obj1342, obj1241, obj1294];
        var obj640 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1315, obj1241, obj1294];
        var obj639 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1264, obj1241, obj1295];
        var obj638 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1254, obj1266, obj1267, obj1315, obj1298, obj1294];
        var obj637 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1244, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj636 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1326, obj1317, obj1194, obj1202, obj1211, obj1222, obj1206, obj1251, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1295];
        var obj635 = [obj1327, obj1339, obj1321, obj1343, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj634 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj633 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1262, obj1267, obj1315, obj1241, obj1294];
        var obj632 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1279, obj1266, obj1267, obj1315, obj1298, obj1294];
        var obj631 = [obj1327, obj1328, obj1316, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1270, obj1293, obj1254, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj630 = [obj1327, obj1328, obj1316, obj1343, obj1324, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1312, obj1268, obj1236, obj1293, obj1254, obj1266, obj1267, obj1315, obj1298, obj1295];
        var obj629 = { READ: obj666 };
        var obj628 = [obj1327, obj1339, obj1321, obj1343, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1263, obj1265, obj1281, obj1297, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj627 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj626 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj625 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1345, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj624 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1237, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj623 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1332, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj622 = { READ: obj664 };
        var obj621 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1238, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj620 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1283, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj619 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1259, obj1238, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj618 = { READ: obj663 };
        var obj617 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1259, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj616 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1234, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj615 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1284, obj1303, obj1230, obj1304, obj1256, obj1314, obj1232, obj1308, obj1252, obj1271, obj1247, obj1310, obj1311, obj1287, obj1243, obj1245];
        var obj614 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1285, obj1274, obj1248, obj1284, obj1303, obj1230, obj1304, obj1256, obj1314, obj1232, obj1308, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj613 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1286, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj612 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1240, obj1285, obj1274, obj1248, obj1284, obj1303, obj1230, obj1304, obj1256, obj1314, obj1232, obj1308, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj611 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1320, obj1207, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj610 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1237, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj609 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1259, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj608 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1261, obj1296, obj1285, obj1274, obj1248, obj1284, obj1303, obj1230, obj1304, obj1256, obj1314, obj1232, obj1308, obj1252, obj1271, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj607 = { READ: obj662 };
        var obj606 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1318, obj1299, obj1207, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj605 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1286, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj604 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1238, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj603 = { READ: obj659 };
        var obj602 = { READ: obj649 };
        var obj601 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1259, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj600 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1344, obj1330, obj1306, obj1299, obj1207, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj599 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1286, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj598 = { READ: obj647 };
        var obj597 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1299, obj1207, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj596 = { READ: obj646 };
        var obj595 = [obj1334, obj1339, obj1321, obj1319, obj1331, obj1325, obj1340, obj1322, obj1276, obj1233, obj1306, obj1224, obj1207, obj1201, obj1212, obj1193, obj1210, obj1204, obj1197, obj1200, obj1226, obj1199, obj1214, obj1213, obj1236, obj1293, obj1279, obj1262, obj1231, obj1264, obj1241, obj1294];
        var obj594 = { READ: obj644 };
        var obj593 = { READ: obj645 };
        var obj592 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj591 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1285, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1247, obj1310, obj1229, obj1287, obj1243, obj1245];
        var obj590 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1240, obj1285, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1252, obj1271, obj1247, obj1310, obj1311, obj1287, obj1243, obj1245];
        var obj589 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1285, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj588 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1240, obj1285, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj587 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1252, obj1271, obj1247, obj1310, obj1311, obj1287, obj1243, obj1245];
        var obj586 = { READ: obj643 };
        var obj585 = { READ: obj635 };
        var obj584 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1240, obj1285, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj583 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj582 = { READ: obj628 };
        var obj581 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1229, obj1287, obj1243, obj1245];
        var obj580 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1252, obj1271, obj1247, obj1310, obj1311, obj1282, obj1243, obj1245];
        var obj579 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1287, obj1243, obj1245];
        var obj578 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1252, obj1273, obj1247, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj577 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1252, obj1271, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj576 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj575 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1260, obj1273, obj1305, obj1258, obj1311, obj1282, obj1243, obj1245];
        var obj574 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1243, obj1245];
        var obj573 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1261, obj1296, obj1250, obj1274, obj1248, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1245];
        var obj572 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1261, obj1296, obj1285, obj1274, obj1248, obj1221, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj571 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1246, obj1277, obj1288, obj1313, obj1242, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj570 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1302, obj1240, obj1288, obj1313, obj1292, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj569 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1302, obj1277, obj1250, obj1313, obj1242, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj568 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1302, obj1240, obj1250, obj1313, obj1242, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj567 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1278, obj1307, obj1302, obj1240, obj1250, obj1300, obj1242, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj566 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1191, obj1198, obj1284, obj1303, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj565 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj564 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1225, obj1187, obj1288, obj1313, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1190, obj1186];
        var obj563 = [obj1249, obj1290, obj1289, obj1235, obj1275, obj1255, obj1309, obj1291, obj1280, obj1253, obj1307, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1189, obj1205, obj1203, obj1196, obj1215, obj1208, obj1220, obj1209, obj1192, obj1217, obj1218, obj1188, obj1243, obj1245];
        var obj562 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1261, obj1296, obj1285, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj561 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj560 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1191, obj1198, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj559 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1261, obj1296, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj558 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1191, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj557 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1219, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj556 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1216, obj1191, obj1198, obj1221, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj555 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1227, obj1225, obj1187, obj1216, obj1191, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj554 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1216, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj553 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1187, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj552 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1261, obj1158, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj551 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1216, obj1191, obj1198, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj550 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1227, obj1225, obj1187, obj1216, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj549 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1216, obj1191, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj548 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1257, obj1225, obj1158, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj547 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1227, obj1225, obj1187, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj546 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1301, obj1278, obj1227, obj1225, obj1158, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj545 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1216, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj544 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1187, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj543 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1225, obj1158, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj542 = [obj1249, obj1269, obj1239, obj1235, obj1228, obj1272, obj1309, obj1291, obj1223, obj1195, obj1227, obj1143, obj1158, obj1173, obj1161, obj1178, obj1164, obj1156, obj1145, obj1150, obj1148, obj1182, obj1152, obj1162, obj1260, obj1273, obj1305, obj1258, obj1229, obj1287, obj1243, obj1245];
        var obj541 = { WRITE: obj577 };
        var obj540 = { WRITE: obj570 };
        var obj539 = { WRITE: obj564 };
        var obj538 = { paged: false, size: 1, readback: obj1591, memops: obj629 };
        var obj537 = { paged: false, size: 3, readback: obj1591, memops: obj622 };
        var obj536 = { paged: false, size: 1, readback: obj1591, memops: obj618 };
        var obj535 = { paged: false, size: 1, readback: obj1591, memops: obj607 };
        var obj534 = { paged: false, size: 2, readback: obj1591, memops: obj603 };
        var obj533 = { paged: false, size: 1, readback: obj1591, memops: obj603 };
        var obj532 = { paged: false, size: 1, readback: obj1591, memops: obj602 };
        var obj531 = { paged: false, size: 4, readback: obj1591, memops: obj598 };
        var obj530 = { paged: false, size: 4, readback: obj1591, memops: obj596 };
        var obj529 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1176, obj1160, obj1151, obj1165, obj1179, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj528 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1149, obj1163, obj1184, obj1183, obj1181, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj527 = { paged: false, size: 3, readback: obj1591, memops: obj594 };
        var obj526 = { paged: false, size: 4, readback: obj1591, memops: obj593 };
        var obj525 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1149, obj1163, obj1184, obj1183, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj524 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1176, obj1160, obj1151, obj1165, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj523 = { paged: false, size: 3, readback: obj1591, memops: obj586 };
        var obj522 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1149, obj1163, obj1184, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj521 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1176, obj1160, obj1151, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj520 = { paged: false, size: 3, readback: obj1591, memops: obj585 };
        var obj519 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1149, obj1163, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj518 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1176, obj1160, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj517 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj1084, obj1127, obj1123, obj1118, obj1116, obj1083, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj516 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj1140, obj1136, obj1098, obj1107, obj1111, obj1133, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj515 = { paged: false, size: 3, readback: obj1591, memops: obj582 };
        var obj514 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj1084, obj1127, obj1123, obj1118, obj1116, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj513 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1176, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj512 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj1140, obj1136, obj1098, obj1107, obj1111, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj511 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1149, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj510 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj1084, obj1127, obj1123, obj1118, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj509 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj1140, obj1136, obj1098, obj1107, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj508 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj1166, obj1011, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj507 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj1180, obj1075, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj506 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj1084, obj1127, obj1123, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj505 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj1140, obj1136, obj1098, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj504 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj1140, obj1136, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj503 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj1084, obj1127, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj502 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1174, obj975, obj1011, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj501 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1177, obj972, obj1075, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj500 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1087, obj972, obj1075, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj499 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1138, obj975, obj1011, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj498 = [obj1171, obj1154, obj1147, obj1167, obj1159, obj1146, obj1144, obj1185, obj1058, obj972, obj1075, obj1064, obj980, obj1036, obj1063, obj1009, obj1016, obj1022, obj969, obj986, obj983, obj998, obj1001, obj1024, obj1139, obj1099, obj1081, obj1121, obj1125, obj1095, obj1131, obj1093];
        var obj497 = [obj1170, obj1169, obj1157, obj1168, obj1153, obj1175, obj1172, obj1155, obj1054, obj975, obj1011, obj1007, obj1047, obj1029, obj997, obj1077, obj984, obj1071, obj1069, obj1068, obj1034, obj1027, obj965, obj971, obj1085, obj1110, obj1108, obj1102, obj1115, obj1132, obj1094, obj1105];
        var obj496 = [obj1119, obj1135, obj1090, obj1120, obj1130, obj1126, obj1089, obj1104, obj1020, obj1041, obj978, obj990, obj1056, obj1035, obj994, obj920, obj919, obj964, obj963, obj932, obj947, obj933, obj931, obj939, obj1141, obj1091, obj1142, obj1103, obj1113, obj1096, obj1109, obj1092];
        var obj495 = [obj1086, obj1106, obj1137, obj1097, obj1112, obj1100, obj1128, obj1114, obj1062, obj1002, obj1057, obj1043, obj967, obj1044, obj1015, obj956, obj925, obj951, obj952, obj949, obj935, obj945, obj927, obj930, obj1122, obj1124, obj1129, obj1117, obj1134, obj1101, obj1088, obj1082];
        var obj494 = [obj1086, obj1106, obj1137, obj1097, obj1112, obj1100, obj1128, obj1114, obj1062, obj1002, obj1057, obj1043, obj967, obj1044, obj928, obj956, obj925, obj951, obj952, obj949, obj935, obj945, obj927, obj930, obj1122, obj1124, obj1129, obj1117, obj1134, obj1101, obj1088, obj1082];
        var obj493 = [obj1119, obj1135, obj1090, obj1120, obj1130, obj1126, obj1089, obj1104, obj1020, obj1041, obj978, obj990, obj1056, obj1035, obj941, obj920, obj919, obj964, obj963, obj932, obj947, obj933, obj931, obj939, obj1141, obj1091, obj1142, obj1103, obj1113, obj1096, obj1109, obj1092];
        var obj492 = [obj1086, obj1106, obj1137, obj1097, obj1112, obj1100, obj1128, obj1114, obj1062, obj1002, obj1057, obj1043, obj967, obj953, obj928, obj956, obj925, obj951, obj952, obj949, obj935, obj945, obj927, obj930, obj1122, obj1124, obj1129, obj1117, obj1134, obj1101, obj1088, obj1082];
        var obj491 = [obj1119, obj1135, obj1090, obj1120, obj1130, obj1126, obj1089, obj1104, obj1020, obj1041, obj978, obj990, obj1056, obj944, obj941, obj920, obj919, obj964, obj963, obj932, obj947, obj933, obj931, obj939, obj1141, obj1091, obj1142, obj1103, obj1113, obj1096, obj1109, obj1092];
        var obj490 = [obj1086, obj1106, obj1137, obj1097, obj1112, obj1100, obj1128, obj1114, obj1062, obj1002, obj1057, obj1043, obj921, obj953, obj928, obj956, obj925, obj951, obj952, obj949, obj935, obj945, obj927, obj930, obj1122, obj1124, obj1129, obj1117, obj1134, obj1101, obj1088, obj1082];
        var obj489 = [obj1119, obj1135, obj1090, obj1120, obj1130, obj1126, obj1089, obj1104, obj1020, obj1041, obj978, obj990, obj923, obj944, obj941, obj920, obj919, obj964, obj963, obj932, obj947, obj933, obj931, obj939, obj1141, obj1091, obj1142, obj1103, obj1113, obj1096, obj1109, obj1092];
        var obj488 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj926, obj934, obj1040, obj1055, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj487 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj981, obj1079, obj991, obj966, obj1038, obj897, obj851, obj856, obj865, obj899, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj486 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj981, obj1079, obj991, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj1019, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj485 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj926, obj934, obj954, obj948, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj484 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj981, obj1079, obj991, obj966, obj882, obj897, obj851, obj856, obj865, obj899, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj483 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj981, obj1079, obj991, obj966, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj482 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj926, obj934, obj954, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj481 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj981, obj1079, obj991, obj893, obj882, obj897, obj851, obj856, obj865, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj480 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj926, obj934, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj479 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj1019, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj478 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj1019, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj477 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj926, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj476 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj981, obj1079, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj475 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj981, obj1079, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj474 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj1019, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj473 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj958, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj472 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj981, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj471 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj1019, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj470 = [obj1059, obj1005, obj1017, obj1050, obj1018, obj1080, obj1074, obj993, obj1066, obj1023, obj942, obj937, obj938, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj1004, obj977, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj469 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj1023, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj468 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj957, obj942, obj937, obj938, obj893, obj882, obj897, obj851, obj856, obj865, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj467 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj957, obj942, obj853, obj910, obj893, obj882, obj897, obj851, obj948, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj466 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj957, obj942, obj937, obj938, obj958, obj882, obj897, obj851, obj856, obj865, obj899, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj465 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj957, obj942, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj464 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj948, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj463 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj957, obj942, obj937, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj462 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj909, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj916, obj881, obj1045, obj1076, obj987, obj988, obj1065, obj1028, obj982, obj1012];
        var obj461 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj460 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj929, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj948, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj459 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj909, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj948, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj458 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj909, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj918, obj955, obj962, obj924, obj961, obj950, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj457 = [obj1073, obj1005, obj1017, obj1050, obj1070, obj1013, obj1032, obj993, obj1066, obj879, obj905, obj853, obj910, obj893, obj882, obj897, obj851, obj856, obj865, obj899, obj870, obj848, obj916, obj881, obj917, obj946, obj959, obj943, obj936, obj960, obj940, obj922];
        var obj456 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj541 };
        var obj455 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj541 };
        var obj454 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1591, memops: obj540 };
        var obj453 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj540 };
        var obj452 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj539 };
        var obj451 = [obj871, obj863, obj898, obj894, obj904, obj861, obj883, obj896, obj874, obj906, obj907, obj886, obj845, obj913, obj868, obj880, obj914, obj908, obj889, obj859, obj867, obj858, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj450 = [obj871, obj863, obj898, obj894, obj904, obj861, obj883, obj896, obj874, obj906, obj907, obj886, obj845, obj913, obj868, obj880, obj914, obj908, obj889, obj859, obj867, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj449 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj854, obj902, obj850, obj869, obj888, obj776, obj787, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj448 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj886, obj845, obj913, obj868, obj880, obj802, obj790, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj447 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj886, obj821, obj823, obj841, obj835, obj822, obj828, obj843, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj446 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj854, obj837, obj833, obj826, obj830, obj842, obj831, obj838, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj445 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj843, obj844, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj444 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj838, obj824, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj443 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj843, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj442 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj838, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj441 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj440 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj439 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj836, obj834, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj843, obj844, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj438 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj907, obj829, obj821, obj823, obj841, obj835, obj822, obj790, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj437 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj436 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj885, obj832, obj837, obj833, obj826, obj830, obj842, obj787, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj435 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj840, obj825, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj838, obj824, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj434 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj433 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj836, obj834, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj843, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj432 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj840, obj825, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj838, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj431 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj874, obj906, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj790, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj430 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj873, obj857, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj787, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj429 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj836, obj834, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj828, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj428 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj840, obj825, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj831, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj427 = [obj876, obj872, obj878, obj864, obj890, obj862, obj846, obj849, obj840, obj825, obj839, obj832, obj837, obj833, obj826, obj830, obj842, obj787, obj818, obj789, obj815, obj810, obj799, obj795, obj855, obj877, obj900, obj892, obj860, obj915, obj852, obj887];
        var obj426 = [obj901, obj863, obj898, obj894, obj904, obj861, obj883, obj895, obj836, obj834, obj827, obj829, obj821, obj823, obj841, obj835, obj822, obj790, obj779, obj798, obj800, obj803, obj819, obj808, obj891, obj866, obj903, obj847, obj875, obj912, obj911, obj884];
        var obj425 = [obj813, obj777, obj804, obj785, obj805, obj811, obj782, obj814, obj788, obj774, obj780, obj792, obj794, obj820, obj809, obj801, obj797, obj793, obj817, obj807, obj812, obj796, obj806, obj773, obj778, obj781, obj816, obj786, obj791, obj784, obj775, obj783];
        var obj424 = { CHIP_ERASE: obj673, PGM_ENABLE: obj674 };
        var obj423 = { CHIP_ERASE: obj672, PGM_ENABLE: obj671 };
        var obj422 = { CHIP_ERASE: obj670, PGM_ENABLE: obj671 };
        var obj421 = { READ: obj665, WRITE: obj612 };
        var obj420 = { READ: obj667, WRITE: obj615 };
        var obj419 = { READ: obj668, WRITE: obj614 };
        var obj418 = { READ: obj657, WRITE: obj608 };
        var obj417 = { READ: obj661, WRITE: obj590 };
        var obj416 = { READ: obj653, WRITE: obj588 };
        var obj415 = { READ: obj650, WRITE: obj587 };
        var obj414 = { READ: obj654, WRITE: obj591 };
        var obj413 = { READ: obj648, WRITE: obj589 };
        var obj412 = { READ: obj650, WRITE: obj592 };
        var obj411 = { READ: obj658, WRITE: obj583 };
        var obj410 = { READ: obj655, WRITE: obj584 };
        var obj409 = { READ: obj669, WRITE: obj563 };
        var obj408 = { READ: obj650, WRITE: obj581 };
        var obj407 = { READ: obj660, WRITE: obj577 };
        var obj406 = { READ: obj650, WRITE: obj579 };
        var obj405 = { READ: obj652, WRITE: obj579 };
        var obj404 = { READ: obj651, WRITE: obj580 };
        var obj403 = { READ: obj657, WRITE: obj577 };
        var obj402 = { READ: obj650, WRITE: obj574 };
        var obj401 = { READ: obj652, WRITE: obj573 };
        var obj400 = { READ: obj656, WRITE: obj573 };
        var obj399 = { READ: obj650, WRITE: obj573 };
        var obj398 = { READ: obj631, WRITE: obj578 };
        var obj397 = { READ: obj633, WRITE: obj575 };
        var obj396 = { READ: obj634, WRITE: obj576 };
        var obj395 = { READ: obj642, WRITE: obj572 };
        var obj394 = { READ: obj641, WRITE: obj569 };
        var obj393 = { READ: obj630, WRITE: obj570 };
        var obj392 = { READ: obj640, WRITE: obj568 };
        var obj391 = { READ: obj632, WRITE: obj570 };
        var obj390 = { READ: obj632, WRITE: obj567 };
        var obj389 = { READ: obj639, WRITE: obj570 };
        var obj388 = { READ: obj638, WRITE: obj567 };
        var obj387 = { READ: obj637, WRITE: obj571 };
        var obj386 = { READ: obj620, WRITE: obj557 };
        var obj385 = { READ: obj619, WRITE: obj555 };
        var obj384 = { READ: obj616, WRITE: obj556 };
        var obj383 = { READ: obj610, WRITE: obj551 };
        var obj382 = { READ: obj604, WRITE: obj549 };
        var obj381 = { READ: obj597, WRITE: obj543 };
        var obj380 = { paged: false, size: 1, readback: obj1591, memops: obj408 };
        var obj379 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj419 };
        var obj378 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj420 };
        var obj377 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj421 };
        var obj376 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj418 };
        var obj375 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj417 };
        var obj374 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1591, memops: obj416 };
        var obj373 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj414 };
        var obj372 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj416 };
        var obj371 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1591, memops: obj415 };
        var obj370 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj413 };
        var obj369 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj412 };
        var obj368 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj415 };
        var obj367 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj416 };
        var obj366 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj413 };
        var obj365 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj416 };
        var obj364 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1591, memops: obj413 };
        var obj363 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj413 };
        var obj362 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj409 };
        var obj361 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj410 };
        var obj360 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj411 };
        var obj359 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj408 };
        var obj358 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj407 };
        var obj357 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj404 };
        var obj356 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj406 };
        var obj355 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj403 };
        var obj354 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj406 };
        var obj353 = { paged: false, size: 1, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1591, memops: obj403 };
        var obj352 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj405 };
        var obj351 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj403 };
        var obj350 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj403 };
        var obj349 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj402 };
        var obj348 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj399 };
        var obj347 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj400 };
        var obj346 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj401 };
        var obj345 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj399 };
        var obj344 = { paged: false, size: 1, min_write_delay: 2e3, max_write_delay: 2e3, readback: obj1591, memops: obj398 };
        var obj343 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj397 };
        var obj342 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj396 };
        var obj341 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj394 };
        var obj340 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1591, memops: obj387 };
        var obj339 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1591, memops: obj389 };
        var obj338 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1591, memops: obj391 };
        var obj337 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj389 };
        var obj336 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj388 };
        var obj335 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj393 };
        var obj334 = { paged: false, size: 1, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj392 };
        var obj333 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj392 };
        var obj332 = { paged: false, size: 1, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1591, memops: obj390 };
        var obj331 = { paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1589, memops: obj383 };
        var obj330 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1589, memops: obj395 };
        var obj329 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 64, min_write_delay: 8200, max_write_delay: 8200, readback: obj1593, memops: obj386 };
        var obj328 = { mode: 4, delay: 20, blocksize: 32, paged: false, size: 64, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1589, memops: obj386 };
        var obj327 = { mode: 4, delay: 8, blocksize: 64, paged: false, size: 64, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1593, memops: obj386 };
        var obj326 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj384 };
        var obj325 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 128, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1590, memops: obj384 };
        var obj324 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 128, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1589, memops: obj384 };
        var obj323 = { mode: 4, delay: 20, blocksize: 128, paged: false, size: 512, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj385 };
        var obj322 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1589, memops: obj383 };
        var obj321 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 256, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1590, memops: obj382 };
        var obj320 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1593, memops: obj382 };
        var obj319 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 512, min_write_delay: 3400, max_write_delay: 3400, readback: obj1593, memops: obj382 };
        var obj318 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 512, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1590, memops: obj382 };
        var obj317 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 512, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1589, memops: obj382 };
        var obj316 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1590, memops: obj381 };
        var obj315 = { mode: 4, delay: 20, blocksize: 128, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj385 };
        var obj314 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj381 };
        var obj313 = { mode: 4, delay: 20, blocksize: 64, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj381 };
        var obj312 = { READ: obj636, WRITE: obj566, LOADPAGE_LO: obj451, WRITEPAGE: obj488 };
        var obj311 = { READ: obj627, WRITE: obj565, LOADPAGE_LO: obj451, WRITEPAGE: obj485 };
        var obj310 = { READ: obj625, WRITE: obj562, LOADPAGE_LO: obj451, WRITEPAGE: obj483 };
        var obj309 = { READ: obj626, WRITE: obj561, LOADPAGE_LO: obj451, WRITEPAGE: obj482 };
        var obj308 = { READ: obj624, WRITE: obj560, LOADPAGE_LO: obj451, WRITEPAGE: obj482 };
        var obj307 = { READ: obj624, WRITE: obj560, LOADPAGE_LO: obj451, WRITEPAGE: obj480 };
        var obj306 = { READ: obj621, WRITE: obj558, LOADPAGE_LO: obj451, WRITEPAGE: obj482 };
        var obj305 = { READ: obj621, WRITE: obj558, LOADPAGE_LO: obj451, WRITEPAGE: obj480 };
        var obj304 = { READ: obj623, WRITE: obj559, LOADPAGE_LO: obj450, WRITEPAGE: obj486 };
        var obj303 = { READ: obj621, WRITE: obj558, LOADPAGE_LO: obj451, WRITEPAGE: obj477 };
        var obj302 = { READ: obj616, WRITE: obj556, LOADPAGE_LO: obj451, WRITEPAGE: obj482 };
        var obj301 = { READ: obj617, WRITE: obj554, LOADPAGE_LO: obj450, WRITEPAGE: obj479 };
        var obj300 = { READ: obj617, WRITE: obj554, LOADPAGE_LO: obj451, WRITEPAGE: obj473 };
        var obj299 = { READ: obj610, WRITE: obj551, LOADPAGE_LO: obj451, WRITEPAGE: obj480 };
        var obj298 = { READ: obj609, WRITE: obj550, LOADPAGE_LO: obj451, WRITEPAGE: obj473 };
        var obj297 = { READ: obj611, WRITE: obj552, LOADPAGE_LO: obj451, WRITEPAGE: obj475 };
        var obj296 = { READ: obj604, WRITE: obj549, LOADPAGE_LO: obj451, WRITEPAGE: obj477 };
        var obj295 = { READ: obj613, WRITE: obj553, LOADPAGE_LO: obj450, WRITEPAGE: obj478 };
        var obj294 = { READ: obj605, WRITE: obj547, LOADPAGE_LO: obj451, WRITEPAGE: obj470 };
        var obj293 = { READ: obj606, WRITE: obj548, LOADPAGE_LO: obj450, WRITEPAGE: obj474 };
        var obj292 = { READ: obj601, WRITE: obj545, LOADPAGE_LO: obj451, WRITEPAGE: obj473 };
        var obj291 = { READ: obj600, WRITE: obj546, LOADPAGE_LO: obj450, WRITEPAGE: obj474 };
        var obj290 = { READ: obj599, WRITE: obj544, LOADPAGE_LO: obj450, WRITEPAGE: obj478 };
        var obj289 = { READ: obj597, WRITE: obj543, LOADPAGE_LO: obj450, WRITEPAGE: obj478 };
        var obj288 = { READ: obj597, WRITE: obj543, LOADPAGE_LO: obj450, WRITEPAGE: obj474 };
        var obj287 = { READ: obj595, WRITE: obj542, LOADPAGE_LO: obj450, WRITEPAGE: obj471 };
        var obj286 = { READ_LO: obj517, READ_HI: obj516, WRITE_LO: obj495, WRITE_HI: obj496 };
        var obj285 = { READ_LO: obj514, READ_HI: obj512, WRITE_LO: obj494, WRITE_HI: obj493 };
        var obj284 = { READ_LO: obj510, READ_HI: obj509, WRITE_LO: obj492, WRITE_HI: obj491 };
        var obj283 = { READ_LO: obj506, READ_HI: obj505, WRITE_LO: obj490, WRITE_HI: obj489 };
        var obj282 = { mode: 65, delay: 5, blocksize: 4, paged: false, size: 64, page_size: 4, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1593, memops: obj311 };
        var obj281 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj310 };
        var obj280 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 64, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1593, memops: obj309 };
        var obj279 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 128, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj309 };
        var obj278 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj308 };
        var obj277 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj307 };
        var obj276 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1593, memops: obj307 };
        var obj275 = { paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1593, memops: obj284 };
        var obj274 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj306 };
        var obj273 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj305 };
        var obj272 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj304 };
        var obj271 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1593, memops: obj303 };
        var obj270 = { mode: 65, delay: 6, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj303 };
        var obj269 = { mode: 65, delay: 5, blocksize: 4, paged: false, size: 256, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1593, memops: obj303 };
        var obj268 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 3600, max_write_delay: 3600, readback: obj1593, memops: obj300 };
        var obj267 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 1024, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj301 };
        var obj266 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj298 };
        var obj265 = { mode: 4, delay: 10, blocksize: 128, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj298 };
        var obj264 = { mode: 4, delay: 10, blocksize: 64, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj298 };
        var obj263 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj295 };
        var obj262 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj296 };
        var obj261 = { mode: 65, delay: 5, blocksize: 4, paged: true, size: 64, page_size: 4, num_pages: 16, min_write_delay: 4e3, max_write_delay: 4500, readback: obj1593, memops: obj312 };
        var obj260 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj294 };
        var obj259 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj293 };
        var obj258 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj292 };
        var obj257 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj291 };
        var obj256 = { mode: 65, delay: 10, blocksize: 128, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj291 };
        var obj255 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj290 };
        var obj254 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj290 };
        var obj253 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 13e3, max_write_delay: 13e3, readback: obj1591, memops: obj290 };
        var obj252 = { mode: 65, delay: 20, blocksize: 8, paged: false, size: 2048, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1593, memops: obj290 };
        var obj251 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj289 };
        var obj250 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 4096, page_size: 8, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj288 };
        var obj249 = { mode: 65, delay: 10, blocksize: 8, paged: false, size: 8192, page_size: 8, min_write_delay: 13e3, max_write_delay: 13e3, readback: obj1591, memops: obj287 };
        var obj248 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 128, page_size: 4, num_pages: 32, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1593, memops: obj302 };
        var obj247 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 256, page_size: 4, num_pages: 64, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1593, memops: obj299 };
        var obj246 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj297 };
        var obj245 = { mode: 65, delay: 20, blocksize: 4, paged: false, size: 1024, page_size: 4, num_pages: 256, min_write_delay: 9e3, max_write_delay: 9e3, readback: obj1591, memops: obj297 };
        var obj244 = { mode: 65, delay: 10, blocksize: 4, paged: false, size: 512, page_size: 4, num_pages: 128, min_write_delay: 4e3, max_write_delay: 4e3, readback: obj1593, memops: obj296 };
        var obj243 = { mode: 2, delay: 15, blocksize: 128, paged: false, size: 1024, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1593, memops: obj286 };
        var obj242 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 1024, min_write_delay: 4500, max_write_delay: 2e4, readback: obj1593, memops: obj286 };
        var obj241 = { mode: 4, delay: 5, blocksize: 128, paged: false, size: 1024, min_write_delay: 4100, max_write_delay: 4100, readback: obj1593, memops: obj286 };
        var obj240 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 2048, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1593, memops: obj285 };
        var obj239 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 2048, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1592, memops: obj285 };
        var obj238 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1593, memops: obj284 };
        var obj237 = { mode: 4, delay: 12, blocksize: 64, paged: false, size: 4096, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1592, memops: obj283 };
        var obj236 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 8192, min_write_delay: 9e3, max_write_delay: 2e4, readback: obj1593, memops: obj283 };
        var obj235 = { mode: 4, delay: 12, blocksize: 128, paged: false, size: 8192, min_write_delay: 4e3, max_write_delay: 9e3, readback: obj1592, memops: obj283 };
        var obj234 = { READ_LO: obj528, READ_HI: obj529, LOADPAGE_LO: obj445, LOADPAGE_HI: obj444, WRITEPAGE: obj487 };
        var obj233 = { READ_LO: obj525, READ_HI: obj524, LOADPAGE_LO: obj445, LOADPAGE_HI: obj444, WRITEPAGE: obj484 };
        var obj232 = { READ_LO: obj522, READ_HI: obj521, LOADPAGE_LO: obj443, LOADPAGE_HI: obj442, WRITEPAGE: obj481 };
        var obj231 = { READ_LO: obj519, READ_HI: obj518, LOADPAGE_LO: obj447, LOADPAGE_HI: obj446, WRITEPAGE: obj476 };
        var obj230 = { READ_LO: obj519, READ_HI: obj518, LOADPAGE_LO: obj443, LOADPAGE_HI: obj442, WRITEPAGE: obj476 };
        var obj229 = { READ_LO: obj511, READ_HI: obj513, LOADPAGE_LO: obj440, LOADPAGE_HI: obj441, WRITEPAGE: obj472 };
        var obj228 = { READ_LO: obj514, READ_HI: obj512, LOADPAGE_LO: obj439, LOADPAGE_HI: obj435, WRITEPAGE: obj466 };
        var obj227 = { READ_LO: obj507, READ_HI: obj508, LOADPAGE_LO: obj440, LOADPAGE_HI: obj441, WRITEPAGE: obj469 };
        var obj226 = { READ_LO: obj507, READ_HI: obj508, LOADPAGE_LO: obj437, LOADPAGE_HI: obj434, WRITEPAGE: obj469 };
        var obj225 = { READ_LO: obj510, READ_HI: obj509, LOADPAGE_LO: obj433, LOADPAGE_HI: obj432, WRITEPAGE: obj468 };
        var obj224 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj448, LOADPAGE_HI: obj449, WRITEPAGE: obj462 };
        var obj223 = { READ_LO: obj506, READ_HI: obj505, LOADPAGE_LO: obj433, LOADPAGE_HI: obj432, WRITEPAGE: obj463 };
        var obj222 = { READ_LO: obj501, READ_HI: obj502, LOADPAGE_LO: obj448, LOADPAGE_HI: obj449, WRITEPAGE: obj457 };
        var obj221 = { READ_LO: obj501, READ_HI: obj502, LOADPAGE_LO: obj437, LOADPAGE_HI: obj434, WRITEPAGE: obj461 };
        var obj220 = { READ_LO: obj503, READ_HI: obj504, LOADPAGE_LO: obj429, LOADPAGE_HI: obj428, WRITEPAGE: obj465 };
        var obj219 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj438, LOADPAGE_HI: obj436, WRITEPAGE: obj459 };
        var obj218 = { READ_LO: obj500, READ_HI: obj499, LOADPAGE_LO: obj429, LOADPAGE_HI: obj428, WRITEPAGE: obj465 };
        var obj217 = { READ_LO: obj501, READ_HI: obj502, LOADPAGE_LO: obj426, LOADPAGE_HI: obj427, WRITEPAGE: obj464 };
        var obj216 = { READ_LO: obj501, READ_HI: obj502, LOADPAGE_LO: obj429, LOADPAGE_HI: obj428, WRITEPAGE: obj458 };
        var obj215 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj431, LOADPAGE_HI: obj430, WRITEPAGE: obj459 };
        var obj214 = { READ_LO: obj500, READ_HI: obj499, LOADPAGE_LO: obj426, LOADPAGE_HI: obj427, WRITEPAGE: obj460 };
        var obj213 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj426, LOADPAGE_HI: obj427, WRITEPAGE: obj467 };
        var obj212 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj429, LOADPAGE_HI: obj428, WRITEPAGE: obj458 };
        var obj211 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj426, LOADPAGE_HI: obj427, WRITEPAGE: obj459 };
        var obj210 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 1024, page_size: 32, num_pages: 32, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj234 };
        var obj209 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj233 };
        var obj208 = { mode: 65, delay: 10, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj232 };
        var obj207 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj232 };
        var obj206 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj232 };
        var obj205 = { mode: 33, delay: 10, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1588, memops: obj231 };
        var obj204 = { mode: 33, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj231 };
        var obj203 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj230 };
        var obj202 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj230 };
        var obj201 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj229 };
        var obj200 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 32, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj229 };
        var obj199 = { mode: 65, delay: 6, blocksize: 32, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj228 };
        var obj198 = { mode: 33, delay: 6, blocksize: 16, paged: true, size: 2048, page_size: 32, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj228 };
        var obj197 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj227 };
        var obj196 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj226 };
        var obj195 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj226 };
        var obj194 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 4096, page_size: 64, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj225 };
        var obj193 = { mode: 33, delay: 6, blocksize: 64, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj226 };
        var obj192 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj224 };
        var obj191 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj223 };
        var obj190 = { mode: 65, delay: 10, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj222 };
        var obj189 = { mode: 33, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj221 };
        var obj188 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj220 };
        var obj187 = { mode: 17, delay: 20, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 16e3, max_write_delay: 16e3, readback: obj1593, memops: obj220 };
        var obj186 = { mode: 33, delay: 16, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 14e3, max_write_delay: 14e3, readback: obj1593, memops: obj220 };
        var obj185 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj218 };
        var obj184 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj217 };
        var obj183 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 32768, page_size: 256, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj219 };
        var obj182 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj217 };
        var obj181 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj219 };
        var obj180 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj219 };
        var obj179 = { mode: 65, delay: 20, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 5e4, max_write_delay: 5e4, readback: obj1591, memops: obj217 };
        var obj178 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj216 };
        var obj177 = { mode: 33, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj215 };
        var obj176 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj215 };
        var obj175 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj214 };
        var obj174 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 65536, page_size: 256, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj213 };
        var obj173 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 16384, page_size: 128, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj212 };
        var obj172 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 32768, page_size: 128, num_pages: 256, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj212 };
        var obj171 = { mode: 65, delay: 6, blocksize: 128, paged: true, size: 8192, page_size: 128, num_pages: 64, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj212 };
        var obj170 = { mode: 65, delay: 6, blocksize: 64, paged: true, size: 8192, page_size: 64, num_pages: 128, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj212 };
        var obj169 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj211 };
        var obj168 = { mode: 65, delay: 6, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj211 };
        var obj167 = { mode: 65, delay: 20, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 5e4, max_write_delay: 5e4, readback: obj1591, memops: obj211 };
        var obj166 = { mode: 17, delay: 70, blocksize: 256, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 22e3, max_write_delay: 56e3, readback: obj1593, memops: obj211 };
        var obj165 = { mode: 33, delay: 6, blocksize: 128, paged: true, size: 131072, page_size: 256, num_pages: 512, min_write_delay: 4500, max_write_delay: 4500, readback: obj1593, memops: obj211 };
        var obj164 = { READ_LO: obj498, READ_HI: obj497, LOADPAGE_LO: obj426, LOADPAGE_HI: obj427, LOAD_EXT_ADDR: obj425, WRITEPAGE: obj459 };
        var obj163 = { mode: 65, delay: 10, blocksize: 256, paged: true, size: 262144, page_size: 256, num_pages: 1024, min_write_delay: 4500, max_write_delay: 4500, readback: obj1591, memops: obj164 };
        var obj162 = { eeprom: obj328, flash: obj243, signature: obj515, fuse: obj1450, lock: obj454 };
        var obj161 = { eeprom: obj325, flash: obj239, signature: obj515, fuse: obj1450, lock: obj452 };
        var obj160 = { eeprom: obj318, flash: obj235, signature: obj515, fuse: obj1450, lock: obj453 };
        var obj159 = { eeprom: obj321, flash: obj237, signature: obj515, fuse: obj1450, lock: obj453 };
        var obj158 = { AVRPart: "AT90S2313", chipEraseDelay: 2e4, stk500_devcode: 64, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1575, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj161 };
        var obj157 = { AVRPart: "AT90S1200", chipEraseDelay: 2e4, stk500_devcode: 51, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1543, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: true, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 1, pollValue: 255, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj162 };
        var obj156 = { AVRPart: "AT90S4414", chipEraseDelay: 2e4, stk500_devcode: 80, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1532, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj159 };
        var obj155 = { AVRPart: "AT90S8515", chipEraseDelay: 2e4, stk500_devcode: 96, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1560, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj160 };
        var obj154 = { eeprom: obj331, flash: obj275, signature: obj515, fuse: obj340, lock: obj339 };
        var obj153 = { eeprom: obj330, flash: obj240, signature: obj515, fuse: obj332, lock: obj338 };
        var obj152 = { eeprom: obj324, flash: obj240, signature: obj515, fuse: obj340, lock: obj339 };
        var obj151 = { eeprom: obj322, flash: obj238, signature: obj515, fuse: obj340, lock: obj339 };
        var obj150 = { eeprom: obj317, flash: obj236, signature: obj515, fuse: obj336, lock: obj335 };
        var obj149 = { eeprom: obj327, flash: obj242, signature: obj527, lock: obj337, calibration: obj532, fuse: obj342 };
        var obj148 = { eeprom: obj329, flash: obj241, signature: obj527, lock: obj337, calibration: obj532, fuse: obj343 };
        var obj147 = { eeprom: obj319, flash: obj186, fuse: obj344, lock: obj355, signature: obj515 };
        var obj146 = { eeprom: obj316, flash: obj166, fuse: obj341, lock: obj337, signature: obj515 };
        var obj145 = { AVRPart: "AT90S4434", chipEraseDelay: 2e4, stk500_devcode: 82, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1579, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, hventerstabdelay: 0, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 0, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 0, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj154 };
        var obj144 = { AVRPart: "AT90S2343", chipEraseDelay: 18e3, stk500_devcode: 67, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1520, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 0, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj153 };
        var obj143 = { AVRPart: "AT90S2333", chipEraseDelay: 2e4, stk500_devcode: 66, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1517, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj152 };
        var obj142 = { AVRPart: "AT90S4433", chipEraseDelay: 2e4, stk500_devcode: 81, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1569, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj151 };
        var obj141 = { AVRPart: "AT90S8535", chipEraseDelay: 2e4, stk500_devcode: 97, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1581, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 1, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj150 };
        var obj140 = { AVRPart: "ATtiny12", chipEraseDelay: 2e4, stk500_devcode: 18, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1562, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj149 };
        var obj139 = { AVRPart: "ATtiny15", chipEraseDelay: 8200, stk500_devcode: 19, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1512, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 16, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 50, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 5, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj148 };
        var obj138 = { AVRPart: "ATmega161", chipEraseDelay: 28e3, stk500_devcode: 128, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1563, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 30, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 2, programlockpulsewidth: 0, programlockpolltimeout: 2, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj147 };
        var obj137 = { AVRPart: "ATmega103", chipEraseDelay: 112e3, stk500_devcode: 177, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1552, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 15, chiperasepolltimeout: 0, chiperasetime: 0, programfusepulsewidth: 2, programfusepolltimeout: 0, programlockpulsewidth: 0, programlockpolltimeout: 10, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj146 };
        var obj136 = { eeprom: obj323, flash: obj204, lfuse: obj370, hfuse: obj365, lock: obj355, calibration: obj530, signature: obj515 };
        var obj135 = { eeprom: obj323, flash: obj204, lfuse: obj363, hfuse: obj367, lock: obj350, calibration: obj530, signature: obj515 };
        var obj134 = { eeprom: obj315, flash: obj205, lfuse: obj370, hfuse: obj365, lock: obj355, calibration: obj530, signature: obj515 };
        var obj133 = { eeprom: obj326, flash: obj198, signature: obj527, lock: obj333, lfuse: obj366, hfuse: obj361, calibration: obj526 };
        var obj132 = { eeprom: obj320, flash: obj187, lfuse: obj373, hfuse: obj375, lock: obj358, signature: obj515, calibration: obj532 };
        var obj131 = { eeprom: obj313, flash: obj175, lfuse: obj366, hfuse: obj372, efuse: obj349, lock: obj351, calibration: obj526, signature: obj515 };
        var obj130 = { eeprom: obj314, flash: obj165, lfuse: obj366, hfuse: obj372, efuse: obj349, lock: obj351, calibration: obj526, signature: obj515 };
        var obj129 = { eeprom: obj282, flash: obj210, signature: obj523, lock: obj350, calibration: obj534, lfuse: obj363, hfuse: obj367 };
        var obj128 = { eeprom: obj265, flash: obj196, lock: obj351, lfuse: obj366, hfuse: obj372, signature: obj515, calibration: obj531 };
        var obj127 = { eeprom: obj264, flash: obj193, lfuse: obj370, hfuse: obj365, lock: obj355, signature: obj515, calibration: obj530 };
        var obj126 = { AVRPart: "ATmega8515", chipEraseDelay: 9e3, stk500_devcode: 99, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1516, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj135 };
        var obj125 = { AVRPart: "ATmega8535", chipEraseDelay: 9e3, stk500_devcode: 100, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1571, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj136 };
        var obj124 = { AVRPart: "ATmega163", chipEraseDelay: 32e3, stk500_devcode: 129, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1513, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 30, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 2, programlockpulsewidth: 0, programlockpolltimeout: 2, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj423, memory: obj132 };
        var obj123 = { AVRPart: "ATmega8", chipEraseDelay: 1e4, stk500_devcode: 112, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1538, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj134 };
        var obj122 = { AVRPart: "ATtiny26", chipEraseDelay: 9e3, stk500_devcode: 33, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1574, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj133 };
        var obj121 = { eeprom: obj279, flash: obj209, signature: obj523, lock: obj455, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj534 };
        var obj120 = { eeprom: obj277, flash: obj206, signature: obj523, lock: obj455, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj534 };
        var obj119 = { eeprom: obj270, flash: obj203, signature: obj523, lock: obj455, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj534 };
        var obj118 = { eeprom: obj261, flash: obj208, signature: obj523, lock: obj456, lfuse: obj363, hfuse: obj367, efuse: obj348, calibration: obj534 };
        var obj117 = { eeprom: obj281, flash: obj190, lock: obj376, lfuse: obj379, hfuse: obj377, efuse: obj378, signature: obj537, calibration: obj538 };
        var obj116 = { eeprom: obj272, flash: obj192, lock: obj376, lfuse: obj379, hfuse: obj377, efuse: obj378, signature: obj537, calibration: obj538 };
        var obj115 = { eeprom: obj262, flash: obj188, lfuse: obj370, hfuse: obj365, efuse: obj380, lock: obj355, signature: obj523, calibration: obj536 };
        var obj114 = { eeprom: obj279, flash: obj209, signature: obj523, lock: obj362, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj533 };
        var obj113 = { eeprom: obj279, flash: obj209, signature: obj523, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj534 };
        var obj112 = { eeprom: obj278, flash: obj206, signature: obj523, lock: obj362, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj533 };
        var obj111 = { eeprom: obj276, flash: obj207, lfuse: obj363, hfuse: obj367, efuse: obj347, lock: obj350, calibration: obj536, signature: obj523 };
        var obj110 = { eeprom: obj277, flash: obj206, signature: obj523, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj534 };
        var obj109 = { eeprom: obj273, flash: obj202, signature: obj520, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj369, calibration: obj536 };
        var obj108 = { eeprom: obj280, flash: obj202, lfuse: obj363, hfuse: obj367, efuse: obj346, lock: obj350, calibration: obj536, signature: obj523 };
        var obj107 = { eeprom: obj274, flash: obj203, signature: obj523, lock: obj362, lfuse: obj366, hfuse: obj372, efuse: obj345, calibration: obj533 };
        var obj106 = { eeprom: obj271, flash: obj202, lfuse: obj363, hfuse: obj367, efuse: obj352, lock: obj350, calibration: obj536, signature: obj523 };
        var obj105 = { eeprom: obj269, flash: obj200, lfuse: obj363, hfuse: obj367, efuse: obj360, lock: obj357, calibration: obj536, signature: obj523 };
        var obj104 = { eeprom: obj271, flash: obj201, lfuse: obj363, hfuse: obj367, efuse: obj352, lock: obj350, calibration: obj536, signature: obj523 };
        var obj103 = { eeprom: obj273, signature: obj520, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj369, calibration: obj536, flash: obj196 };
        var obj102 = { eeprom: obj268, flash: obj197, lfuse: obj363, hfuse: obj367, efuse: obj352, lock: obj350, calibration: obj536, signature: obj523 };
        var obj101 = { flash: obj195, eeprom: obj266, lfuse: obj364, hfuse: obj374, efuse: obj371, lock: obj353, signature: obj520, calibration: obj535 };
        var obj100 = { eeprom: obj260, flash: obj189, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj368, signature: obj515, calibration: obj536 };
        var obj99 = { eeprom: obj267, flash: obj183, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj536, signature: obj515 };
        var obj98 = { eeprom: obj263, flash: obj180, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj536, signature: obj515 };
        var obj97 = { eeprom: obj258, flash: obj185, lfuse: obj363, hfuse: obj367, efuse: obj354, lock: obj350, signature: obj523, calibration: obj536 };
        var obj96 = { eeprom: obj259, flash: obj181, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj536, signature: obj515 };
        var obj95 = { eeprom: obj256, flash: obj176, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj368, signature: obj515, calibration: obj536 };
        var obj94 = { eeprom: obj257, flash: obj177, lock: obj351, lfuse: obj366, hfuse: obj372, efuse: obj368, signature: obj515, calibration: obj536 };
        var obj93 = { eeprom: obj252, flash: obj174, lfuse: obj363, hfuse: obj367, efuse: obj354, lock: obj350, signature: obj523, calibration: obj536 };
        var obj92 = { eeprom: obj255, flash: obj182, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj532, signature: obj515 };
        var obj91 = { lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515, flash: obj179, eeprom: obj253 };
        var obj90 = { eeprom: obj254, flash: obj178, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj532, signature: obj515 };
        var obj89 = { eeprom: obj250, flash: obj184, lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515 };
        var obj88 = { eeprom: obj248, flash: obj199, signature: obj527, lock: obj334, lfuse: obj363, hfuse: obj367, efuse: obj347, calibration: obj532 };
        var obj87 = { eeprom: obj251, flash: obj168, lfuse: obj366, hfuse: obj372, efuse: obj359, lock: obj351, calibration: obj532, signature: obj515 };
        var obj86 = { eeprom: obj250, flash: obj169, lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515 };
        var obj85 = { eeprom: obj250, lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515, flash: obj167 };
        var obj84 = { eeprom: obj245, flash: obj172, lfuse: obj366, hfuse: obj372, efuse: obj369, lock: obj351, calibration: obj536, signature: obj523 };
        var obj83 = { eeprom: obj246, flash: obj170, lfuse: obj366, hfuse: obj372, efuse: obj369, lock: obj351, calibration: obj536, signature: obj523 };
        var obj82 = { eeprom: obj246, flash: obj171, lfuse: obj366, hfuse: obj372, efuse: obj369, lock: obj351, calibration: obj536, signature: obj523 };
        var obj81 = { eeprom: obj246, flash: obj173, lfuse: obj366, hfuse: obj372, efuse: obj369, lock: obj351, calibration: obj536, signature: obj523 };
        var obj80 = { eeprom: obj247, flash: obj194, signature: obj527, lock: obj334, lfuse: obj363, hfuse: obj367, efuse: obj347, calibration: obj532 };
        var obj79 = { eeprom: obj244, flash: obj191, signature: obj527, lock: obj334, lfuse: obj363, hfuse: obj367, efuse: obj347, calibration: obj532 };
        var obj78 = { AVRPart: "ATmega64", chipEraseDelay: 9e3, stk500_devcode: 160, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1534, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 34, rampz: 0, spmcr: 104, eecr: 0, ocdrev: 2, ops: obj423, memory: obj131 };
        var obj77 = { AVRPart: "ATmega128", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1527, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 34, rampz: 59, spmcr: 104, eecr: 0, ocdrev: 1, ops: obj423, memory: obj130 };
        var obj76 = { AVRPart: "ATtiny13", chipEraseDelay: 4e3, stk500_devcode: 20, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1525, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 90, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj422, memory: obj129 };
        var obj75 = { AVRPart: "ATmega32", chipEraseDelay: 9e3, stk500_devcode: 145, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1526, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj423, memory: obj127 };
        var obj74 = { AVRPart: "ATmega16", chipEraseDelay: 9e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1561, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 100, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj422, memory: obj128 };
        var obj73 = { AVRPart: "ATmega164P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1580, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj128 };
        var obj72 = { eeprom: obj250, flash: obj163, lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515 };
        var obj71 = { flash: obj163, lfuse: obj366, hfuse: obj372, efuse: obj356, lock: obj351, calibration: obj532, signature: obj515, eeprom: obj249 };
        var obj70 = { AVRPart: "ATtiny25", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1564, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj121 };
        var obj69 = { AVRPart: "ATtiny45", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1541, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj120 };
        var obj68 = { AVRPart: "ATtiny85", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1509, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj119 };
        var obj67 = { AVRPart: "ATtiny43u", chipEraseDelay: 1e3, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1558, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 20, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj118 };
        var obj66 = { AVRPart: "ATmega325", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1549, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj424, memory: obj117 };
        var obj65 = { AVRPart: "ATmega3250", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1524, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj424, memory: obj117 };
        var obj64 = { AVRPart: "ATmega645", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1559, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj424, memory: obj116 };
        var obj63 = { AVRPart: "ATmega6450", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1533, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj424, memory: obj116 };
        var obj62 = { AVRPart: "ATmega169", chipEraseDelay: 9e3, stk500_devcode: 133, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1587, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj423, memory: obj115 };
        var obj61 = { AVRPart: "ATtiny24", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1576, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj114 };
        var obj60 = { AVRPart: "ATtiny44", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1570, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj112 };
        var obj59 = { AVRPart: "ATtiny84", chipEraseDelay: 4500, stk500_devcode: 20, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1518, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 1, togglevtg: 1, poweroffdelay: 25, resetdelayms: 0, resetdelayus: 70, hvleavestabdelay: 100, resetdelay: 25, chiperasepulsewidth: 0, chiperasepolltimeout: 40, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 25, programlockpulsewidth: 0, programlockpolltimeout: 25, synchcycles: 6, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj107 };
        var obj58 = { AVRPart: "ATtiny2313", chipEraseDelay: 9e3, stk500_devcode: 35, pagel: 212, bs2: 214, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1529, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj422, memory: obj113 };
        var obj57 = { AVRPart: "ATmega48", chipEraseDelay: 45e3, stk500_devcode: 89, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1550, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj111 };
        var obj56 = { AVRPart: "ATmega48P", chipEraseDelay: 45e3, stk500_devcode: 89, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1554, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj111 };
        var obj55 = { AVRPart: "ATtiny88", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1501, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj108 };
        var obj54 = { AVRPart: "ATmega162", chipEraseDelay: 9e3, stk500_devcode: 131, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1510, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: true, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 4, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 2, ops: obj422, memory: obj101 };
        var obj53 = { AVRPart: "AT90PWM2", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1484, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj109 };
        var obj52 = { AVRPart: "AT90PWM3", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1484, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj109 };
        var obj51 = { AVRPart: "ATtiny4313", chipEraseDelay: 9e3, stk500_devcode: 35, pagel: 212, bs2: 214, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1586, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 0, ops: obj422, memory: obj110 };
        var obj50 = { AVRPart: "AT90PWM3B", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1455, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj109 };
        var obj49 = { AVRPart: "AT90PWM2B", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1455, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj109 };
        var obj48 = { AVRPart: "ATmega88", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1540, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj106 };
        var obj47 = { AVRPart: "ATmega88P", chipEraseDelay: 9e3, stk500_devcode: 115, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1585, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj106 };
        var obj46 = { AVRPart: "ATmega329", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1556, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj97 };
        var obj45 = { AVRPart: "ATmega329P", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1584, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj97 };
        var obj44 = { AVRPart: "ATmega3290", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1544, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj97 };
        var obj43 = { AVRPart: "ATmega3290P", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1573, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj97 };
        var obj42 = { AVRPart: "ATmega649", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1528, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj93 };
        var obj41 = { AVRPart: "ATmega168", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1537, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj104 };
        var obj40 = { AVRPart: "ATmega168P", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1555, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj104 };
        var obj39 = { AVRPart: "ATmega6490", chipEraseDelay: 9e3, stk500_devcode: 0, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1535, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj93 };
        var obj38 = { AVRPart: "ATtiny1634", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 179, bs2: 177, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1477, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 0, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: -1, ops: obj422, memory: obj105 };
        var obj37 = { AVRPart: "ATmega324P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1539, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj100 };
        var obj36 = { AVRPart: "AT90PWM316", chipEraseDelay: 9e3, stk500_devcode: 101, pagel: 216, bs2: 226, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1470, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj103 };
        var obj35 = { AVRPart: "ATmega324PA", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1497, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj100 };
        var obj34 = { AVRPart: "ATmega328", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1459, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj102 };
        var obj33 = { AVRPart: "ATmega328P", chipEraseDelay: 9e3, stk500_devcode: 134, pagel: 215, bs2: 194, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1583, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 15, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj102 };
        var obj32 = { AVRPart: "ATmega644", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1582, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj94 };
        var obj31 = { AVRPart: "ATmega644P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1557, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj94 };
        var obj30 = { AVRPart: "ATtiny261", chipEraseDelay: 4e3, stk500_devcode: 0, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1548, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj88 };
        var obj29 = { AVRPart: "AT90CAN32", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1489, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj422, memory: obj99 };
        var obj28 = { AVRPart: "ATtiny461", chipEraseDelay: 4e3, stk500_devcode: 0, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1521, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj80 };
        var obj27 = { AVRPart: "AT90CAN64", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1472, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj422, memory: obj98 };
        var obj26 = { AVRPart: "ATmega1284", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1542, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj95 };
        var obj25 = { AVRPart: "ATmega1284P", chipEraseDelay: 55e3, stk500_devcode: 130, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1566, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 0, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj422, memory: obj95 };
        var obj24 = { AVRPart: "AT90CAN128", chipEraseDelay: 9e3, stk500_devcode: 179, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1460, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 6, togglevtg: 0, poweroffdelay: 0, resetdelayms: 0, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 63, ocdrev: 3, ops: obj422, memory: obj96 };
        var obj23 = { AVRPart: "ATtiny861", chipEraseDelay: 4e3, stk500_devcode: 0, pagel: 179, bs2: 178, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1565, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 2, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj79 };
        var obj22 = { AVRPart: "ATmega640", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1578, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj89 };
        var obj21 = { AVRPart: "ATmega64RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1514, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj91 };
        var obj20 = { AVRPart: "AT90USB647", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1471, usbpid: 12281, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj92 };
        var obj19 = { AVRPart: "AT90USB646", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1471, usbpid: 12281, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj92 };
        var obj18 = { AVRPart: "ATmega32U4", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1463, usbpid: 12276, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj90 };
        var obj17 = { AVRPart: "ATmega644RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1508, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj91 };
        var obj16 = { AVRPart: "ATmega1280", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1531, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj86 };
        var obj15 = { AVRPart: "ATmega1281", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1522, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj86 };
        var obj14 = { AVRPart: "AT90USB1286", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1486, usbpid: 12283, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj87 };
        var obj13 = { AVRPart: "AT90USB1287", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1486, usbpid: 12283, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj87 };
        var obj12 = { AVRPart: "ATmega128RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1546, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj85 };
        var obj11 = { AVRPart: "ATmega128RFA1", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1572, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj85 };
        var obj10 = { AVRPart: "ATmega1284RFR2", chipEraseDelay: 55e3, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1551, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 3, ops: obj423, memory: obj85 };
        var obj9 = { AVRPart: "AT90USB82", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1475, usbpid: 12279, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj82 };
        var obj8 = { AVRPart: "ATmega8U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1487, usbpid: 12270, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj83 };
        var obj7 = { AVRPart: "AT90USB162", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1453, usbpid: 12282, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj81 };
        var obj6 = { AVRPart: "ATmega32U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1496, usbpid: 12272, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj84 };
        var obj5 = { AVRPart: "ATmega16U2", chipEraseDelay: 9e3, stk500_devcode: 0, pagel: 215, bs2: 198, resetDisposition: "possible i/o", retryPulse: "SCK", signature: obj1503, usbpid: 12271, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: true, hasWriteOperation: false, hasJtag: false, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 0, rampz: 0, spmcr: 0, eecr: 0, ocdrev: 1, ops: obj422, memory: obj81 };
        var obj4 = { AVRPart: "ATmega2561", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1530, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj423, memory: obj72 };
        var obj3 = { AVRPart: "ATmega2560", chipEraseDelay: 9e3, stk500_devcode: 178, pagel: 215, bs2: 160, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1519, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj423, memory: obj72 };
        var obj2 = { AVRPart: "ATmega256RFR2", chipEraseDelay: 18500, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1515, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj423, memory: obj71 };
        var obj1 = { AVRPart: "ATmega2564RFR2", chipEraseDelay: 18500, stk500_devcode: 178, pagel: 215, bs2: 226, resetDisposition: "dedicated", retryPulse: "SCK", signature: obj1547, usbpid: 0, serialProgramMode: true, parallelProgramMode: true, pseudoparallelProgramMode: false, hasTpi: false, isAvr32: false, hasDebugWire: false, hasWriteOperation: false, hasJtag: true, hasPdi: false, hasEnablePageProgramming: true, allowFullPageBitstream: false, allowInitSmc: false, isAT90S1200: false, timeout: 200, stabDelay: 100, cmdExeDelay: 25, syncLoops: 32, pollIndex: 3, pollValue: 83, predelay: 1, pollmethod: 1, postdelay: 1, hventerstabdelay: 100, progmodedelay: 0, latchcycles: 5, togglevtg: 1, poweroffdelay: 15, resetdelayms: 1, resetdelayus: 0, hvleavestabdelay: 15, resetdelay: 0, chiperasepulsewidth: 0, chiperasepolltimeout: 10, chiperasetime: 0, programfusepulsewidth: 0, programfusepolltimeout: 5, programlockpulsewidth: 0, programlockpolltimeout: 5, synchcycles: 0, hvspcmdexedelay: 0, idr: 49, rampz: 59, spmcr: 87, eecr: 0, ocdrev: 4, ops: obj423, memory: obj71 };
        var obj0 = { "  uc3a0512": obj753, "  c128    ": obj24, "  c32     ": obj29, "  c64     ": obj27, "  pwm2    ": obj53, "  pwm2b   ": obj49, "  pwm3    ": obj52, "  pwm316  ": obj36, "  pwm3b   ": obj50, "  1200    ": obj157, "  2313    ": obj158, "  2333    ": obj143, "  2343    ": obj144, "  4414    ": obj156, "  4433    ": obj142, "  4434    ": obj145, "  8515    ": obj155, "  8535    ": obj141, "  usb1286 ": obj14, "  usb1287 ": obj13, "  usb162  ": obj7, "  usb646  ": obj19, "  usb647  ": obj20, "  usb82   ": obj9, "  m103    ": obj137, "  m128    ": obj77, "  m1280   ": obj16, "  m1281   ": obj15, "  m1284   ": obj26, "  m1284p  ": obj25, "  m1284rfr2": obj10, "  m128rfa1": obj11, "  m128rfr2": obj12, "  m16     ": obj74, "  m161    ": obj138, "  m162    ": obj54, "  m163    ": obj124, "  m164p   ": obj73, "  m168    ": obj41, "  m168p   ": obj40, "  m169    ": obj62, "  m16u2   ": obj5, "  m2560   ": obj3, "  m2561   ": obj4, "  m2564rfr2": obj1, "  m256rfr2": obj2, "  m32     ": obj75, "  m324p   ": obj37, "  m324pa  ": obj35, "  m325    ": obj66, "  m3250   ": obj65, "  m328    ": obj34, "  m328p   ": obj33, "  m329    ": obj46, "  m3290   ": obj44, "  m3290p  ": obj43, "  m329p   ": obj45, "  m32u2   ": obj6, "  m32u4   ": obj18, "  m406    ": obj724, "  m48     ": obj57, "  m48p    ": obj56, "  m64     ": obj78, "  m640    ": obj22, "  m644    ": obj32, "  m644p   ": obj31, "  m644rfr2": obj17, "  m645    ": obj64, "  m6450   ": obj63, "  m649    ": obj42, "  m6490   ": obj39, "  m64rfr2 ": obj21, "  m8      ": obj123, "  m8515   ": obj126, "  m8535   ": obj125, "  m88     ": obj48, "  m88p    ": obj47, "  m8u2    ": obj8, "  t10     ": obj736, "  t11     ": obj725, "  t12     ": obj140, "  t13     ": obj76, "  t15     ": obj139, "  t1634   ": obj38, "  t20     ": obj735, "  t2313   ": obj58, "  t24     ": obj61, "  t25     ": obj70, "  t26     ": obj122, "  t261    ": obj30, "  t4      ": obj737, "  t40     ": obj734, "  t4313   ": obj51, "  t43u    ": obj67, "  t44     ": obj60, "  t45     ": obj69, "  t461    ": obj28, "  t5      ": obj738, "  t84     ": obj59, "  t85     ": obj68, "  t861    ": obj23, "  t88     ": obj55, "  t9      ": obj739, "  x128a1  ": obj686, "  x128a1d ": obj675, "  x128a1u ": obj681, "  x128a3  ": obj687, "  x128a3u ": obj680, "  x128a4  ": obj699, "  x128a4u ": obj700, "  x128b1  ": obj684, "  x128b3  ": obj682, "  x128c3  ": obj705, "  x128d3  ": obj707, "  x128d4  ": obj704, "  x16a4   ": obj693, "  x16a4u  ": obj703, "  x16c4   ": obj711, "  x16d4   ": obj712, "  x16e5   ": obj720, "  x192a1  ": obj698, "  x192a3  ": obj697, "  x192a3u ": obj678, "  x192c3  ": obj719, "  x192d3  ": obj718, "  x256a1  ": obj683, "  x256a3  ": obj688, "  x256a3b ": obj679, "  x256a3bu": obj676, "  x256a3u ": obj677, "  x256c3  ": obj702, "  x256d3  ": obj701, "  x32a4   ": obj691, "  x32a4u  ": obj709, "  x32c4   ": obj717, "  x32d4   ": obj716, "  x32e5   ": obj721, "  x384c3  ": obj710, "  x384d3  ": obj708, "  x64a1   ": obj692, "  x64a1u  ": obj689, "  x64a3   ": obj695, "  x64a3u  ": obj685, "  x64a4   ": obj690, "  x64a4u  ": obj706, "  x64b1   ": obj696, "  x64b3   ": obj694, "  x64c3   ": obj713, "  x64d3   ": obj715, "  x64d4   ": obj714, "  x8e5    ": obj722, "  .xmega  ": obj723, "  .reduced_core_tiny": obj751, "  ucr2    ": obj752 };
        module.exports = obj0
    }, {}],
    55: [function(require, module, exports) {
        (function(global) { var Stk500 = require("./protocols/stk500").STK500Transaction; var Stk500v2 = require("./protocols/stk500v2").STK500v2Transaction; var Stk500v2Usb = require("./protocols/stk500v2usb").STK500v2UsbTransaction; var Avr109 = require("./protocols/butterfly").AVR109Transaction; var USBTiny = require("./protocols/usbtiny").USBTinyTransaction; var USBAsp = require("./protocols/usbasp").USBAspTransaction;
            module.exports.protocols = { serial: { stk500v2: Stk500v2, wiring: Stk500v2, stk500: Stk500v2, arduino: Stk500, stk500v1: Stk500, avr109: Avr109 }, usb: { usbasp: USBAsp, usbtiny: USBTiny, stk500v2: Stk500v2Usb } };
            global.DATA = {};

            function Intercepted(Constructor, type, name) {
                function NewConstructor() { var config = arguments[0],
                        rec = new(require("BlackMirror").Recorder)(arguments[0].api, ["babelfish.getState", "runtime.getManifestAsync", "serial.onReceiveError.forceDispatch", "runtime.getPlatformInfo", "serial.getDevices", "serial.connect", "serial.update", "serial.disconnect", "serial.setPaused", "serial.getInfo", "serial.getConnections", "serial.send", "serial.flush", "serial.getControlSignals", "serial.setControlSignals", "serial.onReceive.addListener", "serial.onReceive.removeListener", "serial.onReceiveError.addListener", "serial.onReceiveError.removeListener", "usb.getDevices", "usb.getUserSelectedDevices", "usb.requestAccess", "usb.openDevice", "usb.findDevices", "usb.closeDevice", "usb.setConfiguration", "usb.getConfiguration", "usb.getConfigurations", "usb.listInterfaces", "usb.claimInterface", "usb.releaseInterface", "usb.setInterfaceAlternateSetting", "usb.controlTransfer", "usb.bulkTransfer", "usb.interruptTransfer", "usb.isochronousTransfer", "usb.resetDevice", "usb.onDeviceAdded.addListener", "usb.onDeviceAdded.removeListener", "usb.onDeviceRemoved.addListener", "usb.onDeviceRemoved.removeListener"]),
                        self = this;
                    arguments[0].api = rec.api;
                    global.saveLastFlash = function() { var ret = { device: self.deviceName, data: { data: self.sketchData.data, offset: self.sketchData.min(), "default": self.sketchData.defaultByte }, config: config, checker: rec.checker().serialize([]) };
                        global.getArgs = "You need to re-record to use getArgs";
                        global.DATA[type] = global.DATA[type] || {};
                        global.DATA[type][name] = ret;
                        console.log("Saved in window.DATA[", type, "][", name, "]") };
                    Constructor.apply(this, arguments) } NewConstructor.prototype = Constructor.prototype; return NewConstructor }

            function interceptedObject(obj) { var ret = { intercepted: true };
                Object.getOwnPropertyNames(obj).forEach(function(t) { ret[t] = {};
                    Object.getOwnPropertyNames(obj[t]).forEach(function(n) { ret[t][n] = Intercepted(obj[t][n], t, n) }) }); return ret } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./protocols/butterfly": 56, "./protocols/stk500": 62, "./protocols/stk500v2": 63, "./protocols/stk500v2usb": 64, "./protocols/usbasp": 65, "./protocols/usbtiny": 66, BlackMirror: 87 }],
    56: [function(require, module, exports) { var SerialTransaction = require("./serialtransaction").SerialTransaction,
            getLog = require("./../logging").getLog,
            arraify = require("./../util").arraify,
            ConnectionManager = require("./mixins/magicreset.js").ConnectionManager,
            ButterflyCodecSocket = require("./../io/butterflycodec.js").ButterflyCodecSocket,
            ioutil = require("./../io/util.js"),
            status = require("./../status.js"),
            scheduler = require("./../scheduler"),
            errno = require("./../errno");

        function AVR109Transaction() { SerialTransaction.apply(this, arraify(arguments));
            this.AVR = { SOFTWARE_VERSION: 86, ENTER_PROGRAM_MODE: 80, LEAVE_PROGRAM_MODE: 76, SET_ADDRESS: 65, WRITE: 66, TYPE_FLASH: 70, EXIT_BOOTLOADER: 69, CR: 13, READ_PAGE: 103, SIG_CHECK: 115 };
            this.timeouts = { magicBaudConnected: 2e3, disconnectPollCount: 30, disconnectPoll: 100, pollingForDev: 500, finishWait: 2e3, finishTimeout: 2e3, finishPollForDev: 100, magicRetries: 3, magicRetryTimeout: 1e3 };
            this.initialDev = null;
            this.log = getLog("Butterfly");
            this.connectionManager = new ConnectionManager(this); var oldErrCb = this.errCb,
                self = this;
            this.codecsocketClass = ButterflyCodecSocket } AVR109Transaction.prototype = Object.create(SerialTransaction.prototype);
        AVR109Transaction.prototype.checkSignature = function(cb) { var self = this;
            this.writeThenRead([this.AVR.SIG_CHECK], function(data) { if (self.config.avrdude.signature.toString() == data.toString()) { self.errCb(errno.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: data }); return } cb() }, { minPureData: 3 }) };
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
        AVR109Transaction.prototype.programmingDone = function() { var self = this;
            this.writeThenRead([this.AVR.LEAVE_PROGRAM_MODE], function(payload) { self.writeThenRead([self.AVR.EXIT_BOOTLOADER], function(payload) { self.transition("disconnect", function() { self.cleanup() }) }, { minPureData: 1 }) }, { minPureData: 1 }) };
        AVR109Transaction.prototype.drainBytes = function(readArg) { var self = this;
            this.drain(function() { self.writeThenRead([self.AVR.SOFTWARE_VERSION], self.transitionCb("prepareToProgramFlash"), { minPureData: 2 }) }) };
        AVR109Transaction.prototype.prepareToProgramFlash = function() { var self = this,
                offset = self.config.offset || 0;
            this.writeThenRead(this.addressMsg(offset), function(response) { self.transition("programFlash", self.config.avrdude.memory.flash.page_size) }, { minPureData: 1 }) };
        AVR109Transaction.prototype.addressMsg = function(offset) { var addressBytes = ioutil.storeAsTwoBytes(offset); return [this.AVR.SET_ADDRESS, addressBytes[1], addressBytes[0]] };
        AVR109Transaction.prototype.writeMsg = function(payload) { var sizeBytes = ioutil.storeAsTwoBytes(payload.length); return [this.AVR.WRITE, sizeBytes[0], sizeBytes[1], this.AVR.TYPE_FLASH].concat(payload) };
        AVR109Transaction.prototype.writePage = function(offset, payload, done) { this.writeThenRead(this.writeMsg(payload), done, { minPureData: 1 }) };
        AVR109Transaction.prototype.programFlash = function(pageSize) { this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("programmingDone")) };
        module.exports.AVR109Transaction = AVR109Transaction }, { "./../errno": 42, "./../io/butterflycodec.js": 47, "./../io/util.js": 52, "./../logging": 53, "./../scheduler": 68, "./../status.js": 70, "./../util": 72, "./mixins/magicreset.js": 58, "./serialtransaction": 60 }],
    57: [function(require, module, exports) { var util = require("./../util");

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
        module.exports.checkMask = checkMask }, { "./../util": 72 }],
    58: [function(require, module, exports) { var FiniteStateMachine = require("./../../fsm.js").FiniteStateMachine,
            scheduler = require("./../../scheduler.js"),
            ioutile = require("./../../io/util.js"),
            status = require("./../../status.js"),
            errno = require("./../../errno.js"); var LEONARDO_RESET_MESSAGE = "Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!";

        function pollGetDevicesUntil(expirationTime, devList, transaction, cb) { if (scheduler.now() >= expirationTime) { cb(null); return } if (transaction.dead()) return;
            transaction.serial.getDevices(function(devs) { if (!devs) { transaction.errCb(errno.API_ERROR, { method: "serial.getDevices" }); return } var newDevs = devs.filter(function(newDev) { return !devList.some(function(oldDev) { return oldDev.path == newDev.path }) }); if (newDevs.length > 0) { cb(newDevs[0].path); return } pollGetDevicesUntil(expirationTime, devs, transaction, cb) }) }

        function MagicReset(config, finishCb, errorCb, parent) { FiniteStateMachine.call(this, {}, finishCb, errorCb, parent);
            this.schedulerTimeout = null;
            this.config = config;
            this.serial = this.config.api.serial;
            this.magicBaudrate = 1200;
            this.magicConnectionId = null } MagicReset.prototype = Object.create(FiniteStateMachine.prototype);
        MagicReset.prototype.openDevice = function(device, speed) { this.connectSpeed = speed;
            this.initialDevice = device;
            this.transition("magicConnect") };
        MagicReset.prototype.safeSetTimeout = function(cb, timeout) { var self = this; if (this.safeTimeout) { this.errCb(errno.OVERLAPPING_TIMEOUTS); return } this.safeTimeout = scheduler.setTimeout(function() { self.safeTimeout = null;
                cb() }) };
        MagicReset.prototype.localCleanup = function(cb) { if (this.safeTimeout) scheduler.clearTimeout(this.safeTimeout);
            this.safeTimeout = null;
            cb() };
        MagicReset.prototype.magicConnect = function() { var device = this.intialDevice,
                self = this;
            this.serial.connect(this.initialDevice, { bitrate: this.magicBaudrate, name: this.initialDevice }, function(info) { if (!info) { console.warn("Failed to connect to magic baudrate." + "  Contiuing anyway.");
                    self.transition("commenceReset"); return } self.magicConnectionId = info.connectionId;
                self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3) }) };
        MagicReset.prototype.controlSignal = function() { var self = this,
                failWarn = "I failed to set rts/dtr. " + "ArduinoIDE does not set rts, dtr when flashing AVR109 devices. " + "It expects that it will be set by the os during enumeration. " + "The codebenderplugin however does so explicitly, " + "but does not abort on failure.";
            this.serial.setControlSignals(this.magicConnectionId, { rts: false, dtr: true }, function(ok) { if (!ok) { console.warn(failWarn) } self.safeSetTimeout(self.transitionCb("magicDisconnect"), 2e3) }) };
        MagicReset.prototype.magicDisconnect = function() { var self = this;
            this.serial.disconnect(this.magicConnectionId, function(ok) { self.magicConnectionId = null; if (!ok) { self.errCb(errno.LEONARDO_MAGIC_DISCONNECT_FAIL, { initialDevice: self.initialDevice }); return } self.transition("commenceReset") }) };
        MagicReset.prototype.commenceReset = function() { this.setStatus(status.LEONARDO_RESET_START);
            this.transition({ retries: 1, state: "waitForDevice" }, 5e3, this.transitionCb("tryOriginalDevice")) };
        MagicReset.prototype.waitForDevice = function(timeout, fallbackCb) { var expirationTime = scheduler.now() + timeout,
                self = this;
            fallbackCb = fallbackCb || function() { self.errCb(errno.LEONARDO_REAPPEAR_TIMEOUT) };
            this.serial.getDevices(function(devs) { pollGetDevicesUntil(expirationTime, devs, self, function(dev) { if (!dev) { fallbackCb(); return } scheduler.setTimeout(self.transitionCb("useDevice", dev), 100) }) }) };
        MagicReset.prototype.tryOriginalDevice = function(cb) { var self = this;
            this.serial.getDevices(function(devs) { if (devs.some(function(dev) { return dev.path == self.initialDevice })) { self.transition("useDevice", self.initialDevice); return } self.transition({ retries: 1, state: "waitForDevice" }, 5e3) }) };
        MagicReset.prototype.useDevice = function(dev) { var self = this;
            this.setStatus(status.LEONARDO_RESET_END);
            this.serial.connect(dev, { name: dev, bitrate: this.connectSpeed }, function(info) { if (!info) { self.errCb(errno.API_ERROR, { method: "serial.connect", dev: dev, speed: self.connectSpeed }); return } self.setStatus(status.START_FLASH); if (self.parentState) self.parentState.parent.connectionId = info.connectionId;
                self.cleanup() }) };
        MagicReset.prototype.localCleanup = function(cb) { if (!this.magicConnectionId) { cb(); return } this.serial.disconnect(this.magicConnectionId, function(ok) { cb() }) };

        function PollingDisconnect(config, finishCb, errorCb, parent) { FiniteStateMachine.call(this, config, finishCb, errorCb, parent);
            this.serial = parent.serial } PollingDisconnect.prototype = Object.create(FiniteStateMachine.prototype);
        PollingDisconnect.prototype.closeDevice = function(initialDevice) { var self = this;
            this.initialDevice = initialDevice; if (!this.parentState.parent.connectionId) { this.cleanup(); return } this.serial.disconnect(this.parentState.parent.connectionId, function(ok) { if (!ok) { self.errCb(errno.LEONARDO_BOOTLOADER_DISCONNECT, { connectionId: self.parentState.parent.connectionId, initialDevice: self.initialDevice }); return } if (self.dead()) { self.cleanup(); return } self.transition("originalDevReappear") });
            this.parentState.parent.connectionId = null };
        PollingDisconnect.prototype.originalDevReappear = function() { var self = this,
                expirationTime = scheduler.now() + 2e3;
            this.serial.getDevices(function poll(devs) { if (devs.some(function(dev) { return dev.path == self.initialDevice })) { self.cleanup(); return } pollGetDevicesUntil(expirationTime, devs, self, function(dev) { if (!dev) { console.warn("Device didn't reappear", self.initialDevice);
                        self.cleanup(); return } poll(devs.concat([dev])) }) }) };

        function ConnectionManager(transaction) { this.transaction = transaction } ConnectionManager.prototype = { openDevice: function(dev, speed, _msg, cb) { var self = this;
                this.connector = this.transaction.child(MagicReset, function() { cb(self.transaction.connectionId) });
                this.connector.openDevice(dev, speed) }, closeDevice: function(cb) { if (this.closed) { cb(); return } this.closed = true; if (!this.connector) { this.transaction.errCb(errno.PREMATURE_RETURN, { desc: "magic closing null device" }); return } this.disconnector = this.transaction.child(PollingDisconnect, cb);
                this.disconnector.closeDevice(this.connector.initialDevice) } };
        module.exports.MagicReset = MagicReset;
        module.exports.PollingDisconnect = PollingDisconnect;
        module.exports.ConnectionManager = ConnectionManager }, { "./../../errno.js": 42, "./../../fsm.js": 43, "./../../io/util.js": 52, "./../../scheduler.js": 68, "./../../status.js": 70 }],
    59: [function(require, module, exports) { var SocketTransaction = require("./../sockettransaction.js").SocketTransaction,
            getLog = require("./../../logging.js").getLog,
            scheduler = require("./../../scheduler.js"),
            ioutile = require("./../../io/util.js"),
            status = require("./../../status.js"),
            errno = require("./../../errno.js");

        function ControlFsm(config, finishCb, errorCb, parent) { SocketTransaction.apply(this, arguments);
            this.parent = this.parentState.parent;
            this.codecsocketClass = this.parent.codecsocketClass;
            this.serial = config.api.serial } ControlFsm.prototype = Object.create(SocketTransaction.prototype);
        ControlFsm.prototype.maybeSetControls = function(cid, val, cb, _dontFail) { if (this.config.avoidTwiggleDTR) { scheduler.setTimeout(cb); return } this.setControls(cid, val, cb, true) };
        ControlFsm.prototype.setControls = function(cid, val, cb, _dontFail) { var self = this; if (!cid) { if (_dontFail) { cb(); return } self.errCb(errno.DTR_RTS_FAIL, { message: "Bad connection id", connectionId: cid }); return } this.log.log("Setting RTS/DTR (", cid, "):", val);
            this.serial.setControlSignals(cid, { dtr: val, rts: val }, function(ok) { if (!ok) { if (_dontFail) { cb(); return } self.errCb(errno.DTR_RTS_FAIL); return } scheduler.setImmediate(cb) }) };

        function SerialReset(config, finishCb, errorCb, parent) { ControlFsm.apply(this, arguments);
            this.devConfig = null;
            this.log = getLog("SerialReset");
            this.preconfigureConnectionId = null;
            this.unsyncedConnectionId = null } SerialReset.prototype = Object.create(ControlFsm.prototype);
        SerialReset.prototype.localCleanup = function(cb) { var self = this;
            this.maybeDisconnect(this.preconfigureConnectionId, function() { self.preconfigureConnectionId = null;
                self.maybeDisconnect(self.unsyncedConnectionId, function() { self.unsyncedConnectionId = null;
                    ControlFsm.prototype.localCleanup.call(self, cb) }) }) };
        SerialReset.prototype.maybeDisconnect = function(cid, cb) { if (typeof cid !== "number") { cb(); return } this.log.log("API call to disconnect", cid);
            this.serial.disconnect(cid, cb) };
        SerialReset.prototype.openDevice = function(device, speed, syncConf) { if (this.config.preconfigureDevice) { this.transition("preconfigureOpenDevice", device, speed, syncConf); return } this.transition("normalOpenDevice", device, speed, syncConf) };
        SerialReset.prototype.preconfigureOpenDevice = function(device, speed, syncConf) { this.syncConf = syncConf;
            this.devConfig = { device: device, speed: speed };
            this.setStatus(status.PRECONFIGURING, { device: device });
            this.serial.connect(device, { bitrate: this.config.speed, name: device }, this.transitionCb("preconfigureConnected")) };
        SerialReset.prototype.preconfigureConnected = function(info) { if (!info) { this.errCb(errno.PRECONFIGURE_CONNECT, { devConfig: this.devConfig }); return } this.preconfigureConnectionId = info.connectionId;
            this.log.log("Connected for preconfiguration:", info.connectionId);
            this.transition("presetControlSignals") };
        SerialReset.prototype.presetControlSignals = function() { this.maybeSetControls(this.preconfigureConnectionId, false, this.transitionCb("finalizePreparation")) };
        SerialReset.prototype.finalizePreparation = function() { var self = this;
            this.serial.disconnect(this.preconfigureConnectionId, function(ok) { if (!ok) { self.errCb(errno.PRECONFIGURE_DISCONNECT, { devConfig: self.devConfig }); return } self.preconfigureConnectionId = null;
                self.transition("normalOpenDevice", self.devConfig.device, self.devConfig.speed, self.syncConf) }) };
        SerialReset.prototype.normalOpenDevice = function(device, speed, syncConf) { this.setStatus(status.CONNECTING, { device: device });
            this.syncConf = syncConf;
            this.devConfig = { device: device, speed: speed };
            this.serial.connect(device, { bitrate: this.config.speed, name: device }, this.transitionCb("normalConnected")) };
        SerialReset.prototype.normalConnected = function(info) { if (!info) { this.errCb(errno.CONNECTION_FAIL, { devConfig: this.devConfig }); return } this.unsyncedConnectionId = info.connectionId;
            this.setConnectionId(info.connectionId);
            this.log.log("Connected to preconfigured device:", info.connectionId);
            scheduler.setTimeout(this.transitionCb("twiggleDtr"), 50) };
        SerialReset.prototype.twiggleDtr = function() { var self = this,
                cid = this.unsyncedConnectionId,
                transition = { state: "sync", retries: 10, waitBefore: 400, retryInterval: 0 };
            this.setStatus(status.RESETTING, { device: this.devConfig.device });
            this.maybeSetControls(cid, false, function() { scheduler.setTimeout(function() { self.maybeSetControls(cid, true, self.transitionCb(transition)) }, 250) }) };
        SerialReset.prototype.sync = function() { this.writeThenRead(this.syncConf.request, this.transitionCb("finalizeConnect"), { ttl: 200 }) };
        SerialReset.prototype.finalizeConnect = function(data) { if (this.syncConf && this.syncConf.response && this.syncConf.response.some(function(b, i) { return b != data[i] })) { this.errCb(errno.SYNC_RESPONSE, { expected: this.syncConf.response, got: data }); return } this.unsyncedConnectionId = null;
            this.parent.setSocket(this.getSocket());
            this.cleanup(this.finishCallback) };

        function ConnectionManager(transaction) { this.transaction = transaction;
            this.connector = null;
            this.closed = false;
            this.log = getLog("ConnectionManager") } ConnectionManager.prototype = { openDevice: function(dev, speed, msg, cb) { var self = this;
                this.log.log("Opening device", dev);
                this.connector = this.transaction.child(SerialReset, function() { self.log.log("Passing reset device to stk500:", self.connector.getConnectionId());
                    cb(self.transaction.getConnectionId()) });
                this.connector.transition("openDevice", dev, speed, msg) }, closeDevice: function(cb) { if (this.closed) { cb(); return } this.closed = true; if (!this.connector) { this.transaction.errCb(errno.PREMATURE_RETURN, { desc: "serial closing null device" }); return } if (this.transaction.getConnectionId() === null) { this.log.log("Skipping disconnecting of a non-connected transaction.");
                    cb(); return } var cid = this.transaction.getConnectionId(),
                    connector = this.connector;
                this.log.log("Closing device", cid);
                connector.maybeSetControls(cid, false, function() { connector.maybeDisconnect(cid, cb) }) } };
        module.exports.SerialReset = SerialReset;
        module.exports.ConnectionManager = ConnectionManager }, { "./../../errno.js": 42, "./../../io/util.js": 52, "./../../logging.js": 53, "./../../scheduler.js": 68, "./../../status.js": 70, "./../sockettransaction.js": 61 }],
    60: [function(require, module, exports) { var forEachWithCallback = require("./../util").forEachWithCallback,
            getLog = require("./../logging.js").getLog,
            SocketTransaction = require("./sockettransaction.js").SocketTransaction,
            ConnectionManager = require("./mixins/serialreset.js").ConnectionManager,
            errno = require("./../errno");

        function SerialTransaction(config, finishCallback, errorCallback, parent) { SocketTransaction.apply(this, arguments);
            this.log = getLog("SerialTransaction");
            this.connectionManager = new ConnectionManager(this) } SerialTransaction.prototype = Object.create(SocketTransaction.prototype);
        SerialTransaction.prototype.smartOpenDevice = function(device, speed, msg, cb) { this.connectionManager.openDevice(device, speed, msg, cb) };
        SerialTransaction.prototype.localCleanup = function(callback) { var self = this;
            this.disconnect(function() { SocketTransaction.prototype.localCleanup.call(self, callback) }) };
        SerialTransaction.prototype.disconnect = function(callback) { this.connectionManager.closeDevice(callback) };
        SerialTransaction.prototype.destroyOtherConnections = function(name, cb) { var self = this;
            this.serial.getConnections(function(cnx) { if (cnx.length == 0) { cb() } else { forEachWithCallback(cnx, function(c, next) { if (c.name != name) { next(); return } self.log.log("Closing connection ", c.connectionId);
                        self.serial.disconnect(c.connectionId, function(ok) { if (!ok) { self.errCb(errno.FORCE_DISCONNECT_FAIL, { device: name }) } else { self.log.log("Destroying connection:", c.connectionId);
                                self.serial.onReceiveError.forceDispatch({ connectionId: c.connectionId, error: "device_lost" });
                                next() } }) }, cb) } }) };
        SerialTransaction.prototype.cmdChain = function(chain, cb) { if (chain.length == 0) { cb(); return } this.cmd(chain.shift(), this.cmdChain.bind(this, chain, cb)) };
        module.exports.SocketTransaction = SocketTransaction;
        module.exports.SerialTransaction = SerialTransaction }, { "./../errno": 42, "./../logging.js": 53, "./../util": 72, "./mixins/serialreset.js": 59, "./sockettransaction.js": 61 }],
    61: [function(require, module, exports) { var Transaction = require("./../transaction.js").Transaction,
            errno = require("./../errno"),
            getLog = require("./../logging.js").getLog;

        function SocketTransaction(config, finishCallback, errorCallback, parent) { Transaction.apply(this, arguments);
            this._codecsocket = null;
            this.parentErrCb = Object.getPrototypeOf(SocketTransaction.prototype).errCb;
            this.log = getLog("SocketTransaction");
            this.init(config) } SocketTransaction.prototype = Object.create(Transaction.prototype);
        SocketTransaction.prototype.errCb = function(err, ctx) { var self = this,
                context = ctx || {}; if (!this.serial || !this._codecsocket) { this.parentErrCb(err, ctx); return } this.serial.getConnections(function(cnx) { var currentConnection = null;
                cnx.forEach(function(c) { if (c.connectionId == self.getConnectionId()) currentConnection = c }); if (!currentConnection) { context.lostConnection = true;
                    self.finalError(err, context); return } self.serial.getDevices(function(devs) { var devVisible = devs.some(function(d) { return currentConnection.name == d.path }); if (!devVisible) { context.lostDevice = true;
                        self.finalError(err, context); return } self.parentErrCb(err, ctx) }) }) };
        SocketTransaction.prototype.localCleanup = function(callback) { this.setConnectionId(null);
            Transaction.prototype.localCleanup.call(this, callback) };
        SocketTransaction.prototype.init = function(config) { if (Transaction.prototype.init) Transaction.prototype.init.apply(this, [].slice(arguments, 2));
            this.block = false;
            this.config = config;
            this.serial = this.config.api.serial };
        SocketTransaction.prototype.getSocket = function() { return this._codecsocket || this._socketThunk && this.setSocket(this._socketThunk()) };
        SocketTransaction.prototype.setSocket = function(socket) { if (socket === this._codecsocket) return socket; if (!socket && this._codecsocket) { this._codecsocket.unref();
                this._codecsocket = null; return null } socket.ref();
            this._codecsocket = socket; return this._codecsocket };
        SocketTransaction.prototype._socketThunk = function() { return null };
        SocketTransaction.prototype.setConnectionId = function(connectionId, codecsocketClass) { if (this._codecsocket && this._codecsocket.connectionId != connectionId) { this.setSocket(null) } if (connectionId && !this._codecsocekt) { this._socketThunk = function() { delete this._socketThunk; return new(codecsocketClass || this.codecsocketClass)(connectionId, this.serial, this.errCb.bind(this)) } } };
        SocketTransaction.prototype.getConnectionId = function() { if (!this._codecsocket) return null; return this._codecsocket.connectionId };
        SocketTransaction.prototype.writeThenRead = function(data, cb, config) { var self = this;
            this.getSocket().writeThenRead(data, function(data) { if (!data) { self.errCb(errno.READER_TIMEOUT); return } cb(data) }, config) };
        SocketTransaction.prototype.justWrite = function(data, cb, config) { this.getSocket().justWrite(data, cb, config) };
        SocketTransaction.prototype.drain = function(callback) { this.getSocket().drain(callback) };
        module.exports.SocketTransaction = SocketTransaction }, { "./../errno": 42, "./../logging.js": 53, "./../transaction.js": 71 }],
    62: [function(require, module, exports) {
        var SerialTransaction = require("./serialtransaction").SerialTransaction,
            getLog = require("./../logging").getLog,
            Stk500CodecSocket = require("./../io/stk500codec.js").Stk500CodecSocket,
            ioutil = require("./../io/util.js"),
            arraify = require("./../util").arraify,
            scheduler = require("./../scheduler.js"),
            errno = require("./../errno"),
            status = require("./../status.js");

        function STK500Transaction() { SerialTransaction.apply(this, arguments);
            this.log = getLog("STK500"); if (typeof this.config.preconfigureDevice === "undefined") this.config.preconfigureDevice = true;
            this.STK = { OK: 16, INSYNC: 20, CRC_EOP: 32, GET_SYNC: 48, GET_PARAMETER: 65, ENTER_PROGMODE: 80, LEAVE_PROGMODE: 81, LOAD_ADDRESS: 85, UNIVERSAL: 86, PROG_PAGE: 100, READ_PAGE: 116, READ_SIGN: 117, HW_VER: 128, SW_VER_MINOR: 130, SW_VER_MAJOR: 129, SET_DEVICE: 66, SET_DEVICE_EXT: 69 };
            this.maxMessageRetries = 2;
            this.codecsocketClass = Stk500CodecSocket } STK500Transaction.prototype = Object.create(SerialTransaction.prototype);
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
            this.writeThenRead([this.STK.READ_SIGN, this.STK.CRC_EOP], function(data) { if (data.toString() != self.config.avrdude.signature.toString()) { self.errCb(errno.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: data }); return } cb() }, { minPureData: 3 }) };
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
        STK500Transaction.prototype.doneWriting = function(pageSize) { this.setStatus(status.SYNC);
            this.writeThenRead([this.STK.GET_SYNC, this.STK.CRC_EOP], this.transitionCb("confirmPages", pageSize)) };
        STK500Transaction.prototype.confirmPages = function(pageSize) { this.setStatus(status.START_CHECK_DATA);
            this.sketchData.tile(this.transitionCb("checkPage"), pageSize, this.transitionCb("doneProgramming"), this.sketchData.min()) };
        STK500Transaction.prototype.doneProgramming = function() { var self = this;
            this.setStatus(status.LEAVE_PROGMODE);
            this.setupSpecialBits(this.config.cleanControlBits, function() { self.writeThenRead([self.STK.LEAVE_PROGMODE, self.STK.CRC_EOP], self.transitionCb("leftProgmode"), { ignoreBadFinalByte: true }) }) };
        STK500Transaction.prototype.leftProgmode = function(data) { var self = this;
            this.setStatus(status.CLEANING_UP);
            this.cleanup(function() { scheduler.setTimeout(self.finishCallback, 1e3) }) };
        STK500Transaction.prototype.addressMsg = function(addr) { var addrBytes = ioutil.storeAsTwoBytes(addr / 2); return [this.STK.LOAD_ADDRESS, addrBytes[1], addrBytes[0], this.STK.CRC_EOP] };
        STK500Transaction.prototype.writeMsg = function(payload) { var flashMemoryType = 70,
                sizeBytes = ioutil.storeAsTwoBytes(payload.length); return [this.STK.PROG_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType].concat(payload).concat([this.STK.CRC_EOP]) };
        STK500Transaction.prototype.readMsg = function(size) { var flashMemoryType = 70,
                sizeBytes = ioutil.storeAsTwoBytes(size); return [this.STK.READ_PAGE, sizeBytes[0], sizeBytes[1], flashMemoryType, this.STK.CRC_EOP] };
        STK500Transaction.prototype.writePage = function(offset, payload, done) {
            this.setStatus(status.WRITE_PAGE, { address: offset });
            var loadAddressMessage = this.addressMsg(offset),
                programMessage = this.writeMsg(payload),
                writeDelay = this.config.avrdude.memory.flash.max_write_delay,
                self = this;
            this.writeThenRead(loadAddressMessage, function() { self.writeThenRead(programMessage, function() { scheduler.setTimeout(done, Math.ceil(writeDelay / 1e3)) }) })
        };
        STK500Transaction.prototype.checkPage = function(offset, payload, done) { var loadAddressMessage = this.addressMsg(offset),
                readMessage = this.readMsg(payload.length),
                self = this;
            this.log.log("Checking page at address:", offset, "(size:", payload.length, ")");
            this.setStatus(status.CHECK_PAGE, { address: offset });
            this.writeThenRead(loadAddressMessage, function() { self.writeThenRead(readMessage, function(devData) { if (devData.some(function(b, i) { return b != payload[i] })) { self.errCb(errno.PAGE_CHECK, { devPage: devData, hostPage: payload, pageOffset: offset }); return } done() }, { minPureData: payload.length }) }) };
        module.exports.STK500Transaction = STK500Transaction
    }, { "./../errno": 42, "./../io/stk500codec.js": 50, "./../io/util.js": 52, "./../logging": 53, "./../scheduler.js": 68, "./../status.js": 70, "./../util": 72, "./serialtransaction": 60 }],
    63: [function(require, module, exports) { var SerialTransaction = require("./serialtransaction").SerialTransaction,
            getLog = require("./../logging").getLog,
            arraify = require("./../util").arraify,
            zip = require("./../util").zip,
            util = require("./../util"),
            scheduler = require("./../scheduler"),
            memops = require("./memops"),
            Stk500v2CodecSocket = require("./../io/stk500v2codec.js").Stk500v2CodecSocket,
            ioutil = require("./../io/util.js"),
            status = require("./../status.js"),
            errno = require("./../errno");

        function STK500v2Transaction() { SerialTransaction.apply(this, arraify(arguments));
            this.log = getLog("STK500v2");
            this.cmdSeq = 1;
            this.codecsocketClass = Stk500v2CodecSocket } STK500v2Transaction.prototype = Object.create(SerialTransaction.prototype);
        STK500v2Transaction.prototype.STK2 = { CMD_SIGN_ON: 1, CMD_SET_PARAMETER: 2, CMD_GET_PARAMETER: 3, CMD_SET_DEVICE_PARAMETERS: 4, CMD_OSCCAL: 5, CMD_LOAD_ADDRESS: 6, CMD_FIRMWARE_UPGRADE: 7, CMD_CHECK_TARGET_CONNECTION: 13, CMD_LOAD_RC_ID_TABLE: 14, CMD_LOAD_EC_ID_TABLE: 15, CMD_ENTER_PROGMODE_ISP: 16, CMD_LEAVE_PROGMODE_ISP: 17, CMD_CHIP_ERASE_ISP: 18, CMD_PROGRAM_FLASH_ISP: 19, CMD_READ_FLASH_ISP: 20, CMD_PROGRAM_EEPROM_ISP: 21, CMD_READ_EEPROM_ISP: 22, CMD_PROGRAM_FUSE_ISP: 23, CMD_READ_FUSE_ISP: 24, CMD_PROGRAM_LOCK_ISP: 25, CMD_READ_LOCK_ISP: 26, CMD_READ_SIGNATURE_ISP: 27, CMD_READ_OSCCAL_ISP: 28, CMD_SPI_MULTI: 29, CMD_XPROG: 80, CMD_XPROG_SETMODE: 81, STATUS_CMD_OK: 0, STATUS_CMD_TOUT: 128, STATUS_RDY_BSY_TOUT: 129, STATUS_SET_PARAM_MISSING: 130, STATUS_CMD_FAILED: 192, STATUS_CKSUM_ERROR: 193, STATUS_CMD_UNKNOWN: 201, MESSAGE_START: 27, TOKEN: 14 };
        STK500v2Transaction.prototype.cmd = function(cmd, cb) { if (cmd.length != 4) { this.errCb(errno.COMMAND_SIZE_FAIL, { receivedCmd: cmd }); return } var buf = [this.STK2.CMD_SPI_MULTI, 4, 4, 0].concat(cmd);
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
        STK500v2Transaction.prototype.programFlash = function(pageSize) { this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("checkPages", pageSize), this.sketchData.min()) };
        STK500v2Transaction.prototype.checkPages = function(pageSize) { var self = this;

            function writeAndRecheck(retryCb, offset, payload, done) { self.writePage(offset, payload, retryCb) } this.sketchData.tile(this.transitionCb({ state: "checkPage", fallbackCb: writeAndRecheck, retries: 10 }), pageSize, this.transitionCb("maybeCleanupBits"), this.sketchData.min()) };
        STK500v2Transaction.prototype.maybeCleanupBits = function(pageSize) { this.setupSpecialBits(this.config.cleanControlBits, this.transitionCb("doneProgramming")) };
        STK500v2Transaction.prototype.doneProgramming = function() { var self = this;
            self.writeThenRead([17, 1, 1], function(data) { self.setStatus(status.CLEANING_UP);
                self.transition("disconnect", function() { self.cleanup(function() { scheduler.setTimeout(self.finishCallback, 1e3) }) }) }) };
        STK500v2Transaction.prototype.writePage = function(offset, payload, done) { var self = this;
            this.writeThenRead(this.addressMsg(offset), function(reponse) { self.writeThenRead(self.writeMsg(payload), function(response) { if (response[0] != 19 || response[1] != 0) { self.errCb(errno.PAGE_WRITE_RESPONSE, { deviceResponse: response, expectedResponse: [19, 0] }); return } done() }) }) };
        STK500v2Transaction.prototype.checkPage = function(offset, payload, done) { var self = this,
                index = 0;
            this.writeThenRead(this.addressMsg(offset), function(reponse) { self.writeThenRead(self.readMsg(payload.length), function(response) { response = response.slice(2);
                    response.pop(); if (response.length != payload.length || response.some(function(v, i) { index = i; return v != payload[i] })) { self.errCb(errno.PAGE_CHECK, { devPage: response, hostPage: payload, pageOffset: offset }); return } done() }, { minPureData: 2 + payload.length + 1 }) }) };
        STK500v2Transaction.prototype.readMsg = function(size) { var readCmds = memops.opToBin(this.config.avrdude.memory.flash.memops.READ_LO),
                sizeBytes = ioutil.storeAsTwoBytes(size); return [this.STK2.CMD_READ_FLASH_ISP, sizeBytes[0], sizeBytes[1], readCmds[0]] };
        STK500v2Transaction.prototype.addressMsg = function(address) { var addressBytes = ioutil.storeAsFourBytes(address / 2); if (this.config.avrdude.memory.flash.memops.LOAD_EXT_ADDR) addressBytes[0] |= 128; return [this.STK2.CMD_LOAD_ADDRESS].concat(addressBytes) };
        STK500v2Transaction.prototype.writeMsg = function(payload) { var sizeBytes = ioutil.storeAsTwoBytes(payload.length),
                memMode = 193,
                delay = 10,
                loadpageLoCmd = 64,
                writepageCmd = 76,
                avrOpReadLo = 32; return [this.STK2.CMD_PROGRAM_FLASH_ISP, sizeBytes[0], sizeBytes[1], memMode, delay, loadpageLoCmd, writepageCmd, avrOpReadLo, 0, 0].concat(payload) };
        module.exports.STK500v2Transaction = STK500v2Transaction }, { "./../errno": 42, "./../io/stk500v2codec.js": 51, "./../io/util.js": 52, "./../logging": 53, "./../scheduler": 68, "./../status.js": 70, "./../util": 72, "./memops": 57, "./serialtransaction": 60 }],
    64: [function(require, module, exports) { var USBTransaction = require("./usbtransaction").USBTransaction,
            STK500v2Transaction = require("./stk500v2").STK500v2Transaction,
            getLog = require("./../logging").getLog,
            arraify = require("./../util").arraify,
            zip = require("./../util").zip,
            buffer = require("./../buffer"),
            util = require("./../util"),
            errno = require("./../errno");

        function STK500v2UsbTransaction() { USBTransaction.apply(this, arraify(arguments));
            this.setupAsBulk();
            this.MAX_READ_LENGTH = 275;
            this.cmdSeq = 1;
            this.device = { vendorId: 1003, productId: 8452 };
            this.log = getLog("STK500v2USB");
            this.entryState = "sync";
            this.transfer = this.usb.bulkTransfer.bind(this.usb);
            this.transferIn = this.bulkIn.bind(this);
            this.transferOut = this.bulkOut.bind(this) } STK500v2UsbTransaction.prototype = Object.create(util.shallowCopy(STK500v2Transaction.prototype));
        STK500v2UsbTransaction.prototype.__proto__.__proto__ = USBTransaction.prototype;
        STK500v2UsbTransaction.prototype.flash = USBTransaction.prototype.flash;
        STK500v2UsbTransaction.prototype.sync = function(cb) { var expectedResp = [this.STK2.CMD_SIGN_ON, this.STK2.STATUS_CMD_OK],
                self = this;
            this.writeThenRead([this.STK2.CMD_SIGN_ON], function(data) { if (data.toString() == expectedResp.toString()) { self.errCb(errno.SYNC_RESPONSE, { expected: expectedResp, got: data }); return } self.transition("signedOn") }) };
        STK500v2UsbTransaction.prototype.drain = function(cb) { var self = this;
            this.usb.resetDevice(this.handler, function(ok) { if (!ok) { self.errCb(errno.STK500V2USB_DEVICE_RESET); return } cb() }) };
        STK500v2UsbTransaction.prototype.resetDevice = function(cb) { cb() };
        STK500v2UsbTransaction.prototype.write = function(data, cb, kwargs) { kwargs = kwargs || {}; var self = this,
                msg = data.slice(0, this.maxPacketSize()),
                outMsg = this.transferOut(msg);
            this.usb.bulkTransfer(this.handler, outMsg, function(outResp) { if (!outResp || outResp.resultCode != 0) { self.errCb(errno.BULK_TRANSFER, { sentMessage: outMsg, response: outResp }); return } if (data.length >= self.maxPacketSize()) { self.write(data.slice(self.maxPacketSize()), cb, kwargs); return } cb() }) };
        STK500v2UsbTransaction.prototype.read = function(length, cb, kwargs) { var self = this;
            kwargs = kwargs || {}; if (length > this.maxPacketSize()) { self.read(self.maxPacketSize(), function(headPacket) { if (headPacket.length < self.maxPacketSize()) { cb(headPacket); return } self.read(length - self.maxPacketSize(), function(rest) { cb(headPacket.concat(rest)) }, kwargs) }, kwargs); return } var packetSize = this.maxPacketSize(),
                inMsg = this.transferIn(packetSize, kwargs.timeout);
            this.usb.bulkTransfer(self.handler, inMsg, function(inResp) { if (!kwargs.silenceErrors && (!inResp || inResp.resultCode != 0)) { self.errCb(errno.BULK_RECEIVE, { response: inResp }); return } var ret = buffer.bufToBin(inResp.data);
                cb(ret) }) };
        STK500v2UsbTransaction.prototype.writeThenRead = function(data, cb, kwargs) { var self = this;
            this.write(data, function() { self.read(self.MAX_READ_LENGTH, function(data) { cb(data) }) }) };
        module.exports.STK500v2UsbTransaction = STK500v2UsbTransaction }, { "./../buffer": 40, "./../errno": 42, "./../logging": 53, "./../util": 72, "./stk500v2": 63, "./usbtransaction": 67 }],
    65: [function(require, module, exports) { var USBTransaction = require("./usbtransaction").USBTransaction,
            util = require("./../util"),
            arraify = util.arraify,
            ops = require("./memops"),
            buffer = require("./../buffer"),
            errno = require("./../errno"),
            scheduler = require("./../scheduler.js"),
            getLog = require("./../logging").getLog;

        function USBAspTransaction(config, finishCallback, errorCallback) { USBTransaction.apply(this, arraify(arguments));
            this.setupAsControl();
            this.log = getLog("USBASP");
            this.UA = { CONNECT: 1, DISCONNECT: 2, TRANSMIT: 3, READFLASH: 4, ENABLEPROG: 5, WRITEFLASH: 6, READEEPROM: 7, WRITEEEPROM: 8, SETLONGADDRESS: 9, SETISPSCK: 10, GETCAPABILITIES: 127, READBLOCKSIZE: 200, WRITEBLOCKSIZE: 200, BLOCKFLAG_FIRST: 1, BLOCKFLAG_LAST: 2, CAP_TPI: 1 };
            this.SCK_OPTIONS = { 15e5: 12, 75e4: 11, 375e3: 10, 187500: 9, 93750: 8, 32e3: 7, 16e3: 6, 8e3: 5, 4e3: 4, 2e3: 3, 1e3: 2, 500: 1 };
            this.device = { productId: 1500, vendorId: 5824 };
            this.cmdFunction = this.UA.TRANSMIT;
            this.entryState = { state: "checkCapabilities", retries: 3 } } USBAspTransaction.prototype = Object.create(USBTransaction.prototype);
        USBAspTransaction.prototype.checkCapabilities = function() { var self = this; var info = this.transferIn(this.UA.GETCAPABILITIES, 0, 0, 4);
            this.xferMaybe(info, function(resp) { var capabilities = resp.data.reduce(function(a, b) { return a << 8 | b }, 0); if (capabilities & self.UA.CAP_TPI) { self.errCb(errno.UNSUPPORTED_TPI, { capabilities: capabilities }); return } scheduler.setTimeout(self.transitionCb("setSck"), 1e3) }) };
        USBAspTransaction.prototype.setSck = function() { var sck_id = 0; if (this.config.bitclock) { var request_hz = this.config.bitclock,
                    sck_hz = Object.getOwnPropertyNames(this.SCK_OPTIONS).map(Number).sort().filter(function(sck) { return request_hz < sck })[0];
                sck_id = this.SCK_OPTIONS[sck_hz] || 0 } var info = this.transferIn(this.UA.SETISPSCK, sck_id, 0, 4);
            this.sck_hz = sck_hz;
            this.xfer(info, this.transitionCb("programEnable")) };
        USBAspTransaction.prototype.programEnable = function() { var cb, self = this,
                enableProgInfo = this.transferIn(this.UA.ENABLEPROG, 0, 0, 4),
                connectInfo = this.transferIn(this.UA.CONNECT, 0, 0, 4); if (!this.chipErased) { this.chipErased = true;
                cb = this.transitionCb("maybeCheckSignature", this.transitionCb("maybeChipErase", this.transitionCb("checkCapabilities"))) } else { cb = this.transitionCb("writePages", this.config.avrdude.memory.flash.page_size) } this.xferMaybe(connectInfo, function() { self.xferMaybe(enableProgInfo, cb) }) };
        USBAspTransaction.prototype.infoAddress = function(offset) { var cmd = [offset & 255, offset >> 8 & 255, offset >> 16 & 255, offset >> 24 & 255]; if (offset >>> 31 >> 1 != 0) { this.errCb(errno.ADDRESS_TOO_LONG, { address: offset }); return null } this.log.log("[CMD]setaddress: ", this.UA.SETLONGADDRESS.toString(16), (cmd[1] << 8 | cmd[0]).toString(16), (cmd[3] << 8 | cmd[2]).toString(16)); return this.transferIn(this.UA.SETLONGADDRESS, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4) };
        USBAspTransaction.prototype.writePage = function(offset, payload, done) { var pageStart = offset,
                pageEnd = offset + payload.length;
            this.sketchData.tile(this.transitionCb("writeBlock", payload.length, pageStart, pageEnd), this.blockSize(), done, pageStart, pageEnd) };
        USBAspTransaction.prototype.writeBlock = function(pageSize, pageStart, pageEnd, offset, payload, done) { var isLast = pageEnd <= offset + payload.length,
                isFirst = offset == pageStart,
                address = [offset >> 0 & 255, offset >> 8 & 255],
                flags = (isFirst ? this.UA.BLOCKFLAG_FIRST : 0) | (isLast ? this.UA.BLOCKFLAG_LAST : 0),
                flagHex = flags & 15 | (pageSize & 3840) >> 4,
                infoWrite = this.transferOut(this.UA.WRITEFLASH, address[1] << 8 | address[0], pageSize & 255 | flagHex << 8, payload),
                self = this;
            this.xferMaybe(this.infoAddress(offset), function(resp) { self.log.log("[CMD]writeflash: ", self.UA.WRITEFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), (pageSize & 255 | flagHex << 8).toString(16));
                self.xferMaybe(infoWrite, done) }) };
        USBAspTransaction.prototype.checkBlock = function(offset, payload, done) { var self = this,
                address = [offset >> 0 & 255, offset >> 8 & 255],
                infoRead = self.transferIn(this.UA.READFLASH, address[1] << 8 | address[0], 0, payload.length);
            this.xferMaybe(this.infoAddress(offset), function(resp) { self.log.log("[CMD]readflash: ", self.UA.READFLASH.toString(16), (address[1] << 8 | address[0]).toString(16), 0);
                self.xferMaybe(infoRead, function(resp) { if (!util.arrEqual(resp.data, payload)) { self.errCb(errno.PAGE_CHECK, { devPage: resp.data, hostPage: payload, pageOffset: offset }); return } done() }) }) };
        USBAspTransaction.prototype.blockSize = function() { return this.sck_hz && this.sck_hz > 0 && this.sck_hz < 1e4 ? this.UA.WRITEBLOCKSIZE / 10 : this.UA.WRITEBLOCKSIZE };
        USBAspTransaction.prototype.checkPage = function(offset, payload, done) { this.sketchData.tile(this.transitionCb("checkBlock"), this.blockSize(), done, offset, offset + payload.length) };
        USBAspTransaction.prototype.writePages = function(pageSize) { this.sketchData.tile(this.transitionCb("writePage"), pageSize, this.transitionCb("checkPages", pageSize), this.sketchData.min()) };
        USBAspTransaction.prototype.checkPages = function(pageSize) { var self = this;

            function writeAndRecheck(retryCb, offset, payload, done) { self.writePage(offset, payload, retryCb) } var checkPage = { state: "checkPage", retries: 3, fallbackCb: writeAndRecheck };
            this.sketchData.tile(this.transitionCb(checkPage), pageSize, this.transitionCb("close"), this.sketchData.min()) };
        USBAspTransaction.prototype.close = function() { var self = this;
            this.setupSpecialBits(self.config.cleanControlBits, function() { self.control(self.UA.DISCONNECT, 0, 0, function() { self.cleanup(self.finishCallback) }) }) };
        module.exports.USBAspTransaction = USBAspTransaction }, { "./../buffer": 40, "./../errno": 42, "./../logging": 53, "./../scheduler.js": 68, "./../util": 72, "./memops": 57, "./usbtransaction": 67 }],
    66: [function(require, module, exports) { var USBTransaction = require("./usbtransaction").USBTransaction,
            util = require("./../util"),
            arraify = util.arraify,
            ops = require("./memops"),
            buffer = require("./../buffer"),
            errno = require("./../errno"),
            getLog = require("./../logging").getLog;

        function USBTinyTransaction(config, finishCallback, errorCallback) { var self = this;
            USBTransaction.apply(this, arraify(arguments));
            this.setupAsControl();
            this.UT = { ECHO: 0, READ: 1, WRITE: 2, CLR: 3, SET: 4, POWERUP: 5, POWERDOWN: 6, SPI: 7, POLL_BYTES: 8, FLASH_READ: 9, FLASH_WRITE: 10, EEPROM_READ: 11, EEPROM_WRITE: 12, RESET_LOW: 0, RESET_HIGH: 1 };
            this.entryState = "programEnable";
            this.cmdFunction = this.UT.SPI;
            this.device = { productId: 3231, vendorId: 6017 };
            this.log = getLog("USBTinyISP");

            function rewriteThenCheck(retry, offset, payload, cb) { self.transition(self.writePageTransitionConf, offset, payload, retry) }

            function writeInBytes(retry, offset, payload, cb) { self.transition("writePageInBytes", offset, payload, cb) } this.writePageTransitionConf = { state: "writePage", fallbackCb: writeInBytes, retries: 20, retryInterval: 0 };
            this.checkPageTransitionConf = { state: "checkPage", fallbackCb: rewriteThenCheck, retries: 5, retryInterval: 500 } } USBTinyTransaction.prototype = Object.create(USBTransaction.prototype);
        USBTinyTransaction.prototype.cmd = function(cmd, cb) { var superProto = Object.getPrototypeOf(Object.getPrototypeOf(this)),
                self = this;
            superProto.cmd.call(this, cmd, function(resp) { if (!ops.checkMask([null, null, cmd[1], null], resp.data)) { self.errCb(errno.COMMAND_CHECK, { cmd: cmd, resp: resp.data }); return } cb(resp) }) };
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
            this.xfer(info, function(devData) { if (devData.data.some(function(b, i) { return b != payload[i] })) { self.errCb(errno.PAGE_CHECK, { devPage: devData.data, hostPage: payload, pageOffset: offset }); return } done() }) };
        USBTinyTransaction.prototype.writePages = function() { var pageSize = this.config.avrdude.memory.flash.page_size;
            this.sketchData.tile(this.transitionCb(this.writePageTransitionConf), pageSize, this.transitionCb("checkPages"), this.sketchData.min()) };
        USBTinyTransaction.prototype.checkPages = function() { var pageSize = this.config.avrdude.memory.flash.page_size;
            this.sketchData.tile(this.transitionCb(this.checkPageTransitionConf), pageSize, this.transitionCb("powerDown"), this.sketchData.min()) };
        USBTinyTransaction.prototype.powerDown = function() { var self = this;
            this.setupSpecialBits(this.config.cleanControlBits, function() { self.control(self.UT.POWERDOWN, 0, 0, self.transitionCb("endTransaction")) }) };
        USBTinyTransaction.prototype.endTransaction = function(ctrlArg) { var self = this;
            this.cleanup(this.finishCallback) };
        module.exports.USBTinyTransaction = USBTinyTransaction }, { "./../buffer": 40, "./../errno": 42, "./../logging": 53, "./../util": 72, "./memops": 57, "./usbtransaction": 67 }],
    67: [function(require, module, exports) { var Transaction = require("./../transaction").Transaction,
            arraify = require("./../util").arraify,
            chain = require("./../util").chain,
            forEachWithCallback = require("./../util").forEachWithCallback,
            MemoryOperations = require("./memops"),
            buffer = require("./../buffer"),
            scheduler = require("./../scheduler"),
            errno = require("./../errno"),
            ops = require("./memops"),
            getLog = require("./../logging").getLog;

        function USBTransaction(config, finishCallback, errorCallback) { Transaction.apply(this, arraify(arguments));
            this.parentErrCb = Object.getPrototypeOf(Transaction.prototype).errCb;
            this.log = getLog("USBTransaction");
            this.sck = 10;
            this.endpoints = {}; if (config) { this.usb = this.config.api.usb;
                this.transfer = this.usb.controlTransfer.bind(this.usb) } this.setupAsControl() } USBTransaction.prototype = Object.create(Transaction.prototype);
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
                found = interfaces.some(function isGoodIface(iface) { return iface.endpoints.some(function isGoodEp(ep) { if (ep.direction == direction) { self.usb.claimInterface(self.handler, iface.interfaceNumber, function() { if (self.config.api.runtime.lastError) { self.errCb(errno.CLAIM_INTERFACE, { ifaceNumber: iface.interfaceNumber }); return } cb(ep) }); return true } return false }) }); if (!found) cb(null) };
        USBTransaction.prototype.setupEndpoints = function(cb) { var self = this,
                cbCalled = false,
                interfacesToClaim = 0;

            function claimedInterface() { if (self.endpoints.in && self.endpoints.out && !cbCalled) { cbCalled = true;
                    cb() } } this.usb.listInterfaces(this.handler, function(ifaces) { if (!ifaces) { self.errCb(errno.LIST_INTERFACES); return } self.claimDirection(ifaces, "in", function(inEp) { self.endpoints.in = inEp;
                    self.claimDirection(ifaces, "out", function(outEp) { self.endpoints.out = outEp;
                        cb() }) }) }) };
        USBTransaction.prototype.smartOpenDevice = function(device, _nullspeed, _nullmsg, cb) { var self = this;
            this.config.api.runtime.getManifestAsync(function(manifest) { var knownDevs = manifest.permissions.filter(function(p) { return !!p.usbDevices }).reduce(function(ret, p) { return ret.concat(p.usbDevices) }, []),
                    canDetect = knownDevs.some(function(d) { return device.vendorId == d.vendorId && device.productId == d.productId }); if (!canDetect) { self.errCb(errno.DEVICE_DETECTION, { device: device, knownDevices: knownDevs }); return } self.usb.getDevices(device, function(devs) { if (!devs) { self.errCb(errno.GET_DEVICES); return } if (devs.length == 0) { self.errCb(errno.NO_DEVICE, { searchedFor: device }); return } self._usedDevice = device;
                    self.openDevice(devs.pop(), cb) }) }) };
        USBTransaction.prototype.openDevice = function(dev, cb) { var self = this;
            this.usb.openDevice(dev, function(hndl) { var _callback = function() { self.setupEndpoints(function() { self.log.log("Endpoints:", self.endpoints);
                        cb(hndl) }) }; if (!hndl) { self.errCb(errno.OPEN_USB_DEVICE, { device: dev }); return } self.handler = hndl; var _getConfs = typeof self.usb.getConfigurations === "function" ? self.usb.getConfigurations.bind(self.usb.api) : function(_, cb) { cb() };
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
        USBTransaction.prototype.cmd = function(cmd, cb) { if (typeof this.cmdFunction === "undefined") { this.errCb(errno.UNDEFINED_COMMAND_PREFIX); return } var self = this,
                info = this.transferIn(this.cmdFunction, cmd[1] << 8 | cmd[0], cmd[3] << 8 | cmd[2], 4);
            this.xferMaybe(info, function(resp) { self.log.log("CMD:", buffer.hexRep(cmd), buffer.hexRep(resp.data));
                cb({ data: resp.data }) }) };
        USBTransaction.prototype.control = function(op, v1, v2, cb) { this.xfer(this.transferIn(op, v1, v2, 4), cb) };
        USBTransaction.prototype.errCb = function(err, ctx) { var self = this,
                context = ctx || {}; if (!this.usb || !this._usedDevice) { this.parentErrCb(err, ctx); return } this.usb.getDevices(this._usedDevice, function(devs) { if (devs.length <= 0) { context.lostDevice = true;
                    self.finalError(err, context); return } self.parentErrCb(err, ctx) }) };
        USBTransaction.prototype.localCleanup = function(cb) { this.disconnect(cb) };
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
            this.log.log("Performing control transfer", info.direction, buffer.hexRep([info.request, info.value, info.index]), "len:", info.length); if (info.direction == "out") { this.log.log("Data:", buffer.hexRep(buffer.bufToBin(info.data))) } this.refreshTimeout();
            scheduler.setImmediate(function() { self.transfer(self.handler, info, function(arg) { if (!arg || arg.resultCode != 0) { self.errCb(errno.TRANSFER_ERROR, { response: arg, request: info }); return } arg.data = buffer.bufToBin(arg.data);
                    self.log.log("Response was:", arg);
                    cb(arg) }) }) };
        USBTransaction.prototype.controlOut = function(op, value, index, data) { return { recipient: "device", direction: "out", requestType: "vendor", request: op, value: value, index: index, timeout: 5e3, data: buffer.binToBuf(data || []), length: data ? data.length : 0 } };
        USBTransaction.prototype.controlIn = function(op, value, index, length) { return { recipient: "device", direction: "in", requestType: "vendor", request: op, index: index, value: value, timeout: 5e3, length: length || 0 } };
        USBTransaction.prototype.bulkOut = function(msg, timeout) { if (msg.length > this.endpoints.out.maximumPacketSize) { this.log.error("Sending too large a packet:", msg.length, " > ", this.endpoints.out.maximumPacketSize) } return { direction: "out", endpoint: this.endpoints.out.address, data: buffer.binToBuf(msg), timeout: timeout || 1e4 } };
        USBTransaction.prototype.bulkIn = function(length, timeout) { if (length > this.endpoints.in.maximumPacketSize) { this.log.error("Requested too large a packet:", length, " > ", this.endpoints.in.maximumPacketSize) } return { direction: "in", endpoint: this.endpoints.in.address, length: length, timeout: timeout || 1e4 } };
        USBTransaction.prototype.maxPacketSize = function(length) { var min = 64; if (typeof this.maxXfer === "undefined" && this.maxXfer < min) { min = this.maxXfer } if (this.endpoints.in && this.endpoints.in.maximumPacketSize < min) { min = this.endpoints.in.maximumPacketSize } if (this.endpoints.out && this.endpoints.out.maximumPacketSize < min) { min = this.endpoints.out.maximumPacketSize } return min };
        module.exports.USBTransaction = USBTransaction }, { "./../buffer": 40, "./../errno": 42, "./../logging": 53, "./../scheduler": 68, "./../transaction": 71, "./../util": 72, "./memops": 57 }],
    68: [function(require, module, exports) {
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
            TestAsync.prototype.setTimeout = function(cb, ms) { this.idleRenew(); return this.index.put(this.wait(cb, (ms || 0) + this.now())) };

            function WaiterIndex() { this.db = {} } WaiterIndex.prototype = { put: function(obj) { this.rm(obj.id);
                    this.db[obj.id] = obj;
                    obj.onClose = this.rm.bind(this, obj.id); return obj.id }, get: function(id) { return this.db[id] }, rm: function(id) { var waiter = this.db[id]; if (!waiter) return;
                    waiter.close();
                    this.rawDel(id) }, rawDel: function(id) { delete this.db[id] }, minDue: function() { var self = this,
                        keys = Object.getOwnPropertyNames(this.db); if (keys.length > 0) { var minkey = keys.reduce(function(mink, k) { var cand = self.db[k],
                                min = self.db[mink]; if (!min) return min; if (min.due < cand.due) return mink; if (min.due == cand.due && min.id < cand.id) return mink; return k }); return this.get(minkey) } return null }, array: function() { var self = this; return Object.getOwnPropertyNames(this.db).map(function(k) { return self.db[k] }) }, length: function() { return Object.getOwnPropertyNames(this.db).length } }; if (TESTING) { module.exports = new TestAsync } else { module.exports = new Async } }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, {}],
    69: [function(require, module, exports) {
        (function(global) {
            function SettingsManager(settings) { this.settings = settings;
                this.default = null } SettingsManager.prototype = {
                set: function(key, value) { this.settings[key] = value },
                get: function(key, _default) { if (!this.has(key)) { if ([].slice.call(arguments).length == 1) { return this.default } return _default } return this.settings[key] },
                keys: function() {
                    return Object.getOwnPropertyNames(this.settings)
                },
                obj: function() { var dic = {},
                        self = this;
                    this.keys().reverse().forEach(function(k) { dic[k] = self.get(k) }); return dic },
                has: function(key) { return Object.hasOwnProperty.call(this.settings, key) },
                parent: function(settings) { return new MuxSettingsManager([this, toSettings(settings)]) },
                child: function(settings) { return new MuxSettingsManager([toSettings(settings), this]) }
            };

            function GetSettingsManager() { this.prefix = "babelfish_";
                this.settings = this.updatedSettings() } GetSettingsManager.prototype = Object.create(SettingsManager.prototype);
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
            MuxSettingsManager.prototype.keys = function() { var dic = {}; for (var i = this.managers.length - 1; i >= 0; i--) { this.managers[i].keys().reverse().forEach(function(k) { dic[k] = null }) } return Object.getOwnPropertyNames(dic) };
            MuxSettingsManager.prototype.get = function(key, _default) { for (var i = 0; i < this.managers.length; i++) { var m = this.managers[i]; if (!m.has(key)) continue; return m.get(key) } if ([].slice.call(arguments).length == 1) { return this.default } return _default };
            MuxSettingsManager.prototype.set = function(keu, value) { throw Error("Can't set to multiplexing settings manager") };

            function toSettings(obj) { if (typeof obj !== "object") return new SettingsManager({}); if (obj instanceof SettingsManager) return obj; return new SettingsManager(obj) } module.exports.toSettings = toSettings;
            module.exports.SettingsManager = SettingsManager;
            module.exports.GetSettingsManager = GetSettingsManager;
            module.exports.MuxSettingsManager = MuxSettingsManager
        }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, {}],
    70: [function(require, module, exports) { var scheduler = require("./scheduler.js"); var uniqueIds = 1,
            COMMON = 1,
            LEONARDO = 1,
            SERIAL_RESET = 1;

        function showArray(arr) { if (arr.length >= 5) { return "[" + arr.length + " items]" } return arr.reduce(function(ret, it) { if (typeof it === "string") return ret + ' "' + it + '"'; var val = show(it); if (!val) return ret; return ret + " " + val }, "") }

        function show(obj) { if (typeof obj === "function") { return null } if (obj instanceof Array) { return showArray(obj) } if (typeof obj === "string") { return obj } try { var str = JSON.stringify(obj); if (str.length < 100) { return str } } catch (e) { return obj + "" } }

        function Status(priority, message, timestamp, id, context) { this.priority = priority;
            this.context = context || null;
            this.message = message;
            this.timestamp = timestamp || null;
            this.id = id || uniqueIds++ } Status.prototype = { toCrazyLog: function() { return { isCrazyLog: true, metadata: this.toString() } }, copy: function(context) { return new Status(this.priority, this.message, scheduler.now(), this.id, context || this.context) }, toString: function() { var ctx = this.context || {}; return Object.getOwnPropertyNames(ctx).reduce(function(ret, key) { return ret.replace("{" + key + "}", show(ctx[key])) }, this.message) } };
        module.exports = { BABELFISH: new Status(0, "Welcome to babelfish!"), BLOCKING_STATES: new Status(COMMON, "Blocking states: {states}"), TRANSITION: new Status(COMMON, "Jumping to {state}: {args}"), CONNECTING: new Status(COMMON, "Connecting to: {device}"), SIGN_ON: new Status(COMMON, "Signing on"), CHECK_SIGNATURE: new Status(COMMON, "Checking signature"), HARDWARE_VERSION: new Status(COMMON, "Getting hardware version"), SOFTWARE_VERSION: new Status(COMMON, "Getting software version"), ENTER_PROGMODE: new Status(COMMON, "Entering programming mode"), START_WRITE_DATA: new Status(COMMON, "Starting to write data"), SYNC: new Status(COMMON, "Syncing with the device"), START_CHECK_DATA: new Status(COMMON, "Starting to check data"), LEAVE_PROGMODE: new Status(COMMON, "Leaving programming mode"), CLEANING_UP: new Status(COMMON, "Creaning up state"), WRITE_PAGE: new Status(COMMON, "Writing page to address {address}"), CHECK_PAGE: new Status(COMMON, "Checking page at address {address}"), PRECONFIGURING: new Status(SERIAL_RESET, "Preconfiguring serial device: {device}"), CONNECTING: new Status(SERIAL_RESET, "Connecting to device: {device}"), RESETTING: new Status(SERIAL_RESET, "Resetting device: {device}"), LEONARDO_RESET_START: new Status(LEONARDO, "Trying to auto-reset your device. If it does not reset automatically, please reset your device manually!"), LEONARDO_RESET_END: new Status(LEONARDO, "Leonardo board reset successfully!"), START_FLASH: new Status(LEONARDO, "Flashing device please wait...") } }, { "./scheduler.js": 68 }],
    71: [function(require, module, exports) { var utilModule = require("./util"),
            arraify = utilModule.arraify,
            deepCopy = utilModule.deepCopy,
            chain = utilModule.chain,
            log = require("./logging").getLog("Transaction"),
            ops = require("./protocols/memops"),
            buffer = require("./buffer"),
            scheduler = require("./scheduler"),
            status = require("./status.js"),
            FiniteStateMachine = require("./fsm.js").FiniteStateMachine,
            errno = require("./errno");

        function Transaction(config, finishCallback, errorCallback, parent) { FiniteStateMachine.apply(this, arguments) } Transaction.prototype = Object.create(FiniteStateMachine.prototype);
        Transaction.prototype.padOrSlice = function(data, offset, length) { var payload; if (offset + length > data.length) { payload = data.slice(offset, data.length); var padSize = length - payload.length; for (var i = 0; i < padSize; ++i) { payload.push(0) } } else { payload = data.slice(offset, offset + length) } return payload };
        Transaction.prototype.assert = function(bool, varMsg) { var args = arraify(arguments, 1, 2, "AssertionError"); if (!bool) { this.cbErr.apply(this, args) } };
        Transaction.prototype.maybeCheckSignature = function(cb, _bytes) { var self = this,
                bytes = _bytes || []; if (this.config.skipSignatureCheck) { return cb() } return this.checkSignature(cb, []) };
        Transaction.prototype.checkSignature = function(cb, bytes) { self = this;
            this.setStatus(status.CHECK_SIGNATURE); if (bytes.length >= 3) { if (bytes.toString() != self.config.avrdude.signature.toString()) { self.errCb(errno.SIGNATURE_FAIL, { expected: self.config.avrdude.signature, found: bytes }); return } cb(); return } this.readMemory("signature", bytes.length, function(data) { self.checkSignature(cb, bytes.concat(data)) }) };
        Transaction.prototype.writePageInBytes = function(offset, data, cb) { var self = this; if (data.length == 0) { cb(); return } this.writeMemory("flash", offset, data[0], function() { self.writePageInBytes(offset + 1, data.slice(1), cb) }) };
        Transaction.prototype.writeMemory = function(mem, addr, val, cb) { var writeOp = "WRITE",
                self = this,
                memory = this.config.avrdude.memory[mem]; if (memory.paged && memory.memops.LOADPAGE_LO) { writeOp = addr & 1 ? "LOADPAGE_HI" : "LOADPAGE_LO";
                addr = addr / 2 } if (memory.memops.WRITE_LO) { writeOp = addr & 1 ? "WRITE_HI" : "WRITE_LO";
                addr = addr / 2 } var writeByteArr = this.config.avrdude.memory[mem].memops[writeOp],
                writeCmd = ops.opToBin(writeByteArr, { ADDRESS: addr, INPUT: val });
            this.cmd(writeCmd, cb) };
        Transaction.prototype.readMemory = function(mem, addr, cb) { var readOp = "READ",
                self = this; if (this.config.avrdude.memory[mem].memops.READ_LO) { readOp = addr & 1 ? "READ_HI" : "READ_LO";
                addr = addr / 2 } var readByteArr = this.config.avrdude.memory[mem].memops[readOp],
                extAddrArr = this.config.avrdude.memory[mem].memops.EXT_ADDR,
                readCmd = ops.opToBin(readByteArr, { ADDRESS: addr }),
                extAddrCmd = extAddrArr && ops.opToBin(extAddrArr, { ADDRESS: addr }),
                maybeSetExtAddr = extAddrCmd ? this.cmd.bind(this, extAddrCmd) : function nop(cb) { cb() };
            maybeSetExtAddr(function() { self.cmd(readCmd, function(resp) { cb(ops.extractOpData("OUTPUT", readByteArr, resp.data || resp)) }) }) };
        Transaction.prototype.setupSpecialBits = function(controlBits, cb) { var self = this,
                knownBits = Object.getOwnPropertyNames(controlBits || {});
            this.log.log("Will write control bits:", controlBits);
            chain(knownBits.map(function(memName) { var addr = 0; return function(nextCallback) { if (controlBits[memName] !== null) {
                        function verifyMem(cb) { self.readMemory(memName, addr, function(resp) { self.log.log("Read memory", memName, ":", buffer.hexRep(resp)); if (resp[0] == controlBits[memName]) { nextCallback() } else { self.errCb(errno.SPECIAL_BIT_MEMORY_VERIFICATION, { respons: resp, memName: memName, controlBits: controlBits[memName] }); return } }) } self.writeMemory(memName, addr, controlBits[memName], verifyMem) } else { nextCallback() } } }), cb) };
        Transaction.prototype.operation = function(op, args, cb, cmd) { this.log.log("Running operation:", op); var operation = this.config.avrdude.ops[op]; return (cmd || this.cmd.bind(this))(ops.opToBin(operation, args), cb) };
        Transaction.prototype.maybeChipErase = function(cb, cmd) { if (this.config.chipErase) { return this.chipErase(cb, cmd) } return cb() };
        Transaction.prototype.chipErase = function(cb, cmd) { var self = this;
            scheduler.setTimeout(function() { self.operation("CHIP_ERASE", {}, function() { self.transition("setupSpecialBits", self.config.controlBits, cb) }, cmd) }, self.config.avrdude.chipEraseDelay / 1e3) };
        Transaction.prototype.confirmPages = function(confirmPagesCbs, cb) { var self = this,
                ccb = confirmPagesCbs[0]; if (ccb) { ccb(this.transitionCb("confirmPages", confirmPagesCbs.slice(1), cb)) } else { cb() } };
        module.exports.Transaction = Transaction }, { "./buffer": 40, "./errno": 42, "./fsm.js": 43, "./logging": 53, "./protocols/memops": 57, "./scheduler": 68, "./status.js": 70, "./util": 72 }],
    72: [function(require, module, exports) { var scheduler = require("./scheduler.js");

        function arraify(arrayLike, offset, prefixVarArgs) { var ret = Array.prototype.slice.call(arrayLike, offset),
                prefix = Array.prototype.slice.call(arguments, 2); return prefix.concat(ret) }

        function deepCopy(obj) { switch (typeof obj) {
                case "array":
                    return obj.map(deepCopy); break;
                case "object":
                    var ret = {};
                    Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = deepCopy(obj[k]) }); return ret; break;
                default:
                    return obj } }

        function shallowCopy(obj) { var ret = {};
            Object.getOwnPropertyNames(obj).forEach(function(k) { ret[k] = obj[k] }); return ret }

        function infinitePoll(timeout, cb) { var finished = false;

            function stopPoll() { finished = true } if (finished) { return } cb(function() { backendTimeout(function() { infinitePoll(timeout, cb) }, timeout) }); return stopPoll } var dbg = console.log.bind(console, "[Plugin Frontend]");

        function forEachWithCallback(array, iterationCb, finishCb) { var arr = array.slice();

            function nextCb() { if (arr.length != 0) { var item = arr.shift();
                    iterationCb(item, nextCb) } else { finishCb() } } nextCb() }

        function poll(maxRetries, timeout, cb, errCb) { if (maxRetries < 0) { if (errCb) { errCb(); return } throw Error("Retry limit exceeded") } cb(function() { backendTimeout(function() { poll(maxRetries - 1, timeout, cb, errCb) }, timeout) }) }

        function zip(varArgs) { var arrays = arraify(arguments); return arrays[0].map(function(_, i) { return arrays.map(function(array) { return array[i] }) }) }

        function arrEqual(varArgs) { var arrays = arraify(arguments); if (arrays.length == 0) { return true } if (arrays.some(function(a) { a.length != arrays[0].length })) return false; return !arrays[0].some(function(ele, i) { return arrays.some(function(array) { return array[i] != ele }) }) }

        function pyzip() { var args = [].slice.call(arguments); var shortest = args.length == 0 ? [] : args.reduce(function(a, b) { return a.length < b.length ? a : b }); return shortest.map(function(_, i) { return args.map(function(array) { return array[i] }) }) }

        function chain(functionArray, final) { if (functionArray.length == 0) { if (final) final(); return } var args = [chain.bind(null, functionArray.slice(1), final)].concat(arraify(arguments, 2));
            functionArray[0].apply(null, args) }

        function makeArrayOf(value, length) { assert(length < 1e5 && length >= 0, "Length of array too large or too small"); var arr = [],
                i = length; while (i--) { arr[i] = value } return arr }

        function assert(val, msg) { if (!val) throw Error("AssertionError: " + msg) }

        function merge(o1, o2) { var ret = {};
            Object.getOwnPropertyNames(o1).forEach(function(k) { ret[k] = o1[k] });
            Object.getOwnPropertyNames(o2).forEach(function(k) { ret[k] = o2[k] }); return ret } module.exports.makeArrayOf = makeArrayOf;
        module.exports.merge = merge;
        module.exports.arraify = arraify;
        module.exports.assert = assert;
        module.exports.chain = chain;
        module.exports.zip = zip;
        module.exports.deepCopy = deepCopy;
        module.exports.shallowCopy = shallowCopy;
        module.exports.infinitePoll = infinitePoll;
        module.exports.poll = poll;
        module.exports.dbg = dbg;
        module.exports.forEachWithCallback = forEachWithCallback;
        module.exports.arrEqual = arrEqual }, { "./scheduler.js": 68 }],
    73: [function(require, module, exports) {
        (function(global) { var protocols = require("./backend/protocols.js").protocols,
                util = require("./backend/util.js"),
                settings = require("./backend/settings.js"),
                defaultSettings = require("./default.js").settings,
                hexutil = require("./backend/hexparser.js"),
                scheduler = require("./backend/scheduler.js"),
                avrdudeconf = require("./backend/avrdudeconf.js"),
                Event = require("./event.js").Event,
                errno = require("./backend/errno.js"),
                status = require("./backend/status.js"),
                hexfile = require("./backend/hexfile.js"),
                base64 = require("./backend/base64.js"),
                logger = require("./backend/logging.js"),
                wrapper = require("./wrapper.js"),
                api = require("./api.js"),
                killFlashButton = require("./killflash.js"),
                asAvailable = require("./appavailability.js").asAvailable,
                SerialMonitor = require("./serialmonitor/monitor.js").Monitor;

            function Plugin() { var self = this;
                this.log = new logger.getLog("Plugin");
                this.log.log("New plugin.");
                this.version = null;
                asAvailable.call(this);
                this.onFound.setDispatcher(function(listener, version) { if (version) { listener(version); return } self.getVersion(function(version) { listener(version) }) });
                global.chrome = global.chrome || {};
                wrapper.wrap(global.chrome, self.api);
                this.onFound.addListener(function(version) { if (self.serialMonitor) { self.serialMonitor.disconnect() } self.serial = self.api.serial });
                this.serialMonitor = null;
                this.onLost.addListener(function() { self.close(false) });
                this.onError.addListener(function(error) { if (error.badVersion) { self.onFound.dispatch(error.badVersion) } });
                this.onRawMessageReceived = new Event } Plugin.prototype = { errorCallback: function(from, msg, status) { console.error("[" + from + "] ", msg, "(status: " + status + ")") }, serialRead: function(port, baudrate, readCb, connectErrorCb) { var self = this;

                    function handleClose(err) { var success = err.id == errno.SUCCESS.id,
                            error = !success,
                            deviceLost = err.id == errno.SERIAL_MONITOR_DEVICE_LOST.id,
                            connectError = err.id == errno.SERIAL_MONITOR_CONNECT.id || err.id == errno.RESOURCE_BUSY.id || err.id == errno.RESOURCE_BUSY_FROM_CHROME.id,
                            normalClose = success || deviceLost; if (deviceLost) { self.errorCallback(null, err.shortMessage(), 1) } if (normalClose || connectError) { self.serialMonitorDisconnect() } if (connectError) { connectErrorCb(null, err.value) } } this.serialMonitor = new SerialMonitor(port, Number.parseInt(baudrate), this.api);
                    this.serialMonitor.onRead.addListener(function(msg) { readCb(null, msg) });
                    this.serialMonitor.onRead.addListener(function(msg) { scheduler.setImmediate(function() { self.onRawMessageReceived.dispatch(msg) }) });
                    this.serialMonitor.onClose.addListener(handleClose) }, flashBootloader: function(device, protocol, communication, speed, force, delay, high_fuses, low_fuses, extended_fuses, unlock_bits, lock_bits, mcu, cb, _extraConfig) {
                    function toint(hex) { return hex ? Number.parseInt(hex.substring(2), 16) : null } var _ = null,
                        controlBits = { lfuse: toint(low_fuses), efuse: toint(extended_fuses), lock: toint(unlock_bits), hfuse: toint(high_fuses) },
                        extraConfig = settings.toSettings(_extraConfig).child({ controlBits: controlBits, cleanControlBits: { lock: toint(lock_bits) }, chipErase: true }); var p = new hexfile.Parser(this.hexString),
                        data = p.data(); if (data === null) { cb("extension", p.lastError); return } data.defaultByte = 255;
                    this.flashWithProgrammer(device, data, _, protocol, communication, speed, force, delay, mcu, cb, extraConfig) }, flashWithProgrammer: function(device, code, maxsize, protocol, communication, speed, force, delay, mcu, cb, _extraConfig) { var extraConfig = settings.toSettings(_extraConfig).child({ avoidTwiggleDTR: true, confirmPages: true, readSwVersion: true, chipErase: true, skipSignatureCheck: force == "true", communication: communication || "usb", dryRun: window.dryRun });
                    this.flash(device, code, maxsize, protocol, false, speed, mcu, cb, extraConfig) }, flash: function(device, code, maxsize, protocol, disable_flushing, speed, mcu, cb, _extraConfig) { this.log.log("Flashing " + device); if (typeof code === "string") { var p = new base64.Parser(code, 0, maxsize);
                        code = p.data(); if (code === null) { cb("extension-client", p.lastError.value); return } } var from = null,
                        self = this,
                        config = settings.toSettings(_extraConfig).child({ api: this.api, maxsize: Number(maxsize), protocol: protocol, disableFlushing: disable_flushing && disable_flushing != "false", speed: Number(speed), mcu: mcu, avrdude: avrdudeconf.getMCUConf(mcu) }).parent(defaultSettings),
                        finishCallback = function() { var pluginReturnValue = 0;
                            self.log.log("Flash success");
                            cb(from, pluginReturnValue);
                            self.transaction = null },
                        errorCallback = function(id, msg) { scheduler.setTimeout(function() { self.transaction = null; var warnOrError = id >= defaultSettings.get("warningReturnValueRange")[0] && id <= defaultSettings.get("warningReturnValueRange")[1] ? 1 : 0;
                                self.errorCallback("extension-client", msg, warnOrError) });
                            self.log.log("Flash fail.");
                            self.lastFlashResult = msg;
                            self.transaction = null;
                            cb(from, id) },
                        messageCallback = function(s) { if (s.id == status.BLOCKING_STATES.id) { scheduler.setTimeout(function() { self.sendUiMessage(s.toCrazyLog()) }) } var msg = null; if (!(s.id != status.LEONARDO_RESET_START.id && s.priority > 0 && !config.get("statusLog"))) { msg = s.toString() } if (config.get("killButton")) { msg = (msg || "Flashing device...") + killFlashButton(self.transaction) } if (msg) self.sendUiMessage(msg) };

                    function doflash() { var dodoFlash = function() { self.log.log("Code length", code.length || code.data.length, "Protocol:", protocols, "Device:", device);
                            self.transaction.flash(device, code.squashed()) };
                        self.transaction = new(protocols[config.get("communication") || "serial"][protocol])(config.obj(), finishCallback, errorCallback);
                        self.transaction.onStatusChange.addListener(messageCallback); if (self.transaction.destroyOtherConnections) { self.transaction.destroyOtherConnections(device, dodoFlash); return } dodoFlash() } if (self.transaction) { self.transaction.cleanup(doflash); return } doflash() }, cachingGetDevices: function(cb) { var self = this; if (!self._cachedPorts) { this.serial.getDevices(function(devs) { var devUniquify = {};
                            (devs || []).forEach(function(d) { var trueDevName = d.path.replace("/dev/tty.", "/dev/cu."); if (!devUniquify[trueDevName] || d.path == trueDevName) devUniquify[trueDevName] = d });
                            self._cachedPorts = Object.getOwnPropertyNames(devUniquify).map(function(k) { return devUniquify[k] });
                            cb(self._cachedPorts);
                            setTimeout(function() { self._cachedPorts = null }, 1e3) }); return } cb(self._cachedPorts) }, availablePorts: function(cb) { this.cachingGetDevices(function(devs) { cb(this.pluginDevsFormat_(devs).map(function(d) { return d.port }).join(",")) }.bind(this)) }, getPorts: function(cb) { var self = this;
                    this.cachingGetDevices(function(devs) { var ret = JSON.stringify(self.pluginDevsFormat_(devs));
                        cb(ret) }) }, pluginDevsFormat_: function(devs) { var set_ = {};
                    devs.forEach(function(d) { set_[d.path] = true }); return Object.getOwnPropertyNames(set_).map(function(dev) { return { port: dev } }) }, probeUSB: function(cb) { this.availablePorts(cb) }, getFlashResult: function(cb) { cb(this.lastFlashResult) }, getVersion: function(cb) { var self = this; if (this.version) { cb(this.version); return } this.api.runtime.getManifestAsync(function(manifest) { if (self.api.runtime.lastError) { throw new Error(self.api.runtime.lastError.message || self.api.runtime.lastError) } if (!manifest) { throw Error("Could not retrieve app version") } self.version = manifest.version;
                        cb(self.version) }) }, saveToHex: function(strData) { console.error("Not implemented") }, serialWrite: function(strData, cb) { this.serialMonitor.writer.write(strData, cb) }, setCallback: function(cb) { this.sendUiMessage = function(msg) { if (msg === "disconnect") msg = "disconnect ";
                        cb(null, msg) };
                    this.serialMonitorDisconnect = function() { cb(null, "disconnect") }; return true }, sendUiMessage: function() { console.warn("Use setCallback to provide a way of communicating with the ui.") }, serialMonitorDisconnect: function() { console.warn("Use setCallback to provide a way of communicating with the ui.") }, setErrorCallback: function(cb) { this.errorCallback = cb; return true }, deleteMap: function() { this.close() }, closeTab: function() { this.close() }, serialMonitorSetStatus: function(cb) { this.serialMonitor.disconnect(cb);
                    this.serialMonitor = null }, saveToHex: function(hexString) { this.hexString = hexString }, close: function(shutdown, cb) { if (this.serialMonitor) { this.serialMonitor.disconnect();
                        this.serialMonitor = null } this.version = null; if (this.transaction) { this.transaction.cleanup() } if (shutdown) { this.shutdown(cb); return } this.disconnect(cb) }, debugEnable: function(verbosity) { if (typeof verbosity === "number") global.verbosity = verbosity } };
            global.CodebenderPlugin = Plugin;
            module.exports = CodebenderPlugin }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./api.js": 35, "./appavailability.js": 36, "./backend/avrdudeconf.js": 38, "./backend/base64.js": 39, "./backend/errno.js": 42, "./backend/hexfile.js": 44, "./backend/hexparser.js": 45, "./backend/logging.js": 53, "./backend/protocols.js": 55, "./backend/scheduler.js": 68, "./backend/settings.js": 69, "./backend/status.js": 70, "./backend/util.js": 72, "./default.js": 74, "./event.js": 75, "./killflash.js": 76, "./serialmonitor/monitor.js": 79, "./wrapper.js": 85 }],
    74: [function(require, module, exports) {
        (function(global) { var settings = require("./backend/settings.js"),
                defaults = { checkPages: true, logger: "default", developer: false, warningReturnValueRange: [20500, 21e3] },
                userSettings = { statusLog: false, killButton: false, verbosity: 0 },
                developerSettings = { statusLog: true, killButton: true, verbosity: 5 };

            function getDefaultSettings() { var def = settings.toSettings(defaults),
                    mid = settings.toSettings(userSettings),
                    adhoc = (new settings.GetSettingsManager).child(global.babelfishSettings); if (adhoc.get("developer") || def.get("developer")) { mid = developerSettings;
                    console.warn("Enabling developer settings:", developerSettings);
                    console.warn("User settings are: ", userSettings);
                    console.warn("Remember you can override settings:");
                    console.warn("- editing the babelfishSettings object");
                    console.warn("- `babelfish_OPTION=JSON_ENCODED_VALUE` " + "(the json value will fallback to raw string.");
                    console.warn("other settings include (but not limited):", defaults) } return def.child(mid).child(adhoc) } global.babelfishSettings = {};
            module.exports.settings = getDefaultSettings() }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./backend/settings.js": 69 }],
    75: [function(require, module, exports) { var scheduler = require("./backend/scheduler.js");

        function Event() { this.listeners = [];
            this.pollCb = null } Event.prototype = { poll: function(pollCb) { this.pollCb = pollCb; if (pollCb) { this.doPoll() } }, doPoll: function(cb) { var self = this,
                    next = this.doPoll.bind(this),
                    dispatch = this.dispatch.bind(this);
                scheduler.setImmediate(function() { if (!self.pollCb || self.listeners.length == 0 || self.paused) { return } self.pollCb(next, dispatch); if (cb) cb() }) }, addListener: function(cb, config) { if (!cb || this.listeners.some(function(l) { return l === cb })) { return } if (this.pollCb && this.listeners.length == 0) { scheduler.setImmediate(this.doPoll.bind(this)) } cb.forceAsync = !!(config || {}).forceAsync;
                this.listeners.push(cb) }, hasListener: function(cb) { return this.listeners.some(function(l) { return l === cb }) }, removeListener: function(cb) { this.listeners = this.listeners.filter(function(l) { return l !== cb }) }, dispatch: function(varArgs) { var args = [].slice.call(arguments),
                    self = this;
                this.listeners.some(function(l) {
                    function callListener() { if (!self.dispatcher) { return l.apply(null, args) } return self.dispatcher.apply(self, [l].concat(args)) } if (l.forceAsync) { scheduler.setImmediate(callListener); return } callListener() }) }, close: function() { this.listeners = [];
                this.poll(null) }, setDispatcher: function(cb) { this.dispatcher = cb } };
        module.exports.Event = Event }, { "./backend/scheduler.js": 68 }],
    76: [function(require, module, exports) {
        (function(global) { var errno = require("./backend/errno.js");
            global.babelfish_killFlash = function() { window.currentTransaction.finalError(errno.KILLED, { method: "button" }) };

            function killFlashButton(transaction) { global.currentTransaction = transaction; return ' <button onclick="babelfish_killFlash()" style="float: right;" class="killbutton">Kill Flash</button>' } module.exports = killFlashButton }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {}) }, { "./backend/errno.js": 42 }],
    77: [function(require, module, exports) { var errno = require("./../backend/errno.js"),
            ReceiveErrorEvent = require("./receiveerrorevent.js").ReceiveErrorEvent,
            Event = require("./../event.js").Event;

        function Connection(port, baudrate, api) { var self = this;
            this.api = api;
            this.disconnected = false;
            this.onConnected = new Event;
            this.onDisconnected = new Event;
            this.onReceiveError = null;
            this.port = port;
            this.baudrate = baudrate;
            this.isTaken(this.port, function(taken) { if (taken) { self.onDisconnected.dispatch(errno.RESOURCE_BUSY_FROM_CHROME); return } self.connect(port, baudrate) }) } Connection.prototype = { errorDispatcher: function(listener, error) { if (error.error !== "device_lost") { listener(errno.UNKNOWN_MONITOR_ERROR.copy({ apiError: error })); return } listener(errno.SERIAL_MONITOR_DEVICE_LOST.copy()) }, isTaken: function(port, cb) { this.api.serial.getConnections(function(cnxs) { var taken = cnxs.some(function(c) { return c.name == port });
                    cb(taken) }) }, connect: function(port, baudrate) { var self = this;
                this.api.serial.connect(port, { name: port, bitrate: baudrate }, function(info) { if (!info) { self.disconnect(errno.SERIAL_MONITOR_CONNECT); return } self.onReceiveError = new ReceiveErrorEvent(info.connectionId, self.api);
                    self.onReceiveError.setDispatcher(self.errorDispatcher.bind(self));
                    self.onReceiveError.addListener(self.disconnect.bind(self));
                    self.info = info;
                    self.onConnected.dispatch(info);
                    self.onConnected.close() }) }, disconnect: function(error) { var self = this; if (this.disconnected) return;

                function disconnect(err) { self.disconnected = true;
                    self.onDisconnected.dispatch(err || errno.SUCCESS); if (self.onReceiveError) self.onReceiveError.close();
                    self.onConnected.close();
                    self.onDisconnected.close() } if (!this.info) { disconnect(error || errno.SERIAL_MONITOR_PREMATURE_DISCONNECT); return } self.api.serial.getConnections(function(cnx) { if (!cnx.some(function(c) { return c.connectionId == self.info.connectionId })) { disconnect(error || errno.SERIAL_MONITOR_DEVICE_LOST); return } self.api.serial.disconnect(self.info.connectionId, function(ok) { var err = null; if (!ok) { err = errno.SERIAL_MONITOR_DISCONNECT } disconnect(err || error) }) }) } };
        module.exports.Connection = Connection }, { "./../backend/errno.js": 42, "./../event.js": 75, "./receiveerrorevent.js": 82 }],
    78: [function(require, module, exports) { var Event = require("./../event.js").Event,
            util = require("./util.js"),
            buffer = require("./../backend/buffer.js"),
            getLog = require("./../backend/logging.js").getLog,
            scheduler = require("./../backend/scheduler.js");

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
        module.exports.LineBuffer = LineBuffer }, { "./../backend/buffer.js": 40, "./../backend/logging.js": 53, "./../backend/scheduler.js": 68, "./../event.js": 75, "./util.js": 83 }],
    79: [function(require, module, exports) { var Connection = require("./connection.js").Connection,
            Writer = require("./writer.js").Writer,
            Reader = require("./reader.js").Reader,
            Event = require("./../event.js").Event,
            errno = require("./../backend/errno.js");

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
                self.onConnected.close() }) } Monitor.prototype = { write: function(strData, cb) { if (this.writer) { this.writer.write(strData, cb); return } this.onError.display(errno.SERIAL_MONITOR_WRITE_BEFORE_CONNECT);
                cb() }, disconnect: function(retVal) { if (this.closed) return;
                this.closed = true;
                this.connection.disconnect(); if (this.reader) this.reader.close();
                this.onConnected.close();
                this.onClose.dispatch(retVal || errno.SUCCESS);
                this.onClose.close() } };
        module.exports.Monitor = Monitor }, { "./../backend/errno.js": 42, "./../event.js": 75, "./connection.js": 77, "./reader.js": 80, "./writer.js": 84 }],
    80: [function(require, module, exports) {
        var Event = require("./../event.js").Event,
            util = require("./util.js"),
            buffer = require("./../backend/buffer.js"),
            LineBuffer = require("./linebuffer.js").LineBuffer,
            rs = require("./readerstates.js"),
            getLog = require("./../backend/logging.js").getLog,
            scheduler = require("./../backend/scheduler.js");

        function PreliminaryState(reader, cons) { this.log = getLog("PreliminaryReaderState");
            rs.State.call(this, reader, cons);
            this.name = "PreliminaryState";
            this.reader.leftoverBuffers = {} } PreliminaryState.prototype = Object.create(rs.State.prototype);
        PreliminaryState.prototype._handler = function(msg) { var data = buffer.bufToBin(msg.data);
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
        NormalState.prototype._handler = function(msg) { var arr = buffer.bufToBin(msg.data);
            this.log.log("Got bytes:", arr.length);
            this.buffer = this.buffer.updated(arr, this.reader.dispatch.bind(this.reader));
            this.reader.dispatch(this.buffer.flushData) };
        NormalState.prototype._destroy = function() { this.buffer.freeze() };

        function Reader(api) { this.log = getLog("Reader");
            Event.call(this);
            this.api = api;
            this.leftoverBuffers = {};
            this.stateList = new rs.StateCons(this, PreliminaryState, rs.NilCons) } Reader.prototype = Object.create(Event.prototype);
        Reader.prototype.init = function(connectionId) {
            this.buffer = new LineBuffer;
            this.connectionId = connectionId;
            this.stateList = new rs.StateCons(this, NormalState, this.stateList)
        };
        Reader.prototype.readHandler_ = function(message) { var stringMessage = buffer.bufToBin(message);
            this.buffer = this.buffer.updated(stringMessage, this.dispatch.bind(this));
            this.log.log("Flushing bytes:", this.buffer.flushData.length);
            this.dispatch(this.buffer.flushData) };
        Reader.prototype.close = function() { Event.prototype.close.call(this);
            this.stateList.destroy();
            this.stateList = rs.NilCons;
            this.leftoverBuffers = {} };
        module.exports.Reader = Reader
    }, { "./../backend/buffer.js": 40, "./../backend/logging.js": 53, "./../backend/scheduler.js": 68, "./../event.js": 75, "./linebuffer.js": 78, "./readerstates.js": 81, "./util.js": 83 }],
    81: [function(require, module, exports) { var getLog = require("./../backend/logging.js").getLog;

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
        module.exports.stateFactory = stateFactory }, { "./../backend/logging.js": 53 }],
    82: [function(require, module, exports) { var scheduler = require("./../backend/scheduler.js"),
            Event = require("./../event.js").Event;

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
        ReceiveErrorEvent.prototype.close = function() { Event.prototype.close.call(this); if (this.nextPoll) { scheduler.clearTimeout(this.nextPoll.handler) } this.closed = true;
            this.api.serial.onReceiveError.removeListener(this.chromeListener) };
        module.exports.ReceiveErrorEvent = ReceiveErrorEvent }, { "./../backend/scheduler.js": 68, "./../event.js": 75 }],
    83: [function(require, module, exports) {
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
    84: [function(require, module, exports) { var errno = require("./../backend/errno.js"),
            getLog = require("./../backend/logging.js").getLog,
            scheduler = require("./../backend/scheduler.js"),
            Event = require("./../event.js").Event,
            util = require("./util.js"),
            buffer = require("./../backend/buffer.js");

        function Writer(api) { this.strData = [];
            this.connectionId = null;
            this.api = api;
            this.onWriteFail = new Event;
            this.log = getLog("Writer") } Writer.prototype = { init: function(connectionId) { this.connectionId = connectionId; if (this.strData.length > 0) { this.write(this.data) } }, write: function(strData, cb) { if (!this.connectionId) { this.data = this.strData + strData;
                    scheduler.setTimeout(cb); return } var self = this,
                    data = util.strToUtf8Array(strData);
                this.api.serial.send(this.connectionId, buffer.binToBuf(data), function(sendInfo) { self.log.log("Sent data of length:", data.length); if (!sendInfo || sendInfo.error) { self.onWriteFail.dispatch(errno.SERIAL_MONITOR_WRITE); return } if (cb) cb(sendInfo) }) } };
        module.exports.Writer = Writer }, { "./../backend/buffer.js": 40, "./../backend/errno.js": 42, "./../backend/logging.js": 53, "./../backend/scheduler.js": 68, "./../event.js": 75, "./util.js": 83 }],
    85: [function(require, module, exports) {
        function PropertyDescriptor(element, prop) { var desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), prop); if (desc) { Object.getOwnPropertyNames(desc).forEach(function(pp) { if (pp != "value" && true) { console.log(prop + "[" + pp + "]");
                        this[pp] = element[pp] } }) } throw Error("Could not determine property descruptor of plugin property '" + prop);
            this.get = function() { return element[prop] };
            this.set = function(val) { element[prop] = val } }

        function prototypeProperties(obj) { return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)) }

        function wrap(wrapper, obj) { prototypeProperties(obj).forEach(function(attr) { if (typeof wrapper[attr] !== "undefined") { return } if (obj[attr] instanceof Function) { wrapper[attr] = obj[attr].bind(obj); return } var descr = new PropertyDescriptor(obj, attr);
                Object.defineProperty(wrapper, attr, descr) }) } module.exports.wrap = wrap }, {}],
    86: [function(require, module, exports) { var assert = require("assert");

        function deepCopy(obj) { var ret = {}; if (typeof obj !== "object" || obj instanceof ArrayBuffer) return obj; if (obj instanceof Array) { return obj.map(deepCopy) } if (obj) Object.getOwnPropertyNames(obj).forEach(function(n) { ret[n] = deepCopy(obj[n]) }); return ret }

        function arrToBuf(hex) { tc(hex, Array); var buffer = new ArrayBuffer(hex.length); var bufferView = new Uint8Array(buffer); for (var i = 0; i < hex.length; i++) { bufferView[i] = hex[i] } return buffer }

        function bufToArr(bin) { tc(bin, ArrayBuffer); var bufferView = new Uint8Array(bin); var hexes = []; for (var i = 0; i < bufferView.length; ++i) { hexes.push(bufferView[i]) } return hexes }

        function tc(v, c) { if (typeof c !== "function") throw Error(c + " is not a type."); if (v instanceof c) return; throw Error(v + " not of type " + c.name) }

        function jt(json, type) { if (json._type === type) return; var s = JSON.stringify(json, null, 2); throw Error(json._type + " should be a " + type + ": " + s) }

        function Closure(fn) { if (typeof fn !== "function") throw Error("Closures are function wrappers");
            this.fn = fn;
            this.type = "closure" } Closure.deserialize = function(apimessages, json) { jt(json, "closure");
            tc(apimessages[json.callback_from], ApiMessage); return apimessages[json.callback_from].closure() };
        Closure.prototype = { assertEqual: function(json, apimessages) { jt(json, "closure");
                assert.equal(typeof json.callback_from, "number"); if (json.callback_from < apimessages.length) { assert.equal(this.fn, apimessages[json.callback_from].closure().fn) } }, serialize: function(apimessages) { for (var i = 0; i < apimessages.length; i++) { if (this.fn === (apimessages[i].closure() || {}).fn) { return { _type: this.type, callback_from: i } } } throw Error("Closure callback not found in API messages") }, callable: function(args) { var self = this; return function() { return self.fn.apply(null, args ? args.raw() : []) } } }; var JSWrappedObject = { serialize: function(apimessages, value) { if (value instanceof ArrayBuffer) { return { _type: "wrapped_js_object", wrapped_type: "ArrayBuffer", value: bufToArr(value) } } if (typeof value === "object" && value.data && value.data instanceof ArrayBuffer) { var ret = {};
                    Object.getOwnPropertyNames(value).forEach(function(k) { ret[k] = JSWrappedObject.serialize(apimessages, value[k]) }); return ret } if (value instanceof Closure) { return value.serialize(apimessages) } return deepCopy(value) }, assertEqual: function(lifted, json, apimessages) { if (typeof json !== "object") { assert.equal(lifted, json); return } if (typeof json.data === "object" && json.data._type === "wrapped_js_object" && json.data.wrapped_type === "ArrayBuffer") { tc(lifted.data, ArrayBuffer); var jsonKeys = Object.getOwnPropertyNames(json),
                        liftedKeys = Object.getOwnPropertyNames(lifted);
                    assert.deepEqual(jsonKeys, liftedKeys);
                    jsonKeys.forEach(function(k) { JSWrappedObject.assertEqual(lifted[k], json[k], apimessages) }); return } if (lifted instanceof Closure) { lifted.assertEqual(json, apimessages); return } if (json._type !== "wrapped_js_object") { assert.deepEqual(lifted, json); return } if (json.wrapped_type === "ArrayBuffer") { assert.deepEqual(bufToArr(lifted), json.value); return } throw Error("Can't compare " + json + " and " + lifted) }, deserialize: function(apimessages, json) { if (typeof json !== "object") return json; if (json._type === "closure") return Closure.deserialize(apimessages, json); if (typeof json.data === "object" && json.data._type === "wrapped_js_object" && json.data.wrapped_type === "ArrayBuffer") { var ret = {};
                    Object.getOwnPropertyNames(json).forEach(function(k) { ret[k] = JSWrappedObject.deserialize([], json[k]) }); return ret } if (json._type !== "wrapped_js_object") return json; if (json.wrapped_type === "ArrayBuffer") return arrToBuf(json.value); throw Error("Could not deserialize " + json) } };

        function Arguments(deserializedArgs) { var self = this;
            this.type = "arguments";
            this.args = deserializedArgs.map(function(a) { if (typeof a === "function") return new Closure(a); return deepCopy(a) }) } Arguments.deserialize = function(apimessages, json) { assert.equal(json._type, "arguments"); return new Arguments(json.args.map(JSWrappedObject.deserialize.bind(null, apimessages))) };
        Arguments.prototype = { closures: function() { return this.args.filter(function(a) { return a instanceof Closure }) }, serialize: function(apimessages) { return { _type: this.type, args: this.args.map(JSWrappedObject.serialize.bind(null, apimessages)) } }, raw: function() { return this.args.map(function(a) { if (a instanceof Closure) { return a.fn } return a }) }, assertEqual: function(json, apimessages) { assert.equal(json._type, this.type);
                assert.equal(json.args.length, this.args.length); for (var i = 0; i < json.args.length; i++) { JSWrappedObject.assertEqual(this.args[i], json.args[i], apimessages) } } };

        function ClosureCall(closure, args) { tc(closure, Closure);
            tc(args, Arguments);
            this.closure = closure;
            this.args = args;
            this.type = "closure_call" } ClosureCall.deserialize = function(apimessages, json) { jt(json, "closure_call"); return new ClosureCall(Closure.deserialize(apimessages, json.closure), Arguments.deserialize(apimessages, json.args)) };
        ClosureCall.prototype = { serialize: function(apimessages) { return { _type: this.type, closure: this.closure.serialize(apimessages), args: this.args.serialize(apimessages) } }, callable: function() { return this.closure.callable(this.args) } };

        function ReturnValue(value) { this.type = "return_value";
            this.value = value } ReturnValue.deserialize = function(apimessages, json) { jt(json, "return_value"); return new ReturnValue(json) };
        ReturnValue.prototype = { serialize: function(apimessages) { return { _type: this.type, value: this.value } } };

        function ApiMessageReturn(apimessage, val) { tc(val, ReturnValue);
            tc(apimessage, ApiMessage);
            this.type = "api_message_return";
            this.value = val;
            this.apimessage = apimessage } ApiMessageReturn.deserialize = function(apimessages, json) { jt(json, "api_message_return"); return new ApiMessageReturn(apimessages[json.from_api_message], ReturnValue.deserialize(apimessages, json.value)) };
        ApiMessageReturn.prototype = { serialize: function(apimessages) { for (var i = apimessages.length - 1; i >= 0; i--) { if (this.apimessage === apimessages[i]) { return { _type: this.type, from_api_message: i, value: this.value.serialize(apimessages) } } } throw Error("Returning a non-called apimessage") } };

        function ApiMessage(name, args) { tc(args, Arguments);
            this.name = name;
            this.args = args;
            this.type = "api_message" } ApiMessage.deserialize = function(apimessages, json) { assert.equal(json._type, "api_message"); return new ApiMessage(json.name, Arguments.deserialize(json.args)) };
        ApiMessage.prototype = { closure: function() { return this.args.closures()[0] || null }, serialize: function(apimessages) { return { _type: this.type, args: this.args.serialize(apimessages), name: this.name } }, assertEqual: function(serialized, apimessages) { assert.equal(serialized._type, this.type);
                assert.equal(serialized.name, this.name, "Called method:" + JSON.stringify(this.serialize(apimessages.concat([this])), null, 2) + "Checker method:" + JSON.stringify(serialized, null, 2) + "Latest: " + JSON.stringify(apimessages, null, 2));
                this.args.assertEqual(serialized.args, apimessages) } };

        function traverseMethodTree(methods, wrap, rawApi) { var api = {};
            methods.forEach(function(m) {
                function loop(path, api, cursor) { if (path.length == 1) { api[path[0]] = wrap(m, cursor[path[0]], cursor); return } api[path[0]] = api[path[0]] || {};
                    cursor = cursor[path[0]] || {};
                    loop(path.slice(1), api[path[0]], cursor) } loop(m.split("."), api, rawApi || {}) }); return api }

        function Checker(serialLog, methods, scheduler) { var self = this;
            this.serialLog = serialLog.slice();
            this.runMessageLog = [];
            this.next = null;
            this.type = "checker";
            this.methods = methods;
            this.api = traverseMethodTree(methods, this.wrapMethod.bind(this));
            this.sanityCheckLog(serialLog);
            this.scheduler = scheduler || { setTimeout: setTimeout } } Checker.deserialize = function(_, json, scheduler) { assert.equal(json._type, "checker"); return new Checker(json.log, json.methods, scheduler) };
        Checker.prototype = { sanityCheckLog: function(jsonLog) { var returns = jsonLog.filter(function(l) { return l._type == "api_message_return" }),
                    calls = jsonLog.filter(function(l) { return l._type == "api_message_return" });
                returns.forEach(function(r) { if (!calls[r.from_api_message]) { throw Error("Returned from non-called:" + r) } if (calls[r.from_api_message] == "returned") { throw Error("Second return from same call:" + r) } calls[r.from_api_message] = "returned" });
                calls.forEach(function(c) { if (c !== "returned") { throw Error("Method probably raised an error:" + c) } }) }, serialize: function(_) { return { _type: this.type, log: this.serialLog, methods: this.methods } }, done: function() { assert.deepEqual(this.serialLog, []) }, scheduleWake: function() { if (this.next) return; var self = this;
                this.next = this.scheduler.setTimeout(function() { self.next = null; if (self.serialLog.length == 0 || self.serialLog[0]._type != "closure_call") return; var cc = ClosureCall.deserialize(self.runMessageLog, self.serialLog.shift());
                    cc.callable().call(null);
                    self.scheduleWake() }) }, wrapMethod: function(name) { var self = this; return function checkedMethod() { assert(self.serialLog.length > 0, "Method call not recorded"); var am = self.serialLog.shift(),
                        currentAm = new ApiMessage(name, new Arguments([].slice.call(arguments))),
                        apimessages = self.runMessageLog.filter(function(ml) { return ml instanceof ApiMessage });
                    currentAm.assertEqual(am, apimessages);
                    self.runMessageLog.push(currentAm); while (self.serialLog[0]._type !== "api_message_return") { var sl = self.serialLog.shift(),
                            cc = ClosureCall.deserialize(self.runMessageLog, sl);
                        cc.callable().call(null);
                        assert(self.serialLog.length > 0, "Api method " + name + " did not return") } var retobj = ApiMessageReturn.deserialize(self.runMessageLog, self.serialLog.shift());
                    assert(retobj.apimessage === currentAm);
                    self.scheduleWake(); return retobj.value.value } } };

        function Recorder(api, methods) { var self = this;
            this.log = [];
            this.api = traverseMethodTree(methods, this.wrapMethod.bind(this), api);
            this.methods = methods;
            this.callbacks = [] } Recorder.prototype = { apiMessages: function() { return this.log.filter(function(l) { return l instanceof ApiMessage }) }, checker: function() { var am = this.apiMessages(); return new Checker(this.log.map(function(l) { return l.serialize(am) }), this.methods) }, wrapMethod: function(name, ref, parent) { var self = this; return function wrappedMethod() { var args = [].slice.call(arguments),
                        am = new ApiMessage(name, new Arguments(args));
                    self.log.push(am); var ret = ref.apply(parent, self.wrapCallbacks(args));
                    self.log.push(new ApiMessageReturn(am, new ReturnValue(ret))); return ret } }, wrapCallbacks: function(args) { var self = this; return args.map(function(a) { if (typeof a === "function") { return self.wrapCallback(a) } return a }) }, wrapCallback: function(fn) { var self = this;

                function wrappedCallback() { var closure = new Closure(fn);
                    self.log.push(new ClosureCall(closure, new Arguments([].slice.call(arguments)))); return fn.apply(null, arguments) } for (var i = 0; i < this.callbacks.length; i++) { if (this.callbacks[i].fn === fn) return this.callbacks[i].wrappedCallback } this.callbacks.push({ fn: fn, wrappedCallback: wrappedCallback }); return wrappedCallback } };
        module.exports.Closure = Closure;
        module.exports.Arguments = Arguments;
        module.exports.ClosureCall = ClosureCall;
        module.exports.ApiMessage = ApiMessage;
        module.exports.Checker = Checker;
        module.exports.Recorder = Recorder;
        module.exports.JSWrappedObject = JSWrappedObject }, { assert: 88 }],
    87: [function(require, module, exports) { var internal = require("./black-mirror.js");
        module.exports = { Checker: internal.Checker, Recorder: internal.Recorder } }, { "./black-mirror.js": 86 }],
    88: [function(require, module, exports) { var util = require("util/"); var pSlice = Array.prototype.slice; var hasOwn = Object.prototype.hasOwnProperty; var assert = module.exports = ok;
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

        function _deepEqual(actual, expected) { if (actual === expected) { return true } else if (util.isBuffer(actual) && util.isBuffer(expected)) { if (actual.length != expected.length) return false; for (var i = 0; i < actual.length; i++) { if (actual[i] !== expected[i]) return false } return true } else if (util.isDate(actual) && util.isDate(expected)) { return actual.getTime() === expected.getTime() } else if (util.isRegExp(actual) && util.isRegExp(expected)) { return actual.source === expected.source && actual.global === expected.global && actual.multiline === expected.multiline && actual.lastIndex === expected.lastIndex && actual.ignoreCase === expected.ignoreCase } else if (!util.isObject(actual) && !util.isObject(expected)) { return actual == expected } else { return objEquiv(actual, expected) } }

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
        assert.ifError = function(err) { if (err) { throw err } }; var objectKeys = Object.keys || function(obj) { var keys = []; for (var key in obj) { if (hasOwn.call(obj, key)) keys.push(key) } return keys } }, { "util/": 92 }],
    89: [function(require, module, exports) { if (typeof Object.create === "function") { module.exports = function inherits(ctor, superCtor) { ctor.super_ = superCtor;
                ctor.prototype = Object.create(superCtor.prototype, { constructor: { value: ctor, enumerable: false, writable: true, configurable: true } }) } } else { module.exports = function inherits(ctor, superCtor) { ctor.super_ = superCtor; var TempCtor = function() {};
                TempCtor.prototype = superCtor.prototype;
                ctor.prototype = new TempCtor;
                ctor.prototype.constructor = ctor } } }, {}],
    90: [function(require, module, exports) { var process = module.exports = {};
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
    91: [function(require, module, exports) { module.exports = function isBuffer(arg) { return arg && typeof arg === "object" && typeof arg.copy === "function" && typeof arg.fill === "function" && typeof arg.readUInt8 === "function" } }, {}],
    92: [function(require, module, exports) {
        (function(process, global) {
            var formatRegExp = /%[sdj%]/g;
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

                function deprecated() { if (!warned) { if (process.throwDeprecation) { throw new Error(msg) } else if (process.traceDeprecation) { console.trace(msg) } else { console.error(msg) } warned = true } return fn.apply(this, arguments) } return deprecated };
            var debugs = {};
            var debugEnviron;
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

            function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
                var name, str, desc;
                desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
                if (desc.get) { if (desc.set) { str = ctx.stylize("[Getter/Setter]", "special") } else { str = ctx.stylize("[Getter]", "special") } } else { if (desc.set) { str = ctx.stylize("[Setter]", "special") } }
                if (!hasOwnProperty(visibleKeys, key)) { name = "[" + key + "]" }
                if (!str) {
                    if (ctx.seen.indexOf(desc.value) < 0) {
                        if (isNull(recurseTimes)) { str = formatValue(ctx, desc.value, null) } else { str = formatValue(ctx, desc.value, recurseTimes - 1) }
                        if (str.indexOf("\n") > -1) {
                            if (array) {
                                str = str.split("\n").map(function(line) {
                                    return "  " + line
                                }).join("\n").substr(2)
                            } else { str = "\n" + str.split("\n").map(function(line) { return "   " + line }).join("\n") }
                        }
                    } else { str = ctx.stylize("[Circular]", "special") }
                }
                if (isUndefined(name)) { if (array && key.match(/^\d+$/)) { return str } name = JSON.stringify("" + key); if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) { name = name.substr(1, name.length - 2);
                        name = ctx.stylize(name, "name") } else { name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
                        name = ctx.stylize(name, "string") } }
                return name + ": " + str
            }

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

            function pad(n) { return n < 10 ? "0" + n.toString(10) : n.toString(10) }
            var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            function timestamp() { var d = new Date; var time = [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join(":"); return [d.getDate(), months[d.getMonth()], time].join(" ") } exports.log = function() { console.log("%s - %s", timestamp(), exports.format.apply(exports, arguments)) };
            exports.inherits = require("inherits");
            exports._extend = function(origin, add) { if (!add || !isObject(add)) return origin; var keys = Object.keys(add); var i = keys.length; while (i--) { origin[keys[i]] = add[keys[i]] } return origin };

            function hasOwnProperty(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop) }
        }).call(this, require("_process"), typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
    }, { "./support/isBuffer": 91, _process: 90, inherits: 89 }]
}, {}, [73]);