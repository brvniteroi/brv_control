import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeImagemProps {
  /** Texto do QR (aqui, sempre um link). */
  valor: string;
  /** Lado em pixels na tela (a imagem é gerada com 3x para sair nítida na impressão). */
  tamanho?: number;
  alt: string;
  className?: string;
}

/** QR Code como imagem (gerado no navegador, sem serviço externo). Fica em branco enquanto gera. */
export default function QrCodeImagem({ valor, tamanho = 80, alt, className }: QrCodeImagemProps) {
  // Guarda o texto junto com a imagem: se o link mudar, a imagem velha some até a nova ficar pronta
  const [pronto, setPronto] = useState<{ valor: string; url: string } | null>(null);

  useEffect(() => {
    if (!valor) return;
    let ativo = true;
    QRCode.toDataURL(valor, { errorCorrectionLevel: 'M', margin: 1, width: tamanho * 3 }).then(
      (url) => {
        if (ativo) setPronto({ valor, url });
      },
      () => {
        if (ativo) setPronto(null);
      },
    );
    return () => {
      ativo = false;
    };
  }, [valor, tamanho]);

  if (!pronto || pronto.valor !== valor) {
    return <div style={{ width: tamanho, height: tamanho }} className={className} aria-hidden="true" />;
  }
  return <img src={pronto.url} alt={alt} width={tamanho} height={tamanho} className={className} />;
}
