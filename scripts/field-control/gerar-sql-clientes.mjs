// Converte a amostra baixada (baixar-amostra.mjs) em SQL para o Supabase:
// clientes + endereços + contatos. Idempotente por field_control_id.
// Uso: node scripts/field-control/gerar-sql-clientes.mjs   (gera amostra/clientes.sql)
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const PASTA = path.join(import.meta.dirname, 'amostra');

const UF = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const limpo = (s) => (typeof s === 'string' && s.trim() ? s.trim().replace(/\s+/g, ' ') : null);
const ts = (v) => `COALESCE(${lit(v ?? null)}::timestamptz, NOW())`;
const lit = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`);

function uf(estado) {
  const e = limpo(estado);
  if (!e) return 'RJ';
  if (/^[A-Za-z]{2}$/.test(e)) return e.toUpperCase();
  return UF[semAcento(e)] ?? 'RJ';
}

/** "+5521999866732" ou "21999885920" -> "(21) 99986-6732" */
function telefone(n) {
  let d = String(n ?? '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || null;
}

const ROTULO_TEL = { mobile: 'Celular', home: 'Casa', work: 'Comercial', other: 'Telefone' };

function bloco(d) {
  const c = d.cliente;
  const doc = String(c.documentNumber ?? '').replace(/\D/g, '');
  const tipo = doc.length === 14 ? 'PJ' : 'PF';
  const nome = limpo(c.name);
  const lista = (x) => (Array.isArray(x) ? x : []);

  const locs = lista(d.localizacoes).filter((l) => !l.archived);
  const principal = locs.find((l) => l.id === c.primaryLocation?.id) ?? locs[0];

  // Contato principal junta o telefone e o e-mail principais; os demais viram contatos extras
  const tels = lista(d.telefones);
  const mails = lista(d.emails);
  const telPrinc = tels.find((t) => t.primary) ?? tels[0];
  const mailPrinc = mails.find((m) => m.primary) ?? mails[0];
  const contatos = [];
  if (telPrinc || mailPrinc) {
    contatos.push({
      role: telPrinc ? ROTULO_TEL[telPrinc.type] ?? 'Telefone' : 'E-mail',
      phone: telPrinc ? telefone(telPrinc.number) : null,
      is_whatsapp: telPrinc?.whatsapp ?? false,
      email: mailPrinc?.address?.trim() ?? null,
      is_primary: true,
    });
  }
  for (const t of tels) if (t !== telPrinc) contatos.push({ role: ROTULO_TEL[t.type] ?? 'Telefone', phone: telefone(t.number), is_whatsapp: t.whatsapp ?? false, email: null, is_primary: false });
  for (const m of mails) if (m !== mailPrinc) contatos.push({ role: 'E-mail', phone: null, is_whatsapp: false, email: m.address.trim(), is_primary: false });

  const sql = [];
  sql.push(`-- ${nome} (Field Control ${c.id})`);
  sql.push('DO $$\nDECLARE v_id UUID;\nBEGIN');
  sql.push(`  INSERT INTO public.customers (person_type, name, document, notes, active, field_control_id, created_at)
  VALUES (${lit(tipo)}, ${lit(nome)}, ${lit(doc || null)}, ${lit(limpo(c.notes))}, ${lit(!c.archived)}, ${lit(c.id)}, ${ts(c.createdAt)})
  ON CONFLICT (field_control_id) DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes, active = EXCLUDED.active
  RETURNING id INTO v_id;`);

  for (const l of locs) {
    const a = l.address ?? {};
    // No Field Control o nome da localização costuma repetir o do cliente: só vira apelido se for diferente
    const apelido = limpo(l.name) && semAcento(l.name) !== semAcento(nome) ? limpo(l.name) : null;
    sql.push(`  INSERT INTO public.customer_addresses (customer_id, label, zip_code, street, number, complement, district, city, state, latitude, longitude, is_primary, active, field_control_id)
  VALUES (v_id, ${lit(apelido)}, ${lit(String(a.postalCode ?? '').replace(/\D/g, '') || null)}, ${lit(limpo(a.street) ?? '(sem logradouro)')}, ${lit(limpo(a.number))}, ${lit(limpo(a.complement))}, ${lit(limpo(a.neighborhood))}, ${lit(limpo(a.city) ?? 'Niterói')}, ${lit(uf(a.state))}, ${lit(a.coords?.latitude ?? null)}, ${lit(a.coords?.longitude ?? null)}, ${lit(l === principal)}, ${lit(!l.archived)}, ${lit(l.id)})
  ON CONFLICT (field_control_id) DO UPDATE SET street = EXCLUDED.street, number = EXCLUDED.number, complement = EXCLUDED.complement, district = EXCLUDED.district, city = EXCLUDED.city, state = EXCLUDED.state, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;`);
  }

  // Contatos importados são recriados a cada execução
  sql.push('  DELETE FROM public.customer_contacts WHERE customer_id = v_id;');
  for (const k of contatos) {
    sql.push(`  INSERT INTO public.customer_contacts (customer_id, name, role, phone, is_whatsapp, email, is_primary)
  VALUES (v_id, ${lit(nome)}, ${lit(k.role)}, ${lit(k.phone)}, ${lit(k.is_whatsapp)}, ${lit(k.email)}, ${lit(k.is_primary)});`);
  }
  sql.push('END $$;');
  return sql.join('\n');
}

const arquivos = (await readdir(PASTA)).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const partes = ['-- Amostra do Field Control: clientes, endereços e contatos. Gerado por gerar-sql-clientes.mjs\n'];
for (const f of arquivos) partes.push(bloco(JSON.parse(await readFile(path.join(PASTA, f), 'utf8'))));
await writeFile(path.join(PASTA, 'clientes.sql'), partes.join('\n\n') + '\n');
console.log(`${arquivos.length} clientes -> ${path.join(PASTA, 'clientes.sql')}`);
