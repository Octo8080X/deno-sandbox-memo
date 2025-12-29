# Deno Sand box Memo by git

A memo application that uses Deno Sandbox to run git commands securely.

## Environment

Create a `.env` at the project root before setup. Minimum required values:

```
SANDBOX_GIT_BASE=<absolute path to the working repo dir>
```

## Setup

Install dependencies and prepare the sandbox:

```bash
deno task setup
```

## Run

Start the app:

```bash
deno task dev
```

## What this app is

This app manages memos by running git inside Deno Sandbox. Each memo is stored and versioned via git commands executed within the sandboxed environment, providing history, diffs, and restore operations while keeping execution isolated.

## 📄 License

MIT

---

Built with ❤️ using Deno.

<a href="https://fresh.deno.dev">
  <img
    width="197"
    height="37"
    src="https://fresh.deno.dev/fresh-badge.svg"
    alt="Made with Fresh"
  />
</a>