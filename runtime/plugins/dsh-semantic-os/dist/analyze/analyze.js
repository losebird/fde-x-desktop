function Hg(u) {
  return u && u.__esModule && Object.prototype.hasOwnProperty.call(u, "default") ? u.default : u;
}
var Xs = { exports: {} }, Un = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var mh;
function Bg() {
  if (mh) return Un;
  mh = 1;
  var u = /* @__PURE__ */ Symbol.for("react.transitional.element"), c = /* @__PURE__ */ Symbol.for("react.fragment");
  function o(r, d, p) {
    var O = null;
    if (p !== void 0 && (O = "" + p), d.key !== void 0 && (O = "" + d.key), "key" in d) {
      p = {};
      for (var E in d)
        E !== "key" && (p[E] = d[E]);
    } else p = d;
    return d = p.ref, {
      $$typeof: u,
      type: r,
      key: O,
      ref: d !== void 0 ? d : null,
      props: p
    };
  }
  return Un.Fragment = c, Un.jsx = o, Un.jsxs = o, Un;
}
var gh;
function Lg() {
  return gh || (gh = 1, Xs.exports = Bg()), Xs.exports;
}
var S = Lg(), Zs = { exports: {} }, I = {};
/**
 * @license React
 * react.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ph;
function Qg() {
  if (ph) return I;
  ph = 1;
  var u = /* @__PURE__ */ Symbol.for("react.transitional.element"), c = /* @__PURE__ */ Symbol.for("react.portal"), o = /* @__PURE__ */ Symbol.for("react.fragment"), r = /* @__PURE__ */ Symbol.for("react.strict_mode"), d = /* @__PURE__ */ Symbol.for("react.profiler"), p = /* @__PURE__ */ Symbol.for("react.consumer"), O = /* @__PURE__ */ Symbol.for("react.context"), E = /* @__PURE__ */ Symbol.for("react.forward_ref"), b = /* @__PURE__ */ Symbol.for("react.suspense"), y = /* @__PURE__ */ Symbol.for("react.memo"), w = /* @__PURE__ */ Symbol.for("react.lazy"), _ = /* @__PURE__ */ Symbol.for("react.activity"), U = Symbol.iterator;
  function L(m) {
    return m === null || typeof m != "object" ? null : (m = U && m[U] || m["@@iterator"], typeof m == "function" ? m : null);
  }
  var V = {
    isMounted: function() {
      return !1;
    },
    enqueueForceUpdate: function() {
    },
    enqueueReplaceState: function() {
    },
    enqueueSetState: function() {
    }
  }, N = Object.assign, Q = {};
  function J(m, R, B) {
    this.props = m, this.context = R, this.refs = Q, this.updater = B || V;
  }
  J.prototype.isReactComponent = {}, J.prototype.setState = function(m, R) {
    if (typeof m != "object" && typeof m != "function" && m != null)
      throw Error(
        "takes an object of state variables to update or a function which returns an object of state variables."
      );
    this.updater.enqueueSetState(this, m, R, "setState");
  }, J.prototype.forceUpdate = function(m) {
    this.updater.enqueueForceUpdate(this, m, "forceUpdate");
  };
  function $() {
  }
  $.prototype = J.prototype;
  function dt(m, R, B) {
    this.props = m, this.context = R, this.refs = Q, this.updater = B || V;
  }
  var ht = dt.prototype = new $();
  ht.constructor = dt, N(ht, J.prototype), ht.isPureReactComponent = !0;
  var nt = Array.isArray;
  function q() {
  }
  var Y = { H: null, A: null, T: null, S: null }, yt = Object.prototype.hasOwnProperty;
  function at(m, R, B) {
    var G = B.ref;
    return {
      $$typeof: u,
      type: m,
      key: R,
      ref: G !== void 0 ? G : null,
      props: B
    };
  }
  function P(m, R) {
    return at(m.type, R, m.props);
  }
  function Zt(m) {
    return typeof m == "object" && m !== null && m.$$typeof === u;
  }
  function Qt(m) {
    var R = { "=": "=0", ":": "=2" };
    return "$" + m.replace(/[=:]/g, function(B) {
      return R[B];
    });
  }
  var Se = /\/+/g;
  function $t(m, R) {
    return typeof m == "object" && m !== null && m.key != null ? Qt("" + m.key) : R.toString(36);
  }
  function st(m) {
    switch (m.status) {
      case "fulfilled":
        return m.value;
      case "rejected":
        throw m.reason;
      default:
        switch (typeof m.status == "string" ? m.then(q, q) : (m.status = "pending", m.then(
          function(R) {
            m.status === "pending" && (m.status = "fulfilled", m.value = R);
          },
          function(R) {
            m.status === "pending" && (m.status = "rejected", m.reason = R);
          }
        )), m.status) {
          case "fulfilled":
            return m.value;
          case "rejected":
            throw m.reason;
        }
    }
    throw m;
  }
  function M(m, R, B, G, tt) {
    var ut = typeof m;
    (ut === "undefined" || ut === "boolean") && (m = null);
    var bt = !1;
    if (m === null) bt = !0;
    else
      switch (ut) {
        case "bigint":
        case "string":
        case "number":
          bt = !0;
          break;
        case "object":
          switch (m.$$typeof) {
            case u:
            case c:
              bt = !0;
              break;
            case w:
              return bt = m._init, M(
                bt(m._payload),
                R,
                B,
                G,
                tt
              );
          }
      }
    if (bt)
      return tt = tt(m), bt = G === "" ? "." + $t(m, 0) : G, nt(tt) ? (B = "", bt != null && (B = bt.replace(Se, "$&/") + "/"), M(tt, R, B, "", function(Ya) {
        return Ya;
      })) : tt != null && (Zt(tt) && (tt = P(
        tt,
        B + (tt.key == null || m && m.key === tt.key ? "" : ("" + tt.key).replace(
          Se,
          "$&/"
        ) + "/") + bt
      )), R.push(tt)), 1;
    bt = 0;
    var It = G === "" ? "." : G + ":";
    if (nt(m))
      for (var Dt = 0; Dt < m.length; Dt++)
        G = m[Dt], ut = It + $t(G, Dt), bt += M(
          G,
          R,
          B,
          ut,
          tt
        );
    else if (Dt = L(m), typeof Dt == "function")
      for (m = Dt.call(m), Dt = 0; !(G = m.next()).done; )
        G = G.value, ut = It + $t(G, Dt++), bt += M(
          G,
          R,
          B,
          ut,
          tt
        );
    else if (ut === "object") {
      if (typeof m.then == "function")
        return M(
          st(m),
          R,
          B,
          G,
          tt
        );
      throw R = String(m), Error(
        "Objects are not valid as a React child (found: " + (R === "[object Object]" ? "object with keys {" + Object.keys(m).join(", ") + "}" : R) + "). If you meant to render a collection of children, use an array instead."
      );
    }
    return bt;
  }
  function H(m, R, B) {
    if (m == null) return m;
    var G = [], tt = 0;
    return M(m, G, "", "", function(ut) {
      return R.call(B, ut, tt++);
    }), G;
  }
  function F(m) {
    if (m._status === -1) {
      var R = m._result;
      R = R(), R.then(
        function(B) {
          (m._status === 0 || m._status === -1) && (m._status = 1, m._result = B);
        },
        function(B) {
          (m._status === 0 || m._status === -1) && (m._status = 2, m._result = B);
        }
      ), m._status === -1 && (m._status = 0, m._result = R);
    }
    if (m._status === 1) return m._result.default;
    throw m._result;
  }
  var pt = typeof reportError == "function" ? reportError : function(m) {
    if (typeof window == "object" && typeof window.ErrorEvent == "function") {
      var R = new window.ErrorEvent("error", {
        bubbles: !0,
        cancelable: !0,
        message: typeof m == "object" && m !== null && typeof m.message == "string" ? String(m.message) : String(m),
        error: m
      });
      if (!window.dispatchEvent(R)) return;
    } else if (typeof process == "object" && typeof process.emit == "function") {
      process.emit("uncaughtException", m);
      return;
    }
    console.error(m);
  }, St = {
    map: H,
    forEach: function(m, R, B) {
      H(
        m,
        function() {
          R.apply(this, arguments);
        },
        B
      );
    },
    count: function(m) {
      var R = 0;
      return H(m, function() {
        R++;
      }), R;
    },
    toArray: function(m) {
      return H(m, function(R) {
        return R;
      }) || [];
    },
    only: function(m) {
      if (!Zt(m))
        throw Error(
          "React.Children.only expected to receive a single React element child."
        );
      return m;
    }
  };
  return I.Activity = _, I.Children = St, I.Component = J, I.Fragment = o, I.Profiler = d, I.PureComponent = dt, I.StrictMode = r, I.Suspense = b, I.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = Y, I.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(m) {
      return Y.H.useMemoCache(m);
    }
  }, I.cache = function(m) {
    return function() {
      return m.apply(null, arguments);
    };
  }, I.cacheSignal = function() {
    return null;
  }, I.cloneElement = function(m, R, B) {
    if (m == null)
      throw Error(
        "The argument must be a React element, but you passed " + m + "."
      );
    var G = N({}, m.props), tt = m.key;
    if (R != null)
      for (ut in R.key !== void 0 && (tt = "" + R.key), R)
        !yt.call(R, ut) || ut === "key" || ut === "__self" || ut === "__source" || ut === "ref" && R.ref === void 0 || (G[ut] = R[ut]);
    var ut = arguments.length - 2;
    if (ut === 1) G.children = B;
    else if (1 < ut) {
      for (var bt = Array(ut), It = 0; It < ut; It++)
        bt[It] = arguments[It + 2];
      G.children = bt;
    }
    return at(m.type, tt, G);
  }, I.createContext = function(m) {
    return m = {
      $$typeof: O,
      _currentValue: m,
      _currentValue2: m,
      _threadCount: 0,
      Provider: null,
      Consumer: null
    }, m.Provider = m, m.Consumer = {
      $$typeof: p,
      _context: m
    }, m;
  }, I.createElement = function(m, R, B) {
    var G, tt = {}, ut = null;
    if (R != null)
      for (G in R.key !== void 0 && (ut = "" + R.key), R)
        yt.call(R, G) && G !== "key" && G !== "__self" && G !== "__source" && (tt[G] = R[G]);
    var bt = arguments.length - 2;
    if (bt === 1) tt.children = B;
    else if (1 < bt) {
      for (var It = Array(bt), Dt = 0; Dt < bt; Dt++)
        It[Dt] = arguments[Dt + 2];
      tt.children = It;
    }
    if (m && m.defaultProps)
      for (G in bt = m.defaultProps, bt)
        tt[G] === void 0 && (tt[G] = bt[G]);
    return at(m, ut, tt);
  }, I.createRef = function() {
    return { current: null };
  }, I.forwardRef = function(m) {
    return { $$typeof: E, render: m };
  }, I.isValidElement = Zt, I.lazy = function(m) {
    return {
      $$typeof: w,
      _payload: { _status: -1, _result: m },
      _init: F
    };
  }, I.memo = function(m, R) {
    return {
      $$typeof: y,
      type: m,
      compare: R === void 0 ? null : R
    };
  }, I.startTransition = function(m) {
    var R = Y.T, B = {};
    Y.T = B;
    try {
      var G = m(), tt = Y.S;
      tt !== null && tt(B, G), typeof G == "object" && G !== null && typeof G.then == "function" && G.then(q, pt);
    } catch (ut) {
      pt(ut);
    } finally {
      R !== null && B.types !== null && (R.types = B.types), Y.T = R;
    }
  }, I.unstable_useCacheRefresh = function() {
    return Y.H.useCacheRefresh();
  }, I.use = function(m) {
    return Y.H.use(m);
  }, I.useActionState = function(m, R, B) {
    return Y.H.useActionState(m, R, B);
  }, I.useCallback = function(m, R) {
    return Y.H.useCallback(m, R);
  }, I.useContext = function(m) {
    return Y.H.useContext(m);
  }, I.useDebugValue = function() {
  }, I.useDeferredValue = function(m, R) {
    return Y.H.useDeferredValue(m, R);
  }, I.useEffect = function(m, R) {
    return Y.H.useEffect(m, R);
  }, I.useEffectEvent = function(m) {
    return Y.H.useEffectEvent(m);
  }, I.useId = function() {
    return Y.H.useId();
  }, I.useImperativeHandle = function(m, R, B) {
    return Y.H.useImperativeHandle(m, R, B);
  }, I.useInsertionEffect = function(m, R) {
    return Y.H.useInsertionEffect(m, R);
  }, I.useLayoutEffect = function(m, R) {
    return Y.H.useLayoutEffect(m, R);
  }, I.useMemo = function(m, R) {
    return Y.H.useMemo(m, R);
  }, I.useOptimistic = function(m, R) {
    return Y.H.useOptimistic(m, R);
  }, I.useReducer = function(m, R, B) {
    return Y.H.useReducer(m, R, B);
  }, I.useRef = function(m) {
    return Y.H.useRef(m);
  }, I.useState = function(m) {
    return Y.H.useState(m);
  }, I.useSyncExternalStore = function(m, R, B) {
    return Y.H.useSyncExternalStore(
      m,
      R,
      B
    );
  }, I.useTransition = function() {
    return Y.H.useTransition();
  }, I.version = "19.2.5", I;
}
var vh;
function cr() {
  return vh || (vh = 1, Zs.exports = Qg()), Zs.exports;
}
var Z = cr();
const Ba = /* @__PURE__ */ Hg(Z);
var Vs = { exports: {} }, qn = {}, Ks = { exports: {} }, Js = {};
/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var bh;
function Yg() {
  return bh || (bh = 1, (function(u) {
    function c(M, H) {
      var F = M.length;
      M.push(H);
      t: for (; 0 < F; ) {
        var pt = F - 1 >>> 1, St = M[pt];
        if (0 < d(St, H))
          M[pt] = H, M[F] = St, F = pt;
        else break t;
      }
    }
    function o(M) {
      return M.length === 0 ? null : M[0];
    }
    function r(M) {
      if (M.length === 0) return null;
      var H = M[0], F = M.pop();
      if (F !== H) {
        M[0] = F;
        t: for (var pt = 0, St = M.length, m = St >>> 1; pt < m; ) {
          var R = 2 * (pt + 1) - 1, B = M[R], G = R + 1, tt = M[G];
          if (0 > d(B, F))
            G < St && 0 > d(tt, B) ? (M[pt] = tt, M[G] = F, pt = G) : (M[pt] = B, M[R] = F, pt = R);
          else if (G < St && 0 > d(tt, F))
            M[pt] = tt, M[G] = F, pt = G;
          else break t;
        }
      }
      return H;
    }
    function d(M, H) {
      var F = M.sortIndex - H.sortIndex;
      return F !== 0 ? F : M.id - H.id;
    }
    if (u.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
      var p = performance;
      u.unstable_now = function() {
        return p.now();
      };
    } else {
      var O = Date, E = O.now();
      u.unstable_now = function() {
        return O.now() - E;
      };
    }
    var b = [], y = [], w = 1, _ = null, U = 3, L = !1, V = !1, N = !1, Q = !1, J = typeof setTimeout == "function" ? setTimeout : null, $ = typeof clearTimeout == "function" ? clearTimeout : null, dt = typeof setImmediate < "u" ? setImmediate : null;
    function ht(M) {
      for (var H = o(y); H !== null; ) {
        if (H.callback === null) r(y);
        else if (H.startTime <= M)
          r(y), H.sortIndex = H.expirationTime, c(b, H);
        else break;
        H = o(y);
      }
    }
    function nt(M) {
      if (N = !1, ht(M), !V)
        if (o(b) !== null)
          V = !0, q || (q = !0, Qt());
        else {
          var H = o(y);
          H !== null && st(nt, H.startTime - M);
        }
    }
    var q = !1, Y = -1, yt = 5, at = -1;
    function P() {
      return Q ? !0 : !(u.unstable_now() - at < yt);
    }
    function Zt() {
      if (Q = !1, q) {
        var M = u.unstable_now();
        at = M;
        var H = !0;
        try {
          t: {
            V = !1, N && (N = !1, $(Y), Y = -1), L = !0;
            var F = U;
            try {
              e: {
                for (ht(M), _ = o(b); _ !== null && !(_.expirationTime > M && P()); ) {
                  var pt = _.callback;
                  if (typeof pt == "function") {
                    _.callback = null, U = _.priorityLevel;
                    var St = pt(
                      _.expirationTime <= M
                    );
                    if (M = u.unstable_now(), typeof St == "function") {
                      _.callback = St, ht(M), H = !0;
                      break e;
                    }
                    _ === o(b) && r(b), ht(M);
                  } else r(b);
                  _ = o(b);
                }
                if (_ !== null) H = !0;
                else {
                  var m = o(y);
                  m !== null && st(
                    nt,
                    m.startTime - M
                  ), H = !1;
                }
              }
              break t;
            } finally {
              _ = null, U = F, L = !1;
            }
            H = void 0;
          }
        } finally {
          H ? Qt() : q = !1;
        }
      }
    }
    var Qt;
    if (typeof dt == "function")
      Qt = function() {
        dt(Zt);
      };
    else if (typeof MessageChannel < "u") {
      var Se = new MessageChannel(), $t = Se.port2;
      Se.port1.onmessage = Zt, Qt = function() {
        $t.postMessage(null);
      };
    } else
      Qt = function() {
        J(Zt, 0);
      };
    function st(M, H) {
      Y = J(function() {
        M(u.unstable_now());
      }, H);
    }
    u.unstable_IdlePriority = 5, u.unstable_ImmediatePriority = 1, u.unstable_LowPriority = 4, u.unstable_NormalPriority = 3, u.unstable_Profiling = null, u.unstable_UserBlockingPriority = 2, u.unstable_cancelCallback = function(M) {
      M.callback = null;
    }, u.unstable_forceFrameRate = function(M) {
      0 > M || 125 < M ? console.error(
        "forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"
      ) : yt = 0 < M ? Math.floor(1e3 / M) : 5;
    }, u.unstable_getCurrentPriorityLevel = function() {
      return U;
    }, u.unstable_next = function(M) {
      switch (U) {
        case 1:
        case 2:
        case 3:
          var H = 3;
          break;
        default:
          H = U;
      }
      var F = U;
      U = H;
      try {
        return M();
      } finally {
        U = F;
      }
    }, u.unstable_requestPaint = function() {
      Q = !0;
    }, u.unstable_runWithPriority = function(M, H) {
      switch (M) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
          break;
        default:
          M = 3;
      }
      var F = U;
      U = M;
      try {
        return H();
      } finally {
        U = F;
      }
    }, u.unstable_scheduleCallback = function(M, H, F) {
      var pt = u.unstable_now();
      switch (typeof F == "object" && F !== null ? (F = F.delay, F = typeof F == "number" && 0 < F ? pt + F : pt) : F = pt, M) {
        case 1:
          var St = -1;
          break;
        case 2:
          St = 250;
          break;
        case 5:
          St = 1073741823;
          break;
        case 4:
          St = 1e4;
          break;
        default:
          St = 5e3;
      }
      return St = F + St, M = {
        id: w++,
        callback: H,
        priorityLevel: M,
        startTime: F,
        expirationTime: St,
        sortIndex: -1
      }, F > pt ? (M.sortIndex = F, c(y, M), o(b) === null && M === o(y) && (N ? ($(Y), Y = -1) : N = !0, st(nt, F - pt))) : (M.sortIndex = St, c(b, M), V || L || (V = !0, q || (q = !0, Qt()))), M;
    }, u.unstable_shouldYield = P, u.unstable_wrapCallback = function(M) {
      var H = U;
      return function() {
        var F = U;
        U = H;
        try {
          return M.apply(this, arguments);
        } finally {
          U = F;
        }
      };
    };
  })(Js)), Js;
}
var Sh;
function Gg() {
  return Sh || (Sh = 1, Ks.exports = Yg()), Ks.exports;
}
var ks = { exports: {} }, Wt = {};
/**
 * @license React
 * react-dom.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Eh;
function Xg() {
  if (Eh) return Wt;
  Eh = 1;
  var u = cr();
  function c(b) {
    var y = "https://react.dev/errors/" + b;
    if (1 < arguments.length) {
      y += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var w = 2; w < arguments.length; w++)
        y += "&args[]=" + encodeURIComponent(arguments[w]);
    }
    return "Minified React error #" + b + "; visit " + y + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function o() {
  }
  var r = {
    d: {
      f: o,
      r: function() {
        throw Error(c(522));
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
  }, d = /* @__PURE__ */ Symbol.for("react.portal");
  function p(b, y, w) {
    var _ = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return {
      $$typeof: d,
      key: _ == null ? null : "" + _,
      children: b,
      containerInfo: y,
      implementation: w
    };
  }
  var O = u.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function E(b, y) {
    if (b === "font") return "";
    if (typeof y == "string")
      return y === "use-credentials" ? y : "";
  }
  return Wt.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = r, Wt.createPortal = function(b, y) {
    var w = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!y || y.nodeType !== 1 && y.nodeType !== 9 && y.nodeType !== 11)
      throw Error(c(299));
    return p(b, y, null, w);
  }, Wt.flushSync = function(b) {
    var y = O.T, w = r.p;
    try {
      if (O.T = null, r.p = 2, b) return b();
    } finally {
      O.T = y, r.p = w, r.d.f();
    }
  }, Wt.preconnect = function(b, y) {
    typeof b == "string" && (y ? (y = y.crossOrigin, y = typeof y == "string" ? y === "use-credentials" ? y : "" : void 0) : y = null, r.d.C(b, y));
  }, Wt.prefetchDNS = function(b) {
    typeof b == "string" && r.d.D(b);
  }, Wt.preinit = function(b, y) {
    if (typeof b == "string" && y && typeof y.as == "string") {
      var w = y.as, _ = E(w, y.crossOrigin), U = typeof y.integrity == "string" ? y.integrity : void 0, L = typeof y.fetchPriority == "string" ? y.fetchPriority : void 0;
      w === "style" ? r.d.S(
        b,
        typeof y.precedence == "string" ? y.precedence : void 0,
        {
          crossOrigin: _,
          integrity: U,
          fetchPriority: L
        }
      ) : w === "script" && r.d.X(b, {
        crossOrigin: _,
        integrity: U,
        fetchPriority: L,
        nonce: typeof y.nonce == "string" ? y.nonce : void 0
      });
    }
  }, Wt.preinitModule = function(b, y) {
    if (typeof b == "string")
      if (typeof y == "object" && y !== null) {
        if (y.as == null || y.as === "script") {
          var w = E(
            y.as,
            y.crossOrigin
          );
          r.d.M(b, {
            crossOrigin: w,
            integrity: typeof y.integrity == "string" ? y.integrity : void 0,
            nonce: typeof y.nonce == "string" ? y.nonce : void 0
          });
        }
      } else y == null && r.d.M(b);
  }, Wt.preload = function(b, y) {
    if (typeof b == "string" && typeof y == "object" && y !== null && typeof y.as == "string") {
      var w = y.as, _ = E(w, y.crossOrigin);
      r.d.L(b, w, {
        crossOrigin: _,
        integrity: typeof y.integrity == "string" ? y.integrity : void 0,
        nonce: typeof y.nonce == "string" ? y.nonce : void 0,
        type: typeof y.type == "string" ? y.type : void 0,
        fetchPriority: typeof y.fetchPriority == "string" ? y.fetchPriority : void 0,
        referrerPolicy: typeof y.referrerPolicy == "string" ? y.referrerPolicy : void 0,
        imageSrcSet: typeof y.imageSrcSet == "string" ? y.imageSrcSet : void 0,
        imageSizes: typeof y.imageSizes == "string" ? y.imageSizes : void 0,
        media: typeof y.media == "string" ? y.media : void 0
      });
    }
  }, Wt.preloadModule = function(b, y) {
    if (typeof b == "string")
      if (y) {
        var w = E(y.as, y.crossOrigin);
        r.d.m(b, {
          as: typeof y.as == "string" && y.as !== "script" ? y.as : void 0,
          crossOrigin: w,
          integrity: typeof y.integrity == "string" ? y.integrity : void 0
        });
      } else r.d.m(b);
  }, Wt.requestFormReset = function(b) {
    r.d.r(b);
  }, Wt.unstable_batchedUpdates = function(b, y) {
    return b(y);
  }, Wt.useFormState = function(b, y, w) {
    return O.H.useFormState(b, y, w);
  }, Wt.useFormStatus = function() {
    return O.H.useHostTransitionStatus();
  }, Wt.version = "19.2.5", Wt;
}
var Th;
function Zg() {
  if (Th) return ks.exports;
  Th = 1;
  function u() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(u);
      } catch (c) {
        console.error(c);
      }
  }
  return u(), ks.exports = Xg(), ks.exports;
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
var Ah;
function Vg() {
  if (Ah) return qn;
  Ah = 1;
  var u = Gg(), c = cr(), o = Zg();
  function r(t) {
    var e = "https://react.dev/errors/" + t;
    if (1 < arguments.length) {
      e += "?args[]=" + encodeURIComponent(arguments[1]);
      for (var l = 2; l < arguments.length; l++)
        e += "&args[]=" + encodeURIComponent(arguments[l]);
    }
    return "Minified React error #" + t + "; visit " + e + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
  }
  function d(t) {
    return !(!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11);
  }
  function p(t) {
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
  function O(t) {
    if (t.tag === 13) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function E(t) {
    if (t.tag === 31) {
      var e = t.memoizedState;
      if (e === null && (t = t.alternate, t !== null && (e = t.memoizedState)), e !== null) return e.dehydrated;
    }
    return null;
  }
  function b(t) {
    if (p(t) !== t)
      throw Error(r(188));
  }
  function y(t) {
    var e = t.alternate;
    if (!e) {
      if (e = p(t), e === null) throw Error(r(188));
      return e !== t ? null : t;
    }
    for (var l = t, a = e; ; ) {
      var n = l.return;
      if (n === null) break;
      var i = n.alternate;
      if (i === null) {
        if (a = n.return, a !== null) {
          l = a;
          continue;
        }
        break;
      }
      if (n.child === i.child) {
        for (i = n.child; i; ) {
          if (i === l) return b(n), t;
          if (i === a) return b(n), e;
          i = i.sibling;
        }
        throw Error(r(188));
      }
      if (l.return !== a.return) l = n, a = i;
      else {
        for (var s = !1, f = n.child; f; ) {
          if (f === l) {
            s = !0, l = n, a = i;
            break;
          }
          if (f === a) {
            s = !0, a = n, l = i;
            break;
          }
          f = f.sibling;
        }
        if (!s) {
          for (f = i.child; f; ) {
            if (f === l) {
              s = !0, l = i, a = n;
              break;
            }
            if (f === a) {
              s = !0, a = i, l = n;
              break;
            }
            f = f.sibling;
          }
          if (!s) throw Error(r(189));
        }
      }
      if (l.alternate !== a) throw Error(r(190));
    }
    if (l.tag !== 3) throw Error(r(188));
    return l.stateNode.current === l ? t : e;
  }
  function w(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t;
    for (t = t.child; t !== null; ) {
      if (e = w(t), e !== null) return e;
      t = t.sibling;
    }
    return null;
  }
  var _ = Object.assign, U = /* @__PURE__ */ Symbol.for("react.element"), L = /* @__PURE__ */ Symbol.for("react.transitional.element"), V = /* @__PURE__ */ Symbol.for("react.portal"), N = /* @__PURE__ */ Symbol.for("react.fragment"), Q = /* @__PURE__ */ Symbol.for("react.strict_mode"), J = /* @__PURE__ */ Symbol.for("react.profiler"), $ = /* @__PURE__ */ Symbol.for("react.consumer"), dt = /* @__PURE__ */ Symbol.for("react.context"), ht = /* @__PURE__ */ Symbol.for("react.forward_ref"), nt = /* @__PURE__ */ Symbol.for("react.suspense"), q = /* @__PURE__ */ Symbol.for("react.suspense_list"), Y = /* @__PURE__ */ Symbol.for("react.memo"), yt = /* @__PURE__ */ Symbol.for("react.lazy"), at = /* @__PURE__ */ Symbol.for("react.activity"), P = /* @__PURE__ */ Symbol.for("react.memo_cache_sentinel"), Zt = Symbol.iterator;
  function Qt(t) {
    return t === null || typeof t != "object" ? null : (t = Zt && t[Zt] || t["@@iterator"], typeof t == "function" ? t : null);
  }
  var Se = /* @__PURE__ */ Symbol.for("react.client.reference");
  function $t(t) {
    if (t == null) return null;
    if (typeof t == "function")
      return t.$$typeof === Se ? null : t.displayName || t.name || null;
    if (typeof t == "string") return t;
    switch (t) {
      case N:
        return "Fragment";
      case J:
        return "Profiler";
      case Q:
        return "StrictMode";
      case nt:
        return "Suspense";
      case q:
        return "SuspenseList";
      case at:
        return "Activity";
    }
    if (typeof t == "object")
      switch (t.$$typeof) {
        case V:
          return "Portal";
        case dt:
          return t.displayName || "Context";
        case $:
          return (t._context.displayName || "Context") + ".Consumer";
        case ht:
          var e = t.render;
          return t = t.displayName, t || (t = e.displayName || e.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
        case Y:
          return e = t.displayName || null, e !== null ? e : $t(t.type) || "Memo";
        case yt:
          e = t._payload, t = t._init;
          try {
            return $t(t(e));
          } catch {
          }
      }
    return null;
  }
  var st = Array.isArray, M = c.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, H = o.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, F = {
    pending: !1,
    data: null,
    method: null,
    action: null
  }, pt = [], St = -1;
  function m(t) {
    return { current: t };
  }
  function R(t) {
    0 > St || (t.current = pt[St], pt[St] = null, St--);
  }
  function B(t, e) {
    St++, pt[St] = t.current, t.current = e;
  }
  var G = m(null), tt = m(null), ut = m(null), bt = m(null);
  function It(t, e) {
    switch (B(ut, e), B(tt, t), B(G, null), e.nodeType) {
      case 9:
      case 11:
        t = (t = e.documentElement) && (t = t.namespaceURI) ? Bd(t) : 0;
        break;
      default:
        if (t = e.tagName, e = e.namespaceURI)
          e = Bd(e), t = Ld(e, t);
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
    R(G), B(G, t);
  }
  function Dt() {
    R(G), R(tt), R(ut);
  }
  function Ya(t) {
    t.memoizedState !== null && B(bt, t);
    var e = G.current, l = Ld(e, t.type);
    e !== l && (B(tt, t), B(G, l));
  }
  function Jn(t) {
    tt.current === t && (R(G), R(tt)), bt.current === t && (R(bt), wn._currentValue = F);
  }
  var zi, dr;
  function Dl(t) {
    if (zi === void 0)
      try {
        throw Error();
      } catch (l) {
        var e = l.stack.trim().match(/\n( *(at )?)/);
        zi = e && e[1] || "", dr = -1 < l.stack.indexOf(`
    at`) ? " (<anonymous>)" : -1 < l.stack.indexOf("@") ? "@unknown:0:0" : "";
      }
    return `
` + zi + t + dr;
  }
  var xi = !1;
  function Mi(t, e) {
    if (!t || xi) return "";
    xi = !0;
    var l = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
      var a = {
        DetermineComponentFrameRoot: function() {
          try {
            if (e) {
              var D = function() {
                throw Error();
              };
              if (Object.defineProperty(D.prototype, "props", {
                set: function() {
                  throw Error();
                }
              }), typeof Reflect == "object" && Reflect.construct) {
                try {
                  Reflect.construct(D, []);
                } catch (x) {
                  var z = x;
                }
                Reflect.construct(t, [], D);
              } else {
                try {
                  D.call();
                } catch (x) {
                  z = x;
                }
                t.call(D.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                z = x;
              }
              (D = t()) && typeof D.catch == "function" && D.catch(function() {
              });
            }
          } catch (x) {
            if (x && z && typeof x.stack == "string")
              return [x.stack, z.stack];
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
      var i = a.DetermineComponentFrameRoot(), s = i[0], f = i[1];
      if (s && f) {
        var h = s.split(`
`), A = f.split(`
`);
        for (n = a = 0; a < h.length && !h[a].includes("DetermineComponentFrameRoot"); )
          a++;
        for (; n < A.length && !A[n].includes(
          "DetermineComponentFrameRoot"
        ); )
          n++;
        if (a === h.length || n === A.length)
          for (a = h.length - 1, n = A.length - 1; 1 <= a && 0 <= n && h[a] !== A[n]; )
            n--;
        for (; 1 <= a && 0 <= n; a--, n--)
          if (h[a] !== A[n]) {
            if (a !== 1 || n !== 1)
              do
                if (a--, n--, 0 > n || h[a] !== A[n]) {
                  var C = `
` + h[a].replace(" at new ", " at ");
                  return t.displayName && C.includes("<anonymous>") && (C = C.replace("<anonymous>", t.displayName)), C;
                }
              while (1 <= a && 0 <= n);
            break;
          }
      }
    } finally {
      xi = !1, Error.prepareStackTrace = l;
    }
    return (l = t ? t.displayName || t.name : "") ? Dl(l) : "";
  }
  function yy(t, e) {
    switch (t.tag) {
      case 26:
      case 27:
      case 5:
        return Dl(t.type);
      case 16:
        return Dl("Lazy");
      case 13:
        return t.child !== e && e !== null ? Dl("Suspense Fallback") : Dl("Suspense");
      case 19:
        return Dl("SuspenseList");
      case 0:
      case 15:
        return Mi(t.type, !1);
      case 11:
        return Mi(t.type.render, !1);
      case 1:
        return Mi(t.type, !0);
      case 31:
        return Dl("Activity");
      default:
        return "";
    }
  }
  function hr(t) {
    try {
      var e = "", l = null;
      do
        e += yy(t, l), l = t, t = t.return;
      while (t);
      return e;
    } catch (a) {
      return `
Error generating stack: ` + a.message + `
` + a.stack;
    }
  }
  var Ci = Object.prototype.hasOwnProperty, Ri = u.unstable_scheduleCallback, ji = u.unstable_cancelCallback, my = u.unstable_shouldYield, gy = u.unstable_requestPaint, re = u.unstable_now, py = u.unstable_getCurrentPriorityLevel, yr = u.unstable_ImmediatePriority, mr = u.unstable_UserBlockingPriority, kn = u.unstable_NormalPriority, vy = u.unstable_LowPriority, gr = u.unstable_IdlePriority, by = u.log, Sy = u.unstable_setDisableYieldValue, Ga = null, oe = null;
  function il(t) {
    if (typeof by == "function" && Sy(t), oe && typeof oe.setStrictMode == "function")
      try {
        oe.setStrictMode(Ga, t);
      } catch {
      }
  }
  var fe = Math.clz32 ? Math.clz32 : Ay, Ey = Math.log, Ty = Math.LN2;
  function Ay(t) {
    return t >>>= 0, t === 0 ? 32 : 31 - (Ey(t) / Ty | 0) | 0;
  }
  var Fn = 256, Wn = 262144, $n = 4194304;
  function _l(t) {
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
  function In(t, e, l) {
    var a = t.pendingLanes;
    if (a === 0) return 0;
    var n = 0, i = t.suspendedLanes, s = t.pingedLanes;
    t = t.warmLanes;
    var f = a & 134217727;
    return f !== 0 ? (a = f & ~i, a !== 0 ? n = _l(a) : (s &= f, s !== 0 ? n = _l(s) : l || (l = f & ~t, l !== 0 && (n = _l(l))))) : (f = a & ~i, f !== 0 ? n = _l(f) : s !== 0 ? n = _l(s) : l || (l = a & ~t, l !== 0 && (n = _l(l)))), n === 0 ? 0 : e !== 0 && e !== n && (e & i) === 0 && (i = n & -n, l = e & -e, i >= l || i === 32 && (l & 4194048) !== 0) ? e : n;
  }
  function Xa(t, e) {
    return (t.pendingLanes & ~(t.suspendedLanes & ~t.pingedLanes) & e) === 0;
  }
  function Oy(t, e) {
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
  function pr() {
    var t = $n;
    return $n <<= 1, ($n & 62914560) === 0 && ($n = 4194304), t;
  }
  function wi(t) {
    for (var e = [], l = 0; 31 > l; l++) e.push(t);
    return e;
  }
  function Za(t, e) {
    t.pendingLanes |= e, e !== 268435456 && (t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0);
  }
  function zy(t, e, l, a, n, i) {
    var s = t.pendingLanes;
    t.pendingLanes = l, t.suspendedLanes = 0, t.pingedLanes = 0, t.warmLanes = 0, t.expiredLanes &= l, t.entangledLanes &= l, t.errorRecoveryDisabledLanes &= l, t.shellSuspendCounter = 0;
    var f = t.entanglements, h = t.expirationTimes, A = t.hiddenUpdates;
    for (l = s & ~l; 0 < l; ) {
      var C = 31 - fe(l), D = 1 << C;
      f[C] = 0, h[C] = -1;
      var z = A[C];
      if (z !== null)
        for (A[C] = null, C = 0; C < z.length; C++) {
          var x = z[C];
          x !== null && (x.lane &= -536870913);
        }
      l &= ~D;
    }
    a !== 0 && vr(t, a, 0), i !== 0 && n === 0 && t.tag !== 0 && (t.suspendedLanes |= i & ~(s & ~e));
  }
  function vr(t, e, l) {
    t.pendingLanes |= e, t.suspendedLanes &= ~e;
    var a = 31 - fe(e);
    t.entangledLanes |= e, t.entanglements[a] = t.entanglements[a] | 1073741824 | l & 261930;
  }
  function br(t, e) {
    var l = t.entangledLanes |= e;
    for (t = t.entanglements; l; ) {
      var a = 31 - fe(l), n = 1 << a;
      n & e | t[a] & e && (t[a] |= e), l &= ~n;
    }
  }
  function Sr(t, e) {
    var l = e & -e;
    return l = (l & 42) !== 0 ? 1 : Di(l), (l & (t.suspendedLanes | e)) !== 0 ? 0 : l;
  }
  function Di(t) {
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
  function _i(t) {
    return t &= -t, 2 < t ? 8 < t ? (t & 134217727) !== 0 ? 32 : 268435456 : 8 : 2;
  }
  function Er() {
    var t = H.p;
    return t !== 0 ? t : (t = window.event, t === void 0 ? 32 : sh(t.type));
  }
  function Tr(t, e) {
    var l = H.p;
    try {
      return H.p = t, e();
    } finally {
      H.p = l;
    }
  }
  var cl = Math.random().toString(36).slice(2), Vt = "__reactFiber$" + cl, le = "__reactProps$" + cl, $l = "__reactContainer$" + cl, Ni = "__reactEvents$" + cl, xy = "__reactListeners$" + cl, My = "__reactHandles$" + cl, Ar = "__reactResources$" + cl, Va = "__reactMarker$" + cl;
  function Ui(t) {
    delete t[Vt], delete t[le], delete t[Ni], delete t[xy], delete t[My];
  }
  function Il(t) {
    var e = t[Vt];
    if (e) return e;
    for (var l = t.parentNode; l; ) {
      if (e = l[$l] || l[Vt]) {
        if (l = e.alternate, e.child !== null || l !== null && l.child !== null)
          for (t = Kd(t); t !== null; ) {
            if (l = t[Vt]) return l;
            t = Kd(t);
          }
        return e;
      }
      t = l, l = t.parentNode;
    }
    return null;
  }
  function Pl(t) {
    if (t = t[Vt] || t[$l]) {
      var e = t.tag;
      if (e === 5 || e === 6 || e === 13 || e === 31 || e === 26 || e === 27 || e === 3)
        return t;
    }
    return null;
  }
  function Ka(t) {
    var e = t.tag;
    if (e === 5 || e === 26 || e === 27 || e === 6) return t.stateNode;
    throw Error(r(33));
  }
  function ta(t) {
    var e = t[Ar];
    return e || (e = t[Ar] = { hoistableStyles: /* @__PURE__ */ new Map(), hoistableScripts: /* @__PURE__ */ new Map() }), e;
  }
  function Gt(t) {
    t[Va] = !0;
  }
  var Or = /* @__PURE__ */ new Set(), zr = {};
  function Nl(t, e) {
    ea(t, e), ea(t + "Capture", e);
  }
  function ea(t, e) {
    for (zr[t] = e, t = 0; t < e.length; t++)
      Or.add(e[t]);
  }
  var Cy = RegExp(
    "^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"
  ), xr = {}, Mr = {};
  function Ry(t) {
    return Ci.call(Mr, t) ? !0 : Ci.call(xr, t) ? !1 : Cy.test(t) ? Mr[t] = !0 : (xr[t] = !0, !1);
  }
  function Pn(t, e, l) {
    if (Ry(e))
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
  function tu(t, e, l) {
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
  function Ye(t, e, l, a) {
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
  function Ee(t) {
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
  function Cr(t) {
    var e = t.type;
    return (t = t.nodeName) && t.toLowerCase() === "input" && (e === "checkbox" || e === "radio");
  }
  function jy(t, e, l) {
    var a = Object.getOwnPropertyDescriptor(
      t.constructor.prototype,
      e
    );
    if (!t.hasOwnProperty(e) && typeof a < "u" && typeof a.get == "function" && typeof a.set == "function") {
      var n = a.get, i = a.set;
      return Object.defineProperty(t, e, {
        configurable: !0,
        get: function() {
          return n.call(this);
        },
        set: function(s) {
          l = "" + s, i.call(this, s);
        }
      }), Object.defineProperty(t, e, {
        enumerable: a.enumerable
      }), {
        getValue: function() {
          return l;
        },
        setValue: function(s) {
          l = "" + s;
        },
        stopTracking: function() {
          t._valueTracker = null, delete t[e];
        }
      };
    }
  }
  function qi(t) {
    if (!t._valueTracker) {
      var e = Cr(t) ? "checked" : "value";
      t._valueTracker = jy(
        t,
        e,
        "" + t[e]
      );
    }
  }
  function Rr(t) {
    if (!t) return !1;
    var e = t._valueTracker;
    if (!e) return !0;
    var l = e.getValue(), a = "";
    return t && (a = Cr(t) ? t.checked ? "true" : "false" : t.value), t = a, t !== l ? (e.setValue(t), !0) : !1;
  }
  function eu(t) {
    if (t = t || (typeof document < "u" ? document : void 0), typeof t > "u") return null;
    try {
      return t.activeElement || t.body;
    } catch {
      return t.body;
    }
  }
  var wy = /[\n"\\]/g;
  function Te(t) {
    return t.replace(
      wy,
      function(e) {
        return "\\" + e.charCodeAt(0).toString(16) + " ";
      }
    );
  }
  function Hi(t, e, l, a, n, i, s, f) {
    t.name = "", s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? t.type = s : t.removeAttribute("type"), e != null ? s === "number" ? (e === 0 && t.value === "" || t.value != e) && (t.value = "" + Ee(e)) : t.value !== "" + Ee(e) && (t.value = "" + Ee(e)) : s !== "submit" && s !== "reset" || t.removeAttribute("value"), e != null ? Bi(t, s, Ee(e)) : l != null ? Bi(t, s, Ee(l)) : a != null && t.removeAttribute("value"), n == null && i != null && (t.defaultChecked = !!i), n != null && (t.checked = n && typeof n != "function" && typeof n != "symbol"), f != null && typeof f != "function" && typeof f != "symbol" && typeof f != "boolean" ? t.name = "" + Ee(f) : t.removeAttribute("name");
  }
  function jr(t, e, l, a, n, i, s, f) {
    if (i != null && typeof i != "function" && typeof i != "symbol" && typeof i != "boolean" && (t.type = i), e != null || l != null) {
      if (!(i !== "submit" && i !== "reset" || e != null)) {
        qi(t);
        return;
      }
      l = l != null ? "" + Ee(l) : "", e = e != null ? "" + Ee(e) : l, f || e === t.value || (t.value = e), t.defaultValue = e;
    }
    a = a ?? n, a = typeof a != "function" && typeof a != "symbol" && !!a, t.checked = f ? t.checked : !!a, t.defaultChecked = !!a, s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" && (t.name = s), qi(t);
  }
  function Bi(t, e, l) {
    e === "number" && eu(t.ownerDocument) === t || t.defaultValue === "" + l || (t.defaultValue = "" + l);
  }
  function la(t, e, l, a) {
    if (t = t.options, e) {
      e = {};
      for (var n = 0; n < l.length; n++)
        e["$" + l[n]] = !0;
      for (l = 0; l < t.length; l++)
        n = e.hasOwnProperty("$" + t[l].value), t[l].selected !== n && (t[l].selected = n), n && a && (t[l].defaultSelected = !0);
    } else {
      for (l = "" + Ee(l), e = null, n = 0; n < t.length; n++) {
        if (t[n].value === l) {
          t[n].selected = !0, a && (t[n].defaultSelected = !0);
          return;
        }
        e !== null || t[n].disabled || (e = t[n]);
      }
      e !== null && (e.selected = !0);
    }
  }
  function wr(t, e, l) {
    if (e != null && (e = "" + Ee(e), e !== t.value && (t.value = e), l == null)) {
      t.defaultValue !== e && (t.defaultValue = e);
      return;
    }
    t.defaultValue = l != null ? "" + Ee(l) : "";
  }
  function Dr(t, e, l, a) {
    if (e == null) {
      if (a != null) {
        if (l != null) throw Error(r(92));
        if (st(a)) {
          if (1 < a.length) throw Error(r(93));
          a = a[0];
        }
        l = a;
      }
      l == null && (l = ""), e = l;
    }
    l = Ee(e), t.defaultValue = l, a = t.textContent, a === l && a !== "" && a !== null && (t.value = a), qi(t);
  }
  function aa(t, e) {
    if (e) {
      var l = t.firstChild;
      if (l && l === t.lastChild && l.nodeType === 3) {
        l.nodeValue = e;
        return;
      }
    }
    t.textContent = e;
  }
  var Dy = new Set(
    "animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(
      " "
    )
  );
  function _r(t, e, l) {
    var a = e.indexOf("--") === 0;
    l == null || typeof l == "boolean" || l === "" ? a ? t.setProperty(e, "") : e === "float" ? t.cssFloat = "" : t[e] = "" : a ? t.setProperty(e, l) : typeof l != "number" || l === 0 || Dy.has(e) ? e === "float" ? t.cssFloat = l : t[e] = ("" + l).trim() : t[e] = l + "px";
  }
  function Nr(t, e, l) {
    if (e != null && typeof e != "object")
      throw Error(r(62));
    if (t = t.style, l != null) {
      for (var a in l)
        !l.hasOwnProperty(a) || e != null && e.hasOwnProperty(a) || (a.indexOf("--") === 0 ? t.setProperty(a, "") : a === "float" ? t.cssFloat = "" : t[a] = "");
      for (var n in e)
        a = e[n], e.hasOwnProperty(n) && l[n] !== a && _r(t, n, a);
    } else
      for (var i in e)
        e.hasOwnProperty(i) && _r(t, i, e[i]);
  }
  function Li(t) {
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
  var _y = /* @__PURE__ */ new Map([
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
  ]), Ny = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
  function lu(t) {
    return Ny.test("" + t) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : t;
  }
  function Ge() {
  }
  var Qi = null;
  function Yi(t) {
    return t = t.target || t.srcElement || window, t.correspondingUseElement && (t = t.correspondingUseElement), t.nodeType === 3 ? t.parentNode : t;
  }
  var na = null, ua = null;
  function Ur(t) {
    var e = Pl(t);
    if (e && (t = e.stateNode)) {
      var l = t[le] || null;
      t: switch (t = e.stateNode, e.type) {
        case "input":
          if (Hi(
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
              'input[name="' + Te(
                "" + e
              ) + '"][type="radio"]'
            ), e = 0; e < l.length; e++) {
              var a = l[e];
              if (a !== t && a.form === t.form) {
                var n = a[le] || null;
                if (!n) throw Error(r(90));
                Hi(
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
              a = l[e], a.form === t.form && Rr(a);
          }
          break t;
        case "textarea":
          wr(t, l.value, l.defaultValue);
          break t;
        case "select":
          e = l.value, e != null && la(t, !!l.multiple, e, !1);
      }
    }
  }
  var Gi = !1;
  function qr(t, e, l) {
    if (Gi) return t(e, l);
    Gi = !0;
    try {
      var a = t(e);
      return a;
    } finally {
      if (Gi = !1, (na !== null || ua !== null) && (Xu(), na && (e = na, t = ua, ua = na = null, Ur(e), t)))
        for (e = 0; e < t.length; e++) Ur(t[e]);
    }
  }
  function Ja(t, e) {
    var l = t.stateNode;
    if (l === null) return null;
    var a = l[le] || null;
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
        r(231, e, typeof l)
      );
    return l;
  }
  var Xe = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), Xi = !1;
  if (Xe)
    try {
      var ka = {};
      Object.defineProperty(ka, "passive", {
        get: function() {
          Xi = !0;
        }
      }), window.addEventListener("test", ka, ka), window.removeEventListener("test", ka, ka);
    } catch {
      Xi = !1;
    }
  var sl = null, Zi = null, au = null;
  function Hr() {
    if (au) return au;
    var t, e = Zi, l = e.length, a, n = "value" in sl ? sl.value : sl.textContent, i = n.length;
    for (t = 0; t < l && e[t] === n[t]; t++) ;
    var s = l - t;
    for (a = 1; a <= s && e[l - a] === n[i - a]; a++) ;
    return au = n.slice(t, 1 < a ? 1 - a : void 0);
  }
  function nu(t) {
    var e = t.keyCode;
    return "charCode" in t ? (t = t.charCode, t === 0 && e === 13 && (t = 13)) : t = e, t === 10 && (t = 13), 32 <= t || t === 13 ? t : 0;
  }
  function uu() {
    return !0;
  }
  function Br() {
    return !1;
  }
  function ae(t) {
    function e(l, a, n, i, s) {
      this._reactName = l, this._targetInst = n, this.type = a, this.nativeEvent = i, this.target = s, this.currentTarget = null;
      for (var f in t)
        t.hasOwnProperty(f) && (l = t[f], this[f] = l ? l(i) : i[f]);
      return this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? uu : Br, this.isPropagationStopped = Br, this;
    }
    return _(e.prototype, {
      preventDefault: function() {
        this.defaultPrevented = !0;
        var l = this.nativeEvent;
        l && (l.preventDefault ? l.preventDefault() : typeof l.returnValue != "unknown" && (l.returnValue = !1), this.isDefaultPrevented = uu);
      },
      stopPropagation: function() {
        var l = this.nativeEvent;
        l && (l.stopPropagation ? l.stopPropagation() : typeof l.cancelBubble != "unknown" && (l.cancelBubble = !0), this.isPropagationStopped = uu);
      },
      persist: function() {
      },
      isPersistent: uu
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
  }, iu = ae(Ul), Fa = _({}, Ul, { view: 0, detail: 0 }), Uy = ae(Fa), Vi, Ki, Wa, cu = _({}, Fa, {
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
    getModifierState: ki,
    button: 0,
    buttons: 0,
    relatedTarget: function(t) {
      return t.relatedTarget === void 0 ? t.fromElement === t.srcElement ? t.toElement : t.fromElement : t.relatedTarget;
    },
    movementX: function(t) {
      return "movementX" in t ? t.movementX : (t !== Wa && (Wa && t.type === "mousemove" ? (Vi = t.screenX - Wa.screenX, Ki = t.screenY - Wa.screenY) : Ki = Vi = 0, Wa = t), Vi);
    },
    movementY: function(t) {
      return "movementY" in t ? t.movementY : Ki;
    }
  }), Lr = ae(cu), qy = _({}, cu, { dataTransfer: 0 }), Hy = ae(qy), By = _({}, Fa, { relatedTarget: 0 }), Ji = ae(By), Ly = _({}, Ul, {
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), Qy = ae(Ly), Yy = _({}, Ul, {
    clipboardData: function(t) {
      return "clipboardData" in t ? t.clipboardData : window.clipboardData;
    }
  }), Gy = ae(Yy), Xy = _({}, Ul, { data: 0 }), Qr = ae(Xy), Zy = {
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
  }, Vy = {
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
  }, Ky = {
    Alt: "altKey",
    Control: "ctrlKey",
    Meta: "metaKey",
    Shift: "shiftKey"
  };
  function Jy(t) {
    var e = this.nativeEvent;
    return e.getModifierState ? e.getModifierState(t) : (t = Ky[t]) ? !!e[t] : !1;
  }
  function ki() {
    return Jy;
  }
  var ky = _({}, Fa, {
    key: function(t) {
      if (t.key) {
        var e = Zy[t.key] || t.key;
        if (e !== "Unidentified") return e;
      }
      return t.type === "keypress" ? (t = nu(t), t === 13 ? "Enter" : String.fromCharCode(t)) : t.type === "keydown" || t.type === "keyup" ? Vy[t.keyCode] || "Unidentified" : "";
    },
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: ki,
    charCode: function(t) {
      return t.type === "keypress" ? nu(t) : 0;
    },
    keyCode: function(t) {
      return t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    },
    which: function(t) {
      return t.type === "keypress" ? nu(t) : t.type === "keydown" || t.type === "keyup" ? t.keyCode : 0;
    }
  }), Fy = ae(ky), Wy = _({}, cu, {
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
  }), Yr = ae(Wy), $y = _({}, Fa, {
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: ki
  }), Iy = ae($y), Py = _({}, Ul, {
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0
  }), tm = ae(Py), em = _({}, cu, {
    deltaX: function(t) {
      return "deltaX" in t ? t.deltaX : "wheelDeltaX" in t ? -t.wheelDeltaX : 0;
    },
    deltaY: function(t) {
      return "deltaY" in t ? t.deltaY : "wheelDeltaY" in t ? -t.wheelDeltaY : "wheelDelta" in t ? -t.wheelDelta : 0;
    },
    deltaZ: 0,
    deltaMode: 0
  }), lm = ae(em), am = _({}, Ul, {
    newState: 0,
    oldState: 0
  }), nm = ae(am), um = [9, 13, 27, 32], Fi = Xe && "CompositionEvent" in window, $a = null;
  Xe && "documentMode" in document && ($a = document.documentMode);
  var im = Xe && "TextEvent" in window && !$a, Gr = Xe && (!Fi || $a && 8 < $a && 11 >= $a), Xr = " ", Zr = !1;
  function Vr(t, e) {
    switch (t) {
      case "keyup":
        return um.indexOf(e.keyCode) !== -1;
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
  function Kr(t) {
    return t = t.detail, typeof t == "object" && "data" in t ? t.data : null;
  }
  var ia = !1;
  function cm(t, e) {
    switch (t) {
      case "compositionend":
        return Kr(e);
      case "keypress":
        return e.which !== 32 ? null : (Zr = !0, Xr);
      case "textInput":
        return t = e.data, t === Xr && Zr ? null : t;
      default:
        return null;
    }
  }
  function sm(t, e) {
    if (ia)
      return t === "compositionend" || !Fi && Vr(t, e) ? (t = Hr(), au = Zi = sl = null, ia = !1, t) : null;
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
        return Gr && e.locale !== "ko" ? null : e.data;
      default:
        return null;
    }
  }
  var rm = {
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
  function Jr(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e === "input" ? !!rm[t.type] : e === "textarea";
  }
  function kr(t, e, l, a) {
    na ? ua ? ua.push(a) : ua = [a] : na = a, e = Wu(e, "onChange"), 0 < e.length && (l = new iu(
      "onChange",
      "change",
      null,
      l,
      a
    ), t.push({ event: l, listeners: e }));
  }
  var Ia = null, Pa = null;
  function om(t) {
    Dd(t, 0);
  }
  function su(t) {
    var e = Ka(t);
    if (Rr(e)) return t;
  }
  function Fr(t, e) {
    if (t === "change") return e;
  }
  var Wr = !1;
  if (Xe) {
    var Wi;
    if (Xe) {
      var $i = "oninput" in document;
      if (!$i) {
        var $r = document.createElement("div");
        $r.setAttribute("oninput", "return;"), $i = typeof $r.oninput == "function";
      }
      Wi = $i;
    } else Wi = !1;
    Wr = Wi && (!document.documentMode || 9 < document.documentMode);
  }
  function Ir() {
    Ia && (Ia.detachEvent("onpropertychange", Pr), Pa = Ia = null);
  }
  function Pr(t) {
    if (t.propertyName === "value" && su(Pa)) {
      var e = [];
      kr(
        e,
        Pa,
        t,
        Yi(t)
      ), qr(om, e);
    }
  }
  function fm(t, e, l) {
    t === "focusin" ? (Ir(), Ia = e, Pa = l, Ia.attachEvent("onpropertychange", Pr)) : t === "focusout" && Ir();
  }
  function dm(t) {
    if (t === "selectionchange" || t === "keyup" || t === "keydown")
      return su(Pa);
  }
  function hm(t, e) {
    if (t === "click") return su(e);
  }
  function ym(t, e) {
    if (t === "input" || t === "change")
      return su(e);
  }
  function mm(t, e) {
    return t === e && (t !== 0 || 1 / t === 1 / e) || t !== t && e !== e;
  }
  var de = typeof Object.is == "function" ? Object.is : mm;
  function tn(t, e) {
    if (de(t, e)) return !0;
    if (typeof t != "object" || t === null || typeof e != "object" || e === null)
      return !1;
    var l = Object.keys(t), a = Object.keys(e);
    if (l.length !== a.length) return !1;
    for (a = 0; a < l.length; a++) {
      var n = l[a];
      if (!Ci.call(e, n) || !de(t[n], e[n]))
        return !1;
    }
    return !0;
  }
  function to(t) {
    for (; t && t.firstChild; ) t = t.firstChild;
    return t;
  }
  function eo(t, e) {
    var l = to(t);
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
      l = to(l);
    }
  }
  function lo(t, e) {
    return t && e ? t === e ? !0 : t && t.nodeType === 3 ? !1 : e && e.nodeType === 3 ? lo(t, e.parentNode) : "contains" in t ? t.contains(e) : t.compareDocumentPosition ? !!(t.compareDocumentPosition(e) & 16) : !1 : !1;
  }
  function ao(t) {
    t = t != null && t.ownerDocument != null && t.ownerDocument.defaultView != null ? t.ownerDocument.defaultView : window;
    for (var e = eu(t.document); e instanceof t.HTMLIFrameElement; ) {
      try {
        var l = typeof e.contentWindow.location.href == "string";
      } catch {
        l = !1;
      }
      if (l) t = e.contentWindow;
      else break;
      e = eu(t.document);
    }
    return e;
  }
  function Ii(t) {
    var e = t && t.nodeName && t.nodeName.toLowerCase();
    return e && (e === "input" && (t.type === "text" || t.type === "search" || t.type === "tel" || t.type === "url" || t.type === "password") || e === "textarea" || t.contentEditable === "true");
  }
  var gm = Xe && "documentMode" in document && 11 >= document.documentMode, ca = null, Pi = null, en = null, tc = !1;
  function no(t, e, l) {
    var a = l.window === l ? l.document : l.nodeType === 9 ? l : l.ownerDocument;
    tc || ca == null || ca !== eu(a) || (a = ca, "selectionStart" in a && Ii(a) ? a = { start: a.selectionStart, end: a.selectionEnd } : (a = (a.ownerDocument && a.ownerDocument.defaultView || window).getSelection(), a = {
      anchorNode: a.anchorNode,
      anchorOffset: a.anchorOffset,
      focusNode: a.focusNode,
      focusOffset: a.focusOffset
    }), en && tn(en, a) || (en = a, a = Wu(Pi, "onSelect"), 0 < a.length && (e = new iu(
      "onSelect",
      "select",
      null,
      e,
      l
    ), t.push({ event: e, listeners: a }), e.target = ca)));
  }
  function ql(t, e) {
    var l = {};
    return l[t.toLowerCase()] = e.toLowerCase(), l["Webkit" + t] = "webkit" + e, l["Moz" + t] = "moz" + e, l;
  }
  var sa = {
    animationend: ql("Animation", "AnimationEnd"),
    animationiteration: ql("Animation", "AnimationIteration"),
    animationstart: ql("Animation", "AnimationStart"),
    transitionrun: ql("Transition", "TransitionRun"),
    transitionstart: ql("Transition", "TransitionStart"),
    transitioncancel: ql("Transition", "TransitionCancel"),
    transitionend: ql("Transition", "TransitionEnd")
  }, ec = {}, uo = {};
  Xe && (uo = document.createElement("div").style, "AnimationEvent" in window || (delete sa.animationend.animation, delete sa.animationiteration.animation, delete sa.animationstart.animation), "TransitionEvent" in window || delete sa.transitionend.transition);
  function Hl(t) {
    if (ec[t]) return ec[t];
    if (!sa[t]) return t;
    var e = sa[t], l;
    for (l in e)
      if (e.hasOwnProperty(l) && l in uo)
        return ec[t] = e[l];
    return t;
  }
  var io = Hl("animationend"), co = Hl("animationiteration"), so = Hl("animationstart"), pm = Hl("transitionrun"), vm = Hl("transitionstart"), bm = Hl("transitioncancel"), ro = Hl("transitionend"), oo = /* @__PURE__ */ new Map(), lc = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(
    " "
  );
  lc.push("scrollEnd");
  function De(t, e) {
    oo.set(t, e), Nl(e, [t]);
  }
  var ru = typeof reportError == "function" ? reportError : function(t) {
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
  }, Ae = [], ra = 0, ac = 0;
  function ou() {
    for (var t = ra, e = ac = ra = 0; e < t; ) {
      var l = Ae[e];
      Ae[e++] = null;
      var a = Ae[e];
      Ae[e++] = null;
      var n = Ae[e];
      Ae[e++] = null;
      var i = Ae[e];
      if (Ae[e++] = null, a !== null && n !== null) {
        var s = a.pending;
        s === null ? n.next = n : (n.next = s.next, s.next = n), a.pending = n;
      }
      i !== 0 && fo(l, n, i);
    }
  }
  function fu(t, e, l, a) {
    Ae[ra++] = t, Ae[ra++] = e, Ae[ra++] = l, Ae[ra++] = a, ac |= a, t.lanes |= a, t = t.alternate, t !== null && (t.lanes |= a);
  }
  function nc(t, e, l, a) {
    return fu(t, e, l, a), du(t);
  }
  function Bl(t, e) {
    return fu(t, null, null, e), du(t);
  }
  function fo(t, e, l) {
    t.lanes |= l;
    var a = t.alternate;
    a !== null && (a.lanes |= l);
    for (var n = !1, i = t.return; i !== null; )
      i.childLanes |= l, a = i.alternate, a !== null && (a.childLanes |= l), i.tag === 22 && (t = i.stateNode, t === null || t._visibility & 1 || (n = !0)), t = i, i = i.return;
    return t.tag === 3 ? (i = t.stateNode, n && e !== null && (n = 31 - fe(l), t = i.hiddenUpdates, a = t[n], a === null ? t[n] = [e] : a.push(e), e.lane = l | 536870912), i) : null;
  }
  function du(t) {
    if (50 < On)
      throw On = 0, hs = null, Error(r(185));
    for (var e = t.return; e !== null; )
      t = e, e = t.return;
    return t.tag === 3 ? t.stateNode : null;
  }
  var oa = {};
  function Sm(t, e, l, a) {
    this.tag = t, this.key = l, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = e, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = a, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
  }
  function he(t, e, l, a) {
    return new Sm(t, e, l, a);
  }
  function uc(t) {
    return t = t.prototype, !(!t || !t.isReactComponent);
  }
  function Ze(t, e) {
    var l = t.alternate;
    return l === null ? (l = he(
      t.tag,
      e,
      t.key,
      t.mode
    ), l.elementType = t.elementType, l.type = t.type, l.stateNode = t.stateNode, l.alternate = t, t.alternate = l) : (l.pendingProps = e, l.type = t.type, l.flags = 0, l.subtreeFlags = 0, l.deletions = null), l.flags = t.flags & 65011712, l.childLanes = t.childLanes, l.lanes = t.lanes, l.child = t.child, l.memoizedProps = t.memoizedProps, l.memoizedState = t.memoizedState, l.updateQueue = t.updateQueue, e = t.dependencies, l.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }, l.sibling = t.sibling, l.index = t.index, l.ref = t.ref, l.refCleanup = t.refCleanup, l;
  }
  function ho(t, e) {
    t.flags &= 65011714;
    var l = t.alternate;
    return l === null ? (t.childLanes = 0, t.lanes = e, t.child = null, t.subtreeFlags = 0, t.memoizedProps = null, t.memoizedState = null, t.updateQueue = null, t.dependencies = null, t.stateNode = null) : (t.childLanes = l.childLanes, t.lanes = l.lanes, t.child = l.child, t.subtreeFlags = 0, t.deletions = null, t.memoizedProps = l.memoizedProps, t.memoizedState = l.memoizedState, t.updateQueue = l.updateQueue, t.type = l.type, e = l.dependencies, t.dependencies = e === null ? null : {
      lanes: e.lanes,
      firstContext: e.firstContext
    }), t;
  }
  function hu(t, e, l, a, n, i) {
    var s = 0;
    if (a = t, typeof t == "function") uc(t) && (s = 1);
    else if (typeof t == "string")
      s = zg(
        t,
        l,
        G.current
      ) ? 26 : t === "html" || t === "head" || t === "body" ? 27 : 5;
    else
      t: switch (t) {
        case at:
          return t = he(31, l, e, n), t.elementType = at, t.lanes = i, t;
        case N:
          return Ll(l.children, n, i, e);
        case Q:
          s = 8, n |= 24;
          break;
        case J:
          return t = he(12, l, e, n | 2), t.elementType = J, t.lanes = i, t;
        case nt:
          return t = he(13, l, e, n), t.elementType = nt, t.lanes = i, t;
        case q:
          return t = he(19, l, e, n), t.elementType = q, t.lanes = i, t;
        default:
          if (typeof t == "object" && t !== null)
            switch (t.$$typeof) {
              case dt:
                s = 10;
                break t;
              case $:
                s = 9;
                break t;
              case ht:
                s = 11;
                break t;
              case Y:
                s = 14;
                break t;
              case yt:
                s = 16, a = null;
                break t;
            }
          s = 29, l = Error(
            r(130, t === null ? "null" : typeof t, "")
          ), a = null;
      }
    return e = he(s, l, e, n), e.elementType = t, e.type = a, e.lanes = i, e;
  }
  function Ll(t, e, l, a) {
    return t = he(7, t, a, e), t.lanes = l, t;
  }
  function ic(t, e, l) {
    return t = he(6, t, null, e), t.lanes = l, t;
  }
  function yo(t) {
    var e = he(18, null, null, 0);
    return e.stateNode = t, e;
  }
  function cc(t, e, l) {
    return e = he(
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
  var mo = /* @__PURE__ */ new WeakMap();
  function Oe(t, e) {
    if (typeof t == "object" && t !== null) {
      var l = mo.get(t);
      return l !== void 0 ? l : (e = {
        value: t,
        source: e,
        stack: hr(e)
      }, mo.set(t, e), e);
    }
    return {
      value: t,
      source: e,
      stack: hr(e)
    };
  }
  var fa = [], da = 0, yu = null, ln = 0, ze = [], xe = 0, rl = null, qe = 1, He = "";
  function Ve(t, e) {
    fa[da++] = ln, fa[da++] = yu, yu = t, ln = e;
  }
  function go(t, e, l) {
    ze[xe++] = qe, ze[xe++] = He, ze[xe++] = rl, rl = t;
    var a = qe;
    t = He;
    var n = 32 - fe(a) - 1;
    a &= ~(1 << n), l += 1;
    var i = 32 - fe(e) + n;
    if (30 < i) {
      var s = n - n % 5;
      i = (a & (1 << s) - 1).toString(32), a >>= s, n -= s, qe = 1 << 32 - fe(e) + n | l << n | a, He = i + t;
    } else
      qe = 1 << i | l << n | a, He = t;
  }
  function sc(t) {
    t.return !== null && (Ve(t, 1), go(t, 1, 0));
  }
  function rc(t) {
    for (; t === yu; )
      yu = fa[--da], fa[da] = null, ln = fa[--da], fa[da] = null;
    for (; t === rl; )
      rl = ze[--xe], ze[xe] = null, He = ze[--xe], ze[xe] = null, qe = ze[--xe], ze[xe] = null;
  }
  function po(t, e) {
    ze[xe++] = qe, ze[xe++] = He, ze[xe++] = rl, qe = e.id, He = e.overflow, rl = t;
  }
  var Kt = null, Mt = null, ft = !1, ol = null, Me = !1, oc = Error(r(519));
  function fl(t) {
    var e = Error(
      r(
        418,
        1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML",
        ""
      )
    );
    throw an(Oe(e, t)), oc;
  }
  function vo(t) {
    var e = t.stateNode, l = t.type, a = t.memoizedProps;
    switch (e[Vt] = t, e[le] = a, l) {
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
        for (l = 0; l < xn.length; l++)
          ct(xn[l], e);
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
        ct("invalid", e), jr(
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
        ct("invalid", e);
        break;
      case "textarea":
        ct("invalid", e), Dr(e, a.value, a.defaultValue, a.children);
    }
    l = a.children, typeof l != "string" && typeof l != "number" && typeof l != "bigint" || e.textContent === "" + l || a.suppressHydrationWarning === !0 || qd(e.textContent, l) ? (a.popover != null && (ct("beforetoggle", e), ct("toggle", e)), a.onScroll != null && ct("scroll", e), a.onScrollEnd != null && ct("scrollend", e), a.onClick != null && (e.onclick = Ge), e = !0) : e = !1, e || fl(t, !0);
  }
  function bo(t) {
    for (Kt = t.return; Kt; )
      switch (Kt.tag) {
        case 5:
        case 31:
        case 13:
          Me = !1;
          return;
        case 27:
        case 3:
          Me = !0;
          return;
        default:
          Kt = Kt.return;
      }
  }
  function ha(t) {
    if (t !== Kt) return !1;
    if (!ft) return bo(t), ft = !0, !1;
    var e = t.tag, l;
    if ((l = e !== 3 && e !== 27) && ((l = e === 5) && (l = t.type, l = !(l !== "form" && l !== "button") || Cs(t.type, t.memoizedProps)), l = !l), l && Mt && fl(t), bo(t), e === 13) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(r(317));
      Mt = Vd(t);
    } else if (e === 31) {
      if (t = t.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(r(317));
      Mt = Vd(t);
    } else
      e === 27 ? (e = Mt, zl(t.type) ? (t = _s, _s = null, Mt = t) : Mt = e) : Mt = Kt ? Re(t.stateNode.nextSibling) : null;
    return !0;
  }
  function Ql() {
    Mt = Kt = null, ft = !1;
  }
  function fc() {
    var t = ol;
    return t !== null && (ce === null ? ce = t : ce.push.apply(
      ce,
      t
    ), ol = null), t;
  }
  function an(t) {
    ol === null ? ol = [t] : ol.push(t);
  }
  var dc = m(null), Yl = null, Ke = null;
  function dl(t, e, l) {
    B(dc, e._currentValue), e._currentValue = l;
  }
  function Je(t) {
    t._currentValue = dc.current, R(dc);
  }
  function hc(t, e, l) {
    for (; t !== null; ) {
      var a = t.alternate;
      if ((t.childLanes & e) !== e ? (t.childLanes |= e, a !== null && (a.childLanes |= e)) : a !== null && (a.childLanes & e) !== e && (a.childLanes |= e), t === l) break;
      t = t.return;
    }
  }
  function yc(t, e, l, a) {
    var n = t.child;
    for (n !== null && (n.return = t); n !== null; ) {
      var i = n.dependencies;
      if (i !== null) {
        var s = n.child;
        i = i.firstContext;
        t: for (; i !== null; ) {
          var f = i;
          i = n;
          for (var h = 0; h < e.length; h++)
            if (f.context === e[h]) {
              i.lanes |= l, f = i.alternate, f !== null && (f.lanes |= l), hc(
                i.return,
                l,
                t
              ), a || (s = null);
              break t;
            }
          i = f.next;
        }
      } else if (n.tag === 18) {
        if (s = n.return, s === null) throw Error(r(341));
        s.lanes |= l, i = s.alternate, i !== null && (i.lanes |= l), hc(s, l, t), s = null;
      } else s = n.child;
      if (s !== null) s.return = n;
      else
        for (s = n; s !== null; ) {
          if (s === t) {
            s = null;
            break;
          }
          if (n = s.sibling, n !== null) {
            n.return = s.return, s = n;
            break;
          }
          s = s.return;
        }
      n = s;
    }
  }
  function ya(t, e, l, a) {
    t = null;
    for (var n = e, i = !1; n !== null; ) {
      if (!i) {
        if ((n.flags & 524288) !== 0) i = !0;
        else if ((n.flags & 262144) !== 0) break;
      }
      if (n.tag === 10) {
        var s = n.alternate;
        if (s === null) throw Error(r(387));
        if (s = s.memoizedProps, s !== null) {
          var f = n.type;
          de(n.pendingProps.value, s.value) || (t !== null ? t.push(f) : t = [f]);
        }
      } else if (n === bt.current) {
        if (s = n.alternate, s === null) throw Error(r(387));
        s.memoizedState.memoizedState !== n.memoizedState.memoizedState && (t !== null ? t.push(wn) : t = [wn]);
      }
      n = n.return;
    }
    t !== null && yc(
      e,
      t,
      l,
      a
    ), e.flags |= 262144;
  }
  function mu(t) {
    for (t = t.firstContext; t !== null; ) {
      if (!de(
        t.context._currentValue,
        t.memoizedValue
      ))
        return !0;
      t = t.next;
    }
    return !1;
  }
  function Gl(t) {
    Yl = t, Ke = null, t = t.dependencies, t !== null && (t.firstContext = null);
  }
  function Jt(t) {
    return So(Yl, t);
  }
  function gu(t, e) {
    return Yl === null && Gl(t), So(t, e);
  }
  function So(t, e) {
    var l = e._currentValue;
    if (e = { context: e, memoizedValue: l, next: null }, Ke === null) {
      if (t === null) throw Error(r(308));
      Ke = e, t.dependencies = { lanes: 0, firstContext: e }, t.flags |= 524288;
    } else Ke = Ke.next = e;
    return l;
  }
  var Em = typeof AbortController < "u" ? AbortController : function() {
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
  }, Tm = u.unstable_scheduleCallback, Am = u.unstable_NormalPriority, Ut = {
    $$typeof: dt,
    Consumer: null,
    Provider: null,
    _currentValue: null,
    _currentValue2: null,
    _threadCount: 0
  };
  function mc() {
    return {
      controller: new Em(),
      data: /* @__PURE__ */ new Map(),
      refCount: 0
    };
  }
  function nn(t) {
    t.refCount--, t.refCount === 0 && Tm(Am, function() {
      t.controller.abort();
    });
  }
  var un = null, gc = 0, ma = 0, ga = null;
  function Om(t, e) {
    if (un === null) {
      var l = un = [];
      gc = 0, ma = bs(), ga = {
        status: "pending",
        value: void 0,
        then: function(a) {
          l.push(a);
        }
      };
    }
    return gc++, e.then(Eo, Eo), e;
  }
  function Eo() {
    if (--gc === 0 && un !== null) {
      ga !== null && (ga.status = "fulfilled");
      var t = un;
      un = null, ma = 0, ga = null;
      for (var e = 0; e < t.length; e++) (0, t[e])();
    }
  }
  function zm(t, e) {
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
  var To = M.S;
  M.S = function(t, e) {
    id = re(), typeof e == "object" && e !== null && typeof e.then == "function" && Om(t, e), To !== null && To(t, e);
  };
  var Xl = m(null);
  function pc() {
    var t = Xl.current;
    return t !== null ? t : xt.pooledCache;
  }
  function pu(t, e) {
    e === null ? B(Xl, Xl.current) : B(Xl, e.pool);
  }
  function Ao() {
    var t = pc();
    return t === null ? null : { parent: Ut._currentValue, pool: t };
  }
  var pa = Error(r(460)), vc = Error(r(474)), vu = Error(r(542)), bu = { then: function() {
  } };
  function Oo(t) {
    return t = t.status, t === "fulfilled" || t === "rejected";
  }
  function zo(t, e, l) {
    switch (l = t[l], l === void 0 ? t.push(e) : l !== e && (e.then(Ge, Ge), e = l), e.status) {
      case "fulfilled":
        return e.value;
      case "rejected":
        throw t = e.reason, Mo(t), t;
      default:
        if (typeof e.status == "string") e.then(Ge, Ge);
        else {
          if (t = xt, t !== null && 100 < t.shellSuspendCounter)
            throw Error(r(482));
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
            throw t = e.reason, Mo(t), t;
        }
        throw Vl = e, pa;
    }
  }
  function Zl(t) {
    try {
      var e = t._init;
      return e(t._payload);
    } catch (l) {
      throw l !== null && typeof l == "object" && typeof l.then == "function" ? (Vl = l, pa) : l;
    }
  }
  var Vl = null;
  function xo() {
    if (Vl === null) throw Error(r(459));
    var t = Vl;
    return Vl = null, t;
  }
  function Mo(t) {
    if (t === pa || t === vu)
      throw Error(r(483));
  }
  var va = null, cn = 0;
  function Su(t) {
    var e = cn;
    return cn += 1, va === null && (va = []), zo(va, t, e);
  }
  function sn(t, e) {
    e = e.props.ref, t.ref = e !== void 0 ? e : null;
  }
  function Eu(t, e) {
    throw e.$$typeof === U ? Error(r(525)) : (t = Object.prototype.toString.call(e), Error(
      r(
        31,
        t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t
      )
    ));
  }
  function Co(t) {
    function e(v, g) {
      if (t) {
        var T = v.deletions;
        T === null ? (v.deletions = [g], v.flags |= 16) : T.push(g);
      }
    }
    function l(v, g) {
      if (!t) return null;
      for (; g !== null; )
        e(v, g), g = g.sibling;
      return null;
    }
    function a(v) {
      for (var g = /* @__PURE__ */ new Map(); v !== null; )
        v.key !== null ? g.set(v.key, v) : g.set(v.index, v), v = v.sibling;
      return g;
    }
    function n(v, g) {
      return v = Ze(v, g), v.index = 0, v.sibling = null, v;
    }
    function i(v, g, T) {
      return v.index = T, t ? (T = v.alternate, T !== null ? (T = T.index, T < g ? (v.flags |= 67108866, g) : T) : (v.flags |= 67108866, g)) : (v.flags |= 1048576, g);
    }
    function s(v) {
      return t && v.alternate === null && (v.flags |= 67108866), v;
    }
    function f(v, g, T, j) {
      return g === null || g.tag !== 6 ? (g = ic(T, v.mode, j), g.return = v, g) : (g = n(g, T), g.return = v, g);
    }
    function h(v, g, T, j) {
      var k = T.type;
      return k === N ? C(
        v,
        g,
        T.props.children,
        j,
        T.key
      ) : g !== null && (g.elementType === k || typeof k == "object" && k !== null && k.$$typeof === yt && Zl(k) === g.type) ? (g = n(g, T.props), sn(g, T), g.return = v, g) : (g = hu(
        T.type,
        T.key,
        T.props,
        null,
        v.mode,
        j
      ), sn(g, T), g.return = v, g);
    }
    function A(v, g, T, j) {
      return g === null || g.tag !== 4 || g.stateNode.containerInfo !== T.containerInfo || g.stateNode.implementation !== T.implementation ? (g = cc(T, v.mode, j), g.return = v, g) : (g = n(g, T.children || []), g.return = v, g);
    }
    function C(v, g, T, j, k) {
      return g === null || g.tag !== 7 ? (g = Ll(
        T,
        v.mode,
        j,
        k
      ), g.return = v, g) : (g = n(g, T), g.return = v, g);
    }
    function D(v, g, T) {
      if (typeof g == "string" && g !== "" || typeof g == "number" || typeof g == "bigint")
        return g = ic(
          "" + g,
          v.mode,
          T
        ), g.return = v, g;
      if (typeof g == "object" && g !== null) {
        switch (g.$$typeof) {
          case L:
            return T = hu(
              g.type,
              g.key,
              g.props,
              null,
              v.mode,
              T
            ), sn(T, g), T.return = v, T;
          case V:
            return g = cc(
              g,
              v.mode,
              T
            ), g.return = v, g;
          case yt:
            return g = Zl(g), D(v, g, T);
        }
        if (st(g) || Qt(g))
          return g = Ll(
            g,
            v.mode,
            T,
            null
          ), g.return = v, g;
        if (typeof g.then == "function")
          return D(v, Su(g), T);
        if (g.$$typeof === dt)
          return D(
            v,
            gu(v, g),
            T
          );
        Eu(v, g);
      }
      return null;
    }
    function z(v, g, T, j) {
      var k = g !== null ? g.key : null;
      if (typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint")
        return k !== null ? null : f(v, g, "" + T, j);
      if (typeof T == "object" && T !== null) {
        switch (T.$$typeof) {
          case L:
            return T.key === k ? h(v, g, T, j) : null;
          case V:
            return T.key === k ? A(v, g, T, j) : null;
          case yt:
            return T = Zl(T), z(v, g, T, j);
        }
        if (st(T) || Qt(T))
          return k !== null ? null : C(v, g, T, j, null);
        if (typeof T.then == "function")
          return z(
            v,
            g,
            Su(T),
            j
          );
        if (T.$$typeof === dt)
          return z(
            v,
            g,
            gu(v, T),
            j
          );
        Eu(v, T);
      }
      return null;
    }
    function x(v, g, T, j, k) {
      if (typeof j == "string" && j !== "" || typeof j == "number" || typeof j == "bigint")
        return v = v.get(T) || null, f(g, v, "" + j, k);
      if (typeof j == "object" && j !== null) {
        switch (j.$$typeof) {
          case L:
            return v = v.get(
              j.key === null ? T : j.key
            ) || null, h(g, v, j, k);
          case V:
            return v = v.get(
              j.key === null ? T : j.key
            ) || null, A(g, v, j, k);
          case yt:
            return j = Zl(j), x(
              v,
              g,
              T,
              j,
              k
            );
        }
        if (st(j) || Qt(j))
          return v = v.get(T) || null, C(g, v, j, k, null);
        if (typeof j.then == "function")
          return x(
            v,
            g,
            T,
            Su(j),
            k
          );
        if (j.$$typeof === dt)
          return x(
            v,
            g,
            T,
            gu(g, j),
            k
          );
        Eu(g, j);
      }
      return null;
    }
    function X(v, g, T, j) {
      for (var k = null, mt = null, K = g, lt = g = 0, ot = null; K !== null && lt < T.length; lt++) {
        K.index > lt ? (ot = K, K = null) : ot = K.sibling;
        var gt = z(
          v,
          K,
          T[lt],
          j
        );
        if (gt === null) {
          K === null && (K = ot);
          break;
        }
        t && K && gt.alternate === null && e(v, K), g = i(gt, g, lt), mt === null ? k = gt : mt.sibling = gt, mt = gt, K = ot;
      }
      if (lt === T.length)
        return l(v, K), ft && Ve(v, lt), k;
      if (K === null) {
        for (; lt < T.length; lt++)
          K = D(v, T[lt], j), K !== null && (g = i(
            K,
            g,
            lt
          ), mt === null ? k = K : mt.sibling = K, mt = K);
        return ft && Ve(v, lt), k;
      }
      for (K = a(K); lt < T.length; lt++)
        ot = x(
          K,
          v,
          lt,
          T[lt],
          j
        ), ot !== null && (t && ot.alternate !== null && K.delete(
          ot.key === null ? lt : ot.key
        ), g = i(
          ot,
          g,
          lt
        ), mt === null ? k = ot : mt.sibling = ot, mt = ot);
      return t && K.forEach(function(jl) {
        return e(v, jl);
      }), ft && Ve(v, lt), k;
    }
    function W(v, g, T, j) {
      if (T == null) throw Error(r(151));
      for (var k = null, mt = null, K = g, lt = g = 0, ot = null, gt = T.next(); K !== null && !gt.done; lt++, gt = T.next()) {
        K.index > lt ? (ot = K, K = null) : ot = K.sibling;
        var jl = z(v, K, gt.value, j);
        if (jl === null) {
          K === null && (K = ot);
          break;
        }
        t && K && jl.alternate === null && e(v, K), g = i(jl, g, lt), mt === null ? k = jl : mt.sibling = jl, mt = jl, K = ot;
      }
      if (gt.done)
        return l(v, K), ft && Ve(v, lt), k;
      if (K === null) {
        for (; !gt.done; lt++, gt = T.next())
          gt = D(v, gt.value, j), gt !== null && (g = i(gt, g, lt), mt === null ? k = gt : mt.sibling = gt, mt = gt);
        return ft && Ve(v, lt), k;
      }
      for (K = a(K); !gt.done; lt++, gt = T.next())
        gt = x(K, v, lt, gt.value, j), gt !== null && (t && gt.alternate !== null && K.delete(gt.key === null ? lt : gt.key), g = i(gt, g, lt), mt === null ? k = gt : mt.sibling = gt, mt = gt);
      return t && K.forEach(function(qg) {
        return e(v, qg);
      }), ft && Ve(v, lt), k;
    }
    function zt(v, g, T, j) {
      if (typeof T == "object" && T !== null && T.type === N && T.key === null && (T = T.props.children), typeof T == "object" && T !== null) {
        switch (T.$$typeof) {
          case L:
            t: {
              for (var k = T.key; g !== null; ) {
                if (g.key === k) {
                  if (k = T.type, k === N) {
                    if (g.tag === 7) {
                      l(
                        v,
                        g.sibling
                      ), j = n(
                        g,
                        T.props.children
                      ), j.return = v, v = j;
                      break t;
                    }
                  } else if (g.elementType === k || typeof k == "object" && k !== null && k.$$typeof === yt && Zl(k) === g.type) {
                    l(
                      v,
                      g.sibling
                    ), j = n(g, T.props), sn(j, T), j.return = v, v = j;
                    break t;
                  }
                  l(v, g);
                  break;
                } else e(v, g);
                g = g.sibling;
              }
              T.type === N ? (j = Ll(
                T.props.children,
                v.mode,
                j,
                T.key
              ), j.return = v, v = j) : (j = hu(
                T.type,
                T.key,
                T.props,
                null,
                v.mode,
                j
              ), sn(j, T), j.return = v, v = j);
            }
            return s(v);
          case V:
            t: {
              for (k = T.key; g !== null; ) {
                if (g.key === k)
                  if (g.tag === 4 && g.stateNode.containerInfo === T.containerInfo && g.stateNode.implementation === T.implementation) {
                    l(
                      v,
                      g.sibling
                    ), j = n(g, T.children || []), j.return = v, v = j;
                    break t;
                  } else {
                    l(v, g);
                    break;
                  }
                else e(v, g);
                g = g.sibling;
              }
              j = cc(T, v.mode, j), j.return = v, v = j;
            }
            return s(v);
          case yt:
            return T = Zl(T), zt(
              v,
              g,
              T,
              j
            );
        }
        if (st(T))
          return X(
            v,
            g,
            T,
            j
          );
        if (Qt(T)) {
          if (k = Qt(T), typeof k != "function") throw Error(r(150));
          return T = k.call(T), W(
            v,
            g,
            T,
            j
          );
        }
        if (typeof T.then == "function")
          return zt(
            v,
            g,
            Su(T),
            j
          );
        if (T.$$typeof === dt)
          return zt(
            v,
            g,
            gu(v, T),
            j
          );
        Eu(v, T);
      }
      return typeof T == "string" && T !== "" || typeof T == "number" || typeof T == "bigint" ? (T = "" + T, g !== null && g.tag === 6 ? (l(v, g.sibling), j = n(g, T), j.return = v, v = j) : (l(v, g), j = ic(T, v.mode, j), j.return = v, v = j), s(v)) : l(v, g);
    }
    return function(v, g, T, j) {
      try {
        cn = 0;
        var k = zt(
          v,
          g,
          T,
          j
        );
        return va = null, k;
      } catch (K) {
        if (K === pa || K === vu) throw K;
        var mt = he(29, K, null, v.mode);
        return mt.lanes = j, mt.return = v, mt;
      }
    };
  }
  var Kl = Co(!0), Ro = Co(!1), hl = !1;
  function bc(t) {
    t.updateQueue = {
      baseState: t.memoizedState,
      firstBaseUpdate: null,
      lastBaseUpdate: null,
      shared: { pending: null, lanes: 0, hiddenCallbacks: null },
      callbacks: null
    };
  }
  function Sc(t, e) {
    t = t.updateQueue, e.updateQueue === t && (e.updateQueue = {
      baseState: t.baseState,
      firstBaseUpdate: t.firstBaseUpdate,
      lastBaseUpdate: t.lastBaseUpdate,
      shared: t.shared,
      callbacks: null
    });
  }
  function yl(t) {
    return { lane: t, tag: 0, payload: null, callback: null, next: null };
  }
  function ml(t, e, l) {
    var a = t.updateQueue;
    if (a === null) return null;
    if (a = a.shared, (vt & 2) !== 0) {
      var n = a.pending;
      return n === null ? e.next = e : (e.next = n.next, n.next = e), a.pending = e, e = du(t), fo(t, null, l), e;
    }
    return fu(t, a, e, l), du(t);
  }
  function rn(t, e, l) {
    if (e = e.updateQueue, e !== null && (e = e.shared, (l & 4194048) !== 0)) {
      var a = e.lanes;
      a &= t.pendingLanes, l |= a, e.lanes = l, br(t, l);
    }
  }
  function Ec(t, e) {
    var l = t.updateQueue, a = t.alternate;
    if (a !== null && (a = a.updateQueue, l === a)) {
      var n = null, i = null;
      if (l = l.firstBaseUpdate, l !== null) {
        do {
          var s = {
            lane: l.lane,
            tag: l.tag,
            payload: l.payload,
            callback: null,
            next: null
          };
          i === null ? n = i = s : i = i.next = s, l = l.next;
        } while (l !== null);
        i === null ? n = i = e : i = i.next = e;
      } else n = i = e;
      l = {
        baseState: a.baseState,
        firstBaseUpdate: n,
        lastBaseUpdate: i,
        shared: a.shared,
        callbacks: a.callbacks
      }, t.updateQueue = l;
      return;
    }
    t = l.lastBaseUpdate, t === null ? l.firstBaseUpdate = e : t.next = e, l.lastBaseUpdate = e;
  }
  var Tc = !1;
  function on() {
    if (Tc) {
      var t = ga;
      if (t !== null) throw t;
    }
  }
  function fn(t, e, l, a) {
    Tc = !1;
    var n = t.updateQueue;
    hl = !1;
    var i = n.firstBaseUpdate, s = n.lastBaseUpdate, f = n.shared.pending;
    if (f !== null) {
      n.shared.pending = null;
      var h = f, A = h.next;
      h.next = null, s === null ? i = A : s.next = A, s = h;
      var C = t.alternate;
      C !== null && (C = C.updateQueue, f = C.lastBaseUpdate, f !== s && (f === null ? C.firstBaseUpdate = A : f.next = A, C.lastBaseUpdate = h));
    }
    if (i !== null) {
      var D = n.baseState;
      s = 0, C = A = h = null, f = i;
      do {
        var z = f.lane & -536870913, x = z !== f.lane;
        if (x ? (rt & z) === z : (a & z) === z) {
          z !== 0 && z === ma && (Tc = !0), C !== null && (C = C.next = {
            lane: 0,
            tag: f.tag,
            payload: f.payload,
            callback: null,
            next: null
          });
          t: {
            var X = t, W = f;
            z = e;
            var zt = l;
            switch (W.tag) {
              case 1:
                if (X = W.payload, typeof X == "function") {
                  D = X.call(zt, D, z);
                  break t;
                }
                D = X;
                break t;
              case 3:
                X.flags = X.flags & -65537 | 128;
              case 0:
                if (X = W.payload, z = typeof X == "function" ? X.call(zt, D, z) : X, z == null) break t;
                D = _({}, D, z);
                break t;
              case 2:
                hl = !0;
            }
          }
          z = f.callback, z !== null && (t.flags |= 64, x && (t.flags |= 8192), x = n.callbacks, x === null ? n.callbacks = [z] : x.push(z));
        } else
          x = {
            lane: z,
            tag: f.tag,
            payload: f.payload,
            callback: f.callback,
            next: null
          }, C === null ? (A = C = x, h = D) : C = C.next = x, s |= z;
        if (f = f.next, f === null) {
          if (f = n.shared.pending, f === null)
            break;
          x = f, f = x.next, x.next = null, n.lastBaseUpdate = x, n.shared.pending = null;
        }
      } while (!0);
      C === null && (h = D), n.baseState = h, n.firstBaseUpdate = A, n.lastBaseUpdate = C, i === null && (n.shared.lanes = 0), Sl |= s, t.lanes = s, t.memoizedState = D;
    }
  }
  function jo(t, e) {
    if (typeof t != "function")
      throw Error(r(191, t));
    t.call(e);
  }
  function wo(t, e) {
    var l = t.callbacks;
    if (l !== null)
      for (t.callbacks = null, t = 0; t < l.length; t++)
        jo(l[t], e);
  }
  var ba = m(null), Tu = m(0);
  function Do(t, e) {
    t = ll, B(Tu, t), B(ba, e), ll = t | e.baseLanes;
  }
  function Ac() {
    B(Tu, ll), B(ba, ba.current);
  }
  function Oc() {
    ll = Tu.current, R(ba), R(Tu);
  }
  var ye = m(null), Ce = null;
  function gl(t) {
    var e = t.alternate;
    B(_t, _t.current & 1), B(ye, t), Ce === null && (e === null || ba.current !== null || e.memoizedState !== null) && (Ce = t);
  }
  function zc(t) {
    B(_t, _t.current), B(ye, t), Ce === null && (Ce = t);
  }
  function _o(t) {
    t.tag === 22 ? (B(_t, _t.current), B(ye, t), Ce === null && (Ce = t)) : pl();
  }
  function pl() {
    B(_t, _t.current), B(ye, ye.current);
  }
  function me(t) {
    R(ye), Ce === t && (Ce = null), R(_t);
  }
  var _t = m(0);
  function Au(t) {
    for (var e = t; e !== null; ) {
      if (e.tag === 13) {
        var l = e.memoizedState;
        if (l !== null && (l = l.dehydrated, l === null || ws(l) || Ds(l)))
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
  var ke = 0, et = null, At = null, qt = null, Ou = !1, Sa = !1, Jl = !1, zu = 0, dn = 0, Ea = null, xm = 0;
  function jt() {
    throw Error(r(321));
  }
  function xc(t, e) {
    if (e === null) return !1;
    for (var l = 0; l < e.length && l < t.length; l++)
      if (!de(t[l], e[l])) return !1;
    return !0;
  }
  function Mc(t, e, l, a, n, i) {
    return ke = i, et = e, e.memoizedState = null, e.updateQueue = null, e.lanes = 0, M.H = t === null || t.memoizedState === null ? pf : Gc, Jl = !1, i = l(a, n), Jl = !1, Sa && (i = Uo(
      e,
      l,
      a,
      n
    )), No(t), i;
  }
  function No(t) {
    M.H = mn;
    var e = At !== null && At.next !== null;
    if (ke = 0, qt = At = et = null, Ou = !1, dn = 0, Ea = null, e) throw Error(r(300));
    t === null || Ht || (t = t.dependencies, t !== null && mu(t) && (Ht = !0));
  }
  function Uo(t, e, l, a) {
    et = t;
    var n = 0;
    do {
      if (Sa && (Ea = null), dn = 0, Sa = !1, 25 <= n) throw Error(r(301));
      if (n += 1, qt = At = null, t.updateQueue != null) {
        var i = t.updateQueue;
        i.lastEffect = null, i.events = null, i.stores = null, i.memoCache != null && (i.memoCache.index = 0);
      }
      M.H = vf, i = e(l, a);
    } while (Sa);
    return i;
  }
  function Mm() {
    var t = M.H, e = t.useState()[0];
    return e = typeof e.then == "function" ? hn(e) : e, t = t.useState()[0], (At !== null ? At.memoizedState : null) !== t && (et.flags |= 1024), e;
  }
  function Cc() {
    var t = zu !== 0;
    return zu = 0, t;
  }
  function Rc(t, e, l) {
    e.updateQueue = t.updateQueue, e.flags &= -2053, t.lanes &= ~l;
  }
  function jc(t) {
    if (Ou) {
      for (t = t.memoizedState; t !== null; ) {
        var e = t.queue;
        e !== null && (e.pending = null), t = t.next;
      }
      Ou = !1;
    }
    ke = 0, qt = At = et = null, Sa = !1, dn = zu = 0, Ea = null;
  }
  function Pt() {
    var t = {
      memoizedState: null,
      baseState: null,
      baseQueue: null,
      queue: null,
      next: null
    };
    return qt === null ? et.memoizedState = qt = t : qt = qt.next = t, qt;
  }
  function Nt() {
    if (At === null) {
      var t = et.alternate;
      t = t !== null ? t.memoizedState : null;
    } else t = At.next;
    var e = qt === null ? et.memoizedState : qt.next;
    if (e !== null)
      qt = e, At = t;
    else {
      if (t === null)
        throw et.alternate === null ? Error(r(467)) : Error(r(310));
      At = t, t = {
        memoizedState: At.memoizedState,
        baseState: At.baseState,
        baseQueue: At.baseQueue,
        queue: At.queue,
        next: null
      }, qt === null ? et.memoizedState = qt = t : qt = qt.next = t;
    }
    return qt;
  }
  function xu() {
    return { lastEffect: null, events: null, stores: null, memoCache: null };
  }
  function hn(t) {
    var e = dn;
    return dn += 1, Ea === null && (Ea = []), t = zo(Ea, t, e), e = et, (qt === null ? e.memoizedState : qt.next) === null && (e = e.alternate, M.H = e === null || e.memoizedState === null ? pf : Gc), t;
  }
  function Mu(t) {
    if (t !== null && typeof t == "object") {
      if (typeof t.then == "function") return hn(t);
      if (t.$$typeof === dt) return Jt(t);
    }
    throw Error(r(438, String(t)));
  }
  function wc(t) {
    var e = null, l = et.updateQueue;
    if (l !== null && (e = l.memoCache), e == null) {
      var a = et.alternate;
      a !== null && (a = a.updateQueue, a !== null && (a = a.memoCache, a != null && (e = {
        data: a.data.map(function(n) {
          return n.slice();
        }),
        index: 0
      })));
    }
    if (e == null && (e = { data: [], index: 0 }), l === null && (l = xu(), et.updateQueue = l), l.memoCache = e, l = e.data[e.index], l === void 0)
      for (l = e.data[e.index] = Array(t), a = 0; a < t; a++)
        l[a] = P;
    return e.index++, l;
  }
  function Fe(t, e) {
    return typeof e == "function" ? e(t) : e;
  }
  function Cu(t) {
    var e = Nt();
    return Dc(e, At, t);
  }
  function Dc(t, e, l) {
    var a = t.queue;
    if (a === null) throw Error(r(311));
    a.lastRenderedReducer = l;
    var n = t.baseQueue, i = a.pending;
    if (i !== null) {
      if (n !== null) {
        var s = n.next;
        n.next = i.next, i.next = s;
      }
      e.baseQueue = n = i, a.pending = null;
    }
    if (i = t.baseState, n === null) t.memoizedState = i;
    else {
      e = n.next;
      var f = s = null, h = null, A = e, C = !1;
      do {
        var D = A.lane & -536870913;
        if (D !== A.lane ? (rt & D) === D : (ke & D) === D) {
          var z = A.revertLane;
          if (z === 0)
            h !== null && (h = h.next = {
              lane: 0,
              revertLane: 0,
              gesture: null,
              action: A.action,
              hasEagerState: A.hasEagerState,
              eagerState: A.eagerState,
              next: null
            }), D === ma && (C = !0);
          else if ((ke & z) === z) {
            A = A.next, z === ma && (C = !0);
            continue;
          } else
            D = {
              lane: 0,
              revertLane: A.revertLane,
              gesture: null,
              action: A.action,
              hasEagerState: A.hasEagerState,
              eagerState: A.eagerState,
              next: null
            }, h === null ? (f = h = D, s = i) : h = h.next = D, et.lanes |= z, Sl |= z;
          D = A.action, Jl && l(i, D), i = A.hasEagerState ? A.eagerState : l(i, D);
        } else
          z = {
            lane: D,
            revertLane: A.revertLane,
            gesture: A.gesture,
            action: A.action,
            hasEagerState: A.hasEagerState,
            eagerState: A.eagerState,
            next: null
          }, h === null ? (f = h = z, s = i) : h = h.next = z, et.lanes |= D, Sl |= D;
        A = A.next;
      } while (A !== null && A !== e);
      if (h === null ? s = i : h.next = f, !de(i, t.memoizedState) && (Ht = !0, C && (l = ga, l !== null)))
        throw l;
      t.memoizedState = i, t.baseState = s, t.baseQueue = h, a.lastRenderedState = i;
    }
    return n === null && (a.lanes = 0), [t.memoizedState, a.dispatch];
  }
  function _c(t) {
    var e = Nt(), l = e.queue;
    if (l === null) throw Error(r(311));
    l.lastRenderedReducer = t;
    var a = l.dispatch, n = l.pending, i = e.memoizedState;
    if (n !== null) {
      l.pending = null;
      var s = n = n.next;
      do
        i = t(i, s.action), s = s.next;
      while (s !== n);
      de(i, e.memoizedState) || (Ht = !0), e.memoizedState = i, e.baseQueue === null && (e.baseState = i), l.lastRenderedState = i;
    }
    return [i, a];
  }
  function qo(t, e, l) {
    var a = et, n = Nt(), i = ft;
    if (i) {
      if (l === void 0) throw Error(r(407));
      l = l();
    } else l = e();
    var s = !de(
      (At || n).memoizedState,
      l
    );
    if (s && (n.memoizedState = l, Ht = !0), n = n.queue, qc(Lo.bind(null, a, n, t), [
      t
    ]), n.getSnapshot !== e || s || qt !== null && qt.memoizedState.tag & 1) {
      if (a.flags |= 2048, Ta(
        9,
        { destroy: void 0 },
        Bo.bind(
          null,
          a,
          n,
          l,
          e
        ),
        null
      ), xt === null) throw Error(r(349));
      i || (ke & 127) !== 0 || Ho(a, e, l);
    }
    return l;
  }
  function Ho(t, e, l) {
    t.flags |= 16384, t = { getSnapshot: e, value: l }, e = et.updateQueue, e === null ? (e = xu(), et.updateQueue = e, e.stores = [t]) : (l = e.stores, l === null ? e.stores = [t] : l.push(t));
  }
  function Bo(t, e, l, a) {
    e.value = l, e.getSnapshot = a, Qo(e) && Yo(t);
  }
  function Lo(t, e, l) {
    return l(function() {
      Qo(e) && Yo(t);
    });
  }
  function Qo(t) {
    var e = t.getSnapshot;
    t = t.value;
    try {
      var l = e();
      return !de(t, l);
    } catch {
      return !0;
    }
  }
  function Yo(t) {
    var e = Bl(t, 2);
    e !== null && se(e, t, 2);
  }
  function Nc(t) {
    var e = Pt();
    if (typeof t == "function") {
      var l = t;
      if (t = l(), Jl) {
        il(!0);
        try {
          l();
        } finally {
          il(!1);
        }
      }
    }
    return e.memoizedState = e.baseState = t, e.queue = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Fe,
      lastRenderedState: t
    }, e;
  }
  function Go(t, e, l, a) {
    return t.baseState = l, Dc(
      t,
      At,
      typeof a == "function" ? a : Fe
    );
  }
  function Cm(t, e, l, a, n) {
    if (wu(t)) throw Error(r(485));
    if (t = e.action, t !== null) {
      var i = {
        payload: n,
        action: t,
        next: null,
        isTransition: !0,
        status: "pending",
        value: null,
        reason: null,
        listeners: [],
        then: function(s) {
          i.listeners.push(s);
        }
      };
      M.T !== null ? l(!0) : i.isTransition = !1, a(i), l = e.pending, l === null ? (i.next = e.pending = i, Xo(e, i)) : (i.next = l.next, e.pending = l.next = i);
    }
  }
  function Xo(t, e) {
    var l = e.action, a = e.payload, n = t.state;
    if (e.isTransition) {
      var i = M.T, s = {};
      M.T = s;
      try {
        var f = l(n, a), h = M.S;
        h !== null && h(s, f), Zo(t, e, f);
      } catch (A) {
        Uc(t, e, A);
      } finally {
        i !== null && s.types !== null && (i.types = s.types), M.T = i;
      }
    } else
      try {
        i = l(n, a), Zo(t, e, i);
      } catch (A) {
        Uc(t, e, A);
      }
  }
  function Zo(t, e, l) {
    l !== null && typeof l == "object" && typeof l.then == "function" ? l.then(
      function(a) {
        Vo(t, e, a);
      },
      function(a) {
        return Uc(t, e, a);
      }
    ) : Vo(t, e, l);
  }
  function Vo(t, e, l) {
    e.status = "fulfilled", e.value = l, Ko(e), t.state = l, e = t.pending, e !== null && (l = e.next, l === e ? t.pending = null : (l = l.next, e.next = l, Xo(t, l)));
  }
  function Uc(t, e, l) {
    var a = t.pending;
    if (t.pending = null, a !== null) {
      a = a.next;
      do
        e.status = "rejected", e.reason = l, Ko(e), e = e.next;
      while (e !== a);
    }
    t.action = null;
  }
  function Ko(t) {
    t = t.listeners;
    for (var e = 0; e < t.length; e++) (0, t[e])();
  }
  function Jo(t, e) {
    return e;
  }
  function ko(t, e) {
    if (ft) {
      var l = xt.formState;
      if (l !== null) {
        t: {
          var a = et;
          if (ft) {
            if (Mt) {
              e: {
                for (var n = Mt, i = Me; n.nodeType !== 8; ) {
                  if (!i) {
                    n = null;
                    break e;
                  }
                  if (n = Re(
                    n.nextSibling
                  ), n === null) {
                    n = null;
                    break e;
                  }
                }
                i = n.data, n = i === "F!" || i === "F" ? n : null;
              }
              if (n) {
                Mt = Re(
                  n.nextSibling
                ), a = n.data === "F!";
                break t;
              }
            }
            fl(a);
          }
          a = !1;
        }
        a && (e = l[0]);
      }
    }
    return l = Pt(), l.memoizedState = l.baseState = e, a = {
      pending: null,
      lanes: 0,
      dispatch: null,
      lastRenderedReducer: Jo,
      lastRenderedState: e
    }, l.queue = a, l = yf.bind(
      null,
      et,
      a
    ), a.dispatch = l, a = Nc(!1), i = Yc.bind(
      null,
      et,
      !1,
      a.queue
    ), a = Pt(), n = {
      state: e,
      dispatch: null,
      action: t,
      pending: null
    }, a.queue = n, l = Cm.bind(
      null,
      et,
      n,
      i,
      l
    ), n.dispatch = l, a.memoizedState = t, [e, l, !1];
  }
  function Fo(t) {
    var e = Nt();
    return Wo(e, At, t);
  }
  function Wo(t, e, l) {
    if (e = Dc(
      t,
      e,
      Jo
    )[0], t = Cu(Fe)[0], typeof e == "object" && e !== null && typeof e.then == "function")
      try {
        var a = hn(e);
      } catch (s) {
        throw s === pa ? vu : s;
      }
    else a = e;
    e = Nt();
    var n = e.queue, i = n.dispatch;
    return l !== e.memoizedState && (et.flags |= 2048, Ta(
      9,
      { destroy: void 0 },
      Rm.bind(null, n, l),
      null
    )), [a, i, t];
  }
  function Rm(t, e) {
    t.action = e;
  }
  function $o(t) {
    var e = Nt(), l = At;
    if (l !== null)
      return Wo(e, l, t);
    Nt(), e = e.memoizedState, l = Nt();
    var a = l.queue.dispatch;
    return l.memoizedState = t, [e, a, !1];
  }
  function Ta(t, e, l, a) {
    return t = { tag: t, create: l, deps: a, inst: e, next: null }, e = et.updateQueue, e === null && (e = xu(), et.updateQueue = e), l = e.lastEffect, l === null ? e.lastEffect = t.next = t : (a = l.next, l.next = t, t.next = a, e.lastEffect = t), t;
  }
  function Io() {
    return Nt().memoizedState;
  }
  function Ru(t, e, l, a) {
    var n = Pt();
    et.flags |= t, n.memoizedState = Ta(
      1 | e,
      { destroy: void 0 },
      l,
      a === void 0 ? null : a
    );
  }
  function ju(t, e, l, a) {
    var n = Nt();
    a = a === void 0 ? null : a;
    var i = n.memoizedState.inst;
    At !== null && a !== null && xc(a, At.memoizedState.deps) ? n.memoizedState = Ta(e, i, l, a) : (et.flags |= t, n.memoizedState = Ta(
      1 | e,
      i,
      l,
      a
    ));
  }
  function Po(t, e) {
    Ru(8390656, 8, t, e);
  }
  function qc(t, e) {
    ju(2048, 8, t, e);
  }
  function jm(t) {
    et.flags |= 4;
    var e = et.updateQueue;
    if (e === null)
      e = xu(), et.updateQueue = e, e.events = [t];
    else {
      var l = e.events;
      l === null ? e.events = [t] : l.push(t);
    }
  }
  function tf(t) {
    var e = Nt().memoizedState;
    return jm({ ref: e, nextImpl: t }), function() {
      if ((vt & 2) !== 0) throw Error(r(440));
      return e.impl.apply(void 0, arguments);
    };
  }
  function ef(t, e) {
    return ju(4, 2, t, e);
  }
  function lf(t, e) {
    return ju(4, 4, t, e);
  }
  function af(t, e) {
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
  function nf(t, e, l) {
    l = l != null ? l.concat([t]) : null, ju(4, 4, af.bind(null, e, t), l);
  }
  function Hc() {
  }
  function uf(t, e) {
    var l = Nt();
    e = e === void 0 ? null : e;
    var a = l.memoizedState;
    return e !== null && xc(e, a[1]) ? a[0] : (l.memoizedState = [t, e], t);
  }
  function cf(t, e) {
    var l = Nt();
    e = e === void 0 ? null : e;
    var a = l.memoizedState;
    if (e !== null && xc(e, a[1]))
      return a[0];
    if (a = t(), Jl) {
      il(!0);
      try {
        t();
      } finally {
        il(!1);
      }
    }
    return l.memoizedState = [a, e], a;
  }
  function Bc(t, e, l) {
    return l === void 0 || (ke & 1073741824) !== 0 && (rt & 261930) === 0 ? t.memoizedState = e : (t.memoizedState = l, t = sd(), et.lanes |= t, Sl |= t, l);
  }
  function sf(t, e, l, a) {
    return de(l, e) ? l : ba.current !== null ? (t = Bc(t, l, a), de(t, e) || (Ht = !0), t) : (ke & 42) === 0 || (ke & 1073741824) !== 0 && (rt & 261930) === 0 ? (Ht = !0, t.memoizedState = l) : (t = sd(), et.lanes |= t, Sl |= t, e);
  }
  function rf(t, e, l, a, n) {
    var i = H.p;
    H.p = i !== 0 && 8 > i ? i : 8;
    var s = M.T, f = {};
    M.T = f, Yc(t, !1, e, l);
    try {
      var h = n(), A = M.S;
      if (A !== null && A(f, h), h !== null && typeof h == "object" && typeof h.then == "function") {
        var C = zm(
          h,
          a
        );
        yn(
          t,
          e,
          C,
          ve(t)
        );
      } else
        yn(
          t,
          e,
          a,
          ve(t)
        );
    } catch (D) {
      yn(
        t,
        e,
        { then: function() {
        }, status: "rejected", reason: D },
        ve()
      );
    } finally {
      H.p = i, s !== null && f.types !== null && (s.types = f.types), M.T = s;
    }
  }
  function wm() {
  }
  function Lc(t, e, l, a) {
    if (t.tag !== 5) throw Error(r(476));
    var n = of(t).queue;
    rf(
      t,
      n,
      e,
      F,
      l === null ? wm : function() {
        return ff(t), l(a);
      }
    );
  }
  function of(t) {
    var e = t.memoizedState;
    if (e !== null) return e;
    e = {
      memoizedState: F,
      baseState: F,
      baseQueue: null,
      queue: {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: Fe,
        lastRenderedState: F
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
        lastRenderedReducer: Fe,
        lastRenderedState: l
      },
      next: null
    }, t.memoizedState = e, t = t.alternate, t !== null && (t.memoizedState = e), e;
  }
  function ff(t) {
    var e = of(t);
    e.next === null && (e = t.alternate.memoizedState), yn(
      t,
      e.next.queue,
      {},
      ve()
    );
  }
  function Qc() {
    return Jt(wn);
  }
  function df() {
    return Nt().memoizedState;
  }
  function hf() {
    return Nt().memoizedState;
  }
  function Dm(t) {
    for (var e = t.return; e !== null; ) {
      switch (e.tag) {
        case 24:
        case 3:
          var l = ve();
          t = yl(l);
          var a = ml(e, t, l);
          a !== null && (se(a, e, l), rn(a, e, l)), e = { cache: mc() }, t.payload = e;
          return;
      }
      e = e.return;
    }
  }
  function _m(t, e, l) {
    var a = ve();
    l = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, wu(t) ? mf(e, l) : (l = nc(t, e, l, a), l !== null && (se(l, t, a), gf(l, e, a)));
  }
  function yf(t, e, l) {
    var a = ve();
    yn(t, e, l, a);
  }
  function yn(t, e, l, a) {
    var n = {
      lane: a,
      revertLane: 0,
      gesture: null,
      action: l,
      hasEagerState: !1,
      eagerState: null,
      next: null
    };
    if (wu(t)) mf(e, n);
    else {
      var i = t.alternate;
      if (t.lanes === 0 && (i === null || i.lanes === 0) && (i = e.lastRenderedReducer, i !== null))
        try {
          var s = e.lastRenderedState, f = i(s, l);
          if (n.hasEagerState = !0, n.eagerState = f, de(f, s))
            return fu(t, e, n, 0), xt === null && ou(), !1;
        } catch {
        }
      if (l = nc(t, e, n, a), l !== null)
        return se(l, t, a), gf(l, e, a), !0;
    }
    return !1;
  }
  function Yc(t, e, l, a) {
    if (a = {
      lane: 2,
      revertLane: bs(),
      gesture: null,
      action: a,
      hasEagerState: !1,
      eagerState: null,
      next: null
    }, wu(t)) {
      if (e) throw Error(r(479));
    } else
      e = nc(
        t,
        l,
        a,
        2
      ), e !== null && se(e, t, 2);
  }
  function wu(t) {
    var e = t.alternate;
    return t === et || e !== null && e === et;
  }
  function mf(t, e) {
    Sa = Ou = !0;
    var l = t.pending;
    l === null ? e.next = e : (e.next = l.next, l.next = e), t.pending = e;
  }
  function gf(t, e, l) {
    if ((l & 4194048) !== 0) {
      var a = e.lanes;
      a &= t.pendingLanes, l |= a, e.lanes = l, br(t, l);
    }
  }
  var mn = {
    readContext: Jt,
    use: Mu,
    useCallback: jt,
    useContext: jt,
    useEffect: jt,
    useImperativeHandle: jt,
    useLayoutEffect: jt,
    useInsertionEffect: jt,
    useMemo: jt,
    useReducer: jt,
    useRef: jt,
    useState: jt,
    useDebugValue: jt,
    useDeferredValue: jt,
    useTransition: jt,
    useSyncExternalStore: jt,
    useId: jt,
    useHostTransitionStatus: jt,
    useFormState: jt,
    useActionState: jt,
    useOptimistic: jt,
    useMemoCache: jt,
    useCacheRefresh: jt
  };
  mn.useEffectEvent = jt;
  var pf = {
    readContext: Jt,
    use: Mu,
    useCallback: function(t, e) {
      return Pt().memoizedState = [
        t,
        e === void 0 ? null : e
      ], t;
    },
    useContext: Jt,
    useEffect: Po,
    useImperativeHandle: function(t, e, l) {
      l = l != null ? l.concat([t]) : null, Ru(
        4194308,
        4,
        af.bind(null, e, t),
        l
      );
    },
    useLayoutEffect: function(t, e) {
      return Ru(4194308, 4, t, e);
    },
    useInsertionEffect: function(t, e) {
      Ru(4, 2, t, e);
    },
    useMemo: function(t, e) {
      var l = Pt();
      e = e === void 0 ? null : e;
      var a = t();
      if (Jl) {
        il(!0);
        try {
          t();
        } finally {
          il(!1);
        }
      }
      return l.memoizedState = [a, e], a;
    },
    useReducer: function(t, e, l) {
      var a = Pt();
      if (l !== void 0) {
        var n = l(e);
        if (Jl) {
          il(!0);
          try {
            l(e);
          } finally {
            il(!1);
          }
        }
      } else n = e;
      return a.memoizedState = a.baseState = n, t = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: t,
        lastRenderedState: n
      }, a.queue = t, t = t.dispatch = _m.bind(
        null,
        et,
        t
      ), [a.memoizedState, t];
    },
    useRef: function(t) {
      var e = Pt();
      return t = { current: t }, e.memoizedState = t;
    },
    useState: function(t) {
      t = Nc(t);
      var e = t.queue, l = yf.bind(null, et, e);
      return e.dispatch = l, [t.memoizedState, l];
    },
    useDebugValue: Hc,
    useDeferredValue: function(t, e) {
      var l = Pt();
      return Bc(l, t, e);
    },
    useTransition: function() {
      var t = Nc(!1);
      return t = rf.bind(
        null,
        et,
        t.queue,
        !0,
        !1
      ), Pt().memoizedState = t, [!1, t];
    },
    useSyncExternalStore: function(t, e, l) {
      var a = et, n = Pt();
      if (ft) {
        if (l === void 0)
          throw Error(r(407));
        l = l();
      } else {
        if (l = e(), xt === null)
          throw Error(r(349));
        (rt & 127) !== 0 || Ho(a, e, l);
      }
      n.memoizedState = l;
      var i = { value: l, getSnapshot: e };
      return n.queue = i, Po(Lo.bind(null, a, i, t), [
        t
      ]), a.flags |= 2048, Ta(
        9,
        { destroy: void 0 },
        Bo.bind(
          null,
          a,
          i,
          l,
          e
        ),
        null
      ), l;
    },
    useId: function() {
      var t = Pt(), e = xt.identifierPrefix;
      if (ft) {
        var l = He, a = qe;
        l = (a & ~(1 << 32 - fe(a) - 1)).toString(32) + l, e = "_" + e + "R_" + l, l = zu++, 0 < l && (e += "H" + l.toString(32)), e += "_";
      } else
        l = xm++, e = "_" + e + "r_" + l.toString(32) + "_";
      return t.memoizedState = e;
    },
    useHostTransitionStatus: Qc,
    useFormState: ko,
    useActionState: ko,
    useOptimistic: function(t) {
      var e = Pt();
      e.memoizedState = e.baseState = t;
      var l = {
        pending: null,
        lanes: 0,
        dispatch: null,
        lastRenderedReducer: null,
        lastRenderedState: null
      };
      return e.queue = l, e = Yc.bind(
        null,
        et,
        !0,
        l
      ), l.dispatch = e, [t, e];
    },
    useMemoCache: wc,
    useCacheRefresh: function() {
      return Pt().memoizedState = Dm.bind(
        null,
        et
      );
    },
    useEffectEvent: function(t) {
      var e = Pt(), l = { impl: t };
      return e.memoizedState = l, function() {
        if ((vt & 2) !== 0)
          throw Error(r(440));
        return l.impl.apply(void 0, arguments);
      };
    }
  }, Gc = {
    readContext: Jt,
    use: Mu,
    useCallback: uf,
    useContext: Jt,
    useEffect: qc,
    useImperativeHandle: nf,
    useInsertionEffect: ef,
    useLayoutEffect: lf,
    useMemo: cf,
    useReducer: Cu,
    useRef: Io,
    useState: function() {
      return Cu(Fe);
    },
    useDebugValue: Hc,
    useDeferredValue: function(t, e) {
      var l = Nt();
      return sf(
        l,
        At.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = Cu(Fe)[0], e = Nt().memoizedState;
      return [
        typeof t == "boolean" ? t : hn(t),
        e
      ];
    },
    useSyncExternalStore: qo,
    useId: df,
    useHostTransitionStatus: Qc,
    useFormState: Fo,
    useActionState: Fo,
    useOptimistic: function(t, e) {
      var l = Nt();
      return Go(l, At, t, e);
    },
    useMemoCache: wc,
    useCacheRefresh: hf
  };
  Gc.useEffectEvent = tf;
  var vf = {
    readContext: Jt,
    use: Mu,
    useCallback: uf,
    useContext: Jt,
    useEffect: qc,
    useImperativeHandle: nf,
    useInsertionEffect: ef,
    useLayoutEffect: lf,
    useMemo: cf,
    useReducer: _c,
    useRef: Io,
    useState: function() {
      return _c(Fe);
    },
    useDebugValue: Hc,
    useDeferredValue: function(t, e) {
      var l = Nt();
      return At === null ? Bc(l, t, e) : sf(
        l,
        At.memoizedState,
        t,
        e
      );
    },
    useTransition: function() {
      var t = _c(Fe)[0], e = Nt().memoizedState;
      return [
        typeof t == "boolean" ? t : hn(t),
        e
      ];
    },
    useSyncExternalStore: qo,
    useId: df,
    useHostTransitionStatus: Qc,
    useFormState: $o,
    useActionState: $o,
    useOptimistic: function(t, e) {
      var l = Nt();
      return At !== null ? Go(l, At, t, e) : (l.baseState = t, [t, l.queue.dispatch]);
    },
    useMemoCache: wc,
    useCacheRefresh: hf
  };
  vf.useEffectEvent = tf;
  function Xc(t, e, l, a) {
    e = t.memoizedState, l = l(a, e), l = l == null ? e : _({}, e, l), t.memoizedState = l, t.lanes === 0 && (t.updateQueue.baseState = l);
  }
  var Zc = {
    enqueueSetState: function(t, e, l) {
      t = t._reactInternals;
      var a = ve(), n = yl(a);
      n.payload = e, l != null && (n.callback = l), e = ml(t, n, a), e !== null && (se(e, t, a), rn(e, t, a));
    },
    enqueueReplaceState: function(t, e, l) {
      t = t._reactInternals;
      var a = ve(), n = yl(a);
      n.tag = 1, n.payload = e, l != null && (n.callback = l), e = ml(t, n, a), e !== null && (se(e, t, a), rn(e, t, a));
    },
    enqueueForceUpdate: function(t, e) {
      t = t._reactInternals;
      var l = ve(), a = yl(l);
      a.tag = 2, e != null && (a.callback = e), e = ml(t, a, l), e !== null && (se(e, t, l), rn(e, t, l));
    }
  };
  function bf(t, e, l, a, n, i, s) {
    return t = t.stateNode, typeof t.shouldComponentUpdate == "function" ? t.shouldComponentUpdate(a, i, s) : e.prototype && e.prototype.isPureReactComponent ? !tn(l, a) || !tn(n, i) : !0;
  }
  function Sf(t, e, l, a) {
    t = e.state, typeof e.componentWillReceiveProps == "function" && e.componentWillReceiveProps(l, a), typeof e.UNSAFE_componentWillReceiveProps == "function" && e.UNSAFE_componentWillReceiveProps(l, a), e.state !== t && Zc.enqueueReplaceState(e, e.state, null);
  }
  function kl(t, e) {
    var l = e;
    if ("ref" in e) {
      l = {};
      for (var a in e)
        a !== "ref" && (l[a] = e[a]);
    }
    if (t = t.defaultProps) {
      l === e && (l = _({}, l));
      for (var n in t)
        l[n] === void 0 && (l[n] = t[n]);
    }
    return l;
  }
  function Ef(t) {
    ru(t);
  }
  function Tf(t) {
    console.error(t);
  }
  function Af(t) {
    ru(t);
  }
  function Du(t, e) {
    try {
      var l = t.onUncaughtError;
      l(e.value, { componentStack: e.stack });
    } catch (a) {
      setTimeout(function() {
        throw a;
      });
    }
  }
  function Of(t, e, l) {
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
  function Vc(t, e, l) {
    return l = yl(l), l.tag = 3, l.payload = { element: null }, l.callback = function() {
      Du(t, e);
    }, l;
  }
  function zf(t) {
    return t = yl(t), t.tag = 3, t;
  }
  function xf(t, e, l, a) {
    var n = l.type.getDerivedStateFromError;
    if (typeof n == "function") {
      var i = a.value;
      t.payload = function() {
        return n(i);
      }, t.callback = function() {
        Of(e, l, a);
      };
    }
    var s = l.stateNode;
    s !== null && typeof s.componentDidCatch == "function" && (t.callback = function() {
      Of(e, l, a), typeof n != "function" && (El === null ? El = /* @__PURE__ */ new Set([this]) : El.add(this));
      var f = a.stack;
      this.componentDidCatch(a.value, {
        componentStack: f !== null ? f : ""
      });
    });
  }
  function Nm(t, e, l, a, n) {
    if (l.flags |= 32768, a !== null && typeof a == "object" && typeof a.then == "function") {
      if (e = l.alternate, e !== null && ya(
        e,
        l,
        n,
        !0
      ), l = ye.current, l !== null) {
        switch (l.tag) {
          case 31:
          case 13:
            return Ce === null ? Zu() : l.alternate === null && wt === 0 && (wt = 3), l.flags &= -257, l.flags |= 65536, l.lanes = n, a === bu ? l.flags |= 16384 : (e = l.updateQueue, e === null ? l.updateQueue = /* @__PURE__ */ new Set([a]) : e.add(a), gs(t, a, n)), !1;
          case 22:
            return l.flags |= 65536, a === bu ? l.flags |= 16384 : (e = l.updateQueue, e === null ? (e = {
              transitions: null,
              markerInstances: null,
              retryQueue: /* @__PURE__ */ new Set([a])
            }, l.updateQueue = e) : (l = e.retryQueue, l === null ? e.retryQueue = /* @__PURE__ */ new Set([a]) : l.add(a)), gs(t, a, n)), !1;
        }
        throw Error(r(435, l.tag));
      }
      return gs(t, a, n), Zu(), !1;
    }
    if (ft)
      return e = ye.current, e !== null ? ((e.flags & 65536) === 0 && (e.flags |= 256), e.flags |= 65536, e.lanes = n, a !== oc && (t = Error(r(422), { cause: a }), an(Oe(t, l)))) : (a !== oc && (e = Error(r(423), {
        cause: a
      }), an(
        Oe(e, l)
      )), t = t.current.alternate, t.flags |= 65536, n &= -n, t.lanes |= n, a = Oe(a, l), n = Vc(
        t.stateNode,
        a,
        n
      ), Ec(t, n), wt !== 4 && (wt = 2)), !1;
    var i = Error(r(520), { cause: a });
    if (i = Oe(i, l), An === null ? An = [i] : An.push(i), wt !== 4 && (wt = 2), e === null) return !0;
    a = Oe(a, l), l = e;
    do {
      switch (l.tag) {
        case 3:
          return l.flags |= 65536, t = n & -n, l.lanes |= t, t = Vc(l.stateNode, a, t), Ec(l, t), !1;
        case 1:
          if (e = l.type, i = l.stateNode, (l.flags & 128) === 0 && (typeof e.getDerivedStateFromError == "function" || i !== null && typeof i.componentDidCatch == "function" && (El === null || !El.has(i))))
            return l.flags |= 65536, n &= -n, l.lanes |= n, n = zf(n), xf(
              n,
              t,
              l,
              a
            ), Ec(l, n), !1;
      }
      l = l.return;
    } while (l !== null);
    return !1;
  }
  var Kc = Error(r(461)), Ht = !1;
  function kt(t, e, l, a) {
    e.child = t === null ? Ro(e, null, l, a) : Kl(
      e,
      t.child,
      l,
      a
    );
  }
  function Mf(t, e, l, a, n) {
    l = l.render;
    var i = e.ref;
    if ("ref" in a) {
      var s = {};
      for (var f in a)
        f !== "ref" && (s[f] = a[f]);
    } else s = a;
    return Gl(e), a = Mc(
      t,
      e,
      l,
      s,
      i,
      n
    ), f = Cc(), t !== null && !Ht ? (Rc(t, e, n), We(t, e, n)) : (ft && f && sc(e), e.flags |= 1, kt(t, e, a, n), e.child);
  }
  function Cf(t, e, l, a, n) {
    if (t === null) {
      var i = l.type;
      return typeof i == "function" && !uc(i) && i.defaultProps === void 0 && l.compare === null ? (e.tag = 15, e.type = i, Rf(
        t,
        e,
        i,
        a,
        n
      )) : (t = hu(
        l.type,
        null,
        a,
        e,
        e.mode,
        n
      ), t.ref = e.ref, t.return = e, e.child = t);
    }
    if (i = t.child, !ts(t, n)) {
      var s = i.memoizedProps;
      if (l = l.compare, l = l !== null ? l : tn, l(s, a) && t.ref === e.ref)
        return We(t, e, n);
    }
    return e.flags |= 1, t = Ze(i, a), t.ref = e.ref, t.return = e, e.child = t;
  }
  function Rf(t, e, l, a, n) {
    if (t !== null) {
      var i = t.memoizedProps;
      if (tn(i, a) && t.ref === e.ref)
        if (Ht = !1, e.pendingProps = a = i, ts(t, n))
          (t.flags & 131072) !== 0 && (Ht = !0);
        else
          return e.lanes = t.lanes, We(t, e, n);
    }
    return Jc(
      t,
      e,
      l,
      a,
      n
    );
  }
  function jf(t, e, l, a) {
    var n = a.children, i = t !== null ? t.memoizedState : null;
    if (t === null && e.stateNode === null && (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), a.mode === "hidden") {
      if ((e.flags & 128) !== 0) {
        if (i = i !== null ? i.baseLanes | l : l, t !== null) {
          for (a = e.child = t.child, n = 0; a !== null; )
            n = n | a.lanes | a.childLanes, a = a.sibling;
          a = n & ~i;
        } else a = 0, e.child = null;
        return wf(
          t,
          e,
          i,
          l,
          a
        );
      }
      if ((l & 536870912) !== 0)
        e.memoizedState = { baseLanes: 0, cachePool: null }, t !== null && pu(
          e,
          i !== null ? i.cachePool : null
        ), i !== null ? Do(e, i) : Ac(), _o(e);
      else
        return a = e.lanes = 536870912, wf(
          t,
          e,
          i !== null ? i.baseLanes | l : l,
          l,
          a
        );
    } else
      i !== null ? (pu(e, i.cachePool), Do(e, i), pl(), e.memoizedState = null) : (t !== null && pu(e, null), Ac(), pl());
    return kt(t, e, n, l), e.child;
  }
  function gn(t, e) {
    return t !== null && t.tag === 22 || e.stateNode !== null || (e.stateNode = {
      _visibility: 1,
      _pendingMarkers: null,
      _retryCache: null,
      _transitions: null
    }), e.sibling;
  }
  function wf(t, e, l, a, n) {
    var i = pc();
    return i = i === null ? null : { parent: Ut._currentValue, pool: i }, e.memoizedState = {
      baseLanes: l,
      cachePool: i
    }, t !== null && pu(e, null), Ac(), _o(e), t !== null && ya(t, e, a, !0), e.childLanes = n, null;
  }
  function _u(t, e) {
    return e = Uu(
      { mode: e.mode, children: e.children },
      t.mode
    ), e.ref = t.ref, t.child = e, e.return = t, e;
  }
  function Df(t, e, l) {
    return Kl(e, t.child, null, l), t = _u(e, e.pendingProps), t.flags |= 2, me(e), e.memoizedState = null, t;
  }
  function Um(t, e, l) {
    var a = e.pendingProps, n = (e.flags & 128) !== 0;
    if (e.flags &= -129, t === null) {
      if (ft) {
        if (a.mode === "hidden")
          return t = _u(e, a), e.lanes = 536870912, gn(null, t);
        if (zc(e), (t = Mt) ? (t = Zd(
          t,
          Me
        ), t = t !== null && t.data === "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: rl !== null ? { id: qe, overflow: He } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, l = yo(t), l.return = e, e.child = l, Kt = e, Mt = null)) : t = null, t === null) throw fl(e);
        return e.lanes = 536870912, null;
      }
      return _u(e, a);
    }
    var i = t.memoizedState;
    if (i !== null) {
      var s = i.dehydrated;
      if (zc(e), n)
        if (e.flags & 256)
          e.flags &= -257, e = Df(
            t,
            e,
            l
          );
        else if (e.memoizedState !== null)
          e.child = t.child, e.flags |= 128, e = null;
        else throw Error(r(558));
      else if (Ht || ya(t, e, l, !1), n = (l & t.childLanes) !== 0, Ht || n) {
        if (a = xt, a !== null && (s = Sr(a, l), s !== 0 && s !== i.retryLane))
          throw i.retryLane = s, Bl(t, s), se(a, t, s), Kc;
        Zu(), e = Df(
          t,
          e,
          l
        );
      } else
        t = i.treeContext, Mt = Re(s.nextSibling), Kt = e, ft = !0, ol = null, Me = !1, t !== null && po(e, t), e = _u(e, a), e.flags |= 4096;
      return e;
    }
    return t = Ze(t.child, {
      mode: a.mode,
      children: a.children
    }), t.ref = e.ref, e.child = t, t.return = e, t;
  }
  function Nu(t, e) {
    var l = e.ref;
    if (l === null)
      t !== null && t.ref !== null && (e.flags |= 4194816);
    else {
      if (typeof l != "function" && typeof l != "object")
        throw Error(r(284));
      (t === null || t.ref !== l) && (e.flags |= 4194816);
    }
  }
  function Jc(t, e, l, a, n) {
    return Gl(e), l = Mc(
      t,
      e,
      l,
      a,
      void 0,
      n
    ), a = Cc(), t !== null && !Ht ? (Rc(t, e, n), We(t, e, n)) : (ft && a && sc(e), e.flags |= 1, kt(t, e, l, n), e.child);
  }
  function _f(t, e, l, a, n, i) {
    return Gl(e), e.updateQueue = null, l = Uo(
      e,
      a,
      l,
      n
    ), No(t), a = Cc(), t !== null && !Ht ? (Rc(t, e, i), We(t, e, i)) : (ft && a && sc(e), e.flags |= 1, kt(t, e, l, i), e.child);
  }
  function Nf(t, e, l, a, n) {
    if (Gl(e), e.stateNode === null) {
      var i = oa, s = l.contextType;
      typeof s == "object" && s !== null && (i = Jt(s)), i = new l(a, i), e.memoizedState = i.state !== null && i.state !== void 0 ? i.state : null, i.updater = Zc, e.stateNode = i, i._reactInternals = e, i = e.stateNode, i.props = a, i.state = e.memoizedState, i.refs = {}, bc(e), s = l.contextType, i.context = typeof s == "object" && s !== null ? Jt(s) : oa, i.state = e.memoizedState, s = l.getDerivedStateFromProps, typeof s == "function" && (Xc(
        e,
        l,
        s,
        a
      ), i.state = e.memoizedState), typeof l.getDerivedStateFromProps == "function" || typeof i.getSnapshotBeforeUpdate == "function" || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (s = i.state, typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount(), s !== i.state && Zc.enqueueReplaceState(i, i.state, null), fn(e, a, i, n), on(), i.state = e.memoizedState), typeof i.componentDidMount == "function" && (e.flags |= 4194308), a = !0;
    } else if (t === null) {
      i = e.stateNode;
      var f = e.memoizedProps, h = kl(l, f);
      i.props = h;
      var A = i.context, C = l.contextType;
      s = oa, typeof C == "object" && C !== null && (s = Jt(C));
      var D = l.getDerivedStateFromProps;
      C = typeof D == "function" || typeof i.getSnapshotBeforeUpdate == "function", f = e.pendingProps !== f, C || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (f || A !== s) && Sf(
        e,
        i,
        a,
        s
      ), hl = !1;
      var z = e.memoizedState;
      i.state = z, fn(e, a, i, n), on(), A = e.memoizedState, f || z !== A || hl ? (typeof D == "function" && (Xc(
        e,
        l,
        D,
        a
      ), A = e.memoizedState), (h = hl || bf(
        e,
        l,
        h,
        a,
        z,
        A,
        s
      )) ? (C || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount()), typeof i.componentDidMount == "function" && (e.flags |= 4194308)) : (typeof i.componentDidMount == "function" && (e.flags |= 4194308), e.memoizedProps = a, e.memoizedState = A), i.props = a, i.state = A, i.context = s, a = h) : (typeof i.componentDidMount == "function" && (e.flags |= 4194308), a = !1);
    } else {
      i = e.stateNode, Sc(t, e), s = e.memoizedProps, C = kl(l, s), i.props = C, D = e.pendingProps, z = i.context, A = l.contextType, h = oa, typeof A == "object" && A !== null && (h = Jt(A)), f = l.getDerivedStateFromProps, (A = typeof f == "function" || typeof i.getSnapshotBeforeUpdate == "function") || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (s !== D || z !== h) && Sf(
        e,
        i,
        a,
        h
      ), hl = !1, z = e.memoizedState, i.state = z, fn(e, a, i, n), on();
      var x = e.memoizedState;
      s !== D || z !== x || hl || t !== null && t.dependencies !== null && mu(t.dependencies) ? (typeof f == "function" && (Xc(
        e,
        l,
        f,
        a
      ), x = e.memoizedState), (C = hl || bf(
        e,
        l,
        C,
        a,
        z,
        x,
        h
      ) || t !== null && t.dependencies !== null && mu(t.dependencies)) ? (A || typeof i.UNSAFE_componentWillUpdate != "function" && typeof i.componentWillUpdate != "function" || (typeof i.componentWillUpdate == "function" && i.componentWillUpdate(a, x, h), typeof i.UNSAFE_componentWillUpdate == "function" && i.UNSAFE_componentWillUpdate(
        a,
        x,
        h
      )), typeof i.componentDidUpdate == "function" && (e.flags |= 4), typeof i.getSnapshotBeforeUpdate == "function" && (e.flags |= 1024)) : (typeof i.componentDidUpdate != "function" || s === t.memoizedProps && z === t.memoizedState || (e.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || s === t.memoizedProps && z === t.memoizedState || (e.flags |= 1024), e.memoizedProps = a, e.memoizedState = x), i.props = a, i.state = x, i.context = h, a = C) : (typeof i.componentDidUpdate != "function" || s === t.memoizedProps && z === t.memoizedState || (e.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || s === t.memoizedProps && z === t.memoizedState || (e.flags |= 1024), a = !1);
    }
    return i = a, Nu(t, e), a = (e.flags & 128) !== 0, i || a ? (i = e.stateNode, l = a && typeof l.getDerivedStateFromError != "function" ? null : i.render(), e.flags |= 1, t !== null && a ? (e.child = Kl(
      e,
      t.child,
      null,
      n
    ), e.child = Kl(
      e,
      null,
      l,
      n
    )) : kt(t, e, l, n), e.memoizedState = i.state, t = e.child) : t = We(
      t,
      e,
      n
    ), t;
  }
  function Uf(t, e, l, a) {
    return Ql(), e.flags |= 256, kt(t, e, l, a), e.child;
  }
  var kc = {
    dehydrated: null,
    treeContext: null,
    retryLane: 0,
    hydrationErrors: null
  };
  function Fc(t) {
    return { baseLanes: t, cachePool: Ao() };
  }
  function Wc(t, e, l) {
    return t = t !== null ? t.childLanes & ~l : 0, e && (t |= pe), t;
  }
  function qf(t, e, l) {
    var a = e.pendingProps, n = !1, i = (e.flags & 128) !== 0, s;
    if ((s = i) || (s = t !== null && t.memoizedState === null ? !1 : (_t.current & 2) !== 0), s && (n = !0, e.flags &= -129), s = (e.flags & 32) !== 0, e.flags &= -33, t === null) {
      if (ft) {
        if (n ? gl(e) : pl(), (t = Mt) ? (t = Zd(
          t,
          Me
        ), t = t !== null && t.data !== "&" ? t : null, t !== null && (e.memoizedState = {
          dehydrated: t,
          treeContext: rl !== null ? { id: qe, overflow: He } : null,
          retryLane: 536870912,
          hydrationErrors: null
        }, l = yo(t), l.return = e, e.child = l, Kt = e, Mt = null)) : t = null, t === null) throw fl(e);
        return Ds(t) ? e.lanes = 32 : e.lanes = 536870912, null;
      }
      var f = a.children;
      return a = a.fallback, n ? (pl(), n = e.mode, f = Uu(
        { mode: "hidden", children: f },
        n
      ), a = Ll(
        a,
        n,
        l,
        null
      ), f.return = e, a.return = e, f.sibling = a, e.child = f, a = e.child, a.memoizedState = Fc(l), a.childLanes = Wc(
        t,
        s,
        l
      ), e.memoizedState = kc, gn(null, a)) : (gl(e), $c(e, f));
    }
    var h = t.memoizedState;
    if (h !== null && (f = h.dehydrated, f !== null)) {
      if (i)
        e.flags & 256 ? (gl(e), e.flags &= -257, e = Ic(
          t,
          e,
          l
        )) : e.memoizedState !== null ? (pl(), e.child = t.child, e.flags |= 128, e = null) : (pl(), f = a.fallback, n = e.mode, a = Uu(
          { mode: "visible", children: a.children },
          n
        ), f = Ll(
          f,
          n,
          l,
          null
        ), f.flags |= 2, a.return = e, f.return = e, a.sibling = f, e.child = a, Kl(
          e,
          t.child,
          null,
          l
        ), a = e.child, a.memoizedState = Fc(l), a.childLanes = Wc(
          t,
          s,
          l
        ), e.memoizedState = kc, e = gn(null, a));
      else if (gl(e), Ds(f)) {
        if (s = f.nextSibling && f.nextSibling.dataset, s) var A = s.dgst;
        s = A, a = Error(r(419)), a.stack = "", a.digest = s, an({ value: a, source: null, stack: null }), e = Ic(
          t,
          e,
          l
        );
      } else if (Ht || ya(t, e, l, !1), s = (l & t.childLanes) !== 0, Ht || s) {
        if (s = xt, s !== null && (a = Sr(s, l), a !== 0 && a !== h.retryLane))
          throw h.retryLane = a, Bl(t, a), se(s, t, a), Kc;
        ws(f) || Zu(), e = Ic(
          t,
          e,
          l
        );
      } else
        ws(f) ? (e.flags |= 192, e.child = t.child, e = null) : (t = h.treeContext, Mt = Re(
          f.nextSibling
        ), Kt = e, ft = !0, ol = null, Me = !1, t !== null && po(e, t), e = $c(
          e,
          a.children
        ), e.flags |= 4096);
      return e;
    }
    return n ? (pl(), f = a.fallback, n = e.mode, h = t.child, A = h.sibling, a = Ze(h, {
      mode: "hidden",
      children: a.children
    }), a.subtreeFlags = h.subtreeFlags & 65011712, A !== null ? f = Ze(
      A,
      f
    ) : (f = Ll(
      f,
      n,
      l,
      null
    ), f.flags |= 2), f.return = e, a.return = e, a.sibling = f, e.child = a, gn(null, a), a = e.child, f = t.child.memoizedState, f === null ? f = Fc(l) : (n = f.cachePool, n !== null ? (h = Ut._currentValue, n = n.parent !== h ? { parent: h, pool: h } : n) : n = Ao(), f = {
      baseLanes: f.baseLanes | l,
      cachePool: n
    }), a.memoizedState = f, a.childLanes = Wc(
      t,
      s,
      l
    ), e.memoizedState = kc, gn(t.child, a)) : (gl(e), l = t.child, t = l.sibling, l = Ze(l, {
      mode: "visible",
      children: a.children
    }), l.return = e, l.sibling = null, t !== null && (s = e.deletions, s === null ? (e.deletions = [t], e.flags |= 16) : s.push(t)), e.child = l, e.memoizedState = null, l);
  }
  function $c(t, e) {
    return e = Uu(
      { mode: "visible", children: e },
      t.mode
    ), e.return = t, t.child = e;
  }
  function Uu(t, e) {
    return t = he(22, t, null, e), t.lanes = 0, t;
  }
  function Ic(t, e, l) {
    return Kl(e, t.child, null, l), t = $c(
      e,
      e.pendingProps.children
    ), t.flags |= 2, e.memoizedState = null, t;
  }
  function Hf(t, e, l) {
    t.lanes |= e;
    var a = t.alternate;
    a !== null && (a.lanes |= e), hc(t.return, e, l);
  }
  function Pc(t, e, l, a, n, i) {
    var s = t.memoizedState;
    s === null ? t.memoizedState = {
      isBackwards: e,
      rendering: null,
      renderingStartTime: 0,
      last: a,
      tail: l,
      tailMode: n,
      treeForkCount: i
    } : (s.isBackwards = e, s.rendering = null, s.renderingStartTime = 0, s.last = a, s.tail = l, s.tailMode = n, s.treeForkCount = i);
  }
  function Bf(t, e, l) {
    var a = e.pendingProps, n = a.revealOrder, i = a.tail;
    a = a.children;
    var s = _t.current, f = (s & 2) !== 0;
    if (f ? (s = s & 1 | 2, e.flags |= 128) : s &= 1, B(_t, s), kt(t, e, a, l), a = ft ? ln : 0, !f && t !== null && (t.flags & 128) !== 0)
      t: for (t = e.child; t !== null; ) {
        if (t.tag === 13)
          t.memoizedState !== null && Hf(t, l, e);
        else if (t.tag === 19)
          Hf(t, l, e);
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
          t = l.alternate, t !== null && Au(t) === null && (n = l), l = l.sibling;
        l = n, l === null ? (n = e.child, e.child = null) : (n = l.sibling, l.sibling = null), Pc(
          e,
          !1,
          n,
          l,
          i,
          a
        );
        break;
      case "backwards":
      case "unstable_legacy-backwards":
        for (l = null, n = e.child, e.child = null; n !== null; ) {
          if (t = n.alternate, t !== null && Au(t) === null) {
            e.child = n;
            break;
          }
          t = n.sibling, n.sibling = l, l = n, n = t;
        }
        Pc(
          e,
          !0,
          l,
          null,
          i,
          a
        );
        break;
      case "together":
        Pc(
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
  function We(t, e, l) {
    if (t !== null && (e.dependencies = t.dependencies), Sl |= e.lanes, (l & e.childLanes) === 0)
      if (t !== null) {
        if (ya(
          t,
          e,
          l,
          !1
        ), (l & e.childLanes) === 0)
          return null;
      } else return null;
    if (t !== null && e.child !== t.child)
      throw Error(r(153));
    if (e.child !== null) {
      for (t = e.child, l = Ze(t, t.pendingProps), e.child = l, l.return = e; t.sibling !== null; )
        t = t.sibling, l = l.sibling = Ze(t, t.pendingProps), l.return = e;
      l.sibling = null;
    }
    return e.child;
  }
  function ts(t, e) {
    return (t.lanes & e) !== 0 ? !0 : (t = t.dependencies, !!(t !== null && mu(t)));
  }
  function qm(t, e, l) {
    switch (e.tag) {
      case 3:
        It(e, e.stateNode.containerInfo), dl(e, Ut, t.memoizedState.cache), Ql();
        break;
      case 27:
      case 5:
        Ya(e);
        break;
      case 4:
        It(e, e.stateNode.containerInfo);
        break;
      case 10:
        dl(
          e,
          e.type,
          e.memoizedProps.value
        );
        break;
      case 31:
        if (e.memoizedState !== null)
          return e.flags |= 128, zc(e), null;
        break;
      case 13:
        var a = e.memoizedState;
        if (a !== null)
          return a.dehydrated !== null ? (gl(e), e.flags |= 128, null) : (l & e.child.childLanes) !== 0 ? qf(t, e, l) : (gl(e), t = We(
            t,
            e,
            l
          ), t !== null ? t.sibling : null);
        gl(e);
        break;
      case 19:
        var n = (t.flags & 128) !== 0;
        if (a = (l & e.childLanes) !== 0, a || (ya(
          t,
          e,
          l,
          !1
        ), a = (l & e.childLanes) !== 0), n) {
          if (a)
            return Bf(
              t,
              e,
              l
            );
          e.flags |= 128;
        }
        if (n = e.memoizedState, n !== null && (n.rendering = null, n.tail = null, n.lastEffect = null), B(_t, _t.current), a) break;
        return null;
      case 22:
        return e.lanes = 0, jf(
          t,
          e,
          l,
          e.pendingProps
        );
      case 24:
        dl(e, Ut, t.memoizedState.cache);
    }
    return We(t, e, l);
  }
  function Lf(t, e, l) {
    if (t !== null)
      if (t.memoizedProps !== e.pendingProps)
        Ht = !0;
      else {
        if (!ts(t, l) && (e.flags & 128) === 0)
          return Ht = !1, qm(
            t,
            e,
            l
          );
        Ht = (t.flags & 131072) !== 0;
      }
    else
      Ht = !1, ft && (e.flags & 1048576) !== 0 && go(e, ln, e.index);
    switch (e.lanes = 0, e.tag) {
      case 16:
        t: {
          var a = e.pendingProps;
          if (t = Zl(e.elementType), e.type = t, typeof t == "function")
            uc(t) ? (a = kl(t, a), e.tag = 1, e = Nf(
              null,
              e,
              t,
              a,
              l
            )) : (e.tag = 0, e = Jc(
              null,
              e,
              t,
              a,
              l
            ));
          else {
            if (t != null) {
              var n = t.$$typeof;
              if (n === ht) {
                e.tag = 11, e = Mf(
                  null,
                  e,
                  t,
                  a,
                  l
                );
                break t;
              } else if (n === Y) {
                e.tag = 14, e = Cf(
                  null,
                  e,
                  t,
                  a,
                  l
                );
                break t;
              }
            }
            throw e = $t(t) || t, Error(r(306, e, ""));
          }
        }
        return e;
      case 0:
        return Jc(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 1:
        return a = e.type, n = kl(
          a,
          e.pendingProps
        ), Nf(
          t,
          e,
          a,
          n,
          l
        );
      case 3:
        t: {
          if (It(
            e,
            e.stateNode.containerInfo
          ), t === null) throw Error(r(387));
          a = e.pendingProps;
          var i = e.memoizedState;
          n = i.element, Sc(t, e), fn(e, a, null, l);
          var s = e.memoizedState;
          if (a = s.cache, dl(e, Ut, a), a !== i.cache && yc(
            e,
            [Ut],
            l,
            !0
          ), on(), a = s.element, i.isDehydrated)
            if (i = {
              element: a,
              isDehydrated: !1,
              cache: s.cache
            }, e.updateQueue.baseState = i, e.memoizedState = i, e.flags & 256) {
              e = Uf(
                t,
                e,
                a,
                l
              );
              break t;
            } else if (a !== n) {
              n = Oe(
                Error(r(424)),
                e
              ), an(n), e = Uf(
                t,
                e,
                a,
                l
              );
              break t;
            } else
              for (t = e.stateNode.containerInfo, t.nodeType === 9 ? t = t.body : t = t.nodeName === "HTML" ? t.ownerDocument.body : t, Mt = Re(t.firstChild), Kt = e, ft = !0, ol = null, Me = !0, l = Ro(
                e,
                null,
                a,
                l
              ), e.child = l; l; )
                l.flags = l.flags & -3 | 4096, l = l.sibling;
          else {
            if (Ql(), a === n) {
              e = We(
                t,
                e,
                l
              );
              break t;
            }
            kt(t, e, a, l);
          }
          e = e.child;
        }
        return e;
      case 26:
        return Nu(t, e), t === null ? (l = Wd(
          e.type,
          null,
          e.pendingProps,
          null
        )) ? e.memoizedState = l : ft || (l = e.type, t = e.pendingProps, a = $u(
          ut.current
        ).createElement(l), a[Vt] = e, a[le] = t, Ft(a, l, t), Gt(a), e.stateNode = a) : e.memoizedState = Wd(
          e.type,
          t.memoizedProps,
          e.pendingProps,
          t.memoizedState
        ), null;
      case 27:
        return Ya(e), t === null && ft && (a = e.stateNode = Jd(
          e.type,
          e.pendingProps,
          ut.current
        ), Kt = e, Me = !0, n = Mt, zl(e.type) ? (_s = n, Mt = Re(a.firstChild)) : Mt = n), kt(
          t,
          e,
          e.pendingProps.children,
          l
        ), Nu(t, e), t === null && (e.flags |= 4194304), e.child;
      case 5:
        return t === null && ft && ((n = a = Mt) && (a = dg(
          a,
          e.type,
          e.pendingProps,
          Me
        ), a !== null ? (e.stateNode = a, Kt = e, Mt = Re(a.firstChild), Me = !1, n = !0) : n = !1), n || fl(e)), Ya(e), n = e.type, i = e.pendingProps, s = t !== null ? t.memoizedProps : null, a = i.children, Cs(n, i) ? a = null : s !== null && Cs(n, s) && (e.flags |= 32), e.memoizedState !== null && (n = Mc(
          t,
          e,
          Mm,
          null,
          null,
          l
        ), wn._currentValue = n), Nu(t, e), kt(t, e, a, l), e.child;
      case 6:
        return t === null && ft && ((t = l = Mt) && (l = hg(
          l,
          e.pendingProps,
          Me
        ), l !== null ? (e.stateNode = l, Kt = e, Mt = null, t = !0) : t = !1), t || fl(e)), null;
      case 13:
        return qf(t, e, l);
      case 4:
        return It(
          e,
          e.stateNode.containerInfo
        ), a = e.pendingProps, t === null ? e.child = Kl(
          e,
          null,
          a,
          l
        ) : kt(t, e, a, l), e.child;
      case 11:
        return Mf(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 7:
        return kt(
          t,
          e,
          e.pendingProps,
          l
        ), e.child;
      case 8:
        return kt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 12:
        return kt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 10:
        return a = e.pendingProps, dl(e, e.type, a.value), kt(t, e, a.children, l), e.child;
      case 9:
        return n = e.type._context, a = e.pendingProps.children, Gl(e), n = Jt(n), a = a(n), e.flags |= 1, kt(t, e, a, l), e.child;
      case 14:
        return Cf(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 15:
        return Rf(
          t,
          e,
          e.type,
          e.pendingProps,
          l
        );
      case 19:
        return Bf(t, e, l);
      case 31:
        return Um(t, e, l);
      case 22:
        return jf(
          t,
          e,
          l,
          e.pendingProps
        );
      case 24:
        return Gl(e), a = Jt(Ut), t === null ? (n = pc(), n === null && (n = xt, i = mc(), n.pooledCache = i, i.refCount++, i !== null && (n.pooledCacheLanes |= l), n = i), e.memoizedState = { parent: a, cache: n }, bc(e), dl(e, Ut, n)) : ((t.lanes & l) !== 0 && (Sc(t, e), fn(e, null, null, l), on()), n = t.memoizedState, i = e.memoizedState, n.parent !== a ? (n = { parent: a, cache: a }, e.memoizedState = n, e.lanes === 0 && (e.memoizedState = e.updateQueue.baseState = n), dl(e, Ut, a)) : (a = i.cache, dl(e, Ut, a), a !== n.cache && yc(
          e,
          [Ut],
          l,
          !0
        ))), kt(
          t,
          e,
          e.pendingProps.children,
          l
        ), e.child;
      case 29:
        throw e.pendingProps;
    }
    throw Error(r(156, e.tag));
  }
  function $e(t) {
    t.flags |= 4;
  }
  function es(t, e, l, a, n) {
    if ((e = (t.mode & 32) !== 0) && (e = !1), e) {
      if (t.flags |= 16777216, (n & 335544128) === n)
        if (t.stateNode.complete) t.flags |= 8192;
        else if (dd()) t.flags |= 8192;
        else
          throw Vl = bu, vc;
    } else t.flags &= -16777217;
  }
  function Qf(t, e) {
    if (e.type !== "stylesheet" || (e.state.loading & 4) !== 0)
      t.flags &= -16777217;
    else if (t.flags |= 16777216, !eh(e))
      if (dd()) t.flags |= 8192;
      else
        throw Vl = bu, vc;
  }
  function qu(t, e) {
    e !== null && (t.flags |= 4), t.flags & 16384 && (e = t.tag !== 22 ? pr() : 536870912, t.lanes |= e, xa |= e);
  }
  function pn(t, e) {
    if (!ft)
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
  function Ct(t) {
    var e = t.alternate !== null && t.alternate.child === t.child, l = 0, a = 0;
    if (e)
      for (var n = t.child; n !== null; )
        l |= n.lanes | n.childLanes, a |= n.subtreeFlags & 65011712, a |= n.flags & 65011712, n.return = t, n = n.sibling;
    else
      for (n = t.child; n !== null; )
        l |= n.lanes | n.childLanes, a |= n.subtreeFlags, a |= n.flags, n.return = t, n = n.sibling;
    return t.subtreeFlags |= a, t.childLanes = l, e;
  }
  function Hm(t, e, l) {
    var a = e.pendingProps;
    switch (rc(e), e.tag) {
      case 16:
      case 15:
      case 0:
      case 11:
      case 7:
      case 8:
      case 12:
      case 9:
      case 14:
        return Ct(e), null;
      case 1:
        return Ct(e), null;
      case 3:
        return l = e.stateNode, a = null, t !== null && (a = t.memoizedState.cache), e.memoizedState.cache !== a && (e.flags |= 2048), Je(Ut), Dt(), l.pendingContext && (l.context = l.pendingContext, l.pendingContext = null), (t === null || t.child === null) && (ha(e) ? $e(e) : t === null || t.memoizedState.isDehydrated && (e.flags & 256) === 0 || (e.flags |= 1024, fc())), Ct(e), null;
      case 26:
        var n = e.type, i = e.memoizedState;
        return t === null ? ($e(e), i !== null ? (Ct(e), Qf(e, i)) : (Ct(e), es(
          e,
          n,
          null,
          a,
          l
        ))) : i ? i !== t.memoizedState ? ($e(e), Ct(e), Qf(e, i)) : (Ct(e), e.flags &= -16777217) : (t = t.memoizedProps, t !== a && $e(e), Ct(e), es(
          e,
          n,
          t,
          a,
          l
        )), null;
      case 27:
        if (Jn(e), l = ut.current, n = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== a && $e(e);
        else {
          if (!a) {
            if (e.stateNode === null)
              throw Error(r(166));
            return Ct(e), null;
          }
          t = G.current, ha(e) ? vo(e) : (t = Jd(n, a, l), e.stateNode = t, $e(e));
        }
        return Ct(e), null;
      case 5:
        if (Jn(e), n = e.type, t !== null && e.stateNode != null)
          t.memoizedProps !== a && $e(e);
        else {
          if (!a) {
            if (e.stateNode === null)
              throw Error(r(166));
            return Ct(e), null;
          }
          if (i = G.current, ha(e))
            vo(e);
          else {
            var s = $u(
              ut.current
            );
            switch (i) {
              case 1:
                i = s.createElementNS(
                  "http://www.w3.org/2000/svg",
                  n
                );
                break;
              case 2:
                i = s.createElementNS(
                  "http://www.w3.org/1998/Math/MathML",
                  n
                );
                break;
              default:
                switch (n) {
                  case "svg":
                    i = s.createElementNS(
                      "http://www.w3.org/2000/svg",
                      n
                    );
                    break;
                  case "math":
                    i = s.createElementNS(
                      "http://www.w3.org/1998/Math/MathML",
                      n
                    );
                    break;
                  case "script":
                    i = s.createElement("div"), i.innerHTML = "<script><\/script>", i = i.removeChild(
                      i.firstChild
                    );
                    break;
                  case "select":
                    i = typeof a.is == "string" ? s.createElement("select", {
                      is: a.is
                    }) : s.createElement("select"), a.multiple ? i.multiple = !0 : a.size && (i.size = a.size);
                    break;
                  default:
                    i = typeof a.is == "string" ? s.createElement(n, { is: a.is }) : s.createElement(n);
                }
            }
            i[Vt] = e, i[le] = a;
            t: for (s = e.child; s !== null; ) {
              if (s.tag === 5 || s.tag === 6)
                i.appendChild(s.stateNode);
              else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
                s.child.return = s, s = s.child;
                continue;
              }
              if (s === e) break t;
              for (; s.sibling === null; ) {
                if (s.return === null || s.return === e)
                  break t;
                s = s.return;
              }
              s.sibling.return = s.return, s = s.sibling;
            }
            e.stateNode = i;
            t: switch (Ft(i, n, a), n) {
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
            a && $e(e);
          }
        }
        return Ct(e), es(
          e,
          e.type,
          t === null ? null : t.memoizedProps,
          e.pendingProps,
          l
        ), null;
      case 6:
        if (t && e.stateNode != null)
          t.memoizedProps !== a && $e(e);
        else {
          if (typeof a != "string" && e.stateNode === null)
            throw Error(r(166));
          if (t = ut.current, ha(e)) {
            if (t = e.stateNode, l = e.memoizedProps, a = null, n = Kt, n !== null)
              switch (n.tag) {
                case 27:
                case 5:
                  a = n.memoizedProps;
              }
            t[Vt] = e, t = !!(t.nodeValue === l || a !== null && a.suppressHydrationWarning === !0 || qd(t.nodeValue, l)), t || fl(e, !0);
          } else
            t = $u(t).createTextNode(
              a
            ), t[Vt] = e, e.stateNode = t;
        }
        return Ct(e), null;
      case 31:
        if (l = e.memoizedState, t === null || t.memoizedState !== null) {
          if (a = ha(e), l !== null) {
            if (t === null) {
              if (!a) throw Error(r(318));
              if (t = e.memoizedState, t = t !== null ? t.dehydrated : null, !t) throw Error(r(557));
              t[Vt] = e;
            } else
              Ql(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Ct(e), t = !1;
          } else
            l = fc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = l), t = !0;
          if (!t)
            return e.flags & 256 ? (me(e), e) : (me(e), null);
          if ((e.flags & 128) !== 0)
            throw Error(r(558));
        }
        return Ct(e), null;
      case 13:
        if (a = e.memoizedState, t === null || t.memoizedState !== null && t.memoizedState.dehydrated !== null) {
          if (n = ha(e), a !== null && a.dehydrated !== null) {
            if (t === null) {
              if (!n) throw Error(r(318));
              if (n = e.memoizedState, n = n !== null ? n.dehydrated : null, !n) throw Error(r(317));
              n[Vt] = e;
            } else
              Ql(), (e.flags & 128) === 0 && (e.memoizedState = null), e.flags |= 4;
            Ct(e), n = !1;
          } else
            n = fc(), t !== null && t.memoizedState !== null && (t.memoizedState.hydrationErrors = n), n = !0;
          if (!n)
            return e.flags & 256 ? (me(e), e) : (me(e), null);
        }
        return me(e), (e.flags & 128) !== 0 ? (e.lanes = l, e) : (l = a !== null, t = t !== null && t.memoizedState !== null, l && (a = e.child, n = null, a.alternate !== null && a.alternate.memoizedState !== null && a.alternate.memoizedState.cachePool !== null && (n = a.alternate.memoizedState.cachePool.pool), i = null, a.memoizedState !== null && a.memoizedState.cachePool !== null && (i = a.memoizedState.cachePool.pool), i !== n && (a.flags |= 2048)), l !== t && l && (e.child.flags |= 8192), qu(e, e.updateQueue), Ct(e), null);
      case 4:
        return Dt(), t === null && As(e.stateNode.containerInfo), Ct(e), null;
      case 10:
        return Je(e.type), Ct(e), null;
      case 19:
        if (R(_t), a = e.memoizedState, a === null) return Ct(e), null;
        if (n = (e.flags & 128) !== 0, i = a.rendering, i === null)
          if (n) pn(a, !1);
          else {
            if (wt !== 0 || t !== null && (t.flags & 128) !== 0)
              for (t = e.child; t !== null; ) {
                if (i = Au(t), i !== null) {
                  for (e.flags |= 128, pn(a, !1), t = i.updateQueue, e.updateQueue = t, qu(e, t), e.subtreeFlags = 0, t = l, l = e.child; l !== null; )
                    ho(l, t), l = l.sibling;
                  return B(
                    _t,
                    _t.current & 1 | 2
                  ), ft && Ve(e, a.treeForkCount), e.child;
                }
                t = t.sibling;
              }
            a.tail !== null && re() > Yu && (e.flags |= 128, n = !0, pn(a, !1), e.lanes = 4194304);
          }
        else {
          if (!n)
            if (t = Au(i), t !== null) {
              if (e.flags |= 128, n = !0, t = t.updateQueue, e.updateQueue = t, qu(e, t), pn(a, !0), a.tail === null && a.tailMode === "hidden" && !i.alternate && !ft)
                return Ct(e), null;
            } else
              2 * re() - a.renderingStartTime > Yu && l !== 536870912 && (e.flags |= 128, n = !0, pn(a, !1), e.lanes = 4194304);
          a.isBackwards ? (i.sibling = e.child, e.child = i) : (t = a.last, t !== null ? t.sibling = i : e.child = i, a.last = i);
        }
        return a.tail !== null ? (t = a.tail, a.rendering = t, a.tail = t.sibling, a.renderingStartTime = re(), t.sibling = null, l = _t.current, B(
          _t,
          n ? l & 1 | 2 : l & 1
        ), ft && Ve(e, a.treeForkCount), t) : (Ct(e), null);
      case 22:
      case 23:
        return me(e), Oc(), a = e.memoizedState !== null, t !== null ? t.memoizedState !== null !== a && (e.flags |= 8192) : a && (e.flags |= 8192), a ? (l & 536870912) !== 0 && (e.flags & 128) === 0 && (Ct(e), e.subtreeFlags & 6 && (e.flags |= 8192)) : Ct(e), l = e.updateQueue, l !== null && qu(e, l.retryQueue), l = null, t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), a = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (a = e.memoizedState.cachePool.pool), a !== l && (e.flags |= 2048), t !== null && R(Xl), null;
      case 24:
        return l = null, t !== null && (l = t.memoizedState.cache), e.memoizedState.cache !== l && (e.flags |= 2048), Je(Ut), Ct(e), null;
      case 25:
        return null;
      case 30:
        return null;
    }
    throw Error(r(156, e.tag));
  }
  function Bm(t, e) {
    switch (rc(e), e.tag) {
      case 1:
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 3:
        return Je(Ut), Dt(), t = e.flags, (t & 65536) !== 0 && (t & 128) === 0 ? (e.flags = t & -65537 | 128, e) : null;
      case 26:
      case 27:
      case 5:
        return Jn(e), null;
      case 31:
        if (e.memoizedState !== null) {
          if (me(e), e.alternate === null)
            throw Error(r(340));
          Ql();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 13:
        if (me(e), t = e.memoizedState, t !== null && t.dehydrated !== null) {
          if (e.alternate === null)
            throw Error(r(340));
          Ql();
        }
        return t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 19:
        return R(_t), null;
      case 4:
        return Dt(), null;
      case 10:
        return Je(e.type), null;
      case 22:
      case 23:
        return me(e), Oc(), t !== null && R(Xl), t = e.flags, t & 65536 ? (e.flags = t & -65537 | 128, e) : null;
      case 24:
        return Je(Ut), null;
      case 25:
        return null;
      default:
        return null;
    }
  }
  function Yf(t, e) {
    switch (rc(e), e.tag) {
      case 3:
        Je(Ut), Dt();
        break;
      case 26:
      case 27:
      case 5:
        Jn(e);
        break;
      case 4:
        Dt();
        break;
      case 31:
        e.memoizedState !== null && me(e);
        break;
      case 13:
        me(e);
        break;
      case 19:
        R(_t);
        break;
      case 10:
        Je(e.type);
        break;
      case 22:
      case 23:
        me(e), Oc(), t !== null && R(Xl);
        break;
      case 24:
        Je(Ut);
    }
  }
  function vn(t, e) {
    try {
      var l = e.updateQueue, a = l !== null ? l.lastEffect : null;
      if (a !== null) {
        var n = a.next;
        l = n;
        do {
          if ((l.tag & t) === t) {
            a = void 0;
            var i = l.create, s = l.inst;
            a = i(), s.destroy = a;
          }
          l = l.next;
        } while (l !== n);
      }
    } catch (f) {
      Tt(e, e.return, f);
    }
  }
  function vl(t, e, l) {
    try {
      var a = e.updateQueue, n = a !== null ? a.lastEffect : null;
      if (n !== null) {
        var i = n.next;
        a = i;
        do {
          if ((a.tag & t) === t) {
            var s = a.inst, f = s.destroy;
            if (f !== void 0) {
              s.destroy = void 0, n = e;
              var h = l, A = f;
              try {
                A();
              } catch (C) {
                Tt(
                  n,
                  h,
                  C
                );
              }
            }
          }
          a = a.next;
        } while (a !== i);
      }
    } catch (C) {
      Tt(e, e.return, C);
    }
  }
  function Gf(t) {
    var e = t.updateQueue;
    if (e !== null) {
      var l = t.stateNode;
      try {
        wo(e, l);
      } catch (a) {
        Tt(t, t.return, a);
      }
    }
  }
  function Xf(t, e, l) {
    l.props = kl(
      t.type,
      t.memoizedProps
    ), l.state = t.memoizedState;
    try {
      l.componentWillUnmount();
    } catch (a) {
      Tt(t, e, a);
    }
  }
  function bn(t, e) {
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
      Tt(t, e, n);
    }
  }
  function Be(t, e) {
    var l = t.ref, a = t.refCleanup;
    if (l !== null)
      if (typeof a == "function")
        try {
          a();
        } catch (n) {
          Tt(t, e, n);
        } finally {
          t.refCleanup = null, t = t.alternate, t != null && (t.refCleanup = null);
        }
      else if (typeof l == "function")
        try {
          l(null);
        } catch (n) {
          Tt(t, e, n);
        }
      else l.current = null;
  }
  function Zf(t) {
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
      Tt(t, t.return, n);
    }
  }
  function ls(t, e, l) {
    try {
      var a = t.stateNode;
      ig(a, t.type, l, e), a[le] = e;
    } catch (n) {
      Tt(t, t.return, n);
    }
  }
  function Vf(t) {
    return t.tag === 5 || t.tag === 3 || t.tag === 26 || t.tag === 27 && zl(t.type) || t.tag === 4;
  }
  function as(t) {
    t: for (; ; ) {
      for (; t.sibling === null; ) {
        if (t.return === null || Vf(t.return)) return null;
        t = t.return;
      }
      for (t.sibling.return = t.return, t = t.sibling; t.tag !== 5 && t.tag !== 6 && t.tag !== 18; ) {
        if (t.tag === 27 && zl(t.type) || t.flags & 2 || t.child === null || t.tag === 4) continue t;
        t.child.return = t, t = t.child;
      }
      if (!(t.flags & 2)) return t.stateNode;
    }
  }
  function ns(t, e, l) {
    var a = t.tag;
    if (a === 5 || a === 6)
      t = t.stateNode, e ? (l.nodeType === 9 ? l.body : l.nodeName === "HTML" ? l.ownerDocument.body : l).insertBefore(t, e) : (e = l.nodeType === 9 ? l.body : l.nodeName === "HTML" ? l.ownerDocument.body : l, e.appendChild(t), l = l._reactRootContainer, l != null || e.onclick !== null || (e.onclick = Ge));
    else if (a !== 4 && (a === 27 && zl(t.type) && (l = t.stateNode, e = null), t = t.child, t !== null))
      for (ns(t, e, l), t = t.sibling; t !== null; )
        ns(t, e, l), t = t.sibling;
  }
  function Hu(t, e, l) {
    var a = t.tag;
    if (a === 5 || a === 6)
      t = t.stateNode, e ? l.insertBefore(t, e) : l.appendChild(t);
    else if (a !== 4 && (a === 27 && zl(t.type) && (l = t.stateNode), t = t.child, t !== null))
      for (Hu(t, e, l), t = t.sibling; t !== null; )
        Hu(t, e, l), t = t.sibling;
  }
  function Kf(t) {
    var e = t.stateNode, l = t.memoizedProps;
    try {
      for (var a = t.type, n = e.attributes; n.length; )
        e.removeAttributeNode(n[0]);
      Ft(e, a, l), e[Vt] = t, e[le] = l;
    } catch (i) {
      Tt(t, t.return, i);
    }
  }
  var Ie = !1, Bt = !1, us = !1, Jf = typeof WeakSet == "function" ? WeakSet : Set, Xt = null;
  function Lm(t, e) {
    if (t = t.containerInfo, xs = ni, t = ao(t), Ii(t)) {
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
            var n = a.anchorOffset, i = a.focusNode;
            a = a.focusOffset;
            try {
              l.nodeType, i.nodeType;
            } catch {
              l = null;
              break t;
            }
            var s = 0, f = -1, h = -1, A = 0, C = 0, D = t, z = null;
            e: for (; ; ) {
              for (var x; D !== l || n !== 0 && D.nodeType !== 3 || (f = s + n), D !== i || a !== 0 && D.nodeType !== 3 || (h = s + a), D.nodeType === 3 && (s += D.nodeValue.length), (x = D.firstChild) !== null; )
                z = D, D = x;
              for (; ; ) {
                if (D === t) break e;
                if (z === l && ++A === n && (f = s), z === i && ++C === a && (h = s), (x = D.nextSibling) !== null) break;
                D = z, z = D.parentNode;
              }
              D = x;
            }
            l = f === -1 || h === -1 ? null : { start: f, end: h };
          } else l = null;
        }
      l = l || { start: 0, end: 0 };
    } else l = null;
    for (Ms = { focusedElem: t, selectionRange: l }, ni = !1, Xt = e; Xt !== null; )
      if (e = Xt, t = e.child, (e.subtreeFlags & 1028) !== 0 && t !== null)
        t.return = e, Xt = t;
      else
        for (; Xt !== null; ) {
          switch (e = Xt, i = e.alternate, t = e.flags, e.tag) {
            case 0:
              if ((t & 4) !== 0 && (t = e.updateQueue, t = t !== null ? t.events : null, t !== null))
                for (l = 0; l < t.length; l++)
                  n = t[l], n.ref.impl = n.nextImpl;
              break;
            case 11:
            case 15:
              break;
            case 1:
              if ((t & 1024) !== 0 && i !== null) {
                t = void 0, l = e, n = i.memoizedProps, i = i.memoizedState, a = l.stateNode;
                try {
                  var X = kl(
                    l.type,
                    n
                  );
                  t = a.getSnapshotBeforeUpdate(
                    X,
                    i
                  ), a.__reactInternalSnapshotBeforeUpdate = t;
                } catch (W) {
                  Tt(
                    l,
                    l.return,
                    W
                  );
                }
              }
              break;
            case 3:
              if ((t & 1024) !== 0) {
                if (t = e.stateNode.containerInfo, l = t.nodeType, l === 9)
                  js(t);
                else if (l === 1)
                  switch (t.nodeName) {
                    case "HEAD":
                    case "HTML":
                    case "BODY":
                      js(t);
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
              if ((t & 1024) !== 0) throw Error(r(163));
          }
          if (t = e.sibling, t !== null) {
            t.return = e.return, Xt = t;
            break;
          }
          Xt = e.return;
        }
  }
  function kf(t, e, l) {
    var a = l.flags;
    switch (l.tag) {
      case 0:
      case 11:
      case 15:
        tl(t, l), a & 4 && vn(5, l);
        break;
      case 1:
        if (tl(t, l), a & 4)
          if (t = l.stateNode, e === null)
            try {
              t.componentDidMount();
            } catch (s) {
              Tt(l, l.return, s);
            }
          else {
            var n = kl(
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
            } catch (s) {
              Tt(
                l,
                l.return,
                s
              );
            }
          }
        a & 64 && Gf(l), a & 512 && bn(l, l.return);
        break;
      case 3:
        if (tl(t, l), a & 64 && (t = l.updateQueue, t !== null)) {
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
            wo(t, e);
          } catch (s) {
            Tt(l, l.return, s);
          }
        }
        break;
      case 27:
        e === null && a & 4 && Kf(l);
      case 26:
      case 5:
        tl(t, l), e === null && a & 4 && Zf(l), a & 512 && bn(l, l.return);
        break;
      case 12:
        tl(t, l);
        break;
      case 31:
        tl(t, l), a & 4 && $f(t, l);
        break;
      case 13:
        tl(t, l), a & 4 && If(t, l), a & 64 && (t = l.memoizedState, t !== null && (t = t.dehydrated, t !== null && (l = km.bind(
          null,
          l
        ), yg(t, l))));
        break;
      case 22:
        if (a = l.memoizedState !== null || Ie, !a) {
          e = e !== null && e.memoizedState !== null || Bt, n = Ie;
          var i = Bt;
          Ie = a, (Bt = e) && !i ? el(
            t,
            l,
            (l.subtreeFlags & 8772) !== 0
          ) : tl(t, l), Ie = n, Bt = i;
        }
        break;
      case 30:
        break;
      default:
        tl(t, l);
    }
  }
  function Ff(t) {
    var e = t.alternate;
    e !== null && (t.alternate = null, Ff(e)), t.child = null, t.deletions = null, t.sibling = null, t.tag === 5 && (e = t.stateNode, e !== null && Ui(e)), t.stateNode = null, t.return = null, t.dependencies = null, t.memoizedProps = null, t.memoizedState = null, t.pendingProps = null, t.stateNode = null, t.updateQueue = null;
  }
  var Rt = null, ne = !1;
  function Pe(t, e, l) {
    for (l = l.child; l !== null; )
      Wf(t, e, l), l = l.sibling;
  }
  function Wf(t, e, l) {
    if (oe && typeof oe.onCommitFiberUnmount == "function")
      try {
        oe.onCommitFiberUnmount(Ga, l);
      } catch {
      }
    switch (l.tag) {
      case 26:
        Bt || Be(l, e), Pe(
          t,
          e,
          l
        ), l.memoizedState ? l.memoizedState.count-- : l.stateNode && (l = l.stateNode, l.parentNode.removeChild(l));
        break;
      case 27:
        Bt || Be(l, e);
        var a = Rt, n = ne;
        zl(l.type) && (Rt = l.stateNode, ne = !1), Pe(
          t,
          e,
          l
        ), Cn(l.stateNode), Rt = a, ne = n;
        break;
      case 5:
        Bt || Be(l, e);
      case 6:
        if (a = Rt, n = ne, Rt = null, Pe(
          t,
          e,
          l
        ), Rt = a, ne = n, Rt !== null)
          if (ne)
            try {
              (Rt.nodeType === 9 ? Rt.body : Rt.nodeName === "HTML" ? Rt.ownerDocument.body : Rt).removeChild(l.stateNode);
            } catch (i) {
              Tt(
                l,
                e,
                i
              );
            }
          else
            try {
              Rt.removeChild(l.stateNode);
            } catch (i) {
              Tt(
                l,
                e,
                i
              );
            }
        break;
      case 18:
        Rt !== null && (ne ? (t = Rt, Gd(
          t.nodeType === 9 ? t.body : t.nodeName === "HTML" ? t.ownerDocument.body : t,
          l.stateNode
        ), Na(t)) : Gd(Rt, l.stateNode));
        break;
      case 4:
        a = Rt, n = ne, Rt = l.stateNode.containerInfo, ne = !0, Pe(
          t,
          e,
          l
        ), Rt = a, ne = n;
        break;
      case 0:
      case 11:
      case 14:
      case 15:
        vl(2, l, e), Bt || vl(4, l, e), Pe(
          t,
          e,
          l
        );
        break;
      case 1:
        Bt || (Be(l, e), a = l.stateNode, typeof a.componentWillUnmount == "function" && Xf(
          l,
          e,
          a
        )), Pe(
          t,
          e,
          l
        );
        break;
      case 21:
        Pe(
          t,
          e,
          l
        );
        break;
      case 22:
        Bt = (a = Bt) || l.memoizedState !== null, Pe(
          t,
          e,
          l
        ), Bt = a;
        break;
      default:
        Pe(
          t,
          e,
          l
        );
    }
  }
  function $f(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null))) {
      t = t.dehydrated;
      try {
        Na(t);
      } catch (l) {
        Tt(e, e.return, l);
      }
    }
  }
  function If(t, e) {
    if (e.memoizedState === null && (t = e.alternate, t !== null && (t = t.memoizedState, t !== null && (t = t.dehydrated, t !== null))))
      try {
        Na(t);
      } catch (l) {
        Tt(e, e.return, l);
      }
  }
  function Qm(t) {
    switch (t.tag) {
      case 31:
      case 13:
      case 19:
        var e = t.stateNode;
        return e === null && (e = t.stateNode = new Jf()), e;
      case 22:
        return t = t.stateNode, e = t._retryCache, e === null && (e = t._retryCache = new Jf()), e;
      default:
        throw Error(r(435, t.tag));
    }
  }
  function Bu(t, e) {
    var l = Qm(t);
    e.forEach(function(a) {
      if (!l.has(a)) {
        l.add(a);
        var n = Fm.bind(null, t, a);
        a.then(n, n);
      }
    });
  }
  function ue(t, e) {
    var l = e.deletions;
    if (l !== null)
      for (var a = 0; a < l.length; a++) {
        var n = l[a], i = t, s = e, f = s;
        t: for (; f !== null; ) {
          switch (f.tag) {
            case 27:
              if (zl(f.type)) {
                Rt = f.stateNode, ne = !1;
                break t;
              }
              break;
            case 5:
              Rt = f.stateNode, ne = !1;
              break t;
            case 3:
            case 4:
              Rt = f.stateNode.containerInfo, ne = !0;
              break t;
          }
          f = f.return;
        }
        if (Rt === null) throw Error(r(160));
        Wf(i, s, n), Rt = null, ne = !1, i = n.alternate, i !== null && (i.return = null), n.return = null;
      }
    if (e.subtreeFlags & 13886)
      for (e = e.child; e !== null; )
        Pf(e, t), e = e.sibling;
  }
  var _e = null;
  function Pf(t, e) {
    var l = t.alternate, a = t.flags;
    switch (t.tag) {
      case 0:
      case 11:
      case 14:
      case 15:
        ue(e, t), ie(t), a & 4 && (vl(3, t, t.return), vn(3, t), vl(5, t, t.return));
        break;
      case 1:
        ue(e, t), ie(t), a & 512 && (Bt || l === null || Be(l, l.return)), a & 64 && Ie && (t = t.updateQueue, t !== null && (a = t.callbacks, a !== null && (l = t.shared.hiddenCallbacks, t.shared.hiddenCallbacks = l === null ? a : l.concat(a))));
        break;
      case 26:
        var n = _e;
        if (ue(e, t), ie(t), a & 512 && (Bt || l === null || Be(l, l.return)), a & 4) {
          var i = l !== null ? l.memoizedState : null;
          if (a = t.memoizedState, l === null)
            if (a === null)
              if (t.stateNode === null) {
                t: {
                  a = t.type, l = t.memoizedProps, n = n.ownerDocument || n;
                  e: switch (a) {
                    case "title":
                      i = n.getElementsByTagName("title")[0], (!i || i[Va] || i[Vt] || i.namespaceURI === "http://www.w3.org/2000/svg" || i.hasAttribute("itemprop")) && (i = n.createElement(a), n.head.insertBefore(
                        i,
                        n.querySelector("head > title")
                      )), Ft(i, a, l), i[Vt] = t, Gt(i), a = i;
                      break t;
                    case "link":
                      var s = Pd(
                        "link",
                        "href",
                        n
                      ).get(a + (l.href || ""));
                      if (s) {
                        for (var f = 0; f < s.length; f++)
                          if (i = s[f], i.getAttribute("href") === (l.href == null || l.href === "" ? null : l.href) && i.getAttribute("rel") === (l.rel == null ? null : l.rel) && i.getAttribute("title") === (l.title == null ? null : l.title) && i.getAttribute("crossorigin") === (l.crossOrigin == null ? null : l.crossOrigin)) {
                            s.splice(f, 1);
                            break e;
                          }
                      }
                      i = n.createElement(a), Ft(i, a, l), n.head.appendChild(i);
                      break;
                    case "meta":
                      if (s = Pd(
                        "meta",
                        "content",
                        n
                      ).get(a + (l.content || ""))) {
                        for (f = 0; f < s.length; f++)
                          if (i = s[f], i.getAttribute("content") === (l.content == null ? null : "" + l.content) && i.getAttribute("name") === (l.name == null ? null : l.name) && i.getAttribute("property") === (l.property == null ? null : l.property) && i.getAttribute("http-equiv") === (l.httpEquiv == null ? null : l.httpEquiv) && i.getAttribute("charset") === (l.charSet == null ? null : l.charSet)) {
                            s.splice(f, 1);
                            break e;
                          }
                      }
                      i = n.createElement(a), Ft(i, a, l), n.head.appendChild(i);
                      break;
                    default:
                      throw Error(r(468, a));
                  }
                  i[Vt] = t, Gt(i), a = i;
                }
                t.stateNode = a;
              } else
                th(
                  n,
                  t.type,
                  t.stateNode
                );
            else
              t.stateNode = Id(
                n,
                a,
                t.memoizedProps
              );
          else
            i !== a ? (i === null ? l.stateNode !== null && (l = l.stateNode, l.parentNode.removeChild(l)) : i.count--, a === null ? th(
              n,
              t.type,
              t.stateNode
            ) : Id(
              n,
              a,
              t.memoizedProps
            )) : a === null && t.stateNode !== null && ls(
              t,
              t.memoizedProps,
              l.memoizedProps
            );
        }
        break;
      case 27:
        ue(e, t), ie(t), a & 512 && (Bt || l === null || Be(l, l.return)), l !== null && a & 4 && ls(
          t,
          t.memoizedProps,
          l.memoizedProps
        );
        break;
      case 5:
        if (ue(e, t), ie(t), a & 512 && (Bt || l === null || Be(l, l.return)), t.flags & 32) {
          n = t.stateNode;
          try {
            aa(n, "");
          } catch (X) {
            Tt(t, t.return, X);
          }
        }
        a & 4 && t.stateNode != null && (n = t.memoizedProps, ls(
          t,
          n,
          l !== null ? l.memoizedProps : n
        )), a & 1024 && (us = !0);
        break;
      case 6:
        if (ue(e, t), ie(t), a & 4) {
          if (t.stateNode === null)
            throw Error(r(162));
          a = t.memoizedProps, l = t.stateNode;
          try {
            l.nodeValue = a;
          } catch (X) {
            Tt(t, t.return, X);
          }
        }
        break;
      case 3:
        if (ti = null, n = _e, _e = Iu(e.containerInfo), ue(e, t), _e = n, ie(t), a & 4 && l !== null && l.memoizedState.isDehydrated)
          try {
            Na(e.containerInfo);
          } catch (X) {
            Tt(t, t.return, X);
          }
        us && (us = !1, td(t));
        break;
      case 4:
        a = _e, _e = Iu(
          t.stateNode.containerInfo
        ), ue(e, t), ie(t), _e = a;
        break;
      case 12:
        ue(e, t), ie(t);
        break;
      case 31:
        ue(e, t), ie(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Bu(t, a)));
        break;
      case 13:
        ue(e, t), ie(t), t.child.flags & 8192 && t.memoizedState !== null != (l !== null && l.memoizedState !== null) && (Qu = re()), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Bu(t, a)));
        break;
      case 22:
        n = t.memoizedState !== null;
        var h = l !== null && l.memoizedState !== null, A = Ie, C = Bt;
        if (Ie = A || n, Bt = C || h, ue(e, t), Bt = C, Ie = A, ie(t), a & 8192)
          t: for (e = t.stateNode, e._visibility = n ? e._visibility & -2 : e._visibility | 1, n && (l === null || h || Ie || Bt || Fl(t)), l = null, e = t; ; ) {
            if (e.tag === 5 || e.tag === 26) {
              if (l === null) {
                h = l = e;
                try {
                  if (i = h.stateNode, n)
                    s = i.style, typeof s.setProperty == "function" ? s.setProperty("display", "none", "important") : s.display = "none";
                  else {
                    f = h.stateNode;
                    var D = h.memoizedProps.style, z = D != null && D.hasOwnProperty("display") ? D.display : null;
                    f.style.display = z == null || typeof z == "boolean" ? "" : ("" + z).trim();
                  }
                } catch (X) {
                  Tt(h, h.return, X);
                }
              }
            } else if (e.tag === 6) {
              if (l === null) {
                h = e;
                try {
                  h.stateNode.nodeValue = n ? "" : h.memoizedProps;
                } catch (X) {
                  Tt(h, h.return, X);
                }
              }
            } else if (e.tag === 18) {
              if (l === null) {
                h = e;
                try {
                  var x = h.stateNode;
                  n ? Xd(x, !0) : Xd(h.stateNode, !1);
                } catch (X) {
                  Tt(h, h.return, X);
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
        a & 4 && (a = t.updateQueue, a !== null && (l = a.retryQueue, l !== null && (a.retryQueue = null, Bu(t, l))));
        break;
      case 19:
        ue(e, t), ie(t), a & 4 && (a = t.updateQueue, a !== null && (t.updateQueue = null, Bu(t, a)));
        break;
      case 30:
        break;
      case 21:
        break;
      default:
        ue(e, t), ie(t);
    }
  }
  function ie(t) {
    var e = t.flags;
    if (e & 2) {
      try {
        for (var l, a = t.return; a !== null; ) {
          if (Vf(a)) {
            l = a;
            break;
          }
          a = a.return;
        }
        if (l == null) throw Error(r(160));
        switch (l.tag) {
          case 27:
            var n = l.stateNode, i = as(t);
            Hu(t, i, n);
            break;
          case 5:
            var s = l.stateNode;
            l.flags & 32 && (aa(s, ""), l.flags &= -33);
            var f = as(t);
            Hu(t, f, s);
            break;
          case 3:
          case 4:
            var h = l.stateNode.containerInfo, A = as(t);
            ns(
              t,
              A,
              h
            );
            break;
          default:
            throw Error(r(161));
        }
      } catch (C) {
        Tt(t, t.return, C);
      }
      t.flags &= -3;
    }
    e & 4096 && (t.flags &= -4097);
  }
  function td(t) {
    if (t.subtreeFlags & 1024)
      for (t = t.child; t !== null; ) {
        var e = t;
        td(e), e.tag === 5 && e.flags & 1024 && e.stateNode.reset(), t = t.sibling;
      }
  }
  function tl(t, e) {
    if (e.subtreeFlags & 8772)
      for (e = e.child; e !== null; )
        kf(t, e.alternate, e), e = e.sibling;
  }
  function Fl(t) {
    for (t = t.child; t !== null; ) {
      var e = t;
      switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
          vl(4, e, e.return), Fl(e);
          break;
        case 1:
          Be(e, e.return);
          var l = e.stateNode;
          typeof l.componentWillUnmount == "function" && Xf(
            e,
            e.return,
            l
          ), Fl(e);
          break;
        case 27:
          Cn(e.stateNode);
        case 26:
        case 5:
          Be(e, e.return), Fl(e);
          break;
        case 22:
          e.memoizedState === null && Fl(e);
          break;
        case 30:
          Fl(e);
          break;
        default:
          Fl(e);
      }
      t = t.sibling;
    }
  }
  function el(t, e, l) {
    for (l = l && (e.subtreeFlags & 8772) !== 0, e = e.child; e !== null; ) {
      var a = e.alternate, n = t, i = e, s = i.flags;
      switch (i.tag) {
        case 0:
        case 11:
        case 15:
          el(
            n,
            i,
            l
          ), vn(4, i);
          break;
        case 1:
          if (el(
            n,
            i,
            l
          ), a = i, n = a.stateNode, typeof n.componentDidMount == "function")
            try {
              n.componentDidMount();
            } catch (A) {
              Tt(a, a.return, A);
            }
          if (a = i, n = a.updateQueue, n !== null) {
            var f = a.stateNode;
            try {
              var h = n.shared.hiddenCallbacks;
              if (h !== null)
                for (n.shared.hiddenCallbacks = null, n = 0; n < h.length; n++)
                  jo(h[n], f);
            } catch (A) {
              Tt(a, a.return, A);
            }
          }
          l && s & 64 && Gf(i), bn(i, i.return);
          break;
        case 27:
          Kf(i);
        case 26:
        case 5:
          el(
            n,
            i,
            l
          ), l && a === null && s & 4 && Zf(i), bn(i, i.return);
          break;
        case 12:
          el(
            n,
            i,
            l
          );
          break;
        case 31:
          el(
            n,
            i,
            l
          ), l && s & 4 && $f(n, i);
          break;
        case 13:
          el(
            n,
            i,
            l
          ), l && s & 4 && If(n, i);
          break;
        case 22:
          i.memoizedState === null && el(
            n,
            i,
            l
          ), bn(i, i.return);
          break;
        case 30:
          break;
        default:
          el(
            n,
            i,
            l
          );
      }
      e = e.sibling;
    }
  }
  function is(t, e) {
    var l = null;
    t !== null && t.memoizedState !== null && t.memoizedState.cachePool !== null && (l = t.memoizedState.cachePool.pool), t = null, e.memoizedState !== null && e.memoizedState.cachePool !== null && (t = e.memoizedState.cachePool.pool), t !== l && (t != null && t.refCount++, l != null && nn(l));
  }
  function cs(t, e) {
    t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && nn(t));
  }
  function Ne(t, e, l, a) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; )
        ed(
          t,
          e,
          l,
          a
        ), e = e.sibling;
  }
  function ed(t, e, l, a) {
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
        ), n & 2048 && vn(9, e);
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
        ), n & 2048 && (t = null, e.alternate !== null && (t = e.alternate.memoizedState.cache), e = e.memoizedState.cache, e !== t && (e.refCount++, t != null && nn(t)));
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
            var i = e.memoizedProps, s = i.id, f = i.onPostCommit;
            typeof f == "function" && f(
              s,
              e.alternate === null ? "mount" : "update",
              t.passiveEffectDuration,
              -0
            );
          } catch (h) {
            Tt(e, e.return, h);
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
        i = e.stateNode, s = e.alternate, e.memoizedState !== null ? i._visibility & 2 ? Ne(
          t,
          e,
          l,
          a
        ) : Sn(t, e) : i._visibility & 2 ? Ne(
          t,
          e,
          l,
          a
        ) : (i._visibility |= 2, Aa(
          t,
          e,
          l,
          a,
          (e.subtreeFlags & 10256) !== 0 || !1
        )), n & 2048 && is(s, e);
        break;
      case 24:
        Ne(
          t,
          e,
          l,
          a
        ), n & 2048 && cs(e.alternate, e);
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
  function Aa(t, e, l, a, n) {
    for (n = n && ((e.subtreeFlags & 10256) !== 0 || !1), e = e.child; e !== null; ) {
      var i = t, s = e, f = l, h = a, A = s.flags;
      switch (s.tag) {
        case 0:
        case 11:
        case 15:
          Aa(
            i,
            s,
            f,
            h,
            n
          ), vn(8, s);
          break;
        case 23:
          break;
        case 22:
          var C = s.stateNode;
          s.memoizedState !== null ? C._visibility & 2 ? Aa(
            i,
            s,
            f,
            h,
            n
          ) : Sn(
            i,
            s
          ) : (C._visibility |= 2, Aa(
            i,
            s,
            f,
            h,
            n
          )), n && A & 2048 && is(
            s.alternate,
            s
          );
          break;
        case 24:
          Aa(
            i,
            s,
            f,
            h,
            n
          ), n && A & 2048 && cs(s.alternate, s);
          break;
        default:
          Aa(
            i,
            s,
            f,
            h,
            n
          );
      }
      e = e.sibling;
    }
  }
  function Sn(t, e) {
    if (e.subtreeFlags & 10256)
      for (e = e.child; e !== null; ) {
        var l = t, a = e, n = a.flags;
        switch (a.tag) {
          case 22:
            Sn(l, a), n & 2048 && is(
              a.alternate,
              a
            );
            break;
          case 24:
            Sn(l, a), n & 2048 && cs(a.alternate, a);
            break;
          default:
            Sn(l, a);
        }
        e = e.sibling;
      }
  }
  var En = 8192;
  function Oa(t, e, l) {
    if (t.subtreeFlags & En)
      for (t = t.child; t !== null; )
        ld(
          t,
          e,
          l
        ), t = t.sibling;
  }
  function ld(t, e, l) {
    switch (t.tag) {
      case 26:
        Oa(
          t,
          e,
          l
        ), t.flags & En && t.memoizedState !== null && xg(
          l,
          _e,
          t.memoizedState,
          t.memoizedProps
        );
        break;
      case 5:
        Oa(
          t,
          e,
          l
        );
        break;
      case 3:
      case 4:
        var a = _e;
        _e = Iu(t.stateNode.containerInfo), Oa(
          t,
          e,
          l
        ), _e = a;
        break;
      case 22:
        t.memoizedState === null && (a = t.alternate, a !== null && a.memoizedState !== null ? (a = En, En = 16777216, Oa(
          t,
          e,
          l
        ), En = a) : Oa(
          t,
          e,
          l
        ));
        break;
      default:
        Oa(
          t,
          e,
          l
        );
    }
  }
  function ad(t) {
    var e = t.alternate;
    if (e !== null && (t = e.child, t !== null)) {
      e.child = null;
      do
        e = t.sibling, t.sibling = null, t = e;
      while (t !== null);
    }
  }
  function Tn(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var l = 0; l < e.length; l++) {
          var a = e[l];
          Xt = a, ud(
            a,
            t
          );
        }
      ad(t);
    }
    if (t.subtreeFlags & 10256)
      for (t = t.child; t !== null; )
        nd(t), t = t.sibling;
  }
  function nd(t) {
    switch (t.tag) {
      case 0:
      case 11:
      case 15:
        Tn(t), t.flags & 2048 && vl(9, t, t.return);
        break;
      case 3:
        Tn(t);
        break;
      case 12:
        Tn(t);
        break;
      case 22:
        var e = t.stateNode;
        t.memoizedState !== null && e._visibility & 2 && (t.return === null || t.return.tag !== 13) ? (e._visibility &= -3, Lu(t)) : Tn(t);
        break;
      default:
        Tn(t);
    }
  }
  function Lu(t) {
    var e = t.deletions;
    if ((t.flags & 16) !== 0) {
      if (e !== null)
        for (var l = 0; l < e.length; l++) {
          var a = e[l];
          Xt = a, ud(
            a,
            t
          );
        }
      ad(t);
    }
    for (t = t.child; t !== null; ) {
      switch (e = t, e.tag) {
        case 0:
        case 11:
        case 15:
          vl(8, e, e.return), Lu(e);
          break;
        case 22:
          l = e.stateNode, l._visibility & 2 && (l._visibility &= -3, Lu(e));
          break;
        default:
          Lu(e);
      }
      t = t.sibling;
    }
  }
  function ud(t, e) {
    for (; Xt !== null; ) {
      var l = Xt;
      switch (l.tag) {
        case 0:
        case 11:
        case 15:
          vl(8, l, e);
          break;
        case 23:
        case 22:
          if (l.memoizedState !== null && l.memoizedState.cachePool !== null) {
            var a = l.memoizedState.cachePool.pool;
            a != null && a.refCount++;
          }
          break;
        case 24:
          nn(l.memoizedState.cache);
      }
      if (a = l.child, a !== null) a.return = l, Xt = a;
      else
        t: for (l = t; Xt !== null; ) {
          a = Xt;
          var n = a.sibling, i = a.return;
          if (Ff(a), a === l) {
            Xt = null;
            break t;
          }
          if (n !== null) {
            n.return = i, Xt = n;
            break t;
          }
          Xt = i;
        }
    }
  }
  var Ym = {
    getCacheForType: function(t) {
      var e = Jt(Ut), l = e.data.get(t);
      return l === void 0 && (l = t(), e.data.set(t, l)), l;
    },
    cacheSignal: function() {
      return Jt(Ut).controller.signal;
    }
  }, Gm = typeof WeakMap == "function" ? WeakMap : Map, vt = 0, xt = null, it = null, rt = 0, Et = 0, ge = null, bl = !1, za = !1, ss = !1, ll = 0, wt = 0, Sl = 0, Wl = 0, rs = 0, pe = 0, xa = 0, An = null, ce = null, os = !1, Qu = 0, id = 0, Yu = 1 / 0, Gu = null, El = null, Yt = 0, Tl = null, Ma = null, al = 0, fs = 0, ds = null, cd = null, On = 0, hs = null;
  function ve() {
    return (vt & 2) !== 0 && rt !== 0 ? rt & -rt : M.T !== null ? bs() : Er();
  }
  function sd() {
    if (pe === 0)
      if ((rt & 536870912) === 0 || ft) {
        var t = Wn;
        Wn <<= 1, (Wn & 3932160) === 0 && (Wn = 262144), pe = t;
      } else pe = 536870912;
    return t = ye.current, t !== null && (t.flags |= 32), pe;
  }
  function se(t, e, l) {
    (t === xt && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null) && (Ca(t, 0), Al(
      t,
      rt,
      pe,
      !1
    )), Za(t, l), ((vt & 2) === 0 || t !== xt) && (t === xt && ((vt & 2) === 0 && (Wl |= l), wt === 4 && Al(
      t,
      rt,
      pe,
      !1
    )), Le(t));
  }
  function rd(t, e, l) {
    if ((vt & 6) !== 0) throw Error(r(327));
    var a = !l && (e & 127) === 0 && (e & t.expiredLanes) === 0 || Xa(t, e), n = a ? Vm(t, e) : ms(t, e, !0), i = a;
    do {
      if (n === 0) {
        za && !a && Al(t, e, 0, !1);
        break;
      } else {
        if (l = t.current.alternate, i && !Xm(l)) {
          n = ms(t, e, !1), i = !1;
          continue;
        }
        if (n === 2) {
          if (i = e, t.errorRecoveryDisabledLanes & i)
            var s = 0;
          else
            s = t.pendingLanes & -536870913, s = s !== 0 ? s : s & 536870912 ? 536870912 : 0;
          if (s !== 0) {
            e = s;
            t: {
              var f = t;
              n = An;
              var h = f.current.memoizedState.isDehydrated;
              if (h && (Ca(f, s).flags |= 256), s = ms(
                f,
                s,
                !1
              ), s !== 2) {
                if (ss && !h) {
                  f.errorRecoveryDisabledLanes |= i, Wl |= i, n = 4;
                  break t;
                }
                i = ce, ce = n, i !== null && (ce === null ? ce = i : ce.push.apply(
                  ce,
                  i
                ));
              }
              n = s;
            }
            if (i = !1, n !== 2) continue;
          }
        }
        if (n === 1) {
          Ca(t, 0), Al(t, e, 0, !0);
          break;
        }
        t: {
          switch (a = t, i = n, i) {
            case 0:
            case 1:
              throw Error(r(345));
            case 4:
              if ((e & 4194048) !== e) break;
            case 6:
              Al(
                a,
                e,
                pe,
                !bl
              );
              break t;
            case 2:
              ce = null;
              break;
            case 3:
            case 5:
              break;
            default:
              throw Error(r(329));
          }
          if ((e & 62914560) === e && (n = Qu + 300 - re(), 10 < n)) {
            if (Al(
              a,
              e,
              pe,
              !bl
            ), In(a, 0, !0) !== 0) break t;
            al = e, a.timeoutHandle = Qd(
              od.bind(
                null,
                a,
                l,
                ce,
                Gu,
                os,
                e,
                pe,
                Wl,
                xa,
                bl,
                i,
                "Throttled",
                -0,
                0
              ),
              n
            );
            break t;
          }
          od(
            a,
            l,
            ce,
            Gu,
            os,
            e,
            pe,
            Wl,
            xa,
            bl,
            i,
            null,
            -0,
            0
          );
        }
      }
      break;
    } while (!0);
    Le(t);
  }
  function od(t, e, l, a, n, i, s, f, h, A, C, D, z, x) {
    if (t.timeoutHandle = -1, D = e.subtreeFlags, D & 8192 || (D & 16785408) === 16785408) {
      D = {
        stylesheets: null,
        count: 0,
        imgCount: 0,
        imgBytes: 0,
        suspenseyImages: [],
        waitingForImages: !0,
        waitingForViewTransition: !1,
        unsuspend: Ge
      }, ld(
        e,
        i,
        D
      );
      var X = (i & 62914560) === i ? Qu - re() : (i & 4194048) === i ? id - re() : 0;
      if (X = Mg(
        D,
        X
      ), X !== null) {
        al = i, t.cancelPendingCommit = X(
          vd.bind(
            null,
            t,
            e,
            i,
            l,
            a,
            n,
            s,
            f,
            h,
            C,
            D,
            null,
            z,
            x
          )
        ), Al(t, i, s, !A);
        return;
      }
    }
    vd(
      t,
      e,
      i,
      l,
      a,
      n,
      s,
      f,
      h
    );
  }
  function Xm(t) {
    for (var e = t; ; ) {
      var l = e.tag;
      if ((l === 0 || l === 11 || l === 15) && e.flags & 16384 && (l = e.updateQueue, l !== null && (l = l.stores, l !== null)))
        for (var a = 0; a < l.length; a++) {
          var n = l[a], i = n.getSnapshot;
          n = n.value;
          try {
            if (!de(i(), n)) return !1;
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
  function Al(t, e, l, a) {
    e &= ~rs, e &= ~Wl, t.suspendedLanes |= e, t.pingedLanes &= ~e, a && (t.warmLanes |= e), a = t.expirationTimes;
    for (var n = e; 0 < n; ) {
      var i = 31 - fe(n), s = 1 << i;
      a[i] = -1, n &= ~s;
    }
    l !== 0 && vr(t, l, e);
  }
  function Xu() {
    return (vt & 6) === 0 ? (zn(0), !1) : !0;
  }
  function ys() {
    if (it !== null) {
      if (Et === 0)
        var t = it.return;
      else
        t = it, Ke = Yl = null, jc(t), va = null, cn = 0, t = it;
      for (; t !== null; )
        Yf(t.alternate, t), t = t.return;
      it = null;
    }
  }
  function Ca(t, e) {
    var l = t.timeoutHandle;
    l !== -1 && (t.timeoutHandle = -1, rg(l)), l = t.cancelPendingCommit, l !== null && (t.cancelPendingCommit = null, l()), al = 0, ys(), xt = t, it = l = Ze(t.current, null), rt = e, Et = 0, ge = null, bl = !1, za = Xa(t, e), ss = !1, xa = pe = rs = Wl = Sl = wt = 0, ce = An = null, os = !1, (e & 8) !== 0 && (e |= e & 32);
    var a = t.entangledLanes;
    if (a !== 0)
      for (t = t.entanglements, a &= e; 0 < a; ) {
        var n = 31 - fe(a), i = 1 << n;
        e |= t[n], a &= ~i;
      }
    return ll = e, ou(), l;
  }
  function fd(t, e) {
    et = null, M.H = mn, e === pa || e === vu ? (e = xo(), Et = 3) : e === vc ? (e = xo(), Et = 4) : Et = e === Kc ? 8 : e !== null && typeof e == "object" && typeof e.then == "function" ? 6 : 1, ge = e, it === null && (wt = 1, Du(
      t,
      Oe(e, t.current)
    ));
  }
  function dd() {
    var t = ye.current;
    return t === null ? !0 : (rt & 4194048) === rt ? Ce === null : (rt & 62914560) === rt || (rt & 536870912) !== 0 ? t === Ce : !1;
  }
  function hd() {
    var t = M.H;
    return M.H = mn, t === null ? mn : t;
  }
  function yd() {
    var t = M.A;
    return M.A = Ym, t;
  }
  function Zu() {
    wt = 4, bl || (rt & 4194048) !== rt && ye.current !== null || (za = !0), (Sl & 134217727) === 0 && (Wl & 134217727) === 0 || xt === null || Al(
      xt,
      rt,
      pe,
      !1
    );
  }
  function ms(t, e, l) {
    var a = vt;
    vt |= 2;
    var n = hd(), i = yd();
    (xt !== t || rt !== e) && (Gu = null, Ca(t, e)), e = !1;
    var s = wt;
    t: do
      try {
        if (Et !== 0 && it !== null) {
          var f = it, h = ge;
          switch (Et) {
            case 8:
              ys(), s = 6;
              break t;
            case 3:
            case 2:
            case 9:
            case 6:
              ye.current === null && (e = !0);
              var A = Et;
              if (Et = 0, ge = null, Ra(t, f, h, A), l && za) {
                s = 0;
                break t;
              }
              break;
            default:
              A = Et, Et = 0, ge = null, Ra(t, f, h, A);
          }
        }
        Zm(), s = wt;
        break;
      } catch (C) {
        fd(t, C);
      }
    while (!0);
    return e && t.shellSuspendCounter++, Ke = Yl = null, vt = a, M.H = n, M.A = i, it === null && (xt = null, rt = 0, ou()), s;
  }
  function Zm() {
    for (; it !== null; ) md(it);
  }
  function Vm(t, e) {
    var l = vt;
    vt |= 2;
    var a = hd(), n = yd();
    xt !== t || rt !== e ? (Gu = null, Yu = re() + 500, Ca(t, e)) : za = Xa(
      t,
      e
    );
    t: do
      try {
        if (Et !== 0 && it !== null) {
          e = it;
          var i = ge;
          e: switch (Et) {
            case 1:
              Et = 0, ge = null, Ra(t, e, i, 1);
              break;
            case 2:
            case 9:
              if (Oo(i)) {
                Et = 0, ge = null, gd(e);
                break;
              }
              e = function() {
                Et !== 2 && Et !== 9 || xt !== t || (Et = 7), Le(t);
              }, i.then(e, e);
              break t;
            case 3:
              Et = 7;
              break t;
            case 4:
              Et = 5;
              break t;
            case 7:
              Oo(i) ? (Et = 0, ge = null, gd(e)) : (Et = 0, ge = null, Ra(t, e, i, 7));
              break;
            case 5:
              var s = null;
              switch (it.tag) {
                case 26:
                  s = it.memoizedState;
                case 5:
                case 27:
                  var f = it;
                  if (s ? eh(s) : f.stateNode.complete) {
                    Et = 0, ge = null;
                    var h = f.sibling;
                    if (h !== null) it = h;
                    else {
                      var A = f.return;
                      A !== null ? (it = A, Vu(A)) : it = null;
                    }
                    break e;
                  }
              }
              Et = 0, ge = null, Ra(t, e, i, 5);
              break;
            case 6:
              Et = 0, ge = null, Ra(t, e, i, 6);
              break;
            case 8:
              ys(), wt = 6;
              break t;
            default:
              throw Error(r(462));
          }
        }
        Km();
        break;
      } catch (C) {
        fd(t, C);
      }
    while (!0);
    return Ke = Yl = null, M.H = a, M.A = n, vt = l, it !== null ? 0 : (xt = null, rt = 0, ou(), wt);
  }
  function Km() {
    for (; it !== null && !my(); )
      md(it);
  }
  function md(t) {
    var e = Lf(t.alternate, t, ll);
    t.memoizedProps = t.pendingProps, e === null ? Vu(t) : it = e;
  }
  function gd(t) {
    var e = t, l = e.alternate;
    switch (e.tag) {
      case 15:
      case 0:
        e = _f(
          l,
          e,
          e.pendingProps,
          e.type,
          void 0,
          rt
        );
        break;
      case 11:
        e = _f(
          l,
          e,
          e.pendingProps,
          e.type.render,
          e.ref,
          rt
        );
        break;
      case 5:
        jc(e);
      default:
        Yf(l, e), e = it = ho(e, ll), e = Lf(l, e, ll);
    }
    t.memoizedProps = t.pendingProps, e === null ? Vu(t) : it = e;
  }
  function Ra(t, e, l, a) {
    Ke = Yl = null, jc(e), va = null, cn = 0;
    var n = e.return;
    try {
      if (Nm(
        t,
        n,
        e,
        l,
        rt
      )) {
        wt = 1, Du(
          t,
          Oe(l, t.current)
        ), it = null;
        return;
      }
    } catch (i) {
      if (n !== null) throw it = n, i;
      wt = 1, Du(
        t,
        Oe(l, t.current)
      ), it = null;
      return;
    }
    e.flags & 32768 ? (ft || a === 1 ? t = !0 : za || (rt & 536870912) !== 0 ? t = !1 : (bl = t = !0, (a === 2 || a === 9 || a === 3 || a === 6) && (a = ye.current, a !== null && a.tag === 13 && (a.flags |= 16384))), pd(e, t)) : Vu(e);
  }
  function Vu(t) {
    var e = t;
    do {
      if ((e.flags & 32768) !== 0) {
        pd(
          e,
          bl
        );
        return;
      }
      t = e.return;
      var l = Hm(
        e.alternate,
        e,
        ll
      );
      if (l !== null) {
        it = l;
        return;
      }
      if (e = e.sibling, e !== null) {
        it = e;
        return;
      }
      it = e = t;
    } while (e !== null);
    wt === 0 && (wt = 5);
  }
  function pd(t, e) {
    do {
      var l = Bm(t.alternate, t);
      if (l !== null) {
        l.flags &= 32767, it = l;
        return;
      }
      if (l = t.return, l !== null && (l.flags |= 32768, l.subtreeFlags = 0, l.deletions = null), !e && (t = t.sibling, t !== null)) {
        it = t;
        return;
      }
      it = t = l;
    } while (t !== null);
    wt = 6, it = null;
  }
  function vd(t, e, l, a, n, i, s, f, h) {
    t.cancelPendingCommit = null;
    do
      Ku();
    while (Yt !== 0);
    if ((vt & 6) !== 0) throw Error(r(327));
    if (e !== null) {
      if (e === t.current) throw Error(r(177));
      if (i = e.lanes | e.childLanes, i |= ac, zy(
        t,
        l,
        i,
        s,
        f,
        h
      ), t === xt && (it = xt = null, rt = 0), Ma = e, Tl = t, al = l, fs = i, ds = n, cd = a, (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? (t.callbackNode = null, t.callbackPriority = 0, Wm(kn, function() {
        return Ad(), null;
      })) : (t.callbackNode = null, t.callbackPriority = 0), a = (e.flags & 13878) !== 0, (e.subtreeFlags & 13878) !== 0 || a) {
        a = M.T, M.T = null, n = H.p, H.p = 2, s = vt, vt |= 4;
        try {
          Lm(t, e, l);
        } finally {
          vt = s, H.p = n, M.T = a;
        }
      }
      Yt = 1, bd(), Sd(), Ed();
    }
  }
  function bd() {
    if (Yt === 1) {
      Yt = 0;
      var t = Tl, e = Ma, l = (e.flags & 13878) !== 0;
      if ((e.subtreeFlags & 13878) !== 0 || l) {
        l = M.T, M.T = null;
        var a = H.p;
        H.p = 2;
        var n = vt;
        vt |= 4;
        try {
          Pf(e, t);
          var i = Ms, s = ao(t.containerInfo), f = i.focusedElem, h = i.selectionRange;
          if (s !== f && f && f.ownerDocument && lo(
            f.ownerDocument.documentElement,
            f
          )) {
            if (h !== null && Ii(f)) {
              var A = h.start, C = h.end;
              if (C === void 0 && (C = A), "selectionStart" in f)
                f.selectionStart = A, f.selectionEnd = Math.min(
                  C,
                  f.value.length
                );
              else {
                var D = f.ownerDocument || document, z = D && D.defaultView || window;
                if (z.getSelection) {
                  var x = z.getSelection(), X = f.textContent.length, W = Math.min(h.start, X), zt = h.end === void 0 ? W : Math.min(h.end, X);
                  !x.extend && W > zt && (s = zt, zt = W, W = s);
                  var v = eo(
                    f,
                    W
                  ), g = eo(
                    f,
                    zt
                  );
                  if (v && g && (x.rangeCount !== 1 || x.anchorNode !== v.node || x.anchorOffset !== v.offset || x.focusNode !== g.node || x.focusOffset !== g.offset)) {
                    var T = D.createRange();
                    T.setStart(v.node, v.offset), x.removeAllRanges(), W > zt ? (x.addRange(T), x.extend(g.node, g.offset)) : (T.setEnd(g.node, g.offset), x.addRange(T));
                  }
                }
              }
            }
            for (D = [], x = f; x = x.parentNode; )
              x.nodeType === 1 && D.push({
                element: x,
                left: x.scrollLeft,
                top: x.scrollTop
              });
            for (typeof f.focus == "function" && f.focus(), f = 0; f < D.length; f++) {
              var j = D[f];
              j.element.scrollLeft = j.left, j.element.scrollTop = j.top;
            }
          }
          ni = !!xs, Ms = xs = null;
        } finally {
          vt = n, H.p = a, M.T = l;
        }
      }
      t.current = e, Yt = 2;
    }
  }
  function Sd() {
    if (Yt === 2) {
      Yt = 0;
      var t = Tl, e = Ma, l = (e.flags & 8772) !== 0;
      if ((e.subtreeFlags & 8772) !== 0 || l) {
        l = M.T, M.T = null;
        var a = H.p;
        H.p = 2;
        var n = vt;
        vt |= 4;
        try {
          kf(t, e.alternate, e);
        } finally {
          vt = n, H.p = a, M.T = l;
        }
      }
      Yt = 3;
    }
  }
  function Ed() {
    if (Yt === 4 || Yt === 3) {
      Yt = 0, gy();
      var t = Tl, e = Ma, l = al, a = cd;
      (e.subtreeFlags & 10256) !== 0 || (e.flags & 10256) !== 0 ? Yt = 5 : (Yt = 0, Ma = Tl = null, Td(t, t.pendingLanes));
      var n = t.pendingLanes;
      if (n === 0 && (El = null), _i(l), e = e.stateNode, oe && typeof oe.onCommitFiberRoot == "function")
        try {
          oe.onCommitFiberRoot(
            Ga,
            e,
            void 0,
            (e.current.flags & 128) === 128
          );
        } catch {
        }
      if (a !== null) {
        e = M.T, n = H.p, H.p = 2, M.T = null;
        try {
          for (var i = t.onRecoverableError, s = 0; s < a.length; s++) {
            var f = a[s];
            i(f.value, {
              componentStack: f.stack
            });
          }
        } finally {
          M.T = e, H.p = n;
        }
      }
      (al & 3) !== 0 && Ku(), Le(t), n = t.pendingLanes, (l & 261930) !== 0 && (n & 42) !== 0 ? t === hs ? On++ : (On = 0, hs = t) : On = 0, zn(0);
    }
  }
  function Td(t, e) {
    (t.pooledCacheLanes &= e) === 0 && (e = t.pooledCache, e != null && (t.pooledCache = null, nn(e)));
  }
  function Ku() {
    return bd(), Sd(), Ed(), Ad();
  }
  function Ad() {
    if (Yt !== 5) return !1;
    var t = Tl, e = fs;
    fs = 0;
    var l = _i(al), a = M.T, n = H.p;
    try {
      H.p = 32 > l ? 32 : l, M.T = null, l = ds, ds = null;
      var i = Tl, s = al;
      if (Yt = 0, Ma = Tl = null, al = 0, (vt & 6) !== 0) throw Error(r(331));
      var f = vt;
      if (vt |= 4, nd(i.current), ed(
        i,
        i.current,
        s,
        l
      ), vt = f, zn(0, !1), oe && typeof oe.onPostCommitFiberRoot == "function")
        try {
          oe.onPostCommitFiberRoot(Ga, i);
        } catch {
        }
      return !0;
    } finally {
      H.p = n, M.T = a, Td(t, e);
    }
  }
  function Od(t, e, l) {
    e = Oe(l, e), e = Vc(t.stateNode, e, 2), t = ml(t, e, 2), t !== null && (Za(t, 2), Le(t));
  }
  function Tt(t, e, l) {
    if (t.tag === 3)
      Od(t, t, l);
    else
      for (; e !== null; ) {
        if (e.tag === 3) {
          Od(
            e,
            t,
            l
          );
          break;
        } else if (e.tag === 1) {
          var a = e.stateNode;
          if (typeof e.type.getDerivedStateFromError == "function" || typeof a.componentDidCatch == "function" && (El === null || !El.has(a))) {
            t = Oe(l, t), l = zf(2), a = ml(e, l, 2), a !== null && (xf(
              l,
              a,
              e,
              t
            ), Za(a, 2), Le(a));
            break;
          }
        }
        e = e.return;
      }
  }
  function gs(t, e, l) {
    var a = t.pingCache;
    if (a === null) {
      a = t.pingCache = new Gm();
      var n = /* @__PURE__ */ new Set();
      a.set(e, n);
    } else
      n = a.get(e), n === void 0 && (n = /* @__PURE__ */ new Set(), a.set(e, n));
    n.has(l) || (ss = !0, n.add(l), t = Jm.bind(null, t, e, l), e.then(t, t));
  }
  function Jm(t, e, l) {
    var a = t.pingCache;
    a !== null && a.delete(e), t.pingedLanes |= t.suspendedLanes & l, t.warmLanes &= ~l, xt === t && (rt & l) === l && (wt === 4 || wt === 3 && (rt & 62914560) === rt && 300 > re() - Qu ? (vt & 2) === 0 && Ca(t, 0) : rs |= l, xa === rt && (xa = 0)), Le(t);
  }
  function zd(t, e) {
    e === 0 && (e = pr()), t = Bl(t, e), t !== null && (Za(t, e), Le(t));
  }
  function km(t) {
    var e = t.memoizedState, l = 0;
    e !== null && (l = e.retryLane), zd(t, l);
  }
  function Fm(t, e) {
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
        throw Error(r(314));
    }
    a !== null && a.delete(e), zd(t, l);
  }
  function Wm(t, e) {
    return Ri(t, e);
  }
  var Ju = null, ja = null, ps = !1, ku = !1, vs = !1, Ol = 0;
  function Le(t) {
    t !== ja && t.next === null && (ja === null ? Ju = ja = t : ja = ja.next = t), ku = !0, ps || (ps = !0, Im());
  }
  function zn(t, e) {
    if (!vs && ku) {
      vs = !0;
      do
        for (var l = !1, a = Ju; a !== null; ) {
          if (t !== 0) {
            var n = a.pendingLanes;
            if (n === 0) var i = 0;
            else {
              var s = a.suspendedLanes, f = a.pingedLanes;
              i = (1 << 31 - fe(42 | t) + 1) - 1, i &= n & ~(s & ~f), i = i & 201326741 ? i & 201326741 | 1 : i ? i | 2 : 0;
            }
            i !== 0 && (l = !0, Rd(a, i));
          } else
            i = rt, i = In(
              a,
              a === xt ? i : 0,
              a.cancelPendingCommit !== null || a.timeoutHandle !== -1
            ), (i & 3) === 0 || Xa(a, i) || (l = !0, Rd(a, i));
          a = a.next;
        }
      while (l);
      vs = !1;
    }
  }
  function $m() {
    xd();
  }
  function xd() {
    ku = ps = !1;
    var t = 0;
    Ol !== 0 && sg() && (t = Ol);
    for (var e = re(), l = null, a = Ju; a !== null; ) {
      var n = a.next, i = Md(a, e);
      i === 0 ? (a.next = null, l === null ? Ju = n : l.next = n, n === null && (ja = l)) : (l = a, (t !== 0 || (i & 3) !== 0) && (ku = !0)), a = n;
    }
    Yt !== 0 && Yt !== 5 || zn(t), Ol !== 0 && (Ol = 0);
  }
  function Md(t, e) {
    for (var l = t.suspendedLanes, a = t.pingedLanes, n = t.expirationTimes, i = t.pendingLanes & -62914561; 0 < i; ) {
      var s = 31 - fe(i), f = 1 << s, h = n[s];
      h === -1 ? ((f & l) === 0 || (f & a) !== 0) && (n[s] = Oy(f, e)) : h <= e && (t.expiredLanes |= f), i &= ~f;
    }
    if (e = xt, l = rt, l = In(
      t,
      t === e ? l : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), a = t.callbackNode, l === 0 || t === e && (Et === 2 || Et === 9) || t.cancelPendingCommit !== null)
      return a !== null && a !== null && ji(a), t.callbackNode = null, t.callbackPriority = 0;
    if ((l & 3) === 0 || Xa(t, l)) {
      if (e = l & -l, e === t.callbackPriority) return e;
      switch (a !== null && ji(a), _i(l)) {
        case 2:
        case 8:
          l = mr;
          break;
        case 32:
          l = kn;
          break;
        case 268435456:
          l = gr;
          break;
        default:
          l = kn;
      }
      return a = Cd.bind(null, t), l = Ri(l, a), t.callbackPriority = e, t.callbackNode = l, e;
    }
    return a !== null && a !== null && ji(a), t.callbackPriority = 2, t.callbackNode = null, 2;
  }
  function Cd(t, e) {
    if (Yt !== 0 && Yt !== 5)
      return t.callbackNode = null, t.callbackPriority = 0, null;
    var l = t.callbackNode;
    if (Ku() && t.callbackNode !== l)
      return null;
    var a = rt;
    return a = In(
      t,
      t === xt ? a : 0,
      t.cancelPendingCommit !== null || t.timeoutHandle !== -1
    ), a === 0 ? null : (rd(t, a, e), Md(t, re()), t.callbackNode != null && t.callbackNode === l ? Cd.bind(null, t) : null);
  }
  function Rd(t, e) {
    if (Ku()) return null;
    rd(t, e, !0);
  }
  function Im() {
    og(function() {
      (vt & 6) !== 0 ? Ri(
        yr,
        $m
      ) : xd();
    });
  }
  function bs() {
    if (Ol === 0) {
      var t = ma;
      t === 0 && (t = Fn, Fn <<= 1, (Fn & 261888) === 0 && (Fn = 256)), Ol = t;
    }
    return Ol;
  }
  function jd(t) {
    return t == null || typeof t == "symbol" || typeof t == "boolean" ? null : typeof t == "function" ? t : lu("" + t);
  }
  function wd(t, e) {
    var l = e.ownerDocument.createElement("input");
    return l.name = e.name, l.value = e.value, t.id && l.setAttribute("form", t.id), e.parentNode.insertBefore(l, e), t = new FormData(t), l.parentNode.removeChild(l), t;
  }
  function Pm(t, e, l, a, n) {
    if (e === "submit" && l && l.stateNode === n) {
      var i = jd(
        (n[le] || null).action
      ), s = a.submitter;
      s && (e = (e = s[le] || null) ? jd(e.formAction) : s.getAttribute("formAction"), e !== null && (i = e, s = null));
      var f = new iu(
        "action",
        "action",
        null,
        a,
        n
      );
      t.push({
        event: f,
        listeners: [
          {
            instance: null,
            listener: function() {
              if (a.defaultPrevented) {
                if (Ol !== 0) {
                  var h = s ? wd(n, s) : new FormData(n);
                  Lc(
                    l,
                    {
                      pending: !0,
                      data: h,
                      method: n.method,
                      action: i
                    },
                    null,
                    h
                  );
                }
              } else
                typeof i == "function" && (f.preventDefault(), h = s ? wd(n, s) : new FormData(n), Lc(
                  l,
                  {
                    pending: !0,
                    data: h,
                    method: n.method,
                    action: i
                  },
                  i,
                  h
                ));
            },
            currentTarget: n
          }
        ]
      });
    }
  }
  for (var Ss = 0; Ss < lc.length; Ss++) {
    var Es = lc[Ss], tg = Es.toLowerCase(), eg = Es[0].toUpperCase() + Es.slice(1);
    De(
      tg,
      "on" + eg
    );
  }
  De(io, "onAnimationEnd"), De(co, "onAnimationIteration"), De(so, "onAnimationStart"), De("dblclick", "onDoubleClick"), De("focusin", "onFocus"), De("focusout", "onBlur"), De(pm, "onTransitionRun"), De(vm, "onTransitionStart"), De(bm, "onTransitionCancel"), De(ro, "onTransitionEnd"), ea("onMouseEnter", ["mouseout", "mouseover"]), ea("onMouseLeave", ["mouseout", "mouseover"]), ea("onPointerEnter", ["pointerout", "pointerover"]), ea("onPointerLeave", ["pointerout", "pointerover"]), Nl(
    "onChange",
    "change click focusin focusout input keydown keyup selectionchange".split(" ")
  ), Nl(
    "onSelect",
    "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(
      " "
    )
  ), Nl("onBeforeInput", [
    "compositionend",
    "keypress",
    "textInput",
    "paste"
  ]), Nl(
    "onCompositionEnd",
    "compositionend focusout keydown keypress keyup mousedown".split(" ")
  ), Nl(
    "onCompositionStart",
    "compositionstart focusout keydown keypress keyup mousedown".split(" ")
  ), Nl(
    "onCompositionUpdate",
    "compositionupdate focusout keydown keypress keyup mousedown".split(" ")
  );
  var xn = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(
    " "
  ), lg = new Set(
    "beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(xn)
  );
  function Dd(t, e) {
    e = (e & 4) !== 0;
    for (var l = 0; l < t.length; l++) {
      var a = t[l], n = a.event;
      a = a.listeners;
      t: {
        var i = void 0;
        if (e)
          for (var s = a.length - 1; 0 <= s; s--) {
            var f = a[s], h = f.instance, A = f.currentTarget;
            if (f = f.listener, h !== i && n.isPropagationStopped())
              break t;
            i = f, n.currentTarget = A;
            try {
              i(n);
            } catch (C) {
              ru(C);
            }
            n.currentTarget = null, i = h;
          }
        else
          for (s = 0; s < a.length; s++) {
            if (f = a[s], h = f.instance, A = f.currentTarget, f = f.listener, h !== i && n.isPropagationStopped())
              break t;
            i = f, n.currentTarget = A;
            try {
              i(n);
            } catch (C) {
              ru(C);
            }
            n.currentTarget = null, i = h;
          }
      }
    }
  }
  function ct(t, e) {
    var l = e[Ni];
    l === void 0 && (l = e[Ni] = /* @__PURE__ */ new Set());
    var a = t + "__bubble";
    l.has(a) || (_d(e, t, 2, !1), l.add(a));
  }
  function Ts(t, e, l) {
    var a = 0;
    e && (a |= 4), _d(
      l,
      t,
      a,
      e
    );
  }
  var Fu = "_reactListening" + Math.random().toString(36).slice(2);
  function As(t) {
    if (!t[Fu]) {
      t[Fu] = !0, Or.forEach(function(l) {
        l !== "selectionchange" && (lg.has(l) || Ts(l, !1, t), Ts(l, !0, t));
      });
      var e = t.nodeType === 9 ? t : t.ownerDocument;
      e === null || e[Fu] || (e[Fu] = !0, Ts("selectionchange", !1, e));
    }
  }
  function _d(t, e, l, a) {
    switch (sh(e)) {
      case 2:
        var n = jg;
        break;
      case 8:
        n = wg;
        break;
      default:
        n = Bs;
    }
    l = n.bind(
      null,
      e,
      l,
      t
    ), n = void 0, !Xi || e !== "touchstart" && e !== "touchmove" && e !== "wheel" || (n = !0), a ? n !== void 0 ? t.addEventListener(e, l, {
      capture: !0,
      passive: n
    }) : t.addEventListener(e, l, !0) : n !== void 0 ? t.addEventListener(e, l, {
      passive: n
    }) : t.addEventListener(e, l, !1);
  }
  function Os(t, e, l, a, n) {
    var i = a;
    if ((e & 1) === 0 && (e & 2) === 0 && a !== null)
      t: for (; ; ) {
        if (a === null) return;
        var s = a.tag;
        if (s === 3 || s === 4) {
          var f = a.stateNode.containerInfo;
          if (f === n) break;
          if (s === 4)
            for (s = a.return; s !== null; ) {
              var h = s.tag;
              if ((h === 3 || h === 4) && s.stateNode.containerInfo === n)
                return;
              s = s.return;
            }
          for (; f !== null; ) {
            if (s = Il(f), s === null) return;
            if (h = s.tag, h === 5 || h === 6 || h === 26 || h === 27) {
              a = i = s;
              continue t;
            }
            f = f.parentNode;
          }
        }
        a = a.return;
      }
    qr(function() {
      var A = i, C = Yi(l), D = [];
      t: {
        var z = oo.get(t);
        if (z !== void 0) {
          var x = iu, X = t;
          switch (t) {
            case "keypress":
              if (nu(l) === 0) break t;
            case "keydown":
            case "keyup":
              x = Fy;
              break;
            case "focusin":
              X = "focus", x = Ji;
              break;
            case "focusout":
              X = "blur", x = Ji;
              break;
            case "beforeblur":
            case "afterblur":
              x = Ji;
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
              x = Lr;
              break;
            case "drag":
            case "dragend":
            case "dragenter":
            case "dragexit":
            case "dragleave":
            case "dragover":
            case "dragstart":
            case "drop":
              x = Hy;
              break;
            case "touchcancel":
            case "touchend":
            case "touchmove":
            case "touchstart":
              x = Iy;
              break;
            case io:
            case co:
            case so:
              x = Qy;
              break;
            case ro:
              x = tm;
              break;
            case "scroll":
            case "scrollend":
              x = Uy;
              break;
            case "wheel":
              x = lm;
              break;
            case "copy":
            case "cut":
            case "paste":
              x = Gy;
              break;
            case "gotpointercapture":
            case "lostpointercapture":
            case "pointercancel":
            case "pointerdown":
            case "pointermove":
            case "pointerout":
            case "pointerover":
            case "pointerup":
              x = Yr;
              break;
            case "toggle":
            case "beforetoggle":
              x = nm;
          }
          var W = (e & 4) !== 0, zt = !W && (t === "scroll" || t === "scrollend"), v = W ? z !== null ? z + "Capture" : null : z;
          W = [];
          for (var g = A, T; g !== null; ) {
            var j = g;
            if (T = j.stateNode, j = j.tag, j !== 5 && j !== 26 && j !== 27 || T === null || v === null || (j = Ja(g, v), j != null && W.push(
              Mn(g, j, T)
            )), zt) break;
            g = g.return;
          }
          0 < W.length && (z = new x(
            z,
            X,
            null,
            l,
            C
          ), D.push({ event: z, listeners: W }));
        }
      }
      if ((e & 7) === 0) {
        t: {
          if (z = t === "mouseover" || t === "pointerover", x = t === "mouseout" || t === "pointerout", z && l !== Qi && (X = l.relatedTarget || l.fromElement) && (Il(X) || X[$l]))
            break t;
          if ((x || z) && (z = C.window === C ? C : (z = C.ownerDocument) ? z.defaultView || z.parentWindow : window, x ? (X = l.relatedTarget || l.toElement, x = A, X = X ? Il(X) : null, X !== null && (zt = p(X), W = X.tag, X !== zt || W !== 5 && W !== 27 && W !== 6) && (X = null)) : (x = null, X = A), x !== X)) {
            if (W = Lr, j = "onMouseLeave", v = "onMouseEnter", g = "mouse", (t === "pointerout" || t === "pointerover") && (W = Yr, j = "onPointerLeave", v = "onPointerEnter", g = "pointer"), zt = x == null ? z : Ka(x), T = X == null ? z : Ka(X), z = new W(
              j,
              g + "leave",
              x,
              l,
              C
            ), z.target = zt, z.relatedTarget = T, j = null, Il(C) === A && (W = new W(
              v,
              g + "enter",
              X,
              l,
              C
            ), W.target = T, W.relatedTarget = zt, j = W), zt = j, x && X)
              e: {
                for (W = ag, v = x, g = X, T = 0, j = v; j; j = W(j))
                  T++;
                j = 0;
                for (var k = g; k; k = W(k))
                  j++;
                for (; 0 < T - j; )
                  v = W(v), T--;
                for (; 0 < j - T; )
                  g = W(g), j--;
                for (; T--; ) {
                  if (v === g || g !== null && v === g.alternate) {
                    W = v;
                    break e;
                  }
                  v = W(v), g = W(g);
                }
                W = null;
              }
            else W = null;
            x !== null && Nd(
              D,
              z,
              x,
              W,
              !1
            ), X !== null && zt !== null && Nd(
              D,
              zt,
              X,
              W,
              !0
            );
          }
        }
        t: {
          if (z = A ? Ka(A) : window, x = z.nodeName && z.nodeName.toLowerCase(), x === "select" || x === "input" && z.type === "file")
            var mt = Fr;
          else if (Jr(z))
            if (Wr)
              mt = ym;
            else {
              mt = dm;
              var K = fm;
            }
          else
            x = z.nodeName, !x || x.toLowerCase() !== "input" || z.type !== "checkbox" && z.type !== "radio" ? A && Li(A.elementType) && (mt = Fr) : mt = hm;
          if (mt && (mt = mt(t, A))) {
            kr(
              D,
              mt,
              l,
              C
            );
            break t;
          }
          K && K(t, z, A), t === "focusout" && A && z.type === "number" && A.memoizedProps.value != null && Bi(z, "number", z.value);
        }
        switch (K = A ? Ka(A) : window, t) {
          case "focusin":
            (Jr(K) || K.contentEditable === "true") && (ca = K, Pi = A, en = null);
            break;
          case "focusout":
            en = Pi = ca = null;
            break;
          case "mousedown":
            tc = !0;
            break;
          case "contextmenu":
          case "mouseup":
          case "dragend":
            tc = !1, no(D, l, C);
            break;
          case "selectionchange":
            if (gm) break;
          case "keydown":
          case "keyup":
            no(D, l, C);
        }
        var lt;
        if (Fi)
          t: {
            switch (t) {
              case "compositionstart":
                var ot = "onCompositionStart";
                break t;
              case "compositionend":
                ot = "onCompositionEnd";
                break t;
              case "compositionupdate":
                ot = "onCompositionUpdate";
                break t;
            }
            ot = void 0;
          }
        else
          ia ? Vr(t, l) && (ot = "onCompositionEnd") : t === "keydown" && l.keyCode === 229 && (ot = "onCompositionStart");
        ot && (Gr && l.locale !== "ko" && (ia || ot !== "onCompositionStart" ? ot === "onCompositionEnd" && ia && (lt = Hr()) : (sl = C, Zi = "value" in sl ? sl.value : sl.textContent, ia = !0)), K = Wu(A, ot), 0 < K.length && (ot = new Qr(
          ot,
          t,
          null,
          l,
          C
        ), D.push({ event: ot, listeners: K }), lt ? ot.data = lt : (lt = Kr(l), lt !== null && (ot.data = lt)))), (lt = im ? cm(t, l) : sm(t, l)) && (ot = Wu(A, "onBeforeInput"), 0 < ot.length && (K = new Qr(
          "onBeforeInput",
          "beforeinput",
          null,
          l,
          C
        ), D.push({
          event: K,
          listeners: ot
        }), K.data = lt)), Pm(
          D,
          t,
          A,
          l,
          C
        );
      }
      Dd(D, e);
    });
  }
  function Mn(t, e, l) {
    return {
      instance: t,
      listener: e,
      currentTarget: l
    };
  }
  function Wu(t, e) {
    for (var l = e + "Capture", a = []; t !== null; ) {
      var n = t, i = n.stateNode;
      if (n = n.tag, n !== 5 && n !== 26 && n !== 27 || i === null || (n = Ja(t, l), n != null && a.unshift(
        Mn(t, n, i)
      ), n = Ja(t, e), n != null && a.push(
        Mn(t, n, i)
      )), t.tag === 3) return a;
      t = t.return;
    }
    return [];
  }
  function ag(t) {
    if (t === null) return null;
    do
      t = t.return;
    while (t && t.tag !== 5 && t.tag !== 27);
    return t || null;
  }
  function Nd(t, e, l, a, n) {
    for (var i = e._reactName, s = []; l !== null && l !== a; ) {
      var f = l, h = f.alternate, A = f.stateNode;
      if (f = f.tag, h !== null && h === a) break;
      f !== 5 && f !== 26 && f !== 27 || A === null || (h = A, n ? (A = Ja(l, i), A != null && s.unshift(
        Mn(l, A, h)
      )) : n || (A = Ja(l, i), A != null && s.push(
        Mn(l, A, h)
      ))), l = l.return;
    }
    s.length !== 0 && t.push({ event: e, listeners: s });
  }
  var ng = /\r\n?/g, ug = /\u0000|\uFFFD/g;
  function Ud(t) {
    return (typeof t == "string" ? t : "" + t).replace(ng, `
`).replace(ug, "");
  }
  function qd(t, e) {
    return e = Ud(e), Ud(t) === e;
  }
  function Ot(t, e, l, a, n, i) {
    switch (l) {
      case "children":
        typeof a == "string" ? e === "body" || e === "textarea" && a === "" || aa(t, a) : (typeof a == "number" || typeof a == "bigint") && e !== "body" && aa(t, "" + a);
        break;
      case "className":
        tu(t, "class", a);
        break;
      case "tabIndex":
        tu(t, "tabindex", a);
        break;
      case "dir":
      case "role":
      case "viewBox":
      case "width":
      case "height":
        tu(t, l, a);
        break;
      case "style":
        Nr(t, a, i);
        break;
      case "data":
        if (e !== "object") {
          tu(t, "data", a);
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
        a = lu("" + a), t.setAttribute(l, a);
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
          typeof i == "function" && (l === "formAction" ? (e !== "input" && Ot(t, e, "name", n.name, n, null), Ot(
            t,
            e,
            "formEncType",
            n.formEncType,
            n,
            null
          ), Ot(
            t,
            e,
            "formMethod",
            n.formMethod,
            n,
            null
          ), Ot(
            t,
            e,
            "formTarget",
            n.formTarget,
            n,
            null
          )) : (Ot(t, e, "encType", n.encType, n, null), Ot(t, e, "method", n.method, n, null), Ot(t, e, "target", n.target, n, null)));
        if (a == null || typeof a == "symbol" || typeof a == "boolean") {
          t.removeAttribute(l);
          break;
        }
        a = lu("" + a), t.setAttribute(l, a);
        break;
      case "onClick":
        a != null && (t.onclick = Ge);
        break;
      case "onScroll":
        a != null && ct("scroll", t);
        break;
      case "onScrollEnd":
        a != null && ct("scrollend", t);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(r(61));
          if (l = a.__html, l != null) {
            if (n.children != null) throw Error(r(60));
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
        l = lu("" + a), t.setAttributeNS(
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
        ct("beforetoggle", t), ct("toggle", t), Pn(t, "popover", a);
        break;
      case "xlinkActuate":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:actuate",
          a
        );
        break;
      case "xlinkArcrole":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:arcrole",
          a
        );
        break;
      case "xlinkRole":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:role",
          a
        );
        break;
      case "xlinkShow":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:show",
          a
        );
        break;
      case "xlinkTitle":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:title",
          a
        );
        break;
      case "xlinkType":
        Ye(
          t,
          "http://www.w3.org/1999/xlink",
          "xlink:type",
          a
        );
        break;
      case "xmlBase":
        Ye(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:base",
          a
        );
        break;
      case "xmlLang":
        Ye(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:lang",
          a
        );
        break;
      case "xmlSpace":
        Ye(
          t,
          "http://www.w3.org/XML/1998/namespace",
          "xml:space",
          a
        );
        break;
      case "is":
        Pn(t, "is", a);
        break;
      case "innerText":
      case "textContent":
        break;
      default:
        (!(2 < l.length) || l[0] !== "o" && l[0] !== "O" || l[1] !== "n" && l[1] !== "N") && (l = _y.get(l) || l, Pn(t, l, a));
    }
  }
  function zs(t, e, l, a, n, i) {
    switch (l) {
      case "style":
        Nr(t, a, i);
        break;
      case "dangerouslySetInnerHTML":
        if (a != null) {
          if (typeof a != "object" || !("__html" in a))
            throw Error(r(61));
          if (l = a.__html, l != null) {
            if (n.children != null) throw Error(r(60));
            t.innerHTML = l;
          }
        }
        break;
      case "children":
        typeof a == "string" ? aa(t, a) : (typeof a == "number" || typeof a == "bigint") && aa(t, "" + a);
        break;
      case "onScroll":
        a != null && ct("scroll", t);
        break;
      case "onScrollEnd":
        a != null && ct("scrollend", t);
        break;
      case "onClick":
        a != null && (t.onclick = Ge);
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
        if (!zr.hasOwnProperty(l))
          t: {
            if (l[0] === "o" && l[1] === "n" && (n = l.endsWith("Capture"), e = l.slice(2, n ? l.length - 7 : void 0), i = t[le] || null, i = i != null ? i[l] : null, typeof i == "function" && t.removeEventListener(e, i, n), typeof a == "function")) {
              typeof i != "function" && i !== null && (l in t ? t[l] = null : t.hasAttribute(l) && t.removeAttribute(l)), t.addEventListener(e, a, n);
              break t;
            }
            l in t ? t[l] = a : a === !0 ? t.setAttribute(l, "") : Pn(t, l, a);
          }
    }
  }
  function Ft(t, e, l) {
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
        var a = !1, n = !1, i;
        for (i in l)
          if (l.hasOwnProperty(i)) {
            var s = l[i];
            if (s != null)
              switch (i) {
                case "src":
                  a = !0;
                  break;
                case "srcSet":
                  n = !0;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  throw Error(r(137, e));
                default:
                  Ot(t, e, i, s, l, null);
              }
          }
        n && Ot(t, e, "srcSet", l.srcSet, l, null), a && Ot(t, e, "src", l.src, l, null);
        return;
      case "input":
        ct("invalid", t);
        var f = i = s = n = null, h = null, A = null;
        for (a in l)
          if (l.hasOwnProperty(a)) {
            var C = l[a];
            if (C != null)
              switch (a) {
                case "name":
                  n = C;
                  break;
                case "type":
                  s = C;
                  break;
                case "checked":
                  h = C;
                  break;
                case "defaultChecked":
                  A = C;
                  break;
                case "value":
                  i = C;
                  break;
                case "defaultValue":
                  f = C;
                  break;
                case "children":
                case "dangerouslySetInnerHTML":
                  if (C != null)
                    throw Error(r(137, e));
                  break;
                default:
                  Ot(t, e, a, C, l, null);
              }
          }
        jr(
          t,
          i,
          f,
          h,
          A,
          s,
          n,
          !1
        );
        return;
      case "select":
        ct("invalid", t), a = s = i = null;
        for (n in l)
          if (l.hasOwnProperty(n) && (f = l[n], f != null))
            switch (n) {
              case "value":
                i = f;
                break;
              case "defaultValue":
                s = f;
                break;
              case "multiple":
                a = f;
              default:
                Ot(t, e, n, f, l, null);
            }
        e = i, l = s, t.multiple = !!a, e != null ? la(t, !!a, e, !1) : l != null && la(t, !!a, l, !0);
        return;
      case "textarea":
        ct("invalid", t), i = n = a = null;
        for (s in l)
          if (l.hasOwnProperty(s) && (f = l[s], f != null))
            switch (s) {
              case "value":
                a = f;
                break;
              case "defaultValue":
                n = f;
                break;
              case "children":
                i = f;
                break;
              case "dangerouslySetInnerHTML":
                if (f != null) throw Error(r(91));
                break;
              default:
                Ot(t, e, s, f, l, null);
            }
        Dr(t, a, n, i);
        return;
      case "option":
        for (h in l)
          l.hasOwnProperty(h) && (a = l[h], a != null) && (h === "selected" ? t.selected = a && typeof a != "function" && typeof a != "symbol" : Ot(t, e, h, a, l, null));
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
        for (a = 0; a < xn.length; a++)
          ct(xn[a], t);
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
        for (A in l)
          if (l.hasOwnProperty(A) && (a = l[A], a != null))
            switch (A) {
              case "children":
              case "dangerouslySetInnerHTML":
                throw Error(r(137, e));
              default:
                Ot(t, e, A, a, l, null);
            }
        return;
      default:
        if (Li(e)) {
          for (C in l)
            l.hasOwnProperty(C) && (a = l[C], a !== void 0 && zs(
              t,
              e,
              C,
              a,
              l,
              void 0
            ));
          return;
        }
    }
    for (f in l)
      l.hasOwnProperty(f) && (a = l[f], a != null && Ot(t, e, f, a, l, null));
  }
  function ig(t, e, l, a) {
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
        var n = null, i = null, s = null, f = null, h = null, A = null, C = null;
        for (x in l) {
          var D = l[x];
          if (l.hasOwnProperty(x) && D != null)
            switch (x) {
              case "checked":
                break;
              case "value":
                break;
              case "defaultValue":
                h = D;
              default:
                a.hasOwnProperty(x) || Ot(t, e, x, null, a, D);
            }
        }
        for (var z in a) {
          var x = a[z];
          if (D = l[z], a.hasOwnProperty(z) && (x != null || D != null))
            switch (z) {
              case "type":
                i = x;
                break;
              case "name":
                n = x;
                break;
              case "checked":
                A = x;
                break;
              case "defaultChecked":
                C = x;
                break;
              case "value":
                s = x;
                break;
              case "defaultValue":
                f = x;
                break;
              case "children":
              case "dangerouslySetInnerHTML":
                if (x != null)
                  throw Error(r(137, e));
                break;
              default:
                x !== D && Ot(
                  t,
                  e,
                  z,
                  x,
                  a,
                  D
                );
            }
        }
        Hi(
          t,
          s,
          f,
          h,
          A,
          C,
          i,
          n
        );
        return;
      case "select":
        x = s = f = z = null;
        for (i in l)
          if (h = l[i], l.hasOwnProperty(i) && h != null)
            switch (i) {
              case "value":
                break;
              case "multiple":
                x = h;
              default:
                a.hasOwnProperty(i) || Ot(
                  t,
                  e,
                  i,
                  null,
                  a,
                  h
                );
            }
        for (n in a)
          if (i = a[n], h = l[n], a.hasOwnProperty(n) && (i != null || h != null))
            switch (n) {
              case "value":
                z = i;
                break;
              case "defaultValue":
                f = i;
                break;
              case "multiple":
                s = i;
              default:
                i !== h && Ot(
                  t,
                  e,
                  n,
                  i,
                  a,
                  h
                );
            }
        e = f, l = s, a = x, z != null ? la(t, !!l, z, !1) : !!a != !!l && (e != null ? la(t, !!l, e, !0) : la(t, !!l, l ? [] : "", !1));
        return;
      case "textarea":
        x = z = null;
        for (f in l)
          if (n = l[f], l.hasOwnProperty(f) && n != null && !a.hasOwnProperty(f))
            switch (f) {
              case "value":
                break;
              case "children":
                break;
              default:
                Ot(t, e, f, null, a, n);
            }
        for (s in a)
          if (n = a[s], i = l[s], a.hasOwnProperty(s) && (n != null || i != null))
            switch (s) {
              case "value":
                z = n;
                break;
              case "defaultValue":
                x = n;
                break;
              case "children":
                break;
              case "dangerouslySetInnerHTML":
                if (n != null) throw Error(r(91));
                break;
              default:
                n !== i && Ot(t, e, s, n, a, i);
            }
        wr(t, z, x);
        return;
      case "option":
        for (var X in l)
          z = l[X], l.hasOwnProperty(X) && z != null && !a.hasOwnProperty(X) && (X === "selected" ? t.selected = !1 : Ot(
            t,
            e,
            X,
            null,
            a,
            z
          ));
        for (h in a)
          z = a[h], x = l[h], a.hasOwnProperty(h) && z !== x && (z != null || x != null) && (h === "selected" ? t.selected = z && typeof z != "function" && typeof z != "symbol" : Ot(
            t,
            e,
            h,
            z,
            a,
            x
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
        for (var W in l)
          z = l[W], l.hasOwnProperty(W) && z != null && !a.hasOwnProperty(W) && Ot(t, e, W, null, a, z);
        for (A in a)
          if (z = a[A], x = l[A], a.hasOwnProperty(A) && z !== x && (z != null || x != null))
            switch (A) {
              case "children":
              case "dangerouslySetInnerHTML":
                if (z != null)
                  throw Error(r(137, e));
                break;
              default:
                Ot(
                  t,
                  e,
                  A,
                  z,
                  a,
                  x
                );
            }
        return;
      default:
        if (Li(e)) {
          for (var zt in l)
            z = l[zt], l.hasOwnProperty(zt) && z !== void 0 && !a.hasOwnProperty(zt) && zs(
              t,
              e,
              zt,
              void 0,
              a,
              z
            );
          for (C in a)
            z = a[C], x = l[C], !a.hasOwnProperty(C) || z === x || z === void 0 && x === void 0 || zs(
              t,
              e,
              C,
              z,
              a,
              x
            );
          return;
        }
    }
    for (var v in l)
      z = l[v], l.hasOwnProperty(v) && z != null && !a.hasOwnProperty(v) && Ot(t, e, v, null, a, z);
    for (D in a)
      z = a[D], x = l[D], !a.hasOwnProperty(D) || z === x || z == null && x == null || Ot(t, e, D, z, a, x);
  }
  function Hd(t) {
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
  function cg() {
    if (typeof performance.getEntriesByType == "function") {
      for (var t = 0, e = 0, l = performance.getEntriesByType("resource"), a = 0; a < l.length; a++) {
        var n = l[a], i = n.transferSize, s = n.initiatorType, f = n.duration;
        if (i && f && Hd(s)) {
          for (s = 0, f = n.responseEnd, a += 1; a < l.length; a++) {
            var h = l[a], A = h.startTime;
            if (A > f) break;
            var C = h.transferSize, D = h.initiatorType;
            C && Hd(D) && (h = h.responseEnd, s += C * (h < f ? 1 : (f - A) / (h - A)));
          }
          if (--a, e += 8 * (i + s) / (n.duration / 1e3), t++, 10 < t) break;
        }
      }
      if (0 < t) return e / t / 1e6;
    }
    return navigator.connection && (t = navigator.connection.downlink, typeof t == "number") ? t : 5;
  }
  var xs = null, Ms = null;
  function $u(t) {
    return t.nodeType === 9 ? t : t.ownerDocument;
  }
  function Bd(t) {
    switch (t) {
      case "http://www.w3.org/2000/svg":
        return 1;
      case "http://www.w3.org/1998/Math/MathML":
        return 2;
      default:
        return 0;
    }
  }
  function Ld(t, e) {
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
  function Cs(t, e) {
    return t === "textarea" || t === "noscript" || typeof e.children == "string" || typeof e.children == "number" || typeof e.children == "bigint" || typeof e.dangerouslySetInnerHTML == "object" && e.dangerouslySetInnerHTML !== null && e.dangerouslySetInnerHTML.__html != null;
  }
  var Rs = null;
  function sg() {
    var t = window.event;
    return t && t.type === "popstate" ? t === Rs ? !1 : (Rs = t, !0) : (Rs = null, !1);
  }
  var Qd = typeof setTimeout == "function" ? setTimeout : void 0, rg = typeof clearTimeout == "function" ? clearTimeout : void 0, Yd = typeof Promise == "function" ? Promise : void 0, og = typeof queueMicrotask == "function" ? queueMicrotask : typeof Yd < "u" ? function(t) {
    return Yd.resolve(null).then(t).catch(fg);
  } : Qd;
  function fg(t) {
    setTimeout(function() {
      throw t;
    });
  }
  function zl(t) {
    return t === "head";
  }
  function Gd(t, e) {
    var l = e, a = 0;
    do {
      var n = l.nextSibling;
      if (t.removeChild(l), n && n.nodeType === 8)
        if (l = n.data, l === "/$" || l === "/&") {
          if (a === 0) {
            t.removeChild(n), Na(e);
            return;
          }
          a--;
        } else if (l === "$" || l === "$?" || l === "$~" || l === "$!" || l === "&")
          a++;
        else if (l === "html")
          Cn(t.ownerDocument.documentElement);
        else if (l === "head") {
          l = t.ownerDocument.head, Cn(l);
          for (var i = l.firstChild; i; ) {
            var s = i.nextSibling, f = i.nodeName;
            i[Va] || f === "SCRIPT" || f === "STYLE" || f === "LINK" && i.rel.toLowerCase() === "stylesheet" || l.removeChild(i), i = s;
          }
        } else
          l === "body" && Cn(t.ownerDocument.body);
      l = n;
    } while (l);
    Na(e);
  }
  function Xd(t, e) {
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
  function js(t) {
    var e = t.firstChild;
    for (e && e.nodeType === 10 && (e = e.nextSibling); e; ) {
      var l = e;
      switch (e = e.nextSibling, l.nodeName) {
        case "HTML":
        case "HEAD":
        case "BODY":
          js(l), Ui(l);
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
  function dg(t, e, l, a) {
    for (; t.nodeType === 1; ) {
      var n = l;
      if (t.nodeName.toLowerCase() !== e.toLowerCase()) {
        if (!a && (t.nodeName !== "INPUT" || t.type !== "hidden"))
          break;
      } else if (a) {
        if (!t[Va])
          switch (e) {
            case "meta":
              if (!t.hasAttribute("itemprop")) break;
              return t;
            case "link":
              if (i = t.getAttribute("rel"), i === "stylesheet" && t.hasAttribute("data-precedence"))
                break;
              if (i !== n.rel || t.getAttribute("href") !== (n.href == null || n.href === "" ? null : n.href) || t.getAttribute("crossorigin") !== (n.crossOrigin == null ? null : n.crossOrigin) || t.getAttribute("title") !== (n.title == null ? null : n.title))
                break;
              return t;
            case "style":
              if (t.hasAttribute("data-precedence")) break;
              return t;
            case "script":
              if (i = t.getAttribute("src"), (i !== (n.src == null ? null : n.src) || t.getAttribute("type") !== (n.type == null ? null : n.type) || t.getAttribute("crossorigin") !== (n.crossOrigin == null ? null : n.crossOrigin)) && i && t.hasAttribute("async") && !t.hasAttribute("itemprop"))
                break;
              return t;
            default:
              return t;
          }
      } else if (e === "input" && t.type === "hidden") {
        var i = n.name == null ? null : "" + n.name;
        if (n.type === "hidden" && t.getAttribute("name") === i)
          return t;
      } else return t;
      if (t = Re(t.nextSibling), t === null) break;
    }
    return null;
  }
  function hg(t, e, l) {
    if (e === "") return null;
    for (; t.nodeType !== 3; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !l || (t = Re(t.nextSibling), t === null)) return null;
    return t;
  }
  function Zd(t, e) {
    for (; t.nodeType !== 8; )
      if ((t.nodeType !== 1 || t.nodeName !== "INPUT" || t.type !== "hidden") && !e || (t = Re(t.nextSibling), t === null)) return null;
    return t;
  }
  function ws(t) {
    return t.data === "$?" || t.data === "$~";
  }
  function Ds(t) {
    return t.data === "$!" || t.data === "$?" && t.ownerDocument.readyState !== "loading";
  }
  function yg(t, e) {
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
  function Re(t) {
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
  var _s = null;
  function Vd(t) {
    t = t.nextSibling;
    for (var e = 0; t; ) {
      if (t.nodeType === 8) {
        var l = t.data;
        if (l === "/$" || l === "/&") {
          if (e === 0)
            return Re(t.nextSibling);
          e--;
        } else
          l !== "$" && l !== "$!" && l !== "$?" && l !== "$~" && l !== "&" || e++;
      }
      t = t.nextSibling;
    }
    return null;
  }
  function Kd(t) {
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
  function Jd(t, e, l) {
    switch (e = $u(l), t) {
      case "html":
        if (t = e.documentElement, !t) throw Error(r(452));
        return t;
      case "head":
        if (t = e.head, !t) throw Error(r(453));
        return t;
      case "body":
        if (t = e.body, !t) throw Error(r(454));
        return t;
      default:
        throw Error(r(451));
    }
  }
  function Cn(t) {
    for (var e = t.attributes; e.length; )
      t.removeAttributeNode(e[0]);
    Ui(t);
  }
  var je = /* @__PURE__ */ new Map(), kd = /* @__PURE__ */ new Set();
  function Iu(t) {
    return typeof t.getRootNode == "function" ? t.getRootNode() : t.nodeType === 9 ? t : t.ownerDocument;
  }
  var nl = H.d;
  H.d = {
    f: mg,
    r: gg,
    D: pg,
    C: vg,
    L: bg,
    m: Sg,
    X: Tg,
    S: Eg,
    M: Ag
  };
  function mg() {
    var t = nl.f(), e = Xu();
    return t || e;
  }
  function gg(t) {
    var e = Pl(t);
    e !== null && e.tag === 5 && e.type === "form" ? ff(e) : nl.r(t);
  }
  var wa = typeof document > "u" ? null : document;
  function Fd(t, e, l) {
    var a = wa;
    if (a && typeof e == "string" && e) {
      var n = Te(e);
      n = 'link[rel="' + t + '"][href="' + n + '"]', typeof l == "string" && (n += '[crossorigin="' + l + '"]'), kd.has(n) || (kd.add(n), t = { rel: t, crossOrigin: l, href: e }, a.querySelector(n) === null && (e = a.createElement("link"), Ft(e, "link", t), Gt(e), a.head.appendChild(e)));
    }
  }
  function pg(t) {
    nl.D(t), Fd("dns-prefetch", t, null);
  }
  function vg(t, e) {
    nl.C(t, e), Fd("preconnect", t, e);
  }
  function bg(t, e, l) {
    nl.L(t, e, l);
    var a = wa;
    if (a && t && e) {
      var n = 'link[rel="preload"][as="' + Te(e) + '"]';
      e === "image" && l && l.imageSrcSet ? (n += '[imagesrcset="' + Te(
        l.imageSrcSet
      ) + '"]', typeof l.imageSizes == "string" && (n += '[imagesizes="' + Te(
        l.imageSizes
      ) + '"]')) : n += '[href="' + Te(t) + '"]';
      var i = n;
      switch (e) {
        case "style":
          i = Da(t);
          break;
        case "script":
          i = _a(t);
      }
      je.has(i) || (t = _(
        {
          rel: "preload",
          href: e === "image" && l && l.imageSrcSet ? void 0 : t,
          as: e
        },
        l
      ), je.set(i, t), a.querySelector(n) !== null || e === "style" && a.querySelector(Rn(i)) || e === "script" && a.querySelector(jn(i)) || (e = a.createElement("link"), Ft(e, "link", t), Gt(e), a.head.appendChild(e)));
    }
  }
  function Sg(t, e) {
    nl.m(t, e);
    var l = wa;
    if (l && t) {
      var a = e && typeof e.as == "string" ? e.as : "script", n = 'link[rel="modulepreload"][as="' + Te(a) + '"][href="' + Te(t) + '"]', i = n;
      switch (a) {
        case "audioworklet":
        case "paintworklet":
        case "serviceworker":
        case "sharedworker":
        case "worker":
        case "script":
          i = _a(t);
      }
      if (!je.has(i) && (t = _({ rel: "modulepreload", href: t }, e), je.set(i, t), l.querySelector(n) === null)) {
        switch (a) {
          case "audioworklet":
          case "paintworklet":
          case "serviceworker":
          case "sharedworker":
          case "worker":
          case "script":
            if (l.querySelector(jn(i)))
              return;
        }
        a = l.createElement("link"), Ft(a, "link", t), Gt(a), l.head.appendChild(a);
      }
    }
  }
  function Eg(t, e, l) {
    nl.S(t, e, l);
    var a = wa;
    if (a && t) {
      var n = ta(a).hoistableStyles, i = Da(t);
      e = e || "default";
      var s = n.get(i);
      if (!s) {
        var f = { loading: 0, preload: null };
        if (s = a.querySelector(
          Rn(i)
        ))
          f.loading = 5;
        else {
          t = _(
            { rel: "stylesheet", href: t, "data-precedence": e },
            l
          ), (l = je.get(i)) && Ns(t, l);
          var h = s = a.createElement("link");
          Gt(h), Ft(h, "link", t), h._p = new Promise(function(A, C) {
            h.onload = A, h.onerror = C;
          }), h.addEventListener("load", function() {
            f.loading |= 1;
          }), h.addEventListener("error", function() {
            f.loading |= 2;
          }), f.loading |= 4, Pu(s, e, a);
        }
        s = {
          type: "stylesheet",
          instance: s,
          count: 1,
          state: f
        }, n.set(i, s);
      }
    }
  }
  function Tg(t, e) {
    nl.X(t, e);
    var l = wa;
    if (l && t) {
      var a = ta(l).hoistableScripts, n = _a(t), i = a.get(n);
      i || (i = l.querySelector(jn(n)), i || (t = _({ src: t, async: !0 }, e), (e = je.get(n)) && Us(t, e), i = l.createElement("script"), Gt(i), Ft(i, "link", t), l.head.appendChild(i)), i = {
        type: "script",
        instance: i,
        count: 1,
        state: null
      }, a.set(n, i));
    }
  }
  function Ag(t, e) {
    nl.M(t, e);
    var l = wa;
    if (l && t) {
      var a = ta(l).hoistableScripts, n = _a(t), i = a.get(n);
      i || (i = l.querySelector(jn(n)), i || (t = _({ src: t, async: !0, type: "module" }, e), (e = je.get(n)) && Us(t, e), i = l.createElement("script"), Gt(i), Ft(i, "link", t), l.head.appendChild(i)), i = {
        type: "script",
        instance: i,
        count: 1,
        state: null
      }, a.set(n, i));
    }
  }
  function Wd(t, e, l, a) {
    var n = (n = ut.current) ? Iu(n) : null;
    if (!n) throw Error(r(446));
    switch (t) {
      case "meta":
      case "title":
        return null;
      case "style":
        return typeof l.precedence == "string" && typeof l.href == "string" ? (e = Da(l.href), l = ta(
          n
        ).hoistableStyles, a = l.get(e), a || (a = {
          type: "style",
          instance: null,
          count: 0,
          state: null
        }, l.set(e, a)), a) : { type: "void", instance: null, count: 0, state: null };
      case "link":
        if (l.rel === "stylesheet" && typeof l.href == "string" && typeof l.precedence == "string") {
          t = Da(l.href);
          var i = ta(
            n
          ).hoistableStyles, s = i.get(t);
          if (s || (n = n.ownerDocument || n, s = {
            type: "stylesheet",
            instance: null,
            count: 0,
            state: { loading: 0, preload: null }
          }, i.set(t, s), (i = n.querySelector(
            Rn(t)
          )) && !i._p && (s.instance = i, s.state.loading = 5), je.has(t) || (l = {
            rel: "preload",
            as: "style",
            href: l.href,
            crossOrigin: l.crossOrigin,
            integrity: l.integrity,
            media: l.media,
            hrefLang: l.hrefLang,
            referrerPolicy: l.referrerPolicy
          }, je.set(t, l), i || Og(
            n,
            t,
            l,
            s.state
          ))), e && a === null)
            throw Error(r(528, ""));
          return s;
        }
        if (e && a !== null)
          throw Error(r(529, ""));
        return null;
      case "script":
        return e = l.async, l = l.src, typeof l == "string" && e && typeof e != "function" && typeof e != "symbol" ? (e = _a(l), l = ta(
          n
        ).hoistableScripts, a = l.get(e), a || (a = {
          type: "script",
          instance: null,
          count: 0,
          state: null
        }, l.set(e, a)), a) : { type: "void", instance: null, count: 0, state: null };
      default:
        throw Error(r(444, t));
    }
  }
  function Da(t) {
    return 'href="' + Te(t) + '"';
  }
  function Rn(t) {
    return 'link[rel="stylesheet"][' + t + "]";
  }
  function $d(t) {
    return _({}, t, {
      "data-precedence": t.precedence,
      precedence: null
    });
  }
  function Og(t, e, l, a) {
    t.querySelector('link[rel="preload"][as="style"][' + e + "]") ? a.loading = 1 : (e = t.createElement("link"), a.preload = e, e.addEventListener("load", function() {
      return a.loading |= 1;
    }), e.addEventListener("error", function() {
      return a.loading |= 2;
    }), Ft(e, "link", l), Gt(e), t.head.appendChild(e));
  }
  function _a(t) {
    return '[src="' + Te(t) + '"]';
  }
  function jn(t) {
    return "script[async]" + t;
  }
  function Id(t, e, l) {
    if (e.count++, e.instance === null)
      switch (e.type) {
        case "style":
          var a = t.querySelector(
            'style[data-href~="' + Te(l.href) + '"]'
          );
          if (a)
            return e.instance = a, Gt(a), a;
          var n = _({}, l, {
            "data-href": l.href,
            "data-precedence": l.precedence,
            href: null,
            precedence: null
          });
          return a = (t.ownerDocument || t).createElement(
            "style"
          ), Gt(a), Ft(a, "style", n), Pu(a, l.precedence, t), e.instance = a;
        case "stylesheet":
          n = Da(l.href);
          var i = t.querySelector(
            Rn(n)
          );
          if (i)
            return e.state.loading |= 4, e.instance = i, Gt(i), i;
          a = $d(l), (n = je.get(n)) && Ns(a, n), i = (t.ownerDocument || t).createElement("link"), Gt(i);
          var s = i;
          return s._p = new Promise(function(f, h) {
            s.onload = f, s.onerror = h;
          }), Ft(i, "link", a), e.state.loading |= 4, Pu(i, l.precedence, t), e.instance = i;
        case "script":
          return i = _a(l.src), (n = t.querySelector(
            jn(i)
          )) ? (e.instance = n, Gt(n), n) : (a = l, (n = je.get(i)) && (a = _({}, l), Us(a, n)), t = t.ownerDocument || t, n = t.createElement("script"), Gt(n), Ft(n, "link", a), t.head.appendChild(n), e.instance = n);
        case "void":
          return null;
        default:
          throw Error(r(443, e.type));
      }
    else
      e.type === "stylesheet" && (e.state.loading & 4) === 0 && (a = e.instance, e.state.loading |= 4, Pu(a, l.precedence, t));
    return e.instance;
  }
  function Pu(t, e, l) {
    for (var a = l.querySelectorAll(
      'link[rel="stylesheet"][data-precedence],style[data-precedence]'
    ), n = a.length ? a[a.length - 1] : null, i = n, s = 0; s < a.length; s++) {
      var f = a[s];
      if (f.dataset.precedence === e) i = f;
      else if (i !== n) break;
    }
    i ? i.parentNode.insertBefore(t, i.nextSibling) : (e = l.nodeType === 9 ? l.head : l, e.insertBefore(t, e.firstChild));
  }
  function Ns(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.title == null && (t.title = e.title);
  }
  function Us(t, e) {
    t.crossOrigin == null && (t.crossOrigin = e.crossOrigin), t.referrerPolicy == null && (t.referrerPolicy = e.referrerPolicy), t.integrity == null && (t.integrity = e.integrity);
  }
  var ti = null;
  function Pd(t, e, l) {
    if (ti === null) {
      var a = /* @__PURE__ */ new Map(), n = ti = /* @__PURE__ */ new Map();
      n.set(l, a);
    } else
      n = ti, a = n.get(l), a || (a = /* @__PURE__ */ new Map(), n.set(l, a));
    if (a.has(t)) return a;
    for (a.set(t, null), l = l.getElementsByTagName(t), n = 0; n < l.length; n++) {
      var i = l[n];
      if (!(i[Va] || i[Vt] || t === "link" && i.getAttribute("rel") === "stylesheet") && i.namespaceURI !== "http://www.w3.org/2000/svg") {
        var s = i.getAttribute(e) || "";
        s = t + s;
        var f = a.get(s);
        f ? f.push(i) : a.set(s, [i]);
      }
    }
    return a;
  }
  function th(t, e, l) {
    t = t.ownerDocument || t, t.head.insertBefore(
      l,
      e === "title" ? t.querySelector("head > title") : null
    );
  }
  function zg(t, e, l) {
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
  function eh(t) {
    return !(t.type === "stylesheet" && (t.state.loading & 3) === 0);
  }
  function xg(t, e, l, a) {
    if (l.type === "stylesheet" && (typeof a.media != "string" || matchMedia(a.media).matches !== !1) && (l.state.loading & 4) === 0) {
      if (l.instance === null) {
        var n = Da(a.href), i = e.querySelector(
          Rn(n)
        );
        if (i) {
          e = i._p, e !== null && typeof e == "object" && typeof e.then == "function" && (t.count++, t = ei.bind(t), e.then(t, t)), l.state.loading |= 4, l.instance = i, Gt(i);
          return;
        }
        i = e.ownerDocument || e, a = $d(a), (n = je.get(n)) && Ns(a, n), i = i.createElement("link"), Gt(i);
        var s = i;
        s._p = new Promise(function(f, h) {
          s.onload = f, s.onerror = h;
        }), Ft(i, "link", a), l.instance = i;
      }
      t.stylesheets === null && (t.stylesheets = /* @__PURE__ */ new Map()), t.stylesheets.set(l, e), (e = l.state.preload) && (l.state.loading & 3) === 0 && (t.count++, l = ei.bind(t), e.addEventListener("load", l), e.addEventListener("error", l));
    }
  }
  var qs = 0;
  function Mg(t, e) {
    return t.stylesheets && t.count === 0 && ai(t, t.stylesheets), 0 < t.count || 0 < t.imgCount ? function(l) {
      var a = setTimeout(function() {
        if (t.stylesheets && ai(t, t.stylesheets), t.unsuspend) {
          var i = t.unsuspend;
          t.unsuspend = null, i();
        }
      }, 6e4 + e);
      0 < t.imgBytes && qs === 0 && (qs = 62500 * cg());
      var n = setTimeout(
        function() {
          if (t.waitingForImages = !1, t.count === 0 && (t.stylesheets && ai(t, t.stylesheets), t.unsuspend)) {
            var i = t.unsuspend;
            t.unsuspend = null, i();
          }
        },
        (t.imgBytes > qs ? 50 : 800) + e
      );
      return t.unsuspend = l, function() {
        t.unsuspend = null, clearTimeout(a), clearTimeout(n);
      };
    } : null;
  }
  function ei() {
    if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
      if (this.stylesheets) ai(this, this.stylesheets);
      else if (this.unsuspend) {
        var t = this.unsuspend;
        this.unsuspend = null, t();
      }
    }
  }
  var li = null;
  function ai(t, e) {
    t.stylesheets = null, t.unsuspend !== null && (t.count++, li = /* @__PURE__ */ new Map(), e.forEach(Cg, t), li = null, ei.call(t));
  }
  function Cg(t, e) {
    if (!(e.state.loading & 4)) {
      var l = li.get(t);
      if (l) var a = l.get(null);
      else {
        l = /* @__PURE__ */ new Map(), li.set(t, l);
        for (var n = t.querySelectorAll(
          "link[data-precedence],style[data-precedence]"
        ), i = 0; i < n.length; i++) {
          var s = n[i];
          (s.nodeName === "LINK" || s.getAttribute("media") !== "not all") && (l.set(s.dataset.precedence, s), a = s);
        }
        a && l.set(null, a);
      }
      n = e.instance, s = n.getAttribute("data-precedence"), i = l.get(s) || a, i === a && l.set(null, n), l.set(s, n), this.count++, a = ei.bind(this), n.addEventListener("load", a), n.addEventListener("error", a), i ? i.parentNode.insertBefore(n, i.nextSibling) : (t = t.nodeType === 9 ? t.head : t, t.insertBefore(n, t.firstChild)), e.state.loading |= 4;
    }
  }
  var wn = {
    $$typeof: dt,
    Provider: null,
    Consumer: null,
    _currentValue: F,
    _currentValue2: F,
    _threadCount: 0
  };
  function Rg(t, e, l, a, n, i, s, f, h) {
    this.tag = 1, this.containerInfo = t, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = wi(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = wi(0), this.hiddenUpdates = wi(null), this.identifierPrefix = a, this.onUncaughtError = n, this.onCaughtError = i, this.onRecoverableError = s, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = h, this.incompleteTransitions = /* @__PURE__ */ new Map();
  }
  function lh(t, e, l, a, n, i, s, f, h, A, C, D) {
    return t = new Rg(
      t,
      e,
      l,
      s,
      h,
      A,
      C,
      D,
      f
    ), e = 1, i === !0 && (e |= 24), i = he(3, null, null, e), t.current = i, i.stateNode = t, e = mc(), e.refCount++, t.pooledCache = e, e.refCount++, i.memoizedState = {
      element: a,
      isDehydrated: l,
      cache: e
    }, bc(i), t;
  }
  function ah(t) {
    return t ? (t = oa, t) : oa;
  }
  function nh(t, e, l, a, n, i) {
    n = ah(n), a.context === null ? a.context = n : a.pendingContext = n, a = yl(e), a.payload = { element: l }, i = i === void 0 ? null : i, i !== null && (a.callback = i), l = ml(t, a, e), l !== null && (se(l, t, e), rn(l, t, e));
  }
  function uh(t, e) {
    if (t = t.memoizedState, t !== null && t.dehydrated !== null) {
      var l = t.retryLane;
      t.retryLane = l !== 0 && l < e ? l : e;
    }
  }
  function Hs(t, e) {
    uh(t, e), (t = t.alternate) && uh(t, e);
  }
  function ih(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = Bl(t, 67108864);
      e !== null && se(e, t, 67108864), Hs(t, 67108864);
    }
  }
  function ch(t) {
    if (t.tag === 13 || t.tag === 31) {
      var e = ve();
      e = Di(e);
      var l = Bl(t, e);
      l !== null && se(l, t, e), Hs(t, e);
    }
  }
  var ni = !0;
  function jg(t, e, l, a) {
    var n = M.T;
    M.T = null;
    var i = H.p;
    try {
      H.p = 2, Bs(t, e, l, a);
    } finally {
      H.p = i, M.T = n;
    }
  }
  function wg(t, e, l, a) {
    var n = M.T;
    M.T = null;
    var i = H.p;
    try {
      H.p = 8, Bs(t, e, l, a);
    } finally {
      H.p = i, M.T = n;
    }
  }
  function Bs(t, e, l, a) {
    if (ni) {
      var n = Ls(a);
      if (n === null)
        Os(
          t,
          e,
          a,
          ui,
          l
        ), rh(t, a);
      else if (_g(
        n,
        t,
        e,
        l,
        a
      ))
        a.stopPropagation();
      else if (rh(t, a), e & 4 && -1 < Dg.indexOf(t)) {
        for (; n !== null; ) {
          var i = Pl(n);
          if (i !== null)
            switch (i.tag) {
              case 3:
                if (i = i.stateNode, i.current.memoizedState.isDehydrated) {
                  var s = _l(i.pendingLanes);
                  if (s !== 0) {
                    var f = i;
                    for (f.pendingLanes |= 2, f.entangledLanes |= 2; s; ) {
                      var h = 1 << 31 - fe(s);
                      f.entanglements[1] |= h, s &= ~h;
                    }
                    Le(i), (vt & 6) === 0 && (Yu = re() + 500, zn(0));
                  }
                }
                break;
              case 31:
              case 13:
                f = Bl(i, 2), f !== null && se(f, i, 2), Xu(), Hs(i, 2);
            }
          if (i = Ls(a), i === null && Os(
            t,
            e,
            a,
            ui,
            l
          ), i === n) break;
          n = i;
        }
        n !== null && a.stopPropagation();
      } else
        Os(
          t,
          e,
          a,
          null,
          l
        );
    }
  }
  function Ls(t) {
    return t = Yi(t), Qs(t);
  }
  var ui = null;
  function Qs(t) {
    if (ui = null, t = Il(t), t !== null) {
      var e = p(t);
      if (e === null) t = null;
      else {
        var l = e.tag;
        if (l === 13) {
          if (t = O(e), t !== null) return t;
          t = null;
        } else if (l === 31) {
          if (t = E(e), t !== null) return t;
          t = null;
        } else if (l === 3) {
          if (e.stateNode.current.memoizedState.isDehydrated)
            return e.tag === 3 ? e.stateNode.containerInfo : null;
          t = null;
        } else e !== t && (t = null);
      }
    }
    return ui = t, null;
  }
  function sh(t) {
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
        switch (py()) {
          case yr:
            return 2;
          case mr:
            return 8;
          case kn:
          case vy:
            return 32;
          case gr:
            return 268435456;
          default:
            return 32;
        }
      default:
        return 32;
    }
  }
  var Ys = !1, xl = null, Ml = null, Cl = null, Dn = /* @__PURE__ */ new Map(), _n = /* @__PURE__ */ new Map(), Rl = [], Dg = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(
    " "
  );
  function rh(t, e) {
    switch (t) {
      case "focusin":
      case "focusout":
        xl = null;
        break;
      case "dragenter":
      case "dragleave":
        Ml = null;
        break;
      case "mouseover":
      case "mouseout":
        Cl = null;
        break;
      case "pointerover":
      case "pointerout":
        Dn.delete(e.pointerId);
        break;
      case "gotpointercapture":
      case "lostpointercapture":
        _n.delete(e.pointerId);
    }
  }
  function Nn(t, e, l, a, n, i) {
    return t === null || t.nativeEvent !== i ? (t = {
      blockedOn: e,
      domEventName: l,
      eventSystemFlags: a,
      nativeEvent: i,
      targetContainers: [n]
    }, e !== null && (e = Pl(e), e !== null && ih(e)), t) : (t.eventSystemFlags |= a, e = t.targetContainers, n !== null && e.indexOf(n) === -1 && e.push(n), t);
  }
  function _g(t, e, l, a, n) {
    switch (e) {
      case "focusin":
        return xl = Nn(
          xl,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "dragenter":
        return Ml = Nn(
          Ml,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "mouseover":
        return Cl = Nn(
          Cl,
          t,
          e,
          l,
          a,
          n
        ), !0;
      case "pointerover":
        var i = n.pointerId;
        return Dn.set(
          i,
          Nn(
            Dn.get(i) || null,
            t,
            e,
            l,
            a,
            n
          )
        ), !0;
      case "gotpointercapture":
        return i = n.pointerId, _n.set(
          i,
          Nn(
            _n.get(i) || null,
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
  function oh(t) {
    var e = Il(t.target);
    if (e !== null) {
      var l = p(e);
      if (l !== null) {
        if (e = l.tag, e === 13) {
          if (e = O(l), e !== null) {
            t.blockedOn = e, Tr(t.priority, function() {
              ch(l);
            });
            return;
          }
        } else if (e === 31) {
          if (e = E(l), e !== null) {
            t.blockedOn = e, Tr(t.priority, function() {
              ch(l);
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
  function ii(t) {
    if (t.blockedOn !== null) return !1;
    for (var e = t.targetContainers; 0 < e.length; ) {
      var l = Ls(t.nativeEvent);
      if (l === null) {
        l = t.nativeEvent;
        var a = new l.constructor(
          l.type,
          l
        );
        Qi = a, l.target.dispatchEvent(a), Qi = null;
      } else
        return e = Pl(l), e !== null && ih(e), t.blockedOn = l, !1;
      e.shift();
    }
    return !0;
  }
  function fh(t, e, l) {
    ii(t) && l.delete(e);
  }
  function Ng() {
    Ys = !1, xl !== null && ii(xl) && (xl = null), Ml !== null && ii(Ml) && (Ml = null), Cl !== null && ii(Cl) && (Cl = null), Dn.forEach(fh), _n.forEach(fh);
  }
  function ci(t, e) {
    t.blockedOn === e && (t.blockedOn = null, Ys || (Ys = !0, u.unstable_scheduleCallback(
      u.unstable_NormalPriority,
      Ng
    )));
  }
  var si = null;
  function dh(t) {
    si !== t && (si = t, u.unstable_scheduleCallback(
      u.unstable_NormalPriority,
      function() {
        si === t && (si = null);
        for (var e = 0; e < t.length; e += 3) {
          var l = t[e], a = t[e + 1], n = t[e + 2];
          if (typeof a != "function") {
            if (Qs(a || l) === null)
              continue;
            break;
          }
          var i = Pl(l);
          i !== null && (t.splice(e, 3), e -= 3, Lc(
            i,
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
  function Na(t) {
    function e(h) {
      return ci(h, t);
    }
    xl !== null && ci(xl, t), Ml !== null && ci(Ml, t), Cl !== null && ci(Cl, t), Dn.forEach(e), _n.forEach(e);
    for (var l = 0; l < Rl.length; l++) {
      var a = Rl[l];
      a.blockedOn === t && (a.blockedOn = null);
    }
    for (; 0 < Rl.length && (l = Rl[0], l.blockedOn === null); )
      oh(l), l.blockedOn === null && Rl.shift();
    if (l = (t.ownerDocument || t).$$reactFormReplay, l != null)
      for (a = 0; a < l.length; a += 3) {
        var n = l[a], i = l[a + 1], s = n[le] || null;
        if (typeof i == "function")
          s || dh(l);
        else if (s) {
          var f = null;
          if (i && i.hasAttribute("formAction")) {
            if (n = i, s = i[le] || null)
              f = s.formAction;
            else if (Qs(n) !== null) continue;
          } else f = s.action;
          typeof f == "function" ? l[a + 1] = f : (l.splice(a, 3), a -= 3), dh(l);
        }
      }
  }
  function hh() {
    function t(i) {
      i.canIntercept && i.info === "react-transition" && i.intercept({
        handler: function() {
          return new Promise(function(s) {
            return n = s;
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
        var i = navigation.currentEntry;
        i && i.url != null && navigation.navigate(i.url, {
          state: i.getState(),
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
  function Gs(t) {
    this._internalRoot = t;
  }
  ri.prototype.render = Gs.prototype.render = function(t) {
    var e = this._internalRoot;
    if (e === null) throw Error(r(409));
    var l = e.current, a = ve();
    nh(l, a, t, e, null, null);
  }, ri.prototype.unmount = Gs.prototype.unmount = function() {
    var t = this._internalRoot;
    if (t !== null) {
      this._internalRoot = null;
      var e = t.containerInfo;
      nh(t.current, 2, null, t, null, null), Xu(), e[$l] = null;
    }
  };
  function ri(t) {
    this._internalRoot = t;
  }
  ri.prototype.unstable_scheduleHydration = function(t) {
    if (t) {
      var e = Er();
      t = { blockedOn: null, target: t, priority: e };
      for (var l = 0; l < Rl.length && e !== 0 && e < Rl[l].priority; l++) ;
      Rl.splice(l, 0, t), l === 0 && oh(t);
    }
  };
  var yh = c.version;
  if (yh !== "19.2.5")
    throw Error(
      r(
        527,
        yh,
        "19.2.5"
      )
    );
  H.findDOMNode = function(t) {
    var e = t._reactInternals;
    if (e === void 0)
      throw typeof t.render == "function" ? Error(r(188)) : (t = Object.keys(t).join(","), Error(r(268, t)));
    return t = y(e), t = t !== null ? w(t) : null, t = t === null ? null : t.stateNode, t;
  };
  var Ug = {
    bundleType: 0,
    version: "19.2.5",
    rendererPackageName: "react-dom",
    currentDispatcherRef: M,
    reconcilerVersion: "19.2.5"
  };
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
    var oi = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!oi.isDisabled && oi.supportsFiber)
      try {
        Ga = oi.inject(
          Ug
        ), oe = oi;
      } catch {
      }
  }
  return qn.createRoot = function(t, e) {
    if (!d(t)) throw Error(r(299));
    var l = !1, a = "", n = Ef, i = Tf, s = Af;
    return e != null && (e.unstable_strictMode === !0 && (l = !0), e.identifierPrefix !== void 0 && (a = e.identifierPrefix), e.onUncaughtError !== void 0 && (n = e.onUncaughtError), e.onCaughtError !== void 0 && (i = e.onCaughtError), e.onRecoverableError !== void 0 && (s = e.onRecoverableError)), e = lh(
      t,
      1,
      !1,
      null,
      null,
      l,
      a,
      null,
      n,
      i,
      s,
      hh
    ), t[$l] = e.current, As(t), new Gs(e);
  }, qn.hydrateRoot = function(t, e, l) {
    if (!d(t)) throw Error(r(299));
    var a = !1, n = "", i = Ef, s = Tf, f = Af, h = null;
    return l != null && (l.unstable_strictMode === !0 && (a = !0), l.identifierPrefix !== void 0 && (n = l.identifierPrefix), l.onUncaughtError !== void 0 && (i = l.onUncaughtError), l.onCaughtError !== void 0 && (s = l.onCaughtError), l.onRecoverableError !== void 0 && (f = l.onRecoverableError), l.formState !== void 0 && (h = l.formState)), e = lh(
      t,
      1,
      !0,
      e,
      l ?? null,
      a,
      n,
      h,
      i,
      s,
      f,
      hh
    ), e.context = ah(null), l = e.current, a = ve(), a = Di(a), n = yl(a), n.callback = null, ml(l, n, a), l = a, e.current.lanes = l, Za(e, l), Le(e), t[$l] = e.current, As(t), new ri(e);
  }, qn.version = "19.2.5", qn;
}
var Oh;
function Kg() {
  if (Oh) return Vs.exports;
  Oh = 1;
  function u() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
      try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(u);
      } catch (c) {
        console.error(c);
      }
  }
  return u(), Vs.exports = Vg(), Vs.exports;
}
var Jg = Kg(), Ti = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set(), this.subscribe = this.subscribe.bind(this);
  }
  subscribe(u) {
    return this.listeners.add(u), this.onSubscribe(), () => {
      this.listeners.delete(u), this.onUnsubscribe();
    };
  }
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {
  }
  onUnsubscribe() {
  }
}, kg = class extends Ti {
  #t;
  #l;
  #e;
  constructor() {
    super(), this.#e = (u) => {
      if (typeof window < "u" && window.addEventListener) {
        const c = () => u();
        return window.addEventListener("visibilitychange", c, !1), () => {
          window.removeEventListener("visibilitychange", c);
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
  setEventListener(u) {
    this.#e = u, this.#l?.(), this.#l = u((c) => {
      typeof c == "boolean" ? this.setFocused(c) : this.onFocus();
    });
  }
  setFocused(u) {
    this.#t !== u && (this.#t = u, this.onFocus());
  }
  onFocus() {
    const u = this.isFocused();
    this.listeners.forEach((c) => {
      c(u);
    });
  }
  isFocused() {
    return typeof this.#t == "boolean" ? this.#t : globalThis.document?.visibilityState !== "hidden";
  }
}, $h = new kg(), Fg = {
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
  setTimeout: (u, c) => setTimeout(u, c),
  clearTimeout: (u) => clearTimeout(u),
  setInterval: (u, c) => setInterval(u, c),
  clearInterval: (u) => clearInterval(u)
}, Wg = class {
  // We cannot have TimeoutManager<T> as we must instantiate it with a concrete
  // type at app boot; and if we leave that type, then any new timer provider
  // would need to support the default provider's concrete timer ID, which is
  // infeasible across environments.
  //
  // We settle for type safety for the TimeoutProvider type, and accept that
  // this class is unsafe internally to allow for extension.
  #t = Fg;
  #l = !1;
  setTimeoutProvider(u) {
    this.#t = u;
  }
  setTimeout(u, c) {
    return this.#t.setTimeout(u, c);
  }
  clearTimeout(u) {
    this.#t.clearTimeout(u);
  }
  setInterval(u, c) {
    return this.#t.setInterval(u, c);
  }
  clearInterval(u) {
    this.#t.clearInterval(u);
  }
}, tr = new Wg();
function $g(u) {
  setTimeout(u, 0);
}
var Ig = typeof window > "u" || "Deno" in globalThis;
function Ue() {
}
function Pg(u, c) {
  return typeof u == "function" ? u(c) : u;
}
function tp(u) {
  return typeof u == "number" && u >= 0 && u !== 1 / 0;
}
function ep(u, c) {
  return Math.max(u + (c || 0) - Date.now(), 0);
}
function er(u, c) {
  return typeof u == "function" ? u(c) : u;
}
function lp(u, c) {
  return typeof u == "function" ? u(c) : u;
}
function zh(u, c) {
  const {
    type: o = "all",
    exact: r,
    fetchStatus: d,
    predicate: p,
    queryKey: O,
    stale: E
  } = u;
  if (O) {
    if (r) {
      if (c.queryHash !== sr(O, c.options))
        return !1;
    } else if (!Xn(c.queryKey, O))
      return !1;
  }
  if (o !== "all") {
    const b = c.isActive();
    if (o === "active" && !b || o === "inactive" && b)
      return !1;
  }
  return !(typeof E == "boolean" && c.isStale() !== E || d && d !== c.state.fetchStatus || p && !p(c));
}
function xh(u, c) {
  const { exact: o, status: r, predicate: d, mutationKey: p } = u;
  if (p) {
    if (!c.options.mutationKey)
      return !1;
    if (o) {
      if (Gn(c.options.mutationKey) !== Gn(p))
        return !1;
    } else if (!Xn(c.options.mutationKey, p))
      return !1;
  }
  return !(r && c.state.status !== r || d && !d(c));
}
function sr(u, c) {
  return (c?.queryKeyHashFn || Gn)(u);
}
function Gn(u) {
  return JSON.stringify(
    u,
    (c, o) => lr(o) ? Object.keys(o).sort().reduce((r, d) => (r[d] = o[d], r), {}) : o
  );
}
function Xn(u, c) {
  return u === c ? !0 : typeof u != typeof c ? !1 : u && c && typeof u == "object" && typeof c == "object" ? Object.keys(c).every((o) => Xn(u[o], c[o])) : !1;
}
var ap = Object.prototype.hasOwnProperty;
function Ih(u, c, o = 0) {
  if (u === c)
    return u;
  if (o > 500) return c;
  const r = Mh(u) && Mh(c);
  if (!r && !(lr(u) && lr(c))) return c;
  const p = (r ? u : Object.keys(u)).length, O = r ? c : Object.keys(c), E = O.length, b = r ? new Array(E) : {};
  let y = 0;
  for (let w = 0; w < E; w++) {
    const _ = r ? w : O[w], U = u[_], L = c[_];
    if (U === L) {
      b[_] = U, (r ? w < p : ap.call(u, _)) && y++;
      continue;
    }
    if (U === null || L === null || typeof U != "object" || typeof L != "object") {
      b[_] = L;
      continue;
    }
    const V = Ih(U, L, o + 1);
    b[_] = V, V === U && y++;
  }
  return p === E && y === p ? u : b;
}
function Mh(u) {
  return Array.isArray(u) && u.length === Object.keys(u).length;
}
function lr(u) {
  if (!Ch(u))
    return !1;
  const c = u.constructor;
  if (c === void 0)
    return !0;
  const o = c.prototype;
  return !(!Ch(o) || !o.hasOwnProperty("isPrototypeOf") || Object.getPrototypeOf(u) !== Object.prototype);
}
function Ch(u) {
  return Object.prototype.toString.call(u) === "[object Object]";
}
function np(u) {
  return new Promise((c) => {
    tr.setTimeout(c, u);
  });
}
function up(u, c, o) {
  return typeof o.structuralSharing == "function" ? o.structuralSharing(u, c) : o.structuralSharing !== !1 ? Ih(u, c) : c;
}
function ip(u, c, o = 0) {
  const r = [...u, c];
  return o && r.length > o ? r.slice(1) : r;
}
function cp(u, c, o = 0) {
  const r = [c, ...u];
  return o && r.length > o ? r.slice(0, -1) : r;
}
var rr = /* @__PURE__ */ Symbol();
function Ph(u, c) {
  return !u.queryFn && c?.initialPromise ? () => c.initialPromise : !u.queryFn || u.queryFn === rr ? () => Promise.reject(new Error(`Missing queryFn: '${u.queryHash}'`)) : u.queryFn;
}
function sp(u, c, o) {
  let r = !1, d;
  return Object.defineProperty(u, "signal", {
    enumerable: !0,
    get: () => (d ??= c(), r || (r = !0, d.aborted ? o() : d.addEventListener("abort", o, { once: !0 })), d)
  }), u;
}
var ty = /* @__PURE__ */ (() => {
  let u = () => Ig;
  return {
    /**
     * Returns whether the current runtime should be treated as a server environment.
     */
    isServer() {
      return u();
    },
    /**
     * Overrides the server check globally.
     */
    setIsServer(c) {
      u = c;
    }
  };
})();
function rp() {
  let u, c;
  const o = new Promise((d, p) => {
    u = d, c = p;
  });
  o.status = "pending", o.catch(() => {
  });
  function r(d) {
    Object.assign(o, d), delete o.resolve, delete o.reject;
  }
  return o.resolve = (d) => {
    r({
      status: "fulfilled",
      value: d
    }), u(d);
  }, o.reject = (d) => {
    r({
      status: "rejected",
      reason: d
    }), c(d);
  }, o;
}
var op = $g;
function fp() {
  let u = [], c = 0, o = (E) => {
    E();
  }, r = (E) => {
    E();
  }, d = op;
  const p = (E) => {
    c ? u.push(E) : d(() => {
      o(E);
    });
  }, O = () => {
    const E = u;
    u = [], E.length && d(() => {
      r(() => {
        E.forEach((b) => {
          o(b);
        });
      });
    });
  };
  return {
    batch: (E) => {
      let b;
      c++;
      try {
        b = E();
      } finally {
        c--, c || O();
      }
      return b;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (E) => (...b) => {
      p(() => {
        E(...b);
      });
    },
    schedule: p,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (E) => {
      o = E;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * By default React Query will use the batch function provided by ReactDOM or React Native.
     */
    setBatchNotifyFunction: (E) => {
      r = E;
    },
    setScheduler: (E) => {
      d = E;
    }
  };
}
var te = fp(), dp = class extends Ti {
  #t = !0;
  #l;
  #e;
  constructor() {
    super(), this.#e = (u) => {
      if (typeof window < "u" && window.addEventListener) {
        const c = () => u(!0), o = () => u(!1);
        return window.addEventListener("online", c, !1), window.addEventListener("offline", o, !1), () => {
          window.removeEventListener("online", c), window.removeEventListener("offline", o);
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
  setEventListener(u) {
    this.#e = u, this.#l?.(), this.#l = u(this.setOnline.bind(this));
  }
  setOnline(u) {
    this.#t !== u && (this.#t = u, this.listeners.forEach((o) => {
      o(u);
    }));
  }
  isOnline() {
    return this.#t;
  }
}, pi = new dp();
function hp(u) {
  return Math.min(1e3 * 2 ** u, 3e4);
}
function ey(u) {
  return (u ?? "online") === "online" ? pi.isOnline() : !0;
}
var ar = class extends Error {
  constructor(u) {
    super("CancelledError"), this.revert = u?.revert, this.silent = u?.silent;
  }
};
function ly(u) {
  let c = !1, o = 0, r;
  const d = rp(), p = () => d.status !== "pending", O = (N) => {
    if (!p()) {
      const Q = new ar(N);
      U(Q), u.onCancel?.(Q);
    }
  }, E = () => {
    c = !0;
  }, b = () => {
    c = !1;
  }, y = () => $h.isFocused() && (u.networkMode === "always" || pi.isOnline()) && u.canRun(), w = () => ey(u.networkMode) && u.canRun(), _ = (N) => {
    p() || (r?.(), d.resolve(N));
  }, U = (N) => {
    p() || (r?.(), d.reject(N));
  }, L = () => new Promise((N) => {
    r = (Q) => {
      (p() || y()) && N(Q);
    }, u.onPause?.();
  }).then(() => {
    r = void 0, p() || u.onContinue?.();
  }), V = () => {
    if (p())
      return;
    let N;
    const Q = o === 0 ? u.initialPromise : void 0;
    try {
      N = Q ?? u.fn();
    } catch (J) {
      N = Promise.reject(J);
    }
    Promise.resolve(N).then(_).catch((J) => {
      if (p())
        return;
      const $ = u.retry ?? (ty.isServer() ? 0 : 3), dt = u.retryDelay ?? hp, ht = typeof dt == "function" ? dt(o, J) : dt, nt = $ === !0 || typeof $ == "number" && o < $ || typeof $ == "function" && $(o, J);
      if (c || !nt) {
        U(J);
        return;
      }
      o++, u.onFail?.(o, J), np(ht).then(() => y() ? void 0 : L()).then(() => {
        c ? U(J) : V();
      });
    });
  };
  return {
    promise: d,
    status: () => d.status,
    cancel: O,
    continue: () => (r?.(), d),
    cancelRetry: E,
    continueRetry: b,
    canStart: w,
    start: () => (w() ? V() : L().then(V), d)
  };
}
var ay = class {
  #t;
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout(), tp(this.gcTime) && (this.#t = tr.setTimeout(() => {
      this.optionalRemove();
    }, this.gcTime));
  }
  updateGcTime(u) {
    this.gcTime = Math.max(
      this.gcTime || 0,
      u ?? (ty.isServer() ? 1 / 0 : 300 * 1e3)
    );
  }
  clearGcTimeout() {
    this.#t !== void 0 && (tr.clearTimeout(this.#t), this.#t = void 0);
  }
}, yp = class extends ay {
  #t;
  #l;
  #e;
  #n;
  #a;
  #u;
  #i;
  constructor(u) {
    super(), this.#i = !1, this.#u = u.defaultOptions, this.setOptions(u.options), this.observers = [], this.#n = u.client, this.#e = this.#n.getQueryCache(), this.queryKey = u.queryKey, this.queryHash = u.queryHash, this.#t = jh(this.options), this.state = u.state ?? this.#t, this.scheduleGc();
  }
  get meta() {
    return this.options.meta;
  }
  get promise() {
    return this.#a?.promise;
  }
  setOptions(u) {
    if (this.options = { ...this.#u, ...u }, this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
      const c = jh(this.options);
      c.data !== void 0 && (this.setState(
        Rh(c.data, c.dataUpdatedAt)
      ), this.#t = c);
    }
  }
  optionalRemove() {
    !this.observers.length && this.state.fetchStatus === "idle" && this.#e.remove(this);
  }
  setData(u, c) {
    const o = up(this.state.data, u, this.options);
    return this.#c({
      data: o,
      type: "success",
      dataUpdatedAt: c?.updatedAt,
      manual: c?.manual
    }), o;
  }
  setState(u, c) {
    this.#c({ type: "setState", state: u, setStateOptions: c });
  }
  cancel(u) {
    const c = this.#a?.promise;
    return this.#a?.cancel(u), c ? c.then(Ue).catch(Ue) : Promise.resolve();
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
      (u) => lp(u.options.enabled, this) !== !1
    );
  }
  isDisabled() {
    return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === rr || !this.isFetched();
  }
  isFetched() {
    return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
  }
  isStatic() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (u) => er(u.options.staleTime, this) === "static"
    ) : !1;
  }
  isStale() {
    return this.getObserversCount() > 0 ? this.observers.some(
      (u) => u.getCurrentResult().isStale
    ) : this.state.data === void 0 || this.state.isInvalidated;
  }
  isStaleByTime(u = 0) {
    return this.state.data === void 0 ? !0 : u === "static" ? !1 : this.state.isInvalidated ? !0 : !ep(this.state.dataUpdatedAt, u);
  }
  onFocus() {
    this.observers.find((c) => c.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: !1 }), this.#a?.continue();
  }
  onOnline() {
    this.observers.find((c) => c.shouldFetchOnReconnect())?.refetch({ cancelRefetch: !1 }), this.#a?.continue();
  }
  addObserver(u) {
    this.observers.includes(u) || (this.observers.push(u), this.clearGcTimeout(), this.#e.notify({ type: "observerAdded", query: this, observer: u }));
  }
  removeObserver(u) {
    this.observers.includes(u) && (this.observers = this.observers.filter((c) => c !== u), this.observers.length || (this.#a && (this.#i || this.#s() ? this.#a.cancel({ revert: !0 }) : this.#a.cancelRetry()), this.scheduleGc()), this.#e.notify({ type: "observerRemoved", query: this, observer: u }));
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
  async fetch(u, c) {
    if (this.state.fetchStatus !== "idle" && // If the promise in the retryer is already rejected, we have to definitely
    // re-start the fetch; there is a chance that the query is still in a
    // pending state when that happens
    this.#a?.status() !== "rejected") {
      if (this.state.data !== void 0 && c?.cancelRefetch)
        this.cancel({ silent: !0 });
      else if (this.#a)
        return this.#a.continueRetry(), this.#a.promise;
    }
    if (u && this.setOptions(u), !this.options.queryFn) {
      const E = this.observers.find((b) => b.options.queryFn);
      E && this.setOptions(E.options);
    }
    const o = new AbortController(), r = (E) => {
      Object.defineProperty(E, "signal", {
        enumerable: !0,
        get: () => (this.#i = !0, o.signal)
      });
    }, d = () => {
      const E = Ph(this.options, c), y = (() => {
        const w = {
          client: this.#n,
          queryKey: this.queryKey,
          meta: this.meta
        };
        return r(w), w;
      })();
      return this.#i = !1, this.options.persister ? this.options.persister(
        E,
        y,
        this
      ) : E(y);
    }, O = (() => {
      const E = {
        fetchOptions: c,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#n,
        state: this.state,
        fetchFn: d
      };
      return r(E), E;
    })();
    this.options.behavior?.onFetch(O, this), this.#l = this.state, (this.state.fetchStatus === "idle" || this.state.fetchMeta !== O.fetchOptions?.meta) && this.#c({ type: "fetch", meta: O.fetchOptions?.meta }), this.#a = ly({
      initialPromise: c?.initialPromise,
      fn: O.fetchFn,
      onCancel: (E) => {
        E instanceof ar && E.revert && this.setState({
          ...this.#l,
          fetchStatus: "idle"
        }), o.abort();
      },
      onFail: (E, b) => {
        this.#c({ type: "failed", failureCount: E, error: b });
      },
      onPause: () => {
        this.#c({ type: "pause" });
      },
      onContinue: () => {
        this.#c({ type: "continue" });
      },
      retry: O.options.retry,
      retryDelay: O.options.retryDelay,
      networkMode: O.options.networkMode,
      canRun: () => !0
    });
    try {
      const E = await this.#a.start();
      if (E === void 0)
        throw new Error(`${this.queryHash} data is undefined`);
      return this.setData(E), this.#e.config.onSuccess?.(E, this), this.#e.config.onSettled?.(
        E,
        this.state.error,
        this
      ), E;
    } catch (E) {
      if (E instanceof ar) {
        if (E.silent)
          return this.#a.promise;
        if (E.revert) {
          if (this.state.data === void 0)
            throw E;
          return this.state.data;
        }
      }
      throw this.#c({
        type: "error",
        error: E
      }), this.#e.config.onError?.(
        E,
        this
      ), this.#e.config.onSettled?.(
        this.state.data,
        E,
        this
      ), E;
    } finally {
      this.scheduleGc();
    }
  }
  #c(u) {
    const c = (o) => {
      switch (u.type) {
        case "failed":
          return {
            ...o,
            fetchFailureCount: u.failureCount,
            fetchFailureReason: u.error
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
            ...mp(o.data, this.options),
            fetchMeta: u.meta ?? null
          };
        case "success":
          const r = {
            ...o,
            ...Rh(u.data, u.dataUpdatedAt),
            dataUpdateCount: o.dataUpdateCount + 1,
            ...!u.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null
            }
          };
          return this.#l = u.manual ? r : void 0, r;
        case "error":
          const d = u.error;
          return {
            ...o,
            error: d,
            errorUpdateCount: o.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: o.fetchFailureCount + 1,
            fetchFailureReason: d,
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
            ...u.state
          };
      }
    };
    this.state = c(this.state), te.batch(() => {
      this.observers.forEach((o) => {
        o.onQueryUpdate();
      }), this.#e.notify({ query: this, type: "updated", action: u });
    });
  }
};
function mp(u, c) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: ey(c.networkMode) ? "fetching" : "paused",
    ...u === void 0 && {
      error: null,
      status: "pending"
    }
  };
}
function Rh(u, c) {
  return {
    data: u,
    dataUpdatedAt: c ?? Date.now(),
    error: null,
    isInvalidated: !1,
    status: "success"
  };
}
function jh(u) {
  const c = typeof u.initialData == "function" ? u.initialData() : u.initialData, o = c !== void 0, r = o ? typeof u.initialDataUpdatedAt == "function" ? u.initialDataUpdatedAt() : u.initialDataUpdatedAt : 0;
  return {
    data: c,
    dataUpdateCount: 0,
    dataUpdatedAt: o ? r ?? Date.now() : 0,
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
function wh(u) {
  return {
    onFetch: (c, o) => {
      const r = c.options, d = c.fetchOptions?.meta?.fetchMore?.direction, p = c.state.data?.pages || [], O = c.state.data?.pageParams || [];
      let E = { pages: [], pageParams: [] }, b = 0;
      const y = async () => {
        let w = !1;
        const _ = (V) => {
          sp(
            V,
            () => c.signal,
            () => w = !0
          );
        }, U = Ph(c.options, c.fetchOptions), L = async (V, N, Q) => {
          if (w)
            return Promise.reject();
          if (N == null && V.pages.length)
            return Promise.resolve(V);
          const $ = (() => {
            const q = {
              client: c.client,
              queryKey: c.queryKey,
              pageParam: N,
              direction: Q ? "backward" : "forward",
              meta: c.options.meta
            };
            return _(q), q;
          })(), dt = await U($), { maxPages: ht } = c.options, nt = Q ? cp : ip;
          return {
            pages: nt(V.pages, dt, ht),
            pageParams: nt(V.pageParams, N, ht)
          };
        };
        if (d && p.length) {
          const V = d === "backward", N = V ? gp : Dh, Q = {
            pages: p,
            pageParams: O
          }, J = N(r, Q);
          E = await L(Q, J, V);
        } else {
          const V = u ?? p.length;
          do {
            const N = b === 0 ? O[0] ?? r.initialPageParam : Dh(r, E);
            if (b > 0 && N == null)
              break;
            E = await L(E, N), b++;
          } while (b < V);
        }
        return E;
      };
      c.options.persister ? c.fetchFn = () => c.options.persister?.(
        y,
        {
          client: c.client,
          queryKey: c.queryKey,
          meta: c.options.meta,
          signal: c.signal
        },
        o
      ) : c.fetchFn = y;
    }
  };
}
function Dh(u, { pages: c, pageParams: o }) {
  const r = c.length - 1;
  return c.length > 0 ? u.getNextPageParam(
    c[r],
    c,
    o[r],
    o
  ) : void 0;
}
function gp(u, { pages: c, pageParams: o }) {
  return c.length > 0 ? u.getPreviousPageParam?.(c[0], c, o[0], o) : void 0;
}
var pp = class extends ay {
  #t;
  #l;
  #e;
  #n;
  constructor(u) {
    super(), this.#t = u.client, this.mutationId = u.mutationId, this.#e = u.mutationCache, this.#l = [], this.state = u.state || vp(), this.setOptions(u.options), this.scheduleGc();
  }
  setOptions(u) {
    this.options = u, this.updateGcTime(this.options.gcTime);
  }
  get meta() {
    return this.options.meta;
  }
  addObserver(u) {
    this.#l.includes(u) || (this.#l.push(u), this.clearGcTimeout(), this.#e.notify({
      type: "observerAdded",
      mutation: this,
      observer: u
    }));
  }
  removeObserver(u) {
    this.#l = this.#l.filter((c) => c !== u), this.scheduleGc(), this.#e.notify({
      type: "observerRemoved",
      mutation: this,
      observer: u
    });
  }
  optionalRemove() {
    this.#l.length || (this.state.status === "pending" ? this.scheduleGc() : this.#e.remove(this));
  }
  continue() {
    return this.#n?.continue() ?? // continuing a mutation assumes that variables are set, mutation must have been dehydrated before
    this.execute(this.state.variables);
  }
  async execute(u) {
    const c = () => {
      this.#a({ type: "continue" });
    }, o = {
      client: this.#t,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey
    };
    this.#n = ly({
      fn: () => this.options.mutationFn ? this.options.mutationFn(u, o) : Promise.reject(new Error("No mutationFn found")),
      onFail: (p, O) => {
        this.#a({ type: "failed", failureCount: p, error: O });
      },
      onPause: () => {
        this.#a({ type: "pause" });
      },
      onContinue: c,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#e.canRun(this)
    });
    const r = this.state.status === "pending", d = !this.#n.canStart();
    try {
      if (r)
        c();
      else {
        this.#a({ type: "pending", variables: u, isPaused: d }), this.#e.config.onMutate && await this.#e.config.onMutate(
          u,
          this,
          o
        );
        const O = await this.options.onMutate?.(
          u,
          o
        );
        O !== this.state.context && this.#a({
          type: "pending",
          context: O,
          variables: u,
          isPaused: d
        });
      }
      const p = await this.#n.start();
      return await this.#e.config.onSuccess?.(
        p,
        u,
        this.state.context,
        this,
        o
      ), await this.options.onSuccess?.(
        p,
        u,
        this.state.context,
        o
      ), await this.#e.config.onSettled?.(
        p,
        null,
        this.state.variables,
        this.state.context,
        this,
        o
      ), await this.options.onSettled?.(
        p,
        null,
        u,
        this.state.context,
        o
      ), this.#a({ type: "success", data: p }), p;
    } catch (p) {
      try {
        await this.#e.config.onError?.(
          p,
          u,
          this.state.context,
          this,
          o
        );
      } catch (O) {
        Promise.reject(O);
      }
      try {
        await this.options.onError?.(
          p,
          u,
          this.state.context,
          o
        );
      } catch (O) {
        Promise.reject(O);
      }
      try {
        await this.#e.config.onSettled?.(
          void 0,
          p,
          this.state.variables,
          this.state.context,
          this,
          o
        );
      } catch (O) {
        Promise.reject(O);
      }
      try {
        await this.options.onSettled?.(
          void 0,
          p,
          u,
          this.state.context,
          o
        );
      } catch (O) {
        Promise.reject(O);
      }
      throw this.#a({ type: "error", error: p }), p;
    } finally {
      this.#e.runNext(this);
    }
  }
  #a(u) {
    const c = (o) => {
      switch (u.type) {
        case "failed":
          return {
            ...o,
            failureCount: u.failureCount,
            failureReason: u.error
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
            context: u.context,
            data: void 0,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: u.isPaused,
            status: "pending",
            variables: u.variables,
            submittedAt: Date.now()
          };
        case "success":
          return {
            ...o,
            data: u.data,
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
            error: u.error,
            failureCount: o.failureCount + 1,
            failureReason: u.error,
            isPaused: !1,
            status: "error"
          };
      }
    };
    this.state = c(this.state), te.batch(() => {
      this.#l.forEach((o) => {
        o.onMutationUpdate(u);
      }), this.#e.notify({
        mutation: this,
        type: "updated",
        action: u
      });
    });
  }
};
function vp() {
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
var bp = class extends Ti {
  constructor(u = {}) {
    super(), this.config = u, this.#t = /* @__PURE__ */ new Set(), this.#l = /* @__PURE__ */ new Map(), this.#e = 0;
  }
  #t;
  #l;
  #e;
  build(u, c, o) {
    const r = new pp({
      client: u,
      mutationCache: this,
      mutationId: ++this.#e,
      options: u.defaultMutationOptions(c),
      state: o
    });
    return this.add(r), r;
  }
  add(u) {
    this.#t.add(u);
    const c = fi(u);
    if (typeof c == "string") {
      const o = this.#l.get(c);
      o ? o.push(u) : this.#l.set(c, [u]);
    }
    this.notify({ type: "added", mutation: u });
  }
  remove(u) {
    if (this.#t.delete(u)) {
      const c = fi(u);
      if (typeof c == "string") {
        const o = this.#l.get(c);
        if (o)
          if (o.length > 1) {
            const r = o.indexOf(u);
            r !== -1 && o.splice(r, 1);
          } else o[0] === u && this.#l.delete(c);
      }
    }
    this.notify({ type: "removed", mutation: u });
  }
  canRun(u) {
    const c = fi(u);
    if (typeof c == "string") {
      const r = this.#l.get(c)?.find(
        (d) => d.state.status === "pending"
      );
      return !r || r === u;
    } else
      return !0;
  }
  runNext(u) {
    const c = fi(u);
    return typeof c == "string" ? this.#l.get(c)?.find((r) => r !== u && r.state.isPaused)?.continue() ?? Promise.resolve() : Promise.resolve();
  }
  clear() {
    te.batch(() => {
      this.#t.forEach((u) => {
        this.notify({ type: "removed", mutation: u });
      }), this.#t.clear(), this.#l.clear();
    });
  }
  getAll() {
    return Array.from(this.#t);
  }
  find(u) {
    const c = { exact: !0, ...u };
    return this.getAll().find(
      (o) => xh(c, o)
    );
  }
  findAll(u = {}) {
    return this.getAll().filter((c) => xh(u, c));
  }
  notify(u) {
    te.batch(() => {
      this.listeners.forEach((c) => {
        c(u);
      });
    });
  }
  resumePausedMutations() {
    const u = this.getAll().filter((c) => c.state.isPaused);
    return te.batch(
      () => Promise.all(
        u.map((c) => c.continue().catch(Ue))
      )
    );
  }
};
function fi(u) {
  return u.options.scope?.id;
}
var Sp = class extends Ti {
  constructor(u = {}) {
    super(), this.config = u, this.#t = /* @__PURE__ */ new Map();
  }
  #t;
  build(u, c, o) {
    const r = c.queryKey, d = c.queryHash ?? sr(r, c);
    let p = this.get(d);
    return p || (p = new yp({
      client: u,
      queryKey: r,
      queryHash: d,
      options: u.defaultQueryOptions(c),
      state: o,
      defaultOptions: u.getQueryDefaults(r)
    }), this.add(p)), p;
  }
  add(u) {
    this.#t.has(u.queryHash) || (this.#t.set(u.queryHash, u), this.notify({
      type: "added",
      query: u
    }));
  }
  remove(u) {
    const c = this.#t.get(u.queryHash);
    c && (u.destroy(), c === u && this.#t.delete(u.queryHash), this.notify({ type: "removed", query: u }));
  }
  clear() {
    te.batch(() => {
      this.getAll().forEach((u) => {
        this.remove(u);
      });
    });
  }
  get(u) {
    return this.#t.get(u);
  }
  getAll() {
    return [...this.#t.values()];
  }
  find(u) {
    const c = { exact: !0, ...u };
    return this.getAll().find(
      (o) => zh(c, o)
    );
  }
  findAll(u = {}) {
    const c = this.getAll();
    return Object.keys(u).length > 0 ? c.filter((o) => zh(u, o)) : c;
  }
  notify(u) {
    te.batch(() => {
      this.listeners.forEach((c) => {
        c(u);
      });
    });
  }
  onFocus() {
    te.batch(() => {
      this.getAll().forEach((u) => {
        u.onFocus();
      });
    });
  }
  onOnline() {
    te.batch(() => {
      this.getAll().forEach((u) => {
        u.onOnline();
      });
    });
  }
}, Ep = class {
  #t;
  #l;
  #e;
  #n;
  #a;
  #u;
  #i;
  #s;
  constructor(u = {}) {
    this.#t = u.queryCache || new Sp(), this.#l = u.mutationCache || new bp(), this.#e = u.defaultOptions || {}, this.#n = /* @__PURE__ */ new Map(), this.#a = /* @__PURE__ */ new Map(), this.#u = 0;
  }
  mount() {
    this.#u++, this.#u === 1 && (this.#i = $h.subscribe(async (u) => {
      u && (await this.resumePausedMutations(), this.#t.onFocus());
    }), this.#s = pi.subscribe(async (u) => {
      u && (await this.resumePausedMutations(), this.#t.onOnline());
    }));
  }
  unmount() {
    this.#u--, this.#u === 0 && (this.#i?.(), this.#i = void 0, this.#s?.(), this.#s = void 0);
  }
  isFetching(u) {
    return this.#t.findAll({ ...u, fetchStatus: "fetching" }).length;
  }
  isMutating(u) {
    return this.#l.findAll({ ...u, status: "pending" }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   */
  getQueryData(u) {
    const c = this.defaultQueryOptions({ queryKey: u });
    return this.#t.get(c.queryHash)?.state.data;
  }
  ensureQueryData(u) {
    const c = this.defaultQueryOptions(u), o = this.#t.build(this, c), r = o.state.data;
    return r === void 0 ? this.fetchQuery(u) : (u.revalidateIfStale && o.isStaleByTime(er(c.staleTime, o)) && this.prefetchQuery(c), Promise.resolve(r));
  }
  getQueriesData(u) {
    return this.#t.findAll(u).map(({ queryKey: c, state: o }) => {
      const r = o.data;
      return [c, r];
    });
  }
  setQueryData(u, c, o) {
    const r = this.defaultQueryOptions({ queryKey: u }), p = this.#t.get(
      r.queryHash
    )?.state.data, O = Pg(c, p);
    if (O !== void 0)
      return this.#t.build(this, r).setData(O, { ...o, manual: !0 });
  }
  setQueriesData(u, c, o) {
    return te.batch(
      () => this.#t.findAll(u).map(({ queryKey: r }) => [
        r,
        this.setQueryData(r, c, o)
      ])
    );
  }
  getQueryState(u) {
    const c = this.defaultQueryOptions({ queryKey: u });
    return this.#t.get(
      c.queryHash
    )?.state;
  }
  removeQueries(u) {
    const c = this.#t;
    te.batch(() => {
      c.findAll(u).forEach((o) => {
        c.remove(o);
      });
    });
  }
  resetQueries(u, c) {
    const o = this.#t;
    return te.batch(() => (o.findAll(u).forEach((r) => {
      r.reset();
    }), this.refetchQueries(
      {
        type: "active",
        ...u
      },
      c
    )));
  }
  cancelQueries(u, c = {}) {
    const o = { revert: !0, ...c }, r = te.batch(
      () => this.#t.findAll(u).map((d) => d.cancel(o))
    );
    return Promise.all(r).then(Ue).catch(Ue);
  }
  invalidateQueries(u, c = {}) {
    return te.batch(() => (this.#t.findAll(u).forEach((o) => {
      o.invalidate();
    }), u?.refetchType === "none" ? Promise.resolve() : this.refetchQueries(
      {
        ...u,
        type: u?.refetchType ?? u?.type ?? "active"
      },
      c
    )));
  }
  refetchQueries(u, c = {}) {
    const o = {
      ...c,
      cancelRefetch: c.cancelRefetch ?? !0
    }, r = te.batch(
      () => this.#t.findAll(u).filter((d) => !d.isDisabled() && !d.isStatic()).map((d) => {
        let p = d.fetch(void 0, o);
        return o.throwOnError || (p = p.catch(Ue)), d.state.fetchStatus === "paused" ? Promise.resolve() : p;
      })
    );
    return Promise.all(r).then(Ue);
  }
  fetchQuery(u) {
    const c = this.defaultQueryOptions(u);
    c.retry === void 0 && (c.retry = !1);
    const o = this.#t.build(this, c);
    return o.isStaleByTime(
      er(c.staleTime, o)
    ) ? o.fetch(c) : Promise.resolve(o.state.data);
  }
  prefetchQuery(u) {
    return this.fetchQuery(u).then(Ue).catch(Ue);
  }
  fetchInfiniteQuery(u) {
    return u.behavior = wh(u.pages), this.fetchQuery(u);
  }
  prefetchInfiniteQuery(u) {
    return this.fetchInfiniteQuery(u).then(Ue).catch(Ue);
  }
  ensureInfiniteQueryData(u) {
    return u.behavior = wh(u.pages), this.ensureQueryData(u);
  }
  resumePausedMutations() {
    return pi.isOnline() ? this.#l.resumePausedMutations() : Promise.resolve();
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
  setDefaultOptions(u) {
    this.#e = u;
  }
  setQueryDefaults(u, c) {
    this.#n.set(Gn(u), {
      queryKey: u,
      defaultOptions: c
    });
  }
  getQueryDefaults(u) {
    const c = [...this.#n.values()], o = {};
    return c.forEach((r) => {
      Xn(u, r.queryKey) && Object.assign(o, r.defaultOptions);
    }), o;
  }
  setMutationDefaults(u, c) {
    this.#a.set(Gn(u), {
      mutationKey: u,
      defaultOptions: c
    });
  }
  getMutationDefaults(u) {
    const c = [...this.#a.values()], o = {};
    return c.forEach((r) => {
      Xn(u, r.mutationKey) && Object.assign(o, r.defaultOptions);
    }), o;
  }
  defaultQueryOptions(u) {
    if (u._defaulted)
      return u;
    const c = {
      ...this.#e.queries,
      ...this.getQueryDefaults(u.queryKey),
      ...u,
      _defaulted: !0
    };
    return c.queryHash || (c.queryHash = sr(
      c.queryKey,
      c
    )), c.refetchOnReconnect === void 0 && (c.refetchOnReconnect = c.networkMode !== "always"), c.throwOnError === void 0 && (c.throwOnError = !!c.suspense), !c.networkMode && c.persister && (c.networkMode = "offlineFirst"), c.queryFn === rr && (c.enabled = !1), c;
  }
  defaultMutationOptions(u) {
    return u?._defaulted ? u : {
      ...this.#e.mutations,
      ...u?.mutationKey && this.getMutationDefaults(u.mutationKey),
      ...u,
      _defaulted: !0
    };
  }
  clear() {
    this.#t.clear(), this.#l.clear();
  }
}, ny = Z.createContext(
  void 0
), Tp = (u) => {
  const c = Z.useContext(ny);
  if (!c)
    throw new Error("No QueryClient set, use QueryClientProvider to set one");
  return c;
}, Ap = ({
  client: u,
  children: c
}) => (Z.useEffect(() => (u.mount(), () => {
  u.unmount();
}), [u]), /* @__PURE__ */ S.jsx(ny.Provider, { value: u, children: c }));
function uy(u) {
  let c = u;
  const o = /* @__PURE__ */ new Set();
  return {
    get: () => c,
    set: (r) => {
      c = { ...c, ...r }, o.forEach((d) => d());
    },
    subscribe: (r) => (o.add(r), () => {
      o.delete(r);
    })
  };
}
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const iy = (...u) => u.filter((c, o, r) => !!c && c.trim() !== "" && r.indexOf(c) === o).join(" ").trim();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Op = (u) => u.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const zp = (u) => u.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (c, o, r) => r ? r.toUpperCase() : o.toLowerCase()
);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const _h = (u) => {
  const c = zp(u);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var Fs = {
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
const xp = (u) => {
  for (const c in u)
    if (c.startsWith("aria-") || c === "role" || c === "title")
      return !0;
  return !1;
}, Mp = Z.createContext({}), Cp = () => Z.useContext(Mp), Rp = Z.forwardRef(
  ({ color: u, size: c, strokeWidth: o, absoluteStrokeWidth: r, className: d = "", children: p, iconNode: O, ...E }, b) => {
    const {
      size: y = 24,
      strokeWidth: w = 2,
      absoluteStrokeWidth: _ = !1,
      color: U = "currentColor",
      className: L = ""
    } = Cp() ?? {}, V = r ?? _ ? Number(o ?? w) * 24 / Number(c ?? y) : o ?? w;
    return Z.createElement(
      "svg",
      {
        ref: b,
        ...Fs,
        width: c ?? y ?? Fs.width,
        height: c ?? y ?? Fs.height,
        stroke: u ?? U,
        strokeWidth: V,
        className: iy("lucide", L, d),
        ...!p && !xp(E) && { "aria-hidden": "true" },
        ...E
      },
      [
        ...O.map(([N, Q]) => Z.createElement(N, Q)),
        ...Array.isArray(p) ? p : [p]
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
const we = (u, c) => {
  const o = Z.forwardRef(
    ({ className: r, ...d }, p) => Z.createElement(Rp, {
      ref: p,
      iconNode: c,
      className: iy(
        `lucide-${Op(_h(u))}`,
        `lucide-${u}`,
        r
      ),
      ...d
    })
  );
  return o.displayName = _h(u), o;
};
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const jp = [
  [
    "path",
    {
      d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
      key: "l5xja"
    }
  ],
  ["path", { d: "M9 13a4.5 4.5 0 0 0 3-4", key: "10igwf" }],
  ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5", key: "105sqy" }],
  ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396", key: "ql3yin" }],
  ["path", { d: "M6 18a4 4 0 0 1-1.967-.516", key: "2e4loj" }],
  ["path", { d: "M12 13h4", key: "1ku699" }],
  ["path", { d: "M12 18h6a2 2 0 0 1 2 2v1", key: "105ag5" }],
  ["path", { d: "M12 8h8", key: "1lhi5i" }],
  ["path", { d: "M16 8V5a2 2 0 0 1 2-2", key: "u6izg6" }],
  ["circle", { cx: "16", cy: "13", r: ".5", key: "ry7gng" }],
  ["circle", { cx: "18", cy: "3", r: ".5", key: "1aiba7" }],
  ["circle", { cx: "20", cy: "21", r: ".5", key: "yhc1fs" }],
  ["circle", { cx: "20", cy: "8", r: ".5", key: "1e43v0" }]
], wp = we("brain-circuit", jp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Dp = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
], or = we("circle-alert", Dp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const _p = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
], Nh = we("circle-check", _p);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Np = [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
], Up = we("copy", Np);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const qp = [
  ["path", { d: "M12 15V3", key: "m9g1x1" }],
  ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
  ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
], Hp = we("download", qp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Bp = [
  [
    "path",
    {
      d: "M4 12.15V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-3.35",
      key: "1wthlu"
    }
  ],
  ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
  ["path", { d: "m5 16-3 3 3 3", key: "331omg" }],
  ["path", { d: "m9 22 3-3-3-3", key: "lsp7cz" }]
], Lp = we("file-code-corner", Bp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Qp = [
  ["path", { d: "M15 6a9 9 0 0 0-9 9V3", key: "1cii5b" }],
  ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
  ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }]
], Yp = we("git-branch", Qp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Gp = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 16v-4", key: "1dtifu" }],
  ["path", { d: "M12 8h.01", key: "e9boi3" }]
], Xp = we("info", Gp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Zp = [
  [
    "path",
    {
      d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
      key: "10ikf1"
    }
  ]
], nr = we("play", Zp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Vp = [
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
], Kp = we("rotate-ccw", Vp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const Jp = [
  [
    "path",
    {
      d: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
      key: "gugj83"
    }
  ]
], Uh = we("table-2", Jp);
/**
 * @license lucide-react v1.8.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const kp = [
  [
    "path",
    {
      d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
      key: "1xq2db"
    }
  ]
], qh = we("zap", kp), Fp = /* @__PURE__ */ new Set(["出自", "分段", "related_to", "RELATED_TO"]), La = [
  {
    label: "有这个就有那个",
    facts: `认识(甲, 乙)
认识(乙, 丙)`,
    rule: "如果 认识(甲, 乙) 那么 相关(甲, 乙)"
  },
  {
    label: "两步连上",
    facts: `认识(甲, 乙)
认识(乙, 丙)`,
    rule: "如果 认识(甲, 乙) 并且 认识(乙, 丙) 那么 相关(甲, 丙)"
  },
  {
    label: "同时满足",
    facts: `认识(甲, 乙)
同类(甲, 丙)`,
    rule: "如果 认识(甲, 乙) 并且 同类(甲, 丙) 那么 相关(乙, 丙)"
  }
], Qa = [
  {
    label: "一步",
    facts: `边(甲, 乙)
边(乙, 丙)`,
    rule: "相关(X, Y) :- 边(X, Y)."
  },
  {
    label: "连下去",
    facts: `边(甲, 乙)
边(乙, 丙)`,
    rule: `相关(X, Y) :- 边(X, Y).
相关(X, Y) :- 边(X, Z), 相关(Z, Y).`
  },
  {
    label: "反过来",
    facts: `边(甲, 乙)
边(乙, 丙)`,
    rule: "反向(X, Y) :- 边(Y, X)."
  }
];
function mi(u) {
  const c = String(u || "").trim();
  return !c || c.startsWith("session:") || c.startsWith("file:") ? "" : c.replace(/[",()]/g, " ").replace(/\s+/g, "").slice(0, 24);
}
function Hh(u) {
  const c = u.properties && typeof u.properties == "object" ? u.properties : {};
  return mi(String(
    u.content || c.content || c.label || c.name || u.id || ""
  ));
}
function Wp(u, c, o) {
  const r = /* @__PURE__ */ new Map();
  for (const y of u) {
    const w = mi(String(y.type || y.edge_type || ""));
    if (!w || Fp.has(w)) continue;
    const _ = String(y.source || y.source_id || ""), U = String(y.target || y.target_id || ""), L = c.get(_) || mi(_), V = c.get(U) || mi(U);
    if (!L || !V || L === V) continue;
    const N = r.get(w) || [];
    N.length < 3 && !N.some((Q) => Q[0] === L && Q[1] === V) && (N.push([L, V]), r.set(w, N));
  }
  const d = [...r.entries()].filter((y) => y[1].length);
  if (!d.length) return o === "datalog" ? Qa : La;
  const p = [], [O, E] = d[0], b = E.map(([y, w]) => `${O}(${y}, ${w})`).join(`
`);
  if (o === "datalog") {
    if (p.push({
      label: O,
      facts: b,
      rule: `相关(X, Y) :- ${O}(X, Y).`
    }), d[1]) {
      const [y, w] = d[1];
      p.push({
        label: y,
        facts: w.map(([_, U]) => `${y}(${_}, ${U})`).join(`
`),
        rule: `相关(X, Y) :- ${y}(X, Y).`
      });
    } else
      p.push({
        label: "连下去",
        facts: b,
        rule: `相关(X, Y) :- ${O}(X, Y).
相关(X, Y) :- ${O}(X, Z), 相关(Z, Y).`
      });
    return p.push({
      label: "反过来",
      facts: b,
      rule: `反向(X, Y) :- ${O}(Y, X).`
    }), p.slice(0, 3);
  }
  if (p.push({
    label: O,
    facts: b,
    rule: `如果 ${O}(甲, 乙) 那么 相关(甲, 乙)`
  }), E.length >= 2) {
    const [y, w] = E[0], [_, U] = E[1];
    p.push({
      label: "两步连上",
      facts: `${O}(${y}, ${w})
${O}(${_}, ${U})`,
      rule: `如果 ${O}(甲, 乙) 并且 ${O}(乙, 丙) 那么 相关(甲, 丙)`
    });
  }
  if (d[1]) {
    const [y, w] = d[1], [_, U] = E[0], [L, V] = w[0];
    p.push({
      label: y,
      facts: `${O}(${_}, ${U})
${y}(${L}, ${V})`,
      rule: `如果 ${O}(甲, 乙) 并且 ${y}(甲, 丙) 那么 相关(乙, 丙)`
    });
  }
  for (; p.length < 3; ) p.push((o === "datalog" ? Qa : La)[p.length]);
  return p.slice(0, 3);
}
async function $p(u) {
  try {
    const [c, o] = await Promise.all([
      fetch("/api/graph/edges?limit=400"),
      fetch("/api/graph/nodes?limit=400")
    ]), r = c.ok ? await c.json() : {}, d = o.ok ? await o.json() : {}, p = Array.isArray(r.edges) ? r.edges : [], O = Array.isArray(d.nodes) ? d.nodes : [], E = /* @__PURE__ */ new Map();
    for (const w of O) {
      if (!w || typeof w != "object") continue;
      const _ = String(w.id || ""), U = Hh(w);
      _ && U && E.set(_, U);
    }
    const b = Wp(p, E, u), y = O.filter((w) => w && typeof w == "object" && String(w.type || "") === "owl:Class").map((w) => Hh(w)).filter(Boolean).slice(0, 12);
    if (y.length) {
      const w = y.map((U) => `Class(${U})`).join(`
`);
      return [u === "datalog" ? { label: "工作台类", facts: w, rule: "WorkType(X) :- Class(X)." } : { label: "工作台类", facts: w, rule: "如果 Class(甲) 那么 WorkType(甲)" }, ...b].slice(0, 4);
    }
    return b;
  } catch {
    return u === "datalog" ? Qa : La;
  }
}
const Bh = /* @__PURE__ */ new Map(), di = /* @__PURE__ */ new Map();
function Ip(u) {
  let c = Bh.get(u);
  if (!c) {
    const o = u === "datalog" ? Qa : La;
    c = uy({
      facts: o[0].facts,
      rules: o[0].rule,
      result: null,
      isRunning: !1,
      error: "",
      applyToGraph: !1
    }), Bh.set(u, c);
  }
  return c;
}
function Pp(u) {
  const c = u.mode || "forward", o = c === "datalog", r = Tp(), d = Ip(c), p = Z.useSyncExternalStore(d.subscribe, d.get, d.get), [O, E] = Z.useState(
    c === "datalog" ? Qa : La
  ), b = p.facts, y = p.rules, w = p.applyToGraph, _ = p.result, U = p.isRunning, L = p.error, V = (q) => d.set({ facts: q }), N = (q) => d.set({ rules: q }), Q = (q) => d.set({ applyToGraph: q }), J = (q) => {
    d.set({ result: typeof q == "function" ? q(d.get().result) : q });
  }, $ = (q) => d.set({ error: q });
  Z.useEffect(() => {
    let q = !0;
    const Y = c === "datalog" ? Qa : La;
    return E(Y), $p(c).then((yt) => {
      if (!q || !yt.length) return;
      E(yt);
      const at = d.get();
      at.isRunning || at.result || at.facts !== Y[0].facts || at.rules !== Y[0].rule || d.set({ facts: yt[0].facts, rules: yt[0].rule });
    }), () => {
      q = !1;
    };
  }, [c, d]), Z.useEffect(() => {
    const q = () => {
      J(null), $("");
    }, Y = (yt) => {
      const at = yt.detail || {};
      J((P) => P && { ...P, mutated: !0, added_edges: at.added_edges ?? P.added_edges }), r.invalidateQueries({ queryKey: ["graph", "full-load"] });
    };
    return window.addEventListener("dsh-reason-redo", q), window.addEventListener("dsh-reason-applied", Y), () => {
      window.removeEventListener("dsh-reason-redo", q), window.removeEventListener("dsh-reason-applied", Y);
    };
  }, [r]);
  async function dt() {
    if (di.has(c)) return di.get(c);
    d.set({ isRunning: !0, error: "", result: null });
    const q = (async () => {
      try {
        const Y = d.get(), yt = await fetch("/api/reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facts: Y.facts.split(/\r?\n/).map((P) => P.trim()).filter(Boolean),
            rules: Y.rules.split(/\r?\n/).map((P) => P.trim()).filter(Boolean),
            mode: c,
            apply_to_graph: !1
          })
        }), at = await yt.json();
        if (!yt.ok) throw new Error(at.detail || `Status ${yt.status}`);
        d.set({
          result: at,
          isRunning: !1,
          error: yt.status === 207 ? at.message || "推理只完成一部分。" : ""
        }), at.mutated && r.invalidateQueries({ queryKey: ["graph", "full-load"] });
      } catch (Y) {
        d.set({ isRunning: !1, error: Y instanceof Error ? Y.message : "推理没跑成。" });
      } finally {
        di.delete(c);
      }
    })();
    return di.set(c, q), q;
  }
  function ht(q) {
    V(q.facts), N(q.rule), J(null), $("");
  }
  function nt() {
    const q = O[0];
    V(q.facts), N(q.rule), J(null), $("");
  }
  return /* @__PURE__ */ S.jsxs("div", { className: "ws-page", style: { flexDirection: "row" }, children: [
    /* @__PURE__ */ S.jsxs("div", { style: { width: 480, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--ws-border)", overflow: "hidden", minHeight: 0 }, children: [
      /* @__PURE__ */ S.jsx("div", { style: { padding: "18px 20px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }, children: /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }, children: [
        /* @__PURE__ */ S.jsx("div", { style: { width: 32, height: 32, borderRadius: 10, background: "var(--ws-accent-soft)", border: "1px solid var(--ws-border-strong)", display: "grid", placeItems: "center", color: "var(--ws-accent)", flexShrink: 0 }, children: /* @__PURE__ */ S.jsx(wp, { size: 16 }) }),
        /* @__PURE__ */ S.jsxs("div", { children: [
          /* @__PURE__ */ S.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 2 }, children: o ? "逻辑规则" : c === "rete" ? "模式匹配" : "Forward Chaining" }),
          /* @__PURE__ */ S.jsx("div", { style: { color: "var(--ws-text)", fontWeight: 700, fontSize: 15, lineHeight: 1 }, children: "Inference Engine" })
        ] })
      ] }) }),
      /* @__PURE__ */ S.jsxs("div", { style: { padding: "12px 16px 10px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0 }, children: [
        /* @__PURE__ */ S.jsx("div", { className: "ws-eyebrow", style: { marginBottom: 8 }, children: "Quick Templates" }),
        /* @__PURE__ */ S.jsx("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: O.map((q) => /* @__PURE__ */ S.jsx("button", { className: "ws-btn ws-btn--ghost", style: { padding: "5px 10px", fontSize: 11 }, onClick: () => ht(q), children: q.label }, q.label)) })
      ] }),
      /* @__PURE__ */ S.jsxs("div", { className: "ws-scroll ws-padded", style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
        /* @__PURE__ */ S.jsxs("div", { children: [
          /* @__PURE__ */ S.jsx("label", { className: "ws-label", children: "Facts" }),
          /* @__PURE__ */ S.jsxs("div", { className: "ws-body", style: { marginBottom: 8 }, children: [
            "每行一条事实，写成 ",
            /* @__PURE__ */ S.jsx("code", { style: { color: "var(--ws-accent)", fontSize: 11 }, children: "predicate(subject, object)" }),
            "。"
          ] }),
          /* @__PURE__ */ S.jsx(
            "textarea",
            {
              className: "ws-textarea",
              value: b,
              onChange: (q) => V(q.target.value),
              rows: 6,
              spellCheck: !1
            }
          )
        ] }),
        /* @__PURE__ */ S.jsxs("div", { children: [
          /* @__PURE__ */ S.jsx("label", { className: "ws-label", children: "Rules" }),
          /* @__PURE__ */ S.jsx("div", { className: "ws-body", style: { marginBottom: 8 }, children: o ? /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
            "逻辑规则写成 ",
            /* @__PURE__ */ S.jsx("code", { style: { color: "var(--ws-amber)", fontSize: 11 }, children: "补货(X, Y) :- 售卖(X, Y)." }),
            "，英文谓词也能用"
          ] }) : /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
            "往前推 / 模式匹配写成 ",
            /* @__PURE__ */ S.jsx("code", { style: { color: "var(--ws-amber)", fontSize: 11 }, children: "如果 … 并且 … 那么 …" }),
            "，英文 IF / AND / THEN 也能用"
          ] }) }),
          /* @__PURE__ */ S.jsx(
            "textarea",
            {
              className: "ws-textarea",
              value: y,
              onChange: (q) => N(q.target.value),
              rows: 5,
              spellCheck: !1
            }
          )
        ] }),
        /* @__PURE__ */ S.jsxs("label", { className: "dsh-reason-write-toggle", style: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: "var(--ws-radius-sm)", border: "1px solid var(--ws-border)", background: w ? "var(--ws-green-soft)" : "var(--ws-surface)" }, children: [
          /* @__PURE__ */ S.jsxs("div", { style: { position: "relative", width: 36, height: 20, flexShrink: 0 }, children: [
            /* @__PURE__ */ S.jsx(
              "input",
              {
                type: "checkbox",
                checked: w,
                onChange: (q) => Q(q.target.checked),
                style: { opacity: 0, position: "absolute", inset: 0, cursor: "pointer", margin: 0 }
              }
            ),
            /* @__PURE__ */ S.jsx("div", { style: { position: "absolute", inset: 0, borderRadius: 999, background: w ? "var(--ws-green)" : "rgba(255,255,255,0.12)", transition: "background 180ms ease" } }),
            /* @__PURE__ */ S.jsx("div", { style: { position: "absolute", top: 3, left: w ? 19 : 3, width: 14, height: 14, borderRadius: 999, background: "#fff", transition: "left 180ms ease", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" } })
          ] }),
          /* @__PURE__ */ S.jsxs("div", { children: [
            /* @__PURE__ */ S.jsx("div", { style: { fontSize: 13, fontWeight: 700, color: w ? "#6ee7b7" : "var(--ws-text-muted)" }, children: "Write inferred facts to graph" }),
            /* @__PURE__ */ S.jsx("div", { style: { fontSize: 11, color: "var(--ws-text-dim)" }, children: "Inferred binary facts are added as edges" })
          ] })
        ] }),
        /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ S.jsx(
            "button",
            {
              className: "ws-btn ws-btn--primary",
              onClick: dt,
              disabled: U,
              style: { flex: 1, justifyContent: "center" },
              children: U ? /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
                /* @__PURE__ */ S.jsx("span", { className: "ws-spin", style: { display: "inline-block" }, children: /* @__PURE__ */ S.jsx(qh, { size: 15 }) }),
                "Running…"
              ] }) : /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
                /* @__PURE__ */ S.jsx(nr, { size: 14 }),
                "Run Reasoning"
              ] })
            }
          ),
          /* @__PURE__ */ S.jsx("button", { className: "ws-btn ws-btn--ghost", onClick: nt, title: "Reset to defaults", children: /* @__PURE__ */ S.jsx(Kp, { size: 14 }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ S.jsxs("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }, children: [
      /* @__PURE__ */ S.jsxs("div", { style: { padding: "18px 24px 14px", borderBottom: "1px solid var(--ws-border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }, children: [
        /* @__PURE__ */ S.jsx("div", { style: { fontSize: 15, fontWeight: 700, color: "var(--ws-text)" }, children: "Inference Results" }),
        _ && !U && /* @__PURE__ */ S.jsxs("div", { style: { marginLeft: "auto", display: "flex", gap: 6 }, children: [
          /* @__PURE__ */ S.jsxs("span", { className: "ws-pill ws-pill--accent", children: [
            /* @__PURE__ */ S.jsx(qh, { size: 9 }),
            " ",
            _.rules_fired ?? 0,
            " 条规则触发"
          ] }),
          /* @__PURE__ */ S.jsxs("span", { className: "ws-pill ws-pill--green", children: [
            /* @__PURE__ */ S.jsx(Yp, { size: 9 }),
            " ",
            _.added_edges ?? 0,
            " 条边加入"
          ] }),
          _.mutated ? /* @__PURE__ */ S.jsx("span", { className: "ws-pill ws-pill--green", children: "graph updated" }) : /* @__PURE__ */ S.jsx("span", { className: "ws-pill ws-pill--mono", children: "preview only" })
        ] })
      ] }),
      /* @__PURE__ */ S.jsxs("div", { className: "ws-scroll ws-padded", style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
        L && /* @__PURE__ */ S.jsxs("div", { className: "ws-animate-in", style: { display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-red-soft)", border: "1px solid rgba(255,123,114,0.28)", color: "#fca5a5", fontSize: 13 }, children: [
          /* @__PURE__ */ S.jsx(or, { size: 16, style: { flexShrink: 0, marginTop: 1 } }),
          /* @__PURE__ */ S.jsx("div", { children: L })
        ] }),
        U && /* @__PURE__ */ S.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [1, 2, 3, 4].map((q) => /* @__PURE__ */ S.jsx("div", { className: "ws-skeleton", style: { height: 52 } }, q)) }),
        _ && !U && /* @__PURE__ */ S.jsx("div", { className: "ws-animate-in", children: (_.inferred_facts ?? []).length === 0 ? /* @__PURE__ */ S.jsxs("div", { className: "ws-empty", children: [
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ S.jsx(Nh, { size: 32 }) }),
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-title", children: "Reasoning complete" }),
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-body", children: "No new facts were inferred from the current rule set and facts." })
        ] }) : /* @__PURE__ */ S.jsx("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: _.inferred_facts.map((q, Y) => /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-surface)", border: "1px solid var(--ws-border)" }, children: [
          /* @__PURE__ */ S.jsx("div", { style: { width: 20, height: 20, borderRadius: 6, background: "var(--ws-green-soft)", border: "1px solid rgba(76,195,138,0.28)", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }, children: /* @__PURE__ */ S.jsx(Nh, { size: 11, color: "var(--ws-green)" }) }),
          /* @__PURE__ */ S.jsx("code", { style: { fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 12, color: "var(--ws-text)", lineHeight: 1.6, wordBreak: "break-all" }, children: q })
        ] }, `${q}-${Y}`)) }) }),
        !_ && !U && !L && /* @__PURE__ */ S.jsxs("div", { className: "ws-empty", children: [
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ S.jsx(Xp, { size: 32 }) }),
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-title", children: "Ready to reason" }),
          /* @__PURE__ */ S.jsx("div", { className: "ws-empty-body", children: "Enter facts and rules on the left, then click Run Reasoning to see inferred statements here." })
        ] })
      ] })
    ] })
  ] });
}
function Lh(u, c) {
  (c == null || c > u.length) && (c = u.length);
  for (var o = 0, r = Array(c); o < c; o++) r[o] = u[o];
  return r;
}
function tv(u) {
  if (Array.isArray(u)) return u;
}
function ev(u, c, o) {
  return (c = sv(c)) in u ? Object.defineProperty(u, c, {
    value: o,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : u[c] = o, u;
}
function lv(u, c) {
  var o = u == null ? null : typeof Symbol < "u" && u[Symbol.iterator] || u["@@iterator"];
  if (o != null) {
    var r, d, p, O, E = [], b = !0, y = !1;
    try {
      if (p = (o = o.call(u)).next, c !== 0) for (; !(b = (r = p.call(o)).done) && (E.push(r.value), E.length !== c); b = !0) ;
    } catch (w) {
      y = !0, d = w;
    } finally {
      try {
        if (!b && o.return != null && (O = o.return(), Object(O) !== O)) return;
      } finally {
        if (y) throw d;
      }
    }
    return E;
  }
}
function av() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function Qh(u, c) {
  var o = Object.keys(u);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(u);
    c && (r = r.filter(function(d) {
      return Object.getOwnPropertyDescriptor(u, d).enumerable;
    })), o.push.apply(o, r);
  }
  return o;
}
function Yh(u) {
  for (var c = 1; c < arguments.length; c++) {
    var o = arguments[c] != null ? arguments[c] : {};
    c % 2 ? Qh(Object(o), !0).forEach(function(r) {
      ev(u, r, o[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(u, Object.getOwnPropertyDescriptors(o)) : Qh(Object(o)).forEach(function(r) {
      Object.defineProperty(u, r, Object.getOwnPropertyDescriptor(o, r));
    });
  }
  return u;
}
function nv(u, c) {
  if (u == null) return {};
  var o, r, d = uv(u, c);
  if (Object.getOwnPropertySymbols) {
    var p = Object.getOwnPropertySymbols(u);
    for (r = 0; r < p.length; r++) o = p[r], c.indexOf(o) === -1 && {}.propertyIsEnumerable.call(u, o) && (d[o] = u[o]);
  }
  return d;
}
function uv(u, c) {
  if (u == null) return {};
  var o = {};
  for (var r in u) if ({}.hasOwnProperty.call(u, r)) {
    if (c.indexOf(r) !== -1) continue;
    o[r] = u[r];
  }
  return o;
}
function iv(u, c) {
  return tv(u) || lv(u, c) || rv(u, c) || av();
}
function cv(u, c) {
  if (typeof u != "object" || !u) return u;
  var o = u[Symbol.toPrimitive];
  if (o !== void 0) {
    var r = o.call(u, c);
    if (typeof r != "object") return r;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (c === "string" ? String : Number)(u);
}
function sv(u) {
  var c = cv(u, "string");
  return typeof c == "symbol" ? c : c + "";
}
function rv(u, c) {
  if (u) {
    if (typeof u == "string") return Lh(u, c);
    var o = {}.toString.call(u).slice(8, -1);
    return o === "Object" && u.constructor && (o = u.constructor.name), o === "Map" || o === "Set" ? Array.from(u) : o === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o) ? Lh(u, c) : void 0;
  }
}
function ov(u, c, o) {
  return c in u ? Object.defineProperty(u, c, {
    value: o,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : u[c] = o, u;
}
function Gh(u, c) {
  var o = Object.keys(u);
  if (Object.getOwnPropertySymbols) {
    var r = Object.getOwnPropertySymbols(u);
    c && (r = r.filter(function(d) {
      return Object.getOwnPropertyDescriptor(u, d).enumerable;
    })), o.push.apply(o, r);
  }
  return o;
}
function Xh(u) {
  for (var c = 1; c < arguments.length; c++) {
    var o = arguments[c] != null ? arguments[c] : {};
    c % 2 ? Gh(Object(o), !0).forEach(function(r) {
      ov(u, r, o[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(u, Object.getOwnPropertyDescriptors(o)) : Gh(Object(o)).forEach(function(r) {
      Object.defineProperty(u, r, Object.getOwnPropertyDescriptor(o, r));
    });
  }
  return u;
}
function fv() {
  for (var u = arguments.length, c = new Array(u), o = 0; o < u; o++)
    c[o] = arguments[o];
  return function(r) {
    return c.reduceRight(function(d, p) {
      return p(d);
    }, r);
  };
}
function Ln(u) {
  return function c() {
    for (var o = this, r = arguments.length, d = new Array(r), p = 0; p < r; p++)
      d[p] = arguments[p];
    return d.length >= u.length ? u.apply(this, d) : function() {
      for (var O = arguments.length, E = new Array(O), b = 0; b < O; b++)
        E[b] = arguments[b];
      return c.apply(o, [].concat(d, E));
    };
  };
}
function vi(u) {
  return {}.toString.call(u).includes("Object");
}
function dv(u) {
  return !Object.keys(u).length;
}
function Zn(u) {
  return typeof u == "function";
}
function hv(u, c) {
  return Object.prototype.hasOwnProperty.call(u, c);
}
function yv(u, c) {
  return vi(c) || wl("changeType"), Object.keys(c).some(function(o) {
    return !hv(u, o);
  }) && wl("changeField"), c;
}
function mv(u) {
  Zn(u) || wl("selectorType");
}
function gv(u) {
  Zn(u) || vi(u) || wl("handlerType"), vi(u) && Object.values(u).some(function(c) {
    return !Zn(c);
  }) && wl("handlersType");
}
function pv(u) {
  u || wl("initialIsRequired"), vi(u) || wl("initialType"), dv(u) && wl("initialContent");
}
function vv(u, c) {
  throw new Error(u[c] || u.default);
}
var bv = {
  initialIsRequired: "initial state is required",
  initialType: "initial state should be an object",
  initialContent: "initial state shouldn't be an empty object",
  handlerType: "handler should be an object or a function",
  handlersType: "all handlers should be a functions",
  selectorType: "selector should be a function",
  changeType: "provided value of changes should be an object",
  changeField: 'it seams you want to change a field in the state which is not specified in the "initial" state',
  default: "an unknown error accured in `state-local` package"
}, wl = Ln(vv)(bv), hi = {
  changes: yv,
  selector: mv,
  handler: gv,
  initial: pv
};
function Sv(u) {
  var c = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
  hi.initial(u), hi.handler(c);
  var o = {
    current: u
  }, r = Ln(Av)(o, c), d = Ln(Tv)(o), p = Ln(hi.changes)(u), O = Ln(Ev)(o);
  function E() {
    var y = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : function(w) {
      return w;
    };
    return hi.selector(y), y(o.current);
  }
  function b(y) {
    fv(r, d, p, O)(y);
  }
  return [E, b];
}
function Ev(u, c) {
  return Zn(c) ? c(u.current) : c;
}
function Tv(u, c) {
  return u.current = Xh(Xh({}, u.current), c), c;
}
function Av(u, c, o) {
  return Zn(c) ? c(u.current) : Object.keys(o).forEach(function(r) {
    var d;
    return (d = c[r]) === null || d === void 0 ? void 0 : d.call(c, u.current[r]);
  }), o;
}
var Ov = {
  create: Sv
}, zv = {
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs"
  }
};
function xv(u) {
  return function c() {
    for (var o = this, r = arguments.length, d = new Array(r), p = 0; p < r; p++)
      d[p] = arguments[p];
    return d.length >= u.length ? u.apply(this, d) : function() {
      for (var O = arguments.length, E = new Array(O), b = 0; b < O; b++)
        E[b] = arguments[b];
      return c.apply(o, [].concat(d, E));
    };
  };
}
function Mv(u) {
  return {}.toString.call(u).includes("Object");
}
function Cv(u) {
  return u || Zh("configIsRequired"), Mv(u) || Zh("configType"), u.urls ? (Rv(), {
    paths: {
      vs: u.urls.monacoBase
    }
  }) : u;
}
function Rv() {
  console.warn(cy.deprecation);
}
function jv(u, c) {
  throw new Error(u[c] || u.default);
}
var cy = {
  configIsRequired: "the configuration object is required",
  configType: "the configuration object should be an object",
  default: "an unknown error accured in `@monaco-editor/loader` package",
  deprecation: `Deprecation warning!
    You are using deprecated way of configuration.

    Instead of using
      monaco.config({ urls: { monacoBase: '...' } })
    use
      monaco.config({ paths: { vs: '...' } })

    For more please check the link https://github.com/suren-atoyan/monaco-loader#config
  `
}, Zh = xv(jv)(cy), wv = {
  config: Cv
}, Dv = function() {
  for (var c = arguments.length, o = new Array(c), r = 0; r < c; r++)
    o[r] = arguments[r];
  return function(d) {
    return o.reduceRight(function(p, O) {
      return O(p);
    }, d);
  };
};
function sy(u, c) {
  return Object.keys(c).forEach(function(o) {
    c[o] instanceof Object && u[o] && Object.assign(c[o], sy(u[o], c[o]));
  }), Yh(Yh({}, u), c);
}
var _v = {
  type: "cancelation",
  msg: "operation is manually canceled"
};
function Ws(u) {
  var c = !1, o = new Promise(function(r, d) {
    u.then(function(p) {
      return c ? d(_v) : r(p);
    }), u.catch(d);
  });
  return o.cancel = function() {
    return c = !0;
  }, o;
}
var Nv = ["monaco"], Uv = Ov.create({
  config: zv,
  isInitialized: !1,
  resolve: null,
  reject: null,
  monaco: null
}), ry = iv(Uv, 2), Kn = ry[0], Ai = ry[1];
function qv(u) {
  var c = wv.config(u), o = c.monaco, r = nv(c, Nv);
  Ai(function(d) {
    return {
      config: sy(d.config, r),
      monaco: o
    };
  });
}
function Hv() {
  var u = Kn(function(c) {
    var o = c.monaco, r = c.isInitialized, d = c.resolve;
    return {
      monaco: o,
      isInitialized: r,
      resolve: d
    };
  });
  if (!u.isInitialized) {
    if (Ai({
      isInitialized: !0
    }), u.monaco)
      return u.resolve(u.monaco), Ws($s);
    if (window.monaco && window.monaco.editor)
      return oy(window.monaco), u.resolve(window.monaco), Ws($s);
    Dv(Bv, Qv)(Yv);
  }
  return Ws($s);
}
function Bv(u) {
  return document.body.appendChild(u);
}
function Lv(u) {
  var c = document.createElement("script");
  return u && (c.src = u), c;
}
function Qv(u) {
  var c = Kn(function(r) {
    var d = r.config, p = r.reject;
    return {
      config: d,
      reject: p
    };
  }), o = Lv("".concat(c.config.paths.vs, "/loader.js"));
  return o.onload = function() {
    return u();
  }, o.onerror = c.reject, o;
}
function Yv() {
  var u = Kn(function(o) {
    var r = o.config, d = o.resolve, p = o.reject;
    return {
      config: r,
      resolve: d,
      reject: p
    };
  }), c = window.require;
  c.config(u.config), c(["vs/editor/editor.main"], function(o) {
    var r = o.m || o;
    oy(r), u.resolve(r);
  }, function(o) {
    u.reject(o);
  });
}
function oy(u) {
  Kn().monaco || Ai({
    monaco: u
  });
}
function Gv() {
  return Kn(function(u) {
    var c = u.monaco;
    return c;
  });
}
var $s = new Promise(function(u, c) {
  return Ai({
    resolve: u,
    reject: c
  });
}), bi = {
  config: qv,
  init: Hv,
  __getMonacoInstance: Gv
}, Xv = { wrapper: { display: "flex", position: "relative", textAlign: "initial" }, fullWidth: { width: "100%" }, hide: { display: "none" } }, Is = Xv, Zv = { container: { display: "flex", height: "100%", width: "100%", justifyContent: "center", alignItems: "center" } }, Vv = Zv;
function Kv({ children: u }) {
  return Ba.createElement("div", { style: Vv.container }, u);
}
var Jv = Kv, kv = Jv;
function Fv({ width: u, height: c, isEditorReady: o, loading: r, _ref: d, className: p, wrapperProps: O }) {
  return Ba.createElement("section", { style: { ...Is.wrapper, width: u, height: c }, ...O }, !o && Ba.createElement(kv, null, r), Ba.createElement("div", { ref: d, style: { ...Is.fullWidth, ...!o && Is.hide }, className: p }));
}
var Wv = Fv, fy = Z.memo(Wv);
function $v(u) {
  Z.useEffect(u, []);
}
var fr = $v;
function Iv(u, c, o = !0) {
  let r = Z.useRef(!0);
  Z.useEffect(r.current || !o ? () => {
    r.current = !1;
  } : u, c);
}
var be = Iv;
function Yn() {
}
function Ha(u, c, o, r) {
  return Pv(u, r) || t0(u, c, o, r);
}
function Pv(u, c) {
  return u.editor.getModel(dy(u, c));
}
function t0(u, c, o, r) {
  return u.editor.createModel(c, o, r ? dy(u, r) : void 0);
}
function dy(u, c) {
  return u.Uri.parse(c);
}
function e0({ original: u, modified: c, language: o, originalLanguage: r, modifiedLanguage: d, originalModelPath: p, modifiedModelPath: O, keepCurrentOriginalModel: E = !1, keepCurrentModifiedModel: b = !1, theme: y = "light", loading: w = "Loading...", options: _ = {}, height: U = "100%", width: L = "100%", className: V, wrapperProps: N = {}, beforeMount: Q = Yn, onMount: J = Yn }) {
  let [$, dt] = Z.useState(!1), [ht, nt] = Z.useState(!0), q = Z.useRef(null), Y = Z.useRef(null), yt = Z.useRef(null), at = Z.useRef(J), P = Z.useRef(Q), Zt = Z.useRef(!1);
  fr(() => {
    let st = bi.init();
    return st.then((M) => (Y.current = M) && nt(!1)).catch((M) => M?.type !== "cancelation" && console.error("Monaco initialization: error:", M)), () => q.current ? $t() : st.cancel();
  }), be(() => {
    if (q.current && Y.current) {
      let st = q.current.getOriginalEditor(), M = Ha(Y.current, u || "", r || o || "text", p || "");
      M !== st.getModel() && st.setModel(M);
    }
  }, [p], $), be(() => {
    if (q.current && Y.current) {
      let st = q.current.getModifiedEditor(), M = Ha(Y.current, c || "", d || o || "text", O || "");
      M !== st.getModel() && st.setModel(M);
    }
  }, [O], $), be(() => {
    let st = q.current.getModifiedEditor();
    st.getOption(Y.current.editor.EditorOption.readOnly) ? st.setValue(c || "") : c !== st.getValue() && (st.executeEdits("", [{ range: st.getModel().getFullModelRange(), text: c || "", forceMoveMarkers: !0 }]), st.pushUndoStop());
  }, [c], $), be(() => {
    q.current?.getModel()?.original.setValue(u || "");
  }, [u], $), be(() => {
    let { original: st, modified: M } = q.current.getModel();
    Y.current.editor.setModelLanguage(st, r || o || "text"), Y.current.editor.setModelLanguage(M, d || o || "text");
  }, [o, r, d], $), be(() => {
    Y.current?.editor.setTheme(y);
  }, [y], $), be(() => {
    q.current?.updateOptions(_);
  }, [_], $);
  let Qt = Z.useCallback(() => {
    if (!Y.current) return;
    P.current(Y.current);
    let st = Ha(Y.current, u || "", r || o || "text", p || ""), M = Ha(Y.current, c || "", d || o || "text", O || "");
    q.current?.setModel({ original: st, modified: M });
  }, [o, c, d, u, r, p, O]), Se = Z.useCallback(() => {
    !Zt.current && yt.current && (q.current = Y.current.editor.createDiffEditor(yt.current, { automaticLayout: !0, ..._ }), Qt(), Y.current?.editor.setTheme(y), dt(!0), Zt.current = !0);
  }, [_, y, Qt]);
  Z.useEffect(() => {
    $ && at.current(q.current, Y.current);
  }, [$]), Z.useEffect(() => {
    !ht && !$ && Se();
  }, [ht, $, Se]);
  function $t() {
    let st = q.current?.getModel();
    E || st?.original?.dispose(), b || st?.modified?.dispose(), q.current?.dispose();
  }
  return Ba.createElement(fy, { width: L, height: U, isEditorReady: $, loading: w, _ref: yt, className: V, wrapperProps: N });
}
var l0 = e0;
Z.memo(l0);
function a0() {
  let [u, c] = Z.useState(bi.__getMonacoInstance());
  return fr(() => {
    let o;
    return u || (o = bi.init(), o.then((r) => {
      c(r);
    })), () => o?.cancel();
  }), u;
}
var n0 = a0;
function u0(u) {
  let c = Z.useRef();
  return Z.useEffect(() => {
    c.current = u;
  }, [u]), c.current;
}
var i0 = u0, yi = /* @__PURE__ */ new Map();
function c0({ defaultValue: u, defaultLanguage: c, defaultPath: o, value: r, language: d, path: p, theme: O = "light", line: E, loading: b = "Loading...", options: y = {}, overrideServices: w = {}, saveViewState: _ = !0, keepCurrentModel: U = !1, width: L = "100%", height: V = "100%", className: N, wrapperProps: Q = {}, beforeMount: J = Yn, onMount: $ = Yn, onChange: dt, onValidate: ht = Yn }) {
  let [nt, q] = Z.useState(!1), [Y, yt] = Z.useState(!0), at = Z.useRef(null), P = Z.useRef(null), Zt = Z.useRef(null), Qt = Z.useRef($), Se = Z.useRef(J), $t = Z.useRef(), st = Z.useRef(r), M = i0(p), H = Z.useRef(!1), F = Z.useRef(!1);
  fr(() => {
    let m = bi.init();
    return m.then((R) => (at.current = R) && yt(!1)).catch((R) => R?.type !== "cancelation" && console.error("Monaco initialization: error:", R)), () => P.current ? St() : m.cancel();
  }), be(() => {
    let m = Ha(at.current, u || r || "", c || d || "", p || o || "");
    m !== P.current?.getModel() && (_ && yi.set(M, P.current?.saveViewState()), P.current?.setModel(m), _ && P.current?.restoreViewState(yi.get(p)));
  }, [p], nt), be(() => {
    P.current?.updateOptions(y);
  }, [y], nt), be(() => {
    !P.current || r === void 0 || (P.current.getOption(at.current.editor.EditorOption.readOnly) ? P.current.setValue(r) : r !== P.current.getValue() && (F.current = !0, P.current.executeEdits("", [{ range: P.current.getModel().getFullModelRange(), text: r, forceMoveMarkers: !0 }]), P.current.pushUndoStop(), F.current = !1));
  }, [r], nt), be(() => {
    let m = P.current?.getModel();
    m && d && at.current?.editor.setModelLanguage(m, d);
  }, [d], nt), be(() => {
    E !== void 0 && P.current?.revealLine(E);
  }, [E], nt), be(() => {
    at.current?.editor.setTheme(O);
  }, [O], nt);
  let pt = Z.useCallback(() => {
    if (!(!Zt.current || !at.current) && !H.current) {
      Se.current(at.current);
      let m = p || o, R = Ha(at.current, r || u || "", c || d || "", m || "");
      P.current = at.current?.editor.create(Zt.current, { model: R, automaticLayout: !0, ...y }, w), _ && P.current.restoreViewState(yi.get(m)), at.current.editor.setTheme(O), E !== void 0 && P.current.revealLine(E), q(!0), H.current = !0;
    }
  }, [u, c, o, r, d, p, y, w, _, O, E]);
  Z.useEffect(() => {
    nt && Qt.current(P.current, at.current);
  }, [nt]), Z.useEffect(() => {
    !Y && !nt && pt();
  }, [Y, nt, pt]), st.current = r, Z.useEffect(() => {
    nt && dt && ($t.current?.dispose(), $t.current = P.current?.onDidChangeModelContent((m) => {
      F.current || dt(P.current.getValue(), m);
    }));
  }, [nt, dt]), Z.useEffect(() => {
    if (nt) {
      let m = at.current.editor.onDidChangeMarkers((R) => {
        let B = P.current.getModel()?.uri;
        if (B && R.find((G) => G.path === B.path)) {
          let G = at.current.editor.getModelMarkers({ resource: B });
          ht?.(G);
        }
      });
      return () => {
        m?.dispose();
      };
    }
    return () => {
    };
  }, [nt, ht]);
  function St() {
    $t.current?.dispose(), U ? _ && yi.set(p, P.current.saveViewState()) : P.current.getModel()?.dispose(), P.current.dispose();
  }
  return Ba.createElement(fy, { width: L, height: V, isEditorReady: nt, loading: b, _ref: Zt, className: N, wrapperProps: Q });
}
var s0 = c0, r0 = Z.memo(s0), o0 = r0;
function f0(u) {
  if (!u || typeof u != "object") return u;
  const c = u;
  if (Array.isArray(c.columns) && Array.isArray(c.rows)) return c;
  const o = Array.isArray(c.head?.vars) ? c.head.vars : [], d = (Array.isArray(c.results?.bindings) ? c.results.bindings : []).map((p) => {
    const O = {};
    for (const E of o) {
      const b = p && p[E];
      O[E] = b && b.value != null ? String(b.value) : "";
    }
    return O;
  });
  return { ...c, columns: o, rows: d };
}
const Vh = [
  { label: "All triples", query: `SELECT ?s ?p ?o
WHERE {
  ?s ?p ?o
}
LIMIT 20` },
  { label: "Node types", query: `SELECT ?type (COUNT(?s) AS ?count)
WHERE {
  ?s a ?type
}
GROUP BY ?type
ORDER BY DESC(?count)` },
  { label: "Outgoing edges", query: `SELECT ?predicate ?object
WHERE {
  <urn:node:example> ?predicate ?object
}
LIMIT 50` },
  { label: "Path between", query: `SELECT ?mid ?p1 ?p2
WHERE {
  <urn:node:a> ?p1 ?mid .
  ?mid ?p2 <urn:node:b>
}
LIMIT 20` }
];
function d0() {
  const u = n0(), c = Z.useRef(null), [o, r] = Z.useState(Vh[0].query), [d, p] = Z.useState(null), [O, E] = Z.useState(!1), [b, y] = Z.useState(!1);
  function w(N) {
    N.languages.getLanguages().some((Q) => Q.id === "sparql") || (N.languages.register({ id: "sparql" }), N.languages.setMonarchTokensProvider("sparql", {
      keywords: ["SELECT", "WHERE", "LIMIT", "FILTER", "OPTIONAL", "PREFIX", "ORDER", "BY", "DESC", "ASC", "GROUP", "DISTINCT", "CONSTRUCT", "ASK", "DESCRIBE"],
      tokenizer: {
        root: [
          [/[a-zA-Z_]\w*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
          [/[?$][a-zA-Z_]\w*/, "variable.name"],
          [/<[^>]+>/, "string.uri"],
          [/"[^"]*"/, "string"],
          [/#.*/, "comment"],
          [/[0-9]+(\.[0-9]+)?/, "number"]
        ]
      }
    }), N.editor.defineTheme("sparql-dark", {
      base: "vs-dark",
      inherit: !0,
      rules: [
        { token: "keyword", foreground: "58a6ff", fontStyle: "bold" },
        { token: "variable.name", foreground: "a5d6ff" },
        { token: "string.uri", foreground: "7ee787" },
        { token: "string", foreground: "a5d6ff" },
        { token: "comment", foreground: "4a6a85", fontStyle: "italic" },
        { token: "number", foreground: "f2b66d" }
      ],
      colors: {
        "editor.background": "#050c18",
        "editor.lineHighlightBackground": "#0a1628",
        "editorLineNumber.foreground": "#2a4060",
        "editorCursor.foreground": "#4aa3ff",
        "editor.selectionBackground": "#1e3a5a"
      }
    }));
  }
  function _(N) {
    c.current = N;
  }
  async function U() {
    E(!0), p(null), u && c.current && u.editor.setModelMarkers(c.current.getModel(), "sparql", []);
    try {
      const N = await fetch("/api/sparql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: o })
      });
      if (!N.headers.get("content-type")?.includes("application/json")) {
        const J = await N.text();
        throw new Error(`HTTP ${N.status}: ${J.substring(0, 100)}`);
      }
      const Q = await N.json();
      N.status === 207 && (Q.error = Q.message || "Warning: Partial success running query."), Q.error && Q.error_line && u && c.current && u.editor.setModelMarkers(c.current.getModel(), "sparql", [{
        startLineNumber: Q.error_line,
        startColumn: Q.error_column || 1,
        endLineNumber: Q.error_line,
        endColumn: 100,
        message: Q.error,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        severity: u.MarkerSeverity.Error
      }]), p(f0(Q));
    } catch (N) {
      const Q = N instanceof Error ? N.message : "Network error — could not reach the SPARQL endpoint.";
      p({ error: Q });
    } finally {
      E(!1);
    }
  }
  function L() {
    navigator.clipboard.writeText(o).then(() => {
      y(!0), setTimeout(() => y(!1), 1500);
    }).catch(() => {
    });
  }
  function V() {
    if (!d?.rows || !d?.columns) return;
    const N = d.columns, Q = N.join(","), J = d.rows.map((nt) => N.map((q) => JSON.stringify(nt[q] ?? "")).join(",")).join(`
`), $ = new Blob([`${Q}
${J}`], { type: "text/csv" }), dt = URL.createObjectURL($), ht = document.createElement("a");
    ht.href = dt, ht.download = "sparql_results.csv", document.body.appendChild(ht), ht.click(), document.body.removeChild(ht), URL.revokeObjectURL(dt);
  }
  return /* @__PURE__ */ S.jsx("div", { className: "ws-page", children: /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }, children: [
    /* @__PURE__ */ S.jsxs("div", { style: { padding: "10px 16px", borderBottom: "1px solid var(--ws-border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "rgba(0,0,0,0.18)" }, children: [
      /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ S.jsx("span", { className: "ws-eyebrow", style: { alignSelf: "center", marginRight: 4 }, children: "Templates:" }),
        Vh.map((N) => /* @__PURE__ */ S.jsx(
          "button",
          {
            className: "ws-btn ws-btn--ghost",
            style: { padding: "4px 10px", fontSize: 11 },
            onClick: () => {
              r(N.query), p(null);
            },
            children: N.label
          },
          N.label
        ))
      ] }),
      /* @__PURE__ */ S.jsxs("button", { className: "ws-btn ws-btn--ghost", style: { padding: "6px 10px" }, onClick: L, title: "Copy query", children: [
        /* @__PURE__ */ S.jsx(Up, { size: 13 }),
        b ? "Copied!" : "Copy"
      ] }),
      /* @__PURE__ */ S.jsx(
        "button",
        {
          className: "ws-btn ws-btn--primary",
          onClick: U,
          disabled: O,
          style: { minWidth: 110, justifyContent: "center" },
          children: O ? /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
            /* @__PURE__ */ S.jsx("span", { className: "ws-spin", style: { display: "inline-block" }, children: /* @__PURE__ */ S.jsx(nr, { size: 13 }) }),
            "Running…"
          ] }) : /* @__PURE__ */ S.jsxs(S.Fragment, { children: [
            /* @__PURE__ */ S.jsx(nr, { size: 13 }),
            "Run Query"
          ] })
        }
      )
    ] }),
    /* @__PURE__ */ S.jsxs("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }, children: [
      /* @__PURE__ */ S.jsxs("div", { style: { flex: "0 0 55%", minHeight: 0, borderBottom: "1px solid var(--ws-border)", position: "relative" }, children: [
        /* @__PURE__ */ S.jsx("div", { style: { position: "absolute", top: 8, right: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 6 }, children: /* @__PURE__ */ S.jsxs("span", { className: "ws-pill ws-pill--mono", children: [
          /* @__PURE__ */ S.jsx(Lp, { size: 9 }),
          "SPARQL"
        ] }) }),
        /* @__PURE__ */ S.jsx(
          o0,
          {
            height: "100%",
            defaultLanguage: "sparql",
            theme: "sparql-dark",
            value: o,
            onChange: (N) => r(N || ""),
            beforeMount: w,
            onMount: _,
            options: {
              minimap: { enabled: !1 },
              fontSize: 13,
              fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
              lineHeight: 22,
              padding: { top: 16 },
              scrollBeyondLastLine: !1,
              renderLineHighlight: "gutter",
              wordWrap: "on"
            }
          }
        )
      ] }),
      /* @__PURE__ */ S.jsxs("div", { style: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(0,0,0,0.12)" }, children: [
        /* @__PURE__ */ S.jsxs("div", { style: { padding: "10px 16px", borderBottom: "1px solid var(--ws-border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }, children: [
          /* @__PURE__ */ S.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 7, color: "var(--ws-text-muted)", fontSize: 13, fontWeight: 700 }, children: [
            /* @__PURE__ */ S.jsx(Uh, { size: 14 }),
            "Results",
            d?.rows && /* @__PURE__ */ S.jsxs("span", { className: "ws-pill ws-pill--accent", children: [
              d.rows.length,
              " rows"
            ] })
          ] }),
          d?.rows && d.rows.length > 0 && /* @__PURE__ */ S.jsxs("button", { className: "ws-btn ws-btn--ghost", style: { marginLeft: "auto", padding: "4px 10px", fontSize: 11 }, onClick: V, children: [
            /* @__PURE__ */ S.jsx(Hp, { size: 12 }),
            "Export CSV"
          ] })
        ] }),
        /* @__PURE__ */ S.jsxs("div", { className: "ws-scroll", style: { flex: 1 }, children: [
          O && /* @__PURE__ */ S.jsx("div", { style: { padding: 24, display: "flex", flexDirection: "column", gap: 8 }, children: [1, 2, 3].map((N) => /* @__PURE__ */ S.jsx("div", { className: "ws-skeleton", style: { height: 36 } }, N)) }),
          d?.error && !O && /* @__PURE__ */ S.jsxs("div", { className: "ws-animate-in", style: { margin: 16, display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--ws-radius-sm)", background: "var(--ws-red-soft)", border: "1px solid rgba(255,123,114,0.28)", color: "#fca5a5", fontSize: 13 }, children: [
            /* @__PURE__ */ S.jsx(or, { size: 16, style: { flexShrink: 0, marginTop: 1 } }),
            d.error
          ] }),
          d?.rows && d?.columns && !O && /* @__PURE__ */ S.jsx("div", { className: "ws-animate-in", style: { overflowX: "auto" }, children: d.rows.length === 0 ? /* @__PURE__ */ S.jsxs("div", { className: "ws-empty", children: [
            /* @__PURE__ */ S.jsx("div", { className: "ws-empty-title", children: "No results" }),
            /* @__PURE__ */ S.jsx("div", { className: "ws-empty-body", children: "The query returned 0 rows. Try a broader query or check your data." })
          ] }) : /* @__PURE__ */ S.jsxs("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12, color: "var(--ws-text)" }, children: [
            /* @__PURE__ */ S.jsx("thead", { children: /* @__PURE__ */ S.jsxs("tr", { style: { borderBottom: "1px solid var(--ws-border)", background: "rgba(0,0,0,0.2)" }, children: [
              /* @__PURE__ */ S.jsx("th", { style: { padding: "8px 14px", textAlign: "left", color: "var(--ws-text-dim)", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", width: 40 }, children: "#" }),
              d.columns.map((N) => /* @__PURE__ */ S.jsxs("th", { style: { padding: "8px 14px", textAlign: "left", color: "var(--ws-text-muted)", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }, children: [
                "?",
                N
              ] }, N))
            ] }) }),
            /* @__PURE__ */ S.jsx("tbody", { children: d.rows.map((N, Q) => /* @__PURE__ */ S.jsxs("tr", { style: { borderBottom: "1px solid rgba(74,163,255,0.06)" }, children: [
              /* @__PURE__ */ S.jsx("td", { style: { padding: "7px 14px", color: "var(--ws-text-dim)", fontFamily: "monospace", fontSize: 11 }, children: Q + 1 }),
              (d.columns ?? []).map((J) => /* @__PURE__ */ S.jsx("td", { style: { padding: "7px 14px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }, title: String(N[J] ?? ""), children: N[J] != null ? String(N[J]).startsWith("urn:") || String(N[J]).startsWith("http") ? /* @__PURE__ */ S.jsx("span", { style: { color: "#7ee787" }, children: String(N[J]) }) : String(N[J]) : /* @__PURE__ */ S.jsx("span", { style: { color: "var(--ws-text-dim)", fontStyle: "italic" }, children: "null" }) }, J))
            ] }, Q)) })
          ] }) }),
          !d && !O && /* @__PURE__ */ S.jsxs("div", { className: "ws-empty", children: [
            /* @__PURE__ */ S.jsx("div", { className: "ws-empty-icon", children: /* @__PURE__ */ S.jsx(Uh, { size: 28 }) }),
            /* @__PURE__ */ S.jsx("div", { className: "ws-empty-title", children: "Run a query" }),
            /* @__PURE__ */ S.jsx("div", { className: "ws-empty-body", children: "Write SPARQL above or pick a template, then click Run Query to see results here." })
          ] })
        ] })
      ] })
    ] })
  ] }) });
}
const h0 = 5e3;
class y0 extends Z.Component {
  settleTimer = null;
  constructor(c) {
    super(c), this.state = { hasError: !1, error: null, retryCount: 0 };
  }
  static getDerivedStateFromError(c) {
    return { hasError: !0, error: c };
  }
  componentDidCatch(c, o) {
    console.error("ErrorBoundary caught an error:", c, o), this.clearSettleTimer();
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
    }, h0);
  };
  render() {
    if (this.state.hasError) {
      const c = this.state.retryCount >= 3;
      return /* @__PURE__ */ S.jsxs(
        "div",
        {
          className: "workspace-loading",
          style: {
            flexDirection: "column",
            gap: 12,
            color: "var(--ws-red)"
          },
          children: [
            /* @__PURE__ */ S.jsx(or, { size: 32, style: { marginBottom: 4, opacity: 0.8 } }),
            /* @__PURE__ */ S.jsx("div", { style: { fontWeight: 500, fontSize: "15px" }, children: "Something went wrong in this view." }),
            /* @__PURE__ */ S.jsx("div", { style: { fontSize: "13px", opacity: 0.7, maxWidth: 450, textAlign: "center", marginBottom: 8, lineHeight: 1.5 }, children: c ? "This view continues to encounter a critical error. Please switch to another workspace or reload the page to restore functionality." : "An unexpected problem occurred while rendering this workspace. Your data is safe, but this view cannot be displayed." }),
            c ? /* @__PURE__ */ S.jsx(
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
            ) : /* @__PURE__ */ S.jsx(
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
function Qe(u, c) {
  return typeof document > "u" ? c : getComputedStyle(document.documentElement).getPropertyValue(u).trim() || c;
}
function m0() {
  Qe("--dsw-alias-bg-base", "#ffffff"), Qe("--dsw-alias-bg-layer-1", "#f6f8fa"), Qe("--dsw-alias-bg-layer-2", "#eef1f4"), Qe("--dsw-alias-label-primary", "#1f2328"), Qe("--dsw-alias-label-secondary", "#3d444d"), Qe("--dsw-alias-brand-primary", "#0969da"), Qe("--dsw-alias-border-l2", "rgba(31,35,40,0.15)"), Qe("--dsw-alias-label-primary-foreground", "") || Qe("--dsw-alias-label-on-primary", "") || Qe("--dsw-alias-label-on-brand", "");
}
const g0 = /^\s*Entity\s*\(/;
function ul(u) {
  return typeof u == "string" && g0.test(u);
}
function p0(u) {
  const c = u.match(/Entity\s*\(\s*text\s*=\s*(['"])((?:\\.|(?!\1).)*)\1/);
  return c ? c[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
}
function ee(u) {
  return typeof u == "string" ? u.trim() : "";
}
function Oi(u) {
  return u.properties && typeof u.properties == "object" ? u.properties : {};
}
function Si(u) {
  const c = Oi(u), o = ee(u.id);
  if (o.startsWith("file:")) {
    const d = o.split(/[/\\]/).pop() || o;
    if (d && !ul(d)) return d;
  }
  if (o.startsWith("session:")) {
    const d = ee(c.content) || ee(u.content);
    if (d) return d.split(`
`)[0].slice(0, 24);
  }
  const r = [c.label, c.name, c.content, u.content, o];
  for (const d of r) {
    const p = ee(d);
    if (!(!p || ul(p)))
      return p;
  }
  for (const d of r) {
    const p = ee(d);
    if (!p || !ul(p)) continue;
    const O = p0(p);
    if (O) return O;
  }
  return o && !ul(o) ? o : "节点";
}
const v0 = /* @__PURE__ */ new Set(["UNKNOWN", "entity", "Entity", "DATE", "PERSON"]);
function Vn(u) {
  const c = ee(u.id);
  if (!c) return !0;
  const o = Oi(u), r = ee(u.content) || ee(o.content);
  if (ul(c) || ul(r)) return !0;
  const d = ee(u.type);
  return !!v0.has(d);
}
function gi(u) {
  const c = Si(u), o = { ...Oi(u) };
  return (!ee(o.label) || ul(o.label)) && (o.label = c), (!ee(o.name) || ul(o.name)) && (o.name = c), (!ee(o.content) || ul(o.content)) && (o.content = c), {
    ...u,
    content: c,
    properties: o
  };
}
function b0(u, c) {
  const o = c.trim().toLowerCase();
  if (!o) return 0;
  const r = Si(u).toLowerCase(), d = ee(u.id).toLowerCase(), p = ee(u.type).toLowerCase(), O = Oi(u), E = [O.name, O.content, O.label].map((w) => ee(w).toLowerCase()).filter(Boolean), b = [r, d, p, ...E];
  let y = 0;
  return r === o || d === o ? y = 1 : r.startsWith(o) || d.startsWith(o) ? y = 0.92 : b.some((w) => w.includes(o)) && (y = 0.78), y <= 0 ? 0 : Math.min(y, 1);
}
function S0(u, c, o = 8) {
  return u.filter((r) => !Vn(r)).map((r) => ({ node: gi(r), score: b0(r, c) })).filter((r) => r.score > 0).sort((r, d) => d.score !== r.score ? d.score - r.score : Si(r.node).localeCompare(Si(d.node), "zh")).slice(0, o);
}
function E0() {
  if (typeof document > "u") return "";
  const u = document.querySelectorAll(".dsos-root");
  for (let o = 0; o < u.length; o++) {
    const r = u[o];
    if (!(r instanceof HTMLElement) || r.offsetParent === null && r.getClientRects().length === 0) continue;
    const d = r.getAttribute("data-cwd") || "";
    if (d) return d;
  }
  const c = document.querySelector(".dsos-root[data-dsos-semantic]");
  return c && c.getAttribute("data-cwd") || "";
}
const T0 = [
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
function A0(u) {
  let c = String(u || "").split("?")[0];
  return (c.startsWith("/semantic-os/api/") || c === "/semantic-os/api") && (c = c.slice(12)), c === "/api" ? "" : c.startsWith("/api/") ? c.slice(5) : null;
}
function ur(u) {
  const c = A0(u);
  return c == null ? !1 : c ? T0.some((o) => c === o || c.startsWith(o + "/")) : !0;
}
function Ps(u) {
  try {
    const c = new URL(u, window.location.origin);
    if (ur(c.pathname) && c.pathname.startsWith("/api/"))
      return c.pathname = "/semantic-os" + c.pathname, c.toString();
  } catch {
  }
  return ur(u.split("?")[0]) && u.startsWith("/api/") ? "/semantic-os" + u : u;
}
function Kh(u) {
  try {
    if (typeof u == "string") return new URL(u, window.location.origin).pathname;
    if (u instanceof URL) return u.pathname;
    if (u instanceof Request) return new URL(u.url, window.location.origin).pathname;
  } catch {
  }
  return "";
}
function Lt(u, c) {
  return new Response(JSON.stringify(c), {
    status: u,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
let Ei = null;
function O0() {
  return Ei ? { ...Ei } : null;
}
function z0() {
  Ei = null;
}
function x0(u, c, o) {
  try {
    const r = JSON.parse(u);
    return c.reasonMode && (r.mode = c.reasonMode()), r.apply_to_graph = !!o, Ei = {
      facts: r.facts,
      rules: r.rules,
      mode: r.mode,
      apply_to_graph: r.apply_to_graph
    }, JSON.stringify(r);
  } catch {
    return u;
  }
}
function M0(u) {
  return u.get("x-dsh-reason-write") === "1";
}
function hy(u) {
  if (!u || typeof u != "object") return !1;
  const c = u;
  if (typeof c.node_count == "number") return c.node_count > 0;
  if (typeof c.nodes == "number") return c.nodes > 0;
  const o = c.nodes ?? c.items;
  return Array.isArray(u) ? u.length > 0 : Array.isArray(o) ? o.length > 0 : !1;
}
async function C0(u, c, o) {
  const r = o.body;
  let d = null;
  if (typeof FormData < "u" && r instanceof FormData) {
    const _ = r.get("file");
    _ instanceof File && (d = _);
  }
  if (!d) return Lt(400, { detail: "只认 json 或 csv。" });
  const p = d.name || "", O = p.toLowerCase().split(".").pop();
  if (O !== "json" && O !== "csv")
    return Lt(400, { detail: "只认 json 或 csv。" });
  const E = await d.text();
  let b = !1;
  try {
    const U = await (await u(`/semantic-os/nodes?cwd=${encodeURIComponent(c)}`, {
      headers: { "x-dsh-cwd": c }
    })).json().catch(() => null);
    b = hy(U);
  } catch {
    b = !1;
  }
  if (b && !window.confirm("图里已有内容。导入会覆盖当前图，确定吗？"))
    return Lt(400, { detail: "已取消导入。" });
  const y = await u("/semantic-os/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dsh-cwd": c },
    body: JSON.stringify({ cwd: c, filename: p, data: E, confirm: !0 })
  });
  if (y.ok) return y;
  const w = await y.json().catch(() => ({}));
  return Lt(y.status || 400, {
    ...w,
    detail: "导入失败，已恢复上一份图。"
  });
}
async function R0(u, c, o) {
  let r = "json";
  try {
    if (typeof o.body == "string") {
      const E = JSON.parse(o.body);
      r = String(E.format || "json").toLowerCase();
    }
  } catch {
  }
  if (r !== "json" && r !== "csv")
    return Lt(400, { detail: "只认 json 或 csv。" });
  const d = window.prompt("绝对路径", "");
  if (d == null) return Lt(400, { detail: "已取消导出。" });
  const p = String(d).trim(), O = async (E) => {
    const b = await u("/semantic-os/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dsh-cwd": c },
      body: JSON.stringify({
        cwd: c,
        format: r,
        dest: p || void 0,
        confirm: E || void 0
      })
    }), y = await b.json().catch(() => ({}));
    if (y && y.error === "OUTSIDE_CWD")
      return window.confirm("导出路径在当前目录外。确定继续？") ? O(!0) : Lt(400, { detail: "已取消导出。" });
    if (y && y.error === "REJECT_FORMAT")
      return Lt(400, { detail: "只认 json 或 csv。" });
    if (!b.ok || y && y.ok === !1)
      return Lt(b.status || 400, { detail: y.detail || "只认 json 或 csv。" });
    if (!p && y.data != null) {
      const w = typeof y.data == "string" ? y.data : JSON.stringify(y.data, null, 2);
      return new Response(w, {
        status: 200,
        headers: {
          "content-type": r === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="graph.${r}"`
        }
      });
    }
    return Lt(200, y);
  };
  return O(!1);
}
async function j0(u, c, o) {
  if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？"))
    return Lt(400, { detail: "已取消合并。" });
  const r = await u(c, o);
  if (r.ok) return r;
  const d = await r.json().catch(() => ({}));
  return Lt(r.status || 400, {
    ...d,
    detail: "合并没写成。"
  });
}
function ir(u) {
  return /\/api\/ontology\/shacl\//.test(u) ? "规则没检查成。" : /\/api\/ontology\/registry/.test(u) ? "词表列表没读成。" : /\/api\/provenance/.test(u) ? "血缘没读成。" : "";
}
function w0(u) {
  return typeof u == "string" && /[\u4e00-\u9fff]/.test(u);
}
async function Jh(u, c) {
  const o = ir(c);
  if (!o || u.ok) return u;
  const r = await u.json().catch(() => ({})), d = r && typeof r == "object" ? r : {}, p = w0(d.detail) ? d.detail : o;
  return Lt(u.status || 400, { ...d, detail: p });
}
function D0(u) {
  if (!u || typeof u != "object") return u;
  const c = u;
  if (Array.isArray(c.nodes)) {
    const o = c.nodes.filter((r) => !Vn(r)).map((r) => gi(r));
    return {
      ...c,
      nodes: o,
      ...typeof c.count == "number" ? { count: o.length } : {},
      ...typeof c.total == "number" ? { total: o.length } : {},
      ...typeof c.node_count == "number" ? { node_count: o.length } : {}
    };
  }
  return Array.isArray(c.results) ? {
    ...c,
    results: c.results.filter((o) => {
      if (!o || typeof o != "object") return !1;
      const d = o.node || o;
      return !Vn(d);
    }).map((o) => {
      if (!o || typeof o != "object") return o;
      const r = o;
      return r.node ? { ...r, node: gi(r.node) } : o;
    })
  } : c.id || c.content || c.properties ? gi(c) : u;
}
async function _0(u, c, o) {
  const r = await u(c, o);
  if (!r.ok) return r;
  const d = await r.json().catch(() => null);
  return Lt(r.status, D0(d));
}
async function N0(u, c, o, r) {
  let d = "", p = 8;
  try {
    if (typeof r.body == "string") {
      const w = JSON.parse(r.body);
      d = String(w.query || w.q || "").trim(), p = Number(w.limit) || 8;
    }
  } catch {
  }
  const E = await (await u("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": c }
  })).json().catch(() => null), y = (E && typeof E == "object" && Array.isArray(E.nodes) ? E.nodes : []).filter((w) => !Vn(w));
  return Lt(200, { results: S0(y, d, p) });
}
async function U0(u, c) {
  const o = await u("/semantic-os/api/temporal/bounds", {
    headers: { "x-dsh-cwd": c }
  });
  if (!o.ok)
    return Lt(200, { min: null, max: null, count: 0, empty: !0 });
  const r = await o.json().catch(() => null);
  return Lt(200, r && typeof r == "object" ? r : { min: null, max: null, count: 0, empty: !0 });
}
async function q0(u, c, o, r) {
  const d = await u(o, r);
  if (!d.ok) return d;
  const p = await d.json().catch(() => null);
  if (!p || typeof p != "object") return Lt(d.status, p);
  const O = p, E = Array.isArray(O.active_node_ids) ? O.active_node_ids.map((L) => String(L)) : [], y = await (await u("/semantic-os/api/graph/nodes?limit=1000", {
    headers: { "x-dsh-cwd": c }
  })).json().catch(() => null), w = y && typeof y == "object" && Array.isArray(y.nodes) ? y.nodes : [], _ = new Set(
    w.filter((L) => Vn(L)).map((L) => String(L.id || "")).filter(Boolean)
  ), U = E.filter((L) => !_.has(L));
  return Lt(d.status, {
    ...O,
    active_node_ids: U,
    active_node_count: U.length
  });
}
const Ua = [];
function H0(u, c = {}) {
  const o = String(u || ""), r = window.fetch.bind(window);
  return Ua.push(r), window.fetch = (d, p) => {
    const O = Kh(d);
    if (!ur(O)) return r(d, p);
    const E = E0() || o;
    let b = d, y = { ...p || {} };
    typeof d == "string" ? b = Ps(d) : d instanceof URL ? b = Ps(d.toString()) : d instanceof Request && (b = new Request(Ps(d.url), d));
    const w = new Headers();try { const __h=y.headers; const __ct=__h&&(__h.get?__h.get("content-type"):(__h["content-type"]||__h["Content-Type"]));if(__ct) w.set("content-type", String(__ct)); } catch {}const _ = !1;
    if (E && _ ? w.set("x-dsh-cwd", E) : w.delete("x-dsh-cwd"), y.headers = w, E && !_) {
      const Q = (J) => /[?&]cwd=/.test(J) ? J : J + (J.includes("?") ? "&" : "?") + "cwd=" + encodeURIComponent(E);
      typeof b == "string" ? b = Q(b) : b instanceof URL ? b.searchParams.get("cwd") || b.searchParams.set("cwd", E) : b instanceof Request && (b = new Request(Q(b.url), b));
    }
    const U = Kh(b), L = String(y.method || (b instanceof Request ? b.method : "GET")).toUpperCase();
    if (L === "POST" && U.endsWith("/api/reason") && typeof y.body == "string") {
      const Q = M0(w);
      return y.body = x0(y.body, c, Q), r(b, y).then(async ($) => {
        const ht = await $.clone().json().catch(() => ({}));
        try {
          if (!$.ok)
            return window.dispatchEvent(new CustomEvent("dsh-reason-failed", { detail: ht })), $;
          window.dispatchEvent(new CustomEvent(Q ? "dsh-reason-applied" : "dsh-reason-previewed", {
            detail: ht
          }));
        } catch {
        }
        return $;
      });
    }
    const V = O.match(/\/api\/decisions\/([^/]+)\/chain$/);
    if (V)
      try {
        window.dispatchEvent(new CustomEvent("dsh-decision-selected", {
          detail: { id: decodeURIComponent(V[1]) }
        }));
      } catch {
      }
    if (c.ioLock && L === "POST" && /\/api\/import\/?$/.test(O))
      return C0(r, E, y);
    if (c.ioLock && L === "POST" && /\/api\/export\/?$/.test(O))
      return R0(r, E, y);
    if (c.mergeConfirm && L === "POST" && /\/api\/enrich\/merge\/?$/.test(O))
      return j0(r, b, y);
    if (L === "GET" && /\/api\/graph\/nodes\/?$/.test(O))
      return _0(r, b, y);
    if (L === "GET" && /\/api\/temporal\/bounds\/?$/.test(O))
      return U0(r, E);
    if (L === "GET" && /\/api\/temporal\/snapshot\/?$/.test(O))
      return q0(r, E, b, y);
    if (L === "POST" && /\/api\/graph\/search\/?$/.test(O))
      return N0(r, E, b, y);
    const N = r(b, y).catch((Q) => {
      const J = ir(O);
      if (J) return Lt(502, { detail: J });
      throw Q;
    });
    return L === "GET" && /\/api\/decisions\/?$/.test(O) ? N.then(async (Q) => Q.status !== 422 ? Jh(Q, O) : new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" }
    })) : ir(O) ? N.then((Q) => Jh(Q, O)) : N;
  }, () => {
    const d = Ua.lastIndexOf(r);
    d >= 0 && Ua.splice(d, 1), window.fetch = Ua.length ? Ua[Ua.length - 1] : r;
  };
}
const Hn = {
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
function B0(u) {
  let c = u;
  return c = c.replace(/(\d[\d,]*)\s+nodes\s+[·•]\s+(\d[\d,]*)\s+edges/ig, "$1 个点 · $2 条边"), c = c.replace(/\b(\d[\d,]*)\s+shapes\b/ig, "$1 条规则"), c = c.replace(/\b(\d[\d,]*)\s+constraints\b/ig, "$1 条约束"), c = c.replace(/(\d[\d,]*)\s+direct neighbors highlighted/ig, "$1 个直接邻居已标出"), c = c.replace(/(\d[\d,]*)\s+direct neighbors in the full graph/ig, "全图里有 $1 个直接邻居"), c = c.replace(/(\d[\d,]*)\s+source fields/ig, "$1 个出处字段"), c = c.replace(/(\d[\d,]*)\s+candidate links/ig, "$1 条可能的连线"), c = c.replace(/\b(\d[\d,]*)\s+hops\b/ig, "$1 跳"), c === u ? null : c;
}
function kh(u) {
  return u.replace(/\s+/g, " ").trim();
}
function L0(u) {
  return u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Fh(u) {
  const c = u.trim();
  if (!c) return u;
  const o = B0(c);
  if (o) return u.replace(c, o);
  if (Hn[c]) return u.replace(c, Hn[c]);
  const r = kh(c);
  if (Hn[r]) return u.replace(c, Hn[r]);
  let d = r;
  const p = Object.entries(Hn).sort((O, E) => E[0].length - O[0].length);
  for (const [O, E] of p) {
    const b = kh(O);
    if (!(!b.includes(" ") && /^[A-Za-z]/.test(b) && b.length < 16) && !(b.length < 6)) {
      if (/^[A-Za-z]/.test(b)) {
        const y = new RegExp(`(?<![A-Za-z])${L0(b)}(?![A-Za-z])`, "g");
        d = d.replace(y, E);
        continue;
      }
      d.includes(b) && (d = d.split(b).join(E));
    }
  }
  return d === r ? u : u.replace(c, d);
}
function Wh(u) {
  for (; u; ) {
    const c = u.tagName;
    if (c === "TEXTAREA" || c === "PRE" || c === "CODE" || c === "SCRIPT" || c === "STYLE") return !0;
    const o = typeof u.className == "string" ? u.className : "";
    if (o.includes("monaco-editor") || o.includes("view-lines") || o.includes("mtk")) return !0;
    u = u.parentElement;
  }
  return !1;
}
function Qn(u) {
  if (u.nodeType === Node.TEXT_NODE) {
    if (Wh(u.parentElement)) return;
    const o = Fh(u.nodeValue || "");
    o !== u.nodeValue && (u.nodeValue = o);
    return;
  }
  if (u.nodeType !== Node.ELEMENT_NODE) return;
  const c = u;
  if (!Wh(c)) {
    for (const o of ["placeholder", "title", "aria-label"]) {
      const r = c.getAttribute(o);
      if (!r) continue;
      const d = Fh(r);
      d !== r && c.setAttribute(o, d);
    }
    c.childNodes.forEach(Qn);
  }
}
function Q0(u) {
  Qn(u);
  const c = new MutationObserver((o) => {
    for (const r of o)
      r.addedNodes.forEach(Qn), r.type === "characterData" && r.target && Qn(r.target), r.type === "attributes" && r.target && Qn(r.target);
  });
  return c.observe(u, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["placeholder", "title", "aria-label"] }), () => c.disconnect();
}
function Y0({ actions: u }) {
  return u?.length ? /* @__PURE__ */ S.jsx(S.Fragment, { children: u.map((c) => /* @__PURE__ */ S.jsx("button", { type: "button", className: "dsh-mode-btn", onClick: c.onClick, children: c.label }, c.id)) }) : null;
}
function G0() {
  return new Ep({
    defaultOptions: {
      queries: { refetchOnWindowFocus: !1, retry: 1 }
    }
  });
}
const qa = uy({
  phase: "idle",
  busy: !1,
  fail: ""
});
let Bn = null;
function X0(u) {
  const c = u.mode === "datalog" ? "按规则从已知推未知" : u.mode === "rete" ? "模式匹配走引擎现成网络" : "往前推走规则链式推导", o = (u.phase === "written" ? "已写入图" : "预览，不写图") + " · " + c;
  return /* @__PURE__ */ S.jsxs("div", { className: "dsh-lock-bar", children: [
    /* @__PURE__ */ S.jsx(Y0, { actions: u.hostActions }),
    /* @__PURE__ */ S.jsx(
      "button",
      {
        type: "button",
        className: "dsh-mode-btn" + (u.mode === "forward" ? " is-on" : ""),
        onClick: () => u.setMode("forward"),
        children: "往前推"
      }
    ),
    /* @__PURE__ */ S.jsx(
      "button",
      {
        type: "button",
        className: "dsh-mode-btn" + (u.mode === "rete" ? " is-on" : ""),
        onClick: () => u.setMode("rete"),
        children: "模式匹配"
      }
    ),
    /* @__PURE__ */ S.jsx(
      "button",
      {
        type: "button",
        className: "dsh-mode-btn" + (u.mode === "datalog" ? " is-on" : ""),
        title: "按规则从已知推未知",
        onClick: () => u.setMode("datalog"),
        children: "逻辑规则"
      }
    ),
    /* @__PURE__ */ S.jsx("span", { className: "dsh-lock-hint", children: o }),
    u.phase === "preview" ? /* @__PURE__ */ S.jsx("button", { type: "button", className: "dsh-mode-btn is-on", onClick: u.onWrite, disabled: u.busy, children: "确认写入" }) : null,
    /* @__PURE__ */ S.jsx(
      "button",
      {
        type: "button",
        className: "dsh-mode-btn",
        onClick: u.onRedo,
        disabled: u.busy || u.phase === "idle",
        title: u.phase === "idle" ? "先跑一次推理预览" : "预览不写图，可打回重做",
        children: "打回重做"
      }
    ),
    u.fail ? /* @__PURE__ */ S.jsx("span", { className: "dsh-fail", children: u.fail }) : null
  ] });
}
function Z0() {
  const [u, c] = Z.useState(!1);
  return /* @__PURE__ */ S.jsxs("div", { className: "dsh-sparql-fold", children: [
    /* @__PURE__ */ S.jsx("button", { type: "button", className: "dsh-fold-btn", onClick: () => c((o) => !o), children: u ? "收起图查询" : "图查询已折上" }),
    u ? /* @__PURE__ */ S.jsx("div", { className: "dsh-sparql-body", children: /* @__PURE__ */ S.jsx(y0, { children: /* @__PURE__ */ S.jsx(d0, {}) }) }) : null
  ] });
}
function V0(u) {
  const [c, o] = Z.useState("forward"), r = Z.useSyncExternalStore(qa.subscribe, qa.get, qa.get), d = r.phase, p = r.busy, O = r.fail, E = (U) => qa.set({ phase: U }), b = (U) => qa.set({ busy: U }), y = (U) => qa.set({ fail: U });
  u.modeRef.current = c, Z.useEffect(() => {
    const U = () => {
      E("preview"), y("");
    }, L = () => {
      E("written"), y("");
    }, V = (N) => {
      const Q = N.detail || {}, J = String(Q.engine || ""), $ = Q.detail ? String(Q.detail) : "";
      y(J === "datalog" ? $ ? `逻辑规则没跑成。${$}` : "逻辑规则没跑成。" : J === "rete" ? $ ? `模式匹配没跑成。${$}` : "模式匹配没跑成。" : $ ? `推理没跑成。${$}` : "推理没跑成。");
    };
    return window.addEventListener("dsh-reason-previewed", U), window.addEventListener("dsh-reason-applied", L), window.addEventListener("dsh-reason-failed", V), () => {
      window.removeEventListener("dsh-reason-previewed", U), window.removeEventListener("dsh-reason-applied", L), window.removeEventListener("dsh-reason-failed", V);
    };
  }, []);
  const w = () => {
    z0(), window.dispatchEvent(new Event("dsh-reason-redo")), E("idle"), y("");
  }, _ = async () => {
    if (Bn) return Bn;
    const U = O0();
    if (!U) {
      y("还没有可写入的预览。");
      return;
    }
    return b(!0), y(""), Bn = (async () => {
      try {
        let L = !1;
        try {
          const Q = await fetch(`/semantic-os/nodes?cwd=${encodeURIComponent(u.cwd)}`);
          L = hy(await Q.json().catch(() => null));
        } catch {
          L = !1;
        }
        if (L && !window.confirm("图里已有内容。写入推断会加成边，确定吗？")) {
          b(!1);
          return;
        }
        const V = await fetch("/semantic-os/api/reason", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-dsh-reason-write": "1",
            "x-dsh-cwd": u.cwd
          },
          body: JSON.stringify({
            ...U,
            mode: u.modeRef.current,
            apply_to_graph: !0
          })
        }), N = await V.json().catch(() => ({}));
        if (!V.ok) throw new Error(N.detail || "写入没写成。");
      } catch (L) {
        y(L instanceof Error ? L.message : "写入没写成。");
      } finally {
        b(!1), Bn = null;
      }
    })(), Bn;
  };
  return /* @__PURE__ */ S.jsxs("div", { className: "dsh-analyze-frame", children: [
    /* @__PURE__ */ S.jsx(
      X0,
      {
        mode: c,
        setMode: o,
        phase: d,
        busy: p,
        fail: O,
        onWrite: () => {
          _();
        },
        onRedo: w,
        hostActions: u.hostActions
      }
    ),
    /* @__PURE__ */ S.jsx("div", { className: "dsh-analyze-bench", children: /* @__PURE__ */ S.jsx(Pp, { mode: c }) }),
    /* @__PURE__ */ S.jsx(Z0, {})
  ] });
}
function K0(u, c = {}) {
  const o = String(c.cwd || ""), r = { current: "forward" };
  u.classList.add("dsh-analyze-host", "dsh-ws-host"), m0();
  const d = G0(), p = H0(o, {
    reasonMode: () => r.current
  }), O = Q0(u), E = Jg.createRoot(u);
  return E.render(
    /* @__PURE__ */ S.jsx(Ap, { client: d, children: /* @__PURE__ */ S.jsx(V0, { cwd: o, modeRef: r, hostActions: c.hostActions }) })
  ), () => {
    O(), p(), E.unmount(), d.clear();
  };
}
const J0 = { mount: K0 };
export {
  J0 as default,
  K0 as mount
};
