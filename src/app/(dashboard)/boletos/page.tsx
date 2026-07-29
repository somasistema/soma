import { redirect } from "next/navigation";
import { TABELAS_CUSTA } from "@/types/database";

export default function BoletosPage() {
  redirect(`/boletos/${TABELAS_CUSTA[0]}`);
}
