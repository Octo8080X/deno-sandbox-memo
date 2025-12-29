import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>deno-sandbox-memo</title>
      </head>
      <body class="bg-base-200 text-base-content">
        <header class="sticky top-0 z-10 border-b border-base-200 bg-base-100/90 backdrop-blur">
          <div class="navbar max-w-5xl mx-auto px-4">
            <div class="flex-1">
              <a class="btn btn-ghost normal-case text-xl font-bold" href="/">
                Deno Sandbox Memo by git
              </a>
            </div>
            <nav class="flex gap-2">
              <a class="btn btn-ghost" href="/">All notes</a>
              <a class="btn btn-primary" href="/new">New note</a>
            </nav>
          </div>
        </header>
        <Component />
      </body>
    </html>
  );
});
