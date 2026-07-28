import { redirect } from "next/navigation";
import { LOCAIS_SERVICO } from "@/types/database";

export default function ServicosPage() {
  redirect(`/servicos/${LOCAIS_SERVICO[0]}`);
}
