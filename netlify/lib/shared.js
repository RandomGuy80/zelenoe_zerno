// Общие функции для серверных функций: Telegram, база Supabase, форматирование заказа.

const adminIds = () =>
  String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);

async function tg(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error('Telegram error', method, res.status, await res.text());
  return res.ok;
}

const dbEnabled = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

async function db(path, options = {}) {
  const key = process.env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json', ...options.headers };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // старый формат ключа (JWT)
  const res = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const when = (iso) =>
  new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function orderText(o) {
  return [
    o.id ? `Заказ №${o.id}${o.created_at ? ` · ${when(o.created_at)}` : ''}` : 'Новый заказ',
    `Имя: ${o.name}`,
    `Телефон: ${o.phone}`,
    `Кофе: ${o.coffee}, ${o.weight}`,
    `Помол: ${o.grind}`,
    `Комментарий: ${o.comment || '-'}`,
  ].join('\n');
}

module.exports = { adminIds, tg, dbEnabled, db, when, orderText };
