export function diagnoseResponse(response: unknown): string {
  if (!response || typeof response !== "object") {
    return "response_not_object";
  }

  const r = response as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof r.status === "string") {
    parts.push(`status=${r.status}`);
  }

  if (r.incomplete_details !== undefined && r.incomplete_details !== null) {
    parts.push(`incomplete_details=${safeJson(r.incomplete_details)}`);
  }

  if (Array.isArray(r.output)) {
    const types = r.output.map((item) => {
      if (!item || typeof item !== "object") return "unknown";
      return String((item as Record<string, unknown>).type ?? "unknown");
    });
    parts.push(`output_types=[${types.join(", ")}]`);

    let refusal = false;
    for (const item of r.output) {
      if (!item || typeof item !== "object") continue;
      const message = item as Record<string, unknown>;
      if (message.type !== "message" || !Array.isArray(message.content)) continue;

      for (const block of message.content) {
        if (!block || typeof block !== "object") continue;
        const content = block as Record<string, unknown>;
        if (content.type === "refusal") refusal = true;
      }
    }

    parts.push(`refusal=${refusal}`);
  } else {
    parts.push("output_missing");
  }

  if (typeof r.output_text === "string" && r.output_text.length > 0) {
    parts.push("output_text_present");
  } else {
    parts.push("output_text_absent");
  }

  if (r.output_parsed !== undefined && r.output_parsed !== null) {
    parts.push("output_parsed_present");
  } else {
    parts.push("output_parsed_absent");
  }

  return parts.join("; ");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

export function extractTextFromOutput(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as Record<string, unknown>;

  if (typeof r.output_text === "string" && r.output_text.trim()) {
    return r.output_text;
  }

  if (!Array.isArray(r.output)) return null;

  const chunks: string[] = [];
  for (const item of r.output) {
    if (!item || typeof item !== "object") continue;
    const message = item as Record<string, unknown>;
    if (message.type !== "message" || !Array.isArray(message.content)) continue;

    for (const block of message.content) {
      if (!block || typeof block !== "object") continue;
      const content = block as Record<string, unknown>;
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const joined = chunks.join("").trim();
  return joined || null;
}
