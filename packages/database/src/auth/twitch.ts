function getConfig() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const redirectUri = process.env.TWITCH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, and TWITCH_REDIRECT_URI env vars are required"
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "user:read:email",
    state,
  });
  return `https://id.twitch.tv/oauth2/authorize?${params}`;
}

export interface TwitchTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function exchangeCode(
  code: string
): Promise<TwitchTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getConfig();
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Twitch token exchange failed: ${res.status}`);
  }
  return res.json() as Promise<TwitchTokenResponse>;
}

export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
}

export async function getUser(accessToken: string): Promise<TwitchUser> {
  const { clientId } = getConfig();
  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  if (!res.ok) {
    throw new Error(`Twitch user fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { data: TwitchUser[] };
  return data.data[0];
}
