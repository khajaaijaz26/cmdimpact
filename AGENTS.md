## Development

Run the complete terminal in its supported local container:

```
npm run setup
docker compose up --build -d
```

Use `docker compose logs -f` to inspect service logs and `docker compose down` to stop it. `npm run dev:ui` is only for isolated landing-page work; it does not provide a terminal backend.

Never expose a host shell, Docker socket, broad host mount, or privileged container. Keep terminal input and output out of logs and test fixtures.

Preserve the container boundary: the gateway is UID 0 with only `KILL`, `SETUID`, and `SETGID`; state is root-only, and the access token must never enter the PTY environment. PTYs must use the fixed `setpriv` path to UID/GID 10002 with cleared supplementary groups, `no-new-privileges`, and empty inheritable/ambient capabilities. Do not describe the whole terminal service as non-root or as having every capability dropped, and verify PTY effective/permitted capabilities after image changes.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
