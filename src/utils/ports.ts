import { getPortPromise } from "portfinder";

export async function getPort(): Promise<number> {
  return getPortPromise();
}

export async function isPortOpen(port: number): Promise<boolean> {
  const suggestedPort = await getPortPromise({ port });
  return suggestedPort !== port;
}
