# Next Prompt

A bb plugin that suggests your next message after each agent turn.

When a thread goes idle, the plugin sends your last few messages, the thread
title and the agent's reply to your OpenCode Go subscription and asks it to
write a few different messages you might type next, most likely first. Each
appears as a chip above the composer. Click one to put its text in the
composer, or click × to dismiss them all. When the work looks finished, the
model answers `NONE` and no chips appear.

## Install

Sign in to OpenCode Go on the bb server machine first (`opencode auth login`).

```sh
bb plugin install 'git:https://github.com/scowalt/bb-plugin-next-prompt.git@^0.1.0'
bb plugin update next-prompt   # later releases in the same range
```

## Settings

- **Suggest next prompts** — on by default.
- **Model** — an OpenCode Go model id; default `glm-5.3-flash`.
- **Suggestions** — how many options to ask for, 1 to 5; default 3. The model
  may offer fewer when there are fewer sensible next steps.

## What it sends where

The thread title, your last three messages (up to 800 characters each) and the
end of the agent's reply (up to 6000 characters) go to
`https://opencode.ai/inference/go/openai/v1/chat/completions`. The plugin reads
the key `opencode auth login` stores in
`$XDG_DATA_HOME/opencode/auth.json`, falling back to `OPENCODE_GO_API_KEY`.

Suggestions live in server memory and clear on restart. They show in existing
threads only, not on the new-thread screen.

## Develop

```sh
npm install --include=dev
npm run check             # typecheck, test, build
npm run check:git-install # build the way `bb plugin install git:` does
```

## Release

```sh
npm version patch   # or minor / major
git push --follow-tags
```

A `vX.Y.Z` tag runs the Release workflow, which checks that the tag matches
`package.json`, runs the same checks as CI and publishes a GitHub release.
bb installs releases from these tags and never accepts a moved tag, so publish
fixes as new versions.
