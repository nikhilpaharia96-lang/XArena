import { redirect } from "next/navigation";

// Canonical route is /my-matches; kept as a redirect for the documented URL.
export default function MatchesRedirect() {
  redirect("/my-matches");
}
