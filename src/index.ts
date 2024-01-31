import sade from "sade";

import { name, version } from "../package.json";
import {
  connectResource,
  deleteResource,
  disconnectResource,
  init,
  listResource,
  makeResource
} from "./utils/methods";

const cli = sade(name);
cli.version(version);

cli
  .command("init")
  .describe("Initialize Furret.")
  .action(async (opts) => {
    init();
  });

cli
  .command("make <resource>")
  .describe("Create a new remote resource.")
  .action(async (resource, opts) => {
    makeResource(resource);
  });

cli
  .command("list [resource]")
  .describe("List remote resources.")
  .action(async (resource, opts) => {
    listResource(resource);
  });

cli
  .command("delete <resource> <id>")
  .describe("Delete a remote resource.")
  .action(async (resource, id, opts) => {
    deleteResource(resource, id);
  });

cli
  .command("connect <resource> <id>")
  .describe("Connect to a remote resource.")
  .action(async (resource, id, opts) => {
    connectResource(resource, id);
  });

cli
  .command("disconnect <resource> <id>")
  .describe("Disconnect from a remote resource.")
  .action(async (resource, id, opts) => {
    disconnectResource(resource, id);
  });

export default cli;
