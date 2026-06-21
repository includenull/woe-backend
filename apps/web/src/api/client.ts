import type { StatusResponse } from "@waxonedge/api-contracts";
import { apiRoutes } from "@waxonedge/api-contracts";

export async function fetchStatus(baseUrl = ""): Promise<StatusResponse> {
  const response = await fetch(`${baseUrl}${apiRoutes.status}`);

  if (!response.ok) {
    throw new Error(`Status request failed: ${response.status}`);
  }

  return response.json() as Promise<StatusResponse>;
}
