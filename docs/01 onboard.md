# Contribute

Feel free to contribute with you own pull request to the frickeldave website. This contribution guide describe how to do that. 

- [Contribute](#contribute)
  - [Installation guide](#installation-guide)
    - [Prepare WSL (optional)](#prepare-wsl-optional)
    - [Install all prerequsites for linux with administrative previleges](#install-all-prerequsites-for-linux-with-administrative-previleges)
    - [Install all prerequsites for windows](#install-all-prerequsites-for-windows)
  - [Configure astro](#configure-astro)
    - [Clone repo (works on powershell and bash)](#clone-repo-works-on-powershell-and-bash)
    - [Install node prerequisites](#install-node-prerequisites)
  - [🧞 Commands (by Astro)](#-commands-by-astro)
  - [Internal additional information](#internal-additional-information)
  - [🧾 See Also](#-see-also)


## Installation guide

This chapter explains, how to configure your system to to contributions to the frickeldave.de website.

### Prepare WSL (optional)

If you use a windows client but you feel more comfortable with linux, you can use use a WSL with debian or linux to setup the development environment.

```powershell
wsl --install debian --name frickeldave
...
...
wsl -d frickeldave
```

### Install all prerequsites for linux with administrative previleges

To configure a linux environment follow this steps. If you want to work directly on windows you can skip this chapter.

```bash
# Install git, when not exist
sudo apt install git -y
# Install curl, when not exist
sudo apt install curl -y
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# OPTIONAL: In some environments the profile is not executed (eg. code-server). 
# In this case, add nvm to bashrc manual: 
echo "" >> ~/.bashrc
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
source ~/.bashrc
# Install node
nvm install --lts

#It is not needed for development, but it simplify the work to install GitHub (gh) CLI on the system. It is also used in some of the prompt files. 

# Get the actual gh client version
export GH_CLI_VERSION=$(curl -s https://api.github.com/repos/cli/cli/releases/latest | grep "tag_name" | cut -d : -f 2,3 | tr -d \"\ v,)

# Download gh cli
curl -Lo /tmp/gh_linux_amd64.tar.gz https://github.com/cli/cli/releases/download/v${GH_CLI_VERSION}/gh_${GH_CLI_VERSION}_linux_amd64.tar.gz

# Extract cli and move to final directory
tar -xf /tmp/gh_linux_amd64.tar.gz -C /tmp
mkdir -p ~/.local/bin
mv /tmp/gh_${GH_CLI_VERSION}_linux_amd64/bin/gh ~/.local/bin/

# Add to bashrc and make available
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

```

### Install all prerequsites for windows

If you want to work directly on windows, you can follow this guide.

```powershell
winget install Git.Git
```

```powershell
winget install OpenJS.NodeJS.LTS
Set-ExecutionPolicy -Scope CurrentUser Bypass
```

#TODO: Describe installation of GH CLI

## Configure astro

When all prerequisites are done, you can follow this steps.

### Clone repo (works on powershell and bash)

These commands are working on windows as well as linux.
```shell
cd ~
mkdir dev
cd dev
git clone https://github.com/Frickeldave/frickeldave.github.io.git
cd frickeldave.github.io
git config user.name "<YOURNAME>"
git config user.email "<YOURMAILADDRESS>"

```
### Install node prerequisites

To get all node prerequisites, run the following command.

```shell
npm install
```

## 🧞 Commands (by Astro)

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |


## Internal additional information

- Das branching Konzept ist [hier](./branching.md) zu finden.
- Dieses Projekt verwendet Husky, um Git-Hooks (z. B. `pre-commit`) aus dem Verzeichnis `.husky/` zu verwalten (siehe [husky](./linter/husky.md)).
- Es sind diverse Linter aktiv, die Konfiguration der Linter ist [hier](./linter/linter.md) beschrieben.
- Zu verwendene Kategorien findest du [hier](./categories.md)
- Tags sind [hier](./tags.md) dokumentiert

Folgende eigene Erweiterungen wurden hier integriert: 

- [Link redirector](./features/redirects.md)
- YouTube privacy component
- Donwload page


## 🧾 See Also

[Astro Documentation](https://docs.astro.build) - The official documentation for Astro. If there's an Astro topic you're confused about, you can probably find a consise and clear explanation here.

The [customization guideline from astrogon](https://github.com/astrogon/astrogon/blob/main/docs/customization.md) describes how to customize the theme. 

See [Teckstack](https://github.com/astrogon/astrogon/blob/main/docs/tech-stack.md) for more details.

