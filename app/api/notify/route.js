import { NextResponse } from 'next/server';

const LOW_STOCK_LIMIT = 5; // เตือนเมื่อสต๊อกเหลือ <= 5

// กัน HTML แทรกในชื่อสินค้า (Telegram parse_mode HTML)
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ส่งข้อความเข้า Telegram
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) throw new Error(`Telegram error ${res.status}`);
}

export async function POST(request) {
  try {
    const { items, total } = await request.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'no items' }, { status: 400 });
    }

    const time = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    // งานที่ 1: แจ้งเตือน Order ใหม่ (1 ข้อความต่อ 1 บิล)
    const lines = items
      .map(
        (i) =>
          `- สินค้า: ${esc(i.name)}\n` +
          `- จำนวน: ${Number(i.qty)} ชิ้น\n` +
          `- ราคารวม: ${Number(i.lineTotal).toLocaleString()} บาท\n` +
          `- สต๊อกคงเหลือปัจจุบัน: ${Number(i.stockAfter)} ชิ้น`
      )
      .join('\n\n');
    const orderText =
      `🛍️ <b>มีรายการขายใหม่!</b>\n\n${lines}\n\n` +
      `💰 ยอดบิลรวม: <b>${Number(total).toLocaleString()}</b> บาท\n` +
      `- เวลา: ${time}`;
    await sendTelegram(orderText);

    // งานที่ 2: แจ้งเตือนสต๊อกใกล้หมด (แยก 1 ข้อความต่อสินค้า)
    for (const i of items) {
      if (Number(i.stockAfter) <= LOW_STOCK_LIMIT) {
        await sendTelegram(
          `🚨 <b>[เตือนภัย] สต๊อกสินค้าใกล้หมด!</b>\n` +
            `- สินค้า: ${esc(i.name)}\n` +
            `- คงเหลือเพียง: ${Number(i.stockAfter)} ชิ้น\n` +
            `⚠️ กรุณาเติมสต๊อกสินค้าด่วน!`
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
