import type { Metadata } from "next";
import DonatePage from "@/components/public/pages/DonatePage";

export const metadata: Metadata = { title: "Donate", description: "Support RemSam Homestead with a secure donation charged in Kenyan shillings." };

export default function Page() { return <DonatePage />; }
