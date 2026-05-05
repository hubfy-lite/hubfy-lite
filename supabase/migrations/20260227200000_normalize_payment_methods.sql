-- 1. Renomear valores existentes (seguro: nenhum registro usa esses valores hoje)
UPDATE public.orders SET payment_method = 'billet' WHERE payment_method = 'boleto';
UPDATE public.orders SET payment_method = 'credit_card' WHERE payment_method = 'credit';

-- 2. Dropar a constraint antiga
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

-- 3. Criar nova constraint com todos os valores normalizados
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN (
    'free',
    'pix',
    'billet',
    'credit_card',
    'dinheiro',
    'bank_transfer',
    'debit',
    'financed',
    'google_pay',
    'hybrid',
    'manual',
    'paypal',
    'picpay',
    'samsung_pay',
    'hotmart'
  ));

-- 4. Atualizar comentário
COMMENT ON COLUMN public.orders.payment_method IS
  'Método de pagamento normalizado. Valores aceitos: free, pix, billet, credit_card, dinheiro, bank_transfer, debit, financed, google_pay, hybrid, manual, paypal, picpay, samsung_pay, hotmart';
