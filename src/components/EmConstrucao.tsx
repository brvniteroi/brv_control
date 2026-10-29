interface EmConstrucaoProps {
  titulo: string;
  descricao: string;
}

/** Placeholder das páginas que ainda não foram implementadas. */
export default function EmConstrucao({ titulo, descricao }: EmConstrucaoProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brv-navy">{titulo}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        {descricao}
      </div>
    </div>
  );
}
