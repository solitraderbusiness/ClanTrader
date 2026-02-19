import { redirect } from "next/navigation";

export default function LeaderboardPage() {
  redirect("/explore?tab=leaderboard");
}
