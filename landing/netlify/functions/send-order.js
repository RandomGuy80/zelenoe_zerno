// Серверная функция: принимает заказ с сайта и отправляет его в Telegram.
// Токен и chat_id берутся из переменных окружения Netlify, в код их вставлять нельзя.

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return json(500, { error: 'Server is not configured' });

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Bad request' });
  }

  const name = clean(data.name, 100);
  const phone = clean(data.phone, 40);
  if (!name || phone.replace(/\D/g, '').length < 10) return json(400, { error: 'Invalid name or phone' });

  const text = [
    'Новый заказ с сайта',
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Кофе: ${clean(data.coffee, 100)}`,
    `Упаковка: ${clean(data.weight, 40)}`,
    `Помол: ${clean(data.grind, 60)}`,
    `Комментарий: ${clean(data.comment, 500) || '-'}`,
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });

  if (!response.ok) return json(502, { error: 'Telegram error' });
  return json(200, { ok: true });
};
