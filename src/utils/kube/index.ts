import {
  KubeConfig,
  AppsV1Api,
  CoreV1Api,
} from "@kubernetes/client-node";
import type {
  Cluster,
  User,
  Authentication,
} from "@kubernetes/client-node";
import type { Options } from "request";

import { env } from "~/env";

import postgresConfig from "./config/postgres";

export async function createKubeClient(opts: {
  cluster: Cluster;
  user: User;
}): Promise<[CoreV1Api, AppsV1Api]> {
  const kc = new KubeConfig();

  const context = {
    name: opts.cluster.name,
    cluster: opts.cluster.name,
    user: opts.user.name,
  };

  kc.loadFromOptions({
    clusters: [opts.cluster],
    users: [opts.user],
    contexts: [context],
    currentContext: context.name,
  });

  kc.setCurrentContext(opts.cluster.name);

  const coreClient = kc.makeApiClient(CoreV1Api);
  const appsClient = kc.makeApiClient(AppsV1Api);

  const auth = new CloudflareAuth({
    serviceAccountKey: env.KUBE_SERVICE_ACCOUNT_KEY,
    cfAccessClientId: env.CLOUDFLARE_ACCESS_CLIENT_ID,
    cfAccessClientSecret: env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
  });

  coreClient.setDefaultAuthentication(auth);
  appsClient.setDefaultAuthentication(auth);

  return [coreClient, appsClient];
}

export async function provisionPostgresDatabase() {
  const id = crypto.randomUUID();
  const password = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const [coreClient, appsClient] = await createKubeClient({
    cluster: {
      name: env.KUBE_CLUSTER_NAME,
      server: env.KUBE_CLUSTER_SERVER,
    },
    user: {
      name: env.KUBE_CLUSTER_USER,
    },
  });

  const config = postgresConfig(id, { password });

  await coreClient.createNamespace(config.namespace);
  await coreClient.createNamespacedSecret(config.name, config.secret);
  await coreClient.createNamespacedConfigMap(config.name, config.configmap);
  await coreClient.createPersistentVolume(config.persistentVolume);
  await coreClient.createNamespacedPersistentVolumeClaim(config.name, config.persistentVolumeClaim);
  await appsClient.createNamespacedDeployment(config.name, config.deployment);
  await coreClient.createNamespacedService(config.name, config.service);

  const svcs = await coreClient.listNamespacedService(config.name);
  const clusterIP = svcs.body.items[0].spec?.clusterIP;

  return {
    id,
    namespace: config.name,
    service: `tcp://${clusterIP}:5432`,
    user: "postgres",
    password,
    database: "postgres",
  };
}

export async function deprovisionPostgresDatabase({ id }: { id: string; }) {
  const [coreClient] = await createKubeClient({
    cluster: {
      name: env.KUBE_CLUSTER_NAME,
      server: env.KUBE_CLUSTER_SERVER,
    },
    user: {
      name: env.KUBE_CLUSTER_USER,
    },
  });

  const namespace = `postgres-${id}`;

  await coreClient.deleteNamespace(namespace);
  await coreClient.deletePersistentVolume(`${namespace}-pv`);
}

class CloudflareAuth implements Authentication {
  public serviceAccountKey: string;
  public cfAccessClientId: string;
  public cfAccessClientSecret: string;

  constructor(opts: {
    serviceAccountKey: string;
    cfAccessClientId: string;
    cfAccessClientSecret: string;
  }) {
    this.serviceAccountKey = opts.serviceAccountKey;
    this.cfAccessClientId = opts.cfAccessClientId;
    this.cfAccessClientSecret = opts.cfAccessClientSecret;
  }

  applyToRequest(requestOptions: Options): void | Promise<void> {
    if (!requestOptions.headers) requestOptions.headers = {};

    requestOptions.headers["Authorization"] = `Bearer ${this.serviceAccountKey}`;
    requestOptions.headers["CF-Access-Client-Id"] = this.cfAccessClientId;
    requestOptions.headers["CF-Access-Client-Secret"] = this.cfAccessClientSecret;
  }
}
