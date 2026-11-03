// Publica o APK assinado na HostGator (FTPS) em app/brv-control.apk, para o pessoal baixar pelo link
//   https://control.brvniteroi.com.br/app/brv-control.apk
// O deploy do site (FTP-Deploy) só apaga o que ele mesmo enviou, então a pasta app/ não é tocada por ele.
//
// Uso:  node scripts/publicar-apk.mjs <caminho do .apk>
// Precisa de FTP_SERVER, FTP_USERNAME, FTP_PASSWORD no ambiente (secrets do GitHub ou .env: --env-file=.env).
import { existsSync } from 'node:fs';
import { checkServerIdentity } from 'node:tls';
import { Readable } from 'node:stream';
import { Client } from 'basic-ftp';

const arquivo = process.argv[2];
const { FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_INSEGURO } = process.env;
if (!arquivo || !existsSync(arquivo)) {
  console.error('Uso: node scripts/publicar-apk.mjs <caminho do .apk>');
  process.exit(1);
}
if (!FTP_SERVER || !FTP_USERNAME || !FTP_PASSWORD) {
  console.error('Falta FTP_SERVER, FTP_USERNAME ou FTP_PASSWORD.');
  process.exit(1);
}

// A HostGator apresenta o certificado dela (*.hostgator.com.br) no FTP do domínio do cliente
const conferirNome = (host, cert) =>
  checkServerIdentity(host, cert) === undefined ? undefined : checkServerIdentity('ftp.hostgator.com.br', cert);

const c = new Client(120_000);
try {
  await c.access({
    host: FTP_SERVER,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
    secure: true,
    secureOptions: FTP_INSEGURO === '1' ? { rejectUnauthorized: false } : { checkServerIdentity: conferirNome },
  });
  await c.ensureDir('app');
  // O .htaccess garante o tipo certo, para o Android reconhecer o download como instalador
  await c.uploadFrom(Readable.from(['AddType application/vnd.android.package-archive .apk\n']), '.htaccess');
  // Sobe com outro nome e renomeia: quem estiver baixando não pega arquivo pela metade
  await c.uploadFrom(arquivo, 'brv-control.apk.tmp');
  await c.rename('brv-control.apk.tmp', 'brv-control.apk');
  console.log('APK publicado em https://control.brvniteroi.com.br/app/brv-control.apk');
} finally {
  c.close();
}
