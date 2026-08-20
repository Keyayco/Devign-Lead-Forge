# Vercel Runtime Findings

Source: https://vercel.com/docs/functions/runtimes/node-js

Vercel documents that JavaScript and TypeScript files under `/api` are automatically deployed as Node.js Functions. A default Node.js Function does not need a custom `runtime` property in `vercel.json`. The project’s `api/[...path].ts` is a TypeScript Node handler, so the explicit `nodejs22.x` value is unnecessary for the API Function configuration.

Source: https://vercel.com/docs/functions/configuring-functions/runtime

Vercel documents the `functions` property for custom/community runtimes and shows values such as `vercel-php@0.5.2`. The deployment error occurred because `nodejs22.x` was supplied where Vercel expected a versioned runtime package string. The repair should remove the explicit runtime property and retain only supported options such as `maxDuration`, allowing Vercel’s built-in Node.js runtime selection to apply.
