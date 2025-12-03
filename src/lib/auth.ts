import { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

interface RobloxProfile {
  sub: string;
  name: string;
  nickname: string;
  preferred_username: string;
  created_at: number;
  profile: string;
  picture: string;
}

function RobloxProvider(): OAuthConfig<RobloxProfile> {
  return {
    id: "roblox",
    name: "Roblox",
    type: "oauth",
    authorization: {
      url: "https://apis.roblox.com/oauth/v1/authorize",
      params: {
        scope: "openid profile group:read group:write",
        response_type: "code",
      },
    },
    token: "https://apis.roblox.com/oauth/v1/token",
    userinfo: "https://apis.roblox.com/oauth/v1/userinfo",
    issuer: "https://apis.roblox.com/oauth/",
    jwks_endpoint: "https://apis.roblox.com/oauth/v1/certs",
    clientId: process.env.ROBLOX_CLIENT_ID,
    clientSecret: process.env.ROBLOX_CLIENT_SECRET,
    idToken: true,
    checks: ["state"],
    client: {
      id_token_signed_response_alg: "ES256",
    },
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name || profile.preferred_username,
        email: null,
        image: profile.picture,
        robloxId: profile.sub,
      };
    },
  };
}

export const authOptions: NextAuthOptions = {
  providers: [RobloxProvider()],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.robloxId = (profile as RobloxProfile).sub;
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string,
        user: {
          ...session.user,
          robloxId: token.robloxId as string,
        },
      };
    },
  },
  pages: {
    signIn: "/",
  },
};
