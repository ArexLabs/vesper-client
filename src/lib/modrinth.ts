import { GenericModrinthClient, type Labrinth } from "@modrinth/api-client";

export const modrinthClient = new GenericModrinthClient({
  userAgent: "vesper-client/1.0.0-alpha",
});

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

function mapHit(hit: Labrinth.Projects.v2.SearchResultHit): ModrinthProject {
  return {
    id: hit.project_id,
    slug: hit.slug ?? null,
    title: hit.title,
    summary: hit.description,
    downloads: hit.downloads,
    followers: hit.follows,
    author: hit.author ?? null,
    iconUrl: hit.icon_url || null,
    url: hit.slug ? `https://modrinth.com/mod/${hit.slug}` : null,
  };
}

export async function searchModrinthProjects(
  input: SearchModrinthProjectsInput,
): Promise<ModrinthProject[]> {
  const query = input.query.trim();

  const result = await modrinthClient.labrinth.projects_v2.search({
    query,
    facets: buildFacets(input),
    index: input.sort ?? "relevance",
    limit: Math.min(Math.max(input.limit ?? 12, 1), 30),
  });

  return result.hits.map(mapHit);
}
