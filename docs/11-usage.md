# Usage

This document describes how to use and interact with the frickeldave.de project once it's set up.

- [Usage](#usage)
  - [🧞 Commands (by Astro)](#-commands-by-astro)
  - [🚀 Automated Deployment](#-automated-deployment)
  - [🧾 See Also](#-see-also)

## 🧞 Commands (by Astro)

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run deploy:dev`      | Deploy changes to the development environment    |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

For more details on how the automated deployment works, see
[FR006: Automated Dev Deployment](./features/fr006-autodeploy.md).

## 🚀 Automated Deployment

The `npm run deploy:dev` command initiates an automated workflow to deploy your changes to the `dev`
branch.

> **Important:** When passing arguments to the command, you MUST use a double dash `--` before the
> arguments so that `npm` passes them correctly to the script.

**Example with all parameters:**

```bash
npm run deploy:dev -- --issue-id <id> --auto-cleanup --skip-devserver
```

For more details, consult the [feature documentation](./features/fr006-autodeploy.md).

## 🧾 See Also

[Astro Documentation](https://docs.astro.build) - The official documentation for Astro. If there's
an Astro topic you're confused about, you can probably find a consise and clear explanation here.

The
[customization guideline from astrogon](https://github.com/astrogon/astrogon/blob/main/docs/customization.md)
describes how to customize the theme.

See [Teckstack](https://github.com/astrogon/astrogon/blob/main/docs/tech-stack.md) for more details.
