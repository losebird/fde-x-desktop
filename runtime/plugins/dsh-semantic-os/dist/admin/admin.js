function G0(n) {
  return n && n.__esModule && Object.prototype.hasOwnProperty.call(n, "default") ? n.default : n;
}
var uf = { exports: {} }, eo = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var sy;
function Wb() {
  if (sy) return eo;
  sy = 1;
  var n = /* @__PURE__ */ Symbol.for("react.transitional.element"), a = /* @__PURE__ */ Symbol.for("react.fragment");
  function o(s, u, f) {
    var d = null;
    if (f !== void 0 && (d = "" + f), u.key !== void 0 && (d = "" + u.key), "key" in u) {
      f = {};
      for (var h in u)
        h !== "key" && (f[h] = u[h]);
    } else f = u;
    return u = f.ref, {
      $$typeof: n,
      type: s,
      key: d,
      ref: u !== void 0 ? u : null,
      props: f
    };
  }
  return eo.Fragment = a, eo.jsx = o, eo.jsxs = o, eo;
}
var ry;
function Pb() {
  return ry || (ry = 1, uf.exports = Wb()), uf.exports;
}
var M = Pb(), cf = { exports: {} }, bt = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var uy;
function tx() {
  if (uy) return bt;
  uy = 1;
  var n = /* @__PURE__ */ Symbol.for("react.transitional.element"), a = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), s = /* @__PURE__ */ Symbol.for("react.strict_mode"), u = /* @__PURE__ */ Symbol.for("react.profiler"), f = /* @__PURE__ */ Symbol.for("react.consumer"), d = /* @__PURE__ */ Symbol.for("react.context"), h = /* @__PURE__ */ Symbol.for("react.forward_ref"), p = /* @__PURE__ */ Symbol.for("react.suspense"), g = /* @__PURE__ */ Symbol.for("react.memo"), m = /* @__PURE__ */ Symbol.for("react.lazy"), v = /* @__PURE__ */ Symbol.for("react.activity"), b = Symbol.iterator;
  function S(T) {
    return T === null || typeof T != "object" ? null : (T = b && T[b] || T["@@iterator"], typeof T == "function" ? T : null);
  }
  var E = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, A = Object.assign, _ = {};
  function C(T, j, P) {
    this.props = T, this.context = j, this.refs = _, this.updater = P || E;
  }
  C.prototype.isReactComponent = {}, C.prototype.setState = function(T, j) {
    if (typeof T != "object" && typeof T != "function" && T != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, T, j, "setState");
  }, C.prototype.forceUpdate = function(T) {
    this.updater.enqueueForceUpdate(this, T, "forceUpdate");
  };
  function D() {
  }
  D.prototype = C.prototype;
  function w(T, j, P) {
    this.props = T, this.context = j, this.refs = _, this.updater = P || E;
  }
  var z = w.prototype = new D();
  z.constructor = w, A(z, C.prototype), z.isPureReactComponent = !0;
  var q = Array.isArray;
  function B() {
  }
  var U = { H: null, A: null, T: null, S: null }, Q = Object.prototype.hasOwnProperty;
  function Z(T, j, P) {
    var et = P.ref;
    return {
      $$typeof: n,
      type: T,
      key: j,
      ref: et !== void 0 ? et : null,
      props: P
    };
  }
  function ot(T, j) {
    return Z(T.type, j, T.props);
  }
  function X(T) {
    return typeof T == "object" && T !== null && T.$$typeof === n;
  }
  function k(T) {
    var j = { "=": "=0", ":": "=2" };
    return "$" + T.replace(/[=:]/g, function(P) {
      return j[P];
    });
  }
  var it = /\/+/g;
  function O(T, j) {
    return typeof T == "object" && T !== null && T.key != null ? k("" + T.key) : j.toString(36);
  }
  function G(T) {
    switch (T.status) {
      case "fulfilled":
        return T.value;
      case "rejected":
        throw T.reason;
      default:
        switch (typeof T.status == "string" ? T.then(B, B) : (T.status = "pending", T.then(
          function(j) {
            T.status === "pending" && (T.status = "fulfilled", T.value = j);
          },
          function(j) {
            T.status === "pending" && (T.status = "rejected", T.reason = j);
          }
        )), T.status) {
          case "fulfilled":
            return T.value;
          case "rejected":
            throw T.reason;
        }
    }
    throw T;
  }
  function N(T, j, P, et, rt) {
    var ct = typeof T;
    (ct === "undefined" || ct === "boolean") && (T = null);
    var ut = !1;
    if (T === null) ut = !0;
    else
      switch (ct) {
        case "bigint":
        case "string":
        case "number":
          ut = !0;
          break;
        case "object":
          switch (T.$$typeof) {
            case n:
            case a:
              ut = !0;
              break;
            case m:
              return ut = T._init, N(
                ut(T._payload),
                j,
                P,
                et,
                rt
              );
          }
      }
    if (ut)
      return rt = rt(T), ut = et === "" ? "." + O(T, 0) : et, q(rt) ? (P = "", ut != null && (P = ut.replace(it, "$&/") + "/"), N(rt, j, P, "", function(wt) {
        return wt;
      })) : rt != null && (X(rt) && (rt = ot(
        rt,
        P + (rt.key == null || T && T.key === rt.key ? "" : ("" + rt.key).replace(
          it,
          "$&/"
        ) + "/") + ut
      )), j.push(rt)), 1;
    ut = 0;
    var st = et === "" ? "." : et + ":";
    if (q(T))
      for (var ft = 0; ft < T.length; ft++)
        et = T[ft], ct = st + O(et, ft), ut += N(
          et,
          j,
          P,
          ct,
          rt
        );
    else if (ft = S(T), typeof ft == "function")
      for (T = ft.call(T), ft = 0; !(et = T.next()).done; )
        et = et.value, ct = st + O(et, ft++), ut += N(
          et,
          j,
          P,
          ct,
          rt
        );
    else if (ct === "object") {
      if (typeof T.then == "function")
        return N(
          G(T),
          j,
          P,
          et,
          rt
        );
      throw j = String(T), Error(
        "Objects are not valid as a React child (found: " + (j === "[object Object]" ? "object with keys {" + Object.keys(T).join(", ") + "}" : j) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ut;
  }
  function H(T, j, P) {
    if (T == null) return T;
    var et = [], rt = 0;
    return N(T, et, "", "", function(ct) {
      return j.call(P, ct, rt++);
    }), et;
  }
  function Y(T) {
    if (T._status === -1) {
      var j = T._result;
      j = j(), j.then(
        function(P) {
          (T._status === 0 || T._status === -1) && (T._status = 1, T._result = P);
        },
        function(P) {
          (T._status === 0 || T._status === -1) && (T._status = 2, T._result = P);
        }
      ), T._status === -1 && (T._status = 0, T._result = j);
    }
    if (T._status === 1) return T._result.default;
    throw T._result;
  }
  var K = typeof reportError == "function" ? reportError : function(T) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var j = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof T == "object" && T !== null && typeof T.message == "string" ? String(T.message) : String(T),
        error: T
      });
      if (!window.dispatchEvent(j)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", T);
      return;
    }
    console.error(T);
  }, tt = {
    map: H,
    forEach: function(T, j, P) {
      H(
        T,
        function() {
          j.apply(this, arguments);
        },
        P
      );
    },
    count: function(T) {
      var j = 0;
      return H(T, function() {
        j++;
      }), j;
    },
    toArray: function(T) {
      return H(T, function(j) {
        return j;
      }) || [];
    },
    only: function(T) {
      if (!X(T))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return T;
    }
  };
  return bt.Activity = v, bt.Children = tt, bt.Component = C, bt.Fragment = o, bt.Profiler = u, bt.PureComponent = w, bt.StrictMode = s, bt.Suspense = p, bt.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = U, bt.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(T) {
      return U.H.useMemoCache(T);
    }
  }, bt.cache = function(T) {
    return function() {
      return T.apply(null, arguments);
    };
  }, bt.cacheSignal = function() {
    return null;
  }, bt.cloneElement = function(T, j, P) {
    if (T == null)
      throw Error(
        "The argument must be a React element, but you passed " + T + "."
      );
    var et = A({}, T.props), rt = T.key;
    if (j != null)
      for (ct in j.key !== void 0 && (rt = "" + j.key), j)
        !Q.call(j, ct) || ct === "key" || ct === "__self" || ct === "__source" || ct === "ref" && j.ref === void 0 || (et[ct] = j[ct]);
    var ct = arguments.length - 2;
    if (ct === 1) et.children = P;
    else if (1 < ct) {
      for (var ut = Array(ct), st = 0; st < ct; st++)
        ut[st] = arguments[st + 2];
      et.children = ut;
    }
    return Z(T.type, rt, et);
  }, bt.createContext = function(T) {
    return T = {
      $$typeof: d,
      _currentValue: T,
      _currentValue2: T,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, T.Provider = T, T.Consumer = {
      $$typeof: f,
      _context: T
    }, T;
  }, bt.createElement = function(T, j, P) {
    var et, rt = {}, ct = null;
    if (j != null)
      for (et in j.key !== void 0 && (ct = "" + j.key), j)
        Q.call(j, et) && et !== "key" && et !== "__self" && et !== "__source" && (rt[et] = j[et]);
    var ut = arguments.length - 2;
    if (ut === 1) rt.children = P;
    else if (1 < ut) {
      for (var st = Array(ut), ft = 0; ft < ut; ft++)
        st[ft] = arguments[ft + 2];
      rt.children = st;
    }
    if (T && T.defaultProps)
      for (et in ut = T.defaultProps, ut)
        rt[et] === void 0 && (rt[et] = ut[et]);
    return Z(T, ct, rt);
  }, bt.createRef = function() {
    return { current: null };
  }, bt.forwardRef = function(T) {
    return { $$typeof: h, render: T };
  }, bt.isValidElement = X, bt.lazy = function(T) {
    return {
      $$typeof: m,
      _payload: { _status: -1, _result: T },
      _init: Y
    };
  }, bt.memo = function(T, j) {
    return {
      $$typeof: g,
      type: T,
      compare: j === void 0 ? null : j
    };
  }, bt.startTransition = function(T) {
    var j = U.T, P = {};
    U.T = P;
    try {
      var et = T(), rt = U.S;
      rt !== null && rt(P, et), typeof et == "object" && et !== null && typeof et.then == "function" && et.then(B, K);
    } catch (ct) {
      K(ct);
    } finally {
      j !== null && P.types !== null && (j.types = P.types), U.T = j;
    }
  }, bt.unstable_useCacheRefresh = function() {
    return U.H.useCacheRefresh();
  }, bt.use = function(T) {
    return U.H.use(T);
  }, bt.useActionState = function(T, j, P) {
    return U.H.useActionState(T, j, P);
  }, bt.useCallback = function(T, j) {
    return U.H.useCallback(T, j);
  }, bt.useContext = function(T) {
    return U.H.useContext(T);
  }, bt.useDebugValue = function() {
  }, bt.useDeferredValue = function(T, j) {
    return U.H.useDeferredValue(T, j);
  }, bt.useEffect = function(T, j) {
    return U.H.useEffect(T, j);
  }, bt.useEffectEvent = function(T) {
    return U.H.useEffectEvent(T);
  }, bt.useId = function() {
    return U.H.useId();
  }, bt.useImperativeHandle = function(T, j, P) {
    return U.H.useImperativeHandle(T, j, P);
  }, bt.useInsertionEffect = function(T, j) {
    return U.H.useInsertionEffect(T, j);
  }, bt.useLayoutEffect = function(T, j) {
    return U.H.useLayoutEffect(T, j);
  }, bt.useMemo = function(T, j) {
    return U.H.useMemo(T, j);
  }, bt.useOptimistic = function(T, j) {
    return U.H.useOptimistic(T, j);
  }, bt.useReducer = function(T, j, P) {
    return U.H.useReducer(T, j, P);
  }, bt.useRef = function(T) {
    return U.H.useRef(T);
  }, bt.useState = function(T) {
    return U.H.useState(T);
  }, bt.useSyncExternalStore = function(T, j, P) {
    return U.H.useSyncExternalStore(
      T,
      j,
      P
    );
  }, bt.useTransition = function() {
    return U.H.useTransition();
  }, bt.version = "19.2.5", bt;
}
var cy;
function Co() {
  return cy || (cy = 1, cf.exports = tx()), cf.exports;
}
var F = Co();
const ex = /* @__PURE__ */ G0(F);
var ff = { exports: {} }, no = {}, df = { exports: {} }, hf = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var fy;
function nx() {
  return fy || (fy = 1, (function(n) {
    function a(N, H) {
      var Y = N.length;
      N.push(H);
      t: for (; 0 < Y; ) {
        var K = Y - 1 >>> 1, tt = N[K];
        if (0 < u(tt, H))
          N[K] = H, N[Y] = tt, Y = K;
        else break t;
      }
    }
    function o(N) {
      return N.length === 0 ? null : N[0];
    }
    function s(N) {
      if (N.length === 0) return null;
      var H = N[0], Y = N.pop();
      if (Y !== H) {
        N[0] = Y;
        t: for (var K = 0, tt = N.length, T = tt >>> 1; K < T; ) {
          var j = 2 * (K + 1) - 1, P = N[j], et = j + 1, rt = N[et];
          if (0 > u(P, Y))
            et < tt && 0 > u(rt, P) ? (N[K] = rt, N[et] = Y, K = et) : (N[K] = P, N[j] = Y, K = j);
          else if (et < tt && 0 > u(rt, Y))
            N[K] = rt, N[et] = Y, K = et;
          else break t;
        }
      }
      return H;
    }
    function u(N, H) {
      var Y = N.sortIndex - H.sortIndex;
      return Y !== 0 ? Y : N.id - H.id;
    }
    if (n.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var f = performance;
      n.unstable_now = function() {
        return f.now();
      };
    } else {
      var d = Date, h = d.now();
      n.unstable_now = function() {
        return d.now() - h;
      };
    }
    var p = [], g = [], m = 1, v = null, b = 3, S = !1, E = !1, A = !1, _ = !1, C = typeof setTimeout == "function" ? setTimeout : null, D = typeof clearTimeout == "function" ? clearTimeout : null, w = typeof setImmediate < "u" ? setImmediate : null;
    function z(N) {
      for (var H = o(g); H !== null; ) {
        if (H.callback === null) s(g);
        else if (H.startTime <= N)
          s(g), H.sortIndex = H.expirationTime, a(p, H);
        else break;
        H = o(g);
      }
    }
    function q(N) {
      if (A = !1, z(N), !E)
        if (o(p) !== null)
          E = !0, B || (B = !0, k());
        else {
          var H = o(g);
          H !== null && G(q, H.startTime - N);
        }
    }
    var B = !1, U = -1, Q = 5, Z = -1;
    function ot() {
      return _ ? !0 : !(n.unstable_now() - Z < Q);
    }
    function X() {
      if (_ = !1, B) {
        var N = n.unstable_now();
        Z = N;
        var H = !0;
        try {
          t: {
            E = !1, A && (A = !1, D(U), U = -1), S = !0;
            var Y = b;
            try {
              e: {
                for (z(N), v = o(p); v !== null && !(v.expirationTime > N && ot()); ) {
                  var K = v.callback;
                  if (typeof K == "function") {
                    v.callback = null, b = v.priorityLevel;
                    var tt = K(
                      v.expirationTime <= N
                    );
                    if (N = n.unstable_now(), typeof tt == "function") {
                      v.callback = tt, z(N), H = !0;
                      break e;
                    }
                    v === o(p) && s(p), z(N);
                  } else s(p);
                  v = o(p);
                }
                if (v !== null) H = !0;
                else {
                  var T = o(g);
                  T !== null && G(
                    q,
                    T.startTime - N
                  ), H = !1;
                }
              }
              break t;
            } finally {
              v = null, b = Y, S = !1;
            }
            H = void 0;
          }
        } finally {
          H ? k() : B = !1;
        }
      }
    }
    var k;
    if (typeof w == "function")
      k = function() {
        w(X);
      };
    else if (typeof MessageChannel < "u") {
      var it = new MessageChannel(), O = it.port2;
      it.port1.onmessage = X, k = function() {
        O.postMessage(null);
      };
    } else
      k = function() {
        C(X, 0);
      };
    function G(N, H) {
      U = C(function() {
        N(n.unstable_now());
      }, H);
    }
    n.unstable_IdlePriority = 5, n.unstable_ImmediatePriority = 1, n.unstable_LowPriority = 4, n.unstable_NormalPriority = 3, n.unstable_Profiling = null, n.unstable_UserBlockingPriority = 2, n.unstable_cancelCallback = function(N) {
      N.callback = null;
    }, n.unstable_forceFrameRate = function(N) {
      0 > N || 125 < N ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : Q = 0 < N ? Math.floor(1e3 / N) : 5;
    }, n.unstable_getCurrentPriorityLevel = function() {
      return b;
    }, n.unstable_next = function(N) {
      switch (b) {
        case 1:
        case 2:
        case 3:
          var H = 3;
          break;
        default:
          H = b;
      }
      var Y = b;
      b = H;
      try {
        return N();
      } finally {
        b = Y;
      }
    }, n.unstable_requestPaint = function() {
      _ = !0;
    }, n.unstable_runWithPriority = function(N, H) {
      switch (N) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          N = 3;
      }
      var Y = b;
      b = N;
      try {
        return H();
      } finally {
        b = Y;
      }
    }, n.unstable_scheduleCallback = function(N, H, Y) {
      var K = n.unstable_now();
      switch (typeof Y == "object" && Y !== null ? (Y = Y.delay, Y = typeof Y == "number" && 0 < Y ? K + Y : K) : Y = K, N) {
        case 1:
          var tt = -1;
          break;
        case 2:
          tt = 250;
          break;
        case 5:
          tt = 1073741823;
          break;
        case 4:
          tt = 1e4;
          break;
        default:
          tt = 5e3;
      }
      return tt = Y + tt, N = {
        id: m++,
        callback: H,
        priorityLevel: N,
        startTime: Y,
        expirationTime: tt,
        sortIndex: -1
      }, Y > K ? (N.sortIndex = Y, a(g, N), o(p) === null && N === o(g) && (A ? (D(U), U = -1) : A = !0, G(q, Y - K))) : (N.sortIndex = tt, a(p, N), E || S || (E = !0, B || (B = !0, k()))), N;
    }, n.unstable_shouldYield = ot, n.unstable_wrapCallback = function(N) {
      var H = b;
      return function() {
        var Y = b;
        b = H;
        try {
          return N.apply(this, arguments);
        } finally {
          b = Y;
        }
      };
    };
  })(hf)), hf;
}
var dy;
function ix() {
  return dy || (dy = 1, df.exports = nx()), df.exports;
}
var gf = { exports: {} }, pe = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var hy;
function ax() {
  if (hy) return pe;
  hy = 1;
  var n = Co();
  function a(p) {
    var g = "https://react.dev/errors/" + p;
    if (1 < arguments.length) {
      g += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var m = 2; m < arguments.length; m++)
        g += "&args[]=" + encodeURIComponent(arguments[m]);
    }
    return "Minified React error #" + p + "; visit " + g + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function o() {
  }
  var s = {
    d: {
      f: o,
      r: function() {
        throw Error(a(522));
      },
      D: o,
      C: o,
      L: o,
      m: o,
      X: o,
      S: o,
      M: o
    },
    p: 0,
    findDOMNode: null
  }, u = /* @__PURE__ */ Symbol.for("react.portal");
  function f(p, g, m) {
    var v = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: u,
      key: v == null ? null : "" + v,
      children: p,
      containerInfo: g,
      implementation: m
    };
  }
  var d = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function h(p, g) {
    if (p === "font") return "";
    if (typeof g == "string")
      return g === "use-credentials" ? g : "";
  }
  return pe.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = s, pe.createPortal = function(p, g) {
    var m = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!g || g.nodeType !== 1 && g.nodeType !== 9 && g.nodeType !== 11)
      throw Error(a(299));
    return f(p, g, null, m);
  }, pe.flushSync = function(p) {
    var g = d.T, m = s.p;
    try {
      if (d.T = null, s.p = 2, p) return p();
    } finally {
      d.T = g, s.p = m, s.d.f();
    }
  }, pe.preconnect = function(p, g) {
    typeof p == "string" && (g ? (g = g.crossOrigin, g = typeof g == "string" ? g === "use-credentials" ? g : "" : void 0) : g = null, s.d.C(p, g));
  }, pe.prefetchDNS = function(p) {
    typeof p == "string" && s.d.D(p);
  }, pe.preinit = function(p, g) {
    if (typeof p == "string" && g && typeof g.as == "string") {
      var m = g.as, v = h(m, g.crossOrigin), b = typeof g.integrity == "string" ? g.integrity : void 0, S = typeof g.fetchPriority == "string" ? g.fetchPriority : void 0;
      m === "style" ? s.d.S(
        p,
        typeof g.precedence == "string" ? g.precedence : void 0,
        {
          crossOrigin: v,
          integrity: b,
          fetchPriority: S
        }
      ) : m === "script" && s.d.X(p, {
        crossOrigin: v,
        integrity: b,
        fetchPriority: S,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0
      });
    }
  }, pe.preinitModule = function(p, g) {
    if (typeof p == "string")
      if (typeof g == "object" && g !== null) {
        if (g.as == null || g.as === "script") {
          var m = h(
            g.as,
            g.crossOrigin
          );
          s.d.M(p, {
            crossOrigin: m,
            integrity: typeof g.integrity == "string" ? g.integrity : void 0,
            nonce: typeof g.nonce == "string" ? g.nonce : void 0
          });
        }
      } else g == null && s.d.M(p);
  }, pe.preload = function(p, g) {
    if (typeof p == "string" && typeof g == "object" && g !== null && typeof g.as == "string") {
      var m = g.as, v = h(m, g.crossOrigin);
      s.d.L(p, m, {
        crossOrigin: v,
        integrity: typeof g.integrity == "string" ? g.integrity : void 0,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0,
        type: typeof g.type == "string" ? g.type : void 0,
        fetchPriority: typeof g.fetchPriority == "string" ? g.fetchPriority : void 0,
        referrerPolicy: typeof g.referrerPolicy == "string" ? g.referrerPolicy : void 0,
        imageSrcSet: typeof g.imageSrcSet == "string" ? g.imageSrcSet : void 0,
        imageSizes: typeof g.imageSizes == "string" ? g.imageSizes : void 0,
        media: typeof g.media == "string" ? g.media : void 0
      });
    }
  }, pe.preloadModule = function(p, g) {
    if (typeof p == "string")
      if (g) {
        var m = h(g.as, g.crossOrigin);
        s.d.m(p, {
          as: typeof g.as == "string" && g.as !== "script" ? g.as : void 0,
          crossOrigin: m,
          integrity: typeof g.integrity == "string" ? g.integrity : void 0
        });
      } else s.d.m(p);
  }, pe.requestFormReset = function(p) {
    s.d.r(p);
  }, pe.unstable_batchedUpdates = function(p, g) {
    return p(g);
  }, pe.useFormState = function(p, g, m) {
    return d.H.useFormState(p, g, m);
  }, pe.useFormStatus = function() {
    return d.H.useHostTransitionStatus();
  }, pe.version = "19.2.5", pe;
}
var gy;
function Z0() {
  if (gy) return gf.exports;
  gy = 1;
  function n() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (a) {
        console.error(a);
      }
  }
  return n(), gf.exports = ax(), gf.exports;
}
/**
 * @license React
 * react-dom-client.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var py;
function lx() {
  if (py) return no;
  py = 1;
  var n = ix(), a = Co(), o = Z0();
  function s(t) {
    var e = "https://react.dev/errors/" + t;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var i = 2; i < arguments.length; i++)
        e += "&args[]=" + encodeURIComponent(arguments[i]);
    }
    return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function u(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function f(t) {
    var e = t, i = t;
    if (t.alternate) for (; e.return; ) e = e.return;
    else {
      t = e;
      do
        e = t, (e.flags & 4098) !== 0 && (i = e.return), t = e.return;
      while (t);
    }
    return e.tag === 3 ? i : null;
  }
  function d(t) {
    if (t.tag === 13) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function h(t) {
    if (t.tag === 31) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function p(t) {
    if (f(t) !== t)
      throw Error(s(188));
  }
  function g(t) {
    var e = t.alternate;
    if (!e) {
      if (e = f(t), e === null) throw Error(s(188));
      return e !== t ? null : t;
    }
    for (var i = t, l = e; ; ) {
      var r = i.return;
      if (r === null) break;
      var c = r.alternate;
      if (c === null) {
        if (l = r.return, l !== null) {
          i = l;
          continue;
        }
        break;
      }
      if (r.child === c.child) {
        for (c = r.child; c; ) {
          if (c === i) return p(r), t;
          if (c === l) return p(r), e;
          c = c.sibling;
        }
        throw Error(s(188));
      }
      if (i.return !== l.return) i = r, l = c;
      else {
        for (var y = !1, x = r.child; x; ) {
          if (x === i) {
            y = !0, i = r, l = c;
            break;
          }
          if (x === l) {
            y = !0, l = r, i = c;
            break;
          }
          x = x.sibling;
        }
        if (!y) {
          for (x = c.child; x; ) {
            if (x === i) {
              y = !0, i = c, l = r;
              break;
            }
            if (x === l) {
              y = !0, l = c, i = r;
              break;
            }
            x = x.sibling;
          }
          if (!y) throw Error(s(189));
        }
      }
      if (i.alternate !== l) throw Error(s(190));
    }
    if (i.tag !== 3) throw Error(s(188));
    return i.stateNode.current === i ? t : e;
  }
  function m(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t;
    for (t = t.child; t !== null; ) {
      if (e = m(t), e !== null) return e;
      t = t.sibling;
    }
    return null;
  }
  var v = Object.assign, b = /* @__PURE__ */ Symbol.for("react.element"), S = /* @__PURE__ */ Symbol.for("react.transitional.element"), E = /* @__PURE__ */ Symbol.for("react.portal"), A = /* @__PURE__ */ Symbol.for("react.fragment"), _ = /* @__PURE__ */ Symbol.for("react.strict_mode"), C = /* @__PURE__ */ Symbol.for("react.profiler"), D = /* @__PURE__ */ Symbol.for("react.consumer"), w = /* @__PURE__ */ Symbol.for("react.context"), z = /* @__PURE__ */ Symbol.for("react.forward_ref"), q = /* @__PURE__ */ Symbol.for("react.suspense"), B = /* @__PURE__ */ Symbol.for("react.suspense_list"), U = /* @__PURE__ */ Symbol.for("react.memo"), Q = /* @__PURE__ */ Symbol.for("react.lazy"), Z = /* @__PURE__ */ Symbol.for("react.activity"), ot = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), X = Symbol.iterator;
  function k(t) {
    return t === null || typeof t != "object" ? null : (t = X && t[X] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var it = /* @__PURE__ */ Symbol.for("react.client.reference");
  function O(t) {
    if (t == null) return null;
    if (typeof t == "function")
      return t.$$typeof === it ? null : t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case A:
        return "Fragment";
      case C:
        return "Profiler";
      case _:
        return "StrictMode";
      case q:
        return "Suspense";
      case B:
        return "SuspenseList";
      case Z:
        return "Activity";
    }
    if (typeof t == "object")
      switch (t.$$typeof) {
        case E:
          return "Portal";
        case w:
          return t.displayName || "Context";
        case D:
          return (t._context.displayName || "Context") + ".Consumer";
        case z:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case U:
          return e = t.displayName || null, e !== null ? e : O(t.type) || "Memo";
        case Q:
          e = t._payload, t = t._init;
          try {
            return O(t(e));
          } catch {
          }
      }
    return null;
  }
  var G = Array.isArray, N = a.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, H = o.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Y = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, K = [], tt = -1;
  function T(t) {
    return { current: t };
  }
  function j(t) {
    0 > tt || (t.current = K[tt], K[tt] = null, tt--);
  }
  function P(t, e) {
    tt++, K[tt] = t.current, t.current = e;
  }
  var et = T(null), rt = T(null), ct = T(null), ut = T(null);
  function st(t, e) {
    switch (P(ct, e), P(rt, t), P(et, null), e.nodeType) {
      case 9:
      case 11:
        t = (t = e.documentElement) && (t = t.namespaceURI) ? zp(t) : 0;
        break;
      default:
        if (t = e.tagName, e = e.namespaceURI)
          e = zp(e), t = Op(e, t);
        else
          switch (t) {
            case "svg":
              t = 1;
              break;
            case "math":
              t = 2;
              break;
            default:
              t = 0;
          }
    }
    j(et), P(et, t);
  }
  function ft() {
    j(et), j(rt), j(ct);
  }
  function wt(t) {
    t.memoizedState !== null && P(ut, t);
    var e = et.current, i = Op(e, t.type);
    e !== i && (P(rt, t), P(et, i));
  }
  function xt(t) {
    rt.current === t && (j(et), j(rt)), ut.current === t && (j(ut), Il._currentValue = Y);
  }
  var yt, vt;
  function Nt(t) {
    if (yt === void 0)
      try {
        throw Error();
      } catch (i) {
        var e = i.stack.trim().match(/\n( *(at )?)/);
        yt = e && e[1] || "", vt = -1 < i.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < i.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + yt + t + vt;
  }
  var Bt = !1;
  function Ht(t, e) {
    if (!t || Bt) return "";
    Bt = !0;
    var i = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var l = {
        DetermineComponentFrameRoot: function() {
          try {
            if (e) {
              var lt = function() {
                throw Error();
              };
              if (Object.defineProperty(lt.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(lt, []);
                } catch (W) {
                  var I = W;
                }
                Reflect.construct(t, [], lt);
              } else {
                try {
                  lt.call();
                } catch (W) {
                  I = W;
                }
                t.call(lt.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (W) {
                I = W;
              }
              (lt = t()) && typeof lt.catch == "function" && lt.catch(function() {
              });
            }
          } catch (W) {
            if (W && I && typeof W.stack == "string")
              return [W.stack, I.stack];
          }
          return [null, null];
        }
      };
      l.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var r = Object.getOwnPropertyDescriptor(
        l.DetermineComponentFrameRoot,
        "name"
      );
      r && r.configurable && Object.defineProperty(
        l.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var c = l.DetermineComponentFrameRoot(), y = c[0], x = c[1];
      if (y && x) {
        var R = y.split(`
`), J = x.split(`
`);
        for (r = l = 0; l < R.length && !R[l].includes("DetermineComponentFrameRoot"); )
          l++;
        for (; r < J.length && !J[r].includes(
          "DetermineComponentFrameRoot"
        ); )
          r++;
        if (l === R.length || r === J.length)
          for (l = R.length - 1, r = J.length - 1; 1 <= l && 0 <= r && R[l] !== J[r]; )
            r--;
        for (; 1 <= l && 0 <= r; l--, r--)
          if (R[l] !== J[r]) {
            if (l !== 1 || r !== 1)
              do
                if (l--, r--, 0 > r || R[l] !== J[r]) {
                  var nt = `
` + R[l].replace(" at new ", " at ");
                  return t.displayName && nt.includes("<anonymous>") && (nt = nt.replace("<anonymous>", t.displayName)), nt;
                }
              while (1 <= l && 0 <= r);
            break;
          }
      }
    } finally {
      Bt = !1, Error.prepareStackTrace = i;
    }
    return (i = t ? t.displayName || t.name : "") ? Nt(i) : "";
  }
  function oe(t, e) {
    switch (t.tag) {
      case 26:
      case 27:
      case 5:
        return Nt(t.type);
      case 16:
        return Nt("Lazy");
      case 13:
        return t.child !== e && e !== null ? Nt("Suspense Fallback") : Nt("Suspense");
      case 19:
        return Nt("SuspenseList");
      case 0:
      case 15:
        return Ht(t.type, !1);
      case 11:
        return Ht(t.type.render, !1);
      case 1:
        return Ht(t.type, !0);
      case 31:
        return Nt("Activity");
      default:
        return "";
    }
  }
  function Je(t) {
    try {
      var e = "", i = null;
      do
        e += oe(t, i), i = t, t = t.return;
      while (t);
      return e;
    } catch (l) {
      return `
Error generating stack: ` + l.message + `
` + l.stack;
    }
  }
  var ze = Object.prototype.hasOwnProperty, Fe = n.unstable_scheduleCallback, vn = n.unstable_cancelCallback, Ti = n.unstable_shouldYield, Ai = n.unstable_requestPaint, re = n.unstable_now, sa = n.unstable_getCurrentPriorityLevel, bn = n.unstable_ImmediatePriority, Kn = n.unstable_UserBlockingPriority, Mi = n.unstable_NormalPriority, Gr = n.unstable_LowPriority, ra = n.unstable_IdlePriority, Zr = n.log, Kr = n.unstable_setDisableYieldValue, zi = null, ye = null;
  function sn(t) {
    if (typeof Zr == "function" && Kr(t), ye && typeof ye.setStrictMode == "function")
      try {
        ye.setStrictMode(zi, t);
      } catch {
      }
  }
  var me = Math.clz32 ? Math.clz32 : Fr, $r = Math.log, Jr = Math.LN2;
  function Fr(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - ($r(t) / Jr | 0) | 0;
  }
  var ua = 256, ca = 262144, fa = 4194304;
  function xn(t) {
    var e = t & 42;
    if (e !== 0) return e;
    switch (t & -t) {
      case 1:
        return 1;
      case 2:
        return 2;
      case 4:
        return 4;
      case 8:
        return 8;
      case 16:
        return 16;
      case 32:
        return 32;
      case 64:
        return 64;
      case 128:
        return 128;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
        return t & 261888;
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return t & 3932160;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return t & 62914560;
      case 67108864:
        return 67108864;
      case 134217728:
        return 134217728;
      case 268435456:
        return 268435456;
      case 536870912:
        return 536870912;
      case 1073741824:
        return 0;
      default:
        return t;
    }
  }
  function da(t, e, i) {
    var l = t.pendingLanes;
    if (l === 0) return 0;
    var r = 0, c = t.suspendedLanes, y = t.pingedLanes;
    t = t.warmLanes;
    var x = l & 134217727;
    return x !== 0 ? (l = x & ~c, l !== 0 ? r = xn(l) : (y &= x, y !== 0 ? r = xn(y) : i || (i = x & ~t, i !== 0 && (r = xn(i))))) : (x = l & ~c, x !== 0 ? r = xn(x) : y !== 0 ? r = xn(y) : i || (i = l & ~t, i !== 0 && (r = xn(i)))), r === 0 ? 0 : e !== 0 && e !== r && (e & c) === 0 && (c = r & -r, i = e & -e, c >= i || c === 32 && (i & 4194048) !== 0) ? e : r;
  }
  function Oi(t, e) {
    return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
  }
  function Ir(t, e) {
    switch (t) {
      case 1:
      case 2:
      case 4:
      case 8:
      case 64:
        return e + 250;
      case 16:
      case 32:
      case 128:
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
        return e + 5e3;
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        return -1;
      case 67108864:
      case 134217728:
      case 268435456:
      case 536870912:
      case 1073741824:
        return -1;
      default:
        return -1;
    }
  }
  function Ro() {
    var t = fa;
    return fa <<= 1, (fa & 62914560) === 0 && (fa = 4194304), t;
  }
  function rl(t) {
    for (var e = [], i = 0; 31 > i; i++) e.push(t);
    return e;
  }
  function Di(t, e) {
    t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
  }
  function Wr(t, e, i, l, r, c) {
    var y = t.pendingLanes;
    t.pendingLanes = i, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= i, t.entangledLanes &= i, t.errorRecoveryDisabledLanes &= i, t.shellSuspendCounter = 0;
    var x = t.entanglements, R = t.expirationTimes, J = t.hiddenUpdates;
    for (i = y & ~i; 0 < i; ) {
      var nt = 31 - me(i), lt = 1 << nt;
      x[nt] = 0, R[nt] = -1;
      var I = J[nt];
      if (I !== null)
        for (J[nt] = null, nt = 0; nt < I.length; nt++) {
          var W = I[nt];
          W !== null && (W.lane &= -536870913);
        }
      i &= ~lt;
    }
    l !== 0 && Ho(t, l, 0), c !== 0 && r === 0 && t.tag !== 0 && (t.suspendedLanes |= c & ~(y & ~e));
  }
  function Ho(t, e, i) {
    t.pendingLanes |= e, t.suspendedLanes &= ~e;
    var l = 31 - me(e);
    t.entangledLanes |= e, t.entanglements[l] = t.entanglements[l] | 1073741824 | i & 261930;
  }
  function jo(t, e) {
    var i = t.entangledLanes |= e;
    for (t = t.entanglements; i; ) {
      var l = 31 - me(i), r = 1 << l;
      r & e | t[l] & e && (t[l] |= e), i &= ~r;
    }
  }
  function Uo(t, e) {
    var i = e & -e;
    return i = (i & 42) !== 0 ? 1 : ul(i), (i & (t.suspendedLanes | e)) !== 0 ? 0 : i;
  }
  function ul(t) {
    switch (t) {
      case 2:
        t = 1;
        break;
      case 8:
        t = 4;
        break;
      case 32:
        t = 16;
        break;
      case 256:
      case 512:
      case 1024:
      case 2048:
      case 4096:
      case 8192:
      case 16384:
      case 32768:
      case 65536:
      case 131072:
      case 262144:
      case 524288:
      case 1048576:
      case 2097152:
      case 4194304:
      case 8388608:
      case 16777216:
      case 33554432:
        t = 128;
        break;
      case 268435456:
        t = 134217728;
        break;
      default:
        t = 0;
    }
    return t;
  }
  function cl(t) {
    return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function Bo() {
    var t = H.p;
    return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : ty(t.type));
  }
  function Lo(t, e) {
    var i = H.p;
    try {
      return H.p = t, e();
    } finally {
      H.p = i;
    }
  }
  var rn = Math.random().toString(36).slice(2), ae = "__reactFiber$" + rn, ge = "__reactProps$" + rn, Sn = "__reactContainer$" + rn, ha = "__reactEvents$" + rn, qo = "__reactListeners$" + rn, Pr = "__reactHandles$" + rn, Yo = "__reactResources$" + rn, Ri = "__reactMarker$" + rn;
  function fl(t) {
    delete t[ae], delete t[ge], delete t[ha], delete t[qo], delete t[Pr];
  }
  function $n(t) {
    var e = t[ae];
    if (e) return e;
    for (var i = t.parentNode; i; ) {
      if (e = i[Sn] || i[ae]) {
        if (i = e.alternate, e.child !== null || i !== null && i.child !== null)
          for (t = Lp(t); t !== null; ) {
            if (i = t[ae]) return i;
            t = Lp(t);
          }
        return e;
      }
      t = i, i = t.parentNode;
    }
    return null;
  }
  function Jn(t) {
    if (t = t[ae] || t[Sn]) {
      var e = t.tag;
      if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3)
        return t;
    }
    return null;
  }
  function Fn(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
    throw Error(s(33));
  }
  function In(t) {
    var e = t[Yo];
    return e || (e = t[Yo] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), e;
  }
  function It(t) {
    t[Ri] = !0;
  }
  var Vo = /* @__PURE__ */ new Set(), Qo = {};
  function wn(t, e) {
    Wn(t, e), Wn(t + "Capture", e);
  }
  function Wn(t, e) {
    for (Qo[t] = e, t = 0; t < e.length; t++)
      Vo.add(e[t]);
  }
  var tu = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), dl = {}, Xo = {};
  function eu(t) {
    return ze.call(Xo, t) ? !0 : ze.call(dl, t) ? !1 : tu.test(t) ? Xo[t] = !0 : (dl[t] = !0, !1);
  }
  function ga(t, e, i) {
    if (eu(e))
      if (i === null) t.removeAttribute(e);
      else {
        switch (typeof i) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var l = e.toLowerCase().slice(0, 5);
            if (l !== "data-" && l !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, "" + i);
      }
  }
  function pa(t, e, i) {
    if (i === null) t.removeAttribute(e);
    else {
      switch (typeof i) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(e);
          return;
      }
      t.setAttribute(e, "" + i);
    }
  }
  function Ie(t, e, i, l) {
    if (l === null) t.removeAttribute(i);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(i);
          return;
      }
      t.setAttributeNS(e, i, "" + l);
    }
  }
  function xe(t) {
    switch (typeof t) {
      case "bigint":
      case "boolean":
      case "number":
      case "string":
      case "undefined":
        return t;
      case "object":
        return t;
      default:
        return "";
    }
  }
  function ko(t) {
    var e = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
  }
  function nu(t, e, i) {
    var l = Object.getOwnPropertyDescriptor(
      t.constructor.prototype,
      e
    );
    if (!t.hasOwnProperty(e) && typeof l < "u" && typeof l.get == "function" && typeof l.set == "function") {
      var r = l.get, c = l.set;
      return Object.defineProperty(t, e, {
        configurable: !0,
        get: function() {
          return r.call(this);
        },
        set: function(y) {
          i = "" + y, c.call(this, y);
        }
      }), Object.defineProperty(t, e, {
        enumerable: l.enumerable
      }), {
        getValue: function() {
          return i;
        },
        setValue: function(y) {
          i = "" + y;
        },
        stopTracking: function() {
          t._valueTracker = null, delete t[e];
        }
      };
    }
  }
  function ya(t) {
    if (!t._valueTracker) {
      var e = ko(t) ? "checked" : "value";
      t._valueTracker = nu(
        t,
        e,
        "" + t[e]
      );
    }
  }
  function Go(t) {
    if (!t) return !1;
    var e = t._valueTracker;
    if (!e) return !0;
    var i = e.getValue(), l = "";
    return t && (l = ko(t) ? t.checked ? "true" : "false" : t.value), t = l, t !== i ? (e.setValue(t), !0) : !1;
  }
  function Hi(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  var iu = /[\n"\\]/g;
  function Se(t) {
    return t.replace(
      iu,
      function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function ji(t, e, i, l, r, c, y, x) {
    t.name = "", y != null && typeof y != "function" && typeof y != "symbol" && typeof y != "boolean" ? t.type = y : t.removeAttribute("type"), e != null ? y === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + xe(e)) : t.value !== "" + xe(e) && (t.value = "" + xe(e)) : y !== "submit" && y !== "reset" || t.removeAttribute("value"), e != null ? hl(t, y, xe(e)) : i != null ? hl(t, y, xe(i)) : l != null && t.removeAttribute("value"), r == null && c != null && (t.defaultChecked = !!c), r != null && (t.checked = r && typeof r != "function" && typeof r != "symbol"), x != null && typeof x != "function" && typeof x != "symbol" && typeof x != "boolean" ? t.name = "" + xe(x) : t.removeAttribute("name");
  }
  function Zo(t, e, i, l, r, c, y, x) {
    if (c != null && typeof c != "function" && typeof c != "symbol" && typeof c != "boolean" && (t.type = c), e != null || i != null) {
      if (!(c !== "submit" && c !== "reset" || e != null)) {
        ya(t);
        return;
      }
      i = i != null ? "" + xe(i) : "", e = e != null ? "" + xe(e) : i, x || e === t.value || (t.value = e), t.defaultValue = e;
    }
    l = l ?? r, l = typeof l != "function" && typeof l != "symbol" && !!l, t.checked = x ? t.checked : !!l, t.defaultChecked = !!l, y != null && typeof y != "function" && typeof y != "symbol" && typeof y != "boolean" && (t.name = y), ya(t);
  }
  function hl(t, e, i) {
    e === "number" && Hi(t.ownerDocument) === t || t.defaultValue === "" + i || (t.defaultValue = "" + i);
  }
  function En(t, e, i, l) {
    if (t = t.options, e) {
      e = {};
      for (var r = 0; r < i.length; r++)
        e["$" + i[r]] = !0;
      for (i = 0; i < t.length; i++)
        r = e.hasOwnProperty("$" + t[i].value), t[i].selected !== r && (t[i].selected = r), r && l && (t[i].defaultSelected = !0);
    } else {
      for (i = "" + xe(i), e = null, r = 0; r < t.length; r++) {
        if (t[r].value === i) {
          t[r].selected = !0, l && (t[r].defaultSelected = !0);
          return;
        }
        e !== null || t[r].disabled || (e = t[r]);
      }
      e !== null && (e.selected = !0);
    }
  }
  function Cd(t, e, i) {
    if (e != null && (e = "" + xe(e), e !== t.value && (t.value = e), i == null)) {
      t.defaultValue !== e && (t.defaultValue = e);
      return;
    }
    t.defaultValue = i != null ? "" + xe(i) : "";
  }
  function Nd(t, e, i, l) {
    if (e == null) {
      if (l != null) {
        if (i != null) throw Error(s(92));
        if (G(l)) {
          if (1 < l.length) throw Error(s(93));
          l = l[0];
        }
        i = l;
      }
      i == null && (i = ""), e = i;
    }
    i = xe(e), t.defaultValue = i, l = t.textContent, l === i && l !== "" && l !== null && (t.value = l), ya(t);
  }
  function ma(t, e) {
    if (e) {
      var i = t.firstChild;
      if (i && i === t.lastChild && i.nodeType === 3) {
        i.nodeValue = e;
        return;
      }
    }
    t.textContent = e;
  }
  var Kv = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function Td(t, e, i) {
    var l = e.indexOf("--") === 0;
    i == null || typeof i == "boolean" || i === "" ? l ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : l ? t.setProperty(e, i) : typeof i != "number" || i === 0 || Kv.has(e) ? e === "float" ? t.cssFloat = i : t[e] = ("" + i).trim() : t[e] = i + "px";
  }
  function Ad(t, e, i) {
    if (e != null && typeof e != "object")
      throw Error(s(62));
    if (t = t.style, i != null) {
      for (var l in i)
        !i.hasOwnProperty(l) || e != null && e.hasOwnProperty(l) || (l.indexOf("--") === 0 ? t.setProperty(l, "") : l === "float" ? t.cssFloat = "" : t[l] = "");
      for (var r in e)
        l = e[r], e.hasOwnProperty(r) && i[r] !== l && Td(t, r, l);
    } else
      for (var c in e)
        e.hasOwnProperty(c) && Td(t, c, e[c]);
  }
  function au(t) {
    if (t.indexOf("-") === -1) return !1;
    switch (t) {
      case "annotation-xml":
      case "color-profile":
      case "font-face":
      case "font-face-src":
      case "font-face-uri":
      case "font-face-format":
      case "font-face-name":
      case "missing-glyph":
        return !1;
      default:
        return !0;
    }
  }
  var $v = /* @__PURE__ */ new Map([
    ["acceptCharset", "accept-charset"],
    ["htmlFor", "for"],
    ["httpEquiv", "http-equiv"],
    ["crossOrigin", "crossorigin"],
    ["accentHeight", "accent-height"],
    ["alignmentBaseline", "alignment-baseline"],
    ["arabicForm", "arabic-form"],
    ["baselineShift", "baseline-shift"],
    ["capHeight", "cap-height"],
    ["clipPath", "clip-path"],
    ["clipRule", "clip-rule"],
    ["colorInterpolation", "color-interpolation"],
    ["colorInterpolationFilters", "color-interpolation-filters"],
    ["colorProfile", "color-profile"],
    ["colorRendering", "color-rendering"],
    ["dominantBaseline", "dominant-baseline"],
    ["enableBackground", "enable-background"],
    ["fillOpacity", "fill-opacity"],
    ["fillRule", "fill-rule"],
    ["floodColor", "flood-color"],
    ["floodOpacity", "flood-opacity"],
    ["fontFamily", "font-family"],
    ["fontSize", "font-size"],
    ["fontSizeAdjust", "font-size-adjust"],
    ["fontStretch", "font-stretch"],
    ["fontStyle", "font-style"],
    ["fontVariant", "font-variant"],
    ["fontWeight", "font-weight"],
    ["glyphName", "glyph-name"],
    ["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
    ["glyphOrientationVertical", "glyph-orientation-vertical"],
    ["horizAdvX", "horiz-adv-x"],
    ["horizOriginX", "horiz-origin-x"],
    ["imageRendering", "image-rendering"],
    ["letterSpacing", "letter-spacing"],
    ["lightingColor", "lighting-color"],
    ["markerEnd", "marker-end"],
    ["markerMid", "marker-mid"],
    ["markerStart", "marker-start"],
    ["overlinePosition", "overline-position"],
    ["overlineThickness", "overline-thickness"],
    ["paintOrder", "paint-order"],
    ["panose-1", "panose-1"],
    ["pointerEvents", "pointer-events"],
    ["renderingIntent", "rendering-intent"],
    ["shapeRendering", "shape-rendering"],
    ["stopColor", "stop-color"],
    ["stopOpacity", "stop-opacity"],
    ["strikethroughPosition", "strikethrough-position"],
    ["strikethroughThickness", "strikethrough-thickness"],
    ["strokeDasharray", "stroke-dasharray"],
    ["strokeDashoffset", "stroke-dashoffset"],
    ["strokeLinecap", "stroke-linecap"],
    ["strokeLinejoin", "stroke-linejoin"],
    ["strokeMiterlimit", "stroke-miterlimit"],
    ["strokeOpacity", "stroke-opacity"],
    ["strokeWidth", "stroke-width"],
    ["textAnchor", "text-anchor"],
    ["textDecoration", "text-decoration"],
    ["textRendering", "text-rendering"],
    ["transformOrigin", "transform-origin"],
    ["underlinePosition", "underline-position"],
    ["underlineThickness", "underline-thickness"],
    ["unicodeBidi", "unicode-bidi"],
    ["unicodeRange", "unicode-range"],
    ["unitsPerEm", "units-per-em"],
    ["vAlphabetic", "v-alphabetic"],
    ["vHanging", "v-hanging"],
    ["vIdeographic", "v-ideographic"],
    ["vMathematical", "v-mathematical"],
    ["vectorEffect", "vector-effect"],
    ["vertAdvY", "vert-adv-y"],
    ["vertOriginX", "vert-origin-x"],
    ["vertOriginY", "vert-origin-y"],
    ["wordSpacing", "word-spacing"],
    ["writingMode", "writing-mode"],
    ["xmlnsXlink", "xmlns:xlink"],
    ["xHeight", "x-height"]
  ]), Jv = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function Ko(t) {
    return Jv.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
  }
  function _n() {
  }
  var lu = null;
  function ou(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var va = null, ba = null;
  function Md(t) {
    var e = Jn(t);
    if (e && (t = e.stateNode)) {
      var i = t[ge] || null;
      t: switch (t = e.stateNode, e.type) {
        case "input":
          if (ji(
            t,
            i.value,
            i.defaultValue,
            i.defaultValue,
            i.checked,
            i.defaultChecked,
            i.type,
            i.name
          ), e = i.name, i.type === "radio" && e != null) {
            for (i = t; i.parentNode; ) i = i.parentNode;
            for (i = i.querySelectorAll(
              'input[name="' + Se(
                "" + e
              ) + '"][type="radio"]'
            ), e = 0; e < i.length; e++) {
              var l = i[e];
              if (l !== t && l.form === t.form) {
                var r = l[ge] || null;
                if (!r) throw Error(s(90));
                ji(
                  l,
                  r.value,
                  r.defaultValue,
                  r.defaultValue,
                  r.checked,
                  r.defaultChecked,
                  r.type,
                  r.name
                );
              }
            }
            for (e = 0; e < i.length; e++)
              l = i[e], l.form === t.form && Go(l);
          }
          break t;
        case "textarea":
          Cd(t, i.value, i.defaultValue);
          break t;
        case "select":
          e = i.value, e != null && En(t, !!i.multiple, e, !1);
      }
    }
  }
  var su = !1;
  function zd(t, e, i) {
    if (su) return t(e, i);
    su = !0;
    try {
      var l = t(e);
      return l;
    } finally {
      if (su = !1, (va !== null || ba !== null) && (Hs(), va && (e = va, t = ba, ba = va = null, Md(e), t)))
        for (e = 0; e < t.length; e++) Md(t[e]);
    }
  }
  function gl(t, e) {
    var i = t.stateNode;
    if (i === null) return null;
    var l = i[ge] || null;
    if (l === null) return null;
    i = l[e];
    t: switch (e) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (l = !l.disabled) || (t = t.type, l = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !l;
        break t;
      default:
        t = !1;
    }
    if (t) return null;
    if (i && typeof i != "function")
      throw Error(
        s(231, e, typeof i)
      );
    return i;
  }
  var Cn = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), ru = !1;
  if (Cn)
    try {
      var pl = {};
      Object.defineProperty(pl, "passive", {
        get: function() {
          ru = !0;
        }
      }), window.addEventListener("test", pl, pl), window.removeEventListener("test", pl, pl);
    } catch {
      ru = !1;
    }
  var Pn = null, uu = null, $o = null;
  function Od() {
    if ($o) return $o;
    var t, e = uu, i = e.length, l, r = "value" in Pn ? Pn.value : Pn.textContent, c = r.length;
    for (t = 0; t < i && e[t] === r[t]; t++) ;
    var y = i - t;
    for (l = 1; l <= y && e[i - l] === r[c - l]; l++) ;
    return $o = r.slice(t, 1 < l ? 1 - l : void 0);
  }
  function Jo(t) {
    var e = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function Fo() {
    return !0;
  }
  function Dd() {
    return !1;
  }
  function we(t) {
    function e(i, l, r, c, y) {
      this._reactName = i, this._targetInst = r, this.type = l, this.nativeEvent = c, this.target = y, this.currentTarget = null;
      for (var x in t)
        t.hasOwnProperty(x) && (i = t[x], this[x] = i ? i(c) : c[x]);
      return this.isDefaultPrevented = (c.defaultPrevented != null ? c.defaultPrevented : c.returnValue === !1) ? Fo : Dd, this.isPropagationStopped = Dd, this;
    }
    return v(e.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var i = this.nativeEvent;
        i && (i.preventDefault ? i.preventDefault() : typeof i.returnValue != "unknown" && (i.returnValue = !1), this.isDefaultPrevented = Fo);
      },
      stopPropagation: function() {
        var i = this.nativeEvent;
        i && (i.stopPropagation ? i.stopPropagation() : typeof i.cancelBubble != "unknown" && (i.cancelBubble = !0), this.isPropagationStopped = Fo);
      },
      persist: function() {
      },
      isPersistent: Fo
    }), e;
  }
  var Ui = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(t) {
      return t.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, Io = we(Ui), yl = v({}, Ui, { view: 0, detail: 0 }), Fv = we(yl), cu, fu, ml, Wo = v({}, yl, {
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: hu,
    button: 0,
    buttons: 0,
    relatedTarget: function(t) {
      return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
    },
    movementX: function(t) {
      return "movementX" in t ? t.movementX : (t !== ml && (ml && t.type === "mousemove" ? (cu = t.screenX - ml.screenX, fu = t.screenY - ml.screenY) : fu = cu = 0, ml = t), cu);
    },
    movementY: function(t) {
      return "movementY" in t ? t.movementY : fu;
    }
  }), Rd = we(Wo), Iv = v({}, Wo, { dataTransfer: 0 }), Wv = we(Iv), Pv = v({}, yl, { relatedTarget: 0 }), du = we(Pv), t1 = v({}, Ui, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), e1 = we(t1), n1 = v({}, Ui, {
    clipboardData: function(t) {
      return "clipboardData" in t ? t.clipboardData : window.clipboardData;
    }
  }), i1 = we(n1), a1 = v({}, Ui, { data: 0 }), Hd = we(a1), l1 = {
    Esc: "Escape",
    Spacebar: " ",
    Left: "ArrowLeft",
    Up: "ArrowUp",
    Right: "ArrowRight",
    Down: "ArrowDown",
    Del: "Delete",
    Win: "OS",
    Menu: "ContextMenu",
    Apps: "ContextMenu",
    Scroll: "ScrollLock",
    MozPrintableKey: "Unidentified"
  }, o1 = {
    8: "Backspace",
    9: "Tab",
    12: "Clear",
    13: "Enter",
    16: "Shift",
    17: "Control",
    18: "Alt",
    19: "Pause",
    20: "CapsLock",
    27: "Escape",
    32: " ",
    33: "PageUp",
    34: "PageDown",
    35: "End",
    36: "Home",
    37: "ArrowLeft",
    38: "ArrowUp",
    39: "ArrowRight",
    40: "ArrowDown",
    45: "Insert",
    46: "Delete",
    112: "F1",
    113: "F2",
    114: "F3",
    115: "F4",
    116: "F5",
    117: "F6",
    118: "F7",
    119: "F8",
    120: "F9",
    121: "F10",
    122: "F11",
    123: "F12",
    144: "NumLock",
    145: "ScrollLock",
    224: "Meta"
  }, s1 = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function r1(t) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(t) : (t = s1[t]) ? !!e[t] : !1;
  }
  function hu() {
    return r1;
  }
  var u1 = v({}, yl, {
    key: function(t) {
      if (t.key) {
        var e = l1[t.key] || t.key;
        if (e !== "Unidentified") return e;
      }
      return t.type === "keypress" ? (t = Jo(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? o1[t.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: hu,
    charCode: function(t) {
      return t.type === "keypress" ? Jo(t) : 0;
    },
    keyCode: function(t) {
      return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    },
    which: function(t) {
      return t.type === "keypress" ? Jo(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    }
  }), c1 = we(u1), f1 = v({}, Wo, {
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0
  }), jd = we(f1), d1 = v({}, yl, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: hu
  }), h1 = we(d1), g1 = v({}, Ui, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), p1 = we(g1), y1 = v({}, Wo, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), m1 = we(y1), v1 = v({}, Ui, {
    newState: 0,
    oldState: 0
  }), b1 = we(v1), x1 = [9, 13, 27, 32], gu = Cn && "CompositionEvent" in window, vl = null;
  Cn && "documentMode" in document && (vl = document.documentMode);
  var S1 = Cn && "TextEvent" in window && !vl, Ud = Cn && (!gu || vl && 8 < vl && 11 >= vl), Bd = " ", Ld = !1;
  function qd(t, e) {
    switch (t) {
      case "keyup":
        return x1.indexOf(e.keyCode) !== -1;
      case "keydown":
        return e.keyCode !== 229;
      case "keypress":
      case "mousedown":
      case "focusout":
        return !0;
      default:
        return !1;
    }
  }
  function Yd(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var xa = !1;
  function w1(t, e) {
    switch (t) {
      case "compositionend":
        return Yd(e);
      case "keypress":
        return e.which !== 32 ? null : (Ld = !0, Bd);
      case "textInput":
        return t = e.data, t === Bd && Ld ? null : t;
      default:
        return null;
    }
  }
  function E1(t, e) {
    if (xa)
      return t === "compositionend" || !gu && qd(t, e) ? (t = Od(), $o = uu = Pn = null, xa = !1, t) : null;
    switch (t) {
      case "paste":
        return null;
      case "keypress":
        if (!(e.ctrlKey || e.altKey || e.metaKey) || e.ctrlKey && e.altKey) {
          if (e.char && 1 < e.char.length)
            return e.char;
          if (e.which) return String.fromCharCode(e.which);
        }
        return null;
      case "compositionend":
        return Ud && e.locale !== "ko" ? null : e.data;
      default:
        return null;
    }
  }
  var _1 = {
    color: !0,
    date: !0,
    datetime: !0,
    "datetime-local": !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0
  };
  function Vd(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e === "input" ? !!_1[t.type] : e === "textarea";
  }
  function Qd(t, e, i, l) {
    va ? ba ? ba.push(l) : ba = [l] : va = l, e = Vs(e, "onChange"), 0 < e.length && (i = new Io(
      "onChange",
      "change",
      null,
      i,
      l
    ), t.push({ event: i, listeners: e }));
  }
  var bl = null, xl = null;
  function C1(t) {
    _p(t, 0);
  }
  function Po(t) {
    var e = Fn(t);
    if (Go(e)) return t;
  }
  function Xd(t, e) {
    if (t === "change") return e;
  }
  var kd = !1;
  if (Cn) {
    var pu;
    if (Cn) {
      var yu = "oninput" in document;
      if (!yu) {
        var Gd = document.createElement("div");
        Gd.setAttribute("oninput", "return;"), yu = typeof Gd.oninput == "function";
      }
      pu = yu;
    } else pu = !1;
    kd = pu && (!document.documentMode || 9 < document.documentMode);
  }
  function Zd() {
    bl && (bl.detachEvent("onpropertychange", Kd), xl = bl = null);
  }
  function Kd(t) {
    if (t.propertyName === "value" && Po(xl)) {
      var e = [];
      Qd(
        e,
        xl,
        t,
        ou(t)
      ), zd(C1, e);
    }
  }
  function N1(t, e, i) {
    t === "focusin" ? (Zd(), bl = e, xl = i, bl.attachEvent("onpropertychange", Kd)) : t === "focusout" && Zd();
  }
  function T1(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown")
      return Po(xl);
  }
  function A1(t, e) {
    if (t === "click") return Po(e);
  }
  function M1(t, e) {
    if (t === "input" || t === "change")
      return Po(e);
  }
  function z1(t, e) {
    return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
  }
  var Oe = typeof Object.is == "function" ? Object.is : z1;
  function Sl(t, e) {
    if (Oe(t, e)) return !0;
    if (typeof t != "object" || t === null || typeof e != "object" || e === null)
      return !1;
    var i = Object.keys(t), l = Object.keys(e);
    if (i.length !== l.length) return !1;
    for (l = 0; l < i.length; l++) {
      var r = i[l];
      if (!ze.call(e, r) || !Oe(t[r], e[r]))
        return !1;
    }
    return !0;
  }
  function $d(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function Jd(t, e) {
    var i = $d(t);
    t = 0;
    for (var l; i; ) {
      if (i.nodeType === 3) {
        if (l = t + i.textContent.length, t <= e && l >= e)
          return { node: i, offset: e - t };
        t = l;
      }
      t: {
        for (; i; ) {
          if (i.nextSibling) {
            i = i.nextSibling;
            break t;
          }
          i = i.parentNode;
        }
        i = void 0;
      }
      i = $d(i);
    }
  }
  function Fd(t, e) {
    return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? Fd(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
  }
  function Id(t) {
    t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
    for (var e = Hi(t.document); e instanceof t.HTMLIFrameElement; ) {
      try {
        var i = typeof e.contentWindow.location.href == "string";
      } catch {
        i = !1;
      }
      if (i) t = e.contentWindow;
      else break;
      e = Hi(t.document);
    }
    return e;
  }
  function mu(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
  }
  var O1 = Cn && "documentMode" in document && 11 >= document.documentMode, Sa = null, vu = null, wl = null, bu = !1;
  function Wd(t, e, i) {
    var l = i.window === i ? i.document : i.nodeType === 9 ? i : i.ownerDocument;
    bu || Sa == null || Sa !== Hi(l) || (l = Sa, "selectionStart" in l && mu(l) ? l = { start: l.selectionStart, end: l.selectionEnd } : (l = (l.ownerDocument && l.ownerDocument.defaultView || window).getSelection(), l = {
      anchorNode: l.anchorNode,
      anchorOffset: l.anchorOffset,
      focusNode: l.focusNode,
      focusOffset: l.focusOffset
    }), wl && Sl(wl, l) || (wl = l, l = Vs(vu, "onSelect"), 0 < l.length && (e = new Io(
      "onSelect",
      "select",
      null,
      e,
      i
    ), t.push({ event: e, listeners: l }), e.target = Sa)));
  }
  function Bi(t, e) {
    var i = {};
    return i[t.toLowerCase()] = e.toLowerCase(), i["Webkit" + t] = "webkit" + e, i["Moz" + t] = "moz" + e, i;
  }
  var wa = {
    animationend: Bi("Animation", "AnimationEnd"),
    animationiteration: Bi("Animation", "AnimationIteration"),
    animationstart: Bi("Animation", "AnimationStart"),
    transitionrun: Bi("Transition", "TransitionRun"),
    transitionstart: Bi("Transition", "TransitionStart"),
    transitioncancel: Bi("Transition", "TransitionCancel"),
    transitionend: Bi("Transition", "TransitionEnd")
  }, xu = {}, Pd = {};
  Cn && (Pd = document.createElement("div").style, "AnimationEvent" in window || (delete wa.animationend.animation, delete wa.animationiteration.animation, delete wa.animationstart.animation), "TransitionEvent" in window || delete wa.transitionend.transition);
  function Li(t) {
    if (xu[t]) return xu[t];
    if (!wa[t]) return t;
    var e = wa[t], i;
    for (i in e)
      if (e.hasOwnProperty(i) && i in Pd)
        return xu[t] = e[i];
    return t;
  }
  var th = Li("animationend"), eh = Li("animationiteration"), nh = Li("animationstart"), D1 = Li("transitionrun"), R1 = Li("transitionstart"), H1 = Li("transitioncancel"), ih = Li("transitionend"), ah = /* @__PURE__ */ new Map(), Su = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  Su.push("scrollEnd");
  function We(t, e) {
    ah.set(t, e), wn(e, [t]);
  }
  var ts = typeof reportError == "function" ? reportError : function(t) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var e = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof t == "object" && t !== null && typeof t.message == "string" ? String(t.message) : String(t),
        error: t
      });
      if (!window.dispatchEvent(e)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", t);
      return;
    }
    console.error(t);
  }, Ye = [], Ea = 0, wu = 0;
  function es() {
    for (var t = Ea, e = wu = Ea = 0; e < t; ) {
      var i = Ye[e];
      Ye[e++] = null;
      var l = Ye[e];
      Ye[e++] = null;
      var r = Ye[e];
      Ye[e++] = null;
      var c = Ye[e];
      if (Ye[e++] = null, l !== null && r !== null) {
        var y = l.pending;
        y === null ? r.next = r : (r.next = y.next, y.next = r), l.pending = r;
      }
      c !== 0 && lh(i, r, c);
    }
  }
  function ns(t, e, i, l) {
    Ye[Ea++] = t, Ye[Ea++] = e, Ye[Ea++] = i, Ye[Ea++] = l, wu |= l, t.lanes |= l, t = t.alternate, t !== null && (t.lanes |= l);
  }
  function Eu(t, e, i, l) {
    return ns(t, e, i, l), is(t);
  }
  function qi(t, e) {
    return ns(t, null, null, e), is(t);
  }
  function lh(t, e, i) {
    t.lanes |= i;
    var l = t.alternate;
    l !== null && (l.lanes |= i);
    for (var r = !1, c = t.return; c !== null; )
      c.childLanes |= i, l = c.alternate, l !== null && (l.childLanes |= i), c.tag === 22 && (t = c.stateNode, t === null || t._visibility & 1 || (r = !0)), t = c, c = c.return;
    return t.tag === 3 ? (c = t.stateNode, r && e !== null && (r = 31 - me(i), t = c.hiddenUpdates, l = t[r], l === null ? t[r] = [e] : l.push(e), e.lane = i | 536870912), c) : null;
  }
  function is(t) {
    if (50 < kl)
      throw kl = 0, Dc = null, Error(s(185));
    for (var e = t.return; e !== null; )
      t = e, e = t.return;
    return t.tag === 3 ? t.stateNode : null;
  }
  var _a = {};
  function j1(t, e, i, l) {
    this.tag = t, this.key = i, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = l, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function De(t, e, i, l) {
    return new j1(t, e, i, l);
  }
  function _u(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function Nn(t, e) {
    var i = t.alternate;
    return i === null ? (i = De(
      t.tag,
      e,
      t.key,
      t.mode
    ), i.elementType = t.elementType, i.type = t.type, i.stateNode = t.stateNode, i.alternate = t, t.alternate = i) : (i.pendingProps = e, i.type = t.type, i.flags = 0, i.subtreeFlags = 0, i.deletions = null), i.flags = t.flags & 65011712, i.childLanes = t.childLanes, i.lanes = t.lanes, i.child = t.child, i.memoizedProps = t.memoizedProps, i.memoizedState = t.memoizedState, i.updateQueue = t.updateQueue, e = t.dependencies, i.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, i.sibling = t.sibling, i.index = t.index, i.ref = t.ref, i.refCleanup = t.refCleanup, i;
  }
  function oh(t, e) {
    t.flags &= 65011714;
    var i = t.alternate;
    return i === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = i.childLanes, t.lanes = i.lanes, t.child = i.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = i.memoizedProps, t.memoizedState = i.memoizedState, t.updateQueue = i.updateQueue, t.type = i.type, e = i.dependencies, t.dependencies = e === null ? null : {
      lanes: e.lanes,
      firstContext: e.firstContext
    }), t;
  }
  function as(t, e, i, l, r, c) {
    var y = 0;
    if (l = t, typeof t == "function") _u(t) && (y = 1);
    else if (typeof t == "string")
      y = Yb(
        t,
        i,
        et.current
      ) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
    else
      t: switch (t) {
        case Z:
          return t = De(31, i, e, r), t.elementType = Z, t.lanes = c, t;
        case A:
          return Yi(i.children, r, c, e);
        case _:
          y = 8, r |= 24;
          break;
        case C:
          return t = De(12, i, e, r | 2), t.elementType = C, t.lanes = c, t;
        case q:
          return t = De(13, i, e, r), t.elementType = q, t.lanes = c, t;
        case B:
          return t = De(19, i, e, r), t.elementType = B, t.lanes = c, t;
        default:
          if (typeof t == "object" && t !== null)
            switch (t.$$typeof) {
              case w:
                y = 10;
                break t;
              case D:
                y = 9;
                break t;
              case z:
                y = 11;
                break t;
              case U:
                y = 14;
                break t;
              case Q:
                y = 16, l = null;
                break t;
            }
          y = 29, i = Error(
            s(130, t === null ? "null" : typeof t, "")
          ), l = null;
      }
    return e = De(y, i, e, r), e.elementType = t, e.type = l, e.lanes = c, e;
  }
  function Yi(t, e, i, l) {
    return t = De(7, t, l, e), t.lanes = i, t;
  }
  function Cu(t, e, i) {
    return t = De(6, t, null, e), t.lanes = i, t;
  }
  function sh(t) {
    var e = De(18, null, null, 0);
    return e.stateNode = t, e;
  }
  function Nu(t, e, i) {
    return e = De(
      4,
      t.children !== null ? t.children : [],
      t.key,
      e
    ), e.lanes = i, e.stateNode = {
      containerInfo: t.containerInfo,
      pendingChildren: null,
      implementation: t.implementation
    }, e;
  }
  var rh = /* @__PURE__ */ new WeakMap();
  function Ve(t, e) {
    if (typeof t == "object" && t !== null) {
      var i = rh.get(t);
      return i !== void 0 ? i : (e = {
        value: t,
        source: e,
        stack: Je(e)
      }, rh.set(t, e), e);
    }
    return {
      value: t,
      source: e,
      stack: Je(e)
    };
  }
  var Ca = [], Na = 0, ls = null, El = 0, Qe = [], Xe = 0, ti = null, un = 1, cn = "";
  function Tn(t, e) {
    Ca[Na++] = El, Ca[Na++] = ls, ls = t, El = e;
  }
  function uh(t, e, i) {
    Qe[Xe++] = un, Qe[Xe++] = cn, Qe[Xe++] = ti, ti = t;
    var l = un;
    t = cn;
    var r = 32 - me(l) - 1;
    l &= ~(1 << r), i += 1;
    var c = 32 - me(e) + r;
    if (30 < c) {
      var y = r - r % 5;
      c = (l & (1 << y) - 1).toString(32), l >>= y, r -= y, un = 1 << 32 - me(e) + r | i << r | l, cn = c + t;
    } else
      un = 1 << c | i << r | l, cn = t;
  }
  function Tu(t) {
    t.return !== null && (Tn(t, 1), uh(t, 1, 0));
  }
  function Au(t) {
    for (; t === ls; )
      ls = Ca[--Na], Ca[Na] = null, El = Ca[--Na], Ca[Na] = null;
    for (; t === ti; )
      ti = Qe[--Xe], Qe[Xe] = null, cn = Qe[--Xe], Qe[Xe] = null, un = Qe[--Xe], Qe[Xe] = null;
  }
  function ch(t, e) {
    Qe[Xe++] = un, Qe[Xe++] = cn, Qe[Xe++] = ti, un = e.id, cn = e.overflow, ti = t;
  }
  var ue = null, Qt = null, Mt = !1, ei = null, ke = !1, Mu = Error(s(519));
  function ni(t) {
    var e = Error(
      s(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw _l(Ve(e, t)), Mu;
  }
  function fh(t) {
    var e = t.stateNode, i = t.type, l = t.memoizedProps;
    switch (e[ae] = t, e[ge] = l, i) {
      case "dialog":
        Ct("cancel", e), Ct("close", e);
        break;
      case "iframe":
      case "object":
      case "embed":
        Ct("load", e);
        break;
      case "video":
      case "audio":
        for (i = 0; i < Zl.length; i++)
          Ct(Zl[i], e);
        break;
      case "source":
        Ct("error", e);
        break;
      case "img":
      case "image":
      case "link":
        Ct("error", e), Ct("load", e);
        break;
      case "details":
        Ct("toggle", e);
        break;
      case "input":
        Ct("invalid", e), Zo(
          e,
          l.value,
          l.defaultValue,
          l.checked,
          l.defaultChecked,
          l.type,
          l.name,
          !0
        );
        break;
      case "select":
        Ct("invalid", e);
        break;
      case "textarea":
        Ct("invalid", e), Nd(e, l.value, l.defaultValue, l.children);
    }
    i = l.children, typeof i != "string" && typeof i != "number" && typeof i != "bigint" || e.textContent === "" + i || l.suppressHydrationWarning === !0 || Ap(e.textContent, i) ? (l.popover != null && (Ct("beforetoggle", e), Ct("toggle", e)), l.onScroll != null && Ct("scroll", e), l.onScrollEnd != null && Ct("scrollend", e), l.onClick != null && (e.onclick = _n), e = !0) : e = !1, e || ni(t, !0);
  }
  function dh(t) {
    for (ue = t.return; ue; )
      switch (ue.tag) {
        case 5:
        case 31:
        case 13:
          ke = !1;
          return;
        case 27:
        case 3:
          ke = !0;
          return;
        default:
          ue = ue.return;
      }
  }
  function Ta(t) {
    if (t !== ue) return !1;
    if (!Mt) return dh(t), Mt = !0, !1;
    var e = t.tag, i;
    if ((i = e !== 3 && e !== 27) && ((i = e === 5) && (i = t.type, i = !(i !== "form" && i !== "button") || Kc(t.type, t.memoizedProps)), i = !i), i && Qt && ni(t), dh(t), e === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
      Qt = Bp(t);
    } else if (e === 31) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
      Qt = Bp(t);
    } else
      e === 27 ? (e = Qt, yi(t.type) ? (t = Wc, Wc = null, Qt = t) : Qt = e) : Qt = ue ? Ze(t.stateNode.nextSibling) : null;
    return !0;
  }
  function Vi() {
    Qt = ue = null, Mt = !1;
  }
  function zu() {
    var t = ei;
    return t !== null && (Ne === null ? Ne = t : Ne.push.apply(
      Ne,
      t
    ), ei = null), t;
  }
  function _l(t) {
    ei === null ? ei = [t] : ei.push(t);
  }
  var Ou = T(null), Qi = null, An = null;
  function ii(t, e, i) {
    P(Ou, e._currentValue), e._currentValue = i;
  }
  function Mn(t) {
    t._currentValue = Ou.current, j(Ou);
  }
  function Du(t, e, i) {
    for (; t !== null; ) {
      var l = t.alternate;
      if ((t.childLanes & e) !== e ? (t.childLanes |= e, l !== null && (l.childLanes |= e)) : l !== null && (l.childLanes & e) !== e && (l.childLanes |= e), t === i) break;
      t = t.return;
    }
  }
  function Ru(t, e, i, l) {
    var r = t.child;
    for (r !== null && (r.return = t); r !== null; ) {
      var c = r.dependencies;
      if (c !== null) {
        var y = r.child;
        c = c.firstContext;
        t: for (; c !== null; ) {
          var x = c;
          c = r;
          for (var R = 0; R < e.length; R++)
            if (x.context === e[R]) {
              c.lanes |= i, x = c.alternate, x !== null && (x.lanes |= i), Du(
                c.return,
                i,
                t
              ), l || (y = null);
              break t;
            }
          c = x.next;
        }
      } else if (r.tag === 18) {
        if (y = r.return, y === null) throw Error(s(341));
        y.lanes |= i, c = y.alternate, c !== null && (c.lanes |= i), Du(y, i, t), y = null;
      } else y = r.child;
      if (y !== null) y.return = r;
      else
        for (y = r; y !== null; ) {
          if (y === t) {
            y = null;
            break;
          }
          if (r = y.sibling, r !== null) {
            r.return = y.return, y = r;
            break;
          }
          y = y.return;
        }
      r = y;
    }
  }
  function Aa(t, e, i, l) {
    t = null;
    for (var r = e, c = !1; r !== null; ) {
      if (!c) {
        if ((r.flags & 524288) !== 0) c = !0;
        else if ((r.flags & 262144) !== 0) break;
      }
      if (r.tag === 10) {
        var y = r.alternate;
        if (y === null) throw Error(s(387));
        if (y = y.memoizedProps, y !== null) {
          var x = r.type;
          Oe(r.pendingProps.value, y.value) || (t !== null ? t.push(x) : t = [x]);
        }
      } else if (r === ut.current) {
        if (y = r.alternate, y === null) throw Error(s(387));
        y.memoizedState.memoizedState !== r.memoizedState.memoizedState && (t !== null ? t.push(Il) : t = [Il]);
      }
      r = r.return;
    }
    t !== null && Ru(
      e,
      t,
      i,
      l
    ), e.flags |= 262144;
  }
  function os(t) {
    for (t = t.firstContext; t !== null; ) {
      if (!Oe(
        t.context._currentValue,
        t.memoizedValue
      ))
        return !0;
      t = t.next;
    }
    return !1;
  }
  function Xi(t) {
    Qi = t, An = null, t = t.dependencies, t !== null && (t.firstContext = null);
  }
  function ce(t) {
    return hh(Qi, t);
  }
  function ss(t, e) {
    return Qi === null && Xi(t), hh(t, e);
  }
  function hh(t, e) {
    var i = e._currentValue;
    if (e = { context: e, memoizedValue: i, next: null }, An === null) {
      if (t === null) throw Error(s(308));
      An = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
    } else An = An.next = e;
    return i;
  }
  var U1 = typeof AbortController < "u" ? AbortController : function() {
    var t = [], e = this.signal = {
      aborted: !1,
      addEventListener: function(i, l) {
        t.push(l);
      }
    };
    this.abort = function() {
      e.aborted = !0, t.forEach(function(i) {
        return i();
      });
    };
  }, B1 = n.unstable_scheduleCallback, L1 = n.unstable_NormalPriority, Wt = {
    $$typeof: w,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function Hu() {
    return {
      controller: new U1(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function Cl(t) {
    t.refCount--, t.refCount === 0 && B1(L1, function() {
      t.controller.abort();
    });
  }
  var Nl = null, ju = 0, Ma = 0, za = null;
  function q1(t, e) {
    if (Nl === null) {
      var i = Nl = [];
      ju = 0, Ma = Lc(), za = {
        status: "pending",
        value: void 0,
        then: function(l) {
          i.push(l);
        }
      };
    }
    return ju++, e.then(gh, gh), e;
  }
  function gh() {
    if (--ju === 0 && Nl !== null) {
      za !== null && (za.status = "fulfilled");
      var t = Nl;
      Nl = null, Ma = 0, za = null;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
  }
  function Y1(t, e) {
    var i = [], l = {
      status: "pending",
      value: null,
      reason: null,
      then: function(r) {
        i.push(r);
      }
    };
    return t.then(
      function() {
        l.status = "fulfilled", l.value = e;
        for (var r = 0; r < i.length; r++) (0, i[r])(e);
      },
      function(r) {
        for (l.status = "rejected", l.reason = r, r = 0; r < i.length; r++)
          (0, i[r])(void 0);
      }
    ), l;
  }
  var ph = N.S;
  N.S = function(t, e) {
    Wg = re(), typeof e == "object" && e !== null && typeof e.then == "function" && q1(t, e), ph !== null && ph(t, e);
  };
  var ki = T(null);
  function Uu() {
    var t = ki.current;
    return t !== null ? t : Vt.pooledCache;
  }
  function rs(t, e) {
    e === null ? P(ki, ki.current) : P(ki, e.pool);
  }
  function yh() {
    var t = Uu();
    return t === null ? null : { parent: Wt._currentValue, pool: t };
  }
  var Oa = Error(s(460)), Bu = Error(s(474)), us = Error(s(542)), cs = { then: function() {
  } };
  function mh(t) {
    return t = t.status, t === "fulfilled" || t === "rejected";
  }
  function vh(t, e, i) {
    switch (i = t[i], i === void 0 ? t.push(e) : i !== e && (e.then(_n, _n), e = i), e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw t = e.reason, xh(t), t;
      default:
        if (typeof e.status == "string") e.then(_n, _n);
        else {
          if (t = Vt, t !== null && 100 < t.shellSuspendCounter)
            throw Error(s(482));
          t = e, t.status = "pending", t.then(
            function(l) {
              if (e.status === "pending") {
                var r = e;
                r.status = "fulfilled", r.value = l;
              }
            },
            function(l) {
              if (e.status === "pending") {
                var r = e;
                r.status = "rejected", r.reason = l;
              }
            }
          );
        }
        switch (e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, xh(t), t;
        }
        throw Zi = e, Oa;
    }
  }
  function Gi(t) {
    try {
      var e = t._init;
      return e(t._payload);
    } catch (i) {
      throw i !== null && typeof i == "object" && typeof i.then == "function" ? (Zi = i, Oa) : i;
    }
  }
  var Zi = null;
  function bh() {
    if (Zi === null) throw Error(s(459));
    var t = Zi;
    return Zi = null, t;
  }
  function xh(t) {
    if (t === Oa || t === us)
      throw Error(s(483));
  }
  var Da = null, Tl = 0;
  function fs(t) {
    var e = Tl;
    return Tl += 1, Da === null && (Da = []), vh(Da, t, e);
  }
  function Al(t, e) {
    e = e.props.ref, t.ref = e !== void 0 ? e : null;
  }
  function ds(t, e) {
    throw e.$$typeof === b ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
      s(
        31,
        t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
      )
    ));
  }
  function Sh(t) {
    function e(V, L) {
      if (t) {
        var $ = V.deletions;
        $ === null ? (V.deletions = [L], V.flags |= 16) : $.push(L);
      }
    }
    function i(V, L) {
      if (!t) return null;
      for (; L !== null; )
        e(V, L), L = L.sibling;
      return null;
    }
    function l(V) {
      for (var L = /* @__PURE__ */ new Map(); V !== null; )
        V.key !== null ? L.set(V.key, V) : L.set(V.index, V), V = V.sibling;
      return L;
    }
    function r(V, L) {
      return V = Nn(V, L), V.index = 0, V.sibling = null, V;
    }
    function c(V, L, $) {
      return V.index = $, t ? ($ = V.alternate, $ !== null ? ($ = $.index, $ < L ? (V.flags |= 67108866, L) : $) : (V.flags |= 67108866, L)) : (V.flags |= 1048576, L);
    }
    function y(V) {
      return t && V.alternate === null && (V.flags |= 67108866), V;
    }
    function x(V, L, $, at) {
      return L === null || L.tag !== 6 ? (L = Cu($, V.mode, at), L.return = V, L) : (L = r(L, $), L.return = V, L);
    }
    function R(V, L, $, at) {
      var gt = $.type;
      return gt === A ? nt(
        V,
        L,
        $.props.children,
        at,
        $.key
      ) : L !== null && (L.elementType === gt || typeof gt == "object" && gt !== null && gt.$$typeof === Q && Gi(gt) === L.type) ? (L = r(L, $.props), Al(L, $), L.return = V, L) : (L = as(
        $.type,
        $.key,
        $.props,
        null,
        V.mode,
        at
      ), Al(L, $), L.return = V, L);
    }
    function J(V, L, $, at) {
      return L === null || L.tag !== 4 || L.stateNode.containerInfo !== $.containerInfo || L.stateNode.implementation !== $.implementation ? (L = Nu($, V.mode, at), L.return = V, L) : (L = r(L, $.children || []), L.return = V, L);
    }
    function nt(V, L, $, at, gt) {
      return L === null || L.tag !== 7 ? (L = Yi(
        $,
        V.mode,
        at,
        gt
      ), L.return = V, L) : (L = r(L, $), L.return = V, L);
    }
    function lt(V, L, $) {
      if (typeof L == "string" && L !== "" || typeof L == "number" || typeof L == "bigint")
        return L = Cu(
          "" + L,
          V.mode,
          $
        ), L.return = V, L;
      if (typeof L == "object" && L !== null) {
        switch (L.$$typeof) {
          case S:
            return $ = as(
              L.type,
              L.key,
              L.props,
              null,
              V.mode,
              $
            ), Al($, L), $.return = V, $;
          case E:
            return L = Nu(
              L,
              V.mode,
              $
            ), L.return = V, L;
          case Q:
            return L = Gi(L), lt(V, L, $);
        }
        if (G(L) || k(L))
          return L = Yi(
            L,
            V.mode,
            $,
            null
          ), L.return = V, L;
        if (typeof L.then == "function")
          return lt(V, fs(L), $);
        if (L.$$typeof === w)
          return lt(
            V,
            ss(V, L),
            $
          );
        ds(V, L);
      }
      return null;
    }
    function I(V, L, $, at) {
      var gt = L !== null ? L.key : null;
      if (typeof $ == "string" && $ !== "" || typeof $ == "number" || typeof $ == "bigint")
        return gt !== null ? null : x(V, L, "" + $, at);
      if (typeof $ == "object" && $ !== null) {
        switch ($.$$typeof) {
          case S:
            return $.key === gt ? R(V, L, $, at) : null;
          case E:
            return $.key === gt ? J(V, L, $, at) : null;
          case Q:
            return $ = Gi($), I(V, L, $, at);
        }
        if (G($) || k($))
          return gt !== null ? null : nt(V, L, $, at, null);
        if (typeof $.then == "function")
          return I(
            V,
            L,
            fs($),
            at
          );
        if ($.$$typeof === w)
          return I(
            V,
            L,
            ss(V, $),
            at
          );
        ds(V, $);
      }
      return null;
    }
    function W(V, L, $, at, gt) {
      if (typeof at == "string" && at !== "" || typeof at == "number" || typeof at == "bigint")
        return V = V.get($) || null, x(L, V, "" + at, gt);
      if (typeof at == "object" && at !== null) {
        switch (at.$$typeof) {
          case S:
            return V = V.get(
              at.key === null ? $ : at.key
            ) || null, R(L, V, at, gt);
          case E:
            return V = V.get(
              at.key === null ? $ : at.key
            ) || null, J(L, V, at, gt);
          case Q:
            return at = Gi(at), W(
              V,
              L,
              $,
              at,
              gt
            );
        }
        if (G(at) || k(at))
          return V = V.get($) || null, nt(L, V, at, gt, null);
        if (typeof at.then == "function")
          return W(
            V,
            L,
            $,
            fs(at),
            gt
          );
        if (at.$$typeof === w)
          return W(
            V,
            L,
            $,
            ss(L, at),
            gt
          );
        ds(L, at);
      }
      return null;
    }
    function dt(V, L, $, at) {
      for (var gt = null, Ot = null, ht = L, Et = L = 0, At = null; ht !== null && Et < $.length; Et++) {
        ht.index > Et ? (At = ht, ht = null) : At = ht.sibling;
        var Dt = I(
          V,
          ht,
          $[Et],
          at
        );
        if (Dt === null) {
          ht === null && (ht = At);
          break;
        }
        t && ht && Dt.alternate === null && e(V, ht), L = c(Dt, L, Et), Ot === null ? gt = Dt : Ot.sibling = Dt, Ot = Dt, ht = At;
      }
      if (Et === $.length)
        return i(V, ht), Mt && Tn(V, Et), gt;
      if (ht === null) {
        for (; Et < $.length; Et++)
          ht = lt(V, $[Et], at), ht !== null && (L = c(
            ht,
            L,
            Et
          ), Ot === null ? gt = ht : Ot.sibling = ht, Ot = ht);
        return Mt && Tn(V, Et), gt;
      }
      for (ht = l(ht); Et < $.length; Et++)
        At = W(
          ht,
          V,
          Et,
          $[Et],
          at
        ), At !== null && (t && At.alternate !== null && ht.delete(
          At.key === null ? Et : At.key
        ), L = c(
          At,
          L,
          Et
        ), Ot === null ? gt = At : Ot.sibling = At, Ot = At);
      return t && ht.forEach(function(Si) {
        return e(V, Si);
      }), Mt && Tn(V, Et), gt;
    }
    function mt(V, L, $, at) {
      if ($ == null) throw Error(s(151));
      for (var gt = null, Ot = null, ht = L, Et = L = 0, At = null, Dt = $.next(); ht !== null && !Dt.done; Et++, Dt = $.next()) {
        ht.index > Et ? (At = ht, ht = null) : At = ht.sibling;
        var Si = I(V, ht, Dt.value, at);
        if (Si === null) {
          ht === null && (ht = At);
          break;
        }
        t && ht && Si.alternate === null && e(V, ht), L = c(Si, L, Et), Ot === null ? gt = Si : Ot.sibling = Si, Ot = Si, ht = At;
      }
      if (Dt.done)
        return i(V, ht), Mt && Tn(V, Et), gt;
      if (ht === null) {
        for (; !Dt.done; Et++, Dt = $.next())
          Dt = lt(V, Dt.value, at), Dt !== null && (L = c(Dt, L, Et), Ot === null ? gt = Dt : Ot.sibling = Dt, Ot = Dt);
        return Mt && Tn(V, Et), gt;
      }
      for (ht = l(ht); !Dt.done; Et++, Dt = $.next())
        Dt = W(ht, V, Et, Dt.value, at), Dt !== null && (t && Dt.alternate !== null && ht.delete(Dt.key === null ? Et : Dt.key), L = c(Dt, L, Et), Ot === null ? gt = Dt : Ot.sibling = Dt, Ot = Dt);
      return t && ht.forEach(function(Ib) {
        return e(V, Ib);
      }), Mt && Tn(V, Et), gt;
    }
    function Yt(V, L, $, at) {
      if (typeof $ == "object" && $ !== null && $.type === A && $.key === null && ($ = $.props.children), typeof $ == "object" && $ !== null) {
        switch ($.$$typeof) {
          case S:
            t: {
              for (var gt = $.key; L !== null; ) {
                if (L.key === gt) {
                  if (gt = $.type, gt === A) {
                    if (L.tag === 7) {
                      i(
                        V,
                        L.sibling
                      ), at = r(
                        L,
                        $.props.children
                      ), at.return = V, V = at;
                      break t;
                    }
                  } else if (L.elementType === gt || typeof gt == "object" && gt !== null && gt.$$typeof === Q && Gi(gt) === L.type) {
                    i(
                      V,
                      L.sibling
                    ), at = r(L, $.props), Al(at, $), at.return = V, V = at;
                    break t;
                  }
                  i(V, L);
                  break;
                } else e(V, L);
                L = L.sibling;
              }
              $.type === A ? (at = Yi(
                $.props.children,
                V.mode,
                at,
                $.key
              ), at.return = V, V = at) : (at = as(
                $.type,
                $.key,
                $.props,
                null,
                V.mode,
                at
              ), Al(at, $), at.return = V, V = at);
            }
            return y(V);
          case E:
            t: {
              for (gt = $.key; L !== null; ) {
                if (L.key === gt)
                  if (L.tag === 4 && L.stateNode.containerInfo === $.containerInfo && L.stateNode.implementation === $.implementation) {
                    i(
                      V,
                      L.sibling
                    ), at = r(L, $.children || []), at.return = V, V = at;
                    break t;
                  } else {
                    i(V, L);
                    break;
                  }
                else e(V, L);
                L = L.sibling;
              }
              at = Nu($, V.mode, at), at.return = V, V = at;
            }
            return y(V);
          case Q:
            return $ = Gi($), Yt(
              V,
              L,
              $,
              at
            );
        }
        if (G($))
          return dt(
            V,
            L,
            $,
            at
          );
        if (k($)) {
          if (gt = k($), typeof gt != "function") throw Error(s(150));
          return $ = gt.call($), mt(
            V,
            L,
            $,
            at
          );
        }
        if (typeof $.then == "function")
          return Yt(
            V,
            L,
            fs($),
            at
          );
        if ($.$$typeof === w)
          return Yt(
            V,
            L,
            ss(V, $),
            at
          );
        ds(V, $);
      }
      return typeof $ == "string" && $ !== "" || typeof $ == "number" || typeof $ == "bigint" ? ($ = "" + $, L !== null && L.tag === 6 ? (i(V, L.sibling), at = r(L, $), at.return = V, V = at) : (i(V, L), at = Cu($, V.mode, at), at.return = V, V = at), y(V)) : i(V, L);
    }
    return function(V, L, $, at) {
      try {
        Tl = 0;
        var gt = Yt(
          V,
          L,
          $,
          at
        );
        return Da = null, gt;
      } catch (ht) {
        if (ht === Oa || ht === us) throw ht;
        var Ot = De(29, ht, null, V.mode);
        return Ot.lanes = at, Ot.return = V, Ot;
      }
    };
  }
  var Ki = Sh(!0), wh = Sh(!1), ai = !1;
  function Lu(t) {
    t.updateQueue = {
      baseState: t.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function qu(t, e) {
    t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
      baseState: t.baseState,
      firstBaseUpdate: t.firstBaseUpdate,
      lastBaseUpdate: t.lastBaseUpdate,
      shared: t.shared,
      callbacks: null
    });
  }
  function li(t) {
    return { lane: t, tag: 0, payload: null, callback: null, next: null };
  }
  function oi(t, e, i) {
    var l = t.updateQueue;
    if (l === null) return null;
    if (l = l.shared, (Rt & 2) !== 0) {
      var r = l.pending;
      return r === null ? e.next = e : (e.next = r.next, r.next = e), l.pending = e, e = is(t), lh(t, null, i), e;
    }
    return ns(t, l, e, i), is(t);
  }
  function Ml(t, e, i) {
    if (e = e.updateQueue, e !== null && (e = e.shared, (i & 4194048) !== 0)) {
      var l = e.lanes;
      l &= t.pendingLanes, i |= l, e.lanes = i, jo(t, i);
    }
  }
  function Yu(t, e) {
    var i = t.updateQueue, l = t.alternate;
    if (l !== null && (l = l.updateQueue, i === l)) {
      var r = null, c = null;
      if (i = i.firstBaseUpdate, i !== null) {
        do {
          var y = {
            lane: i.lane,
            tag: i.tag,
            payload: i.payload,
            callback: null,
            next: null
          };
          c === null ? r = c = y : c = c.next = y, i = i.next;
        } while (i !== null);
        c === null ? r = c = e : c = c.next = e;
      } else r = c = e;
      i = {
        baseState: l.baseState,
        firstBaseUpdate: r,
        lastBaseUpdate: c,
        shared: l.shared,
        callbacks: l.callbacks
      }, t.updateQueue = i;
      return;
    }
    t = i.lastBaseUpdate, t === null ? i.firstBaseUpdate = e : t.next = e, i.lastBaseUpdate = e;
  }
  var Vu = !1;
  function zl() {
    if (Vu) {
      var t = za;
      if (t !== null) throw t;
    }
  }
  function Ol(t, e, i, l) {
    Vu = !1;
    var r = t.updateQueue;
    ai = !1;
    var c = r.firstBaseUpdate, y = r.lastBaseUpdate, x = r.shared.pending;
    if (x !== null) {
      r.shared.pending = null;
      var R = x, J = R.next;
      R.next = null, y === null ? c = J : y.next = J, y = R;
      var nt = t.alternate;
      nt !== null && (nt = nt.updateQueue, x = nt.lastBaseUpdate, x !== y && (x === null ? nt.firstBaseUpdate = J : x.next = J, nt.lastBaseUpdate = R));
    }
    if (c !== null) {
      var lt = r.baseState;
      y = 0, nt = J = R = null, x = c;
      do {
        var I = x.lane & -536870913, W = I !== x.lane;
        if (W ? (Tt & I) === I : (l & I) === I) {
          I !== 0 && I === Ma && (Vu = !0), nt !== null && (nt = nt.next = {
            lane: 0,
            tag: x.tag,
            payload: x.payload,
            callback: null,
            next: null
          });
          t: {
            var dt = t, mt = x;
            I = e;
            var Yt = i;
            switch (mt.tag) {
              case 1:
                if (dt = mt.payload, typeof dt == "function") {
                  lt = dt.call(Yt, lt, I);
                  break t;
                }
                lt = dt;
                break t;
              case 3:
                dt.flags = dt.flags & -65537 | 128;
              case 0:
                if (dt = mt.payload, I = typeof dt == "function" ? dt.call(Yt, lt, I) : dt, I == null) break t;
                lt = v({}, lt, I);
                break t;
              case 2:
                ai = !0;
            }
          }
          I = x.callback, I !== null && (t.flags |= 64, W && (t.flags |= 8192), W = r.callbacks, W === null ? r.callbacks = [I] : W.push(I));
        } else
          W = {
            lane: I,
            tag: x.tag,
            payload: x.payload,
            callback: x.callback,
            next: null
          }, nt === null ? (J = nt = W, R = lt) : nt = nt.next = W, y |= I;
        if (x = x.next, x === null) {
          if (x = r.shared.pending, x === null)
            break;
          W = x, x = W.next, W.next = null, r.lastBaseUpdate = W, r.shared.pending = null;
        }
      } while (!0);
      nt === null && (R = lt), r.baseState = R, r.firstBaseUpdate = J, r.lastBaseUpdate = nt, c === null && (r.shared.lanes = 0), fi |= y, t.lanes = y, t.memoizedState = lt;
    }
  }
  function Eh(t, e) {
    if (typeof t != "function")
      throw Error(s(191, t));
    t.call(e);
  }
  function _h(t, e) {
    var i = t.callbacks;
    if (i !== null)
      for (t.callbacks = null, t = 0; t < i.length; t++)
        Eh(i[t], e);
  }
  var Ra = T(null), hs = T(0);
  function Ch(t, e) {
    t = Ln, P(hs, t), P(Ra, e), Ln = t | e.baseLanes;
  }
  function Qu() {
    P(hs, Ln), P(Ra, Ra.current);
  }
  function Xu() {
    Ln = hs.current, j(Ra), j(hs);
  }
  var Re = T(null), Ge = null;
  function si(t) {
    var e = t.alternate;
    P(Jt, Jt.current & 1), P(Re, t), Ge === null && (e === null || Ra.current !== null || e.memoizedState !== null) && (Ge = t);
  }
  function ku(t) {
    P(Jt, Jt.current), P(Re, t), Ge === null && (Ge = t);
  }
  function Nh(t) {
    t.tag === 22 ? (P(Jt, Jt.current), P(Re, t), Ge === null && (Ge = t)) : ri();
  }
  function ri() {
    P(Jt, Jt.current), P(Re, Re.current);
  }
  function He(t) {
    j(Re), Ge === t && (Ge = null), j(Jt);
  }
  var Jt = T(0);
  function gs(t) {
    for (var e = t; e !== null; ) {
      if (e.tag === 13) {
        var i = e.memoizedState;
        if (i !== null && (i = i.dehydrated, i === null || Fc(i) || Ic(i)))
          return e;
      } else if (e.tag === 19 && (e.memoizedProps.revealOrder === "forwards" || e.memoizedProps.revealOrder === "backwards" || e.memoizedProps.revealOrder === "unstable_legacy-backwards" || e.memoizedProps.revealOrder === "together")) {
        if ((e.flags & 128) !== 0) return e;
      } else if (e.child !== null) {
        e.child.return = e, e = e.child;
        continue;
      }
      if (e === t) break;
      for (; e.sibling === null; ) {
        if (e.return === null || e.return === t) return null;
        e = e.return;
      }
      e.sibling.return = e.return, e = e.sibling;
    }
    return null;
  }
  var zn = 0, St = null, Lt = null, Pt = null, ps = !1, Ha = !1, $i = !1, ys = 0, Dl = 0, ja = null, V1 = 0;
  function Kt() {
    throw Error(s(321));
  }
  function Gu(t, e) {
    if (e === null) return !1;
    for (var i = 0; i < e.length && i < t.length; i++)
      if (!Oe(t[i], e[i])) return !1;
    return !0;
  }
  function Zu(t, e, i, l, r, c) {
    return zn = c, St = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, N.H = t === null || t.memoizedState === null ? ug : sc, $i = !1, c = i(l, r), $i = !1, Ha && (c = Ah(
      e,
      i,
      l,
      r
    )), Th(t), c;
  }
  function Th(t) {
    N.H = jl;
    var e = Lt !== null && Lt.next !== null;
    if (zn = 0, Pt = Lt = St = null, ps = !1, Dl = 0, ja = null, e) throw Error(s(300));
    t === null || te || (t = t.dependencies, t !== null && os(t) && (te = !0));
  }
  function Ah(t, e, i, l) {
    St = t;
    var r = 0;
    do {
      if (Ha && (ja = null), Dl = 0, Ha = !1, 25 <= r) throw Error(s(301));
      if (r += 1, Pt = Lt = null, t.updateQueue != null) {
        var c = t.updateQueue;
        c.lastEffect = null, c.events = null, c.stores = null, c.memoCache != null && (c.memoCache.index = 0);
      }
      N.H = cg, c = e(i, l);
    } while (Ha);
    return c;
  }
  function Q1() {
    var t = N.H, e = t.useState()[0];
    return e = typeof e.then == "function" ? Rl(e) : e, t = t.useState()[0], (Lt !== null ? Lt.memoizedState : null) !== t && (St.flags |= 1024), e;
  }
  function Ku() {
    var t = ys !== 0;
    return ys = 0, t;
  }
  function $u(t, e, i) {
    e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~i;
  }
  function Ju(t) {
    if (ps) {
      for (t = t.memoizedState; t !== null; ) {
        var e = t.queue;
        e !== null && (e.pending = null), t = t.next;
      }
      ps = !1;
    }
    zn = 0, Pt = Lt = St = null, Ha = !1, Dl = ys = 0, ja = null;
  }
  function ve() {
    var t = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return Pt === null ? St.memoizedState = Pt = t : Pt = Pt.next = t, Pt;
  }
  function Ft() {
    if (Lt === null) {
      var t = St.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = Lt.next;
    var e = Pt === null ? St.memoizedState : Pt.next;
    if (e !== null)
      Pt = e, Lt = t;
    else {
      if (t === null)
        throw St.alternate === null ? Error(s(467)) : Error(s(310));
      Lt = t, t = {
        memoizedState: Lt.memoizedState,
        baseState: Lt.baseState,
        baseQueue: Lt.baseQueue,
        queue: Lt.queue,
        next: null
      }, Pt === null ? St.memoizedState = Pt = t : Pt = Pt.next = t;
    }
    return Pt;
  }
  function ms() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Rl(t) {
    var e = Dl;
    return Dl += 1, ja === null && (ja = []), t = vh(ja, t, e), e = St, (Pt === null ? e.memoizedState : Pt.next) === null && (e = e.alternate, N.H = e === null || e.memoizedState === null ? ug : sc), t;
  }
  function vs(t) {
    if (t !== null && typeof t == "object") {
      if (typeof t.then == "function") return Rl(t);
      if (t.$$typeof === w) return ce(t);
    }
    throw Error(s(438, String(t)));
  }
  function Fu(t) {
    var e = null, i = St.updateQueue;
    if (i !== null && (e = i.memoCache), e == null) {
      var l = St.alternate;
      l !== null && (l = l.updateQueue, l !== null && (l = l.memoCache, l != null && (e = {
        data: l.data.map(function(r) {
          return r.slice();
        }),
        index: 0
      })));
    }
    if (e == null && (e = { data: [], index: 0 }), i === null && (i = ms(), St.updateQueue = i), i.memoCache = e, i = e.data[e.index], i === void 0)
      for (i = e.data[e.index] = Array(t), l = 0; l < t; l++)
        i[l] = ot;
    return e.index++, i;
  }
  function On(t, e) {
    return typeof e == "function" ? e(t) : e;
  }
  function bs(t) {
    var e = Ft();
    return Iu(e, Lt, t);
  }
  function Iu(t, e, i) {
    var l = t.queue;
    if (l === null) throw Error(s(311));
    l.lastRenderedReducer = i;
    var r = t.baseQueue, c = l.pending;
    if (c !== null) {
      if (r !== null) {
        var y = r.next;
        r.next = c.next, c.next = y;
      }
      e.baseQueue = r = c, l.pending = null;
    }
    if (c = t.baseState, r === null) t.memoizedState = c;
    else {
      e = r.next;
      var x = y = null, R = null, J = e, nt = !1;
      do {
        var lt = J.lane & -536870913;
        if (lt !== J.lane ? (Tt & lt) === lt : (zn & lt) === lt) {
          var I = J.revertLane;
          if (I === 0)
            R !== null && (R = R.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: J.action,
              hasEagerState: J.hasEagerState,
              eagerState: J.eagerState,
              next: null
            }), lt === Ma && (nt = !0);
          else if ((zn & I) === I) {
            J = J.next, I === Ma && (nt = !0);
            continue;
          } else
            lt = {
              lane: 0,
              revertLane: J.revertLane,
              gesture: null,
              action: J.action,
              hasEagerState: J.hasEagerState,
              eagerState: J.eagerState,
              next: null
            }, R === null ? (x = R = lt, y = c) : R = R.next = lt, St.lanes |= I, fi |= I;
          lt = J.action, $i && i(c, lt), c = J.hasEagerState ? J.eagerState : i(c, lt);
        } else
          I = {
            lane: lt,
            revertLane: J.revertLane,
            gesture: J.gesture,
            action: J.action,
            hasEagerState: J.hasEagerState,
            eagerState: J.eagerState,
            next: null
          }, R === null ? (x = R = I, y = c) : R = R.next = I, St.lanes |= lt, fi |= lt;
        J = J.next;
      } while (J !== null && J !== e);
      if (R === null ? y = c : R.next = x, !Oe(c, t.memoizedState) && (te = !0, nt && (i = za, i !== null)))
        throw i;
      t.memoizedState = c, t.baseState = y, t.baseQueue = R, l.lastRenderedState = c;
    }
    return r === null && (l.lanes = 0), [t.memoizedState, l.dispatch];
  }
  function Wu(t) {
    var e = Ft(), i = e.queue;
    if (i === null) throw Error(s(311));
    i.lastRenderedReducer = t;
    var l = i.dispatch, r = i.pending, c = e.memoizedState;
    if (r !== null) {
      i.pending = null;
      var y = r = r.next;
      do
        c = t(c, y.action), y = y.next;
      while (y !== r);
      Oe(c, e.memoizedState) || (te = !0), e.memoizedState = c, e.baseQueue === null && (e.baseState = c), i.lastRenderedState = c;
    }
    return [c, l];
  }
  function Mh(t, e, i) {
    var l = St, r = Ft(), c = Mt;
    if (c) {
      if (i === void 0) throw Error(s(407));
      i = i();
    } else i = e();
    var y = !Oe(
      (Lt || r).memoizedState,
      i
    );
    if (y && (r.memoizedState = i, te = !0), r = r.queue, ec(Dh.bind(null, l, r, t), [
      t
    ]), r.getSnapshot !== e || y || Pt !== null && Pt.memoizedState.tag & 1) {
      if (l.flags |= 2048, Ua(
        9,
        { destroy: void 0 },
        Oh.bind(
          null,
          l,
          r,
          i,
          e
        ),
        null
      ), Vt === null) throw Error(s(349));
      c || (zn & 127) !== 0 || zh(l, e, i);
    }
    return i;
  }
  function zh(t, e, i) {
    t.flags |= 16384, t = { getSnapshot: e, value: i }, e = St.updateQueue, e === null ? (e = ms(), St.updateQueue = e, e.stores = [t]) : (i = e.stores, i === null ? e.stores = [t] : i.push(t));
  }
  function Oh(t, e, i, l) {
    e.value = i, e.getSnapshot = l, Rh(e) && Hh(t);
  }
  function Dh(t, e, i) {
    return i(function() {
      Rh(e) && Hh(t);
    });
  }
  function Rh(t) {
    var e = t.getSnapshot;
    t = t.value;
    try {
      var i = e();
      return !Oe(t, i);
    } catch {
      return !0;
    }
  }
  function Hh(t) {
    var e = qi(t, 2);
    e !== null && Te(e, t, 2);
  }
  function Pu(t) {
    var e = ve();
    if (typeof t == "function") {
      var i = t;
      if (t = i(), $i) {
        sn(!0);
        try {
          i();
        } finally {
          sn(!1);
        }
      }
    }
    return e.memoizedState = e.baseState = t, e.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: On,
      lastRenderedState: t
    }, e;
  }
  function jh(t, e, i, l) {
    return t.baseState = i, Iu(
      t,
      Lt,
      typeof l == "function" ? l : On
    );
  }
  function X1(t, e, i, l, r) {
    if (ws(t)) throw Error(s(485));
    if (t = e.action, t !== null) {
      var c = {
        payload: r,
        action: t,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(y) {
          c.listeners.push(y);
        }
      };
      N.T !== null ? i(!0) : c.isTransition = !1, l(c), i = e.pending, i === null ? (c.next = e.pending = c, Uh(e, c)) : (c.next = i.next, e.pending = i.next = c);
    }
  }
  function Uh(t, e) {
    var i = e.action, l = e.payload, r = t.state;
    if (e.isTransition) {
      var c = N.T, y = {};
      N.T = y;
      try {
        var x = i(r, l), R = N.S;
        R !== null && R(y, x), Bh(t, e, x);
      } catch (J) {
        tc(t, e, J);
      } finally {
        c !== null && y.types !== null && (c.types = y.types), N.T = c;
      }
    } else
      try {
        c = i(r, l), Bh(t, e, c);
      } catch (J) {
        tc(t, e, J);
      }
  }
  function Bh(t, e, i) {
    i !== null && typeof i == "object" && typeof i.then == "function" ? i.then(
      function(l) {
        Lh(t, e, l);
      },
      function(l) {
        return tc(t, e, l);
      }
    ) : Lh(t, e, i);
  }
  function Lh(t, e, i) {
    e.status = "fulfilled", e.value = i, qh(e), t.state = i, e = t.pending, e !== null && (i = e.next, i === e ? t.pending = null : (i = i.next, e.next = i, Uh(t, i)));
  }
  function tc(t, e, i) {
    var l = t.pending;
    if (t.pending = null, l !== null) {
      l = l.next;
      do
        e.status = "rejected", e.reason = i, qh(e), e = e.next;
      while (e !== l);
    }
    t.action = null;
  }
  function qh(t) {
    t = t.listeners;
    for (var e = 0; e < t.length; e++) (0, t[e])();
  }
  function Yh(t, e) {
    return e;
  }
  function Vh(t, e) {
    if (Mt) {
      var i = Vt.formState;
      if (i !== null) {
        t: {
          var l = St;
          if (Mt) {
            if (Qt) {
              e: {
                for (var r = Qt, c = ke; r.nodeType !== 8; ) {
                  if (!c) {
                    r = null;
                    break e;
                  }
                  if (r = Ze(
                    r.nextSibling
                  ), r === null) {
                    r = null;
                    break e;
                  }
                }
                c = r.data, r = c === "F!" || c === "F" ? r : null;
              }
              if (r) {
                Qt = Ze(
                  r.nextSibling
                ), l = r.data === "F!";
                break t;
              }
            }
            ni(l);
          }
          l = !1;
        }
        l && (e = i[0]);
      }
    }
    return i = ve(), i.memoizedState = i.baseState = e, l = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Yh,
      lastRenderedState: e
    }, i.queue = l, i = og.bind(
      null,
      St,
      l
    ), l.dispatch = i, l = Pu(!1), c = oc.bind(
      null,
      St,
      !1,
      l.queue
    ), l = ve(), r = {
      state: e,
      dispatch: null,
      action: t,
      pending: null
    }, l.queue = r, i = X1.bind(
      null,
      St,
      r,
      c,
      i
    ), r.dispatch = i, l.memoizedState = t, [e, i, !1];
  }
  function Qh(t) {
    var e = Ft();
    return Xh(e, Lt, t);
  }
  function Xh(t, e, i) {
    if (e = Iu(
      t,
      e,
      Yh
    )[0], t = bs(On)[0], typeof e == "object" && e !== null && typeof e.then == "function")
      try {
        var l = Rl(e);
      } catch (y) {
        throw y === Oa ? us : y;
      }
    else l = e;
    e = Ft();
    var r = e.queue, c = r.dispatch;
    return i !== e.memoizedState && (St.flags |= 2048, Ua(
      9,
      { destroy: void 0 },
      k1.bind(null, r, i),
      null
    )), [l, c, t];
  }
  function k1(t, e) {
    t.action = e;
  }
  function kh(t) {
    var e = Ft(), i = Lt;
    if (i !== null)
      return Xh(e, i, t);
    Ft(), e = e.memoizedState, i = Ft();
    var l = i.queue.dispatch;
    return i.memoizedState = t, [e, l, !1];
  }
  function Ua(t, e, i, l) {
    return t = { tag: t, create: i, deps: l, inst: e, next: null }, e = St.updateQueue, e === null && (e = ms(), St.updateQueue = e), i = e.lastEffect, i === null ? e.lastEffect = t.next = t : (l = i.next, i.next = t, t.next = l, e.lastEffect = t), t;
  }
  function Gh() {
    return Ft().memoizedState;
  }
  function xs(t, e, i, l) {
    var r = ve();
    St.flags |= t, r.memoizedState = Ua(
      1 | e,
      { destroy: void 0 },
      i,
      l === void 0 ? null : l
    );
  }
  function Ss(t, e, i, l) {
    var r = Ft();
    l = l === void 0 ? null : l;
    var c = r.memoizedState.inst;
    Lt !== null && l !== null && Gu(l, Lt.memoizedState.deps) ? r.memoizedState = Ua(e, c, i, l) : (St.flags |= t, r.memoizedState = Ua(
      1 | e,
      c,
      i,
      l
    ));
  }
  function Zh(t, e) {
    xs(8390656, 8, t, e);
  }
  function ec(t, e) {
    Ss(2048, 8, t, e);
  }
  function G1(t) {
    St.flags |= 4;
    var e = St.updateQueue;
    if (e === null)
      e = ms(), St.updateQueue = e, e.events = [t];
    else {
      var i = e.events;
      i === null ? e.events = [t] : i.push(t);
    }
  }
  function Kh(t) {
    var e = Ft().memoizedState;
    return G1({ ref: e, nextImpl: t }), function() {
      if ((Rt & 2) !== 0) throw Error(s(440));
      return e.impl.apply(void 0, arguments);
    };
  }
  function $h(t, e) {
    return Ss(4, 2, t, e);
  }
  function Jh(t, e) {
    return Ss(4, 4, t, e);
  }
  function Fh(t, e) {
    if (typeof e == "function") {
      t = t();
      var i = e(t);
      return function() {
        typeof i == "function" ? i() : e(null);
      };
    }
    if (e != null)
      return t = t(), e.current = t, function() {
        e.current = null;
      };
  }
  function Ih(t, e, i) {
    i = i != null ? i.concat([t]) : null, Ss(4, 4, Fh.bind(null, e, t), i);
  }
  function nc() {
  }
  function Wh(t, e) {
    var i = Ft();
    e = e === void 0 ? null : e;
    var l = i.memoizedState;
    return e !== null && Gu(e, l[1]) ? l[0] : (i.memoizedState = [t, e], t);
  }
  function Ph(t, e) {
    var i = Ft();
    e = e === void 0 ? null : e;
    var l = i.memoizedState;
    if (e !== null && Gu(e, l[1]))
      return l[0];
    if (l = t(), $i) {
      sn(!0);
      try {
        t();
      } finally {
        sn(!1);
      }
    }
    return i.memoizedState = [l, e], l;
  }
  function ic(t, e, i) {
    return i === void 0 || (zn & 1073741824) !== 0 && (Tt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = i, t = tp(), St.lanes |= t, fi |= t, i);
  }
  function tg(t, e, i, l) {
    return Oe(i, e) ? i : Ra.current !== null ? (t = ic(t, i, l), Oe(t, e) || (te = !0), t) : (zn & 42) === 0 || (zn & 1073741824) !== 0 && (Tt & 261930) === 0 ? (te = !0, t.memoizedState = i) : (t = tp(), St.lanes |= t, fi |= t, e);
  }
  function eg(t, e, i, l, r) {
    var c = H.p;
    H.p = c !== 0 && 8 > c ? c : 8;
    var y = N.T, x = {};
    N.T = x, oc(t, !1, e, i);
    try {
      var R = r(), J = N.S;
      if (J !== null && J(x, R), R !== null && typeof R == "object" && typeof R.then == "function") {
        var nt = Y1(
          R,
          l
        );
        Hl(
          t,
          e,
          nt,
          Be(t)
        );
      } else
        Hl(
          t,
          e,
          l,
          Be(t)
        );
    } catch (lt) {
      Hl(
        t,
        e,
        { then: function() {
        }, status: "rejected", reason: lt },
        Be()
      );
    } finally {
      H.p = c, y !== null && x.types !== null && (y.types = x.types), N.T = y;
    }
  }
  function Z1() {
  }
  function ac(t, e, i, l) {
    if (t.tag !== 5) throw Error(s(476));
    var r = ng(t).queue;
    eg(
      t,
      r,
      e,
      Y,
      i === null ? Z1 : function() {
        return ig(t), i(l);
      }
    );
  }
  function ng(t) {
    var e = t.memoizedState;
    if (e !== null) return e;
    e = {
      memoizedState: Y,
      baseState: Y,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: On,
        lastRenderedState: Y
      },
      next: null
    };
    var i = {};
    return e.next = {
      memoizedState: i,
      baseState: i,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: On,
        lastRenderedState: i
      },
      next: null
    }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
  }
  function ig(t) {
    var e = ng(t);
    e.next === null && (e = t.alternate.memoizedState), Hl(
      t,
      e.next.queue,
      {},
      Be()
    );
  }
  function lc() {
    return ce(Il);
  }
  function ag() {
    return Ft().memoizedState;
  }
  function lg() {
    return Ft().memoizedState;
  }
  function K1(t) {
    for (var e = t.return; e !== null; ) {
      switch (e.tag) {
        case 24:
        case 3:
          var i = Be();
          t = li(i);
          var l = oi(e, t, i);
          l !== null && (Te(l, e, i), Ml(l, e, i)), e = { cache: Hu() }, t.payload = e;
          return;
      }
      e = e.return;
    }
  }
  function $1(t, e, i) {
    var l = Be();
    i = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: i,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, ws(t) ? sg(e, i) : (i = Eu(t, e, i, l), i !== null && (Te(i, t, l), rg(i, e, l)));
  }
  function og(t, e, i) {
    var l = Be();
    Hl(t, e, i, l);
  }
  function Hl(t, e, i, l) {
    var r = {
      lane: l,
      revertLane: 0,
      gesture: null,
      action: i,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (ws(t)) sg(e, r);
    else {
      var c = t.alternate;
      if (t.lanes === 0 && (c === null || c.lanes === 0) && (c = e.lastRenderedReducer, c !== null))
        try {
          var y = e.lastRenderedState, x = c(y, i);
          if (r.hasEagerState = !0, r.eagerState = x, Oe(x, y))
            return ns(t, e, r, 0), Vt === null && es(), !1;
        } catch {
        }
      if (i = Eu(t, e, r, l), i !== null)
        return Te(i, t, l), rg(i, e, l), !0;
    }
    return !1;
  }
  function oc(t, e, i, l) {
    if (l = {
      lane: 2,
      revertLane: Lc(),
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, ws(t)) {
      if (e) throw Error(s(479));
    } else
      e = Eu(
        t,
        i,
        l,
        2
      ), e !== null && Te(e, t, 2);
  }
  function ws(t) {
    var e = t.alternate;
    return t === St || e !== null && e === St;
  }
  function sg(t, e) {
    Ha = ps = !0;
    var i = t.pending;
    i === null ? e.next = e : (e.next = i.next, i.next = e), t.pending = e;
  }
  function rg(t, e, i) {
    if ((i & 4194048) !== 0) {
      var l = e.lanes;
      l &= t.pendingLanes, i |= l, e.lanes = i, jo(t, i);
    }
  }
  var jl = {
    readContext: ce,
    use: vs,
    useCallback: Kt,
    useContext: Kt,
    useEffect: Kt,
    useImperativeHandle: Kt,
    useLayoutEffect: Kt,
    useInsertionEffect: Kt,
    useMemo: Kt,
    useReducer: Kt,
    useRef: Kt,
    useState: Kt,
    useDebugValue: Kt,
    useDeferredValue: Kt,
    useTransition: Kt,
    useSyncExternalStore: Kt,
    useId: Kt,
    useHostTransitionStatus: Kt,
    useFormState: Kt,
    useActionState: Kt,
    useOptimistic: Kt,
    useMemoCache: Kt,
    useCacheRefresh: Kt
  };
  jl.useEffectEvent = Kt;
  var ug = {
    readContext: ce,
    use: vs,
    useCallback: function(t, e) {
      return ve().memoizedState = [
        t,
        e === void 0 ? null : e
      ], t;
    },
    useContext: ce,
    useEffect: Zh,
    useImperativeHandle: function(t, e, i) {
      i = i != null ? i.concat([t]) : null, xs(
        4194308,
        4,
        Fh.bind(null, e, t),
        i
      );
    },
    useLayoutEffect: function(t, e) {
      return xs(4194308, 4, t, e);
    },
    useInsertionEffect: function(t, e) {
      xs(4, 2, t, e);
    },
    useMemo: function(t, e) {
      var i = ve();
      e = e === void 0 ? null : e;
      var l = t();
      if ($i) {
        sn(!0);
        try {
          t();
        } finally {
          sn(!1);
        }
      }
      return i.memoizedState = [l, e], l;
    },
    useReducer: function(t, e, i) {
      var l = ve();
      if (i !== void 0) {
        var r = i(e);
        if ($i) {
          sn(!0);
          try {
            i(e);
          } finally {
            sn(!1);
          }
        }
      } else r = e;
      return l.memoizedState = l.baseState = r, t = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: t,
        lastRenderedState: r
      }, l.queue = t, t = t.dispatch = $1.bind(
        null,
        St,
        t
      ), [l.memoizedState, t];
    },
    useRef: function(t) {
      var e = ve();
      return t = { current: t }, e.memoizedState = t;
    },
    useState: function(t) {
      t = Pu(t);
      var e = t.queue, i = og.bind(null, St, e);
      return e.dispatch = i, [t.memoizedState, i];
    },
    useDebugValue: nc,
    useDeferredValue: function(t, e) {
      var i = ve();
      return ic(i, t, e);
    },
    useTransition: function() {
      var t = Pu(!1);
      return t = eg.bind(
        null,
        St,
        t.queue,
        !0,
        !1
      ), ve().memoizedState = t, [!1, t];
    },
    useSyncExternalStore: function(t, e, i) {
      var l = St, r = ve();
      if (Mt) {
        if (i === void 0)
          throw Error(s(407));
        i = i();
      } else {
        if (i = e(), Vt === null)
          throw Error(s(349));
        (Tt & 127) !== 0 || zh(l, e, i);
      }
      r.memoizedState = i;
      var c = { value: i, getSnapshot: e };
      return r.queue = c, Zh(Dh.bind(null, l, c, t), [
        t
      ]), l.flags |= 2048, Ua(
        9,
        { destroy: void 0 },
        Oh.bind(
          null,
          l,
          c,
          i,
          e
        ),
        null
      ), i;
    },
    useId: function() {
      var t = ve(), e = Vt.identifierPrefix;
      if (Mt) {
        var i = cn, l = un;
        i = (l & ~(1 << 32 - me(l) - 1)).toString(32) + i, e = "_" + e + "R_" + i, i = ys++, 0 < i && (e += "H" + i.toString(32)), e += "_";
      } else
        i = V1++, e = "_" + e + "r_" + i.toString(32) + "_";
      return t.memoizedState = e;
    },
    useHostTransitionStatus: lc,
    useFormState: Vh,
    useActionState: Vh,
    useOptimistic: function(t) {
      var e = ve();
      e.memoizedState = e.baseState = t;
      var i = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return e.queue = i, e = oc.bind(
        null,
        St,
        !0,
        i
      ), i.dispatch = e, [t, e];
    },
    useMemoCache: Fu,
    useCacheRefresh: function() {
      return ve().memoizedState = K1.bind(
        null,
        St
      );
    },
    useEffectEvent: function(t) {
      var e = ve(), i = { impl: t };
      return e.memoizedState = i, function() {
        if ((Rt & 2) !== 0)
          throw Error(s(440));
        return i.impl.apply(void 0, arguments);
      };
    }
  }, sc = {
    readContext: ce,
    use: vs,
    useCallback: Wh,
    useContext: ce,
    useEffect: ec,
    useImperativeHandle: Ih,
    useInsertionEffect: $h,
    useLayoutEffect: Jh,
    useMemo: Ph,
    useReducer: bs,
    useRef: Gh,
    useState: function() {
      return bs(On);
    },
    useDebugValue: nc,
    useDeferredValue: function(t, e) {
      var i = Ft();
      return tg(
        i,
        Lt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = bs(On)[0], e = Ft().memoizedState;
      return [
        typeof t == "boolean" ? t : Rl(t),
        e
      ];
    },
    useSyncExternalStore: Mh,
    useId: ag,
    useHostTransitionStatus: lc,
    useFormState: Qh,
    useActionState: Qh,
    useOptimistic: function(t, e) {
      var i = Ft();
      return jh(i, Lt, t, e);
    },
    useMemoCache: Fu,
    useCacheRefresh: lg
  };
  sc.useEffectEvent = Kh;
  var cg = {
    readContext: ce,
    use: vs,
    useCallback: Wh,
    useContext: ce,
    useEffect: ec,
    useImperativeHandle: Ih,
    useInsertionEffect: $h,
    useLayoutEffect: Jh,
    useMemo: Ph,
    useReducer: Wu,
    useRef: Gh,
    useState: function() {
      return Wu(On);
    },
    useDebugValue: nc,
    useDeferredValue: function(t, e) {
      var i = Ft();
      return Lt === null ? ic(i, t, e) : tg(
        i,
        Lt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = Wu(On)[0], e = Ft().memoizedState;
      return [
        typeof t == "boolean" ? t : Rl(t),
        e
      ];
    },
    useSyncExternalStore: Mh,
    useId: ag,
    useHostTransitionStatus: lc,
    useFormState: kh,
    useActionState: kh,
    useOptimistic: function(t, e) {
      var i = Ft();
      return Lt !== null ? jh(i, Lt, t, e) : (i.baseState = t, [t, i.queue.dispatch]);
    },
    useMemoCache: Fu,
    useCacheRefresh: lg
  };
  cg.useEffectEvent = Kh;
  function rc(t, e, i, l) {
    e = t.memoizedState, i = i(l, e), i = i == null ? e : v({}, e, i), t.memoizedState = i, t.lanes === 0 && (t.updateQueue.baseState = i);
  }
  var uc = {
    enqueueSetState: function(t, e, i) {
      t = t._reactInternals;
      var l = Be(), r = li(l);
      r.payload = e, i != null && (r.callback = i), e = oi(t, r, l), e !== null && (Te(e, t, l), Ml(e, t, l));
    },
    enqueueReplaceState: function(t, e, i) {
      t = t._reactInternals;
      var l = Be(), r = li(l);
      r.tag = 1, r.payload = e, i != null && (r.callback = i), e = oi(t, r, l), e !== null && (Te(e, t, l), Ml(e, t, l));
    },
    enqueueForceUpdate: function(t, e) {
      t = t._reactInternals;
      var i = Be(), l = li(i);
      l.tag = 2, e != null && (l.callback = e), e = oi(t, l, i), e !== null && (Te(e, t, i), Ml(e, t, i));
    }
  };
  function fg(t, e, i, l, r, c, y) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(l, c, y) : e.prototype && e.prototype.isPureReactComponent ? !Sl(i, l) || !Sl(r, c) : !0;
  }
  function dg(t, e, i, l) {
    t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(i, l), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(i, l), e.state !== t && uc.enqueueReplaceState(e, e.state, null);
  }
  function Ji(t, e) {
    var i = e;
    if ("ref" in e) {
      i = {};
      for (var l in e)
        l !== "ref" && (i[l] = e[l]);
    }
    if (t = t.defaultProps) {
      i === e && (i = v({}, i));
      for (var r in t)
        i[r] === void 0 && (i[r] = t[r]);
    }
    return i;
  }
  function hg(t) {
    ts(t);
  }
  function gg(t) {
    console.error(t);
  }
  function pg(t) {
    ts(t);
  }
  function Es(t, e) {
    try {
      var i = t.onUncaughtError;
      i(e.value, { componentStack: e.stack });
    } catch (l) {
      setTimeout(function() {
        throw l;
      });
    }
  }
  function yg(t, e, i) {
    try {
      var l = t.onCaughtError;
      l(i.value, {
        componentStack: i.stack,
        errorBoundary: e.tag === 1 ? e.stateNode : null
      });
    } catch (r) {
      setTimeout(function() {
        throw r;
      });
    }
  }
  function cc(t, e, i) {
    return i = li(i), i.tag = 3, i.payload = { element: null }, i.callback = function() {
      Es(t, e);
    }, i;
  }
  function mg(t) {
    return t = li(t), t.tag = 3, t;
  }
  function vg(t, e, i, l) {
    var r = i.type.getDerivedStateFromError;
    if (typeof r == "function") {
      var c = l.value;
      t.payload = function() {
        return r(c);
      }, t.callback = function() {
        yg(e, i, l);
      };
    }
    var y = i.stateNode;
    y !== null && typeof y.componentDidCatch == "function" && (t.callback = function() {
      yg(e, i, l), typeof r != "function" && (di === null ? di = /* @__PURE__ */ new Set([this]) : di.add(this));
      var x = l.stack;
      this.componentDidCatch(l.value, {
        componentStack: x !== null ? x : ""
      });
    });
  }
  function J1(t, e, i, l, r) {
    if (i.flags |= 32768, l !== null && typeof l == "object" && typeof l.then == "function") {
      if (e = i.alternate, e !== null && Aa(
        e,
        i,
        r,
        !0
      ), i = Re.current, i !== null) {
        switch (i.tag) {
          case 31:
          case 13:
            return Ge === null ? js() : i.alternate === null && $t === 0 && ($t = 3), i.flags &= -257, i.flags |= 65536, i.lanes = r, l === cs ? i.flags |= 16384 : (e = i.updateQueue, e === null ? i.updateQueue = /* @__PURE__ */ new Set([l]) : e.add(l), jc(t, l, r)), !1;
          case 22:
            return i.flags |= 65536, l === cs ? i.flags |= 16384 : (e = i.updateQueue, e === null ? (e = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([l])
            }, i.updateQueue = e) : (i = e.retryQueue, i === null ? e.retryQueue = /* @__PURE__ */ new Set([l]) : i.add(l)), jc(t, l, r)), !1;
        }
        throw Error(s(435, i.tag));
      }
      return jc(t, l, r), js(), !1;
    }
    if (Mt)
      return e = Re.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = r, l !== Mu && (t = Error(s(422), { cause: l }), _l(Ve(t, i)))) : (l !== Mu && (e = Error(s(423), {
        cause: l
      }), _l(
        Ve(e, i)
      )), t = t.current.alternate, t.flags |= 65536, r &= -r, t.lanes |= r, l = Ve(l, i), r = cc(
        t.stateNode,
        l,
        r
      ), Yu(t, r), $t !== 4 && ($t = 2)), !1;
    var c = Error(s(520), { cause: l });
    if (c = Ve(c, i), Xl === null ? Xl = [c] : Xl.push(c), $t !== 4 && ($t = 2), e === null) return !0;
    l = Ve(l, i), i = e;
    do {
      switch (i.tag) {
        case 3:
          return i.flags |= 65536, t = r & -r, i.lanes |= t, t = cc(i.stateNode, l, t), Yu(i, t), !1;
        case 1:
          if (e = i.type, c = i.stateNode, (i.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || c !== null && typeof c.componentDidCatch == "function" && (di === null || !di.has(c))))
            return i.flags |= 65536, r &= -r, i.lanes |= r, r = mg(r), vg(
              r,
              t,
              i,
              l
            ), Yu(i, r), !1;
      }
      i = i.return;
    } while (i !== null);
    return !1;
  }
  var fc = Error(s(461)), te = !1;
  function fe(t, e, i, l) {
    e.child = t === null ? wh(e, null, i, l) : Ki(
      e,
      t.child,
      i,
      l
    );
  }
  function bg(t, e, i, l, r) {
    i = i.render;
    var c = e.ref;
    if ("ref" in l) {
      var y = {};
      for (var x in l)
        x !== "ref" && (y[x] = l[x]);
    } else y = l;
    return Xi(e), l = Zu(
      t,
      e,
      i,
      y,
      c,
      r
    ), x = Ku(), t !== null && !te ? ($u(t, e, r), Dn(t, e, r)) : (Mt && x && Tu(e), e.flags |= 1, fe(t, e, l, r), e.child);
  }
  function xg(t, e, i, l, r) {
    if (t === null) {
      var c = i.type;
      return typeof c == "function" && !_u(c) && c.defaultProps === void 0 && i.compare === null ? (e.tag = 15, e.type = c, Sg(
        t,
        e,
        c,
        l,
        r
      )) : (t = as(
        i.type,
        null,
        l,
        e,
        e.mode,
        r
      ), t.ref = e.ref, t.return = e, e.child = t);
    }
    if (c = t.child, !bc(t, r)) {
      var y = c.memoizedProps;
      if (i = i.compare, i = i !== null ? i : Sl, i(y, l) && t.ref === e.ref)
        return Dn(t, e, r);
    }
    return e.flags |= 1, t = Nn(c, l), t.ref = e.ref, t.return = e, e.child = t;
  }
  function Sg(t, e, i, l, r) {
    if (t !== null) {
      var c = t.memoizedProps;
      if (Sl(c, l) && t.ref === e.ref)
        if (te = !1, e.pendingProps = l = c, bc(t, r))
          (t.flags & 131072) !== 0 && (te = !0);
        else
          return e.lanes = t.lanes, Dn(t, e, r);
    }
    return dc(
      t,
      e,
      i,
      l,
      r
    );
  }
  function wg(t, e, i, l) {
    var r = l.children, c = t !== null ? t.memoizedState : null;
    if (t === null && e.stateNode === null && (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), l.mode === "hidden") {
      if ((e.flags & 128) !== 0) {
        if (c = c !== null ? c.baseLanes | i : i, t !== null) {
          for (l = e.child = t.child, r = 0; l !== null; )
            r = r | l.lanes | l.childLanes, l = l.sibling;
          l = r & ~c;
        } else l = 0, e.child = null;
        return Eg(
          t,
          e,
          c,
          i,
          l
        );
      }
      if ((i & 536870912) !== 0)
        e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && rs(
          e,
          c !== null ? c.cachePool : null
        ), c !== null ? Ch(e, c) : Qu(), Nh(e);
      else
        return l = e.lanes = 536870912, Eg(
          t,
          e,
          c !== null ? c.baseLanes | i : i,
          i,
          l
        );
    } else
      c !== null ? (rs(e, c.cachePool), Ch(e, c), ri(), e.memoizedState = null) : (t !== null && rs(e, null), Qu(), ri());
    return fe(t, e, r, i), e.child;
  }
  function Ul(t, e) {
    return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), e.sibling;
  }
  function Eg(t, e, i, l, r) {
    var c = Uu();
    return c = c === null ? null : { parent: Wt._currentValue, pool: c }, e.memoizedState = {
      baseLanes: i,
      cachePool: c
    }, t !== null && rs(e, null), Qu(), Nh(e), t !== null && Aa(t, e, l, !0), e.childLanes = r, null;
  }
  function _s(t, e) {
    return e = Ns(
      { mode: e.mode, children: e.children },
      t.mode
    ), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function _g(t, e, i) {
    return Ki(e, t.child, null, i), t = _s(e, e.pendingProps), t.flags |= 2, He(e), e.memoizedState = null, t;
  }
  function F1(t, e, i) {
    var l = e.pendingProps, r = (e.flags & 128) !== 0;
    if (e.flags &= -129, t === null) {
      if (Mt) {
        if (l.mode === "hidden")
          return t = _s(e, l), e.lanes = 536870912, Ul(null, t);
        if (ku(e), (t = Qt) ? (t = Up(
          t,
          ke
        ), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: ti !== null ? { id: un, overflow: cn } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, i = sh(t), i.return = e, e.child = i, ue = e, Qt = null)) : t = null, t === null) throw ni(e);
        return e.lanes = 536870912, null;
      }
      return _s(e, l);
    }
    var c = t.memoizedState;
    if (c !== null) {
      var y = c.dehydrated;
      if (ku(e), r)
        if (e.flags & 256)
          e.flags &= -257, e = _g(
            t,
            e,
            i
          );
        else if (e.memoizedState !== null)
          e.child = t.child, e.flags |= 128, e = null;
        else throw Error(s(558));
      else if (te || Aa(t, e, i, !1), r = (i & t.childLanes) !== 0, te || r) {
        if (l = Vt, l !== null && (y = Uo(l, i), y !== 0 && y !== c.retryLane))
          throw c.retryLane = y, qi(t, y), Te(l, t, y), fc;
        js(), e = _g(
          t,
          e,
          i
        );
      } else
        t = c.treeContext, Qt = Ze(y.nextSibling), ue = e, Mt = !0, ei = null, ke = !1, t !== null && ch(e, t), e = _s(e, l), e.flags |= 4096;
      return e;
    }
    return t = Nn(t.child, {
      mode: l.mode,
      children: l.children
    }), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Cs(t, e) {
    var i = e.ref;
    if (i === null)
      t !== null && t.ref !== null && (e.flags |= 4194816);
    else {
      if (typeof i != "function" && typeof i != "object")
        throw Error(s(284));
      (t === null || t.ref !== i) && (e.flags |= 4194816);
    }
  }
  function dc(t, e, i, l, r) {
    return Xi(e), i = Zu(
      t,
      e,
      i,
      l,
      void 0,
      r
    ), l = Ku(), t !== null && !te ? ($u(t, e, r), Dn(t, e, r)) : (Mt && l && Tu(e), e.flags |= 1, fe(t, e, i, r), e.child);
  }
  function Cg(t, e, i, l, r, c) {
    return Xi(e), e.updateQueue = null, i = Ah(
      e,
      l,
      i,
      r
    ), Th(t), l = Ku(), t !== null && !te ? ($u(t, e, c), Dn(t, e, c)) : (Mt && l && Tu(e), e.flags |= 1, fe(t, e, i, c), e.child);
  }
  function Ng(t, e, i, l, r) {
    if (Xi(e), e.stateNode === null) {
      var c = _a, y = i.contextType;
      typeof y == "object" && y !== null && (c = ce(y)), c = new i(l, c), e.memoizedState = c.state !== null && c.state !== void 0 ? c.state : null, c.updater = uc, e.stateNode = c, c._reactInternals = e, c = e.stateNode, c.props = l, c.state = e.memoizedState, c.refs = {}, Lu(e), y = i.contextType, c.context = typeof y == "object" && y !== null ? ce(y) : _a, c.state = e.memoizedState, y = i.getDerivedStateFromProps, typeof y == "function" && (rc(
        e,
        i,
        y,
        l
      ), c.state = e.memoizedState), typeof i.getDerivedStateFromProps == "function" || typeof c.getSnapshotBeforeUpdate == "function" || typeof c.UNSAFE_componentWillMount != "function" && typeof c.componentWillMount != "function" || (y = c.state, typeof c.componentWillMount == "function" && c.componentWillMount(), typeof c.UNSAFE_componentWillMount == "function" && c.UNSAFE_componentWillMount(), y !== c.state && uc.enqueueReplaceState(c, c.state, null), Ol(e, l, c, r), zl(), c.state = e.memoizedState), typeof c.componentDidMount == "function" && (e.flags |= 4194308), l = !0;
    } else if (t === null) {
      c = e.stateNode;
      var x = e.memoizedProps, R = Ji(i, x);
      c.props = R;
      var J = c.context, nt = i.contextType;
      y = _a, typeof nt == "object" && nt !== null && (y = ce(nt));
      var lt = i.getDerivedStateFromProps;
      nt = typeof lt == "function" || typeof c.getSnapshotBeforeUpdate == "function", x = e.pendingProps !== x, nt || typeof c.UNSAFE_componentWillReceiveProps != "function" && typeof c.componentWillReceiveProps != "function" || (x || J !== y) && dg(
        e,
        c,
        l,
        y
      ), ai = !1;
      var I = e.memoizedState;
      c.state = I, Ol(e, l, c, r), zl(), J = e.memoizedState, x || I !== J || ai ? (typeof lt == "function" && (rc(
        e,
        i,
        lt,
        l
      ), J = e.memoizedState), (R = ai || fg(
        e,
        i,
        R,
        l,
        I,
        J,
        y
      )) ? (nt || typeof c.UNSAFE_componentWillMount != "function" && typeof c.componentWillMount != "function" || (typeof c.componentWillMount == "function" && c.componentWillMount(), typeof c.UNSAFE_componentWillMount == "function" && c.UNSAFE_componentWillMount()), typeof c.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof c.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = l, e.memoizedState = J), c.props = l, c.state = J, c.context = y, l = R) : (typeof c.componentDidMount == "function" && (e.flags |= 4194308), l = !1);
    } else {
      c = e.stateNode, qu(t, e), y = e.memoizedProps, nt = Ji(i, y), c.props = nt, lt = e.pendingProps, I = c.context, J = i.contextType, R = _a, typeof J == "object" && J !== null && (R = ce(J)), x = i.getDerivedStateFromProps, (J = typeof x == "function" || typeof c.getSnapshotBeforeUpdate == "function") || typeof c.UNSAFE_componentWillReceiveProps != "function" && typeof c.componentWillReceiveProps != "function" || (y !== lt || I !== R) && dg(
        e,
        c,
        l,
        R
      ), ai = !1, I = e.memoizedState, c.state = I, Ol(e, l, c, r), zl();
      var W = e.memoizedState;
      y !== lt || I !== W || ai || t !== null && t.dependencies !== null && os(t.dependencies) ? (typeof x == "function" && (rc(
        e,
        i,
        x,
        l
      ), W = e.memoizedState), (nt = ai || fg(
        e,
        i,
        nt,
        l,
        I,
        W,
        R
      ) || t !== null && t.dependencies !== null && os(t.dependencies)) ? (J || typeof c.UNSAFE_componentWillUpdate != "function" && typeof c.componentWillUpdate != "function" || (typeof c.componentWillUpdate == "function" && c.componentWillUpdate(l, W, R), typeof c.UNSAFE_componentWillUpdate == "function" && c.UNSAFE_componentWillUpdate(
        l,
        W,
        R
      )), typeof c.componentDidUpdate == "function" && (e.flags |= 4), typeof c.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof c.componentDidUpdate != "function" || y === t.memoizedProps && I === t.memoizedState || (e.flags |= 4), typeof c.getSnapshotBeforeUpdate != "function" || y === t.memoizedProps && I === t.memoizedState || (e.flags |= 1024), e.memoizedProps = l, e.memoizedState = W), c.props = l, c.state = W, c.context = R, l = nt) : (typeof c.componentDidUpdate != "function" || y === t.memoizedProps && I === t.memoizedState || (e.flags |= 4), typeof c.getSnapshotBeforeUpdate != "function" || y === t.memoizedProps && I === t.memoizedState || (e.flags |= 1024), l = !1);
    }
    return c = l, Cs(t, e), l = (e.flags & 128) !== 0, c || l ? (c = e.stateNode, i = l && typeof i.getDerivedStateFromError != "function" ? null : c.render(), e.flags |= 1, t !== null && l ? (e.child = Ki(
      e,
      t.child,
      null,
      r
    ), e.child = Ki(
      e,
      null,
      i,
      r
    )) : fe(t, e, i, r), e.memoizedState = c.state, t = e.child) : t = Dn(
      t,
      e,
      r
    ), t;
  }
  function Tg(t, e, i, l) {
    return Vi(), e.flags |= 256, fe(t, e, i, l), e.child;
  }
  var hc = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function gc(t) {
    return { baseLanes: t, cachePool: yh() };
  }
  function pc(t, e, i) {
    return t = t !== null ? t.childLanes & ~i : 0, e && (t |= Ue), t;
  }
  function Ag(t, e, i) {
    var l = e.pendingProps, r = !1, c = (e.flags & 128) !== 0, y;
    if ((y = c) || (y = t !== null && t.memoizedState === null ? !1 : (Jt.current & 2) !== 0), y && (r = !0, e.flags &= -129), y = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
      if (Mt) {
        if (r ? si(e) : ri(), (t = Qt) ? (t = Up(
          t,
          ke
        ), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: ti !== null ? { id: un, overflow: cn } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, i = sh(t), i.return = e, e.child = i, ue = e, Qt = null)) : t = null, t === null) throw ni(e);
        return Ic(t) ? e.lanes = 32 : e.lanes = 536870912, null;
      }
      var x = l.children;
      return l = l.fallback, r ? (ri(), r = e.mode, x = Ns(
        { mode: "hidden", children: x },
        r
      ), l = Yi(
        l,
        r,
        i,
        null
      ), x.return = e, l.return = e, x.sibling = l, e.child = x, l = e.child, l.memoizedState = gc(i), l.childLanes = pc(
        t,
        y,
        i
      ), e.memoizedState = hc, Ul(null, l)) : (si(e), yc(e, x));
    }
    var R = t.memoizedState;
    if (R !== null && (x = R.dehydrated, x !== null)) {
      if (c)
        e.flags & 256 ? (si(e), e.flags &= -257, e = mc(
          t,
          e,
          i
        )) : e.memoizedState !== null ? (ri(), e.child = t.child, e.flags |= 128, e = null) : (ri(), x = l.fallback, r = e.mode, l = Ns(
          { mode: "visible", children: l.children },
          r
        ), x = Yi(
          x,
          r,
          i,
          null
        ), x.flags |= 2, l.return = e, x.return = e, l.sibling = x, e.child = l, Ki(
          e,
          t.child,
          null,
          i
        ), l = e.child, l.memoizedState = gc(i), l.childLanes = pc(
          t,
          y,
          i
        ), e.memoizedState = hc, e = Ul(null, l));
      else if (si(e), Ic(x)) {
        if (y = x.nextSibling && x.nextSibling.dataset, y) var J = y.dgst;
        y = J, l = Error(s(419)), l.stack = "", l.digest = y, _l({ value: l, source: null, stack: null }), e = mc(
          t,
          e,
          i
        );
      } else if (te || Aa(t, e, i, !1), y = (i & t.childLanes) !== 0, te || y) {
        if (y = Vt, y !== null && (l = Uo(y, i), l !== 0 && l !== R.retryLane))
          throw R.retryLane = l, qi(t, l), Te(y, t, l), fc;
        Fc(x) || js(), e = mc(
          t,
          e,
          i
        );
      } else
        Fc(x) ? (e.flags |= 192, e.child = t.child, e = null) : (t = R.treeContext, Qt = Ze(
          x.nextSibling
        ), ue = e, Mt = !0, ei = null, ke = !1, t !== null && ch(e, t), e = yc(
          e,
          l.children
        ), e.flags |= 4096);
      return e;
    }
    return r ? (ri(), x = l.fallback, r = e.mode, R = t.child, J = R.sibling, l = Nn(R, {
      mode: "hidden",
      children: l.children
    }), l.subtreeFlags = R.subtreeFlags & 65011712, J !== null ? x = Nn(
      J,
      x
    ) : (x = Yi(
      x,
      r,
      i,
      null
    ), x.flags |= 2), x.return = e, l.return = e, l.sibling = x, e.child = l, Ul(null, l), l = e.child, x = t.child.memoizedState, x === null ? x = gc(i) : (r = x.cachePool, r !== null ? (R = Wt._currentValue, r = r.parent !== R ? { parent: R, pool: R } : r) : r = yh(), x = {
      baseLanes: x.baseLanes | i,
      cachePool: r
    }), l.memoizedState = x, l.childLanes = pc(
      t,
      y,
      i
    ), e.memoizedState = hc, Ul(t.child, l)) : (si(e), i = t.child, t = i.sibling, i = Nn(i, {
      mode: "visible",
      children: l.children
    }), i.return = e, i.sibling = null, t !== null && (y = e.deletions, y === null ? (e.deletions = [t], e.flags |= 16) : y.push(t)), e.child = i, e.memoizedState = null, i);
  }
  function yc(t, e) {
    return e = Ns(
      { mode: "visible", children: e },
      t.mode
    ), e.return = t, t.child = e;
  }
  function Ns(t, e) {
    return t = De(22, t, null, e), t.lanes = 0, t;
  }
  function mc(t, e, i) {
    return Ki(e, t.child, null, i), t = yc(
      e,
      e.pendingProps.children
    ), t.flags |= 2, e.memoizedState = null, t;
  }
  function Mg(t, e, i) {
    t.lanes |= e;
    var l = t.alternate;
    l !== null && (l.lanes |= e), Du(t.return, e, i);
  }
  function vc(t, e, i, l, r, c) {
    var y = t.memoizedState;
    y === null ? t.memoizedState = {
      isBackwards: e,
      rendering: null,
      renderingStartTime: 0,
      last: l,
      tail: i,
      tailMode: r,
      treeForkCount: c
    } : (y.isBackwards = e, y.rendering = null, y.renderingStartTime = 0, y.last = l, y.tail = i, y.tailMode = r, y.treeForkCount = c);
  }
  function zg(t, e, i) {
    var l = e.pendingProps, r = l.revealOrder, c = l.tail;
    l = l.children;
    var y = Jt.current, x = (y & 2) !== 0;
    if (x ? (y = y & 1 | 2, e.flags |= 128) : y &= 1, P(Jt, y), fe(t, e, l, i), l = Mt ? El : 0, !x && t !== null && (t.flags & 128) !== 0)
      t: for (t = e.child; t !== null; ) {
        if (t.tag === 13)
          t.memoizedState !== null && Mg(t, i, e);
        else if (t.tag === 19)
          Mg(t, i, e);
        else if (t.child !== null) {
          t.child.return = t, t = t.child;
          continue;
        }
        if (t === e) break t;
        for (; t.sibling === null; ) {
          if (t.return === null || t.return === e)
            break t;
          t = t.return;
        }
        t.sibling.return = t.return, t = t.sibling;
      }
    switch (r) {
      case "forwards":
        for (i = e.child, r = null; i !== null; )
          t = i.alternate, t !== null && gs(t) === null && (r = i), i = i.sibling;
        i = r, i === null ? (r = e.child, e.child = null) : (r = i.sibling, i.sibling = null), vc(
          e,
          !1,
          r,
          i,
          c,
          l
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (i = null, r = e.child, e.child = null; r !== null; ) {
          if (t = r.alternate, t !== null && gs(t) === null) {
            e.child = r;
            break;
          }
          t = r.sibling, r.sibling = i, i = r, r = t;
        }
        vc(
          e,
          !0,
          i,
          null,
          c,
          l
        );
        break;
      case "together":
        vc(
          e,
          !1,
          null,
          null,
          void 0,
          l
        );
        break;
      default:
        e.memoizedState = null;
    }
    return e.child;
  }
  function Dn(t, e, i) {
    if (t !== null && (e.dependencies = t.dependencies), fi |= e.lanes, (i & e.childLanes) === 0)
      if (t !== null) {
        if (Aa(
          t,
          e,
          i,
          !1
        ), (i & e.childLanes) === 0)
          return null;
      } else return null;
    if (t !== null && e.child !== t.child)
      throw Error(s(153));
    if (e.child !== null) {
      for (t = e.child, i = Nn(t, t.pendingProps), e.child = i, i.return = e; t.sibling !== null; )
        t = t.sibling, i = i.sibling = Nn(t, t.pendingProps), i.return = e;
      i.sibling = null;
    }
    return e.child;
  }
  function bc(t, e) {
    return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && os(t)));
  }
  function I1(t, e, i) {
    switch (e.tag) {
      case 3:
        st(e, e.stateNode.containerInfo), ii(e, Wt, t.memoizedState.cache), Vi();
        break;
      case 27:
      case 5:
        wt(e);
        break;
      case 4:
        st(e, e.stateNode.containerInfo);
        break;
      case 10:
        ii(
          e,
          e.type,
          e.memoizedProps.value
        );
        break;
      case 31:
        if (e.memoizedState !== null)
          return e.flags |= 128, ku(e), null;
        break;
      case 13:
        var l = e.memoizedState;
        if (l !== null)
          return l.dehydrated !== null ? (si(e), e.flags |= 128, null) : (i & e.child.childLanes) !== 0 ? Ag(t, e, i) : (si(e), t = Dn(
            t,
            e,
            i
          ), t !== null ? t.sibling : null);
        si(e);
        break;
      case 19:
        var r = (t.flags & 128) !== 0;
        if (l = (i & e.childLanes) !== 0, l || (Aa(
          t,
          e,
          i,
          !1
        ), l = (i & e.childLanes) !== 0), r) {
          if (l)
            return zg(
              t,
              e,
              i
            );
          e.flags |= 128;
        }
        if (r = e.memoizedState, r !== null && (r.rendering = null, r.tail = null, r.lastEffect = null), P(Jt, Jt.current), l) break;
        return null;
      case 22:
        return e.lanes = 0, wg(
          t,
          e,
          i,
          e.pendingProps
        );
      case 24:
        ii(e, Wt, t.memoizedState.cache);
    }
    return Dn(t, e, i);
  }
  function Og(t, e, i) {
    if (t !== null)
      if (t.memoizedProps !== e.pendingProps)
        te = !0;
      else {
        if (!bc(t, i) && (e.flags & 128) === 0)
          return te = !1, I1(
            t,
            e,
            i
          );
        te = (t.flags & 131072) !== 0;
      }
    else
      te = !1, Mt && (e.flags & 1048576) !== 0 && uh(e, El, e.index);
    switch (e.lanes = 0, e.tag) {
      case 16:
        t: {
          var l = e.pendingProps;
          if (t = Gi(e.elementType), e.type = t, typeof t == "function")
            _u(t) ? (l = Ji(t, l), e.tag = 1, e = Ng(
              null,
              e,
              t,
              l,
              i
            )) : (e.tag = 0, e = dc(
              null,
              e,
              t,
              l,
              i
            ));
          else {
            if (t != null) {
              var r = t.$$typeof;
              if (r === z) {
                e.tag = 11, e = bg(
                  null,
                  e,
                  t,
                  l,
                  i
                );
                break t;
              } else if (r === U) {
                e.tag = 14, e = xg(
                  null,
                  e,
                  t,
                  l,
                  i
                );
                break t;
              }
            }
            throw e = O(t) || t, Error(s(306, e, ""));
          }
        }
        return e;
      case 0:
        return dc(
          t,
          e,
          e.type,
          e.pendingProps,
          i
        );
      case 1:
        return l = e.type, r = Ji(
          l,
          e.pendingProps
        ), Ng(
          t,
          e,
          l,
          r,
          i
        );
      case 3:
        t: {
          if (st(
            e,
            e.stateNode.containerInfo
          ), t === null) throw Error(s(387));
          l = e.pendingProps;
          var c = e.memoizedState;
          r = c.element, qu(t, e), Ol(e, l, null, i);
          var y = e.memoizedState;
          if (l = y.cache, ii(e, Wt, l), l !== c.cache && Ru(
            e,
            [Wt],
            i,
            !0
          ), zl(), l = y.element, c.isDehydrated)
            if (c = {
              element: l,
              isDehydrated: !1,
              cache: y.cache
            }, e.updateQueue.baseState = c, e.memoizedState = c, e.flags & 256) {
              e = Tg(
                t,
                e,
                l,
                i
              );
              break t;
            } else if (l !== r) {
              r = Ve(
                Error(s(424)),
                e
              ), _l(r), e = Tg(
                t,
                e,
                l,
                i
              );
              break t;
            } else
              for (t = e.stateNode.containerInfo, t.nodeType === 9 ? t = t.body : t = t.nodeName === "HTML" ? t.ownerDocument.body : t, Qt = Ze(t.firstChild), ue = e, Mt = !0, ei = null, ke = !0, i = wh(
                e,
                null,
                l,
                i
              ), e.child = i; i; )
                i.flags = i.flags & -3 | 4096, i = i.sibling;
          else {
            if (Vi(), l === r) {
              e = Dn(
                t,
                e,
                i
              );
              break t;
            }
            fe(t, e, l, i);
          }
          e = e.child;
        }
        return e;
      case 26:
        return Cs(t, e), t === null ? (i = Qp(
          e.type,
          null,
          e.pendingProps,
          null
        )) ? e.memoizedState = i : Mt || (i = e.type, t = e.pendingProps, l = Qs(
          ct.current
        ).createElement(i), l[ae] = e, l[ge] = t, de(l, i, t), It(l), e.stateNode = l) : e.memoizedState = Qp(
          e.type,
          t.memoizedProps,
          e.pendingProps,
          t.memoizedState
        ), null;
      case 27:
        return wt(e), t === null && Mt && (l = e.stateNode = qp(
          e.type,
          e.pendingProps,
          ct.current
        ), ue = e, ke = !0, r = Qt, yi(e.type) ? (Wc = r, Qt = Ze(l.firstChild)) : Qt = r), fe(
          t,
          e,
          e.pendingProps.children,
          i
        ), Cs(t, e), t === null && (e.flags |= 4194304), e.child;
      case 5:
        return t === null && Mt && ((r = l = Qt) && (l = Tb(
          l,
          e.type,
          e.pendingProps,
          ke
        ), l !== null ? (e.stateNode = l, ue = e, Qt = Ze(l.firstChild), ke = !1, r = !0) : r = !1), r || ni(e)), wt(e), r = e.type, c = e.pendingProps, y = t !== null ? t.memoizedProps : null, l = c.children, Kc(r, c) ? l = null : y !== null && Kc(r, y) && (e.flags |= 32), e.memoizedState !== null && (r = Zu(
          t,
          e,
          Q1,
          null,
          null,
          i
        ), Il._currentValue = r), Cs(t, e), fe(t, e, l, i), e.child;
      case 6:
        return t === null && Mt && ((t = i = Qt) && (i = Ab(
          i,
          e.pendingProps,
          ke
        ), i !== null ? (e.stateNode = i, ue = e, Qt = null, t = !0) : t = !1), t || ni(e)), null;
      case 13:
        return Ag(t, e, i);
      case 4:
        return st(
          e,
          e.stateNode.containerInfo
        ), l = e.pendingProps, t === null ? e.child = Ki(
          e,
          null,
          l,
          i
        ) : fe(t, e, l, i), e.child;
      case 11:
        return bg(
          t,
          e,
          e.type,
          e.pendingProps,
          i
        );
      case 7:
        return fe(
          t,
          e,
          e.pendingProps,
          i
        ), e.child;
      case 8:
        return fe(
          t,
          e,
          e.pendingProps.children,
          i
        ), e.child;
      case 12:
        return fe(
          t,
          e,
          e.pendingProps.children,
          i
        ), e.child;
      case 10:
        return l = e.pendingProps, ii(e, e.type, l.value), fe(t, e, l.children, i), e.child;
      case 9:
        return r = e.type._context, l = e.pendingProps.children, Xi(e), r = ce(r), l = l(r), e.flags |= 1, fe(t, e, l, i), e.child;
      case 14:
        return xg(
          t,
          e,
          e.type,
          e.pendingProps,
          i
        );
      case 15:
        return Sg(
          t,
          e,
          e.type,
          e.pendingProps,
          i
        );
      case 19:
        return zg(t, e, i);
      case 31:
        return F1(t, e, i);
      case 22:
        return wg(
          t,
          e,
          i,
          e.pendingProps
        );
      case 24:
        return Xi(e), l = ce(Wt), t === null ? (r = Uu(), r === null && (r = Vt, c = Hu(), r.pooledCache = c, c.refCount++, c !== null && (r.pooledCacheLanes |= i), r = c), e.memoizedState = { parent: l, cache: r }, Lu(e), ii(e, Wt, r)) : ((t.lanes & i) !== 0 && (qu(t, e), Ol(e, null, null, i), zl()), r = t.memoizedState, c = e.memoizedState, r.parent !== l ? (r = { parent: l, cache: l }, e.memoizedState = r, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = r), ii(e, Wt, l)) : (l = c.cache, ii(e, Wt, l), l !== r.cache && Ru(
          e,
          [Wt],
          i,
          !0
        ))), fe(
          t,
          e,
          e.pendingProps.children,
          i
        ), e.child;
      case 29:
        throw e.pendingProps;
    }
    throw Error(s(156, e.tag));
  }
  function Rn(t) {
    t.flags |= 4;
  }
  function xc(t, e, i, l, r) {
    if ((e = (t.mode & 32) !== 0) && (e = !1), e) {
      if (t.flags |= 16777216, (r & 335544128) === r)
        if (t.stateNode.complete) t.flags |= 8192;
        else if (ap()) t.flags |= 8192;
        else
          throw Zi = cs, Bu;
    } else t.flags &= -16777217;
  }
  function Dg(t, e) {
    if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0)
      t.flags &= -16777217;
    else if (t.flags |= 16777216, !Kp(e))
      if (ap()) t.flags |= 8192;
      else
        throw Zi = cs, Bu;
  }
  function Ts(t, e) {
    e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Ro() : 536870912, t.lanes |= e, Ya |= e);
  }
  function Bl(t, e) {
    if (!Mt)
      switch (t.tailMode) {
        case "hidden":
          e = t.tail;
          for (var i = null; e !== null; )
            e.alternate !== null && (i = e), e = e.sibling;
          i === null ? t.tail = null : i.sibling = null;
          break;
        case "collapsed":
          i = t.tail;
          for (var l = null; i !== null; )
            i.alternate !== null && (l = i), i = i.sibling;
          l === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : l.sibling = null;
      }
  }
  function Xt(t) {
    var e = t.alternate !== null && t.alternate.child === t.child, i = 0, l = 0;
    if (e)
      for (var r = t.child; r !== null; )
        i |= r.lanes | r.childLanes, l |= r.subtreeFlags & 65011712, l |= r.flags & 65011712, r.return = t, r = r.sibling;
    else
      for (r = t.child; r !== null; )
        i |= r.lanes | r.childLanes, l |= r.subtreeFlags, l |= r.flags, r.return = t, r = r.sibling;
    return t.subtreeFlags |= l, t.childLanes = i, e;
  }
  function W1(t, e, i) {
    var l = e.pendingProps;
    switch (Au(e), e.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return Xt(e), null;
      case 1:
        return Xt(e), null;
      case 3:
        return i = e.stateNode, l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Mn(Wt), ft(), i.pendingContext && (i.context = i.pendingContext, i.pendingContext = null), (t === null || t.child === null) && (Ta(e) ? Rn(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, zu())), Xt(e), null;
      case 26:
        var r = e.type, c = e.memoizedState;
        return t === null ? (Rn(e), c !== null ? (Xt(e), Dg(e, c)) : (Xt(e), xc(
          e,
          r,
          null,
          l,
          i
        ))) : c ? c !== t.memoizedState ? (Rn(e), Xt(e), Dg(e, c)) : (Xt(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== l && Rn(e), Xt(e), xc(
          e,
          r,
          t,
          l,
          i
        )), null;
      case 27:
        if (xt(e), i = ct.current, r = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== l && Rn(e);
        else {
          if (!l) {
            if (e.stateNode === null)
              throw Error(s(166));
            return Xt(e), null;
          }
          t = et.current, Ta(e) ? fh(e) : (t = qp(r, l, i), e.stateNode = t, Rn(e));
        }
        return Xt(e), null;
      case 5:
        if (xt(e), r = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== l && Rn(e);
        else {
          if (!l) {
            if (e.stateNode === null)
              throw Error(s(166));
            return Xt(e), null;
          }
          if (c = et.current, Ta(e))
            fh(e);
          else {
            var y = Qs(
              ct.current
            );
            switch (c) {
              case 1:
                c = y.createElementNS(
                  "http://www.w3.org/2000/svg",
                  r
                );
                break;
              case 2:
                c = y.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  r
                );
                break;
              default:
                switch (r) {
                  case "svg":
                    c = y.createElementNS(
                      "http://www.w3.org/2000/svg",
                      r
                    );
                    break;
                  case "math":
                    c = y.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      r
                    );
                    break;
                  case "script":
                    c = y.createElement("div"), c.innerHTML = "<script><\/script>", c = c.removeChild(
                      c.firstChild
                    );
                    break;
                  case "select":
                    c = typeof l.is == "string" ? y.createElement("select", {
                      is: l.is
                    }) : y.createElement("select"), l.multiple ? c.multiple = !0 : l.size && (c.size = l.size);
                    break;
                  default:
                    c = typeof l.is == "string" ? y.createElement(r, { is: l.is }) : y.createElement(r);
                }
            }
            c[ae] = e, c[ge] = l;
            t: for (y = e.child; y !== null; ) {
              if (y.tag === 5 || y.tag === 6)
                c.appendChild(y.stateNode);
              else if (y.tag !== 4 && y.tag !== 27 && y.child !== null) {
                y.child.return = y, y = y.child;
                continue;
              }
              if (y === e) break t;
              for (; y.sibling === null; ) {
                if (y.return === null || y.return === e)
                  break t;
                y = y.return;
              }
              y.sibling.return = y.return, y = y.sibling;
            }
            e.stateNode = c;
            t: switch (de(c, r, l), r) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                l = !!l.autoFocus;
                break t;
              case "img":
                l = !0;
                break t;
              default:
                l = !1;
            }
            l && Rn(e);
          }
        }
        return Xt(e), xc(
          e,
          e.type,
          t === null ? null : t.memoizedProps,
          e.pendingProps,
          i
        ), null;
      case 6:
        if (t && e.stateNode != null)
          t.memoizedProps !== l && Rn(e);
        else {
          if (typeof l != "string" && e.stateNode === null)
            throw Error(s(166));
          if (t = ct.current, Ta(e)) {
            if (t = e.stateNode, i = e.memoizedProps, l = null, r = ue, r !== null)
              switch (r.tag) {
                case 27:
                case 5:
                  l = r.memoizedProps;
              }
            t[ae] = e, t = !!(t.nodeValue === i || l !== null && l.suppressHydrationWarning === !0 || Ap(t.nodeValue, i)), t || ni(e, !0);
          } else
            t = Qs(t).createTextNode(
              l
            ), t[ae] = e, e.stateNode = t;
        }
        return Xt(e), null;
      case 31:
        if (i = e.memoizedState, t === null || t.memoizedState !== null) {
          if (l = Ta(e), i !== null) {
            if (t === null) {
              if (!l) throw Error(s(318));
              if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
              t[ae] = e;
            } else
              Vi(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Xt(e), t = !1;
          } else
            i = zu(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = i), t = !0;
          if (!t)
            return e.flags & 256 ? (He(e), e) : (He(e), null);
          if ((e.flags & 128) !== 0)
            throw Error(s(558));
        }
        return Xt(e), null;
      case 13:
        if (l = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (r = Ta(e), l !== null && l.dehydrated !== null) {
            if (t === null) {
              if (!r) throw Error(s(318));
              if (r = e.memoizedState, r = r !== null ? r.dehydrated : null, !r) throw Error(s(317));
              r[ae] = e;
            } else
              Vi(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Xt(e), r = !1;
          } else
            r = zu(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = r), r = !0;
          if (!r)
            return e.flags & 256 ? (He(e), e) : (He(e), null);
        }
        return He(e), (e.flags & 128) !== 0 ? (e.lanes = i, e) : (i = l !== null, t = t !== null && t.memoizedState !== null, i && (l = e.child, r = null, l.alternate !== null && l.alternate.memoizedState !== null && l.alternate.memoizedState.cachePool !== null && (r = l.alternate.memoizedState.cachePool.pool), c = null, l.memoizedState !== null && l.memoizedState.cachePool !== null && (c = l.memoizedState.cachePool.pool), c !== r && (l.flags |= 2048)), i !== t && i && (e.child.flags |= 8192), Ts(e, e.updateQueue), Xt(e), null);
      case 4:
        return ft(), t === null && Qc(e.stateNode.containerInfo), Xt(e), null;
      case 10:
        return Mn(e.type), Xt(e), null;
      case 19:
        if (j(Jt), l = e.memoizedState, l === null) return Xt(e), null;
        if (r = (e.flags & 128) !== 0, c = l.rendering, c === null)
          if (r) Bl(l, !1);
          else {
            if ($t !== 0 || t !== null && (t.flags & 128) !== 0)
              for (t = e.child; t !== null; ) {
                if (c = gs(t), c !== null) {
                  for (e.flags |= 128, Bl(l, !1), t = c.updateQueue, e.updateQueue = t, Ts(e, t), e.subtreeFlags = 0, t = i, i = e.child; i !== null; )
                    oh(i, t), i = i.sibling;
                  return P(
                    Jt,
                    Jt.current & 1 | 2
                  ), Mt && Tn(e, l.treeForkCount), e.child;
                }
                t = t.sibling;
              }
            l.tail !== null && re() > Ds && (e.flags |= 128, r = !0, Bl(l, !1), e.lanes = 4194304);
          }
        else {
          if (!r)
            if (t = gs(c), t !== null) {
              if (e.flags |= 128, r = !0, t = t.updateQueue, e.updateQueue = t, Ts(e, t), Bl(l, !0), l.tail === null && l.tailMode === "hidden" && !c.alternate && !Mt)
                return Xt(e), null;
            } else
              2 * re() - l.renderingStartTime > Ds && i !== 536870912 && (e.flags |= 128, r = !0, Bl(l, !1), e.lanes = 4194304);
          l.isBackwards ? (c.sibling = e.child, e.child = c) : (t = l.last, t !== null ? t.sibling = c : e.child = c, l.last = c);
        }
        return l.tail !== null ? (t = l.tail, l.rendering = t, l.tail = t.sibling, l.renderingStartTime = re(), t.sibling = null, i = Jt.current, P(
          Jt,
          r ? i & 1 | 2 : i & 1
        ), Mt && Tn(e, l.treeForkCount), t) : (Xt(e), null);
      case 22:
      case 23:
        return He(e), Xu(), l = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== l && (e.flags |= 8192) : l && (e.flags |= 8192), l ? (i & 536870912) !== 0 && (e.flags & 128) === 0 && (Xt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Xt(e), i = e.updateQueue, i !== null && Ts(e, i.retryQueue), i = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (i = t.memoizedState.cachePool.pool), l = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (l = e.memoizedState.cachePool.pool), l !== i && (e.flags |= 2048), t !== null && j(ki), null;
      case 24:
        return i = null, t !== null && (i = t.memoizedState.cache), e.memoizedState.cache !== i && (e.flags |= 2048), Mn(Wt), Xt(e), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(s(156, e.tag));
  }
  function P1(t, e) {
    switch (Au(e), e.tag) {
      case 1:
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 3:
        return Mn(Wt), ft(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
      case 26:
      case 27:
      case 5:
        return xt(e), null;
      case 31:
        if (e.memoizedState !== null) {
          if (He(e), e.alternate === null)
            throw Error(s(340));
          Vi();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 13:
        if (He(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
          if (e.alternate === null)
            throw Error(s(340));
          Vi();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 19:
        return j(Jt), null;
      case 4:
        return ft(), null;
      case 10:
        return Mn(e.type), null;
      case 22:
      case 23:
        return He(e), Xu(), t !== null && j(ki), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 24:
        return Mn(Wt), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function Rg(t, e) {
    switch (Au(e), e.tag) {
      case 3:
        Mn(Wt), ft();
        break;
      case 26:
      case 27:
      case 5:
        xt(e);
        break;
      case 4:
        ft();
        break;
      case 31:
        e.memoizedState !== null && He(e);
        break;
      case 13:
        He(e);
        break;
      case 19:
        j(Jt);
        break;
      case 10:
        Mn(e.type);
        break;
      case 22:
      case 23:
        He(e), Xu(), t !== null && j(ki);
        break;
      case 24:
        Mn(Wt);
    }
  }
  function Ll(t, e) {
    try {
      var i = e.updateQueue, l = i !== null ? i.lastEffect : null;
      if (l !== null) {
        var r = l.next;
        i = r;
        do {
          if ((i.tag & t) === t) {
            l = void 0;
            var c = i.create, y = i.inst;
            l = c(), y.destroy = l;
          }
          i = i.next;
        } while (i !== r);
      }
    } catch (x) {
      Ut(e, e.return, x);
    }
  }
  function ui(t, e, i) {
    try {
      var l = e.updateQueue, r = l !== null ? l.lastEffect : null;
      if (r !== null) {
        var c = r.next;
        l = c;
        do {
          if ((l.tag & t) === t) {
            var y = l.inst, x = y.destroy;
            if (x !== void 0) {
              y.destroy = void 0, r = e;
              var R = i, J = x;
              try {
                J();
              } catch (nt) {
                Ut(
                  r,
                  R,
                  nt
                );
              }
            }
          }
          l = l.next;
        } while (l !== c);
      }
    } catch (nt) {
      Ut(e, e.return, nt);
    }
  }
  function Hg(t) {
    var e = t.updateQueue;
    if (e !== null) {
      var i = t.stateNode;
      try {
        _h(e, i);
      } catch (l) {
        Ut(t, t.return, l);
      }
    }
  }
  function jg(t, e, i) {
    i.props = Ji(
      t.type,
      t.memoizedProps
    ), i.state = t.memoizedState;
    try {
      i.componentWillUnmount();
    } catch (l) {
      Ut(t, e, l);
    }
  }
  function ql(t, e) {
    try {
      var i = t.ref;
      if (i !== null) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            var l = t.stateNode;
            break;
          case 30:
            l = t.stateNode;
            break;
          default:
            l = t.stateNode;
        }
        typeof i == "function" ? t.refCleanup = i(l) : i.current = l;
      }
    } catch (r) {
      Ut(t, e, r);
    }
  }
  function fn(t, e) {
    var i = t.ref, l = t.refCleanup;
    if (i !== null)
      if (typeof l == "function")
        try {
          l();
        } catch (r) {
          Ut(t, e, r);
        } finally {
          t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
        }
      else if (typeof i == "function")
        try {
          i(null);
        } catch (r) {
          Ut(t, e, r);
        }
      else i.current = null;
  }
  function Ug(t) {
    var e = t.type, i = t.memoizedProps, l = t.stateNode;
    try {
      t: switch (e) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          i.autoFocus && l.focus();
          break t;
        case "img":
          i.src ? l.src = i.src : i.srcSet && (l.srcset = i.srcSet);
      }
    } catch (r) {
      Ut(t, t.return, r);
    }
  }
  function Sc(t, e, i) {
    try {
      var l = t.stateNode;
      Sb(l, t.type, i, e), l[ge] = e;
    } catch (r) {
      Ut(t, t.return, r);
    }
  }
  function Bg(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && yi(t.type) || t.tag === 4;
  }
  function wc(t) {
    t: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Bg(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.tag === 27 && yi(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function Ec(t, e, i) {
    var l = t.tag;
    if (l === 5 || l === 6)
      t = t.stateNode, e ? (i.nodeType === 9 ? i.body : i.nodeName === "HTML" ? i.ownerDocument.body : i).insertBefore(t, e) : (e = i.nodeType === 9 ? i.body : i.nodeName === "HTML" ? i.ownerDocument.body : i, e.appendChild(t), i = i._reactRootContainer, i != null || e.onclick !== null || (e.onclick = _n));
    else if (l !== 4 && (l === 27 && yi(t.type) && (i = t.stateNode, e = null), t = t.child, t !== null))
      for (Ec(t, e, i), t = t.sibling; t !== null; )
        Ec(t, e, i), t = t.sibling;
  }
  function As(t, e, i) {
    var l = t.tag;
    if (l === 5 || l === 6)
      t = t.stateNode, e ? i.insertBefore(t, e) : i.appendChild(t);
    else if (l !== 4 && (l === 27 && yi(t.type) && (i = t.stateNode), t = t.child, t !== null))
      for (As(t, e, i), t = t.sibling; t !== null; )
        As(t, e, i), t = t.sibling;
  }
  function Lg(t) {
    var e = t.stateNode, i = t.memoizedProps;
    try {
      for (var l = t.type, r = e.attributes; r.length; )
        e.removeAttributeNode(r[0]);
      de(e, l, i), e[ae] = t, e[ge] = i;
    } catch (c) {
      Ut(t, t.return, c);
    }
  }
  var Hn = !1, ee = !1, _c = !1, qg = typeof WeakSet == "function" ? WeakSet : Set, se = null;
  function tb(t, e) {
    if (t = t.containerInfo, Gc = Js, t = Id(t), mu(t)) {
      if ("selectionStart" in t)
        var i = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
      else
        t: {
          i = (i = t.ownerDocument) && i.defaultView || window;
          var l = i.getSelection && i.getSelection();
          if (l && l.rangeCount !== 0) {
            i = l.anchorNode;
            var r = l.anchorOffset, c = l.focusNode;
            l = l.focusOffset;
            try {
              i.nodeType, c.nodeType;
            } catch {
              i = null;
              break t;
            }
            var y = 0, x = -1, R = -1, J = 0, nt = 0, lt = t, I = null;
            e: for (; ; ) {
              for (var W; lt !== i || r !== 0 && lt.nodeType !== 3 || (x = y + r), lt !== c || l !== 0 && lt.nodeType !== 3 || (R = y + l), lt.nodeType === 3 && (y += lt.nodeValue.length), (W = lt.firstChild) !== null; )
                I = lt, lt = W;
              for (; ; ) {
                if (lt === t) break e;
                if (I === i && ++J === r && (x = y), I === c && ++nt === l && (R = y), (W = lt.nextSibling) !== null) break;
                lt = I, I = lt.parentNode;
              }
              lt = W;
            }
            i = x === -1 || R === -1 ? null : { start: x, end: R };
          } else i = null;
        }
      i = i || { start: 0, end: 0 };
    } else i = null;
    for (Zc = { focusedElem: t, selectionRange: i }, Js = !1, se = e; se !== null; )
      if (e = se, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
        t.return = e, se = t;
      else
        for (; se !== null; ) {
          switch (e = se, c = e.alternate, t = e.flags, e.tag) {
            case 0:
              if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                for (i = 0; i < t.length; i++)
                  r = t[i], r.ref.impl = r.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((t & 1024) !== 0 && c !== null) {
                t = void 0, i = e, r = c.memoizedProps, c = c.memoizedState, l = i.stateNode;
                try {
                  var dt = Ji(
                    i.type,
                    r
                  );
                  t = l.getSnapshotBeforeUpdate(
                    dt,
                    c
                  ), l.__reactInternalSnapshotBeforeUpdate = t;
                } catch (mt) {
                  Ut(
                    i,
                    i.return,
                    mt
                  );
                }
              }
              break;
            case 3:
              if ((t & 1024) !== 0) {
                if (t = e.stateNode.containerInfo, i = t.nodeType, i === 9)
                  Jc(t);
                else if (i === 1)
                  switch (t.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      Jc(t);
                      break;
                    default:
                      t.textContent = "";
                  }
              }
              break;
            case 5:
            case 26:
            case 27:
            case 6:
            case 4:
            case 17:
              break;
            default:
              if ((t & 1024) !== 0) throw Error(s(163));
          }
          if (t = e.sibling, t !== null) {
            t.return = e.return, se = t;
            break;
          }
          se = e.return;
        }
  }
  function Yg(t, e, i) {
    var l = i.flags;
    switch (i.tag) {
      case 0:
      case 11:
      case 15:
        Un(t, i), l & 4 && Ll(5, i);
        break;
      case 1:
        if (Un(t, i), l & 4)
          if (t = i.stateNode, e === null)
            try {
              t.componentDidMount();
            } catch (y) {
              Ut(i, i.return, y);
            }
          else {
            var r = Ji(
              i.type,
              e.memoizedProps
            );
            e = e.memoizedState;
            try {
              t.componentDidUpdate(
                r,
                e,
                t.__reactInternalSnapshotBeforeUpdate
              );
            } catch (y) {
              Ut(
                i,
                i.return,
                y
              );
            }
          }
        l & 64 && Hg(i), l & 512 && ql(i, i.return);
        break;
      case 3:
        if (Un(t, i), l & 64 && (t = i.updateQueue, t !== null)) {
          if (e = null, i.child !== null)
            switch (i.child.tag) {
              case 27:
              case 5:
                e = i.child.stateNode;
                break;
              case 1:
                e = i.child.stateNode;
            }
          try {
            _h(t, e);
          } catch (y) {
            Ut(i, i.return, y);
          }
        }
        break;
      case 27:
        e === null && l & 4 && Lg(i);
      case 26:
      case 5:
        Un(t, i), e === null && l & 4 && Ug(i), l & 512 && ql(i, i.return);
        break;
      case 12:
        Un(t, i);
        break;
      case 31:
        Un(t, i), l & 4 && Xg(t, i);
        break;
      case 13:
        Un(t, i), l & 4 && kg(t, i), l & 64 && (t = i.memoizedState, t !== null && (t = t.dehydrated, t !== null && (i = ub.bind(
          null,
          i
        ), Mb(t, i))));
        break;
      case 22:
        if (l = i.memoizedState !== null || Hn, !l) {
          e = e !== null && e.memoizedState !== null || ee, r = Hn;
          var c = ee;
          Hn = l, (ee = e) && !c ? Bn(
            t,
            i,
            (i.subtreeFlags & 8772) !== 0
          ) : Un(t, i), Hn = r, ee = c;
        }
        break;
      case 30:
        break;
      default:
        Un(t, i);
    }
  }
  function Vg(t) {
    var e = t.alternate;
    e !== null && (t.alternate = null, Vg(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && fl(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  var kt = null, Ee = !1;
  function jn(t, e, i) {
    for (i = i.child; i !== null; )
      Qg(t, e, i), i = i.sibling;
  }
  function Qg(t, e, i) {
    if (ye && typeof ye.onCommitFiberUnmount == "function")
      try {
        ye.onCommitFiberUnmount(zi, i);
      } catch {
      }
    switch (i.tag) {
      case 26:
        ee || fn(i, e), jn(
          t,
          e,
          i
        ), i.memoizedState ? i.memoizedState.count-- : i.stateNode && (i = i.stateNode, i.parentNode.removeChild(i));
        break;
      case 27:
        ee || fn(i, e);
        var l = kt, r = Ee;
        yi(i.type) && (kt = i.stateNode, Ee = !1), jn(
          t,
          e,
          i
        ), $l(i.stateNode), kt = l, Ee = r;
        break;
      case 5:
        ee || fn(i, e);
      case 6:
        if (l = kt, r = Ee, kt = null, jn(
          t,
          e,
          i
        ), kt = l, Ee = r, kt !== null)
          if (Ee)
            try {
              (kt.nodeType === 9 ? kt.body : kt.nodeName === "HTML" ? kt.ownerDocument.body : kt).removeChild(i.stateNode);
            } catch (c) {
              Ut(
                i,
                e,
                c
              );
            }
          else
            try {
              kt.removeChild(i.stateNode);
            } catch (c) {
              Ut(
                i,
                e,
                c
              );
            }
        break;
      case 18:
        kt !== null && (Ee ? (t = kt, Hp(
          t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t,
          i.stateNode
        ), $a(t)) : Hp(kt, i.stateNode));
        break;
      case 4:
        l = kt, r = Ee, kt = i.stateNode.containerInfo, Ee = !0, jn(
          t,
          e,
          i
        ), kt = l, Ee = r;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        ui(2, i, e), ee || ui(4, i, e), jn(
          t,
          e,
          i
        );
        break;
      case 1:
        ee || (fn(i, e), l = i.stateNode, typeof l.componentWillUnmount == "function" && jg(
          i,
          e,
          l
        )), jn(
          t,
          e,
          i
        );
        break;
      case 21:
        jn(
          t,
          e,
          i
        );
        break;
      case 22:
        ee = (l = ee) || i.memoizedState !== null, jn(
          t,
          e,
          i
        ), ee = l;
        break;
      default:
        jn(
          t,
          e,
          i
        );
    }
  }
  function Xg(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
      t = t.dehydrated;
      try {
        $a(t);
      } catch (i) {
        Ut(e, e.return, i);
      }
    }
  }
  function kg(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
      try {
        $a(t);
      } catch (i) {
        Ut(e, e.return, i);
      }
  }
  function eb(t) {
    switch (t.tag) {
      case 31:
      case 13:
      case 19:
        var e = t.stateNode;
        return e === null && (e = t.stateNode = new qg()), e;
      case 22:
        return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new qg()), e;
      default:
        throw Error(s(435, t.tag));
    }
  }
  function Ms(t, e) {
    var i = eb(t);
    e.forEach(function(l) {
      if (!i.has(l)) {
        i.add(l);
        var r = cb.bind(null, t, l);
        l.then(r, r);
      }
    });
  }
  function _e(t, e) {
    var i = e.deletions;
    if (i !== null)
      for (var l = 0; l < i.length; l++) {
        var r = i[l], c = t, y = e, x = y;
        t: for (; x !== null; ) {
          switch (x.tag) {
            case 27:
              if (yi(x.type)) {
                kt = x.stateNode, Ee = !1;
                break t;
              }
              break;
            case 5:
              kt = x.stateNode, Ee = !1;
              break t;
            case 3:
            case 4:
              kt = x.stateNode.containerInfo, Ee = !0;
              break t;
          }
          x = x.return;
        }
        if (kt === null) throw Error(s(160));
        Qg(c, y, r), kt = null, Ee = !1, c = r.alternate, c !== null && (c.return = null), r.return = null;
      }
    if (e.subtreeFlags & 13886)
      for (e = e.child; e !== null; )
        Gg(e, t), e = e.sibling;
  }
  var Pe = null;
  function Gg(t, e) {
    var i = t.alternate, l = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        _e(e, t), Ce(t), l & 4 && (ui(3, t, t.return), Ll(3, t), ui(5, t, t.return));
        break;
      case 1:
        _e(e, t), Ce(t), l & 512 && (ee || i === null || fn(i, i.return)), l & 64 && Hn && (t = t.updateQueue, t !== null && (l = t.callbacks, l !== null && (i = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = i === null ? l : i.concat(l))));
        break;
      case 26:
        var r = Pe;
        if (_e(e, t), Ce(t), l & 512 && (ee || i === null || fn(i, i.return)), l & 4) {
          var c = i !== null ? i.memoizedState : null;
          if (l = t.memoizedState, i === null)
            if (l === null)
              if (t.stateNode === null) {
                t: {
                  l = t.type, i = t.memoizedProps, r = r.ownerDocument || r;
                  e: switch (l) {
                    case "title":
                      c = r.getElementsByTagName("title")[0], (!c || c[Ri] || c[ae] || c.namespaceURI === "http://www.w3.org/2000/svg" || c.hasAttribute("itemprop")) && (c = r.createElement(l), r.head.insertBefore(
                        c,
                        r.querySelector("head > title")
                      )), de(c, l, i), c[ae] = t, It(c), l = c;
                      break t;
                    case "link":
                      var y = Gp(
                        "link",
                        "href",
                        r
                      ).get(l + (i.href || ""));
                      if (y) {
                        for (var x = 0; x < y.length; x++)
                          if (c = y[x], c.getAttribute("href") === (i.href == null || i.href === "" ? null : i.href) && c.getAttribute("rel") === (i.rel == null ? null : i.rel) && c.getAttribute("title") === (i.title == null ? null : i.title) && c.getAttribute("crossorigin") === (i.crossOrigin == null ? null : i.crossOrigin)) {
                            y.splice(x, 1);
                            break e;
                          }
                      }
                      c = r.createElement(l), de(c, l, i), r.head.appendChild(c);
                      break;
                    case "meta":
                      if (y = Gp(
                        "meta",
                        "content",
                        r
                      ).get(l + (i.content || ""))) {
                        for (x = 0; x < y.length; x++)
                          if (c = y[x], c.getAttribute("content") === (i.content == null ? null : "" + i.content) && c.getAttribute("name") === (i.name == null ? null : i.name) && c.getAttribute("property") === (i.property == null ? null : i.property) && c.getAttribute("http-equiv") === (i.httpEquiv == null ? null : i.httpEquiv) && c.getAttribute("charset") === (i.charSet == null ? null : i.charSet)) {
                            y.splice(x, 1);
                            break e;
                          }
                      }
                      c = r.createElement(l), de(c, l, i), r.head.appendChild(c);
                      break;
                    default:
                      throw Error(s(468, l));
                  }
                  c[ae] = t, It(c), l = c;
                }
                t.stateNode = l;
              } else
                Zp(
                  r,
                  t.type,
                  t.stateNode
                );
            else
              t.stateNode = kp(
                r,
                l,
                t.memoizedProps
              );
          else
            c !== l ? (c === null ? i.stateNode !== null && (i = i.stateNode, i.parentNode.removeChild(i)) : c.count--, l === null ? Zp(
              r,
              t.type,
              t.stateNode
            ) : kp(
              r,
              l,
              t.memoizedProps
            )) : l === null && t.stateNode !== null && Sc(
              t,
              t.memoizedProps,
              i.memoizedProps
            );
        }
        break;
      case 27:
        _e(e, t), Ce(t), l & 512 && (ee || i === null || fn(i, i.return)), i !== null && l & 4 && Sc(
          t,
          t.memoizedProps,
          i.memoizedProps
        );
        break;
      case 5:
        if (_e(e, t), Ce(t), l & 512 && (ee || i === null || fn(i, i.return)), t.flags & 32) {
          r = t.stateNode;
          try {
            ma(r, "");
          } catch (dt) {
            Ut(t, t.return, dt);
          }
        }
        l & 4 && t.stateNode != null && (r = t.memoizedProps, Sc(
          t,
          r,
          i !== null ? i.memoizedProps : r
        )), l & 1024 && (_c = !0);
        break;
      case 6:
        if (_e(e, t), Ce(t), l & 4) {
          if (t.stateNode === null)
            throw Error(s(162));
          l = t.memoizedProps, i = t.stateNode;
          try {
            i.nodeValue = l;
          } catch (dt) {
            Ut(t, t.return, dt);
          }
        }
        break;
      case 3:
        if (Gs = null, r = Pe, Pe = Xs(e.containerInfo), _e(e, t), Pe = r, Ce(t), l & 4 && i !== null && i.memoizedState.isDehydrated)
          try {
            $a(e.containerInfo);
          } catch (dt) {
            Ut(t, t.return, dt);
          }
        _c && (_c = !1, Zg(t));
        break;
      case 4:
        l = Pe, Pe = Xs(
          t.stateNode.containerInfo
        ), _e(e, t), Ce(t), Pe = l;
        break;
      case 12:
        _e(e, t), Ce(t);
        break;
      case 31:
        _e(e, t), Ce(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Ms(t, l)));
        break;
      case 13:
        _e(e, t), Ce(t), t.child.flags & 8192 && t.memoizedState !== null != (i !== null && i.memoizedState !== null) && (Os = re()), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Ms(t, l)));
        break;
      case 22:
        r = t.memoizedState !== null;
        var R = i !== null && i.memoizedState !== null, J = Hn, nt = ee;
        if (Hn = J || r, ee = nt || R, _e(e, t), ee = nt, Hn = J, Ce(t), l & 8192)
          t: for (e = t.stateNode, e._visibility = r ? e._visibility & -2 : e._visibility | 1, r && (i === null || R || Hn || ee || Fi(t)), i = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (i === null) {
                R = i = e;
                try {
                  if (c = R.stateNode, r)
                    y = c.style, typeof y.setProperty == "function" ? y.setProperty("display", "none", "important") : y.display = "none";
                  else {
                    x = R.stateNode;
                    var lt = R.memoizedProps.style, I = lt != null && lt.hasOwnProperty("display") ? lt.display : null;
                    x.style.display = I == null || typeof I == "boolean" ? "" : ("" + I).trim();
                  }
                } catch (dt) {
                  Ut(R, R.return, dt);
                }
              }
            } else if (e.tag === 6) {
              if (i === null) {
                R = e;
                try {
                  R.stateNode.nodeValue = r ? "" : R.memoizedProps;
                } catch (dt) {
                  Ut(R, R.return, dt);
                }
              }
            } else if (e.tag === 18) {
              if (i === null) {
                R = e;
                try {
                  var W = R.stateNode;
                  r ? jp(W, !0) : jp(R.stateNode, !1);
                } catch (dt) {
                  Ut(R, R.return, dt);
                }
              }
            } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break t;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) break t;
              i === e && (i = null), e = e.return;
            }
            i === e && (i = null), e.sibling.return = e.return, e = e.sibling;
          }
        l & 4 && (l = t.updateQueue, l !== null && (i = l.retryQueue, i !== null && (l.retryQueue = null, Ms(t, i))));
        break;
      case 19:
        _e(e, t), Ce(t), l & 4 && (l = t.updateQueue, l !== null && (t.updateQueue = null, Ms(t, l)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        _e(e, t), Ce(t);
    }
  }
  function Ce(t) {
    var e = t.flags;
    if (e & 2) {
      try {
        for (var i, l = t.return; l !== null; ) {
          if (Bg(l)) {
            i = l;
            break;
          }
          l = l.return;
        }
        if (i == null) throw Error(s(160));
        switch (i.tag) {
          case 27:
            var r = i.stateNode, c = wc(t);
            As(t, c, r);
            break;
          case 5:
            var y = i.stateNode;
            i.flags & 32 && (ma(y, ""), i.flags &= -33);
            var x = wc(t);
            As(t, x, y);
            break;
          case 3:
          case 4:
            var R = i.stateNode.containerInfo, J = wc(t);
            Ec(
              t,
              J,
              R
            );
            break;
          default:
            throw Error(s(161));
        }
      } catch (nt) {
        Ut(t, t.return, nt);
      }
      t.flags &= -3;
    }
    e & 4096 && (t.flags &= -4097);
  }
  function Zg(t) {
    if (t.subtreeFlags & 1024)
      for (t = t.child; t !== null; ) {
        var e = t;
        Zg(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
  }
  function Un(t, e) {
    if (e.subtreeFlags & 8772)
      for (e = e.child; e !== null; )
        Yg(t, e.alternate, e), e = e.sibling;
  }
  function Fi(t) {
    for (t = t.child; t !== null; ) {
      var e = t;
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          ui(4, e, e.return), Fi(e);
          break;
        case 1:
          fn(e, e.return);
          var i = e.stateNode;
          typeof i.componentWillUnmount == "function" && jg(
            e,
            e.return,
            i
          ), Fi(e);
          break;
        case 27:
          $l(e.stateNode);
        case 26:
        case 5:
          fn(e, e.return), Fi(e);
          break;
        case 22:
          e.memoizedState === null && Fi(e);
          break;
        case 30:
          Fi(e);
          break;
        default:
          Fi(e);
      }
      t = t.sibling;
    }
  }
  function Bn(t, e, i) {
    for (i = i && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
      var l = e.alternate, r = t, c = e, y = c.flags;
      switch (c.tag) {
        case 0:
        case 11:
        case 15:
          Bn(
            r,
            c,
            i
          ), Ll(4, c);
          break;
        case 1:
          if (Bn(
            r,
            c,
            i
          ), l = c, r = l.stateNode, typeof r.componentDidMount == "function")
            try {
              r.componentDidMount();
            } catch (J) {
              Ut(l, l.return, J);
            }
          if (l = c, r = l.updateQueue, r !== null) {
            var x = l.stateNode;
            try {
              var R = r.shared.hiddenCallbacks;
              if (R !== null)
                for (r.shared.hiddenCallbacks = null, r = 0; r < R.length; r++)
                  Eh(R[r], x);
            } catch (J) {
              Ut(l, l.return, J);
            }
          }
          i && y & 64 && Hg(c), ql(c, c.return);
          break;
        case 27:
          Lg(c);
        case 26:
        case 5:
          Bn(
            r,
            c,
            i
          ), i && l === null && y & 4 && Ug(c), ql(c, c.return);
          break;
        case 12:
          Bn(
            r,
            c,
            i
          );
          break;
        case 31:
          Bn(
            r,
            c,
            i
          ), i && y & 4 && Xg(r, c);
          break;
        case 13:
          Bn(
            r,
            c,
            i
          ), i && y & 4 && kg(r, c);
          break;
        case 22:
          c.memoizedState === null && Bn(
            r,
            c,
            i
          ), ql(c, c.return);
          break;
        case 30:
          break;
        default:
          Bn(
            r,
            c,
            i
          );
      }
      e = e.sibling;
    }
  }
  function Cc(t, e) {
    var i = null;
    t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (i = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== i && (t != null && t.refCount++, i != null && Cl(i));
  }
  function Nc(t, e) {
    t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Cl(t));
  }
  function tn(t, e, i, l) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        Kg(
          t,
          e,
          i,
          l
        ), e = e.sibling;
  }
  function Kg(t, e, i, l) {
    var r = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        tn(
          t,
          e,
          i,
          l
        ), r & 2048 && Ll(9, e);
        break;
      case 1:
        tn(
          t,
          e,
          i,
          l
        );
        break;
      case 3:
        tn(
          t,
          e,
          i,
          l
        ), r & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Cl(t)));
        break;
      case 12:
        if (r & 2048) {
          tn(
            t,
            e,
            i,
            l
          ), t = e.stateNode;
          try {
            var c = e.memoizedProps, y = c.id, x = c.onPostCommit;
            typeof x == "function" && x(
              y,
              e.alternate === null ? "mount" : "update",
              t.passiveEffectDuration,
              -0
            );
          } catch (R) {
            Ut(e, e.return, R);
          }
        } else
          tn(
            t,
            e,
            i,
            l
          );
        break;
      case 31:
        tn(
          t,
          e,
          i,
          l
        );
        break;
      case 13:
        tn(
          t,
          e,
          i,
          l
        );
        break;
      case 23:
        break;
      case 22:
        c = e.stateNode, y = e.alternate, e.memoizedState !== null ? c._visibility & 2 ? tn(
          t,
          e,
          i,
          l
        ) : Yl(t, e) : c._visibility & 2 ? tn(
          t,
          e,
          i,
          l
        ) : (c._visibility |= 2, Ba(
          t,
          e,
          i,
          l,
          (e.subtreeFlags & 10256) !== 0 || !1
        )), r & 2048 && Cc(y, e);
        break;
      case 24:
        tn(
          t,
          e,
          i,
          l
        ), r & 2048 && Nc(e.alternate, e);
        break;
      default:
        tn(
          t,
          e,
          i,
          l
        );
    }
  }
  function Ba(t, e, i, l, r) {
    for (r = r && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
      var c = t, y = e, x = i, R = l, J = y.flags;
      switch (y.tag) {
        case 0:
        case 11:
        case 15:
          Ba(
            c,
            y,
            x,
            R,
            r
          ), Ll(8, y);
          break;
        case 23:
          break;
        case 22:
          var nt = y.stateNode;
          y.memoizedState !== null ? nt._visibility & 2 ? Ba(
            c,
            y,
            x,
            R,
            r
          ) : Yl(
            c,
            y
          ) : (nt._visibility |= 2, Ba(
            c,
            y,
            x,
            R,
            r
          )), r && J & 2048 && Cc(
            y.alternate,
            y
          );
          break;
        case 24:
          Ba(
            c,
            y,
            x,
            R,
            r
          ), r && J & 2048 && Nc(y.alternate, y);
          break;
        default:
          Ba(
            c,
            y,
            x,
            R,
            r
          );
      }
      e = e.sibling;
    }
  }
  function Yl(t, e) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) {
        var i = t, l = e, r = l.flags;
        switch (l.tag) {
          case 22:
            Yl(i, l), r & 2048 && Cc(
              l.alternate,
              l
            );
            break;
          case 24:
            Yl(i, l), r & 2048 && Nc(l.alternate, l);
            break;
          default:
            Yl(i, l);
        }
        e = e.sibling;
      }
  }
  var Vl = 8192;
  function La(t, e, i) {
    if (t.subtreeFlags & Vl)
      for (t = t.child; t !== null; )
        $g(
          t,
          e,
          i
        ), t = t.sibling;
  }
  function $g(t, e, i) {
    switch (t.tag) {
      case 26:
        La(
          t,
          e,
          i
        ), t.flags & Vl && t.memoizedState !== null && Vb(
          i,
          Pe,
          t.memoizedState,
          t.memoizedProps
        );
        break;
      case 5:
        La(
          t,
          e,
          i
        );
        break;
      case 3:
      case 4:
        var l = Pe;
        Pe = Xs(t.stateNode.containerInfo), La(
          t,
          e,
          i
        ), Pe = l;
        break;
      case 22:
        t.memoizedState === null && (l = t.alternate, l !== null && l.memoizedState !== null ? (l = Vl, Vl = 16777216, La(
          t,
          e,
          i
        ), Vl = l) : La(
          t,
          e,
          i
        ));
        break;
      default:
        La(
          t,
          e,
          i
        );
    }
  }
  function Jg(t) {
    var e = t.alternate;
    if (e !== null && (t = e.child, t !== null)) {
      e.child = null;
      do
        e = t.sibling, t.sibling = null, t = e;
      while (t !== null);
    }
  }
  function Ql(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var i = 0; i < e.length; i++) {
          var l = e[i];
          se = l, Ig(
            l,
            t
          );
        }
      Jg(t);
    }
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; )
        Fg(t), t = t.sibling;
  }
  function Fg(t) {
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        Ql(t), t.flags & 2048 && ui(9, t, t.return);
        break;
      case 3:
        Ql(t);
        break;
      case 12:
        Ql(t);
        break;
      case 22:
        var e = t.stateNode;
        t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, zs(t)) : Ql(t);
        break;
      default:
        Ql(t);
    }
  }
  function zs(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var i = 0; i < e.length; i++) {
          var l = e[i];
          se = l, Ig(
            l,
            t
          );
        }
      Jg(t);
    }
    for (t = t.child; t !== null; ) {
      switch (e = t, e.tag) {
        case 0:
        case 11:
        case 15:
          ui(8, e, e.return), zs(e);
          break;
        case 22:
          i = e.stateNode, i._visibility & 2 && (i._visibility &= -3, zs(e));
          break;
        default:
          zs(e);
      }
      t = t.sibling;
    }
  }
  function Ig(t, e) {
    for (; se !== null; ) {
      var i = se;
      switch (i.tag) {
        case 0:
        case 11:
        case 15:
          ui(8, i, e);
          break;
        case 23:
        case 22:
          if (i.memoizedState !== null && i.memoizedState.cachePool !== null) {
            var l = i.memoizedState.cachePool.pool;
            l != null && l.refCount++;
          }
          break;
        case 24:
          Cl(i.memoizedState.cache);
      }
      if (l = i.child, l !== null) l.return = i, se = l;
      else
        t: for (i = t; se !== null; ) {
          l = se;
          var r = l.sibling, c = l.return;
          if (Vg(l), l === i) {
            se = null;
            break t;
          }
          if (r !== null) {
            r.return = c, se = r;
            break t;
          }
          se = c;
        }
    }
  }
  var nb = {
    getCacheForType: function(t) {
      var e = ce(Wt), i = e.data.get(t);
      return i === void 0 && (i = t(), e.data.set(t, i)), i;
    },
    cacheSignal: function() {
      return ce(Wt).controller.signal;
    }
  }, ib = typeof WeakMap == "function" ? WeakMap : Map, Rt = 0, Vt = null, _t = null, Tt = 0, jt = 0, je = null, ci = !1, qa = !1, Tc = !1, Ln = 0, $t = 0, fi = 0, Ii = 0, Ac = 0, Ue = 0, Ya = 0, Xl = null, Ne = null, Mc = !1, Os = 0, Wg = 0, Ds = 1 / 0, Rs = null, di = null, le = 0, hi = null, Va = null, qn = 0, zc = 0, Oc = null, Pg = null, kl = 0, Dc = null;
  function Be() {
    return (Rt & 2) !== 0 && Tt !== 0 ? Tt & -Tt : N.T !== null ? Lc() : Bo();
  }
  function tp() {
    if (Ue === 0)
      if ((Tt & 536870912) === 0 || Mt) {
        var t = ca;
        ca <<= 1, (ca & 3932160) === 0 && (ca = 262144), Ue = t;
      } else Ue = 536870912;
    return t = Re.current, t !== null && (t.flags |= 32), Ue;
  }
  function Te(t, e, i) {
    (t === Vt && (jt === 2 || jt === 9) || t.cancelPendingCommit !== null) && (Qa(t, 0), gi(
      t,
      Tt,
      Ue,
      !1
    )), Di(t, i), ((Rt & 2) === 0 || t !== Vt) && (t === Vt && ((Rt & 2) === 0 && (Ii |= i), $t === 4 && gi(
      t,
      Tt,
      Ue,
      !1
    )), dn(t));
  }
  function ep(t, e, i) {
    if ((Rt & 6) !== 0) throw Error(s(327));
    var l = !i && (e & 127) === 0 && (e & t.expiredLanes) === 0 || Oi(t, e), r = l ? ob(t, e) : Hc(t, e, !0), c = l;
    do {
      if (r === 0) {
        qa && !l && gi(t, e, 0, !1);
        break;
      } else {
        if (i = t.current.alternate, c && !ab(i)) {
          r = Hc(t, e, !1), c = !1;
          continue;
        }
        if (r === 2) {
          if (c = e, t.errorRecoveryDisabledLanes & c)
            var y = 0;
          else
            y = t.pendingLanes & -536870913, y = y !== 0 ? y : y & 536870912 ? 536870912 : 0;
          if (y !== 0) {
            e = y;
            t: {
              var x = t;
              r = Xl;
              var R = x.current.memoizedState.isDehydrated;
              if (R && (Qa(x, y).flags |= 256), y = Hc(
                x,
                y,
                !1
              ), y !== 2) {
                if (Tc && !R) {
                  x.errorRecoveryDisabledLanes |= c, Ii |= c, r = 4;
                  break t;
                }
                c = Ne, Ne = r, c !== null && (Ne === null ? Ne = c : Ne.push.apply(
                  Ne,
                  c
                ));
              }
              r = y;
            }
            if (c = !1, r !== 2) continue;
          }
        }
        if (r === 1) {
          Qa(t, 0), gi(t, e, 0, !0);
          break;
        }
        t: {
          switch (l = t, c = r, c) {
            case 0:
            case 1:
              throw Error(s(345));
            case 4:
              if ((e & 4194048) !== e) break;
            case 6:
              gi(
                l,
                e,
                Ue,
                !ci
              );
              break t;
            case 2:
              Ne = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(s(329));
          }
          if ((e & 62914560) === e && (r = Os + 300 - re(), 10 < r)) {
            if (gi(
              l,
              e,
              Ue,
              !ci
            ), da(l, 0, !0) !== 0) break t;
            qn = e, l.timeoutHandle = Dp(
              np.bind(
                null,
                l,
                i,
                Ne,
                Rs,
                Mc,
                e,
                Ue,
                Ii,
                Ya,
                ci,
                c,
                "Throttled",
                -0,
                0
              ),
              r
            );
            break t;
          }
          np(
            l,
            i,
            Ne,
            Rs,
            Mc,
            e,
            Ue,
            Ii,
            Ya,
            ci,
            c,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    dn(t);
  }
  function np(t, e, i, l, r, c, y, x, R, J, nt, lt, I, W) {
    if (t.timeoutHandle = -1, lt = e.subtreeFlags, lt & 8192 || (lt & 16785408) === 16785408) {
      lt = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: _n
      }, $g(
        e,
        c,
        lt
      );
      var dt = (c & 62914560) === c ? Os - re() : (c & 4194048) === c ? Wg - re() : 0;
      if (dt = Qb(
        lt,
        dt
      ), dt !== null) {
        qn = c, t.cancelPendingCommit = dt(
          cp.bind(
            null,
            t,
            e,
            c,
            i,
            l,
            r,
            y,
            x,
            R,
            nt,
            lt,
            null,
            I,
            W
          )
        ), gi(t, c, y, !J);
        return;
      }
    }
    cp(
      t,
      e,
      c,
      i,
      l,
      r,
      y,
      x,
      R
    );
  }
  function ab(t) {
    for (var e = t; ; ) {
      var i = e.tag;
      if ((i === 0 || i === 11 || i === 15) && e.flags & 16384 && (i = e.updateQueue, i !== null && (i = i.stores, i !== null)))
        for (var l = 0; l < i.length; l++) {
          var r = i[l], c = r.getSnapshot;
          r = r.value;
          try {
            if (!Oe(c(), r)) return !1;
          } catch {
            return !1;
          }
        }
      if (i = e.child, e.subtreeFlags & 16384 && i !== null)
        i.return = e, e = i;
      else {
        if (e === t) break;
        for (; e.sibling === null; ) {
          if (e.return === null || e.return === t) return !0;
          e = e.return;
        }
        e.sibling.return = e.return, e = e.sibling;
      }
    }
    return !0;
  }
  function gi(t, e, i, l) {
    e &= ~Ac, e &= ~Ii, t.suspendedLanes |= e, t.pingedLanes &= ~e, l && (t.warmLanes |= e), l = t.expirationTimes;
    for (var r = e; 0 < r; ) {
      var c = 31 - me(r), y = 1 << c;
      l[c] = -1, r &= ~y;
    }
    i !== 0 && Ho(t, i, e);
  }
  function Hs() {
    return (Rt & 6) === 0 ? (Gl(0), !1) : !0;
  }
  function Rc() {
    if (_t !== null) {
      if (jt === 0)
        var t = _t.return;
      else
        t = _t, An = Qi = null, Ju(t), Da = null, Tl = 0, t = _t;
      for (; t !== null; )
        Rg(t.alternate, t), t = t.return;
      _t = null;
    }
  }
  function Qa(t, e) {
    var i = t.timeoutHandle;
    i !== -1 && (t.timeoutHandle = -1, _b(i)), i = t.cancelPendingCommit, i !== null && (t.cancelPendingCommit = null, i()), qn = 0, Rc(), Vt = t, _t = i = Nn(t.current, null), Tt = e, jt = 0, je = null, ci = !1, qa = Oi(t, e), Tc = !1, Ya = Ue = Ac = Ii = fi = $t = 0, Ne = Xl = null, Mc = !1, (e & 8) !== 0 && (e |= e & 32);
    var l = t.entangledLanes;
    if (l !== 0)
      for (t = t.entanglements, l &= e; 0 < l; ) {
        var r = 31 - me(l), c = 1 << r;
        e |= t[r], l &= ~c;
      }
    return Ln = e, es(), i;
  }
  function ip(t, e) {
    St = null, N.H = jl, e === Oa || e === us ? (e = bh(), jt = 3) : e === Bu ? (e = bh(), jt = 4) : jt = e === fc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, je = e, _t === null && ($t = 1, Es(
      t,
      Ve(e, t.current)
    ));
  }
  function ap() {
    var t = Re.current;
    return t === null ? !0 : (Tt & 4194048) === Tt ? Ge === null : (Tt & 62914560) === Tt || (Tt & 536870912) !== 0 ? t === Ge : !1;
  }
  function lp() {
    var t = N.H;
    return N.H = jl, t === null ? jl : t;
  }
  function op() {
    var t = N.A;
    return N.A = nb, t;
  }
  function js() {
    $t = 4, ci || (Tt & 4194048) !== Tt && Re.current !== null || (qa = !0), (fi & 134217727) === 0 && (Ii & 134217727) === 0 || Vt === null || gi(
      Vt,
      Tt,
      Ue,
      !1
    );
  }
  function Hc(t, e, i) {
    var l = Rt;
    Rt |= 2;
    var r = lp(), c = op();
    (Vt !== t || Tt !== e) && (Rs = null, Qa(t, e)), e = !1;
    var y = $t;
    t: do
      try {
        if (jt !== 0 && _t !== null) {
          var x = _t, R = je;
          switch (jt) {
            case 8:
              Rc(), y = 6;
              break t;
            case 3:
            case 2:
            case 9:
            case 6:
              Re.current === null && (e = !0);
              var J = jt;
              if (jt = 0, je = null, Xa(t, x, R, J), i && qa) {
                y = 0;
                break t;
              }
              break;
            default:
              J = jt, jt = 0, je = null, Xa(t, x, R, J);
          }
        }
        lb(), y = $t;
        break;
      } catch (nt) {
        ip(t, nt);
      }
    while (!0);
    return e && t.shellSuspendCounter++, An = Qi = null, Rt = l, N.H = r, N.A = c, _t === null && (Vt = null, Tt = 0, es()), y;
  }
  function lb() {
    for (; _t !== null; ) sp(_t);
  }
  function ob(t, e) {
    var i = Rt;
    Rt |= 2;
    var l = lp(), r = op();
    Vt !== t || Tt !== e ? (Rs = null, Ds = re() + 500, Qa(t, e)) : qa = Oi(
      t,
      e
    );
    t: do
      try {
        if (jt !== 0 && _t !== null) {
          e = _t;
          var c = je;
          e: switch (jt) {
            case 1:
              jt = 0, je = null, Xa(t, e, c, 1);
              break;
            case 2:
            case 9:
              if (mh(c)) {
                jt = 0, je = null, rp(e);
                break;
              }
              e = function() {
                jt !== 2 && jt !== 9 || Vt !== t || (jt = 7), dn(t);
              }, c.then(e, e);
              break t;
            case 3:
              jt = 7;
              break t;
            case 4:
              jt = 5;
              break t;
            case 7:
              mh(c) ? (jt = 0, je = null, rp(e)) : (jt = 0, je = null, Xa(t, e, c, 7));
              break;
            case 5:
              var y = null;
              switch (_t.tag) {
                case 26:
                  y = _t.memoizedState;
                case 5:
                case 27:
                  var x = _t;
                  if (y ? Kp(y) : x.stateNode.complete) {
                    jt = 0, je = null;
                    var R = x.sibling;
                    if (R !== null) _t = R;
                    else {
                      var J = x.return;
                      J !== null ? (_t = J, Us(J)) : _t = null;
                    }
                    break e;
                  }
              }
              jt = 0, je = null, Xa(t, e, c, 5);
              break;
            case 6:
              jt = 0, je = null, Xa(t, e, c, 6);
              break;
            case 8:
              Rc(), $t = 6;
              break t;
            default:
              throw Error(s(462));
          }
        }
        sb();
        break;
      } catch (nt) {
        ip(t, nt);
      }
    while (!0);
    return An = Qi = null, N.H = l, N.A = r, Rt = i, _t !== null ? 0 : (Vt = null, Tt = 0, es(), $t);
  }
  function sb() {
    for (; _t !== null && !Ti(); )
      sp(_t);
  }
  function sp(t) {
    var e = Og(t.alternate, t, Ln);
    t.memoizedProps = t.pendingProps, e === null ? Us(t) : _t = e;
  }
  function rp(t) {
    var e = t, i = e.alternate;
    switch (e.tag) {
      case 15:
      case 0:
        e = Cg(
          i,
          e,
          e.pendingProps,
          e.type,
          void 0,
          Tt
        );
        break;
      case 11:
        e = Cg(
          i,
          e,
          e.pendingProps,
          e.type.render,
          e.ref,
          Tt
        );
        break;
      case 5:
        Ju(e);
      default:
        Rg(i, e), e = _t = oh(e, Ln), e = Og(i, e, Ln);
    }
    t.memoizedProps = t.pendingProps, e === null ? Us(t) : _t = e;
  }
  function Xa(t, e, i, l) {
    An = Qi = null, Ju(e), Da = null, Tl = 0;
    var r = e.return;
    try {
      if (J1(
        t,
        r,
        e,
        i,
        Tt
      )) {
        $t = 1, Es(
          t,
          Ve(i, t.current)
        ), _t = null;
        return;
      }
    } catch (c) {
      if (r !== null) throw _t = r, c;
      $t = 1, Es(
        t,
        Ve(i, t.current)
      ), _t = null;
      return;
    }
    e.flags & 32768 ? (Mt || l === 1 ? t = !0 : qa || (Tt & 536870912) !== 0 ? t = !1 : (ci = t = !0, (l === 2 || l === 9 || l === 3 || l === 6) && (l = Re.current, l !== null && l.tag === 13 && (l.flags |= 16384))), up(e, t)) : Us(e);
  }
  function Us(t) {
    var e = t;
    do {
      if ((e.flags & 32768) !== 0) {
        up(
          e,
          ci
        );
        return;
      }
      t = e.return;
      var i = W1(
        e.alternate,
        e,
        Ln
      );
      if (i !== null) {
        _t = i;
        return;
      }
      if (e = e.sibling, e !== null) {
        _t = e;
        return;
      }
      _t = e = t;
    } while (e !== null);
    $t === 0 && ($t = 5);
  }
  function up(t, e) {
    do {
      var i = P1(t.alternate, t);
      if (i !== null) {
        i.flags &= 32767, _t = i;
        return;
      }
      if (i = t.return, i !== null && (i.flags |= 32768, i.subtreeFlags = 0, i.deletions = null), !e && (t = t.sibling, t !== null)) {
        _t = t;
        return;
      }
      _t = t = i;
    } while (t !== null);
    $t = 6, _t = null;
  }
  function cp(t, e, i, l, r, c, y, x, R) {
    t.cancelPendingCommit = null;
    do
      Bs();
    while (le !== 0);
    if ((Rt & 6) !== 0) throw Error(s(327));
    if (e !== null) {
      if (e === t.current) throw Error(s(177));
      if (c = e.lanes | e.childLanes, c |= wu, Wr(
        t,
        i,
        c,
        y,
        x,
        R
      ), t === Vt && (_t = Vt = null, Tt = 0), Va = e, hi = t, qn = i, zc = c, Oc = r, Pg = l, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, fb(Mi, function() {
        return pp(), null;
      })) : (t.callbackNode = null, t.callbackPriority = 0), l = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || l) {
        l = N.T, N.T = null, r = H.p, H.p = 2, y = Rt, Rt |= 4;
        try {
          tb(t, e, i);
        } finally {
          Rt = y, H.p = r, N.T = l;
        }
      }
      le = 1, fp(), dp(), hp();
    }
  }
  function fp() {
    if (le === 1) {
      le = 0;
      var t = hi, e = Va, i = (e.flags & 13878) !== 0;
      if ((e.subtreeFlags & 13878) !== 0 || i) {
        i = N.T, N.T = null;
        var l = H.p;
        H.p = 2;
        var r = Rt;
        Rt |= 4;
        try {
          Gg(e, t);
          var c = Zc, y = Id(t.containerInfo), x = c.focusedElem, R = c.selectionRange;
          if (y !== x && x && x.ownerDocument && Fd(
            x.ownerDocument.documentElement,
            x
          )) {
            if (R !== null && mu(x)) {
              var J = R.start, nt = R.end;
              if (nt === void 0 && (nt = J), "selectionStart" in x)
                x.selectionStart = J, x.selectionEnd = Math.min(
                  nt,
                  x.value.length
                );
              else {
                var lt = x.ownerDocument || document, I = lt && lt.defaultView || window;
                if (I.getSelection) {
                  var W = I.getSelection(), dt = x.textContent.length, mt = Math.min(R.start, dt), Yt = R.end === void 0 ? mt : Math.min(R.end, dt);
                  !W.extend && mt > Yt && (y = Yt, Yt = mt, mt = y);
                  var V = Jd(
                    x,
                    mt
                  ), L = Jd(
                    x,
                    Yt
                  );
                  if (V && L && (W.rangeCount !== 1 || W.anchorNode !== V.node || W.anchorOffset !== V.offset || W.focusNode !== L.node || W.focusOffset !== L.offset)) {
                    var $ = lt.createRange();
                    $.setStart(V.node, V.offset), W.removeAllRanges(), mt > Yt ? (W.addRange($), W.extend(L.node, L.offset)) : ($.setEnd(L.node, L.offset), W.addRange($));
                  }
                }
              }
            }
            for (lt = [], W = x; W = W.parentNode; )
              W.nodeType === 1 && lt.push({
                element: W,
                left: W.scrollLeft,
                top: W.scrollTop
              });
            for (typeof x.focus == "function" && x.focus(), x = 0; x < lt.length; x++) {
              var at = lt[x];
              at.element.scrollLeft = at.left, at.element.scrollTop = at.top;
            }
          }
          Js = !!Gc, Zc = Gc = null;
        } finally {
          Rt = r, H.p = l, N.T = i;
        }
      }
      t.current = e, le = 2;
    }
  }
  function dp() {
    if (le === 2) {
      le = 0;
      var t = hi, e = Va, i = (e.flags & 8772) !== 0;
      if ((e.subtreeFlags & 8772) !== 0 || i) {
        i = N.T, N.T = null;
        var l = H.p;
        H.p = 2;
        var r = Rt;
        Rt |= 4;
        try {
          Yg(t, e.alternate, e);
        } finally {
          Rt = r, H.p = l, N.T = i;
        }
      }
      le = 3;
    }
  }
  function hp() {
    if (le === 4 || le === 3) {
      le = 0, Ai();
      var t = hi, e = Va, i = qn, l = Pg;
      (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? le = 5 : (le = 0, Va = hi = null, gp(t, t.pendingLanes));
      var r = t.pendingLanes;
      if (r === 0 && (di = null), cl(i), e = e.stateNode, ye && typeof ye.onCommitFiberRoot == "function")
        try {
          ye.onCommitFiberRoot(
            zi,
            e,
            void 0,
            (e.current.flags & 128) === 128
          );
        } catch {
        }
      if (l !== null) {
        e = N.T, r = H.p, H.p = 2, N.T = null;
        try {
          for (var c = t.onRecoverableError, y = 0; y < l.length; y++) {
            var x = l[y];
            c(x.value, {
              componentStack: x.stack
            });
          }
        } finally {
          N.T = e, H.p = r;
        }
      }
      (qn & 3) !== 0 && Bs(), dn(t), r = t.pendingLanes, (i & 261930) !== 0 && (r & 42) !== 0 ? t === Dc ? kl++ : (kl = 0, Dc = t) : kl = 0, Gl(0);
    }
  }
  function gp(t, e) {
    (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Cl(e)));
  }
  function Bs() {
    return fp(), dp(), hp(), pp();
  }
  function pp() {
    if (le !== 5) return !1;
    var t = hi, e = zc;
    zc = 0;
    var i = cl(qn), l = N.T, r = H.p;
    try {
      H.p = 32 > i ? 32 : i, N.T = null, i = Oc, Oc = null;
      var c = hi, y = qn;
      if (le = 0, Va = hi = null, qn = 0, (Rt & 6) !== 0) throw Error(s(331));
      var x = Rt;
      if (Rt |= 4, Fg(c.current), Kg(
        c,
        c.current,
        y,
        i
      ), Rt = x, Gl(0, !1), ye && typeof ye.onPostCommitFiberRoot == "function")
        try {
          ye.onPostCommitFiberRoot(zi, c);
        } catch {
        }
      return !0;
    } finally {
      H.p = r, N.T = l, gp(t, e);
    }
  }
  function yp(t, e, i) {
    e = Ve(i, e), e = cc(t.stateNode, e, 2), t = oi(t, e, 2), t !== null && (Di(t, 2), dn(t));
  }
  function Ut(t, e, i) {
    if (t.tag === 3)
      yp(t, t, i);
    else
      for (; e !== null; ) {
        if (e.tag === 3) {
          yp(
            e,
            t,
            i
          );
          break;
        } else if (e.tag === 1) {
          var l = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof l.componentDidCatch == "function" && (di === null || !di.has(l))) {
            t = Ve(i, t), i = mg(2), l = oi(e, i, 2), l !== null && (vg(
              i,
              l,
              e,
              t
            ), Di(l, 2), dn(l));
            break;
          }
        }
        e = e.return;
      }
  }
  function jc(t, e, i) {
    var l = t.pingCache;
    if (l === null) {
      l = t.pingCache = new ib();
      var r = /* @__PURE__ */ new Set();
      l.set(e, r);
    } else
      r = l.get(e), r === void 0 && (r = /* @__PURE__ */ new Set(), l.set(e, r));
    r.has(i) || (Tc = !0, r.add(i), t = rb.bind(null, t, e, i), e.then(t, t));
  }
  function rb(t, e, i) {
    var l = t.pingCache;
    l !== null && l.delete(e), t.pingedLanes |= t.suspendedLanes & i, t.warmLanes &= ~i, Vt === t && (Tt & i) === i && ($t === 4 || $t === 3 && (Tt & 62914560) === Tt && 300 > re() - Os ? (Rt & 2) === 0 && Qa(t, 0) : Ac |= i, Ya === Tt && (Ya = 0)), dn(t);
  }
  function mp(t, e) {
    e === 0 && (e = Ro()), t = qi(t, e), t !== null && (Di(t, e), dn(t));
  }
  function ub(t) {
    var e = t.memoizedState, i = 0;
    e !== null && (i = e.retryLane), mp(t, i);
  }
  function cb(t, e) {
    var i = 0;
    switch (t.tag) {
      case 31:
      case 13:
        var l = t.stateNode, r = t.memoizedState;
        r !== null && (i = r.retryLane);
        break;
      case 19:
        l = t.stateNode;
        break;
      case 22:
        l = t.stateNode._retryCache;
        break;
      default:
        throw Error(s(314));
    }
    l !== null && l.delete(e), mp(t, i);
  }
  function fb(t, e) {
    return Fe(t, e);
  }
  var Ls = null, ka = null, Uc = !1, qs = !1, Bc = !1, pi = 0;
  function dn(t) {
    t !== ka && t.next === null && (ka === null ? Ls = ka = t : ka = ka.next = t), qs = !0, Uc || (Uc = !0, hb());
  }
  function Gl(t, e) {
    if (!Bc && qs) {
      Bc = !0;
      do
        for (var i = !1, l = Ls; l !== null; ) {
          if (t !== 0) {
            var r = l.pendingLanes;
            if (r === 0) var c = 0;
            else {
              var y = l.suspendedLanes, x = l.pingedLanes;
              c = (1 << 31 - me(42 | t) + 1) - 1, c &= r & ~(y & ~x), c = c & 201326741 ? c & 201326741 | 1 : c ? c | 2 : 0;
            }
            c !== 0 && (i = !0, Sp(l, c));
          } else
            c = Tt, c = da(
              l,
              l === Vt ? c : 0,
              l.cancelPendingCommit !== null || l.timeoutHandle !== -1
            ), (c & 3) === 0 || Oi(l, c) || (i = !0, Sp(l, c));
          l = l.next;
        }
      while (i);
      Bc = !1;
    }
  }
  function db() {
    vp();
  }
  function vp() {
    qs = Uc = !1;
    var t = 0;
    pi !== 0 && Eb() && (t = pi);
    for (var e = re(), i = null, l = Ls; l !== null; ) {
      var r = l.next, c = bp(l, e);
      c === 0 ? (l.next = null, i === null ? Ls = r : i.next = r, r === null && (ka = i)) : (i = l, (t !== 0 || (c & 3) !== 0) && (qs = !0)), l = r;
    }
    le !== 0 && le !== 5 || Gl(t), pi !== 0 && (pi = 0);
  }
  function bp(t, e) {
    for (var i = t.suspendedLanes, l = t.pingedLanes, r = t.expirationTimes, c = t.pendingLanes & -62914561; 0 < c; ) {
      var y = 31 - me(c), x = 1 << y, R = r[y];
      R === -1 ? ((x & i) === 0 || (x & l) !== 0) && (r[y] = Ir(x, e)) : R <= e && (t.expiredLanes |= x), c &= ~x;
    }
    if (e = Vt, i = Tt, i = da(
      t,
      t === e ? i : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), l = t.callbackNode, i === 0 || t === e && (jt === 2 || jt === 9) || t.cancelPendingCommit !== null)
      return l !== null && l !== null && vn(l), t.callbackNode = null, t.callbackPriority = 0;
    if ((i & 3) === 0 || Oi(t, i)) {
      if (e = i & -i, e === t.callbackPriority) return e;
      switch (l !== null && vn(l), cl(i)) {
        case 2:
        case 8:
          i = Kn;
          break;
        case 32:
          i = Mi;
          break;
        case 268435456:
          i = ra;
          break;
        default:
          i = Mi;
      }
      return l = xp.bind(null, t), i = Fe(i, l), t.callbackPriority = e, t.callbackNode = i, e;
    }
    return l !== null && l !== null && vn(l), t.callbackPriority = 2, t.callbackNode = null, 2;
  }
  function xp(t, e) {
    if (le !== 0 && le !== 5)
      return t.callbackNode = null, t.callbackPriority = 0, null;
    var i = t.callbackNode;
    if (Bs() && t.callbackNode !== i)
      return null;
    var l = Tt;
    return l = da(
      t,
      t === Vt ? l : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), l === 0 ? null : (ep(t, l, e), bp(t, re()), t.callbackNode != null && t.callbackNode === i ? xp.bind(null, t) : null);
  }
  function Sp(t, e) {
    if (Bs()) return null;
    ep(t, e, !0);
  }
  function hb() {
    Cb(function() {
      (Rt & 6) !== 0 ? Fe(
        bn,
        db
      ) : vp();
    });
  }
  function Lc() {
    if (pi === 0) {
      var t = Ma;
      t === 0 && (t = ua, ua <<= 1, (ua & 261888) === 0 && (ua = 256)), pi = t;
    }
    return pi;
  }
  function wp(t) {
    return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : Ko("" + t);
  }
  function Ep(t, e) {
    var i = e.ownerDocument.createElement("input");
    return i.name = e.name, i.value = e.value, t.id && i.setAttribute("form", t.id), e.parentNode.insertBefore(i, e), t = new FormData(t), i.parentNode.removeChild(i), t;
  }
  function gb(t, e, i, l, r) {
    if (e === "submit" && i && i.stateNode === r) {
      var c = wp(
        (r[ge] || null).action
      ), y = l.submitter;
      y && (e = (e = y[ge] || null) ? wp(e.formAction) : y.getAttribute("formAction"), e !== null && (c = e, y = null));
      var x = new Io(
        "action",
        "action",
        null,
        l,
        r
      );
      t.push({
        event: x,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (l.defaultPrevented) {
                if (pi !== 0) {
                  var R = y ? Ep(r, y) : new FormData(r);
                  ac(
                    i,
                    {
                      pending: !0,
                      data: R,
                      method: r.method,
                      action: c
                    },
                    null,
                    R
                  );
                }
              } else
                typeof c == "function" && (x.preventDefault(), R = y ? Ep(r, y) : new FormData(r), ac(
                  i,
                  {
                    pending: !0,
                    data: R,
                    method: r.method,
                    action: c
                  },
                  c,
                  R
                ));
            },
            currentTarget: r
          }
        ]
      });
    }
  }
  for (var qc = 0; qc < Su.length; qc++) {
    var Yc = Su[qc], pb = Yc.toLowerCase(), yb = Yc[0].toUpperCase() + Yc.slice(1);
    We(
      pb,
      "on" + yb
    );
  }
  We(th, "onAnimationEnd"), We(eh, "onAnimationIteration"), We(nh, "onAnimationStart"), We("dblclick", "onDoubleClick"), We("focusin", "onFocus"), We("focusout", "onBlur"), We(D1, "onTransitionRun"), We(R1, "onTransitionStart"), We(H1, "onTransitionCancel"), We(ih, "onTransitionEnd"), Wn("onMouseEnter", ["mouseout", "mouseover"]), Wn("onMouseLeave", ["mouseout", "mouseover"]), Wn("onPointerEnter", ["pointerout", "pointerover"]), Wn("onPointerLeave", ["pointerout", "pointerover"]), wn(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), wn(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), wn("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), wn(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), wn(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), wn(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var Zl = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), mb = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Zl)
  );
  function _p(t, e) {
    e = (e & 4) !== 0;
    for (var i = 0; i < t.length; i++) {
      var l = t[i], r = l.event;
      l = l.listeners;
      t: {
        var c = void 0;
        if (e)
          for (var y = l.length - 1; 0 <= y; y--) {
            var x = l[y], R = x.instance, J = x.currentTarget;
            if (x = x.listener, R !== c && r.isPropagationStopped())
              break t;
            c = x, r.currentTarget = J;
            try {
              c(r);
            } catch (nt) {
              ts(nt);
            }
            r.currentTarget = null, c = R;
          }
        else
          for (y = 0; y < l.length; y++) {
            if (x = l[y], R = x.instance, J = x.currentTarget, x = x.listener, R !== c && r.isPropagationStopped())
              break t;
            c = x, r.currentTarget = J;
            try {
              c(r);
            } catch (nt) {
              ts(nt);
            }
            r.currentTarget = null, c = R;
          }
      }
    }
  }
  function Ct(t, e) {
    var i = e[ha];
    i === void 0 && (i = e[ha] = /* @__PURE__ */ new Set());
    var l = t + "__bubble";
    i.has(l) || (Cp(e, t, 2, !1), i.add(l));
  }
  function Vc(t, e, i) {
    var l = 0;
    e && (l |= 4), Cp(
      i,
      t,
      l,
      e
    );
  }
  var Ys = "_reactListening" + Math.random().toString(36).slice(2);
  function Qc(t) {
    if (!t[Ys]) {
      t[Ys] = !0, Vo.forEach(function(i) {
        i !== "selectionchange" && (mb.has(i) || Vc(i, !1, t), Vc(i, !0, t));
      });
      var e = t.nodeType === 9 ? t : t.ownerDocument;
      e === null || e[Ys] || (e[Ys] = !0, Vc("selectionchange", !1, e));
    }
  }
  function Cp(t, e, i, l) {
    switch (ty(e)) {
      case 2:
        var r = Gb;
        break;
      case 8:
        r = Zb;
        break;
      default:
        r = af;
    }
    i = r.bind(
      null,
      e,
      i,
      t
    ), r = void 0, !ru || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (r = !0), l ? r !== void 0 ? t.addEventListener(e, i, {
      capture: !0,
      passive: r
    }) : t.addEventListener(e, i, !0) : r !== void 0 ? t.addEventListener(e, i, {
      passive: r
    }) : t.addEventListener(e, i, !1);
  }
  function Xc(t, e, i, l, r) {
    var c = l;
    if ((e & 1) === 0 && (e & 2) === 0 && l !== null)
      t: for (; ; ) {
        if (l === null) return;
        var y = l.tag;
        if (y === 3 || y === 4) {
          var x = l.stateNode.containerInfo;
          if (x === r) break;
          if (y === 4)
            for (y = l.return; y !== null; ) {
              var R = y.tag;
              if ((R === 3 || R === 4) && y.stateNode.containerInfo === r)
                return;
              y = y.return;
            }
          for (; x !== null; ) {
            if (y = $n(x), y === null) return;
            if (R = y.tag, R === 5 || R === 6 || R === 26 || R === 27) {
              l = c = y;
              continue t;
            }
            x = x.parentNode;
          }
        }
        l = l.return;
      }
    zd(function() {
      var J = c, nt = ou(i), lt = [];
      t: {
        var I = ah.get(t);
        if (I !== void 0) {
          var W = Io, dt = t;
          switch (t) {
            case "keypress":
              if (Jo(i) === 0) break t;
            case "keydown":
            case "keyup":
              W = c1;
              break;
            case "focusin":
              dt = "focus", W = du;
              break;
            case "focusout":
              dt = "blur", W = du;
              break;
            case "beforeblur":
            case "afterblur":
              W = du;
              break;
            case "click":
              if (i.button === 2) break t;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              W = Rd;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              W = Wv;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              W = h1;
              break;
            case th:
            case eh:
            case nh:
              W = e1;
              break;
            case ih:
              W = p1;
              break;
            case "scroll":
            case "scrollend":
              W = Fv;
              break;
            case "wheel":
              W = m1;
              break;
            case "copy":
            case "cut":
            case "paste":
              W = i1;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              W = jd;
              break;
            case "toggle":
            case "beforetoggle":
              W = b1;
          }
          var mt = (e & 4) !== 0, Yt = !mt && (t === "scroll" || t === "scrollend"), V = mt ? I !== null ? I + "Capture" : null : I;
          mt = [];
          for (var L = J, $; L !== null; ) {
            var at = L;
            if ($ = at.stateNode, at = at.tag, at !== 5 && at !== 26 && at !== 27 || $ === null || V === null || (at = gl(L, V), at != null && mt.push(
              Kl(L, at, $)
            )), Yt) break;
            L = L.return;
          }
          0 < mt.length && (I = new W(
            I,
            dt,
            null,
            i,
            nt
          ), lt.push({ event: I, listeners: mt }));
        }
      }
      if ((e & 7) === 0) {
        t: {
          if (I = t === "mouseover" || t === "pointerover", W = t === "mouseout" || t === "pointerout", I && i !== lu && (dt = i.relatedTarget || i.fromElement) && ($n(dt) || dt[Sn]))
            break t;
          if ((W || I) && (I = nt.window === nt ? nt : (I = nt.ownerDocument) ? I.defaultView || I.parentWindow : window, W ? (dt = i.relatedTarget || i.toElement, W = J, dt = dt ? $n(dt) : null, dt !== null && (Yt = f(dt), mt = dt.tag, dt !== Yt || mt !== 5 && mt !== 27 && mt !== 6) && (dt = null)) : (W = null, dt = J), W !== dt)) {
            if (mt = Rd, at = "onMouseLeave", V = "onMouseEnter", L = "mouse", (t === "pointerout" || t === "pointerover") && (mt = jd, at = "onPointerLeave", V = "onPointerEnter", L = "pointer"), Yt = W == null ? I : Fn(W), $ = dt == null ? I : Fn(dt), I = new mt(
              at,
              L + "leave",
              W,
              i,
              nt
            ), I.target = Yt, I.relatedTarget = $, at = null, $n(nt) === J && (mt = new mt(
              V,
              L + "enter",
              dt,
              i,
              nt
            ), mt.target = $, mt.relatedTarget = Yt, at = mt), Yt = at, W && dt)
              e: {
                for (mt = vb, V = W, L = dt, $ = 0, at = V; at; at = mt(at))
                  $++;
                at = 0;
                for (var gt = L; gt; gt = mt(gt))
                  at++;
                for (; 0 < $ - at; )
                  V = mt(V), $--;
                for (; 0 < at - $; )
                  L = mt(L), at--;
                for (; $--; ) {
                  if (V === L || L !== null && V === L.alternate) {
                    mt = V;
                    break e;
                  }
                  V = mt(V), L = mt(L);
                }
                mt = null;
              }
            else mt = null;
            W !== null && Np(
              lt,
              I,
              W,
              mt,
              !1
            ), dt !== null && Yt !== null && Np(
              lt,
              Yt,
              dt,
              mt,
              !0
            );
          }
        }
        t: {
          if (I = J ? Fn(J) : window, W = I.nodeName && I.nodeName.toLowerCase(), W === "select" || W === "input" && I.type === "file")
            var Ot = Xd;
          else if (Vd(I))
            if (kd)
              Ot = M1;
            else {
              Ot = T1;
              var ht = N1;
            }
          else
            W = I.nodeName, !W || W.toLowerCase() !== "input" || I.type !== "checkbox" && I.type !== "radio" ? J && au(J.elementType) && (Ot = Xd) : Ot = A1;
          if (Ot && (Ot = Ot(t, J))) {
            Qd(
              lt,
              Ot,
              i,
              nt
            );
            break t;
          }
          ht && ht(t, I, J), t === "focusout" && J && I.type === "number" && J.memoizedProps.value != null && hl(I, "number", I.value);
        }
        switch (ht = J ? Fn(J) : window, t) {
          case "focusin":
            (Vd(ht) || ht.contentEditable === "true") && (Sa = ht, vu = J, wl = null);
            break;
          case "focusout":
            wl = vu = Sa = null;
            break;
          case "mousedown":
            bu = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            bu = !1, Wd(lt, i, nt);
            break;
          case "selectionchange":
            if (O1) break;
          case "keydown":
          case "keyup":
            Wd(lt, i, nt);
        }
        var Et;
        if (gu)
          t: {
            switch (t) {
              case "compositionstart":
                var At = "onCompositionStart";
                break t;
              case "compositionend":
                At = "onCompositionEnd";
                break t;
              case "compositionupdate":
                At = "onCompositionUpdate";
                break t;
            }
            At = void 0;
          }
        else
          xa ? qd(t, i) && (At = "onCompositionEnd") : t === "keydown" && i.keyCode === 229 && (At = "onCompositionStart");
        At && (Ud && i.locale !== "ko" && (xa || At !== "onCompositionStart" ? At === "onCompositionEnd" && xa && (Et = Od()) : (Pn = nt, uu = "value" in Pn ? Pn.value : Pn.textContent, xa = !0)), ht = Vs(J, At), 0 < ht.length && (At = new Hd(
          At,
          t,
          null,
          i,
          nt
        ), lt.push({ event: At, listeners: ht }), Et ? At.data = Et : (Et = Yd(i), Et !== null && (At.data = Et)))), (Et = S1 ? w1(t, i) : E1(t, i)) && (At = Vs(J, "onBeforeInput"), 0 < At.length && (ht = new Hd(
          "onBeforeInput",
          "beforeinput",
          null,
          i,
          nt
        ), lt.push({
          event: ht,
          listeners: At
        }), ht.data = Et)), gb(
          lt,
          t,
          J,
          i,
          nt
        );
      }
      _p(lt, e);
    });
  }
  function Kl(t, e, i) {
    return {
      instance: t,
      listener: e,
      currentTarget: i
    };
  }
  function Vs(t, e) {
    for (var i = e + "Capture", l = []; t !== null; ) {
      var r = t, c = r.stateNode;
      if (r = r.tag, r !== 5 && r !== 26 && r !== 27 || c === null || (r = gl(t, i), r != null && l.unshift(
        Kl(t, r, c)
      ), r = gl(t, e), r != null && l.push(
        Kl(t, r, c)
      )), t.tag === 3) return l;
      t = t.return;
    }
    return [];
  }
  function vb(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5 && t.tag !== 27);
    return t || null;
  }
  function Np(t, e, i, l, r) {
    for (var c = e._reactName, y = []; i !== null && i !== l; ) {
      var x = i, R = x.alternate, J = x.stateNode;
      if (x = x.tag, R !== null && R === l) break;
      x !== 5 && x !== 26 && x !== 27 || J === null || (R = J, r ? (J = gl(i, c), J != null && y.unshift(
        Kl(i, J, R)
      )) : r || (J = gl(i, c), J != null && y.push(
        Kl(i, J, R)
      ))), i = i.return;
    }
    y.length !== 0 && t.push({ event: e, listeners: y });
  }
  var bb = /\r\n?/g, xb = /\u0000|\uFFFD/g;
  function Tp(t) {
    return (typeof t == "string" ? t : "" + t).replace(bb, `
`).replace(xb, "");
  }
  function Ap(t, e) {
    return e = Tp(e), Tp(t) === e;
  }
  function qt(t, e, i, l, r, c) {
    switch (i) {
      case "children":
        typeof l == "string" ? e === "body" || e === "textarea" && l === "" || ma(t, l) : (typeof l == "number" || typeof l == "bigint") && e !== "body" && ma(t, "" + l);
        break;
      case "className":
        pa(t, "class", l);
        break;
      case "tabIndex":
        pa(t, "tabindex", l);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        pa(t, i, l);
        break;
      case "style":
        Ad(t, l, c);
        break;
      case "data":
        if (e !== "object") {
          pa(t, "data", l);
          break;
        }
      case "src":
      case "href":
        if (l === "" && (e !== "a" || i !== "href")) {
          t.removeAttribute(i);
          break;
        }
        if (l == null || typeof l == "function" || typeof l == "symbol" || typeof l == "boolean") {
          t.removeAttribute(i);
          break;
        }
        l = Ko("" + l), t.setAttribute(i, l);
        break;
      case "action":
      case "formAction":
        if (typeof l == "function") {
          t.setAttribute(
            i,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof c == "function" && (i === "formAction" ? (e !== "input" && qt(t, e, "name", r.name, r, null), qt(
            t,
            e,
            "formEncType",
            r.formEncType,
            r,
            null
          ), qt(
            t,
            e,
            "formMethod",
            r.formMethod,
            r,
            null
          ), qt(
            t,
            e,
            "formTarget",
            r.formTarget,
            r,
            null
          )) : (qt(t, e, "encType", r.encType, r, null), qt(t, e, "method", r.method, r, null), qt(t, e, "target", r.target, r, null)));
        if (l == null || typeof l == "symbol" || typeof l == "boolean") {
          t.removeAttribute(i);
          break;
        }
        l = Ko("" + l), t.setAttribute(i, l);
        break;
      case "onClick":
        l != null && (t.onclick = _n);
        break;
      case "onScroll":
        l != null && Ct("scroll", t);
        break;
      case "onScrollEnd":
        l != null && Ct("scrollend", t);
        break;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(s(61));
          if (i = l.__html, i != null) {
            if (r.children != null) throw Error(s(60));
            t.innerHTML = i;
          }
        }
        break;
      case "multiple":
        t.multiple = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "muted":
        t.muted = l && typeof l != "function" && typeof l != "symbol";
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "defaultValue":
      case "defaultChecked":
      case "innerHTML":
      case "ref":
        break;
      case "autoFocus":
        break;
      case "xlinkHref":
        if (l == null || typeof l == "function" || typeof l == "boolean" || typeof l == "symbol") {
          t.removeAttribute("xlink:href");
          break;
        }
        i = Ko("" + l), t.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          i
        );
        break;
      case "contentEditable":
      case "spellCheck":
      case "draggable":
      case "value":
      case "autoReverse":
      case "externalResourcesRequired":
      case "focusable":
      case "preserveAlpha":
        l != null && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(i, "" + l) : t.removeAttribute(i);
        break;
      case "inert":
      case "allowFullScreen":
      case "async":
      case "autoPlay":
      case "controls":
      case "default":
      case "defer":
      case "disabled":
      case "disablePictureInPicture":
      case "disableRemotePlayback":
      case "formNoValidate":
      case "hidden":
      case "loop":
      case "noModule":
      case "noValidate":
      case "open":
      case "playsInline":
      case "readOnly":
      case "required":
      case "reversed":
      case "scoped":
      case "seamless":
      case "itemScope":
        l && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(i, "") : t.removeAttribute(i);
        break;
      case "capture":
      case "download":
        l === !0 ? t.setAttribute(i, "") : l !== !1 && l != null && typeof l != "function" && typeof l != "symbol" ? t.setAttribute(i, l) : t.removeAttribute(i);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        l != null && typeof l != "function" && typeof l != "symbol" && !isNaN(l) && 1 <= l ? t.setAttribute(i, l) : t.removeAttribute(i);
        break;
      case "rowSpan":
      case "start":
        l == null || typeof l == "function" || typeof l == "symbol" || isNaN(l) ? t.removeAttribute(i) : t.setAttribute(i, l);
        break;
      case "popover":
        Ct("beforetoggle", t), Ct("toggle", t), ga(t, "popover", l);
        break;
      case "xlinkActuate":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          l
        );
        break;
      case "xlinkArcrole":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          l
        );
        break;
      case "xlinkRole":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          l
        );
        break;
      case "xlinkShow":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          l
        );
        break;
      case "xlinkTitle":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          l
        );
        break;
      case "xlinkType":
        Ie(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          l
        );
        break;
      case "xmlBase":
        Ie(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          l
        );
        break;
      case "xmlLang":
        Ie(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          l
        );
        break;
      case "xmlSpace":
        Ie(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          l
        );
        break;
      case "is":
        ga(t, "is", l);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < i.length) || i[0] !== "o" && i[0] !== "O" || i[1] !== "n" && i[1] !== "N") && (i = $v.get(i) || i, ga(t, i, l));
    }
  }
  function kc(t, e, i, l, r, c) {
    switch (i) {
      case "style":
        Ad(t, l, c);
        break;
      case "dangerouslySetInnerHTML":
        if (l != null) {
          if (typeof l != "object" || !("__html" in l))
            throw Error(s(61));
          if (i = l.__html, i != null) {
            if (r.children != null) throw Error(s(60));
            t.innerHTML = i;
          }
        }
        break;
      case "children":
        typeof l == "string" ? ma(t, l) : (typeof l == "number" || typeof l == "bigint") && ma(t, "" + l);
        break;
      case "onScroll":
        l != null && Ct("scroll", t);
        break;
      case "onScrollEnd":
        l != null && Ct("scrollend", t);
        break;
      case "onClick":
        l != null && (t.onclick = _n);
        break;
      case "suppressContentEditableWarning":
      case "suppressHydrationWarning":
      case "innerHTML":
      case "ref":
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        if (!Qo.hasOwnProperty(i))
          t: {
            if (i[0] === "o" && i[1] === "n" && (r = i.endsWith("Capture"), e = i.slice(2, r ? i.length - 7 : void 0), c = t[ge] || null, c = c != null ? c[i] : null, typeof c == "function" && t.removeEventListener(e, c, r), typeof l == "function")) {
              typeof c != "function" && c !== null && (i in t ? t[i] = null : t.hasAttribute(i) && t.removeAttribute(i)), t.addEventListener(e, l, r);
              break t;
            }
            i in t ? t[i] = l : l === !0 ? t.setAttribute(i, "") : ga(t, i, l);
          }
    }
  }
  function de(t, e, i) {
    switch (e) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "img":
        Ct("error", t), Ct("load", t);
        var l = !1, r = !1, c;
        for (c in i)
          if (i.hasOwnProperty(c)) {
            var y = i[c];
            if (y != null)
              switch (c) {
                case "src":
                  l = !0;
                  break;
                case "srcSet":
                  r = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(s(137, e));
                default:
                  qt(t, e, c, y, i, null);
              }
          }
        r && qt(t, e, "srcSet", i.srcSet, i, null), l && qt(t, e, "src", i.src, i, null);
        return;
      case "input":
        Ct("invalid", t);
        var x = c = y = r = null, R = null, J = null;
        for (l in i)
          if (i.hasOwnProperty(l)) {
            var nt = i[l];
            if (nt != null)
              switch (l) {
                case "name":
                  r = nt;
                  break;
                case "type":
                  y = nt;
                  break;
                case "checked":
                  R = nt;
                  break;
                case "defaultChecked":
                  J = nt;
                  break;
                case "value":
                  c = nt;
                  break;
                case "defaultValue":
                  x = nt;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (nt != null)
                    throw Error(s(137, e));
                  break;
                default:
                  qt(t, e, l, nt, i, null);
              }
          }
        Zo(
          t,
          c,
          x,
          R,
          J,
          y,
          r,
          !1
        );
        return;
      case "select":
        Ct("invalid", t), l = y = c = null;
        for (r in i)
          if (i.hasOwnProperty(r) && (x = i[r], x != null))
            switch (r) {
              case "value":
                c = x;
                break;
              case "defaultValue":
                y = x;
                break;
              case "multiple":
                l = x;
              default:
                qt(t, e, r, x, i, null);
            }
        e = c, i = y, t.multiple = !!l, e != null ? En(t, !!l, e, !1) : i != null && En(t, !!l, i, !0);
        return;
      case "textarea":
        Ct("invalid", t), c = r = l = null;
        for (y in i)
          if (i.hasOwnProperty(y) && (x = i[y], x != null))
            switch (y) {
              case "value":
                l = x;
                break;
              case "defaultValue":
                r = x;
                break;
              case "children":
                c = x;
                break;
              case "dangerouslySetInnerHTML":
                if (x != null) throw Error(s(91));
                break;
              default:
                qt(t, e, y, x, i, null);
            }
        Nd(t, l, r, c);
        return;
      case "option":
        for (R in i)
          i.hasOwnProperty(R) && (l = i[R], l != null) && (R === "selected" ? t.selected = l && typeof l != "function" && typeof l != "symbol" : qt(t, e, R, l, i, null));
        return;
      case "dialog":
        Ct("beforetoggle", t), Ct("toggle", t), Ct("cancel", t), Ct("close", t);
        break;
      case "iframe":
      case "object":
        Ct("load", t);
        break;
      case "video":
      case "audio":
        for (l = 0; l < Zl.length; l++)
          Ct(Zl[l], t);
        break;
      case "image":
        Ct("error", t), Ct("load", t);
        break;
      case "details":
        Ct("toggle", t);
        break;
      case "embed":
      case "source":
      case "link":
        Ct("error", t), Ct("load", t);
      case "area":
      case "base":
      case "br":
      case "col":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "track":
      case "wbr":
      case "menuitem":
        for (J in i)
          if (i.hasOwnProperty(J) && (l = i[J], l != null))
            switch (J) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(s(137, e));
              default:
                qt(t, e, J, l, i, null);
            }
        return;
      default:
        if (au(e)) {
          for (nt in i)
            i.hasOwnProperty(nt) && (l = i[nt], l !== void 0 && kc(
              t,
              e,
              nt,
              l,
              i,
              void 0
            ));
          return;
        }
    }
    for (x in i)
      i.hasOwnProperty(x) && (l = i[x], l != null && qt(t, e, x, l, i, null));
  }
  function Sb(t, e, i, l) {
    switch (e) {
      case "div":
      case "span":
      case "svg":
      case "path":
      case "a":
      case "g":
      case "p":
      case "li":
        break;
      case "input":
        var r = null, c = null, y = null, x = null, R = null, J = null, nt = null;
        for (W in i) {
          var lt = i[W];
          if (i.hasOwnProperty(W) && lt != null)
            switch (W) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                R = lt;
              default:
                l.hasOwnProperty(W) || qt(t, e, W, null, l, lt);
            }
        }
        for (var I in l) {
          var W = l[I];
          if (lt = i[I], l.hasOwnProperty(I) && (W != null || lt != null))
            switch (I) {
              case "type":
                c = W;
                break;
              case "name":
                r = W;
                break;
              case "checked":
                J = W;
                break;
              case "defaultChecked":
                nt = W;
                break;
              case "value":
                y = W;
                break;
              case "defaultValue":
                x = W;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (W != null)
                  throw Error(s(137, e));
                break;
              default:
                W !== lt && qt(
                  t,
                  e,
                  I,
                  W,
                  l,
                  lt
                );
            }
        }
        ji(
          t,
          y,
          x,
          R,
          J,
          nt,
          c,
          r
        );
        return;
      case "select":
        W = y = x = I = null;
        for (c in i)
          if (R = i[c], i.hasOwnProperty(c) && R != null)
            switch (c) {
              case "value":
                break;
              case "multiple":
                W = R;
              default:
                l.hasOwnProperty(c) || qt(
                  t,
                  e,
                  c,
                  null,
                  l,
                  R
                );
            }
        for (r in l)
          if (c = l[r], R = i[r], l.hasOwnProperty(r) && (c != null || R != null))
            switch (r) {
              case "value":
                I = c;
                break;
              case "defaultValue":
                x = c;
                break;
              case "multiple":
                y = c;
              default:
                c !== R && qt(
                  t,
                  e,
                  r,
                  c,
                  l,
                  R
                );
            }
        e = x, i = y, l = W, I != null ? En(t, !!i, I, !1) : !!l != !!i && (e != null ? En(t, !!i, e, !0) : En(t, !!i, i ? [] : "", !1));
        return;
      case "textarea":
        W = I = null;
        for (x in i)
          if (r = i[x], i.hasOwnProperty(x) && r != null && !l.hasOwnProperty(x))
            switch (x) {
              case "value":
                break;
              case "children":
                break;
              default:
                qt(t, e, x, null, l, r);
            }
        for (y in l)
          if (r = l[y], c = i[y], l.hasOwnProperty(y) && (r != null || c != null))
            switch (y) {
              case "value":
                I = r;
                break;
              case "defaultValue":
                W = r;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (r != null) throw Error(s(91));
                break;
              default:
                r !== c && qt(t, e, y, r, l, c);
            }
        Cd(t, I, W);
        return;
      case "option":
        for (var dt in i)
          I = i[dt], i.hasOwnProperty(dt) && I != null && !l.hasOwnProperty(dt) && (dt === "selected" ? t.selected = !1 : qt(
            t,
            e,
            dt,
            null,
            l,
            I
          ));
        for (R in l)
          I = l[R], W = i[R], l.hasOwnProperty(R) && I !== W && (I != null || W != null) && (R === "selected" ? t.selected = I && typeof I != "function" && typeof I != "symbol" : qt(
            t,
            e,
            R,
            I,
            l,
            W
          ));
        return;
      case "img":
      case "link":
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "keygen":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
      case "menuitem":
        for (var mt in i)
          I = i[mt], i.hasOwnProperty(mt) && I != null && !l.hasOwnProperty(mt) && qt(t, e, mt, null, l, I);
        for (J in l)
          if (I = l[J], W = i[J], l.hasOwnProperty(J) && I !== W && (I != null || W != null))
            switch (J) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (I != null)
                  throw Error(s(137, e));
                break;
              default:
                qt(
                  t,
                  e,
                  J,
                  I,
                  l,
                  W
                );
            }
        return;
      default:
        if (au(e)) {
          for (var Yt in i)
            I = i[Yt], i.hasOwnProperty(Yt) && I !== void 0 && !l.hasOwnProperty(Yt) && kc(
              t,
              e,
              Yt,
              void 0,
              l,
              I
            );
          for (nt in l)
            I = l[nt], W = i[nt], !l.hasOwnProperty(nt) || I === W || I === void 0 && W === void 0 || kc(
              t,
              e,
              nt,
              I,
              l,
              W
            );
          return;
        }
    }
    for (var V in i)
      I = i[V], i.hasOwnProperty(V) && I != null && !l.hasOwnProperty(V) && qt(t, e, V, null, l, I);
    for (lt in l)
      I = l[lt], W = i[lt], !l.hasOwnProperty(lt) || I === W || I == null && W == null || qt(t, e, lt, I, l, W);
  }
  function Mp(t) {
    switch (t) {
      case "css":
      case "script":
      case "font":
      case "img":
      case "image":
      case "input":
      case "link":
        return !0;
      default:
        return !1;
    }
  }
  function wb() {
    if (typeof performance.getEntriesByType == "function") {
      for (var t = 0, e = 0, i = performance.getEntriesByType("resource"), l = 0; l < i.length; l++) {
        var r = i[l], c = r.transferSize, y = r.initiatorType, x = r.duration;
        if (c && x && Mp(y)) {
          for (y = 0, x = r.responseEnd, l += 1; l < i.length; l++) {
            var R = i[l], J = R.startTime;
            if (J > x) break;
            var nt = R.transferSize, lt = R.initiatorType;
            nt && Mp(lt) && (R = R.responseEnd, y += nt * (R < x ? 1 : (x - J) / (R - J)));
          }
          if (--l, e += 8 * (c + y) / (r.duration / 1e3), t++, 10 < t) break;
        }
      }
      if (0 < t) return e / t / 1e6;
    }
    return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
  }
  var Gc = null, Zc = null;
  function Qs(t) {
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  function zp(t) {
    switch (t) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function Op(t, e) {
    if (t === 0)
      switch (e) {
        case "svg":
          return 1;
        case "math":
          return 2;
        default:
          return 0;
      }
    return t === 1 && e === "foreignObject" ? 0 : t;
  }
  function Kc(t, e) {
    return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
  }
  var $c = null;
  function Eb() {
    var t = window.event;
    return t && t.type === "popstate" ? t === $c ? !1 : ($c = t, !0) : ($c = null, !1);
  }
  var Dp = typeof setTimeout == "function" ? setTimeout : void 0, _b = typeof clearTimeout == "function" ? clearTimeout : void 0, Rp = typeof Promise == "function" ? Promise : void 0, Cb = typeof queueMicrotask == "function" ? queueMicrotask : typeof Rp < "u" ? function(t) {
    return Rp.resolve(null).then(t).catch(Nb);
  } : Dp;
  function Nb(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function yi(t) {
    return t === "head";
  }
  function Hp(t, e) {
    var i = e, l = 0;
    do {
      var r = i.nextSibling;
      if (t.removeChild(i), r && r.nodeType === 8)
        if (i = r.data, i === "/$" || i === "/&") {
          if (l === 0) {
            t.removeChild(r), $a(e);
            return;
          }
          l--;
        } else if (i === "$" || i === "$?" || i === "$~" || i === "$!" || i === "&")
          l++;
        else if (i === "html")
          $l(t.ownerDocument.documentElement);
        else if (i === "head") {
          i = t.ownerDocument.head, $l(i);
          for (var c = i.firstChild; c; ) {
            var y = c.nextSibling, x = c.nodeName;
            c[Ri] || x === "SCRIPT" || x === "STYLE" || x === "LINK" && c.rel.toLowerCase() === "stylesheet" || i.removeChild(c), c = y;
          }
        } else
          i === "body" && $l(t.ownerDocument.body);
      i = r;
    } while (i);
    $a(e);
  }
  function jp(t, e) {
    var i = t;
    t = 0;
    do {
      var l = i.nextSibling;
      if (i.nodeType === 1 ? e ? (i._stashedDisplay = i.style.display, i.style.display = "none") : (i.style.display = i._stashedDisplay || "", i.getAttribute("style") === "" && i.removeAttribute("style")) : i.nodeType === 3 && (e ? (i._stashedText = i.nodeValue, i.nodeValue = "") : i.nodeValue = i._stashedText || ""), l && l.nodeType === 8)
        if (i = l.data, i === "/$") {
          if (t === 0) break;
          t--;
        } else
          i !== "$" && i !== "$?" && i !== "$~" && i !== "$!" || t++;
      i = l;
    } while (i);
  }
  function Jc(t) {
    var e = t.firstChild;
    for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
      var i = e;
      switch (e = e.nextSibling, i.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          Jc(i), fl(i);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (i.rel.toLowerCase() === "stylesheet") continue;
      }
      t.removeChild(i);
    }
  }
  function Tb(t, e, i, l) {
    for (; t.nodeType === 1; ) {
      var r = i;
      if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
        if (!l && (t.nodeName !== "INPUT" || t.type !== "hidden"))
          break;
      } else if (l) {
        if (!t[Ri])
          switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (c = t.getAttribute("rel"), c === "stylesheet" && t.hasAttribute("data-precedence"))
                break;
              if (c !== r.rel || t.getAttribute("href") !== (r.href == null || r.href === "" ? null : r.href) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin) || t.getAttribute("title") !== (r.title == null ? null : r.title))
                break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (c = t.getAttribute("src"), (c !== (r.src == null ? null : r.src) || t.getAttribute("type") !== (r.type == null ? null : r.type) || t.getAttribute("crossorigin") !== (r.crossOrigin == null ? null : r.crossOrigin)) && c && t.hasAttribute("async") && !t.hasAttribute("itemprop"))
                break;
              return t;
            default:
              return t;
          }
      } else if (e === "input" && t.type === "hidden") {
        var c = r.name == null ? null : "" + r.name;
        if (r.type === "hidden" && t.getAttribute("name") === c)
          return t;
      } else return t;
      if (t = Ze(t.nextSibling), t === null) break;
    }
    return null;
  }
  function Ab(t, e, i) {
    if (e === "") return null;
    for (; t.nodeType !== 3; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !i || (t = Ze(t.nextSibling), t === null)) return null;
    return t;
  }
  function Up(t, e) {
    for (; t.nodeType !== 8; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = Ze(t.nextSibling), t === null)) return null;
    return t;
  }
  function Fc(t) {
    return t.data === "$?" || t.data === "$~";
  }
  function Ic(t) {
    return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
  }
  function Mb(t, e) {
    var i = t.ownerDocument;
    if (t.data === "$~") t._reactRetry = e;
    else if (t.data !== "$?" || i.readyState !== "loading")
      e();
    else {
      var l = function() {
        e(), i.removeEventListener("DOMContentLoaded", l);
      };
      i.addEventListener("DOMContentLoaded", l), t._reactRetry = l;
    }
  }
  function Ze(t) {
    for (; t != null; t = t.nextSibling) {
      var e = t.nodeType;
      if (e === 1 || e === 3) break;
      if (e === 8) {
        if (e = t.data, e === "$" || e === "$!" || e === "$?" || e === "$~" || e === "&" || e === "F!" || e === "F")
          break;
        if (e === "/$" || e === "/&") return null;
      }
    }
    return t;
  }
  var Wc = null;
  function Bp(t) {
    t = t.nextSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var i = t.data;
        if (i === "/$" || i === "/&") {
          if (e === 0)
            return Ze(t.nextSibling);
          e--;
        } else
          i !== "$" && i !== "$!" && i !== "$?" && i !== "$~" && i !== "&" || e++;
      }
      t = t.nextSibling;
    }
    return null;
  }
  function Lp(t) {
    t = t.previousSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var i = t.data;
        if (i === "$" || i === "$!" || i === "$?" || i === "$~" || i === "&") {
          if (e === 0) return t;
          e--;
        } else i !== "/$" && i !== "/&" || e++;
      }
      t = t.previousSibling;
    }
    return null;
  }
  function qp(t, e, i) {
    switch (e = Qs(i), t) {
      case "html":
        if (t = e.documentElement, !t) throw Error(s(452));
        return t;
      case "head":
        if (t = e.head, !t) throw Error(s(453));
        return t;
      case "body":
        if (t = e.body, !t) throw Error(s(454));
        return t;
      default:
        throw Error(s(451));
    }
  }
  function $l(t) {
    for (var e = t.attributes; e.length; )
      t.removeAttributeNode(e[0]);
    fl(t);
  }
  var Ke = /* @__PURE__ */ new Map(), Yp = /* @__PURE__ */ new Set();
  function Xs(t) {
    return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
  }
  var Yn = H.d;
  H.d = {
    f: zb,
    r: Ob,
    D: Db,
    C: Rb,
    L: Hb,
    m: jb,
    X: Bb,
    S: Ub,
    M: Lb
  };
  function zb() {
    var t = Yn.f(), e = Hs();
    return t || e;
  }
  function Ob(t) {
    var e = Jn(t);
    e !== null && e.tag === 5 && e.type === "form" ? ig(e) : Yn.r(t);
  }
  var Ga = typeof document > "u" ? null : document;
  function Vp(t, e, i) {
    var l = Ga;
    if (l && typeof e == "string" && e) {
      var r = Se(e);
      r = 'link[rel="' + t + '"][href="' + r + '"]', typeof i == "string" && (r += '[crossorigin="' + i + '"]'), Yp.has(r) || (Yp.add(r), t = { rel: t, crossOrigin: i, href: e }, l.querySelector(r) === null && (e = l.createElement("link"), de(e, "link", t), It(e), l.head.appendChild(e)));
    }
  }
  function Db(t) {
    Yn.D(t), Vp("dns-prefetch", t, null);
  }
  function Rb(t, e) {
    Yn.C(t, e), Vp("preconnect", t, e);
  }
  function Hb(t, e, i) {
    Yn.L(t, e, i);
    var l = Ga;
    if (l && t && e) {
      var r = 'link[rel="preload"][as="' + Se(e) + '"]';
      e === "image" && i && i.imageSrcSet ? (r += '[imagesrcset="' + Se(
        i.imageSrcSet
      ) + '"]', typeof i.imageSizes == "string" && (r += '[imagesizes="' + Se(
        i.imageSizes
      ) + '"]')) : r += '[href="' + Se(t) + '"]';
      var c = r;
      switch (e) {
        case "style":
          c = Za(t);
          break;
        case "script":
          c = Ka(t);
      }
      Ke.has(c) || (t = v(
        {
          rel: "preload",
          href: e === "image" && i && i.imageSrcSet ? void 0 : t,
          as: e
        },
        i
      ), Ke.set(c, t), l.querySelector(r) !== null || e === "style" && l.querySelector(Jl(c)) || e === "script" && l.querySelector(Fl(c)) || (e = l.createElement("link"), de(e, "link", t), It(e), l.head.appendChild(e)));
    }
  }
  function jb(t, e) {
    Yn.m(t, e);
    var i = Ga;
    if (i && t) {
      var l = e && typeof e.as == "string" ? e.as : "script", r = 'link[rel="modulepreload"][as="' + Se(l) + '"][href="' + Se(t) + '"]', c = r;
      switch (l) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          c = Ka(t);
      }
      if (!Ke.has(c) && (t = v({ rel: "modulepreload", href: t }, e), Ke.set(c, t), i.querySelector(r) === null)) {
        switch (l) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (i.querySelector(Fl(c)))
              return;
        }
        l = i.createElement("link"), de(l, "link", t), It(l), i.head.appendChild(l);
      }
    }
  }
  function Ub(t, e, i) {
    Yn.S(t, e, i);
    var l = Ga;
    if (l && t) {
      var r = In(l).hoistableStyles, c = Za(t);
      e = e || "default";
      var y = r.get(c);
      if (!y) {
        var x = { loading: 0, preload: null };
        if (y = l.querySelector(
          Jl(c)
        ))
          x.loading = 5;
        else {
          t = v(
            { rel: "stylesheet", href: t, "data-precedence": e },
            i
          ), (i = Ke.get(c)) && Pc(t, i);
          var R = y = l.createElement("link");
          It(R), de(R, "link", t), R._p = new Promise(function(J, nt) {
            R.onload = J, R.onerror = nt;
          }), R.addEventListener("load", function() {
            x.loading |= 1;
          }), R.addEventListener("error", function() {
            x.loading |= 2;
          }), x.loading |= 4, ks(y, e, l);
        }
        y = {
          type: "stylesheet",
          instance: y,
          count: 1,
          state: x
        }, r.set(c, y);
      }
    }
  }
  function Bb(t, e) {
    Yn.X(t, e);
    var i = Ga;
    if (i && t) {
      var l = In(i).hoistableScripts, r = Ka(t), c = l.get(r);
      c || (c = i.querySelector(Fl(r)), c || (t = v({ src: t, async: !0 }, e), (e = Ke.get(r)) && tf(t, e), c = i.createElement("script"), It(c), de(c, "link", t), i.head.appendChild(c)), c = {
        type: "script",
        instance: c,
        count: 1,
        state: null
      }, l.set(r, c));
    }
  }
  function Lb(t, e) {
    Yn.M(t, e);
    var i = Ga;
    if (i && t) {
      var l = In(i).hoistableScripts, r = Ka(t), c = l.get(r);
      c || (c = i.querySelector(Fl(r)), c || (t = v({ src: t, async: !0, type: "module" }, e), (e = Ke.get(r)) && tf(t, e), c = i.createElement("script"), It(c), de(c, "link", t), i.head.appendChild(c)), c = {
        type: "script",
        instance: c,
        count: 1,
        state: null
      }, l.set(r, c));
    }
  }
  function Qp(t, e, i, l) {
    var r = (r = ct.current) ? Xs(r) : null;
    if (!r) throw Error(s(446));
    switch (t) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof i.precedence == "string" && typeof i.href == "string" ? (e = Za(i.href), i = In(
          r
        ).hoistableStyles, l = i.get(e), l || (l = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, i.set(e, l)), l) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (i.rel === "stylesheet" && typeof i.href == "string" && typeof i.precedence == "string") {
          t = Za(i.href);
          var c = In(
            r
          ).hoistableStyles, y = c.get(t);
          if (y || (r = r.ownerDocument || r, y = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, c.set(t, y), (c = r.querySelector(
            Jl(t)
          )) && !c._p && (y.instance = c, y.state.loading = 5), Ke.has(t) || (i = {
            rel: "preload",
            as: "style",
            href: i.href,
            crossOrigin: i.crossOrigin,
            integrity: i.integrity,
            media: i.media,
            hrefLang: i.hrefLang,
            referrerPolicy: i.referrerPolicy
          }, Ke.set(t, i), c || qb(
            r,
            t,
            i,
            y.state
          ))), e && l === null)
            throw Error(s(528, ""));
          return y;
        }
        if (e && l !== null)
          throw Error(s(529, ""));
        return null;
      case "script":
        return e = i.async, i = i.src, typeof i == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = Ka(i), i = In(
          r
        ).hoistableScripts, l = i.get(e), l || (l = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, i.set(e, l)), l) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(s(444, t));
    }
  }
  function Za(t) {
    return 'href="' + Se(t) + '"';
  }
  function Jl(t) {
    return 'link[rel="stylesheet"][' + t + "]";
  }
  function Xp(t) {
    return v({}, t, {
      "data-precedence": t.precedence,
      precedence: null
    });
  }
  function qb(t, e, i, l) {
    t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? l.loading = 1 : (e = t.createElement("link"), l.preload = e, e.addEventListener("load", function() {
      return l.loading |= 1;
    }), e.addEventListener("error", function() {
      return l.loading |= 2;
    }), de(e, "link", i), It(e), t.head.appendChild(e));
  }
  function Ka(t) {
    return '[src="' + Se(t) + '"]';
  }
  function Fl(t) {
    return "script[async]" + t;
  }
  function kp(t, e, i) {
    if (e.count++, e.instance === null)
      switch (e.type) {
        case "style":
          var l = t.querySelector(
            'style[data-href~="' + Se(i.href) + '"]'
          );
          if (l)
            return e.instance = l, It(l), l;
          var r = v({}, i, {
            "data-href": i.href,
            "data-precedence": i.precedence,
            href: null,
            precedence: null
          });
          return l = (t.ownerDocument || t).createElement(
            "style"
          ), It(l), de(l, "style", r), ks(l, i.precedence, t), e.instance = l;
        case "stylesheet":
          r = Za(i.href);
          var c = t.querySelector(
            Jl(r)
          );
          if (c)
            return e.state.loading |= 4, e.instance = c, It(c), c;
          l = Xp(i), (r = Ke.get(r)) && Pc(l, r), c = (t.ownerDocument || t).createElement("link"), It(c);
          var y = c;
          return y._p = new Promise(function(x, R) {
            y.onload = x, y.onerror = R;
          }), de(c, "link", l), e.state.loading |= 4, ks(c, i.precedence, t), e.instance = c;
        case "script":
          return c = Ka(i.src), (r = t.querySelector(
            Fl(c)
          )) ? (e.instance = r, It(r), r) : (l = i, (r = Ke.get(c)) && (l = v({}, i), tf(l, r)), t = t.ownerDocument || t, r = t.createElement("script"), It(r), de(r, "link", l), t.head.appendChild(r), e.instance = r);
        case "void":
          return null;
        default:
          throw Error(s(443, e.type));
      }
    else
      e.type === "stylesheet" && (e.state.loading & 4) === 0 && (l = e.instance, e.state.loading |= 4, ks(l, i.precedence, t));
    return e.instance;
  }
  function ks(t, e, i) {
    for (var l = i.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), r = l.length ? l[l.length - 1] : null, c = r, y = 0; y < l.length; y++) {
      var x = l[y];
      if (x.dataset.precedence === e) c = x;
      else if (c !== r) break;
    }
    c ? c.parentNode.insertBefore(t, c.nextSibling) : (e = i.nodeType === 9 ? i.head : i, e.insertBefore(t, e.firstChild));
  }
  function Pc(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
  }
  function tf(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
  }
  var Gs = null;
  function Gp(t, e, i) {
    if (Gs === null) {
      var l = /* @__PURE__ */ new Map(), r = Gs = /* @__PURE__ */ new Map();
      r.set(i, l);
    } else
      r = Gs, l = r.get(i), l || (l = /* @__PURE__ */ new Map(), r.set(i, l));
    if (l.has(t)) return l;
    for (l.set(t, null), i = i.getElementsByTagName(t), r = 0; r < i.length; r++) {
      var c = i[r];
      if (!(c[Ri] || c[ae] || t === "link" && c.getAttribute("rel") === "stylesheet") && c.namespaceURI !== "http://www.w3.org/2000/svg") {
        var y = c.getAttribute(e) || "";
        y = t + y;
        var x = l.get(y);
        x ? x.push(c) : l.set(y, [c]);
      }
    }
    return l;
  }
  function Zp(t, e, i) {
    t = t.ownerDocument || t, t.head.insertBefore(
      i,
      e === "title" ? t.querySelector("head > title") : null
    );
  }
  function Yb(t, e, i) {
    if (i === 1 || e.itemProp != null) return !1;
    switch (t) {
      case "meta":
      case "title":
        return !0;
      case "style":
        if (typeof e.precedence != "string" || typeof e.href != "string" || e.href === "")
          break;
        return !0;
      case "link":
        if (typeof e.rel != "string" || typeof e.href != "string" || e.href === "" || e.onLoad || e.onError)
          break;
        return e.rel === "stylesheet" ? (t = e.disabled, typeof e.precedence == "string" && t == null) : !0;
      case "script":
        if (e.async && typeof e.async != "function" && typeof e.async != "symbol" && !e.onLoad && !e.onError && e.src && typeof e.src == "string")
          return !0;
    }
    return !1;
  }
  function Kp(t) {
    return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
  }
  function Vb(t, e, i, l) {
    if (i.type === "stylesheet" && (typeof l.media != "string" || matchMedia(l.media).matches !== !1) && (i.state.loading & 4) === 0) {
      if (i.instance === null) {
        var r = Za(l.href), c = e.querySelector(
          Jl(r)
        );
        if (c) {
          e = c._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = Zs.bind(t), e.then(t, t)), i.state.loading |= 4, i.instance = c, It(c);
          return;
        }
        c = e.ownerDocument || e, l = Xp(l), (r = Ke.get(r)) && Pc(l, r), c = c.createElement("link"), It(c);
        var y = c;
        y._p = new Promise(function(x, R) {
          y.onload = x, y.onerror = R;
        }), de(c, "link", l), i.instance = c;
      }
      t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(i, e), (e = i.state.preload) && (i.state.loading & 3) === 0 && (t.count++, i = Zs.bind(t), e.addEventListener("load", i), e.addEventListener("error", i));
    }
  }
  var ef = 0;
  function Qb(t, e) {
    return t.stylesheets && t.count === 0 && $s(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(i) {
      var l = setTimeout(function() {
        if (t.stylesheets && $s(t, t.stylesheets), t.unsuspend) {
          var c = t.unsuspend;
          t.unsuspend = null, c();
        }
      }, 6e4 + e);
      0 < t.imgBytes && ef === 0 && (ef = 62500 * wb());
      var r = setTimeout(
        function() {
          if (t.waitingForImages = !1, t.count === 0 && (t.stylesheets && $s(t, t.stylesheets), t.unsuspend)) {
            var c = t.unsuspend;
            t.unsuspend = null, c();
          }
        },
        (t.imgBytes > ef ? 50 : 800) + e
      );
      return t.unsuspend = i, function() {
        t.unsuspend = null, clearTimeout(l), clearTimeout(r);
      };
    } : null;
  }
  function Zs() {
    if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
      if (this.stylesheets) $s(this, this.stylesheets);
      else if (this.unsuspend) {
        var t = this.unsuspend;
        this.unsuspend = null, t();
      }
    }
  }
  var Ks = null;
  function $s(t, e) {
    t.stylesheets = null, t.unsuspend !== null && (t.count++, Ks = /* @__PURE__ */ new Map(), e.forEach(Xb, t), Ks = null, Zs.call(t));
  }
  function Xb(t, e) {
    if (!(e.state.loading & 4)) {
      var i = Ks.get(t);
      if (i) var l = i.get(null);
      else {
        i = /* @__PURE__ */ new Map(), Ks.set(t, i);
        for (var r = t.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), c = 0; c < r.length; c++) {
          var y = r[c];
          (y.nodeName === "LINK" || y.getAttribute("media") !== "not all") && (i.set(y.dataset.precedence, y), l = y);
        }
        l && i.set(null, l);
      }
      r = e.instance, y = r.getAttribute("data-precedence"), c = i.get(y) || l, c === l && i.set(null, r), i.set(y, r), this.count++, l = Zs.bind(this), r.addEventListener("load", l), r.addEventListener("error", l), c ? c.parentNode.insertBefore(r, c.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(r, t.firstChild)), e.state.loading |= 4;
    }
  }
  var Il = {
    $$typeof: w,
    Provider: null,
    Consumer: null,
    _currentValue: Y,
    _currentValue2: Y,
    _threadCount: 0
  };
  function kb(t, e, i, l, r, c, y, x, R) {
    this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = rl(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = rl(0), this.hiddenUpdates = rl(null), this.identifierPrefix = l, this.onUncaughtError = r, this.onCaughtError = c, this.onRecoverableError = y, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = R, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function $p(t, e, i, l, r, c, y, x, R, J, nt, lt) {
    return t = new kb(
      t,
      e,
      i,
      y,
      R,
      J,
      nt,
      lt,
      x
    ), e = 1, c === !0 && (e |= 24), c = De(3, null, null, e), t.current = c, c.stateNode = t, e = Hu(), e.refCount++, t.pooledCache = e, e.refCount++, c.memoizedState = {
      element: l,
      isDehydrated: i,
      cache: e
    }, Lu(c), t;
  }
  function Jp(t) {
    return t ? (t = _a, t) : _a;
  }
  function Fp(t, e, i, l, r, c) {
    r = Jp(r), l.context === null ? l.context = r : l.pendingContext = r, l = li(e), l.payload = { element: i }, c = c === void 0 ? null : c, c !== null && (l.callback = c), i = oi(t, l, e), i !== null && (Te(i, t, e), Ml(i, t, e));
  }
  function Ip(t, e) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var i = t.retryLane;
      t.retryLane = i !== 0 && i < e ? i : e;
    }
  }
  function nf(t, e) {
    Ip(t, e), (t = t.alternate) && Ip(t, e);
  }
  function Wp(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = qi(t, 67108864);
      e !== null && Te(e, t, 67108864), nf(t, 67108864);
    }
  }
  function Pp(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Be();
      e = ul(e);
      var i = qi(t, e);
      i !== null && Te(i, t, e), nf(t, e);
    }
  }
  var Js = !0;
  function Gb(t, e, i, l) {
    var r = N.T;
    N.T = null;
    var c = H.p;
    try {
      H.p = 2, af(t, e, i, l);
    } finally {
      H.p = c, N.T = r;
    }
  }
  function Zb(t, e, i, l) {
    var r = N.T;
    N.T = null;
    var c = H.p;
    try {
      H.p = 8, af(t, e, i, l);
    } finally {
      H.p = c, N.T = r;
    }
  }
  function af(t, e, i, l) {
    if (Js) {
      var r = lf(l);
      if (r === null)
        Xc(
          t,
          e,
          l,
          Fs,
          i
        ), ey(t, l);
      else if ($b(
        r,
        t,
        e,
        i,
        l
      ))
        l.stopPropagation();
      else if (ey(t, l), e & 4 && -1 < Kb.indexOf(t)) {
        for (; r !== null; ) {
          var c = Jn(r);
          if (c !== null)
            switch (c.tag) {
              case 3:
                if (c = c.stateNode, c.current.memoizedState.isDehydrated) {
                  var y = xn(c.pendingLanes);
                  if (y !== 0) {
                    var x = c;
                    for (x.pendingLanes |= 2, x.entangledLanes |= 2; y; ) {
                      var R = 1 << 31 - me(y);
                      x.entanglements[1] |= R, y &= ~R;
                    }
                    dn(c), (Rt & 6) === 0 && (Ds = re() + 500, Gl(0));
                  }
                }
                break;
              case 31:
              case 13:
                x = qi(c, 2), x !== null && Te(x, c, 2), Hs(), nf(c, 2);
            }
          if (c = lf(l), c === null && Xc(
            t,
            e,
            l,
            Fs,
            i
          ), c === r) break;
          r = c;
        }
        r !== null && l.stopPropagation();
      } else
        Xc(
          t,
          e,
          l,
          null,
          i
        );
    }
  }
  function lf(t) {
    return t = ou(t), of(t);
  }
  var Fs = null;
  function of(t) {
    if (Fs = null, t = $n(t), t !== null) {
      var e = f(t);
      if (e === null) t = null;
      else {
        var i = e.tag;
        if (i === 13) {
          if (t = d(e), t !== null) return t;
          t = null;
        } else if (i === 31) {
          if (t = h(e), t !== null) return t;
          t = null;
        } else if (i === 3) {
          if (e.stateNode.current.memoizedState.isDehydrated)
            return e.tag === 3 ? e.stateNode.containerInfo : null;
          t = null;
        } else e !== t && (t = null);
      }
    }
    return Fs = t, null;
  }
  function ty(t) {
    switch (t) {
      case "beforetoggle":
      case "cancel":
      case "click":
      case "close":
      case "contextmenu":
      case "copy":
      case "cut":
      case "auxclick":
      case "dblclick":
      case "dragend":
      case "dragstart":
      case "drop":
      case "focusin":
      case "focusout":
      case "input":
      case "invalid":
      case "keydown":
      case "keypress":
      case "keyup":
      case "mousedown":
      case "mouseup":
      case "paste":
      case "pause":
      case "play":
      case "pointercancel":
      case "pointerdown":
      case "pointerup":
      case "ratechange":
      case "reset":
      case "resize":
      case "seeked":
      case "submit":
      case "toggle":
      case "touchcancel":
      case "touchend":
      case "touchstart":
      case "volumechange":
      case "change":
      case "selectionchange":
      case "textInput":
      case "compositionstart":
      case "compositionend":
      case "compositionupdate":
      case "beforeblur":
      case "afterblur":
      case "beforeinput":
      case "blur":
      case "fullscreenchange":
      case "focus":
      case "hashchange":
      case "popstate":
      case "select":
      case "selectstart":
        return 2;
      case "drag":
      case "dragenter":
      case "dragexit":
      case "dragleave":
      case "dragover":
      case "mousemove":
      case "mouseout":
      case "mouseover":
      case "pointermove":
      case "pointerout":
      case "pointerover":
      case "scroll":
      case "touchmove":
      case "wheel":
      case "mouseenter":
      case "mouseleave":
      case "pointerenter":
      case "pointerleave":
        return 8;
      case "message":
        switch (sa()) {
          case bn:
            return 2;
          case Kn:
            return 8;
          case Mi:
          case Gr:
            return 32;
          case ra:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var sf = !1, mi = null, vi = null, bi = null, Wl = /* @__PURE__ */ new Map(), Pl = /* @__PURE__ */ new Map(), xi = [], Kb = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function ey(t, e) {
    switch (t) {
      case "focusin":
      case "focusout":
        mi = null;
        break;
      case "dragenter":
      case "dragleave":
        vi = null;
        break;
      case "mouseover":
      case "mouseout":
        bi = null;
        break;
      case "pointerover":
      case "pointerout":
        Wl.delete(e.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        Pl.delete(e.pointerId);
    }
  }
  function to(t, e, i, l, r, c) {
    return t === null || t.nativeEvent !== c ? (t = {
      blockedOn: e,
      domEventName: i,
      eventSystemFlags: l,
      nativeEvent: c,
      targetContainers: [r]
    }, e !== null && (e = Jn(e), e !== null && Wp(e)), t) : (t.eventSystemFlags |= l, e = t.targetContainers, r !== null && e.indexOf(r) === -1 && e.push(r), t);
  }
  function $b(t, e, i, l, r) {
    switch (e) {
      case "focusin":
        return mi = to(
          mi,
          t,
          e,
          i,
          l,
          r
        ), !0;
      case "dragenter":
        return vi = to(
          vi,
          t,
          e,
          i,
          l,
          r
        ), !0;
      case "mouseover":
        return bi = to(
          bi,
          t,
          e,
          i,
          l,
          r
        ), !0;
      case "pointerover":
        var c = r.pointerId;
        return Wl.set(
          c,
          to(
            Wl.get(c) || null,
            t,
            e,
            i,
            l,
            r
          )
        ), !0;
      case "gotpointercapture":
        return c = r.pointerId, Pl.set(
          c,
          to(
            Pl.get(c) || null,
            t,
            e,
            i,
            l,
            r
          )
        ), !0;
    }
    return !1;
  }
  function ny(t) {
    var e = $n(t.target);
    if (e !== null) {
      var i = f(e);
      if (i !== null) {
        if (e = i.tag, e === 13) {
          if (e = d(i), e !== null) {
            t.blockedOn = e, Lo(t.priority, function() {
              Pp(i);
            });
            return;
          }
        } else if (e === 31) {
          if (e = h(i), e !== null) {
            t.blockedOn = e, Lo(t.priority, function() {
              Pp(i);
            });
            return;
          }
        } else if (e === 3 && i.stateNode.current.memoizedState.isDehydrated) {
          t.blockedOn = i.tag === 3 ? i.stateNode.containerInfo : null;
          return;
        }
      }
    }
    t.blockedOn = null;
  }
  function Is(t) {
    if (t.blockedOn !== null) return !1;
    for (var e = t.targetContainers; 0 < e.length; ) {
      var i = lf(t.nativeEvent);
      if (i === null) {
        i = t.nativeEvent;
        var l = new i.constructor(
          i.type,
          i
        );
        lu = l, i.target.dispatchEvent(l), lu = null;
      } else
        return e = Jn(i), e !== null && Wp(e), t.blockedOn = i, !1;
      e.shift();
    }
    return !0;
  }
  function iy(t, e, i) {
    Is(t) && i.delete(e);
  }
  function Jb() {
    sf = !1, mi !== null && Is(mi) && (mi = null), vi !== null && Is(vi) && (vi = null), bi !== null && Is(bi) && (bi = null), Wl.forEach(iy), Pl.forEach(iy);
  }
  function Ws(t, e) {
    t.blockedOn === e && (t.blockedOn = null, sf || (sf = !0, n.unstable_scheduleCallback(
      n.unstable_NormalPriority,
      Jb
    )));
  }
  var Ps = null;
  function ay(t) {
    Ps !== t && (Ps = t, n.unstable_scheduleCallback(
      n.unstable_NormalPriority,
      function() {
        Ps === t && (Ps = null);
        for (var e = 0; e < t.length; e += 3) {
          var i = t[e], l = t[e + 1], r = t[e + 2];
          if (typeof l != "function") {
            if (of(l || i) === null)
              continue;
            break;
          }
          var c = Jn(i);
          c !== null && (t.splice(e, 3), e -= 3, ac(
            c,
            {
              pending: !0,
              data: r,
              method: i.method,
              action: l
            },
            l,
            r
          ));
        }
      }
    ));
  }
  function $a(t) {
    function e(R) {
      return Ws(R, t);
    }
    mi !== null && Ws(mi, t), vi !== null && Ws(vi, t), bi !== null && Ws(bi, t), Wl.forEach(e), Pl.forEach(e);
    for (var i = 0; i < xi.length; i++) {
      var l = xi[i];
      l.blockedOn === t && (l.blockedOn = null);
    }
    for (; 0 < xi.length && (i = xi[0], i.blockedOn === null); )
      ny(i), i.blockedOn === null && xi.shift();
    if (i = (t.ownerDocument || t).$$reactFormReplay, i != null)
      for (l = 0; l < i.length; l += 3) {
        var r = i[l], c = i[l + 1], y = r[ge] || null;
        if (typeof c == "function")
          y || ay(i);
        else if (y) {
          var x = null;
          if (c && c.hasAttribute("formAction")) {
            if (r = c, y = c[ge] || null)
              x = y.formAction;
            else if (of(r) !== null) continue;
          } else x = y.action;
          typeof x == "function" ? i[l + 1] = x : (i.splice(l, 3), l -= 3), ay(i);
        }
      }
  }
  function ly() {
    function t(c) {
      c.canIntercept && c.info === "react-transition" && c.intercept({
        handler: function() {
          return new Promise(function(y) {
            return r = y;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function e() {
      r !== null && (r(), r = null), l || setTimeout(i, 20);
    }
    function i() {
      if (!l && !navigation.transition) {
        var c = navigation.currentEntry;
        c && c.url != null && navigation.navigate(c.url, {
          state: c.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var l = !1, r = null;
      return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(i, 100), function() {
        l = !0, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), r !== null && (r(), r = null);
      };
    }
  }
  function rf(t) {
    this._internalRoot = t;
  }
  tr.prototype.render = rf.prototype.render = function(t) {
    var e = this._internalRoot;
    if (e === null) throw Error(s(409));
    var i = e.current, l = Be();
    Fp(i, l, t, e, null, null);
  }, tr.prototype.unmount = rf.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var e = t.containerInfo;
      Fp(t.current, 2, null, t, null, null), Hs(), e[Sn] = null;
    }
  };
  function tr(t) {
    this._internalRoot = t;
  }
  tr.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var e = Bo();
      t = { blockedOn: null, target: t, priority: e };
      for (var i = 0; i < xi.length && e !== 0 && e < xi[i].priority; i++) ;
      xi.splice(i, 0, t), i === 0 && ny(t);
    }
  };
  var oy = a.version;
  if (oy !== "19.2.5")
    throw Error(
      s(
        527,
        oy,
        "19.2.5"
      )
    );
  H.findDOMNode = function(t) {
    var e = t._reactInternals;
    if (e === void 0)
      throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
    return t = g(e), t = t !== null ? m(t) : null, t = t === null ? null : t.stateNode, t;
  };
  var Fb = {
    bundleType: 0,
    version: "19.2.5",
    rendererPackageName: "react-dom",
    currentDispatcherRef: N,
    reconcilerVersion: "19.2.5"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var er = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!er.isDisabled && er.supportsFiber)
      try {
        zi = er.inject(
          Fb
        ), ye = er;
      } catch {
      }
  }
  return no.createRoot = function(t, e) {
    if (!u(t)) throw Error(s(299));
    var i = !1, l = "", r = hg, c = gg, y = pg;
    return e != null && (e.unstable_strictMode === !0 && (i = !0), e.identifierPrefix !== void 0 && (l = e.identifierPrefix), e.onUncaughtError !== void 0 && (r = e.onUncaughtError), e.onCaughtError !== void 0 && (c = e.onCaughtError), e.onRecoverableError !== void 0 && (y = e.onRecoverableError)), e = $p(
      t,
      1,
      !1,
      null,
      null,
      i,
      l,
      null,
      r,
      c,
      y,
      ly
    ), t[Sn] = e.current, Qc(t), new rf(e);
  }, no.hydrateRoot = function(t, e, i) {
    if (!u(t)) throw Error(s(299));
    var l = !1, r = "", c = hg, y = gg, x = pg, R = null;
    return i != null && (i.unstable_strictMode === !0 && (l = !0), i.identifierPrefix !== void 0 && (r = i.identifierPrefix), i.onUncaughtError !== void 0 && (c = i.onUncaughtError), i.onCaughtError !== void 0 && (y = i.onCaughtError), i.onRecoverableError !== void 0 && (x = i.onRecoverableError), i.formState !== void 0 && (R = i.formState)), e = $p(
      t,
      1,
      !0,
      e,
      i ?? null,
      l,
      r,
      R,
      c,
      y,
      x,
      ly
    ), e.context = Jp(null), i = e.current, l = Be(), l = ul(l), r = li(l), r.callback = null, oi(i, r, l), i = l, e.current.lanes = i, Di(e, i), dn(e), t[Sn] = e.current, Qc(t), new tr(e);
  }, no.version = "19.2.5", no;
}
var yy;
function ox() {
  if (yy) return ff.exports;
  yy = 1;
  function n() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
      } catch (a) {
        console.error(a);
      }
  }
  return n(), ff.exports = lx(), ff.exports;
}
var sx = ox(), No = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set(), this.subscribe = this.subscribe.bind(this);
  }
  subscribe(n) {
    return this.listeners.add(n), this.onSubscribe(), () => {
      this.listeners.delete(n), this.onUnsubscribe();
    };
  }
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {
  }
  onUnsubscribe() {
  }
}, rx = class extends No {
  #t;
  #e;
  #n;
  constructor() {
    super(), this.#n = (n) => {
      if (typeof window < "u" && window.addEventListener) {
        const a = () => n();
        return window.addEventListener("visibilitychange", a, !1), () => {
          window.removeEventListener("visibilitychange", a);
        };
      }
    };
  }
  onSubscribe() {
    this.#e || this.setEventListener(this.#n);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#e?.(), this.#e = void 0);
  }
  setEventListener(n) {
    this.#n = n, this.#e?.(), this.#e = n((a) => {
      typeof a == "boolean" ? this.setFocused(a) : this.onFocus();
    });
  }
  setFocused(n) {
    this.#t !== n && (this.#t = n, this.onFocus());
  }
  onFocus() {
    const n = this.isFocused();
    this.listeners.forEach((a) => {
      a(n);
    });
  }
  isFocused() {
    return typeof this.#t == "boolean" ? this.#t : globalThis.document?.visibilityState !== "hidden";
  }
}, nd = new rx(), ux = {
  // We need the wrapper function syntax below instead of direct references to
  // global setTimeout etc.
  //
  // BAD: `setTimeout: setTimeout`
  // GOOD: `setTimeout: (cb, delay) => setTimeout(cb, delay)`
  //
  // If we use direct references here, then anything that wants to spy on or
  // replace the global setTimeout (like tests) won't work since we'll already
  // have a hard reference to the original implementation at the time when this
  // file was imported.
  setTimeout: (n, a) => setTimeout(n, a),
  clearTimeout: (n) => clearTimeout(n),
  setInterval: (n, a) => setInterval(n, a),
  clearInterval: (n) => clearInterval(n)
}, cx = class {
  // We cannot have TimeoutManager<T> as we must instantiate it with a concrete
  // type at app boot; and if we leave that type, then any new timer provider
  // would need to support the default provider's concrete timer ID, which is
  // infeasible across environments.
  //
  // We settle for type safety for the TimeoutProvider type, and accept that
  // this class is unsafe internally to allow for extension.
  #t = ux;
  #e = !1;
  setTimeoutProvider(n) {
    this.#t = n;
  }
  setTimeout(n, a) {
    return this.#t.setTimeout(n, a);
  }
  clearTimeout(n) {
    this.#t.clearTimeout(n);
  }
  setInterval(n, a) {
    return this.#t.setInterval(n, a);
  }
  clearInterval(n) {
    this.#t.clearInterval(n);
  }
}, Pi = new cx();
function fx(n) {
  setTimeout(n, 0);
}
var dx = typeof window > "u" || "Deno" in globalThis;
function Ae() {
}
function hx(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function Df(n) {
  return typeof n == "number" && n >= 0 && n !== 1 / 0;
}
function K0(n, a) {
  return Math.max(n + (a || 0) - Date.now(), 0);
}
function Ci(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function $e(n, a) {
  return typeof n == "function" ? n(a) : n;
}
function my(n, a) {
  const {
    type: o = "all",
    exact: s,
    fetchStatus: u,
    predicate: f,
    queryKey: d,
    stale: h
  } = n;
  if (d) {
    if (s) {
      if (a.queryHash !== id(d, a.options))
        return !1;
    } else if (!ho(a.queryKey, d))
      return !1;
  }
  if (o !== "all") {
    const p = a.isActive();
    if (o === "active" && !p || o === "inactive" && p)
      return !1;
  }
  return !(typeof h == "boolean" && a.isStale() !== h || u && u !== a.state.fetchStatus || f && !f(a));
}
function vy(n, a) {
  const { exact: o, status: s, predicate: u, mutationKey: f } = n;
  if (f) {
    if (!a.options.mutationKey)
      return !1;
    if (o) {
      if (fo(a.options.mutationKey) !== fo(f))
        return !1;
    } else if (!ho(a.options.mutationKey, f))
      return !1;
  }
  return !(s && a.state.status !== s || u && !u(a));
}
function id(n, a) {
  return (a?.queryKeyHashFn || fo)(n);
}
function fo(n) {
  return JSON.stringify(
    n,
    (a, o) => Hf(o) ? Object.keys(o).sort().reduce((s, u) => (s[u] = o[u], s), {}) : o
  );
}
function ho(n, a) {
  return n === a ? !0 : typeof n != typeof a ? !1 : n && a && typeof n == "object" && typeof a == "object" ? Object.keys(a).every((o) => ho(n[o], a[o])) : !1;
}
var gx = Object.prototype.hasOwnProperty;
function $0(n, a, o = 0) {
  if (n === a)
    return n;
  if (o > 500) return a;
  const s = by(n) && by(a);
  if (!s && !(Hf(n) && Hf(a))) return a;
  const f = (s ? n : Object.keys(n)).length, d = s ? a : Object.keys(a), h = d.length, p = s ? new Array(h) : {};
  let g = 0;
  for (let m = 0; m < h; m++) {
    const v = s ? m : d[m], b = n[v], S = a[v];
    if (b === S) {
      p[v] = b, (s ? m < f : gx.call(n, v)) && g++;
      continue;
    }
    if (b === null || S === null || typeof b != "object" || typeof S != "object") {
      p[v] = S;
      continue;
    }
    const E = $0(b, S, o + 1);
    p[v] = E, E === b && g++;
  }
  return f === h && g === f ? n : p;
}
function Rf(n, a) {
  if (!a || Object.keys(n).length !== Object.keys(a).length)
    return !1;
  for (const o in n)
    if (n[o] !== a[o])
      return !1;
  return !0;
}
function by(n) {
  return Array.isArray(n) && n.length === Object.keys(n).length;
}
function Hf(n) {
  if (!xy(n))
    return !1;
  const a = n.constructor;
  if (a === void 0)
    return !0;
  const o = a.prototype;
  return !(!xy(o) || !o.hasOwnProperty("isPrototypeOf") || Object.getPrototypeOf(n) !== Object.prototype);
}
function xy(n) {
  return Object.prototype.toString.call(n) === "[object Object]";
}
function px(n) {
  return new Promise((a) => {
    Pi.setTimeout(a, n);
  });
}
function jf(n, a, o) {
  return typeof o.structuralSharing == "function" ? o.structuralSharing(n, a) : o.structuralSharing !== !1 ? $0(n, a) : a;
}
function yx(n, a, o = 0) {
  const s = [...n, a];
  return o && s.length > o ? s.slice(1) : s;
}
function mx(n, a, o = 0) {
  const s = [a, ...n];
  return o && s.length > o ? s.slice(0, -1) : s;
}
var ad = /* @__PURE__ */ Symbol();
function J0(n, a) {
  return !n.queryFn && a?.initialPromise ? () => a.initialPromise : !n.queryFn || n.queryFn === ad ? () => Promise.reject(new Error(`Missing queryFn: '${n.queryHash}'`)) : n.queryFn;
}
function F0(n, a) {
  return typeof n == "function" ? n(...a) : !!n;
}
function vx(n, a, o) {
  let s = !1, u;
  return Object.defineProperty(n, "signal", {
    enumerable: !0,
    get: () => (u ??= a(), s || (s = !0, u.aborted ? o() : u.addEventListener("abort", o, { once: !0 })), u)
  }), n;
}
var go = /* @__PURE__ */ (() => {
  let n = () => dx;
  return {
    /**
     * Returns whether the current runtime should be treated as a server environment.
     */
    isServer() {
      return n();
    },
    /**
     * Overrides the server check globally.
     */
    setIsServer(a) {
      n = a;
    }
  };
})();
function Uf() {
  let n, a;
  const o = new Promise((u, f) => {
    n = u, a = f;
  });
  o.status = "pending", o.catch(() => {
  });
  function s(u) {
    Object.assign(o, u), delete o.resolve, delete o.reject;
  }
  return o.resolve = (u) => {
    s({
      status: "fulfilled",
      value: u
    }), n(u);
  }, o.reject = (u) => {
    s({
      status: "rejected",
      reason: u
    }), a(u);
  }, o;
}
var bx = fx;
function xx() {
  let n = [], a = 0, o = (h) => {
    h();
  }, s = (h) => {
    h();
  }, u = bx;
  const f = (h) => {
    a ? n.push(h) : u(() => {
      o(h);
    });
  }, d = () => {
    const h = n;
    n = [], h.length && u(() => {
      s(() => {
        h.forEach((p) => {
          o(p);
        });
      });
    });
  };
  return {
    batch: (h) => {
      let p;
      a++;
      try {
        p = h();
      } finally {
        a--, a || d();
      }
      return p;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (h) => (...p) => {
      f(() => {
        h(...p);
      });
    },
    schedule: f,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (h) => {
      o = h;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * By default React Query will use the batch function provided by ReactDOM or React Native.
     */
    setBatchNotifyFunction: (h) => {
      s = h;
    },
    setScheduler: (h) => {
      u = h;
    }
  };
}
var he = xx(), Sx = class extends No {
  #t = !0;
  #e;
  #n;
  constructor() {
    super(), this.#n = (n) => {
      if (typeof window < "u" && window.addEventListener) {
        const a = () => n(!0), o = () => n(!1);
        return window.addEventListener("online", a, !1), window.addEventListener("offline", o, !1), () => {
          window.removeEventListener("online", a), window.removeEventListener("offline", o);
        };
      }
    };
  }
  onSubscribe() {
    this.#e || this.setEventListener(this.#n);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#e?.(), this.#e = void 0);
  }
  setEventListener(n) {
    this.#n = n, this.#e?.(), this.#e = n(this.setOnline.bind(this));
  }
  setOnline(n) {
    this.#t !== n && (this.#t = n, this.listeners.forEach((o) => {
      o(n);
    }));
  }
  isOnline() {
    return this.#t;
  }
}, vr = new Sx();
function wx(n) {
  return Math.min(1e3 * 2 ** n, 3e4);
}
function I0(n) {
  return (n ?? "online") === "online" ? vr.isOnline() : !0;
}
var Bf = class extends Error {
  constructor(n) {
    super("CancelledError"), this.revert = n?.revert, this.silent = n?.silent;
  }
};
function W0(n) {
  let a = !1, o = 0, s;
  const u = Uf(), f = () => u.status !== "pending", d = (A) => {
    if (!f()) {
      const _ = new Bf(A);
      b(_), n.onCancel?.(_);
    }
  }, h = () => {
    a = !0;
  }, p = () => {
    a = !1;
  }, g = () => nd.isFocused() && (n.networkMode === "always" || vr.isOnline()) && n.canRun(), m = () => I0(n.networkMode) && n.canRun(), v = (A) => {
    f() || (s?.(), u.resolve(A));
  }, b = (A) => {
    f() || (s?.(), u.reject(A));
  }, S = () => new Promise((A) => {
    s = (_) => {
      (f() || g()) && A(_);
    }, n.onPause?.();
  }).then(() => {
    s = void 0, f() || n.onContinue?.();
  }), E = () => {
    if (f())
      return;
    let A;
    const _ = o === 0 ? n.initialPromise : void 0;
    try {
      A = _ ?? n.fn();
    } catch (C) {
      A = Promise.reject(C);
    }
    Promise.resolve(A).then(v).catch((C) => {
      if (f())
        return;
      const D = n.retry ?? (go.isServer() ? 0 : 3), w = n.retryDelay ?? wx, z = typeof w == "function" ? w(o, C) : w, q = D === !0 || typeof D == "number" && o < D || typeof D == "function" && D(o, C);
      if (a || !q) {
        b(C);
        return;
      }
      o++, n.onFail?.(o, C), px(z).then(() => g() ? void 0 : S()).then(() => {
        a ? b(C) : E();
      });
    });
  };
  return {
    promise: u,
    status: () => u.status,
    cancel: d,
    continue: () => (s?.(), u),
    cancelRetry: h,
    continueRetry: p,
    canStart: m,
    start: () => (m() ? E() : S().then(E), u)
  };
}
var P0 = class {
  #t;
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout(), Df(this.gcTime) && (this.#t = Pi.setTimeout(() => {
      this.optionalRemove();
    }, this.gcTime));
  }
  updateGcTime(n) {
    this.gcTime = Math.max(
      this.gcTime || 0,
      n ?? (go.isServer() ? 1 / 0 : 300 * 1e3)
    );
  }
  clearGcTimeout() {
    this.#t !== void 0 && (Pi.clearTimeout(this.#t), this.#t = void 0);
  }
}, Ex = class extends P0 {
  #t;
  #e;
  #n;
  #a;
  #i;
  #o;
  #l;
  constructor(n) {
    super(), this.#l = !1, this.#o = n.defaultOptions, this.setOptions(n.options), this.observers = [], this.#a = n.client, this.#n = this.#a.getQueryCache(), this.queryKey = n.queryKey, this.queryHash = n.queryHash, this.#t = wy(this.options), this.state = n.state ?? this.#t, this.scheduleGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#i?.promise;
  }
  setOptions(n) {
    if (this.options = { ...this.#o, ...n }, this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
      const a = wy(this.options);
      a.data !== void 0 && (this.setState(
        Sy(a.data, a.dataUpdatedAt)
      ), this.#t = a);
    }
  }
  optionalRemove() {
    !this.observers.length && this.state.fetchStatus === "idle" && this.#n.remove(this);
  }
  setData(n, a) {
    const o = jf(this.state.data, n, this.options);
    return this.#r({
      data: o,
      type: "success",
      dataUpdatedAt: a?.updatedAt,
      manual: a?.manual
    }), o;
  }
  setState(n, a) {
    this.#r({ type: "setState", state: n, setStateOptions: a });
  }
  cancel(n) {
    const a = this.#i?.promise;
    return this.#i?.cancel(n), a ? a.then(Ae).catch(Ae) : Promise.resolve();
  }
  destroy() {
    super.destroy(), this.cancel({ silent: !0 });
  }
  get resetState() {
    return this.#t;
  }
  reset() {
    this.destroy(), this.setState(this.resetState);
  }
  isActive() {
    return this.observers.some(
      (n) => $e(n.options.enabled, this) !== !1
    );
  }
  isDisabled() {
    return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === ad || !this.isFetched();
  }
  isFetched() {
    return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
  }
  isStatic() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (n) => Ci(n.options.staleTime, this) === "static"
    ) : !1;
  }
  isStale() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (n) => n.getCurrentResult().isStale
    ) : this.state.data === void 0 || this.state.isInvalidated;
  }
  isStaleByTime(n = 0) {
    return this.state.data === void 0 ? !0 : n === "static" ? !1 : this.state.isInvalidated ? !0 : !K0(this.state.dataUpdatedAt, n);
  }
  onFocus() {
    this.observers.find((a) => a.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: !1 }), this.#i?.continue();
  }
  onOnline() {
    this.observers.find((a) => a.shouldFetchOnReconnect())?.refetch({ cancelRefetch: !1 }), this.#i?.continue();
  }
  addObserver(n) {
    this.observers.includes(n) || (this.observers.push(n), this.clearGcTimeout(), this.#n.notify({ type: "observerAdded", query: this, observer: n }));
  }
  removeObserver(n) {
    this.observers.includes(n) && (this.observers = this.observers.filter((a) => a !== n), this.observers.length || (this.#i && (this.#l || this.#s() ? this.#i.cancel({ revert: !0 }) : this.#i.cancelRetry()), this.scheduleGc()), this.#n.notify({ type: "observerRemoved", query: this, observer: n }));
  }
  getObserversCount() {
    return this.observers.length;
  }
  #s() {
    return this.state.fetchStatus === "paused" && this.state.status === "pending";
  }
  invalidate() {
    this.state.isInvalidated || this.#r({ type: "invalidate" });
  }
  async fetch(n, a) {
    if (this.state.fetchStatus !== "idle" && // If the promise in the retryer is already rejected, we have to definitely
    // re-start the fetch; there is a chance that the query is still in a
    // pending state when that happens
    this.#i?.status() !== "rejected") {
      if (this.state.data !== void 0 && a?.cancelRefetch)
        this.cancel({ silent: !0 });
      else if (this.#i)
        return this.#i.continueRetry(), this.#i.promise;
    }
    if (n && this.setOptions(n), !this.options.queryFn) {
      const h = this.observers.find((p) => p.options.queryFn);
      h && this.setOptions(h.options);
    }
    const o = new AbortController(), s = (h) => {
      Object.defineProperty(h, "signal", {
        enumerable: !0,
        get: () => (this.#l = !0, o.signal)
      });
    }, u = () => {
      const h = J0(this.options, a), g = (() => {
        const m = {
          client: this.#a,
          queryKey: this.queryKey,
          meta: this.meta
        };
        return s(m), m;
      })();
      return this.#l = !1, this.options.persister ? this.options.persister(
        h,
        g,
        this
      ) : h(g);
    }, d = (() => {
      const h = {
        fetchOptions: a,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#a,
        state: this.state,
        fetchFn: u
      };
      return s(h), h;
    })();
    this.options.behavior?.onFetch(d, this), this.#e = this.state, (this.state.fetchStatus === "idle" || this.state.fetchMeta !== d.fetchOptions?.meta) && this.#r({ type: "fetch", meta: d.fetchOptions?.meta }), this.#i = W0({
      initialPromise: a?.initialPromise,
      fn: d.fetchFn,
      onCancel: (h) => {
        h instanceof Bf && h.revert && this.setState({
          ...this.#e,
          fetchStatus: "idle"
        }), o.abort();
      },
      onFail: (h, p) => {
        this.#r({ type: "failed", failureCount: h, error: p });
      },
      onPause: () => {
        this.#r({ type: "pause" });
      },
      onContinue: () => {
        this.#r({ type: "continue" });
      },
      retry: d.options.retry,
      retryDelay: d.options.retryDelay,
      networkMode: d.options.networkMode,
      canRun: () => !0
    });
    try {
      const h = await this.#i.start();
      if (h === void 0)
        throw new Error(`${this.queryHash} data is undefined`);
      return this.setData(h), this.#n.config.onSuccess?.(h, this), this.#n.config.onSettled?.(
        h,
        this.state.error,
        this
      ), h;
    } catch (h) {
      if (h instanceof Bf) {
        if (h.silent)
          return this.#i.promise;
        if (h.revert) {
          if (this.state.data === void 0)
            throw h;
          return this.state.data;
        }
      }
      throw this.#r({
        type: "error",
        error: h
      }), this.#n.config.onError?.(
        h,
        this
      ), this.#n.config.onSettled?.(
        this.state.data,
        h,
        this
      ), h;
    } finally {
      this.scheduleGc();
    }
  }
  #r(n) {
    const a = (o) => {
      switch (n.type) {
        case "failed":
          return {
            ...o,
            fetchFailureCount: n.failureCount,
            fetchFailureReason: n.error
          };
        case "pause":
          return {
            ...o,
            fetchStatus: "paused"
          };
        case "continue":
          return {
            ...o,
            fetchStatus: "fetching"
          };
        case "fetch":
          return {
            ...o,
            ...tm(o.data, this.options),
            fetchMeta: n.meta ?? null
          };
        case "success":
          const s = {
            ...o,
            ...Sy(n.data, n.dataUpdatedAt),
            dataUpdateCount: o.dataUpdateCount + 1,
            ...!n.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          return this.#e = n.manual ? s : void 0, s;
        case "error":
          const u = n.error;
          return {
            ...o,
            error: u,
            errorUpdateCount: o.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: o.fetchFailureCount + 1,
            fetchFailureReason: u,
            fetchStatus: "idle",
            status: "error",
            // flag existing data as invalidated if we get a background error
            // note that "no data" always means stale so we can set unconditionally here
            isInvalidated: !0
          };
        case "invalidate":
          return {
            ...o,
            isInvalidated: !0
          };
        case "setState":
          return {
            ...o,
            ...n.state
          };
      }
    };
    this.state = a(this.state), he.batch(() => {
      this.observers.forEach((o) => {
        o.onQueryUpdate();
      }), this.#n.notify({ query: this, type: "updated", action: n });
    });
  }
};
function tm(n, a) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: I0(a.networkMode) ? "fetching" : "paused",
    ...n === void 0 && {
      error: null,
      status: "pending"
    }
  };
}
function Sy(n, a) {
  return {
    data: n,
    dataUpdatedAt: a ?? Date.now(),
    error: null,
    isInvalidated: !1,
    status: "success"
  };
}
function wy(n) {
  const a = typeof n.initialData == "function" ? n.initialData() : n.initialData, o = a !== void 0, s = o ? typeof n.initialDataUpdatedAt == "function" ? n.initialDataUpdatedAt() : n.initialDataUpdatedAt : 0;
  return {
    data: a,
    dataUpdateCount: 0,
    dataUpdatedAt: o ? s ?? Date.now() : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: !1,
    status: o ? "success" : "pending",
    fetchStatus: "idle"
  };
}
var _x = class extends No {
  constructor(n, a) {
    super(), this.options = a, this.#t = n, this.#s = null, this.#l = Uf(), this.bindMethods(), this.setOptions(a);
  }
  #t;
  #e = void 0;
  #n = void 0;
  #a = void 0;
  #i;
  #o;
  #l;
  #s;
  #r;
  #h;
  // This property keeps track of the last query with defined data.
  // It will be used to pass the previous data and query to the placeholder function between renders.
  #g;
  #c;
  #f;
  #u;
  #p = /* @__PURE__ */ new Set();
  bindMethods() {
    this.refetch = this.refetch.bind(this);
  }
  onSubscribe() {
    this.listeners.size === 1 && (this.#e.addObserver(this), Ey(this.#e, this.options) ? this.#d() : this.updateResult(), this.#b());
  }
  onUnsubscribe() {
    this.hasListeners() || this.destroy();
  }
  shouldFetchOnReconnect() {
    return Lf(
      this.#e,
      this.options,
      this.options.refetchOnReconnect
    );
  }
  shouldFetchOnWindowFocus() {
    return Lf(
      this.#e,
      this.options,
      this.options.refetchOnWindowFocus
    );
  }
  destroy() {
    this.listeners = /* @__PURE__ */ new Set(), this.#x(), this.#S(), this.#e.removeObserver(this);
  }
  setOptions(n) {
    const a = this.options, o = this.#e;
    if (this.options = this.#t.defaultQueryOptions(n), this.options.enabled !== void 0 && typeof this.options.enabled != "boolean" && typeof this.options.enabled != "function" && typeof $e(this.options.enabled, this.#e) != "boolean")
      throw new Error(
        "Expected enabled to be a boolean or a callback that returns a boolean"
      );
    this.#w(), this.#e.setOptions(this.options), a._defaulted && !Rf(this.options, a) && this.#t.getQueryCache().notify({
      type: "observerOptionsUpdated",
      query: this.#e,
      observer: this
    });
    const s = this.hasListeners();
    s && _y(
      this.#e,
      o,
      this.options,
      a
    ) && this.#d(), this.updateResult(), s && (this.#e !== o || $e(this.options.enabled, this.#e) !== $e(a.enabled, this.#e) || Ci(this.options.staleTime, this.#e) !== Ci(a.staleTime, this.#e)) && this.#y();
    const u = this.#m();
    s && (this.#e !== o || $e(this.options.enabled, this.#e) !== $e(a.enabled, this.#e) || u !== this.#u) && this.#v(u);
  }
  getOptimisticResult(n) {
    const a = this.#t.getQueryCache().build(this.#t, n), o = this.createResult(a, n);
    return Nx(this, o) && (this.#a = o, this.#o = this.options, this.#i = this.#e.state), o;
  }
  getCurrentResult() {
    return this.#a;
  }
  trackResult(n, a) {
    return new Proxy(n, {
      get: (o, s) => (this.trackProp(s), a?.(s), s === "promise" && (this.trackProp("data"), !this.options.experimental_prefetchInRender && this.#l.status === "pending" && this.#l.reject(
        new Error(
          "experimental_prefetchInRender feature flag is not enabled"
        )
      )), Reflect.get(o, s))
    });
  }
  trackProp(n) {
    this.#p.add(n);
  }
  getCurrentQuery() {
    return this.#e;
  }
  refetch({ ...n } = {}) {
    return this.fetch({
      ...n
    });
  }
  fetchOptimistic(n) {
    const a = this.#t.defaultQueryOptions(n), o = this.#t.getQueryCache().build(this.#t, a);
    return o.fetch().then(() => this.createResult(o, a));
  }
  fetch(n) {
    return this.#d({
      ...n,
      cancelRefetch: n.cancelRefetch ?? !0
    }).then(() => (this.updateResult(), this.#a));
  }
  #d(n) {
    this.#w();
    let a = this.#e.fetch(
      this.options,
      n
    );
    return n?.throwOnError || (a = a.catch(Ae)), a;
  }
  #y() {
    this.#x();
    const n = Ci(
      this.options.staleTime,
      this.#e
    );
    if (go.isServer() || this.#a.isStale || !Df(n))
      return;
    const o = K0(this.#a.dataUpdatedAt, n) + 1;
    this.#c = Pi.setTimeout(() => {
      this.#a.isStale || this.updateResult();
    }, o);
  }
  #m() {
    return (typeof this.options.refetchInterval == "function" ? this.options.refetchInterval(this.#e) : this.options.refetchInterval) ?? !1;
  }
  #v(n) {
    this.#S(), this.#u = n, !(go.isServer() || $e(this.options.enabled, this.#e) === !1 || !Df(this.#u) || this.#u === 0) && (this.#f = Pi.setInterval(() => {
      (this.options.refetchIntervalInBackground || nd.isFocused()) && this.#d();
    }, this.#u));
  }
  #b() {
    this.#y(), this.#v(this.#m());
  }
  #x() {
    this.#c !== void 0 && (Pi.clearTimeout(this.#c), this.#c = void 0);
  }
  #S() {
    this.#f !== void 0 && (Pi.clearInterval(this.#f), this.#f = void 0);
  }
  createResult(n, a) {
    const o = this.#e, s = this.options, u = this.#a, f = this.#i, d = this.#o, p = n !== o ? n.state : this.#n, { state: g } = n;
    let m = { ...g }, v = !1, b;
    if (a._optimisticResults) {
      const Q = this.hasListeners(), Z = !Q && Ey(n, a), ot = Q && _y(n, o, a, s);
      (Z || ot) && (m = {
        ...m,
        ...tm(g.data, n.options)
      }), a._optimisticResults === "isRestoring" && (m.fetchStatus = "idle");
    }
    let { error: S, errorUpdatedAt: E, status: A } = m;
    b = m.data;
    let _ = !1;
    if (a.placeholderData !== void 0 && b === void 0 && A === "pending") {
      let Q;
      u?.isPlaceholderData && a.placeholderData === d?.placeholderData ? (Q = u.data, _ = !0) : Q = typeof a.placeholderData == "function" ? a.placeholderData(
        this.#g?.state.data,
        this.#g
      ) : a.placeholderData, Q !== void 0 && (A = "success", b = jf(
        u?.data,
        Q,
        a
      ), v = !0);
    }
    if (a.select && b !== void 0 && !_)
      if (u && b === f?.data && a.select === this.#r)
        b = this.#h;
      else
        try {
          this.#r = a.select, b = a.select(b), b = jf(u?.data, b, a), this.#h = b, this.#s = null;
        } catch (Q) {
          this.#s = Q;
        }
    this.#s && (S = this.#s, b = this.#h, E = Date.now(), A = "error");
    const C = m.fetchStatus === "fetching", D = A === "pending", w = A === "error", z = D && C, q = b !== void 0, U = {
      status: A,
      fetchStatus: m.fetchStatus,
      isPending: D,
      isSuccess: A === "success",
      isError: w,
      isInitialLoading: z,
      isLoading: z,
      data: b,
      dataUpdatedAt: m.dataUpdatedAt,
      error: S,
      errorUpdatedAt: E,
      failureCount: m.fetchFailureCount,
      failureReason: m.fetchFailureReason,
      errorUpdateCount: m.errorUpdateCount,
      isFetched: n.isFetched(),
      isFetchedAfterMount: m.dataUpdateCount > p.dataUpdateCount || m.errorUpdateCount > p.errorUpdateCount,
      isFetching: C,
      isRefetching: C && !D,
      isLoadingError: w && !q,
      isPaused: m.fetchStatus === "paused",
      isPlaceholderData: v,
      isRefetchError: w && q,
      isStale: ld(n, a),
      refetch: this.refetch,
      promise: this.#l,
      isEnabled: $e(a.enabled, n) !== !1
    };
    if (this.options.experimental_prefetchInRender) {
      const Q = U.data !== void 0, Z = U.status === "error" && !Q, ot = (it) => {
        Z ? it.reject(U.error) : Q && it.resolve(U.data);
      }, X = () => {
        const it = this.#l = U.promise = Uf();
        ot(it);
      }, k = this.#l;
      switch (k.status) {
        case "pending":
          n.queryHash === o.queryHash && ot(k);
          break;
        case "fulfilled":
          (Z || U.data !== k.value) && X();
          break;
        case "rejected":
          (!Z || U.error !== k.reason) && X();
          break;
      }
    }
    return U;
  }
  updateResult() {
    const n = this.#a, a = this.createResult(this.#e, this.options);
    if (this.#i = this.#e.state, this.#o = this.options, this.#i.data !== void 0 && (this.#g = this.#e), Rf(a, n))
      return;
    this.#a = a;
    const o = () => {
      if (!n)
        return !0;
      const { notifyOnChangeProps: s } = this.options, u = typeof s == "function" ? s() : s;
      if (u === "all" || !u && !this.#p.size)
        return !0;
      const f = new Set(
        u ?? this.#p
      );
      return this.options.throwOnError && f.add("error"), Object.keys(this.#a).some((d) => {
        const h = d;
        return this.#a[h] !== n[h] && f.has(h);
      });
    };
    this.#E({ listeners: o() });
  }
  #w() {
    const n = this.#t.getQueryCache().build(this.#t, this.options);
    if (n === this.#e)
      return;
    const a = this.#e;
    this.#e = n, this.#n = n.state, this.hasListeners() && (a?.removeObserver(this), n.addObserver(this));
  }
  onQueryUpdate() {
    this.updateResult(), this.hasListeners() && this.#b();
  }
  #E(n) {
    he.batch(() => {
      n.listeners && this.listeners.forEach((a) => {
        a(this.#a);
      }), this.#t.getQueryCache().notify({
        query: this.#e,
        type: "observerResultsUpdated"
      });
    });
  }
};
function Cx(n, a) {
  return $e(a.enabled, n) !== !1 && n.state.data === void 0 && !(n.state.status === "error" && a.retryOnMount === !1);
}
function Ey(n, a) {
  return Cx(n, a) || n.state.data !== void 0 && Lf(n, a, a.refetchOnMount);
}
function Lf(n, a, o) {
  if ($e(a.enabled, n) !== !1 && Ci(a.staleTime, n) !== "static") {
    const s = typeof o == "function" ? o(n) : o;
    return s === "always" || s !== !1 && ld(n, a);
  }
  return !1;
}
function _y(n, a, o, s) {
  return (n !== a || $e(s.enabled, n) === !1) && (!o.suspense || n.state.status !== "error") && ld(n, o);
}
function ld(n, a) {
  return $e(a.enabled, n) !== !1 && n.isStaleByTime(Ci(a.staleTime, n));
}
function Nx(n, a) {
  return !Rf(n.getCurrentResult(), a);
}
function Cy(n) {
  return {
    onFetch: (a, o) => {
      const s = a.options, u = a.fetchOptions?.meta?.fetchMore?.direction, f = a.state.data?.pages || [], d = a.state.data?.pageParams || [];
      let h = { pages: [], pageParams: [] }, p = 0;
      const g = async () => {
        let m = !1;
        const v = (E) => {
          vx(
            E,
            () => a.signal,
            () => m = !0
          );
        }, b = J0(a.options, a.fetchOptions), S = async (E, A, _) => {
          if (m)
            return Promise.reject();
          if (A == null && E.pages.length)
            return Promise.resolve(E);
          const D = (() => {
            const B = {
              client: a.client,
              queryKey: a.queryKey,
              pageParam: A,
              direction: _ ? "backward" : "forward",
              meta: a.options.meta
            };
            return v(B), B;
          })(), w = await b(D), { maxPages: z } = a.options, q = _ ? mx : yx;
          return {
            pages: q(E.pages, w, z),
            pageParams: q(E.pageParams, A, z)
          };
        };
        if (u && f.length) {
          const E = u === "backward", A = E ? Tx : Ny, _ = {
            pages: f,
            pageParams: d
          }, C = A(s, _);
          h = await S(_, C, E);
        } else {
          const E = n ?? f.length;
          do {
            const A = p === 0 ? d[0] ?? s.initialPageParam : Ny(s, h);
            if (p > 0 && A == null)
              break;
            h = await S(h, A), p++;
          } while (p < E);
        }
        return h;
      };
      a.options.persister ? a.fetchFn = () => a.options.persister?.(
        g,
        {
          client: a.client,
          queryKey: a.queryKey,
          meta: a.options.meta,
          signal: a.signal
        },
        o
      ) : a.fetchFn = g;
    }
  };
}
function Ny(n, { pages: a, pageParams: o }) {
  const s = a.length - 1;
  return a.length > 0 ? n.getNextPageParam(
    a[s],
    a,
    o[s],
    o
  ) : void 0;
}
function Tx(n, { pages: a, pageParams: o }) {
  return a.length > 0 ? n.getPreviousPageParam?.(a[0], a, o[0], o) : void 0;
}
var Ax = class extends P0 {
  #t;
  #e;
  #n;
  #a;
  constructor(n) {
    super(), this.#t = n.client, this.mutationId = n.mutationId, this.#n = n.mutationCache, this.#e = [], this.state = n.state || Mx(), this.setOptions(n.options), this.scheduleGc();
  }
  setOptions(n) {
    this.options = n, this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  addObserver(n) {
    this.#e.includes(n) || (this.#e.push(n), this.clearGcTimeout(), this.#n.notify({
      type: "observerAdded",
      mutation: this,
      observer: n
    }));
  }
  removeObserver(n) {
    this.#e = this.#e.filter((a) => a !== n), this.scheduleGc(), this.#n.notify({
      type: "observerRemoved",
      mutation: this,
      observer: n
    });
  }
  optionalRemove() {
    this.#e.length || (this.state.status === "pending" ? this.scheduleGc() : this.#n.remove(this));
  }
  continue() {
    return this.#a?.continue() ?? // continuing a mutation assumes that variables are set, mutation must have been dehydrated before
    this.execute(this.state.variables);
  }
  async execute(n) {
    const a = () => {
      this.#i({ type: "continue" });
    }, o = {
      client: this.#t,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#a = W0({
      fn: () => this.options.mutationFn ? this.options.mutationFn(n, o) : Promise.reject(new Error("No mutationFn found")),
      onFail: (f, d) => {
        this.#i({ type: "failed", failureCount: f, error: d });
      },
      onPause: () => {
        this.#i({ type: "pause" });
      },
      onContinue: a,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#n.canRun(this)
    });
    const s = this.state.status === "pending", u = !this.#a.canStart();
    try {
      if (s)
        a();
      else {
        this.#i({ type: "pending", variables: n, isPaused: u }), this.#n.config.onMutate && await this.#n.config.onMutate(
          n,
          this,
          o
        );
        const d = await this.options.onMutate?.(
          n,
          o
        );
        d !== this.state.context && this.#i({
          type: "pending",
          context: d,
          variables: n,
          isPaused: u
        });
      }
      const f = await this.#a.start();
      return await this.#n.config.onSuccess?.(
        f,
        n,
        this.state.context,
        this,
        o
      ), await this.options.onSuccess?.(
        f,
        n,
        this.state.context,
        o
      ), await this.#n.config.onSettled?.(
        f,
        null,
        this.state.variables,
        this.state.context,
        this,
        o
      ), await this.options.onSettled?.(
        f,
        null,
        n,
        this.state.context,
        o
      ), this.#i({ type: "success", data: f }), f;
    } catch (f) {
      try {
        await this.#n.config.onError?.(
          f,
          n,
          this.state.context,
          this,
          o
        );
      } catch (d) {
        Promise.reject(d);
      }
      try {
        await this.options.onError?.(
          f,
          n,
          this.state.context,
          o
        );
      } catch (d) {
        Promise.reject(d);
      }
      try {
        await this.#n.config.onSettled?.(
          void 0,
          f,
          this.state.variables,
          this.state.context,
          this,
          o
        );
      } catch (d) {
        Promise.reject(d);
      }
      try {
        await this.options.onSettled?.(
          void 0,
          f,
          n,
          this.state.context,
          o
        );
      } catch (d) {
        Promise.reject(d);
      }
      throw this.#i({ type: "error", error: f }), f;
    } finally {
      this.#n.runNext(this);
    }
  }
  #i(n) {
    const a = (o) => {
      switch (n.type) {
        case "failed":
          return {
            ...o,
            failureCount: n.failureCount,
            failureReason: n.error
          };
        case "pause":
          return {
            ...o,
            isPaused: !0
          };
        case "continue":
          return {
            ...o,
            isPaused: !1
          };
        case "pending":
          return {
            ...o,
            context: n.context,
            data: void 0,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: n.isPaused,
            status: "pending",
            variables: n.variables,
            submittedAt: Date.now()
          };
        case "success":
          return {
            ...o,
            data: n.data,
            failureCount: 0,
            failureReason: null,
            error: null,
            status: "success",
            isPaused: !1
          };
        case "error":
          return {
            ...o,
            data: void 0,
            error: n.error,
            failureCount: o.failureCount + 1,
            failureReason: n.error,
            isPaused: !1,
            status: "error"
          };
      }
    };
    this.state = a(this.state), he.batch(() => {
      this.#e.forEach((o) => {
        o.onMutationUpdate(n);
      }), this.#n.notify({
        mutation: this,
        type: "updated",
        action: n
      });
    });
  }
};
function Mx() {
  return {
    context: void 0,
    data: void 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: !1,
    status: "idle",
    variables: void 0,
    submittedAt: 0
  };
}
var zx = class extends No {
  constructor(n = {}) {
    super(), this.config = n, this.#t = /* @__PURE__ */ new Set(), this.#e = /* @__PURE__ */ new Map(), this.#n = 0;
  }
  #t;
  #e;
  #n;
  build(n, a, o) {
    const s = new Ax({
      client: n,
      mutationCache: this,
      mutationId: ++this.#n,
      options: n.defaultMutationOptions(a),
      state: o
    });
    return this.add(s), s;
  }
  add(n) {
    this.#t.add(n);
    const a = nr(n);
    if (typeof a == "string") {
      const o = this.#e.get(a);
      o ? o.push(n) : this.#e.set(a, [n]);
    }
    this.notify({ type: "added", mutation: n });
  }
  remove(n) {
    if (this.#t.delete(n)) {
      const a = nr(n);
      if (typeof a == "string") {
        const o = this.#e.get(a);
        if (o)
          if (o.length > 1) {
            const s = o.indexOf(n);
            s !== -1 && o.splice(s, 1);
          } else o[0] === n && this.#e.delete(a);
      }
    }
    this.notify({ type: "removed", mutation: n });
  }
  canRun(n) {
    const a = nr(n);
    if (typeof a == "string") {
      const s = this.#e.get(a)?.find(
        (u) => u.state.status === "pending"
      );
      return !s || s === n;
    } else
      return !0;
  }
  runNext(n) {
    const a = nr(n);
    return typeof a == "string" ? this.#e.get(a)?.find((s) => s !== n && s.state.isPaused)?.continue() ?? Promise.resolve() : Promise.resolve();
  }
  clear() {
    he.batch(() => {
      this.#t.forEach((n) => {
        this.notify({ type: "removed", mutation: n });
      }), this.#t.clear(), this.#e.clear();
    });
  }
  getAll() {
    return Array.from(this.#t);
  }
  find(n) {
    const a = { exact: !0, ...n };
    return this.getAll().find(
      (o) => vy(a, o)
    );
  }
  findAll(n = {}) {
    return this.getAll().filter((a) => vy(n, a));
  }
  notify(n) {
    he.batch(() => {
      this.listeners.forEach((a) => {
        a(n);
      });
    });
  }
  resumePausedMutations() {
    const n = this.getAll().filter((a) => a.state.isPaused);
    return he.batch(
      () => Promise.all(
        n.map((a) => a.continue().catch(Ae))
      )
    );
  }
};
function nr(n) {
  return n.options.scope?.id;
}
var Ox = class extends No {
  constructor(n = {}) {
    super(), this.config = n, this.#t = /* @__PURE__ */ new Map();
  }
  #t;
  build(n, a, o) {
    const s = a.queryKey, u = a.queryHash ?? id(s, a);
    let f = this.get(u);
    return f || (f = new Ex({
      client: n,
      queryKey: s,
      queryHash: u,
      options: n.defaultQueryOptions(a),
      state: o,
      defaultOptions: n.getQueryDefaults(s)
    }), this.add(f)), f;
  }
  add(n) {
    this.#t.has(n.queryHash) || (this.#t.set(n.queryHash, n), this.notify({
      type: "added",
      query: n
    }));
  }
  remove(n) {
    const a = this.#t.get(n.queryHash);
    a && (n.destroy(), a === n && this.#t.delete(n.queryHash), this.notify({ type: "removed", query: n }));
  }
  clear() {
    he.batch(() => {
      this.getAll().forEach((n) => {
        this.remove(n);
      });
    });
  }
  get(n) {
    return this.#t.get(n);
  }
  getAll() {
    return [...this.#t.values()];
  }
  find(n) {
    const a = { exact: !0, ...n };
    return this.getAll().find(
      (o) => my(a, o)
    );
  }
  findAll(n = {}) {
    const a = this.getAll();
    return Object.keys(n).length > 0 ? a.filter((o) => my(n, o)) : a;
  }
  notify(n) {
    he.batch(() => {
      this.listeners.forEach((a) => {
        a(n);
      });
    });
  }
  onFocus() {
    he.batch(() => {
      this.getAll().forEach((n) => {
        n.onFocus();
      });
    });
  }
  onOnline() {
    he.batch(() => {
      this.getAll().forEach((n) => {
        n.onOnline();
      });
    });
  }
}, Dx = class {
  #t;
  #e;
  #n;
  #a;
  #i;
  #o;
  #l;
  #s;
  constructor(n = {}) {
    this.#t = n.queryCache || new Ox(), this.#e = n.mutationCache || new zx(), this.#n = n.defaultOptions || {}, this.#a = /* @__PURE__ */ new Map(), this.#i = /* @__PURE__ */ new Map(), this.#o = 0;
  }
  mount() {
    this.#o++, this.#o === 1 && (this.#l = nd.subscribe(async (n) => {
      n && (await this.resumePausedMutations(), this.#t.onFocus());
    }), this.#s = vr.subscribe(async (n) => {
      n && (await this.resumePausedMutations(), this.#t.onOnline());
    }));
  }
  unmount() {
    this.#o--, this.#o === 0 && (this.#l?.(), this.#l = void 0, this.#s?.(), this.#s = void 0);
  }
  isFetching(n) {
    return this.#t.findAll({ ...n, fetchStatus: "fetching" }).length;
  }
  isMutating(n) {
    return this.#e.findAll({ ...n, status: "pending" }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   */
  getQueryData(n) {
    const a = this.defaultQueryOptions({ queryKey: n });
    return this.#t.get(a.queryHash)?.state.data;
  }
  ensureQueryData(n) {
    const a = this.defaultQueryOptions(n), o = this.#t.build(this, a), s = o.state.data;
    return s === void 0 ? this.fetchQuery(n) : (n.revalidateIfStale && o.isStaleByTime(Ci(a.staleTime, o)) && this.prefetchQuery(a), Promise.resolve(s));
  }
  getQueriesData(n) {
    return this.#t.findAll(n).map(({ queryKey: a, state: o }) => {
      const s = o.data;
      return [a, s];
    });
  }
  setQueryData(n, a, o) {
    const s = this.defaultQueryOptions({ queryKey: n }), f = this.#t.get(
      s.queryHash
    )?.state.data, d = hx(a, f);
    if (d !== void 0)
      return this.#t.build(this, s).setData(d, { ...o, manual: !0 });
  }
  setQueriesData(n, a, o) {
    return he.batch(
      () => this.#t.findAll(n).map(({ queryKey: s }) => [
        s,
        this.setQueryData(s, a, o)
      ])
    );
  }
  getQueryState(n) {
    const a = this.defaultQueryOptions({ queryKey: n });
    return this.#t.get(
      a.queryHash
    )?.state;
  }
  removeQueries(n) {
    const a = this.#t;
    he.batch(() => {
      a.findAll(n).forEach((o) => {
        a.remove(o);
      });
    });
  }
  resetQueries(n, a) {
    const o = this.#t;
    return he.batch(() => (o.findAll(n).forEach((s) => {
      s.reset();
    }), this.refetchQueries(
      {
        type: "active",
        ...n
      },
      a
    )));
  }
  cancelQueries(n, a = {}) {
    const o = { revert: !0, ...a }, s = he.batch(
      () => this.#t.findAll(n).map((u) => u.cancel(o))
    );
    return Promise.all(s).then(Ae).catch(Ae);
  }
  invalidateQueries(n, a = {}) {
    return he.batch(() => (this.#t.findAll(n).forEach((o) => {
      o.invalidate();
    }), n?.refetchType === "none" ? Promise.resolve() : this.refetchQueries(
      {
        ...n,
        type: n?.refetchType ?? n?.type ?? "active"
      },
      a
    )));
  }
  refetchQueries(n, a = {}) {
    const o = {
      ...a,
      cancelRefetch: a.cancelRefetch ?? !0
    }, s = he.batch(
      () => this.#t.findAll(n).filter((u) => !u.isDisabled() && !u.isStatic()).map((u) => {
        let f = u.fetch(void 0, o);
        return o.throwOnError || (f = f.catch(Ae)), u.state.fetchStatus === "paused" ? Promise.resolve() : f;
      })
    );
    return Promise.all(s).then(Ae);
  }
  fetchQuery(n) {
    const a = this.defaultQueryOptions(n);
    a.retry === void 0 && (a.retry = !1);
    const o = this.#t.build(this, a);
    return o.isStaleByTime(
      Ci(a.staleTime, o)
    ) ? o.fetch(a) : Promise.resolve(o.state.data);
  }
  prefetchQuery(n) {
    return this.fetchQuery(n).then(Ae).catch(Ae);
  }
  fetchInfiniteQuery(n) {
    return n.behavior = Cy(n.pages), this.fetchQuery(n);
  }
  prefetchInfiniteQuery(n) {
    return this.fetchInfiniteQuery(n).then(Ae).catch(Ae);
  }
  ensureInfiniteQueryData(n) {
    return n.behavior = Cy(n.pages), this.ensureQueryData(n);
  }
  resumePausedMutations() {
    return vr.isOnline() ? this.#e.resumePausedMutations() : Promise.resolve();
  }
  getQueryCache() {
    return this.#t;
  }
  getMutationCache() {
    return this.#e;
  }
  getDefaultOptions() {
    return this.#n;
  }
  setDefaultOptions(n) {
    this.#n = n;
  }
  setQueryDefaults(n, a) {
    this.#a.set(fo(n), {
      queryKey: n,
      defaultOptions: a
    });
  }
  getQueryDefaults(n) {
    const a = [...this.#a.values()], o = {};
    return a.forEach((s) => {
      ho(n, s.queryKey) && Object.assign(o, s.defaultOptions);
    }), o;
  }
  setMutationDefaults(n, a) {
    this.#i.set(fo(n), {
      mutationKey: n,
      defaultOptions: a
    });
  }
  getMutationDefaults(n) {
    const a = [...this.#i.values()], o = {};
    return a.forEach((s) => {
      ho(n, s.mutationKey) && Object.assign(o, s.defaultOptions);
    }), o;
  }
  defaultQueryOptions(n) {
    if (n._defaulted)
      return n;
    const a = {
      ...this.#n.queries,
      ...this.getQueryDefaults(n.queryKey),
      ...n,
      _defaulted: !0
    };
    return a.queryHash || (a.queryHash = id(
      a.queryKey,
      a
    )), a.refetchOnReconnect === void 0 && (a.refetchOnReconnect = a.networkMode !== "always"), a.throwOnError === void 0 && (a.throwOnError = !!a.suspense), !a.networkMode && a.persister && (a.networkMode = "offlineFirst"), a.queryFn === ad && (a.enabled = !1), a;
  }
  defaultMutationOptions(n) {
    return n?._defaulted ? n : {
      ...this.#n.mutations,
      ...n?.mutationKey && this.getMutationDefaults(n.mutationKey),
      ...n,
      _defaulted: !0
    };
  }
  clear() {
    this.#t.clear(), this.#e.clear();
  }
}, em = F.createContext(
  void 0
), Rx = (n) => {
  const a = F.useContext(em);
  if (!a)
    throw new Error("No QueryClient set, use QueryClientProvider to set one");
  return a;
}, Hx = ({
  client: n,
  children: a
}) => (F.useEffect(() => (n.mount(), () => {
  n.unmount();
}), [n]), /* @__PURE__ */ M.jsx(em.Provider, { value: n, children: a })), nm = F.createContext(!1), jx = () => F.useContext(nm);
nm.Provider;
function Ux() {
  let n = !1;
  return {
    clearReset: () => {
      n = !1;
    },
    reset: () => {
      n = !0;
    },
    isReset: () => n
  };
}
var Bx = F.createContext(Ux()), Lx = () => F.useContext(Bx), qx = (n, a, o) => {
  const s = o?.state.error && typeof n.throwOnError == "function" ? F0(n.throwOnError, [o.state.error, o]) : n.throwOnError;
  (n.suspense || n.experimental_prefetchInRender || s) && (a.isReset() || (n.retryOnMount = !1));
}, Yx = (n) => {
  F.useEffect(() => {
    n.clearReset();
  }, [n]);
}, Vx = ({
  result: n,
  errorResetBoundary: a,
  throwOnError: o,
  query: s,
  suspense: u
}) => n.isError && !a.isReset() && !n.isFetching && s && (u && n.data === void 0 || F0(o, [n.error, s])), Qx = (n) => {
  if (n.suspense) {
    const o = (u) => u === "static" ? u : Math.max(u ?? 1e3, 1e3), s = n.staleTime;
    n.staleTime = typeof s == "function" ? (...u) => o(s(...u)) : o(s), typeof n.gcTime == "number" && (n.gcTime = Math.max(
      n.gcTime,
      1e3
    ));
  }
}, Xx = (n, a) => n.isLoading && n.isFetching && !a, kx = (n, a) => n?.suspense && a.isPending, Ty = (n, a, o) => a.fetchOptimistic(n).catch(() => {
  o.clearReset();
});
function Gx(n, a, o) {
  const s = jx(), u = Lx(), f = Rx(), d = f.defaultQueryOptions(n);
  f.getDefaultOptions().queries?._experimental_beforeQuery?.(
    d
  );
  const h = f.getQueryCache().get(d.queryHash);
  d._optimisticResults = s ? "isRestoring" : "optimistic", Qx(d), qx(d, u, h), Yx(u);
  const p = !f.getQueryCache().get(d.queryHash), [g] = F.useState(
    () => new a(
      f,
      d
    )
  ), m = g.getOptimisticResult(d), v = !s && n.subscribed !== !1;
  if (F.useSyncExternalStore(
    F.useCallback(
      (b) => {
        const S = v ? g.subscribe(he.batchCalls(b)) : Ae;
        return g.updateResult(), S;
      },
      [g, v]
    ),
    () => g.getCurrentResult(),
    () => g.getCurrentResult()
  ), F.useEffect(() => {
    g.setOptions(d);
  }, [d, g]), kx(d, m))
    throw Ty(d, g, u);
  if (Vx({
    result: m,
    errorResetBoundary: u,
    throwOnError: d.throwOnError,
    query: h,
    suspense: d.suspense
  }))
    throw m.error;
  return f.getDefaultOptions().queries?._experimental_afterQuery?.(
    d,
    m
  ), d.experimental_prefetchInRender && !go.isServer() && Xx(m, s) && (p ? (
    // Fetch immediately on render in order to ensure `.promise` is resolved even if the component is unmounted
    Ty(d, g, u)
  ) : (
    // subscribe to the "cache promise" so that we can finalize the currentThenable once data comes in
    h?.promise
  ))?.catch(Ae).finally(() => {
    g.updateResult();
  }), d.notifyOnChangeProps ? m : g.trackResult(m);
}
function im(n, a) {
  return Gx(n, _x);
}
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const am = (...n) => n.filter((a, o, s) => !!a && a.trim() !== "" && s.indexOf(a) === o).join(" ").trim();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Zx = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Kx = (n) => n.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (a, o, s) => s ? s.toUpperCase() : o.toLowerCase()
);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Ay = (n) => {
  const a = Kx(n);
  return a.charAt(0).toUpperCase() + a.slice(1);
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var pf = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const $x = (n) => {
  for (const a in n)
    if (a.startsWith("aria-") || a === "role" || a === "title")
      return !0;
  return !1;
}, Jx = F.createContext({}), Fx = () => F.useContext(Jx), Ix = F.forwardRef(
  ({ color: n, size: a, strokeWidth: o, absoluteStrokeWidth: s, className: u = "", children: f, iconNode: d, ...h }, p) => {
    const {
      size: g = 24,
      strokeWidth: m = 2,
      absoluteStrokeWidth: v = !1,
      color: b = "currentColor",
      className: S = ""
    } = Fx() ?? {}, E = s ?? v ? Number(o ?? m) * 24 / Number(a ?? g) : o ?? m;
    return F.createElement(
      "svg",
      {
        ref: p,
        ...pf,
        width: a ?? g ?? pf.width,
        height: a ?? g ?? pf.height,
        stroke: n ?? b,
        strokeWidth: E,
        className: am("lucide", S, u),
        ...!f && !$x(h) && { "aria-hidden": "true" },
        ...h
      },
      [
        ...d.map(([A, _]) => F.createElement(A, _)),
        ...Array.isArray(f) ? f : [f]
      ]
    );
  }
);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Gn = (n, a) => {
  const o = F.forwardRef(
    ({ className: s, ...u }, f) => F.createElement(Ix, {
      ref: f,
      iconNode: a,
      className: am(
        `lucide-${Zx(Ay(n))}`,
        `lucide-${n}`,
        s
      ),
      ...u
    })
  );
  return o.displayName = Ay(n), o;
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Wx = [
  ["path", { d: "M12 7v14", key: "1akyts" }],
  [
    "path",
    {
      d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
      key: "ruj8y"
    }
  ]
], My = Gn("book-open", Wx);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Px = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]], lm = Gn("chevron-down", Px);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const tS = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]], om = Gn("chevron-right", tS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const eS = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
], nS = Gn("circle-alert", eS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const iS = [
  ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
  ["path", { d: "M10 14 21 3", key: "gplh6r" }],
  ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
], aS = Gn("external-link", iS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const lS = [
  ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2", key: "8i5ue5" }],
  ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2", key: "1b9ql8" }],
  ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
], oS = Gn("link-2", lS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const sS = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]], rS = Gn("loader-circle", sS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const uS = [
  ["rect", { x: "16", y: "16", width: "6", height: "6", rx: "1", key: "4q2zg0" }],
  ["rect", { x: "2", y: "16", width: "6", height: "6", rx: "1", key: "8cvhb9" }],
  ["rect", { x: "9", y: "2", width: "6", height: "6", rx: "1", key: "1egb70" }],
  ["path", { d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3", key: "1jsf9p" }],
  ["path", { d: "M12 12V8", key: "2874zd" }]
], cS = Gn("network", uS);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const fS = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
  ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
  ["path", { d: "M8 16H3v5", key: "1cv678" }]
], dS = Gn("refresh-cw", fS);
function zy({ label: n, count: a, total: o, color: s }) {
  const u = o > 0 ? Math.round(a / o * 100) : 0;
  return /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }, children: [
    /* @__PURE__ */ M.jsx("div", { style: { width: 120, flexShrink: 0, color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: n, children: n }),
    /* @__PURE__ */ M.jsx("div", { style: { flex: 1, height: 6, borderRadius: 999, background: "var(--dsw-alias-bg-layer-2, #eef1f4)", overflow: "hidden" }, children: /* @__PURE__ */ M.jsx(
      "div",
      {
        style: {
          width: `${u}%`,
          height: "100%",
          borderRadius: 999,
          background: s,
          transition: "width 400ms ease"
        }
      }
    ) }),
    /* @__PURE__ */ M.jsxs("div", { style: { width: 52, textAlign: "right", flexShrink: 0, display: "flex", gap: 6, justifyContent: "flex-end" }, children: [
      /* @__PURE__ */ M.jsx("span", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11 }, children: a.toLocaleString() }),
      /* @__PURE__ */ M.jsxs("span", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11 }, children: [
        u,
        "%"
      ] })
    ] })
  ] });
}
const Oy = ["#3E79F2", "#149287", "#2F9F61", "#555FD6", "#8A56D8", "#B65473", "#C9922E", "#4aa3ff", "#f2b66d"], Dy = ["#4cc38a", "#79c0ff", "#d2a8ff", "#f2b66d", "#ff7b72", "#58a6ff", "#4aa3ff", "#8A56D8"];
function Ry(n, a) {
  const o = {};
  for (const s of n) {
    const u = String(s[a] ?? "unknown");
    o[u] = (o[u] ?? 0) + 1;
  }
  return o;
}
function hS() {
  const [n, a] = F.useState(null), [o, s] = F.useState(!1), [u, f] = F.useState(""), [d, h] = F.useState([]), [p, g] = F.useState({}), m = F.useCallback(async () => {
    s(!0), f("");
    try {
      const [_, C] = await Promise.all([
        fetch("/api/graph/stats"),
        fetch("/api/graph/nodes?limit=500")
      ]);
      if (!_.ok) throw new Error(`统计没读成（${_.status}）`);
      if (!C.ok) throw new Error(`节点没读成（${C.status}）`);
      const D = await _.json();
      a(D), _.status === 207 && f(D.message || "统计只读到一部分。");
      const w = await C.json(), z = w.nodes ?? [], q = D.node_types && typeof D.node_types == "object" ? D.node_types : Ry(z, "type");
      if (g(q), C.status === 207) {
        const U = w.message || "节点只读到一部分。";
        f((Q) => Q ? `${Q} ${U}` : U);
      }
      const B = await fetch("/api/graph/edges?limit=2000");
      if (B.ok) {
        const Q = (await B.json()).edges ?? [], Z = {};
        for (const X of Q)
          Z[X.source] = (Z[X.source] ?? 0) + 1, Z[X.target] = (Z[X.target] ?? 0) + 1;
        const ot = z.map((X) => ({ node: X, neighborCount: Z[X.id] ?? 0 })).sort((X, k) => k.neighborCount - X.neighborCount).slice(0, 10);
        h(ot);
      }
    } catch (_) {
      f(_ instanceof Error ? _.message : "图谱总览没读成。");
    } finally {
      s(!1);
    }
  }, []);
  F.useEffect(() => {
    let _ = !1;
    async function C() {
      _ || (s(!0), f(""));
      try {
        const [D, w] = await Promise.all([
          fetch("/api/graph/stats"),
          fetch("/api/graph/nodes?limit=500")
        ]);
        if (!D.ok) throw new Error(`统计没读成（${D.status}）`);
        if (!w.ok) throw new Error(`节点没读成（${w.status}）`);
        const z = await D.json();
        _ || (a(z), D.status === 207 && f(z.message || "统计只读到一部分。"));
        const q = await w.json(), B = q.nodes ?? [];
        if (!_) {
          const Q = z.node_types && typeof z.node_types == "object" ? z.node_types : Ry(B, "type");
          if (g(Q), w.status === 207) {
            const Z = q.message || "节点只读到一部分。";
            f((ot) => ot ? `${ot} ${Z}` : Z);
          }
        }
        const U = await fetch("/api/graph/edges?limit=2000");
        if (U.ok) {
          const Z = (await U.json()).edges ?? [], ot = {};
          for (const k of Z)
            ot[k.source] = (ot[k.source] ?? 0) + 1, ot[k.target] = (ot[k.target] ?? 0) + 1;
          const X = B.map((k) => ({ node: k, neighborCount: ot[k.id] ?? 0 })).sort((k, it) => it.neighborCount - k.neighborCount).slice(0, 10);
          _ || h(X);
        }
      } catch (D) {
        _ || f(D instanceof Error ? D.message : "图谱总览没读成。");
      } finally {
        _ || s(!1);
      }
    }
    return C(), () => {
      _ = !0;
    };
  }, []);
  const v = Object.entries(p).sort((_, C) => C[1] - _[1]), b = n?.edge_types ? Object.entries(n.edge_types).sort((_, C) => C[1] - _[1]) : [], S = n?.node_count ?? 0, E = n?.edge_count ?? 0, A = [
    { label: "节点", value: S.toLocaleString(), color: "var(--ws-accent)", sub: `${v.length} 种类型` },
    { label: "边", value: E.toLocaleString(), color: "var(--ws-green)", sub: `${b.length} 种关系` },
    { label: "密度", value: S > 1 ? (E / (S * (S - 1)) * 100).toFixed(3) + "%" : "—", color: "var(--ws-purple)", sub: "图密度" }
  ];
  return /* @__PURE__ */ M.jsxs("div", { className: "ws-page", children: [
    u ? /* @__PURE__ */ M.jsx("div", { style: { margin: "16px 22px 0 22px", padding: 12, borderRadius: 14, color: "#d14343", background: "rgba(209,67,67,0.08)", border: "1px solid rgba(209,67,67,0.22)" }, children: u }) : null,
    /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }, children: [
      /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
        /* @__PURE__ */ M.jsx("div", { style: { width: 32, height: 32, borderRadius: 9, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)" }, children: /* @__PURE__ */ M.jsx(cS, { size: 16 }) }),
        /* @__PURE__ */ M.jsxs("div", { children: [
          /* @__PURE__ */ M.jsx("div", { style: { color: "var(--ws-text)", fontSize: 15, fontWeight: 700, lineHeight: 1 }, children: "图谱总览" }),
          /* @__PURE__ */ M.jsx("div", { className: "ws-body", style: { fontSize: 11, marginTop: 2 }, children: "节点/边数量、类型分布、连接最多的节点" })
        ] })
      ] }),
      /* @__PURE__ */ M.jsxs("button", { className: "ws-btn ws-btn--ghost", onClick: () => {
        m();
      }, disabled: o, style: { padding: "6px 12px" }, children: [
        o ? /* @__PURE__ */ M.jsx(rS, { size: 13, className: "ws-spin" }) : /* @__PURE__ */ M.jsx(dS, { size: 13 }),
        "刷新"
      ] })
    ] }),
    /* @__PURE__ */ M.jsxs("div", { className: "ws-scroll", style: { flex: 1, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }, children: [
      /* @__PURE__ */ M.jsx("div", { className: "ws-stat-grid ws-stat-grid--3", children: A.map(({ label: _, value: C, color: D, sub: w }) => /* @__PURE__ */ M.jsxs("div", { className: "ws-stat-card", children: [
        /* @__PURE__ */ M.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 6 }, children: _ }),
        /* @__PURE__ */ M.jsx("div", { className: "ws-stat-value", style: { color: D }, children: o ? "—" : C }),
        /* @__PURE__ */ M.jsx("div", { className: "ws-stat-label", children: w })
      ] }, _)) }),
      /* @__PURE__ */ M.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }, children: [
        /* @__PURE__ */ M.jsxs("div", { className: "ws-card", style: { padding: "16px 18px", gap: 8, display: "flex", flexDirection: "column" }, children: [
          /* @__PURE__ */ M.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 4 }, children: "节点类型分布" }),
          o ? /* @__PURE__ */ M.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [80, 65, 45, 35, 25].map((_, C) => /* @__PURE__ */ M.jsx("div", { className: "ws-skeleton", style: { height: 10, width: `${_}%` } }, C)) }) : v.length === 0 ? /* @__PURE__ */ M.jsx("div", { className: "ws-body", style: { fontSize: 12 }, children: "还没有数据，先加载图。" }) : v.slice(0, 8).map(([_, C], D) => /* @__PURE__ */ M.jsx(zy, { label: _, count: C, total: S || 1, color: Oy[D % Oy.length] }, _))
        ] }),
        /* @__PURE__ */ M.jsxs("div", { className: "ws-card", style: { padding: "16px 18px", gap: 8, display: "flex", flexDirection: "column" }, children: [
          /* @__PURE__ */ M.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 4 }, children: "边类型分布" }),
          o ? /* @__PURE__ */ M.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [70, 55, 48, 30, 20].map((_, C) => /* @__PURE__ */ M.jsx("div", { className: "ws-skeleton", style: { height: 10, width: `${_}%` } }, C)) }) : b.length === 0 ? /* @__PURE__ */ M.jsx("div", { className: "ws-body", style: { fontSize: 12 }, children: "边类型分布需要统计接口返回 edge_types。" }) : b.slice(0, 8).map(([_, C], D) => /* @__PURE__ */ M.jsx(zy, { label: _, count: C, total: E || 1, color: Dy[D % Dy.length] }, _))
        ] })
      ] }),
      d.length > 0 && /* @__PURE__ */ M.jsxs("div", { className: "ws-card", style: { padding: "16px 18px" }, children: [
        /* @__PURE__ */ M.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 12 }, children: "连接最多的节点（按度数）" }),
        /* @__PURE__ */ M.jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }, children: d.map(({ node: _, neighborCount: C }, D) => /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--ws-radius-sm)", background: "var(--dsw-alias-bg-layer-2, #eef1f4)", border: "1px solid var(--ws-border)" }, children: [
          /* @__PURE__ */ M.jsxs("div", { style: { color: "var(--ws-text-dim)", fontSize: 11, fontWeight: 700, minWidth: 22 }, children: [
            "#",
            D + 1
          ] }),
          /* @__PURE__ */ M.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ M.jsx("div", { style: { color: "var(--ws-text)", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: _.content || _.id }),
            /* @__PURE__ */ M.jsx("div", { className: "ws-eyebrow", style: { marginTop: 2, fontSize: 9 }, children: _.type })
          ] }),
          /* @__PURE__ */ M.jsx("span", { className: "ws-pill ws-pill--accent", style: { fontSize: 10 }, children: C })
        ] }, _.id)) })
      ] })
    ] })
  ] });
}
function od() {
  if (typeof document > "u") return "";
  const n = document.querySelectorAll(".dsos-root");
  for (let o = 0; o < n.length; o++) {
    const s = n[o];
    if (!(s instanceof HTMLElement) || s.offsetParent === null && s.getClientRects().length === 0) continue;
    const u = s.getAttribute("data-cwd") || "";
    if (u) return u;
  }
  const a = document.querySelector(".dsos-root[data-dsos-semantic]");
  return a && a.getAttribute("data-cwd") || "";
}
const gS = async () => {
  const n = await fetch("/api/vocabulary/schemes");
  if (!n.ok) throw new Error("Failed to fetch vocabularies");
  const a = await n.json();
  return Array.isArray(a) ? a.map((o) => ({
    uri: String(o.uri || ""),
    label: String(o.label || o.title || o.uri || ""),
    description: o.description
  })) : [];
}, pS = async (n) => {
  const a = await fetch(`/api/vocabulary/hierarchy?scheme=${encodeURIComponent(n)}`);
  if (!a.ok) throw new Error("Failed to fetch hierarchy");
  return a.json();
}, yS = () => im({
  queryKey: ["vocabularies", od()],
  queryFn: gS
}), mS = (n) => im({
  queryKey: ["hierarchy", od(), n],
  queryFn: () => pS(n),
  enabled: !!n
});
function sm(n) {
  return n.reduce((a, o) => a + 1 + sm(o.children ?? []), 0);
}
function rm({
  concept: n,
  depth: a,
  onSelect: o
}) {
  const [s, u] = F.useState(!1), f = n.children ?? [], d = f.length > 0;
  return /* @__PURE__ */ M.jsxs(M.Fragment, { children: [
    /* @__PURE__ */ M.jsxs(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          paddingLeft: 12 + a * 16,
          paddingRight: 12,
          paddingTop: 5,
          paddingBottom: 5,
          borderRadius: 6,
          cursor: "pointer",
          color: a === 0 ? "var(--dsw-alias-label-primary, #1f2328)" : "var(--dsw-alias-label-secondary, #3d444d)",
          fontSize: a === 0 ? 13 : 12,
          transition: "background 120ms ease"
        },
        onMouseEnter: (h) => {
          h.currentTarget.style.background = "rgba(74,163,255,0.07)";
        },
        onMouseLeave: (h) => {
          h.currentTarget.style.background = "transparent";
        },
        children: [
          d ? /* @__PURE__ */ M.jsx(
            "button",
            {
              onClick: () => u((h) => !h),
              style: { background: "transparent", border: "none", color: "var(--dsw-alias-label-secondary, #3d444d)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" },
              children: s ? /* @__PURE__ */ M.jsx(lm, { size: 12 }) : /* @__PURE__ */ M.jsx(om, { size: 12 })
            }
          ) : /* @__PURE__ */ M.jsx("span", { style: { width: 12, display: "inline-block" } }),
          /* @__PURE__ */ M.jsx(
            "span",
            {
              onClick: () => o(n),
              style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              children: n.pref_label || n.uri
            }
          ),
          f.length > 0 ? /* @__PURE__ */ M.jsx("span", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 10 }, children: f.length }) : null
        ]
      }
    ),
    s && d ? f.map((h) => /* @__PURE__ */ M.jsx(rm, { concept: h, depth: a + 1, onSelect: o }, h.uri)) : null
  ] });
}
function vS({
  scheme: n,
  onSelectConcept: a
}) {
  const [o, s] = F.useState(!0), { data: u = [], isLoading: f } = mS(n.uri), d = sm(u);
  return /* @__PURE__ */ M.jsxs("div", { style: _S, children: [
    /* @__PURE__ */ M.jsxs(
      "button",
      {
        onClick: () => s((h) => !h),
        style: CS,
        children: [
          /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            o ? /* @__PURE__ */ M.jsx(lm, { size: 14, color: "var(--dsw-alias-label-secondary, #3d444d)" }) : /* @__PURE__ */ M.jsx(om, { size: 14, color: "var(--dsw-alias-label-secondary, #3d444d)" }),
            /* @__PURE__ */ M.jsx("span", { style: { color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 14, fontWeight: 700 }, children: n.label })
          ] }),
          /* @__PURE__ */ M.jsx("span", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11 }, children: f ? "…" : `${d} 个概念` })
        ]
      }
    ),
    o ? /* @__PURE__ */ M.jsx("div", { style: { paddingTop: 4, paddingBottom: 8 }, children: f ? /* @__PURE__ */ M.jsx("div", { style: { padding: "8px 24px", color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12 }, children: "正在加载概念…" }) : u.length === 0 ? /* @__PURE__ */ M.jsx("div", { style: { padding: "8px 24px", color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12 }, children: "这个方案里没有概念。" }) : u.map((h) => /* @__PURE__ */ M.jsx(rm, { concept: h, depth: 0, onSelect: a }, h.uri)) }) : null
  ] });
}
function bS({
  onOpenVocabularyBrowser: n
}) {
  const { data: a = [], isLoading: o } = yS(), [s, u] = F.useState(null);
  return /* @__PURE__ */ M.jsxs("div", { style: xS, children: [
    /* @__PURE__ */ M.jsxs("div", { style: SS, children: [
      /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10 }, children: [
        /* @__PURE__ */ M.jsx(My, { size: 18, color: "var(--dsw-alias-brand-primary, #0969da)" }),
        /* @__PURE__ */ M.jsxs("div", { children: [
          /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 16, fontWeight: 700 }, children: "本体摘要" }),
          /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12 }, children: o ? "正在加载方案…" : a.length ? `已加载 ${a.length} 个词汇方案` : "没有分类表" })
        ] })
      ] }),
      n ? /* @__PURE__ */ M.jsxs("button", { onClick: n, style: wS, children: [
        /* @__PURE__ */ M.jsx(aS, { size: 12 }),
        /* @__PURE__ */ M.jsx("span", { children: "打开完整浏览器" })
      ] }) : null
    ] }),
    /* @__PURE__ */ M.jsxs("div", { style: { flex: 1, display: "flex", overflow: "hidden" }, children: [
      /* @__PURE__ */ M.jsx("div", { style: ES, children: o ? /* @__PURE__ */ M.jsx("div", { style: { padding: 24, display: "flex", flexDirection: "column", gap: 10 }, children: [90, 75, 60].map((f, d) => /* @__PURE__ */ M.jsx("div", { style: { height: 36, borderRadius: 8, background: "var(--dsw-alias-bg-layer-2, #eef1f4)", width: `${f}%` } }, d)) }) : a.length === 0 ? /* @__PURE__ */ M.jsxs("div", { style: AS, children: [
        /* @__PURE__ */ M.jsx(My, { size: 32, color: "var(--dsw-alias-border-l2, rgba(31,35,40,0.25))" }),
        /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 13, marginTop: 12 }, children: "没有分类表" }),
        /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12, marginTop: 4, textAlign: "center", maxWidth: 240 }, children: "还没有分类表。需要的话到「知识分类」加载一份。" })
      ] }) : /* @__PURE__ */ M.jsx("div", { style: { padding: "12px 8px", display: "flex", flexDirection: "column", gap: 8 }, children: a.map((f) => /* @__PURE__ */ M.jsx(vS, { scheme: f, onSelectConcept: u }, f.uri)) }) }),
      s ? /* @__PURE__ */ M.jsxs("div", { style: NS, children: [
        /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }, children: [
          /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }, children: "概念详情" }),
          /* @__PURE__ */ M.jsx("button", { onClick: () => u(null), style: { background: "transparent", border: "none", color: "var(--dsw-alias-label-secondary, #3d444d)", cursor: "pointer", fontSize: 16 }, children: "×" })
        ] }),
        /* @__PURE__ */ M.jsx("h3", { style: { color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 6px 0" }, children: s.pref_label }),
        s.notation ? /* @__PURE__ */ M.jsxs("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 12, marginBottom: 8 }, children: [
          "记号：",
          s.notation
        ] }) : null,
        /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", marginBottom: 14 }, children: s.uri }),
        s.description ? /* @__PURE__ */ M.jsxs("div", { style: yf, children: [
          /* @__PURE__ */ M.jsx("div", { style: mf, children: "说明" }),
          /* @__PURE__ */ M.jsx("div", { style: { color: "var(--dsw-alias-label-primary, #1f2328)", fontSize: 13, lineHeight: 1.6 }, children: s.description })
        ] }) : null,
        s.alt_labels?.length ? /* @__PURE__ */ M.jsxs("div", { style: yf, children: [
          /* @__PURE__ */ M.jsx("div", { style: mf, children: "交替标签" }),
          /* @__PURE__ */ M.jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: s.alt_labels.map((f) => /* @__PURE__ */ M.jsx("span", { style: TS, children: f }, f)) })
        ] }) : null,
        (s.children?.length ?? 0) > 0 ? /* @__PURE__ */ M.jsxs("div", { style: yf, children: [
          /* @__PURE__ */ M.jsxs("div", { style: mf, children: [
            "狭义概念（",
            s.children.length,
            "）"
          ] }),
          /* @__PURE__ */ M.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
            s.children.slice(0, 8).map((f) => /* @__PURE__ */ M.jsxs(
              "div",
              {
                onClick: () => u(f),
                style: { color: "var(--dsw-alias-brand-primary, #0969da)", fontSize: 12, cursor: "pointer", padding: "3px 0" },
                children: [
                  "→ ",
                  f.pref_label
                ]
              },
              f.uri
            )),
            s.children.length > 8 ? /* @__PURE__ */ M.jsxs("div", { style: { color: "var(--dsw-alias-label-secondary, #3d444d)", fontSize: 11 }, children: [
              "+",
              s.children.length - 8,
              " 个"
            ] }) : null
          ] })
        ] }) : null
      ] }) : null
    ] })
  ] });
}
const xS = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  background: "var(--dsw-alias-bg-base, #ffffff)",
  overflow: "hidden"
}, SS = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 24px 16px",
  borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  flexShrink: 0
}, wS = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  color: "var(--dsw-alias-brand-primary, #0969da)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer"
}, ES = {
  flex: 1,
  overflowY: "auto",
  borderRight: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))"
}, _S = {
  borderRadius: 10,
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  background: "var(--dsw-alias-bg-layer-1, #f6f8fa)",
  overflow: "hidden"
}, CS = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.08))"
}, NS = {
  width: 300,
  padding: "20px",
  overflowY: "auto",
  borderLeft: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  flexShrink: 0
}, yf = {
  marginTop: 14,
  paddingTop: 12,
  borderTop: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))"
}, mf = {
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 6
}, TS = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "var(--dsw-alias-bg-layer-2, #eef1f4)",
  border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))",
  color: "var(--dsw-alias-label-secondary, #3d444d)",
  fontSize: 11
}, AS = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: 40,
  height: "100%"
};
function ie(n) {
  if (typeof n == "string" || typeof n == "number") return "" + n;
  let a = "";
  if (Array.isArray(n))
    for (let o = 0, s; o < n.length; o++)
      (s = ie(n[o])) !== "" && (a += (a && " ") + s);
  else
    for (let o in n)
      n[o] && (a += (a && " ") + o);
  return a;
}
var MS = { value: () => {
} };
function Dr() {
  for (var n = 0, a = arguments.length, o = {}, s; n < a; ++n) {
    if (!(s = arguments[n] + "") || s in o || /[\s.]/.test(s)) throw new Error("illegal type: " + s);
    o[s] = [];
  }
  return new dr(o);
}
function dr(n) {
  this._ = n;
}
function zS(n, a) {
  return n.trim().split(/^|\s+/).map(function(o) {
    var s = "", u = o.indexOf(".");
    if (u >= 0 && (s = o.slice(u + 1), o = o.slice(0, u)), o && !a.hasOwnProperty(o)) throw new Error("unknown type: " + o);
    return { type: o, name: s };
  });
}
dr.prototype = Dr.prototype = {
  constructor: dr,
  on: function(n, a) {
    var o = this._, s = zS(n + "", o), u, f = -1, d = s.length;
    if (arguments.length < 2) {
      for (; ++f < d; ) if ((u = (n = s[f]).type) && (u = OS(o[u], n.name))) return u;
      return;
    }
    if (a != null && typeof a != "function") throw new Error("invalid callback: " + a);
    for (; ++f < d; )
      if (u = (n = s[f]).type) o[u] = Hy(o[u], n.name, a);
      else if (a == null) for (u in o) o[u] = Hy(o[u], n.name, null);
    return this;
  },
  copy: function() {
    var n = {}, a = this._;
    for (var o in a) n[o] = a[o].slice();
    return new dr(n);
  },
  call: function(n, a) {
    if ((u = arguments.length - 2) > 0) for (var o = new Array(u), s = 0, u, f; s < u; ++s) o[s] = arguments[s + 2];
    if (!this._.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    for (f = this._[n], s = 0, u = f.length; s < u; ++s) f[s].value.apply(a, o);
  },
  apply: function(n, a, o) {
    if (!this._.hasOwnProperty(n)) throw new Error("unknown type: " + n);
    for (var s = this._[n], u = 0, f = s.length; u < f; ++u) s[u].value.apply(a, o);
  }
};
function OS(n, a) {
  for (var o = 0, s = n.length, u; o < s; ++o)
    if ((u = n[o]).name === a)
      return u.value;
}
function Hy(n, a, o) {
  for (var s = 0, u = n.length; s < u; ++s)
    if (n[s].name === a) {
      n[s] = MS, n = n.slice(0, s).concat(n.slice(s + 1));
      break;
    }
  return o != null && n.push({ name: a, value: o }), n;
}
var qf = "http://www.w3.org/1999/xhtml";
const jy = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: qf,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};
function Rr(n) {
  var a = n += "", o = a.indexOf(":");
  return o >= 0 && (a = n.slice(0, o)) !== "xmlns" && (n = n.slice(o + 1)), jy.hasOwnProperty(a) ? { space: jy[a], local: n } : n;
}
function DS(n) {
  return function() {
    var a = this.ownerDocument, o = this.namespaceURI;
    return o === qf && a.documentElement.namespaceURI === qf ? a.createElement(n) : a.createElementNS(o, n);
  };
}
function RS(n) {
  return function() {
    return this.ownerDocument.createElementNS(n.space, n.local);
  };
}
function um(n) {
  var a = Rr(n);
  return (a.local ? RS : DS)(a);
}
function HS() {
}
function sd(n) {
  return n == null ? HS : function() {
    return this.querySelector(n);
  };
}
function jS(n) {
  typeof n != "function" && (n = sd(n));
  for (var a = this._groups, o = a.length, s = new Array(o), u = 0; u < o; ++u)
    for (var f = a[u], d = f.length, h = s[u] = new Array(d), p, g, m = 0; m < d; ++m)
      (p = f[m]) && (g = n.call(p, p.__data__, m, f)) && ("__data__" in p && (g.__data__ = p.__data__), h[m] = g);
  return new qe(s, this._parents);
}
function US(n) {
  return n == null ? [] : Array.isArray(n) ? n : Array.from(n);
}
function BS() {
  return [];
}
function cm(n) {
  return n == null ? BS : function() {
    return this.querySelectorAll(n);
  };
}
function LS(n) {
  return function() {
    return US(n.apply(this, arguments));
  };
}
function qS(n) {
  typeof n == "function" ? n = LS(n) : n = cm(n);
  for (var a = this._groups, o = a.length, s = [], u = [], f = 0; f < o; ++f)
    for (var d = a[f], h = d.length, p, g = 0; g < h; ++g)
      (p = d[g]) && (s.push(n.call(p, p.__data__, g, d)), u.push(p));
  return new qe(s, u);
}
function fm(n) {
  return function() {
    return this.matches(n);
  };
}
function dm(n) {
  return function(a) {
    return a.matches(n);
  };
}
var YS = Array.prototype.find;
function VS(n) {
  return function() {
    return YS.call(this.children, n);
  };
}
function QS() {
  return this.firstElementChild;
}
function XS(n) {
  return this.select(n == null ? QS : VS(typeof n == "function" ? n : dm(n)));
}
var kS = Array.prototype.filter;
function GS() {
  return Array.from(this.children);
}
function ZS(n) {
  return function() {
    return kS.call(this.children, n);
  };
}
function KS(n) {
  return this.selectAll(n == null ? GS : ZS(typeof n == "function" ? n : dm(n)));
}
function $S(n) {
  typeof n != "function" && (n = fm(n));
  for (var a = this._groups, o = a.length, s = new Array(o), u = 0; u < o; ++u)
    for (var f = a[u], d = f.length, h = s[u] = [], p, g = 0; g < d; ++g)
      (p = f[g]) && n.call(p, p.__data__, g, f) && h.push(p);
  return new qe(s, this._parents);
}
function hm(n) {
  return new Array(n.length);
}
function JS() {
  return new qe(this._enter || this._groups.map(hm), this._parents);
}
function br(n, a) {
  this.ownerDocument = n.ownerDocument, this.namespaceURI = n.namespaceURI, this._next = null, this._parent = n, this.__data__ = a;
}
br.prototype = {
  constructor: br,
  appendChild: function(n) {
    return this._parent.insertBefore(n, this._next);
  },
  insertBefore: function(n, a) {
    return this._parent.insertBefore(n, a);
  },
  querySelector: function(n) {
    return this._parent.querySelector(n);
  },
  querySelectorAll: function(n) {
    return this._parent.querySelectorAll(n);
  }
};
function FS(n) {
  return function() {
    return n;
  };
}
function IS(n, a, o, s, u, f) {
  for (var d = 0, h, p = a.length, g = f.length; d < g; ++d)
    (h = a[d]) ? (h.__data__ = f[d], s[d] = h) : o[d] = new br(n, f[d]);
  for (; d < p; ++d)
    (h = a[d]) && (u[d] = h);
}
function WS(n, a, o, s, u, f, d) {
  var h, p, g = /* @__PURE__ */ new Map(), m = a.length, v = f.length, b = new Array(m), S;
  for (h = 0; h < m; ++h)
    (p = a[h]) && (b[h] = S = d.call(p, p.__data__, h, a) + "", g.has(S) ? u[h] = p : g.set(S, p));
  for (h = 0; h < v; ++h)
    S = d.call(n, f[h], h, f) + "", (p = g.get(S)) ? (s[h] = p, p.__data__ = f[h], g.delete(S)) : o[h] = new br(n, f[h]);
  for (h = 0; h < m; ++h)
    (p = a[h]) && g.get(b[h]) === p && (u[h] = p);
}
function PS(n) {
  return n.__data__;
}
function tw(n, a) {
  if (!arguments.length) return Array.from(this, PS);
  var o = a ? WS : IS, s = this._parents, u = this._groups;
  typeof n != "function" && (n = FS(n));
  for (var f = u.length, d = new Array(f), h = new Array(f), p = new Array(f), g = 0; g < f; ++g) {
    var m = s[g], v = u[g], b = v.length, S = ew(n.call(m, m && m.__data__, g, s)), E = S.length, A = h[g] = new Array(E), _ = d[g] = new Array(E), C = p[g] = new Array(b);
    o(m, v, A, _, C, S, a);
    for (var D = 0, w = 0, z, q; D < E; ++D)
      if (z = A[D]) {
        for (D >= w && (w = D + 1); !(q = _[w]) && ++w < E; ) ;
        z._next = q || null;
      }
  }
  return d = new qe(d, s), d._enter = h, d._exit = p, d;
}
function ew(n) {
  return typeof n == "object" && "length" in n ? n : Array.from(n);
}
function nw() {
  return new qe(this._exit || this._groups.map(hm), this._parents);
}
function iw(n, a, o) {
  var s = this.enter(), u = this, f = this.exit();
  return typeof n == "function" ? (s = n(s), s && (s = s.selection())) : s = s.append(n + ""), a != null && (u = a(u), u && (u = u.selection())), o == null ? f.remove() : o(f), s && u ? s.merge(u).order() : u;
}
function aw(n) {
  for (var a = n.selection ? n.selection() : n, o = this._groups, s = a._groups, u = o.length, f = s.length, d = Math.min(u, f), h = new Array(u), p = 0; p < d; ++p)
    for (var g = o[p], m = s[p], v = g.length, b = h[p] = new Array(v), S, E = 0; E < v; ++E)
      (S = g[E] || m[E]) && (b[E] = S);
  for (; p < u; ++p)
    h[p] = o[p];
  return new qe(h, this._parents);
}
function lw() {
  for (var n = this._groups, a = -1, o = n.length; ++a < o; )
    for (var s = n[a], u = s.length - 1, f = s[u], d; --u >= 0; )
      (d = s[u]) && (f && d.compareDocumentPosition(f) ^ 4 && f.parentNode.insertBefore(d, f), f = d);
  return this;
}
function ow(n) {
  n || (n = sw);
  function a(v, b) {
    return v && b ? n(v.__data__, b.__data__) : !v - !b;
  }
  for (var o = this._groups, s = o.length, u = new Array(s), f = 0; f < s; ++f) {
    for (var d = o[f], h = d.length, p = u[f] = new Array(h), g, m = 0; m < h; ++m)
      (g = d[m]) && (p[m] = g);
    p.sort(a);
  }
  return new qe(u, this._parents).order();
}
function sw(n, a) {
  return n < a ? -1 : n > a ? 1 : n >= a ? 0 : NaN;
}
function rw() {
  var n = arguments[0];
  return arguments[0] = this, n.apply(null, arguments), this;
}
function uw() {
  return Array.from(this);
}
function cw() {
  for (var n = this._groups, a = 0, o = n.length; a < o; ++a)
    for (var s = n[a], u = 0, f = s.length; u < f; ++u) {
      var d = s[u];
      if (d) return d;
    }
  return null;
}
function fw() {
  let n = 0;
  for (const a of this) ++n;
  return n;
}
function dw() {
  return !this.node();
}
function hw(n) {
  for (var a = this._groups, o = 0, s = a.length; o < s; ++o)
    for (var u = a[o], f = 0, d = u.length, h; f < d; ++f)
      (h = u[f]) && n.call(h, h.__data__, f, u);
  return this;
}
function gw(n) {
  return function() {
    this.removeAttribute(n);
  };
}
function pw(n) {
  return function() {
    this.removeAttributeNS(n.space, n.local);
  };
}
function yw(n, a) {
  return function() {
    this.setAttribute(n, a);
  };
}
function mw(n, a) {
  return function() {
    this.setAttributeNS(n.space, n.local, a);
  };
}
function vw(n, a) {
  return function() {
    var o = a.apply(this, arguments);
    o == null ? this.removeAttribute(n) : this.setAttribute(n, o);
  };
}
function bw(n, a) {
  return function() {
    var o = a.apply(this, arguments);
    o == null ? this.removeAttributeNS(n.space, n.local) : this.setAttributeNS(n.space, n.local, o);
  };
}
function xw(n, a) {
  var o = Rr(n);
  if (arguments.length < 2) {
    var s = this.node();
    return o.local ? s.getAttributeNS(o.space, o.local) : s.getAttribute(o);
  }
  return this.each((a == null ? o.local ? pw : gw : typeof a == "function" ? o.local ? bw : vw : o.local ? mw : yw)(o, a));
}
function gm(n) {
  return n.ownerDocument && n.ownerDocument.defaultView || n.document && n || n.defaultView;
}
function Sw(n) {
  return function() {
    this.style.removeProperty(n);
  };
}
function ww(n, a, o) {
  return function() {
    this.style.setProperty(n, a, o);
  };
}
function Ew(n, a, o) {
  return function() {
    var s = a.apply(this, arguments);
    s == null ? this.style.removeProperty(n) : this.style.setProperty(n, s, o);
  };
}
function _w(n, a, o) {
  return arguments.length > 1 ? this.each((a == null ? Sw : typeof a == "function" ? Ew : ww)(n, a, o ?? "")) : el(this.node(), n);
}
function el(n, a) {
  return n.style.getPropertyValue(a) || gm(n).getComputedStyle(n, null).getPropertyValue(a);
}
function Cw(n) {
  return function() {
    delete this[n];
  };
}
function Nw(n, a) {
  return function() {
    this[n] = a;
  };
}
function Tw(n, a) {
  return function() {
    var o = a.apply(this, arguments);
    o == null ? delete this[n] : this[n] = o;
  };
}
function Aw(n, a) {
  return arguments.length > 1 ? this.each((a == null ? Cw : typeof a == "function" ? Tw : Nw)(n, a)) : this.node()[n];
}
function pm(n) {
  return n.trim().split(/^|\s+/);
}
function rd(n) {
  return n.classList || new ym(n);
}
function ym(n) {
  this._node = n, this._names = pm(n.getAttribute("class") || "");
}
ym.prototype = {
  add: function(n) {
    var a = this._names.indexOf(n);
    a < 0 && (this._names.push(n), this._node.setAttribute("class", this._names.join(" ")));
  },
  remove: function(n) {
    var a = this._names.indexOf(n);
    a >= 0 && (this._names.splice(a, 1), this._node.setAttribute("class", this._names.join(" ")));
  },
  contains: function(n) {
    return this._names.indexOf(n) >= 0;
  }
};
function mm(n, a) {
  for (var o = rd(n), s = -1, u = a.length; ++s < u; ) o.add(a[s]);
}
function vm(n, a) {
  for (var o = rd(n), s = -1, u = a.length; ++s < u; ) o.remove(a[s]);
}
function Mw(n) {
  return function() {
    mm(this, n);
  };
}
function zw(n) {
  return function() {
    vm(this, n);
  };
}
function Ow(n, a) {
  return function() {
    (a.apply(this, arguments) ? mm : vm)(this, n);
  };
}
function Dw(n, a) {
  var o = pm(n + "");
  if (arguments.length < 2) {
    for (var s = rd(this.node()), u = -1, f = o.length; ++u < f; ) if (!s.contains(o[u])) return !1;
    return !0;
  }
  return this.each((typeof a == "function" ? Ow : a ? Mw : zw)(o, a));
}
function Rw() {
  this.textContent = "";
}
function Hw(n) {
  return function() {
    this.textContent = n;
  };
}
function jw(n) {
  return function() {
    var a = n.apply(this, arguments);
    this.textContent = a ?? "";
  };
}
function Uw(n) {
  return arguments.length ? this.each(n == null ? Rw : (typeof n == "function" ? jw : Hw)(n)) : this.node().textContent;
}
function Bw() {
  this.innerHTML = "";
}
function Lw(n) {
  return function() {
    this.innerHTML = n;
  };
}
function qw(n) {
  return function() {
    var a = n.apply(this, arguments);
    this.innerHTML = a ?? "";
  };
}
function Yw(n) {
  return arguments.length ? this.each(n == null ? Bw : (typeof n == "function" ? qw : Lw)(n)) : this.node().innerHTML;
}
function Vw() {
  this.nextSibling && this.parentNode.appendChild(this);
}
function Qw() {
  return this.each(Vw);
}
function Xw() {
  this.previousSibling && this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function kw() {
  return this.each(Xw);
}
function Gw(n) {
  var a = typeof n == "function" ? n : um(n);
  return this.select(function() {
    return this.appendChild(a.apply(this, arguments));
  });
}
function Zw() {
  return null;
}
function Kw(n, a) {
  var o = typeof n == "function" ? n : um(n), s = a == null ? Zw : typeof a == "function" ? a : sd(a);
  return this.select(function() {
    return this.insertBefore(o.apply(this, arguments), s.apply(this, arguments) || null);
  });
}
function $w() {
  var n = this.parentNode;
  n && n.removeChild(this);
}
function Jw() {
  return this.each($w);
}
function Fw() {
  var n = this.cloneNode(!1), a = this.parentNode;
  return a ? a.insertBefore(n, this.nextSibling) : n;
}
function Iw() {
  var n = this.cloneNode(!0), a = this.parentNode;
  return a ? a.insertBefore(n, this.nextSibling) : n;
}
function Ww(n) {
  return this.select(n ? Iw : Fw);
}
function Pw(n) {
  return arguments.length ? this.property("__data__", n) : this.node().__data__;
}
function t2(n) {
  return function(a) {
    n.call(this, a, this.__data__);
  };
}
function e2(n) {
  return n.trim().split(/^|\s+/).map(function(a) {
    var o = "", s = a.indexOf(".");
    return s >= 0 && (o = a.slice(s + 1), a = a.slice(0, s)), { type: a, name: o };
  });
}
function n2(n) {
  return function() {
    var a = this.__on;
    if (a) {
      for (var o = 0, s = -1, u = a.length, f; o < u; ++o)
        f = a[o], (!n.type || f.type === n.type) && f.name === n.name ? this.removeEventListener(f.type, f.listener, f.options) : a[++s] = f;
      ++s ? a.length = s : delete this.__on;
    }
  };
}
function i2(n, a, o) {
  return function() {
    var s = this.__on, u, f = t2(a);
    if (s) {
      for (var d = 0, h = s.length; d < h; ++d)
        if ((u = s[d]).type === n.type && u.name === n.name) {
          this.removeEventListener(u.type, u.listener, u.options), this.addEventListener(u.type, u.listener = f, u.options = o), u.value = a;
          return;
        }
    }
    this.addEventListener(n.type, f, o), u = { type: n.type, name: n.name, value: a, listener: f, options: o }, s ? s.push(u) : this.__on = [u];
  };
}
function a2(n, a, o) {
  var s = e2(n + ""), u, f = s.length, d;
  if (arguments.length < 2) {
    var h = this.node().__on;
    if (h) {
      for (var p = 0, g = h.length, m; p < g; ++p)
        for (u = 0, m = h[p]; u < f; ++u)
          if ((d = s[u]).type === m.type && d.name === m.name)
            return m.value;
    }
    return;
  }
  for (h = a ? i2 : n2, u = 0; u < f; ++u) this.each(h(s[u], a, o));
  return this;
}
function bm(n, a, o) {
  var s = gm(n), u = s.CustomEvent;
  typeof u == "function" ? u = new u(a, o) : (u = s.document.createEvent("Event"), o ? (u.initEvent(a, o.bubbles, o.cancelable), u.detail = o.detail) : u.initEvent(a, !1, !1)), n.dispatchEvent(u);
}
function l2(n, a) {
  return function() {
    return bm(this, n, a);
  };
}
function o2(n, a) {
  return function() {
    return bm(this, n, a.apply(this, arguments));
  };
}
function s2(n, a) {
  return this.each((typeof a == "function" ? o2 : l2)(n, a));
}
function* r2() {
  for (var n = this._groups, a = 0, o = n.length; a < o; ++a)
    for (var s = n[a], u = 0, f = s.length, d; u < f; ++u)
      (d = s[u]) && (yield d);
}
var xm = [null];
function qe(n, a) {
  this._groups = n, this._parents = a;
}
function To() {
  return new qe([[document.documentElement]], xm);
}
function u2() {
  return this;
}
qe.prototype = To.prototype = {
  constructor: qe,
  select: jS,
  selectAll: qS,
  selectChild: XS,
  selectChildren: KS,
  filter: $S,
  data: tw,
  enter: JS,
  exit: nw,
  join: iw,
  merge: aw,
  selection: u2,
  order: lw,
  sort: ow,
  call: rw,
  nodes: uw,
  node: cw,
  size: fw,
  empty: dw,
  each: hw,
  attr: xw,
  style: _w,
  property: Aw,
  classed: Dw,
  text: Uw,
  html: Yw,
  raise: Qw,
  lower: kw,
  append: Gw,
  insert: Kw,
  remove: Jw,
  clone: Ww,
  datum: Pw,
  on: a2,
  dispatch: s2,
  [Symbol.iterator]: r2
};
function Le(n) {
  return typeof n == "string" ? new qe([[document.querySelector(n)]], [document.documentElement]) : new qe([[n]], xm);
}
function c2(n) {
  let a;
  for (; a = n.sourceEvent; ) n = a;
  return n;
}
function en(n, a) {
  if (n = c2(n), a === void 0 && (a = n.currentTarget), a) {
    var o = a.ownerSVGElement || a;
    if (o.createSVGPoint) {
      var s = o.createSVGPoint();
      return s.x = n.clientX, s.y = n.clientY, s = s.matrixTransform(a.getScreenCTM().inverse()), [s.x, s.y];
    }
    if (a.getBoundingClientRect) {
      var u = a.getBoundingClientRect();
      return [n.clientX - u.left - a.clientLeft, n.clientY - u.top - a.clientTop];
    }
  }
  return [n.pageX, n.pageY];
}
const f2 = { passive: !1 }, po = { capture: !0, passive: !1 };
function vf(n) {
  n.stopImmediatePropagation();
}
function Pa(n) {
  n.preventDefault(), n.stopImmediatePropagation();
}
function Sm(n) {
  var a = n.document.documentElement, o = Le(n).on("dragstart.drag", Pa, po);
  "onselectstart" in a ? o.on("selectstart.drag", Pa, po) : (a.__noselect = a.style.MozUserSelect, a.style.MozUserSelect = "none");
}
function wm(n, a) {
  var o = n.document.documentElement, s = Le(n).on("dragstart.drag", null);
  a && (s.on("click.drag", Pa, po), setTimeout(function() {
    s.on("click.drag", null);
  }, 0)), "onselectstart" in o ? s.on("selectstart.drag", null) : (o.style.MozUserSelect = o.__noselect, delete o.__noselect);
}
const ir = (n) => () => n;
function Yf(n, {
  sourceEvent: a,
  subject: o,
  target: s,
  identifier: u,
  active: f,
  x: d,
  y: h,
  dx: p,
  dy: g,
  dispatch: m
}) {
  Object.defineProperties(this, {
    type: { value: n, enumerable: !0, configurable: !0 },
    sourceEvent: { value: a, enumerable: !0, configurable: !0 },
    subject: { value: o, enumerable: !0, configurable: !0 },
    target: { value: s, enumerable: !0, configurable: !0 },
    identifier: { value: u, enumerable: !0, configurable: !0 },
    active: { value: f, enumerable: !0, configurable: !0 },
    x: { value: d, enumerable: !0, configurable: !0 },
    y: { value: h, enumerable: !0, configurable: !0 },
    dx: { value: p, enumerable: !0, configurable: !0 },
    dy: { value: g, enumerable: !0, configurable: !0 },
    _: { value: m }
  });
}
Yf.prototype.on = function() {
  var n = this._.on.apply(this._, arguments);
  return n === this._ ? this : n;
};
function d2(n) {
  return !n.ctrlKey && !n.button;
}
function h2() {
  return this.parentNode;
}
function g2(n, a) {
  return a ?? { x: n.x, y: n.y };
}
function p2() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function Em() {
  var n = d2, a = h2, o = g2, s = p2, u = {}, f = Dr("start", "drag", "end"), d = 0, h, p, g, m, v = 0;
  function b(z) {
    z.on("mousedown.drag", S).filter(s).on("touchstart.drag", _).on("touchmove.drag", C, f2).on("touchend.drag touchcancel.drag", D).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  function S(z, q) {
    if (!(m || !n.call(this, z, q))) {
      var B = w(this, a.call(this, z, q), z, q, "mouse");
      B && (Le(z.view).on("mousemove.drag", E, po).on("mouseup.drag", A, po), Sm(z.view), vf(z), g = !1, h = z.clientX, p = z.clientY, B("start", z));
    }
  }
  function E(z) {
    if (Pa(z), !g) {
      var q = z.clientX - h, B = z.clientY - p;
      g = q * q + B * B > v;
    }
    u.mouse("drag", z);
  }
  function A(z) {
    Le(z.view).on("mousemove.drag mouseup.drag", null), wm(z.view, g), Pa(z), u.mouse("end", z);
  }
  function _(z, q) {
    if (n.call(this, z, q)) {
      var B = z.changedTouches, U = a.call(this, z, q), Q = B.length, Z, ot;
      for (Z = 0; Z < Q; ++Z)
        (ot = w(this, U, z, q, B[Z].identifier, B[Z])) && (vf(z), ot("start", z, B[Z]));
    }
  }
  function C(z) {
    var q = z.changedTouches, B = q.length, U, Q;
    for (U = 0; U < B; ++U)
      (Q = u[q[U].identifier]) && (Pa(z), Q("drag", z, q[U]));
  }
  function D(z) {
    var q = z.changedTouches, B = q.length, U, Q;
    for (m && clearTimeout(m), m = setTimeout(function() {
      m = null;
    }, 500), U = 0; U < B; ++U)
      (Q = u[q[U].identifier]) && (vf(z), Q("end", z, q[U]));
  }
  function w(z, q, B, U, Q, Z) {
    var ot = f.copy(), X = en(Z || B, q), k, it, O;
    if ((O = o.call(z, new Yf("beforestart", {
      sourceEvent: B,
      target: b,
      identifier: Q,
      active: d,
      x: X[0],
      y: X[1],
      dx: 0,
      dy: 0,
      dispatch: ot
    }), U)) != null)
      return k = O.x - X[0] || 0, it = O.y - X[1] || 0, function G(N, H, Y) {
        var K = X, tt;
        switch (N) {
          case "start":
            u[Q] = G, tt = d++;
            break;
          case "end":
            delete u[Q], --d;
          // falls through
          case "drag":
            X = en(Y || H, q), tt = d;
            break;
        }
        ot.call(
          N,
          z,
          new Yf(N, {
            sourceEvent: H,
            subject: O,
            target: b,
            identifier: Q,
            active: tt,
            x: X[0] + k,
            y: X[1] + it,
            dx: X[0] - K[0],
            dy: X[1] - K[1],
            dispatch: ot
          }),
          U
        );
      };
  }
  return b.filter = function(z) {
    return arguments.length ? (n = typeof z == "function" ? z : ir(!!z), b) : n;
  }, b.container = function(z) {
    return arguments.length ? (a = typeof z == "function" ? z : ir(z), b) : a;
  }, b.subject = function(z) {
    return arguments.length ? (o = typeof z == "function" ? z : ir(z), b) : o;
  }, b.touchable = function(z) {
    return arguments.length ? (s = typeof z == "function" ? z : ir(!!z), b) : s;
  }, b.on = function() {
    var z = f.on.apply(f, arguments);
    return z === f ? b : z;
  }, b.clickDistance = function(z) {
    return arguments.length ? (v = (z = +z) * z, b) : Math.sqrt(v);
  }, b;
}
function ud(n, a, o) {
  n.prototype = a.prototype = o, o.constructor = n;
}
function _m(n, a) {
  var o = Object.create(n.prototype);
  for (var s in a) o[s] = a[s];
  return o;
}
function Ao() {
}
var yo = 0.7, xr = 1 / yo, tl = "\\s*([+-]?\\d+)\\s*", mo = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", pn = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", y2 = /^#([0-9a-f]{3,8})$/, m2 = new RegExp(`^rgb\\(${tl},${tl},${tl}\\)$`), v2 = new RegExp(`^rgb\\(${pn},${pn},${pn}\\)$`), b2 = new RegExp(`^rgba\\(${tl},${tl},${tl},${mo}\\)$`), x2 = new RegExp(`^rgba\\(${pn},${pn},${pn},${mo}\\)$`), S2 = new RegExp(`^hsl\\(${mo},${pn},${pn}\\)$`), w2 = new RegExp(`^hsla\\(${mo},${pn},${pn},${mo}\\)$`), Uy = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
ud(Ao, ia, {
  copy(n) {
    return Object.assign(new this.constructor(), this, n);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: By,
  // Deprecated! Use color.formatHex.
  formatHex: By,
  formatHex8: E2,
  formatHsl: _2,
  formatRgb: Ly,
  toString: Ly
});
function By() {
  return this.rgb().formatHex();
}
function E2() {
  return this.rgb().formatHex8();
}
function _2() {
  return Cm(this).formatHsl();
}
function Ly() {
  return this.rgb().formatRgb();
}
function ia(n) {
  var a, o;
  return n = (n + "").trim().toLowerCase(), (a = y2.exec(n)) ? (o = a[1].length, a = parseInt(a[1], 16), o === 6 ? qy(a) : o === 3 ? new Me(a >> 8 & 15 | a >> 4 & 240, a >> 4 & 15 | a & 240, (a & 15) << 4 | a & 15, 1) : o === 8 ? ar(a >> 24 & 255, a >> 16 & 255, a >> 8 & 255, (a & 255) / 255) : o === 4 ? ar(a >> 12 & 15 | a >> 8 & 240, a >> 8 & 15 | a >> 4 & 240, a >> 4 & 15 | a & 240, ((a & 15) << 4 | a & 15) / 255) : null) : (a = m2.exec(n)) ? new Me(a[1], a[2], a[3], 1) : (a = v2.exec(n)) ? new Me(a[1] * 255 / 100, a[2] * 255 / 100, a[3] * 255 / 100, 1) : (a = b2.exec(n)) ? ar(a[1], a[2], a[3], a[4]) : (a = x2.exec(n)) ? ar(a[1] * 255 / 100, a[2] * 255 / 100, a[3] * 255 / 100, a[4]) : (a = S2.exec(n)) ? Qy(a[1], a[2] / 100, a[3] / 100, 1) : (a = w2.exec(n)) ? Qy(a[1], a[2] / 100, a[3] / 100, a[4]) : Uy.hasOwnProperty(n) ? qy(Uy[n]) : n === "transparent" ? new Me(NaN, NaN, NaN, 0) : null;
}
function qy(n) {
  return new Me(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function ar(n, a, o, s) {
  return s <= 0 && (n = a = o = NaN), new Me(n, a, o, s);
}
function C2(n) {
  return n instanceof Ao || (n = ia(n)), n ? (n = n.rgb(), new Me(n.r, n.g, n.b, n.opacity)) : new Me();
}
function Vf(n, a, o, s) {
  return arguments.length === 1 ? C2(n) : new Me(n, a, o, s ?? 1);
}
function Me(n, a, o, s) {
  this.r = +n, this.g = +a, this.b = +o, this.opacity = +s;
}
ud(Me, Vf, _m(Ao, {
  brighter(n) {
    return n = n == null ? xr : Math.pow(xr, n), new Me(this.r * n, this.g * n, this.b * n, this.opacity);
  },
  darker(n) {
    return n = n == null ? yo : Math.pow(yo, n), new Me(this.r * n, this.g * n, this.b * n, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Me(ea(this.r), ea(this.g), ea(this.b), Sr(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: Yy,
  // Deprecated! Use color.formatHex.
  formatHex: Yy,
  formatHex8: N2,
  formatRgb: Vy,
  toString: Vy
}));
function Yy() {
  return `#${ta(this.r)}${ta(this.g)}${ta(this.b)}`;
}
function N2() {
  return `#${ta(this.r)}${ta(this.g)}${ta(this.b)}${ta((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function Vy() {
  const n = Sr(this.opacity);
  return `${n === 1 ? "rgb(" : "rgba("}${ea(this.r)}, ${ea(this.g)}, ${ea(this.b)}${n === 1 ? ")" : `, ${n})`}`;
}
function Sr(n) {
  return isNaN(n) ? 1 : Math.max(0, Math.min(1, n));
}
function ea(n) {
  return Math.max(0, Math.min(255, Math.round(n) || 0));
}
function ta(n) {
  return n = ea(n), (n < 16 ? "0" : "") + n.toString(16);
}
function Qy(n, a, o, s) {
  return s <= 0 ? n = a = o = NaN : o <= 0 || o >= 1 ? n = a = NaN : a <= 0 && (n = NaN), new nn(n, a, o, s);
}
function Cm(n) {
  if (n instanceof nn) return new nn(n.h, n.s, n.l, n.opacity);
  if (n instanceof Ao || (n = ia(n)), !n) return new nn();
  if (n instanceof nn) return n;
  n = n.rgb();
  var a = n.r / 255, o = n.g / 255, s = n.b / 255, u = Math.min(a, o, s), f = Math.max(a, o, s), d = NaN, h = f - u, p = (f + u) / 2;
  return h ? (a === f ? d = (o - s) / h + (o < s) * 6 : o === f ? d = (s - a) / h + 2 : d = (a - o) / h + 4, h /= p < 0.5 ? f + u : 2 - f - u, d *= 60) : h = p > 0 && p < 1 ? 0 : d, new nn(d, h, p, n.opacity);
}
function T2(n, a, o, s) {
  return arguments.length === 1 ? Cm(n) : new nn(n, a, o, s ?? 1);
}
function nn(n, a, o, s) {
  this.h = +n, this.s = +a, this.l = +o, this.opacity = +s;
}
ud(nn, T2, _m(Ao, {
  brighter(n) {
    return n = n == null ? xr : Math.pow(xr, n), new nn(this.h, this.s, this.l * n, this.opacity);
  },
  darker(n) {
    return n = n == null ? yo : Math.pow(yo, n), new nn(this.h, this.s, this.l * n, this.opacity);
  },
  rgb() {
    var n = this.h % 360 + (this.h < 0) * 360, a = isNaN(n) || isNaN(this.s) ? 0 : this.s, o = this.l, s = o + (o < 0.5 ? o : 1 - o) * a, u = 2 * o - s;
    return new Me(
      bf(n >= 240 ? n - 240 : n + 120, u, s),
      bf(n, u, s),
      bf(n < 120 ? n + 240 : n - 120, u, s),
      this.opacity
    );
  },
  clamp() {
    return new nn(Xy(this.h), lr(this.s), lr(this.l), Sr(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl() {
    const n = Sr(this.opacity);
    return `${n === 1 ? "hsl(" : "hsla("}${Xy(this.h)}, ${lr(this.s) * 100}%, ${lr(this.l) * 100}%${n === 1 ? ")" : `, ${n})`}`;
  }
}));
function Xy(n) {
  return n = (n || 0) % 360, n < 0 ? n + 360 : n;
}
function lr(n) {
  return Math.max(0, Math.min(1, n || 0));
}
function bf(n, a, o) {
  return (n < 60 ? a + (o - a) * n / 60 : n < 180 ? o : n < 240 ? a + (o - a) * (240 - n) / 60 : a) * 255;
}
const cd = (n) => () => n;
function A2(n, a) {
  return function(o) {
    return n + o * a;
  };
}
function M2(n, a, o) {
  return n = Math.pow(n, o), a = Math.pow(a, o) - n, o = 1 / o, function(s) {
    return Math.pow(n + s * a, o);
  };
}
function z2(n) {
  return (n = +n) == 1 ? Nm : function(a, o) {
    return o - a ? M2(a, o, n) : cd(isNaN(a) ? o : a);
  };
}
function Nm(n, a) {
  var o = a - n;
  return o ? A2(n, o) : cd(isNaN(n) ? a : n);
}
const wr = (function n(a) {
  var o = z2(a);
  function s(u, f) {
    var d = o((u = Vf(u)).r, (f = Vf(f)).r), h = o(u.g, f.g), p = o(u.b, f.b), g = Nm(u.opacity, f.opacity);
    return function(m) {
      return u.r = d(m), u.g = h(m), u.b = p(m), u.opacity = g(m), u + "";
    };
  }
  return s.gamma = n, s;
})(1);
function O2(n, a) {
  a || (a = []);
  var o = n ? Math.min(a.length, n.length) : 0, s = a.slice(), u;
  return function(f) {
    for (u = 0; u < o; ++u) s[u] = n[u] * (1 - f) + a[u] * f;
    return s;
  };
}
function D2(n) {
  return ArrayBuffer.isView(n) && !(n instanceof DataView);
}
function R2(n, a) {
  var o = a ? a.length : 0, s = n ? Math.min(o, n.length) : 0, u = new Array(s), f = new Array(o), d;
  for (d = 0; d < s; ++d) u[d] = uo(n[d], a[d]);
  for (; d < o; ++d) f[d] = a[d];
  return function(h) {
    for (d = 0; d < s; ++d) f[d] = u[d](h);
    return f;
  };
}
function H2(n, a) {
  var o = /* @__PURE__ */ new Date();
  return n = +n, a = +a, function(s) {
    return o.setTime(n * (1 - s) + a * s), o;
  };
}
function gn(n, a) {
  return n = +n, a = +a, function(o) {
    return n * (1 - o) + a * o;
  };
}
function j2(n, a) {
  var o = {}, s = {}, u;
  (n === null || typeof n != "object") && (n = {}), (a === null || typeof a != "object") && (a = {});
  for (u in a)
    u in n ? o[u] = uo(n[u], a[u]) : s[u] = a[u];
  return function(f) {
    for (u in o) s[u] = o[u](f);
    return s;
  };
}
var Qf = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, xf = new RegExp(Qf.source, "g");
function U2(n) {
  return function() {
    return n;
  };
}
function B2(n) {
  return function(a) {
    return n(a) + "";
  };
}
function Tm(n, a) {
  var o = Qf.lastIndex = xf.lastIndex = 0, s, u, f, d = -1, h = [], p = [];
  for (n = n + "", a = a + ""; (s = Qf.exec(n)) && (u = xf.exec(a)); )
    (f = u.index) > o && (f = a.slice(o, f), h[d] ? h[d] += f : h[++d] = f), (s = s[0]) === (u = u[0]) ? h[d] ? h[d] += u : h[++d] = u : (h[++d] = null, p.push({ i: d, x: gn(s, u) })), o = xf.lastIndex;
  return o < a.length && (f = a.slice(o), h[d] ? h[d] += f : h[++d] = f), h.length < 2 ? p[0] ? B2(p[0].x) : U2(a) : (a = p.length, function(g) {
    for (var m = 0, v; m < a; ++m) h[(v = p[m]).i] = v.x(g);
    return h.join("");
  });
}
function uo(n, a) {
  var o = typeof a, s;
  return a == null || o === "boolean" ? cd(a) : (o === "number" ? gn : o === "string" ? (s = ia(a)) ? (a = s, wr) : Tm : a instanceof ia ? wr : a instanceof Date ? H2 : D2(a) ? O2 : Array.isArray(a) ? R2 : typeof a.valueOf != "function" && typeof a.toString != "function" || isNaN(a) ? j2 : gn)(n, a);
}
var ky = 180 / Math.PI, Xf = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function Am(n, a, o, s, u, f) {
  var d, h, p;
  return (d = Math.sqrt(n * n + a * a)) && (n /= d, a /= d), (p = n * o + a * s) && (o -= n * p, s -= a * p), (h = Math.sqrt(o * o + s * s)) && (o /= h, s /= h, p /= h), n * s < a * o && (n = -n, a = -a, p = -p, d = -d), {
    translateX: u,
    translateY: f,
    rotate: Math.atan2(a, n) * ky,
    skewX: Math.atan(p) * ky,
    scaleX: d,
    scaleY: h
  };
}
var or;
function L2(n) {
  const a = new (typeof DOMMatrix == "function" ? DOMMatrix : WebKitCSSMatrix)(n + "");
  return a.isIdentity ? Xf : Am(a.a, a.b, a.c, a.d, a.e, a.f);
}
function q2(n) {
  return n == null || (or || (or = document.createElementNS("http://www.w3.org/2000/svg", "g")), or.setAttribute("transform", n), !(n = or.transform.baseVal.consolidate())) ? Xf : (n = n.matrix, Am(n.a, n.b, n.c, n.d, n.e, n.f));
}
function Mm(n, a, o, s) {
  function u(g) {
    return g.length ? g.pop() + " " : "";
  }
  function f(g, m, v, b, S, E) {
    if (g !== v || m !== b) {
      var A = S.push("translate(", null, a, null, o);
      E.push({ i: A - 4, x: gn(g, v) }, { i: A - 2, x: gn(m, b) });
    } else (v || b) && S.push("translate(" + v + a + b + o);
  }
  function d(g, m, v, b) {
    g !== m ? (g - m > 180 ? m += 360 : m - g > 180 && (g += 360), b.push({ i: v.push(u(v) + "rotate(", null, s) - 2, x: gn(g, m) })) : m && v.push(u(v) + "rotate(" + m + s);
  }
  function h(g, m, v, b) {
    g !== m ? b.push({ i: v.push(u(v) + "skewX(", null, s) - 2, x: gn(g, m) }) : m && v.push(u(v) + "skewX(" + m + s);
  }
  function p(g, m, v, b, S, E) {
    if (g !== v || m !== b) {
      var A = S.push(u(S) + "scale(", null, ",", null, ")");
      E.push({ i: A - 4, x: gn(g, v) }, { i: A - 2, x: gn(m, b) });
    } else (v !== 1 || b !== 1) && S.push(u(S) + "scale(" + v + "," + b + ")");
  }
  return function(g, m) {
    var v = [], b = [];
    return g = n(g), m = n(m), f(g.translateX, g.translateY, m.translateX, m.translateY, v, b), d(g.rotate, m.rotate, v, b), h(g.skewX, m.skewX, v, b), p(g.scaleX, g.scaleY, m.scaleX, m.scaleY, v, b), g = m = null, function(S) {
      for (var E = -1, A = b.length, _; ++E < A; ) v[(_ = b[E]).i] = _.x(S);
      return v.join("");
    };
  };
}
var Y2 = Mm(L2, "px, ", "px)", "deg)"), V2 = Mm(q2, ", ", ")", ")"), Q2 = 1e-12;
function Gy(n) {
  return ((n = Math.exp(n)) + 1 / n) / 2;
}
function X2(n) {
  return ((n = Math.exp(n)) - 1 / n) / 2;
}
function k2(n) {
  return ((n = Math.exp(2 * n)) - 1) / (n + 1);
}
const hr = (function n(a, o, s) {
  function u(f, d) {
    var h = f[0], p = f[1], g = f[2], m = d[0], v = d[1], b = d[2], S = m - h, E = v - p, A = S * S + E * E, _, C;
    if (A < Q2)
      C = Math.log(b / g) / a, _ = function(U) {
        return [
          h + U * S,
          p + U * E,
          g * Math.exp(a * U * C)
        ];
      };
    else {
      var D = Math.sqrt(A), w = (b * b - g * g + s * A) / (2 * g * o * D), z = (b * b - g * g - s * A) / (2 * b * o * D), q = Math.log(Math.sqrt(w * w + 1) - w), B = Math.log(Math.sqrt(z * z + 1) - z);
      C = (B - q) / a, _ = function(U) {
        var Q = U * C, Z = Gy(q), ot = g / (o * D) * (Z * k2(a * Q + q) - X2(q));
        return [
          h + ot * S,
          p + ot * E,
          g * Z / Gy(a * Q + q)
        ];
      };
    }
    return _.duration = C * 1e3 * a / Math.SQRT2, _;
  }
  return u.rho = function(f) {
    var d = Math.max(1e-3, +f), h = d * d, p = h * h;
    return n(d, h, p);
  }, u;
})(Math.SQRT2, 2, 4);
var nl = 0, oo = 0, io = 0, zm = 1e3, Er, so, _r = 0, aa = 0, Hr = 0, vo = typeof performance == "object" && performance.now ? performance : Date, Om = typeof window == "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(n) {
  setTimeout(n, 17);
};
function fd() {
  return aa || (Om(G2), aa = vo.now() + Hr);
}
function G2() {
  aa = 0;
}
function Cr() {
  this._call = this._time = this._next = null;
}
Cr.prototype = Dm.prototype = {
  constructor: Cr,
  restart: function(n, a, o) {
    if (typeof n != "function") throw new TypeError("callback is not a function");
    o = (o == null ? fd() : +o) + (a == null ? 0 : +a), !this._next && so !== this && (so ? so._next = this : Er = this, so = this), this._call = n, this._time = o, kf();
  },
  stop: function() {
    this._call && (this._call = null, this._time = 1 / 0, kf());
  }
};
function Dm(n, a, o) {
  var s = new Cr();
  return s.restart(n, a, o), s;
}
function Z2() {
  fd(), ++nl;
  for (var n = Er, a; n; )
    (a = aa - n._time) >= 0 && n._call.call(void 0, a), n = n._next;
  --nl;
}
function Zy() {
  aa = (_r = vo.now()) + Hr, nl = oo = 0;
  try {
    Z2();
  } finally {
    nl = 0, $2(), aa = 0;
  }
}
function K2() {
  var n = vo.now(), a = n - _r;
  a > zm && (Hr -= a, _r = n);
}
function $2() {
  for (var n, a = Er, o, s = 1 / 0; a; )
    a._call ? (s > a._time && (s = a._time), n = a, a = a._next) : (o = a._next, a._next = null, a = n ? n._next = o : Er = o);
  so = n, kf(s);
}
function kf(n) {
  if (!nl) {
    oo && (oo = clearTimeout(oo));
    var a = n - aa;
    a > 24 ? (n < 1 / 0 && (oo = setTimeout(Zy, n - vo.now() - Hr)), io && (io = clearInterval(io))) : (io || (_r = vo.now(), io = setInterval(K2, zm)), nl = 1, Om(Zy));
  }
}
function Ky(n, a, o) {
  var s = new Cr();
  return a = a == null ? 0 : +a, s.restart((u) => {
    s.stop(), n(u + a);
  }, a, o), s;
}
var J2 = Dr("start", "end", "cancel", "interrupt"), F2 = [], Rm = 0, $y = 1, Gf = 2, gr = 3, Jy = 4, Zf = 5, pr = 6;
function jr(n, a, o, s, u, f) {
  var d = n.__transition;
  if (!d) n.__transition = {};
  else if (o in d) return;
  I2(n, o, {
    name: a,
    index: s,
    // For context during callback.
    group: u,
    // For context during callback.
    on: J2,
    tween: F2,
    time: f.time,
    delay: f.delay,
    duration: f.duration,
    ease: f.ease,
    timer: null,
    state: Rm
  });
}
function dd(n, a) {
  var o = on(n, a);
  if (o.state > Rm) throw new Error("too late; already scheduled");
  return o;
}
function mn(n, a) {
  var o = on(n, a);
  if (o.state > gr) throw new Error("too late; already running");
  return o;
}
function on(n, a) {
  var o = n.__transition;
  if (!o || !(o = o[a])) throw new Error("transition not found");
  return o;
}
function I2(n, a, o) {
  var s = n.__transition, u;
  s[a] = o, o.timer = Dm(f, 0, o.time);
  function f(g) {
    o.state = $y, o.timer.restart(d, o.delay, o.time), o.delay <= g && d(g - o.delay);
  }
  function d(g) {
    var m, v, b, S;
    if (o.state !== $y) return p();
    for (m in s)
      if (S = s[m], S.name === o.name) {
        if (S.state === gr) return Ky(d);
        S.state === Jy ? (S.state = pr, S.timer.stop(), S.on.call("interrupt", n, n.__data__, S.index, S.group), delete s[m]) : +m < a && (S.state = pr, S.timer.stop(), S.on.call("cancel", n, n.__data__, S.index, S.group), delete s[m]);
      }
    if (Ky(function() {
      o.state === gr && (o.state = Jy, o.timer.restart(h, o.delay, o.time), h(g));
    }), o.state = Gf, o.on.call("start", n, n.__data__, o.index, o.group), o.state === Gf) {
      for (o.state = gr, u = new Array(b = o.tween.length), m = 0, v = -1; m < b; ++m)
        (S = o.tween[m].value.call(n, n.__data__, o.index, o.group)) && (u[++v] = S);
      u.length = v + 1;
    }
  }
  function h(g) {
    for (var m = g < o.duration ? o.ease.call(null, g / o.duration) : (o.timer.restart(p), o.state = Zf, 1), v = -1, b = u.length; ++v < b; )
      u[v].call(n, m);
    o.state === Zf && (o.on.call("end", n, n.__data__, o.index, o.group), p());
  }
  function p() {
    o.state = pr, o.timer.stop(), delete s[a];
    for (var g in s) return;
    delete n.__transition;
  }
}
function yr(n, a) {
  var o = n.__transition, s, u, f = !0, d;
  if (o) {
    a = a == null ? null : a + "";
    for (d in o) {
      if ((s = o[d]).name !== a) {
        f = !1;
        continue;
      }
      u = s.state > Gf && s.state < Zf, s.state = pr, s.timer.stop(), s.on.call(u ? "interrupt" : "cancel", n, n.__data__, s.index, s.group), delete o[d];
    }
    f && delete n.__transition;
  }
}
function W2(n) {
  return this.each(function() {
    yr(this, n);
  });
}
function P2(n, a) {
  var o, s;
  return function() {
    var u = mn(this, n), f = u.tween;
    if (f !== o) {
      s = o = f;
      for (var d = 0, h = s.length; d < h; ++d)
        if (s[d].name === a) {
          s = s.slice(), s.splice(d, 1);
          break;
        }
    }
    u.tween = s;
  };
}
function tE(n, a, o) {
  var s, u;
  if (typeof o != "function") throw new Error();
  return function() {
    var f = mn(this, n), d = f.tween;
    if (d !== s) {
      u = (s = d).slice();
      for (var h = { name: a, value: o }, p = 0, g = u.length; p < g; ++p)
        if (u[p].name === a) {
          u[p] = h;
          break;
        }
      p === g && u.push(h);
    }
    f.tween = u;
  };
}
function eE(n, a) {
  var o = this._id;
  if (n += "", arguments.length < 2) {
    for (var s = on(this.node(), o).tween, u = 0, f = s.length, d; u < f; ++u)
      if ((d = s[u]).name === n)
        return d.value;
    return null;
  }
  return this.each((a == null ? P2 : tE)(o, n, a));
}
function hd(n, a, o) {
  var s = n._id;
  return n.each(function() {
    var u = mn(this, s);
    (u.value || (u.value = {}))[a] = o.apply(this, arguments);
  }), function(u) {
    return on(u, s).value[a];
  };
}
function Hm(n, a) {
  var o;
  return (typeof a == "number" ? gn : a instanceof ia ? wr : (o = ia(a)) ? (a = o, wr) : Tm)(n, a);
}
function nE(n) {
  return function() {
    this.removeAttribute(n);
  };
}
function iE(n) {
  return function() {
    this.removeAttributeNS(n.space, n.local);
  };
}
function aE(n, a, o) {
  var s, u = o + "", f;
  return function() {
    var d = this.getAttribute(n);
    return d === u ? null : d === s ? f : f = a(s = d, o);
  };
}
function lE(n, a, o) {
  var s, u = o + "", f;
  return function() {
    var d = this.getAttributeNS(n.space, n.local);
    return d === u ? null : d === s ? f : f = a(s = d, o);
  };
}
function oE(n, a, o) {
  var s, u, f;
  return function() {
    var d, h = o(this), p;
    return h == null ? void this.removeAttribute(n) : (d = this.getAttribute(n), p = h + "", d === p ? null : d === s && p === u ? f : (u = p, f = a(s = d, h)));
  };
}
function sE(n, a, o) {
  var s, u, f;
  return function() {
    var d, h = o(this), p;
    return h == null ? void this.removeAttributeNS(n.space, n.local) : (d = this.getAttributeNS(n.space, n.local), p = h + "", d === p ? null : d === s && p === u ? f : (u = p, f = a(s = d, h)));
  };
}
function rE(n, a) {
  var o = Rr(n), s = o === "transform" ? V2 : Hm;
  return this.attrTween(n, typeof a == "function" ? (o.local ? sE : oE)(o, s, hd(this, "attr." + n, a)) : a == null ? (o.local ? iE : nE)(o) : (o.local ? lE : aE)(o, s, a));
}
function uE(n, a) {
  return function(o) {
    this.setAttribute(n, a.call(this, o));
  };
}
function cE(n, a) {
  return function(o) {
    this.setAttributeNS(n.space, n.local, a.call(this, o));
  };
}
function fE(n, a) {
  var o, s;
  function u() {
    var f = a.apply(this, arguments);
    return f !== s && (o = (s = f) && cE(n, f)), o;
  }
  return u._value = a, u;
}
function dE(n, a) {
  var o, s;
  function u() {
    var f = a.apply(this, arguments);
    return f !== s && (o = (s = f) && uE(n, f)), o;
  }
  return u._value = a, u;
}
function hE(n, a) {
  var o = "attr." + n;
  if (arguments.length < 2) return (o = this.tween(o)) && o._value;
  if (a == null) return this.tween(o, null);
  if (typeof a != "function") throw new Error();
  var s = Rr(n);
  return this.tween(o, (s.local ? fE : dE)(s, a));
}
function gE(n, a) {
  return function() {
    dd(this, n).delay = +a.apply(this, arguments);
  };
}
function pE(n, a) {
  return a = +a, function() {
    dd(this, n).delay = a;
  };
}
function yE(n) {
  var a = this._id;
  return arguments.length ? this.each((typeof n == "function" ? gE : pE)(a, n)) : on(this.node(), a).delay;
}
function mE(n, a) {
  return function() {
    mn(this, n).duration = +a.apply(this, arguments);
  };
}
function vE(n, a) {
  return a = +a, function() {
    mn(this, n).duration = a;
  };
}
function bE(n) {
  var a = this._id;
  return arguments.length ? this.each((typeof n == "function" ? mE : vE)(a, n)) : on(this.node(), a).duration;
}
function xE(n, a) {
  if (typeof a != "function") throw new Error();
  return function() {
    mn(this, n).ease = a;
  };
}
function SE(n) {
  var a = this._id;
  return arguments.length ? this.each(xE(a, n)) : on(this.node(), a).ease;
}
function wE(n, a) {
  return function() {
    var o = a.apply(this, arguments);
    if (typeof o != "function") throw new Error();
    mn(this, n).ease = o;
  };
}
function EE(n) {
  if (typeof n != "function") throw new Error();
  return this.each(wE(this._id, n));
}
function _E(n) {
  typeof n != "function" && (n = fm(n));
  for (var a = this._groups, o = a.length, s = new Array(o), u = 0; u < o; ++u)
    for (var f = a[u], d = f.length, h = s[u] = [], p, g = 0; g < d; ++g)
      (p = f[g]) && n.call(p, p.__data__, g, f) && h.push(p);
  return new kn(s, this._parents, this._name, this._id);
}
function CE(n) {
  if (n._id !== this._id) throw new Error();
  for (var a = this._groups, o = n._groups, s = a.length, u = o.length, f = Math.min(s, u), d = new Array(s), h = 0; h < f; ++h)
    for (var p = a[h], g = o[h], m = p.length, v = d[h] = new Array(m), b, S = 0; S < m; ++S)
      (b = p[S] || g[S]) && (v[S] = b);
  for (; h < s; ++h)
    d[h] = a[h];
  return new kn(d, this._parents, this._name, this._id);
}
function NE(n) {
  return (n + "").trim().split(/^|\s+/).every(function(a) {
    var o = a.indexOf(".");
    return o >= 0 && (a = a.slice(0, o)), !a || a === "start";
  });
}
function TE(n, a, o) {
  var s, u, f = NE(a) ? dd : mn;
  return function() {
    var d = f(this, n), h = d.on;
    h !== s && (u = (s = h).copy()).on(a, o), d.on = u;
  };
}
function AE(n, a) {
  var o = this._id;
  return arguments.length < 2 ? on(this.node(), o).on.on(n) : this.each(TE(o, n, a));
}
function ME(n) {
  return function() {
    var a = this.parentNode;
    for (var o in this.__transition) if (+o !== n) return;
    a && a.removeChild(this);
  };
}
function zE() {
  return this.on("end.remove", ME(this._id));
}
function OE(n) {
  var a = this._name, o = this._id;
  typeof n != "function" && (n = sd(n));
  for (var s = this._groups, u = s.length, f = new Array(u), d = 0; d < u; ++d)
    for (var h = s[d], p = h.length, g = f[d] = new Array(p), m, v, b = 0; b < p; ++b)
      (m = h[b]) && (v = n.call(m, m.__data__, b, h)) && ("__data__" in m && (v.__data__ = m.__data__), g[b] = v, jr(g[b], a, o, b, g, on(m, o)));
  return new kn(f, this._parents, a, o);
}
function DE(n) {
  var a = this._name, o = this._id;
  typeof n != "function" && (n = cm(n));
  for (var s = this._groups, u = s.length, f = [], d = [], h = 0; h < u; ++h)
    for (var p = s[h], g = p.length, m, v = 0; v < g; ++v)
      if (m = p[v]) {
        for (var b = n.call(m, m.__data__, v, p), S, E = on(m, o), A = 0, _ = b.length; A < _; ++A)
          (S = b[A]) && jr(S, a, o, A, b, E);
        f.push(b), d.push(m);
      }
  return new kn(f, d, a, o);
}
var RE = To.prototype.constructor;
function HE() {
  return new RE(this._groups, this._parents);
}
function jE(n, a) {
  var o, s, u;
  return function() {
    var f = el(this, n), d = (this.style.removeProperty(n), el(this, n));
    return f === d ? null : f === o && d === s ? u : u = a(o = f, s = d);
  };
}
function jm(n) {
  return function() {
    this.style.removeProperty(n);
  };
}
function UE(n, a, o) {
  var s, u = o + "", f;
  return function() {
    var d = el(this, n);
    return d === u ? null : d === s ? f : f = a(s = d, o);
  };
}
function BE(n, a, o) {
  var s, u, f;
  return function() {
    var d = el(this, n), h = o(this), p = h + "";
    return h == null && (p = h = (this.style.removeProperty(n), el(this, n))), d === p ? null : d === s && p === u ? f : (u = p, f = a(s = d, h));
  };
}
function LE(n, a) {
  var o, s, u, f = "style." + a, d = "end." + f, h;
  return function() {
    var p = mn(this, n), g = p.on, m = p.value[f] == null ? h || (h = jm(a)) : void 0;
    (g !== o || u !== m) && (s = (o = g).copy()).on(d, u = m), p.on = s;
  };
}
function qE(n, a, o) {
  var s = (n += "") == "transform" ? Y2 : Hm;
  return a == null ? this.styleTween(n, jE(n, s)).on("end.style." + n, jm(n)) : typeof a == "function" ? this.styleTween(n, BE(n, s, hd(this, "style." + n, a))).each(LE(this._id, n)) : this.styleTween(n, UE(n, s, a), o).on("end.style." + n, null);
}
function YE(n, a, o) {
  return function(s) {
    this.style.setProperty(n, a.call(this, s), o);
  };
}
function VE(n, a, o) {
  var s, u;
  function f() {
    var d = a.apply(this, arguments);
    return d !== u && (s = (u = d) && YE(n, d, o)), s;
  }
  return f._value = a, f;
}
function QE(n, a, o) {
  var s = "style." + (n += "");
  if (arguments.length < 2) return (s = this.tween(s)) && s._value;
  if (a == null) return this.tween(s, null);
  if (typeof a != "function") throw new Error();
  return this.tween(s, VE(n, a, o ?? ""));
}
function XE(n) {
  return function() {
    this.textContent = n;
  };
}
function kE(n) {
  return function() {
    var a = n(this);
    this.textContent = a ?? "";
  };
}
function GE(n) {
  return this.tween("text", typeof n == "function" ? kE(hd(this, "text", n)) : XE(n == null ? "" : n + ""));
}
function ZE(n) {
  return function(a) {
    this.textContent = n.call(this, a);
  };
}
function KE(n) {
  var a, o;
  function s() {
    var u = n.apply(this, arguments);
    return u !== o && (a = (o = u) && ZE(u)), a;
  }
  return s._value = n, s;
}
function $E(n) {
  var a = "text";
  if (arguments.length < 1) return (a = this.tween(a)) && a._value;
  if (n == null) return this.tween(a, null);
  if (typeof n != "function") throw new Error();
  return this.tween(a, KE(n));
}
function JE() {
  for (var n = this._name, a = this._id, o = Um(), s = this._groups, u = s.length, f = 0; f < u; ++f)
    for (var d = s[f], h = d.length, p, g = 0; g < h; ++g)
      if (p = d[g]) {
        var m = on(p, a);
        jr(p, n, o, g, d, {
          time: m.time + m.delay + m.duration,
          delay: 0,
          duration: m.duration,
          ease: m.ease
        });
      }
  return new kn(s, this._parents, n, o);
}
function FE() {
  var n, a, o = this, s = o._id, u = o.size();
  return new Promise(function(f, d) {
    var h = { value: d }, p = { value: function() {
      --u === 0 && f();
    } };
    o.each(function() {
      var g = mn(this, s), m = g.on;
      m !== n && (a = (n = m).copy(), a._.cancel.push(h), a._.interrupt.push(h), a._.end.push(p)), g.on = a;
    }), u === 0 && f();
  });
}
var IE = 0;
function kn(n, a, o, s) {
  this._groups = n, this._parents = a, this._name = o, this._id = s;
}
function Um() {
  return ++IE;
}
var Vn = To.prototype;
kn.prototype = {
  constructor: kn,
  select: OE,
  selectAll: DE,
  selectChild: Vn.selectChild,
  selectChildren: Vn.selectChildren,
  filter: _E,
  merge: CE,
  selection: HE,
  transition: JE,
  call: Vn.call,
  nodes: Vn.nodes,
  node: Vn.node,
  size: Vn.size,
  empty: Vn.empty,
  each: Vn.each,
  on: AE,
  attr: rE,
  attrTween: hE,
  style: qE,
  styleTween: QE,
  text: GE,
  textTween: $E,
  remove: zE,
  tween: eE,
  delay: yE,
  duration: bE,
  ease: SE,
  easeVarying: EE,
  end: FE,
  [Symbol.iterator]: Vn[Symbol.iterator]
};
function WE(n) {
  return ((n *= 2) <= 1 ? n * n * n : (n -= 2) * n * n + 2) / 2;
}
var PE = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: WE
};
function t_(n, a) {
  for (var o; !(o = n.__transition) || !(o = o[a]); )
    if (!(n = n.parentNode))
      throw new Error(`transition ${a} not found`);
  return o;
}
function e_(n) {
  var a, o;
  n instanceof kn ? (a = n._id, n = n._name) : (a = Um(), (o = PE).time = fd(), n = n == null ? null : n + "");
  for (var s = this._groups, u = s.length, f = 0; f < u; ++f)
    for (var d = s[f], h = d.length, p, g = 0; g < h; ++g)
      (p = d[g]) && jr(p, n, a, g, d, o || t_(p, a));
  return new kn(s, this._parents, n, a);
}
To.prototype.interrupt = W2;
To.prototype.transition = e_;
const sr = (n) => () => n;
function n_(n, {
  sourceEvent: a,
  target: o,
  transform: s,
  dispatch: u
}) {
  Object.defineProperties(this, {
    type: { value: n, enumerable: !0, configurable: !0 },
    sourceEvent: { value: a, enumerable: !0, configurable: !0 },
    target: { value: o, enumerable: !0, configurable: !0 },
    transform: { value: s, enumerable: !0, configurable: !0 },
    _: { value: u }
  });
}
function Qn(n, a, o) {
  this.k = n, this.x = a, this.y = o;
}
Qn.prototype = {
  constructor: Qn,
  scale: function(n) {
    return n === 1 ? this : new Qn(this.k * n, this.x, this.y);
  },
  translate: function(n, a) {
    return n === 0 & a === 0 ? this : new Qn(this.k, this.x + this.k * n, this.y + this.k * a);
  },
  apply: function(n) {
    return [n[0] * this.k + this.x, n[1] * this.k + this.y];
  },
  applyX: function(n) {
    return n * this.k + this.x;
  },
  applyY: function(n) {
    return n * this.k + this.y;
  },
  invert: function(n) {
    return [(n[0] - this.x) / this.k, (n[1] - this.y) / this.k];
  },
  invertX: function(n) {
    return (n - this.x) / this.k;
  },
  invertY: function(n) {
    return (n - this.y) / this.k;
  },
  rescaleX: function(n) {
    return n.copy().domain(n.range().map(this.invertX, this).map(n.invert, n));
  },
  rescaleY: function(n) {
    return n.copy().domain(n.range().map(this.invertY, this).map(n.invert, n));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var Ur = new Qn(1, 0, 0);
Bm.prototype = Qn.prototype;
function Bm(n) {
  for (; !n.__zoom; ) if (!(n = n.parentNode)) return Ur;
  return n.__zoom;
}
function Sf(n) {
  n.stopImmediatePropagation();
}
function ao(n) {
  n.preventDefault(), n.stopImmediatePropagation();
}
function i_(n) {
  return (!n.ctrlKey || n.type === "wheel") && !n.button;
}
function a_() {
  var n = this;
  return n instanceof SVGElement ? (n = n.ownerSVGElement || n, n.hasAttribute("viewBox") ? (n = n.viewBox.baseVal, [[n.x, n.y], [n.x + n.width, n.y + n.height]]) : [[0, 0], [n.width.baseVal.value, n.height.baseVal.value]]) : [[0, 0], [n.clientWidth, n.clientHeight]];
}
function Fy() {
  return this.__zoom || Ur;
}
function l_(n) {
  return -n.deltaY * (n.deltaMode === 1 ? 0.05 : n.deltaMode ? 1 : 2e-3) * (n.ctrlKey ? 10 : 1);
}
function o_() {
  return navigator.maxTouchPoints || "ontouchstart" in this;
}
function s_(n, a, o) {
  var s = n.invertX(a[0][0]) - o[0][0], u = n.invertX(a[1][0]) - o[1][0], f = n.invertY(a[0][1]) - o[0][1], d = n.invertY(a[1][1]) - o[1][1];
  return n.translate(
    u > s ? (s + u) / 2 : Math.min(0, s) || Math.max(0, u),
    d > f ? (f + d) / 2 : Math.min(0, f) || Math.max(0, d)
  );
}
function Lm() {
  var n = i_, a = a_, o = s_, s = l_, u = o_, f = [0, 1 / 0], d = [[-1 / 0, -1 / 0], [1 / 0, 1 / 0]], h = 250, p = hr, g = Dr("start", "zoom", "end"), m, v, b, S = 500, E = 150, A = 0, _ = 10;
  function C(O) {
    O.property("__zoom", Fy).on("wheel.zoom", Q, { passive: !1 }).on("mousedown.zoom", Z).on("dblclick.zoom", ot).filter(u).on("touchstart.zoom", X).on("touchmove.zoom", k).on("touchend.zoom touchcancel.zoom", it).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
  }
  C.transform = function(O, G, N, H) {
    var Y = O.selection ? O.selection() : O;
    Y.property("__zoom", Fy), O !== Y ? q(O, G, N, H) : Y.interrupt().each(function() {
      B(this, arguments).event(H).start().zoom(null, typeof G == "function" ? G.apply(this, arguments) : G).end();
    });
  }, C.scaleBy = function(O, G, N, H) {
    C.scaleTo(O, function() {
      var Y = this.__zoom.k, K = typeof G == "function" ? G.apply(this, arguments) : G;
      return Y * K;
    }, N, H);
  }, C.scaleTo = function(O, G, N, H) {
    C.transform(O, function() {
      var Y = a.apply(this, arguments), K = this.__zoom, tt = N == null ? z(Y) : typeof N == "function" ? N.apply(this, arguments) : N, T = K.invert(tt), j = typeof G == "function" ? G.apply(this, arguments) : G;
      return o(w(D(K, j), tt, T), Y, d);
    }, N, H);
  }, C.translateBy = function(O, G, N, H) {
    C.transform(O, function() {
      return o(this.__zoom.translate(
        typeof G == "function" ? G.apply(this, arguments) : G,
        typeof N == "function" ? N.apply(this, arguments) : N
      ), a.apply(this, arguments), d);
    }, null, H);
  }, C.translateTo = function(O, G, N, H, Y) {
    C.transform(O, function() {
      var K = a.apply(this, arguments), tt = this.__zoom, T = H == null ? z(K) : typeof H == "function" ? H.apply(this, arguments) : H;
      return o(Ur.translate(T[0], T[1]).scale(tt.k).translate(
        typeof G == "function" ? -G.apply(this, arguments) : -G,
        typeof N == "function" ? -N.apply(this, arguments) : -N
      ), K, d);
    }, H, Y);
  };
  function D(O, G) {
    return G = Math.max(f[0], Math.min(f[1], G)), G === O.k ? O : new Qn(G, O.x, O.y);
  }
  function w(O, G, N) {
    var H = G[0] - N[0] * O.k, Y = G[1] - N[1] * O.k;
    return H === O.x && Y === O.y ? O : new Qn(O.k, H, Y);
  }
  function z(O) {
    return [(+O[0][0] + +O[1][0]) / 2, (+O[0][1] + +O[1][1]) / 2];
  }
  function q(O, G, N, H) {
    O.on("start.zoom", function() {
      B(this, arguments).event(H).start();
    }).on("interrupt.zoom end.zoom", function() {
      B(this, arguments).event(H).end();
    }).tween("zoom", function() {
      var Y = this, K = arguments, tt = B(Y, K).event(H), T = a.apply(Y, K), j = N == null ? z(T) : typeof N == "function" ? N.apply(Y, K) : N, P = Math.max(T[1][0] - T[0][0], T[1][1] - T[0][1]), et = Y.__zoom, rt = typeof G == "function" ? G.apply(Y, K) : G, ct = p(et.invert(j).concat(P / et.k), rt.invert(j).concat(P / rt.k));
      return function(ut) {
        if (ut === 1) ut = rt;
        else {
          var st = ct(ut), ft = P / st[2];
          ut = new Qn(ft, j[0] - st[0] * ft, j[1] - st[1] * ft);
        }
        tt.zoom(null, ut);
      };
    });
  }
  function B(O, G, N) {
    return !N && O.__zooming || new U(O, G);
  }
  function U(O, G) {
    this.that = O, this.args = G, this.active = 0, this.sourceEvent = null, this.extent = a.apply(O, G), this.taps = 0;
  }
  U.prototype = {
    event: function(O) {
      return O && (this.sourceEvent = O), this;
    },
    start: function() {
      return ++this.active === 1 && (this.that.__zooming = this, this.emit("start")), this;
    },
    zoom: function(O, G) {
      return this.mouse && O !== "mouse" && (this.mouse[1] = G.invert(this.mouse[0])), this.touch0 && O !== "touch" && (this.touch0[1] = G.invert(this.touch0[0])), this.touch1 && O !== "touch" && (this.touch1[1] = G.invert(this.touch1[0])), this.that.__zoom = G, this.emit("zoom"), this;
    },
    end: function() {
      return --this.active === 0 && (delete this.that.__zooming, this.emit("end")), this;
    },
    emit: function(O) {
      var G = Le(this.that).datum();
      g.call(
        O,
        this.that,
        new n_(O, {
          sourceEvent: this.sourceEvent,
          target: C,
          transform: this.that.__zoom,
          dispatch: g
        }),
        G
      );
    }
  };
  function Q(O, ...G) {
    if (!n.apply(this, arguments)) return;
    var N = B(this, G).event(O), H = this.__zoom, Y = Math.max(f[0], Math.min(f[1], H.k * Math.pow(2, s.apply(this, arguments)))), K = en(O);
    if (N.wheel)
      (N.mouse[0][0] !== K[0] || N.mouse[0][1] !== K[1]) && (N.mouse[1] = H.invert(N.mouse[0] = K)), clearTimeout(N.wheel);
    else {
      if (H.k === Y) return;
      N.mouse = [K, H.invert(K)], yr(this), N.start();
    }
    ao(O), N.wheel = setTimeout(tt, E), N.zoom("mouse", o(w(D(H, Y), N.mouse[0], N.mouse[1]), N.extent, d));
    function tt() {
      N.wheel = null, N.end();
    }
  }
  function Z(O, ...G) {
    if (b || !n.apply(this, arguments)) return;
    var N = O.currentTarget, H = B(this, G, !0).event(O), Y = Le(O.view).on("mousemove.zoom", j, !0).on("mouseup.zoom", P, !0), K = en(O, N), tt = O.clientX, T = O.clientY;
    Sm(O.view), Sf(O), H.mouse = [K, this.__zoom.invert(K)], yr(this), H.start();
    function j(et) {
      if (ao(et), !H.moved) {
        var rt = et.clientX - tt, ct = et.clientY - T;
        H.moved = rt * rt + ct * ct > A;
      }
      H.event(et).zoom("mouse", o(w(H.that.__zoom, H.mouse[0] = en(et, N), H.mouse[1]), H.extent, d));
    }
    function P(et) {
      Y.on("mousemove.zoom mouseup.zoom", null), wm(et.view, H.moved), ao(et), H.event(et).end();
    }
  }
  function ot(O, ...G) {
    if (n.apply(this, arguments)) {
      var N = this.__zoom, H = en(O.changedTouches ? O.changedTouches[0] : O, this), Y = N.invert(H), K = N.k * (O.shiftKey ? 0.5 : 2), tt = o(w(D(N, K), H, Y), a.apply(this, G), d);
      ao(O), h > 0 ? Le(this).transition().duration(h).call(q, tt, H, O) : Le(this).call(C.transform, tt, H, O);
    }
  }
  function X(O, ...G) {
    if (n.apply(this, arguments)) {
      var N = O.touches, H = N.length, Y = B(this, G, O.changedTouches.length === H).event(O), K, tt, T, j;
      for (Sf(O), tt = 0; tt < H; ++tt)
        T = N[tt], j = en(T, this), j = [j, this.__zoom.invert(j), T.identifier], Y.touch0 ? !Y.touch1 && Y.touch0[2] !== j[2] && (Y.touch1 = j, Y.taps = 0) : (Y.touch0 = j, K = !0, Y.taps = 1 + !!m);
      m && (m = clearTimeout(m)), K && (Y.taps < 2 && (v = j[0], m = setTimeout(function() {
        m = null;
      }, S)), yr(this), Y.start());
    }
  }
  function k(O, ...G) {
    if (this.__zooming) {
      var N = B(this, G).event(O), H = O.changedTouches, Y = H.length, K, tt, T, j;
      for (ao(O), K = 0; K < Y; ++K)
        tt = H[K], T = en(tt, this), N.touch0 && N.touch0[2] === tt.identifier ? N.touch0[0] = T : N.touch1 && N.touch1[2] === tt.identifier && (N.touch1[0] = T);
      if (tt = N.that.__zoom, N.touch1) {
        var P = N.touch0[0], et = N.touch0[1], rt = N.touch1[0], ct = N.touch1[1], ut = (ut = rt[0] - P[0]) * ut + (ut = rt[1] - P[1]) * ut, st = (st = ct[0] - et[0]) * st + (st = ct[1] - et[1]) * st;
        tt = D(tt, Math.sqrt(ut / st)), T = [(P[0] + rt[0]) / 2, (P[1] + rt[1]) / 2], j = [(et[0] + ct[0]) / 2, (et[1] + ct[1]) / 2];
      } else if (N.touch0) T = N.touch0[0], j = N.touch0[1];
      else return;
      N.zoom("touch", o(w(tt, T, j), N.extent, d));
    }
  }
  function it(O, ...G) {
    if (this.__zooming) {
      var N = B(this, G).event(O), H = O.changedTouches, Y = H.length, K, tt;
      for (Sf(O), b && clearTimeout(b), b = setTimeout(function() {
        b = null;
      }, S), K = 0; K < Y; ++K)
        tt = H[K], N.touch0 && N.touch0[2] === tt.identifier ? delete N.touch0 : N.touch1 && N.touch1[2] === tt.identifier && delete N.touch1;
      if (N.touch1 && !N.touch0 && (N.touch0 = N.touch1, delete N.touch1), N.touch0) N.touch0[1] = this.__zoom.invert(N.touch0[0]);
      else if (N.end(), N.taps === 2 && (tt = en(tt, this), Math.hypot(v[0] - tt[0], v[1] - tt[1]) < _)) {
        var T = Le(this).on("dblclick.zoom");
        T && T.apply(this, arguments);
      }
    }
  }
  return C.wheelDelta = function(O) {
    return arguments.length ? (s = typeof O == "function" ? O : sr(+O), C) : s;
  }, C.filter = function(O) {
    return arguments.length ? (n = typeof O == "function" ? O : sr(!!O), C) : n;
  }, C.touchable = function(O) {
    return arguments.length ? (u = typeof O == "function" ? O : sr(!!O), C) : u;
  }, C.extent = function(O) {
    return arguments.length ? (a = typeof O == "function" ? O : sr([[+O[0][0], +O[0][1]], [+O[1][0], +O[1][1]]]), C) : a;
  }, C.scaleExtent = function(O) {
    return arguments.length ? (f[0] = +O[0], f[1] = +O[1], C) : [f[0], f[1]];
  }, C.translateExtent = function(O) {
    return arguments.length ? (d[0][0] = +O[0][0], d[1][0] = +O[1][0], d[0][1] = +O[0][1], d[1][1] = +O[1][1], C) : [[d[0][0], d[0][1]], [d[1][0], d[1][1]]];
  }, C.constrain = function(O) {
    return arguments.length ? (o = O, C) : o;
  }, C.duration = function(O) {
    return arguments.length ? (h = +O, C) : h;
  }, C.interpolate = function(O) {
    return arguments.length ? (p = O, C) : p;
  }, C.on = function() {
    var O = g.on.apply(g, arguments);
    return O === g ? C : O;
  }, C.clickDistance = function(O) {
    return arguments.length ? (A = (O = +O) * O, C) : Math.sqrt(A);
  }, C.tapDistance = function(O) {
    return arguments.length ? (_ = +O, C) : _;
  }, C;
}
const yn = {
  error001: () => "[React Flow]: Seems like you have not used zustand provider as an ancestor. Help: https://reactflow.dev/error#001",
  error002: () => "It looks like you've created a new nodeTypes or edgeTypes object. If this wasn't on purpose please define the nodeTypes/edgeTypes outside of the component or memoize them.",
  error003: (n) => `Node type "${n}" not found. Using fallback type "default".`,
  error004: () => "The React Flow parent container needs a width and a height to render the graph.",
  error005: () => "Only child nodes can use a parent extent.",
  error006: () => "Can't create edge. An edge needs a source and a target.",
  error007: (n) => `The old edge with id=${n} does not exist.`,
  error009: (n) => `Marker type "${n}" doesn't exist.`,
  error008: (n, { id: a, sourceHandle: o, targetHandle: s }) => `Couldn't create edge for ${n} handle id: "${n === "source" ? o : s}", edge id: ${a}.`,
  error010: () => "Handle: No node id found. Make sure to only use a Handle inside a custom Node.",
  error011: (n) => `Edge type "${n}" not found. Using fallback type "default".`,
  error012: (n) => `Node with id "${n}" does not exist, it may have been removed. This can happen when a node is deleted before the "onNodeClick" handler is called.`,
  error013: (n = "react") => `It seems that you haven't loaded the styles. Please import '@xyflow/${n}/dist/style.css' or base.css to make sure everything is working properly.`,
  error014: () => "useNodeConnections: No node ID found. Call useNodeConnections inside a custom Node or provide a node ID.",
  error015: () => "It seems that you are trying to drag a node that is not initialized. Please use onNodesChange as explained in the docs."
}, bo = [
  [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
], qm = ["Enter", " ", "Escape"], Ym = {
  "node.a11yDescription.default": "Press enter or space to select a node. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.keyboardDisabled": "Press enter or space to select a node. You can then use the arrow keys to move the node around. Press delete to remove it and escape to cancel.",
  "node.a11yDescription.ariaLiveMessage": ({ direction: n, x: a, y: o }) => `Moved selected node ${n}. New position, x: ${a}, y: ${o}`,
  "edge.a11yDescription.default": "Press enter or space to select an edge. You can then press delete to remove it or escape to cancel.",
  // Control elements
  "controls.ariaLabel": "Control Panel",
  "controls.zoomIn.ariaLabel": "Zoom In",
  "controls.zoomOut.ariaLabel": "Zoom Out",
  "controls.fitView.ariaLabel": "Fit View",
  "controls.interactive.ariaLabel": "Toggle Interactivity",
  // Mini map
  "minimap.ariaLabel": "Mini Map",
  // Handle
  "handle.ariaLabel": "Handle"
};
var il;
(function(n) {
  n.Strict = "strict", n.Loose = "loose";
})(il || (il = {}));
var na;
(function(n) {
  n.Free = "free", n.Vertical = "vertical", n.Horizontal = "horizontal";
})(na || (na = {}));
var xo;
(function(n) {
  n.Partial = "partial", n.Full = "full";
})(xo || (xo = {}));
const Vm = {
  inProgress: !1,
  isValid: null,
  from: null,
  fromHandle: null,
  fromPosition: null,
  fromNode: null,
  to: null,
  toHandle: null,
  toPosition: null,
  toNode: null,
  pointer: null
};
var _i;
(function(n) {
  n.Bezier = "default", n.Straight = "straight", n.Step = "step", n.SmoothStep = "smoothstep", n.SimpleBezier = "simplebezier";
})(_i || (_i = {}));
var Nr;
(function(n) {
  n.Arrow = "arrow", n.ArrowClosed = "arrowclosed";
})(Nr || (Nr = {}));
var pt;
(function(n) {
  n.Left = "left", n.Top = "top", n.Right = "right", n.Bottom = "bottom";
})(pt || (pt = {}));
const Iy = {
  [pt.Left]: pt.Right,
  [pt.Right]: pt.Left,
  [pt.Top]: pt.Bottom,
  [pt.Bottom]: pt.Top
};
function Qm(n) {
  return n === null ? null : n ? "valid" : "invalid";
}
const Xm = (n) => "id" in n && "source" in n && "target" in n, r_ = (n) => "id" in n && "position" in n && !("source" in n) && !("target" in n), gd = (n) => "id" in n && "internals" in n && !("source" in n) && !("target" in n), Mo = (n, a = [0, 0]) => {
  const { width: o, height: s } = Zn(n), u = n.origin ?? a, f = o * u[0], d = s * u[1];
  return {
    x: n.position.x - f,
    y: n.position.y - d
  };
}, u_ = (n, a = { nodeOrigin: [0, 0] }) => {
  if (n.length === 0)
    return { x: 0, y: 0, width: 0, height: 0 };
  const o = n.reduce((s, u) => {
    const f = typeof u == "string";
    let d = !a.nodeLookup && !f ? u : void 0;
    a.nodeLookup && (d = f ? a.nodeLookup.get(u) : gd(u) ? u : a.nodeLookup.get(u.id));
    const h = d ? Tr(d, a.nodeOrigin) : { x: 0, y: 0, x2: 0, y2: 0 };
    return Br(s, h);
  }, { x: 1 / 0, y: 1 / 0, x2: -1 / 0, y2: -1 / 0 });
  return Lr(o);
}, zo = (n, a = {}) => {
  let o = { x: 1 / 0, y: 1 / 0, x2: -1 / 0, y2: -1 / 0 }, s = !1;
  return n.forEach((u) => {
    (a.filter === void 0 || a.filter(u)) && (o = Br(o, Tr(u)), s = !0);
  }), s ? Lr(o) : { x: 0, y: 0, width: 0, height: 0 };
}, pd = (n, a, [o, s, u] = [0, 0, 1], f = !1, d = !1) => {
  const h = {
    ...Do(a, [o, s, u]),
    width: a.width / u,
    height: a.height / u
  }, p = [];
  for (const g of n.values()) {
    const { measured: m, selectable: v = !0, hidden: b = !1 } = g;
    if (d && !v || b)
      continue;
    const S = m.width ?? g.width ?? g.initialWidth ?? null, E = m.height ?? g.height ?? g.initialHeight ?? null, A = So(h, ll(g)), _ = (S ?? 0) * (E ?? 0), C = f && A > 0;
    (!g.internals.handleBounds || C || A >= _ || g.dragging) && p.push(g);
  }
  return p;
}, c_ = (n, a) => {
  const o = /* @__PURE__ */ new Set();
  return n.forEach((s) => {
    o.add(s.id);
  }), a.filter((s) => o.has(s.source) || o.has(s.target));
};
function f_(n, a) {
  const o = /* @__PURE__ */ new Map(), s = a?.nodes ? new Set(a.nodes.map((u) => u.id)) : null;
  return n.forEach((u) => {
    u.measured.width && u.measured.height && (a?.includeHiddenNodes || !u.hidden) && (!s || s.has(u.id)) && o.set(u.id, u);
  }), o;
}
async function d_({ nodes: n, width: a, height: o, panZoom: s, minZoom: u, maxZoom: f }, d) {
  if (n.size === 0)
    return Promise.resolve(!0);
  const h = f_(n, d), p = zo(h), g = yd(p, a, o, d?.minZoom ?? u, d?.maxZoom ?? f, d?.padding ?? 0.1);
  return await s.setViewport(g, {
    duration: d?.duration,
    ease: d?.ease,
    interpolate: d?.interpolate
  }), Promise.resolve(!0);
}
function km({ nodeId: n, nextPosition: a, nodeLookup: o, nodeOrigin: s = [0, 0], nodeExtent: u, onError: f }) {
  const d = o.get(n), h = d.parentId ? o.get(d.parentId) : void 0, { x: p, y: g } = h ? h.internals.positionAbsolute : { x: 0, y: 0 }, m = d.origin ?? s;
  let v = d.extent || u;
  if (d.extent === "parent" && !d.expandParent)
    if (!h)
      f?.("005", yn.error005());
    else {
      const S = h.measured.width, E = h.measured.height;
      S && E && (v = [
        [p, g],
        [p + S, g + E]
      ]);
    }
  else h && ol(d.extent) && (v = [
    [d.extent[0][0] + p, d.extent[0][1] + g],
    [d.extent[1][0] + p, d.extent[1][1] + g]
  ]);
  const b = ol(v) ? la(a, v, d.measured) : a;
  return (d.measured.width === void 0 || d.measured.height === void 0) && f?.("015", yn.error015()), {
    position: {
      x: b.x - p + (d.measured.width ?? 0) * m[0],
      y: b.y - g + (d.measured.height ?? 0) * m[1]
    },
    positionAbsolute: b
  };
}
async function h_({ nodesToRemove: n = [], edgesToRemove: a = [], nodes: o, edges: s, onBeforeDelete: u }) {
  const f = new Set(n.map((b) => b.id)), d = [];
  for (const b of o) {
    if (b.deletable === !1)
      continue;
    const S = f.has(b.id), E = !S && b.parentId && d.find((A) => A.id === b.parentId);
    (S || E) && d.push(b);
  }
  const h = new Set(a.map((b) => b.id)), p = s.filter((b) => b.deletable !== !1), m = c_(d, p);
  for (const b of p)
    h.has(b.id) && !m.find((E) => E.id === b.id) && m.push(b);
  if (!u)
    return {
      edges: m,
      nodes: d
    };
  const v = await u({
    nodes: d,
    edges: m
  });
  return typeof v == "boolean" ? v ? { edges: m, nodes: d } : { edges: [], nodes: [] } : v;
}
const al = (n, a = 0, o = 1) => Math.min(Math.max(n, a), o), la = (n = { x: 0, y: 0 }, a, o) => ({
  x: al(n.x, a[0][0], a[1][0] - (o?.width ?? 0)),
  y: al(n.y, a[0][1], a[1][1] - (o?.height ?? 0))
});
function Gm(n, a, o) {
  const { width: s, height: u } = Zn(o), { x: f, y: d } = o.internals.positionAbsolute;
  return la(n, [
    [f, d],
    [f + s, d + u]
  ], a);
}
const Wy = (n, a, o) => n < a ? al(Math.abs(n - a), 1, a) / a : n > o ? -al(Math.abs(n - o), 1, a) / a : 0, Zm = (n, a, o = 15, s = 40) => {
  const u = Wy(n.x, s, a.width - s) * o, f = Wy(n.y, s, a.height - s) * o;
  return [u, f];
}, Br = (n, a) => ({
  x: Math.min(n.x, a.x),
  y: Math.min(n.y, a.y),
  x2: Math.max(n.x2, a.x2),
  y2: Math.max(n.y2, a.y2)
}), Kf = ({ x: n, y: a, width: o, height: s }) => ({
  x: n,
  y: a,
  x2: n + o,
  y2: a + s
}), Lr = ({ x: n, y: a, x2: o, y2: s }) => ({
  x: n,
  y: a,
  width: o - n,
  height: s - a
}), ll = (n, a = [0, 0]) => {
  const { x: o, y: s } = gd(n) ? n.internals.positionAbsolute : Mo(n, a);
  return {
    x: o,
    y: s,
    width: n.measured?.width ?? n.width ?? n.initialWidth ?? 0,
    height: n.measured?.height ?? n.height ?? n.initialHeight ?? 0
  };
}, Tr = (n, a = [0, 0]) => {
  const { x: o, y: s } = gd(n) ? n.internals.positionAbsolute : Mo(n, a);
  return {
    x: o,
    y: s,
    x2: o + (n.measured?.width ?? n.width ?? n.initialWidth ?? 0),
    y2: s + (n.measured?.height ?? n.height ?? n.initialHeight ?? 0)
  };
}, Km = (n, a) => Lr(Br(Kf(n), Kf(a))), So = (n, a) => {
  const o = Math.max(0, Math.min(n.x + n.width, a.x + a.width) - Math.max(n.x, a.x)), s = Math.max(0, Math.min(n.y + n.height, a.y + a.height) - Math.max(n.y, a.y));
  return Math.ceil(o * s);
}, Py = (n) => an(n.width) && an(n.height) && an(n.x) && an(n.y), an = (n) => !isNaN(n) && isFinite(n), g_ = (n, a) => {
}, Oo = (n, a = [1, 1]) => ({
  x: a[0] * Math.round(n.x / a[0]),
  y: a[1] * Math.round(n.y / a[1])
}), Do = ({ x: n, y: a }, [o, s, u], f = !1, d = [1, 1]) => {
  const h = {
    x: (n - o) / u,
    y: (a - s) / u
  };
  return f ? Oo(h, d) : h;
}, Ar = ({ x: n, y: a }, [o, s, u]) => ({
  x: n * u + o,
  y: a * u + s
});
function Ja(n, a) {
  if (typeof n == "number")
    return Math.floor((a - a / (1 + n)) * 0.5);
  if (typeof n == "string" && n.endsWith("px")) {
    const o = parseFloat(n);
    if (!Number.isNaN(o))
      return Math.floor(o);
  }
  if (typeof n == "string" && n.endsWith("%")) {
    const o = parseFloat(n);
    if (!Number.isNaN(o))
      return Math.floor(a * o * 0.01);
  }
  return console.error(`[React Flow] The padding value "${n}" is invalid. Please provide a number or a string with a valid unit (px or %).`), 0;
}
function p_(n, a, o) {
  if (typeof n == "string" || typeof n == "number") {
    const s = Ja(n, o), u = Ja(n, a);
    return {
      top: s,
      right: u,
      bottom: s,
      left: u,
      x: u * 2,
      y: s * 2
    };
  }
  if (typeof n == "object") {
    const s = Ja(n.top ?? n.y ?? 0, o), u = Ja(n.bottom ?? n.y ?? 0, o), f = Ja(n.left ?? n.x ?? 0, a), d = Ja(n.right ?? n.x ?? 0, a);
    return { top: s, right: d, bottom: u, left: f, x: f + d, y: s + u };
  }
  return { top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0 };
}
function y_(n, a, o, s, u, f) {
  const { x: d, y: h } = Ar(n, [a, o, s]), { x: p, y: g } = Ar({ x: n.x + n.width, y: n.y + n.height }, [a, o, s]), m = u - p, v = f - g;
  return {
    left: Math.floor(d),
    top: Math.floor(h),
    right: Math.floor(m),
    bottom: Math.floor(v)
  };
}
const yd = (n, a, o, s, u, f) => {
  const d = p_(f, a, o), h = (a - d.x) / n.width, p = (o - d.y) / n.height, g = Math.min(h, p), m = al(g, s, u), v = n.x + n.width / 2, b = n.y + n.height / 2, S = a / 2 - v * m, E = o / 2 - b * m, A = y_(n, S, E, m, a, o), _ = {
    left: Math.min(A.left - d.left, 0),
    top: Math.min(A.top - d.top, 0),
    right: Math.min(A.right - d.right, 0),
    bottom: Math.min(A.bottom - d.bottom, 0)
  };
  return {
    x: S - _.left + _.right,
    y: E - _.top + _.bottom,
    zoom: m
  };
}, wo = () => typeof navigator < "u" && navigator?.userAgent?.indexOf("Mac") >= 0;
function ol(n) {
  return n != null && n !== "parent";
}
function Zn(n) {
  return {
    width: n.measured?.width ?? n.width ?? n.initialWidth ?? 0,
    height: n.measured?.height ?? n.height ?? n.initialHeight ?? 0
  };
}
function $m(n) {
  return (n.measured?.width ?? n.width ?? n.initialWidth) !== void 0 && (n.measured?.height ?? n.height ?? n.initialHeight) !== void 0;
}
function Jm(n, a = { width: 0, height: 0 }, o, s, u) {
  const f = { ...n }, d = s.get(o);
  if (d) {
    const h = d.origin || u;
    f.x += d.internals.positionAbsolute.x - (a.width ?? 0) * h[0], f.y += d.internals.positionAbsolute.y - (a.height ?? 0) * h[1];
  }
  return f;
}
function t0(n, a) {
  if (n.size !== a.size)
    return !1;
  for (const o of n)
    if (!a.has(o))
      return !1;
  return !0;
}
function m_() {
  let n, a;
  return { promise: new Promise((s, u) => {
    n = s, a = u;
  }), resolve: n, reject: a };
}
function v_(n) {
  return { ...Ym, ...n || {} };
}
function co(n, { snapGrid: a = [0, 0], snapToGrid: o = !1, transform: s, containerBounds: u }) {
  const { x: f, y: d } = ln(n), h = Do({ x: f - (u?.left ?? 0), y: d - (u?.top ?? 0) }, s), { x: p, y: g } = o ? Oo(h, a) : h;
  return {
    xSnapped: p,
    ySnapped: g,
    ...h
  };
}
const md = (n) => ({
  width: n.offsetWidth,
  height: n.offsetHeight
}), Fm = (n) => n?.getRootNode?.() || window?.document, b_ = ["INPUT", "SELECT", "TEXTAREA"];
function Im(n) {
  const a = n.composedPath?.()?.[0] || n.target;
  return a?.nodeType !== 1 ? !1 : b_.includes(a.nodeName) || a.hasAttribute("contenteditable") || !!a.closest(".nokey");
}
const Wm = (n) => "clientX" in n, ln = (n, a) => {
  const o = Wm(n), s = o ? n.clientX : n.touches?.[0].clientX, u = o ? n.clientY : n.touches?.[0].clientY;
  return {
    x: s - (a?.left ?? 0),
    y: u - (a?.top ?? 0)
  };
}, e0 = (n, a, o, s, u) => {
  const f = a.querySelectorAll(`.${n}`);
  return !f || !f.length ? null : Array.from(f).map((d) => {
    const h = d.getBoundingClientRect();
    return {
      id: d.getAttribute("data-handleid"),
      type: n,
      nodeId: u,
      position: d.getAttribute("data-handlepos"),
      x: (h.left - o.left) / s,
      y: (h.top - o.top) / s,
      ...md(d)
    };
  });
};
function Pm({ sourceX: n, sourceY: a, targetX: o, targetY: s, sourceControlX: u, sourceControlY: f, targetControlX: d, targetControlY: h }) {
  const p = n * 0.125 + u * 0.375 + d * 0.375 + o * 0.125, g = a * 0.125 + f * 0.375 + h * 0.375 + s * 0.125, m = Math.abs(p - n), v = Math.abs(g - a);
  return [p, g, m, v];
}
function rr(n, a) {
  return n >= 0 ? 0.5 * n : a * 25 * Math.sqrt(-n);
}
function n0({ pos: n, x1: a, y1: o, x2: s, y2: u, c: f }) {
  switch (n) {
    case pt.Left:
      return [a - rr(a - s, f), o];
    case pt.Right:
      return [a + rr(s - a, f), o];
    case pt.Top:
      return [a, o - rr(o - u, f)];
    case pt.Bottom:
      return [a, o + rr(u - o, f)];
  }
}
function tv({ sourceX: n, sourceY: a, sourcePosition: o = pt.Bottom, targetX: s, targetY: u, targetPosition: f = pt.Top, curvature: d = 0.25 }) {
  const [h, p] = n0({
    pos: o,
    x1: n,
    y1: a,
    x2: s,
    y2: u,
    c: d
  }), [g, m] = n0({
    pos: f,
    x1: s,
    y1: u,
    x2: n,
    y2: a,
    c: d
  }), [v, b, S, E] = Pm({
    sourceX: n,
    sourceY: a,
    targetX: s,
    targetY: u,
    sourceControlX: h,
    sourceControlY: p,
    targetControlX: g,
    targetControlY: m
  });
  return [
    `M${n},${a} C${h},${p} ${g},${m} ${s},${u}`,
    v,
    b,
    S,
    E
  ];
}
function ev({ sourceX: n, sourceY: a, targetX: o, targetY: s }) {
  const u = Math.abs(o - n) / 2, f = o < n ? o + u : o - u, d = Math.abs(s - a) / 2, h = s < a ? s + d : s - d;
  return [f, h, u, d];
}
function x_({ sourceNode: n, targetNode: a, selected: o = !1, zIndex: s = 0, elevateOnSelect: u = !1, zIndexMode: f = "basic" }) {
  if (f === "manual")
    return s;
  const d = u && o ? s + 1e3 : s, h = Math.max(n.parentId || u && n.selected ? n.internals.z : 0, a.parentId || u && a.selected ? a.internals.z : 0);
  return d + h;
}
function S_({ sourceNode: n, targetNode: a, width: o, height: s, transform: u }) {
  const f = Br(Tr(n), Tr(a));
  f.x === f.x2 && (f.x2 += 1), f.y === f.y2 && (f.y2 += 1);
  const d = {
    x: -u[0] / u[2],
    y: -u[1] / u[2],
    width: o / u[2],
    height: s / u[2]
  };
  return So(d, Lr(f)) > 0;
}
const w_ = ({ source: n, sourceHandle: a, target: o, targetHandle: s }) => `xy-edge__${n}${a || ""}-${o}${s || ""}`, E_ = (n, a) => a.some((o) => o.source === n.source && o.target === n.target && (o.sourceHandle === n.sourceHandle || !o.sourceHandle && !n.sourceHandle) && (o.targetHandle === n.targetHandle || !o.targetHandle && !n.targetHandle)), __ = (n, a, o = {}) => {
  if (!n.source || !n.target)
    return a;
  const s = o.getEdgeId || w_;
  let u;
  return Xm(n) ? u = { ...n } : u = {
    ...n,
    id: s(n)
  }, E_(u, a) ? a : (u.sourceHandle === null && delete u.sourceHandle, u.targetHandle === null && delete u.targetHandle, a.concat(u));
};
function nv({ sourceX: n, sourceY: a, targetX: o, targetY: s }) {
  const [u, f, d, h] = ev({
    sourceX: n,
    sourceY: a,
    targetX: o,
    targetY: s
  });
  return [`M ${n},${a}L ${o},${s}`, u, f, d, h];
}
const i0 = {
  [pt.Left]: { x: -1, y: 0 },
  [pt.Right]: { x: 1, y: 0 },
  [pt.Top]: { x: 0, y: -1 },
  [pt.Bottom]: { x: 0, y: 1 }
}, C_ = ({ source: n, sourcePosition: a = pt.Bottom, target: o }) => a === pt.Left || a === pt.Right ? n.x < o.x ? { x: 1, y: 0 } : { x: -1, y: 0 } : n.y < o.y ? { x: 0, y: 1 } : { x: 0, y: -1 }, a0 = (n, a) => Math.sqrt(Math.pow(a.x - n.x, 2) + Math.pow(a.y - n.y, 2));
function N_({ source: n, sourcePosition: a = pt.Bottom, target: o, targetPosition: s = pt.Top, center: u, offset: f, stepPosition: d }) {
  const h = i0[a], p = i0[s], g = { x: n.x + h.x * f, y: n.y + h.y * f }, m = { x: o.x + p.x * f, y: o.y + p.y * f }, v = C_({
    source: g,
    sourcePosition: a,
    target: m
  }), b = v.x !== 0 ? "x" : "y", S = v[b];
  let E = [], A, _;
  const C = { x: 0, y: 0 }, D = { x: 0, y: 0 }, [, , w, z] = ev({
    sourceX: n.x,
    sourceY: n.y,
    targetX: o.x,
    targetY: o.y
  });
  if (h[b] * p[b] === -1) {
    b === "x" ? (A = u.x ?? g.x + (m.x - g.x) * d, _ = u.y ?? (g.y + m.y) / 2) : (A = u.x ?? (g.x + m.x) / 2, _ = u.y ?? g.y + (m.y - g.y) * d);
    const Q = [
      { x: A, y: g.y },
      { x: A, y: m.y }
    ], Z = [
      { x: g.x, y: _ },
      { x: m.x, y: _ }
    ];
    h[b] === S ? E = b === "x" ? Q : Z : E = b === "x" ? Z : Q;
  } else {
    const Q = [{ x: g.x, y: m.y }], Z = [{ x: m.x, y: g.y }];
    if (b === "x" ? E = h.x === S ? Z : Q : E = h.y === S ? Q : Z, a === s) {
      const O = Math.abs(n[b] - o[b]);
      if (O <= f) {
        const G = Math.min(f - 1, f - O);
        h[b] === S ? C[b] = (g[b] > n[b] ? -1 : 1) * G : D[b] = (m[b] > o[b] ? -1 : 1) * G;
      }
    }
    if (a !== s) {
      const O = b === "x" ? "y" : "x", G = h[b] === p[O], N = g[O] > m[O], H = g[O] < m[O];
      (h[b] === 1 && (!G && N || G && H) || h[b] !== 1 && (!G && H || G && N)) && (E = b === "x" ? Q : Z);
    }
    const ot = { x: g.x + C.x, y: g.y + C.y }, X = { x: m.x + D.x, y: m.y + D.y }, k = Math.max(Math.abs(ot.x - E[0].x), Math.abs(X.x - E[0].x)), it = Math.max(Math.abs(ot.y - E[0].y), Math.abs(X.y - E[0].y));
    k >= it ? (A = (ot.x + X.x) / 2, _ = E[0].y) : (A = E[0].x, _ = (ot.y + X.y) / 2);
  }
  const q = { x: g.x + C.x, y: g.y + C.y }, B = { x: m.x + D.x, y: m.y + D.y };
  return [[
    n,
    // we only want to add the gapped source/target if they are different from the first/last point to avoid duplicates which can cause issues with the bends
    ...q.x !== E[0].x || q.y !== E[0].y ? [q] : [],
    ...E,
    ...B.x !== E[E.length - 1].x || B.y !== E[E.length - 1].y ? [B] : [],
    o
  ], A, _, w, z];
}
function T_(n, a, o, s) {
  const u = Math.min(a0(n, a) / 2, a0(a, o) / 2, s), { x: f, y: d } = a;
  if (n.x === f && f === o.x || n.y === d && d === o.y)
    return `L${f} ${d}`;
  if (n.y === d) {
    const g = n.x < o.x ? -1 : 1, m = n.y < o.y ? 1 : -1;
    return `L ${f + u * g},${d}Q ${f},${d} ${f},${d + u * m}`;
  }
  const h = n.x < o.x ? 1 : -1, p = n.y < o.y ? -1 : 1;
  return `L ${f},${d + u * p}Q ${f},${d} ${f + u * h},${d}`;
}
function $f({ sourceX: n, sourceY: a, sourcePosition: o = pt.Bottom, targetX: s, targetY: u, targetPosition: f = pt.Top, borderRadius: d = 5, centerX: h, centerY: p, offset: g = 20, stepPosition: m = 0.5 }) {
  const [v, b, S, E, A] = N_({
    source: { x: n, y: a },
    sourcePosition: o,
    target: { x: s, y: u },
    targetPosition: f,
    center: { x: h, y: p },
    offset: g,
    stepPosition: m
  });
  let _ = `M${v[0].x} ${v[0].y}`;
  for (let C = 1; C < v.length - 1; C++)
    _ += T_(v[C - 1], v[C], v[C + 1], d);
  return _ += `L${v[v.length - 1].x} ${v[v.length - 1].y}`, [_, b, S, E, A];
}
function l0(n) {
  return n && !!(n.internals.handleBounds || n.handles?.length) && !!(n.measured.width || n.width || n.initialWidth);
}
function A_(n) {
  const { sourceNode: a, targetNode: o } = n;
  if (!l0(a) || !l0(o))
    return null;
  const s = a.internals.handleBounds || o0(a.handles), u = o.internals.handleBounds || o0(o.handles), f = s0(s?.source ?? [], n.sourceHandle), d = s0(
    // when connection type is loose we can define all handles as sources and connect source -> source
    n.connectionMode === il.Strict ? u?.target ?? [] : (u?.target ?? []).concat(u?.source ?? []),
    n.targetHandle
  );
  if (!f || !d)
    return n.onError?.("008", yn.error008(f ? "target" : "source", {
      id: n.id,
      sourceHandle: n.sourceHandle,
      targetHandle: n.targetHandle
    })), null;
  const h = f?.position || pt.Bottom, p = d?.position || pt.Top, g = oa(a, f, h), m = oa(o, d, p);
  return {
    sourceX: g.x,
    sourceY: g.y,
    targetX: m.x,
    targetY: m.y,
    sourcePosition: h,
    targetPosition: p
  };
}
function o0(n) {
  if (!n)
    return null;
  const a = [], o = [];
  for (const s of n)
    s.width = s.width ?? 1, s.height = s.height ?? 1, s.type === "source" ? a.push(s) : s.type === "target" && o.push(s);
  return {
    source: a,
    target: o
  };
}
function oa(n, a, o = pt.Left, s = !1) {
  const u = (a?.x ?? 0) + n.internals.positionAbsolute.x, f = (a?.y ?? 0) + n.internals.positionAbsolute.y, { width: d, height: h } = a ?? Zn(n);
  if (s)
    return { x: u + d / 2, y: f + h / 2 };
  switch (a?.position ?? o) {
    case pt.Top:
      return { x: u + d / 2, y: f };
    case pt.Right:
      return { x: u + d, y: f + h / 2 };
    case pt.Bottom:
      return { x: u + d / 2, y: f + h };
    case pt.Left:
      return { x: u, y: f + h / 2 };
  }
}
function s0(n, a) {
  return n && (a ? n.find((o) => o.id === a) : n[0]) || null;
}
function Jf(n, a) {
  return n ? typeof n == "string" ? n : `${a ? `${a}__` : ""}${Object.keys(n).sort().map((s) => `${s}=${n[s]}`).join("&")}` : "";
}
function M_(n, { id: a, defaultColor: o, defaultMarkerStart: s, defaultMarkerEnd: u }) {
  const f = /* @__PURE__ */ new Set();
  return n.reduce((d, h) => ([h.markerStart || s, h.markerEnd || u].forEach((p) => {
    if (p && typeof p == "object") {
      const g = Jf(p, a);
      f.has(g) || (d.push({ id: g, color: p.color || o, ...p }), f.add(g));
    }
  }), d), []).sort((d, h) => d.id.localeCompare(h.id));
}
const iv = 1e3, z_ = 10, vd = {
  nodeOrigin: [0, 0],
  nodeExtent: bo,
  elevateNodesOnSelect: !0,
  zIndexMode: "basic",
  defaults: {}
}, O_ = {
  ...vd,
  checkEquality: !0
};
function bd(n, a) {
  const o = { ...n };
  for (const s in a)
    a[s] !== void 0 && (o[s] = a[s]);
  return o;
}
function D_(n, a, o) {
  const s = bd(vd, o);
  for (const u of n.values())
    if (u.parentId)
      Sd(u, n, a, s);
    else {
      const f = Mo(u, s.nodeOrigin), d = ol(u.extent) ? u.extent : s.nodeExtent, h = la(f, d, Zn(u));
      u.internals.positionAbsolute = h;
    }
}
function R_(n, a) {
  if (!n.handles)
    return n.measured ? a?.internals.handleBounds : void 0;
  const o = [], s = [];
  for (const u of n.handles) {
    const f = {
      id: u.id,
      width: u.width ?? 1,
      height: u.height ?? 1,
      nodeId: n.id,
      x: u.x,
      y: u.y,
      position: u.position,
      type: u.type
    };
    u.type === "source" ? o.push(f) : u.type === "target" && s.push(f);
  }
  return {
    source: o,
    target: s
  };
}
function xd(n) {
  return n === "manual";
}
function Ff(n, a, o, s = {}) {
  const u = bd(O_, s), f = { i: 0 }, d = new Map(a), h = u?.elevateNodesOnSelect && !xd(u.zIndexMode) ? iv : 0;
  let p = n.length > 0, g = !1;
  a.clear(), o.clear();
  for (const m of n) {
    let v = d.get(m.id);
    if (u.checkEquality && m === v?.internals.userNode)
      a.set(m.id, v);
    else {
      const b = Mo(m, u.nodeOrigin), S = ol(m.extent) ? m.extent : u.nodeExtent, E = la(b, S, Zn(m));
      v = {
        ...u.defaults,
        ...m,
        measured: {
          width: m.measured?.width,
          height: m.measured?.height
        },
        internals: {
          positionAbsolute: E,
          // if user re-initializes the node or removes `measured` for whatever reason, we reset the handleBounds so that the node gets re-measured
          handleBounds: R_(m, v),
          z: av(m, h, u.zIndexMode),
          userNode: m
        }
      }, a.set(m.id, v);
    }
    (v.measured === void 0 || v.measured.width === void 0 || v.measured.height === void 0) && !v.hidden && (p = !1), m.parentId && Sd(v, a, o, s, f), g ||= m.selected ?? !1;
  }
  return { nodesInitialized: p, hasSelectedNodes: g };
}
function H_(n, a) {
  if (!n.parentId)
    return;
  const o = a.get(n.parentId);
  o ? o.set(n.id, n) : a.set(n.parentId, /* @__PURE__ */ new Map([[n.id, n]]));
}
function Sd(n, a, o, s, u) {
  const { elevateNodesOnSelect: f, nodeOrigin: d, nodeExtent: h, zIndexMode: p } = bd(vd, s), g = n.parentId, m = a.get(g);
  if (!m) {
    console.warn(`Parent node ${g} not found. Please make sure that parent nodes are in front of their child nodes in the nodes array.`);
    return;
  }
  H_(n, o), u && !m.parentId && m.internals.rootParentIndex === void 0 && p === "auto" && (m.internals.rootParentIndex = ++u.i, m.internals.z = m.internals.z + u.i * z_), u && m.internals.rootParentIndex !== void 0 && (u.i = m.internals.rootParentIndex);
  const v = f && !xd(p) ? iv : 0, { x: b, y: S, z: E } = j_(n, m, d, h, v, p), { positionAbsolute: A } = n.internals, _ = b !== A.x || S !== A.y;
  (_ || E !== n.internals.z) && a.set(n.id, {
    ...n,
    internals: {
      ...n.internals,
      positionAbsolute: _ ? { x: b, y: S } : A,
      z: E
    }
  });
}
function av(n, a, o) {
  const s = an(n.zIndex) ? n.zIndex : 0;
  return xd(o) ? s : s + (n.selected ? a : 0);
}
function j_(n, a, o, s, u, f) {
  const { x: d, y: h } = a.internals.positionAbsolute, p = Zn(n), g = Mo(n, o), m = ol(n.extent) ? la(g, n.extent, p) : g;
  let v = la({ x: d + m.x, y: h + m.y }, s, p);
  n.extent === "parent" && (v = Gm(v, p, a));
  const b = av(n, u, f), S = a.internals.z ?? 0;
  return {
    x: v.x,
    y: v.y,
    z: S >= b ? S + 1 : b
  };
}
function wd(n, a, o, s = [0, 0]) {
  const u = [], f = /* @__PURE__ */ new Map();
  for (const d of n) {
    const h = a.get(d.parentId);
    if (!h)
      continue;
    const p = f.get(d.parentId)?.expandedRect ?? ll(h), g = Km(p, d.rect);
    f.set(d.parentId, { expandedRect: g, parent: h });
  }
  return f.size > 0 && f.forEach(({ expandedRect: d, parent: h }, p) => {
    const g = h.internals.positionAbsolute, m = Zn(h), v = h.origin ?? s, b = d.x < g.x ? Math.round(Math.abs(g.x - d.x)) : 0, S = d.y < g.y ? Math.round(Math.abs(g.y - d.y)) : 0, E = Math.max(m.width, Math.round(d.width)), A = Math.max(m.height, Math.round(d.height)), _ = (E - m.width) * v[0], C = (A - m.height) * v[1];
    (b > 0 || S > 0 || _ || C) && (u.push({
      id: p,
      type: "position",
      position: {
        x: h.position.x - b + _,
        y: h.position.y - S + C
      }
    }), o.get(p)?.forEach((D) => {
      n.some((w) => w.id === D.id) || u.push({
        id: D.id,
        type: "position",
        position: {
          x: D.position.x + b,
          y: D.position.y + S
        }
      });
    })), (m.width < d.width || m.height < d.height || b || S) && u.push({
      id: p,
      type: "dimensions",
      setAttributes: !0,
      dimensions: {
        width: E + (b ? v[0] * b - _ : 0),
        height: A + (S ? v[1] * S - C : 0)
      }
    });
  }), u;
}
function U_(n, a, o, s, u, f, d) {
  const h = s?.querySelector(".xyflow__viewport");
  let p = !1;
  if (!h)
    return { changes: [], updatedInternals: p };
  const g = [], m = window.getComputedStyle(h), { m22: v } = new window.DOMMatrixReadOnly(m.transform), b = [];
  for (const S of n.values()) {
    const E = a.get(S.id);
    if (!E)
      continue;
    if (E.hidden) {
      a.set(E.id, {
        ...E,
        internals: {
          ...E.internals,
          handleBounds: void 0
        }
      }), p = !0;
      continue;
    }
    const A = md(S.nodeElement), _ = E.measured.width !== A.width || E.measured.height !== A.height;
    if (!!(A.width && A.height && (_ || !E.internals.handleBounds || S.force))) {
      const D = S.nodeElement.getBoundingClientRect(), w = ol(E.extent) ? E.extent : f;
      let { positionAbsolute: z } = E.internals;
      E.parentId && E.extent === "parent" ? z = Gm(z, A, a.get(E.parentId)) : w && (z = la(z, w, A));
      const q = {
        ...E,
        measured: A,
        internals: {
          ...E.internals,
          positionAbsolute: z,
          handleBounds: {
            source: e0("source", S.nodeElement, D, v, E.id),
            target: e0("target", S.nodeElement, D, v, E.id)
          }
        }
      };
      a.set(E.id, q), E.parentId && Sd(q, a, o, { nodeOrigin: u, zIndexMode: d }), p = !0, _ && (g.push({
        id: E.id,
        type: "dimensions",
        dimensions: A
      }), E.expandParent && E.parentId && b.push({
        id: E.id,
        parentId: E.parentId,
        rect: ll(q, u)
      }));
    }
  }
  if (b.length > 0) {
    const S = wd(b, a, o, u);
    g.push(...S);
  }
  return { changes: g, updatedInternals: p };
}
async function B_({ delta: n, panZoom: a, transform: o, translateExtent: s, width: u, height: f }) {
  if (!a || !n.x && !n.y)
    return Promise.resolve(!1);
  const d = await a.setViewportConstrained({
    x: o[0] + n.x,
    y: o[1] + n.y,
    zoom: o[2]
  }, [
    [0, 0],
    [u, f]
  ], s), h = !!d && (d.x !== o[0] || d.y !== o[1] || d.k !== o[2]);
  return Promise.resolve(h);
}
function r0(n, a, o, s, u, f) {
  let d = u;
  const h = s.get(d) || /* @__PURE__ */ new Map();
  s.set(d, h.set(o, a)), d = `${u}-${n}`;
  const p = s.get(d) || /* @__PURE__ */ new Map();
  if (s.set(d, p.set(o, a)), f) {
    d = `${u}-${n}-${f}`;
    const g = s.get(d) || /* @__PURE__ */ new Map();
    s.set(d, g.set(o, a));
  }
}
function lv(n, a, o) {
  n.clear(), a.clear();
  for (const s of o) {
    const { source: u, target: f, sourceHandle: d = null, targetHandle: h = null } = s, p = { edgeId: s.id, source: u, target: f, sourceHandle: d, targetHandle: h }, g = `${u}-${d}--${f}-${h}`, m = `${f}-${h}--${u}-${d}`;
    r0("source", p, m, n, u, d), r0("target", p, g, n, f, h), a.set(s.id, s);
  }
}
function ov(n, a) {
  if (!n.parentId)
    return !1;
  const o = a.get(n.parentId);
  return o ? o.selected ? !0 : ov(o, a) : !1;
}
function u0(n, a, o) {
  let s = n;
  do {
    if (s?.matches?.(a))
      return !0;
    if (s === o)
      return !1;
    s = s?.parentElement;
  } while (s);
  return !1;
}
function L_(n, a, o, s) {
  const u = /* @__PURE__ */ new Map();
  for (const [f, d] of n)
    if ((d.selected || d.id === s) && (!d.parentId || !ov(d, n)) && (d.draggable || a && typeof d.draggable > "u")) {
      const h = n.get(f);
      h && u.set(f, {
        id: f,
        position: h.position || { x: 0, y: 0 },
        distance: {
          x: o.x - h.internals.positionAbsolute.x,
          y: o.y - h.internals.positionAbsolute.y
        },
        extent: h.extent,
        parentId: h.parentId,
        origin: h.origin,
        expandParent: h.expandParent,
        internals: {
          positionAbsolute: h.internals.positionAbsolute || { x: 0, y: 0 }
        },
        measured: {
          width: h.measured.width ?? 0,
          height: h.measured.height ?? 0
        }
      });
    }
  return u;
}
function wf({ nodeId: n, dragItems: a, nodeLookup: o, dragging: s = !0 }) {
  const u = [];
  for (const [d, h] of a) {
    const p = o.get(d)?.internals.userNode;
    p && u.push({
      ...p,
      position: h.position,
      dragging: s
    });
  }
  if (!n)
    return [u[0], u];
  const f = o.get(n)?.internals.userNode;
  return [
    f ? {
      ...f,
      position: a.get(n)?.position || f.position,
      dragging: s
    } : u[0],
    u
  ];
}
function q_({ dragItems: n, snapGrid: a, x: o, y: s }) {
  const u = n.values().next().value;
  if (!u)
    return null;
  const f = {
    x: o - u.distance.x,
    y: s - u.distance.y
  }, d = Oo(f, a);
  return {
    x: d.x - f.x,
    y: d.y - f.y
  };
}
function Y_({ onNodeMouseDown: n, getStoreItems: a, onDragStart: o, onDrag: s, onDragStop: u }) {
  let f = { x: null, y: null }, d = 0, h = /* @__PURE__ */ new Map(), p = !1, g = { x: 0, y: 0 }, m = null, v = !1, b = null, S = !1, E = !1, A = null;
  function _({ noDragClassName: D, handleSelector: w, domNode: z, isSelectable: q, nodeId: B, nodeClickDistance: U = 0 }) {
    b = Le(z);
    function Q({ x: k, y: it }) {
      const { nodeLookup: O, nodeExtent: G, snapGrid: N, snapToGrid: H, nodeOrigin: Y, onNodeDrag: K, onSelectionDrag: tt, onError: T, updateNodePositions: j } = a();
      f = { x: k, y: it };
      let P = !1;
      const et = h.size > 1, rt = et && G ? Kf(zo(h)) : null, ct = et && H ? q_({
        dragItems: h,
        snapGrid: N,
        x: k,
        y: it
      }) : null;
      for (const [ut, st] of h) {
        if (!O.has(ut))
          continue;
        let ft = { x: k - st.distance.x, y: it - st.distance.y };
        H && (ft = ct ? {
          x: Math.round(ft.x + ct.x),
          y: Math.round(ft.y + ct.y)
        } : Oo(ft, N));
        let wt = null;
        if (et && G && !st.extent && rt) {
          const { positionAbsolute: vt } = st.internals, Nt = vt.x - rt.x + G[0][0], Bt = vt.x + st.measured.width - rt.x2 + G[1][0], Ht = vt.y - rt.y + G[0][1], oe = vt.y + st.measured.height - rt.y2 + G[1][1];
          wt = [
            [Nt, Ht],
            [Bt, oe]
          ];
        }
        const { position: xt, positionAbsolute: yt } = km({
          nodeId: ut,
          nextPosition: ft,
          nodeLookup: O,
          nodeExtent: wt || G,
          nodeOrigin: Y,
          onError: T
        });
        P = P || st.position.x !== xt.x || st.position.y !== xt.y, st.position = xt, st.internals.positionAbsolute = yt;
      }
      if (E = E || P, !!P && (j(h, !0), A && (s || K || !B && tt))) {
        const [ut, st] = wf({
          nodeId: B,
          dragItems: h,
          nodeLookup: O
        });
        s?.(A, h, ut, st), K?.(A, ut, st), B || tt?.(A, st);
      }
    }
    async function Z() {
      if (!m)
        return;
      const { transform: k, panBy: it, autoPanSpeed: O, autoPanOnNodeDrag: G } = a();
      if (!G) {
        p = !1, cancelAnimationFrame(d);
        return;
      }
      const [N, H] = Zm(g, m, O);
      (N !== 0 || H !== 0) && (f.x = (f.x ?? 0) - N / k[2], f.y = (f.y ?? 0) - H / k[2], await it({ x: N, y: H }) && Q(f)), d = requestAnimationFrame(Z);
    }
    function ot(k) {
      const { nodeLookup: it, multiSelectionActive: O, nodesDraggable: G, transform: N, snapGrid: H, snapToGrid: Y, selectNodesOnDrag: K, onNodeDragStart: tt, onSelectionDragStart: T, unselectNodesAndEdges: j } = a();
      v = !0, (!K || !q) && !O && B && (it.get(B)?.selected || j()), q && K && B && n?.(B);
      const P = co(k.sourceEvent, { transform: N, snapGrid: H, snapToGrid: Y, containerBounds: m });
      if (f = P, h = L_(it, G, P, B), h.size > 0 && (o || tt || !B && T)) {
        const [et, rt] = wf({
          nodeId: B,
          dragItems: h,
          nodeLookup: it
        });
        o?.(k.sourceEvent, h, et, rt), tt?.(k.sourceEvent, et, rt), B || T?.(k.sourceEvent, rt);
      }
    }
    const X = Em().clickDistance(U).on("start", (k) => {
      const { domNode: it, nodeDragThreshold: O, transform: G, snapGrid: N, snapToGrid: H } = a();
      m = it?.getBoundingClientRect() || null, S = !1, E = !1, A = k.sourceEvent, O === 0 && ot(k), f = co(k.sourceEvent, { transform: G, snapGrid: N, snapToGrid: H, containerBounds: m }), g = ln(k.sourceEvent, m);
    }).on("drag", (k) => {
      const { autoPanOnNodeDrag: it, transform: O, snapGrid: G, snapToGrid: N, nodeDragThreshold: H, nodeLookup: Y } = a(), K = co(k.sourceEvent, { transform: O, snapGrid: G, snapToGrid: N, containerBounds: m });
      if (A = k.sourceEvent, (k.sourceEvent.type === "touchmove" && k.sourceEvent.touches.length > 1 || // if user deletes a node while dragging, we need to abort the drag to prevent errors
      B && !Y.has(B)) && (S = !0), !S) {
        if (!p && it && v && (p = !0, Z()), !v) {
          const tt = ln(k.sourceEvent, m), T = tt.x - g.x, j = tt.y - g.y;
          Math.sqrt(T * T + j * j) > H && ot(k);
        }
        (f.x !== K.xSnapped || f.y !== K.ySnapped) && h && v && (g = ln(k.sourceEvent, m), Q(K));
      }
    }).on("end", (k) => {
      if (!(!v || S) && (p = !1, v = !1, cancelAnimationFrame(d), h.size > 0)) {
        const { nodeLookup: it, updateNodePositions: O, onNodeDragStop: G, onSelectionDragStop: N } = a();
        if (E && (O(h, !1), E = !1), u || G || !B && N) {
          const [H, Y] = wf({
            nodeId: B,
            dragItems: h,
            nodeLookup: it,
            dragging: !1
          });
          u?.(k.sourceEvent, h, H, Y), G?.(k.sourceEvent, H, Y), B || N?.(k.sourceEvent, Y);
        }
      }
    }).filter((k) => {
      const it = k.target;
      return !k.button && (!D || !u0(it, `.${D}`, z)) && (!w || u0(it, w, z));
    });
    b.call(X);
  }
  function C() {
    b?.on(".drag", null);
  }
  return {
    update: _,
    destroy: C
  };
}
function V_(n, a, o) {
  const s = [], u = {
    x: n.x - o,
    y: n.y - o,
    width: o * 2,
    height: o * 2
  };
  for (const f of a.values())
    So(u, ll(f)) > 0 && s.push(f);
  return s;
}
const Q_ = 250;
function X_(n, a, o, s) {
  let u = [], f = 1 / 0;
  const d = V_(n, o, a + Q_);
  for (const h of d) {
    const p = [...h.internals.handleBounds?.source ?? [], ...h.internals.handleBounds?.target ?? []];
    for (const g of p) {
      if (s.nodeId === g.nodeId && s.type === g.type && s.id === g.id)
        continue;
      const { x: m, y: v } = oa(h, g, g.position, !0), b = Math.sqrt(Math.pow(m - n.x, 2) + Math.pow(v - n.y, 2));
      b > a || (b < f ? (u = [{ ...g, x: m, y: v }], f = b) : b === f && u.push({ ...g, x: m, y: v }));
    }
  }
  if (!u.length)
    return null;
  if (u.length > 1) {
    const h = s.type === "source" ? "target" : "source";
    return u.find((p) => p.type === h) ?? u[0];
  }
  return u[0];
}
function sv(n, a, o, s, u, f = !1) {
  const d = s.get(n);
  if (!d)
    return null;
  const h = u === "strict" ? d.internals.handleBounds?.[a] : [...d.internals.handleBounds?.source ?? [], ...d.internals.handleBounds?.target ?? []], p = (o ? h?.find((g) => g.id === o) : h?.[0]) ?? null;
  return p && f ? { ...p, ...oa(d, p, p.position, !0) } : p;
}
function rv(n, a) {
  return n || (a?.classList.contains("target") ? "target" : a?.classList.contains("source") ? "source" : null);
}
function k_(n, a) {
  let o = null;
  return a ? o = !0 : n && !a && (o = !1), o;
}
const uv = () => !0;
function G_(n, { connectionMode: a, connectionRadius: o, handleId: s, nodeId: u, edgeUpdaterType: f, isTarget: d, domNode: h, nodeLookup: p, lib: g, autoPanOnConnect: m, flowId: v, panBy: b, cancelConnection: S, onConnectStart: E, onConnect: A, onConnectEnd: _, isValidConnection: C = uv, onReconnectEnd: D, updateConnection: w, getTransform: z, getFromHandle: q, autoPanSpeed: B, dragThreshold: U = 1, handleDomNode: Q }) {
  const Z = Fm(n.target);
  let ot = 0, X;
  const { x: k, y: it } = ln(n), O = rv(f, Q), G = h?.getBoundingClientRect();
  let N = !1;
  if (!G || !O)
    return;
  const H = sv(u, O, s, p, a);
  if (!H)
    return;
  let Y = ln(n, G), K = !1, tt = null, T = !1, j = null;
  function P() {
    if (!m || !G)
      return;
    const [xt, yt] = Zm(Y, G, B);
    b({ x: xt, y: yt }), ot = requestAnimationFrame(P);
  }
  const et = {
    ...H,
    nodeId: u,
    type: O,
    position: H.position
  }, rt = p.get(u);
  let ut = {
    inProgress: !0,
    isValid: null,
    from: oa(rt, et, pt.Left, !0),
    fromHandle: et,
    fromPosition: et.position,
    fromNode: rt,
    to: Y,
    toHandle: null,
    toPosition: Iy[et.position],
    toNode: null,
    pointer: Y
  };
  function st() {
    N = !0, w(ut), E?.(n, { nodeId: u, handleId: s, handleType: O });
  }
  U === 0 && st();
  function ft(xt) {
    if (!N) {
      const { x: oe, y: Je } = ln(xt), ze = oe - k, Fe = Je - it;
      if (!(ze * ze + Fe * Fe > U * U))
        return;
      st();
    }
    if (!q() || !et) {
      wt(xt);
      return;
    }
    const yt = z();
    Y = ln(xt, G), X = X_(Do(Y, yt, !1, [1, 1]), o, p, et), K || (P(), K = !0);
    const vt = cv(xt, {
      handle: X,
      connectionMode: a,
      fromNodeId: u,
      fromHandleId: s,
      fromType: d ? "target" : "source",
      isValidConnection: C,
      doc: Z,
      lib: g,
      flowId: v,
      nodeLookup: p
    });
    j = vt.handleDomNode, tt = vt.connection, T = k_(!!X, vt.isValid);
    const Nt = p.get(u), Bt = Nt ? oa(Nt, et, pt.Left, !0) : ut.from, Ht = {
      ...ut,
      from: Bt,
      isValid: T,
      to: vt.toHandle && T ? Ar({ x: vt.toHandle.x, y: vt.toHandle.y }, yt) : Y,
      toHandle: vt.toHandle,
      toPosition: T && vt.toHandle ? vt.toHandle.position : Iy[et.position],
      toNode: vt.toHandle ? p.get(vt.toHandle.nodeId) : null,
      pointer: Y
    };
    w(Ht), ut = Ht;
  }
  function wt(xt) {
    if (!("touches" in xt && xt.touches.length > 0)) {
      if (N) {
        (X || j) && tt && T && A?.(tt);
        const { inProgress: yt, ...vt } = ut, Nt = {
          ...vt,
          toPosition: ut.toHandle ? ut.toPosition : null
        };
        _?.(xt, Nt), f && D?.(xt, Nt);
      }
      S(), cancelAnimationFrame(ot), K = !1, T = !1, tt = null, j = null, Z.removeEventListener("mousemove", ft), Z.removeEventListener("mouseup", wt), Z.removeEventListener("touchmove", ft), Z.removeEventListener("touchend", wt);
    }
  }
  Z.addEventListener("mousemove", ft), Z.addEventListener("mouseup", wt), Z.addEventListener("touchmove", ft), Z.addEventListener("touchend", wt);
}
function cv(n, { handle: a, connectionMode: o, fromNodeId: s, fromHandleId: u, fromType: f, doc: d, lib: h, flowId: p, isValidConnection: g = uv, nodeLookup: m }) {
  const v = f === "target", b = a ? d.querySelector(`.${h}-flow__handle[data-id="${p}-${a?.nodeId}-${a?.id}-${a?.type}"]`) : null, { x: S, y: E } = ln(n), A = d.elementFromPoint(S, E), _ = A?.classList.contains(`${h}-flow__handle`) ? A : b, C = {
    handleDomNode: _,
    isValid: !1,
    connection: null,
    toHandle: null
  };
  if (_) {
    const D = rv(void 0, _), w = _.getAttribute("data-nodeid"), z = _.getAttribute("data-handleid"), q = _.classList.contains("connectable"), B = _.classList.contains("connectableend");
    if (!w || !D)
      return C;
    const U = {
      source: v ? w : s,
      sourceHandle: v ? z : u,
      target: v ? s : w,
      targetHandle: v ? u : z
    };
    C.connection = U;
    const Z = q && B && (o === il.Strict ? v && D === "source" || !v && D === "target" : w !== s || z !== u);
    C.isValid = Z && g(U), C.toHandle = sv(w, D, z, m, o, !0);
  }
  return C;
}
const If = {
  onPointerDown: G_,
  isValid: cv
};
function Z_({ domNode: n, panZoom: a, getTransform: o, getViewScale: s }) {
  const u = Le(n);
  function f({ translateExtent: h, width: p, height: g, zoomStep: m = 1, pannable: v = !0, zoomable: b = !0, inversePan: S = !1 }) {
    const E = (w) => {
      if (w.sourceEvent.type !== "wheel" || !a)
        return;
      const z = o(), q = w.sourceEvent.ctrlKey && wo() ? 10 : 1, B = -w.sourceEvent.deltaY * (w.sourceEvent.deltaMode === 1 ? 0.05 : w.sourceEvent.deltaMode ? 1 : 2e-3) * m, U = z[2] * Math.pow(2, B * q);
      a.scaleTo(U);
    };
    let A = [0, 0];
    const _ = (w) => {
      (w.sourceEvent.type === "mousedown" || w.sourceEvent.type === "touchstart") && (A = [
        w.sourceEvent.clientX ?? w.sourceEvent.touches[0].clientX,
        w.sourceEvent.clientY ?? w.sourceEvent.touches[0].clientY
      ]);
    }, C = (w) => {
      const z = o();
      if (w.sourceEvent.type !== "mousemove" && w.sourceEvent.type !== "touchmove" || !a)
        return;
      const q = [
        w.sourceEvent.clientX ?? w.sourceEvent.touches[0].clientX,
        w.sourceEvent.clientY ?? w.sourceEvent.touches[0].clientY
      ], B = [q[0] - A[0], q[1] - A[1]];
      A = q;
      const U = s() * Math.max(z[2], Math.log(z[2])) * (S ? -1 : 1), Q = {
        x: z[0] - B[0] * U,
        y: z[1] - B[1] * U
      }, Z = [
        [0, 0],
        [p, g]
      ];
      a.setViewportConstrained({
        x: Q.x,
        y: Q.y,
        zoom: z[2]
      }, Z, h);
    }, D = Lm().on("start", _).on("zoom", v ? C : null).on("zoom.wheel", b ? E : null);
    u.call(D, {});
  }
  function d() {
    u.on("zoom", null);
  }
  return {
    update: f,
    destroy: d,
    pointer: en
  };
}
const qr = (n) => ({
  x: n.x,
  y: n.y,
  zoom: n.k
}), Ef = ({ x: n, y: a, zoom: o }) => Ur.translate(n, a).scale(o), Ia = (n, a) => n.target.closest(`.${a}`), fv = (n, a) => a === 2 && Array.isArray(n) && n.includes(2), K_ = (n) => ((n *= 2) <= 1 ? n * n * n : (n -= 2) * n * n + 2) / 2, _f = (n, a = 0, o = K_, s = () => {
}) => {
  const u = typeof a == "number" && a > 0;
  return u || s(), u ? n.transition().duration(a).ease(o).on("end", s) : n;
}, dv = (n) => {
  const a = n.ctrlKey && wo() ? 10 : 1;
  return -n.deltaY * (n.deltaMode === 1 ? 0.05 : n.deltaMode ? 1 : 2e-3) * a;
};
function $_({ zoomPanValues: n, noWheelClassName: a, d3Selection: o, d3Zoom: s, panOnScrollMode: u, panOnScrollSpeed: f, zoomOnPinch: d, onPanZoomStart: h, onPanZoom: p, onPanZoomEnd: g }) {
  return (m) => {
    if (Ia(m, a))
      return m.ctrlKey && m.preventDefault(), !1;
    m.preventDefault(), m.stopImmediatePropagation();
    const v = o.property("__zoom").k || 1;
    if (m.ctrlKey && d) {
      const _ = en(m), C = dv(m), D = v * Math.pow(2, C);
      s.scaleTo(o, D, _, m);
      return;
    }
    const b = m.deltaMode === 1 ? 20 : 1;
    let S = u === na.Vertical ? 0 : m.deltaX * b, E = u === na.Horizontal ? 0 : m.deltaY * b;
    !wo() && m.shiftKey && u !== na.Vertical && (S = m.deltaY * b, E = 0), s.translateBy(
      o,
      -(S / v) * f,
      -(E / v) * f,
      // @ts-ignore
      { internal: !0 }
    );
    const A = qr(o.property("__zoom"));
    clearTimeout(n.panScrollTimeout), n.isPanScrolling ? (p?.(m, A), n.panScrollTimeout = setTimeout(() => {
      g?.(m, A), n.isPanScrolling = !1;
    }, 150)) : (n.isPanScrolling = !0, h?.(m, A));
  };
}
function J_({ noWheelClassName: n, preventScrolling: a, d3ZoomHandler: o }) {
  return function(s, u) {
    const f = s.type === "wheel", d = !a && f && !s.ctrlKey, h = Ia(s, n);
    if (s.ctrlKey && f && h && s.preventDefault(), d || h)
      return null;
    s.preventDefault(), o.call(this, s, u);
  };
}
function F_({ zoomPanValues: n, onDraggingChange: a, onPanZoomStart: o }) {
  return (s) => {
    if (s.sourceEvent?.internal)
      return;
    const u = qr(s.transform);
    n.mouseButton = s.sourceEvent?.button || 0, n.isZoomingOrPanning = !0, n.prevViewport = u, s.sourceEvent?.type === "mousedown" && a(!0), o && o?.(s.sourceEvent, u);
  };
}
function I_({ zoomPanValues: n, panOnDrag: a, onPaneContextMenu: o, onTransformChange: s, onPanZoom: u }) {
  return (f) => {
    n.usedRightMouseButton = !!(o && fv(a, n.mouseButton ?? 0)), f.sourceEvent?.sync || s([f.transform.x, f.transform.y, f.transform.k]), u && !f.sourceEvent?.internal && u?.(f.sourceEvent, qr(f.transform));
  };
}
function W_({ zoomPanValues: n, panOnDrag: a, panOnScroll: o, onDraggingChange: s, onPanZoomEnd: u, onPaneContextMenu: f }) {
  return (d) => {
    if (!d.sourceEvent?.internal && (n.isZoomingOrPanning = !1, f && fv(a, n.mouseButton ?? 0) && !n.usedRightMouseButton && d.sourceEvent && f(d.sourceEvent), n.usedRightMouseButton = !1, s(!1), u)) {
      const h = qr(d.transform);
      n.prevViewport = h, clearTimeout(n.timerId), n.timerId = setTimeout(
        () => {
          u?.(d.sourceEvent, h);
        },
        // we need a setTimeout for panOnScroll to suppress multiple end events fired during scroll
        o ? 150 : 0
      );
    }
  };
}
function P_({ zoomActivationKeyPressed: n, zoomOnScroll: a, zoomOnPinch: o, panOnDrag: s, panOnScroll: u, zoomOnDoubleClick: f, userSelectionActive: d, noWheelClassName: h, noPanClassName: p, lib: g, connectionInProgress: m }) {
  return (v) => {
    const b = n || a, S = o && v.ctrlKey, E = v.type === "wheel";
    if (v.button === 1 && v.type === "mousedown" && (Ia(v, `${g}-flow__node`) || Ia(v, `${g}-flow__edge`)))
      return !0;
    if (!s && !b && !u && !f && !o || d || m && !E || Ia(v, h) && E || Ia(v, p) && (!E || u && E && !n) || !o && v.ctrlKey && E)
      return !1;
    if (!o && v.type === "touchstart" && v.touches?.length > 1)
      return v.preventDefault(), !1;
    if (!b && !u && !S && E || !s && (v.type === "mousedown" || v.type === "touchstart") || Array.isArray(s) && !s.includes(v.button) && v.type === "mousedown")
      return !1;
    const A = Array.isArray(s) && s.includes(v.button) || !v.button || v.button <= 1;
    return (!v.ctrlKey || E) && A;
  };
}
function tC({ domNode: n, minZoom: a, maxZoom: o, translateExtent: s, viewport: u, onPanZoom: f, onPanZoomStart: d, onPanZoomEnd: h, onDraggingChange: p }) {
  const g = {
    isZoomingOrPanning: !1,
    usedRightMouseButton: !1,
    prevViewport: {},
    mouseButton: 0,
    timerId: void 0,
    panScrollTimeout: void 0,
    isPanScrolling: !1
  }, m = n.getBoundingClientRect(), v = Lm().scaleExtent([a, o]).translateExtent(s), b = Le(n).call(v);
  D({
    x: u.x,
    y: u.y,
    zoom: al(u.zoom, a, o)
  }, [
    [0, 0],
    [m.width, m.height]
  ], s);
  const S = b.on("wheel.zoom"), E = b.on("dblclick.zoom");
  v.wheelDelta(dv);
  function A(X, k) {
    return b ? new Promise((it) => {
      v?.interpolate(k?.interpolate === "linear" ? uo : hr).transform(_f(b, k?.duration, k?.ease, () => it(!0)), X);
    }) : Promise.resolve(!1);
  }
  function _({ noWheelClassName: X, noPanClassName: k, onPaneContextMenu: it, userSelectionActive: O, panOnScroll: G, panOnDrag: N, panOnScrollMode: H, panOnScrollSpeed: Y, preventScrolling: K, zoomOnPinch: tt, zoomOnScroll: T, zoomOnDoubleClick: j, zoomActivationKeyPressed: P, lib: et, onTransformChange: rt, connectionInProgress: ct, paneClickDistance: ut, selectionOnDrag: st }) {
    O && !g.isZoomingOrPanning && C();
    const ft = G && !P && !O;
    v.clickDistance(st ? 1 / 0 : !an(ut) || ut < 0 ? 0 : ut);
    const wt = ft ? $_({
      zoomPanValues: g,
      noWheelClassName: X,
      d3Selection: b,
      d3Zoom: v,
      panOnScrollMode: H,
      panOnScrollSpeed: Y,
      zoomOnPinch: tt,
      onPanZoomStart: d,
      onPanZoom: f,
      onPanZoomEnd: h
    }) : J_({
      noWheelClassName: X,
      preventScrolling: K,
      d3ZoomHandler: S
    });
    if (b.on("wheel.zoom", wt, { passive: !1 }), !O) {
      const yt = F_({
        zoomPanValues: g,
        onDraggingChange: p,
        onPanZoomStart: d
      });
      v.on("start", yt);
      const vt = I_({
        zoomPanValues: g,
        panOnDrag: N,
        onPaneContextMenu: !!it,
        onPanZoom: f,
        onTransformChange: rt
      });
      v.on("zoom", vt);
      const Nt = W_({
        zoomPanValues: g,
        panOnDrag: N,
        panOnScroll: G,
        onPaneContextMenu: it,
        onPanZoomEnd: h,
        onDraggingChange: p
      });
      v.on("end", Nt);
    }
    const xt = P_({
      zoomActivationKeyPressed: P,
      panOnDrag: N,
      zoomOnScroll: T,
      panOnScroll: G,
      zoomOnDoubleClick: j,
      zoomOnPinch: tt,
      userSelectionActive: O,
      noPanClassName: k,
      noWheelClassName: X,
      lib: et,
      connectionInProgress: ct
    });
    v.filter(xt), j ? b.on("dblclick.zoom", E) : b.on("dblclick.zoom", null);
  }
  function C() {
    v.on("zoom", null);
  }
  async function D(X, k, it) {
    const O = Ef(X), G = v?.constrain()(O, k, it);
    return G && await A(G), new Promise((N) => N(G));
  }
  async function w(X, k) {
    const it = Ef(X);
    return await A(it, k), new Promise((O) => O(it));
  }
  function z(X) {
    if (b) {
      const k = Ef(X), it = b.property("__zoom");
      (it.k !== X.zoom || it.x !== X.x || it.y !== X.y) && v?.transform(b, k, null, { sync: !0 });
    }
  }
  function q() {
    const X = b ? Bm(b.node()) : { x: 0, y: 0, k: 1 };
    return { x: X.x, y: X.y, zoom: X.k };
  }
  function B(X, k) {
    return b ? new Promise((it) => {
      v?.interpolate(k?.interpolate === "linear" ? uo : hr).scaleTo(_f(b, k?.duration, k?.ease, () => it(!0)), X);
    }) : Promise.resolve(!1);
  }
  function U(X, k) {
    return b ? new Promise((it) => {
      v?.interpolate(k?.interpolate === "linear" ? uo : hr).scaleBy(_f(b, k?.duration, k?.ease, () => it(!0)), X);
    }) : Promise.resolve(!1);
  }
  function Q(X) {
    v?.scaleExtent(X);
  }
  function Z(X) {
    v?.translateExtent(X);
  }
  function ot(X) {
    const k = !an(X) || X < 0 ? 0 : X;
    v?.clickDistance(k);
  }
  return {
    update: _,
    destroy: C,
    setViewport: w,
    setViewportConstrained: D,
    getViewport: q,
    scaleTo: B,
    scaleBy: U,
    setScaleExtent: Q,
    setTranslateExtent: Z,
    syncViewport: z,
    setClickDistance: ot
  };
}
var sl;
(function(n) {
  n.Line = "line", n.Handle = "handle";
})(sl || (sl = {}));
function eC({ width: n, prevWidth: a, height: o, prevHeight: s, affectsX: u, affectsY: f }) {
  const d = n - a, h = o - s, p = [d > 0 ? 1 : d < 0 ? -1 : 0, h > 0 ? 1 : h < 0 ? -1 : 0];
  return d && u && (p[0] = p[0] * -1), h && f && (p[1] = p[1] * -1), p;
}
function c0(n) {
  const a = n.includes("right") || n.includes("left"), o = n.includes("bottom") || n.includes("top"), s = n.includes("left"), u = n.includes("top");
  return {
    isHorizontal: a,
    isVertical: o,
    affectsX: s,
    affectsY: u
  };
}
function wi(n, a) {
  return Math.max(0, a - n);
}
function Ei(n, a) {
  return Math.max(0, n - a);
}
function ur(n, a, o) {
  return Math.max(0, a - n, n - o);
}
function f0(n, a) {
  return n ? !a : a;
}
function nC(n, a, o, s, u, f, d, h) {
  let { affectsX: p, affectsY: g } = a;
  const { isHorizontal: m, isVertical: v } = a, b = m && v, { xSnapped: S, ySnapped: E } = o, { minWidth: A, maxWidth: _, minHeight: C, maxHeight: D } = s, { x: w, y: z, width: q, height: B, aspectRatio: U } = n;
  let Q = Math.floor(m ? S - n.pointerX : 0), Z = Math.floor(v ? E - n.pointerY : 0);
  const ot = q + (p ? -Q : Q), X = B + (g ? -Z : Z), k = -f[0] * q, it = -f[1] * B;
  let O = ur(ot, A, _), G = ur(X, C, D);
  if (d) {
    let Y = 0, K = 0;
    p && Q < 0 ? Y = wi(w + Q + k, d[0][0]) : !p && Q > 0 && (Y = Ei(w + ot + k, d[1][0])), g && Z < 0 ? K = wi(z + Z + it, d[0][1]) : !g && Z > 0 && (K = Ei(z + X + it, d[1][1])), O = Math.max(O, Y), G = Math.max(G, K);
  }
  if (h) {
    let Y = 0, K = 0;
    p && Q > 0 ? Y = Ei(w + Q, h[0][0]) : !p && Q < 0 && (Y = wi(w + ot, h[1][0])), g && Z > 0 ? K = Ei(z + Z, h[0][1]) : !g && Z < 0 && (K = wi(z + X, h[1][1])), O = Math.max(O, Y), G = Math.max(G, K);
  }
  if (u) {
    if (m) {
      const Y = ur(ot / U, C, D) * U;
      if (O = Math.max(O, Y), d) {
        let K = 0;
        !p && !g || p && !g && b ? K = Ei(z + it + ot / U, d[1][1]) * U : K = wi(z + it + (p ? Q : -Q) / U, d[0][1]) * U, O = Math.max(O, K);
      }
      if (h) {
        let K = 0;
        !p && !g || p && !g && b ? K = wi(z + ot / U, h[1][1]) * U : K = Ei(z + (p ? Q : -Q) / U, h[0][1]) * U, O = Math.max(O, K);
      }
    }
    if (v) {
      const Y = ur(X * U, A, _) / U;
      if (G = Math.max(G, Y), d) {
        let K = 0;
        !p && !g || g && !p && b ? K = Ei(w + X * U + k, d[1][0]) / U : K = wi(w + (g ? Z : -Z) * U + k, d[0][0]) / U, G = Math.max(G, K);
      }
      if (h) {
        let K = 0;
        !p && !g || g && !p && b ? K = wi(w + X * U, h[1][0]) / U : K = Ei(w + (g ? Z : -Z) * U, h[0][0]) / U, G = Math.max(G, K);
      }
    }
  }
  Z = Z + (Z < 0 ? G : -G), Q = Q + (Q < 0 ? O : -O), u && (b ? ot > X * U ? Z = (f0(p, g) ? -Q : Q) / U : Q = (f0(p, g) ? -Z : Z) * U : m ? (Z = Q / U, g = p) : (Q = Z * U, p = g));
  const N = p ? w + Q : w, H = g ? z + Z : z;
  return {
    width: q + (p ? -Q : Q),
    height: B + (g ? -Z : Z),
    x: f[0] * Q * (p ? -1 : 1) + N,
    y: f[1] * Z * (g ? -1 : 1) + H
  };
}
const hv = { width: 0, height: 0, x: 0, y: 0 }, iC = {
  ...hv,
  pointerX: 0,
  pointerY: 0,
  aspectRatio: 1
};
function aC(n) {
  return [
    [0, 0],
    [n.measured.width, n.measured.height]
  ];
}
function lC(n, a, o) {
  const s = a.position.x + n.position.x, u = a.position.y + n.position.y, f = n.measured.width ?? 0, d = n.measured.height ?? 0, h = o[0] * f, p = o[1] * d;
  return [
    [s - h, u - p],
    [s + f - h, u + d - p]
  ];
}
function oC({ domNode: n, nodeId: a, getStoreItems: o, onChange: s, onEnd: u }) {
  const f = Le(n);
  let d = {
    controlDirection: c0("bottom-right"),
    boundaries: {
      minWidth: 0,
      minHeight: 0,
      maxWidth: Number.MAX_VALUE,
      maxHeight: Number.MAX_VALUE
    },
    resizeDirection: void 0,
    keepAspectRatio: !1
  };
  function h({ controlPosition: g, boundaries: m, keepAspectRatio: v, resizeDirection: b, onResizeStart: S, onResize: E, onResizeEnd: A, shouldResize: _ }) {
    let C = { ...hv }, D = { ...iC };
    d = {
      boundaries: m,
      resizeDirection: b,
      keepAspectRatio: v,
      controlDirection: c0(g)
    };
    let w, z = null, q = [], B, U, Q, Z = !1;
    const ot = Em().on("start", (X) => {
      const { nodeLookup: k, transform: it, snapGrid: O, snapToGrid: G, nodeOrigin: N, paneDomNode: H } = o();
      if (w = k.get(a), !w)
        return;
      z = H?.getBoundingClientRect() ?? null;
      const { xSnapped: Y, ySnapped: K } = co(X.sourceEvent, {
        transform: it,
        snapGrid: O,
        snapToGrid: G,
        containerBounds: z
      });
      C = {
        width: w.measured.width ?? 0,
        height: w.measured.height ?? 0,
        x: w.position.x ?? 0,
        y: w.position.y ?? 0
      }, D = {
        ...C,
        pointerX: Y,
        pointerY: K,
        aspectRatio: C.width / C.height
      }, B = void 0, w.parentId && (w.extent === "parent" || w.expandParent) && (B = k.get(w.parentId), U = B && w.extent === "parent" ? aC(B) : void 0), q = [], Q = void 0;
      for (const [tt, T] of k)
        if (T.parentId === a && (q.push({
          id: tt,
          position: { ...T.position },
          extent: T.extent
        }), T.extent === "parent" || T.expandParent)) {
          const j = lC(T, w, T.origin ?? N);
          Q ? Q = [
            [Math.min(j[0][0], Q[0][0]), Math.min(j[0][1], Q[0][1])],
            [Math.max(j[1][0], Q[1][0]), Math.max(j[1][1], Q[1][1])]
          ] : Q = j;
        }
      S?.(X, { ...C });
    }).on("drag", (X) => {
      const { transform: k, snapGrid: it, snapToGrid: O, nodeOrigin: G } = o(), N = co(X.sourceEvent, {
        transform: k,
        snapGrid: it,
        snapToGrid: O,
        containerBounds: z
      }), H = [];
      if (!w)
        return;
      const { x: Y, y: K, width: tt, height: T } = C, j = {}, P = w.origin ?? G, { width: et, height: rt, x: ct, y: ut } = nC(D, d.controlDirection, N, d.boundaries, d.keepAspectRatio, P, U, Q), st = et !== tt, ft = rt !== T, wt = ct !== Y && st, xt = ut !== K && ft;
      if (!wt && !xt && !st && !ft)
        return;
      if ((wt || xt || P[0] === 1 || P[1] === 1) && (j.x = wt ? ct : C.x, j.y = xt ? ut : C.y, C.x = j.x, C.y = j.y, q.length > 0)) {
        const Bt = ct - Y, Ht = ut - K;
        for (const oe of q)
          oe.position = {
            x: oe.position.x - Bt + P[0] * (et - tt),
            y: oe.position.y - Ht + P[1] * (rt - T)
          }, H.push(oe);
      }
      if ((st || ft) && (j.width = st && (!d.resizeDirection || d.resizeDirection === "horizontal") ? et : C.width, j.height = ft && (!d.resizeDirection || d.resizeDirection === "vertical") ? rt : C.height, C.width = j.width, C.height = j.height), B && w.expandParent) {
        const Bt = P[0] * (j.width ?? 0);
        j.x && j.x < Bt && (C.x = Bt, D.x = D.x - (j.x - Bt));
        const Ht = P[1] * (j.height ?? 0);
        j.y && j.y < Ht && (C.y = Ht, D.y = D.y - (j.y - Ht));
      }
      const yt = eC({
        width: C.width,
        prevWidth: tt,
        height: C.height,
        prevHeight: T,
        affectsX: d.controlDirection.affectsX,
        affectsY: d.controlDirection.affectsY
      }), vt = { ...C, direction: yt };
      _?.(X, vt) !== !1 && (Z = !0, E?.(X, vt), s(j, H));
    }).on("end", (X) => {
      Z && (A?.(X, { ...C }), u?.({ ...C }), Z = !1);
    });
    f.call(ot);
  }
  function p() {
    f.on(".drag", null);
  }
  return {
    update: h,
    destroy: p
  };
}
var Cf = { exports: {} }, Nf = {}, Tf = { exports: {} }, Af = {};
/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var d0;
function sC() {
  if (d0) return Af;
  d0 = 1;
  var n = Co();
  function a(v, b) {
    return v === b && (v !== 0 || 1 / v === 1 / b) || v !== v && b !== b;
  }
  var o = typeof Object.is == "function" ? Object.is : a, s = n.useState, u = n.useEffect, f = n.useLayoutEffect, d = n.useDebugValue;
  function h(v, b) {
    var S = b(), E = s({ inst: { value: S, getSnapshot: b } }), A = E[0].inst, _ = E[1];
    return f(
      function() {
        A.value = S, A.getSnapshot = b, p(A) && _({ inst: A });
      },
      [v, S, b]
    ), u(
      function() {
        return p(A) && _({ inst: A }), v(function() {
          p(A) && _({ inst: A });
        });
      },
      [v]
    ), d(S), S;
  }
  function p(v) {
    var b = v.getSnapshot;
    v = v.value;
    try {
      var S = b();
      return !o(v, S);
    } catch {
      return !0;
    }
  }
  function g(v, b) {
    return b();
  }
  var m = typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u" ? g : h;
  return Af.useSyncExternalStore = n.useSyncExternalStore !== void 0 ? n.useSyncExternalStore : m, Af;
}
var h0;
function rC() {
  return h0 || (h0 = 1, Tf.exports = sC()), Tf.exports;
}
/**
 * @license React
 * use-sync-external-store-shim/with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var g0;
function uC() {
  if (g0) return Nf;
  g0 = 1;
  var n = Co(), a = rC();
  function o(g, m) {
    return g === m && (g !== 0 || 1 / g === 1 / m) || g !== g && m !== m;
  }
  var s = typeof Object.is == "function" ? Object.is : o, u = a.useSyncExternalStore, f = n.useRef, d = n.useEffect, h = n.useMemo, p = n.useDebugValue;
  return Nf.useSyncExternalStoreWithSelector = function(g, m, v, b, S) {
    var E = f(null);
    if (E.current === null) {
      var A = { hasValue: !1, value: null };
      E.current = A;
    } else A = E.current;
    E = h(
      function() {
        function C(B) {
          if (!D) {
            if (D = !0, w = B, B = b(B), S !== void 0 && A.hasValue) {
              var U = A.value;
              if (S(U, B))
                return z = U;
            }
            return z = B;
          }
          if (U = z, s(w, B)) return U;
          var Q = b(B);
          return S !== void 0 && S(U, Q) ? (w = B, U) : (w = B, z = Q);
        }
        var D = !1, w, z, q = v === void 0 ? null : v;
        return [
          function() {
            return C(m());
          },
          q === null ? void 0 : function() {
            return C(q());
          }
        ];
      },
      [m, v, b, S]
    );
    var _ = u(g, E[0], E[1]);
    return d(
      function() {
        A.hasValue = !0, A.value = _;
      },
      [_]
    ), p(_), _;
  }, Nf;
}
var p0;
function cC() {
  return p0 || (p0 = 1, Cf.exports = uC()), Cf.exports;
}
var fC = cC();
const dC = /* @__PURE__ */ G0(fC), hC = {}, y0 = (n) => {
  let a;
  const o = /* @__PURE__ */ new Set(), s = (m, v) => {
    const b = typeof m == "function" ? m(a) : m;
    if (!Object.is(b, a)) {
      const S = a;
      a = v ?? (typeof b != "object" || b === null) ? b : Object.assign({}, a, b), o.forEach((E) => E(a, S));
    }
  }, u = () => a, p = { setState: s, getState: u, getInitialState: () => g, subscribe: (m) => (o.add(m), () => o.delete(m)), destroy: () => {
    (hC ? "production" : void 0) !== "production" && console.warn(
      "[DEPRECATED] The `destroy` method will be unsupported in a future version. Instead use unsubscribe function returned by subscribe. Everything will be garbage-collected if store is garbage-collected."
    ), o.clear();
  } }, g = a = n(s, u, p);
  return p;
}, gC = (n) => n ? y0(n) : y0, { useDebugValue: pC } = ex, { useSyncExternalStoreWithSelector: yC } = dC, mC = (n) => n;
function gv(n, a = mC, o) {
  const s = yC(
    n.subscribe,
    n.getState,
    n.getServerState || n.getInitialState,
    a,
    o
  );
  return pC(s), s;
}
const m0 = (n, a) => {
  const o = gC(n), s = (u, f = a) => gv(o, u, f);
  return Object.assign(s, o), s;
}, vC = (n, a) => n ? m0(n, a) : m0;
function Gt(n, a) {
  if (Object.is(n, a))
    return !0;
  if (typeof n != "object" || n === null || typeof a != "object" || a === null)
    return !1;
  if (n instanceof Map && a instanceof Map) {
    if (n.size !== a.size) return !1;
    for (const [s, u] of n)
      if (!Object.is(u, a.get(s)))
        return !1;
    return !0;
  }
  if (n instanceof Set && a instanceof Set) {
    if (n.size !== a.size) return !1;
    for (const s of n)
      if (!a.has(s))
        return !1;
    return !0;
  }
  const o = Object.keys(n);
  if (o.length !== Object.keys(a).length)
    return !1;
  for (const s of o)
    if (!Object.prototype.hasOwnProperty.call(a, s) || !Object.is(n[s], a[s]))
      return !1;
  return !0;
}
Z0();
const Yr = F.createContext(null), bC = Yr.Provider, pv = yn.error001();
function zt(n, a) {
  const o = F.useContext(Yr);
  if (o === null)
    throw new Error(pv);
  return gv(o, n, a);
}
function Zt() {
  const n = F.useContext(Yr);
  if (n === null)
    throw new Error(pv);
  return F.useMemo(() => ({
    getState: n.getState,
    setState: n.setState,
    subscribe: n.subscribe
  }), [n]);
}
const v0 = { display: "none" }, xC = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  border: 0,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0px, 0px, 0px, 0px)",
  clipPath: "inset(100%)"
}, yv = "react-flow__node-desc", mv = "react-flow__edge-desc", SC = "react-flow__aria-live", wC = (n) => n.ariaLiveMessage, EC = (n) => n.ariaLabelConfig;
function _C({ rfId: n }) {
  const a = zt(wC);
  return M.jsx("div", { id: `${SC}-${n}`, "aria-live": "assertive", "aria-atomic": "true", style: xC, children: a });
}
function CC({ rfId: n, disableKeyboardA11y: a }) {
  const o = zt(EC);
  return M.jsxs(M.Fragment, { children: [M.jsx("div", { id: `${yv}-${n}`, style: v0, children: a ? o["node.a11yDescription.default"] : o["node.a11yDescription.keyboardDisabled"] }), M.jsx("div", { id: `${mv}-${n}`, style: v0, children: o["edge.a11yDescription.default"] }), !a && M.jsx(_C, { rfId: n })] });
}
const Vr = F.forwardRef(({ position: n = "top-left", children: a, className: o, style: s, ...u }, f) => {
  const d = `${n}`.split("-");
  return M.jsx("div", { className: ie(["react-flow__panel", o, ...d]), style: s, ref: f, ...u, children: a });
});
Vr.displayName = "Panel";
function NC({ proOptions: n, position: a = "bottom-right" }) {
  return n?.hideAttribution ? null : M.jsx(Vr, { position: a, className: "react-flow__attribution", "data-message": "Please only hide this attribution when you are subscribed to React Flow Pro: https://pro.reactflow.dev", children: M.jsx("a", { href: "https://reactflow.dev", target: "_blank", rel: "noopener noreferrer", "aria-label": "React Flow attribution", children: "React Flow" }) });
}
const TC = (n) => {
  const a = [], o = [];
  for (const [, s] of n.nodeLookup)
    s.selected && a.push(s.internals.userNode);
  for (const [, s] of n.edgeLookup)
    s.selected && o.push(s);
  return { selectedNodes: a, selectedEdges: o };
}, cr = (n) => n.id;
function AC(n, a) {
  return Gt(n.selectedNodes.map(cr), a.selectedNodes.map(cr)) && Gt(n.selectedEdges.map(cr), a.selectedEdges.map(cr));
}
function MC({ onSelectionChange: n }) {
  const a = Zt(), { selectedNodes: o, selectedEdges: s } = zt(TC, AC);
  return F.useEffect(() => {
    const u = { nodes: o, edges: s };
    n?.(u), a.getState().onSelectionChangeHandlers.forEach((f) => f(u));
  }, [o, s, n]), null;
}
const zC = (n) => !!n.onSelectionChangeHandlers;
function OC({ onSelectionChange: n }) {
  const a = zt(zC);
  return n || a ? M.jsx(MC, { onSelectionChange: n }) : null;
}
const Wf = typeof window < "u" ? F.useLayoutEffect : F.useEffect, vv = [0, 0], DC = { x: 0, y: 0, zoom: 1 }, RC = [
  "nodes",
  "edges",
  "defaultNodes",
  "defaultEdges",
  "onConnect",
  "onConnectStart",
  "onConnectEnd",
  "onClickConnectStart",
  "onClickConnectEnd",
  "nodesDraggable",
  "autoPanOnNodeFocus",
  "nodesConnectable",
  "nodesFocusable",
  "edgesFocusable",
  "edgesReconnectable",
  "elevateNodesOnSelect",
  "elevateEdgesOnSelect",
  "minZoom",
  "maxZoom",
  "nodeExtent",
  "onNodesChange",
  "onEdgesChange",
  "elementsSelectable",
  "connectionMode",
  "snapGrid",
  "snapToGrid",
  "translateExtent",
  "connectOnClick",
  "defaultEdgeOptions",
  "fitView",
  "fitViewOptions",
  "onNodesDelete",
  "onEdgesDelete",
  "onDelete",
  "onNodeDrag",
  "onNodeDragStart",
  "onNodeDragStop",
  "onSelectionDrag",
  "onSelectionDragStart",
  "onSelectionDragStop",
  "onMoveStart",
  "onMove",
  "onMoveEnd",
  "noPanClassName",
  "nodeOrigin",
  "autoPanOnConnect",
  "autoPanOnNodeDrag",
  "onError",
  "connectionRadius",
  "isValidConnection",
  "selectNodesOnDrag",
  "nodeDragThreshold",
  "connectionDragThreshold",
  "onBeforeDelete",
  "debug",
  "autoPanSpeed",
  "ariaLabelConfig",
  "zIndexMode"
], b0 = [...RC, "rfId"], HC = (n) => ({
  setNodes: n.setNodes,
  setEdges: n.setEdges,
  setMinZoom: n.setMinZoom,
  setMaxZoom: n.setMaxZoom,
  setTranslateExtent: n.setTranslateExtent,
  setNodeExtent: n.setNodeExtent,
  reset: n.reset,
  setDefaultNodesAndEdges: n.setDefaultNodesAndEdges
}), x0 = {
  /*
   * these are values that are also passed directly to other components
   * than the StoreUpdater. We can reduce the number of setStore calls
   * by setting the same values here as prev fields.
   */
  translateExtent: bo,
  nodeOrigin: vv,
  minZoom: 0.5,
  maxZoom: 2,
  elementsSelectable: !0,
  noPanClassName: "nopan",
  rfId: "1"
};
function jC(n) {
  const { setNodes: a, setEdges: o, setMinZoom: s, setMaxZoom: u, setTranslateExtent: f, setNodeExtent: d, reset: h, setDefaultNodesAndEdges: p } = zt(HC, Gt), g = Zt();
  Wf(() => (p(n.defaultNodes, n.defaultEdges), () => {
    m.current = x0, h();
  }), []);
  const m = F.useRef(x0);
  return Wf(
    () => {
      for (const v of b0) {
        const b = n[v], S = m.current[v];
        b !== S && (typeof n[v] > "u" || (v === "nodes" ? a(b) : v === "edges" ? o(b) : v === "minZoom" ? s(b) : v === "maxZoom" ? u(b) : v === "translateExtent" ? f(b) : v === "nodeExtent" ? d(b) : v === "ariaLabelConfig" ? g.setState({ ariaLabelConfig: v_(b) }) : v === "fitView" ? g.setState({ fitViewQueued: b }) : v === "fitViewOptions" ? g.setState({ fitViewOptions: b }) : g.setState({ [v]: b })));
      }
      m.current = n;
    },
    // Only re-run the effect if one of the fields we track changes
    b0.map((v) => n[v])
  ), null;
}
function S0() {
  return typeof window > "u" || !window.matchMedia ? null : window.matchMedia("(prefers-color-scheme: dark)");
}
function UC(n) {
  const [a, o] = F.useState(n === "system" ? null : n);
  return F.useEffect(() => {
    if (n !== "system") {
      o(n);
      return;
    }
    const s = S0(), u = () => o(s?.matches ? "dark" : "light");
    return u(), s?.addEventListener("change", u), () => {
      s?.removeEventListener("change", u);
    };
  }, [n]), a !== null ? a : S0()?.matches ? "dark" : "light";
}
const w0 = typeof document < "u" ? document : null;
function Eo(n = null, a = { target: w0, actInsideInputWithModifier: !0 }) {
  const [o, s] = F.useState(!1), u = F.useRef(!1), f = F.useRef(/* @__PURE__ */ new Set([])), [d, h] = F.useMemo(() => {
    if (n !== null) {
      const g = (Array.isArray(n) ? n : [n]).filter((v) => typeof v == "string").map((v) => v.replace("+", `
`).replace(`

`, `
+`).split(`
`)), m = g.reduce((v, b) => v.concat(...b), []);
      return [g, m];
    }
    return [[], []];
  }, [n]);
  return F.useEffect(() => {
    const p = a?.target ?? w0, g = a?.actInsideInputWithModifier ?? !0;
    if (n !== null) {
      const m = (S) => {
        if (u.current = S.ctrlKey || S.metaKey || S.shiftKey || S.altKey, (!u.current || u.current && !g) && Im(S))
          return !1;
        const A = _0(S.code, h);
        if (f.current.add(S[A]), E0(d, f.current, !1)) {
          const _ = S.composedPath?.()?.[0] || S.target, C = _?.nodeName === "BUTTON" || _?.nodeName === "A";
          a.preventDefault !== !1 && (u.current || !C) && S.preventDefault(), s(!0);
        }
      }, v = (S) => {
        const E = _0(S.code, h);
        E0(d, f.current, !0) ? (s(!1), f.current.clear()) : f.current.delete(S[E]), S.key === "Meta" && f.current.clear(), u.current = !1;
      }, b = () => {
        f.current.clear(), s(!1);
      };
      return p?.addEventListener("keydown", m), p?.addEventListener("keyup", v), window.addEventListener("blur", b), window.addEventListener("contextmenu", b), () => {
        p?.removeEventListener("keydown", m), p?.removeEventListener("keyup", v), window.removeEventListener("blur", b), window.removeEventListener("contextmenu", b);
      };
    }
  }, [n, s]), o;
}
function E0(n, a, o) {
  return n.filter((s) => o || s.length === a.size).some((s) => s.every((u) => a.has(u)));
}
function _0(n, a) {
  return a.includes(n) ? "code" : "key";
}
const BC = () => {
  const n = Zt();
  return F.useMemo(() => ({
    zoomIn: (a) => {
      const { panZoom: o } = n.getState();
      return o ? o.scaleBy(1.2, a) : Promise.resolve(!1);
    },
    zoomOut: (a) => {
      const { panZoom: o } = n.getState();
      return o ? o.scaleBy(1 / 1.2, a) : Promise.resolve(!1);
    },
    zoomTo: (a, o) => {
      const { panZoom: s } = n.getState();
      return s ? s.scaleTo(a, o) : Promise.resolve(!1);
    },
    getZoom: () => n.getState().transform[2],
    setViewport: async (a, o) => {
      const { transform: [s, u, f], panZoom: d } = n.getState();
      return d ? (await d.setViewport({
        x: a.x ?? s,
        y: a.y ?? u,
        zoom: a.zoom ?? f
      }, o), Promise.resolve(!0)) : Promise.resolve(!1);
    },
    getViewport: () => {
      const [a, o, s] = n.getState().transform;
      return { x: a, y: o, zoom: s };
    },
    setCenter: async (a, o, s) => n.getState().setCenter(a, o, s),
    fitBounds: async (a, o) => {
      const { width: s, height: u, minZoom: f, maxZoom: d, panZoom: h } = n.getState(), p = yd(a, s, u, f, d, o?.padding ?? 0.1);
      return h ? (await h.setViewport(p, {
        duration: o?.duration,
        ease: o?.ease,
        interpolate: o?.interpolate
      }), Promise.resolve(!0)) : Promise.resolve(!1);
    },
    screenToFlowPosition: (a, o = {}) => {
      const { transform: s, snapGrid: u, snapToGrid: f, domNode: d } = n.getState();
      if (!d)
        return a;
      const { x: h, y: p } = d.getBoundingClientRect(), g = {
        x: a.x - h,
        y: a.y - p
      }, m = o.snapGrid ?? u, v = o.snapToGrid ?? f;
      return Do(g, s, v, m);
    },
    flowToScreenPosition: (a) => {
      const { transform: o, domNode: s } = n.getState();
      if (!s)
        return a;
      const { x: u, y: f } = s.getBoundingClientRect(), d = Ar(a, o);
      return {
        x: d.x + u,
        y: d.y + f
      };
    }
  }), []);
};
function bv(n, a) {
  const o = [], s = /* @__PURE__ */ new Map(), u = [];
  for (const f of n)
    if (f.type === "add") {
      u.push(f);
      continue;
    } else if (f.type === "remove" || f.type === "replace")
      s.set(f.id, [f]);
    else {
      const d = s.get(f.id);
      d ? d.push(f) : s.set(f.id, [f]);
    }
  for (const f of a) {
    const d = s.get(f.id);
    if (!d) {
      o.push(f);
      continue;
    }
    if (d[0].type === "remove")
      continue;
    if (d[0].type === "replace") {
      o.push({ ...d[0].item });
      continue;
    }
    const h = { ...f };
    for (const p of d)
      LC(p, h);
    o.push(h);
  }
  return u.length && u.forEach((f) => {
    f.index !== void 0 ? o.splice(f.index, 0, { ...f.item }) : o.push({ ...f.item });
  }), o;
}
function LC(n, a) {
  switch (n.type) {
    case "select": {
      a.selected = n.selected;
      break;
    }
    case "position": {
      typeof n.position < "u" && (a.position = n.position), typeof n.dragging < "u" && (a.dragging = n.dragging);
      break;
    }
    case "dimensions": {
      typeof n.dimensions < "u" && (a.measured = {
        ...n.dimensions
      }, n.setAttributes && ((n.setAttributes === !0 || n.setAttributes === "width") && (a.width = n.dimensions.width), (n.setAttributes === !0 || n.setAttributes === "height") && (a.height = n.dimensions.height))), typeof n.resizing == "boolean" && (a.resizing = n.resizing);
      break;
    }
  }
}
function qC(n, a) {
  return bv(n, a);
}
function YC(n, a) {
  return bv(n, a);
}
function Wi(n, a) {
  return {
    id: n,
    type: "select",
    selected: a
  };
}
function Wa(n, a = /* @__PURE__ */ new Set(), o = !1) {
  const s = [];
  for (const [u, f] of n) {
    const d = a.has(u);
    !(f.selected === void 0 && !d) && f.selected !== d && (o && (f.selected = d), s.push(Wi(f.id, d)));
  }
  return s;
}
function C0({ items: n = [], lookup: a }) {
  const o = [], s = new Map(n.map((u) => [u.id, u]));
  for (const [u, f] of n.entries()) {
    const d = a.get(f.id), h = d?.internals?.userNode ?? d;
    h !== void 0 && h !== f && o.push({ id: f.id, item: f, type: "replace" }), h === void 0 && o.push({ item: f, type: "add", index: u });
  }
  for (const [u] of a)
    s.get(u) === void 0 && o.push({ id: u, type: "remove" });
  return o;
}
function N0(n) {
  return {
    id: n.id,
    type: "remove"
  };
}
const T0 = (n) => r_(n), VC = (n) => Xm(n);
function xv(n) {
  return F.forwardRef(n);
}
function A0(n) {
  const [a, o] = F.useState(BigInt(0)), [s] = F.useState(() => QC(() => o((u) => u + BigInt(1))));
  return Wf(() => {
    const u = s.get();
    u.length && (n(u), s.reset());
  }, [a]), s;
}
function QC(n) {
  let a = [];
  return {
    get: () => a,
    reset: () => {
      a = [];
    },
    push: (o) => {
      a.push(o), n();
    }
  };
}
const Sv = F.createContext(null);
function XC({ children: n }) {
  const a = Zt(), o = F.useCallback((h) => {
    const { nodes: p = [], setNodes: g, hasDefaultNodes: m, onNodesChange: v, nodeLookup: b, fitViewQueued: S, onNodesChangeMiddlewareMap: E } = a.getState();
    let A = p;
    for (const C of h)
      A = typeof C == "function" ? C(A) : C;
    let _ = C0({
      items: A,
      lookup: b
    });
    for (const C of E.values())
      _ = C(_);
    m && g(A), _.length > 0 ? v?.(_) : S && window.requestAnimationFrame(() => {
      const { fitViewQueued: C, nodes: D, setNodes: w } = a.getState();
      C && w(D);
    });
  }, []), s = A0(o), u = F.useCallback((h) => {
    const { edges: p = [], setEdges: g, hasDefaultEdges: m, onEdgesChange: v, edgeLookup: b } = a.getState();
    let S = p;
    for (const E of h)
      S = typeof E == "function" ? E(S) : E;
    m ? g(S) : v && v(C0({
      items: S,
      lookup: b
    }));
  }, []), f = A0(u), d = F.useMemo(() => ({ nodeQueue: s, edgeQueue: f }), []);
  return M.jsx(Sv.Provider, { value: d, children: n });
}
function kC() {
  const n = F.useContext(Sv);
  if (!n)
    throw new Error("useBatchContext must be used within a BatchProvider");
  return n;
}
const GC = (n) => !!n.panZoom;
function Ed() {
  const n = BC(), a = Zt(), o = kC(), s = zt(GC), u = F.useMemo(() => {
    const f = (v) => a.getState().nodeLookup.get(v), d = (v) => {
      o.nodeQueue.push(v);
    }, h = (v) => {
      o.edgeQueue.push(v);
    }, p = (v) => {
      const { nodeLookup: b, nodeOrigin: S } = a.getState(), E = T0(v) ? v : b.get(v.id), A = E.parentId ? Jm(E.position, E.measured, E.parentId, b, S) : E.position, _ = {
        ...E,
        position: A,
        width: E.measured?.width ?? E.width,
        height: E.measured?.height ?? E.height
      };
      return ll(_);
    }, g = (v, b, S = { replace: !1 }) => {
      d((E) => E.map((A) => {
        if (A.id === v) {
          const _ = typeof b == "function" ? b(A) : b;
          return S.replace && T0(_) ? _ : { ...A, ..._ };
        }
        return A;
      }));
    }, m = (v, b, S = { replace: !1 }) => {
      h((E) => E.map((A) => {
        if (A.id === v) {
          const _ = typeof b == "function" ? b(A) : b;
          return S.replace && VC(_) ? _ : { ...A, ..._ };
        }
        return A;
      }));
    };
    return {
      getNodes: () => a.getState().nodes.map((v) => ({ ...v })),
      getNode: (v) => f(v)?.internals.userNode,
      getInternalNode: f,
      getEdges: () => {
        const { edges: v = [] } = a.getState();
        return v.map((b) => ({ ...b }));
      },
      getEdge: (v) => a.getState().edgeLookup.get(v),
      setNodes: d,
      setEdges: h,
      addNodes: (v) => {
        const b = Array.isArray(v) ? v : [v];
        o.nodeQueue.push((S) => [...S, ...b]);
      },
      addEdges: (v) => {
        const b = Array.isArray(v) ? v : [v];
        o.edgeQueue.push((S) => [...S, ...b]);
      },
      toObject: () => {
        const { nodes: v = [], edges: b = [], transform: S } = a.getState(), [E, A, _] = S;
        return {
          nodes: v.map((C) => ({ ...C })),
          edges: b.map((C) => ({ ...C })),
          viewport: {
            x: E,
            y: A,
            zoom: _
          }
        };
      },
      deleteElements: async ({ nodes: v = [], edges: b = [] }) => {
        const { nodes: S, edges: E, onNodesDelete: A, onEdgesDelete: _, triggerNodeChanges: C, triggerEdgeChanges: D, onDelete: w, onBeforeDelete: z } = a.getState(), { nodes: q, edges: B } = await h_({
          nodesToRemove: v,
          edgesToRemove: b,
          nodes: S,
          edges: E,
          onBeforeDelete: z
        }), U = B.length > 0, Q = q.length > 0;
        if (U) {
          const Z = B.map(N0);
          _?.(B), D(Z);
        }
        if (Q) {
          const Z = q.map(N0);
          A?.(q), C(Z);
        }
        return (Q || U) && w?.({ nodes: q, edges: B }), { deletedNodes: q, deletedEdges: B };
      },
      /**
       * Partial is defined as "the 2 nodes/areas are intersecting partially".
       * If a is contained in b or b is contained in a, they are both
       * considered fully intersecting.
       */
      getIntersectingNodes: (v, b = !0, S) => {
        const E = Py(v), A = E ? v : p(v), _ = S !== void 0;
        return A ? (S || a.getState().nodes).filter((C) => {
          const D = a.getState().nodeLookup.get(C.id);
          if (D && !E && (C.id === v.id || !D.internals.positionAbsolute))
            return !1;
          const w = ll(_ ? C : D), z = So(w, A);
          return b && z > 0 || z >= w.width * w.height || z >= A.width * A.height;
        }) : [];
      },
      isNodeIntersecting: (v, b, S = !0) => {
        const A = Py(v) ? v : p(v);
        if (!A)
          return !1;
        const _ = So(A, b);
        return S && _ > 0 || _ >= b.width * b.height || _ >= A.width * A.height;
      },
      updateNode: g,
      updateNodeData: (v, b, S = { replace: !1 }) => {
        g(v, (E) => {
          const A = typeof b == "function" ? b(E) : b;
          return S.replace ? { ...E, data: A } : { ...E, data: { ...E.data, ...A } };
        }, S);
      },
      updateEdge: m,
      updateEdgeData: (v, b, S = { replace: !1 }) => {
        m(v, (E) => {
          const A = typeof b == "function" ? b(E) : b;
          return S.replace ? { ...E, data: A } : { ...E, data: { ...E.data, ...A } };
        }, S);
      },
      getNodesBounds: (v) => {
        const { nodeLookup: b, nodeOrigin: S } = a.getState();
        return u_(v, { nodeLookup: b, nodeOrigin: S });
      },
      getHandleConnections: ({ type: v, id: b, nodeId: S }) => Array.from(a.getState().connectionLookup.get(`${S}-${v}${b ? `-${b}` : ""}`)?.values() ?? []),
      getNodeConnections: ({ type: v, handleId: b, nodeId: S }) => Array.from(a.getState().connectionLookup.get(`${S}${v ? b ? `-${v}-${b}` : `-${v}` : ""}`)?.values() ?? []),
      fitView: async (v) => {
        const b = a.getState().fitViewResolver ?? m_();
        return a.setState({ fitViewQueued: !0, fitViewOptions: v, fitViewResolver: b }), o.nodeQueue.push((S) => [...S]), b.promise;
      }
    };
  }, []);
  return F.useMemo(() => ({
    ...u,
    ...n,
    viewportInitialized: s
  }), [s]);
}
const M0 = (n) => n.selected, ZC = typeof window < "u" ? window : void 0;
function KC({ deleteKeyCode: n, multiSelectionKeyCode: a }) {
  const o = Zt(), { deleteElements: s } = Ed(), u = Eo(n, { actInsideInputWithModifier: !1 }), f = Eo(a, { target: ZC });
  F.useEffect(() => {
    if (u) {
      const { edges: d, nodes: h } = o.getState();
      s({ nodes: h.filter(M0), edges: d.filter(M0) }), o.setState({ nodesSelectionActive: !1 });
    }
  }, [u]), F.useEffect(() => {
    o.setState({ multiSelectionActive: f });
  }, [f]);
}
function $C(n) {
  const a = Zt();
  F.useEffect(() => {
    const o = () => {
      if (!n.current || !(n.current.checkVisibility?.() ?? !0))
        return !1;
      const s = md(n.current);
      (s.height === 0 || s.width === 0) && a.getState().onError?.("004", yn.error004()), a.setState({ width: s.width || 500, height: s.height || 500 });
    };
    if (n.current) {
      o(), window.addEventListener("resize", o);
      const s = new ResizeObserver(() => o());
      return s.observe(n.current), () => {
        window.removeEventListener("resize", o), s && n.current && s.unobserve(n.current);
      };
    }
  }, []);
}
const Qr = {
  position: "absolute",
  width: "100%",
  height: "100%",
  top: 0,
  left: 0
}, JC = (n) => ({
  userSelectionActive: n.userSelectionActive,
  lib: n.lib,
  connectionInProgress: n.connection.inProgress
});
function FC({ onPaneContextMenu: n, zoomOnScroll: a = !0, zoomOnPinch: o = !0, panOnScroll: s = !1, panOnScrollSpeed: u = 0.5, panOnScrollMode: f = na.Free, zoomOnDoubleClick: d = !0, panOnDrag: h = !0, defaultViewport: p, translateExtent: g, minZoom: m, maxZoom: v, zoomActivationKeyCode: b, preventScrolling: S = !0, children: E, noWheelClassName: A, noPanClassName: _, onViewportChange: C, isControlledViewport: D, paneClickDistance: w, selectionOnDrag: z }) {
  const q = Zt(), B = F.useRef(null), { userSelectionActive: U, lib: Q, connectionInProgress: Z } = zt(JC, Gt), ot = Eo(b), X = F.useRef();
  $C(B);
  const k = F.useCallback((it) => {
    C?.({ x: it[0], y: it[1], zoom: it[2] }), D || q.setState({ transform: it });
  }, [C, D]);
  return F.useEffect(() => {
    if (B.current) {
      X.current = tC({
        domNode: B.current,
        minZoom: m,
        maxZoom: v,
        translateExtent: g,
        viewport: p,
        onDraggingChange: (N) => q.setState((H) => H.paneDragging === N ? H : { paneDragging: N }),
        onPanZoomStart: (N, H) => {
          const { onViewportChangeStart: Y, onMoveStart: K } = q.getState();
          K?.(N, H), Y?.(H);
        },
        onPanZoom: (N, H) => {
          const { onViewportChange: Y, onMove: K } = q.getState();
          K?.(N, H), Y?.(H);
        },
        onPanZoomEnd: (N, H) => {
          const { onViewportChangeEnd: Y, onMoveEnd: K } = q.getState();
          K?.(N, H), Y?.(H);
        }
      });
      const { x: it, y: O, zoom: G } = X.current.getViewport();
      return q.setState({
        panZoom: X.current,
        transform: [it, O, G],
        domNode: B.current.closest(".react-flow")
      }), () => {
        X.current?.destroy();
      };
    }
  }, []), F.useEffect(() => {
    X.current?.update({
      onPaneContextMenu: n,
      zoomOnScroll: a,
      zoomOnPinch: o,
      panOnScroll: s,
      panOnScrollSpeed: u,
      panOnScrollMode: f,
      zoomOnDoubleClick: d,
      panOnDrag: h,
      zoomActivationKeyPressed: ot,
      preventScrolling: S,
      noPanClassName: _,
      userSelectionActive: U,
      noWheelClassName: A,
      lib: Q,
      onTransformChange: k,
      connectionInProgress: Z,
      selectionOnDrag: z,
      paneClickDistance: w
    });
  }, [
    n,
    a,
    o,
    s,
    u,
    f,
    d,
    h,
    ot,
    S,
    _,
    U,
    A,
    Q,
    k,
    Z,
    z,
    w
  ]), M.jsx("div", { className: "react-flow__renderer", ref: B, style: Qr, children: E });
}
const IC = (n) => ({
  userSelectionActive: n.userSelectionActive,
  userSelectionRect: n.userSelectionRect
});
function WC() {
  const { userSelectionActive: n, userSelectionRect: a } = zt(IC, Gt);
  return n && a ? M.jsx("div", { className: "react-flow__selection react-flow__container", style: {
    width: a.width,
    height: a.height,
    transform: `translate(${a.x}px, ${a.y}px)`
  } }) : null;
}
const Mf = (n, a) => (o) => {
  o.target === a.current && n?.(o);
}, PC = (n) => ({
  userSelectionActive: n.userSelectionActive,
  elementsSelectable: n.elementsSelectable,
  connectionInProgress: n.connection.inProgress,
  dragging: n.paneDragging
});
function t3({ isSelecting: n, selectionKeyPressed: a, selectionMode: o = xo.Full, panOnDrag: s, paneClickDistance: u, selectionOnDrag: f, onSelectionStart: d, onSelectionEnd: h, onPaneClick: p, onPaneContextMenu: g, onPaneScroll: m, onPaneMouseEnter: v, onPaneMouseMove: b, onPaneMouseLeave: S, children: E }) {
  const A = Zt(), { userSelectionActive: _, elementsSelectable: C, dragging: D, connectionInProgress: w } = zt(PC, Gt), z = C && (n || _), q = F.useRef(null), B = F.useRef(), U = F.useRef(/* @__PURE__ */ new Set()), Q = F.useRef(/* @__PURE__ */ new Set()), Z = F.useRef(!1), ot = (Y) => {
    if (Z.current || w) {
      Z.current = !1;
      return;
    }
    p?.(Y), A.getState().resetSelectedElements(), A.setState({ nodesSelectionActive: !1 });
  }, X = (Y) => {
    if (Array.isArray(s) && s?.includes(2)) {
      Y.preventDefault();
      return;
    }
    g?.(Y);
  }, k = m ? (Y) => m(Y) : void 0, it = (Y) => {
    Z.current && (Y.stopPropagation(), Z.current = !1);
  }, O = (Y) => {
    const { domNode: K } = A.getState();
    if (B.current = K?.getBoundingClientRect(), !B.current)
      return;
    const tt = Y.target === q.current;
    if (!tt && !!Y.target.closest(".nokey") || !n || !(f && tt || a) || Y.button !== 0 || !Y.isPrimary)
      return;
    Y.target?.setPointerCapture?.(Y.pointerId), Z.current = !1;
    const { x: P, y: et } = ln(Y.nativeEvent, B.current);
    A.setState({
      userSelectionRect: {
        width: 0,
        height: 0,
        startX: P,
        startY: et,
        x: P,
        y: et
      }
    }), tt || (Y.stopPropagation(), Y.preventDefault());
  }, G = (Y) => {
    const { userSelectionRect: K, transform: tt, nodeLookup: T, edgeLookup: j, connectionLookup: P, triggerNodeChanges: et, triggerEdgeChanges: rt, defaultEdgeOptions: ct, resetSelectedElements: ut } = A.getState();
    if (!B.current || !K)
      return;
    const { x: st, y: ft } = ln(Y.nativeEvent, B.current), { startX: wt, startY: xt } = K;
    if (!Z.current) {
      const Ht = a ? 0 : u;
      if (Math.hypot(st - wt, ft - xt) <= Ht)
        return;
      ut(), d?.(Y);
    }
    Z.current = !0;
    const yt = {
      startX: wt,
      startY: xt,
      x: st < wt ? st : wt,
      y: ft < xt ? ft : xt,
      width: Math.abs(st - wt),
      height: Math.abs(ft - xt)
    }, vt = U.current, Nt = Q.current;
    U.current = new Set(pd(T, yt, tt, o === xo.Partial, !0).map((Ht) => Ht.id)), Q.current = /* @__PURE__ */ new Set();
    const Bt = ct?.selectable ?? !0;
    for (const Ht of U.current) {
      const oe = P.get(Ht);
      if (oe)
        for (const { edgeId: Je } of oe.values()) {
          const ze = j.get(Je);
          ze && (ze.selectable ?? Bt) && Q.current.add(Je);
        }
    }
    if (!t0(vt, U.current)) {
      const Ht = Wa(T, U.current, !0);
      et(Ht);
    }
    if (!t0(Nt, Q.current)) {
      const Ht = Wa(j, Q.current);
      rt(Ht);
    }
    A.setState({
      userSelectionRect: yt,
      userSelectionActive: !0,
      nodesSelectionActive: !1
    });
  }, N = (Y) => {
    Y.button === 0 && (Y.target?.releasePointerCapture?.(Y.pointerId), !_ && Y.target === q.current && A.getState().userSelectionRect && ot?.(Y), A.setState({
      userSelectionActive: !1,
      userSelectionRect: null
    }), Z.current && (h?.(Y), A.setState({
      nodesSelectionActive: U.current.size > 0
    })));
  }, H = s === !0 || Array.isArray(s) && s.includes(0);
  return M.jsxs("div", { className: ie(["react-flow__pane", { draggable: H, dragging: D, selection: n }]), onClick: z ? void 0 : Mf(ot, q), onContextMenu: Mf(X, q), onWheel: Mf(k, q), onPointerEnter: z ? void 0 : v, onPointerMove: z ? G : b, onPointerUp: z ? N : void 0, onPointerDownCapture: z ? O : void 0, onClickCapture: z ? it : void 0, onPointerLeave: S, ref: q, style: Qr, children: [E, M.jsx(WC, {})] });
}
function Pf({ id: n, store: a, unselect: o = !1, nodeRef: s }) {
  const { addSelectedNodes: u, unselectNodesAndEdges: f, multiSelectionActive: d, nodeLookup: h, onError: p } = a.getState(), g = h.get(n);
  if (!g) {
    p?.("012", yn.error012(n));
    return;
  }
  a.setState({ nodesSelectionActive: !1 }), g.selected ? (o || g.selected && d) && (f({ nodes: [g], edges: [] }), requestAnimationFrame(() => s?.current?.blur())) : u([n]);
}
function wv({ nodeRef: n, disabled: a = !1, noDragClassName: o, handleSelector: s, nodeId: u, isSelectable: f, nodeClickDistance: d }) {
  const h = Zt(), [p, g] = F.useState(!1), m = F.useRef();
  return F.useEffect(() => {
    m.current = Y_({
      getStoreItems: () => h.getState(),
      onNodeMouseDown: (v) => {
        Pf({
          id: v,
          store: h,
          nodeRef: n
        });
      },
      onDragStart: () => {
        g(!0);
      },
      onDragStop: () => {
        g(!1);
      }
    });
  }, []), F.useEffect(() => {
    if (!(a || !n.current || !m.current))
      return m.current.update({
        noDragClassName: o,
        handleSelector: s,
        domNode: n.current,
        isSelectable: f,
        nodeId: u,
        nodeClickDistance: d
      }), () => {
        m.current?.destroy();
      };
  }, [o, s, a, f, n, u, d]), p;
}
const e3 = (n) => (a) => a.selected && (a.draggable || n && typeof a.draggable > "u");
function Ev() {
  const n = Zt();
  return F.useCallback((o) => {
    const { nodeExtent: s, snapToGrid: u, snapGrid: f, nodesDraggable: d, onError: h, updateNodePositions: p, nodeLookup: g, nodeOrigin: m } = n.getState(), v = /* @__PURE__ */ new Map(), b = e3(d), S = u ? f[0] : 5, E = u ? f[1] : 5, A = o.direction.x * S * o.factor, _ = o.direction.y * E * o.factor;
    for (const [, C] of g) {
      if (!b(C))
        continue;
      let D = {
        x: C.internals.positionAbsolute.x + A,
        y: C.internals.positionAbsolute.y + _
      };
      u && (D = Oo(D, f));
      const { position: w, positionAbsolute: z } = km({
        nodeId: C.id,
        nextPosition: D,
        nodeLookup: g,
        nodeExtent: s,
        nodeOrigin: m,
        onError: h
      });
      C.position = w, C.internals.positionAbsolute = z, v.set(C.id, C);
    }
    p(v);
  }, []);
}
const _d = F.createContext(null), n3 = _d.Provider;
_d.Consumer;
const _v = () => F.useContext(_d), i3 = (n) => ({
  connectOnClick: n.connectOnClick,
  noPanClassName: n.noPanClassName,
  rfId: n.rfId
}), a3 = (n, a, o) => (s) => {
  const { connectionClickStartHandle: u, connectionMode: f, connection: d } = s, { fromHandle: h, toHandle: p, isValid: g } = d, m = p?.nodeId === n && p?.id === a && p?.type === o;
  return {
    connectingFrom: h?.nodeId === n && h?.id === a && h?.type === o,
    connectingTo: m,
    clickConnecting: u?.nodeId === n && u?.id === a && u?.type === o,
    isPossibleEndHandle: f === il.Strict ? h?.type !== o : n !== h?.nodeId || a !== h?.id,
    connectionInProcess: !!h,
    clickConnectionInProcess: !!u,
    valid: m && g
  };
};
function l3({ type: n = "source", position: a = pt.Top, isValidConnection: o, isConnectable: s = !0, isConnectableStart: u = !0, isConnectableEnd: f = !0, id: d, onConnect: h, children: p, className: g, onMouseDown: m, onTouchStart: v, ...b }, S) {
  const E = d || null, A = n === "target", _ = Zt(), C = _v(), { connectOnClick: D, noPanClassName: w, rfId: z } = zt(i3, Gt), { connectingFrom: q, connectingTo: B, clickConnecting: U, isPossibleEndHandle: Q, connectionInProcess: Z, clickConnectionInProcess: ot, valid: X } = zt(a3(C, E, n), Gt);
  C || _.getState().onError?.("010", yn.error010());
  const k = (G) => {
    const { defaultEdgeOptions: N, onConnect: H, hasDefaultEdges: Y } = _.getState(), K = {
      ...N,
      ...G
    };
    if (Y) {
      const { edges: tt, setEdges: T } = _.getState();
      T(__(K, tt));
    }
    H?.(K), h?.(K);
  }, it = (G) => {
    if (!C)
      return;
    const N = Wm(G.nativeEvent);
    if (u && (N && G.button === 0 || !N)) {
      const H = _.getState();
      If.onPointerDown(G.nativeEvent, {
        handleDomNode: G.currentTarget,
        autoPanOnConnect: H.autoPanOnConnect,
        connectionMode: H.connectionMode,
        connectionRadius: H.connectionRadius,
        domNode: H.domNode,
        nodeLookup: H.nodeLookup,
        lib: H.lib,
        isTarget: A,
        handleId: E,
        nodeId: C,
        flowId: H.rfId,
        panBy: H.panBy,
        cancelConnection: H.cancelConnection,
        onConnectStart: H.onConnectStart,
        onConnectEnd: (...Y) => _.getState().onConnectEnd?.(...Y),
        updateConnection: H.updateConnection,
        onConnect: k,
        isValidConnection: o || ((...Y) => _.getState().isValidConnection?.(...Y) ?? !0),
        getTransform: () => _.getState().transform,
        getFromHandle: () => _.getState().connection.fromHandle,
        autoPanSpeed: H.autoPanSpeed,
        dragThreshold: H.connectionDragThreshold
      });
    }
    N ? m?.(G) : v?.(G);
  }, O = (G) => {
    const { onClickConnectStart: N, onClickConnectEnd: H, connectionClickStartHandle: Y, connectionMode: K, isValidConnection: tt, lib: T, rfId: j, nodeLookup: P, connection: et } = _.getState();
    if (!C || !Y && !u)
      return;
    if (!Y) {
      N?.(G.nativeEvent, { nodeId: C, handleId: E, handleType: n }), _.setState({ connectionClickStartHandle: { nodeId: C, type: n, id: E } });
      return;
    }
    const rt = Fm(G.target), ct = o || tt, { connection: ut, isValid: st } = If.isValid(G.nativeEvent, {
      handle: {
        nodeId: C,
        id: E,
        type: n
      },
      connectionMode: K,
      fromNodeId: Y.nodeId,
      fromHandleId: Y.id || null,
      fromType: Y.type,
      isValidConnection: ct,
      flowId: j,
      doc: rt,
      lib: T,
      nodeLookup: P
    });
    st && ut && k(ut);
    const ft = structuredClone(et);
    delete ft.inProgress, ft.toPosition = ft.toHandle ? ft.toHandle.position : null, H?.(G, ft), _.setState({ connectionClickStartHandle: null });
  };
  return M.jsx("div", { "data-handleid": E, "data-nodeid": C, "data-handlepos": a, "data-id": `${z}-${C}-${E}-${n}`, className: ie([
    "react-flow__handle",
    `react-flow__handle-${a}`,
    "nodrag",
    w,
    g,
    {
      source: !A,
      target: A,
      connectable: s,
      connectablestart: u,
      connectableend: f,
      clickconnecting: U,
      connectingfrom: q,
      connectingto: B,
      valid: X,
      /*
       * shows where you can start a connection from
       * and where you can end it while connecting
       */
      connectionindicator: s && (!Z || Q) && (Z || ot ? f : u)
    }
  ]), onMouseDown: it, onTouchStart: it, onClick: D ? O : void 0, ref: S, ...b, children: p });
}
const Mr = F.memo(xv(l3));
function o3({ data: n, isConnectable: a, sourcePosition: o = pt.Bottom }) {
  return M.jsxs(M.Fragment, { children: [n?.label, M.jsx(Mr, { type: "source", position: o, isConnectable: a })] });
}
function s3({ data: n, isConnectable: a, targetPosition: o = pt.Top, sourcePosition: s = pt.Bottom }) {
  return M.jsxs(M.Fragment, { children: [M.jsx(Mr, { type: "target", position: o, isConnectable: a }), n?.label, M.jsx(Mr, { type: "source", position: s, isConnectable: a })] });
}
function r3() {
  return null;
}
function u3({ data: n, isConnectable: a, targetPosition: o = pt.Top }) {
  return M.jsxs(M.Fragment, { children: [M.jsx(Mr, { type: "target", position: o, isConnectable: a }), n?.label] });
}
const zr = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 }
}, z0 = {
  input: o3,
  default: s3,
  output: u3,
  group: r3
};
function c3(n) {
  return n.internals.handleBounds === void 0 ? {
    width: n.width ?? n.initialWidth ?? n.style?.width,
    height: n.height ?? n.initialHeight ?? n.style?.height
  } : {
    width: n.width ?? n.style?.width,
    height: n.height ?? n.style?.height
  };
}
const f3 = (n) => {
  const { width: a, height: o, x: s, y: u } = zo(n.nodeLookup, {
    filter: (f) => !!f.selected
  });
  return {
    width: an(a) ? a : null,
    height: an(o) ? o : null,
    userSelectionActive: n.userSelectionActive,
    transformString: `translate(${n.transform[0]}px,${n.transform[1]}px) scale(${n.transform[2]}) translate(${s}px,${u}px)`
  };
};
function d3({ onSelectionContextMenu: n, noPanClassName: a, disableKeyboardA11y: o }) {
  const s = Zt(), { width: u, height: f, transformString: d, userSelectionActive: h } = zt(f3, Gt), p = Ev(), g = F.useRef(null);
  F.useEffect(() => {
    o || g.current?.focus({
      preventScroll: !0
    });
  }, [o]);
  const m = !h && u !== null && f !== null;
  if (wv({
    nodeRef: g,
    disabled: !m
  }), !m)
    return null;
  const v = n ? (S) => {
    const E = s.getState().nodes.filter((A) => A.selected);
    n(S, E);
  } : void 0, b = (S) => {
    Object.prototype.hasOwnProperty.call(zr, S.key) && (S.preventDefault(), p({
      direction: zr[S.key],
      factor: S.shiftKey ? 4 : 1
    }));
  };
  return M.jsx("div", { className: ie(["react-flow__nodesselection", "react-flow__container", a]), style: {
    transform: d
  }, children: M.jsx("div", { ref: g, className: "react-flow__nodesselection-rect", onContextMenu: v, tabIndex: o ? void 0 : -1, onKeyDown: o ? void 0 : b, style: {
    width: u,
    height: f
  } }) });
}
const O0 = typeof window < "u" ? window : void 0, h3 = (n) => ({ nodesSelectionActive: n.nodesSelectionActive, userSelectionActive: n.userSelectionActive });
function Cv({ children: n, onPaneClick: a, onPaneMouseEnter: o, onPaneMouseMove: s, onPaneMouseLeave: u, onPaneContextMenu: f, onPaneScroll: d, paneClickDistance: h, deleteKeyCode: p, selectionKeyCode: g, selectionOnDrag: m, selectionMode: v, onSelectionStart: b, onSelectionEnd: S, multiSelectionKeyCode: E, panActivationKeyCode: A, zoomActivationKeyCode: _, elementsSelectable: C, zoomOnScroll: D, zoomOnPinch: w, panOnScroll: z, panOnScrollSpeed: q, panOnScrollMode: B, zoomOnDoubleClick: U, panOnDrag: Q, defaultViewport: Z, translateExtent: ot, minZoom: X, maxZoom: k, preventScrolling: it, onSelectionContextMenu: O, noWheelClassName: G, noPanClassName: N, disableKeyboardA11y: H, onViewportChange: Y, isControlledViewport: K }) {
  const { nodesSelectionActive: tt, userSelectionActive: T } = zt(h3, Gt), j = Eo(g, { target: O0 }), P = Eo(A, { target: O0 }), et = P || Q, rt = P || z, ct = m && et !== !0, ut = j || T || ct;
  return KC({ deleteKeyCode: p, multiSelectionKeyCode: E }), M.jsx(FC, { onPaneContextMenu: f, elementsSelectable: C, zoomOnScroll: D, zoomOnPinch: w, panOnScroll: rt, panOnScrollSpeed: q, panOnScrollMode: B, zoomOnDoubleClick: U, panOnDrag: !j && et, defaultViewport: Z, translateExtent: ot, minZoom: X, maxZoom: k, zoomActivationKeyCode: _, preventScrolling: it, noWheelClassName: G, noPanClassName: N, onViewportChange: Y, isControlledViewport: K, paneClickDistance: h, selectionOnDrag: ct, children: M.jsxs(t3, { onSelectionStart: b, onSelectionEnd: S, onPaneClick: a, onPaneMouseEnter: o, onPaneMouseMove: s, onPaneMouseLeave: u, onPaneContextMenu: f, onPaneScroll: d, panOnDrag: et, isSelecting: !!ut, selectionMode: v, selectionKeyPressed: j, paneClickDistance: h, selectionOnDrag: ct, children: [n, tt && M.jsx(d3, { onSelectionContextMenu: O, noPanClassName: N, disableKeyboardA11y: H })] }) });
}
Cv.displayName = "FlowRenderer";
const g3 = F.memo(Cv), p3 = (n) => (a) => n ? pd(a.nodeLookup, { x: 0, y: 0, width: a.width, height: a.height }, a.transform, !0).map((o) => o.id) : Array.from(a.nodeLookup.keys());
function y3(n) {
  return zt(F.useCallback(p3(n), [n]), Gt);
}
const m3 = (n) => n.updateNodeInternals;
function v3() {
  const n = zt(m3), [a] = F.useState(() => typeof ResizeObserver > "u" ? null : new ResizeObserver((o) => {
    const s = /* @__PURE__ */ new Map();
    o.forEach((u) => {
      const f = u.target.getAttribute("data-id");
      s.set(f, {
        id: f,
        nodeElement: u.target,
        force: !0
      });
    }), n(s);
  }));
  return F.useEffect(() => () => {
    a?.disconnect();
  }, [a]), a;
}
function b3({ node: n, nodeType: a, hasDimensions: o, resizeObserver: s }) {
  const u = Zt(), f = F.useRef(null), d = F.useRef(null), h = F.useRef(n.sourcePosition), p = F.useRef(n.targetPosition), g = F.useRef(a), m = o && !!n.internals.handleBounds;
  return F.useEffect(() => {
    f.current && !n.hidden && (!m || d.current !== f.current) && (d.current && s?.unobserve(d.current), s?.observe(f.current), d.current = f.current);
  }, [m, n.hidden]), F.useEffect(() => () => {
    d.current && (s?.unobserve(d.current), d.current = null);
  }, []), F.useEffect(() => {
    if (f.current) {
      const v = g.current !== a, b = h.current !== n.sourcePosition, S = p.current !== n.targetPosition;
      (v || b || S) && (g.current = a, h.current = n.sourcePosition, p.current = n.targetPosition, u.getState().updateNodeInternals(/* @__PURE__ */ new Map([[n.id, { id: n.id, nodeElement: f.current, force: !0 }]])));
    }
  }, [n.id, a, n.sourcePosition, n.targetPosition]), f;
}
function x3({ id: n, onClick: a, onMouseEnter: o, onMouseMove: s, onMouseLeave: u, onContextMenu: f, onDoubleClick: d, nodesDraggable: h, elementsSelectable: p, nodesConnectable: g, nodesFocusable: m, resizeObserver: v, noDragClassName: b, noPanClassName: S, disableKeyboardA11y: E, rfId: A, nodeTypes: _, nodeClickDistance: C, onError: D }) {
  const { node: w, internals: z, isParent: q } = zt((st) => {
    const ft = st.nodeLookup.get(n), wt = st.parentLookup.has(n);
    return {
      node: ft,
      internals: ft.internals,
      isParent: wt
    };
  }, Gt);
  let B = w.type || "default", U = _?.[B] || z0[B];
  U === void 0 && (D?.("003", yn.error003(B)), B = "default", U = _?.default || z0.default);
  const Q = !!(w.draggable || h && typeof w.draggable > "u"), Z = !!(w.selectable || p && typeof w.selectable > "u"), ot = !!(w.connectable || g && typeof w.connectable > "u"), X = !!(w.focusable || m && typeof w.focusable > "u"), k = Zt(), it = $m(w), O = b3({ node: w, nodeType: B, hasDimensions: it, resizeObserver: v }), G = wv({
    nodeRef: O,
    disabled: w.hidden || !Q,
    noDragClassName: b,
    handleSelector: w.dragHandle,
    nodeId: n,
    isSelectable: Z,
    nodeClickDistance: C
  }), N = Ev();
  if (w.hidden)
    return null;
  const H = Zn(w), Y = c3(w), K = Z || Q || a || o || s || u, tt = o ? (st) => o(st, { ...z.userNode }) : void 0, T = s ? (st) => s(st, { ...z.userNode }) : void 0, j = u ? (st) => u(st, { ...z.userNode }) : void 0, P = f ? (st) => f(st, { ...z.userNode }) : void 0, et = d ? (st) => d(st, { ...z.userNode }) : void 0, rt = (st) => {
    const { selectNodesOnDrag: ft, nodeDragThreshold: wt } = k.getState();
    Z && (!ft || !Q || wt > 0) && Pf({
      id: n,
      store: k,
      nodeRef: O
    }), a && a(st, { ...z.userNode });
  }, ct = (st) => {
    if (!(Im(st.nativeEvent) || E)) {
      if (qm.includes(st.key) && Z) {
        const ft = st.key === "Escape";
        Pf({
          id: n,
          store: k,
          unselect: ft,
          nodeRef: O
        });
      } else if (Q && w.selected && Object.prototype.hasOwnProperty.call(zr, st.key)) {
        st.preventDefault();
        const { ariaLabelConfig: ft } = k.getState();
        k.setState({
          ariaLiveMessage: ft["node.a11yDescription.ariaLiveMessage"]({
            direction: st.key.replace("Arrow", "").toLowerCase(),
            x: ~~z.positionAbsolute.x,
            y: ~~z.positionAbsolute.y
          })
        }), N({
          direction: zr[st.key],
          factor: st.shiftKey ? 4 : 1
        });
      }
    }
  }, ut = () => {
    if (E || !O.current?.matches(":focus-visible"))
      return;
    const { transform: st, width: ft, height: wt, autoPanOnNodeFocus: xt, setCenter: yt } = k.getState();
    if (!xt)
      return;
    pd(/* @__PURE__ */ new Map([[n, w]]), { x: 0, y: 0, width: ft, height: wt }, st, !0).length > 0 || yt(w.position.x + H.width / 2, w.position.y + H.height / 2, {
      zoom: st[2]
    });
  };
  return M.jsx("div", { className: ie([
    "react-flow__node",
    `react-flow__node-${B}`,
    {
      // this is overwritable by passing `nopan` as a class name
      [S]: Q
    },
    w.className,
    {
      selected: w.selected,
      selectable: Z,
      parent: q,
      draggable: Q,
      dragging: G
    }
  ]), ref: O, style: {
    zIndex: z.z,
    transform: `translate(${z.positionAbsolute.x}px,${z.positionAbsolute.y}px)`,
    pointerEvents: K ? "all" : "none",
    visibility: it ? "visible" : "hidden",
    ...w.style,
    ...Y
  }, "data-id": n, "data-testid": `rf__node-${n}`, onMouseEnter: tt, onMouseMove: T, onMouseLeave: j, onContextMenu: P, onClick: rt, onDoubleClick: et, onKeyDown: X ? ct : void 0, tabIndex: X ? 0 : void 0, onFocus: X ? ut : void 0, role: w.ariaRole ?? (X ? "group" : void 0), "aria-roledescription": "node", "aria-describedby": E ? void 0 : `${yv}-${A}`, "aria-label": w.ariaLabel, ...w.domAttributes, children: M.jsx(n3, { value: n, children: M.jsx(U, { id: n, data: w.data, type: B, positionAbsoluteX: z.positionAbsolute.x, positionAbsoluteY: z.positionAbsolute.y, selected: w.selected ?? !1, selectable: Z, draggable: Q, deletable: w.deletable ?? !0, isConnectable: ot, sourcePosition: w.sourcePosition, targetPosition: w.targetPosition, dragging: G, dragHandle: w.dragHandle, zIndex: z.z, parentId: w.parentId, ...H }) }) });
}
var S3 = F.memo(x3);
const w3 = (n) => ({
  nodesDraggable: n.nodesDraggable,
  nodesConnectable: n.nodesConnectable,
  nodesFocusable: n.nodesFocusable,
  elementsSelectable: n.elementsSelectable,
  onError: n.onError
});
function Nv(n) {
  const { nodesDraggable: a, nodesConnectable: o, nodesFocusable: s, elementsSelectable: u, onError: f } = zt(w3, Gt), d = y3(n.onlyRenderVisibleElements), h = v3();
  return M.jsx("div", { className: "react-flow__nodes", style: Qr, children: d.map((p) => (
    /*
     * The split of responsibilities between NodeRenderer and
     * NodeComponentWrapper may appear weird. However, it’s designed to
     * minimize the cost of updates when individual nodes change.
     *
     * For example, when you’re dragging a single node, that node gets
     * updated multiple times per second. If `NodeRenderer` were to update
     * every time, it would have to re-run the `nodes.map()` loop every
     * time. This gets pricey with hundreds of nodes, especially if every
     * loop cycle does more than just rendering a JSX element!
     *
     * As a result of this choice, we took the following implementation
     * decisions:
     * - NodeRenderer subscribes *only* to node IDs – and therefore
     *   rerender *only* when visible nodes are added or removed.
     * - NodeRenderer performs all operations the result of which can be
     *   shared between nodes (such as creating the `ResizeObserver`
     *   instance, or subscribing to `selector`). This means extra prop
     *   drilling into `NodeComponentWrapper`, but it means we need to run
     *   these operations only once – instead of once per node.
     * - Any operations that you’d normally write inside `nodes.map` are
     *   moved into `NodeComponentWrapper`. This ensures they are
     *   memorized – so if `NodeRenderer` *has* to rerender, it only
     *   needs to regenerate the list of nodes, nothing else.
     */
    M.jsx(S3, { id: p, nodeTypes: n.nodeTypes, nodeExtent: n.nodeExtent, onClick: n.onNodeClick, onMouseEnter: n.onNodeMouseEnter, onMouseMove: n.onNodeMouseMove, onMouseLeave: n.onNodeMouseLeave, onContextMenu: n.onNodeContextMenu, onDoubleClick: n.onNodeDoubleClick, noDragClassName: n.noDragClassName, noPanClassName: n.noPanClassName, rfId: n.rfId, disableKeyboardA11y: n.disableKeyboardA11y, resizeObserver: h, nodesDraggable: a, nodesConnectable: o, nodesFocusable: s, elementsSelectable: u, nodeClickDistance: n.nodeClickDistance, onError: f }, p)
  )) });
}
Nv.displayName = "NodeRenderer";
const E3 = F.memo(Nv);
function _3(n) {
  return zt(F.useCallback((o) => {
    if (!n)
      return o.edges.map((u) => u.id);
    const s = [];
    if (o.width && o.height)
      for (const u of o.edges) {
        const f = o.nodeLookup.get(u.source), d = o.nodeLookup.get(u.target);
        f && d && S_({
          sourceNode: f,
          targetNode: d,
          width: o.width,
          height: o.height,
          transform: o.transform
        }) && s.push(u.id);
      }
    return s;
  }, [n]), Gt);
}
const C3 = ({ color: n = "none", strokeWidth: a = 1 }) => {
  const o = {
    strokeWidth: a,
    ...n && { stroke: n }
  };
  return M.jsx("polyline", { className: "arrow", style: o, strokeLinecap: "round", fill: "none", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4" });
}, N3 = ({ color: n = "none", strokeWidth: a = 1 }) => {
  const o = {
    strokeWidth: a,
    ...n && { stroke: n, fill: n }
  };
  return M.jsx("polyline", { className: "arrowclosed", style: o, strokeLinecap: "round", strokeLinejoin: "round", points: "-5,-4 0,0 -5,4 -5,-4" });
}, D0 = {
  [Nr.Arrow]: C3,
  [Nr.ArrowClosed]: N3
};
function T3(n) {
  const a = Zt();
  return F.useMemo(() => Object.prototype.hasOwnProperty.call(D0, n) ? D0[n] : (a.getState().onError?.("009", yn.error009(n)), null), [n]);
}
const A3 = ({ id: n, type: a, color: o, width: s = 12.5, height: u = 12.5, markerUnits: f = "strokeWidth", strokeWidth: d, orient: h = "auto-start-reverse" }) => {
  const p = T3(a);
  return p ? M.jsx("marker", { className: "react-flow__arrowhead", id: n, markerWidth: `${s}`, markerHeight: `${u}`, viewBox: "-10 -10 20 20", markerUnits: f, orient: h, refX: "0", refY: "0", children: M.jsx(p, { color: o, strokeWidth: d }) }) : null;
}, Tv = ({ defaultColor: n, rfId: a }) => {
  const o = zt((f) => f.edges), s = zt((f) => f.defaultEdgeOptions), u = F.useMemo(() => M_(o, {
    id: a,
    defaultColor: n,
    defaultMarkerStart: s?.markerStart,
    defaultMarkerEnd: s?.markerEnd
  }), [o, s, a, n]);
  return u.length ? M.jsx("svg", { className: "react-flow__marker", "aria-hidden": "true", children: M.jsx("defs", { children: u.map((f) => M.jsx(A3, { id: f.id, type: f.type, color: f.color, width: f.width, height: f.height, markerUnits: f.markerUnits, strokeWidth: f.strokeWidth, orient: f.orient }, f.id)) }) }) : null;
};
Tv.displayName = "MarkerDefinitions";
var M3 = F.memo(Tv);
function Av({ x: n, y: a, label: o, labelStyle: s, labelShowBg: u = !0, labelBgStyle: f, labelBgPadding: d = [2, 4], labelBgBorderRadius: h = 2, children: p, className: g, ...m }) {
  const [v, b] = F.useState({ x: 1, y: 0, width: 0, height: 0 }), S = ie(["react-flow__edge-textwrapper", g]), E = F.useRef(null);
  return F.useEffect(() => {
    if (E.current) {
      const A = E.current.getBBox();
      b({
        x: A.x,
        y: A.y,
        width: A.width,
        height: A.height
      });
    }
  }, [o]), o ? M.jsxs("g", { transform: `translate(${n - v.width / 2} ${a - v.height / 2})`, className: S, visibility: v.width ? "visible" : "hidden", ...m, children: [u && M.jsx("rect", { width: v.width + 2 * d[0], x: -d[0], y: -d[1], height: v.height + 2 * d[1], className: "react-flow__edge-textbg", style: f, rx: h, ry: h }), M.jsx("text", { className: "react-flow__edge-text", y: v.height / 2, dy: "0.3em", ref: E, style: s, children: o }), p] }) : null;
}
Av.displayName = "EdgeText";
const z3 = F.memo(Av);
function Xr({ path: n, labelX: a, labelY: o, label: s, labelStyle: u, labelShowBg: f, labelBgStyle: d, labelBgPadding: h, labelBgBorderRadius: p, interactionWidth: g = 20, ...m }) {
  return M.jsxs(M.Fragment, { children: [M.jsx("path", { ...m, d: n, fill: "none", className: ie(["react-flow__edge-path", m.className]) }), g ? M.jsx("path", { d: n, fill: "none", strokeOpacity: 0, strokeWidth: g, className: "react-flow__edge-interaction" }) : null, s && an(a) && an(o) ? M.jsx(z3, { x: a, y: o, label: s, labelStyle: u, labelShowBg: f, labelBgStyle: d, labelBgPadding: h, labelBgBorderRadius: p }) : null] });
}
function R0({ pos: n, x1: a, y1: o, x2: s, y2: u }) {
  return n === pt.Left || n === pt.Right ? [0.5 * (a + s), o] : [a, 0.5 * (o + u)];
}
function Mv({ sourceX: n, sourceY: a, sourcePosition: o = pt.Bottom, targetX: s, targetY: u, targetPosition: f = pt.Top }) {
  const [d, h] = R0({
    pos: o,
    x1: n,
    y1: a,
    x2: s,
    y2: u
  }), [p, g] = R0({
    pos: f,
    x1: s,
    y1: u,
    x2: n,
    y2: a
  }), [m, v, b, S] = Pm({
    sourceX: n,
    sourceY: a,
    targetX: s,
    targetY: u,
    sourceControlX: d,
    sourceControlY: h,
    targetControlX: p,
    targetControlY: g
  });
  return [
    `M${n},${a} C${d},${h} ${p},${g} ${s},${u}`,
    m,
    v,
    b,
    S
  ];
}
function zv(n) {
  return F.memo(({ id: a, sourceX: o, sourceY: s, targetX: u, targetY: f, sourcePosition: d, targetPosition: h, label: p, labelStyle: g, labelShowBg: m, labelBgStyle: v, labelBgPadding: b, labelBgBorderRadius: S, style: E, markerEnd: A, markerStart: _, interactionWidth: C }) => {
    const [D, w, z] = Mv({
      sourceX: o,
      sourceY: s,
      sourcePosition: d,
      targetX: u,
      targetY: f,
      targetPosition: h
    }), q = n.isInternal ? void 0 : a;
    return M.jsx(Xr, { id: q, path: D, labelX: w, labelY: z, label: p, labelStyle: g, labelShowBg: m, labelBgStyle: v, labelBgPadding: b, labelBgBorderRadius: S, style: E, markerEnd: A, markerStart: _, interactionWidth: C });
  });
}
const O3 = zv({ isInternal: !1 }), Ov = zv({ isInternal: !0 });
O3.displayName = "SimpleBezierEdge";
Ov.displayName = "SimpleBezierEdgeInternal";
function Dv(n) {
  return F.memo(({ id: a, sourceX: o, sourceY: s, targetX: u, targetY: f, label: d, labelStyle: h, labelShowBg: p, labelBgStyle: g, labelBgPadding: m, labelBgBorderRadius: v, style: b, sourcePosition: S = pt.Bottom, targetPosition: E = pt.Top, markerEnd: A, markerStart: _, pathOptions: C, interactionWidth: D }) => {
    const [w, z, q] = $f({
      sourceX: o,
      sourceY: s,
      sourcePosition: S,
      targetX: u,
      targetY: f,
      targetPosition: E,
      borderRadius: C?.borderRadius,
      offset: C?.offset,
      stepPosition: C?.stepPosition
    }), B = n.isInternal ? void 0 : a;
    return M.jsx(Xr, { id: B, path: w, labelX: z, labelY: q, label: d, labelStyle: h, labelShowBg: p, labelBgStyle: g, labelBgPadding: m, labelBgBorderRadius: v, style: b, markerEnd: A, markerStart: _, interactionWidth: D });
  });
}
const Rv = Dv({ isInternal: !1 }), Hv = Dv({ isInternal: !0 });
Rv.displayName = "SmoothStepEdge";
Hv.displayName = "SmoothStepEdgeInternal";
function jv(n) {
  return F.memo(({ id: a, ...o }) => {
    const s = n.isInternal ? void 0 : a;
    return M.jsx(Rv, { ...o, id: s, pathOptions: F.useMemo(() => ({ borderRadius: 0, offset: o.pathOptions?.offset }), [o.pathOptions?.offset]) });
  });
}
const D3 = jv({ isInternal: !1 }), Uv = jv({ isInternal: !0 });
D3.displayName = "StepEdge";
Uv.displayName = "StepEdgeInternal";
function Bv(n) {
  return F.memo(({ id: a, sourceX: o, sourceY: s, targetX: u, targetY: f, label: d, labelStyle: h, labelShowBg: p, labelBgStyle: g, labelBgPadding: m, labelBgBorderRadius: v, style: b, markerEnd: S, markerStart: E, interactionWidth: A }) => {
    const [_, C, D] = nv({ sourceX: o, sourceY: s, targetX: u, targetY: f }), w = n.isInternal ? void 0 : a;
    return M.jsx(Xr, { id: w, path: _, labelX: C, labelY: D, label: d, labelStyle: h, labelShowBg: p, labelBgStyle: g, labelBgPadding: m, labelBgBorderRadius: v, style: b, markerEnd: S, markerStart: E, interactionWidth: A });
  });
}
const R3 = Bv({ isInternal: !1 }), Lv = Bv({ isInternal: !0 });
R3.displayName = "StraightEdge";
Lv.displayName = "StraightEdgeInternal";
function qv(n) {
  return F.memo(({ id: a, sourceX: o, sourceY: s, targetX: u, targetY: f, sourcePosition: d = pt.Bottom, targetPosition: h = pt.Top, label: p, labelStyle: g, labelShowBg: m, labelBgStyle: v, labelBgPadding: b, labelBgBorderRadius: S, style: E, markerEnd: A, markerStart: _, pathOptions: C, interactionWidth: D }) => {
    const [w, z, q] = tv({
      sourceX: o,
      sourceY: s,
      sourcePosition: d,
      targetX: u,
      targetY: f,
      targetPosition: h,
      curvature: C?.curvature
    }), B = n.isInternal ? void 0 : a;
    return M.jsx(Xr, { id: B, path: w, labelX: z, labelY: q, label: p, labelStyle: g, labelShowBg: m, labelBgStyle: v, labelBgPadding: b, labelBgBorderRadius: S, style: E, markerEnd: A, markerStart: _, interactionWidth: D });
  });
}
const H3 = qv({ isInternal: !1 }), Yv = qv({ isInternal: !0 });
H3.displayName = "BezierEdge";
Yv.displayName = "BezierEdgeInternal";
const H0 = {
  default: Yv,
  straight: Lv,
  step: Uv,
  smoothstep: Hv,
  simplebezier: Ov
}, j0 = {
  sourceX: null,
  sourceY: null,
  targetX: null,
  targetY: null,
  sourcePosition: null,
  targetPosition: null
}, j3 = (n, a, o) => o === pt.Left ? n - a : o === pt.Right ? n + a : n, U3 = (n, a, o) => o === pt.Top ? n - a : o === pt.Bottom ? n + a : n, U0 = "react-flow__edgeupdater";
function B0({ position: n, centerX: a, centerY: o, radius: s = 10, onMouseDown: u, onMouseEnter: f, onMouseOut: d, type: h }) {
  return M.jsx("circle", { onMouseDown: u, onMouseEnter: f, onMouseOut: d, className: ie([U0, `${U0}-${h}`]), cx: j3(a, s, n), cy: U3(o, s, n), r: s, stroke: "transparent", fill: "transparent" });
}
function B3({ isReconnectable: n, reconnectRadius: a, edge: o, sourceX: s, sourceY: u, targetX: f, targetY: d, sourcePosition: h, targetPosition: p, onReconnect: g, onReconnectStart: m, onReconnectEnd: v, setReconnecting: b, setUpdateHover: S }) {
  const E = Zt(), A = (z, q) => {
    if (z.button !== 0)
      return;
    const { autoPanOnConnect: B, domNode: U, connectionMode: Q, connectionRadius: Z, lib: ot, onConnectStart: X, cancelConnection: k, nodeLookup: it, rfId: O, panBy: G, updateConnection: N } = E.getState(), H = q.type === "target", Y = (T, j) => {
      b(!1), v?.(T, o, q.type, j);
    }, K = (T) => g?.(o, T), tt = (T, j) => {
      b(!0), m?.(z, o, q.type), X?.(T, j);
    };
    If.onPointerDown(z.nativeEvent, {
      autoPanOnConnect: B,
      connectionMode: Q,
      connectionRadius: Z,
      domNode: U,
      handleId: q.id,
      nodeId: q.nodeId,
      nodeLookup: it,
      isTarget: H,
      edgeUpdaterType: q.type,
      lib: ot,
      flowId: O,
      cancelConnection: k,
      panBy: G,
      isValidConnection: (...T) => E.getState().isValidConnection?.(...T) ?? !0,
      onConnect: K,
      onConnectStart: tt,
      onConnectEnd: (...T) => E.getState().onConnectEnd?.(...T),
      onReconnectEnd: Y,
      updateConnection: N,
      getTransform: () => E.getState().transform,
      getFromHandle: () => E.getState().connection.fromHandle,
      dragThreshold: E.getState().connectionDragThreshold,
      handleDomNode: z.currentTarget
    });
  }, _ = (z) => A(z, { nodeId: o.target, id: o.targetHandle ?? null, type: "target" }), C = (z) => A(z, { nodeId: o.source, id: o.sourceHandle ?? null, type: "source" }), D = () => S(!0), w = () => S(!1);
  return M.jsxs(M.Fragment, { children: [(n === !0 || n === "source") && M.jsx(B0, { position: h, centerX: s, centerY: u, radius: a, onMouseDown: _, onMouseEnter: D, onMouseOut: w, type: "source" }), (n === !0 || n === "target") && M.jsx(B0, { position: p, centerX: f, centerY: d, radius: a, onMouseDown: C, onMouseEnter: D, onMouseOut: w, type: "target" })] });
}
function L3({ id: n, edgesFocusable: a, edgesReconnectable: o, elementsSelectable: s, onClick: u, onDoubleClick: f, onContextMenu: d, onMouseEnter: h, onMouseMove: p, onMouseLeave: g, reconnectRadius: m, onReconnect: v, onReconnectStart: b, onReconnectEnd: S, rfId: E, edgeTypes: A, noPanClassName: _, onError: C, disableKeyboardA11y: D }) {
  let w = zt((yt) => yt.edgeLookup.get(n));
  const z = zt((yt) => yt.defaultEdgeOptions);
  w = z ? { ...z, ...w } : w;
  let q = w.type || "default", B = A?.[q] || H0[q];
  B === void 0 && (C?.("011", yn.error011(q)), q = "default", B = A?.default || H0.default);
  const U = !!(w.focusable || a && typeof w.focusable > "u"), Q = typeof v < "u" && (w.reconnectable || o && typeof w.reconnectable > "u"), Z = !!(w.selectable || s && typeof w.selectable > "u"), ot = F.useRef(null), [X, k] = F.useState(!1), [it, O] = F.useState(!1), G = Zt(), { zIndex: N, sourceX: H, sourceY: Y, targetX: K, targetY: tt, sourcePosition: T, targetPosition: j } = zt(F.useCallback((yt) => {
    const vt = yt.nodeLookup.get(w.source), Nt = yt.nodeLookup.get(w.target);
    if (!vt || !Nt)
      return {
        zIndex: w.zIndex,
        ...j0
      };
    const Bt = A_({
      id: n,
      sourceNode: vt,
      targetNode: Nt,
      sourceHandle: w.sourceHandle || null,
      targetHandle: w.targetHandle || null,
      connectionMode: yt.connectionMode,
      onError: C
    });
    return {
      zIndex: x_({
        selected: w.selected,
        zIndex: w.zIndex,
        sourceNode: vt,
        targetNode: Nt,
        elevateOnSelect: yt.elevateEdgesOnSelect,
        zIndexMode: yt.zIndexMode
      }),
      ...Bt || j0
    };
  }, [w.source, w.target, w.sourceHandle, w.targetHandle, w.selected, w.zIndex]), Gt), P = F.useMemo(() => w.markerStart ? `url('#${Jf(w.markerStart, E)}')` : void 0, [w.markerStart, E]), et = F.useMemo(() => w.markerEnd ? `url('#${Jf(w.markerEnd, E)}')` : void 0, [w.markerEnd, E]);
  if (w.hidden || H === null || Y === null || K === null || tt === null)
    return null;
  const rt = (yt) => {
    const { addSelectedEdges: vt, unselectNodesAndEdges: Nt, multiSelectionActive: Bt } = G.getState();
    Z && (G.setState({ nodesSelectionActive: !1 }), w.selected && Bt ? (Nt({ nodes: [], edges: [w] }), ot.current?.blur()) : vt([n])), u && u(yt, w);
  }, ct = f ? (yt) => {
    f(yt, { ...w });
  } : void 0, ut = d ? (yt) => {
    d(yt, { ...w });
  } : void 0, st = h ? (yt) => {
    h(yt, { ...w });
  } : void 0, ft = p ? (yt) => {
    p(yt, { ...w });
  } : void 0, wt = g ? (yt) => {
    g(yt, { ...w });
  } : void 0, xt = (yt) => {
    if (!D && qm.includes(yt.key) && Z) {
      const { unselectNodesAndEdges: vt, addSelectedEdges: Nt } = G.getState();
      yt.key === "Escape" ? (ot.current?.blur(), vt({ edges: [w] })) : Nt([n]);
    }
  };
  return M.jsx("svg", { style: { zIndex: N }, children: M.jsxs("g", { className: ie([
    "react-flow__edge",
    `react-flow__edge-${q}`,
    w.className,
    _,
    {
      selected: w.selected,
      animated: w.animated,
      inactive: !Z && !u,
      updating: X,
      selectable: Z
    }
  ]), onClick: rt, onDoubleClick: ct, onContextMenu: ut, onMouseEnter: st, onMouseMove: ft, onMouseLeave: wt, onKeyDown: U ? xt : void 0, tabIndex: U ? 0 : void 0, role: w.ariaRole ?? (U ? "group" : "img"), "aria-roledescription": "edge", "data-id": n, "data-testid": `rf__edge-${n}`, "aria-label": w.ariaLabel === null ? void 0 : w.ariaLabel || `Edge from ${w.source} to ${w.target}`, "aria-describedby": U ? `${mv}-${E}` : void 0, ref: ot, ...w.domAttributes, children: [!it && M.jsx(B, { id: n, source: w.source, target: w.target, type: w.type, selected: w.selected, animated: w.animated, selectable: Z, deletable: w.deletable ?? !0, label: w.label, labelStyle: w.labelStyle, labelShowBg: w.labelShowBg, labelBgStyle: w.labelBgStyle, labelBgPadding: w.labelBgPadding, labelBgBorderRadius: w.labelBgBorderRadius, sourceX: H, sourceY: Y, targetX: K, targetY: tt, sourcePosition: T, targetPosition: j, data: w.data, style: w.style, sourceHandleId: w.sourceHandle, targetHandleId: w.targetHandle, markerStart: P, markerEnd: et, pathOptions: "pathOptions" in w ? w.pathOptions : void 0, interactionWidth: w.interactionWidth }), Q && M.jsx(B3, { edge: w, isReconnectable: Q, reconnectRadius: m, onReconnect: v, onReconnectStart: b, onReconnectEnd: S, sourceX: H, sourceY: Y, targetX: K, targetY: tt, sourcePosition: T, targetPosition: j, setUpdateHover: k, setReconnecting: O })] }) });
}
var q3 = F.memo(L3);
const Y3 = (n) => ({
  edgesFocusable: n.edgesFocusable,
  edgesReconnectable: n.edgesReconnectable,
  elementsSelectable: n.elementsSelectable,
  connectionMode: n.connectionMode,
  onError: n.onError
});
function Vv({ defaultMarkerColor: n, onlyRenderVisibleElements: a, rfId: o, edgeTypes: s, noPanClassName: u, onReconnect: f, onEdgeContextMenu: d, onEdgeMouseEnter: h, onEdgeMouseMove: p, onEdgeMouseLeave: g, onEdgeClick: m, reconnectRadius: v, onEdgeDoubleClick: b, onReconnectStart: S, onReconnectEnd: E, disableKeyboardA11y: A }) {
  const { edgesFocusable: _, edgesReconnectable: C, elementsSelectable: D, onError: w } = zt(Y3, Gt), z = _3(a);
  return M.jsxs("div", { className: "react-flow__edges", children: [M.jsx(M3, { defaultColor: n, rfId: o }), z.map((q) => M.jsx(q3, { id: q, edgesFocusable: _, edgesReconnectable: C, elementsSelectable: D, noPanClassName: u, onReconnect: f, onContextMenu: d, onMouseEnter: h, onMouseMove: p, onMouseLeave: g, onClick: m, reconnectRadius: v, onDoubleClick: b, onReconnectStart: S, onReconnectEnd: E, rfId: o, onError: w, edgeTypes: s, disableKeyboardA11y: A }, q))] });
}
Vv.displayName = "EdgeRenderer";
const V3 = F.memo(Vv), Q3 = (n) => `translate(${n.transform[0]}px,${n.transform[1]}px) scale(${n.transform[2]})`;
function X3({ children: n }) {
  const a = zt(Q3);
  return M.jsx("div", { className: "react-flow__viewport xyflow__viewport react-flow__container", style: { transform: a }, children: n });
}
function k3(n) {
  const a = Ed(), o = F.useRef(!1);
  F.useEffect(() => {
    !o.current && a.viewportInitialized && n && (setTimeout(() => n(a), 1), o.current = !0);
  }, [n, a.viewportInitialized]);
}
const G3 = (n) => n.panZoom?.syncViewport;
function Z3(n) {
  const a = zt(G3), o = Zt();
  return F.useEffect(() => {
    n && (a?.(n), o.setState({ transform: [n.x, n.y, n.zoom] }));
  }, [n, a]), null;
}
function K3(n) {
  return n.connection.inProgress ? { ...n.connection, to: Do(n.connection.to, n.transform) } : { ...n.connection };
}
function $3(n) {
  return K3;
}
function J3(n) {
  const a = $3();
  return zt(a, Gt);
}
const F3 = (n) => ({
  nodesConnectable: n.nodesConnectable,
  isValid: n.connection.isValid,
  inProgress: n.connection.inProgress,
  width: n.width,
  height: n.height
});
function I3({ containerStyle: n, style: a, type: o, component: s }) {
  const { nodesConnectable: u, width: f, height: d, isValid: h, inProgress: p } = zt(F3, Gt);
  return !(f && u && p) ? null : M.jsx("svg", { style: n, width: f, height: d, className: "react-flow__connectionline react-flow__container", children: M.jsx("g", { className: ie(["react-flow__connection", Qm(h)]), children: M.jsx(Qv, { style: a, type: o, CustomComponent: s, isValid: h }) }) });
}
const Qv = ({ style: n, type: a = _i.Bezier, CustomComponent: o, isValid: s }) => {
  const { inProgress: u, from: f, fromNode: d, fromHandle: h, fromPosition: p, to: g, toNode: m, toHandle: v, toPosition: b, pointer: S } = J3();
  if (!u)
    return;
  if (o)
    return M.jsx(o, { connectionLineType: a, connectionLineStyle: n, fromNode: d, fromHandle: h, fromX: f.x, fromY: f.y, toX: g.x, toY: g.y, fromPosition: p, toPosition: b, connectionStatus: Qm(s), toNode: m, toHandle: v, pointer: S });
  let E = "";
  const A = {
    sourceX: f.x,
    sourceY: f.y,
    sourcePosition: p,
    targetX: g.x,
    targetY: g.y,
    targetPosition: b
  };
  switch (a) {
    case _i.Bezier:
      [E] = tv(A);
      break;
    case _i.SimpleBezier:
      [E] = Mv(A);
      break;
    case _i.Step:
      [E] = $f({
        ...A,
        borderRadius: 0
      });
      break;
    case _i.SmoothStep:
      [E] = $f(A);
      break;
    default:
      [E] = nv(A);
  }
  return M.jsx("path", { d: E, fill: "none", className: "react-flow__connection-path", style: n });
};
Qv.displayName = "ConnectionLine";
const W3 = {};
function L0(n = W3) {
  F.useRef(n), Zt(), F.useEffect(() => {
  }, [n]);
}
function P3() {
  Zt(), F.useRef(!1), F.useEffect(() => {
  }, []);
}
function Xv({ nodeTypes: n, edgeTypes: a, onInit: o, onNodeClick: s, onEdgeClick: u, onNodeDoubleClick: f, onEdgeDoubleClick: d, onNodeMouseEnter: h, onNodeMouseMove: p, onNodeMouseLeave: g, onNodeContextMenu: m, onSelectionContextMenu: v, onSelectionStart: b, onSelectionEnd: S, connectionLineType: E, connectionLineStyle: A, connectionLineComponent: _, connectionLineContainerStyle: C, selectionKeyCode: D, selectionOnDrag: w, selectionMode: z, multiSelectionKeyCode: q, panActivationKeyCode: B, zoomActivationKeyCode: U, deleteKeyCode: Q, onlyRenderVisibleElements: Z, elementsSelectable: ot, defaultViewport: X, translateExtent: k, minZoom: it, maxZoom: O, preventScrolling: G, defaultMarkerColor: N, zoomOnScroll: H, zoomOnPinch: Y, panOnScroll: K, panOnScrollSpeed: tt, panOnScrollMode: T, zoomOnDoubleClick: j, panOnDrag: P, onPaneClick: et, onPaneMouseEnter: rt, onPaneMouseMove: ct, onPaneMouseLeave: ut, onPaneScroll: st, onPaneContextMenu: ft, paneClickDistance: wt, nodeClickDistance: xt, onEdgeContextMenu: yt, onEdgeMouseEnter: vt, onEdgeMouseMove: Nt, onEdgeMouseLeave: Bt, reconnectRadius: Ht, onReconnect: oe, onReconnectStart: Je, onReconnectEnd: ze, noDragClassName: Fe, noWheelClassName: vn, noPanClassName: Ti, disableKeyboardA11y: Ai, nodeExtent: re, rfId: sa, viewport: bn, onViewportChange: Kn }) {
  return L0(n), L0(a), P3(), k3(o), Z3(bn), M.jsx(g3, { onPaneClick: et, onPaneMouseEnter: rt, onPaneMouseMove: ct, onPaneMouseLeave: ut, onPaneContextMenu: ft, onPaneScroll: st, paneClickDistance: wt, deleteKeyCode: Q, selectionKeyCode: D, selectionOnDrag: w, selectionMode: z, onSelectionStart: b, onSelectionEnd: S, multiSelectionKeyCode: q, panActivationKeyCode: B, zoomActivationKeyCode: U, elementsSelectable: ot, zoomOnScroll: H, zoomOnPinch: Y, zoomOnDoubleClick: j, panOnScroll: K, panOnScrollSpeed: tt, panOnScrollMode: T, panOnDrag: P, defaultViewport: X, translateExtent: k, minZoom: it, maxZoom: O, onSelectionContextMenu: v, preventScrolling: G, noDragClassName: Fe, noWheelClassName: vn, noPanClassName: Ti, disableKeyboardA11y: Ai, onViewportChange: Kn, isControlledViewport: !!bn, children: M.jsxs(X3, { children: [M.jsx(V3, { edgeTypes: a, onEdgeClick: u, onEdgeDoubleClick: d, onReconnect: oe, onReconnectStart: Je, onReconnectEnd: ze, onlyRenderVisibleElements: Z, onEdgeContextMenu: yt, onEdgeMouseEnter: vt, onEdgeMouseMove: Nt, onEdgeMouseLeave: Bt, reconnectRadius: Ht, defaultMarkerColor: N, noPanClassName: Ti, disableKeyboardA11y: Ai, rfId: sa }), M.jsx(I3, { style: A, type: E, component: _, containerStyle: C }), M.jsx("div", { className: "react-flow__edgelabel-renderer" }), M.jsx(E3, { nodeTypes: n, onNodeClick: s, onNodeDoubleClick: f, onNodeMouseEnter: h, onNodeMouseMove: p, onNodeMouseLeave: g, onNodeContextMenu: m, nodeClickDistance: xt, onlyRenderVisibleElements: Z, noPanClassName: Ti, noDragClassName: Fe, disableKeyboardA11y: Ai, nodeExtent: re, rfId: sa }), M.jsx("div", { className: "react-flow__viewport-portal" })] }) });
}
Xv.displayName = "GraphView";
const tN = F.memo(Xv), q0 = ({ nodes: n, edges: a, defaultNodes: o, defaultEdges: s, width: u, height: f, fitView: d, fitViewOptions: h, minZoom: p = 0.5, maxZoom: g = 2, nodeOrigin: m, nodeExtent: v, zIndexMode: b = "basic" } = {}) => {
  const S = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Map(), A = /* @__PURE__ */ new Map(), _ = /* @__PURE__ */ new Map(), C = s ?? a ?? [], D = o ?? n ?? [], w = m ?? [0, 0], z = v ?? bo;
  lv(A, _, C);
  const { nodesInitialized: q } = Ff(D, S, E, {
    nodeOrigin: w,
    nodeExtent: z,
    zIndexMode: b
  });
  let B = [0, 0, 1];
  if (d && u && f) {
    const U = zo(S, {
      filter: (X) => !!((X.width || X.initialWidth) && (X.height || X.initialHeight))
    }), { x: Q, y: Z, zoom: ot } = yd(U, u, f, p, g, h?.padding ?? 0.1);
    B = [Q, Z, ot];
  }
  return {
    rfId: "1",
    width: u ?? 0,
    height: f ?? 0,
    transform: B,
    nodes: D,
    nodesInitialized: q,
    nodeLookup: S,
    parentLookup: E,
    edges: C,
    edgeLookup: _,
    connectionLookup: A,
    onNodesChange: null,
    onEdgesChange: null,
    hasDefaultNodes: o !== void 0,
    hasDefaultEdges: s !== void 0,
    panZoom: null,
    minZoom: p,
    maxZoom: g,
    translateExtent: bo,
    nodeExtent: z,
    nodesSelectionActive: !1,
    userSelectionActive: !1,
    userSelectionRect: null,
    connectionMode: il.Strict,
    domNode: null,
    paneDragging: !1,
    noPanClassName: "nopan",
    nodeOrigin: w,
    nodeDragThreshold: 1,
    connectionDragThreshold: 1,
    snapGrid: [15, 15],
    snapToGrid: !1,
    nodesDraggable: !0,
    nodesConnectable: !0,
    nodesFocusable: !0,
    edgesFocusable: !0,
    edgesReconnectable: !0,
    elementsSelectable: !0,
    elevateNodesOnSelect: !0,
    elevateEdgesOnSelect: !0,
    selectNodesOnDrag: !0,
    multiSelectionActive: !1,
    fitViewQueued: d ?? !1,
    fitViewOptions: h,
    fitViewResolver: null,
    connection: { ...Vm },
    connectionClickStartHandle: null,
    connectOnClick: !0,
    ariaLiveMessage: "",
    autoPanOnConnect: !0,
    autoPanOnNodeDrag: !0,
    autoPanOnNodeFocus: !0,
    autoPanSpeed: 15,
    connectionRadius: 20,
    onError: g_,
    isValidConnection: void 0,
    onSelectionChangeHandlers: [],
    lib: "react",
    debug: !1,
    ariaLabelConfig: Ym,
    zIndexMode: b,
    onNodesChangeMiddlewareMap: /* @__PURE__ */ new Map(),
    onEdgesChangeMiddlewareMap: /* @__PURE__ */ new Map()
  };
}, eN = ({ nodes: n, edges: a, defaultNodes: o, defaultEdges: s, width: u, height: f, fitView: d, fitViewOptions: h, minZoom: p, maxZoom: g, nodeOrigin: m, nodeExtent: v, zIndexMode: b }) => vC((S, E) => {
  async function A() {
    const { nodeLookup: _, panZoom: C, fitViewOptions: D, fitViewResolver: w, width: z, height: q, minZoom: B, maxZoom: U } = E();
    C && (await d_({
      nodes: _,
      width: z,
      height: q,
      panZoom: C,
      minZoom: B,
      maxZoom: U
    }, D), w?.resolve(!0), S({ fitViewResolver: null }));
  }
  return {
    ...q0({
      nodes: n,
      edges: a,
      width: u,
      height: f,
      fitView: d,
      fitViewOptions: h,
      minZoom: p,
      maxZoom: g,
      nodeOrigin: m,
      nodeExtent: v,
      defaultNodes: o,
      defaultEdges: s,
      zIndexMode: b
    }),
    setNodes: (_) => {
      const { nodeLookup: C, parentLookup: D, nodeOrigin: w, elevateNodesOnSelect: z, fitViewQueued: q, zIndexMode: B, nodesSelectionActive: U } = E(), { nodesInitialized: Q, hasSelectedNodes: Z } = Ff(_, C, D, {
        nodeOrigin: w,
        nodeExtent: v,
        elevateNodesOnSelect: z,
        checkEquality: !0,
        zIndexMode: B
      }), ot = U && Z;
      q && Q ? (A(), S({
        nodes: _,
        nodesInitialized: Q,
        fitViewQueued: !1,
        fitViewOptions: void 0,
        nodesSelectionActive: ot
      })) : S({ nodes: _, nodesInitialized: Q, nodesSelectionActive: ot });
    },
    setEdges: (_) => {
      const { connectionLookup: C, edgeLookup: D } = E();
      lv(C, D, _), S({ edges: _ });
    },
    setDefaultNodesAndEdges: (_, C) => {
      if (_) {
        const { setNodes: D } = E();
        D(_), S({ hasDefaultNodes: !0 });
      }
      if (C) {
        const { setEdges: D } = E();
        D(C), S({ hasDefaultEdges: !0 });
      }
    },
    /*
     * Every node gets registered at a ResizeObserver. Whenever a node
     * changes its dimensions, this function is called to measure the
     * new dimensions and update the nodes.
     */
    updateNodeInternals: (_) => {
      const { triggerNodeChanges: C, nodeLookup: D, parentLookup: w, domNode: z, nodeOrigin: q, nodeExtent: B, debug: U, fitViewQueued: Q, zIndexMode: Z } = E(), { changes: ot, updatedInternals: X } = U_(_, D, w, z, q, B, Z);
      X && (D_(D, w, { nodeOrigin: q, nodeExtent: B, zIndexMode: Z }), Q ? (A(), S({ fitViewQueued: !1, fitViewOptions: void 0 })) : S({}), ot?.length > 0 && (U && console.log("React Flow: trigger node changes", ot), C?.(ot)));
    },
    updateNodePositions: (_, C = !1) => {
      const D = [];
      let w = [];
      const { nodeLookup: z, triggerNodeChanges: q, connection: B, updateConnection: U, onNodesChangeMiddlewareMap: Q } = E();
      for (const [Z, ot] of _) {
        const X = z.get(Z), k = !!(X?.expandParent && X?.parentId && ot?.position), it = {
          id: Z,
          type: "position",
          position: k ? {
            x: Math.max(0, ot.position.x),
            y: Math.max(0, ot.position.y)
          } : ot.position,
          dragging: C
        };
        if (X && B.inProgress && B.fromNode.id === X.id) {
          const O = oa(X, B.fromHandle, pt.Left, !0);
          U({ ...B, from: O });
        }
        k && X.parentId && D.push({
          id: Z,
          parentId: X.parentId,
          rect: {
            ...ot.internals.positionAbsolute,
            width: ot.measured.width ?? 0,
            height: ot.measured.height ?? 0
          }
        }), w.push(it);
      }
      if (D.length > 0) {
        const { parentLookup: Z, nodeOrigin: ot } = E(), X = wd(D, z, Z, ot);
        w.push(...X);
      }
      for (const Z of Q.values())
        w = Z(w);
      q(w);
    },
    triggerNodeChanges: (_) => {
      const { onNodesChange: C, setNodes: D, nodes: w, hasDefaultNodes: z, debug: q } = E();
      if (_?.length) {
        if (z) {
          const B = qC(_, w);
          D(B);
        }
        q && console.log("React Flow: trigger node changes", _), C?.(_);
      }
    },
    triggerEdgeChanges: (_) => {
      const { onEdgesChange: C, setEdges: D, edges: w, hasDefaultEdges: z, debug: q } = E();
      if (_?.length) {
        if (z) {
          const B = YC(_, w);
          D(B);
        }
        q && console.log("React Flow: trigger edge changes", _), C?.(_);
      }
    },
    addSelectedNodes: (_) => {
      const { multiSelectionActive: C, edgeLookup: D, nodeLookup: w, triggerNodeChanges: z, triggerEdgeChanges: q } = E();
      if (C) {
        const B = _.map((U) => Wi(U, !0));
        z(B);
        return;
      }
      z(Wa(w, /* @__PURE__ */ new Set([..._]), !0)), q(Wa(D));
    },
    addSelectedEdges: (_) => {
      const { multiSelectionActive: C, edgeLookup: D, nodeLookup: w, triggerNodeChanges: z, triggerEdgeChanges: q } = E();
      if (C) {
        const B = _.map((U) => Wi(U, !0));
        q(B);
        return;
      }
      q(Wa(D, /* @__PURE__ */ new Set([..._]))), z(Wa(w, /* @__PURE__ */ new Set(), !0));
    },
    unselectNodesAndEdges: ({ nodes: _, edges: C } = {}) => {
      const { edges: D, nodes: w, nodeLookup: z, triggerNodeChanges: q, triggerEdgeChanges: B } = E(), U = _ || w, Q = C || D, Z = [];
      for (const X of U) {
        if (!X.selected)
          continue;
        const k = z.get(X.id);
        k && (k.selected = !1), Z.push(Wi(X.id, !1));
      }
      const ot = [];
      for (const X of Q)
        X.selected && ot.push(Wi(X.id, !1));
      q(Z), B(ot);
    },
    setMinZoom: (_) => {
      const { panZoom: C, maxZoom: D } = E();
      C?.setScaleExtent([_, D]), S({ minZoom: _ });
    },
    setMaxZoom: (_) => {
      const { panZoom: C, minZoom: D } = E();
      C?.setScaleExtent([D, _]), S({ maxZoom: _ });
    },
    setTranslateExtent: (_) => {
      E().panZoom?.setTranslateExtent(_), S({ translateExtent: _ });
    },
    resetSelectedElements: () => {
      const { edges: _, nodes: C, triggerNodeChanges: D, triggerEdgeChanges: w, elementsSelectable: z } = E();
      if (!z)
        return;
      const q = C.reduce((U, Q) => Q.selected ? [...U, Wi(Q.id, !1)] : U, []), B = _.reduce((U, Q) => Q.selected ? [...U, Wi(Q.id, !1)] : U, []);
      D(q), w(B);
    },
    setNodeExtent: (_) => {
      const { nodes: C, nodeLookup: D, parentLookup: w, nodeOrigin: z, elevateNodesOnSelect: q, nodeExtent: B, zIndexMode: U } = E();
      _[0][0] === B[0][0] && _[0][1] === B[0][1] && _[1][0] === B[1][0] && _[1][1] === B[1][1] || (Ff(C, D, w, {
        nodeOrigin: z,
        nodeExtent: _,
        elevateNodesOnSelect: q,
        checkEquality: !1,
        zIndexMode: U
      }), S({ nodeExtent: _ }));
    },
    panBy: (_) => {
      const { transform: C, width: D, height: w, panZoom: z, translateExtent: q } = E();
      return B_({ delta: _, panZoom: z, transform: C, translateExtent: q, width: D, height: w });
    },
    setCenter: async (_, C, D) => {
      const { width: w, height: z, maxZoom: q, panZoom: B } = E();
      if (!B)
        return Promise.resolve(!1);
      const U = typeof D?.zoom < "u" ? D.zoom : q;
      return await B.setViewport({
        x: w / 2 - _ * U,
        y: z / 2 - C * U,
        zoom: U
      }, { duration: D?.duration, ease: D?.ease, interpolate: D?.interpolate }), Promise.resolve(!0);
    },
    cancelConnection: () => {
      S({
        connection: { ...Vm }
      });
    },
    updateConnection: (_) => {
      S({ connection: _ });
    },
    reset: () => S({ ...q0() })
  };
}, Object.is);
function nN({ initialNodes: n, initialEdges: a, defaultNodes: o, defaultEdges: s, initialWidth: u, initialHeight: f, initialMinZoom: d, initialMaxZoom: h, initialFitViewOptions: p, fitView: g, nodeOrigin: m, nodeExtent: v, zIndexMode: b, children: S }) {
  const [E] = F.useState(() => eN({
    nodes: n,
    edges: a,
    defaultNodes: o,
    defaultEdges: s,
    width: u,
    height: f,
    fitView: g,
    minZoom: d,
    maxZoom: h,
    fitViewOptions: p,
    nodeOrigin: m,
    nodeExtent: v,
    zIndexMode: b
  }));
  return M.jsx(bC, { value: E, children: M.jsx(XC, { children: S }) });
}
function iN({ children: n, nodes: a, edges: o, defaultNodes: s, defaultEdges: u, width: f, height: d, fitView: h, fitViewOptions: p, minZoom: g, maxZoom: m, nodeOrigin: v, nodeExtent: b, zIndexMode: S }) {
  return F.useContext(Yr) ? M.jsx(M.Fragment, { children: n }) : M.jsx(nN, { initialNodes: a, initialEdges: o, defaultNodes: s, defaultEdges: u, initialWidth: f, initialHeight: d, fitView: h, initialFitViewOptions: p, initialMinZoom: g, initialMaxZoom: m, nodeOrigin: v, nodeExtent: b, zIndexMode: S, children: n });
}
const aN = {
  width: "100%",
  height: "100%",
  overflow: "hidden",
  position: "relative",
  zIndex: 0
};
function lN({ nodes: n, edges: a, defaultNodes: o, defaultEdges: s, className: u, nodeTypes: f, edgeTypes: d, onNodeClick: h, onEdgeClick: p, onInit: g, onMove: m, onMoveStart: v, onMoveEnd: b, onConnect: S, onConnectStart: E, onConnectEnd: A, onClickConnectStart: _, onClickConnectEnd: C, onNodeMouseEnter: D, onNodeMouseMove: w, onNodeMouseLeave: z, onNodeContextMenu: q, onNodeDoubleClick: B, onNodeDragStart: U, onNodeDrag: Q, onNodeDragStop: Z, onNodesDelete: ot, onEdgesDelete: X, onDelete: k, onSelectionChange: it, onSelectionDragStart: O, onSelectionDrag: G, onSelectionDragStop: N, onSelectionContextMenu: H, onSelectionStart: Y, onSelectionEnd: K, onBeforeDelete: tt, connectionMode: T, connectionLineType: j = _i.Bezier, connectionLineStyle: P, connectionLineComponent: et, connectionLineContainerStyle: rt, deleteKeyCode: ct = "Backspace", selectionKeyCode: ut = "Shift", selectionOnDrag: st = !1, selectionMode: ft = xo.Full, panActivationKeyCode: wt = "Space", multiSelectionKeyCode: xt = wo() ? "Meta" : "Control", zoomActivationKeyCode: yt = wo() ? "Meta" : "Control", snapToGrid: vt, snapGrid: Nt, onlyRenderVisibleElements: Bt = !1, selectNodesOnDrag: Ht, nodesDraggable: oe, autoPanOnNodeFocus: Je, nodesConnectable: ze, nodesFocusable: Fe, nodeOrigin: vn = vv, edgesFocusable: Ti, edgesReconnectable: Ai, elementsSelectable: re = !0, defaultViewport: sa = DC, minZoom: bn = 0.5, maxZoom: Kn = 2, translateExtent: Mi = bo, preventScrolling: Gr = !0, nodeExtent: ra, defaultMarkerColor: Zr = "#b1b1b7", zoomOnScroll: Kr = !0, zoomOnPinch: zi = !0, panOnScroll: ye = !1, panOnScrollSpeed: sn = 0.5, panOnScrollMode: me = na.Free, zoomOnDoubleClick: $r = !0, panOnDrag: Jr = !0, onPaneClick: Fr, onPaneMouseEnter: ua, onPaneMouseMove: ca, onPaneMouseLeave: fa, onPaneScroll: xn, onPaneContextMenu: da, paneClickDistance: Oi = 1, nodeClickDistance: Ir = 0, children: Ro, onReconnect: rl, onReconnectStart: Di, onReconnectEnd: Wr, onEdgeContextMenu: Ho, onEdgeDoubleClick: jo, onEdgeMouseEnter: Uo, onEdgeMouseMove: ul, onEdgeMouseLeave: cl, reconnectRadius: Bo = 10, onNodesChange: Lo, onEdgesChange: rn, noDragClassName: ae = "nodrag", noWheelClassName: ge = "nowheel", noPanClassName: Sn = "nopan", fitView: ha, fitViewOptions: qo, connectOnClick: Pr, attributionPosition: Yo, proOptions: Ri, defaultEdgeOptions: fl, elevateNodesOnSelect: $n = !0, elevateEdgesOnSelect: Jn = !1, disableKeyboardA11y: Fn = !1, autoPanOnConnect: In, autoPanOnNodeDrag: It, autoPanSpeed: Vo, connectionRadius: Qo, isValidConnection: wn, onError: Wn, style: tu, id: dl, nodeDragThreshold: Xo, connectionDragThreshold: eu, viewport: ga, onViewportChange: pa, width: Ie, height: xe, colorMode: ko = "light", debug: nu, onScroll: ya, ariaLabelConfig: Go, zIndexMode: Hi = "basic", ...iu }, Se) {
  const ji = dl || "1", Zo = UC(ko), hl = F.useCallback((En) => {
    En.currentTarget.scrollTo({ top: 0, left: 0, behavior: "instant" }), ya?.(En);
  }, [ya]);
  return M.jsx("div", { "data-testid": "rf__wrapper", ...iu, onScroll: hl, style: { ...tu, ...aN }, ref: Se, className: ie(["react-flow", u, Zo]), id: dl, role: "application", children: M.jsxs(iN, { nodes: n, edges: a, width: Ie, height: xe, fitView: ha, fitViewOptions: qo, minZoom: bn, maxZoom: Kn, nodeOrigin: vn, nodeExtent: ra, zIndexMode: Hi, children: [M.jsx(jC, { nodes: n, edges: a, defaultNodes: o, defaultEdges: s, onConnect: S, onConnectStart: E, onConnectEnd: A, onClickConnectStart: _, onClickConnectEnd: C, nodesDraggable: oe, autoPanOnNodeFocus: Je, nodesConnectable: ze, nodesFocusable: Fe, edgesFocusable: Ti, edgesReconnectable: Ai, elementsSelectable: re, elevateNodesOnSelect: $n, elevateEdgesOnSelect: Jn, minZoom: bn, maxZoom: Kn, nodeExtent: ra, onNodesChange: Lo, onEdgesChange: rn, snapToGrid: vt, snapGrid: Nt, connectionMode: T, translateExtent: Mi, connectOnClick: Pr, defaultEdgeOptions: fl, fitView: ha, fitViewOptions: qo, onNodesDelete: ot, onEdgesDelete: X, onDelete: k, onNodeDragStart: U, onNodeDrag: Q, onNodeDragStop: Z, onSelectionDrag: G, onSelectionDragStart: O, onSelectionDragStop: N, onMove: m, onMoveStart: v, onMoveEnd: b, noPanClassName: Sn, nodeOrigin: vn, rfId: ji, autoPanOnConnect: In, autoPanOnNodeDrag: It, autoPanSpeed: Vo, onError: Wn, connectionRadius: Qo, isValidConnection: wn, selectNodesOnDrag: Ht, nodeDragThreshold: Xo, connectionDragThreshold: eu, onBeforeDelete: tt, debug: nu, ariaLabelConfig: Go, zIndexMode: Hi }), M.jsx(tN, { onInit: g, onNodeClick: h, onEdgeClick: p, onNodeMouseEnter: D, onNodeMouseMove: w, onNodeMouseLeave: z, onNodeContextMenu: q, onNodeDoubleClick: B, nodeTypes: f, edgeTypes: d, connectionLineType: j, connectionLineStyle: P, connectionLineComponent: et, connectionLineContainerStyle: rt, selectionKeyCode: ut, selectionOnDrag: st, selectionMode: ft, deleteKeyCode: ct, multiSelectionKeyCode: xt, panActivationKeyCode: wt, zoomActivationKeyCode: yt, onlyRenderVisibleElements: Bt, defaultViewport: sa, translateExtent: Mi, minZoom: bn, maxZoom: Kn, preventScrolling: Gr, zoomOnScroll: Kr, zoomOnPinch: zi, zoomOnDoubleClick: $r, panOnScroll: ye, panOnScrollSpeed: sn, panOnScrollMode: me, panOnDrag: Jr, onPaneClick: Fr, onPaneMouseEnter: ua, onPaneMouseMove: ca, onPaneMouseLeave: fa, onPaneScroll: xn, onPaneContextMenu: da, paneClickDistance: Oi, nodeClickDistance: Ir, onSelectionContextMenu: H, onSelectionStart: Y, onSelectionEnd: K, onReconnect: rl, onReconnectStart: Di, onReconnectEnd: Wr, onEdgeContextMenu: Ho, onEdgeDoubleClick: jo, onEdgeMouseEnter: Uo, onEdgeMouseMove: ul, onEdgeMouseLeave: cl, reconnectRadius: Bo, defaultMarkerColor: Zr, noDragClassName: ae, noWheelClassName: ge, noPanClassName: Sn, rfId: ji, disableKeyboardA11y: Fn, nodeExtent: ra, viewport: ga, onViewportChange: pa }), M.jsx(OC, { onSelectionChange: it }), Ro, M.jsx(NC, { proOptions: Ri, position: Yo }), M.jsx(CC, { rfId: ji, disableKeyboardA11y: Fn })] }) });
}
var oN = xv(lN);
function sN({ dimensions: n, lineWidth: a, variant: o, className: s }) {
  return M.jsx("path", { strokeWidth: a, d: `M${n[0] / 2} 0 V${n[1]} M0 ${n[1] / 2} H${n[0]}`, className: ie(["react-flow__background-pattern", o, s]) });
}
function rN({ radius: n, className: a }) {
  return M.jsx("circle", { cx: n, cy: n, r: n, className: ie(["react-flow__background-pattern", "dots", a]) });
}
var Ni;
(function(n) {
  n.Lines = "lines", n.Dots = "dots", n.Cross = "cross";
})(Ni || (Ni = {}));
const uN = {
  [Ni.Dots]: 1,
  [Ni.Lines]: 1,
  [Ni.Cross]: 6
}, cN = (n) => ({ transform: n.transform, patternId: `pattern-${n.rfId}` });
function kv({
  id: n,
  variant: a = Ni.Dots,
  // only used for dots and cross
  gap: o = 20,
  // only used for lines and cross
  size: s,
  lineWidth: u = 1,
  offset: f = 0,
  color: d,
  bgColor: h,
  style: p,
  className: g,
  patternClassName: m
}) {
  const v = F.useRef(null), { transform: b, patternId: S } = zt(cN, Gt), E = s || uN[a], A = a === Ni.Dots, _ = a === Ni.Cross, C = Array.isArray(o) ? o : [o, o], D = [C[0] * b[2] || 1, C[1] * b[2] || 1], w = E * b[2], z = Array.isArray(f) ? f : [f, f], q = _ ? [w, w] : D, B = [
    z[0] * b[2] || 1 + q[0] / 2,
    z[1] * b[2] || 1 + q[1] / 2
  ], U = `${S}${n || ""}`;
  return M.jsxs("svg", { className: ie(["react-flow__background", g]), style: {
    ...p,
    ...Qr,
    "--xy-background-color-props": h,
    "--xy-background-pattern-color-props": d
  }, ref: v, "data-testid": "rf__background", children: [M.jsx("pattern", { id: U, x: b[0] % D[0], y: b[1] % D[1], width: D[0], height: D[1], patternUnits: "userSpaceOnUse", patternTransform: `translate(-${B[0]},-${B[1]})`, children: A ? M.jsx(rN, { radius: w / 2, className: m }) : M.jsx(sN, { dimensions: q, lineWidth: u, variant: a, className: m }) }), M.jsx("rect", { x: "0", y: "0", width: "100%", height: "100%", fill: `url(#${U})` })] });
}
kv.displayName = "Background";
const fN = F.memo(kv);
function dN() {
  return M.jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 32", children: M.jsx("path", { d: "M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" }) });
}
function hN() {
  return M.jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 5", children: M.jsx("path", { d: "M0 0h32v4.2H0z" }) });
}
function gN() {
  return M.jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 32 30", children: M.jsx("path", { d: "M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" }) });
}
function pN() {
  return M.jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: M.jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z" }) });
}
function yN() {
  return M.jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 25 32", children: M.jsx("path", { d: "M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z" }) });
}
function fr({ children: n, className: a, ...o }) {
  return M.jsx("button", { type: "button", className: ie(["react-flow__controls-button", a]), ...o, children: n });
}
const mN = (n) => ({
  isInteractive: n.nodesDraggable || n.nodesConnectable || n.elementsSelectable,
  minZoomReached: n.transform[2] <= n.minZoom,
  maxZoomReached: n.transform[2] >= n.maxZoom,
  ariaLabelConfig: n.ariaLabelConfig
});
function Gv({ style: n, showZoom: a = !0, showFitView: o = !0, showInteractive: s = !0, fitViewOptions: u, onZoomIn: f, onZoomOut: d, onFitView: h, onInteractiveChange: p, className: g, children: m, position: v = "bottom-left", orientation: b = "vertical", "aria-label": S }) {
  const E = Zt(), { isInteractive: A, minZoomReached: _, maxZoomReached: C, ariaLabelConfig: D } = zt(mN, Gt), { zoomIn: w, zoomOut: z, fitView: q } = Ed(), B = () => {
    w(), f?.();
  }, U = () => {
    z(), d?.();
  }, Q = () => {
    q(u), h?.();
  }, Z = () => {
    E.setState({
      nodesDraggable: !A,
      nodesConnectable: !A,
      elementsSelectable: !A
    }), p?.(!A);
  }, ot = b === "horizontal" ? "horizontal" : "vertical";
  return M.jsxs(Vr, { className: ie(["react-flow__controls", ot, g]), position: v, style: n, "data-testid": "rf__controls", "aria-label": S ?? D["controls.ariaLabel"], children: [a && M.jsxs(M.Fragment, { children: [M.jsx(fr, { onClick: B, className: "react-flow__controls-zoomin", title: D["controls.zoomIn.ariaLabel"], "aria-label": D["controls.zoomIn.ariaLabel"], disabled: C, children: M.jsx(dN, {}) }), M.jsx(fr, { onClick: U, className: "react-flow__controls-zoomout", title: D["controls.zoomOut.ariaLabel"], "aria-label": D["controls.zoomOut.ariaLabel"], disabled: _, children: M.jsx(hN, {}) })] }), o && M.jsx(fr, { className: "react-flow__controls-fitview", onClick: Q, title: D["controls.fitView.ariaLabel"], "aria-label": D["controls.fitView.ariaLabel"], children: M.jsx(gN, {}) }), s && M.jsx(fr, { className: "react-flow__controls-interactive", onClick: Z, title: D["controls.interactive.ariaLabel"], "aria-label": D["controls.interactive.ariaLabel"], children: A ? M.jsx(yN, {}) : M.jsx(pN, {}) }), m] });
}
Gv.displayName = "Controls";
const vN = F.memo(Gv);
function bN({ id: n, x: a, y: o, width: s, height: u, style: f, color: d, strokeColor: h, strokeWidth: p, className: g, borderRadius: m, shapeRendering: v, selected: b, onClick: S }) {
  const { background: E, backgroundColor: A } = f || {}, _ = d || E || A;
  return M.jsx("rect", { className: ie(["react-flow__minimap-node", { selected: b }, g]), x: a, y: o, rx: m, ry: m, width: s, height: u, style: {
    fill: _,
    stroke: h,
    strokeWidth: p
  }, shapeRendering: v, onClick: S ? (C) => S(C, n) : void 0 });
}
const xN = F.memo(bN), SN = (n) => n.nodes.map((a) => a.id), zf = (n) => n instanceof Function ? n : () => n;
function wN({
  nodeStrokeColor: n,
  nodeColor: a,
  nodeClassName: o = "",
  nodeBorderRadius: s = 5,
  nodeStrokeWidth: u,
  /*
   * We need to rename the prop to be `CapitalCase` so that JSX will render it as
   * a component properly.
   */
  nodeComponent: f = xN,
  onClick: d
}) {
  const h = zt(SN, Gt), p = zf(a), g = zf(n), m = zf(o), v = typeof window > "u" || window.chrome ? "crispEdges" : "geometricPrecision";
  return M.jsx(M.Fragment, { children: h.map((b) => (
    /*
     * The split of responsibilities between MiniMapNodes and
     * NodeComponentWrapper may appear weird. However, it’s designed to
     * minimize the cost of updates when individual nodes change.
     *
     * For more details, see a similar commit in `NodeRenderer/index.tsx`.
     */
    M.jsx(_N, { id: b, nodeColorFunc: p, nodeStrokeColorFunc: g, nodeClassNameFunc: m, nodeBorderRadius: s, nodeStrokeWidth: u, NodeComponent: f, onClick: d, shapeRendering: v }, b)
  )) });
}
function EN({ id: n, nodeColorFunc: a, nodeStrokeColorFunc: o, nodeClassNameFunc: s, nodeBorderRadius: u, nodeStrokeWidth: f, shapeRendering: d, NodeComponent: h, onClick: p }) {
  const { node: g, x: m, y: v, width: b, height: S } = zt((E) => {
    const A = E.nodeLookup.get(n);
    if (!A)
      return { node: void 0, x: 0, y: 0, width: 0, height: 0 };
    const _ = A.internals.userNode, { x: C, y: D } = A.internals.positionAbsolute, { width: w, height: z } = Zn(_);
    return {
      node: _,
      x: C,
      y: D,
      width: w,
      height: z
    };
  }, Gt);
  return !g || g.hidden || !$m(g) ? null : M.jsx(h, { x: m, y: v, width: b, height: S, style: g.style, selected: !!g.selected, className: s(g), color: a(g), borderRadius: u, strokeColor: o(g), strokeWidth: f, shapeRendering: d, onClick: p, id: g.id });
}
const _N = F.memo(EN);
var CN = F.memo(wN);
const NN = 200, TN = 150, AN = (n) => !n.hidden, MN = (n) => {
  const a = {
    x: -n.transform[0] / n.transform[2],
    y: -n.transform[1] / n.transform[2],
    width: n.width / n.transform[2],
    height: n.height / n.transform[2]
  };
  return {
    viewBB: a,
    boundingRect: n.nodeLookup.size > 0 ? Km(zo(n.nodeLookup, { filter: AN }), a) : a,
    rfId: n.rfId,
    panZoom: n.panZoom,
    translateExtent: n.translateExtent,
    flowWidth: n.width,
    flowHeight: n.height,
    ariaLabelConfig: n.ariaLabelConfig
  };
}, zN = "react-flow__minimap-desc";
function Zv({
  style: n,
  className: a,
  nodeStrokeColor: o,
  nodeColor: s,
  nodeClassName: u = "",
  nodeBorderRadius: f = 5,
  nodeStrokeWidth: d,
  /*
   * We need to rename the prop to be `CapitalCase` so that JSX will render it as
   * a component properly.
   */
  nodeComponent: h,
  bgColor: p,
  maskColor: g,
  maskStrokeColor: m,
  maskStrokeWidth: v,
  position: b = "bottom-right",
  onClick: S,
  onNodeClick: E,
  pannable: A = !1,
  zoomable: _ = !1,
  ariaLabel: C,
  inversePan: D,
  zoomStep: w = 1,
  offsetScale: z = 5
}) {
  const q = Zt(), B = F.useRef(null), { boundingRect: U, viewBB: Q, rfId: Z, panZoom: ot, translateExtent: X, flowWidth: k, flowHeight: it, ariaLabelConfig: O } = zt(MN, Gt), G = n?.width ?? NN, N = n?.height ?? TN, H = U.width / G, Y = U.height / N, K = Math.max(H, Y), tt = K * G, T = K * N, j = z * K, P = U.x - (tt - U.width) / 2 - j, et = U.y - (T - U.height) / 2 - j, rt = tt + j * 2, ct = T + j * 2, ut = `${zN}-${Z}`, st = F.useRef(0), ft = F.useRef();
  st.current = K, F.useEffect(() => {
    if (B.current && ot)
      return ft.current = Z_({
        domNode: B.current,
        panZoom: ot,
        getTransform: () => q.getState().transform,
        getViewScale: () => st.current
      }), () => {
        ft.current?.destroy();
      };
  }, [ot]), F.useEffect(() => {
    ft.current?.update({
      translateExtent: X,
      width: k,
      height: it,
      inversePan: D,
      pannable: A,
      zoomStep: w,
      zoomable: _
    });
  }, [A, _, D, w, X, k, it]);
  const wt = S ? (vt) => {
    const [Nt, Bt] = ft.current?.pointer(vt) || [0, 0];
    S(vt, { x: Nt, y: Bt });
  } : void 0, xt = E ? F.useCallback((vt, Nt) => {
    const Bt = q.getState().nodeLookup.get(Nt).internals.userNode;
    E(vt, Bt);
  }, []) : void 0, yt = C ?? O["minimap.ariaLabel"];
  return M.jsx(Vr, { position: b, style: {
    ...n,
    "--xy-minimap-background-color-props": typeof p == "string" ? p : void 0,
    "--xy-minimap-mask-background-color-props": typeof g == "string" ? g : void 0,
    "--xy-minimap-mask-stroke-color-props": typeof m == "string" ? m : void 0,
    "--xy-minimap-mask-stroke-width-props": typeof v == "number" ? v * K : void 0,
    "--xy-minimap-node-background-color-props": typeof s == "string" ? s : void 0,
    "--xy-minimap-node-stroke-color-props": typeof o == "string" ? o : void 0,
    "--xy-minimap-node-stroke-width-props": typeof d == "number" ? d : void 0
  }, className: ie(["react-flow__minimap", a]), "data-testid": "rf__minimap", children: M.jsxs("svg", { width: G, height: N, viewBox: `${P} ${et} ${rt} ${ct}`, className: "react-flow__minimap-svg", role: "img", "aria-labelledby": ut, ref: B, onClick: wt, children: [yt && M.jsx("title", { id: ut, children: yt }), M.jsx(CN, { onClick: xt, nodeColor: s, nodeStrokeColor: o, nodeBorderRadius: f, nodeClassName: u, nodeStrokeWidth: d, nodeComponent: h }), M.jsx("path", { className: "react-flow__minimap-mask", d: `M${P - j},${et - j}h${rt + j * 2}v${ct + j * 2}h${-rt - j * 2}z
        M${Q.x},${Q.y}h${Q.width}v${Q.height}h${-Q.width}z`, fillRule: "evenodd", pointerEvents: "none" })] }) });
}
Zv.displayName = "MiniMap";
F.memo(Zv);
const ON = (n) => (a) => n ? `${Math.max(1 / a.transform[2], 1)}` : void 0, DN = {
  [sl.Line]: "right",
  [sl.Handle]: "bottom-right"
};
function RN({ nodeId: n, position: a, variant: o = sl.Handle, className: s, style: u = void 0, children: f, color: d, minWidth: h = 10, minHeight: p = 10, maxWidth: g = Number.MAX_VALUE, maxHeight: m = Number.MAX_VALUE, keepAspectRatio: v = !1, resizeDirection: b, autoScale: S = !0, shouldResize: E, onResizeStart: A, onResize: _, onResizeEnd: C }) {
  const D = _v(), w = typeof n == "string" ? n : D, z = Zt(), q = F.useRef(null), B = o === sl.Handle, U = zt(F.useCallback(ON(B && S), [B, S]), Gt), Q = F.useRef(null), Z = a ?? DN[o];
  F.useEffect(() => {
    if (!(!q.current || !w))
      return Q.current || (Q.current = oC({
        domNode: q.current,
        nodeId: w,
        getStoreItems: () => {
          const { nodeLookup: X, transform: k, snapGrid: it, snapToGrid: O, nodeOrigin: G, domNode: N } = z.getState();
          return {
            nodeLookup: X,
            transform: k,
            snapGrid: it,
            snapToGrid: O,
            nodeOrigin: G,
            paneDomNode: N
          };
        },
        onChange: (X, k) => {
          const { triggerNodeChanges: it, nodeLookup: O, parentLookup: G, nodeOrigin: N } = z.getState(), H = [], Y = { x: X.x, y: X.y }, K = O.get(w);
          if (K && K.expandParent && K.parentId) {
            const tt = K.origin ?? N, T = X.width ?? K.measured.width ?? 0, j = X.height ?? K.measured.height ?? 0, P = {
              id: K.id,
              parentId: K.parentId,
              rect: {
                width: T,
                height: j,
                ...Jm({
                  x: X.x ?? K.position.x,
                  y: X.y ?? K.position.y
                }, { width: T, height: j }, K.parentId, O, tt)
              }
            }, et = wd([P], O, G, N);
            H.push(...et), Y.x = X.x ? Math.max(tt[0] * T, X.x) : void 0, Y.y = X.y ? Math.max(tt[1] * j, X.y) : void 0;
          }
          if (Y.x !== void 0 && Y.y !== void 0) {
            const tt = {
              id: w,
              type: "position",
              position: { ...Y }
            };
            H.push(tt);
          }
          if (X.width !== void 0 && X.height !== void 0) {
            const T = {
              id: w,
              type: "dimensions",
              resizing: !0,
              setAttributes: b ? b === "horizontal" ? "width" : "height" : !0,
              dimensions: {
                width: X.width,
                height: X.height
              }
            };
            H.push(T);
          }
          for (const tt of k) {
            const T = {
              ...tt,
              type: "position"
            };
            H.push(T);
          }
          it(H);
        },
        onEnd: ({ width: X, height: k }) => {
          const it = {
            id: w,
            type: "dimensions",
            resizing: !1,
            dimensions: {
              width: X,
              height: k
            }
          };
          z.getState().triggerNodeChanges([it]);
        }
      })), Q.current.update({
        controlPosition: Z,
        boundaries: {
          minWidth: h,
          minHeight: p,
          maxWidth: g,
          maxHeight: m
        },
        keepAspectRatio: v,
        resizeDirection: b,
        onResizeStart: A,
        onResize: _,
        onResizeEnd: C,
        shouldResize: E
      }), () => {
        Q.current?.destroy();
      };
  }, [
    Z,
    h,
    p,
    g,
    m,
    v,
    A,
    _,
    C,
    E
  ]);
  const ot = Z.split("-");
  return M.jsx("div", { className: ie(["react-flow__resize-control", "nodrag", ...ot, o, s]), ref: q, style: {
    ...u,
    scale: U,
    ...d && { [B ? "backgroundColor" : "borderColor"]: d }
  }, children: f });
}
F.memo(RN);
const HN = `
  .react-flow { background: var(--dsw-alias-bg-base, #ffffff); }
  .react-flow__node-group {
    background: var(--dsw-alias-bg-layer-1, #f6f8fa);
    border: 1px dashed var(--dsw-alias-border-l2, rgba(31,35,40,0.22));
    border-radius: 10px;
  }
  .react-flow__node-default {
    background: var(--dsw-alias-bg-layer-1, #f6f8fa);
    color: var(--dsw-alias-label-primary, #1f2328);
    border: 1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15));
    border-radius: 8px;
    padding: 10px 12px;
    white-space: pre-wrap;
    font-size: 12px;
    box-shadow: none;
  }
  .react-flow__controls { background: var(--dsw-alias-bg-layer-1, #f6f8fa); border: 1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15)); border-radius: 10px; }
  .react-flow__controls-button { background: transparent; border-color: var(--dsw-alias-border-l2, rgba(31,35,40,0.15)); color: var(--dsw-alias-label-secondary, #3d444d); }
  .react-flow__controls-button:hover { background: var(--dsw-alias-bg-layer-2, #eef1f4); color: var(--dsw-alias-label-primary, #1f2328); }
`;
function jN() {
  const [n, a] = F.useState([]), [o, s] = F.useState([]), [u, f] = F.useState(""), [d, h] = F.useState(""), [p, g] = F.useState(""), [m, v] = F.useState(""), b = async () => {
    if (d)
      try {
        const C = await (await fetch(`/semantic-os/lineage?id=${encodeURIComponent(d)}`)).json().catch(() => ({}));
        let D = C && C.detail || "没有出处可复制。", w = "";
        C && C.ok && C.path ? (D = "路径已复制。", w = C.path) : C && C.ok && Array.isArray(C.hops) && C.hops.length && (D = C.detail || "血缘摘要已复制。", w = [C.detail, C.hops.map((z) => z.label || z.id).join(" → ")].filter(Boolean).join(" ")), v(D), w && navigator.clipboard && navigator.clipboard.writeText && navigator.clipboard.writeText(w).catch(() => {
        });
      } catch {
        v("没能复制出处。");
      }
  }, S = async (_) => {
    if (!d) return;
    const C = await fetch(`/api/provenance/report?node_id=${encodeURIComponent(d)}&format=${_}`);
    if (!C.ok)
      return;
    const D = await C.blob(), w = window.URL.createObjectURL(D), z = document.createElement("a");
    z.href = w, z.download = `${d}_provenance.${_ === "markdown" ? "md" : "json"}`, document.body.appendChild(z), z.click(), window.URL.revokeObjectURL(w), document.body.removeChild(z);
  }, [E, A] = F.useState(d);
  return d !== E && (A(d), g(""), v(""), a([]), s([])), F.useEffect(() => {
    let _ = !1;
    if (!d) return;
    const C = [
      { id: "group_agent", type: "group", position: { x: 50, y: 50 }, style: { width: 800, height: 120 } },
      { id: "group_activity", type: "group", position: { x: 50, y: 200 }, style: { width: 800, height: 120 } },
      { id: "group_entity", type: "group", position: { x: 50, y: 350 }, style: { width: 800, height: 120 } }
    ];
    return (async () => {
      g("");
      try {
        const w = await fetch("/api/provenance?node_id=" + encodeURIComponent(d));
        if (!w.ok) {
          const k = await w.text();
          throw new Error(`血缘没读成（${w.status}）。`);
        }
        const z = w.headers.get("content-type");
        if (!z || !z.includes("application/json"))
          throw new Error("血缘没读成。");
        const q = await w.json();
        w.status === 207 && g(q.message || "血缘只读到一部分。");
        const B = Array.isArray(q && q.hops) ? q.hops : [], U = Array.isArray(q && q.nodes) ? q.nodes : B.map((k, it) => ({
          id: String(k.id || k.label || `hop-${it}`),
          label: String(k.label || k.id || `hop-${it}`),
          prov_type: String(k.type || k.source || "entity"),
          parent_id: "group_entity"
        })), Q = Array.isArray(q && q.edges) ? q.edges : B.slice(1).map((k, it) => ({
          id: `e${it}`,
          source: String(B[it].id || B[it].label || `hop-${it}`),
          target: String(k.id || k.label || `hop-${it + 1}`),
          label: String(k.type || "")
        })), Z = { group_agent: 0, group_activity: 0, group_entity: 0 }, ot = U.map((k) => {
          const it = String(k.parent_id || "group_entity"), O = Z[it] || 0;
          return Z[it] = O + 1, {
            id: String(k.id || k.label || ""),
            data: { label: String(k.label || k.id || "") + `
(` + String(k.prov_type || "") + ")" },
            position: { x: 50 + O * 180, y: 30 },
            parentId: it,
            extent: "parent",
            type: "default"
          };
        }), X = Q.map((k, it) => ({
          id: String(k.id || `e${it}`),
          source: k.source,
          target: k.target,
          label: k.label,
          animated: !0,
          style: { stroke: "#58a6ff" }
        }));
        _ || (a([...C, ...ot]), s(X));
      } catch (w) {
        g(w instanceof Error ? w.message : "血缘没读成。");
      }
    })(), () => {
      _ = !0;
    };
  }, [d]), /* @__PURE__ */ M.jsxs("div", { style: { width: "100%", height: "100%", position: "relative", background: "var(--dsw-alias-bg-base, #ffffff)" }, children: [
    /* @__PURE__ */ M.jsx("style", { children: HN }),
    /* @__PURE__ */ M.jsxs("div", { style: { position: "absolute", top: 14, left: 14, right: 14, zIndex: 10, display: "flex", gap: 8, alignItems: "center", background: "var(--dsw-alias-bg-layer-1, #f6f8fa)", padding: "8px 12px", borderRadius: 12, border: "1px solid var(--dsw-alias-border-l2, rgba(31,35,40,0.15))", boxShadow: "none" }, children: [
      /* @__PURE__ */ M.jsx("span", { className: "ws-eyebrow", style: { color: "var(--ws-accent, #4aa3ff)", marginRight: 4 }, children: "血缘" }),
      /* @__PURE__ */ M.jsx(
        "input",
        {
          className: "ws-input",
          type: "text",
          placeholder: "输入节点编号",
          value: u,
          onChange: (_) => f(_.target.value),
          onKeyDown: (_) => {
            _.key === "Enter" && h(u);
          },
          style: { width: 200, padding: "6px 10px", fontSize: 12 }
        }
      ),
      /* @__PURE__ */ M.jsx("button", { className: "ws-btn ws-btn--primary", style: { padding: "6px 12px" }, onClick: () => h(u), children: "追踪" }),
      /* @__PURE__ */ M.jsx("div", { style: { flex: 1 } }),
      /* @__PURE__ */ M.jsx("button", { className: "ws-btn ws-btn--ghost", style: { padding: "6px 12px", fontSize: 11 }, disabled: !d, onClick: () => {
        b();
      }, children: "复制出处" }),
      m ? /* @__PURE__ */ M.jsx("span", { "data-dsh-lineage-note": "1", style: { fontSize: 12, color: "var(--ws-text)", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: m }) : null,
      /* @__PURE__ */ M.jsx("button", { className: "ws-btn ws-btn--ghost", style: { padding: "6px 12px", fontSize: 11 }, disabled: !d, onClick: () => {
        S("json");
      }, children: "导出 JSON" }),
      /* @__PURE__ */ M.jsx("button", { className: "ws-btn ws-btn--ghost", style: { padding: "6px 12px", fontSize: 11 }, disabled: !d, onClick: () => {
        S("markdown");
      }, children: "导出文稿" })
    ] }),
    p ? /* @__PURE__ */ M.jsx("div", { style: { position: "absolute", top: 60, left: 14, right: 14, zIndex: 10, padding: 12, borderRadius: 14, color: "#d14343", background: "rgba(209,67,67,0.08)", border: "1px solid rgba(209,67,67,0.22)" }, children: p }) : null,
    d ? /* @__PURE__ */ M.jsxs(oN, { nodes: n, edges: o, fitView: !0, children: [
      /* @__PURE__ */ M.jsx(fN, { color: "var(--dsw-alias-border-l2, rgba(31,35,40,0.08))", gap: 24 }),
      /* @__PURE__ */ M.jsx(vN, {})
    ] }) : /* @__PURE__ */ M.jsxs("div", { className: "ws-empty", style: { height: "100%", paddingTop: 72 }, children: [
      /* @__PURE__ */ M.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ M.jsx(oS, { size: 36, color: "var(--ws-accent)" }) }),
      /* @__PURE__ */ M.jsx("div", { className: "ws-empty-title", children: "血缘" }),
      /* @__PURE__ */ M.jsx("div", { className: "ws-empty-body", children: "上面填节点编号，点追踪，看这条节点的血缘。" })
    ] })
  ] });
}
const UN = 5e3;
class BN extends F.Component {
  settleTimer = null;
  constructor(a) {
    super(a), this.state = { hasError: !1, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(a) {
    return { hasError: !0, error: a };
  }
  componentDidCatch(a, o) {
    console.error("ErrorBoundary caught an error:", a, o), this.clearSettleTimer();
  }
  componentWillUnmount() {
    this.clearSettleTimer();
  }
  clearSettleTimer() {
    this.settleTimer !== null && (clearTimeout(this.settleTimer), this.settleTimer = null);
  }
  resetErrorBoundary = () => {
    this.clearSettleTimer(), this.setState((a) => ({
      hasError: !1,
      error: null,
      retryCount: a.retryCount + 1
    })), this.settleTimer = setTimeout(() => {
      this.settleTimer = null, this.setState({ retryCount: 0 });
    }, UN);
  };
  render() {
    if (this.state.hasError) {
      const a = this.state.retryCount >= 3;
      return /* @__PURE__ */ M.jsxs(
        "div",
        {
          className: "workspace-loading",
          style: {
            flexDirection: "column",
            gap: 12,
            color: "var(--ws-red)"
          },
          children: [
            /* @__PURE__ */ M.jsx(nS, { size: 32, style: { marginBottom: 4, opacity: 0.8 } }),
            /* @__PURE__ */ M.jsx("div", { style: { fontWeight: 500, fontSize: "15px" }, children: "Something went wrong in this view." }),
            /* @__PURE__ */ M.jsx("div", { style: { fontSize: "13px", opacity: 0.7, maxWidth: 450, textAlign: "center", marginBottom: 8, lineHeight: 1.5 }, children: a ? "This view continues to encounter a critical error. Please switch to another workspace or reload the page to restore functionality." : "An unexpected problem occurred while rendering this workspace. Your data is safe, but this view cannot be displayed." }),
            a ? /* @__PURE__ */ M.jsx(
              "button",
              {
                className: "ws-btn ws-btn--ghost",
                style: {
                  borderColor: "var(--ws-border)",
                  color: "var(--ws-text)"
                },
                onClick: () => window.location.reload(),
                children: "Reload Application"
              }
            ) : /* @__PURE__ */ M.jsx(
              "button",
              {
                className: "ws-btn ws-btn--ghost",
                style: {
                  borderColor: "var(--ws-red-soft)",
                  color: "var(--ws-red)"
                },
                onClick: this.resetErrorBoundary,
                children: "Try Again"
              }
            )
          ]
        }
      );
    }
    return this.props.children;
  }
}
function hn(n, a) {
  return typeof document > "u" ? a : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || a;
}
function LN() {
  hn("--dsw-alias-bg-base", "#ffffff"), hn("--dsw-alias-bg-layer-1", "#f6f8fa"), hn("--dsw-alias-bg-layer-2", "#eef1f4"), hn("--dsw-alias-label-primary", "#1f2328"), hn("--dsw-alias-label-secondary", "#3d444d"), hn("--dsw-alias-brand-primary", "#0969da"), hn("--dsw-alias-border-l2", "rgba(31,35,40,0.15)"), hn("--dsw-alias-label-primary-foreground", "") || hn("--dsw-alias-label-on-primary", "") || hn("--dsw-alias-label-on-brand", "");
}
const qN = /^\s*Entity\s*\(/;
function Xn(n) {
  return typeof n == "string" && qN.test(n);
}
function YN(n) {
  const a = n.match(/Entity\s*\(\s*text\s*=\s*(['"])((?:\\.|(?!\1).)*)\1/);
  return a ? a[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
}
function be(n) {
  return typeof n == "string" ? n.trim() : "";
}
function kr(n) {
  return n.properties && typeof n.properties == "object" ? n.properties : {};
}
function Or(n) {
  const a = kr(n), o = be(n.id);
  if (o.startsWith("file:")) {
    const u = o.split(/[/\\]/).pop() || o;
    if (u && !Xn(u)) return u;
  }
  if (o.startsWith("session:")) {
    const u = be(a.content) || be(n.content);
    if (u) return u.split(`
`)[0].slice(0, 24);
  }
  const s = [a.label, a.name, a.content, n.content, o];
  for (const u of s) {
    const f = be(u);
    if (!(!f || Xn(f)))
      return f;
  }
  for (const u of s) {
    const f = be(u);
    if (!f || !Xn(f)) continue;
    const d = YN(f);
    if (d) return d;
  }
  return o && !Xn(o) ? o : "节点";
}
const VN = /* @__PURE__ */ new Set(["UNKNOWN", "entity", "Entity", "DATE", "PERSON"]);
function _o(n) {
  const a = be(n.id);
  if (!a) return !0;
  const o = kr(n), s = be(n.content) || be(o.content);
  if (Xn(a) || Xn(s)) return !0;
  const u = be(n.type);
  return !!VN.has(u);
}
function mr(n) {
  const a = Or(n), o = { ...kr(n) };
  return (!be(o.label) || Xn(o.label)) && (o.label = a), (!be(o.name) || Xn(o.name)) && (o.name = a), (!be(o.content) || Xn(o.content)) && (o.content = a), {
    ...n,
    content: a,
    properties: o
  };
}
function QN(n, a) {
  const o = a.trim().toLowerCase();
  if (!o) return 0;
  const s = Or(n).toLowerCase(), u = be(n.id).toLowerCase(), f = be(n.type).toLowerCase(), d = kr(n), h = [d.name, d.content, d.label].map((m) => be(m).toLowerCase()).filter(Boolean), p = [s, u, f, ...h];
  let g = 0;
  return s === o || u === o ? g = 1 : s.startsWith(o) || u.startsWith(o) ? g = 0.92 : p.some((m) => m.includes(o)) && (g = 0.78), g <= 0 ? 0 : Math.min(g, 1);
}
function XN(n, a, o = 8) {
  return n.filter((s) => !_o(s)).map((s) => ({ node: mr(s), score: QN(s, a) })).filter((s) => s.score > 0).sort((s, u) => u.score !== s.score ? u.score - s.score : Or(s.node).localeCompare(Or(u.node), "zh")).slice(0, o);
}
const kN = [
  "graph",
  "temporal",
  "enrich",
  "provenance",
  "reason",
  "decisions",
  "import",
  "export",
  "sparql",
  "ontology",
  "vocabulary",
  "analytics",
  "annotations"
];
function GN(n) {
  let a = String(n || "").split("?")[0];
  return (a.startsWith("/semantic-os/api/") || a === "/semantic-os/api") && (a = a.slice(12)), a === "/api" ? "" : a.startsWith("/api/") ? a.slice(5) : null;
}
function td(n) {
  const a = GN(n);
  return a == null ? !1 : a ? kN.some((o) => a === o || a.startsWith(o + "/")) : !0;
}
function Of(n) {
  try {
    const a = new URL(n, window.location.origin);
    if (td(a.pathname) && a.pathname.startsWith("/api/"))
      return a.pathname = "/semantic-os" + a.pathname, a.toString();
  } catch {
  }
  return td(n.split("?")[0]) && n.startsWith("/api/") ? "/semantic-os" + n : n;
}
function Y0(n) {
  try {
    if (typeof n == "string") return new URL(n, window.location.origin).pathname;
    if (n instanceof URL) return n.pathname;
    if (n instanceof Request) return new URL(n.url, window.location.origin).pathname;
  } catch {
  }
  return "";
}
function ne(n, a) {
  return new Response(JSON.stringify(a), {
    status: n,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
let ZN = null;
function KN(n, a, o) {
  try {
    const s = JSON.parse(n);
    return a.reasonMode && (s.mode = a.reasonMode()), s.apply_to_graph = !!o, ZN = {
      facts: s.facts,
      rules: s.rules,
      mode: s.mode,
      apply_to_graph: s.apply_to_graph
    }, JSON.stringify(s);
  } catch {
    return n;
  }
}
function $N(n) {
  return n.get("x-dsh-reason-write") === "1";
}
function JN(n) {
  if (!n || typeof n != "object") return !1;
  const a = n;
  if (typeof a.node_count == "number") return a.node_count > 0;
  if (typeof a.nodes == "number") return a.nodes > 0;
  const o = a.nodes ?? a.items;
  return Array.isArray(n) ? n.length > 0 : Array.isArray(o) ? o.length > 0 : !1;
}
async function FN(n, a, o) {
  const s = o.body;
  let u = null;
  if (typeof FormData < "u" && s instanceof FormData) {
    const v = s.get("file");
    v instanceof File && (u = v);
  }
  if (!u) return ne(400, { detail: "只认 json 或 csv。" });
  const f = u.name || "", d = f.toLowerCase().split(".").pop();
  if (d !== "json" && d !== "csv")
    return ne(400, { detail: "只认 json 或 csv。" });
  const h = await u.text();
  let p = !1;
  try {
    const b = await (await n(`/semantic-os/nodes?cwd=${encodeURIComponent(a)}`, {
      headers: { "x-dsh-cwd": a }
    })).json().catch(() => null);
    p = JN(b);
  } catch {
    p = !1;
  }
  if (p && !window.confirm("图里已有内容。导入会覆盖当前图，确定吗？"))
    return ne(400, { detail: "已取消导入。" });
  const g = await n("/semantic-os/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dsh-cwd": a },
    body: JSON.stringify({ cwd: a, filename: f, data: h, confirm: !0 })
  });
  if (g.ok) return g;
  const m = await g.json().catch(() => ({}));
  return ne(g.status || 400, {
    ...m,
    detail: "导入失败，已恢复上一份图。"
  });
}
async function IN(n, a, o) {
  let s = "json";
  try {
    if (typeof o.body == "string") {
      const h = JSON.parse(o.body);
      s = String(h.format || "json").toLowerCase();
    }
  } catch {
  }
  if (s !== "json" && s !== "csv")
    return ne(400, { detail: "只认 json 或 csv。" });
  const u = window.prompt("绝对路径", "");
  if (u == null) return ne(400, { detail: "已取消导出。" });
  const f = String(u).trim(), d = async (h) => {
    const p = await n("/semantic-os/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dsh-cwd": a },
      body: JSON.stringify({
        cwd: a,
        format: s,
        dest: f || void 0,
        confirm: h || void 0
      })
    }), g = await p.json().catch(() => ({}));
    if (g && g.error === "OUTSIDE_CWD")
      return window.confirm("导出路径在当前目录外。确定继续？") ? d(!0) : ne(400, { detail: "已取消导出。" });
    if (g && g.error === "REJECT_FORMAT")
      return ne(400, { detail: "只认 json 或 csv。" });
    if (!p.ok || g && g.ok === !1)
      return ne(p.status || 400, { detail: g.detail || "只认 json 或 csv。" });
    if (!f && g.data != null) {
      const m = typeof g.data == "string" ? g.data : JSON.stringify(g.data, null, 2);
      return new Response(m, {
        status: 200,
        headers: {
          "content-type": s === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="graph.${s}"`
        }
      });
    }
    return ne(200, g);
  };
  return d(!1);
}
async function WN(n, a, o) {
  if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？"))
    return ne(400, { detail: "已取消合并。" });
  const s = await n(a, o);
  if (s.ok) return s;
  const u = await s.json().catch(() => ({}));
  return ne(s.status || 400, {
    ...u,
    detail: "合并没写成。"
  });
}
function ed(n) {
  return /\/api\/ontology\/shacl\//.test(n) ? "规则没检查成。" : /\/api\/ontology\/registry/.test(n) ? "词表列表没读成。" : /\/api\/provenance/.test(n) ? "血缘没读成。" : "";
}
function PN(n) {
  return typeof n == "string" && /[\u4e00-\u9fff]/.test(n);
}
async function V0(n, a) {
  const o = ed(a);
  if (!o || n.ok) return n;
  const s = await n.json().catch(() => ({})), u = s && typeof s == "object" ? s : {}, f = PN(u.detail) ? u.detail : o;
  return ne(n.status || 400, { ...u, detail: f });
}
function tT(n) {
  if (!n || typeof n != "object") return n;
  const a = n;
  if (Array.isArray(a.nodes)) {
    const o = a.nodes.filter((s) => !_o(s)).map((s) => mr(s));
    return {
      ...a,
      nodes: o,
      ...typeof a.count == "number" ? { count: o.length } : {},
      ...typeof a.total == "number" ? { total: o.length } : {},
      ...typeof a.node_count == "number" ? { node_count: o.length } : {}
    };
  }
  return Array.isArray(a.results) ? {
    ...a,
    results: a.results.filter((o) => {
      if (!o || typeof o != "object") return !1;
      const u = o.node || o;
      return !_o(u);
    }).map((o) => {
      if (!o || typeof o != "object") return o;
      const s = o;
      return s.node ? { ...s, node: mr(s.node) } : o;
    })
  } : a.id || a.content || a.properties ? mr(a) : n;
}
async function eT(n, a, o) {
  const s = await n(a, o);
  if (!s.ok) return s;
  const u = await s.json().catch(() => null);
  return ne(s.status, tT(u));
}
async function nT(n, a, o, s) {
  let u = "", f = 8;
  try {
    if (typeof s.body == "string") {
      const m = JSON.parse(s.body);
      u = String(m.query || m.q || "").trim(), f = Number(m.limit) || 8;
    }
  } catch {
  }
  const h = await (await n("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": a }
  })).json().catch(() => null), g = (h && typeof h == "object" && Array.isArray(h.nodes) ? h.nodes : []).filter((m) => !_o(m));
  return ne(200, { results: XN(g, u, f) });
}
async function iT(n, a) {
  const o = await n("/semantic-os/api/temporal/bounds", {
    headers: { "x-dsh-cwd": a }
  });
  if (!o.ok)
    return ne(200, { min: null, max: null, count: 0, empty: !0 });
  const s = await o.json().catch(() => null);
  return ne(200, s && typeof s == "object" ? s : { min: null, max: null, count: 0, empty: !0 });
}
async function aT(n, a, o, s) {
  const u = await n(o, s);
  if (!u.ok) return u;
  const f = await u.json().catch(() => null);
  if (!f || typeof f != "object") return ne(u.status, f);
  const d = f, h = Array.isArray(d.active_node_ids) ? d.active_node_ids.map((S) => String(S)) : [], g = await (await n("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": a }
  })).json().catch(() => null), m = g && typeof g == "object" && Array.isArray(g.nodes) ? g.nodes : [], v = new Set(
    m.filter((S) => _o(S)).map((S) => String(S.id || "")).filter(Boolean)
  ), b = h.filter((S) => !v.has(S));
  return ne(u.status, {
    ...d,
    active_node_ids: b,
    active_node_count: b.length
  });
}
const Fa = [];
function lT(n, a = {}) {
  const o = String(n || ""), s = window.fetch.bind(window);
  return Fa.push(s), window.fetch = (u, f) => {
    const d = Y0(u);
    if (!td(d)) return s(u, f);
    const h = od() || o;
    let p = u, g = { ...f || {} };
    typeof u == "string" ? p = Of(u) : u instanceof URL ? p = Of(u.toString()) : u instanceof Request && (p = new Request(Of(u.url), u));
    const m = new Headers();try { const __h=g.headers; const __ct=__h&&(__h.get?__h.get("content-type"):(__h["content-type"]||__h["Content-Type"]));if(__ct) m.set("content-type", String(__ct)); } catch {}const v = !1;
    if (h && v ? m.set("x-dsh-cwd", h) : m.delete("x-dsh-cwd"), g.headers = m, h && !v) {
      const _ = (C) => /[?&]cwd=/.test(C) ? C : C + (C.includes("?") ? "&" : "?") + "cwd=" + encodeURIComponent(h);
      typeof p == "string" ? p = _(p) : p instanceof URL ? p.searchParams.get("cwd") || p.searchParams.set("cwd", h) : p instanceof Request && (p = new Request(_(p.url), p));
    }
    const b = Y0(p), S = String(g.method || (p instanceof Request ? p.method : "GET")).toUpperCase();
    if (S === "POST" && b.endsWith("/api/reason") && typeof g.body == "string") {
      const _ = $N(m);
      return g.body = KN(g.body, a, _), s(p, g).then(async (D) => {
        const z = await D.clone().json().catch(() => ({}));
        try {
          if (!D.ok)
            return window.dispatchEvent(new CustomEvent("dsh-reason-failed", { detail: z })), D;
          window.dispatchEvent(new CustomEvent(_ ? "dsh-reason-applied" : "dsh-reason-previewed", {
            detail: z
          }));
        } catch {
        }
        return D;
      });
    }
    const E = d.match(/\/api\/decisions\/([^/]+)\/chain$/);
    if (E)
      try {
        window.dispatchEvent(new CustomEvent("dsh-decision-selected", {
          detail: { id: decodeURIComponent(E[1]) }
        }));
      } catch {
      }
    if (a.ioLock && S === "POST" && /\/api\/import\/?$/.test(d))
      return FN(s, h, g);
    if (a.ioLock && S === "POST" && /\/api\/export\/?$/.test(d))
      return IN(s, h, g);
    if (a.mergeConfirm && S === "POST" && /\/api\/enrich\/merge\/?$/.test(d))
      return WN(s, p, g);
    if (S === "GET" && /\/api\/graph\/nodes\/?$/.test(d))
      return eT(s, p, g);
    if (S === "GET" && /\/api\/temporal\/bounds\/?$/.test(d))
      return iT(s, h);
    if (S === "GET" && /\/api\/temporal\/snapshot\/?$/.test(d))
      return aT(s, h, p, g);
    if (S === "POST" && /\/api\/graph\/search\/?$/.test(d))
      return nT(s, h, p, g);
    const A = s(p, g).catch((_) => {
      const C = ed(d);
      if (C) return ne(502, { detail: C });
      throw _;
    });
    return S === "GET" && /\/api\/decisions\/?$/.test(d) ? A.then(async (_) => _.status !== 422 ? V0(_, d) : new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" }
    })) : ed(d) ? A.then((_) => V0(_, d)) : A;
  }, () => {
    const u = Fa.lastIndexOf(s);
    u >= 0 && Fa.splice(u, 1), window.fetch = Fa.length ? Fa[Fa.length - 1] : s;
  };
}
const lo = {
  "Search command, node, or concept": "搜索命令、节点或概念",
  Search: "搜索",
  "Search graph nodes": "搜索图节点",
  "Search for the current query": "搜索当前查询",
  "Full Graph": "全图",
  "Grouped View": "分组视图",
  Focused: "聚焦",
  Camera: "镜头",
  Layout: "布局",
  Local: "局部",
  Distance: "距离",
  Analysis: "分析",
  Utility: "工具",
  "Zoom In": "放大",
  "Zoom Out": "缩小",
  Fit: "适应",
  "Fit view": "适应视图",
  Pause: "暂停",
  Run: "运行",
  Reload: "重新加载",
  Collapse: "收起",
  Expand: "展开",
  "Ego Mode": "只看这点周围",
  Heatmap: "热力",
  Structural: "结构",
  Semantic: "语义",
  Relationship: "关系",
  Close: "关闭",
  "Loading inspector…": "正在加载检查器…",
  "Loading timeline…": "正在加载时间线…",
  "Distance Intelligence": "离这点有多远",
  Anchor: "锚点",
  "Node visual key": "节点图例",
  Biomolecule: "分子",
  Condition: "条件",
  Compound: "化合物",
  Process: "过程",
  Community: "社群",
  Other: "其他",
  "Graph ready": "图谱就绪",
  "Loading nodes": "正在加载节点",
  "Loading relationships": "正在加载关系",
  "Preparing graph session": "正在准备图谱会话",
  "Computing node styling": "正在计算节点样式",
  "Hydrating graph scene": "正在画图",
  "Stabilizing layout": "正在稳定布局",
  Selection: "选中",
  Actions: "操作",
  Properties: "属性",
  "Trace Path": "追踪路径",
  Provenance: "血缘",
  Neighbors: "邻居",
  Temporal: "时序",
  Effects: "图分析",
  Ready: "就绪",
  On: "开",
  Off: "关",
  "Play Evolution": "播放演化",
  "Pause Evolution": "暂停演化",
  "Temporal Scrubber": "按时间拖",
  "Graph view mode": "图谱视图模式",
  "Return to the full graph context": "回到全图",
  "Compress dense structure into detected communities": "把密集结构压成检测到的社群",
  "Inspect the selected node in a focused local graph": "在聚焦局部图里查看选中节点",
  "Zoom in (or scroll up on the canvas)": "放大（或在画布上向上滚）",
  "Zoom out (or scroll down on the canvas)": "缩小（或在画布上向下滚）",
  "Reset the camera to fit the whole graph": "重置镜头以看全图",
  "Toggle the layout worker": "开停布局计算",
  "Reload the graph data": "重新加载图数据",
  "Reload graph data": "重新加载图数据",
  "Hide lower-priority fanout around the selected node": "收起选中节点周围的次要分支",
  "Restore the collapsed local neighborhood": "恢复收起的局部邻域",
  " nodes · ": " 个节点 · ",
  " edges": " 条边",
  " active": " 个活动",
  "Forward Chaining": "往前推",
  "Inference Engine": "推理",
  Datalog: "逻辑规则",
  "Logic Rules": "逻辑规则",
  Rete: "模式匹配",
  "Pattern Matching": "模式匹配",
  "Session log": "本次记录",
  Ancestor: "长辈",
  Grandparent: "隔一代",
  "Manager line": "谁管谁",
  "Quick Templates": "快捷模板",
  "Drug Candidate": "可能成药的品种",
  "Gene → Disease": "基因和疾病",
  "Pathway Activation": "通路被点亮",
  Facts: "事实",
  Rules: "规则",
  "One fact per line using ": "每行一条事实，写成 ",
  "Write inferred facts to graph": "把推断事实写入图",
  "Inferred binary facts are added as edges": "二元推断会加成边。先预览，确认写入才进图。",
  "Run Reasoning": "运行推理",
  "Running…": "运行中…",
  "Reset to defaults": "恢复默认",
  "Inference Results": "推理结果",
  " rules fired": " 条规则触发",
  " edges added": " 条边加入",
  "graph updated": "图已更新",
  "preview only": "仅预览",
  "Reasoning complete": "推理完成",
  "No new facts were inferred from the current rule set and facts.": "当前事实和规则没有推出新事实。",
  "Ready to reason": "可以开始推理",
  "Enter facts and rules on the left, then click Run Reasoning to see inferred statements here.": "左边填事实和规则，点运行推理，结果在这里。",
  "Reasoning failed": "推理没跑成。",
  Decisions: "决策",
  "Filter by ID, category, outcome…": "按编号、类别、结果筛选",
  "No decisions": "还没有决策",
  "No decisions available in the graph.": "图里还没有决策。",
  "No matches": "没有匹配",
  "Adjust your filter.": "改一下筛选条件。",
  "Decision Record": "决策记录",
  "Causal Chain": "因果链",
  "No chain steps": "没有因果步骤",
  "No causal chain steps were found for this decision.": "这条决策没有因果链。",
  "No decision selected": "还没选决策",
  "Select a decision from the list to inspect its causal chain and metadata.": "从列表选一条，看因果链和详情。",
  "Templates:": "模板：",
  "All triples": "全部三元组",
  "Node types": "节点类型",
  "Outgoing edges": "出边",
  "Path between": "两点之间",
  "Copy query": "复制查询",
  "Copied!": "已复制",
  Copy: "复制",
  "Run Query": "运行查询",
  Results: "结果",
  "Export CSV": "导出 CSV",
  "No results": "没有结果",
  "The query returned 0 rows. Try a broader query or check your data.": "查询返回 0 行。换一条或检查数据。",
  "Run a query": "运行查询",
  "Write SPARQL above or pick a template, then click Run Query to see results here.": "上面写 SPARQL 或选模板，点运行查询。",
  "Network error — could not reach the SPARQL endpoint.": "查询没跑成。",
  "Import & Export": "导入导出",
  "Import and Export": "导入导出",
  "Ingest new graph datasets or extract the current knowledge base.": "导入新数据集，或导出当前知识库。",
  "Import Entities & Relations": "导入实体与关系",
  "Export Graph Snapshot": "导出图谱快照",
  "Drag & drop or click to browse": "拖放或点击浏览",
  "click to replace": "点击替换",
  "Upload to Graph": "上传到图",
  "Uploading…": "上传中…",
  "Download Export": "下载导出",
  "Preparing…": "准备中…",
  "What's included": "会带上什么",
  Format: "格式",
  "Entity Resolution": "合并同一个",
  "Detect and merge duplicate entities in the knowledge graph": "检测并合并图里的重复实体。",
  "Similarity Threshold": "有多像才算同一个",
  "Run Dedup Scan": "运行去重扫描",
  "Scanning…": "扫描中…",
  Merge: "合并",
  Dismiss: "忽略",
  "No flagged pairs": "没有标记对",
  "Primary (keep)": "留下这个",
  "Duplicate (remove)": "去掉重复的",
  "Merge History": "合并历史",
  "More results (0.50)": "更多结果（0.50）",
  "Fewer, higher confidence (0.99)": "更少、更有把握（0.99）",
  "Set a similarity threshold and run a dedup scan to detect potential duplicates.": "设相似度阈值，跑一遍去重扫描。",
  "Ontology Summary": "本体摘要",
  "KG Overview": "图谱总览",
  "PROV-O Lineage": "血缘",
  Registry: "词表列表",
  Editor: "编辑",
  Versions: "版本",
  Alignments: "对上号",
  Health: "质量",
  SHACL: "规则检查",
  "No vocabulary schemes loaded": "没有分类表",
  "No SKOS concept schemes found": "没有分类表",
  "No concept selected": "还没选概念",
  "Click a concept in the tree to view its properties.": "在树里点一个概念看属性。",
  "Loading schemes…": "正在加载方案…",
  "Loading hierarchy…": "正在加载层级…",
  "Loading concepts…": "正在加载概念…",
  "No schemes found. Import a .ttl or .rdf file below.": "还没有分类表。需要的话在知识分类里加载一份。",
  "Concept Detail": "概念详情",
  "SKOS Concept": "概念",
  "Alternative Labels": "别名",
  "Narrower Concepts": "更细的分类",
  "Open Full Browser": "打开完整浏览器",
  "Failed to fetch vocabularies": "词表没读成。",
  "Failed to fetch hierarchy": "层级没读成。",
  "Failed to import vocabulary": "词表没导入成。",
  "Scan failed": "扫描没跑成。",
  "Merge failed": "合并没写成。",
  "Export ready — ": "导出已就绪 — ",
  "Imported ": "已导入 ",
  "Full graph snapshot: all node properties, edge weights, entity metadata and semantic groups in a standardized JSON payload.": "完整图快照：节点属性、边权重和元数据，JSON。",
  "Flattened CSV: nodes and edges as rows. Complex nested properties are stringified. Best for spreadsheet analysis.": "扁平 CSV：节点和边各成行。适合表格分析。",
  "Something went wrong in this view.": "这一页出错了。",
  "Try Again": "再试",
  "Ontology & Vocabulary": "词表 / 本体",
  "Import Vocabulary": "导入词表",
  "Drop here…": "放到这里…",
  "No vocabularies loaded": "没有分类表",
  "Select a scheme to browse concepts.": "请选择一个方案浏览概念。",
  "No concepts found in this scheme.": "这个方案里没有概念。",
  "rel. types": "种关系",
  "graph density": "图密度",
  "Node Type Breakdown": "节点类型分布",
  "Edge Type Breakdown": "边类型分布",
  "NODE TYPE BREAKDOWN": "节点类型分布",
  "EDGE TYPE BREAKDOWN": "边类型分布",
  NODES: "节点",
  EDGES: "边",
  DENSITY: "密度",
  "Node/edge counts, type distributions, and top connected nodes": "节点/边数量、类型分布、连接最多的节点",
  "Top Connected Nodes (by degree)": "连接最多的节点（按度数）",
  "No data — load the graph first.": "还没有数据，先加载图。",
  "PROV-O Lineage Viewer": "血缘",
  "Enter Node ID…": "输入节点编号",
  "Enter Node ID...": "输入节点编号",
  "Enter Node ID": "输入节点编号",
  "Export JSON": "导出 JSON",
  "Export MD": "导出文稿",
  "Enter a Node ID in the toolbar above and click Trace to view its W3C PROV-O lineage diagram.": "上面填节点编号，点追踪，看这条节点的血缘。",
  "Load Ontology": "加载词表",
  "Entity Search": "搜实体",
  "Ontology Hub": "词表",
  "Clear all": "全部清除",
  "Open exploration effects controls": "打开图分析：最短路、社区、中心度",
  "Directed Pathfinding": "最短路",
  "Compare the traced path against a strict local directed shortest path.": "把追踪路径和局部有向最短路对比。",
  "Community Regions": "社区",
  "Detect stable Louvain communities for orientation and scene grouping.": "用 Louvain 检测稳定社区，方便分组。",
  "Centrality Ranking": "谁连得最多",
  "Rank the strongest graph anchors for labels, regions, and navigation.": "按中心度排出最强锚点，用于标签和导航。",
  "Path Pulse": "路径脉冲",
  "Animated pulse on the active selected path.": "在当前选中路径上播放脉冲。",
  "Path Flow": "路径流",
  "Directional flow accents along the active selected path.": "沿当前选中路径显示方向流动。",
  "Neighborhood Lens": "看周围",
  "Local emphasis around the hovered or selected node.": "突出悬停或选中节点的局部邻域。",
  "Temporal Emphasis": "时间强调",
  "Subtle glow around temporally relevant nodes in the active time window.": "给当前时间窗里相关的节点加微光。",
  "Semantic Regions": "语义区",
  "Quiet semantic hulls around the strongest visible topic clusters.": "给最明显的主题簇画淡语义轮廓。",
  Contours: "轮廓",
  "Low-contrast density halos around the strongest visible anchors.": "给最明显的锚点加低对比密度光晕。",
  "Regions Summary": "区域摘要",
  "Keep the regions and signals summary visible in the Effects panel.": "在图分析面板里保留区域和信号摘要。",
  "Exploration effects": "探索效果",
  "Scene effects": "场景效果",
  "Graph intelligence": "图上谁重要",
  "Regions and signals": "区域与信号",
  "Waiting for graph runtime": "正在等待图运行时",
  "Waiting for centrality ranking": "正在等中心度排名",
  "Waiting for community summaries": "正在等社区摘要",
  "Waiting for a traced path": "正在等一条追踪路径",
  "Panel enabled": "面板已开",
  "Regions and intelligence summaries will populate when graph analytics are ready.": "图分析就绪后会填区域和智能摘要。",
  "Semantic regions": "语义区",
  "Community anchors": "社区锚点",
  "Centrality leaders": "中心度前列",
  "Directed pathfinding": "最短路",
  "Fallback semantic legend": "备用语义图例",
  "Local directed path ready": "局部有向路径已就绪",
  "Waiting for path context": "等待路径上下文",
  "Disabled by toggle": "开关已关",
  "Layout is still settling": "布局还在稳定",
  "No active path": "还没有活动路径",
  "Disabled by zoom tier": "当前缩放层级不可用",
  "Path is off-screen": "路径不在画面里",
  "No focal node": "还没有焦点节点",
  "No temporal focus time": "还没有时间焦点",
  "Waiting for semantic region summaries": "正在等语义区摘要",
  "Trace a path to compare it against local strict directed shortest pathfinding.": "先追踪一条路径，再和局部有向最短路对比。",
  "Active path endpoints are not available in the current graph view.": "当前视图里没有活动路径的端点。",
  "Directed pathfinding failed for the current graph snapshot.": "当前图快照上最短路没算成。",
  "No strict directed shortest path found in the current graph view.": "当前视图里没有有向最短路。",
  "No visible communities in the current graph context.": "当前图上下文里没有可见社区。",
  "Community detection has not produced summaries yet.": "社区检测还没有摘要。",
  "Centrality ranking is waiting for graph data.": "中心度还在等图数据。",
  "No semantic regions are visible in the current graph context.": "当前图上下文里没有可见语义区。",
  "Ready (degree-biased while betweenness is bounded for large graphs).": "就绪（大图用度数近似，介数有上限）。",
  Neighborhood: "邻居",
  "Temporal Context": "时序",
  "Select a node to inspect its local neighborhood.": "先点图上一个点，再看它旁边连了谁。",
  "Current scrubber state": "当前时间",
  "CURRENT SCRUBBER STATE": "当前时间",
  Current: "现在",
  Bounds: "范围",
  "Active nodes": "活动节点",
  "No time selected": "还没选时间",
  "Toggle neighborhood panel": "开停邻居面板",
  "Toggle temporal context panel": "开停时序面板",
  "Versions & Change Proposals": "版本与变更提案",
  "Version History": "版本历史",
  "Change Proposals": "变更提案",
  "No versions found": "还没有版本",
  "No proposals found": "还没有提案",
  "Proposal Details": "提案详情",
  "Compare Versions": "对比版本",
  "Ontology URI": "词表地址",
  "Select ontology...": "选择词表…",
  "Active ontology": "当前词表",
  "Add Class": "加类",
  "Add Property": "加属性",
  "Add Individual": "加个体",
  "Add Restriction": "加限制",
  "Add Axiom": "加公理",
  "Auto Layout": "自动布局",
  Propose: "提交提案",
  Rename: "改名",
  "Property Details": "属性详情",
  "Class Details": "类详情",
  "Alignment Matrix": "对齐矩阵",
  "Cross-ontology mappings": "两套词表怎么对应",
  "Ontology Health": "本体健康度",
  "Quality and governance signals": "质量和治理信号",
  "Total health score": "总分",
  "Actionable issues": "要改的问题",
  "Fix in Editor": "在编辑器里改",
  "Export report": "导出报告",
  "Computing health dashboard...": "正在计算健康面板…",
  "Select an ontology to compute health signals.": "先选一份词表，再看质量。",
  "No actionable issues reported for this ontology.": "这份词表没什么要改的。",
  Completeness: "完整度",
  Consistency: "一致性",
  "SHACL Conformance": "规则符合度",
  "Alignment Coverage": "对齐覆盖",
  Documentation: "文档质量",
  WARNING: "警告",
  UNAVAILABLE: "不可用",
  CRITICAL: "严重",
  "0/1 labeled, 0/1 documented, 0/1 defined.": "0/1 有标签，0/1 有说明，0/1 有定义。",
  "0 properties are missing explicit ranges.": "没有属性缺取值范围。",
  "Live SHACL validation is available in SHACL Studio when optional validation dependencies are installed.": "装了检查依赖后，才能在规则检查里做实时校验。",
  "0/1 classes or properties have an alignment.": "0/1 个类或属性有对齐。",
  "Measures comments plus source/version metadata.": "看注释，以及出处/版本信息。",
  "SHACL Studio": "规则检查",
  "Generate, edit, and validate shapes": "生成、改和检查填写规则",
  "Create strict SHACL Turtle from ontology structure, inspect shape targets, run validation, and jump from violations back into the graph.": "从词表结构生成填写规则，检查有没有填错，违规可以跳回图。",
  "Shape library": "规则形状",
  "No shapes generated yet.": "没有规则形状",
  "0 shapes": "0 条规则形状",
  "Generate strict": "按结构生成规则",
  "Turtle shape editor": "规则编辑",
  "Validation report": "检查结果",
  "Generate or edit SHACL Turtle, then run validation.": "生成或改规则，再点检查。",
  "No validation violations returned.": "没有违规。",
  "Jump to Node": "跳到节点",
  "View all": "看全部",
  "Untargeted shapes": "未指定目标",
  "Failed to load ontology registry.": "词表列表没读成。",
  "Could not generate SHACL.": "规则没生成成。",
  "Could not validate SHACL.": "规则没检查成。",
  "Ontology not found in registry.": "词表里没有这份本体。",
  Document: "文档",
  entity: "实体",
  Entity: "实体",
  Validate: "检查",
  Ontology: "本体",
  OWL: "本体",
  SKOS: "分类",
  Trace: "追踪",
  "Loading workspace…": "正在打开工作台",
  "Loading workspace...": "正在打开工作台",
  "Search ontologies by name, URI, or namespace…": "按名称、地址搜词表",
  "Search ontologies by name, URI, or namespace...": "按名称、地址搜词表",
  "Search ontologies by name...": "按名称、地址搜词表",
  "No ontologies loaded yet": "没有分类表",
  "No ontologies loaded yet.": "没有分类表",
  "No ontologies loaded yet...": "没有分类表",
  "Target node ID": "目标点编号",
  "Trace Causal Path": "追踪因果路径",
  "Choose a target or click a candidate prediction to prepare a path trace.": "填一个目标点，或点下面的候选关系，再追踪路径。",
  "Candidate Links": "可能的连线",
  "CANDIDATE LINKS": "可能的连线",
  "Source Attribution": "出处",
  "SOURCE ATTRIBUTION": "出处",
  "Run Link Prediction": "找可能的连线",
  "Provenance JSON": "出处 JSON",
  "Provenance MD": "出处文稿",
  "Computing candidate links…": "正在找可能的连线…",
  "Computing candidate links...": "正在找可能的连线…",
  "Run link prediction to surface likely next-hop relationships.": "点上面「找可能的连线」，会列出可能的下一步关系。",
  "No explicit attribution metadata was found on this node.": "这个点没有出处说明。",
  "No additional properties are attached to this node.": "这个点没有更多属性。",
  "Optional candidate type filter, e.g. disease": "可选：按关系类型筛选",
  "Optional candidate type filter": "可选：按关系类型筛选",
  "direct neighbors highlighted": "个直接邻居已标出",
  "direct neighbors in the full graph": "个直接邻居在全图中",
  "Collapse Neighborhood": "收起邻居",
  "Expand Neighborhood": "展开邻居",
  "No direct neighbors are available for this node.": "这个点没有直接邻居。",
  "No path found between the selected nodes.": "这两个点之间没有路径。",
  "Search for a node or click one in the canvas to inspect its properties.": "搜一个点，或在图上点一下，看它的属性。",
  "Total weight:": "总权重：",
  "source fields": "个出处字段",
  "candidate links": "条可能的连线"
};
function oT(n) {
  let a = n;
  return a = a.replace(/(\d[\d,]*)\s+nodes\s+[·•]\s+(\d[\d,]*)\s+edges/ig, "$1 个点 · $2 条边"), a = a.replace(/\b(\d[\d,]*)\s+shapes\b/ig, "$1 条规则"), a = a.replace(/\b(\d[\d,]*)\s+constraints\b/ig, "$1 条约束"), a = a.replace(/(\d[\d,]*)\s+direct neighbors highlighted/ig, "$1 个直接邻居已标出"), a = a.replace(/(\d[\d,]*)\s+direct neighbors in the full graph/ig, "全图里有 $1 个直接邻居"), a = a.replace(/(\d[\d,]*)\s+source fields/ig, "$1 个出处字段"), a = a.replace(/(\d[\d,]*)\s+candidate links/ig, "$1 条可能的连线"), a = a.replace(/\b(\d[\d,]*)\s+hops\b/ig, "$1 跳"), a === n ? null : a;
}
function Q0(n) {
  return n.replace(/\s+/g, " ").trim();
}
function sT(n) {
  return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function X0(n) {
  const a = n.trim();
  if (!a) return n;
  const o = oT(a);
  if (o) return n.replace(a, o);
  if (lo[a]) return n.replace(a, lo[a]);
  const s = Q0(a);
  if (lo[s]) return n.replace(a, lo[s]);
  let u = s;
  const f = Object.entries(lo).sort((d, h) => h[0].length - d[0].length);
  for (const [d, h] of f) {
    const p = Q0(d);
    if (!(!p.includes(" ") && /^[A-Za-z]/.test(p) && p.length < 16) && !(p.length < 6)) {
      if (/^[A-Za-z]/.test(p)) {
        const g = new RegExp(`(?<![A-Za-z])${sT(p)}(?![A-Za-z])`, "g");
        u = u.replace(g, h);
        continue;
      }
      u.includes(p) && (u = u.split(p).join(h));
    }
  }
  return u === s ? n : n.replace(a, u);
}
function k0(n) {
  for (; n; ) {
    const a = n.tagName;
    if (a === "TEXTAREA" || a === "PRE" || a === "CODE" || a === "SCRIPT" || a === "STYLE") return !0;
    const o = typeof n.className == "string" ? n.className : "";
    if (o.includes("monaco-editor") || o.includes("view-lines") || o.includes("mtk")) return !0;
    n = n.parentElement;
  }
  return !1;
}
function ro(n) {
  if (n.nodeType === Node.TEXT_NODE) {
    if (k0(n.parentElement)) return;
    const o = X0(n.nodeValue || "");
    o !== n.nodeValue && (n.nodeValue = o);
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const a = n;
  if (!k0(a)) {
    for (const o of ["placeholder", "title", "aria-label"]) {
      const s = a.getAttribute(o);
      if (!s) continue;
      const u = X0(s);
      u !== s && a.setAttribute(o, u);
    }
    a.childNodes.forEach(ro);
  }
}
function rT(n) {
  ro(n);
  const a = new MutationObserver((o) => {
    for (const s of o)
      s.addedNodes.forEach(ro), s.type === "characterData" && s.target && ro(s.target), s.type === "attributes" && s.target && ro(s.target);
  });
  return a.observe(n, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["placeholder", "title", "aria-label"] }), () => a.disconnect();
}
function uT() {
  return new Dx({
    defaultOptions: {
      queries: { refetchOnWindowFocus: !1, retry: 1 }
    }
  });
}
function cT() {
  const [n, a] = F.useState("kg");
  return /* @__PURE__ */ M.jsxs("div", { className: "dsh-admin-frame workspace-shell", children: [
    /* @__PURE__ */ M.jsxs("div", { className: "dsh-lock-bar", children: [
      /* @__PURE__ */ M.jsx("button", { type: "button", className: "dsh-mode-btn" + (n === "kg" ? " is-on" : ""), onClick: () => a("kg"), children: "图谱总览" }),
      /* @__PURE__ */ M.jsx("button", { type: "button", className: "dsh-mode-btn" + (n === "lineage" ? " is-on" : ""), onClick: () => a("lineage"), children: "血缘" }),
      /* @__PURE__ */ M.jsx("button", { type: "button", className: "dsh-mode-btn" + (n === "ontology" ? " is-on" : ""), onClick: () => a("ontology"), children: "本体摘要" })
    ] }),
    /* @__PURE__ */ M.jsx("div", { className: "dsh-admin-bench", children: /* @__PURE__ */ M.jsxs(BN, { children: [
      n === "kg" ? /* @__PURE__ */ M.jsx(hS, {}) : null,
      n === "lineage" ? /* @__PURE__ */ M.jsx(jN, {}) : null,
      n === "ontology" ? /* @__PURE__ */ M.jsx(bS, {}) : null
    ] }) })
  ] });
}
function fT(n, a = {}) {
  const o = String(a.cwd || "");
  n.classList.add("dsh-admin-host", "dsh-ws-host"), LN();
  const s = uT(), u = lT(o), f = rT(n), d = sx.createRoot(n);
  return d.render(
    /* @__PURE__ */ M.jsx(Hx, { client: s, children: /* @__PURE__ */ M.jsx(cT, {}) })
  ), () => {
    f(), u(), d.unmount(), s.clear();
  };
}
const dT = { mount: fT };
export {
  dT as default,
  fT as mount
};
