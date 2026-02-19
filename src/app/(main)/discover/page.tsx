import { redirect } from "next/navigation";

export const metadata = { title: "Discover" };

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const resolved = await searchParams;
  const tab = resolved.tab || "clans";
  redirect(`/explore?tab=${tab}`);
}
