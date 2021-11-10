- check pos payment the same amount with pos order amount total
- if not update made pos payment amount the same with pos order
- Example:
--select id, amount from pos_payment where pos_order_id=7883
--update pos_payment set amount=302795.11 where id=12599
See to method: _process_payment_lines of pos order