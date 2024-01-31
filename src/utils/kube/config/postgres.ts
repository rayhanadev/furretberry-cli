import type {
  V1ConfigMap,
  V1Deployment,
  V1Namespace,
  V1PersistentVolume,
  V1PersistentVolumeClaim,
  V1Secret
} from "@kubernetes/client-node";

export default function config(id: string, opts: {
  password: string;
}) {
  const name = `postgres-${id}`;

  const metadata = (type: string) => ({
    name: `${name}-${type}`,
    namespace: name,
  });

  const namespace: V1Namespace = {
    metadata: { name },
  };

  const secret: V1Secret = {
    metadata: { ...metadata("secret") },
    type: "Opaque",
    data: {
      POSTGRES_PASSWORD: Buffer.from(opts.password, "utf-8").toString("base64"),
    },
  };

  const configmap: V1ConfigMap = {
    metadata: {
      ...metadata("config"),
      labels: { app: name },
    },
    data: {
      POSTGRES_DB: "postgres",
      POSTGRES_USER: "postgres",
    },
  };

  const directoryName = crypto.randomUUID();

  const persistentVolume: V1PersistentVolume = {
    metadata: {
      ...metadata("pv"),
      labels: {
        app: name,
        type: "local",
      },
    },
    spec: {
      storageClassName: "local-path",
      capacity: {
        storage: "3Gi",
      },
      accessModes: ["ReadWriteOnce"],
      hostPath: {
        path: `/media/kingspec/${directoryName}`,
        type: "DirectoryOrCreate",
      },
    },
  };

  const persistentVolumeClaim: V1PersistentVolumeClaim = {
    metadata: {
      ...metadata("claim"),
      labels: { app: name },
    },
    spec: {
      storageClassName: "local-path",
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: "3Gi",
        },
      },
      selector: {
        matchLabels: {
          type: "local",
        },
      },
    },
  };

  const deployment: V1Deployment = {
    metadata: {
      name: name,
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [{
            name: "postgres",
            image: "postgres:15.5-alpine3.19",
            imagePullPolicy: "IfNotPresent",
            ports: [{
              containerPort: 5432,
            }],
            env: [
              {
                name: "POSTGRES_DB",
                valueFrom: {
                  configMapKeyRef: {
                    name: `${name}-config`,
                    key: "POSTGRES_DB",
                  },
                },
              },
              {
                name: "POSTGRES_USER",
                valueFrom: {
                  configMapKeyRef: {
                    name: `${name}-config`,
                    key: "POSTGRES_USER",
                  },
                },
              },
              {
                name: "POSTGRES_PASSWORD",
                valueFrom: {
                  secretKeyRef: {
                    name: `${name}-secret`,
                    key: "POSTGRES_PASSWORD",
                  },
                },
              },
            ],
            volumeMounts: [{
              mountPath: "/var/lib/postgresql/data",
              name: "postgresdb",
            }],
          }],
          volumes: [{
            name: "postgresdb",
            persistentVolumeClaim: {
              claimName: `${name}-claim`,
            },
          }],
        },
      },
    },
  };

  const service = {
    metadata: {
      ...metadata("svc"),
      labels: { app: name },
    },
    spec: {
      type: "NodePort",
      ports: [{
        port: 5432,
      }],
      selector: {
        app: name,
      },
    },
  };

  return {
    name,
    namespace,
    secret,
    configmap,
    persistentVolume,
    persistentVolumeClaim,
    deployment,
    service,
  };
}
