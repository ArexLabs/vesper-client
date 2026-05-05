export type ModrinthSearchSort = "relevance" | "downloads" | "follows" | "updated";

export type ModrinthProject = {
  id: string;
  slug: string | null;
  title: string;
  summary: string;
  downloads: number;
  followers: number;
  author: string | null;
  iconUrl: string | null;
  url: string | null;
};

export type SearchModrinthProjectsInput = {
  query: string;
  loader?: string | null;
  gameVersion?: string | null;
  sort?: ModrinthSearchSort;
  limit?: number;
};

function buildFacets(input: SearchModrinthProjectsInput) {
  const facets: string[][] = [["project_type:mod"]];

  const loader = input.loader?.trim().toLowerCase();
  if (loader && loader !== "all" && loader !== "vanilla") {
    facets.push([`categories:${loader}`]);
  }

  const gameVersion = input.gameVersion?.trim();
  if (gameVersion && gameVersion !== "all") {
    facets.push([`versions:${gameVersion}`]);
  }

  return facets;
}

function mapHit(raw: unknown): ModrinthProject | null {
  if (!raw || typeof raw !== "object") return null;
  const hit = raw as Record<string, unknown>;
  const id =
    typeof hit.project_id === "string" ? hit.project_id : typeof hit.id === "string" ? hit.id : "";
  if (!id) return null;

  const slug = typeof hit.slug === "string" ? hit.slug : null;
  const downloads = typeof hit.downloads === "number" ? hit.downloads : 0;
  const followers = typeof hit.follows === "number" ? hit.follows : 0;

  return {
    id,
    slug,
    title: typeof hit.title === "string" ? hit.title : "Untitled mod",
    summary: typeof hit.description === "string" ? hit.description : "",
    downloads: Number.isFinite(downloads) ? downloads : 0,
    followers: Number.isFinite(followers) ? followers : 0,
    author: typeof hit.author === "string" ? hit.author : null,
    iconUrl: typeof hit.icon_url === "string" ? hit.icon_url : null,
    url: slug ? `https://modrinth.com/mod/${slug}` : null,
  };
}

export async function searchModrinthProjects(
  input: SearchModrinthProjectsInput,
): Promise<ModrinthProject[]> {
  const query = input.query.trim();
  const url = new URL("https://api.modrinth.com/v2/search");
  url.searchParams.set("query", query);
  url.searchParams.set("facets", JSON.stringify(buildFacets(input)));
  url.searchParams.set("limit", String(Math.min(Math.max(input.limit ?? 12, 1), 30)));
  url.searchParams.set("index", input.sort ?? "relevance");

  const response = await fetch(url.toString(), { method: "GET" });

  if (!response.ok) {
    throw new Error(`Modrinth request failed (${response.status})`);
  }

  const body = (await response.json()) as { hits?: unknown[] };
  return (body.hits ?? []).map(mapHit).filter((item): item is ModrinthProject => Boolean(item));
}
