import { env } from "~/env";

const host = new URL(`https://api.cloudflare.com/`);

export type CloudflareDNSRecord = {
  id: string;
  content: string;
  name: string;
};

export async function listCloudflareDNSRecords(): Promise<Array<CloudflareDNSRecord>> {
  const endpoint = new URL(`/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, host);

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

  const records = response.result;
  return records;
}

export async function createCloudflareDNSRecord({ hostname }: {
  hostname: string;
}): Promise<void> {
  const name = hostname.split(".").slice(0, -2).join(".");

  const endpoint = new URL(`/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records`, host);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: `${env.CLOUDFLARE_TUNNEL_ID}.cfargotunnel.com`,
      name: name,
      proxied: true,
      type: "CNAME",
      ttl: 1,
    }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to create Cloudflare DNS Record: ${res.statusText}`);
      }

      return res;
    })
    .then((res) => res.json() as any)
    .catch((err) => {
      throw new Error(`Failed to create Cloudflare DNS Record: ${err.message}`);
    });

  if (!response.success) {
    throw new Error(`Failed to create Cloudflare DNS Record: ${response.errors[0].message}`);
  }

  return;
}

export async function getCloudflareDNSRecord({ hostname }: {
  hostname: string;
}): Promise<CloudflareDNSRecord | undefined> {
  const records = await listCloudflareDNSRecords();

  const record = records.find(({ name }) => name === hostname);

  if (!record) return;
  return record;
}

export async function deleteCloudflareDNSRecord({ hostname }: {
  hostname: string;
}): Promise<void> {
  const record = await getCloudflareDNSRecord({ hostname });

  if (!record) return;

  const endpoint = new URL(`/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/dns_records/${record.id}`, host);

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status !== 200) {
    throw new Error(`Failed to delete Cloudflare DNS Record: ${response.statusText}`);
  }

  return;
}
