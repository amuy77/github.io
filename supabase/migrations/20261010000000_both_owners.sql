-- 侑磨と彩加の 2 人ともオーナーにする（今いるお店のメンバー全員をオーナーに）。
-- これから登録する人は今まで通りスタッフで入る（join_first_shop）。何度流しても同じ結果。
update public.shop_members set role = 'owner' where role <> 'owner';
