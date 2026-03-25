-- Documents dropbox and gift cards ledger

-- Documents metadata table
CREATE TABLE IF NOT EXISTS public.document_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('invoice', 'book_ad', 'supplier_sheet', 'general')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'document_files'
      AND policyname = 'Allow all access to document_files'
  ) THEN
    CREATE POLICY "Allow all access to document_files"
    ON public.document_files FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_files_category ON public.document_files(category);
CREATE INDEX IF NOT EXISTS idx_document_files_created_at ON public.document_files(created_at DESC);

-- Documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read documents'
  ) THEN
    CREATE POLICY "Public read documents"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow upload documents'
  ) THEN
    CREATE POLICY "Allow upload documents"
      ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow update documents'
  ) THEN
    CREATE POLICY "Allow update documents"
      ON storage.objects
      FOR UPDATE
      USING (bucket_id = 'documents')
      WITH CHECK (bucket_id = 'documents');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow delete documents'
  ) THEN
    CREATE POLICY "Allow delete documents"
      ON storage.objects
      FOR DELETE
      USING (bucket_id = 'documents');
  END IF;
END $$;

-- Gift cards tables
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_number TEXT NOT NULL UNIQUE,
  holder_name TEXT,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('load', 'redeem', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gift_cards'
      AND policyname = 'Allow all access to gift_cards'
  ) THEN
    CREATE POLICY "Allow all access to gift_cards"
    ON public.gift_cards FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gift_card_transactions'
      AND policyname = 'Allow all access to gift_card_transactions'
  ) THEN
    CREATE POLICY "Allow all access to gift_card_transactions"
    ON public.gift_card_transactions FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_cards_card_number ON public.gift_cards(card_number);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_card_id ON public.gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_created_at ON public.gift_card_transactions(created_at DESC);

CREATE OR REPLACE FUNCTION public.recalculate_gift_card_balance(p_gift_card_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_gift_card_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.gift_cards gc
  SET
    balance = COALESCE((
      SELECT SUM(
        CASE
          WHEN t.transaction_type = 'redeem' THEN -t.amount
          ELSE t.amount
        END
      )
      FROM public.gift_card_transactions t
      WHERE t.gift_card_id = p_gift_card_id
    ), 0),
    updated_at = now()
  WHERE gc.id = p_gift_card_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_gift_card_balance_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_gift_card_id UUID;
BEGIN
  target_gift_card_id := COALESCE(NEW.gift_card_id, OLD.gift_card_id);
  PERFORM public.recalculate_gift_card_balance(target_gift_card_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gift_card_balance ON public.gift_card_transactions;
CREATE TRIGGER trg_sync_gift_card_balance
AFTER INSERT OR UPDATE OR DELETE ON public.gift_card_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_gift_card_balance_trigger();

DROP TRIGGER IF EXISTS update_gift_cards_updated_at ON public.gift_cards;
CREATE TRIGGER update_gift_cards_updated_at
BEFORE UPDATE ON public.gift_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
