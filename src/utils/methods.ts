import { spawn } from "node:child_process";
import { kill } from "node:process";

import { input, password, confirm } from "@inquirer/prompts";
import Conf from "conf";
import * as z from "zod";

import { env } from "~/env";

import { name, version } from "../../package.json";

import {
  createCloudflareDNSRecord,
  createCloudflareTunnel,
  listCloudflareTunnels,
  deleteCloudflareTunnel,
  deleteCloudflareDNSRecord,
  getCloudflareTunnel,
} from "./cf";
import { getPort, isPortOpen } from "./ports";
import {
  deprovisionPostgresDatabase,
  provisionPostgresDatabase,
} from "./kube";

const config = new Conf({
  projectName: name,
  projectVersion: version,
});

export const resourceSchema = z.enum(["pg", "redis"]);
export type Resources = z.infer<typeof resourceSchema>;

function hasInit() {
  const env = config.get("env") as Record<string, string> | undefined;
  return env && Object.values(env).length > 0;
}

export async function init() {
  if (hasInit()) {
    const confirmation = await confirm({
      message: "You have already initialized Furret. Are you sure you want to continue?",
      default: false,
    });

    if (!confirmation) {
      return;
    }
  }

  const CLOUDFLARE_ACCESS_CLIENT_ID = await input({
    message: "Cloudflare Access Client ID:",
  });

  const CLOUDFLARE_ACCESS_CLIENT_SECRET = await password({
    message: "Cloudflare Access Client ID:",
  });

  const CLOUDFLARE_ACCOUNT_ID = await input({
    message: "Cloudflare Account ID:",
  });

  const CLOUDFLARE_ZONE_ID = await input({
    message: "Cloudflare Zone ID:",
  });

  const CLOUDFLARE_ZONE_NAME = await input({
    message: "Cloudflare Zone Name:",
  });

  const CLOUDFLARE_TUNNEL_ID = await input({
    message: "Cloudflare Tunnel ID:",
  });

  const CLOUDFLARE_API_TOKEN = await password({
    message: "Cloudflare API Token:",
  });

  const KUBE_SERVICE_ACCOUNT_KEY = await input({
    message: "Kubernetes Service Account Key:",
  });

  const KUBE_CLUSTER_NAME = await input({
    message: "Kubernetes Cluster Name:",
  });

  const KUBE_CLUSTER_SERVER = await input({
    message: "Kubernetes Cluster Server:",
  });

  const KUBE_CLUSTER_USER = await input({
    message: "Kubernetes Cluster User:",
  });

  const env = {
    CLOUDFLARE_ACCESS_CLIENT_ID,
    CLOUDFLARE_ACCESS_CLIENT_SECRET,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ZONE_ID,
    CLOUDFLARE_ZONE_NAME,
    CLOUDFLARE_TUNNEL_ID,
    CLOUDFLARE_API_TOKEN,
    KUBE_SERVICE_ACCOUNT_KEY,
    KUBE_CLUSTER_NAME,
    KUBE_CLUSTER_SERVER,
    KUBE_CLUSTER_USER,
  }

  config.set("env", env);
}

export async function makeResource(resource: Resources) {
  if (!hasInit()) {
    console.error("You must initialize Furret first.");
    return;
  }

  const validation = resourceSchema.safeParse(resource);
  if (!validation.success) {
    console.error(validation.error.format()._errors[0])
  }

  switch (resource) {
    case "pg": {
      const kube = await provisionPostgresDatabase();

      const hostname = `${kube.namespace}.${env.CLOUDFLARE_ZONE_NAME}`;

      await createCloudflareDNSRecord({ hostname });
      await createCloudflareTunnel({
        hostname,
        service: kube.service,
      });

      console.log(`Created ${kube.namespace} 🚀\nPassword: ${kube.password}\n\nConnect to this database by using:\nfurret connect pg ${kube.id}`);

      break;
    }
    case "redis": {
      console.warn("Not implemented.");
    }
  }
}

const map: Record<Resources, string> = {
  "pg": "postgres",
  "redis": "redis",
};

const shortnames: Record<string, string> = {
  "postgres": "PostgreSQL databases",
  "redis": "Redis databases",
}

export async function listResource(filter?: Resources) {
  if (!hasInit()) {
    console.error("You must initialize Furret first.");
    return;
  }

  if (filter) {
    const validation = resourceSchema.safeParse(filter);
    if (!validation.success) {
      console.error(validation.error.format()._errors[0])
    }
  }

  const keys = Object.values(map);

  const tunnels = await listCloudflareTunnels()
    .then((tunnels) => {
      if (filter) {
        return tunnels.filter((tunnel) => {
          return tunnel.hostname.startsWith(map[filter]);
        });
      }

      return tunnels.filter((tunnel) => {
        return keys.some((key) => tunnel.hostname.startsWith(key));
      });
    });

  const table = tunnels.reduce((table, tunnel) => {
    const [type, ...parts] = tunnel.hostname.split("-");
    const id = parts.join("-").split(".")[0];

    if (!table[type]) {
      table[type] = [];
    }

    table[type] = [...table[type], id];
    return table;
  }, {} as Record<string, Array<string>>);

  for (const [type, ids] of Object.entries(table)) {
    console.log(shortnames[type]);

    for (const id of ids) {
      const info = config.get(`connections.${type}-${id}`) as Connection | undefined;
      if (info) {
        const open = await isPortOpen(Number(info.local.split(":")[1]));
        if (open) {
          console.log(`• ${id} (connected)`);
          continue;
        } else {
          config.delete(`connections.${type}-${id}`);
        }
      }

      console.log(`• ${id}`);
    }
  }
}

export async function deleteResource(resource: Resources, id: string) {
  if (!hasInit()) {
    console.error("You must initialize Furret first.");
    return;
  }

  const name = `${map[resource]}-${id}`;
  const hostname = `${name}.${env.CLOUDFLARE_ZONE_NAME}`;

  await deleteCloudflareTunnel({ hostname });
  await deleteCloudflareDNSRecord({ hostname });
  await deprovisionPostgresDatabase({ id });

  console.log(`Deleted ${map[resource]}-${id}`);
}

type Connection = {
  pid: number;
  local: string;
  hostname: string;
};

export async function connectResource(resource: Resources, id: string) {
  if (!hasInit()) {
    console.error("You must initialize Furret first.");
    return;
  }

  const name = `${map[resource]}-${id}`;
  const hostname = `${name}.${env.CLOUDFLARE_ZONE_NAME}`;

  const info = config.get(`connections.${name}`) as Connection | undefined;

  if (info) {
    const open = await isPortOpen(Number(info.local.split(":")[1]));
    if (open) {
      console.log(`Already connected to ${name}`);
      return;
    } else {
      config.delete(`connections.${name}`);
    }
  }

  const tunnel = await getCloudflareTunnel({ hostname });

  if (!tunnel) {
    console.error("Could not locate tunnel.");
    return;
  }

  const cloudflared = Bun.which("cloudflared");

  if (!cloudflared) {
    console.error("Could not located cloudflared binary. Please install it.");
    return;
  }

  const port = await getPort();
  const local = `127.0.0.1:${port}`;

  const child = spawn(
    cloudflared,
    [
      "access",
      "tcp",
      "--hostname",
      hostname,
      "--url",
      local,
      "--log-level",
      "fatal",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  );

  child.unref();

  const pid = child.pid!;

  config.set(`connections.${name}`, {
    hostname,
    local,
    pid,
  } as Connection);

  console.log(`Database is running at ${local} 🚀\nConnect with psql -h 127.0.0.1 -p ${port} -U postgres`)
}

export async function disconnectResource(resource: Resources, id: string) {
  if (!hasInit()) {
    console.error("You must initialize Furret first.");
    return;
  }

  const name = `${map[resource]}-${id}`;
  const info = config.get(`connections.${name}`) as Connection;

  if (!info) {
    console.log(`Not connected to ${name}`);
    return;
  }

  kill(info.pid);
  config.delete(name);
  console.log(`Disconnected from ${name}`);
}
