import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";
if (!arcjetKey) throw new Error("ARCJET_KEY enviroment variable is missing.");
export const httpArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,

      rules: [
        shield({ mode: arcjetMode }),
        // detectBot({
        //   mode: arcjetMode,
        //   allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        // }),
        slidingWindow({ mode: arcjetMode, interval: "10s", max: 50 }),
      ],
    })
  : null;
export const wsArcjet = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW"],
        }),
        slidingWindow({ mode: arcjetMode, interval: "2s", max: 5 }),
      ],
    })
  : null;

// export function securityMiddleware() {
//   return async (req, res, next) => {
//     if (!httpArcjet) return next();
//     try {
//       const decision = await httpArcjet.protect(req);
//       if (decision.isDenied()) {
//         if (decision.reason.isRateLimit()) {
//           return res.status(429).json({ error: "Too many requests." });
//         }
//         return res.status(403).json({ error: "Forbidden" });
//       }
//     } catch (e) {
//       console.error("Arcjet middleware error", e);
//       return res.status(503).json({ error: "service unavailable" });
//     }
//     next();
//   };
// }

export function securityMiddleware() {
  return async (req, res, next) => {
    try {
      const decision = await httpArcjet.protect(req);

      if (decision.isDenied()) {
        console.log("ARCJET DENY:", {
          ip: req.ip,
          ua: req.headers["user-agent"],
          reason: decision.reason?.toString?.() ?? decision.reason,
          isRateLimit: decision.reason?.isRateLimit?.() ?? false,
          isBot: decision.reason?.isBot?.() ?? false,
        });

        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too many requests." });
        }
        return res.status(403).json({ error: "Forbidden" });
      }

      next();
    } catch (e) {
      console.error("Arcjet middleware error", e);
      return res.status(503).json({ error: "Service unavailable" });
    }
  };
}
