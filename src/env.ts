import { createEnv } from "@t3-oss/env-core";
import Conf from "conf";
import { z } from "zod";

import { name, version } from "../package.json";

const config = new Conf({
  projectName: name,
  projectVersion: version,
});

export const env = createEnv({
  server: {
    CLOUDFLARE_ACCESS_CLIENT_ID: z.string(),
    CLOUDFLARE_ACCESS_CLIENT_SECRET: z.string(),
    CLOUDFLARE_ACCOUNT_ID: z.string(),
    CLOUDFLARE_ZONE_ID: z.string(),
    CLOUDFLARE_ZONE_NAME: z.string(),
    CLOUDFLARE_TUNNEL_ID: z.string(),
    CLOUDFLARE_API_TOKEN: z.string(),
    KUBE_SERVICE_ACCOUNT_KEY: z.string(),
    KUBE_CLUSTER_NAME: z.string(),
    KUBE_CLUSTER_SERVER: z.string(),
    KUBE_CLUSTER_USER: z.string(),
  },
  runtimeEnv: config.get("env", {
    CLOUDFLARE_ACCESS_CLIENT_ID: "",
    CLOUDFLARE_ACCESS_CLIENT_SECRET: "",
    CLOUDFLARE_ACCOUNT_ID: "",
    CLOUDFLARE_ZONE_ID: "",
    CLOUDFLARE_ZONE_NAME: "",
    CLOUDFLARE_TUNNEL_ID: "",
    CLOUDFLARE_API_TOKEN: "",
    KUBE_SERVICE_ACCOUNT_KEY: "",
    KUBE_CLUSTER_NAME: "",
    KUBE_CLUSTER_SERVER: "",
    KUBE_CLUSTER_USER: "",
  }) as Record<string, any>,
});
