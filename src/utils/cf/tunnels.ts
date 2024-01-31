import { env } from "~/env";

const host = new URL(`https://api.cloudflare.com/`);

export type CloudflareTunnel = {
  service: string;
  hostname: string;
  originRequest: {},
};

export async function listCloudflareTunnels(): Promise<Array<CloudflareTunnel>> {
  const endpoint = new URL(`/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${env.CLOUDFLARE_TUNNEL_ID}/configurations`, host);

  const response = await fetch(endpoint, {
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to list Cloudflare tunnels: ${res.statusText}`);
      }

      return res;
    })
    .then((res) => res.json() as any)
    .catch((err) => {
      throw new Error(`Failed to list Cloudflare tunnels: ${err.message}`);
    });

  const tunnels = response.result.config.ingress.slice(0, -1);
  return tunnels;
}

export async function createCloudflareTunnel({ hostname, service }: {
  hostname: string;
  service: string;
}): Promise<void> {
  const tunnels = await listCloudflareTunnels();

  const endpoint = new URL(`/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${env.CLOUDFLARE_TUNNEL_ID}/configurations`, host);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        ingress: [
          ...tunnels,
          {
            service,
            hostname,
            originRequest: {},
          },
          {
            service: "http_status:404",
          },
        ],
      },
    }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to create Cloudflare Tunnel: ${res.statusText}`);
      }

      return res;
    })
    .then((res) => res.json() as any)
    .catch((err) => {
      throw new Error(`Failed to create Cloudflare Tunnel: ${err.message}`);
    });

  if (!response.success) {
    throw new Error(`Failed to create Cloudflare Tunnel: ${response.errors[0].message}`);
  }

  return;
}

export async function getCloudflareTunnel({ hostname }: {
  hostname: string;
}): Promise<CloudflareTunnel | undefined> {
  const tunnels = await listCloudflareTunnels();

  const tunnel = tunnels.find(({ hostname: name }) => name === hostname);

  if (!tunnel) return;
  return tunnel;
}

export async function deleteCloudflareTunnel({ hostname }: {
  hostname: string;
}): Promise<void> {
  const tunnels = await listCloudflareTunnels();

  const endpoint = new URL(`/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${env.CLOUDFLARE_TUNNEL_ID}/configurations`, host);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        ingress: [
          ...tunnels.filter(({ hostname: name }) => name !== hostname),
          {
            service: "http_status:404",
          },
        ],
      },
    }),
  });

  if (response.status !== 200) {
    throw new Error(`Failed to delete Cloudflare Tunnel: ${response.statusText}`);
  }

  return;
}
