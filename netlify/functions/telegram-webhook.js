// Принимает сообщения и нажатия кнопок от Telegram. Показывает заказы только владельцам из TELEGRAM_CHAT_ID.
const { adminIds, tg, dbEnabled, db, when, orderText } = require('../lib/shared');

const BUTTON_NEW = '📋 Новые заказы';
const BUTTON_LAST = '🕘 Последние заказы';
const keyboard = { keyboard: [[{ text: BUTTON_NEW }, { text: BUTTON_LAST }]], resize_keyboard: true };

async function handle(update) {
  const admins = adminIds();

  // Нажатие кнопки «Выполнен» под заказом
  if (update.callback_query) {
    const q = update.callback_query;
    const chat_id = String(q.message?.chat?.id);
    if (!admins.includes(chat_id)) return;
    const match = /^done:(\d+)$/.exec(q.data || '');
    if (match && dbEnabled()) {
      await db(`orders?id=eq.${match[1]}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
      await tg('answerCallbackQuery', { callback_query_id: q.id, text: 'Отмечено как выполненный' });
      await tg('editMessageText', { chat_id, message_id: q.message.message_id, text: `${q.message.text}\n\n✅ Выполнен` });
    } else {
      await tg('answerCallbackQuery', { callback_query_id: q.id });
    }
    return;
  }

  const msg = update.message;
  if (!msg?.text) return;
  const chat_id = String(msg.chat.id);

  if (!admins.includes(chat_id)) {
    await tg('sendMessage', { chat_id, text: `Этот бот принимает заказы для владельца сайта.\nВаш chat_id: ${chat_id}` });
    return;
  }
  if (!dbEnabled()) {
    await tg('sendMessage', { chat_id, text: 'База заказов не подключена. Добавьте SUPABASE_URL и SUPABASE_SECRET_KEY.' });
    return;
  }

  const text = msg.text.trim();
  if (text === BUTTON_NEW || text === '/new') {
    const rows = await db('orders?status=eq.new&order=created_at.desc&limit=10');
    if (!rows.length) {
      await tg('sendMessage', { chat_id, text: 'Новых заказов нет.', reply_markup: keyboard });
      return;
    }
    for (const order of rows.reverse()) {
      await tg('sendMessage', {
        chat_id,
        text: `🆕 ${orderText(order)}`,
        reply_markup: { inline_keyboard: [[{ text: '✅ Выполнен', callback_data: `done:${order.id}` }]] },
      });
    }
  } else if (text === BUTTON_LAST || text === '/orders') {
    const rows = await db('orders?order=created_at.desc&limit=10');
    const list = rows
      .map((o) => `${o.status === 'done' ? '✅' : '🆕'} №${o.id} · ${when(o.created_at)}\n${o.name}, ${o.phone}\n${o.coffee}, ${o.weight}`)
      .join('\n\n');
    await tg('sendMessage', { chat_id, text: list || 'Заказов пока нет.', reply_markup: keyboard });
  } else {
    await tg('sendMessage', { chat_id, text: 'Нажмите кнопку ниже, чтобы посмотреть заказы.', reply_markup: keyboard });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || event.headers['x-telegram-bot-api-secret-token'] !== secret) return { statusCode: 401, body: '' };

  try {
    await handle(JSON.parse(event.body || '{}'));
  } catch (error) {
    console.error(error);
  }
  return { statusCode: 200, body: 'ok' };
};
