function Os(i) {
  return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
}
var es = { exports: {} }, ai = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var wd;
function Iv() {
  if (wd) return ai;
  wd = 1;
  var i = /* @__PURE__ */ Symbol.for("react.transitional.element"), c = /* @__PURE__ */ Symbol.for("react.fragment");
  function r(s, p, g) {
    var A = null;
    if (g !== void 0 && (A = "" + g), p.key !== void 0 && (A = "" + p.key), "key" in p) {
      g = {};
      for (var S in p)
        S !== "key" && (g[S] = p[S]);
    } else g = p;
    return p = g.ref, {
      $$typeof: i,
      type: s,
      key: A,
      ref: p !== void 0 ? p : null,
      props: g
    };
  }
  return ai.Fragment = c, ai.jsx = r, ai.jsxs = r, ai;
}
var _d;
function Pv() {
  return _d || (_d = 1, es.exports = Iv()), es.exports;
}
var q = Pv(), as = { exports: {} }, ni = {}, ns = { exports: {} }, ls = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var jd;
function ty() {
  return jd || (jd = 1, (function(i) {
    function c(D, R) {
      var Z = D.length;
      D.push(R);
      t: for (; 0 < Z; ) {
        var $ = Z - 1 >>> 1, vt = D[$];
        if (0 < p(vt, R))
          D[$] = R, D[Z] = vt, Z = $;
        else break t;
      }
    }
    function r(D) {
      return D.length === 0 ? null : D[0];
    }
    function s(D) {
      if (D.length === 0) return null;
      var R = D[0], Z = D.pop();
      if (Z !== R) {
        D[0] = Z;
        t: for (var $ = 0, vt = D.length, h = vt >>> 1; $ < h; ) {
          var _ = 2 * ($ + 1) - 1, N = D[_], B = _ + 1, F = D[B];
          if (0 > p(N, Z))
            B < vt && 0 > p(F, N) ? (D[$] = F, D[B] = Z, $ = B) : (D[$] = N, D[_] = Z, $ = _);
          else if (B < vt && 0 > p(F, Z))
            D[$] = F, D[B] = Z, $ = B;
          else break t;
        }
      }
      return R;
    }
    function p(D, R) {
      var Z = D.sortIndex - R.sortIndex;
      return Z !== 0 ? Z : D.id - R.id;
    }
    if (i.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var g = performance;
      i.unstable_now = function() {
        return g.now();
      };
    } else {
      var A = Date, S = A.now();
      i.unstable_now = function() {
        return A.now() - S;
      };
    }
    var T = [], v = [], C = 1, M = null, Q = 3, k = !1, W = !1, J = !1, H = !1, V = typeof setTimeout == "function" ? setTimeout : null, ft = typeof clearTimeout == "function" ? clearTimeout : null, lt = typeof setImmediate < "u" ? setImmediate : null;
    function pt(D) {
      for (var R = r(v); R !== null; ) {
        if (R.callback === null) s(v);
        else if (R.startTime <= D)
          s(v), R.sortIndex = R.expirationTime, c(T, R);
        else break;
        R = r(v);
      }
    }
    function Ut(D) {
      if (J = !1, pt(D), !W)
        if (r(T) !== null)
          W = !0, Bt || (Bt = !0, Kt());
        else {
          var R = r(v);
          R !== null && jt(Ut, R.startTime - D);
        }
    }
    var Bt = !1, tt = -1, Vt = 5, le = -1;
    function De() {
      return H ? !0 : !(i.unstable_now() - le < Vt);
    }
    function ye() {
      if (H = !1, Bt) {
        var D = i.unstable_now();
        le = D;
        var R = !0;
        try {
          t: {
            W = !1, J && (J = !1, ft(tt), tt = -1), k = !0;
            var Z = Q;
            try {
              e: {
                for (pt(D), M = r(T); M !== null && !(M.expirationTime > D && De()); ) {
                  var $ = M.callback;
                  if (typeof $ == "function") {
                    M.callback = null, Q = M.priorityLevel;
                    var vt = $(
                      M.expirationTime <= D
                    );
                    if (D = i.unstable_now(), typeof vt == "function") {
                      M.callback = vt, pt(D), R = !0;
                      break e;
                    }
                    M === r(T) && s(T), pt(D);
                  } else s(T);
                  M = r(T);
                }
                if (M !== null) R = !0;
                else {
                  var h = r(v);
                  h !== null && jt(
                    Ut,
                    h.startTime - D
                  ), R = !1;
                }
              }
              break t;
            } finally {
              M = null, Q = Z, k = !1;
            }
            R = void 0;
          }
        } finally {
          R ? Kt() : Bt = !1;
        }
      }
    }
    var Kt;
    if (typeof lt == "function")
      Kt = function() {
        lt(ye);
      };
    else if (typeof MessageChannel < "u") {
      var we = new MessageChannel(), At = we.port2;
      we.port1.onmessage = ye, Kt = function() {
        At.postMessage(null);
      };
    } else
      Kt = function() {
        V(ye, 0);
      };
    function jt(D, R) {
      tt = V(function() {
        D(i.unstable_now());
      }, R);
    }
    i.unstable_IdlePriority = 5, i.unstable_ImmediatePriority = 1, i.unstable_LowPriority = 4, i.unstable_NormalPriority = 3, i.unstable_Profiling = null, i.unstable_UserBlockingPriority = 2, i.unstable_cancelCallback = function(D) {
      D.callback = null;
    }, i.unstable_forceFrameRate = function(D) {
      0 > D || 125 < D ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : Vt = 0 < D ? Math.floor(1e3 / D) : 5;
    }, i.unstable_getCurrentPriorityLevel = function() {
      return Q;
    }, i.unstable_next = function(D) {
      switch (Q) {
        case 1:
        case 2:
        case 3:
          var R = 3;
          break;
        default:
          R = Q;
      }
      var Z = Q;
      Q = R;
      try {
        return D();
      } finally {
        Q = Z;
      }
    }, i.unstable_requestPaint = function() {
      H = !0;
    }, i.unstable_runWithPriority = function(D, R) {
      switch (D) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          D = 3;
      }
      var Z = Q;
      Q = D;
      try {
        return R();
      } finally {
        Q = Z;
      }
    }, i.unstable_scheduleCallback = function(D, R, Z) {
      var $ = i.unstable_now();
      switch (typeof Z == "object" && Z !== null ? (Z = Z.delay, Z = typeof Z == "number" && 0 < Z ? $ + Z : $) : Z = $, D) {
        case 1:
          var vt = -1;
          break;
        case 2:
          vt = 250;
          break;
        case 5:
          vt = 1073741823;
          break;
        case 4:
          vt = 1e4;
          break;
        default:
          vt = 5e3;
      }
      return vt = Z + vt, D = {
        id: C++,
        callback: R,
        priorityLevel: D,
        startTime: Z,
        expirationTime: vt,
        sortIndex: -1
      }, Z > $ ? (D.sortIndex = Z, c(v, D), r(T) === null && D === r(v) && (J ? (ft(tt), tt = -1) : J = !0, jt(Ut, Z - $))) : (D.sortIndex = vt, c(T, D), W || k || (W = !0, Bt || (Bt = !0, Kt()))), D;
    }, i.unstable_shouldYield = De, i.unstable_wrapCallback = function(D) {
      var R = Q;
      return function() {
        var Z = Q;
        Q = R;
        try {
          return D.apply(this, arguments);
        } finally {
          Q = Z;
        }
      };
    };
  })(ls)), ls;
}
var Cd;
function ey() {
  return Cd || (Cd = 1, ns.exports = ty()), ns.exports;
}
var is = { exports: {} }, P = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Md;
function ay() {
  if (Md) return P;
  Md = 1;
  var i = /* @__PURE__ */ Symbol.for("react.transitional.element"), c = /* @__PURE__ */ Symbol.for("react.portal"), r = /* @__PURE__ */ Symbol.for("react.fragment"), s = /* @__PURE__ */ Symbol.for("react.strict_mode"), p = /* @__PURE__ */ Symbol.for("react.profiler"), g = /* @__PURE__ */ Symbol.for("react.consumer"), A = /* @__PURE__ */ Symbol.for("react.context"), S = /* @__PURE__ */ Symbol.for("react.forward_ref"), T = /* @__PURE__ */ Symbol.for("react.suspense"), v = /* @__PURE__ */ Symbol.for("react.memo"), C = /* @__PURE__ */ Symbol.for("react.lazy"), M = /* @__PURE__ */ Symbol.for("react.activity"), Q = Symbol.iterator;
  function k(h) {
    return h === null || typeof h != "object" ? null : (h = Q && h[Q] || h["@@iterator"], typeof h == "function" ? h : null);
  }
  var W = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, J = Object.assign, H = {};
  function V(h, _, N) {
    this.props = h, this.context = _, this.refs = H, this.updater = N || W;
  }
  V.prototype.isReactComponent = {}, V.prototype.setState = function(h, _) {
    if (typeof h != "object" && typeof h != "function" && h != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, h, _, "setState");
  }, V.prototype.forceUpdate = function(h) {
    this.updater.enqueueForceUpdate(this, h, "forceUpdate");
  };
  function ft() {
  }
  ft.prototype = V.prototype;
  function lt(h, _, N) {
    this.props = h, this.context = _, this.refs = H, this.updater = N || W;
  }
  var pt = lt.prototype = new ft();
  pt.constructor = lt, J(pt, V.prototype), pt.isPureReactComponent = !0;
  var Ut = Array.isArray;
  function Bt() {
  }
  var tt = { H: null, A: null, T: null, S: null }, Vt = Object.prototype.hasOwnProperty;
  function le(h, _, N) {
    var B = N.ref;
    return {
      $$typeof: i,
      type: h,
      key: _,
      ref: B !== void 0 ? B : null,
      props: N
    };
  }
  function De(h, _) {
    return le(h.type, _, h.props);
  }
  function ye(h) {
    return typeof h == "object" && h !== null && h.$$typeof === i;
  }
  function Kt(h) {
    var _ = { "=": "=0", ":": "=2" };
    return "$" + h.replace(/[=:]/g, function(N) {
      return _[N];
    });
  }
  var we = /\/+/g;
  function At(h, _) {
    return typeof h == "object" && h !== null && h.key != null ? Kt("" + h.key) : _.toString(36);
  }
  function jt(h) {
    switch (h.status) {
      case "fulfilled":
        return h.value;
      case "rejected":
        throw h.reason;
      default:
        switch (typeof h.status == "string" ? h.then(Bt, Bt) : (h.status = "pending", h.then(
          function(_) {
            h.status === "pending" && (h.status = "fulfilled", h.value = _);
          },
          function(_) {
            h.status === "pending" && (h.status = "rejected", h.reason = _);
          }
        )), h.status) {
          case "fulfilled":
            return h.value;
          case "rejected":
            throw h.reason;
        }
    }
    throw h;
  }
  function D(h, _, N, B, F) {
    var nt = typeof h;
    (nt === "undefined" || nt === "boolean") && (h = null);
    var it = !1;
    if (h === null) it = !0;
    else
      switch (nt) {
        case "bigint":
        case "string":
        case "number":
          it = !0;
          break;
        case "object":
          switch (h.$$typeof) {
            case i:
            case c:
              it = !0;
              break;
            case C:
              return it = h._init, D(
                it(h._payload),
                _,
                N,
                B,
                F
              );
          }
      }
    if (it)
      return F = F(h), it = B === "" ? "." + At(h, 0) : B, Ut(F) ? (N = "", it != null && (N = it.replace(we, "$&/") + "/"), D(F, _, N, "", function(Sa) {
        return Sa;
      })) : F != null && (ye(F) && (F = De(
        F,
        N + (F.key == null || h && h.key === F.key ? "" : ("" + F.key).replace(
          we,
          "$&/"
        ) + "/") + it
      )), _.push(F)), 1;
    it = 0;
    var Jt = B === "" ? "." : B + ":";
    if (Ut(h))
      for (var Ct = 0; Ct < h.length; Ct++)
        B = h[Ct], nt = Jt + At(B, Ct), it += D(
          B,
          _,
          N,
          nt,
          F
        );
    else if (Ct = k(h), typeof Ct == "function")
      for (h = Ct.call(h), Ct = 0; !(B = h.next()).done; )
        B = B.value, nt = Jt + At(B, Ct++), it += D(
          B,
          _,
          N,
          nt,
          F
        );
    else if (nt === "object") {
      if (typeof h.then == "function")
        return D(
          jt(h),
          _,
          N,
          B,
          F
        );
      throw _ = String(h), Error(
        "Objects are not valid as a React child (found: " + (_ === "[object Object]" ? "object with keys {" + Object.keys(h).join(", ") + "}" : _) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return it;
  }
  function R(h, _, N) {
    if (h == null) return h;
    var B = [], F = 0;
    return D(h, B, "", "", function(nt) {
      return _.call(N, nt, F++);
    }), B;
  }
  function Z(h) {
    if (h._status === -1) {
      var _ = h._result;
      _ = _(), _.then(
        function(N) {
          (h._status === 0 || h._status === -1) && (h._status = 1, h._result = N);
        },
        function(N) {
          (h._status === 0 || h._status === -1) && (h._status = 2, h._result = N);
        }
      ), h._status === -1 && (h._status = 0, h._result = _);
    }
    if (h._status === 1) return h._result.default;
    throw h._result;
  }
  var $ = typeof reportError == "function" ? reportError : function(h) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var _ = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof h == "object" && h !== null && typeof h.message == "string" ? String(h.message) : String(h),
        error: h
      });
      if (!window.dispatchEvent(_)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", h);
      return;
    }
    console.error(h);
  }, vt = {
    map: R,
    forEach: function(h, _, N) {
      R(
        h,
        function() {
          _.apply(this, arguments);
        },
        N
      );
    },
    count: function(h) {
      var _ = 0;
      return R(h, function() {
        _++;
      }), _;
    },
    toArray: function(h) {
      return R(h, function(_) {
        return _;
      }) || [];
    },
    only: function(h) {
      if (!ye(h))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return h;
    }
  };
  return P.Activity = M, P.Children = vt, P.Component = V, P.Fragment = r, P.Profiler = p, P.PureComponent = lt, P.StrictMode = s, P.Suspense = T, P.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = tt, P.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(h) {
      return tt.H.useMemoCache(h);
    }
  }, P.cache = function(h) {
    return function() {
      return h.apply(null, arguments);
    };
  }, P.cacheSignal = function() {
    return null;
  }, P.cloneElement = function(h, _, N) {
    if (h == null)
      throw Error(
        "The argument must be a React element, but you passed " + h + "."
      );
    var B = J({}, h.props), F = h.key;
    if (_ != null)
      for (nt in _.key !== void 0 && (F = "" + _.key), _)
        !Vt.call(_, nt) || nt === "key" || nt === "__self" || nt === "__source" || nt === "ref" && _.ref === void 0 || (B[nt] = _[nt]);
    var nt = arguments.length - 2;
    if (nt === 1) B.children = N;
    else if (1 < nt) {
      for (var it = Array(nt), Jt = 0; Jt < nt; Jt++)
        it[Jt] = arguments[Jt + 2];
      B.children = it;
    }
    return le(h.type, F, B);
  }, P.createContext = function(h) {
    return h = {
      $$typeof: A,
      _currentValue: h,
      _currentValue2: h,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, h.Provider = h, h.Consumer = {
      $$typeof: g,
      _context: h
    }, h;
  }, P.createElement = function(h, _, N) {
    var B, F = {}, nt = null;
    if (_ != null)
      for (B in _.key !== void 0 && (nt = "" + _.key), _)
        Vt.call(_, B) && B !== "key" && B !== "__self" && B !== "__source" && (F[B] = _[B]);
    var it = arguments.length - 2;
    if (it === 1) F.children = N;
    else if (1 < it) {
      for (var Jt = Array(it), Ct = 0; Ct < it; Ct++)
        Jt[Ct] = arguments[Ct + 2];
      F.children = Jt;
    }
    if (h && h.defaultProps)
      for (B in it = h.defaultProps, it)
        F[B] === void 0 && (F[B] = it[B]);
    return le(h, nt, F);
  }, P.createRef = function() {
    return { current: null };
  }, P.forwardRef = function(h) {
    return { $$typeof: S, render: h };
  }, P.isValidElement = ye, P.lazy = function(h) {
    return {
      $$typeof: C,
      _payload: { _status: -1, _result: h },
      _init: Z
    };
  }, P.memo = function(h, _) {
    return {
      $$typeof: v,
      type: h,
      compare: _ === void 0 ? null : _
    };
  }, P.startTransition = function(h) {
    var _ = tt.T, N = {};
    tt.T = N;
    try {
      var B = h(), F = tt.S;
      F !== null && F(N, B), typeof B == "object" && B !== null && typeof B.then == "function" && B.then(Bt, $);
    } catch (nt) {
      $(nt);
    } finally {
      _ !== null && N.types !== null && (_.types = N.types), tt.T = _;
    }
  }, P.unstable_useCacheRefresh = function() {
    return tt.H.useCacheRefresh();
  }, P.use = function(h) {
    return tt.H.use(h);
  }, P.useActionState = function(h, _, N) {
    return tt.H.useActionState(h, _, N);
  }, P.useCallback = function(h, _) {
    return tt.H.useCallback(h, _);
  }, P.useContext = function(h) {
    return tt.H.useContext(h);
  }, P.useDebugValue = function() {
  }, P.useDeferredValue = function(h, _) {
    return tt.H.useDeferredValue(h, _);
  }, P.useEffect = function(h, _) {
    return tt.H.useEffect(h, _);
  }, P.useEffectEvent = function(h) {
    return tt.H.useEffectEvent(h);
  }, P.useId = function() {
    return tt.H.useId();
  }, P.useImperativeHandle = function(h, _, N) {
    return tt.H.useImperativeHandle(h, _, N);
  }, P.useInsertionEffect = function(h, _) {
    return tt.H.useInsertionEffect(h, _);
  }, P.useLayoutEffect = function(h, _) {
    return tt.H.useLayoutEffect(h, _);
  }, P.useMemo = function(h, _) {
    return tt.H.useMemo(h, _);
  }, P.useOptimistic = function(h, _) {
    return tt.H.useOptimistic(h, _);
  }, P.useReducer = function(h, _, N) {
    return tt.H.useReducer(h, _, N);
  }, P.useRef = function(h) {
    return tt.H.useRef(h);
  }, P.useState = function(h) {
    return tt.H.useState(h);
  }, P.useSyncExternalStore = function(h, _, N) {
    return tt.H.useSyncExternalStore(
      h,
      _,
      N
    );
  }, P.useTransition = function() {
    return tt.H.useTransition();
  }, P.version = "19.2.5", P;
}
var Rd;
function Ds() {
  return Rd || (Rd = 1, is.exports = ay()), is.exports;
}
var us = { exports: {} }, ie = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Nd;
function ny() {
  if (Nd) return ie;
  Nd = 1;
  var i = Ds();
  function c(T) {
    var v = "https://react.dev/errors/" + T;
    if (1 < arguments.length) {
      v += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var C = 2; C < arguments.length; C++)
        v += "&args[]=" + encodeURIComponent(arguments[C]);
    }
    return "Minified React error #" + T + "; visit " + v + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function r() {
  }
  var s = {
    d: {
      f: r,
      r: function() {
        throw Error(c(522));
      },
      D: r,
      C: r,
      L: r,
      m: r,
      X: r,
      S: r,
      M: r
    },
    p: 0,
    findDOMNode: null
  }, p = /* @__PURE__ */ Symbol.for("react.portal");
  function g(T, v, C) {
    var M = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: p,
      key: M == null ? null : "" + M,
      children: T,
      containerInfo: v,
      implementation: C
    };
  }
  var A = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function S(T, v) {
    if (T === "font") return "";
    if (typeof v == "string")
      return v === "use-credentials" ? v : "";
  }
  return ie.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = s, ie.createPortal = function(T, v) {
    var C = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!v || v.nodeType !== 1 && v.nodeType !== 9 && v.nodeType !== 11)
      throw Error(c(299));
    return g(T, v, null, C);
  }, ie.flushSync = function(T) {
    var v = A.T, C = s.p;
    try {
      if (A.T = null, s.p = 2, T) return T();
    } finally {
      A.T = v, s.p = C, s.d.f();
    }
  }, ie.preconnect = function(T, v) {
    typeof T == "string" && (v ? (v = v.crossOrigin, v = typeof v == "string" ? v === "use-credentials" ? v : "" : void 0) : v = null, s.d.C(T, v));
  }, ie.prefetchDNS = function(T) {
    typeof T == "string" && s.d.D(T);
  }, ie.preinit = function(T, v) {
    if (typeof T == "string" && v && typeof v.as == "string") {
      var C = v.as, M = S(C, v.crossOrigin), Q = typeof v.integrity == "string" ? v.integrity : void 0, k = typeof v.fetchPriority == "string" ? v.fetchPriority : void 0;
      C === "style" ? s.d.S(
        T,
        typeof v.precedence == "string" ? v.precedence : void 0,
        {
          crossOrigin: M,
          integrity: Q,
          fetchPriority: k
        }
      ) : C === "script" && s.d.X(T, {
        crossOrigin: M,
        integrity: Q,
        fetchPriority: k,
        nonce: typeof v.nonce == "string" ? v.nonce : void 0
      });
    }
  }, ie.preinitModule = function(T, v) {
    if (typeof T == "string")
      if (typeof v == "object" && v !== null) {
        if (v.as == null || v.as === "script") {
          var C = S(
            v.as,
            v.crossOrigin
          );
          s.d.M(T, {
            crossOrigin: C,
            integrity: typeof v.integrity == "string" ? v.integrity : void 0,
            nonce: typeof v.nonce == "string" ? v.nonce : void 0
          });
        }
      } else v == null && s.d.M(T);
  }, ie.preload = function(T, v) {
    if (typeof T == "string" && typeof v == "object" && v !== null && typeof v.as == "string") {
      var C = v.as, M = S(C, v.crossOrigin);
      s.d.L(T, C, {
        crossOrigin: M,
        integrity: typeof v.integrity == "string" ? v.integrity : void 0,
        nonce: typeof v.nonce == "string" ? v.nonce : void 0,
        type: typeof v.type == "string" ? v.type : void 0,
        fetchPriority: typeof v.fetchPriority == "string" ? v.fetchPriority : void 0,
        referrerPolicy: typeof v.referrerPolicy == "string" ? v.referrerPolicy : void 0,
        imageSrcSet: typeof v.imageSrcSet == "string" ? v.imageSrcSet : void 0,
        imageSizes: typeof v.imageSizes == "string" ? v.imageSizes : void 0,
        media: typeof v.media == "string" ? v.media : void 0
      });
    }
  }, ie.preloadModule = function(T, v) {
    if (typeof T == "string")
      if (v) {
        var C = S(v.as, v.crossOrigin);
        s.d.m(T, {
          as: typeof v.as == "string" && v.as !== "script" ? v.as : void 0,
          crossOrigin: C,
          integrity: typeof v.integrity == "string" ? v.integrity : void 0
        });
      } else s.d.m(T);
  }, ie.requestFormReset = function(T) {
    s.d.r(T);
  }, ie.unstable_batchedUpdates = function(T, v) {
    return T(v);
  }, ie.useFormState = function(T, v, C) {
    return A.H.useFormState(T, v, C);
  }, ie.useFormStatus = function() {
    return A.H.useHostTransitionStatus();
  }, ie.version = "19.2.5", ie;
}
var Ud;
function ly() {
  if (Ud) return us.exports;
  Ud = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (c) {
        console.error(c);
      }
  }
  return i(), us.exports = ny(), us.exports;
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
var qd;
function iy() {
  if (qd) return ni;
  qd = 1;
  var i = ey(), c = Ds(), r = ly();
  function s(t) {
    var e = "https://react.dev/errors/" + t;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var a = 2; a < arguments.length; a++)
        e += "&args[]=" + encodeURIComponent(arguments[a]);
    }
    return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function p(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function g(t) {
    var e = t, a = t;
    if (t.alternate) for (; e.return; ) e = e.return;
    else {
      t = e;
      do
        e = t, (e.flags & 4098) !== 0 && (a = e.return), t = e.return;
      while (t);
    }
    return e.tag === 3 ? a : null;
  }
  function A(t) {
    if (t.tag === 13) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function S(t) {
    if (t.tag === 31) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function T(t) {
    if (g(t) !== t)
      throw Error(s(188));
  }
  function v(t) {
    var e = t.alternate;
    if (!e) {
      if (e = g(t), e === null) throw Error(s(188));
      return e !== t ? null : t;
    }
    for (var a = t, n = e; ; ) {
      var l = a.return;
      if (l === null) break;
      var u = l.alternate;
      if (u === null) {
        if (n = l.return, n !== null) {
          a = n;
          continue;
        }
        break;
      }
      if (l.child === u.child) {
        for (u = l.child; u; ) {
          if (u === a) return T(l), t;
          if (u === n) return T(l), e;
          u = u.sibling;
        }
        throw Error(s(188));
      }
      if (a.return !== n.return) a = l, n = u;
      else {
        for (var o = !1, f = l.child; f; ) {
          if (f === a) {
            o = !0, a = l, n = u;
            break;
          }
          if (f === n) {
            o = !0, n = l, a = u;
            break;
          }
          f = f.sibling;
        }
        if (!o) {
          for (f = u.child; f; ) {
            if (f === a) {
              o = !0, a = u, n = l;
              break;
            }
            if (f === n) {
              o = !0, n = u, a = l;
              break;
            }
            f = f.sibling;
          }
          if (!o) throw Error(s(189));
        }
      }
      if (a.alternate !== n) throw Error(s(190));
    }
    if (a.tag !== 3) throw Error(s(188));
    return a.stateNode.current === a ? t : e;
  }
  function C(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t;
    for (t = t.child; t !== null; ) {
      if (e = C(t), e !== null) return e;
      t = t.sibling;
    }
    return null;
  }
  var M = Object.assign, Q = /* @__PURE__ */ Symbol.for("react.element"), k = /* @__PURE__ */ Symbol.for("react.transitional.element"), W = /* @__PURE__ */ Symbol.for("react.portal"), J = /* @__PURE__ */ Symbol.for("react.fragment"), H = /* @__PURE__ */ Symbol.for("react.strict_mode"), V = /* @__PURE__ */ Symbol.for("react.profiler"), ft = /* @__PURE__ */ Symbol.for("react.consumer"), lt = /* @__PURE__ */ Symbol.for("react.context"), pt = /* @__PURE__ */ Symbol.for("react.forward_ref"), Ut = /* @__PURE__ */ Symbol.for("react.suspense"), Bt = /* @__PURE__ */ Symbol.for("react.suspense_list"), tt = /* @__PURE__ */ Symbol.for("react.memo"), Vt = /* @__PURE__ */ Symbol.for("react.lazy"), le = /* @__PURE__ */ Symbol.for("react.activity"), De = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), ye = Symbol.iterator;
  function Kt(t) {
    return t === null || typeof t != "object" ? null : (t = ye && t[ye] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var we = /* @__PURE__ */ Symbol.for("react.client.reference");
  function At(t) {
    if (t == null) return null;
    if (typeof t == "function")
      return t.$$typeof === we ? null : t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case J:
        return "Fragment";
      case V:
        return "Profiler";
      case H:
        return "StrictMode";
      case Ut:
        return "Suspense";
      case Bt:
        return "SuspenseList";
      case le:
        return "Activity";
    }
    if (typeof t == "object")
      switch (t.$$typeof) {
        case W:
          return "Portal";
        case lt:
          return t.displayName || "Context";
        case ft:
          return (t._context.displayName || "Context") + ".Consumer";
        case pt:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case tt:
          return e = t.displayName || null, e !== null ? e : At(t.type) || "Memo";
        case Vt:
          e = t._payload, t = t._init;
          try {
            return At(t(e));
          } catch {
          }
      }
    return null;
  }
  var jt = Array.isArray, D = c.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, R = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Z = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, $ = [], vt = -1;
  function h(t) {
    return { current: t };
  }
  function _(t) {
    0 > vt || (t.current = $[vt], $[vt] = null, vt--);
  }
  function N(t, e) {
    vt++, $[vt] = t.current, t.current = e;
  }
  var B = h(null), F = h(null), nt = h(null), it = h(null);
  function Jt(t, e) {
    switch (N(nt, e), N(F, t), N(B, null), e.nodeType) {
      case 9:
      case 11:
        t = (t = e.documentElement) && (t = t.namespaceURI) ? $p(t) : 0;
        break;
      default:
        if (t = e.tagName, e = e.namespaceURI)
          e = $p(e), t = Ip(e, t);
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
    _(B), N(B, t);
  }
  function Ct() {
    _(B), _(F), _(nt);
  }
  function Sa(t) {
    t.memoizedState !== null && N(it, t);
    var e = B.current, a = Ip(e, t.type);
    e !== a && (N(F, t), N(B, a));
  }
  function $e(t) {
    F.current === t && (_(B), _(F)), it.current === t && (_(it), Il._currentValue = Z);
  }
  var Ea, Ie;
  function Xe(t) {
    if (Ea === void 0)
      try {
        throw Error();
      } catch (a) {
        var e = a.stack.trim().match(/\n( *(at )?)/);
        Ea = e && e[1] || "", Ie = -1 < a.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < a.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + Ea + t + Ie;
  }
  var gn = !1;
  function bn(t, e) {
    if (!t || gn) return "";
    gn = !0;
    var a = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var n = {
        DetermineComponentFrameRoot: function() {
          try {
            if (e) {
              var j = function() {
                throw Error();
              };
              if (Object.defineProperty(j.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(j, []);
                } catch (z) {
                  var E = z;
                }
                Reflect.construct(t, [], j);
              } else {
                try {
                  j.call();
                } catch (z) {
                  E = z;
                }
                t.call(j.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (z) {
                E = z;
              }
              (j = t()) && typeof j.catch == "function" && j.catch(function() {
              });
            }
          } catch (z) {
            if (z && E && typeof z.stack == "string")
              return [z.stack, E.stack];
          }
          return [null, null];
        }
      };
      n.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var l = Object.getOwnPropertyDescriptor(
        n.DetermineComponentFrameRoot,
        "name"
      );
      l && l.configurable && Object.defineProperty(
        n.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var u = n.DetermineComponentFrameRoot(), o = u[0], f = u[1];
      if (o && f) {
        var d = o.split(`
`), x = f.split(`
`);
        for (l = n = 0; n < d.length && !d[n].includes("DetermineComponentFrameRoot"); )
          n++;
        for (; l < x.length && !x[l].includes(
          "DetermineComponentFrameRoot"
        ); )
          l++;
        if (n === d.length || l === x.length)
          for (n = d.length - 1, l = x.length - 1; 1 <= n && 0 <= l && d[n] !== x[l]; )
            l--;
        for (; 1 <= n && 0 <= l; n--, l--)
          if (d[n] !== x[l]) {
            if (n !== 1 || l !== 1)
              do
                if (n--, l--, 0 > l || d[n] !== x[l]) {
                  var O = `
` + d[n].replace(" at new ", " at ");
                  return t.displayName && O.includes("<anonymous>") && (O = O.replace("<anonymous>", t.displayName)), O;
                }
              while (1 <= n && 0 <= l);
            break;
          }
      }
    } finally {
      gn = !1, Error.prepareStackTrace = a;
    }
    return (a = t ? t.displayName || t.name : "") ? Xe(a) : "";
  }
  function di(t, e) {
    switch (t.tag) {
      case 26:
      case 27:
      case 5:
        return Xe(t.type);
      case 16:
        return Xe("Lazy");
      case 13:
        return t.child !== e && e !== null ? Xe("Suspense Fallback") : Xe("Suspense");
      case 19:
        return Xe("SuspenseList");
      case 0:
      case 15:
        return bn(t.type, !1);
      case 11:
        return bn(t.type.render, !1);
      case 1:
        return bn(t.type, !0);
      case 31:
        return Xe("Activity");
      default:
        return "";
    }
  }
  function Pe(t) {
    try {
      var e = "", a = null;
      do
        e += di(t, a), a = t, t = t.return;
      while (t);
      return e;
    } catch (n) {
      return `
Error generating stack: ` + n.message + `
` + n.stack;
    }
  }
  var Fa = Object.prototype.hasOwnProperty, Ta = i.unstable_scheduleCallback, Aa = i.unstable_cancelCallback, Gu = i.unstable_shouldYield, Qu = i.unstable_requestPaint, ue = i.unstable_now, U = i.unstable_getCurrentPriorityLevel, X = i.unstable_ImmediatePriority, zt = i.unstable_UserBlockingPriority, Ot = i.unstable_NormalPriority, Xt = i.unstable_LowPriority, ge = i.unstable_IdlePriority, Le = i.log, cl = i.unstable_setDisableYieldValue, ta = null, $t = null;
  function be(t) {
    if (typeof Le == "function" && cl(t), $t && typeof $t.setStrictMode == "function")
      try {
        $t.setStrictMode(ta, t);
      } catch {
      }
  }
  var It = Math.clz32 ? Math.clz32 : rl, ol = Math.log, sl = Math.LN2;
  function rl(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (ol(t) / sl | 0) | 0;
  }
  var xn = 256, mi = 262144, hi = 4194304;
  function Wa(t) {
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
  function vi(t, e, a) {
    var n = t.pendingLanes;
    if (n === 0) return 0;
    var l = 0, u = t.suspendedLanes, o = t.pingedLanes;
    t = t.warmLanes;
    var f = n & 134217727;
    return f !== 0 ? (n = f & ~u, n !== 0 ? l = Wa(n) : (o &= f, o !== 0 ? l = Wa(o) : a || (a = f & ~t, a !== 0 && (l = Wa(a))))) : (f = n & ~u, f !== 0 ? l = Wa(f) : o !== 0 ? l = Wa(o) : a || (a = n & ~t, a !== 0 && (l = Wa(a)))), l === 0 ? 0 : e !== 0 && e !== l && (e & u) === 0 && (u = l & -l, a = e & -e, u >= a || u === 32 && (a & 4194048) !== 0) ? e : l;
  }
  function fl(t, e) {
    return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
  }
  function Lm(t, e) {
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
  function Cs() {
    var t = hi;
    return hi <<= 1, (hi & 62914560) === 0 && (hi = 4194304), t;
  }
  function Yu(t) {
    for (var e = [], a = 0; 31 > a; a++) e.push(t);
    return e;
  }
  function pl(t, e) {
    t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
  }
  function Gm(t, e, a, n, l, u) {
    var o = t.pendingLanes;
    t.pendingLanes = a, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= a, t.entangledLanes &= a, t.errorRecoveryDisabledLanes &= a, t.shellSuspendCounter = 0;
    var f = t.entanglements, d = t.expirationTimes, x = t.hiddenUpdates;
    for (a = o & ~a; 0 < a; ) {
      var O = 31 - It(a), j = 1 << O;
      f[O] = 0, d[O] = -1;
      var E = x[O];
      if (E !== null)
        for (x[O] = null, O = 0; O < E.length; O++) {
          var z = E[O];
          z !== null && (z.lane &= -536870913);
        }
      a &= ~j;
    }
    n !== 0 && Ms(t, n, 0), u !== 0 && l === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(o & ~e));
  }
  function Ms(t, e, a) {
    t.pendingLanes |= e, t.suspendedLanes &= ~e;
    var n = 31 - It(e);
    t.entangledLanes |= e, t.entanglements[n] = t.entanglements[n] | 1073741824 | a & 261930;
  }
  function Rs(t, e) {
    var a = t.entangledLanes |= e;
    for (t = t.entanglements; a; ) {
      var n = 31 - It(a), l = 1 << n;
      l & e | t[n] & e && (t[n] |= e), a &= ~l;
    }
  }
  function Ns(t, e) {
    var a = e & -e;
    return a = (a & 42) !== 0 ? 1 : ku(a), (a & (t.suspendedLanes | e)) !== 0 ? 0 : a;
  }
  function ku(t) {
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
  function Xu(t) {
    return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function Us() {
    var t = R.p;
    return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : Sd(t.type));
  }
  function qs(t, e) {
    var a = R.p;
    try {
      return R.p = t, e();
    } finally {
      R.p = a;
    }
  }
  var za = Math.random().toString(36).slice(2), Pt = "__reactFiber$" + za, re = "__reactProps$" + za, Sn = "__reactContainer$" + za, Zu = "__reactEvents$" + za, Qm = "__reactListeners$" + za, Ym = "__reactHandles$" + za, Hs = "__reactResources$" + za, dl = "__reactMarker$" + za;
  function Vu(t) {
    delete t[Pt], delete t[re], delete t[Zu], delete t[Qm], delete t[Ym];
  }
  function En(t) {
    var e = t[Pt];
    if (e) return e;
    for (var a = t.parentNode; a; ) {
      if (e = a[Sn] || a[Pt]) {
        if (a = e.alternate, e.child !== null || a !== null && a.child !== null)
          for (t = id(t); t !== null; ) {
            if (a = t[Pt]) return a;
            t = id(t);
          }
        return e;
      }
      t = a, a = t.parentNode;
    }
    return null;
  }
  function Tn(t) {
    if (t = t[Pt] || t[Sn]) {
      var e = t.tag;
      if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3)
        return t;
    }
    return null;
  }
  function ml(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
    throw Error(s(33));
  }
  function An(t) {
    var e = t[Hs];
    return e || (e = t[Hs] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), e;
  }
  function Ft(t) {
    t[dl] = !0;
  }
  var Bs = /* @__PURE__ */ new Set(), Ls = {};
  function $a(t, e) {
    zn(t, e), zn(t + "Capture", e);
  }
  function zn(t, e) {
    for (Ls[t] = e, t = 0; t < e.length; t++)
      Bs.add(e[t]);
  }
  var km = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), Gs = {}, Qs = {};
  function Xm(t) {
    return Fa.call(Qs, t) ? !0 : Fa.call(Gs, t) ? !1 : km.test(t) ? Qs[t] = !0 : (Gs[t] = !0, !1);
  }
  function yi(t, e, a) {
    if (Xm(e))
      if (a === null) t.removeAttribute(e);
      else {
        switch (typeof a) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var n = e.toLowerCase().slice(0, 5);
            if (n !== "data-" && n !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, "" + a);
      }
  }
  function gi(t, e, a) {
    if (a === null) t.removeAttribute(e);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(e);
          return;
      }
      t.setAttribute(e, "" + a);
    }
  }
  function ea(t, e, a, n) {
    if (n === null) t.removeAttribute(a);
    else {
      switch (typeof n) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(a);
          return;
      }
      t.setAttributeNS(e, a, "" + n);
    }
  }
  function _e(t) {
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
  function Ys(t) {
    var e = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
  }
  function Zm(t, e, a) {
    var n = Object.getOwnPropertyDescriptor(
      t.constructor.prototype,
      e
    );
    if (!t.hasOwnProperty(e) && typeof n < "u" && typeof n.get == "function" && typeof n.set == "function") {
      var l = n.get, u = n.set;
      return Object.defineProperty(t, e, {
        configurable: !0,
        get: function() {
          return l.call(this);
        },
        set: function(o) {
          a = "" + o, u.call(this, o);
        }
      }), Object.defineProperty(t, e, {
        enumerable: n.enumerable
      }), {
        getValue: function() {
          return a;
        },
        setValue: function(o) {
          a = "" + o;
        },
        stopTracking: function() {
          t._valueTracker = null, delete t[e];
        }
      };
    }
  }
  function Ku(t) {
    if (!t._valueTracker) {
      var e = Ys(t) ? "checked" : "value";
      t._valueTracker = Zm(
        t,
        e,
        "" + t[e]
      );
    }
  }
  function ks(t) {
    if (!t) return !1;
    var e = t._valueTracker;
    if (!e) return !0;
    var a = e.getValue(), n = "";
    return t && (n = Ys(t) ? t.checked ? "true" : "false" : t.value), t = n, t !== a ? (e.setValue(t), !0) : !1;
  }
  function bi(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  var Vm = /[\n"\\]/g;
  function je(t) {
    return t.replace(
      Vm,
      function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function Ju(t, e, a, n, l, u, o, f) {
    t.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? t.type = o : t.removeAttribute("type"), e != null ? o === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + _e(e)) : t.value !== "" + _e(e) && (t.value = "" + _e(e)) : o !== "submit" && o !== "reset" || t.removeAttribute("value"), e != null ? Fu(t, o, _e(e)) : a != null ? Fu(t, o, _e(a)) : n != null && t.removeAttribute("value"), l == null && u != null && (t.defaultChecked = !!u), l != null && (t.checked = l && typeof l != "function" && typeof l != "symbol"), f != null && typeof f != "function" && typeof f != "symbol" && typeof f != "boolean" ? t.name = "" + _e(f) : t.removeAttribute("name");
  }
  function Xs(t, e, a, n, l, u, o, f) {
    if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (t.type = u), e != null || a != null) {
      if (!(u !== "submit" && u !== "reset" || e != null)) {
        Ku(t);
        return;
      }
      a = a != null ? "" + _e(a) : "", e = e != null ? "" + _e(e) : a, f || e === t.value || (t.value = e), t.defaultValue = e;
    }
    n = n ?? l, n = typeof n != "function" && typeof n != "symbol" && !!n, t.checked = f ? t.checked : !!n, t.defaultChecked = !!n, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (t.name = o), Ku(t);
  }
  function Fu(t, e, a) {
    e === "number" && bi(t.ownerDocument) === t || t.defaultValue === "" + a || (t.defaultValue = "" + a);
  }
  function On(t, e, a, n) {
    if (t = t.options, e) {
      e = {};
      for (var l = 0; l < a.length; l++)
        e["$" + a[l]] = !0;
      for (a = 0; a < t.length; a++)
        l = e.hasOwnProperty("$" + t[a].value), t[a].selected !== l && (t[a].selected = l), l && n && (t[a].defaultSelected = !0);
    } else {
      for (a = "" + _e(a), e = null, l = 0; l < t.length; l++) {
        if (t[l].value === a) {
          t[l].selected = !0, n && (t[l].defaultSelected = !0);
          return;
        }
        e !== null || t[l].disabled || (e = t[l]);
      }
      e !== null && (e.selected = !0);
    }
  }
  function Zs(t, e, a) {
    if (e != null && (e = "" + _e(e), e !== t.value && (t.value = e), a == null)) {
      t.defaultValue !== e && (t.defaultValue = e);
      return;
    }
    t.defaultValue = a != null ? "" + _e(a) : "";
  }
  function Vs(t, e, a, n) {
    if (e == null) {
      if (n != null) {
        if (a != null) throw Error(s(92));
        if (jt(n)) {
          if (1 < n.length) throw Error(s(93));
          n = n[0];
        }
        a = n;
      }
      a == null && (a = ""), e = a;
    }
    a = _e(e), t.defaultValue = a, n = t.textContent, n === a && n !== "" && n !== null && (t.value = n), Ku(t);
  }
  function Dn(t, e) {
    if (e) {
      var a = t.firstChild;
      if (a && a === t.lastChild && a.nodeType === 3) {
        a.nodeValue = e;
        return;
      }
    }
    t.textContent = e;
  }
  var Km = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function Ks(t, e, a) {
    var n = e.indexOf("--") === 0;
    a == null || typeof a == "boolean" || a === "" ? n ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : n ? t.setProperty(e, a) : typeof a != "number" || a === 0 || Km.has(e) ? e === "float" ? t.cssFloat = a : t[e] = ("" + a).trim() : t[e] = a + "px";
  }
  function Js(t, e, a) {
    if (e != null && typeof e != "object")
      throw Error(s(62));
    if (t = t.style, a != null) {
      for (var n in a)
        !a.hasOwnProperty(n) || e != null && e.hasOwnProperty(n) || (n.indexOf("--") === 0 ? t.setProperty(n, "") : n === "float" ? t.cssFloat = "" : t[n] = "");
      for (var l in e)
        n = e[l], e.hasOwnProperty(l) && a[l] !== n && Ks(t, l, n);
    } else
      for (var u in e)
        e.hasOwnProperty(u) && Ks(t, u, e[u]);
  }
  function Wu(t) {
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
  var Jm = /* @__PURE__ */ new Map([
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
  ]), Fm = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function xi(t) {
    return Fm.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
  }
  function aa() {
  }
  var $u = null;
  function Iu(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var wn = null, _n = null;
  function Fs(t) {
    var e = Tn(t);
    if (e && (t = e.stateNode)) {
      var a = t[re] || null;
      t: switch (t = e.stateNode, e.type) {
        case "input":
          if (Ju(
            t,
            a.value,
            a.defaultValue,
            a.defaultValue,
            a.checked,
            a.defaultChecked,
            a.type,
            a.name
          ), e = a.name, a.type === "radio" && e != null) {
            for (a = t; a.parentNode; ) a = a.parentNode;
            for (a = a.querySelectorAll(
              'input[name="' + je(
                "" + e
              ) + '"][type="radio"]'
            ), e = 0; e < a.length; e++) {
              var n = a[e];
              if (n !== t && n.form === t.form) {
                var l = n[re] || null;
                if (!l) throw Error(s(90));
                Ju(
                  n,
                  l.value,
                  l.defaultValue,
                  l.defaultValue,
                  l.checked,
                  l.defaultChecked,
                  l.type,
                  l.name
                );
              }
            }
            for (e = 0; e < a.length; e++)
              n = a[e], n.form === t.form && ks(n);
          }
          break t;
        case "textarea":
          Zs(t, a.value, a.defaultValue);
          break t;
        case "select":
          e = a.value, e != null && On(t, !!a.multiple, e, !1);
      }
    }
  }
  var Pu = !1;
  function Ws(t, e, a) {
    if (Pu) return t(e, a);
    Pu = !0;
    try {
      var n = t(e);
      return n;
    } finally {
      if (Pu = !1, (wn !== null || _n !== null) && (cu(), wn && (e = wn, t = _n, _n = wn = null, Fs(e), t)))
        for (e = 0; e < t.length; e++) Fs(t[e]);
    }
  }
  function hl(t, e) {
    var a = t.stateNode;
    if (a === null) return null;
    var n = a[re] || null;
    if (n === null) return null;
    a = n[e];
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
        (n = !n.disabled) || (t = t.type, n = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !n;
        break t;
      default:
        t = !1;
    }
    if (t) return null;
    if (a && typeof a != "function")
      throw Error(
        s(231, e, typeof a)
      );
    return a;
  }
  var na = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), tc = !1;
  if (na)
    try {
      var vl = {};
      Object.defineProperty(vl, "passive", {
        get: function() {
          tc = !0;
        }
      }), window.addEventListener("test", vl, vl), window.removeEventListener("test", vl, vl);
    } catch {
      tc = !1;
    }
  var Oa = null, ec = null, Si = null;
  function $s() {
    if (Si) return Si;
    var t, e = ec, a = e.length, n, l = "value" in Oa ? Oa.value : Oa.textContent, u = l.length;
    for (t = 0; t < a && e[t] === l[t]; t++) ;
    var o = a - t;
    for (n = 1; n <= o && e[a - n] === l[u - n]; n++) ;
    return Si = l.slice(t, 1 < n ? 1 - n : void 0);
  }
  function Ei(t) {
    var e = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function Ti() {
    return !0;
  }
  function Is() {
    return !1;
  }
  function fe(t) {
    function e(a, n, l, u, o) {
      this._reactName = a, this._targetInst = l, this.type = n, this.nativeEvent = u, this.target = o, this.currentTarget = null;
      for (var f in t)
        t.hasOwnProperty(f) && (a = t[f], this[f] = a ? a(u) : u[f]);
      return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1) ? Ti : Is, this.isPropagationStopped = Is, this;
    }
    return M(e.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var a = this.nativeEvent;
        a && (a.preventDefault ? a.preventDefault() : typeof a.returnValue != "unknown" && (a.returnValue = !1), this.isDefaultPrevented = Ti);
      },
      stopPropagation: function() {
        var a = this.nativeEvent;
        a && (a.stopPropagation ? a.stopPropagation() : typeof a.cancelBubble != "unknown" && (a.cancelBubble = !0), this.isPropagationStopped = Ti);
      },
      persist: function() {
      },
      isPersistent: Ti
    }), e;
  }
  var Ia = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(t) {
      return t.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, Ai = fe(Ia), yl = M({}, Ia, { view: 0, detail: 0 }), Wm = fe(yl), ac, nc, gl, zi = M({}, yl, {
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
    getModifierState: ic,
    button: 0,
    buttons: 0,
    relatedTarget: function(t) {
      return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
    },
    movementX: function(t) {
      return "movementX" in t ? t.movementX : (t !== gl && (gl && t.type === "mousemove" ? (ac = t.screenX - gl.screenX, nc = t.screenY - gl.screenY) : nc = ac = 0, gl = t), ac);
    },
    movementY: function(t) {
      return "movementY" in t ? t.movementY : nc;
    }
  }), Ps = fe(zi), $m = M({}, zi, { dataTransfer: 0 }), Im = fe($m), Pm = M({}, yl, { relatedTarget: 0 }), lc = fe(Pm), th = M({}, Ia, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), eh = fe(th), ah = M({}, Ia, {
    clipboardData: function(t) {
      return "clipboardData" in t ? t.clipboardData : window.clipboardData;
    }
  }), nh = fe(ah), lh = M({}, Ia, { data: 0 }), tr = fe(lh), ih = {
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
  }, uh = {
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
  }, ch = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function oh(t) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(t) : (t = ch[t]) ? !!e[t] : !1;
  }
  function ic() {
    return oh;
  }
  var sh = M({}, yl, {
    key: function(t) {
      if (t.key) {
        var e = ih[t.key] || t.key;
        if (e !== "Unidentified") return e;
      }
      return t.type === "keypress" ? (t = Ei(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? uh[t.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: ic,
    charCode: function(t) {
      return t.type === "keypress" ? Ei(t) : 0;
    },
    keyCode: function(t) {
      return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    },
    which: function(t) {
      return t.type === "keypress" ? Ei(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    }
  }), rh = fe(sh), fh = M({}, zi, {
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
  }), er = fe(fh), ph = M({}, yl, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: ic
  }), dh = fe(ph), mh = M({}, Ia, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), hh = fe(mh), vh = M({}, zi, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), yh = fe(vh), gh = M({}, Ia, {
    newState: 0,
    oldState: 0
  }), bh = fe(gh), xh = [9, 13, 27, 32], uc = na && "CompositionEvent" in window, bl = null;
  na && "documentMode" in document && (bl = document.documentMode);
  var Sh = na && "TextEvent" in window && !bl, ar = na && (!uc || bl && 8 < bl && 11 >= bl), nr = " ", lr = !1;
  function ir(t, e) {
    switch (t) {
      case "keyup":
        return xh.indexOf(e.keyCode) !== -1;
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
  function ur(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var jn = !1;
  function Eh(t, e) {
    switch (t) {
      case "compositionend":
        return ur(e);
      case "keypress":
        return e.which !== 32 ? null : (lr = !0, nr);
      case "textInput":
        return t = e.data, t === nr && lr ? null : t;
      default:
        return null;
    }
  }
  function Th(t, e) {
    if (jn)
      return t === "compositionend" || !uc && ir(t, e) ? (t = $s(), Si = ec = Oa = null, jn = !1, t) : null;
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
        return ar && e.locale !== "ko" ? null : e.data;
      default:
        return null;
    }
  }
  var Ah = {
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
  function cr(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e === "input" ? !!Ah[t.type] : e === "textarea";
  }
  function or(t, e, a, n) {
    wn ? _n ? _n.push(n) : _n = [n] : wn = n, e = mu(e, "onChange"), 0 < e.length && (a = new Ai(
      "onChange",
      "change",
      null,
      a,
      n
    ), t.push({ event: a, listeners: e }));
  }
  var xl = null, Sl = null;
  function zh(t) {
    Zp(t, 0);
  }
  function Oi(t) {
    var e = ml(t);
    if (ks(e)) return t;
  }
  function sr(t, e) {
    if (t === "change") return e;
  }
  var rr = !1;
  if (na) {
    var cc;
    if (na) {
      var oc = "oninput" in document;
      if (!oc) {
        var fr = document.createElement("div");
        fr.setAttribute("oninput", "return;"), oc = typeof fr.oninput == "function";
      }
      cc = oc;
    } else cc = !1;
    rr = cc && (!document.documentMode || 9 < document.documentMode);
  }
  function pr() {
    xl && (xl.detachEvent("onpropertychange", dr), Sl = xl = null);
  }
  function dr(t) {
    if (t.propertyName === "value" && Oi(Sl)) {
      var e = [];
      or(
        e,
        Sl,
        t,
        Iu(t)
      ), Ws(zh, e);
    }
  }
  function Oh(t, e, a) {
    t === "focusin" ? (pr(), xl = e, Sl = a, xl.attachEvent("onpropertychange", dr)) : t === "focusout" && pr();
  }
  function Dh(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown")
      return Oi(Sl);
  }
  function wh(t, e) {
    if (t === "click") return Oi(e);
  }
  function _h(t, e) {
    if (t === "input" || t === "change")
      return Oi(e);
  }
  function jh(t, e) {
    return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
  }
  var xe = typeof Object.is == "function" ? Object.is : jh;
  function El(t, e) {
    if (xe(t, e)) return !0;
    if (typeof t != "object" || t === null || typeof e != "object" || e === null)
      return !1;
    var a = Object.keys(t), n = Object.keys(e);
    if (a.length !== n.length) return !1;
    for (n = 0; n < a.length; n++) {
      var l = a[n];
      if (!Fa.call(e, l) || !xe(t[l], e[l]))
        return !1;
    }
    return !0;
  }
  function mr(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function hr(t, e) {
    var a = mr(t);
    t = 0;
    for (var n; a; ) {
      if (a.nodeType === 3) {
        if (n = t + a.textContent.length, t <= e && n >= e)
          return { node: a, offset: e - t };
        t = n;
      }
      t: {
        for (; a; ) {
          if (a.nextSibling) {
            a = a.nextSibling;
            break t;
          }
          a = a.parentNode;
        }
        a = void 0;
      }
      a = mr(a);
    }
  }
  function vr(t, e) {
    return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? vr(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
  }
  function yr(t) {
    t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
    for (var e = bi(t.document); e instanceof t.HTMLIFrameElement; ) {
      try {
        var a = typeof e.contentWindow.location.href == "string";
      } catch {
        a = !1;
      }
      if (a) t = e.contentWindow;
      else break;
      e = bi(t.document);
    }
    return e;
  }
  function sc(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
  }
  var Ch = na && "documentMode" in document && 11 >= document.documentMode, Cn = null, rc = null, Tl = null, fc = !1;
  function gr(t, e, a) {
    var n = a.window === a ? a.document : a.nodeType === 9 ? a : a.ownerDocument;
    fc || Cn == null || Cn !== bi(n) || (n = Cn, "selectionStart" in n && sc(n) ? n = { start: n.selectionStart, end: n.selectionEnd } : (n = (n.ownerDocument && n.ownerDocument.defaultView || window).getSelection(), n = {
      anchorNode: n.anchorNode,
      anchorOffset: n.anchorOffset,
      focusNode: n.focusNode,
      focusOffset: n.focusOffset
    }), Tl && El(Tl, n) || (Tl = n, n = mu(rc, "onSelect"), 0 < n.length && (e = new Ai(
      "onSelect",
      "select",
      null,
      e,
      a
    ), t.push({ event: e, listeners: n }), e.target = Cn)));
  }
  function Pa(t, e) {
    var a = {};
    return a[t.toLowerCase()] = e.toLowerCase(), a["Webkit" + t] = "webkit" + e, a["Moz" + t] = "moz" + e, a;
  }
  var Mn = {
    animationend: Pa("Animation", "AnimationEnd"),
    animationiteration: Pa("Animation", "AnimationIteration"),
    animationstart: Pa("Animation", "AnimationStart"),
    transitionrun: Pa("Transition", "TransitionRun"),
    transitionstart: Pa("Transition", "TransitionStart"),
    transitioncancel: Pa("Transition", "TransitionCancel"),
    transitionend: Pa("Transition", "TransitionEnd")
  }, pc = {}, br = {};
  na && (br = document.createElement("div").style, "AnimationEvent" in window || (delete Mn.animationend.animation, delete Mn.animationiteration.animation, delete Mn.animationstart.animation), "TransitionEvent" in window || delete Mn.transitionend.transition);
  function tn(t) {
    if (pc[t]) return pc[t];
    if (!Mn[t]) return t;
    var e = Mn[t], a;
    for (a in e)
      if (e.hasOwnProperty(a) && a in br)
        return pc[t] = e[a];
    return t;
  }
  var xr = tn("animationend"), Sr = tn("animationiteration"), Er = tn("animationstart"), Mh = tn("transitionrun"), Rh = tn("transitionstart"), Nh = tn("transitioncancel"), Tr = tn("transitionend"), Ar = /* @__PURE__ */ new Map(), dc = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  dc.push("scrollEnd");
  function Ge(t, e) {
    Ar.set(t, e), $a(e, [t]);
  }
  var Di = typeof reportError == "function" ? reportError : function(t) {
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
  }, Ce = [], Rn = 0, mc = 0;
  function wi() {
    for (var t = Rn, e = mc = Rn = 0; e < t; ) {
      var a = Ce[e];
      Ce[e++] = null;
      var n = Ce[e];
      Ce[e++] = null;
      var l = Ce[e];
      Ce[e++] = null;
      var u = Ce[e];
      if (Ce[e++] = null, n !== null && l !== null) {
        var o = n.pending;
        o === null ? l.next = l : (l.next = o.next, o.next = l), n.pending = l;
      }
      u !== 0 && zr(a, l, u);
    }
  }
  function _i(t, e, a, n) {
    Ce[Rn++] = t, Ce[Rn++] = e, Ce[Rn++] = a, Ce[Rn++] = n, mc |= n, t.lanes |= n, t = t.alternate, t !== null && (t.lanes |= n);
  }
  function hc(t, e, a, n) {
    return _i(t, e, a, n), ji(t);
  }
  function en(t, e) {
    return _i(t, null, null, e), ji(t);
  }
  function zr(t, e, a) {
    t.lanes |= a;
    var n = t.alternate;
    n !== null && (n.lanes |= a);
    for (var l = !1, u = t.return; u !== null; )
      u.childLanes |= a, n = u.alternate, n !== null && (n.childLanes |= a), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (l = !0)), t = u, u = u.return;
    return t.tag === 3 ? (u = t.stateNode, l && e !== null && (l = 31 - It(a), t = u.hiddenUpdates, n = t[l], n === null ? t[l] = [e] : n.push(e), e.lane = a | 536870912), u) : null;
  }
  function ji(t) {
    if (50 < Zl)
      throw Zl = 0, zo = null, Error(s(185));
    for (var e = t.return; e !== null; )
      t = e, e = t.return;
    return t.tag === 3 ? t.stateNode : null;
  }
  var Nn = {};
  function Uh(t, e, a, n) {
    this.tag = t, this.key = a, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = n, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function Se(t, e, a, n) {
    return new Uh(t, e, a, n);
  }
  function vc(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function la(t, e) {
    var a = t.alternate;
    return a === null ? (a = Se(
      t.tag,
      e,
      t.key,
      t.mode
    ), a.elementType = t.elementType, a.type = t.type, a.stateNode = t.stateNode, a.alternate = t, t.alternate = a) : (a.pendingProps = e, a.type = t.type, a.flags = 0, a.subtreeFlags = 0, a.deletions = null), a.flags = t.flags & 65011712, a.childLanes = t.childLanes, a.lanes = t.lanes, a.child = t.child, a.memoizedProps = t.memoizedProps, a.memoizedState = t.memoizedState, a.updateQueue = t.updateQueue, e = t.dependencies, a.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, a.sibling = t.sibling, a.index = t.index, a.ref = t.ref, a.refCleanup = t.refCleanup, a;
  }
  function Or(t, e) {
    t.flags &= 65011714;
    var a = t.alternate;
    return a === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = a.childLanes, t.lanes = a.lanes, t.child = a.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = a.memoizedProps, t.memoizedState = a.memoizedState, t.updateQueue = a.updateQueue, t.type = a.type, e = a.dependencies, t.dependencies = e === null ? null : {
      lanes: e.lanes,
      firstContext: e.firstContext
    }), t;
  }
  function Ci(t, e, a, n, l, u) {
    var o = 0;
    if (n = t, typeof t == "function") vc(t) && (o = 1);
    else if (typeof t == "string")
      o = Gv(
        t,
        a,
        B.current
      ) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
    else
      t: switch (t) {
        case le:
          return t = Se(31, a, e, l), t.elementType = le, t.lanes = u, t;
        case J:
          return an(a.children, l, u, e);
        case H:
          o = 8, l |= 24;
          break;
        case V:
          return t = Se(12, a, e, l | 2), t.elementType = V, t.lanes = u, t;
        case Ut:
          return t = Se(13, a, e, l), t.elementType = Ut, t.lanes = u, t;
        case Bt:
          return t = Se(19, a, e, l), t.elementType = Bt, t.lanes = u, t;
        default:
          if (typeof t == "object" && t !== null)
            switch (t.$$typeof) {
              case lt:
                o = 10;
                break t;
              case ft:
                o = 9;
                break t;
              case pt:
                o = 11;
                break t;
              case tt:
                o = 14;
                break t;
              case Vt:
                o = 16, n = null;
                break t;
            }
          o = 29, a = Error(
            s(130, t === null ? "null" : typeof t, "")
          ), n = null;
      }
    return e = Se(o, a, e, l), e.elementType = t, e.type = n, e.lanes = u, e;
  }
  function an(t, e, a, n) {
    return t = Se(7, t, n, e), t.lanes = a, t;
  }
  function yc(t, e, a) {
    return t = Se(6, t, null, e), t.lanes = a, t;
  }
  function Dr(t) {
    var e = Se(18, null, null, 0);
    return e.stateNode = t, e;
  }
  function gc(t, e, a) {
    return e = Se(
      4,
      t.children !== null ? t.children : [],
      t.key,
      e
    ), e.lanes = a, e.stateNode = {
      containerInfo: t.containerInfo,
      pendingChildren: null,
      implementation: t.implementation
    }, e;
  }
  var wr = /* @__PURE__ */ new WeakMap();
  function Me(t, e) {
    if (typeof t == "object" && t !== null) {
      var a = wr.get(t);
      return a !== void 0 ? a : (e = {
        value: t,
        source: e,
        stack: Pe(e)
      }, wr.set(t, e), e);
    }
    return {
      value: t,
      source: e,
      stack: Pe(e)
    };
  }
  var Un = [], qn = 0, Mi = null, Al = 0, Re = [], Ne = 0, Da = null, Ze = 1, Ve = "";
  function ia(t, e) {
    Un[qn++] = Al, Un[qn++] = Mi, Mi = t, Al = e;
  }
  function _r(t, e, a) {
    Re[Ne++] = Ze, Re[Ne++] = Ve, Re[Ne++] = Da, Da = t;
    var n = Ze;
    t = Ve;
    var l = 32 - It(n) - 1;
    n &= ~(1 << l), a += 1;
    var u = 32 - It(e) + l;
    if (30 < u) {
      var o = l - l % 5;
      u = (n & (1 << o) - 1).toString(32), n >>= o, l -= o, Ze = 1 << 32 - It(e) + l | a << l | n, Ve = u + t;
    } else
      Ze = 1 << u | a << l | n, Ve = t;
  }
  function bc(t) {
    t.return !== null && (ia(t, 1), _r(t, 1, 0));
  }
  function xc(t) {
    for (; t === Mi; )
      Mi = Un[--qn], Un[qn] = null, Al = Un[--qn], Un[qn] = null;
    for (; t === Da; )
      Da = Re[--Ne], Re[Ne] = null, Ve = Re[--Ne], Re[Ne] = null, Ze = Re[--Ne], Re[Ne] = null;
  }
  function jr(t, e) {
    Re[Ne++] = Ze, Re[Ne++] = Ve, Re[Ne++] = Da, Ze = e.id, Ve = e.overflow, Da = t;
  }
  var te = null, Dt = null, rt = !1, wa = null, Ue = !1, Sc = Error(s(519));
  function _a(t) {
    var e = Error(
      s(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw zl(Me(e, t)), Sc;
  }
  function Cr(t) {
    var e = t.stateNode, a = t.type, n = t.memoizedProps;
    switch (e[Pt] = t, e[re] = n, a) {
      case "dialog":
        ct("cancel", e), ct("close", e);
        break;
      case "iframe":
      case "object":
      case "embed":
        ct("load", e);
        break;
      case "video":
      case "audio":
        for (a = 0; a < Kl.length; a++)
          ct(Kl[a], e);
        break;
      case "source":
        ct("error", e);
        break;
      case "img":
      case "image":
      case "link":
        ct("error", e), ct("load", e);
        break;
      case "details":
        ct("toggle", e);
        break;
      case "input":
        ct("invalid", e), Xs(
          e,
          n.value,
          n.defaultValue,
          n.checked,
          n.defaultChecked,
          n.type,
          n.name,
          !0
        );
        break;
      case "select":
        ct("invalid", e);
        break;
      case "textarea":
        ct("invalid", e), Vs(e, n.value, n.defaultValue, n.children);
    }
    a = n.children, typeof a != "string" && typeof a != "number" && typeof a != "bigint" || e.textContent === "" + a || n.suppressHydrationWarning === !0 || Fp(e.textContent, a) ? (n.popover != null && (ct("beforetoggle", e), ct("toggle", e)), n.onScroll != null && ct("scroll", e), n.onScrollEnd != null && ct("scrollend", e), n.onClick != null && (e.onclick = aa), e = !0) : e = !1, e || _a(t, !0);
  }
  function Mr(t) {
    for (te = t.return; te; )
      switch (te.tag) {
        case 5:
        case 31:
        case 13:
          Ue = !1;
          return;
        case 27:
        case 3:
          Ue = !0;
          return;
        default:
          te = te.return;
      }
  }
  function Hn(t) {
    if (t !== te) return !1;
    if (!rt) return Mr(t), rt = !0, !1;
    var e = t.tag, a;
    if ((a = e !== 3 && e !== 27) && ((a = e === 5) && (a = t.type, a = !(a !== "form" && a !== "button") || Go(t.type, t.memoizedProps)), a = !a), a && Dt && _a(t), Mr(t), e === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
      Dt = ld(t);
    } else if (e === 31) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(317));
      Dt = ld(t);
    } else
      e === 27 ? (e = Dt, ka(t.type) ? (t = Zo, Zo = null, Dt = t) : Dt = e) : Dt = te ? He(t.stateNode.nextSibling) : null;
    return !0;
  }
  function nn() {
    Dt = te = null, rt = !1;
  }
  function Ec() {
    var t = wa;
    return t !== null && (he === null ? he = t : he.push.apply(
      he,
      t
    ), wa = null), t;
  }
  function zl(t) {
    wa === null ? wa = [t] : wa.push(t);
  }
  var Tc = h(null), ln = null, ua = null;
  function ja(t, e, a) {
    N(Tc, e._currentValue), e._currentValue = a;
  }
  function ca(t) {
    t._currentValue = Tc.current, _(Tc);
  }
  function Ac(t, e, a) {
    for (; t !== null; ) {
      var n = t.alternate;
      if ((t.childLanes & e) !== e ? (t.childLanes |= e, n !== null && (n.childLanes |= e)) : n !== null && (n.childLanes & e) !== e && (n.childLanes |= e), t === a) break;
      t = t.return;
    }
  }
  function zc(t, e, a, n) {
    var l = t.child;
    for (l !== null && (l.return = t); l !== null; ) {
      var u = l.dependencies;
      if (u !== null) {
        var o = l.child;
        u = u.firstContext;
        t: for (; u !== null; ) {
          var f = u;
          u = l;
          for (var d = 0; d < e.length; d++)
            if (f.context === e[d]) {
              u.lanes |= a, f = u.alternate, f !== null && (f.lanes |= a), Ac(
                u.return,
                a,
                t
              ), n || (o = null);
              break t;
            }
          u = f.next;
        }
      } else if (l.tag === 18) {
        if (o = l.return, o === null) throw Error(s(341));
        o.lanes |= a, u = o.alternate, u !== null && (u.lanes |= a), Ac(o, a, t), o = null;
      } else o = l.child;
      if (o !== null) o.return = l;
      else
        for (o = l; o !== null; ) {
          if (o === t) {
            o = null;
            break;
          }
          if (l = o.sibling, l !== null) {
            l.return = o.return, o = l;
            break;
          }
          o = o.return;
        }
      l = o;
    }
  }
  function Bn(t, e, a, n) {
    t = null;
    for (var l = e, u = !1; l !== null; ) {
      if (!u) {
        if ((l.flags & 524288) !== 0) u = !0;
        else if ((l.flags & 262144) !== 0) break;
      }
      if (l.tag === 10) {
        var o = l.alternate;
        if (o === null) throw Error(s(387));
        if (o = o.memoizedProps, o !== null) {
          var f = l.type;
          xe(l.pendingProps.value, o.value) || (t !== null ? t.push(f) : t = [f]);
        }
      } else if (l === it.current) {
        if (o = l.alternate, o === null) throw Error(s(387));
        o.memoizedState.memoizedState !== l.memoizedState.memoizedState && (t !== null ? t.push(Il) : t = [Il]);
      }
      l = l.return;
    }
    t !== null && zc(
      e,
      t,
      a,
      n
    ), e.flags |= 262144;
  }
  function Ri(t) {
    for (t = t.firstContext; t !== null; ) {
      if (!xe(
        t.context._currentValue,
        t.memoizedValue
      ))
        return !0;
      t = t.next;
    }
    return !1;
  }
  function un(t) {
    ln = t, ua = null, t = t.dependencies, t !== null && (t.firstContext = null);
  }
  function ee(t) {
    return Rr(ln, t);
  }
  function Ni(t, e) {
    return ln === null && un(t), Rr(t, e);
  }
  function Rr(t, e) {
    var a = e._currentValue;
    if (e = { context: e, memoizedValue: a, next: null }, ua === null) {
      if (t === null) throw Error(s(308));
      ua = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
    } else ua = ua.next = e;
    return a;
  }
  var qh = typeof AbortController < "u" ? AbortController : function() {
    var t = [], e = this.signal = {
      aborted: !1,
      addEventListener: function(a, n) {
        t.push(n);
      }
    };
    this.abort = function() {
      e.aborted = !0, t.forEach(function(a) {
        return a();
      });
    };
  }, Hh = i.unstable_scheduleCallback, Bh = i.unstable_NormalPriority, Lt = {
    $$typeof: lt,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function Oc() {
    return {
      controller: new qh(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function Ol(t) {
    t.refCount--, t.refCount === 0 && Hh(Bh, function() {
      t.controller.abort();
    });
  }
  var Dl = null, Dc = 0, Ln = 0, Gn = null;
  function Lh(t, e) {
    if (Dl === null) {
      var a = Dl = [];
      Dc = 0, Ln = Co(), Gn = {
        status: "pending",
        value: void 0,
        then: function(n) {
          a.push(n);
        }
      };
    }
    return Dc++, e.then(Nr, Nr), e;
  }
  function Nr() {
    if (--Dc === 0 && Dl !== null) {
      Gn !== null && (Gn.status = "fulfilled");
      var t = Dl;
      Dl = null, Ln = 0, Gn = null;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
  }
  function Gh(t, e) {
    var a = [], n = {
      status: "pending",
      value: null,
      reason: null,
      then: function(l) {
        a.push(l);
      }
    };
    return t.then(
      function() {
        n.status = "fulfilled", n.value = e;
        for (var l = 0; l < a.length; l++) (0, a[l])(e);
      },
      function(l) {
        for (n.status = "rejected", n.reason = l, l = 0; l < a.length; l++)
          (0, a[l])(void 0);
      }
    ), n;
  }
  var Ur = D.S;
  D.S = function(t, e) {
    bp = ue(), typeof e == "object" && e !== null && typeof e.then == "function" && Lh(t, e), Ur !== null && Ur(t, e);
  };
  var cn = h(null);
  function wc() {
    var t = cn.current;
    return t !== null ? t : Et.pooledCache;
  }
  function Ui(t, e) {
    e === null ? N(cn, cn.current) : N(cn, e.pool);
  }
  function qr() {
    var t = wc();
    return t === null ? null : { parent: Lt._currentValue, pool: t };
  }
  var Qn = Error(s(460)), _c = Error(s(474)), qi = Error(s(542)), Hi = { then: function() {
  } };
  function Hr(t) {
    return t = t.status, t === "fulfilled" || t === "rejected";
  }
  function Br(t, e, a) {
    switch (a = t[a], a === void 0 ? t.push(e) : a !== e && (e.then(aa, aa), e = a), e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw t = e.reason, Gr(t), t;
      default:
        if (typeof e.status == "string") e.then(aa, aa);
        else {
          if (t = Et, t !== null && 100 < t.shellSuspendCounter)
            throw Error(s(482));
          t = e, t.status = "pending", t.then(
            function(n) {
              if (e.status === "pending") {
                var l = e;
                l.status = "fulfilled", l.value = n;
              }
            },
            function(n) {
              if (e.status === "pending") {
                var l = e;
                l.status = "rejected", l.reason = n;
              }
            }
          );
        }
        switch (e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, Gr(t), t;
        }
        throw sn = e, Qn;
    }
  }
  function on(t) {
    try {
      var e = t._init;
      return e(t._payload);
    } catch (a) {
      throw a !== null && typeof a == "object" && typeof a.then == "function" ? (sn = a, Qn) : a;
    }
  }
  var sn = null;
  function Lr() {
    if (sn === null) throw Error(s(459));
    var t = sn;
    return sn = null, t;
  }
  function Gr(t) {
    if (t === Qn || t === qi)
      throw Error(s(483));
  }
  var Yn = null, wl = 0;
  function Bi(t) {
    var e = wl;
    return wl += 1, Yn === null && (Yn = []), Br(Yn, t, e);
  }
  function _l(t, e) {
    e = e.props.ref, t.ref = e !== void 0 ? e : null;
  }
  function Li(t, e) {
    throw e.$$typeof === Q ? Error(s(525)) : (t = Object.prototype.toString.call(e), Error(
      s(
        31,
        t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
      )
    ));
  }
  function Qr(t) {
    function e(y, m) {
      if (t) {
        var b = y.deletions;
        b === null ? (y.deletions = [m], y.flags |= 16) : b.push(m);
      }
    }
    function a(y, m) {
      if (!t) return null;
      for (; m !== null; )
        e(y, m), m = m.sibling;
      return null;
    }
    function n(y) {
      for (var m = /* @__PURE__ */ new Map(); y !== null; )
        y.key !== null ? m.set(y.key, y) : m.set(y.index, y), y = y.sibling;
      return m;
    }
    function l(y, m) {
      return y = la(y, m), y.index = 0, y.sibling = null, y;
    }
    function u(y, m, b) {
      return y.index = b, t ? (b = y.alternate, b !== null ? (b = b.index, b < m ? (y.flags |= 67108866, m) : b) : (y.flags |= 67108866, m)) : (y.flags |= 1048576, m);
    }
    function o(y) {
      return t && y.alternate === null && (y.flags |= 67108866), y;
    }
    function f(y, m, b, w) {
      return m === null || m.tag !== 6 ? (m = yc(b, y.mode, w), m.return = y, m) : (m = l(m, b), m.return = y, m);
    }
    function d(y, m, b, w) {
      var Y = b.type;
      return Y === J ? O(
        y,
        m,
        b.props.children,
        w,
        b.key
      ) : m !== null && (m.elementType === Y || typeof Y == "object" && Y !== null && Y.$$typeof === Vt && on(Y) === m.type) ? (m = l(m, b.props), _l(m, b), m.return = y, m) : (m = Ci(
        b.type,
        b.key,
        b.props,
        null,
        y.mode,
        w
      ), _l(m, b), m.return = y, m);
    }
    function x(y, m, b, w) {
      return m === null || m.tag !== 4 || m.stateNode.containerInfo !== b.containerInfo || m.stateNode.implementation !== b.implementation ? (m = gc(b, y.mode, w), m.return = y, m) : (m = l(m, b.children || []), m.return = y, m);
    }
    function O(y, m, b, w, Y) {
      return m === null || m.tag !== 7 ? (m = an(
        b,
        y.mode,
        w,
        Y
      ), m.return = y, m) : (m = l(m, b), m.return = y, m);
    }
    function j(y, m, b) {
      if (typeof m == "string" && m !== "" || typeof m == "number" || typeof m == "bigint")
        return m = yc(
          "" + m,
          y.mode,
          b
        ), m.return = y, m;
      if (typeof m == "object" && m !== null) {
        switch (m.$$typeof) {
          case k:
            return b = Ci(
              m.type,
              m.key,
              m.props,
              null,
              y.mode,
              b
            ), _l(b, m), b.return = y, b;
          case W:
            return m = gc(
              m,
              y.mode,
              b
            ), m.return = y, m;
          case Vt:
            return m = on(m), j(y, m, b);
        }
        if (jt(m) || Kt(m))
          return m = an(
            m,
            y.mode,
            b,
            null
          ), m.return = y, m;
        if (typeof m.then == "function")
          return j(y, Bi(m), b);
        if (m.$$typeof === lt)
          return j(
            y,
            Ni(y, m),
            b
          );
        Li(y, m);
      }
      return null;
    }
    function E(y, m, b, w) {
      var Y = m !== null ? m.key : null;
      if (typeof b == "string" && b !== "" || typeof b == "number" || typeof b == "bigint")
        return Y !== null ? null : f(y, m, "" + b, w);
      if (typeof b == "object" && b !== null) {
        switch (b.$$typeof) {
          case k:
            return b.key === Y ? d(y, m, b, w) : null;
          case W:
            return b.key === Y ? x(y, m, b, w) : null;
          case Vt:
            return b = on(b), E(y, m, b, w);
        }
        if (jt(b) || Kt(b))
          return Y !== null ? null : O(y, m, b, w, null);
        if (typeof b.then == "function")
          return E(
            y,
            m,
            Bi(b),
            w
          );
        if (b.$$typeof === lt)
          return E(
            y,
            m,
            Ni(y, b),
            w
          );
        Li(y, b);
      }
      return null;
    }
    function z(y, m, b, w, Y) {
      if (typeof w == "string" && w !== "" || typeof w == "number" || typeof w == "bigint")
        return y = y.get(b) || null, f(m, y, "" + w, Y);
      if (typeof w == "object" && w !== null) {
        switch (w.$$typeof) {
          case k:
            return y = y.get(
              w.key === null ? b : w.key
            ) || null, d(m, y, w, Y);
          case W:
            return y = y.get(
              w.key === null ? b : w.key
            ) || null, x(m, y, w, Y);
          case Vt:
            return w = on(w), z(
              y,
              m,
              b,
              w,
              Y
            );
        }
        if (jt(w) || Kt(w))
          return y = y.get(b) || null, O(m, y, w, Y, null);
        if (typeof w.then == "function")
          return z(
            y,
            m,
            b,
            Bi(w),
            Y
          );
        if (w.$$typeof === lt)
          return z(
            y,
            m,
            b,
            Ni(m, w),
            Y
          );
        Li(m, w);
      }
      return null;
    }
    function L(y, m, b, w) {
      for (var Y = null, dt = null, G = m, at = m = 0, st = null; G !== null && at < b.length; at++) {
        G.index > at ? (st = G, G = null) : st = G.sibling;
        var mt = E(
          y,
          G,
          b[at],
          w
        );
        if (mt === null) {
          G === null && (G = st);
          break;
        }
        t && G && mt.alternate === null && e(y, G), m = u(mt, m, at), dt === null ? Y = mt : dt.sibling = mt, dt = mt, G = st;
      }
      if (at === b.length)
        return a(y, G), rt && ia(y, at), Y;
      if (G === null) {
        for (; at < b.length; at++)
          G = j(y, b[at], w), G !== null && (m = u(
            G,
            m,
            at
          ), dt === null ? Y = G : dt.sibling = G, dt = G);
        return rt && ia(y, at), Y;
      }
      for (G = n(G); at < b.length; at++)
        st = z(
          G,
          y,
          at,
          b[at],
          w
        ), st !== null && (t && st.alternate !== null && G.delete(
          st.key === null ? at : st.key
        ), m = u(
          st,
          m,
          at
        ), dt === null ? Y = st : dt.sibling = st, dt = st);
      return t && G.forEach(function(Ja) {
        return e(y, Ja);
      }), rt && ia(y, at), Y;
    }
    function K(y, m, b, w) {
      if (b == null) throw Error(s(151));
      for (var Y = null, dt = null, G = m, at = m = 0, st = null, mt = b.next(); G !== null && !mt.done; at++, mt = b.next()) {
        G.index > at ? (st = G, G = null) : st = G.sibling;
        var Ja = E(y, G, mt.value, w);
        if (Ja === null) {
          G === null && (G = st);
          break;
        }
        t && G && Ja.alternate === null && e(y, G), m = u(Ja, m, at), dt === null ? Y = Ja : dt.sibling = Ja, dt = Ja, G = st;
      }
      if (mt.done)
        return a(y, G), rt && ia(y, at), Y;
      if (G === null) {
        for (; !mt.done; at++, mt = b.next())
          mt = j(y, mt.value, w), mt !== null && (m = u(mt, m, at), dt === null ? Y = mt : dt.sibling = mt, dt = mt);
        return rt && ia(y, at), Y;
      }
      for (G = n(G); !mt.done; at++, mt = b.next())
        mt = z(G, y, at, mt.value, w), mt !== null && (t && mt.alternate !== null && G.delete(mt.key === null ? at : mt.key), m = u(mt, m, at), dt === null ? Y = mt : dt.sibling = mt, dt = mt);
      return t && G.forEach(function($v) {
        return e(y, $v);
      }), rt && ia(y, at), Y;
    }
    function St(y, m, b, w) {
      if (typeof b == "object" && b !== null && b.type === J && b.key === null && (b = b.props.children), typeof b == "object" && b !== null) {
        switch (b.$$typeof) {
          case k:
            t: {
              for (var Y = b.key; m !== null; ) {
                if (m.key === Y) {
                  if (Y = b.type, Y === J) {
                    if (m.tag === 7) {
                      a(
                        y,
                        m.sibling
                      ), w = l(
                        m,
                        b.props.children
                      ), w.return = y, y = w;
                      break t;
                    }
                  } else if (m.elementType === Y || typeof Y == "object" && Y !== null && Y.$$typeof === Vt && on(Y) === m.type) {
                    a(
                      y,
                      m.sibling
                    ), w = l(m, b.props), _l(w, b), w.return = y, y = w;
                    break t;
                  }
                  a(y, m);
                  break;
                } else e(y, m);
                m = m.sibling;
              }
              b.type === J ? (w = an(
                b.props.children,
                y.mode,
                w,
                b.key
              ), w.return = y, y = w) : (w = Ci(
                b.type,
                b.key,
                b.props,
                null,
                y.mode,
                w
              ), _l(w, b), w.return = y, y = w);
            }
            return o(y);
          case W:
            t: {
              for (Y = b.key; m !== null; ) {
                if (m.key === Y)
                  if (m.tag === 4 && m.stateNode.containerInfo === b.containerInfo && m.stateNode.implementation === b.implementation) {
                    a(
                      y,
                      m.sibling
                    ), w = l(m, b.children || []), w.return = y, y = w;
                    break t;
                  } else {
                    a(y, m);
                    break;
                  }
                else e(y, m);
                m = m.sibling;
              }
              w = gc(b, y.mode, w), w.return = y, y = w;
            }
            return o(y);
          case Vt:
            return b = on(b), St(
              y,
              m,
              b,
              w
            );
        }
        if (jt(b))
          return L(
            y,
            m,
            b,
            w
          );
        if (Kt(b)) {
          if (Y = Kt(b), typeof Y != "function") throw Error(s(150));
          return b = Y.call(b), K(
            y,
            m,
            b,
            w
          );
        }
        if (typeof b.then == "function")
          return St(
            y,
            m,
            Bi(b),
            w
          );
        if (b.$$typeof === lt)
          return St(
            y,
            m,
            Ni(y, b),
            w
          );
        Li(y, b);
      }
      return typeof b == "string" && b !== "" || typeof b == "number" || typeof b == "bigint" ? (b = "" + b, m !== null && m.tag === 6 ? (a(y, m.sibling), w = l(m, b), w.return = y, y = w) : (a(y, m), w = yc(b, y.mode, w), w.return = y, y = w), o(y)) : a(y, m);
    }
    return function(y, m, b, w) {
      try {
        wl = 0;
        var Y = St(
          y,
          m,
          b,
          w
        );
        return Yn = null, Y;
      } catch (G) {
        if (G === Qn || G === qi) throw G;
        var dt = Se(29, G, null, y.mode);
        return dt.lanes = w, dt.return = y, dt;
      }
    };
  }
  var rn = Qr(!0), Yr = Qr(!1), Ca = !1;
  function jc(t) {
    t.updateQueue = {
      baseState: t.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function Cc(t, e) {
    t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
      baseState: t.baseState,
      firstBaseUpdate: t.firstBaseUpdate,
      lastBaseUpdate: t.lastBaseUpdate,
      shared: t.shared,
      callbacks: null
    });
  }
  function Ma(t) {
    return { lane: t, tag: 0, payload: null, callback: null, next: null };
  }
  function Ra(t, e, a) {
    var n = t.updateQueue;
    if (n === null) return null;
    if (n = n.shared, (ht & 2) !== 0) {
      var l = n.pending;
      return l === null ? e.next = e : (e.next = l.next, l.next = e), n.pending = e, e = ji(t), zr(t, null, a), e;
    }
    return _i(t, n, e, a), ji(t);
  }
  function jl(t, e, a) {
    if (e = e.updateQueue, e !== null && (e = e.shared, (a & 4194048) !== 0)) {
      var n = e.lanes;
      n &= t.pendingLanes, a |= n, e.lanes = a, Rs(t, a);
    }
  }
  function Mc(t, e) {
    var a = t.updateQueue, n = t.alternate;
    if (n !== null && (n = n.updateQueue, a === n)) {
      var l = null, u = null;
      if (a = a.firstBaseUpdate, a !== null) {
        do {
          var o = {
            lane: a.lane,
            tag: a.tag,
            payload: a.payload,
            callback: null,
            next: null
          };
          u === null ? l = u = o : u = u.next = o, a = a.next;
        } while (a !== null);
        u === null ? l = u = e : u = u.next = e;
      } else l = u = e;
      a = {
        baseState: n.baseState,
        firstBaseUpdate: l,
        lastBaseUpdate: u,
        shared: n.shared,
        callbacks: n.callbacks
      }, t.updateQueue = a;
      return;
    }
    t = a.lastBaseUpdate, t === null ? a.firstBaseUpdate = e : t.next = e, a.lastBaseUpdate = e;
  }
  var Rc = !1;
  function Cl() {
    if (Rc) {
      var t = Gn;
      if (t !== null) throw t;
    }
  }
  function Ml(t, e, a, n) {
    Rc = !1;
    var l = t.updateQueue;
    Ca = !1;
    var u = l.firstBaseUpdate, o = l.lastBaseUpdate, f = l.shared.pending;
    if (f !== null) {
      l.shared.pending = null;
      var d = f, x = d.next;
      d.next = null, o === null ? u = x : o.next = x, o = d;
      var O = t.alternate;
      O !== null && (O = O.updateQueue, f = O.lastBaseUpdate, f !== o && (f === null ? O.firstBaseUpdate = x : f.next = x, O.lastBaseUpdate = d));
    }
    if (u !== null) {
      var j = l.baseState;
      o = 0, O = x = d = null, f = u;
      do {
        var E = f.lane & -536870913, z = E !== f.lane;
        if (z ? (ot & E) === E : (n & E) === E) {
          E !== 0 && E === Ln && (Rc = !0), O !== null && (O = O.next = {
            lane: 0,
            tag: f.tag,
            payload: f.payload,
            callback: null,
            next: null
          });
          t: {
            var L = t, K = f;
            E = e;
            var St = a;
            switch (K.tag) {
              case 1:
                if (L = K.payload, typeof L == "function") {
                  j = L.call(St, j, E);
                  break t;
                }
                j = L;
                break t;
              case 3:
                L.flags = L.flags & -65537 | 128;
              case 0:
                if (L = K.payload, E = typeof L == "function" ? L.call(St, j, E) : L, E == null) break t;
                j = M({}, j, E);
                break t;
              case 2:
                Ca = !0;
            }
          }
          E = f.callback, E !== null && (t.flags |= 64, z && (t.flags |= 8192), z = l.callbacks, z === null ? l.callbacks = [E] : z.push(E));
        } else
          z = {
            lane: E,
            tag: f.tag,
            payload: f.payload,
            callback: f.callback,
            next: null
          }, O === null ? (x = O = z, d = j) : O = O.next = z, o |= E;
        if (f = f.next, f === null) {
          if (f = l.shared.pending, f === null)
            break;
          z = f, f = z.next, z.next = null, l.lastBaseUpdate = z, l.shared.pending = null;
        }
      } while (!0);
      O === null && (d = j), l.baseState = d, l.firstBaseUpdate = x, l.lastBaseUpdate = O, u === null && (l.shared.lanes = 0), Ba |= o, t.lanes = o, t.memoizedState = j;
    }
  }
  function kr(t, e) {
    if (typeof t != "function")
      throw Error(s(191, t));
    t.call(e);
  }
  function Xr(t, e) {
    var a = t.callbacks;
    if (a !== null)
      for (t.callbacks = null, t = 0; t < a.length; t++)
        kr(a[t], e);
  }
  var kn = h(null), Gi = h(0);
  function Zr(t, e) {
    t = va, N(Gi, t), N(kn, e), va = t | e.baseLanes;
  }
  function Nc() {
    N(Gi, va), N(kn, kn.current);
  }
  function Uc() {
    va = Gi.current, _(kn), _(Gi);
  }
  var Ee = h(null), qe = null;
  function Na(t) {
    var e = t.alternate;
    N(qt, qt.current & 1), N(Ee, t), qe === null && (e === null || kn.current !== null || e.memoizedState !== null) && (qe = t);
  }
  function qc(t) {
    N(qt, qt.current), N(Ee, t), qe === null && (qe = t);
  }
  function Vr(t) {
    t.tag === 22 ? (N(qt, qt.current), N(Ee, t), qe === null && (qe = t)) : Ua();
  }
  function Ua() {
    N(qt, qt.current), N(Ee, Ee.current);
  }
  function Te(t) {
    _(Ee), qe === t && (qe = null), _(qt);
  }
  var qt = h(0);
  function Qi(t) {
    for (var e = t; e !== null; ) {
      if (e.tag === 13) {
        var a = e.memoizedState;
        if (a !== null && (a = a.dehydrated, a === null || ko(a) || Xo(a)))
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
  var oa = 0, et = null, bt = null, Gt = null, Yi = !1, Xn = !1, fn = !1, ki = 0, Rl = 0, Zn = null, Qh = 0;
  function Rt() {
    throw Error(s(321));
  }
  function Hc(t, e) {
    if (e === null) return !1;
    for (var a = 0; a < e.length && a < t.length; a++)
      if (!xe(t[a], e[a])) return !1;
    return !0;
  }
  function Bc(t, e, a, n, l, u) {
    return oa = u, et = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, D.H = t === null || t.memoizedState === null ? jf : Pc, fn = !1, u = a(n, l), fn = !1, Xn && (u = Jr(
      e,
      a,
      n,
      l
    )), Kr(t), u;
  }
  function Kr(t) {
    D.H = ql;
    var e = bt !== null && bt.next !== null;
    if (oa = 0, Gt = bt = et = null, Yi = !1, Rl = 0, Zn = null, e) throw Error(s(300));
    t === null || Qt || (t = t.dependencies, t !== null && Ri(t) && (Qt = !0));
  }
  function Jr(t, e, a, n) {
    et = t;
    var l = 0;
    do {
      if (Xn && (Zn = null), Rl = 0, Xn = !1, 25 <= l) throw Error(s(301));
      if (l += 1, Gt = bt = null, t.updateQueue != null) {
        var u = t.updateQueue;
        u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
      }
      D.H = Cf, u = e(a, n);
    } while (Xn);
    return u;
  }
  function Yh() {
    var t = D.H, e = t.useState()[0];
    return e = typeof e.then == "function" ? Nl(e) : e, t = t.useState()[0], (bt !== null ? bt.memoizedState : null) !== t && (et.flags |= 1024), e;
  }
  function Lc() {
    var t = ki !== 0;
    return ki = 0, t;
  }
  function Gc(t, e, a) {
    e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~a;
  }
  function Qc(t) {
    if (Yi) {
      for (t = t.memoizedState; t !== null; ) {
        var e = t.queue;
        e !== null && (e.pending = null), t = t.next;
      }
      Yi = !1;
    }
    oa = 0, Gt = bt = et = null, Xn = !1, Rl = ki = 0, Zn = null;
  }
  function ce() {
    var t = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return Gt === null ? et.memoizedState = Gt = t : Gt = Gt.next = t, Gt;
  }
  function Ht() {
    if (bt === null) {
      var t = et.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = bt.next;
    var e = Gt === null ? et.memoizedState : Gt.next;
    if (e !== null)
      Gt = e, bt = t;
    else {
      if (t === null)
        throw et.alternate === null ? Error(s(467)) : Error(s(310));
      bt = t, t = {
        memoizedState: bt.memoizedState,
        baseState: bt.baseState,
        baseQueue: bt.baseQueue,
        queue: bt.queue,
        next: null
      }, Gt === null ? et.memoizedState = Gt = t : Gt = Gt.next = t;
    }
    return Gt;
  }
  function Xi() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function Nl(t) {
    var e = Rl;
    return Rl += 1, Zn === null && (Zn = []), t = Br(Zn, t, e), e = et, (Gt === null ? e.memoizedState : Gt.next) === null && (e = e.alternate, D.H = e === null || e.memoizedState === null ? jf : Pc), t;
  }
  function Zi(t) {
    if (t !== null && typeof t == "object") {
      if (typeof t.then == "function") return Nl(t);
      if (t.$$typeof === lt) return ee(t);
    }
    throw Error(s(438, String(t)));
  }
  function Yc(t) {
    var e = null, a = et.updateQueue;
    if (a !== null && (e = a.memoCache), e == null) {
      var n = et.alternate;
      n !== null && (n = n.updateQueue, n !== null && (n = n.memoCache, n != null && (e = {
        data: n.data.map(function(l) {
          return l.slice();
        }),
        index: 0
      })));
    }
    if (e == null && (e = { data: [], index: 0 }), a === null && (a = Xi(), et.updateQueue = a), a.memoCache = e, a = e.data[e.index], a === void 0)
      for (a = e.data[e.index] = Array(t), n = 0; n < t; n++)
        a[n] = De;
    return e.index++, a;
  }
  function sa(t, e) {
    return typeof e == "function" ? e(t) : e;
  }
  function Vi(t) {
    var e = Ht();
    return kc(e, bt, t);
  }
  function kc(t, e, a) {
    var n = t.queue;
    if (n === null) throw Error(s(311));
    n.lastRenderedReducer = a;
    var l = t.baseQueue, u = n.pending;
    if (u !== null) {
      if (l !== null) {
        var o = l.next;
        l.next = u.next, u.next = o;
      }
      e.baseQueue = l = u, n.pending = null;
    }
    if (u = t.baseState, l === null) t.memoizedState = u;
    else {
      e = l.next;
      var f = o = null, d = null, x = e, O = !1;
      do {
        var j = x.lane & -536870913;
        if (j !== x.lane ? (ot & j) === j : (oa & j) === j) {
          var E = x.revertLane;
          if (E === 0)
            d !== null && (d = d.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: x.action,
              hasEagerState: x.hasEagerState,
              eagerState: x.eagerState,
              next: null
            }), j === Ln && (O = !0);
          else if ((oa & E) === E) {
            x = x.next, E === Ln && (O = !0);
            continue;
          } else
            j = {
              lane: 0,
              revertLane: x.revertLane,
              gesture: null,
              action: x.action,
              hasEagerState: x.hasEagerState,
              eagerState: x.eagerState,
              next: null
            }, d === null ? (f = d = j, o = u) : d = d.next = j, et.lanes |= E, Ba |= E;
          j = x.action, fn && a(u, j), u = x.hasEagerState ? x.eagerState : a(u, j);
        } else
          E = {
            lane: j,
            revertLane: x.revertLane,
            gesture: x.gesture,
            action: x.action,
            hasEagerState: x.hasEagerState,
            eagerState: x.eagerState,
            next: null
          }, d === null ? (f = d = E, o = u) : d = d.next = E, et.lanes |= j, Ba |= j;
        x = x.next;
      } while (x !== null && x !== e);
      if (d === null ? o = u : d.next = f, !xe(u, t.memoizedState) && (Qt = !0, O && (a = Gn, a !== null)))
        throw a;
      t.memoizedState = u, t.baseState = o, t.baseQueue = d, n.lastRenderedState = u;
    }
    return l === null && (n.lanes = 0), [t.memoizedState, n.dispatch];
  }
  function Xc(t) {
    var e = Ht(), a = e.queue;
    if (a === null) throw Error(s(311));
    a.lastRenderedReducer = t;
    var n = a.dispatch, l = a.pending, u = e.memoizedState;
    if (l !== null) {
      a.pending = null;
      var o = l = l.next;
      do
        u = t(u, o.action), o = o.next;
      while (o !== l);
      xe(u, e.memoizedState) || (Qt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), a.lastRenderedState = u;
    }
    return [u, n];
  }
  function Fr(t, e, a) {
    var n = et, l = Ht(), u = rt;
    if (u) {
      if (a === void 0) throw Error(s(407));
      a = a();
    } else a = e();
    var o = !xe(
      (bt || l).memoizedState,
      a
    );
    if (o && (l.memoizedState = a, Qt = !0), l = l.queue, Kc(Ir.bind(null, n, l, t), [
      t
    ]), l.getSnapshot !== e || o || Gt !== null && Gt.memoizedState.tag & 1) {
      if (n.flags |= 2048, Vn(
        9,
        { destroy: void 0 },
        $r.bind(
          null,
          n,
          l,
          a,
          e
        ),
        null
      ), Et === null) throw Error(s(349));
      u || (oa & 127) !== 0 || Wr(n, e, a);
    }
    return a;
  }
  function Wr(t, e, a) {
    t.flags |= 16384, t = { getSnapshot: e, value: a }, e = et.updateQueue, e === null ? (e = Xi(), et.updateQueue = e, e.stores = [t]) : (a = e.stores, a === null ? e.stores = [t] : a.push(t));
  }
  function $r(t, e, a, n) {
    e.value = a, e.getSnapshot = n, Pr(e) && tf(t);
  }
  function Ir(t, e, a) {
    return a(function() {
      Pr(e) && tf(t);
    });
  }
  function Pr(t) {
    var e = t.getSnapshot;
    t = t.value;
    try {
      var a = e();
      return !xe(t, a);
    } catch {
      return !0;
    }
  }
  function tf(t) {
    var e = en(t, 2);
    e !== null && ve(e, t, 2);
  }
  function Zc(t) {
    var e = ce();
    if (typeof t == "function") {
      var a = t;
      if (t = a(), fn) {
        be(!0);
        try {
          a();
        } finally {
          be(!1);
        }
      }
    }
    return e.memoizedState = e.baseState = t, e.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: sa,
      lastRenderedState: t
    }, e;
  }
  function ef(t, e, a, n) {
    return t.baseState = a, kc(
      t,
      bt,
      typeof n == "function" ? n : sa
    );
  }
  function kh(t, e, a, n, l) {
    if (Fi(t)) throw Error(s(485));
    if (t = e.action, t !== null) {
      var u = {
        payload: l,
        action: t,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(o) {
          u.listeners.push(o);
        }
      };
      D.T !== null ? a(!0) : u.isTransition = !1, n(u), a = e.pending, a === null ? (u.next = e.pending = u, af(e, u)) : (u.next = a.next, e.pending = a.next = u);
    }
  }
  function af(t, e) {
    var a = e.action, n = e.payload, l = t.state;
    if (e.isTransition) {
      var u = D.T, o = {};
      D.T = o;
      try {
        var f = a(l, n), d = D.S;
        d !== null && d(o, f), nf(t, e, f);
      } catch (x) {
        Vc(t, e, x);
      } finally {
        u !== null && o.types !== null && (u.types = o.types), D.T = u;
      }
    } else
      try {
        u = a(l, n), nf(t, e, u);
      } catch (x) {
        Vc(t, e, x);
      }
  }
  function nf(t, e, a) {
    a !== null && typeof a == "object" && typeof a.then == "function" ? a.then(
      function(n) {
        lf(t, e, n);
      },
      function(n) {
        return Vc(t, e, n);
      }
    ) : lf(t, e, a);
  }
  function lf(t, e, a) {
    e.status = "fulfilled", e.value = a, uf(e), t.state = a, e = t.pending, e !== null && (a = e.next, a === e ? t.pending = null : (a = a.next, e.next = a, af(t, a)));
  }
  function Vc(t, e, a) {
    var n = t.pending;
    if (t.pending = null, n !== null) {
      n = n.next;
      do
        e.status = "rejected", e.reason = a, uf(e), e = e.next;
      while (e !== n);
    }
    t.action = null;
  }
  function uf(t) {
    t = t.listeners;
    for (var e = 0; e < t.length; e++) (0, t[e])();
  }
  function cf(t, e) {
    return e;
  }
  function of(t, e) {
    if (rt) {
      var a = Et.formState;
      if (a !== null) {
        t: {
          var n = et;
          if (rt) {
            if (Dt) {
              e: {
                for (var l = Dt, u = Ue; l.nodeType !== 8; ) {
                  if (!u) {
                    l = null;
                    break e;
                  }
                  if (l = He(
                    l.nextSibling
                  ), l === null) {
                    l = null;
                    break e;
                  }
                }
                u = l.data, l = u === "F!" || u === "F" ? l : null;
              }
              if (l) {
                Dt = He(
                  l.nextSibling
                ), n = l.data === "F!";
                break t;
              }
            }
            _a(n);
          }
          n = !1;
        }
        n && (e = a[0]);
      }
    }
    return a = ce(), a.memoizedState = a.baseState = e, n = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: cf,
      lastRenderedState: e
    }, a.queue = n, a = Df.bind(
      null,
      et,
      n
    ), n.dispatch = a, n = Zc(!1), u = Ic.bind(
      null,
      et,
      !1,
      n.queue
    ), n = ce(), l = {
      state: e,
      dispatch: null,
      action: t,
      pending: null
    }, n.queue = l, a = kh.bind(
      null,
      et,
      l,
      u,
      a
    ), l.dispatch = a, n.memoizedState = t, [e, a, !1];
  }
  function sf(t) {
    var e = Ht();
    return rf(e, bt, t);
  }
  function rf(t, e, a) {
    if (e = kc(
      t,
      e,
      cf
    )[0], t = Vi(sa)[0], typeof e == "object" && e !== null && typeof e.then == "function")
      try {
        var n = Nl(e);
      } catch (o) {
        throw o === Qn ? qi : o;
      }
    else n = e;
    e = Ht();
    var l = e.queue, u = l.dispatch;
    return a !== e.memoizedState && (et.flags |= 2048, Vn(
      9,
      { destroy: void 0 },
      Xh.bind(null, l, a),
      null
    )), [n, u, t];
  }
  function Xh(t, e) {
    t.action = e;
  }
  function ff(t) {
    var e = Ht(), a = bt;
    if (a !== null)
      return rf(e, a, t);
    Ht(), e = e.memoizedState, a = Ht();
    var n = a.queue.dispatch;
    return a.memoizedState = t, [e, n, !1];
  }
  function Vn(t, e, a, n) {
    return t = { tag: t, create: a, deps: n, inst: e, next: null }, e = et.updateQueue, e === null && (e = Xi(), et.updateQueue = e), a = e.lastEffect, a === null ? e.lastEffect = t.next = t : (n = a.next, a.next = t, t.next = n, e.lastEffect = t), t;
  }
  function pf() {
    return Ht().memoizedState;
  }
  function Ki(t, e, a, n) {
    var l = ce();
    et.flags |= t, l.memoizedState = Vn(
      1 | e,
      { destroy: void 0 },
      a,
      n === void 0 ? null : n
    );
  }
  function Ji(t, e, a, n) {
    var l = Ht();
    n = n === void 0 ? null : n;
    var u = l.memoizedState.inst;
    bt !== null && n !== null && Hc(n, bt.memoizedState.deps) ? l.memoizedState = Vn(e, u, a, n) : (et.flags |= t, l.memoizedState = Vn(
      1 | e,
      u,
      a,
      n
    ));
  }
  function df(t, e) {
    Ki(8390656, 8, t, e);
  }
  function Kc(t, e) {
    Ji(2048, 8, t, e);
  }
  function Zh(t) {
    et.flags |= 4;
    var e = et.updateQueue;
    if (e === null)
      e = Xi(), et.updateQueue = e, e.events = [t];
    else {
      var a = e.events;
      a === null ? e.events = [t] : a.push(t);
    }
  }
  function mf(t) {
    var e = Ht().memoizedState;
    return Zh({ ref: e, nextImpl: t }), function() {
      if ((ht & 2) !== 0) throw Error(s(440));
      return e.impl.apply(void 0, arguments);
    };
  }
  function hf(t, e) {
    return Ji(4, 2, t, e);
  }
  function vf(t, e) {
    return Ji(4, 4, t, e);
  }
  function yf(t, e) {
    if (typeof e == "function") {
      t = t();
      var a = e(t);
      return function() {
        typeof a == "function" ? a() : e(null);
      };
    }
    if (e != null)
      return t = t(), e.current = t, function() {
        e.current = null;
      };
  }
  function gf(t, e, a) {
    a = a != null ? a.concat([t]) : null, Ji(4, 4, yf.bind(null, e, t), a);
  }
  function Jc() {
  }
  function bf(t, e) {
    var a = Ht();
    e = e === void 0 ? null : e;
    var n = a.memoizedState;
    return e !== null && Hc(e, n[1]) ? n[0] : (a.memoizedState = [t, e], t);
  }
  function xf(t, e) {
    var a = Ht();
    e = e === void 0 ? null : e;
    var n = a.memoizedState;
    if (e !== null && Hc(e, n[1]))
      return n[0];
    if (n = t(), fn) {
      be(!0);
      try {
        t();
      } finally {
        be(!1);
      }
    }
    return a.memoizedState = [n, e], n;
  }
  function Fc(t, e, a) {
    return a === void 0 || (oa & 1073741824) !== 0 && (ot & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = a, t = Sp(), et.lanes |= t, Ba |= t, a);
  }
  function Sf(t, e, a, n) {
    return xe(a, e) ? a : kn.current !== null ? (t = Fc(t, a, n), xe(t, e) || (Qt = !0), t) : (oa & 42) === 0 || (oa & 1073741824) !== 0 && (ot & 261930) === 0 ? (Qt = !0, t.memoizedState = a) : (t = Sp(), et.lanes |= t, Ba |= t, e);
  }
  function Ef(t, e, a, n, l) {
    var u = R.p;
    R.p = u !== 0 && 8 > u ? u : 8;
    var o = D.T, f = {};
    D.T = f, Ic(t, !1, e, a);
    try {
      var d = l(), x = D.S;
      if (x !== null && x(f, d), d !== null && typeof d == "object" && typeof d.then == "function") {
        var O = Gh(
          d,
          n
        );
        Ul(
          t,
          e,
          O,
          Oe(t)
        );
      } else
        Ul(
          t,
          e,
          n,
          Oe(t)
        );
    } catch (j) {
      Ul(
        t,
        e,
        { then: function() {
        }, status: "rejected", reason: j },
        Oe()
      );
    } finally {
      R.p = u, o !== null && f.types !== null && (o.types = f.types), D.T = o;
    }
  }
  function Vh() {
  }
  function Wc(t, e, a, n) {
    if (t.tag !== 5) throw Error(s(476));
    var l = Tf(t).queue;
    Ef(
      t,
      l,
      e,
      Z,
      a === null ? Vh : function() {
        return Af(t), a(n);
      }
    );
  }
  function Tf(t) {
    var e = t.memoizedState;
    if (e !== null) return e;
    e = {
      memoizedState: Z,
      baseState: Z,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: sa,
        lastRenderedState: Z
      },
      next: null
    };
    var a = {};
    return e.next = {
      memoizedState: a,
      baseState: a,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: sa,
        lastRenderedState: a
      },
      next: null
    }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
  }
  function Af(t) {
    var e = Tf(t);
    e.next === null && (e = t.alternate.memoizedState), Ul(
      t,
      e.next.queue,
      {},
      Oe()
    );
  }
  function $c() {
    return ee(Il);
  }
  function zf() {
    return Ht().memoizedState;
  }
  function Of() {
    return Ht().memoizedState;
  }
  function Kh(t) {
    for (var e = t.return; e !== null; ) {
      switch (e.tag) {
        case 24:
        case 3:
          var a = Oe();
          t = Ma(a);
          var n = Ra(e, t, a);
          n !== null && (ve(n, e, a), jl(n, e, a)), e = { cache: Oc() }, t.payload = e;
          return;
      }
      e = e.return;
    }
  }
  function Jh(t, e, a) {
    var n = Oe();
    a = {
      lane: n,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Fi(t) ? wf(e, a) : (a = hc(t, e, a, n), a !== null && (ve(a, t, n), _f(a, e, n)));
  }
  function Df(t, e, a) {
    var n = Oe();
    Ul(t, e, a, n);
  }
  function Ul(t, e, a, n) {
    var l = {
      lane: n,
      revertLane: 0,
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (Fi(t)) wf(e, l);
    else {
      var u = t.alternate;
      if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
        try {
          var o = e.lastRenderedState, f = u(o, a);
          if (l.hasEagerState = !0, l.eagerState = f, xe(f, o))
            return _i(t, e, l, 0), Et === null && wi(), !1;
        } catch {
        }
      if (a = hc(t, e, l, n), a !== null)
        return ve(a, t, n), _f(a, e, n), !0;
    }
    return !1;
  }
  function Ic(t, e, a, n) {
    if (n = {
      lane: 2,
      revertLane: Co(),
      gesture: null,
      action: n,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, Fi(t)) {
      if (e) throw Error(s(479));
    } else
      e = hc(
        t,
        a,
        n,
        2
      ), e !== null && ve(e, t, 2);
  }
  function Fi(t) {
    var e = t.alternate;
    return t === et || e !== null && e === et;
  }
  function wf(t, e) {
    Xn = Yi = !0;
    var a = t.pending;
    a === null ? e.next = e : (e.next = a.next, a.next = e), t.pending = e;
  }
  function _f(t, e, a) {
    if ((a & 4194048) !== 0) {
      var n = e.lanes;
      n &= t.pendingLanes, a |= n, e.lanes = a, Rs(t, a);
    }
  }
  var ql = {
    readContext: ee,
    use: Zi,
    useCallback: Rt,
    useContext: Rt,
    useEffect: Rt,
    useImperativeHandle: Rt,
    useLayoutEffect: Rt,
    useInsertionEffect: Rt,
    useMemo: Rt,
    useReducer: Rt,
    useRef: Rt,
    useState: Rt,
    useDebugValue: Rt,
    useDeferredValue: Rt,
    useTransition: Rt,
    useSyncExternalStore: Rt,
    useId: Rt,
    useHostTransitionStatus: Rt,
    useFormState: Rt,
    useActionState: Rt,
    useOptimistic: Rt,
    useMemoCache: Rt,
    useCacheRefresh: Rt
  };
  ql.useEffectEvent = Rt;
  var jf = {
    readContext: ee,
    use: Zi,
    useCallback: function(t, e) {
      return ce().memoizedState = [
        t,
        e === void 0 ? null : e
      ], t;
    },
    useContext: ee,
    useEffect: df,
    useImperativeHandle: function(t, e, a) {
      a = a != null ? a.concat([t]) : null, Ki(
        4194308,
        4,
        yf.bind(null, e, t),
        a
      );
    },
    useLayoutEffect: function(t, e) {
      return Ki(4194308, 4, t, e);
    },
    useInsertionEffect: function(t, e) {
      Ki(4, 2, t, e);
    },
    useMemo: function(t, e) {
      var a = ce();
      e = e === void 0 ? null : e;
      var n = t();
      if (fn) {
        be(!0);
        try {
          t();
        } finally {
          be(!1);
        }
      }
      return a.memoizedState = [n, e], n;
    },
    useReducer: function(t, e, a) {
      var n = ce();
      if (a !== void 0) {
        var l = a(e);
        if (fn) {
          be(!0);
          try {
            a(e);
          } finally {
            be(!1);
          }
        }
      } else l = e;
      return n.memoizedState = n.baseState = l, t = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: t,
        lastRenderedState: l
      }, n.queue = t, t = t.dispatch = Jh.bind(
        null,
        et,
        t
      ), [n.memoizedState, t];
    },
    useRef: function(t) {
      var e = ce();
      return t = { current: t }, e.memoizedState = t;
    },
    useState: function(t) {
      t = Zc(t);
      var e = t.queue, a = Df.bind(null, et, e);
      return e.dispatch = a, [t.memoizedState, a];
    },
    useDebugValue: Jc,
    useDeferredValue: function(t, e) {
      var a = ce();
      return Fc(a, t, e);
    },
    useTransition: function() {
      var t = Zc(!1);
      return t = Ef.bind(
        null,
        et,
        t.queue,
        !0,
        !1
      ), ce().memoizedState = t, [!1, t];
    },
    useSyncExternalStore: function(t, e, a) {
      var n = et, l = ce();
      if (rt) {
        if (a === void 0)
          throw Error(s(407));
        a = a();
      } else {
        if (a = e(), Et === null)
          throw Error(s(349));
        (ot & 127) !== 0 || Wr(n, e, a);
      }
      l.memoizedState = a;
      var u = { value: a, getSnapshot: e };
      return l.queue = u, df(Ir.bind(null, n, u, t), [
        t
      ]), n.flags |= 2048, Vn(
        9,
        { destroy: void 0 },
        $r.bind(
          null,
          n,
          u,
          a,
          e
        ),
        null
      ), a;
    },
    useId: function() {
      var t = ce(), e = Et.identifierPrefix;
      if (rt) {
        var a = Ve, n = Ze;
        a = (n & ~(1 << 32 - It(n) - 1)).toString(32) + a, e = "_" + e + "R_" + a, a = ki++, 0 < a && (e += "H" + a.toString(32)), e += "_";
      } else
        a = Qh++, e = "_" + e + "r_" + a.toString(32) + "_";
      return t.memoizedState = e;
    },
    useHostTransitionStatus: $c,
    useFormState: of,
    useActionState: of,
    useOptimistic: function(t) {
      var e = ce();
      e.memoizedState = e.baseState = t;
      var a = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return e.queue = a, e = Ic.bind(
        null,
        et,
        !0,
        a
      ), a.dispatch = e, [t, e];
    },
    useMemoCache: Yc,
    useCacheRefresh: function() {
      return ce().memoizedState = Kh.bind(
        null,
        et
      );
    },
    useEffectEvent: function(t) {
      var e = ce(), a = { impl: t };
      return e.memoizedState = a, function() {
        if ((ht & 2) !== 0)
          throw Error(s(440));
        return a.impl.apply(void 0, arguments);
      };
    }
  }, Pc = {
    readContext: ee,
    use: Zi,
    useCallback: bf,
    useContext: ee,
    useEffect: Kc,
    useImperativeHandle: gf,
    useInsertionEffect: hf,
    useLayoutEffect: vf,
    useMemo: xf,
    useReducer: Vi,
    useRef: pf,
    useState: function() {
      return Vi(sa);
    },
    useDebugValue: Jc,
    useDeferredValue: function(t, e) {
      var a = Ht();
      return Sf(
        a,
        bt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = Vi(sa)[0], e = Ht().memoizedState;
      return [
        typeof t == "boolean" ? t : Nl(t),
        e
      ];
    },
    useSyncExternalStore: Fr,
    useId: zf,
    useHostTransitionStatus: $c,
    useFormState: sf,
    useActionState: sf,
    useOptimistic: function(t, e) {
      var a = Ht();
      return ef(a, bt, t, e);
    },
    useMemoCache: Yc,
    useCacheRefresh: Of
  };
  Pc.useEffectEvent = mf;
  var Cf = {
    readContext: ee,
    use: Zi,
    useCallback: bf,
    useContext: ee,
    useEffect: Kc,
    useImperativeHandle: gf,
    useInsertionEffect: hf,
    useLayoutEffect: vf,
    useMemo: xf,
    useReducer: Xc,
    useRef: pf,
    useState: function() {
      return Xc(sa);
    },
    useDebugValue: Jc,
    useDeferredValue: function(t, e) {
      var a = Ht();
      return bt === null ? Fc(a, t, e) : Sf(
        a,
        bt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = Xc(sa)[0], e = Ht().memoizedState;
      return [
        typeof t == "boolean" ? t : Nl(t),
        e
      ];
    },
    useSyncExternalStore: Fr,
    useId: zf,
    useHostTransitionStatus: $c,
    useFormState: ff,
    useActionState: ff,
    useOptimistic: function(t, e) {
      var a = Ht();
      return bt !== null ? ef(a, bt, t, e) : (a.baseState = t, [t, a.queue.dispatch]);
    },
    useMemoCache: Yc,
    useCacheRefresh: Of
  };
  Cf.useEffectEvent = mf;
  function to(t, e, a, n) {
    e = t.memoizedState, a = a(n, e), a = a == null ? e : M({}, e, a), t.memoizedState = a, t.lanes === 0 && (t.updateQueue.baseState = a);
  }
  var eo = {
    enqueueSetState: function(t, e, a) {
      t = t._reactInternals;
      var n = Oe(), l = Ma(n);
      l.payload = e, a != null && (l.callback = a), e = Ra(t, l, n), e !== null && (ve(e, t, n), jl(e, t, n));
    },
    enqueueReplaceState: function(t, e, a) {
      t = t._reactInternals;
      var n = Oe(), l = Ma(n);
      l.tag = 1, l.payload = e, a != null && (l.callback = a), e = Ra(t, l, n), e !== null && (ve(e, t, n), jl(e, t, n));
    },
    enqueueForceUpdate: function(t, e) {
      t = t._reactInternals;
      var a = Oe(), n = Ma(a);
      n.tag = 2, e != null && (n.callback = e), e = Ra(t, n, a), e !== null && (ve(e, t, a), jl(e, t, a));
    }
  };
  function Mf(t, e, a, n, l, u, o) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(n, u, o) : e.prototype && e.prototype.isPureReactComponent ? !El(a, n) || !El(l, u) : !0;
  }
  function Rf(t, e, a, n) {
    t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(a, n), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(a, n), e.state !== t && eo.enqueueReplaceState(e, e.state, null);
  }
  function pn(t, e) {
    var a = e;
    if ("ref" in e) {
      a = {};
      for (var n in e)
        n !== "ref" && (a[n] = e[n]);
    }
    if (t = t.defaultProps) {
      a === e && (a = M({}, a));
      for (var l in t)
        a[l] === void 0 && (a[l] = t[l]);
    }
    return a;
  }
  function Nf(t) {
    Di(t);
  }
  function Uf(t) {
    console.error(t);
  }
  function qf(t) {
    Di(t);
  }
  function Wi(t, e) {
    try {
      var a = t.onUncaughtError;
      a(e.value, { componentStack: e.stack });
    } catch (n) {
      setTimeout(function() {
        throw n;
      });
    }
  }
  function Hf(t, e, a) {
    try {
      var n = t.onCaughtError;
      n(a.value, {
        componentStack: a.stack,
        errorBoundary: e.tag === 1 ? e.stateNode : null
      });
    } catch (l) {
      setTimeout(function() {
        throw l;
      });
    }
  }
  function ao(t, e, a) {
    return a = Ma(a), a.tag = 3, a.payload = { element: null }, a.callback = function() {
      Wi(t, e);
    }, a;
  }
  function Bf(t) {
    return t = Ma(t), t.tag = 3, t;
  }
  function Lf(t, e, a, n) {
    var l = a.type.getDerivedStateFromError;
    if (typeof l == "function") {
      var u = n.value;
      t.payload = function() {
        return l(u);
      }, t.callback = function() {
        Hf(e, a, n);
      };
    }
    var o = a.stateNode;
    o !== null && typeof o.componentDidCatch == "function" && (t.callback = function() {
      Hf(e, a, n), typeof l != "function" && (La === null ? La = /* @__PURE__ */ new Set([this]) : La.add(this));
      var f = n.stack;
      this.componentDidCatch(n.value, {
        componentStack: f !== null ? f : ""
      });
    });
  }
  function Fh(t, e, a, n, l) {
    if (a.flags |= 32768, n !== null && typeof n == "object" && typeof n.then == "function") {
      if (e = a.alternate, e !== null && Bn(
        e,
        a,
        l,
        !0
      ), a = Ee.current, a !== null) {
        switch (a.tag) {
          case 31:
          case 13:
            return qe === null ? ou() : a.alternate === null && Nt === 0 && (Nt = 3), a.flags &= -257, a.flags |= 65536, a.lanes = l, n === Hi ? a.flags |= 16384 : (e = a.updateQueue, e === null ? a.updateQueue = /* @__PURE__ */ new Set([n]) : e.add(n), wo(t, n, l)), !1;
          case 22:
            return a.flags |= 65536, n === Hi ? a.flags |= 16384 : (e = a.updateQueue, e === null ? (e = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([n])
            }, a.updateQueue = e) : (a = e.retryQueue, a === null ? e.retryQueue = /* @__PURE__ */ new Set([n]) : a.add(n)), wo(t, n, l)), !1;
        }
        throw Error(s(435, a.tag));
      }
      return wo(t, n, l), ou(), !1;
    }
    if (rt)
      return e = Ee.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = l, n !== Sc && (t = Error(s(422), { cause: n }), zl(Me(t, a)))) : (n !== Sc && (e = Error(s(423), {
        cause: n
      }), zl(
        Me(e, a)
      )), t = t.current.alternate, t.flags |= 65536, l &= -l, t.lanes |= l, n = Me(n, a), l = ao(
        t.stateNode,
        n,
        l
      ), Mc(t, l), Nt !== 4 && (Nt = 2)), !1;
    var u = Error(s(520), { cause: n });
    if (u = Me(u, a), Xl === null ? Xl = [u] : Xl.push(u), Nt !== 4 && (Nt = 2), e === null) return !0;
    n = Me(n, a), a = e;
    do {
      switch (a.tag) {
        case 3:
          return a.flags |= 65536, t = l & -l, a.lanes |= t, t = ao(a.stateNode, n, t), Mc(a, t), !1;
        case 1:
          if (e = a.type, u = a.stateNode, (a.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (La === null || !La.has(u))))
            return a.flags |= 65536, l &= -l, a.lanes |= l, l = Bf(l), Lf(
              l,
              t,
              a,
              n
            ), Mc(a, l), !1;
      }
      a = a.return;
    } while (a !== null);
    return !1;
  }
  var no = Error(s(461)), Qt = !1;
  function ae(t, e, a, n) {
    e.child = t === null ? Yr(e, null, a, n) : rn(
      e,
      t.child,
      a,
      n
    );
  }
  function Gf(t, e, a, n, l) {
    a = a.render;
    var u = e.ref;
    if ("ref" in n) {
      var o = {};
      for (var f in n)
        f !== "ref" && (o[f] = n[f]);
    } else o = n;
    return un(e), n = Bc(
      t,
      e,
      a,
      o,
      u,
      l
    ), f = Lc(), t !== null && !Qt ? (Gc(t, e, l), ra(t, e, l)) : (rt && f && bc(e), e.flags |= 1, ae(t, e, n, l), e.child);
  }
  function Qf(t, e, a, n, l) {
    if (t === null) {
      var u = a.type;
      return typeof u == "function" && !vc(u) && u.defaultProps === void 0 && a.compare === null ? (e.tag = 15, e.type = u, Yf(
        t,
        e,
        u,
        n,
        l
      )) : (t = Ci(
        a.type,
        null,
        n,
        e,
        e.mode,
        l
      ), t.ref = e.ref, t.return = e, e.child = t);
    }
    if (u = t.child, !fo(t, l)) {
      var o = u.memoizedProps;
      if (a = a.compare, a = a !== null ? a : El, a(o, n) && t.ref === e.ref)
        return ra(t, e, l);
    }
    return e.flags |= 1, t = la(u, n), t.ref = e.ref, t.return = e, e.child = t;
  }
  function Yf(t, e, a, n, l) {
    if (t !== null) {
      var u = t.memoizedProps;
      if (El(u, n) && t.ref === e.ref)
        if (Qt = !1, e.pendingProps = n = u, fo(t, l))
          (t.flags & 131072) !== 0 && (Qt = !0);
        else
          return e.lanes = t.lanes, ra(t, e, l);
    }
    return lo(
      t,
      e,
      a,
      n,
      l
    );
  }
  function kf(t, e, a, n) {
    var l = n.children, u = t !== null ? t.memoizedState : null;
    if (t === null && e.stateNode === null && (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), n.mode === "hidden") {
      if ((e.flags & 128) !== 0) {
        if (u = u !== null ? u.baseLanes | a : a, t !== null) {
          for (n = e.child = t.child, l = 0; n !== null; )
            l = l | n.lanes | n.childLanes, n = n.sibling;
          n = l & ~u;
        } else n = 0, e.child = null;
        return Xf(
          t,
          e,
          u,
          a,
          n
        );
      }
      if ((a & 536870912) !== 0)
        e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && Ui(
          e,
          u !== null ? u.cachePool : null
        ), u !== null ? Zr(e, u) : Nc(), Vr(e);
      else
        return n = e.lanes = 536870912, Xf(
          t,
          e,
          u !== null ? u.baseLanes | a : a,
          a,
          n
        );
    } else
      u !== null ? (Ui(e, u.cachePool), Zr(e, u), Ua(), e.memoizedState = null) : (t !== null && Ui(e, null), Nc(), Ua());
    return ae(t, e, l, a), e.child;
  }
  function Hl(t, e) {
    return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), e.sibling;
  }
  function Xf(t, e, a, n, l) {
    var u = wc();
    return u = u === null ? null : { parent: Lt._currentValue, pool: u }, e.memoizedState = {
      baseLanes: a,
      cachePool: u
    }, t !== null && Ui(e, null), Nc(), Vr(e), t !== null && Bn(t, e, n, !0), e.childLanes = l, null;
  }
  function $i(t, e) {
    return e = Pi(
      { mode: e.mode, children: e.children },
      t.mode
    ), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function Zf(t, e, a) {
    return rn(e, t.child, null, a), t = $i(e, e.pendingProps), t.flags |= 2, Te(e), e.memoizedState = null, t;
  }
  function Wh(t, e, a) {
    var n = e.pendingProps, l = (e.flags & 128) !== 0;
    if (e.flags &= -129, t === null) {
      if (rt) {
        if (n.mode === "hidden")
          return t = $i(e, n), e.lanes = 536870912, Hl(null, t);
        if (qc(e), (t = Dt) ? (t = nd(
          t,
          Ue
        ), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: Da !== null ? { id: Ze, overflow: Ve } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, a = Dr(t), a.return = e, e.child = a, te = e, Dt = null)) : t = null, t === null) throw _a(e);
        return e.lanes = 536870912, null;
      }
      return $i(e, n);
    }
    var u = t.memoizedState;
    if (u !== null) {
      var o = u.dehydrated;
      if (qc(e), l)
        if (e.flags & 256)
          e.flags &= -257, e = Zf(
            t,
            e,
            a
          );
        else if (e.memoizedState !== null)
          e.child = t.child, e.flags |= 128, e = null;
        else throw Error(s(558));
      else if (Qt || Bn(t, e, a, !1), l = (a & t.childLanes) !== 0, Qt || l) {
        if (n = Et, n !== null && (o = Ns(n, a), o !== 0 && o !== u.retryLane))
          throw u.retryLane = o, en(t, o), ve(n, t, o), no;
        ou(), e = Zf(
          t,
          e,
          a
        );
      } else
        t = u.treeContext, Dt = He(o.nextSibling), te = e, rt = !0, wa = null, Ue = !1, t !== null && jr(e, t), e = $i(e, n), e.flags |= 4096;
      return e;
    }
    return t = la(t.child, {
      mode: n.mode,
      children: n.children
    }), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Ii(t, e) {
    var a = e.ref;
    if (a === null)
      t !== null && t.ref !== null && (e.flags |= 4194816);
    else {
      if (typeof a != "function" && typeof a != "object")
        throw Error(s(284));
      (t === null || t.ref !== a) && (e.flags |= 4194816);
    }
  }
  function lo(t, e, a, n, l) {
    return un(e), a = Bc(
      t,
      e,
      a,
      n,
      void 0,
      l
    ), n = Lc(), t !== null && !Qt ? (Gc(t, e, l), ra(t, e, l)) : (rt && n && bc(e), e.flags |= 1, ae(t, e, a, l), e.child);
  }
  function Vf(t, e, a, n, l, u) {
    return un(e), e.updateQueue = null, a = Jr(
      e,
      n,
      a,
      l
    ), Kr(t), n = Lc(), t !== null && !Qt ? (Gc(t, e, u), ra(t, e, u)) : (rt && n && bc(e), e.flags |= 1, ae(t, e, a, u), e.child);
  }
  function Kf(t, e, a, n, l) {
    if (un(e), e.stateNode === null) {
      var u = Nn, o = a.contextType;
      typeof o == "object" && o !== null && (u = ee(o)), u = new a(n, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = eo, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = n, u.state = e.memoizedState, u.refs = {}, jc(e), o = a.contextType, u.context = typeof o == "object" && o !== null ? ee(o) : Nn, u.state = e.memoizedState, o = a.getDerivedStateFromProps, typeof o == "function" && (to(
        e,
        a,
        o,
        n
      ), u.state = e.memoizedState), typeof a.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (o = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), o !== u.state && eo.enqueueReplaceState(u, u.state, null), Ml(e, n, u, l), Cl(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), n = !0;
    } else if (t === null) {
      u = e.stateNode;
      var f = e.memoizedProps, d = pn(a, f);
      u.props = d;
      var x = u.context, O = a.contextType;
      o = Nn, typeof O == "object" && O !== null && (o = ee(O));
      var j = a.getDerivedStateFromProps;
      O = typeof j == "function" || typeof u.getSnapshotBeforeUpdate == "function", f = e.pendingProps !== f, O || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (f || x !== o) && Rf(
        e,
        u,
        n,
        o
      ), Ca = !1;
      var E = e.memoizedState;
      u.state = E, Ml(e, n, u, l), Cl(), x = e.memoizedState, f || E !== x || Ca ? (typeof j == "function" && (to(
        e,
        a,
        j,
        n
      ), x = e.memoizedState), (d = Ca || Mf(
        e,
        a,
        d,
        n,
        E,
        x,
        o
      )) ? (O || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = n, e.memoizedState = x), u.props = n, u.state = x, u.context = o, n = d) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), n = !1);
    } else {
      u = e.stateNode, Cc(t, e), o = e.memoizedProps, O = pn(a, o), u.props = O, j = e.pendingProps, E = u.context, x = a.contextType, d = Nn, typeof x == "object" && x !== null && (d = ee(x)), f = a.getDerivedStateFromProps, (x = typeof f == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (o !== j || E !== d) && Rf(
        e,
        u,
        n,
        d
      ), Ca = !1, E = e.memoizedState, u.state = E, Ml(e, n, u, l), Cl();
      var z = e.memoizedState;
      o !== j || E !== z || Ca || t !== null && t.dependencies !== null && Ri(t.dependencies) ? (typeof f == "function" && (to(
        e,
        a,
        f,
        n
      ), z = e.memoizedState), (O = Ca || Mf(
        e,
        a,
        O,
        n,
        E,
        z,
        d
      ) || t !== null && t.dependencies !== null && Ri(t.dependencies)) ? (x || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(n, z, d), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
        n,
        z,
        d
      )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || o === t.memoizedProps && E === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || o === t.memoizedProps && E === t.memoizedState || (e.flags |= 1024), e.memoizedProps = n, e.memoizedState = z), u.props = n, u.state = z, u.context = d, n = O) : (typeof u.componentDidUpdate != "function" || o === t.memoizedProps && E === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || o === t.memoizedProps && E === t.memoizedState || (e.flags |= 1024), n = !1);
    }
    return u = n, Ii(t, e), n = (e.flags & 128) !== 0, u || n ? (u = e.stateNode, a = n && typeof a.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && n ? (e.child = rn(
      e,
      t.child,
      null,
      l
    ), e.child = rn(
      e,
      null,
      a,
      l
    )) : ae(t, e, a, l), e.memoizedState = u.state, t = e.child) : t = ra(
      t,
      e,
      l
    ), t;
  }
  function Jf(t, e, a, n) {
    return nn(), e.flags |= 256, ae(t, e, a, n), e.child;
  }
  var io = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function uo(t) {
    return { baseLanes: t, cachePool: qr() };
  }
  function co(t, e, a) {
    return t = t !== null ? t.childLanes & ~a : 0, e && (t |= ze), t;
  }
  function Ff(t, e, a) {
    var n = e.pendingProps, l = !1, u = (e.flags & 128) !== 0, o;
    if ((o = u) || (o = t !== null && t.memoizedState === null ? !1 : (qt.current & 2) !== 0), o && (l = !0, e.flags &= -129), o = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
      if (rt) {
        if (l ? Na(e) : Ua(), (t = Dt) ? (t = nd(
          t,
          Ue
        ), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: Da !== null ? { id: Ze, overflow: Ve } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, a = Dr(t), a.return = e, e.child = a, te = e, Dt = null)) : t = null, t === null) throw _a(e);
        return Xo(t) ? e.lanes = 32 : e.lanes = 536870912, null;
      }
      var f = n.children;
      return n = n.fallback, l ? (Ua(), l = e.mode, f = Pi(
        { mode: "hidden", children: f },
        l
      ), n = an(
        n,
        l,
        a,
        null
      ), f.return = e, n.return = e, f.sibling = n, e.child = f, n = e.child, n.memoizedState = uo(a), n.childLanes = co(
        t,
        o,
        a
      ), e.memoizedState = io, Hl(null, n)) : (Na(e), oo(e, f));
    }
    var d = t.memoizedState;
    if (d !== null && (f = d.dehydrated, f !== null)) {
      if (u)
        e.flags & 256 ? (Na(e), e.flags &= -257, e = so(
          t,
          e,
          a
        )) : e.memoizedState !== null ? (Ua(), e.child = t.child, e.flags |= 128, e = null) : (Ua(), f = n.fallback, l = e.mode, n = Pi(
          { mode: "visible", children: n.children },
          l
        ), f = an(
          f,
          l,
          a,
          null
        ), f.flags |= 2, n.return = e, f.return = e, n.sibling = f, e.child = n, rn(
          e,
          t.child,
          null,
          a
        ), n = e.child, n.memoizedState = uo(a), n.childLanes = co(
          t,
          o,
          a
        ), e.memoizedState = io, e = Hl(null, n));
      else if (Na(e), Xo(f)) {
        if (o = f.nextSibling && f.nextSibling.dataset, o) var x = o.dgst;
        o = x, n = Error(s(419)), n.stack = "", n.digest = o, zl({ value: n, source: null, stack: null }), e = so(
          t,
          e,
          a
        );
      } else if (Qt || Bn(t, e, a, !1), o = (a & t.childLanes) !== 0, Qt || o) {
        if (o = Et, o !== null && (n = Ns(o, a), n !== 0 && n !== d.retryLane))
          throw d.retryLane = n, en(t, n), ve(o, t, n), no;
        ko(f) || ou(), e = so(
          t,
          e,
          a
        );
      } else
        ko(f) ? (e.flags |= 192, e.child = t.child, e = null) : (t = d.treeContext, Dt = He(
          f.nextSibling
        ), te = e, rt = !0, wa = null, Ue = !1, t !== null && jr(e, t), e = oo(
          e,
          n.children
        ), e.flags |= 4096);
      return e;
    }
    return l ? (Ua(), f = n.fallback, l = e.mode, d = t.child, x = d.sibling, n = la(d, {
      mode: "hidden",
      children: n.children
    }), n.subtreeFlags = d.subtreeFlags & 65011712, x !== null ? f = la(
      x,
      f
    ) : (f = an(
      f,
      l,
      a,
      null
    ), f.flags |= 2), f.return = e, n.return = e, n.sibling = f, e.child = n, Hl(null, n), n = e.child, f = t.child.memoizedState, f === null ? f = uo(a) : (l = f.cachePool, l !== null ? (d = Lt._currentValue, l = l.parent !== d ? { parent: d, pool: d } : l) : l = qr(), f = {
      baseLanes: f.baseLanes | a,
      cachePool: l
    }), n.memoizedState = f, n.childLanes = co(
      t,
      o,
      a
    ), e.memoizedState = io, Hl(t.child, n)) : (Na(e), a = t.child, t = a.sibling, a = la(a, {
      mode: "visible",
      children: n.children
    }), a.return = e, a.sibling = null, t !== null && (o = e.deletions, o === null ? (e.deletions = [t], e.flags |= 16) : o.push(t)), e.child = a, e.memoizedState = null, a);
  }
  function oo(t, e) {
    return e = Pi(
      { mode: "visible", children: e },
      t.mode
    ), e.return = t, t.child = e;
  }
  function Pi(t, e) {
    return t = Se(22, t, null, e), t.lanes = 0, t;
  }
  function so(t, e, a) {
    return rn(e, t.child, null, a), t = oo(
      e,
      e.pendingProps.children
    ), t.flags |= 2, e.memoizedState = null, t;
  }
  function Wf(t, e, a) {
    t.lanes |= e;
    var n = t.alternate;
    n !== null && (n.lanes |= e), Ac(t.return, e, a);
  }
  function ro(t, e, a, n, l, u) {
    var o = t.memoizedState;
    o === null ? t.memoizedState = {
      isBackwards: e,
      rendering: null,
      renderingStartTime: 0,
      last: n,
      tail: a,
      tailMode: l,
      treeForkCount: u
    } : (o.isBackwards = e, o.rendering = null, o.renderingStartTime = 0, o.last = n, o.tail = a, o.tailMode = l, o.treeForkCount = u);
  }
  function $f(t, e, a) {
    var n = e.pendingProps, l = n.revealOrder, u = n.tail;
    n = n.children;
    var o = qt.current, f = (o & 2) !== 0;
    if (f ? (o = o & 1 | 2, e.flags |= 128) : o &= 1, N(qt, o), ae(t, e, n, a), n = rt ? Al : 0, !f && t !== null && (t.flags & 128) !== 0)
      t: for (t = e.child; t !== null; ) {
        if (t.tag === 13)
          t.memoizedState !== null && Wf(t, a, e);
        else if (t.tag === 19)
          Wf(t, a, e);
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
    switch (l) {
      case "forwards":
        for (a = e.child, l = null; a !== null; )
          t = a.alternate, t !== null && Qi(t) === null && (l = a), a = a.sibling;
        a = l, a === null ? (l = e.child, e.child = null) : (l = a.sibling, a.sibling = null), ro(
          e,
          !1,
          l,
          a,
          u,
          n
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (a = null, l = e.child, e.child = null; l !== null; ) {
          if (t = l.alternate, t !== null && Qi(t) === null) {
            e.child = l;
            break;
          }
          t = l.sibling, l.sibling = a, a = l, l = t;
        }
        ro(
          e,
          !0,
          a,
          null,
          u,
          n
        );
        break;
      case "together":
        ro(
          e,
          !1,
          null,
          null,
          void 0,
          n
        );
        break;
      default:
        e.memoizedState = null;
    }
    return e.child;
  }
  function ra(t, e, a) {
    if (t !== null && (e.dependencies = t.dependencies), Ba |= e.lanes, (a & e.childLanes) === 0)
      if (t !== null) {
        if (Bn(
          t,
          e,
          a,
          !1
        ), (a & e.childLanes) === 0)
          return null;
      } else return null;
    if (t !== null && e.child !== t.child)
      throw Error(s(153));
    if (e.child !== null) {
      for (t = e.child, a = la(t, t.pendingProps), e.child = a, a.return = e; t.sibling !== null; )
        t = t.sibling, a = a.sibling = la(t, t.pendingProps), a.return = e;
      a.sibling = null;
    }
    return e.child;
  }
  function fo(t, e) {
    return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && Ri(t)));
  }
  function $h(t, e, a) {
    switch (e.tag) {
      case 3:
        Jt(e, e.stateNode.containerInfo), ja(e, Lt, t.memoizedState.cache), nn();
        break;
      case 27:
      case 5:
        Sa(e);
        break;
      case 4:
        Jt(e, e.stateNode.containerInfo);
        break;
      case 10:
        ja(
          e,
          e.type,
          e.memoizedProps.value
        );
        break;
      case 31:
        if (e.memoizedState !== null)
          return e.flags |= 128, qc(e), null;
        break;
      case 13:
        var n = e.memoizedState;
        if (n !== null)
          return n.dehydrated !== null ? (Na(e), e.flags |= 128, null) : (a & e.child.childLanes) !== 0 ? Ff(t, e, a) : (Na(e), t = ra(
            t,
            e,
            a
          ), t !== null ? t.sibling : null);
        Na(e);
        break;
      case 19:
        var l = (t.flags & 128) !== 0;
        if (n = (a & e.childLanes) !== 0, n || (Bn(
          t,
          e,
          a,
          !1
        ), n = (a & e.childLanes) !== 0), l) {
          if (n)
            return $f(
              t,
              e,
              a
            );
          e.flags |= 128;
        }
        if (l = e.memoizedState, l !== null && (l.rendering = null, l.tail = null, l.lastEffect = null), N(qt, qt.current), n) break;
        return null;
      case 22:
        return e.lanes = 0, kf(
          t,
          e,
          a,
          e.pendingProps
        );
      case 24:
        ja(e, Lt, t.memoizedState.cache);
    }
    return ra(t, e, a);
  }
  function If(t, e, a) {
    if (t !== null)
      if (t.memoizedProps !== e.pendingProps)
        Qt = !0;
      else {
        if (!fo(t, a) && (e.flags & 128) === 0)
          return Qt = !1, $h(
            t,
            e,
            a
          );
        Qt = (t.flags & 131072) !== 0;
      }
    else
      Qt = !1, rt && (e.flags & 1048576) !== 0 && _r(e, Al, e.index);
    switch (e.lanes = 0, e.tag) {
      case 16:
        t: {
          var n = e.pendingProps;
          if (t = on(e.elementType), e.type = t, typeof t == "function")
            vc(t) ? (n = pn(t, n), e.tag = 1, e = Kf(
              null,
              e,
              t,
              n,
              a
            )) : (e.tag = 0, e = lo(
              null,
              e,
              t,
              n,
              a
            ));
          else {
            if (t != null) {
              var l = t.$$typeof;
              if (l === pt) {
                e.tag = 11, e = Gf(
                  null,
                  e,
                  t,
                  n,
                  a
                );
                break t;
              } else if (l === tt) {
                e.tag = 14, e = Qf(
                  null,
                  e,
                  t,
                  n,
                  a
                );
                break t;
              }
            }
            throw e = At(t) || t, Error(s(306, e, ""));
          }
        }
        return e;
      case 0:
        return lo(
          t,
          e,
          e.type,
          e.pendingProps,
          a
        );
      case 1:
        return n = e.type, l = pn(
          n,
          e.pendingProps
        ), Kf(
          t,
          e,
          n,
          l,
          a
        );
      case 3:
        t: {
          if (Jt(
            e,
            e.stateNode.containerInfo
          ), t === null) throw Error(s(387));
          n = e.pendingProps;
          var u = e.memoizedState;
          l = u.element, Cc(t, e), Ml(e, n, null, a);
          var o = e.memoizedState;
          if (n = o.cache, ja(e, Lt, n), n !== u.cache && zc(
            e,
            [Lt],
            a,
            !0
          ), Cl(), n = o.element, u.isDehydrated)
            if (u = {
              element: n,
              isDehydrated: !1,
              cache: o.cache
            }, e.updateQueue.baseState = u, e.memoizedState = u, e.flags & 256) {
              e = Jf(
                t,
                e,
                n,
                a
              );
              break t;
            } else if (n !== l) {
              l = Me(
                Error(s(424)),
                e
              ), zl(l), e = Jf(
                t,
                e,
                n,
                a
              );
              break t;
            } else
              for (t = e.stateNode.containerInfo, t.nodeType === 9 ? t = t.body : t = t.nodeName === "HTML" ? t.ownerDocument.body : t, Dt = He(t.firstChild), te = e, rt = !0, wa = null, Ue = !0, a = Yr(
                e,
                null,
                n,
                a
              ), e.child = a; a; )
                a.flags = a.flags & -3 | 4096, a = a.sibling;
          else {
            if (nn(), n === l) {
              e = ra(
                t,
                e,
                a
              );
              break t;
            }
            ae(t, e, n, a);
          }
          e = e.child;
        }
        return e;
      case 26:
        return Ii(t, e), t === null ? (a = sd(
          e.type,
          null,
          e.pendingProps,
          null
        )) ? e.memoizedState = a : rt || (a = e.type, t = e.pendingProps, n = hu(
          nt.current
        ).createElement(a), n[Pt] = e, n[re] = t, ne(n, a, t), Ft(n), e.stateNode = n) : e.memoizedState = sd(
          e.type,
          t.memoizedProps,
          e.pendingProps,
          t.memoizedState
        ), null;
      case 27:
        return Sa(e), t === null && rt && (n = e.stateNode = ud(
          e.type,
          e.pendingProps,
          nt.current
        ), te = e, Ue = !0, l = Dt, ka(e.type) ? (Zo = l, Dt = He(n.firstChild)) : Dt = l), ae(
          t,
          e,
          e.pendingProps.children,
          a
        ), Ii(t, e), t === null && (e.flags |= 4194304), e.child;
      case 5:
        return t === null && rt && ((l = n = Dt) && (n = Dv(
          n,
          e.type,
          e.pendingProps,
          Ue
        ), n !== null ? (e.stateNode = n, te = e, Dt = He(n.firstChild), Ue = !1, l = !0) : l = !1), l || _a(e)), Sa(e), l = e.type, u = e.pendingProps, o = t !== null ? t.memoizedProps : null, n = u.children, Go(l, u) ? n = null : o !== null && Go(l, o) && (e.flags |= 32), e.memoizedState !== null && (l = Bc(
          t,
          e,
          Yh,
          null,
          null,
          a
        ), Il._currentValue = l), Ii(t, e), ae(t, e, n, a), e.child;
      case 6:
        return t === null && rt && ((t = a = Dt) && (a = wv(
          a,
          e.pendingProps,
          Ue
        ), a !== null ? (e.stateNode = a, te = e, Dt = null, t = !0) : t = !1), t || _a(e)), null;
      case 13:
        return Ff(t, e, a);
      case 4:
        return Jt(
          e,
          e.stateNode.containerInfo
        ), n = e.pendingProps, t === null ? e.child = rn(
          e,
          null,
          n,
          a
        ) : ae(t, e, n, a), e.child;
      case 11:
        return Gf(
          t,
          e,
          e.type,
          e.pendingProps,
          a
        );
      case 7:
        return ae(
          t,
          e,
          e.pendingProps,
          a
        ), e.child;
      case 8:
        return ae(
          t,
          e,
          e.pendingProps.children,
          a
        ), e.child;
      case 12:
        return ae(
          t,
          e,
          e.pendingProps.children,
          a
        ), e.child;
      case 10:
        return n = e.pendingProps, ja(e, e.type, n.value), ae(t, e, n.children, a), e.child;
      case 9:
        return l = e.type._context, n = e.pendingProps.children, un(e), l = ee(l), n = n(l), e.flags |= 1, ae(t, e, n, a), e.child;
      case 14:
        return Qf(
          t,
          e,
          e.type,
          e.pendingProps,
          a
        );
      case 15:
        return Yf(
          t,
          e,
          e.type,
          e.pendingProps,
          a
        );
      case 19:
        return $f(t, e, a);
      case 31:
        return Wh(t, e, a);
      case 22:
        return kf(
          t,
          e,
          a,
          e.pendingProps
        );
      case 24:
        return un(e), n = ee(Lt), t === null ? (l = wc(), l === null && (l = Et, u = Oc(), l.pooledCache = u, u.refCount++, u !== null && (l.pooledCacheLanes |= a), l = u), e.memoizedState = { parent: n, cache: l }, jc(e), ja(e, Lt, l)) : ((t.lanes & a) !== 0 && (Cc(t, e), Ml(e, null, null, a), Cl()), l = t.memoizedState, u = e.memoizedState, l.parent !== n ? (l = { parent: n, cache: n }, e.memoizedState = l, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = l), ja(e, Lt, n)) : (n = u.cache, ja(e, Lt, n), n !== l.cache && zc(
          e,
          [Lt],
          a,
          !0
        ))), ae(
          t,
          e,
          e.pendingProps.children,
          a
        ), e.child;
      case 29:
        throw e.pendingProps;
    }
    throw Error(s(156, e.tag));
  }
  function fa(t) {
    t.flags |= 4;
  }
  function po(t, e, a, n, l) {
    if ((e = (t.mode & 32) !== 0) && (e = !1), e) {
      if (t.flags |= 16777216, (l & 335544128) === l)
        if (t.stateNode.complete) t.flags |= 8192;
        else if (zp()) t.flags |= 8192;
        else
          throw sn = Hi, _c;
    } else t.flags &= -16777217;
  }
  function Pf(t, e) {
    if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0)
      t.flags &= -16777217;
    else if (t.flags |= 16777216, !md(e))
      if (zp()) t.flags |= 8192;
      else
        throw sn = Hi, _c;
  }
  function tu(t, e) {
    e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Cs() : 536870912, t.lanes |= e, Wn |= e);
  }
  function Bl(t, e) {
    if (!rt)
      switch (t.tailMode) {
        case "hidden":
          e = t.tail;
          for (var a = null; e !== null; )
            e.alternate !== null && (a = e), e = e.sibling;
          a === null ? t.tail = null : a.sibling = null;
          break;
        case "collapsed":
          a = t.tail;
          for (var n = null; a !== null; )
            a.alternate !== null && (n = a), a = a.sibling;
          n === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : n.sibling = null;
      }
  }
  function wt(t) {
    var e = t.alternate !== null && t.alternate.child === t.child, a = 0, n = 0;
    if (e)
      for (var l = t.child; l !== null; )
        a |= l.lanes | l.childLanes, n |= l.subtreeFlags & 65011712, n |= l.flags & 65011712, l.return = t, l = l.sibling;
    else
      for (l = t.child; l !== null; )
        a |= l.lanes | l.childLanes, n |= l.subtreeFlags, n |= l.flags, l.return = t, l = l.sibling;
    return t.subtreeFlags |= n, t.childLanes = a, e;
  }
  function Ih(t, e, a) {
    var n = e.pendingProps;
    switch (xc(e), e.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return wt(e), null;
      case 1:
        return wt(e), null;
      case 3:
        return a = e.stateNode, n = null, t !== null && (n = t.memoizedState.cache), e.memoizedState.cache !== n && (e.flags |= 2048), ca(Lt), Ct(), a.pendingContext && (a.context = a.pendingContext, a.pendingContext = null), (t === null || t.child === null) && (Hn(e) ? fa(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, Ec())), wt(e), null;
      case 26:
        var l = e.type, u = e.memoizedState;
        return t === null ? (fa(e), u !== null ? (wt(e), Pf(e, u)) : (wt(e), po(
          e,
          l,
          null,
          n,
          a
        ))) : u ? u !== t.memoizedState ? (fa(e), wt(e), Pf(e, u)) : (wt(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== n && fa(e), wt(e), po(
          e,
          l,
          t,
          n,
          a
        )), null;
      case 27:
        if ($e(e), a = nt.current, l = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== n && fa(e);
        else {
          if (!n) {
            if (e.stateNode === null)
              throw Error(s(166));
            return wt(e), null;
          }
          t = B.current, Hn(e) ? Cr(e) : (t = ud(l, n, a), e.stateNode = t, fa(e));
        }
        return wt(e), null;
      case 5:
        if ($e(e), l = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== n && fa(e);
        else {
          if (!n) {
            if (e.stateNode === null)
              throw Error(s(166));
            return wt(e), null;
          }
          if (u = B.current, Hn(e))
            Cr(e);
          else {
            var o = hu(
              nt.current
            );
            switch (u) {
              case 1:
                u = o.createElementNS(
                  "http://www.w3.org/2000/svg",
                  l
                );
                break;
              case 2:
                u = o.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  l
                );
                break;
              default:
                switch (l) {
                  case "svg":
                    u = o.createElementNS(
                      "http://www.w3.org/2000/svg",
                      l
                    );
                    break;
                  case "math":
                    u = o.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      l
                    );
                    break;
                  case "script":
                    u = o.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(
                      u.firstChild
                    );
                    break;
                  case "select":
                    u = typeof n.is == "string" ? o.createElement("select", {
                      is: n.is
                    }) : o.createElement("select"), n.multiple ? u.multiple = !0 : n.size && (u.size = n.size);
                    break;
                  default:
                    u = typeof n.is == "string" ? o.createElement(l, { is: n.is }) : o.createElement(l);
                }
            }
            u[Pt] = e, u[re] = n;
            t: for (o = e.child; o !== null; ) {
              if (o.tag === 5 || o.tag === 6)
                u.appendChild(o.stateNode);
              else if (o.tag !== 4 && o.tag !== 27 && o.child !== null) {
                o.child.return = o, o = o.child;
                continue;
              }
              if (o === e) break t;
              for (; o.sibling === null; ) {
                if (o.return === null || o.return === e)
                  break t;
                o = o.return;
              }
              o.sibling.return = o.return, o = o.sibling;
            }
            e.stateNode = u;
            t: switch (ne(u, l, n), l) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                n = !!n.autoFocus;
                break t;
              case "img":
                n = !0;
                break t;
              default:
                n = !1;
            }
            n && fa(e);
          }
        }
        return wt(e), po(
          e,
          e.type,
          t === null ? null : t.memoizedProps,
          e.pendingProps,
          a
        ), null;
      case 6:
        if (t && e.stateNode != null)
          t.memoizedProps !== n && fa(e);
        else {
          if (typeof n != "string" && e.stateNode === null)
            throw Error(s(166));
          if (t = nt.current, Hn(e)) {
            if (t = e.stateNode, a = e.memoizedProps, n = null, l = te, l !== null)
              switch (l.tag) {
                case 27:
                case 5:
                  n = l.memoizedProps;
              }
            t[Pt] = e, t = !!(t.nodeValue === a || n !== null && n.suppressHydrationWarning === !0 || Fp(t.nodeValue, a)), t || _a(e, !0);
          } else
            t = hu(t).createTextNode(
              n
            ), t[Pt] = e, e.stateNode = t;
        }
        return wt(e), null;
      case 31:
        if (a = e.memoizedState, t === null || t.memoizedState !== null) {
          if (n = Hn(e), a !== null) {
            if (t === null) {
              if (!n) throw Error(s(318));
              if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(s(557));
              t[Pt] = e;
            } else
              nn(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            wt(e), t = !1;
          } else
            a = Ec(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = a), t = !0;
          if (!t)
            return e.flags & 256 ? (Te(e), e) : (Te(e), null);
          if ((e.flags & 128) !== 0)
            throw Error(s(558));
        }
        return wt(e), null;
      case 13:
        if (n = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (l = Hn(e), n !== null && n.dehydrated !== null) {
            if (t === null) {
              if (!l) throw Error(s(318));
              if (l = e.memoizedState, l = l !== null ? l.dehydrated : null, !l) throw Error(s(317));
              l[Pt] = e;
            } else
              nn(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            wt(e), l = !1;
          } else
            l = Ec(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), l = !0;
          if (!l)
            return e.flags & 256 ? (Te(e), e) : (Te(e), null);
        }
        return Te(e), (e.flags & 128) !== 0 ? (e.lanes = a, e) : (a = n !== null, t = t !== null && t.memoizedState !== null, a && (n = e.child, l = null, n.alternate !== null && n.alternate.memoizedState !== null && n.alternate.memoizedState.cachePool !== null && (l = n.alternate.memoizedState.cachePool.pool), u = null, n.memoizedState !== null && n.memoizedState.cachePool !== null && (u = n.memoizedState.cachePool.pool), u !== l && (n.flags |= 2048)), a !== t && a && (e.child.flags |= 8192), tu(e, e.updateQueue), wt(e), null);
      case 4:
        return Ct(), t === null && Uo(e.stateNode.containerInfo), wt(e), null;
      case 10:
        return ca(e.type), wt(e), null;
      case 19:
        if (_(qt), n = e.memoizedState, n === null) return wt(e), null;
        if (l = (e.flags & 128) !== 0, u = n.rendering, u === null)
          if (l) Bl(n, !1);
          else {
            if (Nt !== 0 || t !== null && (t.flags & 128) !== 0)
              for (t = e.child; t !== null; ) {
                if (u = Qi(t), u !== null) {
                  for (e.flags |= 128, Bl(n, !1), t = u.updateQueue, e.updateQueue = t, tu(e, t), e.subtreeFlags = 0, t = a, a = e.child; a !== null; )
                    Or(a, t), a = a.sibling;
                  return N(
                    qt,
                    qt.current & 1 | 2
                  ), rt && ia(e, n.treeForkCount), e.child;
                }
                t = t.sibling;
              }
            n.tail !== null && ue() > iu && (e.flags |= 128, l = !0, Bl(n, !1), e.lanes = 4194304);
          }
        else {
          if (!l)
            if (t = Qi(u), t !== null) {
              if (e.flags |= 128, l = !0, t = t.updateQueue, e.updateQueue = t, tu(e, t), Bl(n, !0), n.tail === null && n.tailMode === "hidden" && !u.alternate && !rt)
                return wt(e), null;
            } else
              2 * ue() - n.renderingStartTime > iu && a !== 536870912 && (e.flags |= 128, l = !0, Bl(n, !1), e.lanes = 4194304);
          n.isBackwards ? (u.sibling = e.child, e.child = u) : (t = n.last, t !== null ? t.sibling = u : e.child = u, n.last = u);
        }
        return n.tail !== null ? (t = n.tail, n.rendering = t, n.tail = t.sibling, n.renderingStartTime = ue(), t.sibling = null, a = qt.current, N(
          qt,
          l ? a & 1 | 2 : a & 1
        ), rt && ia(e, n.treeForkCount), t) : (wt(e), null);
      case 22:
      case 23:
        return Te(e), Uc(), n = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== n && (e.flags |= 8192) : n && (e.flags |= 8192), n ? (a & 536870912) !== 0 && (e.flags & 128) === 0 && (wt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : wt(e), a = e.updateQueue, a !== null && tu(e, a.retryQueue), a = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), n = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), n !== a && (e.flags |= 2048), t !== null && _(cn), null;
      case 24:
        return a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), ca(Lt), wt(e), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(s(156, e.tag));
  }
  function Ph(t, e) {
    switch (xc(e), e.tag) {
      case 1:
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 3:
        return ca(Lt), Ct(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
      case 26:
      case 27:
      case 5:
        return $e(e), null;
      case 31:
        if (e.memoizedState !== null) {
          if (Te(e), e.alternate === null)
            throw Error(s(340));
          nn();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 13:
        if (Te(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
          if (e.alternate === null)
            throw Error(s(340));
          nn();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 19:
        return _(qt), null;
      case 4:
        return Ct(), null;
      case 10:
        return ca(e.type), null;
      case 22:
      case 23:
        return Te(e), Uc(), t !== null && _(cn), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 24:
        return ca(Lt), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function tp(t, e) {
    switch (xc(e), e.tag) {
      case 3:
        ca(Lt), Ct();
        break;
      case 26:
      case 27:
      case 5:
        $e(e);
        break;
      case 4:
        Ct();
        break;
      case 31:
        e.memoizedState !== null && Te(e);
        break;
      case 13:
        Te(e);
        break;
      case 19:
        _(qt);
        break;
      case 10:
        ca(e.type);
        break;
      case 22:
      case 23:
        Te(e), Uc(), t !== null && _(cn);
        break;
      case 24:
        ca(Lt);
    }
  }
  function Ll(t, e) {
    try {
      var a = e.updateQueue, n = a !== null ? a.lastEffect : null;
      if (n !== null) {
        var l = n.next;
        a = l;
        do {
          if ((a.tag & t) === t) {
            n = void 0;
            var u = a.create, o = a.inst;
            n = u(), o.destroy = n;
          }
          a = a.next;
        } while (a !== l);
      }
    } catch (f) {
      gt(e, e.return, f);
    }
  }
  function qa(t, e, a) {
    try {
      var n = e.updateQueue, l = n !== null ? n.lastEffect : null;
      if (l !== null) {
        var u = l.next;
        n = u;
        do {
          if ((n.tag & t) === t) {
            var o = n.inst, f = o.destroy;
            if (f !== void 0) {
              o.destroy = void 0, l = e;
              var d = a, x = f;
              try {
                x();
              } catch (O) {
                gt(
                  l,
                  d,
                  O
                );
              }
            }
          }
          n = n.next;
        } while (n !== u);
      }
    } catch (O) {
      gt(e, e.return, O);
    }
  }
  function ep(t) {
    var e = t.updateQueue;
    if (e !== null) {
      var a = t.stateNode;
      try {
        Xr(e, a);
      } catch (n) {
        gt(t, t.return, n);
      }
    }
  }
  function ap(t, e, a) {
    a.props = pn(
      t.type,
      t.memoizedProps
    ), a.state = t.memoizedState;
    try {
      a.componentWillUnmount();
    } catch (n) {
      gt(t, e, n);
    }
  }
  function Gl(t, e) {
    try {
      var a = t.ref;
      if (a !== null) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            var n = t.stateNode;
            break;
          case 30:
            n = t.stateNode;
            break;
          default:
            n = t.stateNode;
        }
        typeof a == "function" ? t.refCleanup = a(n) : a.current = n;
      }
    } catch (l) {
      gt(t, e, l);
    }
  }
  function Ke(t, e) {
    var a = t.ref, n = t.refCleanup;
    if (a !== null)
      if (typeof n == "function")
        try {
          n();
        } catch (l) {
          gt(t, e, l);
        } finally {
          t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
        }
      else if (typeof a == "function")
        try {
          a(null);
        } catch (l) {
          gt(t, e, l);
        }
      else a.current = null;
  }
  function np(t) {
    var e = t.type, a = t.memoizedProps, n = t.stateNode;
    try {
      t: switch (e) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          a.autoFocus && n.focus();
          break t;
        case "img":
          a.src ? n.src = a.src : a.srcSet && (n.srcset = a.srcSet);
      }
    } catch (l) {
      gt(t, t.return, l);
    }
  }
  function mo(t, e, a) {
    try {
      var n = t.stateNode;
      Sv(n, t.type, a, e), n[re] = e;
    } catch (l) {
      gt(t, t.return, l);
    }
  }
  function lp(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && ka(t.type) || t.tag === 4;
  }
  function ho(t) {
    t: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || lp(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.tag === 27 && ka(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function vo(t, e, a) {
    var n = t.tag;
    if (n === 5 || n === 6)
      t = t.stateNode, e ? (a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a).insertBefore(t, e) : (e = a.nodeType === 9 ? a.body : a.nodeName === "HTML" ? a.ownerDocument.body : a, e.appendChild(t), a = a._reactRootContainer, a != null || e.onclick !== null || (e.onclick = aa));
    else if (n !== 4 && (n === 27 && ka(t.type) && (a = t.stateNode, e = null), t = t.child, t !== null))
      for (vo(t, e, a), t = t.sibling; t !== null; )
        vo(t, e, a), t = t.sibling;
  }
  function eu(t, e, a) {
    var n = t.tag;
    if (n === 5 || n === 6)
      t = t.stateNode, e ? a.insertBefore(t, e) : a.appendChild(t);
    else if (n !== 4 && (n === 27 && ka(t.type) && (a = t.stateNode), t = t.child, t !== null))
      for (eu(t, e, a), t = t.sibling; t !== null; )
        eu(t, e, a), t = t.sibling;
  }
  function ip(t) {
    var e = t.stateNode, a = t.memoizedProps;
    try {
      for (var n = t.type, l = e.attributes; l.length; )
        e.removeAttributeNode(l[0]);
      ne(e, n, a), e[Pt] = t, e[re] = a;
    } catch (u) {
      gt(t, t.return, u);
    }
  }
  var pa = !1, Yt = !1, yo = !1, up = typeof WeakSet == "function" ? WeakSet : Set, Wt = null;
  function tv(t, e) {
    if (t = t.containerInfo, Bo = Eu, t = yr(t), sc(t)) {
      if ("selectionStart" in t)
        var a = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
      else
        t: {
          a = (a = t.ownerDocument) && a.defaultView || window;
          var n = a.getSelection && a.getSelection();
          if (n && n.rangeCount !== 0) {
            a = n.anchorNode;
            var l = n.anchorOffset, u = n.focusNode;
            n = n.focusOffset;
            try {
              a.nodeType, u.nodeType;
            } catch {
              a = null;
              break t;
            }
            var o = 0, f = -1, d = -1, x = 0, O = 0, j = t, E = null;
            e: for (; ; ) {
              for (var z; j !== a || l !== 0 && j.nodeType !== 3 || (f = o + l), j !== u || n !== 0 && j.nodeType !== 3 || (d = o + n), j.nodeType === 3 && (o += j.nodeValue.length), (z = j.firstChild) !== null; )
                E = j, j = z;
              for (; ; ) {
                if (j === t) break e;
                if (E === a && ++x === l && (f = o), E === u && ++O === n && (d = o), (z = j.nextSibling) !== null) break;
                j = E, E = j.parentNode;
              }
              j = z;
            }
            a = f === -1 || d === -1 ? null : { start: f, end: d };
          } else a = null;
        }
      a = a || { start: 0, end: 0 };
    } else a = null;
    for (Lo = { focusedElem: t, selectionRange: a }, Eu = !1, Wt = e; Wt !== null; )
      if (e = Wt, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
        t.return = e, Wt = t;
      else
        for (; Wt !== null; ) {
          switch (e = Wt, u = e.alternate, t = e.flags, e.tag) {
            case 0:
              if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                for (a = 0; a < t.length; a++)
                  l = t[a], l.ref.impl = l.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((t & 1024) !== 0 && u !== null) {
                t = void 0, a = e, l = u.memoizedProps, u = u.memoizedState, n = a.stateNode;
                try {
                  var L = pn(
                    a.type,
                    l
                  );
                  t = n.getSnapshotBeforeUpdate(
                    L,
                    u
                  ), n.__reactInternalSnapshotBeforeUpdate = t;
                } catch (K) {
                  gt(
                    a,
                    a.return,
                    K
                  );
                }
              }
              break;
            case 3:
              if ((t & 1024) !== 0) {
                if (t = e.stateNode.containerInfo, a = t.nodeType, a === 9)
                  Yo(t);
                else if (a === 1)
                  switch (t.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      Yo(t);
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
            t.return = e.return, Wt = t;
            break;
          }
          Wt = e.return;
        }
  }
  function cp(t, e, a) {
    var n = a.flags;
    switch (a.tag) {
      case 0:
      case 11:
      case 15:
        ma(t, a), n & 4 && Ll(5, a);
        break;
      case 1:
        if (ma(t, a), n & 4)
          if (t = a.stateNode, e === null)
            try {
              t.componentDidMount();
            } catch (o) {
              gt(a, a.return, o);
            }
          else {
            var l = pn(
              a.type,
              e.memoizedProps
            );
            e = e.memoizedState;
            try {
              t.componentDidUpdate(
                l,
                e,
                t.__reactInternalSnapshotBeforeUpdate
              );
            } catch (o) {
              gt(
                a,
                a.return,
                o
              );
            }
          }
        n & 64 && ep(a), n & 512 && Gl(a, a.return);
        break;
      case 3:
        if (ma(t, a), n & 64 && (t = a.updateQueue, t !== null)) {
          if (e = null, a.child !== null)
            switch (a.child.tag) {
              case 27:
              case 5:
                e = a.child.stateNode;
                break;
              case 1:
                e = a.child.stateNode;
            }
          try {
            Xr(t, e);
          } catch (o) {
            gt(a, a.return, o);
          }
        }
        break;
      case 27:
        e === null && n & 4 && ip(a);
      case 26:
      case 5:
        ma(t, a), e === null && n & 4 && np(a), n & 512 && Gl(a, a.return);
        break;
      case 12:
        ma(t, a);
        break;
      case 31:
        ma(t, a), n & 4 && rp(t, a);
        break;
      case 13:
        ma(t, a), n & 4 && fp(t, a), n & 64 && (t = a.memoizedState, t !== null && (t = t.dehydrated, t !== null && (a = sv.bind(
          null,
          a
        ), _v(t, a))));
        break;
      case 22:
        if (n = a.memoizedState !== null || pa, !n) {
          e = e !== null && e.memoizedState !== null || Yt, l = pa;
          var u = Yt;
          pa = n, (Yt = e) && !u ? ha(
            t,
            a,
            (a.subtreeFlags & 8772) !== 0
          ) : ma(t, a), pa = l, Yt = u;
        }
        break;
      case 30:
        break;
      default:
        ma(t, a);
    }
  }
  function op(t) {
    var e = t.alternate;
    e !== null && (t.alternate = null, op(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Vu(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  var Mt = null, pe = !1;
  function da(t, e, a) {
    for (a = a.child; a !== null; )
      sp(t, e, a), a = a.sibling;
  }
  function sp(t, e, a) {
    if ($t && typeof $t.onCommitFiberUnmount == "function")
      try {
        $t.onCommitFiberUnmount(ta, a);
      } catch {
      }
    switch (a.tag) {
      case 26:
        Yt || Ke(a, e), da(
          t,
          e,
          a
        ), a.memoizedState ? a.memoizedState.count-- : a.stateNode && (a = a.stateNode, a.parentNode.removeChild(a));
        break;
      case 27:
        Yt || Ke(a, e);
        var n = Mt, l = pe;
        ka(a.type) && (Mt = a.stateNode, pe = !1), da(
          t,
          e,
          a
        ), Fl(a.stateNode), Mt = n, pe = l;
        break;
      case 5:
        Yt || Ke(a, e);
      case 6:
        if (n = Mt, l = pe, Mt = null, da(
          t,
          e,
          a
        ), Mt = n, pe = l, Mt !== null)
          if (pe)
            try {
              (Mt.nodeType === 9 ? Mt.body : Mt.nodeName === "HTML" ? Mt.ownerDocument.body : Mt).removeChild(a.stateNode);
            } catch (u) {
              gt(
                a,
                e,
                u
              );
            }
          else
            try {
              Mt.removeChild(a.stateNode);
            } catch (u) {
              gt(
                a,
                e,
                u
              );
            }
        break;
      case 18:
        Mt !== null && (pe ? (t = Mt, ed(
          t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t,
          a.stateNode
        ), ll(t)) : ed(Mt, a.stateNode));
        break;
      case 4:
        n = Mt, l = pe, Mt = a.stateNode.containerInfo, pe = !0, da(
          t,
          e,
          a
        ), Mt = n, pe = l;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        qa(2, a, e), Yt || qa(4, a, e), da(
          t,
          e,
          a
        );
        break;
      case 1:
        Yt || (Ke(a, e), n = a.stateNode, typeof n.componentWillUnmount == "function" && ap(
          a,
          e,
          n
        )), da(
          t,
          e,
          a
        );
        break;
      case 21:
        da(
          t,
          e,
          a
        );
        break;
      case 22:
        Yt = (n = Yt) || a.memoizedState !== null, da(
          t,
          e,
          a
        ), Yt = n;
        break;
      default:
        da(
          t,
          e,
          a
        );
    }
  }
  function rp(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
      t = t.dehydrated;
      try {
        ll(t);
      } catch (a) {
        gt(e, e.return, a);
      }
    }
  }
  function fp(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
      try {
        ll(t);
      } catch (a) {
        gt(e, e.return, a);
      }
  }
  function ev(t) {
    switch (t.tag) {
      case 31:
      case 13:
      case 19:
        var e = t.stateNode;
        return e === null && (e = t.stateNode = new up()), e;
      case 22:
        return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new up()), e;
      default:
        throw Error(s(435, t.tag));
    }
  }
  function au(t, e) {
    var a = ev(t);
    e.forEach(function(n) {
      if (!a.has(n)) {
        a.add(n);
        var l = rv.bind(null, t, n);
        n.then(l, l);
      }
    });
  }
  function de(t, e) {
    var a = e.deletions;
    if (a !== null)
      for (var n = 0; n < a.length; n++) {
        var l = a[n], u = t, o = e, f = o;
        t: for (; f !== null; ) {
          switch (f.tag) {
            case 27:
              if (ka(f.type)) {
                Mt = f.stateNode, pe = !1;
                break t;
              }
              break;
            case 5:
              Mt = f.stateNode, pe = !1;
              break t;
            case 3:
            case 4:
              Mt = f.stateNode.containerInfo, pe = !0;
              break t;
          }
          f = f.return;
        }
        if (Mt === null) throw Error(s(160));
        sp(u, o, l), Mt = null, pe = !1, u = l.alternate, u !== null && (u.return = null), l.return = null;
      }
    if (e.subtreeFlags & 13886)
      for (e = e.child; e !== null; )
        pp(e, t), e = e.sibling;
  }
  var Qe = null;
  function pp(t, e) {
    var a = t.alternate, n = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        de(e, t), me(t), n & 4 && (qa(3, t, t.return), Ll(3, t), qa(5, t, t.return));
        break;
      case 1:
        de(e, t), me(t), n & 512 && (Yt || a === null || Ke(a, a.return)), n & 64 && pa && (t = t.updateQueue, t !== null && (n = t.callbacks, n !== null && (a = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = a === null ? n : a.concat(n))));
        break;
      case 26:
        var l = Qe;
        if (de(e, t), me(t), n & 512 && (Yt || a === null || Ke(a, a.return)), n & 4) {
          var u = a !== null ? a.memoizedState : null;
          if (n = t.memoizedState, a === null)
            if (n === null)
              if (t.stateNode === null) {
                t: {
                  n = t.type, a = t.memoizedProps, l = l.ownerDocument || l;
                  e: switch (n) {
                    case "title":
                      u = l.getElementsByTagName("title")[0], (!u || u[dl] || u[Pt] || u.namespaceURI === "http://www.w3.org/2000/svg" || u.hasAttribute("itemprop")) && (u = l.createElement(n), l.head.insertBefore(
                        u,
                        l.querySelector("head > title")
                      )), ne(u, n, a), u[Pt] = t, Ft(u), n = u;
                      break t;
                    case "link":
                      var o = pd(
                        "link",
                        "href",
                        l
                      ).get(n + (a.href || ""));
                      if (o) {
                        for (var f = 0; f < o.length; f++)
                          if (u = o[f], u.getAttribute("href") === (a.href == null || a.href === "" ? null : a.href) && u.getAttribute("rel") === (a.rel == null ? null : a.rel) && u.getAttribute("title") === (a.title == null ? null : a.title) && u.getAttribute("crossorigin") === (a.crossOrigin == null ? null : a.crossOrigin)) {
                            o.splice(f, 1);
                            break e;
                          }
                      }
                      u = l.createElement(n), ne(u, n, a), l.head.appendChild(u);
                      break;
                    case "meta":
                      if (o = pd(
                        "meta",
                        "content",
                        l
                      ).get(n + (a.content || ""))) {
                        for (f = 0; f < o.length; f++)
                          if (u = o[f], u.getAttribute("content") === (a.content == null ? null : "" + a.content) && u.getAttribute("name") === (a.name == null ? null : a.name) && u.getAttribute("property") === (a.property == null ? null : a.property) && u.getAttribute("http-equiv") === (a.httpEquiv == null ? null : a.httpEquiv) && u.getAttribute("charset") === (a.charSet == null ? null : a.charSet)) {
                            o.splice(f, 1);
                            break e;
                          }
                      }
                      u = l.createElement(n), ne(u, n, a), l.head.appendChild(u);
                      break;
                    default:
                      throw Error(s(468, n));
                  }
                  u[Pt] = t, Ft(u), n = u;
                }
                t.stateNode = n;
              } else
                dd(
                  l,
                  t.type,
                  t.stateNode
                );
            else
              t.stateNode = fd(
                l,
                n,
                t.memoizedProps
              );
          else
            u !== n ? (u === null ? a.stateNode !== null && (a = a.stateNode, a.parentNode.removeChild(a)) : u.count--, n === null ? dd(
              l,
              t.type,
              t.stateNode
            ) : fd(
              l,
              n,
              t.memoizedProps
            )) : n === null && t.stateNode !== null && mo(
              t,
              t.memoizedProps,
              a.memoizedProps
            );
        }
        break;
      case 27:
        de(e, t), me(t), n & 512 && (Yt || a === null || Ke(a, a.return)), a !== null && n & 4 && mo(
          t,
          t.memoizedProps,
          a.memoizedProps
        );
        break;
      case 5:
        if (de(e, t), me(t), n & 512 && (Yt || a === null || Ke(a, a.return)), t.flags & 32) {
          l = t.stateNode;
          try {
            Dn(l, "");
          } catch (L) {
            gt(t, t.return, L);
          }
        }
        n & 4 && t.stateNode != null && (l = t.memoizedProps, mo(
          t,
          l,
          a !== null ? a.memoizedProps : l
        )), n & 1024 && (yo = !0);
        break;
      case 6:
        if (de(e, t), me(t), n & 4) {
          if (t.stateNode === null)
            throw Error(s(162));
          n = t.memoizedProps, a = t.stateNode;
          try {
            a.nodeValue = n;
          } catch (L) {
            gt(t, t.return, L);
          }
        }
        break;
      case 3:
        if (gu = null, l = Qe, Qe = vu(e.containerInfo), de(e, t), Qe = l, me(t), n & 4 && a !== null && a.memoizedState.isDehydrated)
          try {
            ll(e.containerInfo);
          } catch (L) {
            gt(t, t.return, L);
          }
        yo && (yo = !1, dp(t));
        break;
      case 4:
        n = Qe, Qe = vu(
          t.stateNode.containerInfo
        ), de(e, t), me(t), Qe = n;
        break;
      case 12:
        de(e, t), me(t);
        break;
      case 31:
        de(e, t), me(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, au(t, n)));
        break;
      case 13:
        de(e, t), me(t), t.child.flags & 8192 && t.memoizedState !== null != (a !== null && a.memoizedState !== null) && (lu = ue()), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, au(t, n)));
        break;
      case 22:
        l = t.memoizedState !== null;
        var d = a !== null && a.memoizedState !== null, x = pa, O = Yt;
        if (pa = x || l, Yt = O || d, de(e, t), Yt = O, pa = x, me(t), n & 8192)
          t: for (e = t.stateNode, e._visibility = l ? e._visibility & -2 : e._visibility | 1, l && (a === null || d || pa || Yt || dn(t)), a = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (a === null) {
                d = a = e;
                try {
                  if (u = d.stateNode, l)
                    o = u.style, typeof o.setProperty == "function" ? o.setProperty("display", "none", "important") : o.display = "none";
                  else {
                    f = d.stateNode;
                    var j = d.memoizedProps.style, E = j != null && j.hasOwnProperty("display") ? j.display : null;
                    f.style.display = E == null || typeof E == "boolean" ? "" : ("" + E).trim();
                  }
                } catch (L) {
                  gt(d, d.return, L);
                }
              }
            } else if (e.tag === 6) {
              if (a === null) {
                d = e;
                try {
                  d.stateNode.nodeValue = l ? "" : d.memoizedProps;
                } catch (L) {
                  gt(d, d.return, L);
                }
              }
            } else if (e.tag === 18) {
              if (a === null) {
                d = e;
                try {
                  var z = d.stateNode;
                  l ? ad(z, !0) : ad(d.stateNode, !1);
                } catch (L) {
                  gt(d, d.return, L);
                }
              }
            } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break t;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) break t;
              a === e && (a = null), e = e.return;
            }
            a === e && (a = null), e.sibling.return = e.return, e = e.sibling;
          }
        n & 4 && (n = t.updateQueue, n !== null && (a = n.retryQueue, a !== null && (n.retryQueue = null, au(t, a))));
        break;
      case 19:
        de(e, t), me(t), n & 4 && (n = t.updateQueue, n !== null && (t.updateQueue = null, au(t, n)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        de(e, t), me(t);
    }
  }
  function me(t) {
    var e = t.flags;
    if (e & 2) {
      try {
        for (var a, n = t.return; n !== null; ) {
          if (lp(n)) {
            a = n;
            break;
          }
          n = n.return;
        }
        if (a == null) throw Error(s(160));
        switch (a.tag) {
          case 27:
            var l = a.stateNode, u = ho(t);
            eu(t, u, l);
            break;
          case 5:
            var o = a.stateNode;
            a.flags & 32 && (Dn(o, ""), a.flags &= -33);
            var f = ho(t);
            eu(t, f, o);
            break;
          case 3:
          case 4:
            var d = a.stateNode.containerInfo, x = ho(t);
            vo(
              t,
              x,
              d
            );
            break;
          default:
            throw Error(s(161));
        }
      } catch (O) {
        gt(t, t.return, O);
      }
      t.flags &= -3;
    }
    e & 4096 && (t.flags &= -4097);
  }
  function dp(t) {
    if (t.subtreeFlags & 1024)
      for (t = t.child; t !== null; ) {
        var e = t;
        dp(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
  }
  function ma(t, e) {
    if (e.subtreeFlags & 8772)
      for (e = e.child; e !== null; )
        cp(t, e.alternate, e), e = e.sibling;
  }
  function dn(t) {
    for (t = t.child; t !== null; ) {
      var e = t;
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          qa(4, e, e.return), dn(e);
          break;
        case 1:
          Ke(e, e.return);
          var a = e.stateNode;
          typeof a.componentWillUnmount == "function" && ap(
            e,
            e.return,
            a
          ), dn(e);
          break;
        case 27:
          Fl(e.stateNode);
        case 26:
        case 5:
          Ke(e, e.return), dn(e);
          break;
        case 22:
          e.memoizedState === null && dn(e);
          break;
        case 30:
          dn(e);
          break;
        default:
          dn(e);
      }
      t = t.sibling;
    }
  }
  function ha(t, e, a) {
    for (a = a && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
      var n = e.alternate, l = t, u = e, o = u.flags;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          ha(
            l,
            u,
            a
          ), Ll(4, u);
          break;
        case 1:
          if (ha(
            l,
            u,
            a
          ), n = u, l = n.stateNode, typeof l.componentDidMount == "function")
            try {
              l.componentDidMount();
            } catch (x) {
              gt(n, n.return, x);
            }
          if (n = u, l = n.updateQueue, l !== null) {
            var f = n.stateNode;
            try {
              var d = l.shared.hiddenCallbacks;
              if (d !== null)
                for (l.shared.hiddenCallbacks = null, l = 0; l < d.length; l++)
                  kr(d[l], f);
            } catch (x) {
              gt(n, n.return, x);
            }
          }
          a && o & 64 && ep(u), Gl(u, u.return);
          break;
        case 27:
          ip(u);
        case 26:
        case 5:
          ha(
            l,
            u,
            a
          ), a && n === null && o & 4 && np(u), Gl(u, u.return);
          break;
        case 12:
          ha(
            l,
            u,
            a
          );
          break;
        case 31:
          ha(
            l,
            u,
            a
          ), a && o & 4 && rp(l, u);
          break;
        case 13:
          ha(
            l,
            u,
            a
          ), a && o & 4 && fp(l, u);
          break;
        case 22:
          u.memoizedState === null && ha(
            l,
            u,
            a
          ), Gl(u, u.return);
          break;
        case 30:
          break;
        default:
          ha(
            l,
            u,
            a
          );
      }
      e = e.sibling;
    }
  }
  function go(t, e) {
    var a = null;
    t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (a = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== a && (t != null && t.refCount++, a != null && Ol(a));
  }
  function bo(t, e) {
    t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ol(t));
  }
  function Ye(t, e, a, n) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        mp(
          t,
          e,
          a,
          n
        ), e = e.sibling;
  }
  function mp(t, e, a, n) {
    var l = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        Ye(
          t,
          e,
          a,
          n
        ), l & 2048 && Ll(9, e);
        break;
      case 1:
        Ye(
          t,
          e,
          a,
          n
        );
        break;
      case 3:
        Ye(
          t,
          e,
          a,
          n
        ), l & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && Ol(t)));
        break;
      case 12:
        if (l & 2048) {
          Ye(
            t,
            e,
            a,
            n
          ), t = e.stateNode;
          try {
            var u = e.memoizedProps, o = u.id, f = u.onPostCommit;
            typeof f == "function" && f(
              o,
              e.alternate === null ? "mount" : "update",
              t.passiveEffectDuration,
              -0
            );
          } catch (d) {
            gt(e, e.return, d);
          }
        } else
          Ye(
            t,
            e,
            a,
            n
          );
        break;
      case 31:
        Ye(
          t,
          e,
          a,
          n
        );
        break;
      case 13:
        Ye(
          t,
          e,
          a,
          n
        );
        break;
      case 23:
        break;
      case 22:
        u = e.stateNode, o = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ye(
          t,
          e,
          a,
          n
        ) : Ql(t, e) : u._visibility & 2 ? Ye(
          t,
          e,
          a,
          n
        ) : (u._visibility |= 2, Kn(
          t,
          e,
          a,
          n,
          (e.subtreeFlags & 10256) !== 0 || !1
        )), l & 2048 && go(o, e);
        break;
      case 24:
        Ye(
          t,
          e,
          a,
          n
        ), l & 2048 && bo(e.alternate, e);
        break;
      default:
        Ye(
          t,
          e,
          a,
          n
        );
    }
  }
  function Kn(t, e, a, n, l) {
    for (l = l && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
      var u = t, o = e, f = a, d = n, x = o.flags;
      switch (o.tag) {
        case 0:
        case 11:
        case 15:
          Kn(
            u,
            o,
            f,
            d,
            l
          ), Ll(8, o);
          break;
        case 23:
          break;
        case 22:
          var O = o.stateNode;
          o.memoizedState !== null ? O._visibility & 2 ? Kn(
            u,
            o,
            f,
            d,
            l
          ) : Ql(
            u,
            o
          ) : (O._visibility |= 2, Kn(
            u,
            o,
            f,
            d,
            l
          )), l && x & 2048 && go(
            o.alternate,
            o
          );
          break;
        case 24:
          Kn(
            u,
            o,
            f,
            d,
            l
          ), l && x & 2048 && bo(o.alternate, o);
          break;
        default:
          Kn(
            u,
            o,
            f,
            d,
            l
          );
      }
      e = e.sibling;
    }
  }
  function Ql(t, e) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) {
        var a = t, n = e, l = n.flags;
        switch (n.tag) {
          case 22:
            Ql(a, n), l & 2048 && go(
              n.alternate,
              n
            );
            break;
          case 24:
            Ql(a, n), l & 2048 && bo(n.alternate, n);
            break;
          default:
            Ql(a, n);
        }
        e = e.sibling;
      }
  }
  var Yl = 8192;
  function Jn(t, e, a) {
    if (t.subtreeFlags & Yl)
      for (t = t.child; t !== null; )
        hp(
          t,
          e,
          a
        ), t = t.sibling;
  }
  function hp(t, e, a) {
    switch (t.tag) {
      case 26:
        Jn(
          t,
          e,
          a
        ), t.flags & Yl && t.memoizedState !== null && Qv(
          a,
          Qe,
          t.memoizedState,
          t.memoizedProps
        );
        break;
      case 5:
        Jn(
          t,
          e,
          a
        );
        break;
      case 3:
      case 4:
        var n = Qe;
        Qe = vu(t.stateNode.containerInfo), Jn(
          t,
          e,
          a
        ), Qe = n;
        break;
      case 22:
        t.memoizedState === null && (n = t.alternate, n !== null && n.memoizedState !== null ? (n = Yl, Yl = 16777216, Jn(
          t,
          e,
          a
        ), Yl = n) : Jn(
          t,
          e,
          a
        ));
        break;
      default:
        Jn(
          t,
          e,
          a
        );
    }
  }
  function vp(t) {
    var e = t.alternate;
    if (e !== null && (t = e.child, t !== null)) {
      e.child = null;
      do
        e = t.sibling, t.sibling = null, t = e;
      while (t !== null);
    }
  }
  function kl(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var a = 0; a < e.length; a++) {
          var n = e[a];
          Wt = n, gp(
            n,
            t
          );
        }
      vp(t);
    }
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; )
        yp(t), t = t.sibling;
  }
  function yp(t) {
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        kl(t), t.flags & 2048 && qa(9, t, t.return);
        break;
      case 3:
        kl(t);
        break;
      case 12:
        kl(t);
        break;
      case 22:
        var e = t.stateNode;
        t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, nu(t)) : kl(t);
        break;
      default:
        kl(t);
    }
  }
  function nu(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var a = 0; a < e.length; a++) {
          var n = e[a];
          Wt = n, gp(
            n,
            t
          );
        }
      vp(t);
    }
    for (t = t.child; t !== null; ) {
      switch (e = t, e.tag) {
        case 0:
        case 11:
        case 15:
          qa(8, e, e.return), nu(e);
          break;
        case 22:
          a = e.stateNode, a._visibility & 2 && (a._visibility &= -3, nu(e));
          break;
        default:
          nu(e);
      }
      t = t.sibling;
    }
  }
  function gp(t, e) {
    for (; Wt !== null; ) {
      var a = Wt;
      switch (a.tag) {
        case 0:
        case 11:
        case 15:
          qa(8, a, e);
          break;
        case 23:
        case 22:
          if (a.memoizedState !== null && a.memoizedState.cachePool !== null) {
            var n = a.memoizedState.cachePool.pool;
            n != null && n.refCount++;
          }
          break;
        case 24:
          Ol(a.memoizedState.cache);
      }
      if (n = a.child, n !== null) n.return = a, Wt = n;
      else
        t: for (a = t; Wt !== null; ) {
          n = Wt;
          var l = n.sibling, u = n.return;
          if (op(n), n === a) {
            Wt = null;
            break t;
          }
          if (l !== null) {
            l.return = u, Wt = l;
            break t;
          }
          Wt = u;
        }
    }
  }
  var av = {
    getCacheForType: function(t) {
      var e = ee(Lt), a = e.data.get(t);
      return a === void 0 && (a = t(), e.data.set(t, a)), a;
    },
    cacheSignal: function() {
      return ee(Lt).controller.signal;
    }
  }, nv = typeof WeakMap == "function" ? WeakMap : Map, ht = 0, Et = null, ut = null, ot = 0, yt = 0, Ae = null, Ha = !1, Fn = !1, xo = !1, va = 0, Nt = 0, Ba = 0, mn = 0, So = 0, ze = 0, Wn = 0, Xl = null, he = null, Eo = !1, lu = 0, bp = 0, iu = 1 / 0, uu = null, La = null, Zt = 0, Ga = null, $n = null, ya = 0, To = 0, Ao = null, xp = null, Zl = 0, zo = null;
  function Oe() {
    return (ht & 2) !== 0 && ot !== 0 ? ot & -ot : D.T !== null ? Co() : Us();
  }
  function Sp() {
    if (ze === 0)
      if ((ot & 536870912) === 0 || rt) {
        var t = mi;
        mi <<= 1, (mi & 3932160) === 0 && (mi = 262144), ze = t;
      } else ze = 536870912;
    return t = Ee.current, t !== null && (t.flags |= 32), ze;
  }
  function ve(t, e, a) {
    (t === Et && (yt === 2 || yt === 9) || t.cancelPendingCommit !== null) && (In(t, 0), Qa(
      t,
      ot,
      ze,
      !1
    )), pl(t, a), ((ht & 2) === 0 || t !== Et) && (t === Et && ((ht & 2) === 0 && (mn |= a), Nt === 4 && Qa(
      t,
      ot,
      ze,
      !1
    )), Je(t));
  }
  function Ep(t, e, a) {
    if ((ht & 6) !== 0) throw Error(s(327));
    var n = !a && (e & 127) === 0 && (e & t.expiredLanes) === 0 || fl(t, e), l = n ? uv(t, e) : Do(t, e, !0), u = n;
    do {
      if (l === 0) {
        Fn && !n && Qa(t, e, 0, !1);
        break;
      } else {
        if (a = t.current.alternate, u && !lv(a)) {
          l = Do(t, e, !1), u = !1;
          continue;
        }
        if (l === 2) {
          if (u = e, t.errorRecoveryDisabledLanes & u)
            var o = 0;
          else
            o = t.pendingLanes & -536870913, o = o !== 0 ? o : o & 536870912 ? 536870912 : 0;
          if (o !== 0) {
            e = o;
            t: {
              var f = t;
              l = Xl;
              var d = f.current.memoizedState.isDehydrated;
              if (d && (In(f, o).flags |= 256), o = Do(
                f,
                o,
                !1
              ), o !== 2) {
                if (xo && !d) {
                  f.errorRecoveryDisabledLanes |= u, mn |= u, l = 4;
                  break t;
                }
                u = he, he = l, u !== null && (he === null ? he = u : he.push.apply(
                  he,
                  u
                ));
              }
              l = o;
            }
            if (u = !1, l !== 2) continue;
          }
        }
        if (l === 1) {
          In(t, 0), Qa(t, e, 0, !0);
          break;
        }
        t: {
          switch (n = t, u = l, u) {
            case 0:
            case 1:
              throw Error(s(345));
            case 4:
              if ((e & 4194048) !== e) break;
            case 6:
              Qa(
                n,
                e,
                ze,
                !Ha
              );
              break t;
            case 2:
              he = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(s(329));
          }
          if ((e & 62914560) === e && (l = lu + 300 - ue(), 10 < l)) {
            if (Qa(
              n,
              e,
              ze,
              !Ha
            ), vi(n, 0, !0) !== 0) break t;
            ya = e, n.timeoutHandle = Pp(
              Tp.bind(
                null,
                n,
                a,
                he,
                uu,
                Eo,
                e,
                ze,
                mn,
                Wn,
                Ha,
                u,
                "Throttled",
                -0,
                0
              ),
              l
            );
            break t;
          }
          Tp(
            n,
            a,
            he,
            uu,
            Eo,
            e,
            ze,
            mn,
            Wn,
            Ha,
            u,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    Je(t);
  }
  function Tp(t, e, a, n, l, u, o, f, d, x, O, j, E, z) {
    if (t.timeoutHandle = -1, j = e.subtreeFlags, j & 8192 || (j & 16785408) === 16785408) {
      j = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: aa
      }, hp(
        e,
        u,
        j
      );
      var L = (u & 62914560) === u ? lu - ue() : (u & 4194048) === u ? bp - ue() : 0;
      if (L = Yv(
        j,
        L
      ), L !== null) {
        ya = u, t.cancelPendingCommit = L(
          Cp.bind(
            null,
            t,
            e,
            u,
            a,
            n,
            l,
            o,
            f,
            d,
            O,
            j,
            null,
            E,
            z
          )
        ), Qa(t, u, o, !x);
        return;
      }
    }
    Cp(
      t,
      e,
      u,
      a,
      n,
      l,
      o,
      f,
      d
    );
  }
  function lv(t) {
    for (var e = t; ; ) {
      var a = e.tag;
      if ((a === 0 || a === 11 || a === 15) && e.flags & 16384 && (a = e.updateQueue, a !== null && (a = a.stores, a !== null)))
        for (var n = 0; n < a.length; n++) {
          var l = a[n], u = l.getSnapshot;
          l = l.value;
          try {
            if (!xe(u(), l)) return !1;
          } catch {
            return !1;
          }
        }
      if (a = e.child, e.subtreeFlags & 16384 && a !== null)
        a.return = e, e = a;
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
  function Qa(t, e, a, n) {
    e &= ~So, e &= ~mn, t.suspendedLanes |= e, t.pingedLanes &= ~e, n && (t.warmLanes |= e), n = t.expirationTimes;
    for (var l = e; 0 < l; ) {
      var u = 31 - It(l), o = 1 << u;
      n[u] = -1, l &= ~o;
    }
    a !== 0 && Ms(t, a, e);
  }
  function cu() {
    return (ht & 6) === 0 ? (Vl(0), !1) : !0;
  }
  function Oo() {
    if (ut !== null) {
      if (yt === 0)
        var t = ut.return;
      else
        t = ut, ua = ln = null, Qc(t), Yn = null, wl = 0, t = ut;
      for (; t !== null; )
        tp(t.alternate, t), t = t.return;
      ut = null;
    }
  }
  function In(t, e) {
    var a = t.timeoutHandle;
    a !== -1 && (t.timeoutHandle = -1, Av(a)), a = t.cancelPendingCommit, a !== null && (t.cancelPendingCommit = null, a()), ya = 0, Oo(), Et = t, ut = a = la(t.current, null), ot = e, yt = 0, Ae = null, Ha = !1, Fn = fl(t, e), xo = !1, Wn = ze = So = mn = Ba = Nt = 0, he = Xl = null, Eo = !1, (e & 8) !== 0 && (e |= e & 32);
    var n = t.entangledLanes;
    if (n !== 0)
      for (t = t.entanglements, n &= e; 0 < n; ) {
        var l = 31 - It(n), u = 1 << l;
        e |= t[l], n &= ~u;
      }
    return va = e, wi(), a;
  }
  function Ap(t, e) {
    et = null, D.H = ql, e === Qn || e === qi ? (e = Lr(), yt = 3) : e === _c ? (e = Lr(), yt = 4) : yt = e === no ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, Ae = e, ut === null && (Nt = 1, Wi(
      t,
      Me(e, t.current)
    ));
  }
  function zp() {
    var t = Ee.current;
    return t === null ? !0 : (ot & 4194048) === ot ? qe === null : (ot & 62914560) === ot || (ot & 536870912) !== 0 ? t === qe : !1;
  }
  function Op() {
    var t = D.H;
    return D.H = ql, t === null ? ql : t;
  }
  function Dp() {
    var t = D.A;
    return D.A = av, t;
  }
  function ou() {
    Nt = 4, Ha || (ot & 4194048) !== ot && Ee.current !== null || (Fn = !0), (Ba & 134217727) === 0 && (mn & 134217727) === 0 || Et === null || Qa(
      Et,
      ot,
      ze,
      !1
    );
  }
  function Do(t, e, a) {
    var n = ht;
    ht |= 2;
    var l = Op(), u = Dp();
    (Et !== t || ot !== e) && (uu = null, In(t, e)), e = !1;
    var o = Nt;
    t: do
      try {
        if (yt !== 0 && ut !== null) {
          var f = ut, d = Ae;
          switch (yt) {
            case 8:
              Oo(), o = 6;
              break t;
            case 3:
            case 2:
            case 9:
            case 6:
              Ee.current === null && (e = !0);
              var x = yt;
              if (yt = 0, Ae = null, Pn(t, f, d, x), a && Fn) {
                o = 0;
                break t;
              }
              break;
            default:
              x = yt, yt = 0, Ae = null, Pn(t, f, d, x);
          }
        }
        iv(), o = Nt;
        break;
      } catch (O) {
        Ap(t, O);
      }
    while (!0);
    return e && t.shellSuspendCounter++, ua = ln = null, ht = n, D.H = l, D.A = u, ut === null && (Et = null, ot = 0, wi()), o;
  }
  function iv() {
    for (; ut !== null; ) wp(ut);
  }
  function uv(t, e) {
    var a = ht;
    ht |= 2;
    var n = Op(), l = Dp();
    Et !== t || ot !== e ? (uu = null, iu = ue() + 500, In(t, e)) : Fn = fl(
      t,
      e
    );
    t: do
      try {
        if (yt !== 0 && ut !== null) {
          e = ut;
          var u = Ae;
          e: switch (yt) {
            case 1:
              yt = 0, Ae = null, Pn(t, e, u, 1);
              break;
            case 2:
            case 9:
              if (Hr(u)) {
                yt = 0, Ae = null, _p(e);
                break;
              }
              e = function() {
                yt !== 2 && yt !== 9 || Et !== t || (yt = 7), Je(t);
              }, u.then(e, e);
              break t;
            case 3:
              yt = 7;
              break t;
            case 4:
              yt = 5;
              break t;
            case 7:
              Hr(u) ? (yt = 0, Ae = null, _p(e)) : (yt = 0, Ae = null, Pn(t, e, u, 7));
              break;
            case 5:
              var o = null;
              switch (ut.tag) {
                case 26:
                  o = ut.memoizedState;
                case 5:
                case 27:
                  var f = ut;
                  if (o ? md(o) : f.stateNode.complete) {
                    yt = 0, Ae = null;
                    var d = f.sibling;
                    if (d !== null) ut = d;
                    else {
                      var x = f.return;
                      x !== null ? (ut = x, su(x)) : ut = null;
                    }
                    break e;
                  }
              }
              yt = 0, Ae = null, Pn(t, e, u, 5);
              break;
            case 6:
              yt = 0, Ae = null, Pn(t, e, u, 6);
              break;
            case 8:
              Oo(), Nt = 6;
              break t;
            default:
              throw Error(s(462));
          }
        }
        cv();
        break;
      } catch (O) {
        Ap(t, O);
      }
    while (!0);
    return ua = ln = null, D.H = n, D.A = l, ht = a, ut !== null ? 0 : (Et = null, ot = 0, wi(), Nt);
  }
  function cv() {
    for (; ut !== null && !Gu(); )
      wp(ut);
  }
  function wp(t) {
    var e = If(t.alternate, t, va);
    t.memoizedProps = t.pendingProps, e === null ? su(t) : ut = e;
  }
  function _p(t) {
    var e = t, a = e.alternate;
    switch (e.tag) {
      case 15:
      case 0:
        e = Vf(
          a,
          e,
          e.pendingProps,
          e.type,
          void 0,
          ot
        );
        break;
      case 11:
        e = Vf(
          a,
          e,
          e.pendingProps,
          e.type.render,
          e.ref,
          ot
        );
        break;
      case 5:
        Qc(e);
      default:
        tp(a, e), e = ut = Or(e, va), e = If(a, e, va);
    }
    t.memoizedProps = t.pendingProps, e === null ? su(t) : ut = e;
  }
  function Pn(t, e, a, n) {
    ua = ln = null, Qc(e), Yn = null, wl = 0;
    var l = e.return;
    try {
      if (Fh(
        t,
        l,
        e,
        a,
        ot
      )) {
        Nt = 1, Wi(
          t,
          Me(a, t.current)
        ), ut = null;
        return;
      }
    } catch (u) {
      if (l !== null) throw ut = l, u;
      Nt = 1, Wi(
        t,
        Me(a, t.current)
      ), ut = null;
      return;
    }
    e.flags & 32768 ? (rt || n === 1 ? t = !0 : Fn || (ot & 536870912) !== 0 ? t = !1 : (Ha = t = !0, (n === 2 || n === 9 || n === 3 || n === 6) && (n = Ee.current, n !== null && n.tag === 13 && (n.flags |= 16384))), jp(e, t)) : su(e);
  }
  function su(t) {
    var e = t;
    do {
      if ((e.flags & 32768) !== 0) {
        jp(
          e,
          Ha
        );
        return;
      }
      t = e.return;
      var a = Ih(
        e.alternate,
        e,
        va
      );
      if (a !== null) {
        ut = a;
        return;
      }
      if (e = e.sibling, e !== null) {
        ut = e;
        return;
      }
      ut = e = t;
    } while (e !== null);
    Nt === 0 && (Nt = 5);
  }
  function jp(t, e) {
    do {
      var a = Ph(t.alternate, t);
      if (a !== null) {
        a.flags &= 32767, ut = a;
        return;
      }
      if (a = t.return, a !== null && (a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null), !e && (t = t.sibling, t !== null)) {
        ut = t;
        return;
      }
      ut = t = a;
    } while (t !== null);
    Nt = 6, ut = null;
  }
  function Cp(t, e, a, n, l, u, o, f, d) {
    t.cancelPendingCommit = null;
    do
      ru();
    while (Zt !== 0);
    if ((ht & 6) !== 0) throw Error(s(327));
    if (e !== null) {
      if (e === t.current) throw Error(s(177));
      if (u = e.lanes | e.childLanes, u |= mc, Gm(
        t,
        a,
        u,
        o,
        f,
        d
      ), t === Et && (ut = Et = null, ot = 0), $n = e, Ga = t, ya = a, To = u, Ao = l, xp = n, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, fv(Ot, function() {
        return qp(), null;
      })) : (t.callbackNode = null, t.callbackPriority = 0), n = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || n) {
        n = D.T, D.T = null, l = R.p, R.p = 2, o = ht, ht |= 4;
        try {
          tv(t, e, a);
        } finally {
          ht = o, R.p = l, D.T = n;
        }
      }
      Zt = 1, Mp(), Rp(), Np();
    }
  }
  function Mp() {
    if (Zt === 1) {
      Zt = 0;
      var t = Ga, e = $n, a = (e.flags & 13878) !== 0;
      if ((e.subtreeFlags & 13878) !== 0 || a) {
        a = D.T, D.T = null;
        var n = R.p;
        R.p = 2;
        var l = ht;
        ht |= 4;
        try {
          pp(e, t);
          var u = Lo, o = yr(t.containerInfo), f = u.focusedElem, d = u.selectionRange;
          if (o !== f && f && f.ownerDocument && vr(
            f.ownerDocument.documentElement,
            f
          )) {
            if (d !== null && sc(f)) {
              var x = d.start, O = d.end;
              if (O === void 0 && (O = x), "selectionStart" in f)
                f.selectionStart = x, f.selectionEnd = Math.min(
                  O,
                  f.value.length
                );
              else {
                var j = f.ownerDocument || document, E = j && j.defaultView || window;
                if (E.getSelection) {
                  var z = E.getSelection(), L = f.textContent.length, K = Math.min(d.start, L), St = d.end === void 0 ? K : Math.min(d.end, L);
                  !z.extend && K > St && (o = St, St = K, K = o);
                  var y = hr(
                    f,
                    K
                  ), m = hr(
                    f,
                    St
                  );
                  if (y && m && (z.rangeCount !== 1 || z.anchorNode !== y.node || z.anchorOffset !== y.offset || z.focusNode !== m.node || z.focusOffset !== m.offset)) {
                    var b = j.createRange();
                    b.setStart(y.node, y.offset), z.removeAllRanges(), K > St ? (z.addRange(b), z.extend(m.node, m.offset)) : (b.setEnd(m.node, m.offset), z.addRange(b));
                  }
                }
              }
            }
            for (j = [], z = f; z = z.parentNode; )
              z.nodeType === 1 && j.push({
                element: z,
                left: z.scrollLeft,
                top: z.scrollTop
              });
            for (typeof f.focus == "function" && f.focus(), f = 0; f < j.length; f++) {
              var w = j[f];
              w.element.scrollLeft = w.left, w.element.scrollTop = w.top;
            }
          }
          Eu = !!Bo, Lo = Bo = null;
        } finally {
          ht = l, R.p = n, D.T = a;
        }
      }
      t.current = e, Zt = 2;
    }
  }
  function Rp() {
    if (Zt === 2) {
      Zt = 0;
      var t = Ga, e = $n, a = (e.flags & 8772) !== 0;
      if ((e.subtreeFlags & 8772) !== 0 || a) {
        a = D.T, D.T = null;
        var n = R.p;
        R.p = 2;
        var l = ht;
        ht |= 4;
        try {
          cp(t, e.alternate, e);
        } finally {
          ht = l, R.p = n, D.T = a;
        }
      }
      Zt = 3;
    }
  }
  function Np() {
    if (Zt === 4 || Zt === 3) {
      Zt = 0, Qu();
      var t = Ga, e = $n, a = ya, n = xp;
      (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Zt = 5 : (Zt = 0, $n = Ga = null, Up(t, t.pendingLanes));
      var l = t.pendingLanes;
      if (l === 0 && (La = null), Xu(a), e = e.stateNode, $t && typeof $t.onCommitFiberRoot == "function")
        try {
          $t.onCommitFiberRoot(
            ta,
            e,
            void 0,
            (e.current.flags & 128) === 128
          );
        } catch {
        }
      if (n !== null) {
        e = D.T, l = R.p, R.p = 2, D.T = null;
        try {
          for (var u = t.onRecoverableError, o = 0; o < n.length; o++) {
            var f = n[o];
            u(f.value, {
              componentStack: f.stack
            });
          }
        } finally {
          D.T = e, R.p = l;
        }
      }
      (ya & 3) !== 0 && ru(), Je(t), l = t.pendingLanes, (a & 261930) !== 0 && (l & 42) !== 0 ? t === zo ? Zl++ : (Zl = 0, zo = t) : Zl = 0, Vl(0);
    }
  }
  function Up(t, e) {
    (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, Ol(e)));
  }
  function ru() {
    return Mp(), Rp(), Np(), qp();
  }
  function qp() {
    if (Zt !== 5) return !1;
    var t = Ga, e = To;
    To = 0;
    var a = Xu(ya), n = D.T, l = R.p;
    try {
      R.p = 32 > a ? 32 : a, D.T = null, a = Ao, Ao = null;
      var u = Ga, o = ya;
      if (Zt = 0, $n = Ga = null, ya = 0, (ht & 6) !== 0) throw Error(s(331));
      var f = ht;
      if (ht |= 4, yp(u.current), mp(
        u,
        u.current,
        o,
        a
      ), ht = f, Vl(0, !1), $t && typeof $t.onPostCommitFiberRoot == "function")
        try {
          $t.onPostCommitFiberRoot(ta, u);
        } catch {
        }
      return !0;
    } finally {
      R.p = l, D.T = n, Up(t, e);
    }
  }
  function Hp(t, e, a) {
    e = Me(a, e), e = ao(t.stateNode, e, 2), t = Ra(t, e, 2), t !== null && (pl(t, 2), Je(t));
  }
  function gt(t, e, a) {
    if (t.tag === 3)
      Hp(t, t, a);
    else
      for (; e !== null; ) {
        if (e.tag === 3) {
          Hp(
            e,
            t,
            a
          );
          break;
        } else if (e.tag === 1) {
          var n = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof n.componentDidCatch == "function" && (La === null || !La.has(n))) {
            t = Me(a, t), a = Bf(2), n = Ra(e, a, 2), n !== null && (Lf(
              a,
              n,
              e,
              t
            ), pl(n, 2), Je(n));
            break;
          }
        }
        e = e.return;
      }
  }
  function wo(t, e, a) {
    var n = t.pingCache;
    if (n === null) {
      n = t.pingCache = new nv();
      var l = /* @__PURE__ */ new Set();
      n.set(e, l);
    } else
      l = n.get(e), l === void 0 && (l = /* @__PURE__ */ new Set(), n.set(e, l));
    l.has(a) || (xo = !0, l.add(a), t = ov.bind(null, t, e, a), e.then(t, t));
  }
  function ov(t, e, a) {
    var n = t.pingCache;
    n !== null && n.delete(e), t.pingedLanes |= t.suspendedLanes & a, t.warmLanes &= ~a, Et === t && (ot & a) === a && (Nt === 4 || Nt === 3 && (ot & 62914560) === ot && 300 > ue() - lu ? (ht & 2) === 0 && In(t, 0) : So |= a, Wn === ot && (Wn = 0)), Je(t);
  }
  function Bp(t, e) {
    e === 0 && (e = Cs()), t = en(t, e), t !== null && (pl(t, e), Je(t));
  }
  function sv(t) {
    var e = t.memoizedState, a = 0;
    e !== null && (a = e.retryLane), Bp(t, a);
  }
  function rv(t, e) {
    var a = 0;
    switch (t.tag) {
      case 31:
      case 13:
        var n = t.stateNode, l = t.memoizedState;
        l !== null && (a = l.retryLane);
        break;
      case 19:
        n = t.stateNode;
        break;
      case 22:
        n = t.stateNode._retryCache;
        break;
      default:
        throw Error(s(314));
    }
    n !== null && n.delete(e), Bp(t, a);
  }
  function fv(t, e) {
    return Ta(t, e);
  }
  var fu = null, tl = null, _o = !1, pu = !1, jo = !1, Ya = 0;
  function Je(t) {
    t !== tl && t.next === null && (tl === null ? fu = tl = t : tl = tl.next = t), pu = !0, _o || (_o = !0, dv());
  }
  function Vl(t, e) {
    if (!jo && pu) {
      jo = !0;
      do
        for (var a = !1, n = fu; n !== null; ) {
          if (t !== 0) {
            var l = n.pendingLanes;
            if (l === 0) var u = 0;
            else {
              var o = n.suspendedLanes, f = n.pingedLanes;
              u = (1 << 31 - It(42 | t) + 1) - 1, u &= l & ~(o & ~f), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
            }
            u !== 0 && (a = !0, Yp(n, u));
          } else
            u = ot, u = vi(
              n,
              n === Et ? u : 0,
              n.cancelPendingCommit !== null || n.timeoutHandle !== -1
            ), (u & 3) === 0 || fl(n, u) || (a = !0, Yp(n, u));
          n = n.next;
        }
      while (a);
      jo = !1;
    }
  }
  function pv() {
    Lp();
  }
  function Lp() {
    pu = _o = !1;
    var t = 0;
    Ya !== 0 && Tv() && (t = Ya);
    for (var e = ue(), a = null, n = fu; n !== null; ) {
      var l = n.next, u = Gp(n, e);
      u === 0 ? (n.next = null, a === null ? fu = l : a.next = l, l === null && (tl = a)) : (a = n, (t !== 0 || (u & 3) !== 0) && (pu = !0)), n = l;
    }
    Zt !== 0 && Zt !== 5 || Vl(t), Ya !== 0 && (Ya = 0);
  }
  function Gp(t, e) {
    for (var a = t.suspendedLanes, n = t.pingedLanes, l = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
      var o = 31 - It(u), f = 1 << o, d = l[o];
      d === -1 ? ((f & a) === 0 || (f & n) !== 0) && (l[o] = Lm(f, e)) : d <= e && (t.expiredLanes |= f), u &= ~f;
    }
    if (e = Et, a = ot, a = vi(
      t,
      t === e ? a : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), n = t.callbackNode, a === 0 || t === e && (yt === 2 || yt === 9) || t.cancelPendingCommit !== null)
      return n !== null && n !== null && Aa(n), t.callbackNode = null, t.callbackPriority = 0;
    if ((a & 3) === 0 || fl(t, a)) {
      if (e = a & -a, e === t.callbackPriority) return e;
      switch (n !== null && Aa(n), Xu(a)) {
        case 2:
        case 8:
          a = zt;
          break;
        case 32:
          a = Ot;
          break;
        case 268435456:
          a = ge;
          break;
        default:
          a = Ot;
      }
      return n = Qp.bind(null, t), a = Ta(a, n), t.callbackPriority = e, t.callbackNode = a, e;
    }
    return n !== null && n !== null && Aa(n), t.callbackPriority = 2, t.callbackNode = null, 2;
  }
  function Qp(t, e) {
    if (Zt !== 0 && Zt !== 5)
      return t.callbackNode = null, t.callbackPriority = 0, null;
    var a = t.callbackNode;
    if (ru() && t.callbackNode !== a)
      return null;
    var n = ot;
    return n = vi(
      t,
      t === Et ? n : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), n === 0 ? null : (Ep(t, n, e), Gp(t, ue()), t.callbackNode != null && t.callbackNode === a ? Qp.bind(null, t) : null);
  }
  function Yp(t, e) {
    if (ru()) return null;
    Ep(t, e, !0);
  }
  function dv() {
    zv(function() {
      (ht & 6) !== 0 ? Ta(
        X,
        pv
      ) : Lp();
    });
  }
  function Co() {
    if (Ya === 0) {
      var t = Ln;
      t === 0 && (t = xn, xn <<= 1, (xn & 261888) === 0 && (xn = 256)), Ya = t;
    }
    return Ya;
  }
  function kp(t) {
    return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : xi("" + t);
  }
  function Xp(t, e) {
    var a = e.ownerDocument.createElement("input");
    return a.name = e.name, a.value = e.value, t.id && a.setAttribute("form", t.id), e.parentNode.insertBefore(a, e), t = new FormData(t), a.parentNode.removeChild(a), t;
  }
  function mv(t, e, a, n, l) {
    if (e === "submit" && a && a.stateNode === l) {
      var u = kp(
        (l[re] || null).action
      ), o = n.submitter;
      o && (e = (e = o[re] || null) ? kp(e.formAction) : o.getAttribute("formAction"), e !== null && (u = e, o = null));
      var f = new Ai(
        "action",
        "action",
        null,
        n,
        l
      );
      t.push({
        event: f,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (n.defaultPrevented) {
                if (Ya !== 0) {
                  var d = o ? Xp(l, o) : new FormData(l);
                  Wc(
                    a,
                    {
                      pending: !0,
                      data: d,
                      method: l.method,
                      action: u
                    },
                    null,
                    d
                  );
                }
              } else
                typeof u == "function" && (f.preventDefault(), d = o ? Xp(l, o) : new FormData(l), Wc(
                  a,
                  {
                    pending: !0,
                    data: d,
                    method: l.method,
                    action: u
                  },
                  u,
                  d
                ));
            },
            currentTarget: l
          }
        ]
      });
    }
  }
  for (var Mo = 0; Mo < dc.length; Mo++) {
    var Ro = dc[Mo], hv = Ro.toLowerCase(), vv = Ro[0].toUpperCase() + Ro.slice(1);
    Ge(
      hv,
      "on" + vv
    );
  }
  Ge(xr, "onAnimationEnd"), Ge(Sr, "onAnimationIteration"), Ge(Er, "onAnimationStart"), Ge("dblclick", "onDoubleClick"), Ge("focusin", "onFocus"), Ge("focusout", "onBlur"), Ge(Mh, "onTransitionRun"), Ge(Rh, "onTransitionStart"), Ge(Nh, "onTransitionCancel"), Ge(Tr, "onTransitionEnd"), zn("onMouseEnter", ["mouseout", "mouseover"]), zn("onMouseLeave", ["mouseout", "mouseover"]), zn("onPointerEnter", ["pointerout", "pointerover"]), zn("onPointerLeave", ["pointerout", "pointerover"]), $a(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), $a(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), $a("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), $a(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), $a(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), $a(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var Kl = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), yv = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(Kl)
  );
  function Zp(t, e) {
    e = (e & 4) !== 0;
    for (var a = 0; a < t.length; a++) {
      var n = t[a], l = n.event;
      n = n.listeners;
      t: {
        var u = void 0;
        if (e)
          for (var o = n.length - 1; 0 <= o; o--) {
            var f = n[o], d = f.instance, x = f.currentTarget;
            if (f = f.listener, d !== u && l.isPropagationStopped())
              break t;
            u = f, l.currentTarget = x;
            try {
              u(l);
            } catch (O) {
              Di(O);
            }
            l.currentTarget = null, u = d;
          }
        else
          for (o = 0; o < n.length; o++) {
            if (f = n[o], d = f.instance, x = f.currentTarget, f = f.listener, d !== u && l.isPropagationStopped())
              break t;
            u = f, l.currentTarget = x;
            try {
              u(l);
            } catch (O) {
              Di(O);
            }
            l.currentTarget = null, u = d;
          }
      }
    }
  }
  function ct(t, e) {
    var a = e[Zu];
    a === void 0 && (a = e[Zu] = /* @__PURE__ */ new Set());
    var n = t + "__bubble";
    a.has(n) || (Vp(e, t, 2, !1), a.add(n));
  }
  function No(t, e, a) {
    var n = 0;
    e && (n |= 4), Vp(
      a,
      t,
      n,
      e
    );
  }
  var du = "_reactListening" + Math.random().toString(36).slice(2);
  function Uo(t) {
    if (!t[du]) {
      t[du] = !0, Bs.forEach(function(a) {
        a !== "selectionchange" && (yv.has(a) || No(a, !1, t), No(a, !0, t));
      });
      var e = t.nodeType === 9 ? t : t.ownerDocument;
      e === null || e[du] || (e[du] = !0, No("selectionchange", !1, e));
    }
  }
  function Vp(t, e, a, n) {
    switch (Sd(e)) {
      case 2:
        var l = Zv;
        break;
      case 8:
        l = Vv;
        break;
      default:
        l = Wo;
    }
    a = l.bind(
      null,
      e,
      a,
      t
    ), l = void 0, !tc || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (l = !0), n ? l !== void 0 ? t.addEventListener(e, a, {
      capture: !0,
      passive: l
    }) : t.addEventListener(e, a, !0) : l !== void 0 ? t.addEventListener(e, a, {
      passive: l
    }) : t.addEventListener(e, a, !1);
  }
  function qo(t, e, a, n, l) {
    var u = n;
    if ((e & 1) === 0 && (e & 2) === 0 && n !== null)
      t: for (; ; ) {
        if (n === null) return;
        var o = n.tag;
        if (o === 3 || o === 4) {
          var f = n.stateNode.containerInfo;
          if (f === l) break;
          if (o === 4)
            for (o = n.return; o !== null; ) {
              var d = o.tag;
              if ((d === 3 || d === 4) && o.stateNode.containerInfo === l)
                return;
              o = o.return;
            }
          for (; f !== null; ) {
            if (o = En(f), o === null) return;
            if (d = o.tag, d === 5 || d === 6 || d === 26 || d === 27) {
              n = u = o;
              continue t;
            }
            f = f.parentNode;
          }
        }
        n = n.return;
      }
    Ws(function() {
      var x = u, O = Iu(a), j = [];
      t: {
        var E = Ar.get(t);
        if (E !== void 0) {
          var z = Ai, L = t;
          switch (t) {
            case "keypress":
              if (Ei(a) === 0) break t;
            case "keydown":
            case "keyup":
              z = rh;
              break;
            case "focusin":
              L = "focus", z = lc;
              break;
            case "focusout":
              L = "blur", z = lc;
              break;
            case "beforeblur":
            case "afterblur":
              z = lc;
              break;
            case "click":
              if (a.button === 2) break t;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              z = Ps;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              z = Im;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              z = dh;
              break;
            case xr:
            case Sr:
            case Er:
              z = eh;
              break;
            case Tr:
              z = hh;
              break;
            case "scroll":
            case "scrollend":
              z = Wm;
              break;
            case "wheel":
              z = yh;
              break;
            case "copy":
            case "cut":
            case "paste":
              z = nh;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              z = er;
              break;
            case "toggle":
            case "beforetoggle":
              z = bh;
          }
          var K = (e & 4) !== 0, St = !K && (t === "scroll" || t === "scrollend"), y = K ? E !== null ? E + "Capture" : null : E;
          K = [];
          for (var m = x, b; m !== null; ) {
            var w = m;
            if (b = w.stateNode, w = w.tag, w !== 5 && w !== 26 && w !== 27 || b === null || y === null || (w = hl(m, y), w != null && K.push(
              Jl(m, w, b)
            )), St) break;
            m = m.return;
          }
          0 < K.length && (E = new z(
            E,
            L,
            null,
            a,
            O
          ), j.push({ event: E, listeners: K }));
        }
      }
      if ((e & 7) === 0) {
        t: {
          if (E = t === "mouseover" || t === "pointerover", z = t === "mouseout" || t === "pointerout", E && a !== $u && (L = a.relatedTarget || a.fromElement) && (En(L) || L[Sn]))
            break t;
          if ((z || E) && (E = O.window === O ? O : (E = O.ownerDocument) ? E.defaultView || E.parentWindow : window, z ? (L = a.relatedTarget || a.toElement, z = x, L = L ? En(L) : null, L !== null && (St = g(L), K = L.tag, L !== St || K !== 5 && K !== 27 && K !== 6) && (L = null)) : (z = null, L = x), z !== L)) {
            if (K = Ps, w = "onMouseLeave", y = "onMouseEnter", m = "mouse", (t === "pointerout" || t === "pointerover") && (K = er, w = "onPointerLeave", y = "onPointerEnter", m = "pointer"), St = z == null ? E : ml(z), b = L == null ? E : ml(L), E = new K(
              w,
              m + "leave",
              z,
              a,
              O
            ), E.target = St, E.relatedTarget = b, w = null, En(O) === x && (K = new K(
              y,
              m + "enter",
              L,
              a,
              O
            ), K.target = b, K.relatedTarget = St, w = K), St = w, z && L)
              e: {
                for (K = gv, y = z, m = L, b = 0, w = y; w; w = K(w))
                  b++;
                w = 0;
                for (var Y = m; Y; Y = K(Y))
                  w++;
                for (; 0 < b - w; )
                  y = K(y), b--;
                for (; 0 < w - b; )
                  m = K(m), w--;
                for (; b--; ) {
                  if (y === m || m !== null && y === m.alternate) {
                    K = y;
                    break e;
                  }
                  y = K(y), m = K(m);
                }
                K = null;
              }
            else K = null;
            z !== null && Kp(
              j,
              E,
              z,
              K,
              !1
            ), L !== null && St !== null && Kp(
              j,
              St,
              L,
              K,
              !0
            );
          }
        }
        t: {
          if (E = x ? ml(x) : window, z = E.nodeName && E.nodeName.toLowerCase(), z === "select" || z === "input" && E.type === "file")
            var dt = sr;
          else if (cr(E))
            if (rr)
              dt = _h;
            else {
              dt = Dh;
              var G = Oh;
            }
          else
            z = E.nodeName, !z || z.toLowerCase() !== "input" || E.type !== "checkbox" && E.type !== "radio" ? x && Wu(x.elementType) && (dt = sr) : dt = wh;
          if (dt && (dt = dt(t, x))) {
            or(
              j,
              dt,
              a,
              O
            );
            break t;
          }
          G && G(t, E, x), t === "focusout" && x && E.type === "number" && x.memoizedProps.value != null && Fu(E, "number", E.value);
        }
        switch (G = x ? ml(x) : window, t) {
          case "focusin":
            (cr(G) || G.contentEditable === "true") && (Cn = G, rc = x, Tl = null);
            break;
          case "focusout":
            Tl = rc = Cn = null;
            break;
          case "mousedown":
            fc = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            fc = !1, gr(j, a, O);
            break;
          case "selectionchange":
            if (Ch) break;
          case "keydown":
          case "keyup":
            gr(j, a, O);
        }
        var at;
        if (uc)
          t: {
            switch (t) {
              case "compositionstart":
                var st = "onCompositionStart";
                break t;
              case "compositionend":
                st = "onCompositionEnd";
                break t;
              case "compositionupdate":
                st = "onCompositionUpdate";
                break t;
            }
            st = void 0;
          }
        else
          jn ? ir(t, a) && (st = "onCompositionEnd") : t === "keydown" && a.keyCode === 229 && (st = "onCompositionStart");
        st && (ar && a.locale !== "ko" && (jn || st !== "onCompositionStart" ? st === "onCompositionEnd" && jn && (at = $s()) : (Oa = O, ec = "value" in Oa ? Oa.value : Oa.textContent, jn = !0)), G = mu(x, st), 0 < G.length && (st = new tr(
          st,
          t,
          null,
          a,
          O
        ), j.push({ event: st, listeners: G }), at ? st.data = at : (at = ur(a), at !== null && (st.data = at)))), (at = Sh ? Eh(t, a) : Th(t, a)) && (st = mu(x, "onBeforeInput"), 0 < st.length && (G = new tr(
          "onBeforeInput",
          "beforeinput",
          null,
          a,
          O
        ), j.push({
          event: G,
          listeners: st
        }), G.data = at)), mv(
          j,
          t,
          x,
          a,
          O
        );
      }
      Zp(j, e);
    });
  }
  function Jl(t, e, a) {
    return {
      instance: t,
      listener: e,
      currentTarget: a
    };
  }
  function mu(t, e) {
    for (var a = e + "Capture", n = []; t !== null; ) {
      var l = t, u = l.stateNode;
      if (l = l.tag, l !== 5 && l !== 26 && l !== 27 || u === null || (l = hl(t, a), l != null && n.unshift(
        Jl(t, l, u)
      ), l = hl(t, e), l != null && n.push(
        Jl(t, l, u)
      )), t.tag === 3) return n;
      t = t.return;
    }
    return [];
  }
  function gv(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5 && t.tag !== 27);
    return t || null;
  }
  function Kp(t, e, a, n, l) {
    for (var u = e._reactName, o = []; a !== null && a !== n; ) {
      var f = a, d = f.alternate, x = f.stateNode;
      if (f = f.tag, d !== null && d === n) break;
      f !== 5 && f !== 26 && f !== 27 || x === null || (d = x, l ? (x = hl(a, u), x != null && o.unshift(
        Jl(a, x, d)
      )) : l || (x = hl(a, u), x != null && o.push(
        Jl(a, x, d)
      ))), a = a.return;
    }
    o.length !== 0 && t.push({ event: e, listeners: o });
  }
  var bv = /\r\n?/g, xv = /\u0000|\uFFFD/g;
  function Jp(t) {
    return (typeof t == "string" ? t : "" + t).replace(bv, `
`).replace(xv, "");
  }
  function Fp(t, e) {
    return e = Jp(e), Jp(t) === e;
  }
  function xt(t, e, a, n, l, u) {
    switch (a) {
      case "children":
        typeof n == "string" ? e === "body" || e === "textarea" && n === "" || Dn(t, n) : (typeof n == "number" || typeof n == "bigint") && e !== "body" && Dn(t, "" + n);
        break;
      case "className":
        gi(t, "class", n);
        break;
      case "tabIndex":
        gi(t, "tabindex", n);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        gi(t, a, n);
        break;
      case "style":
        Js(t, n, u);
        break;
      case "data":
        if (e !== "object") {
          gi(t, "data", n);
          break;
        }
      case "src":
      case "href":
        if (n === "" && (e !== "a" || a !== "href")) {
          t.removeAttribute(a);
          break;
        }
        if (n == null || typeof n == "function" || typeof n == "symbol" || typeof n == "boolean") {
          t.removeAttribute(a);
          break;
        }
        n = xi("" + n), t.setAttribute(a, n);
        break;
      case "action":
      case "formAction":
        if (typeof n == "function") {
          t.setAttribute(
            a,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof u == "function" && (a === "formAction" ? (e !== "input" && xt(t, e, "name", l.name, l, null), xt(
            t,
            e,
            "formEncType",
            l.formEncType,
            l,
            null
          ), xt(
            t,
            e,
            "formMethod",
            l.formMethod,
            l,
            null
          ), xt(
            t,
            e,
            "formTarget",
            l.formTarget,
            l,
            null
          )) : (xt(t, e, "encType", l.encType, l, null), xt(t, e, "method", l.method, l, null), xt(t, e, "target", l.target, l, null)));
        if (n == null || typeof n == "symbol" || typeof n == "boolean") {
          t.removeAttribute(a);
          break;
        }
        n = xi("" + n), t.setAttribute(a, n);
        break;
      case "onClick":
        n != null && (t.onclick = aa);
        break;
      case "onScroll":
        n != null && ct("scroll", t);
        break;
      case "onScrollEnd":
        n != null && ct("scrollend", t);
        break;
      case "dangerouslySetInnerHTML":
        if (n != null) {
          if (typeof n != "object" || !("__html" in n))
            throw Error(s(61));
          if (a = n.__html, a != null) {
            if (l.children != null) throw Error(s(60));
            t.innerHTML = a;
          }
        }
        break;
      case "multiple":
        t.multiple = n && typeof n != "function" && typeof n != "symbol";
        break;
      case "muted":
        t.muted = n && typeof n != "function" && typeof n != "symbol";
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
        if (n == null || typeof n == "function" || typeof n == "boolean" || typeof n == "symbol") {
          t.removeAttribute("xlink:href");
          break;
        }
        a = xi("" + n), t.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          a
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
        n != null && typeof n != "function" && typeof n != "symbol" ? t.setAttribute(a, "" + n) : t.removeAttribute(a);
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
        n && typeof n != "function" && typeof n != "symbol" ? t.setAttribute(a, "") : t.removeAttribute(a);
        break;
      case "capture":
      case "download":
        n === !0 ? t.setAttribute(a, "") : n !== !1 && n != null && typeof n != "function" && typeof n != "symbol" ? t.setAttribute(a, n) : t.removeAttribute(a);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        n != null && typeof n != "function" && typeof n != "symbol" && !isNaN(n) && 1 <= n ? t.setAttribute(a, n) : t.removeAttribute(a);
        break;
      case "rowSpan":
      case "start":
        n == null || typeof n == "function" || typeof n == "symbol" || isNaN(n) ? t.removeAttribute(a) : t.setAttribute(a, n);
        break;
      case "popover":
        ct("beforetoggle", t), ct("toggle", t), yi(t, "popover", n);
        break;
      case "xlinkActuate":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          n
        );
        break;
      case "xlinkArcrole":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          n
        );
        break;
      case "xlinkRole":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          n
        );
        break;
      case "xlinkShow":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          n
        );
        break;
      case "xlinkTitle":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          n
        );
        break;
      case "xlinkType":
        ea(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          n
        );
        break;
      case "xmlBase":
        ea(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          n
        );
        break;
      case "xmlLang":
        ea(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          n
        );
        break;
      case "xmlSpace":
        ea(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          n
        );
        break;
      case "is":
        yi(t, "is", n);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < a.length) || a[0] !== "o" && a[0] !== "O" || a[1] !== "n" && a[1] !== "N") && (a = Jm.get(a) || a, yi(t, a, n));
    }
  }
  function Ho(t, e, a, n, l, u) {
    switch (a) {
      case "style":
        Js(t, n, u);
        break;
      case "dangerouslySetInnerHTML":
        if (n != null) {
          if (typeof n != "object" || !("__html" in n))
            throw Error(s(61));
          if (a = n.__html, a != null) {
            if (l.children != null) throw Error(s(60));
            t.innerHTML = a;
          }
        }
        break;
      case "children":
        typeof n == "string" ? Dn(t, n) : (typeof n == "number" || typeof n == "bigint") && Dn(t, "" + n);
        break;
      case "onScroll":
        n != null && ct("scroll", t);
        break;
      case "onScrollEnd":
        n != null && ct("scrollend", t);
        break;
      case "onClick":
        n != null && (t.onclick = aa);
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
        if (!Ls.hasOwnProperty(a))
          t: {
            if (a[0] === "o" && a[1] === "n" && (l = a.endsWith("Capture"), e = a.slice(2, l ? a.length - 7 : void 0), u = t[re] || null, u = u != null ? u[a] : null, typeof u == "function" && t.removeEventListener(e, u, l), typeof n == "function")) {
              typeof u != "function" && u !== null && (a in t ? t[a] = null : t.hasAttribute(a) && t.removeAttribute(a)), t.addEventListener(e, n, l);
              break t;
            }
            a in t ? t[a] = n : n === !0 ? t.setAttribute(a, "") : yi(t, a, n);
          }
    }
  }
  function ne(t, e, a) {
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
        ct("error", t), ct("load", t);
        var n = !1, l = !1, u;
        for (u in a)
          if (a.hasOwnProperty(u)) {
            var o = a[u];
            if (o != null)
              switch (u) {
                case "src":
                  n = !0;
                  break;
                case "srcSet":
                  l = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(s(137, e));
                default:
                  xt(t, e, u, o, a, null);
              }
          }
        l && xt(t, e, "srcSet", a.srcSet, a, null), n && xt(t, e, "src", a.src, a, null);
        return;
      case "input":
        ct("invalid", t);
        var f = u = o = l = null, d = null, x = null;
        for (n in a)
          if (a.hasOwnProperty(n)) {
            var O = a[n];
            if (O != null)
              switch (n) {
                case "name":
                  l = O;
                  break;
                case "type":
                  o = O;
                  break;
                case "checked":
                  d = O;
                  break;
                case "defaultChecked":
                  x = O;
                  break;
                case "value":
                  u = O;
                  break;
                case "defaultValue":
                  f = O;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (O != null)
                    throw Error(s(137, e));
                  break;
                default:
                  xt(t, e, n, O, a, null);
              }
          }
        Xs(
          t,
          u,
          f,
          d,
          x,
          o,
          l,
          !1
        );
        return;
      case "select":
        ct("invalid", t), n = o = u = null;
        for (l in a)
          if (a.hasOwnProperty(l) && (f = a[l], f != null))
            switch (l) {
              case "value":
                u = f;
                break;
              case "defaultValue":
                o = f;
                break;
              case "multiple":
                n = f;
              default:
                xt(t, e, l, f, a, null);
            }
        e = u, a = o, t.multiple = !!n, e != null ? On(t, !!n, e, !1) : a != null && On(t, !!n, a, !0);
        return;
      case "textarea":
        ct("invalid", t), u = l = n = null;
        for (o in a)
          if (a.hasOwnProperty(o) && (f = a[o], f != null))
            switch (o) {
              case "value":
                n = f;
                break;
              case "defaultValue":
                l = f;
                break;
              case "children":
                u = f;
                break;
              case "dangerouslySetInnerHTML":
                if (f != null) throw Error(s(91));
                break;
              default:
                xt(t, e, o, f, a, null);
            }
        Vs(t, n, l, u);
        return;
      case "option":
        for (d in a)
          a.hasOwnProperty(d) && (n = a[d], n != null) && (d === "selected" ? t.selected = n && typeof n != "function" && typeof n != "symbol" : xt(t, e, d, n, a, null));
        return;
      case "dialog":
        ct("beforetoggle", t), ct("toggle", t), ct("cancel", t), ct("close", t);
        break;
      case "iframe":
      case "object":
        ct("load", t);
        break;
      case "video":
      case "audio":
        for (n = 0; n < Kl.length; n++)
          ct(Kl[n], t);
        break;
      case "image":
        ct("error", t), ct("load", t);
        break;
      case "details":
        ct("toggle", t);
        break;
      case "embed":
      case "source":
      case "link":
        ct("error", t), ct("load", t);
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
        for (x in a)
          if (a.hasOwnProperty(x) && (n = a[x], n != null))
            switch (x) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(s(137, e));
              default:
                xt(t, e, x, n, a, null);
            }
        return;
      default:
        if (Wu(e)) {
          for (O in a)
            a.hasOwnProperty(O) && (n = a[O], n !== void 0 && Ho(
              t,
              e,
              O,
              n,
              a,
              void 0
            ));
          return;
        }
    }
    for (f in a)
      a.hasOwnProperty(f) && (n = a[f], n != null && xt(t, e, f, n, a, null));
  }
  function Sv(t, e, a, n) {
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
        var l = null, u = null, o = null, f = null, d = null, x = null, O = null;
        for (z in a) {
          var j = a[z];
          if (a.hasOwnProperty(z) && j != null)
            switch (z) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                d = j;
              default:
                n.hasOwnProperty(z) || xt(t, e, z, null, n, j);
            }
        }
        for (var E in n) {
          var z = n[E];
          if (j = a[E], n.hasOwnProperty(E) && (z != null || j != null))
            switch (E) {
              case "type":
                u = z;
                break;
              case "name":
                l = z;
                break;
              case "checked":
                x = z;
                break;
              case "defaultChecked":
                O = z;
                break;
              case "value":
                o = z;
                break;
              case "defaultValue":
                f = z;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (z != null)
                  throw Error(s(137, e));
                break;
              default:
                z !== j && xt(
                  t,
                  e,
                  E,
                  z,
                  n,
                  j
                );
            }
        }
        Ju(
          t,
          o,
          f,
          d,
          x,
          O,
          u,
          l
        );
        return;
      case "select":
        z = o = f = E = null;
        for (u in a)
          if (d = a[u], a.hasOwnProperty(u) && d != null)
            switch (u) {
              case "value":
                break;
              case "multiple":
                z = d;
              default:
                n.hasOwnProperty(u) || xt(
                  t,
                  e,
                  u,
                  null,
                  n,
                  d
                );
            }
        for (l in n)
          if (u = n[l], d = a[l], n.hasOwnProperty(l) && (u != null || d != null))
            switch (l) {
              case "value":
                E = u;
                break;
              case "defaultValue":
                f = u;
                break;
              case "multiple":
                o = u;
              default:
                u !== d && xt(
                  t,
                  e,
                  l,
                  u,
                  n,
                  d
                );
            }
        e = f, a = o, n = z, E != null ? On(t, !!a, E, !1) : !!n != !!a && (e != null ? On(t, !!a, e, !0) : On(t, !!a, a ? [] : "", !1));
        return;
      case "textarea":
        z = E = null;
        for (f in a)
          if (l = a[f], a.hasOwnProperty(f) && l != null && !n.hasOwnProperty(f))
            switch (f) {
              case "value":
                break;
              case "children":
                break;
              default:
                xt(t, e, f, null, n, l);
            }
        for (o in n)
          if (l = n[o], u = a[o], n.hasOwnProperty(o) && (l != null || u != null))
            switch (o) {
              case "value":
                E = l;
                break;
              case "defaultValue":
                z = l;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (l != null) throw Error(s(91));
                break;
              default:
                l !== u && xt(t, e, o, l, n, u);
            }
        Zs(t, E, z);
        return;
      case "option":
        for (var L in a)
          E = a[L], a.hasOwnProperty(L) && E != null && !n.hasOwnProperty(L) && (L === "selected" ? t.selected = !1 : xt(
            t,
            e,
            L,
            null,
            n,
            E
          ));
        for (d in n)
          E = n[d], z = a[d], n.hasOwnProperty(d) && E !== z && (E != null || z != null) && (d === "selected" ? t.selected = E && typeof E != "function" && typeof E != "symbol" : xt(
            t,
            e,
            d,
            E,
            n,
            z
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
        for (var K in a)
          E = a[K], a.hasOwnProperty(K) && E != null && !n.hasOwnProperty(K) && xt(t, e, K, null, n, E);
        for (x in n)
          if (E = n[x], z = a[x], n.hasOwnProperty(x) && E !== z && (E != null || z != null))
            switch (x) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (E != null)
                  throw Error(s(137, e));
                break;
              default:
                xt(
                  t,
                  e,
                  x,
                  E,
                  n,
                  z
                );
            }
        return;
      default:
        if (Wu(e)) {
          for (var St in a)
            E = a[St], a.hasOwnProperty(St) && E !== void 0 && !n.hasOwnProperty(St) && Ho(
              t,
              e,
              St,
              void 0,
              n,
              E
            );
          for (O in n)
            E = n[O], z = a[O], !n.hasOwnProperty(O) || E === z || E === void 0 && z === void 0 || Ho(
              t,
              e,
              O,
              E,
              n,
              z
            );
          return;
        }
    }
    for (var y in a)
      E = a[y], a.hasOwnProperty(y) && E != null && !n.hasOwnProperty(y) && xt(t, e, y, null, n, E);
    for (j in n)
      E = n[j], z = a[j], !n.hasOwnProperty(j) || E === z || E == null && z == null || xt(t, e, j, E, n, z);
  }
  function Wp(t) {
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
  function Ev() {
    if (typeof performance.getEntriesByType == "function") {
      for (var t = 0, e = 0, a = performance.getEntriesByType("resource"), n = 0; n < a.length; n++) {
        var l = a[n], u = l.transferSize, o = l.initiatorType, f = l.duration;
        if (u && f && Wp(o)) {
          for (o = 0, f = l.responseEnd, n += 1; n < a.length; n++) {
            var d = a[n], x = d.startTime;
            if (x > f) break;
            var O = d.transferSize, j = d.initiatorType;
            O && Wp(j) && (d = d.responseEnd, o += O * (d < f ? 1 : (f - x) / (d - x)));
          }
          if (--n, e += 8 * (u + o) / (l.duration / 1e3), t++, 10 < t) break;
        }
      }
      if (0 < t) return e / t / 1e6;
    }
    return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
  }
  var Bo = null, Lo = null;
  function hu(t) {
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  function $p(t) {
    switch (t) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function Ip(t, e) {
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
  function Go(t, e) {
    return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
  }
  var Qo = null;
  function Tv() {
    var t = window.event;
    return t && t.type === "popstate" ? t === Qo ? !1 : (Qo = t, !0) : (Qo = null, !1);
  }
  var Pp = typeof setTimeout == "function" ? setTimeout : void 0, Av = typeof clearTimeout == "function" ? clearTimeout : void 0, td = typeof Promise == "function" ? Promise : void 0, zv = typeof queueMicrotask == "function" ? queueMicrotask : typeof td < "u" ? function(t) {
    return td.resolve(null).then(t).catch(Ov);
  } : Pp;
  function Ov(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function ka(t) {
    return t === "head";
  }
  function ed(t, e) {
    var a = e, n = 0;
    do {
      var l = a.nextSibling;
      if (t.removeChild(a), l && l.nodeType === 8)
        if (a = l.data, a === "/$" || a === "/&") {
          if (n === 0) {
            t.removeChild(l), ll(e);
            return;
          }
          n--;
        } else if (a === "$" || a === "$?" || a === "$~" || a === "$!" || a === "&")
          n++;
        else if (a === "html")
          Fl(t.ownerDocument.documentElement);
        else if (a === "head") {
          a = t.ownerDocument.head, Fl(a);
          for (var u = a.firstChild; u; ) {
            var o = u.nextSibling, f = u.nodeName;
            u[dl] || f === "SCRIPT" || f === "STYLE" || f === "LINK" && u.rel.toLowerCase() === "stylesheet" || a.removeChild(u), u = o;
          }
        } else
          a === "body" && Fl(t.ownerDocument.body);
      a = l;
    } while (a);
    ll(e);
  }
  function ad(t, e) {
    var a = t;
    t = 0;
    do {
      var n = a.nextSibling;
      if (a.nodeType === 1 ? e ? (a._stashedDisplay = a.style.display, a.style.display = "none") : (a.style.display = a._stashedDisplay || "", a.getAttribute("style") === "" && a.removeAttribute("style")) : a.nodeType === 3 && (e ? (a._stashedText = a.nodeValue, a.nodeValue = "") : a.nodeValue = a._stashedText || ""), n && n.nodeType === 8)
        if (a = n.data, a === "/$") {
          if (t === 0) break;
          t--;
        } else
          a !== "$" && a !== "$?" && a !== "$~" && a !== "$!" || t++;
      a = n;
    } while (a);
  }
  function Yo(t) {
    var e = t.firstChild;
    for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
      var a = e;
      switch (e = e.nextSibling, a.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          Yo(a), Vu(a);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (a.rel.toLowerCase() === "stylesheet") continue;
      }
      t.removeChild(a);
    }
  }
  function Dv(t, e, a, n) {
    for (; t.nodeType === 1; ) {
      var l = a;
      if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
        if (!n && (t.nodeName !== "INPUT" || t.type !== "hidden"))
          break;
      } else if (n) {
        if (!t[dl])
          switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (u = t.getAttribute("rel"), u === "stylesheet" && t.hasAttribute("data-precedence"))
                break;
              if (u !== l.rel || t.getAttribute("href") !== (l.href == null || l.href === "" ? null : l.href) || t.getAttribute("crossorigin") !== (l.crossOrigin == null ? null : l.crossOrigin) || t.getAttribute("title") !== (l.title == null ? null : l.title))
                break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (u = t.getAttribute("src"), (u !== (l.src == null ? null : l.src) || t.getAttribute("type") !== (l.type == null ? null : l.type) || t.getAttribute("crossorigin") !== (l.crossOrigin == null ? null : l.crossOrigin)) && u && t.hasAttribute("async") && !t.hasAttribute("itemprop"))
                break;
              return t;
            default:
              return t;
          }
      } else if (e === "input" && t.type === "hidden") {
        var u = l.name == null ? null : "" + l.name;
        if (l.type === "hidden" && t.getAttribute("name") === u)
          return t;
      } else return t;
      if (t = He(t.nextSibling), t === null) break;
    }
    return null;
  }
  function wv(t, e, a) {
    if (e === "") return null;
    for (; t.nodeType !== 3; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !a || (t = He(t.nextSibling), t === null)) return null;
    return t;
  }
  function nd(t, e) {
    for (; t.nodeType !== 8; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = He(t.nextSibling), t === null)) return null;
    return t;
  }
  function ko(t) {
    return t.data === "$?" || t.data === "$~";
  }
  function Xo(t) {
    return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
  }
  function _v(t, e) {
    var a = t.ownerDocument;
    if (t.data === "$~") t._reactRetry = e;
    else if (t.data !== "$?" || a.readyState !== "loading")
      e();
    else {
      var n = function() {
        e(), a.removeEventListener("DOMContentLoaded", n);
      };
      a.addEventListener("DOMContentLoaded", n), t._reactRetry = n;
    }
  }
  function He(t) {
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
  var Zo = null;
  function ld(t) {
    t = t.nextSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var a = t.data;
        if (a === "/$" || a === "/&") {
          if (e === 0)
            return He(t.nextSibling);
          e--;
        } else
          a !== "$" && a !== "$!" && a !== "$?" && a !== "$~" && a !== "&" || e++;
      }
      t = t.nextSibling;
    }
    return null;
  }
  function id(t) {
    t = t.previousSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var a = t.data;
        if (a === "$" || a === "$!" || a === "$?" || a === "$~" || a === "&") {
          if (e === 0) return t;
          e--;
        } else a !== "/$" && a !== "/&" || e++;
      }
      t = t.previousSibling;
    }
    return null;
  }
  function ud(t, e, a) {
    switch (e = hu(a), t) {
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
  function Fl(t) {
    for (var e = t.attributes; e.length; )
      t.removeAttributeNode(e[0]);
    Vu(t);
  }
  var Be = /* @__PURE__ */ new Map(), cd = /* @__PURE__ */ new Set();
  function vu(t) {
    return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
  }
  var ga = R.d;
  R.d = {
    f: jv,
    r: Cv,
    D: Mv,
    C: Rv,
    L: Nv,
    m: Uv,
    X: Hv,
    S: qv,
    M: Bv
  };
  function jv() {
    var t = ga.f(), e = cu();
    return t || e;
  }
  function Cv(t) {
    var e = Tn(t);
    e !== null && e.tag === 5 && e.type === "form" ? Af(e) : ga.r(t);
  }
  var el = typeof document > "u" ? null : document;
  function od(t, e, a) {
    var n = el;
    if (n && typeof e == "string" && e) {
      var l = je(e);
      l = 'link[rel="' + t + '"][href="' + l + '"]', typeof a == "string" && (l += '[crossorigin="' + a + '"]'), cd.has(l) || (cd.add(l), t = { rel: t, crossOrigin: a, href: e }, n.querySelector(l) === null && (e = n.createElement("link"), ne(e, "link", t), Ft(e), n.head.appendChild(e)));
    }
  }
  function Mv(t) {
    ga.D(t), od("dns-prefetch", t, null);
  }
  function Rv(t, e) {
    ga.C(t, e), od("preconnect", t, e);
  }
  function Nv(t, e, a) {
    ga.L(t, e, a);
    var n = el;
    if (n && t && e) {
      var l = 'link[rel="preload"][as="' + je(e) + '"]';
      e === "image" && a && a.imageSrcSet ? (l += '[imagesrcset="' + je(
        a.imageSrcSet
      ) + '"]', typeof a.imageSizes == "string" && (l += '[imagesizes="' + je(
        a.imageSizes
      ) + '"]')) : l += '[href="' + je(t) + '"]';
      var u = l;
      switch (e) {
        case "style":
          u = al(t);
          break;
        case "script":
          u = nl(t);
      }
      Be.has(u) || (t = M(
        {
          rel: "preload",
          href: e === "image" && a && a.imageSrcSet ? void 0 : t,
          as: e
        },
        a
      ), Be.set(u, t), n.querySelector(l) !== null || e === "style" && n.querySelector(Wl(u)) || e === "script" && n.querySelector($l(u)) || (e = n.createElement("link"), ne(e, "link", t), Ft(e), n.head.appendChild(e)));
    }
  }
  function Uv(t, e) {
    ga.m(t, e);
    var a = el;
    if (a && t) {
      var n = e && typeof e.as == "string" ? e.as : "script", l = 'link[rel="modulepreload"][as="' + je(n) + '"][href="' + je(t) + '"]', u = l;
      switch (n) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = nl(t);
      }
      if (!Be.has(u) && (t = M({ rel: "modulepreload", href: t }, e), Be.set(u, t), a.querySelector(l) === null)) {
        switch (n) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (a.querySelector($l(u)))
              return;
        }
        n = a.createElement("link"), ne(n, "link", t), Ft(n), a.head.appendChild(n);
      }
    }
  }
  function qv(t, e, a) {
    ga.S(t, e, a);
    var n = el;
    if (n && t) {
      var l = An(n).hoistableStyles, u = al(t);
      e = e || "default";
      var o = l.get(u);
      if (!o) {
        var f = { loading: 0, preload: null };
        if (o = n.querySelector(
          Wl(u)
        ))
          f.loading = 5;
        else {
          t = M(
            { rel: "stylesheet", href: t, "data-precedence": e },
            a
          ), (a = Be.get(u)) && Vo(t, a);
          var d = o = n.createElement("link");
          Ft(d), ne(d, "link", t), d._p = new Promise(function(x, O) {
            d.onload = x, d.onerror = O;
          }), d.addEventListener("load", function() {
            f.loading |= 1;
          }), d.addEventListener("error", function() {
            f.loading |= 2;
          }), f.loading |= 4, yu(o, e, n);
        }
        o = {
          type: "stylesheet",
          instance: o,
          count: 1,
          state: f
        }, l.set(u, o);
      }
    }
  }
  function Hv(t, e) {
    ga.X(t, e);
    var a = el;
    if (a && t) {
      var n = An(a).hoistableScripts, l = nl(t), u = n.get(l);
      u || (u = a.querySelector($l(l)), u || (t = M({ src: t, async: !0 }, e), (e = Be.get(l)) && Ko(t, e), u = a.createElement("script"), Ft(u), ne(u, "link", t), a.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, n.set(l, u));
    }
  }
  function Bv(t, e) {
    ga.M(t, e);
    var a = el;
    if (a && t) {
      var n = An(a).hoistableScripts, l = nl(t), u = n.get(l);
      u || (u = a.querySelector($l(l)), u || (t = M({ src: t, async: !0, type: "module" }, e), (e = Be.get(l)) && Ko(t, e), u = a.createElement("script"), Ft(u), ne(u, "link", t), a.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, n.set(l, u));
    }
  }
  function sd(t, e, a, n) {
    var l = (l = nt.current) ? vu(l) : null;
    if (!l) throw Error(s(446));
    switch (t) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof a.precedence == "string" && typeof a.href == "string" ? (e = al(a.href), a = An(
          l
        ).hoistableStyles, n = a.get(e), n || (n = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, a.set(e, n)), n) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (a.rel === "stylesheet" && typeof a.href == "string" && typeof a.precedence == "string") {
          t = al(a.href);
          var u = An(
            l
          ).hoistableStyles, o = u.get(t);
          if (o || (l = l.ownerDocument || l, o = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, u.set(t, o), (u = l.querySelector(
            Wl(t)
          )) && !u._p && (o.instance = u, o.state.loading = 5), Be.has(t) || (a = {
            rel: "preload",
            as: "style",
            href: a.href,
            crossOrigin: a.crossOrigin,
            integrity: a.integrity,
            media: a.media,
            hrefLang: a.hrefLang,
            referrerPolicy: a.referrerPolicy
          }, Be.set(t, a), u || Lv(
            l,
            t,
            a,
            o.state
          ))), e && n === null)
            throw Error(s(528, ""));
          return o;
        }
        if (e && n !== null)
          throw Error(s(529, ""));
        return null;
      case "script":
        return e = a.async, a = a.src, typeof a == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = nl(a), a = An(
          l
        ).hoistableScripts, n = a.get(e), n || (n = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, a.set(e, n)), n) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(s(444, t));
    }
  }
  function al(t) {
    return 'href="' + je(t) + '"';
  }
  function Wl(t) {
    return 'link[rel="stylesheet"][' + t + "]";
  }
  function rd(t) {
    return M({}, t, {
      "data-precedence": t.precedence,
      precedence: null
    });
  }
  function Lv(t, e, a, n) {
    t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? n.loading = 1 : (e = t.createElement("link"), n.preload = e, e.addEventListener("load", function() {
      return n.loading |= 1;
    }), e.addEventListener("error", function() {
      return n.loading |= 2;
    }), ne(e, "link", a), Ft(e), t.head.appendChild(e));
  }
  function nl(t) {
    return '[src="' + je(t) + '"]';
  }
  function $l(t) {
    return "script[async]" + t;
  }
  function fd(t, e, a) {
    if (e.count++, e.instance === null)
      switch (e.type) {
        case "style":
          var n = t.querySelector(
            'style[data-href~="' + je(a.href) + '"]'
          );
          if (n)
            return e.instance = n, Ft(n), n;
          var l = M({}, a, {
            "data-href": a.href,
            "data-precedence": a.precedence,
            href: null,
            precedence: null
          });
          return n = (t.ownerDocument || t).createElement(
            "style"
          ), Ft(n), ne(n, "style", l), yu(n, a.precedence, t), e.instance = n;
        case "stylesheet":
          l = al(a.href);
          var u = t.querySelector(
            Wl(l)
          );
          if (u)
            return e.state.loading |= 4, e.instance = u, Ft(u), u;
          n = rd(a), (l = Be.get(l)) && Vo(n, l), u = (t.ownerDocument || t).createElement("link"), Ft(u);
          var o = u;
          return o._p = new Promise(function(f, d) {
            o.onload = f, o.onerror = d;
          }), ne(u, "link", n), e.state.loading |= 4, yu(u, a.precedence, t), e.instance = u;
        case "script":
          return u = nl(a.src), (l = t.querySelector(
            $l(u)
          )) ? (e.instance = l, Ft(l), l) : (n = a, (l = Be.get(u)) && (n = M({}, a), Ko(n, l)), t = t.ownerDocument || t, l = t.createElement("script"), Ft(l), ne(l, "link", n), t.head.appendChild(l), e.instance = l);
        case "void":
          return null;
        default:
          throw Error(s(443, e.type));
      }
    else
      e.type === "stylesheet" && (e.state.loading & 4) === 0 && (n = e.instance, e.state.loading |= 4, yu(n, a.precedence, t));
    return e.instance;
  }
  function yu(t, e, a) {
    for (var n = a.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), l = n.length ? n[n.length - 1] : null, u = l, o = 0; o < n.length; o++) {
      var f = n[o];
      if (f.dataset.precedence === e) u = f;
      else if (u !== l) break;
    }
    u ? u.parentNode.insertBefore(t, u.nextSibling) : (e = a.nodeType === 9 ? a.head : a, e.insertBefore(t, e.firstChild));
  }
  function Vo(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
  }
  function Ko(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
  }
  var gu = null;
  function pd(t, e, a) {
    if (gu === null) {
      var n = /* @__PURE__ */ new Map(), l = gu = /* @__PURE__ */ new Map();
      l.set(a, n);
    } else
      l = gu, n = l.get(a), n || (n = /* @__PURE__ */ new Map(), l.set(a, n));
    if (n.has(t)) return n;
    for (n.set(t, null), a = a.getElementsByTagName(t), l = 0; l < a.length; l++) {
      var u = a[l];
      if (!(u[dl] || u[Pt] || t === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
        var o = u.getAttribute(e) || "";
        o = t + o;
        var f = n.get(o);
        f ? f.push(u) : n.set(o, [u]);
      }
    }
    return n;
  }
  function dd(t, e, a) {
    t = t.ownerDocument || t, t.head.insertBefore(
      a,
      e === "title" ? t.querySelector("head > title") : null
    );
  }
  function Gv(t, e, a) {
    if (a === 1 || e.itemProp != null) return !1;
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
  function md(t) {
    return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
  }
  function Qv(t, e, a, n) {
    if (a.type === "stylesheet" && (typeof n.media != "string" || matchMedia(n.media).matches !== !1) && (a.state.loading & 4) === 0) {
      if (a.instance === null) {
        var l = al(n.href), u = e.querySelector(
          Wl(l)
        );
        if (u) {
          e = u._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = bu.bind(t), e.then(t, t)), a.state.loading |= 4, a.instance = u, Ft(u);
          return;
        }
        u = e.ownerDocument || e, n = rd(n), (l = Be.get(l)) && Vo(n, l), u = u.createElement("link"), Ft(u);
        var o = u;
        o._p = new Promise(function(f, d) {
          o.onload = f, o.onerror = d;
        }), ne(u, "link", n), a.instance = u;
      }
      t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(a, e), (e = a.state.preload) && (a.state.loading & 3) === 0 && (t.count++, a = bu.bind(t), e.addEventListener("load", a), e.addEventListener("error", a));
    }
  }
  var Jo = 0;
  function Yv(t, e) {
    return t.stylesheets && t.count === 0 && Su(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(a) {
      var n = setTimeout(function() {
        if (t.stylesheets && Su(t, t.stylesheets), t.unsuspend) {
          var u = t.unsuspend;
          t.unsuspend = null, u();
        }
      }, 6e4 + e);
      0 < t.imgBytes && Jo === 0 && (Jo = 62500 * Ev());
      var l = setTimeout(
        function() {
          if (t.waitingForImages = !1, t.count === 0 && (t.stylesheets && Su(t, t.stylesheets), t.unsuspend)) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        },
        (t.imgBytes > Jo ? 50 : 800) + e
      );
      return t.unsuspend = a, function() {
        t.unsuspend = null, clearTimeout(n), clearTimeout(l);
      };
    } : null;
  }
  function bu() {
    if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
      if (this.stylesheets) Su(this, this.stylesheets);
      else if (this.unsuspend) {
        var t = this.unsuspend;
        this.unsuspend = null, t();
      }
    }
  }
  var xu = null;
  function Su(t, e) {
    t.stylesheets = null, t.unsuspend !== null && (t.count++, xu = /* @__PURE__ */ new Map(), e.forEach(kv, t), xu = null, bu.call(t));
  }
  function kv(t, e) {
    if (!(e.state.loading & 4)) {
      var a = xu.get(t);
      if (a) var n = a.get(null);
      else {
        a = /* @__PURE__ */ new Map(), xu.set(t, a);
        for (var l = t.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), u = 0; u < l.length; u++) {
          var o = l[u];
          (o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (a.set(o.dataset.precedence, o), n = o);
        }
        n && a.set(null, n);
      }
      l = e.instance, o = l.getAttribute("data-precedence"), u = a.get(o) || n, u === n && a.set(null, l), a.set(o, l), this.count++, n = bu.bind(this), l.addEventListener("load", n), l.addEventListener("error", n), u ? u.parentNode.insertBefore(l, u.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(l, t.firstChild)), e.state.loading |= 4;
    }
  }
  var Il = {
    $$typeof: lt,
    Provider: null,
    Consumer: null,
    _currentValue: Z,
    _currentValue2: Z,
    _threadCount: 0
  };
  function Xv(t, e, a, n, l, u, o, f, d) {
    this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Yu(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Yu(0), this.hiddenUpdates = Yu(null), this.identifierPrefix = n, this.onUncaughtError = l, this.onCaughtError = u, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = d, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function hd(t, e, a, n, l, u, o, f, d, x, O, j) {
    return t = new Xv(
      t,
      e,
      a,
      o,
      d,
      x,
      O,
      j,
      f
    ), e = 1, u === !0 && (e |= 24), u = Se(3, null, null, e), t.current = u, u.stateNode = t, e = Oc(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
      element: n,
      isDehydrated: a,
      cache: e
    }, jc(u), t;
  }
  function vd(t) {
    return t ? (t = Nn, t) : Nn;
  }
  function yd(t, e, a, n, l, u) {
    l = vd(l), n.context === null ? n.context = l : n.pendingContext = l, n = Ma(e), n.payload = { element: a }, u = u === void 0 ? null : u, u !== null && (n.callback = u), a = Ra(t, n, e), a !== null && (ve(a, t, e), jl(a, t, e));
  }
  function gd(t, e) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var a = t.retryLane;
      t.retryLane = a !== 0 && a < e ? a : e;
    }
  }
  function Fo(t, e) {
    gd(t, e), (t = t.alternate) && gd(t, e);
  }
  function bd(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = en(t, 67108864);
      e !== null && ve(e, t, 67108864), Fo(t, 67108864);
    }
  }
  function xd(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Oe();
      e = ku(e);
      var a = en(t, e);
      a !== null && ve(a, t, e), Fo(t, e);
    }
  }
  var Eu = !0;
  function Zv(t, e, a, n) {
    var l = D.T;
    D.T = null;
    var u = R.p;
    try {
      R.p = 2, Wo(t, e, a, n);
    } finally {
      R.p = u, D.T = l;
    }
  }
  function Vv(t, e, a, n) {
    var l = D.T;
    D.T = null;
    var u = R.p;
    try {
      R.p = 8, Wo(t, e, a, n);
    } finally {
      R.p = u, D.T = l;
    }
  }
  function Wo(t, e, a, n) {
    if (Eu) {
      var l = $o(n);
      if (l === null)
        qo(
          t,
          e,
          n,
          Tu,
          a
        ), Ed(t, n);
      else if (Jv(
        l,
        t,
        e,
        a,
        n
      ))
        n.stopPropagation();
      else if (Ed(t, n), e & 4 && -1 < Kv.indexOf(t)) {
        for (; l !== null; ) {
          var u = Tn(l);
          if (u !== null)
            switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var o = Wa(u.pendingLanes);
                  if (o !== 0) {
                    var f = u;
                    for (f.pendingLanes |= 2, f.entangledLanes |= 2; o; ) {
                      var d = 1 << 31 - It(o);
                      f.entanglements[1] |= d, o &= ~d;
                    }
                    Je(u), (ht & 6) === 0 && (iu = ue() + 500, Vl(0));
                  }
                }
                break;
              case 31:
              case 13:
                f = en(u, 2), f !== null && ve(f, u, 2), cu(), Fo(u, 2);
            }
          if (u = $o(n), u === null && qo(
            t,
            e,
            n,
            Tu,
            a
          ), u === l) break;
          l = u;
        }
        l !== null && n.stopPropagation();
      } else
        qo(
          t,
          e,
          n,
          null,
          a
        );
    }
  }
  function $o(t) {
    return t = Iu(t), Io(t);
  }
  var Tu = null;
  function Io(t) {
    if (Tu = null, t = En(t), t !== null) {
      var e = g(t);
      if (e === null) t = null;
      else {
        var a = e.tag;
        if (a === 13) {
          if (t = A(e), t !== null) return t;
          t = null;
        } else if (a === 31) {
          if (t = S(e), t !== null) return t;
          t = null;
        } else if (a === 3) {
          if (e.stateNode.current.memoizedState.isDehydrated)
            return e.tag === 3 ? e.stateNode.containerInfo : null;
          t = null;
        } else e !== t && (t = null);
      }
    }
    return Tu = t, null;
  }
  function Sd(t) {
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
        switch (U()) {
          case X:
            return 2;
          case zt:
            return 8;
          case Ot:
          case Xt:
            return 32;
          case ge:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var Po = !1, Xa = null, Za = null, Va = null, Pl = /* @__PURE__ */ new Map(), ti = /* @__PURE__ */ new Map(), Ka = [], Kv = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function Ed(t, e) {
    switch (t) {
      case "focusin":
      case "focusout":
        Xa = null;
        break;
      case "dragenter":
      case "dragleave":
        Za = null;
        break;
      case "mouseover":
      case "mouseout":
        Va = null;
        break;
      case "pointerover":
      case "pointerout":
        Pl.delete(e.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        ti.delete(e.pointerId);
    }
  }
  function ei(t, e, a, n, l, u) {
    return t === null || t.nativeEvent !== u ? (t = {
      blockedOn: e,
      domEventName: a,
      eventSystemFlags: n,
      nativeEvent: u,
      targetContainers: [l]
    }, e !== null && (e = Tn(e), e !== null && bd(e)), t) : (t.eventSystemFlags |= n, e = t.targetContainers, l !== null && e.indexOf(l) === -1 && e.push(l), t);
  }
  function Jv(t, e, a, n, l) {
    switch (e) {
      case "focusin":
        return Xa = ei(
          Xa,
          t,
          e,
          a,
          n,
          l
        ), !0;
      case "dragenter":
        return Za = ei(
          Za,
          t,
          e,
          a,
          n,
          l
        ), !0;
      case "mouseover":
        return Va = ei(
          Va,
          t,
          e,
          a,
          n,
          l
        ), !0;
      case "pointerover":
        var u = l.pointerId;
        return Pl.set(
          u,
          ei(
            Pl.get(u) || null,
            t,
            e,
            a,
            n,
            l
          )
        ), !0;
      case "gotpointercapture":
        return u = l.pointerId, ti.set(
          u,
          ei(
            ti.get(u) || null,
            t,
            e,
            a,
            n,
            l
          )
        ), !0;
    }
    return !1;
  }
  function Td(t) {
    var e = En(t.target);
    if (e !== null) {
      var a = g(e);
      if (a !== null) {
        if (e = a.tag, e === 13) {
          if (e = A(a), e !== null) {
            t.blockedOn = e, qs(t.priority, function() {
              xd(a);
            });
            return;
          }
        } else if (e === 31) {
          if (e = S(a), e !== null) {
            t.blockedOn = e, qs(t.priority, function() {
              xd(a);
            });
            return;
          }
        } else if (e === 3 && a.stateNode.current.memoizedState.isDehydrated) {
          t.blockedOn = a.tag === 3 ? a.stateNode.containerInfo : null;
          return;
        }
      }
    }
    t.blockedOn = null;
  }
  function Au(t) {
    if (t.blockedOn !== null) return !1;
    for (var e = t.targetContainers; 0 < e.length; ) {
      var a = $o(t.nativeEvent);
      if (a === null) {
        a = t.nativeEvent;
        var n = new a.constructor(
          a.type,
          a
        );
        $u = n, a.target.dispatchEvent(n), $u = null;
      } else
        return e = Tn(a), e !== null && bd(e), t.blockedOn = a, !1;
      e.shift();
    }
    return !0;
  }
  function Ad(t, e, a) {
    Au(t) && a.delete(e);
  }
  function Fv() {
    Po = !1, Xa !== null && Au(Xa) && (Xa = null), Za !== null && Au(Za) && (Za = null), Va !== null && Au(Va) && (Va = null), Pl.forEach(Ad), ti.forEach(Ad);
  }
  function zu(t, e) {
    t.blockedOn === e && (t.blockedOn = null, Po || (Po = !0, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      Fv
    )));
  }
  var Ou = null;
  function zd(t) {
    Ou !== t && (Ou = t, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      function() {
        Ou === t && (Ou = null);
        for (var e = 0; e < t.length; e += 3) {
          var a = t[e], n = t[e + 1], l = t[e + 2];
          if (typeof n != "function") {
            if (Io(n || a) === null)
              continue;
            break;
          }
          var u = Tn(a);
          u !== null && (t.splice(e, 3), e -= 3, Wc(
            u,
            {
              pending: !0,
              data: l,
              method: a.method,
              action: n
            },
            n,
            l
          ));
        }
      }
    ));
  }
  function ll(t) {
    function e(d) {
      return zu(d, t);
    }
    Xa !== null && zu(Xa, t), Za !== null && zu(Za, t), Va !== null && zu(Va, t), Pl.forEach(e), ti.forEach(e);
    for (var a = 0; a < Ka.length; a++) {
      var n = Ka[a];
      n.blockedOn === t && (n.blockedOn = null);
    }
    for (; 0 < Ka.length && (a = Ka[0], a.blockedOn === null); )
      Td(a), a.blockedOn === null && Ka.shift();
    if (a = (t.ownerDocument || t).$$reactFormReplay, a != null)
      for (n = 0; n < a.length; n += 3) {
        var l = a[n], u = a[n + 1], o = l[re] || null;
        if (typeof u == "function")
          o || zd(a);
        else if (o) {
          var f = null;
          if (u && u.hasAttribute("formAction")) {
            if (l = u, o = u[re] || null)
              f = o.formAction;
            else if (Io(l) !== null) continue;
          } else f = o.action;
          typeof f == "function" ? a[n + 1] = f : (a.splice(n, 3), n -= 3), zd(a);
        }
      }
  }
  function Od() {
    function t(u) {
      u.canIntercept && u.info === "react-transition" && u.intercept({
        handler: function() {
          return new Promise(function(o) {
            return l = o;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function e() {
      l !== null && (l(), l = null), n || setTimeout(a, 20);
    }
    function a() {
      if (!n && !navigation.transition) {
        var u = navigation.currentEntry;
        u && u.url != null && navigation.navigate(u.url, {
          state: u.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var n = !1, l = null;
      return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(a, 100), function() {
        n = !0, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), l !== null && (l(), l = null);
      };
    }
  }
  function ts(t) {
    this._internalRoot = t;
  }
  Du.prototype.render = ts.prototype.render = function(t) {
    var e = this._internalRoot;
    if (e === null) throw Error(s(409));
    var a = e.current, n = Oe();
    yd(a, n, t, e, null, null);
  }, Du.prototype.unmount = ts.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var e = t.containerInfo;
      yd(t.current, 2, null, t, null, null), cu(), e[Sn] = null;
    }
  };
  function Du(t) {
    this._internalRoot = t;
  }
  Du.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var e = Us();
      t = { blockedOn: null, target: t, priority: e };
      for (var a = 0; a < Ka.length && e !== 0 && e < Ka[a].priority; a++) ;
      Ka.splice(a, 0, t), a === 0 && Td(t);
    }
  };
  var Dd = c.version;
  if (Dd !== "19.2.5")
    throw Error(
      s(
        527,
        Dd,
        "19.2.5"
      )
    );
  R.findDOMNode = function(t) {
    var e = t._reactInternals;
    if (e === void 0)
      throw typeof t.render == "function" ? Error(s(188)) : (t = Object.keys(t).join(","), Error(s(268, t)));
    return t = v(e), t = t !== null ? C(t) : null, t = t === null ? null : t.stateNode, t;
  };
  var Wv = {
    bundleType: 0,
    version: "19.2.5",
    rendererPackageName: "react-dom",
    currentDispatcherRef: D,
    reconcilerVersion: "19.2.5"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var wu = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!wu.isDisabled && wu.supportsFiber)
      try {
        ta = wu.inject(
          Wv
        ), $t = wu;
      } catch {
      }
  }
  return ni.createRoot = function(t, e) {
    if (!p(t)) throw Error(s(299));
    var a = !1, n = "", l = Nf, u = Uf, o = qf;
    return e != null && (e.unstable_strictMode === !0 && (a = !0), e.identifierPrefix !== void 0 && (n = e.identifierPrefix), e.onUncaughtError !== void 0 && (l = e.onUncaughtError), e.onCaughtError !== void 0 && (u = e.onCaughtError), e.onRecoverableError !== void 0 && (o = e.onRecoverableError)), e = hd(
      t,
      1,
      !1,
      null,
      null,
      a,
      n,
      null,
      l,
      u,
      o,
      Od
    ), t[Sn] = e.current, Uo(t), new ts(e);
  }, ni.hydrateRoot = function(t, e, a) {
    if (!p(t)) throw Error(s(299));
    var n = !1, l = "", u = Nf, o = Uf, f = qf, d = null;
    return a != null && (a.unstable_strictMode === !0 && (n = !0), a.identifierPrefix !== void 0 && (l = a.identifierPrefix), a.onUncaughtError !== void 0 && (u = a.onUncaughtError), a.onCaughtError !== void 0 && (o = a.onCaughtError), a.onRecoverableError !== void 0 && (f = a.onRecoverableError), a.formState !== void 0 && (d = a.formState)), e = hd(
      t,
      1,
      !0,
      e,
      a ?? null,
      n,
      l,
      d,
      u,
      o,
      f,
      Od
    ), e.context = vd(null), a = e.current, n = Oe(), n = ku(n), l = Ma(n), l.callback = null, Ra(a, l, n), a = n, e.current.lanes = a, pl(e, a), Je(e), t[Sn] = e.current, Uo(t), new Du(e);
  }, ni.version = "19.2.5", ni;
}
var Hd;
function uy() {
  if (Hd) return as.exports;
  Hd = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (c) {
        console.error(c);
      }
  }
  return i(), as.exports = iy(), as.exports;
}
var cy = uy(), Bu = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set(), this.subscribe = this.subscribe.bind(this);
  }
  subscribe(i) {
    return this.listeners.add(i), this.onSubscribe(), () => {
      this.listeners.delete(i), this.onUnsubscribe();
    };
  }
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {
  }
  onUnsubscribe() {
  }
}, oy = class extends Bu {
  #t;
  #a;
  #e;
  constructor() {
    super(), this.#e = (i) => {
      if (typeof window < "u" && window.addEventListener) {
        const c = () => i();
        return window.addEventListener("visibilitychange", c, !1), () => {
          window.removeEventListener("visibilitychange", c);
        };
      }
    };
  }
  onSubscribe() {
    this.#a || this.setEventListener(this.#e);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#a?.(), this.#a = void 0);
  }
  setEventListener(i) {
    this.#e = i, this.#a?.(), this.#a = i((c) => {
      typeof c == "boolean" ? this.setFocused(c) : this.onFocus();
    });
  }
  setFocused(i) {
    this.#t !== i && (this.#t = i, this.onFocus());
  }
  onFocus() {
    const i = this.isFocused();
    this.listeners.forEach((c) => {
      c(i);
    });
  }
  isFocused() {
    return typeof this.#t == "boolean" ? this.#t : globalThis.document?.visibilityState !== "hidden";
  }
}, bm = new oy(), sy = {
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
  setTimeout: (i, c) => setTimeout(i, c),
  clearTimeout: (i) => clearTimeout(i),
  setInterval: (i, c) => setInterval(i, c),
  clearInterval: (i) => clearInterval(i)
}, ry = class {
  // We cannot have TimeoutManager<T> as we must instantiate it with a concrete
  // type at app boot; and if we leave that type, then any new timer provider
  // would need to support the default provider's concrete timer ID, which is
  // infeasible across environments.
  //
  // We settle for type safety for the TimeoutProvider type, and accept that
  // this class is unsafe internally to allow for extension.
  #t = sy;
  #a = !1;
  setTimeoutProvider(i) {
    this.#t = i;
  }
  setTimeout(i, c) {
    return this.#t.setTimeout(i, c);
  }
  clearTimeout(i) {
    this.#t.clearTimeout(i);
  }
  setInterval(i, c) {
    return this.#t.setInterval(i, c);
  }
  clearInterval(i) {
    this.#t.clearInterval(i);
  }
}, ms = new ry();
function fy(i) {
  setTimeout(i, 0);
}
var py = typeof window > "u" || "Deno" in globalThis;
function ke() {
}
function dy(i, c) {
  return typeof i == "function" ? i(c) : i;
}
function my(i) {
  return typeof i == "number" && i >= 0 && i !== 1 / 0;
}
function hy(i, c) {
  return Math.max(i + (c || 0) - Date.now(), 0);
}
function hs(i, c) {
  return typeof i == "function" ? i(c) : i;
}
function vy(i, c) {
  return typeof i == "function" ? i(c) : i;
}
function Bd(i, c) {
  const {
    type: r = "all",
    exact: s,
    fetchStatus: p,
    predicate: g,
    queryKey: A,
    stale: S
  } = i;
  if (A) {
    if (s) {
      if (c.queryHash !== ws(A, c.options))
        return !1;
    } else if (!ri(c.queryKey, A))
      return !1;
  }
  if (r !== "all") {
    const T = c.isActive();
    if (r === "active" && !T || r === "inactive" && T)
      return !1;
  }
  return !(typeof S == "boolean" && c.isStale() !== S || p && p !== c.state.fetchStatus || g && !g(c));
}
function Ld(i, c) {
  const { exact: r, status: s, predicate: p, mutationKey: g } = i;
  if (g) {
    if (!c.options.mutationKey)
      return !1;
    if (r) {
      if (si(c.options.mutationKey) !== si(g))
        return !1;
    } else if (!ri(c.options.mutationKey, g))
      return !1;
  }
  return !(s && c.state.status !== s || p && !p(c));
}
function ws(i, c) {
  return (c?.queryKeyHashFn || si)(i);
}
function si(i) {
  return JSON.stringify(
    i,
    (c, r) => vs(r) ? Object.keys(r).sort().reduce((s, p) => (s[p] = r[p], s), {}) : r
  );
}
function ri(i, c) {
  return i === c ? !0 : typeof i != typeof c ? !1 : i && c && typeof i == "object" && typeof c == "object" ? Object.keys(c).every((r) => ri(i[r], c[r])) : !1;
}
var yy = Object.prototype.hasOwnProperty;
function xm(i, c, r = 0) {
  if (i === c)
    return i;
  if (r > 500) return c;
  const s = Gd(i) && Gd(c);
  if (!s && !(vs(i) && vs(c))) return c;
  const g = (s ? i : Object.keys(i)).length, A = s ? c : Object.keys(c), S = A.length, T = s ? new Array(S) : {};
  let v = 0;
  for (let C = 0; C < S; C++) {
    const M = s ? C : A[C], Q = i[M], k = c[M];
    if (Q === k) {
      T[M] = Q, (s ? C < g : yy.call(i, M)) && v++;
      continue;
    }
    if (Q === null || k === null || typeof Q != "object" || typeof k != "object") {
      T[M] = k;
      continue;
    }
    const W = xm(Q, k, r + 1);
    T[M] = W, W === Q && v++;
  }
  return g === S && v === g ? i : T;
}
function Gd(i) {
  return Array.isArray(i) && i.length === Object.keys(i).length;
}
function vs(i) {
  if (!Qd(i))
    return !1;
  const c = i.constructor;
  if (c === void 0)
    return !0;
  const r = c.prototype;
  return !(!Qd(r) || !r.hasOwnProperty("isPrototypeOf") || Object.getPrototypeOf(i) !== Object.prototype);
}
function Qd(i) {
  return Object.prototype.toString.call(i) === "[object Object]";
}
function gy(i) {
  return new Promise((c) => {
    ms.setTimeout(c, i);
  });
}
function by(i, c, r) {
  return typeof r.structuralSharing == "function" ? r.structuralSharing(i, c) : r.structuralSharing !== !1 ? xm(i, c) : c;
}
function xy(i, c, r = 0) {
  const s = [...i, c];
  return r && s.length > r ? s.slice(1) : s;
}
function Sy(i, c, r = 0) {
  const s = [c, ...i];
  return r && s.length > r ? s.slice(0, -1) : s;
}
var _s = /* @__PURE__ */ Symbol();
function Sm(i, c) {
  return !i.queryFn && c?.initialPromise ? () => c.initialPromise : !i.queryFn || i.queryFn === _s ? () => Promise.reject(new Error(`Missing queryFn: '${i.queryHash}'`)) : i.queryFn;
}
function Ey(i, c, r) {
  let s = !1, p;
  return Object.defineProperty(i, "signal", {
    enumerable: !0,
    get: () => (p ??= c(), s || (s = !0, p.aborted ? r() : p.addEventListener("abort", r, { once: !0 })), p)
  }), i;
}
var Em = /* @__PURE__ */ (() => {
  let i = () => py;
  return {
    /**
     * Returns whether the current runtime should be treated as a server environment.
     */
    isServer() {
      return i();
    },
    /**
     * Overrides the server check globally.
     */
    setIsServer(c) {
      i = c;
    }
  };
})();
function Ty() {
  let i, c;
  const r = new Promise((p, g) => {
    i = p, c = g;
  });
  r.status = "pending", r.catch(() => {
  });
  function s(p) {
    Object.assign(r, p), delete r.resolve, delete r.reject;
  }
  return r.resolve = (p) => {
    s({
      status: "fulfilled",
      value: p
    }), i(p);
  }, r.reject = (p) => {
    s({
      status: "rejected",
      reason: p
    }), c(p);
  }, r;
}
var Ay = fy;
function zy() {
  let i = [], c = 0, r = (S) => {
    S();
  }, s = (S) => {
    S();
  }, p = Ay;
  const g = (S) => {
    c ? i.push(S) : p(() => {
      r(S);
    });
  }, A = () => {
    const S = i;
    i = [], S.length && p(() => {
      s(() => {
        S.forEach((T) => {
          r(T);
        });
      });
    });
  };
  return {
    batch: (S) => {
      let T;
      c++;
      try {
        T = S();
      } finally {
        c--, c || A();
      }
      return T;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (S) => (...T) => {
      g(() => {
        S(...T);
      });
    },
    schedule: g,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (S) => {
      r = S;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * By default React Query will use the batch function provided by ReactDOM or React Native.
     */
    setBatchNotifyFunction: (S) => {
      s = S;
    },
    setScheduler: (S) => {
      p = S;
    }
  };
}
var oe = zy(), Oy = class extends Bu {
  #t = !0;
  #a;
  #e;
  constructor() {
    super(), this.#e = (i) => {
      if (typeof window < "u" && window.addEventListener) {
        const c = () => i(!0), r = () => i(!1);
        return window.addEventListener("online", c, !1), window.addEventListener("offline", r, !1), () => {
          window.removeEventListener("online", c), window.removeEventListener("offline", r);
        };
      }
    };
  }
  onSubscribe() {
    this.#a || this.setEventListener(this.#e);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#a?.(), this.#a = void 0);
  }
  setEventListener(i) {
    this.#e = i, this.#a?.(), this.#a = i(this.setOnline.bind(this));
  }
  setOnline(i) {
    this.#t !== i && (this.#t = i, this.listeners.forEach((r) => {
      r(i);
    }));
  }
  isOnline() {
    return this.#t;
  }
}, Ru = new Oy();
function Dy(i) {
  return Math.min(1e3 * 2 ** i, 3e4);
}
function Tm(i) {
  return (i ?? "online") === "online" ? Ru.isOnline() : !0;
}
var ys = class extends Error {
  constructor(i) {
    super("CancelledError"), this.revert = i?.revert, this.silent = i?.silent;
  }
};
function Am(i) {
  let c = !1, r = 0, s;
  const p = Ty(), g = () => p.status !== "pending", A = (J) => {
    if (!g()) {
      const H = new ys(J);
      Q(H), i.onCancel?.(H);
    }
  }, S = () => {
    c = !0;
  }, T = () => {
    c = !1;
  }, v = () => bm.isFocused() && (i.networkMode === "always" || Ru.isOnline()) && i.canRun(), C = () => Tm(i.networkMode) && i.canRun(), M = (J) => {
    g() || (s?.(), p.resolve(J));
  }, Q = (J) => {
    g() || (s?.(), p.reject(J));
  }, k = () => new Promise((J) => {
    s = (H) => {
      (g() || v()) && J(H);
    }, i.onPause?.();
  }).then(() => {
    s = void 0, g() || i.onContinue?.();
  }), W = () => {
    if (g())
      return;
    let J;
    const H = r === 0 ? i.initialPromise : void 0;
    try {
      J = H ?? i.fn();
    } catch (V) {
      J = Promise.reject(V);
    }
    Promise.resolve(J).then(M).catch((V) => {
      if (g())
        return;
      const ft = i.retry ?? (Em.isServer() ? 0 : 3), lt = i.retryDelay ?? Dy, pt = typeof lt == "function" ? lt(r, V) : lt, Ut = ft === !0 || typeof ft == "number" && r < ft || typeof ft == "function" && ft(r, V);
      if (c || !Ut) {
        Q(V);
        return;
      }
      r++, i.onFail?.(r, V), gy(pt).then(() => v() ? void 0 : k()).then(() => {
        c ? Q(V) : W();
      });
    });
  };
  return {
    promise: p,
    status: () => p.status,
    cancel: A,
    continue: () => (s?.(), p),
    cancelRetry: S,
    continueRetry: T,
    canStart: C,
    start: () => (C() ? W() : k().then(W), p)
  };
}
var zm = class {
  #t;
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout(), my(this.gcTime) && (this.#t = ms.setTimeout(() => {
      this.optionalRemove();
    }, this.gcTime));
  }
  updateGcTime(i) {
    this.gcTime = Math.max(
      this.gcTime || 0,
      i ?? (Em.isServer() ? 1 / 0 : 300 * 1e3)
    );
  }
  clearGcTimeout() {
    this.#t !== void 0 && (ms.clearTimeout(this.#t), this.#t = void 0);
  }
}, wy = class extends zm {
  #t;
  #a;
  #e;
  #l;
  #n;
  #i;
  #u;
  constructor(i) {
    super(), this.#u = !1, this.#i = i.defaultOptions, this.setOptions(i.options), this.observers = [], this.#l = i.client, this.#e = this.#l.getQueryCache(), this.queryKey = i.queryKey, this.queryHash = i.queryHash, this.#t = kd(this.options), this.state = i.state ?? this.#t, this.scheduleGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#n?.promise;
  }
  setOptions(i) {
    if (this.options = { ...this.#i, ...i }, this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
      const c = kd(this.options);
      c.data !== void 0 && (this.setState(
        Yd(c.data, c.dataUpdatedAt)
      ), this.#t = c);
    }
  }
  optionalRemove() {
    !this.observers.length && this.state.fetchStatus === "idle" && this.#e.remove(this);
  }
  setData(i, c) {
    const r = by(this.state.data, i, this.options);
    return this.#c({
      data: r,
      type: "success",
      dataUpdatedAt: c?.updatedAt,
      manual: c?.manual
    }), r;
  }
  setState(i, c) {
    this.#c({ type: "setState", state: i, setStateOptions: c });
  }
  cancel(i) {
    const c = this.#n?.promise;
    return this.#n?.cancel(i), c ? c.then(ke).catch(ke) : Promise.resolve();
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
      (i) => vy(i.options.enabled, this) !== !1
    );
  }
  isDisabled() {
    return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === _s || !this.isFetched();
  }
  isFetched() {
    return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
  }
  isStatic() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (i) => hs(i.options.staleTime, this) === "static"
    ) : !1;
  }
  isStale() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (i) => i.getCurrentResult().isStale
    ) : this.state.data === void 0 || this.state.isInvalidated;
  }
  isStaleByTime(i = 0) {
    return this.state.data === void 0 ? !0 : i === "static" ? !1 : this.state.isInvalidated ? !0 : !hy(this.state.dataUpdatedAt, i);
  }
  onFocus() {
    this.observers.find((c) => c.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: !1 }), this.#n?.continue();
  }
  onOnline() {
    this.observers.find((c) => c.shouldFetchOnReconnect())?.refetch({ cancelRefetch: !1 }), this.#n?.continue();
  }
  addObserver(i) {
    this.observers.includes(i) || (this.observers.push(i), this.clearGcTimeout(), this.#e.notify({ type: "observerAdded", query: this, observer: i }));
  }
  removeObserver(i) {
    this.observers.includes(i) && (this.observers = this.observers.filter((c) => c !== i), this.observers.length || (this.#n && (this.#u || this.#o() ? this.#n.cancel({ revert: !0 }) : this.#n.cancelRetry()), this.scheduleGc()), this.#e.notify({ type: "observerRemoved", query: this, observer: i }));
  }
  getObserversCount() {
    return this.observers.length;
  }
  #o() {
    return this.state.fetchStatus === "paused" && this.state.status === "pending";
  }
  invalidate() {
    this.state.isInvalidated || this.#c({ type: "invalidate" });
  }
  async fetch(i, c) {
    if (this.state.fetchStatus !== "idle" && // If the promise in the retryer is already rejected, we have to definitely
    // re-start the fetch; there is a chance that the query is still in a
    // pending state when that happens
    this.#n?.status() !== "rejected") {
      if (this.state.data !== void 0 && c?.cancelRefetch)
        this.cancel({ silent: !0 });
      else if (this.#n)
        return this.#n.continueRetry(), this.#n.promise;
    }
    if (i && this.setOptions(i), !this.options.queryFn) {
      const S = this.observers.find((T) => T.options.queryFn);
      S && this.setOptions(S.options);
    }
    const r = new AbortController(), s = (S) => {
      Object.defineProperty(S, "signal", {
        enumerable: !0,
        get: () => (this.#u = !0, r.signal)
      });
    }, p = () => {
      const S = Sm(this.options, c), v = (() => {
        const C = {
          client: this.#l,
          queryKey: this.queryKey,
          meta: this.meta
        };
        return s(C), C;
      })();
      return this.#u = !1, this.options.persister ? this.options.persister(
        S,
        v,
        this
      ) : S(v);
    }, A = (() => {
      const S = {
        fetchOptions: c,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#l,
        state: this.state,
        fetchFn: p
      };
      return s(S), S;
    })();
    this.options.behavior?.onFetch(A, this), this.#a = this.state, (this.state.fetchStatus === "idle" || this.state.fetchMeta !== A.fetchOptions?.meta) && this.#c({ type: "fetch", meta: A.fetchOptions?.meta }), this.#n = Am({
      initialPromise: c?.initialPromise,
      fn: A.fetchFn,
      onCancel: (S) => {
        S instanceof ys && S.revert && this.setState({
          ...this.#a,
          fetchStatus: "idle"
        }), r.abort();
      },
      onFail: (S, T) => {
        this.#c({ type: "failed", failureCount: S, error: T });
      },
      onPause: () => {
        this.#c({ type: "pause" });
      },
      onContinue: () => {
        this.#c({ type: "continue" });
      },
      retry: A.options.retry,
      retryDelay: A.options.retryDelay,
      networkMode: A.options.networkMode,
      canRun: () => !0
    });
    try {
      const S = await this.#n.start();
      if (S === void 0)
        throw new Error(`${this.queryHash} data is undefined`);
      return this.setData(S), this.#e.config.onSuccess?.(S, this), this.#e.config.onSettled?.(
        S,
        this.state.error,
        this
      ), S;
    } catch (S) {
      if (S instanceof ys) {
        if (S.silent)
          return this.#n.promise;
        if (S.revert) {
          if (this.state.data === void 0)
            throw S;
          return this.state.data;
        }
      }
      throw this.#c({
        type: "error",
        error: S
      }), this.#e.config.onError?.(
        S,
        this
      ), this.#e.config.onSettled?.(
        this.state.data,
        S,
        this
      ), S;
    } finally {
      this.scheduleGc();
    }
  }
  #c(i) {
    const c = (r) => {
      switch (i.type) {
        case "failed":
          return {
            ...r,
            fetchFailureCount: i.failureCount,
            fetchFailureReason: i.error
          };
        case "pause":
          return {
            ...r,
            fetchStatus: "paused"
          };
        case "continue":
          return {
            ...r,
            fetchStatus: "fetching"
          };
        case "fetch":
          return {
            ...r,
            ..._y(r.data, this.options),
            fetchMeta: i.meta ?? null
          };
        case "success":
          const s = {
            ...r,
            ...Yd(i.data, i.dataUpdatedAt),
            dataUpdateCount: r.dataUpdateCount + 1,
            ...!i.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          return this.#a = i.manual ? s : void 0, s;
        case "error":
          const p = i.error;
          return {
            ...r,
            error: p,
            errorUpdateCount: r.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: r.fetchFailureCount + 1,
            fetchFailureReason: p,
            fetchStatus: "idle",
            status: "error",
            // flag existing data as invalidated if we get a background error
            // note that "no data" always means stale so we can set unconditionally here
            isInvalidated: !0
          };
        case "invalidate":
          return {
            ...r,
            isInvalidated: !0
          };
        case "setState":
          return {
            ...r,
            ...i.state
          };
      }
    };
    this.state = c(this.state), oe.batch(() => {
      this.observers.forEach((r) => {
        r.onQueryUpdate();
      }), this.#e.notify({ query: this, type: "updated", action: i });
    });
  }
};
function _y(i, c) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: Tm(c.networkMode) ? "fetching" : "paused",
    ...i === void 0 && {
      error: null,
      status: "pending"
    }
  };
}
function Yd(i, c) {
  return {
    data: i,
    dataUpdatedAt: c ?? Date.now(),
    error: null,
    isInvalidated: !1,
    status: "success"
  };
}
function kd(i) {
  const c = typeof i.initialData == "function" ? i.initialData() : i.initialData, r = c !== void 0, s = r ? typeof i.initialDataUpdatedAt == "function" ? i.initialDataUpdatedAt() : i.initialDataUpdatedAt : 0;
  return {
    data: c,
    dataUpdateCount: 0,
    dataUpdatedAt: r ? s ?? Date.now() : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: !1,
    status: r ? "success" : "pending",
    fetchStatus: "idle"
  };
}
function Xd(i) {
  return {
    onFetch: (c, r) => {
      const s = c.options, p = c.fetchOptions?.meta?.fetchMore?.direction, g = c.state.data?.pages || [], A = c.state.data?.pageParams || [];
      let S = { pages: [], pageParams: [] }, T = 0;
      const v = async () => {
        let C = !1;
        const M = (W) => {
          Ey(
            W,
            () => c.signal,
            () => C = !0
          );
        }, Q = Sm(c.options, c.fetchOptions), k = async (W, J, H) => {
          if (C)
            return Promise.reject();
          if (J == null && W.pages.length)
            return Promise.resolve(W);
          const ft = (() => {
            const Bt = {
              client: c.client,
              queryKey: c.queryKey,
              pageParam: J,
              direction: H ? "backward" : "forward",
              meta: c.options.meta
            };
            return M(Bt), Bt;
          })(), lt = await Q(ft), { maxPages: pt } = c.options, Ut = H ? Sy : xy;
          return {
            pages: Ut(W.pages, lt, pt),
            pageParams: Ut(W.pageParams, J, pt)
          };
        };
        if (p && g.length) {
          const W = p === "backward", J = W ? jy : Zd, H = {
            pages: g,
            pageParams: A
          }, V = J(s, H);
          S = await k(H, V, W);
        } else {
          const W = i ?? g.length;
          do {
            const J = T === 0 ? A[0] ?? s.initialPageParam : Zd(s, S);
            if (T > 0 && J == null)
              break;
            S = await k(S, J), T++;
          } while (T < W);
        }
        return S;
      };
      c.options.persister ? c.fetchFn = () => c.options.persister?.(
        v,
        {
          client: c.client,
          queryKey: c.queryKey,
          meta: c.options.meta,
          signal: c.signal
        },
        r
      ) : c.fetchFn = v;
    }
  };
}
function Zd(i, { pages: c, pageParams: r }) {
  const s = c.length - 1;
  return c.length > 0 ? i.getNextPageParam(
    c[s],
    c,
    r[s],
    r
  ) : void 0;
}
function jy(i, { pages: c, pageParams: r }) {
  return c.length > 0 ? i.getPreviousPageParam?.(c[0], c, r[0], r) : void 0;
}
var Cy = class extends zm {
  #t;
  #a;
  #e;
  #l;
  constructor(i) {
    super(), this.#t = i.client, this.mutationId = i.mutationId, this.#e = i.mutationCache, this.#a = [], this.state = i.state || My(), this.setOptions(i.options), this.scheduleGc();
  }
  setOptions(i) {
    this.options = i, this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  addObserver(i) {
    this.#a.includes(i) || (this.#a.push(i), this.clearGcTimeout(), this.#e.notify({
      type: "observerAdded",
      mutation: this,
      observer: i
    }));
  }
  removeObserver(i) {
    this.#a = this.#a.filter((c) => c !== i), this.scheduleGc(), this.#e.notify({
      type: "observerRemoved",
      mutation: this,
      observer: i
    });
  }
  optionalRemove() {
    this.#a.length || (this.state.status === "pending" ? this.scheduleGc() : this.#e.remove(this));
  }
  continue() {
    return this.#l?.continue() ?? // continuing a mutation assumes that variables are set, mutation must have been dehydrated before
    this.execute(this.state.variables);
  }
  async execute(i) {
    const c = () => {
      this.#n({ type: "continue" });
    }, r = {
      client: this.#t,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#l = Am({
      fn: () => this.options.mutationFn ? this.options.mutationFn(i, r) : Promise.reject(new Error("No mutationFn found")),
      onFail: (g, A) => {
        this.#n({ type: "failed", failureCount: g, error: A });
      },
      onPause: () => {
        this.#n({ type: "pause" });
      },
      onContinue: c,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#e.canRun(this)
    });
    const s = this.state.status === "pending", p = !this.#l.canStart();
    try {
      if (s)
        c();
      else {
        this.#n({ type: "pending", variables: i, isPaused: p }), this.#e.config.onMutate && await this.#e.config.onMutate(
          i,
          this,
          r
        );
        const A = await this.options.onMutate?.(
          i,
          r
        );
        A !== this.state.context && this.#n({
          type: "pending",
          context: A,
          variables: i,
          isPaused: p
        });
      }
      const g = await this.#l.start();
      return await this.#e.config.onSuccess?.(
        g,
        i,
        this.state.context,
        this,
        r
      ), await this.options.onSuccess?.(
        g,
        i,
        this.state.context,
        r
      ), await this.#e.config.onSettled?.(
        g,
        null,
        this.state.variables,
        this.state.context,
        this,
        r
      ), await this.options.onSettled?.(
        g,
        null,
        i,
        this.state.context,
        r
      ), this.#n({ type: "success", data: g }), g;
    } catch (g) {
      try {
        await this.#e.config.onError?.(
          g,
          i,
          this.state.context,
          this,
          r
        );
      } catch (A) {
        Promise.reject(A);
      }
      try {
        await this.options.onError?.(
          g,
          i,
          this.state.context,
          r
        );
      } catch (A) {
        Promise.reject(A);
      }
      try {
        await this.#e.config.onSettled?.(
          void 0,
          g,
          this.state.variables,
          this.state.context,
          this,
          r
        );
      } catch (A) {
        Promise.reject(A);
      }
      try {
        await this.options.onSettled?.(
          void 0,
          g,
          i,
          this.state.context,
          r
        );
      } catch (A) {
        Promise.reject(A);
      }
      throw this.#n({ type: "error", error: g }), g;
    } finally {
      this.#e.runNext(this);
    }
  }
  #n(i) {
    const c = (r) => {
      switch (i.type) {
        case "failed":
          return {
            ...r,
            failureCount: i.failureCount,
            failureReason: i.error
          };
        case "pause":
          return {
            ...r,
            isPaused: !0
          };
        case "continue":
          return {
            ...r,
            isPaused: !1
          };
        case "pending":
          return {
            ...r,
            context: i.context,
            data: void 0,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: i.isPaused,
            status: "pending",
            variables: i.variables,
            submittedAt: Date.now()
          };
        case "success":
          return {
            ...r,
            data: i.data,
            failureCount: 0,
            failureReason: null,
            error: null,
            status: "success",
            isPaused: !1
          };
        case "error":
          return {
            ...r,
            data: void 0,
            error: i.error,
            failureCount: r.failureCount + 1,
            failureReason: i.error,
            isPaused: !1,
            status: "error"
          };
      }
    };
    this.state = c(this.state), oe.batch(() => {
      this.#a.forEach((r) => {
        r.onMutationUpdate(i);
      }), this.#e.notify({
        mutation: this,
        type: "updated",
        action: i
      });
    });
  }
};
function My() {
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
var Ry = class extends Bu {
  constructor(i = {}) {
    super(), this.config = i, this.#t = /* @__PURE__ */ new Set(), this.#a = /* @__PURE__ */ new Map(), this.#e = 0;
  }
  #t;
  #a;
  #e;
  build(i, c, r) {
    const s = new Cy({
      client: i,
      mutationCache: this,
      mutationId: ++this.#e,
      options: i.defaultMutationOptions(c),
      state: r
    });
    return this.add(s), s;
  }
  add(i) {
    this.#t.add(i);
    const c = _u(i);
    if (typeof c == "string") {
      const r = this.#a.get(c);
      r ? r.push(i) : this.#a.set(c, [i]);
    }
    this.notify({ type: "added", mutation: i });
  }
  remove(i) {
    if (this.#t.delete(i)) {
      const c = _u(i);
      if (typeof c == "string") {
        const r = this.#a.get(c);
        if (r)
          if (r.length > 1) {
            const s = r.indexOf(i);
            s !== -1 && r.splice(s, 1);
          } else r[0] === i && this.#a.delete(c);
      }
    }
    this.notify({ type: "removed", mutation: i });
  }
  canRun(i) {
    const c = _u(i);
    if (typeof c == "string") {
      const s = this.#a.get(c)?.find(
        (p) => p.state.status === "pending"
      );
      return !s || s === i;
    } else
      return !0;
  }
  runNext(i) {
    const c = _u(i);
    return typeof c == "string" ? this.#a.get(c)?.find((s) => s !== i && s.state.isPaused)?.continue() ?? Promise.resolve() : Promise.resolve();
  }
  clear() {
    oe.batch(() => {
      this.#t.forEach((i) => {
        this.notify({ type: "removed", mutation: i });
      }), this.#t.clear(), this.#a.clear();
    });
  }
  getAll() {
    return Array.from(this.#t);
  }
  find(i) {
    const c = { exact: !0, ...i };
    return this.getAll().find(
      (r) => Ld(c, r)
    );
  }
  findAll(i = {}) {
    return this.getAll().filter((c) => Ld(i, c));
  }
  notify(i) {
    oe.batch(() => {
      this.listeners.forEach((c) => {
        c(i);
      });
    });
  }
  resumePausedMutations() {
    const i = this.getAll().filter((c) => c.state.isPaused);
    return oe.batch(
      () => Promise.all(
        i.map((c) => c.continue().catch(ke))
      )
    );
  }
};
function _u(i) {
  return i.options.scope?.id;
}
var Ny = class extends Bu {
  constructor(i = {}) {
    super(), this.config = i, this.#t = /* @__PURE__ */ new Map();
  }
  #t;
  build(i, c, r) {
    const s = c.queryKey, p = c.queryHash ?? ws(s, c);
    let g = this.get(p);
    return g || (g = new wy({
      client: i,
      queryKey: s,
      queryHash: p,
      options: i.defaultQueryOptions(c),
      state: r,
      defaultOptions: i.getQueryDefaults(s)
    }), this.add(g)), g;
  }
  add(i) {
    this.#t.has(i.queryHash) || (this.#t.set(i.queryHash, i), this.notify({
      type: "added",
      query: i
    }));
  }
  remove(i) {
    const c = this.#t.get(i.queryHash);
    c && (i.destroy(), c === i && this.#t.delete(i.queryHash), this.notify({ type: "removed", query: i }));
  }
  clear() {
    oe.batch(() => {
      this.getAll().forEach((i) => {
        this.remove(i);
      });
    });
  }
  get(i) {
    return this.#t.get(i);
  }
  getAll() {
    return [...this.#t.values()];
  }
  find(i) {
    const c = { exact: !0, ...i };
    return this.getAll().find(
      (r) => Bd(c, r)
    );
  }
  findAll(i = {}) {
    const c = this.getAll();
    return Object.keys(i).length > 0 ? c.filter((r) => Bd(i, r)) : c;
  }
  notify(i) {
    oe.batch(() => {
      this.listeners.forEach((c) => {
        c(i);
      });
    });
  }
  onFocus() {
    oe.batch(() => {
      this.getAll().forEach((i) => {
        i.onFocus();
      });
    });
  }
  onOnline() {
    oe.batch(() => {
      this.getAll().forEach((i) => {
        i.onOnline();
      });
    });
  }
}, Uy = class {
  #t;
  #a;
  #e;
  #l;
  #n;
  #i;
  #u;
  #o;
  constructor(i = {}) {
    this.#t = i.queryCache || new Ny(), this.#a = i.mutationCache || new Ry(), this.#e = i.defaultOptions || {}, this.#l = /* @__PURE__ */ new Map(), this.#n = /* @__PURE__ */ new Map(), this.#i = 0;
  }
  mount() {
    this.#i++, this.#i === 1 && (this.#u = bm.subscribe(async (i) => {
      i && (await this.resumePausedMutations(), this.#t.onFocus());
    }), this.#o = Ru.subscribe(async (i) => {
      i && (await this.resumePausedMutations(), this.#t.onOnline());
    }));
  }
  unmount() {
    this.#i--, this.#i === 0 && (this.#u?.(), this.#u = void 0, this.#o?.(), this.#o = void 0);
  }
  isFetching(i) {
    return this.#t.findAll({ ...i, fetchStatus: "fetching" }).length;
  }
  isMutating(i) {
    return this.#a.findAll({ ...i, status: "pending" }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   */
  getQueryData(i) {
    const c = this.defaultQueryOptions({ queryKey: i });
    return this.#t.get(c.queryHash)?.state.data;
  }
  ensureQueryData(i) {
    const c = this.defaultQueryOptions(i), r = this.#t.build(this, c), s = r.state.data;
    return s === void 0 ? this.fetchQuery(i) : (i.revalidateIfStale && r.isStaleByTime(hs(c.staleTime, r)) && this.prefetchQuery(c), Promise.resolve(s));
  }
  getQueriesData(i) {
    return this.#t.findAll(i).map(({ queryKey: c, state: r }) => {
      const s = r.data;
      return [c, s];
    });
  }
  setQueryData(i, c, r) {
    const s = this.defaultQueryOptions({ queryKey: i }), g = this.#t.get(
      s.queryHash
    )?.state.data, A = dy(c, g);
    if (A !== void 0)
      return this.#t.build(this, s).setData(A, { ...r, manual: !0 });
  }
  setQueriesData(i, c, r) {
    return oe.batch(
      () => this.#t.findAll(i).map(({ queryKey: s }) => [
        s,
        this.setQueryData(s, c, r)
      ])
    );
  }
  getQueryState(i) {
    const c = this.defaultQueryOptions({ queryKey: i });
    return this.#t.get(
      c.queryHash
    )?.state;
  }
  removeQueries(i) {
    const c = this.#t;
    oe.batch(() => {
      c.findAll(i).forEach((r) => {
        c.remove(r);
      });
    });
  }
  resetQueries(i, c) {
    const r = this.#t;
    return oe.batch(() => (r.findAll(i).forEach((s) => {
      s.reset();
    }), this.refetchQueries(
      {
        type: "active",
        ...i
      },
      c
    )));
  }
  cancelQueries(i, c = {}) {
    const r = { revert: !0, ...c }, s = oe.batch(
      () => this.#t.findAll(i).map((p) => p.cancel(r))
    );
    return Promise.all(s).then(ke).catch(ke);
  }
  invalidateQueries(i, c = {}) {
    return oe.batch(() => (this.#t.findAll(i).forEach((r) => {
      r.invalidate();
    }), i?.refetchType === "none" ? Promise.resolve() : this.refetchQueries(
      {
        ...i,
        type: i?.refetchType ?? i?.type ?? "active"
      },
      c
    )));
  }
  refetchQueries(i, c = {}) {
    const r = {
      ...c,
      cancelRefetch: c.cancelRefetch ?? !0
    }, s = oe.batch(
      () => this.#t.findAll(i).filter((p) => !p.isDisabled() && !p.isStatic()).map((p) => {
        let g = p.fetch(void 0, r);
        return r.throwOnError || (g = g.catch(ke)), p.state.fetchStatus === "paused" ? Promise.resolve() : g;
      })
    );
    return Promise.all(s).then(ke);
  }
  fetchQuery(i) {
    const c = this.defaultQueryOptions(i);
    c.retry === void 0 && (c.retry = !1);
    const r = this.#t.build(this, c);
    return r.isStaleByTime(
      hs(c.staleTime, r)
    ) ? r.fetch(c) : Promise.resolve(r.state.data);
  }
  prefetchQuery(i) {
    return this.fetchQuery(i).then(ke).catch(ke);
  }
  fetchInfiniteQuery(i) {
    return i.behavior = Xd(i.pages), this.fetchQuery(i);
  }
  prefetchInfiniteQuery(i) {
    return this.fetchInfiniteQuery(i).then(ke).catch(ke);
  }
  ensureInfiniteQueryData(i) {
    return i.behavior = Xd(i.pages), this.ensureQueryData(i);
  }
  resumePausedMutations() {
    return Ru.isOnline() ? this.#a.resumePausedMutations() : Promise.resolve();
  }
  getQueryCache() {
    return this.#t;
  }
  getMutationCache() {
    return this.#a;
  }
  getDefaultOptions() {
    return this.#e;
  }
  setDefaultOptions(i) {
    this.#e = i;
  }
  setQueryDefaults(i, c) {
    this.#l.set(si(i), {
      queryKey: i,
      defaultOptions: c
    });
  }
  getQueryDefaults(i) {
    const c = [...this.#l.values()], r = {};
    return c.forEach((s) => {
      ri(i, s.queryKey) && Object.assign(r, s.defaultOptions);
    }), r;
  }
  setMutationDefaults(i, c) {
    this.#n.set(si(i), {
      mutationKey: i,
      defaultOptions: c
    });
  }
  getMutationDefaults(i) {
    const c = [...this.#n.values()], r = {};
    return c.forEach((s) => {
      ri(i, s.mutationKey) && Object.assign(r, s.defaultOptions);
    }), r;
  }
  defaultQueryOptions(i) {
    if (i._defaulted)
      return i;
    const c = {
      ...this.#e.queries,
      ...this.getQueryDefaults(i.queryKey),
      ...i,
      _defaulted: !0
    };
    return c.queryHash || (c.queryHash = ws(
      c.queryKey,
      c
    )), c.refetchOnReconnect === void 0 && (c.refetchOnReconnect = c.networkMode !== "always"), c.throwOnError === void 0 && (c.throwOnError = !!c.suspense), !c.networkMode && c.persister && (c.networkMode = "offlineFirst"), c.queryFn === _s && (c.enabled = !1), c;
  }
  defaultMutationOptions(i) {
    return i?._defaulted ? i : {
      ...this.#e.mutations,
      ...i?.mutationKey && this.getMutationDefaults(i.mutationKey),
      ...i,
      _defaulted: !0
    };
  }
  clear() {
    this.#t.clear(), this.#a.clear();
  }
}, I = Ds();
const qy = /* @__PURE__ */ Os(I);
var Hy = I.createContext(
  void 0
), By = ({
  client: i,
  children: c
}) => (I.useEffect(() => (i.mount(), () => {
  i.unmount();
}), [i]), /* @__PURE__ */ q.jsx(Hy.Provider, { value: i, children: c })), cs = { exports: {} }, os, Vd;
function Ly() {
  if (Vd) return os;
  Vd = 1;
  var i = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
  return os = i, os;
}
var ss, Kd;
function Gy() {
  if (Kd) return ss;
  Kd = 1;
  var i = /* @__PURE__ */ Ly();
  function c() {
  }
  function r() {
  }
  return r.resetWarningCache = c, ss = function() {
    function s(A, S, T, v, C, M) {
      if (M !== i) {
        var Q = new Error(
          "Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types"
        );
        throw Q.name = "Invariant Violation", Q;
      }
    }
    s.isRequired = s;
    function p() {
      return s;
    }
    var g = {
      array: s,
      bigint: s,
      bool: s,
      func: s,
      number: s,
      object: s,
      string: s,
      symbol: s,
      any: s,
      arrayOf: p,
      element: s,
      elementType: s,
      instanceOf: p,
      node: s,
      objectOf: p,
      oneOf: p,
      oneOfType: p,
      shape: p,
      exact: p,
      checkPropTypes: r,
      resetWarningCache: c
    };
    return g.PropTypes = g, g;
  }, ss;
}
var Jd;
function Qy() {
  return Jd || (Jd = 1, cs.exports = /* @__PURE__ */ Gy()()), cs.exports;
}
var Yy = /* @__PURE__ */ Qy();
const Tt = /* @__PURE__ */ Os(Yy);
function vn(i, c, r, s) {
  function p(g) {
    return g instanceof r ? g : new r(function(A) {
      A(g);
    });
  }
  return new (r || (r = Promise))(function(g, A) {
    function S(C) {
      try {
        v(s.next(C));
      } catch (M) {
        A(M);
      }
    }
    function T(C) {
      try {
        v(s.throw(C));
      } catch (M) {
        A(M);
      }
    }
    function v(C) {
      C.done ? g(C.value) : p(C.value).then(S, T);
    }
    v((s = s.apply(i, c || [])).next());
  });
}
const ky = /* @__PURE__ */ new Map([
  // https://github.com/guzzle/psr7/blob/2d9260799e713f1c475d3c5fdc3d6561ff7441b2/src/MimeType.php
  ["1km", "application/vnd.1000minds.decision-model+xml"],
  ["3dml", "text/vnd.in3d.3dml"],
  ["3ds", "image/x-3ds"],
  ["3g2", "video/3gpp2"],
  ["3gp", "video/3gp"],
  ["3gpp", "video/3gpp"],
  ["3mf", "model/3mf"],
  ["7z", "application/x-7z-compressed"],
  ["7zip", "application/x-7z-compressed"],
  ["123", "application/vnd.lotus-1-2-3"],
  ["aab", "application/x-authorware-bin"],
  ["aac", "audio/x-acc"],
  ["aam", "application/x-authorware-map"],
  ["aas", "application/x-authorware-seg"],
  ["abw", "application/x-abiword"],
  ["ac", "application/vnd.nokia.n-gage.ac+xml"],
  ["ac3", "audio/ac3"],
  ["acc", "application/vnd.americandynamics.acc"],
  ["ace", "application/x-ace-compressed"],
  ["acu", "application/vnd.acucobol"],
  ["acutc", "application/vnd.acucorp"],
  ["adp", "audio/adpcm"],
  ["aep", "application/vnd.audiograph"],
  ["afm", "application/x-font-type1"],
  ["afp", "application/vnd.ibm.modcap"],
  ["ahead", "application/vnd.ahead.space"],
  ["ai", "application/pdf"],
  ["aif", "audio/x-aiff"],
  ["aifc", "audio/x-aiff"],
  ["aiff", "audio/x-aiff"],
  ["air", "application/vnd.adobe.air-application-installer-package+zip"],
  ["ait", "application/vnd.dvb.ait"],
  ["ami", "application/vnd.amiga.ami"],
  ["amr", "audio/amr"],
  ["apk", "application/vnd.android.package-archive"],
  ["apng", "image/apng"],
  ["appcache", "text/cache-manifest"],
  ["application", "application/x-ms-application"],
  ["apr", "application/vnd.lotus-approach"],
  ["arc", "application/x-freearc"],
  ["arj", "application/x-arj"],
  ["asc", "application/pgp-signature"],
  ["asf", "video/x-ms-asf"],
  ["asm", "text/x-asm"],
  ["aso", "application/vnd.accpac.simply.aso"],
  ["asx", "video/x-ms-asf"],
  ["atc", "application/vnd.acucorp"],
  ["atom", "application/atom+xml"],
  ["atomcat", "application/atomcat+xml"],
  ["atomdeleted", "application/atomdeleted+xml"],
  ["atomsvc", "application/atomsvc+xml"],
  ["atx", "application/vnd.antix.game-component"],
  ["au", "audio/x-au"],
  ["avi", "video/x-msvideo"],
  ["avif", "image/avif"],
  ["aw", "application/applixware"],
  ["azf", "application/vnd.airzip.filesecure.azf"],
  ["azs", "application/vnd.airzip.filesecure.azs"],
  ["azv", "image/vnd.airzip.accelerator.azv"],
  ["azw", "application/vnd.amazon.ebook"],
  ["b16", "image/vnd.pco.b16"],
  ["bat", "application/x-msdownload"],
  ["bcpio", "application/x-bcpio"],
  ["bdf", "application/x-font-bdf"],
  ["bdm", "application/vnd.syncml.dm+wbxml"],
  ["bdoc", "application/x-bdoc"],
  ["bed", "application/vnd.realvnc.bed"],
  ["bh2", "application/vnd.fujitsu.oasysprs"],
  ["bin", "application/octet-stream"],
  ["blb", "application/x-blorb"],
  ["blorb", "application/x-blorb"],
  ["bmi", "application/vnd.bmi"],
  ["bmml", "application/vnd.balsamiq.bmml+xml"],
  ["bmp", "image/bmp"],
  ["book", "application/vnd.framemaker"],
  ["box", "application/vnd.previewsystems.box"],
  ["boz", "application/x-bzip2"],
  ["bpk", "application/octet-stream"],
  ["bpmn", "application/octet-stream"],
  ["bsp", "model/vnd.valve.source.compiled-map"],
  ["btif", "image/prs.btif"],
  ["buffer", "application/octet-stream"],
  ["bz", "application/x-bzip"],
  ["bz2", "application/x-bzip2"],
  ["c", "text/x-c"],
  ["c4d", "application/vnd.clonk.c4group"],
  ["c4f", "application/vnd.clonk.c4group"],
  ["c4g", "application/vnd.clonk.c4group"],
  ["c4p", "application/vnd.clonk.c4group"],
  ["c4u", "application/vnd.clonk.c4group"],
  ["c11amc", "application/vnd.cluetrust.cartomobile-config"],
  ["c11amz", "application/vnd.cluetrust.cartomobile-config-pkg"],
  ["cab", "application/vnd.ms-cab-compressed"],
  ["caf", "audio/x-caf"],
  ["cap", "application/vnd.tcpdump.pcap"],
  ["car", "application/vnd.curl.car"],
  ["cat", "application/vnd.ms-pki.seccat"],
  ["cb7", "application/x-cbr"],
  ["cba", "application/x-cbr"],
  ["cbr", "application/x-cbr"],
  ["cbt", "application/x-cbr"],
  ["cbz", "application/x-cbr"],
  ["cc", "text/x-c"],
  ["cco", "application/x-cocoa"],
  ["cct", "application/x-director"],
  ["ccxml", "application/ccxml+xml"],
  ["cdbcmsg", "application/vnd.contact.cmsg"],
  ["cda", "application/x-cdf"],
  ["cdf", "application/x-netcdf"],
  ["cdfx", "application/cdfx+xml"],
  ["cdkey", "application/vnd.mediastation.cdkey"],
  ["cdmia", "application/cdmi-capability"],
  ["cdmic", "application/cdmi-container"],
  ["cdmid", "application/cdmi-domain"],
  ["cdmio", "application/cdmi-object"],
  ["cdmiq", "application/cdmi-queue"],
  ["cdr", "application/cdr"],
  ["cdx", "chemical/x-cdx"],
  ["cdxml", "application/vnd.chemdraw+xml"],
  ["cdy", "application/vnd.cinderella"],
  ["cer", "application/pkix-cert"],
  ["cfs", "application/x-cfs-compressed"],
  ["cgm", "image/cgm"],
  ["chat", "application/x-chat"],
  ["chm", "application/vnd.ms-htmlhelp"],
  ["chrt", "application/vnd.kde.kchart"],
  ["cif", "chemical/x-cif"],
  ["cii", "application/vnd.anser-web-certificate-issue-initiation"],
  ["cil", "application/vnd.ms-artgalry"],
  ["cjs", "application/node"],
  ["cla", "application/vnd.claymore"],
  ["class", "application/octet-stream"],
  ["clkk", "application/vnd.crick.clicker.keyboard"],
  ["clkp", "application/vnd.crick.clicker.palette"],
  ["clkt", "application/vnd.crick.clicker.template"],
  ["clkw", "application/vnd.crick.clicker.wordbank"],
  ["clkx", "application/vnd.crick.clicker"],
  ["clp", "application/x-msclip"],
  ["cmc", "application/vnd.cosmocaller"],
  ["cmdf", "chemical/x-cmdf"],
  ["cml", "chemical/x-cml"],
  ["cmp", "application/vnd.yellowriver-custom-menu"],
  ["cmx", "image/x-cmx"],
  ["cod", "application/vnd.rim.cod"],
  ["coffee", "text/coffeescript"],
  ["com", "application/x-msdownload"],
  ["conf", "text/plain"],
  ["cpio", "application/x-cpio"],
  ["cpp", "text/x-c"],
  ["cpt", "application/mac-compactpro"],
  ["crd", "application/x-mscardfile"],
  ["crl", "application/pkix-crl"],
  ["crt", "application/x-x509-ca-cert"],
  ["crx", "application/x-chrome-extension"],
  ["cryptonote", "application/vnd.rig.cryptonote"],
  ["csh", "application/x-csh"],
  ["csl", "application/vnd.citationstyles.style+xml"],
  ["csml", "chemical/x-csml"],
  ["csp", "application/vnd.commonspace"],
  ["csr", "application/octet-stream"],
  ["css", "text/css"],
  ["cst", "application/x-director"],
  ["csv", "text/csv"],
  ["cu", "application/cu-seeme"],
  ["curl", "text/vnd.curl"],
  ["cww", "application/prs.cww"],
  ["cxt", "application/x-director"],
  ["cxx", "text/x-c"],
  ["dae", "model/vnd.collada+xml"],
  ["daf", "application/vnd.mobius.daf"],
  ["dart", "application/vnd.dart"],
  ["dataless", "application/vnd.fdsn.seed"],
  ["davmount", "application/davmount+xml"],
  ["dbf", "application/vnd.dbf"],
  ["dbk", "application/docbook+xml"],
  ["dcr", "application/x-director"],
  ["dcurl", "text/vnd.curl.dcurl"],
  ["dd2", "application/vnd.oma.dd2+xml"],
  ["ddd", "application/vnd.fujixerox.ddd"],
  ["ddf", "application/vnd.syncml.dmddf+xml"],
  ["dds", "image/vnd.ms-dds"],
  ["deb", "application/x-debian-package"],
  ["def", "text/plain"],
  ["deploy", "application/octet-stream"],
  ["der", "application/x-x509-ca-cert"],
  ["dfac", "application/vnd.dreamfactory"],
  ["dgc", "application/x-dgc-compressed"],
  ["dic", "text/x-c"],
  ["dir", "application/x-director"],
  ["dis", "application/vnd.mobius.dis"],
  ["disposition-notification", "message/disposition-notification"],
  ["dist", "application/octet-stream"],
  ["distz", "application/octet-stream"],
  ["djv", "image/vnd.djvu"],
  ["djvu", "image/vnd.djvu"],
  ["dll", "application/octet-stream"],
  ["dmg", "application/x-apple-diskimage"],
  ["dmn", "application/octet-stream"],
  ["dmp", "application/vnd.tcpdump.pcap"],
  ["dms", "application/octet-stream"],
  ["dna", "application/vnd.dna"],
  ["doc", "application/msword"],
  ["docm", "application/vnd.ms-word.template.macroEnabled.12"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["dot", "application/msword"],
  ["dotm", "application/vnd.ms-word.template.macroEnabled.12"],
  ["dotx", "application/vnd.openxmlformats-officedocument.wordprocessingml.template"],
  ["dp", "application/vnd.osgi.dp"],
  ["dpg", "application/vnd.dpgraph"],
  ["dra", "audio/vnd.dra"],
  ["drle", "image/dicom-rle"],
  ["dsc", "text/prs.lines.tag"],
  ["dssc", "application/dssc+der"],
  ["dtb", "application/x-dtbook+xml"],
  ["dtd", "application/xml-dtd"],
  ["dts", "audio/vnd.dts"],
  ["dtshd", "audio/vnd.dts.hd"],
  ["dump", "application/octet-stream"],
  ["dvb", "video/vnd.dvb.file"],
  ["dvi", "application/x-dvi"],
  ["dwd", "application/atsc-dwd+xml"],
  ["dwf", "model/vnd.dwf"],
  ["dwg", "image/vnd.dwg"],
  ["dxf", "image/vnd.dxf"],
  ["dxp", "application/vnd.spotfire.dxp"],
  ["dxr", "application/x-director"],
  ["ear", "application/java-archive"],
  ["ecelp4800", "audio/vnd.nuera.ecelp4800"],
  ["ecelp7470", "audio/vnd.nuera.ecelp7470"],
  ["ecelp9600", "audio/vnd.nuera.ecelp9600"],
  ["ecma", "application/ecmascript"],
  ["edm", "application/vnd.novadigm.edm"],
  ["edx", "application/vnd.novadigm.edx"],
  ["efif", "application/vnd.picsel"],
  ["ei6", "application/vnd.pg.osasli"],
  ["elc", "application/octet-stream"],
  ["emf", "image/emf"],
  ["eml", "message/rfc822"],
  ["emma", "application/emma+xml"],
  ["emotionml", "application/emotionml+xml"],
  ["emz", "application/x-msmetafile"],
  ["eol", "audio/vnd.digital-winds"],
  ["eot", "application/vnd.ms-fontobject"],
  ["eps", "application/postscript"],
  ["epub", "application/epub+zip"],
  ["es", "application/ecmascript"],
  ["es3", "application/vnd.eszigno3+xml"],
  ["esa", "application/vnd.osgi.subsystem"],
  ["esf", "application/vnd.epson.esf"],
  ["et3", "application/vnd.eszigno3+xml"],
  ["etx", "text/x-setext"],
  ["eva", "application/x-eva"],
  ["evy", "application/x-envoy"],
  ["exe", "application/octet-stream"],
  ["exi", "application/exi"],
  ["exp", "application/express"],
  ["exr", "image/aces"],
  ["ext", "application/vnd.novadigm.ext"],
  ["ez", "application/andrew-inset"],
  ["ez2", "application/vnd.ezpix-album"],
  ["ez3", "application/vnd.ezpix-package"],
  ["f", "text/x-fortran"],
  ["f4v", "video/mp4"],
  ["f77", "text/x-fortran"],
  ["f90", "text/x-fortran"],
  ["fbs", "image/vnd.fastbidsheet"],
  ["fcdt", "application/vnd.adobe.formscentral.fcdt"],
  ["fcs", "application/vnd.isac.fcs"],
  ["fdf", "application/vnd.fdf"],
  ["fdt", "application/fdt+xml"],
  ["fe_launch", "application/vnd.denovo.fcselayout-link"],
  ["fg5", "application/vnd.fujitsu.oasysgp"],
  ["fgd", "application/x-director"],
  ["fh", "image/x-freehand"],
  ["fh4", "image/x-freehand"],
  ["fh5", "image/x-freehand"],
  ["fh7", "image/x-freehand"],
  ["fhc", "image/x-freehand"],
  ["fig", "application/x-xfig"],
  ["fits", "image/fits"],
  ["flac", "audio/x-flac"],
  ["fli", "video/x-fli"],
  ["flo", "application/vnd.micrografx.flo"],
  ["flv", "video/x-flv"],
  ["flw", "application/vnd.kde.kivio"],
  ["flx", "text/vnd.fmi.flexstor"],
  ["fly", "text/vnd.fly"],
  ["fm", "application/vnd.framemaker"],
  ["fnc", "application/vnd.frogans.fnc"],
  ["fo", "application/vnd.software602.filler.form+xml"],
  ["for", "text/x-fortran"],
  ["fpx", "image/vnd.fpx"],
  ["frame", "application/vnd.framemaker"],
  ["fsc", "application/vnd.fsc.weblaunch"],
  ["fst", "image/vnd.fst"],
  ["ftc", "application/vnd.fluxtime.clip"],
  ["fti", "application/vnd.anser-web-funds-transfer-initiation"],
  ["fvt", "video/vnd.fvt"],
  ["fxp", "application/vnd.adobe.fxp"],
  ["fxpl", "application/vnd.adobe.fxp"],
  ["fzs", "application/vnd.fuzzysheet"],
  ["g2w", "application/vnd.geoplan"],
  ["g3", "image/g3fax"],
  ["g3w", "application/vnd.geospace"],
  ["gac", "application/vnd.groove-account"],
  ["gam", "application/x-tads"],
  ["gbr", "application/rpki-ghostbusters"],
  ["gca", "application/x-gca-compressed"],
  ["gdl", "model/vnd.gdl"],
  ["gdoc", "application/vnd.google-apps.document"],
  ["geo", "application/vnd.dynageo"],
  ["geojson", "application/geo+json"],
  ["gex", "application/vnd.geometry-explorer"],
  ["ggb", "application/vnd.geogebra.file"],
  ["ggt", "application/vnd.geogebra.tool"],
  ["ghf", "application/vnd.groove-help"],
  ["gif", "image/gif"],
  ["gim", "application/vnd.groove-identity-message"],
  ["glb", "model/gltf-binary"],
  ["gltf", "model/gltf+json"],
  ["gml", "application/gml+xml"],
  ["gmx", "application/vnd.gmx"],
  ["gnumeric", "application/x-gnumeric"],
  ["gpg", "application/gpg-keys"],
  ["gph", "application/vnd.flographit"],
  ["gpx", "application/gpx+xml"],
  ["gqf", "application/vnd.grafeq"],
  ["gqs", "application/vnd.grafeq"],
  ["gram", "application/srgs"],
  ["gramps", "application/x-gramps-xml"],
  ["gre", "application/vnd.geometry-explorer"],
  ["grv", "application/vnd.groove-injector"],
  ["grxml", "application/srgs+xml"],
  ["gsf", "application/x-font-ghostscript"],
  ["gsheet", "application/vnd.google-apps.spreadsheet"],
  ["gslides", "application/vnd.google-apps.presentation"],
  ["gtar", "application/x-gtar"],
  ["gtm", "application/vnd.groove-tool-message"],
  ["gtw", "model/vnd.gtw"],
  ["gv", "text/vnd.graphviz"],
  ["gxf", "application/gxf"],
  ["gxt", "application/vnd.geonext"],
  ["gz", "application/gzip"],
  ["gzip", "application/gzip"],
  ["h", "text/x-c"],
  ["h261", "video/h261"],
  ["h263", "video/h263"],
  ["h264", "video/h264"],
  ["hal", "application/vnd.hal+xml"],
  ["hbci", "application/vnd.hbci"],
  ["hbs", "text/x-handlebars-template"],
  ["hdd", "application/x-virtualbox-hdd"],
  ["hdf", "application/x-hdf"],
  ["heic", "image/heic"],
  ["heics", "image/heic-sequence"],
  ["heif", "image/heif"],
  ["heifs", "image/heif-sequence"],
  ["hej2", "image/hej2k"],
  ["held", "application/atsc-held+xml"],
  ["hh", "text/x-c"],
  ["hjson", "application/hjson"],
  ["hlp", "application/winhlp"],
  ["hpgl", "application/vnd.hp-hpgl"],
  ["hpid", "application/vnd.hp-hpid"],
  ["hps", "application/vnd.hp-hps"],
  ["hqx", "application/mac-binhex40"],
  ["hsj2", "image/hsj2"],
  ["htc", "text/x-component"],
  ["htke", "application/vnd.kenameaapp"],
  ["htm", "text/html"],
  ["html", "text/html"],
  ["hvd", "application/vnd.yamaha.hv-dic"],
  ["hvp", "application/vnd.yamaha.hv-voice"],
  ["hvs", "application/vnd.yamaha.hv-script"],
  ["i2g", "application/vnd.intergeo"],
  ["icc", "application/vnd.iccprofile"],
  ["ice", "x-conference/x-cooltalk"],
  ["icm", "application/vnd.iccprofile"],
  ["ico", "image/x-icon"],
  ["ics", "text/calendar"],
  ["ief", "image/ief"],
  ["ifb", "text/calendar"],
  ["ifm", "application/vnd.shana.informed.formdata"],
  ["iges", "model/iges"],
  ["igl", "application/vnd.igloader"],
  ["igm", "application/vnd.insors.igm"],
  ["igs", "model/iges"],
  ["igx", "application/vnd.micrografx.igx"],
  ["iif", "application/vnd.shana.informed.interchange"],
  ["img", "application/octet-stream"],
  ["imp", "application/vnd.accpac.simply.imp"],
  ["ims", "application/vnd.ms-ims"],
  ["in", "text/plain"],
  ["ini", "text/plain"],
  ["ink", "application/inkml+xml"],
  ["inkml", "application/inkml+xml"],
  ["install", "application/x-install-instructions"],
  ["iota", "application/vnd.astraea-software.iota"],
  ["ipfix", "application/ipfix"],
  ["ipk", "application/vnd.shana.informed.package"],
  ["irm", "application/vnd.ibm.rights-management"],
  ["irp", "application/vnd.irepository.package+xml"],
  ["iso", "application/x-iso9660-image"],
  ["itp", "application/vnd.shana.informed.formtemplate"],
  ["its", "application/its+xml"],
  ["ivp", "application/vnd.immervision-ivp"],
  ["ivu", "application/vnd.immervision-ivu"],
  ["jad", "text/vnd.sun.j2me.app-descriptor"],
  ["jade", "text/jade"],
  ["jam", "application/vnd.jam"],
  ["jar", "application/java-archive"],
  ["jardiff", "application/x-java-archive-diff"],
  ["java", "text/x-java-source"],
  ["jhc", "image/jphc"],
  ["jisp", "application/vnd.jisp"],
  ["jls", "image/jls"],
  ["jlt", "application/vnd.hp-jlyt"],
  ["jng", "image/x-jng"],
  ["jnlp", "application/x-java-jnlp-file"],
  ["joda", "application/vnd.joost.joda-archive"],
  ["jp2", "image/jp2"],
  ["jpe", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["jpf", "image/jpx"],
  ["jpg", "image/jpeg"],
  ["jpg2", "image/jp2"],
  ["jpgm", "video/jpm"],
  ["jpgv", "video/jpeg"],
  ["jph", "image/jph"],
  ["jpm", "video/jpm"],
  ["jpx", "image/jpx"],
  ["js", "application/javascript"],
  ["json", "application/json"],
  ["json5", "application/json5"],
  ["jsonld", "application/ld+json"],
  // https://jsonlines.org/
  ["jsonl", "application/jsonl"],
  ["jsonml", "application/jsonml+json"],
  ["jsx", "text/jsx"],
  ["jxr", "image/jxr"],
  ["jxra", "image/jxra"],
  ["jxrs", "image/jxrs"],
  ["jxs", "image/jxs"],
  ["jxsc", "image/jxsc"],
  ["jxsi", "image/jxsi"],
  ["jxss", "image/jxss"],
  ["kar", "audio/midi"],
  ["karbon", "application/vnd.kde.karbon"],
  ["kdb", "application/octet-stream"],
  ["kdbx", "application/x-keepass2"],
  ["key", "application/x-iwork-keynote-sffkey"],
  ["kfo", "application/vnd.kde.kformula"],
  ["kia", "application/vnd.kidspiration"],
  ["kml", "application/vnd.google-earth.kml+xml"],
  ["kmz", "application/vnd.google-earth.kmz"],
  ["kne", "application/vnd.kinar"],
  ["knp", "application/vnd.kinar"],
  ["kon", "application/vnd.kde.kontour"],
  ["kpr", "application/vnd.kde.kpresenter"],
  ["kpt", "application/vnd.kde.kpresenter"],
  ["kpxx", "application/vnd.ds-keypoint"],
  ["ksp", "application/vnd.kde.kspread"],
  ["ktr", "application/vnd.kahootz"],
  ["ktx", "image/ktx"],
  ["ktx2", "image/ktx2"],
  ["ktz", "application/vnd.kahootz"],
  ["kwd", "application/vnd.kde.kword"],
  ["kwt", "application/vnd.kde.kword"],
  ["lasxml", "application/vnd.las.las+xml"],
  ["latex", "application/x-latex"],
  ["lbd", "application/vnd.llamagraphics.life-balance.desktop"],
  ["lbe", "application/vnd.llamagraphics.life-balance.exchange+xml"],
  ["les", "application/vnd.hhe.lesson-player"],
  ["less", "text/less"],
  ["lgr", "application/lgr+xml"],
  ["lha", "application/octet-stream"],
  ["link66", "application/vnd.route66.link66+xml"],
  ["list", "text/plain"],
  ["list3820", "application/vnd.ibm.modcap"],
  ["listafp", "application/vnd.ibm.modcap"],
  ["litcoffee", "text/coffeescript"],
  ["lnk", "application/x-ms-shortcut"],
  ["log", "text/plain"],
  ["lostxml", "application/lost+xml"],
  ["lrf", "application/octet-stream"],
  ["lrm", "application/vnd.ms-lrm"],
  ["ltf", "application/vnd.frogans.ltf"],
  ["lua", "text/x-lua"],
  ["luac", "application/x-lua-bytecode"],
  ["lvp", "audio/vnd.lucent.voice"],
  ["lwp", "application/vnd.lotus-wordpro"],
  ["lzh", "application/octet-stream"],
  ["m1v", "video/mpeg"],
  ["m2a", "audio/mpeg"],
  ["m2v", "video/mpeg"],
  ["m3a", "audio/mpeg"],
  ["m3u", "text/plain"],
  ["m3u8", "application/vnd.apple.mpegurl"],
  ["m4a", "audio/x-m4a"],
  ["m4p", "application/mp4"],
  ["m4s", "video/iso.segment"],
  ["m4u", "application/vnd.mpegurl"],
  ["m4v", "video/x-m4v"],
  ["m13", "application/x-msmediaview"],
  ["m14", "application/x-msmediaview"],
  ["m21", "application/mp21"],
  ["ma", "application/mathematica"],
  ["mads", "application/mads+xml"],
  ["maei", "application/mmt-aei+xml"],
  ["mag", "application/vnd.ecowin.chart"],
  ["maker", "application/vnd.framemaker"],
  ["man", "text/troff"],
  ["manifest", "text/cache-manifest"],
  ["map", "application/json"],
  ["mar", "application/octet-stream"],
  ["markdown", "text/markdown"],
  ["mathml", "application/mathml+xml"],
  ["mb", "application/mathematica"],
  ["mbk", "application/vnd.mobius.mbk"],
  ["mbox", "application/mbox"],
  ["mc1", "application/vnd.medcalcdata"],
  ["mcd", "application/vnd.mcd"],
  ["mcurl", "text/vnd.curl.mcurl"],
  ["md", "text/markdown"],
  ["mdb", "application/x-msaccess"],
  ["mdi", "image/vnd.ms-modi"],
  ["mdx", "text/mdx"],
  ["me", "text/troff"],
  ["mesh", "model/mesh"],
  ["meta4", "application/metalink4+xml"],
  ["metalink", "application/metalink+xml"],
  ["mets", "application/mets+xml"],
  ["mfm", "application/vnd.mfmp"],
  ["mft", "application/rpki-manifest"],
  ["mgp", "application/vnd.osgeo.mapguide.package"],
  ["mgz", "application/vnd.proteus.magazine"],
  ["mid", "audio/midi"],
  ["midi", "audio/midi"],
  ["mie", "application/x-mie"],
  ["mif", "application/vnd.mif"],
  ["mime", "message/rfc822"],
  ["mj2", "video/mj2"],
  ["mjp2", "video/mj2"],
  ["mjs", "application/javascript"],
  ["mk3d", "video/x-matroska"],
  ["mka", "audio/x-matroska"],
  ["mkd", "text/x-markdown"],
  ["mks", "video/x-matroska"],
  ["mkv", "video/x-matroska"],
  ["mlp", "application/vnd.dolby.mlp"],
  ["mmd", "application/vnd.chipnuts.karaoke-mmd"],
  ["mmf", "application/vnd.smaf"],
  ["mml", "text/mathml"],
  ["mmr", "image/vnd.fujixerox.edmics-mmr"],
  ["mng", "video/x-mng"],
  ["mny", "application/x-msmoney"],
  ["mobi", "application/x-mobipocket-ebook"],
  ["mods", "application/mods+xml"],
  ["mov", "video/quicktime"],
  ["movie", "video/x-sgi-movie"],
  ["mp2", "audio/mpeg"],
  ["mp2a", "audio/mpeg"],
  ["mp3", "audio/mpeg"],
  ["mp4", "video/mp4"],
  ["mp4a", "audio/mp4"],
  ["mp4s", "application/mp4"],
  ["mp4v", "video/mp4"],
  ["mp21", "application/mp21"],
  ["mpc", "application/vnd.mophun.certificate"],
  ["mpd", "application/dash+xml"],
  ["mpe", "video/mpeg"],
  ["mpeg", "video/mpeg"],
  ["mpg", "video/mpeg"],
  ["mpg4", "video/mp4"],
  ["mpga", "audio/mpeg"],
  ["mpkg", "application/vnd.apple.installer+xml"],
  ["mpm", "application/vnd.blueice.multipass"],
  ["mpn", "application/vnd.mophun.application"],
  ["mpp", "application/vnd.ms-project"],
  ["mpt", "application/vnd.ms-project"],
  ["mpy", "application/vnd.ibm.minipay"],
  ["mqy", "application/vnd.mobius.mqy"],
  ["mrc", "application/marc"],
  ["mrcx", "application/marcxml+xml"],
  ["ms", "text/troff"],
  ["mscml", "application/mediaservercontrol+xml"],
  ["mseed", "application/vnd.fdsn.mseed"],
  ["mseq", "application/vnd.mseq"],
  ["msf", "application/vnd.epson.msf"],
  ["msg", "application/vnd.ms-outlook"],
  ["msh", "model/mesh"],
  ["msi", "application/x-msdownload"],
  ["msl", "application/vnd.mobius.msl"],
  ["msm", "application/octet-stream"],
  ["msp", "application/octet-stream"],
  ["msty", "application/vnd.muvee.style"],
  ["mtl", "model/mtl"],
  ["mts", "model/vnd.mts"],
  ["mus", "application/vnd.musician"],
  ["musd", "application/mmt-usd+xml"],
  ["musicxml", "application/vnd.recordare.musicxml+xml"],
  ["mvb", "application/x-msmediaview"],
  ["mvt", "application/vnd.mapbox-vector-tile"],
  ["mwf", "application/vnd.mfer"],
  ["mxf", "application/mxf"],
  ["mxl", "application/vnd.recordare.musicxml"],
  ["mxmf", "audio/mobile-xmf"],
  ["mxml", "application/xv+xml"],
  ["mxs", "application/vnd.triscape.mxs"],
  ["mxu", "video/vnd.mpegurl"],
  ["n-gage", "application/vnd.nokia.n-gage.symbian.install"],
  ["n3", "text/n3"],
  ["nb", "application/mathematica"],
  ["nbp", "application/vnd.wolfram.player"],
  ["nc", "application/x-netcdf"],
  ["ncx", "application/x-dtbncx+xml"],
  ["nfo", "text/x-nfo"],
  ["ngdat", "application/vnd.nokia.n-gage.data"],
  ["nitf", "application/vnd.nitf"],
  ["nlu", "application/vnd.neurolanguage.nlu"],
  ["nml", "application/vnd.enliven"],
  ["nnd", "application/vnd.noblenet-directory"],
  ["nns", "application/vnd.noblenet-sealer"],
  ["nnw", "application/vnd.noblenet-web"],
  ["npx", "image/vnd.net-fpx"],
  ["nq", "application/n-quads"],
  ["nsc", "application/x-conference"],
  ["nsf", "application/vnd.lotus-notes"],
  ["nt", "application/n-triples"],
  ["ntf", "application/vnd.nitf"],
  ["numbers", "application/x-iwork-numbers-sffnumbers"],
  ["nzb", "application/x-nzb"],
  ["oa2", "application/vnd.fujitsu.oasys2"],
  ["oa3", "application/vnd.fujitsu.oasys3"],
  ["oas", "application/vnd.fujitsu.oasys"],
  ["obd", "application/x-msbinder"],
  ["obgx", "application/vnd.openblox.game+xml"],
  ["obj", "model/obj"],
  ["oda", "application/oda"],
  ["odb", "application/vnd.oasis.opendocument.database"],
  ["odc", "application/vnd.oasis.opendocument.chart"],
  ["odf", "application/vnd.oasis.opendocument.formula"],
  ["odft", "application/vnd.oasis.opendocument.formula-template"],
  ["odg", "application/vnd.oasis.opendocument.graphics"],
  ["odi", "application/vnd.oasis.opendocument.image"],
  ["odm", "application/vnd.oasis.opendocument.text-master"],
  ["odp", "application/vnd.oasis.opendocument.presentation"],
  ["ods", "application/vnd.oasis.opendocument.spreadsheet"],
  ["odt", "application/vnd.oasis.opendocument.text"],
  ["oga", "audio/ogg"],
  ["ogex", "model/vnd.opengex"],
  ["ogg", "audio/ogg"],
  ["ogv", "video/ogg"],
  ["ogx", "application/ogg"],
  ["omdoc", "application/omdoc+xml"],
  ["onepkg", "application/onenote"],
  ["onetmp", "application/onenote"],
  ["onetoc", "application/onenote"],
  ["onetoc2", "application/onenote"],
  ["opf", "application/oebps-package+xml"],
  ["opml", "text/x-opml"],
  ["oprc", "application/vnd.palm"],
  ["opus", "audio/ogg"],
  ["org", "text/x-org"],
  ["osf", "application/vnd.yamaha.openscoreformat"],
  ["osfpvg", "application/vnd.yamaha.openscoreformat.osfpvg+xml"],
  ["osm", "application/vnd.openstreetmap.data+xml"],
  ["otc", "application/vnd.oasis.opendocument.chart-template"],
  ["otf", "font/otf"],
  ["otg", "application/vnd.oasis.opendocument.graphics-template"],
  ["oth", "application/vnd.oasis.opendocument.text-web"],
  ["oti", "application/vnd.oasis.opendocument.image-template"],
  ["otp", "application/vnd.oasis.opendocument.presentation-template"],
  ["ots", "application/vnd.oasis.opendocument.spreadsheet-template"],
  ["ott", "application/vnd.oasis.opendocument.text-template"],
  ["ova", "application/x-virtualbox-ova"],
  ["ovf", "application/x-virtualbox-ovf"],
  ["owl", "application/rdf+xml"],
  ["oxps", "application/oxps"],
  ["oxt", "application/vnd.openofficeorg.extension"],
  ["p", "text/x-pascal"],
  ["p7a", "application/x-pkcs7-signature"],
  ["p7b", "application/x-pkcs7-certificates"],
  ["p7c", "application/pkcs7-mime"],
  ["p7m", "application/pkcs7-mime"],
  ["p7r", "application/x-pkcs7-certreqresp"],
  ["p7s", "application/pkcs7-signature"],
  ["p8", "application/pkcs8"],
  ["p10", "application/x-pkcs10"],
  ["p12", "application/x-pkcs12"],
  ["pac", "application/x-ns-proxy-autoconfig"],
  ["pages", "application/x-iwork-pages-sffpages"],
  ["pas", "text/x-pascal"],
  ["paw", "application/vnd.pawaafile"],
  ["pbd", "application/vnd.powerbuilder6"],
  ["pbm", "image/x-portable-bitmap"],
  ["pcap", "application/vnd.tcpdump.pcap"],
  ["pcf", "application/x-font-pcf"],
  ["pcl", "application/vnd.hp-pcl"],
  ["pclxl", "application/vnd.hp-pclxl"],
  ["pct", "image/x-pict"],
  ["pcurl", "application/vnd.curl.pcurl"],
  ["pcx", "image/x-pcx"],
  ["pdb", "application/x-pilot"],
  ["pde", "text/x-processing"],
  ["pdf", "application/pdf"],
  ["pem", "application/x-x509-user-cert"],
  ["pfa", "application/x-font-type1"],
  ["pfb", "application/x-font-type1"],
  ["pfm", "application/x-font-type1"],
  ["pfr", "application/font-tdpfr"],
  ["pfx", "application/x-pkcs12"],
  ["pgm", "image/x-portable-graymap"],
  ["pgn", "application/x-chess-pgn"],
  ["pgp", "application/pgp"],
  ["php", "application/x-httpd-php"],
  ["php3", "application/x-httpd-php"],
  ["php4", "application/x-httpd-php"],
  ["phps", "application/x-httpd-php-source"],
  ["phtml", "application/x-httpd-php"],
  ["pic", "image/x-pict"],
  ["pkg", "application/octet-stream"],
  ["pki", "application/pkixcmp"],
  ["pkipath", "application/pkix-pkipath"],
  ["pkpass", "application/vnd.apple.pkpass"],
  ["pl", "application/x-perl"],
  ["plb", "application/vnd.3gpp.pic-bw-large"],
  ["plc", "application/vnd.mobius.plc"],
  ["plf", "application/vnd.pocketlearn"],
  ["pls", "application/pls+xml"],
  ["pm", "application/x-perl"],
  ["pml", "application/vnd.ctc-posml"],
  ["png", "image/png"],
  ["pnm", "image/x-portable-anymap"],
  ["portpkg", "application/vnd.macports.portpkg"],
  ["pot", "application/vnd.ms-powerpoint"],
  ["potm", "application/vnd.ms-powerpoint.presentation.macroEnabled.12"],
  ["potx", "application/vnd.openxmlformats-officedocument.presentationml.template"],
  ["ppa", "application/vnd.ms-powerpoint"],
  ["ppam", "application/vnd.ms-powerpoint.addin.macroEnabled.12"],
  ["ppd", "application/vnd.cups-ppd"],
  ["ppm", "image/x-portable-pixmap"],
  ["pps", "application/vnd.ms-powerpoint"],
  ["ppsm", "application/vnd.ms-powerpoint.slideshow.macroEnabled.12"],
  ["ppsx", "application/vnd.openxmlformats-officedocument.presentationml.slideshow"],
  ["ppt", "application/powerpoint"],
  ["pptm", "application/vnd.ms-powerpoint.presentation.macroEnabled.12"],
  ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["pqa", "application/vnd.palm"],
  ["prc", "application/x-pilot"],
  ["pre", "application/vnd.lotus-freelance"],
  ["prf", "application/pics-rules"],
  ["provx", "application/provenance+xml"],
  ["ps", "application/postscript"],
  ["psb", "application/vnd.3gpp.pic-bw-small"],
  ["psd", "application/x-photoshop"],
  ["psf", "application/x-font-linux-psf"],
  ["pskcxml", "application/pskc+xml"],
  ["pti", "image/prs.pti"],
  ["ptid", "application/vnd.pvi.ptid1"],
  ["pub", "application/x-mspublisher"],
  ["pvb", "application/vnd.3gpp.pic-bw-var"],
  ["pwn", "application/vnd.3m.post-it-notes"],
  ["pya", "audio/vnd.ms-playready.media.pya"],
  ["pyv", "video/vnd.ms-playready.media.pyv"],
  ["qam", "application/vnd.epson.quickanime"],
  ["qbo", "application/vnd.intu.qbo"],
  ["qfx", "application/vnd.intu.qfx"],
  ["qps", "application/vnd.publishare-delta-tree"],
  ["qt", "video/quicktime"],
  ["qwd", "application/vnd.quark.quarkxpress"],
  ["qwt", "application/vnd.quark.quarkxpress"],
  ["qxb", "application/vnd.quark.quarkxpress"],
  ["qxd", "application/vnd.quark.quarkxpress"],
  ["qxl", "application/vnd.quark.quarkxpress"],
  ["qxt", "application/vnd.quark.quarkxpress"],
  ["ra", "audio/x-realaudio"],
  ["ram", "audio/x-pn-realaudio"],
  ["raml", "application/raml+yaml"],
  ["rapd", "application/route-apd+xml"],
  ["rar", "application/x-rar"],
  ["ras", "image/x-cmu-raster"],
  ["rcprofile", "application/vnd.ipunplugged.rcprofile"],
  ["rdf", "application/rdf+xml"],
  ["rdz", "application/vnd.data-vision.rdz"],
  ["relo", "application/p2p-overlay+xml"],
  ["rep", "application/vnd.businessobjects"],
  ["res", "application/x-dtbresource+xml"],
  ["rgb", "image/x-rgb"],
  ["rif", "application/reginfo+xml"],
  ["rip", "audio/vnd.rip"],
  ["ris", "application/x-research-info-systems"],
  ["rl", "application/resource-lists+xml"],
  ["rlc", "image/vnd.fujixerox.edmics-rlc"],
  ["rld", "application/resource-lists-diff+xml"],
  ["rm", "audio/x-pn-realaudio"],
  ["rmi", "audio/midi"],
  ["rmp", "audio/x-pn-realaudio-plugin"],
  ["rms", "application/vnd.jcp.javame.midlet-rms"],
  ["rmvb", "application/vnd.rn-realmedia-vbr"],
  ["rnc", "application/relax-ng-compact-syntax"],
  ["rng", "application/xml"],
  ["roa", "application/rpki-roa"],
  ["roff", "text/troff"],
  ["rp9", "application/vnd.cloanto.rp9"],
  ["rpm", "audio/x-pn-realaudio-plugin"],
  ["rpss", "application/vnd.nokia.radio-presets"],
  ["rpst", "application/vnd.nokia.radio-preset"],
  ["rq", "application/sparql-query"],
  ["rs", "application/rls-services+xml"],
  ["rsa", "application/x-pkcs7"],
  ["rsat", "application/atsc-rsat+xml"],
  ["rsd", "application/rsd+xml"],
  ["rsheet", "application/urc-ressheet+xml"],
  ["rss", "application/rss+xml"],
  ["rtf", "text/rtf"],
  ["rtx", "text/richtext"],
  ["run", "application/x-makeself"],
  ["rusd", "application/route-usd+xml"],
  ["rv", "video/vnd.rn-realvideo"],
  ["s", "text/x-asm"],
  ["s3m", "audio/s3m"],
  ["saf", "application/vnd.yamaha.smaf-audio"],
  ["sass", "text/x-sass"],
  ["sbml", "application/sbml+xml"],
  ["sc", "application/vnd.ibm.secure-container"],
  ["scd", "application/x-msschedule"],
  ["scm", "application/vnd.lotus-screencam"],
  ["scq", "application/scvp-cv-request"],
  ["scs", "application/scvp-cv-response"],
  ["scss", "text/x-scss"],
  ["scurl", "text/vnd.curl.scurl"],
  ["sda", "application/vnd.stardivision.draw"],
  ["sdc", "application/vnd.stardivision.calc"],
  ["sdd", "application/vnd.stardivision.impress"],
  ["sdkd", "application/vnd.solent.sdkm+xml"],
  ["sdkm", "application/vnd.solent.sdkm+xml"],
  ["sdp", "application/sdp"],
  ["sdw", "application/vnd.stardivision.writer"],
  ["sea", "application/octet-stream"],
  ["see", "application/vnd.seemail"],
  ["seed", "application/vnd.fdsn.seed"],
  ["sema", "application/vnd.sema"],
  ["semd", "application/vnd.semd"],
  ["semf", "application/vnd.semf"],
  ["senmlx", "application/senml+xml"],
  ["sensmlx", "application/sensml+xml"],
  ["ser", "application/java-serialized-object"],
  ["setpay", "application/set-payment-initiation"],
  ["setreg", "application/set-registration-initiation"],
  ["sfd-hdstx", "application/vnd.hydrostatix.sof-data"],
  ["sfs", "application/vnd.spotfire.sfs"],
  ["sfv", "text/x-sfv"],
  ["sgi", "image/sgi"],
  ["sgl", "application/vnd.stardivision.writer-global"],
  ["sgm", "text/sgml"],
  ["sgml", "text/sgml"],
  ["sh", "application/x-sh"],
  ["shar", "application/x-shar"],
  ["shex", "text/shex"],
  ["shf", "application/shf+xml"],
  ["shtml", "text/html"],
  ["sid", "image/x-mrsid-image"],
  ["sieve", "application/sieve"],
  ["sig", "application/pgp-signature"],
  ["sil", "audio/silk"],
  ["silo", "model/mesh"],
  ["sis", "application/vnd.symbian.install"],
  ["sisx", "application/vnd.symbian.install"],
  ["sit", "application/x-stuffit"],
  ["sitx", "application/x-stuffitx"],
  ["siv", "application/sieve"],
  ["skd", "application/vnd.koan"],
  ["skm", "application/vnd.koan"],
  ["skp", "application/vnd.koan"],
  ["skt", "application/vnd.koan"],
  ["sldm", "application/vnd.ms-powerpoint.slide.macroenabled.12"],
  ["sldx", "application/vnd.openxmlformats-officedocument.presentationml.slide"],
  ["slim", "text/slim"],
  ["slm", "text/slim"],
  ["sls", "application/route-s-tsid+xml"],
  ["slt", "application/vnd.epson.salt"],
  ["sm", "application/vnd.stepmania.stepchart"],
  ["smf", "application/vnd.stardivision.math"],
  ["smi", "application/smil"],
  ["smil", "application/smil"],
  ["smv", "video/x-smv"],
  ["smzip", "application/vnd.stepmania.package"],
  ["snd", "audio/basic"],
  ["snf", "application/x-font-snf"],
  ["so", "application/octet-stream"],
  ["spc", "application/x-pkcs7-certificates"],
  ["spdx", "text/spdx"],
  ["spf", "application/vnd.yamaha.smaf-phrase"],
  ["spl", "application/x-futuresplash"],
  ["spot", "text/vnd.in3d.spot"],
  ["spp", "application/scvp-vp-response"],
  ["spq", "application/scvp-vp-request"],
  ["spx", "audio/ogg"],
  ["sql", "application/x-sql"],
  ["src", "application/x-wais-source"],
  ["srt", "application/x-subrip"],
  ["sru", "application/sru+xml"],
  ["srx", "application/sparql-results+xml"],
  ["ssdl", "application/ssdl+xml"],
  ["sse", "application/vnd.kodak-descriptor"],
  ["ssf", "application/vnd.epson.ssf"],
  ["ssml", "application/ssml+xml"],
  ["sst", "application/octet-stream"],
  ["st", "application/vnd.sailingtracker.track"],
  ["stc", "application/vnd.sun.xml.calc.template"],
  ["std", "application/vnd.sun.xml.draw.template"],
  ["stf", "application/vnd.wt.stf"],
  ["sti", "application/vnd.sun.xml.impress.template"],
  ["stk", "application/hyperstudio"],
  ["stl", "model/stl"],
  ["stpx", "model/step+xml"],
  ["stpxz", "model/step-xml+zip"],
  ["stpz", "model/step+zip"],
  ["str", "application/vnd.pg.format"],
  ["stw", "application/vnd.sun.xml.writer.template"],
  ["styl", "text/stylus"],
  ["stylus", "text/stylus"],
  ["sub", "text/vnd.dvb.subtitle"],
  ["sus", "application/vnd.sus-calendar"],
  ["susp", "application/vnd.sus-calendar"],
  ["sv4cpio", "application/x-sv4cpio"],
  ["sv4crc", "application/x-sv4crc"],
  ["svc", "application/vnd.dvb.service"],
  ["svd", "application/vnd.svd"],
  ["svg", "image/svg+xml"],
  ["svgz", "image/svg+xml"],
  ["swa", "application/x-director"],
  ["swf", "application/x-shockwave-flash"],
  ["swi", "application/vnd.aristanetworks.swi"],
  ["swidtag", "application/swid+xml"],
  ["sxc", "application/vnd.sun.xml.calc"],
  ["sxd", "application/vnd.sun.xml.draw"],
  ["sxg", "application/vnd.sun.xml.writer.global"],
  ["sxi", "application/vnd.sun.xml.impress"],
  ["sxm", "application/vnd.sun.xml.math"],
  ["sxw", "application/vnd.sun.xml.writer"],
  ["t", "text/troff"],
  ["t3", "application/x-t3vm-image"],
  ["t38", "image/t38"],
  ["taglet", "application/vnd.mynfc"],
  ["tao", "application/vnd.tao.intent-module-archive"],
  ["tap", "image/vnd.tencent.tap"],
  ["tar", "application/x-tar"],
  ["tcap", "application/vnd.3gpp2.tcap"],
  ["tcl", "application/x-tcl"],
  ["td", "application/urc-targetdesc+xml"],
  ["teacher", "application/vnd.smart.teacher"],
  ["tei", "application/tei+xml"],
  ["teicorpus", "application/tei+xml"],
  ["tex", "application/x-tex"],
  ["texi", "application/x-texinfo"],
  ["texinfo", "application/x-texinfo"],
  ["text", "text/plain"],
  ["tfi", "application/thraud+xml"],
  ["tfm", "application/x-tex-tfm"],
  ["tfx", "image/tiff-fx"],
  ["tga", "image/x-tga"],
  ["tgz", "application/x-tar"],
  ["thmx", "application/vnd.ms-officetheme"],
  ["tif", "image/tiff"],
  ["tiff", "image/tiff"],
  ["tk", "application/x-tcl"],
  ["tmo", "application/vnd.tmobile-livetv"],
  ["toml", "application/toml"],
  ["torrent", "application/x-bittorrent"],
  ["tpl", "application/vnd.groove-tool-template"],
  ["tpt", "application/vnd.trid.tpt"],
  ["tr", "text/troff"],
  ["tra", "application/vnd.trueapp"],
  ["trig", "application/trig"],
  ["trm", "application/x-msterminal"],
  ["ts", "video/mp2t"],
  ["tsd", "application/timestamped-data"],
  ["tsv", "text/tab-separated-values"],
  ["ttc", "font/collection"],
  ["ttf", "font/ttf"],
  ["ttl", "text/turtle"],
  ["ttml", "application/ttml+xml"],
  ["twd", "application/vnd.simtech-mindmapper"],
  ["twds", "application/vnd.simtech-mindmapper"],
  ["txd", "application/vnd.genomatix.tuxedo"],
  ["txf", "application/vnd.mobius.txf"],
  ["txt", "text/plain"],
  ["u8dsn", "message/global-delivery-status"],
  ["u8hdr", "message/global-headers"],
  ["u8mdn", "message/global-disposition-notification"],
  ["u8msg", "message/global"],
  ["u32", "application/x-authorware-bin"],
  ["ubj", "application/ubjson"],
  ["udeb", "application/x-debian-package"],
  ["ufd", "application/vnd.ufdl"],
  ["ufdl", "application/vnd.ufdl"],
  ["ulx", "application/x-glulx"],
  ["umj", "application/vnd.umajin"],
  ["unityweb", "application/vnd.unity"],
  ["uoml", "application/vnd.uoml+xml"],
  ["uri", "text/uri-list"],
  ["uris", "text/uri-list"],
  ["urls", "text/uri-list"],
  ["usdz", "model/vnd.usdz+zip"],
  ["ustar", "application/x-ustar"],
  ["utz", "application/vnd.uiq.theme"],
  ["uu", "text/x-uuencode"],
  ["uva", "audio/vnd.dece.audio"],
  ["uvd", "application/vnd.dece.data"],
  ["uvf", "application/vnd.dece.data"],
  ["uvg", "image/vnd.dece.graphic"],
  ["uvh", "video/vnd.dece.hd"],
  ["uvi", "image/vnd.dece.graphic"],
  ["uvm", "video/vnd.dece.mobile"],
  ["uvp", "video/vnd.dece.pd"],
  ["uvs", "video/vnd.dece.sd"],
  ["uvt", "application/vnd.dece.ttml+xml"],
  ["uvu", "video/vnd.uvvu.mp4"],
  ["uvv", "video/vnd.dece.video"],
  ["uvva", "audio/vnd.dece.audio"],
  ["uvvd", "application/vnd.dece.data"],
  ["uvvf", "application/vnd.dece.data"],
  ["uvvg", "image/vnd.dece.graphic"],
  ["uvvh", "video/vnd.dece.hd"],
  ["uvvi", "image/vnd.dece.graphic"],
  ["uvvm", "video/vnd.dece.mobile"],
  ["uvvp", "video/vnd.dece.pd"],
  ["uvvs", "video/vnd.dece.sd"],
  ["uvvt", "application/vnd.dece.ttml+xml"],
  ["uvvu", "video/vnd.uvvu.mp4"],
  ["uvvv", "video/vnd.dece.video"],
  ["uvvx", "application/vnd.dece.unspecified"],
  ["uvvz", "application/vnd.dece.zip"],
  ["uvx", "application/vnd.dece.unspecified"],
  ["uvz", "application/vnd.dece.zip"],
  ["vbox", "application/x-virtualbox-vbox"],
  ["vbox-extpack", "application/x-virtualbox-vbox-extpack"],
  ["vcard", "text/vcard"],
  ["vcd", "application/x-cdlink"],
  ["vcf", "text/x-vcard"],
  ["vcg", "application/vnd.groove-vcard"],
  ["vcs", "text/x-vcalendar"],
  ["vcx", "application/vnd.vcx"],
  ["vdi", "application/x-virtualbox-vdi"],
  ["vds", "model/vnd.sap.vds"],
  ["vhd", "application/x-virtualbox-vhd"],
  ["vis", "application/vnd.visionary"],
  ["viv", "video/vnd.vivo"],
  ["vlc", "application/videolan"],
  ["vmdk", "application/x-virtualbox-vmdk"],
  ["vob", "video/x-ms-vob"],
  ["vor", "application/vnd.stardivision.writer"],
  ["vox", "application/x-authorware-bin"],
  ["vrml", "model/vrml"],
  ["vsd", "application/vnd.visio"],
  ["vsf", "application/vnd.vsf"],
  ["vss", "application/vnd.visio"],
  ["vst", "application/vnd.visio"],
  ["vsw", "application/vnd.visio"],
  ["vtf", "image/vnd.valve.source.texture"],
  ["vtt", "text/vtt"],
  ["vtu", "model/vnd.vtu"],
  ["vxml", "application/voicexml+xml"],
  ["w3d", "application/x-director"],
  ["wad", "application/x-doom"],
  ["wadl", "application/vnd.sun.wadl+xml"],
  ["war", "application/java-archive"],
  ["wasm", "application/wasm"],
  ["wav", "audio/x-wav"],
  ["wax", "audio/x-ms-wax"],
  ["wbmp", "image/vnd.wap.wbmp"],
  ["wbs", "application/vnd.criticaltools.wbs+xml"],
  ["wbxml", "application/wbxml"],
  ["wcm", "application/vnd.ms-works"],
  ["wdb", "application/vnd.ms-works"],
  ["wdp", "image/vnd.ms-photo"],
  ["weba", "audio/webm"],
  ["webapp", "application/x-web-app-manifest+json"],
  ["webm", "video/webm"],
  ["webmanifest", "application/manifest+json"],
  ["webp", "image/webp"],
  ["wg", "application/vnd.pmi.widget"],
  ["wgt", "application/widget"],
  ["wks", "application/vnd.ms-works"],
  ["wm", "video/x-ms-wm"],
  ["wma", "audio/x-ms-wma"],
  ["wmd", "application/x-ms-wmd"],
  ["wmf", "image/wmf"],
  ["wml", "text/vnd.wap.wml"],
  ["wmlc", "application/wmlc"],
  ["wmls", "text/vnd.wap.wmlscript"],
  ["wmlsc", "application/vnd.wap.wmlscriptc"],
  ["wmv", "video/x-ms-wmv"],
  ["wmx", "video/x-ms-wmx"],
  ["wmz", "application/x-msmetafile"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
  ["word", "application/msword"],
  ["wpd", "application/vnd.wordperfect"],
  ["wpl", "application/vnd.ms-wpl"],
  ["wps", "application/vnd.ms-works"],
  ["wqd", "application/vnd.wqd"],
  ["wri", "application/x-mswrite"],
  ["wrl", "model/vrml"],
  ["wsc", "message/vnd.wfa.wsc"],
  ["wsdl", "application/wsdl+xml"],
  ["wspolicy", "application/wspolicy+xml"],
  ["wtb", "application/vnd.webturbo"],
  ["wvx", "video/x-ms-wvx"],
  ["x3d", "model/x3d+xml"],
  ["x3db", "model/x3d+fastinfoset"],
  ["x3dbz", "model/x3d+binary"],
  ["x3dv", "model/x3d-vrml"],
  ["x3dvz", "model/x3d+vrml"],
  ["x3dz", "model/x3d+xml"],
  ["x32", "application/x-authorware-bin"],
  ["x_b", "model/vnd.parasolid.transmit.binary"],
  ["x_t", "model/vnd.parasolid.transmit.text"],
  ["xaml", "application/xaml+xml"],
  ["xap", "application/x-silverlight-app"],
  ["xar", "application/vnd.xara"],
  ["xav", "application/xcap-att+xml"],
  ["xbap", "application/x-ms-xbap"],
  ["xbd", "application/vnd.fujixerox.docuworks.binder"],
  ["xbm", "image/x-xbitmap"],
  ["xca", "application/xcap-caps+xml"],
  ["xcs", "application/calendar+xml"],
  ["xdf", "application/xcap-diff+xml"],
  ["xdm", "application/vnd.syncml.dm+xml"],
  ["xdp", "application/vnd.adobe.xdp+xml"],
  ["xdssc", "application/dssc+xml"],
  ["xdw", "application/vnd.fujixerox.docuworks"],
  ["xel", "application/xcap-el+xml"],
  ["xenc", "application/xenc+xml"],
  ["xer", "application/patch-ops-error+xml"],
  ["xfdf", "application/vnd.adobe.xfdf"],
  ["xfdl", "application/vnd.xfdl"],
  ["xht", "application/xhtml+xml"],
  ["xhtml", "application/xhtml+xml"],
  ["xhvml", "application/xv+xml"],
  ["xif", "image/vnd.xiff"],
  ["xl", "application/excel"],
  ["xla", "application/vnd.ms-excel"],
  ["xlam", "application/vnd.ms-excel.addin.macroEnabled.12"],
  ["xlc", "application/vnd.ms-excel"],
  ["xlf", "application/xliff+xml"],
  ["xlm", "application/vnd.ms-excel"],
  ["xls", "application/vnd.ms-excel"],
  ["xlsb", "application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
  ["xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["xlt", "application/vnd.ms-excel"],
  ["xltm", "application/vnd.ms-excel.template.macroEnabled.12"],
  ["xltx", "application/vnd.openxmlformats-officedocument.spreadsheetml.template"],
  ["xlw", "application/vnd.ms-excel"],
  ["xm", "audio/xm"],
  ["xml", "application/xml"],
  ["xns", "application/xcap-ns+xml"],
  ["xo", "application/vnd.olpc-sugar"],
  ["xop", "application/xop+xml"],
  ["xpi", "application/x-xpinstall"],
  ["xpl", "application/xproc+xml"],
  ["xpm", "image/x-xpixmap"],
  ["xpr", "application/vnd.is-xpr"],
  ["xps", "application/vnd.ms-xpsdocument"],
  ["xpw", "application/vnd.intercon.formnet"],
  ["xpx", "application/vnd.intercon.formnet"],
  ["xsd", "application/xml"],
  ["xsl", "application/xml"],
  ["xslt", "application/xslt+xml"],
  ["xsm", "application/vnd.syncml+xml"],
  ["xspf", "application/xspf+xml"],
  ["xul", "application/vnd.mozilla.xul+xml"],
  ["xvm", "application/xv+xml"],
  ["xvml", "application/xv+xml"],
  ["xwd", "image/x-xwindowdump"],
  ["xyz", "chemical/x-xyz"],
  ["xz", "application/x-xz"],
  ["yaml", "text/yaml"],
  ["yang", "application/yang"],
  ["yin", "application/yin+xml"],
  ["yml", "text/yaml"],
  ["ymp", "text/x-suse-ymp"],
  ["z", "application/x-compress"],
  ["z1", "application/x-zmachine"],
  ["z2", "application/x-zmachine"],
  ["z3", "application/x-zmachine"],
  ["z4", "application/x-zmachine"],
  ["z5", "application/x-zmachine"],
  ["z6", "application/x-zmachine"],
  ["z7", "application/x-zmachine"],
  ["z8", "application/x-zmachine"],
  ["zaz", "application/vnd.zzazz.deck+xml"],
  ["zip", "application/zip"],
  ["zir", "application/vnd.zul"],
  ["zirz", "application/vnd.zul"],
  ["zmm", "application/vnd.handheld-entertainment+xml"],
  ["zsh", "text/x-scriptzsh"]
]);
function ul(i, c, r) {
  const s = Xy(i), { webkitRelativePath: p } = i, g = typeof c == "string" ? c : typeof p == "string" && p.length > 0 ? p : `./${i.name}`;
  return typeof s.path != "string" && Fd(s, "path", g), Fd(s, "relativePath", g), s;
}
function Xy(i) {
  const { name: c } = i;
  if (c && c.lastIndexOf(".") !== -1 && !i.type) {
    const s = c.split(".").pop().toLowerCase(), p = ky.get(s);
    p && Object.defineProperty(i, "type", {
      value: p,
      writable: !1,
      configurable: !1,
      enumerable: !0
    });
  }
  return i;
}
function Fd(i, c, r) {
  Object.defineProperty(i, c, {
    value: r,
    writable: !1,
    configurable: !1,
    enumerable: !0
  });
}
const Zy = [
  // Thumbnail cache files for macOS and Windows
  ".DS_Store",
  // macOs
  "Thumbs.db"
  // Windows
];
function Vy(i) {
  return vn(this, void 0, void 0, function* () {
    return Nu(i) && Ky(i.dataTransfer) ? $y(i.dataTransfer, i.type) : Jy(i) ? Fy(i) : Array.isArray(i) && i.every((c) => "getFile" in c && typeof c.getFile == "function") ? Wy(i) : [];
  });
}
function Ky(i) {
  return Nu(i);
}
function Jy(i) {
  return Nu(i) && Nu(i.target);
}
function Nu(i) {
  return typeof i == "object" && i !== null;
}
function Fy(i) {
  return gs(i.target.files).map((c) => ul(c));
}
function Wy(i) {
  return vn(this, void 0, void 0, function* () {
    return (yield Promise.all(i.map((r) => r.getFile()))).map((r) => ul(r));
  });
}
function $y(i, c) {
  return vn(this, void 0, void 0, function* () {
    if (i.items) {
      const r = gs(i.items).filter((p) => p.kind === "file");
      if (c !== "drop")
        return r;
      const s = yield Promise.all(r.map(Iy));
      return Wd(Om(s));
    }
    return Wd(gs(i.files).map((r) => ul(r)));
  });
}
function Wd(i) {
  return i.filter((c) => Zy.indexOf(c.name) === -1);
}
function gs(i) {
  if (i === null)
    return [];
  const c = [];
  for (let r = 0; r < i.length; r++) {
    const s = i[r];
    c.push(s);
  }
  return c;
}
function Iy(i) {
  if (typeof i.webkitGetAsEntry != "function")
    return $d(i);
  const c = i.webkitGetAsEntry();
  return c && c.isDirectory ? Dm(c) : $d(i, c);
}
function Om(i) {
  return i.reduce((c, r) => [
    ...c,
    ...Array.isArray(r) ? Om(r) : [r]
  ], []);
}
function $d(i, c) {
  return vn(this, void 0, void 0, function* () {
    var r;
    if (globalThis.isSecureContext && typeof i.getAsFileSystemHandle == "function") {
      const g = yield i.getAsFileSystemHandle();
      if (g === null)
        throw new Error(`${i} is not a File`);
      if (g !== void 0) {
        const A = yield g.getFile();
        return A.handle = g, ul(A);
      }
    }
    const s = i.getAsFile();
    if (!s)
      throw new Error(`${i} is not a File`);
    return ul(s, (r = c?.fullPath) !== null && r !== void 0 ? r : void 0);
  });
}
function Py(i) {
  return vn(this, void 0, void 0, function* () {
    return i.isDirectory ? Dm(i) : tg(i);
  });
}
function Dm(i) {
  const c = i.createReader();
  return new Promise((r, s) => {
    const p = [];
    function g() {
      c.readEntries((A) => vn(this, void 0, void 0, function* () {
        if (A.length) {
          const S = Promise.all(A.map(Py));
          p.push(S), g();
        } else
          try {
            const S = yield Promise.all(p);
            r(S);
          } catch (S) {
            s(S);
          }
      }), (A) => {
        s(A);
      });
    }
    g();
  });
}
function tg(i) {
  return vn(this, void 0, void 0, function* () {
    return new Promise((c, r) => {
      i.file((s) => {
        const p = ul(s, i.fullPath);
        c(p);
      }, (s) => {
        r(s);
      });
    });
  });
}
var ju = {}, Id;
function eg() {
  return Id || (Id = 1, ju.__esModule = !0, ju.default = function(i, c) {
    if (i && c) {
      var r = Array.isArray(c) ? c : c.split(",");
      if (r.length === 0)
        return !0;
      var s = i.name || "", p = (i.type || "").toLowerCase(), g = p.replace(/\/.*$/, "");
      return r.some(function(A) {
        var S = A.trim().toLowerCase();
        return S.charAt(0) === "." ? s.toLowerCase().endsWith(S) : S.endsWith("/*") ? g === S.replace(/\/.*$/, "") : p === S;
      });
    }
    return !0;
  }), ju;
}
var ag = eg();
const rs = /* @__PURE__ */ Os(ag);
function Pd(i) {
  return ig(i) || lg(i) || _m(i) || ng();
}
function ng() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function lg(i) {
  if (typeof Symbol < "u" && i[Symbol.iterator] != null || i["@@iterator"] != null) return Array.from(i);
}
function ig(i) {
  if (Array.isArray(i)) return bs(i);
}
function tm(i, c) {
  var r = Object.keys(i);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(i);
    c && (s = s.filter(function(p) {
      return Object.getOwnPropertyDescriptor(i, p).enumerable;
    })), r.push.apply(r, s);
  }
  return r;
}
function em(i) {
  for (var c = 1; c < arguments.length; c++) {
    var r = arguments[c] != null ? arguments[c] : {};
    c % 2 ? tm(Object(r), !0).forEach(function(s) {
      wm(i, s, r[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(i, Object.getOwnPropertyDescriptors(r)) : tm(Object(r)).forEach(function(s) {
      Object.defineProperty(i, s, Object.getOwnPropertyDescriptor(r, s));
    });
  }
  return i;
}
function wm(i, c, r) {
  return c in i ? Object.defineProperty(i, c, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : i[c] = r, i;
}
function fi(i, c) {
  return og(i) || cg(i, c) || _m(i, c) || ug();
}
function ug() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function _m(i, c) {
  if (i) {
    if (typeof i == "string") return bs(i, c);
    var r = Object.prototype.toString.call(i).slice(8, -1);
    if (r === "Object" && i.constructor && (r = i.constructor.name), r === "Map" || r === "Set") return Array.from(i);
    if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return bs(i, c);
  }
}
function bs(i, c) {
  (c == null || c > i.length) && (c = i.length);
  for (var r = 0, s = new Array(c); r < c; r++)
    s[r] = i[r];
  return s;
}
function cg(i, c) {
  var r = i == null ? null : typeof Symbol < "u" && i[Symbol.iterator] || i["@@iterator"];
  if (r != null) {
    var s = [], p = !0, g = !1, A, S;
    try {
      for (r = r.call(i); !(p = (A = r.next()).done) && (s.push(A.value), !(c && s.length === c)); p = !0)
        ;
    } catch (T) {
      g = !0, S = T;
    } finally {
      try {
        !p && r.return != null && r.return();
      } finally {
        if (g) throw S;
      }
    }
    return s;
  }
}
function og(i) {
  if (Array.isArray(i)) return i;
}
var sg = typeof rs == "function" ? rs : rs.default, rg = "file-invalid-type", fg = "file-too-large", pg = "file-too-small", dg = "too-many-files", mg = function() {
  var c = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "", r = c.split(","), s = r.length > 1 ? "one of ".concat(r.join(", ")) : r[0];
  return {
    code: rg,
    message: "File type must be ".concat(s)
  };
}, am = function(c) {
  return {
    code: fg,
    message: "File is larger than ".concat(c, " ").concat(c === 1 ? "byte" : "bytes")
  };
}, nm = function(c) {
  return {
    code: pg,
    message: "File is smaller than ".concat(c, " ").concat(c === 1 ? "byte" : "bytes")
  };
}, hg = {
  code: dg,
  message: "Too many files"
};
function vg(i) {
  return i.type === "" && typeof i.getAsFile == "function";
}
function jm(i, c) {
  var r = i.type === "application/x-moz-file" || sg(i, c) || vg(i);
  return [r, r ? null : mg(c)];
}
function Cm(i, c, r) {
  if (hn(i.size))
    if (hn(c) && hn(r)) {
      if (i.size > r) return [!1, am(r)];
      if (i.size < c) return [!1, nm(c)];
    } else {
      if (hn(c) && i.size < c) return [!1, nm(c)];
      if (hn(r) && i.size > r) return [!1, am(r)];
    }
  return [!0, null];
}
function hn(i) {
  return i != null;
}
function yg(i) {
  var c = i.files, r = i.accept, s = i.minSize, p = i.maxSize, g = i.multiple, A = i.maxFiles, S = i.validator;
  return !g && c.length > 1 || g && A >= 1 && c.length > A ? !1 : c.every(function(T) {
    var v = jm(T, r), C = fi(v, 1), M = C[0], Q = Cm(T, s, p), k = fi(Q, 1), W = k[0], J = S ? S(T) : null;
    return M && W && !J;
  });
}
function Uu(i) {
  return typeof i.isPropagationStopped == "function" ? i.isPropagationStopped() : typeof i.cancelBubble < "u" ? i.cancelBubble : !1;
}
function li(i) {
  return i.dataTransfer ? Array.prototype.some.call(i.dataTransfer.types, function(c) {
    return c === "Files" || c === "application/x-moz-file";
  }) : !!i.target && !!i.target.files;
}
function lm(i) {
  i.preventDefault();
}
function gg(i) {
  return i.indexOf("MSIE") !== -1 || i.indexOf("Trident/") !== -1;
}
function bg(i) {
  return i.indexOf("Edge/") !== -1;
}
function xg() {
  var i = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : window.navigator.userAgent;
  return gg(i) || bg(i);
}
function Fe() {
  for (var i = arguments.length, c = new Array(i), r = 0; r < i; r++)
    c[r] = arguments[r];
  return function(s) {
    for (var p = arguments.length, g = new Array(p > 1 ? p - 1 : 0), A = 1; A < p; A++)
      g[A - 1] = arguments[A];
    return c.some(function(S) {
      return !Uu(s) && S && S.apply(void 0, [s].concat(g)), Uu(s);
    });
  };
}
function Sg() {
  return "showOpenFilePicker" in window;
}
function Eg(i) {
  if (hn(i)) {
    var c = Object.entries(i).filter(function(r) {
      var s = fi(r, 2), p = s[0], g = s[1], A = !0;
      return Mm(p) || (console.warn('Skipped "'.concat(p, '" because it is not a valid MIME type. Check https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types for a list of valid MIME types.')), A = !1), (!Array.isArray(g) || !g.every(Rm)) && (console.warn('Skipped "'.concat(p, '" because an invalid file extension was provided.')), A = !1), A;
    }).reduce(function(r, s) {
      var p = fi(s, 2), g = p[0], A = p[1];
      return em(em({}, r), {}, wm({}, g, A));
    }, {});
    return [{
      // description is required due to https://crbug.com/1264708
      description: "Files",
      accept: c
    }];
  }
  return i;
}
function Tg(i) {
  if (hn(i))
    return Object.entries(i).reduce(function(c, r) {
      var s = fi(r, 2), p = s[0], g = s[1];
      return [].concat(Pd(c), [p], Pd(g));
    }, []).filter(function(c) {
      return Mm(c) || Rm(c);
    }).join(",");
}
function Ag(i) {
  return i instanceof DOMException && (i.name === "AbortError" || i.code === i.ABORT_ERR);
}
function zg(i) {
  return i instanceof DOMException && (i.name === "SecurityError" || i.code === i.SECURITY_ERR);
}
function Mm(i) {
  return i === "audio/*" || i === "video/*" || i === "image/*" || i === "text/*" || i === "application/*" || /\w+\/[-+.\w]+/g.test(i);
}
function Rm(i) {
  return /^.*\.[\w]+$/.test(i);
}
var Og = ["children"], Dg = ["open"], wg = ["refKey", "role", "onKeyDown", "onFocus", "onBlur", "onClick", "onDragEnter", "onDragOver", "onDragLeave", "onDrop"], _g = ["refKey", "onChange", "onClick"];
function im(i) {
  return Mg(i) || Cg(i) || Nm(i) || jg();
}
function jg() {
  throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Cg(i) {
  if (typeof Symbol < "u" && i[Symbol.iterator] != null || i["@@iterator"] != null) return Array.from(i);
}
function Mg(i) {
  if (Array.isArray(i)) return xs(i);
}
function fs(i, c) {
  return Ug(i) || Ng(i, c) || Nm(i, c) || Rg();
}
function Rg() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Nm(i, c) {
  if (i) {
    if (typeof i == "string") return xs(i, c);
    var r = Object.prototype.toString.call(i).slice(8, -1);
    if (r === "Object" && i.constructor && (r = i.constructor.name), r === "Map" || r === "Set") return Array.from(i);
    if (r === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)) return xs(i, c);
  }
}
function xs(i, c) {
  (c == null || c > i.length) && (c = i.length);
  for (var r = 0, s = new Array(c); r < c; r++)
    s[r] = i[r];
  return s;
}
function Ng(i, c) {
  var r = i == null ? null : typeof Symbol < "u" && i[Symbol.iterator] || i["@@iterator"];
  if (r != null) {
    var s = [], p = !0, g = !1, A, S;
    try {
      for (r = r.call(i); !(p = (A = r.next()).done) && (s.push(A.value), !(c && s.length === c)); p = !0)
        ;
    } catch (T) {
      g = !0, S = T;
    } finally {
      try {
        !p && r.return != null && r.return();
      } finally {
        if (g) throw S;
      }
    }
    return s;
  }
}
function Ug(i) {
  if (Array.isArray(i)) return i;
}
function um(i, c) {
  var r = Object.keys(i);
  if (Object.getOwnPropertySymbols) {
    var s = Object.getOwnPropertySymbols(i);
    c && (s = s.filter(function(p) {
      return Object.getOwnPropertyDescriptor(i, p).enumerable;
    })), r.push.apply(r, s);
  }
  return r;
}
function _t(i) {
  for (var c = 1; c < arguments.length; c++) {
    var r = arguments[c] != null ? arguments[c] : {};
    c % 2 ? um(Object(r), !0).forEach(function(s) {
      Ss(i, s, r[s]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(i, Object.getOwnPropertyDescriptors(r)) : um(Object(r)).forEach(function(s) {
      Object.defineProperty(i, s, Object.getOwnPropertyDescriptor(r, s));
    });
  }
  return i;
}
function Ss(i, c, r) {
  return c in i ? Object.defineProperty(i, c, { value: r, enumerable: !0, configurable: !0, writable: !0 }) : i[c] = r, i;
}
function qu(i, c) {
  if (i == null) return {};
  var r = qg(i, c), s, p;
  if (Object.getOwnPropertySymbols) {
    var g = Object.getOwnPropertySymbols(i);
    for (p = 0; p < g.length; p++)
      s = g[p], !(c.indexOf(s) >= 0) && Object.prototype.propertyIsEnumerable.call(i, s) && (r[s] = i[s]);
  }
  return r;
}
function qg(i, c) {
  if (i == null) return {};
  var r = {}, s = Object.keys(i), p, g;
  for (g = 0; g < s.length; g++)
    p = s[g], !(c.indexOf(p) >= 0) && (r[p] = i[p]);
  return r;
}
var js = /* @__PURE__ */ I.forwardRef(function(i, c) {
  var r = i.children, s = qu(i, Og), p = qm(s), g = p.open, A = qu(p, Dg);
  return I.useImperativeHandle(c, function() {
    return {
      open: g
    };
  }, [g]), /* @__PURE__ */ qy.createElement(I.Fragment, null, r(_t(_t({}, A), {}, {
    open: g
  })));
});
js.displayName = "Dropzone";
var Um = {
  disabled: !1,
  getFilesFromEvent: Vy,
  maxSize: 1 / 0,
  minSize: 0,
  multiple: !0,
  maxFiles: 0,
  preventDropOnDocument: !0,
  noClick: !1,
  noKeyboard: !1,
  noDrag: !1,
  noDragEventsBubbling: !1,
  validator: null,
  useFsAccessApi: !1,
  autoFocus: !1
};
js.defaultProps = Um;
js.propTypes = {
  /**
   * Render function that exposes the dropzone state and prop getter fns
   *
   * @param {object} params
   * @param {Function} params.getRootProps Returns the props you should apply to the root drop container you render
   * @param {Function} params.getInputProps Returns the props you should apply to hidden file input you render
   * @param {Function} params.open Open the native file selection dialog
   * @param {boolean} params.isFocused Dropzone area is in focus
   * @param {boolean} params.isFileDialogActive File dialog is opened
   * @param {boolean} params.isDragActive Active drag is in progress
   * @param {boolean} params.isDragAccept Dragged files are accepted
   * @param {boolean} params.isDragReject True only during an active drag when some dragged files would be rejected. After drop, this resets to false. Use fileRejections for post-drop errors.
   * @param {boolean} params.isDragGlobal Files are being dragged anywhere on the document
   * @param {File[]} params.acceptedFiles Accepted files
   * @param {FileRejection[]} params.fileRejections Rejected files and why they were rejected. This persists after drop and is the source of truth for post-drop rejections.
   */
  children: Tt.func,
  /**
   * Set accepted file types.
   * Checkout https://developer.mozilla.org/en-US/docs/Web/API/window/showOpenFilePicker types option for more information.
   * Keep in mind that mime type determination is not reliable across platforms. CSV files,
   * for example, are reported as text/plain under macOS but as application/vnd.ms-excel under
   * Windows. In some cases there might not be a mime type set at all (https://github.com/react-dropzone/react-dropzone/issues/276).
   */
  accept: Tt.objectOf(Tt.arrayOf(Tt.string)),
  /**
   * Allow drag 'n' drop (or selection from the file dialog) of multiple files
   */
  multiple: Tt.bool,
  /**
   * If false, allow dropped items to take over the current browser window
   */
  preventDropOnDocument: Tt.bool,
  /**
   * If true, disables click to open the native file selection dialog
   */
  noClick: Tt.bool,
  /**
   * If true, disables SPACE/ENTER to open the native file selection dialog.
   * Note that it also stops tracking the focus state.
   */
  noKeyboard: Tt.bool,
  /**
   * If true, disables drag 'n' drop
   */
  noDrag: Tt.bool,
  /**
   * If true, stops drag event propagation to parents
   */
  noDragEventsBubbling: Tt.bool,
  /**
   * Minimum file size (in bytes)
   */
  minSize: Tt.number,
  /**
   * Maximum file size (in bytes)
   */
  maxSize: Tt.number,
  /**
   * Maximum accepted number of files
   * The default value is 0 which means there is no limitation to how many files are accepted.
   */
  maxFiles: Tt.number,
  /**
   * Enable/disable the dropzone
   */
  disabled: Tt.bool,
  /**
   * Use this to provide a custom file aggregator
   *
   * @param {(DragEvent|Event|Array<FileSystemFileHandle>)} event A drag event or input change event (if files were selected via the file dialog)
   */
  getFilesFromEvent: Tt.func,
  /**
   * Cb for when closing the file dialog with no selection
   */
  onFileDialogCancel: Tt.func,
  /**
   * Cb for when opening the file dialog
   */
  onFileDialogOpen: Tt.func,
  /**
   * Set to true to use the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
   * to open the file picker instead of using an `<input type="file">` click event.
   */
  useFsAccessApi: Tt.bool,
  /**
   * Set to true to focus the root element on render
   */
  autoFocus: Tt.bool,
  /**
   * Cb for when the `dragenter` event occurs.
   *
   * @param {DragEvent} event
   */
  onDragEnter: Tt.func,
  /**
   * Cb for when the `dragleave` event occurs
   *
   * @param {DragEvent} event
   */
  onDragLeave: Tt.func,
  /**
   * Cb for when the `dragover` event occurs
   *
   * @param {DragEvent} event
   */
  onDragOver: Tt.func,
  /**
   * Cb for when the `drop` event occurs.
   * Note that this callback is invoked after the `getFilesFromEvent` callback is done.
   *
   * Files are accepted or rejected based on the `accept`, `multiple`, `minSize` and `maxSize` props.
   * `accept` must be a valid [MIME type](http://www.iana.org/assignments/media-types/media-types.xhtml) according to [input element specification](https://www.w3.org/wiki/HTML/Elements/input/file) or a valid file extension.
   * If `multiple` is set to false and additional files are dropped,
   * all files besides the first will be rejected.
   * Any file which does not have a size in the [`minSize`, `maxSize`] range, will be rejected as well.
   *
   * Note that the `onDrop` callback will always be invoked regardless if the dropped files were accepted or rejected.
   * If you'd like to react to a specific scenario, use the `onDropAccepted`/`onDropRejected` props.
   *
   * `onDrop` will provide you with an array of [File](https://developer.mozilla.org/en-US/docs/Web/API/File) objects which you can then process and send to a server.
   * For example, with [SuperAgent](https://github.com/visionmedia/superagent) as a http/ajax library:
   *
   * ```js
   * function onDrop(acceptedFiles) {
   *   const req = request.post('/upload')
   *   acceptedFiles.forEach(file => {
   *     req.attach(file.name, file)
   *   })
   *   req.end(callback)
   * }
   * ```
   *
   * @param {File[]} acceptedFiles
   * @param {FileRejection[]} fileRejections
   * @param {(DragEvent|Event)} event A drag event or input change event (if files were selected via the file dialog)
   */
  onDrop: Tt.func,
  /**
   * Cb for when the `drop` event occurs.
   * Note that if no files are accepted, this callback is not invoked.
   *
   * @param {File[]} files
   * @param {(DragEvent|Event)} event
   */
  onDropAccepted: Tt.func,
  /**
   * Cb for when the `drop` event occurs.
   * Note that if no files are rejected, this callback is not invoked.
   *
   * @param {FileRejection[]} fileRejections
   * @param {(DragEvent|Event)} event
   */
  onDropRejected: Tt.func,
  /**
   * Cb for when there's some error from any of the promises.
   *
   * @param {Error} error
   */
  onError: Tt.func,
  /**
   * Custom validation function. It must return null if there's no errors.
   * @param {File} file
   * @returns {FileError|FileError[]|null}
   */
  validator: Tt.func
};
var Es = {
  isFocused: !1,
  isFileDialogActive: !1,
  isDragActive: !1,
  isDragAccept: !1,
  isDragReject: !1,
  isDragGlobal: !1,
  acceptedFiles: [],
  fileRejections: []
};
function qm() {
  var i = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, c = _t(_t({}, Um), i), r = c.accept, s = c.disabled, p = c.getFilesFromEvent, g = c.maxSize, A = c.minSize, S = c.multiple, T = c.maxFiles, v = c.onDragEnter, C = c.onDragLeave, M = c.onDragOver, Q = c.onDrop, k = c.onDropAccepted, W = c.onDropRejected, J = c.onFileDialogCancel, H = c.onFileDialogOpen, V = c.useFsAccessApi, ft = c.autoFocus, lt = c.preventDropOnDocument, pt = c.noClick, Ut = c.noKeyboard, Bt = c.noDrag, tt = c.noDragEventsBubbling, Vt = c.onError, le = c.validator, De = I.useMemo(function() {
    return Tg(r);
  }, [r]), ye = I.useMemo(function() {
    return Eg(r);
  }, [r]), Kt = I.useMemo(function() {
    return typeof H == "function" ? H : cm;
  }, [H]), we = I.useMemo(function() {
    return typeof J == "function" ? J : cm;
  }, [J]), At = I.useRef(null), jt = I.useRef(null), D = I.useReducer(Hg, Es), R = fs(D, 2), Z = R[0], $ = R[1], vt = Z.isFocused, h = Z.isFileDialogActive, _ = I.useRef(typeof window < "u" && window.isSecureContext && V && Sg()), N = function() {
    !_.current && h && setTimeout(function() {
      if (jt.current) {
        var X = jt.current.files;
        X.length || ($({
          type: "closeDialog"
        }), we());
      }
    }, 300);
  };
  I.useEffect(function() {
    return window.addEventListener("focus", N, !1), function() {
      window.removeEventListener("focus", N, !1);
    };
  }, [jt, h, we, _]);
  var B = I.useRef([]), F = I.useRef([]), nt = function(X) {
    At.current && At.current.contains(X.target) || (X.preventDefault(), B.current = []);
  };
  I.useEffect(function() {
    return lt && (document.addEventListener("dragover", lm, !1), document.addEventListener("drop", nt, !1)), function() {
      lt && (document.removeEventListener("dragover", lm), document.removeEventListener("drop", nt));
    };
  }, [At, lt]), I.useEffect(function() {
    var U = function(ge) {
      F.current = [].concat(im(F.current), [ge.target]), li(ge) && $({
        isDragGlobal: !0,
        type: "setDragGlobal"
      });
    }, X = function(ge) {
      F.current = F.current.filter(function(Le) {
        return Le !== ge.target && Le !== null;
      }), !(F.current.length > 0) && $({
        isDragGlobal: !1,
        type: "setDragGlobal"
      });
    }, zt = function() {
      F.current = [], $({
        isDragGlobal: !1,
        type: "setDragGlobal"
      });
    }, Ot = function() {
      F.current = [], $({
        isDragGlobal: !1,
        type: "setDragGlobal"
      });
    };
    return document.addEventListener("dragenter", U, !1), document.addEventListener("dragleave", X, !1), document.addEventListener("dragend", zt, !1), document.addEventListener("drop", Ot, !1), function() {
      document.removeEventListener("dragenter", U), document.removeEventListener("dragleave", X), document.removeEventListener("dragend", zt), document.removeEventListener("drop", Ot);
    };
  }, [At]), I.useEffect(function() {
    return !s && ft && At.current && At.current.focus(), function() {
    };
  }, [At, ft, s]);
  var it = I.useCallback(function(U) {
    Vt ? Vt(U) : console.error(U);
  }, [Vt]), Jt = I.useCallback(function(U) {
    U.preventDefault(), U.persist(), Aa(U), B.current = [].concat(im(B.current), [U.target]), li(U) && Promise.resolve(p(U)).then(function(X) {
      if (!(Uu(U) && !tt)) {
        var zt = X.length, Ot = zt > 0 && yg({
          files: X,
          accept: De,
          minSize: A,
          maxSize: g,
          multiple: S,
          maxFiles: T,
          validator: le
        }), Xt = zt > 0 && !Ot;
        $({
          isDragAccept: Ot,
          isDragReject: Xt,
          isDragActive: !0,
          type: "setDraggedFiles"
        }), v && v(U);
      }
    }).catch(function(X) {
      return it(X);
    });
  }, [p, v, it, tt, De, A, g, S, T, le]), Ct = I.useCallback(function(U) {
    U.preventDefault(), U.persist(), Aa(U);
    var X = li(U);
    if (X && U.dataTransfer)
      try {
        U.dataTransfer.dropEffect = "copy";
      } catch {
      }
    return X && M && M(U), !1;
  }, [M, tt]), Sa = I.useCallback(function(U) {
    U.preventDefault(), U.persist(), Aa(U);
    var X = B.current.filter(function(Ot) {
      return At.current && At.current.contains(Ot);
    }), zt = X.indexOf(U.target);
    zt !== -1 && X.splice(zt, 1), B.current = X, !(X.length > 0) && ($({
      type: "setDraggedFiles",
      isDragActive: !1,
      isDragAccept: !1,
      isDragReject: !1
    }), li(U) && C && C(U));
  }, [At, C, tt]), $e = I.useCallback(function(U, X) {
    var zt = [], Ot = [];
    U.forEach(function(Xt) {
      var ge = jm(Xt, De), Le = fs(ge, 2), cl = Le[0], ta = Le[1], $t = Cm(Xt, A, g), be = fs($t, 2), It = be[0], ol = be[1], sl = le ? le(Xt) : null;
      if (cl && It && !sl)
        zt.push(Xt);
      else {
        var rl = [ta, ol];
        sl && (rl = rl.concat(sl)), Ot.push({
          file: Xt,
          errors: rl.filter(function(xn) {
            return xn;
          })
        });
      }
    }), (!S && zt.length > 1 || S && T >= 1 && zt.length > T) && (zt.forEach(function(Xt) {
      Ot.push({
        file: Xt,
        errors: [hg]
      });
    }), zt.splice(0)), $({
      acceptedFiles: zt,
      fileRejections: Ot,
      type: "setFiles"
    }), Q && Q(zt, Ot, X), Ot.length > 0 && W && W(Ot, X), zt.length > 0 && k && k(zt, X);
  }, [$, S, De, A, g, T, Q, k, W, le]), Ea = I.useCallback(function(U) {
    U.preventDefault(), U.persist(), Aa(U), B.current = [], li(U) && Promise.resolve(p(U)).then(function(X) {
      Uu(U) && !tt || $e(X, U);
    }).catch(function(X) {
      return it(X);
    }), $({
      type: "reset"
    });
  }, [p, $e, it, tt]), Ie = I.useCallback(function() {
    if (_.current) {
      $({
        type: "openDialog"
      }), Kt();
      var U = {
        multiple: S,
        types: ye
      };
      window.showOpenFilePicker(U).then(function(X) {
        return p(X);
      }).then(function(X) {
        $e(X, null), $({
          type: "closeDialog"
        });
      }).catch(function(X) {
        Ag(X) ? (we(X), $({
          type: "closeDialog"
        })) : zg(X) ? (_.current = !1, jt.current ? (jt.current.value = null, jt.current.click()) : it(new Error("Cannot open the file picker because the https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API is not supported and no <input> was provided."))) : it(X);
      });
      return;
    }
    jt.current && ($({
      type: "openDialog"
    }), Kt(), jt.current.value = null, jt.current.click());
  }, [$, Kt, we, V, $e, it, ye, S]), Xe = I.useCallback(function(U) {
    !At.current || !At.current.isEqualNode(U.target) || (U.key === " " || U.key === "Enter" || U.keyCode === 32 || U.keyCode === 13) && (U.preventDefault(), Ie());
  }, [At, Ie]), gn = I.useCallback(function() {
    $({
      type: "focus"
    });
  }, []), bn = I.useCallback(function() {
    $({
      type: "blur"
    });
  }, []), di = I.useCallback(function() {
    pt || (xg() ? setTimeout(Ie, 0) : Ie());
  }, [pt, Ie]), Pe = function(X) {
    return s ? null : X;
  }, Fa = function(X) {
    return Ut ? null : Pe(X);
  }, Ta = function(X) {
    return Bt ? null : Pe(X);
  }, Aa = function(X) {
    tt && X.stopPropagation();
  }, Gu = I.useMemo(function() {
    return function() {
      var U = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, X = U.refKey, zt = X === void 0 ? "ref" : X, Ot = U.role, Xt = U.onKeyDown, ge = U.onFocus, Le = U.onBlur, cl = U.onClick, ta = U.onDragEnter, $t = U.onDragOver, be = U.onDragLeave, It = U.onDrop, ol = qu(U, wg);
      return _t(_t(Ss({
        onKeyDown: Fa(Fe(Xt, Xe)),
        onFocus: Fa(Fe(ge, gn)),
        onBlur: Fa(Fe(Le, bn)),
        onClick: Pe(Fe(cl, di)),
        onDragEnter: Ta(Fe(ta, Jt)),
        onDragOver: Ta(Fe($t, Ct)),
        onDragLeave: Ta(Fe(be, Sa)),
        onDrop: Ta(Fe(It, Ea)),
        role: typeof Ot == "string" && Ot !== "" ? Ot : "presentation"
      }, zt, At), !s && !Ut ? {
        tabIndex: 0
      } : {}), ol);
    };
  }, [At, Xe, gn, bn, di, Jt, Ct, Sa, Ea, Ut, Bt, s]), Qu = I.useCallback(function(U) {
    U.stopPropagation();
  }, []), ue = I.useMemo(function() {
    return function() {
      var U = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, X = U.refKey, zt = X === void 0 ? "ref" : X, Ot = U.onChange, Xt = U.onClick, ge = qu(U, _g), Le = Ss({
        accept: De,
        multiple: S,
        type: "file",
        style: {
          border: 0,
          clip: "rect(0, 0, 0, 0)",
          clipPath: "inset(50%)",
          height: "1px",
          margin: "0 -1px -1px 0",
          overflow: "hidden",
          padding: 0,
          position: "absolute",
          width: "1px",
          whiteSpace: "nowrap"
        },
        onChange: Pe(Fe(Ot, Ea)),
        onClick: Pe(Fe(Xt, Qu)),
        tabIndex: -1
      }, zt, jt);
      return _t(_t({}, Le), ge);
    };
  }, [jt, r, S, Ea, s]);
  return _t(_t({}, Z), {}, {
    isFocused: vt && !s,
    getRootProps: Gu,
    getInputProps: ue,
    rootRef: At,
    inputRef: jt,
    open: Pe(Ie)
  });
}
function Hg(i, c) {
  switch (c.type) {
    case "focus":
      return _t(_t({}, i), {}, {
        isFocused: !0
      });
    case "blur":
      return _t(_t({}, i), {}, {
        isFocused: !1
      });
    case "openDialog":
      return _t(_t({}, Es), {}, {
        isFileDialogActive: !0
      });
    case "closeDialog":
      return _t(_t({}, i), {}, {
        isFileDialogActive: !1
      });
    case "setDraggedFiles":
      return _t(_t({}, i), {}, {
        isDragActive: c.isDragActive,
        isDragAccept: c.isDragAccept,
        isDragReject: c.isDragReject
      });
    case "setFiles":
      return _t(_t({}, i), {}, {
        acceptedFiles: c.acceptedFiles,
        fileRejections: c.fileRejections,
        isDragReject: !1
      });
    case "setDragGlobal":
      return _t(_t({}, i), {}, {
        isDragGlobal: c.isDragGlobal
      });
    case "reset":
      return _t({}, Es);
    default:
      return i;
  }
}
function cm() {
}
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Hm = (...i) => i.filter((c, r, s) => !!c && c.trim() !== "" && s.indexOf(c) === r).join(" ").trim();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Bg = (i) => i.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Lg = (i) => i.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (c, r, s) => s ? s.toUpperCase() : r.toLowerCase()
);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const om = (i) => {
  const c = Lg(i);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var ps = {
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
const Gg = (i) => {
  for (const c in i)
    if (c.startsWith("aria-") || c === "role" || c === "title")
      return !0;
  return !1;
}, Qg = I.createContext({}), Yg = () => I.useContext(Qg), kg = I.forwardRef(
  ({ color: i, size: c, strokeWidth: r, absoluteStrokeWidth: s, className: p = "", children: g, iconNode: A, ...S }, T) => {
    const {
      size: v = 24,
      strokeWidth: C = 2,
      absoluteStrokeWidth: M = !1,
      color: Q = "currentColor",
      className: k = ""
    } = Yg() ?? {}, W = s ?? M ? Number(r ?? C) * 24 / Number(c ?? v) : r ?? C;
    return I.createElement(
      "svg",
      {
        ref: T,
        ...ps,
        width: c ?? v ?? ps.width,
        height: c ?? v ?? ps.height,
        stroke: i ?? Q,
        strokeWidth: W,
        className: Hm("lucide", k, p),
        ...!g && !Gg(S) && { "aria-hidden": "true" },
        ...S
      },
      [
        ...A.map(([J, H]) => I.createElement(J, H)),
        ...Array.isArray(g) ? g : [g]
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
const yn = (i, c) => {
  const r = I.forwardRef(
    ({ className: s, ...p }, g) => I.createElement(kg, {
      ref: g,
      iconNode: c,
      className: Hm(
        `lucide-${Bg(om(i))}`,
        `lucide-${i}`,
        s
      ),
      ...p
    })
  );
  return r.displayName = om(i), r;
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Xg = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
], Bm = yn("circle-alert", Xg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Zg = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
], Vg = yn("circle-check", Zg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Kg = [
  ["path", { d: "M12 13v8", key: "1l5pq0" }],
  ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
  ["path", { d: "m8 17 4-4 4 4", key: "1quai1" }]
], Cu = yn("cloud-upload", Kg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Jg = [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
], sm = yn("download", Jg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Fg = [
  [
    "path",
    {
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      key: "1oefj6"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
  [
    "path",
    { d: "M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1", key: "1oajmo" }
  ],
  [
    "path",
    { d: "M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1", key: "mpwhp6" }
  ]
], rm = yn("file-braces", Fg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Wg = [
  [
    "path",
    {
      d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",
      key: "1oefj6"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
  ["path", { d: "M10 9H8", key: "b1mrlr" }],
  ["path", { d: "M16 13H8", key: "t4e002" }],
  ["path", { d: "M16 17H8", key: "z1uh3a" }]
], fm = yn("file-text", Wg);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const $g = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]], pm = yn("loader-circle", $g);
let Ts = [];
const Ig = /* @__PURE__ */ new Set(), Pg = 500;
function t0() {
  Ig.forEach((i) => i(Ts));
}
function dm(i, c, r) {
  Ts = [{
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    op: i,
    timestamp: /* @__PURE__ */ new Date(),
    summary: c,
    detail: r
  }, ...Ts].slice(0, Pg), t0();
}
function e0(i) {
  let c = i;
  const r = /* @__PURE__ */ new Set();
  return {
    get: () => c,
    set: (s) => {
      c = { ...c, ...s }, r.forEach((p) => p());
    },
    subscribe: (s) => (r.add(s), () => {
      r.delete(s);
    })
  };
}
const ba = e0({
  isUploading: !1,
  isExporting: !1,
  exportFormat: "json",
  toast: null
});
let ii = null, ui = null;
function a0() {
  const [i, c] = I.useState(null), r = I.useSyncExternalStore(ba.subscribe, ba.get, ba.get), s = r.isUploading, p = r.isExporting, g = r.exportFormat, A = (H) => ba.set({ exportFormat: H }), [S, T] = I.useState(r.toast ? [r.toast] : []);
  function v(H, V) {
    const ft = Date.now();
    T((lt) => [...lt, { id: ft, type: H, text: V }]), setTimeout(() => T((lt) => lt.filter((pt) => pt.id !== ft)), 5e3);
  }
  const C = I.useCallback((H) => {
    H.length > 0 && c(H[0]);
  }, []), { getRootProps: M, getInputProps: Q, isDragActive: k } = qm({
    onDrop: C,
    accept: { "application/json": [".json"], "text/csv": [".csv"] },
    maxFiles: 1
  });
  async function W() {
    if (!i || ii) return ii;
    ba.set({ isUploading: !0 });
    const H = i;
    return ii = (async () => {
      try {
        const V = new FormData();
        V.append("file", H);
        const ft = await fetch("/api/import", { method: "POST", body: V });
        if (!ft.ok) {
          const pt = await ft.json();
          throw new Error(pt.detail || "导入没写成。");
        }
        const lt = await ft.json();
        v("success", `已导入 ${lt.nodes_imported} 个节点 · ${lt.edges_imported} 条边`), dm("import", `Imported ${lt.nodes_imported} nodes · ${lt.edges_imported} edges from ${H.name}`, { file: H.name }), c(null);
      } catch (V) {
        v("error", V instanceof Error ? V.message : "导入没写成。");
      } finally {
        ba.set({ isUploading: !1 }), ii = null;
      }
    })(), ii;
  }
  async function J() {
    if (ui) return ui;
    ba.set({ isExporting: !0 });
    const H = ba.get().exportFormat;
    return ui = (async () => {
      try {
        const V = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format: H })
        });
        if (!V.ok) {
          const Ut = await V.json();
          throw new Error(Ut.detail || "导出没写成。");
        }
        const ft = await V.blob(), lt = URL.createObjectURL(ft), pt = document.createElement("a");
        pt.href = lt, pt.download = `graph.${H}`, document.body.appendChild(pt), pt.click(), document.body.removeChild(pt), URL.revokeObjectURL(lt), v("success", `导出已就绪 — graph.${H}`), dm("export", `Exported graph as ${H.toUpperCase()}`, { format: H });
      } catch (V) {
        v("error", V instanceof Error ? V.message : "导出没写成。");
      } finally {
        ba.set({ isExporting: !1 }), ui = null;
      }
    })(), ui;
  }
  return /* @__PURE__ */ q.jsxs("div", { className: "ws-page ws-scroll", children: [
    /* @__PURE__ */ q.jsxs("div", { className: "ws-padded", style: { display: "flex", flexDirection: "column", gap: 24, maxWidth: 980, margin: "0 auto", width: "100%" }, children: [
      /* @__PURE__ */ q.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 14 }, children: [
        /* @__PURE__ */ q.jsx("div", { style: { width: 42, height: 42, borderRadius: 13, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }, children: /* @__PURE__ */ q.jsx(Cu, { size: 20 }) }),
        /* @__PURE__ */ q.jsxs("div", { children: [
          /* @__PURE__ */ q.jsx("h2", { className: "ws-title", style: { fontSize: 18 }, children: "导入导出" }),
          /* @__PURE__ */ q.jsx("div", { className: "ws-body", style: { marginTop: 2 }, children: "导入新数据集，或导出当前知识库。" })
        ] })
      ] }),
      /* @__PURE__ */ q.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }, children: [
        /* @__PURE__ */ q.jsxs("div", { className: "ws-card", style: { padding: 24, display: "flex", flexDirection: "column", gap: 18 }, children: [
          /* @__PURE__ */ q.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ q.jsx(Cu, { size: 16, color: "var(--ws-accent)" }),
            /* @__PURE__ */ q.jsx("div", { style: { color: "var(--ws-text)", fontWeight: 700, fontSize: 14 }, children: "导入实体与关系" })
          ] }),
          /* @__PURE__ */ q.jsxs(
            "div",
            {
              ...M(),
              style: {
                border: `2px dashed ${k ? "var(--ws-accent)" : "var(--ws-border)"}`,
                borderRadius: "var(--ws-radius)",
                background: k ? "var(--ws-accent-soft)" : "var(--dsw-alias-bg-layer-2, #eef1f4)",
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 200ms ease",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10
              },
              children: [
                /* @__PURE__ */ q.jsx("input", { ...Q() }),
                i ? /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                  i.name.endsWith(".json") ? /* @__PURE__ */ q.jsx(rm, { size: 40, color: "#4cc38a" }) : /* @__PURE__ */ q.jsx(fm, { size: 40, color: "#4cc38a" }),
                  /* @__PURE__ */ q.jsx("div", { style: { color: "var(--ws-text)", fontWeight: 700 }, children: i.name }),
                  /* @__PURE__ */ q.jsxs("div", { className: "ws-body", style: { fontSize: 11 }, children: [
                    (i.size / 1024).toFixed(1),
                    " KB — 点击替换"
                  ] })
                ] }) : /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                  /* @__PURE__ */ q.jsx(Cu, { size: 36, color: "var(--ws-accent)", style: { opacity: 0.7 } }),
                  /* @__PURE__ */ q.jsx("div", { style: { color: "var(--ws-text)", fontWeight: 600 }, children: "拖放或点击浏览" }),
                  /* @__PURE__ */ q.jsx("div", { className: "ws-pill ws-pill--mono", children: ".json" }),
                  /* @__PURE__ */ q.jsx("span", { style: { color: "var(--ws-text-dim)", fontSize: 11 }, children: "或" }),
                  /* @__PURE__ */ q.jsx("div", { className: "ws-pill ws-pill--mono", children: ".csv" })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ q.jsx(
            "button",
            {
              className: "ws-btn ws-btn--primary",
              onClick: W,
              disabled: !i || s,
              style: { width: "100%", justifyContent: "center" },
              children: s ? /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                /* @__PURE__ */ q.jsx(pm, { size: 15, className: "ws-spin" }),
                "上传中…"
              ] }) : /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                /* @__PURE__ */ q.jsx(Cu, { size: 15 }),
                "上传到图"
              ] })
            }
          )
        ] }),
        /* @__PURE__ */ q.jsxs("div", { className: "ws-card", style: { padding: 24, display: "flex", flexDirection: "column", gap: 18 }, children: [
          /* @__PURE__ */ q.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ q.jsx(sm, { size: 16, color: "var(--ws-purple)" }),
            /* @__PURE__ */ q.jsx("div", { style: { color: "var(--ws-text)", fontWeight: 700, fontSize: 14 }, children: "导出图谱快照" })
          ] }),
          /* @__PURE__ */ q.jsxs("div", { children: [
            /* @__PURE__ */ q.jsx("label", { className: "ws-label", children: "格式" }),
            /* @__PURE__ */ q.jsx("div", { style: { display: "flex", gap: 8 }, children: ["json", "csv"].map((H) => /* @__PURE__ */ q.jsxs(
              "button",
              {
                className: `ws-btn ${g === H ? "ws-btn--primary" : "ws-btn--ghost"}`,
                style: { flex: 1, justifyContent: "center", textTransform: "uppercase", fontSize: 12 },
                onClick: () => A(H),
                children: [
                  H === "json" ? /* @__PURE__ */ q.jsx(rm, { size: 14 }) : /* @__PURE__ */ q.jsx(fm, { size: 14 }),
                  H
                ]
              },
              H
            )) })
          ] }),
          /* @__PURE__ */ q.jsxs("div", { style: { flex: 1, padding: "14px 16px", borderRadius: "var(--ws-radius-sm)", background: "var(--dsw-alias-bg-layer-2, #eef1f4)", border: "1px solid var(--ws-border)" }, children: [
            /* @__PURE__ */ q.jsx("div", { style: { color: "var(--ws-text-muted)", fontWeight: 700, fontSize: 12, marginBottom: 6 }, children: "会带上什么" }),
            /* @__PURE__ */ q.jsx("div", { className: "ws-body", style: { fontSize: 12 }, children: g === "json" ? "完整图快照：节点属性、边权重和元数据，JSON。" : "扁平 CSV：节点和边各成行。适合表格分析。" })
          ] }),
          /* @__PURE__ */ q.jsx(
            "button",
            {
              className: "ws-btn",
              onClick: J,
              disabled: p,
              style: { width: "100%", justifyContent: "center", background: "var(--ws-purple-soft)", borderColor: "rgba(192,132,252,0.3)", color: "#d8b4fe" },
              children: p ? /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                /* @__PURE__ */ q.jsx(pm, { size: 15, className: "ws-spin" }),
                "准备中…"
              ] }) : /* @__PURE__ */ q.jsxs(q.Fragment, { children: [
                /* @__PURE__ */ q.jsx(sm, { size: 15 }),
                "下载导出"
              ] })
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ q.jsx("div", { style: { position: "fixed", bottom: 28, right: 28, display: "flex", flexDirection: "column", gap: 10, zIndex: 1e3 }, children: S.map((H) => /* @__PURE__ */ q.jsxs("div", { className: "ws-animate-in", style: { display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderRadius: "var(--ws-radius-sm)", background: (H.type === "success", "var(--dsw-alias-bg-layer-1, #f6f8fa)"), border: `1px solid ${H.type === "success" ? "rgba(76,195,138,0.4)" : "rgba(255,123,114,0.4)"}`, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }, children: [
      H.type === "success" ? /* @__PURE__ */ q.jsx(Vg, { size: 16, color: "#4cc38a" }) : /* @__PURE__ */ q.jsx(Bm, { size: 16, color: "#ff7b72" }),
      /* @__PURE__ */ q.jsx("span", { style: { color: "var(--ws-text)", fontSize: 13, fontWeight: 500 }, children: H.text })
    ] }, H.id)) })
  ] });
}
const n0 = 5e3;
class l0 extends I.Component {
  settleTimer = null;
  constructor(c) {
    super(c), this.state = { hasError: !1, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(c) {
    return { hasError: !0, error: c };
  }
  componentDidCatch(c, r) {
    console.error("ErrorBoundary caught an error:", c, r), this.clearSettleTimer();
  }
  componentWillUnmount() {
    this.clearSettleTimer();
  }
  clearSettleTimer() {
    this.settleTimer !== null && (clearTimeout(this.settleTimer), this.settleTimer = null);
  }
  resetErrorBoundary = () => {
    this.clearSettleTimer(), this.setState((c) => ({
      hasError: !1,
      error: null,
      retryCount: c.retryCount + 1
    })), this.settleTimer = setTimeout(() => {
      this.settleTimer = null, this.setState({ retryCount: 0 });
    }, n0);
  };
  render() {
    if (this.state.hasError) {
      const c = this.state.retryCount >= 3;
      return /* @__PURE__ */ q.jsxs(
        "div",
        {
          className: "workspace-loading",
          style: {
            flexDirection: "column",
            gap: 12,
            color: "var(--ws-red)"
          },
          children: [
            /* @__PURE__ */ q.jsx(Bm, { size: 32, style: { marginBottom: 4, opacity: 0.8 } }),
            /* @__PURE__ */ q.jsx("div", { style: { fontWeight: 500, fontSize: "15px" }, children: "Something went wrong in this view." }),
            /* @__PURE__ */ q.jsx("div", { style: { fontSize: "13px", opacity: 0.7, maxWidth: 450, textAlign: "center", marginBottom: 8, lineHeight: 1.5 }, children: c ? "This view continues to encounter a critical error. Please switch to another workspace or reload the page to restore functionality." : "An unexpected problem occurred while rendering this workspace. Your data is safe, but this view cannot be displayed." }),
            c ? /* @__PURE__ */ q.jsx(
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
            ) : /* @__PURE__ */ q.jsx(
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
function We(i, c) {
  return typeof document > "u" ? c : getComputedStyle(document.documentElement).getPropertyValue(i).trim() || c;
}
function i0() {
  We("--dsw-alias-bg-base", "#ffffff"), We("--dsw-alias-bg-layer-1", "#f6f8fa"), We("--dsw-alias-bg-layer-2", "#eef1f4"), We("--dsw-alias-label-primary", "#1f2328"), We("--dsw-alias-label-secondary", "#3d444d"), We("--dsw-alias-brand-primary", "#0969da"), We("--dsw-alias-border-l2", "rgba(31,35,40,0.15)"), We("--dsw-alias-label-primary-foreground", "") || We("--dsw-alias-label-on-primary", "") || We("--dsw-alias-label-on-brand", "");
}
const u0 = /^\s*Entity\s*\(/;
function xa(i) {
  return typeof i == "string" && u0.test(i);
}
function c0(i) {
  const c = i.match(/Entity\s*\(\s*text\s*=\s*(['"])((?:\\.|(?!\1).)*)\1/);
  return c ? c[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
}
function se(i) {
  return typeof i == "string" ? i.trim() : "";
}
function Lu(i) {
  return i.properties && typeof i.properties == "object" ? i.properties : {};
}
function Hu(i) {
  const c = Lu(i), r = se(i.id);
  if (r.startsWith("file:")) {
    const p = r.split(/[/\\]/).pop() || r;
    if (p && !xa(p)) return p;
  }
  if (r.startsWith("session:")) {
    const p = se(c.content) || se(i.content);
    if (p) return p.split(`
`)[0].slice(0, 24);
  }
  const s = [c.label, c.name, c.content, i.content, r];
  for (const p of s) {
    const g = se(p);
    if (!(!g || xa(g)))
      return g;
  }
  for (const p of s) {
    const g = se(p);
    if (!g || !xa(g)) continue;
    const A = c0(g);
    if (A) return A;
  }
  return r && !xa(r) ? r : "节点";
}
const o0 = /* @__PURE__ */ new Set(["UNKNOWN", "entity", "Entity", "DATE", "PERSON"]);
function pi(i) {
  const c = se(i.id);
  if (!c) return !0;
  const r = Lu(i), s = se(i.content) || se(r.content);
  if (xa(c) || xa(s)) return !0;
  const p = se(i.type);
  return !!o0.has(p);
}
function Mu(i) {
  const c = Hu(i), r = { ...Lu(i) };
  return (!se(r.label) || xa(r.label)) && (r.label = c), (!se(r.name) || xa(r.name)) && (r.name = c), (!se(r.content) || xa(r.content)) && (r.content = c), {
    ...i,
    content: c,
    properties: r
  };
}
function s0(i, c) {
  const r = c.trim().toLowerCase();
  if (!r) return 0;
  const s = Hu(i).toLowerCase(), p = se(i.id).toLowerCase(), g = se(i.type).toLowerCase(), A = Lu(i), S = [A.name, A.content, A.label].map((C) => se(C).toLowerCase()).filter(Boolean), T = [s, p, g, ...S];
  let v = 0;
  return s === r || p === r ? v = 1 : s.startsWith(r) || p.startsWith(r) ? v = 0.92 : T.some((C) => C.includes(r)) && (v = 0.78), v <= 0 ? 0 : Math.min(v, 1);
}
function r0(i, c, r = 8) {
  return i.filter((s) => !pi(s)).map((s) => ({ node: Mu(s), score: s0(s, c) })).filter((s) => s.score > 0).sort((s, p) => p.score !== s.score ? p.score - s.score : Hu(s.node).localeCompare(Hu(p.node), "zh")).slice(0, r);
}
function f0() {
  if (typeof document > "u") return "";
  const i = document.querySelectorAll(".dsos-root");
  for (let r = 0; r < i.length; r++) {
    const s = i[r];
    if (!(s instanceof HTMLElement) || s.offsetParent === null && s.getClientRects().length === 0) continue;
    const p = s.getAttribute("data-cwd") || "";
    if (p) return p;
  }
  const c = document.querySelector(".dsos-root[data-dsos-semantic]");
  return c && c.getAttribute("data-cwd") || "";
}
const p0 = [
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
function d0(i) {
  let c = String(i || "").split("?")[0];
  return (c.startsWith("/semantic-os/api/") || c === "/semantic-os/api") && (c = c.slice(12)), c === "/api" ? "" : c.startsWith("/api/") ? c.slice(5) : null;
}
function As(i) {
  const c = d0(i);
  return c == null ? !1 : c ? p0.some((r) => c === r || c.startsWith(r + "/")) : !0;
}
function ds(i) {
  try {
    const c = new URL(i, window.location.origin);
    if (As(c.pathname) && c.pathname.startsWith("/api/"))
      return c.pathname = "/semantic-os" + c.pathname, c.toString();
  } catch {
  }
  return As(i.split("?")[0]) && i.startsWith("/api/") ? "/semantic-os" + i : i;
}
function mm(i) {
  try {
    if (typeof i == "string") return new URL(i, window.location.origin).pathname;
    if (i instanceof URL) return i.pathname;
    if (i instanceof Request) return new URL(i.url, window.location.origin).pathname;
  } catch {
  }
  return "";
}
function kt(i, c) {
  return new Response(JSON.stringify(c), {
    status: i,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
let m0 = null;
function h0(i, c, r) {
  try {
    const s = JSON.parse(i);
    return c.reasonMode && (s.mode = c.reasonMode()), s.apply_to_graph = !!r, m0 = {
      facts: s.facts,
      rules: s.rules,
      mode: s.mode,
      apply_to_graph: s.apply_to_graph
    }, JSON.stringify(s);
  } catch {
    return i;
  }
}
function v0(i) {
  return i.get("x-dsh-reason-write") === "1";
}
function y0(i) {
  if (!i || typeof i != "object") return !1;
  const c = i;
  if (typeof c.node_count == "number") return c.node_count > 0;
  if (typeof c.nodes == "number") return c.nodes > 0;
  const r = c.nodes ?? c.items;
  return Array.isArray(i) ? i.length > 0 : Array.isArray(r) ? r.length > 0 : !1;
}
async function g0(i, c, r) {
  const s = r.body;
  let p = null;
  if (typeof FormData < "u" && s instanceof FormData) {
    const M = s.get("file");
    M instanceof File && (p = M);
  }
  if (!p) return kt(400, { detail: "只认 json 或 csv。" });
  const g = p.name || "", A = g.toLowerCase().split(".").pop();
  if (A !== "json" && A !== "csv")
    return kt(400, { detail: "只认 json 或 csv。" });
  const S = await p.text();
  let T = !1;
  try {
    const Q = await (await i(`/semantic-os/nodes?cwd=${encodeURIComponent(c)}`, {
      headers: { "x-dsh-cwd": c }
    })).json().catch(() => null);
    T = y0(Q);
  } catch {
    T = !1;
  }
  if (T && !window.confirm("图里已有内容。导入会覆盖当前图，确定吗？"))
    return kt(400, { detail: "已取消导入。" });
  const v = await i("/semantic-os/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dsh-cwd": c },
    body: JSON.stringify({ cwd: c, filename: g, data: S, confirm: !0 })
  });
  if (v.ok) return v;
  const C = await v.json().catch(() => ({}));
  return kt(v.status || 400, {
    ...C,
    detail: "导入失败，已恢复上一份图。"
  });
}
async function b0(i, c, r) {
  let s = "json";
  try {
    if (typeof r.body == "string") {
      const S = JSON.parse(r.body);
      s = String(S.format || "json").toLowerCase();
    }
  } catch {
  }
  if (s !== "json" && s !== "csv")
    return kt(400, { detail: "只认 json 或 csv。" });
  const p = window.prompt("绝对路径", "");
  if (p == null) return kt(400, { detail: "已取消导出。" });
  const g = String(p).trim(), A = async (S) => {
    const T = await i("/semantic-os/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dsh-cwd": c },
      body: JSON.stringify({
        cwd: c,
        format: s,
        dest: g || void 0,
        confirm: S || void 0
      })
    }), v = await T.json().catch(() => ({}));
    if (v && v.error === "OUTSIDE_CWD")
      return window.confirm("导出路径在当前目录外。确定继续？") ? A(!0) : kt(400, { detail: "已取消导出。" });
    if (v && v.error === "REJECT_FORMAT")
      return kt(400, { detail: "只认 json 或 csv。" });
    if (!T.ok || v && v.ok === !1)
      return kt(T.status || 400, { detail: v.detail || "只认 json 或 csv。" });
    if (!g && v.data != null) {
      const C = typeof v.data == "string" ? v.data : JSON.stringify(v.data, null, 2);
      return new Response(C, {
        status: 200,
        headers: {
          "content-type": s === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="graph.${s}"`
        }
      });
    }
    return kt(200, v);
  };
  return A(!1);
}
async function x0(i, c, r) {
  if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？"))
    return kt(400, { detail: "已取消合并。" });
  const s = await i(c, r);
  if (s.ok) return s;
  const p = await s.json().catch(() => ({}));
  return kt(s.status || 400, {
    ...p,
    detail: "合并没写成。"
  });
}
function zs(i) {
  return /\/api\/ontology\/shacl\//.test(i) ? "规则没检查成。" : /\/api\/ontology\/registry/.test(i) ? "词表列表没读成。" : /\/api\/provenance/.test(i) ? "血缘没读成。" : "";
}
function S0(i) {
  return typeof i == "string" && /[\u4e00-\u9fff]/.test(i);
}
async function hm(i, c) {
  const r = zs(c);
  if (!r || i.ok) return i;
  const s = await i.json().catch(() => ({})), p = s && typeof s == "object" ? s : {}, g = S0(p.detail) ? p.detail : r;
  return kt(i.status || 400, { ...p, detail: g });
}
function E0(i) {
  if (!i || typeof i != "object") return i;
  const c = i;
  if (Array.isArray(c.nodes)) {
    const r = c.nodes.filter((s) => !pi(s)).map((s) => Mu(s));
    return {
      ...c,
      nodes: r,
      ...typeof c.count == "number" ? { count: r.length } : {},
      ...typeof c.total == "number" ? { total: r.length } : {},
      ...typeof c.node_count == "number" ? { node_count: r.length } : {}
    };
  }
  return Array.isArray(c.results) ? {
    ...c,
    results: c.results.filter((r) => {
      if (!r || typeof r != "object") return !1;
      const p = r.node || r;
      return !pi(p);
    }).map((r) => {
      if (!r || typeof r != "object") return r;
      const s = r;
      return s.node ? { ...s, node: Mu(s.node) } : r;
    })
  } : c.id || c.content || c.properties ? Mu(c) : i;
}
async function T0(i, c, r) {
  const s = await i(c, r);
  if (!s.ok) return s;
  const p = await s.json().catch(() => null);
  return kt(s.status, E0(p));
}
async function A0(i, c, r, s) {
  let p = "", g = 8;
  try {
    if (typeof s.body == "string") {
      const C = JSON.parse(s.body);
      p = String(C.query || C.q || "").trim(), g = Number(C.limit) || 8;
    }
  } catch {
  }
  const S = await (await i("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": c }
  })).json().catch(() => null), v = (S && typeof S == "object" && Array.isArray(S.nodes) ? S.nodes : []).filter((C) => !pi(C));
  return kt(200, { results: r0(v, p, g) });
}
async function z0(i, c) {
  const r = await i("/semantic-os/api/temporal/bounds", {
    headers: { "x-dsh-cwd": c }
  });
  if (!r.ok)
    return kt(200, { min: null, max: null, count: 0, empty: !0 });
  const s = await r.json().catch(() => null);
  return kt(200, s && typeof s == "object" ? s : { min: null, max: null, count: 0, empty: !0 });
}
async function O0(i, c, r, s) {
  const p = await i(r, s);
  if (!p.ok) return p;
  const g = await p.json().catch(() => null);
  if (!g || typeof g != "object") return kt(p.status, g);
  const A = g, S = Array.isArray(A.active_node_ids) ? A.active_node_ids.map((k) => String(k)) : [], v = await (await i("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": c }
  })).json().catch(() => null), C = v && typeof v == "object" && Array.isArray(v.nodes) ? v.nodes : [], M = new Set(
    C.filter((k) => pi(k)).map((k) => String(k.id || "")).filter(Boolean)
  ), Q = S.filter((k) => !M.has(k));
  return kt(p.status, {
    ...A,
    active_node_ids: Q,
    active_node_count: Q.length
  });
}
const il = [];
function D0(i, c = {}) {
  const r = String(i || ""), s = window.fetch.bind(window);
  return il.push(s), window.fetch = (p, g) => {
    const A = mm(p);
    if (!As(A)) return s(p, g);
    const S = f0() || r;
    let T = p, v = { ...g || {} };
    typeof p == "string" ? T = ds(p) : p instanceof URL ? T = ds(p.toString()) : p instanceof Request && (T = new Request(ds(p.url), p));
    const C = new Headers();try { const __h=v.headers; const __ct=__h&&(__h.get?__h.get("content-type"):(__h["content-type"]||__h["Content-Type"]));if(__ct) C.set("content-type", String(__ct)); } catch {}const M = !1;
    if (S && M ? C.set("x-dsh-cwd", S) : C.delete("x-dsh-cwd"), v.headers = C, S && !M) {
      const H = (V) => /[?&]cwd=/.test(V) ? V : V + (V.includes("?") ? "&" : "?") + "cwd=" + encodeURIComponent(S);
      typeof T == "string" ? T = H(T) : T instanceof URL ? T.searchParams.get("cwd") || T.searchParams.set("cwd", S) : T instanceof Request && (T = new Request(H(T.url), T));
    }
    const Q = mm(T), k = String(v.method || (T instanceof Request ? T.method : "GET")).toUpperCase();
    if (k === "POST" && Q.endsWith("/api/reason") && typeof v.body == "string") {
      const H = v0(C);
      return v.body = h0(v.body, c, H), s(T, v).then(async (ft) => {
        const pt = await ft.clone().json().catch(() => ({}));
        try {
          if (!ft.ok)
            return window.dispatchEvent(new CustomEvent("dsh-reason-failed", { detail: pt })), ft;
          window.dispatchEvent(new CustomEvent(H ? "dsh-reason-applied" : "dsh-reason-previewed", {
            detail: pt
          }));
        } catch {
        }
        return ft;
      });
    }
    const W = A.match(/\/api\/decisions\/([^/]+)\/chain$/);
    if (W)
      try {
        window.dispatchEvent(new CustomEvent("dsh-decision-selected", {
          detail: { id: decodeURIComponent(W[1]) }
        }));
      } catch {
      }
    if (c.ioLock && k === "POST" && /\/api\/import\/?$/.test(A))
      return g0(s, S, v);
    if (c.ioLock && k === "POST" && /\/api\/export\/?$/.test(A))
      return b0(s, S, v);
    if (c.mergeConfirm && k === "POST" && /\/api\/enrich\/merge\/?$/.test(A))
      return x0(s, T, v);
    if (k === "GET" && /\/api\/graph\/nodes\/?$/.test(A))
      return T0(s, T, v);
    if (k === "GET" && /\/api\/temporal\/bounds\/?$/.test(A))
      return z0(s, S);
    if (k === "GET" && /\/api\/temporal\/snapshot\/?$/.test(A))
      return O0(s, S, T, v);
    if (k === "POST" && /\/api\/graph\/search\/?$/.test(A))
      return A0(s, S, T, v);
    const J = s(T, v).catch((H) => {
      const V = zs(A);
      if (V) return kt(502, { detail: V });
      throw H;
    });
    return k === "GET" && /\/api\/decisions\/?$/.test(A) ? J.then(async (H) => H.status !== 422 ? hm(H, A) : new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" }
    })) : zs(A) ? J.then((H) => hm(H, A)) : J;
  }, () => {
    const p = il.lastIndexOf(s);
    p >= 0 && il.splice(p, 1), window.fetch = il.length ? il[il.length - 1] : s;
  };
}
const ci = {
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
function w0(i) {
  let c = i;
  return c = c.replace(/(\d[\d,]*)\s+nodes\s+[·•]\s+(\d[\d,]*)\s+edges/ig, "$1 个点 · $2 条边"), c = c.replace(/\b(\d[\d,]*)\s+shapes\b/ig, "$1 条规则"), c = c.replace(/\b(\d[\d,]*)\s+constraints\b/ig, "$1 条约束"), c = c.replace(/(\d[\d,]*)\s+direct neighbors highlighted/ig, "$1 个直接邻居已标出"), c = c.replace(/(\d[\d,]*)\s+direct neighbors in the full graph/ig, "全图里有 $1 个直接邻居"), c = c.replace(/(\d[\d,]*)\s+source fields/ig, "$1 个出处字段"), c = c.replace(/(\d[\d,]*)\s+candidate links/ig, "$1 条可能的连线"), c = c.replace(/\b(\d[\d,]*)\s+hops\b/ig, "$1 跳"), c === i ? null : c;
}
function vm(i) {
  return i.replace(/\s+/g, " ").trim();
}
function _0(i) {
  return i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function ym(i) {
  const c = i.trim();
  if (!c) return i;
  const r = w0(c);
  if (r) return i.replace(c, r);
  if (ci[c]) return i.replace(c, ci[c]);
  const s = vm(c);
  if (ci[s]) return i.replace(c, ci[s]);
  let p = s;
  const g = Object.entries(ci).sort((A, S) => S[0].length - A[0].length);
  for (const [A, S] of g) {
    const T = vm(A);
    if (!(!T.includes(" ") && /^[A-Za-z]/.test(T) && T.length < 16) && !(T.length < 6)) {
      if (/^[A-Za-z]/.test(T)) {
        const v = new RegExp(`(?<![A-Za-z])${_0(T)}(?![A-Za-z])`, "g");
        p = p.replace(v, S);
        continue;
      }
      p.includes(T) && (p = p.split(T).join(S));
    }
  }
  return p === s ? i : i.replace(c, p);
}
function gm(i) {
  for (; i; ) {
    const c = i.tagName;
    if (c === "TEXTAREA" || c === "PRE" || c === "CODE" || c === "SCRIPT" || c === "STYLE") return !0;
    const r = typeof i.className == "string" ? i.className : "";
    if (r.includes("monaco-editor") || r.includes("view-lines") || r.includes("mtk")) return !0;
    i = i.parentElement;
  }
  return !1;
}
function oi(i) {
  if (i.nodeType === Node.TEXT_NODE) {
    if (gm(i.parentElement)) return;
    const r = ym(i.nodeValue || "");
    r !== i.nodeValue && (i.nodeValue = r);
    return;
  }
  if (i.nodeType !== Node.ELEMENT_NODE) return;
  const c = i;
  if (!gm(c)) {
    for (const r of ["placeholder", "title", "aria-label"]) {
      const s = c.getAttribute(r);
      if (!s) continue;
      const p = ym(s);
      p !== s && c.setAttribute(r, p);
    }
    c.childNodes.forEach(oi);
  }
}
function j0(i) {
  oi(i);
  const c = new MutationObserver((r) => {
    for (const s of r)
      s.addedNodes.forEach(oi), s.type === "characterData" && s.target && oi(s.target), s.type === "attributes" && s.target && oi(s.target);
  });
  return c.observe(i, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["placeholder", "title", "aria-label"] }), () => c.disconnect();
}
function C0() {
  return new Uy({
    defaultOptions: {
      queries: { refetchOnWindowFocus: !1, retry: 1 }
    }
  });
}
function M0(i, c = {}) {
  const r = String(c.cwd || "");
  i.classList.add("dsh-io-host", "dsh-ws-host"), i0();
  const s = C0(), p = D0(r, { ioLock: !0 }), g = j0(i), A = cy.createRoot(i);
  return A.render(
    /* @__PURE__ */ q.jsx(By, { client: s, children: /* @__PURE__ */ q.jsx("div", { className: "dsh-io-frame", children: /* @__PURE__ */ q.jsx(l0, { children: /* @__PURE__ */ q.jsx(a0, {}) }) }) })
  ), () => {
    g(), p(), A.unmount(), s.clear();
  };
}
const R0 = { mount: M0 };
export {
  R0 as default,
  M0 as mount
};
