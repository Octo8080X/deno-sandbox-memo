import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>deno-sandbox-memo</title>
      </head>
      <body>
        <header class="site-header">
          <div class="site-header__inner">
            <a class="brand" href="/">
              Deno Sandbox Memo by git
            </a>
            <nav class="site-nav">
              <a href="/">All notes</a>
              <a class="pill" href="/new">New note</a>
            </nav>
          </div>
        </header>
        <Component />
      </body>
    </html>
  );
});
