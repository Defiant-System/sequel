(()=>{
    var Ua = Object.defineProperty;
    var Wa = (me,_e,o)=>_e in me ? Ua(me, _e, {
        enumerable: !0,
        configurable: !0,
        writable: !0,
        value: o
    }) : me[_e] = o;
    var Ht = (me,_e,o)=>(Wa(me, typeof _e != "symbol" ? _e + "" : _e, o),
    o)
      , yt = (me,_e,o)=>{
        if (!_e.has(me))
            throw TypeError("Cannot " + o)
    }
    ;
    var K = (me,_e,o)=>(yt(me, _e, "read from private field"),
    o ? o.call(me) : _e.get(me))
      , Ee = (me,_e,o)=>{
        if (_e.has(me))
            throw TypeError("Cannot add the same private member more than once");
        _e instanceof WeakSet ? _e.add(me) : _e.set(me, o)
    }
      , Ae = (me,_e,o,Ie)=>(yt(me, _e, "write to private field"),
    Ie ? Ie.call(me, o) : _e.set(me, o),
    o);
    var rt = (me,_e,o)=>(yt(me, _e, "access private method"),
    o);
    var $e = (()=>{
        var me = typeof document < "u" && document.currentScript ? document.currentScript.src : void 0;
        return function(_e={}) {
            var o = _e, Ie, Te;
            o.ready = new Promise((e,t)=>{
                Ie = e,
                Te = t
            }
            );
            let Fe = globalThis.sqlite3InitModuleState || Object.assign(Object.create(null), {
                debugModule: ()=>{}
            });
            delete globalThis.sqlite3InitModuleState,
            Fe.debugModule("globalThis.location =", globalThis.location),
            o.locateFile = function(e, t) {
                "use strict";
                let r, i = this.urlParams;
                return i.has(e) ? r = i.get(e) : this.sqlite3Dir ? r = this.sqlite3Dir + e : this.scriptDir ? r = this.scriptDir + e : r = t + e,
                Fe.debugModule("locateFile(", arguments[0], ",", arguments[1], ")", "sqlite3InitModuleState.scriptDir =", this.scriptDir, "up.entries() =", Array.from(i.entries()), "result =", r),
                r
            }
            .bind(Fe);
            let Ke = "emscripten-bug-17951";
            o[Ke] = function e(t, r) {
                t.env.foo = function() {}
                ;
                let i = o.locateFile(e.uri, typeof xe > "u" ? "" : xe);
                Fe.debugModule("instantiateWasm() uri =", i);
                let n = ()=>fetch(i, {
                    credentials: "same-origin"
                });
                return (WebAssembly.instantiateStreaming ? async()=>WebAssembly.instantiateStreaming(n(), t).then(p=>r(p.instance, p.module)) : async()=>n().then(p=>p.arrayBuffer()).then(p=>WebAssembly.instantiate(p, t)).then(p=>r(p.instance, p.module)))(),
                {}
            }
            ,
            o[Ke].uri = "sqlite3.wasm";
            var vt = Object.assign({}, o)
              , Vt = []
              , wt = "./this.program"
              , Gt = (e,t)=>{
                throw t
            }
              , st = typeof window == "object"
              , je = typeof importScripts == "function"
              , $t = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string"
              , Qa = !st && !$t && !je
              , xe = "";
            function Kt(e) {
                return o.locateFile ? o.locateFile(e, xe) : xe + e
            }
            var it, Et, ot;
            (st || je) && (je ? xe = self.location.href : typeof document < "u" && document.currentScript && (xe = document.currentScript.src),
            me && (xe = me),
            xe.indexOf("blob:") !== 0 ? xe = xe.substr(0, xe.replace(/[?#].*/, "").lastIndexOf("/") + 1) : xe = "",
            it = e=>{
                var t = new XMLHttpRequest;
                return t.open("GET", e, !1),
                t.send(null),
                t.responseText
            }
            ,
            je && (ot = e=>{
                var t = new XMLHttpRequest;
                return t.open("GET", e, !1),
                t.responseType = "arraybuffer",
                t.send(null),
                new Uint8Array(t.response)
            }
            ),
            Et = (e,t,r)=>{
                var i = new XMLHttpRequest;
                i.open("GET", e, !0),
                i.responseType = "arraybuffer",
                i.onload = ()=>{
                    if (i.status == 200 || i.status == 0 && i.response) {
                        t(i.response);
                        return
                    }
                    r()
                }
                ,
                i.onerror = r,
                i.send(null)
            }
            );
            var at = o.print || console.log.bind(console)
              , Le = o.printErr || console.error.bind(console);
            Object.assign(o, vt),
            vt = null,
            o.arguments && (Vt = o.arguments),
            o.thisProgram && (wt = o.thisProgram),
            o.quit && (Gt = o.quit);
            var We;
            o.wasmBinary && (We = o.wasmBinary),
            typeof WebAssembly != "object" && Ce("no native wasm support detected");
            var De, xt = !1, Jt;
            function Ha(e, t) {
                e || Ce(t)
            }
            var Va, be, ze, Ne, Xt, fe, ge, lt, Se, Yt, ct;
            function St() {
                var e = De.buffer;
                o.HEAP8 = be = new Int8Array(e),
                o.HEAP16 = Ne = new Int16Array(e),
                o.HEAPU8 = ze = new Uint8Array(e),
                o.HEAPU16 = Xt = new Uint16Array(e),
                o.HEAP32 = fe = new Int32Array(e),
                o.HEAPU32 = ge = new Uint32Array(e),
                o.HEAPF32 = lt = new Float32Array(e),
                o.HEAPF64 = ct = new Float64Array(e),
                o.HEAP64 = Se = new BigInt64Array(e),
                o.HEAPU64 = Yt = new BigUint64Array(e)
            }
            var At = o.INITIAL_MEMORY || 16777216;
            o.wasmMemory ? De = o.wasmMemory : De = new WebAssembly.Memory({
                initial: At / 65536,
                maximum: 32768
            }),
            St(),
            At = De.buffer.byteLength;
            var It = []
              , kt = []
              , Ga = []
              , Tt = []
              , Zt = !1;
            function er() {
                if (o.preRun)
                    for (typeof o.preRun == "function" && (o.preRun = [o.preRun]); o.preRun.length; )
                        nr(o.preRun.shift());
                ft(It)
            }
            function tr() {
                Zt = !0,
                !o.noFSInit && !a.init.initialized && a.init(),
                a.ignorePermissions = !1,
                Re.init(),
                ft(kt)
            }
            function rr() {
                if (o.postRun)
                    for (typeof o.postRun == "function" && (o.postRun = [o.postRun]); o.postRun.length; )
                        ir(o.postRun.shift());
                ft(Tt)
            }
            function nr(e) {
                It.unshift(e)
            }
            function sr(e) {
                kt.unshift(e)
            }
            function $a(e) {}
            function ir(e) {
                Tt.unshift(e)
            }
            var Me = 0
              , _t = null
              , Qe = null;
            function Ka(e) {
                return e
            }
            function ut(e) {
                Me++,
                o.monitorRunDependencies?.(Me)
            }
            function Je(e) {
                if (Me--,
                o.monitorRunDependencies?.(Me),
                Me == 0 && (_t !== null && (clearInterval(_t),
                _t = null),
                Qe)) {
                    var t = Qe;
                    Qe = null,
                    t()
                }
            }
            function Ce(e) {
                o.onAbort?.(e),
                e = "Aborted(" + e + ")",
                Le(e),
                xt = !0,
                Jt = 1,
                e += ". Build with -sASSERTIONS for more info.";
                var t = new WebAssembly.RuntimeError(e);
                throw Te(t),
                t
            }
            var or = "data:application/octet-stream;base64,", Ft = e=>e.startsWith(or), Ja = e=>e.startsWith("file://"), Be;
            Be = "sqlite3.wasm",
            Ft(Be) || (Be = Kt(Be));
            function Ot(e) {
                if (e == Be && We)
                    return new Uint8Array(We);
                if (ot)
                    return ot(e);
                throw "both async and sync fetching of the wasm failed"
            }
            function ar(e) {
                return !We && (st || je) && typeof fetch == "function" ? fetch(e, {
                    credentials: "same-origin"
                }).then(t=>{
                    if (!t.ok)
                        throw "failed to load wasm binary file at '" + e + "'";
                    return t.arrayBuffer()
                }
                ).catch(()=>Ot(e)) : Promise.resolve().then(()=>Ot(e))
            }
            function Pt(e, t, r) {
                return ar(e).then(i=>WebAssembly.instantiate(i, t)).then(i=>i).then(r, i=>{
                    Le(`failed to asynchronously prepare wasm: ${i}`),
                    Ce(i)
                }
                )
            }
            function lr(e, t, r, i) {
                return !e && typeof WebAssembly.instantiateStreaming == "function" && !Ft(t) && typeof fetch == "function" ? fetch(t, {
                    credentials: "same-origin"
                }).then(n=>{
                    var s = WebAssembly.instantiateStreaming(n, r);
                    return s.then(i, function(p) {
                        return Le(`wasm streaming compile failed: ${p}`),
                        Le("falling back to ArrayBuffer instantiation"),
                        Pt(t, r, i)
                    })
                }
                ) : Pt(t, r, i)
            }
            function cr() {
                var e = {
                    env: zt,
                    wasi_snapshot_preview1: zt
                };
                function t(i, n) {
                    return b = i.exports,
                    sr(b.__wasm_call_ctors),
                    Je("wasm-instantiate"),
                    b
                }
                ut("wasm-instantiate");
                function r(i) {
                    t(i.instance)
                }
                if (o.instantiateWasm)
                    try {
                        return o.instantiateWasm(e, t)
                    } catch (i) {
                        Le(`Module.instantiateWasm callback failed with error: ${i}`),
                        Te(i)
                    }
                return lr(We, Be, e, r).catch(Te),
                {}
            }
            function Xa(e) {
                this.name = "ExitStatus",
                this.message = `Program terminated with exit(${e})`,
                this.status = e
            }
            var ft = e=>{
                for (; e.length > 0; )
                    e.shift()(o)
            }
            ;
            function Ya(e, t="i8") {
                switch (t.endsWith("*") && (t = "*"),
                t) {
                case "i1":
                    return be[e >> 0];
                case "i8":
                    return be[e >> 0];
                case "i16":
                    return Ne[e >> 1];
                case "i32":
                    return fe[e >> 2];
                case "i64":
                    return Se[e >> 3];
                case "float":
                    return lt[e >> 2];
                case "double":
                    return ct[e >> 3];
                case "*":
                    return ge[e >> 2];
                default:
                    Ce(`invalid type for getValue: ${t}`)
                }
            }
            var Za = o.noExitRuntime || !0;
            function el(e, t, r="i8") {
                switch (r.endsWith("*") && (r = "*"),
                r) {
                case "i1":
                    be[e >> 0] = t;
                    break;
                case "i8":
                    be[e >> 0] = t;
                    break;
                case "i16":
                    Ne[e >> 1] = t;
                    break;
                case "i32":
                    fe[e >> 2] = t;
                    break;
                case "i64":
                    Se[e >> 3] = BigInt(t);
                    break;
                case "float":
                    lt[e >> 2] = t;
                    break;
                case "double":
                    ct[e >> 3] = t;
                    break;
                case "*":
                    ge[e >> 2] = t;
                    break;
                default:
                    Ce(`invalid type for setValue: ${r}`)
                }
            }
            var Lt = typeof TextDecoder < "u" ? new TextDecoder("utf8") : void 0
              , Ue = (e,t,r)=>{
                for (var i = t + r, n = t; e[n] && !(n >= i); )
                    ++n;
                if (n - t > 16 && e.buffer && Lt)
                    return Lt.decode(e.subarray(t, n));
                for (var s = ""; t < n; ) {
                    var p = e[t++];
                    if (!(p & 128)) {
                        s += String.fromCharCode(p);
                        continue
                    }
                    var y = e[t++] & 63;
                    if ((p & 224) == 192) {
                        s += String.fromCharCode((p & 31) << 6 | y);
                        continue
                    }
                    var O = e[t++] & 63;
                    if ((p & 240) == 224 ? p = (p & 15) << 12 | y << 6 | O : p = (p & 7) << 18 | y << 12 | O << 6 | e[t++] & 63,
                    p < 65536)
                        s += String.fromCharCode(p);
                    else {
                        var B = p - 65536;
                        s += String.fromCharCode(55296 | B >> 10, 56320 | B & 1023)
                    }
                }
                return s
            }
              , Xe = (e,t)=>e ? Ue(ze, e, t) : ""
              , _r = (e,t,r,i)=>{
                Ce(`Assertion failed: ${Xe(e)}, at: ` + [t ? Xe(t) : "unknown filename", r, i ? Xe(i) : "unknown function"])
            }
              , pe = {
                isAbs: e=>e.charAt(0) === "/",
                splitPath: e=>{
                    var t = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                    return t.exec(e).slice(1)
                }
                ,
                normalizeArray: (e,t)=>{
                    for (var r = 0, i = e.length - 1; i >= 0; i--) {
                        var n = e[i];
                        n === "." ? e.splice(i, 1) : n === ".." ? (e.splice(i, 1),
                        r++) : r && (e.splice(i, 1),
                        r--)
                    }
                    if (t)
                        for (; r; r--)
                            e.unshift("..");
                    return e
                }
                ,
                normalize: e=>{
                    var t = pe.isAbs(e)
                      , r = e.substr(-1) === "/";
                    return e = pe.normalizeArray(e.split("/").filter(i=>!!i), !t).join("/"),
                    !e && !t && (e = "."),
                    e && r && (e += "/"),
                    (t ? "/" : "") + e
                }
                ,
                dirname: e=>{
                    var t = pe.splitPath(e)
                      , r = t[0]
                      , i = t[1];
                    return !r && !i ? "." : (i && (i = i.substr(0, i.length - 1)),
                    r + i)
                }
                ,
                basename: e=>{
                    if (e === "/")
                        return "/";
                    e = pe.normalize(e),
                    e = e.replace(/\/$/, "");
                    var t = e.lastIndexOf("/");
                    return t === -1 ? e : e.substr(t + 1)
                }
                ,
                join: function() {
                    var e = Array.prototype.slice.call(arguments);
                    return pe.normalize(e.join("/"))
                },
                join2: (e,t)=>pe.normalize(e + "/" + t)
            }
              , ur = ()=>{
                if (typeof crypto == "object" && typeof crypto.getRandomValues == "function")
                    return e=>crypto.getRandomValues(e);
                Ce("initRandomDevice")
            }
              , Dt = e=>(Dt = ur())(e)
              , Oe = {
                resolve: function() {
                    for (var e = "", t = !1, r = arguments.length - 1; r >= -1 && !t; r--) {
                        var i = r >= 0 ? arguments[r] : a.cwd();
                        if (typeof i != "string")
                            throw new TypeError("Arguments to path.resolve must be strings");
                        if (!i)
                            return "";
                        e = i + "/" + e,
                        t = pe.isAbs(i)
                    }
                    return e = pe.normalizeArray(e.split("/").filter(n=>!!n), !t).join("/"),
                    (t ? "/" : "") + e || "."
                },
                relative: (e,t)=>{
                    e = Oe.resolve(e).substr(1),
                    t = Oe.resolve(t).substr(1);
                    function r(B) {
                        for (var G = 0; G < B.length && B[G] === ""; G++)
                            ;
                        for (var J = B.length - 1; J >= 0 && B[J] === ""; J--)
                            ;
                        return G > J ? [] : B.slice(G, J - G + 1)
                    }
                    for (var i = r(e.split("/")), n = r(t.split("/")), s = Math.min(i.length, n.length), p = s, y = 0; y < s; y++)
                        if (i[y] !== n[y]) {
                            p = y;
                            break
                        }
                    for (var O = [], y = p; y < i.length; y++)
                        O.push("..");
                    return O = O.concat(n.slice(p)),
                    O.join("/")
                }
            }
              , dt = []
              , He = e=>{
                for (var t = 0, r = 0; r < e.length; ++r) {
                    var i = e.charCodeAt(r);
                    i <= 127 ? t++ : i <= 2047 ? t += 2 : i >= 55296 && i <= 57343 ? (t += 4,
                    ++r) : t += 3
                }
                return t
            }
              , pt = (e,t,r,i)=>{
                if (!(i > 0))
                    return 0;
                for (var n = r, s = r + i - 1, p = 0; p < e.length; ++p) {
                    var y = e.charCodeAt(p);
                    if (y >= 55296 && y <= 57343) {
                        var O = e.charCodeAt(++p);
                        y = 65536 + ((y & 1023) << 10) | O & 1023
                    }
                    if (y <= 127) {
                        if (r >= s)
                            break;
                        t[r++] = y
                    } else if (y <= 2047) {
                        if (r + 1 >= s)
                            break;
                        t[r++] = 192 | y >> 6,
                        t[r++] = 128 | y & 63
                    } else if (y <= 65535) {
                        if (r + 2 >= s)
                            break;
                        t[r++] = 224 | y >> 12,
                        t[r++] = 128 | y >> 6 & 63,
                        t[r++] = 128 | y & 63
                    } else {
                        if (r + 3 >= s)
                            break;
                        t[r++] = 240 | y >> 18,
                        t[r++] = 128 | y >> 12 & 63,
                        t[r++] = 128 | y >> 6 & 63,
                        t[r++] = 128 | y & 63
                    }
                }
                return t[r] = 0,
                r - n
            }
            ;
            function mt(e, t, r) {
                var i = r > 0 ? r : He(e) + 1
                  , n = new Array(i)
                  , s = pt(e, n, 0, n.length);
                return t && (n.length = s),
                n
            }
            var fr = ()=>{
                if (!dt.length) {
                    var e = null;
                    if (typeof window < "u" && typeof window.prompt == "function" ? (e = window.prompt("Input: "),
                    e !== null && (e += `
`)) : typeof readline == "function" && (e = readline(),
                    e !== null && (e += `
`)),
                    !e)
                        return null;
                    dt = mt(e, !0)
                }
                return dt.shift()
            }
              , Re = {
                ttys: [],
                init() {},
                shutdown() {},
                register(e, t) {
                    Re.ttys[e] = {
                        input: [],
                        output: [],
                        ops: t
                    },
                    a.registerDevice(e, Re.stream_ops)
                },
                stream_ops: {
                    open(e) {
                        var t = Re.ttys[e.node.rdev];
                        if (!t)
                            throw new a.ErrnoError(43);
                        e.tty = t,
                        e.seekable = !1
                    },
                    close(e) {
                        e.tty.ops.fsync(e.tty)
                    },
                    fsync(e) {
                        e.tty.ops.fsync(e.tty)
                    },
                    read(e, t, r, i, n) {
                        if (!e.tty || !e.tty.ops.get_char)
                            throw new a.ErrnoError(60);
                        for (var s = 0, p = 0; p < i; p++) {
                            var y;
                            try {
                                y = e.tty.ops.get_char(e.tty)
                            } catch {
                                throw new a.ErrnoError(29)
                            }
                            if (y === void 0 && s === 0)
                                throw new a.ErrnoError(6);
                            if (y == null)
                                break;
                            s++,
                            t[r + p] = y
                        }
                        return s && (e.node.timestamp = Date.now()),
                        s
                    },
                    write(e, t, r, i, n) {
                        if (!e.tty || !e.tty.ops.put_char)
                            throw new a.ErrnoError(60);
                        try {
                            for (var s = 0; s < i; s++)
                                e.tty.ops.put_char(e.tty, t[r + s])
                        } catch {
                            throw new a.ErrnoError(29)
                        }
                        return i && (e.node.timestamp = Date.now()),
                        s
                    }
                },
                default_tty_ops: {
                    get_char(e) {
                        return fr()
                    },
                    put_char(e, t) {
                        t === null || t === 10 ? (at(Ue(e.output, 0)),
                        e.output = []) : t != 0 && e.output.push(t)
                    },
                    fsync(e) {
                        e.output && e.output.length > 0 && (at(Ue(e.output, 0)),
                        e.output = [])
                    },
                    ioctl_tcgets(e) {
                        return {
                            c_iflag: 25856,
                            c_oflag: 5,
                            c_cflag: 191,
                            c_lflag: 35387,
                            c_cc: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
                        }
                    },
                    ioctl_tcsets(e, t, r) {
                        return 0
                    },
                    ioctl_tiocgwinsz(e) {
                        return [24, 80]
                    }
                },
                default_tty1_ops: {
                    put_char(e, t) {
                        t === null || t === 10 ? (Le(Ue(e.output, 0)),
                        e.output = []) : t != 0 && e.output.push(t)
                    },
                    fsync(e) {
                        e.output && e.output.length > 0 && (Le(Ue(e.output, 0)),
                        e.output = [])
                    }
                }
            }
              , dr = (e,t)=>(ze.fill(0, e, e + t),
            e)
              , pr = (e,t)=>Math.ceil(e / t) * t
              , Ct = e=>{
                e = pr(e, 65536);
                var t = Ut(65536, e);
                return t ? dr(t, e) : 0
            }
              , oe = {
                ops_table: null,
                mount(e) {
                    return oe.createNode(null, "/", 16895, 0)
                },
                createNode(e, t, r, i) {
                    if (a.isBlkdev(r) || a.isFIFO(r))
                        throw new a.ErrnoError(63);
                    oe.ops_table ||= {
                        dir: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr,
                                lookup: oe.node_ops.lookup,
                                mknod: oe.node_ops.mknod,
                                rename: oe.node_ops.rename,
                                unlink: oe.node_ops.unlink,
                                rmdir: oe.node_ops.rmdir,
                                readdir: oe.node_ops.readdir,
                                symlink: oe.node_ops.symlink
                            },
                            stream: {
                                llseek: oe.stream_ops.llseek
                            }
                        },
                        file: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr
                            },
                            stream: {
                                llseek: oe.stream_ops.llseek,
                                read: oe.stream_ops.read,
                                write: oe.stream_ops.write,
                                allocate: oe.stream_ops.allocate,
                                mmap: oe.stream_ops.mmap,
                                msync: oe.stream_ops.msync
                            }
                        },
                        link: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr,
                                readlink: oe.node_ops.readlink
                            },
                            stream: {}
                        },
                        chrdev: {
                            node: {
                                getattr: oe.node_ops.getattr,
                                setattr: oe.node_ops.setattr
                            },
                            stream: a.chrdev_stream_ops
                        }
                    };
                    var n = a.createNode(e, t, r, i);
                    return a.isDir(n.mode) ? (n.node_ops = oe.ops_table.dir.node,
                    n.stream_ops = oe.ops_table.dir.stream,
                    n.contents = {}) : a.isFile(n.mode) ? (n.node_ops = oe.ops_table.file.node,
                    n.stream_ops = oe.ops_table.file.stream,
                    n.usedBytes = 0,
                    n.contents = null) : a.isLink(n.mode) ? (n.node_ops = oe.ops_table.link.node,
                    n.stream_ops = oe.ops_table.link.stream) : a.isChrdev(n.mode) && (n.node_ops = oe.ops_table.chrdev.node,
                    n.stream_ops = oe.ops_table.chrdev.stream),
                    n.timestamp = Date.now(),
                    e && (e.contents[t] = n,
                    e.timestamp = n.timestamp),
                    n
                },
                getFileDataAsTypedArray(e) {
                    return e.contents ? e.contents.subarray ? e.contents.subarray(0, e.usedBytes) : new Uint8Array(e.contents) : new Uint8Array(0)
                },
                expandFileStorage(e, t) {
                    var r = e.contents ? e.contents.length : 0;
                    if (!(r >= t)) {
                        var i = 1024 * 1024;
                        t = Math.max(t, r * (r < i ? 2 : 1.125) >>> 0),
                        r != 0 && (t = Math.max(t, 256));
                        var n = e.contents;
                        e.contents = new Uint8Array(t),
                        e.usedBytes > 0 && e.contents.set(n.subarray(0, e.usedBytes), 0)
                    }
                },
                resizeFileStorage(e, t) {
                    if (e.usedBytes != t)
                        if (t == 0)
                            e.contents = null,
                            e.usedBytes = 0;
                        else {
                            var r = e.contents;
                            e.contents = new Uint8Array(t),
                            r && e.contents.set(r.subarray(0, Math.min(t, e.usedBytes))),
                            e.usedBytes = t
                        }
                },
                node_ops: {
                    getattr(e) {
                        var t = {};
                        return t.dev = a.isChrdev(e.mode) ? e.id : 1,
                        t.ino = e.id,
                        t.mode = e.mode,
                        t.nlink = 1,
                        t.uid = 0,
                        t.gid = 0,
                        t.rdev = e.rdev,
                        a.isDir(e.mode) ? t.size = 4096 : a.isFile(e.mode) ? t.size = e.usedBytes : a.isLink(e.mode) ? t.size = e.link.length : t.size = 0,
                        t.atime = new Date(e.timestamp),
                        t.mtime = new Date(e.timestamp),
                        t.ctime = new Date(e.timestamp),
                        t.blksize = 4096,
                        t.blocks = Math.ceil(t.size / t.blksize),
                        t
                    },
                    setattr(e, t) {
                        t.mode !== void 0 && (e.mode = t.mode),
                        t.timestamp !== void 0 && (e.timestamp = t.timestamp),
                        t.size !== void 0 && oe.resizeFileStorage(e, t.size)
                    },
                    lookup(e, t) {
                        throw a.genericErrors[44]
                    },
                    mknod(e, t, r, i) {
                        return oe.createNode(e, t, r, i)
                    },
                    rename(e, t, r) {
                        if (a.isDir(e.mode)) {
                            var i;
                            try {
                                i = a.lookupNode(t, r)
                            } catch {}
                            if (i)
                                for (var n in i.contents)
                                    throw new a.ErrnoError(55)
                        }
                        delete e.parent.contents[e.name],
                        e.parent.timestamp = Date.now(),
                        e.name = r,
                        t.contents[r] = e,
                        t.timestamp = e.parent.timestamp,
                        e.parent = t
                    },
                    unlink(e, t) {
                        delete e.contents[t],
                        e.timestamp = Date.now()
                    },
                    rmdir(e, t) {
                        var r = a.lookupNode(e, t);
                        for (var i in r.contents)
                            throw new a.ErrnoError(55);
                        delete e.contents[t],
                        e.timestamp = Date.now()
                    },
                    readdir(e) {
                        var t = [".", ".."];
                        for (var r of Object.keys(e.contents))
                            t.push(r);
                        return t
                    },
                    symlink(e, t, r) {
                        var i = oe.createNode(e, t, 41471, 0);
                        return i.link = r,
                        i
                    },
                    readlink(e) {
                        if (!a.isLink(e.mode))
                            throw new a.ErrnoError(28);
                        return e.link
                    }
                },
                stream_ops: {
                    read(e, t, r, i, n) {
                        var s = e.node.contents;
                        if (n >= e.node.usedBytes)
                            return 0;
                        var p = Math.min(e.node.usedBytes - n, i);
                        if (p > 8 && s.subarray)
                            t.set(s.subarray(n, n + p), r);
                        else
                            for (var y = 0; y < p; y++)
                                t[r + y] = s[n + y];
                        return p
                    },
                    write(e, t, r, i, n, s) {
                        if (t.buffer === be.buffer && (s = !1),
                        !i)
                            return 0;
                        var p = e.node;
                        if (p.timestamp = Date.now(),
                        t.subarray && (!p.contents || p.contents.subarray)) {
                            if (s)
                                return p.contents = t.subarray(r, r + i),
                                p.usedBytes = i,
                                i;
                            if (p.usedBytes === 0 && n === 0)
                                return p.contents = t.slice(r, r + i),
                                p.usedBytes = i,
                                i;
                            if (n + i <= p.usedBytes)
                                return p.contents.set(t.subarray(r, r + i), n),
                                i
                        }
                        if (oe.expandFileStorage(p, n + i),
                        p.contents.subarray && t.subarray)
                            p.contents.set(t.subarray(r, r + i), n);
                        else
                            for (var y = 0; y < i; y++)
                                p.contents[n + y] = t[r + y];
                        return p.usedBytes = Math.max(p.usedBytes, n + i),
                        i
                    },
                    llseek(e, t, r) {
                        var i = t;
                        if (r === 1 ? i += e.position : r === 2 && a.isFile(e.node.mode) && (i += e.node.usedBytes),
                        i < 0)
                            throw new a.ErrnoError(28);
                        return i
                    },
                    allocate(e, t, r) {
                        oe.expandFileStorage(e.node, t + r),
                        e.node.usedBytes = Math.max(e.node.usedBytes, t + r)
                    },
                    mmap(e, t, r, i, n) {
                        if (!a.isFile(e.node.mode))
                            throw new a.ErrnoError(43);
                        var s, p, y = e.node.contents;
                        if (!(n & 2) && y.buffer === be.buffer)
                            p = !1,
                            s = y.byteOffset;
                        else {
                            if ((r > 0 || r + t < y.length) && (y.subarray ? y = y.subarray(r, r + t) : y = Array.prototype.slice.call(y, r, r + t)),
                            p = !0,
                            s = Ct(t),
                            !s)
                                throw new a.ErrnoError(48);
                            be.set(y, s)
                        }
                        return {
                            ptr: s,
                            allocated: p
                        }
                    },
                    msync(e, t, r, i, n) {
                        return oe.stream_ops.write(e, t, 0, i, r, !1),
                        0
                    }
                }
            }
              , mr = (e,t,r,i)=>{
                var n = i ? "" : `al ${e}`;
                Et(e, s=>{
                    t(new Uint8Array(s)),
                    n && Je(n)
                }
                , s=>{
                    if (r)
                        r();
                    else
                        throw `Loading data file "${e}" failed.`
                }
                ),
                n && ut(n)
            }
              , hr = (e,t,r,i,n,s)=>{
                a.createDataFile(e, t, r, i, n, s)
            }
              , gr = o.preloadPlugins || []
              , qr = (e,t,r,i)=>{
                typeof Browser < "u" && Browser.init();
                var n = !1;
                return gr.forEach(s=>{
                    n || s.canHandle(t) && (s.handle(e, t, r, i),
                    n = !0)
                }
                ),
                n
            }
              , br = (e,t,r,i,n,s,p,y,O,B)=>{
                var G = t ? Oe.resolve(pe.join2(e, t)) : e
                  , J = `cp ${G}`;
                function Y(d) {
                    function f(m) {
                        B?.(),
                        y || hr(e, t, m, i, n, O),
                        s?.(),
                        Je(J)
                    }
                    qr(d, G, f, ()=>{
                        p?.(),
                        Je(J)
                    }
                    ) || f(d)
                }
                ut(J),
                typeof r == "string" ? mr(r, Y, p) : Y(r)
            }
              , yr = e=>{
                var t = {
                    r: 0,
                    "r+": 2,
                    w: 577,
                    "w+": 578,
                    a: 1089,
                    "a+": 1090
                }
                  , r = t[e];
                if (typeof r > "u")
                    throw new Error(`Unknown file open mode: ${e}`);
                return r
            }
              , ht = (e,t)=>{
                var r = 0;
                return e && (r |= 365),
                t && (r |= 146),
                r
            }
              , a = {
                root: null,
                mounts: [],
                devices: {},
                streams: [],
                nextInode: 1,
                nameTable: null,
                currentPath: "/",
                initialized: !1,
                ignorePermissions: !0,
                ErrnoError: null,
                genericErrors: {},
                filesystems: null,
                syncFSRequests: 0,
                lookupPath(e, t={}) {
                    if (e = Oe.resolve(e),
                    !e)
                        return {
                            path: "",
                            node: null
                        };
                    var r = {
                        follow_mount: !0,
                        recurse_count: 0
                    };
                    if (t = Object.assign(r, t),
                    t.recurse_count > 8)
                        throw new a.ErrnoError(32);
                    for (var i = e.split("/").filter(J=>!!J), n = a.root, s = "/", p = 0; p < i.length; p++) {
                        var y = p === i.length - 1;
                        if (y && t.parent)
                            break;
                        if (n = a.lookupNode(n, i[p]),
                        s = pe.join2(s, i[p]),
                        a.isMountpoint(n) && (!y || y && t.follow_mount) && (n = n.mounted.root),
                        !y || t.follow)
                            for (var O = 0; a.isLink(n.mode); ) {
                                var B = a.readlink(s);
                                s = Oe.resolve(pe.dirname(s), B);
                                var G = a.lookupPath(s, {
                                    recurse_count: t.recurse_count + 1
                                });
                                if (n = G.node,
                                O++ > 40)
                                    throw new a.ErrnoError(32)
                            }
                    }
                    return {
                        path: s,
                        node: n
                    }
                },
                getPath(e) {
                    for (var t; ; ) {
                        if (a.isRoot(e)) {
                            var r = e.mount.mountpoint;
                            return t ? r[r.length - 1] !== "/" ? `${r}/${t}` : r + t : r
                        }
                        t = t ? `${e.name}/${t}` : e.name,
                        e = e.parent
                    }
                },
                hashName(e, t) {
                    for (var r = 0, i = 0; i < t.length; i++)
                        r = (r << 5) - r + t.charCodeAt(i) | 0;
                    return (e + r >>> 0) % a.nameTable.length
                },
                hashAddNode(e) {
                    var t = a.hashName(e.parent.id, e.name);
                    e.name_next = a.nameTable[t],
                    a.nameTable[t] = e
                },
                hashRemoveNode(e) {
                    var t = a.hashName(e.parent.id, e.name);
                    if (a.nameTable[t] === e)
                        a.nameTable[t] = e.name_next;
                    else
                        for (var r = a.nameTable[t]; r; ) {
                            if (r.name_next === e) {
                                r.name_next = e.name_next;
                                break
                            }
                            r = r.name_next
                        }
                },
                lookupNode(e, t) {
                    var r = a.mayLookup(e);
                    if (r)
                        throw new a.ErrnoError(r,e);
                    for (var i = a.hashName(e.id, t), n = a.nameTable[i]; n; n = n.name_next) {
                        var s = n.name;
                        if (n.parent.id === e.id && s === t)
                            return n
                    }
                    return a.lookup(e, t)
                },
                createNode(e, t, r, i) {
                    var n = new a.FSNode(e,t,r,i);
                    return a.hashAddNode(n),
                    n
                },
                destroyNode(e) {
                    a.hashRemoveNode(e)
                },
                isRoot(e) {
                    return e === e.parent
                },
                isMountpoint(e) {
                    return !!e.mounted
                },
                isFile(e) {
                    return (e & 61440) === 32768
                },
                isDir(e) {
                    return (e & 61440) === 16384
                },
                isLink(e) {
                    return (e & 61440) === 40960
                },
                isChrdev(e) {
                    return (e & 61440) === 8192
                },
                isBlkdev(e) {
                    return (e & 61440) === 24576
                },
                isFIFO(e) {
                    return (e & 61440) === 4096
                },
                isSocket(e) {
                    return (e & 49152) === 49152
                },
                flagsToPermissionString(e) {
                    var t = ["r", "w", "rw"][e & 3];
                    return e & 512 && (t += "w"),
                    t
                },
                nodePermissions(e, t) {
                    return a.ignorePermissions ? 0 : t.includes("r") && !(e.mode & 292) || t.includes("w") && !(e.mode & 146) || t.includes("x") && !(e.mode & 73) ? 2 : 0
                },
                mayLookup(e) {
                    var t = a.nodePermissions(e, "x");
                    return t || (e.node_ops.lookup ? 0 : 2)
                },
                mayCreate(e, t) {
                    try {
                        var r = a.lookupNode(e, t);
                        return 20
                    } catch {}
                    return a.nodePermissions(e, "wx")
                },
                mayDelete(e, t, r) {
                    var i;
                    try {
                        i = a.lookupNode(e, t)
                    } catch (s) {
                        return s.errno
                    }
                    var n = a.nodePermissions(e, "wx");
                    if (n)
                        return n;
                    if (r) {
                        if (!a.isDir(i.mode))
                            return 54;
                        if (a.isRoot(i) || a.getPath(i) === a.cwd())
                            return 10
                    } else if (a.isDir(i.mode))
                        return 31;
                    return 0
                },
                mayOpen(e, t) {
                    return e ? a.isLink(e.mode) ? 32 : a.isDir(e.mode) && (a.flagsToPermissionString(t) !== "r" || t & 512) ? 31 : a.nodePermissions(e, a.flagsToPermissionString(t)) : 44
                },
                MAX_OPEN_FDS: 4096,
                nextfd() {
                    for (var e = 0; e <= a.MAX_OPEN_FDS; e++)
                        if (!a.streams[e])
                            return e;
                    throw new a.ErrnoError(33)
                },
                getStreamChecked(e) {
                    var t = a.getStream(e);
                    if (!t)
                        throw new a.ErrnoError(8);
                    return t
                },
                getStream: e=>a.streams[e],
                createStream(e, t=-1) {
                    return a.FSStream || (a.FSStream = function() {
                        this.shared = {}
                    }
                    ,
                    a.FSStream.prototype = {},
                    Object.defineProperties(a.FSStream.prototype, {
                        object: {
                            get() {
                                return this.node
                            },
                            set(r) {
                                this.node = r
                            }
                        },
                        isRead: {
                            get() {
                                return (this.flags & 2097155) !== 1
                            }
                        },
                        isWrite: {
                            get() {
                                return (this.flags & 2097155) !== 0
                            }
                        },
                        isAppend: {
                            get() {
                                return this.flags & 1024
                            }
                        },
                        flags: {
                            get() {
                                return this.shared.flags
                            },
                            set(r) {
                                this.shared.flags = r
                            }
                        },
                        position: {
                            get() {
                                return this.shared.position
                            },
                            set(r) {
                                this.shared.position = r
                            }
                        }
                    })),
                    e = Object.assign(new a.FSStream, e),
                    t == -1 && (t = a.nextfd()),
                    e.fd = t,
                    a.streams[t] = e,
                    e
                },
                closeStream(e) {
                    a.streams[e] = null
                },
                chrdev_stream_ops: {
                    open(e) {
                        var t = a.getDevice(e.node.rdev);
                        e.stream_ops = t.stream_ops,
                        e.stream_ops.open?.(e)
                    },
                    llseek() {
                        throw new a.ErrnoError(70)
                    }
                },
                major: e=>e >> 8,
                minor: e=>e & 255,
                makedev: (e,t)=>e << 8 | t,
                registerDevice(e, t) {
                    a.devices[e] = {
                        stream_ops: t
                    }
                },
                getDevice: e=>a.devices[e],
                getMounts(e) {
                    for (var t = [], r = [e]; r.length; ) {
                        var i = r.pop();
                        t.push(i),
                        r.push.apply(r, i.mounts)
                    }
                    return t
                },
                syncfs(e, t) {
                    typeof e == "function" && (t = e,
                    e = !1),
                    a.syncFSRequests++,
                    a.syncFSRequests > 1 && Le(`warning: ${a.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`);
                    var r = a.getMounts(a.root.mount)
                      , i = 0;
                    function n(p) {
                        return a.syncFSRequests--,
                        t(p)
                    }
                    function s(p) {
                        if (p)
                            return s.errored ? void 0 : (s.errored = !0,
                            n(p));
                        ++i >= r.length && n(null)
                    }
                    r.forEach(p=>{
                        if (!p.type.syncfs)
                            return s(null);
                        p.type.syncfs(p, e, s)
                    }
                    )
                },
                mount(e, t, r) {
                    var i = r === "/", n = !r, s;
                    if (i && a.root)
                        throw new a.ErrnoError(10);
                    if (!i && !n) {
                        var p = a.lookupPath(r, {
                            follow_mount: !1
                        });
                        if (r = p.path,
                        s = p.node,
                        a.isMountpoint(s))
                            throw new a.ErrnoError(10);
                        if (!a.isDir(s.mode))
                            throw new a.ErrnoError(54)
                    }
                    var y = {
                        type: e,
                        opts: t,
                        mountpoint: r,
                        mounts: []
                    }
                      , O = e.mount(y);
                    return O.mount = y,
                    y.root = O,
                    i ? a.root = O : s && (s.mounted = y,
                    s.mount && s.mount.mounts.push(y)),
                    O
                },
                unmount(e) {
                    var t = a.lookupPath(e, {
                        follow_mount: !1
                    });
                    if (!a.isMountpoint(t.node))
                        throw new a.ErrnoError(28);
                    var r = t.node
                      , i = r.mounted
                      , n = a.getMounts(i);
                    Object.keys(a.nameTable).forEach(p=>{
                        for (var y = a.nameTable[p]; y; ) {
                            var O = y.name_next;
                            n.includes(y.mount) && a.destroyNode(y),
                            y = O
                        }
                    }
                    ),
                    r.mounted = null;
                    var s = r.mount.mounts.indexOf(i);
                    r.mount.mounts.splice(s, 1)
                },
                lookup(e, t) {
                    return e.node_ops.lookup(e, t)
                },
                mknod(e, t, r) {
                    var i = a.lookupPath(e, {
                        parent: !0
                    })
                      , n = i.node
                      , s = pe.basename(e);
                    if (!s || s === "." || s === "..")
                        throw new a.ErrnoError(28);
                    var p = a.mayCreate(n, s);
                    if (p)
                        throw new a.ErrnoError(p);
                    if (!n.node_ops.mknod)
                        throw new a.ErrnoError(63);
                    return n.node_ops.mknod(n, s, t, r)
                },
                create(e, t) {
                    return t = t !== void 0 ? t : 438,
                    t &= 4095,
                    t |= 32768,
                    a.mknod(e, t, 0)
                },
                mkdir(e, t) {
                    return t = t !== void 0 ? t : 511,
                    t &= 1023,
                    t |= 16384,
                    a.mknod(e, t, 0)
                },
                mkdirTree(e, t) {
                    for (var r = e.split("/"), i = "", n = 0; n < r.length; ++n)
                        if (r[n]) {
                            i += "/" + r[n];
                            try {
                                a.mkdir(i, t)
                            } catch (s) {
                                if (s.errno != 20)
                                    throw s
                            }
                        }
                },
                mkdev(e, t, r) {
                    return typeof r > "u" && (r = t,
                    t = 438),
                    t |= 8192,
                    a.mknod(e, t, r)
                },
                symlink(e, t) {
                    if (!Oe.resolve(e))
                        throw new a.ErrnoError(44);
                    var r = a.lookupPath(t, {
                        parent: !0
                    })
                      , i = r.node;
                    if (!i)
                        throw new a.ErrnoError(44);
                    var n = pe.basename(t)
                      , s = a.mayCreate(i, n);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!i.node_ops.symlink)
                        throw new a.ErrnoError(63);
                    return i.node_ops.symlink(i, n, e)
                },
                rename(e, t) {
                    var r = pe.dirname(e), i = pe.dirname(t), n = pe.basename(e), s = pe.basename(t), p, y, O;
                    if (p = a.lookupPath(e, {
                        parent: !0
                    }),
                    y = p.node,
                    p = a.lookupPath(t, {
                        parent: !0
                    }),
                    O = p.node,
                    !y || !O)
                        throw new a.ErrnoError(44);
                    if (y.mount !== O.mount)
                        throw new a.ErrnoError(75);
                    var B = a.lookupNode(y, n)
                      , G = Oe.relative(e, i);
                    if (G.charAt(0) !== ".")
                        throw new a.ErrnoError(28);
                    if (G = Oe.relative(t, r),
                    G.charAt(0) !== ".")
                        throw new a.ErrnoError(55);
                    var J;
                    try {
                        J = a.lookupNode(O, s)
                    } catch {}
                    if (B !== J) {
                        var Y = a.isDir(B.mode)
                          , d = a.mayDelete(y, n, Y);
                        if (d)
                            throw new a.ErrnoError(d);
                        if (d = J ? a.mayDelete(O, s, Y) : a.mayCreate(O, s),
                        d)
                            throw new a.ErrnoError(d);
                        if (!y.node_ops.rename)
                            throw new a.ErrnoError(63);
                        if (a.isMountpoint(B) || J && a.isMountpoint(J))
                            throw new a.ErrnoError(10);
                        if (O !== y && (d = a.nodePermissions(y, "w"),
                        d))
                            throw new a.ErrnoError(d);
                        a.hashRemoveNode(B);
                        try {
                            y.node_ops.rename(B, O, s)
                        } catch (f) {
                            throw f
                        } finally {
                            a.hashAddNode(B)
                        }
                    }
                },
                rmdir(e) {
                    var t = a.lookupPath(e, {
                        parent: !0
                    })
                      , r = t.node
                      , i = pe.basename(e)
                      , n = a.lookupNode(r, i)
                      , s = a.mayDelete(r, i, !0);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!r.node_ops.rmdir)
                        throw new a.ErrnoError(63);
                    if (a.isMountpoint(n))
                        throw new a.ErrnoError(10);
                    r.node_ops.rmdir(r, i),
                    a.destroyNode(n)
                },
                readdir(e) {
                    var t = a.lookupPath(e, {
                        follow: !0
                    })
                      , r = t.node;
                    if (!r.node_ops.readdir)
                        throw new a.ErrnoError(54);
                    return r.node_ops.readdir(r)
                },
                unlink(e) {
                    var t = a.lookupPath(e, {
                        parent: !0
                    })
                      , r = t.node;
                    if (!r)
                        throw new a.ErrnoError(44);
                    var i = pe.basename(e)
                      , n = a.lookupNode(r, i)
                      , s = a.mayDelete(r, i, !1);
                    if (s)
                        throw new a.ErrnoError(s);
                    if (!r.node_ops.unlink)
                        throw new a.ErrnoError(63);
                    if (a.isMountpoint(n))
                        throw new a.ErrnoError(10);
                    r.node_ops.unlink(r, i),
                    a.destroyNode(n)
                },
                readlink(e) {
                    var t = a.lookupPath(e)
                      , r = t.node;
                    if (!r)
                        throw new a.ErrnoError(44);
                    if (!r.node_ops.readlink)
                        throw new a.ErrnoError(28);
                    return Oe.resolve(a.getPath(r.parent), r.node_ops.readlink(r))
                },
                stat(e, t) {
                    var r = a.lookupPath(e, {
                        follow: !t
                    })
                      , i = r.node;
                    if (!i)
                        throw new a.ErrnoError(44);
                    if (!i.node_ops.getattr)
                        throw new a.ErrnoError(63);
                    return i.node_ops.getattr(i)
                },
                lstat(e) {
                    return a.stat(e, !0)
                },
                chmod(e, t, r) {
                    var i;
                    if (typeof e == "string") {
                        var n = a.lookupPath(e, {
                            follow: !r
                        });
                        i = n.node
                    } else
                        i = e;
                    if (!i.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    i.node_ops.setattr(i, {
                        mode: t & 4095 | i.mode & -4096,
                        timestamp: Date.now()
                    })
                },
                lchmod(e, t) {
                    a.chmod(e, t, !0)
                },
                fchmod(e, t) {
                    var r = a.getStreamChecked(e);
                    a.chmod(r.node, t)
                },
                chown(e, t, r, i) {
                    var n;
                    if (typeof e == "string") {
                        var s = a.lookupPath(e, {
                            follow: !i
                        });
                        n = s.node
                    } else
                        n = e;
                    if (!n.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    n.node_ops.setattr(n, {
                        timestamp: Date.now()
                    })
                },
                lchown(e, t, r) {
                    a.chown(e, t, r, !0)
                },
                fchown(e, t, r) {
                    var i = a.getStreamChecked(e);
                    a.chown(i.node, t, r)
                },
                truncate(e, t) {
                    if (t < 0)
                        throw new a.ErrnoError(28);
                    var r;
                    if (typeof e == "string") {
                        var i = a.lookupPath(e, {
                            follow: !0
                        });
                        r = i.node
                    } else
                        r = e;
                    if (!r.node_ops.setattr)
                        throw new a.ErrnoError(63);
                    if (a.isDir(r.mode))
                        throw new a.ErrnoError(31);
                    if (!a.isFile(r.mode))
                        throw new a.ErrnoError(28);
                    var n = a.nodePermissions(r, "w");
                    if (n)
                        throw new a.ErrnoError(n);
                    r.node_ops.setattr(r, {
                        size: t,
                        timestamp: Date.now()
                    })
                },
                ftruncate(e, t) {
                    var r = a.getStreamChecked(e);
                    if (!(r.flags & 2097155))
                        throw new a.ErrnoError(28);
                    a.truncate(r.node, t)
                },
                utime(e, t, r) {
                    var i = a.lookupPath(e, {
                        follow: !0
                    })
                      , n = i.node;
                    n.node_ops.setattr(n, {
                        timestamp: Math.max(t, r)
                    })
                },
                open(e, t, r) {
                    if (e === "")
                        throw new a.ErrnoError(44);
                    t = typeof t == "string" ? yr(t) : t,
                    r = typeof r > "u" ? 438 : r,
                    t & 64 ? r = r & 4095 | 32768 : r = 0;
                    var i;
                    if (typeof e == "object")
                        i = e;
                    else {
                        e = pe.normalize(e);
                        try {
                            var n = a.lookupPath(e, {
                                follow: !(t & 131072)
                            });
                            i = n.node
                        } catch {}
                    }
                    var s = !1;
                    if (t & 64)
                        if (i) {
                            if (t & 128)
                                throw new a.ErrnoError(20)
                        } else
                            i = a.mknod(e, r, 0),
                            s = !0;
                    if (!i)
                        throw new a.ErrnoError(44);
                    if (a.isChrdev(i.mode) && (t &= -513),
                    t & 65536 && !a.isDir(i.mode))
                        throw new a.ErrnoError(54);
                    if (!s) {
                        var p = a.mayOpen(i, t);
                        if (p)
                            throw new a.ErrnoError(p)
                    }
                    t & 512 && !s && a.truncate(i, 0),
                    t &= -131713;
                    var y = a.createStream({
                        node: i,
                        path: a.getPath(i),
                        flags: t,
                        seekable: !0,
                        position: 0,
                        stream_ops: i.stream_ops,
                        ungotten: [],
                        error: !1
                    });
                    return y.stream_ops.open && y.stream_ops.open(y),
                    o.logReadFiles && !(t & 1) && (a.readFiles || (a.readFiles = {}),
                    e in a.readFiles || (a.readFiles[e] = 1)),
                    y
                },
                close(e) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    e.getdents && (e.getdents = null);
                    try {
                        e.stream_ops.close && e.stream_ops.close(e)
                    } catch (t) {
                        throw t
                    } finally {
                        a.closeStream(e.fd)
                    }
                    e.fd = null
                },
                isClosed(e) {
                    return e.fd === null
                },
                llseek(e, t, r) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (!e.seekable || !e.stream_ops.llseek)
                        throw new a.ErrnoError(70);
                    if (r != 0 && r != 1 && r != 2)
                        throw new a.ErrnoError(28);
                    return e.position = e.stream_ops.llseek(e, t, r),
                    e.ungotten = [],
                    e.position
                },
                read(e, t, r, i, n) {
                    if (i < 0 || n < 0)
                        throw new a.ErrnoError(28);
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if ((e.flags & 2097155) === 1)
                        throw new a.ErrnoError(8);
                    if (a.isDir(e.node.mode))
                        throw new a.ErrnoError(31);
                    if (!e.stream_ops.read)
                        throw new a.ErrnoError(28);
                    var s = typeof n < "u";
                    if (!s)
                        n = e.position;
                    else if (!e.seekable)
                        throw new a.ErrnoError(70);
                    var p = e.stream_ops.read(e, t, r, i, n);
                    return s || (e.position += p),
                    p
                },
                write(e, t, r, i, n, s) {
                    if (i < 0 || n < 0)
                        throw new a.ErrnoError(28);
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (!(e.flags & 2097155))
                        throw new a.ErrnoError(8);
                    if (a.isDir(e.node.mode))
                        throw new a.ErrnoError(31);
                    if (!e.stream_ops.write)
                        throw new a.ErrnoError(28);
                    e.seekable && e.flags & 1024 && a.llseek(e, 0, 2);
                    var p = typeof n < "u";
                    if (!p)
                        n = e.position;
                    else if (!e.seekable)
                        throw new a.ErrnoError(70);
                    var y = e.stream_ops.write(e, t, r, i, n, s);
                    return p || (e.position += y),
                    y
                },
                allocate(e, t, r) {
                    if (a.isClosed(e))
                        throw new a.ErrnoError(8);
                    if (t < 0 || r <= 0)
                        throw new a.ErrnoError(28);
                    if (!(e.flags & 2097155))
                        throw new a.ErrnoError(8);
                    if (!a.isFile(e.node.mode) && !a.isDir(e.node.mode))
                        throw new a.ErrnoError(43);
                    if (!e.stream_ops.allocate)
                        throw new a.ErrnoError(138);
                    e.stream_ops.allocate(e, t, r)
                },
                mmap(e, t, r, i, n) {
                    if (i & 2 && !(n & 2) && (e.flags & 2097155) !== 2)
                        throw new a.ErrnoError(2);
                    if ((e.flags & 2097155) === 1)
                        throw new a.ErrnoError(2);
                    if (!e.stream_ops.mmap)
                        throw new a.ErrnoError(43);
                    return e.stream_ops.mmap(e, t, r, i, n)
                },
                msync(e, t, r, i, n) {
                    return e.stream_ops.msync ? e.stream_ops.msync(e, t, r, i, n) : 0
                },
                munmap: e=>0,
                ioctl(e, t, r) {
                    if (!e.stream_ops.ioctl)
                        throw new a.ErrnoError(59);
                    return e.stream_ops.ioctl(e, t, r)
                },
                readFile(e, t={}) {
                    if (t.flags = t.flags || 0,
                    t.encoding = t.encoding || "binary",
                    t.encoding !== "utf8" && t.encoding !== "binary")
                        throw new Error(`Invalid encoding type "${t.encoding}"`);
                    var r, i = a.open(e, t.flags), n = a.stat(e), s = n.size, p = new Uint8Array(s);
                    return a.read(i, p, 0, s, 0),
                    t.encoding === "utf8" ? r = Ue(p, 0) : t.encoding === "binary" && (r = p),
                    a.close(i),
                    r
                },
                writeFile(e, t, r={}) {
                    r.flags = r.flags || 577;
                    var i = a.open(e, r.flags, r.mode);
                    if (typeof t == "string") {
                        var n = new Uint8Array(He(t) + 1)
                          , s = pt(t, n, 0, n.length);
                        a.write(i, n, 0, s, void 0, r.canOwn)
                    } else if (ArrayBuffer.isView(t))
                        a.write(i, t, 0, t.byteLength, void 0, r.canOwn);
                    else
                        throw new Error("Unsupported data type");
                    a.close(i)
                },
                cwd: ()=>a.currentPath,
                chdir(e) {
                    var t = a.lookupPath(e, {
                        follow: !0
                    });
                    if (t.node === null)
                        throw new a.ErrnoError(44);
                    if (!a.isDir(t.node.mode))
                        throw new a.ErrnoError(54);
                    var r = a.nodePermissions(t.node, "x");
                    if (r)
                        throw new a.ErrnoError(r);
                    a.currentPath = t.path
                },
                createDefaultDirectories() {
                    a.mkdir("/tmp"),
                    a.mkdir("/home"),
                    a.mkdir("/home/web_user")
                },
                createDefaultDevices() {
                    a.mkdir("/dev"),
                    a.registerDevice(a.makedev(1, 3), {
                        read: ()=>0,
                        write: (i,n,s,p,y)=>p
                    }),
                    a.mkdev("/dev/null", a.makedev(1, 3)),
                    Re.register(a.makedev(5, 0), Re.default_tty_ops),
                    Re.register(a.makedev(6, 0), Re.default_tty1_ops),
                    a.mkdev("/dev/tty", a.makedev(5, 0)),
                    a.mkdev("/dev/tty1", a.makedev(6, 0));
                    var e = new Uint8Array(1024)
                      , t = 0
                      , r = ()=>(t === 0 && (t = Dt(e).byteLength),
                    e[--t]);
                    a.createDevice("/dev", "random", r),
                    a.createDevice("/dev", "urandom", r),
                    a.mkdir("/dev/shm"),
                    a.mkdir("/dev/shm/tmp")
                },
                createSpecialDirectories() {
                    a.mkdir("/proc");
                    var e = a.mkdir("/proc/self");
                    a.mkdir("/proc/self/fd"),
                    a.mount({
                        mount() {
                            var t = a.createNode(e, "fd", 16895, 73);
                            return t.node_ops = {
                                lookup(r, i) {
                                    var n = +i
                                      , s = a.getStreamChecked(n)
                                      , p = {
                                        parent: null,
                                        mount: {
                                            mountpoint: "fake"
                                        },
                                        node_ops: {
                                            readlink: ()=>s.path
                                        }
                                    };
                                    return p.parent = p,
                                    p
                                }
                            },
                            t
                        }
                    }, {}, "/proc/self/fd")
                },
                createStandardStreams() {
                    o.stdin ? a.createDevice("/dev", "stdin", o.stdin) : a.symlink("/dev/tty", "/dev/stdin"),
                    o.stdout ? a.createDevice("/dev", "stdout", null, o.stdout) : a.symlink("/dev/tty", "/dev/stdout"),
                    o.stderr ? a.createDevice("/dev", "stderr", null, o.stderr) : a.symlink("/dev/tty1", "/dev/stderr");
                    var e = a.open("/dev/stdin", 0)
                      , t = a.open("/dev/stdout", 1)
                      , r = a.open("/dev/stderr", 1)
                },
                ensureErrnoError() {
                    a.ErrnoError || (a.ErrnoError = function(t, r) {
                        this.name = "ErrnoError",
                        this.node = r,
                        this.setErrno = function(i) {
                            this.errno = i
                        }
                        ,
                        this.setErrno(t),
                        this.message = "FS error"
                    }
                    ,
                    a.ErrnoError.prototype = new Error,
                    a.ErrnoError.prototype.constructor = a.ErrnoError,
                    [44].forEach(e=>{
                        a.genericErrors[e] = new a.ErrnoError(e),
                        a.genericErrors[e].stack = "<generic error, no stack>"
                    }
                    ))
                },
                staticInit() {
                    a.ensureErrnoError(),
                    a.nameTable = new Array(4096),
                    a.mount(oe, {}, "/"),
                    a.createDefaultDirectories(),
                    a.createDefaultDevices(),
                    a.createSpecialDirectories(),
                    a.filesystems = {
                        MEMFS: oe
                    }
                },
                init(e, t, r) {
                    a.init.initialized = !0,
                    a.ensureErrnoError(),
                    o.stdin = e || o.stdin,
                    o.stdout = t || o.stdout,
                    o.stderr = r || o.stderr,
                    a.createStandardStreams()
                },
                quit() {
                    a.init.initialized = !1;
                    for (var e = 0; e < a.streams.length; e++) {
                        var t = a.streams[e];
                        t && a.close(t)
                    }
                },
                findObject(e, t) {
                    var r = a.analyzePath(e, t);
                    return r.exists ? r.object : null
                },
                analyzePath(e, t) {
                    try {
                        var r = a.lookupPath(e, {
                            follow: !t
                        });
                        e = r.path
                    } catch {}
                    var i = {
                        isRoot: !1,
                        exists: !1,
                        error: 0,
                        name: null,
                        path: null,
                        object: null,
                        parentExists: !1,
                        parentPath: null,
                        parentObject: null
                    };
                    try {
                        var r = a.lookupPath(e, {
                            parent: !0
                        });
                        i.parentExists = !0,
                        i.parentPath = r.path,
                        i.parentObject = r.node,
                        i.name = pe.basename(e),
                        r = a.lookupPath(e, {
                            follow: !t
                        }),
                        i.exists = !0,
                        i.path = r.path,
                        i.object = r.node,
                        i.name = r.node.name,
                        i.isRoot = r.path === "/"
                    } catch (n) {
                        i.error = n.errno
                    }
                    return i
                },
                createPath(e, t, r, i) {
                    e = typeof e == "string" ? e : a.getPath(e);
                    for (var n = t.split("/").reverse(); n.length; ) {
                        var s = n.pop();
                        if (s) {
                            var p = pe.join2(e, s);
                            try {
                                a.mkdir(p)
                            } catch {}
                            e = p
                        }
                    }
                    return p
                },
                createFile(e, t, r, i, n) {
                    var s = pe.join2(typeof e == "string" ? e : a.getPath(e), t)
                      , p = ht(i, n);
                    return a.create(s, p)
                },
                createDataFile(e, t, r, i, n, s) {
                    var p = t;
                    e && (e = typeof e == "string" ? e : a.getPath(e),
                    p = t ? pe.join2(e, t) : e);
                    var y = ht(i, n)
                      , O = a.create(p, y);
                    if (r) {
                        if (typeof r == "string") {
                            for (var B = new Array(r.length), G = 0, J = r.length; G < J; ++G)
                                B[G] = r.charCodeAt(G);
                            r = B
                        }
                        a.chmod(O, y | 146);
                        var Y = a.open(O, 577);
                        a.write(Y, r, 0, r.length, 0, s),
                        a.close(Y),
                        a.chmod(O, y)
                    }
                },
                createDevice(e, t, r, i) {
                    var n = pe.join2(typeof e == "string" ? e : a.getPath(e), t)
                      , s = ht(!!r, !!i);
                    a.createDevice.major || (a.createDevice.major = 64);
                    var p = a.makedev(a.createDevice.major++, 0);
                    return a.registerDevice(p, {
                        open(y) {
                            y.seekable = !1
                        },
                        close(y) {
                            i?.buffer?.length && i(10)
                        },
                        read(y, O, B, G, J) {
                            for (var Y = 0, d = 0; d < G; d++) {
                                var f;
                                try {
                                    f = r()
                                } catch {
                                    throw new a.ErrnoError(29)
                                }
                                if (f === void 0 && Y === 0)
                                    throw new a.ErrnoError(6);
                                if (f == null)
                                    break;
                                Y++,
                                O[B + d] = f
                            }
                            return Y && (y.node.timestamp = Date.now()),
                            Y
                        },
                        write(y, O, B, G, J) {
                            for (var Y = 0; Y < G; Y++)
                                try {
                                    i(O[B + Y])
                                } catch {
                                    throw new a.ErrnoError(29)
                                }
                            return G && (y.node.timestamp = Date.now()),
                            Y
                        }
                    }),
                    a.mkdev(n, s, p)
                },
                forceLoadFile(e) {
                    if (e.isDevice || e.isFolder || e.link || e.contents)
                        return !0;
                    if (typeof XMLHttpRequest < "u")
                        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
                    if (it)
                        try {
                            e.contents = mt(it(e.url), !0),
                            e.usedBytes = e.contents.length
                        } catch {
                            throw new a.ErrnoError(29)
                        }
                    else
                        throw new Error("Cannot load without read() or XMLHttpRequest.")
                },
                createLazyFile(e, t, r, i, n) {
                    function s() {
                        this.lengthKnown = !1,
                        this.chunks = []
                    }
                    if (s.prototype.get = function(d) {
                        if (!(d > this.length - 1 || d < 0)) {
                            var f = d % this.chunkSize
                              , m = d / this.chunkSize | 0;
                            return this.getter(m)[f]
                        }
                    }
                    ,
                    s.prototype.setDataGetter = function(d) {
                        this.getter = d
                    }
                    ,
                    s.prototype.cacheLength = function() {
                        var d = new XMLHttpRequest;
                        if (d.open("HEAD", r, !1),
                        d.send(null),
                        !(d.status >= 200 && d.status < 300 || d.status === 304))
                            throw new Error("Couldn't load " + r + ". Status: " + d.status);
                        var f = Number(d.getResponseHeader("Content-length")), m, I = (m = d.getResponseHeader("Accept-Ranges")) && m === "bytes", x = (m = d.getResponseHeader("Content-Encoding")) && m === "gzip", S = 1024 * 1024;
                        I || (S = f);
                        var R = (L,$)=>{
                            if (L > $)
                                throw new Error("invalid range (" + L + ", " + $ + ") or no bytes requested!");
                            if ($ > f - 1)
                                throw new Error("only " + f + " bytes available! programmer error!");
                            var u = new XMLHttpRequest;
                            if (u.open("GET", r, !1),
                            f !== S && u.setRequestHeader("Range", "bytes=" + L + "-" + $),
                            u.responseType = "arraybuffer",
                            u.overrideMimeType && u.overrideMimeType("text/plain; charset=x-user-defined"),
                            u.send(null),
                            !(u.status >= 200 && u.status < 300 || u.status === 304))
                                throw new Error("Couldn't load " + r + ". Status: " + u.status);
                            return u.response !== void 0 ? new Uint8Array(u.response || []) : mt(u.responseText || "", !0)
                        }
                          , z = this;
                        z.setDataGetter(L=>{
                            var $ = L * S
                              , u = (L + 1) * S - 1;
                            if (u = Math.min(u, f - 1),
                            typeof z.chunks[L] > "u" && (z.chunks[L] = R($, u)),
                            typeof z.chunks[L] > "u")
                                throw new Error("doXHR failed!");
                            return z.chunks[L]
                        }
                        ),
                        (x || !f) && (S = f = 1,
                        f = this.getter(0).length,
                        S = f,
                        at("LazyFiles on gzip forces download of the whole file when length is accessed")),
                        this._length = f,
                        this._chunkSize = S,
                        this.lengthKnown = !0
                    }
                    ,
                    typeof XMLHttpRequest < "u") {
                        if (!je)
                            throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                        var p = new s;
                        Object.defineProperties(p, {
                            length: {
                                get: function() {
                                    return this.lengthKnown || this.cacheLength(),
                                    this._length
                                }
                            },
                            chunkSize: {
                                get: function() {
                                    return this.lengthKnown || this.cacheLength(),
                                    this._chunkSize
                                }
                            }
                        });
                        var y = {
                            isDevice: !1,
                            contents: p
                        }
                    } else
                        var y = {
                            isDevice: !1,
                            url: r
                        };
                    var O = a.createFile(e, t, y, i, n);
                    y.contents ? O.contents = y.contents : y.url && (O.contents = null,
                    O.url = y.url),
                    Object.defineProperties(O, {
                        usedBytes: {
                            get: function() {
                                return this.contents.length
                            }
                        }
                    });
                    var B = {}
                      , G = Object.keys(O.stream_ops);
                    G.forEach(Y=>{
                        var d = O.stream_ops[Y];
                        B[Y] = function() {
                            return a.forceLoadFile(O),
                            d.apply(null, arguments)
                        }
                    }
                    );
                    function J(Y, d, f, m, I) {
                        var x = Y.node.contents;
                        if (I >= x.length)
                            return 0;
                        var S = Math.min(x.length - I, m);
                        if (x.slice)
                            for (var R = 0; R < S; R++)
                                d[f + R] = x[I + R];
                        else
                            for (var R = 0; R < S; R++)
                                d[f + R] = x.get(I + R);
                        return S
                    }
                    return B.read = (Y,d,f,m,I)=>(a.forceLoadFile(O),
                    J(Y, d, f, m, I)),
                    B.mmap = (Y,d,f,m,I)=>{
                        a.forceLoadFile(O);
                        var x = Ct(d);
                        if (!x)
                            throw new a.ErrnoError(48);
                        return J(Y, be, x, d, f),
                        {
                            ptr: x,
                            allocated: !0
                        }
                    }
                    ,
                    O.stream_ops = B,
                    O
                }
            }
              , te = {
                DEFAULT_POLLMASK: 5,
                calculateAt(e, t, r) {
                    if (pe.isAbs(t))
                        return t;
                    var i;
                    if (e === -100)
                        i = a.cwd();
                    else {
                        var n = te.getStreamFromFD(e);
                        i = n.path
                    }
                    if (t.length == 0) {
                        if (!r)
                            throw new a.ErrnoError(44);
                        return i
                    }
                    return pe.join2(i, t)
                },
                doStat(e, t, r) {
                    try {
                        var i = e(t)
                    } catch (y) {
                        if (y && y.node && pe.normalize(t) !== pe.normalize(a.getPath(y.node)))
                            return -54;
                        throw y
                    }
                    fe[r >> 2] = i.dev,
                    fe[r + 4 >> 2] = i.mode,
                    ge[r + 8 >> 2] = i.nlink,
                    fe[r + 12 >> 2] = i.uid,
                    fe[r + 16 >> 2] = i.gid,
                    fe[r + 20 >> 2] = i.rdev,
                    Se[r + 24 >> 3] = BigInt(i.size),
                    fe[r + 32 >> 2] = 4096,
                    fe[r + 36 >> 2] = i.blocks;
                    var n = i.atime.getTime()
                      , s = i.mtime.getTime()
                      , p = i.ctime.getTime();
                    return Se[r + 40 >> 3] = BigInt(Math.floor(n / 1e3)),
                    ge[r + 48 >> 2] = n % 1e3 * 1e3,
                    Se[r + 56 >> 3] = BigInt(Math.floor(s / 1e3)),
                    ge[r + 64 >> 2] = s % 1e3 * 1e3,
                    Se[r + 72 >> 3] = BigInt(Math.floor(p / 1e3)),
                    ge[r + 80 >> 2] = p % 1e3 * 1e3,
                    Se[r + 88 >> 3] = BigInt(i.ino),
                    0
                },
                doMsync(e, t, r, i, n) {
                    if (!a.isFile(t.node.mode))
                        throw new a.ErrnoError(43);
                    if (i & 2)
                        return 0;
                    var s = ze.slice(e, e + r);
                    a.msync(t, s, n, r, i)
                },
                varargs: void 0,
                get() {
                    var e = fe[+te.varargs >> 2];
                    return te.varargs += 4,
                    e
                },
                getp() {
                    return te.get()
                },
                getStr(e) {
                    var t = Xe(e);
                    return t
                },
                getStreamFromFD(e) {
                    var t = a.getStreamChecked(e);
                    return t
                }
            };
            function vr(e, t) {
                try {
                    return e = te.getStr(e),
                    a.chmod(e, t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function wr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    r & -8)
                        return -28;
                    var n = a.lookupPath(t, {
                        follow: !0
                    })
                      , s = n.node;
                    if (!s)
                        return -44;
                    var p = "";
                    return r & 4 && (p += "r"),
                    r & 2 && (p += "w"),
                    r & 1 && (p += "x"),
                    p && a.nodePermissions(s, p) ? -2 : 0
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Er(e, t) {
                try {
                    return a.fchmod(e, t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function xr(e, t, r) {
                try {
                    return a.fchown(e, t, r),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            function Sr(e, t, r) {
                te.varargs = r;
                try {
                    var i = te.getStreamFromFD(e);
                    switch (t) {
                    case 0:
                        {
                            var n = te.get();
                            if (n < 0)
                                return -28;
                            for (; a.streams[n]; )
                                n++;
                            var s;
                            return s = a.createStream(i, n),
                            s.fd
                        }
                    case 1:
                    case 2:
                        return 0;
                    case 3:
                        return i.flags;
                    case 4:
                        {
                            var n = te.get();
                            return i.flags |= n,
                            0
                        }
                    case 12:
                        {
                            var n = te.getp()
                              , p = 0;
                            return Ne[n + p >> 1] = 2,
                            0
                        }
                    case 13:
                    case 14:
                        return 0
                    }
                    return -28
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Ar(e, t) {
                try {
                    var r = te.getStreamFromFD(e);
                    return te.doStat(a.stat, r.path, t)
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            var Ir = 9007199254740992
              , kr = -9007199254740992
              , Ve = e=>e < kr || e > Ir ? NaN : Number(e);
            function Tr(e, t) {
                t = Ve(t);
                try {
                    return isNaN(t) ? 61 : (a.ftruncate(e, t),
                    0)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            var gt = (e,t,r)=>pt(e, ze, t, r);
            function Fr(e, t) {
                try {
                    if (t === 0)
                        return -28;
                    var r = a.cwd()
                      , i = He(r) + 1;
                    return t < i ? -68 : (gt(r, e, t),
                    i)
                } catch (n) {
                    if (typeof a > "u" || n.name !== "ErrnoError")
                        throw n;
                    return -n.errno
                }
            }
            function Or(e, t, r) {
                te.varargs = r;
                try {
                    var i = te.getStreamFromFD(e);
                    switch (t) {
                    case 21509:
                        return i.tty ? 0 : -59;
                    case 21505:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tcgets) {
                                var n = i.tty.ops.ioctl_tcgets(i)
                                  , s = te.getp();
                                fe[s >> 2] = n.c_iflag || 0,
                                fe[s + 4 >> 2] = n.c_oflag || 0,
                                fe[s + 8 >> 2] = n.c_cflag || 0,
                                fe[s + 12 >> 2] = n.c_lflag || 0;
                                for (var p = 0; p < 32; p++)
                                    be[s + p + 17 >> 0] = n.c_cc[p] || 0;
                                return 0
                            }
                            return 0
                        }
                    case 21510:
                    case 21511:
                    case 21512:
                        return i.tty ? 0 : -59;
                    case 21506:
                    case 21507:
                    case 21508:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tcsets) {
                                for (var s = te.getp(), y = fe[s >> 2], O = fe[s + 4 >> 2], B = fe[s + 8 >> 2], G = fe[s + 12 >> 2], J = [], p = 0; p < 32; p++)
                                    J.push(be[s + p + 17 >> 0]);
                                return i.tty.ops.ioctl_tcsets(i.tty, t, {
                                    c_iflag: y,
                                    c_oflag: O,
                                    c_cflag: B,
                                    c_lflag: G,
                                    c_cc: J
                                })
                            }
                            return 0
                        }
                    case 21519:
                        {
                            if (!i.tty)
                                return -59;
                            var s = te.getp();
                            return fe[s >> 2] = 0,
                            0
                        }
                    case 21520:
                        return i.tty ? -28 : -59;
                    case 21531:
                        {
                            var s = te.getp();
                            return a.ioctl(i, t, s)
                        }
                    case 21523:
                        {
                            if (!i.tty)
                                return -59;
                            if (i.tty.ops.ioctl_tiocgwinsz) {
                                var Y = i.tty.ops.ioctl_tiocgwinsz(i.tty)
                                  , s = te.getp();
                                Ne[s >> 1] = Y[0],
                                Ne[s + 2 >> 1] = Y[1]
                            }
                            return 0
                        }
                    case 21524:
                        return i.tty ? 0 : -59;
                    case 21515:
                        return i.tty ? 0 : -59;
                    default:
                        return -28
                    }
                } catch (d) {
                    if (typeof a > "u" || d.name !== "ErrnoError")
                        throw d;
                    return -d.errno
                }
            }
            function Pr(e, t) {
                try {
                    return e = te.getStr(e),
                    te.doStat(a.lstat, e, t)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function Lr(e, t, r) {
                try {
                    return t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    t = pe.normalize(t),
                    t[t.length - 1] === "/" && (t = t.substr(0, t.length - 1)),
                    a.mkdir(t, r, 0),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            function Dr(e, t, r, i) {
                try {
                    t = te.getStr(t);
                    var n = i & 256
                      , s = i & 4096;
                    return i = i & -6401,
                    t = te.calculateAt(e, t, s),
                    te.doStat(n ? a.lstat : a.stat, t, r)
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return -p.errno
                }
            }
            function Cr(e, t, r, i) {
                te.varargs = i;
                try {
                    t = te.getStr(t),
                    t = te.calculateAt(e, t);
                    var n = i ? te.get() : 0;
                    return a.open(t, r, n).fd
                } catch (s) {
                    if (typeof a > "u" || s.name !== "ErrnoError")
                        throw s;
                    return -s.errno
                }
            }
            function Rr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    i <= 0)
                        return -28;
                    var n = a.readlink(t)
                      , s = Math.min(i, He(n))
                      , p = be[r + s];
                    return gt(n, r, i + 1),
                    be[r + s] = p,
                    s
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            function Nr(e) {
                try {
                    return e = te.getStr(e),
                    a.rmdir(e),
                    0
                } catch (t) {
                    if (typeof a > "u" || t.name !== "ErrnoError")
                        throw t;
                    return -t.errno
                }
            }
            function Mr(e, t) {
                try {
                    return e = te.getStr(e),
                    te.doStat(a.stat, e, t)
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return -r.errno
                }
            }
            function jr(e, t, r) {
                try {
                    return t = te.getStr(t),
                    t = te.calculateAt(e, t),
                    r === 0 ? a.unlink(t) : r === 512 ? a.rmdir(t) : Ce("Invalid flags passed to unlinkat"),
                    0
                } catch (i) {
                    if (typeof a > "u" || i.name !== "ErrnoError")
                        throw i;
                    return -i.errno
                }
            }
            var Rt = e=>ge[e >> 2] + fe[e + 4 >> 2] * 4294967296;
            function zr(e, t, r, i) {
                try {
                    if (t = te.getStr(t),
                    t = te.calculateAt(e, t, !0),
                    r) {
                        var p = Rt(r)
                          , y = fe[r + 8 >> 2];
                        n = p * 1e3 + y / 1e6,
                        r += 16,
                        p = Rt(r),
                        y = fe[r + 8 >> 2],
                        s = p * 1e3 + y / 1e6
                    } else
                        var n = Date.now()
                          , s = n;
                    return a.utime(t, n, s),
                    0
                } catch (O) {
                    if (typeof a > "u" || O.name !== "ErrnoError")
                        throw O;
                    return -O.errno
                }
            }
            var Br = 1
              , Ur = ()=>Br
              , Wr = e=>e % 4 === 0 && (e % 100 !== 0 || e % 400 === 0)
              , Qr = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]
              , Hr = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
              , Vr = e=>{
                var t = Wr(e.getFullYear())
                  , r = t ? Qr : Hr
                  , i = r[e.getMonth()] + e.getDate() - 1;
                return i
            }
            ;
            function Gr(e, t) {
                e = Ve(e);
                var r = new Date(e * 1e3);
                fe[t >> 2] = r.getSeconds(),
                fe[t + 4 >> 2] = r.getMinutes(),
                fe[t + 8 >> 2] = r.getHours(),
                fe[t + 12 >> 2] = r.getDate(),
                fe[t + 16 >> 2] = r.getMonth(),
                fe[t + 20 >> 2] = r.getFullYear() - 1900,
                fe[t + 24 >> 2] = r.getDay();
                var i = Vr(r) | 0;
                fe[t + 28 >> 2] = i,
                fe[t + 36 >> 2] = -(r.getTimezoneOffset() * 60);
                var n = new Date(r.getFullYear(),0,1)
                  , s = new Date(r.getFullYear(),6,1).getTimezoneOffset()
                  , p = n.getTimezoneOffset()
                  , y = (s != p && r.getTimezoneOffset() == Math.min(p, s)) | 0;
                fe[t + 32 >> 2] = y
            }
            function $r(e, t, r, i, n, s, p) {
                n = Ve(n);
                try {
                    if (isNaN(n))
                        return 61;
                    var y = te.getStreamFromFD(i)
                      , O = a.mmap(y, e, n, t, r)
                      , B = O.ptr;
                    return fe[s >> 2] = O.allocated,
                    ge[p >> 2] = B,
                    0
                } catch (G) {
                    if (typeof a > "u" || G.name !== "ErrnoError")
                        throw G;
                    return -G.errno
                }
            }
            function Kr(e, t, r, i, n, s) {
                s = Ve(s);
                try {
                    if (isNaN(s))
                        return 61;
                    var p = te.getStreamFromFD(n);
                    r & 2 && te.doMsync(e, p, t, i, s),
                    a.munmap(p)
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return -y.errno
                }
            }
            var Nt = e=>{
                var t = He(e) + 1
                  , r = Bt(t);
                return r && gt(e, r, t),
                r
            }
            , Jr = (e,t,r)=>{
                var i = new Date().getFullYear()
                  , n = new Date(i,0,1)
                  , s = new Date(i,6,1)
                  , p = n.getTimezoneOffset()
                  , y = s.getTimezoneOffset()
                  , O = Math.max(p, y);
                ge[e >> 2] = O * 60,
                fe[t >> 2] = Number(p != y);
                function B(f) {
                    var m = f.toTimeString().match(/\(([A-Za-z ]+)\)$/);
                    return m ? m[1] : "GMT"
                }
                var G = B(n)
                  , J = B(s)
                  , Y = Nt(G)
                  , d = Nt(J);
                y < p ? (ge[r >> 2] = Y,
                ge[r + 4 >> 2] = d) : (ge[r >> 2] = d,
                ge[r + 4 >> 2] = Y)
            }
            , Xr = ()=>Date.now(), Mt;
            Mt = ()=>performance.now();
            var Yr = ()=>2147483648
              , Zr = e=>{
                var t = De.buffer
                  , r = (e - t.byteLength + 65535) / 65536;
                try {
                    return De.grow(r),
                    St(),
                    1
                } catch {}
            }
              , en = e=>{
                var t = ze.length;
                e >>>= 0;
                var r = Yr();
                if (e > r)
                    return !1;
                for (var i = (O,B)=>O + (B - O % B) % B, n = 1; n <= 4; n *= 2) {
                    var s = t * (1 + .2 / n);
                    s = Math.min(s, e + 100663296);
                    var p = Math.min(r, i(Math.max(e, s), 65536))
                      , y = Zr(p);
                    if (y)
                        return !0
                }
                return !1
            }
              , qt = {}
              , tn = ()=>wt || "./this.program"
              , Ge = ()=>{
                if (!Ge.strings) {
                    var e = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8"
                      , t = {
                        USER: "web_user",
                        LOGNAME: "web_user",
                        PATH: "/",
                        PWD: "/",
                        HOME: "/home/web_user",
                        LANG: e,
                        _: tn()
                    };
                    for (var r in qt)
                        qt[r] === void 0 ? delete t[r] : t[r] = qt[r];
                    var i = [];
                    for (var r in t)
                        i.push(`${r}=${t[r]}`);
                    Ge.strings = i
                }
                return Ge.strings
            }
              , rn = (e,t)=>{
                for (var r = 0; r < e.length; ++r)
                    be[t++ >> 0] = e.charCodeAt(r);
                be[t >> 0] = 0
            }
              , nn = (e,t)=>{
                var r = 0;
                return Ge().forEach((i,n)=>{
                    var s = t + r;
                    ge[e + n * 4 >> 2] = s,
                    rn(i, s),
                    r += i.length + 1
                }
                ),
                0
            }
              , sn = (e,t)=>{
                var r = Ge();
                ge[e >> 2] = r.length;
                var i = 0;
                return r.forEach(n=>i += n.length + 1),
                ge[t >> 2] = i,
                0
            }
            ;
            function on(e) {
                try {
                    var t = te.getStreamFromFD(e);
                    return a.close(t),
                    0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return r.errno
                }
            }
            function an(e, t) {
                try {
                    var r = 0
                      , i = 0
                      , n = 0
                      , s = te.getStreamFromFD(e)
                      , p = s.tty ? 2 : a.isDir(s.mode) ? 3 : a.isLink(s.mode) ? 7 : 4;
                    return be[t >> 0] = p,
                    Ne[t + 2 >> 1] = n,
                    Se[t + 8 >> 3] = BigInt(r),
                    Se[t + 16 >> 3] = BigInt(i),
                    0
                } catch (y) {
                    if (typeof a > "u" || y.name !== "ErrnoError")
                        throw y;
                    return y.errno
                }
            }
            var ln = (e,t,r,i)=>{
                for (var n = 0, s = 0; s < r; s++) {
                    var p = ge[t >> 2]
                      , y = ge[t + 4 >> 2];
                    t += 8;
                    var O = a.read(e, be, p, y, i);
                    if (O < 0)
                        return -1;
                    if (n += O,
                    O < y)
                        break;
                    typeof i < "u" && (i += O)
                }
                return n
            }
            ;
            function cn(e, t, r, i) {
                try {
                    var n = te.getStreamFromFD(e)
                      , s = ln(n, t, r);
                    return ge[i >> 2] = s,
                    0
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return p.errno
                }
            }
            function _n(e, t, r, i) {
                t = Ve(t);
                try {
                    if (isNaN(t))
                        return 61;
                    var n = te.getStreamFromFD(e);
                    return a.llseek(n, t, r),
                    Se[i >> 3] = BigInt(n.position),
                    n.getdents && t === 0 && r === 0 && (n.getdents = null),
                    0
                } catch (s) {
                    if (typeof a > "u" || s.name !== "ErrnoError")
                        throw s;
                    return s.errno
                }
            }
            function un(e) {
                try {
                    var t = te.getStreamFromFD(e);
                    return t.stream_ops?.fsync ? t.stream_ops.fsync(t) : 0
                } catch (r) {
                    if (typeof a > "u" || r.name !== "ErrnoError")
                        throw r;
                    return r.errno
                }
            }
            var fn = (e,t,r,i)=>{
                for (var n = 0, s = 0; s < r; s++) {
                    var p = ge[t >> 2]
                      , y = ge[t + 4 >> 2];
                    t += 8;
                    var O = a.write(e, be, p, y, i);
                    if (O < 0)
                        return -1;
                    n += O,
                    typeof i < "u" && (i += O)
                }
                return n
            }
            ;
            function dn(e, t, r, i) {
                try {
                    var n = te.getStreamFromFD(e)
                      , s = fn(n, t, r);
                    return ge[i >> 2] = s,
                    0
                } catch (p) {
                    if (typeof a > "u" || p.name !== "ErrnoError")
                        throw p;
                    return p.errno
                }
            }
            var jt = function(e, t, r, i) {
                e || (e = this),
                this.parent = e,
                this.mount = e.mount,
                this.mounted = null,
                this.id = a.nextInode++,
                this.name = t,
                this.mode = r,
                this.node_ops = {},
                this.stream_ops = {},
                this.rdev = i
            }
              , Ye = 365
              , Ze = 146;
            Object.defineProperties(jt.prototype, {
                read: {
                    get: function() {
                        return (this.mode & Ye) === Ye
                    },
                    set: function(e) {
                        e ? this.mode |= Ye : this.mode &= ~Ye
                    }
                },
                write: {
                    get: function() {
                        return (this.mode & Ze) === Ze
                    },
                    set: function(e) {
                        e ? this.mode |= Ze : this.mode &= ~Ze
                    }
                },
                isFolder: {
                    get: function() {
                        return a.isDir(this.mode)
                    }
                },
                isDevice: {
                    get: function() {
                        return a.isChrdev(this.mode)
                    }
                }
            }),
            a.FSNode = jt,
            a.createPreloadedFile = br,
            a.staticInit();
            var zt = {
                __assert_fail: _r,
                __syscall_chmod: vr,
                __syscall_faccessat: wr,
                __syscall_fchmod: Er,
                __syscall_fchown32: xr,
                __syscall_fcntl64: Sr,
                __syscall_fstat64: Ar,
                __syscall_ftruncate64: Tr,
                __syscall_getcwd: Fr,
                __syscall_ioctl: Or,
                __syscall_lstat64: Pr,
                __syscall_mkdirat: Lr,
                __syscall_newfstatat: Dr,
                __syscall_openat: Cr,
                __syscall_readlinkat: Rr,
                __syscall_rmdir: Nr,
                __syscall_stat64: Mr,
                __syscall_unlinkat: jr,
                __syscall_utimensat: zr,
                _emscripten_get_now_is_monotonic: Ur,
                _localtime_js: Gr,
                _mmap_js: $r,
                _munmap_js: Kr,
                _tzset_js: Jr,
                emscripten_date_now: Xr,
                emscripten_get_now: Mt,
                emscripten_resize_heap: en,
                environ_get: nn,
                environ_sizes_get: sn,
                fd_close: on,
                fd_fdstat_get: an,
                fd_read: cn,
                fd_seek: _n,
                fd_sync: un,
                fd_write: dn,
                memory: De
            }
              , b = cr()
              , pn = ()=>(pn = b.__wasm_call_ctors)()
              , mn = o._sqlite3_status64 = (e,t,r,i)=>(mn = o._sqlite3_status64 = b.sqlite3_status64)(e, t, r, i)
              , hn = o._sqlite3_status = (e,t,r,i)=>(hn = o._sqlite3_status = b.sqlite3_status)(e, t, r, i)
              , gn = o._sqlite3_db_status = (e,t,r,i,n)=>(gn = o._sqlite3_db_status = b.sqlite3_db_status)(e, t, r, i, n)
              , qn = o._sqlite3_msize = e=>(qn = o._sqlite3_msize = b.sqlite3_msize)(e)
              , bn = o._sqlite3_vfs_find = e=>(bn = o._sqlite3_vfs_find = b.sqlite3_vfs_find)(e)
              , yn = o._sqlite3_initialize = ()=>(yn = o._sqlite3_initialize = b.sqlite3_initialize)()
              , vn = o._sqlite3_malloc = e=>(vn = o._sqlite3_malloc = b.sqlite3_malloc)(e)
              , wn = o._sqlite3_free = e=>(wn = o._sqlite3_free = b.sqlite3_free)(e)
              , En = o._sqlite3_vfs_register = (e,t)=>(En = o._sqlite3_vfs_register = b.sqlite3_vfs_register)(e, t)
              , xn = o._sqlite3_vfs_unregister = e=>(xn = o._sqlite3_vfs_unregister = b.sqlite3_vfs_unregister)(e)
              , Sn = o._sqlite3_malloc64 = e=>(Sn = o._sqlite3_malloc64 = b.sqlite3_malloc64)(e)
              , An = o._sqlite3_realloc = (e,t)=>(An = o._sqlite3_realloc = b.sqlite3_realloc)(e, t)
              , In = o._sqlite3_realloc64 = (e,t)=>(In = o._sqlite3_realloc64 = b.sqlite3_realloc64)(e, t)
              , kn = o._sqlite3_value_text = e=>(kn = o._sqlite3_value_text = b.sqlite3_value_text)(e)
              , Tn = o._sqlite3_randomness = (e,t)=>(Tn = o._sqlite3_randomness = b.sqlite3_randomness)(e, t)
              , Fn = o._sqlite3_stricmp = (e,t)=>(Fn = o._sqlite3_stricmp = b.sqlite3_stricmp)(e, t)
              , On = o._sqlite3_strnicmp = (e,t,r)=>(On = o._sqlite3_strnicmp = b.sqlite3_strnicmp)(e, t, r)
              , Pn = o._sqlite3_uri_parameter = (e,t)=>(Pn = o._sqlite3_uri_parameter = b.sqlite3_uri_parameter)(e, t)
              , Ln = o._sqlite3_uri_boolean = (e,t,r)=>(Ln = o._sqlite3_uri_boolean = b.sqlite3_uri_boolean)(e, t, r)
              , Dn = o._sqlite3_serialize = (e,t,r,i)=>(Dn = o._sqlite3_serialize = b.sqlite3_serialize)(e, t, r, i)
              , Cn = o._sqlite3_prepare_v2 = (e,t,r,i,n)=>(Cn = o._sqlite3_prepare_v2 = b.sqlite3_prepare_v2)(e, t, r, i, n)
              , Rn = o._sqlite3_step = e=>(Rn = o._sqlite3_step = b.sqlite3_step)(e)
              , Nn = o._sqlite3_column_int64 = (e,t)=>(Nn = o._sqlite3_column_int64 = b.sqlite3_column_int64)(e, t)
              , Mn = o._sqlite3_column_int = (e,t)=>(Mn = o._sqlite3_column_int = b.sqlite3_column_int)(e, t)
              , jn = o._sqlite3_finalize = e=>(jn = o._sqlite3_finalize = b.sqlite3_finalize)(e)
              , zn = o._sqlite3_file_control = (e,t,r,i)=>(zn = o._sqlite3_file_control = b.sqlite3_file_control)(e, t, r, i)
              , Bn = o._sqlite3_reset = e=>(Bn = o._sqlite3_reset = b.sqlite3_reset)(e)
              , Un = o._sqlite3_deserialize = (e,t,r,i,n,s)=>(Un = o._sqlite3_deserialize = b.sqlite3_deserialize)(e, t, r, i, n, s)
              , Wn = o._sqlite3_clear_bindings = e=>(Wn = o._sqlite3_clear_bindings = b.sqlite3_clear_bindings)(e)
              , Qn = o._sqlite3_value_blob = e=>(Qn = o._sqlite3_value_blob = b.sqlite3_value_blob)(e)
              , Hn = o._sqlite3_value_bytes = e=>(Hn = o._sqlite3_value_bytes = b.sqlite3_value_bytes)(e)
              , Vn = o._sqlite3_value_double = e=>(Vn = o._sqlite3_value_double = b.sqlite3_value_double)(e)
              , Gn = o._sqlite3_value_int = e=>(Gn = o._sqlite3_value_int = b.sqlite3_value_int)(e)
              , $n = o._sqlite3_value_int64 = e=>($n = o._sqlite3_value_int64 = b.sqlite3_value_int64)(e)
              , Kn = o._sqlite3_value_subtype = e=>(Kn = o._sqlite3_value_subtype = b.sqlite3_value_subtype)(e)
              , Jn = o._sqlite3_value_pointer = (e,t)=>(Jn = o._sqlite3_value_pointer = b.sqlite3_value_pointer)(e, t)
              , Xn = o._sqlite3_value_type = e=>(Xn = o._sqlite3_value_type = b.sqlite3_value_type)(e)
              , Yn = o._sqlite3_value_nochange = e=>(Yn = o._sqlite3_value_nochange = b.sqlite3_value_nochange)(e)
              , Zn = o._sqlite3_value_frombind = e=>(Zn = o._sqlite3_value_frombind = b.sqlite3_value_frombind)(e)
              , es = o._sqlite3_value_dup = e=>(es = o._sqlite3_value_dup = b.sqlite3_value_dup)(e)
              , ts = o._sqlite3_value_free = e=>(ts = o._sqlite3_value_free = b.sqlite3_value_free)(e)
              , rs = o._sqlite3_result_blob = (e,t,r,i)=>(rs = o._sqlite3_result_blob = b.sqlite3_result_blob)(e, t, r, i)
              , ns = o._sqlite3_result_error_toobig = e=>(ns = o._sqlite3_result_error_toobig = b.sqlite3_result_error_toobig)(e)
              , ss = o._sqlite3_result_error_nomem = e=>(ss = o._sqlite3_result_error_nomem = b.sqlite3_result_error_nomem)(e)
              , is = o._sqlite3_result_double = (e,t)=>(is = o._sqlite3_result_double = b.sqlite3_result_double)(e, t)
              , os = o._sqlite3_result_error = (e,t,r)=>(os = o._sqlite3_result_error = b.sqlite3_result_error)(e, t, r)
              , as = o._sqlite3_result_int = (e,t)=>(as = o._sqlite3_result_int = b.sqlite3_result_int)(e, t)
              , ls = o._sqlite3_result_int64 = (e,t)=>(ls = o._sqlite3_result_int64 = b.sqlite3_result_int64)(e, t)
              , cs = o._sqlite3_result_null = e=>(cs = o._sqlite3_result_null = b.sqlite3_result_null)(e)
              , _s = o._sqlite3_result_pointer = (e,t,r,i)=>(_s = o._sqlite3_result_pointer = b.sqlite3_result_pointer)(e, t, r, i)
              , us = o._sqlite3_result_subtype = (e,t)=>(us = o._sqlite3_result_subtype = b.sqlite3_result_subtype)(e, t)
              , fs = o._sqlite3_result_text = (e,t,r,i)=>(fs = o._sqlite3_result_text = b.sqlite3_result_text)(e, t, r, i)
              , ds = o._sqlite3_result_zeroblob = (e,t)=>(ds = o._sqlite3_result_zeroblob = b.sqlite3_result_zeroblob)(e, t)
              , ps = o._sqlite3_result_zeroblob64 = (e,t)=>(ps = o._sqlite3_result_zeroblob64 = b.sqlite3_result_zeroblob64)(e, t)
              , ms = o._sqlite3_result_error_code = (e,t)=>(ms = o._sqlite3_result_error_code = b.sqlite3_result_error_code)(e, t)
              , hs = o._sqlite3_user_data = e=>(hs = o._sqlite3_user_data = b.sqlite3_user_data)(e)
              , gs = o._sqlite3_context_db_handle = e=>(gs = o._sqlite3_context_db_handle = b.sqlite3_context_db_handle)(e)
              , qs = o._sqlite3_vtab_nochange = e=>(qs = o._sqlite3_vtab_nochange = b.sqlite3_vtab_nochange)(e)
              , bs = o._sqlite3_vtab_in_first = (e,t)=>(bs = o._sqlite3_vtab_in_first = b.sqlite3_vtab_in_first)(e, t)
              , ys = o._sqlite3_vtab_in_next = (e,t)=>(ys = o._sqlite3_vtab_in_next = b.sqlite3_vtab_in_next)(e, t)
              , vs = o._sqlite3_aggregate_context = (e,t)=>(vs = o._sqlite3_aggregate_context = b.sqlite3_aggregate_context)(e, t)
              , ws = o._sqlite3_get_auxdata = (e,t)=>(ws = o._sqlite3_get_auxdata = b.sqlite3_get_auxdata)(e, t)
              , Es = o._sqlite3_set_auxdata = (e,t,r,i)=>(Es = o._sqlite3_set_auxdata = b.sqlite3_set_auxdata)(e, t, r, i)
              , xs = o._sqlite3_column_count = e=>(xs = o._sqlite3_column_count = b.sqlite3_column_count)(e)
              , Ss = o._sqlite3_data_count = e=>(Ss = o._sqlite3_data_count = b.sqlite3_data_count)(e)
              , As = o._sqlite3_column_blob = (e,t)=>(As = o._sqlite3_column_blob = b.sqlite3_column_blob)(e, t)
              , Is = o._sqlite3_column_bytes = (e,t)=>(Is = o._sqlite3_column_bytes = b.sqlite3_column_bytes)(e, t)
              , ks = o._sqlite3_column_double = (e,t)=>(ks = o._sqlite3_column_double = b.sqlite3_column_double)(e, t)
              , Ts = o._sqlite3_column_text = (e,t)=>(Ts = o._sqlite3_column_text = b.sqlite3_column_text)(e, t)
              , Fs = o._sqlite3_column_value = (e,t)=>(Fs = o._sqlite3_column_value = b.sqlite3_column_value)(e, t)
              , Os = o._sqlite3_column_type = (e,t)=>(Os = o._sqlite3_column_type = b.sqlite3_column_type)(e, t)
              , Ps = o._sqlite3_column_name = (e,t)=>(Ps = o._sqlite3_column_name = b.sqlite3_column_name)(e, t)
              , Ls = o._sqlite3_bind_blob = (e,t,r,i,n)=>(Ls = o._sqlite3_bind_blob = b.sqlite3_bind_blob)(e, t, r, i, n)
              , Ds = o._sqlite3_bind_double = (e,t,r)=>(Ds = o._sqlite3_bind_double = b.sqlite3_bind_double)(e, t, r)
              , Cs = o._sqlite3_bind_int = (e,t,r)=>(Cs = o._sqlite3_bind_int = b.sqlite3_bind_int)(e, t, r)
              , Rs = o._sqlite3_bind_int64 = (e,t,r)=>(Rs = o._sqlite3_bind_int64 = b.sqlite3_bind_int64)(e, t, r)
              , Ns = o._sqlite3_bind_null = (e,t)=>(Ns = o._sqlite3_bind_null = b.sqlite3_bind_null)(e, t)
              , Ms = o._sqlite3_bind_pointer = (e,t,r,i,n)=>(Ms = o._sqlite3_bind_pointer = b.sqlite3_bind_pointer)(e, t, r, i, n)
              , js = o._sqlite3_bind_text = (e,t,r,i,n)=>(js = o._sqlite3_bind_text = b.sqlite3_bind_text)(e, t, r, i, n)
              , zs = o._sqlite3_bind_parameter_count = e=>(zs = o._sqlite3_bind_parameter_count = b.sqlite3_bind_parameter_count)(e)
              , Bs = o._sqlite3_bind_parameter_index = (e,t)=>(Bs = o._sqlite3_bind_parameter_index = b.sqlite3_bind_parameter_index)(e, t)
              , Us = o._sqlite3_db_handle = e=>(Us = o._sqlite3_db_handle = b.sqlite3_db_handle)(e)
              , Ws = o._sqlite3_stmt_readonly = e=>(Ws = o._sqlite3_stmt_readonly = b.sqlite3_stmt_readonly)(e)
              , Qs = o._sqlite3_stmt_isexplain = e=>(Qs = o._sqlite3_stmt_isexplain = b.sqlite3_stmt_isexplain)(e)
              , Hs = o._sqlite3_stmt_status = (e,t,r)=>(Hs = o._sqlite3_stmt_status = b.sqlite3_stmt_status)(e, t, r)
              , Vs = o._sqlite3_sql = e=>(Vs = o._sqlite3_sql = b.sqlite3_sql)(e)
              , Gs = o._sqlite3_expanded_sql = e=>(Gs = o._sqlite3_expanded_sql = b.sqlite3_expanded_sql)(e)
              , $s = o._sqlite3_preupdate_old = (e,t,r)=>($s = o._sqlite3_preupdate_old = b.sqlite3_preupdate_old)(e, t, r)
              , Ks = o._sqlite3_preupdate_count = e=>(Ks = o._sqlite3_preupdate_count = b.sqlite3_preupdate_count)(e)
              , Js = o._sqlite3_preupdate_depth = e=>(Js = o._sqlite3_preupdate_depth = b.sqlite3_preupdate_depth)(e)
              , Xs = o._sqlite3_preupdate_blobwrite = e=>(Xs = o._sqlite3_preupdate_blobwrite = b.sqlite3_preupdate_blobwrite)(e)
              , Ys = o._sqlite3_preupdate_new = (e,t,r)=>(Ys = o._sqlite3_preupdate_new = b.sqlite3_preupdate_new)(e, t, r)
              , Zs = o._sqlite3_value_numeric_type = e=>(Zs = o._sqlite3_value_numeric_type = b.sqlite3_value_numeric_type)(e)
              , ei = o._sqlite3_errmsg = e=>(ei = o._sqlite3_errmsg = b.sqlite3_errmsg)(e)
              , ti = o._sqlite3_set_authorizer = (e,t,r)=>(ti = o._sqlite3_set_authorizer = b.sqlite3_set_authorizer)(e, t, r)
              , ri = o._sqlite3_strglob = (e,t)=>(ri = o._sqlite3_strglob = b.sqlite3_strglob)(e, t)
              , ni = o._sqlite3_strlike = (e,t,r)=>(ni = o._sqlite3_strlike = b.sqlite3_strlike)(e, t, r)
              , si = o._sqlite3_exec = (e,t,r,i,n)=>(si = o._sqlite3_exec = b.sqlite3_exec)(e, t, r, i, n)
              , ii = o._sqlite3_auto_extension = e=>(ii = o._sqlite3_auto_extension = b.sqlite3_auto_extension)(e)
              , oi = o._sqlite3_cancel_auto_extension = e=>(oi = o._sqlite3_cancel_auto_extension = b.sqlite3_cancel_auto_extension)(e)
              , ai = o._sqlite3_reset_auto_extension = ()=>(ai = o._sqlite3_reset_auto_extension = b.sqlite3_reset_auto_extension)()
              , li = o._sqlite3_prepare_v3 = (e,t,r,i,n,s)=>(li = o._sqlite3_prepare_v3 = b.sqlite3_prepare_v3)(e, t, r, i, n, s)
              , ci = o._sqlite3_create_module = (e,t,r,i)=>(ci = o._sqlite3_create_module = b.sqlite3_create_module)(e, t, r, i)
              , _i = o._sqlite3_create_module_v2 = (e,t,r,i,n)=>(_i = o._sqlite3_create_module_v2 = b.sqlite3_create_module_v2)(e, t, r, i, n)
              , ui = o._sqlite3_drop_modules = (e,t)=>(ui = o._sqlite3_drop_modules = b.sqlite3_drop_modules)(e, t)
              , fi = o._sqlite3_declare_vtab = (e,t)=>(fi = o._sqlite3_declare_vtab = b.sqlite3_declare_vtab)(e, t)
              , di = o._sqlite3_vtab_on_conflict = e=>(di = o._sqlite3_vtab_on_conflict = b.sqlite3_vtab_on_conflict)(e)
              , pi = o._sqlite3_vtab_collation = (e,t)=>(pi = o._sqlite3_vtab_collation = b.sqlite3_vtab_collation)(e, t)
              , mi = o._sqlite3_vtab_in = (e,t,r)=>(mi = o._sqlite3_vtab_in = b.sqlite3_vtab_in)(e, t, r)
              , hi = o._sqlite3_vtab_rhs_value = (e,t,r)=>(hi = o._sqlite3_vtab_rhs_value = b.sqlite3_vtab_rhs_value)(e, t, r)
              , gi = o._sqlite3_vtab_distinct = e=>(gi = o._sqlite3_vtab_distinct = b.sqlite3_vtab_distinct)(e)
              , qi = o._sqlite3_keyword_name = (e,t,r)=>(qi = o._sqlite3_keyword_name = b.sqlite3_keyword_name)(e, t, r)
              , bi = o._sqlite3_keyword_count = ()=>(bi = o._sqlite3_keyword_count = b.sqlite3_keyword_count)()
              , yi = o._sqlite3_keyword_check = (e,t)=>(yi = o._sqlite3_keyword_check = b.sqlite3_keyword_check)(e, t)
              , vi = o._sqlite3_complete = e=>(vi = o._sqlite3_complete = b.sqlite3_complete)(e)
              , wi = o._sqlite3_libversion = ()=>(wi = o._sqlite3_libversion = b.sqlite3_libversion)()
              , Ei = o._sqlite3_libversion_number = ()=>(Ei = o._sqlite3_libversion_number = b.sqlite3_libversion_number)()
              , xi = o._sqlite3_shutdown = ()=>(xi = o._sqlite3_shutdown = b.sqlite3_shutdown)()
              , Si = o._sqlite3_last_insert_rowid = e=>(Si = o._sqlite3_last_insert_rowid = b.sqlite3_last_insert_rowid)(e)
              , Ai = o._sqlite3_set_last_insert_rowid = (e,t)=>(Ai = o._sqlite3_set_last_insert_rowid = b.sqlite3_set_last_insert_rowid)(e, t)
              , Ii = o._sqlite3_changes64 = e=>(Ii = o._sqlite3_changes64 = b.sqlite3_changes64)(e)
              , ki = o._sqlite3_changes = e=>(ki = o._sqlite3_changes = b.sqlite3_changes)(e)
              , Ti = o._sqlite3_total_changes64 = e=>(Ti = o._sqlite3_total_changes64 = b.sqlite3_total_changes64)(e)
              , Fi = o._sqlite3_total_changes = e=>(Fi = o._sqlite3_total_changes = b.sqlite3_total_changes)(e)
              , Oi = o._sqlite3_txn_state = (e,t)=>(Oi = o._sqlite3_txn_state = b.sqlite3_txn_state)(e, t)
              , Pi = o._sqlite3_close_v2 = e=>(Pi = o._sqlite3_close_v2 = b.sqlite3_close_v2)(e)
              , Li = o._sqlite3_busy_handler = (e,t,r)=>(Li = o._sqlite3_busy_handler = b.sqlite3_busy_handler)(e, t, r)
              , Di = o._sqlite3_progress_handler = (e,t,r,i)=>(Di = o._sqlite3_progress_handler = b.sqlite3_progress_handler)(e, t, r, i)
              , Ci = o._sqlite3_busy_timeout = (e,t)=>(Ci = o._sqlite3_busy_timeout = b.sqlite3_busy_timeout)(e, t)
              , Ri = o._sqlite3_create_function = (e,t,r,i,n,s,p,y)=>(Ri = o._sqlite3_create_function = b.sqlite3_create_function)(e, t, r, i, n, s, p, y)
              , Ni = o._sqlite3_create_function_v2 = (e,t,r,i,n,s,p,y,O)=>(Ni = o._sqlite3_create_function_v2 = b.sqlite3_create_function_v2)(e, t, r, i, n, s, p, y, O)
              , Mi = o._sqlite3_create_window_function = (e,t,r,i,n,s,p,y,O,B)=>(Mi = o._sqlite3_create_window_function = b.sqlite3_create_window_function)(e, t, r, i, n, s, p, y, O, B)
              , ji = o._sqlite3_overload_function = (e,t,r)=>(ji = o._sqlite3_overload_function = b.sqlite3_overload_function)(e, t, r)
              , zi = o._sqlite3_trace_v2 = (e,t,r,i)=>(zi = o._sqlite3_trace_v2 = b.sqlite3_trace_v2)(e, t, r, i)
              , Bi = o._sqlite3_commit_hook = (e,t,r)=>(Bi = o._sqlite3_commit_hook = b.sqlite3_commit_hook)(e, t, r)
              , Ui = o._sqlite3_update_hook = (e,t,r)=>(Ui = o._sqlite3_update_hook = b.sqlite3_update_hook)(e, t, r)
              , Wi = o._sqlite3_rollback_hook = (e,t,r)=>(Wi = o._sqlite3_rollback_hook = b.sqlite3_rollback_hook)(e, t, r)
              , Qi = o._sqlite3_preupdate_hook = (e,t,r)=>(Qi = o._sqlite3_preupdate_hook = b.sqlite3_preupdate_hook)(e, t, r)
              , Hi = o._sqlite3_error_offset = e=>(Hi = o._sqlite3_error_offset = b.sqlite3_error_offset)(e)
              , Vi = o._sqlite3_errcode = e=>(Vi = o._sqlite3_errcode = b.sqlite3_errcode)(e)
              , Gi = o._sqlite3_extended_errcode = e=>(Gi = o._sqlite3_extended_errcode = b.sqlite3_extended_errcode)(e)
              , $i = o._sqlite3_errstr = e=>($i = o._sqlite3_errstr = b.sqlite3_errstr)(e)
              , Ki = o._sqlite3_limit = (e,t,r)=>(Ki = o._sqlite3_limit = b.sqlite3_limit)(e, t, r)
              , Ji = o._sqlite3_open = (e,t)=>(Ji = o._sqlite3_open = b.sqlite3_open)(e, t)
              , Xi = o._sqlite3_open_v2 = (e,t,r,i)=>(Xi = o._sqlite3_open_v2 = b.sqlite3_open_v2)(e, t, r, i)
              , Yi = o._sqlite3_create_collation = (e,t,r,i,n)=>(Yi = o._sqlite3_create_collation = b.sqlite3_create_collation)(e, t, r, i, n)
              , Zi = o._sqlite3_create_collation_v2 = (e,t,r,i,n,s)=>(Zi = o._sqlite3_create_collation_v2 = b.sqlite3_create_collation_v2)(e, t, r, i, n, s)
              , eo = o._sqlite3_collation_needed = (e,t,r)=>(eo = o._sqlite3_collation_needed = b.sqlite3_collation_needed)(e, t, r)
              , to = o._sqlite3_get_autocommit = e=>(to = o._sqlite3_get_autocommit = b.sqlite3_get_autocommit)(e)
              , ro = o._sqlite3_table_column_metadata = (e,t,r,i,n,s,p,y,O)=>(ro = o._sqlite3_table_column_metadata = b.sqlite3_table_column_metadata)(e, t, r, i, n, s, p, y, O)
              , no = o._sqlite3_extended_result_codes = (e,t)=>(no = o._sqlite3_extended_result_codes = b.sqlite3_extended_result_codes)(e, t)
              , so = o._sqlite3_uri_key = (e,t)=>(so = o._sqlite3_uri_key = b.sqlite3_uri_key)(e, t)
              , io = o._sqlite3_uri_int64 = (e,t,r)=>(io = o._sqlite3_uri_int64 = b.sqlite3_uri_int64)(e, t, r)
              , oo = o._sqlite3_db_name = (e,t)=>(oo = o._sqlite3_db_name = b.sqlite3_db_name)(e, t)
              , ao = o._sqlite3_db_filename = (e,t)=>(ao = o._sqlite3_db_filename = b.sqlite3_db_filename)(e, t)
              , lo = o._sqlite3_compileoption_used = e=>(lo = o._sqlite3_compileoption_used = b.sqlite3_compileoption_used)(e)
              , co = o._sqlite3_compileoption_get = e=>(co = o._sqlite3_compileoption_get = b.sqlite3_compileoption_get)(e)
              , _o = o._sqlite3session_diff = (e,t,r,i)=>(_o = o._sqlite3session_diff = b.sqlite3session_diff)(e, t, r, i)
              , uo = o._sqlite3session_attach = (e,t)=>(uo = o._sqlite3session_attach = b.sqlite3session_attach)(e, t)
              , fo = o._sqlite3session_create = (e,t,r)=>(fo = o._sqlite3session_create = b.sqlite3session_create)(e, t, r)
              , po = o._sqlite3session_delete = e=>(po = o._sqlite3session_delete = b.sqlite3session_delete)(e)
              , mo = o._sqlite3session_table_filter = (e,t,r)=>(mo = o._sqlite3session_table_filter = b.sqlite3session_table_filter)(e, t, r)
              , ho = o._sqlite3session_changeset = (e,t,r)=>(ho = o._sqlite3session_changeset = b.sqlite3session_changeset)(e, t, r)
              , go = o._sqlite3session_changeset_strm = (e,t,r)=>(go = o._sqlite3session_changeset_strm = b.sqlite3session_changeset_strm)(e, t, r)
              , qo = o._sqlite3session_patchset_strm = (e,t,r)=>(qo = o._sqlite3session_patchset_strm = b.sqlite3session_patchset_strm)(e, t, r)
              , bo = o._sqlite3session_patchset = (e,t,r)=>(bo = o._sqlite3session_patchset = b.sqlite3session_patchset)(e, t, r)
              , yo = o._sqlite3session_enable = (e,t)=>(yo = o._sqlite3session_enable = b.sqlite3session_enable)(e, t)
              , vo = o._sqlite3session_indirect = (e,t)=>(vo = o._sqlite3session_indirect = b.sqlite3session_indirect)(e, t)
              , wo = o._sqlite3session_isempty = e=>(wo = o._sqlite3session_isempty = b.sqlite3session_isempty)(e)
              , Eo = o._sqlite3session_memory_used = e=>(Eo = o._sqlite3session_memory_used = b.sqlite3session_memory_used)(e)
              , xo = o._sqlite3session_object_config = (e,t,r)=>(xo = o._sqlite3session_object_config = b.sqlite3session_object_config)(e, t, r)
              , So = o._sqlite3session_changeset_size = e=>(So = o._sqlite3session_changeset_size = b.sqlite3session_changeset_size)(e)
              , Ao = o._sqlite3changeset_start = (e,t,r)=>(Ao = o._sqlite3changeset_start = b.sqlite3changeset_start)(e, t, r)
              , Io = o._sqlite3changeset_start_v2 = (e,t,r,i)=>(Io = o._sqlite3changeset_start_v2 = b.sqlite3changeset_start_v2)(e, t, r, i)
              , ko = o._sqlite3changeset_start_strm = (e,t,r)=>(ko = o._sqlite3changeset_start_strm = b.sqlite3changeset_start_strm)(e, t, r)
              , To = o._sqlite3changeset_start_v2_strm = (e,t,r,i)=>(To = o._sqlite3changeset_start_v2_strm = b.sqlite3changeset_start_v2_strm)(e, t, r, i)
              , Fo = o._sqlite3changeset_next = e=>(Fo = o._sqlite3changeset_next = b.sqlite3changeset_next)(e)
              , Oo = o._sqlite3changeset_op = (e,t,r,i,n)=>(Oo = o._sqlite3changeset_op = b.sqlite3changeset_op)(e, t, r, i, n)
              , Po = o._sqlite3changeset_pk = (e,t,r)=>(Po = o._sqlite3changeset_pk = b.sqlite3changeset_pk)(e, t, r)
              , Lo = o._sqlite3changeset_old = (e,t,r)=>(Lo = o._sqlite3changeset_old = b.sqlite3changeset_old)(e, t, r)
              , Do = o._sqlite3changeset_new = (e,t,r)=>(Do = o._sqlite3changeset_new = b.sqlite3changeset_new)(e, t, r)
              , Co = o._sqlite3changeset_conflict = (e,t,r)=>(Co = o._sqlite3changeset_conflict = b.sqlite3changeset_conflict)(e, t, r)
              , Ro = o._sqlite3changeset_fk_conflicts = (e,t)=>(Ro = o._sqlite3changeset_fk_conflicts = b.sqlite3changeset_fk_conflicts)(e, t)
              , No = o._sqlite3changeset_finalize = e=>(No = o._sqlite3changeset_finalize = b.sqlite3changeset_finalize)(e)
              , Mo = o._sqlite3changeset_invert = (e,t,r,i)=>(Mo = o._sqlite3changeset_invert = b.sqlite3changeset_invert)(e, t, r, i)
              , jo = o._sqlite3changeset_invert_strm = (e,t,r,i)=>(jo = o._sqlite3changeset_invert_strm = b.sqlite3changeset_invert_strm)(e, t, r, i)
              , zo = o._sqlite3changeset_apply_v2 = (e,t,r,i,n,s,p,y,O)=>(zo = o._sqlite3changeset_apply_v2 = b.sqlite3changeset_apply_v2)(e, t, r, i, n, s, p, y, O)
              , Bo = o._sqlite3changeset_apply = (e,t,r,i,n,s)=>(Bo = o._sqlite3changeset_apply = b.sqlite3changeset_apply)(e, t, r, i, n, s)
              , Uo = o._sqlite3changeset_apply_v2_strm = (e,t,r,i,n,s,p,y,O)=>(Uo = o._sqlite3changeset_apply_v2_strm = b.sqlite3changeset_apply_v2_strm)(e, t, r, i, n, s, p, y, O)
              , Wo = o._sqlite3changeset_apply_strm = (e,t,r,i,n,s)=>(Wo = o._sqlite3changeset_apply_strm = b.sqlite3changeset_apply_strm)(e, t, r, i, n, s)
              , Qo = o._sqlite3changegroup_new = e=>(Qo = o._sqlite3changegroup_new = b.sqlite3changegroup_new)(e)
              , Ho = o._sqlite3changegroup_add = (e,t,r)=>(Ho = o._sqlite3changegroup_add = b.sqlite3changegroup_add)(e, t, r)
              , Vo = o._sqlite3changegroup_output = (e,t,r)=>(Vo = o._sqlite3changegroup_output = b.sqlite3changegroup_output)(e, t, r)
              , Go = o._sqlite3changegroup_add_strm = (e,t,r)=>(Go = o._sqlite3changegroup_add_strm = b.sqlite3changegroup_add_strm)(e, t, r)
              , $o = o._sqlite3changegroup_output_strm = (e,t,r)=>($o = o._sqlite3changegroup_output_strm = b.sqlite3changegroup_output_strm)(e, t, r)
              , Ko = o._sqlite3changegroup_delete = e=>(Ko = o._sqlite3changegroup_delete = b.sqlite3changegroup_delete)(e)
              , Jo = o._sqlite3changeset_concat = (e,t,r,i,n,s)=>(Jo = o._sqlite3changeset_concat = b.sqlite3changeset_concat)(e, t, r, i, n, s)
              , Xo = o._sqlite3changeset_concat_strm = (e,t,r,i,n,s)=>(Xo = o._sqlite3changeset_concat_strm = b.sqlite3changeset_concat_strm)(e, t, r, i, n, s)
              , Yo = o._sqlite3session_config = (e,t)=>(Yo = o._sqlite3session_config = b.sqlite3session_config)(e, t)
              , Zo = o._sqlite3_sourceid = ()=>(Zo = o._sqlite3_sourceid = b.sqlite3_sourceid)()
              , ea = o._sqlite3_wasm_pstack_ptr = ()=>(ea = o._sqlite3_wasm_pstack_ptr = b.sqlite3_wasm_pstack_ptr)()
              , ta = o._sqlite3_wasm_pstack_restore = e=>(ta = o._sqlite3_wasm_pstack_restore = b.sqlite3_wasm_pstack_restore)(e)
              , ra = o._sqlite3_wasm_pstack_alloc = e=>(ra = o._sqlite3_wasm_pstack_alloc = b.sqlite3_wasm_pstack_alloc)(e)
              , na = o._sqlite3_wasm_pstack_remaining = ()=>(na = o._sqlite3_wasm_pstack_remaining = b.sqlite3_wasm_pstack_remaining)()
              , sa = o._sqlite3_wasm_pstack_quota = ()=>(sa = o._sqlite3_wasm_pstack_quota = b.sqlite3_wasm_pstack_quota)()
              , ia = o._sqlite3_wasm_db_error = (e,t,r)=>(ia = o._sqlite3_wasm_db_error = b.sqlite3_wasm_db_error)(e, t, r)
              , oa = o._sqlite3_wasm_test_struct = e=>(oa = o._sqlite3_wasm_test_struct = b.sqlite3_wasm_test_struct)(e)
              , aa = o._sqlite3_wasm_enum_json = ()=>(aa = o._sqlite3_wasm_enum_json = b.sqlite3_wasm_enum_json)()
              , la = o._sqlite3_wasm_vfs_unlink = (e,t)=>(la = o._sqlite3_wasm_vfs_unlink = b.sqlite3_wasm_vfs_unlink)(e, t)
              , ca = o._sqlite3_wasm_db_vfs = (e,t)=>(ca = o._sqlite3_wasm_db_vfs = b.sqlite3_wasm_db_vfs)(e, t)
              , _a = o._sqlite3_wasm_db_reset = e=>(_a = o._sqlite3_wasm_db_reset = b.sqlite3_wasm_db_reset)(e)
              , ua = o._sqlite3_wasm_db_export_chunked = (e,t)=>(ua = o._sqlite3_wasm_db_export_chunked = b.sqlite3_wasm_db_export_chunked)(e, t)
              , fa = o._sqlite3_wasm_db_serialize = (e,t,r,i,n)=>(fa = o._sqlite3_wasm_db_serialize = b.sqlite3_wasm_db_serialize)(e, t, r, i, n)
              , da = o._sqlite3_wasm_vfs_create_file = (e,t,r,i)=>(da = o._sqlite3_wasm_vfs_create_file = b.sqlite3_wasm_vfs_create_file)(e, t, r, i)
              , pa = o._sqlite3_wasm_posix_create_file = (e,t,r)=>(pa = o._sqlite3_wasm_posix_create_file = b.sqlite3_wasm_posix_create_file)(e, t, r)
              , ma = o._sqlite3_wasm_kvvfsMakeKeyOnPstack = (e,t)=>(ma = o._sqlite3_wasm_kvvfsMakeKeyOnPstack = b.sqlite3_wasm_kvvfsMakeKeyOnPstack)(e, t)
              , ha = o._sqlite3_wasm_kvvfs_methods = ()=>(ha = o._sqlite3_wasm_kvvfs_methods = b.sqlite3_wasm_kvvfs_methods)()
              , ga = o._sqlite3_wasm_vtab_config = (e,t,r)=>(ga = o._sqlite3_wasm_vtab_config = b.sqlite3_wasm_vtab_config)(e, t, r)
              , qa = o._sqlite3_wasm_db_config_ip = (e,t,r,i)=>(qa = o._sqlite3_wasm_db_config_ip = b.sqlite3_wasm_db_config_ip)(e, t, r, i)
              , ba = o._sqlite3_wasm_db_config_pii = (e,t,r,i,n)=>(ba = o._sqlite3_wasm_db_config_pii = b.sqlite3_wasm_db_config_pii)(e, t, r, i, n)
              , ya = o._sqlite3_wasm_db_config_s = (e,t,r)=>(ya = o._sqlite3_wasm_db_config_s = b.sqlite3_wasm_db_config_s)(e, t, r)
              , va = o._sqlite3_wasm_config_i = (e,t)=>(va = o._sqlite3_wasm_config_i = b.sqlite3_wasm_config_i)(e, t)
              , wa = o._sqlite3_wasm_config_ii = (e,t,r)=>(wa = o._sqlite3_wasm_config_ii = b.sqlite3_wasm_config_ii)(e, t, r)
              , Ea = o._sqlite3_wasm_config_j = (e,t)=>(Ea = o._sqlite3_wasm_config_j = b.sqlite3_wasm_config_j)(e, t)
              , xa = o._sqlite3_wasm_init_wasmfs = e=>(xa = o._sqlite3_wasm_init_wasmfs = b.sqlite3_wasm_init_wasmfs)(e)
              , Sa = o._sqlite3_wasm_test_intptr = e=>(Sa = o._sqlite3_wasm_test_intptr = b.sqlite3_wasm_test_intptr)(e)
              , Aa = o._sqlite3_wasm_test_voidptr = e=>(Aa = o._sqlite3_wasm_test_voidptr = b.sqlite3_wasm_test_voidptr)(e)
              , Ia = o._sqlite3_wasm_test_int64_max = ()=>(Ia = o._sqlite3_wasm_test_int64_max = b.sqlite3_wasm_test_int64_max)()
              , ka = o._sqlite3_wasm_test_int64_min = ()=>(ka = o._sqlite3_wasm_test_int64_min = b.sqlite3_wasm_test_int64_min)()
              , Ta = o._sqlite3_wasm_test_int64_times2 = e=>(Ta = o._sqlite3_wasm_test_int64_times2 = b.sqlite3_wasm_test_int64_times2)(e)
              , Fa = o._sqlite3_wasm_test_int64_minmax = (e,t)=>(Fa = o._sqlite3_wasm_test_int64_minmax = b.sqlite3_wasm_test_int64_minmax)(e, t)
              , Oa = o._sqlite3_wasm_test_int64ptr = e=>(Oa = o._sqlite3_wasm_test_int64ptr = b.sqlite3_wasm_test_int64ptr)(e)
              , Pa = o._sqlite3_wasm_test_stack_overflow = e=>(Pa = o._sqlite3_wasm_test_stack_overflow = b.sqlite3_wasm_test_stack_overflow)(e)
              , La = o._sqlite3_wasm_test_str_hello = e=>(La = o._sqlite3_wasm_test_str_hello = b.sqlite3_wasm_test_str_hello)(e)
              , Da = o._sqlite3_wasm_SQLTester_strglob = (e,t)=>(Da = o._sqlite3_wasm_SQLTester_strglob = b.sqlite3_wasm_SQLTester_strglob)(e, t)
              , Bt = o._malloc = e=>(Bt = o._malloc = b.malloc)(e)
              , Ca = o._free = e=>(Ca = o._free = b.free)(e)
              , Ra = o._realloc = (e,t)=>(Ra = o._realloc = b.realloc)(e, t)
              , Ut = (e,t)=>(Ut = b.emscripten_builtin_memalign)(e, t)
              , Na = ()=>(Na = b.stackSave)()
              , Ma = e=>(Ma = b.stackRestore)(e)
              , ja = e=>(ja = b.stackAlloc)(e);
            o.wasmMemory = De;
            var et;
            Qe = function e() {
                et || Wt(),
                et || (Qe = e)
            }
            ;
            function Wt() {
                if (Me > 0 || (er(),
                Me > 0))
                    return;
                function e() {
                    et || (et = !0,
                    o.calledRun = !0,
                    !xt && (tr(),
                    Ie(o),
                    o.onRuntimeInitialized && o.onRuntimeInitialized(),
                    rr()))
                }
                o.setStatus ? (o.setStatus("Running..."),
                setTimeout(function() {
                    setTimeout(function() {
                        o.setStatus("")
                    }, 1),
                    e()
                }, 1)) : e()
            }
            if (o.preInit)
                for (typeof o.preInit == "function" && (o.preInit = [o.preInit]); o.preInit.length > 0; )
                    o.preInit.pop()();
            return Wt(),
            o.postRun || (o.postRun = []),
            o.postRun.push(function(e) {
                "use strict";
                "use strict";
                if (globalThis.sqlite3ApiBootstrap = function t(r=globalThis.sqlite3ApiConfig || t.defaultConfig) {
                    if (t.sqlite3)
                        return console.warn("sqlite3ApiBootstrap() called multiple times.", "Config and external initializers are ignored on calls after the first."),
                        t.sqlite3;
                    let i = Object.assign(Object.create(null), {
                        exports: void 0,
                        memory: void 0,
                        bigIntEnabled: (()=>typeof e < "u" ? !!e.HEAPU64 : !!globalThis.BigInt64Array)(),
                        debug: console.debug.bind(console),
                        warn: console.warn.bind(console),
                        error: console.error.bind(console),
                        log: console.log.bind(console),
                        wasmfsOpfsDir: "/opfs",
                        useStdAlloc: !1
                    }, r || {});
                    Object.assign(i, {
                        allocExportName: i.useStdAlloc ? "malloc" : "sqlite3_malloc",
                        deallocExportName: i.useStdAlloc ? "free" : "sqlite3_free",
                        reallocExportName: i.useStdAlloc ? "realloc" : "sqlite3_realloc"
                    }, i),
                    ["exports", "memory", "wasmfsOpfsDir"].forEach(l=>{
                        typeof i[l] == "function" && (i[l] = i[l]())
                    }
                    );
                    let n = Object.create(null)
                      , s = Object.create(null)
                      , p = l=>n.sqlite3_js_rc_str && n.sqlite3_js_rc_str(l) || "Unknown result code #" + l
                      , y = l=>typeof l == "number" && l === (l | 0);
                    class O extends Error {
                        constructor(..._) {
                            let c;
                            if (_.length)
                                if (y(_[0]))
                                    if (c = _[0],
                                    _.length === 1)
                                        super(p(_[0]));
                                    else {
                                        let w = p(c);
                                        typeof _[1] == "object" ? super(w, _[1]) : (_[0] = w + ":",
                                        super(_.join(" ")))
                                    }
                                else
                                    _.length === 2 && typeof _[1] == "object" ? super(..._) : super(_.join(" "));
                            this.resultCode = c || n.SQLITE_ERROR,
                            this.name = "SQLite3Error"
                        }
                    }
                    O.toss = (...l)=>{
                        throw new O(...l)
                    }
                    ;
                    let B = O.toss;
                    i.wasmfsOpfsDir && !/^\/[^/]+$/.test(i.wasmfsOpfsDir) && B("config.wasmfsOpfsDir must be falsy or in the form '/dir-name'.");
                    let G = l=>typeof l != "bigint" && l === (l | 0) && l <= 2147483647 && l >= -2147483648
                      , J = function l(_) {
                        return l._max || (l._max = BigInt("0x7fffffffffffffff"),
                        l._min = ~l._max),
                        _ >= l._min && _ <= l._max
                    }
                      , Y = l=>l >= -0x7fffffffn - 1n && l <= 0x7fffffffn
                      , d = function l(_) {
                        return l._min || (l._min = Number.MIN_SAFE_INTEGER,
                        l._max = Number.MAX_SAFE_INTEGER),
                        _ >= l._min && _ <= l._max
                    }
                      , f = l=>l && l.constructor && G(l.constructor.BYTES_PER_ELEMENT) ? l : !1
                      , m = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , I = l=>l.buffer instanceof m
                      , x = (l,_,c)=>I(l) ? l.slice(_, c) : l.subarray(_, c)
                      , S = l=>l && (l instanceof Uint8Array || l instanceof Int8Array || l instanceof ArrayBuffer)
                      , R = l=>l && (l instanceof Uint8Array || l instanceof Int8Array || l instanceof ArrayBuffer)
                      , z = l=>S(l) || B("Value is not of a supported TypedArray type.")
                      , L = new TextDecoder("utf-8")
                      , $ = function(l, _, c) {
                        return L.decode(x(l, _, c))
                    }
                      , u = function(l) {
                        return R(l) ? $(l instanceof ArrayBuffer ? new Uint8Array(l) : l) : Array.isArray(l) ? l.join("") : (s.isPtr(l) && (l = s.cstrToJs(l)),
                        l)
                    };
                    class q extends Error {
                        constructor(..._) {
                            _.length === 2 && typeof _[1] == "object" ? super(..._) : _.length ? super(_.join(" ")) : super("Allocation failed."),
                            this.resultCode = n.SQLITE_NOMEM,
                            this.name = "WasmAllocError"
                        }
                    }
                    q.toss = (...l)=>{
                        throw new q(...l)
                    }
                    ,
                    Object.assign(n, {
                        sqlite3_bind_blob: void 0,
                        sqlite3_bind_text: void 0,
                        sqlite3_create_function_v2: (l,_,c,w,j,H,se,ee,ie)=>{}
                        ,
                        sqlite3_create_function: (l,_,c,w,j,H,se,ee)=>{}
                        ,
                        sqlite3_create_window_function: (l,_,c,w,j,H,se,ee,ie,le)=>{}
                        ,
                        sqlite3_prepare_v3: (l,_,c,w,j,H)=>{}
                        ,
                        sqlite3_prepare_v2: (l,_,c,w,j)=>{}
                        ,
                        sqlite3_exec: (l,_,c,w,j)=>{}
                        ,
                        sqlite3_randomness: (l,_)=>{}
                    });
                    let F = {
                        affirmBindableTypedArray: z,
                        flexibleString: u,
                        bigIntFits32: Y,
                        bigIntFits64: J,
                        bigIntFitsDouble: d,
                        isBindableTypedArray: S,
                        isInt32: G,
                        isSQLableTypedArray: R,
                        isTypedArray: f,
                        typedArrayToString: $,
                        isUIThread: ()=>globalThis.window === globalThis && !!globalThis.document,
                        isSharedTypedArray: I,
                        toss: function(...l) {
                            throw new Error(l.join(" "))
                        },
                        toss3: B,
                        typedArrayPart: x,
                        affirmDbHeader: function(l) {
                            l instanceof ArrayBuffer && (l = new Uint8Array(l));
                            let _ = "SQLite format 3";
                            _.length > l.byteLength && B("Input does not contain an SQLite3 database header.");
                            for (let c = 0; c < _.length; ++c)
                                _.charCodeAt(c) !== l[c] && B("Input does not contain an SQLite3 database header.")
                        },
                        affirmIsDb: function(l) {
                            l instanceof ArrayBuffer && (l = new Uint8Array(l));
                            let _ = l.byteLength;
                            (_ < 512 || _ % 512 !== 0) && B("Byte array size", _, "is invalid for an SQLite3 db."),
                            F.affirmDbHeader(l)
                        }
                    };
                    Object.assign(s, {
                        ptrSizeof: i.wasmPtrSizeof || 4,
                        ptrIR: i.wasmPtrIR || "i32",
                        bigIntEnabled: !!i.bigIntEnabled,
                        exports: i.exports || B("Missing API config.exports (WASM module exports)."),
                        memory: i.memory || i.exports.memory || B("API config object requires a WebAssembly.Memory object", "in either config.exports.memory (exported)", "or config.memory (imported)."),
                        alloc: void 0,
                        realloc: void 0,
                        dealloc: void 0
                    }),
                    s.allocFromTypedArray = function(l) {
                        l instanceof ArrayBuffer && (l = new Uint8Array(l)),
                        z(l);
                        let _ = s.alloc(l.byteLength || 1);
                        return s.heapForSize(l.constructor).set(l.byteLength ? l : [0], _),
                        _
                    }
                    ;
                    {
                        let l = i.allocExportName
                          , _ = i.deallocExportName
                          , c = i.reallocExportName;
                        for (let w of [l, _, c])
                            s.exports[w]instanceof Function || B("Missing required exports[", w, "] function.");
                        s.alloc = function w(j) {
                            return w.impl(j) || q.toss("Failed to allocate", j, " bytes.")
                        }
                        ,
                        s.alloc.impl = s.exports[l],
                        s.realloc = function w(j, H) {
                            let se = w.impl(j, H);
                            return H ? se || q.toss("Failed to reallocate", H, " bytes.") : 0
                        }
                        ,
                        s.realloc.impl = s.exports[c],
                        s.dealloc = s.exports[_]
                    }
                    s.compileOptionUsed = function l(_) {
                        if (arguments.length) {
                            if (Array.isArray(_)) {
                                let c = {};
                                return _.forEach(w=>{
                                    c[w] = n.sqlite3_compileoption_used(w)
                                }
                                ),
                                c
                            } else if (typeof _ == "object")
                                return Object.keys(_).forEach(c=>{
                                    _[c] = n.sqlite3_compileoption_used(c)
                                }
                                ),
                                _
                        } else {
                            if (l._result)
                                return l._result;
                            l._opt || (l._rx = /^([^=]+)=(.+)/,
                            l._rxInt = /^-?\d+$/,
                            l._opt = function(se, ee) {
                                let ie = l._rx.exec(se);
                                ee[0] = ie ? ie[1] : se,
                                ee[1] = ie ? l._rxInt.test(ie[2]) ? +ie[2] : ie[2] : !0
                            }
                            );
                            let c = {}, w = [0, 0], j = 0, H;
                            for (; H = n.sqlite3_compileoption_get(j++); )
                                l._opt(H, w),
                                c[w[0]] = w[1];
                            return l._result = c
                        }
                        return typeof _ == "string" ? !!n.sqlite3_compileoption_used(_) : !1
                    }
                    ,
                    s.pstack = Object.assign(Object.create(null), {
                        restore: s.exports.sqlite3_wasm_pstack_restore,
                        alloc: function(l) {
                            return typeof l == "string" && !(l = s.sizeofIR(l)) && q.toss("Invalid value for pstack.alloc(", arguments[0], ")"),
                            s.exports.sqlite3_wasm_pstack_alloc(l) || q.toss("Could not allocate", l, "bytes from the pstack.")
                        },
                        allocChunks: function(l, _) {
                            typeof _ == "string" && !(_ = s.sizeofIR(_)) && q.toss("Invalid size value for allocChunks(", arguments[1], ")");
                            let c = s.pstack.alloc(l * _)
                              , w = []
                              , j = 0
                              , H = 0;
                            for (; j < l; ++j,
                            H += _)
                                w.push(c + H);
                            return w
                        },
                        allocPtr: (l=1,_=!0)=>l === 1 ? s.pstack.alloc(_ ? 8 : s.ptrSizeof) : s.pstack.allocChunks(l, _ ? 8 : s.ptrSizeof),
                        call: function(l) {
                            let _ = s.pstack.pointer;
                            try {
                                return l(h)
                            } finally {
                                s.pstack.restore(_)
                            }
                        }
                    }),
                    Object.defineProperties(s.pstack, {
                        pointer: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_ptr
                        },
                        quota: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_quota
                        },
                        remaining: {
                            configurable: !1,
                            iterable: !0,
                            writeable: !1,
                            get: s.exports.sqlite3_wasm_pstack_remaining
                        }
                    }),
                    n.sqlite3_randomness = (...l)=>{
                        if (l.length === 1 && F.isTypedArray(l[0]) && l[0].BYTES_PER_ELEMENT === 1) {
                            let _ = l[0];
                            if (_.byteLength === 0)
                                return s.exports.sqlite3_randomness(0, 0),
                                _;
                            let c = s.pstack.pointer;
                            try {
                                let w = _.byteLength
                                  , j = 0
                                  , H = s.exports.sqlite3_randomness
                                  , se = s.heap8u()
                                  , ee = w < 512 ? w : 512
                                  , ie = s.pstack.alloc(ee);
                                do {
                                    let le = w > ee ? ee : w;
                                    H(le, ie),
                                    _.set(x(se, ie, ie + le), j),
                                    w -= le,
                                    j += le
                                } while (w > 0)
                            } catch (w) {
                                console.error("Highly unexpected (and ignored!) exception in sqlite3_randomness():", w)
                            } finally {
                                s.pstack.restore(c)
                            }
                            return _
                        }
                        s.exports.sqlite3_randomness(...l)
                    }
                    ;
                    let D;
                    if (n.sqlite3_wasmfs_opfs_dir = function() {
                        if (D !== void 0)
                            return D;
                        let l = i.wasmfsOpfsDir;
                        if (!l || !globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle)
                            return D = "";
                        try {
                            return l && s.xCallWrapped("sqlite3_wasm_init_wasmfs", "i32", ["string"], l) === 0 ? D = l : D = ""
                        } catch {
                            return D = ""
                        }
                    }
                    ,
                    n.sqlite3_wasmfs_filename_is_persistent = function(l) {
                        let _ = n.sqlite3_wasmfs_opfs_dir();
                        return _ && l ? l.startsWith(_ + "/") : !1
                    }
                    ,
                    n.sqlite3_js_db_uses_vfs = function(l, _, c=0) {
                        try {
                            let w = n.sqlite3_vfs_find(_);
                            return w ? l ? w === n.sqlite3_js_db_vfs(l, c) ? w : !1 : w === n.sqlite3_vfs_find(0) ? w : !1 : !1
                        } catch {
                            return !1
                        }
                    }
                    ,
                    n.sqlite3_js_vfs_list = function() {
                        let l = []
                          , _ = n.sqlite3_vfs_find(0);
                        for (; _; ) {
                            let c = new n.sqlite3_vfs(_);
                            l.push(s.cstrToJs(c.$zName)),
                            _ = c.$pNext,
                            c.dispose()
                        }
                        return l
                    }
                    ,
                    n.sqlite3_js_db_export = function(l, _=0) {
                        l = s.xWrap.testConvertArg("sqlite3*", l),
                        l || B("Invalid sqlite3* argument."),
                        s.bigIntEnabled || B("BigInt64 support is not enabled.");
                        let c = s.scopedAllocPush(), w;
                        try {
                            let j = s.scopedAlloc(8 + s.ptrSizeof)
                              , H = j + 8
                              , se = _ ? s.isPtr(_) ? _ : s.scopedAllocCString("" + _) : 0
                              , ee = s.exports.sqlite3_wasm_db_serialize(l, se, H, j, 0);
                            ee && B("Database serialization failed with code", h.capi.sqlite3_js_rc_str(ee)),
                            w = s.peekPtr(H);
                            let ie = s.peek(j, "i64");
                            return ee = ie ? s.heap8u().slice(w, w + Number(ie)) : new Uint8Array,
                            ee
                        } finally {
                            w && s.exports.sqlite3_free(w),
                            s.scopedAllocPop(c)
                        }
                    }
                    ,
                    n.sqlite3_js_db_vfs = (l,_=0)=>s.sqlite3_wasm_db_vfs(l, _),
                    n.sqlite3_js_aggregate_context = (l,_)=>n.sqlite3_aggregate_context(l, _) || (_ ? q.toss("Cannot allocate", _, "bytes for sqlite3_aggregate_context()") : 0),
                    n.sqlite3_js_posix_create_file = function(l, _, c) {
                        let w;
                        _ && s.isPtr(_) ? w = _ : _ instanceof ArrayBuffer || _ instanceof Uint8Array ? (w = s.allocFromTypedArray(_),
                        (arguments.length < 3 || !F.isInt32(c) || c < 0) && (c = _.byteLength)) : O.toss("Invalid 2nd argument for sqlite3_js_posix_create_file().");
                        try {
                            (!F.isInt32(c) || c < 0) && O.toss("Invalid 3rd argument for sqlite3_js_posix_create_file().");
                            let j = s.sqlite3_wasm_posix_create_file(l, w, c);
                            j && O.toss("Creation of file failed with sqlite3 result code", n.sqlite3_js_rc_str(j))
                        } finally {
                            s.dealloc(w)
                        }
                    }
                    ,
                    n.sqlite3_js_vfs_create_file = function(l, _, c, w) {
                        i.warn("sqlite3_js_vfs_create_file() is deprecated and", "should be avoided because it can lead to C-level crashes.", "See its documentation for alternative options.");
                        let j;
                        c ? (s.isPtr(c) ? j = c : c instanceof ArrayBuffer && (c = new Uint8Array(c)),
                        c instanceof Uint8Array ? (j = s.allocFromTypedArray(c),
                        (arguments.length < 4 || !F.isInt32(w) || w < 0) && (w = c.byteLength)) : O.toss("Invalid 3rd argument type for sqlite3_js_vfs_create_file().")) : j = 0,
                        (!F.isInt32(w) || w < 0) && (s.dealloc(j),
                        O.toss("Invalid 4th argument for sqlite3_js_vfs_create_file()."));
                        try {
                            let H = s.sqlite3_wasm_vfs_create_file(l, _, j, w);
                            H && O.toss("Creation of file failed with sqlite3 result code", n.sqlite3_js_rc_str(H))
                        } finally {
                            s.dealloc(j)
                        }
                    }
                    ,
                    n.sqlite3_js_sql_to_string = l=>{
                        if (typeof l == "string")
                            return l;
                        let _ = u(v);
                        return _ === v ? void 0 : _
                    }
                    ,
                    F.isUIThread()) {
                        let l = function(_) {
                            let c = Object.create(null);
                            return c.prefix = "kvvfs-" + _,
                            c.stores = [],
                            (_ === "session" || _ === "") && c.stores.push(globalThis.sessionStorage),
                            (_ === "local" || _ === "") && c.stores.push(globalThis.localStorage),
                            c
                        };
                        n.sqlite3_js_kvvfs_clear = function(_="") {
                            let c = 0
                              , w = l(_);
                            return w.stores.forEach(j=>{
                                let H = [], se;
                                for (se = 0; se < j.length; ++se) {
                                    let ee = j.key(se);
                                    ee.startsWith(w.prefix) && H.push(ee)
                                }
                                H.forEach(ee=>j.removeItem(ee)),
                                c += H.length
                            }
                            ),
                            c
                        }
                        ,
                        n.sqlite3_js_kvvfs_size = function(_="") {
                            let c = 0
                              , w = l(_);
                            return w.stores.forEach(j=>{
                                let H;
                                for (H = 0; H < j.length; ++H) {
                                    let se = j.key(H);
                                    se.startsWith(w.prefix) && (c += se.length,
                                    c += j.getItem(se).length)
                                }
                            }
                            ),
                            c * 2
                        }
                    }
                    n.sqlite3_db_config = function(l, _, ...c) {
                        switch (this.s || (this.s = s.xWrap("sqlite3_wasm_db_config_s", "int", ["sqlite3*", "int", "string:static"]),
                        this.pii = s.xWrap("sqlite3_wasm_db_config_pii", "int", ["sqlite3*", "int", "*", "int", "int"]),
                        this.ip = s.xWrap("sqlite3_wasm_db_config_ip", "int", ["sqlite3*", "int", "int", "*"])),
                        _) {
                        case n.SQLITE_DBCONFIG_ENABLE_FKEY:
                        case n.SQLITE_DBCONFIG_ENABLE_TRIGGER:
                        case n.SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER:
                        case n.SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION:
                        case n.SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE:
                        case n.SQLITE_DBCONFIG_ENABLE_QPSG:
                        case n.SQLITE_DBCONFIG_TRIGGER_EQP:
                        case n.SQLITE_DBCONFIG_RESET_DATABASE:
                        case n.SQLITE_DBCONFIG_DEFENSIVE:
                        case n.SQLITE_DBCONFIG_WRITABLE_SCHEMA:
                        case n.SQLITE_DBCONFIG_LEGACY_ALTER_TABLE:
                        case n.SQLITE_DBCONFIG_DQS_DML:
                        case n.SQLITE_DBCONFIG_DQS_DDL:
                        case n.SQLITE_DBCONFIG_ENABLE_VIEW:
                        case n.SQLITE_DBCONFIG_LEGACY_FILE_FORMAT:
                        case n.SQLITE_DBCONFIG_TRUSTED_SCHEMA:
                        case n.SQLITE_DBCONFIG_STMT_SCANSTATUS:
                        case n.SQLITE_DBCONFIG_REVERSE_SCANORDER:
                            return this.ip(l, _, c[0], c[1] || 0);
                        case n.SQLITE_DBCONFIG_LOOKASIDE:
                            return this.pii(l, _, c[0], c[1], c[2]);
                        case n.SQLITE_DBCONFIG_MAINDBNAME:
                            return this.s(l, _, c[0]);
                        default:
                            return n.SQLITE_MISUSE
                        }
                    }
                    .bind(Object.create(null)),
                    n.sqlite3_value_to_js = function(l, _=!0) {
                        let c, w = n.sqlite3_value_type(l);
                        switch (w) {
                        case n.SQLITE_INTEGER:
                            s.bigIntEnabled ? (c = n.sqlite3_value_int64(l),
                            F.bigIntFitsDouble(c) && (c = Number(c))) : c = n.sqlite3_value_double(l);
                            break;
                        case n.SQLITE_FLOAT:
                            c = n.sqlite3_value_double(l);
                            break;
                        case n.SQLITE_TEXT:
                            c = n.sqlite3_value_text(l);
                            break;
                        case n.SQLITE_BLOB:
                            {
                                let j = n.sqlite3_value_bytes(l)
                                  , H = n.sqlite3_value_blob(l);
                                j && !H && h.WasmAllocError.toss("Cannot allocate memory for blob argument of", j, "byte(s)"),
                                c = j ? s.heap8u().slice(H, H + Number(j)) : null;
                                break
                            }
                        case n.SQLITE_NULL:
                            c = null;
                            break;
                        default:
                            _ && B(n.SQLITE_MISMATCH, "Unhandled sqlite3_value_type():", w),
                            c = void 0
                        }
                        return c
                    }
                    ,
                    n.sqlite3_values_to_js = function(l, _, c=!0) {
                        let w, j = [];
                        for (w = 0; w < l; ++w)
                            j.push(n.sqlite3_value_to_js(s.peekPtr(_ + s.ptrSizeof * w), c));
                        return j
                    }
                    ,
                    n.sqlite3_result_error_js = function(l, _) {
                        _ instanceof q ? n.sqlite3_result_error_nomem(l) : n.sqlite3_result_error(l, "" + _, -1)
                    }
                    ,
                    n.sqlite3_result_js = function(l, _) {
                        if (_ instanceof Error) {
                            n.sqlite3_result_error_js(l, _);
                            return
                        }
                        try {
                            switch (typeof _) {
                            case "undefined":
                                break;
                            case "boolean":
                                n.sqlite3_result_int(l, _ ? 1 : 0);
                                break;
                            case "bigint":
                                F.bigIntFits32(_) ? n.sqlite3_result_int(l, Number(_)) : F.bigIntFitsDouble(_) ? n.sqlite3_result_double(l, Number(_)) : s.bigIntEnabled ? F.bigIntFits64(_) ? n.sqlite3_result_int64(l, _) : B("BigInt value", _.toString(), "is too BigInt for int64.") : B("BigInt value", _.toString(), "is too BigInt.");
                                break;
                            case "number":
                                {
                                    let c;
                                    F.isInt32(_) ? c = n.sqlite3_result_int : s.bigIntEnabled && Number.isInteger(_) && F.bigIntFits64(BigInt(_)) ? c = n.sqlite3_result_int64 : c = n.sqlite3_result_double,
                                    c(l, _);
                                    break
                                }
                            case "string":
                                {
                                    let[c,w] = s.allocCString(_, !0);
                                    n.sqlite3_result_text(l, c, w, n.SQLITE_WASM_DEALLOC);
                                    break
                                }
                            case "object":
                                if (_ === null) {
                                    n.sqlite3_result_null(l);
                                    break
                                } else if (F.isBindableTypedArray(_)) {
                                    let c = s.allocFromTypedArray(_);
                                    n.sqlite3_result_blob(l, c, _.byteLength, n.SQLITE_WASM_DEALLOC);
                                    break
                                }
                            default:
                                B("Don't not how to handle this UDF result value:", typeof _, _)
                            }
                        } catch (c) {
                            n.sqlite3_result_error_js(l, c)
                        }
                    }
                    ,
                    n.sqlite3_column_js = function(l, _, c=!0) {
                        let w = n.sqlite3_column_value(l, _);
                        return w === 0 ? void 0 : n.sqlite3_value_to_js(w, c)
                    }
                    ;
                    let P = function(l, _, c) {
                        c = n[c],
                        this.ptr ? s.pokePtr(this.ptr, 0) : this.ptr = s.allocPtr();
                        let w = c(l, _, this.ptr);
                        if (w)
                            return O.toss(w, arguments[2] + "() failed with code " + w);
                        let j = s.peekPtr(this.ptr);
                        return j ? n.sqlite3_value_to_js(j, !0) : void 0
                    }
                    .bind(Object.create(null));
                    n.sqlite3_preupdate_new_js = (l,_)=>P(l, _, "sqlite3_preupdate_new"),
                    n.sqlite3_preupdate_old_js = (l,_)=>P(l, _, "sqlite3_preupdate_old"),
                    n.sqlite3changeset_new_js = (l,_)=>P(l, _, "sqlite3changeset_new"),
                    n.sqlite3changeset_old_js = (l,_)=>P(l, _, "sqlite3changeset_old");
                    let h = {
                        WasmAllocError: q,
                        SQLite3Error: O,
                        capi: n,
                        util: F,
                        wasm: s,
                        config: i,
                        version: Object.create(null),
                        client: void 0,
                        asyncPostInit: async function l() {
                            if (l.isReady instanceof Promise)
                                return l.isReady;
                            let _ = t.initializersAsync;
                            delete t.initializersAsync;
                            let c = async()=>(h.__isUnderTest || (delete h.util,
                            delete h.StructBinder),
                            h)
                              , w = H=>{
                                throw i.error("an async sqlite3 initializer failed:", H),
                                H
                            }
                            ;
                            if (!_ || !_.length)
                                return l.isReady = c().catch(w);
                            _ = _.map(H=>H instanceof Function ? async se=>H(h) : H),
                            _.push(c);
                            let j = Promise.resolve(h);
                            for (; _.length; )
                                j = j.then(_.shift());
                            return l.isReady = j.catch(w)
                        },
                        scriptInfo: void 0
                    };
                    try {
                        t.initializers.forEach(l=>{
                            l(h)
                        }
                        )
                    } catch (l) {
                        throw console.error("sqlite3 bootstrap initializer threw:", l),
                        l
                    }
                    return delete t.initializers,
                    t.sqlite3 = h,
                    h
                }
                ,
                globalThis.sqlite3ApiBootstrap.initializers = [],
                globalThis.sqlite3ApiBootstrap.initializersAsync = [],
                globalThis.sqlite3ApiBootstrap.defaultConfig = Object.create(null),
                globalThis.sqlite3ApiBootstrap.sqlite3 = void 0,
                globalThis.WhWasmUtilInstaller = function(t) {
                    "use strict";
                    t.bigIntEnabled === void 0 && (t.bigIntEnabled = !!globalThis.BigInt64Array);
                    let r = (...u)=>{
                        throw new Error(u.join(" "))
                    }
                    ;
                    t.exports || Object.defineProperty(t, "exports", {
                        enumerable: !0,
                        configurable: !0,
                        get: ()=>t.instance && t.instance.exports
                    });
                    let i = t.pointerIR || "i32"
                      , n = t.ptrSizeof = i === "i32" ? 4 : i === "i64" ? 8 : r("Unhandled ptrSizeof:", i)
                      , s = Object.create(null);
                    s.heapSize = 0,
                    s.memory = null,
                    s.freeFuncIndexes = [],
                    s.scopedAlloc = [],
                    s.utf8Decoder = new TextDecoder,
                    s.utf8Encoder = new TextEncoder("utf-8"),
                    t.sizeofIR = u=>{
                        switch (u) {
                        case "i8":
                            return 1;
                        case "i16":
                            return 2;
                        case "i32":
                        case "f32":
                        case "float":
                            return 4;
                        case "i64":
                        case "f64":
                        case "double":
                            return 8;
                        case "*":
                            return n;
                        default:
                            return ("" + u).endsWith("*") ? n : void 0
                        }
                    }
                    ;
                    let p = function() {
                        if (!s.memory)
                            s.memory = t.memory instanceof WebAssembly.Memory ? t.memory : t.exports.memory;
                        else if (s.heapSize === s.memory.buffer.byteLength)
                            return s;
                        let u = s.memory.buffer;
                        return s.HEAP8 = new Int8Array(u),
                        s.HEAP8U = new Uint8Array(u),
                        s.HEAP16 = new Int16Array(u),
                        s.HEAP16U = new Uint16Array(u),
                        s.HEAP32 = new Int32Array(u),
                        s.HEAP32U = new Uint32Array(u),
                        t.bigIntEnabled && (s.HEAP64 = new BigInt64Array(u),
                        s.HEAP64U = new BigUint64Array(u)),
                        s.HEAP32F = new Float32Array(u),
                        s.HEAP64F = new Float64Array(u),
                        s.heapSize = u.byteLength,
                        s
                    };
                    t.heap8 = ()=>p().HEAP8,
                    t.heap8u = ()=>p().HEAP8U,
                    t.heap16 = ()=>p().HEAP16,
                    t.heap16u = ()=>p().HEAP16U,
                    t.heap32 = ()=>p().HEAP32,
                    t.heap32u = ()=>p().HEAP32U,
                    t.heapForSize = function(u, q=!0) {
                        let F, D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p();
                        switch (u) {
                        case Int8Array:
                            return D.HEAP8;
                        case Uint8Array:
                            return D.HEAP8U;
                        case Int16Array:
                            return D.HEAP16;
                        case Uint16Array:
                            return D.HEAP16U;
                        case Int32Array:
                            return D.HEAP32;
                        case Uint32Array:
                            return D.HEAP32U;
                        case 8:
                            return q ? D.HEAP8U : D.HEAP8;
                        case 16:
                            return q ? D.HEAP16U : D.HEAP16;
                        case 32:
                            return q ? D.HEAP32U : D.HEAP32;
                        case 64:
                            if (D.HEAP64)
                                return q ? D.HEAP64U : D.HEAP64;
                            break;
                        default:
                            if (t.bigIntEnabled) {
                                if (u === globalThis.BigUint64Array)
                                    return D.HEAP64U;
                                if (u === globalThis.BigInt64Array)
                                    return D.HEAP64;
                                break
                            }
                        }
                        r("Invalid heapForSize() size: expecting 8, 16, 32,", "or (if BigInt is enabled) 64.")
                    }
                    ,
                    t.functionTable = function() {
                        return t.exports.__indirect_function_table
                    }
                    ,
                    t.functionEntry = function(u) {
                        let q = t.functionTable();
                        return u < q.length ? q.get(u) : void 0
                    }
                    ,
                    t.jsFuncToWasm = function u(q, F) {
                        if (u._ || (u._ = {
                            sigTypes: Object.assign(Object.create(null), {
                                i: "i32",
                                p: "i32",
                                P: "i32",
                                s: "i32",
                                j: "i64",
                                f: "f32",
                                d: "f64"
                            }),
                            typeCodes: Object.assign(Object.create(null), {
                                f64: 124,
                                f32: 125,
                                i64: 126,
                                i32: 127
                            }),
                            uleb128Encode: function(h, l, _) {
                                _ < 128 ? h[l](_) : h[l](_ % 128 | 128, _ >> 7)
                            },
                            rxJSig: /^(\w)\((\w*)\)$/,
                            sigParams: function(h) {
                                let l = u._.rxJSig.exec(h);
                                return l ? l[2] : h.substr(1)
                            },
                            letterType: h=>u._.sigTypes[h] || r("Invalid signature letter:", h),
                            pushSigType: (h,l)=>h.push(u._.typeCodes[u._.letterType(l)])
                        }),
                        typeof q == "string") {
                            let h = F;
                            F = q,
                            q = h
                        }
                        let D = u._.sigParams(F)
                          , P = [1, 96];
                        u._.uleb128Encode(P, "push", D.length);
                        for (let h of D)
                            u._.pushSigType(P, h);
                        return F[0] === "v" ? P.push(0) : (P.push(1),
                        u._.pushSigType(P, F[0])),
                        u._.uleb128Encode(P, "unshift", P.length),
                        P.unshift(0, 97, 115, 109, 1, 0, 0, 0, 1),
                        P.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0),
                        new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(P)),{
                            e: {
                                f: q
                            }
                        }).exports.f
                    }
                    ;
                    let y = function(q, F, D) {
                        if (D && !s.scopedAlloc.length && r("No scopedAllocPush() scope is active."),
                        typeof q == "string") {
                            let _ = F;
                            F = q,
                            q = _
                        }
                        (typeof F != "string" || !(q instanceof Function)) && r("Invalid arguments: expecting (function,signature) or (signature,function).");
                        let P = t.functionTable(), h = P.length, l;
                        for (; s.freeFuncIndexes.length && (l = s.freeFuncIndexes.pop(),
                        P.get(l)); ) {
                            l = null;
                            continue
                        }
                        l || (l = h,
                        P.grow(1));
                        try {
                            return P.set(l, q),
                            D && s.scopedAlloc[s.scopedAlloc.length - 1].push(l),
                            l
                        } catch (_) {
                            if (!(_ instanceof TypeError))
                                throw l === h && s.freeFuncIndexes.push(h),
                                _
                        }
                        try {
                            let _ = t.jsFuncToWasm(q, F);
                            P.set(l, _),
                            D && s.scopedAlloc[s.scopedAlloc.length - 1].push(l)
                        } catch (_) {
                            throw l === h && s.freeFuncIndexes.push(h),
                            _
                        }
                        return l
                    };
                    t.installFunction = (u,q)=>y(u, q, !1),
                    t.scopedInstallFunction = (u,q)=>y(u, q, !0),
                    t.uninstallFunction = function(u) {
                        if (!u && u !== 0)
                            return;
                        let q = s.freeFuncIndexes
                          , F = t.functionTable();
                        q.push(u);
                        let D = F.get(u);
                        return F.set(u, null),
                        D
                    }
                    ,
                    t.peek = function(q, F="i8") {
                        F.endsWith("*") && (F = i);
                        let D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p(), P = Array.isArray(q) ? [] : void 0, h;
                        do {
                            switch (P && (q = arguments[0].shift()),
                            F) {
                            case "i1":
                            case "i8":
                                h = D.HEAP8[q >> 0];
                                break;
                            case "i16":
                                h = D.HEAP16[q >> 1];
                                break;
                            case "i32":
                                h = D.HEAP32[q >> 2];
                                break;
                            case "float":
                            case "f32":
                                h = D.HEAP32F[q >> 2];
                                break;
                            case "double":
                            case "f64":
                                h = Number(D.HEAP64F[q >> 3]);
                                break;
                            case "i64":
                                if (t.bigIntEnabled) {
                                    h = BigInt(D.HEAP64[q >> 3]);
                                    break
                                }
                            default:
                                r("Invalid type for peek():", F)
                            }
                            P && P.push(h)
                        } while (P && arguments[0].length);
                        return P || h
                    }
                    ,
                    t.poke = function(u, q, F="i8") {
                        F.endsWith("*") && (F = i);
                        let D = s.memory && s.heapSize === s.memory.buffer.byteLength ? s : p();
                        for (let P of Array.isArray(u) ? u : [u])
                            switch (F) {
                            case "i1":
                            case "i8":
                                D.HEAP8[P >> 0] = q;
                                continue;
                            case "i16":
                                D.HEAP16[P >> 1] = q;
                                continue;
                            case "i32":
                                D.HEAP32[P >> 2] = q;
                                continue;
                            case "float":
                            case "f32":
                                D.HEAP32F[P >> 2] = q;
                                continue;
                            case "double":
                            case "f64":
                                D.HEAP64F[P >> 3] = q;
                                continue;
                            case "i64":
                                if (D.HEAP64) {
                                    D.HEAP64[P >> 3] = BigInt(q);
                                    continue
                                }
                            default:
                                r("Invalid type for poke(): " + F)
                            }
                        return this
                    }
                    ,
                    t.peekPtr = (...u)=>t.peek(u.length === 1 ? u[0] : u, i),
                    t.pokePtr = (u,q=0)=>t.poke(u, q, i),
                    t.peek8 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i8"),
                    t.poke8 = (u,q)=>t.poke(u, q, "i8"),
                    t.peek16 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i16"),
                    t.poke16 = (u,q)=>t.poke(u, q, "i16"),
                    t.peek32 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i32"),
                    t.poke32 = (u,q)=>t.poke(u, q, "i32"),
                    t.peek64 = (...u)=>t.peek(u.length === 1 ? u[0] : u, "i64"),
                    t.poke64 = (u,q)=>t.poke(u, q, "i64"),
                    t.peek32f = (...u)=>t.peek(u.length === 1 ? u[0] : u, "f32"),
                    t.poke32f = (u,q)=>t.poke(u, q, "f32"),
                    t.peek64f = (...u)=>t.peek(u.length === 1 ? u[0] : u, "f64"),
                    t.poke64f = (u,q)=>t.poke(u, q, "f64"),
                    t.getMemValue = t.peek,
                    t.getPtrValue = t.peekPtr,
                    t.setMemValue = t.poke,
                    t.setPtrValue = t.pokePtr,
                    t.isPtr32 = u=>typeof u == "number" && u === (u | 0) && u >= 0,
                    t.isPtr = t.isPtr32,
                    t.cstrlen = function(u) {
                        if (!u || !t.isPtr(u))
                            return null;
                        let q = p().HEAP8U
                          , F = u;
                        for (; q[F] !== 0; ++F)
                            ;
                        return F - u
                    }
                    ;
                    let O = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , B = function(u, q, F) {
                        return s.utf8Decoder.decode(u.buffer instanceof O ? u.slice(q, F) : u.subarray(q, F))
                    };
                    t.cstrToJs = function(u) {
                        let q = t.cstrlen(u);
                        return q ? B(p().HEAP8U, u, u + q) : q === null ? q : ""
                    }
                    ,
                    t.jstrlen = function(u) {
                        if (typeof u != "string")
                            return null;
                        let q = u.length
                          , F = 0;
                        for (let D = 0; D < q; ++D) {
                            let P = u.charCodeAt(D);
                            P >= 55296 && P <= 57343 && (P = 65536 + ((P & 1023) << 10) | u.charCodeAt(++D) & 1023),
                            P <= 127 ? ++F : P <= 2047 ? F += 2 : P <= 65535 ? F += 3 : F += 4
                        }
                        return F
                    }
                    ,
                    t.jstrcpy = function(u, q, F=0, D=-1, P=!0) {
                        if ((!q || !(q instanceof Int8Array) && !(q instanceof Uint8Array)) && r("jstrcpy() target must be an Int8Array or Uint8Array."),
                        D < 0 && (D = q.length - F),
                        !(D > 0) || !(F >= 0))
                            return 0;
                        let h = 0
                          , l = u.length
                          , _ = F
                          , c = F + D - (P ? 1 : 0);
                        for (; h < l && F < c; ++h) {
                            let w = u.charCodeAt(h);
                            if (w >= 55296 && w <= 57343 && (w = 65536 + ((w & 1023) << 10) | u.charCodeAt(++h) & 1023),
                            w <= 127) {
                                if (F >= c)
                                    break;
                                q[F++] = w
                            } else if (w <= 2047) {
                                if (F + 1 >= c)
                                    break;
                                q[F++] = 192 | w >> 6,
                                q[F++] = 128 | w & 63
                            } else if (w <= 65535) {
                                if (F + 2 >= c)
                                    break;
                                q[F++] = 224 | w >> 12,
                                q[F++] = 128 | w >> 6 & 63,
                                q[F++] = 128 | w & 63
                            } else {
                                if (F + 3 >= c)
                                    break;
                                q[F++] = 240 | w >> 18,
                                q[F++] = 128 | w >> 12 & 63,
                                q[F++] = 128 | w >> 6 & 63,
                                q[F++] = 128 | w & 63
                            }
                        }
                        return P && (q[F++] = 0),
                        F - _
                    }
                    ,
                    t.cstrncpy = function(u, q, F) {
                        if ((!u || !q) && r("cstrncpy() does not accept NULL strings."),
                        F < 0)
                            F = t.cstrlen(strPtr) + 1;
                        else if (!(F > 0))
                            return 0;
                        let D = t.heap8u(), P = 0, h;
                        for (; P < F && (h = D[q + P]); ++P)
                            D[u + P] = h;
                        return P < F && (D[u + P++] = 0),
                        P
                    }
                    ,
                    t.jstrToUintArray = (u,q=!1)=>s.utf8Encoder.encode(q ? u + "\0" : u);
                    let G = (u,q)=>{
                        (!(u.alloc instanceof Function) || !(u.dealloc instanceof Function)) && r("Object is missing alloc() and/or dealloc() function(s)", "required by", q + "().")
                    }
                      , J = function(u, q, F, D) {
                        if (G(t, D),
                        typeof u != "string")
                            return null;
                        {
                            let P = s.utf8Encoder.encode(u)
                              , h = F(P.length + 1)
                              , l = p().HEAP8U;
                            return l.set(P, h),
                            l[h + P.length] = 0,
                            q ? [h, P.length] : h
                        }
                    };
                    t.allocCString = (u,q=!1)=>J(u, q, t.alloc, "allocCString()"),
                    t.scopedAllocPush = function() {
                        G(t, "scopedAllocPush");
                        let u = [];
                        return s.scopedAlloc.push(u),
                        u
                    }
                    ,
                    t.scopedAllocPop = function(u) {
                        G(t, "scopedAllocPop");
                        let q = arguments.length ? s.scopedAlloc.indexOf(u) : s.scopedAlloc.length - 1;
                        q < 0 && r("Invalid state object for scopedAllocPop()."),
                        arguments.length === 0 && (u = s.scopedAlloc[q]),
                        s.scopedAlloc.splice(q, 1);
                        for (let F; F = u.pop(); )
                            t.functionEntry(F) ? t.uninstallFunction(F) : t.dealloc(F)
                    }
                    ,
                    t.scopedAlloc = function(u) {
                        s.scopedAlloc.length || r("No scopedAllocPush() scope is active.");
                        let q = t.alloc(u);
                        return s.scopedAlloc[s.scopedAlloc.length - 1].push(q),
                        q
                    }
                    ,
                    Object.defineProperty(t.scopedAlloc, "level", {
                        configurable: !1,
                        enumerable: !1,
                        get: ()=>s.scopedAlloc.length,
                        set: ()=>r("The 'active' property is read-only.")
                    }),
                    t.scopedAllocCString = (u,q=!1)=>J(u, q, t.scopedAlloc, "scopedAllocCString()");
                    let Y = function(u, q) {
                        let F = t[u ? "scopedAlloc" : "alloc"]((q.length + 1) * t.ptrSizeof)
                          , D = 0;
                        return q.forEach(P=>{
                            t.pokePtr(F + t.ptrSizeof * D++, t[u ? "scopedAllocCString" : "allocCString"]("" + P))
                        }
                        ),
                        t.pokePtr(F + t.ptrSizeof * D, 0),
                        F
                    };
                    t.scopedAllocMainArgv = u=>Y(!0, u),
                    t.allocMainArgv = u=>Y(!1, u),
                    t.cArgvToJs = (u,q)=>{
                        let F = [];
                        for (let D = 0; D < u; ++D) {
                            let P = t.peekPtr(q + t.ptrSizeof * D);
                            F.push(P ? t.cstrToJs(P) : null)
                        }
                        return F
                    }
                    ,
                    t.scopedAllocCall = function(u) {
                        t.scopedAllocPush();
                        try {
                            return u()
                        } finally {
                            t.scopedAllocPop()
                        }
                    }
                    ;
                    let d = function(u, q, F) {
                        G(t, F);
                        let D = q ? "i64" : i
                          , P = t[F](u * (q ? 8 : n));
                        if (t.poke(P, 0, D),
                        u === 1)
                            return P;
                        let h = [P];
                        for (let l = 1; l < u; ++l)
                            P += q ? 8 : n,
                            h[l] = P,
                            t.poke(P, 0, D);
                        return h
                    };
                    t.allocPtr = (u=1,q=!0)=>d(u, q, "alloc"),
                    t.scopedAllocPtr = (u=1,q=!0)=>d(u, q, "scopedAlloc"),
                    t.xGet = function(u) {
                        return t.exports[u] || r("Cannot find exported symbol:", u)
                    }
                    ;
                    let f = (u,q)=>r(u + "() requires", q, "argument(s).");
                    t.xCall = function(u, ...q) {
                        let F = t.xGet(u);
                        return F instanceof Function || r("Exported symbol", u, "is not a function."),
                        F.length !== q.length && f(u, F.length),
                        arguments.length === 2 && Array.isArray(arguments[1]) ? F.apply(null, arguments[1]) : F.apply(null, q)
                    }
                    ,
                    s.xWrap = Object.create(null),
                    s.xWrap.convert = Object.create(null),
                    s.xWrap.convert.arg = new Map,
                    s.xWrap.convert.result = new Map;
                    let m = s.xWrap.convert.arg
                      , I = s.xWrap.convert.result;
                    t.bigIntEnabled && m.set("i64", u=>BigInt(u));
                    let x = i === "i32" ? u=>u | 0 : u=>BigInt(u) | BigInt(0);
                    m.set("i32", x).set("i16", u=>(u | 0) & 65535).set("i8", u=>(u | 0) & 255).set("f32", u=>Number(u).valueOf()).set("float", m.get("f32")).set("f64", m.get("f32")).set("double", m.get("f64")).set("int", m.get("i32")).set("null", u=>u).set(null, m.get("null")).set("**", x).set("*", x),
                    I.set("*", x).set("pointer", x).set("number", u=>Number(u)).set("void", u=>{}
                    ).set("null", u=>u).set(null, I.get("null"));
                    {
                        let u = ["i8", "i16", "i32", "int", "f32", "float", "f64", "double"];
                        t.bigIntEnabled && u.push("i64");
                        let q = m.get(i);
                        for (let F of u)
                            m.set(F + "*", q),
                            I.set(F + "*", q),
                            I.set(F, m.get(F) || r("Missing arg converter:", F))
                    }
                    let S = function(u) {
                        return typeof u == "string" ? t.scopedAllocCString(u) : u ? x(u) : null
                    };
                    m.set("string", S).set("utf8", S).set("pointer", S),
                    I.set("string", u=>t.cstrToJs(u)).set("utf8", I.get("string")).set("string:dealloc", u=>{
                        try {
                            return u ? t.cstrToJs(u) : null
                        } finally {
                            t.dealloc(u)
                        }
                    }
                    ).set("utf8:dealloc", I.get("string:dealloc")).set("json", u=>JSON.parse(t.cstrToJs(u))).set("json:dealloc", u=>{
                        try {
                            return u ? JSON.parse(t.cstrToJs(u)) : null
                        } finally {
                            t.dealloc(u)
                        }
                    }
                    );
                    let R = class {
                        constructor(u) {
                            this.name = u.name || "unnamed adapter"
                        }
                        convertArg(u, q, F) {
                            r("AbstractArgAdapter must be subclassed.")
                        }
                    }
                    ;
                    m.FuncPtrAdapter = class Pe extends R {
                        constructor(q) {
                            super(q),
                            m.FuncPtrAdapter.warnOnUse && console.warn("xArg.FuncPtrAdapter is an internal-only API", "and is not intended to be invoked from", "client-level code. Invoked with:", q),
                            this.name = q.name || "unnamed",
                            this.signature = q.signature,
                            q.contextKey instanceof Function && (this.contextKey = q.contextKey,
                            q.bindScope || (q.bindScope = "context")),
                            this.bindScope = q.bindScope || r("FuncPtrAdapter options requires a bindScope (explicit or implied)."),
                            Pe.bindScopes.indexOf(q.bindScope) < 0 && r("Invalid options.bindScope (" + q.bindMod + ") for FuncPtrAdapter. Expecting one of: (" + Pe.bindScopes.join(", ") + ")"),
                            this.isTransient = this.bindScope === "transient",
                            this.isContext = this.bindScope === "context",
                            this.isPermanent = this.bindScope === "permanent",
                            this.singleton = this.bindScope === "singleton" ? [] : void 0,
                            this.callProxy = q.callProxy instanceof Function ? q.callProxy : void 0
                        }
                        contextKey(q, F) {
                            return this
                        }
                        contextMap(q) {
                            let F = this.__cmap || (this.__cmap = new Map)
                              , D = F.get(q);
                            return D === void 0 && F.set(q, D = []),
                            D
                        }
                        convertArg(q, F, D) {
                            let P = this.singleton;
                            if (!P && this.isContext && (P = this.contextMap(this.contextKey(F, D))),
                            P && P[0] === q)
                                return P[1];
                            if (q instanceof Function) {
                                this.callProxy && (q = this.callProxy(q));
                                let h = y(q, this.signature, this.isTransient);
                                if (Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter installed", this, this.contextKey(F, D), "@" + h, q),
                                P) {
                                    if (P[1]) {
                                        Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter uninstalling", this, this.contextKey(F, D), "@" + P[1], q);
                                        try {
                                            s.scopedAlloc[s.scopedAlloc.length - 1].push(P[1])
                                        } catch {}
                                    }
                                    P[0] = q,
                                    P[1] = h
                                }
                                return h
                            } else if (t.isPtr(q) || q === null || q === void 0) {
                                if (P && P[1] && P[1] !== q) {
                                    Pe.debugFuncInstall && Pe.debugOut("FuncPtrAdapter uninstalling", this, this.contextKey(F, D), "@" + P[1], q);
                                    try {
                                        s.scopedAlloc[s.scopedAlloc.length - 1].push(P[1])
                                    } catch {}
                                    P[0] = P[1] = q | 0
                                }
                                return q || 0
                            } else
                                throw new TypeError("Invalid FuncPtrAdapter argument type. Expecting a function pointer or a " + (this.name ? this.name + " " : "") + "function matching signature " + this.signature + ".")
                        }
                    }
                    ,
                    m.FuncPtrAdapter.warnOnUse = !1,
                    m.FuncPtrAdapter.debugFuncInstall = !1,
                    m.FuncPtrAdapter.debugOut = console.debug.bind(console),
                    m.FuncPtrAdapter.bindScopes = ["transient", "context", "singleton", "permanent"];
                    let z = u=>m.get(u) || r("Argument adapter not found:", u)
                      , L = u=>I.get(u) || r("Result adapter not found:", u);
                    s.xWrap.convertArg = (u,...q)=>z(u)(...q),
                    s.xWrap.convertArgNoCheck = (u,...q)=>m.get(u)(...q),
                    s.xWrap.convertResult = (u,q)=>u === null ? q : u ? L(u)(q) : void 0,
                    s.xWrap.convertResultNoCheck = (u,q)=>u === null ? q : u ? I.get(u)(q) : void 0,
                    t.xWrap = function(u, q, ...F) {
                        arguments.length === 3 && Array.isArray(arguments[2]) && (F = arguments[2]),
                        t.isPtr(u) && (u = t.functionEntry(u) || r("Function pointer not found in WASM function table."));
                        let D = u instanceof Function
                          , P = D ? u : t.xGet(u);
                        if (D && (u = P.name || "unnamed function"),
                        F.length !== P.length && f(u, P.length),
                        q === null && P.length === 0)
                            return P;
                        q != null && L(q);
                        for (let l of F)
                            l instanceof R ? m.set(l, (..._)=>l.convertArg(..._)) : z(l);
                        let h = s.xWrap;
                        return P.length === 0 ? (...l)=>l.length ? f(u, P.length) : h.convertResult(q, P.call(null)) : function(...l) {
                            l.length !== P.length && f(u, P.length);
                            let _ = t.scopedAllocPush();
                            try {
                                for (let c in l)
                                    l[c] = h.convertArgNoCheck(F[c], l[c], l, c);
                                return h.convertResultNoCheck(q, P.apply(null, l))
                            } finally {
                                t.scopedAllocPop(_)
                            }
                        }
                    }
                    ;
                    let $ = function(u, q, F, D, P, h) {
                        if (typeof F == "string") {
                            if (q === 1)
                                return h.get(F);
                            if (q === 2) {
                                if (D)
                                    D instanceof Function || r(P, "requires a function argument.");
                                else
                                    return delete h.get(F),
                                    u;
                                return h.set(F, D),
                                u
                            }
                        }
                        r("Invalid arguments to", P)
                    };
                    return t.xWrap.resultAdapter = function u(q, F) {
                        return $(u, arguments.length, q, F, "resultAdapter()", I)
                    }
                    ,
                    t.xWrap.argAdapter = function u(q, F) {
                        return $(u, arguments.length, q, F, "argAdapter()", m)
                    }
                    ,
                    t.xWrap.FuncPtrAdapter = m.FuncPtrAdapter,
                    t.xCallWrapped = function(u, q, F, ...D) {
                        return Array.isArray(arguments[3]) && (D = arguments[3]),
                        t.xWrap(u, q, F || []).apply(null, D || [])
                    }
                    ,
                    t.xWrap.testConvertArg = s.xWrap.convertArg,
                    t.xWrap.testConvertResult = s.xWrap.convertResult,
                    t
                }
                ,
                globalThis.WhWasmUtilInstaller.yawl = function(t) {
                    let r = ()=>fetch(t.uri, {
                        credentials: "same-origin"
                    })
                      , i = this
                      , n = function(p) {
                        if (t.wasmUtilTarget) {
                            let y = (...B)=>{
                                throw new Error(B.join(" "))
                            }
                              , O = t.wasmUtilTarget;
                            if (O.module = p.module,
                            O.instance = p.instance,
                            O.instance.exports.memory || (O.memory = t.imports && t.imports.env && t.imports.env.memory || y("Missing 'memory' object!")),
                            !O.alloc && p.instance.exports.malloc) {
                                let B = p.instance.exports;
                                O.alloc = function(G) {
                                    return B.malloc(G) || y("Allocation of", G, "bytes failed.")
                                }
                                ,
                                O.dealloc = function(G) {
                                    B.free(G)
                                }
                            }
                            i(O)
                        }
                        return t.onload && t.onload(p, t),
                        p
                    };
                    return WebAssembly.instantiateStreaming ? function() {
                        return WebAssembly.instantiateStreaming(r(), t.imports || {}).then(n)
                    }
                    : function() {
                        return r().then(y=>y.arrayBuffer()).then(y=>WebAssembly.instantiate(y, t.imports || {})).then(n)
                    }
                }
                .bind(globalThis.WhWasmUtilInstaller),
                globalThis.Jaccwabyt = function t(r) {
                    let i = (...E)=>{
                        throw new Error(E.join(" "))
                    }
                    ;
                    !(r.heap instanceof WebAssembly.Memory) && !(r.heap instanceof Function) && i("config.heap must be WebAssembly.Memory instance or a function."),
                    ["alloc", "dealloc"].forEach(function(E) {
                        r[E]instanceof Function || i("Config option '" + E + "' must be a function.")
                    });
                    let n = t
                      , s = r.heap instanceof Function ? r.heap : ()=>new Uint8Array(r.heap.buffer)
                      , p = r.alloc
                      , y = r.dealloc
                      , O = r.log || console.log.bind(console)
                      , B = r.memberPrefix || ""
                      , G = r.memberSuffix || ""
                      , J = r.bigIntEnabled === void 0 ? !!globalThis.BigInt64Array : !!r.bigIntEnabled
                      , Y = globalThis.BigInt
                      , d = globalThis.BigInt64Array
                      , f = r.ptrSizeof || 4
                      , m = r.ptrIR || "i32";
                    n.debugFlags || (n.__makeDebugFlags = function(E=null) {
                        E && E.__flags && (E = E.__flags);
                        let g = function A(T) {
                            return arguments.length === 0 ? A.__flags : (T < 0 ? (delete A.__flags.getter,
                            delete A.__flags.setter,
                            delete A.__flags.alloc,
                            delete A.__flags.dealloc) : (A.__flags.getter = (1 & T) !== 0,
                            A.__flags.setter = (2 & T) !== 0,
                            A.__flags.alloc = (4 & T) !== 0,
                            A.__flags.dealloc = (8 & T) !== 0),
                            A._flags)
                        };
                        return Object.defineProperty(g, "__flags", {
                            iterable: !1,
                            writable: !1,
                            value: Object.create(E)
                        }),
                        E || g(0),
                        g
                    }
                    ,
                    n.debugFlags = n.__makeDebugFlags());
                    let I = function() {
                        let E = new ArrayBuffer(2);
                        return new DataView(E).setInt16(0, 256, !0),
                        new Int16Array(E)[0] === 256
                    }()
                      , x = E=>E[1] === "("
                      , S = E=>E === "p" || E === "P"
                      , R = E=>E === "P"
                      , z = E=>x(E) ? "p" : E[0]
                      , L = function(E) {
                        switch (z(E)) {
                        case "c":
                        case "C":
                            return "i8";
                        case "i":
                            return "i32";
                        case "p":
                        case "P":
                        case "s":
                            return m;
                        case "j":
                            return "i64";
                        case "f":
                            return "float";
                        case "d":
                            return "double"
                        }
                        i("Unhandled signature IR:", E)
                    }
                      , $ = d ? ()=>!0 : ()=>i("BigInt64Array is not available.")
                      , u = function(E) {
                        switch (z(E)) {
                        case "p":
                        case "P":
                        case "s":
                            {
                                switch (f) {
                                case 4:
                                    return "getInt32";
                                case 8:
                                    return $() && "getBigInt64"
                                }
                                break
                            }
                        case "i":
                            return "getInt32";
                        case "c":
                            return "getInt8";
                        case "C":
                            return "getUint8";
                        case "j":
                            return $() && "getBigInt64";
                        case "f":
                            return "getFloat32";
                        case "d":
                            return "getFloat64"
                        }
                        i("Unhandled DataView getter for signature:", E)
                    }
                      , q = function(E) {
                        switch (z(E)) {
                        case "p":
                        case "P":
                        case "s":
                            {
                                switch (f) {
                                case 4:
                                    return "setInt32";
                                case 8:
                                    return $() && "setBigInt64"
                                }
                                break
                            }
                        case "i":
                            return "setInt32";
                        case "c":
                            return "setInt8";
                        case "C":
                            return "setUint8";
                        case "j":
                            return $() && "setBigInt64";
                        case "f":
                            return "setFloat32";
                        case "d":
                            return "setFloat64"
                        }
                        i("Unhandled DataView setter for signature:", E)
                    }
                      , F = function(E) {
                        switch (z(E)) {
                        case "i":
                        case "f":
                        case "c":
                        case "C":
                        case "d":
                            return Number;
                        case "j":
                            return $() && Y;
                        case "p":
                        case "P":
                        case "s":
                            switch (f) {
                            case 4:
                                return Number;
                            case 8:
                                return $() && Y
                            }
                            break
                        }
                        i("Unhandled DataView set wrapper for signature:", E)
                    }
                      , D = (E,g)=>E + "::" + g
                      , P = function(E, g) {
                        return ()=>i(D(E, g), "is read-only.")
                    }
                      , h = new WeakMap
                      , l = "(pointer-is-external)"
                      , _ = function(E, g, A) {
                        if (A || (A = h.get(g)),
                        A) {
                            if (h.delete(g),
                            Array.isArray(g.ondispose)) {
                                let T;
                                for (; T = g.ondispose.shift(); )
                                    try {
                                        T instanceof Function ? T.call(g) : T instanceof re ? T.dispose() : typeof T == "number" && y(T)
                                    } catch (M) {
                                        console.warn("ondispose() for", E.structName, "@", A, "threw. NOT propagating it.", M)
                                    }
                            } else if (g.ondispose instanceof Function)
                                try {
                                    g.ondispose()
                                } catch (T) {
                                    console.warn("ondispose() for", E.structName, "@", A, "threw. NOT propagating it.", T)
                                }
                            delete g.ondispose,
                            E.debugFlags.__flags.dealloc && O("debug.dealloc:", g[l] ? "EXTERNAL" : "", E.structName, "instance:", E.structInfo.sizeof, "bytes @" + A),
                            g[l] || y(A)
                        }
                    }
                      , c = E=>({
                        configurable: !1,
                        writable: !1,
                        iterable: !1,
                        value: E
                    })
                      , w = function(E, g, A) {
                        let T = !A;
                        A ? Object.defineProperty(g, l, c(A)) : (A = p(E.structInfo.sizeof),
                        A || i("Allocation of", E.structName, "structure failed."));
                        try {
                            E.debugFlags.__flags.alloc && O("debug.alloc:", T ? "" : "EXTERNAL", E.structName, "instance:", E.structInfo.sizeof, "bytes @" + A),
                            T && s().fill(0, A, A + E.structInfo.sizeof),
                            h.set(g, A)
                        } catch (M) {
                            throw _(E, g, A),
                            M
                        }
                    }
                      , j = function() {
                        let E = this.pointer;
                        return E ? new Uint8Array(s().slice(E, E + this.structInfo.sizeof)) : null
                    }
                      , se = c(E=>B + E + G)
                      , ee = function(E, g, A=!0) {
                        let T = E.members[g];
                        if (!T && (B || G)) {
                            for (let M of Object.values(E.members))
                                if (M.key === g) {
                                    T = M;
                                    break
                                }
                            !T && A && i(D(E.name, g), "is not a mapped struct member.")
                        }
                        return T
                    }
                      , ie = function E(g, A, T=!1) {
                        E._ || (E._ = Q=>Q.replace(/[^vipPsjrdcC]/g, "").replace(/[pPscC]/g, "i"));
                        let M = ee(g.structInfo, A, !0);
                        return T ? E._(M.signature) : M.signature
                    }
                      , le = {
                        configurable: !1,
                        enumerable: !1,
                        get: function() {
                            return h.get(this)
                        },
                        set: ()=>i("Cannot assign the 'pointer' property of a struct.")
                    }
                      , ae = c(function() {
                        let E = [];
                        for (let g of Object.keys(this.structInfo.members))
                            E.push(this.memberKey(g));
                        return E
                    })
                      , ce = new TextDecoder("utf-8")
                      , de = new TextEncoder
                      , we = typeof SharedArrayBuffer > "u" ? function() {}
                    : SharedArrayBuffer
                      , qe = function(E, g, A) {
                        return ce.decode(E.buffer instanceof we ? E.slice(g, A) : E.subarray(g, A))
                    }
                      , k = function(E, g, A=!1) {
                        let T = ee(E.structInfo, g, A);
                        return T && T.signature.length === 1 && T.signature[0] === "s" ? T : !1
                    }
                      , C = function(E) {
                        E.signature !== "s" && i("Invalid member type signature for C-string value:", JSON.stringify(E))
                    }
                      , N = function(g, A) {
                        let T = ee(g.structInfo, A, !0);
                        C(T);
                        let M = g[T.key];
                        if (!M)
                            return null;
                        let Q = M
                          , X = s();
                        for (; X[Q] !== 0; ++Q)
                            ;
                        return M === Q ? "" : qe(X, M, Q)
                    }
                      , U = function(E, ...g) {
                        E.ondispose ? Array.isArray(E.ondispose) || (E.ondispose = [E.ondispose]) : E.ondispose = [],
                        E.ondispose.push(...g)
                    }
                      , W = function(E) {
                        let g = de.encode(E)
                          , A = p(g.length + 1);
                        A || i("Allocation error while duplicating string:", E);
                        let T = s();
                        return T.set(g, A),
                        T[A + g.length] = 0,
                        A
                    }
                      , Z = function(E, g, A) {
                        let T = ee(E.structInfo, g, !0);
                        C(T);
                        let M = W(A);
                        return E[T.key] = M,
                        U(E, M),
                        E
                    }
                      , re = function(g, A) {
                        arguments[2] !== c && i("Do not call the StructType constructor", "from client-level code."),
                        Object.defineProperties(this, {
                            structName: c(g),
                            structInfo: c(A)
                        })
                    };
                    re.prototype = Object.create(null, {
                        dispose: c(function() {
                            _(this.constructor, this)
                        }),
                        lookupMember: c(function(E, g=!0) {
                            return ee(this.structInfo, E, g)
                        }),
                        memberToJsString: c(function(E) {
                            return N(this, E)
                        }),
                        memberIsString: c(function(E, g=!0) {
                            return k(this, E, g)
                        }),
                        memberKey: se,
                        memberKeys: ae,
                        memberSignature: c(function(E, g=!1) {
                            return ie(this, E, g)
                        }),
                        memoryDump: c(j),
                        pointer: le,
                        setMemberCString: c(function(E, g) {
                            return Z(this, E, g)
                        })
                    }),
                    Object.assign(re.prototype, {
                        addOnDispose: function(...E) {
                            return U(this, ...E),
                            this
                        }
                    }),
                    Object.defineProperties(re, {
                        allocCString: c(W),
                        isA: c(E=>E instanceof re),
                        hasExternalPointer: c(E=>E instanceof re && !!E[l]),
                        memberKey: se
                    });
                    let V = E=>Number.isFinite(E) || E instanceof (Y || Number)
                      , ye = function E(g, A, T) {
                        if (!E._) {
                            E._ = {
                                getters: {},
                                setters: {},
                                sw: {}
                            };
                            let ve = ["i", "c", "C", "p", "P", "s", "f", "d", "v()"];
                            J && ve.push("j"),
                            ve.forEach(function(ke) {
                                E._.getters[ke] = u(ke),
                                E._.setters[ke] = q(ke),
                                E._.sw[ke] = F(ke)
                            });
                            let tt = /^[ipPsjfdcC]$/
                              , za = /^[vipPsjfdcC]\([ipPsjfdcC]*\)$/;
                            E.sigCheck = function(ke, Ba, Qt, bt) {
                                Object.prototype.hasOwnProperty.call(ke, Qt) && i(ke.structName, "already has a property named", Qt + "."),
                                tt.test(bt) || za.test(bt) || i("Malformed signature for", D(ke.structName, Ba) + ":", bt)
                            }
                        }
                        let M = g.memberKey(A);
                        E.sigCheck(g.prototype, A, M, T.signature),
                        T.key = M,
                        T.name = A;
                        let Q = z(T.signature)
                          , X = D(g.prototype.structName, M)
                          , ne = g.prototype.debugFlags.__flags
                          , he = Object.create(null);
                        he.configurable = !1,
                        he.enumerable = !1,
                        he.get = function() {
                            ne.getter && O("debug.getter:", E._.getters[Q], "for", L(Q), X, "@", this.pointer, "+", T.offset, "sz", T.sizeof);
                            let ve = new DataView(s().buffer,this.pointer + T.offset,T.sizeof)[E._.getters[Q]](0, I);
                            return ne.getter && O("debug.getter:", X, "result =", ve),
                            ve
                        }
                        ,
                        T.readOnly ? he.set = P(g.prototype.structName, M) : he.set = function(ve) {
                            if (ne.setter && O("debug.setter:", E._.setters[Q], "for", L(Q), X, "@", this.pointer, "+", T.offset, "sz", T.sizeof, ve),
                            this.pointer || i("Cannot set struct property on disposed instance."),
                            ve === null)
                                ve = 0;
                            else
                                for (; !V(ve); ) {
                                    if (R(T.signature) && ve instanceof re) {
                                        ve = ve.pointer || 0,
                                        ne.setter && O("debug.setter:", X, "resolved to", ve);
                                        break
                                    }
                                    i("Invalid value for pointer-type", X + ".")
                                }
                            new DataView(s().buffer,this.pointer + T.offset,T.sizeof)[E._.setters[Q]](0, E._.sw[Q](ve), I)
                        }
                        ,
                        Object.defineProperty(g.prototype, M, he)
                    }
                      , ue = function E(g, A) {
                        arguments.length === 1 ? (A = g,
                        g = A.name) : A.name || (A.name = g),
                        g || i("Struct name is required.");
                        let T = !1;
                        Object.keys(A.members).forEach(X=>{
                            let ne = A.members[X];
                            ne.sizeof ? ne.sizeof === 1 ? ne.signature === "c" || ne.signature === "C" || i("Unexpected sizeof==1 member", D(A.name, X), "with signature", ne.signature) : (ne.sizeof % 4 !== 0 && (console.warn("Invalid struct member description =", ne, "from", A),
                            i(g, "member", X, "sizeof is not aligned. sizeof=" + ne.sizeof)),
                            ne.offset % 4 !== 0 && (console.warn("Invalid struct member description =", ne, "from", A),
                            i(g, "member", X, "offset is not aligned. offset=" + ne.offset))) : i(g, "member", X, "is missing sizeof."),
                            (!T || T.offset < ne.offset) && (T = ne)
                        }
                        ),
                        T ? A.sizeof < T.offset + T.sizeof && i("Invalid struct config:", g, "max member offset (" + T.offset + ") ", "extends past end of struct (sizeof=" + A.sizeof + ").") : i("No member property descriptions found.");
                        let M = c(n.__makeDebugFlags(E.debugFlags))
                          , Q = function X(ne) {
                            this instanceof X ? arguments.length ? ((ne !== (ne | 0) || ne <= 0) && i("Invalid pointer value for", g, "constructor."),
                            w(X, this, ne)) : w(X, this) : i("The", g, "constructor may only be called via 'new'.")
                        };
                        return Object.defineProperties(Q, {
                            debugFlags: M,
                            isA: c(X=>X instanceof Q),
                            memberKey: se,
                            memberKeys: ae,
                            methodInfoForKey: c(function(X) {}),
                            structInfo: c(A),
                            structName: c(g)
                        }),
                        Q.prototype = new re(g,A,c),
                        Object.defineProperties(Q.prototype, {
                            debugFlags: M,
                            constructor: c(Q)
                        }),
                        Object.keys(A.members).forEach(X=>ye(Q, X, A.members[X])),
                        Q
                    };
                    return ue.StructType = re,
                    ue.config = r,
                    ue.allocCString = W,
                    ue.debugFlags || (ue.debugFlags = n.__makeDebugFlags(n.debugFlags)),
                    ue
                }
                ,
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    "use strict";
                    let r = (...d)=>{
                        throw new Error(d.join(" "))
                    }
                      , i = t.SQLite3Error.toss
                      , n = t.capi
                      , s = t.wasm
                      , p = t.util;
                    if (globalThis.WhWasmUtilInstaller(s),
                    delete globalThis.WhWasmUtilInstaller,
                    s.bindingSignatures = [["sqlite3_aggregate_context", "void*", "sqlite3_context*", "int"], ["sqlite3_bind_double", "int", "sqlite3_stmt*", "int", "f64"], ["sqlite3_bind_int", "int", "sqlite3_stmt*", "int", "int"], ["sqlite3_bind_null", void 0, "sqlite3_stmt*", "int"], ["sqlite3_bind_parameter_count", "int", "sqlite3_stmt*"], ["sqlite3_bind_parameter_index", "int", "sqlite3_stmt*", "string"], ["sqlite3_bind_pointer", "int", "sqlite3_stmt*", "int", "*", "string:static", "*"], ["sqlite3_busy_handler", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        signature: "i(pi)",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_busy_timeout", "int", "sqlite3*", "int"], ["sqlite3_changes", "int", "sqlite3*"], ["sqlite3_clear_bindings", "int", "sqlite3_stmt*"], ["sqlite3_collation_needed", "int", "sqlite3*", "*", "*"], ["sqlite3_column_blob", "*", "sqlite3_stmt*", "int"], ["sqlite3_column_bytes", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_count", "int", "sqlite3_stmt*"], ["sqlite3_column_double", "f64", "sqlite3_stmt*", "int"], ["sqlite3_column_int", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_name", "string", "sqlite3_stmt*", "int"], ["sqlite3_column_text", "string", "sqlite3_stmt*", "int"], ["sqlite3_column_type", "int", "sqlite3_stmt*", "int"], ["sqlite3_column_value", "sqlite3_value*", "sqlite3_stmt*", "int"], ["sqlite3_commit_hook", "void*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_commit_hook",
                        signature: "i(p)",
                        contextKey: d=>d[0]
                    }), "*"]], ["sqlite3_compileoption_get", "string", "int"], ["sqlite3_compileoption_used", "int", "string"], ["sqlite3_complete", "int", "string:flexible"], ["sqlite3_context_db_handle", "sqlite3*", "sqlite3_context*"], ["sqlite3_data_count", "int", "sqlite3_stmt*"], ["sqlite3_db_filename", "string", "sqlite3*", "string"], ["sqlite3_db_handle", "sqlite3*", "sqlite3_stmt*"], ["sqlite3_db_name", "string", "sqlite3*", "int"], ["sqlite3_db_status", "int", "sqlite3*", "int", "*", "*", "int"], ["sqlite3_errcode", "int", "sqlite3*"], ["sqlite3_errmsg", "string", "sqlite3*"], ["sqlite3_error_offset", "int", "sqlite3*"], ["sqlite3_errstr", "string", "int"], ["sqlite3_exec", "int", ["sqlite3*", "string:flexible", new s.xWrap.FuncPtrAdapter({
                        signature: "i(pipp)",
                        bindScope: "transient",
                        callProxy: d=>{
                            let f;
                            return (m,I,x,S)=>{
                                try {
                                    let R = s.cArgvToJs(I, x);
                                    return f || (f = s.cArgvToJs(I, S)),
                                    d(R, f) | 0
                                } catch (R) {
                                    return R.resultCode || n.SQLITE_ERROR
                                }
                            }
                        }
                    }), "*", "**"]], ["sqlite3_expanded_sql", "string", "sqlite3_stmt*"], ["sqlite3_extended_errcode", "int", "sqlite3*"], ["sqlite3_extended_result_codes", "int", "sqlite3*", "int"], ["sqlite3_file_control", "int", "sqlite3*", "string", "int", "*"], ["sqlite3_finalize", "int", "sqlite3_stmt*"], ["sqlite3_free", void 0, "*"], ["sqlite3_get_autocommit", "int", "sqlite3*"], ["sqlite3_get_auxdata", "*", "sqlite3_context*", "int"], ["sqlite3_initialize", void 0], ["sqlite3_keyword_count", "int"], ["sqlite3_keyword_name", "int", ["int", "**", "*"]], ["sqlite3_keyword_check", "int", ["string", "int"]], ["sqlite3_libversion", "string"], ["sqlite3_libversion_number", "int"], ["sqlite3_limit", "int", ["sqlite3*", "int", "int"]], ["sqlite3_malloc", "*", "int"], ["sqlite3_open", "int", "string", "*"], ["sqlite3_open_v2", "int", "string", "*", "int", "string"], ["sqlite3_progress_handler", void 0, ["sqlite3*", "int", new s.xWrap.FuncPtrAdapter({
                        name: "xProgressHandler",
                        signature: "i(p)",
                        bindScope: "context",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_realloc", "*", "*", "int"], ["sqlite3_reset", "int", "sqlite3_stmt*"], ["sqlite3_result_blob", void 0, "sqlite3_context*", "*", "int", "*"], ["sqlite3_result_double", void 0, "sqlite3_context*", "f64"], ["sqlite3_result_error", void 0, "sqlite3_context*", "string", "int"], ["sqlite3_result_error_code", void 0, "sqlite3_context*", "int"], ["sqlite3_result_error_nomem", void 0, "sqlite3_context*"], ["sqlite3_result_error_toobig", void 0, "sqlite3_context*"], ["sqlite3_result_int", void 0, "sqlite3_context*", "int"], ["sqlite3_result_null", void 0, "sqlite3_context*"], ["sqlite3_result_pointer", void 0, "sqlite3_context*", "*", "string:static", "*"], ["sqlite3_result_subtype", void 0, "sqlite3_value*", "int"], ["sqlite3_result_text", void 0, "sqlite3_context*", "string", "int", "*"], ["sqlite3_result_zeroblob", void 0, "sqlite3_context*", "int"], ["sqlite3_rollback_hook", "void*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_rollback_hook",
                        signature: "v(p)",
                        contextKey: d=>d[0]
                    }), "*"]], ["sqlite3_set_authorizer", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_set_authorizer::xAuth",
                        signature: "i(pissss)",
                        contextKey: (d,f)=>d[0],
                        callProxy: d=>(f,m,I,x,S,R)=>{
                            try {
                                return I = I && s.cstrToJs(I),
                                x = x && s.cstrToJs(x),
                                S = S && s.cstrToJs(S),
                                R = R && s.cstrToJs(R),
                                d(f, m, I, x, S, R) || 0
                            } catch (z) {
                                return z.resultCode || n.SQLITE_ERROR
                            }
                        }
                    }), "*"]], ["sqlite3_set_auxdata", void 0, ["sqlite3_context*", "int", "*", new s.xWrap.FuncPtrAdapter({
                        name: "xDestroyAuxData",
                        signature: "v(*)",
                        contextKey: (d,f)=>d[0]
                    })]], ["sqlite3_shutdown", void 0], ["sqlite3_sourceid", "string"], ["sqlite3_sql", "string", "sqlite3_stmt*"], ["sqlite3_status", "int", "int", "*", "*", "int"], ["sqlite3_step", "int", "sqlite3_stmt*"], ["sqlite3_stmt_isexplain", "int", ["sqlite3_stmt*"]], ["sqlite3_stmt_readonly", "int", ["sqlite3_stmt*"]], ["sqlite3_stmt_status", "int", "sqlite3_stmt*", "int", "int"], ["sqlite3_strglob", "int", "string", "string"], ["sqlite3_stricmp", "int", "string", "string"], ["sqlite3_strlike", "int", "string", "string", "int"], ["sqlite3_strnicmp", "int", "string", "string", "int"], ["sqlite3_table_column_metadata", "int", "sqlite3*", "string", "string", "string", "**", "**", "*", "*", "*"], ["sqlite3_total_changes", "int", "sqlite3*"], ["sqlite3_trace_v2", "int", ["sqlite3*", "int", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_trace_v2::callback",
                        signature: "i(ippp)",
                        contextKey: (d,f)=>d[0]
                    }), "*"]], ["sqlite3_txn_state", "int", ["sqlite3*", "string"]], ["sqlite3_uri_boolean", "int", "sqlite3_filename", "string", "int"], ["sqlite3_uri_key", "string", "sqlite3_filename", "int"], ["sqlite3_uri_parameter", "string", "sqlite3_filename", "string"], ["sqlite3_user_data", "void*", "sqlite3_context*"], ["sqlite3_value_blob", "*", "sqlite3_value*"], ["sqlite3_value_bytes", "int", "sqlite3_value*"], ["sqlite3_value_double", "f64", "sqlite3_value*"], ["sqlite3_value_dup", "sqlite3_value*", "sqlite3_value*"], ["sqlite3_value_free", void 0, "sqlite3_value*"], ["sqlite3_value_frombind", "int", "sqlite3_value*"], ["sqlite3_value_int", "int", "sqlite3_value*"], ["sqlite3_value_nochange", "int", "sqlite3_value*"], ["sqlite3_value_numeric_type", "int", "sqlite3_value*"], ["sqlite3_value_pointer", "*", "sqlite3_value*", "string:static"], ["sqlite3_value_subtype", "int", "sqlite3_value*"], ["sqlite3_value_text", "string", "sqlite3_value*"], ["sqlite3_value_type", "int", "sqlite3_value*"], ["sqlite3_vfs_find", "*", "string"], ["sqlite3_vfs_register", "int", "sqlite3_vfs*", "int"], ["sqlite3_vfs_unregister", "int", "sqlite3_vfs*"]],
                    s.exports.sqlite3_activate_see instanceof Function && s.bindingSignatures.push(["sqlite3_key", "int", "sqlite3*", "string", "int"], ["sqlite3_key_v2", "int", "sqlite3*", "string", "*", "int"], ["sqlite3_rekey", "int", "sqlite3*", "string", "int"], ["sqlite3_rekey_v2", "int", "sqlite3*", "string", "*", "int"], ["sqlite3_activate_see", void 0, "string"]),
                    s.bindingSignatures.int64 = [["sqlite3_bind_int64", "int", ["sqlite3_stmt*", "int", "i64"]], ["sqlite3_changes64", "i64", ["sqlite3*"]], ["sqlite3_column_int64", "i64", ["sqlite3_stmt*", "int"]], ["sqlite3_create_module", "int", ["sqlite3*", "string", "sqlite3_module*", "*"]], ["sqlite3_create_module_v2", "int", ["sqlite3*", "string", "sqlite3_module*", "*", "*"]], ["sqlite3_declare_vtab", "int", ["sqlite3*", "string:flexible"]], ["sqlite3_deserialize", "int", "sqlite3*", "string", "*", "i64", "i64", "int"], ["sqlite3_drop_modules", "int", ["sqlite3*", "**"]], ["sqlite3_last_insert_rowid", "i64", ["sqlite3*"]], ["sqlite3_malloc64", "*", "i64"], ["sqlite3_msize", "i64", "*"], ["sqlite3_overload_function", "int", ["sqlite3*", "string", "int"]], ["sqlite3_preupdate_blobwrite", "int", "sqlite3*"], ["sqlite3_preupdate_count", "int", "sqlite3*"], ["sqlite3_preupdate_depth", "int", "sqlite3*"], ["sqlite3_preupdate_hook", "*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_preupdate_hook",
                        signature: "v(ppippjj)",
                        contextKey: d=>d[0],
                        callProxy: d=>(f,m,I,x,S,R,z)=>{
                            d(f, m, I, s.cstrToJs(x), s.cstrToJs(S), R, z)
                        }
                    }), "*"]], ["sqlite3_preupdate_new", "int", ["sqlite3*", "int", "**"]], ["sqlite3_preupdate_old", "int", ["sqlite3*", "int", "**"]], ["sqlite3_realloc64", "*", "*", "i64"], ["sqlite3_result_int64", void 0, "*", "i64"], ["sqlite3_result_zeroblob64", "int", "*", "i64"], ["sqlite3_serialize", "*", "sqlite3*", "string", "*", "int"], ["sqlite3_set_last_insert_rowid", void 0, ["sqlite3*", "i64"]], ["sqlite3_status64", "int", "int", "*", "*", "int"], ["sqlite3_total_changes64", "i64", ["sqlite3*"]], ["sqlite3_update_hook", "*", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                        name: "sqlite3_update_hook",
                        signature: "v(iippj)",
                        contextKey: d=>d[0],
                        callProxy: d=>(f,m,I,x,S)=>{
                            d(f, m, s.cstrToJs(I), s.cstrToJs(x), S)
                        }
                    }), "*"]], ["sqlite3_uri_int64", "i64", ["sqlite3_filename", "string", "i64"]], ["sqlite3_value_int64", "i64", "sqlite3_value*"], ["sqlite3_vtab_collation", "string", "sqlite3_index_info*", "int"], ["sqlite3_vtab_distinct", "int", "sqlite3_index_info*"], ["sqlite3_vtab_in", "int", "sqlite3_index_info*", "int", "int"], ["sqlite3_vtab_in_first", "int", "sqlite3_value*", "**"], ["sqlite3_vtab_in_next", "int", "sqlite3_value*", "**"], ["sqlite3_vtab_nochange", "int", "sqlite3_context*"], ["sqlite3_vtab_on_conflict", "int", "sqlite3*"], ["sqlite3_vtab_rhs_value", "int", "sqlite3_index_info*", "int", "**"]],
                    s.bigIntEnabled && s.exports.sqlite3changegroup_add) {
                        let d = {
                            signature: "i(ps)",
                            callProxy: f=>(m,I)=>{
                                try {
                                    return f(m, s.cstrToJs(I)) | 0
                                } catch (x) {
                                    return x.resultCode || n.SQLITE_ERROR
                                }
                            }
                        };
                        s.bindingSignatures.int64.push(["sqlite3changegroup_add", "int", ["sqlite3_changegroup*", "int", "void*"]], ["sqlite3changegroup_add_strm", "int", ["sqlite3_changegroup*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changegroup_delete", void 0, ["sqlite3_changegroup*"]], ["sqlite3changegroup_new", "int", ["**"]], ["sqlite3changegroup_output", "int", ["sqlite3_changegroup*", "int*", "**"]], ["sqlite3changegroup_output_strm", "int", ["sqlite3_changegroup*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply", "int", ["sqlite3*", "int", "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply_strm", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_apply_v2", "int", ["sqlite3*", "int", "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*", "**", "int*", "int"]], ["sqlite3changeset_apply_v2_strm", "int", ["sqlite3*", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            bindScope: "transient",
                            ...d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xConflict",
                            signature: "i(pip)",
                            bindScope: "transient"
                        }), "void*", "**", "int*", "int"]], ["sqlite3changeset_concat", "int", ["int", "void*", "int", "void*", "int*", "**"]], ["sqlite3changeset_concat_strm", "int", [new s.xWrap.FuncPtrAdapter({
                            name: "xInputA",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xInputB",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_conflict", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_finalize", "int", ["sqlite3_changeset_iter*"]], ["sqlite3changeset_fk_conflicts", "int", ["sqlite3_changeset_iter*", "int*"]], ["sqlite3changeset_invert", "int", ["int", "void*", "int*", "**"]], ["sqlite3changeset_invert_strm", "int", [new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppi)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_new", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_next", "int", ["sqlite3_changeset_iter*"]], ["sqlite3changeset_old", "int", ["sqlite3_changeset_iter*", "int", "**"]], ["sqlite3changeset_op", "int", ["sqlite3_changeset_iter*", "**", "int*", "int*", "int*"]], ["sqlite3changeset_pk", "int", ["sqlite3_changeset_iter*", "**", "int*"]], ["sqlite3changeset_start", "int", ["**", "int", "*"]], ["sqlite3changeset_start_strm", "int", ["**", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3changeset_start_v2", "int", ["**", "int", "*", "int"]], ["sqlite3changeset_start_v2_strm", "int", ["**", new s.xWrap.FuncPtrAdapter({
                            name: "xInput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*", "int"]], ["sqlite3session_attach", "int", ["sqlite3_session*", "string"]], ["sqlite3session_changeset", "int", ["sqlite3_session*", "int*", "**"]], ["sqlite3session_changeset_size", "i64", ["sqlite3_session*"]], ["sqlite3session_changeset_strm", "int", ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3session_config", "int", ["int", "void*"]], ["sqlite3session_create", "int", ["sqlite3*", "string", "**"]], ["sqlite3session_diff", "int", ["sqlite3_session*", "string", "string", "**"]], ["sqlite3session_enable", "int", ["sqlite3_session*", "int"]], ["sqlite3session_indirect", "int", ["sqlite3_session*", "int"]], ["sqlite3session_isempty", "int", ["sqlite3_session*"]], ["sqlite3session_memory_used", "i64", ["sqlite3_session*"]], ["sqlite3session_object_config", "int", ["sqlite3_session*", "int", "void*"]], ["sqlite3session_patchset", "int", ["sqlite3_session*", "*", "**"]], ["sqlite3session_patchset_strm", "int", ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xOutput",
                            signature: "i(ppp)",
                            bindScope: "transient"
                        }), "void*"]], ["sqlite3session_table_filter", void 0, ["sqlite3_session*", new s.xWrap.FuncPtrAdapter({
                            name: "xFilter",
                            ...d,
                            contextKey: (f,m)=>f[0]
                        }), "*"]])
                    }
                    s.bindingSignatures.wasm = [["sqlite3_wasm_db_reset", "int", "sqlite3*"], ["sqlite3_wasm_db_vfs", "sqlite3_vfs*", "sqlite3*", "string"], ["sqlite3_wasm_vfs_create_file", "int", "sqlite3_vfs*", "string", "*", "int"], ["sqlite3_wasm_posix_create_file", "int", "string", "*", "int"], ["sqlite3_wasm_vfs_unlink", "int", "sqlite3_vfs*", "string"]],
                    t.StructBinder = globalThis.Jaccwabyt({
                        heap: s.heap8u,
                        alloc: s.alloc,
                        dealloc: s.dealloc,
                        bigIntEnabled: s.bigIntEnabled,
                        memberPrefix: "$"
                    }),
                    delete globalThis.Jaccwabyt;
                    {
                        let d = s.xWrap.argAdapter("string");
                        s.xWrap.argAdapter("string:flexible", S=>d(p.flexibleString(S))),
                        s.xWrap.argAdapter("string:static", function(S) {
                            return s.isPtr(S) ? S : (S = "" + S,
                            this[S] || (this[S] = s.allocCString(S)))
                        }
                        .bind(Object.create(null)));
                        let f = s.xWrap.argAdapter("*")
                          , m = function() {};
                        s.xWrap.argAdapter("sqlite3_filename", f)("sqlite3_context*", f)("sqlite3_value*", f)("void*", f)("sqlite3_changegroup*", f)("sqlite3_changeset_iter*", f)("sqlite3_session*", f)("sqlite3_stmt*", S=>f(S instanceof (t?.oo1?.Stmt || m) ? S.pointer : S))("sqlite3*", S=>f(S instanceof (t?.oo1?.DB || m) ? S.pointer : S))("sqlite3_index_info*", S=>f(S instanceof (n.sqlite3_index_info || m) ? S.pointer : S))("sqlite3_module*", S=>f(S instanceof (n.sqlite3_module || m) ? S.pointer : S))("sqlite3_vfs*", S=>typeof S == "string" ? n.sqlite3_vfs_find(S) || t.SQLite3Error.toss(n.SQLITE_NOTFOUND, "Unknown sqlite3_vfs name:", S) : f(S instanceof (n.sqlite3_vfs || m) ? S.pointer : S));
                        let I = s.xWrap.resultAdapter("*");
                        s.xWrap.resultAdapter("sqlite3*", I)("sqlite3_context*", I)("sqlite3_stmt*", I)("sqlite3_value*", I)("sqlite3_vfs*", I)("void*", I),
                        s.exports.sqlite3_step.length === 0 && (s.xWrap.doArgcCheck = !1,
                        t.config.warn("Disabling sqlite3.wasm.xWrap.doArgcCheck due to environmental quirks."));
                        for (let S of s.bindingSignatures)
                            n[S[0]] = s.xWrap.apply(null, S);
                        for (let S of s.bindingSignatures.wasm)
                            s[S[0]] = s.xWrap.apply(null, S);
                        let x = function(S) {
                            return ()=>r(S + "() is unavailable due to lack", "of BigInt support in this build.")
                        };
                        for (let S of s.bindingSignatures.int64)
                            n[S[0]] = s.bigIntEnabled ? s.xWrap.apply(null, S) : x(S[0]);
                        if (delete s.bindingSignatures,
                        s.exports.sqlite3_wasm_db_error) {
                            let S = s.xWrap("sqlite3_wasm_db_error", "int", "sqlite3*", "int", "string");
                            p.sqlite3_wasm_db_error = function(R, z, L) {
                                return z instanceof t.WasmAllocError ? (z = n.SQLITE_NOMEM,
                                L = 0) : z instanceof Error && (L = L || "" + z,
                                z = z.resultCode || n.SQLITE_ERROR),
                                R ? S(R, z, L) : z
                            }
                        } else
                            p.sqlite3_wasm_db_error = function(S, R, z) {
                                return console.warn("sqlite3_wasm_db_error() is not exported.", arguments),
                                R
                            }
                    }
                    {
                        let d = s.xCall("sqlite3_wasm_enum_json");
                        d || r("Maintenance required: increase sqlite3_wasm_enum_json()'s", "static buffer size!"),
                        s.ctype = JSON.parse(s.cstrToJs(d));
                        let f = ["access", "authorizer", "blobFinalizers", "changeset", "config", "dataTypes", "dbConfig", "dbStatus", "encodings", "fcntl", "flock", "ioCap", "limits", "openFlags", "prepareFlags", "resultCodes", "sqlite3Status", "stmtStatus", "syncFlags", "trace", "txnState", "udfFlags", "version"];
                        s.bigIntEnabled && f.push("serialize", "session", "vtab");
                        for (let x of f)
                            for (let S of Object.entries(s.ctype[x]))
                                n[S[0]] = S[1];
                        s.functionEntry(n.SQLITE_WASM_DEALLOC) || r("Internal error: cannot resolve exported function", "entry SQLITE_WASM_DEALLOC (==" + n.SQLITE_WASM_DEALLOC + ").");
                        let m = Object.create(null);
                        for (let x of ["resultCodes"])
                            for (let S of Object.entries(s.ctype[x]))
                                m[S[1]] = S[0];
                        n.sqlite3_js_rc_str = x=>m[x];
                        let I = Object.assign(Object.create(null), {
                            WasmTestStruct: !0,
                            sqlite3_kvvfs_methods: !p.isUIThread(),
                            sqlite3_index_info: !s.bigIntEnabled,
                            sqlite3_index_constraint: !s.bigIntEnabled,
                            sqlite3_index_orderby: !s.bigIntEnabled,
                            sqlite3_index_constraint_usage: !s.bigIntEnabled
                        });
                        for (let x of s.ctype.structs)
                            I[x.name] || (n[x.name] = t.StructBinder(x));
                        if (n.sqlite3_index_info) {
                            for (let x of ["sqlite3_index_constraint", "sqlite3_index_orderby", "sqlite3_index_constraint_usage"])
                                n.sqlite3_index_info[x] = n[x],
                                delete n[x];
                            n.sqlite3_vtab_config = s.xWrap("sqlite3_wasm_vtab_config", "int", ["sqlite3*", "int", "int"])
                        }
                    }
                    let y = (d,f,m)=>p.sqlite3_wasm_db_error(d, n.SQLITE_MISUSE, f + "() requires " + m + " argument" + (m === 1 ? "" : "s") + ".")
                      , O = d=>p.sqlite3_wasm_db_error(d, n.SQLITE_FORMAT, "SQLITE_UTF8 is the only supported encoding.")
                      , B = d=>s.xWrap.argAdapter("sqlite3*")(d)
                      , G = d=>s.isPtr(d) ? s.cstrToJs(d) : d
                      , J = function(d, f) {
                        d = B(d);
                        let m = this.dbMap.get(d);
                        if (f)
                            !m && f > 0 && this.dbMap.set(d, m = Object.create(null));
                        else
                            return this.dbMap.delete(d),
                            m;
                        return m
                    }
                    .bind(Object.assign(Object.create(null), {
                        dbMap: new Map
                    }));
                    J.addCollation = function(d, f) {
                        let m = J(d, 1);
                        m.collation || (m.collation = new Set),
                        m.collation.add(G(f).toLowerCase())
                    }
                    ,
                    J._addUDF = function(d, f, m, I) {
                        f = G(f).toLowerCase();
                        let x = I.get(f);
                        x || I.set(f, x = new Set),
                        x.add(m < 0 ? -1 : m)
                    }
                    ,
                    J.addFunction = function(d, f, m) {
                        let I = J(d, 1);
                        I.udf || (I.udf = new Map),
                        this._addUDF(d, f, m, I.udf)
                    }
                    ,
                    J.addWindowFunc = function(d, f, m) {
                        let I = J(d, 1);
                        I.wudf || (I.wudf = new Map),
                        this._addUDF(d, f, m, I.wudf)
                    }
                    ,
                    J.cleanup = function(d) {
                        d = B(d);
                        let f = [d];
                        for (let x of ["sqlite3_busy_handler", "sqlite3_commit_hook", "sqlite3_preupdate_hook", "sqlite3_progress_handler", "sqlite3_rollback_hook", "sqlite3_set_authorizer", "sqlite3_trace_v2", "sqlite3_update_hook"]) {
                            let S = s.exports[x];
                            f.length = S.length;
                            try {
                                n[x](...f)
                            } catch (R) {
                                console.warn("close-time call of", x + "(", f, ") threw:", R)
                            }
                        }
                        let m = J(d, 0);
                        if (!m)
                            return;
                        if (m.collation) {
                            for (let x of m.collation)
                                try {
                                    n.sqlite3_create_collation_v2(d, x, n.SQLITE_UTF8, 0, 0, 0)
                                } catch {}
                            delete m.collation
                        }
                        let I;
                        for (I = 0; I < 2; ++I) {
                            let x = I ? m.wudf : m.udf;
                            if (!x)
                                continue;
                            let S = I ? n.sqlite3_create_window_function : n.sqlite3_create_function_v2;
                            for (let R of x) {
                                let z = R[0]
                                  , L = R[1]
                                  , $ = [d, z, 0, n.SQLITE_UTF8, 0, 0, 0, 0, 0];
                                I && $.push(0);
                                for (let u of L)
                                    try {
                                        $[2] = u,
                                        S.apply(null, $)
                                    } catch {}
                                L.clear()
                            }
                            x.clear()
                        }
                        delete m.udf,
                        delete m.wudf
                    }
                    ;
                    {
                        let d = s.xWrap("sqlite3_close_v2", "int", "sqlite3*");
                        n.sqlite3_close_v2 = function(f) {
                            if (arguments.length !== 1)
                                return y(f, "sqlite3_close_v2", 1);
                            if (f)
                                try {
                                    J.cleanup(f)
                                } catch {}
                            return d(f)
                        }
                    }
                    if (n.sqlite3session_table_filter) {
                        let d = s.xWrap("sqlite3session_delete", void 0, ["sqlite3_session*"]);
                        n.sqlite3session_delete = function(f) {
                            if (arguments.length !== 1)
                                return y(pDb, "sqlite3session_delete", 1);
                            f && n.sqlite3session_table_filter(f, 0, 0),
                            d(f)
                        }
                    }
                    {
                        let d = (m,I)=>"argv[" + I + "]:" + m[0] + ":" + s.cstrToJs(m[1]).toLowerCase()
                          , f = s.xWrap("sqlite3_create_collation_v2", "int", ["sqlite3*", "string", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xCompare",
                            signature: "i(pipip)",
                            contextKey: d
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            signature: "v(p)",
                            contextKey: d
                        })]);
                        n.sqlite3_create_collation_v2 = function(m, I, x, S, R, z) {
                            if (arguments.length !== 6)
                                return y(m, "sqlite3_create_collation_v2", 6);
                            if (!(x & 15))
                                x |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (x & 15))
                                return O(m);
                            try {
                                let L = f(m, I, x, S, R, z);
                                return L === 0 && R instanceof Function && J.addCollation(m, I),
                                L
                            } catch (L) {
                                return p.sqlite3_wasm_db_error(m, L)
                            }
                        }
                        ,
                        n.sqlite3_create_collation = (m,I,x,S,R)=>arguments.length === 5 ? n.sqlite3_create_collation_v2(m, I, x, S, R, 0) : y(m, "sqlite3_create_collation", 5)
                    }
                    {
                        let d = function(x, S) {
                            return x[0] + ":" + (x[2] < 0 ? -1 : x[2]) + ":" + S + ":" + s.cstrToJs(x[1]).toLowerCase()
                        }
                          , f = Object.assign(Object.create(null), {
                            xInverseAndStep: {
                                signature: "v(pip)",
                                contextKey: d,
                                callProxy: x=>(S,R,z)=>{
                                    try {
                                        x(S, ...n.sqlite3_values_to_js(R, z))
                                    } catch (L) {
                                        n.sqlite3_result_error_js(S, L)
                                    }
                                }
                            },
                            xFinalAndValue: {
                                signature: "v(p)",
                                contextKey: d,
                                callProxy: x=>S=>{
                                    try {
                                        n.sqlite3_result_js(S, x(S))
                                    } catch (R) {
                                        n.sqlite3_result_error_js(S, R)
                                    }
                                }
                            },
                            xFunc: {
                                signature: "v(pip)",
                                contextKey: d,
                                callProxy: x=>(S,R,z)=>{
                                    try {
                                        n.sqlite3_result_js(S, x(S, ...n.sqlite3_values_to_js(R, z)))
                                    } catch (L) {
                                        n.sqlite3_result_error_js(S, L)
                                    }
                                }
                            },
                            xDestroy: {
                                signature: "v(p)",
                                contextKey: d,
                                callProxy: x=>S=>{
                                    try {
                                        x(S)
                                    } catch (R) {
                                        console.error("UDF xDestroy method threw:", R)
                                    }
                                }
                            }
                        })
                          , m = s.xWrap("sqlite3_create_function_v2", "int", ["sqlite3*", "string", "int", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xFunc",
                            ...f.xFunc
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xStep",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xFinal",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            ...f.xDestroy
                        })])
                          , I = s.xWrap("sqlite3_create_window_function", "int", ["sqlite3*", "string", "int", "int", "*", new s.xWrap.FuncPtrAdapter({
                            name: "xStep",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xFinal",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xValue",
                            ...f.xFinalAndValue
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xInverse",
                            ...f.xInverseAndStep
                        }), new s.xWrap.FuncPtrAdapter({
                            name: "xDestroy",
                            ...f.xDestroy
                        })]);
                        n.sqlite3_create_function_v2 = function x(S, R, z, L, $, u, q, F, D) {
                            if (x.length !== arguments.length)
                                return y(S, "sqlite3_create_function_v2", x.length);
                            if (!(L & 15))
                                L |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (L & 15))
                                return O(S);
                            try {
                                let P = m(S, R, z, L, $, u, q, F, D);
                                return P === 0 && (u instanceof Function || q instanceof Function || F instanceof Function || D instanceof Function) && J.addFunction(S, R, z),
                                P
                            } catch (P) {
                                return console.error("sqlite3_create_function_v2() setup threw:", P),
                                p.sqlite3_wasm_db_error(S, P, "Creation of UDF threw: " + P)
                            }
                        }
                        ,
                        n.sqlite3_create_function = function x(S, R, z, L, $, u, q, F) {
                            return x.length === arguments.length ? n.sqlite3_create_function_v2(S, R, z, L, $, u, q, F, 0) : y(S, "sqlite3_create_function", x.length)
                        }
                        ,
                        n.sqlite3_create_window_function = function x(S, R, z, L, $, u, q, F, D, P) {
                            if (x.length !== arguments.length)
                                return y(S, "sqlite3_create_window_function", x.length);
                            if (!(L & 15))
                                L |= n.SQLITE_UTF8;
                            else if (n.SQLITE_UTF8 !== (L & 15))
                                return O(S);
                            try {
                                let h = I(S, R, z, L, $, u, q, F, D, P);
                                return h === 0 && (u instanceof Function || q instanceof Function || F instanceof Function || D instanceof Function || P instanceof Function) && J.addWindowFunc(S, R, z),
                                h
                            } catch (h) {
                                return console.error("sqlite3_create_window_function() setup threw:", h),
                                p.sqlite3_wasm_db_error(S, h, "Creation of UDF threw: " + h)
                            }
                        }
                        ,
                        n.sqlite3_create_function_v2.udfSetResult = n.sqlite3_create_function.udfSetResult = n.sqlite3_create_window_function.udfSetResult = n.sqlite3_result_js,
                        n.sqlite3_create_function_v2.udfConvertArgs = n.sqlite3_create_function.udfConvertArgs = n.sqlite3_create_window_function.udfConvertArgs = n.sqlite3_values_to_js,
                        n.sqlite3_create_function_v2.udfSetError = n.sqlite3_create_function.udfSetError = n.sqlite3_create_window_function.udfSetError = n.sqlite3_result_error_js
                    }
                    {
                        let d = (m,I)=>(typeof m == "string" ? I = -1 : p.isSQLableTypedArray(m) ? (I = m.byteLength,
                        m = p.typedArrayToString(m instanceof ArrayBuffer ? new Uint8Array(m) : m)) : Array.isArray(m) && (m = m.join(""),
                        I = -1),
                        [m, I])
                          , f = {
                            basic: s.xWrap("sqlite3_prepare_v3", "int", ["sqlite3*", "string", "int", "int", "**", "**"]),
                            full: s.xWrap("sqlite3_prepare_v3", "int", ["sqlite3*", "*", "int", "int", "**", "**"])
                        };
                        n.sqlite3_prepare_v3 = function m(I, x, S, R, z, L) {
                            if (m.length !== arguments.length)
                                return y(I, "sqlite3_prepare_v3", m.length);
                            let[$,u] = d(x, S);
                            switch (typeof $) {
                            case "string":
                                return f.basic(I, $, u, R, z, null);
                            case "number":
                                return f.full(I, $, u, R, z, L);
                            default:
                                return p.sqlite3_wasm_db_error(I, n.SQLITE_MISUSE, "Invalid SQL argument type for sqlite3_prepare_v2/v3().")
                            }
                        }
                        ,
                        n.sqlite3_prepare_v2 = function m(I, x, S, R, z) {
                            return m.length === arguments.length ? n.sqlite3_prepare_v3(I, x, S, 0, R, z) : y(I, "sqlite3_prepare_v2", m.length)
                        }
                    }
                    {
                        let d = s.xWrap("sqlite3_bind_text", "int", ["sqlite3_stmt*", "int", "string", "int", "*"])
                          , f = s.xWrap("sqlite3_bind_blob", "int", ["sqlite3_stmt*", "int", "*", "int", "*"]);
                        n.sqlite3_bind_text = function m(I, x, S, R, z) {
                            if (m.length !== arguments.length)
                                return y(n.sqlite3_db_handle(I), "sqlite3_bind_text", m.length);
                            if (s.isPtr(S) || S === null)
                                return d(I, x, S, R, z);
                            S instanceof ArrayBuffer ? S = new Uint8Array(S) : Array.isArray(pMem) && (S = pMem.join(""));
                            let L, $;
                            try {
                                if (p.isSQLableTypedArray(S))
                                    L = s.allocFromTypedArray(S),
                                    $ = S.byteLength;
                                else if (typeof S == "string")
                                    [L,$] = s.allocCString(S);
                                else
                                    return p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), n.SQLITE_MISUSE, "Invalid 3rd argument type for sqlite3_bind_text().");
                                return d(I, x, L, $, n.SQLITE_WASM_DEALLOC)
                            } catch (u) {
                                return s.dealloc(L),
                                p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), u)
                            }
                        }
                        ,
                        n.sqlite3_bind_blob = function m(I, x, S, R, z) {
                            if (m.length !== arguments.length)
                                return y(n.sqlite3_db_handle(I), "sqlite3_bind_blob", m.length);
                            if (s.isPtr(S) || S === null)
                                return f(I, x, S, R, z);
                            S instanceof ArrayBuffer ? S = new Uint8Array(S) : Array.isArray(S) && (S = S.join(""));
                            let L, $;
                            try {
                                if (p.isBindableTypedArray(S))
                                    L = s.allocFromTypedArray(S),
                                    $ = R >= 0 ? R : S.byteLength;
                                else if (typeof S == "string")
                                    [L,$] = s.allocCString(S);
                                else
                                    return p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), n.SQLITE_MISUSE, "Invalid 3rd argument type for sqlite3_bind_blob().");
                                return f(I, x, L, $, n.SQLITE_WASM_DEALLOC)
                            } catch (u) {
                                return s.dealloc(L),
                                p.sqlite3_wasm_db_error(n.sqlite3_db_handle(I), u)
                            }
                        }
                    }
                    n.sqlite3_config = function(d, ...f) {
                        if (arguments.length < 2)
                            return n.SQLITE_MISUSE;
                        switch (d) {
                        case n.SQLITE_CONFIG_COVERING_INDEX_SCAN:
                        case n.SQLITE_CONFIG_MEMSTATUS:
                        case n.SQLITE_CONFIG_SMALL_MALLOC:
                        case n.SQLITE_CONFIG_SORTERREF_SIZE:
                        case n.SQLITE_CONFIG_STMTJRNL_SPILL:
                        case n.SQLITE_CONFIG_URI:
                            return s.exports.sqlite3_wasm_config_i(d, f[0]);
                        case n.SQLITE_CONFIG_LOOKASIDE:
                            return s.exports.sqlite3_wasm_config_ii(d, f[0], f[1]);
                        case n.SQLITE_CONFIG_MEMDB_MAXSIZE:
                            return s.exports.sqlite3_wasm_config_j(d, f[0]);
                        case n.SQLITE_CONFIG_GETMALLOC:
                        case n.SQLITE_CONFIG_GETMUTEX:
                        case n.SQLITE_CONFIG_GETPCACHE2:
                        case n.SQLITE_CONFIG_GETPCACHE:
                        case n.SQLITE_CONFIG_HEAP:
                        case n.SQLITE_CONFIG_LOG:
                        case n.SQLITE_CONFIG_MALLOC:
                        case n.SQLITE_CONFIG_MMAP_SIZE:
                        case n.SQLITE_CONFIG_MULTITHREAD:
                        case n.SQLITE_CONFIG_MUTEX:
                        case n.SQLITE_CONFIG_PAGECACHE:
                        case n.SQLITE_CONFIG_PCACHE2:
                        case n.SQLITE_CONFIG_PCACHE:
                        case n.SQLITE_CONFIG_PCACHE_HDRSZ:
                        case n.SQLITE_CONFIG_PMASZ:
                        case n.SQLITE_CONFIG_SERIALIZED:
                        case n.SQLITE_CONFIG_SINGLETHREAD:
                        case n.SQLITE_CONFIG_SQLLOG:
                        case n.SQLITE_CONFIG_WIN32_HEAPSIZE:
                        default:
                            return n.SQLITE_NOTFOUND
                        }
                    }
                    ;
                    {
                        let d = new Set;
                        n.sqlite3_auto_extension = function(f) {
                            if (f instanceof Function)
                                f = s.installFunction("i(ppp)", f);
                            else if (arguments.length !== 1 || !s.isPtr(f))
                                return n.SQLITE_MISUSE;
                            let m = s.exports.sqlite3_auto_extension(f);
                            return f !== arguments[0] && (m === 0 ? d.add(f) : s.uninstallFunction(f)),
                            m
                        }
                        ,
                        n.sqlite3_cancel_auto_extension = function(f) {
                            return !f || arguments.length !== 1 || !s.isPtr(f) ? 0 : s.exports.sqlite3_cancel_auto_extension(f)
                        }
                        ,
                        n.sqlite3_reset_auto_extension = function() {
                            s.exports.sqlite3_reset_auto_extension();
                            for (let f of d)
                                s.uninstallFunction(f);
                            d.clear()
                        }
                    }
                    let Y = n.sqlite3_vfs_find("kvvfs");
                    if (Y)
                        if (p.isUIThread()) {
                            let d = new n.sqlite3_kvvfs_methods(s.exports.sqlite3_wasm_kvvfs_methods());
                            delete n.sqlite3_kvvfs_methods;
                            let f = s.exports.sqlite3_wasm_kvvfsMakeKeyOnPstack
                              , m = s.pstack
                              , I = S=>s.peek(S) === 115 ? sessionStorage : localStorage
                              , x = {
                                xRead: (S,R,z,L)=>{
                                    let $ = m.pointer
                                      , u = s.scopedAllocPush();
                                    try {
                                        let q = f(S, R);
                                        if (!q)
                                            return -3;
                                        let F = s.cstrToJs(q)
                                          , D = I(S).getItem(F);
                                        if (!D)
                                            return -1;
                                        let P = D.length;
                                        if (L <= 0)
                                            return P;
                                        if (L === 1)
                                            return s.poke(z, 0),
                                            P;
                                        let h = s.scopedAllocCString(D);
                                        return L > P + 1 && (L = P + 1),
                                        s.heap8u().copyWithin(z, h, h + L - 1),
                                        s.poke(z + L - 1, 0),
                                        L - 1
                                    } catch (q) {
                                        return console.error("kvstorageRead()", q),
                                        -2
                                    } finally {
                                        m.restore($),
                                        s.scopedAllocPop(u)
                                    }
                                }
                                ,
                                xWrite: (S,R,z)=>{
                                    let L = m.pointer;
                                    try {
                                        let $ = f(S, R);
                                        if (!$)
                                            return 1;
                                        let u = s.cstrToJs($);
                                        return I(S).setItem(u, s.cstrToJs(z)),
                                        0
                                    } catch ($) {
                                        return console.error("kvstorageWrite()", $),
                                        n.SQLITE_IOERR
                                    } finally {
                                        m.restore(L)
                                    }
                                }
                                ,
                                xDelete: (S,R)=>{
                                    let z = m.pointer;
                                    try {
                                        let L = f(S, R);
                                        return L ? (I(S).removeItem(s.cstrToJs(L)),
                                        0) : 1
                                    } catch (L) {
                                        return console.error("kvstorageDelete()", L),
                                        n.SQLITE_IOERR
                                    } finally {
                                        m.restore(z)
                                    }
                                }
                            };
                            for (let S of Object.keys(x))
                                d[d.memberKey(S)] = s.installFunction(d.memberSignature(S), x[S])
                        } else
                            n.sqlite3_vfs_unregister(Y);
                    s.xWrap.FuncPtrAdapter.warnOnUse = !0
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    t.version = {
                        libVersion: "3.45.0",
                        libVersionNumber: 3045e3,
                        sourceId: "2024-01-15 17:01:13 1066602b2b1976fe58b5150777cced894af17c803e068f5918390d6915b46e1d",
                        downloadVersion: 345e4
                    }
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = (...h)=>{
                        throw new Error(h.join(" "))
                    }
                      , i = (...h)=>{
                        throw new t.SQLite3Error(...h)
                    }
                      , n = t.capi
                      , s = t.wasm
                      , p = t.util
                      , y = new WeakMap
                      , O = new WeakMap
                      , B = (h,l,_)=>{
                        let c = Object.getOwnPropertyDescriptor(h, l);
                        return c ? c.value : _
                    }
                      , G = function(h, l) {
                        return l && (h instanceof f && (h = h.pointer),
                        i(l, "sqlite3 result code", l + ":", h ? n.sqlite3_errmsg(h) : n.sqlite3_errstr(l))),
                        arguments[0]
                    }
                      , J = s.installFunction("i(ippp)", function(h, l, _, c) {
                        n.SQLITE_TRACE_STMT === h && console.log("SQL TRACE #" + ++this.counter + " via sqlite3@" + l + ":", s.cstrToJs(c))
                    }
                    .bind({
                        counter: 0
                    }))
                      , Y = Object.create(null)
                      , d = function h(...l) {
                        if (!h._name2vfs) {
                            h._name2vfs = Object.create(null);
                            let ae = typeof importScripts == "function" ? ce=>i("The VFS for", ce, "is only available in the main window thread.") : !1;
                            h._name2vfs[":localStorage:"] = {
                                vfs: "kvvfs",
                                filename: ae || (()=>"local")
                            },
                            h._name2vfs[":sessionStorage:"] = {
                                vfs: "kvvfs",
                                filename: ae || (()=>"session")
                            }
                        }
                        let _ = h.normalizeArgs(...l)
                          , c = _.filename
                          , w = _.vfs
                          , j = _.flags;
                        (typeof c != "string" && typeof c != "number" || typeof j != "string" || w && typeof w != "string" && typeof w != "number") && (t.config.error("Invalid DB ctor args", _, arguments),
                        i("Invalid arguments for DB constructor."));
                        let H = typeof c == "number" ? s.cstrToJs(c) : c
                          , se = h._name2vfs[H];
                        se && (w = se.vfs,
                        c = H = se.filename(H));
                        let ee, ie = 0;
                        j.indexOf("c") >= 0 && (ie |= n.SQLITE_OPEN_CREATE | n.SQLITE_OPEN_READWRITE),
                        j.indexOf("w") >= 0 && (ie |= n.SQLITE_OPEN_READWRITE),
                        ie === 0 && (ie |= n.SQLITE_OPEN_READONLY),
                        ie |= n.SQLITE_OPEN_EXRESCODE;
                        let le = s.pstack.pointer;
                        try {
                            let ae = s.pstack.allocPtr()
                              , ce = n.sqlite3_open_v2(c, ae, ie, w || 0);
                            ee = s.peekPtr(ae),
                            G(ee, ce),
                            n.sqlite3_extended_result_codes(ee, 1),
                            j.indexOf("t") >= 0 && n.sqlite3_trace_v2(ee, n.SQLITE_TRACE_STMT, J, ee)
                        } catch (ae) {
                            throw ee && n.sqlite3_close_v2(ee),
                            ae
                        } finally {
                            s.pstack.restore(le)
                        }
                        this.filename = H,
                        y.set(this, ee),
                        O.set(this, Object.create(null));
                        try {
                            let ae = n.sqlite3_js_db_vfs(ee);
                            ae || i("Internal error: cannot get VFS for new db handle.");
                            let ce = Y[ae];
                            ce instanceof Function ? ce(this, t) : ce && G(ee, n.sqlite3_exec(ee, ce, 0, 0, 0))
                        } catch (ae) {
                            throw this.close(),
                            ae
                        }
                    };
                    d.setVfsPostOpenSql = function(h, l) {
                        Y[h] = l
                    }
                    ,
                    d.normalizeArgs = function(h=":memory:", l="c", _=null) {
                        let c = {};
                        return arguments.length === 1 && arguments[0] && typeof arguments[0] == "object" ? (Object.assign(c, arguments[0]),
                        c.flags === void 0 && (c.flags = "c"),
                        c.vfs === void 0 && (c.vfs = null),
                        c.filename === void 0 && (c.filename = ":memory:")) : (c.filename = h,
                        c.flags = l,
                        c.vfs = _),
                        c
                    }
                    ;
                    let f = function(...h) {
                        d.apply(this, h)
                    };
                    f.dbCtorHelper = d;
                    let m = {
                        null: 1,
                        number: 2,
                        string: 3,
                        boolean: 4,
                        blob: 5
                    };
                    m.undefined == m.null,
                    s.bigIntEnabled && (m.bigint = m.number);
                    let I = function() {
                        m !== arguments[2] && i(n.SQLITE_MISUSE, "Do not call the Stmt constructor directly. Use DB.prepare()."),
                        this.db = arguments[0],
                        y.set(this, arguments[1]),
                        this.parameterCount = n.sqlite3_bind_parameter_count(this.pointer)
                    }
                      , x = function(h) {
                        return h.pointer || i("DB has been closed."),
                        h
                    }
                      , S = function(h, l) {
                        return (l !== (l | 0) || l < 0 || l >= h.columnCount) && i("Column index", l, "is out of range."),
                        h
                    }
                      , R = function(h, l) {
                        let _ = Object.create(null);
                        switch (_.opt = Object.create(null),
                        l.length) {
                        case 1:
                            typeof l[0] == "string" || p.isSQLableTypedArray(l[0]) || Array.isArray(l[0]) ? _.sql = l[0] : l[0] && typeof l[0] == "object" && (_.opt = l[0],
                            _.sql = _.opt.sql);
                            break;
                        case 2:
                            _.sql = l[0],
                            _.opt = l[1];
                            break;
                        default:
                            i("Invalid argument count for exec().")
                        }
                        _.sql = p.flexibleString(_.sql),
                        typeof _.sql != "string" && i("Missing SQL argument or unsupported SQL value type.");
                        let c = _.opt;
                        switch (c.returnValue) {
                        case "resultRows":
                            c.resultRows || (c.resultRows = []),
                            _.returnVal = ()=>c.resultRows;
                            break;
                        case "saveSql":
                            c.saveSql || (c.saveSql = []),
                            _.returnVal = ()=>c.saveSql;
                            break;
                        case void 0:
                        case "this":
                            _.returnVal = ()=>h;
                            break;
                        default:
                            i("Invalid returnValue value:", c.returnValue)
                        }
                        if (!c.callback && !c.returnValue && c.rowMode !== void 0 && (c.resultRows || (c.resultRows = []),
                        _.returnVal = ()=>c.resultRows),
                        c.callback || c.resultRows)
                            switch (c.rowMode === void 0 ? "array" : c.rowMode) {
                            case "object":
                                _.cbArg = w=>w.get(Object.create(null));
                                break;
                            case "array":
                                _.cbArg = w=>w.get([]);
                                break;
                            case "stmt":
                                Array.isArray(c.resultRows) && i("exec(): invalid rowMode for a resultRows array: must", "be one of 'array', 'object',", "a result column number, or column name reference."),
                                _.cbArg = w=>w;
                                break;
                            default:
                                if (p.isInt32(c.rowMode)) {
                                    _.cbArg = w=>w.get(c.rowMode);
                                    break
                                } else if (typeof c.rowMode == "string" && c.rowMode.length > 1 && c.rowMode[0] === "$") {
                                    let w = c.rowMode.substr(1);
                                    _.cbArg = j=>{
                                        let H = j.get(Object.create(null))[w];
                                        return H === void 0 ? i(n.SQLITE_NOTFOUND, "exec(): unknown result column:", w) : H
                                    }
                                    ;
                                    break
                                }
                                i("Invalid rowMode:", c.rowMode)
                            }
                        return _
                    }
                      , z = (h,l,_,...c)=>{
                        let w = h.prepare(l);
                        try {
                            let j = w.bind(_).step() ? w.get(...c) : void 0;
                            return w.reset(),
                            j
                        } finally {
                            w.finalize()
                        }
                    }
                      , L = (h,l,_,c)=>h.exec({
                        sql: l,
                        bind: _,
                        rowMode: c,
                        returnValue: "resultRows"
                    });
                    f.checkRc = (h,l)=>G(h, l),
                    f.prototype = {
                        isOpen: function() {
                            return !!this.pointer
                        },
                        affirmOpen: function() {
                            return x(this)
                        },
                        close: function() {
                            if (this.pointer) {
                                if (this.onclose && this.onclose.before instanceof Function)
                                    try {
                                        this.onclose.before(this)
                                    } catch {}
                                let h = this.pointer;
                                if (Object.keys(O.get(this)).forEach((l,_)=>{
                                    if (_ && _.pointer)
                                        try {
                                            _.finalize()
                                        } catch {}
                                }
                                ),
                                y.delete(this),
                                O.delete(this),
                                n.sqlite3_close_v2(h),
                                this.onclose && this.onclose.after instanceof Function)
                                    try {
                                        this.onclose.after(this)
                                    } catch {}
                                delete this.filename
                            }
                        },
                        changes: function(h=!1, l=!1) {
                            let _ = x(this).pointer;
                            return h ? l ? n.sqlite3_total_changes64(_) : n.sqlite3_total_changes(_) : l ? n.sqlite3_changes64(_) : n.sqlite3_changes(_)
                        },
                        dbFilename: function(h="main") {
                            return n.sqlite3_db_filename(x(this).pointer, h)
                        },
                        dbName: function(h=0) {
                            return n.sqlite3_db_name(x(this).pointer, h)
                        },
                        dbVfsName: function(h=0) {
                            let l, _ = n.sqlite3_js_db_vfs(x(this).pointer, h);
                            if (_) {
                                let c = new n.sqlite3_vfs(_);
                                try {
                                    l = s.cstrToJs(c.$zName)
                                } finally {
                                    c.dispose()
                                }
                            }
                            return l
                        },
                        prepare: function(h) {
                            x(this);
                            let l = s.pstack.pointer, _, c;
                            try {
                                _ = s.pstack.alloc(8),
                                f.checkRc(this, n.sqlite3_prepare_v2(this.pointer, h, -1, _, null)),
                                c = s.peekPtr(_)
                            } finally {
                                s.pstack.restore(l)
                            }
                            c || i("Cannot prepare empty SQL.");
                            let w = new I(this,c,m);
                            return O.get(this)[c] = w,
                            w
                        },
                        exec: function() {
                            x(this);
                            let h = R(this, arguments);
                            if (!h.sql)
                                return i("exec() requires an SQL string.");
                            let l = h.opt, _ = l.callback, c = Array.isArray(l.resultRows) ? l.resultRows : void 0, w, j = l.bind, H = !!(h.cbArg || l.columnNames || c), se = s.scopedAllocPush(), ee = Array.isArray(l.saveSql) ? l.saveSql : void 0;
                            try {
                                let ie = p.isSQLableTypedArray(h.sql)
                                  , le = ie ? h.sql.byteLength : s.jstrlen(h.sql)
                                  , ae = s.scopedAlloc(2 * s.ptrSizeof + (le + 1))
                                  , ce = ae + s.ptrSizeof
                                  , de = ce + s.ptrSizeof
                                  , we = de + le;
                                for (ie ? s.heap8().set(h.sql, de) : s.jstrcpy(h.sql, s.heap8(), de, le, !1),
                                s.poke(de + le, 0); de && s.peek(de, "i8"); ) {
                                    s.pokePtr([ae, ce], 0),
                                    f.checkRc(this, n.sqlite3_prepare_v3(this.pointer, de, le, 0, ae, ce));
                                    let qe = s.peekPtr(ae);
                                    if (de = s.peekPtr(ce),
                                    le = we - de,
                                    !!qe) {
                                        if (ee && ee.push(n.sqlite3_sql(qe).trim()),
                                        w = new I(this,qe,m),
                                        j && w.parameterCount && (w.bind(j),
                                        j = null),
                                        H && w.columnCount) {
                                            let k = Array.isArray(l.columnNames) ? 0 : 1;
                                            if (H = !1,
                                            h.cbArg || c) {
                                                for (; w.step(); w._lockedByExec = !1) {
                                                    k++ === 0 && w.getColumnNames(l.columnNames),
                                                    w._lockedByExec = !0;
                                                    let C = h.cbArg(w);
                                                    if (c && c.push(C),
                                                    _ && _.call(l, C, w) === !1)
                                                        break
                                                }
                                                w._lockedByExec = !1
                                            }
                                            k === 0 && w.getColumnNames(l.columnNames)
                                        } else
                                            w.step();
                                        w.reset().finalize(),
                                        w = null
                                    }
                                }
                            } finally {
                                s.scopedAllocPop(se),
                                w && (delete w._lockedByExec,
                                w.finalize())
                            }
                            return h.returnVal()
                        },
                        createFunction: function(l, _, c) {
                            let w = C=>C instanceof Function;
                            switch (arguments.length) {
                            case 1:
                                c = l,
                                l = c.name,
                                _ = c.xFunc || 0;
                                break;
                            case 2:
                                w(_) || (c = _,
                                _ = c.xFunc || 0);
                                break;
                            case 3:
                                break;
                            default:
                                break
                            }
                            c || (c = {}),
                            typeof l != "string" && i("Invalid arguments: missing function name.");
                            let j = c.xStep || 0, H = c.xFinal || 0, se = c.xValue || 0, ee = c.xInverse || 0, ie;
                            w(_) ? (ie = !1,
                            (w(j) || w(H)) && i("Ambiguous arguments: scalar or aggregate?"),
                            j = H = null) : w(j) ? (w(H) || i("Missing xFinal() callback for aggregate or window UDF."),
                            _ = null) : w(H) ? i("Missing xStep() callback for aggregate or window UDF.") : i("Missing function-type properties."),
                            ie === !1 ? (w(se) || w(ee)) && i("xValue and xInverse are not permitted for non-window UDFs.") : w(se) ? (w(ee) || i("xInverse must be provided if xValue is."),
                            ie = !0) : w(ee) && i("xValue must be provided if xInverse is.");
                            let le = c.pApp;
                            le != null && (typeof le != "number" || !p.isInt32(le)) && i("Invalid value for pApp property. Must be a legal WASM pointer value.");
                            let ae = c.xDestroy || 0;
                            ae && !w(ae) && i("xDestroy property must be a function.");
                            let ce = 0;
                            B(c, "deterministic") && (ce |= n.SQLITE_DETERMINISTIC),
                            B(c, "directOnly") && (ce |= n.SQLITE_DIRECTONLY),
                            B(c, "innocuous") && (ce |= n.SQLITE_INNOCUOUS),
                            l = l.toLowerCase();
                            let de = _ || j, we = B(c, "arity"), qe = typeof we == "number" ? we : de.length ? de.length - 1 : 0, k;
                            return ie ? k = n.sqlite3_create_window_function(this.pointer, l, qe, n.SQLITE_UTF8 | ce, le || 0, j, H, se, ee, ae) : k = n.sqlite3_create_function_v2(this.pointer, l, qe, n.SQLITE_UTF8 | ce, le || 0, _, j, H, ae),
                            f.checkRc(this, k),
                            this
                        },
                        selectValue: function(h, l, _) {
                            return z(this, h, l, 0, _)
                        },
                        selectValues: function(h, l, _) {
                            let c = this.prepare(h)
                              , w = [];
                            try {
                                for (c.bind(l); c.step(); )
                                    w.push(c.get(0, _));
                                c.reset()
                            } finally {
                                c.finalize()
                            }
                            return w
                        },
                        selectArray: function(h, l) {
                            return z(this, h, l, [])
                        },
                        selectObject: function(h, l) {
                            return z(this, h, l, {})
                        },
                        selectArrays: function(h, l) {
                            return L(this, h, l, "array")
                        },
                        selectObjects: function(h, l) {
                            return L(this, h, l, "object")
                        },
                        openStatementCount: function() {
                            return this.pointer ? Object.keys(O.get(this)).length : 0
                        },
                        transaction: function(h) {
                            let l = "BEGIN";
                            arguments.length > 1 && (/[^a-zA-Z]/.test(arguments[0]) && i(n.SQLITE_MISUSE, "Invalid argument for BEGIN qualifier."),
                            l += " " + arguments[0],
                            h = arguments[1]),
                            x(this).exec(l);
                            try {
                                let _ = h(this);
                                return this.exec("COMMIT"),
                                _
                            } catch (_) {
                                throw this.exec("ROLLBACK"),
                                _
                            }
                        },
                        savepoint: function(h) {
                            x(this).exec("SAVEPOINT oo1");
                            try {
                                let l = h(this);
                                return this.exec("RELEASE oo1"),
                                l
                            } catch (l) {
                                throw this.exec("ROLLBACK to SAVEPOINT oo1; RELEASE SAVEPOINT oo1"),
                                l
                            }
                        },
                        checkRc: function(h) {
                            return G(this, h)
                        }
                    };
                    let $ = function(h) {
                        return h.pointer || i("Stmt has been closed."),
                        h
                    }
                      , u = function(h) {
                        let l = m[h == null ? "null" : typeof h];
                        switch (l) {
                        case m.boolean:
                        case m.null:
                        case m.number:
                        case m.string:
                            return l;
                        case m.bigint:
                            if (s.bigIntEnabled)
                                return l;
                        default:
                            return p.isBindableTypedArray(h) ? m.blob : void 0
                        }
                    }
                      , q = function(h) {
                        return u(h) || i("Unsupported bind() argument type:", typeof h)
                    }
                      , F = function(h, l) {
                        let _ = typeof l == "number" ? l : n.sqlite3_bind_parameter_index(h.pointer, l);
                        return _ === 0 || !p.isInt32(_) ? i("Invalid bind() parameter name: " + l) : (_ < 1 || _ > h.parameterCount) && i("Bind index", l, "is out of range."),
                        _
                    }
                      , D = function(h, l) {
                        return h._lockedByExec && i("Operation is illegal when statement is locked:", l),
                        h
                    }
                      , P = function h(l, _, c, w) {
                        D($(l), "bind()"),
                        h._ || (h._tooBigInt = H=>i("BigInt value is too big to store without precision loss:", H),
                        h._ = {
                            string: function(H, se, ee, ie) {
                                let[le,ae] = s.allocCString(ee, !0);
                                return (ie ? n.sqlite3_bind_blob : n.sqlite3_bind_text)(H.pointer, se, le, ae, n.SQLITE_WASM_DEALLOC)
                            }
                        }),
                        q(w),
                        _ = F(l, _);
                        let j = 0;
                        switch (w == null ? m.null : c) {
                        case m.null:
                            j = n.sqlite3_bind_null(l.pointer, _);
                            break;
                        case m.string:
                            j = h._.string(l, _, w, !1);
                            break;
                        case m.number:
                            {
                                let H;
                                p.isInt32(w) ? H = n.sqlite3_bind_int : typeof w == "bigint" ? p.bigIntFits64(w) ? s.bigIntEnabled ? H = n.sqlite3_bind_int64 : p.bigIntFitsDouble(w) ? (w = Number(w),
                                H = n.sqlite3_bind_double) : h._tooBigInt(w) : h._tooBigInt(w) : (w = Number(w),
                                s.bigIntEnabled && Number.isInteger(w) ? H = n.sqlite3_bind_int64 : H = n.sqlite3_bind_double),
                                j = H(l.pointer, _, w);
                                break
                            }
                        case m.boolean:
                            j = n.sqlite3_bind_int(l.pointer, _, w ? 1 : 0);
                            break;
                        case m.blob:
                            {
                                if (typeof w == "string") {
                                    j = h._.string(l, _, w, !0);
                                    break
                                } else
                                    w instanceof ArrayBuffer ? w = new Uint8Array(w) : p.isBindableTypedArray(w) || i("Binding a value as a blob requires", "that it be a string, Uint8Array, Int8Array, or ArrayBuffer.");
                                let H = s.alloc(w.byteLength || 1);
                                s.heap8().set(w.byteLength ? w : [0], H),
                                j = n.sqlite3_bind_blob(l.pointer, _, H, w.byteLength, n.SQLITE_WASM_DEALLOC);
                                break
                            }
                        default:
                            t.config.warn("Unsupported bind() argument type:", w),
                            i("Unsupported bind() argument type: " + typeof w)
                        }
                        return j && f.checkRc(l.db.pointer, j),
                        l._mayGet = !1,
                        l
                    };
                    I.prototype = {
                        finalize: function() {
                            if (this.pointer) {
                                D(this, "finalize()");
                                let h = n.sqlite3_finalize(this.pointer);
                                return delete O.get(this.db)[this.pointer],
                                y.delete(this),
                                delete this._mayGet,
                                delete this.parameterCount,
                                delete this._lockedByExec,
                                delete this.db,
                                h
                            }
                        },
                        clearBindings: function() {
                            return D($(this), "clearBindings()"),
                            n.sqlite3_clear_bindings(this.pointer),
                            this._mayGet = !1,
                            this
                        },
                        reset: function(h) {
                            D(this, "reset()"),
                            h && this.clearBindings();
                            let l = n.sqlite3_reset($(this).pointer);
                            return this._mayGet = !1,
                            G(this.db, l),
                            this
                        },
                        bind: function() {
                            $(this);
                            let h, l;
                            switch (arguments.length) {
                            case 1:
                                h = 1,
                                l = arguments[0];
                                break;
                            case 2:
                                h = arguments[0],
                                l = arguments[1];
                                break;
                            default:
                                i("Invalid bind() arguments.")
                            }
                            return l === void 0 ? this : (this.parameterCount || i("This statement has no bindable parameters."),
                            this._mayGet = !1,
                            l === null ? P(this, h, m.null, l) : Array.isArray(l) ? (arguments.length !== 1 && i("When binding an array, an index argument is not permitted."),
                            l.forEach((_,c)=>P(this, c + 1, q(_), _)),
                            this) : (l instanceof ArrayBuffer && (l = new Uint8Array(l)),
                            typeof l == "object" && !p.isBindableTypedArray(l) ? (arguments.length !== 1 && i("When binding an object, an index argument is not permitted."),
                            Object.keys(l).forEach(_=>P(this, _, q(l[_]), l[_])),
                            this) : P(this, h, q(l), l)))
                        },
                        bindAsBlob: function(h, l) {
                            $(this),
                            arguments.length === 1 && (l = h,
                            h = 1);
                            let _ = q(l);
                            return m.string !== _ && m.blob !== _ && m.null !== _ && i("Invalid value type for bindAsBlob()"),
                            P(this, h, m.blob, l)
                        },
                        step: function() {
                            D(this, "step()");
                            let h = n.sqlite3_step($(this).pointer);
                            switch (h) {
                            case n.SQLITE_DONE:
                                return this._mayGet = !1;
                            case n.SQLITE_ROW:
                                return this._mayGet = !0;
                            default:
                                this._mayGet = !1,
                                t.config.warn("sqlite3_step() rc=", h, n.sqlite3_js_rc_str(h), "SQL =", n.sqlite3_sql(this.pointer)),
                                f.checkRc(this.db.pointer, h)
                            }
                        },
                        stepReset: function() {
                            return this.step(),
                            this.reset()
                        },
                        stepFinalize: function() {
                            try {
                                let h = this.step();
                                return this.reset(),
                                h
                            } finally {
                                try {
                                    this.finalize()
                                } catch {}
                            }
                        },
                        get: function(h, l) {
                            if ($(this)._mayGet || i("Stmt.step() has not (recently) returned true."),
                            Array.isArray(h)) {
                                let _ = 0
                                  , c = this.columnCount;
                                for (; _ < c; )
                                    h[_] = this.get(_++);
                                return h
                            } else if (h && typeof h == "object") {
                                let _ = 0
                                  , c = this.columnCount;
                                for (; _ < c; )
                                    h[n.sqlite3_column_name(this.pointer, _)] = this.get(_++);
                                return h
                            }
                            switch (S(this, h),
                            l === void 0 ? n.sqlite3_column_type(this.pointer, h) : l) {
                            case n.SQLITE_NULL:
                                return null;
                            case n.SQLITE_INTEGER:
                                if (s.bigIntEnabled) {
                                    let _ = n.sqlite3_column_int64(this.pointer, h);
                                    return _ >= Number.MIN_SAFE_INTEGER && _ <= Number.MAX_SAFE_INTEGER ? Number(_).valueOf() : _
                                } else {
                                    let _ = n.sqlite3_column_double(this.pointer, h);
                                    return (_ > Number.MAX_SAFE_INTEGER || _ < Number.MIN_SAFE_INTEGER) && i("Integer is out of range for JS integer range: " + _),
                                    p.isInt32(_) ? _ | 0 : _
                                }
                            case n.SQLITE_FLOAT:
                                return n.sqlite3_column_double(this.pointer, h);
                            case n.SQLITE_TEXT:
                                return n.sqlite3_column_text(this.pointer, h);
                            case n.SQLITE_BLOB:
                                {
                                    let _ = n.sqlite3_column_bytes(this.pointer, h)
                                      , c = n.sqlite3_column_blob(this.pointer, h)
                                      , w = new Uint8Array(_);
                                    return _ && w.set(s.heap8u().slice(c, c + _), 0),
                                    _ && this.db._blobXfer instanceof Array && this.db._blobXfer.push(w.buffer),
                                    w
                                }
                            default:
                                i("Don't know how to translate", "type of result column #" + h + ".")
                            }
                            i("Not reached.")
                        },
                        getInt: function(h) {
                            return this.get(h, n.SQLITE_INTEGER)
                        },
                        getFloat: function(h) {
                            return this.get(h, n.SQLITE_FLOAT)
                        },
                        getString: function(h) {
                            return this.get(h, n.SQLITE_TEXT)
                        },
                        getBlob: function(h) {
                            return this.get(h, n.SQLITE_BLOB)
                        },
                        getJSON: function(h) {
                            let l = this.get(h, n.SQLITE_STRING);
                            return l === null ? l : JSON.parse(l)
                        },
                        getColumnName: function(h) {
                            return n.sqlite3_column_name(S($(this), h).pointer, h)
                        },
                        getColumnNames: function(h=[]) {
                            S($(this), 0);
                            let l = this.columnCount;
                            for (let _ = 0; _ < l; ++_)
                                h.push(n.sqlite3_column_name(this.pointer, _));
                            return h
                        },
                        getParamIndex: function(h) {
                            return $(this).parameterCount ? n.sqlite3_bind_parameter_index(this.pointer, h) : void 0
                        }
                    };
                    {
                        let h = {
                            enumerable: !0,
                            get: function() {
                                return y.get(this)
                            },
                            set: ()=>i("The pointer property is read-only.")
                        };
                        Object.defineProperty(I.prototype, "pointer", h),
                        Object.defineProperty(f.prototype, "pointer", h)
                    }
                    if (Object.defineProperty(I.prototype, "columnCount", {
                        enumerable: !1,
                        get: function() {
                            return n.sqlite3_column_count(this.pointer)
                        },
                        set: ()=>i("The columnCount property is read-only.")
                    }),
                    t.oo1 = {
                        DB: f,
                        Stmt: I
                    },
                    p.isUIThread()) {
                        t.oo1.JsStorageDb = function(l="session") {
                            l !== "session" && l !== "local" && i("JsStorageDb db name must be one of 'session' or 'local'."),
                            d.call(this, {
                                filename: l,
                                flags: "c",
                                vfs: "kvvfs"
                            })
                        }
                        ;
                        let h = t.oo1.JsStorageDb;
                        h.prototype = Object.create(f.prototype),
                        h.clearStorage = n.sqlite3_js_kvvfs_clear,
                        h.prototype.clearStorage = function() {
                            return h.clearStorage(x(this).filename)
                        }
                        ,
                        h.storageSize = n.sqlite3_js_kvvfs_size,
                        h.prototype.storageSize = function() {
                            return h.storageSize(x(this).filename)
                        }
                    }
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    t.initWorker1API = function() {
                        "use strict";
                        let r = (...d)=>{
                            throw new Error(d.join(" "))
                        }
                        ;
                        globalThis.WorkerGlobalScope instanceof Function || r("initWorker1API() must be run from a Worker thread.");
                        let i = this.sqlite3 || r("Missing this.sqlite3 object.")
                          , n = i.oo1.DB
                          , s = function(d) {
                            let f = p.idMap.get(d);
                            return f || (f = "db#" + ++p.idSeq + "@" + d.pointer,
                            p.idMap.set(d, f),
                            f)
                        }
                          , p = {
                            dbList: [],
                            idSeq: 0,
                            idMap: new WeakMap,
                            xfer: [],
                            open: function(d) {
                                let f = new n(d);
                                return this.dbs[s(f)] = f,
                                this.dbList.indexOf(f) < 0 && this.dbList.push(f),
                                f
                            },
                            close: function(d, f) {
                                if (d) {
                                    delete this.dbs[s(d)];
                                    let m = d.filename
                                      , I = i.wasm.sqlite3_wasm_db_vfs(d.pointer, 0);
                                    d.close();
                                    let x = this.dbList.indexOf(d);
                                    x >= 0 && this.dbList.splice(x, 1),
                                    f && m && I && i.wasm.sqlite3_wasm_vfs_unlink(I, m)
                                }
                            },
                            post: function(d, f) {
                                f && f.length ? (globalThis.postMessage(d, Array.from(f)),
                                f.length = 0) : globalThis.postMessage(d)
                            },
                            dbs: Object.create(null),
                            getDb: function(d, f=!0) {
                                return this.dbs[d] || (f ? r("Unknown (or closed) DB ID:", d) : void 0)
                            }
                        }
                          , y = function(d=p.dbList[0]) {
                            return d && d.pointer ? d : r("DB is not opened.")
                        }
                          , O = function(d, f=!0) {
                            let m = p.getDb(d.dbId, !1) || p.dbList[0];
                            return f ? y(m) : m
                        }
                          , B = function() {
                            return p.dbList[0] && s(p.dbList[0])
                        }
                          , G = function(d) {
                            let f = /^file:.+(vfs=(\w+))/.exec(d);
                            return i.capi.sqlite3_vfs_find(f ? f[2] : 0)
                        }
                          , J = d=>d === "" || d[0] === ":"
                          , Y = {
                            open: function(d) {
                                let f = Object.create(null)
                                  , m = d.args || Object.create(null);
                                m.simulateError && r("Throwing because of simulateError flag.");
                                let I = Object.create(null), x, S;
                                if (f.vfs = m.vfs,
                                J(m.filename) ? f.filename = m.filename || "" : (f.filename = m.filename,
                                x = m.byteArray,
                                x && (S = G(m.filename))),
                                S) {
                                    let z;
                                    try {
                                        z = i.wasm.allocFromTypedArray(x);
                                        let L = i.wasm.sqlite3_wasm_vfs_create_file(S, f.filename, z, x.byteLength);
                                        L && i.SQLite3Error.toss(L)
                                    } catch (L) {
                                        throw new i.SQLite3Error(L.name + " creating " + m.filename + ": " + L.message,{
                                            cause: L
                                        })
                                    } finally {
                                        z && i.wasm.dealloc(z)
                                    }
                                }
                                let R = p.open(f);
                                return I.filename = R.filename,
                                I.persistent = !!i.capi.sqlite3_js_db_uses_vfs(R.pointer, "opfs"),
                                I.dbId = s(R),
                                I.vfs = R.dbVfsName(),
                                I
                            },
                            close: function(d) {
                                let f = O(d, !1)
                                  , m = {
                                    filename: f && f.filename
                                };
                                if (f) {
                                    let I = d.args && typeof d.args == "object" ? !!d.args.unlink : !1;
                                    p.close(f, I)
                                }
                                return m
                            },
                            exec: function(d) {
                                let f = typeof d.args == "string" ? {
                                    sql: d.args
                                } : d.args || Object.create(null);
                                f.rowMode === "stmt" ? r("Invalid rowMode for 'exec': stmt mode", "does not work in the Worker API.") : f.sql || r("'exec' requires input SQL.");
                                let m = O(d);
                                (f.callback || Array.isArray(f.resultRows)) && (m._blobXfer = p.xfer);
                                let I = f.callback
                                  , x = 0
                                  , S = !!f.columnNames;
                                typeof I == "string" && (S || (f.columnNames = []),
                                f.callback = function(R, z) {
                                    p.post({
                                        type: I,
                                        columnNames: f.columnNames,
                                        rowNumber: ++x,
                                        row: R
                                    }, p.xfer)
                                }
                                );
                                try {
                                    let R = f.countChanges ? m.changes(!0, f.countChanges === 64) : void 0;
                                    m.exec(f),
                                    R !== void 0 && (f.changeCount = m.changes(!0, f.countChanges === 64) - R),
                                    f.callback instanceof Function && (f.callback = I,
                                    p.post({
                                        type: I,
                                        columnNames: f.columnNames,
                                        rowNumber: null,
                                        row: void 0
                                    }))
                                } finally {
                                    delete m._blobXfer,
                                    f.callback && (f.callback = I)
                                }
                                return f
                            },
                            "config-get": function() {
                                let d = Object.create(null)
                                  , f = i.config;
                                return ["bigIntEnabled"].forEach(function(m) {
                                    Object.getOwnPropertyDescriptor(f, m) && (d[m] = f[m])
                                }),
                                d.version = i.version,
                                d.vfsList = i.capi.sqlite3_js_vfs_list(),
                                d.opfsEnabled = !!i.opfs,
                                d
                            },
                            export: function(d) {
                                let f = O(d)
                                  , m = {
                                    byteArray: i.capi.sqlite3_js_db_export(f.pointer),
                                    filename: f.filename,
                                    mimetype: "application/x-sqlite3"
                                };
                                return p.xfer.push(m.byteArray.buffer),
                                m
                            },
                            toss: function(d) {
                                r("Testing worker exception")
                            },
                            "opfs-tree": async function(d) {
                                return i.opfs || r("OPFS support is unavailable."),
                                await i.opfs.treeList()
                            }
                        };
                        globalThis.onmessage = async function(d) {
                            d = d.data;
                            let f, m = d.dbId, I = d.type, x = performance.now();
                            try {
                                Y.hasOwnProperty(I) && Y[I]instanceof Function ? f = await Y[I](d) : r("Unknown db worker message type:", d.type)
                            } catch (S) {
                                I = "error",
                                f = {
                                    operation: d.type,
                                    message: S.message,
                                    errorClass: S.name,
                                    input: d
                                },
                                S.stack && (f.stack = typeof S.stack == "string" ? S.stack.split(/\n\s*/) : S.stack)
                            }
                            m || (m = f.dbId || B()),
                            p.post({
                                type: I,
                                dbId: m,
                                messageId: d.messageId,
                                workerReceivedTime: x,
                                workerRespondTime: performance.now(),
                                departureTime: d.departureTime,
                                result: f
                            }, p.xfer)
                        }
                        ,
                        globalThis.postMessage({
                            type: "sqlite3-api",
                            result: "worker1-ready"
                        })
                    }
                    .bind({
                        sqlite3: t
                    })
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = t.wasm
                      , i = t.capi
                      , n = t.util.toss3
                      , s = Object.create(null)
                      , p = Object.create(null)
                      , y = t.StructBinder;
                    t.vfs = s,
                    t.vtab = p;
                    let O = i.sqlite3_index_info;
                    O.prototype.nthConstraint = function(d, f=!1) {
                        if (d < 0 || d >= this.$nConstraint)
                            return !1;
                        let m = this.$aConstraint + O.sqlite3_index_constraint.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_constraint(m)
                    }
                    ,
                    O.prototype.nthConstraintUsage = function(d, f=!1) {
                        if (d < 0 || d >= this.$nConstraint)
                            return !1;
                        let m = this.$aConstraintUsage + O.sqlite3_index_constraint_usage.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_constraint_usage(m)
                    }
                    ,
                    O.prototype.nthOrderBy = function(d, f=!1) {
                        if (d < 0 || d >= this.$nOrderBy)
                            return !1;
                        let m = this.$aOrderBy + O.sqlite3_index_orderby.structInfo.sizeof * d;
                        return f ? m : new O.sqlite3_index_orderby(m)
                    }
                    ;
                    let B = function d(f, m, I, x=d.installMethodArgcCheck) {
                        if (f instanceof y.StructType ? !(I instanceof Function) && !r.isPtr(I) && n("Usage errror: expecting a Function or WASM pointer to one.") : n("Usage error: target object is-not-a StructType."),
                        arguments.length === 1)
                            return (L,$)=>d(f, L, $, x);
                        d.argcProxy || (d.argcProxy = function(L, $, u, q) {
                            return function(...F) {
                                return u.length !== arguments.length && n("Argument mismatch for", L.structInfo.name + "::" + $ + ": Native signature is:", q),
                                u.apply(this, F)
                            }
                        }
                        ,
                        d.removeFuncList = function() {
                            this.ondispose.__removeFuncList && (this.ondispose.__removeFuncList.forEach((L,$)=>{
                                if (typeof L == "number")
                                    try {
                                        r.uninstallFunction(L)
                                    } catch {}
                            }
                            ),
                            delete this.ondispose.__removeFuncList)
                        }
                        );
                        let S = f.memberSignature(m);
                        S.length < 2 && n("Member", m, "does not have a function pointer signature:", S);
                        let R = f.memberKey(m)
                          , z = x && !r.isPtr(I) ? d.argcProxy(f, R, I, S) : I;
                        if (r.isPtr(z))
                            z && !r.functionEntry(z) && n("Pointer", z, "is not a WASM function table entry."),
                            f[R] = z;
                        else {
                            let L = r.installFunction(z, f.memberSignature(m, !0));
                            f[R] = L,
                            (!f.ondispose || !f.ondispose.__removeFuncList) && (f.addOnDispose("ondispose.__removeFuncList handler", d.removeFuncList),
                            f.ondispose.__removeFuncList = []),
                            f.ondispose.__removeFuncList.push(R, L)
                        }
                        return (L,$)=>d(f, L, $, x)
                    };
                    B.installMethodArgcCheck = !1;
                    let G = function(d, f, m=B.installMethodArgcCheck) {
                        let I = new Map;
                        for (let x of Object.keys(f)) {
                            let S = f[x]
                              , R = I.get(S);
                            if (R) {
                                let z = d.memberKey(x);
                                d[z] = d[d.memberKey(R)]
                            } else
                                B(d, x, S, m),
                                I.set(S, x)
                        }
                        return d
                    };
                    y.StructType.prototype.installMethod = function(f, m, I=B.installMethodArgcCheck) {
                        return arguments.length < 3 && f && typeof f == "object" ? G(this, ...arguments) : B(this, ...arguments)
                    }
                    ,
                    y.StructType.prototype.installMethods = function(d, f=B.installMethodArgcCheck) {
                        return G(this, d, f)
                    }
                    ,
                    i.sqlite3_vfs.prototype.registerVfs = function(d=!1) {
                        this instanceof t.capi.sqlite3_vfs || n("Expecting a sqlite3_vfs-type argument.");
                        let f = i.sqlite3_vfs_register(this, d ? 1 : 0);
                        return f && n("sqlite3_vfs_register(", this, ") failed with rc", f),
                        this.pointer !== i.sqlite3_vfs_find(this.$zName) && n("BUG: sqlite3_vfs_find(vfs.$zName) failed for just-installed VFS", this),
                        this
                    }
                    ,
                    s.installVfs = function(d) {
                        let f = 0
                          , m = ["io", "vfs"];
                        for (let I of m) {
                            let x = d[I];
                            x && (++f,
                            G(x.struct, x.methods, !!x.applyArgcCheck),
                            I === "vfs" && (!x.struct.$zName && typeof x.name == "string" && x.struct.addOnDispose(x.struct.$zName = r.allocCString(x.name)),
                            x.struct.registerVfs(!!x.asDefault)))
                        }
                        return f || n("Misuse: installVfs() options object requires at least", "one of:", m),
                        this
                    }
                    ;
                    let J = function(d, f) {
                        return function(m, I=!1) {
                            if (arguments.length === 0 && (m = new f),
                            m instanceof f)
                                return this.set(m.pointer, m),
                                m;
                            r.isPtr(m) || t.SQLite3Error.toss("Invalid argument to", d + "()");
                            let x = this.get(m);
                            return I && this.delete(m),
                            x
                        }
                        .bind(new Map)
                    }
                      , Y = function(d, f) {
                        let m = J(d, f);
                        return Object.assign(Object.create(null), {
                            StructType: f,
                            create: I=>{
                                let x = m();
                                return r.pokePtr(I, x.pointer),
                                x
                            }
                            ,
                            get: I=>m(I),
                            unget: I=>m(I, !0),
                            dispose: I=>{
                                let x = m(I, !0);
                                x && x.dispose()
                            }
                        })
                    };
                    p.xVtab = Y("xVtab", i.sqlite3_vtab),
                    p.xCursor = Y("xCursor", i.sqlite3_vtab_cursor),
                    p.xIndexInfo = d=>new i.sqlite3_index_info(d),
                    p.xError = function d(f, m, I) {
                        if (d.errorReporter instanceof Function)
                            try {
                                d.errorReporter("sqlite3_module::" + f + "(): " + m.message)
                            } catch {}
                        let x;
                        return m instanceof t.WasmAllocError ? x = i.SQLITE_NOMEM : arguments.length > 2 ? x = I : m instanceof t.SQLite3Error && (x = m.resultCode),
                        x || i.SQLITE_ERROR
                    }
                    ,
                    p.xError.errorReporter = console.error.bind(console),
                    p.xRowid = (d,f)=>r.poke(d, f, "i64"),
                    p.setupModule = function(d) {
                        let f = !1
                          , m = this instanceof i.sqlite3_module ? this : d.struct || (f = new i.sqlite3_module);
                        try {
                            let I = d.methods || n("Missing 'methods' object.");
                            for (let x of Object.entries({
                                xConnect: "xCreate",
                                xDisconnect: "xDestroy"
                            })) {
                                let S = x[0]
                                  , R = x[1];
                                I[S] === !0 ? I[S] = I[R] : I[R] === !0 && (I[R] = I[S])
                            }
                            if (d.catchExceptions) {
                                let x = function(z, L) {
                                    return ["xConnect", "xCreate"].indexOf(z) >= 0 ? function($, u, q, F, D, P) {
                                        try {
                                            return L(...arguments) || 0
                                        } catch (h) {
                                            return h instanceof t.WasmAllocError || (r.dealloc(r.peekPtr(P)),
                                            r.pokePtr(P, r.allocCString(h.message))),
                                            p.xError(z, h)
                                        }
                                    }
                                    : function(...$) {
                                        try {
                                            return L(...$) || 0
                                        } catch (u) {
                                            return p.xError(z, u)
                                        }
                                    }
                                }
                                  , S = ["xCreate", "xConnect", "xBestIndex", "xDisconnect", "xDestroy", "xOpen", "xClose", "xFilter", "xNext", "xEof", "xColumn", "xRowid", "xUpdate", "xBegin", "xSync", "xCommit", "xRollback", "xFindFunction", "xRename", "xSavepoint", "xRelease", "xRollbackTo", "xShadowName"]
                                  , R = Object.create(null);
                                for (let z of S) {
                                    let L = I[z];
                                    if (L instanceof Function)
                                        z === "xConnect" && I.xCreate === L ? R[z] = I.xCreate : z === "xCreate" && I.xConnect === L ? R[z] = I.xConnect : R[z] = x(z, L);
                                    else
                                        continue
                                }
                                G(m, R, !1)
                            } else
                                G(m, I, !!d.applyArgcCheck);
                            if (m.$iVersion === 0) {
                                let x;
                                typeof d.iVersion == "number" ? x = d.iVersion : m.$xShadowName ? x = 3 : m.$xSavePoint || m.$xRelease || m.$xRollbackTo ? x = 2 : x = 1,
                                m.$iVersion = x
                            }
                        } catch (I) {
                            throw f && f.dispose(),
                            I
                        }
                        return m
                    }
                    ,
                    i.sqlite3_module.prototype.setupModule = function(d) {
                        return p.setupModule.call(this, d)
                    }
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    let r = function i(n) {
                        if (!globalThis.SharedArrayBuffer || !globalThis.Atomics)
                            return Promise.reject(new Error("Cannot install OPFS: Missing SharedArrayBuffer and/or Atomics. The server must emit the COOP/COEP response headers to enable those. See https://sqlite.org/wasm/doc/trunk/persistence.md#coop-coep"));
                        if (typeof WorkerGlobalScope > "u")
                            return Promise.reject(new Error("The OPFS sqlite3_vfs cannot run in the main thread because it requires Atomics.wait()."));
                        if (!globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle || !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle || !navigator?.storage?.getDirectory)
                            return Promise.reject(new Error("Missing required OPFS APIs."));
                        (!n || typeof n != "object") && (n = Object.create(null));
                        let s = new URL(globalThis.location.href).searchParams;
                        return s.has("opfs-disable") ? Promise.resolve(t) : (n.verbose === void 0 && (n.verbose = s.has("opfs-verbose") ? +s.get("opfs-verbose") || 2 : 1),
                        n.sanityChecks === void 0 && (n.sanityChecks = s.has("opfs-sanity-check")),
                        n.proxyUri === void 0 && (n.proxyUri = i.defaultProxyUri),
                        typeof n.proxyUri == "function" && (n.proxyUri = n.proxyUri()),
                        new Promise(function(y, O) {
                            let B = [t.config.error, t.config.warn, t.config.log]
                              , G = (k,...C)=>{
                                n.verbose > k && B[k]("OPFS syncer:", ...C)
                            }
                              , J = (...k)=>G(2, ...k)
                              , Y = (...k)=>G(1, ...k)
                              , d = (...k)=>G(0, ...k)
                              , f = t.util.toss
                              , m = t.capi
                              , I = t.util
                              , x = t.wasm
                              , S = m.sqlite3_vfs
                              , R = m.sqlite3_file
                              , z = m.sqlite3_io_methods
                              , L = Object.create(null)
                              , $ = ()=>globalThis.FileSystemHandle && globalThis.FileSystemDirectoryHandle && globalThis.FileSystemFileHandle && globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle && navigator?.storage?.getDirectory;
                            L.metrics = {
                                dump: function() {
                                    let k, C = 0, N = 0, U = 0;
                                    for (k in c.opIds) {
                                        let W = w[k];
                                        C += W.count,
                                        N += W.time,
                                        U += W.wait,
                                        W.avgTime = W.count && W.time ? W.time / W.count : 0,
                                        W.avgWait = W.count && W.wait ? W.wait / W.count : 0
                                    }
                                    t.config.log(globalThis.location.href, "metrics for", globalThis.location.href, ":", w, `
Total of`, C, "op(s) for", N, "ms (incl. " + U + " ms of waiting on the async side)"),
                                    t.config.log("Serialization metrics:", w.s11n),
                                    h.postMessage({
                                        type: "opfs-async-metrics"
                                    })
                                },
                                reset: function() {
                                    let k, C = U=>U.count = U.time = U.wait = 0;
                                    for (k in c.opIds)
                                        C(w[k] = Object.create(null));
                                    let N = w.s11n = Object.create(null);
                                    N = N.serialize = Object.create(null),
                                    N.count = N.time = 0,
                                    N = w.s11n.deserialize = Object.create(null),
                                    N.count = N.time = 0
                                }
                            };
                            let u = new z, q = new S().addOnDispose(()=>u.dispose()), F, D = k=>(F = !0,
                            q.dispose(),
                            O(k)), P = ()=>(F = !1,
                            y(t)), h = new Worker(n.proxyUri);
                            setTimeout(()=>{
                                F === void 0 && D(new Error("Timeout while waiting for OPFS async proxy worker."))
                            }
                            , 4e3),
                            h._originalOnError = h.onerror,
                            h.onerror = function(k) {
                                d("Error initializing OPFS asyncer:", k),
                                D(new Error("Loading OPFS async Worker failed for unknown reasons."))
                            }
                            ;
                            let l = m.sqlite3_vfs_find(null)
                              , _ = l ? new S(l) : null;
                            u.$iVersion = 1,
                            q.$iVersion = 2,
                            q.$szOsFile = m.sqlite3_file.structInfo.sizeof,
                            q.$mxPathname = 1024,
                            q.$zName = x.allocCString("opfs"),
                            q.$xDlOpen = q.$xDlError = q.$xDlSym = q.$xDlClose = null,
                            q.addOnDispose("$zName", q.$zName, "cleanup default VFS wrapper", ()=>_ ? _.dispose() : null);
                            let c = Object.create(null);
                            c.verbose = n.verbose,
                            c.littleEndian = (()=>{
                                let k = new ArrayBuffer(2);
                                return new DataView(k).setInt16(0, 256, !0),
                                new Int16Array(k)[0] === 256
                            }
                            )(),
                            c.asyncIdleWaitTime = 150,
                            c.asyncS11nExceptions = 1,
                            c.fileBufferSize = 1024 * 64,
                            c.sabS11nOffset = c.fileBufferSize,
                            c.sabS11nSize = q.$mxPathname * 2,
                            c.sabIO = new SharedArrayBuffer(c.fileBufferSize + c.sabS11nSize),
                            c.opIds = Object.create(null);
                            let w = Object.create(null);
                            {
                                let k = 0;
                                c.opIds.whichOp = k++,
                                c.opIds.rc = k++,
                                c.opIds.xAccess = k++,
                                c.opIds.xClose = k++,
                                c.opIds.xDelete = k++,
                                c.opIds.xDeleteNoWait = k++,
                                c.opIds.xFileSize = k++,
                                c.opIds.xLock = k++,
                                c.opIds.xOpen = k++,
                                c.opIds.xRead = k++,
                                c.opIds.xSleep = k++,
                                c.opIds.xSync = k++,
                                c.opIds.xTruncate = k++,
                                c.opIds.xUnlock = k++,
                                c.opIds.xWrite = k++,
                                c.opIds.mkdir = k++,
                                c.opIds["opfs-async-metrics"] = k++,
                                c.opIds["opfs-async-shutdown"] = k++,
                                c.opIds.retry = k++,
                                c.sabOP = new SharedArrayBuffer(k * 4),
                                L.metrics.reset()
                            }
                            c.sq3Codes = Object.create(null),
                            ["SQLITE_ACCESS_EXISTS", "SQLITE_ACCESS_READWRITE", "SQLITE_BUSY", "SQLITE_ERROR", "SQLITE_IOERR", "SQLITE_IOERR_ACCESS", "SQLITE_IOERR_CLOSE", "SQLITE_IOERR_DELETE", "SQLITE_IOERR_FSYNC", "SQLITE_IOERR_LOCK", "SQLITE_IOERR_READ", "SQLITE_IOERR_SHORT_READ", "SQLITE_IOERR_TRUNCATE", "SQLITE_IOERR_UNLOCK", "SQLITE_IOERR_WRITE", "SQLITE_LOCK_EXCLUSIVE", "SQLITE_LOCK_NONE", "SQLITE_LOCK_PENDING", "SQLITE_LOCK_RESERVED", "SQLITE_LOCK_SHARED", "SQLITE_LOCKED", "SQLITE_MISUSE", "SQLITE_NOTFOUND", "SQLITE_OPEN_CREATE", "SQLITE_OPEN_DELETEONCLOSE", "SQLITE_OPEN_MAIN_DB", "SQLITE_OPEN_READONLY"].forEach(k=>{
                                (c.sq3Codes[k] = m[k]) === void 0 && f("Maintenance required: not found:", k)
                            }
                            ),
                            c.opfsFlags = Object.assign(Object.create(null), {
                                OPFS_UNLOCK_ASAP: 1,
                                defaultUnlockAsap: !1
                            });
                            let j = (k,...C)=>{
                                let N = c.opIds[k] || f("Invalid op ID:", k);
                                c.s11n.serialize(...C),
                                Atomics.store(c.sabOPView, c.opIds.rc, -1),
                                Atomics.store(c.sabOPView, c.opIds.whichOp, N),
                                Atomics.notify(c.sabOPView, c.opIds.whichOp);
                                let U = performance.now();
                                Atomics.wait(c.sabOPView, c.opIds.rc, -1);
                                let W = Atomics.load(c.sabOPView, c.opIds.rc);
                                if (w[k].wait += performance.now() - U,
                                W && c.asyncS11nExceptions) {
                                    let Z = c.s11n.deserialize();
                                    Z && d(k + "() async error:", ...Z)
                                }
                                return W
                            }
                            ;
                            L.debug = {
                                asyncShutdown: ()=>{
                                    Y("Shutting down OPFS async listener. The OPFS VFS will no longer work."),
                                    j("opfs-async-shutdown")
                                }
                                ,
                                asyncRestart: ()=>{
                                    Y("Attempting to restart OPFS VFS async listener. Might work, might not."),
                                    h.postMessage({
                                        type: "opfs-async-restart"
                                    })
                                }
                            };
                            let H = ()=>{
                                if (c.s11n)
                                    return c.s11n;
                                let k = new TextDecoder
                                  , C = new TextEncoder("utf-8")
                                  , N = new Uint8Array(c.sabIO,c.sabS11nOffset,c.sabS11nSize)
                                  , U = new DataView(c.sabIO,c.sabS11nOffset,c.sabS11nSize);
                                c.s11n = Object.create(null);
                                let W = Object.create(null);
                                W.number = {
                                    id: 1,
                                    size: 8,
                                    getter: "getFloat64",
                                    setter: "setFloat64"
                                },
                                W.bigint = {
                                    id: 2,
                                    size: 8,
                                    getter: "getBigInt64",
                                    setter: "setBigInt64"
                                },
                                W.boolean = {
                                    id: 3,
                                    size: 4,
                                    getter: "getInt32",
                                    setter: "setInt32"
                                },
                                W.string = {
                                    id: 4
                                };
                                let Z = V=>W[typeof V] || f("Maintenance required: this value type cannot be serialized.", V)
                                  , re = V=>{
                                    switch (V) {
                                    case W.number.id:
                                        return W.number;
                                    case W.bigint.id:
                                        return W.bigint;
                                    case W.boolean.id:
                                        return W.boolean;
                                    case W.string.id:
                                        return W.string;
                                    default:
                                        f("Invalid type ID:", V)
                                    }
                                }
                                ;
                                return c.s11n.deserialize = function(V=!1) {
                                    ++w.s11n.deserialize.count;
                                    let ye = performance.now()
                                      , ue = N[0]
                                      , E = ue ? [] : null;
                                    if (ue) {
                                        let g = [], A = 1, T, M, Q;
                                        for (T = 0; T < ue; ++T,
                                        ++A)
                                            g.push(re(N[A]));
                                        for (T = 0; T < ue; ++T) {
                                            let X = g[T];
                                            X.getter ? (Q = U[X.getter](A, c.littleEndian),
                                            A += X.size) : (M = U.getInt32(A, c.littleEndian),
                                            A += 4,
                                            Q = k.decode(N.slice(A, A + M)),
                                            A += M),
                                            E.push(Q)
                                        }
                                    }
                                    return V && (N[0] = 0),
                                    w.s11n.deserialize.time += performance.now() - ye,
                                    E
                                }
                                ,
                                c.s11n.serialize = function(...V) {
                                    let ye = performance.now();
                                    if (++w.s11n.serialize.count,
                                    V.length) {
                                        let ue = []
                                          , E = 0
                                          , g = 1;
                                        for (N[0] = V.length & 255; E < V.length; ++E,
                                        ++g)
                                            ue.push(Z(V[E])),
                                            N[g] = ue[E].id;
                                        for (E = 0; E < V.length; ++E) {
                                            let A = ue[E];
                                            if (A.setter)
                                                U[A.setter](g, V[E], c.littleEndian),
                                                g += A.size;
                                            else {
                                                let T = C.encode(V[E]);
                                                U.setInt32(g, T.byteLength, c.littleEndian),
                                                g += 4,
                                                N.set(T, g),
                                                g += T.byteLength
                                            }
                                        }
                                    } else
                                        N[0] = 0;
                                    w.s11n.serialize.time += performance.now() - ye
                                }
                                ,
                                c.s11n
                            }
                              , se = function k(C=16) {
                                k._chars || (k._chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012346789",
                                k._n = k._chars.length);
                                let N = []
                                  , U = 0;
                                for (; U < C; ++U) {
                                    let W = Math.random() * (k._n * 64) % k._n | 0;
                                    N[U] = k._chars[W]
                                }
                                return N.join("")
                            }
                              , ee = Object.create(null)
                              , ie = Object.create(null);
                            ie.op = void 0,
                            ie.start = void 0;
                            let le = k=>{
                                ie.start = performance.now(),
                                ie.op = k,
                                ++w[k].count
                            }
                              , ae = ()=>w[ie.op].time += performance.now() - ie.start
                              , ce = {
                                xCheckReservedLock: function(k, C) {
                                    let N = ee[k];
                                    return x.poke(C, N.lockType ? 1 : 0, "i32"),
                                    0
                                },
                                xClose: function(k) {
                                    le("xClose");
                                    let C = 0
                                      , N = ee[k];
                                    return N && (delete ee[k],
                                    C = j("xClose", k),
                                    N.sq3File && N.sq3File.dispose()),
                                    ae(),
                                    C
                                },
                                xDeviceCharacteristics: function(k) {
                                    return m.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
                                },
                                xFileControl: function(k, C, N) {
                                    return m.SQLITE_NOTFOUND
                                },
                                xFileSize: function(k, C) {
                                    le("xFileSize");
                                    let N = j("xFileSize", k);
                                    if (N == 0)
                                        try {
                                            let U = c.s11n.deserialize()[0];
                                            x.poke(C, U, "i64")
                                        } catch (U) {
                                            d("Unexpected error reading xFileSize() result:", U),
                                            N = c.sq3Codes.SQLITE_IOERR
                                        }
                                    return ae(),
                                    N
                                },
                                xLock: function(k, C) {
                                    le("xLock");
                                    let N = ee[k]
                                      , U = 0;
                                    return N.lockType ? N.lockType = C : (U = j("xLock", k, C),
                                    U === 0 && (N.lockType = C)),
                                    ae(),
                                    U
                                },
                                xRead: function(k, C, N, U) {
                                    le("xRead");
                                    let W = ee[k], Z;
                                    try {
                                        Z = j("xRead", k, N, Number(U)),
                                        (Z === 0 || m.SQLITE_IOERR_SHORT_READ === Z) && x.heap8u().set(W.sabView.subarray(0, N), C)
                                    } catch (re) {
                                        d("xRead(", arguments, ") failed:", re, W),
                                        Z = m.SQLITE_IOERR_READ
                                    }
                                    return ae(),
                                    Z
                                },
                                xSync: function(k, C) {
                                    le("xSync"),
                                    ++w.xSync.count;
                                    let N = j("xSync", k, C);
                                    return ae(),
                                    N
                                },
                                xTruncate: function(k, C) {
                                    le("xTruncate");
                                    let N = j("xTruncate", k, Number(C));
                                    return ae(),
                                    N
                                },
                                xUnlock: function(k, C) {
                                    le("xUnlock");
                                    let N = ee[k]
                                      , U = 0;
                                    return m.SQLITE_LOCK_NONE === C && N.lockType && (U = j("xUnlock", k, C)),
                                    U === 0 && (N.lockType = C),
                                    ae(),
                                    U
                                },
                                xWrite: function(k, C, N, U) {
                                    le("xWrite");
                                    let W = ee[k], Z;
                                    try {
                                        W.sabView.set(x.heap8u().subarray(C, C + N)),
                                        Z = j("xWrite", k, N, Number(U))
                                    } catch (re) {
                                        d("xWrite(", arguments, ") failed:", re, W),
                                        Z = m.SQLITE_IOERR_WRITE
                                    }
                                    return ae(),
                                    Z
                                }
                            }
                              , de = {
                                xAccess: function(k, C, N, U) {
                                    le("xAccess");
                                    let W = j("xAccess", x.cstrToJs(C));
                                    return x.poke(U, W ? 0 : 1, "i32"),
                                    ae(),
                                    0
                                },
                                xCurrentTime: function(k, C) {
                                    return x.poke(C, 24405875e-1 + new Date().getTime() / 864e5, "double"),
                                    0
                                },
                                xCurrentTimeInt64: function(k, C) {
                                    return x.poke(C, 24405875e-1 * 864e5 + new Date().getTime(), "i64"),
                                    0
                                },
                                xDelete: function(k, C, N) {
                                    le("xDelete");
                                    let U = j("xDelete", x.cstrToJs(C), N, !1);
                                    return ae(),
                                    U
                                },
                                xFullPathname: function(k, C, N, U) {
                                    return x.cstrncpy(U, C, N) < N ? 0 : m.SQLITE_CANTOPEN
                                },
                                xGetLastError: function(k, C, N) {
                                    return Y("OPFS xGetLastError() has nothing sensible to return."),
                                    0
                                },
                                xOpen: function(C, N, U, W, Z) {
                                    le("xOpen");
                                    let re = 0;
                                    N === 0 ? N = se() : typeof N == "number" && (m.sqlite3_uri_boolean(N, "opfs-unlock-asap", 0) && (re |= c.opfsFlags.OPFS_UNLOCK_ASAP),
                                    N = x.cstrToJs(N));
                                    let V = Object.create(null);
                                    V.fid = U,
                                    V.filename = N,
                                    V.sab = new SharedArrayBuffer(c.fileBufferSize),
                                    V.flags = W;
                                    let ye = j("xOpen", U, N, W, re);
                                    return ye || (V.readOnly && x.poke(Z, m.SQLITE_OPEN_READONLY, "i32"),
                                    ee[U] = V,
                                    V.sabView = c.sabFileBufView,
                                    V.sq3File = new R(U),
                                    V.sq3File.$pMethods = u.pointer,
                                    V.lockType = m.SQLITE_LOCK_NONE),
                                    ae(),
                                    ye
                                }
                            };
                            _ && (q.$xRandomness = _.$xRandomness,
                            q.$xSleep = _.$xSleep),
                            q.$xRandomness || (de.xRandomness = function(k, C, N) {
                                let U = x.heap8u()
                                  , W = 0;
                                for (; W < C; ++W)
                                    U[N + W] = Math.random() * 255e3 & 255;
                                return W
                            }
                            ),
                            q.$xSleep || (de.xSleep = function(k, C) {
                                return Atomics.wait(c.sabOPView, c.opIds.xSleep, 0, C),
                                0
                            }
                            ),
                            L.getResolvedPath = function(k, C) {
                                let N = new URL(k,"file://irrelevant").pathname;
                                return C ? N.split("/").filter(U=>!!U) : N
                            }
                            ,
                            L.getDirForFilename = async function(C, N=!1) {
                                let U = L.getResolvedPath(C, !0)
                                  , W = U.pop()
                                  , Z = L.rootDirectory;
                                for (let re of U)
                                    re && (Z = await Z.getDirectoryHandle(re, {
                                        create: !!N
                                    }));
                                return [Z, W]
                            }
                            ,
                            L.mkdir = async function(k) {
                                try {
                                    return await L.getDirForFilename(k + "/filepart", !0),
                                    !0
                                } catch {
                                    return !1
                                }
                            }
                            ,
                            L.entryExists = async function(k) {
                                try {
                                    let[C,N] = await L.getDirForFilename(k);
                                    return await C.getFileHandle(N),
                                    !0
                                } catch {
                                    return !1
                                }
                            }
                            ,
                            L.randomFilename = se,
                            L.registerVfs = (k=!1)=>x.exports.sqlite3_vfs_register(q.pointer, k ? 1 : 0),
                            L.treeList = async function() {
                                let k = async function N(U, W) {
                                    W.name = U.name,
                                    W.dirs = [],
                                    W.files = [];
                                    for await(let Z of U.values())
                                        if (Z.kind === "directory") {
                                            let re = Object.create(null);
                                            W.dirs.push(re),
                                            await N(Z, re)
                                        } else
                                            W.files.push(Z.name)
                                }
                                  , C = Object.create(null);
                                return await k(L.rootDirectory, C),
                                C
                            }
                            ,
                            L.rmfr = async function() {
                                let k = L.rootDirectory
                                  , C = {
                                    recurse: !0
                                };
                                for await(let N of k.values())
                                    k.removeEntry(N.name, C)
                            }
                            ,
                            L.unlink = async function(k, C=!1, N=!1) {
                                try {
                                    let[U,W] = await L.getDirForFilename(k, !1);
                                    return await U.removeEntry(W, {
                                        recursive: C
                                    }),
                                    !0
                                } catch (U) {
                                    if (N)
                                        throw new Error("unlink(",arguments[0],") failed: " + U.message,{
                                            cause: U
                                        });
                                    return !1
                                }
                            }
                            ,
                            L.traverse = async function(k) {
                                let C = {
                                    recursive: !0,
                                    directory: L.rootDirectory
                                };
                                typeof k == "function" && (k = {
                                    callback: k
                                }),
                                k = Object.assign(C, k || {}),
                                async function U(W, Z) {
                                    for await(let re of W.values()) {
                                        if (k.callback(re, W, Z) === !1)
                                            return !1;
                                        if (k.recursive && re.kind === "directory" && await U(re, Z + 1) === !1)
                                            break
                                    }
                                }(k.directory, 0)
                            }
                            ;
                            let we = async function(k, C) {
                                let[N,U] = await L.getDirForFilename(k, !0), Z = await (await N.getFileHandle(U, {
                                    create: !0
                                })).createSyncAccessHandle(), re = 0, V, ye = !1, ue = !1;
                                try {
                                    for (Z.truncate(0); (V = await C()) !== void 0; )
                                        V instanceof ArrayBuffer && (V = new Uint8Array(V)),
                                        re === 0 && V.byteLength >= 15 && (I.affirmDbHeader(V),
                                        ye = !0),
                                        Z.write(V, {
                                            at: re
                                        }),
                                        re += V.byteLength;
                                    if ((re < 512 || re % 512 !== 0) && f("Input size", re, "is not correct for an SQLite database."),
                                    !ye) {
                                        let E = new Uint8Array(20);
                                        Z.read(E, {
                                            at: 0
                                        }),
                                        I.affirmDbHeader(E)
                                    }
                                    return Z.write(new Uint8Array([1, 1]), {
                                        at: 18
                                    }),
                                    re
                                } catch (E) {
                                    throw await Z.close(),
                                    Z = void 0,
                                    await N.removeEntry(U).catch(()=>{}
                                    ),
                                    E
                                } finally {
                                    Z && await Z.close()
                                }
                            };
                            if (L.importDb = async function(k, C) {
                                if (C instanceof Function)
                                    return we(k, C);
                                C instanceof ArrayBuffer && (C = new Uint8Array(C)),
                                I.affirmIsDb(C);
                                let N = C.byteLength, [U,W] = await L.getDirForFilename(k, !0), Z, re, V = 0;
                                try {
                                    return Z = await (await U.getFileHandle(W, {
                                        create: !0
                                    })).createSyncAccessHandle(),
                                    Z.truncate(0),
                                    V = Z.write(C, {
                                        at: 0
                                    }),
                                    V != N && f("Expected to write " + N + " bytes but wrote " + V + "."),
                                    Z.write(new Uint8Array([1, 1]), {
                                        at: 18
                                    }),
                                    V
                                } catch (ye) {
                                    throw Z && (await Z.close(),
                                    Z = void 0),
                                    await U.removeEntry(W).catch(()=>{}
                                    ),
                                    ye
                                } finally {
                                    Z && await Z.close()
                                }
                            }
                            ,
                            t.oo1) {
                                let k = function(...C) {
                                    let N = t.oo1.DB.dbCtorHelper.normalizeArgs(...C);
                                    N.vfs = q.$zName,
                                    t.oo1.DB.dbCtorHelper.call(this, N)
                                };
                                k.prototype = Object.create(t.oo1.DB.prototype),
                                t.oo1.OpfsDb = k,
                                k.importDb = L.importDb,
                                t.oo1.DB.dbCtorHelper.setVfsPostOpenSql(q.pointer, function(C, N) {
                                    N.capi.sqlite3_busy_timeout(C, 1e4),
                                    N.capi.sqlite3_exec(C, ["pragma journal_mode=DELETE;", "pragma cache_size=-16384;"], 0, 0, 0)
                                })
                            }
                            let qe = function() {
                                let k = x.scopedAllocPush()
                                  , C = new R;
                                try {
                                    let N = C.pointer, U = m.SQLITE_OPEN_CREATE | m.SQLITE_OPEN_READWRITE | m.SQLITE_OPEN_MAIN_DB, W = x.scopedAlloc(8), Z = "/sanity/check/file" + se(8), re = x.scopedAllocCString(Z), V;
                                    if (c.s11n.serialize("This is \xE4 string."),
                                    V = c.s11n.deserialize(),
                                    J("deserialize() says:", V),
                                    V[0] !== "This is \xE4 string." && f("String d13n error."),
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    J("xAccess(", Z, ") exists ?=", V),
                                    V = de.xOpen(q.pointer, re, N, U, W),
                                    J("open rc =", V, "state.sabOPView[xOpen] =", c.sabOPView[c.opIds.xOpen]),
                                    V !== 0) {
                                        d("open failed with code", V);
                                        return
                                    }
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    V || f("xAccess() failed to detect file."),
                                    V = ce.xSync(C.pointer, 0),
                                    V && f("sync failed w/ rc", V),
                                    V = ce.xTruncate(C.pointer, 1024),
                                    V && f("truncate failed w/ rc", V),
                                    x.poke(W, 0, "i64"),
                                    V = ce.xFileSize(C.pointer, W),
                                    V && f("xFileSize failed w/ rc", V),
                                    J("xFileSize says:", x.peek(W, "i64")),
                                    V = ce.xWrite(C.pointer, re, 10, 1),
                                    V && f("xWrite() failed!");
                                    let ye = x.scopedAlloc(16);
                                    V = ce.xRead(C.pointer, ye, 6, 2),
                                    x.poke(ye + 6, 0);
                                    let ue = x.cstrToJs(ye);
                                    J("xRead() got:", ue),
                                    ue !== "sanity" && f("Unexpected xRead() value."),
                                    de.xSleep && (J("xSleep()ing before close()ing..."),
                                    de.xSleep(q.pointer, 2e3),
                                    J("waking up from xSleep()")),
                                    V = ce.xClose(N),
                                    J("xClose rc =", V, "sabOPView =", c.sabOPView),
                                    J("Deleting file:", Z),
                                    de.xDelete(q.pointer, re, 4660),
                                    de.xAccess(q.pointer, re, 0, W),
                                    V = x.peek(W, "i32"),
                                    V && f("Expecting 0 from xAccess(", Z, ") after xDelete()."),
                                    Y("End of OPFS sanity checks.")
                                } finally {
                                    C.dispose(),
                                    x.scopedAllocPop(k)
                                }
                            };
                            h.onmessage = function({data: k}) {
                                switch (k.type) {
                                case "opfs-unavailable":
                                    D(new Error(k.payload.join(" ")));
                                    break;
                                case "opfs-async-loaded":
                                    h.postMessage({
                                        type: "opfs-async-init",
                                        args: c
                                    });
                                    break;
                                case "opfs-async-inited":
                                    {
                                        if (F === !0)
                                            break;
                                        try {
                                            t.vfs.installVfs({
                                                io: {
                                                    struct: u,
                                                    methods: ce
                                                },
                                                vfs: {
                                                    struct: q,
                                                    methods: de
                                                }
                                            }),
                                            c.sabOPView = new Int32Array(c.sabOP),
                                            c.sabFileBufView = new Uint8Array(c.sabIO,0,c.fileBufferSize),
                                            c.sabS11nView = new Uint8Array(c.sabIO,c.sabS11nOffset,c.sabS11nSize),
                                            H(),
                                            n.sanityChecks && (Y("Running sanity checks because of opfs-sanity-check URL arg..."),
                                            qe()),
                                            $() ? navigator.storage.getDirectory().then(C=>{
                                                h.onerror = h._originalOnError,
                                                delete h._originalOnError,
                                                t.opfs = L,
                                                L.rootDirectory = C,
                                                J("End of OPFS sqlite3_vfs setup.", q),
                                                P()
                                            }
                                            ).catch(D) : P()
                                        } catch (C) {
                                            d(C),
                                            D(C)
                                        }
                                        break
                                    }
                                default:
                                    {
                                        let C = "Unexpected message from the OPFS async worker: " + JSON.stringify(k);
                                        d(C),
                                        D(new Error(C));
                                        break
                                    }
                                }
                            }
                        }
                        ))
                    };
                    r.defaultProxyUri = "sqlite3-opfs-async-proxy.js",
                    globalThis.sqlite3ApiBootstrap.initializersAsync.push(async i=>{
                        try {
                            let n = r.defaultProxyUri;
                            return i.scriptInfo.sqlite3Dir && (r.defaultProxyUri = i.scriptInfo.sqlite3Dir + n),
                            r().catch(s=>{
                                // hbi disable: this is faulty warning & poorly written code
                                // i.config.warn("Ignoring inability to install OPFS sqlite3_vfs:", s.message)
                            }
                            )
                        } catch (n) {
                            return i.config.error("installOpfsVfs() exception:", n),
                            Promise.reject(n)
                        }
                    }
                    )
                }),
                globalThis.sqlite3ApiBootstrap.initializers.push(function(t) {
                    var ce, de, we, qe, k, C, N, U, W, Z, re, V, nt, ue;
                    "use strict";
                    let r = t.util.toss
                      , i = t.util.toss3
                      , n = Object.create(null)
                      , s = t.capi
                      , p = t.util
                      , y = t.wasm
                      , O = 4096
                      , B = 512
                      , G = 4
                      , J = 8
                      , Y = B + G
                      , d = B
                      , f = Y
                      , m = O
                      , I = s.SQLITE_OPEN_MAIN_DB | s.SQLITE_OPEN_MAIN_JOURNAL | s.SQLITE_OPEN_SUPER_JOURNAL | s.SQLITE_OPEN_WAL
                      , x = ".opaque"
                      , S = ()=>Math.random().toString(36).slice(2)
                      , R = new TextDecoder
                      , z = new TextEncoder
                      , L = Object.assign(Object.create(null), {
                        name: "opfs-sahpool",
                        directory: void 0,
                        initialCapacity: 6,
                        clearOnInit: !1,
                        verbosity: 2
                    })
                      , $ = [t.config.error, t.config.warn, t.config.log]
                      , u = t.config.log
                      , q = t.config.warn
                      , F = t.config.error
                      , D = new Map
                      , P = E=>D.get(E)
                      , h = (E,g)=>{
                        g ? D.set(E, g) : D.delete(E)
                    }
                      , l = new Map
                      , _ = E=>l.get(E)
                      , c = (E,g)=>{
                        g ? l.set(E, g) : l.delete(E)
                    }
                      , w = {
                        xCheckReservedLock: function(E, g) {
                            let A = _(E);
                            return A.log("xCheckReservedLock"),
                            A.storeErr(),
                            y.poke32(g, 1),
                            0
                        },
                        xClose: function(E) {
                            let g = _(E);
                            g.storeErr();
                            let A = g.getOFileForS3File(E);
                            if (A)
                                try {
                                    g.log(`xClose ${A.path}`),
                                    g.mapS3FileToOFile(E, !1),
                                    A.sah.flush(),
                                    A.flags & s.SQLITE_OPEN_DELETEONCLOSE && g.deletePath(A.path)
                                } catch (T) {
                                    return g.storeErr(T, s.SQLITE_IOERR)
                                }
                            return 0
                        },
                        xDeviceCharacteristics: function(E) {
                            return s.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN
                        },
                        xFileControl: function(E, g, A) {
                            return s.SQLITE_NOTFOUND
                        },
                        xFileSize: function(E, g) {
                            let A = _(E);
                            A.log("xFileSize");
                            let M = A.getOFileForS3File(E).sah.getSize() - m;
                            return y.poke64(g, BigInt(M)),
                            0
                        },
                        xLock: function(E, g) {
                            let A = _(E);
                            A.log(`xLock ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            return T.lockType = g,
                            0
                        },
                        xRead: function(E, g, A, T) {
                            let M = _(E);
                            M.storeErr();
                            let Q = M.getOFileForS3File(E);
                            M.log(`xRead ${Q.path} ${A} @ ${T}`);
                            try {
                                let X = Q.sah.read(y.heap8u().subarray(g, g + A), {
                                    at: m + Number(T)
                                });
                                return X < A ? (y.heap8u().fill(0, g + X, g + A),
                                s.SQLITE_IOERR_SHORT_READ) : 0
                            } catch (X) {
                                return M.storeErr(X, s.SQLITE_IOERR)
                            }
                        },
                        xSectorSize: function(E) {
                            return O
                        },
                        xSync: function(E, g) {
                            let A = _(E);
                            A.log(`xSync ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            try {
                                return T.sah.flush(),
                                0
                            } catch (M) {
                                return A.storeErr(M, s.SQLITE_IOERR)
                            }
                        },
                        xTruncate: function(E, g) {
                            let A = _(E);
                            A.log(`xTruncate ${g}`),
                            A.storeErr();
                            let T = A.getOFileForS3File(E);
                            try {
                                return T.sah.truncate(m + Number(g)),
                                0
                            } catch (M) {
                                return A.storeErr(M, s.SQLITE_IOERR)
                            }
                        },
                        xUnlock: function(E, g) {
                            let A = _(E);
                            A.log("xUnlock");
                            let T = A.getOFileForS3File(E);
                            return T.lockType = g,
                            0
                        },
                        xWrite: function(E, g, A, T) {
                            let M = _(E);
                            M.storeErr();
                            let Q = M.getOFileForS3File(E);
                            M.log(`xWrite ${Q.path} ${A} ${T}`);
                            try {
                                let X = Q.sah.write(y.heap8u().subarray(g, g + A), {
                                    at: m + Number(T)
                                });
                                return A === X ? 0 : r("Unknown write() failure.")
                            } catch (X) {
                                return M.storeErr(X, s.SQLITE_IOERR)
                            }
                        }
                    }
                      , j = new s.sqlite3_io_methods;
                    j.$iVersion = 1,
                    t.vfs.installVfs({
                        io: {
                            struct: j,
                            methods: w
                        }
                    });
                    let H = {
                        xAccess: function(E, g, A, T) {
                            let M = P(E);
                            M.storeErr();
                            try {
                                let Q = M.getPath(g);
                                y.poke32(T, M.hasFilename(Q) ? 1 : 0)
                            } catch {
                                y.poke32(T, 0)
                            }
                            return 0
                        },
                        xCurrentTime: function(E, g) {
                            return y.poke(g, 24405875e-1 + new Date().getTime() / 864e5, "double"),
                            0
                        },
                        xCurrentTimeInt64: function(E, g) {
                            return y.poke(g, 24405875e-1 * 864e5 + new Date().getTime(), "i64"),
                            0
                        },
                        xDelete: function(E, g, A) {
                            let T = P(E);
                            T.log(`xDelete ${y.cstrToJs(g)}`),
                            T.storeErr();
                            try {
                                return T.deletePath(T.getPath(g)),
                                0
                            } catch (M) {
                                return T.storeErr(M),
                                s.SQLITE_IOERR_DELETE
                            }
                        },
                        xFullPathname: function(E, g, A, T) {
                            return y.cstrncpy(T, g, A) < A ? 0 : s.SQLITE_CANTOPEN
                        },
                        xGetLastError: function(E, g, A) {
                            let T = P(E)
                              , M = T.popErr();
                            if (T.log(`xGetLastError ${g} e =`, M),
                            M) {
                                let Q = y.scopedAllocPush();
                                try {
                                    let[X,ne] = y.scopedAllocCString(M.message, !0);
                                    y.cstrncpy(A, X, g),
                                    ne > g && y.poke8(A + g - 1, 0)
                                } catch {
                                    return s.SQLITE_NOMEM
                                } finally {
                                    y.scopedAllocPop(Q)
                                }
                            }
                            return M ? M.sqlite3Rc || s.SQLITE_IOERR : 0
                        },
                        xOpen: function(g, A, T, M, Q) {
                            let X = P(g);
                            try {
                                X.log(`xOpen ${y.cstrToJs(A)} ${M}`);
                                let ne = A && y.peek8(A) ? X.getPath(A) : S()
                                  , he = X.getSAHForPath(ne);
                                !he && M & s.SQLITE_OPEN_CREATE && (X.getFileCount() < X.getCapacity() ? (he = X.nextAvailableSAH(),
                                X.setAssociatedPath(he, ne, M)) : r("SAH pool is full. Cannot create file", ne)),
                                he || r("file not found:", ne);
                                let ve = {
                                    path: ne,
                                    flags: M,
                                    sah: he
                                };
                                X.mapS3FileToOFile(T, ve),
                                ve.lockType = s.SQLITE_LOCK_NONE;
                                let tt = new s.sqlite3_file(T);
                                return tt.$pMethods = j.pointer,
                                tt.dispose(),
                                y.poke32(Q, M),
                                0
                            } catch (ne) {
                                return X.storeErr(ne),
                                s.SQLITE_CANTOPEN
                            }
                        }
                    }
                      , se = function(E) {
                        t.capi.sqlite3_vfs_find(E) && i("VFS name is already registered:", E);
                        let g = new s.sqlite3_vfs
                          , A = s.sqlite3_vfs_find(null)
                          , T = A ? new s.sqlite3_vfs(A) : null;
                        return g.$iVersion = 2,
                        g.$szOsFile = s.sqlite3_file.structInfo.sizeof,
                        g.$mxPathname = B,
                        g.addOnDispose(g.$zName = y.allocCString(E), ()=>h(g.pointer, 0)),
                        T && (g.$xRandomness = T.$xRandomness,
                        g.$xSleep = T.$xSleep,
                        T.dispose()),
                        !g.$xRandomness && !H.xRandomness && (H.xRandomness = function(M, Q, X) {
                            let ne = y.heap8u()
                              , he = 0;
                            for (; he < Q; ++he)
                                ne[X + he] = Math.random() * 255e3 & 255;
                            return he
                        }
                        ),
                        !g.$xSleep && !H.xSleep && (H.xSleep = (M,Q)=>0),
                        t.vfs.installVfs({
                            vfs: {
                                struct: g,
                                methods: H
                            }
                        }),
                        g
                    };
                    class ee {
                        constructor(g=Object.create(null)) {
                            Ee(this, V);
                            Ht(this, "vfsDir");
                            Ee(this, ce, void 0);
                            Ee(this, de, void 0);
                            Ee(this, we, void 0);
                            Ee(this, qe, new Map);
                            Ee(this, k, new Map);
                            Ee(this, C, new Set);
                            Ee(this, N, new Map);
                            Ee(this, U, new Uint8Array(Y));
                            Ee(this, W, void 0);
                            Ee(this, Z, void 0);
                            Ee(this, re, void 0);
                            Ae(this, re, g.verbosity ?? L.verbosity),
                            this.vfsName = g.name || L.name,
                            Ae(this, Z, se(this.vfsName)),
                            h(K(this, Z).pointer, this),
                            this.vfsDir = g.directory || "." + this.vfsName,
                            Ae(this, W, new DataView(K(this, U).buffer,K(this, U).byteOffset)),
                            this.isReady = this.reset(!!(g.clearOnInit ?? L.clearOnInit)).then(()=>{
                                if (this.$error)
                                    throw this.$error;
                                return this.getCapacity() ? Promise.resolve(void 0) : this.addCapacity(g.initialCapacity || L.initialCapacity)
                            }
                            )
                        }
                        log(...g) {
                            rt(this, V, nt).call(this, 2, ...g)
                        }
                        warn(...g) {
                            rt(this, V, nt).call(this, 1, ...g)
                        }
                        error(...g) {
                            rt(this, V, nt).call(this, 0, ...g)
                        }
                        getVfs() {
                            return K(this, Z)
                        }
                        getCapacity() {
                            return K(this, qe).size
                        }
                        getFileCount() {
                            return K(this, k).size
                        }
                        getFileNames() {
                            let g = []
                              , A = K(this, k).keys();
                            for (let T of A)
                                g.push(T);
                            return g
                        }
                        async addCapacity(g) {
                            for (let A = 0; A < g; ++A) {
                                let T = S()
                                  , Q = await (await K(this, de).getFileHandle(T, {
                                    create: !0
                                })).createSyncAccessHandle();
                                K(this, qe).set(Q, T),
                                this.setAssociatedPath(Q, "", 0)
                            }
                            return this.getCapacity()
                        }
                        async reduceCapacity(g) {
                            let A = 0;
                            for (let T of Array.from(K(this, C))) {
                                if (A === g || this.getFileCount() === this.getCapacity())
                                    break;
                                let M = K(this, qe).get(T);
                                T.close(),
                                await K(this, de).removeEntry(M),
                                K(this, qe).delete(T),
                                K(this, C).delete(T),
                                ++A
                            }
                            return A
                        }
                        releaseAccessHandles() {
                            for (let g of K(this, qe).keys())
                                g.close();
                            K(this, qe).clear(),
                            K(this, k).clear(),
                            K(this, C).clear()
                        }
                        async acquireAccessHandles(g) {
                            let A = [];
                            for await(let[T,M] of K(this, de))
                                M.kind === "file" && A.push([T, M]);
                            return Promise.all(A.map(async([T,M])=>{
                                try {
                                    let Q = await M.createSyncAccessHandle();
                                    if (K(this, qe).set(Q, T),
                                    g)
                                        Q.truncate(m),
                                        this.setAssociatedPath(Q, "", 0);
                                    else {
                                        let X = this.getAssociatedPath(Q);
                                        X ? K(this, k).set(X, Q) : K(this, C).add(Q)
                                    }
                                } catch (Q) {
                                    throw this.storeErr(Q),
                                    this.releaseAccessHandles(),
                                    Q
                                }
                            }
                            ))
                        }
                        getAssociatedPath(g) {
                            g.read(K(this, U), {
                                at: 0
                            });
                            let A = K(this, W).getUint32(d);
                            if (K(this, U)[0] && (A & s.SQLITE_OPEN_DELETEONCLOSE || !(A & I)))
                                return q(`Removing file with unexpected flags ${A.toString(16)}`, K(this, U)),
                                this.setAssociatedPath(g, "", 0),
                                "";
                            let T = new Uint32Array(J / 4);
                            g.read(T, {
                                at: f
                            });
                            let M = this.computeDigest(K(this, U));
                            if (T.every((Q,X)=>Q === M[X])) {
                                let Q = K(this, U).findIndex(X=>X === 0);
                                return Q === 0 && g.truncate(m),
                                Q ? R.decode(K(this, U).subarray(0, Q)) : ""
                            } else
                                return q("Disassociating file with bad digest."),
                                this.setAssociatedPath(g, "", 0),
                                ""
                        }
                        setAssociatedPath(g, A, T) {
                            let M = z.encodeInto(A, K(this, U));
                            B <= M.written + 1 && r("Path too long:", A),
                            K(this, U).fill(0, M.written, B),
                            K(this, W).setUint32(d, T);
                            let Q = this.computeDigest(K(this, U));
                            g.write(K(this, U), {
                                at: 0
                            }),
                            g.write(Q, {
                                at: f
                            }),
                            g.flush(),
                            A ? (K(this, k).set(A, g),
                            K(this, C).delete(g)) : (g.truncate(m),
                            K(this, C).add(g))
                        }
                        computeDigest(g) {
                            let A = 3735928559
                              , T = 1103547991;
                            for (let M of g)
                                A = 31 * A + M * 307,
                                T = 31 * T + M * 307;
                            return new Uint32Array([A >>> 0, T >>> 0])
                        }
                        async reset(g) {
                            await this.isReady;
                            let A = await navigator.storage.getDirectory(), T, M;
                            for (let Q of this.vfsDir.split("/"))
                                Q && (T = A,
                                A = await A.getDirectoryHandle(Q, {
                                    create: !0
                                }));
                            return Ae(this, ce, A),
                            Ae(this, we, T),
                            Ae(this, de, await K(this, ce).getDirectoryHandle(x, {
                                create: !0
                            })),
                            this.releaseAccessHandles(),
                            this.acquireAccessHandles(g)
                        }
                        getPath(g) {
                            return y.isPtr(g) && (g = y.cstrToJs(g)),
                            (g instanceof URL ? g : new URL(g,"file://localhost/")).pathname
                        }
                        deletePath(g) {
                            let A = K(this, k).get(g);
                            return A && (K(this, k).delete(g),
                            this.setAssociatedPath(A, "", 0)),
                            !!A
                        }
                        storeErr(g, A) {
                            return g && (g.sqlite3Rc = A || s.SQLITE_IOERR,
                            this.error(g)),
                            this.$error = g,
                            A
                        }
                        popErr() {
                            let g = this.$error;
                            return this.$error = void 0,
                            g
                        }
                        nextAvailableSAH() {
                            let[g] = K(this, C).keys();
                            return g
                        }
                        getOFileForS3File(g) {
                            return K(this, N).get(g)
                        }
                        mapS3FileToOFile(g, A) {
                            A ? (K(this, N).set(g, A),
                            c(g, this)) : (K(this, N).delete(g),
                            c(g, !1))
                        }
                        hasFilename(g) {
                            return K(this, k).has(g)
                        }
                        getSAHForPath(g) {
                            return K(this, k).get(g)
                        }
                        async removeVfs() {
                            if (!K(this, Z).pointer || !K(this, de))
                                return !1;
                            s.sqlite3_vfs_unregister(K(this, Z).pointer),
                            K(this, Z).dispose();
                            try {
                                this.releaseAccessHandles(),
                                await K(this, ce).removeEntry(x, {
                                    recursive: !0
                                }),
                                Ae(this, de, void 0),
                                await K(this, we).removeEntry(K(this, ce).name, {
                                    recursive: !0
                                }),
                                Ae(this, ce, Ae(this, we, void 0))
                            } catch (g) {
                                t.config.error(this.vfsName, "removeVfs() failed:", g)
                            }
                            return !0
                        }
                        exportFile(g) {
                            let A = K(this, k).get(g) || r("File not found:", g)
                              , T = A.getSize() - m
                              , M = new Uint8Array(T > 0 ? T : 0);
                            if (T > 0) {
                                let Q = A.read(M, {
                                    at: m
                                });
                                Q != T && r("Expected to read " + T + " bytes but read " + Q + ".")
                            }
                            return M
                        }
                        async importDbChunked(g, A) {
                            let T = K(this, k).get(g) || this.nextAvailableSAH() || r("No available handles to import to.");
                            T.truncate(0);
                            let M = 0, Q, X = !1, ne = !1;
                            try {
                                for (; (Q = await A()) !== void 0; )
                                    Q instanceof ArrayBuffer && (Q = new Uint8Array(Q)),
                                    M === 0 && Q.byteLength >= 15 && (p.affirmDbHeader(Q),
                                    X = !0),
                                    T.write(Q, {
                                        at: m + M
                                    }),
                                    M += Q.byteLength;
                                if ((M < 512 || M % 512 !== 0) && r("Input size", M, "is not correct for an SQLite database."),
                                !X) {
                                    let he = new Uint8Array(20);
                                    T.read(he, {
                                        at: 0
                                    }),
                                    p.affirmDbHeader(he)
                                }
                                T.write(new Uint8Array([1, 1]), {
                                    at: m + 18
                                })
                            } catch (he) {
                                throw this.setAssociatedPath(T, "", 0),
                                he
                            }
                            return this.setAssociatedPath(T, g, s.SQLITE_OPEN_MAIN_DB),
                            M
                        }
                        importDb(g, A) {
                            if (A instanceof ArrayBuffer)
                                A = new Uint8Array(A);
                            else if (A instanceof Function)
                                return this.importDbChunked(g, A);
                            let T = K(this, k).get(g) || this.nextAvailableSAH() || r("No available handles to import to.")
                              , M = A.byteLength;
                            (M < 512 || M % 512 != 0) && r("Byte array size is invalid for an SQLite db.");
                            let Q = "SQLite format 3";
                            for (let ne = 0; ne < Q.length; ++ne)
                                Q.charCodeAt(ne) !== A[ne] && r("Input does not contain an SQLite database header.");
                            let X = T.write(A, {
                                at: m
                            });
                            return X != M ? (this.setAssociatedPath(T, "", 0),
                            r("Expected to write " + M + " bytes but wrote " + X + ".")) : (T.write(new Uint8Array([1, 1]), {
                                at: m + 18
                            }),
                            this.setAssociatedPath(T, g, s.SQLITE_OPEN_MAIN_DB)),
                            X
                        }
                    }
                    ce = new WeakMap,
                    de = new WeakMap,
                    we = new WeakMap,
                    qe = new WeakMap,
                    k = new WeakMap,
                    C = new WeakMap,
                    N = new WeakMap,
                    U = new WeakMap,
                    W = new WeakMap,
                    Z = new WeakMap,
                    re = new WeakMap,
                    V = new WeakSet,
                    nt = function(g, ...A) {
                        K(this, re) > g && $[g](this.vfsName + ":", ...A)
                    }
                    ;
                    class ie {
                        constructor(g) {
                            Ee(this, ue, void 0);
                            Ae(this, ue, g),
                            this.vfsName = g.vfsName
                        }
                        async addCapacity(g) {
                            return K(this, ue).addCapacity(g)
                        }
                        async reduceCapacity(g) {
                            return K(this, ue).reduceCapacity(g)
                        }
                        getCapacity() {
                            return K(this, ue).getCapacity(K(this, ue))
                        }
                        getFileCount() {
                            return K(this, ue).getFileCount()
                        }
                        getFileNames() {
                            return K(this, ue).getFileNames()
                        }
                        async reserveMinimumCapacity(g) {
                            let A = K(this, ue).getCapacity();
                            return A < g ? K(this, ue).addCapacity(g - A) : A
                        }
                        exportFile(g) {
                            return K(this, ue).exportFile(g)
                        }
                        importDb(g, A) {
                            return K(this, ue).importDb(g, A)
                        }
                        async wipeFiles() {
                            return K(this, ue).reset(!0)
                        }
                        unlink(g) {
                            return K(this, ue).deletePath(g)
                        }
                        async removeVfs() {
                            return K(this, ue).removeVfs()
                        }
                    }
                    ue = new WeakMap;
                    let le = async()=>{
                        let E = await navigator.storage.getDirectory()
                          , g = ".opfs-sahpool-sync-check-" + S()
                          , M = (await (await E.getFileHandle(g, {
                            create: !0
                        })).createSyncAccessHandle()).close();
                        return await M,
                        await E.removeEntry(g),
                        M?.then && r("The local OPFS API is too old for opfs-sahpool:", "it has an async FileSystemSyncAccessHandle.close() method."),
                        !0
                    }
                      , ae = 0;
                    t.installOpfsSAHPoolVfs = async function(E=Object.create(null)) {
                        let g = E.name || L.name;
                        return n[g] ? n[g] : !globalThis.FileSystemHandle || !globalThis.FileSystemDirectoryHandle || !globalThis.FileSystemFileHandle || !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle || !navigator?.storage?.getDirectory ? n[g] = Promise.reject(new Error("Missing required OPFS APIs.")) : n[g] = le().then(async function() {
                            if (E.$testThrowInInit)
                                throw E.$testThrowInInit;
                            let A = new ee(E);
                            return A.isReady.then(async()=>{
                                let T = new ie(A);
                                if (t.oo1) {
                                    let M = t.oo1
                                      , Q = A.getVfs()
                                      , X = function(...ne) {
                                        let he = M.DB.dbCtorHelper.normalizeArgs(...ne);
                                        he.vfs = Q.$zName,
                                        M.DB.dbCtorHelper.call(this, he)
                                    };
                                    X.prototype = Object.create(M.DB.prototype),
                                    T.OpfsSAHPoolDb = X,
                                    M.DB.dbCtorHelper.setVfsPostOpenSql(Q.pointer, function(ne, he) {
                                        he.capi.sqlite3_exec(ne, ["pragma journal_mode=DELETE;", "pragma cache_size=-16384;"], 0, 0, 0)
                                    })
                                }
                                return A.log("VFS initialized."),
                                T
                            }
                            ).catch(async T=>(await A.removeVfs().catch(()=>{}
                            ),
                            T))
                        }).catch(A=>n[g] = Promise.reject(A))
                    }
                }),
                typeof e < "u") {
                    let t = Object.assign(Object.create(null), {
                        exports: typeof b > "u" ? e.asm : b,
                        memory: e.wasmMemory
                    }, globalThis.sqlite3ApiConfig || {});
                    globalThis.sqlite3ApiConfig = t;
                    let r;
                    try {
                        r = globalThis.sqlite3ApiBootstrap()
                    } catch (i) {
                        throw console.error("sqlite3ApiBootstrap() error:", i),
                        i
                    } finally {
                        delete globalThis.sqlite3ApiBootstrap,
                        delete globalThis.sqlite3ApiConfig
                    }
                    e.sqlite3 = r
                } else
                    console.warn("This is not running in an Emscripten module context, so", "globalThis.sqlite3ApiBootstrap() is _not_ being called due to lack", "of config info for the WASM environment.", "It must be called manually.")
            }),
            _e.ready
        }
    }
    )();
    typeof exports == "object" && typeof module == "object" ? module.exports = $e : typeof define == "function" && define.amd && define([], ()=>$e);
    (function() {
        let me = $e;
        if (!me)
            throw new Error("Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.");
        let _e = globalThis.sqlite3InitModuleState = Object.assign(Object.create(null), {
            moduleScript: globalThis?.document?.currentScript,
            isWorker: typeof WorkerGlobalScope < "u",
            location: globalThis.location,
            urlParams: globalThis?.location?.href ? new URL(globalThis.location.href).searchParams : new URLSearchParams
        });
        if (_e.debugModule = _e.urlParams.has("sqlite3.debugModule") ? (...o)=>console.warn("sqlite3.debugModule:", ...o) : ()=>{}
        ,
        _e.urlParams.has("sqlite3.dir"))
            _e.sqlite3Dir = _e.urlParams.get("sqlite3.dir") + "/";
        else if (_e.moduleScript) {
            let o = _e.moduleScript.src.split("/");
            o.pop(),
            _e.sqlite3Dir = o.join("/") + "/"
        }
        if (globalThis.sqlite3InitModule = function o(...Ie) {
            return me(...Ie).then(Te=>{
                let Fe = Te.sqlite3;
                Fe.scriptInfo = _e,
                o.__isUnderTest && (Fe.__isUnderTest = !0);
                let Ke = Fe.asyncPostInit;
                return delete Fe.asyncPostInit,
                Ke()
            }
            ).catch(Te=>{
                throw console.error("Exception loading sqlite3 module:", Te),
                Te
            }
            )
        }
        ,
        globalThis.sqlite3InitModule.ready = me.ready,
        globalThis.sqlite3InitModuleState.moduleScript) {
            let o = globalThis.sqlite3InitModuleState
              , Ie = o.moduleScript.src.split("/");
            Ie.pop(),
            o.scriptDir = Ie.join("/") + "/"
        }
        return _e.debugModule("sqlite3InitModuleState =", _e),
        typeof exports == "object" && typeof module == "object" ? module.exports = $e : typeof exports == "object" && (exports.sqlite3InitModule = $e),
        globalThis.sqlite3InitModule
    }
    )();
}
)();
