const BOT_COOKIE = process.env.ROBLOX_BOT_TOKEN;

// Helper to make Roblox API requests with bot cookie and XSRF token handling
export async function robloxBotRequest(
  url: string,
  method: string,
  body?: object
): Promise<Response> {
  if (!BOT_COOKIE) {
    throw new Error("Bot token not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `.ROBLOSECURITY=${BOT_COOKIE}`,
  };

  let response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // If we get a 403 with x-csrf-token header, retry with that token
  if (response.status === 403) {
    const xsrfToken = response.headers.get("x-csrf-token");
    if (xsrfToken) {
      headers["x-csrf-token"] = xsrfToken;
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  return response;
}

// Get user's role in a group
export async function getUserGroupRole(
  groupId: string,
  userId: string
): Promise<{ roleId: number; rank: number } | null> {
  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/users/${userId}/groups/roles`
    );
    if (!response.ok) return null;

    const data = await response.json() as { data: Array<{ group: { id: number }; role: { id: number; rank: number } }> };
    const membership = data.data?.find(
      (g) => g.group.id === parseInt(groupId)
    );
    if (!membership) return null;

    return { roleId: membership.role.id, rank: membership.role.rank };
  } catch {
    return null;
  }
}

// Get role info by ID
export async function getRoleInfo(
  groupId: string,
  roleId: number
): Promise<{ rank: number; name: string } | null> {
  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}/roles`
    );
    if (!response.ok) return null;

    const data = await response.json() as { roles: Array<{ id: number; rank: number; name: string }> };
    const role = data.roles?.find((r) => r.id === roleId);
    if (!role) return null;

    return { rank: role.rank, name: role.name };
  } catch {
    return null;
  }
}

// Check if user is group owner
export async function isGroupOwner(
  groupId: string,
  robloxId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/groups/${groupId}`
    );
    if (!response.ok) return false;

    const data = await response.json() as { owner?: { id: number } };
    return data.owner?.id?.toString() === robloxId;
  } catch {
    return false;
  }
}
