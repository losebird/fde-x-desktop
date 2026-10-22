var Ts = { exports: {} }, Cn = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Xd;
function Jm() {
  if (Xd) return Cn;
  Xd = 1;
  var i = /* @__PURE__ */ Symbol.for("react.transitional.element"), s = /* @__PURE__ */ Symbol.for("react.fragment");
  function r(f, v, D) {
    var N = null;
    if (D !== void 0 && (N = "" + D), v.key !== void 0 && (N = "" + v.key), "key" in v) {
      D = {};
      for (var z in v)
        z !== "key" && (D[z] = v[z]);
    } else D = v;
    return v = D.ref, {
      $$typeof: i,
      type: f,
      key: N,
      ref: v !== void 0 ? v : null,
      props: D
    };
  }
  return Cn.Fragment = s, Cn.jsx = r, Cn.jsxs = r, Cn;
}
var Zd;
function Fm() {
  return Zd || (Zd = 1, Ts.exports = Jm()), Ts.exports;
}
var R = Fm(), zs = { exports: {} }, F = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Vd;
function Wm() {
  if (Vd) return F;
  Vd = 1;
  var i = /* @__PURE__ */ Symbol.for("react.transitional.element"), s = /* @__PURE__ */ Symbol.for("react.portal"), r = /* @__PURE__ */ Symbol.for("react.fragment"), f = /* @__PURE__ */ Symbol.for("react.strict_mode"), v = /* @__PURE__ */ Symbol.for("react.profiler"), D = /* @__PURE__ */ Symbol.for("react.consumer"), N = /* @__PURE__ */ Symbol.for("react.context"), z = /* @__PURE__ */ Symbol.for("react.forward_ref"), A = /* @__PURE__ */ Symbol.for("react.suspense"), g = /* @__PURE__ */ Symbol.for("react.memo"), U = /* @__PURE__ */ Symbol.for("react.lazy"), x = /* @__PURE__ */ Symbol.for("react.activity"), Y = Symbol.iterator;
  function V(y) {
    return y === null || typeof y != "object" ? null : (y = Y && y[Y] || y["@@iterator"], typeof y == "function" ? y : null);
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
  }, J = Object.assign, P = {};
  function tt(y, M, H) {
    this.props = y, this.context = M, this.refs = P, this.updater = H || W;
  }
  tt.prototype.isReactComponent = {}, tt.prototype.setState = function(y, M) {
    if (typeof y != "object" && typeof y != "function" && y != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, y, M, "setState");
  }, tt.prototype.forceUpdate = function(y) {
    this.updater.enqueueForceUpdate(this, y, "forceUpdate");
  };
  function Et() {
  }
  Et.prototype = tt.prototype;
  function bt(y, M, H) {
    this.props = y, this.context = M, this.refs = P, this.updater = H || W;
  }
  var Ot = bt.prototype = new Et();
  Ot.constructor = bt, J(Ot, tt.prototype), Ot.isPureReactComponent = !0;
  var K = Array.isArray;
  function X() {
  }
  var G = { H: null, A: null, T: null, S: null }, Qt = Object.prototype.hasOwnProperty;
  function ne(y, M, H) {
    var B = H.ref;
    return {
      $$typeof: i,
      type: y,
      key: M,
      ref: B !== void 0 ? B : null,
      props: H
    };
  }
  function De(y, M) {
    return ne(y.type, M, y.props);
  }
  function ue(y) {
    return typeof y == "object" && y !== null && y.$$typeof === i;
  }
  function kt(y) {
    var M = { "=": "=0", ":": "=2" };
    return "$" + y.replace(/[=:]/g, function(H) {
      return M[H];
    });
  }
  var _l = /\/+/g;
  function Be(y, M) {
    return typeof y == "object" && y !== null && y.key != null ? kt("" + y.key) : M.toString(36);
  }
  function Ce(y) {
    switch (y.status) {
      case "fulfilled":
        return y.value;
      case "rejected":
        throw y.reason;
      default:
        switch (typeof y.status == "string" ? y.then(X, X) : (y.status = "pending", y.then(
          function(M) {
            y.status === "pending" && (y.status = "fulfilled", y.value = M);
          },
          function(M) {
            y.status === "pending" && (y.status = "rejected", y.reason = M);
          }
        )), y.status) {
          case "fulfilled":
            return y.value;
          case "rejected":
            throw y.reason;
        }
    }
    throw y;
  }
  function O(y, M, H, B, k) {
    var et = typeof y;
    (et === "undefined" || et === "boolean") && (y = null);
    var ot = !1;
    if (y === null) ot = !0;
    else
      switch (et) {
        case "bigint":
        case "string":
        case "number":
          ot = !0;
          break;
        case "object":
          switch (y.$$typeof) {
            case i:
            case s:
              ot = !0;
              break;
            case U:
              return ot = y._init, O(
                ot(y._payload),
                M,
                H,
                B,
                k
              );
          }
      }
    if (ot)
      return k = k(y), ot = B === "" ? "." + Be(y, 0) : B, K(k) ? (H = "", ot != null && (H = ot.replace(_l, "$&/") + "/"), O(k, M, H, "", function(xa) {
        return xa;
      })) : k != null && (ue(k) && (k = De(
        k,
        H + (k.key == null || y && y.key === k.key ? "" : ("" + k.key).replace(
          _l,
          "$&/"
        ) + "/") + ot
      )), M.push(k)), 1;
    ot = 0;
    var Kt = B === "" ? "." : B + ":";
    if (K(y))
      for (var _t = 0; _t < y.length; _t++)
        B = y[_t], et = Kt + Be(B, _t), ot += O(
          B,
          M,
          H,
          et,
          k
        );
    else if (_t = V(y), typeof _t == "function")
      for (y = _t.call(y), _t = 0; !(B = y.next()).done; )
        B = B.value, et = Kt + Be(B, _t++), ot += O(
          B,
          M,
          H,
          et,
          k
        );
    else if (et === "object") {
      if (typeof y.then == "function")
        return O(
          Ce(y),
          M,
          H,
          B,
          k
        );
      throw M = String(y), Error(
        "Objects are not valid as a React child (found: " + (M === "[object Object]" ? "object with keys {" + Object.keys(y).join(", ") + "}" : M) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return ot;
  }
  function j(y, M, H) {
    if (y == null) return y;
    var B = [], k = 0;
    return O(y, B, "", "", function(et) {
      return M.call(H, et, k++);
    }), B;
  }
  function Z(y) {
    if (y._status === -1) {
      var M = y._result;
      M = M(), M.then(
        function(H) {
          (y._status === 0 || y._status === -1) && (y._status = 1, y._result = H);
        },
        function(H) {
          (y._status === 0 || y._status === -1) && (y._status = 2, y._result = H);
        }
      ), y._status === -1 && (y._status = 0, y._result = M);
    }
    if (y._status === 1) return y._result.default;
    throw y._result;
  }
  var ht = typeof reportError == "function" ? reportError : function(y) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var M = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof y == "object" && y !== null && typeof y.message == "string" ? String(y.message) : String(y),
        error: y
      });
      if (!window.dispatchEvent(M)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", y);
      return;
    }
    console.error(y);
  }, gt = {
    map: j,
    forEach: function(y, M, H) {
      j(
        y,
        function() {
          M.apply(this, arguments);
        },
        H
      );
    },
    count: function(y) {
      var M = 0;
      return j(y, function() {
        M++;
      }), M;
    },
    toArray: function(y) {
      return j(y, function(M) {
        return M;
      }) || [];
    },
    only: function(y) {
      if (!ue(y))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return y;
    }
  };
  return F.Activity = x, F.Children = gt, F.Component = tt, F.Fragment = r, F.Profiler = v, F.PureComponent = bt, F.StrictMode = f, F.Suspense = A, F.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = G, F.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(y) {
      return G.H.useMemoCache(y);
    }
  }, F.cache = function(y) {
    return function() {
      return y.apply(null, arguments);
    };
  }, F.cacheSignal = function() {
    return null;
  }, F.cloneElement = function(y, M, H) {
    if (y == null)
      throw Error(
        "The argument must be a React element, but you passed " + y + "."
      );
    var B = J({}, y.props), k = y.key;
    if (M != null)
      for (et in M.key !== void 0 && (k = "" + M.key), M)
        !Qt.call(M, et) || et === "key" || et === "__self" || et === "__source" || et === "ref" && M.ref === void 0 || (B[et] = M[et]);
    var et = arguments.length - 2;
    if (et === 1) B.children = H;
    else if (1 < et) {
      for (var ot = Array(et), Kt = 0; Kt < et; Kt++)
        ot[Kt] = arguments[Kt + 2];
      B.children = ot;
    }
    return ne(y.type, k, B);
  }, F.createContext = function(y) {
    return y = {
      $$typeof: N,
      _currentValue: y,
      _currentValue2: y,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, y.Provider = y, y.Consumer = {
      $$typeof: D,
      _context: y
    }, y;
  }, F.createElement = function(y, M, H) {
    var B, k = {}, et = null;
    if (M != null)
      for (B in M.key !== void 0 && (et = "" + M.key), M)
        Qt.call(M, B) && B !== "key" && B !== "__self" && B !== "__source" && (k[B] = M[B]);
    var ot = arguments.length - 2;
    if (ot === 1) k.children = H;
    else if (1 < ot) {
      for (var Kt = Array(ot), _t = 0; _t < ot; _t++)
        Kt[_t] = arguments[_t + 2];
      k.children = Kt;
    }
    if (y && y.defaultProps)
      for (B in ot = y.defaultProps, ot)
        k[B] === void 0 && (k[B] = ot[B]);
    return ne(y, et, k);
  }, F.createRef = function() {
    return { current: null };
  }, F.forwardRef = function(y) {
    return { $$typeof: z, render: y };
  }, F.isValidElement = ue, F.lazy = function(y) {
    return {
      $$typeof: U,
      _payload: { _status: -1, _result: y },
      _init: Z
    };
  }, F.memo = function(y, M) {
    return {
      $$typeof: g,
      type: y,
      compare: M === void 0 ? null : M
    };
  }, F.startTransition = function(y) {
    var M = G.T, H = {};
    G.T = H;
    try {
      var B = y(), k = G.S;
      k !== null && k(H, B), typeof B == "object" && B !== null && typeof B.then == "function" && B.then(X, ht);
    } catch (et) {
      ht(et);
    } finally {
      M !== null && H.types !== null && (M.types = H.types), G.T = M;
    }
  }, F.unstable_useCacheRefresh = function() {
    return G.H.useCacheRefresh();
  }, F.use = function(y) {
    return G.H.use(y);
  }, F.useActionState = function(y, M, H) {
    return G.H.useActionState(y, M, H);
  }, F.useCallback = function(y, M) {
    return G.H.useCallback(y, M);
  }, F.useContext = function(y) {
    return G.H.useContext(y);
  }, F.useDebugValue = function() {
  }, F.useDeferredValue = function(y, M) {
    return G.H.useDeferredValue(y, M);
  }, F.useEffect = function(y, M) {
    return G.H.useEffect(y, M);
  }, F.useEffectEvent = function(y) {
    return G.H.useEffectEvent(y);
  }, F.useId = function() {
    return G.H.useId();
  }, F.useImperativeHandle = function(y, M, H) {
    return G.H.useImperativeHandle(y, M, H);
  }, F.useInsertionEffect = function(y, M) {
    return G.H.useInsertionEffect(y, M);
  }, F.useLayoutEffect = function(y, M) {
    return G.H.useLayoutEffect(y, M);
  }, F.useMemo = function(y, M) {
    return G.H.useMemo(y, M);
  }, F.useOptimistic = function(y, M) {
    return G.H.useOptimistic(y, M);
  }, F.useReducer = function(y, M, H) {
    return G.H.useReducer(y, M, H);
  }, F.useRef = function(y) {
    return G.H.useRef(y);
  }, F.useState = function(y) {
    return G.H.useState(y);
  }, F.useSyncExternalStore = function(y, M, H) {
    return G.H.useSyncExternalStore(
      y,
      M,
      H
    );
  }, F.useTransition = function() {
    return G.H.useTransition();
  }, F.version = "19.2.5", F;
}
var Kd;
function Bs() {
  return Kd || (Kd = 1, zs.exports = Wm()), zs.exports;
}
var St = Bs(), Os = { exports: {} }, _n = {}, Ds = { exports: {} }, Cs = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Jd;
function km() {
  return Jd || (Jd = 1, (function(i) {
    function s(O, j) {
      var Z = O.length;
      O.push(j);
      t: for (; 0 < Z; ) {
        var ht = Z - 1 >>> 1, gt = O[ht];
        if (0 < v(gt, j))
          O[ht] = j, O[Z] = gt, Z = ht;
        else break t;
      }
    }
    function r(O) {
      return O.length === 0 ? null : O[0];
    }
    function f(O) {
      if (O.length === 0) return null;
      var j = O[0], Z = O.pop();
      if (Z !== j) {
        O[0] = Z;
        t: for (var ht = 0, gt = O.length, y = gt >>> 1; ht < y; ) {
          var M = 2 * (ht + 1) - 1, H = O[M], B = M + 1, k = O[B];
          if (0 > v(H, Z))
            B < gt && 0 > v(k, H) ? (O[ht] = k, O[B] = Z, ht = B) : (O[ht] = H, O[M] = Z, ht = M);
          else if (B < gt && 0 > v(k, Z))
            O[ht] = k, O[B] = Z, ht = B;
          else break t;
        }
      }
      return j;
    }
    function v(O, j) {
      var Z = O.sortIndex - j.sortIndex;
      return Z !== 0 ? Z : O.id - j.id;
    }
    if (i.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var D = performance;
      i.unstable_now = function() {
        return D.now();
      };
    } else {
      var N = Date, z = N.now();
      i.unstable_now = function() {
        return N.now() - z;
      };
    }
    var A = [], g = [], U = 1, x = null, Y = 3, V = !1, W = !1, J = !1, P = !1, tt = typeof setTimeout == "function" ? setTimeout : null, Et = typeof clearTimeout == "function" ? clearTimeout : null, bt = typeof setImmediate < "u" ? setImmediate : null;
    function Ot(O) {
      for (var j = r(g); j !== null; ) {
        if (j.callback === null) f(g);
        else if (j.startTime <= O)
          f(g), j.sortIndex = j.expirationTime, s(A, j);
        else break;
        j = r(g);
      }
    }
    function K(O) {
      if (J = !1, Ot(O), !W)
        if (r(A) !== null)
          W = !0, X || (X = !0, kt());
        else {
          var j = r(g);
          j !== null && Ce(K, j.startTime - O);
        }
    }
    var X = !1, G = -1, Qt = 5, ne = -1;
    function De() {
      return P ? !0 : !(i.unstable_now() - ne < Qt);
    }
    function ue() {
      if (P = !1, X) {
        var O = i.unstable_now();
        ne = O;
        var j = !0;
        try {
          t: {
            W = !1, J && (J = !1, Et(G), G = -1), V = !0;
            var Z = Y;
            try {
              e: {
                for (Ot(O), x = r(A); x !== null && !(x.expirationTime > O && De()); ) {
                  var ht = x.callback;
                  if (typeof ht == "function") {
                    x.callback = null, Y = x.priorityLevel;
                    var gt = ht(
                      x.expirationTime <= O
                    );
                    if (O = i.unstable_now(), typeof gt == "function") {
                      x.callback = gt, Ot(O), j = !0;
                      break e;
                    }
                    x === r(A) && f(A), Ot(O);
                  } else f(A);
                  x = r(A);
                }
                if (x !== null) j = !0;
                else {
                  var y = r(g);
                  y !== null && Ce(
                    K,
                    y.startTime - O
                  ), j = !1;
                }
              }
              break t;
            } finally {
              x = null, Y = Z, V = !1;
            }
            j = void 0;
          }
        } finally {
          j ? kt() : X = !1;
        }
      }
    }
    var kt;
    if (typeof bt == "function")
      kt = function() {
        bt(ue);
      };
    else if (typeof MessageChannel < "u") {
      var _l = new MessageChannel(), Be = _l.port2;
      _l.port1.onmessage = ue, kt = function() {
        Be.postMessage(null);
      };
    } else
      kt = function() {
        tt(ue, 0);
      };
    function Ce(O, j) {
      G = tt(function() {
        O(i.unstable_now());
      }, j);
    }
    i.unstable_IdlePriority = 5, i.unstable_ImmediatePriority = 1, i.unstable_LowPriority = 4, i.unstable_NormalPriority = 3, i.unstable_Profiling = null, i.unstable_UserBlockingPriority = 2, i.unstable_cancelCallback = function(O) {
      O.callback = null;
    }, i.unstable_forceFrameRate = function(O) {
      0 > O || 125 < O ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : Qt = 0 < O ? Math.floor(1e3 / O) : 5;
    }, i.unstable_getCurrentPriorityLevel = function() {
      return Y;
    }, i.unstable_next = function(O) {
      switch (Y) {
        case 1:
        case 2:
        case 3:
          var j = 3;
          break;
        default:
          j = Y;
      }
      var Z = Y;
      Y = j;
      try {
        return O();
      } finally {
        Y = Z;
      }
    }, i.unstable_requestPaint = function() {
      P = !0;
    }, i.unstable_runWithPriority = function(O, j) {
      switch (O) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          O = 3;
      }
      var Z = Y;
      Y = O;
      try {
        return j();
      } finally {
        Y = Z;
      }
    }, i.unstable_scheduleCallback = function(O, j, Z) {
      var ht = i.unstable_now();
      switch (typeof Z == "object" && Z !== null ? (Z = Z.delay, Z = typeof Z == "number" && 0 < Z ? ht + Z : ht) : Z = ht, O) {
        case 1:
          var gt = -1;
          break;
        case 2:
          gt = 250;
          break;
        case 5:
          gt = 1073741823;
          break;
        case 4:
          gt = 1e4;
          break;
        default:
          gt = 5e3;
      }
      return gt = Z + gt, O = {
        id: U++,
        callback: j,
        priorityLevel: O,
        startTime: Z,
        expirationTime: gt,
        sortIndex: -1
      }, Z > ht ? (O.sortIndex = Z, s(g, O), r(A) === null && O === r(g) && (J ? (Et(G), G = -1) : J = !0, Ce(K, Z - ht))) : (O.sortIndex = gt, s(A, O), W || V || (W = !0, X || (X = !0, kt()))), O;
    }, i.unstable_shouldYield = De, i.unstable_wrapCallback = function(O) {
      var j = Y;
      return function() {
        var Z = Y;
        Y = j;
        try {
          return O.apply(this, arguments);
        } finally {
          Y = Z;
        }
      };
    };
  })(Cs)), Cs;
}
var Fd;
function $m() {
  return Fd || (Fd = 1, Ds.exports = km()), Ds.exports;
}
var _s = { exports: {} }, Vt = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Wd;
function Im() {
  if (Wd) return Vt;
  Wd = 1;
  var i = Bs();
  function s(A) {
    var g = "https://react.dev/errors/" + A;
    if (1 < arguments.length) {
      g += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var U = 2; U < arguments.length; U++)
        g += "&args[]=" + encodeURIComponent(arguments[U]);
    }
    return "Minified React error #" + A + "; visit " + g + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function r() {
  }
  var f = {
    d: {
      f: r,
      r: function() {
        throw Error(s(522));
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
  }, v = /* @__PURE__ */ Symbol.for("react.portal");
  function D(A, g, U) {
    var x = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: v,
      key: x == null ? null : "" + x,
      children: A,
      containerInfo: g,
      implementation: U
    };
  }
  var N = i.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function z(A, g) {
    if (A === "font") return "";
    if (typeof g == "string")
      return g === "use-credentials" ? g : "";
  }
  return Vt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = f, Vt.createPortal = function(A, g) {
    var U = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!g || g.nodeType !== 1 && g.nodeType !== 9 && g.nodeType !== 11)
      throw Error(s(299));
    return D(A, g, null, U);
  }, Vt.flushSync = function(A) {
    var g = N.T, U = f.p;
    try {
      if (N.T = null, f.p = 2, A) return A();
    } finally {
      N.T = g, f.p = U, f.d.f();
    }
  }, Vt.preconnect = function(A, g) {
    typeof A == "string" && (g ? (g = g.crossOrigin, g = typeof g == "string" ? g === "use-credentials" ? g : "" : void 0) : g = null, f.d.C(A, g));
  }, Vt.prefetchDNS = function(A) {
    typeof A == "string" && f.d.D(A);
  }, Vt.preinit = function(A, g) {
    if (typeof A == "string" && g && typeof g.as == "string") {
      var U = g.as, x = z(U, g.crossOrigin), Y = typeof g.integrity == "string" ? g.integrity : void 0, V = typeof g.fetchPriority == "string" ? g.fetchPriority : void 0;
      U === "style" ? f.d.S(
        A,
        typeof g.precedence == "string" ? g.precedence : void 0,
        {
          crossOrigin: x,
          integrity: Y,
          fetchPriority: V
        }
      ) : U === "script" && f.d.X(A, {
        crossOrigin: x,
        integrity: Y,
        fetchPriority: V,
        nonce: typeof g.nonce == "string" ? g.nonce : void 0
      });
    }
  }, Vt.preinitModule = function(A, g) {
    if (typeof A == "string")
      if (typeof g == "object" && g !== null) {
        if (g.as == null || g.as === "script") {
          var U = z(
            g.as,
            g.crossOrigin
          );
          f.d.M(A, {
            crossOrigin: U,
            integrity: typeof g.integrity == "string" ? g.integrity : void 0,
            nonce: typeof g.nonce == "string" ? g.nonce : void 0
          });
        }
      } else g == null && f.d.M(A);
  }, Vt.preload = function(A, g) {
    if (typeof A == "string" && typeof g == "object" && g !== null && typeof g.as == "string") {
      var U = g.as, x = z(U, g.crossOrigin);
      f.d.L(A, U, {
        crossOrigin: x,
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
  }, Vt.preloadModule = function(A, g) {
    if (typeof A == "string")
      if (g) {
        var U = z(g.as, g.crossOrigin);
        f.d.m(A, {
          as: typeof g.as == "string" && g.as !== "script" ? g.as : void 0,
          crossOrigin: U,
          integrity: typeof g.integrity == "string" ? g.integrity : void 0
        });
      } else f.d.m(A);
  }, Vt.requestFormReset = function(A) {
    f.d.r(A);
  }, Vt.unstable_batchedUpdates = function(A, g) {
    return A(g);
  }, Vt.useFormState = function(A, g, U) {
    return N.H.useFormState(A, g, U);
  }, Vt.useFormStatus = function() {
    return N.H.useHostTransitionStatus();
  }, Vt.version = "19.2.5", Vt;
}
var kd;
function Pm() {
  if (kd) return _s.exports;
  kd = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (s) {
        console.error(s);
      }
  }
  return i(), _s.exports = Im(), _s.exports;
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
var $d;
function tv() {
  if ($d) return _n;
  $d = 1;
  var i = $m(), s = Bs(), r = Pm();
  function f(t) {
    var e = "https://react.dev/errors/" + t;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var l = 2; l < arguments.length; l++)
        e += "&args[]=" + encodeURIComponent(arguments[l]);
    }
    return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function v(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function D(t) {
    var e = t, l = t;
    if (t.alternate) for (; e.return; ) e = e.return;
    else {
      t = e;
      do
        e = t, (e.flags & 4098) !== 0 && (l = e.return), t = e.return;
      while (t);
    }
    return e.tag === 3 ? l : null;
  }
  function N(t) {
    if (t.tag === 13) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function z(t) {
    if (t.tag === 31) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function A(t) {
    if (D(t) !== t)
      throw Error(f(188));
  }
  function g(t) {
    var e = t.alternate;
    if (!e) {
      if (e = D(t), e === null) throw Error(f(188));
      return e !== t ? null : t;
    }
    for (var l = t, a = e; ; ) {
      var n = l.return;
      if (n === null) break;
      var u = n.alternate;
      if (u === null) {
        if (a = n.return, a !== null) {
          l = a;
          continue;
        }
        break;
      }
      if (n.child === u.child) {
        for (u = n.child; u; ) {
          if (u === l) return A(n), t;
          if (u === a) return A(n), e;
          u = u.sibling;
        }
        throw Error(f(188));
      }
      if (l.return !== a.return) l = n, a = u;
      else {
        for (var c = !1, o = n.child; o; ) {
          if (o === l) {
            c = !0, l = n, a = u;
            break;
          }
          if (o === a) {
            c = !0, a = n, l = u;
            break;
          }
          o = o.sibling;
        }
        if (!c) {
          for (o = u.child; o; ) {
            if (o === l) {
              c = !0, l = u, a = n;
              break;
            }
            if (o === a) {
              c = !0, a = u, l = n;
              break;
            }
            o = o.sibling;
          }
          if (!c) throw Error(f(189));
        }
      }
      if (l.alternate !== a) throw Error(f(190));
    }
    if (l.tag !== 3) throw Error(f(188));
    return l.stateNode.current === l ? t : e;
  }
  function U(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t;
    for (t = t.child; t !== null; ) {
      if (e = U(t), e !== null) return e;
      t = t.sibling;
    }
    return null;
  }
  var x = Object.assign, Y = /* @__PURE__ */ Symbol.for("react.element"), V = /* @__PURE__ */ Symbol.for("react.transitional.element"), W = /* @__PURE__ */ Symbol.for("react.portal"), J = /* @__PURE__ */ Symbol.for("react.fragment"), P = /* @__PURE__ */ Symbol.for("react.strict_mode"), tt = /* @__PURE__ */ Symbol.for("react.profiler"), Et = /* @__PURE__ */ Symbol.for("react.consumer"), bt = /* @__PURE__ */ Symbol.for("react.context"), Ot = /* @__PURE__ */ Symbol.for("react.forward_ref"), K = /* @__PURE__ */ Symbol.for("react.suspense"), X = /* @__PURE__ */ Symbol.for("react.suspense_list"), G = /* @__PURE__ */ Symbol.for("react.memo"), Qt = /* @__PURE__ */ Symbol.for("react.lazy"), ne = /* @__PURE__ */ Symbol.for("react.activity"), De = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), ue = Symbol.iterator;
  function kt(t) {
    return t === null || typeof t != "object" ? null : (t = ue && t[ue] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var _l = /* @__PURE__ */ Symbol.for("react.client.reference");
  function Be(t) {
    if (t == null) return null;
    if (typeof t == "function")
      return t.$$typeof === _l ? null : t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case J:
        return "Fragment";
      case tt:
        return "Profiler";
      case P:
        return "StrictMode";
      case K:
        return "Suspense";
      case X:
        return "SuspenseList";
      case ne:
        return "Activity";
    }
    if (typeof t == "object")
      switch (t.$$typeof) {
        case W:
          return "Portal";
        case bt:
          return t.displayName || "Context";
        case Et:
          return (t._context.displayName || "Context") + ".Consumer";
        case Ot:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case G:
          return e = t.displayName || null, e !== null ? e : Be(t.type) || "Memo";
        case Qt:
          e = t._payload, t = t._init;
          try {
            return Be(t(e));
          } catch {
          }
      }
    return null;
  }
  var Ce = Array.isArray, O = s.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, j = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, Z = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, ht = [], gt = -1;
  function y(t) {
    return { current: t };
  }
  function M(t) {
    0 > gt || (t.current = ht[gt], ht[gt] = null, gt--);
  }
  function H(t, e) {
    gt++, ht[gt] = t.current, t.current = e;
  }
  var B = y(null), k = y(null), et = y(null), ot = y(null);
  function Kt(t, e) {
    switch (H(et, e), H(k, t), H(B, null), e.nodeType) {
      case 9:
      case 11:
        t = (t = e.documentElement) && (t = t.namespaceURI) ? dd(t) : 0;
        break;
      default:
        if (t = e.tagName, e = e.namespaceURI)
          e = dd(e), t = hd(e, t);
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
    M(B), H(B, t);
  }
  function _t() {
    M(B), M(k), M(et);
  }
  function xa(t) {
    t.memoizedState !== null && H(ot, t);
    var e = B.current, l = hd(e, t.type);
    e !== l && (H(k, t), H(B, l));
  }
  function jn(t) {
    k.current === t && (M(B), M(k)), ot.current === t && (M(ot), Tn._currentValue = Z);
  }
  var ui, Ys;
  function Ml(t) {
    if (ui === void 0)
      try {
        throw Error();
      } catch (l) {
        var e = l.stack.trim().match(/\n( *(at )?)/);
        ui = e && e[1] || "", Ys = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + ui + t + Ys;
  }
  var ii = !1;
  function ci(t, e) {
    if (!t || ii) return "";
    ii = !0;
    var l = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var a = {
        DetermineComponentFrameRoot: function() {
          try {
            if (e) {
              var _ = function() {
                throw Error();
              };
              if (Object.defineProperty(_.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(_, []);
                } catch (E) {
                  var b = E;
                }
                Reflect.construct(t, [], _);
              } else {
                try {
                  _.call();
                } catch (E) {
                  b = E;
                }
                t.call(_.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (E) {
                b = E;
              }
              (_ = t()) && typeof _.catch == "function" && _.catch(function() {
              });
            }
          } catch (E) {
            if (E && b && typeof E.stack == "string")
              return [E.stack, b.stack];
          }
          return [null, null];
        }
      };
      a.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
      var n = Object.getOwnPropertyDescriptor(
        a.DetermineComponentFrameRoot,
        "name"
      );
      n && n.configurable && Object.defineProperty(
        a.DetermineComponentFrameRoot,
        "name",
        { value: "DetermineComponentFrameRoot" }
      );
      var u = a.DetermineComponentFrameRoot(), c = u[0], o = u[1];
      if (c && o) {
        var d = c.split(`
`), S = o.split(`
`);
        for (n = a = 0; a < d.length && !d[a].includes("DetermineComponentFrameRoot"); )
          a++;
        for (; n < S.length && !S[n].includes(
          "DetermineComponentFrameRoot"
        ); )
          n++;
        if (a === d.length || n === S.length)
          for (a = d.length - 1, n = S.length - 1; 1 <= a && 0 <= n && d[a] !== S[n]; )
            n--;
        for (; 1 <= a && 0 <= n; a--, n--)
          if (d[a] !== S[n]) {
            if (a !== 1 || n !== 1)
              do
                if (a--, n--, 0 > n || d[a] !== S[n]) {
                  var T = `
` + d[a].replace(" at new ", " at ");
                  return t.displayName && T.includes("<anonymous>") && (T = T.replace("<anonymous>", t.displayName)), T;
                }
              while (1 <= a && 0 <= n);
            break;
          }
      }
    } finally {
      ii = !1, Error.prepareStackTrace = l;
    }
    return (l = t ? t.displayName || t.name : "") ? Ml(l) : "";
  }
  function zh(t, e) {
    switch (t.tag) {
      case 26:
      case 27:
      case 5:
        return Ml(t.type);
      case 16:
        return Ml("Lazy");
      case 13:
        return t.child !== e && e !== null ? Ml("Suspense Fallback") : Ml("Suspense");
      case 19:
        return Ml("SuspenseList");
      case 0:
      case 15:
        return ci(t.type, !1);
      case 11:
        return ci(t.type.render, !1);
      case 1:
        return ci(t.type, !0);
      case 31:
        return Ml("Activity");
      default:
        return "";
    }
  }
  function Gs(t) {
    try {
      var e = "", l = null;
      do
        e += zh(t, l), l = t, t = t.return;
      while (t);
      return e;
    } catch (a) {
      return `
Error generating stack: ` + a.message + `
` + a.stack;
    }
  }
  var si = Object.prototype.hasOwnProperty, fi = i.unstable_scheduleCallback, oi = i.unstable_cancelCallback, Oh = i.unstable_shouldYield, Dh = i.unstable_requestPaint, ie = i.unstable_now, Ch = i.unstable_getCurrentPriorityLevel, Ls = i.unstable_ImmediatePriority, Xs = i.unstable_UserBlockingPriority, Hn = i.unstable_NormalPriority, _h = i.unstable_LowPriority, Zs = i.unstable_IdlePriority, Mh = i.log, Nh = i.unstable_setDisableYieldValue, ja = null, ce = null;
  function al(t) {
    if (typeof Mh == "function" && Nh(t), ce && typeof ce.setStrictMode == "function")
      try {
        ce.setStrictMode(ja, t);
      } catch {
      }
  }
  var se = Math.clz32 ? Math.clz32 : xh, Rh = Math.log, Uh = Math.LN2;
  function xh(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (Rh(t) / Uh | 0) | 0;
  }
  var qn = 256, Bn = 262144, wn = 4194304;
  function Nl(t) {
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
  function Qn(t, e, l) {
    var a = t.pendingLanes;
    if (a === 0) return 0;
    var n = 0, u = t.suspendedLanes, c = t.pingedLanes;
    t = t.warmLanes;
    var o = a & 134217727;
    return o !== 0 ? (a = o & ~u, a !== 0 ? n = Nl(a) : (c &= o, c !== 0 ? n = Nl(c) : l || (l = o & ~t, l !== 0 && (n = Nl(l))))) : (o = a & ~u, o !== 0 ? n = Nl(o) : c !== 0 ? n = Nl(c) : l || (l = a & ~t, l !== 0 && (n = Nl(l)))), n === 0 ? 0 : e !== 0 && e !== n && (e & u) === 0 && (u = n & -n, l = e & -e, u >= l || u === 32 && (l & 4194048) !== 0) ? e : n;
  }
  function Ha(t, e) {
    return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
  }
  function jh(t, e) {
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
  function Vs() {
    var t = wn;
    return wn <<= 1, (wn & 62914560) === 0 && (wn = 4194304), t;
  }
  function ri(t) {
    for (var e = [], l = 0; 31 > l; l++) e.push(t);
    return e;
  }
  function qa(t, e) {
    t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
  }
  function Hh(t, e, l, a, n, u) {
    var c = t.pendingLanes;
    t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
    var o = t.entanglements, d = t.expirationTimes, S = t.hiddenUpdates;
    for (l = c & ~l; 0 < l; ) {
      var T = 31 - se(l), _ = 1 << T;
      o[T] = 0, d[T] = -1;
      var b = S[T];
      if (b !== null)
        for (S[T] = null, T = 0; T < b.length; T++) {
          var E = b[T];
          E !== null && (E.lane &= -536870913);
        }
      l &= ~_;
    }
    a !== 0 && Ks(t, a, 0), u !== 0 && n === 0 && t.tag !== 0 && (t.suspendedLanes |= u & ~(c & ~e));
  }
  function Ks(t, e, l) {
    t.pendingLanes |= e, t.suspendedLanes &= ~e;
    var a = 31 - se(e);
    t.entangledLanes |= e, t.entanglements[a] = t.entanglements[a] | 1073741824 | l & 261930;
  }
  function Js(t, e) {
    var l = t.entangledLanes |= e;
    for (t = t.entanglements; l; ) {
      var a = 31 - se(l), n = 1 << a;
      n & e | t[a] & e && (t[a] |= e), l &= ~n;
    }
  }
  function Fs(t, e) {
    var l = e & -e;
    return l = (l & 42) !== 0 ? 1 : di(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
  }
  function di(t) {
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
  function hi(t) {
    return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function Ws() {
    var t = j.p;
    return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : qd(t.type));
  }
  function ks(t, e) {
    var l = j.p;
    try {
      return j.p = t, e();
    } finally {
      j.p = l;
    }
  }
  var nl = Math.random().toString(36).slice(2), Yt = "__reactFiber$" + nl, $t = "__reactProps$" + nl, Fl = "__reactContainer$" + nl, yi = "__reactEvents$" + nl, qh = "__reactListeners$" + nl, Bh = "__reactHandles$" + nl, $s = "__reactResources$" + nl, Ba = "__reactMarker$" + nl;
  function mi(t) {
    delete t[Yt], delete t[$t], delete t[yi], delete t[qh], delete t[Bh];
  }
  function Wl(t) {
    var e = t[Yt];
    if (e) return e;
    for (var l = t.parentNode; l; ) {
      if (e = l[Fl] || l[Yt]) {
        if (l = e.alternate, e.child !== null || l !== null && l.child !== null)
          for (t = bd(t); t !== null; ) {
            if (l = t[Yt]) return l;
            t = bd(t);
          }
        return e;
      }
      t = l, l = t.parentNode;
    }
    return null;
  }
  function kl(t) {
    if (t = t[Yt] || t[Fl]) {
      var e = t.tag;
      if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3)
        return t;
    }
    return null;
  }
  function wa(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
    throw Error(f(33));
  }
  function $l(t) {
    var e = t[$s];
    return e || (e = t[$s] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), e;
  }
  function Bt(t) {
    t[Ba] = !0;
  }
  var Is = /* @__PURE__ */ new Set(), Ps = {};
  function Rl(t, e) {
    Il(t, e), Il(t + "Capture", e);
  }
  function Il(t, e) {
    for (Ps[t] = e, t = 0; t < e.length; t++)
      Is.add(e[t]);
  }
  var wh = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), tf = {}, ef = {};
  function Qh(t) {
    return si.call(ef, t) ? !0 : si.call(tf, t) ? !1 : wh.test(t) ? ef[t] = !0 : (tf[t] = !0, !1);
  }
  function Yn(t, e, l) {
    if (Qh(e))
      if (l === null) t.removeAttribute(e);
      else {
        switch (typeof l) {
          case "undefined":
          case "function":
          case "symbol":
            t.removeAttribute(e);
            return;
          case "boolean":
            var a = e.toLowerCase().slice(0, 5);
            if (a !== "data-" && a !== "aria-") {
              t.removeAttribute(e);
              return;
            }
        }
        t.setAttribute(e, "" + l);
      }
  }
  function Gn(t, e, l) {
    if (l === null) t.removeAttribute(e);
    else {
      switch (typeof l) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(e);
          return;
      }
      t.setAttribute(e, "" + l);
    }
  }
  function we(t, e, l, a) {
    if (a === null) t.removeAttribute(l);
    else {
      switch (typeof a) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean":
          t.removeAttribute(l);
          return;
      }
      t.setAttributeNS(e, l, "" + a);
    }
  }
  function ve(t) {
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
  function lf(t) {
    var e = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
  }
  function Yh(t, e, l) {
    var a = Object.getOwnPropertyDescriptor(
      t.constructor.prototype,
      e
    );
    if (!t.hasOwnProperty(e) && typeof a < "u" && typeof a.get == "function" && typeof a.set == "function") {
      var n = a.get, u = a.set;
      return Object.defineProperty(t, e, {
        configurable: !0,
        get: function() {
          return n.call(this);
        },
        set: function(c) {
          l = "" + c, u.call(this, c);
        }
      }), Object.defineProperty(t, e, {
        enumerable: a.enumerable
      }), {
        getValue: function() {
          return l;
        },
        setValue: function(c) {
          l = "" + c;
        },
        stopTracking: function() {
          t._valueTracker = null, delete t[e];
        }
      };
    }
  }
  function vi(t) {
    if (!t._valueTracker) {
      var e = lf(t) ? "checked" : "value";
      t._valueTracker = Yh(
        t,
        e,
        "" + t[e]
      );
    }
  }
  function af(t) {
    if (!t) return !1;
    var e = t._valueTracker;
    if (!e) return !0;
    var l = e.getValue(), a = "";
    return t && (a = lf(t) ? t.checked ? "true" : "false" : t.value), t = a, t !== l ? (e.setValue(t), !0) : !1;
  }
  function Ln(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  var Gh = /[\n"\\]/g;
  function ge(t) {
    return t.replace(
      Gh,
      function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function gi(t, e, l, a, n, u, c, o) {
    t.name = "", c != null && typeof c != "function" && typeof c != "symbol" && typeof c != "boolean" ? t.type = c : t.removeAttribute("type"), e != null ? c === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + ve(e)) : t.value !== "" + ve(e) && (t.value = "" + ve(e)) : c !== "submit" && c !== "reset" || t.removeAttribute("value"), e != null ? pi(t, c, ve(e)) : l != null ? pi(t, c, ve(l)) : a != null && t.removeAttribute("value"), n == null && u != null && (t.defaultChecked = !!u), n != null && (t.checked = n && typeof n != "function" && typeof n != "symbol"), o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? t.name = "" + ve(o) : t.removeAttribute("name");
  }
  function nf(t, e, l, a, n, u, c, o) {
    if (u != null && typeof u != "function" && typeof u != "symbol" && typeof u != "boolean" && (t.type = u), e != null || l != null) {
      if (!(u !== "submit" && u !== "reset" || e != null)) {
        vi(t);
        return;
      }
      l = l != null ? "" + ve(l) : "", e = e != null ? "" + ve(e) : l, o || e === t.value || (t.value = e), t.defaultValue = e;
    }
    a = a ?? n, a = typeof a != "function" && typeof a != "symbol" && !!a, t.checked = o ? t.checked : !!a, t.defaultChecked = !!a, c != null && typeof c != "function" && typeof c != "symbol" && typeof c != "boolean" && (t.name = c), vi(t);
  }
  function pi(t, e, l) {
    e === "number" && Ln(t.ownerDocument) === t || t.defaultValue === "" + l || (t.defaultValue = "" + l);
  }
  function Pl(t, e, l, a) {
    if (t = t.options, e) {
      e = {};
      for (var n = 0; n < l.length; n++)
        e["$" + l[n]] = !0;
      for (l = 0; l < t.length; l++)
        n = e.hasOwnProperty("$" + t[l].value), t[l].selected !== n && (t[l].selected = n), n && a && (t[l].defaultSelected = !0);
    } else {
      for (l = "" + ve(l), e = null, n = 0; n < t.length; n++) {
        if (t[n].value === l) {
          t[n].selected = !0, a && (t[n].defaultSelected = !0);
          return;
        }
        e !== null || t[n].disabled || (e = t[n]);
      }
      e !== null && (e.selected = !0);
    }
  }
  function uf(t, e, l) {
    if (e != null && (e = "" + ve(e), e !== t.value && (t.value = e), l == null)) {
      t.defaultValue !== e && (t.defaultValue = e);
      return;
    }
    t.defaultValue = l != null ? "" + ve(l) : "";
  }
  function cf(t, e, l, a) {
    if (e == null) {
      if (a != null) {
        if (l != null) throw Error(f(92));
        if (Ce(a)) {
          if (1 < a.length) throw Error(f(93));
          a = a[0];
        }
        l = a;
      }
      l == null && (l = ""), e = l;
    }
    l = ve(e), t.defaultValue = l, a = t.textContent, a === l && a !== "" && a !== null && (t.value = a), vi(t);
  }
  function ta(t, e) {
    if (e) {
      var l = t.firstChild;
      if (l && l === t.lastChild && l.nodeType === 3) {
        l.nodeValue = e;
        return;
      }
    }
    t.textContent = e;
  }
  var Lh = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function sf(t, e, l) {
    var a = e.indexOf("--") === 0;
    l == null || typeof l == "boolean" || l === "" ? a ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : a ? t.setProperty(e, l) : typeof l != "number" || l === 0 || Lh.has(e) ? e === "float" ? t.cssFloat = l : t[e] = ("" + l).trim() : t[e] = l + "px";
  }
  function ff(t, e, l) {
    if (e != null && typeof e != "object")
      throw Error(f(62));
    if (t = t.style, l != null) {
      for (var a in l)
        !l.hasOwnProperty(a) || e != null && e.hasOwnProperty(a) || (a.indexOf("--") === 0 ? t.setProperty(a, "") : a === "float" ? t.cssFloat = "" : t[a] = "");
      for (var n in e)
        a = e[n], e.hasOwnProperty(n) && l[n] !== a && sf(t, n, a);
    } else
      for (var u in e)
        e.hasOwnProperty(u) && sf(t, u, e[u]);
  }
  function Si(t) {
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
  var Xh = /* @__PURE__ */ new Map([
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
  ]), Zh = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function Xn(t) {
    return Zh.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
  }
  function Qe() {
  }
  var bi = null;
  function Ei(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var ea = null, la = null;
  function of(t) {
    var e = kl(t);
    if (e && (t = e.stateNode)) {
      var l = t[$t] || null;
      t: switch (t = e.stateNode, e.type) {
        case "input":
          if (gi(
            t,
            l.value,
            l.defaultValue,
            l.defaultValue,
            l.checked,
            l.defaultChecked,
            l.type,
            l.name
          ), e = l.name, l.type === "radio" && e != null) {
            for (l = t; l.parentNode; ) l = l.parentNode;
            for (l = l.querySelectorAll(
              'input[name="' + ge(
                "" + e
              ) + '"][type="radio"]'
            ), e = 0; e < l.length; e++) {
              var a = l[e];
              if (a !== t && a.form === t.form) {
                var n = a[$t] || null;
                if (!n) throw Error(f(90));
                gi(
                  a,
                  n.value,
                  n.defaultValue,
                  n.defaultValue,
                  n.checked,
                  n.defaultChecked,
                  n.type,
                  n.name
                );
              }
            }
            for (e = 0; e < l.length; e++)
              a = l[e], a.form === t.form && af(a);
          }
          break t;
        case "textarea":
          uf(t, l.value, l.defaultValue);
          break t;
        case "select":
          e = l.value, e != null && Pl(t, !!l.multiple, e, !1);
      }
    }
  }
  var Ai = !1;
  function rf(t, e, l) {
    if (Ai) return t(e, l);
    Ai = !0;
    try {
      var a = t(e);
      return a;
    } finally {
      if (Ai = !1, (ea !== null || la !== null) && (Nu(), ea && (e = ea, t = la, la = ea = null, of(e), t)))
        for (e = 0; e < t.length; e++) of(t[e]);
    }
  }
  function Qa(t, e) {
    var l = t.stateNode;
    if (l === null) return null;
    var a = l[$t] || null;
    if (a === null) return null;
    l = a[e];
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
        (a = !a.disabled) || (t = t.type, a = !(t === "button" || t === "input" || t === "select" || t === "textarea")), t = !a;
        break t;
      default:
        t = !1;
    }
    if (t) return null;
    if (l && typeof l != "function")
      throw Error(
        f(231, e, typeof l)
      );
    return l;
  }
  var Ye = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Ti = !1;
  if (Ye)
    try {
      var Ya = {};
      Object.defineProperty(Ya, "passive", {
        get: function() {
          Ti = !0;
        }
      }), window.addEventListener("test", Ya, Ya), window.removeEventListener("test", Ya, Ya);
    } catch {
      Ti = !1;
    }
  var ul = null, zi = null, Zn = null;
  function df() {
    if (Zn) return Zn;
    var t, e = zi, l = e.length, a, n = "value" in ul ? ul.value : ul.textContent, u = n.length;
    for (t = 0; t < l && e[t] === n[t]; t++) ;
    var c = l - t;
    for (a = 1; a <= c && e[l - a] === n[u - a]; a++) ;
    return Zn = n.slice(t, 1 < a ? 1 - a : void 0);
  }
  function Vn(t) {
    var e = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function Kn() {
    return !0;
  }
  function hf() {
    return !1;
  }
  function It(t) {
    function e(l, a, n, u, c) {
      this._reactName = l, this._targetInst = n, this.type = a, this.nativeEvent = u, this.target = c, this.currentTarget = null;
      for (var o in t)
        t.hasOwnProperty(o) && (l = t[o], this[o] = l ? l(u) : u[o]);
      return this.isDefaultPrevented = (u.defaultPrevented != null ? u.defaultPrevented : u.returnValue === !1) ? Kn : hf, this.isPropagationStopped = hf, this;
    }
    return x(e.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var l = this.nativeEvent;
        l && (l.preventDefault ? l.preventDefault() : typeof l.returnValue != "unknown" && (l.returnValue = !1), this.isDefaultPrevented = Kn);
      },
      stopPropagation: function() {
        var l = this.nativeEvent;
        l && (l.stopPropagation ? l.stopPropagation() : typeof l.cancelBubble != "unknown" && (l.cancelBubble = !0), this.isPropagationStopped = Kn);
      },
      persist: function() {
      },
      isPersistent: Kn
    }), e;
  }
  var Ul = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function(t) {
      return t.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0
  }, Jn = It(Ul), Ga = x({}, Ul, { view: 0, detail: 0 }), Vh = It(Ga), Oi, Di, La, Fn = x({}, Ga, {
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
    getModifierState: _i,
    button: 0,
    buttons: 0,
    relatedTarget: function(t) {
      return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
    },
    movementX: function(t) {
      return "movementX" in t ? t.movementX : (t !== La && (La && t.type === "mousemove" ? (Oi = t.screenX - La.screenX, Di = t.screenY - La.screenY) : Di = Oi = 0, La = t), Oi);
    },
    movementY: function(t) {
      return "movementY" in t ? t.movementY : Di;
    }
  }), yf = It(Fn), Kh = x({}, Fn, { dataTransfer: 0 }), Jh = It(Kh), Fh = x({}, Ga, { relatedTarget: 0 }), Ci = It(Fh), Wh = x({}, Ul, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), kh = It(Wh), $h = x({}, Ul, {
    clipboardData: function(t) {
      return "clipboardData" in t ? t.clipboardData : window.clipboardData;
    }
  }), Ih = It($h), Ph = x({}, Ul, { data: 0 }), mf = It(Ph), ty = {
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
  }, ey = {
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
  }, ly = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function ay(t) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(t) : (t = ly[t]) ? !!e[t] : !1;
  }
  function _i() {
    return ay;
  }
  var ny = x({}, Ga, {
    key: function(t) {
      if (t.key) {
        var e = ty[t.key] || t.key;
        if (e !== "Unidentified") return e;
      }
      return t.type === "keypress" ? (t = Vn(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? ey[t.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: _i,
    charCode: function(t) {
      return t.type === "keypress" ? Vn(t) : 0;
    },
    keyCode: function(t) {
      return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    },
    which: function(t) {
      return t.type === "keypress" ? Vn(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    }
  }), uy = It(ny), iy = x({}, Fn, {
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
  }), vf = It(iy), cy = x({}, Ga, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: _i
  }), sy = It(cy), fy = x({}, Ul, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), oy = It(fy), ry = x({}, Fn, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), dy = It(ry), hy = x({}, Ul, {
    newState: 0,
    oldState: 0
  }), yy = It(hy), my = [9, 13, 27, 32], Mi = Ye && "CompositionEvent" in window, Xa = null;
  Ye && "documentMode" in document && (Xa = document.documentMode);
  var vy = Ye && "TextEvent" in window && !Xa, gf = Ye && (!Mi || Xa && 8 < Xa && 11 >= Xa), pf = " ", Sf = !1;
  function bf(t, e) {
    switch (t) {
      case "keyup":
        return my.indexOf(e.keyCode) !== -1;
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
  function Ef(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var aa = !1;
  function gy(t, e) {
    switch (t) {
      case "compositionend":
        return Ef(e);
      case "keypress":
        return e.which !== 32 ? null : (Sf = !0, pf);
      case "textInput":
        return t = e.data, t === pf && Sf ? null : t;
      default:
        return null;
    }
  }
  function py(t, e) {
    if (aa)
      return t === "compositionend" || !Mi && bf(t, e) ? (t = df(), Zn = zi = ul = null, aa = !1, t) : null;
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
        return gf && e.locale !== "ko" ? null : e.data;
      default:
        return null;
    }
  }
  var Sy = {
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
  function Af(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e === "input" ? !!Sy[t.type] : e === "textarea";
  }
  function Tf(t, e, l, a) {
    ea ? la ? la.push(a) : la = [a] : ea = a, e = Bu(e, "onChange"), 0 < e.length && (l = new Jn(
      "onChange",
      "change",
      null,
      l,
      a
    ), t.push({ event: l, listeners: e }));
  }
  var Za = null, Va = null;
  function by(t) {
    id(t, 0);
  }
  function Wn(t) {
    var e = wa(t);
    if (af(e)) return t;
  }
  function zf(t, e) {
    if (t === "change") return e;
  }
  var Of = !1;
  if (Ye) {
    var Ni;
    if (Ye) {
      var Ri = "oninput" in document;
      if (!Ri) {
        var Df = document.createElement("div");
        Df.setAttribute("oninput", "return;"), Ri = typeof Df.oninput == "function";
      }
      Ni = Ri;
    } else Ni = !1;
    Of = Ni && (!document.documentMode || 9 < document.documentMode);
  }
  function Cf() {
    Za && (Za.detachEvent("onpropertychange", _f), Va = Za = null);
  }
  function _f(t) {
    if (t.propertyName === "value" && Wn(Va)) {
      var e = [];
      Tf(
        e,
        Va,
        t,
        Ei(t)
      ), rf(by, e);
    }
  }
  function Ey(t, e, l) {
    t === "focusin" ? (Cf(), Za = e, Va = l, Za.attachEvent("onpropertychange", _f)) : t === "focusout" && Cf();
  }
  function Ay(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown")
      return Wn(Va);
  }
  function Ty(t, e) {
    if (t === "click") return Wn(e);
  }
  function zy(t, e) {
    if (t === "input" || t === "change")
      return Wn(e);
  }
  function Oy(t, e) {
    return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
  }
  var fe = typeof Object.is == "function" ? Object.is : Oy;
  function Ka(t, e) {
    if (fe(t, e)) return !0;
    if (typeof t != "object" || t === null || typeof e != "object" || e === null)
      return !1;
    var l = Object.keys(t), a = Object.keys(e);
    if (l.length !== a.length) return !1;
    for (a = 0; a < l.length; a++) {
      var n = l[a];
      if (!si.call(e, n) || !fe(t[n], e[n]))
        return !1;
    }
    return !0;
  }
  function Mf(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function Nf(t, e) {
    var l = Mf(t);
    t = 0;
    for (var a; l; ) {
      if (l.nodeType === 3) {
        if (a = t + l.textContent.length, t <= e && a >= e)
          return { node: l, offset: e - t };
        t = a;
      }
      t: {
        for (; l; ) {
          if (l.nextSibling) {
            l = l.nextSibling;
            break t;
          }
          l = l.parentNode;
        }
        l = void 0;
      }
      l = Mf(l);
    }
  }
  function Rf(t, e) {
    return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? Rf(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
  }
  function Uf(t) {
    t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
    for (var e = Ln(t.document); e instanceof t.HTMLIFrameElement; ) {
      try {
        var l = typeof e.contentWindow.location.href == "string";
      } catch {
        l = !1;
      }
      if (l) t = e.contentWindow;
      else break;
      e = Ln(t.document);
    }
    return e;
  }
  function Ui(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
  }
  var Dy = Ye && "documentMode" in document && 11 >= document.documentMode, na = null, xi = null, Ja = null, ji = !1;
  function xf(t, e, l) {
    var a = l.window === l ? l.document : l.nodeType === 9 ? l : l.ownerDocument;
    ji || na == null || na !== Ln(a) || (a = na, "selectionStart" in a && Ui(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = {
      anchorNode: a.anchorNode,
      anchorOffset: a.anchorOffset,
      focusNode: a.focusNode,
      focusOffset: a.focusOffset
    }), Ja && Ka(Ja, a) || (Ja = a, a = Bu(xi, "onSelect"), 0 < a.length && (e = new Jn(
      "onSelect",
      "select",
      null,
      e,
      l
    ), t.push({ event: e, listeners: a }), e.target = na)));
  }
  function xl(t, e) {
    var l = {};
    return l[t.toLowerCase()] = e.toLowerCase(), l["Webkit" + t] = "webkit" + e, l["Moz" + t] = "moz" + e, l;
  }
  var ua = {
    animationend: xl("Animation", "AnimationEnd"),
    animationiteration: xl("Animation", "AnimationIteration"),
    animationstart: xl("Animation", "AnimationStart"),
    transitionrun: xl("Transition", "TransitionRun"),
    transitionstart: xl("Transition", "TransitionStart"),
    transitioncancel: xl("Transition", "TransitionCancel"),
    transitionend: xl("Transition", "TransitionEnd")
  }, Hi = {}, jf = {};
  Ye && (jf = document.createElement("div").style, "AnimationEvent" in window || (delete ua.animationend.animation, delete ua.animationiteration.animation, delete ua.animationstart.animation), "TransitionEvent" in window || delete ua.transitionend.transition);
  function jl(t) {
    if (Hi[t]) return Hi[t];
    if (!ua[t]) return t;
    var e = ua[t], l;
    for (l in e)
      if (e.hasOwnProperty(l) && l in jf)
        return Hi[t] = e[l];
    return t;
  }
  var Hf = jl("animationend"), qf = jl("animationiteration"), Bf = jl("animationstart"), Cy = jl("transitionrun"), _y = jl("transitionstart"), My = jl("transitioncancel"), wf = jl("transitionend"), Qf = /* @__PURE__ */ new Map(), qi = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  qi.push("scrollEnd");
  function _e(t, e) {
    Qf.set(t, e), Rl(e, [t]);
  }
  var kn = typeof reportError == "function" ? reportError : function(t) {
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
  }, pe = [], ia = 0, Bi = 0;
  function $n() {
    for (var t = ia, e = Bi = ia = 0; e < t; ) {
      var l = pe[e];
      pe[e++] = null;
      var a = pe[e];
      pe[e++] = null;
      var n = pe[e];
      pe[e++] = null;
      var u = pe[e];
      if (pe[e++] = null, a !== null && n !== null) {
        var c = a.pending;
        c === null ? n.next = n : (n.next = c.next, c.next = n), a.pending = n;
      }
      u !== 0 && Yf(l, n, u);
    }
  }
  function In(t, e, l, a) {
    pe[ia++] = t, pe[ia++] = e, pe[ia++] = l, pe[ia++] = a, Bi |= a, t.lanes |= a, t = t.alternate, t !== null && (t.lanes |= a);
  }
  function wi(t, e, l, a) {
    return In(t, e, l, a), Pn(t);
  }
  function Hl(t, e) {
    return In(t, null, null, e), Pn(t);
  }
  function Yf(t, e, l) {
    t.lanes |= l;
    var a = t.alternate;
    a !== null && (a.lanes |= l);
    for (var n = !1, u = t.return; u !== null; )
      u.childLanes |= l, a = u.alternate, a !== null && (a.childLanes |= l), u.tag === 22 && (t = u.stateNode, t === null || t._visibility & 1 || (n = !0)), t = u, u = u.return;
    return t.tag === 3 ? (u = t.stateNode, n && e !== null && (n = 31 - se(l), t = u.hiddenUpdates, a = t[n], a === null ? t[n] = [e] : a.push(e), e.lane = l | 536870912), u) : null;
  }
  function Pn(t) {
    if (50 < vn)
      throw vn = 0, Jc = null, Error(f(185));
    for (var e = t.return; e !== null; )
      t = e, e = t.return;
    return t.tag === 3 ? t.stateNode : null;
  }
  var ca = {};
  function Ny(t, e, l, a) {
    this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function oe(t, e, l, a) {
    return new Ny(t, e, l, a);
  }
  function Qi(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function Ge(t, e) {
    var l = t.alternate;
    return l === null ? (l = oe(
      t.tag,
      e,
      t.key,
      t.mode
    ), l.elementType = t.elementType, l.type = t.type, l.stateNode = t.stateNode, l.alternate = t, t.alternate = l) : (l.pendingProps = e, l.type = t.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = t.flags & 65011712, l.childLanes = t.childLanes, l.lanes = t.lanes, l.child = t.child, l.memoizedProps = t.memoizedProps, l.memoizedState = t.memoizedState, l.updateQueue = t.updateQueue, e = t.dependencies, l.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, l.sibling = t.sibling, l.index = t.index, l.ref = t.ref, l.refCleanup = t.refCleanup, l;
  }
  function Gf(t, e) {
    t.flags &= 65011714;
    var l = t.alternate;
    return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
      lanes: e.lanes,
      firstContext: e.firstContext
    }), t;
  }
  function tu(t, e, l, a, n, u) {
    var c = 0;
    if (a = t, typeof t == "function") Qi(t) && (c = 1);
    else if (typeof t == "string")
      c = Hm(
        t,
        l,
        B.current
      ) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
    else
      t: switch (t) {
        case ne:
          return t = oe(31, l, e, n), t.elementType = ne, t.lanes = u, t;
        case J:
          return ql(l.children, n, u, e);
        case P:
          c = 8, n |= 24;
          break;
        case tt:
          return t = oe(12, l, e, n | 2), t.elementType = tt, t.lanes = u, t;
        case K:
          return t = oe(13, l, e, n), t.elementType = K, t.lanes = u, t;
        case X:
          return t = oe(19, l, e, n), t.elementType = X, t.lanes = u, t;
        default:
          if (typeof t == "object" && t !== null)
            switch (t.$$typeof) {
              case bt:
                c = 10;
                break t;
              case Et:
                c = 9;
                break t;
              case Ot:
                c = 11;
                break t;
              case G:
                c = 14;
                break t;
              case Qt:
                c = 16, a = null;
                break t;
            }
          c = 29, l = Error(
            f(130, t === null ? "null" : typeof t, "")
          ), a = null;
      }
    return e = oe(c, l, e, n), e.elementType = t, e.type = a, e.lanes = u, e;
  }
  function ql(t, e, l, a) {
    return t = oe(7, t, a, e), t.lanes = l, t;
  }
  function Yi(t, e, l) {
    return t = oe(6, t, null, e), t.lanes = l, t;
  }
  function Lf(t) {
    var e = oe(18, null, null, 0);
    return e.stateNode = t, e;
  }
  function Gi(t, e, l) {
    return e = oe(
      4,
      t.children !== null ? t.children : [],
      t.key,
      e
    ), e.lanes = l, e.stateNode = {
      containerInfo: t.containerInfo,
      pendingChildren: null,
      implementation: t.implementation
    }, e;
  }
  var Xf = /* @__PURE__ */ new WeakMap();
  function Se(t, e) {
    if (typeof t == "object" && t !== null) {
      var l = Xf.get(t);
      return l !== void 0 ? l : (e = {
        value: t,
        source: e,
        stack: Gs(e)
      }, Xf.set(t, e), e);
    }
    return {
      value: t,
      source: e,
      stack: Gs(e)
    };
  }
  var sa = [], fa = 0, eu = null, Fa = 0, be = [], Ee = 0, il = null, Ue = 1, xe = "";
  function Le(t, e) {
    sa[fa++] = Fa, sa[fa++] = eu, eu = t, Fa = e;
  }
  function Zf(t, e, l) {
    be[Ee++] = Ue, be[Ee++] = xe, be[Ee++] = il, il = t;
    var a = Ue;
    t = xe;
    var n = 32 - se(a) - 1;
    a &= ~(1 << n), l += 1;
    var u = 32 - se(e) + n;
    if (30 < u) {
      var c = n - n % 5;
      u = (a & (1 << c) - 1).toString(32), a >>= c, n -= c, Ue = 1 << 32 - se(e) + n | l << n | a, xe = u + t;
    } else
      Ue = 1 << u | l << n | a, xe = t;
  }
  function Li(t) {
    t.return !== null && (Le(t, 1), Zf(t, 1, 0));
  }
  function Xi(t) {
    for (; t === eu; )
      eu = sa[--fa], sa[fa] = null, Fa = sa[--fa], sa[fa] = null;
    for (; t === il; )
      il = be[--Ee], be[Ee] = null, xe = be[--Ee], be[Ee] = null, Ue = be[--Ee], be[Ee] = null;
  }
  function Vf(t, e) {
    be[Ee++] = Ue, be[Ee++] = xe, be[Ee++] = il, Ue = e.id, xe = e.overflow, il = t;
  }
  var Gt = null, At = null, it = !1, cl = null, Ae = !1, Zi = Error(f(519));
  function sl(t) {
    var e = Error(
      f(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw Wa(Se(e, t)), Zi;
  }
  function Kf(t) {
    var e = t.stateNode, l = t.type, a = t.memoizedProps;
    switch (e[Yt] = t, e[$t] = a, l) {
      case "dialog":
        at("cancel", e), at("close", e);
        break;
      case "iframe":
      case "object":
      case "embed":
        at("load", e);
        break;
      case "video":
      case "audio":
        for (l = 0; l < pn.length; l++)
          at(pn[l], e);
        break;
      case "source":
        at("error", e);
        break;
      case "img":
      case "image":
      case "link":
        at("error", e), at("load", e);
        break;
      case "details":
        at("toggle", e);
        break;
      case "input":
        at("invalid", e), nf(
          e,
          a.value,
          a.defaultValue,
          a.checked,
          a.defaultChecked,
          a.type,
          a.name,
          !0
        );
        break;
      case "select":
        at("invalid", e);
        break;
      case "textarea":
        at("invalid", e), cf(e, a.value, a.defaultValue, a.children);
    }
    l = a.children, typeof l != "string" && typeof l != "number" && typeof l != "bigint" || e.textContent === "" + l || a.suppressHydrationWarning === !0 || od(e.textContent, l) ? (a.popover != null && (at("beforetoggle", e), at("toggle", e)), a.onScroll != null && at("scroll", e), a.onScrollEnd != null && at("scrollend", e), a.onClick != null && (e.onclick = Qe), e = !0) : e = !1, e || sl(t, !0);
  }
  function Jf(t) {
    for (Gt = t.return; Gt; )
      switch (Gt.tag) {
        case 5:
        case 31:
        case 13:
          Ae = !1;
          return;
        case 27:
        case 3:
          Ae = !0;
          return;
        default:
          Gt = Gt.return;
      }
  }
  function oa(t) {
    if (t !== Gt) return !1;
    if (!it) return Jf(t), it = !0, !1;
    var e = t.tag, l;
    if ((l = e !== 3 && e !== 27) && ((l = e === 5) && (l = t.type, l = !(l !== "form" && l !== "button") || ss(t.type, t.memoizedProps)), l = !l), l && At && sl(t), Jf(t), e === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(f(317));
      At = Sd(t);
    } else if (e === 31) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(f(317));
      At = Sd(t);
    } else
      e === 27 ? (e = At, Al(t.type) ? (t = hs, hs = null, At = t) : At = e) : At = Gt ? ze(t.stateNode.nextSibling) : null;
    return !0;
  }
  function Bl() {
    At = Gt = null, it = !1;
  }
  function Vi() {
    var t = cl;
    return t !== null && (le === null ? le = t : le.push.apply(
      le,
      t
    ), cl = null), t;
  }
  function Wa(t) {
    cl === null ? cl = [t] : cl.push(t);
  }
  var Ki = y(null), wl = null, Xe = null;
  function fl(t, e, l) {
    H(Ki, e._currentValue), e._currentValue = l;
  }
  function Ze(t) {
    t._currentValue = Ki.current, M(Ki);
  }
  function Ji(t, e, l) {
    for (; t !== null; ) {
      var a = t.alternate;
      if ((t.childLanes & e) !== e ? (t.childLanes |= e, a !== null && (a.childLanes |= e)) : a !== null && (a.childLanes & e) !== e && (a.childLanes |= e), t === l) break;
      t = t.return;
    }
  }
  function Fi(t, e, l, a) {
    var n = t.child;
    for (n !== null && (n.return = t); n !== null; ) {
      var u = n.dependencies;
      if (u !== null) {
        var c = n.child;
        u = u.firstContext;
        t: for (; u !== null; ) {
          var o = u;
          u = n;
          for (var d = 0; d < e.length; d++)
            if (o.context === e[d]) {
              u.lanes |= l, o = u.alternate, o !== null && (o.lanes |= l), Ji(
                u.return,
                l,
                t
              ), a || (c = null);
              break t;
            }
          u = o.next;
        }
      } else if (n.tag === 18) {
        if (c = n.return, c === null) throw Error(f(341));
        c.lanes |= l, u = c.alternate, u !== null && (u.lanes |= l), Ji(c, l, t), c = null;
      } else c = n.child;
      if (c !== null) c.return = n;
      else
        for (c = n; c !== null; ) {
          if (c === t) {
            c = null;
            break;
          }
          if (n = c.sibling, n !== null) {
            n.return = c.return, c = n;
            break;
          }
          c = c.return;
        }
      n = c;
    }
  }
  function ra(t, e, l, a) {
    t = null;
    for (var n = e, u = !1; n !== null; ) {
      if (!u) {
        if ((n.flags & 524288) !== 0) u = !0;
        else if ((n.flags & 262144) !== 0) break;
      }
      if (n.tag === 10) {
        var c = n.alternate;
        if (c === null) throw Error(f(387));
        if (c = c.memoizedProps, c !== null) {
          var o = n.type;
          fe(n.pendingProps.value, c.value) || (t !== null ? t.push(o) : t = [o]);
        }
      } else if (n === ot.current) {
        if (c = n.alternate, c === null) throw Error(f(387));
        c.memoizedState.memoizedState !== n.memoizedState.memoizedState && (t !== null ? t.push(Tn) : t = [Tn]);
      }
      n = n.return;
    }
    t !== null && Fi(
      e,
      t,
      l,
      a
    ), e.flags |= 262144;
  }
  function lu(t) {
    for (t = t.firstContext; t !== null; ) {
      if (!fe(
        t.context._currentValue,
        t.memoizedValue
      ))
        return !0;
      t = t.next;
    }
    return !1;
  }
  function Ql(t) {
    wl = t, Xe = null, t = t.dependencies, t !== null && (t.firstContext = null);
  }
  function Lt(t) {
    return Ff(wl, t);
  }
  function au(t, e) {
    return wl === null && Ql(t), Ff(t, e);
  }
  function Ff(t, e) {
    var l = e._currentValue;
    if (e = { context: e, memoizedValue: l, next: null }, Xe === null) {
      if (t === null) throw Error(f(308));
      Xe = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
    } else Xe = Xe.next = e;
    return l;
  }
  var Ry = typeof AbortController < "u" ? AbortController : function() {
    var t = [], e = this.signal = {
      aborted: !1,
      addEventListener: function(l, a) {
        t.push(a);
      }
    };
    this.abort = function() {
      e.aborted = !0, t.forEach(function(l) {
        return l();
      });
    };
  }, Uy = i.unstable_scheduleCallback, xy = i.unstable_NormalPriority, Rt = {
    $$typeof: bt,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function Wi() {
    return {
      controller: new Ry(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function ka(t) {
    t.refCount--, t.refCount === 0 && Uy(xy, function() {
      t.controller.abort();
    });
  }
  var $a = null, ki = 0, da = 0, ha = null;
  function jy(t, e) {
    if ($a === null) {
      var l = $a = [];
      ki = 0, da = Pc(), ha = {
        status: "pending",
        value: void 0,
        then: function(a) {
          l.push(a);
        }
      };
    }
    return ki++, e.then(Wf, Wf), e;
  }
  function Wf() {
    if (--ki === 0 && $a !== null) {
      ha !== null && (ha.status = "fulfilled");
      var t = $a;
      $a = null, da = 0, ha = null;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
  }
  function Hy(t, e) {
    var l = [], a = {
      status: "pending",
      value: null,
      reason: null,
      then: function(n) {
        l.push(n);
      }
    };
    return t.then(
      function() {
        a.status = "fulfilled", a.value = e;
        for (var n = 0; n < l.length; n++) (0, l[n])(e);
      },
      function(n) {
        for (a.status = "rejected", a.reason = n, n = 0; n < l.length; n++)
          (0, l[n])(void 0);
      }
    ), a;
  }
  var kf = O.S;
  O.S = function(t, e) {
    jr = ie(), typeof e == "object" && e !== null && typeof e.then == "function" && jy(t, e), kf !== null && kf(t, e);
  };
  var Yl = y(null);
  function $i() {
    var t = Yl.current;
    return t !== null ? t : pt.pooledCache;
  }
  function nu(t, e) {
    e === null ? H(Yl, Yl.current) : H(Yl, e.pool);
  }
  function $f() {
    var t = $i();
    return t === null ? null : { parent: Rt._currentValue, pool: t };
  }
  var ya = Error(f(460)), Ii = Error(f(474)), uu = Error(f(542)), iu = { then: function() {
  } };
  function If(t) {
    return t = t.status, t === "fulfilled" || t === "rejected";
  }
  function Pf(t, e, l) {
    switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(Qe, Qe), e = l), e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw t = e.reason, eo(t), t;
      default:
        if (typeof e.status == "string") e.then(Qe, Qe);
        else {
          if (t = pt, t !== null && 100 < t.shellSuspendCounter)
            throw Error(f(482));
          t = e, t.status = "pending", t.then(
            function(a) {
              if (e.status === "pending") {
                var n = e;
                n.status = "fulfilled", n.value = a;
              }
            },
            function(a) {
              if (e.status === "pending") {
                var n = e;
                n.status = "rejected", n.reason = a;
              }
            }
          );
        }
        switch (e.status) {
          case "fulfilled":
            return e.value;
          case "rejected":
            throw t = e.reason, eo(t), t;
        }
        throw Ll = e, ya;
    }
  }
  function Gl(t) {
    try {
      var e = t._init;
      return e(t._payload);
    } catch (l) {
      throw l !== null && typeof l == "object" && typeof l.then == "function" ? (Ll = l, ya) : l;
    }
  }
  var Ll = null;
  function to() {
    if (Ll === null) throw Error(f(459));
    var t = Ll;
    return Ll = null, t;
  }
  function eo(t) {
    if (t === ya || t === uu)
      throw Error(f(483));
  }
  var ma = null, Ia = 0;
  function cu(t) {
    var e = Ia;
    return Ia += 1, ma === null && (ma = []), Pf(ma, t, e);
  }
  function Pa(t, e) {
    e = e.props.ref, t.ref = e !== void 0 ? e : null;
  }
  function su(t, e) {
    throw e.$$typeof === Y ? Error(f(525)) : (t = Object.prototype.toString.call(e), Error(
      f(
        31,
        t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
      )
    ));
  }
  function lo(t) {
    function e(m, h) {
      if (t) {
        var p = m.deletions;
        p === null ? (m.deletions = [h], m.flags |= 16) : p.push(h);
      }
    }
    function l(m, h) {
      if (!t) return null;
      for (; h !== null; )
        e(m, h), h = h.sibling;
      return null;
    }
    function a(m) {
      for (var h = /* @__PURE__ */ new Map(); m !== null; )
        m.key !== null ? h.set(m.key, m) : h.set(m.index, m), m = m.sibling;
      return h;
    }
    function n(m, h) {
      return m = Ge(m, h), m.index = 0, m.sibling = null, m;
    }
    function u(m, h, p) {
      return m.index = p, t ? (p = m.alternate, p !== null ? (p = p.index, p < h ? (m.flags |= 67108866, h) : p) : (m.flags |= 67108866, h)) : (m.flags |= 1048576, h);
    }
    function c(m) {
      return t && m.alternate === null && (m.flags |= 67108866), m;
    }
    function o(m, h, p, C) {
      return h === null || h.tag !== 6 ? (h = Yi(p, m.mode, C), h.return = m, h) : (h = n(h, p), h.return = m, h);
    }
    function d(m, h, p, C) {
      var Q = p.type;
      return Q === J ? T(
        m,
        h,
        p.props.children,
        C,
        p.key
      ) : h !== null && (h.elementType === Q || typeof Q == "object" && Q !== null && Q.$$typeof === Qt && Gl(Q) === h.type) ? (h = n(h, p.props), Pa(h, p), h.return = m, h) : (h = tu(
        p.type,
        p.key,
        p.props,
        null,
        m.mode,
        C
      ), Pa(h, p), h.return = m, h);
    }
    function S(m, h, p, C) {
      return h === null || h.tag !== 4 || h.stateNode.containerInfo !== p.containerInfo || h.stateNode.implementation !== p.implementation ? (h = Gi(p, m.mode, C), h.return = m, h) : (h = n(h, p.children || []), h.return = m, h);
    }
    function T(m, h, p, C, Q) {
      return h === null || h.tag !== 7 ? (h = ql(
        p,
        m.mode,
        C,
        Q
      ), h.return = m, h) : (h = n(h, p), h.return = m, h);
    }
    function _(m, h, p) {
      if (typeof h == "string" && h !== "" || typeof h == "number" || typeof h == "bigint")
        return h = Yi(
          "" + h,
          m.mode,
          p
        ), h.return = m, h;
      if (typeof h == "object" && h !== null) {
        switch (h.$$typeof) {
          case V:
            return p = tu(
              h.type,
              h.key,
              h.props,
              null,
              m.mode,
              p
            ), Pa(p, h), p.return = m, p;
          case W:
            return h = Gi(
              h,
              m.mode,
              p
            ), h.return = m, h;
          case Qt:
            return h = Gl(h), _(m, h, p);
        }
        if (Ce(h) || kt(h))
          return h = ql(
            h,
            m.mode,
            p,
            null
          ), h.return = m, h;
        if (typeof h.then == "function")
          return _(m, cu(h), p);
        if (h.$$typeof === bt)
          return _(
            m,
            au(m, h),
            p
          );
        su(m, h);
      }
      return null;
    }
    function b(m, h, p, C) {
      var Q = h !== null ? h.key : null;
      if (typeof p == "string" && p !== "" || typeof p == "number" || typeof p == "bigint")
        return Q !== null ? null : o(m, h, "" + p, C);
      if (typeof p == "object" && p !== null) {
        switch (p.$$typeof) {
          case V:
            return p.key === Q ? d(m, h, p, C) : null;
          case W:
            return p.key === Q ? S(m, h, p, C) : null;
          case Qt:
            return p = Gl(p), b(m, h, p, C);
        }
        if (Ce(p) || kt(p))
          return Q !== null ? null : T(m, h, p, C, null);
        if (typeof p.then == "function")
          return b(
            m,
            h,
            cu(p),
            C
          );
        if (p.$$typeof === bt)
          return b(
            m,
            h,
            au(m, p),
            C
          );
        su(m, p);
      }
      return null;
    }
    function E(m, h, p, C, Q) {
      if (typeof C == "string" && C !== "" || typeof C == "number" || typeof C == "bigint")
        return m = m.get(p) || null, o(h, m, "" + C, Q);
      if (typeof C == "object" && C !== null) {
        switch (C.$$typeof) {
          case V:
            return m = m.get(
              C.key === null ? p : C.key
            ) || null, d(h, m, C, Q);
          case W:
            return m = m.get(
              C.key === null ? p : C.key
            ) || null, S(h, m, C, Q);
          case Qt:
            return C = Gl(C), E(
              m,
              h,
              p,
              C,
              Q
            );
        }
        if (Ce(C) || kt(C))
          return m = m.get(p) || null, T(h, m, C, Q, null);
        if (typeof C.then == "function")
          return E(
            m,
            h,
            p,
            cu(C),
            Q
          );
        if (C.$$typeof === bt)
          return E(
            m,
            h,
            p,
            au(h, C),
            Q
          );
        su(h, C);
      }
      return null;
    }
    function q(m, h, p, C) {
      for (var Q = null, ct = null, w = h, I = h = 0, ut = null; w !== null && I < p.length; I++) {
        w.index > I ? (ut = w, w = null) : ut = w.sibling;
        var st = b(
          m,
          w,
          p[I],
          C
        );
        if (st === null) {
          w === null && (w = ut);
          break;
        }
        t && w && st.alternate === null && e(m, w), h = u(st, h, I), ct === null ? Q = st : ct.sibling = st, ct = st, w = ut;
      }
      if (I === p.length)
        return l(m, w), it && Le(m, I), Q;
      if (w === null) {
        for (; I < p.length; I++)
          w = _(m, p[I], C), w !== null && (h = u(
            w,
            h,
            I
          ), ct === null ? Q = w : ct.sibling = w, ct = w);
        return it && Le(m, I), Q;
      }
      for (w = a(w); I < p.length; I++)
        ut = E(
          w,
          m,
          I,
          p[I],
          C
        ), ut !== null && (t && ut.alternate !== null && w.delete(
          ut.key === null ? I : ut.key
        ), h = u(
          ut,
          h,
          I
        ), ct === null ? Q = ut : ct.sibling = ut, ct = ut);
      return t && w.forEach(function(Cl) {
        return e(m, Cl);
      }), it && Le(m, I), Q;
    }
    function L(m, h, p, C) {
      if (p == null) throw Error(f(151));
      for (var Q = null, ct = null, w = h, I = h = 0, ut = null, st = p.next(); w !== null && !st.done; I++, st = p.next()) {
        w.index > I ? (ut = w, w = null) : ut = w.sibling;
        var Cl = b(m, w, st.value, C);
        if (Cl === null) {
          w === null && (w = ut);
          break;
        }
        t && w && Cl.alternate === null && e(m, w), h = u(Cl, h, I), ct === null ? Q = Cl : ct.sibling = Cl, ct = Cl, w = ut;
      }
      if (st.done)
        return l(m, w), it && Le(m, I), Q;
      if (w === null) {
        for (; !st.done; I++, st = p.next())
          st = _(m, st.value, C), st !== null && (h = u(st, h, I), ct === null ? Q = st : ct.sibling = st, ct = st);
        return it && Le(m, I), Q;
      }
      for (w = a(w); !st.done; I++, st = p.next())
        st = E(w, m, I, st.value, C), st !== null && (t && st.alternate !== null && w.delete(st.key === null ? I : st.key), h = u(st, h, I), ct === null ? Q = st : ct.sibling = st, ct = st);
      return t && w.forEach(function(Km) {
        return e(m, Km);
      }), it && Le(m, I), Q;
    }
    function vt(m, h, p, C) {
      if (typeof p == "object" && p !== null && p.type === J && p.key === null && (p = p.props.children), typeof p == "object" && p !== null) {
        switch (p.$$typeof) {
          case V:
            t: {
              for (var Q = p.key; h !== null; ) {
                if (h.key === Q) {
                  if (Q = p.type, Q === J) {
                    if (h.tag === 7) {
                      l(
                        m,
                        h.sibling
                      ), C = n(
                        h,
                        p.props.children
                      ), C.return = m, m = C;
                      break t;
                    }
                  } else if (h.elementType === Q || typeof Q == "object" && Q !== null && Q.$$typeof === Qt && Gl(Q) === h.type) {
                    l(
                      m,
                      h.sibling
                    ), C = n(h, p.props), Pa(C, p), C.return = m, m = C;
                    break t;
                  }
                  l(m, h);
                  break;
                } else e(m, h);
                h = h.sibling;
              }
              p.type === J ? (C = ql(
                p.props.children,
                m.mode,
                C,
                p.key
              ), C.return = m, m = C) : (C = tu(
                p.type,
                p.key,
                p.props,
                null,
                m.mode,
                C
              ), Pa(C, p), C.return = m, m = C);
            }
            return c(m);
          case W:
            t: {
              for (Q = p.key; h !== null; ) {
                if (h.key === Q)
                  if (h.tag === 4 && h.stateNode.containerInfo === p.containerInfo && h.stateNode.implementation === p.implementation) {
                    l(
                      m,
                      h.sibling
                    ), C = n(h, p.children || []), C.return = m, m = C;
                    break t;
                  } else {
                    l(m, h);
                    break;
                  }
                else e(m, h);
                h = h.sibling;
              }
              C = Gi(p, m.mode, C), C.return = m, m = C;
            }
            return c(m);
          case Qt:
            return p = Gl(p), vt(
              m,
              h,
              p,
              C
            );
        }
        if (Ce(p))
          return q(
            m,
            h,
            p,
            C
          );
        if (kt(p)) {
          if (Q = kt(p), typeof Q != "function") throw Error(f(150));
          return p = Q.call(p), L(
            m,
            h,
            p,
            C
          );
        }
        if (typeof p.then == "function")
          return vt(
            m,
            h,
            cu(p),
            C
          );
        if (p.$$typeof === bt)
          return vt(
            m,
            h,
            au(m, p),
            C
          );
        su(m, p);
      }
      return typeof p == "string" && p !== "" || typeof p == "number" || typeof p == "bigint" ? (p = "" + p, h !== null && h.tag === 6 ? (l(m, h.sibling), C = n(h, p), C.return = m, m = C) : (l(m, h), C = Yi(p, m.mode, C), C.return = m, m = C), c(m)) : l(m, h);
    }
    return function(m, h, p, C) {
      try {
        Ia = 0;
        var Q = vt(
          m,
          h,
          p,
          C
        );
        return ma = null, Q;
      } catch (w) {
        if (w === ya || w === uu) throw w;
        var ct = oe(29, w, null, m.mode);
        return ct.lanes = C, ct.return = m, ct;
      }
    };
  }
  var Xl = lo(!0), ao = lo(!1), ol = !1;
  function Pi(t) {
    t.updateQueue = {
      baseState: t.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function tc(t, e) {
    t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
      baseState: t.baseState,
      firstBaseUpdate: t.firstBaseUpdate,
      lastBaseUpdate: t.lastBaseUpdate,
      shared: t.shared,
      callbacks: null
    });
  }
  function rl(t) {
    return { lane: t, tag: 0, payload: null, callback: null, next: null };
  }
  function dl(t, e, l) {
    var a = t.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (ft & 2) !== 0) {
      var n = a.pending;
      return n === null ? e.next = e : (e.next = n.next, n.next = e), a.pending = e, e = Pn(t), Yf(t, null, l), e;
    }
    return In(t, a, e, l), Pn(t);
  }
  function tn(t, e, l) {
    if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
      var a = e.lanes;
      a &= t.pendingLanes, l |= a, e.lanes = l, Js(t, l);
    }
  }
  function ec(t, e) {
    var l = t.updateQueue, a = t.alternate;
    if (a !== null && (a = a.updateQueue, l === a)) {
      var n = null, u = null;
      if (l = l.firstBaseUpdate, l !== null) {
        do {
          var c = {
            lane: l.lane,
            tag: l.tag,
            payload: l.payload,
            callback: null,
            next: null
          };
          u === null ? n = u = c : u = u.next = c, l = l.next;
        } while (l !== null);
        u === null ? n = u = e : u = u.next = e;
      } else n = u = e;
      l = {
        baseState: a.baseState,
        firstBaseUpdate: n,
        lastBaseUpdate: u,
        shared: a.shared,
        callbacks: a.callbacks
      }, t.updateQueue = l;
      return;
    }
    t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
  }
  var lc = !1;
  function en() {
    if (lc) {
      var t = ha;
      if (t !== null) throw t;
    }
  }
  function ln(t, e, l, a) {
    lc = !1;
    var n = t.updateQueue;
    ol = !1;
    var u = n.firstBaseUpdate, c = n.lastBaseUpdate, o = n.shared.pending;
    if (o !== null) {
      n.shared.pending = null;
      var d = o, S = d.next;
      d.next = null, c === null ? u = S : c.next = S, c = d;
      var T = t.alternate;
      T !== null && (T = T.updateQueue, o = T.lastBaseUpdate, o !== c && (o === null ? T.firstBaseUpdate = S : o.next = S, T.lastBaseUpdate = d));
    }
    if (u !== null) {
      var _ = n.baseState;
      c = 0, T = S = d = null, o = u;
      do {
        var b = o.lane & -536870913, E = b !== o.lane;
        if (E ? (nt & b) === b : (a & b) === b) {
          b !== 0 && b === da && (lc = !0), T !== null && (T = T.next = {
            lane: 0,
            tag: o.tag,
            payload: o.payload,
            callback: null,
            next: null
          });
          t: {
            var q = t, L = o;
            b = e;
            var vt = l;
            switch (L.tag) {
              case 1:
                if (q = L.payload, typeof q == "function") {
                  _ = q.call(vt, _, b);
                  break t;
                }
                _ = q;
                break t;
              case 3:
                q.flags = q.flags & -65537 | 128;
              case 0:
                if (q = L.payload, b = typeof q == "function" ? q.call(vt, _, b) : q, b == null) break t;
                _ = x({}, _, b);
                break t;
              case 2:
                ol = !0;
            }
          }
          b = o.callback, b !== null && (t.flags |= 64, E && (t.flags |= 8192), E = n.callbacks, E === null ? n.callbacks = [b] : E.push(b));
        } else
          E = {
            lane: b,
            tag: o.tag,
            payload: o.payload,
            callback: o.callback,
            next: null
          }, T === null ? (S = T = E, d = _) : T = T.next = E, c |= b;
        if (o = o.next, o === null) {
          if (o = n.shared.pending, o === null)
            break;
          E = o, o = E.next, E.next = null, n.lastBaseUpdate = E, n.shared.pending = null;
        }
      } while (!0);
      T === null && (d = _), n.baseState = d, n.firstBaseUpdate = S, n.lastBaseUpdate = T, u === null && (n.shared.lanes = 0), gl |= c, t.lanes = c, t.memoizedState = _;
    }
  }
  function no(t, e) {
    if (typeof t != "function")
      throw Error(f(191, t));
    t.call(e);
  }
  function uo(t, e) {
    var l = t.callbacks;
    if (l !== null)
      for (t.callbacks = null, t = 0; t < l.length; t++)
        no(l[t], e);
  }
  var va = y(null), fu = y(0);
  function io(t, e) {
    t = Pe, H(fu, t), H(va, e), Pe = t | e.baseLanes;
  }
  function ac() {
    H(fu, Pe), H(va, va.current);
  }
  function nc() {
    Pe = fu.current, M(va), M(fu);
  }
  var re = y(null), Te = null;
  function hl(t) {
    var e = t.alternate;
    H(Mt, Mt.current & 1), H(re, t), Te === null && (e === null || va.current !== null || e.memoizedState !== null) && (Te = t);
  }
  function uc(t) {
    H(Mt, Mt.current), H(re, t), Te === null && (Te = t);
  }
  function co(t) {
    t.tag === 22 ? (H(Mt, Mt.current), H(re, t), Te === null && (Te = t)) : yl();
  }
  function yl() {
    H(Mt, Mt.current), H(re, re.current);
  }
  function de(t) {
    M(re), Te === t && (Te = null), M(Mt);
  }
  var Mt = y(0);
  function ou(t) {
    for (var e = t; e !== null; ) {
      if (e.tag === 13) {
        var l = e.memoizedState;
        if (l !== null && (l = l.dehydrated, l === null || rs(l) || ds(l)))
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
  var Ve = 0, $ = null, yt = null, Ut = null, ru = !1, ga = !1, Zl = !1, du = 0, an = 0, pa = null, qy = 0;
  function Dt() {
    throw Error(f(321));
  }
  function ic(t, e) {
    if (e === null) return !1;
    for (var l = 0; l < e.length && l < t.length; l++)
      if (!fe(t[l], e[l])) return !1;
    return !0;
  }
  function cc(t, e, l, a, n, u) {
    return Ve = u, $ = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, O.H = t === null || t.memoizedState === null ? Vo : Ac, Zl = !1, u = l(a, n), Zl = !1, ga && (u = fo(
      e,
      l,
      a,
      n
    )), so(t), u;
  }
  function so(t) {
    O.H = cn;
    var e = yt !== null && yt.next !== null;
    if (Ve = 0, Ut = yt = $ = null, ru = !1, an = 0, pa = null, e) throw Error(f(300));
    t === null || xt || (t = t.dependencies, t !== null && lu(t) && (xt = !0));
  }
  function fo(t, e, l, a) {
    $ = t;
    var n = 0;
    do {
      if (ga && (pa = null), an = 0, ga = !1, 25 <= n) throw Error(f(301));
      if (n += 1, Ut = yt = null, t.updateQueue != null) {
        var u = t.updateQueue;
        u.lastEffect = null, u.events = null, u.stores = null, u.memoCache != null && (u.memoCache.index = 0);
      }
      O.H = Ko, u = e(l, a);
    } while (ga);
    return u;
  }
  function By() {
    var t = O.H, e = t.useState()[0];
    return e = typeof e.then == "function" ? nn(e) : e, t = t.useState()[0], (yt !== null ? yt.memoizedState : null) !== t && ($.flags |= 1024), e;
  }
  function sc() {
    var t = du !== 0;
    return du = 0, t;
  }
  function fc(t, e, l) {
    e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
  }
  function oc(t) {
    if (ru) {
      for (t = t.memoizedState; t !== null; ) {
        var e = t.queue;
        e !== null && (e.pending = null), t = t.next;
      }
      ru = !1;
    }
    Ve = 0, Ut = yt = $ = null, ga = !1, an = du = 0, pa = null;
  }
  function Jt() {
    var t = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return Ut === null ? $.memoizedState = Ut = t : Ut = Ut.next = t, Ut;
  }
  function Nt() {
    if (yt === null) {
      var t = $.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = yt.next;
    var e = Ut === null ? $.memoizedState : Ut.next;
    if (e !== null)
      Ut = e, yt = t;
    else {
      if (t === null)
        throw $.alternate === null ? Error(f(467)) : Error(f(310));
      yt = t, t = {
        memoizedState: yt.memoizedState,
        baseState: yt.baseState,
        baseQueue: yt.baseQueue,
        queue: yt.queue,
        next: null
      }, Ut === null ? $.memoizedState = Ut = t : Ut = Ut.next = t;
    }
    return Ut;
  }
  function hu() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function nn(t) {
    var e = an;
    return an += 1, pa === null && (pa = []), t = Pf(pa, t, e), e = $, (Ut === null ? e.memoizedState : Ut.next) === null && (e = e.alternate, O.H = e === null || e.memoizedState === null ? Vo : Ac), t;
  }
  function yu(t) {
    if (t !== null && typeof t == "object") {
      if (typeof t.then == "function") return nn(t);
      if (t.$$typeof === bt) return Lt(t);
    }
    throw Error(f(438, String(t)));
  }
  function rc(t) {
    var e = null, l = $.updateQueue;
    if (l !== null && (e = l.memoCache), e == null) {
      var a = $.alternate;
      a !== null && (a = a.updateQueue, a !== null && (a = a.memoCache, a != null && (e = {
        data: a.data.map(function(n) {
          return n.slice();
        }),
        index: 0
      })));
    }
    if (e == null && (e = { data: [], index: 0 }), l === null && (l = hu(), $.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
      for (l = e.data[e.index] = Array(t), a = 0; a < t; a++)
        l[a] = De;
    return e.index++, l;
  }
  function Ke(t, e) {
    return typeof e == "function" ? e(t) : e;
  }
  function mu(t) {
    var e = Nt();
    return dc(e, yt, t);
  }
  function dc(t, e, l) {
    var a = t.queue;
    if (a === null) throw Error(f(311));
    a.lastRenderedReducer = l;
    var n = t.baseQueue, u = a.pending;
    if (u !== null) {
      if (n !== null) {
        var c = n.next;
        n.next = u.next, u.next = c;
      }
      e.baseQueue = n = u, a.pending = null;
    }
    if (u = t.baseState, n === null) t.memoizedState = u;
    else {
      e = n.next;
      var o = c = null, d = null, S = e, T = !1;
      do {
        var _ = S.lane & -536870913;
        if (_ !== S.lane ? (nt & _) === _ : (Ve & _) === _) {
          var b = S.revertLane;
          if (b === 0)
            d !== null && (d = d.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: S.action,
              hasEagerState: S.hasEagerState,
              eagerState: S.eagerState,
              next: null
            }), _ === da && (T = !0);
          else if ((Ve & b) === b) {
            S = S.next, b === da && (T = !0);
            continue;
          } else
            _ = {
              lane: 0,
              revertLane: S.revertLane,
              gesture: null,
              action: S.action,
              hasEagerState: S.hasEagerState,
              eagerState: S.eagerState,
              next: null
            }, d === null ? (o = d = _, c = u) : d = d.next = _, $.lanes |= b, gl |= b;
          _ = S.action, Zl && l(u, _), u = S.hasEagerState ? S.eagerState : l(u, _);
        } else
          b = {
            lane: _,
            revertLane: S.revertLane,
            gesture: S.gesture,
            action: S.action,
            hasEagerState: S.hasEagerState,
            eagerState: S.eagerState,
            next: null
          }, d === null ? (o = d = b, c = u) : d = d.next = b, $.lanes |= _, gl |= _;
        S = S.next;
      } while (S !== null && S !== e);
      if (d === null ? c = u : d.next = o, !fe(u, t.memoizedState) && (xt = !0, T && (l = ha, l !== null)))
        throw l;
      t.memoizedState = u, t.baseState = c, t.baseQueue = d, a.lastRenderedState = u;
    }
    return n === null && (a.lanes = 0), [t.memoizedState, a.dispatch];
  }
  function hc(t) {
    var e = Nt(), l = e.queue;
    if (l === null) throw Error(f(311));
    l.lastRenderedReducer = t;
    var a = l.dispatch, n = l.pending, u = e.memoizedState;
    if (n !== null) {
      l.pending = null;
      var c = n = n.next;
      do
        u = t(u, c.action), c = c.next;
      while (c !== n);
      fe(u, e.memoizedState) || (xt = !0), e.memoizedState = u, e.baseQueue === null && (e.baseState = u), l.lastRenderedState = u;
    }
    return [u, a];
  }
  function oo(t, e, l) {
    var a = $, n = Nt(), u = it;
    if (u) {
      if (l === void 0) throw Error(f(407));
      l = l();
    } else l = e();
    var c = !fe(
      (yt || n).memoizedState,
      l
    );
    if (c && (n.memoizedState = l, xt = !0), n = n.queue, vc(yo.bind(null, a, n, t), [
      t
    ]), n.getSnapshot !== e || c || Ut !== null && Ut.memoizedState.tag & 1) {
      if (a.flags |= 2048, Sa(
        9,
        { destroy: void 0 },
        ho.bind(
          null,
          a,
          n,
          l,
          e
        ),
        null
      ), pt === null) throw Error(f(349));
      u || (Ve & 127) !== 0 || ro(a, e, l);
    }
    return l;
  }
  function ro(t, e, l) {
    t.flags |= 16384, t = { getSnapshot: e, value: l }, e = $.updateQueue, e === null ? (e = hu(), $.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
  }
  function ho(t, e, l, a) {
    e.value = l, e.getSnapshot = a, mo(e) && vo(t);
  }
  function yo(t, e, l) {
    return l(function() {
      mo(e) && vo(t);
    });
  }
  function mo(t) {
    var e = t.getSnapshot;
    t = t.value;
    try {
      var l = e();
      return !fe(t, l);
    } catch {
      return !0;
    }
  }
  function vo(t) {
    var e = Hl(t, 2);
    e !== null && ae(e, t, 2);
  }
  function yc(t) {
    var e = Jt();
    if (typeof t == "function") {
      var l = t;
      if (t = l(), Zl) {
        al(!0);
        try {
          l();
        } finally {
          al(!1);
        }
      }
    }
    return e.memoizedState = e.baseState = t, e.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Ke,
      lastRenderedState: t
    }, e;
  }
  function go(t, e, l, a) {
    return t.baseState = l, dc(
      t,
      yt,
      typeof a == "function" ? a : Ke
    );
  }
  function wy(t, e, l, a, n) {
    if (pu(t)) throw Error(f(485));
    if (t = e.action, t !== null) {
      var u = {
        payload: n,
        action: t,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(c) {
          u.listeners.push(c);
        }
      };
      O.T !== null ? l(!0) : u.isTransition = !1, a(u), l = e.pending, l === null ? (u.next = e.pending = u, po(e, u)) : (u.next = l.next, e.pending = l.next = u);
    }
  }
  function po(t, e) {
    var l = e.action, a = e.payload, n = t.state;
    if (e.isTransition) {
      var u = O.T, c = {};
      O.T = c;
      try {
        var o = l(n, a), d = O.S;
        d !== null && d(c, o), So(t, e, o);
      } catch (S) {
        mc(t, e, S);
      } finally {
        u !== null && c.types !== null && (u.types = c.types), O.T = u;
      }
    } else
      try {
        u = l(n, a), So(t, e, u);
      } catch (S) {
        mc(t, e, S);
      }
  }
  function So(t, e, l) {
    l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
      function(a) {
        bo(t, e, a);
      },
      function(a) {
        return mc(t, e, a);
      }
    ) : bo(t, e, l);
  }
  function bo(t, e, l) {
    e.status = "fulfilled", e.value = l, Eo(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, po(t, l)));
  }
  function mc(t, e, l) {
    var a = t.pending;
    if (t.pending = null, a !== null) {
      a = a.next;
      do
        e.status = "rejected", e.reason = l, Eo(e), e = e.next;
      while (e !== a);
    }
    t.action = null;
  }
  function Eo(t) {
    t = t.listeners;
    for (var e = 0; e < t.length; e++) (0, t[e])();
  }
  function Ao(t, e) {
    return e;
  }
  function To(t, e) {
    if (it) {
      var l = pt.formState;
      if (l !== null) {
        t: {
          var a = $;
          if (it) {
            if (At) {
              e: {
                for (var n = At, u = Ae; n.nodeType !== 8; ) {
                  if (!u) {
                    n = null;
                    break e;
                  }
                  if (n = ze(
                    n.nextSibling
                  ), n === null) {
                    n = null;
                    break e;
                  }
                }
                u = n.data, n = u === "F!" || u === "F" ? n : null;
              }
              if (n) {
                At = ze(
                  n.nextSibling
                ), a = n.data === "F!";
                break t;
              }
            }
            sl(a);
          }
          a = !1;
        }
        a && (e = l[0]);
      }
    }
    return l = Jt(), l.memoizedState = l.baseState = e, a = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Ao,
      lastRenderedState: e
    }, l.queue = a, l = Lo.bind(
      null,
      $,
      a
    ), a.dispatch = l, a = yc(!1), u = Ec.bind(
      null,
      $,
      !1,
      a.queue
    ), a = Jt(), n = {
      state: e,
      dispatch: null,
      action: t,
      pending: null
    }, a.queue = n, l = wy.bind(
      null,
      $,
      n,
      u,
      l
    ), n.dispatch = l, a.memoizedState = t, [e, l, !1];
  }
  function zo(t) {
    var e = Nt();
    return Oo(e, yt, t);
  }
  function Oo(t, e, l) {
    if (e = dc(
      t,
      e,
      Ao
    )[0], t = mu(Ke)[0], typeof e == "object" && e !== null && typeof e.then == "function")
      try {
        var a = nn(e);
      } catch (c) {
        throw c === ya ? uu : c;
      }
    else a = e;
    e = Nt();
    var n = e.queue, u = n.dispatch;
    return l !== e.memoizedState && ($.flags |= 2048, Sa(
      9,
      { destroy: void 0 },
      Qy.bind(null, n, l),
      null
    )), [a, u, t];
  }
  function Qy(t, e) {
    t.action = e;
  }
  function Do(t) {
    var e = Nt(), l = yt;
    if (l !== null)
      return Oo(e, l, t);
    Nt(), e = e.memoizedState, l = Nt();
    var a = l.queue.dispatch;
    return l.memoizedState = t, [e, a, !1];
  }
  function Sa(t, e, l, a) {
    return t = { tag: t, create: l, deps: a, inst: e, next: null }, e = $.updateQueue, e === null && (e = hu(), $.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (a = l.next, l.next = t, t.next = a, e.lastEffect = t), t;
  }
  function Co() {
    return Nt().memoizedState;
  }
  function vu(t, e, l, a) {
    var n = Jt();
    $.flags |= t, n.memoizedState = Sa(
      1 | e,
      { destroy: void 0 },
      l,
      a === void 0 ? null : a
    );
  }
  function gu(t, e, l, a) {
    var n = Nt();
    a = a === void 0 ? null : a;
    var u = n.memoizedState.inst;
    yt !== null && a !== null && ic(a, yt.memoizedState.deps) ? n.memoizedState = Sa(e, u, l, a) : ($.flags |= t, n.memoizedState = Sa(
      1 | e,
      u,
      l,
      a
    ));
  }
  function _o(t, e) {
    vu(8390656, 8, t, e);
  }
  function vc(t, e) {
    gu(2048, 8, t, e);
  }
  function Yy(t) {
    $.flags |= 4;
    var e = $.updateQueue;
    if (e === null)
      e = hu(), $.updateQueue = e, e.events = [t];
    else {
      var l = e.events;
      l === null ? e.events = [t] : l.push(t);
    }
  }
  function Mo(t) {
    var e = Nt().memoizedState;
    return Yy({ ref: e, nextImpl: t }), function() {
      if ((ft & 2) !== 0) throw Error(f(440));
      return e.impl.apply(void 0, arguments);
    };
  }
  function No(t, e) {
    return gu(4, 2, t, e);
  }
  function Ro(t, e) {
    return gu(4, 4, t, e);
  }
  function Uo(t, e) {
    if (typeof e == "function") {
      t = t();
      var l = e(t);
      return function() {
        typeof l == "function" ? l() : e(null);
      };
    }
    if (e != null)
      return t = t(), e.current = t, function() {
        e.current = null;
      };
  }
  function xo(t, e, l) {
    l = l != null ? l.concat([t]) : null, gu(4, 4, Uo.bind(null, e, t), l);
  }
  function gc() {
  }
  function jo(t, e) {
    var l = Nt();
    e = e === void 0 ? null : e;
    var a = l.memoizedState;
    return e !== null && ic(e, a[1]) ? a[0] : (l.memoizedState = [t, e], t);
  }
  function Ho(t, e) {
    var l = Nt();
    e = e === void 0 ? null : e;
    var a = l.memoizedState;
    if (e !== null && ic(e, a[1]))
      return a[0];
    if (a = t(), Zl) {
      al(!0);
      try {
        t();
      } finally {
        al(!1);
      }
    }
    return l.memoizedState = [a, e], a;
  }
  function pc(t, e, l) {
    return l === void 0 || (Ve & 1073741824) !== 0 && (nt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = qr(), $.lanes |= t, gl |= t, l);
  }
  function qo(t, e, l, a) {
    return fe(l, e) ? l : va.current !== null ? (t = pc(t, l, a), fe(t, e) || (xt = !0), t) : (Ve & 42) === 0 || (Ve & 1073741824) !== 0 && (nt & 261930) === 0 ? (xt = !0, t.memoizedState = l) : (t = qr(), $.lanes |= t, gl |= t, e);
  }
  function Bo(t, e, l, a, n) {
    var u = j.p;
    j.p = u !== 0 && 8 > u ? u : 8;
    var c = O.T, o = {};
    O.T = o, Ec(t, !1, e, l);
    try {
      var d = n(), S = O.S;
      if (S !== null && S(o, d), d !== null && typeof d == "object" && typeof d.then == "function") {
        var T = Hy(
          d,
          a
        );
        un(
          t,
          e,
          T,
          me(t)
        );
      } else
        un(
          t,
          e,
          a,
          me(t)
        );
    } catch (_) {
      un(
        t,
        e,
        { then: function() {
        }, status: "rejected", reason: _ },
        me()
      );
    } finally {
      j.p = u, c !== null && o.types !== null && (c.types = o.types), O.T = c;
    }
  }
  function Gy() {
  }
  function Sc(t, e, l, a) {
    if (t.tag !== 5) throw Error(f(476));
    var n = wo(t).queue;
    Bo(
      t,
      n,
      e,
      Z,
      l === null ? Gy : function() {
        return Qo(t), l(a);
      }
    );
  }
  function wo(t) {
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
        lastRenderedReducer: Ke,
        lastRenderedState: Z
      },
      next: null
    };
    var l = {};
    return e.next = {
      memoizedState: l,
      baseState: l,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Ke,
        lastRenderedState: l
      },
      next: null
    }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
  }
  function Qo(t) {
    var e = wo(t);
    e.next === null && (e = t.alternate.memoizedState), un(
      t,
      e.next.queue,
      {},
      me()
    );
  }
  function bc() {
    return Lt(Tn);
  }
  function Yo() {
    return Nt().memoizedState;
  }
  function Go() {
    return Nt().memoizedState;
  }
  function Ly(t) {
    for (var e = t.return; e !== null; ) {
      switch (e.tag) {
        case 24:
        case 3:
          var l = me();
          t = rl(l);
          var a = dl(e, t, l);
          a !== null && (ae(a, e, l), tn(a, e, l)), e = { cache: Wi() }, t.payload = e;
          return;
      }
      e = e.return;
    }
  }
  function Xy(t, e, l) {
    var a = me();
    l = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, pu(t) ? Xo(e, l) : (l = wi(t, e, l, a), l !== null && (ae(l, t, a), Zo(l, e, a)));
  }
  function Lo(t, e, l) {
    var a = me();
    un(t, e, l, a);
  }
  function un(t, e, l, a) {
    var n = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (pu(t)) Xo(e, n);
    else {
      var u = t.alternate;
      if (t.lanes === 0 && (u === null || u.lanes === 0) && (u = e.lastRenderedReducer, u !== null))
        try {
          var c = e.lastRenderedState, o = u(c, l);
          if (n.hasEagerState = !0, n.eagerState = o, fe(o, c))
            return In(t, e, n, 0), pt === null && $n(), !1;
        } catch {
        }
      if (l = wi(t, e, n, a), l !== null)
        return ae(l, t, a), Zo(l, e, a), !0;
    }
    return !1;
  }
  function Ec(t, e, l, a) {
    if (a = {
      lane: 2,
      revertLane: Pc(),
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, pu(t)) {
      if (e) throw Error(f(479));
    } else
      e = wi(
        t,
        l,
        a,
        2
      ), e !== null && ae(e, t, 2);
  }
  function pu(t) {
    var e = t.alternate;
    return t === $ || e !== null && e === $;
  }
  function Xo(t, e) {
    ga = ru = !0;
    var l = t.pending;
    l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
  }
  function Zo(t, e, l) {
    if ((l & 4194048) !== 0) {
      var a = e.lanes;
      a &= t.pendingLanes, l |= a, e.lanes = l, Js(t, l);
    }
  }
  var cn = {
    readContext: Lt,
    use: yu,
    useCallback: Dt,
    useContext: Dt,
    useEffect: Dt,
    useImperativeHandle: Dt,
    useLayoutEffect: Dt,
    useInsertionEffect: Dt,
    useMemo: Dt,
    useReducer: Dt,
    useRef: Dt,
    useState: Dt,
    useDebugValue: Dt,
    useDeferredValue: Dt,
    useTransition: Dt,
    useSyncExternalStore: Dt,
    useId: Dt,
    useHostTransitionStatus: Dt,
    useFormState: Dt,
    useActionState: Dt,
    useOptimistic: Dt,
    useMemoCache: Dt,
    useCacheRefresh: Dt
  };
  cn.useEffectEvent = Dt;
  var Vo = {
    readContext: Lt,
    use: yu,
    useCallback: function(t, e) {
      return Jt().memoizedState = [
        t,
        e === void 0 ? null : e
      ], t;
    },
    useContext: Lt,
    useEffect: _o,
    useImperativeHandle: function(t, e, l) {
      l = l != null ? l.concat([t]) : null, vu(
        4194308,
        4,
        Uo.bind(null, e, t),
        l
      );
    },
    useLayoutEffect: function(t, e) {
      return vu(4194308, 4, t, e);
    },
    useInsertionEffect: function(t, e) {
      vu(4, 2, t, e);
    },
    useMemo: function(t, e) {
      var l = Jt();
      e = e === void 0 ? null : e;
      var a = t();
      if (Zl) {
        al(!0);
        try {
          t();
        } finally {
          al(!1);
        }
      }
      return l.memoizedState = [a, e], a;
    },
    useReducer: function(t, e, l) {
      var a = Jt();
      if (l !== void 0) {
        var n = l(e);
        if (Zl) {
          al(!0);
          try {
            l(e);
          } finally {
            al(!1);
          }
        }
      } else n = e;
      return a.memoizedState = a.baseState = n, t = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: t,
        lastRenderedState: n
      }, a.queue = t, t = t.dispatch = Xy.bind(
        null,
        $,
        t
      ), [a.memoizedState, t];
    },
    useRef: function(t) {
      var e = Jt();
      return t = { current: t }, e.memoizedState = t;
    },
    useState: function(t) {
      t = yc(t);
      var e = t.queue, l = Lo.bind(null, $, e);
      return e.dispatch = l, [t.memoizedState, l];
    },
    useDebugValue: gc,
    useDeferredValue: function(t, e) {
      var l = Jt();
      return pc(l, t, e);
    },
    useTransition: function() {
      var t = yc(!1);
      return t = Bo.bind(
        null,
        $,
        t.queue,
        !0,
        !1
      ), Jt().memoizedState = t, [!1, t];
    },
    useSyncExternalStore: function(t, e, l) {
      var a = $, n = Jt();
      if (it) {
        if (l === void 0)
          throw Error(f(407));
        l = l();
      } else {
        if (l = e(), pt === null)
          throw Error(f(349));
        (nt & 127) !== 0 || ro(a, e, l);
      }
      n.memoizedState = l;
      var u = { value: l, getSnapshot: e };
      return n.queue = u, _o(yo.bind(null, a, u, t), [
        t
      ]), a.flags |= 2048, Sa(
        9,
        { destroy: void 0 },
        ho.bind(
          null,
          a,
          u,
          l,
          e
        ),
        null
      ), l;
    },
    useId: function() {
      var t = Jt(), e = pt.identifierPrefix;
      if (it) {
        var l = xe, a = Ue;
        l = (a & ~(1 << 32 - se(a) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = du++, 0 < l && (e += "H" + l.toString(32)), e += "_";
      } else
        l = qy++, e = "_" + e + "r_" + l.toString(32) + "_";
      return t.memoizedState = e;
    },
    useHostTransitionStatus: bc,
    useFormState: To,
    useActionState: To,
    useOptimistic: function(t) {
      var e = Jt();
      e.memoizedState = e.baseState = t;
      var l = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return e.queue = l, e = Ec.bind(
        null,
        $,
        !0,
        l
      ), l.dispatch = e, [t, e];
    },
    useMemoCache: rc,
    useCacheRefresh: function() {
      return Jt().memoizedState = Ly.bind(
        null,
        $
      );
    },
    useEffectEvent: function(t) {
      var e = Jt(), l = { impl: t };
      return e.memoizedState = l, function() {
        if ((ft & 2) !== 0)
          throw Error(f(440));
        return l.impl.apply(void 0, arguments);
      };
    }
  }, Ac = {
    readContext: Lt,
    use: yu,
    useCallback: jo,
    useContext: Lt,
    useEffect: vc,
    useImperativeHandle: xo,
    useInsertionEffect: No,
    useLayoutEffect: Ro,
    useMemo: Ho,
    useReducer: mu,
    useRef: Co,
    useState: function() {
      return mu(Ke);
    },
    useDebugValue: gc,
    useDeferredValue: function(t, e) {
      var l = Nt();
      return qo(
        l,
        yt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = mu(Ke)[0], e = Nt().memoizedState;
      return [
        typeof t == "boolean" ? t : nn(t),
        e
      ];
    },
    useSyncExternalStore: oo,
    useId: Yo,
    useHostTransitionStatus: bc,
    useFormState: zo,
    useActionState: zo,
    useOptimistic: function(t, e) {
      var l = Nt();
      return go(l, yt, t, e);
    },
    useMemoCache: rc,
    useCacheRefresh: Go
  };
  Ac.useEffectEvent = Mo;
  var Ko = {
    readContext: Lt,
    use: yu,
    useCallback: jo,
    useContext: Lt,
    useEffect: vc,
    useImperativeHandle: xo,
    useInsertionEffect: No,
    useLayoutEffect: Ro,
    useMemo: Ho,
    useReducer: hc,
    useRef: Co,
    useState: function() {
      return hc(Ke);
    },
    useDebugValue: gc,
    useDeferredValue: function(t, e) {
      var l = Nt();
      return yt === null ? pc(l, t, e) : qo(
        l,
        yt.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = hc(Ke)[0], e = Nt().memoizedState;
      return [
        typeof t == "boolean" ? t : nn(t),
        e
      ];
    },
    useSyncExternalStore: oo,
    useId: Yo,
    useHostTransitionStatus: bc,
    useFormState: Do,
    useActionState: Do,
    useOptimistic: function(t, e) {
      var l = Nt();
      return yt !== null ? go(l, yt, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
    },
    useMemoCache: rc,
    useCacheRefresh: Go
  };
  Ko.useEffectEvent = Mo;
  function Tc(t, e, l, a) {
    e = t.memoizedState, l = l(a, e), l = l == null ? e : x({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
  }
  var zc = {
    enqueueSetState: function(t, e, l) {
      t = t._reactInternals;
      var a = me(), n = rl(a);
      n.payload = e, l != null && (n.callback = l), e = dl(t, n, a), e !== null && (ae(e, t, a), tn(e, t, a));
    },
    enqueueReplaceState: function(t, e, l) {
      t = t._reactInternals;
      var a = me(), n = rl(a);
      n.tag = 1, n.payload = e, l != null && (n.callback = l), e = dl(t, n, a), e !== null && (ae(e, t, a), tn(e, t, a));
    },
    enqueueForceUpdate: function(t, e) {
      t = t._reactInternals;
      var l = me(), a = rl(l);
      a.tag = 2, e != null && (a.callback = e), e = dl(t, a, l), e !== null && (ae(e, t, l), tn(e, t, l));
    }
  };
  function Jo(t, e, l, a, n, u, c) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, u, c) : e.prototype && e.prototype.isPureReactComponent ? !Ka(l, a) || !Ka(n, u) : !0;
  }
  function Fo(t, e, l, a) {
    t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, a), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, a), e.state !== t && zc.enqueueReplaceState(e, e.state, null);
  }
  function Vl(t, e) {
    var l = e;
    if ("ref" in e) {
      l = {};
      for (var a in e)
        a !== "ref" && (l[a] = e[a]);
    }
    if (t = t.defaultProps) {
      l === e && (l = x({}, l));
      for (var n in t)
        l[n] === void 0 && (l[n] = t[n]);
    }
    return l;
  }
  function Wo(t) {
    kn(t);
  }
  function ko(t) {
    console.error(t);
  }
  function $o(t) {
    kn(t);
  }
  function Su(t, e) {
    try {
      var l = t.onUncaughtError;
      l(e.value, { componentStack: e.stack });
    } catch (a) {
      setTimeout(function() {
        throw a;
      });
    }
  }
  function Io(t, e, l) {
    try {
      var a = t.onCaughtError;
      a(l.value, {
        componentStack: l.stack,
        errorBoundary: e.tag === 1 ? e.stateNode : null
      });
    } catch (n) {
      setTimeout(function() {
        throw n;
      });
    }
  }
  function Oc(t, e, l) {
    return l = rl(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
      Su(t, e);
    }, l;
  }
  function Po(t) {
    return t = rl(t), t.tag = 3, t;
  }
  function tr(t, e, l, a) {
    var n = l.type.getDerivedStateFromError;
    if (typeof n == "function") {
      var u = a.value;
      t.payload = function() {
        return n(u);
      }, t.callback = function() {
        Io(e, l, a);
      };
    }
    var c = l.stateNode;
    c !== null && typeof c.componentDidCatch == "function" && (t.callback = function() {
      Io(e, l, a), typeof n != "function" && (pl === null ? pl = /* @__PURE__ */ new Set([this]) : pl.add(this));
      var o = a.stack;
      this.componentDidCatch(a.value, {
        componentStack: o !== null ? o : ""
      });
    });
  }
  function Zy(t, e, l, a, n) {
    if (l.flags |= 32768, a !== null && typeof a == "object" && typeof a.then == "function") {
      if (e = l.alternate, e !== null && ra(
        e,
        l,
        n,
        !0
      ), l = re.current, l !== null) {
        switch (l.tag) {
          case 31:
          case 13:
            return Te === null ? Ru() : l.alternate === null && Ct === 0 && (Ct = 3), l.flags &= -257, l.flags |= 65536, l.lanes = n, a === iu ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([a]) : e.add(a), kc(t, a, n)), !1;
          case 22:
            return l.flags |= 65536, a === iu ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([a])
            }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([a]) : l.add(a)), kc(t, a, n)), !1;
        }
        throw Error(f(435, l.tag));
      }
      return kc(t, a, n), Ru(), !1;
    }
    if (it)
      return e = re.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = n, a !== Zi && (t = Error(f(422), { cause: a }), Wa(Se(t, l)))) : (a !== Zi && (e = Error(f(423), {
        cause: a
      }), Wa(
        Se(e, l)
      )), t = t.current.alternate, t.flags |= 65536, n &= -n, t.lanes |= n, a = Se(a, l), n = Oc(
        t.stateNode,
        a,
        n
      ), ec(t, n), Ct !== 4 && (Ct = 2)), !1;
    var u = Error(f(520), { cause: a });
    if (u = Se(u, l), mn === null ? mn = [u] : mn.push(u), Ct !== 4 && (Ct = 2), e === null) return !0;
    a = Se(a, l), l = e;
    do {
      switch (l.tag) {
        case 3:
          return l.flags |= 65536, t = n & -n, l.lanes |= t, t = Oc(l.stateNode, a, t), ec(l, t), !1;
        case 1:
          if (e = l.type, u = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || u !== null && typeof u.componentDidCatch == "function" && (pl === null || !pl.has(u))))
            return l.flags |= 65536, n &= -n, l.lanes |= n, n = Po(n), tr(
              n,
              t,
              l,
              a
            ), ec(l, n), !1;
      }
      l = l.return;
    } while (l !== null);
    return !1;
  }
  var Dc = Error(f(461)), xt = !1;
  function Xt(t, e, l, a) {
    e.child = t === null ? ao(e, null, l, a) : Xl(
      e,
      t.child,
      l,
      a
    );
  }
  function er(t, e, l, a, n) {
    l = l.render;
    var u = e.ref;
    if ("ref" in a) {
      var c = {};
      for (var o in a)
        o !== "ref" && (c[o] = a[o]);
    } else c = a;
    return Ql(e), a = cc(
      t,
      e,
      l,
      c,
      u,
      n
    ), o = sc(), t !== null && !xt ? (fc(t, e, n), Je(t, e, n)) : (it && o && Li(e), e.flags |= 1, Xt(t, e, a, n), e.child);
  }
  function lr(t, e, l, a, n) {
    if (t === null) {
      var u = l.type;
      return typeof u == "function" && !Qi(u) && u.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = u, ar(
        t,
        e,
        u,
        a,
        n
      )) : (t = tu(
        l.type,
        null,
        a,
        e,
        e.mode,
        n
      ), t.ref = e.ref, t.return = e, e.child = t);
    }
    if (u = t.child, !jc(t, n)) {
      var c = u.memoizedProps;
      if (l = l.compare, l = l !== null ? l : Ka, l(c, a) && t.ref === e.ref)
        return Je(t, e, n);
    }
    return e.flags |= 1, t = Ge(u, a), t.ref = e.ref, t.return = e, e.child = t;
  }
  function ar(t, e, l, a, n) {
    if (t !== null) {
      var u = t.memoizedProps;
      if (Ka(u, a) && t.ref === e.ref)
        if (xt = !1, e.pendingProps = a = u, jc(t, n))
          (t.flags & 131072) !== 0 && (xt = !0);
        else
          return e.lanes = t.lanes, Je(t, e, n);
    }
    return Cc(
      t,
      e,
      l,
      a,
      n
    );
  }
  function nr(t, e, l, a) {
    var n = a.children, u = t !== null ? t.memoizedState : null;
    if (t === null && e.stateNode === null && (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), a.mode === "hidden") {
      if ((e.flags & 128) !== 0) {
        if (u = u !== null ? u.baseLanes | l : l, t !== null) {
          for (a = e.child = t.child, n = 0; a !== null; )
            n = n | a.lanes | a.childLanes, a = a.sibling;
          a = n & ~u;
        } else a = 0, e.child = null;
        return ur(
          t,
          e,
          u,
          l,
          a
        );
      }
      if ((l & 536870912) !== 0)
        e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && nu(
          e,
          u !== null ? u.cachePool : null
        ), u !== null ? io(e, u) : ac(), co(e);
      else
        return a = e.lanes = 536870912, ur(
          t,
          e,
          u !== null ? u.baseLanes | l : l,
          l,
          a
        );
    } else
      u !== null ? (nu(e, u.cachePool), io(e, u), yl(), e.memoizedState = null) : (t !== null && nu(e, null), ac(), yl());
    return Xt(t, e, n, l), e.child;
  }
  function sn(t, e) {
    return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), e.sibling;
  }
  function ur(t, e, l, a, n) {
    var u = $i();
    return u = u === null ? null : { parent: Rt._currentValue, pool: u }, e.memoizedState = {
      baseLanes: l,
      cachePool: u
    }, t !== null && nu(e, null), ac(), co(e), t !== null && ra(t, e, a, !0), e.childLanes = n, null;
  }
  function bu(t, e) {
    return e = Au(
      { mode: e.mode, children: e.children },
      t.mode
    ), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function ir(t, e, l) {
    return Xl(e, t.child, null, l), t = bu(e, e.pendingProps), t.flags |= 2, de(e), e.memoizedState = null, t;
  }
  function Vy(t, e, l) {
    var a = e.pendingProps, n = (e.flags & 128) !== 0;
    if (e.flags &= -129, t === null) {
      if (it) {
        if (a.mode === "hidden")
          return t = bu(e, a), e.lanes = 536870912, sn(null, t);
        if (uc(e), (t = At) ? (t = pd(
          t,
          Ae
        ), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: il !== null ? { id: Ue, overflow: xe } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, l = Lf(t), l.return = e, e.child = l, Gt = e, At = null)) : t = null, t === null) throw sl(e);
        return e.lanes = 536870912, null;
      }
      return bu(e, a);
    }
    var u = t.memoizedState;
    if (u !== null) {
      var c = u.dehydrated;
      if (uc(e), n)
        if (e.flags & 256)
          e.flags &= -257, e = ir(
            t,
            e,
            l
          );
        else if (e.memoizedState !== null)
          e.child = t.child, e.flags |= 128, e = null;
        else throw Error(f(558));
      else if (xt || ra(t, e, l, !1), n = (l & t.childLanes) !== 0, xt || n) {
        if (a = pt, a !== null && (c = Fs(a, l), c !== 0 && c !== u.retryLane))
          throw u.retryLane = c, Hl(t, c), ae(a, t, c), Dc;
        Ru(), e = ir(
          t,
          e,
          l
        );
      } else
        t = u.treeContext, At = ze(c.nextSibling), Gt = e, it = !0, cl = null, Ae = !1, t !== null && Vf(e, t), e = bu(e, a), e.flags |= 4096;
      return e;
    }
    return t = Ge(t.child, {
      mode: a.mode,
      children: a.children
    }), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Eu(t, e) {
    var l = e.ref;
    if (l === null)
      t !== null && t.ref !== null && (e.flags |= 4194816);
    else {
      if (typeof l != "function" && typeof l != "object")
        throw Error(f(284));
      (t === null || t.ref !== l) && (e.flags |= 4194816);
    }
  }
  function Cc(t, e, l, a, n) {
    return Ql(e), l = cc(
      t,
      e,
      l,
      a,
      void 0,
      n
    ), a = sc(), t !== null && !xt ? (fc(t, e, n), Je(t, e, n)) : (it && a && Li(e), e.flags |= 1, Xt(t, e, l, n), e.child);
  }
  function cr(t, e, l, a, n, u) {
    return Ql(e), e.updateQueue = null, l = fo(
      e,
      a,
      l,
      n
    ), so(t), a = sc(), t !== null && !xt ? (fc(t, e, u), Je(t, e, u)) : (it && a && Li(e), e.flags |= 1, Xt(t, e, l, u), e.child);
  }
  function sr(t, e, l, a, n) {
    if (Ql(e), e.stateNode === null) {
      var u = ca, c = l.contextType;
      typeof c == "object" && c !== null && (u = Lt(c)), u = new l(a, u), e.memoizedState = u.state !== null && u.state !== void 0 ? u.state : null, u.updater = zc, e.stateNode = u, u._reactInternals = e, u = e.stateNode, u.props = a, u.state = e.memoizedState, u.refs = {}, Pi(e), c = l.contextType, u.context = typeof c == "object" && c !== null ? Lt(c) : ca, u.state = e.memoizedState, c = l.getDerivedStateFromProps, typeof c == "function" && (Tc(
        e,
        l,
        c,
        a
      ), u.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof u.getSnapshotBeforeUpdate == "function" || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (c = u.state, typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount(), c !== u.state && zc.enqueueReplaceState(u, u.state, null), ln(e, a, u, n), en(), u.state = e.memoizedState), typeof u.componentDidMount == "function" && (e.flags |= 4194308), a = !0;
    } else if (t === null) {
      u = e.stateNode;
      var o = e.memoizedProps, d = Vl(l, o);
      u.props = d;
      var S = u.context, T = l.contextType;
      c = ca, typeof T == "object" && T !== null && (c = Lt(T));
      var _ = l.getDerivedStateFromProps;
      T = typeof _ == "function" || typeof u.getSnapshotBeforeUpdate == "function", o = e.pendingProps !== o, T || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (o || S !== c) && Fo(
        e,
        u,
        a,
        c
      ), ol = !1;
      var b = e.memoizedState;
      u.state = b, ln(e, a, u, n), en(), S = e.memoizedState, o || b !== S || ol ? (typeof _ == "function" && (Tc(
        e,
        l,
        _,
        a
      ), S = e.memoizedState), (d = ol || Jo(
        e,
        l,
        d,
        a,
        b,
        S,
        c
      )) ? (T || typeof u.UNSAFE_componentWillMount != "function" && typeof u.componentWillMount != "function" || (typeof u.componentWillMount == "function" && u.componentWillMount(), typeof u.UNSAFE_componentWillMount == "function" && u.UNSAFE_componentWillMount()), typeof u.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = a, e.memoizedState = S), u.props = a, u.state = S, u.context = c, a = d) : (typeof u.componentDidMount == "function" && (e.flags |= 4194308), a = !1);
    } else {
      u = e.stateNode, tc(t, e), c = e.memoizedProps, T = Vl(l, c), u.props = T, _ = e.pendingProps, b = u.context, S = l.contextType, d = ca, typeof S == "object" && S !== null && (d = Lt(S)), o = l.getDerivedStateFromProps, (S = typeof o == "function" || typeof u.getSnapshotBeforeUpdate == "function") || typeof u.UNSAFE_componentWillReceiveProps != "function" && typeof u.componentWillReceiveProps != "function" || (c !== _ || b !== d) && Fo(
        e,
        u,
        a,
        d
      ), ol = !1, b = e.memoizedState, u.state = b, ln(e, a, u, n), en();
      var E = e.memoizedState;
      c !== _ || b !== E || ol || t !== null && t.dependencies !== null && lu(t.dependencies) ? (typeof o == "function" && (Tc(
        e,
        l,
        o,
        a
      ), E = e.memoizedState), (T = ol || Jo(
        e,
        l,
        T,
        a,
        b,
        E,
        d
      ) || t !== null && t.dependencies !== null && lu(t.dependencies)) ? (S || typeof u.UNSAFE_componentWillUpdate != "function" && typeof u.componentWillUpdate != "function" || (typeof u.componentWillUpdate == "function" && u.componentWillUpdate(a, E, d), typeof u.UNSAFE_componentWillUpdate == "function" && u.UNSAFE_componentWillUpdate(
        a,
        E,
        d
      )), typeof u.componentDidUpdate == "function" && (e.flags |= 4), typeof u.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof u.componentDidUpdate != "function" || c === t.memoizedProps && b === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || c === t.memoizedProps && b === t.memoizedState || (e.flags |= 1024), e.memoizedProps = a, e.memoizedState = E), u.props = a, u.state = E, u.context = d, a = T) : (typeof u.componentDidUpdate != "function" || c === t.memoizedProps && b === t.memoizedState || (e.flags |= 4), typeof u.getSnapshotBeforeUpdate != "function" || c === t.memoizedProps && b === t.memoizedState || (e.flags |= 1024), a = !1);
    }
    return u = a, Eu(t, e), a = (e.flags & 128) !== 0, u || a ? (u = e.stateNode, l = a && typeof l.getDerivedStateFromError != "function" ? null : u.render(), e.flags |= 1, t !== null && a ? (e.child = Xl(
      e,
      t.child,
      null,
      n
    ), e.child = Xl(
      e,
      null,
      l,
      n
    )) : Xt(t, e, l, n), e.memoizedState = u.state, t = e.child) : t = Je(
      t,
      e,
      n
    ), t;
  }
  function fr(t, e, l, a) {
    return Bl(), e.flags |= 256, Xt(t, e, l, a), e.child;
  }
  var _c = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function Mc(t) {
    return { baseLanes: t, cachePool: $f() };
  }
  function Nc(t, e, l) {
    return t = t !== null ? t.childLanes & ~l : 0, e && (t |= ye), t;
  }
  function or(t, e, l) {
    var a = e.pendingProps, n = !1, u = (e.flags & 128) !== 0, c;
    if ((c = u) || (c = t !== null && t.memoizedState === null ? !1 : (Mt.current & 2) !== 0), c && (n = !0, e.flags &= -129), c = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
      if (it) {
        if (n ? hl(e) : yl(), (t = At) ? (t = pd(
          t,
          Ae
        ), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: il !== null ? { id: Ue, overflow: xe } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, l = Lf(t), l.return = e, e.child = l, Gt = e, At = null)) : t = null, t === null) throw sl(e);
        return ds(t) ? e.lanes = 32 : e.lanes = 536870912, null;
      }
      var o = a.children;
      return a = a.fallback, n ? (yl(), n = e.mode, o = Au(
        { mode: "hidden", children: o },
        n
      ), a = ql(
        a,
        n,
        l,
        null
      ), o.return = e, a.return = e, o.sibling = a, e.child = o, a = e.child, a.memoizedState = Mc(l), a.childLanes = Nc(
        t,
        c,
        l
      ), e.memoizedState = _c, sn(null, a)) : (hl(e), Rc(e, o));
    }
    var d = t.memoizedState;
    if (d !== null && (o = d.dehydrated, o !== null)) {
      if (u)
        e.flags & 256 ? (hl(e), e.flags &= -257, e = Uc(
          t,
          e,
          l
        )) : e.memoizedState !== null ? (yl(), e.child = t.child, e.flags |= 128, e = null) : (yl(), o = a.fallback, n = e.mode, a = Au(
          { mode: "visible", children: a.children },
          n
        ), o = ql(
          o,
          n,
          l,
          null
        ), o.flags |= 2, a.return = e, o.return = e, a.sibling = o, e.child = a, Xl(
          e,
          t.child,
          null,
          l
        ), a = e.child, a.memoizedState = Mc(l), a.childLanes = Nc(
          t,
          c,
          l
        ), e.memoizedState = _c, e = sn(null, a));
      else if (hl(e), ds(o)) {
        if (c = o.nextSibling && o.nextSibling.dataset, c) var S = c.dgst;
        c = S, a = Error(f(419)), a.stack = "", a.digest = c, Wa({ value: a, source: null, stack: null }), e = Uc(
          t,
          e,
          l
        );
      } else if (xt || ra(t, e, l, !1), c = (l & t.childLanes) !== 0, xt || c) {
        if (c = pt, c !== null && (a = Fs(c, l), a !== 0 && a !== d.retryLane))
          throw d.retryLane = a, Hl(t, a), ae(c, t, a), Dc;
        rs(o) || Ru(), e = Uc(
          t,
          e,
          l
        );
      } else
        rs(o) ? (e.flags |= 192, e.child = t.child, e = null) : (t = d.treeContext, At = ze(
          o.nextSibling
        ), Gt = e, it = !0, cl = null, Ae = !1, t !== null && Vf(e, t), e = Rc(
          e,
          a.children
        ), e.flags |= 4096);
      return e;
    }
    return n ? (yl(), o = a.fallback, n = e.mode, d = t.child, S = d.sibling, a = Ge(d, {
      mode: "hidden",
      children: a.children
    }), a.subtreeFlags = d.subtreeFlags & 65011712, S !== null ? o = Ge(
      S,
      o
    ) : (o = ql(
      o,
      n,
      l,
      null
    ), o.flags |= 2), o.return = e, a.return = e, a.sibling = o, e.child = a, sn(null, a), a = e.child, o = t.child.memoizedState, o === null ? o = Mc(l) : (n = o.cachePool, n !== null ? (d = Rt._currentValue, n = n.parent !== d ? { parent: d, pool: d } : n) : n = $f(), o = {
      baseLanes: o.baseLanes | l,
      cachePool: n
    }), a.memoizedState = o, a.childLanes = Nc(
      t,
      c,
      l
    ), e.memoizedState = _c, sn(t.child, a)) : (hl(e), l = t.child, t = l.sibling, l = Ge(l, {
      mode: "visible",
      children: a.children
    }), l.return = e, l.sibling = null, t !== null && (c = e.deletions, c === null ? (e.deletions = [t], e.flags |= 16) : c.push(t)), e.child = l, e.memoizedState = null, l);
  }
  function Rc(t, e) {
    return e = Au(
      { mode: "visible", children: e },
      t.mode
    ), e.return = t, t.child = e;
  }
  function Au(t, e) {
    return t = oe(22, t, null, e), t.lanes = 0, t;
  }
  function Uc(t, e, l) {
    return Xl(e, t.child, null, l), t = Rc(
      e,
      e.pendingProps.children
    ), t.flags |= 2, e.memoizedState = null, t;
  }
  function rr(t, e, l) {
    t.lanes |= e;
    var a = t.alternate;
    a !== null && (a.lanes |= e), Ji(t.return, e, l);
  }
  function xc(t, e, l, a, n, u) {
    var c = t.memoizedState;
    c === null ? t.memoizedState = {
      isBackwards: e,
      rendering: null,
      renderingStartTime: 0,
      last: a,
      tail: l,
      tailMode: n,
      treeForkCount: u
    } : (c.isBackwards = e, c.rendering = null, c.renderingStartTime = 0, c.last = a, c.tail = l, c.tailMode = n, c.treeForkCount = u);
  }
  function dr(t, e, l) {
    var a = e.pendingProps, n = a.revealOrder, u = a.tail;
    a = a.children;
    var c = Mt.current, o = (c & 2) !== 0;
    if (o ? (c = c & 1 | 2, e.flags |= 128) : c &= 1, H(Mt, c), Xt(t, e, a, l), a = it ? Fa : 0, !o && t !== null && (t.flags & 128) !== 0)
      t: for (t = e.child; t !== null; ) {
        if (t.tag === 13)
          t.memoizedState !== null && rr(t, l, e);
        else if (t.tag === 19)
          rr(t, l, e);
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
    switch (n) {
      case "forwards":
        for (l = e.child, n = null; l !== null; )
          t = l.alternate, t !== null && ou(t) === null && (n = l), l = l.sibling;
        l = n, l === null ? (n = e.child, e.child = null) : (n = l.sibling, l.sibling = null), xc(
          e,
          !1,
          n,
          l,
          u,
          a
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (l = null, n = e.child, e.child = null; n !== null; ) {
          if (t = n.alternate, t !== null && ou(t) === null) {
            e.child = n;
            break;
          }
          t = n.sibling, n.sibling = l, l = n, n = t;
        }
        xc(
          e,
          !0,
          l,
          null,
          u,
          a
        );
        break;
      case "together":
        xc(
          e,
          !1,
          null,
          null,
          void 0,
          a
        );
        break;
      default:
        e.memoizedState = null;
    }
    return e.child;
  }
  function Je(t, e, l) {
    if (t !== null && (e.dependencies = t.dependencies), gl |= e.lanes, (l & e.childLanes) === 0)
      if (t !== null) {
        if (ra(
          t,
          e,
          l,
          !1
        ), (l & e.childLanes) === 0)
          return null;
      } else return null;
    if (t !== null && e.child !== t.child)
      throw Error(f(153));
    if (e.child !== null) {
      for (t = e.child, l = Ge(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
        t = t.sibling, l = l.sibling = Ge(t, t.pendingProps), l.return = e;
      l.sibling = null;
    }
    return e.child;
  }
  function jc(t, e) {
    return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && lu(t)));
  }
  function Ky(t, e, l) {
    switch (e.tag) {
      case 3:
        Kt(e, e.stateNode.containerInfo), fl(e, Rt, t.memoizedState.cache), Bl();
        break;
      case 27:
      case 5:
        xa(e);
        break;
      case 4:
        Kt(e, e.stateNode.containerInfo);
        break;
      case 10:
        fl(
          e,
          e.type,
          e.memoizedProps.value
        );
        break;
      case 31:
        if (e.memoizedState !== null)
          return e.flags |= 128, uc(e), null;
        break;
      case 13:
        var a = e.memoizedState;
        if (a !== null)
          return a.dehydrated !== null ? (hl(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? or(t, e, l) : (hl(e), t = Je(
            t,
            e,
            l
          ), t !== null ? t.sibling : null);
        hl(e);
        break;
      case 19:
        var n = (t.flags & 128) !== 0;
        if (a = (l & e.childLanes) !== 0, a || (ra(
          t,
          e,
          l,
          !1
        ), a = (l & e.childLanes) !== 0), n) {
          if (a)
            return dr(
              t,
              e,
              l
            );
          e.flags |= 128;
        }
        if (n = e.memoizedState, n !== null && (n.rendering = null, n.tail = null, n.lastEffect = null), H(Mt, Mt.current), a) break;
        return null;
      case 22:
        return e.lanes = 0, nr(
          t,
          e,
          l,
          e.pendingProps
        );
      case 24:
        fl(e, Rt, t.memoizedState.cache);
    }
    return Je(t, e, l);
  }
  function hr(t, e, l) {
    if (t !== null)
      if (t.memoizedProps !== e.pendingProps)
        xt = !0;
      else {
        if (!jc(t, l) && (e.flags & 128) === 0)
          return xt = !1, Ky(
            t,
            e,
            l
          );
        xt = (t.flags & 131072) !== 0;
      }
    else
      xt = !1, it && (e.flags & 1048576) !== 0 && Zf(e, Fa, e.index);
    switch (e.lanes = 0, e.tag) {
      case 16:
        t: {
          var a = e.pendingProps;
          if (t = Gl(e.elementType), e.type = t, typeof t == "function")
            Qi(t) ? (a = Vl(t, a), e.tag = 1, e = sr(
              null,
              e,
              t,
              a,
              l
            )) : (e.tag = 0, e = Cc(
              null,
              e,
              t,
              a,
              l
            ));
          else {
            if (t != null) {
              var n = t.$$typeof;
              if (n === Ot) {
                e.tag = 11, e = er(
                  null,
                  e,
                  t,
                  a,
                  l
                );
                break t;
              } else if (n === G) {
                e.tag = 14, e = lr(
                  null,
                  e,
                  t,
                  a,
                  l
                );
                break t;
              }
            }
            throw e = Be(t) || t, Error(f(306, e, ""));
          }
        }
        return e;
      case 0:
        return Cc(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 1:
        return a = e.type, n = Vl(
          a,
          e.pendingProps
        ), sr(
          t,
          e,
          a,
          n,
          l
        );
      case 3:
        t: {
          if (Kt(
            e,
            e.stateNode.containerInfo
          ), t === null) throw Error(f(387));
          a = e.pendingProps;
          var u = e.memoizedState;
          n = u.element, tc(t, e), ln(e, a, null, l);
          var c = e.memoizedState;
          if (a = c.cache, fl(e, Rt, a), a !== u.cache && Fi(
            e,
            [Rt],
            l,
            !0
          ), en(), a = c.element, u.isDehydrated)
            if (u = {
              element: a,
              isDehydrated: !1,
              cache: c.cache
            }, e.updateQueue.baseState = u, e.memoizedState = u, e.flags & 256) {
              e = fr(
                t,
                e,
                a,
                l
              );
              break t;
            } else if (a !== n) {
              n = Se(
                Error(f(424)),
                e
              ), Wa(n), e = fr(
                t,
                e,
                a,
                l
              );
              break t;
            } else
              for (t = e.stateNode.containerInfo, t.nodeType === 9 ? t = t.body : t = t.nodeName === "HTML" ? t.ownerDocument.body : t, At = ze(t.firstChild), Gt = e, it = !0, cl = null, Ae = !0, l = ao(
                e,
                null,
                a,
                l
              ), e.child = l; l; )
                l.flags = l.flags & -3 | 4096, l = l.sibling;
          else {
            if (Bl(), a === n) {
              e = Je(
                t,
                e,
                l
              );
              break t;
            }
            Xt(t, e, a, l);
          }
          e = e.child;
        }
        return e;
      case 26:
        return Eu(t, e), t === null ? (l = zd(
          e.type,
          null,
          e.pendingProps,
          null
        )) ? e.memoizedState = l : it || (l = e.type, t = e.pendingProps, a = wu(
          et.current
        ).createElement(l), a[Yt] = e, a[$t] = t, Zt(a, l, t), Bt(a), e.stateNode = a) : e.memoizedState = zd(
          e.type,
          t.memoizedProps,
          e.pendingProps,
          t.memoizedState
        ), null;
      case 27:
        return xa(e), t === null && it && (a = e.stateNode = Ed(
          e.type,
          e.pendingProps,
          et.current
        ), Gt = e, Ae = !0, n = At, Al(e.type) ? (hs = n, At = ze(a.firstChild)) : At = n), Xt(
          t,
          e,
          e.pendingProps.children,
          l
        ), Eu(t, e), t === null && (e.flags |= 4194304), e.child;
      case 5:
        return t === null && it && ((n = a = At) && (a = Am(
          a,
          e.type,
          e.pendingProps,
          Ae
        ), a !== null ? (e.stateNode = a, Gt = e, At = ze(a.firstChild), Ae = !1, n = !0) : n = !1), n || sl(e)), xa(e), n = e.type, u = e.pendingProps, c = t !== null ? t.memoizedProps : null, a = u.children, ss(n, u) ? a = null : c !== null && ss(n, c) && (e.flags |= 32), e.memoizedState !== null && (n = cc(
          t,
          e,
          By,
          null,
          null,
          l
        ), Tn._currentValue = n), Eu(t, e), Xt(t, e, a, l), e.child;
      case 6:
        return t === null && it && ((t = l = At) && (l = Tm(
          l,
          e.pendingProps,
          Ae
        ), l !== null ? (e.stateNode = l, Gt = e, At = null, t = !0) : t = !1), t || sl(e)), null;
      case 13:
        return or(t, e, l);
      case 4:
        return Kt(
          e,
          e.stateNode.containerInfo
        ), a = e.pendingProps, t === null ? e.child = Xl(
          e,
          null,
          a,
          l
        ) : Xt(t, e, a, l), e.child;
      case 11:
        return er(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 7:
        return Xt(
          t,
          e,
          e.pendingProps,
          l
        ), e.child;
      case 8:
        return Xt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 12:
        return Xt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 10:
        return a = e.pendingProps, fl(e, e.type, a.value), Xt(t, e, a.children, l), e.child;
      case 9:
        return n = e.type._context, a = e.pendingProps.children, Ql(e), n = Lt(n), a = a(n), e.flags |= 1, Xt(t, e, a, l), e.child;
      case 14:
        return lr(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 15:
        return ar(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 19:
        return dr(t, e, l);
      case 31:
        return Vy(t, e, l);
      case 22:
        return nr(
          t,
          e,
          l,
          e.pendingProps
        );
      case 24:
        return Ql(e), a = Lt(Rt), t === null ? (n = $i(), n === null && (n = pt, u = Wi(), n.pooledCache = u, u.refCount++, u !== null && (n.pooledCacheLanes |= l), n = u), e.memoizedState = { parent: a, cache: n }, Pi(e), fl(e, Rt, n)) : ((t.lanes & l) !== 0 && (tc(t, e), ln(e, null, null, l), en()), n = t.memoizedState, u = e.memoizedState, n.parent !== a ? (n = { parent: a, cache: a }, e.memoizedState = n, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = n), fl(e, Rt, a)) : (a = u.cache, fl(e, Rt, a), a !== n.cache && Fi(
          e,
          [Rt],
          l,
          !0
        ))), Xt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 29:
        throw e.pendingProps;
    }
    throw Error(f(156, e.tag));
  }
  function Fe(t) {
    t.flags |= 4;
  }
  function Hc(t, e, l, a, n) {
    if ((e = (t.mode & 32) !== 0) && (e = !1), e) {
      if (t.flags |= 16777216, (n & 335544128) === n)
        if (t.stateNode.complete) t.flags |= 8192;
        else if (Yr()) t.flags |= 8192;
        else
          throw Ll = iu, Ii;
    } else t.flags &= -16777217;
  }
  function yr(t, e) {
    if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0)
      t.flags &= -16777217;
    else if (t.flags |= 16777216, !Md(e))
      if (Yr()) t.flags |= 8192;
      else
        throw Ll = iu, Ii;
  }
  function Tu(t, e) {
    e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? Vs() : 536870912, t.lanes |= e, Ta |= e);
  }
  function fn(t, e) {
    if (!it)
      switch (t.tailMode) {
        case "hidden":
          e = t.tail;
          for (var l = null; e !== null; )
            e.alternate !== null && (l = e), e = e.sibling;
          l === null ? t.tail = null : l.sibling = null;
          break;
        case "collapsed":
          l = t.tail;
          for (var a = null; l !== null; )
            l.alternate !== null && (a = l), l = l.sibling;
          a === null ? e || t.tail === null ? t.tail = null : t.tail.sibling = null : a.sibling = null;
      }
  }
  function Tt(t) {
    var e = t.alternate !== null && t.alternate.child === t.child, l = 0, a = 0;
    if (e)
      for (var n = t.child; n !== null; )
        l |= n.lanes | n.childLanes, a |= n.subtreeFlags & 65011712, a |= n.flags & 65011712, n.return = t, n = n.sibling;
    else
      for (n = t.child; n !== null; )
        l |= n.lanes | n.childLanes, a |= n.subtreeFlags, a |= n.flags, n.return = t, n = n.sibling;
    return t.subtreeFlags |= a, t.childLanes = l, e;
  }
  function Jy(t, e, l) {
    var a = e.pendingProps;
    switch (Xi(e), e.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return Tt(e), null;
      case 1:
        return Tt(e), null;
      case 3:
        return l = e.stateNode, a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Ze(Rt), _t(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (oa(e) ? Fe(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, Vi())), Tt(e), null;
      case 26:
        var n = e.type, u = e.memoizedState;
        return t === null ? (Fe(e), u !== null ? (Tt(e), yr(e, u)) : (Tt(e), Hc(
          e,
          n,
          null,
          a,
          l
        ))) : u ? u !== t.memoizedState ? (Fe(e), Tt(e), yr(e, u)) : (Tt(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== a && Fe(e), Tt(e), Hc(
          e,
          n,
          t,
          a,
          l
        )), null;
      case 27:
        if (jn(e), l = et.current, n = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== a && Fe(e);
        else {
          if (!a) {
            if (e.stateNode === null)
              throw Error(f(166));
            return Tt(e), null;
          }
          t = B.current, oa(e) ? Kf(e) : (t = Ed(n, a, l), e.stateNode = t, Fe(e));
        }
        return Tt(e), null;
      case 5:
        if (jn(e), n = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== a && Fe(e);
        else {
          if (!a) {
            if (e.stateNode === null)
              throw Error(f(166));
            return Tt(e), null;
          }
          if (u = B.current, oa(e))
            Kf(e);
          else {
            var c = wu(
              et.current
            );
            switch (u) {
              case 1:
                u = c.createElementNS(
                  "http://www.w3.org/2000/svg",
                  n
                );
                break;
              case 2:
                u = c.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  n
                );
                break;
              default:
                switch (n) {
                  case "svg":
                    u = c.createElementNS(
                      "http://www.w3.org/2000/svg",
                      n
                    );
                    break;
                  case "math":
                    u = c.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      n
                    );
                    break;
                  case "script":
                    u = c.createElement("div"), u.innerHTML = "<script><\/script>", u = u.removeChild(
                      u.firstChild
                    );
                    break;
                  case "select":
                    u = typeof a.is == "string" ? c.createElement("select", {
                      is: a.is
                    }) : c.createElement("select"), a.multiple ? u.multiple = !0 : a.size && (u.size = a.size);
                    break;
                  default:
                    u = typeof a.is == "string" ? c.createElement(n, { is: a.is }) : c.createElement(n);
                }
            }
            u[Yt] = e, u[$t] = a;
            t: for (c = e.child; c !== null; ) {
              if (c.tag === 5 || c.tag === 6)
                u.appendChild(c.stateNode);
              else if (c.tag !== 4 && c.tag !== 27 && c.child !== null) {
                c.child.return = c, c = c.child;
                continue;
              }
              if (c === e) break t;
              for (; c.sibling === null; ) {
                if (c.return === null || c.return === e)
                  break t;
                c = c.return;
              }
              c.sibling.return = c.return, c = c.sibling;
            }
            e.stateNode = u;
            t: switch (Zt(u, n, a), n) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                a = !!a.autoFocus;
                break t;
              case "img":
                a = !0;
                break t;
              default:
                a = !1;
            }
            a && Fe(e);
          }
        }
        return Tt(e), Hc(
          e,
          e.type,
          t === null ? null : t.memoizedProps,
          e.pendingProps,
          l
        ), null;
      case 6:
        if (t && e.stateNode != null)
          t.memoizedProps !== a && Fe(e);
        else {
          if (typeof a != "string" && e.stateNode === null)
            throw Error(f(166));
          if (t = et.current, oa(e)) {
            if (t = e.stateNode, l = e.memoizedProps, a = null, n = Gt, n !== null)
              switch (n.tag) {
                case 27:
                case 5:
                  a = n.memoizedProps;
              }
            t[Yt] = e, t = !!(t.nodeValue === l || a !== null && a.suppressHydrationWarning === !0 || od(t.nodeValue, l)), t || sl(e, !0);
          } else
            t = wu(t).createTextNode(
              a
            ), t[Yt] = e, e.stateNode = t;
        }
        return Tt(e), null;
      case 31:
        if (l = e.memoizedState, t === null || t.memoizedState !== null) {
          if (a = oa(e), l !== null) {
            if (t === null) {
              if (!a) throw Error(f(318));
              if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(f(557));
              t[Yt] = e;
            } else
              Bl(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Tt(e), t = !1;
          } else
            l = Vi(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
          if (!t)
            return e.flags & 256 ? (de(e), e) : (de(e), null);
          if ((e.flags & 128) !== 0)
            throw Error(f(558));
        }
        return Tt(e), null;
      case 13:
        if (a = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (n = oa(e), a !== null && a.dehydrated !== null) {
            if (t === null) {
              if (!n) throw Error(f(318));
              if (n = e.memoizedState, n = n !== null ? n.dehydrated : null, !n) throw Error(f(317));
              n[Yt] = e;
            } else
              Bl(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Tt(e), n = !1;
          } else
            n = Vi(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), n = !0;
          if (!n)
            return e.flags & 256 ? (de(e), e) : (de(e), null);
        }
        return de(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = a !== null, t = t !== null && t.memoizedState !== null, l && (a = e.child, n = null, a.alternate !== null && a.alternate.memoizedState !== null && a.alternate.memoizedState.cachePool !== null && (n = a.alternate.memoizedState.cachePool.pool), u = null, a.memoizedState !== null && a.memoizedState.cachePool !== null && (u = a.memoizedState.cachePool.pool), u !== n && (a.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), Tu(e, e.updateQueue), Tt(e), null);
      case 4:
        return _t(), t === null && as(e.stateNode.containerInfo), Tt(e), null;
      case 10:
        return Ze(e.type), Tt(e), null;
      case 19:
        if (M(Mt), a = e.memoizedState, a === null) return Tt(e), null;
        if (n = (e.flags & 128) !== 0, u = a.rendering, u === null)
          if (n) fn(a, !1);
          else {
            if (Ct !== 0 || t !== null && (t.flags & 128) !== 0)
              for (t = e.child; t !== null; ) {
                if (u = ou(t), u !== null) {
                  for (e.flags |= 128, fn(a, !1), t = u.updateQueue, e.updateQueue = t, Tu(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                    Gf(l, t), l = l.sibling;
                  return H(
                    Mt,
                    Mt.current & 1 | 2
                  ), it && Le(e, a.treeForkCount), e.child;
                }
                t = t.sibling;
              }
            a.tail !== null && ie() > _u && (e.flags |= 128, n = !0, fn(a, !1), e.lanes = 4194304);
          }
        else {
          if (!n)
            if (t = ou(u), t !== null) {
              if (e.flags |= 128, n = !0, t = t.updateQueue, e.updateQueue = t, Tu(e, t), fn(a, !0), a.tail === null && a.tailMode === "hidden" && !u.alternate && !it)
                return Tt(e), null;
            } else
              2 * ie() - a.renderingStartTime > _u && l !== 536870912 && (e.flags |= 128, n = !0, fn(a, !1), e.lanes = 4194304);
          a.isBackwards ? (u.sibling = e.child, e.child = u) : (t = a.last, t !== null ? t.sibling = u : e.child = u, a.last = u);
        }
        return a.tail !== null ? (t = a.tail, a.rendering = t, a.tail = t.sibling, a.renderingStartTime = ie(), t.sibling = null, l = Mt.current, H(
          Mt,
          n ? l & 1 | 2 : l & 1
        ), it && Le(e, a.treeForkCount), t) : (Tt(e), null);
      case 22:
      case 23:
        return de(e), nc(), a = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== a && (e.flags |= 8192) : a && (e.flags |= 8192), a ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Tt(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Tt(e), l = e.updateQueue, l !== null && Tu(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), a = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), a !== l && (e.flags |= 2048), t !== null && M(Yl), null;
      case 24:
        return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Ze(Rt), Tt(e), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(f(156, e.tag));
  }
  function Fy(t, e) {
    switch (Xi(e), e.tag) {
      case 1:
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 3:
        return Ze(Rt), _t(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
      case 26:
      case 27:
      case 5:
        return jn(e), null;
      case 31:
        if (e.memoizedState !== null) {
          if (de(e), e.alternate === null)
            throw Error(f(340));
          Bl();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 13:
        if (de(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
          if (e.alternate === null)
            throw Error(f(340));
          Bl();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 19:
        return M(Mt), null;
      case 4:
        return _t(), null;
      case 10:
        return Ze(e.type), null;
      case 22:
      case 23:
        return de(e), nc(), t !== null && M(Yl), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 24:
        return Ze(Rt), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function mr(t, e) {
    switch (Xi(e), e.tag) {
      case 3:
        Ze(Rt), _t();
        break;
      case 26:
      case 27:
      case 5:
        jn(e);
        break;
      case 4:
        _t();
        break;
      case 31:
        e.memoizedState !== null && de(e);
        break;
      case 13:
        de(e);
        break;
      case 19:
        M(Mt);
        break;
      case 10:
        Ze(e.type);
        break;
      case 22:
      case 23:
        de(e), nc(), t !== null && M(Yl);
        break;
      case 24:
        Ze(Rt);
    }
  }
  function on(t, e) {
    try {
      var l = e.updateQueue, a = l !== null ? l.lastEffect : null;
      if (a !== null) {
        var n = a.next;
        l = n;
        do {
          if ((l.tag & t) === t) {
            a = void 0;
            var u = l.create, c = l.inst;
            a = u(), c.destroy = a;
          }
          l = l.next;
        } while (l !== n);
      }
    } catch (o) {
      dt(e, e.return, o);
    }
  }
  function ml(t, e, l) {
    try {
      var a = e.updateQueue, n = a !== null ? a.lastEffect : null;
      if (n !== null) {
        var u = n.next;
        a = u;
        do {
          if ((a.tag & t) === t) {
            var c = a.inst, o = c.destroy;
            if (o !== void 0) {
              c.destroy = void 0, n = e;
              var d = l, S = o;
              try {
                S();
              } catch (T) {
                dt(
                  n,
                  d,
                  T
                );
              }
            }
          }
          a = a.next;
        } while (a !== u);
      }
    } catch (T) {
      dt(e, e.return, T);
    }
  }
  function vr(t) {
    var e = t.updateQueue;
    if (e !== null) {
      var l = t.stateNode;
      try {
        uo(e, l);
      } catch (a) {
        dt(t, t.return, a);
      }
    }
  }
  function gr(t, e, l) {
    l.props = Vl(
      t.type,
      t.memoizedProps
    ), l.state = t.memoizedState;
    try {
      l.componentWillUnmount();
    } catch (a) {
      dt(t, e, a);
    }
  }
  function rn(t, e) {
    try {
      var l = t.ref;
      if (l !== null) {
        switch (t.tag) {
          case 26:
          case 27:
          case 5:
            var a = t.stateNode;
            break;
          case 30:
            a = t.stateNode;
            break;
          default:
            a = t.stateNode;
        }
        typeof l == "function" ? t.refCleanup = l(a) : l.current = a;
      }
    } catch (n) {
      dt(t, e, n);
    }
  }
  function je(t, e) {
    var l = t.ref, a = t.refCleanup;
    if (l !== null)
      if (typeof a == "function")
        try {
          a();
        } catch (n) {
          dt(t, e, n);
        } finally {
          t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
        }
      else if (typeof l == "function")
        try {
          l(null);
        } catch (n) {
          dt(t, e, n);
        }
      else l.current = null;
  }
  function pr(t) {
    var e = t.type, l = t.memoizedProps, a = t.stateNode;
    try {
      t: switch (e) {
        case "button":
        case "input":
        case "select":
        case "textarea":
          l.autoFocus && a.focus();
          break t;
        case "img":
          l.src ? a.src = l.src : l.srcSet && (a.srcset = l.srcSet);
      }
    } catch (n) {
      dt(t, t.return, n);
    }
  }
  function qc(t, e, l) {
    try {
      var a = t.stateNode;
      vm(a, t.type, l, e), a[$t] = e;
    } catch (n) {
      dt(t, t.return, n);
    }
  }
  function Sr(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && Al(t.type) || t.tag === 4;
  }
  function Bc(t) {
    t: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Sr(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.tag === 27 && Al(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function wc(t, e, l) {
    var a = t.tag;
    if (a === 5 || a === 6)
      t = t.stateNode, e ? (l.nodeType === 9 ? l.body : l.nodeName === "HTML" ? l.ownerDocument.body : l).insertBefore(t, e) : (e = l.nodeType === 9 ? l.body : l.nodeName === "HTML" ? l.ownerDocument.body : l, e.appendChild(t), l = l._reactRootContainer, l != null || e.onclick !== null || (e.onclick = Qe));
    else if (a !== 4 && (a === 27 && Al(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
      for (wc(t, e, l), t = t.sibling; t !== null; )
        wc(t, e, l), t = t.sibling;
  }
  function zu(t, e, l) {
    var a = t.tag;
    if (a === 5 || a === 6)
      t = t.stateNode, e ? l.insertBefore(t, e) : l.appendChild(t);
    else if (a !== 4 && (a === 27 && Al(t.type) && (l = t.stateNode), t = t.child, t !== null))
      for (zu(t, e, l), t = t.sibling; t !== null; )
        zu(t, e, l), t = t.sibling;
  }
  function br(t) {
    var e = t.stateNode, l = t.memoizedProps;
    try {
      for (var a = t.type, n = e.attributes; n.length; )
        e.removeAttributeNode(n[0]);
      Zt(e, a, l), e[Yt] = t, e[$t] = l;
    } catch (u) {
      dt(t, t.return, u);
    }
  }
  var We = !1, jt = !1, Qc = !1, Er = typeof WeakSet == "function" ? WeakSet : Set, wt = null;
  function Wy(t, e) {
    if (t = t.containerInfo, is = Vu, t = Uf(t), Ui(t)) {
      if ("selectionStart" in t)
        var l = {
          start: t.selectionStart,
          end: t.selectionEnd
        };
      else
        t: {
          l = (l = t.ownerDocument) && l.defaultView || window;
          var a = l.getSelection && l.getSelection();
          if (a && a.rangeCount !== 0) {
            l = a.anchorNode;
            var n = a.anchorOffset, u = a.focusNode;
            a = a.focusOffset;
            try {
              l.nodeType, u.nodeType;
            } catch {
              l = null;
              break t;
            }
            var c = 0, o = -1, d = -1, S = 0, T = 0, _ = t, b = null;
            e: for (; ; ) {
              for (var E; _ !== l || n !== 0 && _.nodeType !== 3 || (o = c + n), _ !== u || a !== 0 && _.nodeType !== 3 || (d = c + a), _.nodeType === 3 && (c += _.nodeValue.length), (E = _.firstChild) !== null; )
                b = _, _ = E;
              for (; ; ) {
                if (_ === t) break e;
                if (b === l && ++S === n && (o = c), b === u && ++T === a && (d = c), (E = _.nextSibling) !== null) break;
                _ = b, b = _.parentNode;
              }
              _ = E;
            }
            l = o === -1 || d === -1 ? null : { start: o, end: d };
          } else l = null;
        }
      l = l || { start: 0, end: 0 };
    } else l = null;
    for (cs = { focusedElem: t, selectionRange: l }, Vu = !1, wt = e; wt !== null; )
      if (e = wt, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
        t.return = e, wt = t;
      else
        for (; wt !== null; ) {
          switch (e = wt, u = e.alternate, t = e.flags, e.tag) {
            case 0:
              if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                for (l = 0; l < t.length; l++)
                  n = t[l], n.ref.impl = n.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((t & 1024) !== 0 && u !== null) {
                t = void 0, l = e, n = u.memoizedProps, u = u.memoizedState, a = l.stateNode;
                try {
                  var q = Vl(
                    l.type,
                    n
                  );
                  t = a.getSnapshotBeforeUpdate(
                    q,
                    u
                  ), a.__reactInternalSnapshotBeforeUpdate = t;
                } catch (L) {
                  dt(
                    l,
                    l.return,
                    L
                  );
                }
              }
              break;
            case 3:
              if ((t & 1024) !== 0) {
                if (t = e.stateNode.containerInfo, l = t.nodeType, l === 9)
                  os(t);
                else if (l === 1)
                  switch (t.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      os(t);
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
              if ((t & 1024) !== 0) throw Error(f(163));
          }
          if (t = e.sibling, t !== null) {
            t.return = e.return, wt = t;
            break;
          }
          wt = e.return;
        }
  }
  function Ar(t, e, l) {
    var a = l.flags;
    switch (l.tag) {
      case 0:
      case 11:
      case 15:
        $e(t, l), a & 4 && on(5, l);
        break;
      case 1:
        if ($e(t, l), a & 4)
          if (t = l.stateNode, e === null)
            try {
              t.componentDidMount();
            } catch (c) {
              dt(l, l.return, c);
            }
          else {
            var n = Vl(
              l.type,
              e.memoizedProps
            );
            e = e.memoizedState;
            try {
              t.componentDidUpdate(
                n,
                e,
                t.__reactInternalSnapshotBeforeUpdate
              );
            } catch (c) {
              dt(
                l,
                l.return,
                c
              );
            }
          }
        a & 64 && vr(l), a & 512 && rn(l, l.return);
        break;
      case 3:
        if ($e(t, l), a & 64 && (t = l.updateQueue, t !== null)) {
          if (e = null, l.child !== null)
            switch (l.child.tag) {
              case 27:
              case 5:
                e = l.child.stateNode;
                break;
              case 1:
                e = l.child.stateNode;
            }
          try {
            uo(t, e);
          } catch (c) {
            dt(l, l.return, c);
          }
        }
        break;
      case 27:
        e === null && a & 4 && br(l);
      case 26:
      case 5:
        $e(t, l), e === null && a & 4 && pr(l), a & 512 && rn(l, l.return);
        break;
      case 12:
        $e(t, l);
        break;
      case 31:
        $e(t, l), a & 4 && Or(t, l);
        break;
      case 13:
        $e(t, l), a & 4 && Dr(t, l), a & 64 && (t = l.memoizedState, t !== null && (t = t.dehydrated, t !== null && (l = nm.bind(
          null,
          l
        ), zm(t, l))));
        break;
      case 22:
        if (a = l.memoizedState !== null || We, !a) {
          e = e !== null && e.memoizedState !== null || jt, n = We;
          var u = jt;
          We = a, (jt = e) && !u ? Ie(
            t,
            l,
            (l.subtreeFlags & 8772) !== 0
          ) : $e(t, l), We = n, jt = u;
        }
        break;
      case 30:
        break;
      default:
        $e(t, l);
    }
  }
  function Tr(t) {
    var e = t.alternate;
    e !== null && (t.alternate = null, Tr(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && mi(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  var zt = null, Pt = !1;
  function ke(t, e, l) {
    for (l = l.child; l !== null; )
      zr(t, e, l), l = l.sibling;
  }
  function zr(t, e, l) {
    if (ce && typeof ce.onCommitFiberUnmount == "function")
      try {
        ce.onCommitFiberUnmount(ja, l);
      } catch {
      }
    switch (l.tag) {
      case 26:
        jt || je(l, e), ke(
          t,
          e,
          l
        ), l.memoizedState ? l.memoizedState.count-- : l.stateNode && (l = l.stateNode, l.parentNode.removeChild(l));
        break;
      case 27:
        jt || je(l, e);
        var a = zt, n = Pt;
        Al(l.type) && (zt = l.stateNode, Pt = !1), ke(
          t,
          e,
          l
        ), bn(l.stateNode), zt = a, Pt = n;
        break;
      case 5:
        jt || je(l, e);
      case 6:
        if (a = zt, n = Pt, zt = null, ke(
          t,
          e,
          l
        ), zt = a, Pt = n, zt !== null)
          if (Pt)
            try {
              (zt.nodeType === 9 ? zt.body : zt.nodeName === "HTML" ? zt.ownerDocument.body : zt).removeChild(l.stateNode);
            } catch (u) {
              dt(
                l,
                e,
                u
              );
            }
          else
            try {
              zt.removeChild(l.stateNode);
            } catch (u) {
              dt(
                l,
                e,
                u
              );
            }
        break;
      case 18:
        zt !== null && (Pt ? (t = zt, vd(
          t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t,
          l.stateNode
        ), Ra(t)) : vd(zt, l.stateNode));
        break;
      case 4:
        a = zt, n = Pt, zt = l.stateNode.containerInfo, Pt = !0, ke(
          t,
          e,
          l
        ), zt = a, Pt = n;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        ml(2, l, e), jt || ml(4, l, e), ke(
          t,
          e,
          l
        );
        break;
      case 1:
        jt || (je(l, e), a = l.stateNode, typeof a.componentWillUnmount == "function" && gr(
          l,
          e,
          a
        )), ke(
          t,
          e,
          l
        );
        break;
      case 21:
        ke(
          t,
          e,
          l
        );
        break;
      case 22:
        jt = (a = jt) || l.memoizedState !== null, ke(
          t,
          e,
          l
        ), jt = a;
        break;
      default:
        ke(
          t,
          e,
          l
        );
    }
  }
  function Or(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
      t = t.dehydrated;
      try {
        Ra(t);
      } catch (l) {
        dt(e, e.return, l);
      }
    }
  }
  function Dr(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
      try {
        Ra(t);
      } catch (l) {
        dt(e, e.return, l);
      }
  }
  function ky(t) {
    switch (t.tag) {
      case 31:
      case 13:
      case 19:
        var e = t.stateNode;
        return e === null && (e = t.stateNode = new Er()), e;
      case 22:
        return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Er()), e;
      default:
        throw Error(f(435, t.tag));
    }
  }
  function Ou(t, e) {
    var l = ky(t);
    e.forEach(function(a) {
      if (!l.has(a)) {
        l.add(a);
        var n = um.bind(null, t, a);
        a.then(n, n);
      }
    });
  }
  function te(t, e) {
    var l = e.deletions;
    if (l !== null)
      for (var a = 0; a < l.length; a++) {
        var n = l[a], u = t, c = e, o = c;
        t: for (; o !== null; ) {
          switch (o.tag) {
            case 27:
              if (Al(o.type)) {
                zt = o.stateNode, Pt = !1;
                break t;
              }
              break;
            case 5:
              zt = o.stateNode, Pt = !1;
              break t;
            case 3:
            case 4:
              zt = o.stateNode.containerInfo, Pt = !0;
              break t;
          }
          o = o.return;
        }
        if (zt === null) throw Error(f(160));
        zr(u, c, n), zt = null, Pt = !1, u = n.alternate, u !== null && (u.return = null), n.return = null;
      }
    if (e.subtreeFlags & 13886)
      for (e = e.child; e !== null; )
        Cr(e, t), e = e.sibling;
  }
  var Me = null;
  function Cr(t, e) {
    var l = t.alternate, a = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        te(e, t), ee(t), a & 4 && (ml(3, t, t.return), on(3, t), ml(5, t, t.return));
        break;
      case 1:
        te(e, t), ee(t), a & 512 && (jt || l === null || je(l, l.return)), a & 64 && We && (t = t.updateQueue, t !== null && (a = t.callbacks, a !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? a : l.concat(a))));
        break;
      case 26:
        var n = Me;
        if (te(e, t), ee(t), a & 512 && (jt || l === null || je(l, l.return)), a & 4) {
          var u = l !== null ? l.memoizedState : null;
          if (a = t.memoizedState, l === null)
            if (a === null)
              if (t.stateNode === null) {
                t: {
                  a = t.type, l = t.memoizedProps, n = n.ownerDocument || n;
                  e: switch (a) {
                    case "title":
                      u = n.getElementsByTagName("title")[0], (!u || u[Ba] || u[Yt] || u.namespaceURI === "http://www.w3.org/2000/svg" || u.hasAttribute("itemprop")) && (u = n.createElement(a), n.head.insertBefore(
                        u,
                        n.querySelector("head > title")
                      )), Zt(u, a, l), u[Yt] = t, Bt(u), a = u;
                      break t;
                    case "link":
                      var c = Cd(
                        "link",
                        "href",
                        n
                      ).get(a + (l.href || ""));
                      if (c) {
                        for (var o = 0; o < c.length; o++)
                          if (u = c[o], u.getAttribute("href") === (l.href == null || l.href === "" ? null : l.href) && u.getAttribute("rel") === (l.rel == null ? null : l.rel) && u.getAttribute("title") === (l.title == null ? null : l.title) && u.getAttribute("crossorigin") === (l.crossOrigin == null ? null : l.crossOrigin)) {
                            c.splice(o, 1);
                            break e;
                          }
                      }
                      u = n.createElement(a), Zt(u, a, l), n.head.appendChild(u);
                      break;
                    case "meta":
                      if (c = Cd(
                        "meta",
                        "content",
                        n
                      ).get(a + (l.content || ""))) {
                        for (o = 0; o < c.length; o++)
                          if (u = c[o], u.getAttribute("content") === (l.content == null ? null : "" + l.content) && u.getAttribute("name") === (l.name == null ? null : l.name) && u.getAttribute("property") === (l.property == null ? null : l.property) && u.getAttribute("http-equiv") === (l.httpEquiv == null ? null : l.httpEquiv) && u.getAttribute("charset") === (l.charSet == null ? null : l.charSet)) {
                            c.splice(o, 1);
                            break e;
                          }
                      }
                      u = n.createElement(a), Zt(u, a, l), n.head.appendChild(u);
                      break;
                    default:
                      throw Error(f(468, a));
                  }
                  u[Yt] = t, Bt(u), a = u;
                }
                t.stateNode = a;
              } else
                _d(
                  n,
                  t.type,
                  t.stateNode
                );
            else
              t.stateNode = Dd(
                n,
                a,
                t.memoizedProps
              );
          else
            u !== a ? (u === null ? l.stateNode !== null && (l = l.stateNode, l.parentNode.removeChild(l)) : u.count--, a === null ? _d(
              n,
              t.type,
              t.stateNode
            ) : Dd(
              n,
              a,
              t.memoizedProps
            )) : a === null && t.stateNode !== null && qc(
              t,
              t.memoizedProps,
              l.memoizedProps
            );
        }
        break;
      case 27:
        te(e, t), ee(t), a & 512 && (jt || l === null || je(l, l.return)), l !== null && a & 4 && qc(
          t,
          t.memoizedProps,
          l.memoizedProps
        );
        break;
      case 5:
        if (te(e, t), ee(t), a & 512 && (jt || l === null || je(l, l.return)), t.flags & 32) {
          n = t.stateNode;
          try {
            ta(n, "");
          } catch (q) {
            dt(t, t.return, q);
          }
        }
        a & 4 && t.stateNode != null && (n = t.memoizedProps, qc(
          t,
          n,
          l !== null ? l.memoizedProps : n
        )), a & 1024 && (Qc = !0);
        break;
      case 6:
        if (te(e, t), ee(t), a & 4) {
          if (t.stateNode === null)
            throw Error(f(162));
          a = t.memoizedProps, l = t.stateNode;
          try {
            l.nodeValue = a;
          } catch (q) {
            dt(t, t.return, q);
          }
        }
        break;
      case 3:
        if (Gu = null, n = Me, Me = Qu(e.containerInfo), te(e, t), Me = n, ee(t), a & 4 && l !== null && l.memoizedState.isDehydrated)
          try {
            Ra(e.containerInfo);
          } catch (q) {
            dt(t, t.return, q);
          }
        Qc && (Qc = !1, _r(t));
        break;
      case 4:
        a = Me, Me = Qu(
          t.stateNode.containerInfo
        ), te(e, t), ee(t), Me = a;
        break;
      case 12:
        te(e, t), ee(t);
        break;
      case 31:
        te(e, t), ee(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Ou(t, a)));
        break;
      case 13:
        te(e, t), ee(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Cu = ie()), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Ou(t, a)));
        break;
      case 22:
        n = t.memoizedState !== null;
        var d = l !== null && l.memoizedState !== null, S = We, T = jt;
        if (We = S || n, jt = T || d, te(e, t), jt = T, We = S, ee(t), a & 8192)
          t: for (e = t.stateNode, e._visibility = n ? e._visibility & -2 : e._visibility | 1, n && (l === null || d || We || jt || Kl(t)), l = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (l === null) {
                d = l = e;
                try {
                  if (u = d.stateNode, n)
                    c = u.style, typeof c.setProperty == "function" ? c.setProperty("display", "none", "important") : c.display = "none";
                  else {
                    o = d.stateNode;
                    var _ = d.memoizedProps.style, b = _ != null && _.hasOwnProperty("display") ? _.display : null;
                    o.style.display = b == null || typeof b == "boolean" ? "" : ("" + b).trim();
                  }
                } catch (q) {
                  dt(d, d.return, q);
                }
              }
            } else if (e.tag === 6) {
              if (l === null) {
                d = e;
                try {
                  d.stateNode.nodeValue = n ? "" : d.memoizedProps;
                } catch (q) {
                  dt(d, d.return, q);
                }
              }
            } else if (e.tag === 18) {
              if (l === null) {
                d = e;
                try {
                  var E = d.stateNode;
                  n ? gd(E, !0) : gd(d.stateNode, !1);
                } catch (q) {
                  dt(d, d.return, q);
                }
              }
            } else if ((e.tag !== 22 && e.tag !== 23 || e.memoizedState === null || e === t) && e.child !== null) {
              e.child.return = e, e = e.child;
              continue;
            }
            if (e === t) break t;
            for (; e.sibling === null; ) {
              if (e.return === null || e.return === t) break t;
              l === e && (l = null), e = e.return;
            }
            l === e && (l = null), e.sibling.return = e.return, e = e.sibling;
          }
        a & 4 && (a = t.updateQueue, a !== null && (l = a.retryQueue, l !== null && (a.retryQueue = null, Ou(t, l))));
        break;
      case 19:
        te(e, t), ee(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Ou(t, a)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        te(e, t), ee(t);
    }
  }
  function ee(t) {
    var e = t.flags;
    if (e & 2) {
      try {
        for (var l, a = t.return; a !== null; ) {
          if (Sr(a)) {
            l = a;
            break;
          }
          a = a.return;
        }
        if (l == null) throw Error(f(160));
        switch (l.tag) {
          case 27:
            var n = l.stateNode, u = Bc(t);
            zu(t, u, n);
            break;
          case 5:
            var c = l.stateNode;
            l.flags & 32 && (ta(c, ""), l.flags &= -33);
            var o = Bc(t);
            zu(t, o, c);
            break;
          case 3:
          case 4:
            var d = l.stateNode.containerInfo, S = Bc(t);
            wc(
              t,
              S,
              d
            );
            break;
          default:
            throw Error(f(161));
        }
      } catch (T) {
        dt(t, t.return, T);
      }
      t.flags &= -3;
    }
    e & 4096 && (t.flags &= -4097);
  }
  function _r(t) {
    if (t.subtreeFlags & 1024)
      for (t = t.child; t !== null; ) {
        var e = t;
        _r(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
  }
  function $e(t, e) {
    if (e.subtreeFlags & 8772)
      for (e = e.child; e !== null; )
        Ar(t, e.alternate, e), e = e.sibling;
  }
  function Kl(t) {
    for (t = t.child; t !== null; ) {
      var e = t;
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          ml(4, e, e.return), Kl(e);
          break;
        case 1:
          je(e, e.return);
          var l = e.stateNode;
          typeof l.componentWillUnmount == "function" && gr(
            e,
            e.return,
            l
          ), Kl(e);
          break;
        case 27:
          bn(e.stateNode);
        case 26:
        case 5:
          je(e, e.return), Kl(e);
          break;
        case 22:
          e.memoizedState === null && Kl(e);
          break;
        case 30:
          Kl(e);
          break;
        default:
          Kl(e);
      }
      t = t.sibling;
    }
  }
  function Ie(t, e, l) {
    for (l = l && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
      var a = e.alternate, n = t, u = e, c = u.flags;
      switch (u.tag) {
        case 0:
        case 11:
        case 15:
          Ie(
            n,
            u,
            l
          ), on(4, u);
          break;
        case 1:
          if (Ie(
            n,
            u,
            l
          ), a = u, n = a.stateNode, typeof n.componentDidMount == "function")
            try {
              n.componentDidMount();
            } catch (S) {
              dt(a, a.return, S);
            }
          if (a = u, n = a.updateQueue, n !== null) {
            var o = a.stateNode;
            try {
              var d = n.shared.hiddenCallbacks;
              if (d !== null)
                for (n.shared.hiddenCallbacks = null, n = 0; n < d.length; n++)
                  no(d[n], o);
            } catch (S) {
              dt(a, a.return, S);
            }
          }
          l && c & 64 && vr(u), rn(u, u.return);
          break;
        case 27:
          br(u);
        case 26:
        case 5:
          Ie(
            n,
            u,
            l
          ), l && a === null && c & 4 && pr(u), rn(u, u.return);
          break;
        case 12:
          Ie(
            n,
            u,
            l
          );
          break;
        case 31:
          Ie(
            n,
            u,
            l
          ), l && c & 4 && Or(n, u);
          break;
        case 13:
          Ie(
            n,
            u,
            l
          ), l && c & 4 && Dr(n, u);
          break;
        case 22:
          u.memoizedState === null && Ie(
            n,
            u,
            l
          ), rn(u, u.return);
          break;
        case 30:
          break;
        default:
          Ie(
            n,
            u,
            l
          );
      }
      e = e.sibling;
    }
  }
  function Yc(t, e) {
    var l = null;
    t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && ka(l));
  }
  function Gc(t, e) {
    t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && ka(t));
  }
  function Ne(t, e, l, a) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        Mr(
          t,
          e,
          l,
          a
        ), e = e.sibling;
  }
  function Mr(t, e, l, a) {
    var n = e.flags;
    switch (e.tag) {
      case 0:
      case 11:
      case 15:
        Ne(
          t,
          e,
          l,
          a
        ), n & 2048 && on(9, e);
        break;
      case 1:
        Ne(
          t,
          e,
          l,
          a
        );
        break;
      case 3:
        Ne(
          t,
          e,
          l,
          a
        ), n & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && ka(t)));
        break;
      case 12:
        if (n & 2048) {
          Ne(
            t,
            e,
            l,
            a
          ), t = e.stateNode;
          try {
            var u = e.memoizedProps, c = u.id, o = u.onPostCommit;
            typeof o == "function" && o(
              c,
              e.alternate === null ? "mount" : "update",
              t.passiveEffectDuration,
              -0
            );
          } catch (d) {
            dt(e, e.return, d);
          }
        } else
          Ne(
            t,
            e,
            l,
            a
          );
        break;
      case 31:
        Ne(
          t,
          e,
          l,
          a
        );
        break;
      case 13:
        Ne(
          t,
          e,
          l,
          a
        );
        break;
      case 23:
        break;
      case 22:
        u = e.stateNode, c = e.alternate, e.memoizedState !== null ? u._visibility & 2 ? Ne(
          t,
          e,
          l,
          a
        ) : dn(t, e) : u._visibility & 2 ? Ne(
          t,
          e,
          l,
          a
        ) : (u._visibility |= 2, ba(
          t,
          e,
          l,
          a,
          (e.subtreeFlags & 10256) !== 0 || !1
        )), n & 2048 && Yc(c, e);
        break;
      case 24:
        Ne(
          t,
          e,
          l,
          a
        ), n & 2048 && Gc(e.alternate, e);
        break;
      default:
        Ne(
          t,
          e,
          l,
          a
        );
    }
  }
  function ba(t, e, l, a, n) {
    for (n = n && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
      var u = t, c = e, o = l, d = a, S = c.flags;
      switch (c.tag) {
        case 0:
        case 11:
        case 15:
          ba(
            u,
            c,
            o,
            d,
            n
          ), on(8, c);
          break;
        case 23:
          break;
        case 22:
          var T = c.stateNode;
          c.memoizedState !== null ? T._visibility & 2 ? ba(
            u,
            c,
            o,
            d,
            n
          ) : dn(
            u,
            c
          ) : (T._visibility |= 2, ba(
            u,
            c,
            o,
            d,
            n
          )), n && S & 2048 && Yc(
            c.alternate,
            c
          );
          break;
        case 24:
          ba(
            u,
            c,
            o,
            d,
            n
          ), n && S & 2048 && Gc(c.alternate, c);
          break;
        default:
          ba(
            u,
            c,
            o,
            d,
            n
          );
      }
      e = e.sibling;
    }
  }
  function dn(t, e) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) {
        var l = t, a = e, n = a.flags;
        switch (a.tag) {
          case 22:
            dn(l, a), n & 2048 && Yc(
              a.alternate,
              a
            );
            break;
          case 24:
            dn(l, a), n & 2048 && Gc(a.alternate, a);
            break;
          default:
            dn(l, a);
        }
        e = e.sibling;
      }
  }
  var hn = 8192;
  function Ea(t, e, l) {
    if (t.subtreeFlags & hn)
      for (t = t.child; t !== null; )
        Nr(
          t,
          e,
          l
        ), t = t.sibling;
  }
  function Nr(t, e, l) {
    switch (t.tag) {
      case 26:
        Ea(
          t,
          e,
          l
        ), t.flags & hn && t.memoizedState !== null && qm(
          l,
          Me,
          t.memoizedState,
          t.memoizedProps
        );
        break;
      case 5:
        Ea(
          t,
          e,
          l
        );
        break;
      case 3:
      case 4:
        var a = Me;
        Me = Qu(t.stateNode.containerInfo), Ea(
          t,
          e,
          l
        ), Me = a;
        break;
      case 22:
        t.memoizedState === null && (a = t.alternate, a !== null && a.memoizedState !== null ? (a = hn, hn = 16777216, Ea(
          t,
          e,
          l
        ), hn = a) : Ea(
          t,
          e,
          l
        ));
        break;
      default:
        Ea(
          t,
          e,
          l
        );
    }
  }
  function Rr(t) {
    var e = t.alternate;
    if (e !== null && (t = e.child, t !== null)) {
      e.child = null;
      do
        e = t.sibling, t.sibling = null, t = e;
      while (t !== null);
    }
  }
  function yn(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var l = 0; l < e.length; l++) {
          var a = e[l];
          wt = a, xr(
            a,
            t
          );
        }
      Rr(t);
    }
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; )
        Ur(t), t = t.sibling;
  }
  function Ur(t) {
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        yn(t), t.flags & 2048 && ml(9, t, t.return);
        break;
      case 3:
        yn(t);
        break;
      case 12:
        yn(t);
        break;
      case 22:
        var e = t.stateNode;
        t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Du(t)) : yn(t);
        break;
      default:
        yn(t);
    }
  }
  function Du(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var l = 0; l < e.length; l++) {
          var a = e[l];
          wt = a, xr(
            a,
            t
          );
        }
      Rr(t);
    }
    for (t = t.child; t !== null; ) {
      switch (e = t, e.tag) {
        case 0:
        case 11:
        case 15:
          ml(8, e, e.return), Du(e);
          break;
        case 22:
          l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, Du(e));
          break;
        default:
          Du(e);
      }
      t = t.sibling;
    }
  }
  function xr(t, e) {
    for (; wt !== null; ) {
      var l = wt;
      switch (l.tag) {
        case 0:
        case 11:
        case 15:
          ml(8, l, e);
          break;
        case 23:
        case 22:
          if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
            var a = l.memoizedState.cachePool.pool;
            a != null && a.refCount++;
          }
          break;
        case 24:
          ka(l.memoizedState.cache);
      }
      if (a = l.child, a !== null) a.return = l, wt = a;
      else
        t: for (l = t; wt !== null; ) {
          a = wt;
          var n = a.sibling, u = a.return;
          if (Tr(a), a === l) {
            wt = null;
            break t;
          }
          if (n !== null) {
            n.return = u, wt = n;
            break t;
          }
          wt = u;
        }
    }
  }
  var $y = {
    getCacheForType: function(t) {
      var e = Lt(Rt), l = e.data.get(t);
      return l === void 0 && (l = t(), e.data.set(t, l)), l;
    },
    cacheSignal: function() {
      return Lt(Rt).controller.signal;
    }
  }, Iy = typeof WeakMap == "function" ? WeakMap : Map, ft = 0, pt = null, lt = null, nt = 0, rt = 0, he = null, vl = !1, Aa = !1, Lc = !1, Pe = 0, Ct = 0, gl = 0, Jl = 0, Xc = 0, ye = 0, Ta = 0, mn = null, le = null, Zc = !1, Cu = 0, jr = 0, _u = 1 / 0, Mu = null, pl = null, qt = 0, Sl = null, za = null, tl = 0, Vc = 0, Kc = null, Hr = null, vn = 0, Jc = null;
  function me() {
    return (ft & 2) !== 0 && nt !== 0 ? nt & -nt : O.T !== null ? Pc() : Ws();
  }
  function qr() {
    if (ye === 0)
      if ((nt & 536870912) === 0 || it) {
        var t = Bn;
        Bn <<= 1, (Bn & 3932160) === 0 && (Bn = 262144), ye = t;
      } else ye = 536870912;
    return t = re.current, t !== null && (t.flags |= 32), ye;
  }
  function ae(t, e, l) {
    (t === pt && (rt === 2 || rt === 9) || t.cancelPendingCommit !== null) && (Oa(t, 0), bl(
      t,
      nt,
      ye,
      !1
    )), qa(t, l), ((ft & 2) === 0 || t !== pt) && (t === pt && ((ft & 2) === 0 && (Jl |= l), Ct === 4 && bl(
      t,
      nt,
      ye,
      !1
    )), He(t));
  }
  function Br(t, e, l) {
    if ((ft & 6) !== 0) throw Error(f(327));
    var a = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || Ha(t, e), n = a ? em(t, e) : Wc(t, e, !0), u = a;
    do {
      if (n === 0) {
        Aa && !a && bl(t, e, 0, !1);
        break;
      } else {
        if (l = t.current.alternate, u && !Py(l)) {
          n = Wc(t, e, !1), u = !1;
          continue;
        }
        if (n === 2) {
          if (u = e, t.errorRecoveryDisabledLanes & u)
            var c = 0;
          else
            c = t.pendingLanes & -536870913, c = c !== 0 ? c : c & 536870912 ? 536870912 : 0;
          if (c !== 0) {
            e = c;
            t: {
              var o = t;
              n = mn;
              var d = o.current.memoizedState.isDehydrated;
              if (d && (Oa(o, c).flags |= 256), c = Wc(
                o,
                c,
                !1
              ), c !== 2) {
                if (Lc && !d) {
                  o.errorRecoveryDisabledLanes |= u, Jl |= u, n = 4;
                  break t;
                }
                u = le, le = n, u !== null && (le === null ? le = u : le.push.apply(
                  le,
                  u
                ));
              }
              n = c;
            }
            if (u = !1, n !== 2) continue;
          }
        }
        if (n === 1) {
          Oa(t, 0), bl(t, e, 0, !0);
          break;
        }
        t: {
          switch (a = t, u = n, u) {
            case 0:
            case 1:
              throw Error(f(345));
            case 4:
              if ((e & 4194048) !== e) break;
            case 6:
              bl(
                a,
                e,
                ye,
                !vl
              );
              break t;
            case 2:
              le = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(f(329));
          }
          if ((e & 62914560) === e && (n = Cu + 300 - ie(), 10 < n)) {
            if (bl(
              a,
              e,
              ye,
              !vl
            ), Qn(a, 0, !0) !== 0) break t;
            tl = e, a.timeoutHandle = yd(
              wr.bind(
                null,
                a,
                l,
                le,
                Mu,
                Zc,
                e,
                ye,
                Jl,
                Ta,
                vl,
                u,
                "Throttled",
                -0,
                0
              ),
              n
            );
            break t;
          }
          wr(
            a,
            l,
            le,
            Mu,
            Zc,
            e,
            ye,
            Jl,
            Ta,
            vl,
            u,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    He(t);
  }
  function wr(t, e, l, a, n, u, c, o, d, S, T, _, b, E) {
    if (t.timeoutHandle = -1, _ = e.subtreeFlags, _ & 8192 || (_ & 16785408) === 16785408) {
      _ = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: Qe
      }, Nr(
        e,
        u,
        _
      );
      var q = (u & 62914560) === u ? Cu - ie() : (u & 4194048) === u ? jr - ie() : 0;
      if (q = Bm(
        _,
        q
      ), q !== null) {
        tl = u, t.cancelPendingCommit = q(
          Kr.bind(
            null,
            t,
            e,
            u,
            l,
            a,
            n,
            c,
            o,
            d,
            T,
            _,
            null,
            b,
            E
          )
        ), bl(t, u, c, !S);
        return;
      }
    }
    Kr(
      t,
      e,
      u,
      l,
      a,
      n,
      c,
      o,
      d
    );
  }
  function Py(t) {
    for (var e = t; ; ) {
      var l = e.tag;
      if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
        for (var a = 0; a < l.length; a++) {
          var n = l[a], u = n.getSnapshot;
          n = n.value;
          try {
            if (!fe(u(), n)) return !1;
          } catch {
            return !1;
          }
        }
      if (l = e.child, e.subtreeFlags & 16384 && l !== null)
        l.return = e, e = l;
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
  function bl(t, e, l, a) {
    e &= ~Xc, e &= ~Jl, t.suspendedLanes |= e, t.pingedLanes &= ~e, a && (t.warmLanes |= e), a = t.expirationTimes;
    for (var n = e; 0 < n; ) {
      var u = 31 - se(n), c = 1 << u;
      a[u] = -1, n &= ~c;
    }
    l !== 0 && Ks(t, l, e);
  }
  function Nu() {
    return (ft & 6) === 0 ? (gn(0), !1) : !0;
  }
  function Fc() {
    if (lt !== null) {
      if (rt === 0)
        var t = lt.return;
      else
        t = lt, Xe = wl = null, oc(t), ma = null, Ia = 0, t = lt;
      for (; t !== null; )
        mr(t.alternate, t), t = t.return;
      lt = null;
    }
  }
  function Oa(t, e) {
    var l = t.timeoutHandle;
    l !== -1 && (t.timeoutHandle = -1, Sm(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), tl = 0, Fc(), pt = t, lt = l = Ge(t.current, null), nt = e, rt = 0, he = null, vl = !1, Aa = Ha(t, e), Lc = !1, Ta = ye = Xc = Jl = gl = Ct = 0, le = mn = null, Zc = !1, (e & 8) !== 0 && (e |= e & 32);
    var a = t.entangledLanes;
    if (a !== 0)
      for (t = t.entanglements, a &= e; 0 < a; ) {
        var n = 31 - se(a), u = 1 << n;
        e |= t[n], a &= ~u;
      }
    return Pe = e, $n(), l;
  }
  function Qr(t, e) {
    $ = null, O.H = cn, e === ya || e === uu ? (e = to(), rt = 3) : e === Ii ? (e = to(), rt = 4) : rt = e === Dc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, he = e, lt === null && (Ct = 1, Su(
      t,
      Se(e, t.current)
    ));
  }
  function Yr() {
    var t = re.current;
    return t === null ? !0 : (nt & 4194048) === nt ? Te === null : (nt & 62914560) === nt || (nt & 536870912) !== 0 ? t === Te : !1;
  }
  function Gr() {
    var t = O.H;
    return O.H = cn, t === null ? cn : t;
  }
  function Lr() {
    var t = O.A;
    return O.A = $y, t;
  }
  function Ru() {
    Ct = 4, vl || (nt & 4194048) !== nt && re.current !== null || (Aa = !0), (gl & 134217727) === 0 && (Jl & 134217727) === 0 || pt === null || bl(
      pt,
      nt,
      ye,
      !1
    );
  }
  function Wc(t, e, l) {
    var a = ft;
    ft |= 2;
    var n = Gr(), u = Lr();
    (pt !== t || nt !== e) && (Mu = null, Oa(t, e)), e = !1;
    var c = Ct;
    t: do
      try {
        if (rt !== 0 && lt !== null) {
          var o = lt, d = he;
          switch (rt) {
            case 8:
              Fc(), c = 6;
              break t;
            case 3:
            case 2:
            case 9:
            case 6:
              re.current === null && (e = !0);
              var S = rt;
              if (rt = 0, he = null, Da(t, o, d, S), l && Aa) {
                c = 0;
                break t;
              }
              break;
            default:
              S = rt, rt = 0, he = null, Da(t, o, d, S);
          }
        }
        tm(), c = Ct;
        break;
      } catch (T) {
        Qr(t, T);
      }
    while (!0);
    return e && t.shellSuspendCounter++, Xe = wl = null, ft = a, O.H = n, O.A = u, lt === null && (pt = null, nt = 0, $n()), c;
  }
  function tm() {
    for (; lt !== null; ) Xr(lt);
  }
  function em(t, e) {
    var l = ft;
    ft |= 2;
    var a = Gr(), n = Lr();
    pt !== t || nt !== e ? (Mu = null, _u = ie() + 500, Oa(t, e)) : Aa = Ha(
      t,
      e
    );
    t: do
      try {
        if (rt !== 0 && lt !== null) {
          e = lt;
          var u = he;
          e: switch (rt) {
            case 1:
              rt = 0, he = null, Da(t, e, u, 1);
              break;
            case 2:
            case 9:
              if (If(u)) {
                rt = 0, he = null, Zr(e);
                break;
              }
              e = function() {
                rt !== 2 && rt !== 9 || pt !== t || (rt = 7), He(t);
              }, u.then(e, e);
              break t;
            case 3:
              rt = 7;
              break t;
            case 4:
              rt = 5;
              break t;
            case 7:
              If(u) ? (rt = 0, he = null, Zr(e)) : (rt = 0, he = null, Da(t, e, u, 7));
              break;
            case 5:
              var c = null;
              switch (lt.tag) {
                case 26:
                  c = lt.memoizedState;
                case 5:
                case 27:
                  var o = lt;
                  if (c ? Md(c) : o.stateNode.complete) {
                    rt = 0, he = null;
                    var d = o.sibling;
                    if (d !== null) lt = d;
                    else {
                      var S = o.return;
                      S !== null ? (lt = S, Uu(S)) : lt = null;
                    }
                    break e;
                  }
              }
              rt = 0, he = null, Da(t, e, u, 5);
              break;
            case 6:
              rt = 0, he = null, Da(t, e, u, 6);
              break;
            case 8:
              Fc(), Ct = 6;
              break t;
            default:
              throw Error(f(462));
          }
        }
        lm();
        break;
      } catch (T) {
        Qr(t, T);
      }
    while (!0);
    return Xe = wl = null, O.H = a, O.A = n, ft = l, lt !== null ? 0 : (pt = null, nt = 0, $n(), Ct);
  }
  function lm() {
    for (; lt !== null && !Oh(); )
      Xr(lt);
  }
  function Xr(t) {
    var e = hr(t.alternate, t, Pe);
    t.memoizedProps = t.pendingProps, e === null ? Uu(t) : lt = e;
  }
  function Zr(t) {
    var e = t, l = e.alternate;
    switch (e.tag) {
      case 15:
      case 0:
        e = cr(
          l,
          e,
          e.pendingProps,
          e.type,
          void 0,
          nt
        );
        break;
      case 11:
        e = cr(
          l,
          e,
          e.pendingProps,
          e.type.render,
          e.ref,
          nt
        );
        break;
      case 5:
        oc(e);
      default:
        mr(l, e), e = lt = Gf(e, Pe), e = hr(l, e, Pe);
    }
    t.memoizedProps = t.pendingProps, e === null ? Uu(t) : lt = e;
  }
  function Da(t, e, l, a) {
    Xe = wl = null, oc(e), ma = null, Ia = 0;
    var n = e.return;
    try {
      if (Zy(
        t,
        n,
        e,
        l,
        nt
      )) {
        Ct = 1, Su(
          t,
          Se(l, t.current)
        ), lt = null;
        return;
      }
    } catch (u) {
      if (n !== null) throw lt = n, u;
      Ct = 1, Su(
        t,
        Se(l, t.current)
      ), lt = null;
      return;
    }
    e.flags & 32768 ? (it || a === 1 ? t = !0 : Aa || (nt & 536870912) !== 0 ? t = !1 : (vl = t = !0, (a === 2 || a === 9 || a === 3 || a === 6) && (a = re.current, a !== null && a.tag === 13 && (a.flags |= 16384))), Vr(e, t)) : Uu(e);
  }
  function Uu(t) {
    var e = t;
    do {
      if ((e.flags & 32768) !== 0) {
        Vr(
          e,
          vl
        );
        return;
      }
      t = e.return;
      var l = Jy(
        e.alternate,
        e,
        Pe
      );
      if (l !== null) {
        lt = l;
        return;
      }
      if (e = e.sibling, e !== null) {
        lt = e;
        return;
      }
      lt = e = t;
    } while (e !== null);
    Ct === 0 && (Ct = 5);
  }
  function Vr(t, e) {
    do {
      var l = Fy(t.alternate, t);
      if (l !== null) {
        l.flags &= 32767, lt = l;
        return;
      }
      if (l = t.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !e && (t = t.sibling, t !== null)) {
        lt = t;
        return;
      }
      lt = t = l;
    } while (t !== null);
    Ct = 6, lt = null;
  }
  function Kr(t, e, l, a, n, u, c, o, d) {
    t.cancelPendingCommit = null;
    do
      xu();
    while (qt !== 0);
    if ((ft & 6) !== 0) throw Error(f(327));
    if (e !== null) {
      if (e === t.current) throw Error(f(177));
      if (u = e.lanes | e.childLanes, u |= Bi, Hh(
        t,
        l,
        u,
        c,
        o,
        d
      ), t === pt && (lt = pt = null, nt = 0), za = e, Sl = t, tl = l, Vc = u, Kc = n, Hr = a, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, im(Hn, function() {
        return $r(), null;
      })) : (t.callbackNode = null, t.callbackPriority = 0), a = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || a) {
        a = O.T, O.T = null, n = j.p, j.p = 2, c = ft, ft |= 4;
        try {
          Wy(t, e, l);
        } finally {
          ft = c, j.p = n, O.T = a;
        }
      }
      qt = 1, Jr(), Fr(), Wr();
    }
  }
  function Jr() {
    if (qt === 1) {
      qt = 0;
      var t = Sl, e = za, l = (e.flags & 13878) !== 0;
      if ((e.subtreeFlags & 13878) !== 0 || l) {
        l = O.T, O.T = null;
        var a = j.p;
        j.p = 2;
        var n = ft;
        ft |= 4;
        try {
          Cr(e, t);
          var u = cs, c = Uf(t.containerInfo), o = u.focusedElem, d = u.selectionRange;
          if (c !== o && o && o.ownerDocument && Rf(
            o.ownerDocument.documentElement,
            o
          )) {
            if (d !== null && Ui(o)) {
              var S = d.start, T = d.end;
              if (T === void 0 && (T = S), "selectionStart" in o)
                o.selectionStart = S, o.selectionEnd = Math.min(
                  T,
                  o.value.length
                );
              else {
                var _ = o.ownerDocument || document, b = _ && _.defaultView || window;
                if (b.getSelection) {
                  var E = b.getSelection(), q = o.textContent.length, L = Math.min(d.start, q), vt = d.end === void 0 ? L : Math.min(d.end, q);
                  !E.extend && L > vt && (c = vt, vt = L, L = c);
                  var m = Nf(
                    o,
                    L
                  ), h = Nf(
                    o,
                    vt
                  );
                  if (m && h && (E.rangeCount !== 1 || E.anchorNode !== m.node || E.anchorOffset !== m.offset || E.focusNode !== h.node || E.focusOffset !== h.offset)) {
                    var p = _.createRange();
                    p.setStart(m.node, m.offset), E.removeAllRanges(), L > vt ? (E.addRange(p), E.extend(h.node, h.offset)) : (p.setEnd(h.node, h.offset), E.addRange(p));
                  }
                }
              }
            }
            for (_ = [], E = o; E = E.parentNode; )
              E.nodeType === 1 && _.push({
                element: E,
                left: E.scrollLeft,
                top: E.scrollTop
              });
            for (typeof o.focus == "function" && o.focus(), o = 0; o < _.length; o++) {
              var C = _[o];
              C.element.scrollLeft = C.left, C.element.scrollTop = C.top;
            }
          }
          Vu = !!is, cs = is = null;
        } finally {
          ft = n, j.p = a, O.T = l;
        }
      }
      t.current = e, qt = 2;
    }
  }
  function Fr() {
    if (qt === 2) {
      qt = 0;
      var t = Sl, e = za, l = (e.flags & 8772) !== 0;
      if ((e.subtreeFlags & 8772) !== 0 || l) {
        l = O.T, O.T = null;
        var a = j.p;
        j.p = 2;
        var n = ft;
        ft |= 4;
        try {
          Ar(t, e.alternate, e);
        } finally {
          ft = n, j.p = a, O.T = l;
        }
      }
      qt = 3;
    }
  }
  function Wr() {
    if (qt === 4 || qt === 3) {
      qt = 0, Dh();
      var t = Sl, e = za, l = tl, a = Hr;
      (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? qt = 5 : (qt = 0, za = Sl = null, kr(t, t.pendingLanes));
      var n = t.pendingLanes;
      if (n === 0 && (pl = null), hi(l), e = e.stateNode, ce && typeof ce.onCommitFiberRoot == "function")
        try {
          ce.onCommitFiberRoot(
            ja,
            e,
            void 0,
            (e.current.flags & 128) === 128
          );
        } catch {
        }
      if (a !== null) {
        e = O.T, n = j.p, j.p = 2, O.T = null;
        try {
          for (var u = t.onRecoverableError, c = 0; c < a.length; c++) {
            var o = a[c];
            u(o.value, {
              componentStack: o.stack
            });
          }
        } finally {
          O.T = e, j.p = n;
        }
      }
      (tl & 3) !== 0 && xu(), He(t), n = t.pendingLanes, (l & 261930) !== 0 && (n & 42) !== 0 ? t === Jc ? vn++ : (vn = 0, Jc = t) : vn = 0, gn(0);
    }
  }
  function kr(t, e) {
    (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, ka(e)));
  }
  function xu() {
    return Jr(), Fr(), Wr(), $r();
  }
  function $r() {
    if (qt !== 5) return !1;
    var t = Sl, e = Vc;
    Vc = 0;
    var l = hi(tl), a = O.T, n = j.p;
    try {
      j.p = 32 > l ? 32 : l, O.T = null, l = Kc, Kc = null;
      var u = Sl, c = tl;
      if (qt = 0, za = Sl = null, tl = 0, (ft & 6) !== 0) throw Error(f(331));
      var o = ft;
      if (ft |= 4, Ur(u.current), Mr(
        u,
        u.current,
        c,
        l
      ), ft = o, gn(0, !1), ce && typeof ce.onPostCommitFiberRoot == "function")
        try {
          ce.onPostCommitFiberRoot(ja, u);
        } catch {
        }
      return !0;
    } finally {
      j.p = n, O.T = a, kr(t, e);
    }
  }
  function Ir(t, e, l) {
    e = Se(l, e), e = Oc(t.stateNode, e, 2), t = dl(t, e, 2), t !== null && (qa(t, 2), He(t));
  }
  function dt(t, e, l) {
    if (t.tag === 3)
      Ir(t, t, l);
    else
      for (; e !== null; ) {
        if (e.tag === 3) {
          Ir(
            e,
            t,
            l
          );
          break;
        } else if (e.tag === 1) {
          var a = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (pl === null || !pl.has(a))) {
            t = Se(l, t), l = Po(2), a = dl(e, l, 2), a !== null && (tr(
              l,
              a,
              e,
              t
            ), qa(a, 2), He(a));
            break;
          }
        }
        e = e.return;
      }
  }
  function kc(t, e, l) {
    var a = t.pingCache;
    if (a === null) {
      a = t.pingCache = new Iy();
      var n = /* @__PURE__ */ new Set();
      a.set(e, n);
    } else
      n = a.get(e), n === void 0 && (n = /* @__PURE__ */ new Set(), a.set(e, n));
    n.has(l) || (Lc = !0, n.add(l), t = am.bind(null, t, e, l), e.then(t, t));
  }
  function am(t, e, l) {
    var a = t.pingCache;
    a !== null && a.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, pt === t && (nt & l) === l && (Ct === 4 || Ct === 3 && (nt & 62914560) === nt && 300 > ie() - Cu ? (ft & 2) === 0 && Oa(t, 0) : Xc |= l, Ta === nt && (Ta = 0)), He(t);
  }
  function Pr(t, e) {
    e === 0 && (e = Vs()), t = Hl(t, e), t !== null && (qa(t, e), He(t));
  }
  function nm(t) {
    var e = t.memoizedState, l = 0;
    e !== null && (l = e.retryLane), Pr(t, l);
  }
  function um(t, e) {
    var l = 0;
    switch (t.tag) {
      case 31:
      case 13:
        var a = t.stateNode, n = t.memoizedState;
        n !== null && (l = n.retryLane);
        break;
      case 19:
        a = t.stateNode;
        break;
      case 22:
        a = t.stateNode._retryCache;
        break;
      default:
        throw Error(f(314));
    }
    a !== null && a.delete(e), Pr(t, l);
  }
  function im(t, e) {
    return fi(t, e);
  }
  var ju = null, Ca = null, $c = !1, Hu = !1, Ic = !1, El = 0;
  function He(t) {
    t !== Ca && t.next === null && (Ca === null ? ju = Ca = t : Ca = Ca.next = t), Hu = !0, $c || ($c = !0, sm());
  }
  function gn(t, e) {
    if (!Ic && Hu) {
      Ic = !0;
      do
        for (var l = !1, a = ju; a !== null; ) {
          if (t !== 0) {
            var n = a.pendingLanes;
            if (n === 0) var u = 0;
            else {
              var c = a.suspendedLanes, o = a.pingedLanes;
              u = (1 << 31 - se(42 | t) + 1) - 1, u &= n & ~(c & ~o), u = u & 201326741 ? u & 201326741 | 1 : u ? u | 2 : 0;
            }
            u !== 0 && (l = !0, ad(a, u));
          } else
            u = nt, u = Qn(
              a,
              a === pt ? u : 0,
              a.cancelPendingCommit !== null || a.timeoutHandle !== -1
            ), (u & 3) === 0 || Ha(a, u) || (l = !0, ad(a, u));
          a = a.next;
        }
      while (l);
      Ic = !1;
    }
  }
  function cm() {
    td();
  }
  function td() {
    Hu = $c = !1;
    var t = 0;
    El !== 0 && pm() && (t = El);
    for (var e = ie(), l = null, a = ju; a !== null; ) {
      var n = a.next, u = ed(a, e);
      u === 0 ? (a.next = null, l === null ? ju = n : l.next = n, n === null && (Ca = l)) : (l = a, (t !== 0 || (u & 3) !== 0) && (Hu = !0)), a = n;
    }
    qt !== 0 && qt !== 5 || gn(t), El !== 0 && (El = 0);
  }
  function ed(t, e) {
    for (var l = t.suspendedLanes, a = t.pingedLanes, n = t.expirationTimes, u = t.pendingLanes & -62914561; 0 < u; ) {
      var c = 31 - se(u), o = 1 << c, d = n[c];
      d === -1 ? ((o & l) === 0 || (o & a) !== 0) && (n[c] = jh(o, e)) : d <= e && (t.expiredLanes |= o), u &= ~o;
    }
    if (e = pt, l = nt, l = Qn(
      t,
      t === e ? l : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), a = t.callbackNode, l === 0 || t === e && (rt === 2 || rt === 9) || t.cancelPendingCommit !== null)
      return a !== null && a !== null && oi(a), t.callbackNode = null, t.callbackPriority = 0;
    if ((l & 3) === 0 || Ha(t, l)) {
      if (e = l & -l, e === t.callbackPriority) return e;
      switch (a !== null && oi(a), hi(l)) {
        case 2:
        case 8:
          l = Xs;
          break;
        case 32:
          l = Hn;
          break;
        case 268435456:
          l = Zs;
          break;
        default:
          l = Hn;
      }
      return a = ld.bind(null, t), l = fi(l, a), t.callbackPriority = e, t.callbackNode = l, e;
    }
    return a !== null && a !== null && oi(a), t.callbackPriority = 2, t.callbackNode = null, 2;
  }
  function ld(t, e) {
    if (qt !== 0 && qt !== 5)
      return t.callbackNode = null, t.callbackPriority = 0, null;
    var l = t.callbackNode;
    if (xu() && t.callbackNode !== l)
      return null;
    var a = nt;
    return a = Qn(
      t,
      t === pt ? a : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), a === 0 ? null : (Br(t, a, e), ed(t, ie()), t.callbackNode != null && t.callbackNode === l ? ld.bind(null, t) : null);
  }
  function ad(t, e) {
    if (xu()) return null;
    Br(t, e, !0);
  }
  function sm() {
    bm(function() {
      (ft & 6) !== 0 ? fi(
        Ls,
        cm
      ) : td();
    });
  }
  function Pc() {
    if (El === 0) {
      var t = da;
      t === 0 && (t = qn, qn <<= 1, (qn & 261888) === 0 && (qn = 256)), El = t;
    }
    return El;
  }
  function nd(t) {
    return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : Xn("" + t);
  }
  function ud(t, e) {
    var l = e.ownerDocument.createElement("input");
    return l.name = e.name, l.value = e.value, t.id && l.setAttribute("form", t.id), e.parentNode.insertBefore(l, e), t = new FormData(t), l.parentNode.removeChild(l), t;
  }
  function fm(t, e, l, a, n) {
    if (e === "submit" && l && l.stateNode === n) {
      var u = nd(
        (n[$t] || null).action
      ), c = a.submitter;
      c && (e = (e = c[$t] || null) ? nd(e.formAction) : c.getAttribute("formAction"), e !== null && (u = e, c = null));
      var o = new Jn(
        "action",
        "action",
        null,
        a,
        n
      );
      t.push({
        event: o,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (a.defaultPrevented) {
                if (El !== 0) {
                  var d = c ? ud(n, c) : new FormData(n);
                  Sc(
                    l,
                    {
                      pending: !0,
                      data: d,
                      method: n.method,
                      action: u
                    },
                    null,
                    d
                  );
                }
              } else
                typeof u == "function" && (o.preventDefault(), d = c ? ud(n, c) : new FormData(n), Sc(
                  l,
                  {
                    pending: !0,
                    data: d,
                    method: n.method,
                    action: u
                  },
                  u,
                  d
                ));
            },
            currentTarget: n
          }
        ]
      });
    }
  }
  for (var ts = 0; ts < qi.length; ts++) {
    var es = qi[ts], om = es.toLowerCase(), rm = es[0].toUpperCase() + es.slice(1);
    _e(
      om,
      "on" + rm
    );
  }
  _e(Hf, "onAnimationEnd"), _e(qf, "onAnimationIteration"), _e(Bf, "onAnimationStart"), _e("dblclick", "onDoubleClick"), _e("focusin", "onFocus"), _e("focusout", "onBlur"), _e(Cy, "onTransitionRun"), _e(_y, "onTransitionStart"), _e(My, "onTransitionCancel"), _e(wf, "onTransitionEnd"), Il("onMouseEnter", ["mouseout", "mouseover"]), Il("onMouseLeave", ["mouseout", "mouseover"]), Il("onPointerEnter", ["pointerout", "pointerover"]), Il("onPointerLeave", ["pointerout", "pointerover"]), Rl(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), Rl(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), Rl("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), Rl(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), Rl(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), Rl(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var pn = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), dm = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(pn)
  );
  function id(t, e) {
    e = (e & 4) !== 0;
    for (var l = 0; l < t.length; l++) {
      var a = t[l], n = a.event;
      a = a.listeners;
      t: {
        var u = void 0;
        if (e)
          for (var c = a.length - 1; 0 <= c; c--) {
            var o = a[c], d = o.instance, S = o.currentTarget;
            if (o = o.listener, d !== u && n.isPropagationStopped())
              break t;
            u = o, n.currentTarget = S;
            try {
              u(n);
            } catch (T) {
              kn(T);
            }
            n.currentTarget = null, u = d;
          }
        else
          for (c = 0; c < a.length; c++) {
            if (o = a[c], d = o.instance, S = o.currentTarget, o = o.listener, d !== u && n.isPropagationStopped())
              break t;
            u = o, n.currentTarget = S;
            try {
              u(n);
            } catch (T) {
              kn(T);
            }
            n.currentTarget = null, u = d;
          }
      }
    }
  }
  function at(t, e) {
    var l = e[yi];
    l === void 0 && (l = e[yi] = /* @__PURE__ */ new Set());
    var a = t + "__bubble";
    l.has(a) || (cd(e, t, 2, !1), l.add(a));
  }
  function ls(t, e, l) {
    var a = 0;
    e && (a |= 4), cd(
      l,
      t,
      a,
      e
    );
  }
  var qu = "_reactListening" + Math.random().toString(36).slice(2);
  function as(t) {
    if (!t[qu]) {
      t[qu] = !0, Is.forEach(function(l) {
        l !== "selectionchange" && (dm.has(l) || ls(l, !1, t), ls(l, !0, t));
      });
      var e = t.nodeType === 9 ? t : t.ownerDocument;
      e === null || e[qu] || (e[qu] = !0, ls("selectionchange", !1, e));
    }
  }
  function cd(t, e, l, a) {
    switch (qd(e)) {
      case 2:
        var n = Ym;
        break;
      case 8:
        n = Gm;
        break;
      default:
        n = ps;
    }
    l = n.bind(
      null,
      e,
      l,
      t
    ), n = void 0, !Ti || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (n = !0), a ? n !== void 0 ? t.addEventListener(e, l, {
      capture: !0,
      passive: n
    }) : t.addEventListener(e, l, !0) : n !== void 0 ? t.addEventListener(e, l, {
      passive: n
    }) : t.addEventListener(e, l, !1);
  }
  function ns(t, e, l, a, n) {
    var u = a;
    if ((e & 1) === 0 && (e & 2) === 0 && a !== null)
      t: for (; ; ) {
        if (a === null) return;
        var c = a.tag;
        if (c === 3 || c === 4) {
          var o = a.stateNode.containerInfo;
          if (o === n) break;
          if (c === 4)
            for (c = a.return; c !== null; ) {
              var d = c.tag;
              if ((d === 3 || d === 4) && c.stateNode.containerInfo === n)
                return;
              c = c.return;
            }
          for (; o !== null; ) {
            if (c = Wl(o), c === null) return;
            if (d = c.tag, d === 5 || d === 6 || d === 26 || d === 27) {
              a = u = c;
              continue t;
            }
            o = o.parentNode;
          }
        }
        a = a.return;
      }
    rf(function() {
      var S = u, T = Ei(l), _ = [];
      t: {
        var b = Qf.get(t);
        if (b !== void 0) {
          var E = Jn, q = t;
          switch (t) {
            case "keypress":
              if (Vn(l) === 0) break t;
            case "keydown":
            case "keyup":
              E = uy;
              break;
            case "focusin":
              q = "focus", E = Ci;
              break;
            case "focusout":
              q = "blur", E = Ci;
              break;
            case "beforeblur":
            case "afterblur":
              E = Ci;
              break;
            case "click":
              if (l.button === 2) break t;
            case "auxclick":
            case "dblclick":
            case "mousedown":
            case "mousemove":
            case "mouseup":
            case "mouseout":
            case "mouseover":
            case "contextmenu":
              E = yf;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              E = Jh;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              E = sy;
              break;
            case Hf:
            case qf:
            case Bf:
              E = kh;
              break;
            case wf:
              E = oy;
              break;
            case "scroll":
            case "scrollend":
              E = Vh;
              break;
            case "wheel":
              E = dy;
              break;
            case "copy":
            case "cut":
            case "paste":
              E = Ih;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              E = vf;
              break;
            case "toggle":
            case "beforetoggle":
              E = yy;
          }
          var L = (e & 4) !== 0, vt = !L && (t === "scroll" || t === "scrollend"), m = L ? b !== null ? b + "Capture" : null : b;
          L = [];
          for (var h = S, p; h !== null; ) {
            var C = h;
            if (p = C.stateNode, C = C.tag, C !== 5 && C !== 26 && C !== 27 || p === null || m === null || (C = Qa(h, m), C != null && L.push(
              Sn(h, C, p)
            )), vt) break;
            h = h.return;
          }
          0 < L.length && (b = new E(
            b,
            q,
            null,
            l,
            T
          ), _.push({ event: b, listeners: L }));
        }
      }
      if ((e & 7) === 0) {
        t: {
          if (b = t === "mouseover" || t === "pointerover", E = t === "mouseout" || t === "pointerout", b && l !== bi && (q = l.relatedTarget || l.fromElement) && (Wl(q) || q[Fl]))
            break t;
          if ((E || b) && (b = T.window === T ? T : (b = T.ownerDocument) ? b.defaultView || b.parentWindow : window, E ? (q = l.relatedTarget || l.toElement, E = S, q = q ? Wl(q) : null, q !== null && (vt = D(q), L = q.tag, q !== vt || L !== 5 && L !== 27 && L !== 6) && (q = null)) : (E = null, q = S), E !== q)) {
            if (L = yf, C = "onMouseLeave", m = "onMouseEnter", h = "mouse", (t === "pointerout" || t === "pointerover") && (L = vf, C = "onPointerLeave", m = "onPointerEnter", h = "pointer"), vt = E == null ? b : wa(E), p = q == null ? b : wa(q), b = new L(
              C,
              h + "leave",
              E,
              l,
              T
            ), b.target = vt, b.relatedTarget = p, C = null, Wl(T) === S && (L = new L(
              m,
              h + "enter",
              q,
              l,
              T
            ), L.target = p, L.relatedTarget = vt, C = L), vt = C, E && q)
              e: {
                for (L = hm, m = E, h = q, p = 0, C = m; C; C = L(C))
                  p++;
                C = 0;
                for (var Q = h; Q; Q = L(Q))
                  C++;
                for (; 0 < p - C; )
                  m = L(m), p--;
                for (; 0 < C - p; )
                  h = L(h), C--;
                for (; p--; ) {
                  if (m === h || h !== null && m === h.alternate) {
                    L = m;
                    break e;
                  }
                  m = L(m), h = L(h);
                }
                L = null;
              }
            else L = null;
            E !== null && sd(
              _,
              b,
              E,
              L,
              !1
            ), q !== null && vt !== null && sd(
              _,
              vt,
              q,
              L,
              !0
            );
          }
        }
        t: {
          if (b = S ? wa(S) : window, E = b.nodeName && b.nodeName.toLowerCase(), E === "select" || E === "input" && b.type === "file")
            var ct = zf;
          else if (Af(b))
            if (Of)
              ct = zy;
            else {
              ct = Ay;
              var w = Ey;
            }
          else
            E = b.nodeName, !E || E.toLowerCase() !== "input" || b.type !== "checkbox" && b.type !== "radio" ? S && Si(S.elementType) && (ct = zf) : ct = Ty;
          if (ct && (ct = ct(t, S))) {
            Tf(
              _,
              ct,
              l,
              T
            );
            break t;
          }
          w && w(t, b, S), t === "focusout" && S && b.type === "number" && S.memoizedProps.value != null && pi(b, "number", b.value);
        }
        switch (w = S ? wa(S) : window, t) {
          case "focusin":
            (Af(w) || w.contentEditable === "true") && (na = w, xi = S, Ja = null);
            break;
          case "focusout":
            Ja = xi = na = null;
            break;
          case "mousedown":
            ji = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            ji = !1, xf(_, l, T);
            break;
          case "selectionchange":
            if (Dy) break;
          case "keydown":
          case "keyup":
            xf(_, l, T);
        }
        var I;
        if (Mi)
          t: {
            switch (t) {
              case "compositionstart":
                var ut = "onCompositionStart";
                break t;
              case "compositionend":
                ut = "onCompositionEnd";
                break t;
              case "compositionupdate":
                ut = "onCompositionUpdate";
                break t;
            }
            ut = void 0;
          }
        else
          aa ? bf(t, l) && (ut = "onCompositionEnd") : t === "keydown" && l.keyCode === 229 && (ut = "onCompositionStart");
        ut && (gf && l.locale !== "ko" && (aa || ut !== "onCompositionStart" ? ut === "onCompositionEnd" && aa && (I = df()) : (ul = T, zi = "value" in ul ? ul.value : ul.textContent, aa = !0)), w = Bu(S, ut), 0 < w.length && (ut = new mf(
          ut,
          t,
          null,
          l,
          T
        ), _.push({ event: ut, listeners: w }), I ? ut.data = I : (I = Ef(l), I !== null && (ut.data = I)))), (I = vy ? gy(t, l) : py(t, l)) && (ut = Bu(S, "onBeforeInput"), 0 < ut.length && (w = new mf(
          "onBeforeInput",
          "beforeinput",
          null,
          l,
          T
        ), _.push({
          event: w,
          listeners: ut
        }), w.data = I)), fm(
          _,
          t,
          S,
          l,
          T
        );
      }
      id(_, e);
    });
  }
  function Sn(t, e, l) {
    return {
      instance: t,
      listener: e,
      currentTarget: l
    };
  }
  function Bu(t, e) {
    for (var l = e + "Capture", a = []; t !== null; ) {
      var n = t, u = n.stateNode;
      if (n = n.tag, n !== 5 && n !== 26 && n !== 27 || u === null || (n = Qa(t, l), n != null && a.unshift(
        Sn(t, n, u)
      ), n = Qa(t, e), n != null && a.push(
        Sn(t, n, u)
      )), t.tag === 3) return a;
      t = t.return;
    }
    return [];
  }
  function hm(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5 && t.tag !== 27);
    return t || null;
  }
  function sd(t, e, l, a, n) {
    for (var u = e._reactName, c = []; l !== null && l !== a; ) {
      var o = l, d = o.alternate, S = o.stateNode;
      if (o = o.tag, d !== null && d === a) break;
      o !== 5 && o !== 26 && o !== 27 || S === null || (d = S, n ? (S = Qa(l, u), S != null && c.unshift(
        Sn(l, S, d)
      )) : n || (S = Qa(l, u), S != null && c.push(
        Sn(l, S, d)
      ))), l = l.return;
    }
    c.length !== 0 && t.push({ event: e, listeners: c });
  }
  var ym = /\r\n?/g, mm = /\u0000|\uFFFD/g;
  function fd(t) {
    return (typeof t == "string" ? t : "" + t).replace(ym, `
`).replace(mm, "");
  }
  function od(t, e) {
    return e = fd(e), fd(t) === e;
  }
  function mt(t, e, l, a, n, u) {
    switch (l) {
      case "children":
        typeof a == "string" ? e === "body" || e === "textarea" && a === "" || ta(t, a) : (typeof a == "number" || typeof a == "bigint") && e !== "body" && ta(t, "" + a);
        break;
      case "className":
        Gn(t, "class", a);
        break;
      case "tabIndex":
        Gn(t, "tabindex", a);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        Gn(t, l, a);
        break;
      case "style":
        ff(t, a, u);
        break;
      case "data":
        if (e !== "object") {
          Gn(t, "data", a);
          break;
        }
      case "src":
      case "href":
        if (a === "" && (e !== "a" || l !== "href")) {
          t.removeAttribute(l);
          break;
        }
        if (a == null || typeof a == "function" || typeof a == "symbol" || typeof a == "boolean") {
          t.removeAttribute(l);
          break;
        }
        a = Xn("" + a), t.setAttribute(l, a);
        break;
      case "action":
      case "formAction":
        if (typeof a == "function") {
          t.setAttribute(
            l,
            "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')"
          );
          break;
        } else
          typeof u == "function" && (l === "formAction" ? (e !== "input" && mt(t, e, "name", n.name, n, null), mt(
            t,
            e,
            "formEncType",
            n.formEncType,
            n,
            null
          ), mt(
            t,
            e,
            "formMethod",
            n.formMethod,
            n,
            null
          ), mt(
            t,
            e,
            "formTarget",
            n.formTarget,
            n,
            null
          )) : (mt(t, e, "encType", n.encType, n, null), mt(t, e, "method", n.method, n, null), mt(t, e, "target", n.target, n, null)));
        if (a == null || typeof a == "symbol" || typeof a == "boolean") {
          t.removeAttribute(l);
          break;
        }
        a = Xn("" + a), t.setAttribute(l, a);
        break;
      case "onClick":
        a != null && (t.onclick = Qe);
        break;
      case "onScroll":
        a != null && at("scroll", t);
        break;
      case "onScrollEnd":
        a != null && at("scrollend", t);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(f(61));
          if (l = a.__html, l != null) {
            if (n.children != null) throw Error(f(60));
            t.innerHTML = l;
          }
        }
        break;
      case "multiple":
        t.multiple = a && typeof a != "function" && typeof a != "symbol";
        break;
      case "muted":
        t.muted = a && typeof a != "function" && typeof a != "symbol";
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
        if (a == null || typeof a == "function" || typeof a == "boolean" || typeof a == "symbol") {
          t.removeAttribute("xlink:href");
          break;
        }
        l = Xn("" + a), t.setAttributeNS(
          "http://www.w3.org/1999/xlink",
          "xlink:href",
          l
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
        a != null && typeof a != "function" && typeof a != "symbol" ? t.setAttribute(l, "" + a) : t.removeAttribute(l);
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
        a && typeof a != "function" && typeof a != "symbol" ? t.setAttribute(l, "") : t.removeAttribute(l);
        break;
      case "capture":
      case "download":
        a === !0 ? t.setAttribute(l, "") : a !== !1 && a != null && typeof a != "function" && typeof a != "symbol" ? t.setAttribute(l, a) : t.removeAttribute(l);
        break;
      case "cols":
      case "rows":
      case "size":
      case "span":
        a != null && typeof a != "function" && typeof a != "symbol" && !isNaN(a) && 1 <= a ? t.setAttribute(l, a) : t.removeAttribute(l);
        break;
      case "rowSpan":
      case "start":
        a == null || typeof a == "function" || typeof a == "symbol" || isNaN(a) ? t.removeAttribute(l) : t.setAttribute(l, a);
        break;
      case "popover":
        at("beforetoggle", t), at("toggle", t), Yn(t, "popover", a);
        break;
      case "xlinkActuate":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          a
        );
        break;
      case "xlinkArcrole":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          a
        );
        break;
      case "xlinkRole":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          a
        );
        break;
      case "xlinkShow":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          a
        );
        break;
      case "xlinkTitle":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          a
        );
        break;
      case "xlinkType":
        we(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          a
        );
        break;
      case "xmlBase":
        we(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          a
        );
        break;
      case "xmlLang":
        we(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          a
        );
        break;
      case "xmlSpace":
        we(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          a
        );
        break;
      case "is":
        Yn(t, "is", a);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < l.length) || l[0] !== "o" && l[0] !== "O" || l[1] !== "n" && l[1] !== "N") && (l = Xh.get(l) || l, Yn(t, l, a));
    }
  }
  function us(t, e, l, a, n, u) {
    switch (l) {
      case "style":
        ff(t, a, u);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(f(61));
          if (l = a.__html, l != null) {
            if (n.children != null) throw Error(f(60));
            t.innerHTML = l;
          }
        }
        break;
      case "children":
        typeof a == "string" ? ta(t, a) : (typeof a == "number" || typeof a == "bigint") && ta(t, "" + a);
        break;
      case "onScroll":
        a != null && at("scroll", t);
        break;
      case "onScrollEnd":
        a != null && at("scrollend", t);
        break;
      case "onClick":
        a != null && (t.onclick = Qe);
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
        if (!Ps.hasOwnProperty(l))
          t: {
            if (l[0] === "o" && l[1] === "n" && (n = l.endsWith("Capture"), e = l.slice(2, n ? l.length - 7 : void 0), u = t[$t] || null, u = u != null ? u[l] : null, typeof u == "function" && t.removeEventListener(e, u, n), typeof a == "function")) {
              typeof u != "function" && u !== null && (l in t ? t[l] = null : t.hasAttribute(l) && t.removeAttribute(l)), t.addEventListener(e, a, n);
              break t;
            }
            l in t ? t[l] = a : a === !0 ? t.setAttribute(l, "") : Yn(t, l, a);
          }
    }
  }
  function Zt(t, e, l) {
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
        at("error", t), at("load", t);
        var a = !1, n = !1, u;
        for (u in l)
          if (l.hasOwnProperty(u)) {
            var c = l[u];
            if (c != null)
              switch (u) {
                case "src":
                  a = !0;
                  break;
                case "srcSet":
                  n = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(f(137, e));
                default:
                  mt(t, e, u, c, l, null);
              }
          }
        n && mt(t, e, "srcSet", l.srcSet, l, null), a && mt(t, e, "src", l.src, l, null);
        return;
      case "input":
        at("invalid", t);
        var o = u = c = n = null, d = null, S = null;
        for (a in l)
          if (l.hasOwnProperty(a)) {
            var T = l[a];
            if (T != null)
              switch (a) {
                case "name":
                  n = T;
                  break;
                case "type":
                  c = T;
                  break;
                case "checked":
                  d = T;
                  break;
                case "defaultChecked":
                  S = T;
                  break;
                case "value":
                  u = T;
                  break;
                case "defaultValue":
                  o = T;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (T != null)
                    throw Error(f(137, e));
                  break;
                default:
                  mt(t, e, a, T, l, null);
              }
          }
        nf(
          t,
          u,
          o,
          d,
          S,
          c,
          n,
          !1
        );
        return;
      case "select":
        at("invalid", t), a = c = u = null;
        for (n in l)
          if (l.hasOwnProperty(n) && (o = l[n], o != null))
            switch (n) {
              case "value":
                u = o;
                break;
              case "defaultValue":
                c = o;
                break;
              case "multiple":
                a = o;
              default:
                mt(t, e, n, o, l, null);
            }
        e = u, l = c, t.multiple = !!a, e != null ? Pl(t, !!a, e, !1) : l != null && Pl(t, !!a, l, !0);
        return;
      case "textarea":
        at("invalid", t), u = n = a = null;
        for (c in l)
          if (l.hasOwnProperty(c) && (o = l[c], o != null))
            switch (c) {
              case "value":
                a = o;
                break;
              case "defaultValue":
                n = o;
                break;
              case "children":
                u = o;
                break;
              case "dangerouslySetInnerHTML":
                if (o != null) throw Error(f(91));
                break;
              default:
                mt(t, e, c, o, l, null);
            }
        cf(t, a, n, u);
        return;
      case "option":
        for (d in l)
          l.hasOwnProperty(d) && (a = l[d], a != null) && (d === "selected" ? t.selected = a && typeof a != "function" && typeof a != "symbol" : mt(t, e, d, a, l, null));
        return;
      case "dialog":
        at("beforetoggle", t), at("toggle", t), at("cancel", t), at("close", t);
        break;
      case "iframe":
      case "object":
        at("load", t);
        break;
      case "video":
      case "audio":
        for (a = 0; a < pn.length; a++)
          at(pn[a], t);
        break;
      case "image":
        at("error", t), at("load", t);
        break;
      case "details":
        at("toggle", t);
        break;
      case "embed":
      case "source":
      case "link":
        at("error", t), at("load", t);
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
        for (S in l)
          if (l.hasOwnProperty(S) && (a = l[S], a != null))
            switch (S) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(f(137, e));
              default:
                mt(t, e, S, a, l, null);
            }
        return;
      default:
        if (Si(e)) {
          for (T in l)
            l.hasOwnProperty(T) && (a = l[T], a !== void 0 && us(
              t,
              e,
              T,
              a,
              l,
              void 0
            ));
          return;
        }
    }
    for (o in l)
      l.hasOwnProperty(o) && (a = l[o], a != null && mt(t, e, o, a, l, null));
  }
  function vm(t, e, l, a) {
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
        var n = null, u = null, c = null, o = null, d = null, S = null, T = null;
        for (E in l) {
          var _ = l[E];
          if (l.hasOwnProperty(E) && _ != null)
            switch (E) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                d = _;
              default:
                a.hasOwnProperty(E) || mt(t, e, E, null, a, _);
            }
        }
        for (var b in a) {
          var E = a[b];
          if (_ = l[b], a.hasOwnProperty(b) && (E != null || _ != null))
            switch (b) {
              case "type":
                u = E;
                break;
              case "name":
                n = E;
                break;
              case "checked":
                S = E;
                break;
              case "defaultChecked":
                T = E;
                break;
              case "value":
                c = E;
                break;
              case "defaultValue":
                o = E;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (E != null)
                  throw Error(f(137, e));
                break;
              default:
                E !== _ && mt(
                  t,
                  e,
                  b,
                  E,
                  a,
                  _
                );
            }
        }
        gi(
          t,
          c,
          o,
          d,
          S,
          T,
          u,
          n
        );
        return;
      case "select":
        E = c = o = b = null;
        for (u in l)
          if (d = l[u], l.hasOwnProperty(u) && d != null)
            switch (u) {
              case "value":
                break;
              case "multiple":
                E = d;
              default:
                a.hasOwnProperty(u) || mt(
                  t,
                  e,
                  u,
                  null,
                  a,
                  d
                );
            }
        for (n in a)
          if (u = a[n], d = l[n], a.hasOwnProperty(n) && (u != null || d != null))
            switch (n) {
              case "value":
                b = u;
                break;
              case "defaultValue":
                o = u;
                break;
              case "multiple":
                c = u;
              default:
                u !== d && mt(
                  t,
                  e,
                  n,
                  u,
                  a,
                  d
                );
            }
        e = o, l = c, a = E, b != null ? Pl(t, !!l, b, !1) : !!a != !!l && (e != null ? Pl(t, !!l, e, !0) : Pl(t, !!l, l ? [] : "", !1));
        return;
      case "textarea":
        E = b = null;
        for (o in l)
          if (n = l[o], l.hasOwnProperty(o) && n != null && !a.hasOwnProperty(o))
            switch (o) {
              case "value":
                break;
              case "children":
                break;
              default:
                mt(t, e, o, null, a, n);
            }
        for (c in a)
          if (n = a[c], u = l[c], a.hasOwnProperty(c) && (n != null || u != null))
            switch (c) {
              case "value":
                b = n;
                break;
              case "defaultValue":
                E = n;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (n != null) throw Error(f(91));
                break;
              default:
                n !== u && mt(t, e, c, n, a, u);
            }
        uf(t, b, E);
        return;
      case "option":
        for (var q in l)
          b = l[q], l.hasOwnProperty(q) && b != null && !a.hasOwnProperty(q) && (q === "selected" ? t.selected = !1 : mt(
            t,
            e,
            q,
            null,
            a,
            b
          ));
        for (d in a)
          b = a[d], E = l[d], a.hasOwnProperty(d) && b !== E && (b != null || E != null) && (d === "selected" ? t.selected = b && typeof b != "function" && typeof b != "symbol" : mt(
            t,
            e,
            d,
            b,
            a,
            E
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
        for (var L in l)
          b = l[L], l.hasOwnProperty(L) && b != null && !a.hasOwnProperty(L) && mt(t, e, L, null, a, b);
        for (S in a)
          if (b = a[S], E = l[S], a.hasOwnProperty(S) && b !== E && (b != null || E != null))
            switch (S) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (b != null)
                  throw Error(f(137, e));
                break;
              default:
                mt(
                  t,
                  e,
                  S,
                  b,
                  a,
                  E
                );
            }
        return;
      default:
        if (Si(e)) {
          for (var vt in l)
            b = l[vt], l.hasOwnProperty(vt) && b !== void 0 && !a.hasOwnProperty(vt) && us(
              t,
              e,
              vt,
              void 0,
              a,
              b
            );
          for (T in a)
            b = a[T], E = l[T], !a.hasOwnProperty(T) || b === E || b === void 0 && E === void 0 || us(
              t,
              e,
              T,
              b,
              a,
              E
            );
          return;
        }
    }
    for (var m in l)
      b = l[m], l.hasOwnProperty(m) && b != null && !a.hasOwnProperty(m) && mt(t, e, m, null, a, b);
    for (_ in a)
      b = a[_], E = l[_], !a.hasOwnProperty(_) || b === E || b == null && E == null || mt(t, e, _, b, a, E);
  }
  function rd(t) {
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
  function gm() {
    if (typeof performance.getEntriesByType == "function") {
      for (var t = 0, e = 0, l = performance.getEntriesByType("resource"), a = 0; a < l.length; a++) {
        var n = l[a], u = n.transferSize, c = n.initiatorType, o = n.duration;
        if (u && o && rd(c)) {
          for (c = 0, o = n.responseEnd, a += 1; a < l.length; a++) {
            var d = l[a], S = d.startTime;
            if (S > o) break;
            var T = d.transferSize, _ = d.initiatorType;
            T && rd(_) && (d = d.responseEnd, c += T * (d < o ? 1 : (o - S) / (d - S)));
          }
          if (--a, e += 8 * (u + c) / (n.duration / 1e3), t++, 10 < t) break;
        }
      }
      if (0 < t) return e / t / 1e6;
    }
    return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
  }
  var is = null, cs = null;
  function wu(t) {
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  function dd(t) {
    switch (t) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function hd(t, e) {
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
  function ss(t, e) {
    return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
  }
  var fs = null;
  function pm() {
    var t = window.event;
    return t && t.type === "popstate" ? t === fs ? !1 : (fs = t, !0) : (fs = null, !1);
  }
  var yd = typeof setTimeout == "function" ? setTimeout : void 0, Sm = typeof clearTimeout == "function" ? clearTimeout : void 0, md = typeof Promise == "function" ? Promise : void 0, bm = typeof queueMicrotask == "function" ? queueMicrotask : typeof md < "u" ? function(t) {
    return md.resolve(null).then(t).catch(Em);
  } : yd;
  function Em(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function Al(t) {
    return t === "head";
  }
  function vd(t, e) {
    var l = e, a = 0;
    do {
      var n = l.nextSibling;
      if (t.removeChild(l), n && n.nodeType === 8)
        if (l = n.data, l === "/$" || l === "/&") {
          if (a === 0) {
            t.removeChild(n), Ra(e);
            return;
          }
          a--;
        } else if (l === "$" || l === "$?" || l === "$~" || l === "$!" || l === "&")
          a++;
        else if (l === "html")
          bn(t.ownerDocument.documentElement);
        else if (l === "head") {
          l = t.ownerDocument.head, bn(l);
          for (var u = l.firstChild; u; ) {
            var c = u.nextSibling, o = u.nodeName;
            u[Ba] || o === "SCRIPT" || o === "STYLE" || o === "LINK" && u.rel.toLowerCase() === "stylesheet" || l.removeChild(u), u = c;
          }
        } else
          l === "body" && bn(t.ownerDocument.body);
      l = n;
    } while (l);
    Ra(e);
  }
  function gd(t, e) {
    var l = t;
    t = 0;
    do {
      var a = l.nextSibling;
      if (l.nodeType === 1 ? e ? (l._stashedDisplay = l.style.display, l.style.display = "none") : (l.style.display = l._stashedDisplay || "", l.getAttribute("style") === "" && l.removeAttribute("style")) : l.nodeType === 3 && (e ? (l._stashedText = l.nodeValue, l.nodeValue = "") : l.nodeValue = l._stashedText || ""), a && a.nodeType === 8)
        if (l = a.data, l === "/$") {
          if (t === 0) break;
          t--;
        } else
          l !== "$" && l !== "$?" && l !== "$~" && l !== "$!" || t++;
      l = a;
    } while (l);
  }
  function os(t) {
    var e = t.firstChild;
    for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
      var l = e;
      switch (e = e.nextSibling, l.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          os(l), mi(l);
          continue;
        case "SCRIPT":
        case "STYLE":
          continue;
        case "LINK":
          if (l.rel.toLowerCase() === "stylesheet") continue;
      }
      t.removeChild(l);
    }
  }
  function Am(t, e, l, a) {
    for (; t.nodeType === 1; ) {
      var n = l;
      if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
        if (!a && (t.nodeName !== "INPUT" || t.type !== "hidden"))
          break;
      } else if (a) {
        if (!t[Ba])
          switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (u = t.getAttribute("rel"), u === "stylesheet" && t.hasAttribute("data-precedence"))
                break;
              if (u !== n.rel || t.getAttribute("href") !== (n.href == null || n.href === "" ? null : n.href) || t.getAttribute("crossorigin") !== (n.crossOrigin == null ? null : n.crossOrigin) || t.getAttribute("title") !== (n.title == null ? null : n.title))
                break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (u = t.getAttribute("src"), (u !== (n.src == null ? null : n.src) || t.getAttribute("type") !== (n.type == null ? null : n.type) || t.getAttribute("crossorigin") !== (n.crossOrigin == null ? null : n.crossOrigin)) && u && t.hasAttribute("async") && !t.hasAttribute("itemprop"))
                break;
              return t;
            default:
              return t;
          }
      } else if (e === "input" && t.type === "hidden") {
        var u = n.name == null ? null : "" + n.name;
        if (n.type === "hidden" && t.getAttribute("name") === u)
          return t;
      } else return t;
      if (t = ze(t.nextSibling), t === null) break;
    }
    return null;
  }
  function Tm(t, e, l) {
    if (e === "") return null;
    for (; t.nodeType !== 3; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !l || (t = ze(t.nextSibling), t === null)) return null;
    return t;
  }
  function pd(t, e) {
    for (; t.nodeType !== 8; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = ze(t.nextSibling), t === null)) return null;
    return t;
  }
  function rs(t) {
    return t.data === "$?" || t.data === "$~";
  }
  function ds(t) {
    return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
  }
  function zm(t, e) {
    var l = t.ownerDocument;
    if (t.data === "$~") t._reactRetry = e;
    else if (t.data !== "$?" || l.readyState !== "loading")
      e();
    else {
      var a = function() {
        e(), l.removeEventListener("DOMContentLoaded", a);
      };
      l.addEventListener("DOMContentLoaded", a), t._reactRetry = a;
    }
  }
  function ze(t) {
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
  var hs = null;
  function Sd(t) {
    t = t.nextSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var l = t.data;
        if (l === "/$" || l === "/&") {
          if (e === 0)
            return ze(t.nextSibling);
          e--;
        } else
          l !== "$" && l !== "$!" && l !== "$?" && l !== "$~" && l !== "&" || e++;
      }
      t = t.nextSibling;
    }
    return null;
  }
  function bd(t) {
    t = t.previousSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var l = t.data;
        if (l === "$" || l === "$!" || l === "$?" || l === "$~" || l === "&") {
          if (e === 0) return t;
          e--;
        } else l !== "/$" && l !== "/&" || e++;
      }
      t = t.previousSibling;
    }
    return null;
  }
  function Ed(t, e, l) {
    switch (e = wu(l), t) {
      case "html":
        if (t = e.documentElement, !t) throw Error(f(452));
        return t;
      case "head":
        if (t = e.head, !t) throw Error(f(453));
        return t;
      case "body":
        if (t = e.body, !t) throw Error(f(454));
        return t;
      default:
        throw Error(f(451));
    }
  }
  function bn(t) {
    for (var e = t.attributes; e.length; )
      t.removeAttributeNode(e[0]);
    mi(t);
  }
  var Oe = /* @__PURE__ */ new Map(), Ad = /* @__PURE__ */ new Set();
  function Qu(t) {
    return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
  }
  var el = j.d;
  j.d = {
    f: Om,
    r: Dm,
    D: Cm,
    C: _m,
    L: Mm,
    m: Nm,
    X: Um,
    S: Rm,
    M: xm
  };
  function Om() {
    var t = el.f(), e = Nu();
    return t || e;
  }
  function Dm(t) {
    var e = kl(t);
    e !== null && e.tag === 5 && e.type === "form" ? Qo(e) : el.r(t);
  }
  var _a = typeof document > "u" ? null : document;
  function Td(t, e, l) {
    var a = _a;
    if (a && typeof e == "string" && e) {
      var n = ge(e);
      n = 'link[rel="' + t + '"][href="' + n + '"]', typeof l == "string" && (n += '[crossorigin="' + l + '"]'), Ad.has(n) || (Ad.add(n), t = { rel: t, crossOrigin: l, href: e }, a.querySelector(n) === null && (e = a.createElement("link"), Zt(e, "link", t), Bt(e), a.head.appendChild(e)));
    }
  }
  function Cm(t) {
    el.D(t), Td("dns-prefetch", t, null);
  }
  function _m(t, e) {
    el.C(t, e), Td("preconnect", t, e);
  }
  function Mm(t, e, l) {
    el.L(t, e, l);
    var a = _a;
    if (a && t && e) {
      var n = 'link[rel="preload"][as="' + ge(e) + '"]';
      e === "image" && l && l.imageSrcSet ? (n += '[imagesrcset="' + ge(
        l.imageSrcSet
      ) + '"]', typeof l.imageSizes == "string" && (n += '[imagesizes="' + ge(
        l.imageSizes
      ) + '"]')) : n += '[href="' + ge(t) + '"]';
      var u = n;
      switch (e) {
        case "style":
          u = Ma(t);
          break;
        case "script":
          u = Na(t);
      }
      Oe.has(u) || (t = x(
        {
          rel: "preload",
          href: e === "image" && l && l.imageSrcSet ? void 0 : t,
          as: e
        },
        l
      ), Oe.set(u, t), a.querySelector(n) !== null || e === "style" && a.querySelector(En(u)) || e === "script" && a.querySelector(An(u)) || (e = a.createElement("link"), Zt(e, "link", t), Bt(e), a.head.appendChild(e)));
    }
  }
  function Nm(t, e) {
    el.m(t, e);
    var l = _a;
    if (l && t) {
      var a = e && typeof e.as == "string" ? e.as : "script", n = 'link[rel="modulepreload"][as="' + ge(a) + '"][href="' + ge(t) + '"]', u = n;
      switch (a) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          u = Na(t);
      }
      if (!Oe.has(u) && (t = x({ rel: "modulepreload", href: t }, e), Oe.set(u, t), l.querySelector(n) === null)) {
        switch (a) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (l.querySelector(An(u)))
              return;
        }
        a = l.createElement("link"), Zt(a, "link", t), Bt(a), l.head.appendChild(a);
      }
    }
  }
  function Rm(t, e, l) {
    el.S(t, e, l);
    var a = _a;
    if (a && t) {
      var n = $l(a).hoistableStyles, u = Ma(t);
      e = e || "default";
      var c = n.get(u);
      if (!c) {
        var o = { loading: 0, preload: null };
        if (c = a.querySelector(
          En(u)
        ))
          o.loading = 5;
        else {
          t = x(
            { rel: "stylesheet", href: t, "data-precedence": e },
            l
          ), (l = Oe.get(u)) && ys(t, l);
          var d = c = a.createElement("link");
          Bt(d), Zt(d, "link", t), d._p = new Promise(function(S, T) {
            d.onload = S, d.onerror = T;
          }), d.addEventListener("load", function() {
            o.loading |= 1;
          }), d.addEventListener("error", function() {
            o.loading |= 2;
          }), o.loading |= 4, Yu(c, e, a);
        }
        c = {
          type: "stylesheet",
          instance: c,
          count: 1,
          state: o
        }, n.set(u, c);
      }
    }
  }
  function Um(t, e) {
    el.X(t, e);
    var l = _a;
    if (l && t) {
      var a = $l(l).hoistableScripts, n = Na(t), u = a.get(n);
      u || (u = l.querySelector(An(n)), u || (t = x({ src: t, async: !0 }, e), (e = Oe.get(n)) && ms(t, e), u = l.createElement("script"), Bt(u), Zt(u, "link", t), l.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, a.set(n, u));
    }
  }
  function xm(t, e) {
    el.M(t, e);
    var l = _a;
    if (l && t) {
      var a = $l(l).hoistableScripts, n = Na(t), u = a.get(n);
      u || (u = l.querySelector(An(n)), u || (t = x({ src: t, async: !0, type: "module" }, e), (e = Oe.get(n)) && ms(t, e), u = l.createElement("script"), Bt(u), Zt(u, "link", t), l.head.appendChild(u)), u = {
        type: "script",
        instance: u,
        count: 1,
        state: null
      }, a.set(n, u));
    }
  }
  function zd(t, e, l, a) {
    var n = (n = et.current) ? Qu(n) : null;
    if (!n) throw Error(f(446));
    switch (t) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof l.precedence == "string" && typeof l.href == "string" ? (e = Ma(l.href), l = $l(
          n
        ).hoistableStyles, a = l.get(e), a || (a = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, l.set(e, a)), a) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (l.rel === "stylesheet" && typeof l.href == "string" && typeof l.precedence == "string") {
          t = Ma(l.href);
          var u = $l(
            n
          ).hoistableStyles, c = u.get(t);
          if (c || (n = n.ownerDocument || n, c = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, u.set(t, c), (u = n.querySelector(
            En(t)
          )) && !u._p && (c.instance = u, c.state.loading = 5), Oe.has(t) || (l = {
            rel: "preload",
            as: "style",
            href: l.href,
            crossOrigin: l.crossOrigin,
            integrity: l.integrity,
            media: l.media,
            hrefLang: l.hrefLang,
            referrerPolicy: l.referrerPolicy
          }, Oe.set(t, l), u || jm(
            n,
            t,
            l,
            c.state
          ))), e && a === null)
            throw Error(f(528, ""));
          return c;
        }
        if (e && a !== null)
          throw Error(f(529, ""));
        return null;
      case "script":
        return e = l.async, l = l.src, typeof l == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = Na(l), l = $l(
          n
        ).hoistableScripts, a = l.get(e), a || (a = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, l.set(e, a)), a) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(f(444, t));
    }
  }
  function Ma(t) {
    return 'href="' + ge(t) + '"';
  }
  function En(t) {
    return 'link[rel="stylesheet"][' + t + "]";
  }
  function Od(t) {
    return x({}, t, {
      "data-precedence": t.precedence,
      precedence: null
    });
  }
  function jm(t, e, l, a) {
    t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? a.loading = 1 : (e = t.createElement("link"), a.preload = e, e.addEventListener("load", function() {
      return a.loading |= 1;
    }), e.addEventListener("error", function() {
      return a.loading |= 2;
    }), Zt(e, "link", l), Bt(e), t.head.appendChild(e));
  }
  function Na(t) {
    return '[src="' + ge(t) + '"]';
  }
  function An(t) {
    return "script[async]" + t;
  }
  function Dd(t, e, l) {
    if (e.count++, e.instance === null)
      switch (e.type) {
        case "style":
          var a = t.querySelector(
            'style[data-href~="' + ge(l.href) + '"]'
          );
          if (a)
            return e.instance = a, Bt(a), a;
          var n = x({}, l, {
            "data-href": l.href,
            "data-precedence": l.precedence,
            href: null,
            precedence: null
          });
          return a = (t.ownerDocument || t).createElement(
            "style"
          ), Bt(a), Zt(a, "style", n), Yu(a, l.precedence, t), e.instance = a;
        case "stylesheet":
          n = Ma(l.href);
          var u = t.querySelector(
            En(n)
          );
          if (u)
            return e.state.loading |= 4, e.instance = u, Bt(u), u;
          a = Od(l), (n = Oe.get(n)) && ys(a, n), u = (t.ownerDocument || t).createElement("link"), Bt(u);
          var c = u;
          return c._p = new Promise(function(o, d) {
            c.onload = o, c.onerror = d;
          }), Zt(u, "link", a), e.state.loading |= 4, Yu(u, l.precedence, t), e.instance = u;
        case "script":
          return u = Na(l.src), (n = t.querySelector(
            An(u)
          )) ? (e.instance = n, Bt(n), n) : (a = l, (n = Oe.get(u)) && (a = x({}, l), ms(a, n)), t = t.ownerDocument || t, n = t.createElement("script"), Bt(n), Zt(n, "link", a), t.head.appendChild(n), e.instance = n);
        case "void":
          return null;
        default:
          throw Error(f(443, e.type));
      }
    else
      e.type === "stylesheet" && (e.state.loading & 4) === 0 && (a = e.instance, e.state.loading |= 4, Yu(a, l.precedence, t));
    return e.instance;
  }
  function Yu(t, e, l) {
    for (var a = l.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), n = a.length ? a[a.length - 1] : null, u = n, c = 0; c < a.length; c++) {
      var o = a[c];
      if (o.dataset.precedence === e) u = o;
      else if (u !== n) break;
    }
    u ? u.parentNode.insertBefore(t, u.nextSibling) : (e = l.nodeType === 9 ? l.head : l, e.insertBefore(t, e.firstChild));
  }
  function ys(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
  }
  function ms(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
  }
  var Gu = null;
  function Cd(t, e, l) {
    if (Gu === null) {
      var a = /* @__PURE__ */ new Map(), n = Gu = /* @__PURE__ */ new Map();
      n.set(l, a);
    } else
      n = Gu, a = n.get(l), a || (a = /* @__PURE__ */ new Map(), n.set(l, a));
    if (a.has(t)) return a;
    for (a.set(t, null), l = l.getElementsByTagName(t), n = 0; n < l.length; n++) {
      var u = l[n];
      if (!(u[Ba] || u[Yt] || t === "link" && u.getAttribute("rel") === "stylesheet") && u.namespaceURI !== "http://www.w3.org/2000/svg") {
        var c = u.getAttribute(e) || "";
        c = t + c;
        var o = a.get(c);
        o ? o.push(u) : a.set(c, [u]);
      }
    }
    return a;
  }
  function _d(t, e, l) {
    t = t.ownerDocument || t, t.head.insertBefore(
      l,
      e === "title" ? t.querySelector("head > title") : null
    );
  }
  function Hm(t, e, l) {
    if (l === 1 || e.itemProp != null) return !1;
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
  function Md(t) {
    return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
  }
  function qm(t, e, l, a) {
    if (l.type === "stylesheet" && (typeof a.media != "string" || matchMedia(a.media).matches !== !1) && (l.state.loading & 4) === 0) {
      if (l.instance === null) {
        var n = Ma(a.href), u = e.querySelector(
          En(n)
        );
        if (u) {
          e = u._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = Lu.bind(t), e.then(t, t)), l.state.loading |= 4, l.instance = u, Bt(u);
          return;
        }
        u = e.ownerDocument || e, a = Od(a), (n = Oe.get(n)) && ys(a, n), u = u.createElement("link"), Bt(u);
        var c = u;
        c._p = new Promise(function(o, d) {
          c.onload = o, c.onerror = d;
        }), Zt(u, "link", a), l.instance = u;
      }
      t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(l, e), (e = l.state.preload) && (l.state.loading & 3) === 0 && (t.count++, l = Lu.bind(t), e.addEventListener("load", l), e.addEventListener("error", l));
    }
  }
  var vs = 0;
  function Bm(t, e) {
    return t.stylesheets && t.count === 0 && Zu(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(l) {
      var a = setTimeout(function() {
        if (t.stylesheets && Zu(t, t.stylesheets), t.unsuspend) {
          var u = t.unsuspend;
          t.unsuspend = null, u();
        }
      }, 6e4 + e);
      0 < t.imgBytes && vs === 0 && (vs = 62500 * gm());
      var n = setTimeout(
        function() {
          if (t.waitingForImages = !1, t.count === 0 && (t.stylesheets && Zu(t, t.stylesheets), t.unsuspend)) {
            var u = t.unsuspend;
            t.unsuspend = null, u();
          }
        },
        (t.imgBytes > vs ? 50 : 800) + e
      );
      return t.unsuspend = l, function() {
        t.unsuspend = null, clearTimeout(a), clearTimeout(n);
      };
    } : null;
  }
  function Lu() {
    if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
      if (this.stylesheets) Zu(this, this.stylesheets);
      else if (this.unsuspend) {
        var t = this.unsuspend;
        this.unsuspend = null, t();
      }
    }
  }
  var Xu = null;
  function Zu(t, e) {
    t.stylesheets = null, t.unsuspend !== null && (t.count++, Xu = /* @__PURE__ */ new Map(), e.forEach(wm, t), Xu = null, Lu.call(t));
  }
  function wm(t, e) {
    if (!(e.state.loading & 4)) {
      var l = Xu.get(t);
      if (l) var a = l.get(null);
      else {
        l = /* @__PURE__ */ new Map(), Xu.set(t, l);
        for (var n = t.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), u = 0; u < n.length; u++) {
          var c = n[u];
          (c.nodeName === "LINK" || c.getAttribute("media") !== "not all") && (l.set(c.dataset.precedence, c), a = c);
        }
        a && l.set(null, a);
      }
      n = e.instance, c = n.getAttribute("data-precedence"), u = l.get(c) || a, u === a && l.set(null, n), l.set(c, n), this.count++, a = Lu.bind(this), n.addEventListener("load", a), n.addEventListener("error", a), u ? u.parentNode.insertBefore(n, u.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(n, t.firstChild)), e.state.loading |= 4;
    }
  }
  var Tn = {
    $$typeof: bt,
    Provider: null,
    Consumer: null,
    _currentValue: Z,
    _currentValue2: Z,
    _threadCount: 0
  };
  function Qm(t, e, l, a, n, u, c, o, d) {
    this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = ri(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = ri(0), this.hiddenUpdates = ri(null), this.identifierPrefix = a, this.onUncaughtError = n, this.onCaughtError = u, this.onRecoverableError = c, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = d, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function Nd(t, e, l, a, n, u, c, o, d, S, T, _) {
    return t = new Qm(
      t,
      e,
      l,
      c,
      d,
      S,
      T,
      _,
      o
    ), e = 1, u === !0 && (e |= 24), u = oe(3, null, null, e), t.current = u, u.stateNode = t, e = Wi(), e.refCount++, t.pooledCache = e, e.refCount++, u.memoizedState = {
      element: a,
      isDehydrated: l,
      cache: e
    }, Pi(u), t;
  }
  function Rd(t) {
    return t ? (t = ca, t) : ca;
  }
  function Ud(t, e, l, a, n, u) {
    n = Rd(n), a.context === null ? a.context = n : a.pendingContext = n, a = rl(e), a.payload = { element: l }, u = u === void 0 ? null : u, u !== null && (a.callback = u), l = dl(t, a, e), l !== null && (ae(l, t, e), tn(l, t, e));
  }
  function xd(t, e) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var l = t.retryLane;
      t.retryLane = l !== 0 && l < e ? l : e;
    }
  }
  function gs(t, e) {
    xd(t, e), (t = t.alternate) && xd(t, e);
  }
  function jd(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Hl(t, 67108864);
      e !== null && ae(e, t, 67108864), gs(t, 67108864);
    }
  }
  function Hd(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = me();
      e = di(e);
      var l = Hl(t, e);
      l !== null && ae(l, t, e), gs(t, e);
    }
  }
  var Vu = !0;
  function Ym(t, e, l, a) {
    var n = O.T;
    O.T = null;
    var u = j.p;
    try {
      j.p = 2, ps(t, e, l, a);
    } finally {
      j.p = u, O.T = n;
    }
  }
  function Gm(t, e, l, a) {
    var n = O.T;
    O.T = null;
    var u = j.p;
    try {
      j.p = 8, ps(t, e, l, a);
    } finally {
      j.p = u, O.T = n;
    }
  }
  function ps(t, e, l, a) {
    if (Vu) {
      var n = Ss(a);
      if (n === null)
        ns(
          t,
          e,
          a,
          Ku,
          l
        ), Bd(t, a);
      else if (Xm(
        n,
        t,
        e,
        l,
        a
      ))
        a.stopPropagation();
      else if (Bd(t, a), e & 4 && -1 < Lm.indexOf(t)) {
        for (; n !== null; ) {
          var u = kl(n);
          if (u !== null)
            switch (u.tag) {
              case 3:
                if (u = u.stateNode, u.current.memoizedState.isDehydrated) {
                  var c = Nl(u.pendingLanes);
                  if (c !== 0) {
                    var o = u;
                    for (o.pendingLanes |= 2, o.entangledLanes |= 2; c; ) {
                      var d = 1 << 31 - se(c);
                      o.entanglements[1] |= d, c &= ~d;
                    }
                    He(u), (ft & 6) === 0 && (_u = ie() + 500, gn(0));
                  }
                }
                break;
              case 31:
              case 13:
                o = Hl(u, 2), o !== null && ae(o, u, 2), Nu(), gs(u, 2);
            }
          if (u = Ss(a), u === null && ns(
            t,
            e,
            a,
            Ku,
            l
          ), u === n) break;
          n = u;
        }
        n !== null && a.stopPropagation();
      } else
        ns(
          t,
          e,
          a,
          null,
          l
        );
    }
  }
  function Ss(t) {
    return t = Ei(t), bs(t);
  }
  var Ku = null;
  function bs(t) {
    if (Ku = null, t = Wl(t), t !== null) {
      var e = D(t);
      if (e === null) t = null;
      else {
        var l = e.tag;
        if (l === 13) {
          if (t = N(e), t !== null) return t;
          t = null;
        } else if (l === 31) {
          if (t = z(e), t !== null) return t;
          t = null;
        } else if (l === 3) {
          if (e.stateNode.current.memoizedState.isDehydrated)
            return e.tag === 3 ? e.stateNode.containerInfo : null;
          t = null;
        } else e !== t && (t = null);
      }
    }
    return Ku = t, null;
  }
  function qd(t) {
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
        switch (Ch()) {
          case Ls:
            return 2;
          case Xs:
            return 8;
          case Hn:
          case _h:
            return 32;
          case Zs:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var Es = !1, Tl = null, zl = null, Ol = null, zn = /* @__PURE__ */ new Map(), On = /* @__PURE__ */ new Map(), Dl = [], Lm = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function Bd(t, e) {
    switch (t) {
      case "focusin":
      case "focusout":
        Tl = null;
        break;
      case "dragenter":
      case "dragleave":
        zl = null;
        break;
      case "mouseover":
      case "mouseout":
        Ol = null;
        break;
      case "pointerover":
      case "pointerout":
        zn.delete(e.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        On.delete(e.pointerId);
    }
  }
  function Dn(t, e, l, a, n, u) {
    return t === null || t.nativeEvent !== u ? (t = {
      blockedOn: e,
      domEventName: l,
      eventSystemFlags: a,
      nativeEvent: u,
      targetContainers: [n]
    }, e !== null && (e = kl(e), e !== null && jd(e)), t) : (t.eventSystemFlags |= a, e = t.targetContainers, n !== null && e.indexOf(n) === -1 && e.push(n), t);
  }
  function Xm(t, e, l, a, n) {
    switch (e) {
      case "focusin":
        return Tl = Dn(
          Tl,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "dragenter":
        return zl = Dn(
          zl,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "mouseover":
        return Ol = Dn(
          Ol,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "pointerover":
        var u = n.pointerId;
        return zn.set(
          u,
          Dn(
            zn.get(u) || null,
            t,
            e,
            l,
            a,
            n
          )
        ), !0;
      case "gotpointercapture":
        return u = n.pointerId, On.set(
          u,
          Dn(
            On.get(u) || null,
            t,
            e,
            l,
            a,
            n
          )
        ), !0;
    }
    return !1;
  }
  function wd(t) {
    var e = Wl(t.target);
    if (e !== null) {
      var l = D(e);
      if (l !== null) {
        if (e = l.tag, e === 13) {
          if (e = N(l), e !== null) {
            t.blockedOn = e, ks(t.priority, function() {
              Hd(l);
            });
            return;
          }
        } else if (e === 31) {
          if (e = z(l), e !== null) {
            t.blockedOn = e, ks(t.priority, function() {
              Hd(l);
            });
            return;
          }
        } else if (e === 3 && l.stateNode.current.memoizedState.isDehydrated) {
          t.blockedOn = l.tag === 3 ? l.stateNode.containerInfo : null;
          return;
        }
      }
    }
    t.blockedOn = null;
  }
  function Ju(t) {
    if (t.blockedOn !== null) return !1;
    for (var e = t.targetContainers; 0 < e.length; ) {
      var l = Ss(t.nativeEvent);
      if (l === null) {
        l = t.nativeEvent;
        var a = new l.constructor(
          l.type,
          l
        );
        bi = a, l.target.dispatchEvent(a), bi = null;
      } else
        return e = kl(l), e !== null && jd(e), t.blockedOn = l, !1;
      e.shift();
    }
    return !0;
  }
  function Qd(t, e, l) {
    Ju(t) && l.delete(e);
  }
  function Zm() {
    Es = !1, Tl !== null && Ju(Tl) && (Tl = null), zl !== null && Ju(zl) && (zl = null), Ol !== null && Ju(Ol) && (Ol = null), zn.forEach(Qd), On.forEach(Qd);
  }
  function Fu(t, e) {
    t.blockedOn === e && (t.blockedOn = null, Es || (Es = !0, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      Zm
    )));
  }
  var Wu = null;
  function Yd(t) {
    Wu !== t && (Wu = t, i.unstable_scheduleCallback(
      i.unstable_NormalPriority,
      function() {
        Wu === t && (Wu = null);
        for (var e = 0; e < t.length; e += 3) {
          var l = t[e], a = t[e + 1], n = t[e + 2];
          if (typeof a != "function") {
            if (bs(a || l) === null)
              continue;
            break;
          }
          var u = kl(l);
          u !== null && (t.splice(e, 3), e -= 3, Sc(
            u,
            {
              pending: !0,
              data: n,
              method: l.method,
              action: a
            },
            a,
            n
          ));
        }
      }
    ));
  }
  function Ra(t) {
    function e(d) {
      return Fu(d, t);
    }
    Tl !== null && Fu(Tl, t), zl !== null && Fu(zl, t), Ol !== null && Fu(Ol, t), zn.forEach(e), On.forEach(e);
    for (var l = 0; l < Dl.length; l++) {
      var a = Dl[l];
      a.blockedOn === t && (a.blockedOn = null);
    }
    for (; 0 < Dl.length && (l = Dl[0], l.blockedOn === null); )
      wd(l), l.blockedOn === null && Dl.shift();
    if (l = (t.ownerDocument || t).$$reactFormReplay, l != null)
      for (a = 0; a < l.length; a += 3) {
        var n = l[a], u = l[a + 1], c = n[$t] || null;
        if (typeof u == "function")
          c || Yd(l);
        else if (c) {
          var o = null;
          if (u && u.hasAttribute("formAction")) {
            if (n = u, c = u[$t] || null)
              o = c.formAction;
            else if (bs(n) !== null) continue;
          } else o = c.action;
          typeof o == "function" ? l[a + 1] = o : (l.splice(a, 3), a -= 3), Yd(l);
        }
      }
  }
  function Gd() {
    function t(u) {
      u.canIntercept && u.info === "react-transition" && u.intercept({
        handler: function() {
          return new Promise(function(c) {
            return n = c;
          });
        },
        focusReset: "manual",
        scroll: "manual"
      });
    }
    function e() {
      n !== null && (n(), n = null), a || setTimeout(l, 20);
    }
    function l() {
      if (!a && !navigation.transition) {
        var u = navigation.currentEntry;
        u && u.url != null && navigation.navigate(u.url, {
          state: u.getState(),
          info: "react-transition",
          history: "replace"
        });
      }
    }
    if (typeof navigation == "object") {
      var a = !1, n = null;
      return navigation.addEventListener("navigate", t), navigation.addEventListener("navigatesuccess", e), navigation.addEventListener("navigateerror", e), setTimeout(l, 100), function() {
        a = !0, navigation.removeEventListener("navigate", t), navigation.removeEventListener("navigatesuccess", e), navigation.removeEventListener("navigateerror", e), n !== null && (n(), n = null);
      };
    }
  }
  function As(t) {
    this._internalRoot = t;
  }
  ku.prototype.render = As.prototype.render = function(t) {
    var e = this._internalRoot;
    if (e === null) throw Error(f(409));
    var l = e.current, a = me();
    Ud(l, a, t, e, null, null);
  }, ku.prototype.unmount = As.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var e = t.containerInfo;
      Ud(t.current, 2, null, t, null, null), Nu(), e[Fl] = null;
    }
  };
  function ku(t) {
    this._internalRoot = t;
  }
  ku.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var e = Ws();
      t = { blockedOn: null, target: t, priority: e };
      for (var l = 0; l < Dl.length && e !== 0 && e < Dl[l].priority; l++) ;
      Dl.splice(l, 0, t), l === 0 && wd(t);
    }
  };
  var Ld = s.version;
  if (Ld !== "19.2.5")
    throw Error(
      f(
        527,
        Ld,
        "19.2.5"
      )
    );
  j.findDOMNode = function(t) {
    var e = t._reactInternals;
    if (e === void 0)
      throw typeof t.render == "function" ? Error(f(188)) : (t = Object.keys(t).join(","), Error(f(268, t)));
    return t = g(e), t = t !== null ? U(t) : null, t = t === null ? null : t.stateNode, t;
  };
  var Vm = {
    bundleType: 0,
    version: "19.2.5",
    rendererPackageName: "react-dom",
    currentDispatcherRef: O,
    reconcilerVersion: "19.2.5"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var $u = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!$u.isDisabled && $u.supportsFiber)
      try {
        ja = $u.inject(
          Vm
        ), ce = $u;
      } catch {
      }
  }
  return _n.createRoot = function(t, e) {
    if (!v(t)) throw Error(f(299));
    var l = !1, a = "", n = Wo, u = ko, c = $o;
    return e != null && (e.unstable_strictMode === !0 && (l = !0), e.identifierPrefix !== void 0 && (a = e.identifierPrefix), e.onUncaughtError !== void 0 && (n = e.onUncaughtError), e.onCaughtError !== void 0 && (u = e.onCaughtError), e.onRecoverableError !== void 0 && (c = e.onRecoverableError)), e = Nd(
      t,
      1,
      !1,
      null,
      null,
      l,
      a,
      null,
      n,
      u,
      c,
      Gd
    ), t[Fl] = e.current, as(t), new As(e);
  }, _n.hydrateRoot = function(t, e, l) {
    if (!v(t)) throw Error(f(299));
    var a = !1, n = "", u = Wo, c = ko, o = $o, d = null;
    return l != null && (l.unstable_strictMode === !0 && (a = !0), l.identifierPrefix !== void 0 && (n = l.identifierPrefix), l.onUncaughtError !== void 0 && (u = l.onUncaughtError), l.onCaughtError !== void 0 && (c = l.onCaughtError), l.onRecoverableError !== void 0 && (o = l.onRecoverableError), l.formState !== void 0 && (d = l.formState)), e = Nd(
      t,
      1,
      !0,
      e,
      l ?? null,
      a,
      n,
      d,
      u,
      c,
      o,
      Gd
    ), e.context = Rd(null), l = e.current, a = me(), a = di(a), n = rl(a), n.callback = null, dl(l, n, a), l = a, e.current.lanes = l, qa(e, l), He(e), t[Fl] = e.current, as(t), new ku(e);
  }, _n.version = "19.2.5", _n;
}
var Id;
function ev() {
  if (Id) return Os.exports;
  Id = 1;
  function i() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(i);
      } catch (s) {
        console.error(s);
      }
  }
  return i(), Os.exports = tv(), Os.exports;
}
var lv = ev(), li = class {
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
}, av = class extends li {
  #t;
  #l;
  #e;
  constructor() {
    super(), this.#e = (i) => {
      if (typeof window < "u" && window.addEventListener) {
        const s = () => i();
        return window.addEventListener("visibilitychange", s, !1), () => {
          window.removeEventListener("visibilitychange", s);
        };
      }
    };
  }
  onSubscribe() {
    this.#l || this.setEventListener(this.#e);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#l?.(), this.#l = void 0);
  }
  setEventListener(i) {
    this.#e = i, this.#l?.(), this.#l = i((s) => {
      typeof s == "boolean" ? this.setFocused(s) : this.onFocus();
    });
  }
  setFocused(i) {
    this.#t !== i && (this.#t = i, this.onFocus());
  }
  onFocus() {
    const i = this.isFocused();
    this.listeners.forEach((s) => {
      s(i);
    });
  }
  isFocused() {
    return typeof this.#t == "boolean" ? this.#t : globalThis.document?.visibilityState !== "hidden";
  }
}, vh = new av(), nv = {
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
  setTimeout: (i, s) => setTimeout(i, s),
  clearTimeout: (i) => clearTimeout(i),
  setInterval: (i, s) => setInterval(i, s),
  clearInterval: (i) => clearInterval(i)
}, uv = class {
  // We cannot have TimeoutManager<T> as we must instantiate it with a concrete
  // type at app boot; and if we leave that type, then any new timer provider
  // would need to support the default provider's concrete timer ID, which is
  // infeasible across environments.
  //
  // We settle for type safety for the TimeoutProvider type, and accept that
  // this class is unsafe internally to allow for extension.
  #t = nv;
  #l = !1;
  setTimeoutProvider(i) {
    this.#t = i;
  }
  setTimeout(i, s) {
    return this.#t.setTimeout(i, s);
  }
  clearTimeout(i) {
    this.#t.clearTimeout(i);
  }
  setInterval(i, s) {
    return this.#t.setInterval(i, s);
  }
  clearInterval(i) {
    this.#t.clearInterval(i);
  }
}, Rs = new uv();
function iv(i) {
  setTimeout(i, 0);
}
var cv = typeof window > "u" || "Deno" in globalThis;
function Re() {
}
function sv(i, s) {
  return typeof i == "function" ? i(s) : i;
}
function fv(i) {
  return typeof i == "number" && i >= 0 && i !== 1 / 0;
}
function ov(i, s) {
  return Math.max(i + (s || 0) - Date.now(), 0);
}
function Us(i, s) {
  return typeof i == "function" ? i(s) : i;
}
function rv(i, s) {
  return typeof i == "function" ? i(s) : i;
}
function Pd(i, s) {
  const {
    type: r = "all",
    exact: f,
    fetchStatus: v,
    predicate: D,
    queryKey: N,
    stale: z
  } = i;
  if (N) {
    if (f) {
      if (s.queryHash !== ws(N, s.options))
        return !1;
    } else if (!Un(s.queryKey, N))
      return !1;
  }
  if (r !== "all") {
    const A = s.isActive();
    if (r === "active" && !A || r === "inactive" && A)
      return !1;
  }
  return !(typeof z == "boolean" && s.isStale() !== z || v && v !== s.state.fetchStatus || D && !D(s));
}
function th(i, s) {
  const { exact: r, status: f, predicate: v, mutationKey: D } = i;
  if (D) {
    if (!s.options.mutationKey)
      return !1;
    if (r) {
      if (Rn(s.options.mutationKey) !== Rn(D))
        return !1;
    } else if (!Un(s.options.mutationKey, D))
      return !1;
  }
  return !(f && s.state.status !== f || v && !v(s));
}
function ws(i, s) {
  return (s?.queryKeyHashFn || Rn)(i);
}
function Rn(i) {
  return JSON.stringify(
    i,
    (s, r) => xs(r) ? Object.keys(r).sort().reduce((f, v) => (f[v] = r[v], f), {}) : r
  );
}
function Un(i, s) {
  return i === s ? !0 : typeof i != typeof s ? !1 : i && s && typeof i == "object" && typeof s == "object" ? Object.keys(s).every((r) => Un(i[r], s[r])) : !1;
}
var dv = Object.prototype.hasOwnProperty;
function gh(i, s, r = 0) {
  if (i === s)
    return i;
  if (r > 500) return s;
  const f = eh(i) && eh(s);
  if (!f && !(xs(i) && xs(s))) return s;
  const D = (f ? i : Object.keys(i)).length, N = f ? s : Object.keys(s), z = N.length, A = f ? new Array(z) : {};
  let g = 0;
  for (let U = 0; U < z; U++) {
    const x = f ? U : N[U], Y = i[x], V = s[x];
    if (Y === V) {
      A[x] = Y, (f ? U < D : dv.call(i, x)) && g++;
      continue;
    }
    if (Y === null || V === null || typeof Y != "object" || typeof V != "object") {
      A[x] = V;
      continue;
    }
    const W = gh(Y, V, r + 1);
    A[x] = W, W === Y && g++;
  }
  return D === z && g === D ? i : A;
}
function eh(i) {
  return Array.isArray(i) && i.length === Object.keys(i).length;
}
function xs(i) {
  if (!lh(i))
    return !1;
  const s = i.constructor;
  if (s === void 0)
    return !0;
  const r = s.prototype;
  return !(!lh(r) || !r.hasOwnProperty("isPrototypeOf") || Object.getPrototypeOf(i) !== Object.prototype);
}
function lh(i) {
  return Object.prototype.toString.call(i) === "[object Object]";
}
function hv(i) {
  return new Promise((s) => {
    Rs.setTimeout(s, i);
  });
}
function yv(i, s, r) {
  return typeof r.structuralSharing == "function" ? r.structuralSharing(i, s) : r.structuralSharing !== !1 ? gh(i, s) : s;
}
function mv(i, s, r = 0) {
  const f = [...i, s];
  return r && f.length > r ? f.slice(1) : f;
}
function vv(i, s, r = 0) {
  const f = [s, ...i];
  return r && f.length > r ? f.slice(0, -1) : f;
}
var Qs = /* @__PURE__ */ Symbol();
function ph(i, s) {
  return !i.queryFn && s?.initialPromise ? () => s.initialPromise : !i.queryFn || i.queryFn === Qs ? () => Promise.reject(new Error(`Missing queryFn: '${i.queryHash}'`)) : i.queryFn;
}
function gv(i, s, r) {
  let f = !1, v;
  return Object.defineProperty(i, "signal", {
    enumerable: !0,
    get: () => (v ??= s(), f || (f = !0, v.aborted ? r() : v.addEventListener("abort", r, { once: !0 })), v)
  }), i;
}
var Sh = /* @__PURE__ */ (() => {
  let i = () => cv;
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
    setIsServer(s) {
      i = s;
    }
  };
})();
function pv() {
  let i, s;
  const r = new Promise((v, D) => {
    i = v, s = D;
  });
  r.status = "pending", r.catch(() => {
  });
  function f(v) {
    Object.assign(r, v), delete r.resolve, delete r.reject;
  }
  return r.resolve = (v) => {
    f({
      status: "fulfilled",
      value: v
    }), i(v);
  }, r.reject = (v) => {
    f({
      status: "rejected",
      reason: v
    }), s(v);
  }, r;
}
var Sv = iv;
function bv() {
  let i = [], s = 0, r = (z) => {
    z();
  }, f = (z) => {
    z();
  }, v = Sv;
  const D = (z) => {
    s ? i.push(z) : v(() => {
      r(z);
    });
  }, N = () => {
    const z = i;
    i = [], z.length && v(() => {
      f(() => {
        z.forEach((A) => {
          r(A);
        });
      });
    });
  };
  return {
    batch: (z) => {
      let A;
      s++;
      try {
        A = z();
      } finally {
        s--, s || N();
      }
      return A;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (z) => (...A) => {
      D(() => {
        z(...A);
      });
    },
    schedule: D,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (z) => {
      r = z;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * By default React Query will use the batch function provided by ReactDOM or React Native.
     */
    setBatchNotifyFunction: (z) => {
      f = z;
    },
    setScheduler: (z) => {
      v = z;
    }
  };
}
var Ft = bv(), Ev = class extends li {
  #t = !0;
  #l;
  #e;
  constructor() {
    super(), this.#e = (i) => {
      if (typeof window < "u" && window.addEventListener) {
        const s = () => i(!0), r = () => i(!1);
        return window.addEventListener("online", s, !1), window.addEventListener("offline", r, !1), () => {
          window.removeEventListener("online", s), window.removeEventListener("offline", r);
        };
      }
    };
  }
  onSubscribe() {
    this.#l || this.setEventListener(this.#e);
  }
  onUnsubscribe() {
    this.hasListeners() || (this.#l?.(), this.#l = void 0);
  }
  setEventListener(i) {
    this.#e = i, this.#l?.(), this.#l = i(this.setOnline.bind(this));
  }
  setOnline(i) {
    this.#t !== i && (this.#t = i, this.listeners.forEach((r) => {
      r(i);
    }));
  }
  isOnline() {
    return this.#t;
  }
}, ti = new Ev();
function Av(i) {
  return Math.min(1e3 * 2 ** i, 3e4);
}
function bh(i) {
  return (i ?? "online") === "online" ? ti.isOnline() : !0;
}
var js = class extends Error {
  constructor(i) {
    super("CancelledError"), this.revert = i?.revert, this.silent = i?.silent;
  }
};
function Eh(i) {
  let s = !1, r = 0, f;
  const v = pv(), D = () => v.status !== "pending", N = (J) => {
    if (!D()) {
      const P = new js(J);
      Y(P), i.onCancel?.(P);
    }
  }, z = () => {
    s = !0;
  }, A = () => {
    s = !1;
  }, g = () => vh.isFocused() && (i.networkMode === "always" || ti.isOnline()) && i.canRun(), U = () => bh(i.networkMode) && i.canRun(), x = (J) => {
    D() || (f?.(), v.resolve(J));
  }, Y = (J) => {
    D() || (f?.(), v.reject(J));
  }, V = () => new Promise((J) => {
    f = (P) => {
      (D() || g()) && J(P);
    }, i.onPause?.();
  }).then(() => {
    f = void 0, D() || i.onContinue?.();
  }), W = () => {
    if (D())
      return;
    let J;
    const P = r === 0 ? i.initialPromise : void 0;
    try {
      J = P ?? i.fn();
    } catch (tt) {
      J = Promise.reject(tt);
    }
    Promise.resolve(J).then(x).catch((tt) => {
      if (D())
        return;
      const Et = i.retry ?? (Sh.isServer() ? 0 : 3), bt = i.retryDelay ?? Av, Ot = typeof bt == "function" ? bt(r, tt) : bt, K = Et === !0 || typeof Et == "number" && r < Et || typeof Et == "function" && Et(r, tt);
      if (s || !K) {
        Y(tt);
        return;
      }
      r++, i.onFail?.(r, tt), hv(Ot).then(() => g() ? void 0 : V()).then(() => {
        s ? Y(tt) : W();
      });
    });
  };
  return {
    promise: v,
    status: () => v.status,
    cancel: N,
    continue: () => (f?.(), v),
    cancelRetry: z,
    continueRetry: A,
    canStart: U,
    start: () => (U() ? W() : V().then(W), v)
  };
}
var Ah = class {
  #t;
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout(), fv(this.gcTime) && (this.#t = Rs.setTimeout(() => {
      this.optionalRemove();
    }, this.gcTime));
  }
  updateGcTime(i) {
    this.gcTime = Math.max(
      this.gcTime || 0,
      i ?? (Sh.isServer() ? 1 / 0 : 300 * 1e3)
    );
  }
  clearGcTimeout() {
    this.#t !== void 0 && (Rs.clearTimeout(this.#t), this.#t = void 0);
  }
}, Tv = class extends Ah {
  #t;
  #l;
  #e;
  #n;
  #a;
  #u;
  #i;
  constructor(i) {
    super(), this.#i = !1, this.#u = i.defaultOptions, this.setOptions(i.options), this.observers = [], this.#n = i.client, this.#e = this.#n.getQueryCache(), this.queryKey = i.queryKey, this.queryHash = i.queryHash, this.#t = nh(this.options), this.state = i.state ?? this.#t, this.scheduleGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#a?.promise;
  }
  setOptions(i) {
    if (this.options = { ...this.#u, ...i }, this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
      const s = nh(this.options);
      s.data !== void 0 && (this.setState(
        ah(s.data, s.dataUpdatedAt)
      ), this.#t = s);
    }
  }
  optionalRemove() {
    !this.observers.length && this.state.fetchStatus === "idle" && this.#e.remove(this);
  }
  setData(i, s) {
    const r = yv(this.state.data, i, this.options);
    return this.#c({
      data: r,
      type: "success",
      dataUpdatedAt: s?.updatedAt,
      manual: s?.manual
    }), r;
  }
  setState(i, s) {
    this.#c({ type: "setState", state: i, setStateOptions: s });
  }
  cancel(i) {
    const s = this.#a?.promise;
    return this.#a?.cancel(i), s ? s.then(Re).catch(Re) : Promise.resolve();
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
      (i) => rv(i.options.enabled, this) !== !1
    );
  }
  isDisabled() {
    return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === Qs || !this.isFetched();
  }
  isFetched() {
    return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
  }
  isStatic() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (i) => Us(i.options.staleTime, this) === "static"
    ) : !1;
  }
  isStale() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (i) => i.getCurrentResult().isStale
    ) : this.state.data === void 0 || this.state.isInvalidated;
  }
  isStaleByTime(i = 0) {
    return this.state.data === void 0 ? !0 : i === "static" ? !1 : this.state.isInvalidated ? !0 : !ov(this.state.dataUpdatedAt, i);
  }
  onFocus() {
    this.observers.find((s) => s.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: !1 }), this.#a?.continue();
  }
  onOnline() {
    this.observers.find((s) => s.shouldFetchOnReconnect())?.refetch({ cancelRefetch: !1 }), this.#a?.continue();
  }
  addObserver(i) {
    this.observers.includes(i) || (this.observers.push(i), this.clearGcTimeout(), this.#e.notify({ type: "observerAdded", query: this, observer: i }));
  }
  removeObserver(i) {
    this.observers.includes(i) && (this.observers = this.observers.filter((s) => s !== i), this.observers.length || (this.#a && (this.#i || this.#s() ? this.#a.cancel({ revert: !0 }) : this.#a.cancelRetry()), this.scheduleGc()), this.#e.notify({ type: "observerRemoved", query: this, observer: i }));
  }
  getObserversCount() {
    return this.observers.length;
  }
  #s() {
    return this.state.fetchStatus === "paused" && this.state.status === "pending";
  }
  invalidate() {
    this.state.isInvalidated || this.#c({ type: "invalidate" });
  }
  async fetch(i, s) {
    if (this.state.fetchStatus !== "idle" && // If the promise in the retryer is already rejected, we have to definitely
    // re-start the fetch; there is a chance that the query is still in a
    // pending state when that happens
    this.#a?.status() !== "rejected") {
      if (this.state.data !== void 0 && s?.cancelRefetch)
        this.cancel({ silent: !0 });
      else if (this.#a)
        return this.#a.continueRetry(), this.#a.promise;
    }
    if (i && this.setOptions(i), !this.options.queryFn) {
      const z = this.observers.find((A) => A.options.queryFn);
      z && this.setOptions(z.options);
    }
    const r = new AbortController(), f = (z) => {
      Object.defineProperty(z, "signal", {
        enumerable: !0,
        get: () => (this.#i = !0, r.signal)
      });
    }, v = () => {
      const z = ph(this.options, s), g = (() => {
        const U = {
          client: this.#n,
          queryKey: this.queryKey,
          meta: this.meta
        };
        return f(U), U;
      })();
      return this.#i = !1, this.options.persister ? this.options.persister(
        z,
        g,
        this
      ) : z(g);
    }, N = (() => {
      const z = {
        fetchOptions: s,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#n,
        state: this.state,
        fetchFn: v
      };
      return f(z), z;
    })();
    this.options.behavior?.onFetch(N, this), this.#l = this.state, (this.state.fetchStatus === "idle" || this.state.fetchMeta !== N.fetchOptions?.meta) && this.#c({ type: "fetch", meta: N.fetchOptions?.meta }), this.#a = Eh({
      initialPromise: s?.initialPromise,
      fn: N.fetchFn,
      onCancel: (z) => {
        z instanceof js && z.revert && this.setState({
          ...this.#l,
          fetchStatus: "idle"
        }), r.abort();
      },
      onFail: (z, A) => {
        this.#c({ type: "failed", failureCount: z, error: A });
      },
      onPause: () => {
        this.#c({ type: "pause" });
      },
      onContinue: () => {
        this.#c({ type: "continue" });
      },
      retry: N.options.retry,
      retryDelay: N.options.retryDelay,
      networkMode: N.options.networkMode,
      canRun: () => !0
    });
    try {
      const z = await this.#a.start();
      if (z === void 0)
        throw new Error(`${this.queryHash} data is undefined`);
      return this.setData(z), this.#e.config.onSuccess?.(z, this), this.#e.config.onSettled?.(
        z,
        this.state.error,
        this
      ), z;
    } catch (z) {
      if (z instanceof js) {
        if (z.silent)
          return this.#a.promise;
        if (z.revert) {
          if (this.state.data === void 0)
            throw z;
          return this.state.data;
        }
      }
      throw this.#c({
        type: "error",
        error: z
      }), this.#e.config.onError?.(
        z,
        this
      ), this.#e.config.onSettled?.(
        this.state.data,
        z,
        this
      ), z;
    } finally {
      this.scheduleGc();
    }
  }
  #c(i) {
    const s = (r) => {
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
            ...zv(r.data, this.options),
            fetchMeta: i.meta ?? null
          };
        case "success":
          const f = {
            ...r,
            ...ah(i.data, i.dataUpdatedAt),
            dataUpdateCount: r.dataUpdateCount + 1,
            ...!i.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          return this.#l = i.manual ? f : void 0, f;
        case "error":
          const v = i.error;
          return {
            ...r,
            error: v,
            errorUpdateCount: r.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: r.fetchFailureCount + 1,
            fetchFailureReason: v,
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
    this.state = s(this.state), Ft.batch(() => {
      this.observers.forEach((r) => {
        r.onQueryUpdate();
      }), this.#e.notify({ query: this, type: "updated", action: i });
    });
  }
};
function zv(i, s) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: bh(s.networkMode) ? "fetching" : "paused",
    ...i === void 0 && {
      error: null,
      status: "pending"
    }
  };
}
function ah(i, s) {
  return {
    data: i,
    dataUpdatedAt: s ?? Date.now(),
    error: null,
    isInvalidated: !1,
    status: "success"
  };
}
function nh(i) {
  const s = typeof i.initialData == "function" ? i.initialData() : i.initialData, r = s !== void 0, f = r ? typeof i.initialDataUpdatedAt == "function" ? i.initialDataUpdatedAt() : i.initialDataUpdatedAt : 0;
  return {
    data: s,
    dataUpdateCount: 0,
    dataUpdatedAt: r ? f ?? Date.now() : 0,
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
function uh(i) {
  return {
    onFetch: (s, r) => {
      const f = s.options, v = s.fetchOptions?.meta?.fetchMore?.direction, D = s.state.data?.pages || [], N = s.state.data?.pageParams || [];
      let z = { pages: [], pageParams: [] }, A = 0;
      const g = async () => {
        let U = !1;
        const x = (W) => {
          gv(
            W,
            () => s.signal,
            () => U = !0
          );
        }, Y = ph(s.options, s.fetchOptions), V = async (W, J, P) => {
          if (U)
            return Promise.reject();
          if (J == null && W.pages.length)
            return Promise.resolve(W);
          const Et = (() => {
            const X = {
              client: s.client,
              queryKey: s.queryKey,
              pageParam: J,
              direction: P ? "backward" : "forward",
              meta: s.options.meta
            };
            return x(X), X;
          })(), bt = await Y(Et), { maxPages: Ot } = s.options, K = P ? vv : mv;
          return {
            pages: K(W.pages, bt, Ot),
            pageParams: K(W.pageParams, J, Ot)
          };
        };
        if (v && D.length) {
          const W = v === "backward", J = W ? Ov : ih, P = {
            pages: D,
            pageParams: N
          }, tt = J(f, P);
          z = await V(P, tt, W);
        } else {
          const W = i ?? D.length;
          do {
            const J = A === 0 ? N[0] ?? f.initialPageParam : ih(f, z);
            if (A > 0 && J == null)
              break;
            z = await V(z, J), A++;
          } while (A < W);
        }
        return z;
      };
      s.options.persister ? s.fetchFn = () => s.options.persister?.(
        g,
        {
          client: s.client,
          queryKey: s.queryKey,
          meta: s.options.meta,
          signal: s.signal
        },
        r
      ) : s.fetchFn = g;
    }
  };
}
function ih(i, { pages: s, pageParams: r }) {
  const f = s.length - 1;
  return s.length > 0 ? i.getNextPageParam(
    s[f],
    s,
    r[f],
    r
  ) : void 0;
}
function Ov(i, { pages: s, pageParams: r }) {
  return s.length > 0 ? i.getPreviousPageParam?.(s[0], s, r[0], r) : void 0;
}
var Dv = class extends Ah {
  #t;
  #l;
  #e;
  #n;
  constructor(i) {
    super(), this.#t = i.client, this.mutationId = i.mutationId, this.#e = i.mutationCache, this.#l = [], this.state = i.state || Cv(), this.setOptions(i.options), this.scheduleGc();
  }
  setOptions(i) {
    this.options = i, this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  addObserver(i) {
    this.#l.includes(i) || (this.#l.push(i), this.clearGcTimeout(), this.#e.notify({
      type: "observerAdded",
      mutation: this,
      observer: i
    }));
  }
  removeObserver(i) {
    this.#l = this.#l.filter((s) => s !== i), this.scheduleGc(), this.#e.notify({
      type: "observerRemoved",
      mutation: this,
      observer: i
    });
  }
  optionalRemove() {
    this.#l.length || (this.state.status === "pending" ? this.scheduleGc() : this.#e.remove(this));
  }
  continue() {
    return this.#n?.continue() ?? // continuing a mutation assumes that variables are set, mutation must have been dehydrated before
    this.execute(this.state.variables);
  }
  async execute(i) {
    const s = () => {
      this.#a({ type: "continue" });
    }, r = {
      client: this.#t,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#n = Eh({
      fn: () => this.options.mutationFn ? this.options.mutationFn(i, r) : Promise.reject(new Error("No mutationFn found")),
      onFail: (D, N) => {
        this.#a({ type: "failed", failureCount: D, error: N });
      },
      onPause: () => {
        this.#a({ type: "pause" });
      },
      onContinue: s,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#e.canRun(this)
    });
    const f = this.state.status === "pending", v = !this.#n.canStart();
    try {
      if (f)
        s();
      else {
        this.#a({ type: "pending", variables: i, isPaused: v }), this.#e.config.onMutate && await this.#e.config.onMutate(
          i,
          this,
          r
        );
        const N = await this.options.onMutate?.(
          i,
          r
        );
        N !== this.state.context && this.#a({
          type: "pending",
          context: N,
          variables: i,
          isPaused: v
        });
      }
      const D = await this.#n.start();
      return await this.#e.config.onSuccess?.(
        D,
        i,
        this.state.context,
        this,
        r
      ), await this.options.onSuccess?.(
        D,
        i,
        this.state.context,
        r
      ), await this.#e.config.onSettled?.(
        D,
        null,
        this.state.variables,
        this.state.context,
        this,
        r
      ), await this.options.onSettled?.(
        D,
        null,
        i,
        this.state.context,
        r
      ), this.#a({ type: "success", data: D }), D;
    } catch (D) {
      try {
        await this.#e.config.onError?.(
          D,
          i,
          this.state.context,
          this,
          r
        );
      } catch (N) {
        Promise.reject(N);
      }
      try {
        await this.options.onError?.(
          D,
          i,
          this.state.context,
          r
        );
      } catch (N) {
        Promise.reject(N);
      }
      try {
        await this.#e.config.onSettled?.(
          void 0,
          D,
          this.state.variables,
          this.state.context,
          this,
          r
        );
      } catch (N) {
        Promise.reject(N);
      }
      try {
        await this.options.onSettled?.(
          void 0,
          D,
          i,
          this.state.context,
          r
        );
      } catch (N) {
        Promise.reject(N);
      }
      throw this.#a({ type: "error", error: D }), D;
    } finally {
      this.#e.runNext(this);
    }
  }
  #a(i) {
    const s = (r) => {
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
    this.state = s(this.state), Ft.batch(() => {
      this.#l.forEach((r) => {
        r.onMutationUpdate(i);
      }), this.#e.notify({
        mutation: this,
        type: "updated",
        action: i
      });
    });
  }
};
function Cv() {
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
var _v = class extends li {
  constructor(i = {}) {
    super(), this.config = i, this.#t = /* @__PURE__ */ new Set(), this.#l = /* @__PURE__ */ new Map(), this.#e = 0;
  }
  #t;
  #l;
  #e;
  build(i, s, r) {
    const f = new Dv({
      client: i,
      mutationCache: this,
      mutationId: ++this.#e,
      options: i.defaultMutationOptions(s),
      state: r
    });
    return this.add(f), f;
  }
  add(i) {
    this.#t.add(i);
    const s = Iu(i);
    if (typeof s == "string") {
      const r = this.#l.get(s);
      r ? r.push(i) : this.#l.set(s, [i]);
    }
    this.notify({ type: "added", mutation: i });
  }
  remove(i) {
    if (this.#t.delete(i)) {
      const s = Iu(i);
      if (typeof s == "string") {
        const r = this.#l.get(s);
        if (r)
          if (r.length > 1) {
            const f = r.indexOf(i);
            f !== -1 && r.splice(f, 1);
          } else r[0] === i && this.#l.delete(s);
      }
    }
    this.notify({ type: "removed", mutation: i });
  }
  canRun(i) {
    const s = Iu(i);
    if (typeof s == "string") {
      const f = this.#l.get(s)?.find(
        (v) => v.state.status === "pending"
      );
      return !f || f === i;
    } else
      return !0;
  }
  runNext(i) {
    const s = Iu(i);
    return typeof s == "string" ? this.#l.get(s)?.find((f) => f !== i && f.state.isPaused)?.continue() ?? Promise.resolve() : Promise.resolve();
  }
  clear() {
    Ft.batch(() => {
      this.#t.forEach((i) => {
        this.notify({ type: "removed", mutation: i });
      }), this.#t.clear(), this.#l.clear();
    });
  }
  getAll() {
    return Array.from(this.#t);
  }
  find(i) {
    const s = { exact: !0, ...i };
    return this.getAll().find(
      (r) => th(s, r)
    );
  }
  findAll(i = {}) {
    return this.getAll().filter((s) => th(i, s));
  }
  notify(i) {
    Ft.batch(() => {
      this.listeners.forEach((s) => {
        s(i);
      });
    });
  }
  resumePausedMutations() {
    const i = this.getAll().filter((s) => s.state.isPaused);
    return Ft.batch(
      () => Promise.all(
        i.map((s) => s.continue().catch(Re))
      )
    );
  }
};
function Iu(i) {
  return i.options.scope?.id;
}
var Mv = class extends li {
  constructor(i = {}) {
    super(), this.config = i, this.#t = /* @__PURE__ */ new Map();
  }
  #t;
  build(i, s, r) {
    const f = s.queryKey, v = s.queryHash ?? ws(f, s);
    let D = this.get(v);
    return D || (D = new Tv({
      client: i,
      queryKey: f,
      queryHash: v,
      options: i.defaultQueryOptions(s),
      state: r,
      defaultOptions: i.getQueryDefaults(f)
    }), this.add(D)), D;
  }
  add(i) {
    this.#t.has(i.queryHash) || (this.#t.set(i.queryHash, i), this.notify({
      type: "added",
      query: i
    }));
  }
  remove(i) {
    const s = this.#t.get(i.queryHash);
    s && (i.destroy(), s === i && this.#t.delete(i.queryHash), this.notify({ type: "removed", query: i }));
  }
  clear() {
    Ft.batch(() => {
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
    const s = { exact: !0, ...i };
    return this.getAll().find(
      (r) => Pd(s, r)
    );
  }
  findAll(i = {}) {
    const s = this.getAll();
    return Object.keys(i).length > 0 ? s.filter((r) => Pd(i, r)) : s;
  }
  notify(i) {
    Ft.batch(() => {
      this.listeners.forEach((s) => {
        s(i);
      });
    });
  }
  onFocus() {
    Ft.batch(() => {
      this.getAll().forEach((i) => {
        i.onFocus();
      });
    });
  }
  onOnline() {
    Ft.batch(() => {
      this.getAll().forEach((i) => {
        i.onOnline();
      });
    });
  }
}, Nv = class {
  #t;
  #l;
  #e;
  #n;
  #a;
  #u;
  #i;
  #s;
  constructor(i = {}) {
    this.#t = i.queryCache || new Mv(), this.#l = i.mutationCache || new _v(), this.#e = i.defaultOptions || {}, this.#n = /* @__PURE__ */ new Map(), this.#a = /* @__PURE__ */ new Map(), this.#u = 0;
  }
  mount() {
    this.#u++, this.#u === 1 && (this.#i = vh.subscribe(async (i) => {
      i && (await this.resumePausedMutations(), this.#t.onFocus());
    }), this.#s = ti.subscribe(async (i) => {
      i && (await this.resumePausedMutations(), this.#t.onOnline());
    }));
  }
  unmount() {
    this.#u--, this.#u === 0 && (this.#i?.(), this.#i = void 0, this.#s?.(), this.#s = void 0);
  }
  isFetching(i) {
    return this.#t.findAll({ ...i, fetchStatus: "fetching" }).length;
  }
  isMutating(i) {
    return this.#l.findAll({ ...i, status: "pending" }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   */
  getQueryData(i) {
    const s = this.defaultQueryOptions({ queryKey: i });
    return this.#t.get(s.queryHash)?.state.data;
  }
  ensureQueryData(i) {
    const s = this.defaultQueryOptions(i), r = this.#t.build(this, s), f = r.state.data;
    return f === void 0 ? this.fetchQuery(i) : (i.revalidateIfStale && r.isStaleByTime(Us(s.staleTime, r)) && this.prefetchQuery(s), Promise.resolve(f));
  }
  getQueriesData(i) {
    return this.#t.findAll(i).map(({ queryKey: s, state: r }) => {
      const f = r.data;
      return [s, f];
    });
  }
  setQueryData(i, s, r) {
    const f = this.defaultQueryOptions({ queryKey: i }), D = this.#t.get(
      f.queryHash
    )?.state.data, N = sv(s, D);
    if (N !== void 0)
      return this.#t.build(this, f).setData(N, { ...r, manual: !0 });
  }
  setQueriesData(i, s, r) {
    return Ft.batch(
      () => this.#t.findAll(i).map(({ queryKey: f }) => [
        f,
        this.setQueryData(f, s, r)
      ])
    );
  }
  getQueryState(i) {
    const s = this.defaultQueryOptions({ queryKey: i });
    return this.#t.get(
      s.queryHash
    )?.state;
  }
  removeQueries(i) {
    const s = this.#t;
    Ft.batch(() => {
      s.findAll(i).forEach((r) => {
        s.remove(r);
      });
    });
  }
  resetQueries(i, s) {
    const r = this.#t;
    return Ft.batch(() => (r.findAll(i).forEach((f) => {
      f.reset();
    }), this.refetchQueries(
      {
        type: "active",
        ...i
      },
      s
    )));
  }
  cancelQueries(i, s = {}) {
    const r = { revert: !0, ...s }, f = Ft.batch(
      () => this.#t.findAll(i).map((v) => v.cancel(r))
    );
    return Promise.all(f).then(Re).catch(Re);
  }
  invalidateQueries(i, s = {}) {
    return Ft.batch(() => (this.#t.findAll(i).forEach((r) => {
      r.invalidate();
    }), i?.refetchType === "none" ? Promise.resolve() : this.refetchQueries(
      {
        ...i,
        type: i?.refetchType ?? i?.type ?? "active"
      },
      s
    )));
  }
  refetchQueries(i, s = {}) {
    const r = {
      ...s,
      cancelRefetch: s.cancelRefetch ?? !0
    }, f = Ft.batch(
      () => this.#t.findAll(i).filter((v) => !v.isDisabled() && !v.isStatic()).map((v) => {
        let D = v.fetch(void 0, r);
        return r.throwOnError || (D = D.catch(Re)), v.state.fetchStatus === "paused" ? Promise.resolve() : D;
      })
    );
    return Promise.all(f).then(Re);
  }
  fetchQuery(i) {
    const s = this.defaultQueryOptions(i);
    s.retry === void 0 && (s.retry = !1);
    const r = this.#t.build(this, s);
    return r.isStaleByTime(
      Us(s.staleTime, r)
    ) ? r.fetch(s) : Promise.resolve(r.state.data);
  }
  prefetchQuery(i) {
    return this.fetchQuery(i).then(Re).catch(Re);
  }
  fetchInfiniteQuery(i) {
    return i.behavior = uh(i.pages), this.fetchQuery(i);
  }
  prefetchInfiniteQuery(i) {
    return this.fetchInfiniteQuery(i).then(Re).catch(Re);
  }
  ensureInfiniteQueryData(i) {
    return i.behavior = uh(i.pages), this.ensureQueryData(i);
  }
  resumePausedMutations() {
    return ti.isOnline() ? this.#l.resumePausedMutations() : Promise.resolve();
  }
  getQueryCache() {
    return this.#t;
  }
  getMutationCache() {
    return this.#l;
  }
  getDefaultOptions() {
    return this.#e;
  }
  setDefaultOptions(i) {
    this.#e = i;
  }
  setQueryDefaults(i, s) {
    this.#n.set(Rn(i), {
      queryKey: i,
      defaultOptions: s
    });
  }
  getQueryDefaults(i) {
    const s = [...this.#n.values()], r = {};
    return s.forEach((f) => {
      Un(i, f.queryKey) && Object.assign(r, f.defaultOptions);
    }), r;
  }
  setMutationDefaults(i, s) {
    this.#a.set(Rn(i), {
      mutationKey: i,
      defaultOptions: s
    });
  }
  getMutationDefaults(i) {
    const s = [...this.#a.values()], r = {};
    return s.forEach((f) => {
      Un(i, f.mutationKey) && Object.assign(r, f.defaultOptions);
    }), r;
  }
  defaultQueryOptions(i) {
    if (i._defaulted)
      return i;
    const s = {
      ...this.#e.queries,
      ...this.getQueryDefaults(i.queryKey),
      ...i,
      _defaulted: !0
    };
    return s.queryHash || (s.queryHash = ws(
      s.queryKey,
      s
    )), s.refetchOnReconnect === void 0 && (s.refetchOnReconnect = s.networkMode !== "always"), s.throwOnError === void 0 && (s.throwOnError = !!s.suspense), !s.networkMode && s.persister && (s.networkMode = "offlineFirst"), s.queryFn === Qs && (s.enabled = !1), s;
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
    this.#t.clear(), this.#l.clear();
  }
}, Rv = St.createContext(
  void 0
), Uv = ({
  client: i,
  children: s
}) => (St.useEffect(() => (i.mount(), () => {
  i.unmount();
}), [i]), /* @__PURE__ */ R.jsx(Rv.Provider, { value: i, children: s }));
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Th = (...i) => i.filter((s, r, f) => !!s && s.trim() !== "" && f.indexOf(s) === r).join(" ").trim();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const xv = (i) => i.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const jv = (i) => i.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (s, r, f) => f ? f.toUpperCase() : r.toLowerCase()
);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const ch = (i) => {
  const s = jv(i);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var Ms = {
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
const Hv = (i) => {
  for (const s in i)
    if (s.startsWith("aria-") || s === "role" || s === "title")
      return !0;
  return !1;
}, qv = St.createContext({}), Bv = () => St.useContext(qv), wv = St.forwardRef(
  ({ color: i, size: s, strokeWidth: r, absoluteStrokeWidth: f, className: v = "", children: D, iconNode: N, ...z }, A) => {
    const {
      size: g = 24,
      strokeWidth: U = 2,
      absoluteStrokeWidth: x = !1,
      color: Y = "currentColor",
      className: V = ""
    } = Bv() ?? {}, W = f ?? x ? Number(r ?? U) * 24 / Number(s ?? g) : r ?? U;
    return St.createElement(
      "svg",
      {
        ref: A,
        ...Ms,
        width: s ?? g ?? Ms.width,
        height: s ?? g ?? Ms.height,
        stroke: i ?? Y,
        strokeWidth: W,
        className: Th("lucide", V, v),
        ...!D && !Hv(z) && { "aria-hidden": "true" },
        ...z
      },
      [
        ...N.map(([J, P]) => St.createElement(J, P)),
        ...Array.isArray(D) ? D : [D]
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
const ai = (i, s) => {
  const r = St.forwardRef(
    ({ className: f, ...v }, D) => St.createElement(wv, {
      ref: D,
      iconNode: s,
      className: Th(
        `lucide-${xv(ch(i))}`,
        `lucide-${i}`,
        f
      ),
      ...v
    })
  );
  return r.displayName = ch(i), r;
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Qv = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
], Yv = ai("arrow-right", Qv);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Gv = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 16v-4", key: "1dtifu" }],
  ["path", { d: "M12 8h.01", key: "e9boi3" }]
], Lv = ai("info", Gv);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Xv = [
  ["path", { d: "M12 3v18", key: "108xh3" }],
  ["path", { d: "m19 8 3 8a5 5 0 0 1-6 0zV7", key: "zcdpyk" }],
  ["path", { d: "M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1", key: "1yorad" }],
  ["path", { d: "m5 8 3 8a5 5 0 0 1-6 0zV7", key: "eua70x" }],
  ["path", { d: "M7 21h10", key: "1b0cd5" }]
], sh = ai("scale", Xv);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Zv = [
  ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
  ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
], Vv = ai("search", Zv);
function Kv(i) {
  const s = (i ?? "").toLowerCase();
  return s.includes("approv") || s.includes("accept") ? { color: "#6ee7b7", bg: "var(--ws-green-soft)", border: "rgba(76,195,138,0.3)" } : s.includes("reject") || s.includes("denied") || s.includes("fail") ? { color: "#fca5a5", bg: "var(--ws-red-soft)", border: "rgba(255,123,114,0.3)" } : s.includes("defer") || s.includes("pending") || s.includes("review") ? { color: "#fbbf24", bg: "var(--ws-amber-soft)", border: "rgba(242,182,109,0.3)" } : { color: "var(--ws-text-muted)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" };
}
function fh({ outcome: i }) {
  const s = Kv(i);
  return /* @__PURE__ */ R.jsx("span", { style: { display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: s.color, background: s.bg, border: `1px solid ${s.border}` }, children: i || "unknown" });
}
const oh = ["#4aa3ff", "#4cc38a", "#f2b66d", "#c084fc", "#ff7b72", "#38bdf8", "#a78bfa"];
function Jv({ step: i, index: s }) {
  const r = oh[s % oh.length];
  return /* @__PURE__ */ R.jsxs("div", { style: { padding: "14px 16px", borderRadius: "var(--ws-radius)", background: "var(--ws-surface)", border: `1px solid ${r}28`, borderLeft: `3px solid ${r}`, position: "relative" }, children: [
    i.type && /* @__PURE__ */ R.jsx("div", { style: { fontFamily: "monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: r, marginBottom: 5 }, children: i.type }),
    /* @__PURE__ */ R.jsx("div", { style: { color: "var(--ws-text)", fontSize: 13, fontWeight: 600 }, children: i.content || i.id }),
    i.id && i.id !== i.content && /* @__PURE__ */ R.jsx("div", { style: { fontFamily: "monospace", fontSize: 10, color: "var(--ws-text-dim)", marginTop: 3 }, children: i.id })
  ] });
}
function Fv({ label: i }) {
  return /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "2px 0" }, children: [
    /* @__PURE__ */ R.jsx("div", { style: { width: 2, height: 10, background: "var(--ws-border)" } }),
    /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", maxWidth: 260 }, children: [
      /* @__PURE__ */ R.jsx(Yv, { size: 10, color: "var(--ws-accent)" }),
      /* @__PURE__ */ R.jsx("span", { style: { fontSize: 10, fontWeight: 700, color: "var(--ws-accent)", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: i })
    ] }),
    /* @__PURE__ */ R.jsx("div", { style: { width: 2, height: 10, background: "var(--ws-border)" } })
  ] });
}
function Wv({ chain: i, loading: s }) {
  return s ? /* @__PURE__ */ R.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [1, 2, 3].map((r) => /* @__PURE__ */ R.jsx("div", { className: "ws-skeleton", style: { height: 68 } }, r)) }) : i.length ? /* @__PURE__ */ R.jsx("div", { style: { display: "flex", flexDirection: "column" }, children: i.map((r, f) => /* @__PURE__ */ R.jsxs("div", { children: [
    /* @__PURE__ */ R.jsx(Jv, { step: r, index: f }),
    f < i.length - 1 && /* @__PURE__ */ R.jsx(Fv, { label: i[f + 1]?.relationship || "→" })
  ] }, `${r.id}-${f}`)) }) : /* @__PURE__ */ R.jsxs("div", { className: "ws-empty", children: [
    /* @__PURE__ */ R.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ R.jsx(Lv, { size: 28 }) }),
    /* @__PURE__ */ R.jsx("div", { className: "ws-empty-title", children: "No chain steps" }),
    /* @__PURE__ */ R.jsx("div", { className: "ws-empty-body", children: "No causal chain steps were found for this decision." })
  ] });
}
function kv() {
  const [i, s] = St.useState([]), [r, f] = St.useState(null), [v, D] = St.useState([]), [N, z] = St.useState([]), [A, g] = St.useState(!1), [U, x] = St.useState(!0), [Y, V] = St.useState(""), [W, J] = St.useState(!1), [P, tt] = St.useState(""), Et = St.useRef(null);
  St.useEffect(() => {
    const K = new AbortController();
    return x(!0), tt(""), fetch(W ? "/api/decisions?include_auto=1" : "/api/decisions", { signal: K.signal }).then(async (X) => {
      if (!X.ok) throw new Error(`HTTP ${X.status}`);
      const G = await X.json();
      return X.status === 207 && tt(G.message || "Warning: Partial success loading decisions."), G;
    }).then((X) => {
      K.signal.aborted || (s(X), X.length > 0 && bt(X[0]));
    }).catch((X) => {
      X?.name !== "AbortError" && tt(X instanceof Error ? X.message : "Failed to load decisions.");
    }).finally(() => {
      K.signal.aborted || x(!1);
    }), () => K.abort();
  }, [W]), St.useEffect(() => () => {
    Et.current?.abort();
  }, []);
  async function bt(K) {
    Et.current?.abort();
    const X = new AbortController();
    Et.current = X, f(K), g(!0), D([]), z([]), tt("");
    try {
      const G = await fetch(`/api/decisions/${encodeURIComponent(K.decision_id)}/chain`, { signal: X.signal });
      if (!G.ok) throw new Error(`HTTP ${G.status}`);
      const Qt = await G.json();
      G.status === 207 && !X.signal.aborted && tt(Qt.message || "Warning: Partial success loading chain."), X.signal.aborted || D(Qt.chain || []);
      const ne = await fetch(`/api/decisions/${encodeURIComponent(K.decision_id)}/precedents`, { signal: X.signal });
      if (ne.ok) {
        const De = await ne.json(), ue = Array.isArray(De) ? De : De.precedents || De.results || [];
        X.signal.aborted || z(Array.isArray(ue) ? ue : []);
      }
    } catch (G) {
      G instanceof Error && G.name !== "AbortError" && tt(G.message);
    } finally {
      X.signal.aborted || g(!1);
    }
  }
  const Ot = St.useMemo(() => {
    const K = Y.toLowerCase().trim();
    return K ? i.filter(
      (X) => [X.decision_id, X.category, X.outcome, X.scenario, X.reasoning, X.status].map((G) => String(G ?? "").toLowerCase()).some((G) => G.includes(K))
    ) : i;
  }, [i, Y]);
  return /* @__PURE__ */ R.jsxs("div", { className: "ws-page", style: { flexDirection: "row" }, children: [
    /* @__PURE__ */ R.jsxs("div", { className: "ws-sidebar", style: { width: 290 }, children: [
      /* @__PURE__ */ R.jsxs("div", { className: "ws-sidebar-header", children: [
        /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }, children: [
          /* @__PURE__ */ R.jsx("div", { style: { width: 30, height: 30, borderRadius: 9, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }, children: /* @__PURE__ */ R.jsx(sh, { size: 15 }) }),
          /* @__PURE__ */ R.jsx("div", { style: { color: "var(--ws-text)", fontSize: 14, fontWeight: 700 }, children: "Decisions" }),
          i.length > 0 && !U && /* @__PURE__ */ R.jsx("span", { className: "ws-pill ws-pill--mono", style: { marginLeft: "auto" }, children: i.length })
        ] }),
        /* @__PURE__ */ R.jsxs("div", { style: { position: "relative" }, children: [
          /* @__PURE__ */ R.jsx(Vv, { size: 12, color: "var(--ws-text-dim)", style: { position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" } }),
          /* @__PURE__ */ R.jsx(
            "input",
            {
              className: "ws-input",
              type: "text",
              placeholder: "Filter by ID, category, outcome…",
              value: Y,
              onChange: (K) => V(K.target.value),
              style: { paddingLeft: 30, fontSize: 12 }
            }
          ),
          /* @__PURE__ */ R.jsxs("label", { style: { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--ws-text-dim)" }, children: [
            /* @__PURE__ */ R.jsx("input", { type: "checkbox", checked: W, onChange: (K) => J(K.target.checked) }),
            "显示自动抽取"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ R.jsx("div", { className: "ws-sidebar-body", children: U ? /* @__PURE__ */ R.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [1, 2, 3, 4, 5].map((K) => /* @__PURE__ */ R.jsx("div", { className: "ws-skeleton", style: { height: 58 } }, K)) }) : Ot.length === 0 ? /* @__PURE__ */ R.jsxs("div", { className: "ws-empty", style: { padding: "28px 12px" }, children: [
        /* @__PURE__ */ R.jsx("div", { className: "ws-empty-title", children: i.length === 0 ? "还没有决策" : "没有匹配的决策" }),
        /* @__PURE__ */ R.jsx("div", { className: "ws-empty-body", children: i.length === 0 ? "图上还没有决策。" : "换个词，或清掉筛选。" })
      ] }) : /* @__PURE__ */ R.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: Ot.map((K) => {
        const X = r?.decision_id === K.decision_id;
        return /* @__PURE__ */ R.jsxs(
          "button",
          {
            className: `ws-list-item${X ? " ws-list-item--active" : ""}`,
            onClick: () => {
              bt(K);
            },
            children: [
              /* @__PURE__ */ R.jsx("div", { style: { fontWeight: 700, fontSize: 12, marginBottom: 5, color: X ? "#e8f6ff" : "var(--ws-text)" }, children: K.decision_id }),
              /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }, children: [
                K.category && /* @__PURE__ */ R.jsx("span", { style: { fontSize: 10, color: "var(--ws-text-dim)" }, children: K.category }),
                K.outcome && /* @__PURE__ */ R.jsx(fh, { outcome: K.outcome })
              ] })
            ]
          },
          K.decision_id
        );
      }) }) })
    ] }),
    /* @__PURE__ */ R.jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }, children: [
      /* @__PURE__ */ R.jsx("div", { style: { position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 70% 20%, rgba(74,163,255,0.04), transparent 55%)", pointerEvents: "none" } }),
      P ? /* @__PURE__ */ R.jsx("div", { style: { padding: 12, borderRadius: 14, color: "#ffb4c2", background: "rgba(255,157,175,0.1)", border: "1px solid rgba(255,157,175,0.18)", margin: "16px 16px 0 16px", zIndex: 2, position: "relative" }, children: P }) : null,
      r ? /* @__PURE__ */ R.jsxs("div", { className: "ws-scroll ws-padded ws-animate-in", style: { position: "relative", zIndex: 1 }, children: [
        /* @__PURE__ */ R.jsxs("div", { style: { marginBottom: 28 }, children: [
          /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }, children: [
            /* @__PURE__ */ R.jsxs("div", { children: [
              /* @__PURE__ */ R.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 6 }, children: "Decision Record" }),
              /* @__PURE__ */ R.jsx("h2", { className: "ws-title", children: r.decision_id })
            ] }),
            r.outcome && /* @__PURE__ */ R.jsx(fh, { outcome: r.outcome })
          ] }),
          r.category && /* @__PURE__ */ R.jsx("span", { className: "ws-pill ws-pill--mono", children: r.category })
        ] }),
        /* @__PURE__ */ R.jsxs("div", { className: "ws-card", style: { padding: 22 }, children: [
          /* @__PURE__ */ R.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }, children: [
            /* @__PURE__ */ R.jsx("div", { style: { width: 8, height: 8, borderRadius: 999, background: "linear-gradient(135deg, var(--ws-accent), var(--ws-amber))", boxShadow: "0 0 10px rgba(74,163,255,0.4)" } }),
            /* @__PURE__ */ R.jsx("div", { style: { color: "var(--ws-text)", fontSize: 14, fontWeight: 700 }, children: "Causal Chain" }),
            v.length > 0 && !A && /* @__PURE__ */ R.jsxs("span", { className: "ws-pill ws-pill--accent", style: { marginLeft: "auto" }, children: [
              v.length,
              " step",
              v.length !== 1 ? "s" : ""
            ] })
          ] }),
          /* @__PURE__ */ R.jsx(Wv, { chain: v, loading: A })
        ] }),
        /* @__PURE__ */ R.jsxs("div", { className: "ws-card", style: { padding: 22, marginTop: 16 }, children: [
          /* @__PURE__ */ R.jsx("div", { style: { color: "var(--ws-text)", fontSize: 14, fontWeight: 700, marginBottom: 12 }, children: "先例" }),
          N.length ? N.map((K, X) => /* @__PURE__ */ R.jsx("div", { style: { fontSize: 12, marginBottom: 8 }, children: String(K.outcome || K.category || K.decision_id || "先例") }, String(K.decision_id || X))) : /* @__PURE__ */ R.jsx("div", { className: "ws-empty-body", children: "没有已生效先例。" })
        ] })
      ] }) : /* @__PURE__ */ R.jsx("div", { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }, children: /* @__PURE__ */ R.jsxs("div", { className: "ws-empty", children: [
        /* @__PURE__ */ R.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ R.jsx(sh, { size: 32 }) }),
        /* @__PURE__ */ R.jsx("div", { className: "ws-empty-title", children: "No decision selected" }),
        /* @__PURE__ */ R.jsx("div", { className: "ws-empty-body", children: "Select a decision from the list to inspect its causal chain and metadata." })
      ] }) })
    ] })
  ] });
}
function qe(i, s) {
  return typeof document > "u" ? s : getComputedStyle(document.documentElement).getPropertyValue(i).trim() || s;
}
function $v() {
  qe("--dsw-alias-bg-base", "#ffffff"), qe("--dsw-alias-bg-layer-1", "#f6f8fa"), qe("--dsw-alias-bg-layer-2", "#eef1f4"), qe("--dsw-alias-label-primary", "#1f2328"), qe("--dsw-alias-label-secondary", "#3d444d"), qe("--dsw-alias-brand-primary", "#0969da"), qe("--dsw-alias-border-l2", "rgba(31,35,40,0.15)"), qe("--dsw-alias-label-primary-foreground", "") || qe("--dsw-alias-label-on-primary", "") || qe("--dsw-alias-label-on-brand", "");
}
const Iv = /^\s*Entity\s*\(/;
function ll(i) {
  return typeof i == "string" && Iv.test(i);
}
function Pv(i) {
  const s = i.match(/Entity\s*\(\s*text\s*=\s*(['"])((?:\\.|(?!\1).)*)\1/);
  return s ? s[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
}
function Wt(i) {
  return typeof i == "string" ? i.trim() : "";
}
function ni(i) {
  return i.properties && typeof i.properties == "object" ? i.properties : {};
}
function ei(i) {
  const s = ni(i), r = Wt(i.id);
  if (r.startsWith("file:")) {
    const v = r.split(/[/\\]/).pop() || r;
    if (v && !ll(v)) return v;
  }
  if (r.startsWith("session:")) {
    const v = Wt(s.content) || Wt(i.content);
    if (v) return v.split(`
`)[0].slice(0, 24);
  }
  const f = [s.label, s.name, s.content, i.content, r];
  for (const v of f) {
    const D = Wt(v);
    if (!(!D || ll(D)))
      return D;
  }
  for (const v of f) {
    const D = Wt(v);
    if (!D || !ll(D)) continue;
    const N = Pv(D);
    if (N) return N;
  }
  return r && !ll(r) ? r : "节点";
}
const t0 = /* @__PURE__ */ new Set(["UNKNOWN", "entity", "Entity", "DATE", "PERSON"]);
function xn(i) {
  const s = Wt(i.id);
  if (!s) return !0;
  const r = ni(i), f = Wt(i.content) || Wt(r.content);
  if (ll(s) || ll(f)) return !0;
  const v = Wt(i.type);
  return !!t0.has(v);
}
function Pu(i) {
  const s = ei(i), r = { ...ni(i) };
  return (!Wt(r.label) || ll(r.label)) && (r.label = s), (!Wt(r.name) || ll(r.name)) && (r.name = s), (!Wt(r.content) || ll(r.content)) && (r.content = s), {
    ...i,
    content: s,
    properties: r
  };
}
function e0(i, s) {
  const r = s.trim().toLowerCase();
  if (!r) return 0;
  const f = ei(i).toLowerCase(), v = Wt(i.id).toLowerCase(), D = Wt(i.type).toLowerCase(), N = ni(i), z = [N.name, N.content, N.label].map((U) => Wt(U).toLowerCase()).filter(Boolean), A = [f, v, D, ...z];
  let g = 0;
  return f === r || v === r ? g = 1 : f.startsWith(r) || v.startsWith(r) ? g = 0.92 : A.some((U) => U.includes(r)) && (g = 0.78), g <= 0 ? 0 : Math.min(g, 1);
}
function l0(i, s, r = 8) {
  return i.filter((f) => !xn(f)).map((f) => ({ node: Pu(f), score: e0(f, s) })).filter((f) => f.score > 0).sort((f, v) => v.score !== f.score ? v.score - f.score : ei(f.node).localeCompare(ei(v.node), "zh")).slice(0, r);
}
function a0() {
  if (typeof document > "u") return "";
  const i = document.querySelectorAll(".dsos-root");
  for (let r = 0; r < i.length; r++) {
    const f = i[r];
    if (!(f instanceof HTMLElement) || f.offsetParent === null && f.getClientRects().length === 0) continue;
    const v = f.getAttribute("data-cwd") || "";
    if (v) return v;
  }
  const s = document.querySelector(".dsos-root[data-dsos-semantic]");
  return s && s.getAttribute("data-cwd") || "";
}
const n0 = [
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
function u0(i) {
  let s = String(i || "").split("?")[0];
  return (s.startsWith("/semantic-os/api/") || s === "/semantic-os/api") && (s = s.slice(12)), s === "/api" ? "" : s.startsWith("/api/") ? s.slice(5) : null;
}
function Hs(i) {
  const s = u0(i);
  return s == null ? !1 : s ? n0.some((r) => s === r || s.startsWith(r + "/")) : !0;
}
function Ns(i) {
  try {
    const s = new URL(i, window.location.origin);
    if (Hs(s.pathname) && s.pathname.startsWith("/api/"))
      return s.pathname = "/semantic-os" + s.pathname, s.toString();
  } catch {
  }
  return Hs(i.split("?")[0]) && i.startsWith("/api/") ? "/semantic-os" + i : i;
}
function rh(i) {
  try {
    if (typeof i == "string") return new URL(i, window.location.origin).pathname;
    if (i instanceof URL) return i.pathname;
    if (i instanceof Request) return new URL(i.url, window.location.origin).pathname;
  } catch {
  }
  return "";
}
function Ht(i, s) {
  return new Response(JSON.stringify(s), {
    status: i,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
let i0 = null;
function c0(i, s, r) {
  try {
    const f = JSON.parse(i);
    return s.reasonMode && (f.mode = s.reasonMode()), f.apply_to_graph = !!r, i0 = {
      facts: f.facts,
      rules: f.rules,
      mode: f.mode,
      apply_to_graph: f.apply_to_graph
    }, JSON.stringify(f);
  } catch {
    return i;
  }
}
function s0(i) {
  return i.get("x-dsh-reason-write") === "1";
}
function f0(i) {
  if (!i || typeof i != "object") return !1;
  const s = i;
  if (typeof s.node_count == "number") return s.node_count > 0;
  if (typeof s.nodes == "number") return s.nodes > 0;
  const r = s.nodes ?? s.items;
  return Array.isArray(i) ? i.length > 0 : Array.isArray(r) ? r.length > 0 : !1;
}
async function o0(i, s, r) {
  const f = r.body;
  let v = null;
  if (typeof FormData < "u" && f instanceof FormData) {
    const x = f.get("file");
    x instanceof File && (v = x);
  }
  if (!v) return Ht(400, { detail: "只认 json 或 csv。" });
  const D = v.name || "", N = D.toLowerCase().split(".").pop();
  if (N !== "json" && N !== "csv")
    return Ht(400, { detail: "只认 json 或 csv。" });
  const z = await v.text();
  let A = !1;
  try {
    const Y = await (await i(`/semantic-os/nodes?cwd=${encodeURIComponent(s)}`, {
      headers: { "x-dsh-cwd": s }
    })).json().catch(() => null);
    A = f0(Y);
  } catch {
    A = !1;
  }
  if (A && !window.confirm("图里已有内容。导入会覆盖当前图，确定吗？"))
    return Ht(400, { detail: "已取消导入。" });
  const g = await i("/semantic-os/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dsh-cwd": s },
    body: JSON.stringify({ cwd: s, filename: D, data: z, confirm: !0 })
  });
  if (g.ok) return g;
  const U = await g.json().catch(() => ({}));
  return Ht(g.status || 400, {
    ...U,
    detail: "导入失败，已恢复上一份图。"
  });
}
async function r0(i, s, r) {
  let f = "json";
  try {
    if (typeof r.body == "string") {
      const z = JSON.parse(r.body);
      f = String(z.format || "json").toLowerCase();
    }
  } catch {
  }
  if (f !== "json" && f !== "csv")
    return Ht(400, { detail: "只认 json 或 csv。" });
  const v = window.prompt("绝对路径", "");
  if (v == null) return Ht(400, { detail: "已取消导出。" });
  const D = String(v).trim(), N = async (z) => {
    const A = await i("/semantic-os/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dsh-cwd": s },
      body: JSON.stringify({
        cwd: s,
        format: f,
        dest: D || void 0,
        confirm: z || void 0
      })
    }), g = await A.json().catch(() => ({}));
    if (g && g.error === "OUTSIDE_CWD")
      return window.confirm("导出路径在当前目录外。确定继续？") ? N(!0) : Ht(400, { detail: "已取消导出。" });
    if (g && g.error === "REJECT_FORMAT")
      return Ht(400, { detail: "只认 json 或 csv。" });
    if (!A.ok || g && g.ok === !1)
      return Ht(A.status || 400, { detail: g.detail || "只认 json 或 csv。" });
    if (!D && g.data != null) {
      const U = typeof g.data == "string" ? g.data : JSON.stringify(g.data, null, 2);
      return new Response(U, {
        status: 200,
        headers: {
          "content-type": f === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="graph.${f}"`
        }
      });
    }
    return Ht(200, g);
  };
  return N(!1);
}
async function d0(i, s, r) {
  if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？"))
    return Ht(400, { detail: "已取消合并。" });
  const f = await i(s, r);
  if (f.ok) return f;
  const v = await f.json().catch(() => ({}));
  return Ht(f.status || 400, {
    ...v,
    detail: "合并没写成。"
  });
}
function qs(i) {
  return /\/api\/ontology\/shacl\//.test(i) ? "规则没检查成。" : /\/api\/ontology\/registry/.test(i) ? "词表列表没读成。" : /\/api\/provenance/.test(i) ? "血缘没读成。" : "";
}
function h0(i) {
  return typeof i == "string" && /[\u4e00-\u9fff]/.test(i);
}
async function dh(i, s) {
  const r = qs(s);
  if (!r || i.ok) return i;
  const f = await i.json().catch(() => ({})), v = f && typeof f == "object" ? f : {}, D = h0(v.detail) ? v.detail : r;
  return Ht(i.status || 400, { ...v, detail: D });
}
function y0(i) {
  if (!i || typeof i != "object") return i;
  const s = i;
  if (Array.isArray(s.nodes)) {
    const r = s.nodes.filter((f) => !xn(f)).map((f) => Pu(f));
    return {
      ...s,
      nodes: r,
      ...typeof s.count == "number" ? { count: r.length } : {},
      ...typeof s.total == "number" ? { total: r.length } : {},
      ...typeof s.node_count == "number" ? { node_count: r.length } : {}
    };
  }
  return Array.isArray(s.results) ? {
    ...s,
    results: s.results.filter((r) => {
      if (!r || typeof r != "object") return !1;
      const v = r.node || r;
      return !xn(v);
    }).map((r) => {
      if (!r || typeof r != "object") return r;
      const f = r;
      return f.node ? { ...f, node: Pu(f.node) } : r;
    })
  } : s.id || s.content || s.properties ? Pu(s) : i;
}
async function m0(i, s, r) {
  const f = await i(s, r);
  if (!f.ok) return f;
  const v = await f.json().catch(() => null);
  return Ht(f.status, y0(v));
}
async function v0(i, s, r, f) {
  let v = "", D = 8;
  try {
    if (typeof f.body == "string") {
      const U = JSON.parse(f.body);
      v = String(U.query || U.q || "").trim(), D = Number(U.limit) || 8;
    }
  } catch {
  }
  const z = await (await i("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": s }
  })).json().catch(() => null), g = (z && typeof z == "object" && Array.isArray(z.nodes) ? z.nodes : []).filter((U) => !xn(U));
  return Ht(200, { results: l0(g, v, D) });
}
async function g0(i, s) {
  const r = await i("/semantic-os/api/temporal/bounds", {
    headers: { "x-dsh-cwd": s }
  });
  if (!r.ok)
    return Ht(200, { min: null, max: null, count: 0, empty: !0 });
  const f = await r.json().catch(() => null);
  return Ht(200, f && typeof f == "object" ? f : { min: null, max: null, count: 0, empty: !0 });
}
async function p0(i, s, r, f) {
  const v = await i(r, f);
  if (!v.ok) return v;
  const D = await v.json().catch(() => null);
  if (!D || typeof D != "object") return Ht(v.status, D);
  const N = D, z = Array.isArray(N.active_node_ids) ? N.active_node_ids.map((V) => String(V)) : [], g = await (await i("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": s }
  })).json().catch(() => null), U = g && typeof g == "object" && Array.isArray(g.nodes) ? g.nodes : [], x = new Set(
    U.filter((V) => xn(V)).map((V) => String(V.id || "")).filter(Boolean)
  ), Y = z.filter((V) => !x.has(V));
  return Ht(v.status, {
    ...N,
    active_node_ids: Y,
    active_node_count: Y.length
  });
}
const Ua = [];
function S0(i, s = {}) {
  const r = String(i || ""), f = window.fetch.bind(window);
  return Ua.push(f), window.fetch = (v, D) => {
    const N = rh(v);
    if (!Hs(N)) return f(v, D);
    const z = a0() || r;
    let A = v, g = { ...D || {} };
    typeof v == "string" ? A = Ns(v) : v instanceof URL ? A = Ns(v.toString()) : v instanceof Request && (A = new Request(Ns(v.url), v));
    const U = new Headers();try { const __h=g.headers; const __ct=__h&&(__h.get?__h.get("content-type"):(__h["content-type"]||__h["Content-Type"]));if(__ct) U.set("content-type", String(__ct)); } catch {}const x = !1;
    if (z && x ? U.set("x-dsh-cwd", z) : U.delete("x-dsh-cwd"), g.headers = U, z && !x) {
      const P = (tt) => /[?&]cwd=/.test(tt) ? tt : tt + (tt.includes("?") ? "&" : "?") + "cwd=" + encodeURIComponent(z);
      typeof A == "string" ? A = P(A) : A instanceof URL ? A.searchParams.get("cwd") || A.searchParams.set("cwd", z) : A instanceof Request && (A = new Request(P(A.url), A));
    }
    const Y = rh(A), V = String(g.method || (A instanceof Request ? A.method : "GET")).toUpperCase();
    if (V === "POST" && Y.endsWith("/api/reason") && typeof g.body == "string") {
      const P = s0(U);
      return g.body = c0(g.body, s, P), f(A, g).then(async (Et) => {
        const Ot = await Et.clone().json().catch(() => ({}));
        try {
          if (!Et.ok)
            return window.dispatchEvent(new CustomEvent("dsh-reason-failed", { detail: Ot })), Et;
          window.dispatchEvent(new CustomEvent(P ? "dsh-reason-applied" : "dsh-reason-previewed", {
            detail: Ot
          }));
        } catch {
        }
        return Et;
      });
    }
    const W = N.match(/\/api\/decisions\/([^/]+)\/chain$/);
    if (W)
      try {
        window.dispatchEvent(new CustomEvent("dsh-decision-selected", {
          detail: { id: decodeURIComponent(W[1]) }
        }));
      } catch {
      }
    if (s.ioLock && V === "POST" && /\/api\/import\/?$/.test(N))
      return o0(f, z, g);
    if (s.ioLock && V === "POST" && /\/api\/export\/?$/.test(N))
      return r0(f, z, g);
    if (s.mergeConfirm && V === "POST" && /\/api\/enrich\/merge\/?$/.test(N))
      return d0(f, A, g);
    if (V === "GET" && /\/api\/graph\/nodes\/?$/.test(N))
      return m0(f, A, g);
    if (V === "GET" && /\/api\/temporal\/bounds\/?$/.test(N))
      return g0(f, z);
    if (V === "GET" && /\/api\/temporal\/snapshot\/?$/.test(N))
      return p0(f, z, A, g);
    if (V === "POST" && /\/api\/graph\/search\/?$/.test(N))
      return v0(f, z, A, g);
    const J = f(A, g).catch((P) => {
      const tt = qs(N);
      if (tt) return Ht(502, { detail: tt });
      throw P;
    });
    return V === "GET" && /\/api\/decisions\/?$/.test(N) ? J.then(async (P) => P.status !== 422 ? dh(P, N) : new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" }
    })) : qs(N) ? J.then((P) => dh(P, N)) : J;
  }, () => {
    const v = Ua.lastIndexOf(f);
    v >= 0 && Ua.splice(v, 1), window.fetch = Ua.length ? Ua[Ua.length - 1] : f;
  };
}
const Mn = {
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
function b0(i) {
  let s = i;
  return s = s.replace(/(\d[\d,]*)\s+nodes\s+[·•]\s+(\d[\d,]*)\s+edges/ig, "$1 个点 · $2 条边"), s = s.replace(/\b(\d[\d,]*)\s+shapes\b/ig, "$1 条规则"), s = s.replace(/\b(\d[\d,]*)\s+constraints\b/ig, "$1 条约束"), s = s.replace(/(\d[\d,]*)\s+direct neighbors highlighted/ig, "$1 个直接邻居已标出"), s = s.replace(/(\d[\d,]*)\s+direct neighbors in the full graph/ig, "全图里有 $1 个直接邻居"), s = s.replace(/(\d[\d,]*)\s+source fields/ig, "$1 个出处字段"), s = s.replace(/(\d[\d,]*)\s+candidate links/ig, "$1 条可能的连线"), s = s.replace(/\b(\d[\d,]*)\s+hops\b/ig, "$1 跳"), s === i ? null : s;
}
function hh(i) {
  return i.replace(/\s+/g, " ").trim();
}
function E0(i) {
  return i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function yh(i) {
  const s = i.trim();
  if (!s) return i;
  const r = b0(s);
  if (r) return i.replace(s, r);
  if (Mn[s]) return i.replace(s, Mn[s]);
  const f = hh(s);
  if (Mn[f]) return i.replace(s, Mn[f]);
  let v = f;
  const D = Object.entries(Mn).sort((N, z) => z[0].length - N[0].length);
  for (const [N, z] of D) {
    const A = hh(N);
    if (!(!A.includes(" ") && /^[A-Za-z]/.test(A) && A.length < 16) && !(A.length < 6)) {
      if (/^[A-Za-z]/.test(A)) {
        const g = new RegExp(`(?<![A-Za-z])${E0(A)}(?![A-Za-z])`, "g");
        v = v.replace(g, z);
        continue;
      }
      v.includes(A) && (v = v.split(A).join(z));
    }
  }
  return v === f ? i : i.replace(s, v);
}
function mh(i) {
  for (; i; ) {
    const s = i.tagName;
    if (s === "TEXTAREA" || s === "PRE" || s === "CODE" || s === "SCRIPT" || s === "STYLE") return !0;
    const r = typeof i.className == "string" ? i.className : "";
    if (r.includes("monaco-editor") || r.includes("view-lines") || r.includes("mtk")) return !0;
    i = i.parentElement;
  }
  return !1;
}
function Nn(i) {
  if (i.nodeType === Node.TEXT_NODE) {
    if (mh(i.parentElement)) return;
    const r = yh(i.nodeValue || "");
    r !== i.nodeValue && (i.nodeValue = r);
    return;
  }
  if (i.nodeType !== Node.ELEMENT_NODE) return;
  const s = i;
  if (!mh(s)) {
    for (const r of ["placeholder", "title", "aria-label"]) {
      const f = s.getAttribute(r);
      if (!f) continue;
      const v = yh(f);
      v !== f && s.setAttribute(r, v);
    }
    s.childNodes.forEach(Nn);
  }
}
function A0(i) {
  Nn(i);
  const s = new MutationObserver((r) => {
    for (const f of r)
      f.addedNodes.forEach(Nn), f.type === "characterData" && f.target && Nn(f.target), f.type === "attributes" && f.target && Nn(f.target);
  });
  return s.observe(i, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["placeholder", "title", "aria-label"] }), () => s.disconnect();
}
function T0({ actions: i }) {
  return i?.length ? /* @__PURE__ */ R.jsx(R.Fragment, { children: i.map((s) => /* @__PURE__ */ R.jsx("button", { type: "button", className: "dsh-mode-btn", onClick: s.onClick, children: s.label }, s.id)) }) : null;
}
function z0() {
  return new Nv({
    defaultOptions: {
      queries: { refetchOnWindowFocus: !1, retry: 1 }
    }
  });
}
function O0(i) {
  const [s, r] = St.useState(""), [f, v] = St.useState(null), [D, N] = St.useState(""), [z, A] = St.useState(!1);
  St.useEffect(() => {
    const U = (x) => {
      const Y = x.detail?.id || "";
      Y && (r(Y), v(null), N(""), A(!1));
    };
    return window.addEventListener("dsh-decision-selected", U), () => window.removeEventListener("dsh-decision-selected", U);
  }, []);
  const g = () => {
    if (!s) {
      N("先例没加载成。");
      return;
    }
    N(""), fetch(`/api/decisions/${encodeURIComponent(s)}/precedents`).then(async (U) => {
      const x = await U.json().catch(() => ({}));
      if (!U.ok) throw new Error("fail");
      v(x), A(!0);
    }).catch(() => N("先例没加载成。"));
  };
  return /* @__PURE__ */ R.jsxs("div", { className: "dsh-precedents-strip", children: [
    /* @__PURE__ */ R.jsxs("div", { className: "dsh-lock-bar", children: [
      /* @__PURE__ */ R.jsx(T0, { actions: i.hostActions }),
      /* @__PURE__ */ R.jsx("button", { type: "button", className: "dsh-mode-btn", onClick: g, disabled: !s, children: "先例" }),
      D ? /* @__PURE__ */ R.jsx("span", { className: "dsh-fail", children: D }) : null
    ] }),
    z && f ? /* @__PURE__ */ R.jsx("pre", { className: "dsh-precedents-pre", children: JSON.stringify(f, null, 2) }) : null
  ] });
}
function D0(i) {
  return /* @__PURE__ */ R.jsxs("div", { className: "dsh-decisions-frame", children: [
    /* @__PURE__ */ R.jsx(O0, { hostActions: i.hostActions }),
    /* @__PURE__ */ R.jsx("div", { className: "dsh-decisions-bench", children: /* @__PURE__ */ R.jsx(kv, {}) })
  ] });
}
function C0(i, s = {}) {
  const r = String(s.cwd || "");
  i.classList.add("dsh-decisions-host"), $v();
  const f = z0(), v = S0(r), D = A0(i), N = lv.createRoot(i);
  return N.render(
    /* @__PURE__ */ R.jsx(Uv, { client: f, children: /* @__PURE__ */ R.jsx(D0, { hostActions: s.hostActions }) })
  ), () => {
    D(), v(), N.unmount(), f.clear();
  };
}
const _0 = { mount: C0 };
export {
  _0 as default,
  C0 as mount
};
