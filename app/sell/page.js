'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ดึงรายการสินค้าสำหรับ dropdown
  async function loadProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });
    if (error) setMessage({ type: 'error', text: error.message });
    else setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  // สินค้าที่เลือกอยู่ และยอดรวมที่คำนวณอัตโนมัติ
  const selected = products.find((p) => p.id === productId);
  const qty = parseInt(quantity, 10) || 0;
  const total = selected ? Number(selected.price) * qty : 0;

  async function handleSell(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!selected) return setMessage({ type: 'error', text: 'กรุณาเลือกสินค้า' });
    if (qty < 1) return setMessage({ type: 'error', text: 'จำนวนต้องมากกว่า 0' });

    setSaving(true);

    // 1) ดึง stock ล่าสุดจากฐานข้อมูลอีกครั้ง (กันข้อมูลในหน้าจอเก่า)
    const { data: fresh, error: fetchErr } = await supabase
      .from('products')
      .select('stock')
      .eq('id', selected.id)
      .single();
    if (fetchErr) {
      setSaving(false);
      return setMessage({ type: 'error', text: fetchErr.message });
    }

    // 2) ตรวจสอบว่าสต็อกพอหรือไม่
    if (fresh.stock < qty) {
      setSaving(false);
      loadProducts();
      return setMessage({
        type: 'error',
        text: `สินค้าไม่พอ (คงเหลือ ${fresh.stock} ${selected.unit || ''})`,
      });
    }

    // 3) ตัดสต็อก โดยเช็คว่า stock ยังเท่าเดิม (กันคนอื่นขายพร้อมกัน)
    const { data: updated, error: updateErr } = await supabase
      .from('products')
      .update({ stock: fresh.stock - qty })
      .eq('id', selected.id)
      .eq('stock', fresh.stock)
      .select();
    if (updateErr || !updated || updated.length === 0) {
      setSaving(false);
      loadProducts();
      return setMessage({
        type: 'error',
        text: updateErr ? updateErr.message : 'สต็อกมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง',
      });
    }

    // 4) บันทึกรายการขายลงตาราง sales
    const { error: insertErr } = await supabase.from('sales').insert({
      product_id: selected.id,
      product_name: selected.name,
      quantity: qty,
      total_price: total,
      sold_at: new Date().toISOString(),
    });
    if (insertErr) {
      // บันทึกไม่สำเร็จ -> คืนสต็อกกลับ
      await supabase.from('products').update({ stock: fresh.stock }).eq('id', selected.id);
      setSaving(false);
      loadProducts();
      return setMessage({ type: 'error', text: insertErr.message });
    }

    // 5) สำเร็จ: แจ้งผล รีเซ็ตฟอร์ม และโหลดสต็อกใหม่
    setMessage({
      type: 'success',
      text: `ขายสำเร็จ: ${selected.name} x ${qty} = ${total.toLocaleString()} บาท`,
    });
    setProductId('');
    setQuantity('1');
    setSaving(false);
    loadProducts();
  }

  if (loading) return <p>กำลังโหลด...</p>;

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {message.text && <p className={message.type}>{message.text}</p>}

      <form className="card" onSubmit={handleSell} style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
        {/* เลือกสินค้า */}
        <label>
          สินค้า
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            <option value="">-- เลือกสินค้า --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} - {Number(p.price).toLocaleString()} บาท (เหลือ {p.stock})
              </option>
            ))}
          </select>
        </label>

        {/* จำนวนที่ขาย */}
        <label>
          จำนวน
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          />
        </label>

        {/* ยอดรวมอัตโนมัติ */}
        <div style={{ fontSize: '1.2rem' }}>
          ยอดรวม: <strong>{total.toLocaleString()}</strong> บาท
        </div>

        <button type="submit" disabled={saving || !selected}>
          {saving ? 'กำลังบันทึก...' : 'ขาย'}
        </button>
      </form>
    </div>
  );
}
