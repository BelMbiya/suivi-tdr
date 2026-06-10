import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { defaultPathForRoles } from "@/lib/auth/redirect";

export default async function Home() {
  try {
    const user = await getCurrentUser();
    redirect(defaultPathForRoles(user.roles));
  } catch {
    redirect("/login");
  }
}
