/**
 * n8n webhook client
 * Sends generation requests to n8n.zenohome.by
 */

const N8N_BASE = process.env.N8N_BASE_URL ?? "https://n8n.zenohome.by";
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET ?? "";

export interface GeneratePostInput {
  niche: string;
  style: string;
  platforms: string[];
  type: "image" | "video";
  projectId: string;
  trendKeywords?: string[];
  brandColors?: string[];
  extraInstructions?: string;
}

export interface GeneratePostResult {
  media_url: string;
  media_type: "image" | "video";
  caption: string;
  hashtags: string[];
  video_prompt?: string;
}

export async function generatePost(
  input: GeneratePostInput
): Promise<GeneratePostResult> {
  const res = await fetch(`${N8N_BASE}/webhook/smm-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SMM-Secret": N8N_SECRET,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`n8n generate failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<GeneratePostResult>;
}

export interface TrendData {
  hashtag: string;
  views: number;
  growth: number;
  platform: string;
}

export async function fetchTrends(
  niche: string,
  platforms: string[]
): Promise<TrendData[]> {
  const res = await fetch(`${N8N_BASE}/webhook/smm-trends`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SMM-Secret": N8N_SECRET,
    },
    body: JSON.stringify({ niche, platforms }),
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json() as { data?: TrendData[] };
  return data.data ?? [];
}
