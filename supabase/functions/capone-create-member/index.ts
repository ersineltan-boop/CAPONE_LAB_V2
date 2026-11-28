import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import {
  isNewTeamPassword,
  normalizeTeamUsername,
  teamLoginAddress,
} from "../_shared/teamCredentials.ts";

type ErrorCode =
  | "invalid_request"
  | "not_authenticated"
  | "forbidden"
  | "username_taken"
  | "request_failed";

function configuredAppOrigin(): string | null {
  const value = Deno.env.get("CAPONE_TEAM_APP_ORIGIN") ?? "https://capone-lab-v2.vercel.app";
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.origin === value && (url.protocol === "https:" || (loopback && url.protocol === "http:"))) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

function response(status: number, body: { ok: true } | { error: ErrorCode }, headers?: Headers) {
  const resultHeaders = new Headers(headers);
  resultHeaders.set("Cache-Control", "no-store");
  resultHeaders.set("Vary", "Origin");
  return Response.json(body, { status, headers: resultHeaders });
}

async function readMemberInput(request: Request) {
  const contentType = request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
  if (contentType !== "application/json") return null;

  let input: Record<string, unknown>;
  try {
    const body = await request.text();
    if (body.length > 4_096) return null;
    const decoded: unknown = JSON.parse(body);
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return null;
    input = decoded as Record<string, unknown>;
  } catch {
    return null;
  }

  const { username: rawUsername, displayName: rawDisplayName, role, password } = input;
  if (typeof rawUsername !== "string" || typeof rawDisplayName !== "string" ||
      typeof password !== "string" || (role !== "partner" && role !== "employee")) return null;

  const username = normalizeTeamUsername(rawUsername);
  const displayName = rawDisplayName.trim();
  if (!username || !displayName || [...displayName].length > 120 ||
      /[\u0000-\u001f\u007f-\u009f]/u.test(displayName) || !isNewTeamPassword(password)) return null;

  return { username, displayName, role, password };
}

Deno.serve(async (request) => {
  const origin = configuredAppOrigin();
  if (!origin) return response(500, { error: "request_failed" });
  if (request.headers.get("Origin") !== origin) return response(403, { error: "forbidden" });

  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    headers.set("Allow", "POST, OPTIONS");
    return response(405, { error: "invalid_request" }, headers);
  }

  const token = /^Bearer (\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return response(401, { error: "not_authenticated" }, headers);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !secret) return response(500, { error: "request_failed" }, headers);
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) return response(401, { error: "not_authenticated" }, headers);

    // The role check also ensures the enrollment migration is present before creating an Auth user.
    const { data: authorized, error: roleError } = await admin.rpc("capone_can_enroll_team_member", {
      requester_id: user.id,
    });
    if (roleError) return response(500, { error: "request_failed" }, headers);
    if (authorized !== true) return response(403, { error: "forbidden" }, headers);

    const input = await readMemberInput(request);
    if (!input) return response(400, { error: "invalid_request" }, headers);

    const { data, error } = await admin.auth.admin.createUser({
      email: teamLoginAddress(input.username),
      password: input.password,
      email_confirm: true,
      app_metadata: {
        capone_member_enrollment: {
          requested_by: user.id,
          username: input.username,
          display_name: input.displayName,
          role: input.role,
        },
      },
    });
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      return response(409, { error: "username_taken" }, headers);
    }
    if (error?.code === "weak_password" || error?.code === "validation_failed") {
      return response(400, { error: "invalid_request" }, headers);
    }
    if (error || !data.user) return response(500, { error: "request_failed" }, headers);
    return response(201, { ok: true }, headers);
  } catch {
    return response(500, { error: "request_failed" }, headers);
  }
});
