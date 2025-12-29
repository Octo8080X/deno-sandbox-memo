import { App, cors, csrf, staticFiles } from "fresh";
import { type State } from "./utils.ts";

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
    credentials: Deno.env.get("APP_ENV") === "production" ? false : true,
  },
));

// Include file-system based routes here
app.fsRoutes();
