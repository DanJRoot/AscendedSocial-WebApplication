// Cloudflare Streaming Service
// Handles video upload, URL generation, and storage via Cloudflare
// Falls back gracefully when Cloudflare credentials are not configured

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

export interface CloudflareUploadResult {
  success: boolean;
  videoUrl?: string;
  streamId?: string;
  error?: string;
}

export async function uploadVideoToCloudflare(
  fileBuffer: Buffer,
  fileName: string
): Promise<CloudflareUploadResult> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    console.warn("Cloudflare credentials not configured, using local URL placeholder");
    // Return a placeholder URL for development
    return {
      success: true,
      videoUrl: `/uploads/videos/${Date.now()}-${fileName}`,
      streamId: `local-${Date.now()}`,
    };
  }

  try {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare upload error:", response.status, errorText);
      return {
        success: false,
        error: `Cloudflare upload failed: ${response.status}`,
      };
    }

    const data = await response.json();
    const streamResult = data.result;

    return {
      success: true,
      videoUrl: streamResult?.preview || streamResult?.playback?.hls,
      streamId: streamResult?.uid,
    };
  } catch (error) {
    console.error("Error uploading to Cloudflare:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

export function getStreamUrl(streamId: string): string {
  if (!CLOUDFLARE_ACCOUNT_ID) {
    return `/uploads/videos/${streamId}`;
  }
  return `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${streamId}/manifest/video.m3u8`;
}

export function getThumbnailUrl(streamId: string): string {
  if (!CLOUDFLARE_ACCOUNT_ID) {
    return `/uploads/thumbnails/${streamId}.jpg`;
  }
  return `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${streamId}/thumbnails/thumbnail.jpg`;
}

// ── Cloudflare Media Analytics ──────────────────────────────

export interface StreamAnalytics {
  views: number;
  minutesViewed: number;
  uniqueViewers: number;
}

/**
 * Fetch analytics for a specific video from Cloudflare Stream Analytics API.
 * Returns view counts and minutes watched. Falls back gracefully.
 */
export async function getStreamAnalytics(
  streamId: string,
  since?: Date
): Promise<StreamAnalytics | null> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return null; // Analytics unavailable without Cloudflare credentials
  }

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceStr = sinceDate.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const query = `
      query {
        viewer {
          accounts(filter: { accountTag: "${CLOUDFLARE_ACCOUNT_ID}" }) {
            streamMinutesViewedAdaptiveGroups(
              filter: { uid: "${streamId}", date_geq: "${sinceStr}" }
              limit: 1
            ) {
              sum { minutesViewed }
              count
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn(`Cloudflare analytics API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const groups = data?.data?.viewer?.accounts?.[0]?.streamMinutesViewedAdaptiveGroups;

    if (!groups || groups.length === 0) {
      return { views: 0, minutesViewed: 0, uniqueViewers: 0 };
    }

    return {
      views: groups[0].count || 0,
      minutesViewed: groups[0].sum?.minutesViewed || 0,
      uniqueViewers: groups[0].count || 0, // Cloudflare groups count as unique
    };
  } catch (error) {
    console.warn("Error fetching Cloudflare analytics:", error);
    return null;
  }
}

/**
 * Batch analytics for multiple streams (for dashboard/trending).
 */
export async function getBatchStreamAnalytics(
  streamIds: string[],
  since?: Date
): Promise<Map<string, StreamAnalytics>> {
  const results = new Map<string, StreamAnalytics>();

  // Fetch in parallel with concurrency limit of 5
  const chunks: string[][] = [];
  for (let i = 0; i < streamIds.length; i += 5) {
    chunks.push(streamIds.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (id) => {
      const analytics = await getStreamAnalytics(id, since);
      if (analytics) results.set(id, analytics);
    });
    await Promise.all(promises);
  }

  return results;
}
