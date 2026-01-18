import { App, Context, cors, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";
import { ensureServerAppReady } from "./libs/connectSandboxGit.ts";

export const app = new App<State>();

app.use(staticFiles());
app.use(csrf(
  { origin: Deno.env.get("APP_ORIGIN")! },
));
app.use(cors(
  {
    origin: Deno.env.get("APP_ORIGIN")!,
    allowMethods: [
      "POST",
      "GET",
      "PUT",
    ],
    credentials: Deno.env.get("APP_ENV") === "prod" ? false : true,
  },
));

app.use(async (ctx: Context<State>) => {
  console.log("Middleware: ensureServerAppReady");
  const {publicUrl, passPhrase} = await ensureServerAppReady()
  ctx.state.server_app_public_url = publicUrl;
  ctx.state.server_app_pass_phrase = passPhrase;

  return ctx.next();
});

app.fsRoutes();
