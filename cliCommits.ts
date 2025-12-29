import { getStorageApi } from "./lib/sandoboxGit.ts";

const st = await getStorageApi();
console.log(await st.getFiles());
console.log(await st.getStatus());
const commits = await st.getCommits("66678b73-6f44-47ce-bf20-4b7ea143fcff.md");
