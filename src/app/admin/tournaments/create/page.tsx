import { redirect } from "next/navigation";

// Canonical creation form lives at /admin/tournaments/new; this route exists
// to match the documented URL. Kept as a redirect rather than a duplicate
// page so the form logic has a single source of truth.
export default function CreateTournamentRedirect() {
  redirect("/admin/tournaments/new");
}
