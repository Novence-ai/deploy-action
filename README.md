# Deploy to Novence

Deploy a static site to [Novence](https://novence.ai) on every push. The job signs in
with GitHub OIDC, so there is **no API key to store as a secret**.

Novence hosts static files. It does not clone or build your repository: build the site
in your workflow, then this action uploads the output folder and publishes it.

## Set up

1. Connect the repository to a project (once, from your machine or your AI agent):

   ```bash
   npx novence git connect owner/repo --branch main --dir ./dist --write
   ```

   That links the repo to your project and writes `.github/workflows/novence.yml`.
   Agents can do the same with the `connect_github_repo` MCP tool.

2. Commit and push the workflow. Every push to that branch now deploys.

## Workflow

```yaml
name: Deploy to Novence
on:
  push:
    branches: ["main"]
  workflow_dispatch:
permissions:
  id-token: write # lets the job prove which repo it is; no API key secret needed
  contents: read
concurrency:
  group: novence-deploy
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Build your site here if it needs a build step, e.g.:
      # - run: npm ci && npm run build
      - uses: Novence-ai/deploy-action@v1
        with:
          dir: ./dist
```

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `dir` | auto-detect | Folder to deploy. Auto-detects `dist`, `build`, `out`, `public`, `_site`. |
| `project` | | Project id. Needed only when the repo is connected to more than one project. |
| `api-key` | | Deploy with an API key instead of OIDC. Leave empty for a connected repo. |
| `keep-extra` | `false` | Keep files the folder no longer has. By default the site matches the folder. |
| `timeout` | `15` | Minutes to wait for quality checks and go-live. |
| `cli-version` | `0.6` | Version of the `novence` CLI to run. |

## Outputs

| Output | |
| --- | --- |
| `url` | Live URL. |
| `preview-url` | Per-deploy preview URL (Pro and Scale). |
| `deployment-id` | Deployment id. |
| `status` | `live`, `failed`, or the in-progress status if the wait ran out. |

## How sign-in works

`permissions: id-token: write` lets the job ask GitHub for a signed token that names the
repository, branch and commit. Novence checks GitHub's signature, confirms the repository
is the one you connected and the run is on the connected branch, and returns a key that:

- lasts 30 minutes,
- can only upload files to and deploy that one project,
- cannot change domains, billing, members, keys, or delete anything but site files.

Pull request runs and other branches are refused, so a fork cannot deploy your site.

## Good to know

- **Every push to the branch deploys, and each deploy counts toward your plan.** Free
  has 20 a month; Pro has 2,000.
- **The site matches the folder.** Files you delete from the build output are removed
  from the site. Files under `/data/*.json` written with Novence's live-data API are kept.
- **Two pushes close together** both ship: the second waits for the first, and the
  newest commit is what ends up live.
- **Quality checks** (Lighthouse, accessibility, links) run on verified accounts. A
  failed check fails the job and leaves the live site unchanged.
- To stop deploying from the repo: `npx novence git disconnect`, then delete the workflow.

## Without connecting the repository

Store a key as a secret and pass it in:

```yaml
      - uses: Novence-ai/deploy-action@v1
        with:
          dir: ./dist
          api-key: ${{ secrets.NOVENCE_API_KEY }}
```

Create one with `npx novence keys create ci --print`.

[Docs](https://novence.ai/integrations/github-actions) · [CLI](https://novence.ai/cli) · [Support](https://novence.ai/support)
