// Принимает заказ с сайта, сохраняет его в базу Supabase и отправляет в Telegram.
const { adminIds, tg, dbEnabled, db, orderText } = require('../lib/shared');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const admins = adminIds();
  if (!process.env.TELEGRAM_BOT_TOKEN || !admins.length) return json(500, { error: 'Server is not configured' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Bad request' });
  }

  const order = {
    name: clean(data.name, 100),
    phone: clean(data.phone, 40),
    coffee: clean(data.coffee, 100),
    weight: clean(data.weight, 40),
    grind: clean(data.grind, 60),
    comment: clean(data.comment, 500),
  };
  if (!order.name || order.phone.replace(/\D/g, '').length < 10) return json(400, { error: 'Invalid name or phone' });

  let saved = order;
  let note = '';
  if (dbEnabled()) {
    try {
      const rows = await db('orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(order) });
      saved = rows[0];
    } catch (error) {
      console.error(error);
      note = '\n\n⚠️ Не удалось сохранить заказ в базу';
    }
  }

  const reply_markup = saved.id ? { inline_keyboard: [[{ text: '✅ Выполнен', callback_data: `done:${saved.id}` }]] } : undefined;
  const results = await Promise.all(
    admins.map((chat_id) => tg('sendMessage', { chat_id, text: `🆕 ${orderText(saved)}${note}`, reply_markup }))
  );
  if (!results.some(Boolean)) return json(502, { error: 'Telegram error' });
  return json(200, { ok: true });
};
