// fn_render_modelo_contrato(p_marcar => true) envolve cada valor que
// veio do processo nos caracteres de controle STX/ETX. A minuta gerada
// é guardada assim (migration 057): a tela pinta esses trechos de
// vermelho e o PDF pra assinatura tira as marcas.
import { dividirLacunas } from "@/lib/minuta-lacunas";

const STX = String.fromCharCode(2);
const ETX = String.fromCharCode(3);
// EOT na frente do valor = nome de parte (sublinhado)
const EOT = String.fromCharCode(4);
const MARCA = new RegExp(STX + "([^" + ETX + "]*)" + ETX);
const MARCAS = new RegExp("[" + STX + ETX + EOT + "]", "g");

export function renderMarcado(texto: string) {
  return texto.split(MARCA).map((parte, i) =>
    i % 2 === 1 ? (
      <span
        key={i}
        className={`font-semibold text-status-reprovado${parte.startsWith(EOT) ? " underline" : ""}`}
      >
        {parte.replace(EOT, "")}
      </span>
    ) : (
      <span key={i}>
        {dividirLacunas(parte).map((t, j) =>
          t.lacuna ? (
            <span key={j} className="font-semibold text-status-reprovado">
              {t.texto}
            </span>
          ) : (
            t.texto
          )
        )}
      </span>
    )
  );
}

export function semMarcacao(texto: string) {
  return texto.replace(MARCAS, "");
}
