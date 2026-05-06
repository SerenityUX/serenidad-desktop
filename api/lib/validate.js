// Boundary validation for Express routes.
//
// Each schema describes the shape of a request component (body, params,
// query). Failures are converted to a uniform 400 with a useful path so the
// client / agent gets actionable errors instead of a 500 from a downstream
// crash.
//
// Usage:
//   const z = require('zod');
//   const { validate } = require('../lib/validate');
//   router.post('/foo',
//     validate({ body: z.object({ name: z.string().min(1) }) }),
//     handler);
//
// Once validate() runs, `req.validated.body` (etc.) holds the parsed,
// type-coerced values. Use those in handlers — they're trusted.

const { ZodError } = require("zod");

function formatZodError(err) {
  return err.issues.map((i) => {
    const path = i.path.length ? i.path.join(".") : "(root)";
    return { path, message: i.message, code: i.code };
  });
}

/**
 * Build a middleware that parses any of req.body / req.params / req.query
 * against zod schemas. Successful parse populates `req.validated.{body,
 * params, query}`. Use `req.validated.<part>` inside the handler — never
 * touch `req.body` directly after this middleware, or you'll defeat the
 * trusted-input invariant.
 *
 * @param {{ body?: import('zod').ZodTypeAny,
 *           params?: import('zod').ZodTypeAny,
 *           query?: import('zod').ZodTypeAny }} schemas
 */
function validate(schemas) {
  return (req, res, next) => {
    req.validated = req.validated || {};
    try {
      if (schemas.body) req.validated.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.validated.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) req.validated.query = schemas.query.parse(req.query ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid request",
          issues: formatZodError(err),
        });
      }
      next(err);
    }
  };
}

module.exports = { validate, formatZodError };
