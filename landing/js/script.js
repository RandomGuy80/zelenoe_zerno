'use strict';

/* ===== Настройки: тексты степеней обжарки ===== */
const ROAST_STAGES = [
  { max: 33, name: 'Светлая обжарка', desc: 'Яркая кислинка, цветы и ягоды. Для воронки и аэропресса.' },
  { max: 66, name: 'Средняя обжарка', desc: 'Баланс сладости и кислоты, карамель, орех. Подходит для любого способа.' },
  { max: 100, name: 'Тёмная обжарка', desc: 'Плотное тело, горький шоколад. Для эспрессо и капучино.' },
];

/* ===== Настройки отправки заказов =====
   Заказ уходит в серверную функцию netlify/functions/send-order.js, а она пересылает его в Telegram.
   Работает только на сайте, развёрнутом на Netlify. Локально в WebStorm покажет ошибку отправки.
   Хотите демо-режим без отправки? Поставьте пустую строку: const ORDER_ENDPOINT = ''; */
const ORDER_ENDPOINT = '/.netlify/functions/send-order';
const ORDER_EXTRA_FIELDS = {};

/* ===== Вспомогательные функции ===== */
const $ = (selector) => document.querySelector(selector);

// Цвета берём из CSS-переменных, чтобы они менялись в одном месте
function cssColor(name) {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from, to, t) {
  return from.map((c, i) => Math.round(c + (to[i] - c) * t));
}

/* ===== Ползунок обжарки ===== */
const slider = $('#roast');
const bean = $('#bean');
const roastName = $('#roast-name');
const roastDesc = $('#roast-desc');
const lightColor = cssColor('--roast-light');
const darkColor = cssColor('--roast-dark');

function updateRoast() {
  const value = Number(slider.value);
  const t = value / 100;
  const [r, g, b] = mix(lightColor, darkColor, t);
  const stage = ROAST_STAGES.find((s) => value <= s.max);

  bean.style.setProperty('--t', t);
  bean.style.setProperty('--bean-color', `rgb(${r}, ${g}, ${b})`);
  roastName.textContent = stage.name;
  roastDesc.textContent = stage.desc;
}

slider.addEventListener('input', updateRoast);
updateRoast();

/* ===== Кнопки «В заказ» ===== */
const coffeeSelect = $('#coffee-select');

document.querySelectorAll('[data-coffee]').forEach((button) => {
  button.addEventListener('click', () => {
    coffeeSelect.value = button.dataset.coffee;
    $('#order').scrollIntoView();
    $('#name').focus({ preventScroll: true });
  });
});

/* ===== Форма заказа ===== */
const form = $('#order-form');
const success = $('#form-success');

function showError(field, message) {
  const input = form.elements[field];
  form.querySelector(`[data-error-for="${field}"]`).textContent = message;
  input.classList.toggle('invalid', Boolean(message));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = form.elements.name.value.trim();
  const phoneDigits = form.elements.phone.value.replace(/\D/g, '');
  let isValid = true;

  showError('name', name ? '' : 'Введите имя, чтобы мы знали, как к вам обращаться.');
  showError('phone', phoneDigits.length >= 10 ? '' : 'Введите телефон полностью, не меньше 10 цифр.');
  if (!name || phoneDigits.length < 10) isValid = false;
  if (!isValid) return;

  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form));
  success.hidden = false;
  success.textContent = 'Отправляем заказ…';
  button.disabled = true;

  try {
    if (ORDER_ENDPOINT) {
      const response = await fetch(ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...ORDER_EXTRA_FIELDS, ...data }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }
    success.textContent = `${name}, заказ «${data.coffee}» отправлен. Мы позвоним в течение часа.`;
    form.reset();
  } catch (error) {
    success.textContent = 'Не удалось отправить заказ. Попробуйте ещё раз или позвоните нам.';
  } finally {
    button.disabled = false;
  }
});
