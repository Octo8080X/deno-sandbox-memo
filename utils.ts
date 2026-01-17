import { createDefine } from "fresh";

export interface State {
  server_app_public_url: string;
  server_app_pass_phrase: string;
}

export const define = createDefine<State>();
