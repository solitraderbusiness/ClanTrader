import { ClanCreateForm } from "@/components/clan/ClanCreateForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Create Clan" };

export default function CreateClanPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Create a New Clan</CardTitle>
          <CardDescription>
            Form a team of traders and compete together in seasons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClanCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
