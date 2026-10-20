import { db } from "@/server/db/client";
import { fail, ok } from "@/server/lib/api-response";
import { refreshCatalogueIfStale } from "@/server/providers/astech/astech.refresh";
import { PROVIDER_ID, WALLET_CURRENCY } from "@/server/providers/astech/astech.config";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  providerName: string;
  category: string;
  imageUrl: string | null;
  currencies: string;
}

/**
 * Locally cached provider catalogue — enabled, still offered by the provider,
 * and playable in INR. Provider game ids and URLs are not exposed; the client
 * launches by XArena's own id.
 */
export async function GET(req: Request) {
  try {
    refreshCatalogueIfStale();
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search")?.trim().slice(0, 60);

    const rows = db
      .prepare(
        `SELECT id, title, providerName, category, imageUrl, currencies FROM ProviderGame
         WHERE provider = ? AND isEnabled = 1 AND isAvailable = 1
         ORDER BY providerName ASC, title ASC`
      )
      .all(PROVIDER_ID) as Row[];

    let games = rows.filter((r) => {
      try {
        return (JSON.parse(r.currencies) as string[]).includes(WALLET_CURRENCY);
      } catch {
        return false;
      }
    });
    if (category) games = games.filter((g) => g.category === category);
    if (search) games = games.filter((g) => `${g.title} ${g.providerName}`.toLowerCase().includes(search.toLowerCase()));

    const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
    return ok({
      categories,
      games: games.slice(0, 500).map((g) => ({
        id: g.id,
        title: g.title,
        provider: g.providerName,
        category: g.category,
        imageUrl: g.imageUrl,
      })),
    });
  } catch (error) {
    return fail(error);
  }
}
