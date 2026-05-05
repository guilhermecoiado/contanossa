-- Este arquivo é apenas para documentação da migração
-- O stripe_subscription_id será armazenado em user_metadata durante o webhook
-- Quando o usuário deleta a conta, o subscriptionId será recuperado de lá e cancelado no Stripe

-- Não precisa criar coluna nova pois user_metadata já armazena JSON
-- A migração happens no webhook ao atualizar user_metadata com stripe_subscription_id
