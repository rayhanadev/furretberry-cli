# Furret

A CLI tool for provisioning and accessing remote resources on my home server. It uses Cloudflare Tunnels and Zero Trust to securely communicate with a Kubernetes cluster and expose remote resources to the Internet.

<img width="889" alt="image" src="https://github.com/rayhanadev/furretberry-cli/assets/72509475/f4e6df8a-6bc3-4082-94ae-04117ba2ebb2">

## Usage

```bash
Usage
  $ furret <command> [options]

Available Commands
  init          Initialize Furret.
  make          Create a new remote resource.
  list          List remote resources.
  delete        Delete a remote resource.
  connect       Connect to a remote resource.
  disconnect    Disconnect from a remote resource.

For more info, run any command with the `--help` flag
  $ furret init --help
  $ furret make --help

Options
  -v, --version    Displays current version
  -h, --help       Displays this message
```

This project was created using `bun init` in bun v1.0.25. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
