-- Escritório (além do admin) pode excluir formulário de campo adicionado errado.
-- Modelos de formulário continuam só com o admin.
DROP POLICY "Só admin exclui" ON public.form_responses;
CREATE POLICY "Escritório exclui" ON public.form_responses AS RESTRICTIVE FOR DELETE TO authenticated
  USING ((SELECT public.eh_escritorio()));
